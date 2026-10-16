import { describe, expect, it } from "vitest";
import { formatClock, formatCountdown, zonedTimeToEpoch } from "../shared/time";
import { DEFAULT_PRAYERS, salahStatus, validatePrayerTimes } from "../shared/salah";
import { nextSession, pauseTimer, remainingAt, resumeTimer, startTimer } from "../shared/timer";

const TZ = "Europe/London";
const DATE = "2026-10-18";

describe("time zones", () => {
  it("treats 18 Oct 2026 as BST (UTC+1)", () => {
    expect(new Date(zonedTimeToEpoch(DATE, "12:58", TZ)).toISOString()).toBe("2026-10-18T11:58:00.000Z");
  });
  it("treats December as GMT", () => {
    expect(new Date(zonedTimeToEpoch("2026-12-01", "12:00", TZ)).toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });
  it("formats clocks and countdowns", () => {
    expect(formatClock(Date.parse("2026-10-18T11:58:00Z"), TZ)).toBe("12:58");
    expect(formatCountdown(25 * 60_000)).toBe("25:00");
    expect(formatCountdown(3_725_000)).toBe("1:02:05");
    expect(formatCountdown(-5)).toBe("00:00");
  });
});

describe("salah", () => {
  const at = (hhmm: string) => zonedTimeToEpoch(DATE, hhmm, TZ);

  it("accepts the default timetable", () => expect(validatePrayerTimes(DEFAULT_PRAYERS)).toBeNull());
  it("rejects out-of-order times", () => {
    expect(validatePrayerTimes({ ...DEFAULT_PRAYERS, asr: { start: "12:00", jamaah: null } })).toMatch(/Asr/);
  });
  it("finds the next prayer before it begins", () => {
    const s = salahStatus(DEFAULT_PRAYERS, DATE, TZ, at("11:00"))!;
    expect(s.prayer).toBe("dhuhr");
    expect(s.stage).toBe("upcoming");
    expect(s.approaching).toBe(false);
  });
  it("counts to jama'ah once a prayer has begun", () => {
    const s = salahStatus(DEFAULT_PRAYERS, DATE, TZ, at("13:40"))!;
    expect(s.prayer).toBe("dhuhr");
    expect(s.stage).toBe("begun");
    expect(s.targetAt).toBe(at("13:45"));
    expect(s.approaching).toBe(true);
  });
  it("flags the 10-minute reminder", () => {
    expect(salahStatus(DEFAULT_PRAYERS, DATE, TZ, at("16:05"))!.approaching).toBe(true);
  });
  it("returns null after the last jama'ah", () => {
    expect(salahStatus(DEFAULT_PRAYERS, DATE, TZ, at("21:00"))).toBeNull();
  });
});

describe("timer", () => {
  const d = { focusMs: 25 * 60_000, breakMs: 5 * 60_000 };

  it("pauses and resumes from the exact remaining time", () => {
    const t0 = startTimer(d, 1_000);
    const paused = pauseTimer(t0, 1_000 + 60_000, "manual");
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingMs).toBe(24 * 60_000);
    expect(remainingAt(paused, 9_999_999)).toBe(24 * 60_000);
    const resumed = resumeTimer(paused, 500_000);
    expect(resumed.endsAt).toBe(500_000 + 24 * 60_000);
    expect(resumed.pausedReason).toBeNull();
  });

  it("alternates focus and break anchored to the previous end", () => {
    const t0 = startTimer(d, 0);
    const b = nextSession(t0, d, t0.endsAt!);
    expect(b).toMatchObject({ mode: "break", cycle: 1, endsAt: d.focusMs + d.breakMs });
    const f = nextSession(b, d, b.endsAt!);
    expect(f).toMatchObject({ mode: "focus", cycle: 2 });
  });
});
