import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setDeviceId } from "../lib/storage";
import { errorMessage } from "../lib/errors";
import { PhoneHeading, PhoneShell } from "../components/PhoneShell";
import { Notice, Spinner } from "../components/ui";

/** Opened from an organiser's rejoin QR: makes this phone the brother it was issued for. */
export function RejoinPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const claim = useMutation(api.participants.claimRejoin);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // A brand-new id, so this phone can't clash with any other check-in.
    const deviceId = crypto.randomUUID();
    claim({ code, deviceId })
      .then(({ firstName }) => {
        setDeviceId(deviceId);
        setName(firstName);
        setTimeout(() => navigate("/", { replace: true }), 1200);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [claim, code, navigate]);

  return (
    <PhoneShell>
      {error ? (
        <>
          <PhoneHeading eyebrow="Rejoin" title="That link didn't work" />
          <Notice tone="error">{error}</Notice>
          <Link to="/" className="font-semibold text-primary underline">
            Go to the main page
          </Link>
        </>
      ) : name ? (
        <PhoneHeading eyebrow="Rejoin" title={`Welcome back, ${name}`}>
          You're signed in on this phone. Taking you to your team…
        </PhoneHeading>
      ) : (
        <div className="grid place-items-center py-20">
          <Spinner className="size-8 text-primary" />
        </div>
      )}
    </PhoneShell>
  );
}
