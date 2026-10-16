import { useRef } from "react";

/**
 * True when `phase` changed to `target` while this screen was open, i.e. the room is watching it
 * happen live. False on a reload into that phase, so reloading never replays a reveal.
 */
export function useLiveTransition<T>(phase: T | undefined, target: T): boolean {
  const first = useRef<T | undefined>(undefined);
  const live = useRef(false);
  if (phase !== undefined && first.current === undefined) first.current = phase;
  if (phase === target && first.current !== undefined && first.current !== target) live.current = true;
  if (phase !== target) live.current = false;
  return live.current;
}
