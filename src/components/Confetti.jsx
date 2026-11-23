import { forwardRef, useImperativeHandle, useRef } from "react";
import { reduceMotion } from "../motion";

const COLORS = ["#ee1c24", "#ee1c24", "#ffffff", "#2f9e6e", "#e2b456"];

// Exposes burst(originElement) to fire confetti from the centre of an element.
const Confetti = forwardRef(function Confetti(_, ref) {
  const canvas = useRef(null);

  useImperativeHandle(ref, () => ({
    burst(origin) {
      if (reduceMotion()) return;
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!ctx || !origin) return;
      const r = devicePixelRatio || 1;
      c.width = innerWidth * r; c.height = innerHeight * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
      const box = origin.getBoundingClientRect();
      const ox = box.left + box.width / 2, oy = box.top + box.height / 2;
      const bits = Array.from({ length: 120 }, () => {
        const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
        return {
          x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4,
          w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
      });
      const start = performance.now();
      const frame = (t) => {
        const age = t - start;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        ctx.globalAlpha = Math.max(0, 1 - age / 2200);
        for (const b of bits) {
          b.vy += 0.22; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
          ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
          ctx.restore();
        }
        if (age < 2200) requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, innerWidth, innerHeight);
      };
      requestAnimationFrame(frame);
    },
  }));

  return <canvas id="confetti" ref={canvas} aria-hidden="true" />;
});

export default Confetti;
