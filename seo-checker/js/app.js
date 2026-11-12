import { CONFIG } from './config.js';
import { fetchResource, dnsLookup, runPsi, checkLinks, linkState, looksLikeHtml, looksLikeRobots, looksLikeSitemap } from './fetcher.js';
import { analyze, CATS, width } from './analyze.js';
import { auditSite } from './site.js';

const $ = (s) => document.querySelector(s);
// 取得したページ由来の文字列は必ず textContent 経由で入れる（innerHTML は使わない）
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('seo.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('seo.' + k, JSON.stringify(v)); } catch { /* 保存できなくても動作に影響なし */ } },
};

const ui = { filter: 'all', tab: 'outline', open: new Set() };
let runId = 0;
let ctx = null;
let report = null;
let view = 'page'; // page | site
let site = null;
let stopFlag = false;
const LINK_MAX = 60; // 1ページ診断で確認するリンク数の上限

// ---------- 入力 ----------
function parseTarget(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    u.hash = '';
    return u;
  } catch {
    return null;
  }
}

$('#psikey').value = store.get('psikey', '');
$('#proxy').value = store.get('proxy', '');
const savedStrategy = store.get('strategy', 'mobile');
document.querySelectorAll('input[name=strategy]').forEach((r) => { r.checked = r.value === savedStrategy; });
const MAX_PAGES = 50; // サイト全体診断の上限（無料枠の消費を抑えるため）
$('#limit').value = String(Math.min(store.get('limit', 50), MAX_PAGES) === 25 ? 25 : 50);

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const u = parseTarget($('#url').value);
  if (!u) return showNotice('error', 'URL の形式が正しくありません。https://example.com/ のように入力してください。');
  store.set('psikey', $('#psikey').value.trim());
  store.set('proxy', $('#proxy').value.trim());
  const strategy = document.querySelector('input[name=strategy]:checked').value;
  store.set('strategy', strategy);
  const mode = document.querySelector('input[name=mode]:checked').value;
  const limit = Math.min(Number($('#limit').value) || 50, MAX_PAGES);
  store.set('limit', limit);
  history.replaceState(null, '', '?url=' + encodeURIComponent(u.href) + (mode === 'site' ? '&mode=site' : ''));
  if (mode === 'site') runSite(u, limit);
  else run(u, { strategy, paste: $('#paste').value.trim() });
});

function showNotice(kind, text, list) {
  const n = $('#notice');
  n.hidden = false;
  n.className = 'notice' + (kind === 'error' ? ' error' : '');
  n.replaceChildren(text, list && list.length ? h('ul', null, list.map((x) => h('li', null, x))) : '');
}

// ---------- 進捗 ----------
const STEPS = [['html', 'ページ取得'], ['robots', 'robots.txt'], ['sitemap', 'サイトマップ'], ['links', 'リンク切れ'], ['dns', 'DNS'], ['psi', '表示速度（Google）']];
function renderProgress(state) {
  const p = $('#progress');
  p.hidden = false;
  p.replaceChildren(...STEPS.map(([k, name]) => {
    const s = state[k];
    return h('span', { class: 'step ' + (s === 'done' ? 'done' : s === 'err' || s === 'skip' ? 'err' : '') },
      s === 'run' ? h('span', { class: 'spin' }) : s === 'done' ? '✓' : s === 'skip' ? '–' : '!', name);
  }));
  if (Object.values(state).every((s) => s !== 'run')) setTimeout(() => { if (p.dataset.run === String(runId)) p.hidden = true; }, 1200);
  p.dataset.run = String(runId);
}

// ---------- 実行 ----------
async function run(url, { strategy, paste }) {
  const id = ++runId;
  const alive = () => id === runId;
  const proxy = $('#proxy').value.trim() || CONFIG.PROXY_URL;
  const key = $('#psikey').value.trim() || CONFIG.PSI_API_KEY;
  $('#go').disabled = true;
  $('#notice').hidden = true;
  $('#result').hidden = true;
  ui.open.clear();
  view = 'page';

  const steps = { html: 'run', robots: 'run', sitemap: 'run', links: 'run', dns: 'run', psi: strategy === 'off' ? 'skip' : 'run' };
  ctx = {
    url, strategy, html: '', doc: null,
    robots: { state: 'pending' }, sitemap: { state: 'pending' }, dns: { state: 'pending' }, linkCheck: { state: 'pending' },
    psi: { state: strategy === 'off' ? 'skipped' : 'pending' },
  };
  renderProgress(steps);
  const update = (k, v) => { if (!alive()) return; steps[k] = v; renderProgress(steps); if (ctx.ready) render(); };

  // 1) ページ本体
  const pHtml = (async () => {
    let r;
    if (paste) r = { ok: true, text: paste, bytes: new Blob([paste]).size, via: '貼り付け', errors: [] };
    else r = await fetchResource(url.href, { proxy, validate: looksLikeHtml });
    if (!alive()) return;
    if (r.ok) {
      if (r.finalUrl) { try { const f = new URL(r.finalUrl); f.hash = ''; if (/^https?:$/.test(f.protocol)) ctx.url = f; } catch { /* そのまま */ } }
      ctx.html = r.text;
      ctx.htmlBytes = r.bytes;
      ctx.doc = new DOMParser().parseFromString(r.text, 'text/html');
      ctx.via = r.via;
      ctx.status = r.status && r.headers ? r.status : 0;
      ctx.headers = r.headers || null;
      ctx.redirects = r.redirects || null;
      ctx.fetchMs = r.ms;
    } else {
      ctx.fetchErrors = r.errors;
      showNotice('warn', r.notFound
        ? 'ページが見つかりませんでした（404）。URL を確認してください。'
        : 'ページの HTML を取得できませんでした。HTML を使う項目は省略し、取得できた情報だけで採点しています。「設定」から HTML を貼り付けると全項目を診断できます。', r.errors.slice(0, 6));
    }
    ctx.ready = true;
    update('html', r.ok ? 'done' : 'err');
  })();

  // 1b) リンク切れ（HTML が取れてから。内部リンクを優先して上限まで確認）
  const pLinks = pHtml.then(async () => {
    if (!alive()) return;
    const all = ctx.doc ? (analyze(ctx).data.linkList || []) : [];
    if (!all.length) { ctx.linkCheck = ctx.doc ? { state: 'ok', results: [], skipped: 0 } : null; return update('links', ctx.doc ? 'done' : 'skip'); }
    const pick = [...all.filter((l) => l.internal), ...all.filter((l) => !l.internal)].slice(0, LINK_MAX).map((l) => l.url);
    ctx.linkCheck = { state: 'pending', total: pick.length, done: 0 };
    const res = await checkLinks(pick, { proxy, alive, onProgress: (done) => { ctx.linkCheck.done = done; update('links', 'run'); } });
    if (!alive()) return;
    ctx.linkCheck = res ? { state: 'ok', results: res.map((r) => ({ ...r, state: linkState(r) })), skipped: all.length - pick.length } : { state: 'na' };
    update('links', res ? 'done' : 'skip');
  });

  // 2) robots.txt → サイトマップ
  const pCrawl = (async () => {
    const rb = await fetchResource(url.origin + '/robots.txt', { proxy, validate: looksLikeRobots });
    if (!alive()) return;
    ctx.robots = rb.ok ? { state: 'ok', text: rb.text } : { state: 'missing' };
    update('robots', rb.ok ? 'done' : 'err');
    const listed = rb.ok ? (rb.text.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map((l) => l.replace(/^\s*sitemap\s*:\s*/i, '').trim()) : [];
    const cands = [...new Set([...listed.slice(0, 2), url.origin + '/sitemap.xml', url.origin + '/sitemap_index.xml'])].filter((c) => /^https?:\/\//i.test(c)).slice(0, 3);
    let found = null;
    for (const c of cands) {
      const sm = await fetchResource(c, { proxy, validate: looksLikeSitemap });
      if (!alive()) return;
      if (sm.ok) { found = { state: 'ok', url: c, text: sm.text }; break; }
    }
    ctx.sitemap = found || { state: 'missing' };
    update('sitemap', found ? 'done' : 'err');
  })();

  // 3) DNS
  const pDns = dnsLookup(url.hostname).then(
    (d) => { ctx.dns = { state: 'ok', ...d }; update('dns', 'done'); },
    () => { ctx.dns = { state: 'error' }; update('dns', 'err'); });

  // 4) PageSpeed Insights（時間がかかるので他の結果を先に表示する）
  const pPsi = strategy === 'off' ? Promise.resolve() : runPsi(url.href, { key, strategy }).then(
    (d) => { ctx.psi = { state: 'ok', data: d }; update('psi', 'done'); },
    (e) => { ctx.psi = { state: 'error', error: { code: e.code, message: e.name === 'AbortError' ? 'タイムアウトしました' : e.message } }; update('psi', 'err'); });

  await pHtml;
  if (alive()) $('#go').disabled = false;
  await Promise.allSettled([pCrawl, pDns, pPsi, pLinks]);
  if (alive() && report && report.overall != null) saveHistory(ctx.url.href, report.overall);
}

// ---------- 描画 ----------
const tone = (s) => (s == null ? 'na' : s >= 80 ? 'pass' : s >= 50 ? 'warn' : 'fail');
const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i', na: '–' };
const STATUS_JA = { pass: '合格', warn: '要改善', fail: '問題あり', info: '参考', na: '対象外', pending: '確認中' };

function render() {
  if (view === 'site') return renderSite();
  report = analyze(ctx);
  document.body.classList.add('has-result');
  const root = $('#result');
  root.hidden = false;
  root.replaceChildren(summaryCard(), todoCard(), previewCard(), checksCard(), dataCard());
}

function summaryCard() {
  const { overall, grade, cats, checks, capped } = report;
  const n = (st) => checks.filter((c) => c.status === st).length;
  const pending = checks.some((c) => c.status === 'pending');
  const R = 64;
  const C = 2 * Math.PI * R;
  const t = tone(overall);
  const headline = overall == null ? (ctx.ready && !ctx.doc ? 'ページを取得できなかったため総合点は出せません' : '採点できる情報がありません') : capped ? '検索結果に表示されない設定になっています'
    : overall >= 90 ? 'とても良い状態です' : overall >= 75 ? '良好。あと少しで万全です' : overall >= 55 ? '改善の余地があります' : '基本的な対策が不足しています';
  return h('div', { class: 'card' },
    h('div', { class: 'summary' },
      h('div', { class: 'ring', role: 'img', 'aria-label': `総合スコア ${overall ?? '-'} 点` },
        svg('svg', { width: 148, height: 148, viewBox: '0 0 148 148' },
          svg('circle', { cx: 74, cy: 74, r: R, fill: 'none', stroke: 'var(--soft)', 'stroke-width': 11 }),
          svg('circle', { cx: 74, cy: 74, r: R, fill: 'none', stroke: `var(--${t === 'na' ? 'line' : t})`, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-dasharray': `${(C * (overall || 0)) / 100} ${C}` })),
        h('div', { class: 'num' }, h('b', { class: 'c-' + t }, overall ?? '–'), h('span', null, `/ 100　評価 ${grade}`))),
      h('div', null,
        h('p', { class: 'sum-url' }, ctx.url.href),
        h('p', { class: 'sum-head' }, headline),
        h('p', { class: 'sum-text' }, pending ? '一部の項目を確認中です。完了するとスコアが更新されます。'
          : capped ? 'noindex や robots.txt のブロックなど、検索に出なくなる致命的な問題があるため、総合スコアを 45 点に制限しています。'
            : `${checks.filter((c) => ['pass', 'warn', 'fail'].includes(c.status)).length} 項目を採点しました。${ctx.via ? `（取得経路: ${ctx.via}）` : ''}`),
        h('div', { class: 'counts' },
          h('span', { class: 'pill fail' }, `問題あり ${n('fail')}`), h('span', { class: 'pill warn' }, `要改善 ${n('warn')}`),
          h('span', { class: 'pill pass' }, `合格 ${n('pass')}`), pending ? h('span', { class: 'pill info' }, h('span', { class: 'spin' }), ' 確認中') : null),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: copyMarkdown }, 'レポートをコピー'),
          h('button', { class: 'btn', type: 'button', onclick: downloadJson }, 'JSON 保存'),
          h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '印刷 / PDF'),
          h('button', { class: 'btn', type: 'button', onclick: (e) => copyText(location.href, e.target) }, '結果ページの URL をコピー'),
          h('button', { class: 'btn', type: 'button', onclick: () => { document.querySelector('input[name=mode][value=site]').checked = true; $('#form').requestSubmit(); } }, 'サイト全体を診断')))),
    h('div', { class: 'cats', style: 'margin-top:20px' }, CATS.map((c) => {
      const s = cats[c.id];
      const tt = tone(s.score);
      return h('a', { class: 'cat', href: '#cat-' + c.id },
        h('span', { class: 'cat-name' }, c.name),
        h('span', { class: 'cat-score c-' + tt }, s.score == null ? (s.pending ? h('span', { class: 'spin' }) : '–') : s.score),
        h('span', { class: 'bar' }, h('i', { class: 'bg-' + tt, style: `width:${s.score || 0}%` })));
    })));
}
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

function priorities() {
  const cw = Object.fromEntries(CATS.map((c) => [c.id, c.w]));
  return report.checks.filter((c) => (c.status === 'fail' || c.status === 'warn') && c.fix)
    .map((c) => ({ ...c, pri: (c.critical ? 100 : 0) + c.weight * (c.status === 'fail' ? 1 : 0.5) * (cw[c.cat] / 10) }))
    .sort((a, b) => b.pri - a.pri);
}
function todoCard() {
  const list = priorities().slice(0, 8);
  const name = Object.fromEntries(CATS.map((c) => [c.id, c.name]));
  return h('div', { class: 'card' }, h('h2', null, '優先して直すべき改善点'),
    list.length ? h('ol', { class: 'todo' }, list.map((c) => h('li', null, h('div', null,
      h('h3', null, c.title, h('span', { class: 'pill ' + c.status }, STATUS_JA[c.status]), h('span', { class: 'tag' }, name[c.cat])),
      h('p', null, c.msg), h('p', { class: 'fix' }, '→ ' + c.fix)))))
      : h('p', { class: 'sum-text' }, report.checks.some((c) => c.status === 'pending') ? '確認中です…' : '大きな改善点は見つかりませんでした。'));
}

function previewCard() {
  const d = report.data;
  if (!ctx.doc) return '';
  const trunc = (s, w) => { let n = 0; let out = ''; for (const ch of s) { n += width(ch); if (n > w) return out + '…'; out += ch; } return out; };
  const u = ctx.url;
  const crumb = [u.hostname, ...u.pathname.split('/').filter(Boolean).slice(0, 3)].join(' › ');
  const og = d.og || {};
  let img = null;
  if (/^https:\/\//i.test(og['og:image'] || '')) {
    img = h('img', { src: og['og:image'], alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith('画像を読み込めませんでした'));
  }
  return h('div', { class: 'card' }, h('h2', null, '表示プレビュー'),
    h('div', { class: 'previews' },
      h('div', { class: 'serp' }, h('p', { class: 'pv-label' }, 'Google 検索結果（イメージ）'),
        h('div', { class: 'serp-site' }, crumb),
        h('div', { class: 'serp-title' }, d.title ? trunc(d.title, 64) : '（タイトルなし）'),
        h('div', { class: 'serp-desc' }, d.description ? trunc(d.description, 240) : '（description なし — Google が本文から自動で抜粋します）')),
      h('div', null, h('p', { class: 'pv-label' }, 'SNS でシェアされたとき（イメージ）'),
        h('div', { class: 'ogc' },
          h('div', { class: 'ogc-img' }, img || 'og:image なし'),
          h('div', { class: 'ogc-body' }, h('b', null, trunc(og['og:title'] || d.title || '（タイトルなし）', 80)), h('span', null, og['og:site_name'] || u.hostname))))));
}

function checksCard() {
  const want = (c) => ui.filter === 'all' || c.status === ui.filter;
  const fbtn = (k, label) => h('button', { type: 'button', 'aria-pressed': String(ui.filter === k), onclick: () => { ui.filter = k; render(); } }, label);
  const cnt = (st) => report.checks.filter((c) => c.status === st).length;
  return h('div', { class: 'card' }, h('h2', null, 'すべての診断項目'),
    h('div', { class: 'filters' }, fbtn('all', `すべて ${report.checks.length}`), fbtn('fail', `問題あり ${cnt('fail')}`), fbtn('warn', `要改善 ${cnt('warn')}`), fbtn('pass', `合格 ${cnt('pass')}`)),
    CATS.map((cat) => {
      const list = report.checks.filter((c) => c.cat === cat.id);
      const shown = list.filter(want);
      if (!list.length || (ui.filter !== 'all' && !shown.length)) return h('div', { id: 'cat-' + cat.id });
      const s = report.cats[cat.id].score;
      return h('div', { class: 'group', id: 'cat-' + cat.id },
        h('h3', null, cat.name, h('span', { class: 'c-' + tone(s) }, s == null ? '–' : `${s} 点`)),
        h('p', null, cat.desc),
        shown.map(checkRow));
    }));
}
function checkRow(c) {
  const key = c.cat + '/' + c.id;
  const hasBody = c.fix || (c.items && c.items.length);
  const d = h('details', { class: 'chk', open: ui.open.has(key) },
    h('summary', null,
      h('span', { class: 'ico ' + c.status, title: STATUS_JA[c.status] }, c.status === 'pending' ? h('span', { class: 'spin' }) : ICON[c.status]),
      h('span', { class: 'chk-title' }, c.title, h('span', { class: 'sr' }, `（${STATUS_JA[c.status]}）`), h('span', { class: 'chk-msg' }, c.msg))),
    hasBody ? h('div', { class: 'chk-body' },
      c.fix ? h('p', { class: 'fix' }, h('b', null, '改善方法'), c.fix) : null,
      c.items && c.items.length ? h('ul', null, c.items.map((i) => h('li', null, i))) : null) : null);
  d.addEventListener('toggle', () => (d.open ? ui.open.add(key) : ui.open.delete(key)));
  return d;
}

function dataCard() {
  const d = report.data;
  const tabs = [];
  if (d.headings) tabs.push(['outline', '見出し構成', () => (d.headings.length
    ? h('ul', { class: 'outline' }, d.headings.slice(0, 150).map((x) => h('li', { style: `padding-left:${(x.level - 1) * 18}px` }, h('span', { class: 'tag' }, 'h' + x.level), x.text || '（空）')))
    : h('p', { class: 'sum-text' }, '見出しがありません。'))]);
  if (d.keywords && d.keywords.length) tabs.push(['kw', '頻出語', () => h('div', { class: 'scroll' }, h('table', null,
    h('thead', null, h('tr', null, ['語句', '出現数', 'タイトル', 'H1', '説明文'].map((x) => h('th', null, x)))),
    h('tbody', null, d.keywords.map((k) => h('tr', null, h('td', null, k.word), h('td', { class: 'n' }, k.count),
      ...[k.inTitle, k.inH1, k.inDesc].map((b) => h('td', { class: b ? 'c-pass' : 'c-na' }, b ? '✓' : '–')))))))]);
  if (ctx.doc) tabs.push(['facts', 'ページ情報', () => h('dl', { class: 'kv' }, [
    ['最終 URL', ctx.url.href], ['canonical', d.canonical || 'なし'], ['言語', d.lang || '未指定'], ['meta robots', d.metaRobots || '指定なし'],
    ['本文量', d.textAmount], ['リンク', d.links ? `内部 ${d.links.internal}（ユニーク ${d.links.uniqueInternal}）／外部 ${d.links.external}／nofollow ${d.links.nofollow}` : '-'],
    ['画像', d.images ? `${d.images.total} 枚` : '-'], ['外部リソース', d.resources ? `JS ${d.resources.scripts}／CSS ${d.resources.css}／iframe ${d.resources.iframes}` : '-'],
    ['構造化データ', d.jsonld && (d.jsonld.types.length ? d.jsonld.types.join(', ') : d.jsonld.microdata ? `microdata ${d.jsonld.microdata} 件` : 'なし')],
    ['サイトマップ', d.sitemap ? `${d.sitemap.url}（${d.sitemap.count} 件）` : '未検出'],
    ['HTML 取得', `${ctx.via}${ctx.fetchMs ? `・${ctx.fetchMs}ms` : ''}・${Math.round((ctx.htmlBytes || 0) / 1024)} KB`],
  ].flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v || '-')]))]);
  if (d.lighthouse) tabs.push(['lh', 'Lighthouse の指摘', () => h('div', null,
    h('div', { class: 'lh' }, [['performance', '速度'], ['seo', 'SEO'], ['accessibility', 'アクセシビリティ'], ['bestPractices', 'ベストプラクティス']].map(([k, n]) =>
      h('div', null, h('b', { class: 'c-' + (d.lighthouse[k] == null ? 'na' : d.lighthouse[k] >= 90 ? 'pass' : d.lighthouse[k] >= 50 ? 'warn' : 'fail') }, d.lighthouse[k] ?? '–'), h('span', null, n)))),
    d.lhFailed && d.lhFailed.length ? h('div', { class: 'scroll' }, h('table', null,
      h('thead', null, h('tr', null, ['分類', '指摘', '値'].map((x) => h('th', null, x)))),
      h('tbody', null, d.lhFailed.map((f) => h('tr', null, h('td', { class: 'n' }, f.cat), h('td', null, f.title), h('td', { class: 'n' }, f.value))))))
      : h('p', { class: 'sum-text' }, '不合格の監査項目はありません。'))]);
  if (d.robots) tabs.push(['robots', 'robots.txt', () => h('pre', null, d.robots.text)]);
  if (!tabs.length) return '';
  if (!tabs.some((t) => t[0] === ui.tab)) ui.tab = tabs[0][0];
  const cur = tabs.find((t) => t[0] === ui.tab);
  return h('div', { class: 'card' }, h('h2', null, '詳細データ'),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, name]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === ui.tab), onclick: () => { ui.tab = k; render(); } }, name))),
    h('div', { role: 'tabpanel' }, cur[2]()));
}

// ---------- サイト全体診断 ----------
async function runSite(url, limit) {
  const id = ++runId;
  const alive = () => id === runId;
  const proxy = $('#proxy').value.trim() || CONFIG.PROXY_URL;
  stopFlag = false;
  view = 'site';
  site = null;
  ui.open.clear();
  $('#go').disabled = true;
  $('#notice').hidden = true;
  $('#result').hidden = true;
  const p = $('#progress');
  p.hidden = false;
  delete p.dataset.run;
  const stop = h('button', { class: 'btn', type: 'button', onclick: () => { stopFlag = true; stop.disabled = true; stop.textContent = '中止しています…'; } }, 'ここまでの結果で中止');
  const label = h('span', null, 'サイトマップを確認しています…');
  const bar = h('i', { style: 'width:0%' });
  p.replaceChildren(h('div', { class: 'crawl' }, h('div', { class: 'crawl-head' }, h('span', { class: 'spin' }), label, stop), h('span', { class: 'bar' }, bar)));
  const onProgress = (s) => {
    if (!alive()) return;
    if (s.phase === 'crawl') { label.textContent = `ページを診断中… ${s.done} / ${s.total}`; bar.style.width = `${Math.round((s.done / Math.max(s.total, 1)) * 90)}%`; }
    else if (s.phase === 'links') { label.textContent = `リンク切れを確認中… ${s.done} / ${s.total}`; bar.style.width = `${90 + Math.round((s.done / Math.max(s.total, 1)) * 10)}%`; }
  };
  let res = null;
  try {
    res = await auditSite(url, { proxy, limit, onProgress, alive, stopped: () => stopFlag });
  } catch (e) {
    if (alive()) showNotice('error', 'サイト全体診断の途中でエラーが発生しました: ' + (e && e.message ? e.message : e));
  }
  if (!alive()) return;
  $('#go').disabled = false;
  p.hidden = true;
  if (!res) return;
  site = res;
  if (!res.stats.audited) {
    showNotice('error', 'ページを1つも取得できませんでした。URL を確認するか、時間をおいて試してください。' + (res.stats.via ? '' : ' 公開プロキシ経由の場合は失敗しやすいため、Cloudflare Pages へのデプロイを推奨します。'));
    return;
  }
  render();
  if (res.overall != null) saveHistory(res.start, res.overall, 'site');
}

function renderSite() {
  document.body.classList.add('has-result');
  const root = $('#result');
  root.hidden = false;
  root.replaceChildren(siteSummary(), siteChecks(), siteCommon(), sitePages());
}
function ring(overall, grade) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const t = tone(overall);
  return h('div', { class: 'ring', role: 'img', 'aria-label': `総合スコア ${overall ?? '-'} 点` },
    svg('svg', { width: 148, height: 148, viewBox: '0 0 148 148' },
      svg('circle', { cx: 74, cy: 74, r: R, fill: 'none', stroke: 'var(--soft)', 'stroke-width': 11 }),
      svg('circle', { cx: 74, cy: 74, r: R, fill: 'none', stroke: `var(--${t === 'na' ? 'line' : t})`, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-dasharray': `${(C * (overall || 0)) / 100} ${C}` })),
    h('div', { class: 'num' }, h('b', { class: 'c-' + t }, overall ?? '–'), h('span', null, `/ 100　評価 ${grade}`)));
}
function siteSummary() {
  const s = site.stats;
  const n = (st) => site.checks.filter((c) => c.status === st).length;
  const o = site.overall;
  const headline = o >= 90 ? 'サイト全体としてとても良い状態です' : o >= 75 ? '良好。いくつか直せば万全です' : o >= 55 ? 'サイト全体に改善の余地があります' : 'サイト全体で基本的な対策が不足しています';
  const stat = (v, label, t) => h('div', null, h('b', { class: t ? 'c-' + t : '' }, v), h('span', null, label));
  return h('div', { class: 'card' },
    h('div', { class: 'summary' }, ring(o, site.grade),
      h('div', null,
        h('p', { class: 'sum-url' }, `${site.host} — サイト全体診断`),
        h('p', { class: 'sum-head' }, headline),
        h('p', { class: 'sum-text' }, `${s.audited} ページを診断しました${stopFlag ? '（途中で中止）' : ''}。${s.more > 0 ? `上限 ${s.limit} ページに達したため、見つかった残り ${s.more.toLocaleString()} ページ以上は未診断です。` : 'サイトマップと内部リンクから見つかったページをすべて診断しました。'}総合点はページ平均（6割）とサイト横断チェック（4割）から算出しています。表示速度はサイト全体診断では計測しません。`),
        h('div', { class: 'counts' }, h('span', { class: 'pill fail' }, `問題あり ${n('fail')}`), h('span', { class: 'pill warn' }, `要改善 ${n('warn')}`), h('span', { class: 'pill pass' }, `合格 ${n('pass')}`)),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: (e) => copyText(siteMarkdown(), e.target) }, 'レポートをコピー'),
          h('button', { class: 'btn', type: 'button', onclick: downloadCsv }, 'ページ一覧を CSV 保存'),
          h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '印刷 / PDF')))),
    h('div', { class: 'lh', style: 'margin:20px 0 0' },
      stat(site.avg ?? '–', 'ページ平均点', tone(site.avg)), stat(site.cross ?? '–', 'サイト横断チェック', tone(site.cross)),
      stat(s.audited, '診断ページ数'), stat(s.errors, 'エラーページ', s.errors ? 'fail' : ''), stat(s.sitemapFound ? s.sitemapUrls.toLocaleString() : 'なし', 'サイトマップ掲載 URL')));
}
function siteChecks() {
  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  const list = [...site.checks].sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);
  return h('div', { class: 'card' }, h('h2', null, 'サイト全体の問題（ページをまたぐチェック）'), list.map(checkRow));
}
function siteCommon() {
  if (!site.common.length) return '';
  const name = Object.fromEntries(CATS.map((c) => [c.id, c.name]));
  const pathOf = (u) => { try { const x = new URL(u); return decodeURI(x.pathname) + x.search; } catch { return u; } };
  return h('div', { class: 'card' }, h('h2', null, '多くのページに共通する改善点'),
    h('p', { class: 'sum-text' }, '該当ページ数と重要度の高い順です。テンプレートを1か所直せばまとめて解消できるものが多いので、上から対応すると効率的です。'),
    site.common.map((c) => {
      const key = 'common/' + c.key;
      const d = h('details', { class: 'chk', open: ui.open.has(key) },
        h('summary', null, h('span', { class: 'ico ' + (c.fails ? 'fail' : 'warn') }, c.fails ? ICON.fail : ICON.warn),
          h('span', { class: 'chk-title' }, c.title, ' ', h('span', { class: 'tag' }, name[c.cat]),
            h('span', { class: 'chk-msg' }, `${c.pages.length} / ${site.stats.audited} ページが該当`))),
        h('div', { class: 'chk-body' }, h('p', { class: 'fix' }, h('b', null, '改善方法'), c.fix),
          h('ul', null, c.pages.slice(0, 12).map((u) => h('li', null, pathOf(u))), c.pages.length > 12 ? h('li', null, `ほか ${c.pages.length - 12} ページ`) : null)));
      d.addEventListener('toggle', () => (d.open ? ui.open.add(key) : ui.open.delete(key)));
      return d;
    }));
}
function sitePages() {
  const rows = [...site.pages].filter((p) => !p.alias).sort((a, b) => (a.ok ? a.score ?? 0 : -1) - (b.ok ? b.score ?? 0 : -1));
  const pathOf = (u) => { try { const x = new URL(u); return (decodeURI(x.pathname) + x.search) || '/'; } catch { return u; } };
  return h('div', { class: 'card' }, h('h2', null, `ページ別の結果（点数の低い順・${rows.length} ページ）`),
    h('p', { class: 'sum-text' }, 'URL を押すと、そのページの詳細診断（表示速度を含む）を新しいタブで開きます。'),
    h('div', { class: 'scroll' }, h('table', { class: 'pages' },
      h('thead', null, h('tr', null, ['点数', 'URL', 'タイトル', '問題', '備考'].map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((p) => {
        const u = p.finalUrl || p.url;
        const notes = [p.broken ? `エラー ${p.status || ''}` : !p.ok ? '取得不可' : '', p.noindex ? 'noindex' : '', p.blocked ? 'robots.txt 禁止' : '', p.canonicalElsewhere ? 'canonical 別URL' : '', p.redirected ? 'リダイレクト' : '', p.ok && !p.inSitemap && site.stats.sitemapFound ? 'サイトマップ外' : ''].filter(Boolean);
        const f = p.issues.filter((i) => i.status === 'fail').length;
        const w = p.issues.length - f;
        return h('tr', null,
          h('td', { class: 'n' }, p.ok ? h('b', { class: 'c-' + tone(p.score) }, p.score ?? '–') : h('b', { class: 'c-fail' }, '✕')),
          h('td', { class: 'u' }, h('a', { href: '?url=' + encodeURIComponent(u), target: '_blank', rel: 'noopener' }, pathOf(u))),
          h('td', { class: 't' }, p.ok ? (p.title || h('span', { class: 'c-fail' }, '（なし）')) : (p.error || '')),
          h('td', { class: 'n' }, p.ok ? [f ? h('span', { class: 'c-fail' }, `✕${f} `) : '', w ? h('span', { class: 'c-warn' }, `!${w}`) : ''] : ''),
          h('td', { class: 'small' }, notes.join('・')));
      })))));
}
function siteMarkdown() {
  const L = ['# サイト全体 SEO 診断レポート', '', `- サイト: ${site.host}`, `- 総合スコア: **${site.overall ?? '-'} / 100**（評価 ${site.grade}）`, `- ページ平均: ${site.avg ?? '-'} ／ サイト横断チェック: ${site.cross ?? '-'}`, `- 診断ページ数: ${site.stats.audited}`, `- 診断日: ${new Date().toLocaleDateString('ja-JP')}`, '', '## サイト全体の問題', ''];
  for (const c of site.checks) {
    L.push(`- [${STATUS_JA[c.status]}] **${c.title}**: ${c.msg}${c.fix ? `\n  - 改善方法: ${c.fix}` : ''}`);
    (c.items || []).slice(0, 10).forEach((i) => L.push(`  - ${i}`));
  }
  L.push('', '## 多くのページに共通する改善点', '');
  site.common.forEach((c, i) => L.push(`${i + 1}. **${c.title}** — ${c.pages.length} ページ`, `   - 改善方法: ${c.fix}`));
  L.push('', '## ページ別スコア', '', '| 点数 | URL | タイトル |', '|---|---|---|');
  for (const p of [...site.pages].filter((x) => x.ok && !x.alias).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))) L.push(`| ${p.score ?? '-'} | ${p.finalUrl || p.url} | ${(p.title || '').replace(/\|/g, '/')} |`);
  return L.join('\n');
}
function downloadCsv() {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['URL', '点数', 'ステータス', 'タイトル', 'ディスクリプション', 'H1', 'canonical', 'noindex', '本文量', '問題あり', '要改善', '指摘内容']];
  for (const p of site.pages.filter((x) => !x.alias)) rows.push([p.finalUrl || p.url, p.ok ? p.score : '', p.ok ? p.status : (p.status || 'error'), p.title, p.desc, p.h1, p.canonical, p.noindex ? 'yes' : '', p.textCount,
    p.issues.filter((i) => i.status === 'fail').length, p.issues.filter((i) => i.status === 'warn').length, p.issues.map((i) => i.title).join(' / ')]);
  saveBlob(new Blob(['\ufeff' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }), `seo-site-${site.host}.csv`);
}
function saveBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 書き出し ----------
function markdown() {
  const L = [`# SEO 診断レポート`, '', `- URL: ${ctx.url.href}`, `- 総合スコア: **${report.overall ?? '-'} / 100**（評価 ${report.grade}）`, `- 診断日: ${new Date().toLocaleDateString('ja-JP')}`, '', '## カテゴリ別スコア', ''];
  for (const c of CATS) L.push(`- ${c.name}: ${report.cats[c.id].score ?? '-'}`);
  L.push('', '## 優先して直すべき改善点', '');
  priorities().forEach((c, i) => L.push(`${i + 1}. **${c.title}**（${STATUS_JA[c.status]}）— ${c.msg}`, `   - 改善方法: ${c.fix}`));
  L.push('', '## 全項目', '');
  for (const cat of CATS) {
    L.push(`### ${cat.name}`, '');
    for (const c of report.checks.filter((k) => k.cat === cat.id)) L.push(`- [${STATUS_JA[c.status]}] ${c.title}: ${c.msg}`);
    L.push('');
  }
  return L.join('\n');
}
async function copyText(text, btn) {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'コピーしました'; } catch { btn.textContent = 'コピーできませんでした'; }
  setTimeout(() => { btn.textContent = label; }, 1600);
}
function copyMarkdown(e) { copyText(markdown(), e.target); }
function downloadJson() {
  const blob = new Blob([JSON.stringify({ url: ctx.url.href, date: new Date().toISOString(), overall: report.overall, grade: report.grade, categories: report.cats, checks: report.checks, data: report.data }, null, 2)], { type: 'application/json' });
  saveBlob(blob, `seo-${ctx.url.hostname}.json`);
}

// ---------- 履歴 ----------
function saveHistory(url, sc, mode = 'page') {
  const list = store.get('history', []).filter((x) => !(x.url === url && (x.mode || 'page') === mode));
  list.unshift({ url, score: sc, mode, at: Date.now() });
  store.set('history', list.slice(0, 8));
  renderHistory();
}
function renderHistory() {
  const list = store.get('history', []);
  const box = $('#history');
  box.hidden = !list.length;
  if (!list.length) return;
  box.replaceChildren('最近の診断:', ...list.map((x) => h('button', { class: 'chip', type: 'button', title: x.url, onclick: () => { $('#url').value = x.url; document.querySelector(`input[name=mode][value=${x.mode === 'site' ? 'site' : 'page'}]`).checked = true; $('#form').requestSubmit(); } },
    (x.mode === 'site' ? '【全体】' : '') + x.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), h('b', { class: 'c-' + tone(x.score) }, x.score))));
}
renderHistory();

// ?url= 付きで開かれたら自動で診断する
const params = new URLSearchParams(location.search);
const initial = params.get('url');
if (initial && parseTarget(initial)) {
  $('#url').value = initial;
  if (params.get('mode') === 'site') document.querySelector('input[name=mode][value=site]').checked = true;
  $('#form').requestSubmit();
}
