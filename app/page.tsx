import { DateTime } from "luxon";

import type { WeatherMonitorStats } from "@/lib/conflicts";
import { triggerWeatherCheck } from "@/lib/actions/trigger-weather-check";
import { getDashboardMetrics } from "@/lib/stats/metrics";
import { getUpcomingBookings } from "@/lib/bookings/query";
import { CheckWeatherForm } from "@/components/check-weather-form";

type StatsState = {
  stats: WeatherMonitorStats | null;
  error?: string | null;
};

async function runCheck(_: StatsState, __: FormData): Promise<StatsState> {
  "use server";

  try {
    const stats = await triggerWeatherCheck();
    return { stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to trigger weather monitor.";
    return { stats: null, error: message };
  }
}

function formatWindow(start: Date, end: Date, tz: string) {
  const startDt = DateTime.fromJSDate(start).setZone(tz);
  const endDt = DateTime.fromJSDate(end).setZone(tz);
  return `${startDt.toFormat("EEE, MMM d h:mma")} – ${endDt.toFormat("h:mma z")}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return "bg-emerald-100 text-emerald-700";
    case "conflict":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "rescheduled":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default async function Home() {
  const [metrics, bookings] = await Promise.all([
    getDashboardMetrics(),
    getUpcomingBookings(8),
  ]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Bookings</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.totalBookings}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Weather conflicts</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{metrics.conflictsDetected}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reschedules confirmed</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{metrics.reschedulesConfirmed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Avg reschedule time</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {metrics.averageRescheduleMinutes !== null ? `${metrics.averageRescheduleMinutes} min` : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Weather Monitor</h1>
          <p className="text-sm text-slate-600">
            Run the corridor weather scan on demand. Unsafe lessons auto-cancel, proposals regenerate, and notifications drop into the outbox.
          </p>
        </div>
        <div className="mt-6">
          <CheckWeatherForm action={runCheck} />
        </div>
      </div>

      <div className="grid gap-4 text-sm text-slate-600 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Upcoming bookings</h2>
            <span className="text-xs text-slate-500">Next 48 hours</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                      No upcoming bookings in the next 48 hours.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{booking.studentName}</span>
                          <span className="text-xs text-slate-500 capitalize">{booking.trainingLevel.replace("-", " ")}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {formatWindow(booking.startTime, booking.endTime, booking.tz)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Outbox</h2>
            <p className="mt-2">
              Track delivery results in <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/notifications/outbox</code>. Entries include mode (preview vs send), provider IDs, and throttling reasons.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Environment Tips</h2>
            <p className="mt-2">
              Toggle email behaviour via <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">EMAIL_MODE</code>. Use <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">preview</code> for local demos and switch to <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">send</code> with <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">DEMO_EMAIL</code> when testing Resend.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
