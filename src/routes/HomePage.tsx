import { Navigate } from "react-router";
import { useEventState } from "../lib/useEvent";
import { PhoneShell } from "../components/PhoneShell";
import { Spinner } from "../components/ui";

/** Anyone typing the bare URL lands on whatever their phone should be doing right now. */
export function HomePage() {
  const state = useEventState();
  if (!state) {
    return (
      <PhoneShell>
        <div className="grid place-items-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      </PhoneShell>
    );
  }
  const to = state.phase === "voting" || state.phase.startsWith("results") ? "/vote" : "/join";
  return <Navigate to={to} replace />;
}
