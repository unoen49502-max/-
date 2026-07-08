'use strict';
const path = require('path');
const { IconCanvas, scalePNG, writePNG, PNG } = require('./icon');
const { ICONS } = require('./iconset');

const OUT = path.join(__dirname, '..', 'out', 'icons');
const SIZE = 32;

function renderIcon(def) {
  const cv = new IconCanvas(SIZE);
  def.draw(cv);
  return cv;
}

function main() {
  const canvases = ICONS.map((def) => {
    const cv = renderIcon(def);
    writePNG(scalePNG(cv, 8), path.join(OUT, `icon_${def.key}.png`));       // 256px transparent
    writePNG(scalePNG(cv, 1), path.join(OUT, `icon_${def.key}_1x.png`));    // 32px native
    return cv;
  });

  // contact sheet: icons on neutral tiles, 4 cols
  const scale = 5, cell = SIZE * scale, pad = 10, cols = 4;
  const rows = Math.ceil(ICONS.length / cols);
  const bg = [58, 60, 70], tile = [40, 42, 52];
  const sheet = new PNG({ width: cols * (cell + pad) + pad, height: rows * (cell + pad) + pad });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = bg[0]; sheet.data[i + 1] = bg[1]; sheet.data[i + 2] = bg[2]; sheet.data[i + 3] = 255;
  }
  canvases.forEach((cv, k) => {
    const c = k % cols, r = (k / cols) | 0;
    const ox = pad + c * (cell + pad), oy = pad + r * (cell + pad);
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const sxp = (x / scale) | 0, syp = (y / scale) | 0;
        const si = (syp * SIZE + sxp) * 4;
        const px = ox + x, py = oy + y, di = (py * sheet.width + px) * 4;
        if (cv.data[si + 3] > 0) {
          sheet.data[di] = cv.data[si]; sheet.data[di + 1] = cv.data[si + 1]; sheet.data[di + 2] = cv.data[si + 2];
        } else {
          sheet.data[di] = tile[0]; sheet.data[di + 1] = tile[1]; sheet.data[di + 2] = tile[2];
        }
        sheet.data[di + 3] = 255;
      }
    }
  });
  writePNG(sheet, path.join(OUT, 'ICONS_contact.png'));
  console.log(`rendered ${ICONS.length} icons -> ${path.relative(process.cwd(), OUT)}`);
  console.log('order:', ICONS.map((d) => d.key).join(', '));
}

main();
