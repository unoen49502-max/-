import { UNCLASSIFIED } from './genres.js';

/** テストで再現できるよう、乱数は差し替え可能な形にしておく。 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_WEIGHTS = {
  quality: 1.0,       // 評判のよさをどれだけ尊重するか
  starvation: 1.6,    // 見ていないジャンルをどれだけ優先するか（多様性の主役）
  novelty: 1.2,       // 一度も見たことのないジャンルへの加点
  cooldown: 2.0,      // 直近に出たジャンルへの減点
  repeatSource: 0.35, // 同じ取得元が続くことへの減点
  repeatAuthor: 0.8,  // 同じ作者・同じサイトが続くことへの減点
  temperature: 0.35,  // 0 に近いほど決定的、大きいほどランダム
  hardWindow: 3,      // 直近何件は同じジャンルを出さないか（在庫が尽きれば自動で緩む）
  cooldownWindow: 8,  // 減点の対象にする直近の件数
  exploreRate: 0.2,   // この確率で品質を無視し「最も見ていないジャンル」から選ぶ
};

export function primaryGenre(item) {
  return (item.genres && item.genres[0]) || UNCLASSIFIED;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 直近履歴のうち、そのジャンルが何件前に出たか。出ていなければ null。 */
function lastDistance(history, genre) {
  for (let i = 0; i < history.length; i += 1) {
    if (history[i].genre === genre) return i + 1; // 1 = 直前
  }
  return null;
}

/**
 * ジャンル別の「見ていなさ」を 0..1 で出す。
 * 均等に見ている状態を 0、まったく見ていないジャンルを 1 に近づける。
 */
export function starvationMap(genreCounts, genresInPool) {
  const genres = [...new Set(genresInPool)];
  if (!genres.length) return {};
  const total = genres.reduce((sum, g) => sum + (genreCounts[g] || 0), 0);
  const target = 1 / genres.length;
  const out = {};
  for (const genre of genres) {
    const actual = total > 0 ? (genreCounts[genre] || 0) / total : 0;
    // target を超えて見ているジャンルは 0、見ていないほど 1 に寄る。
    out[genre] = Math.max(0, (target - actual) / target);
  }
  return out;
}

function weightedPick(scored, temperature, rng) {
  if (!scored.length) return null;
  if (temperature <= 0) return scored[0].item;
  const max = scored[0].value;
  let total = 0;
  const weights = scored.map(({ value }) => {
    const w = Math.exp((value - max) / temperature);
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < scored.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return scored[i].item;
  }
  return scored[scored.length - 1].item;
}

/**
 * 次に表示する 1 件を選ぶ。
 * @param {Array} pool          未読の候補
 * @param {Object} state        { history: [{id,genre,source,host}], genreCounts: {genre:count} }
 * @param {Object} options      重み・乱数
 * @returns {{item:Object|null, reason:string, debug:Object}}
 */
export function pickNext(pool, state = {}, options = {}) {
  const w = { ...DEFAULT_WEIGHTS, ...options.weights };
  const rng = options.rng || Math.random;
  const history = (state.history || []).slice(0, Math.max(w.cooldownWindow, w.hardWindow));
  const genreCounts = state.genreCounts || {};

  const candidates = pool.filter((item) => item && item.url);
  if (!candidates.length) return { item: null, reason: 'empty', debug: {} };

  const starve = starvationMap(genreCounts, candidates.map(primaryGenre));
  const prev = history[0];

  // 直近に出たジャンルを段階的に締め出す。候補が尽きたら窓を狭めて必ず 1 件返す。
  let allowed = [];
  let usedWindow = w.hardWindow;
  for (let window = w.hardWindow; window >= 0; window -= 1) {
    const banned = new Set(history.slice(0, window).map((h) => h.genre));
    allowed = candidates.filter((item) => !banned.has(primaryGenre(item)));
    usedWindow = window;
    if (allowed.length) break;
  }
  if (!allowed.length) allowed = candidates;

  // 探索モード: 品質を見ずに「最も見ていないジャンル」だけから選ぶ。
  // これが「知らないジャンルが強制的に流れてくる」ことの保証になる。
  const exploring = rng() < w.exploreRate;
  let workingSet = allowed;
  if (exploring) {
    const minCount = Math.min(...allowed.map((item) => genreCounts[primaryGenre(item)] || 0));
    const rarest = allowed.filter((item) => (genreCounts[primaryGenre(item)] || 0) === minCount);
    if (rarest.length) workingSet = rarest;
  }

  const scored = workingSet.map((item) => {
    const genre = primaryGenre(item);
    const distance = lastDistance(history, genre);
    const cooldown = distance === null
      ? 0
      : Math.max(0, (w.cooldownWindow - distance + 1) / w.cooldownWindow);
    const novelty = (genreCounts[genre] || 0) === 0 ? 1 : 0;
    const host = hostOf(item.url);
    const sameSource = prev && prev.source === item.source ? 1 : 0;
    const sameHost = prev && host && prev.host === host ? 1 : 0;
    const sameAuthor = prev && item.author && prev.author === item.author ? 1 : 0;

    const value = exploring
      ? 0.3 * (item.score || 0) + w.novelty * novelty - w.cooldown * cooldown
      : w.quality * (item.score || 0)
        + w.starvation * (starve[genre] || 0)
        + w.novelty * novelty
        - w.cooldown * cooldown
        - w.repeatSource * sameSource
        - w.repeatAuthor * Math.max(sameHost, sameAuthor);

    return { item, value, genre, cooldown, novelty, starve: starve[genre] || 0 };
  }).sort((a, b) => b.value - a.value);

  const chosen = weightedPick(scored, w.temperature, rng);
  return {
    item: chosen,
    reason: exploring ? 'explore' : 'diversity',
    debug: {
      usedWindow,
      exploring,
      poolSize: candidates.length,
      allowedSize: allowed.length,
      top: scored.slice(0, 5).map((s) => ({
        title: s.item.title, genre: s.genre, value: Math.round(s.value * 1000) / 1000,
      })),
    },
  };
}

/** 表示後に履歴とジャンル別カウントを進める。 */
export function recordShown(state, item) {
  const genre = primaryGenre(item);
  const host = (() => {
    try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();
  state.history = [{ id: item.id, genre, source: item.source, host, author: item.author, at: new Date().toISOString() },
    ...(state.history || [])].slice(0, 200);
  state.genreCounts = { ...(state.genreCounts || {}) };
  state.genreCounts[genre] = (state.genreCounts[genre] || 0) + 1;
  return state;
}
