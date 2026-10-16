import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { levelValidator } from "./schema";
import { fail, loadEvent, requireAdmin, requirePhase } from "./model";
import { normaliseName, tidyName, validateFirstName } from "../shared/names";
import { MAX_PARTICIPANTS } from "../shared/fairness";
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
