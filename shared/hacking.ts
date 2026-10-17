import { PRAYERS, type Prayer, type PrayerTimes } from "./salah";
import { zonedTimeToEpoch } from "./time";

/**
 * The hacking clock counts hacking time, not wall-clock time. Prayer breaks (and manual pauses)
 * stop it, so the session always gets its full length and every block shifts back automatically.
 */
export type PauseReason = "manual" | "prayer" | null;
export type ActivePrayer = { prayer: Prayer; endsAt: number };
export type TakenPrayer = { prayer: Prayer; atMs: number };

export type HackClock = {
  /** Hacking time completed before the current run, in ms. */
  doneMs: number;
  /** Server time the current run started; null while paused. */
  runningSince: number | null;
  pausedReason: PauseReason;
  /** The prayer break in progress, if any. Hacking is paused while it runs. */
  prayer: ActivePrayer | null;
  /** Prayer breaks already taken, with the hacking time they happened at. */
  prayersTaken: TakenPrayer[];
};

export type PlanSettings = { totalMs: number; focusMs: number; breakMs: number };
export type Block = { kind: "focus" | "break"; /** Focus block number; a break shares the number of the focus before it. */ number: number; startMs: number; endMs: number };

/** Focus/break blocks filling `totalMs` of hacking. Never ends on a break; a short tail joins the last focus. */
export function buildPlan({ totalMs, focusMs, breakMs }: PlanSettings): Block[] {
  const blocks: Block[] = [];
  let t = 0;
  let n = 0;
  while (t < totalMs) {
    n++;
    const end = Math.min(totalMs, t + focusMs);
    blocks.push({ kind: "focus", number: n, startMs: t, endMs: end });
    t = end;
    if (t >= totalMs) break;
    if (totalMs - t <= breakMs) {
      blocks[blocks.length - 1].endMs = totalMs;
      break;
    }
    blocks.push({ kind: "break", number: n, startMs: t, endMs: t + breakMs });
    t += breakMs;
  }
  return blocks;
}

export const focusCount = (plan: Block[]) => plan.filter((b) => b.kind === "focus").length;

export function initialClock(): HackClock {
  return { doneMs: 0, runningSince: null, pausedReason: null, prayer: null, prayersTaken: [] };
}

export function startClock(now: number): HackClock {
  return { ...initialClock(), runningSince: now };
}

export function elapsedMs(c: HackClock, now: number, totalMs: number): number {
  const run = c.runningSince === null ? 0 : Math.max(0, now - c.runningSince);
  return Math.min(totalMs, c.doneMs + run);
}

export function pauseClock(c: HackClock, now: number, totalMs: number, reason: Exclude<PauseReason, null>): HackClock {
  return { ...c, doneMs: elapsedMs(c, now, totalMs), runningSince: null, pausedReason: reason };
}

/** Resumes hacking (also ends any prayer break). */
export function resumeClock(c: HackClock, now: number): HackClock {
  if (c.runningSince !== null && c.prayer === null) return c;
  return { ...c, runningSince: now, pausedReason: null, prayer: null };
}

export function beginPrayerBreak(c: HackClock, prayer: Prayer, now: number, prayerMs: number, totalMs: number): HackClock {
  const paused = pauseClock(c, now, totalMs, "prayer");
  return {
    ...paused,
    prayer: { prayer, endsAt: now + prayerMs },
    prayersTaken: [...c.prayersTaken, { prayer, atMs: paused.doneMs }],
  };
}

/** Jumps the hacking clock to `ms`, keeping it running or paused. */
export function seekClock(c: HackClock, now: number, ms: number): HackClock {
  return { ...c, doneMs: ms, runningSince: c.runningSince === null ? null : now };
}

export type HackStatus = {
  elapsedMs: number;
  finished: boolean;
  running: boolean;
  block: Block;
  blockIndex: number;
  blockRemainingMs: number;
  next: Block | null;
  prayer: ActivePrayer | null;
  prayerRemainingMs: number;
};

export function hackStatus(c: HackClock, plan: Block[], now: number, totalMs: number): HackStatus {
  const elapsed = elapsedMs(c, now, totalMs);
  const finished = elapsed >= totalMs;
  let blockIndex = plan.findIndex((b) => elapsed < b.endMs);
  if (blockIndex === -1) blockIndex = plan.length - 1;
  const block = plan[blockIndex];
  return {
    elapsedMs: elapsed,
    finished,
    running: c.runningSince !== null && !finished,
    block,
    blockIndex,
    blockRemainingMs: Math.max(0, block.endMs - elapsed),
    next: plan[blockIndex + 1] ?? null,
    prayer: c.prayer,
    prayerRemainingMs: c.prayer ? Math.max(0, c.prayer.endsAt - now) : 0,
  };
}

/** Wall-clock time hacking reaches `hackMs`, assuming no further pauses or prayer breaks. */
export function wallTimeAt(s: HackStatus, hackMs: number, now: number): number {
  return now + s.prayerRemainingMs + Math.max(0, hackMs - s.elapsedMs);
}

// ---------- prayer windows ----------

export type PrayerDay = { prayers: PrayerTimes; eventDate: string; timeZone: string };

// Fajr's window ends at sunrise, which isn't in the timetable; this keeps it out of a midday session.
const FAJR_WINDOW_MS = 90 * 60_000;

export function prayerStartAt(day: PrayerDay, prayer: Prayer): number {
  return zonedTimeToEpoch(day.eventDate, day.prayers[prayer].start, day.timeZone);
}

function prayerWindowEnd(day: PrayerDay, prayer: Prayer): number {
  const i = PRAYERS.indexOf(prayer);
  if (prayer === "fajr") return prayerStartAt(day, prayer) + FAJR_WINDOW_MS;
  return i + 1 < PRAYERS.length ? prayerStartAt(day, PRAYERS[i + 1]) : prayerStartAt(day, prayer) + 6 * 3_600_000;
}

/** The prayer whose time is in now, if any. */
export function currentPrayer(day: PrayerDay, now: number): Prayer | null {
  for (const p of PRAYERS) {
    if (now >= prayerStartAt(day, p) && now < prayerWindowEnd(day, p)) return p;
  }
  return null;
}

export function nextPrayer(day: PrayerDay, now: number): { prayer: Prayer; startAt: number } | null {
  for (const p of PRAYERS) {
    const startAt = prayerStartAt(day, p);
    if (startAt > now) return { prayer: p, startAt };
  }
  return null;
}

/** The prayer an organiser can start a break for right now, if any. */
export function callablePrayer(c: HackClock, day: PrayerDay, now: number): Prayer | null {
  if (c.prayer) return null;
  const p = currentPrayer(day, now);
  return p && !c.prayersTaken.some((t) => t.prayer === p) ? p : null;
}

export type Projection = {
  finishAt: number;
  /** Prayers expected before the finish that haven't had a break yet, with where they land on the hacking clock. */
  pending: { prayer: Prayer; startAt: number; atMs: number }[];
};

/** When hacking will finish, counting a prayer break for every prayer still to come before then. */
export function projectFinish(c: HackClock, s: HackStatus, totalMs: number, prayerMs: number, day: PrayerDay, now: number): Projection {
  const taken = new Set(c.prayersTaken.map((t) => t.prayer));
  const base = wallTimeAt(s, totalMs, now);
  let pending: Projection["pending"] = [];
  let finishAt = base;
  for (let changed = true; changed; ) {
    changed = false;
    const next = PRAYERS.filter(
      (p) => !taken.has(p) && prayerStartAt(day, p) <= finishAt && prayerWindowEnd(day, p) > now,
    );
    if (next.length !== pending.length) {
      changed = true;
      finishAt = base + next.length * prayerMs;
      pending = next.map((p, i) => {
        const startAt = prayerStartAt(day, p);
        // Hacking time at which the prayer falls, allowing for earlier pending breaks.
        const wait = Math.max(0, startAt - now - s.prayerRemainingMs - i * prayerMs);
        return { prayer: p, startAt, atMs: Math.min(totalMs, s.elapsedMs + (s.running ? wait : 0)) };
      });
    }
  }
  return { finishAt, pending };
}
