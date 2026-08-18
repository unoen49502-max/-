import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, labelOf, UNCLASSIFIED, GENRES } from '../src/genres.js';

test('代表的な題材を正しいジャンルに寄せる', () => {
  const cases = [
    [{ title: '異世界転生した勇者がダンジョンに潜る漫画' }, 'fantasy'],
    [{ title: '深夜食堂でラーメンを食べるだけの漫画' }, 'gourmet'],
    [{ title: '保護猫と暮らす実録エッセイ' }, 'animal'],
    [{ title: '幕末の侍が刀を抜く時代劇' }, 'history'],
    [{ title: '看護師の病院日誌' }, 'medical'],
    [{ title: '高校バレー部の青春' }, 'sports'],
  ];
  for (const [input, expected] of cases) {
    assert.ok(classify(input).genres.includes(expected), `${input.title} -> ${classify(input).genres}`);
  }
});

test('手がかりがなければ未分類にする（捨てない）', () => {
  assert.deepEqual(classify({ title: 'ふしぎなもの' }).genres, [UNCLASSIFIED]);
});

test('タグはタイトルと同じ重みで効く', () => {
  const withTag = classify({ title: '無題', tags: ['ホラー'] });
  assert.ok(withTag.genres.includes('horror'));
});

test('複数ジャンルを最大 3 件まで返す', () => {
  const result = classify({ title: '学園ラブコメでバトルもある異世界グルメ漫画' });
  assert.ok(result.genres.length <= 3);
  assert.ok(result.genres.length >= 2);
});

test('全ジャンルにラベルがある', () => {
  for (const genre of GENRES) assert.notEqual(labelOf(genre.id), genre.id);
});
