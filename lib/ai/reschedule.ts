import { z } from "zod";
import { generateObject } from "ai";

import { getOpenAIClient } from "@/lib/ai/client";

export type SlotForAI = {
  startISO: string;
  endISO: string;
  localLabel: string;
};

const responseSchema = z.object({
  proposals: z
    .array(
      z.object({
        startISO: z.string().datetime(),
        endISO: z.string().datetime(),
        rationale: z.string().min(1),
      }),
    )
    .max(3),
});

export async function rankSlotsWithAI(
  slots: SlotForAI[],
  context: {
    studentName: string;
    trainingLevel: string;
    bookingSummary: string;
  },
) {
  if (slots.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  if (!client) {
    return null;
  }

  const prompt = `Student: ${context.studentName} (${context.trainingLevel}). Booking: ${context.bookingSummary}.
Candidate slots:
${slots
    .map(
      (slot, index) =>
        `Option ${index + 1}: ${slot.localLabel} (${slot.startISO} to ${slot.endISO})`,
    )
    .join("\n")}

Choose up to three distinct options and provide a short rationale for each.`;

  const result = await generateObject({
    model: client("gpt-4o-mini"),
    schema: responseSchema,
    system:
      "You are a flight school scheduling assistant. You evaluate weather-safe reschedule slots and explain your top picks.",
    prompt,
  });

  return result.object.proposals;
}
