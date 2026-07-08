'use strict';
const { paintBlade, D } = require('../slashAnim');
const { slashBand, ease, rng, TAU } = require('../draw');
const { P } = require('../palette');
const { RES, K } = require('../config');
const s = (v) => v * K;

// 回転斬り — spin slash. A blade whips a full turn around the wielder, trailing a
// comet arc, then blasts out as an expanding shock-ring. Emerald.
const pal = P.emerald;

module.exports = {
  name: '04_spin',
  size: RES, frames: 18, fps: 24, bg: [9, 15, 11],
  paletteName: 'emerald',
  render(canvas, t) {
    const cx = s(64), cy = s(64);
    const R = rng(404);

    const swp = ease.outCubic(Math.min(1, t / 0.6));
    const a0 = -100 * D;
    const travel = 400 * D * swp;
    const head = a0 + travel;
    const dsp = ease.inQuad(Math.max(0, (t - 0.6) / 0.4));
    const fade = 1 - dsp;
    const grow = ease.outCubic(Math.min(1, t / 0.3));

    const span = Math.min(250 * D, travel) * (1 - 0.30 * dsp);
    const radius = s(42) + s(26) * dsp;
    const thk = s(10) * (0.5 + 0.5 * grow) * (1 - 0.6 * dsp);

    if (t < 0.4) {
      const k = 1 - t / 0.4;
      canvas.disc(cx, cy, s(9 * k + 3), pal.core, 1.0 * k, 2.2);
    }

    if (span > 3 * D && fade > 0.01) {
      paintBlade(canvas, { cx, cy, radius, tail: head - span, head, thk, fade, pal, radialBow: 0, unit: K });
    }

    const ringK = Math.sin(Math.min(1, dsp) * Math.PI);
    if (ringK > 0.02) {
      slashBand(canvas, {
        cx, cy, radius: radius + s(4), a0: -Math.PI, a1: Math.PI - 0.001,
        maxThick: s(3) + s(2) * ringK, coreColor: pal.core, edgeColor: pal.edge,
        intensity: 1.1 * ringK, crossPow: 2.0, coreBias: 0.3,
        thickProfile: () => 1, brightProfile: () => 1, radialBow: 0,
      });
    }

    if (t > 0.4) {
      const st = (t - 0.4) / 0.6;
      for (let i = 0; i < 18; i++) {
        const life = R();
        const p = st - life * 0.4;
        if (p < 0 || p > 1) continue;
        const a = R() * TAU;
        const rr = radius + p * (s(18) + s(34) * R());
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        const al = (1 - p) * 1.1;
        canvas.addSoft(px, py, i % 3 === 0 ? pal.core : pal.edge, al);
      }
    }
  },
};
