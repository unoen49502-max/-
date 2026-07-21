// 解答パターンからミニチュアのピクロス絵を描く共通部品。
// hidden=true のときは中身を隠して「？」マスにする。
export default function PicrossThumb({ solution, hidden = false, size = 96 }) {
  const rows = solution.length
  const cols = solution[0].length

  return (
    <div
      className={`thumb${hidden ? ' thumb--hidden' : ''}`}
      style={{
        width: size,
        height: size,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {solution.flatMap((row, r) =>
        row.map((cell, c) => (
          <span
            key={`${r}-${c}`}
            className={`thumb__cell${cell ? ' thumb__cell--on' : ''}`}
          />
        )),
      )}
    </div>
  )
}
