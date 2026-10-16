import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, loadEvent, readEvent, requireAdmin } from "./model";
import { normaliseName } from "../shared/names";

/**
 * Validates and counts one vote. The voter->team pairing exists only in this function's
 * arguments: we increment the team's aggregate counter and flag the voter as having voted,
 * atomically, and store nothing that links the two. Never log the arguments.
 */
export const castVote = mutation({
  args: {
    deviceId: v.optional(v.string()),
    name: v.optional(v.string()),
    teamId: v.id("teams"),
  },
  handler: async (ctx, { deviceId, name, teamId }) => {
    const event = await loadEvent(ctx);
    if (event.phase !== "voting") fail("closed", "Voting isn't open right now.");

    const voter = name
      ? await ctx.db
          .query("participants")
          .withIndex("by_name", (q) => q.eq("normalisedName", normaliseName(name)))
          .first()
      : deviceId
        ? await ctx.db
            .query("participants")
            .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
            .first()
        : null;

    if (!voter) fail("unknown_voter", "We couldn't find that name. Use the name you checked in with.");
    if (voter.teamId === null) fail("no_team", "You weren't placed in a team, so you can't vote. Speak to an organiser.");
    if (voter.hasVoted) fail("already_voted", "A vote has already been recorded for this name.");
    if (voter.teamId === teamId) fail("own_team", "You can't vote for your own team.");

    const team = await ctx.db.get(teamId);
    if (!team) fail("unknown_team", "That team doesn't exist.");

    // Convex mutations are serialisable transactions: concurrent duplicates conflict and retry,
    // then see hasVoted=true, so a vote can only ever be counted once.
    await ctx.db.patch(team._id, { votes: team.votes + 1 });
    await ctx.db.patch(voter._id, { hasVoted: true });
    return { ok: true as const };
  },
});

/** Organiser-only: who still needs to vote (names only, never choices). */
export const pendingVoters = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    requireAdmin(token);
    if (!(await readEvent(ctx))) return [];
    const participants = await ctx.db.query("participants").collect();
    return participants.filter((p) => p.teamId !== null && !p.hasVoted).map((p) => p.firstName);
  },
});
