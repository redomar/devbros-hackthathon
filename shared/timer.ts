export type TimerMode = "focus" | "break";
export type PauseReason = "manual" | "salah" | null;

export type TimerState = {
  mode: TimerMode;
  cycle: number;
  /** Remaining time while paused (or the full length before starting). */
  remainingMs: number;
  /** Absolute end on the server clock while running; null while paused. */
  endsAt: number | null;
  pausedReason: PauseReason;
};

export type Durations = { focusMs: number; breakMs: number };

export function durationOf(mode: TimerMode, d: Durations): number {
  return mode === "focus" ? d.focusMs : d.breakMs;
}

export function initialTimer(d: Durations): TimerState {
  return { mode: "focus", cycle: 1, remainingMs: d.focusMs, endsAt: null, pausedReason: null };
}

export function startTimer(d: Durations, now: number): TimerState {
  return { mode: "focus", cycle: 1, remainingMs: d.focusMs, endsAt: now + d.focusMs, pausedReason: null };
}

export function pauseTimer(t: TimerState, now: number, reason: Exclude<PauseReason, null>): TimerState {
  if (t.endsAt === null) return { ...t, pausedReason: reason };
  return { ...t, remainingMs: Math.max(0, t.endsAt - now), endsAt: null, pausedReason: reason };
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  if (t.endsAt !== null) return t;
  return { ...t, endsAt: now + t.remainingMs, pausedReason: null };
}

/** Moves to the next session, anchored at `at` (the previous end) so nothing drifts. */
export function nextSession(t: TimerState, d: Durations, at: number): TimerState {
  const mode: TimerMode = t.mode === "focus" ? "break" : "focus";
  const cycle = mode === "focus" ? t.cycle + 1 : t.cycle;
  const length = durationOf(mode, d);
  return { mode, cycle, remainingMs: length, endsAt: at + length, pausedReason: null };
}

export function remainingAt(t: TimerState, now: number): number {
  return t.endsAt === null ? t.remainingMs : Math.max(0, t.endsAt - now);
}
