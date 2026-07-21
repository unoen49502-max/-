import { stages, difficultyLabel } from '../data/stages.js'
import PicrossThumb from '../components/PicrossThumb.jsx'
import './GameScreen.css'

// メニュー→遷移先の確認用プレースホルダー。
// 盤面ロジック本体は今後ここに実装する。
export default function GameScreen({ stageId, onBack, onMenu }) {
  const stage = stages.find((s) => s.id === stageId) ?? stages[0]

  return (
    <div className="game">
      <header className="game__header">
        <button className="iconbtn" onClick={onBack}>← ステージ選択</button>
        <h2 className="game__title">STAGE {stage.id} ・ {stage.name}</h2>
        <button className="iconbtn" onClick={onMenu}>メニュー</button>
      </header>

      <div className="game__stage">
        <PicrossThumb solution={stage.solution} size={220} />
        <p className="game__note">
          「{stage.name}」（{difficultyLabel[stage.difficulty]}）を選択しました。
        </p>
        <p className="game__todo">🚧 盤面ロジックは開発中です</p>
      </div>
    </div>
  )
}
