import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import { evaluateSafety } from "@/lib/safety/rules";
import { getWeatherProvider } from "@/lib/weather";
import type { Coordinates, WeatherPointCheck } from "@/lib/weather/types";
import {
  bookings,
  Booking,
  BookingStatus,
  events,
  students,
  TrainingLevel,
  weatherChecks,
  WeatherLocation,
} from "@/drizzle/schema";

const ACTIVE_STATUSES: BookingStatus[] = ["scheduled", "conflict"];
const DEFAULT_LOOKAHEAD_HOURS = 48;
const MAX_BATCH = 25;

type CandidateBooking = {
  booking: Booking;
  trainingLevel: TrainingLevel;
};

export type PointCheckResult = WeatherPointCheck & {
  safe: boolean;
  rule: string;
  message?: string;
};

export type BookingWeatherAssessment = {
  booking: Booking;
  trainingLevel: TrainingLevel;
  safe: boolean;
  summary: string;
  failingPoint?: PointCheckResult;
  points: PointCheckResult[];
};

export type ConflictMonitorOptions = {
  from?: Date;
  to?: Date;
  limit?: number;
};

function corridorPoints(booking: Booking): Array<{ location: WeatherLocation; coords: Coordinates }> {
  const midpoint = {
    lat: (booking.depLat + booking.arrLat) / 2,
    lon: (booking.depLon + booking.arrLon) / 2,
  } satisfies Coordinates;

  return [
    {
      location: "departure" as const,
      coords: { lat: booking.depLat, lon: booking.depLon },
    },
    { location: "midpoint" as const, coords: midpoint },
    {
      location: "arrival" as const,
      coords: { lat: booking.arrLat, lon: booking.arrLon },
    },
  ];
}

async function fetchCandidateBookings(
  options: ConflictMonitorOptions,
): Promise<CandidateBooking[]> {
  const now = options.from ? DateTime.fromJSDate(options.from) : DateTime.now();
  const lookaheadEnd = options.to
    ? DateTime.fromJSDate(options.to)
    : now.plus({ hours: DEFAULT_LOOKAHEAD_HOURS });

  const rows = await db
    .select({
      booking: bookings,
      trainingLevel: students.trainingLevel,
    })
    .from(bookings)
    .innerJoin(students, (join) => join.on(eq(bookings.studentId, students.id)))
    .where(
      and(
        inArray(bookings.status, ACTIVE_STATUSES),
        gte(bookings.startTime, now.toJSDate()),
        lte(bookings.startTime, lookaheadEnd.toJSDate()),
      ),
    )
    .orderBy(bookings.startTime)
    .limit(options.limit ?? MAX_BATCH);

  return rows.map((row) => ({
    booking: row.booking,
    trainingLevel: row.trainingLevel,
  }));
}

function toPointCheck(
  location: WeatherLocation,
  coords: Coordinates,
  snapshot: WeatherPointCheck["snapshot"],
): WeatherPointCheck {
  return { location, coords, snapshot };
}

async function evaluateBooking(
  candidate: CandidateBooking,
): Promise<BookingWeatherAssessment> {
  const provider = getWeatherProvider();
  const points = corridorPoints(candidate.booking);

  const weatherPoints: WeatherPointCheck[] = await Promise.all(
    points.map(async (point) => {
      const snapshot = await provider.getForecast(point.coords, candidate.booking.startTime);
      return toPointCheck(point.location, point.coords, snapshot);
    }),
  );

  const assessment = evaluateSafety(candidate.trainingLevel, weatherPoints);

  const pointsWithRules: PointCheckResult[] = assessment.points.map((result, index) => ({
    ...weatherPoints[index],
    safe: result.safe,
    rule: result.rule,
    message: result.message,
  }));

  const failingPoint = assessment.failingPoint
    ? pointsWithRules.find((point) => point.location === assessment.failingPoint?.location && !point.safe)
    : undefined;

  return {
    booking: candidate.booking,
    trainingLevel: candidate.trainingLevel,
    safe: assessment.safe,
    summary: assessment.summary,
    failingPoint,
    points: pointsWithRules,
  };
}

async function recordWeatherChecks(result: BookingWeatherAssessment) {
  const payloads = result.points.map((point) => ({
    bookingId: result.booking.id,
    location: point.location,
    observedAt: point.snapshot.observedAt,
    forecastFor: point.snapshot.forecastFor,
    payload: {
      ...point.snapshot,
      observedAt: point.snapshot.observedAt.toISOString(),
      forecastFor: point.snapshot.forecastFor.toISOString(),
    },
    safe: point.safe,
    reason: point.message,
  }));

  await db.insert(weatherChecks).values(payloads);
}

async function recordEvent(result: BookingWeatherAssessment) {
  const eventType = result.safe ? "weather_check_passed" : "weather_conflict_detected";
  await db.insert(events).values({
    type: eventType,
    bookingId: result.booking.id,
    details: {
      summary: result.summary,
      failingPoint: result.failingPoint
        ? {
            location: result.failingPoint.location,
            rule: result.failingPoint.rule,
            message: result.failingPoint.message,
          }
        : null,
    },
  });
}

export async function runWeatherMonitor(
  options: ConflictMonitorOptions = {},
): Promise<{ processed: BookingWeatherAssessment[] }> {
  const candidates = await fetchCandidateBookings(options);

  const results: BookingWeatherAssessment[] = [];

  for (const candidate of candidates) {
    const assessment = await evaluateBooking(candidate);
    results.push(assessment);
    await recordWeatherChecks(assessment);
    await recordEvent(assessment);
  }

  return { processed: results };
}
