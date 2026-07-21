import { stages, difficultyLabel } from '../data/stages.js'
import PicrossThumb from '../components/PicrossThumb.jsx'
import './StageSelectScreen.css'

export default function StageSelectScreen({ onBack, onPick }) {
  return (
    <div className="select">
      <header className="select__header">
        <button className="iconbtn" onClick={onBack} aria-label="メニューへ戻る">
          ← もどる
        </button>
        <h2 className="select__title">ステージ選択</h2>
        <span className="select__count">全 {stages.length} 問</span>
      </header>

      <ul className="select__grid">
        {stages.map((stage) => {
          const locked = Boolean(stage.locked)
          return (
            <li key={stage.id}>
              <button
                className={`stagecard${locked ? ' stagecard--locked' : ''}`}
                onClick={() => !locked && onPick(stage.id)}
                disabled={locked}
              >
                <div className="stagecard__thumb">
                  <PicrossThumb solution={stage.solution} hidden={locked} size={104} />
                  {locked && <span className="stagecard__lock">🔒</span>}
                </div>
                <div className="stagecard__meta">
                  <span className="stagecard__no">STAGE {stage.id}</span>
                  <span className="stagecard__name">
                    {locked ? '？？？' : stage.name}
                  </span>
                  <span className={`stagecard__diff stagecard__diff--${stage.difficulty}`}>
                    {difficultyLabel[stage.difficulty]}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
