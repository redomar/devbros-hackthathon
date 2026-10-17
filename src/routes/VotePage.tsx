import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEventState, type PublicParticipant, type PublicState, type PublicTeam } from "../lib/useEvent";
import { useMe } from "../lib/useMe";
import { errorCode, errorMessage } from "../lib/errors";
import { rankTeams, winnersOf } from "../lib/results";
import { normaliseName } from "../../shared/names";
import { PhoneHeading, PhoneShell } from "../components/PhoneShell";
import { MyTeam } from "../components/MyTeam";
import { CrownIcon } from "../components/People";
import { membersOf, teamSymbol } from "../components/TeamCard";
import { teamStyle } from "../components/teamStyle";
import { Button, Card, Notice, Spinner } from "../components/ui";

type Voter = { participant: PublicParticipant; via: "device" | "name" };

export function VotePage() {
  const { deviceId, me } = useMe();
  const state = useEventState();
  const [voter, setVoter] = useState<Voter | null>(null);
  const [useName, setUseName] = useState(false);
  const [done, setDone] = useState(false);

  if (state === undefined || me === undefined) {
    return (
      <PhoneShell>
        <div className="grid place-items-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      </PhoneShell>
    );
  }

  if (state.phase === "results") return <PhoneResults state={state} />;
  if (state.phase === "results_pending") {
    return (
      <PhoneShell>
        <PhoneHeading eyebrow="Voting closed" title="The votes are in">
          Watch the big screen for the winner.
        </PhoneHeading>
      </PhoneShell>
    );
  }
  if (state.phase !== "voting") {
    return (
      <PhoneShell>
        <PhoneHeading eyebrow="Voting" title="Voting hasn't opened yet">
          A new QR code will appear on the big screen when it does.
        </PhoneHeading>
        {me ? <MyTeam state={state} participantId={me.id} deviceId={deviceId} /> : <Link className="font-semibold text-primary underline" to="/join">Go to check-in</Link>}
      </PhoneShell>
    );
  }

  const deviceVoter = me ? state.participants.find((p) => p.id === me.id) : undefined;
  const active: Voter | null = voter ?? (deviceVoter && !useName ? { participant: deviceVoter, via: "device" } : null);

  if (done || (active?.via === "device" && me?.hasVoted)) {
    return (
      <PhoneShell>
        <Card className="flex flex-col gap-3 p-5">
          <div className="grid size-12 place-items-center rounded-full bg-primary-soft text-2xl text-primary" aria-hidden>
            ✓
          </div>
          <PhoneHeading eyebrow="Thank you" title="Your vote is in">
            It's stored only as +1 for that team. Nothing links it back to you. Watch the big screen for the reveal.
          </PhoneHeading>
        </Card>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      {active ? (
        <>
          <PhoneHeading eyebrow="Voting" title={`Voting as ${active.participant.firstName}`}>
            <button
              type="button"
              className="min-h-11 font-semibold text-primary underline"
              onClick={() => {
                setVoter(null);
                setUseName(true);
              }}
            >
              Not you? Enter your name
            </button>
          </PhoneHeading>
          <Ballot state={state} voter={active} deviceId={deviceId} onDone={() => setDone(true)} />
        </>
      ) : (
        <>
          <PhoneHeading eyebrow="Voting" title="Who's voting?">
            Enter the first name you checked in with.
          </PhoneHeading>
          <NameFinder state={state} onPick={(participant) => setVoter({ participant, via: "name" })} />
        </>
      )}
    </PhoneShell>
  );
}

function NameFinder({ state, onPick }: { state: PublicState; onPick: (p: PublicParticipant) => void }) {
  const [query, setQuery] = useState("");
  const q = normaliseName(query);
  const eligible = state.participants.filter((p) => p.teamId !== null);
  const matches = q ? eligible.filter((p) => normaliseName(p.firstName).startsWith(q)) : [];

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="given-name"
        autoCapitalize="words"
        placeholder="Your first name"
        aria-label="Your first name"
        className="min-h-14 rounded-2xl border border-border bg-surface px-4 text-lg"
      />
      {matches.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left text-lg font-semibold"
              >
                {p.firstName}
                <span className="text-sm text-primary">That's me →</span>
              </button>
            </li>
          ))}
        </ul>
      ) : q ? (
        <Notice tone="warn">No match yet. Use the exact name from check-in, or ask an organiser.</Notice>
      ) : null}
    </div>
  );
}

function Ballot({ state, voter, deviceId, onDone }: { state: PublicState; voter: Voter; deviceId: string; onDone: () => void }) {
  const castVote = useMutation(api.voting.castVote);
  const [choice, setChoice] = useState<PublicTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownTeamId = voter.participant.teamId;

  if (choice) {
    const style = teamStyle(choice.key);
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="text-ink-muted">You're voting for</div>
        <div className={`font-display text-3xl font-bold ${style.text}`}>
          {teamSymbol(choice.key)} {choice.name}
        </div>
        <p className="text-sm text-ink-muted">One vote each, and it can't be changed afterwards.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button
          size="lg"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await castVote(
                voter.via === "device" ? { deviceId, teamId: choice.id } : { name: voter.participant.firstName, teamId: choice.id },
              );
              onDone();
            } catch (e) {
              if (errorCode(e) === "already_voted") onDone();
              else setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending…" : "Confirm my vote"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setChoice(null)}>
          Change my choice
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Pick the build that impressed you most:</p>
      {state.teams.map((team) => {
        const style = teamStyle(team.key);
        const own = team.id === ownTeamId;
        return (
          <button
            key={team.id}
            type="button"
            disabled={own}
            onClick={() => setChoice(team)}
            className={`flex min-h-20 flex-col items-start gap-1 rounded-2xl border-2 bg-surface px-4 py-3 text-left transition-colors ${
              own ? "border-dashed border-border opacity-60" : "border-border hover:border-ink-muted/40"
            }`}
          >
            <span className="flex w-full items-center justify-between">
              <span className={`font-display text-xl font-bold ${style.text}`}>
                {teamSymbol(team.key)} {team.name}
              </span>
              {own ? <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold text-ink-muted">Your team</span> : null}
            </span>
            <span className="text-sm text-ink-muted">
              {membersOf(team, state.participants)
                .map((p) => p.firstName)
                .join(" · ")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PhoneResults({ state }: { state: PublicState }) {
  const ranked = rankTeams(state.teams);
  const winners = winnersOf(ranked);
  return (
    <PhoneShell>
      <PhoneHeading
        eyebrow="Final results"
        title={winners.length > 1 ? "Joint winners!" : winners.length ? `${winners[0].name} wins!` : "No votes were cast"}
      />
      <ol className="flex flex-col gap-2">
        {ranked.map((t) => {
          const style = teamStyle(t.key);
          return (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <span className="w-6 font-display text-xl font-bold text-ink-muted">{t.rank}</span>
              <span className={`flex-1 font-display text-lg font-bold ${style.text}`}>
                {teamSymbol(t.key)} {t.name}
              </span>
              {winners.some((w) => w.id === t.id) ? <CrownIcon className="size-5 text-gold" /> : null}
              <span className="tabular font-bold">{t.votes}</span>
            </li>
          );
        })}
      </ol>
    </PhoneShell>
  );
}
