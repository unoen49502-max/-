import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDefaults } from './sources/index.js';
import { DEFAULT_WEIGHTS } from './rotator.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// テストや複数プロファイルのために設定ファイルの場所も差し替えられるようにする。
export const CONFIG_PATH = process.env.MANGA_SHUFFLE_CONFIG || path.join(ROOT, 'config.json');

export function defaultConfig() {
  return {
    server: { port: 4187, host: '127.0.0.1', open: true },
    display: {
      // 1 件あたりの表示秒数。読み切るには足りないくらいが「次を見たくなる」ちょうどよさ。
      secondsPerItem: 45,
      // ツイートを X の公式ウィジェットで埋め込むか。false ならリンクカードで表示する。
      showTweetEmbed: true,
      // カーソルを乗せている間は自動送りを止める。
      pauseOnHover: true,
    },
    collect: {
      // 起動時と、この間隔ごとに自動で集め直す。
      intervalMinutes: 90,
      // プールに貯める上限。多いほど多様性の余地が増える。
      poolSize: 600,
      // 一度見た項目をもう一度候補に戻すまでの日数。0 なら二度と出さない。
      reshowAfterDays: 60,
    },
    rotation: DEFAULT_WEIGHTS,
    sources: sourceDefaults(),
  };
}

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (base && typeof base === 'object' && override && typeof override === 'object') {
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
      out[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return out;
  }
  return override === undefined ? base : override;
}

export function loadConfig(configPath = CONFIG_PATH) {
  const defaults = defaultConfig();
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return deepMerge(defaults, raw);
  } catch (error) {
    throw new Error(`config.json を読めませんでした: ${error.message}`);
  }
}

export function writeExampleConfig(targetPath = path.join(ROOT, 'config.example.json')) {
  fs.writeFileSync(targetPath, `${JSON.stringify(defaultConfig(), null, 2)}\n`, 'utf8');
  return targetPath;
}
