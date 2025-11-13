import type { WeatherMonitorStats } from "@/lib/conflicts";
import { triggerWeatherCheck } from "@/lib/actions/trigger-weather-check";
import { getDashboardMetrics } from "@/lib/stats/metrics";
import { getUpcomingBookings } from "@/lib/bookings/query";
import { CheckWeatherForm } from "@/components/check-weather-form";
import { UpcomingBookings } from "@/components/upcoming-bookings";
import { EventTimeline } from "@/components/event-timeline";
import { getRecentEvents } from "@/lib/events/query";
import { getTrendData } from "@/lib/stats/trends";
import { TrendChart } from "@/components/trend-chart";

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

export default async function Home() {
  const [metrics, bookings, events, trend] = await Promise.all([
    getDashboardMetrics(),
    getUpcomingBookings(8),
    getRecentEvents(6),
    getTrendData(7),
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
          <UpcomingBookings bookings={bookings} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">Outbox</h2>
            <p className="mt-2">
              Track delivery results in <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/notifications/outbox</code>. Entries include mode (preview vs send), provider IDs, and throttling reasons.
            </p>
          </div>
          <TrendChart data={trend} />
          <EventTimeline events={events} />
        </div>
      </div>
    </section>
  );
}
