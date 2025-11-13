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
  KBFI: { lat: 47.53, lon: -122.3 },
  KPAE: { lat: 47.9, lon: -122.28 },
  KTIW: { lat: 47.27, lon: -122.58 },
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
    {
      key: "advanced",
      name: "Morgan Lee",
      email: "advanced@example.com",
      phone: "206-555-0104",
      trainingLevel: "instrument",
    },
    {
      key: "rusty",
      name: "Chris O'Neil",
      email: "rusty@example.com",
      phone: "206-555-0105",
      trainingLevel: "private",
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
  const startOfDay = DateTime.now().setZone(DEFAULT_TZ).startOf("day");

  const templates = [
    { studentKey: "student", dayOffset: 0, startHour: 8, status: "scheduled" as const, route: ["KPAE", "KBFI"] as const },
    { studentKey: "student", dayOffset: 0, startHour: 13, status: "scheduled", route: ["KBFI", "KPAE"] as const },
    { studentKey: "private", dayOffset: 0, startHour: 11, status: "scheduled", route: ["KPAE", "KBFI"] as const },
    { studentKey: "instrument", dayOffset: 0, startHour: 15, status: "scheduled", route: ["KBFI", "KTIW"] as const },
    { studentKey: "rusty", dayOffset: 1, startHour: 9, status: "scheduled", route: ["KTIW", "KBFI"] as const },
    { studentKey: "advanced", dayOffset: 1, startHour: 12, status: "conflict" as const, route: ["KBFI", "KPAE"] as const },
    { studentKey: "student", dayOffset: 1, startHour: 16, status: "scheduled", route: ["KPAE", "KBFI"] as const },
    { studentKey: "instrument", dayOffset: 2, startHour: 10, status: "scheduled", route: ["KBFI", "KTIW"] as const },
    { studentKey: "private", dayOffset: 2, startHour: 14, status: "scheduled", route: ["KPAE", "KBFI"] as const },
    { studentKey: "advanced", dayOffset: -1, startHour: 7, status: "rescheduled" as const, route: ["KBFI", "KPAE"] as const },
    { studentKey: "rusty", dayOffset: -1, startHour: 12, status: "cancelled" as const, route: ["KPAE", "KBFI"] as const },
  ] as const;

  return templates.map((template) => {
    const start = startOfDay.plus({ days: template.dayOffset, hours: template.startHour });
    const end = start.plus({ hours: 2 });

    const [depKey, arrKey] = template.route;
    const dep = LOCATIONS[depKey as keyof typeof LOCATIONS];
    const arr = LOCATIONS[arrKey as keyof typeof LOCATIONS];

    return {
      studentId: studentIds[template.studentKey],
      startTime: start.toJSDate(),
      endTime: end.toJSDate(),
      depLat: dep.lat,
      depLon: dep.lon,
      arrLat: arr.lat,
      arrLon: arr.lon,
      status: template.status,
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
    console.table(
      Object.entries(studentIds).map(([key, id]) => ({ key, id })).slice(0, 4),
    );
    console.log("Seed completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed", error);
    process.exit(1);
  }
}

void main();
