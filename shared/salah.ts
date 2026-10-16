import { HHMM, zonedTimeToEpoch } from "./time";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];
export type PrayerTime = { start: string; jamaah: string | null };
export type PrayerTimes = Record<Prayer, PrayerTime>;

export const PRAYER_LABEL: Record<Prayer, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

/** Birmingham Central Mosque published timetable for Sunday 18 October 2026 (centralmosque.org.uk/timetable). */
export const DEFAULT_PRAYERS: PrayerTimes = {
  fajr: { start: "06:11", jamaah: "06:30" },
  dhuhr: { start: "12:58", jamaah: "13:45" },
  asr: { start: "16:14", jamaah: "16:45" },
  maghrib: { start: "18:06", jamaah: "18:09" },
  isha: { start: "19:32", jamaah: "20:00" },
};
export const DEFAULT_PRAYER_SOURCE = "Birmingham Central Mosque";
export const DEFAULT_EVENT_DATE = "2026-10-18";
export const DEFAULT_TIME_ZONE = "Europe/London";

export function validatePrayerTimes(prayers: PrayerTimes): string | null {
  let previous = "";
  for (const prayer of PRAYERS) {
    const { start, jamaah } = prayers[prayer];
    const label = PRAYER_LABEL[prayer];
    if (!HHMM.test(start)) return `${label} start must be HH:mm (24-hour).`;
    if (jamaah !== null && !HHMM.test(jamaah)) return `${label} jama'ah must be HH:mm (24-hour).`;
    if (start <= previous) return `${label} must start after the previous prayer.`;
    if (jamaah !== null && jamaah < start) return `${label} jama'ah cannot be before it begins.`;
    previous = start;
  }
  return null;
}

export type SalahStatus = {
  prayer: Prayer;
  startAt: number;
  jamaahAt: number | null;
  /** upcoming: before it begins. begun: begun, jama'ah still to come. */
  stage: "upcoming" | "begun";
  /** The moment the countdown is counting to. */
  targetAt: number;
  approaching: boolean;
};

export function salahStatus(
  prayers: PrayerTimes,
  dateIso: string,
  timeZone: string,
  now: number,
  reminderMs = 10 * 60_000,
): SalahStatus | null {
  for (const prayer of PRAYERS) {
    const { start, jamaah } = prayers[prayer];
    const startAt = zonedTimeToEpoch(dateIso, start, timeZone);
    const jamaahAt = jamaah ? zonedTimeToEpoch(dateIso, jamaah, timeZone) : null;
    if (now < startAt) {
      return { prayer, startAt, jamaahAt, stage: "upcoming", targetAt: startAt, approaching: startAt - now <= reminderMs };
    }
    if (jamaahAt !== null && now < jamaahAt) {
      return { prayer, startAt, jamaahAt, stage: "begun", targetAt: jamaahAt, approaching: jamaahAt - now <= reminderMs };
    }
  }
  return null;
}
