import { useState } from 'react'
import MenuScreen from './screens/MenuScreen.jsx'
import StageSelectScreen from './screens/StageSelectScreen.jsx'
import GameScreen from './screens/GameScreen.jsx'
import { stages } from './data/stages.js'

// 画面遷移はシンプルな state ルーティングで管理する。
//   menu  → はじめる / ステージ選択
//   select → ステージ一覧
//   game  → 選択したステージ（本体は追って実装）
export default function App() {
  const [screen, setScreen] = useState('menu')
  const [stageId, setStageId] = useState(null)

  const startStage = (id) => {
    setStageId(id)
    setScreen('game')
  }

  return (
    <div className="app">
      {screen === 'menu' && (
        <MenuScreen
          onStart={() => startStage(stages[0].id)}
          onSelectStage={() => setScreen('select')}
        />
      )}

      {screen === 'select' && (
        <StageSelectScreen
          onBack={() => setScreen('menu')}
          onPick={startStage}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          stageId={stageId}
          onBack={() => setScreen('select')}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  )
}
