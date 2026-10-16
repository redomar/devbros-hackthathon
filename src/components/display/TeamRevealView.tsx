import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, createTimeline, stagger, utils, type JSAnimation } from "animejs";
import type { PublicState } from "../../lib/useEvent";
import { prefersReducedMotion } from "../../lib/motion";
import { formatCountdown } from "../../../shared/time";
import { TeamCard } from "../TeamCard";

export function TeamRevealView({ state, now, live }: { state: PublicState; now: number; live: boolean }) {
  // A reshuffle changes captains/memberships: replay the shuffle for it too.
  const signature = state.teams.map((t) => t.memberIds.join(",") + t.captainId).join("|");
  const [shuffling, setShuffling] = useState(live && !prefersReducedMotion());
  const [crown, setCrown] = useState(false);
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current !== signature) {
      lastSignature.current = signature;
      if (!prefersReducedMotion()) setShuffling(true);
    }
  }, [signature]);

  return (
    <div className="flex h-full flex-col gap-[1.4em]">
      <div className="flex min-h-[7.2em] items-end justify-between gap-[1em]">
        <div>
          <p className="text-[1.1em] font-bold uppercase tracking-[0.18em] text-gold">
            {shuffling ? "Drawing teams" : "Your teams"}
          </p>
          <h1 className="font-display text-[3.2em] font-bold leading-none tracking-tight">
            {shuffling ? "Balancing experience…" : "Three teams, one intention"}
          </h1>
          {/* Same line in both states so the cards don't shift when the shuffle hands over. */}
          <p className="mt-[0.4em] text-[1.15em] text-ink-muted">
            {shuffling
              ? "Mixing levels so every team gets a fair spread."
              : "Balanced by experience level. Captains drawn at random."}
          </p>
        </div>
        {!shuffling ? <RevealCountdown state={state} now={now} /> : null}
      </div>
      <div className="min-h-0 flex-1">
        {shuffling ? (
          <Shuffle state={state} key={signature} onDone={() => {
              setShuffling(false);
              setCrown(true);
            }}
          />
        ) : (
          // After a shuffle the cards are already in place: only the captain reveal plays.
          <Cards state={state} crownCaptains={crown} key={signature} />
        )}
      </div>
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

const HOPS = 3;

/**
 * The same cards as the final reveal, but empty: each brother's chip pops in, hops around the room a few
 * times, then flies into its slot. Purely visual: the teams were already drawn on the server.
 */
function Shuffle({ state, onDone }: { state: PublicState; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  // Layout effect: place chips at their starting spots before the first paint so nothing flashes.
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const area = host.getBoundingClientRect();
    const cards = host.querySelectorAll<HTMLElement>("[data-card]");
    const tokens = [...host.querySelectorAll<HTMLElement>("[data-token]")];
    const animations: JSAnimation[] = [];
    const timers: number[] = [];

    // Shells fade in (opacity only, so chips can fly over neighbouring cards).
    utils.set(cards, { opacity: 0 });
    animations.push(animate(cards, { opacity: [0, 1], duration: 700, delay: stagger(160), ease: "outQuad" }));

    let lastLanding = 0;
    const order = utils.shuffle([...tokens.keys()]);
    tokens.forEach((el, i) => {
      const home = el.getBoundingClientRect();
      const spot = () => ({
        x: utils.random(area.left, area.right - home.width) - home.left,
        y: utils.random(area.top, area.bottom - home.height) - home.top,
        r: utils.random(-12, 12),
      });
      const spots = Array.from({ length: HOPS + 1 }, spot);
      const hops = spots.slice(1).map(() => utils.random(620, 860));
      const appearAt = 650 + order[i] * 70;
      const land = 1150;
      lastLanding = Math.max(lastLanding, appearAt + hops.reduce((a, b) => a + b, 0) + land);

      utils.set(el, { translateX: spots[0].x, translateY: spots[0].y, rotate: spots[0].r, opacity: 0, scale: 0.6 });
      const path = (k: "x" | "y" | "r") => [
        ...spots.slice(1).map((p, h) => ({ to: p[k], duration: hops[h], ease: "inOutCubic" })),
        { to: 0, duration: land, ease: "outBack(1.2)" },
      ];
      animations.push(
        animate(el, {
          opacity: [{ to: 1, duration: 380, ease: "outQuad" }],
          scale: [{ to: 1, duration: 520, ease: "outBack(2.2)" }],
          translateX: path("x"),
          translateY: path("y"),
          rotate: path("r"),
          delay: appearAt,
        }),
      );
    });

    // Everyone's home: tint the cards and show the scores, hold a moment, then hand over to the reveal.
    timers.push(window.setTimeout(() => setSettled(true), lastLanding + 150));
    timers.push(window.setTimeout(() => done.current(), lastLanding + 1500));

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      animations.forEach((a) => a.revert());
    };
  }, []);

  return (
    <div ref={ref} className="grid h-full grid-cols-3 items-start gap-[1.4em]">
      {state.teams.map((team) => (
        <div key={team.id} data-card>
          <TeamCard team={team} participants={state.participants} stage={settled ? "settled" : "shuffle"} />
        </div>
      ))}
    </div>
  );
}

function Cards({ state, crownCaptains }: { state: PublicState; crownCaptains: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || !crownCaptains) return;
    const crowns = host.querySelectorAll<HTMLElement>("[data-crown]");
    const captains = host.querySelectorAll<HTMLElement>("[data-captain]");
    const tl = createTimeline();
    tl.add(captains, { backgroundColor: ["#ffffff", "#f7ebd2"], duration: 700, delay: stagger(260), ease: "outQuad" })
      .add(crowns, { scale: [0, 1.4, 1], rotate: [-25, 0], opacity: [0, 1], duration: 800, delay: stagger(260), ease: "outBack(2)" }, "<<+=150");
    return () => {
      tl.revert();
    };
  }, [crownCaptains]);

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
