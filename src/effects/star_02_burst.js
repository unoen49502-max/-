'use strict';
const { filledStar, twinkle } = require('../star');
const { ease, rng, TAU } = require('../draw');

// スターバースト — a star charges then bursts into a shower of little stars and
// kirakira twinkles. Magical-girl AoE. Gold. One-shot.
const CX = 24, CY = 24;

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

module.exports = {
  name: 'star_02_burst',
  size: 48, frames: 14, fps: 20, bg: [18, 12, 6],
  ramp: [
    { t: 0.10, color: [0.45, 0.20, 0.05], a: 1 },
    { t: 0.24, color: [1.00, 0.62, 0.12], a: 1 },
    { t: 0.42, color: [1.00, 0.80, 0.28], a: 1 },
    { t: 0.62, color: [1.00, 0.93, 0.62], a: 1 },
    { t: 0.82, color: [1.00, 1.00, 1.00], a: 1 },
  ],

  render(canvas, t) {
    const R = rng(720);
    const charge = seg(t, 0, 0.28);
    const flash = Math.sin(seg(t, 0.18, 0.4) * Math.PI);
    const out = ease.outQuint(seg(t, 0.28, 1));
    const post = seg(t, 0.28, 1);

    // 1. charging central star (grows + spins, then vanishes into the flash)
    if (t < 0.34) {
      const sz = 4 + 8 * ease.outCubic(charge);
      filledStar(canvas, CX, CY, sz, 0.42, 5, t * TAU * 1.5 - Math.PI / 2, 0.7 + 0.8 * charge);
    }

    // 2. flash pop at the burst moment
    if (flash > 0.01) canvas.disc(CX, CY, 10 * flash + 3, [1, 1, 1], 1.3 * flash, 2.2);

    // 3. shower of little stars flying outward
    if (post > 0) {
      const N = 7;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU + 0.4;
        const dist = out * (16 + (i % 3) * 3);
        const px = CX + Math.cos(ang) * dist;
        const py = CY + Math.sin(ang) * dist;
        const sz = (4.5 - 2.5 * out) * (1 - 0.3 * (i % 2));
        const al = (1 - post * 0.85);
        if (sz > 0.8 && al > 0.05) {
          filledStar(canvas, px, py, sz, 0.42, 5, ang + t * TAU, 1.1 * al);
        }
      }
    }

    // 4. kirakira twinkles scattered in the blast, popping at random phases
    for (let i = 0; i < 12; i++) {
      const ang = R() * TAU;
      const dist = out * (6 + R() * 18);
      const px = CX + Math.cos(ang) * dist;
      const py = CY + Math.sin(ang) * dist;
      const life = (post * 1.4 + R()) % 1;
      const tw = Math.sin(life * Math.PI);
      if (tw > 0.05 && post > 0.02) twinkle(canvas, px, py, 2 + R() * 4, tw * 0.9, R() * TAU);
    }

    // 5. glitter dust
    if (post > 0) {
      for (let i = 0; i < 18; i++) {
        const ang = R() * TAU;
        const d = out * (8 + R() * 20);
        const al = (1 - post) * 1.1;
        canvas.addSoft(CX + Math.cos(ang) * d, CY + Math.sin(ang) * d, [1, 1, 1], al);
      }
    }
  },
};
