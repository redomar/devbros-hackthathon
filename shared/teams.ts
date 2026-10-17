export const TEAM_DEFS = [
  { key: "emerald", name: "Team Emerald", symbol: "◆" },
  { key: "sapphire", name: "Team Sapphire", symbol: "●" },
  { key: "amethyst", name: "Team Amethyst", symbol: "▲" },
] as const;

export type TeamKey = (typeof TEAM_DEFS)[number]["key"];
export const TEAM_COUNT = TEAM_DEFS.length;

export const TEAM_NAME_MAX_LENGTH = 24;

export const defaultTeamName = (key: string) => TEAM_DEFS.find((d) => d.key === key)?.name ?? "Team";

export function tidyTeamName(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** Returns an error message, or null when a captain's chosen team name is acceptable. */
export function validateTeamName(raw: string): string | null {
  const name = tidyTeamName(raw);
  if (name.length < 2) return "Please enter a team name.";
  if (name.length > TEAM_NAME_MAX_LENGTH) return `Please keep it to ${TEAM_NAME_MAX_LENGTH} characters or fewer.`;
  if (!/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '&!?.-]*$/u.test(name)) {
    return "Letters, numbers, spaces and - ' & ! ? . only, please.";
  }
  return null;
}
