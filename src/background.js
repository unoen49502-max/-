'use strict';
// Seamless parallax loop background — dot-art crystal cave, wide (横長).
// Each layer scrolls exactly one of its own periods over the N-frame loop, so
// the GIF cycles with no seam regardless of parallax speed.
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const W = 256, H = 104, SCALE = 3, N = 32;
const OUT = path.join(__dirname, '..', 'out', 'background');

// ---- float RGB buffer ----
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
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const TAU = Math.PI * 2;
// stable value hash for rock grain
function hash(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h >>> 0) / 4294967296; }

// crystal hues (magical pastel): edge outline / deep body / body / hot core
const HUES = {
  cyan: { edge: [0.05, 0.14, 0.34], deep: [0.12, 0.40, 0.82], body: [0.36, 0.82, 1.0], core: [0.88, 1.0, 1.0] },
  pink: { edge: [0.24, 0.05, 0.18], deep: [0.72, 0.16, 0.46], body: [1.0, 0.48, 0.80], core: [1.0, 0.92, 0.99] },
  violet: { edge: [0.12, 0.06, 0.28], deep: [0.34, 0.18, 0.68], body: [0.70, 0.46, 1.0], core: [0.94, 0.90, 1.0] },
};

// ---- a single faceted crystal spike along an axis ----
// bx,by = base; orient = axis angle (base->tip); len, hw = size; pulse scales glow.
function crystalSpike(buf, bx, by, len, hw, orient, hue, pulse = 1) {
  const ax = Math.cos(orient), ay = Math.sin(orient);   // axis (toward tip)
  const px = -ay, py = ax;                               // perpendicular
  // local outline (u along axis 0..len, v across -hw..hw): elongated gem
  const poly = [[0, -hw * 0.4], [len * 0.5, -hw], [len, 0], [len * 0.5, hw], [0, hw * 0.4]];
  const inLocal = (u, v) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ui, vi] = poly[i], [uj, vj] = poly[j];
      if (((vi > v) !== (vj > v)) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) c = !c;
    }
    return c;
  };
  const wp = poly.map(([u, v]) => [bx + ax * u + px * v, by + ay * u + py * v]);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of wp) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const dx = x + 0.5 - bx, dy = y + 0.5 - by;
      const u = dx * ax + dy * ay, v = dx * px + dy * py;
      if (!inLocal(u, v)) continue;
      const uu = clamp01(u / len), vv = v / hw;
      let col = mix(hue.deep, hue.body, clamp01(0.25 + uu * 0.85));
      if (Math.abs(vv) < 0.2) col = mix(col, hue.core, 0.75);        // bright ridge
      const facet = vv > -0.05 ? 1.0 : 0.6;                          // right lit, left shadow
      col = scl(col, facet * (uu > 0.72 ? 1.12 : 1));                // tip pyramid brighter
      if (Math.abs(vv) > 0.8) col = mix(col, hue.edge, 0.55);        // dark facet edge
      buf.set(x, y, col);
    }
  }
  // specular glint on the lit upper facet
  const sgx = bx + ax * len * 0.6 + px * hw * 0.42, sgy = by + ay * len * 0.6 + py * hw * 0.42;
  buf.set(sgx, sgy, [1, 1, 1]); buf.set(sgx + px * 0.9, sgy + py * 0.9, mix(hue.core, [1, 1, 1], 0.5));
  // emissive glow
  const tx = bx + ax * len, ty = by + ay * len, mx = bx + ax * len * 0.5, my = by + ay * len * 0.5;
  buf.glow(mx, my, hw * 2.4, hue.body, 0.34 * pulse, 2.6);
  buf.glow(tx, ty, hw * 1.3 + 2, hue.core, 0.55 * pulse, 2.2);
}

// cluster of splayed crystals rooted near (x, baseY); dir=+1 up (floor), -1 down (ceiling)
function crystalCluster(buf, x, baseY, scale, dir, hueName, seed, pulseT, glowK = 1) {
  const R = rng(seed), hue = HUES[hueName];
  const base = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  const n = 2 + Math.floor(R() * 3);
  const specs = [];
  for (let i = 0; i < n; i++) specs.push({ len: scale * (0.55 + R() * 0.7), hw: scale * (0.13 + R() * 0.09), tilt: (R() - 0.5) * 0.75, off: (R() - 0.5) * scale * 0.55, ph: R() });
  specs.sort((a, b) => a.len - b.len); // shorter crystals behind
  for (const s of specs) {
    const pulse = (0.88 + 0.12 * Math.sin((pulseT + s.ph) * TAU)) * glowK;
    crystalSpike(buf, x + s.off, baseY, s.len, s.hw, base + s.tilt, hue, pulse);
  }
}

// dark foreground crystal cluster (silhouette with faint cool rim)
function crystalClusterDark(buf, x, baseY, scale, dir, seed) {
  const R = rng(seed);
  const base = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  const n = 2 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const len = scale * (0.7 + R() * 0.6), hw = scale * (0.16 + R() * 0.08), tilt = (R() - 0.5) * 0.6, off = (R() - 0.5) * scale * 0.6;
    const ax = Math.cos(base + tilt), ay = Math.sin(base + tilt), px = -ay, py = ax;
    const poly = [[0, -hw * 0.4], [len * 0.5, -hw], [len, 0], [len * 0.5, hw], [0, hw * 0.4]];
    const inLocal = (u, v) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [ui, vi] = poly[a], [uj, vj] = poly[b]; if (((vi > v) !== (vj > v)) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) c = !c; } return c; };
    const bx = x + off, by = baseY;
    for (let yy = -1; yy <= len + 1; yy++) for (let vv2 = -hw - 1; vv2 <= hw + 1; vv2++) {
      const wx = bx + ax * yy + px * vv2, wy = by + ay * yy + py * vv2;
      if (!inLocal(yy, vv2)) continue;
      const rim = Math.abs(vv2 / hw) > 0.74 ? [0.16, 0.22, 0.42] : [0.02, 0.025, 0.07];
      buf.set(wx, wy, rim);
    }
  }
}

// undulating rock edge, periodic over `period` (extra octave = craggier lip)
function rockEdge(worldX, period, base, amp, seedPhase) {
  const k = TAU / period;
  return base
    + amp * 0.6 * Math.sin(k * worldX + seedPhase)
    + amp * 0.3 * Math.sin(k * 2 * worldX + seedPhase * 1.7)
    + amp * 0.18 * Math.sin(k * 3 * worldX + 2 + seedPhase)
    + amp * 0.1 * Math.sin(k * 5 * worldX + seedPhase * 2.3)
    + amp * 0.06 * Math.sin(k * 8 * worldX + 1);
}

// Volumetric rock band: depth-graded tones + grain dither + rim lip + cracks.
// dir<0 ceiling (fills top), dir>0 floor (fills bottom). tones = [rim,near,mid,deep,crack].
function rockBand(buf, off, period, dir, baseDepth, amp, seedPhase, tones) {
  const [rim, near, mid, deep, crack] = tones;
  for (let x = 0; x < W; x++) {
    const wx = x + off;
    const edge = rockEdge(wx, period, baseDepth, amp, seedPhase);
    const yy = dir < 0 ? [0, Math.floor(edge)] : [Math.ceil(H - edge), H];
    const ph = TAU * wx / period;                                 // periodic phase (seamless)
    const gx = ((Math.round(wx) % period) + period) % period;     // grain wrapped to period
    const crackOff = Math.floor(Math.sin(2 * ph) * 3 + Math.sin(5 * ph) * 1.6);
    for (let y = yy[0]; y < yy[1]; y++) {
      const depth = dir < 0 ? edge - y : y - (H - edge);
      let c;
      if (depth < 2) c = rim;                                     // lit lip
      else {
        const g = hash(gx, y);                                    // grain
        const dv = depth + (g - 0.5) * 3.2;                       // jitter tone bands
        c = dv < 6 ? near : dv < 14 ? mid : deep;
        if (depth > 3 && ((y + crackOff) % 11) === 0) c = crack;
        else if (g > 0.93 && depth > 2.5) c = near;               // sparse light fleck
      }
      buf.set(x, y, c);
    }
  }
}

// tiny gems embedded in rock (dim glowing dots)
function embeddedGem(buf, x, y, hueName, k = 1) {
  const h = HUES[hueName];
  buf.set(x, y, mix(h.body, [1, 1, 1], 0.3)); buf.glow(x, y, 3.5, h.body, 0.4 * k, 2);
}

// stalactite (dir=+1, hangs down from ceiling) / stalagmite (dir=-1, rises)
function rockSpike(buf, x, attachY, length, hw, dir) {
  for (let i = 0; i <= length; i++) {
    const y = attachY + dir * i;
    const w = hw * (1 - i / length);
    for (let dx = -Math.ceil(w) - 1; dx <= Math.ceil(w) + 1; dx++) {
      if (Math.abs(dx) > w) continue;
      const edge = Math.abs(dx) > w - 1.3;
      buf.set(x + dx, y, edge ? [0.24, 0.21, 0.38] : [0.10, 0.085, 0.21]);
    }
  }
}

// reflective sheen: crystal glow pooling on the floor below it
function floorReflection(buf, x, y0, len, hw, hueName, k) {
  const h = HUES[hueName];
  for (let dy = 0; dy < len; dy++) {
    const a = (1 - dy / len) * 0.5 * k;
    const ww = hw * (1 - 0.4 * dy / len);
    for (let dx = -ww; dx <= ww; dx++) buf.add(x + dx, y0 + dy, h.body, a * (1 - Math.abs(dx) / (ww + 1)));
  }
}

// faint light shaft from a ceiling crystal, widening downward
function lightShaft(buf, x, y0, len, spread, hueName, k) {
  const h = HUES[hueName];
  for (let dy = 0; dy < len; dy++) {
    const w = 1 + spread * (dy / len), a = (1 - dy / len) * 0.09 * k;
    for (let dx = -w; dx <= w; dx++) buf.add(x + dx, y0 + dy, h.body, a * (1 - Math.abs(dx) / (w + 1)));
  }
}

function forEachInstance(off, period, positions, cb) {
  for (const p of positions) {
    const sx = ((p.x - off) % period + period) % period;
    for (let k = -1; sx + k * period < W + period; k++) { const X = sx + k * period; if (X > -period && X < W + period) cb(X, p); }
  }
}

function renderFrame(f) {
  const buf = new Buf(W, H);
  const t = f / N;

  // 0. backdrop gradient + subtle depth haze + soft vignette
  for (let y = 0; y < H; y++) {
    const col = mix([0.05, 0.045, 0.13], [0.11, 0.07, 0.2], y / H);
    for (let x = 0; x < W; x++) buf.set(x, y, col);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - W * 0.5) / 150, (y - H * 0.6) / 62);
    if (d < 1) buf.add(x, y, [0.07, 0.36, 0.46], Math.pow(1 - d, 2) * 0.14);
  }

  // 1. light shafts from mid ceiling crystals (behind everything)
  const offMid = t * 192;
  forEachInstance(offMid, 192, [{ x: 92, hue: 'pink' }, { x: 150, hue: 'cyan' }], (X, p) => lightShaft(buf, X, 20, 60, 16, p.hue, 1));

  // 2. far rock walls (strata + rim) + embedded gems + distant dim crystals
  const offFar = t * 128;
  const rockTones = [[0.36, 0.32, 0.54], [0.23, 0.19, 0.38], [0.16, 0.13, 0.28], [0.10, 0.08, 0.19], [0.07, 0.055, 0.15]];
  rockBand(buf, offFar, 128, -1, 20, 10, 0.5, rockTones);
  rockBand(buf, offFar, 128, 1, 24, 11, 2.1, rockTones);
  forEachInstance(offFar, 128, [
    { x: 20, hue: 'cyan' }, { x: 58, hue: 'pink' }, { x: 95, hue: 'violet' }, { x: 118, hue: 'cyan' },
  ], (X, p) => embeddedGem(buf, X, p.x % 2 ? 12 : H - 12, p.hue, 0.8));
  forEachInstance(offFar, 128, [
    { x: 40, s: 10, dir: 1, hue: 'cyan', seed: 11 }, { x: 84, s: 9, dir: -1, hue: 'violet', seed: 12 },
  ], (X, p) => crystalCluster(buf, X, p.dir > 0 ? H - 22 : 20, p.s, p.dir, p.hue, p.seed, t, 0.5));
  // stalactites hanging from the ceiling / stalagmites on the floor
  forEachInstance(offFar, 128, [{ x: 30, l: 11, w: 3 }, { x: 72, l: 8, w: 2.5 }, { x: 108, l: 13, w: 3.5 }], (X, p) => {
    const e = rockEdge(X + offFar, 128, 20, 10, 0.5); rockSpike(buf, X, e - 1, p.l, p.w, 1);
  });
  forEachInstance(offFar, 128, [{ x: 50, l: 9, w: 3 }, { x: 100, l: 12, w: 3.5 }], (X, p) => {
    const e = rockEdge(X + offFar, 128, 24, 11, 2.1); rockSpike(buf, X, H - e + 1, p.l, p.w, -1);
  });

  // 3. reflections then mid hero crystal clusters
  const midDefs = [
    { x: 24, s: 26, dir: 1, hue: 'cyan', seed: 21 }, { x: 60, s: 18, dir: 1, hue: 'violet', seed: 22 },
    { x: 92, s: 24, dir: -1, hue: 'pink', seed: 23 }, { x: 118, s: 15, dir: -1, hue: 'cyan', seed: 24 },
    { x: 150, s: 30, dir: 1, hue: 'violet', seed: 25 }, { x: 176, s: 17, dir: 1, hue: 'pink', seed: 26 },
  ];
  forEachInstance(offMid, 192, midDefs.filter((d) => d.dir > 0), (X, p) => floorReflection(buf, X, H - 15, p.s * 0.7, p.s * 0.34, p.hue, 1));
  forEachInstance(offMid, 192, midDefs, (X, p) => crystalCluster(buf, X, p.dir > 0 ? H - 16 : 18, p.s, p.dir, p.hue, p.seed, t, 1));

  // 4. foreground silhouettes (fast)
  const offFg = t * 256;
  forEachInstance(offFg, 256, [
    { x: 40, s: 40, seed: 31 }, { x: 130, s: 34, seed: 32 }, { x: 208, s: 46, seed: 33 },
  ], (X, p) => crystalClusterDark(buf, X, H + 3, p.s, 1, p.seed));

  // 5. ambient motes + occasional twinkles
  const R = rng(99);
  for (let i = 0; i < 30; i++) {
    const ph = (t + R()) % 1, bx = R() * W, drift = Math.sin(ph * 6 + i) * 6;
    const y = lerp(H - 6, 8, ph), a = Math.sin(ph * Math.PI) * 0.85;
    const hue = [HUES.cyan.body, HUES.pink.body, HUES.violet.body][i % 3];
    buf.add(bx + drift, y, hue, a * 0.7); buf.add(bx + drift, y - 1, [1, 1, 1], a * 0.3);
  }
  return buf;
}

// ---- export: brightness-only posterise (hue preserved) for dot-art banding ----
const LV = 7;
function toPNG(buf, scale) {
  const OW = W * scale, OH = H * scale;
  const png = new PNG({ width: OW, height: OH });
  for (let sy = 0; sy < OH; sy++) for (let sx = 0; sx < OW; sx++) {
    const x = (sx / scale) | 0, y = (sy / scale) | 0, i = y * W + x, di = (sy * OW + sx) << 2;
    const r = buf.r[i], g = buf.g[i], b = buf.b[i];
    const v = Math.max(r, g, b);
    let R = 0, G = 0, B = 0;
    if (v > 0.0001) {
      const vc = Math.min(1, v);
      const vq = Math.pow(Math.round(Math.pow(vc, 0.7) * (LV - 1)) / (LV - 1), 1 / 0.7);
      const s = vq / v; R = r * s; G = g * s; B = b * s;
    }
    png.data[di] = Math.min(255, R * 255); png.data[di + 1] = Math.min(255, G * 255); png.data[di + 2] = Math.min(255, B * 255); png.data[di + 3] = 255;
  }
  return png;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const which = process.argv[2];
  if (which === 'frame') {
    const fi = parseInt(process.argv[3] || '0', 10);
    fs.writeFileSync(path.join(OUT, `frame${fi}.png`), PNG.sync.write(toPNG(renderFrame(fi), SCALE)));
    console.log(`wrote out/background/frame${fi}.png`);
    return;
  }
  const frames = [];
  for (let f = 0; f < N; f++) frames.push(toPNG(renderFrame(f), SCALE));
  fs.writeFileSync(path.join(OUT, 'crystal_cave_frame.png'), PNG.sync.write(frames[0]));
  const enc = GIFEncoder();
  const pal = quantize(frames[8].data, 160);
  for (const fr of frames) enc.writeFrame(applyPalette(fr.data, pal), fr.width, fr.height, { palette: pal, delay: 90 });
  enc.finish();
  fs.writeFileSync(path.join(OUT, 'crystal_cave.gif'), Buffer.from(enc.bytes()));
  console.log(`wrote crystal_cave.gif (${N}f) + frame`);
}

main();
