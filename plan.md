# Flight Lesson Rescheduler — Implementation Plan

This plan reflects the locked decisions and constraints you provided and is optimized for a quick, clean demo with mocked data, minimal risk of accidental emails, and a simple deployment story.

## Decisions Locked
- Hosting/runtime: Vercel (Next.js 15 app) with Vercel Cron (hourly)
- DB: Neon Postgres for both dev and prod
- ORM: Drizzle ORM
- Weather: Mock provider that mimics WeatherAPI.com responses
- AI: Vercel AI SDK with OpenAI; deterministic fallback
- Email: Outbox preview by default; optional single-recipient sending via Resend; throttle aggressively
- Region/TZ: Seattle area (America/Los_Angeles), KBFI ↔ KPAE
- Ops window: 07:00–19:00 local
- Lesson length: 2 hours
- Training levels and weather minima: student/private/instrument as in PRD
- Auto-cancel on unsafe conditions; generate top 3 reschedule options within next 3 days
- No auth (demo)

---

## Architecture Overview
- Next.js App Router monolith (UI + API routes + Server Actions)
- Hourly cron invokes `POST /api/cron/check-weather` with a secret header
- Drizzle + Neon driver; schema-as-code; migrations via drizzle-kit
- Mock Weather provider: returns fixture data for three points (departure, midpoint, arrival)
- Safety engine maps training level → thresholds; aggregates worst-case across the three points
- Conflict pipeline: detect → auto-cancel → generate proposals → email notification (preview or single recipient) → dashboard reflects state
- Rescheduling: generate candidate time slots within 3 days and operating hours; avoid student conflicts; AI ranks, deterministic fallback if AI disabled
- Event log for metrics and audit; notifications persisted (outbox)

---

## Data Model (Drizzle)
Tables (Postgres):
1) students
- id (uuid pk)
- name (text)
- email (text)
- phone (text)
- training_level (enum: student|private|instrument)
- created_at (timestamptz default now())

2) bookings
- id (uuid pk)
- student_id (uuid fk → students.id)
- start_time (timestamptz, UTC)
- end_time (timestamptz, UTC)
- dep_lat (numeric)
- dep_lon (numeric)
- arr_lat (numeric)
- arr_lon (numeric)
- status (enum: scheduled|conflict|cancelled|rescheduled|completed)
- tz (text, default 'America/Los_Angeles')
- created_at (timestamptz default now())
- updated_at (timestamptz default now())

Indexes:
- idx_bookings_student_time (student_id, start_time)
- idx_bookings_status_time (status, start_time)

3) weather_checks
- id (uuid pk)
- booking_id (uuid fk)
- location (enum: departure|midpoint|arrival)
- observed_at (timestamptz) — when fetched
- forecast_for (timestamptz) — time evaluated
- payload (jsonb)
- safe (boolean)
- reason (text)

4) reschedule_proposals
- id (uuid pk)
- booking_id (uuid fk)
- start_time (timestamptz)
- end_time (timestamptz)
- rank (int)
- status (enum: proposed|accepted|rejected|expired)
- ai_rationale (text)
- created_at (timestamptz default now())

Unique:
- one proposal per booking/start_time/end_time

5) notifications
- id (uuid pk)
- booking_id (uuid fk)
- to_email (text)
- channel (enum: email|inapp)
- kind (enum: conflict_detected|proposals_ready|proposal_confirmed)
- sent_at (timestamptz)
- provider_id (text) — id from Resend if sent
- payload (jsonb) — rendered html/subject
- status (enum: queued|sent|failed|suppressed)
- meta (jsonb) — throttle keys, dedupe info

6) events
- id (uuid pk)
- type (text) — e.g., conflict_detected, auto_cancelled, proposals_created, email_sent, proposal_accepted
- booking_id (uuid fk nullable)
- details (jsonb)
- created_at (timestamptz default now())

Notes:
- Keep JSON usage simple and not DB-vendor specific (no JSONB operators in app logic)
- Store times in UTC; convert to TZ for display

---

## Environment & Config
Add `.env.local` (dev) and Vercel project envs (prod):
- DATABASE_URL= (Neon connection string)
- CRON_SECRET= (random string; required header `x-cron-secret`)
- WEATHER_PROVIDER=mock
- OPENAI_API_KEY= (optional; if absent, fallback ranking)
- AI_ENABLED=true|false
- EMAIL_MODE=preview|send
- DEMO_EMAIL=you@yourdomain.com (used only when EMAIL_MODE=send)
- RESEND_API_KEY= (only needed when EMAIL_MODE=send)
- APP_BASE_URL=https://your-vercel-url.vercel.app
- DEFAULT_TZ=America/Los_Angeles

Feature flags and safety:
- Email sending is gated behind EMAIL_MODE=send and DEMO_EMAIL present.
- Apply throttling: max 1 email/booking/kind per 3 hours; dedupe by content hash.

---

## Email Strategy
- Default Outbox: render HTML via React Email, persist to `notifications.payload`, show preview in UI.
- Single-recipient Send: if enabled, send via Resend to DEMO_EMAIL only; tag with booking id; store provider id.
- Templates (React Email):
  - ConflictDetected: subject “Weather conflict for your lesson on {date}”
  - ProposalsReady: subject “Choose a new lesson time”
  - ProposalConfirmed: subject “Your lesson is rescheduled”
- Anti-spam:
  - Throttle window: 3h
  - Dedupe key: `${bookingId}:${kind}:${sha1(subject+html)}`

---

## Weather & Safety Logic
Provider interface:
- getForecast(lat, lon, at: Date): Promise<WeatherSnapshot>
- Mock returns: visibility (mi), wind (kt), ceiling (ft), precipType (none/rain/snow/ts), icingRisk (boolean), imc (boolean), gust (kt optional)

Training-level minima (as in PRD):
- Student: clear skies (no IMC/TS), visibility > 5 mi, winds < 10 kt
- Private: visibility > 3 mi, ceiling > 1000 ft, no TS
- Instrument: IMC allowed, but no thunderstorms or icing

Corridor check:
- Evaluate departure, midpoint, arrival at booking start_time.
- Overall safety = all points safe; cancellation if any point unsafe.
- Reason strings capture first failing rule and point.

---

## Conflict Detection Pipeline (Hourly Cron)
Algorithm steps:
1) Authenticate request via `x-cron-secret`.
2) Select candidate bookings to evaluate:
   - status in (scheduled, conflict)
   - start_time within next 48h (configurable) and not in the past
3) For each booking:
   - Compute 3 points (dep, mid, arr)
   - Fetch mock forecast for `start_time`
   - Evaluate safety by training level
   - Persist `weather_checks` rows and an `events` record
   - If unsafe and status != cancelled:
     - Update booking → status=cancelled; record `auto_cancelled` event
     - Generate reschedule proposals (see next section)
     - Queue notifications (conflict_detected + proposals_ready) respecting throttle
4) Return summary JSON (counts) for observability; idempotent behavior avoids duplicate work

Idempotency & dedupe:
- If a booking was evaluated in the last cron with identical safety result, skip re-notifying
- Proposals are regenerated only if none exist or existing are expired/rejected

---

## Rescheduling
Candidate generation:
- Window: next 3 days from now
- Operating hours: 07:00–19:00 local
- Lesson block length: 2h
- Step: 30-minute increments
- Constraints: avoid overlap with the student’s existing bookings (status not in cancelled)

Ranking:
- Deterministic score (fallback): earlier is better; fewer conflicts; avoid late evening; prefer next-day morning
- AI ranking: pass candidate list + context (student level, constraints); return top 3 with rationale; store `ai_rationale`

Proposal lifecycle:
- Create top N (3) rows as `proposed`
- Accept: updates booking to selected time, status=rescheduled; mark others `expired`; email confirmation
- Reject: mark rejected; if all rejected, regenerate once
- Expire: any past proposals auto-expire via next cron pass

---

## API & Server Actions
Routes:
- POST `/api/cron/check-weather` — secured by `x-cron-secret`; runs pipeline; returns summary
- POST `/api/bookings` — create booking (demo form)
- POST `/api/proposals/:id/accept` — accept a proposal
- POST `/api/manual/check` — on-demand trigger (debounced; dev only)
- GET `/api/notifications/outbox` — list previews (for dashboard)

Validation: Zod on all inputs

---

## UI (App Router)
Pages and key components:
- `/` Dashboard: KPIs (bookings, conflicts, reschedules, avg time), active conflicts, quick actions
- `/bookings` Table: list, status badges, “Check now” button
- `/proposals` Table: grouped by booking; action to accept; show rationale
- `/notifications/outbox` Email previews (subject + rendered HTML)
- `/admin/create-booking` Simple form (student select, date/time, route preset KBFI↔KPAE)

UI libs/components: shadcn (button, card, badge, table, dialog, input, select, label, textarea, separator, tooltip); Sonner for toasts

Data fetching: TanStack Query with polling (e.g., 15s) for a simple realtime feel

---

## Testing
Unit (Vitest):
- Safety rules for each training level with fixture payloads (safe/unsafe)
- Corridor aggregation (one point unsafe → overall unsafe)
- Candidate slot generation given existing bookings
- Email throttle/dedupe logic

Integration-lite:
- Conflict pipeline end-to-end with an in-memory/isolated Neon DB

E2E (Playwright, optional for demo):
- Create booking → manual check → see conflict → open proposals → accept → see rescheduled

---

## Seed Data
- Students: at least 3 (student, private, instrument)
- Bookings: ~8 across next 48h, both directions KBFI↔KPAE
- Weather fixtures: mix of safe/marginal/unsafe, deterministic mapping by time window to exercise logic

---

## Deployment
- Neon: create project + database; set DATABASE_URL
- Drizzle: run migrations to Neon
- Vercel: deploy Next.js app; set env vars; set Cron schedule hourly; pass `x-cron-secret`
- Validate with manual trigger; confirm emails stay in Outbox (preview) unless explicitly switched to send

---

## Observability (Lightweight)
- Console and `events` table counts in cron response
- Dashboard surface: last cron run timestamp, evaluated bookings, conflicts detected

---

## Risks & Mitigations
- Email spam in demo: Outbox-by-default + single-recipient gate + throttle/dedupe
- Timezones: Store UTC; display local via TZ from booking; rely on Luxon utilities
- Idempotency: derive stable hashes for proposals and notifications; skip duplicates

---

## Timeline (Target 3–4 days)
Day 1: Schema, seeds, fixtures, safety engine, basic dashboard
Day 2: Conflict pipeline, proposals generation, outbox emails, manual check
Day 3: AI ranking, accept flow, polish UI, metrics
Day 4 (buffer): E2E pass, demo recording, deployment polish

---

## Task Breakdown (Granular)

1) Project Foundations
- Add Drizzle ORM + Neon driver and drizzle-kit
- Add utility libs: zod, luxon, nanoid
- Add TanStack Query
- Add Vercel AI SDK + OpenAI provider
- Add React Email + Resend SDK
- Create `.env.template` and document required vars

2) DB Schema & Migrations
- Define enums and tables in `drizzle/schema.ts`
- Generate migrations with drizzle-kit
- Apply to Neon (dev DB)
- Add minimal `db/client.ts` (singleton)

3) Seed Scripts
- Implement seed script for students, bookings
- Insert weather fixtures lookup (by iso hour/time bucket) for mock provider

4) Weather Provider (Mock) + Safety Rules
- Define `WeatherProvider` interface
- Implement mock provider returning WeatherAPI-like snapshots
- Implement safety evaluation per training level
- Corridor aggregation logic
- Unit tests for rules and provider

5) Conflict Detection Pipeline
- `lib/conflicts.ts` orchestrates detection, writes `weather_checks` and `events`
- Idempotency for repeated cron runs
- Summarize results (counts)

6) Rescheduling Logic
- Availability: derive free slots from bookings + operating hours
- Candidate generation (30-min step, 2h length, 3-day window)
- Deterministic ranking function
- AI ranking function (Vercel AI SDK)
- Persist top 3 proposals and rationale

7) Notifications
- React Email templates (3 kinds)
- Render + store HTML in notifications
- Resend integration with single-recipient gate
- Throttle/dedupe logic and storage in `notifications.meta`

8) API Routes & Server Actions
- `/api/cron/check-weather` (POST, secret)
- `/api/bookings` (create; zod validation)
- `/api/proposals/:id/accept` (accept proposal)
- `/api/manual/check` (dev only, debounced)
- `/api/notifications/outbox` (list previews)

9) UI
- Dashboard with KPIs and recent events
- Bookings table with status and manual check button
- Proposals table with accept action
- Outbox previews page (subject + HTML render)
- Admin create-booking form
- Sonner toasts for actions; load states; errors surfaced

10) Testing & QA
- Vitest unit suites (rules, conflicts, availability, email throttle)
- Optional Playwright happy-path e2e
- Test seed reset script

11) Deployment & Ops
- Provision Neon (dev/prod)
- Configure Vercel project envs
- Migrate DB on deploy
- Add Vercel Cron (hourly) with secret
- Smoke test and record demo

---

## Commands To Install Dependencies (run in order)

Runtime deps:
- npm i drizzle-orm @neondatabase/serverless zod luxon nanoid
- npm i @tanstack/react-query
- npm i ai @ai-sdk/openai
- npm i @react-email/components @react-email/render resend

Dev deps:
- npm i -D drizzle-kit vitest @types/node tsx
- (optional e2e) npm i -D playwright @playwright/test

Note: Next.js 15 + TS are already present.

---

## shadcn Components To Add
Run as needed (examples):
- npx shadcn@latest add button
- npx shadcn@latest add card
- npx shadcn@latest add badge
- npx shadcn@latest add table
- npx shadcn@latest add dialog
- npx shadcn@latest add input
- npx shadcn@latest add select
- npx shadcn@latest add label
- npx shadcn@latest add textarea
- npx shadcn@latest add separator
- npx shadcn@latest add tooltip
- npx shadcn@latest add sonner

---

## Acceptance Criteria (High-Level)
- Hourly cron detects unsafe weather using mock fixtures and training-level minima
- Unsafe bookings auto-cancel; 3 proposals are generated within 3 days
- Emails are persisted to outbox; optional sending to a single recipient is gated and throttled
- Dashboard shows statuses, conflicts, proposals; user can accept a proposal to reschedule
- Events and counts visible; demo flow is smooth and deterministic
