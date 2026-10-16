import { PRAYERS, PRAYER_LABEL, salahStatus, type PrayerTimes } from "../../shared/salah";
import { formatClock, formatRelative } from "../../shared/time";

type Props = { prayers: PrayerTimes; eventDate: string; timeZone: string; now: number; source: string };

export function useSalah({ prayers, eventDate, timeZone, now }: Omit<Props, "source">) {
  return salahStatus(prayers, eventDate, timeZone, now);
}

export function SalahPanel({ prayers, eventDate, timeZone, now, source }: Props) {
  const status = useSalah({ prayers, eventDate, timeZone, now });
  const label = status ? PRAYER_LABEL[status.prayer] : null;

  return (
    <section
      aria-label="Salah times"
      className={`flex flex-col gap-[0.9em] rounded-[1.6em] p-[1.3em] ring-1 ${
        status?.approaching ? "bg-gold-soft ring-gold/40" : "bg-surface ring-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-[0.6em]">
        <h2 className="text-[0.85em] font-bold uppercase tracking-[0.14em] text-ink-muted">Salah</h2>
        <span className="text-[0.75em] text-ink-muted">{source}</span>
      </div>

      <div className="min-h-[4.6em]">
        {status ? (
          <>
            <div className="text-[0.95em] font-semibold text-ink-muted">
              {status.stage === "upcoming" ? "Next prayer" : `${label} has begun`}
            </div>
            <div className="flex items-baseline gap-[0.4em]">
              <span className="font-display text-[2.4em] font-bold leading-tight tracking-tight">
                {status.stage === "upcoming" ? label : "Jama'ah"}
              </span>
              <span className="tabular text-[1.4em] font-semibold text-primary">in {formatRelative(status.targetAt - now)}</span>
            </div>
            {status.approaching ? (
              <div className="mt-[0.2em] text-[0.95em] font-bold text-gold">
                {status.stage === "upcoming" ? `${label} is approaching` : "Jama'ah is approaching"}
              </div>
            ) : null}
          </>
        ) : (
          <div className="font-display text-[1.6em] font-semibold">All prayers prayed today</div>
        )}
      </div>

      <table className="w-full text-[1em]">
        <thead>
          <tr className="text-left text-[0.75em] uppercase tracking-wider text-ink-muted">
            <th className="pb-[0.3em] font-semibold">Prayer</th>
            <th className="pb-[0.3em] text-right font-semibold">Begins</th>
            <th className="pb-[0.3em] text-right font-semibold">Jama'ah</th>
          </tr>
        </thead>
        <tbody>
          {PRAYERS.map((p) => {
            const isNext = status?.prayer === p;
            return (
              <tr key={p} className={isNext ? "font-bold text-primary" : ""}>
                <td className="py-[0.15em]">{PRAYER_LABEL[p]}</td>
                <td className="tabular py-[0.15em] text-right">{prayers[p].start}</td>
                <td className="tabular py-[0.15em] text-right">{prayers[p].jamaah ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sr-only">Current time {formatClock(now, timeZone)}</div>
    </section>
  );
}

/** One-line chip for screens where the full panel would be too much. */
export function SalahChip({ prayers, eventDate, timeZone, now }: Omit<Props, "source">) {
  const status = useSalah({ prayers, eventDate, timeZone, now });
  if (!status) return null;
  const label = PRAYER_LABEL[status.prayer];
  return (
    <span
      className={`inline-flex items-center gap-[0.5em] rounded-full px-[0.9em] py-[0.35em] text-[0.9em] font-semibold ring-1 ${
        status.approaching ? "bg-gold-soft text-ink ring-gold/40" : "bg-surface text-ink-muted ring-border"
      }`}
    >
      <span aria-hidden>☾</span>
      {status.stage === "upcoming"
        ? `${label} ${formatClock(status.startAt, timeZone)} · in ${formatRelative(status.targetAt - now)}`
        : `${label} jama'ah ${formatClock(status.targetAt, timeZone)} · in ${formatRelative(status.targetAt - now)}`}
    </span>
  );
}
