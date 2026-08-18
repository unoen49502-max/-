import { fetchText, parseFeedSafe } from '../sourceUtil.js';
import { makeItem } from '../item.js';

/**
 * 任意の RSS/Atom を読む汎用ソース。
 * 好きなフィードを config.json の sources.rss.feeds に足せば、そのまま流れてくる。
 * ジャンルの偏りを崩したいときは「自分が普段読まない媒体」のフィードを足すのが一番効く。
 */
export const rss = {
  id: 'rss',
  label: 'RSS フィード',
  defaults: {
    enabled: true,
    feeds: [
      { url: 'https://natalie.mu/comic/feed/news', name: 'コミックナタリー', weight: 1 },
      { url: 'https://originalnews.nico/feed?cat=6', name: 'ニコニコニュース(マンガ)', weight: 1 },
      { url: 'https://note.com/hashtag/漫画/rss', name: 'note (#漫画)', weight: 1 },
    ],
  },

  async collect(config, log = () => {}) {
    const items = [];
    for (const feed of config.feeds || []) {
      if (feed.enabled === false) continue;
      try {
        const xml = await fetchText(feed.url);
        const entries = parseFeedSafe(xml);
        // このソースは「いいね数」に当たる指標を持たないので、
        // フィード内の掲載順（＝新着順・注目順）を人気度の代理にする。
        const total = Math.max(entries.length, 1);
        entries.forEach((entry, index) => {
          if (!entry.link) return;
          items.push(makeItem({
            source: `rss:${feed.name || feed.url}`,
            url: entry.link,
            title: entry.title,
            summary: entry.summary,
            author: entry.author,
            image: entry.image,
            publishedAt: entry.publishedAt,
            tags: entry.categories,
            popularity: (total - index) * (feed.weight ?? 1),
            popularityLabel: feed.name || '',
          }));
        });
        log(`rss(${feed.name || feed.url}): ${entries.length} 件`);
      } catch (error) {
        log(`rss(${feed.name || feed.url}): 取得失敗 (${error.message})`);
      }
    }
    return items;
  },
};
