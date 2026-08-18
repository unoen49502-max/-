import { fetchText, HttpError } from '../sourceUtil.js';
import { makeItem } from '../item.js';

const API = 'https://api.x.com/2';

/**
 * X (Twitter) 本体からの収集。
 *
 * 2026 年 2 月以降、X API の読み取りは従量課金が既定で、無料の読み取り枠は新規発行されない。
 * そのため本ソースは既定で無効。bearerToken を設定したときだけ動き、
 * maxReadsPerRun / maxReadsPerDay で読み取り件数に上限をかけて課金を予測可能にする。
 *
 * 無効のままでも、はてブや RSS 経由で拾ったツイート URL は
 * 表示側が公式ウィジェットで埋め込むので「X で話題の漫画」自体は流れる。
 */
export const x = {
  id: 'x',
  label: 'X (Twitter)',
  defaults: {
    enabled: false,
    bearerToken: '',
    queries: [
      '(漫画 OR マンガ) (描きました OR 読切 OR 新連載) -is:retweet -is:reply has:media lang:ja',
      '(創作漫画 OR オリジナル漫画 OR エッセイ漫画) -is:retweet -is:reply has:media lang:ja',
    ],
    // 1 回の収集で読む上限。X の従量課金は 1 件あたり $0.005 なので、
    // 200 件 = 約 $1 と読み替えて設定すること。
    maxReadsPerRun: 100,
    maxReadsPerDay: 300,
    minLikes: 300,
    listId: '',
  },

  async collect(config, log = () => {}, ctx = {}) {
    if (!config.bearerToken) {
      log('x: bearerToken が未設定のためスキップ');
      return [];
    }
    const budget = ctx.budget || { remaining: () => config.maxReadsPerRun, spend: () => {} };
    const items = [];
    const headers = { authorization: `Bearer ${config.bearerToken}` };

    const endpoints = [];
    for (const query of config.queries || []) {
      endpoints.push({ kind: 'search', query });
    }
    if (config.listId) endpoints.push({ kind: 'list', listId: config.listId });

    for (const endpoint of endpoints) {
      const allowance = Math.min(config.maxReadsPerRun, budget.remaining());
      if (allowance < 10) {
        log('x: 読み取り上限に達したので停止');
        break;
      }
      const maxResults = Math.max(10, Math.min(100, allowance));
      const params = new URLSearchParams({
        max_results: String(maxResults),
        'tweet.fields': 'public_metrics,created_at,entities,lang,note_tweet',
        expansions: 'author_id,attachments.media_keys',
        'media.fields': 'url,preview_image_url,type',
        'user.fields': 'name,username,verified',
      });
      let url;
      if (endpoint.kind === 'search') {
        params.set('query', endpoint.query);
        url = `${API}/tweets/search/recent?${params}`;
      } else {
        url = `${API}/lists/${endpoint.listId}/tweets?${params}`;
      }

      try {
        const payload = JSON.parse(await fetchText(url, { headers, retries: 1 }));
        const tweets = payload.data || [];
        budget.spend(tweets.length);
        const users = new Map((payload.includes?.users || []).map((u) => [u.id, u]));
        const media = new Map((payload.includes?.media || []).map((m) => [m.media_key, m]));

        for (const tweet of tweets) {
          const metrics = tweet.public_metrics || {};
          const likes = metrics.like_count || 0;
          if (likes < config.minLikes) continue;
          const user = users.get(tweet.author_id);
          const handle = user ? user.username : '';
          const firstMedia = (tweet.attachments?.media_keys || [])
            .map((key) => media.get(key)).find(Boolean);
          const hashtags = (tweet.entities?.hashtags || []).map((h) => h.tag);
          const text = tweet.note_tweet?.text || tweet.text || '';
          items.push(makeItem({
            source: 'x',
            kind: 'tweet',
            tweetId: tweet.id,
            url: `https://x.com/${handle || 'i'}/status/${tweet.id}`,
            title: text.split('\n').find((line) => line.trim()) || text.slice(0, 60),
            summary: text,
            author: user ? `${user.name} (@${handle})` : '',
            image: firstMedia?.url || firstMedia?.preview_image_url || '',
            publishedAt: tweet.created_at || '',
            tags: hashtags,
            popularity: likes,
            popularityLabel: `${likes.toLocaleString('ja-JP')} likes`,
          }));
        }
        log(`x(${endpoint.kind}): ${tweets.length} 件読み取り / 採用 ${items.length} 件`);
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          log('x: 認証エラー (bearerToken を確認)');
          break;
        }
        if (error instanceof HttpError && error.status === 429) {
          log('x: レート上限に達した');
          break;
        }
        log(`x: 取得失敗 (${error.message})`);
      }
    }
    return items;
  },
};
