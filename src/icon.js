'use strict';
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Solid pixel-art ICON canvas (opaque paint + shading + thick dark outline),
// a different pipeline from the additive glow effects. Draw parts back-to-front
// with paintShape(), then call outline() for the silhouette border.
class IconCanvas {
  constructor(size) {
    this.size = size;
    this.data = new Uint8ClampedArray(size * size * 4); // RGBA, alpha 0 = empty
  }
  set(x, y, col, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    this.data[i] = col[0]; this.data[i + 1] = col[1]; this.data[i + 2] = col[2]; this.data[i + 3] = a;
  }
  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return 0;
    return this.data[(y * this.size + x) * 4 + 3];
  }

  // Fill every pixel where inside(x,y) is true, shaded by a light point.
  // ramp = [shadow, ...tones, highlight] (dark -> light). light = {x,y,r,bias,spec}.
  paintShape(inside, ramp, light = {}) {
    const { x: lx = this.size * 0.35, y: ly = this.size * 0.32, r = this.size * 0.5, bias = 0, spec = true } = light;
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / r; // 0 at light -> ~1 rim
        let f = 1 - d + bias;                                  // 1 lit -> 0 dark
        let idx = Math.round(f * (ramp.length - 1));
        if (idx < 0) idx = 0; if (idx > ramp.length - 1) idx = ramp.length - 1;
        if (spec && d < 0.16) idx = ramp.length - 1;
        this.set(x, y, ramp[idx]);
      }
    }
  }

  // Flat single-colour fill (details: eyes, gems, dots).
  fill(inside, col) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++)
        if (inside(x + 0.5, y + 0.5)) this.set(x, y, col);
  }

  // Thick dark outline around the whole opaque silhouette (and fills 1px gaps).
  outline(col, thickness = 1) {
    for (let pass = 0; pass < thickness; pass++) {
      const add = [];
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (this.alphaAt(x, y) > 0) continue;
          if (this.alphaAt(x - 1, y) > 0 || this.alphaAt(x + 1, y) > 0 ||
              this.alphaAt(x, y - 1) > 0 || this.alphaAt(x, y + 1) > 0) add.push([x, y]);
        }
      }
      for (const [x, y] of add) this.set(x, y, col);
    }
  }
}

// ---- inside-test shape helpers (all take pixel-centre x,y) ----
const inCircle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inEllipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inRect = (x0, y0, w, h) => (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;

function inPoly(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}

function inStar(cx, cy, R, inner, points, rot) {
  const n = points * 2;
  const V = [];
  for (let i = 0; i < n; i++) {
    const ang = rot + i * (Math.PI / points);
    const rad = (i % 2 === 0) ? R : R * inner;
    V.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  return inPoly(V);
}

// classic heart: two humps + a lower triangle
function inHeart(cx, cy, size) {
  const r = size * 0.28;
  const c1 = inCircle(cx - r * 0.92, cy - r * 0.55, r);
  const c2 = inCircle(cx + r * 0.92, cy - r * 0.55, r);
  const tri = inPoly([
    [cx - size * 0.5, cy - r * 0.35],
    [cx + size * 0.5, cy - r * 0.35],
    [cx, cy + size * 0.62],
  ]);
  return (x, y) => c1(x, y) || c2(x, y) || tri(x, y);
}

const inSeg = (x1, y1, x2, y2, hw) => (x, y) => {
  const dx = x2 - x1, dy = y2 - y1;
  const L2 = dx * dx + dy * dy || 1;
  let t = ((x - x1) * dx + (y - y1) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + dx * t, py = y1 + dy * t;
  return (x - px) ** 2 + (y - py) ** 2 <= hw * hw;
};

const inRing = (cx, cy, r, hw, flatten = 1) => (x, y) => {
  const d = Math.hypot(x - cx, (y - cy) / flatten);
  return Math.abs(d - r) <= hw;
};

// union / intersection / subtract of inside-tests
const or = (...fs) => (x, y) => fs.some((f) => f(x, y));
const sub = (a, b) => (x, y) => a(x, y) && !b(x, y);

// ---- palette themes: [shadow, mid, light, highlight] + outline ----
const THEMES = {
  blue:    { ramp: [[42, 78, 168], [70, 120, 226], [120, 176, 255], [200, 226, 255]], out: [22, 30, 66] },
  lblue:   { ramp: [[86, 150, 200], [130, 196, 236], [176, 226, 250], [224, 246, 255]], out: [34, 60, 92] },
  cyan:    { ramp: [[40, 150, 168], [64, 200, 214], [130, 232, 240], [214, 252, 255]], out: [16, 60, 70] },
  pink:    { ramp: [[196, 70, 128], [236, 108, 160], [255, 158, 198], [255, 216, 234]], out: [86, 26, 58] },
  pinkred: { ramp: [[196, 52, 92], [238, 84, 120], [255, 138, 166], [255, 202, 216]], out: [86, 20, 42] },
  magenta: { ramp: [[176, 40, 132], [222, 66, 170], [252, 116, 208], [255, 194, 236]], out: [74, 14, 60] },
  purple:  { ramp: [[104, 58, 176], [146, 96, 224], [186, 146, 250], [226, 206, 255]], out: [46, 22, 82] },
  gold:    { ramp: [[204, 138, 34], [242, 186, 60], [255, 216, 110], [255, 244, 196]], out: [92, 54, 12] },
  yellow:  { ramp: [[220, 176, 40], [248, 212, 70], [255, 234, 120], [255, 250, 200]], out: [96, 66, 14] },
  white:   { ramp: [[176, 186, 210], [212, 220, 236], [238, 242, 250], [255, 255, 255]], out: [70, 78, 100] },
  green:   { ramp: [[54, 150, 78], [86, 194, 108], [140, 226, 150], [212, 248, 214]], out: [22, 66, 32] },
  orange:  { ramp: [[204, 96, 30], [240, 138, 46], [255, 176, 86], [255, 222, 168]], out: [92, 36, 10] },
  brown:   { ramp: [[120, 78, 44], [156, 108, 64], [196, 148, 96], [230, 196, 150]], out: [56, 32, 16] },
  dark:    { ramp: [[40, 42, 54], [64, 66, 82], [96, 100, 120], [150, 154, 176]], out: [12, 12, 18] },
};

function scalePNG(canvas, scale, bg = null) {
  const W = canvas.size * scale, H = canvas.size * scale;
  const png = new PNG({ width: W, height: H });
  for (let sy = 0; sy < H; sy++) {
    for (let sx = 0; sx < W; sx++) {
      const x = (sx / scale) | 0, y = (sy / scale) | 0;
      const si = (y * canvas.size + x) * 4, di = (sy * W + sx) * 4;
      const a = canvas.data[si + 3];
      if (a > 0) {
        png.data[di] = canvas.data[si]; png.data[di + 1] = canvas.data[si + 1];
        png.data[di + 2] = canvas.data[si + 2]; png.data[di + 3] = 255;
      } else if (bg) {
        png.data[di] = bg[0]; png.data[di + 1] = bg[1]; png.data[di + 2] = bg[2]; png.data[di + 3] = 255;
      } else {
        png.data[di + 3] = 0;
      }
    }
  }
  return png;
}

function writePNG(png, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

module.exports = {
  IconCanvas, THEMES,
  inCircle, inEllipse, inRect, inPoly, inStar, inHeart, inSeg, inRing, or, sub,
  scalePNG, writePNG, PNG,
};
