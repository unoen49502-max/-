'use strict';
const { filledStar, twinkle } = require('../star');
const { beam, ease, rng, TAU } = require('../draw');

// 流れ星 — a shooting star streaks in on a comet tail and bursts into sparkles on
// impact. Magical-girl strike. Aqua/cyan. One-shot.
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const P0 = [44, 5], TARGET = [19, 33];
const IMPACT = 0.5;

module.exports = {
  name: 'star_03_shooting',
  size: 48, frames: 14, fps: 20, bg: [8, 12, 20],
  ramp: [
    { t: 0.10, color: [0.10, 0.18, 0.55], a: 1 },
    { t: 0.24, color: [0.20, 0.60, 1.00], a: 1 },
    { t: 0.42, color: [0.38, 0.88, 1.00], a: 1 },
    { t: 0.62, color: [0.72, 0.97, 1.00], a: 1 },
    { t: 0.82, color: [1.00, 1.00, 1.00], a: 1 },
  ],

  render(canvas, t) {
    const R = rng(730);
    const fly = ease.inQuad(seg(t, 0, IMPACT));           // accelerate into impact
    const hx = P0[0] + (TARGET[0] - P0[0]) * fly;
    const hy = P0[1] + (TARGET[1] - P0[1]) * fly;
    const dx = TARGET[0] - P0[0], dy = TARGET[1] - P0[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;

    // approach: comet tail + star head
    if (t < IMPACT + 0.02) {
      const tail = 28 * (0.45 + 0.55 * fly);
      beam(canvas, hx, hy, hx - ux * tail, hy - uy * tail, {
        halfWidth: 2.2, coreColor: [1, 1, 1], edgeColor: [0.4, 0.85, 1],
        intensity: 1.2, widthProfile: (u) => 1 - u, brightProfile: (u) => Math.pow(1 - u, 1.7), crossPow: 1.6,
      });
      filledStar(canvas, hx, hy, 5, 0.42, 5, t * TAU * 2 - Math.PI / 2, 1.3);
      twinkle(canvas, hx, hy, 5, 0.7, Math.PI / 4);
      // faint sparkle flecks shedding off the tail
      for (let i = 0; i < 5; i++) {
        const b = R();
        const px = hx - ux * b * tail + (R() - 0.5) * 3;
        const py = hy - uy * b * tail + (R() - 0.5) * 3;
        canvas.addSoft(px, py, [1, 1, 1], (1 - b) * 0.6);
      }
    }

    // impact burst at the target
    const post = seg(t, IMPACT, 1);
    if (post > 0) {
      const out = ease.outQuint(post);
      const flash = Math.sin(seg(t, IMPACT, IMPACT + 0.18) * Math.PI);
      if (flash > 0.01) {
        canvas.disc(TARGET[0], TARGET[1], 6 * flash + 2, [1, 1, 1], 2.4 * flash, 2.6);
        twinkle(canvas, TARGET[0], TARGET[1], 11 * flash + 2, 1.1 * flash, Math.PI / 4);
      }

      const N = 6;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU + 0.5;
        const d = out * (14 + (i % 2) * 4);
        const sz = 4 - 2.4 * out;
        const al = 1 - post * 0.9;
        if (sz > 0.8 && al > 0.05) filledStar(canvas, TARGET[0] + Math.cos(ang) * d, TARGET[1] + Math.sin(ang) * d, sz, 0.42, 5, ang + t * TAU, al);
      }
      for (let i = 0; i < 10; i++) {
        const ang = R() * TAU;
        const d = out * (5 + R() * 16);
        const life = (post * 1.5 + R()) % 1;
        const tw = Math.sin(life * Math.PI);
        if (tw > 0.05) twinkle(canvas, TARGET[0] + Math.cos(ang) * d, TARGET[1] + Math.sin(ang) * d, 2 + R() * 3.5, tw * 0.85, R() * TAU);
      }
    }
  },
};
