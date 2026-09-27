// BSCENE: 戦闘の画面の部品（MODERN_UI §2.3・§6.17）。右上のパーティの一覧・左上の見出し・敵の名前・倍速とリピートの札・
// 縦持ちの人の札。R.UIK の部品を使い、まだ無い部品だけ手元の小さな代わり（kit）で描く（UIK と並行で作るため）。
// 位置と大きさはここで uiScale を掛ける（§2.11: primitive には掛けた後の px を渡す）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});

  // ---------------------------------------------------------------- kit（UIK が無い・途中のときの代わり）
  const COL = {
    text: '#f6f0e3', text2: '#d2c9b6', text3: '#bbb29f', disabled: '#a39b8b', gold: '#ecc97c', goldHi: '#fff1c8', goldLo: '#b98f47',
    teal: '#8fd6d8', hp: ['#5f9e5a', '#a9dc8e'], hpMid: ['#b98f47', '#ecc97c'], hpLow: ['#b8453a', '#f08a6c'], mp: ['#3d6aa6', '#92bdf0'],
    rare: '#86c8ff', superRare: '#ffb65e', front: '#f2c28a', back: '#a9d2f2', up: '#8ee08a', down: '#f47e6c',
  };
  const T = () => (R.UIK && R.UIK.T) || null;
  function col(name) {
    const t = T();
    const v = t && t.color && t.color[name];
    if (typeof v === 'string' && !(name === 'hp' || name === 'mp')) return v;
    return COL[name];
  }
  const fn = (name) => R.UIK && typeof R.UIK[name] === 'function';
  const K = {
    COL,
    col,
    u(v) { return v * (R.uiScale || 1); },
    font(size, weight) { return R.Gfx.font(size, weight || 500); },
    text(g, s, x, y, o) {
      o = o || {};
      if (fn('text') && !o.raw) { R.UIK.text(g, s, x, y, o); return; }
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.font = R.Gfx.font(o.size || 15, o.weight || 500);
      g.textAlign = o.align || 'left';
      g.textBaseline = o.baseline || 'top';
      if (o.shadow) { g.shadowColor = 'rgba(4,4,14,0.85)'; g.shadowBlur = 4; }
      if (o.stroke) { g.lineJoin = 'round'; g.strokeStyle = o.stroke[0]; g.lineWidth = o.stroke[1]; g.strokeText(String(s), x, y); }
      g.fillStyle = o.color || COL.text;
      g.fillText(String(s), x, y);
      g.restore();
    },
    measure(s, o) { o = o || {}; return fn('measure') ? R.UIK.measure(s, o) : R.Gfx.measure(s, { size: o.size || 15, weight: o.weight }); },
    fit(s, w, o) {
      if (fn('fit')) return R.UIK.fit(s, w, o);
      s = String(s);
      if (K.measure(s, o) <= w) return s;
      const a = [...s];
      while (a.length && K.measure(a.join('') + '…', o) > w) a.pop();
      return a.join('') + '…';
    },
    /** 行動の一覧の窓（MODERN_UI §6.17: 1 px の明るい細い枠＋暗い半透明 0.6） */
    box(g, r, o) {
      o = o || {};
      const rad = o.r != null ? o.r : 6;
      g.save();
      g.beginPath();
      g.roundRect ? g.roundRect(r.x, r.y, r.w, r.h, rad) : g.rect(r.x, r.y, r.w, r.h);
      const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h);
      const a = o.a != null ? o.a : 0.6;
      gr.addColorStop(0, `rgba(18,20,34,${a})`); gr.addColorStop(1, `rgba(10,11,22,${Math.min(1, a + 0.1)})`);
      g.fillStyle = gr; g.fill();
      g.strokeStyle = o.edge || 'rgba(240,228,200,0.42)'; g.lineWidth = 1; g.stroke();
      g.restore();
    },
    panel(g, r, o) {
      if (fn('panel')) { R.UIK.panel(g, r, o); return; }
      K.box(g, r, Object.assign({ a: 0.72, r: 12, edge: 'rgba(240,228,200,0.14)' }, o));
    },
    /** 端から中へ薄くなる帯（side: 'r' | 'l' | 'b'）。a は一番濃い所の不透明度 */
    band(g, r, side, a) {
      g.save();
      let gr;
      if (side === 'l') gr = g.createLinearGradient(r.x, 0, r.x + r.w, 0);
      else if (side === 'b') gr = g.createLinearGradient(0, r.y + r.h, 0, r.y);
      else gr = g.createLinearGradient(r.x + r.w, 0, r.x, 0);
      gr.addColorStop(0, `rgba(10,11,22,${a})`); gr.addColorStop(0.55, `rgba(10,11,22,${a * 0.55})`); gr.addColorStop(1, 'rgba(10,11,22,0)');
      g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
      g.restore();
    },
    /** 選んでいる行（明るい帯＋琥珀の線＋左の菱形） */
    focus(g, r, t, o) {
      o = o || {};
      g.save();
      const pulse = R.Settings.get('lessFlash') ? 1 : 1 + 0.1 * Math.sin((t || 0) / 1600 * Math.PI * 2);
      g.fillStyle = `rgba(255,238,205,${0.16 * pulse})`;
      g.beginPath(); g.roundRect ? g.roundRect(r.x, r.y, r.w, r.h, 4) : g.rect(r.x, r.y, r.w, r.h); g.fill();
      const gr = g.createLinearGradient(r.x, 0, r.x + r.w, 0);
      gr.addColorStop(0, `rgba(236,201,124,${0.3 * pulse})`); gr.addColorStop(1, 'rgba(236,201,124,0.02)');
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(236,201,124,0.75)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = COL.gold; g.fillRect(r.x, r.y + 2, 2, r.h - 4);
      if (o.cursor !== false) {
        const cy = r.y + r.h / 2, cx = r.x, s = K.u(4);
        g.shadowColor = 'rgba(255,220,150,0.9)'; g.shadowBlur = 6;
        g.fillStyle = COL.goldHi;
        g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); g.fill();
      }
      g.restore();
    },
    gauge(g, r, cur, max, kind, o) {
      o = o || {};
      const k = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
      g.save();
      g.fillStyle = 'rgba(240,236,226,0.13)'; g.fillRect(r.x, r.y, r.w, r.h);
      if (o.ghost != null && o.ghost > k) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(r.x, r.y, r.w * o.ghost, r.h); }
      const assist = R.Settings.get('colorAssist');
      const c = kind === 'mp' ? COL.mp : k < 0.25 ? COL.hpLow : k < 0.5 ? COL.hpMid : assist ? ['#3d7ab8', '#8ec8f0'] : COL.hp;
      const gr = g.createLinearGradient(r.x, 0, r.x + r.w, 0); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
      g.fillStyle = gr; g.fillRect(r.x, r.y, r.w * k, r.h);
      g.restore();
    },
    /** 小さな札（丸い角）。→ 幅 */
    chip(g, x, y, s, o) {
      o = o || {};
      const size = o.size || K.u(10.5), h = size + K.u(9), padX = K.u(8);
      const iw = o.icon ? size + K.u(4) : 0;
      const w = K.measure(s, { size, weight: 700 }) + padX * 2 + iw;
      g.save();
      g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, h / 2) : g.rect(x, y, w, h);
      g.fillStyle = o.bg || 'rgba(14,16,28,0.62)'; g.fill();
      g.strokeStyle = o.line || 'rgba(240,228,200,0.28)'; g.lineWidth = 1; g.stroke();
      g.restore();
      if (o.icon) K.icon(g, o.icon, x + padX - K.u(1), y + (h - size) / 2, size, o.color || COL.text2);
      K.text(g, s, x + padX + iw, y + (h - size) / 2 - K.u(0.5), { size, weight: 700, color: o.color || COL.text2, raw: true });
      return w;
    },
    icon(g, name, x, y, size, color) {
      if (fn('icon')) { R.UIK.icon(g, name, x, y, size, color); return; }
      // 線画の代わり（UIK のアイコンが来るまで）: 名前ごとの簡単な形
      g.save();
      g.strokeStyle = color || COL.text2; g.fillStyle = color || COL.text2; g.lineWidth = Math.max(1, size / 12); g.lineCap = 'round'; g.lineJoin = 'round';
      const cx = x + size / 2, cy = y + size / 2, r = size * 0.38;
      g.beginPath();
      switch (name) {
        case 'sword': case 'greatsword': case 'dagger': g.moveTo(x + size * 0.2, y + size * 0.8); g.lineTo(x + size * 0.8, y + size * 0.2); g.moveTo(x + size * 0.28, y + size * 0.55); g.lineTo(x + size * 0.45, y + size * 0.72); break;
        case 'bow': g.arc(cx - r * 0.4, cy, r, -1.2, 1.2); g.moveTo(cx - r * 0.4 + Math.cos(-1.2) * r, cy + Math.sin(-1.2) * r); g.lineTo(cx - r * 0.4 + Math.cos(1.2) * r, cy + Math.sin(1.2) * r); break;
        case 'staff': g.moveTo(x + size * 0.25, y + size * 0.85); g.lineTo(x + size * 0.7, y + size * 0.3); g.moveTo(cx + r * 0.7, cy - r * 0.7); g.arc(cx + r * 0.5, cy - r * 0.6, size * 0.12, 0, 7); break;
        case 'arts': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } break;
        case 'shield': g.moveTo(cx, y + size * 0.12); g.lineTo(x + size * 0.82, y + size * 0.25); g.quadraticCurveTo(x + size * 0.8, y + size * 0.72, cx, y + size * 0.9); g.quadraticCurveTo(x + size * 0.2, y + size * 0.72, x + size * 0.18, y + size * 0.25); g.closePath(); break;
        case 'bag': g.rect(x + size * 0.22, y + size * 0.35, size * 0.56, size * 0.5); g.moveTo(x + size * 0.36, y + size * 0.35); g.arc(cx, y + size * 0.35, size * 0.14, Math.PI, 0); break;
        case 'ff': g.moveTo(x + size * 0.15, y + size * 0.25); g.lineTo(cx, cy); g.lineTo(x + size * 0.15, y + size * 0.75); g.moveTo(cx, y + size * 0.25); g.lineTo(x + size * 0.85, cy); g.lineTo(cx, y + size * 0.75); g.fill(); break;
        case 'repeat': g.arc(cx, cy, r, 0.3, Math.PI * 1.7); g.moveTo(cx + r, cy - r * 0.2); g.lineTo(cx + r * 1.1, cy + r * 0.4); break;
        case 'exit': g.rect(x + size * 0.18, y + size * 0.2, size * 0.36, size * 0.6); g.moveTo(cx, cy); g.lineTo(x + size * 0.88, cy); g.moveTo(x + size * 0.74, cy - size * 0.12); g.lineTo(x + size * 0.88, cy); g.lineTo(x + size * 0.74, cy + size * 0.12); break;
        case 'bulb': g.arc(cx, cy - size * 0.08, r * 0.85, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(cx + size * 0.12, y + size * 0.78); g.lineTo(cx - size * 0.12, y + size * 0.78); g.closePath(); g.moveTo(cx - size * 0.12, y + size * 0.88); g.lineTo(cx + size * 0.12, y + size * 0.88); break;
        case 'coin': g.arc(cx, cy, r, 0, 7); g.moveTo(cx, cy - r * 0.5); g.lineTo(cx, cy + r * 0.5); break;
        case 'potion': g.moveTo(cx - size * 0.1, y + size * 0.15); g.lineTo(cx - size * 0.1, y + size * 0.4); g.lineTo(x + size * 0.22, y + size * 0.82); g.lineTo(x + size * 0.78, y + size * 0.82); g.lineTo(cx + size * 0.1, y + size * 0.4); g.lineTo(cx + size * 0.1, y + size * 0.15); break;
        case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); break;
        case 'steal': g.moveTo(x + size * 0.2, y + size * 0.7); g.quadraticCurveTo(cx, y + size * 0.1, x + size * 0.8, y + size * 0.35); g.moveTo(x + size * 0.65, y + size * 0.25); g.lineTo(x + size * 0.8, y + size * 0.35); g.lineTo(x + size * 0.68, y + size * 0.48); break;
        default: g.moveTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.lineTo(cx, cy - r); g.closePath();
      }
      g.stroke();
      g.restore();
    },
    diamond(g, x, y, s, fill, stroke, lw) {
      g.save(); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x - s, y); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
      g.restore();
    },
    hline(g, x1, x2, y, a, rgb) {
      g.save();
      const gr = g.createLinearGradient(x1, 0, x2, 0);
      const c = rgb || '240,228,200';
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.15, `rgba(${c},${a})`); gr.addColorStop(0.85, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(x1, Math.round(y), x2 - x1, 1);
      g.restore();
    },
    /** 現在（大きく太く）/ 最大（0.72 倍の細字）を右寄せ。→ 左端の x */
    frac(g, cur, max, xr, y, size, color) {
      const s2 = size * 0.72;
      const b = ' / ' + max;
      const w2 = K.measure(b, { size: s2, weight: 500 });
      K.text(g, b, xr, y + size - s2 - K.u(0.5), { size: s2, weight: 500, color: COL.text2, align: 'right', raw: true, shadow: true });
      K.text(g, String(cur), xr - w2, y, { size, weight: 700, color: color || COL.text, align: 'right', raw: true, shadow: true });
      return xr - w2 - K.measure(String(cur), { size, weight: 700 });
    },
    /** 前／後の小さな札 */
    rowTag(g, row, x, y, s) {
      const back = row === 'back';
      const c = back ? COL.back : COL.front;
      g.save();
      g.beginPath(); g.roundRect ? g.roundRect(x, y, s, s, 3) : g.rect(x, y, s, s);
      g.fillStyle = back ? 'rgba(30,50,80,0.8)' : 'rgba(70,44,20,0.8)'; g.fill();
      g.strokeStyle = c; g.lineWidth = 1; g.stroke();
      g.restore();
      K.text(g, back ? '後' : '前', x + s / 2, y + s * 0.12, { size: s * 0.72, weight: 700, color: c, align: 'center', raw: true });
    },
    prompts(g, list) {
      if (fn('prompts')) return R.UIK.prompts(g, list);
      const k = R.uiScale || 1, s = 11.5 * k;
      const x1 = R.W - (R.safe.r || 0) - 16 * k;
      let x = R.W - (R.safe.r || 0) - 16 * k;
      const y = R.H - (R.safe.b || 0) - 16 * k - s;
      for (const p of list.slice().reverse()) {
        const pr = R.Input.prompt(p.btn);
        x -= K.measure(p.label, { size: s });
        K.text(g, p.label, x, y, { size: s, color: COL.text2, raw: true, shadow: true });
        const kw = Math.max(s + 8 * k, K.measure(pr.label, { size: s, weight: 700 }) + 10 * k);
        x -= kw + 6 * k;
        R.Gfx.roundRect(x, y - 3 * k, kw, s + 6 * k, pr.kind === 'pad' ? (s + 6 * k) / 2 : 4, 'rgba(246,240,227,0.9)', null);
        K.text(g, pr.label, x + kw / 2, y, { size: s, weight: 700, color: '#1a1a28', align: 'center', raw: true });
        x -= 18 * k;
      }
      return { x, y: y - 4 * k, w: x1 - x, h: s + 8 * k };
    },
  };
  _.K = K;

  // ---------------------------------------------------------------- 右上のパーティの一覧（16:9）／下の 2×2 の札（縦持ち）
  const H = (_.hud = {});
  /** パーティの一覧の行の矩形（味方をねらうとき・タップの当たり） */
  H.partyRects = function (st) {
    const L = st.L, k = R.uiScale || 1;
    const units = st.partyUnits();
    if (L.tall) {
      const pad = 12 * k, gap = 8 * k, w = (R.W - pad * 2 - gap) / 2, h = 64 * k;
      return units.map((u, i) => ({ x: pad + (i % 2) * (w + gap), y: L.cardsY + Math.floor(i / 2) * (h + gap), w, h }));
    }
    const w = 236 * k, x = R.W - (R.safe.r || 0) - 14 * k - w, rowH = 44 * k;
    return units.map((u, i) => ({ x: x - 8 * k, y: 10 * k + i * rowH, w: w + 12 * k, h: rowH - 4 * k }));
  };

  H.party = function (g, st) {
    const L = st.L, k = R.uiScale || 1, t = R.Engine.time;
    const units = st.partyUnits();
    const rects = H.partyRects(st);
    if (!L.tall) K.band(g, { x: R.W - (R.safe.r || 0) - 340 * k, y: 0, w: 340 * k + (R.safe.r || 0), h: (units.length * 44 + 24) * k }, 'r', 0.42);
    units.forEach((u, i) => {
      const v = st.vis[u.uid] || u, r = rects[i];
      const hot = st.hot && st.hot[u.uid];
      if (L.tall) {
        K.panel(g, r, { r: 10 * k });
        if (st.activeUid === u.uid || hot) K.focus(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, t, { cursor: false });
      } else {
        if (st.glowUid === u.uid) {
          g.save();
          const gr = g.createLinearGradient(r.x - 30 * k, 0, r.x + r.w, 0);
          gr.addColorStop(0, 'rgba(255,214,120,0)'); gr.addColorStop(0.3, 'rgba(255,214,120,0.34)'); gr.addColorStop(1, 'rgba(255,214,120,0.12)');
          g.fillStyle = gr; g.fillRect(r.x - 30 * k, r.y, r.w + 30 * k, r.h);
          g.restore();
        }
        if (st.activeUid === u.uid || hot) K.focus(g, r, t);
      }
      const x0 = L.tall ? r.x + 10 * k : r.x + 12 * k;
      const ty = L.tall ? r.y + 8 * k : r.y + 4 * k;
      const low = v.alive && v.maxHp > 0 && v.hp / v.maxHp < 0.25;
      K.rowTag(g, u.row, x0, ty + 1 * k, 15 * k);
      const nameSize = (L.tall ? 15 : 12.5) * k;
      K.text(g, u.name, x0 + 21 * k, ty, { size: nameSize, weight: 700, color: !v.alive ? COL.disabled : low ? COL.hpLow[1] : COL.text, raw: true, shadow: true });
      // 状態の印（名前の右）
      let sx = x0 + 21 * k + K.measure(u.name, { size: nameSize, weight: 700 }) + 6 * k;
      for (const s of (v.status || []).slice(0, 4)) { R.BFX && R.BFX.statusMark && R.BFX.statusMark(g, s, sx, ty + nameSize * 0.55, 6 * k); sx += 14 * k; }
      if (!v.alive) K.text(g, '戦闘不能', sx + 2 * k, ty + 2 * k, { size: 10.5 * k, weight: 700, color: COL.down, raw: true, shadow: true });
      // HP / MP
      const bw = L.tall ? (r.w - 30 * k) / 2 : (r.w - 36 * k) / 2;
      const bx1 = L.tall ? r.x + 10 * k : r.x + 32 * k, bx2 = bx1 + bw + 8 * k;
      const vy = L.tall ? r.y + 34 * k : r.y + 19 * k;
      const numSize = (L.tall ? 15 : 16.5) * k;
      const block = (bx, lab, cur, max, kind, ghost) => {
        K.text(g, lab, bx, vy + numSize - 10 * k, { size: 9.5 * k, weight: 700, color: COL.text, raw: true, shadow: true });
        K.frac(g, cur, max, bx + bw - 2 * k, vy, numSize, kind === 'hp' && low ? COL.hpLow[1] : kind === 'hp' && !v.alive ? COL.disabled : COL.text);
        K.gauge(g, { x: bx, y: vy + numSize + 3 * k, w: bw - 2 * k, h: L.tall ? 3 : 1.5 }, cur, max, kind, { ghost });
      };
      const gh = st.ghost && st.ghost[u.uid];
      block(bx1, 'HP', Math.max(0, Math.round(v.hp)), v.maxHp, 'hp', gh && gh.k);
      block(bx2, 'MP', Math.max(0, Math.round(v.mp)), v.maxMp, 'mp');
    });
  };

  /** 左上の見出し（誰の番・説明）。MODERN_UI §2.3 の x 16〜380 */
  H.head = function (g, st) {
    const h = st.head;
    if (!h || !h.name) return;
    const k = R.uiScale || 1, x = (R.safe.l || 0) + 16 * k, y = (R.safe.t || 0) + 14 * k;
    const a = h.t0 != null ? Math.min(1, (R.Engine.time - h.t0) / 120) : 1;
    g.save();
    g.globalAlpha = a;
    K.band(g, { x: 0, y: 0, w: 460 * k, h: 64 * k }, 'l', 0.28);
    K.diamond(g, x + 14 * k, y + 14 * k, 13 * k, 'rgba(40,52,78,0.55)', 'rgba(236,230,214,0.85)', 1);
    K.diamond(g, x + 14 * k, y + 14 * k, 8 * k, null, h.tint || 'rgba(236,230,214,0.55)', 0.75);
    const x2 = x + Math.min(360, R.W * 0.4) * k;
    K.hline(g, x + 30 * k, x2, y + 13 * k + 14 * k, 0.55);
    K.text(g, K.fit(h.name, x2 - x - 40 * k, { size: 17 * k, weight: 700 }), x + 38 * k, y + 2 * k, { size: 17 * k, weight: 700, raw: true, shadow: true, color: h.color || COL.text });
    if (h.sub) K.text(g, K.fit(h.sub, st.L.tall ? R.W - x - 50 * k : R.W - x - 330 * k, { size: 12 * k }), x + 38 * k, y + 32 * k, { size: 12 * k, color: COL.text2, raw: true, shadow: true });
    g.restore();
  };

  /** 敵の名前（足もとに細い線＋名前） */
  H.enemyTags = function (g, st) {
    const k = R.uiScale || 1;
    for (const a of st.actors) {
      if (a.side !== 'enemy') continue;
      const v = st.vis[a.uid];
      if (!v || v.gone >= 1) continue;
      const alpha = Math.max(0, 1 - (v.gone || 0)) * (v.appear != null ? v.appear : 1);
      if (alpha <= 0.02) continue;
      const y = a.y + 8;
      g.save(); g.globalAlpha = alpha;
      K.hline(g, a.x - 44, a.x + 44, y, 0.5);
      const hot = st.hot && st.hot[a.uid];
      // 名前の下に薄い暗い札（明るい魔物・背景の上でも読めるように。コントラスト 4.5）
      { const ns = Math.max(11 * k, R.minFont || 0), nw = K.measure(a.name, { size: ns, weight: hot ? 700 : 500 }) + 10 * k; g.save(); g.fillStyle = 'rgba(8,10,20,0.62)'; g.beginPath(); if (g.roundRect) g.roundRect(a.x - nw / 2, y + 2, nw, ns + 5 * k, 4 * k); else g.rect(a.x - nw / 2, y + 2, nw, ns + 5 * k); g.fill(); g.restore(); }
      K.text(g, a.name, a.x, y + 4, { size: 11 * k, align: 'center', color: hot ? COL.goldHi : '#f2ede2', weight: hot ? 700 : 500, raw: true, shadow: true });
      g.restore();
    }
  };

  /** 左下の倍速の札・リピートの札（16:9）。縦持ちは札の列（タップで切り替え） */
  /**
   * 戦闘の速さの札（2026-09-27 の持ち主の決まり）: 「▶ 通常」「▶▶ ＋1」「▶▶▶ ＋2」。▶ は字でなく形で描く（字形の無いフォントでも同じに見える）。
   * R（縦持ちは札のタップ）で 通常 → ＋1 → ＋2 → 通常。変えた直後は少し光る。→ 幅
   */
  function speedChip(g, x, y, sp, size, pre) {
    const n = Bt.speedArrows(sp), label = (pre || '') + Bt.speedLabel(sp);
    const h = size + K.u(9), padX = K.u(8), tw = size * 0.62, gap = size * 0.08;
    const iw = n * tw + (n - 1) * gap + K.u(5);
    const w = K.measure(label, { size, weight: 700 }) + padX * 2 + iw;
    const col = sp > 1 ? COL.gold : COL.text2;
    const st = Bt.debug && Bt.debug();
    const flash = st && st.speedFx ? Math.max(0, 1 - (R.Engine.time - st.speedFx) / 600) : 0;
    g.save();
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, h / 2); else g.rect(x, y, w, h);
    g.fillStyle = 'rgba(14,16,28,0.62)'; g.fill();
    g.strokeStyle = flash > 0 ? `rgba(242,208,138,${0.3 + 0.6 * flash})` : sp > 1 ? 'rgba(236,201,124,0.5)' : 'rgba(240,228,200,0.28)'; g.lineWidth = 1 + flash; g.stroke();
    g.fillStyle = col;
    const cy = y + h / 2;
    for (let i = 0; i < n; i++) {
      const tx = x + padX + i * (tw + gap);
      g.beginPath(); g.moveTo(tx, cy - size * 0.36); g.lineTo(tx + tw, cy); g.lineTo(tx, cy + size * 0.36); g.closePath(); g.fill();
    }
    g.restore();
    K.text(g, label, x + padX + iw, y + (h - size) / 2 - K.u(0.5), { size, weight: 700, color: col, raw: true });
    return w;
  }

  H.chips = function (g, st) {
    const k = R.uiScale || 1, L = st.L;
    const sp = st.speed();
    st.chipRects = {};
    if (L.tall) {
      let x = 16 * k;
      const y = L.chipsY;
      const w1 = speedChip(g, x, y, sp, 12 * k, '速さ：');
      st.chipRects.speed = { x, y, w: w1, h: 22 * k }; x += w1 + 10 * k;
      const po = st.partyOpts || [];
      const on = !!(st.B && st.B.repeatOn);
      const w2 = K.chip(g, x, y, on ? 'リピート中：タップでやめる' : 'リピート', { icon: 'repeat', size: 12 * k, color: on ? COL.gold : po.includes('repeat') && st.phase === 'input' ? COL.text2 : COL.disabled, line: on ? 'rgba(236,201,124,0.7)' : undefined });
      st.chipRects.repeat = { x, y, w: w2, h: 22 * k }; x += w2 + 10 * k;
      if (!st.setup.noEscape && !(st.info && st.info.boss)) {   // ボス戦は逃げられない（BATTLE 34-11）: 札を出さない
        const w3 = K.chip(g, x, y, '逃げる', { icon: 'exit', size: 12 * k, color: po.includes('escape') ? COL.text2 : COL.disabled });
        st.chipRects.escape = { x, y, w: w3, h: 22 * k };
      }
      return;
    }
    // 16:9: 速さとリピートは右下の操作の案内に 1 つにまとめた（scene.js の Bt.prompts。2026-09-27 の持ち主の決まり）。左下には出さない
  };
})(window.RPG);
