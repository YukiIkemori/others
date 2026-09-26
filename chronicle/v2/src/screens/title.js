// MENUS: タイトル（MODERN_UI §6.1 title.png、V2_PLAN §2.5.15・§3.11）
//   背景: 夜の海・月・オーロラ・崖の上の灯台（光がゆっくり空を掃く）と、海を見る 4 人の後ろ姿。
//   左: 英字の題・題字・副題「〜八つの灯火〜」（A31）・細い線・命令。「つづきから」を選んでいる間だけ最後の記録の札（場所・章・時間・顔 4 つ。Lv なし）。
//   左下: © Studio Metem と版（Part A）。右下: ボタン表示。縦持ち: 題字を上、灯台を中央、選ぶ物を下の大きな札。
//   結果: {cmd:'new'} | {cmd:'continue', slot} | {cmd:'load', slot} | {cmd:'passphrase'}
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
    if (m < 1) return 'たった今';
    if (m < 60) return m + '分前';
    const h = Math.floor(m / 60);
    if (h < 24) return h + '時間前';
    return Math.floor(h / 24) + '日前';
  }
  S.slotName = (slot) => ({ auto: 'オートセーブ', suspend: '中断', s1: '記録 1', s2: '記録 2', s3: '記録 3' })[slot] || slot;
  S.playTimeJa = function (ms) {
    const m = Math.floor((ms || 0) / 60000);
    const h = Math.floor(m / 60);
    return h ? `${h}時間${String(m % 60).padStart(2, '0')}分` : `${m % 60}分`;
  };

  S.def('title', {
    opaque: true, frost: false, touch: 'none',
    init() {
      this.cont = newest();
      const any = R.Save.cards().some((e) => e.card && !e.card.bad);
      const rows = [];
      if (this.cont) rows.push({ label: 'つづきから', value: 'continue' });
      rows.push({ label: 'はじめから', value: 'new' });
      if (!this.cont) rows.push({ label: 'つづきから', value: 'continue', disabled: true });
      if (any) rows.push({ label: '記録を選ぶ', value: 'load' });
      rows.push({ label: '冒険の合言葉', value: 'passphrase' });
      rows.push({ label: '設定', value: 'settings' });
      rows.push({ label: 'クレジット', value: 'credits' });
      this.rows = rows;
      this.list = new R.UIK.List({ rows, rowH: 40, tall: true });
      this.list.onSelect = (row) => this.pick(row);
      this.busy = false;
    },
    async pick(row) {
      if (this.busy) return;
      const v = row.value;
      if (v === 'new') { this.close({ cmd: 'new' }); return; }
      if (v === 'continue') { if (this.cont) this.close({ cmd: 'continue', slot: this.cont.slot }); return; }
      this.busy = true;
      try {
        if (v === 'load') { const r = await S.open('load'); if (r && r.slot) { this.close({ cmd: 'load', slot: r.slot }); return; } }
        else if (v === 'passphrase') { const ok = await S.open('passphrase', { mode: 'enter' }); if (ok) { this.close({ cmd: 'passphrase' }); return; } }
        else if (v === 'settings') await S.open('settings');
        else if (v === 'credits') {
          await S.note(this, { title: 'クレジット', lines: [
            { text: 'ルミナス・クロニクル 〜八つの灯火〜', color: T().color.goldHi },
            '企画・制作　Studio Metem',
            '書体　Zen Maru Gothic・Cinzel（SIL Open Font License）',
            '音楽・効果音・声　Studio Metem',
          ] });
        }
      } finally { this.busy = false; }
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      drawBg(g);
      const C = T().color, tall = R.layout === 'tall', s = R.safe;
      const k = R.uiScale || 1;
      let x, y;
      if (tall) {
        x = R.W / 2; y = s.t + R.H * 0.07;
        R.UIK.text(g, 'LUMINOUS CHRONICLE', x, y, { size: u(15), family: 'en', weight: 700, align: 'center', color: C.gold, track: u(4), shadow: true });
        R.UIK.text(g, R.TITLE, x, y + u(28), { size: u(38), weight: 700, align: 'center', grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(10,8,20,0.8)', blur: 8, maxW: R.W - u(30) });
        R.UIK.hline(g, x - u(170), x + u(170), y + u(82), 0.4, '236,201,124');
        R.UIK.text(g, '〜 八つの灯火 〜', x, y + u(96), { size: u(18), weight: 700, align: 'center', color: C.gold, track: u(6), shadow: true });
      } else {
        x = s.l + R.W * 0.065; y = s.t + R.H * 0.17;
        R.UIK.text(g, 'LUMINOUS CHRONICLE', x + u(4), y, { size: u(19), family: 'en', weight: 700, color: C.gold, track: u(7), shadow: true });
        R.UIK.text(g, R.TITLE, x, y + u(30), { size: u(48), weight: 700, grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(10,8,20,0.8)', blur: 8, track: u(4) });
        R.UIK.hline(g, x, x + u(420), y + u(96), 0.45, '236,201,124');
        R.UIK.text(g, '〜 八つの灯火 〜', x + u(2), y + u(112), { size: u(20), weight: 700, color: C.gold, track: u(10), shadow: true });
      }
      // 命令
      const rowPx = this.list.rowPx();
      let lr;
      if (tall) {
        const w = Math.min(R.W - u(60), u(300));
        const h = this.rows.length * rowPx;
        lr = { x: (R.W - w) / 2, y: R.H - s.b - h - u(60), w, h };
        R.UIK.panel(g, { x: lr.x - u(12), y: lr.y - u(12), w: lr.w + u(24), h: lr.h + u(24) }, { a: 0.55 });
      } else {
        lr = { x: x - u(6), y: s.t + R.H * 0.44, w: u(250), h: this.rows.length * rowPx };
      }
      this.list.render = (gg, row, rect, f) => {
        const sz = u(tall ? 19 : 21);
        R.UIK.text(gg, row.label, tall ? rect.x + rect.w / 2 : rect.x + u(26), rect.y + (rect.h - sz) / 2 - u(1), { size: sz, weight: f ? 700 : 500, align: tall ? 'center' : 'left', color: row.disabled ? C.disabled : f ? C.goldHi : C.text, shadow: !f, track: u(2) });
      };
      this.list.draw(g, lr);
      // 最後の記録の札
      const cur = this.rows[this.list.index];
      if (this.cont && cur && cur.value === 'continue') {
        const cw = u(262), ch = u(128);
        const cr = tall ? { x: (R.W - cw) / 2, y: lr.y - u(24) - ch, w: cw, h: ch } : { x: lr.x + lr.w + u(24), y: lr.y - u(4), w: cw, h: ch };
        const cd = this.cont.card;
        R.UIK.panel(g, cr, { dense: true });
        R.UIK.text(g, '最後の記録', cr.x + u(16), cr.y + u(14), { size: u(12.5), weight: 700, color: C.gold, track: u(2) });
        R.UIK.text(g, `${S.slotName(this.cont.slot)}　${ago(cd.date)}`, cr.x + cr.w - u(16), cr.y + u(15), { size: u(11.5), color: C.text3, align: 'right' });
        R.UIK.text(g, cd.place || '', cr.x + u(16), cr.y + u(36), { size: u(17), weight: 700, color: C.text, maxW: cr.w - u(32) });
        R.UIK.text(g, `${cd.chapter ? '第' + cd.chapter + '章' : '序章'}　・　${S.playTimeJa(cd.playMs)}`, cr.x + u(16), cr.y + u(62), { size: u(13), color: C.text2 });
        (cd.faces || []).slice(0, 4).forEach((look, i) => S.faceCircle(g, look, cr.x + u(32) + i * u(38), cr.y + u(102), u(16)));
      }
      // 左下・右下
      R.UIK.text(g, `${R.COPYRIGHT || '© Studio Metem'}      ver ${R.VERSION || ''}`, s.l + u(18), R.H - s.b - u(tall ? 34 : 28), { size: u(11.5), color: C.text3, shadow: true });
      if (!tall) S.prompts(g, [{ btn: 'a', label: '決定' }, { btn: 'up', label: '選ぶ' }]);
      void k;
    },
  });
})(window.RPG);
