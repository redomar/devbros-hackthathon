import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useEventState, type PublicParticipant, type PublicState, type PublicTeam } from "../lib/useEvent";
import { useNow } from "../lib/clock";
import { getAdminToken, setAdminToken } from "../lib/storage";
import { errorMessage } from "../lib/errors";
import { joinUrl, rejoinUrl, voteUrl } from "../lib/urls";
import { QRCodeSVG } from "qrcode.react";
import { LEVELS, LEVEL_LABEL, type Level } from "../../shared/levels";
import { TEAM_NAME_MAX_LENGTH, defaultTeamName } from "../../shared/teams";
import { teamSymbol } from "../components/TeamCard";
import { PhoneHeading, PhoneShell } from "../components/PhoneShell";
import { OrganiserControls } from "../components/OrganiserControls";
import { AdminSettings } from "../components/AdminSettings";
import { useConfirm } from "../components/ConfirmDialog";
import { LevelPill } from "../components/People";
import { Button, Card, Notice, Spinner } from "../components/ui";

const PHASE_NAME: Record<PublicState["phase"], string> = {
  setup: "Check-in open",
  team_reveal: "Team reveal",
  hackathon: "Hacking",
  voting: "Voting open",
  results_pending: "Voting closed, awaiting reveal",
  results: "Results revealed",
};

export function AdminPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => params.token ?? getAdminToken());

  // Capability link: remember it on this device, then drop it from the address bar.
  useEffect(() => {
    if (params.token) {
      setAdminToken(params.token);
      setToken(params.token);
      navigate("/admin", { replace: true });
    }
  }, [params.token, navigate]);

  const valid = useQuery(api.event.checkAdmin, token ? { token } : "skip");
  const state = useEventState();

  if (!token || valid === false) {
    return (
      <PhoneShell>
        <PhoneHeading eyebrow="Organisers" title="Organiser access">
          Open your organiser link, or enter the code.
        </PhoneHeading>
        {valid === false ? <Notice tone="error">That organiser code wasn't recognised.</Notice> : null}
        <CodeForm
          onSubmit={(t) => {
            setAdminToken(t);
            setToken(t);
          }}
        />
      </PhoneShell>
    );
  }

  if (valid === undefined || state === undefined) {
    return (
      <PhoneShell>
        <div className="grid place-items-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      </PhoneShell>
    );
  }

  return <AdminDashboard state={state} token={token} onSignOut={() => { setAdminToken(null); setToken(null); }} />;
}

function CodeForm({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim().toLowerCase());
      }}
    >
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="xxxx-xxxx-xxxx"
        autoComplete="off"
        autoCapitalize="none"
        aria-label="Organiser code"
        className="min-h-12 flex-1 rounded-xl border border-border bg-surface px-3 text-base"
      />
      <Button type="submit">Open</Button>
    </form>
  );
}

function AdminDashboard({ state, token, onSignOut }: { state: PublicState; token: string; onSignOut: () => void }) {
  const now = useNow(500);
  const pending = useQuery(api.voting.pendingVoters, state.phase === "voting" ? { token } : "skip");
  const reset = useMutation(api.flow.resetEvent);
  const addTests = useMutation(api.participants.addTestParticipants);
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  return (
    <PhoneShell>
      <PhoneHeading eyebrow="Organiser" title={PHASE_NAME[state.phase]}>
        Everything here mirrors to the big screen instantly.
      </PhoneHeading>

      <Card className="p-4">
        <OrganiserControls state={state} token={token} now={now} pendingVoters={pending ?? undefined} />
      </Card>

      {state.phase === "voting" && pending ? (
        <Card className="p-4">
          <h2 className="font-semibold">Still to vote ({pending.length})</h2>
          <p className="text-sm text-ink-muted">{pending.length ? pending.join(", ") : "Everyone has voted."}</p>
        </Card>
      ) : null}

      {state.participants.length ? <PlayersCard state={state} token={token} /> : null}

      {state.teams.length && state.phase !== "results" ? (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="font-display text-xl font-bold">Team names</h2>
          <p className="text-sm text-ink-muted">Captains can rename their team from their phone until voting opens. Fix or reset a name here.</p>
          <ul className="flex flex-col divide-y divide-border">
            {state.teams.map((t) => (
              <TeamNameRow key={t.id} team={t} token={token} />
            ))}
          </ul>
        </Card>
      ) : null}

      {state.phase === "setup" || state.phase === "team_reveal" ? (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">
              Brothers ({state.participants.length}/{state.settings.expectedParticipants})
            </h2>
            {state.phase === "setup" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (
                    await confirm({
                      title: "Add test participants?",
                      body: "Adds placeholders named “Test 1”, “Test 2”… to fill up to 9. For rehearsals only; remove them or reset before the real event.",
                      confirmLabel: "Add test data",
                    })
                  ) {
                    try {
                      await addTests({ token, count: Math.max(0, 9 - state.participants.length) });
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }
                }}
              >
                + Test data
              </Button>
            ) : null}
          </div>
          {state.phase === "team_reveal" ? (
            <p className="text-sm text-ink-muted">Fix spelling or levels here, then reshuffle if levels changed.</p>
          ) : null}
          <ul className="flex flex-col divide-y divide-border">
            {state.participants.map((p) => (
              <ParticipantRow key={p.id} p={p} token={token} canRemove={state.phase === "setup"} confirm={confirm} />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-2 p-4 text-sm">
        <h2 className="font-semibold">Links</h2>
        <Link to="/event" className="font-semibold text-primary underline">
          Open the big-screen display on this device
        </Link>
        <span className="text-ink-muted">Check-in: {joinUrl()}</span>
        <span className="text-ink-muted">Voting: {voteUrl()}</span>
      </Card>

      <AdminSettings state={state} token={token} />

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-semibold text-danger">Danger zone</h2>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button
          variant="danger"
          onClick={async () => {
            if (
              await confirm({
                title: "Reset the whole event?",
                body: "Deletes every participant, team and vote, and returns to check-in. Settings and Salah times are kept.",
                confirmLabel: "Reset everything",
                tone: "danger",
                typeToConfirm: "RESET",
              })
            ) {
              try {
                await reset({ token, confirm: "RESET" });
              } catch (e) {
                setError(errorMessage(e));
              }
            }
          }}
        >
          Reset event
        </Button>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out on this device
        </Button>
      </Card>
      {dialog}
    </PhoneShell>
  );
}

function ParticipantRow({
  p,
  token,
  canRemove,
  confirm,
}: {
  p: PublicParticipant;
  token: string;
  canRemove: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const update = useMutation(api.participants.adminUpdate);
  const remove = useMutation(api.participants.adminRemove);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.firstName);
  const [level, setLevel] = useState<Level>(p.experience);
  const [error, setError] = useState<string | null>(null);
  const id = p.id as Id<"participants">;

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-border px-3"
            aria-label="First name"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
            className="min-h-11 rounded-xl border border-border bg-surface px-2"
            aria-label="Experience"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              try {
                await update({ token, id, firstName: name, experience: level });
                setEditing(false);
                setError(null);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2.5">
      <span className="flex-1 font-semibold">
        {p.firstName}
        {p.isTest ? <span className="ml-1 rounded bg-ink/10 px-1 text-xs">TEST</span> : null}
      </span>
      <span className="text-[13px]">
        <LevelPill level={p.experience} />
      </span>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Edit
      </Button>
      {canRemove ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remove ${p.firstName}`}
          onClick={async () => {
            if (await confirm({ title: `Remove ${p.firstName}?`, confirmLabel: "Remove", tone: "danger" })) {
              await remove({ token, id }).catch((e) => setError(errorMessage(e)));
            }
          }}
        >
          ✕
        </Button>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </li>
  );
}

function TeamNameRow({ team, token }: { team: PublicTeam; token: string }) {
  const rename = useMutation(api.teams.adminRename);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [error, setError] = useState<string | null>(null);
  const isDefault = team.name === defaultTeamName(team.key);
  const save = async (next: string | null) => {
    try {
      await rename({ token, teamId: team.id, name: next });
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <li className="flex flex-col gap-2 py-2.5">
      {editing ? (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={TEAM_NAME_MAX_LENGTH}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border px-3"
            aria-label={`New name for ${team.name}`}
          />
          <Button size="sm" onClick={() => save(name)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex-1 font-semibold">
            {teamSymbol(team.key)} {team.name}
            {isDefault ? null : <span className="ml-1 font-normal text-ink-muted">({defaultTeamName(team.key)})</span>}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(team.name);
              setEditing(true);
            }}
          >
            Rename
          </Button>
          {isDefault ? null : (
            <Button size="sm" variant="ghost" onClick={() => save(null)}>
              Reset
            </Button>
          )}
        </div>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </li>
  );
}

/** Read-only list of everyone by team, with a one-time rejoin QR for anyone who's lost their phone or tab. */
function PlayersCard({ state, token }: { state: PublicState; token: string }) {
  const byId = new Map(state.participants.map((p) => [p.id, p]));
  const groups = state.teams.map((t) => ({
    key: t.id as string,
    title: `${teamSymbol(t.key)} ${t.name}`,
    members: t.memberIds.map((id) => byId.get(id)).filter((p): p is PublicParticipant => !!p),
    captainId: t.captainId as string | null,
  }));
  const assigned = new Set(state.teams.flatMap((t) => t.memberIds as string[]));
  const unassigned = state.participants.filter((p) => !assigned.has(p.id));
  if (unassigned.length) groups.push({ key: "none", title: state.teams.length ? "No team" : "Checked in", members: unassigned, captainId: null });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-xl font-bold">Players and teams</h2>
      <p className="text-sm text-ink-muted">
        Lost their phone or a private tab? Tap <strong>Rejoin QR</strong> and let them scan it from this screen. It works
        once, for 15 minutes. Never show it on the big screen.
      </p>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col">
          <h3 className="font-semibold">{g.title}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {g.members.map((p) => (
              <PlayerRow key={p.id} p={p} captain={p.id === g.captainId} token={token} />
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

function PlayerRow({ p, captain, token }: { p: PublicParticipant; captain: boolean; token: string }) {
  const issue = useMutation(api.participants.issueRejoin);
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-col gap-2 py-2.5">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-semibold">
          {p.firstName}
          {captain ? <span className="ml-1 text-xs font-normal text-ink-muted">captain</span> : null}
        </span>
        <span className="text-[13px]">
          <LevelPill level={p.experience} />
        </span>
        {link ? (
          <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
            Hide
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                const { code, expiresAt } = await issue({ token, id: p.id as Id<"participants"> });
                setLink({ url: rejoinUrl(code), expiresAt });
                setError(null);
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            Rejoin QR
          </Button>
        )}
      </div>
      {link ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-border">
          <QRCodeSVG value={link.url} level="M" marginSize={2} className="block size-56" fgColor="#162A36" bgColor="#FFFFFF" />
          <span className="text-center text-sm text-ink-muted">
            {p.firstName} scans this with their camera. Works once, until{" "}
            {new Date(link.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
          </span>
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </li>
  );
}
