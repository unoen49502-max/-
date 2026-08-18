import test from 'node:test';
import assert from 'node:assert/strict';
import { pickNext, recordShown, makeRng, starvationMap, DEFAULT_WEIGHTS } from '../src/rotator.js';

function buildPool(spec) {
  const pool = [];
  let n = 0;
  for (const [genre, count, base] of spec) {
    for (let i = 0; i < count; i += 1) {
      n += 1;
      pool.push({
        id: `i${n}`,
        url: `https://site${n % 9}.example/${n}`,
        title: `${genre}-${i}`,
        author: `author${n % 25}`,
        source: n % 3 === 0 ? 'hatena' : 'rss',
        genres: [genre],
        score: base,
      });
    }
  }
  return pool;
}

function run(pool, steps, options = {}) {
  const state = { history: [], genreCounts: {} };
  const seen = new Set();
  const order = [];
  const rng = options.rng || makeRng(options.seed ?? 20250818);
  for (let i = 0; i < steps; i += 1) {
    const { item } = pickNext(pool.filter((p) => !seen.has(p.id)), state, { rng, ...options });
    if (!item) break;
    seen.add(item.id);
    recordShown(state, item);
    order.push(item.genres[0]);
  }
  return { order, state };
}

// 現実の偏り: 人気ジャンルが数でも点数でも圧倒している状態
const SKEWED = [
  ['fantasy', 60, 0.92], ['battle', 50, 0.88], ['romance', 30, 0.75],
  ['gourmet', 12, 0.5], ['history', 12, 0.45], ['medical', 12, 0.4],
  ['animal', 12, 0.55], ['sports', 12, 0.4], ['bl_gl', 12, 0.3], ['social', 12, 0.35],
];

test('同じジャンルが連続しない', () => {
  const { order } = run(buildPool(SKEWED), 60);
  for (let i = 1; i < order.length; i += 1) {
    assert.notEqual(order[i], order[i - 1], `${i} 件目で ${order[i]} が連続した`);
  }
});

test('在庫がある間は直近 3 件と同じジャンルを出さない', () => {
  const { order } = run(buildPool(SKEWED), 60);
  for (let i = 3; i < order.length; i += 1) {
    assert.ok(!order.slice(i - 3, i).includes(order[i]),
      `${i} 件目 ${order[i]} が直近3件と衝突: ${order.slice(i - 3, i)}`);
  }
});

test('人気ジャンルの占有率がプール比率より下がり、少数ジャンルが底上げされる', () => {
  const pool = buildPool(SKEWED);
  const { state } = run(pool, 80);
  const shownTotal = Object.values(state.genreCounts).reduce((a, b) => a + b, 0);
  const poolShare = (genre) => pool.filter((p) => p.genres[0] === genre).length / pool.length;
  const shownShare = (genre) => (state.genreCounts[genre] || 0) / shownTotal;

  assert.ok(shownShare('fantasy') < poolShare('fantasy'),
    `fantasy: プール ${poolShare('fantasy')} → 表示 ${shownShare('fantasy')}`);
  for (const minor of ['medical', 'bl_gl', 'social']) {
    assert.ok(shownShare(minor) > poolShare(minor),
      `${minor}: プール ${poolShare(minor)} → 表示 ${shownShare(minor)}`);
  }
});

test('候補にある全ジャンルが一巡のうちに登場する', () => {
  const { state } = run(buildPool(SKEWED), 40);
  assert.equal(Object.keys(state.genreCounts).length, SKEWED.length);
});

test('在庫が 1 ジャンルしか残っていなくても止まらない', () => {
  const pool = buildPool([['fantasy', 5, 0.9]]);
  const { order } = run(pool, 5);
  assert.equal(order.length, 5);
});

test('プールが空なら null を返す', () => {
  const { item, reason } = pickNext([], {}, { rng: makeRng(1) });
  assert.equal(item, null);
  assert.equal(reason, 'empty');
});

test('同じ乱数種なら同じ順序になる', () => {
  const pool = buildPool(SKEWED);
  assert.deepEqual(run(pool, 25, { seed: 7 }).order, run(pool, 25, { seed: 7 }).order);
});

test('探索モードだけにすると、最も見ていないジャンルから選ばれる', () => {
  const pool = buildPool([['fantasy', 10, 0.99], ['social', 10, 0.1]]);
  const state = { history: [], genreCounts: { fantasy: 40 } };
  const { item, reason } = pickNext(pool, state, {
    rng: makeRng(3),
    weights: { ...DEFAULT_WEIGHTS, exploreRate: 1 },
  });
  assert.equal(reason, 'explore');
  assert.equal(item.genres[0], 'social', '評価が低くても未視聴ジャンルを優先すべき');
});

test('starvationMap は見ていないジャンルほど 1 に近い', () => {
  const map = starvationMap({ a: 90, b: 10, c: 0 }, ['a', 'b', 'c']);
  assert.equal(map.a, 0);
  assert.ok(map.c > map.b && map.b > map.a);
  assert.ok(map.c <= 1);
});
