// MENUS: ワープの一覧（A2・A6、V2_PLAN §2.5.9 R.Field.warpList）。→ {warp: locId} | null（飛ぶのは閉じた後の FIELD）
//   行った町＋行ったダンジョンの入口を、町・ダンジョンの順に。右に地方の名前。確かめてから返す。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('warp', {
    init() {
      let ws = [];
      try { ws = R.Field.warpList() || []; } catch (e) { ws = []; }
      ws = ws.slice().sort((a, b) => (a.kind === 'town' ? 0 : 1) - (b.kind === 'town' ? 0 : 1));
      const here = (R.Field && R.Field.pos && R.DB.maps[R.Field.pos.map]) || {};
      this.list = new R.UIK.List({ rows: ws.map((w) => ({ value: w.id, label: w.name, w, disabled: here.location === w.id })), rowH: 40 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(null);
      this.busy = false;
    },
    async pick(row) {
      if (this.busy) return;
      this.busy = true;
      const k = await S.ask(this, { title: 'ワープ', text: row.label + ' へ飛ぶ？', choices: ['飛ぶ', 'やめる'], cancel: 1 });
      this.busy = false;
      if (k === 0) this.close({ warp: row.value });
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color;
      const w = Math.min(b.w, u(520)), x = b.x + (b.w - w) / 2;
      S.heading(g, 'ワープ', x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const h = Math.min(b.h - u(44), u(60) + Math.max(1, this.list.rows.length) * this.list.rowPx());
      const p = { x, y: b.y + u(44), w, h };
      R.UIK.panel(g, p, { frost: true });
      this.list.render = (gg, row, rect, f) => {
        const sz = u(16), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.icon(gg, row.w.kind === 'town' ? 'inn' : 'door', rect.x + u(16), cy, sz, row.disabled ? C.disabled : f ? C.gold : C.text2);
        R.UIK.text(gg, row.label, rect.x + u(44), cy, { size: sz, weight: f ? 700 : 500, color: row.disabled ? C.disabled : f ? C.goldHi : C.text, maxW: rect.w * 0.55 });
        R.UIK.text(gg, row.disabled ? 'いまいる所' : S.regionName(row.w.region), rect.x + rect.w - u(14), cy + u(2), { size: u(12.5), color: C.text3, align: 'right' });
      };
      this.list.draw(g, { x: p.x + u(10), y: p.y + u(12), w: p.w - u(20), h: p.h - u(24) });
      if (!this.list.rows.length) R.UIK.text(g, 'まだ飛べる所がない。', p.x + u(24), p.y + u(20), { size: u(15), color: C.text3 });
      S.prompts(g, [{ btn: 'a', label: '飛ぶ' }, { btn: 'b', label: '戻る' }]);
    },
  });
})(window.RPG);
