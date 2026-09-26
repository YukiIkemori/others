// BSCENE: 戦場の人と敵を描く（絵のキーは unit から: 味方 hd:btl:<look>:<wtype>、敵 boss ? hd:boss:<sprite> : hd:mon:<sprite>、金色は opts）。
// 絵の登録が無い（CAST・BEAST の絵がまだ）・焼けていないときは、この場で描く仮の姿（影・体・頭・武器／丸い魔物）で代える。
// 戦闘背景 hd:bbg:<id> が無いときの夜の野原（月・オーロラ・遠くの木々・地面）もここ（1 回だけ焼いて使い回す）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const A = (_.actors = {});

  function hash(s) { return R.U && R.U.hash ? R.U.hash(String(s)) : [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7); }
  const ATTACK_POSE = { sword: 'slash', greatsword: 'smash', dagger: 'thrust', bow: 'shoot', staff: 'smash' };
  A.ATTACK_POSE = ATTACK_POSE;
  const LOOP = { idle: 1, weak: 1, victory: 1, cast: 1, guard: 1, tele: 1, step: 0 };

  /** unit → 絵のキーと opts */
  A.keyOf = function (u) {
    if (u.side === 'party') return { key: `hd:btl:${u.look || u.sprite || u.id}:${u.wtype || 'sword'}`, opts: undefined };
    const sp = u.sprite || u.id;
    return { key: u.boss ? `hd:boss:${sp}` : `hd:mon:${sp}`, opts: u.golden ? { golden: true } : undefined };
  };

  /** 焼けた絵（無ければ null）。開始のときは now（§2.10: 足りない物だけ同期で焼く） */
  A.sheet = function (a, now) {
    if (!R.Hd || !R.Hd.has || !R.Hd.has(a.key)) return null;
    try { return now ? R.Hd.now(a.key, a.opts) : R.Hd.get(a.key, a.opts); } catch (e) { return null; }
  };

  // 敵の絵の高さの上限（論理 px。MODERN_UI §2.1: 魔物は人の 1.16 倍前後、ボスは段の 1.2 倍まで）。
  // 焼いた絵がこれより大きいときは縮めて置く（R.Hd.draw の scale は縮小だけ）
  const CAP = { s: 52, m: 84, l: 116, boss: 168 };
  A.scaleOf = function (a, sh) {
    if (!sh || a.side === 'party') return 1;
    const vis = (sh.meta && sh.meta.visH) || sh.h || 0;
    const cap = (a.boss ? CAP.boss : CAP[a.size] || CAP.m) * (R.layout === 'tall' ? 0.85 : 1);
    return vis > cap ? cap / vis : 1;
  };
  /** 絵の高さ（ねらいの印・数字の位置） */
  A.height = function (a) {
    const sh = a.sheetRef;
    if (sh && a.side !== 'party') return Math.max(24, ((sh.meta && sh.meta.visH) || sh.h || 60) * A.scaleOf(a, sh) * 0.95);
    if (sh && sh.anchors && sh.anchors.head) return Math.max(24, -sh.anchors.head[1] || 0) || 70;
    if (sh && sh.h) return sh.h * 0.9;
    if (a.side === 'party') return 70;
    return a.boss ? 120 : a.size === 'l' ? 78 : a.size === 'm' ? 52 : 36;
  };

  // ---------------------------------------------------------------- 仮の姿（味方）
  function partyPlaceholder(g, a, v, t) {
    const h = hash(a.look || a.uid);
    const hue = h % 360, hue2 = (h >> 9) % 360;
    const body = `hsl(${hue},32%,40%)`, bodyD = `hsl(${hue},30%,26%)`, hair = `hsl(${hue2},38%,${28 + (h >> 17) % 18}%)`;
    const skin = '#e6c3a0', skinD = '#b88f72';
    const pose = v.pose || 'idle', pt = Math.max(0, t - (v.poseT || 0));
    let lean = 0, drop = 0, arm = 0.2, weaponUp = 0;
    const bob = pose === 'idle' || pose === 'weak' ? Math.sin(t / 420 + h) * 1.2 : 0;
    if (pose === 'hit') lean = 0.18;
    if (pose === 'weak') { drop = 12; lean = -0.08; }
    if (pose === 'step') arm = -0.2;
    if (pose === 'slash' || pose === 'smash') arm = Math.min(1, pt / 180) < 0.5 ? -2.2 : 0.9;
    if (pose === 'thrust') arm = pt < 120 ? 0.2 : -1.3;
    if (pose === 'shoot') arm = -1.5;
    if (pose === 'cast' || pose === 'item') { arm = -2.4; weaponUp = 1; }
    if (pose === 'victory') { arm = -2.8; weaponUp = 1; }
    if (pose === 'guard') arm = -1.0;
    g.save();
    g.translate(Math.round(a.x + (v.dx || 0)), Math.round(a.y + (v.dy || 0)));
    if (pose === 'ko') {
      // 倒れた姿（横になる）
      g.fillStyle = bodyD; g.beginPath(); g.ellipse(4, -6, 26, 7, 0, 0, 7); g.fill();
      g.fillStyle = body; g.beginPath(); g.ellipse(2, -8, 20, 6, 0, 0, 7); g.fill();
      g.fillStyle = skin; g.beginPath(); g.arc(-22, -9, 7, 0, 7); g.fill();
      g.fillStyle = hair; g.beginPath(); g.arc(-24, -11, 7, Math.PI * 0.9, Math.PI * 2.1); g.fill();
      g.restore();
      return;
    }
    g.translate(0, drop + bob);
    g.rotate(lean);
    // 脚
    g.fillStyle = '#3a3040';
    if (pose === 'weak') { g.fillRect(-9, -14, 8, 12); g.fillRect(2, -8, 12, 7); }
    else { g.fillRect(-8, -22, 6, 22); g.fillRect(2, -22, 6, 22); g.fillStyle = '#2a2230'; g.fillRect(-9, -3, 8, 3); g.fillRect(1, -3, 8, 3); }
    // 体（服）
    g.fillStyle = bodyD; g.beginPath(); g.moveTo(-12, -22); g.lineTo(12, -22); g.lineTo(9, -46); g.lineTo(-9, -46); g.closePath(); g.fill();
    g.fillStyle = body; g.beginPath(); g.moveTo(-10, -24); g.lineTo(8, -24); g.lineTo(7, -45); g.lineTo(-8, -45); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,220,160,0.25)'; g.fillRect(-10, -30, 18, 2);
    // 頭
    g.fillStyle = skin; g.beginPath(); g.arc(-1, -55, 9.5, 0, 7); g.fill();
    g.fillStyle = skinD; g.beginPath(); g.arc(2, -53, 7, -0.4, 1.2); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(0, -58, 10.5, Math.PI * 0.95, Math.PI * 2.25); g.lineTo(9, -54); g.lineTo(3, -62); g.closePath(); g.fill();
    g.fillStyle = '#2a2436'; g.fillRect(-7, -56, 2, 3);
    // 腕と武器（左向き: 前は -x）
    g.save();
    g.translate(-6, -42);
    g.rotate(arm);
    g.fillStyle = body; g.fillRect(-3, 0, 5, 14);
    g.fillStyle = skin; g.beginPath(); g.arc(-0.5, 15, 3, 0, 7); g.fill();
    g.translate(-0.5, 15);
    g.strokeStyle = '#d8dae6'; g.lineCap = 'round';
    const w = a.wtype || 'sword';
    if (w === 'bow') { g.strokeStyle = '#8a6a44'; g.lineWidth = 2.2; g.beginPath(); g.arc(-4, 0, 14, Math.PI * 0.55, Math.PI * 1.45); g.stroke(); g.strokeStyle = 'rgba(230,230,240,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-4 + Math.cos(Math.PI * 0.55) * 14, Math.sin(Math.PI * 0.55) * 14); g.lineTo(-4 + Math.cos(Math.PI * 1.45) * 14, Math.sin(Math.PI * 1.45) * 14); g.stroke(); }
    else if (w === 'staff') { g.strokeStyle = '#7a5a3a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 10); g.lineTo(0, -26); g.stroke(); g.fillStyle = weaponUp ? '#cfe8ff' : '#9ab8e0'; g.beginPath(); g.arc(0, -28, 3.5, 0, 7); g.fill(); }
    else {
      const len = w === 'greatsword' ? 30 : w === 'dagger' ? 12 : 22;
      g.lineWidth = w === 'greatsword' ? 4 : 2.4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
      g.strokeStyle = '#b98f47'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, 1); g.lineTo(4, 1); g.stroke();
    }
    g.restore();
    g.restore();
  }

  // ---------------------------------------------------------------- 仮の姿（敵。右向き）
  function enemyPlaceholder(g, a, v, t) {
    const h = hash(a.sprite || a.id || a.uid);
    const S = a.boss ? 118 : a.size === 'l' ? 76 : a.size === 'm' ? 50 : 34;
    const hue = a.golden ? 44 : (h % 360);
    const sat = a.golden ? 70 : 26, lit = a.golden ? 55 : 42;
    const c1 = `hsl(${hue},${sat}%,${lit}%)`, c0 = `hsl(${hue},${sat}%,${lit - 16}%)`, c2 = `hsl(${hue},${sat + 6}%,${lit + 18}%)`;
    const pose = v.pose || 'idle', pt = Math.max(0, t - (v.poseT || 0));
    const bob = Math.sin(t / 380 + h) * (S * 0.03);
    const kind = a.boss ? 2 : h % 3;
    g.save();
    g.translate(Math.round(a.x + (v.dx || 0) + (pose === 'hit' ? -4 : 0) + (pose === 'attack' ? Math.min(1, pt / 120) * 10 : 0)), Math.round(a.y + (v.dy || 0)));
    if (pose === 'tele') g.translate(0, 4);
    if (kind === 0) {
      // 丸い物（スライムの類）
      const sq = 1 + Math.sin(t / 300 + h) * 0.05;
      g.fillStyle = c0; g.beginPath(); g.ellipse(0, -S * 0.36 * sq, S * 0.55 / sq, S * 0.4 * sq, 0, Math.PI, 0); g.lineTo(S * 0.55 / sq, 0); g.lineTo(-S * 0.55 / sq, 0); g.closePath(); g.fill();
      g.fillStyle = c1; g.beginPath(); g.ellipse(-S * 0.04, -S * 0.38 * sq, S * 0.46 / sq, S * 0.34 * sq, 0, Math.PI, 0); g.lineTo(S * 0.42, -S * 0.04); g.lineTo(-S * 0.5, -S * 0.04); g.closePath(); g.fill();
      g.fillStyle = c2; g.beginPath(); g.ellipse(-S * 0.18, -S * 0.56, S * 0.12, S * 0.07, -0.5, 0, 7); g.fill();
      g.fillStyle = '#20182a'; g.beginPath(); g.arc(S * 0.12, -S * 0.3, S * 0.06, 0, 7); g.arc(S * 0.3, -S * 0.3, S * 0.06, 0, 7); g.fill();
    } else if (kind === 1) {
      // 四つ足（獣の類）
      g.translate(0, bob);
      g.fillStyle = c0;
      for (const lx of [-0.34, -0.18, 0.2, 0.34]) g.fillRect(lx * S, -S * 0.3, S * 0.09, S * 0.3);
      g.fillStyle = c1; g.beginPath(); g.ellipse(0, -S * 0.42, S * 0.46, S * 0.2, -0.05, 0, 7); g.fill();
      g.beginPath(); g.ellipse(S * 0.44, -S * 0.6, S * 0.17, S * 0.14, 0.2, 0, 7); g.fill();
      g.beginPath(); g.moveTo(S * 0.52, -S * 0.54); g.lineTo(S * 0.76, -S * 0.5); g.lineTo(S * 0.54, -S * 0.46); g.fill();
      g.fillStyle = c0; g.beginPath(); g.moveTo(S * 0.36, -S * 0.72); g.lineTo(S * 0.4, -S * 0.86); g.lineTo(S * 0.46, -S * 0.72); g.fill();
      g.beginPath(); g.moveTo(-S * 0.44, -S * 0.46); g.quadraticCurveTo(-S * 0.7, -S * 0.7, -S * 0.62, -S * 0.36); g.lineTo(-S * 0.46, -S * 0.4); g.fill();
      g.fillStyle = c2; g.fillRect(-S * 0.3, -S * 0.6, S * 0.5, S * 0.04);
      g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(S * 0.5, -S * 0.63, S * 0.03, 0, 7); g.fill();
    } else {
      // 大きな影（ボス・飛ぶ物）
      g.translate(0, bob * 2);
      const wing = Math.sin(t / 260 + h) * 0.25;
      g.fillStyle = c0;
      g.beginPath(); g.moveTo(0, -S * 0.55); g.quadraticCurveTo(-S * 0.7, -S * (0.95 + wing), -S * 0.62, -S * 0.3); g.lineTo(-S * 0.1, -S * 0.4); g.fill();
      g.beginPath(); g.moveTo(0, -S * 0.55); g.quadraticCurveTo(S * 0.6, -S * (1.0 - wing), S * 0.66, -S * 0.36); g.lineTo(S * 0.1, -S * 0.4); g.fill();
      g.fillStyle = c1; g.beginPath(); g.ellipse(0, -S * 0.42, S * 0.24, S * 0.34, 0, 0, 7); g.fill();
      g.fillStyle = c0; g.fillRect(-S * 0.14, -S * 0.12, S * 0.08, S * 0.12); g.fillRect(S * 0.06, -S * 0.12, S * 0.08, S * 0.12);
      g.fillStyle = c1; g.beginPath(); g.arc(S * 0.08, -S * 0.8, S * 0.15, 0, 7); g.fill();
      g.fillStyle = c2; g.beginPath(); g.ellipse(-S * 0.06, -S * 0.5, S * 0.1, S * 0.2, 0.2, 0, 7); g.fill();
      g.shadowColor = pose === 'tele' ? '#8fd6d8' : '#ffd890'; g.shadowBlur = 8;
      g.fillStyle = pose === 'tele' ? '#c8f4f6' : '#ffe9b0'; g.beginPath(); g.arc(S * 0.14, -S * 0.82, S * 0.03, 0, 7); g.arc(S * 0.02, -S * 0.82, S * 0.03, 0, 7); g.fill();
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 描く
  const SHADOW = 'rgba(10,8,26,0.5)';
  A.shadow = function (g, st, a) {
    const v = st.vis[a.uid] || {};
    if (v.gone >= 1) return;
    const L = st.L, sc = _.layout.depth(L, a.y);
    const w = (a.side === 'party' ? 18 : a.boss ? 64 : a.size === 'l' ? 40 : a.size === 'm' ? 26 : 18) * sc;
    // 影はランタンから遠ざかる向きに少し伸びる
    const lx = L.lantern[0], ly = L.lantern[1];
    const dx = a.x - lx, dy = a.y - ly, d = Math.max(1, Math.hypot(dx, dy));
    const stretch = Math.min(0.6, d / 500);
    g.save();
    g.globalAlpha = (1 - (v.gone || 0)) * (v.appear != null ? v.appear : 1);
    g.fillStyle = SHADOW;
    g.beginPath();
    g.ellipse(a.x + (v.dx || 0) + dx / d * w * stretch, a.y + 1, w * (1 + stretch * 0.6), w * 0.28, Math.atan2(dy, dx) * 0.15, 0, 7);
    g.fill();
    g.restore();
  };

  A.draw = function (g, st, a) {
    const v = st.vis[a.uid] || {};
    if (v.gone >= 1 || v.hidden) return;
    const t = R.Engine.time;
    let pose = v.pose || 'idle';
    if (a.side === 'party' && pose === 'idle' && v.alive && v.maxHp > 0 && v.hp / v.maxHp < 0.25) pose = 'weak';
    if (a.side === 'party' && !v.alive && pose !== 'ko' && pose !== 'hit') pose = 'ko';
    const sh = A.sheet(a, false);
    a.sheetRef = sh || a.sheetRef;
    const alpha = (1 - (v.gone || 0)) * (v.appear != null ? v.appear : 1);
    g.save();
    g.globalAlpha *= alpha;
    if (sh && sh.frames && sh.frames.length) {
      const P = sh.poses || {};
      let list = P[pose] || (pose === 'weak' ? P.idle : null) || (pose === 'tele' ? P.attack : null) || (a.side === 'party' ? (P[ATTACK_POSE[a.wtype]] && /slash|smash|thrust|shoot/.test(pose) ? P[ATTACK_POSE[a.wtype]] : null) : null) || P.idle || [0];
      const fps = (sh.fps && (sh.fps[pose] || sh.fps.idle)) || 6;
      let fi = Math.floor(Math.max(0, t - (v.poseT || 0)) / 1000 * fps);
      fi = LOOP[pose] ? fi % list.length : Math.min(list.length - 1, fi);
      const fr = sh.frames[list[fi]] || sh.frames[0];
      const x = a.x + (v.dx || 0), y = a.y + (v.dy || 0);
      const sc = A.scaleOf(a, sh);
      R.Hd.draw(g, fr, x, y, sc < 1 ? { scale: sc } : {});
      if (v.flash > 0) { g.globalCompositeOperation = 'lighter'; R.Hd.draw(g, fr, x, y, sc < 1 ? { alpha: v.flash * 0.8, scale: sc } : { alpha: v.flash * 0.8 }); }
    } else {
      if (a.side === 'party') partyPlaceholder(g, a, Object.assign({}, v, { pose }), t);
      else enemyPlaceholder(g, a, Object.assign({}, v, { pose }), t);
      if (v.flash > 0) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = v.flash * 0.5 * alpha;
        const hh = A.height(a);
        const gr = g.createRadialGradient(a.x, a.y - hh / 2, 1, a.x, a.y - hh / 2, hh * 0.6);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(a.x - hh, a.y - hh * 1.2, hh * 2, hh * 1.4);
      }
    }
    g.restore();
  };

  // ---------------------------------------------------------------- 背景（hd:bbg が無いときの代わり）
  const bgCache = { key: null, c: null };
  const THEME = {
    coast: { sky: ['#0b1030', '#223160'], ground: ['#2c2a3c', '#191824'], far: '#141a36', sea: true },
    tower: { sky: ['#0c0d24', '#262646'], ground: ['#38344a', '#1c1a28'], far: '#1c1c34', stone: true },
    forest: { sky: ['#07101c', '#18283a'], ground: ['#232a2c', '#141a1c'], far: '#0d1a1e', trees: 2 },
    tree: { sky: ['#0a1016', '#1c2a26'], ground: ['#2e2a22', '#18160f'], far: '#101c16', trees: 3, roots: true },
    cave: { sky: ['#0c0a14', '#1c1826'], ground: ['#2c2632', '#16121a'], far: '#18141e', cave: true },
    night: { sky: ['#0d1030', '#2a2c52'], ground: ['#2d2838', '#1a1726'], far: '#18183a', trees: 1 },
  };
  A.theme = function (bg) {
    const s = String(bg || '');
    for (const k of Object.keys(THEME)) if (s.indexOf(k) >= 0) return k;
    return 'night';
  };
  A.fallbackBg = function (L, bg) {
    const key = `${R.W}x${R.H}:${bg}:${L.tall ? 't' : 'w'}`;
    if (bgCache.key === key && bgCache.c) return bgCache.c;
    if (typeof document === 'undefined') return null;
    const S = R.SCALE || 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(R.W * S); c.height = Math.ceil(L.stageH * S);
    const g = c.getContext('2d');
    g.scale(S, S);
    const th = THEME[A.theme(bg)];
    const W = R.W, H = L.stageH, hz = L.horizon;
    const rng = R.rng('bbg:' + key);
    // 空
    let gr = g.createLinearGradient(0, 0, 0, hz + 30);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(1, th.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, hz + 40);
    if (!th.cave) {
      for (let i = 0; i < 90; i++) { const x = rng.next() * W, y = rng.next() * hz * 0.9, r = rng.next() < 0.1 ? 1.1 : 0.6; g.fillStyle = `rgba(230,230,255,${0.3 + rng.next() * 0.5})`; g.fillRect(x, y, r, r); }
      // オーロラ
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const y0 = hz * (0.25 + i * 0.06);
        gr = g.createLinearGradient(0, y0 - 20, 0, y0 + 30);
        gr.addColorStop(0, 'rgba(80,200,190,0)'); gr.addColorStop(0.5, `rgba(80,200,190,${0.07 - i * 0.015})`); gr.addColorStop(1, 'rgba(80,200,190,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, y0 + Math.sin(x / 120 + i) * 14);
        g.lineTo(W, y0 + 40); g.lineTo(0, y0 + 40); g.fill();
      }
      // 月
      const mx = L.tall ? W * 0.55 : L.ox + 320, my = L.tall ? 110 + L.oy : 76 + L.oy;
      gr = g.createRadialGradient(mx, my, 4, mx, my, 90);
      gr.addColorStop(0, 'rgba(255,250,225,0.5)'); gr.addColorStop(1, 'rgba(255,250,225,0)');
      g.fillStyle = gr; g.fillRect(mx - 90, my - 90, 180, 180);
      g.restore();
      g.fillStyle = '#fbf6e2'; g.beginPath(); g.arc(mx, my, 20, 0, 7); g.fill();
    } else {
      // 洞窟の天井と壁
      g.fillStyle = '#120e18';
      g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 30) g.lineTo(x, 40 + rng.next() * 50 + Math.sin(x / 90) * 20);
      g.lineTo(W, 0); g.fill();
    }
    // 遠くの影（山・木々）
    g.fillStyle = th.far;
    g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, hz - 30 - Math.sin(x / 140) * 22 - rng.next() * 8);
    g.lineTo(W, hz + 10); g.lineTo(0, hz + 10); g.fill();
    if (th.trees) {
      g.fillStyle = th.trees > 1 ? '#0a1418' : '#141630';
      for (let x = -10; x < W + 10; x += 9 + rng.next() * 10) {
        const hh = (th.trees > 1 ? 40 : 18) + rng.next() * (th.trees > 1 ? 60 : 26);
        g.beginPath(); g.moveTo(x - hh * 0.22, hz + 6); g.lineTo(x, hz - hh); g.lineTo(x + hh * 0.22, hz + 6); g.fill();
      }
    }
    if (th.sea) {
      gr = g.createLinearGradient(0, hz - 6, 0, hz + 36);
      gr.addColorStop(0, '#1b2a58'); gr.addColorStop(1, '#101a3a');
      g.fillStyle = gr; g.fillRect(0, hz - 6, W, 42);
      g.fillStyle = 'rgba(200,210,255,0.18)';
      for (let i = 0; i < 40; i++) g.fillRect(rng.next() * W, hz + rng.next() * 34, 6 + rng.next() * 14, 1);
    }
    // 地面
    const gy = hz + (th.sea ? 30 : 4);
    gr = g.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, th.ground[0]); gr.addColorStop(1, th.ground[1]);
    g.fillStyle = gr; g.fillRect(0, gy, W, H - gy);
    // 地面のむら・草
    for (let i = 0; i < 420; i++) {
      const y = gy + Math.pow(rng.next(), 0.8) * (H - gy), x = rng.next() * W, s = 0.6 + (y - gy) / (H - gy);
      const lt = rng.next();
      g.fillStyle = th.stone ? `rgba(160,150,190,${0.05 + lt * 0.07})` : lt < 0.5 ? `rgba(120,140,110,${0.06 + lt * 0.1})` : `rgba(90,80,110,${0.08 + lt * 0.08})`;
      if (th.stone) g.fillRect(x, y, 10 * s, 1);
      else { g.fillRect(x, y, 1.2 * s, -3 * s); g.fillRect(x + 2 * s, y, 1.2 * s, -4.5 * s); }
    }
    if (th.stone) { g.strokeStyle = 'rgba(12,10,22,0.35)'; for (let y = gy + 14; y < H; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (th.roots) { g.strokeStyle = 'rgba(70,52,30,0.7)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); const x = rng.next() * W; g.moveTo(x, gy); g.bezierCurveTo(x + 40, gy + 40, x - 30, gy + 80, x + 20, H); g.stroke(); } }
    // 手前のぼけた縁（下端を少し暗く）
    gr = g.createLinearGradient(0, H - 70, 0, H);
    gr.addColorStop(0, 'rgba(8,8,18,0)'); gr.addColorStop(1, 'rgba(8,8,18,0.55)');
    g.fillStyle = gr; g.fillRect(0, H - 70, W, 70);
    bgCache.key = key; bgCache.c = c;
    return c;
  };

  /** ランタンの光だまり（毎フレーム。加算の絵 1 枚＋芯） */
  A.lanternPool = function (g, L, t) {
    const [x, y] = L.lantern;
    if (L.baked) {
      // 戦闘背景（hd:bbg）に光だまりとランタンが焼いてある: 揺らぎの芯だけ足す
      if (R.Settings.get('reduceMotion')) return;
      g.save(); g.globalCompositeOperation = 'lighter';
      const a = 0.12 + Math.sin(t / 130) * 0.04 + Math.sin(t / 47) * 0.02;
      const gr = g.createRadialGradient(x, y - 10, 1, x, y - 10, 70);
      gr.addColorStop(0, `rgba(255,220,160,${a})`); gr.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = gr; g.fillRect(x - 70, y - 80, 140, 140);
      g.restore();
      return;
    }
    const flick = 1 + (R.Settings.get('reduceMotion') ? 0 : Math.sin(t / 130) * 0.03 + Math.sin(t / 47) * 0.015);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const r = (L.tall ? 230 : 330) * flick;
    let gr = g.createRadialGradient(x, y, 4, x, y, r);
    gr.addColorStop(0, 'rgba(255,200,130,0.46)'); gr.addColorStop(0.25, 'rgba(250,176,100,0.26)'); gr.addColorStop(0.6, 'rgba(220,140,80,0.08)'); gr.addColorStop(1, 'rgba(220,140,80,0)');
    g.fillStyle = gr;
    g.save(); g.translate(x, y); g.scale(1, 0.55); g.translate(-x, -y); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
    gr = g.createRadialGradient(x, y - 10, 1, x, y - 10, 40);
    gr.addColorStop(0, 'rgba(255,240,200,0.8)'); gr.addColorStop(0.3, 'rgba(255,200,120,0.3)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(x - 40, y - 50, 80, 80);
    g.restore();
    // ランタンの本体
    g.save();
    g.fillStyle = '#3a2c20'; g.fillRect(x - 3, y - 14, 6, 2); g.fillRect(x - 4, y - 2, 8, 2);
    g.fillStyle = 'rgba(255,226,160,0.95)'; g.fillRect(x - 3, y - 12, 6, 10);
    g.restore();
  };
})(window.RPG);
