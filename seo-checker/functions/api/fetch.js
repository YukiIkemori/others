// Cloudflare Pages Function: /api/fetch?url=...
// 診断対象ページを代理取得し、ステータス・リダイレクト経路・レスポンスヘッダーを付けて返す。
// 無料枠（1日10万リクエスト）を超えるとエラーになるだけで、課金は発生しない。
//
// 単体の Cloudflare Worker として使う場合は worker/worker.js を参照。

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOPS = 8;

function gate(request, env, methods) {
  const origin = request.headers.get('Origin') || '';
  const self = new URL(request.url).origin;
  const allow = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  // 既定では同一オリジンからの利用のみ許可（第三者に踏み台として使われないようにする）
  const permitted = !origin || origin === self || allow.includes('*') || allow.includes(origin);
  const cors = {
    'Access-Control-Allow-Origin': permitted && origin ? origin : self,
    'Access-Control-Expose-Headers': 'x-seo-status, x-seo-final-url, x-seo-redirects, x-seo-headers',
    Vary: 'Origin',
  };
  const fail = (status, msg) => new Response(msg, { status, headers: { ...cors, 'content-type': 'text/plain; charset=utf-8' } });
  let early = null;
  if (request.method === 'OPTIONS') early = new Response(null, { status: 204, headers: cors });
  else if (!methods.includes(request.method)) early = fail(405, 'method not allowed');
  else if (!permitted) early = fail(403, 'origin not allowed');
  return { cors, fail, early };
}

const UA = 'Mozilla/5.0 (compatible; SEOCheckerBot/1.0; +static-seo-checker)';

export async function handle(request, env = {}) {
  const { cors, fail, early } = gate(request, env, ['GET']);
  if (early) return early;

  let cur;
  try {
    cur = new URL(new URL(request.url).searchParams.get('url'));
    if (!/^https?:$/.test(cur.protocol)) throw 0;
  } catch {
    return fail(400, 'invalid url');
  }
  if (isPrivateHost(cur.hostname)) return fail(400, 'host not allowed');

  const redirects = [];
  let res;
  try {
    for (let i = 0; ; i++) {
      res = await fetch(cur.href, {
        redirect: 'manual',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'ja,en;q=0.8',
        },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc && i < MAX_HOPS) {
        redirects.push({ url: cur.href, status: res.status });
        cur = new URL(loc, cur);
        if (!/^https?:$/.test(cur.protocol) || isPrivateHost(cur.hostname)) return fail(400, 'redirect target not allowed');
        continue;
      }
      break;
    }
  } catch (e) {
    return fail(502, 'fetch failed: ' + (e && e.message ? e.message : e));
  }

  const upstream = {};
  for (const [k, v] of res.headers) if (k !== 'set-cookie') upstream[k] = v.slice(0, 600);

  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return fail(413, 'response too large');

  return new Response(res.body, {
    status: 200,
    headers: {
      ...cors,
      'content-type': res.headers.get('content-type') || 'text/plain',
      'cache-control': 'public, max-age=120',
      'x-seo-status': String(res.status),
      'x-seo-final-url': encodeURIComponent(cur.href),
      'x-seo-redirects': encodeURIComponent(JSON.stringify(redirects)),
      'x-seo-headers': encodeURIComponent(JSON.stringify(upstream)),
    },
  });
}

function isPrivateHost(h) {
  h = h.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return true;
  if (h === '::1' || h === '::' || /^f[cde]/.test(h) && h.includes(':')) return true;
  return !h.includes('.') && !h.includes(':');
}

// ---- /api/check: リンク先の生存確認をまとめて行う（本文は読まずステータスだけ返す） ----
// POST 本文: URL の JSON 配列（最大 12 件。無料プランの外部リクエスト上限 50 回/呼び出しに収めるため）
const CHECK_MAX = 12;
export async function handleCheck(request, env = {}) {
  const { cors, fail, early } = gate(request, env, ['POST']);
  if (early) return early;
  let urls;
  try {
    urls = JSON.parse(await request.text());
    if (!Array.isArray(urls)) throw 0;
  } catch {
    return fail(400, 'invalid body');
  }
  const probe = async (raw) => {
    let u;
    try {
      u = new URL(raw);
      if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) throw 0;
    } catch {
      return { url: raw, status: 0, error: 'invalid' };
    }
    const once = async (method) => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 9000);
      try {
        const res = await fetch(u.href, { method, redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' } });
        if (res.body) res.body.cancel().catch(() => {});
        return { url: raw, status: res.status, finalUrl: res.url, redirected: res.redirected };
      } catch (e) {
        return { url: raw, status: 0, error: e && e.name === 'AbortError' ? 'timeout' : 'unreachable' };
      } finally {
        clearTimeout(timer);
      }
    };
    let r = await once('HEAD');
    // HEAD を拒否・誤応答するサーバーがあるので、エラー時だけ GET で確かめ直す
    if (r.status === 0 || (r.status >= 400 && r.status !== 429)) r = await once('GET');
    return r;
  };
  const out = await Promise.all(urls.slice(0, CHECK_MAX).map(probe));
  return new Response(JSON.stringify(out), { headers: { ...cors, 'content-type': 'application/json' } });
}

export const onRequest = (context) => handle(context.request, context.env);
