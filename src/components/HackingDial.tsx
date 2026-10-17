import type { CSSProperties } from "react";
import type { PublicState } from "../lib/useEvent";
import type { Hacking } from "../lib/hacking";
import { PRAYER_LABEL } from "../../shared/salah";
import { formatClock, formatCountdown } from "../../shared/time";

export type DialMode = "focus" | "break" | "prayer" | "paused" | "finished";

export function dialMode(state: PublicState, h: Hacking): DialMode {
  if (h.status.prayer) return "prayer";
  if (h.status.finished) return "finished";
  if (state.clock.pausedReason === "manual") return "paused";
  return h.status.block.kind;
}

// Fixed hexes rather than theme classes: SVG strokes and computed styles need raw colours.
const ARC = {
  focus: { live: "#087a62", done: "#a9d4c5" },
  break: { live: "#5fa3d4", done: "#cfe3f2" },
};
const PILL: Record<DialMode, { bg: string; fg: string }> = {
  focus: { bg: "#dff0e9", fg: "#087a62" },
  break: { bg: "#e1eef8", fg: "#0f5c8c" },
  prayer: { bg: "#f7ebd2", fg: "#7a5413" },
  paused: { bg: "#edf1ef", fg: "#526571" },
  finished: { bg: "#dff0e9", fg: "#087a62" },
};
const PROGRESS: Record<DialMode, string> = {
  focus: "#087a62",
  break: "#187bb8",
  prayer: "#b98224",
  paused: "#7b8b94",
  finished: "#087a62",
};

const C = 100;
const RING_R = 88;
const GAP_DEG = 0.8;

function point(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
}

function arc(r: number, from: number, to: number) {
  const a = point(r, from);
  const b = point(r, to);
  return `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
}

/** Percent position on the dial for HTML overlays (badges). */
function place(r: number, deg: number): CSSProperties {
  const p = point(r, deg);
  return { left: `${p.x / 2}%`, top: `${p.y / 2}%` };
}

/**
 * The whole hacking session as one clock face: blocks around the ring, a hand at the hacking time
 * done so far, prayer-break badges where they happened, and the current block in the middle.
 */
export function HackingDial({ state, h }: { state: PublicState; h: Hacking }) {
  const { status, totalMs, plan, projection } = h;
  const mode = dialMode(state, h);
  const deg = (ms: number) => (ms / totalMs) * 360;
  const handDeg = deg(status.elapsedMs);
  const clock = (ms: number) => formatClock(ms, state.timeZone);

  const blockProgress =
    mode === "prayer"
      ? 1 - status.prayerRemainingMs / h.prayerMs
      : mode === "finished"
        ? 1
        : (status.elapsedMs - status.block.startMs) / (status.block.endMs - status.block.startMs);

  let pill: string;
  let heading: string;
  let countdown: string | null;
  let sub: string;
  if (mode === "prayer") {
    pill = "Prayer break";
    heading = PRAYER_LABEL[status.prayer!.prayer];
    countdown = formatCountdown(status.prayerRemainingMs);
    sub = `Hacking resumes at ${clock(status.prayer!.endsAt)}`;
  } else if (mode === "finished") {
    pill = `${formatHours(totalMs)} hacked`;
    heading = "Time's up";
    countdown = null;
    sub = "Voting is next";
  } else {
    const isFocus = status.block.kind === "focus";
    pill =
      mode === "paused"
        ? "Paused"
        : isFocus
          ? `Block ${status.block.number} of ${h.focusBlocks}`
          : `${state.settings.breakMinutes}-minute break`;
    heading = isFocus ? "Focus" : "Break";
    countdown = formatCountdown(status.blockRemainingMs);
    sub =
      mode === "paused"
        ? "Waiting for the organisers"
        : status.next
          ? `${status.next.kind === "focus" ? `Focus ${status.next.number}` : "Break"} at ${clock(h.wallAt(status.block.endMs))}`
          : `Hacking ends at ${clock(h.wallAt(totalMs))}`;
  }

  const calm = mode === "prayer" || mode === "paused";
  const hand = mode === "prayer" ? "#b98224" : "#162a36";
  const hours = Array.from({ length: Math.floor((totalMs - 1) / 3_600_000) + 1 }, (_, i) => i);

  return (
    <div className="relative aspect-square w-full" style={{ containerType: "inline-size" }} role="img" aria-label={`${heading}, ${countdown ?? ""} ${sub}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full drop-shadow-[0_10px_30px_rgb(22_42_54/0.10)]" aria-hidden>
        <circle cx={C} cy={C} r={97} fill="#ffffff" />
        {plan.map((b, i) => {
          const done = status.elapsedMs >= b.endMs;
          return (
            <path
              key={i}
              d={arc(RING_R, deg(b.startMs) + GAP_DEG / 2, deg(b.endMs) - GAP_DEG / 2)}
              fill="none"
              stroke={ARC[b.kind][done ? "done" : "live"]}
              strokeWidth={16}
              className="transition-[stroke] duration-700"
            />
          );
        })}
        {plan.map((b, i) => {
          if (b.kind !== "focus" || deg(b.endMs - b.startMs) < 14) return null;
          const p = point(RING_R, deg((b.startMs + b.endMs) / 2));
          return (
            <text
              key={`n${i}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7.5}
              fontWeight={800}
              fill="#ffffff"
              opacity={status.elapsedMs >= b.endMs ? 0.75 : 1}
            >
              {b.number}
            </text>
          );
        })}
        {hours.map((i) => {
          const p = point(70, deg(i * 3_600_000));
          return (
            <text key={`h${i}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={5.6} fontWeight={800} fill="#7b8b94">
              {i === 0 ? "Start" : `${i}h`}
            </text>
          );
        })}
        <circle cx={C} cy={C} r={60} fill="none" stroke="#edf1ef" strokeWidth={3.5} />
        <circle
          cx={C}
          cy={C}
          r={60}
          fill="none"
          stroke={PROGRESS[mode]}
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(0, Math.min(1, blockProgress)) * 100} 100`}
          transform={`rotate(-90 ${C} ${C})`}
          className="transition-[stroke-dasharray] duration-500 ease-linear"
        />
        <g transform={`rotate(${handDeg.toFixed(3)} ${C} ${C})`}>
          <line x1={C} y1={3} x2={C} y2={24} stroke={hand} strokeWidth={3} strokeLinecap="round" />
          <circle cx={C} cy={3.5} r={4} fill={hand} stroke="#ffffff" strokeWidth={1.5} />
        </g>
      </svg>

      {state.clock.prayersTaken.map((t) => (
        <Badge key={t.prayer} style={place(RING_R, deg(t.atMs))} tone={status.prayer?.prayer === t.prayer ? "now" : "done"}>
          {PRAYER_LABEL[t.prayer]}
        </Badge>
      ))}
      {projection.pending.map((p) => (
        <Badge key={p.prayer} style={place(RING_R, deg(p.atMs))} tone="due">
          {PRAYER_LABEL[p.prayer]}
        </Badge>
      ))}

      <div className="absolute inset-[22%] flex flex-col items-center justify-center gap-[0.6cqw] text-center">
        <span
          className="rounded-full font-extrabold uppercase"
          style={{ background: PILL[mode].bg, color: PILL[mode].fg, fontSize: "2.4cqw", letterSpacing: "0.12em", padding: "0.8cqw 2cqw" }}
        >
          {pill}
        </span>
        <span className="font-display font-extrabold leading-none" style={{ color: PILL[mode].fg, fontSize: calm ? "10cqw" : "8.6cqw", marginTop: "1cqw" }}>
          {heading}
        </span>
        {countdown ? (
          <span
            className={`tabular font-display font-bold leading-none tracking-tight ${calm ? "text-ink-muted" : "text-ink"}`}
            style={{ fontSize: calm ? "9.5cqw" : "16cqw" }}
          >
            {countdown}
          </span>
        ) : null}
        <span className="font-bold text-ink-muted" style={{ fontSize: "2.9cqw" }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

function Badge({ style, tone, children }: { style: CSSProperties; tone: "done" | "due" | "now"; children: string }) {
  const look = {
    done: "bg-gold-bright text-ink border-white border-[0.5cqw]",
    now: "bg-gold text-white border-white border-[0.5cqw] shadow-[0_0_0_1cqw_rgb(226_176_74/0.45)]",
    due: "bg-surface text-[#7a5413] border-gold border-dashed border-[0.35cqw]",
  }[tone];
  return (
    <span
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full font-extrabold ${look}`}
      style={{ ...style, fontSize: "2.4cqw", padding: "0.5cqw 1.8cqw" }}
    >
      {children}
    </span>
  );
}

function formatHours(ms: number): string {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
