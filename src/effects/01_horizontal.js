'use strict';
const { slashBand, beam, ease, rng, mix } = require('../draw');
const { paintBlade } = require('../slashAnim');
const { RES, K } = require('../config');
const s = (v) => v * K;
const D = Math.PI / 180;

// 横薙ぎ (PRO) — commercial-grade horizontal slash.
// Built from the techniques real 2D-action / fighting-game VFX use:
//   · short frame count timed "on ones" — a fast smear, a held impact frame,
//     then a trail that cuts away quickly (no long lingering).
//   · hue-shifted ramp (indigo rim -> blue -> cyan -> white core), not a single
//     hue merely lightened — reads richer and more expensive.
//   · a leading SMEAR streak on the fastest frames (motion blur ahead of edge).
//   · an IMPACT frame: the blade whites out + a straight "cut line" streak +
//     a bloom pop + spark burst.
//   · flanking wind lines that sell the air being cut.

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const bump = (t, a, b) => Math.sin(seg(t, a, b) * Math.PI);

// hue-shifting cool ramp — the heart of the "commercial" look
const RAMP = [
  { t: 0.10, color: [0.16, 0.14, 0.52], a: 1 }, // indigo rim / outline
  { t: 0.22, color: [0.16, 0.34, 0.92], a: 1 }, // royal blue
  { t: 0.37, color: [0.18, 0.62, 1.00], a: 1 }, // azure body
  { t: 0.54, color: [0.45, 0.87, 1.00], a: 1 }, // cyan
  { t: 0.72, color: [0.80, 0.97, 1.00], a: 1 }, // light cyan
  { t: 0.89, color: [1.00, 1.00, 1.00], a: 1 }, // white-hot core
];

const cx = s(64), cy = s(106), R = s(60);
const A0 = -170 * D, A1 = -10 * D;      // tail tip -> head tip
const SPAN = A1 - A0;
const P = (ang, r = R) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];

module.exports = {
  name: '01_horizontal',
  size: RES, frames: 9, fps: 18, bg: [11, 12, 20],
  ramp: RAMP,

  // hand-timed playback: rush the smear, hold the impact, ease out the trail
  frameDelay(f, frames, fps) {
    const base = 1000 / fps;
    const w = [0.85, 0.7, 0.6, 1.75, 1.15, 1.0, 1.0, 1.15, 1.45];
    return base * (w[f] != null ? w[f] : 1);
  },

  render(canvas, t) {
    const R2 = rng(9101);
    const sweep = ease.outQuint(seg(t, 0, 0.24));
    const head = A0 + SPAN * sweep;
    const grow = ease.outCubic(seg(t, 0, 0.20));
    const dsp = ease.inQuad(seg(t, 0.52, 1.0));
    const fade = 1 - dsp;
    const smear = bump(t, 0.08, 0.34);      // motion-blur window
    const impact = bump(t, 0.26, 0.52);     // flash window (peak ~0.39)

    const tailLen = SPAN * grow * (1 - 0.45 * dsp);
    const tail = head - tailLen;
    const thick = s(14) * (0.5 + 0.5 * grow) * (1 - 0.62 * dsp);

    // 1. anticipation — a wisp gathering where the blade will enter
    if (t < 0.16) {
      const a = 1 - t / 0.16;
      slashBand(canvas, {
        cx, cy, radius: R, a0: A0 - SPAN * 0.04, a1: A0 + SPAN * 0.2,
        maxThick: s(5), coreColor: [1, 1, 1], edgeColor: [0.3, 0.5, 1],
        intensity: 0.75 * a, crossPow: 2, coreBias: 0.25,
        thickProfile: (u) => Math.sin(Math.PI * u), brightProfile: (u) => u,
      });
      const g = P(A0 + SPAN * 0.06);
      canvas.disc(g[0], g[1], s(4) * a + s(1), [1, 1, 1], 0.6 * a, 2.2);
    }

    // lagging afterimage arc — a dim ghost trailing the main blade for depth
    if (t > 0.18 && fade > 0.05) {
      const gh = ease.outCubic(seg(t, 0.06, 0.34));
      const ghHead = A0 + SPAN * gh;
      slashBand(canvas, {
        cx, cy, radius: R, a0: A0, a1: ghHead,
        maxThick: thick * 0.7, coreColor: [0.5, 0.8, 1], edgeColor: [0.14, 0.16, 0.5],
        intensity: 0.5 * fade, crossPow: 2.2, coreBias: 0.1,
        thickProfile: (u) => Math.pow(Math.sin(Math.PI * u), 0.6),
        brightProfile: (u) => 0.3 + 0.7 * u, radialBow: s(5),
      });
    }

    // 2. flanking wind lines during the fast part (air being cut)
    if (smear > 0.03 && fade > 0.2) {
      for (const off of [s(9), -s(8)]) {
        slashBand(canvas, {
          cx, cy, radius: R + off, a0: head - SPAN * 0.5, a1: head,
          maxThick: s(1.6), coreColor: [1, 1, 1], edgeColor: [0.4, 0.7, 1],
          intensity: 0.6 * smear, crossPow: 2.2, coreBias: 0.15,
          thickProfile: (u) => Math.pow(u, 0.6), brightProfile: (u) => Math.pow(u, 1.5),
        });
      }
    }

    // 3. main blade — impact boost whites it out at the strike
    if (tailLen > 3 * D && fade > 0.01) {
      paintBlade(canvas, {
        cx, cy, radius: R, tail, head, thk: thick, fade,
        pal: { edge: [0.3, 0.7, 1], core: [1, 1, 1] },
        intensity: 1 + 3.4 * impact, radialBow: s(5), unit: K,
      });
    }

    // 4. leading smear streak — motion blur shooting ahead of the edge
    if (smear > 0.03) {
      const lead = SPAN * 0.2 * smear;
      slashBand(canvas, {
        cx, cy, radius: R, a0: head, a1: head + lead,
        maxThick: thick * 0.75, coreColor: [1, 1, 1], edgeColor: [0.5, 0.85, 1],
        intensity: 1.7 * smear, crossPow: 1.5, coreBias: 0.45,
        thickProfile: (u) => Math.pow(1 - u, 0.7), brightProfile: (u) => 1 - u * 0.5,
      });
    }

    // 5. impact frame — horizontal speed streak crossing the blade + bloom pop
    if (impact > 0.03) {
      const yl = cy - R * 0.52;
      beam(canvas, cx - R * 1.18, yl, cx + R * 1.18, yl, {
        halfWidth: s(2.0) * impact + s(0.4), coreColor: [1, 1, 1], edgeColor: [0.7, 0.92, 1],
        intensity: 1.6 * impact, widthProfile: (u) => Math.sin(Math.PI * u),
        brightProfile: () => 1, crossPow: 1.6, coreBias: 0.55,
      });
      const apex = P(-90 * D);
      canvas.disc(apex[0], apex[1], s(13) * impact + s(2), [1, 1, 1], 0.85 * impact, 2.2);
    }

    // 6. spark burst — chunky, flung forward along the cut, after the strike
    if (t > 0.24) {
      const st = seg(t, 0.24, 1);
      for (let i = 0; i < 12; i++) {
        const life = R2();
        const p = st - life * 0.45;
        if (p < 0 || p > 1) continue;
        const a = head - R2() * SPAN * 0.4;
        const base = P(a, R + (R2() - 0.4) * s(8));
        const tang = a + Math.PI / 2 * (R2() < 0.5 ? 1 : -1);
        const spd = (s(20) + R2() * s(30)) * p;
        const px = base[0] + Math.cos(a) * spd * 0.6 + Math.cos(tang) * spd * 0.6;
        const py = base[1] + Math.sin(a) * spd * 0.6 + Math.sin(tang) * spd * 0.6;
        const al = (1 - p) * 1.3;
        canvas.addSoft(px, py, [1, 1, 1], al);
        canvas.addSoft(px + 0.6, py, [0.5, 0.8, 1], al * 0.6);
      }
    }
  },
};
