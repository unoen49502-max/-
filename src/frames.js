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
// Rarity progression (low → high): gray < green < blue < gold < pink.
// base = border, lt/dk = bevel tints, rim = dark outline, well = recessed
// background (kept clearly hued so it never reads as black), glow = central
// premium bloom that grows with the tier so higher rarities feel richer.
// Rarity is shown by how ORNATE the frame is (not a background glow):
//   bw = border thickness · inlay = inner bright accent line · corners =
//   0 none / 1 stud / 2 gem. Higher tier = a richer, more reinforced frame.
const RARITY = {
  gray:  { base: [122, 128, 148], lt: [168, 172, 192], dk: [70, 74, 96], rim: [26, 26, 40], well: [56, 60, 80], bw: 2, inlay: false, corners: 0 },
  green: { base: [96, 202, 118], lt: [160, 238, 164], dk: [46, 128, 68], rim: [16, 50, 28], well: [40, 92, 56], bw: 2, inlay: true, corners: 0 },
  blue:  { base: [82, 154, 240], lt: [152, 206, 255], dk: [42, 90, 178], rim: [16, 32, 74], well: [42, 80, 150], bw: 2, inlay: true, corners: 1 },
  gold:  { base: [246, 202, 78], lt: [255, 240, 160], dk: [196, 136, 40], rim: [76, 48, 14], well: [116, 88, 36], bw: 3, inlay: true, corners: 1 },
  pink:  { base: [250, 118, 192], lt: [255, 178, 226], dk: [192, 60, 140], rim: [72, 20, 56], well: [128, 54, 100], bw: 3, inlay: true, corners: 2 },
  // extra colours for special slots
  purple:  { base: [170, 102, 226], lt: [216, 172, 252], dk: [104, 54, 162], rim: [40, 20, 70], well: [66, 42, 100], bw: 3, inlay: true, corners: 1 },
  red:     { base: [230, 82, 90], lt: [255, 150, 150], dk: [162, 42, 54], rim: [64, 16, 24], well: [96, 40, 46], bw: 2, inlay: true, corners: 1 },
};

// Draw one empty slot frame: flat limited-palette bands with a HARD pixel bevel.
// Rarity enriches the FRAME: a bright inner inlay line, corner studs/gems, and a
// thicker border — no background dither.
function drawSlot(rarity) {
  const cv = new IconCanvas(S);
  const r = RARITY[rarity];
  const c = (S - 1) / 2;
  const dark = scl(r.dk, 0.62);
  const wShad = scl(r.well, 0.62), wLit = scl(r.well, 1.16);
  const inlayCol = r.corners === 2 ? mix(r.lt, [255, 255, 255], 0.45) : r.lt;
  const oE = -1.35, bE = oE - r.bw, iE = bE - (r.inlay ? 1 : 0), sE = iE - 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = rrSDF(x + 0.5, y + 0.5, c, c, S / 2, S / 2, R);
      if (d > 0.3) continue;                                   // outside → transparent
      const nx = x - c, ny = y - c, vert = Math.abs(ny) >= Math.abs(nx);
      if (d > oE) cv.set(x, y, r.rim);                         // dark outline
      else if (d > bE) cv.set(x, y, vert ? (ny < 0 ? r.lt : dark) : (nx < 0 ? r.base : r.dk)); // hard bevel
      else if (d > iE) cv.set(x, y, inlayCol);                 // bright inner inlay line
      else if (d > sE) cv.set(x, y, (vert ? ny < 0 : nx < 0) ? wShad : wLit); // inset shadow ring
      else cv.set(x, y, r.well);                               // flat well
    }
  }
  if (r.corners) drawCorners(cv, c, r, oE, bE);
  return cv;
}

// Corner studs (1) / gems (2) sitting on the frame's border ring.
function drawCorners(cv, c, r, oE, bE) {
  const gem = r.corners === 2, sz = gem ? 2 : 1;
  const A = [[R - 2, R - 2], [S - 1 - (R - 2), R - 2], [R - 2, S - 1 - (R - 2)], [S - 1 - (R - 2), S - 1 - (R - 2)]];
  for (const [ax, ay] of A) {
    for (let dy = -sz; dy <= sz; dy++) for (let dx = -sz; dx <= sz; dx++) {
      const x = ax + dx, y = ay + dy;
      const d = rrSDF(x + 0.5, y + 0.5, c, c, S / 2, S / 2, R);
      if (d > oE || d < bE - 1.6) continue;                   // keep on the border ring
      const center = dx === 0 && dy === 0;
      cv.set(x, y, gem && center ? [255, 255, 255] : gem ? r.lt : mix(r.lt, [255, 255, 255], 0.3));
    }
  }
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

  // 1b. progression strip: the 5 tiers empty, low→high, so the difference reads
  const order = ['gray', 'green', 'blue', 'gold', 'pink'];
  {
    const sc = 6, cell = S * sc, gap = 4;
    const strip = new PNG({ width: order.length * cell + (order.length + 1) * gap, height: cell + 2 * gap });
    for (let i = 0; i < strip.data.length; i += 4) { strip.data[i] = 14; strip.data[i + 1] = 14; strip.data[i + 2] = 20; strip.data[i + 3] = 255; }
    order.forEach((rar, k) => { const big = scalePNG(drawSlot(rar), sc), ox = gap + k * (cell + gap), oy = gap; for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const si = (y * big.width + x) * 4; if (big.data[si + 3] === 0) continue; const di = ((oy + y) * strip.width + (ox + x)) * 4; strip.data[di] = big.data[si]; strip.data[di + 1] = big.data[si + 1]; strip.data[di + 2] = big.data[si + 2]; strip.data[di + 3] = 255; } });
    writePNG(strip, path.join(OUT, 'FRAMES_progression.png'));
  }

  // 2. demo grid resembling an inventory (rarity per row, icons + empties + locked)
  const layout = [
    ['pink', 'pink', 'gold', 'gold', 'blue', 'red', 'red', 'purple'],
    ['purple', 'purple', 'gray', 'green', 'gold', 'red_lock', 'blue', 'green'],
    ['empty', 'empty', 'empty', 'empty', 'gray', 'gray', 'gray', 'empty'],
    ['gold', 'gold', 'purple', 'green', 'blue', 'red', 'pink', 'gray'],
    ['blue', 'gray', 'green', 'purple', 'gold', 'red_lock', 'blue', 'green'],
    ['green', 'green', 'blue', 'gold', 'red', 'purple', 'pink', 'gray'],
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
