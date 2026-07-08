'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');

// 袈裟斬り — diagonal down-slash, top-right to bottom-left. Long, lightly-bowed
// crimson blade defined by its two endpoints.
module.exports = {
  name: '02_diagonal',
  size: 128, frames: 16, fps: 24, bg: [16, 11, 12],
  paletteName: 'crimson',
  render(canvas, t) {
    arcSlash(canvas, t, {
      p1: [102, 20], p2: [24, 106], bow: -18,
      thick: 11, pal: P.crimson, radialBow: 0, seed: 202,
      sweepEase: 'outQuint', sweepDur: 0.5,
    });
  },
};
