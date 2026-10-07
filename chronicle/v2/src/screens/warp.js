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
      // 飛べない行は灰色に、わけ（why）を持たせる。選ぶと黙らずにわけを出す（テスター Z1）
      const whyOf = (w) => {
        if (here.location === w.id) return 'here';
        try { return (R.Field.warpWhy && R.Field.warpWhy(w.id)) || null; } catch (e) { return 'failed'; }
      };
      this.list = new R.UIK.List({ rows: ws.map((w) => { const why = whyOf(w); return { value: w.id, label: w.name, w, why, disabled: !!why }; }), rowH: 40, selectDisabled: true });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(null);
      this.busy = false;
    },
    async pick(row) {
      if (this.busy) return;
      this.busy = true;
      // 問いが投げても busy を残さない（テスター Z1「ワープの一覧が入力を受けなくなった」）
      try {
        if (row.disabled) {
          try { R.UIK.sfx('buzzer'); } catch (e) { /* */ }
          await S.ask(this, { title: R.T('ui.warp.pick.k.ask.title'), text: R.Field.warpWhyText ? R.Field.warpWhyText(row.why) : R.T('sys.field.warp.fail.failed'), choices: [R.T('ui.warp.draw.1.label')], cancel: 0 });
          return;
        }
        const k = await S.ask(this, { title: R.T('ui.warp.pick.k.ask.title'), text: R.T('ui.warp.pick.k.ask.text', { label: row.label }), choices: R.T('ui.warp.pick.k.ask.choices'), cancel: 1 });
        if (k === 0) this.close({ warp: row.value });
      } catch (e) {
        console.error('[warp pick]', e);
      } finally { this.busy = false; }
    },
    update() { if (!this.busy) this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color;
      const w = Math.min(b.w, u(520)), x = b.x + (b.w - w) / 2;
      S.heading(g, R.T('ui.warp.draw.heading'), x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const h = Math.min(b.h - u(44), u(60) + Math.max(1, this.list.rows.length) * this.list.rowPx());
      const p = { x, y: b.y + u(44), w, h };
      R.UIK.panel(g, p, { frost: true });
      this.list.render = (gg, row, rect, f) => {
        const sz = u(16), cy = rect.y + (rect.h - sz) / 2 - u(1);
        R.UIK.icon(gg, row.w.kind === 'town' ? 'inn' : 'door', rect.x + u(16), cy, sz, row.disabled ? C.disabled : f ? C.gold : C.text2);
        R.UIK.text(gg, row.label, rect.x + u(44), cy, { size: sz, weight: f ? 700 : 500, color: row.disabled ? (f ? C.text2 : C.disabled) : f ? C.goldHi : C.text, maxW: rect.w * 0.55 });
        R.UIK.text(gg, row.why === 'here' ? R.T('ui.warp.draw.render.text') : S.regionName(row.w.region), rect.x + rect.w - u(14), cy + u(2), { size: u(12.5), color: C.text3, align: 'right' });
      };
      this.list.draw(g, { x: p.x + u(10), y: p.y + u(12), w: p.w - u(20), h: p.h - u(24) });
      if (!this.list.rows.length) R.UIK.text(g, R.T('ui.warp.draw.text'), p.x + u(24), p.y + u(20), { size: u(15), color: C.text3 });
      S.prompts(g, [{ btn: 'a', label: R.T('ui.warp.draw.0.label') }, { btn: 'b', label: R.T('ui.warp.draw.1.label') }]);
    },
  });
})(window.RPG);
