"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { acceptProposalAction, type AcceptState } from "@/lib/actions/accept-proposal";

const INITIAL_STATE: AcceptState = { ok: false, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
      disabled={pending}
    >
      {pending ? "Confirming…" : "Accept"}
    </button>
  );
}

type Props = {
  proposalId: string;
};

export function AcceptProposalButton({ proposalId }: Props) {
  const [state, formAction] = useActionState(acceptProposalAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="proposalId" value={proposalId} />
      <SubmitButton />
      {state.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : state.ok ? (
        <p className="text-xs text-emerald-600">Proposal accepted.</p>
      ) : null}
    </form>
  );
}
