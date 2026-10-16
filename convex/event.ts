import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { defaultEvent, isAdminToken, readEvent } from "./model";

/**
 * Everything the big screen and phones may see. Device ids, per-voter status and vote counts
 * are deliberately excluded; counts appear only once results are revealed.
 */
export const publicState = query({
  args: {},
  handler: async (ctx) => {
    const event = (await readEvent(ctx)) ?? defaultEvent();
    const participants = await ctx.db.query("participants").collect();
    const teams = (await ctx.db.query("teams").collect()).sort((a, b) => a.order - b.order);
    const revealed = event.phase === "results";
    const eligible = participants.filter((p) => p.teamId !== null);

    return {
      phase: event.phase,
      settings: {
        expectedParticipants: event.expectedParticipants,
        focusMinutes: event.focusMinutes,
        breakMinutes: event.breakMinutes,
        revealMinutes: event.revealMinutes,
        sessionEndTime: event.sessionEndTime,
      },
      eventDate: event.eventDate,
      timeZone: event.timeZone,
      prayers: event.prayers,
      prayerSource: event.prayerSource,
      revealEndsAt: event.revealEndsAt,
      revealHeldMs: event.revealHeldMs,
      timer: event.timer,
      participants: participants
        .sort((a, b) => a._creationTime - b._creationTime)
        .map((p) => ({
          id: p._id,
          firstName: p.firstName,
          experience: p.experience,
          teamId: p.teamId,
          isTest: p.isTest,
          joinedAt: p._creationTime,
        })),
      teams: teams.map((t) => ({
        id: t._id,
        key: t.key,
        name: t.name,
        memberIds: t.memberIds,
        captainId: t.captainId,
        votes: revealed ? t.votes : null,
      })),
      votesReceived: eligible.filter((p) => p.hasVoted).length,
      eligibleVoters: eligible.length,
    };
  },
});

/** The phone's own registration, looked up by its private device id. */
export const me = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    if (!deviceId) return null;
    const p = await ctx.db
      .query("participants")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
    if (!p) return null;
    return { id: p._id, firstName: p.firstName, experience: p.experience, teamId: p.teamId, hasVoted: p.hasVoted };
  },
});

export const checkAdmin = query({
  args: { token: v.string() },
  handler: async (_ctx, { token }) => isAdminToken(token),
});

/** Mutations are never cached, so this gives a fresh server timestamp for clock-offset estimation. */
export const serverNow = mutation({
  args: {},
  handler: async () => Date.now(),
});
