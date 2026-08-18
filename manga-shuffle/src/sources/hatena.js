import { fetchText, parseFeedSafe } from '../sourceUtil.js';
import { makeItem } from '../item.js';
import { tagText } from '../feed.js';

const BASE = 'https://b.hatena.ne.jp/search/text';

/**
 * はてなブックマークの検索フィード。
 * X の課金なしで「日本語圏で実際に伸びた漫画の話題」を取れる主軸のソース。
 * 仕様: https://developer.hatena.ne.jp/ja/documents/bookmark/misc/feed/
 */
export const hatena = {
  id: 'hatena',
  label: 'はてなブックマーク',
  defaults: {
    enabled: true,
    // 検索語を分けておくと、1 語では拾えない層（Web 漫画 / 個人発表 / 読切）が混ざる。
    queries: ['漫画', 'マンガ', 'webマンガ', '読切', '漫画 感想', '漫画 おすすめ'],
    minUsers: 20,
    pagesPerQuery: 2,
    withinDays: 120,
  },

  buildUrls(config) {
    const urls = [];
    const end = new Date();
    const begin = new Date(end.getTime() - config.withinDays * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    for (const q of config.queries) {
      for (let page = 1; page <= config.pagesPerQuery; page += 1) {
        const params = new URLSearchParams({
          q,
          mode: 'rss',
          sort: 'popular',
          users: String(config.minUsers),
          date_begin: fmt(begin),
          date_end: fmt(end),
          page: String(page),
          safe: 'on',
        });
        urls.push(`${BASE}?${params}`);
      }
    }
    return urls;
  },

  async collect(config, log = () => {}) {
    const items = [];
    for (const url of this.buildUrls(config)) {
      try {
        const xml = await fetchText(url);
        const entries = parseFeedSafe(xml);
        for (const entry of entries) {
          if (!entry.link) continue;
          const users = Number(tagText(entry.raw, 'hatena:bookmarkcount')) || 0;
          items.push(makeItem({
            source: 'hatena',
            url: entry.link,
            title: entry.title,
            summary: entry.summary,
            author: entry.author,
            image: entry.image,
            publishedAt: entry.publishedAt,
            tags: entry.categories,
            popularity: users,
            popularityLabel: users ? `${users} users` : '',
          }));
        }
        log(`hatena: ${entries.length} 件 <- ${url}`);
      } catch (error) {
        log(`hatena: 取得失敗 (${error.message})`);
      }
    }
    return items;
  },
};
