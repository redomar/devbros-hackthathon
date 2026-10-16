import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEventState } from "../lib/useEvent";
import { useMe } from "../lib/useMe";
import { errorMessage } from "../lib/errors";
import { LEVELS, LEVEL_HINT, LEVEL_LABEL, type Level } from "../../shared/levels";
import { NAME_MAX_LENGTH, validateFirstName } from "../../shared/names";
import { PhoneHeading, PhoneShell } from "../components/PhoneShell";
import { MyTeam } from "../components/MyTeam";
import { LevelPill } from "../components/People";
import { Button, Card, Notice, Spinner } from "../components/ui";
import { useConfirm } from "../components/ConfirmDialog";

export function JoinPage() {
  const { deviceId, me, forget } = useMe();
  const state = useEventState();
  const [editing, setEditing] = useState(false);
  const leave = useMutation(api.participants.leave);
  const { confirm, dialog } = useConfirm();
  const [leaveError, setLeaveError] = useState<string | null>(null);

  if (state === undefined || me === undefined) {
    return (
      <PhoneShell>
        <div className="grid place-items-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      </PhoneShell>
    );
  }

  const open = state.phase === "setup";

  if (me && !editing) {
    return (
      <PhoneShell>
        <Card className="flex flex-col gap-3 p-5">
          <div className="grid size-12 place-items-center rounded-full bg-primary-soft text-2xl text-primary" aria-hidden>
            ✓
          </div>
          <PhoneHeading eyebrow="Checked in" title={`You're checked in, ${me.firstName}.`}>
            Please keep this page open or rejoin later.
          </PhoneHeading>
          <div>
            <LevelPill level={me.experience} />
          </div>
          {open ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit my details
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Remove your check-in?",
                    body: "Your name comes off the board and this phone forgets you. You can check in again any time before teams are drawn.",
                    confirmLabel: "Remove me",
                    tone: "danger",
                  });
                  if (!ok) return;
                  try {
                    await leave({ deviceId });
                    forget();
                  } catch (e) {
                    setLeaveError(errorMessage(e));
                  }
                }}
              >
                Remove me
              </Button>
            </div>
          ) : null}
          {leaveError ? <Notice tone="error">{leaveError}</Notice> : null}
        </Card>
        {dialog}
        {state.phase === "setup" ? (
          <Notice>Teams will be drawn once everyone has arrived. Watch the big screen!</Notice>
        ) : null}
        <MyTeam state={state} participantId={me.id} />
        {state.phase === "voting" ? <VoteLink /> : null}
      </PhoneShell>
    );
  }

  if (!open && !me) {
    return (
      <PhoneShell>
        <PhoneHeading eyebrow="Check-in" title="Check-in has closed">
          Teams have already been drawn. Please speak to an organiser.
        </PhoneHeading>
        {state.phase === "voting" ? <VoteLink /> : null}
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <PhoneHeading eyebrow="Assalamu alaykum" title={me ? "Edit your details" : "Check in"}>
        First name only. No sign-up, no surname.
      </PhoneHeading>
      <RegisterForm
        deviceId={deviceId}
        initialName={me?.firstName ?? ""}
        initialLevel={me?.experience ?? null}
        onDone={() => setEditing(false)}
      />
    </PhoneShell>
  );
}

function VoteLink() {
  return (
    <Link
      to="/vote"
      className="flex min-h-14 items-center justify-center rounded-2xl bg-gold-bright text-lg font-bold text-ink"
    >
      Voting is open → Vote now
    </Link>
  );
}

function RegisterForm({
  deviceId,
  initialName,
  initialLevel,
  onDone,
}: {
  deviceId: string;
  initialName: string;
  initialLevel: Level | null;
  onDone: () => void;
}) {
  const register = useMutation(api.participants.register);
  const [name, setName] = useState(initialName);
  const [level, setLevel] = useState<Level | null>(initialLevel);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameError = validateFirstName(name);

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        if (nameError || !level) return;
        setBusy(true);
        setError(null);
        try {
          // Only report success once the server acknowledges it.
          await register({ deviceId, firstName: name, experience: level });
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-semibold">Your first name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          className="min-h-14 rounded-2xl border border-border bg-surface px-4 text-lg"
          aria-invalid={touched && Boolean(nameError)}
          aria-describedby="name-help"
        />
        <span id="name-help" className={`text-sm ${touched && nameError ? "font-semibold text-danger" : "text-ink-muted"}`}>
          {touched && nameError ? nameError : "This is how you'll appear on the big screen."}
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Your AI experience</legend>
        {LEVELS.map((l) => (
          <label
            key={l}
            className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-3 transition-colors ${
              level === l ? "border-primary bg-primary-soft" : "border-border"
            }`}
          >
            <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} className="size-5 accent-primary" />
            <span className="flex flex-col">
              <span className="font-bold">{LEVEL_LABEL[l]}</span>
              <span className="text-sm text-ink-muted">{LEVEL_HINT[l]}</span>
            </span>
          </label>
        ))}
        {touched && !level ? <span className="text-sm font-semibold text-danger">Pick the closest level. There's no wrong answer.</span> : null}
      </fieldset>

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" size="lg" busy={busy}>
        {busy ? "Checking in…" : initialName ? "Save" : "Check in"}
      </Button>
      {initialName ? (
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}
