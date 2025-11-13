import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import { evaluateSafety } from "@/lib/safety/rules";
import { generateCandidateProposals, replaceProposals } from "@/lib/scheduling/proposals";
import { dispatchNotification, buildBookingManageUrl } from "@/lib/notifications/service";
import { getWeatherProvider } from "@/lib/weather";
import type { Coordinates, WeatherPointCheck } from "@/lib/weather/types";
import {
  bookings,
  Booking,
  BookingStatus,
  events,
  students,
  Student,
  weatherChecks,
  WeatherLocation,
} from "@/drizzle/schema";

const ACTIVE_STATUSES: BookingStatus[] = ["scheduled", "conflict"];
const DEFAULT_LOOKAHEAD_HOURS = 48;
const MAX_BATCH = 25;

type CandidateBooking = {
  booking: Booking;
  student: Student;
};

export type PointCheckResult = WeatherPointCheck & {
  safe: boolean;
  rule: string;
  message?: string;
};

export type BookingWeatherAssessment = {
  booking: Booking;
  student: Student;
  safe: boolean;
  summary: string;
  failingPoint?: PointCheckResult;
  points: PointCheckResult[];
};

export type ConflictMonitorOptions = {
  from?: Date;
  to?: Date;
  limit?: number;
};

function corridorPoints(booking: Booking): Array<{ location: WeatherLocation; coords: Coordinates }> {
  const midpoint = {
    lat: (booking.depLat + booking.arrLat) / 2,
    lon: (booking.depLon + booking.arrLon) / 2,
  } satisfies Coordinates;

  return [
    {
      location: "departure" as const,
      coords: { lat: booking.depLat, lon: booking.depLon },
    },
    { location: "midpoint" as const, coords: midpoint },
    {
      location: "arrival" as const,
      coords: { lat: booking.arrLat, lon: booking.arrLon },
    },
  ];
}

function formatWindow(start: Date, end: Date, tz: string) {
  const startDt = DateTime.fromJSDate(start).setZone(tz);
  const endDt = DateTime.fromJSDate(end).setZone(tz);
  return `${startDt.toFormat("EEE, MMM d h:mma")} – ${endDt.toFormat("h:mma z")}`;
}

function formatLessonWindow(booking: Booking) {
  return formatWindow(booking.startTime, booking.endTime, booking.tz);
}

async function fetchCandidateBookings(
  options: ConflictMonitorOptions,
): Promise<CandidateBooking[]> {
  const now = options.from ? DateTime.fromJSDate(options.from) : DateTime.now();
  const lookaheadEnd = options.to
    ? DateTime.fromJSDate(options.to)
    : now.plus({ hours: DEFAULT_LOOKAHEAD_HOURS });

  const rows = await db
    .select({
      booking: bookings,
      student: students,
    })
    .from(bookings)
    .innerJoin(students, eq(bookings.studentId, students.id))
    .where(
      and(
        inArray(bookings.status, ACTIVE_STATUSES),
        gte(bookings.startTime, now.toJSDate()),
        lte(bookings.startTime, lookaheadEnd.toJSDate()),
      ),
    )
    .orderBy(bookings.startTime)
    .limit(options.limit ?? MAX_BATCH);

  return rows.map((row) => ({
    booking: row.booking,
    student: row.student,
  }));
}

function toPointCheck(
  location: WeatherLocation,
  coords: Coordinates,
  snapshot: WeatherPointCheck["snapshot"],
): WeatherPointCheck {
  return { location, coords, snapshot };
}

async function evaluateBooking(
  candidate: CandidateBooking,
): Promise<BookingWeatherAssessment> {
  const provider = getWeatherProvider();
  const points = corridorPoints(candidate.booking);

  const weatherPoints: WeatherPointCheck[] = await Promise.all(
    points.map(async (point) => {
      const snapshot = await provider.getForecast(point.coords, candidate.booking.startTime);
      return toPointCheck(point.location, point.coords, snapshot);
    }),
  );

  const assessment = evaluateSafety(candidate.student.trainingLevel, weatherPoints);

  const pointsWithRules: PointCheckResult[] = assessment.points.map((result, index) => ({
    ...weatherPoints[index],
    safe: result.safe,
    rule: result.rule,
    message: result.message,
  }));

  const failingPoint = assessment.failingPoint
    ? pointsWithRules.find((point) => point.location === assessment.failingPoint?.location && !point.safe)
    : undefined;

  return {
    booking: candidate.booking,
    student: candidate.student,
    safe: assessment.safe,
    summary: assessment.summary,
    failingPoint,
    points: pointsWithRules,
  };
}

async function recordWeatherChecks(result: BookingWeatherAssessment) {
  const payloads = result.points.map((point) => ({
    bookingId: result.booking.id,
    location: point.location,
    observedAt: point.snapshot.observedAt,
    forecastFor: point.snapshot.forecastFor,
    payload: {
      ...point.snapshot,
      observedAt: point.snapshot.observedAt.toISOString(),
      forecastFor: point.snapshot.forecastFor.toISOString(),
    },
    safe: point.safe,
    reason: point.message,
  }));

  await db.insert(weatherChecks).values(payloads);
}

async function recordWeatherEvent(result: BookingWeatherAssessment) {
  const eventType = result.safe ? "weather_check_passed" : "weather_conflict_detected";
  await db.insert(events).values({
    type: eventType,
    bookingId: result.booking.id,
    details: {
      summary: result.summary,
      failingPoint: result.failingPoint
        ? {
            location: result.failingPoint.location,
            rule: result.failingPoint.rule,
            message: result.failingPoint.message,
          }
        : null,
    },
  });
}

async function logEvent(
  bookingId: string,
  type: string,
  details: Record<string, unknown>,
) {
  await db.insert(events).values({
    type,
    bookingId,
    details,
  });
}

async function fetchStudentBookings(studentId: string) {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.studentId, studentId));
}

type UnsafeHandlingResult = {
  proposalsGenerated: number;
  notificationsDispatched: number;
};

async function handleUnsafeAssessment(
  assessment: BookingWeatherAssessment,
): Promise<UnsafeHandlingResult> {
  const { booking, student } = assessment;
  const existing = await fetchStudentBookings(booking.studentId);
  const proposals = await generateCandidateProposals(booking, student, existing);
  await replaceProposals(booking.id, proposals);

  if (booking.status !== "cancelled") {
    await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    await logEvent(booking.id, "auto_cancelled", {
      summary: assessment.summary,
      failingPoint: assessment.failingPoint
        ? {
            location: assessment.failingPoint.location,
            rule: assessment.failingPoint.rule,
          }
        : null,
    });
  }

  await logEvent(booking.id, "proposals_created", {
    count: proposals.length,
    source: proposals.length > 0 ? proposals[0]?.source : null,
  });

  const lessonWindow = formatLessonWindow(booking);
  const manageUrl = buildBookingManageUrl(booking.id);

  let notificationsDispatched = 0;

  const conflictResult = await dispatchNotification({
    bookingId: booking.id,
    toEmail: student.email,
    kind: "conflict_detected",
    template: {
      kind: "conflict_detected",
      studentName: student.name,
      lessonWindow,
      summary: assessment.summary,
      manageUrl,
    },
  });
  notificationsDispatched += 1;

  await logEvent(booking.id, "notification_conflict", {
    status: conflictResult.status,
    reason: conflictResult.reason ?? null,
  });

  if (proposals.length > 0) {
    const proposalsForEmail = proposals.map((proposal) => ({
      label: formatWindow(proposal.start, proposal.end, booking.tz),
      rationale: proposal.rationale,
    }));

    const proposalsResult = await dispatchNotification({
      bookingId: booking.id,
      toEmail: student.email,
      kind: "proposals_ready",
      template: {
        kind: "proposals_ready",
        studentName: student.name,
        lessonWindow,
        proposals: proposalsForEmail,
        manageUrl,
      },
    });
    notificationsDispatched += 1;

    await logEvent(booking.id, "notification_proposals", {
      status: proposalsResult.status,
      reason: proposalsResult.reason ?? null,
    });
  }

  return {
    proposalsGenerated: proposals.length,
    notificationsDispatched,
  };
}

export type WeatherMonitorStats = {
  total: number;
  safe: number;
  conflicts: number;
  proposalsGenerated: number;
  notificationsDispatched: number;
};

export async function runWeatherMonitor(
  options: ConflictMonitorOptions = {},
): Promise<{ processed: BookingWeatherAssessment[]; stats: WeatherMonitorStats }> {
  const candidates = await fetchCandidateBookings(options);

  const results: BookingWeatherAssessment[] = [];
  const stats: WeatherMonitorStats = {
    total: candidates.length,
    safe: 0,
    conflicts: 0,
    proposalsGenerated: 0,
    notificationsDispatched: 0,
  };

  for (const candidate of candidates) {
    const assessment = await evaluateBooking(candidate);
    results.push(assessment);
    await recordWeatherChecks(assessment);
    await recordWeatherEvent(assessment);

    if (assessment.safe) {
      stats.safe += 1;
      continue;
    }

    stats.conflicts += 1;
    const outcome = await handleUnsafeAssessment(assessment);
    stats.proposalsGenerated += outcome.proposalsGenerated;
    stats.notificationsDispatched += outcome.notificationsDispatched;
  }

  return { processed: results, stats };
}
