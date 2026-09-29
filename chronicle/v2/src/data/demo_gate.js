// 体験版の境（DB.config.slice の間だけ効く。持ち主 2026-09-28「体験版の出口」）
//   体験版で行ける地方 = DB.config.sliceOpen（序章の半島・ヴェルダの森・world）。峠の番人と崖崩れ（cond {slice:true}）が表の止め。
//   ここはその裏の止め（どこから歩いても境の先へ抜けない・壊れない）:
//   1. 行ける地方のマップの出口・扉・階段・建物の戸口で、行き先が行けない地方のマップの物に
//      gate {when:{slice:true}, text: TEXT} を足す（move.js の通せんぼ。入らずに文を出して 1 歩下がる）。
//      もう gate のある物（序章の SOLO_GATES など）はそのまま。
//   2. 体験版の間は消える出口（cond {not:{slice:true}}。エリアの峠 → 前のワールド）には、同じ所に
//      「体験版の間だけ効く」写しの出口（cond {slice:true}＋gate）を後ろに足す。黙って何も起きない、を無くす。
//   3. ワープの一覧（R.Field.warpList）から行けない地方の場所を外す（古い記録に残った印でも飛べない）。
//   地方の見分け: map.region → map.location の region → 無ければ 'prologue'（tester.js の warpList と同じ）。
//   R.DemoGate.regionOf(mapId) / isOpen(mapId) / TEXT。止めた数は R.DemoGate.stats（テストが読む）。
(function (R) {
  'use strict';
  const TEXT = R.T('data.demo_gate.TEXT');
  const DG = (R.DemoGate = R.DemoGate || {});
  DG.TEXT = TEXT;
  DG.stats = { gated: 0, mirrored: 0 };

  const cfg = () => R.DB.config || {};
  DG.slice = () => !!cfg().slice;
  DG.regionOf = function (mapId) {
    const m = R.DB.maps && R.DB.maps[mapId];
    if (!m) return null;
    const loc = m.location && R.DB.locations && R.DB.locations[m.location];
    return m.region || (loc && loc.region) || 'prologue';
  };
  /** そのマップが体験版で行ける地方か（sliceOpen が無ければ全部行ける） */
  DG.isOpen = function (mapId) {
    const open = cfg().sliceOpen;
    if (!Array.isArray(open) || !open.length) return true;
    const r = DG.regionOf(mapId);
    return r == null || open.includes(r);
  };
  const SLICE_ONLY = { slice: true };
  const gate = () => ({ when: SLICE_ONLY, text: TEXT, demo: true });
  /** cond が「体験版の間は偽」の形か（{not:{slice:true}} か {slice:false}） */
  const offInSlice = (c) => !!(c && typeof c === 'object' && ((c.not && c.not.slice === true) || c.slice === false));

  function apply() {
    const M = R.DB.maps || {};
    if (!Array.isArray(cfg().sliceOpen)) return;
    for (const [id, m] of Object.entries(M)) {
      if (!m || /^stub_/.test(id) || !DG.isOpen(id)) continue;
      const put = (o, to) => {
        if (!o || !to || !to.map || !M[to.map] || o.gate !== undefined) return;
        if (DG.isOpen(to.map)) return;
        o.gate = gate(); DG.stats.gated++;
      };
      const add = [];
      for (const e of m.exits || []) {
        put(e, e.to);
        if (offInSlice(e.cond) && e.to && !(m.exits || []).some((x) => x !== e && x.demoMirror && x.x === e.x && x.y === e.y)) {
          add.push(Object.assign({}, e, { cond: SLICE_ONLY, gate: gate(), demoMirror: true }));
        }
      }
      if (add.length) { m.exits.push(...add); DG.stats.mirrored += add.length; }
      for (const o of m.objects || []) {
        if (o.type === 'building') put(o.door, o.door && o.door.to);
        else put(o, o.to);
      }
    }
  }
  /** (x, y) にこの境の通せんぼ（gate.demo）があれば、その行き先のマップの id（計測の demo_boundary 用） */
  DG.at = function (mapId, x, y) {
    const m = R.DB.maps && R.DB.maps[mapId];
    if (!m) return null;
    const inR = (r) => r && x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);
    for (const e of m.exits || []) if (e.gate && e.gate.demo && inR(e) && (!e.cond || R.State.check(e.cond))) return e.to.map;
    for (const o of m.objects || []) {
      const d = o.type === 'building' ? o.door : o;
      if (d && d.gate && d.gate.demo && d.to && d.x === x && d.y === y) return d.to.map;
    }
    return null;
  };
  // 3 段: マップの登録（1 段目）と field_00_kit.js の付け替え（2 段目）がすんでから
  if (R.onData) R.onData(() => R.onData(() => R.onData(apply)));

  // ワープの一覧: 行けない地方の場所を外す（R.Field.warpList を包む。体験版の間だけ）
  if (R.onData) R.onData(() => {
    const F = R.Field;
    if (!F || !F.warpList || F.warpList._demo) return;
    const base = F.warpList;
    const wrapped = function () {
      const list = base.apply(this, arguments) || [];
      if (!DG.slice() || !Array.isArray(cfg().sliceOpen)) return list;
      return list.filter((l) => !l.region || cfg().sliceOpen.includes(l.region));
    };
    wrapped._demo = true;
    F.warpList = wrapped;
  });
})(window.RPG);
