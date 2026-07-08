'use strict';
// Magical-girl star primitives. Like the other modules they deposit white light;
// each effect's pixel ramp colours it by intensity band.

const W = [1, 1, 1];

// Ray (from origin, angle th) vs segment A->B (both relative to the star centre).
// Returns the ray distance to the crossing, or null.
function rayEdge(th, A, B) {
  const dx = Math.cos(th), dy = Math.sin(th);
  const Ex = B.x - A.x, Ey = B.y - A.y;
  const det = -Ex * dy + dx * Ey;
  if (Math.abs(det) < 1e-9) return null;
  const s = (A.x * dy - dx * A.y) / det;
  const tt = (-Ex * A.y + A.x * Ey) / det;
  if (s >= -0.002 && s <= 1.002 && tt > 0) return tt;
  return null;
}

// Filled star polygon with a white-hot centre fading to a coloured edge.
// points=5 -> classic magical-girl star. innerRatio = valley/tip radius.
function filledStar(canvas, cx, cy, R, innerRatio, points, rot, intensity, opts = {}) {
  const { edgeVal = 0.55, coreBoost = 1 } = opts;
  const n = points * 2;
  const V = [];
  for (let i = 0; i < n; i++) {
    const ang = rot + i * (Math.PI / points);
    const rad = (i % 2 === 0) ? R : R * innerRatio;
    V.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad });
  }
  const bb = R + 2;
  const x0 = Math.max(0, Math.floor(cx - bb)), x1 = Math.min(canvas.w - 1, Math.ceil(cx + bb));
  const y0 = Math.max(0, Math.floor(cy - bb)), y1 = Math.min(canvas.h - 1, Math.ceil(cy + bb));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const rho = Math.hypot(dx, dy);
      if (rho > R + 1) continue;
      const th = Math.atan2(dy, dx);
      let bR = 0;
      for (let e = 0; e < n; e++) {
        const tt = rayEdge(th, V[e], V[(e + 1) % n]);
        if (tt != null && tt > bR) bR = tt;
      }
      if (bR <= 0 || rho > bR) continue;
      const f = rho / bR;                 // 0 centre -> 1 edge
      const val = edgeVal + (1 - edgeVal) * Math.pow(1 - f, 1.4) * coreBoost;
      canvas.add(x, y, W, val * intensity);
    }
  }
}

// A single tapered sparkle arm (bright at the centre, point at the tip).
function spike(canvas, cx, cy, ang, len, halfW, intensity) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const steps = Math.ceil(len * 1.6) + 1;
  for (let sI = 0; sI <= steps; sI++) {
    const u = sI / steps;
    const px = cx + ux * len * u, py = cy + uy * len * u;
    const w = halfW * (1 - u);
    const b = 1 - u;
    const wk = Math.ceil(w) + 1;
    for (let k = -wk; k <= wk; k++) {
      const tt = k / (w + 1e-6);
      if (Math.abs(tt) > 1) continue;
      canvas.addSoft(px + nx * k, py + ny * k, W, (1 - Math.abs(tt)) * b * intensity);
    }
  }
}

// The classic "kirakira" twinkle: a long 4-point cross + short diagonal arms +
// a bright round core.
function twinkle(canvas, cx, cy, size, intensity, rot = 0) {
  const hw = Math.max(0.7, size * 0.13);
  for (let i = 0; i < 4; i++) spike(canvas, cx, cy, rot + i * Math.PI / 2, size, hw, intensity);
  for (let i = 0; i < 4; i++) spike(canvas, cx, cy, rot + Math.PI / 4 + i * Math.PI / 2, size * 0.42, hw * 0.7, intensity * 0.55);
  canvas.disc(cx, cy, size * 0.22 + 0.8, W, intensity * 1.3, 2);
}

module.exports = { filledStar, twinkle, spike, W };
