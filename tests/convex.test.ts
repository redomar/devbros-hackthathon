/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { zonedTimeToEpoch } from "../shared/time";
import { validateTeamName } from "../shared/teams";

const modules = import.meta.glob("../convex/**/*.ts");
const token = "test-token-1234";

beforeEach(() => {
  process.env.ADMIN_TOKEN = token;
});

type T = ReturnType<typeof convexTest>;
const levels = ["beginner", "intermediate", "advanced"] as const;

async function registerNine(t: T) {
  for (let i = 0; i < 9; i++) {
    await t.mutation(api.participants.register, {
      deviceId: `device-${i}-xxxxxxxx`,
      firstName: `Brother${String.fromCharCode(65 + i)}`.replace(/\d/g, ""),
      experience: levels[i % 3],
    });
  }
}

async function toVoting(t: T) {
  await registerNine(t);
  await t.mutation(api.flow.makeTeams, { token });
  await t.mutation(api.flow.startHackathon, { token });
  await t.mutation(api.flow.startVoting, { token });
}

describe("check-in", () => {
  it("re-submitting from the same device updates instead of duplicating", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.participants.register, { deviceId: "device-aaaaaaaa", firstName: "yusuf", experience: "beginner" });
    await t.mutation(api.participants.register, { deviceId: "device-aaaaaaaa", firstName: "Yusuf", experience: "advanced" });
    const state = await t.query(api.event.publicState, {});
    expect(state.participants).toHaveLength(1);
    expect(state.participants[0]).toMatchObject({ firstName: "Yusuf", experience: "advanced" });
  });

  it("rejects a duplicate name from another device", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.participants.register, { deviceId: "device-aaaaaaaa", firstName: "Ali", experience: "beginner" });
    await expect(
      t.mutation(api.participants.register, { deviceId: "device-bbbbbbbb", firstName: " ali ", experience: "beginner" }),
    ).rejects.toThrow(/already checked in/);
  });

  it("never exposes device ids publicly", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.participants.register, { deviceId: "device-secret-1", firstName: "Omar", experience: "beginner" });
    expect(JSON.stringify(await t.query(api.event.publicState, {}))).not.toContain("device-secret-1");
  });

  it("lets a phone remove its own check-in before teams are drawn", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.participants.register, { deviceId: "device-leave-1", firstName: "Hamza", experience: "beginner" });
    await t.mutation(api.participants.leave, { deviceId: "device-leave-1" });
    expect(await t.query(api.event.me, { deviceId: "device-leave-1" })).toBeNull();
    expect((await t.query(api.event.publicState, {})).participants).toHaveLength(0);
  });

  it("closes check-in once teams are made", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    await expect(
      t.mutation(api.participants.register, { deviceId: "device-late-xx", firstName: "Late", experience: "beginner" }),
    ).rejects.toThrow(/closed/);
  });
});

describe("organiser guard", () => {
  it("rejects privileged actions without the right token", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await expect(t.mutation(api.flow.makeTeams, { token: "wrong" })).rejects.toThrow(/not recognised/);
  });

  it("requires explicit acceptance when the count differs from expected", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 8; i++) {
      await t.mutation(api.participants.register, { deviceId: `dev-${i}-xxxxxx`, firstName: `Name${"abcdefgh"[i]}`.replace(/\d/g, ""), experience: "beginner" });
    }
    await expect(t.mutation(api.flow.makeTeams, { token })).rejects.toThrow(/8 checked in but 9 expected/);
    await t.mutation(api.flow.makeTeams, { token, acceptCount: true });
    const state = await t.query(api.event.publicState, {});
    expect(state.teams.map((x) => x.memberIds.length)).toEqual([3, 3, 2]);
  });
});

describe("voting", () => {
  it("counts one vote per person, blocks own team, hides tallies until reveal", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const state = await t.query(api.event.publicState, {});
    const me = await t.query(api.event.me, { deviceId: "device-0-xxxxxxxx" });
    const own = me!.teamId!;
    const other = state.teams.find((x) => x.id !== own)!.id;

    await expect(t.mutation(api.voting.castVote, { deviceId: "device-0-xxxxxxxx", teamId: own })).rejects.toThrow(/own team/);
    await t.mutation(api.voting.castVote, { deviceId: "device-0-xxxxxxxx", teamId: other });
    // Same person by name from another device.
    await expect(t.mutation(api.voting.castVote, { name: me!.firstName, teamId: other })).rejects.toThrow(/already/);

    const during = await t.query(api.event.publicState, {});
    expect(during.votesReceived).toBe(1);
    expect(during.teams.every((x) => x.votes === null)).toBe(true);

    await t.mutation(api.flow.closeVoting, { token });
    expect((await t.query(api.event.publicState, {})).teams.every((x) => x.votes === null)).toBe(true);
    await t.mutation(api.flow.revealResults, { token });
    const results = await t.query(api.event.publicState, {});
    expect(results.teams.reduce((s, x) => s + (x.votes ?? 0), 0)).toBe(1);
  });

  it("concurrent duplicate submissions count once", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const me = await t.query(api.event.me, { deviceId: "device-1-xxxxxxxx" });
    const state = await t.query(api.event.publicState, {});
    const other = state.teams.find((x) => x.id !== me!.teamId)!.id;
    const results = await Promise.allSettled([
      t.mutation(api.voting.castVote, { deviceId: "device-1-xxxxxxxx", teamId: other }),
      t.mutation(api.voting.castVote, { deviceId: "device-1-xxxxxxxx", teamId: other }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await t.query(api.event.publicState, {})).votesReceived).toBe(1);
  });

  it("stores no voter-to-team record anywhere", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const me = await t.query(api.event.me, { deviceId: "device-2-xxxxxxxx" });
    const state = await t.query(api.event.publicState, {});
    const other = state.teams.find((x) => x.id !== me!.teamId)!.id;
    await t.mutation(api.voting.castVote, { deviceId: "device-2-xxxxxxxx", teamId: other });
    await t.run(async (ctx) => {
      const voter = (await ctx.db.get(me!.id))!;
      expect(Object.values(voter)).not.toContain(other);
      expect(Object.keys(voter).sort()).toEqual(
        ["_creationTime", "_id", "deviceId", "experience", "firstName", "hasVoted", "isTest", "normalisedName", "teamId"].sort(),
      );
    });
  });

  it("rejects votes outside the voting phase and unknown names", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const state = await t.query(api.event.publicState, {});
    await expect(t.mutation(api.voting.castVote, { name: "Nobody", teamId: state.teams[0].id })).rejects.toThrow(/couldn't find/);
    await t.mutation(api.flow.closeVoting, { token });
    await expect(t.mutation(api.voting.castVote, { deviceId: "device-3-xxxxxxxx", teamId: state.teams[0].id })).rejects.toThrow(/isn't open/);
  });

  it("restart voting zeroes every tally and lets everyone vote again", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const me = await t.query(api.event.me, { deviceId: "device-4-xxxxxxxx" });
    const state = await t.query(api.event.publicState, {});
    const other = state.teams.find((x) => x.id !== me!.teamId)!.id;
    await t.mutation(api.voting.castVote, { deviceId: "device-4-xxxxxxxx", teamId: other });
    await t.mutation(api.flow.restartVoting, { token });
    expect((await t.query(api.event.publicState, {})).votesReceived).toBe(0);
    await t.mutation(api.voting.castVote, { deviceId: "device-4-xxxxxxxx", teamId: other });
  });
});

describe("hacking clock", () => {
  const MIN = 60_000;
  const at = (hhmm: string) => zonedTimeToEpoch("2026-10-18", hhmm, "Europe/London");
  const clockAt = (hhmm: string) => vi.setSystemTime(at(hhmm));
  const state = (t: T) => t.query(api.event.publicState, {});
  /** Advance fake time and run any scheduled jobs that fall due. */
  const advance = async (t: T, ms: number) => {
    vi.advanceTimersByTime(ms);
    await t.finishInProgressScheduledFunctions();
  };

  async function startHacking(t: T) {
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    await t.mutation(api.flow.startHackathon, { token });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    clockAt("12:30");
  });
  afterEach(() => vi.useRealTimers());

  it("pause and resume keep the hacking time", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    vi.advanceTimersByTime(20 * MIN);
    await t.mutation(api.flow.pause, { token });
    vi.advanceTimersByTime(15 * MIN);
    const paused = (await state(t)).clock;
    expect(paused).toMatchObject({ doneMs: 20 * MIN, runningSince: null, pausedReason: "manual" });
    await t.mutation(api.flow.resume, { token });
    expect((await state(t)).clock.runningSince).toBe(at("12:30") + 35 * MIN);
  });

  it("refuses a prayer break before the prayer begins", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await expect(t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" })).rejects.toThrow(/hasn't begun yet \(begins 12:58\)/);
    await expect(t.mutation(api.flow.startPrayerBreak, { token, prayer: "asr" })).rejects.toThrow(/hasn't begun/);
  });

  it("a prayer break pauses hacking, resumes by itself after 10 minutes and can't be repeated", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await advance(t, 38 * MIN); // 13:08, Dhuhr began at 12:58
    await t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" });
    const during = (await state(t)).clock;
    expect(during).toMatchObject({ doneMs: 38 * MIN, runningSince: null, pausedReason: "prayer" });
    expect(during.prayer).toEqual({ prayer: "dhuhr", endsAt: at("13:18") });
    expect(during.prayersTaken).toEqual([{ prayer: "dhuhr", atMs: 38 * MIN }]);
    await expect(t.mutation(api.flow.pause, { token })).rejects.toThrow(/prayer break is running/);

    await advance(t, 10 * MIN);
    const after = (await state(t)).clock;
    expect(after).toMatchObject({ doneMs: 38 * MIN, runningSince: at("13:18"), pausedReason: null, prayer: null });
    await expect(t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" })).rejects.toThrow(/already been taken/);
  });

  it("an organiser can end a prayer break early", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await advance(t, 30 * MIN); // 13:00
    await t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" });
    await advance(t, 4 * MIN);
    await t.mutation(api.flow.resume, { token });
    expect((await state(t)).clock).toMatchObject({ doneMs: 30 * MIN, runningSince: at("13:04"), prayer: null });
    // The original auto-resume job fires later and must not touch the running clock.
    await advance(t, 10 * MIN);
    expect((await state(t)).clock).toMatchObject({ doneMs: 30 * MIN, runningSince: at("13:04") });
  });

  it("gives 4h 30m of hacking and finishes at 17:20 with Dhuhr and Asr breaks", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await advance(t, 38 * MIN); // 13:08
    await t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" });
    await advance(t, 10 * MIN); // 13:18, resumed
    clockAt("16:20");
    await t.mutation(api.flow.startPrayerBreak, { token, prayer: "asr" });
    await advance(t, 10 * MIN); // 16:30, resumed
    await advance(t, 49 * MIN); // 17:19
    expect((await state(t)).clock.runningSince).not.toBeNull();
    await advance(t, 1 * MIN); // 17:20
    const end = (await state(t)).clock;
    expect(end).toMatchObject({ doneMs: 270 * MIN, runningSince: null });
    expect(end.prayersTaken.map((p) => p.prayer)).toEqual(["dhuhr", "asr"]);
  });

  it("skips to the next block and restarts the current one", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await advance(t, 20 * MIN);
    await t.mutation(api.flow.skipSession, { token });
    expect((await state(t)).clock).toMatchObject({ doneMs: 50 * MIN, runningSince: at("12:50") });
    await advance(t, 4 * MIN);
    await t.mutation(api.flow.restartSession, { token });
    expect((await state(t)).clock).toMatchObject({ doneMs: 50 * MIN, runningSince: at("12:54") });
  });

  it("starting voting stops the clock and ends a prayer break", async () => {
    const t = convexTest(schema, modules);
    await startHacking(t);
    await advance(t, 30 * MIN);
    await t.mutation(api.flow.startPrayerBreak, { token, prayer: "dhuhr" });
    await t.mutation(api.flow.startVoting, { token });
    const c = (await state(t)).clock;
    expect(c).toMatchObject({ runningSince: null, prayer: null, doneMs: 30 * MIN });
    await advance(t, 10 * MIN);
    expect((await state(t)).clock.runningSince).toBeNull();
  });
});

describe("team names", () => {
  // registerNine gives BrotherA… device-0-xxxxxxxx, BrotherB… device-1-xxxxxxxx, and so on.
  const deviceOf = (firstName: string) => `device-${firstName.charCodeAt(7) - 65}-xxxxxxxx`;

  async function drawn(t: T) {
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    const s = await t.query(api.event.publicState, {});
    const team = s.teams[0];
    const nameOf = (id: string) => s.participants.find((p) => p.id === id)!.firstName;
    return {
      s,
      team,
      captain: deviceOf(nameOf(team.captainId)),
      member: deviceOf(nameOf(team.memberIds.find((id) => id !== team.captainId)!)),
    };
  }

  it("lets the captain rename their team during hacking", async () => {
    const t = convexTest(schema, modules);
    const { team, captain } = await drawn(t);
    await t.mutation(api.flow.startHackathon, { token });
    await t.mutation(api.teams.rename, { deviceId: captain, name: "  Byte   Club " });
    const s = await t.query(api.event.publicState, {});
    expect(s.teams.find((x) => x.id === team.id)).toMatchObject({ name: "Byte Club", key: team.key });
  });

  it("only lets the captain rename", async () => {
    const t = convexTest(schema, modules);
    const { member } = await drawn(t);
    await expect(t.mutation(api.teams.rename, { deviceId: member, name: "Byte Club" })).rejects.toThrow(/captain/);
  });

  it("rejects a name another team already has", async () => {
    const t = convexTest(schema, modules);
    const { s, captain } = await drawn(t);
    await expect(t.mutation(api.teams.rename, { deviceId: captain, name: s.teams[1].name.toUpperCase() })).rejects.toThrow(/already has/);
  });

  it("locks names once voting opens, but organisers can still fix or reset one", async () => {
    const t = convexTest(schema, modules);
    const { team, captain } = await drawn(t);
    await t.mutation(api.teams.rename, { deviceId: captain, name: "Byte Club" });
    await t.mutation(api.flow.startHackathon, { token });
    await t.mutation(api.flow.startVoting, { token });
    await expect(t.mutation(api.teams.rename, { deviceId: captain, name: "Late Name" })).rejects.toThrow(/before voting opens/);
    await expect(t.mutation(api.teams.adminRename, { token: "wrong", teamId: team.id, name: null })).rejects.toThrow(/not recognised/);
    await t.mutation(api.teams.adminRename, { token, teamId: team.id, name: null });
    expect((await t.query(api.event.publicState, {})).teams.find((x) => x.id === team.id)!.name).toBe(team.name);
  });

  it("validates names", () => {
    expect(validateTeamName("Byte Club")).toBeNull();
    expect(validateTeamName("404 Brothers!")).toBeNull();
    expect(validateTeamName("x")).toMatch(/enter/);
    expect(validateTeamName("a".repeat(25))).toMatch(/24 characters/);
    expect(validateTeamName("<script>")).toMatch(/only/);
  });
});

describe("rejoin links", () => {
  it("move a brother to a new phone once, organiser only, and expire", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    const old = "device-0-xxxxxxxx";
    const me = (await t.query(api.event.me, { deviceId: old }))!;

    await expect(t.mutation(api.participants.issueRejoin, { token: "wrong", id: me.id })).rejects.toThrow();
    const { code } = await t.mutation(api.participants.issueRejoin, { token, id: me.id });

    const fresh = "rejoined-phone-xxxxxxxx";
    expect(await t.mutation(api.participants.claimRejoin, { code, deviceId: fresh })).toEqual({ firstName: me.firstName });
    expect((await t.query(api.event.me, { deviceId: fresh }))?.id).toBe(me.id);
    expect(await t.query(api.event.me, { deviceId: old })).toBeNull();
    // Works once.
    await expect(t.mutation(api.participants.claimRejoin, { code, deviceId: "another-phone-xxxxxxxx" })).rejects.toThrow(/expired or was already used/);
    // Codes never reach public state.
    expect(JSON.stringify(await t.query(api.event.publicState, {}))).not.toContain(code);

    vi.useFakeTimers();
    try {
      const second = await t.mutation(api.participants.issueRejoin, { token, id: me.id });
      vi.advanceTimersByTime(16 * 60_000);
      await expect(t.mutation(api.participants.claimRejoin, { code: second.code, deviceId: "late-phone-xxxxxxxx" })).rejects.toThrow(/expired/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("kicking a player", () => {
  it("works mid-event, organiser only, and takes them off their team", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    await t.mutation(api.flow.startHackathon, { token });
    const before = await t.query(api.event.publicState, {});
    const team = before.teams[0];
    const victim = team.memberIds.find((id) => id !== team.captainId)!;

    await expect(t.mutation(api.participants.adminKick, { token: "wrong", id: victim })).rejects.toThrow();
    await t.mutation(api.participants.adminKick, { token, id: victim });

    const after = await t.query(api.event.publicState, {});
    expect(after.participants.map((p) => p.id)).not.toContain(victim);
    const t0 = after.teams.find((x) => x.id === team.id)!;
    expect(t0.memberIds).toEqual(team.memberIds.filter((id) => id !== victim));
    expect(t0.captainId).toBe(team.captainId);
    expect(t0.name).toBe(team.name);
  });

  it("draws a new captain from the remaining teammates when the captain is kicked", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    const team = (await t.query(api.event.publicState, {})).teams[1];
    await t.mutation(api.participants.adminKick, { token, id: team.captainId });
    const t1 = (await t.query(api.event.publicState, {})).teams.find((x) => x.id === team.id)!;
    expect(t1.memberIds).not.toContain(team.captainId);
    expect(t1.memberIds).toContain(t1.captainId);
  });

  it("refuses to empty a team, and keeps votes already cast", async () => {
    const t = convexTest(schema, modules);
    await toVoting(t);
    const state = await t.query(api.event.publicState, {});
    const voter = (await t.query(api.event.me, { deviceId: "device-0-xxxxxxxx" }))!;
    const other = state.teams.find((x) => x.id !== voter.teamId)!;
    await t.mutation(api.voting.castVote, { deviceId: "device-0-xxxxxxxx", teamId: other.id });
    await t.mutation(api.participants.adminKick, { token, id: voter.id });

    const team = state.teams.find((x) => x.id === voter.teamId)!;
    const rest = team.memberIds.filter((id) => id !== voter.id);
    await t.mutation(api.participants.adminKick, { token, id: rest[0] });
    await expect(t.mutation(api.participants.adminKick, { token, id: rest[1] })).rejects.toThrow(/only one left/);

    await t.mutation(api.flow.closeVoting, { token });
    await t.mutation(api.flow.revealResults, { token });
    const results = await t.query(api.event.publicState, {});
    expect(results.teams.find((x) => x.id === other.id)!.votes).toBe(1);
  });
});
