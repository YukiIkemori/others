// BSCENE: ボスの登場の演出（持ち主 2026-10-04「ボスの登場をちゃんと見せたい」）。scene.js の intro から呼ぶ。
//   画面が暗くなる → 地鳴りと風の音（既存の効果音 shake・wind）→ ボスの影（暗い色）がせり上がって近づく
//   → 光って姿が見える（影が抜ける・唸り・揺れ）→ 大きな名前の札（名前と肩書きは今までの札と同じ）＋始めの一言と字幕（voice_boss.js）。
//   長さ: 地方・章・最後のボス（曲が regionboss・chapterboss・lastboss… か bossType が region・prologue・last…）は長い版（約 2.8 秒）、
//         中ボスは短い版（約 1.2 秒）。同じボスとこの起動の間に 2 回目（やり直し・戦い直し）・倍速・リピート中はもっと短く（約 0.8 秒）。
//   場所（戦闘背景）の色で舞う物を変える: 砂・雪・火の粉・霧・星の光・闇・木の葉・土埃（無ければボスの属性から）。
//   動きを減らす設定: せり上がり・近づき・揺れ・舞う物を出さない（暗さと影 → 姿だけ）。閃光を減らす設定: 光を弱く。
//   時間は実時間（R.Engine.time）。ふつうの戦闘では何もしない。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const E = (_.bossEntry = {});
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* ignore */ } };
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const out3 = (k) => 1 - Math.pow(1 - cl(k), 3);
  const hr = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // 長さ（実時間 ms）: build = 暗くなってから姿が見えるまで、card = 姿が見えてから札が消えるまで
  E.MS = { long: { build: 1500, card: 1300 }, short: { build: 450, card: 750 }, quick: { build: 260, card: 540 } };
  const LONG_BGM = ['regionboss', 'chapterboss', 'lastboss', 'lastboss2', 'valzard', 'superboss', 'rival', 'hollowking'];
  const LONG_TYPE = ['region', 'prologue', 'last1', 'last2', 'echo', 'super', 'rival'];
  /** この起動の間に登場を見たボス（troop か先頭のボスの id）。2 回目からは短い */
  E.seen = new Set();
  E.log = [];   // テスト用: [{key, mode, theme, build, card}]

  // 舞う物の種類と色（rgb は 'r,g,b'。pal は画像の部品の塗り分けの 3 色: 主・明るい・深い）
  E.THEMES = {
    sand: { rgb: '232,190,120', pal: ['225,170,95', '255,236,190', '150,100,45'], img: 'wind_swirl', p: 'grain' },
    dust: { rgb: '200,165,125', pal: ['190,150,105', '240,220,190', '110,80,55'], img: 'wind_swirl', p: 'grain' },
    snow: { rgb: '215,236,255', pal: ['170,215,255', '245,252,255', '95,150,230'], img: 'wind_swirl', p: 'flake' },
    ember: { rgb: '255,140,60', pal: ['255,125,45', '255,225,150', '200,45,15'], img: null, p: 'ember' },
    mist: { rgb: '180,205,215', pal: ['160,190,205', '235,245,250', '80,110,130'], img: 'wind_swirl', p: 'mist' },
    star: { rgb: '200,215,255', pal: ['170,190,255', '250,250,255', '110,120,230'], img: 'sparkle_twinkle', p: 'star' },
    void: { rgb: '170,120,240', pal: ['160,100,240', '236,212,255', '80,30,160'], img: 'void_swirl', p: 'void' },
    leaf: { rgb: '170,225,140', pal: ['140,215,120', '235,255,220', '60,140,70'], img: 'leaf_swirl', p: 'leaf' },
  };
  const BG_THEME = {
    pyramid: 'sand', desert: 'sand', mine: 'dust', cave: 'dust', road: 'dust',
    ice: 'snow', peak: 'snow', snow: 'snow',
    volcano: 'ember', ash: 'ember',
    swamp: 'mist', marsh: 'mist', watercave: 'mist', ship: 'mist', sea: 'mist', isles: 'mist', manor: 'mist',
    tower: 'star', star: 'star',
    library: 'void', hollow: 'void', oblivion: 'void', ring: 'void',
    forest: 'leaf', tree: 'leaf',
  };
  const EL_THEME = { fire: 'ember', water: 'mist', wind: 'leaf', earth: 'dust', light: 'star', dark: 'void', ice: 'snow' };

  const defOf = (a) => (a && R.DB && R.DB.monsters && R.DB.monsters[a.id]) || null;
  /** 登場するボス（お供 bossType 'add' を除く）。無ければ先頭のボス・先頭の敵 */
  E.leads = function (st) {
    const foes = (st.actors || []).filter((a) => a.side === 'enemy');
    let ls = foes.filter((a) => a.boss && (defOf(a) || {}).bossType !== 'add');
    if (!ls.length) ls = foes.filter((a) => a.boss).slice(0, 1);
    if (!ls.length) ls = foes.slice(0, 1);
    return ls;
  };
  /** 長い版か（地方・章・最後・宿敵など） */
  E.isLong = function (st, bu) {
    const tr = st.info && st.info.troop;
    const bgm = (st.info && st.info.bgm) || (tr && tr.bgm) || '';
    if (LONG_BGM.includes(bgm)) return true;
    const d = defOf(bu);
    return !!(d && LONG_TYPE.includes(d.bossType));
  };
  E.theme = function (st, bu) {
    const bg = st.setup.bg || (st.info.troop && st.info.troop.bg) || '';
    if (BG_THEME[bg]) return BG_THEME[bg];
    const d = defOf(bu);
    return (d && EL_THEME[d.affinity]) || 'void';
  };
  const keyOf = (st, bu) => st.setup.troop || (bu && bu.id) || '';
  const fast = (st) => ((st.speed && st.speed()) || 1) > 1 || !!(st.B && st.B.repeatOn);
  /** → {mode: long|short|quick, long, build, card, theme} */
  E.plan = function (st, bu) {
    const long = E.isLong(st, bu);
    const again = st.retry > 0 || E.seen.has(keyOf(st, bu));
    const mode = again || fast(st) ? 'quick' : long ? 'long' : 'short';
    return Object.assign({ mode, long, theme: E.theme(st, bu) }, E.MS[mode]);
  };

  /** 戦闘の始め: 舞う物の画像の部品を先に読む（scene.js の intro の初め） */
  E.prepare = function (st) {
    try {
      const I = R.BFX && R.BFX.img, ls = E.leads(st);
      if (!I || !I.load || !ls.length) return;
      const T = E.THEMES[E.theme(st, ls[0])];
      if (T && T.img && I.has(T.img)) I.load(T.img);
    } catch (e) { /* 無くてもよい */ }
  };

  /** 登場の前（一行が歩いて入る間）: 主のボスを隠しておく。→ 隠した uid の表 */
  E.hide = function (st) {
    const ls = E.leads(st);
    for (const a of ls) { const v = st.vis[a.uid]; if (v) { v.appear = 0; v.dy = 0; v.sil = 1; } }
    return ls.map((a) => a.uid);
  };

  /** 登場の演出を出して、札が消えるまで待つ */
  E.run = async function (st) {
    const ls = E.leads(st);
    const bu = ls[0];
    if (!bu) return;
    const p = E.plan(st, bu);
    const rm = !!R.Settings.get('reduceMotion');
    const lf = !!R.Settings.get('lessFlash');
    const shakeOn = !rm && R.Settings.get('shake') !== 'off';
    const t0 = R.Engine.time;
    const T = E.THEMES[p.theme] || E.THEMES.void;
    st.entry = { t0, build: p.build, card: p.card, mode: p.mode, long: p.long, theme: p.theme, T, rm, lf, uids: ls.map((a) => a.uid), rev: 0, seed: (bu.uid || '').length * 31 + 7, rise: p.mode === 'long' ? 70 : p.mode === 'short' ? 36 : 20 };
    E.log.push({ key: keyOf(st, bu), mode: p.mode, theme: p.theme, build: p.build, card: p.card });
    if (E.log.length > 20) E.log.shift();
    st.log.push({ t: 'bossEntry', mode: p.mode, theme: p.theme, ms: p.build + p.card });
    // 地鳴りと風（長い版は風を 2 度）
    sfx('shake');
    setTimeout(() => { if (!st.dead) sfx('wind'); }, Math.round(p.build * 0.12));
    if (p.mode === 'long') setTimeout(() => { if (!st.dead) sfx('wind'); }, Math.round(p.build * 0.6));
    if (shakeOn) st.shake = { t0, ms: p.build, amp: p.mode === 'long' ? 2.2 : 1.6 };
    E.tick(st);
    await R.until(() => st.dead || R.Engine.time - t0 >= p.build);
    if (st.dead) return;
    // 姿が見える: 光・唸り・揺れ・大きな名前の札・始めの一言
    const rev = R.Engine.time;
    st.entry.rev = rev;
    sfx('roar');
    if (shakeOn) st.shake = { t0: rev, ms: p.mode === 'quick' ? 300 : 520, amp: p.mode === 'long' ? 6 : 5 };
    for (const uid of st.entry.uids) { const v = st.vis[uid]; if (v) v.flash = lf ? 0.4 : 1; }
    st.bossCard = { name: bu.name || '', sub: (st.info.troop && st.info.troop.title) || R.T('battle.scene.intro.bossCard.sub'), t0: rev, ms: p.card, big: p.mode === 'long', rgb: T.rgb };
    if (_.bossVoice) _.bossVoice.start(st, bu);   // 始めの一言と字幕（待たない）
    await R.until(() => st.dead || R.Engine.time - rev >= p.card);
    E.finish(st);
    E.seen.add(keyOf(st, bu));
  };
  /** 終わり（途中で閉じても）: 影を残さない */
  E.finish = function (st) {
    const en = st.entry;
    if (en) for (const uid of en.uids) { const v = st.vis[uid]; if (v) { v.sil = 0; v.appear = 1; v.dy = 0; v.sx = 1; v.sy = 1; } }
    st.entry = null;
    st.bossCard = null;
  };

  /** 毎フレーム（scene.js の update）: 影のせり上がり・近づき・抜け */
  E.tick = function (st) {
    const en = st.entry;
    if (!en) return;
    const now = R.Engine.time;
    const k = cl((now - en.t0) / en.build);
    const sil = en.rev ? 1 - cl((now - en.rev) / 260) : 1;
    for (const uid of en.uids) {
      const v = st.vis[uid];
      if (!v) continue;
      v.sil = sil;
      v.appear = en.rev ? 1 : out3(k / (en.rm ? 0.6 : 0.45));
      if (en.rm) { v.dy = 0; continue; }
      v.dy = en.rev ? 0 : en.rise * (1 - out3(k / 0.88));
      const s = en.mode === 'long' && !en.rev ? 0.86 + 0.14 * out3(k / 0.92) : 1;
      v.sx = s; v.sy = s;
    }
  };

  // ---------------------------------------------------------------- 描く（HUD の後・名前の札の前）
  function drawParts(g, en, k, env, W, Hs, bx, by, h, now) {
    const T = en.T, n = en.mode === 'long' ? 90 : en.mode === 'short' ? 46 : 26;
    const t = (now - en.t0) / 1000;
    const S = R.BFX && R.BFX.seq;
    for (let i = 0; i < n; i++) {
      const s = en.seed + i * 7.31;
      const r0 = hr(s), r1 = hr(s + 1), r2 = hr(s + 2), r3 = hr(s + 3);
      let x, y, a = env * (0.4 + 0.6 * r3);
      switch (T.p) {
        case 'grain': {   // 砂・土埃: 横に吹き抜ける細い筋
          const sp = 0.55 + r1 * 0.7;
          x = ((r0 + t * sp) % 1.2 - 0.1) * W; y = Hs * (0.15 + r2 * 0.8) + Math.sin(t * 3 + i) * 8;
          g.strokeStyle = `rgba(${T.rgb},${0.55 * a})`; g.lineWidth = 1 + r3 * 1.5;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x - 18 - r1 * 40, y + 2 + r2 * 3); g.stroke();
          break;
        }
        case 'flake': {   // 雪: 斜めに吹き付ける
          const sp = 0.35 + r1 * 0.5;
          x = ((r0 + t * sp) % 1.2 - 0.1) * W; y = ((r2 + t * sp * 0.6) % 1.1 - 0.05) * Hs;
          if (S) S.dot(g, x, y, 2 + r3 * 4, T.rgb, 0.9 * a); else { g.fillStyle = `rgba(${T.rgb},${a})`; g.fillRect(x, y, 2, 2); }
          break;
        }
        case 'ember': {   // 火の粉: 下から舞い上がって揺らぐ
          const sp = 0.18 + r1 * 0.3;
          y = Hs * (1.05 - ((r2 + t * sp) % 1.1)); x = W * r0 + Math.sin(t * 2 + i) * 14;
          const fl = 0.6 + 0.4 * Math.sin(t * 13 + i * 3);
          if (S) S.dot(g, x, y, 3 + r3 * 6, T.rgb, a * fl); else { g.fillStyle = `rgba(${T.rgb},${a * fl})`; g.fillRect(x, y, 2, 2); }
          break;
        }
        case 'mist': {   // 霧: 大きく柔らかい塊が流れる
          if (i % 3) continue;
          x = ((r0 + t * (0.05 + r1 * 0.06)) % 1.3 - 0.15) * W; y = Hs * (0.35 + r2 * 0.6);
          const rr = 50 + r3 * 90;
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, `rgba(${T.rgb},${0.22 * env})`); gr.addColorStop(1, `rgba(${T.rgb},0)`);
          g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
          break;
        }
        case 'star': {   // 星の光: またたく四つ星と昇る光の粒
          x = W * r0; y = Hs * (0.05 + r2 * 0.85) - t * 20 * r1;
          const tw = Math.max(0, Math.sin(t * (3 + r1 * 4) + i));
          if (S && i % 2) S.star(g, x, y, 3 + r3 * 5, 4, T.rgb, a * tw, 0);
          else if (S) S.dot(g, x, y, 1.5 + r3 * 3, T.rgb, a * 0.8);
          break;
        }
        case 'void': {   // 闇: ボスへ吸い込まれる粒
          const ang = r0 * Math.PI * 2, d0 = Math.max(W, Hs) * (0.35 + r1 * 0.4);
          const q = (r2 + t * (0.35 + r3 * 0.3)) % 1;
          const d = d0 * (1 - q);
          x = bx + Math.cos(ang) * d; y = by + Math.sin(ang) * d * 0.7;
          if (S) S.dot(g, x, y, 2 + r3 * 3, T.rgb, a * Math.min(1, q * 3)); else { g.fillStyle = `rgba(${T.rgb},${a})`; g.fillRect(x, y, 2, 2); }
          break;
        }
        case 'leaf': {   // 木の葉: 回りながら吹き流れる
          if (i % 2) continue;
          x = ((r0 + t * (0.25 + r1 * 0.35)) % 1.2 - 0.1) * W; y = Hs * (0.1 + r2 * 0.8) + Math.sin(t * 2.5 + i) * 18;
          g.save(); g.translate(x, y); g.rotate(t * (2 + r3 * 3) + i);
          g.fillStyle = `rgba(${T.rgb},${0.75 * a})`;
          g.beginPath(); g.ellipse(0, 0, 5 + r3 * 4, 2 + r3 * 1.5, 0, 0, Math.PI * 2); g.fill();
          g.restore();
          break;
        }
        default: break;
      }
    }
  }

  E.draw = function (g, st) {
    const en = st.entry;
    if (!en) return;
    const now = R.Engine.time;
    const k = cl((now - en.t0) / en.build);
    const rk = en.rev ? cl((now - en.rev) / en.card) : 0;   // 札の間の進み
    const W = R.W, Hs = st.L && st.L.tall ? st.L.stageH : R.H;
    const a = st.actor(en.uids[0]);
    const h = a && _.actors && _.actors.height ? _.actors.height(a) : 120;
    const v = (a && st.vis[a.uid]) || {};
    const bx = a ? a.x + (v.dx || 0) : W * 0.3, by = a ? a.y - h * 0.5 : Hs * 0.6;
    const dimMax = en.mode === 'long' ? 0.72 : en.mode === 'short' ? 0.55 : 0.4;
    // 暗さ: 入りで深くなり、姿が見えた後に札の間で明ける
    const dimK = (en.rev ? 1 - out3(rk / 0.7) : Math.min(1, k / 0.25)) * dimMax;
    // 舞う物と後ろの光の強さ: 姿が見える時が一番強い
    const env = en.rev ? 1 - cl(rk / 0.8) : 0.3 + 0.7 * k;
    g.save();
    if (st.L && st.L.tall) { g.beginPath(); g.rect(0, 0, W, Hs); g.clip(); }
    if (dimK > 0.004) {
      const gr = g.createRadialGradient(bx, by, h * 0.5, bx, by, Math.max(W, Hs) * 0.95);
      gr.addColorStop(0, `rgba(6,4,14,${dimK * 0.45})`);
      gr.addColorStop(0.35, `rgba(6,4,14,${dimK * 0.85})`);
      gr.addColorStop(1, `rgba(6,4,14,${dimK})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, Hs);
    }
    const T = en.T;
    // ボスの後ろの輪の光（影の形が読めるように。真ん中は抜く）
    g.globalCompositeOperation = 'lighter';
    {
      const rr = h * (0.95 + 0.25 * k);
      const ga = (en.lf ? 0.22 : 0.4) * env;
      const gr = g.createRadialGradient(bx, by, h * 0.25, bx, by, rr);
      gr.addColorStop(0, `rgba(${T.rgb},0)`); gr.addColorStop(0.55, `rgba(${T.rgb},${ga})`); gr.addColorStop(1, `rgba(${T.rgb},0)`);
      g.fillStyle = gr; g.fillRect(bx - rr, by - rr, rr * 2, rr * 2);
    }
    g.globalCompositeOperation = 'source-over';
    if (!en.rm) {
      // 画像の部品（読めていれば）: ボスの所の渦・立ち昇る光
      const I = R.BFX && R.BFX.img;
      if (I && T.img && I.ready && I.ready(T.img) && en.mode !== 'quick') {
        const m = I.meta(T.img) || {};
        const fi = Math.floor(((now - en.t0) / 1000) * (m.fps || 16)) % (m.n || 8);
        const foot = m.anchor && m.h && m.anchor[1] > m.h * 0.7;
        const sc = (h * 1.7) / ((m.h || 320) * (m.scale || 0.5));
        g.save();
        g.translate(bx, foot ? (a ? a.y : by + h * 0.5) : by);
        if (m.blend === 'lighter') g.globalCompositeOperation = 'lighter';
        I.drawFrame(g, T.img, fi, { s: sc, a: (m.blend === 'lighter' ? 0.3 : 0.45) * env, pal: m.tint ? T.pal : null });
        g.restore();
      }
      if (T.p === 'mist' || T.p === 'grain') drawParts(g, en, k, env, W, Hs, bx, by, h, now);
      else { g.globalCompositeOperation = 'lighter'; drawParts(g, en, k, env, W, Hs, bx, by, h, now); g.globalCompositeOperation = 'source-over'; }
    }
    // 光（姿が見える瞬間）: 画面全体の白い光＋ボスの所の光の輪
    if (en.rev) {
      const fk = 1 - cl((now - en.rev) / (en.mode === 'quick' ? 180 : 280));
      if (fk > 0) {
        const fa = (en.lf ? 0.18 : en.mode === 'quick' ? 0.4 : 0.7) * fk * fk;
        g.fillStyle = `rgba(255,250,240,${fa})`; g.fillRect(0, 0, W, Hs);
        g.globalCompositeOperation = 'lighter';
        const rr = h * (0.6 + 1.6 * (1 - fk));
        const gr = g.createRadialGradient(bx, by, 0, bx, by, rr);
        gr.addColorStop(0, `rgba(${T.pal[1]},${(en.lf ? 0.3 : 0.8) * fk})`); gr.addColorStop(1, `rgba(${T.rgb},0)`);
        g.fillStyle = gr; g.fillRect(bx - rr, by - rr, rr * 2, rr * 2);
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.restore();
  };
})(window.RPG);
