// ============================================================
// デスクトップマスコット: キャラクターの挙動(AI・物理・入力)
// ============================================================

const char = document.getElementById('character');
const bubble = document.getElementById('bubble');

const CHAR_W = 100;
const CHAR_H = 100;
const WALK_SPEED = 55; // px/s
const DASH_SPEED = 190; // px/s
const GRAVITY = 2400; // px/s^2
const BOUNCE = 0.35; // 着地時の反発係数
const FRICTION = 0.75; // バウンド時の横速度減衰

let winW = window.innerWidth;
let winH = window.innerHeight;

// 位置は「キャラクター左上」基準。ground は接地時の y。
let x = winW / 2 - CHAR_W / 2;
let y = 0;
let vx = 0;
let vy = 0;
let facing = 1; // 1: 右向き, -1: 左向き

let state = 'idle'; // idle | walk | dash | sit | sleep | drag | fall | happy
let stateUntil = 0; // この時刻(ms)まで現在の行動を続ける
let paused = false;

const groundY = () => winH - CHAR_H;

// ------------------------------------------------------------
// 見た目の反映
// ------------------------------------------------------------

function setState(next) {
  if (state === next) return;
  char.classList.remove('state-' + state);
  state = next;
  char.classList.add('state-' + state);
}

function setFacing(dir) {
  if (facing === dir) return;
  facing = dir;
  char.classList.toggle('facing-right', dir === 1);
  char.classList.toggle('facing-left', dir === -1);
}

function render() {
  char.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

// ------------------------------------------------------------
// 吹き出し
// ------------------------------------------------------------

const CHATTER = [
  'こんにちは!',
  'おさんぽ日和〜',
  'おなかすいたなぁ',
  'ここ、ながめがいいね',
  'おしごとがんばって!',
  'ねむくなってきた…',
  'にゃーん',
  '今日もいい日になりそう',
];

const HAPPY_LINES = ['えへへ', 'なでてくれた!', 'にゃ〜ん♪', 'うれしい!'];
const DROP_LINES = ['ひゃー!', 'びっくりした…', 'にゃっ!?'];

let bubbleTimer = null;

function say(text, duration = 2500) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), duration);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.random() * (max - min);

// ------------------------------------------------------------
// 行動AI: 一定時間ごとに次の行動を選ぶ
// ------------------------------------------------------------

function pickNextAction(now) {
  const r = Math.random();
  if (r < 0.4) {
    // 歩く
    setState('walk');
    setFacing(Math.random() < 0.5 ? 1 : -1);
    vx = WALK_SPEED * facing;
    stateUntil = now + rand(3000, 9000);
  } else if (r < 0.5) {
    // 走る
    setState('dash');
    setFacing(Math.random() < 0.5 ? 1 : -1);
    vx = DASH_SPEED * facing;
    stateUntil = now + rand(1200, 3000);
  } else if (r < 0.72) {
    // 立ち止まる
    setState('idle');
    vx = 0;
    stateUntil = now + rand(2000, 5000);
    if (Math.random() < 0.35) say(pick(CHATTER));
  } else if (r < 0.88) {
    // おすわり
    setState('sit');
    vx = 0;
    stateUntil = now + rand(3000, 7000);
  } else {
    // 居眠り
    setState('sleep');
    vx = 0;
    stateUntil = now + rand(6000, 14000);
  }
}

// ------------------------------------------------------------
// メインループ
// ------------------------------------------------------------

let lastTime = performance.now();

function tick(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (state === 'drag') {
    // ドラッグ中は入力ハンドラが位置を更新する
  } else if (state === 'fall') {
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;

    // 左右の壁で跳ね返る
    if (x < 0) {
      x = 0;
      vx = Math.abs(vx) * 0.5;
    } else if (x > winW - CHAR_W) {
      x = winW - CHAR_W;
      vx = -Math.abs(vx) * 0.5;
    }

    // 着地
    if (y >= groundY()) {
      y = groundY();
      if (Math.abs(vy) > 250) {
        vy = -vy * BOUNCE;
        vx *= FRICTION;
      } else {
        vy = 0;
        vx = 0;
        setState('idle');
        stateUntil = now + rand(800, 2000);
        if (Math.random() < 0.6) say(pick(DROP_LINES), 1800);
      }
    }
  } else if (paused) {
    if (state !== 'sit') {
      setState('sit');
      vx = 0;
    }
  } else {
    // 地上での行動
    if (state === 'walk' || state === 'dash') {
      x += vx * dt;
      // 端まで来たら折り返す
      if (x <= 0) {
        x = 0;
        setFacing(1);
        vx = Math.abs(vx);
      } else if (x >= winW - CHAR_W) {
        x = winW - CHAR_W;
        setFacing(-1);
        vx = -Math.abs(vx);
      }
    }
    if (now >= stateUntil && state !== 'happy') {
      pickNextAction(now);
    }
    if (state === 'happy' && now >= stateUntil) {
      setState('idle');
      stateUntil = now + rand(500, 1500);
    }
  }

  render();
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------
// まばたき
// ------------------------------------------------------------

(function blinkLoop() {
  setTimeout(() => {
    if (state !== 'sleep' && state !== 'happy') {
      char.classList.add('blink');
      setTimeout(() => char.classList.remove('blink'), 140);
    }
    blinkLoop();
  }, rand(2500, 6000));
})();

// ------------------------------------------------------------
// マウス入力: ホバーで操作可能化、ドラッグで持ち運び、クリックでなでる
// ------------------------------------------------------------

let dragging = false;
let dragMoved = false;
let dragOffX = 0;
let dragOffY = 0;
// 投げの速度推定用に直近のポインタ位置を記録する
let samples = [];

char.addEventListener('pointerenter', () => {
  window.mascot.setInteractive(true);
});

char.addEventListener('pointerleave', () => {
  if (!dragging) window.mascot.setInteractive(false);
});

char.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  dragMoved = false;
  dragOffX = e.clientX - x;
  dragOffY = e.clientY - y;
  samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  char.setPointerCapture(e.pointerId);
});

char.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (!dragMoved) {
    const dx = e.clientX - (dragOffX + x);
    const dy = e.clientY - (dragOffY + y);
    if (Math.hypot(dx, dy) > 6) {
      dragMoved = true;
      setState('drag');
      clearTimeout(bubbleTimer);
      bubble.classList.remove('show');
    }
  }
  if (dragMoved) {
    x = Math.min(Math.max(e.clientX - dragOffX, 0), winW - CHAR_W);
    y = Math.min(Math.max(e.clientY - dragOffY, 0), winH - CHAR_H);
    const now = performance.now();
    samples.push({ x: e.clientX, y: e.clientY, t: now });
    while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
  }
});

char.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  char.releasePointerCapture(e.pointerId);

  if (dragMoved) {
    // 直近の動きから投げ速度を計算して落下開始
    const last = samples[samples.length - 1];
    const first = samples[0];
    const dtms = Math.max(last.t - first.t, 16);
    vx = ((last.x - first.x) / dtms) * 1000;
    vy = ((last.y - first.y) / dtms) * 1000;
    setFacing(vx >= 0 ? 1 : -1);
    setState('fall');
  } else {
    // その場クリック = なでる
    setState('happy');
    stateUntil = performance.now() + 1000;
    say(pick(HAPPY_LINES), 1800);
  }

  // ポインタがキャラクターの外にあればクリック透過に戻す
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || !el.closest('#character')) {
    window.mascot.setInteractive(false);
  }
});

char.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.mascot.showContextMenu();
});

// ------------------------------------------------------------
// メインプロセスからのコマンド(トレイ・右クリックメニュー)
// ------------------------------------------------------------

window.mascot.onCommand((cmd) => {
  if (cmd === 'center') {
    x = winW / 2 - CHAR_W / 2;
    y = Math.max(groundY() - 200, 0);
    vx = 0;
    vy = 0;
    setState('fall');
  } else if (cmd === 'toggle-pause') {
    paused = !paused;
    window.mascot.reportPaused(paused);
    if (paused) {
      say('ここで待ってるね', 2000);
    } else {
      setState('idle');
      stateUntil = 0;
    }
  }
});

// ------------------------------------------------------------
// リサイズ対応(解像度・タスクバー位置の変化)
// ------------------------------------------------------------

window.addEventListener('resize', () => {
  winW = window.innerWidth;
  winH = window.innerHeight;
  x = Math.min(Math.max(x, 0), winW - CHAR_W);
  if (state !== 'drag' && state !== 'fall') y = groundY();
});

// ------------------------------------------------------------
// 起動
// ------------------------------------------------------------

y = groundY();
render();
say('こんにちは!', 2500);
stateUntil = performance.now() + 1500;
requestAnimationFrame(tick);
