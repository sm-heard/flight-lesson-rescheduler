import { DateTime } from "luxon";

import { getOpenProposals, type ProposalWithContext } from "@/lib/proposals/query";
import { AcceptProposalButton } from "@/components/accept-proposal-button";

function formatWindow(start: Date, end: Date, tz: string) {
  const startDt = DateTime.fromJSDate(start).setZone(tz);
  const endDt = DateTime.fromJSDate(end).setZone(tz);
  return `${startDt.toFormat("EEE, MMM d h:mma")} – ${endDt.toFormat("h:mma z")}`;
}

export default async function ProposalsPage() {
  const proposals = await getOpenProposals();

  const grouped = proposals.reduce<Record<string, ProposalWithContext[]>>((acc, row) => {
    const key = row.booking.id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row);
    return acc;
  }, {});

  const entries = Object.values(grouped);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Pending reschedule proposals</h1>
        <p className="text-sm text-slate-600">
          Students receive three options per conflict. Lock in a new time below to update the booking, expire other proposals, and send confirmation email.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
          All caught up—no open proposals right now.
        </div>
      ) : (
        <div className="space-y-5">
          {entries.map((group) => {
            const [first] = group;
            const booking = first.booking;
            const student = first.student;

            return (
              <section
                key={booking.id}
                className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm"
              >
                <div className="flex flex-col gap-1 border-b border-slate-100 pb-4">
                  <p className="text-sm font-medium text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{student.trainingLevel.replace("-", " ")}</p>
                  <p className="text-xs text-slate-500">Original window: {formatWindow(booking.startTime, booking.endTime, booking.tz)}</p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {group.map(({ proposal }) => (
                    <article
                      key={proposal.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm"
                    >
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Option {proposal.rank}</p>
                        <p className="text-base font-semibold text-slate-900">
                          {formatWindow(proposal.startTime, proposal.endTime, booking.tz)}
                        </p>
                        <p className="text-xs text-slate-600">
                          {proposal.aiRationale || "Suggested by scheduling engine."}
                        </p>
                      </div>
                      <div className="mt-4">
                        <AcceptProposalButton proposalId={proposal.id} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
