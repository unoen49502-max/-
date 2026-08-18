import { SOURCES } from './sources/index.js';
import { dedupe, scoreItems } from './item.js';
import { xBudget } from './store.js';
import { primaryGenre } from './rotator.js';

/**
 * 全ソースから集めて、重複を落とし、点数をつけてプールに入れる。
 * ソース 1 つが落ちても他は続行する。
 */
export async function collectAll(config, state, log = () => {}) {
  const collected = [];
  const report = [];

  for (const source of SOURCES) {
    const sourceConfig = config.sources[source.id];
    if (!sourceConfig || sourceConfig.enabled === false) {
      report.push({ source: source.id, status: 'disabled', count: 0 });
      continue;
    }
    const ctx = source.id === 'x'
      ? { budget: xBudget(state, sourceConfig.maxReadsPerDay ?? 0) }
      : {};
    const started = Date.now();
    try {
      const items = await source.collect(sourceConfig, log, ctx);
      collected.push(...items);
      report.push({
        source: source.id, status: 'ok', count: items.length, ms: Date.now() - started,
      });
    } catch (error) {
      log(`${source.id}: 収集全体が失敗 (${error.message})`);
      report.push({ source: source.id, status: 'error', count: 0, error: error.message });
    }
  }

  const fresh = dedupe(scoreItems(collected));
  const known = new Set(state.pool.map((item) => item.id));
  const added = fresh.filter((item) => !known.has(item.id));

  // 既存プールは点数を維持したまま、新規だけを足す。
  state.pool = trimPool([...state.pool, ...added], config.collect.poolSize, state);
  state.lastCollectedAt = new Date().toISOString();

  return {
    report,
    totalFetched: collected.length,
    added: added.length,
    poolSize: state.pool.length,
    genreSpread: spreadOf(state.pool),
  };
}

/**
 * プールが上限を超えたら削る。
 * 単純に低得点から削ると少数ジャンルが消えて多様性が死ぬので、
 * ジャンルごとに順番に残す（ラウンドロビン）方式で間引く。
 */
export function trimPool(pool, limit, state = { seen: {} }) {
  if (pool.length <= limit) return pool;

  const byGenre = new Map();
  for (const item of pool) {
    const genre = primaryGenre(item);
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre).push(item);
  }
  for (const list of byGenre.values()) {
    list.sort((a, b) => {
      const aSeen = state.seen?.[a.id] ? 1 : 0;
      const bSeen = state.seen?.[b.id] ? 1 : 0;
      if (aSeen !== bSeen) return aSeen - bSeen; // 未表示を優先して残す
      return (b.score || 0) - (a.score || 0);
    });
  }

  const kept = [];
  const queues = [...byGenre.values()];
  let index = 0;
  while (kept.length < limit && queues.some((q) => q.length)) {
    const queue = queues[index % queues.length];
    if (queue.length) kept.push(queue.shift());
    index += 1;
  }
  return kept;
}

export function spreadOf(pool) {
  const counts = {};
  for (const item of pool) {
    const genre = primaryGenre(item);
    counts[genre] = (counts[genre] || 0) + 1;
  }
  return counts;
}
