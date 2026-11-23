// Generates src/assets/confetti.json: an original Lottie confetti burst in the brand colours.
// Each piece uses a handful of eased keyframes (a rise/fall arc is an exact quadratic bezier),
// which keeps the file small. Run: node scripts/make-confetti.mjs
import { writeFileSync } from "node:fs";

const W = 800, H = 800, FPS = 60, FRAMES = 180, COUNT = 110;
const COLORS = ["#2b3681", "#2b3681", "#ee1c25", "#ee1c25", "#f2b632", "#9aa3d9"];

let seed = 20261217;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const hex = (h) => [1, 3, 5].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));
const R = Math.round;

// bezier handles
const EASE_OUT_QUAD = { o: { x: [0.333], y: [0.667] }, i: { x: [0.667], y: [1] } };
const EASE_IN_QUAD = { o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [0.333] } };
const EASE_OUT = { o: { x: [0.2], y: [0.8] }, i: { x: [0.5], y: [1] } };
const LINEAR = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };
const SMOOTH = { o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } };

// keys: [[t, value, ease?], ...] ; the last key carries no ease
const track = (keys) => ({
  a: 1,
  k: keys.map(([t, v, ease]) => ({ t: R(t), s: Array.isArray(v) ? v : [v], ...(ease || {}) })),
});
const ease3 = (e) => ({ o: { x: [e.o.x[0], e.o.x[0], e.o.x[0]], y: [e.o.y[0], e.o.y[0], e.o.y[0]] },
                        i: { x: [e.i.x[0], e.i.x[0], e.i.x[0]], y: [e.i.y[0], e.i.y[0], e.i.y[0]] } });

const layers = [];
for (let n = 0; n < COUNT; n++) {
  const left = n % 2 === 0; // two cannons in the lower corners, firing up and inwards
  const x0 = left ? 30 : W - 30, y0 = H - 40;
  const t0 = R(rand() * 12);
  const up = 14 + rand() * 9;               // initial upward speed (px/frame)
  const g = 0.38;                           // gravity on the way up
  const tRise = up / g;                     // frames to apex
  const apex = Math.max(40, y0 - (up * tRise) / 2);
  const gFall = 0.09 + rand() * 0.06;       // paper falls slowly (drag)
  const tFall = Math.sqrt((2 * (H + 40 - apex)) / gFall);
  const tApex = t0 + tRise, tEnd = Math.min(FRAMES, tApex + tFall);
  const drift = (left ? 1 : -1) * (120 + rand() * 380);
  const xEnd = x0 + drift + (rand() - 0.5) * 120;

  const rot0 = R(rand() * 360), spins = (rand() - 0.5) * 1440;
  const flipEvery = 8 + rand() * 14;
  const flips = [];
  for (let t = t0, s = 100; t < tEnd; t += flipEvery, s = -s) flips.push([t, [s, 100, 100], ease3(SMOOTH)]);
  flips.push([tEnd, [flips.length % 2 ? -100 : 100, 100, 100]]);

  const round = rand() < 0.25;
  const w = round ? 10 : R(8 + rand() * 9), h = round ? 10 : R(5 + rand() * 6);

  layers.push({
    ddd: 0, ind: n + 1, ty: 4, nm: `p${n}`, sr: 1, ao: 0, ip: t0, op: R(tEnd), st: 0, bm: 0,
    ks: {
      o: track([[t0, 100, LINEAR], [tEnd - 20, 100, LINEAR], [tEnd, 0]]),
      r: track([[t0, rot0, LINEAR], [tEnd, R(rot0 + spins)]]),
      p: {
        s: true,
        x: track([[t0, x0, EASE_OUT], [tEnd, R(xEnd)]]),
        y: track([[t0, y0, EASE_OUT_QUAD], [tApex, R(apex), EASE_IN_QUAD], [tEnd, H + 40]]),
      },
      a: { a: 0, k: [0, 0, 0] },
      s: track(flips),
    },
    shapes: [{
      ty: "gr", nm: "g",
      it: [
        round
          ? { ty: "el", d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: [0, 0] } }
          : { ty: "rc", d: 1, s: { a: 0, k: [w, h] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 1 } },
        { ty: "fl", c: { a: 0, k: [...hex(COLORS[Math.floor(rand() * COLORS.length)]), 1] }, o: { a: 0, k: 100 }, r: 1 },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ],
    }],
  });
}

const anim = { v: "5.7.4", fr: FPS, ip: 0, op: FRAMES, w: W, h: H, nm: "confetti", ddd: 0, assets: [], layers };
writeFileSync(new URL("../src/assets/confetti.json", import.meta.url), JSON.stringify(anim));
console.log(`wrote ${layers.length} particles`);
