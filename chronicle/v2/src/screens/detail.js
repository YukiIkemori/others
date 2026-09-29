// MENUS: 詳しい表示（Y／長押し、A6。V2_PLAN §2.5.15）。params {kind:'item'|'tech'|'spell'|'mon', id} → undefined
//   品: 名前・レアの星・種類・品の値（攻撃 58 など）・説明。技・術: 消費の MP・範囲・系統／属性・説明。魔物: 名前・説明。
//   数字の効果（％など）は品の説明文に書かれた物だけ。熟練の補正・計算の合計は出さない（A17）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const RAW = ['atk', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit'];

  S.def('detail', {
    opaque: false, dim: 0.5,
    init(p) {
      let kind = p.kind, id = p.id;
      if (!kind || kind === 'attack' || kind === 'skill') kind = R.DB.items[id] ? 'item' : R.DB.techs[id] ? 'tech' : R.DB.spells[id] ? 'spell' : R.DB.monsters[id] ? 'mon' : 'item';
      this.kind = kind;
      this.d = kind === 'item' ? R.DB.items[id] : kind === 'tech' ? R.DB.techs[id] : kind === 'spell' ? R.DB.spells[id] : R.DB.monsters[id];
      this.from = kind === 'tech' && p.c && S.derivedFromName ? S.derivedFromName(p.c, id) : null;   // 派生技（技・術の画面から）
    },
    update() {
      const I = R.Input;
      if (I.pressed('a') || I.pressed('b') || I.pressed('y') || I.pressed('x') || (I.pointer.pressed && (I.lastDevice === 'touch' || (this.rect && R.UIK.hit(this.rect, I.pointer.x, I.pointer.y))))) { R.UIK.sfx('cancel'); this.close(undefined); }
    },
    draw(g) {
      const C = T().color, d = this.d;
      const w = Math.min(R.W - u(32), u(500));
      const x = (R.W - w) / 2;
      const pw = w - u(48);
      const lines = [];
      if (!d) lines.push({ t: R.T('ui.detail.draw.t'), c: C.text3 });
      const desc = d ? R.I18n.unwrap(d.desc) : '';
      const stats = [];
      let sub = '';
      if (d && this.kind === 'item') {
        sub = d.slot === 'use' ? (d.use && d.use.field ? (d.use.battle === false ? R.T('ui.detail.draw.sub') : R.T('ui.detail.draw.sub_2')) : R.T('ui.detail.draw.sub_3')) : d.slot === 'key' ? R.T('ui.detail.draw.sub_4') : S.kindLine(d);
        const N = R.Rules.DIFF_NAMES || {};
        for (const k of RAW) if (d[k]) stats.push([N[k] || k, d[k]]);
        for (const k of Object.keys(d.stats || {})) if (d.stats[k]) stats.push([N[k] || k, (d.stats[k] > 0 ? '+' : '') + d.stats[k]]);
      } else if (d && (this.kind === 'tech' || this.kind === 'spell')) {
        sub = this.kind === 'tech' ? R.T('ui.detail.draw.sub_5', { wname: S.wname(d.wtype), p1: this.from ? R.T('ui.detail.draw.sub_6', { from: this.from }) : '' }) : R.T('ui.detail.draw.sub_7', { join: (d.elements || []).map(S.ename).join(R.T('ui.detail.draw.sub.join')) });
        stats.push(['MP', d.mp || 0], [R.T('ui.detail.draw.0'), S.rangeName(d) || '―']);
      } else if (d && this.kind === 'mon') sub = R.T('ui.detail.draw.sub_8');
      const dl = R.UIK.wrap(desc, pw, { size: u(15) });
      const h = u(24) + u(34) + (sub ? u(28) : 0) + (stats.length ? Math.ceil(stats.length / 2) * u(28) + u(14) : 0) + dl.length * u(26) + u(58);
      const y = (R.H - h) / 2;
      this.rect = { x, y, w, h };
      R.UIK.panel(g, this.rect, { dense: true, frost: true });
      let cy = y + u(22);
      const nw = R.UIK.text(g, d ? d.name : R.T('ui.detail.draw.text'), x + u(24), cy, { size: u(21), weight: 700, color: (d && S.gradeColor(d)) || C.goldHi, maxW: pw - u(40) });
      if (d && d.grade) R.UIK.stars(g, d.grade, x + u(32) + Math.min(nw, pw - u(40)), cy + u(4), u(15));
      if (d && this.kind === 'item') R.UIK.icon(g, S.iconOf(d), x + w - u(46), cy, u(22), C.text2);
      cy += u(34);
      if (sub) { R.UIK.text(g, sub, x + u(24), cy, { size: u(13), color: C.text2, maxW: pw }); cy += u(28); }
      if (stats.length) {
        R.UIK.rule(g, x + u(24), x + w - u(24), cy, 0.14); cy += u(10);
        stats.forEach(([k, v], i) => {
          const cx = x + u(24) + (i % 2) * (pw / 2), yy = cy + Math.floor(i / 2) * u(28);
          R.UIK.text(g, k, cx, yy + u(1), { size: u(13), color: C.text2 });
          R.UIK.text(g, String(v), cx + pw / 2 - u(24), yy - u(1), { size: u(16), weight: 700, color: k === 'MP' && v === 0 ? C.teal : C.text, align: 'right' });
        });
        cy += Math.ceil(stats.length / 2) * u(28) + u(4);
      }
      for (const l of dl) { R.UIK.text(g, l, x + u(24), cy, { size: u(15), color: C.text }); cy += u(26); }
      R.UIK.prompts(g, [{ btn: 'b', label: R.T('ui.detail.draw.0.label') }], { x: x + w - u(20), y: y + h - u(22), align: 'right' });
    },
  });
})(window.RPG);
