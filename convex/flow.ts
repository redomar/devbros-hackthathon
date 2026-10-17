import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { prayersValidator, prayerValidator } from "./schema";
import {
  clockOf,
  fail,
  freshEventFields,
  loadEvent,
  planSettings,
  prayerBreakMs,
  prayerDay,
  requireAdmin,
  requirePhase,
  type EventDoc,
} from "./model";
import { allocateTeams, MAX_PARTICIPANTS, MIN_PARTICIPANTS } from "../shared/fairness";
import { seededRng } from "../shared/rng";
import { TEAM_COUNT, TEAM_DEFS } from "../shared/teams";
import { formatClock } from "../shared/time";
import { PRAYER_LABEL, validatePrayerTimes } from "../shared/salah";
import {
  beginPrayerBreak,
  buildPlan,
  callablePrayer,
  elapsedMs,
  hackStatus,
  pauseClock,
  prayerStartAt,
  resumeClock,
  seekClock,
  startClock,
  type HackClock,
} from "../shared/hacking";

// ---------- helpers ----------

async function clearTeams(ctx: MutationCtx) {
  for (const t of await ctx.db.query("teams").collect()) await ctx.db.delete(t._id);
  for (const p of await ctx.db.query("participants").collect()) {
    if (p.teamId !== null || p.hasVoted) await ctx.db.patch(p._id, { teamId: null, hasVoted: false });
  }
}

async function drawTeams(ctx: MutationCtx) {
  await clearTeams(ctx);
  const people = await ctx.db.query("participants").collect();
  const rng = seededRng(Math.floor(Math.random() * 2 ** 32));
  const allocation = allocateTeams(
    people.map((p) => ({ id: p._id, experience: p.experience })),
    TEAM_COUNT,
    rng,
  );
  for (const [i, team] of allocation.entries()) {
    const def = TEAM_DEFS[i];
    const memberIds = team.memberIds.map((id) => ctx.db.normalizeId("participants", id)!);
    const teamId = await ctx.db.insert("teams", {
      key: def.key,
      name: def.name,
      order: i,
      memberIds,
      captainId: ctx.db.normalizeId("participants", team.captainId)!,
      votes: 0,
    });
    for (const id of memberIds) await ctx.db.patch(id, { teamId });
  }
}

/** Starts (or restarts) the reveal auto-start countdown. */
async function armReveal(ctx: MutationCtx, event: EventDoc, ms: number | null) {
  if (ms === null || ms <= 0) {
    await ctx.db.patch(event._id, { revealEndsAt: null, revealHeldMs: null });
    return;
  }
  const revealEndsAt = Date.now() + ms;
  await ctx.db.patch(event._id, { revealEndsAt, revealHeldMs: null });
  await ctx.scheduler.runAt(revealEndsAt, internal.flow.autoStart, { expectedEndsAt: revealEndsAt });
}

/**
 * Saves the hacking clock and queues the jobs that act on it: the end of hacking while it runs,
 * and the end of a prayer break. Each job checks it's still current, so stale jobs are harmless.
 */
async function setClock(ctx: MutationCtx, event: EventDoc, clock: HackClock) {
  await ctx.db.patch(event._id, { clock });
  if (clock.runningSince !== null) {
    const finishAt = clock.runningSince + planSettings(event).totalMs - clock.doneMs;
    await ctx.scheduler.runAt(finishAt, internal.flow.finishHacking, { runningSince: clock.runningSince });
  }
  if (clock.prayer) {
    await ctx.scheduler.runAt(clock.prayer.endsAt, internal.flow.endPrayerBreakAuto, { endsAt: clock.prayer.endsAt });
  }
}

async function beginHackathon(ctx: MutationCtx, event: EventDoc) {
  await ctx.db.patch(event._id, { phase: "hackathon", revealEndsAt: null, revealHeldMs: null });
  await setClock(ctx, event, startClock(Date.now()));
}

function statusOf(event: EventDoc, now: number) {
  const plan = planSettings(event);
  const clock = clockOf(event);
  return { clock, totalMs: plan.totalMs, status: hackStatus(clock, buildPlan(plan), now, plan.totalMs) };
}

const adminArgs = { token: v.string() };

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);
}

// ---------- arrivals → teams ----------

export const makeTeams = mutation({
  args: { ...adminArgs, acceptCount: v.optional(v.boolean()) },
  handler: async (ctx, { token, acceptCount }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "setup");
    const count = (await ctx.db.query("participants").collect()).length;
    if (count < MIN_PARTICIPANTS || count > MAX_PARTICIPANTS) {
      fail("bad_count", `Teams need between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} people; ${count} checked in.`);
    }
    if (count !== event.expectedParticipants && !acceptCount) {
      fail("count_mismatch", `${count} checked in but ${event.expectedParticipants} expected.`);
    }
    await drawTeams(ctx);
    await ctx.db.patch(event._id, { phase: "team_reveal" });
    await armReveal(ctx, event, event.revealMinutes * 60_000);
  },
});

export const reshuffle = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "team_reveal");
    await drawTeams(ctx);
    await armReveal(ctx, event, event.revealMinutes * 60_000);
  },
});

export const backToArrivals = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "team_reveal");
    await clearTeams(ctx);
    await ctx.db.patch(event._id, { phase: "setup", revealEndsAt: null, revealHeldMs: null });
  },
});

export const holdReveal = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "team_reveal");
    if (event.revealEndsAt === null) return;
    await ctx.db.patch(event._id, {
      revealEndsAt: null,
      revealHeldMs: Math.max(0, event.revealEndsAt - Date.now()),
    });
  },
});

export const continueReveal = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "team_reveal");
    if (event.revealEndsAt !== null) return;
    await armReveal(ctx, event, event.revealHeldMs ?? event.revealMinutes * 60_000);
  },
});

export const startHackathon = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "team_reveal");
    await beginHackathon(ctx, event);
  },
});

export const autoStart = internalMutation({
  args: { expectedEndsAt: v.number() },
  handler: async (ctx, { expectedEndsAt }) => {
    const event = await loadEvent(ctx);
    // Stale job: held, reshuffled or already started.
    if (event.phase !== "team_reveal" || event.revealEndsAt !== expectedEndsAt) return;
    await beginHackathon(ctx, event);
  },
});

// ---------- hacking clock ----------

/** Freezes the clock at the full hacking time once it's reached. Re-queues itself if the length changed. */
export const finishHacking = internalMutation({
  args: { runningSince: v.number() },
  handler: async (ctx, { runningSince }) => {
    const event = await loadEvent(ctx);
    const clock = clockOf(event);
    if (event.phase !== "hackathon" || clock.runningSince !== runningSince) return;
    const { totalMs } = planSettings(event);
    if (elapsedMs(clock, Date.now(), totalMs) >= totalMs) {
      await ctx.db.patch(event._id, { clock: { ...clock, doneMs: totalMs, runningSince: null, pausedReason: null } });
    } else {
      await ctx.scheduler.runAt(runningSince + totalMs - clock.doneMs, internal.flow.finishHacking, { runningSince });
    }
  },
});

export const pause = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const { clock, totalMs } = statusOf(event, Date.now());
    if (clock.prayer) fail("in_prayer", "A prayer break is running. End it first.");
    await setClock(ctx, event, pauseClock(clock, Date.now(), totalMs, "manual"));
  },
});

/** Resumes hacking after a manual pause, or ends a prayer break early. */
export const resume = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const { clock, status } = statusOf(event, Date.now());
    if (status.finished) fail("finished", "Hacking time is over.");
    await setClock(ctx, event, resumeClock(clock, Date.now()));
  },
});

/** Pauses hacking for a prayer break. Allowed any time after the prayer begins, once per prayer. */
export const startPrayerBreak = mutation({
  args: { ...adminArgs, prayer: prayerValidator },
  handler: async (ctx, { token, prayer }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const now = Date.now();
    const { clock, status, totalMs } = statusOf(event, now);
    const label = PRAYER_LABEL[prayer];
    const day = prayerDay(event);
    if (clock.prayer) fail("in_prayer", "A prayer break is already running.");
    if (clock.prayersTaken.some((t) => t.prayer === prayer)) fail("prayer_taken", `The ${label} break has already been taken.`);
    if (status.finished) fail("finished", "Hacking time is over.");
    if (callablePrayer(clock, day, now) !== prayer) {
      const startAt = prayerStartAt(day, prayer);
      fail(
        "prayer_not_now",
        startAt > now
          ? `${label} hasn't begun yet (begins ${formatClock(startAt, event.timeZone)}).`
          : `It isn't ${label} time now.`,
      );
    }
    await setClock(ctx, event, beginPrayerBreak(clock, prayer, now, prayerBreakMs(event), totalMs));
  },
});

/** Ends a prayer break when its time is up, resuming hacking from that exact moment. */
export const endPrayerBreakAuto = internalMutation({
  args: { endsAt: v.number() },
  handler: async (ctx, { endsAt }) => {
    const event = await loadEvent(ctx);
    const clock = clockOf(event);
    if (event.phase !== "hackathon" || clock.prayer?.endsAt !== endsAt) return;
    await setClock(ctx, event, resumeClock(clock, endsAt));
  },
});

/** Jump to the start of the next block, keeping the clock running or paused. */
export const skipSession = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const now = Date.now();
    const { clock, status } = statusOf(event, now);
    if (clock.prayer) fail("in_prayer", "A prayer break is running. End it first.");
    if (status.finished) fail("finished", "Hacking time is over.");
    await setClock(ctx, event, seekClock(clock, now, status.block.endMs));
  },
});

/** Restart the current block from its full length, keeping the clock running or paused. */
export const restartSession = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const now = Date.now();
    const { clock, status } = statusOf(event, now);
    if (clock.prayer) fail("in_prayer", "A prayer break is running. End it first.");
    await setClock(ctx, event, seekClock(clock, now, status.block.startMs));
  },
});

// ---------- voting & results ----------

export const startVoting = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const { clock, totalMs } = statusOf(event, Date.now());
    await ctx.db.patch(event._id, {
      phase: "voting",
      clock: { ...pauseClock(clock, Date.now(), totalMs, "manual"), prayer: null },
    });
  },
});

export const closeVoting = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "voting");
    await ctx.db.patch(event._id, { phase: "results_pending" });
  },
});

export const revealResults = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "results_pending");
    await ctx.db.patch(event._id, { phase: "results" });
  },
});

/** Anonymous ballots can't be corrected individually, so the only fix is a full re-vote. */
export const restartVoting = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "voting", "results_pending", "results");
    for (const t of await ctx.db.query("teams").collect()) await ctx.db.patch(t._id, { votes: 0 });
    for (const p of await ctx.db.query("participants").collect()) {
      if (p.hasVoted) await ctx.db.patch(p._id, { hasVoted: false });
    }
    await ctx.db.patch(event._id, { phase: "voting" });
  },
});

/** Back to hackathon from voting (e.g. started voting by mistake). Clears any votes cast. */
export const reopenHackathon = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "voting");
    for (const t of await ctx.db.query("teams").collect()) await ctx.db.patch(t._id, { votes: 0 });
    for (const p of await ctx.db.query("participants").collect()) {
      if (p.hasVoted) await ctx.db.patch(p._id, { hasVoted: false });
    }
    await ctx.db.patch(event._id, { phase: "hackathon" });
  },
});

// ---------- settings & reset ----------

export const updateSettings = mutation({
  args: {
    ...adminArgs,
    expectedParticipants: v.optional(v.number()),
    focusMinutes: v.optional(v.number()),
    breakMinutes: v.optional(v.number()),
    revealMinutes: v.optional(v.number()),
    hackingMinutes: v.optional(v.number()),
    prayerBreakMinutes: v.optional(v.number()),
    eventDate: v.optional(v.string()),
    prayers: v.optional(prayersValidator),
  },
  handler: async (ctx, { token, ...changes }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    const whole = (n: number | undefined, min: number, max: number, label: string) => {
      if (n !== undefined && (!Number.isInteger(n) || n < min || n > max)) {
        fail("bad_setting", `${label} must be a whole number from ${min} to ${max}.`);
      }
    };
    whole(changes.expectedParticipants, MIN_PARTICIPANTS, MAX_PARTICIPANTS, "Expected participants");
    whole(changes.focusMinutes, 1, 180, "Focus minutes");
    whole(changes.breakMinutes, 1, 60, "Break minutes");
    whole(changes.revealMinutes, 0, 30, "Reveal minutes");
    whole(changes.hackingMinutes, 30, 600, "Hacking minutes");
    whole(changes.prayerBreakMinutes, 1, 30, "Prayer break minutes");
    if (changes.eventDate !== undefined && !isIsoDate(changes.eventDate)) {
      fail("bad_setting", "Event date must be YYYY-MM-DD.");
    }
    if (changes.prayers) {
      const error = validatePrayerTimes(changes.prayers);
      if (error) fail("bad_setting", error);
    }
    await ctx.db.patch(event._id, changes);
    // A running clock's finish job was queued for the old length; re-anchor so it's queued afresh.
    const clock = clockOf(event);
    if (event.phase === "hackathon" && clock.runningSince !== null) {
      const updated = { ...event, ...changes };
      const now = Date.now();
      await setClock(ctx, updated, seekClock(clock, now, elapsedMs(clock, now, planSettings(updated).totalMs)));
    }
  },
});

export const resetEvent = mutation({
  args: { ...adminArgs, confirm: v.literal("RESET") },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    await clearTeams(ctx);
    for (const p of await ctx.db.query("participants").collect()) await ctx.db.delete(p._id);
    await ctx.db.patch(event._id, freshEventFields());
  },
});
