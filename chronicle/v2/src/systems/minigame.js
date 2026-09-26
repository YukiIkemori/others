// EVENTS — 小さな遊び R.Mini（V2_PLAN §2.5.14・§3.4 の q_fern_song・§3.14 の E16、WORLD_REDESIGN §4.1・§5.4）
//
//   R.Mini.sequence({title, symbols, rounds, tempo, theme, start, seed, teacher}) → Promise<{score, rank, hits, total, rounds}>
//       歌あわせ: 歌の石が節（音の並び）を歌う → 同じ順に十字（↑→↓←、5 つ目は A）かタップでくり返す。
//       symbols 3〜5（既定 4）・rounds 節の数（既定 3）・start 最初の節の音の数（既定 3、節ごとに +1）・tempo 1 音の ms（既定 560）・
//       theme 'forest'|'harbor'|'night'（色）。まちがえたらその節は終わり（次の節へ）。B で途中でやめる（残りは 0）。
//       score = 正しくくり返した音の数 ÷ 全部の音の数 × 100（整数）。rank S（100）・A（80 以上）・B（50 以上）・C
//   R.Mini.timing({title, speed, zones, tries}) → Promise<{hits, rank, tries}>   動く印が帯の「当たり」にある間に A（縦切りでは部品だけ）
//       zones = [[a, b]…]（帯の 0〜1 の範囲。既定 [[0.42, 0.58]]）・speed 1 往復の ms（既定 1400）・tries（既定 3）
//   場面の id は 'mini:sequence'・'mini:timing'（フィールドの上に重ねる。opaque ではない）。R.Mini.state() はテスト用
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Mini');
  const Mini = (R.Mini = R.Mini || {});

  const DIRS = ['up', 'right', 'down', 'left', 'a'];
  const PITCH = [72, 76, 79, 81, 84];                 // ド ミ ソ ラ ド（明るい五音）
  const THEMES = {
    forest: { tint: [110, 200, 150], glow: ['#b7f0c8', '#7fd6a0', '#e8d58a', '#9fd8f0', '#f0b8d8'], sub: '森の歌' },
    harbor: { tint: [120, 170, 220], glow: ['#a8d8ff', '#8fd6d8', '#ecc97c', '#c8b8f0', '#f0c8a0'], sub: '港の歌' },
    night: { tint: [140, 130, 210], glow: ['#c8c0ff', '#8fd6d8', '#ecc97c', '#f0b8d8', '#b8f0c8'], sub: '夜の歌' },
  };
  const NOTE_NAME = ['高い音', '明るい音', '低い音', 'やさしい音', 'ひびく音'];

  // 音（R.DB.sfx の mini_n0〜n4。音の担当の物が無ければここで足す）
  R.onData(function () {
    if (!R.DB.sfx) return;
    PITCH.forEach((n, i) => {
      const id = 'mini_n' + i;
      if (R.DB.sfx[id]) return;
      R.DB.sfx[id] = function (S) {
        S.tone({ w: 'triangle', n, d: 0.06, r: 0.55, vol: 0.2 });
        S.fm({ n: n + 12, ratio: 3.5, index: 0.9, md: 0.35, d: 0.01, r: 0.7, vol: 0.05 });
        if (S.wet) S.wet(0.35);
      };
    });
  });
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* 音は無くてよい */ } };

  let live = null;      // 今の遊びの状態（テスト用に state() で見せる）
  Mini.state = function () {
    if (!live) return null;
    const s = live;
    return { kind: s.kind, phase: s.phase, round: s.round, rounds: s.rounds, seq: s.seq ? s.seq.slice() : null, input: s.input ? s.input.length : 0, hits: s.hits, total: s.total, lit: s.lit, rank: s.rank || null };
  };

  function rankOf(score) { return score >= 100 ? 'S' : score >= 80 ? 'A' : score >= 50 ? 'B' : 'C'; }

  // ================================================================ 歌あわせ
  Mini.sequence = function (o) {
    o = o || {};
    const n = Math.max(3, Math.min(5, o.symbols || 4));
    const rounds = Math.max(1, o.rounds || 3);
    const start = Math.max(2, o.start || 3);
    const tempo = Math.max(260, o.tempo || 560);
    const th = THEMES[o.theme] || THEMES.forest;
    const seed = o.seed != null ? o.seed : ((R.Game && R.Game.seed) || 0) + ':' + (o.title || 'song');
    const rng = R.rng('mini:seq:' + seed);
    // 節: 前の節に 1 音足していく（覚えやすさ。同じ音は 3 回まで続かない）
    const phrases = [];
    let base = [];
    for (let r = 0; r < rounds; r++) {
      const len = start + r;
      while (base.length < len) {
        let v = rng.int(0, n - 1);
        const L = base.length;
        if (L >= 2 && base[L - 1] === v && base[L - 2] === v) v = (v + 1 + rng.int(0, n - 2)) % n;
        base.push(v);
      }
      phrases.push(base.slice(0, len));
    }
    const total = phrases.reduce((a, p) => a + p.length, 0);
    return new Promise((resolve) => {
      const st = {
        kind: 'sequence', title: o.title || '歌あわせ', teacher: o.teacher || null, th, n, tempo, phrases, rounds,
        round: 0, phase: 'intro', t0: 0, seq: phrases[0], input: [], hits: 0, total, lit: -1, litT: 0, press: -1, pressT: -1e9,
        flash: null, resultT: 0, rank: null, score: 0, rects: [],
      };
      live = st;
      const scene = {
        id: 'mini:sequence', opaque: false,
        enter() { st.t0 = R.Engine.time; st.phaseT = st.t0; try { R.Input.touchLayout('menu'); } catch (e) { /* */ } },
        exit() { try { R.Input.touchLayout('field'); } catch (e) { /* */ } },
        update() { updSeq(st, finish); },
        draw(g) { drawSeq(g, st); },
      };
      function finish() {
        const score = Math.round((st.hits / Math.max(1, st.total)) * 100);
        R.Engine.remove(scene);
        if (live === st) live = null;
        resolve({ score, rank: rankOf(score), hits: st.hits, total: st.total, rounds: st.rounds });
      }
      R.Engine.push(scene);
    });
  };

  function go(st, phase) { st.phase = phase; st.phaseT = R.Engine.time; }

  function updSeq(st, finish) {
    const now = R.Engine.time, dt = now - st.phaseT;
    const I = R.Input;
    if ((st.phase === 'intro' || st.phase === 'play' || st.phase === 'input') && I.pressed('b')) { quit(st); return; }
    if (st.phase === 'intro') { if (dt > 900) go(st, 'play'); return; }
    if (st.phase === 'play') {
      // 手本: tempo ごとに 1 音。光るのは tempo の 70%
      const i = Math.floor(dt / st.tempo);
      if (i < st.seq.length) {
        const inNote = dt - i * st.tempo < st.tempo * 0.7;
        const v = inNote ? st.seq[i] : -1;
        if (v !== st.lit && v >= 0) sfx('mini_n' + v);
        st.lit = v;
      } else { st.lit = -1; go(st, 'input'); st.input = []; }
      return;
    }
    if (st.phase === 'input') {
      let v = -1;
      for (let k = 0; k < st.n; k++) if (I.pressed(DIRS[k])) { v = k; break; }
      if (v < 0 && I.pointer && I.pointer.pressed) {
        for (let k = 0; k < st.rects.length; k++) {
          const r = st.rects[k];
          if (r && Math.hypot(I.pointer.x - r.x, I.pointer.y - r.y) <= r.r * 1.15) { v = k; break; }
        }
      }
      if (v < 0) return;
      st.press = v; st.pressT = now;
      const want = st.seq[st.input.length];
      if (v === want) {
        sfx('mini_n' + v);
        st.input.push(v);
        st.hits++;
        if (st.input.length >= st.seq.length) { st.flash = 'ok'; go(st, 'judge'); sfx('confirm'); }
      } else {
        st.flash = 'miss'; go(st, 'judge'); sfx('buzzer');
      }
      return;
    }
    if (st.phase === 'judge') {
      if (dt < 1100) return;
      st.round++;
      if (st.round >= st.rounds) { go(st, 'result'); st.score = Math.round((st.hits / Math.max(1, st.total)) * 100); st.rank = rankOf(st.score); try { R.Audio.jingle(st.rank === 'S' || st.rank === 'A' ? 'rare' : 'item'); } catch (e) { /* */ } return; }
      st.seq = st.phrases[st.round]; st.input = []; st.flash = null; go(st, 'intro');
      return;
    }
    if (st.phase === 'result') {
      if (dt > 900 && (I.pressed('a') || I.pressed('b') || (I.pointer && I.pointer.pressed))) { sfx('confirm'); finish(); }
    }
  }
  function quit(st) {
    sfx('cancel');
    st.round = st.rounds;
    st.flash = null;
    go(st, 'result');
    st.score = Math.round((st.hits / Math.max(1, st.total)) * 100);
    st.rank = rankOf(st.score);
  }

  // ---------------------------------------------------------------- 絵
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function frame(g, st, title, sub) {
    const U = R.UIK.u, T = R.UIK.T, C = T.color;
    const tall = R.layout === 'tall';
    const k = Math.min(1, (R.Engine.time - st.t0) / T.ms.open);
    const e = R.UIK.ease(k);
    // 背景を落とす（フィールドの上。森の色を少し）
    g.save();
    g.fillStyle = `rgba(6,8,14,${0.55 * e})`; g.fillRect(0, 0, R.W, R.H);
    const vg = g.createRadialGradient(R.W / 2, R.H / 2, 10, R.W / 2, R.H / 2, Math.max(R.W, R.H) * 0.6);
    vg.addColorStop(0, rgba(st.th.tint, 0.10 * e)); vg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = vg; g.fillRect(0, 0, R.W, R.H);
    g.restore();
    const w = Math.min(R.W - U(32), U(tall ? 420 : 560));
    const h = Math.min(R.H - U(40), U(tall ? 560 : 440));
    const x = Math.round((R.W - w) / 2), y = Math.round((R.H - h) / 2 + (1 - e) * U(8));
    g.save();
    g.globalAlpha = e;
    R.UIK.panel(g, { x, y, w, h }, { dense: true, frost: true });
    R.UIK.icon(g, 'star', x + U(22), y + U(20), U(16), C.teal);
    R.UIK.text(g, sub, x + U(44), y + U(21), { size: U(11.5), weight: 700, color: C.teal, track: U(2) });
    R.UIK.text(g, title, x + U(22), y + U(40), { size: U(22), weight: 700, color: C.goldHi, maxW: w - U(150) });
    R.UIK.rule(g, x + U(22), x + w - U(22), y + U(76), 0.16);
    g.restore();
    return { x, y, w, h, a: e, tall };
  }

  function drawSeq(g, st) {
    const U = R.UIK.u, T = R.UIK.T, C = T.color;
    const now = R.Engine.time, dt = now - st.phaseT;
    const P = frame(g, st, st.title, st.th.sub + ' · 歌あわせ');
    const { x, y, w, h, tall } = P;
    g.save();
    g.globalAlpha = P.a;
    // 右上: 節の数
    const rtxt = `第 ${Math.min(st.round + 1, st.rounds)} 節 / ${st.rounds}`;
    R.UIK.text(g, rtxt, x + w - U(22), y + U(46), { size: U(13), weight: 700, color: C.text2, align: 'right' });
    // 歌の石: 菱形に並べる（↑→↓←、5 つ目は中央 = A）
    const cx = x + w / 2, cy = y + (tall ? U(262) : U(212));
    const d = U(tall ? 104 : 88), r = U(tall ? 38 : 32);
    const pos = [[0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]];
    st.rects.length = 0;
    // 石の輪（苔の輪と、節の流れの細い線）
    g.save();
    const ring = g.createRadialGradient(cx, cy, d * 0.3, cx, cy, d * 1.5);
    ring.addColorStop(0, rgba(st.th.tint, 0.10)); ring.addColorStop(0.7, rgba(st.th.tint, 0.04)); ring.addColorStop(1, rgba(st.th.tint, 0));
    g.fillStyle = ring; g.beginPath(); g.ellipse(cx, cy, d * 1.6, d * 1.25, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba(st.th.tint, 0.22); g.lineWidth = U(1); g.setLineDash([U(2), U(6)]);
    g.beginPath(); g.ellipse(cx, cy, d * 1.25, d * 0.92, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    const showStones = st.phase !== 'result';
    for (let k = 0; k < st.n && showStones; k++) {
      const px = cx + pos[k][0] * d * (k === 1 || k === 3 ? 1.25 : 1), py = cy + pos[k][1] * d * 0.92;
      st.rects[k] = { x: px, y: py, r };
      const col = hexRgb(st.th.glow[k]);
      const lit = st.lit === k || (st.press === k && now - st.pressT < 260 && st.phase !== 'play');
      const litK = lit ? 1 : 0;
      // 光のにじみ
      if (lit) {
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(px, py, r * 0.4, px, py, r * 2.4);
        gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(px, py, r * 2.4, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      // 石（丸い苔の石＋刻まれた音の印）
      g.save();
      const body = g.createLinearGradient(px, py - r, px, py + r);
      body.addColorStop(0, lit ? rgba(col, 0.95) : 'rgba(70,78,92,0.95)');
      body.addColorStop(1, lit ? rgba(col.map((c) => Math.round(c * 0.55)), 0.95) : 'rgba(34,38,50,0.95)');
      g.fillStyle = body; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      if (!lit) {   // 眠っている石にも、色の名残り
        const inner = g.createRadialGradient(px, py - r * 0.2, 0, px, py, r);
        inner.addColorStop(0, rgba(col, 0.22)); inner.addColorStop(1, rgba(col, 0.02));
        g.fillStyle = inner; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      }
      g.lineWidth = U(1.5); g.strokeStyle = lit ? 'rgba(255,250,230,0.9)' : rgba(col, 0.55); g.stroke();
      // 刻み（色ごとの印）
      g.strokeStyle = lit ? 'rgba(40,30,20,0.55)' : rgba(col, 0.85); g.lineWidth = U(2.2); g.lineCap = 'round';
      glyph(g, k, px, py, r * 0.46);
      g.restore();
      // ボタンの印（石の外側）
      const bx = px + pos[k][0] * (r + U(18)), by = py + pos[k][1] * (r + U(16)) + (k === 4 ? r + U(16) : 0);
      if (R.UIK.glyph && (st.phase === 'input' || st.phase === 'intro')) R.UIK.glyph(g, DIRS[k], bx, by, { size: U(12) });
      void litK;
    }
    // 下: 節の音の数（くり返した所まで光る）
    const dotsY = y + (tall ? U(432) : U(352));
    const L = st.seq.length, gap = U(22);
    const x0 = cx - ((L - 1) * gap) / 2;
    for (let i = 0; i < L && showStones; i++) {
      const done = i < st.input.length;
      const showNote = st.phase === 'play' && Math.floor(dt / st.tempo) >= i;
      const col = hexRgb(st.th.glow[st.seq[i]]);
      g.beginPath(); g.arc(x0 + i * gap, dotsY, U(6), 0, Math.PI * 2);
      g.fillStyle = done ? rgba(col, 0.95) : showNote ? 'rgba(240,228,200,0.55)' : 'rgba(240,228,200,0.12)';
      g.fill();
      g.lineWidth = U(1); g.strokeStyle = 'rgba(240,228,200,0.35)'; g.stroke();
    }
    // 言葉
    let msg = '', mc = C.text;
    if (st.phase === 'intro') msg = st.round === 0 ? '歌の石が 歌いはじめる。よく 聞いて……' : 'つぎの節。音が ひとつ 増える……';
    else if (st.phase === 'play') msg = '聞いて……';
    else if (st.phase === 'input') msg = `同じ順に くり返して（${st.input.length} / ${L}）`;
    else if (st.phase === 'judge') { msg = st.flash === 'ok' ? 'きれいに 重なった！' : 'あっ、ちがう音……'; mc = st.flash === 'ok' ? C.up : C.down; }
    if (st.phase !== 'result') R.UIK.text(g, msg, cx, dotsY + U(24), { size: U(15), weight: 700, color: mc, align: 'center', maxW: w - U(40) });
    // 結果
    if (st.phase === 'result') {
      const k = Math.min(1, dt / 420);
      g.save(); g.globalAlpha *= k;
      g.fillStyle = 'rgba(8,10,18,0.55)'; R.UIK.rr(g, x + U(40), y + U(96), w - U(80), h - U(150), U(12)); g.fill();
      const halo = g.createRadialGradient(cx, y + U(178), 0, cx, y + U(178), U(120));
      halo.addColorStop(0, rgba(st.th.tint, 0.18)); halo.addColorStop(1, rgba(st.th.tint, 0));
      g.fillStyle = halo; g.fillRect(x + U(40), y + U(96), w - U(80), h - U(150));
      R.UIK.text(g, '歌あわせの ひょうか', cx, y + U(116), { size: U(13), weight: 700, color: C.text2, align: 'center', track: U(2) });
      const rc = st.rank === 'S' ? C.superRare : st.rank === 'A' ? C.goldHi : st.rank === 'B' ? C.rare : C.text2;
      R.UIK.text(g, st.rank, cx, y + U(142), { size: U(64), weight: 700, family: 'en', color: rc, align: 'center', shadow: 'rgba(236,180,90,0.35)', blur: 12 });
      R.UIK.text(g, `重なった音　${st.hits} / ${st.total}`, cx, y + U(226), { size: U(15), color: C.text, align: 'center' });
      const words = { S: '森じゅうが 耳を すませていた。', A: 'きれいな 歌だった。', B: 'もう少しで 覚えられそう。', C: 'まだ 歌が ばらばらだ。' };
      R.UIK.text(g, words[st.rank] || '', cx, y + U(254), { size: U(13), color: C.text3, align: 'center' });
      g.restore();
    }
    // ボタン
    const pr = st.phase === 'result' ? [{ btn: 'a', label: 'とじる' }] : [{ btn: 'up', label: '音を鳴らす' }, { btn: 'b', label: 'やめる' }];
    if (st.phase !== 'result' || dt > 900) R.UIK.prompts(g, pr, { x: x + w - U(20), y: y + h - U(22), align: 'right' });
    g.restore();
  }

  /** 石に刻む印（音ごとに形を変える: 色覚に頼らない） */
  function glyph(g, k, x, y, s) {
    g.beginPath();
    if (k === 0) { g.moveTo(x - s, y + s * 0.5); g.lineTo(x, y - s * 0.7); g.lineTo(x + s, y + s * 0.5); }                 // 山
    else if (k === 1) { for (let i = 0; i <= 12; i++) { const t = i / 12; g[i ? 'lineTo' : 'moveTo'](x - s + t * 2 * s, y + Math.sin(t * Math.PI * 2) * s * 0.45); } }   // 波
    else if (k === 2) { g.arc(x, y, s * 0.72, 0, Math.PI * 2); }                                                            // 丸
    else if (k === 3) { g.moveTo(x - s * 0.8, y - s * 0.4); g.lineTo(x + s * 0.8, y - s * 0.4); g.moveTo(x - s * 0.8, y + s * 0.4); g.lineTo(x + s * 0.8, y + s * 0.4); }   // 二本線
    else { g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s, y); g.lineTo(x + s * 0.3, y + s * 0.3); g.lineTo(x, y + s); g.lineTo(x - s * 0.3, y + s * 0.3); g.lineTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.3); g.closePath(); }   // 星
    g.stroke();
  }
  Mini.NOTE_NAME = NOTE_NAME;

  // ================================================================ 間合い（部品だけ）
  Mini.timing = function (o) {
    o = o || {};
    const zones = Array.isArray(o.zones) && o.zones.length ? o.zones : [[0.42, 0.58]];
    const tries = Math.max(1, o.tries || 3);
    const speed = Math.max(500, o.speed || 1400);
    const th = THEMES[o.theme] || THEMES.harbor;
    return new Promise((resolve) => {
      const st = { kind: 'timing', title: o.title || '間合い', th, zones, tries, speed, phase: 'input', t0: 0, phaseT: 0, hits: 0, n: 0, marks: [], lit: -1 };
      live = st;
      const scene = {
        id: 'mini:timing', opaque: false,
        enter() { st.t0 = st.phaseT = st.runT = R.Engine.time; },
        exit() {},
        update() {
          const I = R.Input, now = R.Engine.time;
          if (st.phase === 'input') {
            const pos = markerAt(st, now);
            if (I.pressed('a') || (I.pointer && I.pointer.pressed)) {
              const hit = st.zones.some((z) => pos >= z[0] && pos <= z[1]);
              st.marks.push({ p: pos, hit });
              if (hit) { st.hits++; sfx('confirm'); } else sfx('buzzer');
              st.n++;
              st.phase = 'judge'; st.phaseT = now;
            } else if (I.pressed('b')) { st.n = st.tries; st.phase = 'result'; st.phaseT = now; sfx('cancel'); }
          } else if (st.phase === 'judge') {
            if (now - st.phaseT > 700) { if (st.n >= st.tries) { st.phase = 'result'; st.phaseT = now; } else { st.phase = 'input'; st.runT = now; } }
          } else if (st.phase === 'result') {
            if (now - st.phaseT > 700 && (I.pressed('a') || I.pressed('b') || (I.pointer && I.pointer.pressed))) {
              R.Engine.remove(scene);
              if (live === st) live = null;
              const score = Math.round((st.hits / st.tries) * 100);
              resolve({ hits: st.hits, rank: rankOf(score), tries: st.tries });
            }
          }
        },
        draw(g) { drawTiming(g, st); },
      };
      R.Engine.push(scene);
    });
  };
  function markerAt(st, now) {
    const t = ((now - (st.runT || st.t0)) % st.speed) / st.speed;
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }
  function drawTiming(g, st) {
    const U = R.UIK.u, C = R.UIK.T.color;
    const P = frame(g, st, st.title, st.th.sub + ' · 間合い');
    const { x, y, w, h } = P;
    g.save(); g.globalAlpha = P.a;
    const bx = x + U(40), bw = w - U(80), by = y + h / 2 - U(10), bh = U(20);
    g.fillStyle = 'rgba(240,228,200,0.10)'; R.UIK.rr(g, bx, by, bw, bh, bh / 2); g.fill();
    for (const z of st.zones) { g.fillStyle = 'rgba(236,201,124,0.45)'; g.fillRect(bx + z[0] * bw, by, (z[1] - z[0]) * bw, bh); }
    const p = st.phase === 'input' ? markerAt(st, R.Engine.time) : (st.marks[st.marks.length - 1] || { p: 0 }).p;
    g.fillStyle = C.goldHi; g.fillRect(Math.round(bx + p * bw) - U(2), by - U(8), U(4), bh + U(16));
    R.UIK.text(g, `${st.hits} / ${st.tries}`, x + w / 2, by + U(44), { size: U(15), weight: 700, color: C.text, align: 'center' });
    if (st.phase === 'result') R.UIK.text(g, rankOf(Math.round((st.hits / st.tries) * 100)), x + w / 2, by - U(90), { size: U(48), weight: 700, family: 'en', color: C.goldHi, align: 'center' });
    R.UIK.prompts(g, st.phase === 'result' ? [{ btn: 'a', label: 'とじる' }] : [{ btn: 'a', label: 'とめる' }, { btn: 'b', label: 'やめる' }], { x: x + w - U(20), y: y + h - U(22), align: 'right' });
    g.restore();
  }
})(window.RPG);
