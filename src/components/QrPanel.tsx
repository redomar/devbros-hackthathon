import { QRCodeSVG } from "qrcode.react";
import { displayUrl } from "../lib/urls";

export function QrPanel({ url, title, subtitle }: { url: string; title: string; subtitle: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1.2em] rounded-[2em] bg-surface p-[2em] text-center shadow-[0_24px_60px_-28px_rgb(22_42_54/0.35)] ring-1 ring-border">
      <div>
        <div className="font-display text-[2.4em] font-bold leading-none tracking-tight">{title}</div>
        <div className="mt-[0.4em] text-[1.05em] text-ink-muted">{subtitle}</div>
      </div>
      {/* Generous white quiet zone, no motion near the code. */}
      <div className="rounded-[1.2em] bg-white p-[1.1em] ring-1 ring-border">
        <QRCodeSVG value={url} level="M" marginSize={2} className="block size-[17em]" fgColor="#162A36" bgColor="#FFFFFF" />
      </div>
      <div className="rounded-full bg-surface-muted px-[1em] py-[0.4em] font-mono text-[1.05em] font-semibold text-ink">
        {displayUrl(url)}
      </div>
    </div>
  );
}
