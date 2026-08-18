#!/usr/bin/env node
import { loadConfig } from '../src/config.js';
import { loadState, saveState } from '../src/store.js';
import { collectAll } from '../src/collect.js';
import { labelOf } from '../src/genres.js';

const config = loadConfig();
const state = loadState();

const result = await collectAll(config, state, (message) => console.log(`  ${message}`));
saveState(state);

console.log('\n--- 収集結果 ---');
for (const row of result.report) {
  console.log(`${row.source.padEnd(8)} ${row.status.padEnd(9)} ${String(row.count).padStart(4)} 件`
    + (row.error ? `  ${row.error}` : ''));
}
console.log(`\n新規 ${result.added} 件 / プール ${result.poolSize} 件`);
console.log('ジャンル分布:');
for (const [genre, count] of Object.entries(result.genreSpread).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${labelOf(genre).padEnd(14)} ${String(count).padStart(4)}`);
}
