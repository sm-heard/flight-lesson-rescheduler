import { DateTime, Interval } from "luxon";

import type { Booking } from "@/drizzle/schema";
import {
  LESSON_DURATION_MINUTES,
  LOOKAHEAD_DAYS,
  OPERATING_HOURS,
  SLOT_STEP_MINUTES,
} from "@/lib/scheduling/config";

export type AvailabilityOptions = {
  tz: string;
  from: Date;
  lookaheadDays?: number;
  lessonDurationMinutes?: number;
  slotStepMinutes?: number;
};

export type AvailableSlot = {
  start: Date;
  end: Date;
};

function toInterval(start: DateTime, minutes: number) {
  return Interval.fromDateTimes(start, start.plus({ minutes }));
}

function intersects(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function lessonIntervalsFromBookings(bookings: Booking[], tz: string): Interval[] {
  return bookings.map((booking) =>
    Interval.fromDateTimes(
      DateTime.fromJSDate(booking.startTime).setZone(tz),
      DateTime.fromJSDate(booking.endTime).setZone(tz),
    ),
  );
}

export function computeAvailableSlots(
  existingBookings: Booking[],
  options: AvailabilityOptions,
): AvailableSlot[] {
  const {
    tz,
    from,
    lookaheadDays = LOOKAHEAD_DAYS,
    lessonDurationMinutes = LESSON_DURATION_MINUTES,
    slotStepMinutes = SLOT_STEP_MINUTES,
  } = options;

  const fromDt = DateTime.fromJSDate(from).setZone(tz);
  const busyIntervals = lessonIntervalsFromBookings(existingBookings, tz);

  const slots: AvailableSlot[] = [];

  for (let dayOffset = 0; dayOffset <= lookaheadDays; dayOffset += 1) {
    const dayStart = fromDt.plus({ days: dayOffset }).startOf("day");
    const operatingStart = dayStart.set({ hour: OPERATING_HOURS.startHour, minute: 0 });
    const operatingEnd = dayStart.set({ hour: OPERATING_HOURS.endHour, minute: 0 });

    for (
      let cursor = operatingStart;
      cursor < operatingEnd;
      cursor = cursor.plus({ minutes: slotStepMinutes })
    ) {
      const slot = toInterval(cursor, lessonDurationMinutes);

      if (slot.end > operatingEnd) {
        break;
      }

      if (slot.start < fromDt) {
        continue;
      }

      const overlaps = busyIntervals.some((busy) => intersects(slot, busy));
      if (overlaps) {
        continue;
      }

      slots.push({ start: slot.start.toJSDate(), end: slot.end.toJSDate() });
    }
  }

  return slots;
}
