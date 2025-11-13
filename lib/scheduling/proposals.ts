import { DateTime } from "luxon";

import { and, eq } from "drizzle-orm";

import type { Booking, Student } from "@/drizzle/schema";
import { MAX_PROPOSALS } from "@/lib/scheduling/config";
import { computeAvailableSlots } from "@/lib/scheduling/availability";
import { rankSlotsWithAI } from "@/lib/ai/reschedule";
import { db } from "@/lib/db/client";
import { rescheduleProposals } from "@/drizzle/schema";

export type CandidateProposal = {
  start: Date;
  end: Date;
  rationale: string;
  rank: number;
  source: "deterministic" | "ai";
};

type CandidateInternal = {
  start: Date;
  end: Date;
  label: string;
  score: number;
  rationale: string;
};

function buildDeterministicRationale(start: DateTime, now: DateTime) {
  const parts: string[] = [];

  if (start <= now.plus({ hours: 6 })) {
    parts.push("Soonest available time");
  }

  if (start.hour >= 8 && start.hour < 12) {
    parts.push("Morning conditions are typically calmer");
  } else if (start.hour >= 12 && start.hour < 17) {
    parts.push("Afternoon slot avoids peak winds");
  } else if (start.hour >= 17 && start.hour < 19) {
    parts.push("Late-day option if mornings are unavailable");
  }

  if (start.hasSame(now, "day")) {
    parts.push("Keeps training on the same day");
  } else if (start.diff(now, "days").days < 1.5) {
    parts.push("Reschedules within a day");
  }

  if (parts.length === 0) {
    parts.push("Fits within flight school hours");
  }

  return parts.join(". ");
}

function scoreSlot(start: DateTime, now: DateTime) {
  const hoursAhead = start.diff(now, "hours").hours;
  const base = Math.max(0, 72 - hoursAhead);
  const morningBonus = start.hour >= 8 && start.hour < 12 ? 10 : 0;
  const sameDayBonus = start.hasSame(now, "day") ? 6 : 0;
  const eveningPenalty = start.hour >= 17 ? -4 : 0;
  return base + morningBonus + sameDayBonus + eveningPenalty;
}

function buildLabel(start: DateTime, end: DateTime) {
  return `${start.toFormat("EEE, MMM d h:mma")} – ${end.toFormat("h:mma z")}`;
}

export async function generateCandidateProposals(
  booking: Booking,
  student: Student,
  existingBookings: Booking[],
) {
  const tz = booking.tz;
  const now = DateTime.now().setZone(tz);

  const filtered = existingBookings.filter(
    (b) => b.id !== booking.id && b.status !== "cancelled",
  );

  const slots = computeAvailableSlots(filtered, {
    tz,
    from: now.toJSDate(),
  });

  if (slots.length === 0) {
    return [];
  }

  const candidates: CandidateInternal[] = slots.map((slot) => {
    const start = DateTime.fromJSDate(slot.start).setZone(tz);
    const end = DateTime.fromJSDate(slot.end).setZone(tz);
    return {
      start: slot.start,
      end: slot.end,
      label: buildLabel(start, end),
      score: scoreSlot(start, now),
      rationale: buildDeterministicRationale(start, now),
    } satisfies CandidateInternal;
  });

  candidates.sort((a, b) => b.score - a.score);
  const topDeterministic = candidates.slice(0, MAX_PROPOSALS);

  const aiInput = candidates.slice(0, 8).map((candidate) => ({
    startISO: DateTime.fromJSDate(candidate.start).toUTC().toISO(),
    endISO: DateTime.fromJSDate(candidate.end).toUTC().toISO(),
    localLabel: candidate.label,
  }));

  let chosen = topDeterministic;
  const aiResult = aiInput.length
    ? await rankSlotsWithAI(aiInput, {
        studentName: student.name,
        trainingLevel: student.trainingLevel,
        bookingSummary: buildLabel(
          DateTime.fromJSDate(booking.startTime).setZone(tz),
          DateTime.fromJSDate(booking.endTime).setZone(tz),
        ),
      }).catch(() => null)
    : null;

  if (aiResult && aiResult.length > 0) {
    const map = new Map(
      candidates.map((candidate) => [
        DateTime.fromJSDate(candidate.start).toUTC().toISO(),
        candidate,
      ]),
    );

    const aiCandidates: CandidateInternal[] = [];
    for (const proposal of aiResult) {
      const match = map.get(proposal.startISO);
      if (!match) continue;
      aiCandidates.push({
        ...match,
        rationale: proposal.rationale,
      });
      if (aiCandidates.length >= MAX_PROPOSALS) {
        break;
      }
    }

    if (aiCandidates.length > 0) {
      chosen = aiCandidates;
    }
  }

  return chosen.slice(0, MAX_PROPOSALS).map((candidate, index) => ({
    start: candidate.start,
    end: candidate.end,
    rationale: candidate.rationale,
    rank: index + 1,
    source: aiResult && aiResult.length > 0 ? "ai" : "deterministic",
  }));
}

export async function replaceProposals(
  bookingId: string,
  proposals: CandidateProposal[],
) {
  await db.transaction(async (tx) => {
    await tx
      .update(rescheduleProposals)
      .set({ status: "expired" })
      .where(and(eq(rescheduleProposals.bookingId, bookingId), eq(rescheduleProposals.status, "proposed")));

    if (proposals.length === 0) {
      return;
    }

    await tx.insert(rescheduleProposals).values(
      proposals.map((proposal) => ({
        bookingId,
        startTime: proposal.start,
        endTime: proposal.end,
        rank: proposal.rank,
        status: "proposed",
        aiRationale: proposal.rationale,
      })),
    );
  });
}
