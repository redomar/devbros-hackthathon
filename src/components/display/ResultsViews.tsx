import { useEffect, useRef, useState } from "react";
import { animate, createTimeline, stagger } from "animejs";
import type { PublicState } from "../../lib/useEvent";
import { rankTeams, winnersOf, type RankedTeam } from "../../lib/results";
import { prefersReducedMotion } from "../../lib/motion";
import { playChime } from "../../lib/sound";
import { CrownIcon } from "../People";
import { membersOf, teamSymbol } from "../TeamCard";
import { teamStyle } from "../teamStyle";
import { Confetti } from "./Confetti";

function Trophy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M18 8h28v14a14 14 0 0 1-28 0V8z" className="fill-gold-bright" />
      <path d="M18 12H9v4a10 10 0 0 0 10 10M46 12h9v4a10 10 0 0 1-10 10" fill="none" className="stroke-gold" strokeWidth="4" />
      <rect x="28" y="36" width="8" height="10" className="fill-gold" />
      <rect x="20" y="46" width="24" height="8" rx="2" className="fill-primary" />
    </svg>
  );
}

export function ResultsPendingView({ state }: { state: PublicState }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const a = animate(ref.current, { translateY: [0, -10, 0], duration: 2400, loop: true, ease: "inOutSine" });
    return () => {
      a.revert();
    };
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2em] text-center">
      <Trophy className="size-[9em]" />
      <h1 className="font-display text-[4.4em] font-bold leading-none tracking-tight">The votes are in</h1>
      <p className="text-[1.5em] text-ink-muted">
        {state.votesReceived} {state.votesReceived === 1 ? "vote" : "votes"} counted. The winner will be revealed shortly…
      </p>
    </div>
  );
}

type Stage = "countdown" | "winner" | "board";

export function ResultsView({ state, live }: { state: PublicState; live: boolean }) {
  const ranked = rankTeams(state.teams);
  const winners = winnersOf(ranked);
  const animated = live && !prefersReducedMotion();
  const [stage, setStage] = useState<Stage>(animated ? "countdown" : "board");
  const [count, setCount] = useState(3);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (count === 0) {
      setStage("winner");
      return;
    }
    const id = window.setTimeout(() => setCount((c) => c - 1), 900);
    return () => window.clearTimeout(id);
  }, [stage, count]);

  useEffect(() => {
    if (stage === "winner") {
      playChime("reveal");
      setBurst((b) => b + 1);
      const id = window.setTimeout(() => setStage("board"), 6500);
      return () => window.clearTimeout(id);
    }
  }, [stage]);

  return (
    <div className="relative h-full">
      <Confetti burstKey={burst} />
      {stage === "countdown" ? <Countdown n={count} /> : null}
      {stage === "winner" ? <WinnerSpotlight winners={winners} state={state} /> : null}
      {stage === "board" ? <Scoreboard ranked={ranked} winners={winners} state={state} animateIn={animated} /> : null}
      {stage !== "board" ? (
        <button
          type="button"
          onClick={() => setStage("board")}
          className="absolute right-0 bottom-0 z-40 min-h-11 rounded-full bg-surface px-[1.2em] text-[0.9em] font-semibold text-ink-muted ring-1 ring-border"
        >
          Skip animation ›
        </button>
      ) : null}
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const a = animate(ref.current, { scale: [1.6, 1], opacity: [0, 1], duration: 600, ease: "outExpo" });
    return () => {
      a.revert();
    };
  }, [n]);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[0.6em]">
      <p className="text-[1.6em] font-semibold text-ink-muted">And the winning team is…</p>
      <div ref={ref} key={n} className="font-display text-[12em] font-bold leading-none text-primary">
        {n > 0 ? n : ""}
      </div>
    </div>
  );
}

function WinnerSpotlight({ winners, state }: { winners: RankedTeam[]; state: PublicState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const tl = createTimeline();
    tl.add(ref.current.querySelectorAll("[data-pop]"), {
      opacity: [0, 1],
      scale: [0.6, 1],
      translateY: [30, 0],
      duration: 900,
      delay: stagger(180),
      ease: "outBack(1.6)",
    });
    return () => {
      tl.revert();
    };
  }, []);

  if (winners.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-display text-[3em] font-bold">No votes were cast</div>
    );
  }
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-[1.4em] text-center">
      <div data-pop><Trophy className="size-[7em]" /></div>
      <p data-pop className="text-[1.6em] font-bold uppercase tracking-[0.2em] text-gold">
        {winners.length > 1 ? "It's a tie! Joint winners" : "Winner"}
      </p>
      <div className="flex flex-wrap justify-center gap-x-[3em] gap-y-[1.6em]">
        {winners.map((team) => {
          const style = teamStyle(team.key);
          return (
            <div key={team.id} data-pop className="flex flex-col items-center gap-[0.6em]">
              <div className={`whitespace-nowrap font-display font-bold leading-none tracking-tight ${winners.length > 1 ? "text-[3.4em]" : "text-[5em]"} ${style.text}`}>
                {teamSymbol(team.key)} {team.name}
              </div>
              <div className="text-[1.6em] font-semibold">
                {membersOf(team, state.participants)
                  .map((p) => p.firstName)
                  .join(" · ")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Scoreboard({
  ranked,
  winners,
  state,
  animateIn,
}: {
  ranked: RankedTeam[];
  winners: RankedTeam[];
  state: PublicState;
  animateIn: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const total = ranked.reduce((s, t) => s + t.votes, 0);
  const max = Math.max(1, ...ranked.map((t) => t.votes));
  useEffect(() => {
    if (!ref.current || !animateIn) return;
    const a = animate(ref.current.querySelectorAll("li"), {
      opacity: [0, 1],
      translateX: [-30, 0],
      duration: 600,
      delay: stagger(150),
      ease: "outExpo",
    });
    return () => {
      a.revert();
    };
  }, [animateIn]);

  return (
    <div className="flex h-full flex-col gap-[1.4em]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[1.1em] font-bold uppercase tracking-[0.18em] text-gold">Final results</p>
          <h1 className="font-display text-[3.4em] font-bold leading-none tracking-tight">
            {winners.length === 0
              ? "No votes were cast"
              : winners.length > 1
                ? `Joint winners: ${winners.map((w) => w.name.replace("Team ", "")).join(" & ")}`
                : `${winners[0].name} wins!`}
          </h1>
        </div>
        <div className="text-[1.2em] font-semibold text-ink-muted">{total} votes counted</div>
      </div>
      <ol ref={ref} className="flex flex-1 flex-col justify-center gap-[1em]">
        {ranked.map((team) => {
          const style = teamStyle(team.key);
          const isWinner = winners.some((w) => w.id === team.id);
          return (
            <li
              key={team.id}
              className={`grid grid-cols-[3em_1fr_auto] items-center gap-[1.2em] rounded-[1.6em] p-[1.1em] ring-1 ${
                isWinner ? "bg-gold-soft ring-gold/40" : "bg-surface ring-border"
              }`}
            >
              <span className="text-center font-display text-[2.6em] font-bold text-ink-muted">{team.rank}</span>
              <div className="flex min-w-0 flex-col gap-[0.5em]">
                <div className="flex items-baseline gap-[0.6em]">
                  <span className={`font-display text-[2em] font-bold ${style.text}`}>
                    {teamSymbol(team.key)} {team.name}
                  </span>
                  {isWinner ? <CrownIcon className="size-[1.6em] text-gold" /> : null}
                  <span className="truncate text-[1.1em] text-ink-muted">
                    {membersOf(team, state.participants)
                      .map((p) => p.firstName)
                      .join(" · ")}
                  </span>
                </div>
                <div className="h-[0.8em] overflow-hidden rounded-full bg-ink/10">
                  <div className={`h-full rounded-full ${style.bg}`} style={{ width: `${(team.votes / max) * 100}%` }} />
                </div>
              </div>
              <span className="tabular font-display text-[2.6em] font-bold">
                {team.votes}
                <span className="ml-[0.2em] text-[0.4em] font-semibold text-ink-muted">{team.votes === 1 ? "vote" : "votes"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
