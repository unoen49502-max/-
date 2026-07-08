'use strict';
const { ellipseRing, starPoly, runeTicks, planePt } = require('../magic');
const { rng, TAU } = require('../draw');

// 魔法陣・炎 (fire) — a pentagram in a flickering ring, embers rising off the
// floor. Seamless loop. Deep red -> orange -> yellow -> white.
const SIZE = 48, CX = 24, CY = 30, F = 0.42;

module.exports = {
  name: 'magic_02_fire',
  size: SIZE, frames: 24, fps: 22, bg: [20, 10, 8], loop: true,
  ramp: [
    { t: 0.10, color: [0.40, 0.06, 0.03], a: 1 }, // dark red outline
    { t: 0.24, color: [0.95, 0.24, 0.07], a: 1 }, // red-orange
    { t: 0.42, color: [1.00, 0.50, 0.10], a: 1 }, // orange
    { t: 0.62, color: [1.00, 0.82, 0.30], a: 1 }, // yellow
    { t: 0.82, color: [1.00, 0.98, 0.82], a: 1 }, // white-hot
  ],

  render(canvas, t) {
    const spin = t * TAU;
    const R = rng(22);
    // fast flicker modulating the whole seal
    const flick = 0.72 + 0.28 * Math.sin(t * TAU * 3) * Math.sin(t * TAU * 5 + 1);

    ellipseRing(canvas, CX, CY, 19, F, 1.4, 0.95 * flick);
    ellipseRing(canvas, CX, CY, 13, F, 1.0, 0.8 * flick);

    // pentagram, slow spin
    starPoly(canvas, CX, CY, F, 12, 5, -spin * 0.5 - Math.PI / 2, 2, 1.0, 1.2 * flick);

    // flame spikes flickering around the outer ring (radial, jittered length)
    for (let i = 0; i < 20; i++) {
      const th = (i / 20) * TAU + spin * 0.5;
      const len = 2.5 + 2.5 * Math.abs(Math.sin(t * TAU * 2 + i * 1.7));
      const a = planePt(CX, CY, F, 19, th);
      const b = planePt(CX, CY, F, 19 + len, th);
      // draw a quick tapered spike
      const steps = 6;
      for (let sI = 0; sI <= steps; sI++) {
        const u = sI / steps;
        const px = a[0] + (b[0] - a[0]) * u;
        const py = a[1] + (b[1] - a[1]) * u;
        canvas.addSoft(px, py, [1, 1, 1], (1 - u) * 0.9 * flick);
      }
    }

    canvas.disc(CX, CY, 4 + Math.sin(t * TAU * 3), [1, 1, 1], 0.75 * flick, 2.2);

    // rising embers — more numerous & flickery than arcane
    for (let i = 0; i < 20; i++) {
      const ph = (t + i / 20) % 1;
      const ang = (i / 20) * TAU + i;
      const rr = 4 + (i % 5) * 3.2;
      const base = planePt(CX, CY, F, rr, ang);
      const y = base[1] - ph * 24;
      const al = Math.sin(ph * Math.PI) * (0.7 + 0.3 * Math.sin(i * 3 + t * 20));
      canvas.addSoft(base[0] + Math.sin(ph * 8 + i) * 1.6, y, [1, 1, 1], al);
    }
  },
};
