import crypto from 'node:crypto';
import { classify } from './genres.js';

// 「漫画そのもの」に近い項目だけ残すための語。1 つも当たらなければ弱く扱う。
const MANGA_HINTS = [
  '漫画', 'まんが', 'マンガ', 'コミック', 'comic', '連載', '読切', '読み切り',
  '単行本', '作画', '原作', '電子書籍', 'webマンガ', 'ウェブ漫画', '同人誌',
];

// 作品そのものではなく周辺ニュースになりがちな語。除外はせず減点する。
const NOISE_HINTS = [
  'アニメ化', '実写化', '声優', '興行収入', '株価', '決算', '訃報', '容疑', '逮捕',
  'セール', 'クーポン', 'まとめ買い', 'ランキング速報',
];

export function hashId(...parts) {
  return crypto.createHash('sha1').update(parts.join(' ')).digest('hex').slice(0, 16);
}

export function canonicalUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // 流入計測用パラメータは同じ記事を別物に見せるだけなので落とす。
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_|from$|src$|s$|t$|cmpid|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    }
    if (/^(twitter|x)\.com$/.test(u.hostname)) u.hostname = 'x.com';
    return u.toString();
  } catch {
    return String(url || '');
  }
}

function looksLikeManga(text) {
  const lowered = text.toLowerCase();
  return MANGA_HINTS.some((hint) => lowered.includes(hint.toLowerCase()));
}

function noiseCount(text) {
  const lowered = text.toLowerCase();
  return NOISE_HINTS.filter((hint) => lowered.includes(hint.toLowerCase())).length;
}

/**
 * ソースが返した素の情報を、表示とローテーションで使う共通形に整える。
 * popularity はソース内の盛り上がり度の生値、score は後段で 0..1 に均した値。
 */
export function makeItem({
  source, url, title, summary = '', author = '', image = '', publishedAt = '',
  tags = [], popularity = 0, popularityLabel = '', tweetId = '', kind = 'link',
}) {
  const canonical = canonicalUrl(url);
  const haystack = [title, summary, tags.join(' ')].join(' ');
  const { genres } = classify({ title, summary, tags });
  return {
    id: hashId(canonical || title),
    source,
    kind,
    url: canonical,
    title: String(title || '').trim(),
    summary: String(summary || '').trim(),
    author: String(author || '').trim(),
    image,
    tweetId,
    publishedAt,
    tags,
    genres,
    popularity,
    popularityLabel,
    mangaish: looksLikeManga(haystack),
    noise: noiseCount(haystack),
    score: 0,
    collectedAt: new Date().toISOString(),
  };
}

const HALF_LIFE_DAYS = 21;

function freshness(publishedAt, now) {
  if (!publishedAt) return 0.5;
  const ageDays = (now - Date.parse(publishedAt)) / 86400000;
  if (!Number.isFinite(ageDays)) return 0.5;
  if (ageDays < 0) return 1;
  return Math.pow(2, -ageDays / HALF_LIFE_DAYS);
}

/**
 * popularity の単位はソースごとに違う（はてブ数 / いいね数 / なし）ので、
 * 生値を直接比べず同一ソース内の順位に直してから鮮度とノイズ度を合成する。
 */
export function scoreItems(items, { now = Date.now() } = {}) {
  const bySource = new Map();
  for (const item of items) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item);
  }

  for (const group of bySource.values()) {
    const sorted = [...group].sort((a, b) => a.popularity - b.popularity);
    const last = Math.max(sorted.length - 1, 1);
    sorted.forEach((item, index) => {
      const rank = sorted.length === 1 ? 0.6 : index / last;
      const fresh = freshness(item.publishedAt, now);
      const noisePenalty = 1 / (1 + item.noise * 0.6);
      const mangaBonus = item.mangaish ? 1 : 0.55;
      item.score = Math.round((0.6 * rank + 0.4 * fresh) * noisePenalty * mangaBonus * 10000) / 10000;
    });
  }
  return items;
}

/** URL 正規化後の同一物とタイトル完全一致を落とす。先に来たものを残す。 */
export function dedupe(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const item of items) {
    const titleKey = item.title.replace(/\s+/g, '');
    if (item.url && seenUrl.has(item.url)) continue;
    if (titleKey && seenTitle.has(titleKey)) continue;
    if (item.url) seenUrl.add(item.url);
    if (titleKey) seenTitle.add(titleKey);
    out.push(item);
  }
  return out;
}
