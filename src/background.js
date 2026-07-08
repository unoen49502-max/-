'use strict';
// Seamless parallax loop background — dot-art crystal cave, wide (横長).
// Depth: underground lake (backmost, aerial-hazed) · crystal ceiling · mid air ·
// perspective foreground ground. Each layer scrolls one of its own periods over
// the N-frame loop, so the GIF cycles with no seam.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const W = 256, H = 144, SCALE = 3, N = 32;
const OUT = path.join(__dirname, '..', 'out', 'background');
const TAU = Math.PI * 2;
const HAZE = [0.19, 0.18, 0.31];        // aerial-perspective haze colour

// vertical layout
const WATER_TOP = 74;                   // far shore / waterline
const WATER_BOT = 102;                  // near shore (ground begins, covers this)
const SHORE = 100;                      // ground surface base

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.r = new Float32Array(w * h); this.g = new Float32Array(w * h); this.b = new Float32Array(w * h); }
  set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2]; }
  add(x, y, c, a) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.r[i] += c[0] * a; this.g[i] += c[1] * a; this.b[i] += c[2] * a; }
  glow(cx, cy, rad, c, inten, fall = 2) {
    for (let y = Math.max(0, cy - rad | 0); y <= Math.min(this.h - 1, cy + rad); y++)
      for (let x = Math.max(0, cx - rad | 0); x <= Math.min(this.w - 1, cx + rad); x++) {
        const d = Math.hypot(x - cx, y - cy) / rad; if (d >= 1) continue;
        this.add(x, y, c, Math.pow(1 - d, fall) * inten);
      }
  }
}

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h >>> 0) / 4294967296; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

const HUES = {
  cyan: { edge: [0.05, 0.14, 0.34], deep: [0.12, 0.40, 0.82], body: [0.36, 0.82, 1.0], core: [0.88, 1.0, 1.0] },
  pink: { edge: [0.24, 0.05, 0.18], deep: [0.72, 0.16, 0.46], body: [1.0, 0.48, 0.80], core: [1.0, 0.92, 0.99] },
  violet: { edge: [0.12, 0.06, 0.28], deep: [0.34, 0.18, 0.68], body: [0.70, 0.46, 1.0], core: [0.94, 0.90, 1.0] },
};
const ROCK = [[0.36, 0.32, 0.54], [0.23, 0.19, 0.38], [0.16, 0.13, 0.28], [0.10, 0.08, 0.19], [0.07, 0.055, 0.15]];

// ---- faceted crystal spike; haze mixes toward aerial-perspective colour ----
function crystalSpike(buf, bx, by, len, hw, orient, hue, pulse = 1, haze = 0) {
  const ax = Math.cos(orient), ay = Math.sin(orient), px = -ay, py = ax;
  const poly = [[0, -hw * 0.4], [len * 0.5, -hw], [len, 0], [len * 0.5, hw], [0, hw * 0.4]];
  const inLocal = (u, v) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ui, vi] = poly[i], [uj, vj] = poly[j]; if (((vi > v) !== (vj > v)) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) c = !c; } return c; };
  const wp = poly.map(([u, v]) => [bx + ax * u + px * v, by + ay * u + py * v]);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of wp) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const dx = x + 0.5 - bx, dy = y + 0.5 - by, u = dx * ax + dy * ay, v = dx * px + dy * py;
    if (!inLocal(u, v)) continue;
    const uu = clamp01(u / len), vv = v / hw;
    let col = mix(hue.deep, hue.body, clamp01(0.25 + uu * 0.85));
    if (Math.abs(vv) < 0.2) col = mix(col, hue.core, 0.75);
    col = scl(col, (vv > -0.05 ? 1.0 : 0.6) * (uu > 0.72 ? 1.12 : 1));
    if (Math.abs(vv) > 0.8) col = mix(col, hue.edge, 0.55);
    if (haze) col = mix(col, HAZE, haze);
    buf.set(x, y, col);
  }
  const sgx = bx + ax * len * 0.6 + px * hw * 0.42, sgy = by + ay * len * 0.6 + py * hw * 0.42;
  if (haze < 0.3) buf.set(sgx, sgy, [1, 1, 1]);
  const gk = pulse * (1 - 0.7 * haze);
  buf.glow(bx + ax * len * 0.5, by + ay * len * 0.5, hw * 2.4, hue.body, 0.34 * gk, 2.6);
  buf.glow(bx + ax * len, by + ay * len, hw * 1.3 + 2, hue.core, 0.55 * gk, 2.2);
}

function crystalCluster(buf, x, baseY, scale, dir, hueName, seed, pulseT, glowK = 1, haze = 0) {
  const R = rng(seed), hue = HUES[hueName], base = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  const specs = [];
  const n = 2 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) specs.push({ len: scale * (0.55 + R() * 0.7), hw: scale * (0.13 + R() * 0.09), tilt: (R() - 0.5) * 0.75, off: (R() - 0.5) * scale * 0.55, ph: R() });
  specs.sort((a, b) => a.len - b.len);
  for (const s of specs) crystalSpike(buf, x + s.off, baseY, s.len, s.hw, base + s.tilt, hue, (0.88 + 0.12 * Math.sin((pulseT + s.ph) * TAU)) * glowK, haze);
}

function crystalClusterDark(buf, x, baseY, scale, dir, seed) {
  const R = rng(seed), base = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  const n = 2 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const len = scale * (0.7 + R() * 0.6), hw = scale * (0.16 + R() * 0.08), tilt = (R() - 0.5) * 0.6, off = (R() - 0.5) * scale * 0.6;
    const ax = Math.cos(base + tilt), ay = Math.sin(base + tilt), px = -ay, py = ax;
    const poly = [[0, -hw * 0.4], [len * 0.5, -hw], [len, 0], [len * 0.5, hw], [0, hw * 0.4]];
    const inLocal = (u, v) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [ui, vi] = poly[a], [uj, vj] = poly[b]; if (((vi > v) !== (vj > v)) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) c = !c; } return c; };
    const bx = x + off, by = baseY;
    for (let yy = -1; yy <= len + 1; yy++) for (let vv2 = -hw - 1; vv2 <= hw + 1; vv2++) {
      if (!inLocal(yy, vv2)) continue;
      buf.set(bx + ax * yy + px * vv2, by + ay * yy + py * vv2, Math.abs(vv2 / hw) > 0.74 ? [0.16, 0.22, 0.42] : [0.02, 0.025, 0.07]);
    }
  }
}

function rockEdge(wx, period, base, amp, ph) {
  const k = TAU / period;
  return base + amp * 0.6 * Math.sin(k * wx + ph) + amp * 0.3 * Math.sin(k * 2 * wx + ph * 1.7) + amp * 0.18 * Math.sin(k * 3 * wx + 2 + ph) + amp * 0.1 * Math.sin(k * 5 * wx + ph * 2.3) + amp * 0.06 * Math.sin(k * 8 * wx + 1);
}

// ceiling rock (fills top down to a craggy lip) with grain + strata + lit lip
function ceilingRock(buf, off, period, base, amp) {
  const [rim, near, mid, deep, crack] = ROCK;
  for (let x = 0; x < W; x++) {
    const wx = x + off, edge = rockEdge(wx, period, base, amp, 0.5);
    const ph = TAU * wx / period, gx = ((Math.round(wx) % period) + period) % period;
    const crackOff = Math.floor(Math.sin(2 * ph) * 3 + Math.sin(5 * ph) * 1.6);
    for (let y = 0; y < edge; y++) {
      const depth = edge - y; let c;
      if (depth < 2) c = rim;
      else { const g = hash(gx, y); const dv = depth + (g - 0.5) * 3.2; c = dv < 6 ? near : dv < 14 ? mid : deep; if (depth > 3 && ((y + crackOff) % 11) === 0) c = crack; else if (g > 0.93 && depth > 2.5) c = near; }
      buf.set(x, y, c);
    }
  }
}

function rockSpike(buf, x, attachY, length, hw, dir) {
  for (let i = 0; i <= length; i++) { const y = attachY + dir * i, w = hw * (1 - i / length); for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) { if (Math.abs(dx) > w) continue; buf.set(x + dx, y, Math.abs(dx) > w - 1.3 ? [0.24, 0.21, 0.38] : [0.10, 0.085, 0.21]); } }
}

// ---- underground lake: hazy reflective water, backmost ----
function lake(buf, off, t) {
  const period = 128;
  for (let x = 0; x < W; x++) {
    for (let y = WATER_TOP; y < WATER_BOT; y++) {
      const p = (y - WATER_TOP) / (WATER_BOT - WATER_TOP);
      let col = mix([0.06, 0.10, 0.20], [0.10, 0.15, 0.27], p);
      col = mix(col, HAZE, (1 - p) * 0.5);            // aerial haze, stronger far (top)
      buf.set(x, y, col);
    }
    // faint broken waterline shimmer (no hard full-width line); periodic = seamless
    const wph = TAU * (x + off) / period;
    const s = Math.sin(5 * wph + t * TAU) * Math.sin(2 * wph - t * TAU);
    if (s > 0.4) buf.add(x, WATER_TOP, [0.2, 0.28, 0.42], 0.3 * (s - 0.4) / 0.6);
  }
  // subtle horizontal ripple highlight lines drifting across the surface
  for (const ry of [5, 11, 18]) {
    const y = WATER_TOP + ry, p = ry / (WATER_BOT - WATER_TOP);
    for (let x = 0; x < W; x++) {
      const s = Math.sin(TAU * (x + off) / period * 3 + ry * 1.3 + t * TAU);
      if (s > 0.86) buf.add(x, y, [0.4, 0.5, 0.7], 0.28 * (1 - p));
    }
  }
  // soft colour reflections shimmering down from the surface (light columns)
  const spots = [{ x: 34, h: 'cyan' }, { x: 92, h: 'pink' }, { x: 150, h: 'violet' }, { x: 208, h: 'cyan' }];
  for (const s of spots) {
    const sx = ((s.x - off) % period + period) % period;
    for (let k = -1; sx + k * period < W; k++) {
      const X = sx + k * period, hue = HUES[s.h];
      buf.glow(X, WATER_TOP + 1, 5, hue.core, 0.5, 2);           // bright reflection root
      for (let y = WATER_TOP + 1; y < WATER_BOT; y++) {
        const p = (y - WATER_TOP) / (WATER_BOT - WATER_TOP);
        const wob = Math.sin(y * 0.55 + t * TAU + X * 0.3) * (0.8 + p * 1.2);
        const shim = 0.7 + 0.3 * Math.sin(y * 0.9 - t * TAU * 2 + X);
        const a = (1 - p) * (1 - p) * 0.55 * shim;
        buf.add(X + wob, y, hue.body, a); buf.add(X + wob - 1, y, hue.body, a * 0.4); buf.add(X + wob + 1, y, hue.body, a * 0.4);
      }
    }
  }
}

// ---- perspective foreground ground: top face recedes to the far shore ----
function groundPlane(buf, off, t) {
  const period = 256;
  for (let x = 0; x < W; x++) {
    const wx = x + off;
    const sy0 = SHORE + Math.sin(TAU * wx / period) * 3 + Math.sin(TAU * 3 * wx / period + 1) * 1.6;
    const gx = ((Math.round(wx) % period) + period) % period;
    for (let y = Math.floor(sy0); y < H; y++) {
      const p = clamp01((y - sy0) / (H - sy0));                 // 0 far shore -> 1 near front
      let col = mix([0.22, 0.20, 0.34], [0.10, 0.09, 0.19], Math.pow(p, 0.8)); // lit top -> darker front
      if (y - sy0 < 2) col = [0.34, 0.33, 0.5];                 // bright shore lip
      const g = hash(gx, y); col = scl(col, 0.88 + g * 0.24);   // grain
      col = mix(col, HAZE, (1 - p) * 0.5);                      // haze the receding far part
      buf.set(x, y, col);
    }
    // perspective grooves (denser toward the far shore)
    for (let i = 1; i < 9; i++) {
      const pp = (i / 9) * (i / 9), gy = sy0 + (H - sy0) * pp;
      buf.set(x, gy, mix([0.08, 0.07, 0.15], HAZE, (1 - pp) * 0.5));
    }
    // surface glints/pebbles, bigger toward the front
    if (hash(gx + 99, 0) > 0.8) { const gy = sy0 + (H - sy0) * (0.5 + hash(gx, 7) * 0.5); buf.add(x, gy, [0.5, 0.55, 0.7], 0.5); }
  }
}

function forEachInstance(off, period, positions, cb) {
  for (const p of positions) { const sx = ((p.x - off) % period + period) % period; for (let k = -1; sx + k * period < W + period; k++) { const X = sx + k * period; if (X > -period && X < W + period) cb(X, p); } }
}

function renderFrame(f) {
  const buf = new Buf(W, H);
  const t = f / N;

  // 0. backdrop (cave void), subtle depth glow above the lake
  for (let y = 0; y < H; y++) { const col = mix([0.05, 0.045, 0.13], [0.10, 0.08, 0.18], clamp01(y / WATER_TOP)); for (let x = 0; x < W; x++) buf.set(x, y, col); }
  for (let y = 30; y < WATER_TOP; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - W * 0.5) / 150, (y - 60) / 40); if (d < 1) buf.add(x, y, [0.08, 0.32, 0.42], Math.pow(1 - d, 2) * 0.12); }

  const offA = t * 128, offB = t * 192, offC = t * 256;

  // 1. distant crystals on the far wall (heavily hazed) — aerial perspective
  forEachInstance(offA, 128, [
    { x: 26, s: 9, dir: 1, hue: 'cyan', seed: 61 }, { x: 70, s: 8, dir: 1, hue: 'violet', seed: 62 },
    { x: 104, s: 10, dir: 1, hue: 'pink', seed: 63 },
  ], (X, p) => crystalCluster(buf, X, WATER_TOP - 2, p.s, 1, p.hue, p.seed, t, 0.4, 0.66));

  // 2. underground lake (backmost)
  lake(buf, offA, t);

  // 3. ceiling rock + stalactites + hanging crystals
  ceilingRock(buf, offB, 192, 24, 11);
  forEachInstance(offB, 192, [{ x: 34, l: 12, w: 3 }, { x: 88, l: 9, w: 2.6 }, { x: 150, l: 14, w: 3.4 }], (X, p) => { const e = rockEdge(X + offB, 192, 24, 11, 0.5); rockSpike(buf, X, e - 1, p.l, p.w, 1); });
  forEachInstance(offB, 192, [
    { x: 20, s: 22, hue: 'pink', seed: 41 }, { x: 64, s: 15, hue: 'cyan', seed: 42 },
    { x: 116, s: 24, hue: 'violet', seed: 43 }, { x: 168, s: 17, hue: 'pink', seed: 44 },
  ], (X, p) => { const e = rockEdge(X + offB, 192, 24, 11, 0.5); crystalCluster(buf, X, e - 1, p.s, -1, p.hue, p.seed, t, 0.9, 0.12); });

  // 4. perspective foreground ground
  groundPlane(buf, offC, t);

  // 5. hero crystals growing from the ground (front)
  const gy = (X) => SHORE + Math.sin(TAU * (X + offC) / 256) * 3 + Math.sin(TAU * 3 * (X + offC) / 256 + 1) * 1.6;
  forEachInstance(offC, 256, [
    { x: 30, s: 30, hue: 'cyan', seed: 51 }, { x: 70, s: 20, hue: 'violet', seed: 52 },
    { x: 120, s: 34, hue: 'pink', seed: 53 }, { x: 160, s: 18, hue: 'cyan', seed: 54 },
    { x: 205, s: 27, hue: 'violet', seed: 55 },
  ], (X, p) => crystalCluster(buf, X, gy(X) + 1, p.s, 1, p.hue, p.seed, t, 1, 0));

  // 6. near foreground silhouettes (fastest)
  forEachInstance(offC, 256, [{ x: 50, s: 40, seed: 31 }, { x: 150, s: 34, seed: 32 }, { x: 226, s: 46, seed: 33 }], (X, p) => crystalClusterDark(buf, X, H + 4, p.s, 1, p.seed));

  // 7. ambient motes
  const R = rng(99);
  for (let i = 0; i < 32; i++) { const ph = (t + R()) % 1, bx = R() * W, drift = Math.sin(ph * 6 + i) * 6, y = lerp(H - 6, 26, ph), a = Math.sin(ph * Math.PI) * 0.85, hue = [HUES.cyan.body, HUES.pink.body, HUES.violet.body][i % 3]; buf.add(bx + drift, y, hue, a * 0.7); buf.add(bx + drift, y - 1, [1, 1, 1], a * 0.3); }
  return buf;
}

// ---- export: brightness-only posterise (hue preserved) ----
const LV = 7;
function toPNG(buf, scale) {
  const OW = W * scale, OH = H * scale, png = new PNG({ width: OW, height: OH });
  for (let sy = 0; sy < OH; sy++) for (let sx = 0; sx < OW; sx++) {
    const x = (sx / scale) | 0, y = (sy / scale) | 0, i = y * W + x, di = (sy * OW + sx) << 2;
    const r = buf.r[i], g = buf.g[i], b = buf.b[i], v = Math.max(r, g, b);
    let R = 0, G = 0, B = 0;
    if (v > 0.0001) { const vc = Math.min(1, v), vq = Math.pow(Math.round(Math.pow(vc, 0.7) * (LV - 1)) / (LV - 1), 1 / 0.7), s = vq / v; R = r * s; G = g * s; B = b * s; }
    png.data[di] = Math.min(255, R * 255); png.data[di + 1] = Math.min(255, G * 255); png.data[di + 2] = Math.min(255, B * 255); png.data[di + 3] = 255;
  }
  return png;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (process.argv[2] === 'frame') { const fi = parseInt(process.argv[3] || '0', 10); fs.writeFileSync(path.join(OUT, `frame${fi}.png`), PNG.sync.write(toPNG(renderFrame(fi), SCALE))); console.log(`wrote frame${fi}.png`); return; }
  const frames = []; for (let f = 0; f < N; f++) frames.push(toPNG(renderFrame(f), SCALE));
  fs.writeFileSync(path.join(OUT, 'crystal_cave_frame.png'), PNG.sync.write(frames[0]));
  const enc = GIFEncoder(); const pal = quantize(frames[8].data, 160);
  for (const fr of frames) enc.writeFrame(applyPalette(fr.data, pal), fr.width, fr.height, { palette: pal, delay: 90 });
  enc.finish(); fs.writeFileSync(path.join(OUT, 'crystal_cave.gif'), Buffer.from(enc.bytes()));
  console.log(`wrote crystal_cave.gif (${N}f) + frame`);
}

main();
