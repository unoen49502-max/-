import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, stripTags, decodeEntities } from '../src/feed.js';

const RSS2 = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>&#x30DE;&#x30F3;&#x30AC;&amp;ごはん</title><link>https://ex.com/a</link>
<description><![CDATA[<p>おいしい<br>漫画</p><img src="https://img/1.png">]]></description>
<pubDate>Tue, 05 Aug 2025 10:00:00 +0900</pubDate><category>グルメ</category></item>
</channel></rss>`;

const RSS1 = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="x" xmlns:dc="y" xmlns:hatena="z">
<item rdf:about="https://ex.com/b"><title>猫漫画</title><link>https://ex.com/b</link>
<description>保護猫の実話</description><dc:date>2025-07-01T00:00:00+09:00</dc:date>
<dc:subject>漫画</dc:subject><dc:subject>猫</dc:subject><hatena:bookmarkcount>412</hatena:bookmarkcount>
</item></rdf:RDF>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>読切がすごい</title><link rel="edit" href="https://ex.com/edit"/>
<link rel="alternate" href="https://ex.com/c"/><summary>感想</summary>
<updated>2025-06-10T12:00:00Z</updated><category term="漫画"/>
<author><name>だれか</name></author></entry></feed>`;

test('RSS 2.0 を読める', () => {
  const [item] = parseFeed(RSS2);
  assert.equal(item.title, 'マンガ&ごはん');
  assert.equal(item.link, 'https://ex.com/a');
  assert.equal(item.summary, 'おいしい\n漫画');
  assert.equal(item.image, 'https://img/1.png');
  assert.deepEqual(item.categories, ['グルメ']);
  assert.equal(item.publishedAt, '2025-08-05T01:00:00.000Z');
});

test('RSS 1.0 (はてブ形式) を読める', () => {
  const [item] = parseFeed(RSS1);
  assert.equal(item.title, '猫漫画');
  assert.deepEqual(item.categories, ['漫画', '猫']);
});

test('Atom は rel=alternate のリンクを優先する', () => {
  const [item] = parseFeed(ATOM);
  assert.equal(item.link, 'https://ex.com/c');
  assert.equal(item.author, 'だれか');
  assert.deepEqual(item.categories, ['漫画']);
});

test('壊れた入力でも例外を投げない', () => {
  assert.deepEqual(parseFeed(''), []);
  assert.deepEqual(parseFeed('<rss><channel></channel></rss>'), []);
  assert.deepEqual(parseFeed(null), []);
});

test('タグ除去と実体参照の復号', () => {
  assert.equal(stripTags('<b>a</b><script>x</script>b'), 'ab');
  assert.equal(decodeEntities('&lt;&amp;&#12354;'), '<&あ');
});
