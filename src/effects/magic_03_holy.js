'use strict';
const { ellipseRing, runeTicks, spokes, planePt } = require('../magic');
const { rng, TAU } = require('../draw');

// 魔法陣・聖 (holy) — concentric rings, radiant spokes and a slow majestic spin.
// Seamless loop. Bronze -> gold -> pale gold -> white.
const SIZE = 48, CX = 24, CY = 30, F = 0.42;

module.exports = {
  name: 'magic_03_holy',
  size: SIZE, frames: 24, fps: 18, bg: [18, 14, 6], loop: true,
  ramp: [
    { t: 0.10, color: [0.40, 0.24, 0.05], a: 1 }, // bronze outline
    { t: 0.24, color: [1.00, 0.70, 0.15], a: 1 }, // gold
    { t: 0.42, color: [1.00, 0.85, 0.35], a: 1 }, // bright gold
    { t: 0.62, color: [1.00, 0.95, 0.70], a: 1 }, // pale gold
    { t: 0.82, color: [1.00, 1.00, 1.00], a: 1 }, // white
  ],

  render(canvas, t) {
    const spin = t * TAU;
    const pulse = 0.8 + 0.2 * Math.sin(t * TAU); // slow, single breath per loop

    // concentric rings (open centre — no filled inner spokes)
    ellipseRing(canvas, CX, CY, 20, F, 1.2, 0.85 * pulse);
    ellipseRing(canvas, CX, CY, 15, F, 0.9, 0.7 * pulse);
    ellipseRing(canvas, CX, CY, 6, F, 0.9, 0.85 * pulse);

    // radiant spokes between the two outer rings, slow spin
    spokes(canvas, CX, CY, F, 15.5, 19.5, 12, spin * 0.5, 0.7, 0.95 * pulse);

    // fine dashed ring counter-rotating, in the mid gap
    runeTicks(canvas, CX, CY, F, 9, 11, 24, -spin, 0.5, 0.7 * pulse);

    // small clean core sigil
    canvas.disc(CX, CY, 2.6 + 0.6 * Math.sin(t * TAU), [1, 1, 1], 0.7 * pulse, 2.6);

    // gentle rising sparkles
    for (let i = 0; i < 12; i++) {
      const ph = (t + i / 12) % 1;
      const ang = (i / 12) * TAU;
      const base = planePt(CX, CY, F, 10 + (i % 3) * 4, ang);
      const y = base[1] - ph * 18;
      const al = Math.sin(ph * Math.PI) * 0.8;
      canvas.addSoft(base[0], y, [1, 1, 1], al);
    }
  },
};
