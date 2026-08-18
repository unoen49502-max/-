const el = (id) => document.getElementById(id);

const ui = {
  progress: el('progress'),
  bar: el('progress-bar'),
  card: el('card'),
  cardImage: el('card-image'),
  cardMedia: document.querySelector('.card-media'),
  cardBadges: el('card-badges'),
  cardTitle: el('card-title'),
  cardSummary: el('card-summary'),
  cardSource: el('card-source'),
  cardPopularity: el('card-popularity'),
  cardDate: el('card-date'),
  cardLink: el('card-link'),
  tweet: el('tweet'),
  tweetBadges: el('tweet-badges'),
  tweetMount: el('tweet-mount'),
  tweetLink: el('tweet-link'),
  empty: el('empty'),
  emptyDetail: el('empty-detail'),
  stats: el('stats'),
  statsBars: el('stats-bars'),
  statsSummary: el('stats-summary'),
  statsLogs: el('stats-logs'),
  toast: el('toast'),
  seconds: el('seconds'),
  secondsLabel: el('seconds-label'),
  btnFav: el('btn-fav'),
};

const state = {
  history: [],      // 表示済み（クライアント側の「戻る」用）
  cursor: -1,
  paused: false,
  seconds: 45,
  elapsed: 0,
  favorites: new Set(),
  timer: null,
};

function toast(message, ms = 2200) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { ui.toast.hidden = true; }, ms);
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok && res.status !== 202) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function show(section) {
  for (const node of [ui.card, ui.tweet, ui.empty]) node.hidden = node !== section;
}

function badgeHtml(item) {
  const labels = item.genreLabels || [];
  return labels.map((label, index) =>
    `<span class="badge${index === 0 ? '' : ' sub'}">${escapeHtml(label)}</span>`).join('');
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderCard(item) {
  ui.cardBadges.innerHTML = badgeHtml(item);
  ui.cardTitle.textContent = item.title || '(無題)';
  ui.cardSummary.textContent = item.summary || '';
  ui.cardSource.textContent = item.source || '';
  ui.cardPopularity.textContent = item.popularityLabel || '';
  ui.cardDate.textContent = formatDate(item.publishedAt);
  ui.cardLink.href = item.url;
  if (item.image) {
    ui.cardImage.src = item.image;
    ui.cardMedia.classList.remove('is-empty');
    ui.card.classList.remove('no-media');
    ui.cardImage.onerror = () => {
      // 画像を出せないサイトは珍しくないので、黙って文字だけの表示に落とす。
      ui.cardMedia.classList.add('is-empty');
      ui.card.classList.add('no-media');
    };
  } else {
    ui.cardImage.removeAttribute('src');
    ui.cardMedia.classList.add('is-empty');
    ui.card.classList.add('no-media');
  }
  show(ui.card);
}

let widgetsPromise = null;
function loadWidgets() {
  if (widgetsPromise) return widgetsPromise;
  widgetsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.onload = () => resolve(window.twttr);
    script.onerror = () => reject(new Error('widgets.js を読み込めませんでした'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('widgets.js がタイムアウトしました')), 8000);
  }).catch((error) => { widgetsPromise = null; throw error; });
  return widgetsPromise;
}

async function renderTweet(item) {
  ui.tweetBadges.innerHTML = badgeHtml(item);
  ui.tweetLink.href = item.url;
  ui.tweetMount.textContent = '';
  show(ui.tweet);
  try {
    const twttr = await loadWidgets();
    await twttr.widgets.createTweet(item.tweetId, ui.tweetMount, {
      theme: 'dark', lang: 'ja', dnt: true, align: 'center',
    });
    // 埋め込みが空で返る（削除・非公開）ことがあるので、その場合はカードに落とす。
    if (!ui.tweetMount.childElementCount) renderCard(item);
  } catch {
    renderCard(item);
  }
}

function render(item) {
  ui.btnFav.classList.toggle('active', state.favorites.has(item.id));
  ui.btnFav.textContent = state.favorites.has(item.id) ? '★' : '☆';
  if (item.kind === 'tweet' && item.tweetId && state.showTweetEmbed !== false) renderTweet(item);
  else renderCard(item);
}

function current() {
  return state.history[state.cursor] || null;
}

function resetTimer() {
  state.elapsed = 0;
  ui.bar.style.width = '0%';
}

async function advance() {
  // 「戻る」で過去に居るときは、まず前に見たものを順に辿る。
  if (state.cursor < state.history.length - 1) {
    state.cursor += 1;
    render(current());
    resetTimer();
    return;
  }
  try {
    const data = await api('/api/next');
    if (!data.item) {
      ui.emptyDetail.textContent = data.reason || 'プールが空です。';
      show(ui.empty);
      return;
    }
    if (data.display) applyDisplay(data.display);
    state.history.push(data.item);
    if (state.history.length > 200) state.history.shift();
    state.cursor = state.history.length - 1;
    render(data.item);
    resetTimer();
  } catch (error) {
    toast(`取得に失敗しました: ${error.message}`);
  }
}

function back() {
  if (state.cursor <= 0) { toast('これ以上戻れません'); return; }
  state.cursor -= 1;
  render(current());
  resetTimer();
}

function applyDisplay(display) {
  state.pauseOnHover = display.pauseOnHover !== false;
  state.showTweetEmbed = display.showTweetEmbed !== false;
  if (display.secondsPerItem && !state.userChangedSeconds) {
    setSeconds(display.secondsPerItem, false);
  }
}

function setSeconds(value, persist = true) {
  state.seconds = value;
  ui.seconds.value = String(value);
  ui.secondsLabel.textContent = `${value}秒`;
  if (persist) api('/api/display', { method: 'POST', body: { secondsPerItem: value } }).catch(() => {});
}

function togglePause(force) {
  state.paused = force === undefined ? !state.paused : force;
  ui.progress.classList.toggle('paused', state.paused);
  el('btn-pause').textContent = state.paused ? '▶' : '⏸';
}

function tick() {
  if (state.paused || document.hidden) return;
  state.elapsed += 0.25;
  const ratio = Math.min(1, state.elapsed / state.seconds);
  ui.bar.style.width = `${ratio * 100}%`;
  if (ratio >= 1) advance();
}

async function toggleFavorite() {
  const item = current();
  if (!item) return;
  const on = !state.favorites.has(item.id);
  try {
    const result = await api('/api/favorite', { method: 'POST', body: { id: item.id, on } });
    if (result.favorited) state.favorites.add(item.id);
    else state.favorites.delete(item.id);
    render(item);
    toast(result.favorited ? 'お気に入りに入れました' : 'お気に入りから外しました');
  } catch (error) {
    toast(`失敗: ${error.message}`);
  }
}

async function skipItem() {
  const item = current();
  if (!item) return;
  await api('/api/skip', { method: 'POST', body: { id: item.id } }).catch(() => {});
  advance();
}

async function refreshStats() {
  const stats = await api('/api/stats');
  const maxShown = Math.max(1, ...stats.genres.map((g) => g.shown));
  ui.statsSummary.textContent =
    `表示 ${stats.shownTotal} 件 / 候補 ${stats.poolAvailable} 件（全 ${stats.poolTotal} 件）`
    + `${stats.lastCollectedAt ? ` / 最終収集 ${formatDate(stats.lastCollectedAt)}` : ''}`
    + `${stats.xReadsToday ? ` / X 読み取り 本日 ${stats.xReadsToday} 件` : ''}`;
  ui.statsBars.innerHTML = stats.genres.map((g) => `
    <div class="bar-row${g.shown === 0 ? ' unseen' : ''}">
      <div class="bar-head">
        <span>${escapeHtml(g.label)}</span>
        <span class="count">${g.shown} 回 / 候補 ${g.inPool}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(g.shown / maxShown) * 100}%"></div></div>
    </div>`).join('') || '<p class="panel-note">まだ記録がありません。</p>';
  const { logs } = await api('/api/logs');
  ui.statsLogs.textContent = logs.slice(-25)
    .map((entry) => `${entry.at.slice(11, 19)} ${entry.message}`).join('\n');
}

function toggleStats(force) {
  const open = force === undefined ? ui.stats.hidden : force;
  ui.stats.hidden = !open;
  if (open) refreshStats().catch((error) => toast(error.message));
}

async function refreshSources() {
  toast('集め直しています…');
  await api('/api/refresh', { method: 'POST' }).catch(() => {});
  setTimeout(() => { refreshStats().catch(() => {}); toast('収集が進行中です（統計パネルで進捗を確認できます）'); }, 1500);
}

function bind() {
  el('btn-next').onclick = () => advance();
  el('btn-prev').onclick = back;
  el('btn-pause').onclick = () => togglePause();
  el('btn-fav').onclick = toggleFavorite;
  el('btn-skip').onclick = skipItem;
  el('btn-refresh').onclick = refreshSources;
  el('btn-stats').onclick = () => toggleStats();
  el('stats-close').onclick = () => toggleStats(false);
  el('empty-refresh').onclick = refreshSources;
  el('btn-reset-history').onclick = async () => {
    await api('/api/reset-history', { method: 'POST' });
    toast('表示履歴をリセットしました');
    refreshStats().catch(() => {});
  };
  ui.seconds.oninput = () => {
    state.userChangedSeconds = true;
    setSeconds(Number(ui.seconds.value));
  };

  document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT') return;
    const actions = {
      ' ': () => togglePause(),
      ArrowRight: () => advance(),
      ArrowLeft: back,
      f: toggleFavorite,
      F: toggleFavorite,
      x: skipItem,
      X: skipItem,
      r: refreshSources,
      R: refreshSources,
      s: () => toggleStats(),
      S: () => toggleStats(),
      o: () => { const item = current(); if (item) window.open(item.url, '_blank', 'noopener'); },
      O: () => { const item = current(); if (item) window.open(item.url, '_blank', 'noopener'); },
      Escape: () => toggleStats(false),
    };
    const action = actions[event.key];
    if (action) { event.preventDefault(); action(); }
  });

  const stage = document.getElementById('stage');
  stage.addEventListener('mouseenter', () => {
    // 読んでいる途中で切り替わるのが一番いらつくので、カーソルを乗せている間は止める。
    if (state.pauseOnHover && !state.paused) { state.hoverPaused = true; togglePause(true); }
  });
  stage.addEventListener('mouseleave', () => {
    if (state.hoverPaused) { state.hoverPaused = false; togglePause(false); }
  });
}

async function init() {
  bind();
  const { favorites } = await api('/api/favorites').catch(() => ({ favorites: [] }));
  for (const item of favorites) state.favorites.add(item.id);
  setSeconds(state.seconds, false);
  await advance();
  state.timer = setInterval(tick, 250);
}

init().catch((error) => {
  ui.emptyDetail.textContent = `起動に失敗しました: ${error.message}`;
  show(ui.empty);
});
