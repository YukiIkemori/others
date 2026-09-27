// MENUS: 年代記・手がかり（MODERN_UI §6.11、WORLD_REDESIGN §3.2、V2_PLAN §2.6.4・§3.5）
//   タブ（L/R）: 年代記（章）／手がかり。手がかりは地方ごとに並べ、右に題名・聞いた所・場所と方角・詳しい文。
//   A で目印（1 つだけ、琥珀の羽ペンの印。もう一度 A で外す）。解決した物は薄く。slice:'locked' は「この先は、まだ語られていない」。
//   開いて見た手がかりは seen（「新」の印が消える）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const KIND = { main: '本筋', region: '地方', side: '依頼', rumor: 'うわさ', map: '地図' };
  const REGION_ORDER = ['prologue', 'r_forest', 'r_snow', 'r_desert', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];

  S.regionName = function (rid) {
    const rg = R.DB.regions && R.DB.regions[rid];
    if (rg && rg.name) return rg.name;
    return ({ prologue: 'ファロス半島', r_forest: 'ヴェルダの森', r_snow: '雪の地方', r_desert: '砂の地方', r_marsh: '沼の地方', r_isles: '島の地方', r_mine: '鉱山の地方', r_ash: '灰の地方', r_star: '星の地方', main: '本筋', '-': '' })[rid] || '';
  };

  S.def('chronicle', {
    init() {
      this.tab = 1;
      this.list = new R.UIK.List({ rows: [], rowH: 34 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.refresh(false);
      if (!this.list.rows.length) { this.tab = 0; this.refresh(false); }
    },
    leadRows() {
      let groups = [];
      try { groups = R.Leads.list() || []; } catch (e) { groups = []; }
      groups = groups.slice().sort((a, b) => (REGION_ORDER.indexOf(a.region) + 99) % 99 - (REGION_ORDER.indexOf(b.region) + 99) % 99);
      const rows = [];
      for (const gr of groups) {
        const items = gr.items.slice().sort((a, b) => (a.state === 'done') - (b.state === 'done'));
        items.forEach((it, i) => {
          const L = (R.DB.leads || {})[it.id] || { title: it.id, text: '' };
          rows.push({ value: it.id, label: L.title, L, st: it.state, pinned: it.pinned, region: gr.region, first: i === 0, locked: L.slice === 'locked' });
        });
      }
      return rows;
    },
    chapterRows() {
      const G = R.Game || {};
      const ch = (G.chronicle && G.chronicle.chapters) || [];
      return ch.map((c, i) => {
        const txt = (R.DB.chronicle && (R.DB.chronicle[c.summaryKey] || R.DB.chronicle[c.id])) || null;
        const title = (txt && txt.title) || (c.id === 'prologue' ? '序章' : S.regionName(c.id));
        return { value: c.id, label: title, no: i, text: txt ? (Array.isArray(txt.text) ? txt.text.join('\n') : txt.text || '') : '' };
      });
    },
    refresh(keep) { this.list.setRows(this.tab === 0 ? this.chapterRows() : this.leadRows(), keep); },
    pick(row) {
      if (this.tab !== 1) return;
      if (row.locked) { R.UIK.sfx('buzzer'); return; }
      if (row.st === 'done') { R.UIK.sfx('buzzer'); return; }
      if (row.pinned) { R.Leads.unpin(); R.UIK.toast('目印を外した', { anchor: 'bl', icon: 'pin' }); }
      else { R.Leads.pin(row.value); R.UIK.toast('目印を付けた：' + row.label, { anchor: 'bl', icon: 'pin' }); }
      this.refresh(true);
    },
    update() {
      const k = S.tabInput(this.tabRects, this.tab, 2);
      if (k >= 0) { this.tab = k; this.refresh(false); return; }
      this.list.update();
      // 見た手がかり
      const row = this.list.current();
      if (this.tab === 1 && row && R.Game && R.Game.leads && R.Game.leads[row.value] && !R.Game.leads[row.value].seen) {
        if (R.Leads.seen) R.Leads.seen(row.value); else R.Game.leads[row.value].seen = true;
      }
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      this.tabRects = S.tabs(g, ['年代記', '手がかり'], this.tab, b.x + u(4), b.y + u(4));
      const lw = tall ? b.w : Math.min(u(400), b.w * 0.42);
      const lp = { x: b.x, y: b.y + u(48), w: lw, h: tall ? b.h * 0.42 : b.h - u(48) };
      R.UIK.panel(g, lp, { frost: true });
      const lr = { x: lp.x + u(8), y: lp.y + u(12), w: lp.w - u(16), h: lp.h - u(24) };
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15), cy = rect.y + (rect.h - sz) / 2 - u(1);
        if (this.tab === 0) {
          R.UIK.icon(gg, 'book', rect.x + u(14), cy, sz, f ? C.gold : C.text2);
          R.UIK.text(gg, row.label, rect.x + u(40), cy, { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w - u(50) });
          return;
        }
        const dim = row.st === 'done' || row.locked;
        if (row.pinned) R.UIK.icon(gg, 'pin', rect.x + u(12), cy, sz, C.gold);
        else if (row.st === 'new') R.UIK.diamond(gg, rect.x + u(19), rect.y + rect.h / 2, u(4), C.gold);
        else if (row.st === 'done') R.UIK.icon(gg, 'check', rect.x + u(12), cy, sz, C.disabled);
        R.UIK.text(gg, row.label, rect.x + u(38), cy, { size: sz, weight: f ? 700 : 500, color: dim ? C.disabled : f ? C.goldHi : C.text, maxW: rect.w - u(130) });
        R.UIK.text(gg, S.regionName(row.region), rect.x + rect.w - u(12), cy + u(2), { size: u(11.5), color: C.text3, align: 'right', maxW: u(84) });
      };
      this.list.draw(g, lr);
      if (!this.list.rows.length) R.UIK.text(g, this.tab === 0 ? 'まだ何も書かれていない。' : 'まだ何も聞いていない。', lr.x + u(16), lr.y + u(8), { size: u(15), color: C.text3 });
      // 右
      const dp = tall ? { x: b.x, y: lp.y + lp.h + u(12), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(12)) } : { x: lp.x + lp.w + u(18), y: b.y, w: b.x + b.w - (lp.x + lp.w + u(18)), h: b.h };
      R.UIK.panel(g, dp, { frost: true });
      const row = this.list.current(), px = dp.x + u(26), pw = dp.w - u(52);
      let y = dp.y + u(24);
      if (row && this.tab === 0) {
        R.UIK.text(g, `第 ${row.no + 1} 章`, px, y, { size: u(13), weight: 700, color: C.gold, track: u(2) }); y += u(26);
        R.UIK.text(g, row.label, px, y, { size: u(22), weight: 700, color: C.goldHi, maxW: pw }); y += u(40);
        for (const l of R.UIK.wrap(row.text || '', pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: C.text }); y += u(28); if (y > dp.y + dp.h - u(30)) break; }
      } else if (row) {
        const L = row.L;
        let cx = px;
        cx += R.UIK.chip(g, cx, y, KIND[L.kind] || '手がかり', { kind: L.kind === 'main' ? 'gold' : 'plain', size: 11 }) + u(8);
        if (row.pinned) R.UIK.chip(g, cx, y, '目印', { kind: 'gold', size: 11, icon: 'pin' });
        y += u(32);
        R.UIK.text(g, L.title, px, y, { size: u(22), weight: 700, color: row.locked || row.st === 'done' ? C.text2 : C.goldHi, maxW: pw }); y += u(40);
        const meta = [];
        if (L.from) meta.push(['聞いた所', S.locName(L.from)]);
        if (L.place || L.dir) meta.push(['場所', [S.locName(L.place), L.dir].filter(Boolean).join('　・　')]);
        for (const [k, v] of meta) { R.UIK.text(g, k, px, y, { size: u(12.5), color: C.text3 }); R.UIK.text(g, v, px + u(84), y - u(1), { size: u(14.5), color: C.text, maxW: pw - u(84) }); y += u(26); }
        y += u(6); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
        const text = row.locked ? 'この先は、まだ語られていない。' : String(L.text || '');
        for (const l of R.UIK.wrap(text, pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: row.locked ? C.text3 : C.text }); y += u(28); if (y > dp.y + dp.h - u(30)) break; }
        if (row.st === 'done') R.UIK.chip(g, px, dp.y + dp.h - u(40), '解決した', { kind: 'plain', size: 11, icon: 'check' });
      }
      S.prompts(g, this.tab === 1 ? [{ btn: 'a', label: '目印' }, { btn: 'l', label: '年代記' }, { btn: 'b', label: '戻る' }] : [{ btn: 'r', label: '手がかり' }, { btn: 'b', label: '戻る' }]);
    },
  });
})(window.RPG);
