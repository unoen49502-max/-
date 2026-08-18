// RSS 1.0 (RDF) / RSS 2.0 / Atom を依存なしで読むための最小パーサ。
// 完全な XML パーサではなく、フィードに現れる構造だけを狙って取り出す。

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeEntities(s) {
  if (!s) return '';
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    const hit = ENTITIES[body.toLowerCase()];
    return hit === undefined ? whole : hit;
  });
}

function stripCdata(s) {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  return m ? m[1] : s;
}

export function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// <tag ...>value</tag> の最初の 1 件を返す。名前空間つきタグ (dc:date) もそのまま指定できる。
export function tagText(xml, name) {
  const re = new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(name)}>`, 'i');
  const m = re.exec(xml);
  return m ? decodeEntities(stripCdata(m[1])).trim() : '';
}

export function tagTextAll(xml, name) {
  const re = new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(name)}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(decodeEntities(stripCdata(m[1])).trim());
  return out;
}

export function attr(tagSource, name) {
  const re = new RegExp(`\\s${escapeRe(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tagSource);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : '';
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blocks(xml, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, 'gi');
  return xml.match(re) || [];
}

// Atom の <link rel="alternate" href="..."> を優先して拾う。
function atomLink(entry) {
  const links = entry.match(/<link\b[^>]*\/?>/gi) || [];
  let fallback = '';
  for (const raw of links) {
    const href = attr(raw, 'href');
    if (!href) continue;
    const rel = attr(raw, 'rel');
    if (!rel || rel === 'alternate') return href;
    if (!fallback) fallback = href;
  }
  return fallback;
}

function firstImage(...htmlChunks) {
  for (const chunk of htmlChunks) {
    if (!chunk) continue;
    const m = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(chunk);
    if (m) return decodeEntities(m[1] ?? m[2]);
  }
  return '';
}

function enclosureImage(block) {
  const tags = block.match(/<(?:enclosure|media:content|media:thumbnail)\b[^>]*\/?>/gi) || [];
  for (const raw of tags) {
    const url = attr(raw, 'url');
    if (!url) continue;
    const type = attr(raw, 'type');
    if (!type || type.startsWith('image/') || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url)) return url;
  }
  return '';
}

function toIso(value) {
  if (!value) return '';
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

/**
 * フィード XML をフラットなエントリ配列にする。
 * @returns {Array<{title:string,link:string,summary:string,html:string,author:string,
 *                  publishedAt:string,categories:string[],image:string,raw:string}>}
 */
export function parseFeed(xml) {
  const text = String(xml || '');
  const items = blocks(text, 'item').concat(blocks(text, 'entry'));
  return items.map((block) => {
    const html = tagText(block, 'content:encoded')
      || tagText(block, 'content')
      || tagText(block, 'description')
      || tagText(block, 'summary');
    const link = tagText(block, 'link') || atomLink(block) || tagText(block, 'guid');
    const categories = [
      ...tagTextAll(block, 'dc:subject'),
      ...tagTextAll(block, 'category'),
      ...(block.match(/<category\b[^>]*\/>/gi) || []).map((raw) => attr(raw, 'term')),
    ].map((s) => s.trim()).filter(Boolean);
    return {
      title: stripTags(tagText(block, 'title')),
      link: link.trim(),
      summary: stripTags(html).slice(0, 600),
      html,
      author: stripTags(
        tagText(block, 'dc:creator') || tagText(block, 'author') || tagText(block, 'name'),
      ),
      publishedAt: toIso(
        tagText(block, 'dc:date') || tagText(block, 'pubDate')
        || tagText(block, 'published') || tagText(block, 'updated'),
      ),
      categories: [...new Set(categories)],
      image: enclosureImage(block) || firstImage(html),
      raw: block,
    };
  });
}
