# Repository Guidelines

## Project Structure & Module Organization
- `app/` — Next.js App Router routes, API handlers (e.g. `api/cron/check-weather`).
- `lib/` — Core logic grouped by domain (`weather/`, `scheduling/`, `notifications/`, `actions/`).
- `emails/` — React Email templates rendered for the notification outbox.
- `drizzle/` — Drizzle ORM schema and migrations; `migrations/meta/` tracks applied revisions.
- `scripts/` — Operational scripts such as `seed.ts` for loading mock data.
- `public/` — Static assets delivered as-is.

## Build, Test, and Development Commands
- `npm run dev` — Start the Next.js dev server with Turbopack.
- `npm run build` / `npm run start` — Produce and serve an optimized production build.
- `npm run lint` — Run ESLint with the project’s Next.js config.
- `npm run db:generate` — Regenerate Drizzle SQL migrations from the schema.
- `npm run db:migrate` — Apply migrations to the database defined by `DATABASE_URL`.
- `npm run seed` — Reset and seed mock data (students, bookings, fixtures).
- `npm run db:studio` — Launch Drizzle Studio for inspecting Postgres tables.

## Coding Style & Naming Conventions
- TypeScript and React throughout; prefer functional components and `async/await`.
- Keep files in `lib/` small and domain-focused; export plain functions over classes.
- Use camelCase for functions/variables, PascalCase for components/types, kebab-case for filenames.
- Follow ESLint and prettier defaults enforced via the lint script; 2-space indentation.
- Co-locate shared types near the domain (e.g. `lib/weather/types.ts`).

## Testing Guidelines
- Primary framework: Vitest (configured via package.json dev dependencies).
- Place unit tests beside the code under test using `*.test.ts` naming.
- Target coverage on weather safety logic, scheduling availability, and notification throttling.
- Run tests with `npx vitest run` (add watch mode `npx vitest` during development).

## Commit & Pull Request Guidelines
- Keep commits focused; use present-tense summaries (e.g. `Add weather monitor cron endpoint`).
- Reference issue IDs when applicable (`Fix #123` in either body or title).
- PR checklist: describe behaviour change, include test strategy/results, attach screenshots for UI or sample notification payloads.
- Request review for cross-cutting changes (DB schema, cron logic) and ping @maintainers when touching production env files.

## Security & Configuration Tips
- Never commit secrets; use `.env.template` as the canonical reference and `.env.local` for runtime values.
- Rotate `CRON_SECRET` and `RESEND_API_KEY` before production deploys.
- For local email testing switch `EMAIL_MODE` to `preview`; set `DEMO_EMAIL` only when `EMAIL_MODE=send`.
