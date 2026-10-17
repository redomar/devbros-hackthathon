import { forwardRef } from "react";
import type { PublicParticipant, PublicTeam } from "../lib/useEvent";
import { teamExperienceScore } from "../../shared/fairness";
import { TEAM_DEFS } from "../../shared/teams";
import { CrownIcon, Initials, LevelPill } from "./People";
import { teamStyle } from "./teamStyle";

export function teamSymbol(key: string) {
  return TEAM_DEFS.find((d) => d.key === key)?.symbol ?? "◆";
}

export function membersOf(team: PublicTeam, people: PublicParticipant[]) {
  const byId = new Map(people.map((p) => [p.id, p]));
  return team.memberIds.map((id) => byId.get(id)).filter((p): p is PublicParticipant => Boolean(p));
}

/**
 * - shuffle: card shell with dashed slots; member rows are floating chips (moved by the shuffle animation),
 *   untinted, no captain, no score.
 * - settled: rows home and tinted, score shown, captain not yet revealed.
 * - final: the finished card, captain highlighted and crowned.
 */
export type TeamCardStage = "shuffle" | "settled" | "final";

/** Large card for the projected screen. Font sizes are em-based so it scales with the display. */
export const TeamCard = forwardRef<
  HTMLDivElement,
  { team: PublicTeam; participants: PublicParticipant[]; showScore?: boolean; className?: string; stage?: TeamCardStage }
>(function TeamCard({ team, participants, showScore = true, className = "", stage = "final" }, ref) {
  const style = teamStyle(team.key);
  const members = membersOf(team, participants);
  const shuffling = stage === "shuffle";
  const score = teamExperienceScore(members.map((m) => m.experience));
  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-[1.6em] bg-surface shadow-[0_24px_50px_-30px_rgb(22_42_54/0.45)] ring-1 ring-border ${stage === "final" ? "overflow-hidden" : ""} ${className}`}
    >
      <div className={`flex items-center gap-[0.5em] rounded-t-[1.6em] px-[1.2em] py-[0.9em] text-white ${style.bg}`}>
        <span aria-hidden className="text-[1.3em]">
          {teamSymbol(team.key)}
        </span>
        <span className="min-w-0 truncate font-display text-[1.6em] font-bold tracking-tight" title={team.name}>{team.name}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-[0.7em] p-[1.1em]">
        {members.map((p) => {
          const captain = stage === "final" && p.id === team.captainId;
          return (
            <li key={p.id} data-member={p.id} className="relative">
              {shuffling ? (
                <div aria-hidden className="absolute inset-0 rounded-[1em] border-2 border-dashed border-border" />
              ) : null}
              <div
                data-token
                data-captain={captain || undefined}
                className={`relative z-20 flex items-center gap-[0.7em] rounded-[1em] p-[0.5em] transition-[background-color,box-shadow] duration-500 ${
                  captain
                    ? "bg-gold-soft ring-1 ring-gold/30"
                    : shuffling
                      ? "bg-surface shadow-[0_14px_28px_-12px_rgb(22_42_54/0.5)] ring-1 ring-border"
                      : "bg-surface"
                }`}
              >
                <Initials
                  name={p.firstName}
                  className="size-[2.6em] text-[1em] transition-colors duration-500"
                  tone={shuffling ? "bg-ink/5 text-ink-muted" : `${style.soft} ${style.text}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[0.4em]">
                    <span className="truncate font-display text-[1.35em] font-semibold">{p.firstName}</span>
                    {p.isTest ? <span className="rounded bg-ink/10 px-1 text-[0.6em] font-bold">TEST</span> : null}
                  </div>
                  <LevelPill level={p.experience} />
                </div>
                {captain ? (
                  <span data-crown className="flex items-center gap-[0.3em] text-[0.85em] font-bold text-gold">
                    <CrownIcon className="size-[1.4em]" />
                    Captain
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {showScore ? (
        <div
          className={`border-t border-border px-[1.2em] py-[0.6em] text-[0.85em] font-semibold text-ink-muted transition-opacity duration-700 ${shuffling ? "opacity-0" : "opacity-100"}`}
        >
          Experience mix: {score} pts{members.length ? ` · avg ${(score / members.length).toFixed(1)}` : ""}
        </div>
      ) : null}
    </div>
  );
});
