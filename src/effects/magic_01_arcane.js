'use strict';
const { ellipseRing, starPoly, runeTicks, planePt } = require('../magic');
const { rng, TAU } = require('../draw');

// 魔法陣・秘術 (arcane) — a hexagram sealed in twin runic rings, spinning at the
// caster's feet. Seamless loop. Violet, hue-shifted to a white-hot core.
const SIZE = 48, CX = 24, CY = 30, F = 0.42;

module.exports = {
  name: 'magic_01_arcane',
  size: SIZE, frames: 24, fps: 20, bg: [14, 10, 20], loop: true,
  ramp: [
    { t: 0.10, color: [0.22, 0.08, 0.42], a: 1 }, // deep purple outline
    { t: 0.24, color: [0.50, 0.20, 0.88], a: 1 }, // violet
    { t: 0.42, color: [0.76, 0.36, 1.00], a: 1 }, // magenta-violet
    { t: 0.62, color: [0.87, 0.66, 1.00], a: 1 }, // lilac
    { t: 0.82, color: [1.00, 1.00, 1.00], a: 1 }, // white-hot
  ],

  render(canvas, t) {
    const spin = t * TAU;                       // one turn / loop
    const pulse = 0.78 + 0.22 * Math.sin(t * TAU * 2); // gentle breathing
    const R = rng(11);

    // outer + inner rings
    ellipseRing(canvas, CX, CY, 19, F, 1.3, 0.9 * pulse);
    ellipseRing(canvas, CX, CY, 11, F, 1.0, 0.8 * pulse);

    // rune-tick ring rotating one way
    runeTicks(canvas, CX, CY, F, 15.5, 18, 16, spin, 0.7, 0.9 * pulse);

    // twin triangles (hexagram) counter-rotating, brighter
    starPoly(canvas, CX, CY, F, 10, 3, -spin, 1, 0.9, 1.15 * pulse);
    starPoly(canvas, CX, CY, F, 10, 3, -spin + Math.PI / 3, 1, 0.9, 1.15 * pulse);

    // core sigil glow (kept small so the hexagram stays readable)
    canvas.disc(CX, CY, 3 + 0.7 * Math.sin(t * TAU * 2), [1, 1, 1], 0.7 * pulse, 2.4);

    // rising arcane motes, seamlessly looping
    for (let i = 0; i < 14; i++) {
      const ph = (t + i / 14) % 1;
      const ang = (i / 14) * TAU + spin * 0.3;
      const rr = 6 + (i % 4) * 3;
      const base = planePt(CX, CY, F, rr, ang);
      const y = base[1] - ph * 20;
      const al = Math.sin(ph * Math.PI) * 0.9;
      canvas.addSoft(base[0] + Math.sin(ph * 6 + i) * 1.2, y, [1, 1, 1], al);
      if (i % 3 === 0) canvas.addSoft(base[0], y - 1, [0.7, 0.4, 1], al * 0.6);
    }
  },
};
