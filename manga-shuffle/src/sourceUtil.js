import { parseFeed } from './feed.js';

export { fetchText, fetchJson, HttpError } from './http.js';

/** フィードが壊れていても収集全体を巻き込まないようにする。 */
export function parseFeedSafe(xml) {
  try {
    return parseFeed(xml);
  } catch {
    return [];
  }
}
