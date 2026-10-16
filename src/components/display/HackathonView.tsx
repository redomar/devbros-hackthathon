import type { PublicState } from "../../lib/useEvent";
import { formatRelative, zonedTimeToEpoch } from "../../../shared/time";
import { PomodoroClock } from "../PomodoroClock";
import { SalahPanel } from "../SalahPanel";
import { CrownIcon } from "../People";
import { membersOf, teamSymbol } from "../TeamCard";
import { teamStyle } from "../teamStyle";

export function HackathonView({ state, now }: { state: PublicState; now: number }) {
  const endsAt = state.settings.sessionEndTime
    ? zonedTimeToEpoch(state.eventDate, state.settings.sessionEndTime, state.timeZone)
    : null;
  const nearEnd = endsAt !== null && endsAt - now <= 15 * 60_000;

  return (
    <div className="grid h-full grid-cols-[1.25fr_1fr] grid-rows-[1fr_auto] gap-x-[2.4em] gap-y-[1.4em]">
      <div className="flex min-h-0 flex-col items-center justify-center gap-[1em]">
        {state.timer.pausedReason === "salah" ? (
          <div className="rounded-full bg-gold-soft px-[1.2em] py-[0.5em] text-[1.2em] font-semibold text-ink ring-1 ring-gold/40">
            Paused for Salah. We'll resume together afterwards.
          </div>
        ) : null}
        <div className="h-full max-h-[30em] min-h-0 w-full">
          <div className="mx-auto aspect-square h-full max-w-full">
            <PomodoroClock
              timer={state.timer}
              focusMinutes={state.settings.focusMinutes}
              breakMinutes={state.settings.breakMinutes}
              now={now}
              timeZone={state.timeZone}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-[1em]">
        {endsAt !== null ? (
          <div
            className={`rounded-[1.6em] px-[1.3em] py-[1em] ring-1 ${nearEnd ? "bg-gold-soft ring-gold/40" : "bg-surface ring-border"}`}
          >
            <div className="text-[0.85em] font-bold uppercase tracking-[0.14em] text-ink-muted">Hacking ends</div>
            <div className="font-display text-[2em] font-bold leading-tight">
              {state.settings.sessionEndTime}
              <span className="ml-[0.4em] text-[0.6em] font-semibold text-ink-muted">
                {endsAt > now ? `in ${formatRelative(endsAt - now)}` : "Time to wrap up"}
              </span>
            </div>
          </div>
        ) : null}
        <SalahPanel
          prayers={state.prayers}
          eventDate={state.eventDate}
          timeZone={state.timeZone}
          now={now}
          source={state.prayerSource}
        />
      </div>

      <div className="col-span-2 grid grid-cols-3 gap-[1em]">
        {state.teams.map((team) => {
          const style = teamStyle(team.key);
          return (
            <div key={team.id} className={`flex items-center gap-[0.8em] rounded-[1.2em] px-[1em] py-[0.7em] ${style.soft}`}>
              <span className={`font-display text-[1.2em] font-bold ${style.text}`}>
                {teamSymbol(team.key)} {team.name.replace("Team ", "")}
              </span>
              <span className="flex min-w-0 flex-wrap gap-x-[0.6em] text-[1.05em] font-semibold">
                {membersOf(team, state.participants).map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-[0.2em]">
                    {p.id === team.captainId ? <CrownIcon className="size-[0.9em] text-gold" /> : null}
                    {p.firstName}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
