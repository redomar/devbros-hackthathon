import { useConnection } from "../lib/connection";

export function ConnectionDot() {
  const state = useConnection();
  const label = state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Reconnecting";
  return (
    <span className="inline-flex items-center gap-[0.4em] text-[0.8em] font-semibold text-ink-muted" role="status">
      <span className={`size-[0.6em] rounded-full ${state === "live" ? "bg-primary" : "animate-pulse bg-gold-bright"}`} />
      {label}
    </span>
  );
}

export function ReconnectBanner() {
  const state = useConnection();
  if (state === "live") return null;
  return (
    <div role="status" className="sticky top-0 z-40 bg-gold-soft px-4 py-2 text-center text-sm font-semibold text-ink">
      {state === "connecting" ? "Connecting…" : "Connection lost. Reconnecting… Anything you send will wait until we're back."}
    </div>
  );
}
