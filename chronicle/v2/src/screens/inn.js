// MENUS: 宿（MODERN_UI §6.14、V2_PLAN §2.11「宿」）。params {price, name?} → {stay: bool}
//   画面は「泊まる／やめておく」を聞くだけ。お金・暗転・全快・lastInn・オートセーブ・手紙は ev.inn（EVENTS）が行う。
//   お金が足りないときは「泊まる」を灰色で残す（選ぶと buzzer）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  S.def('inn', {
    opaque: false, dim: 0.4,
    init(p) {
      this.price = p.price | 0;
      const can = S.gold() >= this.price;
      this.list = new R.UIK.List({ rows: [{ label: R.T('ui.inn.init.list.rows.0.label'), value: true, right: this.price + ' G', disabled: !can }, { label: R.T('ui.inn.init.list.rows.1.label'), value: false }], rowH: 40 });
      if (!can) this.list.focusIndex(1);
      this.list.onSelect = (row) => this.close({ stay: !!row.value });
      this.list.onCancel = () => this.close({ stay: false });
    },
    update() { this.list.update(); },
    draw(g) {
      const C = T().color, tall = S.tall();
      const w = Math.min(R.W - u(32), u(420));
      const h = u(190);
      const x = (R.W - w) / 2, y = tall ? R.H * 0.52 : (R.H - h) / 2;
      R.UIK.panel(g, { x, y, w, h }, { dense: true, frost: true });
      R.UIK.icon(g, 'inn', x + u(22), y + u(20), u(20), C.gold);
      R.UIK.text(g, this.p.name || R.T('ui.inn.draw.text'), x + u(52), y + u(21), { size: u(18), weight: 700, color: C.gold });
      R.UIK.text(g, R.T('ui.inn.draw.text_2', { UIK: R.UIK.num(S.gold()) }), x + w - u(22), y + u(24), { size: u(13), color: C.text2, align: 'right' });
      R.UIK.text(g, R.T('ui.inn.draw.text_3', { price: this.price }), x + u(22), y + u(56), { size: u(15), color: C.text, maxW: w - u(44) });
      this.list.draw(g, { x: x + u(12), y: y + u(90), w: w - u(24), h: this.list.rows.length * this.list.rowPx() });
      S.prompts(g, [{ btn: 'a', label: R.T('ui.inn.draw.0.label') }, { btn: 'b', label: R.T('ui.inn.draw.1.label') }]);
    },
  });
})(window.RPG);
