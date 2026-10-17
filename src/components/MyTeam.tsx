import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PublicState, PublicTeam } from "../lib/useEvent";
import { errorMessage } from "../lib/errors";
import { TEAM_NAME_MAX_LENGTH, validateTeamName } from "../../shared/teams";
import { Button, Card, Notice } from "./ui";
import { CrownIcon, Initials, LevelPill } from "./People";
import { membersOf, teamSymbol } from "./TeamCard";
import { teamStyle } from "./teamStyle";

export function MyTeam({ state, participantId, deviceId }: { state: PublicState; participantId: string; deviceId: string }) {
  const team = state.teams.find((t) => t.memberIds.includes(participantId as never));
  if (!team) return null;
  const style = teamStyle(team.key);
  const amCaptain = team.captainId === participantId;
  const canRename = amCaptain && (state.phase === "team_reveal" || state.phase === "hackathon");
  return (
    <Card className="overflow-hidden">
      <div className={`px-5 py-4 text-white ${style.bg}`}>
        <div className="text-sm font-semibold opacity-85">You're in</div>
        <div className="font-display text-2xl font-bold">
          {teamSymbol(team.key)} {team.name}
        </div>
      </div>
      {amCaptain ? (
        <div className="flex flex-col gap-3 bg-gold-soft px-5 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <CrownIcon className="size-5 text-gold" /> You were drawn as captain. Lead with excellence!
          </div>
          {canRename ? <RenameTeam team={team} deviceId={deviceId} /> : null}
        </div>
      ) : null}
      <ul className="flex flex-col gap-2 p-4">
        {membersOf(team, state.participants).map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Initials name={p.firstName} className={`size-10 text-sm ${style.soft} ${style.text}`} tone="" />
            <span className="flex-1 font-semibold">
              {p.firstName}
              {p.id === participantId ? <span className="font-normal text-ink-muted"> (you)</span> : null}
            </span>
            {p.id === team.captainId ? <CrownIcon className="size-5 text-gold" /> : null}
            <span className="text-[13px]">
              <LevelPill level={p.experience} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Captain-only: pick a team name. The colour and symbol stay, so the team is still easy to spot. */
function RenameTeam({ team, deviceId }: { team: PublicTeam; deviceId: string }) {
  const rename = useMutation(api.teams.rename);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => {
          setName(team.name);
          setError(null);
          setEditing(true);
        }}
      >
        Rename your team
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const problem = validateTeamName(name);
        if (problem) return setError(problem);
        setBusy(true);
        try {
          await rename({ deviceId, name });
          setEditing(false);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-sm font-semibold" htmlFor="team-name">
        Team name
      </label>
      <input
        id="team-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={TEAM_NAME_MAX_LENGTH}
        autoComplete="off"
        autoFocus
        className="min-h-12 rounded-xl border border-border bg-surface px-3 text-base"
      />
      <p className="text-sm text-ink-muted">
        Shows on the big screen and the voting page. Your colour and {teamSymbol(team.key)} stay the same. Names lock when voting opens.
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" busy={busy}>
          Save name
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
