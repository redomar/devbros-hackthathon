export const TEAM_DEFS = [
  { key: "emerald", name: "Team Emerald", symbol: "◆" },
  { key: "sapphire", name: "Team Sapphire", symbol: "●" },
  { key: "amethyst", name: "Team Amethyst", symbol: "▲" },
] as const;

export type TeamKey = (typeof TEAM_DEFS)[number]["key"];
export const TEAM_COUNT = TEAM_DEFS.length;
