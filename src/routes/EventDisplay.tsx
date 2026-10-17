import { useEffect, useRef, useState } from "react";
import { useEventState, type PublicState } from "../lib/useEvent";
import { useNow } from "../lib/clock";
import { useLiveTransition } from "../lib/usePhaseTransition";
import { playChime, unlockAudio } from "../lib/sound";
import { formatClock } from "../../shared/time";
import { salahStatus } from "../../shared/salah";
import { Brand } from "../components/Brand";
import { ConnectionDot } from "../components/Connection";
import { SalahChip } from "../components/SalahPanel";
import { Spinner } from "../components/ui";
import { ArrivalsView } from "../components/display/ArrivalsView";
import { TeamRevealView } from "../components/display/TeamRevealView";
import { HackathonView } from "../components/display/HackathonView";
import { VotingView } from "../components/display/VotingView";
import { ResultsPendingView, ResultsView } from "../components/display/ResultsViews";
import { OrganiserTray } from "../components/display/OrganiserTray";
import { VersionTag } from "../components/VersionTag";
import { dialMode, type DialMode } from "../components/HackingDial";
import { hacking } from "../lib/hacking";
import { teamSymbol } from "../components/TeamCard";
import { teamStyle } from "../components/teamStyle";

// The whole screen takes on the current mode during hacking, so it reads from the back of the room.
const MODE_BG: Record<DialMode, string> = {
  focus: "bg-[#eef5f0]",
  break: "bg-[#e8f1f9]",
  prayer: "bg-[#fbf3e2]",
  paused: "",
  finished: "",
};

const PHASE_LABEL: Record<PublicState["phase"], string> = {
  setup: "Check-in",
  team_reveal: "Teams",
  hackathon: "Hacking",
  voting: "Voting",
  results_pending: "Results",
  results: "Results",
};

export function EventDisplay() {
  const state = useEventState();
  const now = useNow(250);
  const revealLive = useLiveTransition(state?.phase, "team_reveal");
  const resultsLive = useLiveTransition(state?.phase, "results");

  useEffect(() => {
    // Safari only allows audio after a gesture; any tap on the display re-arms it after a reload.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const h = state?.phase === "hackathon" ? hacking(state, now) : null;
  const mode = state && h ? dialMode(state, h) : null;
  const renamed = useRenameAnnouncement(state?.teams);
  useSoundCues(state, now, h ? `${h.status.blockIndex}:${h.status.prayer?.prayer ?? ""}:${h.status.finished}` : null, mode);

  if (!state) {
    return (
      <div className="display-root paper grid h-dvh place-items-center">
        <Spinner className="size-10 text-primary" />
      </div>
    );
  }

  return (
    <div className={`display-root paper flex h-dvh w-full flex-col overflow-hidden transition-colors duration-700 ${mode ? MODE_BG[mode] : ""}`}>
      <header className="flex items-center justify-between gap-[1em] px-[2.4em] pt-[1.4em] pb-[1em]">
        <Brand size="lg" />
        <div className="flex items-center gap-[1.2em]">
          {state.phase !== "hackathon" ? (
            <SalahChip prayers={state.prayers} eventDate={state.eventDate} timeZone={state.timeZone} now={now} />
          ) : null}
          <span className={`rounded-full px-[0.9em] py-[0.3em] text-[0.9em] font-bold ${mode === "prayer" ? "bg-gold text-white" : "bg-ink text-page"}`}>
            {mode === "prayer" ? "Salah" : PHASE_LABEL[state.phase]}
          </span>
          <span className="tabular font-display text-[1.8em] font-bold">{formatClock(now, state.timeZone)}</span>
          <ConnectionDot />
        </div>
      </header>
      <main className="min-h-0 flex-1 px-[2.4em] pb-[1.8em]">
        {state.phase === "setup" ? <ArrivalsView state={state} /> : null}
        {state.phase === "team_reveal" ? <TeamRevealView state={state} now={now} live={revealLive} /> : null}
        {state.phase === "hackathon" && h ? <HackathonView state={state} now={now} h={h} /> : null}
        {state.phase === "voting" ? <VotingView state={state} /> : null}
        {state.phase === "results_pending" ? <ResultsPendingView state={state} /> : null}
        {state.phase === "results" ? <ResultsView state={state} live={resultsLive} /> : null}
      </main>
      {renamed ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-[5.5em] z-30 flex justify-center"
        >
          <div className={`flex items-center gap-[0.6em] rounded-full px-[1.4em] py-[0.6em] text-[2em] font-bold text-white shadow-[0_18px_40px_-18px_rgb(22_42_54/0.6)] ${teamStyle(renamed.key).bg}`}>
            <span aria-hidden>{teamSymbol(renamed.key)}</span>
            <span className="font-semibold opacity-85">{renamed.from} is now</span>
            <span className="font-display text-[1.25em]">{renamed.to}</span>
          </div>
        </div>
      ) : null}
      <VersionTag className="pointer-events-auto fixed bottom-2 left-3 z-40" />
      <OrganiserTray state={state} now={now} />
    </div>
  );
}

/** When a team is renamed while the screen is watching, announce it for a few seconds. */
function useRenameAnnouncement(teams: PublicState["teams"] | undefined) {
  const names = useRef<Map<string, string> | null>(null);
  const [notice, setNotice] = useState<{ key: string; from: string; to: string } | null>(null);
  useEffect(() => {
    if (!teams) return;
    const prev = names.current;
    names.current = new Map(teams.map((t) => [t.id, t.name]));
    const changed = prev ? teams.find((t) => prev.has(t.id) && prev.get(t.id) !== t.name) : undefined;
    if (changed) setNotice({ key: changed.key, from: prev!.get(changed.id)!, to: changed.name });
  }, [teams]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(id);
  }, [notice]);
  return notice;
}

/** Chimes on block and prayer-break changes and when a Salah reminder first appears. Silent unless enabled. */
function useSoundCues(state: PublicState | undefined, now: number, session: string | null, mode: DialMode | null) {
  const lastSession = useRef(session);
  useEffect(() => {
    if (session && lastSession.current && session !== lastSession.current && mode) {
      playChime(mode === "prayer" ? "salah" : mode === "break" ? "break" : "focus");
    }
    lastSession.current = session;
  }, [session, mode]);

  const status = state ? salahStatus(state.prayers, state.eventDate, state.timeZone, now) : null;
  const reminderKey = status?.approaching ? `${status.prayer}:${status.stage}` : null;
  const lastReminder = useRef(reminderKey);
  useEffect(() => {
    if (reminderKey && reminderKey !== lastReminder.current) playChime("salah");
    lastReminder.current = reminderKey;
  }, [reminderKey]);
}
