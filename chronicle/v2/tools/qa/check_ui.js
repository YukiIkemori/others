#!/usr/bin/env node
// QA: 画面の文字と押せる所の検査（V2_PLAN §3.16 の 3「check_ui」、§3.11 の表示してはいけない物、MODERN_UI の 12 CSS px・44 CSS px）。
//
//   node v2/tools/qa/check_ui.js [--only name,…] [--sizes wide,phone] [--verbose]
//
// dist/dev.html で §3.11 の画面を 1 枚ずつ開き（tools/qa/shots_slice.js と同じフィクスチャ）、1 フレームを描くあいだの
// CanvasRenderingContext2D.fillText をすべて記録して、描いた後のキャンバスの画素と合わせて調べる:
//  - はみ出し: 文字の箱がキャンバス（画面）の外へ出ない
//  - 最小の文字: 12 CSS px 以上（字の大きさ × 変換 × キャンバスの CSS の倍率）
//  - コントラスト: 文字の色と、その箱の中の背景（文字の色から離れた画素の中央値）の比が 4.5 以上（大きい字 24 CSS px・太字 18.7 以上は 3）
//  - 押せる大きさ（スマホ縦）: 一覧の行（UIK.List の rect と行の高さ）とタッチの操作パッドが 44 CSS px 以上
//  - 表示してはいけない文字（§3.11）: WP・Lv・経験値・次のレベル・オート（オートセーブは可）・中列・前衛・役割・特性・紹介・熟練の補正の数字・他社の名前
//  - 「戻る」: どの画面にも B（戻る・閉じる）の表示か、タッチの「戻」がある
'use strict';
const path = require('path');
const B = require('../lib/browser');
const { ok, section, done } = require('../lib/testkit');
const { SHOTS } = require('./shots_slice');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const VERBOSE = argv.includes('--verbose');
const OLD = require('../../../tools/check_text.js');
const style = OLD.readStyle();
const BANNED = [/\bWP\b/, /Lv/, /経験値/, /次のレベル/, /オート(?!セーブ)/, /中列/, /前衛/, /後衛/, /役割/, /特性/, /紹介/, /熟練の補正/, /補正\s*[+＋]\s*\d/, /得意[^\n]{0,6}[：:]\s*[SABCD](\s|$)/];
const EXACT = new Set(style.exact);
const PARTIAL = style.partial.filter((w) => w.length >= 2);

// 調べる画面（メニュー・会話・フィールドの HUD・戦闘）。見本の台本の戦闘（stub の魔物）は除く
const PICK = ['title_continue', 'charcreate', 'nameentry', 'partyselect', 'pharos', 'verda_dark', 'world', 'talk', 'letter', 'hub', 'items', 'skills', 'equip', 'status', 'order', 'bestiary',
  'chronicle', 'chronicle_leads', 'map', 'save', 'load', 'settings', 'shop', 'inn', 'tavern', 'detail', 'tip', 'warp', 'passphrase', 'battle', 'battle_command', 'battle_techs', 'boss_rooteater', 'song'];
// 「戻る」が要らない場面（入力を受けない・進めるだけ）
const NO_BACK = new Set(['pharos', 'verda_dark', 'world', 'talk', 'battle', 'boss_rooteater', 'song', 'title_continue']);

async function measure(page, name, size) {
  return page.evaluate(({ name, phone }) => {
    const R = window.RPG, cv = R.Gfx.canvas, g = R.Gfx.g;
    const css = cv.getBoundingClientRect().width / cv.width;   // キャンバスの 1 画素 = css CSS px
    const rec = [];
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText;
    let on = true;
    proto.fillText = function (text, x, y, maxW) {
      if (on && this === g && text != null && String(text).trim()) {
        const t = this.getTransform();
        const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
        const px = m ? +m[1] : 10;
        const w = this.measureText(String(text)).width;
        const bold = /\b(bold|[6-9]00)\b/.test(this.font);
        // 文字の箱（キャンバスの画素）
        const align = this.textAlign, base = this.textBaseline;
        let x0 = x; if (align === 'center') x0 = x - w / 2; else if (align === 'right' || align === 'end') x0 = x - w;
        let y0 = y; if (base === 'top' || base === 'hanging') y0 = y; else if (base === 'middle') y0 = y - px / 2; else y0 = y - px * 0.85;
        const cx0 = t.a * x0 + t.c * y0 + t.e, cy0 = t.b * x0 + t.d * y0 + t.f;
        const sc = Math.hypot(t.a, t.b);
        rec.push({ s: String(text), px: px * sc * css, bold, x: cx0, y: cy0, w: Math.min(w, maxW || w) * sc, h: px * sc, color: typeof this.fillStyle === 'string' ? this.fillStyle : null, alpha: this.globalAlpha });
      }
      return orig.apply(this, arguments);
    };
    R.Engine.pause();
    try { R.Engine.render(); } finally { on = false; proto.fillText = orig; }
    const ctx = cv.getContext('2d');
    const lum = (r, gg, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
    const parse = (c) => { if (!c) return null; const d = document.createElement('canvas').getContext('2d'); d.fillStyle = c; const s = d.fillStyle; const m = /^#([0-9a-f]{6})$/i.exec(s); if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; } const mm = /rgba?\(([^)]+)\)/.exec(s); if (mm) return mm[1].split(',').slice(0, 3).map((v) => +v); return null; };
    const out = { texts: [], issues: [], css, W: cv.width, H: cv.height };
    for (const t of rec) {
      if (t.alpha < 0.5) continue;
      const iss = [];
      if (t.x < -2 || t.y < -2 || t.x + t.w > cv.width + 2 || t.y + t.h > cv.height + 2) iss.push('overflow');
      if (t.px < 11.5) iss.push('small ' + t.px.toFixed(1) + 'px');
      const col = parse(t.color);
      let ratio = null;
      if (col && t.w > 2 && t.h > 2) {
        const bx = Math.max(0, Math.floor(t.x)), by = Math.max(0, Math.floor(t.y)), bw = Math.min(cv.width - bx, Math.ceil(t.w)), bh = Math.min(cv.height - by, Math.ceil(t.h));
        if (bw > 1 && bh > 1) {
          const d = ctx.getImageData(bx, by, bw, bh).data, ls = [];
          for (let i = 0; i < d.length; i += 4 * 3) { const dist = Math.abs(d[i] - col[0]) + Math.abs(d[i + 1] - col[1]) + Math.abs(d[i + 2] - col[2]); if (dist > 90) ls.push(lum(d[i], d[i + 1], d[i + 2])); }
          if (ls.length > 8) {
            ls.sort((a, b) => a - b);
            const bg = ls[ls.length >> 1], fg = lum(col[0], col[1], col[2]);
            ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
            const large = t.px >= 24 || (t.bold && t.px >= 18.66);
            if (ratio < (large ? 3 : 4.5)) iss.push('contrast ' + ratio.toFixed(2));
          }
        }
      }
      out.texts.push({ s: t.s, px: +t.px.toFixed(1), ratio: ratio && +ratio.toFixed(2) });
      if (iss.length) out.issues.push({ s: t.s.slice(0, 30), px: +t.px.toFixed(1), iss });
    }
    // 押せる大きさ（スマホ縦）
    const top = R.Engine.top();
    const list = top && top.list;
    out.touch = [];
    if (phone) {
      const k = R.W ? cv.getBoundingClientRect().width / R.W : 1;
      if (list && list.rect && list.rowPx) out.touch.push({ what: 'list row', css: +(list.rowPx() * k).toFixed(1), cw: +((list.colW ? list.colW() : list.rect.w) * k).toFixed(1) });
      const sp = R.Input.touchSpots ? R.Input.touchSpots() : {};
      for (const [kk, s] of Object.entries(sp)) out.touch.push({ what: 'pad ' + kk, css: +(s.r * 2 * k).toFixed(1) });
    }
    out.back = rec.some((t) => /戻る|閉じる|^戻$/.test(t.s)) || (R.Input.touchVisible && R.Input.touchVisible() && !!(R.Input.touchSpots() || {}).b);
    out.top = top && top.id;
    R.Engine.resume();
    return out;
  }, { name, phone: size === 'phone' });
}

(async () => {
  const sizes = arg('--sizes', 'wide,phone').split(',');
  const only = arg('--only', null);
  const S = await B.start();
  const total = { small: 0, contrast: 0, overflow: 0, banned: 0 };
  const allTexts = new Set();
  for (const [name, label, page, steps, szs] of SHOTS) {
    if (!PICK.includes(name) || (only && !only.split(',').includes(name))) continue;
    for (const sz of (szs || ['wide', 'phone']).filter((s) => sizes.includes(s) && s !== 'land')) {
      section(`${label}（${name}・${sz}）`);
      const P = await B.open(S, page, sz === 'phone' ? { phone: true } : { size: [1920, 1080] });
      try {
        let good = true;
        for (const s of steps) {
          if (s.eval) await P.page.evaluate('(() => { ' + s.eval + '; })()');   // Promise を待たない（歌あわせ・イベントは終わらない）
          if (s.until) { const r = await B.waitFor(P.page, s.until, s.ms || 8000); if (!r) { good = false; break; } }
          if (s.wait) await P.page.waitForTimeout(s.wait);
          if (s.keys) for (const k of s.keys) { await B.press(P.page, k); await P.page.waitForTimeout(180); }
        }
        if (!good) { ok(`${name} ${sz}: 開く`, false); continue; }
        const r = await measure(P.page, name, sz);
        for (const t of r.texts) allTexts.add(t.s);
        const by = (re) => r.issues.filter((i) => i.iss.some((x) => re.test(x)));
        const small = by(/^small/), con = by(/^contrast/), over = by(/^overflow/);
        total.small += small.length; total.contrast += con.length; total.overflow += over.length;
        ok(`${name} ${sz}: はみ出し 0`, over.length === 0, over.slice(0, 4));
        ok(`${name} ${sz}: 12 CSS px 未満の字 0（${r.texts.length} 行）`, small.length === 0, small.slice(0, 4));
        ok(`${name} ${sz}: コントラスト 4.5／3 未満 0`, con.length === 0, con.slice(0, 4));
        const ban = r.texts.filter((t) => BANNED.some((re) => re.test(t.s)) || EXACT.has(t.s.trim()) || PARTIAL.some((w) => t.s.includes(w)));
        total.banned += ban.length;
        ok(`${name} ${sz}: 表示してはいけない文字 0（§3.11）`, ban.length === 0, ban.map((t) => t.s).slice(0, 5));
        if (!NO_BACK.has(name)) ok(`${name} ${sz}: 「戻る」の表示（B か タッチの戻）`, r.back);
        if (sz === 'phone') {
          const tiny = r.touch.filter((t) => t.css < 44);
          ok(`${name} ${sz}: 押せる所 44 CSS px 以上（${r.touch.map((t) => t.what + ' ' + t.css).join('、') || '一覧なし'}）`, tiny.length === 0, tiny);
        }
        ok(`${name} ${sz}: ページのエラー 0`, P.errors.length === 0, P.errors.slice(0, 3));
        if (VERBOSE) console.log(JSON.stringify(r.issues.slice(0, 10)));
      } catch (e) { ok(`${name} ${sz}: 測る`, false, String(e).slice(0, 300)); }
      finally { await P.close(); }
    }
  }
  await B.stop(S);
  console.log(`\n合計: 小さい字 ${total.small}・コントラスト ${total.contrast}・はみ出し ${total.overflow}・表示してはいけない文字 ${total.banned}（${allTexts.size} 種類の文字列）`);
  done('check_ui');
})().catch((e) => { console.error(e); process.exit(2); });
