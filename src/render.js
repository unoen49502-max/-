'use strict';
const fs = require('fs');
const path = require('path');
const { Canvas, toPixelPNG, writePNG, PNG } = require('./canvas');
const { ramp: namedRamp } = require('./palette');
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

// Blit one PNG onto another at (ox, oy) (opaque copy).
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    const dy = oy + y;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = ox + x;
      if (dx < 0 || dx >= dst.width) continue;
      const si = (y * src.width + x) << 2;
      const di = (dy * dst.width + dx) << 2;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

function drawBorder(png, ox, oy, w, h, col) {
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
    const i = (y * png.width + x) << 2;
    png.data[i] = col[0]; png.data[i + 1] = col[1]; png.data[i + 2] = col[2]; png.data[i + 3] = 255;
  };
  for (let x = 0; x < w; x++) { set(ox + x, oy); set(ox + x, oy + h - 1); }
  for (let y = 0; y < h; y++) { set(ox, oy + y); set(ox + w - 1, oy + y); }
}

// Encode dark-bg frames to a looping GIF (gifenc, global palette).
function writeGif(darkFrames, file, fps) {
  const enc = GIFEncoder();
  const delay = Math.round(1000 / fps);
  // one shared palette from the first busy frame for stable colours
  const ref = darkFrames[Math.floor(darkFrames.length / 2)];
  const palette = quantize(ref.data, 64);
  for (const fr of darkFrames) {
    const index = applyPalette(fr.data, palette);
    enc.writeFrame(index, fr.width, fr.height, { palette, delay });
  }
  enc.finish();
  fs.writeFileSync(file, Buffer.from(enc.bytes()));
}

// effect: { name, size, frames, fps, bg, ramp|paletteName, scale, contactScale, render() }
function renderEffect(effect, outDir) {
  const { name, size, frames, fps = 18, bg = [12, 12, 18] } = effect;
  const scale = effect.scale || 5;
  const contactScale = effect.contactScale || 2;
  const ramp = effect.ramp || namedRamp(effect.paletteName || 'cyan');
  const framesDir = path.join(outDir, name, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const darkPngs = [], alphaPngs = [], smallPngs = [];
  for (let f = 0; f < frames; f++) {
    const t = frames === 1 ? 0 : f / (frames - 1);
    const canvas = new Canvas(size, size);
    effect.render(canvas, t, f);
    const dark = toPixelPNG(canvas, ramp, { scale, mode: 'dark', bg });
    const alpha = toPixelPNG(canvas, ramp, { scale, mode: 'alpha' });
    const small = toPixelPNG(canvas, ramp, { scale: contactScale, mode: 'dark', bg });
    writePNG(dark, path.join(framesDir, `frame_${String(f).padStart(2, '0')}.png`));
    writePNG(alpha, path.join(framesDir, `alpha_${String(f).padStart(2, '0')}.png`));
    darkPngs.push(dark); alphaPngs.push(alpha); smallPngs.push(small);
  }

  // contact sheet (all frames in a grid for visual QA)
  const cw = smallPngs[0].width, ch = smallPngs[0].height, pad = 4;
  const cols = Math.min(effect.contactCols || 6, frames);
  const rows = Math.ceil(frames / cols);
  const sheet = new PNG({ width: cols * (cw + pad) + pad, height: rows * (ch + pad) + pad });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 6; sheet.data[i + 1] = 6; sheet.data[i + 2] = 9; sheet.data[i + 3] = 255;
  }
  smallPngs.forEach((p, i) => {
    const c = i % cols, r = (i / cols) | 0;
    const ox = pad + c * (cw + pad), oy = pad + r * (ch + pad);
    blit(sheet, p, ox, oy);
    drawBorder(sheet, ox - 1, oy - 1, cw + 2, ch + 2, [40, 44, 60]);
  });
  const sheetFile = path.join(outDir, name, `${name}_contact.png`);
  writePNG(sheet, sheetFile);

  // transparent sprite strip
  const sw = alphaPngs[0].width, sh = alphaPngs[0].height;
  const strip = new PNG({ width: sw * frames, height: sh });
  alphaPngs.forEach((p, i) => blit(strip, p, i * sw, 0));
  writePNG(strip, path.join(outDir, name, `${name}_spritesheet.png`));

  // animated GIF
  const gifFile = path.join(outDir, name, `${name}.gif`);
  try { writeGif(darkPngs, gifFile, fps); }
  catch (e) { console.warn(`  [warn] gif failed for ${name}: ${e.message}`); }

  return { name, contact: sheetFile, gif: gifFile, frames };
}

module.exports = { renderEffect, blit };
