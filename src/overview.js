'use strict';
const fs = require('fs');
const path = require('path');
const { Canvas, toPixelPNG, writePNG, PNG } = require('./canvas');
const { ramp: namedRamp } = require('./palette');
const { blit } = require('./render');

const EFFECTS_DIR = path.join(__dirname, 'effects');
const OUT_DIR = path.join(__dirname, '..', 'out');

// Master QA sheet: one row per effect, 8 evenly-sampled key frames, plus a
// palette-coloured index bar on the left so rows are identifiable at a glance.
function main() {
  const files = fs.readdirSync(EFFECTS_DIR).filter((f) => f.endsWith('.js')).sort();
  const effects = files.map((f) => require(path.join(EFFECTS_DIR, f)));

  const SAMPLES = 8;
  const cellScale = 2;
  const cell = 128 * cellScale; // 256
  const pad = 5;
  const bar = 10;
  const rowH = cell + pad;
  const sheet = new PNG({
    width: bar + pad + SAMPLES * (cell + pad),
    height: pad + effects.length * rowH,
  });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 8; sheet.data[i + 1] = 8; sheet.data[i + 2] = 12; sheet.data[i + 3] = 255;
  }

  effects.forEach((e, r) => {
    const rampArr = e.ramp || namedRamp(e.paletteName || 'cyan');
    const edge = rampArr[rampArr.length - 1].color; // near-core; use edge band
    const barCol = (namedRamp(e.paletteName || 'cyan')[2] || rampArr[2]).color;
    const oy = pad + r * rowH;
    // index bar
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < bar; x++) {
        const i = ((oy + y) * sheet.width + (pad + x)) << 2;
        sheet.data[i] = Math.round(barCol[0] * 255);
        sheet.data[i + 1] = Math.round(barCol[1] * 255);
        sheet.data[i + 2] = Math.round(barCol[2] * 255);
        sheet.data[i + 3] = 255;
      }
    }
    for (let s = 0; s < SAMPLES; s++) {
      const t = s / (SAMPLES - 1);
      // map to a frame index in [1 .. frames-2] to skip the empty tails
      const fi = Math.round(0.06 * (e.frames - 1) + t * 0.9 * (e.frames - 1));
      const tt = e.frames === 1 ? 0 : fi / (e.frames - 1);
      const canvas = new Canvas(e.size, e.size);
      e.render(canvas, tt, fi);
      const png = toPixelPNG(canvas, rampArr, { scale: cellScale, mode: 'dark', bg: e.bg || [12, 12, 18] });
      blit(sheet, png, bar + 2 * pad + s * (cell + pad), oy);
    }
  });

  const out = path.join(OUT_DIR, 'OVERVIEW.png');
  writePNG(sheet, out);
  console.log('wrote', path.relative(process.cwd(), out), `(${sheet.width}x${sheet.height})`);
}

main();
