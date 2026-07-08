'use strict';

const TAU = Math.PI * 2;

// ---- easing ---------------------------------------------------------------
const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inQuad: (t) => t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

// ---- seeded RNG (mulberry32) ---------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- color ---------------------------------------------------------------
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function scale(c, k) {
  return [c[0] * k, c[1] * k, c[2] * k];
}

// Normalise an angle into (-PI, PI].
function wrapAngle(a) {
  while (a <= -Math.PI) a += TAU;
  while (a > Math.PI) a -= TAU;
  return a;
}

// Core primitive: a crescent "slash" band rasterised in polar space.
// Two ends taper to points (thicknessProfile), and brightness ramps from the
// trailing tail (u=0) to the leading head (u=1). The cross-section carries a
// white-hot core that fades to `edgeColor` outward.
//
// opts:
//   cx, cy, radius       centre + sweep radius of the arc
//   a0, a1               tail angle -> head angle (radians; a1 is the leading edge)
//   maxThick             peak half-thickness (px) at the fat middle
//   coreColor, edgeColor bright inner colour / outer colour
//   intensity            overall brightness multiplier
//   thickProfile(u)      0..1 shape of the crescent along its length
//   brightProfile(u)     0..1 brightness along its length (trail fade)
//   crossPow             cross-section sharpness (higher = thinner hot core)
//   coreBias             how much of the cross-section stays white (0..1)
function slashBand(canvas, opts) {
  const {
    cx, cy, radius,
    a0, a1,
    maxThick,
    coreColor = [1, 1, 1],
    edgeColor = [0.4, 0.7, 1],
    intensity = 1,
    thickProfile = (u) => Math.pow(Math.sin(Math.PI * u), 0.7),
    brightProfile = (u) => 0.15 + 0.85 * u,
    crossPow = 1.6,
    coreBias = 0.35,
    radialBow = 0, // px: how much the arc radius bulges outward at the middle
  } = opts;

  // span may be up to a full turn (spin slashes). Direction from its sign.
  const span = a1 - a0;
  const absSpan = Math.min(Math.abs(span), TAU);
  const dir = span >= 0 ? 1 : -1;

  const rMax = radius + maxThick + Math.abs(radialBow) + 2;
  const x0 = Math.max(0, Math.floor(cx - rMax));
  const x1 = Math.min(canvas.w - 1, Math.ceil(cx + rMax));
  const y0 = Math.max(0, Math.floor(cy - rMax));
  const y1 = Math.min(canvas.h - 1, Math.ceil(cy + rMax));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r < radius - maxThick - 2 || r > rMax) continue;
      const ang = Math.atan2(dy, dx);
      // u along the band, 0 at tail -> 1 at head. Positive modulo along the
      // sweep direction so spans up to a full turn rasterise correctly.
      let rel = (ang - a0) * dir;
      rel = rel - TAU * Math.floor(rel / TAU); // -> [0, TAU)
      const u = rel / absSpan;
      if (u > 1) continue;
      const ht = maxThick * thickProfile(u);
      if (ht <= 0.01) continue;
      const rr = radius + radialBow * Math.sin(Math.PI * u);
      const dr = r - rr;
      const t = dr / ht; // -1..1 across the blade
      if (t < -1 || t > 1) continue;
      const cross = Math.pow(1 - Math.abs(t), crossPow);
      const bright = brightProfile(u);
      const inten = cross * bright * intensity;
      if (inten <= 0.001) continue;
      // colour: white core near centre -> edge colour toward the rim
      const edgeMix = Math.min(1, Math.abs(t) / (1 - coreBias + 1e-6));
      const col = mix(coreColor, edgeColor, Math.pow(edgeMix, 1.2));
      canvas.add(x, y, col, inten);
    }
  }
}

// A straight tapered beam (thrust / linear slashes), rasterised along a segment.
function beam(canvas, x1, y1, x2, y2, opts) {
  const {
    halfWidth = 4,
    coreColor = [1, 1, 1],
    edgeColor = [0.5, 0.8, 1],
    intensity = 1,
    widthProfile = (u) => Math.sin(Math.PI * u), // taper both ends
    brightProfile = (u) => 0.2 + 0.8 * u,
    crossPow = 1.6,
    coreBias = 0.35,
  } = opts;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const steps = Math.ceil(len * 1.5);
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const px = x1 + dx * u;
    const py = y1 + dy * u;
    const hw = halfWidth * widthProfile(u);
    const bright = brightProfile(u);
    const wSteps = Math.ceil(hw * 2.2);
    for (let k = -wSteps; k <= wSteps; k++) {
      const t = (k / (wSteps + 1e-6));
      if (Math.abs(t) > 1) continue;
      const cross = Math.pow(1 - Math.abs(t), crossPow);
      const edgeMix = Math.min(1, Math.abs(t) / (1 - coreBias + 1e-6));
      const col = mix(coreColor, edgeColor, Math.pow(edgeMix, 1.2));
      const gx = px + nx * t * hw;
      const gy = py + ny * t * hw;
      canvas.addSoft(gx, gy, col, cross * bright * intensity * 0.9);
    }
  }
}

module.exports = { TAU, ease, rng, mix, scale, wrapAngle, slashBand, beam };
