import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PublicState } from "../lib/useEvent";
import { errorMessage } from "../lib/errors";
import { formatClock, formatCountdown } from "../../shared/time";
import { PRAYER_LABEL } from "../../shared/salah";
import { hacking } from "../lib/hacking";
import { teamSizes } from "../../shared/fairness";
import { Button, Notice } from "./ui";
import { useConfirm } from "./ConfirmDialog";

type Props = { state: PublicState; token: string; now: number; pendingVoters?: string[] };

/** Phase-aware organiser buttons. Shared by the iPad tray and the phone admin page. */
export function OrganiserControls({ state, token, now, pendingVoters }: Props) {
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const m = {
    makeTeams: useMutation(api.flow.makeTeams),
    reshuffle: useMutation(api.flow.reshuffle),
    backToArrivals: useMutation(api.flow.backToArrivals),
    holdReveal: useMutation(api.flow.holdReveal),
    continueReveal: useMutation(api.flow.continueReveal),
    startHackathon: useMutation(api.flow.startHackathon),
    pause: useMutation(api.flow.pause),
    startPrayerBreak: useMutation(api.flow.startPrayerBreak),
    resume: useMutation(api.flow.resume),
    skipSession: useMutation(api.flow.skipSession),
    restartSession: useMutation(api.flow.restartSession),
    startVoting: useMutation(api.flow.startVoting),
    reopenHackathon: useMutation(api.flow.reopenHackathon),
    closeVoting: useMutation(api.flow.closeVoting),
    revealResults: useMutation(api.flow.revealResults),
    restartVoting: useMutation(api.flow.restartVoting),
  };

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const guarded = async (key: string, options: Parameters<typeof confirm>[0], action: () => Promise<unknown>) => {
    if (await confirm(options)) await run(key, action);
  };

  const count = state.participants.length;
  const expected = state.settings.expectedParticipants;
  let buttons: ReactNode = null;

  switch (state.phase) {
    case "setup": {
      const sizes = teamSizes(count, 3).join(" / ");
      buttons = (
        <>
          <Button
            size="lg"
            busy={busy === "ready"}
            disabled={count < 3}
            onClick={() =>
              guarded(
                "ready",
                count === expected
                  ? {
                      title: "Ready to make teams?",
                      body: `This closes check-in and draws 3 balanced teams of ${sizes}, each with a randomly chosen captain.`,
                      confirmLabel: "Make teams",
                    }
                  : {
                      title: `${count} checked in, ${expected} expected`,
                      body: `Teams will be ${sizes}. Make teams with ${count} brothers anyway?`,
                      confirmLabel: `Make teams with ${count}`,
                      tone: "gold",
                    },
                () => m.makeTeams({ token, acceptCount: count !== expected }),
              )
            }
          >
            Ready: make teams
          </Button>
          <Status>
            {count} / {expected} checked in
          </Status>
        </>
      );
      break;
    }
    case "team_reveal": {
      const held = state.revealEndsAt === null;
      buttons = (
        <>
          <Button size="lg" busy={busy === "start"} onClick={() => run("start", () => m.startHackathon({ token }))}>
            Start hackathon now
          </Button>
          {held ? (
            state.revealHeldMs !== null ? (
              <Button variant="secondary" busy={busy === "continue"} onClick={() => run("continue", () => m.continueReveal({ token }))}>
                Continue countdown ({formatCountdown(state.revealHeldMs)})
              </Button>
            ) : null
          ) : (
            <Button variant="secondary" busy={busy === "hold"} onClick={() => run("hold", () => m.holdReveal({ token }))}>
              Hold countdown
            </Button>
          )}
          <Button
            variant="secondary"
            busy={busy === "reshuffle"}
            onClick={() =>
              guarded(
                "reshuffle",
                { title: "Reshuffle teams?", body: "Draws new balanced teams and new captains.", confirmLabel: "Reshuffle" },
                () => m.reshuffle({ token }),
              )
            }
          >
            Reshuffle
          </Button>
          <Button
            variant="ghost"
            busy={busy === "back"}
            onClick={() =>
              guarded(
                "back",
                { title: "Back to check-in?", body: "Clears the teams and reopens check-in for latecomers.", confirmLabel: "Reopen check-in" },
                () => m.backToArrivals({ token }),
              )
            }
          >
            Reopen check-in
          </Button>
          {state.revealEndsAt !== null ? <Status>Auto-start in {formatCountdown(state.revealEndsAt - now)}</Status> : null}
        </>
      );
      break;
    }
    case "hackathon": {
      const h = hacking(state, now);
      const { status } = h;
      const blockName = status.block.kind === "focus" ? `focus ${status.block.number}` : "break";
      buttons = status.prayer ? (
        <>
          <Button size="lg" busy={busy === "resume"} onClick={() => run("resume", () => m.resume({ token }))}>
            End {PRAYER_LABEL[status.prayer.prayer]} break now
          </Button>
          <Status>
            {PRAYER_LABEL[status.prayer.prayer]} break · {formatCountdown(status.prayerRemainingMs)} left, then hacking resumes
          </Status>
        </>
      ) : (
        <>
          {h.callable && !status.finished ? (
            <Button size="lg" variant="gold" busy={busy === "prayer"} onClick={() => run("prayer", () => m.startPrayerBreak({ token, prayer: h.callable! }))}>
              Start {PRAYER_LABEL[h.callable]} break · {state.settings.prayerBreakMinutes} min
            </Button>
          ) : h.nextPrayer && !status.finished ? (
            <Button size="lg" variant="secondary" disabled>
              {PRAYER_LABEL[h.nextPrayer.prayer]} break from {formatClock(h.nextPrayer.startAt, state.timeZone)}
            </Button>
          ) : null}
          {status.finished ? null : status.running ? (
            <Button size="lg" variant="secondary" busy={busy === "pause"} onClick={() => run("pause", () => m.pause({ token }))}>
              Pause
            </Button>
          ) : (
            <Button size="lg" busy={busy === "resume"} onClick={() => run("resume", () => m.resume({ token }))}>
              Resume
            </Button>
          )}
          {status.finished ? null : (
            <>
              <Button
                variant="secondary"
                busy={busy === "skip"}
                onClick={() =>
                  guarded(
                    "skip",
                    {
                      title: status.next ? `Skip to ${status.next.kind === "focus" ? `focus ${status.next.number}` : "the break"}?` : "End hacking now?",
                      body: "Hacking time jumps to the end of this block.",
                      confirmLabel: "Skip",
                    },
                    () => m.skipSession({ token }),
                  )
                }
              >
                Skip {blockName}
              </Button>
              <Button
                variant="ghost"
                busy={busy === "restart"}
                onClick={() =>
                  guarded(
                    "restart",
                    { title: `Restart ${blockName}?`, body: "The countdown goes back to this block's full length.", confirmLabel: "Restart" },
                    () => m.restartSession({ token }),
                  )
                }
              >
                Restart {blockName}
              </Button>
            </>
          )}
          <Button
            variant="primary"
            busy={busy === "vote"}
            onClick={() =>
              guarded(
                "vote",
                {
                  title: "Start voting?",
                  body: status.finished
                    ? "Shows the voting QR code. Everyone votes once for another team."
                    : "Hacking time isn't over yet. This stops the clock and shows the voting QR code.",
                  confirmLabel: "Start voting",
                  tone: "gold",
                },
                () => m.startVoting({ token }),
              )
            }
          >
            Start voting
          </Button>
          <Status>
            {status.finished
              ? "Hacking time is over"
              : `${status.prayer ? "" : `${blockName[0].toUpperCase()}${blockName.slice(1)} · ${formatCountdown(status.blockRemainingMs)} left · `}finishes ~${formatClock(h.projection.finishAt, state.timeZone)}`}
          </Status>
        </>
      );
      break;
    }
    case "voting": {
      const missing = state.eligibleVoters - state.votesReceived;
      buttons = (
        <>
          <Button
            size="lg"
            busy={busy === "close"}
            onClick={() =>
              guarded(
                "close",
                missing > 0
                  ? {
                      title: `${missing} still to vote`,
                      body: (
                        <>
                          Close voting early? They won't be able to vote afterwards.
                          {pendingVoters?.length ? <span className="mt-2 block font-semibold text-ink">Waiting on: {pendingVoters.join(", ")}</span> : null}
                        </>
                      ),
                      confirmLabel: "Close voting anyway",
                      tone: "danger",
                    }
                  : { title: "Close voting?", body: "Everyone has voted.", confirmLabel: "Close voting" },
                () => m.closeVoting({ token }),
              )
            }
          >
            Close voting
          </Button>
          <Button
            variant="ghost"
            busy={busy === "reopen"}
            onClick={() =>
              guarded(
                "reopen",
                { title: "Back to hacking?", body: "Cancels voting and clears any votes cast so far. The timer stays paused.", confirmLabel: "Back to hacking", tone: "danger" },
                () => m.reopenHackathon({ token }),
              )
            }
          >
            Back to hacking
          </Button>
          <Status>
            {state.votesReceived} / {state.eligibleVoters} votes
          </Status>
        </>
      );
      break;
    }
    case "results_pending":
      buttons = (
        <>
          <Button size="lg" variant="gold" busy={busy === "reveal"} onClick={() => run("reveal", () => m.revealResults({ token }))}>
            Reveal the winner
          </Button>
          <RestartVoting busy={busy} guarded={guarded} restart={() => m.restartVoting({ token })} />
        </>
      );
      break;
    case "results":
      buttons = <RestartVoting busy={busy} guarded={guarded} restart={() => m.restartVoting({ token })} />;
      break;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {dialog}
    </div>
  );
}

function RestartVoting({
  busy,
  guarded,
  restart,
}: {
  busy: string | null;
  guarded: (key: string, options: { title: string; body?: ReactNode; confirmLabel?: string; tone?: "danger" }, action: () => Promise<unknown>) => Promise<void>;
  restart: () => Promise<unknown>;
}) {
  return (
    <Button
      variant="danger"
      busy={busy === "revote"}
      onClick={() =>
        guarded(
          "revote",
          {
            title: "Restart voting?",
            body: "All votes are wiped and everyone votes again. Individual ballots can't be corrected because they aren't stored.",
            confirmLabel: "Wipe and restart voting",
            tone: "danger",
          },
          restart,
        )
      }
    >
      Restart voting
    </Button>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <span className="tabular px-2 text-sm font-semibold text-ink-muted">{children}</span>;
}
