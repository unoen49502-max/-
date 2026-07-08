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
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// crystal hues (magical pastel)
const HUES = {
  cyan: { core: [0.85, 1.0, 1.0], body: [0.28, 0.78, 1.0], deep: [0.12, 0.32, 0.7] },
  pink: { core: [1.0, 0.9, 0.98], body: [1.0, 0.42, 0.78], deep: [0.6, 0.12, 0.4] },
  violet: { core: [0.92, 0.88, 1.0], body: [0.66, 0.4, 1.0], deep: [0.28, 0.14, 0.6] },
};

// A crystal spike (kite): tip out along dir, wide mid, base at (x,baseY).
function crystal(buf, x, baseY, height, halfW, dir, hue, glowK = 1) {
  const tipY = baseY - dir * height;
  const midY = baseY - dir * height * 0.5;
  const V = [[x, tipY], [x - halfW, midY], [x, baseY], [x + halfW, midY]];
  const minY = Math.min(tipY, baseY) - 1, maxY = Math.max(tipY, baseY) + 1;
  const inQuad = (px, py) => {
    let c = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const [xi, yi] = V[i], [xj, yj] = V[j];
      if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let py = minY | 0; py <= maxY; py++) {
    for (let px = (x - halfW - 1) | 0; px <= x + halfW + 1; px++) {
      if (!inQuad(px + 0.5, py + 0.5)) continue;
      // crisp faceted shade: two flat side faces + a bright core ridge
      const rx = (px + 0.5 - x) / (halfW + 0.001);
      const ridge = Math.abs(rx) < 0.28 ? 1 : 0;               // hard bright centre ridge
      const face = rx < -0.28 ? 0.6 : (rx > 0.28 ? 0.92 : 1);  // left facet darkest, right mid
      const vy = dir > 0 ? (baseY - (py + 0.5)) / height : ((py + 0.5) - baseY) / height; // 0 base ->1 tip
      let col = mix(hue.deep, hue.body, Math.min(1, 0.3 + vy * 0.9));
      if (ridge) col = mix(col, hue.core, 0.85);
      buf.set(px, py, [col[0] * face, col[1] * face, col[2] * face]);
    }
  }
  // emissive glow + bright tip (tighter so it stays dot-art after posterise)
  buf.glow(x, midY, halfW * 2.4 * glowK, hue.body, 0.42 * glowK, 2.6);
  buf.glow(x, tipY, halfW * 1.2 + 1.5, hue.core, 0.6 * glowK, 2.2);
}

// undulating rock edge, periodic over `period`
function rockEdge(worldX, period, base, amp, seedPhase) {
  const k = (2 * Math.PI) / period;
  return base
    + amp * 0.6 * Math.sin(k * worldX + seedPhase)
    + amp * 0.3 * Math.sin(k * 2 * worldX + seedPhase * 1.7)
    + amp * 0.18 * Math.sin(k * 3 * worldX + 2 + seedPhase);
}

// draw a rock band (ceiling if dir=-1 fills top, floor if dir=+1 fills bottom)
function rockBand(buf, off, period, dir, baseDepth, amp, seedPhase, colDark, colRim) {
  for (let x = 0; x < W; x++) {
    const wx = x + off;
    const edge = rockEdge(wx, period, baseDepth, amp, seedPhase);
    if (dir < 0) {
      for (let y = 0; y < edge; y++) {
        const rim = y > edge - 2.5 ? 1 : 0;
        buf.set(x, y, rim ? colRim : colDark);
      }
    } else {
      for (let y = Math.ceil(H - edge); y < H; y++) {
        const rim = y < H - edge + 2.5 ? 1 : 0;
        buf.set(x, y, rim ? colRim : colDark);
      }
    }
  }
}

// place items across the screen for a periodic layer
function forEachInstance(off, period, positions, cb) {
  for (const p of positions) {
    let sx = ((p.x - off) % period + period) % period;
    for (let k = -1; sx + k * period < W + period; k++) {
      const X = sx + k * period;
      if (X > -period && X < W + period) cb(X, p);
    }
  }
}

function renderFrame(f) {
  const buf = new Buf(W, H);
  const t = f / N;

  // 0. backdrop gradient (static) + faint central teal depth glow
  for (let y = 0; y < H; y++) {
    const top = [0.06, 0.05, 0.14], bot = [0.11, 0.07, 0.2];
    const col = mix(top, bot, y / H);
    for (let x = 0; x < W; x++) buf.set(x, y, col);
  }
  // faint broad depth haze low-centre (subtle, won't posterise into a blob)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - W * 0.5) / 150, (y - H * 0.62) / 60);
    if (d < 1) buf.add(x, y, [0.08, 0.4, 0.5], Math.pow(1 - d, 2) * 0.16);
  }

  // 1. far rock + distant dim crystals (slow)
  const offFar = t * 128;
  rockBand(buf, offFar, 128, -1, 20, 10, 0.5, [0.16, 0.13, 0.28], [0.3, 0.26, 0.46]);
  rockBand(buf, offFar, 128, 1, 22, 11, 2.1, [0.16, 0.13, 0.28], [0.3, 0.26, 0.46]);
  forEachInstance(offFar, 128, [
    { x: 30, h: 12, w: 3, dir: 1, hue: 'cyan' }, { x: 80, h: 10, w: 3, dir: -1, hue: 'violet' },
    { x: 110, h: 9, w: 2.5, dir: 1, hue: 'pink' },
  ], (X, p) => {
    const baseY = p.dir > 0 ? H - 14 : 16;
    crystal(buf, X, baseY, p.h, p.w, p.dir, HUES[p.hue], 0.5);
  });

  // 2. mid crystals (hero layer, medium)
  const offMid = t * 192;
  forEachInstance(offMid, 192, [
    { x: 24, h: 30, w: 6, dir: 1, hue: 'cyan' }, { x: 46, h: 20, w: 4, dir: 1, hue: 'violet' },
    { x: 92, h: 26, w: 6, dir: -1, hue: 'pink' }, { x: 110, h: 16, w: 4, dir: -1, hue: 'cyan' },
    { x: 150, h: 34, w: 7, dir: 1, hue: 'violet' }, { x: 172, h: 18, w: 4.5, dir: 1, hue: 'pink' },
  ], (X, p) => {
    const baseY = p.dir > 0 ? H - 16 : 18;
    crystal(buf, X, baseY, p.h, p.w, p.dir, HUES[p.hue], 1);
  });

  // 3. foreground dark crystals (fast, mostly silhouette)
  const offFg = t * 256;
  forEachInstance(offFg, 256, [
    { x: 40, h: 40, w: 9, dir: 1 }, { x: 130, h: 34, w: 8, dir: 1 }, { x: 200, h: 46, w: 10, dir: 1 },
  ], (X, p) => {
    const baseY = H + 2;
    // near silhouette: very dark with a faint cool rim
    crystalSilhouette(buf, X, baseY, p.h, p.w, p.dir);
  });

  // 4. ambient light motes drifting up, looping + twinkling
  const R = rng(99);
  for (let i = 0; i < 26; i++) {
    const ph = (t + R()) % 1;
    const bx = R() * W, drift = Math.sin(ph * 6 + i) * 6;
    const y = lerp(H - 6, 10, ph);
    const a = Math.sin(ph * Math.PI) * 0.9;
    const hue = [HUES.cyan.body, HUES.pink.body, HUES.violet.body][i % 3];
    buf.add(bx + drift, y, hue, a * 0.7);
    buf.add(bx + drift, y - 1, [1, 1, 1], a * 0.3);
  }

  return buf;
}

function crystalSilhouette(buf, x, baseY, height, halfW, dir) {
  const tipY = baseY - dir * height, midY = baseY - dir * height * 0.5;
  const V = [[x, tipY], [x - halfW, midY], [x, baseY], [x + halfW, midY]];
  const inQuad = (px, py) => { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = V[i], [xj, yj] = V[j]; if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
  for (let py = Math.min(tipY, baseY) | 0; py <= Math.max(tipY, baseY) + 1; py++)
    for (let px = (x - halfW - 1) | 0; px <= x + halfW + 1; px++) {
      if (!inQuad(px + 0.5, py + 0.5)) continue;
      const rx = (px + 0.5 - x) / (halfW + 0.001);
      const rim = Math.abs(rx) > 0.7 ? [0.14, 0.2, 0.4] : [0.03, 0.03, 0.08];
      buf.set(px, py, rim);
    }
}

// ---- export ----
// Posterise BRIGHTNESS only (hue/saturation preserved) so soft glows band into
// deliberate dot-art shading without shifting colours.
const LV = 7;
function bandBrightness(r, g, b) {
  const v = Math.max(r, g, b);
  if (v <= 0.0001) return [0, 0, 0];
  const vc = Math.min(1, v);
  const vq = Math.pow(Math.round(Math.pow(vc, 0.7) * (LV - 1)) / (LV - 1), 1 / 0.7);
  const s = vq / v;
  return [r * s, g * s, b * s];
}
function toPNG(buf, scale) {
  const OW = W * scale, OH = H * scale;
  const png = new PNG({ width: OW, height: OH });
  for (let sy = 0; sy < OH; sy++) for (let sx = 0; sx < OW; sx++) {
    const x = (sx / scale) | 0, y = (sy / scale) | 0, i = y * W + x, di = (sy * OW + sx) << 2;
    const [r, g, b] = bandBrightness(buf.r[i], buf.g[i], buf.b[i]);
    png.data[di] = Math.min(255, r * 255); png.data[di + 1] = Math.min(255, g * 255); png.data[di + 2] = Math.min(255, b * 255); png.data[di + 3] = 255;
  }
  return png;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const which = process.argv[2];
  if (which === 'frame') {
    const fi = parseInt(process.argv[3] || '0', 10);
    const png = toPNG(renderFrame(fi), SCALE);
    fs.writeFileSync(path.join(OUT, `frame${fi}.png`), PNG.sync.write(png));
    console.log(`wrote out/background/frame${fi}.png`);
    return;
  }
  const frames = [];
  for (let f = 0; f < N; f++) frames.push(toPNG(renderFrame(f), SCALE));
  // seamless proof: also a static wide PNG
  fs.writeFileSync(path.join(OUT, 'crystal_cave_frame.png'), PNG.sync.write(frames[0]));
  // GIF
  const enc = GIFEncoder();
  const pal = quantize(frames[8].data, 128);
  for (const fr of frames) enc.writeFrame(applyPalette(fr.data, pal), fr.width, fr.height, { palette: pal, delay: 90 });
  enc.finish();
  fs.writeFileSync(path.join(OUT, 'crystal_cave.gif'), Buffer.from(enc.bytes()));
  console.log(`wrote crystal_cave.gif (${N}f) + frame`);
}

main();
