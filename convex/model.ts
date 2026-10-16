import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  DEFAULT_EVENT_DATE,
  DEFAULT_PRAYERS,
  DEFAULT_PRAYER_SOURCE,
  DEFAULT_TIME_ZONE,
} from "../shared/salah";
import { initialTimer, type Durations } from "../shared/timer";

export type EventDoc = Doc<"event">;
export type Phase = EventDoc["phase"];

export const DEFAULT_SETTINGS = {
  expectedParticipants: 9,
  focusMinutes: 25,
  breakMinutes: 5,
  revealMinutes: 3,
  sessionEndTime: null,
  eventDate: DEFAULT_EVENT_DATE,
  timeZone: DEFAULT_TIME_ZONE,
  prayers: DEFAULT_PRAYERS,
  prayerSource: DEFAULT_PRAYER_SOURCE,
} satisfies Partial<EventDoc>;

export function durations(e: Pick<EventDoc, "focusMinutes" | "breakMinutes">): Durations {
  return { focusMs: e.focusMinutes * 60_000, breakMs: e.breakMinutes * 60_000 };
}

export function freshEventFields(settings: typeof DEFAULT_SETTINGS | EventDoc) {
  return {
    phase: "setup" as const,
    revealEndsAt: null,
    revealHeldMs: null,
    timer: initialTimer(durations(settings)),
  };
}

export function defaultEvent(): Omit<EventDoc, "_id" | "_creationTime"> {
  return { ...DEFAULT_SETTINGS, ...freshEventFields(DEFAULT_SETTINGS) };
}

export async function readEvent(ctx: QueryCtx): Promise<EventDoc | null> {
  return await ctx.db.query("event").first();
}

export async function loadEvent(ctx: MutationCtx): Promise<EventDoc> {
  const existing = await ctx.db.query("event").first();
  if (existing) return existing;
  const id = await ctx.db.insert("event", defaultEvent());
  return (await ctx.db.get(id))!;
}

export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function requirePhase(event: EventDoc, ...phases: Phase[]) {
  if (!phases.includes(event.phase)) {
    fail("wrong_phase", `That isn't available right now (current stage: ${event.phase.replace("_", " ")}).`);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminToken(token: string): boolean {
  const expected = process.env.ADMIN_TOKEN;
  return Boolean(expected) && timingSafeEqual(token.trim().toLowerCase(), expected!.trim().toLowerCase());
}

export function requireAdmin(token: string) {
  if (!process.env.ADMIN_TOKEN) fail("not_configured", "ADMIN_TOKEN is not set on the Convex deployment.");
  if (!isAdminToken(token)) fail("forbidden", "Organiser code not recognised.");
}
