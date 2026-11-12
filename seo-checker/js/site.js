// サイト全体診断: サイトマップと内部リンクから複数ページを巡回し、
// ページごとの採点に加えて「ページをまたいだ問題」（重複タイトル・リンク切れなど）を検出する。
import { fetchResource, checkLinks, linkState, looksLikeHtml, looksLikeRobots, looksLikeSitemap } from './fetcher.js';
import { analyze, normUrl, gradeOf } from './analyze.js';

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|zip|gz|mp4|mp3|mov|css|js|json|xml|txt|docx?|xlsx?|pptx?|rss|atom)$/i;
const bare = (h) => h.replace(/^www\./, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CONCURRENCY = 4;
const LINK_CHECK_MAX = 180;

function parseSitemap(text) {
  try {
    const x = new DOMParser().parseFromString(text, 'text/xml');
    if (x.querySelector('parsererror')) return null;
    return { kind: x.documentElement.localName, locs: [...x.getElementsByTagName('loc')].map((l) => l.textContent.trim()) };
  } catch {
    return null;
  }
}

/**
 * @param {URL} start
 * @param {{proxy:string, limit:number, onProgress:(p:object)=>void, alive:()=>boolean, stopped:()=>boolean}} o
 */
export async function auditSite(start, o) {
  const { proxy, limit } = o;
  const host = bare(start.hostname);
  const onSite = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && bare(x.hostname) === host; } catch { return false; } };
  const crawlable = (u) => onSite(u) && !SKIP_EXT.test(new URL(u).pathname);

  // ---- 1. robots.txt とサイトマップ ----
  o.onProgress({ phase: 'discover' });
  const rb = await fetchResource(start.origin + '/robots.txt', { proxy, validate: looksLikeRobots });
  const robots = rb.ok ? { state: 'ok', text: rb.text } : { state: 'missing' };
  const listed = rb.ok ? (rb.text.match(/^\s*sitemap\s*:\s*(\S+)/gim) || []).map((l) => l.replace(/^\s*sitemap\s*:\s*/i, '').trim()) : [];
  const cands = [...new Set([...listed.slice(0, 3), start.origin + '/sitemap.xml', start.origin + '/sitemap_index.xml'])].filter((c) => /^https?:\/\//i.test(c));
  const sitemap = { found: false, urls: [], files: [], truncated: false };
  for (const c of cands.slice(0, 4)) {
    if (!o.alive()) return null;
    const r = await fetchResource(c, { proxy, validate: looksLikeSitemap });
    const p = r.ok && parseSitemap(r.text);
    if (!p) continue;
    sitemap.found = true;
    sitemap.files.push(c);
    if (p.kind === 'sitemapindex') {
      const kids = p.locs.slice(0, 5);
      sitemap.truncated = p.locs.length > kids.length;
      const rs = await Promise.all(kids.map((k) => fetchResource(k, { proxy, validate: looksLikeSitemap })));
      rs.forEach((k, i) => { const kp = k.ok && parseSitemap(k.text); if (kp) { sitemap.files.push(kids[i]); sitemap.urls.push(...kp.locs); } });
    } else sitemap.urls.push(...p.locs);
    if (sitemap.urls.length) break;
  }
  const smSet = new Set(sitemap.urls.map(normUrl));

  // ---- 2. 巡回キュー: 開始ページ → サイトマップ（浅い階層から） → 見つけた内部リンク ----
  const seen = new Set();
  const queue = [];
  const enqueue = (u, from) => {
    const n = normUrl(u);
    if (seen.has(n) || !crawlable(u)) return;
    seen.add(n);
    queue.push({ url: u, from });
  };
  enqueue(start.href, 'start');
  const depth = (u) => { try { return new URL(u).pathname.split('/').filter(Boolean).length; } catch { return 99; } };
  [...new Set(sitemap.urls)].filter(crawlable).sort((a, b) => depth(a) - depth(b) || a.length - b.length).slice(0, 3000).forEach((u) => enqueue(u, 'sitemap'));

  const pages = [];
  const byNorm = new Map(); // 正規化 URL → ページ（リダイレクト先も含めて引けるようにする）
  let started = 0;
  let inflight = 0;
  let next = 0;

  const auditPage = async (item) => {
    const r = await fetchResource(item.url, { proxy, validate: looksLikeHtml });
    const pg = { url: item.url, from: item.from, inSitemap: smSet.has(normUrl(item.url)), ok: false, links: [], issues: [] };
    if (!r.ok) {
      pg.status = r.status || 0;
      pg.error = r.notFound ? '404 Not Found' : (r.errors[r.errors.length - 1] || '取得失敗');
      pg.broken = !!r.notFound || pg.status >= 400;
      return pg;
    }
    pg.status = r.headers ? r.status : 200;
    pg.finalUrl = r.finalUrl || item.url;
    pg.redirected = normUrl(pg.finalUrl) !== normUrl(item.url);
    if (pg.redirected) {
      pg.offsite = !onSite(pg.finalUrl);
      const dupe = byNorm.get(normUrl(pg.finalUrl));
      // リダイレクト先が診断済み（または別サイト）なら、同じ内容を二重に数えない
      if (dupe || pg.offsite) { pg.ok = true; pg.alias = true; return pg; }
      seen.add(normUrl(pg.finalUrl));
    }
    let url;
    try { url = new URL(pg.finalUrl); url.hash = ''; } catch { url = new URL(item.url); }
    const rep = analyze({
      url, html: r.text, htmlBytes: r.bytes, doc: new DOMParser().parseFromString(r.text, 'text/html'),
      status: r.headers ? r.status : 0, headers: r.headers || null, redirects: r.redirects || null,
      robots, sitemap: { state: 'skipped' }, dns: { state: 'skipped' }, psi: { state: 'skipped' },
    });
    const d = rep.data;
    const st = (id) => (rep.checks.find((c) => c.id === id) || {}).status;
    Object.assign(pg, {
      ok: true, score: rep.overall, grade: rep.grade, title: d.title || '', desc: d.description || '', h1: d.h1 || '',
      canonical: d.canonical || '', textCount: d.textCount || 0, via: r.via,
      noindex: st('noindex') === 'fail' || st('x-robots') === 'fail', blocked: st('robots') === 'fail', thin: st('text') === 'fail',
      canonicalElsewhere: !!d.canonical && normUrl(d.canonical) !== normUrl(url.href),
      issues: rep.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => ({ key: c.cat + '/' + c.id, cat: c.cat, title: c.title, status: c.status, weight: c.weight, fix: c.fix })),
      links: (d.linkList || []).filter((l) => l.internal).map((l) => l.url),
    });
    return pg;
  };

  const worker = async () => {
    for (;;) {
      if (!o.alive() || o.stopped() || started >= limit) return;
      const item = queue[next];
      if (!item) { if (!inflight) return; await sleep(120); continue; } // 他のワーカーがリンクを追加するのを待つ
      next++; started++; inflight++;
      try {
        const pg = await auditPage(item);
        pages.push(pg);
        byNorm.set(normUrl(pg.url), pg);
        if (pg.finalUrl && !pg.alias) byNorm.set(normUrl(pg.finalUrl), pg);
        pg.links.forEach((l) => enqueue(l, 'link'));
      } catch (e) {
        pages.push({ url: item.url, from: item.from, ok: false, status: 0, error: String(e && e.message || e), links: [], issues: [] });
      } finally {
        inflight--;
      }
      o.onProgress({ phase: 'crawl', done: pages.length, total: Math.min(limit, queue.length), current: item.url });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (!o.alive()) return null;

  // ---- 3. 内部リンク切れ: 巡回済みページは結果を流用し、未巡回のリンク先だけ追加で確認する ----
  const sources = new Map(); // リンク先 → リンク元ページ
  for (const pg of pages) for (const l of pg.links) {
    const n = normUrl(l);
    if (!sources.has(n)) sources.set(n, { url: l, from: [] });
    const s = sources.get(n);
    if (s.from.length < 5 && !s.from.includes(pg.url)) s.from.push(pg.url);
  }
  const unknown = [...sources.entries()].filter(([n]) => !byNorm.has(n)).map(([, s]) => s.url);
  const toCheck = unknown.slice(0, LINK_CHECK_MAX);
  let linkCheck = { available: false, checked: 0, skipped: unknown.length };
  const broken = [];
  for (const pg of pages) if (pg.broken && sources.has(normUrl(pg.url))) broken.push({ url: pg.url, status: pg.status || 404, from: sources.get(normUrl(pg.url)).from });
  if (toCheck.length && !o.stopped()) {
    o.onProgress({ phase: 'links', done: 0, total: toCheck.length });
    const res = await checkLinks(toCheck, { proxy, alive: o.alive, onProgress: (done, total) => o.onProgress({ phase: 'links', done, total }) });
    if (res) {
      linkCheck = { available: true, checked: res.length, skipped: unknown.length - toCheck.length };
      for (const r of res) if (linkState(r) === 'broken') broken.push({ url: r.url, status: r.status, error: r.error, from: (sources.get(normUrl(r.url)) || { from: [] }).from });
    }
  } else if (!toCheck.length) linkCheck = { available: true, checked: 0, skipped: 0 };
  if (!o.alive()) return null;

  return summarize({ start, pages, robots, sitemap, smSet, sources, broken, linkCheck, limit, more: queue.length - next });
}

// =====================================================================
function summarize({ start, pages, robots, sitemap, smSet, sources, broken, linkCheck, limit, more }) {
  const real = pages.filter((p) => p.ok && !p.alias);
  const indexable = real.filter((p) => !p.noindex && !p.blocked && !p.canonicalElsewhere);
  const checks = [];
  const add = (id, title, status, weight, msg, fix = '', items = null) => checks.push({ cat: 'site', id, title, status, weight, msg, fix, items });
  const path = (u) => { try { const x = new URL(u); return decodeURI(x.pathname) + x.search; } catch { return u; } };
  const n = Math.max(indexable.length, 1);

  // 重複（インデックス対象ページ同士で比較）
  const dup = (field, id, title, weight, fix) => {
    const m = new Map();
    for (const p of indexable) if (p[field]) m.set(p[field], [...(m.get(p[field]) || []), p]);
    const groups = [...m.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
    const count = groups.reduce((s, [, v]) => s + v.length, 0);
    add(id, title, !groups.length ? 'pass' : count / n > 0.15 ? 'fail' : 'warn', weight,
      groups.length ? `${groups.length} 種類の文言が計 ${count} ページで重複しています。` : '重複はありません。', groups.length ? fix : '',
      groups.slice(0, 8).map(([text, v]) => `「${text.length > 50 ? text.slice(0, 50) + '…' : text}」× ${v.length}: ${v.slice(0, 4).map((p) => path(p.finalUrl || p.url)).join(' , ')}${v.length > 4 ? ' ほか' : ''}`));
  };
  const lack = (field, id, title, weight, fix) => {
    const list = indexable.filter((p) => !p[field]);
    add(id, title, !list.length ? 'pass' : list.length / n > 0.15 ? 'fail' : 'warn', weight,
      list.length ? `${list.length} ページで設定されていません。` : 'すべてのページに設定されています。', list.length ? fix : '', list.slice(0, 15).map((p) => path(p.finalUrl || p.url)));
  };
  if (indexable.length > 1) {
    dup('title', 'dup-title', 'タイトルの重複', 6, 'ページごとに内容を表す固有のタイトルを付ける。同じタイトルのページは検索結果で競合し、どれを出すべきか Google が判断できません。');
    dup('desc', 'dup-desc', 'メタディスクリプションの重複', 4, 'ページごとに固有の description を書く。CMS のテンプレートで全ページ同じ文言になっていないか確認する。');
    dup('h1', 'dup-h1', 'H1 の重複', 2, 'ページごとに主題を表す固有の H1 にする。全ページ共通のロゴやサイト名が H1 になっていないか確認する。');
  }
  if (indexable.length) {
    lack('title', 'no-title', 'タイトル未設定のページ', 6, '該当ページに固有の <title> を設定する。');
    lack('desc', 'no-desc', 'ディスクリプション未設定のページ', 4, '該当ページに meta description を設定する。');
    lack('h1', 'no-h1', 'H1 のないページ', 3, '該当ページに <h1> を1つ置く。');
  }

  // エラー・リダイレクト・インデックス設定
  const errs = pages.filter((p) => p.broken);
  add('errors', 'エラーになるページ', errs.length ? 'fail' : 'pass', 6,
    errs.length ? `${errs.length} ページが 404 などのエラーを返します${errs.some((p) => p.inSitemap) ? '（サイトマップ掲載ページを含む）' : ''}。` : '診断したページはすべて正常に表示されます。',
    errs.length ? 'ページを復旧するか、後継ページへ 301 リダイレクトする。不要ならサイトマップと内部リンクから外す。' : '', errs.slice(0, 15).map((p) => `${p.status || ''} ${path(p.url)}`.trim()));
  const unreachable = pages.filter((p) => !p.ok && !p.broken);
  if (unreachable.length) add('unreachable', '取得できなかったページ', 'info', 0, `${unreachable.length} ページは取得できず、診断対象から除いています（アクセス制限や一時的な失敗）。`, '', unreachable.slice(0, 10).map((p) => path(p.url)));
  const smRedirect = pages.filter((p) => p.inSitemap && p.redirected);
  const smNoindex = real.filter((p) => p.inSitemap && (p.noindex || p.canonicalElsewhere));
  if (sitemap.found) {
    add('sitemap', 'XML サイトマップ', sitemap.urls.length ? 'pass' : 'warn', 3, `${sitemap.urls.length.toLocaleString()} URL を掲載（${sitemap.files.length} ファイル${sitemap.truncated ? '・一部のみ読み込み' : ''}）`, sitemap.urls.length ? '' : 'サイトマップが空です。');
    const bad = [...smRedirect.map((p) => `リダイレクト: ${path(p.url)} → ${path(p.finalUrl)}`), ...smNoindex.map((p) => `${p.noindex ? 'noindex' : 'canonical が別 URL'}: ${path(p.url)}`), ...errs.filter((p) => p.inSitemap).map((p) => `エラー: ${path(p.url)}`)];
    add('sitemap-clean', 'サイトマップの整合性', bad.length ? 'warn' : 'pass', 3,
      bad.length ? `サイトマップに、インデックスされない URL が ${bad.length} 件載っています。` : '診断した範囲では、サイトマップ掲載 URL はすべて正常でインデックス可能です。',
      bad.length ? 'サイトマップには「200 を返す・noindex でない・canonical が自分自身」の URL だけを載せる。' : '', bad.slice(0, 15));
    const missing = indexable.filter((p) => !p.inSitemap && !smSet.has(normUrl(p.finalUrl || p.url)));
    add('sitemap-missing', 'サイトマップ未掲載のページ', missing.length ? 'warn' : 'pass', 2,
      missing.length ? `内部リンクで見つかった ${missing.length} ページがサイトマップに載っていません。` : '診断したページはすべてサイトマップに載っています。',
      missing.length ? 'インデックスさせたいページはサイトマップに追加する（CMS やジェネレーターの出力対象を確認）。' : '', missing.slice(0, 15).map((p) => path(p.finalUrl || p.url)));
  } else add('sitemap', 'XML サイトマップ', 'warn', 3, 'XML サイトマップが見つかりませんでした。内部リンクをたどって巡回しました。', 'sitemap.xml を生成してサイト直下に置き、robots.txt と Search Console で知らせる。');
  if (robots.state === 'missing') add('robots', 'robots.txt', 'warn', 2, 'robots.txt を取得できませんでした。', 'サイト直下に robots.txt を置き、Sitemap: 行でサイトマップの場所を伝える。');

  const ni = real.filter((p) => p.noindex || p.blocked);
  add('noindex', 'インデックスされないページ', ni.length ? 'info' : 'pass', ni.length ? 0 : 1,
    ni.length ? `${ni.length} ページが noindex または robots.txt でブロックされています。意図した設定か確認してください。` : 'noindex・クロール禁止のページはありません。', '', ni.slice(0, 15).map((p) => `${p.noindex ? 'noindex' : 'robots.txt'}: ${path(p.finalUrl || p.url)}`));
  const thin = indexable.filter((p) => p.thin);
  add('thin', '内容の薄いページ', !thin.length ? 'pass' : thin.length / n > 0.2 ? 'fail' : 'warn', 3,
    thin.length ? `${thin.length} ページは本文がごく少量です。` : '本文が極端に少ないページはありません。',
    thin.length ? '独自の情報を足すか、似た内容のページを1つに統合する。価値の薄いページが多いとサイト全体の評価が下がります。' : '', thin.slice(0, 15).map((p) => `${path(p.finalUrl || p.url)}（${p.textCount}）`));

  // リンク切れ
  const scope = linkCheck.available ? `内部リンク先 ${(sources.size - linkCheck.skipped).toLocaleString()} 件を確認${linkCheck.skipped ? `（上限のため ${linkCheck.skipped} 件は未確認）` : ''}` : '巡回したページの範囲のみ確認（この取得経路では未巡回のリンク先を確認できません）';
  add('broken', '内部リンク切れ', broken.length ? 'fail' : linkCheck.available ? 'pass' : 'info', broken.length || linkCheck.available ? 6 : 0,
    broken.length ? `リンク切れの内部リンク先が ${broken.length} 件あります。${scope}` : `リンク切れは見つかりませんでした。${scope}`,
    broken.length ? 'リンク元ページの href を正しい URL に直す。ページを消した場合は後継ページへ 301 リダイレクトする。' : '',
    broken.slice(0, 20).map((b) => `${b.status > 0 ? b.status : '接続不可'} ${path(b.url)} ← ${b.from.slice(0, 3).map(path).join(' , ')}${b.from.length > 3 ? ' ほか' : ''}`));

  // 被リンクのない（孤立）ページ: サイトマップにはあるが、巡回した範囲のどのページからもリンクされていない
  const orphans = real.filter((p) => p.from === 'sitemap' && !sources.has(normUrl(p.url)) && !sources.has(normUrl(p.finalUrl || p.url)));
  if (sitemap.found && real.length > 3) add('orphans', '内部リンクされていないページ', orphans.length ? 'info' : 'pass', orphans.length ? 0 : 1,
    orphans.length ? `${orphans.length} ページは、診断した範囲のどのページからもリンクされていません（未巡回ページからリンクされている可能性はあります）。` : '診断したページはいずれも他のページからリンクされています。',
    '', orphans.slice(0, 15).map((p) => path(p.url)));

  // 多くのページに共通する問題
  const agg = new Map();
  for (const p of real) for (const i of p.issues) {
    const a = agg.get(i.key) || { ...i, pages: [], fails: 0 };
    a.pages.push(p.finalUrl || p.url);
    if (i.status === 'fail') a.fails++;
    agg.set(i.key, a);
  }
  const common = [...agg.values()].map((a) => ({ ...a, impact: a.weight * (a.fails + (a.pages.length - a.fails) * 0.5) }))
    .filter((a) => a.fix).sort((x, y) => y.impact - x.impact).slice(0, 15);

  // スコア: ページ平均 60% + サイト横断チェック 40%
  const scored = real.filter((p) => p.score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : null;
  let got = 0;
  let max = 0;
  for (const c of checks) { if (c.status === 'pass') { got += c.weight; max += c.weight; } else if (c.status === 'warn') { got += c.weight / 2; max += c.weight; } else if (c.status === 'fail') max += c.weight; }
  const cross = max ? Math.round((got / max) * 100) : null;
  const overall = avg == null ? null : cross == null ? avg : Math.round(avg * 0.6 + cross * 0.4);

  return {
    start: start.href, host: start.hostname, pages, checks, common, overall, grade: gradeOf(overall), avg, cross,
    stats: { audited: real.length, total: pages.length, indexable: indexable.length, errors: errs.length, sitemapUrls: sitemap.urls.length, sitemapFound: sitemap.found, limit, more: Math.max(more, 0), via: (real[0] || {}).via || '' },
  };
}
