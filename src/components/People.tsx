import { LEVEL_LABEL, type Level } from "../../shared/levels";

const LEVEL_DOTS: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3 };

export function LevelPill({ level, className = "" }: { level: Level; className?: string }) {
  const dots = LEVEL_DOTS[level];
  return (
    <span
      className={`inline-flex items-center gap-[0.4em] rounded-full bg-ink/5 px-[0.7em] py-[0.25em] text-[0.8em] font-semibold text-ink-muted ${className}`}
    >
      <span aria-hidden className="flex gap-[0.18em]">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`size-[0.45em] rounded-full ${i <= dots ? "bg-primary" : "bg-ink/15"}`} />
        ))}
      </span>
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function Initials({ name, className = "", tone = "bg-primary-soft text-primary-hover" }: { name: string; className?: string; tone?: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("en-GB");
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-full font-display font-bold ${tone} ${className}`}>
      {initials}
    </span>
  );
}

export function CrownIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" fill="currentColor" />
    </svg>
  );
}
