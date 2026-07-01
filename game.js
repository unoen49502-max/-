/* ===== Dot Picross - game logic ===== */
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

  // --- state ---
  const EMPTY = 0, FILLED = 1, MARKED = 2;
  let current = null;      // 現在のパズル
  let rows = 0, cols = 0;
  let state = [];          // プレイヤーの入力 (EMPTY/FILLED/MARKED)
  let mode = "fill";       // "fill" | "mark"
  let timerId = null;
  let seconds = 0;
  let cleared = false;

  // ドラッグ塗り用
  let dragging = false;
  let dragValue = null;    // 適用する値
  let dragTarget = null;   // "fill" or "mark"

  // ===== 保存データ =====
  function loadSolved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveSolved(map) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  }

  // ===== ヒント計算 =====
  function lineClue(arr) {
    const clue = [];
    let run = 0;
    for (const v of arr) {
      if (v === 1) run++;
      else if (run > 0) { clue.push(run); run = 0; }
    }
    if (run > 0) clue.push(run);
    return clue.length ? clue : [0];
  }
  function rowClues(sol) {
    return sol.map(lineClue);
  }
  function colClues(sol) {
    const w = sol[0].length;
    const out = [];
    for (let c = 0; c < w; c++) {
      out.push(lineClue(sol.map(r => r[c])));
    }
    return out;
  }

  // ===== 選択画面 =====
  function renderSelect() {
    const solved = loadSolved();
    puzzleList.innerHTML = "";
    PUZZLES.forEach(p => {
      const card = document.createElement("div");
      card.className = "puzzle-card";
      const size = `${p.solution[0].length}×${p.solution.length}`;
      const isSolved = !!solved[p.id];
      if (isSolved) card.classList.add("solved");
      const stars = "★".repeat(p.difficulty) + "☆".repeat(3 - p.difficulty);
      card.innerHTML =
        `<div class="pc-name">${escapeHtml(p.name)}</div>` +
        `<div class="pc-size">${size}</div>` +
        `<div class="pc-diff diff-${p.difficulty}">${stars}</div>` +
        (isSolved ? `<div class="pc-clear">CLEAR</div>` : "");
      card.addEventListener("click", () => startPuzzle(p));
      puzzleList.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // ===== ゲーム開始 =====
  function startPuzzle(p) {
    current = p;
    rows = p.solution.length;
    cols = p.solution[0].length;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false;
    seconds = 0;
    mode = "fill";
    updateModeButtons();

    puzzleNameEl.textContent = p.name;
    buildBoard();
    selectScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    clearOverlay.classList.add("hidden");

    startTimer();
    updateClueStrike();
  }

  // ===== 盤面生成 =====
  function buildBoard() {
    const rClues = rowClues(current.solution);
    const cClues = colClues(current.solution);

    const maxRowClue = Math.max(...rClues.map(c => c.length));
    const maxColClue = Math.max(...cClues.map(c => c.length));

    // セルサイズ（画面幅に応じて自動調整）
    const cellSize = pickCellSize(cols + maxRowClue);
    const clueColW = Math.max(cellSize, 22);

    board.style.gridTemplateColumns =
      `${maxRowClue * clueColW}px repeat(${cols}, ${cellSize}px)`;
    board.style.gridTemplateRows =
      `${maxColClue * cellSize}px repeat(${rows}, ${cellSize}px)`;
    board.innerHTML = "";

    // 左上コーナー
    const corner = document.createElement("div");
    corner.className = "b-corner";
    board.appendChild(corner);

    // 列ヒント
    cClues.forEach((clue, c) => {
      const el = document.createElement("div");
      el.className = "b-cluecol" + (c % 5 === 0 ? " grp-edge" : "");
      el.dataset.col = c;
      clue.forEach(n => {
        const s = document.createElement("span");
        s.textContent = n;
        el.appendChild(s);
      });
      board.appendChild(el);
    });

    // 各行: 行ヒント + セル
    for (let r = 0; r < rows; r++) {
      const rc = document.createElement("div");
      rc.className = "b-cluerow" + (r % 5 === 0 ? " grp-edge" : "");
      rc.style.gridColumn = "1";
      rc.dataset.row = r;
      rClues[r].forEach(n => {
        const s = document.createElement("span");
        s.textContent = n;
        rc.appendChild(s);
      });
      board.appendChild(rc);

      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        let cls = "cell";
        if (c % 5 === 0) cls += " grp-left";
        if (r % 5 === 0) cls += " grp-top";
        cell.className = cls;
        cell.dataset.r = r;
        cell.dataset.c = c;
        board.appendChild(cell);
      }
    }

    attachBoardEvents();
    renderCells();
  }

  function pickCellSize(totalCols) {
    // ボードが収まるようにセルサイズを決める
    const avail = Math.min(window.innerWidth - 60, 520);
    let size = Math.floor(avail / totalCols);
    return Math.max(16, Math.min(size, 34));
  }

  // ===== セル描画 =====
  function cellEl(r, c) {
    return board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  }
  function renderCell(r, c) {
    const el = cellEl(r, c);
    if (!el) return;
    el.classList.toggle("filled", state[r][c] === FILLED);
    el.classList.toggle("marked", state[r][c] === MARKED);
  }
  function renderCells() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) renderCell(r, c);
  }

  // ===== 入力処理 =====
  function attachBoardEvents() {
    board.addEventListener("contextmenu", e => e.preventDefault());

    board.addEventListener("pointerdown", e => {
      const cell = e.target.closest(".cell");
      if (!cell || cleared) return;
      e.preventDefault();
      const r = +cell.dataset.r, c = +cell.dataset.c;

      // 右クリック or マークモード → マーク切替、左クリック → 現在のモード
      const useMark = (e.button === 2) || (mode === "mark" && e.button === 0);
      dragging = true;
      if (useMark) {
        dragTarget = "mark";
        dragValue = state[r][c] === MARKED ? EMPTY : MARKED;
      } else {
        dragTarget = "fill";
        dragValue = state[r][c] === FILLED ? EMPTY : FILLED;
      }
      applyCell(r, c);
      try { cell.setPointerCapture(e.pointerId); } catch (_) {}
    });

    board.addEventListener("pointermove", e => {
      if (!dragging) return;
      // capture中は elementFromPoint で対象セルを探す
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target && target.closest ? target.closest(".cell") : null;
      if (!cell) return;
      applyCell(+cell.dataset.r, +cell.dataset.c);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      dragValue = null;
      dragTarget = null;
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
      // ドラッグ中は開始時に決めた値で統一（塗り or 消し）
      if (dragValue === FILLED && cur !== FILLED) state[r][c] = FILLED;
      else if (dragValue === EMPTY && cur === FILLED) state[r][c] = EMPTY;
      else return;
    } else { // mark
      if (dragValue === MARKED && cur === EMPTY) state[r][c] = MARKED;
      else if (dragValue === EMPTY && cur === MARKED) state[r][c] = EMPTY;
      else return;
    }
    renderCell(r, c);
    updateClueStrike();
  }

  // ===== ヒントの達成表示 =====
  function updateClueStrike() {
    // 行
    for (let r = 0; r < rows; r++) {
      const playerLine = state[r].map(v => (v === FILLED ? 1 : 0));
      const el = board.querySelector(`.b-cluerow[data-row="${r}"]`);
      if (el) el.classList.toggle("clue-done",
        arraysEqual(lineClue(playerLine), lineClue(current.solution[r])));
    }
    // 列
    for (let c = 0; c < cols; c++) {
      const playerLine = state.map(row => (row[c] === FILLED ? 1 : 0));
      const solCol = current.solution.map(row => row[c]);
      const el = board.querySelector(`.b-cluecol[data-col="${c}"]`);
      if (el) el.classList.toggle("clue-done",
        arraysEqual(lineClue(playerLine), lineClue(solCol)));
    }
  }
  function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  // ===== クリア判定 =====
  function checkClear() {
    if (cleared) return;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shouldFill = current.solution[r][c] === 1;
        const isFilled = state[r][c] === FILLED;
        if (shouldFill !== isFilled) return; // 未完成
      }
    }
    onClear();
  }

  function onClear() {
    cleared = true;
    stopTimer();

    const solved = loadSolved();
    solved[current.id] = { time: seconds };
    saveSolved(solved);

    renderClearArt();
    clearTimeEl.textContent = "TIME " + formatTime(seconds);
    clearOverlay.classList.remove("hidden");
  }

  function renderClearArt() {
    const sol = current.solution;
    clearArt.style.gridTemplateColumns = `repeat(${cols}, 10px)`;
    clearArt.innerHTML = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = document.createElement("div");
        d.className = "ca-cell " + (sol[r][c] === 1 ? "ca-on" : "ca-off");
        clearArt.appendChild(d);
      }
    }
  }

  // ===== タイマー =====
  function startTimer() {
    stopTimer();
    seconds = 0;
    timerEl.textContent = formatTime(0);
    timerId = setInterval(() => {
      seconds++;
      timerEl.textContent = formatTime(seconds);
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
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
    gameScreen.classList.add("hidden");
    selectScreen.classList.remove("hidden");
    renderSelect();
  }

  function resetBoard() {
    if (!current) return;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false;
    renderCells();
    updateClueStrike();
    startTimer();
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
