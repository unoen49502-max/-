'use strict';
const { TAU } = require('./draw');

// Ground-plane magic-circle primitives. Everything is drawn in a flattened
// (perspective) plane so the circle lies on the floor at the character's feet:
// a plane point (radius ρ, angle θ) maps to screen (cx+ρcosθ, cy+ρsinθ·flatten).
//
// Primitives deposit plain white light; the per-effect pixel ramp colours it by
// intensity band (dim edge -> hot white core), exactly like the slash blades.

const W = [1, 1, 1];

function planePt(cx, cy, flatten, rho, theta) {
  return [cx + Math.cos(theta) * rho, cy + Math.sin(theta) * rho * flatten];
}

// Elliptical ring of uniform plane-thickness. `gate(angle)->0..1` can dash it or
// fade a sweep; `bright(angle)->mult` can modulate brightness around the ring.
function ellipseRing(canvas, cx, cy, radius, flatten, halfThick, intensity, opts = {}) {
  const { crossPow = 1.5, gate = null, bright = null } = opts;
  const rx = radius + halfThick + 2;
  const ry = radius * flatten + halfThick + 2;
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(canvas.w - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(canvas.h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = (y + 0.5 - cy) / flatten;
      const er = Math.hypot(dx, dy);
      const d = er - radius;
      if (Math.abs(d) > halfThick) continue;
      const ang = Math.atan2(dy, dx);
      let g = gate ? gate(ang) : 1;
      if (g <= 0) continue;
      if (bright) g *= bright(ang);
      const cross = Math.pow(1 - Math.abs(d) / halfThick, crossPow);
      canvas.add(x, y, W, cross * intensity * g);
    }
  }
}

// Straight glowing segment between two screen points (chords of plane shapes
// project to straight screen lines).
function seg(canvas, x1, y1, x2, y2, halfW, intensity, taper = false) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const steps = Math.ceil(len * 1.6);
  for (let sIdx = 0; sIdx <= steps; sIdx++) {
    const u = sIdx / steps;
    const px = x1 + dx * u, py = y1 + dy * u;
    const w = halfW * (taper ? Math.sin(Math.PI * u) : 1);
    const wk = Math.ceil(w) + 1;
    for (let k = -wk; k <= wk; k++) {
      const tt = k / (w + 1e-6);
      if (Math.abs(tt) > 1) continue;
      const cross = Math.pow(1 - Math.abs(tt), 1.5);
      canvas.addSoft(px + nx * k, py + ny * k, W, cross * intensity);
    }
  }
}

// Regular n-gon / star polygon in the plane. step=1 -> polygon, step=2 -> star
// (e.g. n=5,step=2 = pentagram). Connects vertices with glowing segments.
function starPoly(canvas, cx, cy, flatten, rho, n, rot, step, halfW, intensity) {
  const V = [];
  for (let i = 0; i < n; i++) V.push(planePt(cx, cy, flatten, rho, rot + (i / n) * TAU));
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const nx = (idx + step) % n;
    const a = V[idx], b = V[nx];
    seg(canvas, a[0], a[1], b[0], b[1], halfW, intensity);
    idx = nx;
  }
}

// Short radial rune dashes evenly spaced around the ring (r1 -> r2 in plane).
function runeTicks(canvas, cx, cy, flatten, r1, r2, count, rot, halfW, intensity) {
  for (let i = 0; i < count; i++) {
    const th = rot + (i / count) * TAU;
    const a = planePt(cx, cy, flatten, r1, th);
    const b = planePt(cx, cy, flatten, r2, th);
    seg(canvas, a[0], a[1], b[0], b[1], halfW, intensity, true);
  }
}

// Radial spokes from an inner to outer radius (sun-ray look).
function spokes(canvas, cx, cy, flatten, r1, r2, count, rot, halfW, intensity) {
  runeTicks(canvas, cx, cy, flatten, r1, r2, count, rot, halfW, intensity);
}

module.exports = { planePt, ellipseRing, seg, starPoly, runeTicks, spokes, W };
