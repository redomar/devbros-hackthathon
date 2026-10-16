export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path d="M21 22l-8 10 8 10M43 22l8 10-8 10" fill="none" stroke="#F7F5EF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="5" className="fill-gold-bright" />
    </svg>
  );
}

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  if (size === "lg") {
    return (
      <div className="flex items-center gap-[0.8em]">
        <LogoMark className="size-[2.6em]" />
        <div className="leading-none">
          <div className="font-display text-[1.6em] font-bold tracking-tight">
            Dev Bros: <span className="text-primary">the Hackthathon</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-9" />
      <span className="font-display text-lg font-bold leading-tight tracking-tight">
        Dev Bros: <span className="text-primary">the Hackthathon</span>
      </span>
    </div>
  );
}
