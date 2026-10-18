import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { levelValidator } from "./schema";
import { fail, loadEvent, requireAdmin, requirePhase } from "./model";
import { normaliseName, tidyName, validateFirstName } from "../shared/names";
import { MAX_PARTICIPANTS } from "../shared/fairness";
import { pickIndex } from "../shared/rng";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function assertNameFree(ctx: MutationCtx, normalisedName: string, except: Id<"participants"> | null) {
  const clash = await ctx.db
    .query("participants")
    .withIndex("by_name", (q) => q.eq("normalisedName", normalisedName))
    .first();
  if (clash && clash._id !== except) {
    fail(
      "name_taken",
      "Someone has already checked in with that name. Add a nickname or initial (e.g. “Ali K”) so votes stay unambiguous.",
    );
  }
}

/** Check-in from a phone. Re-submitting from the same device updates rather than duplicates. */
export const register = mutation({
  args: { deviceId: v.string(), firstName: v.string(), experience: levelValidator },
  handler: async (ctx, { deviceId, firstName, experience }) => {
    const event = await loadEvent(ctx);
    if (event.phase !== "setup") fail("closed", "Check-in has closed. Please speak to an organiser.");
    if (deviceId.length < 8 || deviceId.length > 64) fail("bad_device", "Please refresh the page and try again.");

    const nameError = validateFirstName(firstName);
    if (nameError) fail("bad_name", nameError);
    const name = tidyName(firstName);
    const normalisedName = normaliseName(name);

    const existing = await ctx.db
      .query("participants")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
    await assertNameFree(ctx, normalisedName, existing?._id ?? null);

    if (existing) {
      await ctx.db.patch(existing._id, { firstName: name, normalisedName, experience });
      return { id: existing._id, updated: true };
    }
    const count = (await ctx.db.query("participants").collect()).length;
    if (count >= MAX_PARTICIPANTS) fail("full", "Check-in is full. Please speak to an organiser.");
    const id = await ctx.db.insert("participants", {
      firstName: name,
      normalisedName,
      experience,
      deviceId,
      teamId: null,
      hasVoted: false,
      isTest: false,
    });
    return { id, updated: false };
  },
});

const REJOIN_TTL_MS = 15 * 60_000;

/** Organiser: a one-time link that lets a brother get back in on any phone. Valid for 15 minutes. */
export const issueRejoin = mutation({
  args: { token: v.string(), id: v.id("participants") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    const p = await ctx.db.get(id);
    if (!p) fail("not_found", "Participant not found.");
    const code = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = Date.now() + REJOIN_TTL_MS;
    await ctx.db.patch(id, { rejoinCode: code, rejoinExpiresAt: expiresAt });
    return { code, expiresAt };
  },
});

/**
 * A phone opens a rejoin link and becomes that brother. The phone sends a brand-new device id, so
 * it never clashes with another check-in; the old device is signed out. The code works once.
 */
export const claimRejoin = mutation({
  args: { code: v.string(), deviceId: v.string() },
  handler: async (ctx, { code, deviceId }) => {
    if (deviceId.length < 8 || deviceId.length > 64) fail("bad_device", "Please refresh the page and try again.");
    const p = code ? (await ctx.db.query("participants").collect()).find((x) => x.rejoinCode === code) : undefined;
    if (!p || (p.rejoinExpiresAt ?? 0) < Date.now()) {
      fail("bad_code", "This link has expired or was already used. Ask an organiser for a new QR code.");
    }
    const clash = await ctx.db
      .query("participants")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
    if (clash && clash._id !== p._id) fail("device_in_use", "Please refresh the page and try again.");
    await ctx.db.patch(p._id, { deviceId, rejoinCode: undefined, rejoinExpiresAt: undefined });
    return { firstName: p.firstName };
  },
});

/** A phone removes its own check-in (before teams are drawn). */
export const leave = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const event = await loadEvent(ctx);
    if (event.phase !== "setup") fail("closed", "Teams have been drawn. Ask an organiser to make changes.");
    const me = await ctx.db
      .query("participants")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
    if (me) await ctx.db.delete(me._id);
  },
});

export const adminUpdate = mutation({
  args: {
    token: v.string(),
    id: v.id("participants"),
    firstName: v.optional(v.string()),
    experience: v.optional(levelValidator),
  },
  handler: async (ctx, { token, id, firstName, experience }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "setup", "team_reveal");
    const p = await ctx.db.get(id);
    if (!p) fail("not_found", "Participant not found.");
    const patch: Partial<typeof p> = {};
    if (firstName !== undefined) {
      const nameError = validateFirstName(firstName);
      if (nameError) fail("bad_name", nameError);
      patch.firstName = tidyName(firstName);
      patch.normalisedName = normaliseName(patch.firstName);
      await assertNameFree(ctx, patch.normalisedName, id);
    }
    if (experience !== undefined) patch.experience = experience;
    await ctx.db.patch(id, patch);
  },
});

export const adminRemove = mutation({
  args: { token: v.string(), id: v.id("participants") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    requirePhase(await loadEvent(ctx), "setup");
    await ctx.db.delete(id);
  },
});

/**
 * Organiser removes someone at any point in the event (they left, or a duplicate check-in).
 * They come off their team; if they were captain, a teammate is drawn uniformly as the new captain.
 * A vote they already cast stays counted: there is no ballot record to undo.
 */
export const adminKick = mutation({
  args: { token: v.string(), id: v.id("participants") },
  handler: async (ctx, { token, id }) => {
    requireAdmin(token);
    const p = await ctx.db.get(id);
    if (!p) fail("not_found", "Participant not found.");
    const team = p.teamId ? await ctx.db.get(p.teamId) : null;
    if (team) {
      const memberIds = team.memberIds.filter((m) => m !== id);
      if (memberIds.length === 0) fail("last_member", `${p.firstName} is the only one left on ${team.name}. Reshuffle the teams instead.`);
      const captainId = team.captainId === id ? memberIds[pickIndex(Math.random, memberIds.length)] : team.captainId;
      await ctx.db.patch(team._id, { memberIds, captainId });
    }
    await ctx.db.delete(id);
  },
});

const TEST_LEVELS = ["beginner", "intermediate", "advanced"] as const;

/** Rehearsal helper: adds clearly-labelled synthetic participants. */
export const addTestParticipants = mutation({
  args: { token: v.string(), count: v.number() },
  handler: async (ctx, { token, count }) => {
    requireAdmin(token);
    requirePhase(await loadEvent(ctx), "setup");
    const existing = await ctx.db.query("participants").collect();
    const room = Math.max(0, Math.min(count, MAX_PARTICIPANTS - existing.length));
    let n = existing.filter((p) => p.isTest).length;
    for (let i = 0; i < room; i++) {
      n++;
      const firstName = `Test ${n}`;
      await ctx.db.insert("participants", {
        firstName,
        normalisedName: normaliseName(firstName),
        experience: TEST_LEVELS[(n - 1) % 3],
        deviceId: null,
        teamId: null,
        hasVoted: false,
        isTest: true,
      });
    }
    return room;
  },
});
