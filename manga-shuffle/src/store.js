import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

// テストや複数プロファイルのために保存先を差し替えられるようにしておく。
export const DATA_DIR = process.env.MANGA_SHUFFLE_DATA_DIR || path.join(ROOT, 'data');
export const STATE_PATH = path.join(DATA_DIR, 'state.json');

function emptyState() {
  return {
    version: 1,
    pool: [],            // 収集済みで未表示の候補
    seen: {},            // id -> 最後に表示した ISO 日時
    favorites: [],       // お気に入りに入れた項目（プールから消えても残す）
    skipped: {},         // id -> スキップ回数
    history: [],         // 表示順の記録（rotator が参照）
    genreCounts: {},     // ジャンル別の累計表示回数
    lastCollectedAt: '',
    xBudget: { date: '', reads: 0 },
  };
}

export function loadState(statePath = STATE_PATH) {
  if (!fs.existsSync(statePath)) return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(fs.readFileSync(statePath, 'utf8')) };
  } catch {
    // 壊れていても起動を止めない。壊れたファイルは退避しておく。
    try { fs.renameSync(statePath, `${statePath}.broken-${Date.now()}`); } catch { /* noop */ }
    return emptyState();
  }
}

export function saveState(state, statePath = STATE_PATH) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, statePath); // 書き込み途中の状態を残さない
}

/** X API の読み取り件数を日単位で数える。課金額の上限を守るための帳簿。 */
export function xBudget(state, maxPerDay) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.xBudget.date !== today) state.xBudget = { date: today, reads: 0 };
  return {
    remaining: () => Math.max(0, maxPerDay - state.xBudget.reads),
    spend: (n) => { state.xBudget.reads += n; },
    used: () => state.xBudget.reads,
  };
}

/**
 * 表示済みだが再表示が許される項目を候補に戻す。
 * 「興味なし」にしたものは二度と出さない（ジャンルではなくその項目だけを外す。
 * ジャンルごと嫌ったことにすると、偏りを崩すという目的そのものが壊れるため）。
 */
export function availablePool(state, { reshowAfterDays = 0 } = {}) {
  const now = Date.now();
  return state.pool.filter((item) => {
    if (state.skipped[item.id]) return false;
    const seenAt = state.seen[item.id];
    if (!seenAt) return true;
    if (!reshowAfterDays) return false;
    return now - Date.parse(seenAt) > reshowAfterDays * 86400000;
  });
}
