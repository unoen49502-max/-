'use strict';
// Item-slot frames (アイテム枠): rounded, bevelled rarity borders with a recessed
// dark well an icon drops into. Same chunky dot-art language as the icons.
const path = require('path');
const { IconCanvas, scalePNG, writePNG, PNG } = require('./icon');
const { ICONS } = require('./iconset');

const OUT = path.join(__dirname, '..', 'out', 'frames');
const S = 40, R = 5;

// signed distance to a rounded rect centred at (cx,cy), half-extents hw,hh.
function rrSDF(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// rarity palettes: base border + light/dark bevel tints + dark rim/outline
const RARITY = {
  gray:    { base: [104, 108, 128], lt: [156, 160, 182], dk: [58, 60, 80], rim: [22, 22, 34] },
  green:   { base: [92, 194, 110], lt: [156, 234, 158], dk: [42, 120, 62], rim: [16, 46, 26] },
  blue:    { base: [78, 150, 236], lt: [150, 202, 255], dk: [40, 86, 172], rim: [16, 30, 70] },
  purple:  { base: [170, 102, 226], lt: [216, 172, 252], dk: [104, 54, 162], rim: [40, 20, 70] },
  gold:    { base: [242, 198, 72], lt: [255, 238, 156], dk: [192, 132, 36], rim: [74, 46, 12] },
  red:     { base: [230, 82, 90], lt: [255, 150, 150], dk: [162, 42, 54], rim: [64, 16, 24] },
  magenta: { base: [230, 82, 184], lt: [255, 150, 222], dk: [162, 42, 124], rim: [64, 16, 54] },
};

// draw one empty slot frame of a given rarity into a fresh S×S canvas
function drawSlot(rarity) {
  const cv = new IconCanvas(S);
  const r = RARITY[rarity];
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = rrSDF(x + 0.5, y + 0.5, c, c, S / 2, S / 2, R);
      if (d > 0.3) continue;                                   // outside → transparent
      if (d > -1.4) { cv.set(x, y, r.rim); continue; }         // dark outline
      if (d > -4.4) {                                          // bevelled colour border
        const li = -((x - c) * 0.5 + (y - c)) / (S * 0.5);
        cv.set(x, y, li > 0.28 ? r.lt : li < -0.28 ? r.dk : r.base);
        continue;
      }
      // recessed well: vertical gradient + faint rarity tint + inner top shadow
      let bg = mix([21, 21, 31], [34, 34, 50], (y - 4) / (S - 8));
      bg = mix(bg, r.dk, 0.14);
      if (d > -5.4) bg = scl(bg, 0.68);                        // inner edge shadow
      cv.set(x, y, bg);
    }
  }
  return cv;
}

// blit an icon canvas (32px) centred into a slot's recessed well
function placeIcon(slot, icon) {
  const off = Math.round((S - icon.size) / 2);
  for (let y = 0; y < icon.size; y++) for (let x = 0; x < icon.size; x++) {
    const si = (y * icon.size + x) * 4;
    if (icon.data[si + 3] === 0) continue;
    slot.set(off + x, off + y, [icon.data[si], icon.data[si + 1], icon.data[si + 2]]);
  }
}

// red "locked" X overlay
function lockX(slot) {
  const r = [235, 70, 78], d = [120, 24, 32];
  for (let i = 9; i < S - 9; i++) {
    for (const [px, py] of [[i, i], [i, i + 1], [S - 1 - i, i], [S - 1 - i, i + 1]]) slot.set(px, py, slot.alphaAt(px, py) ? r : r);
  }
  // shadow underline
  for (let i = 9; i < S - 9; i++) { slot.set(i, i + 2, d); slot.set(S - 1 - i, i + 2, d); }
}

function main() {
  const iconCanvases = ICONS.map((def) => { const cv = new IconCanvas(32); def.draw(cv); return cv; });

  // 1. empty frames, one per rarity
  const rarities = Object.keys(RARITY);
  rarities.forEach((r) => writePNG(scalePNG(drawSlot(r), 6), path.join(OUT, `slot_${r}.png`)));
  // one filled example each
  rarities.forEach((r, i) => { const s = drawSlot(r); placeIcon(s, iconCanvases[i % iconCanvases.length]); writePNG(scalePNG(s, 6), path.join(OUT, `slot_${r}_filled.png`)); });

  // 2. demo grid resembling an inventory (rarity per row, icons + empties + locked)
  const layout = [
    ['magenta', 'magenta', 'gold', 'gold', 'blue', 'red', 'red', 'purple'],
    ['purple', 'purple', 'gray', 'green', 'gold', 'red_lock', 'blue', 'green'],
    ['empty', 'empty', 'empty', 'empty', 'gray', 'gray', 'gray', 'empty'],
    ['gold', 'gold', 'purple', 'green', 'blue', 'red', 'magenta', 'gray'],
    ['blue', 'gray', 'green', 'purple', 'gold', 'red_lock', 'blue', 'green'],
    ['green', 'green', 'blue', 'gold', 'red', 'purple', 'magenta', 'gray'],
  ];
  const scale = 5, cell = S * scale, gap = 3, cols = 8, rows = layout.length;
  const sheet = new PNG({ width: cols * cell + (cols + 1) * gap, height: rows * cell + (rows + 1) * gap });
  for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 14; sheet.data[i + 1] = 14; sheet.data[i + 2] = 20; sheet.data[i + 3] = 255; }
  let idx = 0;
  layout.forEach((row, r) => row.forEach((cellKind, cIdx) => {
    let rarity = cellKind, locked = false, filled = true;
    if (cellKind === 'empty') { rarity = 'gray'; filled = false; }
    else if (cellKind.endsWith('_lock')) { rarity = cellKind.replace('_lock', ''); locked = true; }
    const slot = drawSlot(rarity);
    if (filled && !locked) placeIcon(slot, iconCanvases[idx++ % iconCanvases.length]);
    if (locked) { placeIcon(slot, iconCanvases[idx++ % iconCanvases.length]); lockX(slot); }
    const big = scalePNG(slot, scale);
    const ox = gap + cIdx * (cell + gap), oy = gap + r * (cell + gap);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const si = (y * big.width + x) * 4; if (big.data[si + 3] === 0) continue;
      const di = ((oy + y) * sheet.width + (ox + x)) * 4;
      sheet.data[di] = big.data[si]; sheet.data[di + 1] = big.data[si + 1]; sheet.data[di + 2] = big.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }));
  writePNG(sheet, path.join(OUT, 'FRAMES_demo.png'));
  console.log(`wrote ${rarities.length} rarities + demo -> ${path.relative(process.cwd(), OUT)}`);
}

main();
