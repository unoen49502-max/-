import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CONFIG_PATH } from './config.js';
import { loadState, saveState, availablePool } from './store.js';
import { pickNext, recordShown, primaryGenre } from './rotator.js';
import { collectAll, spreadOf } from './collect.js';
import { labelOf } from './genres.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  });
  res.end(text);
}

async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('invalid JSON body');
  }
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const full = path.join(PUBLIC_DIR, rel);
  // public の外に出る参照は拒否する。
  if (!full.startsWith(PUBLIC_DIR + path.sep) && full !== PUBLIC_DIR) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(full, (error, data) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

function statsOf(state, config) {
  const pool = availablePool(state, config.collect);
  const counts = state.genreCounts || {};
  const shownTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const genres = new Set([...Object.keys(counts), ...Object.keys(spreadOf(pool))]);
  return {
    poolTotal: state.pool.length,
    poolAvailable: pool.length,
    shownTotal,
    favorites: state.favorites.length,
    lastCollectedAt: state.lastCollectedAt,
    xReadsToday: state.xBudget?.reads || 0,
    genres: [...genres].map((id) => ({
      id,
      label: labelOf(id),
      shown: counts[id] || 0,
      inPool: spreadOf(pool)[id] || 0,
    })).sort((a, b) => b.shown - a.shown || b.inPool - a.inPool),
  };
}

export function createServer(config) {
  let state = loadState();
  let collecting = null;
  const logs = [];
  const log = (message) => {
    logs.push({ at: new Date().toISOString(), message });
    if (logs.length > 300) logs.shift();
    console.log(`[collect] ${message}`);
  };

  async function refresh() {
    if (collecting) return collecting;
    collecting = collectAll(config, state, log)
      .then((result) => {
        saveState(state);
        log(`収集完了: 新規 ${result.added} 件 / プール ${result.poolSize} 件`);
        return result;
      })
      .catch((error) => {
        log(`収集エラー: ${error.message}`);
        throw error;
      })
      .finally(() => { collecting = null; });
    return collecting;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        sendJson(res, 200, statsOf(state, config));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/next') {
        const pool = availablePool(state, config.collect);
        const { item, reason, debug } = pickNext(pool, state, { weights: config.rotation });
        if (!item) {
          sendJson(res, 200, { item: null, reason: 'プールが空です。更新を実行してください。' });
          return;
        }
        if (url.searchParams.get('peek') !== '1') {
          state.seen[item.id] = new Date().toISOString();
          recordShown(state, item);
          saveState(state);
        }
        sendJson(res, 200, {
          item: { ...item, genreLabels: (item.genres || []).map(labelOf) },
          reason,
          debug,
          display: config.display,
          secondsPerItem: config.display.secondsPerItem,
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/favorites') {
        sendJson(res, 200, { favorites: state.favorites });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/logs') {
        sendJson(res, 200, { logs: logs.slice(-80), collecting: Boolean(collecting) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/favorite') {
        const body = await readBody(req);
        const item = state.pool.find((entry) => entry.id === body.id)
          || state.favorites.find((entry) => entry.id === body.id);
        if (!item) { sendJson(res, 404, { error: 'unknown item' }); return; }
        const exists = state.favorites.some((entry) => entry.id === body.id);
        if (body.on === false || (body.on === undefined && exists)) {
          state.favorites = state.favorites.filter((entry) => entry.id !== body.id);
        } else if (!exists) {
          state.favorites.unshift({ ...item, favoritedAt: new Date().toISOString() });
        }
        saveState(state);
        sendJson(res, 200, { favorited: state.favorites.some((entry) => entry.id === body.id) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/skip') {
        const body = await readBody(req);
        state.skipped[body.id] = (state.skipped[body.id] || 0) + 1;
        state.seen[body.id] = new Date().toISOString();
        saveState(state);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/refresh') {
        refresh().catch(() => {});
        sendJson(res, 202, { started: true });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/display') {
        const body = await readBody(req);
        const seconds = Number(body.secondsPerItem);
        if (Number.isFinite(seconds) && seconds >= 5 && seconds <= 900) {
          config.display.secondsPerItem = Math.round(seconds);
          persistDisplay(config);
        }
        sendJson(res, 200, { display: config.display });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/reset-history') {
        state.history = [];
        state.genreCounts = {};
        saveState(state);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET') {
        serveStatic(req, res, url.pathname);
        return;
      }

      sendJson(res, 405, { error: 'method not allowed' });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
  });

  server.refresh = refresh;
  server.getState = () => state;
  server.setState = (next) => { state = next; };
  return server;
}

/** 表示秒数だけは UI から変えられるので config.json に書き戻す。 */
function persistDisplay(config) {
  try {
    const current = fs.existsSync(CONFIG_PATH)
      ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
      : {};
    current.display = { ...(current.display || {}), ...config.display };
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  } catch {
    // 書き戻せなくても実行中の設定は生きているので落とさない。
  }
}

export { statsOf };
