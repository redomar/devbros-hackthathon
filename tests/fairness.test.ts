import { describe, expect, it } from "vitest";
import { allocateTeams, teamSizes, type Allocatable } from "../shared/fairness";
import { LEVEL_SCORE, type Level } from "../shared/levels";
import { seededRng } from "../shared/rng";

const people = (levels: Level[]): Allocatable[] => levels.map((experience, i) => ({ id: `p${i}`, experience }));
const nine = people(["beginner", "beginner", "beginner", "intermediate", "intermediate", "intermediate", "advanced", "advanced", "advanced"]);

function expectPartition(input: Allocatable[], teams: { memberIds: string[] }[]) {
  const all = teams.flatMap((t) => t.memberIds);
  expect(all.sort()).toEqual(input.map((p) => p.id).sort());
}

describe("allocateTeams", () => {
  it("makes three teams of three with everyone exactly once", () => {
    const teams = allocateTeams(nine, 3, seededRng(1));
    expect(teams.map((t) => t.memberIds.length)).toEqual([3, 3, 3]);
    expectPartition(nine, teams);
  });

  it("gives each team one of each level for a 3/3/3 split, for many seeds", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const team of allocateTeams(nine, 3, seededRng(seed))) {
        const levels = team.memberIds.map((id) => nine.find((p) => p.id === id)!.experience).sort();
        expect(levels).toEqual(["advanced", "beginner", "intermediate"]);
      }
    }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    expect(allocateTeams(nine, 3, seededRng(42))).toEqual(allocateTeams(nine, 3, seededRng(42)));
    const distinct = new Set(Array.from({ length: 20 }, (_, s) => JSON.stringify(allocateTeams(nine, 3, seededRng(s)))));
    expect(distinct.size).toBeGreaterThan(5);
  });

  it("minimises the spread of average experience for skewed groups", () => {
    const skewed = people(["advanced", "advanced", "advanced", "advanced", "beginner", "beginner", "beginner", "beginner", "intermediate"]);
    const teams = allocateTeams(skewed, 3, seededRng(7));
    const totals = teams.map((t) => t.memberIds.reduce((s, id) => s + LEVEL_SCORE[skewed.find((p) => p.id === id)!.experience], 0));
    // 4A+4B+1I: only one team can be A+B+I, so 5/6/7 is the best achievable.
    expect(totals.sort()).toEqual([5, 6, 7]);
  });

  it("handles uneven turnout with sizes differing by at most one", () => {
    expect(teamSizes(10, 3)).toEqual([4, 3, 3]);
    expect(teamSizes(8, 3)).toEqual([3, 3, 2]);
    const ten = people([...nine.map((p) => p.experience), "advanced"]);
    const teams = allocateTeams(ten, 3, seededRng(3));
    expect(teams.map((t) => t.memberIds.length)).toEqual([4, 3, 3]);
    expectPartition(ten, teams);
  });

  const pairLevels = (input: Allocatable[], seed: number) => {
    const pair = allocateTeams(input, 3, seededRng(seed)).find((t) => t.memberIds.length === 2)!;
    return pair.memberIds.map((id) => input.find((p) => p.id === id)!.experience).sort();
  };

  it("never pairs a beginner in a team of two when advanced + intermediate is possible", () => {
    // 8 people as 3/3/2. Balance alone would happily pick advanced + beginner for the pair.
    const eight = people(["beginner", "beginner", "beginner", "intermediate", "intermediate", "intermediate", "advanced", "advanced"]);
    for (let seed = 1; seed <= 50; seed++) {
      const levels = pairLevels(eight, seed);
      expect(levels).toContain("advanced");
      expect(levels).not.toContain("beginner");
    }
  });

  it("applies the pair rule to both teams of two at 7 people", () => {
    const seven = people(["beginner", "beginner", "beginner", "intermediate", "intermediate", "advanced", "advanced"]);
    for (let seed = 1; seed <= 20; seed++) {
      const teams = allocateTeams(seven, 3, seededRng(seed));
      expect(teams.map((t) => t.memberIds.length)).toEqual([3, 2, 2]);
      for (const t of teams.filter((t) => t.memberIds.length === 2)) {
        const levels = t.memberIds.map((id) => seven.find((p) => p.id === id)!.experience).sort();
        expect(levels).toEqual(["advanced", "intermediate"]);
      }
    }
  });

  it("falls back to the strongest pair it can when the rule can't be met", () => {
    // No advanced at all: the pair should still avoid beginners.
    const noAdvanced = people(["beginner", "beginner", "beginner", "beginner", "intermediate", "intermediate", "intermediate", "intermediate"]);
    for (let seed = 1; seed <= 20; seed++) expect(pairLevels(noAdvanced, seed)).toEqual(["intermediate", "intermediate"]);
  });

  it("rejects too few or too many people", () => {
    expect(() => allocateTeams(people(["beginner", "advanced"]), 3, seededRng(1))).toThrow();
    expect(() => allocateTeams(people(Array(13).fill("beginner")), 3, seededRng(1))).toThrow();
  });
});

describe("captains", () => {
  it("are always members of their own team", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const team of allocateTeams(nine, 3, seededRng(seed))) expect(team.memberIds).toContain(team.captainId);
    }
  });

  it("are drawn uniformly regardless of experience", () => {
    const counts: Record<Level, number> = { beginner: 0, intermediate: 0, advanced: 0 };
    const runs = 3000;
    for (let seed = 0; seed < runs; seed++) {
      for (const team of allocateTeams(nine, 3, seededRng(seed))) {
        counts[nine.find((p) => p.id === team.captainId)!.experience]++;
      }
    }
    // 9000 draws, 1/3 each expected: allow ±5%.
    for (const level of Object.keys(counts) as Level[]) {
      expect(counts[level] / (runs * 3)).toBeGreaterThan(0.28);
      expect(counts[level] / (runs * 3)).toBeLessThan(0.38);
    }
  }, 20_000); // 3000 exhaustive allocations: ~5s, so the default timeout is too tight.
});
