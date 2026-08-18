import test from 'node:test';
import assert from 'node:assert/strict';
import { trimPool, spreadOf } from '../src/collect.js';
import { makeItem, dedupe, scoreItems, canonicalUrl } from '../src/item.js';

test('プールを削っても少数ジャンルが消えない', () => {
  const pool = [];
  for (let i = 0; i < 200; i += 1) pool.push({ id: `f${i}`, genres: ['fantasy'], score: 0.95 });
  for (let i = 0; i < 4; i += 1) pool.push({ id: `m${i}`, genres: ['medical'], score: 0.1 });
  for (let i = 0; i < 2; i += 1) pool.push({ id: `s${i}`, genres: ['social'], score: 0.05 });

  const trimmed = trimPool(pool, 30);
  const spread = spreadOf(trimmed);
  assert.equal(trimmed.length, 30);
  assert.equal(spread.medical, 4, '点数が低くても少数ジャンルは残すべき');
  assert.equal(spread.social, 2);
  assert.ok(spread.fantasy < 200);
});

test('未表示の項目を優先して残す', () => {
  const pool = [
    { id: 'seen', genres: ['a'], score: 0.99 },
    { id: 'fresh', genres: ['a'], score: 0.1 },
  ];
  const trimmed = trimPool(pool, 1, { seen: { seen: new Date().toISOString() } });
  assert.equal(trimmed[0].id, 'fresh');
});

test('計測用パラメータを外して同じ記事をまとめる', () => {
  assert.equal(canonicalUrl('https://ex.com/a?utm_source=t&id=3#x'), 'https://ex.com/a?id=3');
  assert.equal(canonicalUrl('https://twitter.com/u/status/1'), 'https://x.com/u/status/1');
});

test('URL とタイトルの重複を落とす', () => {
  const items = [
    makeItem({ source: 's', url: 'https://ex.com/1?utm_medium=x', title: '漫画A' }),
    makeItem({ source: 's', url: 'https://ex.com/1', title: '別題' }),
    makeItem({ source: 's', url: 'https://ex.com/2', title: '漫画A' }),
    makeItem({ source: 's', url: 'https://ex.com/3', title: '漫画B' }),
  ];
  assert.deepEqual(dedupe(items).map((i) => i.title), ['漫画A', '漫画B']);
});

test('人気度の単位が違うソースを混ぜても順位で比較できる', () => {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const items = scoreItems([
    makeItem({ source: 'hatena', url: 'https://a/1', title: '漫画 低', popularity: 20, publishedAt: iso }),
    makeItem({ source: 'hatena', url: 'https://a/2', title: '漫画 高', popularity: 5000, publishedAt: iso }),
    makeItem({ source: 'x', url: 'https://b/1', title: '漫画 低', popularity: 300, publishedAt: iso }),
    makeItem({ source: 'x', url: 'https://b/2', title: '漫画 高', popularity: 90000, publishedAt: iso }),
  ], { now });
  const byUrl = Object.fromEntries(items.map((i) => [i.url, i.score]));
  assert.ok(byUrl['https://a/2'] > byUrl['https://a/1']);
  assert.ok(byUrl['https://b/2'] > byUrl['https://b/1']);
  // 生の数値では x が桁違いに大きいが、順位に直すので両ソースの上位は同水準になる。
  assert.ok(Math.abs(byUrl['https://a/2'] - byUrl['https://b/2']) < 0.05);
});

test('作品そのものより周辺ニュースの方が低く出る', () => {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  // score はソース内の順位で決まるので、順位の影響を消すため別ソースに 1 件ずつ置く。
  const [pure, news] = scoreItems([
    makeItem({ source: 'p', url: 'https://a/1', title: '面白い漫画を描きました', popularity: 100, publishedAt: iso }),
    makeItem({ source: 'n', url: 'https://a/2', title: '人気漫画のアニメ化が決定、声優も発表', popularity: 100, publishedAt: iso }),
  ], { now });
  assert.equal(pure.noise, 0);
  assert.equal(news.noise, 2);
  assert.ok(pure.score > news.score, `${pure.score} > ${news.score}`);
});

test('漫画と無関係そうな項目は score が下がる', () => {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const [manga, other] = scoreItems([
    makeItem({ source: 'p', url: 'https://a/1', title: '新連載の漫画が良い', popularity: 100, publishedAt: iso }),
    makeItem({ source: 'n', url: 'https://a/2', title: '今日の天気について', popularity: 100, publishedAt: iso }),
  ], { now });
  assert.equal(manga.mangaish, true);
  assert.equal(other.mangaish, false);
  assert.ok(manga.score > other.score);
});
