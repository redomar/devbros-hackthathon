import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import type { PublicState } from "../../lib/useEvent";
import { joinUrl } from "../../lib/urls";
import { prefersReducedMotion } from "../../lib/motion";
import { QrPanel } from "../QrPanel";
import { Initials, LevelPill } from "../People";

export function ArrivalsView({ state }: { state: PublicState }) {
  const count = state.participants.length;
  const expected = state.settings.expectedParticipants;
  const board = useRef<HTMLUListElement>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const host = board.current;
    if (!host) return;
    const ids = state.participants.map((p) => p.id);
    const fresh = seen.current === null ? ids : ids.filter((id) => !seen.current!.has(id));
    const firstPaint = seen.current === null;
    seen.current = new Set(ids);
    if (prefersReducedMotion() || fresh.length === 0) return;
    const els = fresh
      .map((id) => host.querySelector<HTMLElement>(`[data-id="${id}"]`))
      .filter((el): el is HTMLElement => el !== null);
    animate(els, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.92, 1],
      duration: firstPaint ? 500 : 800,
      delay: stagger(firstPaint ? 40 : 0),
      ease: "outBack(1.4)",
    });
  }, [state.participants]);

  return (
    <div className="grid h-full grid-cols-[1fr_auto] gap-[2.4em]">
      <div className="flex min-h-0 flex-col gap-[1.6em]">
        <div>
          <p className="text-[1.1em] font-bold uppercase tracking-[0.18em] text-gold">Assalamu alaykum, welcome</p>
          <h1 className="mt-[0.2em] font-display text-[4.2em] font-bold leading-[0.95] tracking-tight text-balance">
            Same intentions.
            <br />
            <span className="text-primary">Stronger together.</span>
          </h1>
          <p className="mt-[0.6em] max-w-[34em] text-[1.25em] text-ink-muted">
            Today we learn to build with AI side by side, in balanced teams, then vote for the best build.
          </p>
        </div>

        <div className="flex items-end gap-[1em]">
          <div className="tabular font-display text-[4.6em] font-bold leading-none tracking-tight">
            {count}
            <span className="text-ink-muted/60"> / {expected}</span>
          </div>
          <div className="pb-[0.5em] text-[1.3em] font-semibold text-ink-muted">brothers checked in</div>
        </div>
        <div className="flex gap-[0.4em]" aria-hidden>
          {Array.from({ length: Math.max(expected, count) }, (_, i) => (
            <span
              key={i}
              className={`h-[0.55em] flex-1 rounded-full transition-colors duration-700 ${i < count ? (i < expected ? "bg-primary" : "bg-gold-bright") : "bg-ink/10"}`}
            />
          ))}
        </div>

        <ul ref={board} className="grid min-h-0 grid-cols-3 content-start gap-[0.8em]">
          {state.participants.map((p) => (
            <li
              key={p.id}
              data-id={p.id}
              className="flex items-center gap-[0.7em] rounded-[1.1em] bg-surface p-[0.6em] pr-[1em] ring-1 ring-border"
            >
              <Initials name={p.firstName} className="size-[2.4em] text-[1em]" />
              <div className="min-w-0">
                <div className="truncate font-display text-[1.3em] font-semibold leading-tight">
                  {p.firstName}
                  {p.isTest ? <span className="ml-1 align-middle text-[0.5em] font-bold text-ink-muted">TEST</span> : null}
                </div>
                <LevelPill level={p.experience} />
              </div>
            </li>
          ))}
          {count === 0 ? (
            <li className="col-span-3 rounded-[1.1em] border-2 border-dashed border-border p-[1.2em] text-[1.2em] text-ink-muted">
              Be the first to check in. Scan the code →
            </li>
          ) : null}
        </ul>
      </div>
      <div className="w-[24em]">
        <QrPanel url={joinUrl()} title="Check in" subtitle="Scan with your phone camera" />
      </div>
    </div>
  );
}
