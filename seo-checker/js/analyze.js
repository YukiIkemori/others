// 診断ロジック本体。ctx（取得済みの材料）から checks（判定一覧）とスコアを組み立てる純粋な処理。
// 材料が後から届く（PageSpeed など）たびに呼び直せるよう、副作用を持たない。

export const CATS = [
  { id: 'basic', name: '基本メタ情報', w: 20, desc: 'title・description・canonical など検索結果の土台' },
  { id: 'content', name: 'コンテンツ', w: 15, desc: '見出し構造・文章量・キーワード・信頼性シグナル' },
  { id: 'index', name: 'クロール・インデックス', w: 20, desc: 'robots・サイトマップ・URL・リダイレクト' },
  { id: 'links', name: 'リンク・画像', w: 10, desc: '内部リンク・アンカーテキスト・alt・画像最適化' },
  { id: 'social', name: 'SNS・構造化データ', w: 10, desc: 'OGP・X カード・JSON-LD' },
  { id: 'tech', name: '技術・セキュリティ', w: 10, desc: 'HTTPS・ヘッダー・HTML 品質・DNS' },
  { id: 'perf', name: '表示速度・Lighthouse', w: 15, desc: 'Core Web Vitals と Google Lighthouse の評価' },
];

// 全角=2・半角=1 として幅を数える（検索結果での表示幅の近似）
export const width = (s) => {
  let n = 0;
  for (const ch of s) n += /[\u0000-ÿ｡-ﾟ]/.test(ch) ? 1 : 2;
  return n;
};
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const cut = (s, n = 90) => (s.length > n ? s.slice(0, n) + '…' : s);
export const normUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol + '//' + x.host.toLowerCase() + x.pathname.replace(/\/+$/, '') + x.search;
  } catch {
    return u;
  }
};

// ---------- robots.txt ----------
export function parseRobots(txt) {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  let lastUA = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastUA) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastUA = true;
    } else if (key === 'allow' || key === 'disallow') {
      if (cur) cur.rules.push({ allow: key === 'allow', path: val });
      lastUA = false;
    } else if (key === 'sitemap') {
      sitemaps.push(val);
    } else lastUA = false;
  }
  return { groups, sitemaps };
}
export function rulesFor(parsed, ua) {
  ua = ua.toLowerCase();
  let best = null;
  let bestLen = -1;
  for (const g of parsed.groups) {
    for (const a of g.agents) {
      const len = a === '*' ? 0 : ua.includes(a) ? a.length : -1;
      if (len > bestLen) { best = [g]; bestLen = len; } else if (len === bestLen && len >= 0) best.push(g);
    }
  }
  return best ? best.flatMap((g) => g.rules) : [];
}
export function robotsAllows(rules, path) {
  let best = null;
  let bestLen = -1;
  for (const r of rules) {
    if (!r.path) continue;
    const anchored = r.path.endsWith('$');
    const body = anchored ? r.path.slice(0, -1) : r.path;
    const re = new RegExp('^' + body.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
    if (!re.test(path)) continue;
    if (r.path.length > bestLen || (r.path.length === bestLen && r.allow)) { best = r; bestLen = r.path.length; }
  }
  return { allowed: !best || best.allow, rule: best };
}

// ---------- 構造化データ ----------
const LD_REQUIRED = {
  Article: ['headline', 'image', 'datePublished', 'author'],
  NewsArticle: ['headline', 'image', 'datePublished', 'author'],
  BlogPosting: ['headline', 'image', 'datePublished', 'author'],
  Product: ['name', ['offers', 'review', 'aggregateRating']],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  Organization: ['name', 'url'],
  Corporation: ['name', 'url'],
  LocalBusiness: ['name', 'address'],
  WebSite: ['name', 'url'],
  Event: ['name', 'startDate', 'location'],
  Recipe: ['name', 'image'],
  VideoObject: ['name', 'thumbnailUrl', 'uploadDate'],
  JobPosting: ['title', 'description', 'datePosted', 'hiringOrganization'],
};
function ldNodes(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => ldNodes(n, out));
  else if (node && typeof node === 'object') {
    if (node['@type']) out.push(node);
    if (node['@graph']) ldNodes(node['@graph'], out);
  }
  return out;
}

// ---------- キーワード抽出 ----------
const STOP = new Set(('the and for are but not you all can was one our out has have this that with from they will your what when how about more ' +
  'www com http https html こと もの これ それ ため よう など さん から まで です ます する いる ある なる れる られる ない できる について として による において 場合 以下 以上').split(' '));
function topKeywords(text, lang) {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return [];
  const seg = new Intl.Segmenter(lang || 'ja', { granularity: 'word' });
  const m = new Map();
  for (const s of seg.segment(text.slice(0, 80000))) {
    if (!s.isWordLike) continue;
    const w = s.segment.toLowerCase();
    if (w.length < 2 || /^[\d.,]+$/.test(w) || /^[ぁ-んー]+$/.test(w) || STOP.has(w)) continue;
    if (/^[a-z]+$/.test(w) && w.length < 3) continue;
    m.set(w, (m.get(w) || 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count }));
}

const GENERIC_ANCHOR = /^(こちら|ここ|詳細|詳しく|詳しくはこちら|詳細はこちら|もっと見る|続きを読む|クリック|リンク|click here|here|more|read more|learn more|details|link)$/i;
const TRUST_LINK = /(会社概要|運営者|運営会社|企業情報|私たちについて|お問い?合わせ|プライバシー|個人情報|利用規約|特定商取引|about|contact|privacy|terms|company)/i;

// =====================================================================
export function analyze(ctx) {
  const checks = [];
  const data = {};
  const add = (cat, id, title, status, weight, msg, fix = '', items = null, critical = false) =>
    checks.push({ cat, id, title, status, weight, msg, fix, items, critical });

  const url = ctx.url;
  const page = normUrl(url.href);

  // ---------- URL ----------
  {
    const problems = [];
    const path = decodeURIComponentSafe(url.pathname);
    if (url.href.length > 115) problems.push(`URL が長い（${url.href.length}文字）`);
    if (/[A-Z]/.test(url.pathname)) problems.push('パスに大文字を含む（大文字小文字違いの重複URLの原因になりやすい）');
    if (/_/.test(url.pathname)) problems.push('単語区切りにアンダースコア（_）を使用。ハイフン（-）が推奨');
    if ([...url.searchParams].length > 2) problems.push(`クエリパラメータが多い（${[...url.searchParams].length}個）`);
    if (/(sessionid|sid|phpsessid|jsessionid)=/i.test(url.search)) problems.push('セッションIDらしきパラメータを含む');
    if (path.split('/').filter(Boolean).length > 5) problems.push('階層が深い（6階層以上）');
    if (/\s|%20/.test(url.pathname)) problems.push('パスに空白を含む');
    add('index', 'url', 'URL の構造', problems.length ? 'warn' : 'pass', 2,
      problems.length ? 'URL に改善余地があります。' : '短く整理された URL です。',
      problems.length ? '新規ページでは短く・小文字・ハイフン区切りの URL にする。既存 URL を変える場合は必ず 301 リダイレクトを設定する。' : '', problems);
  }
  add('tech', 'https', 'HTTPS', url.protocol === 'https:' ? 'pass' : 'fail', 5,
    url.protocol === 'https:' ? 'HTTPS で配信されています。' : 'HTTP（暗号化なし）で配信されています。ブラウザに「保護されていない通信」と表示され、検索順位にも不利です。',
    'SSL 証明書を導入し、HTTP から HTTPS へ 301 リダイレクトする。');

  if (ctx.doc) htmlChecks(ctx, add, data, page);
  crawlChecks(ctx, add, data, page);
  headerChecks(ctx, add);
  dnsChecks(ctx, add);
  psiChecks(ctx, add, data);

  const sc = score(checks);
  // HTML を取得できなかった場合、残りの数項目だけで総合点を出すと誤解を招くので出さない
  if (!ctx.doc) { sc.overall = null; sc.grade = '-'; sc.capped = false; }
  return { checks, data, ...sc };
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// =====================================================================
function htmlChecks(ctx, add, data, page) {
  const { doc, url, html } = ctx;
  const q = (s) => [...doc.querySelectorAll(s)];
  const meta = (name) => {
    const el = q('meta').find((m) => (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase() === name);
    return el ? clean(el.getAttribute('content')) : '';
  };
  const baseHref = (doc.querySelector('base[href]') || { getAttribute: () => null }).getAttribute('href');
  let base = url.href;
  try { if (baseHref) base = new URL(baseHref, url.href).href; } catch { /* ignore */ }
  const abs = (h) => { try { return new URL(h, base); } catch { return null; } };

  // ----- 本文テキスト -----
  let text = '';
  if (doc.body) {
    const c = doc.body.cloneNode(true);
    c.querySelectorAll('script,style,noscript,template,svg,iframe').forEach((e) => e.remove());
    text = clean(c.textContent);
  }
  const compact = text.replace(/\s/g, '');
  const cjk = (compact.match(/[぀-ヿ一-鿿]/g) || []).length;
  const lang = (doc.documentElement.getAttribute('lang') || '').trim();
  const isJa = /^ja/i.test(lang) || (compact.length > 0 && cjk / compact.length > 0.2);
  data.lang = lang;
  data.isJa = isJa;

  // ----- title -----
  const titles = q('head title');
  const title = titles.length ? clean(titles[0].textContent) : '';
  data.title = title;
  if (!title) {
    add('basic', 'title', 'タイトルタグ', 'fail', 6, '<title> がありません（または空です）。検索結果の見出しになる最重要要素です。',
      'ページ内容を表す固有のタイトルを設定する。主要キーワードを前方に置き、全角30文字前後に収める。');
  } else {
    const w = width(title);
    const zen = Math.round(w / 2);
    let st = 'pass';
    let msg = `「${cut(title, 70)}」（全角換算 約${zen}文字）— 適切な長さです。`;
    let fix = '';
    if (w < 20) { st = 'warn'; msg = `「${title}」（全角換算 約${zen}文字）— 短すぎて内容が伝わりにくいです。`; fix = '検索語句とページの価値が伝わるよう、全角15〜32文字程度に増やす。'; }
    else if (w > 80) { st = 'warn'; msg = `「${cut(title, 70)}」（全角換算 約${zen}文字）— 長すぎて検索結果で末尾が省略されます。`; fix = '重要な語句を前半に寄せ、全角32文字前後に短縮する。'; }
    else if (w > 66) { msg = `「${cut(title, 70)}」（全角換算 約${zen}文字）— やや長め。検索結果で末尾が省略される可能性があります。`; }
    if (/^(home|ホーム|トップ|トップページ|無題|untitled|index|新しいページ)$/i.test(title)) {
      st = 'fail'; msg = `「${title}」— 内容が分からない汎用的なタイトルです。`; fix = 'サイト名＋何のサイトかが分かる固有のタイトルに変える。';
    }
    add('basic', 'title', 'タイトルタグ', st, 6, msg, fix);
    if (titles.length > 1) add('basic', 'title-dup', 'タイトルタグの重複', 'warn', 2, `<title> が ${titles.length} 個あります。`, '<title> は <head> 内に1つだけにする。');
  }

  // ----- description -----
  const descs = q('meta').filter((m) => (m.getAttribute('name') || '').toLowerCase() === 'description');
  const desc = descs.length ? clean(descs[0].getAttribute('content')) : '';
  data.description = desc;
  if (!desc) {
    add('basic', 'desc', 'メタディスクリプション', 'fail', 5, 'meta description がありません。検索結果の説明文を Google 任せにすることになり、クリック率で損をします。',
      'ページの要点と読むメリットを全角70〜120文字でまとめた description を設定する。');
  } else {
    const w = width(desc);
    const zen = Math.round(w / 2);
    let st = 'pass';
    let msg = `全角換算 約${zen}文字 — 適切な長さです。`;
    let fix = '';
    if (w < 100) { st = 'warn'; msg = `全角換算 約${zen}文字 — 短めです。`; fix = '検索ユーザーがクリックしたくなる情報（何が分かるか・強み）を足して全角70〜120文字にする。'; }
    else if (w > 280) { st = 'warn'; msg = `全角換算 約${zen}文字 — 長すぎて後半が省略されます。`; fix = '重要な内容を前半70文字に入れ、全体を全角120文字前後に短縮する。'; }
    if (title && desc === title) { st = 'warn'; msg = 'タイトルと同じ文言です。'; fix = 'タイトルの繰り返しではなく、内容の要約を書く。'; }
    add('basic', 'desc', 'メタディスクリプション', st, 5, msg, fix, [desc]);
    if (descs.length > 1) add('basic', 'desc-dup', 'ディスクリプションの重複', 'warn', 1, `meta description が ${descs.length} 個あります。`, '1つだけにする。');
  }

  // ----- viewport -----
  const vp = meta('viewport');
  if (!vp) add('basic', 'viewport', 'モバイル対応（viewport）', 'fail', 5, 'viewport の指定がありません。スマホで PC 用の縮小表示になり、モバイルファーストインデックスで不利です。',
    '<meta name="viewport" content="width=device-width, initial-scale=1"> を <head> に追加する。');
  else if (!/width\s*=\s*device-width/i.test(vp)) add('basic', 'viewport', 'モバイル対応（viewport）', 'warn', 5, `viewport に width=device-width がありません（${vp}）。`, 'content を "width=device-width, initial-scale=1" にする。');
  else add('basic', 'viewport', 'モバイル対応（viewport）', 'pass', 5, 'レスポンシブ用の viewport が設定されています。');
  if (vp && (/user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)))
    add('tech', 'zoom', 'ピンチズームの禁止', 'warn', 1, 'viewport でズームが禁止されています。アクセシビリティ上の減点対象です。', 'user-scalable=no と maximum-scale=1 を削除する。');

  // ----- lang / charset / favicon -----
  add('basic', 'lang', '言語指定（html lang）', lang ? 'pass' : 'warn', 2, lang ? `lang="${lang}" が指定されています。` : '<html> に lang 属性がありません。',
    lang ? '' : `<html lang="${isJa ? 'ja' : 'en'}"> のようにページの言語を指定する。`);
  const hasCharset = q('meta[charset]').length > 0 || q('meta').some((m) => /content-type/i.test(m.getAttribute('http-equiv') || ''));
  add('basic', 'charset', '文字コード指定', hasCharset ? 'pass' : 'warn', 1, hasCharset ? '文字コードが宣言されています。' : '<meta charset> がありません。文字化けの原因になります。',
    hasCharset ? '' : '<head> の先頭に <meta charset="utf-8"> を置く。');
  const icon = q('link').some((l) => /(^|\s)icon(\s|$)/i.test(l.getAttribute('rel') || ''));
  add('basic', 'favicon', 'ファビコン', icon ? 'pass' : 'warn', 1, icon ? 'ファビコンが指定されています。' : 'ファビコンの <link> がありません（/favicon.ico を置いていれば問題ありません）。',
    icon ? '' : '<link rel="icon" href="/favicon.ico"> を追加する。検索結果にもサイトアイコンとして表示されます。');

  // ----- canonical -----
  const canons = q('link').filter((l) => (l.getAttribute('rel') || '').toLowerCase().trim() === 'canonical');
  let canonical = '';
  if (!canons.length) {
    add('basic', 'canonical', 'canonical（正規URL）', 'warn', 4, 'canonical が指定されていません。パラメータ付き URL などが重複コンテンツ扱いされる恐れがあります。',
      `<link rel="canonical" href="${url.origin + url.pathname}"> のように、このページの正規 URL を絶対パスで指定する。`);
  } else if (canons.length > 1) {
    add('basic', 'canonical', 'canonical（正規URL）', 'fail', 4, `canonical が ${canons.length} 個あります。複数あると Google はすべて無視します。`, 'canonical は1ページに1つだけにする。',
      canons.map((c) => c.getAttribute('href') || '(空)'));
  } else {
    const href = (canons[0].getAttribute('href') || '').trim();
    const a = abs(href);
    canonical = a ? a.href : '';
    if (!href || !a) add('basic', 'canonical', 'canonical（正規URL）', 'fail', 4, 'canonical の href が空または不正です。', '正しい絶対 URL を指定する。');
    else if (normUrl(a.href) !== page) add('basic', 'canonical', 'canonical（正規URL）', 'warn', 4, `canonical が別の URL を指しています: ${a.href}`,
      '意図した正規化であれば問題ありません。意図していない場合、このページは検索結果に出なくなるので自分自身の URL に直す。');
    else if (!/^https?:\/\//i.test(href)) add('basic', 'canonical', 'canonical（正規URL）', 'warn', 4, `canonical が相対パスです（${href}）。`, '誤解釈を防ぐため絶対 URL（https://〜）で書く。');
    else add('basic', 'canonical', 'canonical（正規URL）', 'pass', 4, '自分自身を指す canonical が設定されています。');
    if (canons[0].closest('body')) add('basic', 'canonical-body', 'canonical の位置', 'warn', 1, 'canonical が <body> 内にあります。<head> 外の canonical は無視されます。', '<head> 内に移動する。');
  }
  data.canonical = canonical;

  // ----- robots meta -----
  const robots = q('meta').filter((m) => /^(robots|googlebot)$/i.test(m.getAttribute('name') || '')).map((m) => (m.getAttribute('content') || '').toLowerCase()).join(',');
  data.metaRobots = robots;
  if (/noindex|none/.test(robots)) add('index', 'noindex', 'インデックス許可（meta robots）', 'fail', 10, `noindex が指定されています（${robots}）。このページは検索結果に表示されません。`,
    '検索に出したいページなら meta robots の noindex を削除する。意図的な非公開ページならこのままで問題ありません。', null, true);
  else add('index', 'noindex', 'インデックス許可（meta robots）', 'pass', 10, robots ? `インデックス可能です（${robots}）。` : 'noindex 指定はなく、インデックス可能です。');
  if (/nofollow/.test(robots)) add('index', 'meta-nofollow', 'リンク評価の受け渡し', 'warn', 2, 'meta robots に nofollow があり、このページ内のすべてのリンクが辿られません。', '特別な理由がなければ nofollow を外す。');
  if (canonical && /noindex/.test(robots) && normUrl(canonical) !== page)
    add('index', 'canon-noindex', 'canonical と noindex の併用', 'warn', 1, 'noindex と別URLへの canonical が同時に指定され、シグナルが矛盾しています。', 'どちらか一方に統一する。');

  // ----- 見出し -----
  const heads = q('h1,h2,h3,h4,h5,h6').map((h) => ({ level: Number(h.tagName[1]), text: clean(h.textContent) || clean((h.querySelector('img[alt]') || { getAttribute: () => '' }).getAttribute('alt')) }));
  data.headings = heads;
  const h1s = heads.filter((h) => h.level === 1);
  if (!h1s.length) add('content', 'h1', 'H1 見出し', 'fail', 5, '<h1> がありません。ページの主題を示す最上位の見出しです。', 'ページの主題を表す <h1> を1つ置く（ロゴ画像の場合は alt を必ず設定）。');
  else if (h1s.length > 1) add('content', 'h1', 'H1 見出し', 'warn', 5, `<h1> が ${h1s.length} 個あります。`, '主題が1つに定まるよう <h1> は1ページ1つにし、他は <h2> 以下にする。', h1s.map((h) => h.text || '(空)'));
  else if (!h1s[0].text) add('content', 'h1', 'H1 見出し', 'fail', 5, '<h1> が空です（画像の場合は alt がありません）。', '<h1> にテキスト、または画像の alt を設定する。');
  else add('content', 'h1', 'H1 見出し', 'pass', 5, `「${cut(h1s[0].text, 60)}」`);
  {
    const skips = [];
    let prev = 0;
    for (const h of heads) {
      if (prev && h.level > prev + 1) skips.push(`h${prev} → h${h.level}「${cut(h.text, 30)}」`);
      prev = h.level;
    }
    const empty = heads.filter((h) => !h.text).length;
    const prob = [];
    if (skips.length) prob.push(`見出しレベルの飛び ${skips.length} 箇所`);
    if (empty) prob.push(`空の見出し ${empty} 個`);
    if (heads.length && heads[0].level !== 1) prob.push(`最初の見出しが h${heads[0].level}`);
    if (compact.length > 1500 && heads.filter((h) => h.level === 2).length === 0) prob.push('長文なのに h2 がない');
    add('content', 'heading-order', '見出しの階層構造', !heads.length ? 'fail' : prob.length ? 'warn' : 'pass', 3,
      !heads.length ? '見出しタグが1つもありません。' : prob.length ? prob.join(' / ') : `h1〜h6 が ${heads.length} 個、正しい階層で使われています。`,
      !heads.length || prob.length ? '見出しは h1 → h2 → h3 の順に階層を飛ばさず使い、内容の目次として成立させる。' : '', skips.slice(0, 8));
  }

  // ----- 文章量 -----
  const words = text ? text.split(/\s+/).length : 0;
  const amount = isJa ? compact.length : words;
  const unit = isJa ? '文字' : '語';
  const [lo, mid] = isJa ? [300, 1000] : [120, 300];
  data.textAmount = `${amount.toLocaleString()}${unit}`;
  const scripts = q('script[src]').length;
  const spaRoot = doc.querySelector('#root,#app,#__next,#__nuxt,[data-reactroot],app-root');
  if (amount < (isJa ? 150 : 60) && spaRoot && scripts > 0) {
    add('content', 'text', '本文のテキスト量', 'fail', 5, `初期 HTML に本文がほとんどありません（${amount}${unit}）。JavaScript で描画するサイト（SPA）と思われます。`,
      'サーバーサイドレンダリング（SSR）か静的生成（SSG）で、初期 HTML に本文を含める。JS 実行が必要なページはインデックスが遅れ、他の検索エンジンや AI クローラーには読まれません。');
    data.spa = true;
  } else {
    add('content', 'text', '本文のテキスト量', amount < lo ? 'fail' : amount < mid ? 'warn' : 'pass', 5,
      `本文は約 ${amount.toLocaleString()}${unit}。` + (amount < lo ? '内容が薄いと判断されやすい量です。' : amount < mid ? '検索意図を満たすにはやや少なめです。' : '十分な文章量です。'),
      amount < mid ? '検索ユーザーの疑問に答える独自の情報（具体例・手順・比較・FAQ など）を追加する。水増しではなく網羅性を高める。' : '');
  }
  if (html) {
    const ratio = Math.round((text.length / Math.max(html.length, 1)) * 100);
    add('content', 'ratio', 'テキスト / HTML 比率', ratio < 5 ? 'warn' : 'pass', 1, `${ratio}%` + (ratio < 5 ? ' — コードに対して本文が少なめです。' : ''),
      ratio < 5 ? 'インラインの CSS / JS を外部ファイル化し、不要なマークアップを減らす。' : '');
  }

  // ----- キーワード -----
  const kws = topKeywords(text, isJa ? 'ja' : lang || 'en');
  const h1text = h1s.map((h) => h.text).join(' ').toLowerCase();
  kws.forEach((k) => { k.inTitle = title.toLowerCase().includes(k.word); k.inH1 = h1text.includes(k.word); k.inDesc = desc.toLowerCase().includes(k.word); });
  data.keywords = kws;
  if (kws.length >= 3 && title) {
    const top = kws.slice(0, 5);
    const hit = top.filter((k) => k.inTitle);
    add('content', 'kw', '頻出語とタイトルの一致', hit.length ? 'pass' : 'warn', 3,
      hit.length ? `本文の頻出語（${top.map((k) => k.word).join('・')}）のうち「${hit.map((k) => k.word).join('・')}」がタイトルに含まれています。`
        : `本文の頻出語（${top.map((k) => k.word).join('・')}）がタイトルに1つも含まれていません。`,
      hit.length ? '' : '本文の主題とタイトルがずれている可能性があります。狙う検索語句をタイトルと h1 に含める。');
  }

  // ----- 信頼性（E-E-A-T）シグナル -----
  const anchors = q('a[href]');
  const trust = [...new Set(anchors.map((a) => clean(a.textContent) + ' ' + a.getAttribute('href')).filter((t) => TRUST_LINK.test(t)).map((t) => (TRUST_LINK.exec(t) || [])[1].toLowerCase()))];
  add('content', 'trust', '運営者情報への導線', trust.length >= 2 ? 'pass' : trust.length ? 'warn' : 'fail', 2,
    trust.length ? `検出: ${trust.join('、')}` : '会社概要・お問い合わせ・プライバシーポリシーなどへのリンクが見つかりません。',
    trust.length >= 2 ? '' : '運営者情報・問い合わせ先・プライバシーポリシーへのリンクをフッターなどに置く。誰が運営しているかは信頼性（E-E-A-T）評価の基本です。');

  // ----- リンク -----
  const stat = { internal: 0, external: 0, nofollow: 0, bad: [], empty: [], generic: [], blank: 0 };
  const seenInternal = new Set();
  for (const a of anchors) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || href === '#' || /^javascript:/i.test(href)) { stat.bad.push(cut(clean(a.textContent) || href || '(空の href)', 50)); continue; }
    if (/^(mailto|tel|sms|#)/i.test(href)) continue;
    const u = abs(href);
    if (!u || !/^https?:$/.test(u.protocol)) continue;
    const label = clean(a.textContent) || clean((a.querySelector('img[alt]') || { getAttribute: () => '' }).getAttribute('alt')) || clean(a.getAttribute('aria-label')) || clean(a.getAttribute('title'));
    const internal = u.hostname.replace(/^www\./, '') === url.hostname.replace(/^www\./, '');
    if (internal) { stat.internal++; seenInternal.add(normUrl(u.href)); } else stat.external++;
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    if (/nofollow/.test(rel)) stat.nofollow++;
    if (!label) stat.empty.push(u.pathname + u.search);
    else if (GENERIC_ANCHOR.test(label)) stat.generic.push(`「${label}」→ ${cut(u.pathname, 40)}`);
    if (a.getAttribute('target') === '_blank' && !internal && !/noopener|noreferrer/.test(rel)) stat.blank++;
  }
  data.links = { total: anchors.length, internal: stat.internal, uniqueInternal: seenInternal.size, external: stat.external, nofollow: stat.nofollow };
  add('links', 'internal', '内部リンク', stat.internal === 0 ? 'fail' : seenInternal.size < 3 ? 'warn' : 'pass', 3,
    `内部リンク ${stat.internal} 本（ユニーク ${seenInternal.size} URL）／外部リンク ${stat.external} 本`,
    seenInternal.size < 3 ? '関連ページ・上位カテゴリ・トップへの内部リンクを設置する。クローラーの巡回と評価の受け渡しに必須です。' : '');
  if (anchors.length) {
    add('links', 'anchor-empty', 'テキストのないリンク', stat.empty.length ? 'warn' : 'pass', 2,
      stat.empty.length ? `リンクテキスト（または画像 alt）のないリンクが ${stat.empty.length} 本あります。` : 'すべてのリンクにテキストがあります。',
      stat.empty.length ? 'アイコンや画像だけのリンクには alt か aria-label でリンク先の説明を付ける。' : '', stat.empty.slice(0, 8));
    add('links', 'anchor-generic', '具体的なアンカーテキスト', stat.generic.length > 2 ? 'warn' : 'pass', 2,
      stat.generic.length ? `「こちら」「詳細」など内容の分からないリンクテキストが ${stat.generic.length} 本あります。` : 'リンク先の内容が分かるアンカーテキストが使われています。',
      stat.generic.length > 2 ? '「料金プランを見る」のように、リンク先の内容を表す語句をアンカーテキストにする。' : '', stat.generic.slice(0, 8));
    add('links', 'href-bad', '無効な href', stat.bad.length ? 'warn' : 'pass', 1,
      stat.bad.length ? `href が空・"#"・javascript: のリンクが ${stat.bad.length} 本あります。クローラーは辿れません。` : 'クロールできない href はありません。',
      stat.bad.length ? 'ページ遷移は通常の URL を持つ <a href> に、操作は <button> にする。' : '', stat.bad.slice(0, 8));
    if (anchors.length > 400) add('links', 'too-many', 'リンク数', 'warn', 1, `リンクが ${anchors.length} 本あり非常に多いです。`, '1本あたりの評価が薄まるため、重要なリンクに絞る。');
    if (stat.blank) add('links', 'noopener', '別タブで開く外部リンク', 'info', 0, `target="_blank" で rel="noopener" のない外部リンクが ${stat.blank} 本あります（最近のブラウザでは自動で保護されます）。`);
  }

  // ----- 画像 -----
  const imgs = q('img');
  data.images = { total: imgs.length };
  if (imgs.length) {
    const noAlt = imgs.filter((i) => !i.hasAttribute('alt'));
    const pct = noAlt.length / imgs.length;
    const src = (i) => cut((i.getAttribute('src') || i.getAttribute('data-src') || '(src なし)').split('/').slice(-2).join('/'), 60);
    add('links', 'alt', '画像の alt 属性', pct === 0 ? 'pass' : pct <= 0.2 ? 'warn' : 'fail', 4,
      noAlt.length ? `画像 ${imgs.length} 枚中 ${noAlt.length} 枚に alt 属性がありません。` : `画像 ${imgs.length} 枚すべてに alt 属性があります。`,
      noAlt.length ? '意味のある画像には内容を説明する alt を、装飾画像には alt="" を設定する。画像検索の流入とアクセシビリティの両方に効きます。' : '', noAlt.slice(0, 8).map(src));
    const noDim = imgs.filter((i) => !(i.hasAttribute('width') && i.hasAttribute('height')));
    add('links', 'img-dim', '画像サイズの指定', noDim.length / imgs.length > 0.3 ? 'warn' : 'pass', 2,
      noDim.length ? `${noDim.length} 枚に width / height 属性がありません。` : 'すべての画像に width / height があります。',
      noDim.length / imgs.length > 0.3 ? '<img> に width と height を書いて表示領域を確保し、読み込み時のレイアウトずれ（CLS）を防ぐ。' : '');
    const lazy = imgs.filter((i) => (i.getAttribute('loading') || '').toLowerCase() === 'lazy' || i.hasAttribute('data-src')).length;
    if (imgs.length > 8) add('links', 'lazy', '画像の遅延読み込み', lazy ? 'pass' : 'warn', 1,
      lazy ? `${lazy} 枚が遅延読み込みされています。` : `画像が ${imgs.length} 枚ありますが遅延読み込みが使われていません。`,
      lazy ? '' : 'ファーストビュー外の画像に loading="lazy" を付ける（最上部のメイン画像には付けない）。');
    const legacy = imgs.filter((i) => /\.(jpe?g|png|gif)(\?|$)/i.test(i.getAttribute('src') || '')).length;
    const modern = imgs.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.getAttribute('src') || '')).length + q('picture source[type*="webp"],picture source[type*="avif"]').length;
    data.images.modern = modern;
    if (legacy > 5 && !modern) add('links', 'img-format', '次世代画像フォーマット', 'warn', 1, `JPEG / PNG / GIF が ${legacy} 枚あり、WebP / AVIF は使われていません。`, '写真は WebP か AVIF に変換すると容量を 3〜5 割削減できます。');
  } else add('links', 'alt', '画像の alt 属性', 'na', 0, 'ページ内に <img> がありません。');

  // ----- OGP / X カード -----
  const og = {};
  for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:image']) og[k] = meta(k);
  data.og = og;
  const need = ['og:title', 'og:description', 'og:image', 'og:url'];
  const miss = need.filter((k) => !og[k]);
  add('social', 'ogp', 'OGP（SNS シェア設定）', !miss.length ? 'pass' : miss.length === need.length ? 'fail' : 'warn', 5,
    !miss.length ? 'og:title / og:description / og:image / og:url が揃っています。' : miss.length === need.length ? 'OGP タグがありません。SNS や LINE で共有されたときにタイトルや画像が正しく表示されません。' : `不足: ${miss.join(', ')}`,
    miss.length ? 'og:title・og:description・og:image（1200×630px 推奨）・og:url・og:type を <head> に設定する。' : '');
  if (og['og:image'] && !/^https?:\/\//i.test(og['og:image'])) add('social', 'og-image-abs', 'og:image の URL', 'warn', 1, `og:image が絶対 URL ではありません（${cut(og['og:image'], 60)}）。`, 'https:// から始まる絶対 URL にする。相対パスは SNS 側で読めません。');
  add('social', 'twitter', 'X（Twitter）カード', og['twitter:card'] ? 'pass' : 'warn', 2,
    og['twitter:card'] ? `twitter:card = ${og['twitter:card']}` : 'twitter:card がありません。',
    og['twitter:card'] ? '' : '<meta name="twitter:card" content="summary_large_image"> を追加すると X で大きな画像付きで表示されます。');

  // ----- 構造化データ -----
  const ldScripts = q('script[type="application/ld+json" i]');
  const nodes = [];
  const ldErrors = [];
  ldScripts.forEach((s, i) => {
    try { ldNodes(JSON.parse(s.textContent), nodes); } catch (e) { ldErrors.push(`${i + 1} 個目: ${cut(String(e.message), 80)}`); }
  });
  const typesOf = (n) => [].concat(n['@type']).map(String);
  const types = [...new Set(nodes.flatMap(typesOf))];
  const microdata = q('[itemscope]').length;
  data.jsonld = { types, blocks: ldScripts.length, microdata };
  if (!ldScripts.length && !microdata) {
    add('social', 'ld', '構造化データ', 'warn', 4, '構造化データ（JSON-LD）がありません。リッチリザルト（パンくず・FAQ・レビュー星など）の対象になりません。',
      'ページ種別に合わせて JSON-LD を追加する。まずは Organization / WebSite / BreadcrumbList、記事なら Article、商品なら Product。');
  } else {
    add('social', 'ld', '構造化データ', ldErrors.length ? 'fail' : 'pass', 4,
      ldErrors.length ? `JSON-LD ${ldScripts.length} 個中 ${ldErrors.length} 個が構文エラーで、Google に読み取られません。` : `検出: ${types.length ? types.join(', ') : `microdata ${microdata} 件`}`,
      ldErrors.length ? 'JSON の構文（カンマ・引用符・括弧）を修正する。Google の「リッチリザルト テスト」で検証できます。' : '', ldErrors);
    const missing = [];
    for (const n of nodes) for (const t of typesOf(n)) {
      const req = LD_REQUIRED[t];
      if (!req) continue;
      const lack = req.filter((r) => (Array.isArray(r) ? !r.some((x) => n[x] != null) : n[r] == null)).map((r) => (Array.isArray(r) ? r.join(' / ') + ' のいずれか' : r));
      if (lack.length) missing.push(`${t}: ${lack.join(', ')} がありません`);
    }
    if (nodes.length) add('social', 'ld-req', '構造化データの必須項目', missing.length ? 'warn' : 'pass', 2,
      missing.length ? '推奨・必須プロパティが不足している型があります。' : '主要な型の必須プロパティが揃っています。',
      missing.length ? '不足しているプロパティを追加する。不足があるとリッチリザルトに採用されません。' : '', missing.slice(0, 8));
    if (!types.includes('BreadcrumbList') && url.pathname.split('/').filter(Boolean).length >= 1)
      add('social', 'ld-bc', 'パンくずリストの構造化データ', 'info', 0, '下層ページですが BreadcrumbList がありません。追加すると検索結果の URL 表示がパンくずになります。');
  }

  // ----- hreflang -----
  const hl = q('link[hreflang]').map((l) => ({ lang: (l.getAttribute('hreflang') || '').trim(), href: (abs(l.getAttribute('href') || '') || {}).href || '' }));
  if (hl.length) {
    const prob = [];
    hl.filter((x) => !/^(x-default|[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z]{2})?)$/.test(x.lang)).forEach((x) => prob.push(`不正な言語コード: ${x.lang || '(空)'}`));
    if (!hl.some((x) => normUrl(x.href) === page)) prob.push('自分自身を指す hreflang がありません');
    if (!hl.some((x) => x.lang === 'x-default')) prob.push('x-default がありません');
    add('index', 'hreflang', 'hreflang（多言語設定）', prob.length ? 'warn' : 'pass', 2, prob.length ? `${hl.length} 件の hreflang に問題があります。` : `${hl.length} 件の hreflang が正しく設定されています。`,
      prob.length ? '各言語ページが相互に、かつ自分自身も含めて hreflang を持つようにし、x-default を指定する。' : '', prob);
  }

  // ----- 技術 -----
  if (html) {
    const dt = /^\s*(<!--[\s\S]*?-->\s*)*<!doctype html/i.test(html);
    add('tech', 'doctype', 'DOCTYPE 宣言', dt ? 'pass' : 'warn', 1, dt ? '<!DOCTYPE html> があります。' : 'DOCTYPE 宣言がありません。互換モードで表示崩れの原因になります。', dt ? '' : 'HTML の1行目に <!DOCTYPE html> を書く。');
    const kb = Math.round((ctx.htmlBytes || html.length) / 1024);
    add('tech', 'html-size', 'HTML のサイズ', kb > 2048 ? 'fail' : kb > 500 ? 'warn' : 'pass', 1, `${kb.toLocaleString()} KB`,
      kb > 500 ? 'インラインの CSS / JS / SVG / 画像データを外部化して HTML を軽くする。Googlebot が読むのは先頭 15MB までですが、大きい HTML は表示も遅くなります。' : '');
  }
  const nodesCount = doc.getElementsByTagName('*').length;
  if (!data.spa) add('tech', 'dom', 'DOM 要素数', nodesCount > 3000 ? 'fail' : nodesCount > 1500 ? 'warn' : 'pass', 2, `${nodesCount.toLocaleString()} 要素`,
    nodesCount > 1500 ? '不要なラッパー要素を減らす。長いリストはページ分割や遅延表示にする。DOM が大きいと描画と操作の応答が遅くなります。' : '');
  const blocking = q('head script[src]').filter((s) => !s.hasAttribute('async') && !s.hasAttribute('defer') && (s.getAttribute('type') || '').toLowerCase() !== 'module');
  add('tech', 'blocking', 'レンダリングを妨げるスクリプト', blocking.length > 3 ? 'fail' : blocking.length ? 'warn' : 'pass', 3,
    blocking.length ? `<head> 内に async / defer のない外部スクリプトが ${blocking.length} 個あります。` : '<head> 内に描画をブロックする外部スクリプトはありません。',
    blocking.length ? 'スクリプトに defer（順序が必要な場合）か async（独立した計測タグなど）を付ける。' : '', blocking.slice(0, 8).map((s) => cut(s.getAttribute('src'), 80)));
  const css = q('link').filter((l) => /stylesheet/i.test(l.getAttribute('rel') || '')).length;
  data.resources = { scripts, css, iframes: q('iframe').length };
  if (css > 8) add('tech', 'css-count', 'CSS ファイル数', 'warn', 1, `スタイルシートが ${css} 個読み込まれています。`, 'CSS を結合し、ファーストビューに必要な分だけを先に読み込む。');
  if (url.protocol === 'https:') {
    const mixed = q('[src],link[href]').map((e) => e.getAttribute('src') || (e.tagName === 'LINK' && /stylesheet|icon|preload/i.test(e.getAttribute('rel') || '') ? e.getAttribute('href') : '') || '').filter((s) => /^http:\/\//i.test(s));
    add('tech', 'mixed', '混在コンテンツ', mixed.length ? 'fail' : 'pass', 3, mixed.length ? `HTTPS ページ内で http:// のリソースを ${mixed.length} 件読み込んでいます。ブラウザにブロックされます。` : 'http:// のリソース読み込みはありません。',
      mixed.length ? 'リソースの URL をすべて https:// に変更する。' : '', mixed.slice(0, 8).map((s) => cut(s, 80)));
  }
  const dep = q('font,center,marquee,blink,frameset,frame,applet').length;
  if (dep) add('tech', 'deprecated', '廃止された HTML タグ', 'warn', 1, `<font> <center> など廃止タグが ${dep} 個あります。`, 'CSS に置き換える。');
  const refresh = q('meta').find((m) => /^refresh$/i.test(m.getAttribute('http-equiv') || ''));
  if (refresh) add('index', 'meta-refresh', 'meta refresh', 'warn', 2, `meta refresh によるリダイレクト / 自動更新があります（${refresh.getAttribute('content')}）。`, 'ページ移転はサーバー側の 301 リダイレクトで行う。');
  if (meta('keywords')) add('basic', 'meta-kw', 'meta keywords', 'info', 0, 'meta keywords が設定されていますが、Google は評価に使いません（害もありません）。');

  // ----- 鮮度 -----
  const pub = meta('article:published_time') || (nodes.find((n) => n.datePublished) || {}).datePublished || '';
  const mod = meta('article:modified_time') || (nodes.find((n) => n.dateModified) || {}).dateModified || '';
  if (pub || mod) add('content', 'dates', '公開日・更新日', 'info', 0, `公開: ${String(pub).slice(0, 10) || '不明'} ／ 更新: ${String(mod).slice(0, 10) || '不明'}`);
}

// =====================================================================
function crawlChecks(ctx, add, data, page) {
  const { url } = ctx;
  const r = ctx.robots;
  if (r.state === 'pending') add('index', 'robots', 'robots.txt', 'pending', 0, '取得中…');
  else if (r.state === 'missing') add('index', 'robots', 'robots.txt', 'warn', 2, 'robots.txt を取得できませんでした（存在しないか、取得経路の制約です）。',
    'サイト直下に robots.txt を置き、Sitemap: 行でサイトマップの場所を伝える。');
  else if (r.state === 'ok') {
    const parsed = parseRobots(r.text);
    data.robots = { text: r.text.slice(0, 6000), sitemaps: parsed.sitemaps };
    const path = url.pathname + url.search;
    const g = robotsAllows(rulesFor(parsed, 'googlebot'), path);
    add('index', 'robots', 'robots.txt によるクロール許可', g.allowed ? 'pass' : 'fail', 10,
      g.allowed ? 'Googlebot はこのページをクロールできます。' : `robots.txt でこのページのクロールが禁止されています（Disallow: ${g.rule.path}）。`,
      g.allowed ? '' : '検索に出したいページなら該当の Disallow を削除・修正する。', null, !g.allowed);
    add('index', 'robots-sitemap', 'robots.txt のサイトマップ記載', parsed.sitemaps.length ? 'pass' : 'warn', 1,
      parsed.sitemaps.length ? `Sitemap: ${parsed.sitemaps.slice(0, 2).join(', ')}` : 'robots.txt に Sitemap: 行がありません。',
      parsed.sitemaps.length ? '' : `robots.txt に「Sitemap: ${url.origin}/sitemap.xml」を追記する。`);
    const ai = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot', 'CCBot'].map((b) => {
      const rules = rulesFor({ groups: parsed.groups.filter((x) => x.agents.includes(b.toLowerCase())), sitemaps: [] }, b);
      return rules.length ? `${b}: ${robotsAllows(rules, path).allowed ? '許可' : '拒否'}` : null;
    }).filter(Boolean);
    add('index', 'ai-bots', 'AI クローラーの扱い', 'info', 0, ai.length ? ai.join(' ／ ') : 'AI クローラー（GPTBot・ClaudeBot など）への個別指定はありません（＝許可）。');
  }

  const s = ctx.sitemap;
  if (s.state === 'pending') add('index', 'sitemap', 'XML サイトマップ', 'pending', 0, '取得中…');
  else if (s.state === 'missing') add('index', 'sitemap', 'XML サイトマップ', 'warn', 3, 'XML サイトマップが見つかりませんでした（/sitemap.xml と robots.txt 記載の場所を確認）。',
    'sitemap.xml を生成してサイト直下に置き、Google Search Console から送信する。新しいページの発見が早くなります。');
  else if (s.state === 'ok') {
    let locs = [];
    let kind = '';
    let lastmod = 0;
    try {
      const x = new DOMParser().parseFromString(s.text, 'text/xml');
      if (x.querySelector('parsererror')) throw new Error('XML 構文エラー');
      kind = x.documentElement.localName;
      locs = [...x.getElementsByTagName('loc')].map((l) => l.textContent.trim());
      lastmod = x.getElementsByTagName('lastmod').length;
    } catch { kind = 'error'; }
    data.sitemap = { url: s.url, kind, count: locs.length };
    if (kind === 'error') add('index', 'sitemap', 'XML サイトマップ', 'fail', 3, `サイトマップ（${s.url}）が XML として不正です。`, 'XML の構文エラーを修正する。');
    else if (kind === 'sitemapindex') add('index', 'sitemap', 'XML サイトマップ', 'pass', 3, `サイトマップインデックス（子サイトマップ ${locs.length} 件）: ${s.url}`);
    else {
      add('index', 'sitemap', 'XML サイトマップ', locs.length ? 'pass' : 'warn', 3, `${locs.length.toLocaleString()} URL を掲載${lastmod ? '（lastmod あり）' : ''}: ${s.url}`, locs.length ? '' : 'サイトマップが空です。インデックスさせたい URL を掲載する。');
      if (locs.length) {
        const has = locs.some((l) => normUrl(l) === page);
        add('index', 'sitemap-has', 'サイトマップへの掲載', has ? 'pass' : 'warn', 1, has ? 'このページはサイトマップに掲載されています。' : 'このページの URL がサイトマップに見当たりません。',
          has ? '' : 'インデックスさせたいページならサイトマップに追加する（canonical と同じ URL 表記で）。');
      }
    }
  }
}

// =====================================================================
function headerChecks(ctx, add) {
  const { url } = ctx;
  if (ctx.status) add('index', 'status', 'HTTP ステータス', ctx.status === 200 ? 'pass' : 'fail', 6, `HTTP ${ctx.status}`,
    ctx.status === 200 ? '' : '検索に出したいページは 200 を返すようにする。', null, ctx.status >= 400);
  if (ctx.redirects) {
    const n = ctx.redirects.length;
    const temp = ctx.redirects.filter((r) => r.status === 302 || r.status === 307).length;
    add('index', 'redirects', 'リダイレクト', n > 2 ? 'fail' : n > 1 || temp ? 'warn' : 'pass', 3,
      n ? `${n} 回リダイレクトして到達${temp ? `（うち一時リダイレクト ${temp} 回）` : ''}` : 'リダイレクトなしで直接表示されます。',
      n > 1 ? 'リダイレクトの連鎖をやめ、最終 URL へ1回で 301 リダイレクトする。' : temp ? '恒久的な移転なら 302 ではなく 301 を使う。' : '',
      ctx.redirects.map((r) => `${r.status} ${r.url}`));
  }
  const h = ctx.headers;
  if (!h) {
    add('tech', 'headers', 'セキュリティヘッダー', 'na', 0, 'この取得経路ではレスポンスヘッダーを確認できません（Cloudflare Pages へのデプロイ、または独自プロキシ設定で有効になります）。');
    return;
  }
  const xr = (h['x-robots-tag'] || '').toLowerCase();
  if (/noindex|none/.test(xr)) add('index', 'x-robots', 'X-Robots-Tag ヘッダー', 'fail', 10, `HTTP ヘッダーで noindex が指定されています（${xr}）。`, 'サーバー設定から X-Robots-Tag: noindex を外す。', null, true);
  if (url.protocol === 'https:') add('tech', 'hsts', 'HSTS', h['strict-transport-security'] ? 'pass' : 'warn', 2,
    h['strict-transport-security'] ? 'Strict-Transport-Security が設定されています。' : 'Strict-Transport-Security ヘッダーがありません。',
    h['strict-transport-security'] ? '' : 'Strict-Transport-Security: max-age=31536000; includeSubDomains を返す。');
  add('tech', 'nosniff', 'X-Content-Type-Options', /nosniff/i.test(h['x-content-type-options'] || '') ? 'pass' : 'warn', 1,
    h['x-content-type-options'] ? 'nosniff が設定されています。' : 'X-Content-Type-Options: nosniff がありません。', h['x-content-type-options'] ? '' : 'X-Content-Type-Options: nosniff を返す。');
  const csp = h['content-security-policy'] || '';
  add('tech', 'frame', 'クリックジャッキング対策', h['x-frame-options'] || /frame-ancestors/i.test(csp) ? 'pass' : 'warn', 1,
    h['x-frame-options'] || /frame-ancestors/i.test(csp) ? '他サイトへの埋め込みが制限されています。' : 'X-Frame-Options / CSP frame-ancestors がありません。',
    h['x-frame-options'] || /frame-ancestors/i.test(csp) ? '' : 'X-Frame-Options: SAMEORIGIN を返す。');
  add('tech', 'csp', 'Content-Security-Policy', csp ? 'pass' : 'info', csp ? 1 : 0, csp ? 'CSP が設定されています。' : 'CSP は未設定です（必須ではありませんが、XSS 対策として推奨）。');
  add('tech', 'referrer', 'Referrer-Policy', h['referrer-policy'] ? 'pass' : 'info', h['referrer-policy'] ? 1 : 0, h['referrer-policy'] ? `Referrer-Policy: ${h['referrer-policy']}` : 'Referrer-Policy は未設定です（ブラウザ既定値が使われます）。');
  const info = [];
  if (h['content-encoding']) info.push(`圧縮: ${h['content-encoding']}`);
  if (h['cache-control']) info.push(`Cache-Control: ${h['cache-control']}`);
  if (h.server) info.push(`Server: ${h.server}`);
  if (info.length) add('tech', 'hdr-info', '配信情報', 'info', 0, info.join(' ／ '));
}

function dnsChecks(ctx, add) {
  const d = ctx.dns;
  if (d.state === 'pending') add('tech', 'dns', 'DNS', 'pending', 0, '確認中…');
  else if (d.state === 'ok') {
    if (d.nx || !d.a.length && !d.aaaa.length) add('tech', 'dns', 'DNS 解決', 'fail', 3, 'ドメインの A / AAAA レコードが見つかりません。', 'DNS 設定を確認する。');
    else {
      add('tech', 'dns', 'DNS 解決', 'pass', 1, `A レコード ${d.a.length} 件`);
      add('tech', 'ipv6', 'IPv6 対応', d.aaaa.length ? 'pass' : 'warn', 1, d.aaaa.length ? 'AAAA レコードがあり IPv6 で接続できます。' : 'AAAA レコードがなく IPv6 非対応です。',
        d.aaaa.length ? '' : 'CDN（Cloudflare など）を通すか、サーバーの IPv6 を有効にする。モバイル回線での接続が速くなる場合があります。');
    }
  }
}

// =====================================================================
function psiChecks(ctx, add, data) {
  const p = ctx.psi;
  if (p.state === 'pending') { add('perf', 'psi', 'PageSpeed Insights', 'pending', 0, 'Google が実際にページを読み込んで計測中です（20〜60秒かかります）…'); return; }
  if (p.state === 'skipped') { add('perf', 'psi', 'PageSpeed Insights', 'na', 0, '速度計測はオフになっています。'); return; }
  if (p.state === 'error') {
    add('perf', 'psi', 'PageSpeed Insights', 'na', 0, p.error.code === 429
      ? 'Google PageSpeed API の共有無料枠が混雑していて計測できませんでした。「設定」に無料の API キーを入れると安定して計測できます。'
      : `計測できませんでした: ${p.error.message}`);
    return;
  }
  const lh = p.data.lighthouseResult || {};
  const A = lh.audits || {};
  const C = lh.categories || {};
  const sc = (k) => (C[k] && C[k].score != null ? Math.round(C[k].score * 100) : null);
  const grade = (v, good, ok) => (v <= good ? 'pass' : v <= ok ? 'warn' : 'fail');
  data.lighthouse = { performance: sc('performance'), seo: sc('seo'), accessibility: sc('accessibility'), bestPractices: sc('best-practices'), strategy: ctx.strategy };

  const perf = sc('performance');
  if (perf != null) add('perf', 'lh-perf', `パフォーマンススコア（${ctx.strategy === 'desktop' ? 'PC' : 'モバイル'}）`, perf >= 90 ? 'pass' : perf >= 50 ? 'warn' : 'fail', 5, `${perf} / 100`,
    perf >= 90 ? '' : '下の「Lighthouse の指摘」で削減効果の大きい項目から対応する。');
  const metric = (id, name, good, ok, w, fix, toSec = true) => {
    const a = A[id];
    if (!a || a.numericValue == null) return;
    add('perf', id, name, grade(a.numericValue, good, ok), w, a.displayValue || String(toSec ? a.numericValue / 1000 : a.numericValue), grade(a.numericValue, good, ok) === 'pass' ? '' : fix);
  };
  metric('largest-contentful-paint', 'LCP（最大コンテンツの表示時間）', 2500, 4000, 4, 'メイン画像を軽量化・preload し、サーバー応答（TTFB）を短縮する。目標は 2.5 秒以内。');
  metric('cumulative-layout-shift', 'CLS（レイアウトのずれ）', 0.1, 0.25, 3, '画像・広告・埋め込みに幅と高さを指定し、後から挿入される要素の領域を確保する。目標は 0.1 以下。', false);
  metric('total-blocking-time', 'TBT（操作をブロックした時間）', 200, 600, 3, '不要な JavaScript を削除し、サードパーティタグを遅延読み込みする。INP の改善に直結します。');
  metric('first-contentful-paint', 'FCP（最初の描画）', 1800, 3000, 1, 'レンダリングを妨げる CSS / JS を減らし、サーバー応答を速くする。');
  metric('speed-index', 'Speed Index', 3400, 5800, 1, 'ファーストビューに必要なリソースを優先して読み込む。');

  // 実ユーザーデータ（Chrome UX Report）
  const le = p.data.loadingExperience && p.data.loadingExperience.metrics;
  if (le && Object.keys(le).length) {
    const f = (key, name, unit, div = 1) => {
      const m = le[key];
      if (!m) return;
      const st = m.category === 'FAST' ? 'pass' : m.category === 'AVERAGE' ? 'warn' : 'fail';
      add('perf', 'crux-' + key, `${name}（実ユーザー）`, st, 3, `75パーセンタイル: ${(m.percentile / div).toLocaleString()}${unit} — ${{ FAST: '良好', AVERAGE: '改善が必要', SLOW: '不良' }[m.category] || m.category}`,
        st === 'pass' ? '' : '実際の訪問者の体験値です。Google の順位評価に使われるのはこの値なので、優先して改善する。');
    };
    f('LARGEST_CONTENTFUL_PAINT_MS', 'LCP', '秒', 1000);
    f('INTERACTION_TO_NEXT_PAINT', 'INP', 'ms');
    f('CUMULATIVE_LAYOUT_SHIFT_SCORE', 'CLS', '', 100);
  } else add('perf', 'crux', '実ユーザーデータ（Core Web Vitals）', 'info', 0, 'アクセス数が少なく、Chrome の実ユーザーデータはまだ集計されていません。上記はラボ計測値です。');

  const cat = (k, name, w, fix) => {
    const v = sc(k);
    if (v != null) add('perf', 'lh-' + k, name, v >= 90 ? 'pass' : v >= 70 ? 'warn' : 'fail', w, `${v} / 100`, v >= 90 ? '' : fix);
  };
  cat('seo', 'Lighthouse SEO スコア', 3, '下の「Lighthouse の指摘」の SEO 項目を修正する。');
  cat('accessibility', 'アクセシビリティスコア', 2, 'コントラスト比・ラベル・alt などの指摘を修正する。');
  cat('best-practices', 'ベストプラクティススコア', 2, 'コンソールエラー・古い API・画像の縦横比などの指摘を修正する。');

  // 追加で取れる事実
  const weight = A['total-byte-weight'];
  if (weight && weight.numericValue != null) {
    const mb = weight.numericValue / 1048576;
    add('perf', 'weight', 'ページ総容量', mb <= 1.6 ? 'pass' : mb <= 4 ? 'warn' : 'fail', 2, `${mb.toFixed(2)} MB`, mb <= 1.6 ? '' : '画像の圧縮・次世代フォーマット化、未使用の JS / CSS の削除で転送量を減らす。');
  }
  const reqs = A['network-requests'] && A['network-requests'].details && A['network-requests'].details.items;
  if (reqs && reqs.length) {
    const main = reqs[0];
    data.requests = reqs.length;
    if (main.protocol) add('tech', 'http2', 'HTTP/2・HTTP/3', /h2|h3|http\/2|http\/3/i.test(main.protocol) ? 'pass' : 'warn', 1, `プロトコル: ${main.protocol}`,
      /h2|h3|http\/2|http\/3/i.test(main.protocol) ? '' : 'サーバーまたは CDN で HTTP/2 以上を有効にする。');
    if (!ctx.status && main.statusCode) add('index', 'status', 'HTTP ステータス', main.statusCode === 200 ? 'pass' : 'fail', 6, `HTTP ${main.statusCode}`, main.statusCode === 200 ? '' : '検索に出したいページは 200 を返すようにする。', null, main.statusCode >= 400);
  }

  // 不合格だった Lighthouse 項目
  const failed = [];
  for (const [k, c] of Object.entries(C)) for (const ref of c.auditRefs || []) {
    const a = A[ref.id];
    if (!a || a.score == null || a.score >= 0.9 || a.scoreDisplayMode === 'informative' || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue;
    if (ref.group === 'metrics') continue;
    failed.push({ cat: { performance: '速度', seo: 'SEO', accessibility: 'アクセシビリティ', 'best-practices': 'ベストプラクティス' }[k] || k, title: a.title, value: a.displayValue || '', score: a.score, weight: ref.weight || 0 });
  }
  failed.sort((x, y) => x.score - y.score || y.weight - x.weight);
  data.lhFailed = failed.slice(0, 40);
}

// =====================================================================
export function score(checks) {
  const cats = {};
  let sum = 0;
  let wsum = 0;
  for (const c of CATS) {
    const list = checks.filter((k) => k.cat === c.id);
    let got = 0;
    let max = 0;
    const counts = { pass: 0, warn: 0, fail: 0, pending: 0 };
    for (const k of list) {
      if (k.status in counts) counts[k.status]++;
      if (k.status === 'pass') { got += k.weight; max += k.weight; } else if (k.status === 'warn') { got += k.weight * 0.5; max += k.weight; } else if (k.status === 'fail') max += k.weight;
    }
    const s = max ? Math.round((got / max) * 100) : null;
    cats[c.id] = { score: s, counts, pending: counts.pending > 0 };
    if (s != null) { sum += s * c.w; wsum += c.w; }
  }
  let overall = wsum ? Math.round(sum / wsum) : null;
  const critical = checks.filter((k) => k.critical && k.status === 'fail');
  let capped = false;
  if (overall != null && critical.length && overall > 45) { overall = 45; capped = true; }
  return { cats, overall, capped, critical, grade: gradeOf(overall) };
}
export const gradeOf = (s) => (s == null ? '-' : s >= 95 ? 'S' : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'E');
