import type { PublicState } from "./useEvent";
import {
  buildPlan,
  callablePrayer,
  focusCount,
  hackStatus,
  nextPrayer,
  projectFinish,
  wallTimeAt,
  type PrayerDay,
} from "../../shared/hacking";

/** Everything the screens need to know about the hacking clock right now. */
export function hacking(state: PublicState, now: number) {
  const totalMs = state.settings.hackingMinutes * 60_000;
  const prayerMs = state.settings.prayerBreakMinutes * 60_000;
  const plan = buildPlan({
    totalMs,
    focusMs: state.settings.focusMinutes * 60_000,
    breakMs: state.settings.breakMinutes * 60_000,
  });
  const day: PrayerDay = { prayers: state.prayers, eventDate: state.eventDate, timeZone: state.timeZone };
  const status = hackStatus(state.clock, plan, now, totalMs);
  const projection = projectFinish(state.clock, status, totalMs, prayerMs, day, now);
  return {
    plan,
    totalMs,
    prayerMs,
    focusBlocks: focusCount(plan),
    status,
    projection,
    callable: callablePrayer(state.clock, day, now),
    nextPrayer: nextPrayer(day, now),
    /** Wall-clock start of a block, assuming no further pauses. */
    wallAt: (hackMs: number) => wallTimeAt(status, hackMs, now),
  };
}

export type Hacking = ReturnType<typeof hacking>;
