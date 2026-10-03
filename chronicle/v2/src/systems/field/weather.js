// FIELD: 天気の層（map.weather）。地面と人の上・暗がりの膜の下に、画面の座標で描く（重さは粒の数の上限と 1 枚の膜だけ）。
//   'snow'      しんしんと降る雪（ゆっくり、少し横に流れる）
//   'blizzard'  吹雪（多く、速く、横に流れる。うすい白い幕）
//   'mist'      内海の白い霧（少なく大きい粒がゆっくり流れる。うすい白い幕）
//   ── 地方の天気（持ち主 2026-10-04）
//   'sandstorm' 砂嵐（横に走る砂の筋・黄色い幕・ときどき強まる風の帯）            砂漠の開けた野
//   'heat'      陽炎（地面の上の細い横の帯をわずかに揺らす・暖かい幕・立ちのぼるもや） 砂漠の野。空が明るいほど出やすい
//   'fog'       濃い霧（大きくやわらかい霧の塊がゆっくり流れる。先頭のまわりは薄く）   沼地
//   'drizzle'   海の霧雨（細い斜めの雨脚・岸の波しぶき）                          群島
//   'ash'       灰（灰色の欠片が舞い落ちる・ときどき火の粉が立ちのぼる）            灰の荒野
//   'rays'      木漏れ日（斜めの光の筋・舞う木の葉。夜は青白い月の光、空が明けるほど暖かく） 森
//   'leaves'    風の木の葉（光の筋なし、木の葉だけ多め）                         風の丘
//   'stars'     流れ星と星くず（夜空が暗いほど流れ星が多い）                     高地（オルビス）
//   map.weather があればそれ（map.weatherCond があればその条件（R.State.check）が真の間だけ、偽なら map.weatherElse）。
//   map.weather が無い地図は下の AUTO（地図 id → 候補）から、入るたびに決まった乱数（地図・セーブの種・来た回数・歩数）で 1 つ選ぶ（晴れもある）。
//   候補 {k, p（選ばれる率）, i（強さ 0〜1、既定 1）, c（条件。R.State.check）, sky（'night' = 夜空の星の量・'day' = 空の明るさを率に掛ける）}
//   設定の reduceMotion か効果 off なら描かない。効果 low は粒を半分・陽炎の揺れなし。
//   F.weatherNow() → {kind, i}|null（いまの天気。テスト用）、F._wxForce = {kind, i}（撮影・テストで上書き。null で戻す）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const KIND = {
    snow: { n: 70, vy: 26, vx: 8, sway: 10, r: [1.2, 2.6], a: 0.75, veil: 0 },
    blizzard: { n: 170, vy: 70, vx: 120, sway: 18, r: [1, 2.8], a: 0.8, veil: 0.1 },
    // 内海の白い霧（STORY_BIBLE §4.3 の T4〜T7。maps/story_links.js）: 粒は少なく、ゆっくり横に流れる白いもや
    mist: { n: 26, vy: 2, vx: 10, sway: 6, r: [10, 22], a: 0.08, veil: 0.09 },
  };
  // 地方の天気の描き方（下の DRAW）。粒の上限は 1920×1080 の効果 high で 1 画面 120 個まで
  const DRAW = {};
  // 地図 id → 候補。町・屋内はほとんど晴れ（合う所だけ弱く）
  const DESERT_HARD = '!cleared_r_desert', ASH_HARD = '!cleared_r_ash';
  const AUTO = {
    // 砂漠: 開けた野は砂嵐（解決の前は多い）、ほかは陽炎
    d_west: [{ k: 'sandstorm', p: 0.45, c: DESERT_HARD }, { k: 'sandstorm', p: 0.2, i: 0.6, c: 'cleared_r_desert' }, { k: 'heat', p: 0.3, sky: 'day' }],
    d_south: [{ k: 'sandstorm', p: 0.4, c: DESERT_HARD }, { k: 'sandstorm', p: 0.15, i: 0.6, c: 'cleared_r_desert' }, { k: 'heat', p: 0.35, sky: 'day' }],
    d_pass: [{ k: 'sandstorm', p: 0.55 }, { k: 'heat', p: 0.15, sky: 'day' }],
    d_east: [{ k: 'heat', p: 0.5, sky: 'day' }, { k: 'sandstorm', p: 0.2, i: 0.7 }],
    d_caravan: [{ k: 'heat', p: 0.45, sky: 'day' }, { k: 'sandstorm', p: 0.15, i: 0.6 }],
    d_hollow: [{ k: 'heat', p: 0.55, sky: 'day' }],
    d_coast: [{ k: 'heat', p: 0.3, i: 0.7, sky: 'day' }],
    desert_rocks: [{ k: 'sandstorm', p: 0.3, i: 0.7 }, { k: 'heat', p: 0.25, sky: 'day' }],
    desert_oldcamp: [{ k: 'heat', p: 0.35, i: 0.8, sky: 'day' }],
    desert_mirage: [{ k: 'heat', p: 0.7, i: 0.8 }],   // 蜃気楼の町（名前どおり、町でも揺らぐ）
    // 沼地: 濃い霧
    m_bog: [{ k: 'fog', p: 0.75 }], m_fen: [{ k: 'fog', p: 0.6 }], m_lotus: [{ k: 'fog', p: 0.5, i: 0.8 }],
    m_manor: [{ k: 'fog', p: 0.7 }], m_north: [{ k: 'fog', p: 0.5 }], m_west: [{ k: 'fog', p: 0.55 }],
    marsh_bog: [{ k: 'fog', p: 0.6, i: 0.85 }],
    loch: [{ k: 'fog', p: 0.3, i: 0.45 }],   // 湖の町: 朝霧ほどの薄さ
    // 群島: 霧雨と岸のしぶき
    i_cape: [{ k: 'drizzle', p: 0.5 }], i_cliff: [{ k: 'drizzle', p: 0.5 }], i_cove: [{ k: 'drizzle', p: 0.45 }],
    i_crab: [{ k: 'drizzle', p: 0.4, i: 0.8 }], i_light: [{ k: 'drizzle', p: 0.5 }], i_siren: [{ k: 'drizzle', p: 0.55 }],
    i_wreck: [{ k: 'drizzle', p: 0.5 }],
    coral: [{ k: 'drizzle', p: 0.25, i: 0.5 }], nerei: [{ k: 'drizzle', p: 0.25, i: 0.5 }],
    // 灰の荒野: 灰と火の粉（解決の後は薄く、たまに）
    a_battle: [{ k: 'ash', p: 0.7, c: ASH_HARD }, { k: 'ash', p: 0.35, i: 0.5, c: 'cleared_r_ash' }],
    a_beach: [{ k: 'ash', p: 0.5, i: 0.8, c: ASH_HARD }, { k: 'ash', p: 0.25, i: 0.4, c: 'cleared_r_ash' }],
    a_bridge: [{ k: 'ash', p: 0.7, c: ASH_HARD }, { k: 'ash', p: 0.35, i: 0.5, c: 'cleared_r_ash' }],
    a_foot: [{ k: 'ash', p: 0.75, c: ASH_HARD }, { k: 'ash', p: 0.4, i: 0.5, c: 'cleared_r_ash' }],
    a_lava: [{ k: 'ash', p: 0.85, i: 1, c: ASH_HARD }, { k: 'ash', p: 0.5, i: 0.6, c: 'cleared_r_ash' }],
    a_pass: [{ k: 'ash', p: 0.7, c: ASH_HARD }, { k: 'ash', p: 0.35, i: 0.5, c: 'cleared_r_ash' }],
    a_spa: [{ k: 'ash', p: 0.3, i: 0.5 }],
    caldera: [{ k: 'ash', p: 0.3, i: 0.4 }],
    // 森: 木漏れ日と木の葉
    f_cross: [{ k: 'rays', p: 0.45 }], f_fern: [{ k: 'rays', p: 0.5 }], f_hut: [{ k: 'rays', p: 0.45 }],
    f_south: [{ k: 'rays', p: 0.5 }], f_windhill: [{ k: 'leaves', p: 0.6 }, { k: 'rays', p: 0.15, i: 0.7 }],
    verda_1: [{ k: 'rays', p: 0.4, i: 0.8 }], verda_2: [{ k: 'rays', p: 0.4, i: 0.8 }],
    yura: [{ k: 'rays', p: 0.3, i: 0.6 }], fern: [{ k: 'leaves', p: 0.3, i: 0.5 }],
    // 高地: 流れ星と星くず（夜空の星が多いほど）
    s_crater: [{ k: 'stars', p: 0.8, sky: 'night' }], s_plateau: [{ k: 'stars', p: 0.8, sky: 'night' }],
    s_ridge: [{ k: 'stars', p: 0.75, sky: 'night' }], s_steps: [{ k: 'stars', p: 0.7, sky: 'night' }],
    star_tower_top: [{ k: 'stars', p: 0.7, sky: 'night' }],
    orbis: [{ k: 'stars', p: 0.5, i: 0.6, sky: 'night' }],
  };
  F._WX_AUTO = AUTO;

  function h(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }
  function sky() { try { return R.Sky && R.Sky.at ? R.Sky.at(R.Tier.get()) : null; } catch (e) { return null; } }
  function check(c) { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } }

  // 入るたびの決まった乱数（来た回数は地図ごと、読み込み直すと 0 から。セーブの種と歩数も混ぜる）
  const VISIT = { id: null, n: {}, pick: null, mapRef: null };
  function roll(m) {
    const G = R.Game || {};
    const n = (VISIT.n[m.id] = (VISIT.n[m.id] || 0) + 1);
    const seed = R.U && R.U.hash ? R.U.hash(m.id + '|' + (G.seed | 0) + '|' + n + '|' + ((G.steps | 0) >> 5)) : n * 7919;
    const r = h(seed % 100003, 9);
    const list = AUTO[m.id];
    if (!list) return null;
    const S = sky();
    let acc = 0;
    for (const e of list) {
      if (!check(e.c)) continue;
      let p = e.p;
      if (e.sky === 'night') p *= S ? Math.min(1, S.stars + 0.15) : 1;
      else if (e.sky === 'day') p *= S ? 0.7 + 0.6 * (1 - S.stars) : 1;   // 空が明るいほど出やすい（深い夜でも 0.7 倍は出る）
      acc += p;
      if (r < acc) return { kind: e.k, i: e.i != null ? e.i : 1, seed };
    }
    return null;
  }
  function current(m) {
    // 地図が替わったときだけ振り直す（戦闘から戻る・メニューを閉じるでは変わらない）
    if (VISIT.mapRef !== m) { VISIT.id = m.id; VISIT.mapRef = m; VISIT.pick = !m.weather && AUTO[m.id] ? roll(m) : null; }
    if (F._wxForce) return F._wxForce;
    if (m.weather) {
      let kind = m.weather;
      if (m.weatherCond != null && !check(m.weatherCond)) kind = m.weatherElse || null;
      return kind ? { kind, i: 1 } : null;
    }
    return VISIT.pick;
  }
  F.weatherNow = function () { const m = F._s && F._s.map; return m ? current(m) : null; };

  F._weather = function (g, m, cx, cy, t) {
    const cur = current(m);
    if (!cur) return;
    try { if (R.Settings.get('reduceMotion')) return; } catch (e) { /* */ }
    const q = R.Hd && R.Hd.quality ? R.Hd.quality() : 'high';
    if (q === 'off') return;
    if (DRAW[cur.kind]) { g.save(); DRAW[cur.kind](g, m, cx, cy, t, cur.i == null ? 1 : cur.i, q === 'low', cur); g.restore(); return; }
    const K = KIND[cur.kind];
    if (!K) return;
    const W = R.W, H = R.H, tm = R.Engine.time / 1000, n = q === 'low' ? K.n >> 1 : K.n;
    g.save();
    if (K.veil) { g.fillStyle = `rgba(220,228,244,${K.veil})`; g.fillRect(0, 0, W, H); }
    // カメラに合わせて少しずらす（歩くと雪が流れて見える）
    const ox = cx * 0.6, oy = cy * 0.6;
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + h(i, 1) * 0.8, r = K.r[0] + h(i, 2) * (K.r[1] - K.r[0]);
      let x = h(i, 3) * (W + 40) + (K.vx * sp) * tm + Math.sin(tm * 1.3 + i) * K.sway - ox;
      let y = h(i, 4) * (H + 40) + (K.vy * sp) * tm - oy;
      x = ((x % (W + 40)) + (W + 40)) % (W + 40) - 20; y = ((y % (H + 40)) + (H + 40)) % (H + 40) - 20;
      g.globalAlpha = K.a * (0.45 + 0.55 * h(i, 5));
      g.fillStyle = '#eef3ff';
      g.fillRect(x, y, r, r);
    }
    g.restore();
  };

  // ================================================================ 道具
  const wrap = (v, span) => ((v % span) + span) % span;
  // やわらかい丸（中心が濃く外へ消える）を 1 回だけ焼く。色ごとに 1 枚
  const blobs = {};
  function blob(rgb) {
    if (blobs[rgb]) return blobs[rgb];
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.45, `rgba(${rgb},0.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return (blobs[rgb] = c);
  }
  // 光の筋（縦に長く、上下の端と左右の縁が消える）を 1 回だけ焼く
  let shaft = null;
  function shaftImg() {
    if (shaft || typeof document === 'undefined') return shaft;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    const gx = x.createLinearGradient(0, 0, 64, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gx; x.fillRect(0, 0, 64, 256);
    x.globalCompositeOperation = 'destination-in';
    const gy = x.createLinearGradient(0, 0, 0, 256);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.2, 'rgba(0,0,0,0.9)'); gy.addColorStop(0.65, 'rgba(0,0,0,0.6)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gy; x.fillRect(0, 0, 64, 256);
    return (shaft = c);
  }
  // 先頭のいる所（画面の座標）。霧を薄くする・見やすさのため
  function leadAt(t, cx, cy) {
    const p = F.pos;
    if (!p) return { x: R.W / 2, y: R.H / 2 };
    return { x: (p.x + 0.5) * t - cx, y: (p.y + 0.5) * t - cy };
  }
  // 粒の数: 画面の広さ（960×540 を 1）に合わせ、効果 low で半分
  function count(base, low, i) { const k = Math.min(1.6, (R.W * R.H) / (960 * 540)); return Math.max(1, Math.round(base * k * (low ? 0.5 : 1) * (0.4 + 0.6 * i))); }

  // ================================================================ 砂嵐
  DRAW.sandstorm = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    // 風の強さは 7 秒ほどの周期でうねる（0.55〜1）
    const gust = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(tm * 0.9) * Math.sin(tm * 0.37 + 1));
    g.fillStyle = `rgba(214,170,96,${(0.13 + 0.08 * gust) * I})`;
    g.fillRect(0, 0, W, H);
    // 風の帯（大きく横に伸ばしたやわらかい砂のもや）
    const b = blob('214,176,112');
    if (b) {
      g.imageSmoothingEnabled = true;
      const nb = low ? 2 : 4;
      for (let k = 0; k < nb; k++) {
        const bw = W * (0.9 + h(k, 31) * 0.6), bh = 70 + h(k, 32) * 90;
        const x = wrap(h(k, 33) * W * 2 + tm * (260 + 120 * h(k, 34)) - cx * 0.9, W * 2 + bw) - bw;
        const y = wrap(h(k, 35) * H + Math.sin(tm * 0.4 + k) * 20 - cy * 0.9, H + bh) - bh * 0.5;
        g.globalAlpha = 0.3 * gust * I;
        g.drawImage(b, x, y, bw, bh);
      }
    }
    // 砂の筋（横に速く走る短い線）
    const n = count(110, low, I), ox = cx * 0.9, oy = cy * 0.9;
    g.fillStyle = '#f4dcaa';
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + h(i, 1) * 0.8, len = (14 + h(i, 2) * 34) * (0.6 + gust * 0.6);
      let x = h(i, 3) * (W + 120) + 620 * sp * tm - ox;
      let y = h(i, 4) * (H + 20) + Math.sin(tm * 2.1 + i) * 4 + 12 * sp * tm - oy;
      x = wrap(x, W + 120) - 60; y = wrap(y, H + 20) - 10;
      g.globalAlpha = (0.35 + 0.45 * h(i, 5)) * (0.6 + 0.4 * gust) * I;
      g.fillRect(x, y, len, h(i, 6) < 0.3 ? 1.5 : 1);
    }
    // 砂の粒（少し大きい点）
    g.fillStyle = '#c89a5a';
    for (let i = 0; i < (n >> 2); i++) {
      let x = h(i, 7) * (W + 40) + 480 * (0.7 + h(i, 8) * 0.6) * tm - ox;
      let y = h(i, 9) * (H + 40) + Math.sin(tm * 3 + i * 2) * 6 - oy;
      x = wrap(x, W + 40) - 20; y = wrap(y, H + 40) - 20;
      g.globalAlpha = 0.75 * I;
      g.fillRect(x, y, 2, 2);
    }
  };

  // ================================================================ 陽炎
  // 画面の画素を読み返さない（キャンバス自身からの写しはソフトの描画で 1 フレーム 300 ms かかった）。
  // 代わりに、明るい線と暗い線が対になった細い波の帯（1 回だけ焼く）を何本も、下ほど濃く、ゆっくり上へ流しながら横に揺らす
  let ripple = null;
  function rippleImg() {
    if (ripple || typeof document === 'undefined') return ripple;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 12;
    const x = c.getContext('2d');
    for (let i = 0; i < 256; i++) {
      const y = 6 + Math.sin((i / 256) * Math.PI * 6) * 2.2 + Math.sin((i / 256) * Math.PI * 14) * 0.8;
      const e = Math.min(1, i / 40, (255 - i) / 40);   // 端は消す（並べても継ぎ目が見えない）
      x.fillStyle = `rgba(255,236,200,${0.9 * e})`; x.fillRect(i, y - 1.5, 1, 1.2);
      x.fillStyle = `rgba(60,30,10,${0.6 * e})`; x.fillRect(i, y + 0.2, 1, 1.2);
    }
    return (ripple = c);
  }
  DRAW.heat = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    g.fillStyle = `rgba(255,190,110,${0.07 * I})`;
    g.fillRect(0, 0, W, H);
    const rp = rippleImg();
    if (rp) {
      g.imageSmoothingEnabled = true;
      const n = count(26, low, I), span = H * 0.8;
      for (let k = 0; k < n; k++) {
        const y = H - wrap(h(k, 45) * span + tm * (8 + h(k, 46) * 10) + cy * 0.05, span);
        const f = (y - H * 0.2) / span;   // 下ほど濃い
        const w = 180 + h(k, 47) * 220;
        const x = wrap(h(k, 48) * (W + w) - cx * 0.95 + Math.sin(tm * (1.6 + h(k, 49)) + k) * 10, W + w) - w * 0.5;
        g.globalAlpha = Math.max(0, f) * 0.22 * I * (0.6 + 0.4 * Math.sin(tm * 2.3 + k * 1.3));
        g.drawImage(rp, x - w / 2, y, w, 10 + h(k, 50) * 6);
      }
    }
    // 立ちのぼるもや（大きく薄い暖かい塊がゆっくり上へ）
    const b = blob('255,214,160');
    if (b) {
      g.imageSmoothingEnabled = true;
      const nb = low ? 3 : 6;
      for (let k = 0; k < nb; k++) {
        const bw = 220 + h(k, 41) * 200, bh = bw * 0.45;
        const x = wrap(h(k, 42) * W - cx * 0.95 + Math.sin(tm * 0.3 + k) * 30, W + bw) - bw * 0.5;
        const y = wrap(h(k, 43) * H - tm * (10 + h(k, 44) * 8) - cy * 0.95, H + bh) - bh * 0.5;
        g.globalAlpha = 0.12 * I;
        g.drawImage(b, x - bw / 2, y - bh / 2, bw, bh);
      }
    }
  };

  // ================================================================ 濃い霧（沼）
  DRAW.fog = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    g.fillStyle = `rgba(190,206,196,${0.12 * I})`;
    g.fillRect(0, 0, W, H);
    const b = blob('206,222,210');
    if (!b) return;
    g.imageSmoothingEnabled = true;
    const L = leadAt(t, cx, cy);
    // 霧の塊は地面に付いて（カメラとほぼ一緒に）流れる。ワールドの座標で並べ、画面に入る物だけ描く
    const nb = count(12, low, I), span = W + 700, spanY = H + 400;
    for (let k = 0; k < nb; k++) {
      const bw = 340 + h(k, 51) * 380, bh = bw * (0.38 + h(k, 52) * 0.18);
      const x = wrap(h(k, 53) * span + tm * (6 + h(k, 54) * 10) - cx * 0.85, span) - 350;
      const y = wrap(h(k, 55) * spanY + Math.sin(tm * 0.12 + k) * 18 - cy * 0.85, spanY) - 200;
      // 先頭のまわり（半径 150 px）は薄く: 人と足もとが読める
      const d = Math.hypot(x - L.x, y - L.y), near = Math.min(1, Math.max(0.3, (d - 60) / 240));
      g.globalAlpha = (0.32 + 0.18 * h(k, 56)) * I * near * (0.8 + 0.2 * Math.sin(tm * 0.25 + k * 1.7));
      g.drawImage(b, x - bw / 2, y - bh / 2, bw, bh);
    }
  };

  // ================================================================ 霧雨（群島）
  // 岸のマス（水で、上下左右のどれかが陸）を地図ごとに 1 回だけ数える
  const shores = new WeakMap();
  function shoreCells(m) {
    let s = shores.get(m);
    if (s) return s;
    s = [];
    try {
      const grid = R.MapUtil.grid(m), T = R.Terrain, out = m.outside || 'sea';
      const wat = (x, y) => {
        const row = grid[y];
        const ch = row == null || x < 0 || x >= row.length ? null : row.charAt(x);
        const e = ch != null && m.legend && m.legend[ch];
        const mat = e ? e.mat : out;
        return !!(T && T._matInfo && T._matInfo(mat).water);
      };
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!wat(x, y)) continue;
        if (!wat(x + 1, y) || !wat(x - 1, y) || !wat(x, y + 1) || !wat(x, y - 1)) s.push(x, y);
      }
    } catch (e) { s = []; }
    shores.set(m, s);
    return s;
  }
  DRAW.drizzle = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    g.fillStyle = `rgba(176,196,220,${0.09 * I})`;
    g.fillRect(0, 0, W, H);
    // 雨脚（細く斜めの短い線）
    const n = count(80, low, I), ox = cx * 0.5, oy = cy * 0.5;
    g.strokeStyle = '#cfe0f4';
    g.lineWidth = 1;
    g.beginPath();
    g.globalAlpha = 0.5 * I;
    for (let i = 0; i < n; i++) {
      const sp = 0.7 + h(i, 1) * 0.6, len = 7 + h(i, 2) * 7;
      let x = h(i, 3) * (W + 60) - 90 * sp * tm - ox;
      let y = h(i, 4) * (H + 60) + 300 * sp * tm - oy;
      x = wrap(x, W + 60) - 30; y = wrap(y, H + 60) - 30;
      g.moveTo(x, y); g.lineTo(x - len * 0.3, y + len);
    }
    g.stroke();
    // 岸のしぶき: 画面に入る岸のマスのうち、時間の区切りごとに決まった少しだけが白く上がって消える
    const sc = shoreCells(m), b = blob('236,244,255');
    if (!b || !sc.length) return;
    g.imageSmoothingEnabled = true;
    const x0 = Math.floor(cx / t) - 1, x1 = Math.ceil((cx + W) / t) + 1, y0 = Math.floor(cy / t) - 1, y1 = Math.ceil((cy + H) / t) + 1;
    let drawn = 0;
    const cap = low ? 8 : 18;
    for (let j = 0; j < sc.length && drawn < cap; j += 2) {
      const x = sc[j], y = sc[j + 1];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const ph = h(x * 31 + y, 61) * 4, slot = Math.floor((tm + ph) / 2.6), f = (tm + ph) / 2.6 - slot;
      if (h(x * 131 + y * 17 + slot, 62) > 0.14 * I) continue;
      drawn++;
      const a = Math.sin(f * Math.PI), r = t * (0.5 + f * 0.7);
      g.globalAlpha = 0.55 * a * I;
      g.drawImage(b, (x + 0.5) * t - cx - r, (y + 0.4) * t - cy - r * 0.8 - f * t * 0.4, r * 2, r * 1.4);
    }
  };

  // ================================================================ 灰と火の粉
  DRAW.ash = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    g.fillStyle = `rgba(130,118,110,${0.1 * I})`;
    g.fillRect(0, 0, W, H);
    const n = count(80, low, I), ox = cx * 0.7, oy = cy * 0.7;
    for (let i = 0; i < n; i++) {
      const sp = 0.5 + h(i, 1) * 0.8, r = 1.6 + h(i, 2) * 2.2;
      let x = h(i, 3) * (W + 40) + 14 * sp * tm + Math.sin(tm * 0.9 + i) * 14 - ox;
      let y = h(i, 4) * (H + 40) + 22 * sp * tm - oy;
      x = wrap(x, W + 40) - 20; y = wrap(y, H + 40) - 20;
      g.globalAlpha = (0.6 + 0.4 * h(i, 5)) * Math.min(1, I + 0.2);
      g.fillStyle = h(i, 6) < 0.45 ? '#e4dcd4' : '#a8a09a';
      // ひらひら（横幅が揺れる欠片）
      g.fillRect(x, y, r * (0.5 + 0.5 * Math.abs(Math.sin(tm * 2.2 + i))), r * 0.8);
    }
    // 火の粉: いくつかが時々、下から揺れながら上り、消える
    g.globalCompositeOperation = 'lighter';
    const ne = low ? 6 : 14;
    for (let i = 0; i < ne; i++) {
      const per = 4 + h(i, 71) * 4, ph = h(i, 72) * per, slot = Math.floor((tm + ph) / per), f = (tm + ph) / per - slot;
      if (h(i * 13 + slot, 73) > 0.55 + 0.25 * I) continue;   // 出ない回もある（ときどき）
      const x = wrap(h(i * 7 + slot, 74) * W + Math.sin(f * 9 + i) * 10 - cx * 0.2, W);
      const y = H * (0.7 + h(i, 75) * 0.4) - f * H * (0.45 + h(i, 76) * 0.3);
      const fl = (1 - f) * (0.6 + 0.4 * Math.sin(tm * 20 + i * 3));
      g.globalAlpha = 0.6 * fl * Math.min(1, I + 0.3);
      g.fillStyle = '#ff7a2a';
      g.fillRect(x - 2, y - 2, 4, 4);
      g.globalAlpha = fl * Math.min(1, I + 0.3);
      g.fillStyle = '#ffd27a';
      g.fillRect(x - 0.5, y - 0.5, 1.5, 1.5);
    }
    g.globalCompositeOperation = 'source-over';
  };

  // ================================================================ 木漏れ日と木の葉
  function drawLeaves(g, cx, cy, I, low, nBase, wind) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000;
    const n = count(nBase, low, I), ox = cx * 0.8, oy = cy * 0.8;
    const COL = ['#6f9a4a', '#9cb54e', '#c9a04a', '#b0703a', '#5f8a54'];
    for (let i = 0; i < n; i++) {
      const sp = 0.6 + h(i, 1) * 0.8;
      let x = h(i, 3) * (W + 60) + wind * sp * tm + Math.sin(tm * 1.1 + i) * 18 - ox;
      let y = h(i, 4) * (H + 60) + 20 * sp * tm + Math.sin(tm * 2.3 + i * 0.7) * 6 - oy;
      x = wrap(x, W + 60) - 30; y = wrap(y, H + 60) - 30;
      const a = tm * (1.5 + h(i, 5) * 2) + i;
      g.setTransform(R.SCALE * Math.cos(a), R.SCALE * Math.sin(a) * 0.5, -R.SCALE * Math.sin(a), R.SCALE * Math.cos(a), x * R.SCALE, y * R.SCALE);
      g.globalAlpha = 0.85 * (0.6 + 0.4 * h(i, 6)) * Math.min(1, I + 0.3);
      g.fillStyle = COL[i % COL.length];
      g.fillRect(-2.5, -1.2, 5, 2.4 * Math.abs(Math.cos(tm * 3 + i)) + 0.6);
    }
    g.setTransform(R.SCALE, 0, 0, R.SCALE, 0, 0);
  }
  DRAW.rays = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000, S = sky();
    // 夜は青白い月の光、空が明けるほど暖かい日の光
    const dawn = S ? 1 - S.stars : 0;
    const img = shaftImg();
    if (img) {
      g.imageSmoothingEnabled = true;
      g.globalCompositeOperation = 'lighter';
      const tint = `rgb(${Math.round(150 + 105 * dawn)},${Math.round(180 + 50 * dawn)},${Math.round(230 - 80 * dawn)})`;
      // 筋の色をつけた 1 枚を作る（色が変わったときだけ）
      const ti = tinted(img, tint);
      const ns = low ? 3 : 5, ang = -0.42;
      for (let k = 0; k < ns; k++) {
        const sw = 60 + h(k, 81) * 90, sh = H * 1.5;
        // ワールドに少しだけ付いて（歩くと筋がゆっくりずれる）
        const x = wrap(h(k, 82) * (W + 400) - cx * 0.35, W + 400) - 200;
        const br = 0.5 + 0.5 * Math.sin(tm * (0.25 + h(k, 83) * 0.2) + k * 2.1);
        g.globalAlpha = (0.12 + 0.12 * br) * I;
        g.setTransform(R.SCALE * Math.cos(ang), R.SCALE * Math.sin(ang), -R.SCALE * Math.sin(ang), R.SCALE * Math.cos(ang), x * R.SCALE, -H * 0.15 * R.SCALE);
        g.drawImage(ti, -sw / 2, 0, sw, sh);
      }
      g.setTransform(R.SCALE, 0, 0, R.SCALE, 0, 0);
      g.globalCompositeOperation = 'source-over';
    }
    drawLeaves(g, cx, cy, I, low, 16, 26);
  };
  DRAW.leaves = function (g, m, cx, cy, t, I, low) { drawLeaves(g, cx, cy, I, low, 34, 70); };
  const tints = {};
  function tinted(img, col) {
    const key = col;
    if (tints[key]) return tints[key];
    for (const k of Object.keys(tints)) delete tints[k];   // 1 色だけ持つ
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return (tints[key] = c);
  }

  // ================================================================ 流れ星と星くず
  DRAW.stars = function (g, m, cx, cy, t, I, low) {
    const W = R.W, H = R.H, tm = R.Engine.time / 1000, S = sky();
    const night = S ? S.stars : 1;
    g.globalCompositeOperation = 'lighter';
    // 星くず（またたきながら、ゆっくり上へ漂う小さな光）
    const n = count(36, low, I), ox = cx * 0.3, oy = cy * 0.3;
    for (let i = 0; i < n; i++) {
      let x = h(i, 3) * (W + 40) + Math.sin(tm * 0.3 + i) * 12 - ox;
      let y = h(i, 4) * (H + 40) - (5 + h(i, 1) * 8) * tm - oy;
      x = wrap(x, W + 40) - 20; y = wrap(y, H + 40) - 20;
      const tw = 0.5 + 0.5 * Math.sin(tm * (1.5 + h(i, 2) * 2.5) + i * 4);
      g.globalAlpha = (0.35 + 0.65 * tw) * Math.min(1, I + 0.3);
      g.fillStyle = h(i, 5) < 0.3 ? '#ffe6b0' : '#cfe0ff';
      const r = h(i, 6) < 0.25 ? 2.4 : 1.5;
      g.fillRect(x - r / 2, y - r / 2, r, r);
      if (r > 1.5) { g.globalAlpha *= 0.35; g.fillRect(x - 2.5, y - 0.5, 5, 1); g.fillRect(x - 0.5, y - 2.5, 1, 5); }
    }
    // 流れ星: 区切り（2.8 秒）ごとに、夜空が暗いほど高い率で 1 本。0.8 秒で画面の上半分を斜めに走る
    const per = 2.8, slot = Math.floor(tm / per), f = (tm - slot * per) / 0.8;
    if (f < 1 && h(slot, 91) < (0.25 + 0.45 * night) * I) {
      const x0 = W * (0.1 + h(slot, 92) * 0.8), y0 = H * (0.04 + h(slot, 93) * 0.3);
      const dir = h(slot, 94) < 0.5 ? -1 : 1, ang = 0.35 + h(slot, 95) * 0.3, L = 140 + h(slot, 96) * 120;
      const dx = Math.cos(ang) * dir, dy = Math.sin(ang);
      const hx = x0 + dx * L * 1.6 * f, hy = y0 + dy * L * 1.6 * f, tail = L * Math.min(1, f * 2.5) * (1 - f * 0.5);
      const fade = f < 0.75 ? 1 : (1 - f) / 0.25;
      const gr = g.createLinearGradient(hx, hy, hx - dx * tail, hy - dy * tail);
      gr.addColorStop(0, `rgba(255,250,235,${0.9 * fade})`); gr.addColorStop(1, 'rgba(180,200,255,0)');
      g.globalAlpha = 1;
      g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - dx * tail, hy - dy * tail); g.stroke();
      g.fillStyle = `rgba(255,255,240,${fade})`;
      g.fillRect(hx - 1.2, hy - 1.2, 2.4, 2.4);
    }
    g.globalCompositeOperation = 'source-over';
  };
})(window.RPG);
