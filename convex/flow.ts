import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { prayersValidator } from "./schema";
import {
  durations,
  fail,
  freshEventFields,
  loadEvent,
  requireAdmin,
  requirePhase,
  type EventDoc,
} from "./model";
import { allocateTeams, MAX_PARTICIPANTS, MIN_PARTICIPANTS } from "../shared/fairness";
import { seededRng } from "../shared/rng";
import { TEAM_COUNT, TEAM_DEFS } from "../shared/teams";
import { HHMM } from "../shared/time";
import { validatePrayerTimes } from "../shared/salah";
import { nextSession, pauseTimer, resumeTimer, startTimer, type TimerState } from "../shared/timer";

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

async function setTimer(ctx: MutationCtx, event: EventDoc, timer: TimerState) {
  await ctx.db.patch(event._id, { timer });
  if (timer.endsAt !== null) {
    await ctx.scheduler.runAt(timer.endsAt, internal.flow.advanceTimer, { expectedEndsAt: timer.endsAt });
  }
}

async function beginHackathon(ctx: MutationCtx, event: EventDoc) {
  await ctx.db.patch(event._id, { phase: "hackathon", revealEndsAt: null, revealHeldMs: null });
  await setTimer(ctx, event, startTimer(durations(event), Date.now()));
}

const adminArgs = { token: v.string() };

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

// ---------- Pomodoro ----------

export const advanceTimer = internalMutation({
  args: { expectedEndsAt: v.number() },
  handler: async (ctx, { expectedEndsAt }) => {
    const event = await loadEvent(ctx);
    if (event.phase !== "hackathon" || event.timer.endsAt !== expectedEndsAt) return;
    await setTimer(ctx, event, nextSession(event.timer, durations(event), expectedEndsAt));
  },
});

export const pause = mutation({
  args: { ...adminArgs, reason: v.union(v.literal("manual"), v.literal("salah")) },
  handler: async (ctx, { token, reason }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    await setTimer(ctx, event, pauseTimer(event.timer, Date.now(), reason));
  },
});

export const resume = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    await setTimer(ctx, event, resumeTimer(event.timer, Date.now()));
  },
});

/** Skip to the next focus/break session, keeping the paused/running state. */
export const skipSession = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const next = nextSession(event.timer, durations(event), Date.now());
    const paused = event.timer.endsAt === null;
    await setTimer(ctx, event, paused ? { ...next, endsAt: null, pausedReason: event.timer.pausedReason } : next);
  },
});

/** Restart the current session from its full length, keeping the paused/running state. */
export const restartSession = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    const d = durations(event);
    const length = event.timer.mode === "focus" ? d.focusMs : d.breakMs;
    const paused = event.timer.endsAt === null;
    await setTimer(ctx, event, { ...event.timer, remainingMs: length, endsAt: paused ? null : Date.now() + length });
  },
});

// ---------- voting & results ----------

export const startVoting = mutation({
  args: adminArgs,
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    const event = await loadEvent(ctx);
    requirePhase(event, "hackathon");
    await ctx.db.patch(event._id, {
      phase: "voting",
      timer: pauseTimer(event.timer, Date.now(), "manual"),
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
    sessionEndTime: v.optional(v.union(v.string(), v.null())),
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
    if (changes.sessionEndTime && !HHMM.test(changes.sessionEndTime)) {
      fail("bad_setting", "End time must be HH:mm (24-hour).");
    }
    if (changes.prayers) {
      const error = validatePrayerTimes(changes.prayers);
      if (error) fail("bad_setting", error);
    }
    await ctx.db.patch(event._id, changes);
    // Keep the not-yet-started timer in step with new durations.
    if (event.phase === "setup" || event.phase === "team_reveal") {
      await ctx.db.patch(event._id, { timer: freshEventFields({ ...event, ...changes }).timer });
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
    await ctx.db.patch(event._id, freshEventFields(event));
  },
});
