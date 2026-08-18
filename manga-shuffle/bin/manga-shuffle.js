#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { loadConfig, writeExampleConfig } from '../src/config.js';
import { createServer } from '../src/server.js';

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`漫画シャッフル

  npm start                 サーバを起動してブラウザで開く
  npm start -- --no-open    ブラウザを開かない
  npm run collect           収集だけ実行して終了
  npm run doctor            各ソースが今も取得できるか確認
  npm test                  ローテーションと分類のテスト
`);
  process.exit(0);
}

const config = loadConfig();
if (args.has('--no-open')) config.server.open = false;

const server = createServer(config);

server.listen(config.server.port, config.server.host, async () => {
  const url = `http://${config.server.host}:${config.server.port}/`;
  console.log(`漫画シャッフルを起動しました: ${url}`);

  const state = server.getState();
  if (state.pool.length < 30) {
    console.log('プールが少ないので起動時に収集します…');
    server.refresh().catch((error) => console.error('収集に失敗:', error.message));
  }

  const interval = Math.max(10, config.collect.intervalMinutes) * 60_000;
  setInterval(() => {
    server.refresh().catch((error) => console.error('定期収集に失敗:', error.message));
  }, interval).unref?.();

  if (config.server.open) openBrowser(url);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ポート ${config.server.port} は使用中です。config.json の server.port を変えてください。`);
    process.exit(1);
  }
  throw error;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n終了します。');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref?.();
  });
}

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const commandArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(command, commandArgs, { stdio: 'ignore', detached: true }).unref();
  } catch {
    console.log('ブラウザの自動起動に失敗しました。上の URL を手動で開いてください。');
  }
}

// 初回起動時に設定の雛形を置いておく（既にあれば上書きしない）。
try { writeExampleConfig(); } catch { /* noop */ }
