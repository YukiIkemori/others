// MENUS: 図鑑（MODERN_UI §6.10、A5・A28、V2_PLAN §2.5.15）
//   左: 系統ごとの魔物の一覧（出会った物は名前、まだの物は「？？？」）、進み具合のゲージ。
//   右: 右向きの HD の絵（hd:mon:<sprite>）、住む所、倒した数、落とす物（通常・レア・超レア・盗める物。手に入れた物だけ名前）。
//   盗み専用（drops.steal のある魔物）は手に入れるまで「盗み ？？？」だけ（入手の手がかりは出さない）。弱点の印は出さない。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const REGION = { prologue: R.T('ui.bestiary.REGION.prologue'), forest: R.T('ui.bestiary.REGION.forest'), snow: R.T('ui.bestiary.REGION.snow'), desert: R.T('ui.bestiary.REGION.desert'), marsh: R.T('ui.bestiary.REGION.marsh'), isles: R.T('ui.bestiary.REGION.isles'), mine: R.T('ui.bestiary.REGION.mine'), ash: R.T('ui.bestiary.REGION.ash'), star: R.T('ui.bestiary.REGION.star'), finale: R.T('ui.bestiary.REGION.finale'), postgame: R.T('ui.bestiary.REGION.postgame') };

  function isBoss(m) { return !!(m && (m.bossType || (m.flags || []).includes('boss'))); }
  S.bestiaryList = function () {
    const M = R.DB.monsters || {}, seen = new Set(), out = [];
    for (const L of Object.values(R.DB.lineages || {})) for (const st of L.stages || []) {
      if (M[st.mon] && !isBoss(M[st.mon]) && !seen.has(st.mon)) { seen.add(st.mon); out.push({ id: st.mon, lineage: L.name }); }
    }
    for (const id of Object.keys(M)) if (!seen.has(id) && !isBoss(M[id]) && !/^stub_/.test(id)) { seen.add(id); out.push({ id, lineage: M[id].rare ? R.T('ui.bestiary.bestiaryList.lineage') : R.T('ui.bestiary.bestiaryList.lineage_2') }); }
    return out;
  };
  function book(id) { const b = R.Game && R.Game.book && R.Game.book.mon; return (b && b[id]) || null; }
  function habitat(id) {
    const regs = new Set();
    for (const z of Object.values(R.DB.encounters || {})) {
      if ((z.groups || []).some((gr) => (gr.mons || []).some((m) => m[0] === id))) {
        const rg = R.DB.regions && (R.DB.regions['r_' + z.region] || R.DB.regions[z.region]);
        regs.add((rg && rg.name) || REGION[z.region] || '');
      }
    }
    return [...regs].filter(Boolean).join(R.T('ui.bestiary.habitat.join'));
  }

  S.def('bestiary', {
    init() {
      this.all = S.bestiaryList();
      this.list = new R.UIK.List({ rows: this.all.map((e, i) => ({ value: e.id, label: e.id, no: i + 1, lineage: e.lineage })), rowH: 32 });
      this.list.onCancel = () => this.close(undefined);
      this.list.onSelect = () => {};
      const first = this.all.findIndex((e) => book(e.id) && book(e.id).seen);
      if (first > 0) this.list.focusIndex(first);
    },
    update() { this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      const seenN = this.all.filter((e) => { const bk = book(e.id); return bk && bk.seen; }).length;
      const lw = tall ? b.w : Math.min(u(380), b.w * 0.4);
      const lp = { x: b.x, y: b.y, w: lw, h: tall ? b.h * 0.42 : b.h };
      R.UIK.panel(g, lp, { frost: true });
      S.heading(g, R.T('ui.bestiary.draw.heading'), lp.x + u(20), lp.y + u(16), 0, { size: 15, track: 4 });
      R.UIK.text(g, R.T('ui.bestiary.draw.text', { seenN, length: this.all.length }), lp.x + lp.w - u(20), lp.y + u(17), { size: u(13), color: C.text2, align: 'right' });
      R.UIK.gauge(g, { x: lp.x + u(20), y: lp.y + u(46), w: lp.w - u(40), h: u(3) }, seenN, this.all.length, ['#8a6a2a', '#f0cf7c']);
      this.list.render = (gg, row, rect, f) => {
        const bk = book(row.value), m = R.DB.monsters[row.value], known = bk && bk.seen;
        const sz = u(14.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.text(gg, String(row.no).padStart(3, '0'), rect.x + u(14), cy + u(1), { size: u(12), color: f ? C.text2 : C.text3 });   // 選んだ行の明るい地の上は一段明るく（コントラスト 4.5）
        R.UIK.text(gg, known ? m.name : R.T('ui.bestiary.draw.render.text'), rect.x + u(56), cy, { size: sz, weight: f ? 700 : 500, color: known ? (f ? C.goldHi : C.text) : f ? C.text2 : C.disabled, maxW: rect.w - u(110) });
        if (bk && bk.kills) R.UIK.text(gg, String(bk.kills), rect.x + rect.w - u(14), cy + u(1), { size: u(12.5), color: C.text3, align: 'right' });
      };
      this.list.draw(g, { x: lp.x + u(8), y: lp.y + u(60), w: lp.w - u(16), h: lp.h - u(70) });
      // 右
      const dp = tall ? { x: b.x, y: lp.y + lp.h + u(12), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(12)) } : { x: lp.x + lp.w + u(18), y: b.y, w: b.x + b.w - (lp.x + lp.w + u(18)), h: b.h };
      R.UIK.panel(g, dp, { frost: true });
      const id = (this.list.current() || {}).value, m = R.DB.monsters[id], bk = book(id);
      if (!m) return;
      const known = bk && bk.seen;
      const ah = Math.min(dp.h * 0.46, u(260));
      const stage = { x: dp.x + u(20), y: dp.y + u(20), w: dp.w - u(40), h: ah };
      g.save(); R.UIK.rr(g, stage.x, stage.y, stage.w, stage.h, u(10)); g.clip();
      const gr = g.createLinearGradient(0, stage.y, 0, stage.y + stage.h);
      gr.addColorStop(0, 'rgba(40,42,80,0.55)'); gr.addColorStop(1, 'rgba(18,18,34,0.55)');
      g.fillStyle = gr; g.fillRect(stage.x, stage.y, stage.w, stage.h);
      R.UIK.glow(g, stage.x + stage.w / 2, stage.y + stage.h * 0.8, stage.w * 0.35, [255, 200, 140], 0.18);
      g.fillStyle = 'rgba(8,8,16,0.35)'; g.beginPath(); g.ellipse(stage.x + stage.w / 2, stage.y + stage.h * 0.84, stage.w * 0.16, u(8), 0, 0, Math.PI * 2); g.fill();
      let drew = false;
      if (R.Hd && R.Hd.has && R.Hd.has('hd:mon:' + m.sprite)) {
        const sh = R.Hd.get('hd:mon:' + m.sprite, {});
        if (sh && sh.frames && sh.frames.length) {
          const pose = (sh.poses && sh.poses.idle) || [0];
          const fr = sh.frames[pose[Math.floor(R.Engine.time / 500) % pose.length]];
          const k = Math.max(1, Math.min(3, Math.floor((stage.h * 0.7) / Math.max(1, sh.h || (fr.c && fr.c.height) || 40))));
          g.save(); g.translate(stage.x + stage.w / 2, stage.y + stage.h * 0.84); g.scale(k, k);
          R.Hd.draw(g, fr, 0, 0, { alpha: 1, tint: known ? null : '#0b0c18', tintAmt: known ? 0 : 1 });
          g.restore();
          drew = true;
        }
      }
      if (!drew) R.UIK.text(g, known ? '' : R.T('ui.bestiary.draw.text_2'), stage.x + stage.w / 2, stage.y + stage.h / 2 - u(20), { size: u(40), weight: 700, color: C.disabled, align: 'center' });
      g.restore();
      let y = stage.y + stage.h + u(16);
      const px = dp.x + u(22), pw = dp.w - u(44);
      R.UIK.text(g, known ? m.name : R.T('ui.bestiary.draw.text_3'), px, y, { size: u(21), weight: 700, color: known ? C.goldHi : C.disabled, maxW: pw * 0.7 });
      R.UIK.text(g, known ? R.T('ui.bestiary.draw.text_4', { p0: (bk && bk.kills) || 0 }) : '', px + pw, y + u(4), { size: u(13), color: C.text2, align: 'right' });
      y += u(34);
      if (!known) { R.UIK.text(g, R.T('ui.bestiary.draw.text_5'), px, y, { size: u(14.5), color: C.text3 }); S.prompts(g, [{ btn: 'b', label: R.T('ui.bestiary.draw.0.label') }]); return; }
      const hab = habitat(id);
      if (hab) { R.UIK.text(g, R.T('ui.bestiary.draw.text_6', { hab }), px, y, { size: u(13), color: C.text2, maxW: pw }); y += u(24); }
      for (const l of R.UIK.wrap(R.I18n.unwrap(m.desc), pw, { size: u(14) }).slice(0, 2)) { R.UIK.text(g, l, px, y, { size: u(14), color: C.text }); y += u(23); }
      y += u(6);
      R.UIK.rule(g, px, px + pw, y, 0.14); y += u(12);
      S.label(g, R.T('ui.bestiary.draw.label'), px, y); y += u(26);
      const D = m.drops || {};
      const line = (lab, key, col, slot) => {
        const d = slot || D[key];
        if (!d) return;
        const got = bk && bk[key];
        R.UIK.text(g, lab, px, y, { size: u(12.5), color: col || C.text3 });
        if (d.item && got) S.itemLabel(g, d.item, px + u(96), y - u(1), { size: u(14), maxW: pw - u(96) });
        else R.UIK.text(g, R.T('ui.bestiary.draw.line.text'), px + u(96), y - u(1), { size: u(14), color: C.disabled });
        y += u(24);
      };
      line(R.T('ui.bestiary.draw.line'), 'normal'); line(R.T('ui.bestiary.draw.line_2'), 'rare', C.rare); line(R.T('ui.bestiary.draw.line_3'), 'super', C.superRare);
      // 盗みのレア（レアの枠の steal。落とす品と別の品。持ち主 2026-10-04）: 盗んだら「盗み（レア）」の行に出る
      if (D.rare && D.rare.steal && D.rare.steal !== D.rare.item) line(R.T('ui.bestiary.draw.line_5'), 'rareSteal', C.rare, { item: D.rare.steal });
      if (D.steal) line(R.T('ui.bestiary.draw.line_4'), 'steal', C.teal);
      S.prompts(g, [{ btn: 'up', label: R.T('ui.bestiary.draw.0.label_2') }, { btn: 'b', label: R.T('ui.bestiary.draw.1.label') }]);
    },
  });
})(window.RPG);
