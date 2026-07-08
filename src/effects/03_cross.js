'use strict';
const { arcFromChord, paintBlade, sparkBurst, D } = require('../slashAnim');
const { beam, ease, TAU } = require('../draw');
const { P } = require('../palette');

// 十字斬り — two blades cross into an X with a burst of light at the crossing.
// Gold. Blade A (TL->BR) leads, blade B (TR->BL) follows, then a star flash.
const pal = P.gold;
const A = arcFromChord([20, 22], [108, 106], 12);
const B = arcFromChord([108, 22], [20, 106], 12);

function sweepBlade(canvas, g, p, thk, fade) {
  const a0 = g.aStart * D, a1 = g.aEnd * D;
  const head = a0 + (a1 - a0) * p;
  paintBlade(canvas, {
    cx: g.cx, cy: g.cy, radius: g.radius, tail: a0, head, thk, fade, pal, radialBow: 2,
  });
  return head;
}

module.exports = {
  name: '03_cross',
  size: 128, frames: 18, fps: 24, bg: [16, 13, 8],
  paletteName: 'gold',
  render(canvas, t) {
    const cx = 64, cy = 64;
    const pA = ease.outQuint(Math.min(1, t / 0.34));
    const pB = ease.outQuint(Math.min(1, Math.max(0, (t - 0.24)) / 0.34));
    const dsp = ease.inQuad(Math.max(0, (t - 0.62) / 0.38));
    const fade = 1 - dsp;

    if (pA > 0) sweepBlade(canvas, A, pA, 9 * (0.6 + 0.4 * pA) * fade, fade);
    if (pB > 0) {
      const headB = sweepBlade(canvas, B, pB, 9 * (0.6 + 0.4 * pB) * fade, fade);
      // sparks off blade B tip once it crosses
      if (t > 0.42) sparkBurst(canvas, { cx: B.cx, cy: B.cy, radius: B.radius, head: headB, span: (B.aEnd - B.aStart) * D, pal, st: (t - 0.42) / 0.58, seed: 303, count: 10 });
    }

    // crossing flash: a bright 4-point star that blooms as B completes
    const flashT = Math.max(0, (t - 0.44) / 0.28);
    const flash = flashT <= 1 ? Math.sin(Math.min(1, flashT) * Math.PI) : 0;
    if (flash > 0.01) {
      const k = flash * fade;
      canvas.disc(cx, cy, 12 * k + 4, pal.core, 2.2 * k, 2.2);
      canvas.disc(cx, cy, 26 * k + 6, pal.edge, 0.5 * k, 2.6);
      const ray = 30 * k + 10;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        beam(canvas, cx, cy, cx + Math.cos(a) * ray, cy + Math.sin(a) * ray, {
          halfWidth: 2.5 * k + 0.6, coreColor: pal.core, edgeColor: pal.edge,
          intensity: 1.4 * k, widthProfile: (u) => 1 - u, brightProfile: (u) => 1 - u * 0.6, crossPow: 2,
        });
      }
    }
  },
};
