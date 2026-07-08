'use strict';
const { paintBlade, D } = require('../slashAnim');
const { slashBand, ease, rng, TAU } = require('../draw');
const { P } = require('../palette');

// 回転斬り — spin slash. A blade whips a full turn around the wielder, trailing a
// comet arc, then blasts out as an expanding shock-ring. Emerald.
const pal = P.emerald;

module.exports = {
  name: '04_spin',
  size: 128, frames: 20, fps: 26, bg: [9, 15, 11],
  paletteName: 'emerald',
  render(canvas, t) {
    const cx = 64, cy = 64;
    const R = rng(404);

    const swp = ease.outCubic(Math.min(1, t / 0.6));
    const a0 = -100 * D;
    const travel = 400 * D * swp;      // head travels ~1.1 turns
    const head = a0 + travel;
    const dsp = ease.inQuad(Math.max(0, (t - 0.6) / 0.4));
    const fade = 1 - dsp;
    const grow = ease.outCubic(Math.min(1, t / 0.3));

    const span = Math.min(250 * D, travel) * (1 - 0.30 * dsp);
    const radius = 42 + 26 * dsp;      // ring flies outward as it dissipates
    const thk = 10 * (0.5 + 0.5 * grow) * (1 - 0.6 * dsp);

    // charge swirl at the pivot before/while spinning up
    if (t < 0.4) {
      const k = 1 - t / 0.4;
      canvas.disc(cx, cy, 9 * k + 3, pal.core, 1.0 * k, 2.2);
    }

    if (span > 3 * D && fade > 0.01) {
      paintBlade(canvas, {
        cx, cy, radius, tail: head - span, head, thk, fade, pal, radialBow: 0,
      });
    }

    // expanding shock-ring on the finish
    const ringK = Math.sin(Math.min(1, dsp) * Math.PI);
    if (ringK > 0.02) {
      slashBand(canvas, {
        cx, cy, radius: radius + 4, a0: -Math.PI, a1: Math.PI - 0.001,
        maxThick: 3 + 2 * ringK, coreColor: pal.core, edgeColor: pal.edge,
        intensity: 1.1 * ringK, crossPow: 2.0, coreBias: 0.3,
        thickProfile: () => 1, brightProfile: () => 1, radialBow: 0,
      });
    }

    // sparks flung radially outward around the ring
    if (t > 0.4) {
      const st = (t - 0.4) / 0.6;
      for (let i = 0; i < 20; i++) {
        const life = R();
        const p = st - life * 0.4;
        if (p < 0 || p > 1) continue;
        const a = R() * TAU;
        const rr = radius + p * (18 + R() * 34);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        const al = (1 - p) * 1.1;
        canvas.addSoft(px, py, i % 3 === 0 ? pal.core : pal.edge, al);
      }
    }
  },
};
