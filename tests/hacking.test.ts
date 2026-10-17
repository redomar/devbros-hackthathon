import { describe, expect, it } from "vitest";
import { zonedTimeToEpoch } from "../shared/time";
import { DEFAULT_PRAYERS } from "../shared/salah";
import {
  beginPrayerBreak,
  buildPlan,
  callablePrayer,
  elapsedMs,
  hackStatus,
  pauseClock,
  projectFinish,
  resumeClock,
  seekClock,
  startClock,
  type PrayerDay,
} from "../shared/hacking";

const MIN = 60_000;
const TOTAL = 270 * MIN;
const PRAYER = 10 * MIN;
const day: PrayerDay = { prayers: DEFAULT_PRAYERS, eventDate: "2026-10-18", timeZone: "Europe/London" };
const at = (hhmm: string) => zonedTimeToEpoch(day.eventDate, hhmm, day.timeZone);
const plan = buildPlan({ totalMs: TOTAL, focusMs: 50 * MIN, breakMs: 10 * MIN });

describe("hacking plan", () => {
  it("is four rounds of 50/10, then a final 30-minute focus", () => {
    expect(plan.map((b) => `${b.kind[0]}${(b.endMs - b.startMs) / MIN}`)).toEqual([
      "f50", "b10", "f50", "b10", "f50", "b10", "f50", "b10", "f30",
    ]);
    expect(plan.at(-1)!.endMs).toBe(TOTAL);
    expect(plan.filter((b) => b.kind === "focus").map((b) => b.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("never ends on a break", () => {
    const p = buildPlan({ totalMs: 115 * MIN, focusMs: 50 * MIN, breakMs: 10 * MIN });
    expect(p.at(-1)).toMatchObject({ kind: "focus", startMs: 60 * MIN, endMs: 115 * MIN });
    expect(p.map((b) => b.kind)).toEqual(["focus", "break", "focus"]);
  });
});

describe("hacking clock", () => {
  it("counts hacking time only, not prayer breaks or pauses", () => {
    let c = startClock(at("12:30"));
    expect(elapsedMs(c, at("13:08"), TOTAL)).toBe(38 * MIN);
    c = beginPrayerBreak(c, "dhuhr", at("13:08"), PRAYER, TOTAL);
    expect(c.prayersTaken).toEqual([{ prayer: "dhuhr", atMs: 38 * MIN }]);
    expect(elapsedMs(c, at("13:15"), TOTAL)).toBe(38 * MIN);
    c = resumeClock(c, c.prayer!.endsAt);
    expect(c.prayer).toBeNull();
    expect(elapsedMs(c, at("13:30"), TOTAL)).toBe(50 * MIN);
    c = pauseClock(c, at("13:30"), TOTAL, "manual");
    expect(elapsedMs(c, at("14:00"), TOTAL)).toBe(50 * MIN);
  });

  it("stops at the full hacking time", () => {
    const c = startClock(at("12:30"));
    const s = hackStatus(c, plan, at("18:00"), TOTAL);
    expect(s.finished).toBe(true);
    expect(s.elapsedMs).toBe(TOTAL);
    expect(s.blockRemainingMs).toBe(0);
  });

  it("reports the block, what's left of it and what's next", () => {
    const c = startClock(at("12:30"));
    const s = hackStatus(c, plan, at("13:25"), TOTAL);
    expect(s.block).toMatchObject({ kind: "break", number: 1 });
    expect(s.blockRemainingMs).toBe(5 * MIN);
    expect(s.next).toMatchObject({ kind: "focus", number: 2 });
  });

  it("skips and restarts blocks by moving hacking time", () => {
    const c = startClock(at("12:30"));
    const skipped = seekClock(c, at("12:40"), 50 * MIN);
    expect(elapsedMs(skipped, at("12:40"), TOTAL)).toBe(50 * MIN);
    expect(skipped.runningSince).toBe(at("12:40"));
  });
});

describe("prayer breaks", () => {
  it("are callable once the prayer begins, once each", () => {
    const c = startClock(at("12:30"));
    expect(callablePrayer(c, day, at("12:45"))).toBeNull();
    expect(callablePrayer(c, day, at("12:58"))).toBe("dhuhr");
    const taken = resumeClock(beginPrayerBreak(c, "dhuhr", at("13:00"), PRAYER, TOTAL), at("13:10"));
    expect(callablePrayer(taken, day, at("14:00"))).toBeNull();
    expect(callablePrayer(taken, day, at("16:14"))).toBe("asr");
  });

  it("never offers Fajr during a midday session", () => {
    expect(callablePrayer(startClock(at("12:00")), day, at("12:30"))).toBeNull();
  });

  it("projects a 17:20 finish from a 12:30 start with Dhuhr and Asr to come", () => {
    const c = startClock(at("12:30"));
    const s = hackStatus(c, plan, at("12:30"), TOTAL);
    const p = projectFinish(c, s, TOTAL, PRAYER, day, at("12:30"));
    expect(p.finishAt).toBe(at("17:20"));
    expect(p.pending.map((x) => x.prayer)).toEqual(["dhuhr", "asr"]);
  });

  it("keeps the 17:20 finish when Dhuhr is taken late", () => {
    let c = startClock(at("12:30"));
    c = beginPrayerBreak(c, "dhuhr", at("13:30"), PRAYER, TOTAL);
    const now = at("13:35");
    const p = projectFinish(c, hackStatus(c, plan, now, TOTAL), TOTAL, PRAYER, day, now);
    expect(p.finishAt).toBe(at("17:20"));
    expect(p.pending.map((x) => x.prayer)).toEqual(["asr"]);
  });
});
