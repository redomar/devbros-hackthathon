import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { fail, loadEvent, requireAdmin, requirePhase } from "./model";
import { normaliseName } from "../shared/names";
import { defaultTeamName, tidyTeamName, validateTeamName } from "../shared/teams";

/** Validates a new team name and checks no other team already has it. */
async function checkedName(ctx: MutationCtx, team: Doc<"teams">, raw: string): Promise<string> {
  const error = validateTeamName(raw);
  if (error) fail("bad_name", error);
  const name = tidyTeamName(raw);
  const others = (await ctx.db.query("teams").collect()).filter((t) => t._id !== team._id);
  if (others.some((t) => normaliseName(t.name) === normaliseName(name))) {
    fail("name_taken", "Another team already has that name. Try something else.");
  }
  return name;
}

/** A captain renames their own team from their phone, between the draw and the start of voting. */
export const rename = mutation({
  args: { deviceId: v.string(), name: v.string() },
  handler: async (ctx, { deviceId, name }) => {
    const event = await loadEvent(ctx);
    if (event.phase !== "team_reveal" && event.phase !== "hackathon") {
      fail("closed", "Team names can only be changed after the draw and before voting opens.");
    }
    const me = await ctx.db
      .query("participants")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .first();
    const team = me?.teamId ? await ctx.db.get(me.teamId) : null;
    if (!me || !team) fail("no_team", "You're not on a team yet.");
    if (team.captainId !== me._id) fail("not_captain", "Only your team's captain can rename the team.");
    const tidy = await checkedName(ctx, team, name);
    await ctx.db.patch(team._id, { name: tidy });
    return tidy;
  },
});

/** Organiser override: rename any team, or pass null to go back to its default name. */
export const adminRename = mutation({
  args: { token: v.string(), teamId: v.id("teams"), name: v.union(v.string(), v.null()) },
  handler: async (ctx, { token, teamId, name }) => {
    requireAdmin(token);
    requirePhase(await loadEvent(ctx), "team_reveal", "hackathon", "voting", "results_pending");
    const team = await ctx.db.get(teamId);
    if (!team) fail("not_found", "Team not found.");
    const next = name === null ? defaultTeamName(team.key) : await checkedName(ctx, team, name);
    await ctx.db.patch(team._id, { name: next });
    return next;
  },
});
