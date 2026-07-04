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

  // ===== BGM（mp3・画面ごと切替＋ループの継ぎ目をクロスフェードして無音ゼロに） =====
  const BGM_MAX = 0.42;
  const XLOOP = 1.0;     // ループ継ぎ目のクロスフェード秒（短め・かけすぎ防止）
  const BGM_SRC = {
    title:   "assets/bgm/title.mp3?v=26",
    atelier: "assets/bgm/atelier.mp3?v=26",
    play:    "assets/bgm/play.mp3?v=26",
    talk:    "assets/bgm/talk.mp3?v=26",
  };
  const loopers = {};
  let bgmCur = null, bgmTick = null;
  function tryPlay(a) { if (!a) return; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  function looper(name) {
    if (loopers[name]) return loopers[name];
    if (!BGM_SRC[name]) return null;
    const a = new Audio(BGM_SRC[name]), b = new Audio(BGM_SRC[name]);
    [a, b].forEach(e => { e.preload = "auto"; e.loop = false; e.volume = 0; });
    return (loopers[name] = { a: a, b: b, prim: a, sec: b, gain: 0, target: 0, xf: false, active: false });
  }
  function startLooper(L) { L.active = true; try { L.prim.currentTime = 0; } catch (e) {} tryPlay(L.prim); }
  function bgmTickFn() {
    const level = muted ? 0 : BGM_MAX;
    let any = false;
    Object.keys(loopers).forEach(name => {
      const L = loopers[name];
      if (!L.active && L.gain <= 0.0001) return;
      any = true;
      if (L.gain < L.target) L.gain = Math.min(L.target, L.gain + 0.05);        // 曲切替フェードイン
      else if (L.gain > L.target) L.gain = Math.max(L.target, L.gain - 0.05);   // フェードアウト
      const p = L.prim, s = L.sec, dur = p.duration;
      if (!muted && dur && !isNaN(dur)) {
        if (!L.xf && p.currentTime >= dur - XLOOP) { L.xf = true; try { s.currentTime = 0; } catch (e) {} s.volume = 0; tryPlay(s); }
        if (L.xf) {
          const rem = dur - p.currentTime, k = Math.max(0, Math.min(1, 1 - rem / XLOOP));
          s.volume = level * L.gain * Math.sin(k * Math.PI / 2);   // 等パワー（中央で音量が落ちない）
          p.volume = level * L.gain * Math.cos(k * Math.PI / 2);
          if (p.currentTime >= dur - 0.06 || p.ended || rem <= 0.05) { p.pause(); p.volume = 0; L.prim = s; L.sec = p; L.xf = false; }
          return;
        }
      }
      if (muted) { p.volume = 0; s.volume = 0; }
      else p.volume = level * L.gain;
      if (L.gain <= 0.0001 && L.target <= 0) { L.active = false; p.pause(); s.pause(); p.volume = 0; s.volume = 0; }
    });
    if (!any && bgmTick) { clearInterval(bgmTick); bgmTick = null; }
  }
  function startTick() { if (!bgmTick) bgmTick = setInterval(bgmTickFn, 60); }
  function bgmPlay(name) {
    const L = looper(name); if (!L) return;
    if (bgmCur !== name) { Object.keys(loopers).forEach(n => { loopers[n].target = 0; }); bgmCur = name; }
    L.target = 1;
    if (!muted && !L.active) startLooper(L);
    startTick();
  }
  function bgmUnlock() {
    if (!bgmCur || muted) return;
    const L = looper(bgmCur); if (!L) return;
    L.active = true; tryPlay(L.prim); if (L.xf) tryPlay(L.sec);
    startTick();
  }

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
      if (muted) {
        Object.keys(loopers).forEach(n => { const L = loopers[n]; L.a.pause(); L.b.pause(); L.a.volume = 0; L.b.volume = 0; });
      } else if (bgmCur) {
        const L = looper(bgmCur); L.target = 1; L.active = true;
        tryPlay(L.prim); if (L.xf) tryPlay(L.sec);
        startTick();
      }
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
    fanfare() {
      if (!ensure()) return;
      const t = ctx.currentTime, g = 0.42;
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, t + i * 0.1, 0.1, { type: "square", gain: g }));  // 呼び込み
      const t2 = t + 0.44;
      tone(N.C6, t2, 0.6, { type: "square", gain: g });         // 主和音（ジャーン）
      tone(N.E6, t2, 0.6, { type: "triangle", gain: g * 0.7 });
      tone(N.G6, t2, 0.6, { type: "triangle", gain: g * 0.6 });
      [N.G6, N.C7, N.G6, N.C7].forEach((f, i) => tone(f, t2 + 0.14 + i * 0.08, 0.1, { type: "square", gain: g * 0.35 }));  // きらめき
    },
  };
  window.SFX = API;
})();
