import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { PublicState } from "../../lib/useEvent";
import { getAdminToken, setAdminToken } from "../../lib/storage";
import { isSoundEnabled, setSoundEnabled } from "../../lib/sound";
import { OrganiserControls } from "../OrganiserControls";
import { Button, Notice } from "../ui";

const AUTO_HIDE_MS = 20_000;

/**
 * Discreet corner tray on the projected screen. Hidden until the corner is tapped and auto-hides.
 * Everything here is visible to the room, so it never shows the token or anything private.
 */
export function OrganiserTray({ state, now }: { state: PublicState; now: number }) {
  const [token, setToken] = useState(() => getAdminToken());
  const valid = useQuery(api.event.checkAdmin, token ? { token } : "skip");
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const lastTouch = useRef(Date.now());

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      const dialogOpen = document.querySelector("dialog[open]") !== null;
      if (!dialogOpen && Date.now() - lastTouch.current > AUTO_HIDE_MS) setOpen(false);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Close on every phase change so the tray never covers a reveal.
  useEffect(() => setOpen(false), [state.phase]);

  const touch = () => {
    lastTouch.current = Date.now();
  };

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Hide organiser controls" : "Show organiser controls"}
        onClick={() => {
          touch();
          setOpen((o) => !o);
        }}
        className="fixed right-0 bottom-0 z-50 grid size-16 place-items-center"
      >
        <span className={`size-3 rounded-full transition-opacity ${open ? "bg-primary opacity-100" : "bg-ink opacity-15"}`} />
      </button>
      {open ? (
        <div
          ref={panel}
          onPointerDown={touch}
          onKeyDown={touch}
          style={{ fontSize: 16 }}
          className="fixed right-4 bottom-16 z-50 flex w-[min(36rem,calc(100vw-2rem))] flex-col gap-4 rounded-3xl border border-border bg-surface/95 p-5 shadow-2xl backdrop-blur"
        >
          {token && valid ? (
            <>
              <OrganiserControls state={state} token={token} now={now} />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <SoundToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAdminToken(null);
                    setToken(null);
                  }}
                >
                  Unpair this screen
                </Button>
              </div>
            </>
          ) : (
            <PairForm
              invalid={Boolean(token) && valid === false}
              onPair={(t) => {
                setAdminToken(t);
                setToken(t);
              }}
            />
          )}
        </div>
      ) : null}
    </>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(isSoundEnabled);
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setSoundEnabled(e.target.checked);
          setOn(e.target.checked);
        }}
        className="size-5 accent-primary"
      />
      Sound alerts (timer changes, Salah reminder)
    </label>
  );
}

function PairForm({ invalid, onPair }: { invalid: boolean; onPair: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onPair(value.trim().toLowerCase());
      }}
    >
      <div>
        <h2 className="font-display text-xl font-bold">Pair this screen</h2>
        <p className="text-sm text-ink-muted">
          Enter the organiser code <strong>before</strong> connecting to the projector. It's typed as a password, so it isn't shown.
        </p>
      </div>
      {invalid ? <Notice tone="error">That code wasn't recognised.</Notice> : null}
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          placeholder="xxxx-xxxx-xxxx"
          className="min-h-12 flex-1 rounded-xl border border-border px-3 text-base"
          aria-label="Organiser code"
        />
        <Button type="submit">Pair</Button>
      </div>
    </form>
  );
}
