"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

import type { UpcomingBooking } from "@/lib/bookings/query";

type Props = {
  bookings: UpcomingBooking[];
};

type StatusFilter = "all" | "scheduled" | "conflict" | "cancelled" | "rescheduled" | "completed";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  scheduled: "Scheduled",
  conflict: "Conflict",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  completed: "Completed",
};

export function UpcomingBookings({ bookings }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(() => {
    const set = new Set<StatusFilter>(["all"]);
    bookings.forEach((booking) => {
      set.add(booking.status as StatusFilter);
    });
    return Array.from(set).filter((value): value is StatusFilter => value in FILTER_LABELS);
  }, [bookings]);

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    return bookings.filter((booking) => booking.status === filter);
  }, [bookings, filter]);

  const selected = selectedId ? bookings.find((booking) => booking.id === selectedId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              filter === value
                ? "border-blue-500 bg-blue-500 text-white shadow"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600",
            )}
            onClick={() => setFilter(value)}
          >
            {FILTER_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Window</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" aria-label="actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No bookings match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">{booking.studentName}</span>
                      <span className="text-xs text-slate-500 capitalize">{booking.trainingLevel.replace("-", " ")}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{booking.summary}</td>
                  <td className="px-3 py-2">
                    <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", booking.badgeClass)}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      onClick={() => setSelectedId(booking.id)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={() => setSelectedId(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              onClick={() => setSelectedId(null)}
            >
              ✕
            </button>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selected.studentName}</p>
                <p className="text-xs text-slate-500 capitalize">{selected.trainingLevel.replace("-", " ")}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Schedule</p>
                <p className="mt-1 font-medium text-slate-900">{selected.summary}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize">
                    {selected.status}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Timezone</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selected.tz}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
