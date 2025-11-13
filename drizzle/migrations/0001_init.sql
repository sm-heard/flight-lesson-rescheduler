CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "training_level" AS ENUM ('student', 'private', 'instrument');
CREATE TYPE "booking_status" AS ENUM ('scheduled', 'conflict', 'cancelled', 'rescheduled', 'completed');
CREATE TYPE "weather_location" AS ENUM ('departure', 'midpoint', 'arrival');
CREATE TYPE "proposal_status" AS ENUM ('proposed', 'accepted', 'rejected', 'expired');
CREATE TYPE "notification_channel" AS ENUM ('email', 'inapp');
CREATE TYPE "notification_kind" AS ENUM ('conflict_detected', 'proposals_ready', 'proposal_confirmed');
CREATE TYPE "notification_status" AS ENUM ('queued', 'sent', 'failed', 'suppressed');

CREATE TABLE IF NOT EXISTS "students" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "email" text NOT NULL,
    "phone" text,
    "training_level" "training_level" NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bookings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE cascade,
    "start_time" timestamptz NOT NULL,
    "end_time" timestamptz NOT NULL,
    "dep_lat" double precision NOT NULL,
    "dep_lon" double precision NOT NULL,
    "arr_lat" double precision NOT NULL,
    "arr_lon" double precision NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'scheduled',
    "tz" text NOT NULL DEFAULT 'America/Los_Angeles',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bookings_student_time" ON "bookings" ("student_id", "start_time");
CREATE INDEX IF NOT EXISTS "idx_bookings_status_time" ON "bookings" ("status", "start_time");

CREATE TABLE IF NOT EXISTS "weather_checks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE cascade,
    "location" "weather_location" NOT NULL,
    "observed_at" timestamptz NOT NULL,
    "forecast_for" timestamptz NOT NULL,
    "payload" jsonb NOT NULL,
    "safe" boolean NOT NULL,
    "reason" text
);

CREATE TABLE IF NOT EXISTS "reschedule_proposals" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE cascade,
    "start_time" timestamptz NOT NULL,
    "end_time" timestamptz NOT NULL,
    "rank" integer NOT NULL,
    "status" "proposal_status" NOT NULL DEFAULT 'proposed',
    "ai_rationale" text,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_reschedule_slot" ON "reschedule_proposals" ("booking_id", "start_time", "end_time");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE cascade,
    "to_email" text NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "kind" "notification_kind" NOT NULL,
    "sent_at" timestamptz,
    "provider_id" text,
    "payload" jsonb NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'queued',
    "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" text NOT NULL,
    "booking_id" uuid REFERENCES "bookings"("id") ON DELETE set null,
    "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now()
);
