'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');
const { RES, K } = require('../config');
const s = (v) => v * K;

// 斬り上げ — rising slash. Steep bottom-left -> top-right upswing that ends high,
// violet. Endpoint-defined so the head lands at the top.
module.exports = {
  name: '05_rising',
  size: RES, frames: 14, fps: 20, bg: [14, 12, 18],
  paletteName: 'violet',
  render(canvas, t) {
    arcSlash(canvas, t, {
      p1: [s(26), s(110)], p2: [s(98), s(16)], bow: s(20),
      thick: s(12), pal: P.violet, radialBow: 0, seed: 505,
      sweepEase: 'outQuint', sweepDur: 0.52, unit: K,
    });
  },
};
