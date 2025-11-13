import { DateTime } from "luxon";

import type { TimelineEvent } from "@/lib/events/query";

type Props = {
  events: TimelineEvent[];
};

function formatTimestamp(value: Date) {
  return DateTime.fromJSDate(value).toRelative() ?? DateTime.fromJSDate(value).toFormat("MMM d, h:mma");
}

function summarize(event: TimelineEvent) {
  switch (event.type) {
    case "weather_conflict_detected":
      return "Weather conflict detected";
    case "auto_cancelled":
      return "Booking auto-cancelled";
    case "proposals_created":
      return "Generated reschedule proposals";
    case "notification_conflict":
      return "Conflict notification dispatched";
    case "notification_proposals":
      return "Proposals email sent";
    case "proposal_accepted":
      return "Proposal accepted";
    default:
      return event.type.replace(/_/g, " ");
  }
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-500 shadow-sm">
        No recent events recorded.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Recent activity</h2>
      <ol className="mt-4 space-y-4 text-sm">
        {events.map((event) => (
          <li key={event.id} className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
            <div className="flex-1">
              <p className="font-medium text-slate-900">{summarize(event)}</p>
              <p className="text-xs text-slate-500">{formatTimestamp(event.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
