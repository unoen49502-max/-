#!/usr/bin/env node
// 各ソースが「今も」取れるかを実際に叩いて確認する。
// フィードの提供終了や仕様変更は普通に起きるので、動かなくなったらまずこれを実行する。
import { loadConfig } from '../src/config.js';
import { fetchText } from '../src/http.js';
import { parseFeed } from '../src/feed.js';
import { hatena } from '../src/sources/hatena.js';

const config = loadConfig();
const checks = [];

for (const url of hatena.buildUrls(config.sources.hatena).slice(0, 1)) {
  checks.push({ name: 'はてなブックマーク 検索RSS', url, kind: 'feed' });
}
for (const feed of config.sources.rss.feeds || []) {
  checks.push({ name: `RSS: ${feed.name || feed.url}`, url: feed.url, kind: 'feed' });
}
if (config.sources.x.enabled && config.sources.x.bearerToken) {
  checks.push({
    name: 'X API v2 recent search',
    url: `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent('漫画 -is:retweet')}&max_results=10`,
    kind: 'json',
    headers: { authorization: `Bearer ${config.sources.x.bearerToken}` },
  });
} else {
  console.log('X API: 無効 (bearerToken 未設定) — 課金を伴うため既定で off です\n');
}

let failures = 0;
for (const check of checks) {
  process.stdout.write(`${check.name.padEnd(34)} `);
  try {
    const body = await fetchText(check.url, { retries: 0, timeoutMs: 20000, headers: check.headers });
    if (check.kind === 'feed') {
      const entries = parseFeed(body);
      if (!entries.length) throw new Error('0 件（仕様変更の可能性）');
      console.log(`OK  ${String(entries.length).padStart(3)} 件  例: ${entries[0].title.slice(0, 34)}`);
    } else {
      const json = JSON.parse(body);
      console.log(`OK  ${(json.data || []).length} 件`);
    }
  } catch (error) {
    failures += 1;
    console.log(`NG  ${error.message}`);
  }
}

console.log(`\n${checks.length - failures}/${checks.length} が正常です。`);
if (failures) {
  console.log('NG が出たソースは config.json の sources から外すか、別のフィード URL に差し替えてください。');
}
process.exit(failures ? 1 : 0);
