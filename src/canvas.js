'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// HDR-ish light-accumulation canvas for glow effects.
// Stores linear float RGB (additive light). Alpha for transparent sprites is
// derived from luminance at export time. This lets slash effects composite
// over any background while keeping bright cores blooming.
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.r = new Float32Array(w * h);
    this.g = new Float32Array(w * h);
    this.b = new Float32Array(w * h);
  }

  clear() {
    this.r.fill(0);
    this.g.fill(0);
    this.b.fill(0);
  }

  // Additive deposit of light with intensity `a` (0..) and color [r,g,b] in 0..1.
  add(x, y, color, a) {
    if (a <= 0) return;
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = yi * this.w + xi;
    this.r[i] += color[0] * a;
    this.g[i] += color[1] * a;
    this.b[i] += color[2] * a;
  }

  // Bilinear additive deposit for sub-pixel smooth motion of sparks/points.
  addSoft(x, y, color, a) {
    if (a <= 0) return;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    this.add(x0, y0, color, a * (1 - fx) * (1 - fy));
    this.add(x0 + 1, y0, color, a * fx * (1 - fy));
    this.add(x0, y0 + 1, color, a * (1 - fx) * fy);
    this.add(x0 + 1, y0 + 1, color, a * fx * fy);
  }

  // Filled disc of light (radial falloff) — good for glows / spark heads.
  disc(cx, cy, radius, color, intensity, falloff = 2) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (d >= 1) continue;
        const v = Math.pow(1 - d, falloff);
        this.add(x, y, color, v * intensity);
      }
    }
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Reinhard-ish tone map so bright additive cores clip to white gracefully.
function toneMap(v, exposure) {
  const x = v * exposure;
  return x / (1 + x);
}

// Nearest-neighbour upscale to a PNG buffer.
// mode 'dark'  -> composite glow over a solid bg (in-game look, opaque).
// mode 'alpha' -> transparent sprite; alpha from brightness, color un-premultiplied.
function toPNG(canvas, { scale = 4, mode = 'dark', bg = [10, 10, 16], exposure = 1.35, gamma = 0.9 } = {}) {
  const W = canvas.w * scale;
  const H = canvas.h * scale;
  const png = new PNG({ width: W, height: H });
  for (let sy = 0; sy < H; sy++) {
    const y = (sy / scale) | 0;
    for (let sx = 0; sx < W; sx++) {
      const x = (sx / scale) | 0;
      const si = y * canvas.w + x;
      let lr = toneMap(canvas.r[si], exposure);
      let lg = toneMap(canvas.g[si], exposure);
      let lb = toneMap(canvas.b[si], exposure);
      // gamma for a punchier pixel look
      lr = Math.pow(lr, gamma);
      lg = Math.pow(lg, gamma);
      lb = Math.pow(lb, gamma);
      const di = (sy * W + sx) << 2;
      if (mode === 'alpha') {
        const a = clamp01(Math.max(lr, lg, lb));
        // un-premultiply so the sprite composites cleanly on any bg
        const inv = a > 0.0001 ? 1 / a : 0;
        png.data[di] = Math.round(clamp01(lr * inv) * 255);
        png.data[di + 1] = Math.round(clamp01(lg * inv) * 255);
        png.data[di + 2] = Math.round(clamp01(lb * inv) * 255);
        png.data[di + 3] = Math.round(a * 255);
      } else {
        png.data[di] = Math.round(clamp01(bg[0] / 255 + lr) * 255);
        png.data[di + 1] = Math.round(clamp01(bg[1] / 255 + lg) * 255);
        png.data[di + 2] = Math.round(clamp01(bg[2] / 255 + lb) * 255);
        png.data[di + 3] = 255;
      }
    }
  }
  return png;
}

// Deposited light magnitude, tone-mapped to 0..1. We use the max channel (not
// BT.709 luma) so band selection is hue-independent — a saturated red blade
// reaches the white-hot core bands just like a cyan one. Output hue comes from
// the ramp, so only the deposited *intensity* should drive band lookup.
function luma(canvas, i, exposure) {
  const l = Math.max(canvas.r[i], canvas.g[i], canvas.b[i]);
  return toneMap(l, exposure);
}

// Pixel-art export: quantise the glow into a discrete colour ramp so the
// result reads as crisp dot-art bands (white-hot core -> coloured edge) rather
// than a smooth gradient. `ramp` = array of { t, color:[r,g,b] 0..1, a:0..1 }
// sorted ascending by intensity threshold t.
function pickBand(intensity, ramp) {
  let band = null;
  for (let k = 0; k < ramp.length; k++) {
    if (intensity >= ramp[k].t) band = ramp[k];
    else break;
  }
  return band;
}

function toPixelPNG(canvas, ramp, { scale = 5, mode = 'dark', bg = [12, 12, 18], exposure = 1.35 } = {}) {
  const W = canvas.w * scale;
  const H = canvas.h * scale;
  const png = new PNG({ width: W, height: H });
  for (let sy = 0; sy < H; sy++) {
    const y = (sy / scale) | 0;
    for (let sx = 0; sx < W; sx++) {
      const x = (sx / scale) | 0;
      const si = y * canvas.w + x;
      const inten = luma(canvas, si, exposure);
      const band = pickBand(inten, ramp);
      const di = (sy * W + sx) << 2;
      if (!band || band.a <= 0) {
        if (mode === 'alpha') {
          png.data[di] = png.data[di + 1] = png.data[di + 2] = 0;
          png.data[di + 3] = 0;
        } else {
          png.data[di] = bg[0]; png.data[di + 1] = bg[1]; png.data[di + 2] = bg[2]; png.data[di + 3] = 255;
        }
        continue;
      }
      const cr = clamp01(band.color[0]) * 255;
      const cg = clamp01(band.color[1]) * 255;
      const cb = clamp01(band.color[2]) * 255;
      if (mode === 'alpha') {
        png.data[di] = Math.round(cr);
        png.data[di + 1] = Math.round(cg);
        png.data[di + 2] = Math.round(cb);
        png.data[di + 3] = Math.round(band.a * 255);
      } else {
        const a = band.a;
        png.data[di] = Math.round(bg[0] * (1 - a) + cr * a);
        png.data[di + 1] = Math.round(bg[1] * (1 - a) + cg * a);
        png.data[di + 2] = Math.round(bg[2] * (1 - a) + cb * a);
        png.data[di + 3] = 255;
      }
    }
  }
  return png;
}

function writePNG(png, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

module.exports = { Canvas, toPNG, toPixelPNG, writePNG, clamp01, PNG };
