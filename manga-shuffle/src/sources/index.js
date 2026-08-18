import { hatena } from './hatena.js';
import { rss } from './rss.js';
import { x } from './x.js';

export const SOURCES = [hatena, rss, x];

export function sourceDefaults() {
  return Object.fromEntries(SOURCES.map((s) => [s.id, structuredClone(s.defaults)]));
}
