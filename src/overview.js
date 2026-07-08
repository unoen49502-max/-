'use strict';
const fs = require('fs');
const path = require('path');
const { Canvas, toPixelPNG, writePNG, PNG } = require('./canvas');
const { ramp: namedRamp } = require('./palette');
const { blit } = require('./render');

const EFFECTS_DIR = path.join(__dirname, 'effects');
const OUT_DIR = path.join(__dirname, '..', 'out');

// QA sheet: one row per effect, 8 evenly-sampled key frames, plus a
// palette-coloured index bar on the left so rows are identifiable at a glance.
function renderSheet(effects, outFile) {
  if (!effects.length) return;
  const SAMPLES = 8;
  const nativeSize = effects[0].size;
  const cellScale = Math.max(3, Math.round(220 / nativeSize));
  const cell = nativeSize * cellScale;
  const pad = 5, bar = 10, rowH = cell + pad;
  const sheet = new PNG({
    width: bar + pad + SAMPLES * (cell + pad),
    height: pad + effects.length * rowH,
  });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 8; sheet.data[i + 1] = 8; sheet.data[i + 2] = 12; sheet.data[i + 3] = 255;
  }

  effects.forEach((e, r) => {
    const rampArr = e.ramp || namedRamp(e.paletteName || 'cyan');
    const barCol = rampArr[Math.min(2, rampArr.length - 1)].color;
    const oy = pad + r * rowH;
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < bar; x++) {
        const i = ((oy + y) * sheet.width + (pad + x)) << 2;
        sheet.data[i] = Math.round(barCol[0] * 255);
        sheet.data[i + 1] = Math.round(barCol[1] * 255);
        sheet.data[i + 2] = Math.round(barCol[2] * 255);
        sheet.data[i + 3] = 255;
      }
    }
    for (let sIdx = 0; sIdx < SAMPLES; sIdx++) {
      const u = sIdx / (SAMPLES - 1);
      const fi = Math.round(0.06 * (e.frames - 1) + u * 0.9 * (e.frames - 1));
      const tt = e.frames === 1 ? 0 : (e.loop ? fi / e.frames : fi / (e.frames - 1));
      const canvas = new Canvas(e.size, e.size);
      e.render(canvas, tt, fi);
      const png = toPixelPNG(canvas, rampArr, { scale: cellScale, mode: 'dark', bg: e.bg || [12, 12, 18] });
      blit(sheet, png, bar + 2 * pad + sIdx * (cell + pad), oy);
    }
  });

  writePNG(sheet, outFile);
  console.log('wrote', path.relative(process.cwd(), outFile), `(${sheet.width}x${sheet.height})`);
}

function main() {
  const files = fs.readdirSync(EFFECTS_DIR).filter((f) => f.endsWith('.js')).sort();
  const effects = files.map((f) => require(path.join(EFFECTS_DIR, f)));
  // group by category so each sheet has a uniform native size / alignment
  const slashes = effects.filter((e) => /^\d/.test(e.name));
  const magic = effects.filter((e) => e.name.startsWith('magic'));
  renderSheet(slashes, path.join(OUT_DIR, 'OVERVIEW.png'));
  renderSheet(magic, path.join(OUT_DIR, 'OVERVIEW_magic.png'));
}

main();
