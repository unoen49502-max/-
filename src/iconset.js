'use strict';
const {
  THEMES, inCircle, inEllipse, inRect, inPoly, inStar, inHeart, inSeg, inRing, or, sub,
} = require('./icon');

// A curated first batch of icons spanning the categories, drawn procedurally.
// Each: { key, jp, draw(canvas) } on a 32px grid. draw() paints parts back-to-
// front, calls canvas.outline(), then adds any bright overlays (sparkles).
const C = 16; // centre of a 32px icon
const T = (n) => THEMES[n];

function sparkle(cv, x, y, s) {
  const W = [255, 255, 255];
  cv.set(x, y, W); cv.set(x - 1, y, W); cv.set(x + 1, y, W); cv.set(x, y - 1, W); cv.set(x, y + 1, W);
  if (s > 1) { cv.set(x - 2, y, W); cv.set(x + 2, y, W); cv.set(x, y - 2, W); cv.set(x, y + 2, W); }
}

const ICONS = [
  {
    key: 'aitem_star', jp: '無敵スター',
    draw(cv) {
      cv.paintShape(inStar(C, C + 1, 13, 0.44, 5, -Math.PI / 2), T('yellow').ramp, { x: 11, y: 9, r: 15 });
      cv.outline(T('yellow').out, 2);
      sparkle(cv, 24, 7, 2);
    },
  },
  {
    key: 'heal_candy', jp: '星型キャンディ',
    draw(cv) {
      cv.paintShape(inStar(C, C, 12, 0.52, 5, -Math.PI / 2), T('pink').ramp, { x: 11, y: 10, r: 14 });
      cv.outline(T('pink').out, 2);
      // glossy shine
      cv.set(12, 11, [255, 255, 255]); cv.set(13, 11, [255, 255, 255]); cv.set(12, 12, [255, 230, 242]);
    },
  },
  {
    key: 'weapon_area', jp: 'ハートフル★バリア',
    draw(cv) {
      // soft shield aura ring behind
      cv.paintShape(inRing(C, C, 14, 1.1), T('pinkred').ramp, { x: C, y: C, r: 20, bias: 0.5, spec: false });
      // heart
      cv.paintShape(inHeart(C, C, 15), T('pink').ramp, { x: 11, y: 10, r: 13 });
      cv.outline(T('pink').out, 2);
      sparkle(cv, 25, 8, 1);
    },
  },
  {
    key: 'weapon_chain', jp: 'チェイン★スパーク',
    draw(cv) {
      const bolt = inPoly([[19, 3], [9, 16], [15, 16], [11, 29], [25, 12], [17, 12], [22, 3]]);
      cv.paintShape(bolt, T('lblue').ramp, { x: 12, y: 8, r: 16 });
      cv.outline(T('lblue').out, 2);
    },
  },
  {
    key: 'passive_atk', jp: 'エンジェルリング',
    draw(cv) {
      // tilted halo (ellipse ring)
      cv.paintShape(inRing(C, 15, 10, 1.7, 0.5), T('gold').ramp, { x: 10, y: 9, r: 16 });
      cv.outline(T('gold').out, 2);
      sparkle(cv, 8, 10, 1);
    },
  },
  {
    key: 'weapon_turret', jp: 'キューティー★キャノン',
    draw(cv) {
      const F = 0.55, pr = T('purple').ramp;
      cv.paintShape(inRing(C, C, 13, 1.2, F), pr, { x: C, y: C, r: 18, bias: 0.35, spec: false });
      cv.paintShape(inRing(C, C, 9, 0.8, F), pr, { x: C, y: C, r: 16, bias: 0.4, spec: false });
      // hexagram drawn as two triangles' edges (flattened plane)
      const verts = (rot) => {
        const p = [];
        for (let i = 0; i < 3; i++) { const a = rot + i * (2 * Math.PI / 3); p.push([C + Math.cos(a) * 11, C + Math.sin(a) * 11 * F]); }
        return p;
      };
      for (const rot of [-Math.PI / 2, Math.PI / 2]) {
        const p = verts(rot);
        for (let i = 0; i < 3; i++) {
          const A = p[i], B = p[(i + 1) % 3];
          cv.paintShape(inSeg(A[0], A[1], B[0], B[1], 0.9), pr, { x: 11, y: 11, r: 16, bias: 0.3, spec: false });
        }
      }
      cv.outline(T('purple').out, 2);
      // glowing cannon core
      cv.fill(inCircle(C, C, 3), [255, 240, 255]);
      cv.fill(inCircle(C, C, 2), [255, 255, 255]);
    },
  },
  {
    key: 'passive_hp', jp: 'ピンクのリボン',
    draw(cv) {
      // two bow loops (triangles), knot, tails
      const left = inPoly([[16, 16], [4, 9], [4, 23]]);
      const right = inPoly([[16, 16], [28, 9], [28, 23]]);
      const tails = or(inPoly([[14, 18], [11, 29], [16, 26]]), inPoly([[18, 18], [21, 29], [16, 26]]));
      cv.paintShape(or(left, right, tails), T('pink').ramp, { x: 11, y: 10, r: 16 });
      cv.paintShape(inCircle(16, 16, 3.2), T('pinkred').ramp, { x: 15, y: 14, r: 5 });
      cv.outline(T('pink').out, 2);
    },
  },
  {
    key: 'aitem_bomb', jp: 'ボム',
    draw(cv) {
      cv.paintShape(inCircle(15, 19, 9), T('dark').ramp, { x: 11, y: 15, r: 12 });
      // fuse cap
      cv.paintShape(inRect(13, 8, 4, 4), T('dark').ramp, { x: 13, y: 8, r: 6, spec: false });
      // fuse
      cv.fill(inSeg(15, 9, 21, 4, 1), T('brown').ramp[1]);
      cv.outline(T('dark').out, 2);
      // spark
      sparkle(cv, 22, 3, 1);
      cv.set(22, 3, [255, 240, 180]);
      // shine on body
      cv.set(12, 15, [150, 154, 176]); cv.set(13, 15, [120, 124, 146]);
    },
  },
  {
    key: 'weapon_orbit', jp: 'エンジェル★フェザー',
    draw(cv) {
      // feather vane = lens (intersection of two circles), vertical
      const vane = (x, y) => inCircle(9, 16, 12)(x, y) && inCircle(23, 16, 12)(x, y);
      cv.paintShape(vane, T('cyan').ramp, { x: 12, y: 9, r: 15 });
      cv.outline(T('cyan').out, 2);
      // central shaft
      cv.fill((x, y) => vane(x, y) && inSeg(16, 5, 16, 27, 0.7)(x, y), T('cyan').out);
      sparkle(cv, 24, 24, 1);
    },
  },
  {
    key: 'weapon_starfall', jp: 'スターフォール',
    draw(cv) {
      // flaming tail (tapered) lower-left, head upper-right
      const tail = inPoly([[23, 8], [27, 13], [6, 27], [10, 12]]);
      cv.paintShape(tail, T('orange').ramp, { x: 20, y: 10, r: 22, spec: false });
      cv.paintShape(inStar(23, 9, 7, 0.45, 5, -Math.PI / 2), T('gold').ramp, { x: 21, y: 7, r: 9 });
      cv.outline(T('gold').out, 2);
      cv.fill(inCircle(23, 9, 2), [255, 255, 240]);
    },
  },
  {
    key: 'weapon_boomerang', jp: 'ハート★ブーメラン',
    draw(cv) {
      const cres = sub(inCircle(15, 17, 11), inCircle(20, 12, 10));
      cv.paintShape(cres, T('pink').ramp, { x: 10, y: 12, r: 14 });
      cv.outline(T('gold').out, 2); // gold rim
      // tiny heart at the tip
      cv.paintShape(inHeart(8, 8, 6), T('pinkred').ramp, { x: 6, y: 6, r: 5 });
      cv.outline(T('gold').out, 1);
    },
  },
  {
    key: 'passive_speed', jp: 'ホーリーミルク',
    draw(cv) {
      // bottle body + neck + cap
      const body = or(inRect(9, 13, 14, 15), inCircle(16, 26, 7));
      const neck = inRect(13, 8, 6, 6);
      cv.paintShape(or(body, neck), T('white').ramp, { x: 12, y: 12, r: 18 });
      cv.paintShape(inRect(12, 5, 8, 4), T('cyan').ramp, { x: 13, y: 5, r: 8 }); // cap
      cv.outline(T('white').out, 2);
      // little star label
      cv.fill(inStar(16, 20, 4, 0.45, 5, -Math.PI / 2), T('gold').ramp[2]);
    },
  },
];

module.exports = { ICONS };
