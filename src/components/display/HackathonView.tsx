import type { ReactNode } from "react";
import type { PublicState } from "../../lib/useEvent";
import type { Hacking } from "../../lib/hacking";
import { formatClock, formatRelative } from "../../../shared/time";
import { PRAYER_LABEL } from "../../../shared/salah";
import { prayerStartAt } from "../../../shared/hacking";
import { HackingDial, dialMode } from "../HackingDial";
import { teamSymbol } from "../TeamCard";
import { teamStyle } from "../teamStyle";

export function HackathonView({ state, now, h }: { state: PublicState; now: number; h: Hacking }) {
  const mode = dialMode(state, h);
  return (
    <div className="flex h-full items-center gap-[3em]">
      <div className="flex h-full min-w-0 flex-[1.15] items-center justify-center">
        <div className="aspect-square h-full max-h-full max-w-full">
          <HackingDial state={state} h={h} />
        </div>
      </div>
      <aside className="flex min-w-0 flex-1 flex-col gap-[1.2em]">
        <TeamBadges teams={state.teams} />
        {mode === "break" ? (
          <Card className="ring-2 ring-[#9cc3e3]">
            <div className="font-display text-[2.2em] font-extrabold leading-tight text-[#0f5c8c]">Step away from the screen.</div>
            <div className="text-[1.15em] font-semibold text-ink-muted">Stretch, grab a drink, chat to another team.</div>
          </Card>
        ) : null}
        <PrayerCard state={state} now={now} h={h} />
        <UpNext state={state} h={h} />
        <Card className="flex items-end justify-between gap-[1em]">
          <div>
            <Eyebrow>Hacked so far</Eyebrow>
            <div className="font-display text-[2em] font-extrabold leading-none">
              {formatDuration(h.status.elapsedMs)} <span className="text-[0.6em] text-ink-muted">of {formatDuration(h.totalMs)}</span>
            </div>
          </div>
          <div className="text-right">
            <Eyebrow>{h.status.finished ? "Finished" : "Finishes"}</Eyebrow>
            <div className="tabular font-display text-[2em] font-extrabold leading-none">
              {h.status.finished ? "" : "~"}
              {formatClock(h.projection.finishAt, state.timeZone)}
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function PrayerCard({ state, now, h }: { state: PublicState; now: number; h: Hacking }) {
  const day = { prayers: state.prayers, eventDate: state.eventDate, timeZone: state.timeZone };
  const clock = (ms: number) => formatClock(ms, state.timeZone);
  const prayer = h.status.prayer;

  if (prayer) {
    const resumeBlock = h.status.block;
    return (
      <Card className="bg-gold-soft ring-2 ring-[#e8cf98]">
        <Eyebrow gold>Hacking is paused</Eyebrow>
        <div className="font-display text-[2.2em] font-extrabold leading-tight text-[#5c4214]">Time for {PRAYER_LABEL[prayer.prayer]}.</div>
        <div className="text-[1.15em] font-semibold text-[#5c4214]">
          We pick up {resumeBlock.kind === "focus" ? `Focus ${resumeBlock.number}` : "the break"} together at {clock(prayer.endsAt)}
          {h.status.blockRemainingMs > 0 ? ` with ${formatDuration(h.status.blockRemainingMs)} left` : ""}.
        </div>
      </Card>
    );
  }

  if (h.callable && !h.status.finished) {
    return (
      <Card className="bg-gold-soft ring-2 ring-gold-bright">
        <Eyebrow gold>Salah has begun</Eyebrow>
        <div className="font-display text-[2.2em] font-extrabold leading-tight">
          {PRAYER_LABEL[h.callable]} since {clock(prayerStartAt(day, h.callable))}
        </div>
        <div className="text-[1.05em] font-semibold text-[#5c4214]">
          {state.settings.prayerBreakMinutes}-minute prayer break when the organisers call it. Hacking pauses and picks up where it left off.
        </div>
      </Card>
    );
  }

  const next = h.nextPrayer;
  if (!next) return null;
  const jamaah = state.prayers[next.prayer].jamaah;
  return (
    <Card className="flex items-center justify-between gap-[1em] bg-gold-soft">
      <div>
        <Eyebrow gold>Next Salah</Eyebrow>
        <div className="font-display text-[2.2em] font-extrabold leading-none">{PRAYER_LABEL[next.prayer]}</div>
        <div className="mt-[0.3em] text-[1em] font-semibold text-[#5c4214]">
          Begins {clock(next.startAt)}
          {jamaah ? ` · Jama'ah ${jamaah}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[0.9em] font-bold text-[#7a5413]">begins in</div>
        <div className="tabular font-display text-[2em] font-bold">{formatRelative(next.startAt - now)}</div>
      </div>
    </Card>
  );
}

function UpNext({ state, h }: { state: PublicState; h: Hacking }) {
  const upcoming = h.plan.slice(h.status.blockIndex + 1, h.status.blockIndex + 4);
  if (upcoming.length === 0 || h.status.finished) return null;
  return (
    <Card>
      <Eyebrow>Up next</Eyebrow>
      <ul className="mt-[0.6em] flex flex-col gap-[0.55em]">
        {upcoming.map((b) => (
          <li key={b.startMs} className="flex items-center gap-[0.8em] text-[1.35em] font-bold">
            <span className={`size-[0.7em] shrink-0 rounded-full ${b.kind === "focus" ? "bg-primary" : "bg-[#5fa3d4]"}`} aria-hidden />
            <span className="flex-1">{b.kind === "focus" ? `Focus ${b.number}` : "Break"}</span>
            <span className="text-[0.8em] text-ink-muted">{Math.round((b.endMs - b.startMs) / 60_000)} min</span>
            <span className="tabular w-[3.4em] text-right">{formatClock(h.wallAt(b.startMs), state.timeZone)}</span>
          </li>
        ))}
      </ul>
      {h.projection.pending.length ? (
        <div className="mt-[0.7em] text-[0.9em] font-semibold text-ink-muted">Times move back {state.settings.prayerBreakMinutes} minutes after each prayer break.</div>
      ) : null}
    </Card>
  );
}

/** One row of team badges (colour + symbol + current name, including captains' renames). */
function TeamBadges({ teams }: { teams: PublicState["teams"] }) {
  if (teams.length === 0) return null;
  return (
    <div className="flex gap-[0.45em]">
      {teams.map((t) => (
        <span
          key={t.id}
          className={`flex min-w-0 flex-1 items-center justify-center gap-[0.35em] rounded-full px-[0.7em] py-[0.5em] text-white shadow-[0_10px_24px_-16px_rgb(22_42_54/0.6)] ${teamStyle(t.key).bg}`}
          title={t.name}
        >
          <span aria-hidden className="text-[0.95em]">{teamSymbol(t.key)}</span>
          <span className="min-w-0 truncate font-display text-[1.1em] font-bold tracking-tight">{t.name}</span>
        </span>
      ))}
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-[1.5em] bg-surface px-[1.6em] py-[1.3em] ring-1 ring-border ${className}`}>{children}</section>;
}

function Eyebrow({ gold, children }: { gold?: boolean; children: ReactNode }) {
  return <div className={`text-[0.85em] font-extrabold uppercase tracking-[0.14em] ${gold ? "text-[#7a5413]" : "text-ink-muted"}`}>{children}</div>;
}

/** 2h 05m, 35m */
function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
