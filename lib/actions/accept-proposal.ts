"use server";

import { revalidatePath } from "next/cache";

import { acceptProposal } from "@/lib/scheduling/accept";

export type AcceptState = {
  ok: boolean;
  error?: string | null;
};

const INITIAL_STATE: AcceptState = { ok: false, error: null };

export async function acceptProposalAction(
  _prevState: AcceptState = INITIAL_STATE,
  formData: FormData,
): Promise<AcceptState> {
  const proposalId = formData.get("proposalId");
  if (!proposalId || typeof proposalId !== "string") {
    return { ok: false, error: "Missing proposal id" };
  }

  try {
    await acceptProposal(proposalId);
    revalidatePath("/");
    revalidatePath("/proposals");
    revalidatePath("/notifications/outbox");
    return { ok: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept proposal";
    return { ok: false, error: message };
  }
}
