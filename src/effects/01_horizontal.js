'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');
const { RES, K } = require('../config');
const s = (v) => v * K;

// 横薙ぎ — horizontal crescent slash sweeping left -> right across the top.
module.exports = {
  name: '01_horizontal',
  size: RES, frames: 14, fps: 20, bg: [12, 12, 18],
  paletteName: 'cyan',
  render(canvas, t) {
    arcSlash(canvas, t, {
      cx: s(64), cy: s(104), radius: s(62),
      aStart: -168, aEnd: -12, spanDeg: 150, thick: s(12),
      pal: P.cyan, radialBow: s(5), seed: 101, unit: K,
    });
  },
};
