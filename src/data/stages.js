// ピクロスのステージ定義。
// solution: 0/1 の 2次元配列。1 が塗りマス。
// メニューのサムネイルとゲーム本体の両方でこの解答を使う。

const O = 0
const X = 1

export const stages = [
  {
    id: 1,
    name: 'ハート',
    difficulty: 'easy',
    solution: [
      [O, X, O, X, O],
      [X, X, X, X, X],
      [X, X, X, X, X],
      [O, X, X, X, O],
      [O, O, X, O, O],
    ],
  },
  {
    id: 2,
    name: 'クローバー',
    difficulty: 'easy',
    solution: [
      [O, X, O, X, O],
      [X, X, X, X, X],
      [O, X, X, X, O],
      [O, O, X, O, O],
      [O, X, X, X, O],
    ],
  },
  {
    id: 3,
    name: 'ねこ',
    difficulty: 'normal',
    solution: [
      [X, O, O, O, X],
      [X, X, O, X, X],
      [X, X, X, X, X],
      [X, O, X, O, X],
      [X, X, X, X, X],
    ],
  },
  {
    id: 4,
    name: 'おうかん',
    difficulty: 'normal',
    solution: [
      [X, O, X, O, X],
      [X, O, X, O, X],
      [X, X, X, X, X],
      [X, X, X, X, X],
      [O, O, O, O, O],
    ],
  },
  {
    id: 5,
    name: 'ほし',
    difficulty: 'hard',
    solution: [
      [O, O, X, O, O],
      [X, X, X, X, X],
      [O, X, X, X, O],
      [X, X, O, X, X],
      [X, O, O, O, X],
    ],
  },
  {
    id: 6,
    name: '？？？',
    difficulty: 'hard',
    locked: true,
    solution: [
      [O, O, O, O, O],
      [O, O, O, O, O],
      [O, O, O, O, O],
      [O, O, O, O, O],
      [O, O, O, O, O],
    ],
  },
]

export const difficultyLabel = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
}
