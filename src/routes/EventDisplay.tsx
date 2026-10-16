import { useEffect, useRef } from "react";
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

  useSoundCues(state, now);

  if (!state) {
    return (
      <div className="display-root paper grid h-dvh place-items-center">
        <Spinner className="size-10 text-primary" />
      </div>
    );
  }

  return (
    <div className="display-root paper flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-[1em] px-[2.4em] pt-[1.4em] pb-[1em]">
        <Brand size="lg" />
        <div className="flex items-center gap-[1.2em]">
          {state.phase !== "hackathon" ? (
            <SalahChip prayers={state.prayers} eventDate={state.eventDate} timeZone={state.timeZone} now={now} />
          ) : null}
          <span className="rounded-full bg-ink px-[0.9em] py-[0.3em] text-[0.9em] font-bold text-page">{PHASE_LABEL[state.phase]}</span>
          <span className="tabular font-display text-[1.8em] font-bold">{formatClock(now, state.timeZone)}</span>
          <ConnectionDot />
        </div>
      </header>
      <main className="min-h-0 flex-1 px-[2.4em] pb-[1.8em]">
        {state.phase === "setup" ? <ArrivalsView state={state} /> : null}
        {state.phase === "team_reveal" ? <TeamRevealView state={state} now={now} live={revealLive} /> : null}
        {state.phase === "hackathon" ? <HackathonView state={state} now={now} /> : null}
        {state.phase === "voting" ? <VotingView state={state} /> : null}
        {state.phase === "results_pending" ? <ResultsPendingView state={state} /> : null}
        {state.phase === "results" ? <ResultsView state={state} live={resultsLive} /> : null}
      </main>
      <OrganiserTray state={state} now={now} />
    </div>
  );
}

/** Chimes on focus/break changes and when a Salah reminder first appears. Silent unless enabled. */
function useSoundCues(state: PublicState | undefined, now: number) {
  const session = state ? `${state.phase}:${state.timer.mode}:${state.timer.cycle}` : null;
  const lastSession = useRef(session);
  useEffect(() => {
    if (session && lastSession.current && session !== lastSession.current && state?.phase === "hackathon") {
      playChime(state.timer.mode === "focus" ? "focus" : "break");
    }
    lastSession.current = session;
  }, [session, state]);

  const status = state ? salahStatus(state.prayers, state.eventDate, state.timeZone, now) : null;
  const reminderKey = status?.approaching ? `${status.prayer}:${status.stage}` : null;
  const lastReminder = useRef(reminderKey);
  useEffect(() => {
    if (reminderKey && reminderKey !== lastReminder.current) playChime("salah");
    lastReminder.current = reminderKey;
  }, [reminderKey]);
}
