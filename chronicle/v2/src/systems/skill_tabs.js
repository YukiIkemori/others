// 技・術の一覧の「種類のタブ」と MP の並び（持ち主 2026-10-01「剣なら剣、火なら火で分けて、左右か LR で切り替え。MP の少ない順に」）
//   R.SkillTabs.catOf(a)                 技 → 武器の系統（sword …）、単属性の術 → その属性（fire …）、2・3 属性の術 → 'combo'（合成術）、属性の無い術 → 'other'
//   R.SkillTabs.sortIds(c, ids, costOf?) MP の少ない順。同じ MP は覚えた順（c.techs・c.spells の並び）→ id（いつも同じ並び）
//   R.SkillTabs.group(c, items, o)       items = [{id, kind:'tech'|'spell', …}] → [{key, kind, label, icon, items}]（持っている種類だけ。
//                                        技は系統の順 → 術は属性の順 → 合成 → その他。中は sortIds の順）。o.cost(id) で MP を差し替え（戦闘の reasonRow の mp）
//   R.SkillTabs.recall(cid, list) / remember(cid, list, key)   人 × 一覧ごとの最後のタブ（この起動の間だけ。セーブには入れない）
//   R.SkillTabs.startIndex(groups, cid, list, prefer)           覚えたタブ → prefer の種類 → 先頭
//   R.SkillTabs.drawBar(g, rect, groups, index, o)              タブの帯（種類が 1 つなら描かない）。→ [{x,y,w,h,i}] 押せる札（左右の矢印は i = 'prev' / 'next'）
//   R.SkillTabs.input(n, index, rects, o)                       ←→（o.arrows）・L/R（o.lr）・札のクリック → 新しい index か -1
(function (R) {
  'use strict';
  const ST = (R.SkillTabs = R.SkillTabs || {});
  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const act = (id) => (R.Rules && R.Rules.actionOf ? R.Rules.actionOf(id) : null) || (R.DB.techs || {})[id] || (R.DB.spells || {})[id] || null;
  const wtypes = () => { const W = R.DB.weaponTypes || {}; return Object.keys(W).sort((a, b) => (W[a].order || 0) - (W[b].order || 0)); };

  ST.catOf = function (a) {
    if (!a) return 'other';
    if (a.kind === 'tech') return a.wtype || 'other';
    const e = a.elements || (a.element ? [a.element] : []);
    if (e.length === 1) return e[0];
    return e.length > 1 ? 'combo' : 'other';
  };
  /** 種類の並び（技の系統 → 属性 → 合成 → その他） */
  ST.catRank = function (kind, key) {
    if (kind === 'tech') { const i = wtypes().indexOf(key); return i < 0 ? 90 : i; }
    const i = EL.indexOf(key);
    return 100 + (i >= 0 ? i : key === 'combo' ? 10 : 20);
  };
  ST.catLabel = function (kind, key) {
    if (key === 'combo') return R.T('ui.skillTabs.combo');
    if (key === 'other') return R.T('ui.skillTabs.other');
    if (kind === 'tech') { const W = R.DB.weaponTypes || {}; return (W[key] && W[key].name) || key; }
    const E = R.DB.elements || {};
    return (E[key] && E[key].name) || key;
  };
  ST.catIcon = function (kind, key) {
    const has = (n) => !!(R.UIK && R.UIK.hasIcon && R.UIK.hasIcon(n));
    if (kind === 'tech') { const W = R.DB.weaponTypes || {}; const ic = (W[key] && W[key].icon) || key; return has(ic) ? ic : 'sword'; }
    return has(key) ? key : 'arts';
  };

  /** MP の少ない順（同じなら覚えた順 → id） */
  ST.sortIds = function (c, ids, costOf) {
    const learn = {};
    ((c && c.techs) || []).forEach((id, i) => { if (learn[id] == null) learn[id] = i; });
    ((c && c.spells) || []).forEach((id, i) => { if (learn[id] == null) learn[id] = i; });
    const cost = costOf || ((id) => (c && R.Rules && R.Rules.mpCost ? R.Rules.mpCost(c, id) : ((act(id) || {}).mp || 0)));
    const m = {};
    for (const id of ids) m[id] = Number(cost(id)) || 0;
    return ids.slice().sort((x, y) => m[x] - m[y] || (learn[x] != null ? learn[x] : 1e6) - (learn[y] != null ? learn[y] : 1e6) || (x < y ? -1 : x > y ? 1 : 0));
  };

  /** 種類ごとに分ける。items は {id, kind} を持つ物（行のまま渡してよい） */
  ST.group = function (c, items, o) {
    o = o || {};
    const by = {};
    for (const it of items || []) {
      const a = it.a || act(it.id);
      const kind = it.kind === 'tech' || it.kind === 'skill' || (a && a.kind === 'tech') ? 'tech' : 'spell';
      const key = ST.catOf(a || { kind });
      const k = kind + ':' + key;
      (by[k] = by[k] || { key, kind, id: k, items: [] }).items.push(it);
    }
    const out = Object.values(by).sort((x, y) => ST.catRank(x.kind, x.key) - ST.catRank(y.kind, y.key));
    for (const gr of out) {
      gr.label = ST.catLabel(gr.kind, gr.key);
      gr.icon = ST.catIcon(gr.kind, gr.key);
      const ids = ST.sortIds(c, gr.items.map((it) => it.id), o.cost);
      const pos = {};
      ids.forEach((id, i) => { pos[id] = i; });
      gr.items.sort((x, y) => pos[x.id] - pos[y.id]);
    }
    return out;
  };

  // ---------------------------------------------------------------- 覚えたタブ（人 × 一覧。この起動の間だけ）
  ST._mem = ST._mem || {};
  ST.recall = (cid, list) => ST._mem[String(cid) + '|' + list] || null;
  ST.remember = (cid, list, key) => { if (cid != null && key) ST._mem[String(cid) + '|' + list] = key; };
  ST.startIndex = function (groups, cid, list, prefer) {
    const k = ST.recall(cid, list);
    let i = k ? groups.findIndex((gr) => gr.id === k) : -1;
    if (i < 0 && prefer) i = groups.findIndex((gr) => gr.id === prefer);
    return i < 0 ? 0 : i;
  };

  // ---------------------------------------------------------------- 入力
  /** →新しい index か -1。o = {arrows: ←→ で切り替え, lr: L/R で切り替え} */
  ST.input = function (n, index, rects, o) {
    o = o || {};
    if (n <= 1) return -1;
    const I = R.Input, sfx = () => { try { R.UIK.sfx('cursor'); } catch (e) { /* ignore */ } };
    let d = 0;
    if (o.arrows && I.repeat('right')) d = 1;
    else if (o.arrows && I.repeat('left')) d = -1;
    else if (o.lr && I.pressed('r')) d = 1;
    else if (o.lr && I.pressed('l')) d = -1;
    if (d) { sfx(); return (index + d + n) % n; }
    const p = I.pointer;
    if (p && p.pressed && rects) {
      for (const r of rects) {
        if (!(p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)) continue;
        const j = r.i === 'prev' ? (index + n - 1) % n : r.i === 'next' ? (index + 1) % n : r.i;
        if (j === index) return -1;
        sfx();
        return j;
      }
    }
    return -1;
  };

  // ---------------------------------------------------------------- 描く
  /** タブの帯。rect = {x, y, w, h}（掛けた後）。o = {glyphs: ['l','r'] | ['left','right'], size}。→ 押せる札 */
  ST.drawBar = function (g, rect, groups, index, o) {
    o = o || {};
    const n = groups.length;
    if (n <= 1) return [];
    const U = R.UIK, C = U.T.color, k = R.uiScale || 1;
    const sz = (o.size || 12.5) * k, isz = sz * 1.05, h = rect.h, cy = rect.y + h / 2;
    const gl = o.glyphs || ['left', 'right'];
    const gs = 11 * k;
    const gw = Math.max(U.glyphWidth(gl[0], gs), U.glyphWidth(gl[1], gs));
    const rects = [];
    // 左右の印（押せる）
    U.glyph(g, gl[0], rect.x + gs / 2 + gs * 0.14, cy, { size: gs });
    rects.push({ x: rect.x - 4 * k, y: rect.y, w: gw + 8 * k, h, i: 'prev' });
    const rx = rect.x + rect.w - gw;
    U.glyph(g, gl[1], rx + gs / 2 + gs * 0.14, cy, { size: gs });
    rects.push({ x: rx - 4 * k, y: rect.y, w: gw + 8 * k, h, i: 'next' });
    const x0 = rect.x + gw + 6 * k, avail = rx - 6 * k - x0;
    const pad = 9 * k, gap = 3 * k;
    // 名前を全部出せるか（入らなければ、今の札だけ名前・ほかは印だけ）
    const full = groups.map((gr) => isz + 5 * k + U.measure(gr.label, { size: sz, weight: 700 }) + pad * 2);
    const iconOnly = isz + pad * 1.4;
    const fits = full.reduce((s, v) => s + v, 0) + gap * (n - 1) <= avail;
    const ws = groups.map((gr, i) => (fits || i === index ? full[i] : iconOnly));
    const total = ws.reduce((s, v) => s + v, 0) + gap * (n - 1);
    let sc = total > avail ? avail / total : 1;   // それでも入らなければ詰める
    // 詰めるときは今の札の名前を切らない（ほかの印だけ詰める。詰めすぎるときは全部を同じに）。「すべて」のような長い名前が「す…」になった
    let scCur = sc;
    if (sc < 1 && !fits) {
      const so = (avail - ws[index] - gap * (n - 1)) / Math.max(1, total - ws[index] - gap * (n - 1));
      if (so >= 0.5) { sc = Math.min(1, so); scCur = 1; }
    }
    const tw = ws.reduce((s, v, i) => s + v * (i === index ? scCur : sc), 0) + gap * sc * (n - 1);
    let cx = x0 + Math.max(0, (avail - tw) / 2);
    groups.forEach((gr, i) => {
      const on = i === index, k1 = on ? scCur : sc, w = ws[i] * k1;
      const r = { x: cx, y: rect.y + 2 * k, w, h: h - 4 * k, i };
      if (on) {
        g.save(); U.rr(g, r.x, r.y, r.w, r.h, r.h / 2);
        const gr2 = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr2.addColorStop(0, 'rgba(236,201,124,0.32)'); gr2.addColorStop(1, 'rgba(236,201,124,0.14)');
        g.fillStyle = gr2; g.fill(); g.strokeStyle = 'rgba(236,201,124,0.65)'; g.lineWidth = 0.75; g.stroke(); g.restore();
      }
      const col = on ? C.goldHi : C.text3;
      const showLabel = fits || on;
      const iw = isz * Math.min(1, k1 + 0.2);
      const ix = showLabel ? r.x + pad * k1 : r.x + (r.w - iw) / 2;
      U.icon(g, gr.icon, ix, cy - iw / 2, iw, on ? C.gold : C.text3);
      if (showLabel) U.text(g, gr.label, ix + iw + 5 * k * k1, cy - sz / 2 - 0.5 * k, { size: sz, weight: 700, color: col, maxW: r.w - (ix + iw - r.x) - pad * k1 });
      rects.push(r);
      cx += w + gap * sc;
    });
    return rects;
  };
  /** 帯の高さ（掛ける前） */
  ST.BAR_H = 28;
})(window.RPG);
