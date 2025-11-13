"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { WeatherMonitorStats } from "@/lib/conflicts";

type StatsState = {
  stats: WeatherMonitorStats | null;
  error?: string | null;
};

const initialState: StatsState = {
  stats: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
      disabled={pending}
    >
      {pending ? "Checking weather…" : "Check weather now"}
    </button>
  );
}

type Props = {
  action: (state: StatsState, formData: FormData) => Promise<StatsState>;
};

export function CheckWeatherForm({ action }: Props) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <SubmitButton />
        <p className="text-xs text-slate-500">
          Triggers the weather monitor pipeline, auto-cancels unsafe lessons, regenerates proposals, and
          queues notifications.
        </p>
      </form>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.stats ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Latest run summary</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-5">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Total evaluated</dt>
              <dd className="text-base font-semibold text-slate-900">{state.stats.total}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Safe</dt>
              <dd className="text-base font-semibold text-emerald-600">{state.stats.safe}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Conflicts</dt>
              <dd className="text-base font-semibold text-red-600">{state.stats.conflicts}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Proposals created</dt>
              <dd className="text-base font-semibold text-slate-900">{state.stats.proposalsGenerated}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Notifications dispatched</dt>
              <dd className="text-base font-semibold text-slate-900">{state.stats.notificationsDispatched}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
