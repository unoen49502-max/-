'use strict';
const { filledStar, twinkle } = require('../star');
const { ease, rng, TAU } = require('../draw');

// スターショット — a spinning star bolt fired across the screen with a glittery
// kirakira trail. Magical-girl projectile. Hot pink. One-shot.
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const P0 = [7, 40], P1 = [42, 9];
const pos = (p) => [P0[0] + (P1[0] - P0[0]) * p, P0[1] + (P1[1] - P0[1]) * p];

module.exports = {
  name: 'star_01_shot',
  size: 48, frames: 12, fps: 20, bg: [18, 8, 14],
  ramp: [
    { t: 0.10, color: [0.50, 0.06, 0.32], a: 1 },
    { t: 0.24, color: [1.00, 0.22, 0.55], a: 1 },
    { t: 0.42, color: [1.00, 0.45, 0.72], a: 1 },
    { t: 0.62, color: [1.00, 0.75, 0.90], a: 1 },
    { t: 0.82, color: [1.00, 1.00, 1.00], a: 1 },
  ],

  render(canvas, t) {
    const R = rng(710);
    const p = Math.pow(seg(t, 0.08, 1), 1.25);   // launch, then accelerate out
    const here = pos(p);

    // charge flare at the muzzle before launch
    if (t < 0.14) {
      const a = 1 - t / 0.14;
      canvas.disc(P0[0], P0[1], 4 * a + 1.5, [1, 1, 1], 0.9 * a, 2.2);
    }

    // glittery trail: fading twinkles + dust along the path already travelled
    for (let k = 1; k <= 6; k++) {
      const pb = p - k * 0.085;
      if (pb < 0) continue;
      const q = pos(pb);
      const fade = (1 - k / 7);
      twinkle(canvas, q[0] + (R() - 0.5), q[1] + (R() - 0.5), 2.4 * fade + 0.6, 0.7 * fade, k * 0.7);
      canvas.addSoft(q[0] + (R() - 0.5) * 3, q[1] + (R() - 0.5) * 3, [1, 1, 1], 0.5 * fade);
    }

    // the star bolt itself, spinning, with an overlaid sparkle
    if (p < 1.02) {
      const sz = 6.5 + 0.6 * Math.sin(t * TAU * 3);
      filledStar(canvas, here[0], here[1], sz, 0.42, 5, t * TAU * 3 - Math.PI / 2, 1.25);
      twinkle(canvas, here[0], here[1], 4.5, 0.5 + 0.2 * Math.sin(t * TAU * 4), Math.PI / 4);
    }
  },
};
