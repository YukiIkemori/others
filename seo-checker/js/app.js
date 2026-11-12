import { CONFIG } from './config.js';
import { fetchResource, dnsLookup, runPsi, looksLikeHtml, looksLikeRobots, looksLikeSitemap } from './fetcher.js';
import { analyze, CATS, width } from './analyze.js';

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

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const u = parseTarget($('#url').value);
  if (!u) return showNotice('error', 'URL の形式が正しくありません。https://example.com/ のように入力してください。');
  store.set('psikey', $('#psikey').value.trim());
  store.set('proxy', $('#proxy').value.trim());
  const strategy = document.querySelector('input[name=strategy]:checked').value;
  store.set('strategy', strategy);
  history.replaceState(null, '', '?url=' + encodeURIComponent(u.href));
  run(u, { strategy, paste: $('#paste').value.trim() });
});

function showNotice(kind, text, list) {
  const n = $('#notice');
  n.hidden = false;
  n.className = 'notice' + (kind === 'error' ? ' error' : '');
  n.replaceChildren(text, list && list.length ? h('ul', null, list.map((x) => h('li', null, x))) : '');
}

// ---------- 進捗 ----------
const STEPS = [['html', 'ページ取得'], ['robots', 'robots.txt'], ['sitemap', 'サイトマップ'], ['dns', 'DNS'], ['psi', '表示速度（Google）']];
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

  const steps = { html: 'run', robots: 'run', sitemap: 'run', dns: 'run', psi: strategy === 'off' ? 'skip' : 'run' };
  ctx = {
    url, strategy, html: '', doc: null,
    robots: { state: 'pending' }, sitemap: { state: 'pending' }, dns: { state: 'pending' },
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
  await Promise.allSettled([pCrawl, pDns, pPsi]);
  if (alive() && report && report.overall != null) saveHistory(ctx.url.href, report.overall);
}

// ---------- 描画 ----------
const tone = (s) => (s == null ? 'na' : s >= 80 ? 'pass' : s >= 50 ? 'warn' : 'fail');
const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i', na: '–' };
const STATUS_JA = { pass: '合格', warn: '要改善', fail: '問題あり', info: '参考', na: '対象外', pending: '確認中' };

function render() {
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
          h('button', { class: 'btn', type: 'button', onclick: (e) => copyText(location.href, e.target) }, '結果ページの URL をコピー')))),
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
  const a = h('a', { href: URL.createObjectURL(blob), download: `seo-${ctx.url.hostname}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 履歴 ----------
function saveHistory(url, sc) {
  const list = store.get('history', []).filter((x) => x.url !== url);
  list.unshift({ url, score: sc, at: Date.now() });
  store.set('history', list.slice(0, 8));
  renderHistory();
}
function renderHistory() {
  const list = store.get('history', []);
  const box = $('#history');
  box.hidden = !list.length;
  if (!list.length) return;
  box.replaceChildren('最近の診断:', ...list.map((x) => h('button', { class: 'chip', type: 'button', title: x.url, onclick: () => { $('#url').value = x.url; $('#form').requestSubmit(); } },
    x.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), h('b', { class: 'c-' + tone(x.score) }, x.score))));
}
renderHistory();

// ?url= 付きで開かれたら自動で診断する
const initial = new URLSearchParams(location.search).get('url');
if (initial && parseTarget(initial)) {
  $('#url').value = initial;
  $('#form').requestSubmit();
}
