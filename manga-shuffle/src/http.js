const UA = 'manga-shuffle/0.1 (personal reader; +https://github.com/)';

export class HttpError extends Error {
  constructor(status, url, body = '') {
    super(`HTTP ${status} for ${url}`);
    this.status = status;
    this.url = url;
    this.body = body.slice(0, 400);
  }
}

/** タイムアウトと素朴な再試行つきの fetch。フィード取得はこれ経由に統一する。 */
export async function fetchText(url, {
  timeoutMs = 15000, retries = 2, headers = {}, backoffMs = 800,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: '*/*', ...headers },
        signal: controller.signal,
        redirect: 'follow',
      });
      const body = await res.text();
      if (!res.ok) {
        const err = new HttpError(res.status, url, body);
        // 4xx は再試行しても同じなので即座に諦める（429 だけは待って再試行）。
        if (res.status < 500 && res.status !== 429) throw err;
        lastError = err;
      } else {
        return body;
      }
    } catch (error) {
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, backoffMs * (2 ** attempt)));
    }
  }
  throw lastError;
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, { accept: 'application/json', ...options });
  return JSON.parse(text);
}
