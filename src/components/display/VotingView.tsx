import type { PublicState } from "../../lib/useEvent";
import { voteUrl } from "../../lib/urls";
import { QrPanel } from "../QrPanel";

export function VotingView({ state }: { state: PublicState }) {
  const { votesReceived, eligibleVoters } = state;
  const pct = eligibleVoters ? (votesReceived / eligibleVoters) * 100 : 0;
  return (
    <div className="grid h-full grid-cols-[1fr_auto] gap-[2.4em]">
      <div className="flex flex-col justify-center gap-[1.6em]">
        <div>
          <p className="text-[1.1em] font-bold uppercase tracking-[0.18em] text-gold">Voting is open</p>
          <h1 className="mt-[0.2em] font-display text-[4.2em] font-bold leading-[0.95] tracking-tight">
            Which build
            <br />
            <span className="text-primary">impressed you most?</span>
          </h1>
        </div>
        <ol className="flex flex-col gap-[0.6em] text-[1.3em]">
          {["Scan the new code with your phone", "Confirm your name", "Pick one of the other two teams"].map((step, i) => (
            <li key={step} className="flex items-center gap-[0.7em]">
              <span className="grid size-[1.8em] place-items-center rounded-full bg-primary font-display font-bold text-white">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="rounded-[1.6em] bg-surface p-[1.3em] ring-1 ring-border">
          <div className="flex items-baseline justify-between">
            <span className="tabular font-display text-[3em] font-bold leading-none">
              {votesReceived}
              <span className="text-ink-muted/60"> / {eligibleVoters}</span>
            </span>
            <span className="text-[1.2em] font-semibold text-ink-muted">votes received</span>
          </div>
          <div className="mt-[0.8em] h-[0.7em] overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-[0.8em] text-[1em] text-ink-muted">Scores stay hidden until the reveal. Only team totals are ever stored.</p>
        </div>
      </div>
      <div className="w-[24em]">
        <QrPanel url={voteUrl()} title="Vote now" subtitle="This is a new code. Scan again" />
      </div>
    </div>
  );
}
