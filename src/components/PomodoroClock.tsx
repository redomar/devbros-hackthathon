import type { TimerState } from "../../shared/timer";
import { formatClock, formatCountdown } from "../../shared/time";
import { remainingAt } from "../../shared/timer";

export function PomodoroClock({
  timer,
  focusMinutes,
  breakMinutes,
  now,
  timeZone,
}: {
  timer: TimerState;
  focusMinutes: number;
  breakMinutes: number;
  now: number;
  timeZone: string;
}) {
  const total = (timer.mode === "focus" ? focusMinutes : breakMinutes) * 60_000;
  const remaining = remainingAt(timer, now);
  const progress = total > 0 ? 1 - Math.min(1, remaining / total) : 0;
  const paused = timer.endsAt === null;
  const isFocus = timer.mode === "focus";

  const r = 46;
  const circumference = 2 * Math.PI * r;
  const color = paused ? "stroke-gold-bright" : isFocus ? "stroke-primary" : "stroke-sapphire";

  return (
    <div className="relative grid aspect-square w-full max-w-[30em] place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="4" className="stroke-ink/8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={`${color} transition-[stroke-dashoffset] duration-500 ease-linear`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="relative flex flex-col items-center text-center">
        <span
          className={`rounded-full px-[0.9em] py-[0.25em] text-[1.1em] font-bold uppercase tracking-[0.14em] ${
            paused ? "bg-gold-soft text-gold" : isFocus ? "bg-primary-soft text-primary" : "bg-sapphire-soft text-sapphire"
          }`}
        >
          {paused ? (timer.pausedReason === "salah" ? "Paused for Salah" : "Paused") : isFocus ? "Focus" : "Break"}
        </span>
        <span
          className={`tabular font-display text-[7.2em] font-bold leading-none tracking-tighter ${paused ? "text-ink-muted" : ""}`}
          aria-live="off"
        >
          {formatCountdown(remaining)}
        </span>
        <span className="mt-[0.3em] text-[1.1em] font-semibold text-ink-muted">
          Round {timer.cycle}
          {timer.endsAt !== null ? ` · ${isFocus ? "Break" : "Focus"} at ${formatClock(timer.endsAt, timeZone)}` : ""}
        </span>
      </div>
    </div>
  );
}
