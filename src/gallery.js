'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');

const META = [
  { dir: '01_horizontal', jp: '横薙ぎ', en: 'Horizontal', desc: '上方を左→右に薙ぐ三日月斬。', hex: '#3f8bff' },
  { dir: '02_diagonal',  jp: '袈裟斬り', en: 'Diagonal',  desc: '右上→左下へ抜ける長刀の一閃。', hex: '#ff5346' },
  { dir: '03_cross',     jp: '十字斬り', en: 'Cross',     desc: '二連斬が交差、閃光が炸裂する。', hex: '#ffbe4d' },
  { dir: '04_spin',      jp: '回転斬り', en: 'Spin',      desc: '一回転して衝撃波リングへ拡散。', hex: '#4dffa0' },
  { dir: '05_rising',    jp: '斬り上げ', en: 'Rising',    desc: '左下→右上へ立ち上がる斬撃。', hex: '#a852ff' },
  { dir: 'magic_01_arcane', jp: '魔法陣・秘術', en: 'Arcane Circle', desc: 'ヘキサグラムが回る足元の魔法陣（ループ）。', hex: '#c05bff' },
  { dir: 'magic_02_fire',   jp: '魔法陣・炎',   en: 'Fire Circle',   desc: 'ペンタグラムと炎、火の粉が舞う（ループ）。', hex: '#ff6a1a' },
  { dir: 'magic_03_holy',   jp: '魔法陣・聖',   en: 'Holy Circle',   desc: '同心リングと放射光の荘厳な陣（ループ）。', hex: '#ffc23d' },
];

const b64 = (p) => fs.readFileSync(p).toString('base64');

function main() {
  const cards = META.map((m) => {
    const gif = `data:image/gif;base64,${b64(path.join(OUT_DIR, m.dir, `${m.dir}.gif`))}`;
    const strip = `data:image/png;base64,${b64(path.join(OUT_DIR, m.dir, `${m.dir}_spritesheet.png`))}`;
    return `
    <article class="card" style="--accent:${m.hex}">
      <div class="stage"><img class="gif" src="${gif}" alt="${m.en}"></div>
      <div class="meta">
        <h2>${m.jp} <span class="en">${m.en}</span></h2>
        <p>${m.desc}</p>
        <div class="stripwrap"><img class="strip" src="${strip}" alt="sprite sheet"></div>
      </div>
    </article>`;
  }).join('\n');

  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>斬撃エフェクト集 — Dot Slash FX</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0a0a0f;color:#e8e8f0;font-family:system-ui,"Hiragino Kaku Gothic ProN",sans-serif}
  header{padding:28px 24px 8px}
  h1{margin:0;font-size:22px;letter-spacing:.02em}
  .sub{color:#8a8a9a;font-size:13px;margin-top:4px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;padding:20px 24px 48px}
  .card{background:#12121a;border:1px solid #23232f;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px #000 inset}
  .stage{background:radial-gradient(circle at 50% 45%,#181826,#0b0b12);display:flex;justify-content:center;align-items:center;padding:10px}
  .gif{width:256px;height:256px;image-rendering:pixelated;max-width:100%}
  .meta{padding:14px 16px 18px;border-top:2px solid var(--accent)}
  h2{margin:0 0 4px;font-size:18px}
  .en{color:var(--accent);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-left:6px}
  .meta p{margin:0 0 10px;color:#a6a6b6;font-size:13px}
  .stripwrap{overflow-x:auto;background:#0b0b12;border-radius:6px;padding:6px}
  .strip{height:48px;image-rendering:pixelated;display:block}
</style></head><body>
<header>
  <h1>斬撃エフェクト集 <span style="color:#6a6a7a;font-weight:400">/ Dot Slash FX</span></h1>
  <div class="sub">自作ピクセルエフェクトエンジンで生成 — 全5種 · 透過スプライトシート付き</div>
</header>
<div class="grid">
${cards}
</div>
</body></html>`;

  const out = path.join(OUT_DIR, 'gallery.html');
  fs.writeFileSync(out, html);
  console.log('wrote', path.relative(process.cwd(), out), `(${(html.length / 1024).toFixed(0)} KB)`);
}

main();
