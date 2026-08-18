import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 保存先を一時ディレクトリに向けてから読み込む（store.js は起動時に環境変数を見る）。
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manga-shuffle-test-'));
process.env.MANGA_SHUFFLE_DATA_DIR = dataDir;
process.env.MANGA_SHUFFLE_CONFIG = path.join(dataDir, 'config.json');

const { makeItem, scoreItems } = await import('../src/item.js');
const { createServer } = await import('../src/server.js');
const { defaultConfig } = await import('../src/config.js');

function seedState() {
  const specs = [
    ['異世界転生した勇者の冒険漫画', 'https://ex.test/f'],
    ['深夜食堂のラーメン漫画', 'https://ex.test/g'],
    ['保護猫と暮らす実録エッセイ漫画', 'https://ex.test/a'],
    ['幕末の侍の時代劇漫画', 'https://ex.test/h'],
    ['看護師の病院日誌 漫画', 'https://ex.test/m'],
    ['高校バレー部の青春漫画', 'https://ex.test/s'],
  ];
  const pool = [];
  for (const [title, base] of specs) {
    for (let i = 0; i < 6; i += 1) {
      pool.push(makeItem({
        source: 'rss:test',
        url: `${base}/${i}`,
        title: `${title} その${i}`,
        summary: 'テスト用の本文',
        popularity: 100 - i,
        publishedAt: new Date().toISOString(),
      }));
    }
  }
  scoreItems(pool);
  fs.writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify({
    version: 1, pool, seen: {}, favorites: [], skipped: {},
    history: [], genreCounts: {}, lastCollectedAt: '', xBudget: { date: '', reads: 0 },
  }));
}

async function withServer(fn) {
  seedState();
  const config = defaultConfig();
  config.collect.reshowAfterDays = 0;
  const server = createServer(config);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const get = async (base, p) => (await fetch(base + p)).json();
const post = async (base, p, body) => (await fetch(base + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
})).json();

test('/api/next は毎回別の項目を返し、ジャンルが連続しない', async () => {
  await withServer(async (base) => {
    const seen = new Set();
    let previousGenre = null;
    for (let i = 0; i < 12; i += 1) {
      const data = await get(base, '/api/next');
      assert.ok(data.item, `${i} 回目で候補が尽きた`);
      assert.ok(!seen.has(data.item.id), '同じ項目が二度出た');
      seen.add(data.item.id);
      assert.ok(data.item.genreLabels.length > 0);
      assert.notEqual(data.item.genres[0], previousGenre, '同じジャンルが連続した');
      previousGenre = data.item.genres[0];
    }
  });
});

test('peek=1 は履歴を進めない', async () => {
  await withServer(async (base) => {
    const first = await get(base, '/api/next?peek=1');
    const stats = await get(base, '/api/stats');
    assert.equal(stats.shownTotal, 0);
    assert.ok(first.item);
  });
});

test('お気に入りの登録と解除', async () => {
  await withServer(async (base) => {
    const { item } = await get(base, '/api/next');
    assert.deepEqual(await post(base, '/api/favorite', { id: item.id, on: true }), { favorited: true });
    assert.equal((await get(base, '/api/favorites')).favorites.length, 1);
    assert.deepEqual(await post(base, '/api/favorite', { id: item.id, on: false }), { favorited: false });
    assert.equal((await get(base, '/api/favorites')).favorites.length, 0);
  });
});

test('統計に全ジャンルの内訳が出る', async () => {
  await withServer(async (base) => {
    for (let i = 0; i < 6; i += 1) await get(base, '/api/next');
    const stats = await get(base, '/api/stats');
    assert.equal(stats.shownTotal, 6);
    assert.equal(stats.poolTotal, 36);
    assert.ok(stats.genres.length >= 6);
    assert.ok(stats.genres.every((g) => g.label && typeof g.shown === 'number'));
  });
});

test('「興味なし」にした項目は二度と出てこない', async () => {
  await withServer(async (base) => {
    const { item } = await get(base, '/api/next');
    await post(base, '/api/skip', { id: item.id });
    for (let i = 0; i < 35; i += 1) {
      const next = await get(base, '/api/next');
      if (!next.item) break;
      assert.notEqual(next.item.id, item.id);
    }
  });
});

test('表示履歴のリセット', async () => {
  await withServer(async (base) => {
    await get(base, '/api/next');
    await post(base, '/api/reset-history');
    assert.equal((await get(base, '/api/stats')).shownTotal, 0);
  });
});

test('表示秒数の変更は範囲外を弾く', async () => {
  await withServer(async (base) => {
    assert.equal((await post(base, '/api/display', { secondsPerItem: 20 })).display.secondsPerItem, 20);
    assert.equal((await post(base, '/api/display', { secondsPerItem: 99999 })).display.secondsPerItem, 20);
    assert.equal((await post(base, '/api/display', { secondsPerItem: 'abc' })).display.secondsPerItem, 20);
  });
});

test('プールを使い切ったら空を返す（落ちない）', async () => {
  await withServer(async (base) => {
    for (let i = 0; i < 36; i += 1) await get(base, '/api/next');
    const data = await get(base, '/api/next');
    assert.equal(data.item, null);
    assert.match(data.reason, /プール/);
  });
});

test('public の外のファイルは配信しない', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/../package.json`, { redirect: 'manual' });
    assert.ok(res.status === 403 || res.status === 404, `status=${res.status}`);
    const encoded = await fetch(`${base}/%2e%2e%2f%2e%2e%2fpackage.json`);
    assert.ok(encoded.status === 403 || encoded.status === 404, `status=${encoded.status}`);
  });
});

test('index.html と静的ファイルを配信する', async () => {
  await withServer(async (base) => {
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /漫画シャッフル/);
    assert.equal((await fetch(`${base}/app.js`)).status, 200);
    assert.equal((await fetch(`${base}/style.css`)).status, 200);
  });
});

test('壊れた JSON を投げても 400 で返す', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/skip`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops',
    });
    assert.equal(res.status, 400);
  });
});
