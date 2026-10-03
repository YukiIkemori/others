// MENUS: タイトル（MODERN_UI §6.1、V2_PLAN §2.5.15・§3.11、design/TITLE_ART.md）
//   背景: 描いた一枚絵（assets/title/ の 4 層、cover・視差・ランタンの光・八つの灯火・火の粉・蛍・流れ星）。読み終わるまでは暗いまま待ち（最長 ART_WAIT）、読めないときは
//   コードで描いた夜の海と灯台（下の bakeTitle）。題字は logo の画像（読めなければ文字の題字）。
//   動く飾り（2026-10-04）: 流れる雲と谷のもや・灯台の光の帯・月の道のきらめき・谷の光の粒・ランタンの息づき（下の AMBI）。
//   起動して最初は出てくる順（§4 を 2 秒に詰めた: 空と谷 → 灯火が順に → 岩場とアルン → 題字が上がり光の筋が渡る → 命令）。
//   どのキーでもとばせる。戻ったとき・動きを減らす設定では 0.6 秒のフェードだけ（出てくる順は起動して最初の 1 回だけ。R.Flow._titled）。
//   命令: 横は左下（x .075・y .655）、縦は下のガラスの札。「つづきから」を選んでいる間だけ最後の記録の札。
//   結果: {cmd:'new', faded} | {cmd:'continue', slot} | {cmd:'load', slot} | {cmd:'passphrase'}
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  // ---------------------------------------------------------------- 背景（止まった所は大きさごとに 1 回だけ焼く）
  let bake = null;   // {key, c, lh:{x, y}, party:[{x, y}]}
  function noise(seed) {
    const rnd = R.rng('title:' + seed);
    const pts = []; for (let i = 0; i < 64; i++) pts.push(rnd.next());
    return (x) => { const i = Math.floor(x), f = x - i, a = pts[((i % 64) + 64) % 64], b = pts[(((i + 1) % 64) + 64) % 64]; const s = f * f * (3 - 2 * f); return a + (b - a) * s; };
  }
  function bakeTitle(W, H, tall) {
    const c = R.Gfx.canvas2d(W, H);
    if (!c) return null;
    const x = c.getContext('2d');
    const rnd = R.rng('title-bg');
    const horizon = Math.round(H * (tall ? 0.58 : 0.6));
    // 空
    const sky = x.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0b0f2a'); sky.addColorStop(0.55, '#1a1f4c'); sky.addColorStop(1, '#2e2f62');
    x.fillStyle = sky; x.fillRect(0, 0, W, horizon);
    // 星
    for (let i = 0; i < (W * H) / 900; i++) {
      const sx = Math.floor(rnd.next() * W), sy = Math.floor(Math.pow(rnd.next(), 1.3) * horizon * 0.95);
      const a = 0.25 + rnd.next() * 0.6;
      x.fillStyle = `rgba(226,230,255,${a})`; x.fillRect(sx, sy, 1, 1);
      if (rnd.next() < 0.04) { x.fillStyle = `rgba(226,230,255,${a * 0.4})`; x.fillRect(sx - 1, sy, 3, 1); x.fillRect(sx, sy - 1, 1, 3); }
    }
    // オーロラ（緑と青緑の帯）
    const nz = noise(3);
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const y0 = H * (0.2 + band * 0.07), amp = H * 0.05;
      for (let i = 0; i < W; i += 2) {
        const yy = y0 + (nz(i / 90 + band * 7) - 0.5) * amp * 2 + Math.sin(i / 130 + band) * amp * 0.5;
        const k = Math.max(0, Math.sin((i / W) * Math.PI * 1.2 + band * 0.7)) * (0.07 - band * 0.015);
        const gr = x.createLinearGradient(0, yy - H * 0.09, 0, yy + H * 0.02);
        gr.addColorStop(0, 'rgba(90,200,170,0)'); gr.addColorStop(0.7, `rgba(110,220,190,${k})`); gr.addColorStop(1, 'rgba(90,160,200,0)');
        x.fillStyle = gr; x.fillRect(i, yy - H * 0.09, 2, H * 0.11);
      }
    }
    x.restore();
    // 月
    const mx = W * (tall ? 0.2 : 0.47), my = H * (tall ? 0.33 : 0.12), mr = Math.round(H * (tall ? 0.026 : 0.045));
    const halo = x.createRadialGradient(mx, my, mr, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(210,220,255,0.25)'); halo.addColorStop(1, 'rgba(210,220,255,0)');
    x.fillStyle = halo; x.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
    x.fillStyle = '#eef0fa'; x.beginPath(); x.arc(mx, my, mr, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(170,176,205,0.5)';
    for (let i = 0; i < 6; i++) { const a = rnd.next() * 6.28, d = rnd.next() * mr * 0.6; x.beginPath(); x.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, mr * (0.08 + rnd.next() * 0.12), 0, 6.28); x.fill(); }
    // 遠い島
    const isl = (y, amp, col, seed, f) => {
      const n = noise(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, horizon);
      for (let i = 0; i <= W; i += 3) x.lineTo(i, y - Math.max(0, (n(i * f) - 0.35) * amp));
      x.lineTo(W, horizon); x.closePath(); x.fill();
    };
    isl(horizon, H * 0.1, '#1b2448', 5, 0.012); isl(horizon, H * 0.06, '#151c3a', 8, 0.02);
    // 海と月の道
    const sea = x.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, '#1b2750'); sea.addColorStop(0.35, '#0f1834'); sea.addColorStop(1, '#080c1e');
    x.fillStyle = sea; x.fillRect(0, horizon, W, H - horizon);
    for (let i = 0; i < (W * H) / 260; i++) {
      const d = Math.pow(rnd.next(), 1.4), y = horizon + 2 + d * (H - horizon);
      const onPath = rnd.next() < 0.55;
      const sx = onPath ? mx + (rnd.next() - 0.5) * (20 + d * W * 0.35) : rnd.next() * W;
      const a = onPath ? 0.2 + rnd.next() * 0.45 : 0.04 + rnd.next() * 0.1;
      x.fillStyle = `rgba(200,214,255,${a * (1 - d * 0.5)})`;
      x.fillRect(Math.round(sx), Math.round(y), 2 + Math.floor(rnd.next() * 8 * (0.4 + d)), 1);
    }
    // 崖（右）
    const cn = noise(11), cn2 = noise(12);
    const cliffL = W * (tall ? 0.28 : 0.52);
    const top = (i) => horizon - H * (tall ? 0.03 : 0.05) + (cn(i / 40) - 0.5) * H * 0.03 + Math.max(0, cliffL + W * 0.1 - i) * (tall ? 1.4 : 0.9) - Math.max(0, i - cliffL - W * 0.1) * 0.02;
    for (let i = Math.floor(cliffL) - 4; i < W; i++) {
      const t0 = Math.round(top(i));
      if (t0 >= H) continue;
      for (let y = t0; y < H; y++) {
        const e = y - t0;
        let l = 0.32 + (cn2(i / 7 + y / 23) - 0.5) * 0.35 - e * 0.0009;
        if (e < 2) l = 0.18;
        const grass = e < 3 + cn(i / 5) * 4;
        const r = grass ? 30 + l * 30 : 22 + l * 44, gg = grass ? 44 + l * 38 : 22 + l * 40, bb = grass ? 50 + l * 34 : 44 + l * 60;
        x.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`;
        x.fillRect(i, y, 1, 1);
      }
    }
    // 灯台
    const lx = Math.round(W * (tall ? 0.8 : 0.84)), ly = Math.round(top(lx)) + 2;
    const th = Math.round(H * (tall ? 0.16 : 0.26)), tw = Math.round(th * 0.14);
    for (let j = 0; j < th; j++) {
      const k = j / th, hw = Math.round(tw * (0.75 + 0.25 * k));
      const band = Math.floor(k * 7) % 3 === 1;
      for (let i = -hw; i <= hw; i++) {
        const shade = 0.55 + 0.45 * (1 - (i + hw) / (hw * 2));
        const base = band ? [150, 50, 52] : [214, 198, 168];
        x.fillStyle = `rgb(${(base[0] * shade) | 0},${(base[1] * shade) | 0},${(base[2] * shade) | 0})`;
        x.fillRect(lx + i, ly - th + j, 1, 1);
      }
    }
    // 灯室と屋根
    const rw = Math.round(tw * 0.9), rh = Math.round(th * 0.13);
    x.fillStyle = '#fff1c8'; x.fillRect(lx - rw, ly - th - rh, rw * 2, rh);
    x.fillStyle = '#b8563a'; x.beginPath(); x.moveTo(lx - rw - 3, ly - th - rh); x.lineTo(lx, ly - th - rh - Math.round(rh * 1.1)); x.lineTo(lx + rw + 3, ly - th - rh); x.closePath(); x.fill();
    x.fillStyle = '#2b2a3a'; x.fillRect(lx - rw - 3, ly - th, rw * 2 + 6, 2);
    // 灯台の足元の石
    x.fillStyle = '#3a3950'; x.fillRect(lx - tw - 6, ly - 3, tw * 2 + 12, 5);
    // 4 人の後ろ姿（崖の縁）
    const party = [];
    const looks = ['viola', 'sylvain', 'hero_m_warrior', 'selma'];
    const px0 = W * (tall ? 0.36 : 0.63), gap = tall ? 30 : 26;
    looks.forEach((look, i) => {
      const px = Math.round(px0 + i * gap), py = Math.round(top(px)) + 1;
      party.push({ x: px, y: py, look });
      let drew = false;
      try {
        if (R.Hd && R.Hd.has && R.Hd.has('hd:field:' + look)) {
          const sh = R.Hd.now ? R.Hd.now('hd:field:' + look, {}) : R.Hd.get('hd:field:' + look, {});
          const pose = sh && sh.poses && (sh.poses.stand_n || sh.poses.walk_n);
          if (pose) { R.Hd.draw(x, sh.frames[pose[0]], px, py, {}); drew = true; }
        }
      } catch (e) { drew = false; }
      if (!drew) {
        const cols = [['#b9a6d8', '#8e7fb0'], ['#8aa36a', '#5e7348'], ['#c98a52', '#8c5a34'], ['#b54a3c', '#7e3228']][i];
        x.fillStyle = cols[1]; x.fillRect(px - 6, py - 22, 12, 22);                    // 体
        x.fillStyle = cols[0]; x.fillRect(px - 6, py - 22, 12, 4);
        x.fillStyle = '#2a2230'; x.fillRect(px - 5, py - 3, 4, 3); x.fillRect(px + 1, py - 3, 4, 3);
        x.fillStyle = cols[0]; x.beginPath(); x.arc(px, py - 29, 7, 0, Math.PI * 2); x.fill();   // 頭（髪）
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px - 6, py - 22, 3, 22);
      }
    });
    return { c, lh: { x: lx, y: ly - th - Math.round(rh / 2) }, party, horizon };
  }

  function drawBg(g) {
    const tall = R.layout === 'tall';
    const key = R.W + 'x' + R.H + ':' + (tall ? 't' : 'w');
    if (!bake || bake.key !== key) { const b = bakeTitle(Math.round(R.W), Math.round(R.H), tall); bake = b ? Object.assign(b, { key }) : { key, c: null }; }
    if (!bake.c) { g.fillStyle = '#10142e'; g.fillRect(0, 0, R.W, R.H); return; }
    g.save(); g.imageSmoothingEnabled = false; g.drawImage(bake.c, 0, 0, R.W, R.H); g.restore();
    const t = R.Engine.time;
    const lm = bake.lh;
    // 灯台の光（ゆっくり掃く）
    const ang = Math.PI + Math.sin(t / 5200) * 0.28 + 0.06;
    const len = R.W * 0.9;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[0.07, 0.16], [0.028, 0.2]]) {
      const gr = g.createLinearGradient(lm.x, lm.y, lm.x + Math.cos(ang) * len, lm.y + Math.sin(ang) * len);
      gr.addColorStop(0, `rgba(255,236,190,${a})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(lm.x, lm.y);
      g.lineTo(lm.x + Math.cos(ang - w) * len, lm.y + Math.sin(ang - w) * len);
      g.lineTo(lm.x + Math.cos(ang + w) * len, lm.y + Math.sin(ang + w) * len); g.closePath(); g.fill();
    }
    g.restore();
    R.UIK.glow(g, lm.x, lm.y, R.H * 0.16, [255, 200, 130], 0.5);
    R.UIK.glow(g, lm.x, lm.y, R.H * 0.03, [255, 240, 200], 0.9);
    // ランタン（主人公の手元）と蛍
    const hero = bake.party[2];
    if (hero) R.UIK.glow(g, hero.x + 7, hero.y - 12, R.H * 0.1, [255, 190, 110], 0.42);
    const rnd = R.rng('title-ff');
    for (let i = 0; i < 26; i++) {
      const bx = R.W * (0.45 + rnd.next() * 0.55), by = R.H * (0.55 + rnd.next() * 0.42);
      const ph = rnd.next() * 6.28, sp = 0.4 + rnd.next() * 0.6;
      const fx = bx + Math.sin(t / 2100 * sp + ph) * 14, fy = by + Math.cos(t / 2700 * sp + ph) * 9;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / 900 * sp + ph * 2));
      R.UIK.glow(g, fx, fy, 7, i % 3 ? [255, 200, 120] : [140, 240, 220], a);
    }
    // 読みやすさのための左の暗がり
    const lg = g.createLinearGradient(0, 0, R.W * 0.55, 0);
    lg.addColorStop(0, 'rgba(6,8,20,0.45)'); lg.addColorStop(1, 'rgba(6,8,20,0)');
    if (!tall) { g.fillStyle = lg; g.fillRect(0, 0, R.W * 0.55, R.H); }
  }

  function newest() {
    let best = null;
    for (const e of R.Save.cards()) if (e.card && !e.card.bad && (!best || e.card.date > best.card.date)) best = e;
    return best;
  }
  function ago(t) {
    const m = Math.max(0, Math.floor((Date.now() - (t || 0)) / 60000));
    if (m < 1) return R.T('ui.title.ago.ret');
    if (m < 60) return R.T('ui.title.ago.ret_2', { m });
    const h = Math.floor(m / 60);
    if (h < 24) return R.T('ui.title.ago.ret_3', { h });
    return R.T('ui.title.ago.ret_4', { Math: Math.floor(h / 24) });
  }
  S.slotName = (slot) => ({ auto: R.T('ui.title.slotName.auto'), suspend: R.T('ui.title.slotName.suspend'), s1: R.T('ui.title.slotName.s1'), s2: R.T('ui.title.slotName.s2'), s3: R.T('ui.title.slotName.s3') })[slot] || slot;
  S.playTimeJa = function (ms) {
    const m = Math.floor((ms || 0) / 60000);
    const h = Math.floor(m / 60);
    return h ? R.T('ui.title.playTimeJa.ret', { h, padStart: String(m % 60).padStart(2, '0') }) : R.T('ui.title.playTimeJa.ret_2', { p0: m % 60 });
  };

  // ================================================================ 描いた一枚絵（design/TITLE_ART.md）
  // 素材: RPG_MEDIA.title[id] = {url: webp, png}、サイドカーは RPG_MEDIA.titleMeta {wide, phone, logo}。
  // 読み終わるまでは上のコードの背景と文字の題字。層が 1 枚でも読めなければ key_* 一枚（視差なし）。
  const META_DEF = {
    wide: {
      size: [1920, 1080], layers: [{ id: 'sky', parallax: 0.15 }, { id: 'land', parallax: 0.4 }, { id: 'crag', parallax: 1 }, { id: 'hero', parallax: 1 }],
      focal: { face: [0.727, 0.213] }, lantern: [0.636, 0.235],
      beacons: [[0.155, 0.629], [0.283, 0.79], [0.371, 0.588], [0.448, 0.569], [0.539, 0.437], [0.579, 0.677], [0.631, 0.545], [0.964, 0.606]],
      logo_safe: { x: 0.05, y: 0.06, w: 0.4, h: 0.39 }, menu_safe: { x: 0.075, y: 0.655, w: 0.2, h: 0.25 }, continue_card_safe: { x: 0.3, y: 0.655, w: 0.18, h: 0.14 },
    },
    phone: {
      size: [1170, 2532], layers: [{ id: 'sky', parallax: 0.15 }, { id: 'land', parallax: 0.4 }, { id: 'crag', parallax: 1 }, { id: 'hero', parallax: 1 }],
      focal: { face: [0.694, 0.356] }, lantern: [0.556, 0.376],
      beacons: [[0.061, 0.516], [0.21, 0.63], [0.268, 0.497], [0.429, 0.414], [0.489, 0.548], [0.961, 0.577]],
      logo_safe: { x: 0.06, y: 0.06, w: 0.88, h: 0.225 }, menu_safe: { x: 0.15, y: 0.75, w: 0.7, h: 0.19 },
    },
    logo: { size: [1478, 806], anchor: { flames: [[0.271, 0.301], [0.315, 0.27], [0.368, 0.23], [0.419, 0.192], [0.574, 0.192], [0.627, 0.23], [0.678, 0.27], [0.726, 0.301]] } },
  };
  function meta(k) {
    const M = R.Media && R.Media.table ? R.Media.table().titleMeta : null;
    return Object.assign({}, META_DEF[k], (M && M[k]) || {});
  }
  const imgs = {};   // id → {img, ready, failed}
  /** webp を読み、読めなければ png（TITLE_ART §2） */
  function loadImg(id) {
    if (imgs[id]) return imgs[id];
    const rec = (imgs[id] = { img: null, ready: false, failed: false });
    const e = R.Media && R.Media.entry ? R.Media.entry('title', id) : null;
    if (!e || typeof Image === 'undefined') { rec.failed = true; return rec; }
    const urls = [];
    try { const u0 = R.Media.url('title', id); if (u0) urls.push(u0); } catch (err) { /* */ }
    if (e.png) urls.push(e.png);
    const tryNext = () => {
      const url = urls.shift();
      if (!url) { rec.failed = true; return; }
      const im = new Image();
      im.onload = () => { rec.img = im; rec.ready = true; };
      im.onerror = () => tryNext();
      im.src = url;
    };
    tryNext();
    return rec;
  }
  /** 向き（'wide'|'phone'）の絵の状態 → {mode: 'wait'|'layers'|'key'|'none', layers, key, readyAt} */
  const sets = {};
  function artSet(k) {
    let s = sets[k];
    if (!s) {
      const m = meta(k);
      s = sets[k] = { k, m, layers: m.layers.map((L, i) => ({ par: L.parallax, rec: loadImg(`${k}_${i}_${L.id}`) })), key: null, mode: 'wait', readyAt: 0 };
    }
    if (s.mode === 'wait') {
      if (s.layers.every((L) => L.rec.ready)) { s.mode = 'layers'; s.readyAt = R.Engine.time; }
      else if (s.layers.some((L) => L.rec.failed)) {
        if (!s.key) s.key = loadImg('key_' + k);
        if (s.key.ready) { s.mode = 'key'; s.readyAt = R.Engine.time; } else if (s.key.failed) s.mode = 'none';
      }
    }
    return s;
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);
  const reduce = () => !!(R.Settings && R.Settings.get && R.Settings.get('reduceMotion'));
  const lessFlash = () => !!(R.Settings && R.Settings.get && R.Settings.get('lessFlash'));

  /** cover の置き方（焦点 face が画面に残る向きに寄せ、視差の分 1.03 倍）→ {x, y, w, h} */
  function cover(m) {
    const iw = m.size[0], ih = m.size[1];
    const sc = Math.max(R.W / iw, R.H / ih) * 1.03;
    const w = iw * sc, h = ih * sc;
    let x = (R.W - w) / 2, y = (R.H - h) / 2;
    const f = (m.focal && m.focal.face) || [0.5, 0.5];
    const mx = R.W * 0.06, my = R.H * 0.06;
    const fx = x + f[0] * w, fy = y + f[1] * h;
    if (fx > R.W - mx) x -= fx - (R.W - mx); else if (fx < mx) x += mx - fx;
    if (fy > R.H - my) y -= fy - (R.H - my); else if (fy < my) y += my - fy;
    x = Math.min(0, Math.max(R.W - w, x)); y = Math.min(0, Math.max(R.H - h, y));
    return { x, y, w, h };
  }

  // 出てくる順（TITLE_ART §4、ミリ秒）。持ち主 2026-10-04「短く 2 秒ほど」: 3.5 秒の順を同じ並びのまま 2 秒に詰め、
  // 題字は下から上がりながら現れ、そのあと光の筋が題字の上を左から右へ一度だけ渡る（sweep）
  const ART_WAIT = 6000;   // 一枚絵を待つ上限（ms）。過ぎたらコードの背景で出す
  const INTRO = { sky: [0, 1000], beacon0: 300, beaconGap: 70, crag: [500, 1200], logo: [900, 1600], rise: 12, sweep: [1150, 1950], flames: 1350, flameGap: 40, menu: [1500, 1900], rowGap: 40, ff: 1400, input: 1500, end: 2000 };
  /** 時刻 t（ms、開いてから。とばしたら大きい値）の各部の強さ */
  function introAt(t) {
    const I = INTRO;
    const beacon = (i) => {
      const d = t - (I.beacon0 + i * I.beaconGap);
      if (d < 0) return 0;
      if (d < 120) return (d / 120) * 1.4;
      return 1 + 0.4 * clamp01(1 - (d - 120) / 300);
    };
    const lt = t - I.crag[0];
    const lantern = lt <= 0 ? 0 : lt < 500 ? 1.2 * easeOut(lt / 500) : 1 + 0.2 * clamp01(1 - (lt - 500) / 500);
    return {
      sky: easeOut((t - I.sky[0]) / (I.sky[1] - I.sky[0])),
      zoom: 1 + 0.01 * (1 - easeOut(t / I.sky[1])),       // 空は 1.04 → 1.03（全体の 1.03 に掛ける）
      beacon, lantern,
      crag: easeOut((t - I.crag[0]) / (I.crag[1] - I.crag[0])),
      embers: t >= I.crag[0],
      logo: easeOut((t - I.logo[0]) / (I.logo[1] - I.logo[0])),
      sweep: (t - I.sweep[0]) / (I.sweep[1] - I.sweep[0]),   // 0〜1 の間だけ題字の上を光が渡る
      flame: (j) => { const d = t - (I.flames + j * I.flameGap); return d < 0 ? 0 : Math.max(0, 1 - d / 450) * Math.min(1, d / 80); },
      menu: (i) => easeOut((t - I.menu[0] - (i || 0) * I.rowGap) / 300),
      ff: easeOut((t - I.ff) / 800),
    };
  }

  // 粒と視差の状態（画面ごと）
  function fxState() {
    const rnd = R.rng('title-art-ff');
    const ff = [];
    for (let i = 0; i < 14; i++) {
      const right = i < 10;
      ff.push({
        x: right ? 0.55 + rnd.next() * 0.45 : rnd.next() * 0.5, y: right ? 0.72 + rnd.next() * 0.28 : 0.75 + rnd.next() * 0.25,
        ph: rnd.next() * 6.28, sp: 0.6 + rnd.next() * 0.6, per: 2000 + rnd.next() * 2000, teal: i % 3 !== 2,
      });
    }
    const tw = [];
    for (let i = 0; i < 8; i++) tw.push({ per: 4000 + rnd.next() * 3000, ph: rnd.next() * 6.28 });
    return { ff, tw, embers: [], spawn: 0, last: null, ax: 0, ay: 0, star: null, nextStar: 20000 + rnd.next() * 20000, rnd: R.rng('title-art-em') };
  }
  function stepFx(st, dt, t, lan, on) {
    // 視差の量（マウスはポインタを 0.6 秒でならす、タッチ・パッドはゆっくり揺れる）
    let tx = 0, ty = 0;
    if (!reduce()) {
      const P = R.Input && R.Input.pointer;
      if (R.Input && R.Input.lastDevice === 'mouse' && P) { tx = clamp01(P.x / R.W) * 2 - 1; ty = (clamp01(P.y / R.H) * 2 - 1) * 0.5; }
      else { tx = Math.sin(t / 9000) * 0.6; ty = Math.sin(t / 9000 * 1.3 + 1) * 0.3; }
    }
    const k = 1 - Math.exp(-dt / 600);
    st.ax += (tx - st.ax) * k; st.ay += (ty - st.ay) * k;
    // 火の粉
    const cap = reduce() ? 8 : 24;
    if (on && lan) {
      st.spawn += dt / 1000 * (cap / 2.2);
      while (st.spawn >= 1) {
        st.spawn -= 1;
        if (st.embers.length >= cap) continue;
        const r = st.rnd;
        st.embers.push({ x: lan.x + (r.next() - 0.5) * 6, y: lan.y + (r.next() - 0.5) * 6, vx: 4 + r.next() * 12 + 8, vy: -(12 + r.next() * 18), life: 1500 + r.next() * 1500, age: 0, size: 0.6 + r.next() * 1.6 });
      }
    }
    for (const e of st.embers) { e.age += dt; e.x += e.vx * dt / 1000; e.y += e.vy * dt / 1000; }
    st.embers = st.embers.filter((e) => e.age < e.life);
    // 流れ星（20〜40 秒に 1 回）
    if (!reduce()) {
      if (!st.star && t > st.nextStar) { st.star = { t0: t }; st.nextStar = t + 20000 + st.rnd.next() * 20000; }
      if (st.star && t - st.star.t0 > 400) st.star = null;
    } else st.star = null;
  }

  // ================================================================ 動く飾り（持ち主 2026-10-04「止まった絵ではなく、静かに生きているタイトルに」）
  //   雲（空の高い所は land の層の奥、低い雲と谷のもやは land の前・岩場の奥）、灯台の光の帯、月の道のきらめき、谷の光の粒。
  //   雲ともやは小さく焼いた柔らかい絵（1 枚 256×64）を引き伸ばして置くだけ。光の帯は三角 2 枚、きらめきは細い線 30 本ほど。
  //   画面全体を毎フレーム塗り直す仕事は足さない。動きを減らす設定では雲ともやを止めて置き、光の帯・きらめき・粒は出さない。
  //   座標は絵の 0〜1。sp は横に流れる速さ（論理 px/秒、風はマフラーと同じ右向き）、par は視差（重ねる層と同じ）
  const AMBI = {
    wide: {
      // 雲ともやは絵そのものから切り抜いて流す（cuts = 空の層の中の切り抜く所、0〜1）。B: 月のまわりの雲の帯、M: 谷の東のもや。
      // 切り抜けないときは焼いた柔らかい絵（puff、seed・h を使う）。flip で左右を返して同じ形に見えないように
      cuts: { B: [0, 0.407, 0.172, 0.1], M: [0.677, 0.574, 0.24, 0.074] },
      hi: [   // 空の高い所の薄い雲（題字の奥、オーロラの手前）
        { cut: 'B', x: 0.36, y: 0.16, w: 0.30, h: 0.12, sp: 7.0, a: 0.85, seed: 1 },
        { cut: 'B', flip: true, x: 0.02, y: 0.30, w: 0.36, h: 0.13, sp: 5.0, a: 0.75, seed: 2 },
        { cut: 'M', x: 0.55, y: 0.40, w: 0.30, h: 0.10, sp: 6.0, a: 0.7, seed: 3 },
      ],
      lo: [   // 水平線の上の低い雲（月の前をときどき通る）
        { cut: 'B', flip: true, x: 0.45, y: 0.48, w: 0.24, h: 0.08, sp: 2.4, a: 0.75, seed: 4 },
        { cut: 'M', x: 0.0, y: 0.52, w: 0.22, h: 0.07, sp: 2.0, a: 0.7, seed: 5 },
      ],
      mist: [ // 谷のもや
        { cut: 'M', x: 0.28, y: 0.70, w: 0.42, h: 0.13, sp: 3.0, a: 0.8, seed: 6 },
        { cut: 'M', flip: true, x: 0.00, y: 0.80, w: 0.40, h: 0.14, sp: 2.4, a: 0.7, seed: 7 },
        { cut: 'M', x: 0.60, y: 0.62, w: 0.34, h: 0.10, sp: 3.4, a: 0.6, seed: 8 },
      ],
      // 光の帯を出す灯火（i = beacons の番号: 0 海辺の灯台・7 遠い星の塔）。ph 位相、len 長さ（絵の幅に対して）、hz 灯から水平線までの高さ
      beams: [{ i: 0, ph: 0.6, len: 0.3, hz: 0.036 }, { i: 7, ph: 3.6, len: 0.22, hz: 0.03 }],
      volcano: [0.883, 0.457],
      sea: { moon: 0.0745, y: [0.606, 0.79], x: [0, 0.145] },   // 月の道（月の真下の海）
      motes: { x: [0.33, 0.6], y: [0.58, 0.86] },   // 命令の一覧（左下）には掛けない
    },
    phone: {
      hi: [
        { x: 0.10, y: 0.12, w: 0.70, h: 0.040, sp: 4.0, a: 0.8, seed: 1 },
        { x: 0.55, y: 0.24, w: 0.60, h: 0.035, sp: 3.0, a: 0.7, seed: 2 },
      ],
      lo: [{ x: 0.0, y: 0.45, w: 0.55, h: 0.030, sp: 2.2, a: 0.9, seed: 4 }],
      mist: [
        { x: 0.2, y: 0.56, w: 0.80, h: 0.045, sp: 2.6, a: 0.65, seed: 6 },
        { x: 0.0, y: 0.64, w: 0.70, h: 0.050, sp: 2.0, a: 0.6, seed: 7 },
      ],
      beams: [{ i: 0, ph: 0.6, len: 0.4, hz: 0.02 }], sea: null, motes: { x: [0.1, 0.6], y: [0.48, 0.66] },
    },
  };
  const BEAM_MS = 16000;   // 灯台の光が一回りする時間

  /** 値の雑音（2 次元、64 格子で回る） */
  function noise2(seed) {
    const r = R.rng('title-cloud:' + seed), p = new Float32Array(64 * 64);
    for (let i = 0; i < p.length; i++) p[i] = r.next();
    const at = (i, j) => p[((j & 63) << 6) | (i & 63)];
    return (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  }
  /** 雲・もやの柔らかい絵を 1 回だけ焼く（256×64、引き伸ばして置くとにじんだ筆の跡に見える）。kind = 'cloud'|'mist' */
  const puffs = {};
  function puff(seed, kind) {
    const key = kind + seed;
    if (puffs[key] !== undefined) return puffs[key];
    const TW = 256, TH = 64;
    const c = R.Gfx.canvas2d(TW, TH);
    puffs[key] = c || null;
    if (!c) return null;
    const x = c.getContext('2d');
    const im = x.createImageData(TW, TH), d = im.data;
    const n = noise2(seed * 7 + (kind === 'mist' ? 50 : 0));
    const fbm = (u, v) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += a * n(u * f + o * 17, v * f + o * 31); a *= 0.5; f *= 2.03; } return s; };
    const sstep = (e0, e1, v) => { const q = clamp01((v - e0) / (e1 - e0)); return q * q * (3 - 2 * q); };
    for (let j = 0; j < TH; j++) {
      const v = j / (TH - 1);
      for (let i = 0; i < TW; i++) {
        const uu = i / (TW - 1);
        const ex = Math.pow(Math.sin(Math.PI * uu), 0.7);
        let ey, dens;
        if (kind === 'mist') {
          ey = Math.exp(-Math.pow((v - 0.55) / 0.26, 2));
          dens = fbm(uu * 9, v * 2.2);
        } else {
          ey = sstep(0.02, 0.45, v) * (1 - sstep(0.62, 0.98, v));   // 下はやや平ら
          dens = fbm(uu * 7, v * 2.6);
        }
        let a = clamp01((dens * 1.25 + ex * ey * 0.9 - 1.05) * 2.4) * ex * ey;
        a = Math.pow(a, 1.25);
        // 月の光: 上の縁を明るく、下を沈んだ藍に
        const lit = clamp01(1 - v * 1.25 + (dens - 0.5) * 0.6);
        const k = (j * TW + i) * 4;
        if (kind === 'mist') { d[k] = 150 + lit * 30; d[k + 1] = 166 + lit * 30; d[k + 2] = 205 + lit * 25; }
        else { d[k] = 72 + lit * 120; d[k + 1] = 86 + lit * 118; d[k + 2] = 128 + lit * 108; }
        d[k + 3] = Math.round(a * 255);
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  S._titleAmbi = { puff, AMBI };   // 確かめ用（テスト・見本の書き出し）
  /**
   * 絵の空の層（一枚絵だけのときは key）から雲・もやを切り抜く（明るさで抜き、2×2 に縮めて星を消し、縁をぼかす）。
   * 1 か所 1 回だけ。読めない・画素を読めないときは null（呼ぶ側が puff に替える）
   */
  function plateCut(s, r) {
    if (!r) return null;
    const cuts = s.cuts || (s.cuts = {});
    const key = r.join(',');
    if (cuts[key] !== undefined) return cuts[key];
    cuts[key] = null;
    const img = s.mode === 'layers' ? s.layers[0].rec.img : s.key && s.key.img;
    if (!img || !R.Gfx.canvas2d) return null;
    try {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const sx = Math.round(r[0] * iw), sy = Math.round(r[1] * ih), sw = Math.round(r[2] * iw), sh = Math.round(r[3] * ih);
      const w = Math.max(8, Math.round(sw / 2)), h = Math.max(8, Math.round(sh / 2));
      const c = R.Gfx.canvas2d(w, h);
      if (!c) return null;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      const im = x.getImageData(0, 0, w, h), d = im.data, n = w * h;
      const L = new Float32Array(n);
      for (let i = 0; i < n; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15;
      const so = Float32Array.from(L).sort();
      const lo = so[Math.floor(n * 0.45)], hi = Math.max(lo + 1, so[Math.floor(n * 0.98)]);
      for (let j = 0; j < h; j++) {
        const ey = Math.pow(Math.sin(Math.PI * (j + 0.5) / h), 0.8);
        for (let i = 0; i < w; i++) {
          const k = j * w + i;
          let a = clamp01((L[k] - lo) / (hi - lo));
          a = a * a * (3 - 2 * a) * Math.pow(Math.sin(Math.PI * (i + 0.5) / w), 0.6) * ey;
          d[k * 4] = Math.min(255, d[k * 4] * 1.15); d[k * 4 + 1] = Math.min(255, d[k * 4 + 1] * 1.15); d[k * 4 + 2] = Math.min(255, d[k * 4 + 2] * 1.15);
          d[k * 4 + 3] = Math.round(a * 255);
        }
      }
      x.putImageData(im, 0, 0);
      cuts[key] = c;
    } catch (e) { cuts[key] = null; }
    return cuts[key];
  }
  /** 動く飾りの粒の初めの状態（画面ごと） */
  function ambiState() {
    const r = R.rng('title-ambi');
    const glints = [];
    for (let i = 0; i < 30; i++) {
      const wide = i >= 22;   // 終わりの 8 本は月の道の外の海に散らす（暗め）
      glints.push({ u: r.next(), v: Math.pow(r.next(), 1.15), wide, per: 1300 + r.next() * 2200, ph: r.next() * 6.28, len: 1.5 + r.next() * 4.5 });
    }
    const motes = [];
    for (let i = 0; i < 9; i++) motes.push({ u: r.next(), v: r.next(), rise: 3 + r.next() * 4, ph: r.next() * 6.28, sw: 4 + r.next() * 6, per: 3000 + r.next() * 3000, teal: i % 3 === 0 });
    return { glints, motes };
  }
  /**
   * 動く飾りを 1 段描く。stage = 'hi'（空の高い雲）| 'lo'（低い雲・もや・光）。どちらも land の層の後、岩場とアルンの前。
   * c = {k, base, off(par), t, alpha, A, beacons, rm}
   */
  function drawAmbient(g, stage, c) {
    const D = AMBI[c.k];
    if (!D || S._titleAmbi.off) return;   // off: 確かめ用（重さの比べ）
    const { base, t, alpha, rm } = c;
    const tc = rm ? 0 : t;   // 動きを減らす設定では雲を止めて置く
    const clouds = (list, kind, par, fade) => {
      if (!(fade > 0)) return;
      const d = c.off(par);
      for (const L of list) {
        const cut = L.cut && c.set ? plateCut(c.set, D.cuts && D.cuts[L.cut]) : null;
        const img = cut || puff(L.seed, kind);
        if (!img) continue;
        const w = L.w * base.w, h = cut ? w * cut.height / cut.width : L.h * base.h, span = base.w + w;
        const x0 = ((L.x * base.w + (L.sp * tc) / 1000) % span + span) % span - w;
        // ゆっくり濃さが揺れる（雲が育ってはほどける）。puff は薄く焼いてあるので濃さを 0.35 倍に
        const br = (rm ? 1 : 0.85 + 0.15 * Math.sin(t / 9000 + L.seed * 1.7)) * (cut ? 1 : 0.35);
        g.globalAlpha = Math.min(1, L.a * br) * fade * alpha;
        const X = base.x + d.x + x0, Y = base.y + d.y + L.y * base.h - h / 2;
        if (L.flip) { g.save(); g.translate(X + w, Y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); g.restore(); }
        else g.drawImage(img, X, Y, w, h);
      }
      g.globalAlpha = 1;
    };
    g.save();
    g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'low'; } catch (e) { /* */ }   // 柔らかい雲なので双線形で足りる（high は重い）
    if (stage === 'hi') { clouds(D.hi, 'cloud', 0.15, c.A.sky); g.restore(); return; }
    clouds(D.lo, 'cloud', 0.4, c.A.sky);
    clouds(D.mist, 'mist', 0.55, c.A.sky);
    g.restore();
    if (rm) return;
    const st = c.amb;
    const H = R.H;
    // 月の道のきらめき（海の上の細い横線が、ばらばらに光っては消える）
    if (D.sea && c.A.sky > 0) {
      const d = c.off(0.4), S0 = D.sea;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const q of st.glints) {
        const yy = S0.y[0] + q.v * (S0.y[1] - S0.y[0]);
        const spread = 0.008 + q.v * 0.03;
        const xx = q.wide ? S0.x[0] + q.u * (S0.x[1] - S0.x[0]) : S0.moon + (q.u - 0.5) * 2 * spread;
        const tw = Math.sin(t / q.per * Math.PI * 2 + q.ph);
        if (tw <= 0) continue;
        const a = Math.pow(tw, 3) * (q.wide ? 0.22 : 0.5) * (1 - q.v * 0.35) * c.A.sky * alpha;
        const px = base.x + d.x + xx * base.w + Math.sin(t / 2300 + q.ph) * 1.5, py = base.y + d.y + yy * base.h;
        const len = q.len * (0.7 + q.v * 0.9);
        g.fillStyle = `rgba(214,226,255,${a.toFixed(3)})`;
        g.fillRect(px - len / 2, py, len, 0.6 + q.v * 0.5);
      }
      g.restore();
    }
    // 灯台の光の帯（一回り BEAM_MS。遠い灯台なので帯はほぼ水平: 横を向くと長く、奥を向くと縮んで水平線へ上がり、
    // 手前を向いた一瞬だけ灯がまたたく）。命令の一覧（c.menu、前のフレームの枠）の上には掛けない（札の中で光が動くと選びの光と紛れる）
    for (const bm of D.beams || []) {
      const bp = c.beacons && c.beacons[bm.i];
      const lit = Math.min(1, c.A.beacon(bm.i));
      if (!bp || !(lit > 0)) continue;
      const o4 = c.off(0.4);
      const p = { x: base.x + bp[0] * base.w + o4.x, y: base.y + bp[1] * base.h + o4.y };
      if (p.x < -40 || p.x > R.W + 40) continue;
      const th = (t / BEAM_MS) * Math.PI * 2 + bm.ph;
      const cx = Math.cos(th), sz = Math.sin(th);          // sz > 0: 奥へ、< 0: 手前へ
      const away = Math.max(0, sz), toward = Math.max(0, -sz);
      const len = base.w * bm.len * (0.25 + 0.75 * Math.abs(cx));
      const hz = bm.hz * base.h;                           // 灯から水平線までの高さ
      const ex = cx * len, ey = -(0.15 + 0.85 * away) * hz + toward * hz * 0.5;
      const nl = Math.hypot(ex, ey) || 1, nx = -ey / nl, ny = ex / nl;
      const a0 = (0.1 + 0.12 * toward + 0.04 * away) * lit * alpha;
      g.save();
      const mr = c.menu;
      if (mr && mr.w > 0) {
        const pd = 6;
        g.beginPath(); g.rect(0, 0, R.W, R.H); g.rect(mr.x - pd, mr.y - pd, mr.w + pd * 2, mr.h + pd * 2); g.clip('evenodd');
      }
      g.globalCompositeOperation = 'lighter';
      for (const [wk, ak] of [[0.12, 0.45], [0.045, 1]]) {
        const hw = 1.2 + nl * wk;
        const gr = g.createLinearGradient(p.x, p.y, p.x + ex, p.y + ey);
        gr.addColorStop(0, `rgba(255,236,196,${(a0 * ak).toFixed(3)})`); gr.addColorStop(0.55, `rgba(255,236,196,${(a0 * ak * 0.4).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,236,196,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(p.x, p.y);
        g.lineTo(p.x + ex + nx * hw, p.y + ey + ny * hw); g.lineTo(p.x + ex - nx * hw, p.y + ey - ny * hw); g.closePath(); g.fill();
      }
      g.restore();
      const flash = Math.pow(toward, 8);
      if (flash > 0.01) R.UIK.glow(g, p.x, p.y, H * (0.025 + 0.03 * flash), [255, 236, 200], 0.5 * flash * lit * alpha);
    }
    // 火山の火口（ゆっくり明滅、7 秒）
    if (D.volcano && c.A.sky > 0) {
      const o4 = c.off(0.4);
      const k2 = 0.5 + 0.5 * Math.sin(t / 7000 * Math.PI * 2) * (0.7 + 0.3 * Math.sin(t / 1900));
      R.UIK.glow(g, base.x + D.volcano[0] * base.w + o4.x, base.y + D.volcano[1] * base.h + o4.y, H * 0.035, [255, 120, 60], (0.12 + 0.18 * k2) * c.A.sky * alpha);
    }
    // 谷の光の粒（灯火の熱で、ゆっくり昇っては消える）
    if (D.motes && c.A.ff > 0) {
      const d = c.off(0.55), M = D.motes;
      for (const q of st.motes) {
        const range = (M.y[1] - M.y[0]) * base.h;
        const prog = ((q.v * range + (q.rise * t) / 1000) % range) / range;   // 0 = 下、1 = 上
        const px = base.x + d.x + (M.x[0] + q.u * (M.x[1] - M.x[0])) * base.w + Math.sin(t / q.per * Math.PI * 2 + q.ph) * q.sw;
        const py = base.y + d.y + M.y[1] * base.h - prog * range;
        const a = Math.sin(prog * Math.PI) * (0.18 + 0.14 * Math.sin(t / 1300 + q.ph)) * c.A.ff * alpha;
        if (a > 0.01) R.UIK.glow(g, px, py, 3.5, q.teal ? [170, 240, 210] : [255, 206, 140], a);
      }
    }
  }

  /** 題字の上を一度だけ渡る光の筋（題字の形だけに乗る）。p = 0〜1 */
  let sweepC = null;
  function sweepLogo(g, img, x, y, w, h, p, a) {
    if (!(p > 0 && p < 1) || !(a > 0) || !R.Gfx.canvas2d) return;
    const m = g.getTransform ? g.getTransform() : null;
    const sc = (m && m.a) || 1;
    const cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
    if (!sweepC || sweepC.width !== cw || sweepC.height !== ch) sweepC = R.Gfx.canvas2d(cw, ch);
    if (!sweepC) return;
    const x2 = sweepC.getContext('2d');
    x2.setTransform(1, 0, 0, 1, 0, 0);
    x2.globalCompositeOperation = 'source-over';
    x2.clearRect(0, 0, cw, ch);
    x2.drawImage(img, 0, 0, cw, ch);
    x2.globalCompositeOperation = 'source-in';
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const bw = cw * 0.16, cx = -bw * 2 + (cw + bw * 4) * e;
    const gr = x2.createLinearGradient(cx - bw, bw * 0.45, cx + bw, -bw * 0.45);   // 少し右上がりの斜めの筋
    gr.addColorStop(0, 'rgba(255,240,205,0)'); gr.addColorStop(0.5, 'rgba(255,246,222,0.9)'); gr.addColorStop(1, 'rgba(255,240,205,0)');
    x2.fillStyle = gr; x2.fillRect(0, 0, cw, ch);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = a * Math.sin(Math.PI * p) * 0.75;
    g.drawImage(sweepC, x, y, w, h);
    g.restore();
  }

  /** 一枚絵の背景（光・粒まで）。描けたら true。o = {t: 出てきてからの ms, alpha, flare} */
  function drawArt(g, v, o) {
    const k = R.layout === 'tall' ? 'phone' : 'wide';
    const s = artSet(k);
    if (s.mode === 'wait' || s.mode === 'none') return null;
    const m = s.m, t = R.Engine.time;
    const st = v.fx || (v.fx = fxState());
    const dt = st.last == null ? 16 : Math.max(0, Math.min(100, t - st.last));
    st.last = t;
    const A = introAt(o.t);
    const base = cover(m);
    const maxX = 7, maxY = 5;
    const off = (par) => ({ x: -st.ax * par * maxX, y: -st.ay * par * maxY });
    const at = (p, par) => { const d = off(par); return { x: base.x + p[0] * base.w + d.x, y: base.y + p[1] * base.h + d.y }; };
    g.save();
    g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'high'; } catch (e) { /* */ }
    g.fillStyle = '#04050c'; g.fillRect(0, 0, R.W, R.H);
    const put = (img, par, a, zoom) => {
      if (!(a > 0.001) || !img) return;
      const d = off(par), z = zoom || 1;
      const w = base.w * z, h = base.h * z;
      g.globalAlpha = a * o.alpha;
      g.drawImage(img, base.x + d.x - (w - base.w) / 2, base.y + d.y - (h - base.h) / 2, w, h);
    };
    const par = (p) => (s.mode === 'layers' ? p : 0);
    // 動く飾り（雲・もや・灯台の光の帯・きらめき・粒）。層の間に挟む（一枚絵だけのときは絵の上に全部）
    const amb = { k, base, off: (p) => off(par(p)), t, alpha: o.alpha, A, beacons: m.beacons, set: s, menu: v.list && v.list.rect, rm: reduce(), amb: st.amb || (st.amb = ambiState()) };
    const ambient = (stage) => { g.save(); g.globalAlpha = 1; drawAmbient(g, stage, amb); g.restore(); };
    if (s.mode === 'layers') {
      const slow = reduce() ? 1 : 1 + 0.005 * (1 - Math.cos(t / 60000 * Math.PI * 2));   // 60 秒で 1% 寄って戻る
      const L = s.layers;
      put(L[0].rec.img, L[0].par, A.sky, A.zoom * slow);
      put(L[1].rec.img, L[1].par, A.sky, 1);   // land の層は空の下半分まで覆うので、雲はその上に置く（アルンと岩場が雲の手前）
      ambient('hi'); ambient('lo');
      put(L[2].rec.img, L[2].par, A.crag, 1);
      put(L[3].rec.img, L[3].par, A.crag, 1);
    } else {
      put(s.key.img, 0, A.sky, 1);
      ambient('hi'); ambient('lo');
    }
    g.globalAlpha = 1;
    g.restore();
    const H = R.H, alpha = o.alpha;
    // 八つの灯火（左の灯台から奥へ順にともる。4〜7 秒で ±25% 瞬く）
    (m.beacons || []).forEach((b, i) => {
      const lit = A.beacon(i);
      if (!(lit > 0)) return;
      const tw = st.tw[i % st.tw.length];
      const tk = reduce() ? 1 : 1 + 0.25 * Math.sin(t / tw.per * Math.PI * 2 + tw.ph);
      const p = at(b, par(0.4));
      R.UIK.glow(g, p.x, p.y, H * 0.018 * (lit > 1 ? 1 + (lit - 1) : 1), [255, 190, 110], 0.35 * Math.min(lit, 1.4) * tk * alpha);
    });
    // ランタン
    const lanP = at(m.lantern || [0.5, 0.5], par(1));
    let flick = 0.9 + 0.1 * (Math.sin(t / 130) * 0.5 + Math.sin(t / 370 + 1.3) * 0.5);
    if (lessFlash() || reduce()) flick = 1 - (1 - flick) / 3;
    const breath = reduce() ? 1 : 1 + 0.06 * Math.sin(t / 5200 * Math.PI * 2);   // 光の輪がゆっくり息をする（5.2 秒）
    const lk = A.lantern * flick * breath * (o.flare || 1) * alpha;
    if (lk > 0) {
      R.UIK.glow(g, lanP.x, lanP.y, H * 0.16, [255, 170, 80], 0.35 * lk);
      R.UIK.glow(g, lanP.x, lanP.y, H * 0.035, [255, 230, 170], Math.min(1, 0.6 * lk));
    }
    // 粒（岩場・主人公の上、題字の下）
    stepFx(st, dt, t, lanP, A.embers);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const e of st.embers) {
      const f = e.age / e.life, a = (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * alpha;
      R.UIK.glow(g, e.x, e.y, e.size * 4, [255, 180, 90], 0.5 * a);
      g.fillStyle = `rgba(255,214,150,${(0.9 * a).toFixed(3)})`;
      g.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
    }
    g.restore();
    if (A.ff > 0) {
      for (const f of st.ff) {
        const rm = reduce();
        const fx = base.x + f.x * base.w + (rm ? 0 : Math.sin(t / 2100 * f.sp + f.ph) * 14) - st.ax * maxX;
        const fy = base.y + f.y * base.h + (rm ? 0 : Math.cos(t / 2700 * f.sp + f.ph) * 9) - st.ay * maxY;
        const a = rm ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / f.per * Math.PI * 2 + f.ph));
        R.UIK.glow(g, fx, fy, 6, f.teal ? [170, 240, 210] : [255, 190, 110], a * A.ff * alpha);
      }
    }
    // 流れ星（左上の空、題字に重ねない）
    if (st.star && A.logo >= 1) {
      const p = clamp01((t - st.star.t0) / 400);
      const [x0, y0, x1, y1] = k === 'wide' ? [0.58, 0.03, 0.47, 0.12] : [0.42, 0.3, 0.12, 0.34];
      const hx = R.W * (x0 + (x1 - x0) * p), hy = R.H * (y0 + (y1 - y0) * p);
      const tl = 0.25, tx = R.W * (x0 + (x1 - x0) * Math.max(0, p - tl)), ty = R.H * (y0 + (y1 - y0) * Math.max(0, p - tl));
      const a = Math.sin(p * Math.PI) * alpha;
      const gr = g.createLinearGradient(tx, ty, hx, hy);
      gr.addColorStop(0, 'rgba(220,230,255,0)'); gr.addColorStop(1, `rgba(235,240,255,${(0.85 * a).toFixed(3)})`);
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = gr; g.lineWidth = 1.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke(); g.restore();
      R.UIK.glow(g, hx, hy, 5, [230, 238, 255], 0.6 * a);
    }
    // 暗がり（#060814。絵そのものが暗いので、これ以上濃くしない）
    g.save();
    if (k === 'wide') {
      const lg = g.createLinearGradient(0, 0, R.W * 0.48, 0);
      lg.addColorStop(0, `rgba(6,8,20,${0.55 * alpha})`); lg.addColorStop(1, 'rgba(6,8,20,0)');
      g.fillStyle = lg; g.fillRect(0, 0, R.W * 0.48, R.H);
      const rx = R.W * 0.5, ry = R.H * 0.45;
      g.translate(0, R.H); g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, `rgba(6,8,20,${0.6 * alpha})`); rg.addColorStop(0.55, `rgba(6,8,20,${0.35 * alpha})`); rg.addColorStop(1, 'rgba(6,8,20,0)');
      g.fillStyle = rg; g.fillRect(0, -rx, rx, rx);
    } else {
      const tg = g.createLinearGradient(0, 0, 0, R.H * 0.25);
      tg.addColorStop(0, `rgba(6,8,20,${0.35 * alpha})`); tg.addColorStop(1, 'rgba(6,8,20,0)');
      g.fillStyle = tg; g.fillRect(0, 0, R.W, R.H * 0.25);
      const bg = g.createLinearGradient(0, R.H * 0.66, 0, R.H);
      bg.addColorStop(0, 'rgba(6,8,20,0)'); bg.addColorStop(1, `rgba(6,8,20,${0.6 * alpha})`);
      g.fillStyle = bg; g.fillRect(0, R.H * 0.66, R.W, R.H * 0.34);
    }
    g.restore();
    return { s, m, k, A, readyAt: s.readyAt };
  }
  /**
   * 題字の画像の id。日本語は 'logo'、ほかの言語は 'logo_<言語>'（例 logo_en・logo_zh-hans）が素材にあればそれ、無ければ null
   * （日本語の題字の絵は出さず、下の文字の題字にする。core/i18n.js）
   */
  function logoId() {
    const l = R.I18n ? R.I18n.lang() : 'ja';
    if (l === 'ja') return 'logo';
    const id = 'logo_' + l.toLowerCase();
    return R.Media && R.Media.entry && R.Media.entry('title', id) ? id : null;
  }
  /** 題字の画像（logo_safe の左上、幅 w × R.W。下に暗い楕円、8 つの炎の光）。描けたら true */
  function drawLogo(g, m, A, alpha) {
    if (!logoId()) return false;
    const rec = loadImg(logoId());
    if (!rec.ready || !(A.logo > 0)) return rec.ready;
    // 言語ごとの題字は自分のサイドカー（logo_en.json など）。無ければ絵の大きさだけ（炎の光は足さない）
    const id = logoId();
    const lm = id === 'logo' ? meta('logo') : Object.assign({ size: [rec.img.naturalWidth || rec.img.width, rec.img.naturalHeight || rec.img.height], anchor: {} }, meta(id));
    const ls = m.logo_safe, sf = R.safe || { l: 0, t: 0 };
    const w = ls.w * R.W, h = w * (lm.size[1] / lm.size[0]);
    const rise = reduce() ? 0 : INTRO.rise;
    const x = Math.max(sf.l + 4, ls.x * R.W), y = Math.max(sf.t + 4, ls.y * R.H) + rise * (1 - A.logo);
    const a = A.logo * alpha;
    g.save();
    // 半透明の暗い楕円（ぼかし = 幅の 8%）
    const cx = x + w / 2, cy = y + h / 2, rx = w * 0.5 + w * 0.08, ry = h * 0.5 + w * 0.08;
    g.translate(cx, cy); g.scale(1, ry / rx);
    const eg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    eg.addColorStop(0, `rgba(4,6,18,${0.47 * a})`); eg.addColorStop(1 - (w * 0.16) / rx, `rgba(4,6,18,${0.47 * a})`); eg.addColorStop(1, 'rgba(4,6,18,0)');
    g.fillStyle = eg; g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
    g.save();
    g.imageSmoothingEnabled = true;
    try { g.imageSmoothingQuality = 'high'; } catch (e) { /* */ }
    g.globalAlpha = a;
    g.drawImage(rec.img, x, y, w, h);
    g.restore();
    if (!reduce()) sweepLogo(g, rec.img, x, y, w, h, A.sweep, alpha);
    const fl = (lm.anchor && lm.anchor.flames) || [];
    fl.forEach((p, j) => {
      const f = A.flame(j);
      if (f > 0) R.UIK.glow(g, x + p[0] * w, y + p[1] * h, w * 0.04, [255, 205, 120], 0.55 * f * alpha);
    });
    return true;
  }
  S.def('title', {
    opaque: true, frost: false, touch: 'none',
    init(p) {
      this.cont = newest();
      const any = R.Save.cards().some((e) => e.card && !e.card.bad);
      const rows = [];
      if (this.cont) rows.push({ label: R.T('ui.title.continue.label'), value: 'continue' });
      rows.push({ label: R.T('ui.title.new.label'), value: 'new' });
      if (!this.cont) rows.push({ label: R.T('ui.title.continue.label'), value: 'continue', disabled: true });
      if (any) rows.push({ label: R.T('ui.title.load.label'), value: 'load' });
      rows.push({ label: R.T('ui.title.passphrase.label'), value: 'passphrase' });
      rows.push({ label: R.T('ui.title.settings.label'), value: 'settings' });
      rows.push({ label: R.T('ui.title.credits.label'), value: 'credits' });
      this.rows = rows;
      this.list = new R.UIK.List({ rows, rowH: 44, tall: true });
      this.list.onSelect = (row) => this.pick(row);
      this.busy = false;
      // 起動して最初: 出てくる順（§4）。ほかの画面から戻ったとき・動きを減らす設定: 全体を 0.6 秒のフェードだけ
      this.intro = !!(p && p.intro) && !reduce();
      this.skipped = false;
      this.t0 = R.Engine.time;
      this.openedAt = R.Engine.time;
      this.artWait = false;
      this.flare = null;
      this.fx = null;
      this.codeShown = false;
      if (logoId()) loadImg(logoId());
      artSet(R.layout === 'tall' ? 'phone' : 'wide');
    },
    /** 開いてからの時刻（とばした後・戻ったときは出そろった後） */
    introT() { return this.intro && !this.skipped ? R.Engine.time - this.t0 : 1e9; },
    async pick(row) {
      if (this.busy) return;
      const v = row.value;
      if (v === 'new') {
        // はじめから: ランタンの光を 0.3 秒で 1.6 倍 → 暗転 260 ms。BGM は 800 ms で消える（§5）
        this.busy = true;
        this.flare = { t0: R.Engine.time };
        try { R.Audio.stopBgm(800); } catch (e) { /* */ }
        await R.wait(300);
        await R.Engine.fadeTo(1, 260);
        this.close({ cmd: 'new', faded: true });
        return;
      }
      if (v === 'continue') { if (this.cont) this.close({ cmd: 'continue', slot: this.cont.slot }); return; }
      this.busy = true;
      try {
        if (v === 'load') { const r = await S.open('load'); if (r && r.slot) { this.close({ cmd: 'load', slot: r.slot }); return; } }
        else if (v === 'passphrase') { const ok = await S.open('passphrase', { mode: 'enter' }); if (ok) { this.close({ cmd: 'passphrase' }); return; } }
        else if (v === 'settings') await S.open('settings');
        else if (v === 'credits') {
          await S.note(this, { title: R.T('ui.title.pick.title'), lines: [
            { text: R.T('ui.title.pick.lines.0.text'), color: T().color.goldHi },
            // 持ち主 2026-09-28「企画・制作 Studio Metem でいい。書体とか音楽とかの項目は要らない」
            //   （書体の OFL の文は、配布物の中の v2/assets/fonts/OFL_*.txt で満たす）
            R.T('ui.title.pick.lines.1'),
          ] });
        }
      } finally { this.busy = false; }
    },
    update() {
      if (this.busy) return;
      const I = R.Input;
      if (this.artWait) {   // 絵を読んでいる間は暗いまま（下の draw）。押したら出てくる順をとばす（押した分を捨てない）
        if (this.intro && ((I.BTN || []).some((b) => I.pressed(b)) || (I.pointer && I.pointer.pressed))) this.skipped = true;
        return;
      }
      if (this.intro && !this.skipped && R.Engine.time - this.t0 < INTRO.input) {
        // どのキーでも残りをとばしてすぐ操作できるように
        const any = (I.BTN || []).some((b) => I.pressed(b)) || (I.pointer && I.pointer.pressed);
        if (any) this.skipped = true;
        return;
      }
      this.list.update();
    },
    draw(g) {
      const C = T().color, tall = R.layout === 'tall', s = R.safe;
      const t = this.introT();
      const A = introAt(t);
      const flare = this.flare ? 1 + 0.6 * easeOut((R.Engine.time - this.flare.t0) / 300) : 1;
      const art = drawArt(g, this, { t, alpha: 1, flare });
      // 読み終わるまでは暗いまま待つ（オーナー 2026-09-27: 古いコードの背景が一瞬出てから絵に替わるのをやめる）。
      // 出てくる順（§4）は絵が読めてから始める。ART_WAIT ms たっても読めない・読めないと分かったときだけコードの背景
      this.artWait = false;
      const logoRec = logoId() ? loadImg(logoId()) : { ready: false, failed: true }, logoWait = !logoRec.ready && !logoRec.failed;
      if ((logoWait || (!art && artSet(tall ? 'phone' : 'wide').mode === 'wait')) && R.Engine.time - this.openedAt < ART_WAIT) {
        this.artWait = true;
        if (this.intro && !this.skipped) this.t0 = R.Engine.time;
        g.fillStyle = '#04050c'; g.fillRect(0, 0, R.W, R.H);
        return;
      }
      if (!art) {
        drawBg(g);
        this.codeShown = true;
        if (A.sky < 1) { g.save(); g.globalAlpha = 1 - A.sky; g.fillStyle = '#04050c'; g.fillRect(0, 0, R.W, R.H); g.restore(); }
      } else if (this.codeShown && R.Engine.time - art.readyAt < 600) {
        g.save(); g.globalAlpha = 1 - (R.Engine.time - art.readyAt) / 600; drawBg(g); g.restore();
      }
      const m = art ? art.m : meta(tall ? 'phone' : 'wide');
      // 題字（画像が読めなければ文字の題字）
      const logoOk = art ? drawLogo(g, m, A, 1) : false;
      if (!logoOk && A.logo > 0) {
        g.save(); g.globalAlpha = A.logo;
        let x, y;
        if (tall) {
          x = R.W / 2; y = s.t + R.H * 0.07;
          R.UIK.text(g, 'LUMINOUS CHRONICLE', x, y, { size: u(15), family: 'en', weight: 700, align: 'center', color: C.gold, track: u(4), shadow: true });
          R.UIK.text(g, R.TITLE, x, y + u(28), { size: u(38), weight: 700, align: 'center', grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(10,8,20,0.8)', blur: 8, maxW: R.W - u(30) });
          R.UIK.hline(g, x - u(170), x + u(170), y + u(82), 0.4, '236,201,124');
          R.UIK.text(g, R.T('ui.title.draw.text'), x, y + u(96), { size: u(18), weight: 700, align: 'center', color: C.gold, track: u(6), shadow: true });
        } else {
          x = s.l + R.W * 0.065; y = s.t + R.H * 0.17;
          // ラテン字の言語は題名そのものを飾りの書体（Cinzel）で。上の小さな英字の行は重なるので出さない
          const latin = R.I18n && R.I18n.isLatin();
          if (!latin) R.UIK.text(g, 'LUMINOUS CHRONICLE', x + u(4), y, { size: u(19), family: 'en', weight: 700, color: C.gold, track: u(7), shadow: true });
          // ラテン字の題名は長いので、主人公の絵（右）にかからない幅（画面の半分）まで字を小さくする
          const tt = latin ? R.TITLE.toUpperCase() : R.TITLE;
          let ts = latin ? 44 : 48;
          while (latin && ts > 30 && R.UIK.measure(tt, { size: u(ts), family: 'en', weight: 700 }) + u(4) * tt.length > R.W * 0.5) ts -= 1;
          R.UIK.text(g, tt, x, y + u(latin ? 22 + (44 - ts) * 0.5 : 30), { size: u(ts), family: latin ? 'en' : undefined, weight: 700, grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(10,8,20,0.8)', blur: 8, track: u(4) });
          R.UIK.hline(g, x, x + u(420), y + u(96), 0.45, '236,201,124');
          R.UIK.text(g, R.T('ui.title.draw.text'), x + u(2), y + u(112), { size: u(20), weight: 700, color: C.gold, track: u(10), shadow: true });
        }
        g.restore();
      }
      // 命令（横: x .075・y .655 から、行 44・文字 21。縦: x .15・y .75・幅 .70 のガラスの札、行 50・文字 19）
      const n = this.rows.length;
      const ms = m.menu_safe || { x: 0.075, y: 0.655, w: 0.2 };
      const footY = R.H - s.b - u(tall ? 34 : 28);
      let lr;
      if (tall) {
        this.list.rowH = 50 / 1.2;   // 縦持ちの tall は × 1.2
        const rowPx = this.list.rowPx();
        const w = Math.max(ms.w * R.W, u(260)), h = n * rowPx;
        let y = Math.max(ms.y * R.H, s.t);
        const pad = u(14);
        if (y + h + pad > footY - u(10)) y = footY - u(10) - pad - h;
        lr = { x: (R.W - w) / 2, y, w, h };
      } else {
        // 灯台の灯（x .155・y .63）を隠さないよう y .655 から。入り切らない行の数なら行を詰め、それでも入らなければ上へ
        const top0 = Math.max(ms.y * R.H, s.t), room = footY - u(12) - top0;
        let rh = Math.min(44, Math.max(34, room / n / (R.uiScale || 1)));
        this.list.rowH = rh;
        const rowPx = this.list.rowPx();
        const h = n * rowPx;
        const y = Math.min(top0, footY - u(12) - h);
        lr = { x: s.l + ms.x * R.W - u(26), y, w: Math.max(ms.w * R.W + u(40), u(230)), h };
      }
      const mA = A.menu(0);
      if (mA > 0) {
        g.save(); g.globalAlpha = mA;
        if (tall) R.UIK.panel(g, { x: lr.x - u(14), y: lr.y - u(14), w: lr.w + u(28), h: lr.h + u(28) }, { a: 0.47 });
        this.list.render = (gg, row, rect, f) => {
          const i = this.rows.indexOf(row);
          const sz = u(tall ? 19 : Math.min(21, this.list.rowH * 0.5));
          gg.save(); gg.globalAlpha = A.menu(i);
          R.UIK.text(gg, row.label, tall ? rect.x + rect.w / 2 : rect.x + u(26), rect.y + (rect.h - sz) / 2 - u(1), { size: sz, weight: f ? 700 : 500, align: tall ? 'center' : 'left', color: row.disabled ? C.disabled : f ? C.goldHi : C.text, shadow: !f, track: u(2) });
          gg.restore();
        };
        this.list.draw(g, lr);
        // 最後の記録の札（横: 命令の右 continue_card_safe、縦: 命令の札の上）
        const cur = this.rows[this.list.index];
        if (this.cont && cur && cur.value === 'continue') {
          const cw = u(262), ch = u(128);
          const cs = m.continue_card_safe || { x: 0.3 };
          const cr = tall ? { x: (R.W - cw) / 2, y: lr.y - u(14) - u(16) - ch, w: cw, h: ch }
            : { x: Math.max(cs.x * R.W, lr.x + lr.w + u(12)), y: lr.y - u(4), w: cw, h: ch };
          const cd = this.cont.card;
          R.UIK.panel(g, cr, { dense: true });
          R.UIK.text(g, R.T('ui.title.draw.text_2'), cr.x + u(16), cr.y + u(14), { size: u(12.5), weight: 700, color: C.gold, track: u(2) });
          R.UIK.text(g, `${S.slotName(this.cont.slot)}　${ago(cd.date)}`, cr.x + cr.w - u(16), cr.y + u(15), { size: u(11.5), color: C.text3, align: 'right' });
          R.UIK.text(g, cd.place || '', cr.x + u(16), cr.y + u(36), { size: u(17), weight: 700, color: C.text, maxW: cr.w - u(32) });
          R.UIK.text(g, R.T('ui.title.draw.text_3', { p0: cd.chapter ? R.T('ui.title.draw.text_4', { chapter: cd.chapter }) : R.T('ui.title.draw.text_5'), playTimeJa: S.playTimeJa(cd.playMs) }), cr.x + u(16), cr.y + u(62), { size: u(13), color: C.text2 });
          (cd.faces || []).slice(0, 4).forEach((look, i) => S.faceCircle(g, look, cr.x + u(32) + i * u(38), cr.y + u(102), u(16)));
        }
        // 左下・右下（縦持ちは R.safe.b の分だけ上げてある）
        R.UIK.text(g, `${R.COPYRIGHT || '© Studio Metem'}      ver ${R.VERSION || ''}${R.DB.config && R.DB.config.slice ? R.T('ui.title.draw.text_6') : ''}`, s.l + u(18), footY, { size: u(11.5), color: C.text3, shadow: true });
        if (!tall) S.prompts(g, [{ btn: 'a', label: R.T('ui.title.draw.0.label') }, { btn: 'up', label: R.T('ui.title.draw.1.label') }]);
        g.restore();
      } else this.list.rect = lr;
      // ほかの画面から戻ったとき: 全体を 0.6 秒のフェード
      if (!this.intro) {
        const a = 1 - easeOut((R.Engine.time - this.t0) / 600);
        if (a > 0) { g.save(); g.globalAlpha = a; g.fillStyle = '#04050c'; g.fillRect(0, 0, R.W, R.H); g.restore(); }
      }
    },
  });
})(window.RPG);
