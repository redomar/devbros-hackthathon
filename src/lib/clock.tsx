import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const OffsetContext = createContext(0);

/**
 * Estimates the server clock offset so every screen counts down to the same server-issued
 * `endsAt`, even if a phone or the iPad clock is a little off.
 */
export function ServerClockProvider({ children }: { children: ReactNode }) {
  const serverNow = useMutation(api.event.serverNow);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const samples: number[] = [];
    const sample = async () => {
      try {
        const sent = Date.now();
        const server = await serverNow();
        const received = Date.now();
        if (received - sent > 3000) return; // too slow to be useful
        samples.push(server - (sent + received) / 2);
        if (samples.length > 5) samples.shift();
        const sorted = [...samples].sort((a, b) => a - b);
        if (!cancelled) setOffset(sorted[Math.floor(sorted.length / 2)]);
      } catch {
        // offline; keep the last estimate
      }
    };
    void sample();
    const id = window.setInterval(sample, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [serverNow]);

  return <OffsetContext.Provider value={offset}>{children}</OffsetContext.Provider>;
}

/** Server-adjusted "now", re-rendering every `tickMs`. */
export function useNow(tickMs = 250): number {
  const offset = useContext(OffsetContext);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tickMs]);
  return now + offset;
}
