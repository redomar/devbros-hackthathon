import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PublicState } from "../lib/useEvent";
import { errorMessage } from "../lib/errors";
import { PRAYERS, PRAYER_LABEL, validatePrayerTimes, type PrayerTimes } from "../../shared/salah";
import { Button, Card, Notice } from "./ui";

const input = "min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base tabular";

export function AdminSettings({ state, token }: { state: PublicState; token: string }) {
  const update = useMutation(api.flow.updateSettings);
  const [s, setS] = useState(() => ({
    expectedParticipants: String(state.settings.expectedParticipants),
    focusMinutes: String(state.settings.focusMinutes),
    breakMinutes: String(state.settings.breakMinutes),
    revealMinutes: String(state.settings.revealMinutes),
    sessionEndTime: state.settings.sessionEndTime ?? "",
  }));
  const [prayers, setPrayers] = useState<PrayerTimes>(state.prayers);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof s, label: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input
        className={input}
        inputMode={key === "sessionEndTime" ? "text" : "numeric"}
        placeholder={key === "sessionEndTime" ? "HH:mm (optional)" : undefined}
        value={s[key]}
        onChange={(e) => setS({ ...s, [key]: e.target.value })}
      />
      {hint ? <span className="font-normal text-ink-muted">{hint}</span> : null}
    </label>
  );

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-display text-xl font-bold">Settings</h2>
      <div className="grid grid-cols-2 gap-3">
        {field("expectedParticipants", "Expected brothers")}
        {field("sessionEndTime", "Hacking ends at")}
        {field("focusMinutes", "Focus (min)")}
        {field("breakMinutes", "Break (min)")}
        {field("revealMinutes", "Reveal countdown (min)", "0 = start manually")}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Salah times · {state.eventDate}</h3>
          <span className="text-xs text-ink-muted">{state.prayerSource}</span>
        </div>
        <div className="grid grid-cols-[5rem_1fr_1fr] items-center gap-2 text-sm">
          <span />
          <span className="font-semibold text-ink-muted">Begins</span>
          <span className="font-semibold text-ink-muted">Jama'ah</span>
          {PRAYERS.map((p) => (
            <Row key={p} label={PRAYER_LABEL[p]}>
              <input
                className={input}
                value={prayers[p].start}
                onChange={(e) => setPrayers({ ...prayers, [p]: { ...prayers[p], start: e.target.value } })}
                aria-label={`${PRAYER_LABEL[p]} begins`}
              />
              <input
                className={input}
                value={prayers[p].jamaah ?? ""}
                placeholder="—"
                onChange={(e) => setPrayers({ ...prayers, [p]: { ...prayers[p], jamaah: e.target.value || null } })}
                aria-label={`${PRAYER_LABEL[p]} jama'ah`}
              />
            </Row>
          ))}
        </div>
        <p className="text-xs text-ink-muted">Times are {state.timeZone}, 24-hour.</p>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Button
        busy={busy}
        onClick={async () => {
          const prayerError = validatePrayerTimes(prayers);
          if (prayerError) {
            setMessage({ tone: "error", text: prayerError });
            return;
          }
          setBusy(true);
          setMessage(null);
          try {
            await update({
              token,
              expectedParticipants: Number(s.expectedParticipants),
              focusMinutes: Number(s.focusMinutes),
              breakMinutes: Number(s.breakMinutes),
              revealMinutes: Number(s.revealMinutes),
              sessionEndTime: s.sessionEndTime.trim() || null,
              prayers,
            });
            setMessage({ tone: "success", text: "Saved. New timer lengths apply from the next session." });
          } catch (e) {
            setMessage({ tone: "error", text: errorMessage(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        Save settings
      </Button>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="font-semibold">{label}</span>
      {children}
    </>
  );
}
