/* ===== メイのドット工房 — Service Worker（オフライン対応・PWA） ===== */
const VERSION = "v36";
const APP_CACHE = "dot-atelier-app-" + VERSION;   // アプリ本体（バージョンで入替）
const FONT_CACHE = "dot-atelier-fonts";           // Google Fonts（横断キャッシュ・保持）

// アプリの中身を丸ごと先読みキャッシュ（?v= はindex.htmlの読み込みと一致させる）
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=36",
  "./sfx.js?v=36",
  "./puzzles.js?v=36",
  "./game.js?v=36",
  "./manifest.webmanifest",
  "./assets/fonts/Melonano.ttf",
  "./assets/fonts/MPLUSRounded1c-Bold.ttf",
  "./assets/mei_bust.png",
  "./assets/char-bust.png",
  "./assets/char-faces.png",
  "./assets/bg_rotated.png",
  "./assets/gallery_room.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/mei/normal.png",
  "./assets/mei/surprise.png",
  "./assets/mei/pout.png",
  "./assets/mei/shy.png",
  "./assets/mei/down.png",
  "./assets/mei/cry.png",
  "./assets/rooms/room1.png?v=22",
  "./assets/rooms/room2.png?v=22",
  "./assets/rooms/room3.png?v=22",
  "./assets/rooms/room4.png?v=22",
  "./assets/rooms/room5.png?v=22",
  "./assets/bgm/title.mp3?v=26",
  "./assets/bgm/atelier.mp3?v=26",
  "./assets/bgm/play.mp3?v=26",
  "./assets/bgm/talk.mp3?v=26",
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP_CACHE);
    // 1件失敗しても全体を止めない（addで個別に握りつぶす）
    await Promise.all(APP_SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k === APP_CACHE || k === FONT_CACHE) return null;
      return caches.delete(k);   // 旧バージョンのアプリキャッシュを掃除
    }));
    await self.clients.claim();
  })());
});

const isFont = u =>
  u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts（CSS＋フォント本体）：キャッシュ優先で保存 → 初回オンライン以降オフラインでも表示
  if (isFont(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      } catch (_) {
        return hit || Response.error();
      }
    })());
    return;
  }

  // 同一オリジン：キャッシュ優先、無ければ取得して保存（オフラインで完結）
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      // ?v= のバージョン差を無視してパスで一致（先読みキャッシュを確実に使う）
      const cached = await caches.match(req, { ignoreVary: true, ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === "basic") {
          const c = await caches.open(APP_CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (_) {
        // ナビゲーション要求はindex.htmlで代替（SPA的フォールバック）
        if (req.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        return Response.error();
      }
    })());
  }
});
