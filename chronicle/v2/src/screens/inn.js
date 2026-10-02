// MENUS: 宿（MODERN_UI §6.14、V2_PLAN §2.11「宿」）。params {price, name?, choices?, text?} → {stay: bool, pick?}
//   choices（泊まり方の名の配列。例「朝の鐘まで泊まる」「消灯の刻まで休む」）があれば、それを並べて「やめておく」を足す → pick = 選んだ番号。
//   宿の人が「朝の鐘まで？ 消灯の刻まで？」と聞くのに画面が「泊まる」だけだった（テスター 2026-10-02 P37）。
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
      const stays = Array.isArray(p.choices) && p.choices.length ? p.choices : [R.T('ui.inn.init.list.rows.0.label')];
      const rows = stays.map((label, i) => ({ label, value: i + 1, right: this.price + ' G', disabled: !can }));
      rows.push({ label: R.T('ui.inn.init.list.rows.1.label'), value: 0 });
      this.list = new R.UIK.List({ rows, rowH: 40 });
      if (!can) this.list.focusIndex(rows.length - 1);
      this.list.onSelect = (row) => this.close(row.value ? { stay: true, pick: row.value - 1 } : { stay: false });
      this.list.onCancel = () => this.close({ stay: false });
    },
    update() { this.list.update(); },
    draw(g) {
      const C = T().color, tall = S.tall();
      const w = Math.min(R.W - u(32), u(420));
      const h = u(110) + this.list.rows.length * this.list.rowPx();   // 2 行で前と同じ u(190)
      const x = (R.W - w) / 2, y = tall ? R.H * 0.52 : (R.H - h) / 2;
      R.UIK.panel(g, { x, y, w, h }, { dense: true, frost: true });
      R.UIK.icon(g, 'inn', x + u(22), y + u(20), u(20), C.gold);
      R.UIK.text(g, this.p.name || R.T('ui.inn.draw.text'), x + u(52), y + u(21), { size: u(18), weight: 700, color: C.gold });
      R.UIK.text(g, R.T('ui.inn.draw.text_2', { UIK: R.UIK.num(S.gold()) }), x + w - u(22), y + u(24), { size: u(13), color: C.text2, align: 'right' });
      R.UIK.text(g, this.p.text || R.T(this.p.choices ? 'ui.inn.draw.text_4' : 'ui.inn.draw.text_3', { price: this.price }), x + u(22), y + u(56), { size: u(15), color: C.text, maxW: w - u(44) });
      this.list.draw(g, { x: x + u(12), y: y + u(90), w: w - u(24), h: this.list.rows.length * this.list.rowPx() });
      S.prompts(g, [{ btn: 'a', label: R.T('ui.inn.draw.0.label') }, { btn: 'b', label: R.T('ui.inn.draw.1.label') }]);
    },
  });
})(window.RPG);
