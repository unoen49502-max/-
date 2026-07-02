/* ===== メイのドット工房 — game logic ===== */
(function () {
  "use strict";

  const PUZZLES = window.PUZZLES || [];
  const STORAGE_KEY = "dot-picross-solved";

  // --- DOM ---
  const selectScreen = document.getElementById("select-screen");
  const gameScreen = document.getElementById("game-screen");
  const puzzleList = document.getElementById("puzzle-list");
  const board = document.getElementById("board");
  const puzzleNameEl = document.getElementById("puzzle-name");
  const timerEl = document.getElementById("timer");
  const backBtn = document.getElementById("back-btn");
  const resetBtn = document.getElementById("reset-btn");
  const modeFillBtn = document.getElementById("mode-fill");
  const modeMarkBtn = document.getElementById("mode-mark");
  const clearOverlay = document.getElementById("clear-overlay");
  const clearArt = document.getElementById("clear-art");
  const clearTimeEl = document.getElementById("clear-time");
  const clearNextBtn = document.getElementById("clear-next");
  const progressBar = document.getElementById("progress-bar");
  const progressPct = document.getElementById("progress-pct");
  const starCountEl = document.getElementById("star-count");
  const confettiEl = document.getElementById("confetti");

  // ===== キャラの表情・セリフ（配信リアクション） =====
  const FACE_CLASSES = ["face-neutral", "face-cry", "face-angry", "face-shock", "face-shy", "face-happy"];
  const SPEECH = {
    start: "いっしょに かこうね♦",
    line:  "その ちょうし♦",
    p25:   "いいかんじ！♦",
    p50:   "はんぶん こえたよ♦",
    p75:   "もうすこし…！",
    idle:  "…みてる？♦",
    reset: "もういちど かこ♦",
    clear: "かんせい！ かべに かざろ♦",
  };
  let faceResetId = null;
  function setFace(name) {
    document.querySelectorAll(".js-face").forEach(el => {
      el.classList.remove(...FACE_CLASSES);
      el.classList.add("face-" + name);
    });
  }
  function flashFace(name, ms) {
    setFace(name);
    if (faceResetId) clearTimeout(faceResetId);
    faceResetId = setTimeout(() => setFace("neutral"), ms || 900);
  }
  function setSpeech(text) {
    document.querySelectorAll(".js-speech").forEach(el => { el.textContent = text; });
  }

  // 待機リアクション（15秒）
  let idleId = null;
  function resetIdle() {
    if (idleId) clearTimeout(idleId);
    if (cleared || !current) return;
    idleId = setTimeout(() => {
      if (!cleared) { flashFace("shock", 1200); setSpeech(SPEECH.idle); }
    }, 15000);
  }

  // --- state ---
  const EMPTY = 0, FILLED = 1, MARKED = 2;
  let current = null;
  let rows = 0, cols = 0;
  let state = [];
  let mode = "fill";
  let timerId = null;
  let seconds = 0;
  let cleared = false;
  let doneLines = 0;
  let milestones = {};   // 進捗セリフの発火済みフラグ

  // ドラッグ／長押し
  let dragging = false, dragValue = null, dragTarget = null;
  let lpTimer = null, lpCell = null, lpStart = null;

  // ===== 保存データ =====
  function loadSolved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSolved(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function updateStarCount() {
    if (!starCountEl) return;
    const n = Object.keys(loadSolved()).length;
    starCountEl.textContent = "✦" + n + "まい";
  }

  // ===== ヒント計算 =====
  function lineClue(arr) {
    const clue = []; let run = 0;
    for (const v of arr) {
      if (v === 1) run++;
      else if (run > 0) { clue.push(run); run = 0; }
    }
    if (run > 0) clue.push(run);
    return clue.length ? clue : [0];
  }
  function rowClues(sol) { return sol.map(lineClue); }
  function colClues(sol) {
    const w = sol[0].length, out = [];
    for (let c = 0; c < w; c++) out.push(lineClue(sol.map(r => r[c])));
    return out;
  }
  function arraysEqual(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ===== 選択画面（工房の壁） =====
  function renderSelect() {
    const solved = loadSolved();
    puzzleList.innerHTML = "";
    PUZZLES.forEach(p => {
      const card = document.createElement("div");
      card.className = "puzzle-card";
      const size = `${p.solution[0].length}×${p.solution.length}`;
      const rec = solved[p.id];
      if (rec) card.classList.add("solved");

      // サムネ（クリア＝完成絵／未クリア＝？）
      const thumb = document.createElement("div");
      thumb.className = "pc-thumb";
      if (rec) {
        thumb.style.gridTemplateColumns = `repeat(${p.solution[0].length}, 1fr)`;
        p.solution.forEach(row => row.forEach(v => {
          const d = document.createElement("span");
          d.className = "t-cell " + (v ? "t-on" : "t-off");
          thumb.appendChild(d);
        }));
      } else {
        thumb.classList.add("pc-thumb-q");
        thumb.textContent = "？";
      }

      const pencils = [1, 2, 3].map(i =>
        `<span class="${i <= p.difficulty ? "on" : ""}">✎</span>`).join("");

      const meta = document.createElement("div");
      meta.innerHTML =
        `<div class="pc-name">${escapeHtml(p.name)}</div>` +
        `<span class="pc-size">${size}</span>` +
        `<div class="pc-diff">${pencils}</div>` +
        (rec ? `<div class="pc-clear">${formatTime(rec.time)}</div>` : "");

      card.appendChild(thumb);
      card.appendChild(meta);
      card.addEventListener("click", () => startPuzzle(p));
      puzzleList.appendChild(card);
    });
    updateStarCount();
  }

  // ===== ゲーム開始 =====
  function startPuzzle(p) {
    current = p;
    rows = p.solution.length;
    cols = p.solution[0].length;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false; seconds = 0; mode = "fill"; doneLines = 0; milestones = {};
    updateModeButtons();

    puzzleNameEl.textContent = p.name;
    buildBoard();
    selectScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    clearOverlay.classList.add("hidden");

    startTimer();
    updateClueStrike();
    updateProgress();
    setFace("neutral");
    setSpeech(SPEECH.start);
    resetIdle();
  }

  // ===== 盤面生成 =====
  function buildBoard() {
    const rClues = rowClues(current.solution);
    const cClues = colClues(current.solution);
    const maxRowClue = Math.max(...rClues.map(c => c.length));
    const maxColClue = Math.max(...cClues.map(c => c.length));

    const cellSize = pickCellSize(cols + maxRowClue);
    const clueColW = Math.max(cellSize, 22);

    board.style.gridTemplateColumns = `${maxRowClue * clueColW}px repeat(${cols}, ${cellSize}px)`;
    board.style.gridTemplateRows = `${maxColClue * cellSize}px repeat(${rows}, ${cellSize}px)`;
    board.innerHTML = "";

    const corner = document.createElement("div");
    corner.className = "b-corner";
    board.appendChild(corner);

    cClues.forEach((clue, c) => {
      const el = document.createElement("div");
      el.className = "b-cluecol" + (c % 5 === 0 ? " grp-edge" : "");
      el.dataset.col = c;
      clue.forEach(n => { const s = document.createElement("span"); s.textContent = n; el.appendChild(s); });
      board.appendChild(el);
    });

    for (let r = 0; r < rows; r++) {
      const rc = document.createElement("div");
      rc.className = "b-cluerow" + (r % 5 === 0 ? " grp-edge" : "");
      rc.style.gridColumn = "1";
      rc.dataset.row = r;
      rClues[r].forEach(n => { const s = document.createElement("span"); s.textContent = n; rc.appendChild(s); });
      board.appendChild(rc);

      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        let cls = "cell";
        if (c % 5 === 0) cls += " grp-left";
        if (r % 5 === 0) cls += " grp-top";
        cell.className = cls;
        cell.dataset.r = r; cell.dataset.c = c;
        board.appendChild(cell);
      }
    }

    attachBoardEvents();
    renderCells();
  }

  function pickCellSize(totalCols) {
    const avail = Math.min(window.innerWidth - 96, 460);
    const size = Math.floor(avail / totalCols);
    return Math.max(16, Math.min(size, 34));
  }

  // ===== セル描画 =====
  function cellEl(r, c) { return board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`); }
  function renderCell(r, c, pop) {
    const el = cellEl(r, c);
    if (!el) return;
    const wasFilled = el.classList.contains("filled");
    el.classList.toggle("filled", state[r][c] === FILLED);
    el.classList.toggle("marked", state[r][c] === MARKED);
    if (pop && state[r][c] === FILLED && !wasFilled) {
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    }
    if (pop && state[r][c] === MARKED) {
      el.classList.remove("mark-pop"); void el.offsetWidth; el.classList.add("mark-pop");
    }
  }
  function renderCells() {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) renderCell(r, c);
  }

  // ===== クロスハイライト =====
  function clearHighlight() {
    board.querySelectorAll(".hl").forEach(el => el.classList.remove("hl"));
  }
  function highlight(r, c) {
    clearHighlight();
    for (let cc = 0; cc < cols; cc++) { const e = cellEl(r, cc); if (e) e.classList.add("hl"); }
    for (let rr = 0; rr < rows; rr++) { const e = cellEl(rr, c); if (e) e.classList.add("hl"); }
    const rh = board.querySelector(`.b-cluerow[data-row="${r}"]`); if (rh) rh.classList.add("hl");
    const ch = board.querySelector(`.b-cluecol[data-col="${c}"]`); if (ch) ch.classList.add("hl");
  }

  // ===== 入力処理 =====
  function startAction(target, r, c) {
    dragging = true; dragTarget = target;
    const cur = state[r][c];
    if (target === "mark") dragValue = cur === MARKED ? EMPTY : MARKED;
    else dragValue = cur === FILLED ? EMPTY : FILLED;
    applyCell(r, c);
  }

  function attachBoardEvents() {
    board.addEventListener("contextmenu", e => e.preventDefault());

    board.addEventListener("pointerdown", e => {
      const cell = e.target.closest(".cell");
      if (!cell || cleared) return;
      e.preventDefault();
      const r = +cell.dataset.r, c = +cell.dataset.c;
      resetIdle();
      try { cell.setPointerCapture(e.pointerId); } catch (_) {}

      const useMark = (e.button === 2) || (mode === "mark" && e.button === 0);
      const isTouch = e.pointerType === "touch";

      if (isTouch && !useMark) {
        // タップ=ぬる / 長押し=✕ を区別するため保留
        lpCell = { r, c }; lpStart = { x: e.clientX, y: e.clientY };
        lpTimer = setTimeout(() => {
          lpTimer = null;
          startAction("mark", r, c);
        }, 450);
        return;
      }
      startAction(useMark ? "mark" : "fill", r, c);
    });

    board.addEventListener("pointermove", e => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target && target.closest ? target.closest(".cell") : null;

      // 長押し保留中に動いたら → ぬるドラッグ開始
      if (lpTimer && lpStart) {
        const moved = Math.abs(e.clientX - lpStart.x) + Math.abs(e.clientY - lpStart.y) > 8;
        if (moved) { clearTimeout(lpTimer); lpTimer = null; startAction("fill", lpCell.r, lpCell.c); }
      }
      if (cell && !dragging && !lpTimer) highlight(+cell.dataset.r, +cell.dataset.c);
      if (!dragging) return;
      if (!cell) return;
      applyCell(+cell.dataset.r, +cell.dataset.c);
    });

    board.addEventListener("mouseover", e => {
      if (dragging) return;
      const cell = e.target.closest && e.target.closest(".cell");
      if (cell) highlight(+cell.dataset.r, +cell.dataset.c);
    });
    board.addEventListener("mouseleave", () => { if (!dragging) clearHighlight(); });

    const endDrag = () => {
      if (lpTimer) { // タップ（短押し）→ ぬる
        clearTimeout(lpTimer); lpTimer = null;
        if (lpCell) startAction("fill", lpCell.r, lpCell.c);
      }
      if (!dragging) return;
      dragging = false; dragValue = null; dragTarget = null;
      checkClear();
    };
    board.addEventListener("pointerup", endDrag);
    board.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerup", endDrag);
  }

  function applyCell(r, c) {
    if (cleared) return;
    const cur = state[r][c];
    if (dragTarget === "fill") {
      if (dragValue === FILLED && cur !== FILLED) state[r][c] = FILLED;
      else if (dragValue === EMPTY && cur === FILLED) state[r][c] = EMPTY;
      else return;
    } else {
      if (dragValue === MARKED && cur === EMPTY) state[r][c] = MARKED;
      else if (dragValue === EMPTY && cur === MARKED) state[r][c] = EMPTY;
      else return;
    }
    renderCell(r, c, true);
    updateClueStrike();
    updateProgress();
    resetIdle();
  }

  // ===== ヒント達成表示 ＋ ライン完成リアクション =====
  function updateClueStrike() {
    let done = 0;
    for (let r = 0; r < rows; r++) {
      const pl = state[r].map(v => (v === FILLED ? 1 : 0));
      const ok = arraysEqual(lineClue(pl), lineClue(current.solution[r]));
      if (ok) done++;
      const el = board.querySelector(`.b-cluerow[data-row="${r}"]`);
      if (el) el.classList.toggle("clue-done", ok);
    }
    for (let c = 0; c < cols; c++) {
      const pl = state.map(row => (row[c] === FILLED ? 1 : 0));
      const solCol = current.solution.map(row => row[c]);
      const ok = arraysEqual(lineClue(pl), lineClue(solCol));
      if (ok) done++;
      const el = board.querySelector(`.b-cluecol[data-col="${c}"]`);
      if (el) el.classList.toggle("clue-done", ok);
    }
    if (!cleared && done > doneLines) { flashFace("shy", 700); setSpeech(SPEECH.line); }
    doneLines = done;
  }

  // ===== 進捗 =====
  function updateProgress() {
    const sol = current.solution;
    let need = 0, got = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (sol[r][c] === 1) { need++; if (state[r][c] === FILLED) got++; }
    }
    const pct = need ? Math.round((got / need) * 100) : 0;
    if (progressBar) progressBar.style.width = pct + "%";
    if (progressPct) progressPct.textContent = pct + "%";
    // マイルストーンのセリフ
    if (!cleared) {
      if (pct >= 25 && !milestones.p25) { milestones.p25 = 1; setSpeech(SPEECH.p25); }
      if (pct >= 50 && !milestones.p50) { milestones.p50 = 1; flashFace("happy", 700); setSpeech(SPEECH.p50); }
      if (pct >= 75 && !milestones.p75) { milestones.p75 = 1; setSpeech(SPEECH.p75); }
    }
  }

  // ===== クリア判定 =====
  function checkClear() {
    if (cleared) return;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const shouldFill = current.solution[r][c] === 1;
      if (shouldFill !== (state[r][c] === FILLED)) return;
    }
    onClear();
  }

  function onClear() {
    cleared = true;
    stopTimer();
    if (idleId) clearTimeout(idleId);
    clearHighlight();

    const solved = loadSolved();
    const prev = solved[current.id];
    if (!prev || seconds < prev.time) solved[current.id] = { time: seconds };
    saveSolved(solved);

    setFace("happy");
    setSpeech(SPEECH.clear);
    playClearSequence();
  }

  // ✕・ヒントをフェード → 1マスずつ着色 → 額縁演出
  function playClearSequence() {
    board.classList.add("clearing"); // ✕・ヒントを隠す
    const filled = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      if (current.solution[r][c] === 1) filled.push([r, c]);

    const step = filled.length > 60 ? 12 : 24;
    filled.forEach(([r, c], i) => {
      setTimeout(() => {
        const el = cellEl(r, c);
        if (el) { el.classList.remove("pop", "reveal"); void el.offsetWidth; el.classList.add("reveal"); }
      }, i * step);
    });

    const total = filled.length * step + 260;
    setTimeout(showClear, total);
  }

  function showClear() {
    renderClearArt();
    clearTimeEl.textContent = "TIME " + formatTime(seconds);
    clearOverlay.classList.remove("hidden");
    spawnConfetti();
    updateStarCount();
  }

  function renderClearArt() {
    const sol = current.solution;
    clearArt.style.gridTemplateColumns = `repeat(${cols}, 11px)`;
    clearArt.innerHTML = "";
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const d = document.createElement("div");
      d.className = "ca-cell " + (sol[r][c] === 1 ? "ca-on" : "ca-off");
      clearArt.appendChild(d);
    }
  }

  // 紙吹雪（8×8矩形・重力落下のみ）
  function spawnConfetti() {
    if (!confettiEl) return;
    confettiEl.innerHTML = "";
    const colors = ["var(--crim)", "var(--gold)", "var(--pink)"];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("i");
      p.style.left = Math.floor(Math.random() * 100) + "%";
      p.style.background = colors[i % 3];
      const dur = 900 + Math.floor(Math.random() * 900);
      const delay = Math.floor(Math.random() * 500);
      p.style.animation = `fall ${dur}ms steps(18) ${delay}ms 1 forwards`;
      confettiEl.appendChild(p);
    }
  }

  // ===== タイマー =====
  function startTimer() {
    stopTimer(); seconds = 0; timerEl.textContent = formatTime(0);
    timerId = setInterval(() => { seconds++; timerEl.textContent = formatTime(seconds); }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function formatTime(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }

  // ===== モード切替 =====
  function setMode(m) { mode = m; updateModeButtons(); }
  function updateModeButtons() {
    modeFillBtn.classList.toggle("active", mode === "fill");
    modeMarkBtn.classList.toggle("active", mode === "mark");
  }

  // ===== 画面遷移 =====
  function backToSelect() {
    stopTimer();
    if (idleId) clearTimeout(idleId);
    clearOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    selectScreen.classList.remove("hidden");
    renderSelect();
    setFace("neutral");
    setSpeech(SPEECH.start);
  }

  function resetBoard() {
    if (!current) return;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false; doneLines = 0; milestones = {};
    board.classList.remove("clearing");
    renderCells();
    updateClueStrike();
    updateProgress();
    startTimer();
    flashFace("angry", 800);
    setSpeech(SPEECH.reset);
    resetIdle();
  }

  // ===== イベント登録 =====
  backBtn.addEventListener("click", backToSelect);
  resetBtn.addEventListener("click", resetBoard);
  modeFillBtn.addEventListener("click", () => setMode("fill"));
  modeMarkBtn.addEventListener("click", () => setMode("mark"));
  clearNextBtn.addEventListener("click", backToSelect);

  // ===== 起動 =====
  renderSelect();
})();
