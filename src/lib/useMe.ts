import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getDeviceId, resetDeviceId } from "./storage";

/**
 * This phone's registration. If it disappears (an organiser removed it, or the event was reset),
 * the phone forgets its device id so it starts fresh instead of holding on to a stale identity.
 */
export function useMe() {
  const [deviceId, setDeviceId] = useState(getDeviceId);
  const me = useQuery(api.event.me, { deviceId });
  const wasRegistered = useRef(false);

  const forget = useCallback(() => {
    wasRegistered.current = false;
    setDeviceId(resetDeviceId());
  }, []);

  useEffect(() => {
    if (me) wasRegistered.current = true;
    else if (me === null && wasRegistered.current) forget();
  }, [me, forget]);

  return { deviceId, me, forget };
}
