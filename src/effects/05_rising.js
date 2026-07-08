'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');

// 斬り上げ — rising slash. Steep bottom-left -> top-right upswing that ends high,
// violet. Endpoint-defined so the head lands at the top.
module.exports = {
  name: '05_rising',
  size: 128, frames: 16, fps: 22, bg: [14, 12, 18],
  paletteName: 'violet',
  render(canvas, t) {
    arcSlash(canvas, t, {
      p1: [26, 110], p2: [98, 16], bow: 20,
      thick: 12, pal: P.violet, radialBow: 0, seed: 505,
      sweepEase: 'outQuint', sweepDur: 0.52,
    });
  },
};
