import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { ReconnectBanner } from "./Connection";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="paper min-h-dvh">
      <ReconnectBanner />
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-10">
        <header className="flex items-center justify-between">
          <Brand />
        </header>
        {children}
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
