'use strict';
const { arcSlash } = require('../slashAnim');
const { P } = require('../palette');
const { RES, K } = require('../config');
const s = (v) => v * K;

// 袈裟斬り — diagonal down-slash, top-right to bottom-left. Long, lightly-bowed
// crimson blade defined by its two endpoints.
module.exports = {
  name: '02_diagonal',
  size: RES, frames: 14, fps: 22, bg: [16, 11, 12],
  paletteName: 'crimson',
  render(canvas, t) {
    arcSlash(canvas, t, {
      p1: [s(102), s(20)], p2: [s(24), s(106)], bow: s(-18),
      thick: s(11), pal: P.crimson, radialBow: 0, seed: 202,
      sweepEase: 'outQuint', sweepDur: 0.5, unit: K,
    });
  },
};
