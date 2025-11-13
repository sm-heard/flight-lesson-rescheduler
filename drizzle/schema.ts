import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const trainingLevelEnum = pgEnum("training_level", [
  "student",
  "private",
  "instrument",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "scheduled",
  "conflict",
  "cancelled",
  "rescheduled",
  "completed",
]);

export const weatherLocationEnum = pgEnum("weather_location", [
  "departure",
  "midpoint",
  "arrival",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "proposed",
  "accepted",
  "rejected",
  "expired",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "inapp",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "conflict_detected",
  "proposals_ready",
  "proposal_confirmed",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "suppressed",
]);

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  trainingLevel: trainingLevelEnum("training_level").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endTime: timestamp("end_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    depLat: doublePrecision("dep_lat").notNull(),
    depLon: doublePrecision("dep_lon").notNull(),
    arrLat: doublePrecision("arr_lat").notNull(),
    arrLon: doublePrecision("arr_lon").notNull(),
    status: bookingStatusEnum("status").default("scheduled").notNull(),
    tz: text("tz").default("America/Los_Angeles").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    studentTimeIdx: index("idx_bookings_student_time").on(
      table.studentId,
      table.startTime,
    ),
    statusTimeIdx: index("idx_bookings_status_time").on(
      table.status,
      table.startTime,
    ),
  }),
);

export const weatherChecks = pgTable("weather_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  location: weatherLocationEnum("location").notNull(),
  observedAt: timestamp("observed_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  forecastFor: timestamp("forecast_for", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  payload: jsonb("payload", { $type: Record<string, unknown> }).notNull(),
  safe: boolean("safe").notNull(),
  reason: text("reason"),
});

export const rescheduleProposals = pgTable(
  "reschedule_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endTime: timestamp("end_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    rank: integer("rank").notNull(),
    status: proposalStatusEnum("status").default("proposed").notNull(),
    aiRationale: text("ai_rationale"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slotUnique: uniqueIndex("uq_reschedule_slot").on(
      table.bookingId,
      table.startTime,
      table.endTime,
    ),
  }),
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  toEmail: text("to_email").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  kind: notificationKindEnum("kind").notNull(),
  sentAt: timestamp("sent_at", {
    withTimezone: true,
    mode: "date",
  }),
  providerId: text("provider_id"),
  payload: jsonb("payload", { $type: Record<string, unknown> }).notNull(),
  status: notificationStatusEnum("status").default("queued").notNull(),
  meta: jsonb("meta", { $type: Record<string, unknown> }).default({}).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id, {
    onDelete: "set null",
  }),
  details: jsonb("details", { $type: Record<string, unknown> }).default({}).notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
});

export const studentsRelations = relations(students, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  student: one(students, {
    fields: [bookings.studentId],
    references: [students.id],
  }),
  weatherChecks: many(weatherChecks),
  proposals: many(rescheduleProposals),
  notifications: many(notifications),
  events: many(events),
}));

export const notificationsRelations = relations(
  notifications,
  ({ one }) => ({
    booking: one(bookings, {
      fields: [notifications.bookingId],
      references: [bookings.id],
    }),
  }),
);

export const eventsRelations = relations(events, ({ one }) => ({
  booking: one(bookings, {
    fields: [events.bookingId],
    references: [bookings.id],
  }),
}));

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type WeatherCheck = typeof weatherChecks.$inferSelect;
export type NewWeatherCheck = typeof weatherChecks.$inferInsert;

export type RescheduleProposal = typeof rescheduleProposals.$inferSelect;
export type NewRescheduleProposal = typeof rescheduleProposals.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type TrainingLevel = (typeof trainingLevelEnum.enumValues)[number];
export type WeatherLocation = (typeof weatherLocationEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type ProposalStatus = (typeof proposalStatusEnum.enumValues)[number];
export type NotificationKind = (typeof notificationKindEnum.enumValues)[number];
