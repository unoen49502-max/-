import { stages } from '../data/stages.js'
import PicrossThumb from '../components/PicrossThumb.jsx'
import './MenuScreen.css'

// タイトル横に飾るサンプル絵（クリア済みっぽく塗ったハート）
const heroStage = stages[0]

export default function MenuScreen({ onStart, onSelectStage }) {
  return (
    <div className="menu">
      <div className="menu__bg" aria-hidden="true" />

      <main className="menu__panel">
        <div className="menu__hero">
          <PicrossThumb solution={heroStage.solution} size={120} />
        </div>

        <h1 className="menu__title">
          <span className="menu__title-main">ピクロス</span>
          <span className="menu__title-sub">2D</span>
        </h1>
        <p className="menu__tagline">数字を手がかりに、絵を浮かび上がらせよう</p>

        <nav className="menu__actions">
          <button className="btn btn--primary" onClick={onStart} autoFocus>
            <span className="btn__label">はじめる</span>
            <span className="btn__hint">ステージ1から</span>
          </button>

          <button className="btn btn--secondary" onClick={onSelectStage}>
            <span className="btn__label">ステージ選択</span>
            <span className="btn__hint">好きな問題を選ぶ</span>
          </button>
        </nav>

        <footer className="menu__footer">v0.1.0 — 開発中</footer>
      </main>
    </div>
  )
}
