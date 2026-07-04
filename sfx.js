/* ===== メイのドット工房 — サウンド（Web AudioでチップチューンSEを合成） ===== */
(function () {
  "use strict";
  const KEY = "dot-picross-muted";
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.26;
    master.connect(ctx.destination);
    return ctx;
  }
  function unlock() { const c = ensure(); if (c && c.state === "suspended") c.resume(); bgmUnlock(); }

  // ===== BGM（mp3・画面ごとにループ＋クロスフェード。サウンドトグルに連動） =====
  const BGM_MAX = 0.42;
  const BGM_SRC = {
    title:   "assets/bgm/title.mp3?v=26",
    atelier: "assets/bgm/atelier.mp3?v=26",
    play:    "assets/bgm/play.mp3?v=26",
    talk:    "assets/bgm/talk.mp3?v=26",
  };
  const bgmEl = {};
  let bgmCur = null, bgmFadeId = null;
  function bgmGet(name) {
    if (bgmEl[name]) return bgmEl[name];
    if (!BGM_SRC[name]) return null;
    const a = new Audio(BGM_SRC[name]); a.loop = true; a.preload = "auto"; a.volume = 0;
    bgmEl[name] = a; return a;
  }
  function tryPlay(a) { if (!a) return; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  function bgmPlay(name) {
    if (!BGM_SRC[name]) return;
    if (bgmCur === name) { if (!muted) { const a = bgmGet(name); a.volume = BGM_MAX; tryPlay(a); } return; }
    const prev = bgmCur ? bgmGet(bgmCur) : null;
    const next = bgmGet(name);
    bgmCur = name;
    if (muted) { if (prev) prev.pause(); return; }   // ミュート中は切替だけ記録
    next.volume = 0; tryPlay(next);
    if (bgmFadeId) clearInterval(bgmFadeId);
    let t = 0; const steps = 14;
    bgmFadeId = setInterval(() => {
      t++; const k = t / steps;
      next.volume = Math.min(BGM_MAX, BGM_MAX * k);
      if (prev) prev.volume = Math.max(0, BGM_MAX * (1 - k));
      if (t >= steps) { clearInterval(bgmFadeId); bgmFadeId = null; if (prev) prev.pause(); next.volume = BGM_MAX; }
    }, 45);
  }
  function bgmUnlock() { if (bgmCur && !muted) { const a = bgmGet(bgmCur); a.volume = BGM_MAX; tryPlay(a); } }

  // 1音（矩形波などのエンベロープ付き）
  function tone(freq, t0, dur, opt) {
    opt = opt || {};
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opt.type || "square";
    o.frequency.setValueAtTime(freq, t0);
    if (opt.slideTo) o.frequency.exponentialRampToValueAtTime(opt.slideTo, t0 + dur);
    const peak = opt.gain != null ? opt.gain : 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // 連続音（アルペジオ）
  function seq(notes, opt) {
    opt = opt || {};
    if (!ensure()) return;
    const t = ctx.currentTime, step = opt.step || 0.09;
    notes.forEach((f, i) => { if (f) tone(f, t + i * step, step * 0.9, opt); });
  }

  const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, D6: 1175, E6: 1319, G6: 1568, C7: 2093 };

  const API = {
    unlock: unlock,
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.26;
      if (bgmCur) { const a = bgmGet(bgmCur); if (muted) { a.pause(); } else { a.volume = BGM_MAX; tryPlay(a); } }
    },
    bgm(name) { bgmPlay(name); },
    isMuted() { return muted; },

    fill()  { if (!ensure()) return; tone(700, ctx.currentTime, 0.045, { gain: 0.4 }); },
    erase() { if (!ensure()) return; tone(320, ctx.currentTime, 0.06, { gain: 0.3, slideTo: 180 }); },
    mark()  { if (!ensure()) return; const t = ctx.currentTime; tone(520, t, 0.03, { gain: 0.34 }); tone(780, t + 0.035, 0.04, { gain: 0.34 }); },
    button(){ if (!ensure()) return; tone(460, ctx.currentTime, 0.04, { gain: 0.34, slideTo: 600 }); },
    pause() { seq([460, 330], { type: "triangle", gain: 0.4, step: 0.09 }); },
    line()  { seq([N.E5, N.G5, N.C6], { type: "square", gain: 0.32, step: 0.06 }); },
    talk()  { if (!ensure()) return; tone(900, ctx.currentTime, 0.02, { gain: 0.16 }); },
    transition() { if (!ensure()) return; tone(300, ctx.currentTime, 0.16, { type: "triangle", gain: 0.28, slideTo: 720 }); },
    record(){ seq([N.C6, N.E6, N.G6, N.C7], { type: "square", gain: 0.3, step: 0.05 }); },
    clear() { seq([N.C5, N.E5, N.G5, N.C6, N.E6, N.G6], { type: "square", gain: 0.4, step: 0.1 }); },
  };
  window.SFX = API;
})();
