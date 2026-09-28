// 読み込みの画面（CORE）: 起動の読み込みの進みの棒と、使う時に読む絵（下絵・戦闘背景）の待ちの小さな進み。
// 主人公の原画（R.Media の sprites '<look>:field' の run8_right）が、灯を下げて棒の上を走る。新しい絵は作らない。
//   R.Loading.boot()                   起動の読み込みを始める（main.js。Engine が回る前なので、自分の requestAnimationFrame で描く）
//   R.Loading.bootDone()               起動の読み込みが終わった（Engine.start の前。自分の描きを止める）
//   R.Loading.wait(p, doneFn, total)   p が解決するまでの待ち（doneFn() = 読み終えた枚数）。WAIT_SHOW ms を越えたときだけ
//                                      右下に小さく出す（Engine の重ね描き z 1000 = 暗転の上。暗転の中の下絵の待ちでも見える）
//   R.Loading.frac()                   起動の進み 0〜1（見せている値）
// 進みは本当の数: R.Media.stat（読み始めた画像・読み終えた画像の数）を、起動で読む見積もり
// （原画 sprites・魔物 monsters の全部 ＋ T.Env.bootCount() の素材）で割る。読み込み時に document に触れない。
(function (R) {
  'use strict';
  const BG = '#070812';
  const WAIT_SHOW = 350;   // 待ちがこれより短いときは出さない（読めている絵でちらつかない）
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const L = (R.Loading = {
    active: false,
    shown: 0,
    frac() { return L.shown; },
  });

  // ------------------------------------------------------------------ 走る主人公
  /** 走らせる look: 一行の主人公（原画があれば）→ 既定の主人公（DB.config.defaultHero）→ hero_m_warrior */
  function lookKey() {
    const has = (lk) => lk && R.Media && R.Media.has && R.Media.has('sprites', lk + ':field');
    try {
      const c = R.Game && R.Game.chars && R.Game.chars.hero;
      if (c && has(c.look)) return c.look + ':field';
    } catch (e) { /* 既定へ */ }
    const h = (R.DB && R.DB.config && R.DB.config.defaultHero) || {};
    const lk = 'hero_' + (h.sex || 'm') + '_' + (h.type || 'warrior');
    return (has(lk) ? lk : 'hero_m_warrior') + ':field';
  }
  const sheets = {};   // key → {rec, anim:[{f, ms}], total}
  function sheet(key) {
    let s = sheets[key];
    if (s) return s.anim ? s : sheetInit(s);
    if (!R.Media || !R.Media.image || !R.Media.has || !R.Media.has('sprites', key)) return null;
    s = sheets[key] = { rec: R.Media.image(key, 'sprites'), anim: null, total: 0 };
    return sheetInit(s);
  }
  function sheetInit(s) {
    const m = s.rec && s.rec.ready && s.rec.meta;
    if (!m || !Array.isArray(m.frames) || !m.anims) return s;
    const a = m.anims.run8_right || m.anims.run_right || m.anims.walk_right;
    if (!a) return s;
    const by = {};
    for (const f of m.frames) by[f.id] = f;
    s.anim = a.frames.map((id, i) => ({ f: by[id], ms: (a.ms && a.ms[i]) || 80 })).filter((x) => x.f);
    s.total = s.anim.reduce((t, x) => t + x.ms, 0);
    s.anchor = m.anchor || [38, 54];
    return s;
  }
  /** (x, y) = 足もと。k = 整数の倍率。t = ms。描けたら true */
  function runner(g, key, x, y, k, t) {
    const s = sheet(key);
    if (!s || !s.anim || !s.anim.length || !s.total) return false;
    let r = t % s.total, i = 0;
    while (i < s.anim.length - 1 && r >= s.anim[i].ms) { r -= s.anim[i].ms; i++; }
    const f = s.anim[i].f, an = f.anchor || s.anchor;
    g.imageSmoothingEnabled = false;
    g.drawImage(s.rec.img, f.x, f.y, f.w, f.h, Math.round(x - an[0] * k), Math.round(y - an[1] * k), f.w * k, f.h * k);
    return true;
  }
  /** 灯のにじみ（走る人の下げた灯のあたり）と、原画が無いときの代わりの灯 */
  function glow(g, x, y, r, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(249,211,109,${a})`);
    gr.addColorStop(1, 'rgba(249,211,109,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 足もとの土ぼこり（小さな四角が浮いて消える）
  function dust(list, x, y, k, t, dt) {
    if (!list.last || t - list.last > 110) { list.last = t; list.push({ x: x - 10 * k, y: y - k, vx: -(6 + Math.random() * 10) * k, vy: -(4 + Math.random() * 6) * k, life: 0 }); }
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.life += dt; d.x += (d.vx * dt) / 1000; d.y += (d.vy * dt) / 1000;
      if (d.life > 520) list.splice(i, 1);
    }
  }
  function drawDust(g, list, k) {
    for (const d of list) {
      g.globalAlpha = Math.max(0, 0.55 * (1 - d.life / 520));
      g.fillStyle = '#8a7a64';
      g.fillRect(Math.round(d.x), Math.round(d.y), k, k);
    }
    g.globalAlpha = 1;
  }
  /** 棒（枠・溝・灯の色の中身） */
  function bar(g, x, y, w, h, f) {
    g.fillStyle = '#2a2638'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#12111c'; g.fillRect(x, y, w, h);
    const fw = Math.round(w * Math.max(0, Math.min(1, f)));
    if (fw > 0) {
      g.fillStyle = '#b0762c'; g.fillRect(x, y, fw, h);
      g.fillStyle = '#f9d36d'; g.fillRect(x, y, fw, Math.max(1, Math.floor(h / 2)));
    }
  }
  function text(g, s, x, y, size, color, align, family) {
    g.font = R.Gfx && R.Gfx.font ? R.Gfx.font(size, 500, family) : `500 ${size}px sans-serif`;
    g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'top';
    g.fillText(s, x, y);
  }

  // ------------------------------------------------------------------ 起動
  let raf = 0, base = null, expect = 0, t0 = 0, tLast = 0;
  const bootDust = [];
  let stars = null;
  function estimate() {
    const T = (R.Media && R.Media.table && R.Media.table()) || {};
    let n = Object.keys(T.sprites || {}).length + Object.keys(T.monsters || {}).length;
    try { const E = R.Terrain && R.Terrain.Env; if (E && E.bootCount) n += E.bootCount(); } catch (e) { /* 数えられなければ原画の分だけ */ }
    return n;
  }
  function target() {
    const st = R.Media && R.Media.stat;
    if (!st || !base) return 0;
    const req = st.req - base.req, done = st.done - base.done;
    return Math.max(0, Math.min(1, done / Math.max(1, expect, req)));
  }
  function drawBoot() {
    const G = R.Gfx;
    if (!G || !G.ctx) return;
    const t = now(), dt = Math.min(100, t - (tLast || t));
    tLast = t;
    // 見せる値は本当の値へ寄せる（戻らない）
    L.shown = Math.max(L.shown, L.shown + (target() - L.shown) * Math.min(1, dt / 160));
    G.reset();
    const g = G.g, W = R.W, H = R.H;
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    // 星（固定の小さな点）
    if (!stars) { stars = []; let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 70; i++) stars.push([rnd(), rnd() * 0.5, rnd()]); }
    for (const [sx, sy, sb] of stars) {
      g.globalAlpha = 0.18 + 0.3 * sb * (0.6 + 0.4 * Math.sin(t / 700 + sb * 20));
      g.fillStyle = '#c9c4e0'; g.fillRect(Math.round(sx * W), Math.round(sy * H), 1, 1);
    }
    g.globalAlpha = 1;
    const k = H >= 480 && W >= 480 ? 2 : 1;
    const bw = Math.round(Math.min(440, W * 0.62)), bh = 4;
    const bx = Math.round((W - bw) / 2), by = Math.round(H * (H > W ? 0.56 : 0.62));
    // 地面の線（棒の手前と奥に少しのびる）
    g.fillStyle = '#1a1826'; g.fillRect(bx - 24, by + bh + 3, bw + 48, 1);
    bar(g, bx, by, bw, bh, L.shown);
    const rx = bx + Math.round(bw * L.shown), ry = by - 1;
    glow(g, rx + 12 * k, ry - 14 * k, 30 * k, 0.16 + 0.04 * Math.sin(t / 180));
    dust(bootDust, rx, ry, k, t, dt);
    drawDust(g, bootDust, k);
    if (!runner(g, lookKey(), rx, ry, k, t - t0)) glow(g, rx, ry - 10 * k - Math.abs(Math.sin(t / 120)) * 6 * k, 8 * k, 0.9);
    // 文字
    const st = R.Media && R.Media.stat;
    const done = st && base ? st.done - base.done : 0;
    const all = Math.max(expect, st && base ? st.req - base.req : 0);
    const dots = '・'.repeat(1 + (Math.floor(t / 400) % 3));   // 読み込み中の点の動き（1〜3 個。文の三点リーダーではない）
    text(g, '読み込み中' + dots, bx, by + bh + 12, 14, '#d8ceb8');
    text(g, Math.floor(L.shown * 100) + '%', bx + bw, by + bh + 12, 14, '#f9d36d', 'right', 'en');
    if (all > 0) text(g, Math.min(done, all) + ' / ' + all, bx + bw, by + bh + 32, 11, '#7d7690', 'right', 'en');
  }
  function loop() {
    if (!L.active) return;
    try { drawBoot(); } catch (e) { console.error('[loading]', e); }
    raf = requestAnimationFrame(loop);
  }
  L.boot = function () {
    if (L.active || typeof requestAnimationFrame === 'undefined' || !R.Gfx || !R.Gfx.ctx) return;
    const st = R.Media && R.Media.stat;
    base = st ? { req: st.req, done: st.done } : { req: 0, done: 0 };
    expect = estimate();
    L.shown = 0; t0 = tLast = now();
    L.active = true;
    sheet(lookKey());   // 走る絵を真っ先に読む
    loop();
  };
  L.bootDone = function () {
    if (!L.active) return;
    L.shown = 1;
    try { drawBoot(); } catch (e) { /* 描けなくても進む */ }
    L.active = false;
    if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
    raf = 0;
  };

  // ------------------------------------------------------------------ 使う時に読む絵の待ち（右下に小さく）
  const waits = [];   // {p, doneFn, total, t0}
  const waitDust = [];
  let wShown = 0, wLast = 0, wT0 = 0;
  function drawWait(g) {
    const t = now();
    const on = waits.filter((w) => t - w.t0 >= WAIT_SHOW);
    if (!on.length) return;
    const dt = Math.min(100, t - (wLast || t));
    wLast = t;
    if (!wT0) wT0 = t;
    let done = 0, total = 0;
    for (const w of on) { let d = 0; try { d = w.doneFn(); } catch (e) { /* 0 のまま */ } done += Math.min(d, w.total); total += w.total; }
    const f = total ? done / total : 0;
    // 大きな絵は 1 枚ずつしか進まないので、読み終えた枚数の少し先まではゆっくり寄せる（止まって見えない）
    const soft = total ? Math.min(1, (done + 0.85 * (1 - Math.exp(-(t - on[0].t0) / 1500))) / total) : 0;
    wShown = Math.max(wShown, wShown + (Math.max(f, soft) - wShown) * Math.min(1, dt / 140));
    const W = R.W, H = R.H, s = R.safe || { r: 0, b: 0 };
    const a = Math.min(1, (t - on[0].t0 - WAIT_SHOW) / 200);
    const bw = 110, bh = 3;
    const bx = Math.round(W - s.r - 24 - bw), by = Math.round(H - s.b - 26);
    g.globalAlpha = a * 0.72;
    g.fillStyle = BG; g.fillRect(bx - 12, by - 62, bw + 24, 84);
    g.globalAlpha = a;
    bar(g, bx, by, bw, bh, wShown);
    const rx = bx + Math.round(bw * wShown), ry = by - 1;
    glow(g, rx + 12, ry - 14, 26, 0.14 * a);
    dust(waitDust, rx, ry, 1, t, dt);
    drawDust(g, waitDust, 1);
    g.globalAlpha = a;
    if (!runner(g, lookKey(), rx, ry, 1, t - wT0)) glow(g, rx, ry - 10 - Math.abs(Math.sin(t / 120)) * 5, 7, 0.9 * a);
    text(g, '読み込み中', bx, by + bh + 6, 11, '#d8ceb8');
    text(g, done + ' / ' + total, bx + bw, by + bh + 6, 11, '#7d7690', 'right', 'en');
    g.globalAlpha = 1;
  }
  L.wait = function (p, doneFn, total) {
    if (!R.Engine || !R.Engine.overlay || !p || !(total > 0)) return p;
    const w = { p, doneFn: doneFn || (() => 0), total, t0: now() };
    if (!waits.length) { wShown = 0; wT0 = 0; waitDust.length = 0; }
    waits.push(w);
    R.Engine.overlay('loading', drawWait, 1000);
    const end = () => {
      const i = waits.indexOf(w);
      if (i >= 0) waits.splice(i, 1);
      if (!waits.length) R.Engine.overlay('loading', null);
    };
    Promise.resolve(p).then(end, end);
    return p;
  };
})(window.RPG);
