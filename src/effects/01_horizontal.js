'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');

// 横薙ぎ — horizontal crescent slash sweeping left -> right across the top.
module.exports = {
  name: '01_horizontal',
  size: 128, frames: 16, fps: 22, bg: [12, 12, 18],
  paletteName: 'cyan',
  render(canvas, t) {
    arcSlash(canvas, t, {
      cx: 64, cy: 104, radius: 62,
      aStart: -168, aEnd: -12, spanDeg: 150, thick: 12,
      pal: P.cyan, radialBow: 5, seed: 101,
    });
  },
};
