import type { PublicTeam } from "./useEvent";

export type RankedTeam = PublicTeam & { votes: number; rank: number };

/** Standard competition ranking (1, 1, 3) by votes. */
export function rankTeams(teams: PublicTeam[]): RankedTeam[] {
  const sorted = teams.map((t) => ({ ...t, votes: t.votes ?? 0 })).sort((a, b) => b.votes - a.votes);
  return sorted.map((t) => ({ ...t, rank: sorted.findIndex((s) => s.votes === t.votes) + 1 }));
}

export function winnersOf(ranked: RankedTeam[]): RankedTeam[] {
  if (ranked.length === 0 || ranked[0].votes === 0) return [];
  return ranked.filter((t) => t.rank === 1);
}
