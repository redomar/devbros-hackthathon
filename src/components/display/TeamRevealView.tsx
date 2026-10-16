import { useEffect, useRef, useState } from "react";
import { createTimeline, stagger, utils } from "animejs";
import type { PublicState } from "../../lib/useEvent";
import { prefersReducedMotion } from "../../lib/motion";
import { formatCountdown } from "../../../shared/time";
import { membersOf, TeamCard, teamSymbol } from "../TeamCard";
import { teamStyle } from "../teamStyle";

const SHUFFLE_MS = 3000;

export function TeamRevealView({ state, now, live }: { state: PublicState; now: number; live: boolean }) {
  // A reshuffle changes captains/memberships: replay the shuffle for it too.
  const signature = state.teams.map((t) => t.memberIds.join(",") + t.captainId).join("|");
  const [shuffling, setShuffling] = useState(live && !prefersReducedMotion());
  const [animateCards, setAnimateCards] = useState(live);
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current !== signature) {
      lastSignature.current = signature;
      setAnimateCards(true);
      if (!prefersReducedMotion()) setShuffling(true);
    }
  }, [signature]);

  useEffect(() => {
    if (!shuffling) return;
    const id = window.setTimeout(() => setShuffling(false), SHUFFLE_MS);
    return () => window.clearTimeout(id);
  }, [shuffling, signature]);

  return (
    <div className="flex h-full flex-col gap-[1.4em]">
      <div className="flex items-end justify-between gap-[1em]">
        <div>
          <p className="text-[1.1em] font-bold uppercase tracking-[0.18em] text-gold">
            {shuffling ? "Drawing teams" : "Your teams"}
          </p>
          <h1 className="font-display text-[3.2em] font-bold leading-none tracking-tight">
            {shuffling ? "Balancing experience…" : "Three teams, one intention"}
          </h1>
        </div>
        {!shuffling ? <RevealCountdown state={state} now={now} /> : null}
      </div>
      <div className="min-h-0 flex-1">
        {shuffling ? <Shuffle state={state} key={signature} /> : <Cards state={state} animateIn={animateCards} key={signature} />}
      </div>
      {!shuffling ? (
        <p className="text-center text-[1em] text-ink-muted">
          Teams were balanced by experience level. Captains were drawn at random.
        </p>
      ) : null}
    </div>
  );
}

function RevealCountdown({ state, now }: { state: PublicState; now: number }) {
  if (state.revealEndsAt !== null) {
    return (
      <div className="rounded-[1.2em] bg-primary px-[1.2em] py-[0.6em] text-white">
        <div className="text-[0.85em] font-semibold opacity-80">Hacking starts in</div>
        <div className="tabular font-display text-[2.4em] font-bold leading-none">{formatCountdown(state.revealEndsAt - now)}</div>
      </div>
    );
  }
  return (
    <div className="rounded-[1.2em] bg-surface px-[1.2em] py-[0.8em] text-[1.2em] font-semibold text-ink-muted ring-1 ring-border">
      {state.revealHeldMs !== null ? "Countdown on hold" : "Starting when the organisers are ready"}
    </div>
  );
}

/** Name tokens fly from a scattered cloud into their team columns. Purely visual; teams are already drawn. */
function Shuffle({ state }: { state: PublicState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const tokens = host.querySelectorAll<HTMLElement>("[data-token]");
    const w = host.clientWidth;
    const h = host.clientHeight;
    const tl = createTimeline();
    tl.add(tokens, {
      translateX: () => [utils.random(-w * 0.4, w * 0.4), utils.random(-w * 0.3, w * 0.3)],
      translateY: () => [utils.random(-h * 0.3, h * 0.3), utils.random(-h * 0.25, h * 0.25)],
      rotate: () => [utils.random(-30, 30), utils.random(-15, 15)],
      opacity: [0, 1],
      duration: 900,
      delay: stagger(60),
      ease: "inOutQuad",
    }).add(
      tokens,
      { translateX: 0, translateY: 0, rotate: 0, duration: 1100, delay: stagger(70, { from: "random" }), ease: "outBack(1.2)" },
      "-=200",
    );
    return () => {
      tl.revert();
    };
  }, []);

  return (
    <div ref={ref} className="grid h-full grid-cols-3 gap-[1.4em]">
      {state.teams.map((team) => {
        const style = teamStyle(team.key);
        return (
          <div key={team.id} className={`flex flex-col gap-[0.8em] rounded-[1.6em] border-2 border-dashed p-[1.2em] ${style.border}`}>
            <div className={`font-display text-[1.5em] font-bold ${style.text}`}>
              {teamSymbol(team.key)} {team.name}
            </div>
            {membersOf(team, state.participants).map((p) => (
              <div
                key={p.id}
                data-token
                className="rounded-full bg-surface px-[1em] py-[0.5em] text-center font-display text-[1.4em] font-semibold shadow-md ring-1 ring-border"
              >
                {p.firstName}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Cards({ state, animateIn }: { state: PublicState; animateIn: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !animateIn || prefersReducedMotion()) return;
    const cards = host.querySelectorAll<HTMLElement>("[data-card]");
    const crowns = host.querySelectorAll<HTMLElement>("[data-crown]");
    const captains = host.querySelectorAll<HTMLElement>("[data-captain]");
    const tl = createTimeline();
    tl.add(cards, { opacity: [0, 1], translateY: [40, 0], scale: [0.96, 1], duration: 700, delay: stagger(220), ease: "outExpo" })
      .add(captains, { backgroundColor: ["#ffffff", "#f7ebd2"], duration: 500, delay: stagger(150) }, "-=200")
      .add(crowns, { scale: [0, 1.35, 1], rotate: [-20, 0], opacity: [0, 1], duration: 700, delay: stagger(150), ease: "outBack(2)" }, "<<");
    return () => {
      tl.revert();
    };
  }, [animateIn]);

  return (
    <div ref={ref} className="grid h-full grid-cols-3 items-start gap-[1.4em]">
      {state.teams.map((team) => (
        <div key={team.id} data-card>
          <TeamCard team={team} participants={state.participants} />
        </div>
      ))}
    </div>
  );
}
