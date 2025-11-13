# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Flight Lesson Rescheduler** - an AI-powered system that automatically monitors weather conditions for scheduled flight lessons and intelligently generates rescheduling proposals when weather conflicts are detected. Built with Next.js 15, TypeScript, and deployed with Turbopack.

The system:
- Monitors weather at departure, midpoint, and arrival locations for upcoming flights
- Evaluates safety based on student training level (student/private/instrument)
- Auto-cancels unsafe flights and generates AI-ranked reschedule proposals
- Sends notifications via email (Resend) with proposal options
- Tracks all events, weather checks, and booking state changes

## Commands

### Development
```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint
```

### Database (Drizzle ORM + PostgreSQL)
```bash
npm run db:generate  # Generate migration files from schema changes
npm run db:migrate   # Apply pending migrations to database
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run seed         # Populate database with seed data
```

### Manual Operations
```bash
# Trigger weather check manually (development only, or with CRON_SECRET in production)
curl -X POST http://localhost:3000/api/manual/check-weather \
  -H "x-cron-secret: your-secret"

# In production, the cron endpoint at /api/cron/check-weather is called automatically
```

### Testing
```bash
# Run tests (if configured)
npx vitest
```

## Architecture

### Core Domain Flow

**Weather Monitoring Pipeline** (lib/conflicts.ts):
1. `fetchCandidateBookings()` - Queries bookings in next 48 hours with status "scheduled" or "conflict"
2. `evaluateBooking()` - Fetches weather forecasts for departure/midpoint/arrival points
3. `evaluateSafety()` (lib/safety/rules.ts) - Applies training-level-specific safety rules
4. `recordWeatherChecks()` + `recordWeatherEvent()` - Logs results to database
5. If unsafe → `handleUnsafeAssessment()`:
   - Generates reschedule proposals (deterministic + AI-ranked)
   - Auto-cancels the booking
   - Dispatches notifications (conflict detected + proposals ready)

**Rescheduling Proposal Generation** (lib/scheduling/proposals.ts):
1. `computeAvailableSlots()` - Generates time slots that don't conflict with existing bookings
2. Deterministic scoring - Prioritizes morning slots, same-day reschedules, proximity to original time
3. AI ranking (optional) - `rankSlotsWithAI()` uses OpenAI to select top 3 with rationales
4. Falls back to deterministic if AI fails

### Database Schema (drizzle/schema.ts)

Key tables and their relationships:

- **students** - Student profiles with training level (student/private/instrument)
- **bookings** - Flight lessons with start/end times, departure/arrival coordinates, status, timezone
  - Indexes: `idx_bookings_student_time`, `idx_bookings_status_time`
- **weather_checks** - Weather snapshots for each booking at departure/midpoint/arrival
- **reschedule_proposals** - AI-generated reschedule options with rank and rationale
  - Unique constraint on (bookingId, startTime, endTime)
- **notifications** - Email notification log with status tracking and deduplication
- **events** - Audit log of all booking lifecycle events

Status flows:
- Booking: scheduled → conflict → cancelled (or rescheduled/completed)
- Proposal: proposed → accepted/rejected/expired
- Notification: queued → sent/failed/suppressed

### Safety Rules (lib/safety/rules.ts)

Weather evaluation logic based on training level:

**Common hazards (all levels)**:
- Thunderstorms → unsafe
- Icing risk → unsafe

**Student pilots**:
- Must have VFR conditions (no IMC)
- Visibility > 5 SM
- Wind speed < 10 kt

**Private pilots**:
- Visibility > 3 SM
- Ceiling > 1000 ft

**Instrument-rated pilots**:
- Can fly in IMC
- Still blocked by thunderstorms and icing

### Weather Provider System (lib/weather/)

Currently uses a **mock weather provider** that generates realistic but deterministic weather data for testing. The architecture supports pluggable weather providers via:

```typescript
interface WeatherProvider {
  getForecast(coords: Coordinates, forecastFor: Date): Promise<WeatherSnapshot>;
}
```

To add a real weather API (e.g., OpenWeatherMap):
1. Create new provider in `lib/weather/` implementing the interface
2. Update `lib/weather/index.ts` to instantiate based on `WEATHER_PROVIDER` env var

### Notification System (lib/notifications/)

**Email rendering**: Uses `@react-email/components` for templated emails
**Delivery**: Resend API integration (configurable via EMAIL_MODE)
- `preview` mode (default): Records notification but doesn't send
- `send` mode: Requires `RESEND_API_KEY` and `DEMO_EMAIL`
- Throttling: Won't send duplicate emails (same content hash) within 3 hours

Templates located at: `lib/notifications/templates/` (inferred from imports)

### API Routes

- `POST /api/manual/check-weather` - Manually trigger weather monitor (dev or with CRON_SECRET)
- `POST /api/cron/check-weather` - Production cron endpoint for automated checks
- `GET /api/debug-env` - Debug endpoint (if exists)

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (Neon serverless)

Optional:
- `WEATHER_PROVIDER` - Weather provider to use (default: "mock")
- `OPENAI_API_KEY` - For AI-powered proposal ranking
- `EMAIL_MODE` - "preview" (default) or "send"
- `RESEND_API_KEY` - Required if EMAIL_MODE=send
- `DEMO_EMAIL` - Email address to receive all notifications in demo mode
- `RESEND_FROM_EMAIL` - From address for emails
- `APP_BASE_URL` - Base URL for email links (default: http://localhost:3000)
- `CRON_SECRET` - Secret for authenticating cron/manual endpoints in production
- `NODE_ENV` - "development" or "production"

## Key Patterns & Conventions

### Type Safety
- Drizzle schema exports types: `Student`, `Booking`, `NewBooking`, etc.
- Use `typeof table.$inferSelect` for read types, `$inferInsert` for write types
- Enum values from schema: `trainingLevelEnum.enumValues[number]`

### Date Handling
- **Always use Luxon** for date manipulation (not native Date)
- Store timezone info with bookings (`tz` field, default: "America/Los_Angeles")
- Database stores timestamps with timezone
- Convert to user's timezone for display using `DateTime.fromJSDate(date).setZone(tz)`

### Coordinates & Weather Points
- Bookings store: `depLat`, `depLon`, `arrLat`, `arrLon` (double precision)
- Weather checked at 3 points: departure, midpoint (calculated), arrival
- Midpoint: `(depLat + arrLat) / 2, (depLon + arrLon) / 2`

### Scheduling Configuration (lib/scheduling/config.ts)
- Lesson duration: Configurable (likely 90-120 min)
- Operating hours: Configurable start/end hours
- Lookahead window: Default 48 hours for weather monitoring
- Slot step: Interval between candidate slots (likely 30 min)

### Event Sourcing Pattern
All significant actions are logged to the `events` table:
- `weather_check_passed` / `weather_conflict_detected`
- `auto_cancelled`
- `proposals_created`
- `notification_conflict` / `notification_proposals`

This enables auditing and debugging of the full booking lifecycle.

## Working with the Codebase

### Adding a New Training Level
1. Update `trainingLevelEnum` in `drizzle/schema.ts`
2. Add safety evaluation logic in `lib/safety/rules.ts`
3. Run `npm run db:generate` and `npm run db:migrate`

### Adding a Real Weather Provider
1. Create `lib/weather/openweather.ts` (or similar)
2. Implement `WeatherProvider` interface
3. Update `getWeatherProvider()` in `lib/weather/index.ts`
4. Set `WEATHER_PROVIDER=openweather` in `.env`

### Modifying Notification Templates
1. Templates are rendered via `@react-email/render`
2. Find template rendering logic in `lib/notifications/templates/` (inferred)
3. Test locally by setting `EMAIL_MODE=preview` and checking database

### Extending the Scheduling Algorithm
- Deterministic scoring: Modify `scoreSlot()` in `lib/scheduling/proposals.ts`
- AI prompt: Update prompt in `lib/ai/reschedule.ts`
- Slot generation: Modify `computeAvailableSlots()` in `lib/scheduling/availability.ts`

## Database Migrations

When modifying schema:
1. Edit `drizzle/schema.ts`
2. Run `npm run db:generate` - creates migration SQL in `drizzle/migrations/`
3. Review generated SQL
4. Run `npm run db:migrate` - applies to database
5. Commit both schema changes and migration files

## Important Notes

- The UI (app/page.tsx) is currently the default Next.js placeholder - dashboard is likely under development
- UI components use shadcn/ui (Radix UI primitives) in `components/ui/`
- Weather monitoring runs on a schedule via cron in production
- All booking times are timezone-aware - never assume UTC
- The system is designed to be conservative: if weather data is unavailable, err on the side of safety
