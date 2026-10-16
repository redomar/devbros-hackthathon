import { useEffect, useState } from "react";
import { useConvex } from "convex/react";

export type Connection = "connecting" | "live" | "reconnecting";

export function useConnection(): Connection {
  const client = useConvex();
  const read = (): Connection => {
    const s = client.connectionState();
    if (s.isWebSocketConnected) return "live";
    return s.hasEverConnected ? "reconnecting" : "connecting";
  };
  const [state, setState] = useState<Connection>(read);
  useEffect(() => {
    setState(read());
    return client.subscribeToConnectionState(() => setState(read()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  return state;
}
