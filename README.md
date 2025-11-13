# Flight Lesson Rescheduler

Monitor corridor weather, automatically cancel unsafe lessons, generate AI-ranked reschedule proposals, and notify students from a single Next.js dashboard.

## Features
- **Dashboard** with live metrics, manual weather trigger, filterable bookings table, and activity timeline.
- **Trend chart** summarising the last 7 days of conflicts vs confirmed reschedules.
- **Proposal hub** that lists open AI suggestions and lets dispatchers accept a slot with one click.
- **Email outbox** showing preview/send mode, provider IDs, and throttling reasons.
- **Event log** for quick auditing of weather checks, cancellations, and notifications.

## Getting Started
1. Install dependencies
   ```bash
   npm install
   ```
2. Copy env template and fill in your values
   ```bash
   cp .env.template .env.local
   # populate DATABASE_URL, CRON_SECRET, EMAIL_MODE, DEMO_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL, etc.
   ```
3. Run migrations and seed mock data
   ```bash
   npm run db:migrate
   npm run seed
   ```
4. Start the dev server
   ```bash
   npm run dev
   ```

## Key Commands
- `npm run db:generate` – regenerate Drizzle migrations from `drizzle/schema.ts`.
- `npm run db:migrate` – apply migrations to the database defined in `.env.local`.
- `npm run seed` – reset and seed mock students, bookings, and weather fixtures.
- `npm run lint` – run ESLint.
- `npm run demo` – run the seed, trigger the weather monitor, and print quick links (`npm run demo -- --open` also opens the dashboard).

## Email Modes
- Set `EMAIL_MODE=preview` to capture messages only in the outbox view.
- Set `EMAIL_MODE=send` with `DEMO_EMAIL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` to deliver via Resend (single-recipient demo mode).

## Manual Weather Trigger
Use the dashboard button or run:
```bash
curl -X POST http://localhost:3000/api/manual/check-weather
```
This scans upcoming bookings, cancels unsafe ones, generates proposals, sends notifications, and refreshes dashboard data.

## Deploying
- Deploy the Next.js app to Vercel (or your host of choice that supports Next.js 15).
- Configure environment variables:
  - `DATABASE_URL` (Neon/Prod Postgres connection string)
  - `CRON_SECRET` (random string used to authenticate cron requests)
  - `WEATHER_PROVIDER` (defaults to `mock`)
  - `DEFAULT_TZ`
  - `AI_ENABLED` / `OPENAI_API_KEY` (optional)
  - `EMAIL_MODE`, `DEMO_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - `APP_BASE_URL` (e.g. `https://your-app.vercel.app`)
- Add a Vercel Cron job hitting `POST https://your-app.vercel.app/api/cron/check-weather`
  - Add header `x-cron-secret: <CRON_SECRET>`
  - Recommended cadence: hourly
- `npm run db:migrate` should run once on the Neon/production database before first deploy.
- Optionally, call `/api/health` for uptime monitoring.
