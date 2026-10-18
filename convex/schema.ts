import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const phaseValidator = v.union(
  v.literal("setup"),
  v.literal("team_reveal"),
  v.literal("hackathon"),
  v.literal("voting"),
  v.literal("results_pending"),
  v.literal("results"),
);

export const levelValidator = v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"));

const prayerTime = v.object({ start: v.string(), jamaah: v.union(v.string(), v.null()) });
export const prayersValidator = v.object({
  fajr: prayerTime,
  dhuhr: prayerTime,
  asr: prayerTime,
  maghrib: prayerTime,
  isha: prayerTime,
});

export const prayerValidator = v.union(
  v.literal("fajr"),
  v.literal("dhuhr"),
  v.literal("asr"),
  v.literal("maghrib"),
  v.literal("isha"),
);

/** The hacking clock (see shared/hacking.ts): counts hacking time, paused by prayer breaks. */
export const clockValidator = v.object({
  doneMs: v.number(),
  runningSince: v.union(v.number(), v.null()),
  pausedReason: v.union(v.literal("manual"), v.literal("prayer"), v.null()),
  prayer: v.union(v.object({ prayer: prayerValidator, endsAt: v.number() }), v.null()),
  prayersTaken: v.array(v.object({ prayer: prayerValidator, atMs: v.number() })),
});

// Legacy (v1.1 Pomodoro loop). Optional so existing event rows still validate; cleared on reset.
const legacyTimerValidator = v.object({
  mode: v.union(v.literal("focus"), v.literal("break")),
  cycle: v.number(),
  remainingMs: v.number(),
  endsAt: v.union(v.number(), v.null()),
  pausedReason: v.union(v.literal("manual"), v.literal("salah"), v.null()),
});

export default defineSchema({
  // Single row: the whole event's shared state.
  event: defineTable({
    phase: phaseValidator,
    expectedParticipants: v.number(),
    focusMinutes: v.number(),
    breakMinutes: v.number(),
    revealMinutes: v.number(),
    // Optional so rows created before the hacking clock still validate; defaults in convex/model.ts.
    hackingMinutes: v.optional(v.number()),
    prayerBreakMinutes: v.optional(v.number()),
    eventDate: v.string(),
    timeZone: v.string(),
    prayers: prayersValidator,
    prayerSource: v.string(),
    revealEndsAt: v.union(v.number(), v.null()),
    revealHeldMs: v.union(v.number(), v.null()),
    clock: v.optional(clockValidator),
    timer: v.optional(legacyTimerValidator),
    sessionEndTime: v.optional(v.union(v.string(), v.null())),
  }),
  participants: defineTable({
    firstName: v.string(),
    normalisedName: v.string(),
    experience: levelValidator,
    deviceId: v.union(v.string(), v.null()),
    teamId: v.union(v.id("teams"), v.null()),
    hasVoted: v.boolean(),
    isTest: v.boolean(),
    // One-time rejoin link issued by an organiser (lost phone, private tab). Never public.
    rejoinCode: v.optional(v.string()),
    rejoinExpiresAt: v.optional(v.number()),
  })
    .index("by_name", ["normalisedName"])
    .index("by_device", ["deviceId"]),
  // `votes` is an aggregate counter only. No ballot (voter -> team) record exists anywhere.
  teams: defineTable({
    key: v.string(),
    name: v.string(),
    order: v.number(),
    memberIds: v.array(v.id("participants")),
    captainId: v.id("participants"),
    votes: v.number(),
  }),
});
