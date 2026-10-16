import { LEVEL_SCORE, type Level } from "./levels";
import { pickIndex, type Rng } from "./rng";

export type Allocatable = { id: string; experience: Level };
export type AllocatedTeam = { memberIds: string[]; captainId: string };

export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 12;

/** Splits n people into `teamCount` sizes that differ by at most one, largest first. */
export function teamSizes(n: number, teamCount: number): number[] {
  const base = Math.floor(n / teamCount);
  const extra = n % teamCount;
  return Array.from({ length: teamCount }, (_, i) => (i < extra ? base + 1 : base));
}

type Score = { spread: number; sameLevel: number };

function score(people: Allocatable[], assignment: number[], sizes: number[]): Score {
  const totals = sizes.map(() => 0);
  const levels = sizes.map(() => new Set<Level>());
  assignment.forEach((team, i) => {
    totals[team] += LEVEL_SCORE[people[i].experience];
    levels[team].add(people[i].experience);
  });
  const averages = totals.map((t, i) => t / sizes[i]);
  const spread = Math.max(...averages) - Math.min(...averages);
  // Secondary: prefer mixed teams over teams of the same level.
  const sameLevel = sizes.reduce((sum, size, i) => sum + (size - levels[i].size), 0);
  return { spread, sameLevel };
}

const EPSILON = 1e-9;

function compare(a: Score, b: Score): number {
  if (Math.abs(a.spread - b.spread) > EPSILON) return a.spread - b.spread;
  return a.sameLevel - b.sameLevel;
}

/**
 * Exhaustively searches every split into teams (small: 1,680 for 9 people) and picks uniformly at
 * random among the most balanced ones. Captains are then drawn uniformly from each team's members,
 * independent of experience.
 */
export function allocateTeams(people: Allocatable[], teamCount: number, rng: Rng): AllocatedTeam[] {
  if (people.length < Math.max(MIN_PARTICIPANTS, teamCount) || people.length > MAX_PARTICIPANTS) {
    throw new Error(`Need between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS} people.`);
  }
  if (new Set(people.map((p) => p.id)).size !== people.length) {
    throw new Error("Duplicate participant ids.");
  }

  const sizes = teamSizes(people.length, teamCount);
  const counts = sizes.map(() => 0);
  const assignment: number[] = [];
  let best: Score | null = null;
  let bestAssignments: number[][] = [];

  const visit = (i: number) => {
    if (i === people.length) {
      const s = score(people, assignment, sizes);
      const cmp = best === null ? -1 : compare(s, best);
      if (cmp < 0) {
        best = s;
        bestAssignments = [assignment.slice()];
      } else if (cmp === 0) {
        bestAssignments.push(assignment.slice());
      }
      return;
    }
    for (let t = 0; t < sizes.length; t++) {
      if (counts[t] === sizes[t]) continue;
      counts[t]++;
      assignment.push(t);
      visit(i + 1);
      assignment.pop();
      counts[t]--;
    }
  };
  visit(0);

  const chosen = bestAssignments[pickIndex(rng, bestAssignments.length)];
  const teams = sizes.map(() => [] as string[]);
  chosen.forEach((team, i) => teams[team].push(people[i].id));

  return teams.map((memberIds) => ({
    memberIds,
    captainId: memberIds[pickIndex(rng, memberIds.length)],
  }));
}

export function teamExperienceScore(experiences: Level[]): number {
  return experiences.reduce((sum, level) => sum + LEVEL_SCORE[level], 0);
}
