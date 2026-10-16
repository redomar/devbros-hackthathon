import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Brand } from "./Brand";
import { ReconnectBanner } from "./Connection";
import { getAdminToken } from "../lib/storage";
import { VersionTag } from "./VersionTag";

export function PhoneShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const onAdmin = pathname.startsWith("/admin");
  // Organisers are members too: once this phone has opened the organiser link, offer a way back.
  const isOrganiser = Boolean(getAdminToken());
  return (
    <div className="paper min-h-dvh">
      <ReconnectBanner />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-5 pb-6">
        <header className="flex items-center justify-between gap-2">
          <Brand />
          {onAdmin ? (
            <Link to="/join" className="flex min-h-11 items-center rounded-full bg-surface px-3 text-sm font-semibold ring-1 ring-border">
              My check-in
            </Link>
          ) : isOrganiser ? (
            <Link to="/admin" className="flex min-h-11 items-center rounded-full bg-ink px-3 text-sm font-semibold text-page">
              Organiser
            </Link>
          ) : null}
        </header>
        {children}
        <footer className="mt-auto pt-6 text-center">
          <VersionTag />
        </footer>
      </div>
    </div>
  );
}

export function PhoneHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div>
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">{eyebrow}</p> : null}
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-balance">{title}</h1>
      {children ? <div className="mt-1 text-ink-muted">{children}</div> : null}
    </div>
  );
}
