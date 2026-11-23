import { useEffect, useRef } from "react";
import { reduceMotion } from "../motion";

export default function Snow() {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (reduceMotion() || !ctx) return;

    let w, h, raf;
    const size = () => {
      const r = devicePixelRatio || 1;
      w = innerWidth; h = innerHeight;
      c.width = w * r; c.height = h * r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
    };
    size();
    addEventListener("resize", size);

    const n = Math.min(90, Math.round(innerWidth / 9));
    const flakes = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.6,
      s: 0.3 + Math.random() * 0.9, d: Math.random() * Math.PI * 2,
    }));

    const color = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--snow").trim() || "rgba(255,255,255,.5)";
    let fill = color();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => { fill = color(); };
    mq.addEventListener("change", onScheme);
    const mo = new MutationObserver(onScheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const f of flakes) {
        f.d += 0.01; f.y += f.s; f.x += Math.sin(f.d) * 0.4;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      mq.removeEventListener("change", onScheme);
      mo.disconnect();
    };
  }, []);

  return <canvas id="snow" ref={ref} aria-hidden="true" />;
}
