import { readStore, writeStore } from "./storage";

const KEY = "devbros.sound";
let ctx: AudioContext | null = null;

export const isSoundEnabled = () => readStore(KEY) === "on";

/** Must be called from a tap so Safari allows audio. */
export function setSoundEnabled(on: boolean) {
  writeStore(KEY, on ? "on" : "off");
  if (on) unlockAudio();
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, length: number, volume = 0.18) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + length + 0.05);
}

export type Chime = "focus" | "break" | "salah" | "reveal";

export function playChime(kind: Chime) {
  if (!isSoundEnabled() || !ctx || ctx.state !== "running") return;
  const notes: Record<Chime, number[]> = {
    focus: [523.25, 659.25, 783.99],
    break: [783.99, 659.25, 523.25],
    salah: [440, 554.37],
    reveal: [523.25, 659.25, 783.99, 1046.5],
  };
  notes[kind].forEach((f, i) => tone(f, i * 0.18, kind === "salah" ? 1.4 : 0.6));
}
