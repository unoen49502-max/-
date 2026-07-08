'use strict';
const { mix } = require('./draw');

// Build a discrete slash ramp (dark coloured edge -> white-hot core) for the
// pixel-art quantiser. Returns bands sorted ascending by intensity threshold.
// edge  = outer blade colour, core = inner hot colour (usually near-white).
function slashRamp(edge, core = [1, 1, 1], opts = {}) {
  const {
    glow = null,          // optional dim outer glow colour (partial alpha band)
    glowT = 0.035,
    glowA = 0.5,
  } = opts;
  const ramp = [];
  if (glow) ramp.push({ t: glowT, color: glow, a: glowA });
  ramp.push({ t: 0.075, color: mix(edge, [0, 0, 0], 0.45), a: 1 });
  ramp.push({ t: 0.17, color: edge, a: 1 });
  ramp.push({ t: 0.33, color: mix(edge, core, 0.45), a: 1 });
  ramp.push({ t: 0.54, color: mix(edge, core, 0.78), a: 1 });
  ramp.push({ t: 0.78, color: core, a: 1 });
  return ramp;
}

// A few named palettes for variety across the slash set.
const P = {
  cyan:   { edge: [0.20, 0.55, 1.00], core: [0.90, 0.98, 1.00], glow: [0.06, 0.14, 0.34] },
  crimson:{ edge: [1.00, 0.22, 0.20], core: [1.00, 0.92, 0.80], glow: [0.30, 0.05, 0.06] },
  emerald:{ edge: [0.20, 1.00, 0.55], core: [0.92, 1.00, 0.90], glow: [0.05, 0.24, 0.12] },
  violet: { edge: [0.66, 0.32, 1.00], core: [0.97, 0.92, 1.00], glow: [0.16, 0.07, 0.30] },
  gold:   { edge: [1.00, 0.72, 0.14], core: [1.00, 0.98, 0.85], glow: [0.28, 0.16, 0.02] },
};

function ramp(name) {
  const p = P[name];
  return slashRamp(p.edge, p.core, { glow: p.glow });
}

module.exports = { slashRamp, ramp, P };
