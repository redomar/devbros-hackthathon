import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type PublicState = FunctionReturnType<typeof api.event.publicState>;
export type PublicParticipant = PublicState["participants"][number];
export type PublicTeam = PublicState["teams"][number];

export function useEventState() {
  return useQuery(api.event.publicState);
}
