import { useEffect, useRef } from "react";
import { animate, utils } from "animejs";
import { prefersReducedMotion } from "../../lib/motion";

const COLORS = ["#087a62", "#e2b04a", "#187bb8", "#8556b2", "#b98224"];

export function Confetti({ burstKey }: { burstKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || prefersReducedMotion() || burstKey === 0) return;
    const pieces: HTMLDivElement[] = [];
    for (let i = 0; i < 90; i++) {
      const el = document.createElement("div");
      el.style.cssText = `position:absolute;top:-4%;left:${utils.random(0, 100)}%;width:${utils.random(6, 12)}px;height:${utils.random(10, 18)}px;background:${COLORS[i % COLORS.length]};border-radius:2px;`;
      host.appendChild(el);
      pieces.push(el);
    }
    const animations = pieces.map((el) =>
      animate(el, {
        translateY: [0, host.clientHeight * 1.1],
        translateX: [0, utils.random(-160, 160)],
        rotate: [0, utils.random(-540, 540)],
        opacity: [{ to: 1, duration: 100 }, { to: 1, duration: 1800 }, { to: 0, duration: 600 }],
        duration: utils.random(2400, 3800),
        delay: utils.random(0, 600),
        ease: "outQuad",
        onComplete: () => el.remove(),
      }),
    );
    return () => {
      animations.forEach((a) => a.revert());
      pieces.forEach((p) => p.remove());
    };
  }, [burstKey]);
  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden" />;
}
