/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

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

describe("timer", () => {
  it("pause and resume keep the remaining time", async () => {
    const t = convexTest(schema, modules);
    await registerNine(t);
    await t.mutation(api.flow.makeTeams, { token });
    await t.mutation(api.flow.startHackathon, { token });
    await t.mutation(api.flow.pause, { token, reason: "salah" });
    const paused = (await t.query(api.event.publicState, {})).timer;
    expect(paused.endsAt).toBeNull();
    expect(paused.pausedReason).toBe("salah");
    await t.mutation(api.flow.resume, { token });
    const running = (await t.query(api.event.publicState, {})).timer;
    expect(running.endsAt).not.toBeNull();
  });
});
