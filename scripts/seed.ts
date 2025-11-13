import "dotenv/config";

import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import {
  bookings,
  events,
  notifications,
  rescheduleProposals,
  students,
  weatherChecks,
} from "@/drizzle/schema";
import type {
  Booking,
  NewBooking,
  NewStudent,
} from "@/drizzle/schema";

const DEFAULT_TZ = process.env.DEFAULT_TZ || "America/Los_Angeles";

const LOCATIONS = {
  KBFI: { lat: 47.53, lon: -122.30 },
  KPAE: { lat: 47.90, lon: -122.28 },
};

type StudentSeed = NewStudent & { key: string };

async function seedStudents(): Promise<Record<string, Booking["studentId"]>> {
  await db.delete(weatherChecks);
  await db.delete(rescheduleProposals);
  await db.delete(notifications);
  await db.delete(events);
  await db.delete(bookings);
  await db.delete(students);

  const data: StudentSeed[] = [
    {
      key: "student",
      name: "Alex Martinez",
      email: "student@example.com",
      phone: "206-555-0101",
      trainingLevel: "student",
    },
    {
      key: "private",
      name: "Jamie Chen",
      email: "private@example.com",
      phone: "206-555-0102",
      trainingLevel: "private",
    },
    {
      key: "instrument",
      name: "Taylor Singh",
      email: "instrument@example.com",
      phone: "206-555-0103",
      trainingLevel: "instrument",
    },
  ];

  const inserted = await db
    .insert(students)
    .values(data.map(({ key, ...rest }) => rest))
    .returning({ id: students.id, name: students.name });

  return inserted.reduce<Record<string, Booking["studentId"]>>((acc, studentRow, index) => {
    acc[data[index].key] = studentRow.id;
    return acc;
  }, {});
}

function buildBookings(studentIds: Record<string, string>): NewBooking[] {
  const startOfTomorrow = DateTime.now()
    .setZone(DEFAULT_TZ)
    .startOf("day")
    .plus({ days: 1, hours: 8 });

  const blocks = [
    { studentKey: "student", dayOffset: 0, hourOffset: 0, route: "south" },
    { studentKey: "student", dayOffset: 0, hourOffset: 4, route: "north" },
    { studentKey: "private", dayOffset: 0, hourOffset: 2, route: "south" },
    { studentKey: "private", dayOffset: 1, hourOffset: -1, route: "north" },
    { studentKey: "instrument", dayOffset: 1, hourOffset: 1, route: "south" },
    { studentKey: "instrument", dayOffset: 1, hourOffset: 5, route: "north" },
    { studentKey: "student", dayOffset: 2, hourOffset: -2, route: "south" },
    { studentKey: "private", dayOffset: 2, hourOffset: 1, route: "north" },
  ] as const;

  return blocks.map((block) => {
    const start = startOfTomorrow
      .plus({ days: block.dayOffset, hours: block.hourOffset })
      .startOf("hour");

    const end = start.plus({ hours: 2 });

    const isSouthbound = block.route === "south";
    const dep = isSouthbound ? LOCATIONS.KPAE : LOCATIONS.KBFI;
    const arr = isSouthbound ? LOCATIONS.KBFI : LOCATIONS.KPAE;

    return {
      studentId: studentIds[block.studentKey],
      startTime: start.toJSDate(),
      endTime: end.toJSDate(),
      depLat: dep.lat,
      depLon: dep.lon,
      arrLat: arr.lat,
      arrLon: arr.lon,
      status: "scheduled",
      tz: DEFAULT_TZ,
    } satisfies NewBooking;
  });
}

async function seedBookings(studentIds: Record<string, string>) {
  const bookingData = buildBookings(studentIds);
  await db.insert(bookings).values(bookingData);
}

async function main() {
  try {
    const studentIds = await seedStudents();
    await seedBookings(studentIds);
    console.log("Seed completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed", error);
    process.exit(1);
  }
}

void main();
