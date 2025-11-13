import Link from "next/link";

import "@/lib/env";
import { getRecentNotifications } from "@/lib/notifications/query";

function formatDate(value: Date | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function extractMeta(meta: unknown) {
  if (!meta || typeof meta !== "object") return {} as Record<string, unknown>;
  return meta as Record<string, unknown>;
}

export default async function OutboxPage() {
  const notifications = await getRecentNotifications(50);

  return (
    <main className="space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Notification Outbox</h1>
        <p className="text-sm text-slate-600">
          Latest deliveries captured in the database. Use the API at
          {" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
            /api/notifications/outbox
          </code>
          {" "}
          for programmatic access.
        </p>
        <p className="text-xs text-slate-500">
          Tip: switch back to the dashboard via {" "}
          <Link href="/" className="underline">
            /
          </Link>
          .
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Kind</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Mode</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Recipient</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Sent</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Created</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Provider ID</th>
              <th className="px-3 py-2 text-left font-medium text-slate-700">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                  No notifications recorded yet.
                </td>
              </tr>
            ) : (
              notifications.map((notification) => {
                const meta = extractMeta(notification.meta);
                const mode = typeof meta.mode === "string" ? meta.mode : "preview";
                const reason = typeof meta.reason === "string" ? meta.reason : "";

                return (
                  <tr key={notification.id} className="align-top">
                    <td className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-slate-600">
                      {notification.kind}
                    </td>
                    <td className="px-3 py-2 text-slate-800">{notification.status}</td>
                    <td className="px-3 py-2 text-slate-800">{mode}</td>
                    <td className="px-3 py-2 text-slate-800">{notification.toEmail}</td>
                    <td className="px-3 py-2 text-slate-800">{formatDate(notification.sentAt)}</td>
                    <td className="px-3 py-2 text-slate-800">{formatDate(notification.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-800">
                      {notification.providerId ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      {reason || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
