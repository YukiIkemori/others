// 外部リソース取得層。すべて利用者のブラウザから直接呼ぶ（サイト運営者側の課金は発生しない）。
//
// 取得経路の優先順位:
//   1. 同一オリジンの ./api/fetch （Cloudflare Pages Functions に置いた場合のみ存在）
//   2. 設定された独自プロキシ
//   3. 直接 fetch（相手が CORS を許可している場合のみ成功）
//   4. 無料の公開 CORS プロキシ群

const EXPOSED = ['x-seo-status', 'x-seo-final-url', 'x-seo-redirects', 'x-seo-headers'];

const PUBLIC_PROXIES = [
  { name: 'cors.lol', build: (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}` },
  { name: 'allorigins', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'codetabs', build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
  { name: 'corsproxy.io', build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
];

// 一度失敗した経路は同じ診断中は後回しにする
const health = new Map();
let sameOriginState = 'unknown'; // unknown | ok | absent

async function fetchBytes(url, ms, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { credentials: 'omit', redirect: 'follow', ...init, signal: ctl.signal });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { res, buf };
  } finally {
    clearTimeout(timer);
  }
}

// Shift_JIS / EUC-JP など UTF-8 以外のページも正しく読む
export function decode(buf, contentType = '') {
  let charset = (/charset\s*=\s*["']?([\w-]+)/i.exec(contentType) || [])[1];
  if (!charset) {
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) charset = 'utf-8';
    else {
      let head = '';
      const n = Math.min(buf.length, 4096);
      for (let i = 0; i < n; i++) head += String.fromCharCode(buf[i] & 0x7f);
      charset = (/charset\s*=\s*["']?([\w-]+)/i.exec(head) || [])[1];
    }
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function parseMeta(res) {
  const g = (k) => res.headers.get(k);
  if (!g('x-seo-status')) return null;
  const j = (k, d) => {
    try { return JSON.parse(decodeURIComponent(g(k))); } catch { return d; }
  };
  let finalUrl = '';
  try { finalUrl = decodeURIComponent(g('x-seo-final-url') || ''); } catch { /* ignore */ }
  return {
    status: Number(g('x-seo-status')),
    finalUrl,
    redirects: j('x-seo-redirects', []),
    headers: j('x-seo-headers', null),
  };
}

function customUrl(proxy, target) {
  if (proxy.includes('{url}')) return proxy.replace('{url}', encodeURIComponent(target));
  return proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(target);
}

function routes(target, opts) {
  const list = [];
  if (sameOriginState !== 'absent' && location.protocol.startsWith('http')) {
    list.push({ name: '同梱Function', url: customUrl(new URL('api/fetch', location.href).href, target), rich: true, sameOrigin: true, ms: 20000 });
  }
  if (opts.proxy) list.push({ name: '独自プロキシ', url: customUrl(opts.proxy, target), rich: true, ms: 20000 });
  list.push({ name: '直接取得', url: target, direct: true, ms: 6000 });
  const pubs = PUBLIC_PROXIES.map((p) => ({ name: p.name, url: p.build(target), ms: 14000 }));
  pubs.sort((a, b) => (health.get(a.name) || 0) - (health.get(b.name) || 0));
  return list.concat(pubs);
}

/**
 * @param {string} target 取得したいURL
 * @param {{proxy?:string, validate?:(text:string)=>boolean}} opts
 * @returns {Promise<{ok:boolean,text?:string,bytes?:number,via?:string,status?:number,finalUrl?:string,redirects?:any[],headers?:object,ms?:number,notFound?:boolean,errors:string[]}>}
 */
export async function fetchResource(target, opts = {}) {
  const errors = [];
  let notFound = false;
  for (const r of routes(target, opts)) {
    const t0 = performance.now();
    try {
      const { res, buf } = await fetchBytes(r.url, r.ms);
      const meta = r.rich ? parseMeta(res) : null;
      if (r.sameOrigin) {
        if (!meta) { sameOriginState = 'absent'; continue; } // 静的ホスティングのみ（Functionなし）
        sameOriginState = 'ok';
      }
      if (r.rich && !meta) throw new Error('プロキシの応答形式が不正');
      const status = meta ? meta.status : res.status;
      if (meta && (status === 404 || status === 410)) {
        // 確実に「存在しない」と分かったので他の経路は試さない
        return { ok: false, notFound: true, status, via: r.name, errors };
      }
      if (status >= 400) {
        if (status === 404 || status === 410) notFound = true;
        throw new Error('HTTP ' + status);
      }
      const text = decode(buf, res.headers.get('content-type') || '');
      if (opts.validate && !opts.validate(text)) throw new Error('想定外の内容');
      health.set(r.name, 0);
      return {
        ok: true, text, bytes: buf.length, via: r.name, status,
        finalUrl: meta ? meta.finalUrl : (r.direct ? res.url : ''),
        redirects: meta ? meta.redirects : null,
        headers: meta ? meta.headers : null,
        ms: Math.round(performance.now() - t0), errors,
      };
    } catch (e) {
      if (!r.direct && !r.rich) health.set(r.name, (health.get(r.name) || 0) + 1);
      errors.push(`${r.name}: ${e.name === 'AbortError' ? 'タイムアウト' : e.message || e}`);
    }
  }
  return { ok: false, notFound, errors };
}

export const looksLikeHtml = (t) => /<(html|head|body|title|meta|div|!doctype)\b/i.test(t);
export const looksLikeRobots = (t) => !/<(html|body|!doctype)\b/i.test(t.slice(0, 2000)) && /^\s*(user-agent|disallow|allow|sitemap)\s*:/im.test(t);
export const looksLikeSitemap = (t) => /<(urlset|sitemapindex)\b/i.test(t.slice(0, 5000));

// ---- DNS over HTTPS（Google Public DNS。無料・キー不要・CORS対応） ----
export async function dnsLookup(host) {
  const q = async (type) => {
    const { res, buf } = await fetchBytes(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${type}`, 8000);
    if (!res.ok) throw new Error('DNS HTTP ' + res.status);
    const j = JSON.parse(new TextDecoder().decode(buf));
    return { status: j.Status, answers: (j.Answer || []).map((a) => ({ type: a.type, data: a.data })) };
  };
  const [a, aaaa] = await Promise.all([q('A'), q('AAAA')]);
  return {
    a: a.answers.filter((x) => x.type === 1).map((x) => x.data),
    aaaa: aaaa.answers.filter((x) => x.type === 28).map((x) => x.data),
    nx: a.status === 3,
  };
}

// ---- Google PageSpeed Insights（無料。キー無しでも動くが共有枠のため混雑しやすい） ----
export async function runPsi(target, { key = '', strategy = 'mobile' } = {}) {
  const p = new URLSearchParams({ url: target, strategy, locale: 'ja' });
  for (const c of ['performance', 'seo', 'accessibility', 'best-practices']) p.append('category', c);
  if (key) p.set('key', key);
  const { res, buf } = await fetchBytes('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + p, 90000);
  const j = JSON.parse(new TextDecoder().decode(buf));
  if (!res.ok) {
    const err = new Error((j.error && j.error.message) || 'HTTP ' + res.status);
    err.code = res.status;
    throw err;
  }
  return j;
}
