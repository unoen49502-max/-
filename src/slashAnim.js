'use strict';
const { ease, rng, slashBand, TAU } = require('./draw');
const { P } = require('./palette');

const D = Math.PI / 180;

// Build arc geometry from two blade endpoints + a bow (sagitta) in px.
// bow > 0 bows the arc to the LEFT of the p1->p2 direction, < 0 to the right.
// Returns { cx, cy, radius, aStart, aEnd } in *degrees* for arcSlash cfg.
function arcFromChord(p1, p2, bow) {
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const L = Math.hypot(dx, dy);
  const s = Math.abs(bow) || 0.0001;
  const radius = s / 2 + (L * L) / (8 * s);
  // unit perpendicular to the chord (left side of p1->p2)
  const nx = -dy / L, ny = dx / L;
  const sign = bow >= 0 ? 1 : -1;
  const d = radius - s; // centre distance from midpoint, opposite the bow
  const cx = mx - sign * nx * d;
  const cy = my - sign * ny * d;
  const aStart = Math.atan2(p1[1] - cy, p1[0] - cx) / D;
  const aEnd = Math.atan2(p2[1] - cy, p2[0] - cx) / D;
  return { cx, cy, radius, aStart, aEnd };
}

// Paint one arc blade (outer bloom + banded core + hot leading tip) between a
// tail and head angle (radians). Shared by every slash effect.
function paintBlade(canvas, g) {
  const {
    cx, cy, radius, tail, head, thk, fade = 1, pal = P.cyan,
    radialBow = 5, tip = true, intensity = 1, unit = 1,
  } = g;
  const core = pal.core, edge = pal.edge;
  if (Math.abs(head - tail) < 1.5 * D || fade <= 0.01) return;
  // tighter outer body (was a wide soft bloom) — keeps a defined coloured edge
  // without scattering faint pixels at low res
  slashBand(canvas, {
    cx, cy, radius, a0: tail, a1: head, maxThick: thk * 1.35,
    coreColor: edge, edgeColor: [edge[0] * 0.35, edge[1] * 0.4, edge[2] * 0.55],
    intensity: 0.55 * fade * intensity, crossPow: 2.0, coreBias: 0.1,
    brightProfile: (u) => 0.25 + 0.75 * u, radialBow,
  });
  // main blade — brighter floor so the whole length stays bold, not a thin comet
  slashBand(canvas, {
    cx, cy, radius, a0: tail, a1: head, maxThick: thk,
    coreColor: core, edgeColor: edge, intensity: 1.6 * fade * intensity,
    crossPow: 1.35, coreBias: 0.45,
    thickProfile: (u) => Math.pow(Math.sin(Math.PI * u), 0.5),
    brightProfile: (u) => 0.35 + 0.65 * Math.pow(u, 1.2), radialBow,
  });
  if (tip) {
    const hx = cx + Math.cos(head) * radius;
    const hy = cy + Math.sin(head) * radius;
    canvas.disc(hx, hy, (7 * fade + 1.5) * unit, core, 1.6 * fade * intensity, 2.0);
  }
}

// Tangential spark burst flung off the arc near `head` as it dissipates.
function sparkBurst(canvas, g) {
  const { cx, cy, radius, head, span, pal = P.cyan, st, seed = 7, count = 14, unit = 1 } = g;
  if (st <= 0) return;
  const R = rng(seed);
  const core = pal.core, edge = pal.edge;
  for (let i = 0; i < count; i++) {
    const life = R();
    const p = st - life * 0.5;
    if (p < 0 || p > 1) continue;
    const a = head - (0.05 + R() * 0.5) * span;
    const rr = radius + (R() - 0.3) * 10 * unit;
    const ox = cx + Math.cos(a) * rr;
    const oy = cy + Math.sin(a) * rr;
    const tang = a + Math.PI / 2 * (R() < 0.5 ? 1 : -1);
    const spd = (18 + R() * 26) * unit * p;
    const px = ox + Math.cos(a) * spd * 0.7 + Math.cos(tang) * spd * 0.5;
    const py = oy + Math.sin(a) * spd * 0.7 + Math.sin(tang) * spd * 0.5;
    const al = (1 - p) * 1.1;
    canvas.addSoft(px, py, i % 3 === 0 ? core : edge, al);
  }
}

// Reusable arc-slash animator. Handles the full slash lifecycle:
//   anticipation flash -> fast easing sweep -> dissipate + tangential sparks.
// Effects 01/02/05 are thin config wrappers over this.
//
// cfg (all optional except geometry):
//   cx, cy, radius       arc centre + sweep radius
//   aStart, aEnd (deg)   leading-edge sweep range
//   spanDeg              max visible blade length (deg)
//   thick                peak half-thickness (px)
//   pal                  { edge, core, glow } colour set
//   sweepEase            easing name for the sweep (default outQuint)
//   sweepDur, growDur    fractions of t (default .55 / .28)
//   dissipateStart       t at which the blade begins to fade (default .5)
//   radialBow            outward bulge at the blade belly (px)
//   seed                 spark RNG seed
//   sparks               enable spark burst (default true)
//   anticipate           enable pre-strike charge flash (default true)
//   sparkDir             extra fling bias along sweep (1 = forward)
function arcSlash(canvas, t, cfg) {
  // allow endpoint-based geometry: { p1, p2, bow, ... }
  if (cfg.p1 && cfg.p2) {
    const g = arcFromChord(cfg.p1, cfg.p2, cfg.bow == null ? 12 : cfg.bow);
    const fullSpan = Math.abs(g.aEnd - g.aStart);
    cfg = {
      spanDeg: fullSpan,
      ...cfg,
      cx: g.cx, cy: g.cy, radius: g.radius, aStart: g.aStart, aEnd: g.aEnd,
    };
  }
  const {
    cx, cy, radius,
    aStart, aEnd, spanDeg = 150, thick = 12,
    pal = P.cyan,
    sweepEase = 'outQuint', sweepDur = 0.55, growDur = 0.28, dissipateStart = 0.5,
    radialBow = 5, seed = 7, sparks = true, anticipate = true, unit = 1,
  } = cfg;
  const core = pal.core;
  const a0d = aStart * D, a1d = aEnd * D;

  const swp = ease[sweepEase](Math.min(1, t / sweepDur));
  const head = a0d + (a1d - a0d) * swp;
  const grow = ease.outCubic(Math.min(1, t / growDur));
  const dissipate = ease.inQuad(Math.max(0, (t - dissipateStart) / (1 - dissipateStart)));
  // span is signed by the sweep direction so the tail always trails the head,
  // whether aEnd > aStart (increasing) or aEnd < aStart (decreasing).
  const sweepDir = a1d >= a0d ? 1 : -1;
  const span = sweepDir * spanDeg * D * grow * (1 - 0.35 * dissipate);
  const tail = head - span;
  const fade = 1 - dissipate;
  const thk = thick * (0.55 + 0.45 * grow) * (1 - 0.55 * dissipate);

  if (anticipate && t < 0.22) {
    const a = 1 - t / 0.22;
    const sx = cx + Math.cos(a0d) * radius;
    const sy = cy + Math.sin(a0d) * radius;
    canvas.disc(sx, sy, (10 * a + 3) * unit, core, 0.9 * a, 2.2);
  }

  paintBlade(canvas, { cx, cy, radius, tail, head, thk, fade, pal, radialBow, unit });

  if (sparks && t > 0.35) {
    sparkBurst(canvas, { cx, cy, radius, head, span, pal, st: (t - 0.35) / 0.65, seed, unit });
  }
}

module.exports = { arcSlash, arcFromChord, paintBlade, sparkBurst, D };
