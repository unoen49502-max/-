'use strict';

// Native pixel-grid size for every effect. Small on purpose: these FX are for
// 2–3 head-tall (chibi/SD) characters, so a chunky low-res grid reads as real
// dot-art instead of a smooth glow. Lower this for even blockier pixels.
const RES = 40;

// Effects were tuned in a 128px design space; k rescales those proportions and
// the shared decorative constants (tip discs, spark distances) to the grid.
const REF = 128;
const K = RES / REF;

module.exports = { RES, REF, K };
