/* ===== メイのドット工房 — game logic ===== */
(function () {
  "use strict";

  const PUZZLES = window.PUZZLES || [];
  const STORAGE_KEY = "dot-picross-solved";
  const DIFF_LABEL = { 1: "やさしい", 2: "ふつう", 3: "むずかしい", 4: "げきむず" };

  // --- DOM ---
  const selectScreen = document.getElementById("select-screen");
  const gameScreen = document.getElementById("game-screen");
  const galleryScreen = document.getElementById("gallery-screen");
  const galleryList = document.getElementById("gallery-list");
  const galleryTalkBtns = document.getElementById("gallery-talk-btns");
  const galleryTalkList = document.getElementById("gallery-talk-list");
  const glMenuBtn = document.getElementById("gl-menu-btn");
  const puzzleList = document.getElementById("puzzle-list");
  const board = document.getElementById("board");
  const puzzleNameEl = document.getElementById("puzzle-name");
  const timerEl = document.getElementById("timer");
  const backBtn = document.getElementById("back-btn");
  const resetBtn = document.getElementById("btn-reset");
  const pauseBtn = document.getElementById("btn-pause");
  const undoBtn = document.getElementById("btn-undo");
  const modeFillBtn = document.getElementById("mode-fill");
  const modeMarkBtn = document.getElementById("mode-mark");
  const clearOverlay = document.getElementById("clear-overlay");
  const clearNextBtn = document.getElementById("clear-next-btn");
  const progressBar = document.getElementById("progress-bar");
  const progressPct = document.getElementById("progress-pct");
  const starCountEl = document.getElementById("star-count");
  const menuOverlay = document.getElementById("menu-overlay");
  const menuTitleBtn = document.getElementById("menu-title-btn");
  const menuCloseBtn = document.getElementById("menu-close");
  const ssMenuBtn = document.getElementById("ss-menu-btn");
  const ghMenuBtn = document.getElementById("gh-menu-btn");
  const talkEvent = document.getElementById("talk-event");
  const talkMei = document.querySelector(".js-talk-mei");
  const talkTextEl = document.querySelector(".js-talk-text");
  const talkProgEl = document.querySelector(".js-talk-prog");
  const menuSoundBtn = document.getElementById("menu-sound");
  const hintBtn = document.getElementById("btn-hint");
  const hintBadge = document.getElementById("hint-badge");
  const rouletteOverlay = document.getElementById("roulette-overlay");
  const rlReel = document.querySelector(".js-rl-reel");
  const rlResult = document.querySelector(".js-rl-result");
  const rlRemain = document.querySelector(".js-rl-remain");

  // ===== サウンド（SFX）：null安全ヘルパ＋初回操作でアンロック =====
  const sfx = (n, ...a) => { try { if (window.SFX && window.SFX[n]) window.SFX[n](...a); } catch (e) {} };
  const playBgm = (name) => sfx("bgm", name);   // 画面ごとのBGM切替（クロスフェード）
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, () => sfx("unlock"), { capture: true }));
  let lastPaintT = 0;
  function playPaintSfx(next) {
    const now = (window.performance && performance.now) ? performance.now() : 0;
    if (now - lastPaintT < 30) return;   // ドラッグ塗り中の鳴らしすぎを抑制
    lastPaintT = now;
    if (next === FILLED) sfx("fill");
    else if (next === MARKED) sfx("mark");
    else sfx("erase");
  }

  // ===== キャラの表情・セリフ（配信リアクション） =====
  const FACE_CLASSES = ["face-neutral", "face-cry", "face-angry", "face-shock", "face-shy", "face-happy"];
  const SPEECH = {
    select: "すきな えを えらんでね♦",
    start: "いっしょに かこうね♦",
    line:  "その ちょうし♦",
    p25:   "いいかんじ！♦",
    p50:   "はんぶん こえたよ♦",
    p75:   "もうすこし…！",
    idle:  "…みてる？♦",
    reset: "もういちど かこ♦",
    clear: "かんせい！ かべに かざろ♦",
  };

  // クリア時のモチーフ別うんちく（感心＋ちょっと上から目線。<span class="em">…</span>でピンク強調）
  // パズル追加時は id を足すだけ。無ければ _default。
  const MEI_TRIVIA = {
    heart: 'ハートマーク、じつは しんぞうじゃなくて むかしの <span class="em">しょくぶつの タネ</span>が モチーフって せつが あるんだよ◆',
    face:  'えがおって、<span class="em">むりやり つくる</span>だけでも のうが だまされて たのしくなるんだよ。メイさんは しってたけどね◆',
    cat:   'ねこの ヒゲは かざりじゃなくて、<span class="em">すきまの はば</span>を はかる センサーなんだよね◆',
    mush:  'キノコは しょくぶつじゃなくて、じつは <span class="em">どうぶつに ちかい</span>なかまなんだよ。しってた？◆',
    ship:  'うちゅうは <span class="em">おとが しない</span>せかいなんだよ。くうきが ないと おとは つたわらないからね◆',
    key:   'むかしの かぎは <span class="em">木で できてた</span>んだよ。エジプトの ころには もう あったらしいよ◆',
    star:  'ほしは よるだけじゃなく <span class="em">ひるまも そらに ある</span>んだよ。たいようが まぶしくて 見えないだけ◆',
    apple: 'りんごが みずに うくのは、なかみの <span class="em">やく2わりが くうき</span>だからなんだって◆',
    house: 'いえの まどは、むかしは ガラスじゃなく <span class="em">かみや かい</span>を はってたんだよ◆',
    tree:  'おおきな 木は、じめんの したに <span class="em">えだと おなじくらい</span>ねを ひろげてるんだよ◆',
    ghost: 'おばけを こわいと かんじるのは、<span class="em">みを まもる</span>ための のうの はんのうなんだって◆',
    drop:  'しずくが まるいのは、<span class="em">ひょうめんちょうりょく</span>で ぎゅっと まとまろうとするからだよ◆',
    flower:'はなが いいにおいなのは、<span class="em">むしを よぶ</span>ためなんだよ。じぶんの ためじゃないの◆',
    rabbit:'うさぎの まえばは <span class="em">一生 のびつづける</span>んだよ。だから いつも なにか かじってるの◆',
    cake:  'ケーキの ろうそくを ふきけす ならわしには、<span class="em">けむりで ねがいを とどける</span>いみが あったんだって◆',
    crown: 'おうかんの とがった かざりは、たいようの <span class="em">ひかりを あらわしてる</span>って せつが あるよ◆',
    penguin:'ペンギンの せなかが くろいのは、うみで <span class="em">うえから 見えにくく</span>する ためなんだよ◆',
    robot: 'ロボットって ことばは、チェコごの <span class="em">「はたらく」</span>から できたんだよ。しってた？◆',
    car:   'いちばん はじめの くるまは、ガソリンじゃなくて <span class="em">じょうき</span>で うごいてたんだよ◆',
    crab:  'かにが よこに あるくのは、あしの <span class="em">かんせつが よこにしか</span>まがらないからなんだよね◆',
    diamond:'ダイヤモンドは <span class="em">せかいで いちばん かたい</span>ほうせきなんだよ。でも たたくと われちゃうの◆',
    moon:  'つきは まいとし <span class="em">やく3センチ</span>ずつ ちきゅうから とおざかってるんだよ◆',
    bell:  'かねの おとが とおくまで ひびくのは、<span class="em">くうきを ふるわせて</span>いるからなんだよ◆',
    balloon:'ふうせんが うくのは、なかの ガスが <span class="em">くうきより かるい</span>からなんだよね◆',
    ribbon:'ちょうむすびは じつは <span class="em">ほどけにくい むすびかた</span>なんだよ。しってた？◆',
    bird:  'とりの ほねは <span class="em">なかが からっぽ</span>で かるいんだよ。だから そらを とべるの◆',
    dog:   'いぬは においを <span class="em">にんげんの1おくばい</span>かんじられるんだって。すごいよね◆',
    bear:  'くまは ふゆのあいだ <span class="em">なにも たべずに</span>ねむりつづけるんだよ◆',
    strawberry:'いちごの つぶつぶ、あれが ほんとうの <span class="em">「み」</span>なんだよ。あかいとこは ちがうの◆',
    frog:  'かえるは <span class="em">めを ひっこめて</span>えものを のみこむんだよ。しってた？◆',
    present:'プレゼントを あける ときの ドキドキ、あれも <span class="em">のうの ごほうび</span>なんだよ◆',
    umbrella:'かさの ほねが 8ほんなのは、<span class="em">まるく ちからを ささえる</span>のに ちょうどいいからなんだって◆',
    whale: 'くじらは せかいで <span class="em">いちばん おおきい どうぶつ</span>なんだよ。しんぞうも くるまくらい あるの◆',
    octopus:'たこの こころぞうは <span class="em">3つ</span>も あるんだよ。しってた？◆',
    owl:   'ふくろうは くびを <span class="em">270ど</span>も まわせるんだよ。うしろが まる見えだね◆',
    turtle:'かめは <span class="em">100ねん いじょう</span>いきることも あるんだよ。メイさんより ながいね◆',
    airplane:'ひこうきが とべるのは、はねの うえと したで <span class="em">くうきの はやさ</span>が ちがうからなんだよ◆',
    snowman:'ゆきが しろく みえるのは、<span class="em">ひかりを ぜんぶ はねかえす</span>からなんだよ◆',
    castle:'おしろの まわりの ほりは、てきを ふせぐ ためだけじゃなく <span class="em">にもつを はこぶ みち</span>でも あったんだよ◆',
    sword: 'むかしの けんは、<span class="em">やわらかい てつと かたい てつ</span>を かさねて おれにくく つくったんだよ◆',
    clock: 'とけいの はりが <span class="em">みぎまわり</span>なのは、むかしの ひどけいの かげの うごきに あわせたからなんだよ◆',
    butterfly:'ちょうちょは <span class="em">あしで あじを かんじる</span>んだよ。とまった しゅんかんに わかるの◆',
    xmastree:'ツリーに もみの木を つかうのは、ふゆでも <span class="em">みどりの まま</span>で いのちの しるしだからなんだって◆',
    rocket:'ロケットの おもさの ほとんどは <span class="em">ねんりょう</span>なんだよ。とぶだけで たいへんなの◆',
    fox:   'きつねは ゆきの したの えものの おとを <span class="em">じばんの ちから</span>も つかって さがすって いわれてるんだよ◆',
    guitar:'ギターの おとが おおきく ひびくのは、<span class="em">なかの くうどう</span>で おとが きょうめいするからなんだよ◆',
    dino:  'いちばん おおきな きょうりゅうは <span class="em">バスより ながい</span>くびを もってたんだって◆',
    giraffe:'きりんの くびの ほねは、じつは <span class="em">にんげんと おなじ7こ</span>なんだよ。しってた？◆',
    fish:  'こいは <span class="em">たきを のぼると りゅうに なる</span>って いいつたえが あるんだよ。がんばりやさんだね◆',
    boat:  'ヨットは かぜに むかっても <span class="em">ジグザグに すすめば</span>まえに いけるんだよ◆',
    _default: 'こんなのも といちゃうなんて、メイさん ちょっと かんどうしちゃった◆',
  };

  // 5問節目の会話イベント。キー=到達問数の節目。値=コマ配列（2〜4コマ・表情差分つき）
  const TALK_EVENTS = {
    5: [
      { expr: "surprise", text: "まさか ここまで といちゃうなんて<br>おもわなかったんだよね！" },
      { expr: "normal",   text: "メイさんは ぜんぶ といたのかって？" },
      { expr: "shy",      text: "…と、とうぜん なんだよね！◆" },
    ],
    10: [
      { expr: "normal", text: "１０もん とうたつ かぁ…<br>やるじゃん。" },
      { expr: "pout",   text: "まあ メイさんの ファンなら<br>これくらい できて とうぜんだけど？" },
      { expr: "shy",    text: "せいぜい がんばると いいんだよね！" },
    ],
    15: [
      { expr: "surprise", text: "１５もん！？<br>ちょっと ペース はやくない！？" },
      { expr: "pout",     text: "まさか メイさんの きろく<br>ぬくきじゃ ないよね…？" },
      { expr: "normal",   text: "ま、でも メイさんの ほうが<br>うえだけどね！" },
      { expr: "shy",      text: "わからなく なったら たよって<br>くれても いいんだよね！" },
    ],
    20: [
      { expr: "normal", text: "ここまで くると…<br>もう ほんものだね。" },
      { expr: "down",   text: "…くやしいけど、メイさんより<br>センス あるかも。" },
      { expr: "shy",    text: "というとでも おもった？ まだ まけてないんだよね！" },
    ],
    25: [
      { expr: "surprise", text: "え、まだ といてるの！？" },
      { expr: "normal",   text: "メイさんも おうえん してあげるんだよね！" },
      { expr: "shy",      text: "まだまだ がんばろう！" },
    ],
    30: [
      { expr: "surprise", text: "３０もんめ！？<br>メイさんの コレクション、<br>ぜんぶ ぬられちゃうよ…" },
      { expr: "pout",     text: "ちょっとは てかげん しなさいよね！<br>…なんて、うそ うそ◆" },
      { expr: "shy",      text: "きみと かいてる じかん、<br>けっこう すきなんだよね◆" },
    ],
    35: [
      { expr: "normal", text: "３５もん。 ここまで くると<br>もう せんせい みたいだね。" },
      { expr: "shy",    text: "メイさん、おしえることが<br>なくなっちゃうかも…" },
      { expr: "pout",   text: "でも まだ まけないんだからね！" },
    ],
    40: [
      { expr: "normal", text: "４０もんめ、おめでとう。" },
      { expr: "down",   text: "…じつは ひとりで はいしんするの、<br>ちょっと さみしかったんだ。" },
      { expr: "shy",    text: "きみが きてくれて…<br>ほんとに うれしいんだよね◆" },
    ],
    45: [
      { expr: "surprise", text: "え、４５もん！？<br>ほんとに ぜんぶ とく きなの…？" },
      { expr: "normal",   text: "きみの えを ならべると、<br>すごい ギャラリーに なるね。" },
      { expr: "shy",      text: "メイさんの じまんの こうぼうだよ◆" },
    ],
    50: [
      { expr: "surprise", text: "５０もん…！<br>ぜんぶ、ぜんぶ かんせい<br>させちゃったの！？" },
      { expr: "cry",      text: "…メイさん、こんなに たのしいの<br>ひさしぶりで…なみだ でちゃう◆" },
      { expr: "normal",   text: "きみは メイさんの じまんの<br>いちばんでしで、あいぼうだよ。" },
      { expr: "shy",      text: "これからも…ずっと<br>いっしょに かこうね◆" },
    ],
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
  let paused = false;
  let newRecord = false;
  let doneLines = 0;
  let milestones = {};   // 進捗セリフの発火済みフラグ

  // ドラッグ／長押し
  let dragging = false, dragValue = null, dragTarget = null;
  let lpTimer = null, lpCell = null, lpStart = null;

  // アンドゥ履歴（1ストローク＝1操作単位）
  let history = [];      // [{r,c,prev}[], ...]
  let stroke = null;     // 進行中ストロークの変更セル

  // ヒントルーレット（1問につき既定3回・1ラインを公開）
  const HINTS_PER_PUZZLE = 3;
  let hintsLeft = HINTS_PER_PUZZLE;
  let rouletteSpinning = false;

  // ピンチズーム／パン
  let boardEventsAttached = false;
  const pts = new Map();
  let pinching = false, pinchStart = null;
  const view = { scale: 1, x: 0, y: 0 };
  const ptDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ptMid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  function applyView() { board.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`; }
  function resetView() { view.scale = 1; view.x = 0; view.y = 0; applyView(); }

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
  // solution(0/1) から正方形の中央寄せサムネを描く
  function buildThumb(solution) {
    const rows = solution.length, cols = solution[0].length, side = Math.max(rows, cols);
    const wrap = document.createElement("div");
    wrap.className = "thumb-grid";
    wrap.style.setProperty("--cols", side);
    wrap.style.setProperty("--rows", side);
    const offX = Math.floor((side - cols) / 2), offY = Math.floor((side - rows) / 2);
    for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
      const cell = document.createElement("span");
      const sr = r - offY, sc = c - offX;
      if (sr >= 0 && sr < rows && sc >= 0 && sc < cols && solution[sr][sc] === 1) cell.className = "on";
      wrap.appendChild(cell);
    }
    return wrap;
  }

  function renderSelect() {
    const solved = loadSolved();
    puzzleList.innerHTML = "";
    PUZZLES.forEach(p => {
      const rec = solved[p.id];
      const cleared = !!rec;
      const cols = p.solution[0].length, rows = p.solution.length;

      const card = document.createElement("button");
      card.className = "ss-card " + (cleared ? "ss-card-cleared" : "ss-card-locked") + " ss-n10";
      card.dataset.puzzleId = p.id;

      const inner = document.createElement("span");
      inner.className = "ss-card-inner ss-n7";

      const frame = document.createElement("span");
      frame.className = "ss-thumb-frame ss-n7";
      const tinner = document.createElement("span");
      tinner.className = "ss-thumb-inner";
      if (cleared) {
        tinner.appendChild(buildThumb(p.solution));
      } else {
        const q = document.createElement("span");
        q.className = "ss-thumb-q"; q.textContent = "？";
        tinner.appendChild(q);
      }
      frame.appendChild(tinner);

      const title = document.createElement("span");
      title.className = "ss-card-title"; title.textContent = p.name;

      const diff = document.createElement("span");
      diff.className = "ss-diff-badge d" + p.difficulty;
      diff.textContent = DIFF_LABEL[p.difficulty] || ("Lv" + p.difficulty);

      const meta = document.createElement("span");
      meta.className = "ss-meta";
      meta.innerHTML =
        `<span class="ss-size">${cols}×${rows}</span>` +
        `<span class="ss-meta-sep">・</span>` +
        (cleared
          ? `<span class="ss-time"><i class="star">✦</i>${formatTime(rec.time)}</span>`
          : `<span class="ss-locked-note">みかいほう</span>`);

      inner.append(frame, title, diff, meta);
      card.appendChild(inner);
      card.addEventListener("click", () => startPuzzle(p));
      puzzleList.appendChild(card);
    });
    updateStarCount();
  }

  // ===== 背景の部屋（5種からランダム） =====
  const ROOMS = [
    "assets/rooms/room1.png?v=22", "assets/rooms/room2.png?v=22",
    "assets/rooms/room3.png?v=22", "assets/rooms/room4.png?v=22",
    "assets/rooms/room5.png?v=22",
  ];
  ROOMS.forEach(src => { const im = new Image(); im.src = src; });  // 先読み
  function pickRoom() {
    const src = ROOMS[Math.floor(Math.random() * ROOMS.length)];
    gameScreen.style.setProperty("--room-img", `url("${src}")`);
  }

  // ===== ゲーム開始 =====
  function startPuzzle(p) {
    pickRoom();
    sfx("transition");
    playBgm("play");
    current = p;
    rows = p.solution.length;
    cols = p.solution[0].length;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false; paused = false; seconds = 0; mode = "fill"; doneLines = 0; milestones = {};
    history = []; stroke = null;
    hintsLeft = HINTS_PER_PUZZLE;
    board.classList.remove("paused", "clearing");
    setPauseUI(false);
    updateModeButtons();
    updateUndoButton();
    updateHintUI();

    puzzleNameEl.textContent = p.name;
    selectScreen.classList.add("hidden");
    galleryScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    clearOverlay.classList.add("hidden");
    resetView();
    buildBoard();

    startTimer();
    updateClueStrike();
    updateProgress();
    setFace("neutral");
    setSpeech(SPEECH.start);
    resetIdle();
  }

  // ===== 盤面生成 =====
  // ヒント数字の3色ローテーション（並びを見分けやすく）
  const HINT_COLORS = ["var(--cell-ink)", "var(--hint2)", "var(--hint3)"];
  function hintColor(i) { return HINT_COLORS[i % HINT_COLORS.length]; }

  function buildBoard() {
    const rClues = rowClues(current.solution);
    const cClues = colClues(current.solution);

    // 1列目=ヒント欄。行ヒントの最大個数×文字幅で必要幅を確保（数字が欄からはみ出さないように）
    const maxRowClueLen = Math.max(1, ...rClues.map(c => c.length));
    const charW = cols >= 12 ? 10 : 13;
    const hintCol = Math.max(46, Math.min(90, maxRowClueLen * charW + 12));
    board.style.gridTemplateColumns = `${hintCol}px repeat(${cols}, minmax(0, 1fr))`;
    board.style.gridTemplateRows = "";
    // 大きい盤はヒント文字を小さめに（15×15など）
    board.classList.toggle("board-lg", cols >= 12);
    board.innerHTML = "";

    // 左上コーナー
    const corner = document.createElement("div");
    corner.className = "corner";
    board.appendChild(corner);

    // 列ヒント（上部・独立タブ）
    cClues.forEach((clue, c) => {
      const wrap = document.createElement("div");
      wrap.className = "colhint-wrap";
      const el = document.createElement("div");
      el.className = "colhint";
      el.dataset.col = c;
      clue.forEach((n, i) => {
        const s = document.createElement("span");
        s.textContent = n; s.style.display = "block"; s.style.color = hintColor(i);
        el.appendChild(s);
      });
      wrap.appendChild(el);
      board.appendChild(wrap);
    });

    // 各行：行ヒント → セル
    for (let r = 0; r < rows; r++) {
      const rwrap = document.createElement("div");
      rwrap.className = "rowhint-wrap";
      const rh = document.createElement("div");
      rh.className = "rowhint";
      rh.dataset.row = r;
      rClues[r].forEach((n, i) => {
        const s = document.createElement("span");
        s.textContent = n; s.style.color = hintColor(i);
        rh.appendChild(s);
      });
      rwrap.appendChild(rh);
      board.appendChild(rwrap);

      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        let cls = "cell";
        if ((c + 1) % 5 === 0 && c !== cols - 1) cls += " thick-right";
        if ((r + 1) % 5 === 0 && r !== rows - 1) cls += " thick-bottom";
        cell.className = cls;
        cell.dataset.r = r; cell.dataset.c = c;
        board.appendChild(cell);
      }
    }

    attachBoardEvents();
    renderCells();
  }

  // ===== セル描画 =====
  function cellEl(r, c) { return board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`); }
  function renderCell(r, c, pop) {
    const el = cellEl(r, c);
    if (!el) return;
    const wasFilled = el.classList.contains("filled");
    const isFilled = state[r][c] === FILLED;
    const isMarked = state[r][c] === MARKED;
    el.classList.toggle("filled", isFilled);
    el.classList.toggle("marked", isMarked);
    el.textContent = isMarked ? "✕" : "";
    if (pop && isFilled && !wasFilled) {
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    }
    if (pop && isMarked) {
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
    const rh = board.querySelector(`.rowhint[data-row="${r}"]`); if (rh) rh.classList.add("hl");
    const ch = board.querySelector(`.colhint[data-col="${c}"]`); if (ch) ch.classList.add("hl");
  }

  // ===== 入力処理 =====
  function startAction(target, r, c) {
    if (paused) return;
    dragging = true; dragTarget = target;
    stroke = [];
    const cur = state[r][c];
    if (target === "mark") dragValue = cur === MARKED ? EMPTY : MARKED;
    else dragValue = cur === FILLED ? EMPTY : FILLED;
    applyCell(r, c);
  }

  function attachBoardEvents() {
    if (boardEventsAttached) return;   // #board は使い回すので登録は一度だけ
    boardEventsAttached = true;

    const wrap = board.parentElement; // .board-wrap

    // --- 2本指ピンチズーム／パン ---
    wrap.addEventListener("pointerdown", e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        pinching = true;
        if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
        dragging = false;
        const [a, b] = [...pts.values()];
        pinchStart = { dist: ptDist(a, b), mid: ptMid(a, b), scale: view.scale, x: view.x, y: view.y };
      }
    }, { capture: true });
    wrap.addEventListener("pointermove", e => {
      if (!pinching) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size < 2) return;
      const [a, b] = [...pts.values()];
      let s = pinchStart.scale * (ptDist(a, b) / pinchStart.dist);
      s = Math.max(1, Math.min(3, s));
      const m = ptMid(a, b);
      view.scale = s;
      if (s === 1) { view.x = 0; view.y = 0; }
      else { view.x = pinchStart.x + (m.x - pinchStart.mid.x); view.y = pinchStart.y + (m.y - pinchStart.mid.y); }
      applyView();
    }, { capture: true });
    const dropPt = e => { pts.delete(e.pointerId); if (pts.size < 2) pinching = false; };
    wrap.addEventListener("pointerup", dropPt, { capture: true });
    wrap.addEventListener("pointercancel", dropPt, { capture: true });

    board.addEventListener("contextmenu", e => e.preventDefault());

    board.addEventListener("pointerdown", e => {
      if (pinching || pts.size >= 2) return;
      const cell = e.target.closest(".cell");
      if (!cell || cleared || paused) return;
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
      if (pinching || pts.size >= 2) return;
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
      if (stroke && stroke.length) { history.push(stroke); updateUndoButton(); }
      stroke = null;
      checkClear();
    };
    board.addEventListener("pointerup", endDrag);
    board.addEventListener("pointercancel", endDrag);
    window.addEventListener("pointerup", endDrag);
  }

  function applyCell(r, c) {
    if (cleared || paused) return;
    const cur = state[r][c];
    let next = cur;
    if (dragTarget === "fill") {
      if (dragValue === FILLED && cur !== FILLED) next = FILLED;
      else if (dragValue === EMPTY && cur === FILLED) next = EMPTY;
      else return;
    } else {
      if (dragValue === MARKED && cur === EMPTY) next = MARKED;
      else if (dragValue === EMPTY && cur === MARKED) next = EMPTY;
      else return;
    }
    if (stroke) stroke.push({ r, c, prev: cur });
    state[r][c] = next;
    playPaintSfx(next);
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
      const el = board.querySelector(`.rowhint[data-row="${r}"]`);
      if (el) el.classList.toggle("done", ok);
    }
    for (let c = 0; c < cols; c++) {
      const pl = state.map(row => (row[c] === FILLED ? 1 : 0));
      const solCol = current.solution.map(row => row[c]);
      const ok = arraysEqual(lineClue(pl), lineClue(solCol));
      if (ok) done++;
      const el = board.querySelector(`.colhint[data-col="${c}"]`);
      if (el) el.classList.toggle("done", ok);
    }
    if (!cleared && done > doneLines) { flashFace("shy", 700); setSpeech(SPEECH.line); sfx("line"); }
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
    newRecord = !prev || seconds < prev.time;   // 初クリア or ベスト更新
    if (newRecord) solved[current.id] = { time: seconds };
    saveSolved(solved);

    setFace("happy");
    setSpeech(SPEECH.clear);
    sfx("clear");
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
    fillClearArt(current.solution);
    const t = document.querySelector(".js-clear-time");
    if (t) t.textContent = "TIME " + formatTime(seconds);
    const tv = document.querySelector(".js-trivia-text");
    if (tv) tv.innerHTML = MEI_TRIVIA[current.id] || MEI_TRIVIA._default;
    clearOverlay.classList.toggle("is-record", newRecord);
    clearOverlay.classList.remove("hidden");
    sfx("fanfare");                                       // かんせい！のファンファーレ
    if (newRecord) setTimeout(() => sfx("record"), 1150); // 更新きらめきはファンファーレ後に
    updateStarCount();
  }

  // 完成ドット絵を solution から額縁内に描く（中央寄せ・正方形）
  function fillClearArt(solution) {
    const art = document.querySelector(".js-clear-art");
    if (!art) return;
    const R = solution.length, C = solution[0].length, side = Math.max(R, C);
    art.style.setProperty("--cols", side);
    art.style.setProperty("--rows", side);
    const offX = Math.floor((side - C) / 2), offY = Math.floor((side - R) / 2);
    art.innerHTML = "";
    for (let r = 0; r < side; r++) for (let c = 0; c < side; c++) {
      const sr = r - offY, sc = c - offX;
      const on = sr >= 0 && sr < R && sc >= 0 && sc < C && solution[sr][sc] === 1;
      const span = document.createElement("span");
      if (on) span.className = "on";
      art.appendChild(span);
    }
  }

  // ===== タイマー =====
  function startTimer() {
    stopTimer(); seconds = 0; timerEl.textContent = formatTime(0);
    timerId = setInterval(() => { seconds++; timerEl.textContent = formatTime(seconds); }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function resumeTimer() {
    if (timerId) return;
    timerId = setInterval(() => { seconds++; timerEl.textContent = formatTime(seconds); }, 1000);
  }
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

  // ===== ポーズ（きゅうけい） =====
  function setPauseUI(on) {
    if (!pauseBtn) return;
    pauseBtn.classList.toggle("active", on);
    const ico = pauseBtn.querySelector(".ico");
    if (ico) ico.textContent = on ? "▶" : "⏸";
  }
  function togglePause() {
    if (cleared || !current) return;
    paused = !paused;
    board.classList.toggle("paused", paused);
    setPauseUI(paused);
    sfx("pause");
    if (paused) {
      stopTimer();
      if (idleId) clearTimeout(idleId);
      setSpeech("きゅうけいちゅう…♦");
    } else {
      resumeTimer();
      setSpeech(SPEECH.line);
      resetIdle();
    }
  }

  // ===== アンドゥ（もどす） =====
  function updateUndoButton() {
    if (undoBtn) undoBtn.disabled = history.length === 0;
  }
  function undo() {
    if (cleared || paused || !history.length) return;
    const last = history.pop();
    for (let i = last.length - 1; i >= 0; i--) {
      const { r, c, prev } = last[i];
      state[r][c] = prev;
      renderCell(r, c, false);
    }
    updateClueStrike();
    updateProgress();
    updateUndoButton();
    resetIdle();
    flashFace("shy", 500);
  }

  // ===== 画面遷移 =====
  function backToSelect() {
    sfx("transition");
    playBgm("atelier");
    stopTimer();
    paused = false;
    board.classList.remove("paused", "clearing");
    setPauseUI(false);
    if (idleId) clearTimeout(idleId);
    clearOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    galleryScreen.classList.add("hidden");
    selectScreen.classList.remove("hidden");
    renderSelect();
    setFace("neutral");
    setSpeech(SPEECH.select);
  }

  function resetBoard() {
    if (!current) return;
    state = Array.from({ length: rows }, () => new Array(cols).fill(EMPTY));
    cleared = false; paused = false; doneLines = 0; milestones = {};
    history = []; stroke = null;
    hintsLeft = HINTS_PER_PUZZLE;
    board.classList.remove("clearing", "paused");
    setPauseUI(false);
    updateUndoButton();
    updateHintUI();
    renderCells();
    updateClueStrike();
    updateProgress();
    startTimer();
    flashFace("angry", 800);
    setSpeech(SPEECH.reset);
    resetIdle();
  }

  // ===== ヒントルーレット：スピン → ランダムな1ラインを公開（1問3回まで） =====
  function updateHintUI() {
    if (hintBadge) hintBadge.textContent = String(hintsLeft);
    if (hintBtn) hintBtn.disabled = (hintsLeft <= 0);
  }
  // まだ正解と一致していない行／列を1つランダムに選ぶ
  function pickIncompleteLine() {
    const cand = [];
    for (let r = 0; r < rows; r++) {
      const pl = state[r].map(v => (v === FILLED ? 1 : 0));
      if (!arraysEqual(pl, current.solution[r])) cand.push({ type: "row", index: r, label: "よこ" + (r + 1) });
    }
    for (let c = 0; c < cols; c++) {
      const pl = state.map(row => (row[c] === FILLED ? 1 : 0));
      const sol = current.solution.map(row => row[c]);
      if (!arraysEqual(pl, sol)) cand.push({ type: "col", index: c, label: "たて" + (c + 1) });
    }
    if (!cand.length) return null;
    return cand[Math.floor(Math.random() * cand.length)];
  }
  function buildReelLabels(finalLabel) {
    const arr = [];
    for (let k = 0; k < 20; k++) {
      const isRow = Math.random() < 0.5;
      const n = 1 + Math.floor(Math.random() * (isRow ? rows : cols));
      arr.push((isRow ? "よこ" : "たて") + n);
    }
    arr.push(finalLabel);   // 最後に必ず当たりのラベルで止まる
    return arr;
  }
  function openRoulette() {
    if (cleared || paused || rouletteSpinning) return;
    if (hintsLeft <= 0) {
      if (hintBtn) { hintBtn.classList.remove("nudge"); void hintBtn.offsetWidth; hintBtn.classList.add("nudge"); }
      sfx("erase");
      return;
    }
    const target = pickIncompleteLine();
    if (!target) {   // 公開できるラインが無い（ほぼ完成）→ 回数は消費しない
      flashFace("happy", 900);
      setSpeech("もう ほとんど かんせいだよ◆");
      sfx("button");
      return;
    }
    rouletteSpinning = true;
    if (rlResult) rlResult.textContent = "スピン ちゅう…";
    if (rlRemain) rlRemain.textContent = String(hintsLeft);
    if (rlReel) rlReel.classList.remove("win");
    if (rouletteOverlay) rouletteOverlay.classList.remove("hidden");
    sfx("button");
    spinReel(target, () => {
      if (rlReel) rlReel.classList.add("win");
      if (rlResult) rlResult.innerHTML = 'あたり！ <b>' + target.label + '</b> を こうかい！';
      sfx("record");
      setTimeout(() => {
        if (rouletteOverlay) rouletteOverlay.classList.add("hidden");
        rouletteSpinning = false;
        hintsLeft = Math.max(0, hintsLeft - 1);
        updateHintUI();
        revealLine(target);
      }, 950);
    });
  }
  function spinReel(target, onDone) {
    const labels = buildReelLabels(target.label);
    let i = 0;
    (function step() {
      if (rlReel) rlReel.textContent = labels[i];
      if (i > 0) sfx("tick");
      i++;
      if (i < labels.length) setTimeout(step, Math.min(40 + i * i * 1.1, 285));
      else if (onDone) onDone();
    })();
  }
  function revealLine(t) {
    if (cleared) return;
    const cells = [];
    if (t.type === "row") { for (let c = 0; c < cols; c++) cells.push([t.index, c]); }
    else { for (let r = 0; r < rows; r++) cells.push([r, t.index]); }

    const changed = [];
    cells.forEach(([r, c]) => {
      const want = current.solution[r][c] === 1 ? FILLED : MARKED;
      if (state[r][c] !== want) { changed.push({ r: r, c: c, prev: state[r][c] }); state[r][c] = want; }
    });
    if (changed.length) { history.push(changed); updateUndoButton(); }

    cells.forEach(([r, c], i) => {
      setTimeout(() => {
        renderCell(r, c, true);
        const el = cellEl(r, c);
        if (el) { el.classList.remove("hint-flash"); void el.offsetWidth; el.classList.add("hint-flash"); }
      }, i * 45);
    });
    sfx("line");
    flashFace("happy", 900);
    setSpeech(t.label + " こうかい！ サービスだよ◆");
    updateClueStrike();
    updateProgress();
    setTimeout(() => checkClear(), cells.length * 45 + 120);
  }

  // ===== 起動画面（画面0）→ 各画面へ =====
  const titleScreen = document.getElementById("title-screen");
  const btnStart = document.getElementById("btn-start-stream");
  const btnGallery = document.getElementById("btn-gallery");
  function enterSelectFromTitle() {
    sfx("transition");
    playBgm("atelier");
    if (titleScreen) titleScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    galleryScreen.classList.add("hidden");
    clearOverlay.classList.add("hidden");
    selectScreen.classList.remove("hidden");
    renderSelect();
    setFace("neutral");
    setSpeech(SPEECH.select);
  }
  if (btnStart) btnStart.addEventListener("click", enterSelectFromTitle);
  if (btnGallery) btnGallery.addEventListener("click", enterGalleryFromTitle);

  // ===== ギャラリー（こうぼうの かべ）：完成した絵を額縁で飾る壁 =====
  function renderGallery() {
    const solved = loadSolved();
    galleryList.innerHTML = "";
    PUZZLES.forEach(p => {
      const cleared = !!solved[p.id];
      const card = document.createElement("div");
      card.className = "gl-card" + (cleared ? "" : " gl-locked");
      const frame = document.createElement("div"); frame.className = "gl-frame";
      const mat = document.createElement("div"); mat.className = "gl-mat";
      if (cleared) {
        mat.appendChild(buildThumb(p.solution));
      } else {
        const q = document.createElement("span"); q.className = "gl-q"; q.textContent = "？";
        mat.appendChild(q);
      }
      frame.appendChild(mat);
      const name = document.createElement("div"); name.className = "gl-name";
      name.textContent = cleared ? p.name : "？？？";
      card.append(frame, name);
      galleryList.appendChild(card);
    });
  }
  // かいほう済みトークの見直しリスト（節目ごと・タップで再生）
  function renderTalkList() {
    if (!galleryTalkList) return;
    galleryTalkList.innerHTML = "";
    Object.keys(TALK_EVENTS).map(Number).sort((a, b) => a - b).forEach(n => {
      const unlocked = DEBUG || isTalkShown(n);   // デバッグ版は全解放
      const card = document.createElement(unlocked ? "button" : "div");
      card.className = "gl-talk-card" + (unlocked ? "" : " locked");

      const face = document.createElement("span");
      face.className = "gl-talk-face" + (unlocked ? "" : " locked");
      if (unlocked) {
        const expr = (TALK_EVENTS[n][0] && TALK_EVENTS[n][0].expr) || "normal";
        const img = document.createElement("img");
        img.alt = ""; img.onerror = function () { this.onerror = null; this.src = "assets/mei/normal.png?v=35"; };
        img.src = "assets/mei/" + expr + ".png?v=35";
        face.appendChild(img);
      } else {
        face.textContent = "🔒";
      }

      const lbl = document.createElement("span");
      lbl.className = "gl-talk-lbl";
      lbl.innerHTML = `<b>${n}もん たっせい</b><span>${unlocked ? "▶ みなおす" : "みかいほう"}</span>`;

      card.append(face, lbl);
      if (unlocked) card.addEventListener("click", () => { sfx("button"); showTalkEvent(n, showGallery); });
      galleryTalkList.appendChild(card);
    });
  }
  function showGallery() {
    playBgm("atelier");
    if (titleScreen) titleScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    selectScreen.classList.add("hidden");
    clearOverlay.classList.add("hidden");
    galleryScreen.classList.remove("hidden");
    renderGallery();
    renderTalkList();
  }
  function enterGalleryFromTitle() { sfx("transition"); showGallery(); }

  // デバッグ：トークイベントを最初から解放（節目に関係なく再生）
  function buildTalkDebugButtons() {
    if (!galleryTalkBtns) return;
    galleryTalkBtns.innerHTML = "";
    Object.keys(TALK_EVENTS).map(Number).sort((a, b) => a - b).forEach(n => {
      const btn = document.createElement("button");
      btn.className = "gl-debug-btn";
      btn.textContent = n + "もん";
      btn.addEventListener("click", () => showTalkEvent(n, showGallery));
      galleryTalkBtns.appendChild(btn);
    });
  }
  if (glMenuBtn) glMenuBtn.addEventListener("click", openMenu);
  galleryScreen.addEventListener("contextmenu", e => { e.preventDefault(); openMenu(); });

  // ===== メインメニュー（右クリック／☰） =====
  function openMenu() { if (menuOverlay) menuOverlay.classList.remove("hidden"); updateSoundLabel(); sfx("button"); }
  function closeMenu() { if (menuOverlay) menuOverlay.classList.add("hidden"); }
  function updateSoundLabel() {
    if (menuSoundBtn) menuSoundBtn.textContent = "サウンド： " + (window.SFX && window.SFX.isMuted() ? "OFF" : "ON");
  }
  function goToTitle() {
    closeMenu();
    sfx("transition");
    playBgm("title");
    stopTimer();
    if (idleId) clearTimeout(idleId);
    paused = false; cleared = false;
    board.classList.remove("paused", "clearing");
    setPauseUI(false);
    clearOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    galleryScreen.classList.add("hidden");
    selectScreen.classList.add("hidden");
    if (titleScreen) titleScreen.classList.remove("hidden");
    setFace("neutral");
  }
  if (ssMenuBtn) ssMenuBtn.addEventListener("click", openMenu);
  if (ghMenuBtn) ghMenuBtn.addEventListener("click", openMenu);
  if (menuCloseBtn) menuCloseBtn.addEventListener("click", () => { sfx("button"); closeMenu(); });
  if (menuTitleBtn) menuTitleBtn.addEventListener("click", goToTitle);
  if (menuSoundBtn) menuSoundBtn.addEventListener("click", () => {
    if (window.SFX) window.SFX.setMuted(!window.SFX.isMuted());
    updateSoundLabel();
    sfx("button");   // ONに戻したときだけ鳴る（OFFなら無音）
  });
  if (menuOverlay) menuOverlay.addEventListener("click", e => { if (e.target === menuOverlay) closeMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });
  // 右クリック：セレクト画面はどこでも／ゲーム画面は盤面以外でメニューを開く（盤面の右クリックは✕マーク）
  selectScreen.addEventListener("contextmenu", e => { e.preventDefault(); openMenu(); });
  gameScreen.addEventListener("contextmenu", e => {
    if (e.target.closest && e.target.closest("#board")) return;
    e.preventDefault(); openMenu();
  });

  // ===== オプション設定（タイトルの「⚙ せってい」から） =====
  const btnOptions = document.getElementById("btn-options");
  const optionsOverlay = document.getElementById("options-overlay");
  const optBgmBtn = document.getElementById("opt-bgm");
  const optSeBtn = document.getElementById("opt-se");
  const optResetBtn = document.getElementById("opt-reset");
  const optResetNote = document.getElementById("opt-reset-note");
  const optCloseBtn = document.getElementById("opt-close");
  const RESET_NOTE = "クリア記録・ベストタイム・トークが すべて消えます";
  let resetArmed = false, resetArmTimer = null;
  function updateOptionLabels() {
    if (optBgmBtn) {
      const off = !!(window.SFX && window.SFX.isBgmMuted());
      optBgmBtn.textContent = "BGM： " + (off ? "OFF" : "ON");
      optBgmBtn.classList.toggle("is-off", off);
    }
    if (optSeBtn) {
      const off = !!(window.SFX && window.SFX.isSeMuted());
      optSeBtn.textContent = "こうかおん： " + (off ? "OFF" : "ON");
      optSeBtn.classList.toggle("is-off", off);
    }
  }
  function disarmReset() {
    resetArmed = false;
    if (resetArmTimer) { clearTimeout(resetArmTimer); resetArmTimer = null; }
    if (optResetBtn) { optResetBtn.classList.remove("is-armed"); optResetBtn.textContent = "きろくを けす"; }
    if (optResetNote) optResetNote.textContent = RESET_NOTE;
  }
  function openOptions() {
    if (!optionsOverlay) return;
    disarmReset();
    updateOptionLabels();
    optionsOverlay.classList.remove("hidden");
    sfx("button");
  }
  function closeOptions() { if (optionsOverlay) optionsOverlay.classList.add("hidden"); disarmReset(); }
  if (btnOptions) btnOptions.addEventListener("click", openOptions);
  if (optCloseBtn) optCloseBtn.addEventListener("click", () => { sfx("button"); closeOptions(); });
  if (optionsOverlay) optionsOverlay.addEventListener("click", e => { if (e.target === optionsOverlay) closeOptions(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeOptions(); });
  if (optBgmBtn) optBgmBtn.addEventListener("click", () => {
    if (window.SFX) window.SFX.setBgmMuted(!window.SFX.isBgmMuted());
    updateOptionLabels(); sfx("button");
  });
  if (optSeBtn) optSeBtn.addEventListener("click", () => {
    if (window.SFX) window.SFX.setSeMuted(!window.SFX.isSeMuted());
    updateOptionLabels(); sfx("button");   // SEをONに戻したときだけ鳴る
  });
  if (optResetBtn) optResetBtn.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      optResetBtn.classList.add("is-armed");
      optResetBtn.textContent = "ほんとうに けす？";
      if (optResetNote) optResetNote.textContent = "もう一度おすと 消えます（4秒で キャンセル）";
      sfx("pause");
      resetArmTimer = setTimeout(disarmReset, 4000);
      return;
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(TALK_KEY); } catch (e) {}
    disarmReset();
    if (optResetNote) optResetNote.textContent = "きろくを けしました！";
    renderSelect();
    updateStarCount();
    sfx("record");
  });

  // ===== 会話イベント（ファミコン風カットシーン） =====
  const TALK_KEY = "dot-picross-talks";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function loadTalks() { try { return JSON.parse(localStorage.getItem(TALK_KEY)) || []; } catch (e) { return []; } }
  function isTalkShown(n) { return loadTalks().indexOf(n) !== -1; }
  function markTalkShown(n) { const a = loadTalks(); if (a.indexOf(n) === -1) { a.push(n); try { localStorage.setItem(TALK_KEY, JSON.stringify(a)); } catch (e) {} } }

  let talkQueue = [], talkIdx = 0, talkTyping = false, talkTimer = null, talkOnEnd = null;

  function pickTalk(count) {
    if (TALK_EVENTS[count]) return TALK_EVENTS[count];
    const keys = Object.keys(TALK_EVENTS).map(Number).sort((a, b) => a - b);
    return TALK_EVENTS[keys[keys.length - 1]];   // 定義外の節目は最大の会話を再利用
  }
  function showTalkEvent(count, onEnd) {
    talkQueue = pickTalk(count); talkIdx = 0; talkOnEnd = onEnd || null;
    playBgm("talk");
    if (talkEvent) talkEvent.classList.remove("hidden");
    renderKoma();
  }
  function renderKoma() {
    const koma = talkQueue[talkIdx];
    if (talkMei) {
      talkMei.onerror = function () { this.onerror = null; this.src = "assets/mei/shy.png?v=18"; };  // 未配置表情はshyで代替
      talkMei.src = "assets/mei/" + koma.expr + ".png?v=18";
    }
    if (talkProgEl) talkProgEl.textContent = (talkIdx + 1) + "／" + talkQueue.length;
    sfx("talk");
    typeText(koma.text);
  }
  function typeText(html) {
    if (!talkTextEl) return;
    talkTyping = true;
    clearInterval(talkTimer);
    if (reduceMotion) { talkTextEl.innerHTML = html; talkTyping = false; return; }
    // <br> をトークン化して1文字ずつ（タグ途中で切れないように）
    const tokens = html.split(/(<br>)/g).flatMap(seg => seg === "<br>" ? ["<br>"] : Array.from(seg));
    talkTextEl.innerHTML = "";
    let i = 0;
    talkTimer = setInterval(() => {
      if (i >= tokens.length) { clearInterval(talkTimer); talkTyping = false; return; }
      talkTextEl.innerHTML += tokens[i++];
    }, 42);
  }
  function onTalkTap() {
    if (talkTyping) {   // タイプ中 → 即時全表示
      clearInterval(talkTimer);
      if (talkTextEl) talkTextEl.innerHTML = talkQueue[talkIdx].text;
      talkTyping = false;
      return;
    }
    talkIdx++;
    if (talkIdx >= talkQueue.length) {
      if (talkEvent) talkEvent.classList.add("hidden");
      const cb = talkOnEnd; talkOnEnd = null;
      if (cb) cb();
    } else {
      renderKoma();
    }
  }
  if (talkEvent) talkEvent.addEventListener("click", onTalkTap);

  // クリアの「つぎへ」：5問節目なら会話イベント → その後 select へ
  function onClearNext() {
    clearOverlay.classList.add("hidden");
    const count = Object.keys(loadSolved()).length;   // 累計クリア数（達成パズル種類数）
    if (count > 0 && count % 5 === 0 && !isTalkShown(count)) {
      markTalkShown(count);
      showTalkEvent(count, backToSelect);
    } else {
      backToSelect();
    }
  }

  // ===== イベント登録 =====
  backBtn.addEventListener("click", backToSelect);
  resetBtn.addEventListener("click", () => { sfx("button"); resetBoard(); });
  if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
  if (hintBtn) hintBtn.addEventListener("click", openRoulette);
  if (undoBtn) undoBtn.addEventListener("click", () => { sfx("button"); undo(); });
  modeFillBtn.addEventListener("click", () => { sfx("button"); setMode("fill"); });
  modeMarkBtn.addEventListener("click", () => { sfx("button"); setMode("mark"); });
  clearNextBtn.addEventListener("click", () => { sfx("button"); onClearNext(); });

  // ===== デバッグ表示（?debug=1 で有効・localStorage記憶。通常は隠す） =====
  let DEBUG = false;
  try {
    const q = new URLSearchParams(location.search);
    if (window.DOT_DEBUG === true) DEBUG = true;            // ビルド埋め込みフラグ（デバッグ配布版）
    else if (q.has("debug")) { DEBUG = q.get("debug") !== "0"; localStorage.setItem("dot-picross-debug", DEBUG ? "1" : "0"); }
    else DEBUG = localStorage.getItem("dot-picross-debug") === "1";
  } catch (e) {}
  const glDebugEl = document.querySelector(".gl-debug");
  if (glDebugEl && !DEBUG) glDebugEl.style.display = "none";

  // ===== 起動 =====
  renderSelect();
  if (DEBUG) buildTalkDebugButtons();
  playBgm("title");   // 初回タップでアンロックされて再生開始
})();
