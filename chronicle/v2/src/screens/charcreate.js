// MENUS: 主人公の作成（V2_PLAN §3.8・§3.11、SCREEN_RESULTS.charcreate）
//   性別（2）× タイプ（warrior ranger mage spellblade wanderer）× 得意（5 系統か 6 属性、R.DB.heroTypes[type].favorOptions）× 名前（五十音、4〜5 字）
//   ↑↓ で行、←→ で値、A で次の行へ（名前の行は名前の入力を開く）。最後の「この主人公で旅立つ」で K.hero を返す。B は前の行、先頭の行では null。
//   表示: タイプの説明・得意の説明・能力値 6 つ（0〜25、棒）。文字の段（S〜D）は出さない（A14・A17）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const TYPES = ['warrior', 'ranger', 'mage', 'spellblade', 'wanderer'];
  const ABIL_NAMES = { str: R.T('ui.charcreate.ABIL_NAMES.str'), vit: R.T('ui.charcreate.ABIL_NAMES.vit'), dex: R.T('ui.charcreate.ABIL_NAMES.dex'), agi: R.T('ui.charcreate.ABIL_NAMES.agi'), int: R.T('ui.charcreate.ABIL_NAMES.int'), mnd: R.T('ui.charcreate.ABIL_NAMES.mnd') };

  /** 能力値 6 つの棒（0〜25）。→ 下端の y */
  S.abilBars = function (g, st, x, y, w, o) {
    o = o || {};
    const C = T().color, lh = u(o.lh || 26), cap = 25;
    const keys = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
    const cols = o.cols || 1, cw = (w - (cols - 1) * u(18)) / cols;
    keys.forEach((k, i) => {
      const cx = x + (i % cols) * (cw + u(18)), cy = y + Math.floor(i / cols) * lh;
      R.UIK.text(g, ABIL_NAMES[k], cx, cy, { size: u(13), color: C.text2 });
      const v = Math.round((st && st[k]) || 0);
      R.UIK.text(g, String(v), cx + u(84), cy - u(1), { size: u(15), weight: 700, color: C.text, align: 'right' });
      const bx = cx + u(94), bw = cw - u(94);
      R.UIK.gauge(g, { x: bx, y: cy + u(7), w: bw, h: u(3) }, v, cap, ['#b98f47', '#fff1c8']);
    });
    return y + Math.ceil(keys.length / cols) * lh;
  };

  function favList(type) {
    const ht = R.DB.heroTypes[type] || {};
    const o = ht.favorOptions || {};
    return (o.weapon || []).concat(o.element || []);
  }
  S.favName = (f) => ((R.Rules.WTYPES || []).includes(f) ? S.wname(f) : R.T('ui.charcreate.favName', { ename: S.ename(f) }));

  S.def('charcreate', {
    opaque: true, frost: false,
    init(p) {
      this.sex = (p && p.sex) || 'm';
      this.type = (p && p.type) || 'warrior';
      this.fav = favList(this.type)[0];
      this.name = (p && p.name) || this.defaultName();
      this.named = false;
      this.rows = [
        { key: 'sex', label: R.T('ui.charcreate.sex.label') }, { key: 'type', label: R.T('ui.charcreate.type.label') }, { key: 'fav', label: R.T('ui.charcreate.fav.label') }, { key: 'name', label: R.T('ui.charcreate.name.label') },
        { key: 'go', label: R.T('ui.charcreate.go.label') },
      ];
      this.list = new R.UIK.List({ rows: this.rows, rowH: 46, wrap: false });
      this.list.onSelect = (row, i) => this.pick(row, i);
      this.list.onCancel = () => { if (this.list.index > 0) this.list._move(this.list.index - 1, true); else this.close(null); };
      this.busy = false;
    },
    defaultName() {
      const kit = R.DB.starterKit || {};
      const names = (kit.heroNames && kit.heroNames[this.sex]) || [this.sex === 'f' ? R.T('ui.charcreate.defaultName.names.0') : R.T('ui.charcreate.defaultName.names.0_2')];
      return names[0];
    },
    values(key) {
      if (key === 'sex') return ['m', 'f'];
      if (key === 'type') return TYPES.filter((t) => R.DB.heroTypes[t]);
      if (key === 'fav') return favList(this.type);
      return null;
    },
    show(key, v) {
      if (key === 'sex') return v === 'f' ? R.T('ui.charcreate.show.ret') : R.T('ui.charcreate.show.ret_2');
      if (key === 'type') return (R.DB.heroTypes[v] || {}).name || v;
      if (key === 'fav') return S.favName(v);
      return v;
    },
    shift(key, d) {
      const vals = this.values(key);
      if (!vals || !vals.length) return;
      const i = Math.max(0, vals.indexOf(this[key]));
      this[key] = vals[(i + d + vals.length) % vals.length];
      if (key === 'type' && !favList(this.type).includes(this.fav)) this.fav = favList(this.type)[0];
      if (key === 'sex' && !this.named) this.name = this.defaultName();
      R.UIK.sfx('cursor');
    },
    async pick(row, i) {
      if (this.busy) return;
      if (row.key === 'name') {
        this.busy = true;
        try {
          const s = await S.open('nameentry', { value: this.name, max: 5, title: R.T('ui.charcreate.pick.s.nameentry.title') });
          if (s) { this.name = s; this.named = true; this.list._move(4, false); }
        } finally { this.busy = false; }
        return;
      }
      if (row.key === 'go') { this.close({ type: this.type, sex: this.sex, name: this.name, fav: this.fav }); return; }
      this.list._move(i + 1, false);
    },
    update() {
      if (this.busy) return;
      const I = R.Input, row = this.rows[this.list.index];
      if (row && this.values(row.key)) {
        if (I.repeat('left')) { this.shift(row.key, -1); return; }
        if (I.repeat('right')) { this.shift(row.key, 1); return; }
        // 矢印の札をポインタで
        if (this.arrows) for (const a of this.arrows) if (S.clicked(a.r)) { this.list.focusIndex(a.i); this.shift(this.rows[a.i].key, a.d); return; }
      }
      this.list.update();
    },
    draw(g) {
      S.backdrop(g, { plainBg: true });
      const b = S.box(), C = T().color, tall = S.tall();
      const look = `hero_${this.sex}_${this.type}`;
      const ht = R.DB.heroTypes[this.type] || {};
      // 左（縦持ちは下）: 行
      const lw = tall ? b.w : Math.min(u(420), b.w * 0.44);
      const lh = u(58) + this.rows.length * this.list.rowPx() + u(20);
      const lp = tall ? { x: b.x, y: b.y + b.h - lh, w: lw, h: lh } : { x: b.x + u(8), y: b.y + u(8), w: lw, h: lh };
      R.UIK.panel(g, lp, {});
      S.heading(g, R.T('ui.charcreate.draw.heading'), lp.x + u(22), lp.y + u(18), 0, { size: 15, track: 4 });
      const lr = { x: lp.x + u(10), y: lp.y + u(52), w: lp.w - u(20), h: this.rows.length * this.list.rowPx() };
      this.arrows = [];
      this.list.render = (gg, row, rect, f) => {
        const sz = u(17), cy = rect.y + (rect.h - sz) / 2 - u(1);
        const i = this.rows.indexOf(row);
        if (row.key === 'go') {
          R.UIK.text(gg, row.label, rect.x + rect.w / 2, cy, { size: sz, weight: 700, color: f ? C.goldHi : C.gold, align: 'center' });
          return;
        }
        R.UIK.text(gg, row.label, rect.x + u(20), cy + u(1), { size: u(14), color: C.text2 });
        const vx = rect.x + rect.w * 0.62;
        const val = row.key === 'name' ? this.name : this.show(row.key, this[row.key]);
        R.UIK.text(gg, val, vx, cy, { size: sz, weight: 700, color: f ? C.goldHi : C.text, align: 'center', maxW: rect.w * 0.5 });
        if (this.values(row.key)) {
          const aw = u(22), ay = rect.y + rect.h / 2;
          const l = { x: vx - rect.w * 0.26 - aw / 2, y: rect.y, w: aw, h: rect.h }, r = { x: vx + rect.w * 0.26 - aw / 2, y: rect.y, w: aw, h: rect.h };
          for (const [rr, d] of [[l, -1], [r, 1]]) {
            gg.save(); gg.fillStyle = f ? C.gold : C.text3; gg.beginPath();
            const cx = rr.x + aw / 2, s = u(5);
            if (d < 0) { gg.moveTo(cx - s, ay); gg.lineTo(cx + s * 0.7, ay - s); gg.lineTo(cx + s * 0.7, ay + s); } else { gg.moveTo(cx + s, ay); gg.lineTo(cx - s * 0.7, ay - s); gg.lineTo(cx - s * 0.7, ay + s); }
            gg.closePath(); gg.fill(); gg.restore();
            this.arrows.push({ r: rr, i, d });
          }
        } else if (row.key === 'name') R.UIK.icon(gg, 'chat', rect.x + rect.w - u(34), rect.y + (rect.h - u(16)) / 2, u(16), f ? C.gold : C.text3);
      };
      this.list.draw(g, lr);
      // 右（縦持ちは上）: 姿と説明
      const rp = tall ? { x: b.x, y: b.y, w: b.w, h: lp.y - b.y - u(14) } : { x: lp.x + lp.w + u(22), y: b.y + u(8), w: b.x + b.w - (lp.x + lp.w + u(22)), h: b.h - u(8) };
      R.UIK.panel(g, rp, {});
      const fs = Math.min(u(tall ? 150 : 180), rp.h * 0.36);
      const fr = { x: rp.x + u(24), y: rp.y + u(24), w: fs, h: fs };
      R.UIK.portraitFrame(g, fr, look, {});
      let ty = rp.y + u(28);
      const tx = fr.x + fs + u(22), tw = rp.x + rp.w - u(24) - tx;
      R.UIK.text(g, this.name, tx, ty, { size: u(26), weight: 700, color: C.goldHi, maxW: tw });
      ty += u(40);
      R.UIK.text(g, R.T('ui.charcreate.draw.text', { p0: ht.name || '', p1: this.sex === 'f' ? R.T('ui.charcreate.draw.text_2') : R.T('ui.charcreate.draw.text_3') }), tx, ty, { size: u(15), color: C.text2 });
      ty += u(30);
      R.UIK.chip(g, tx, ty, R.T('ui.charcreate.draw.chip', { favName: S.favName(this.fav) }), { kind: 'gold', size: 12.5 });
      ty = fr.y + fs + u(22);
      const dw = rp.w - u(48);
      for (const l of R.UIK.wrap(ht.desc || '', dw, { size: u(15) })) { R.UIK.text(g, l, rp.x + u(24), ty, { size: u(15), color: C.text }); ty += u(26); }
      const fd = ((R.DB.starterKit || {}).favorDesc || {})[this.fav];
      if (fd) { ty += u(6); R.UIK.text(g, R.T('ui.charcreate.draw.text_4', { favName: S.favName(this.fav), fd }), rp.x + u(24), ty, { size: u(13.5), color: C.teal, maxW: dw }); ty += u(28); }
      ty += u(10);
      R.UIK.rule(g, rp.x + u(24), rp.x + rp.w - u(24), ty, 0.14);
      ty += u(14);
      S.label(g, R.T('ui.charcreate.draw.label'), rp.x + u(24), ty);
      ty += u(28);
      S.abilBars(g, ht.stats || {}, rp.x + u(24), ty, rp.w - u(48), { cols: tall ? 2 : 2 });
      S.prompts(g, [{ btn: 'a', label: R.T('ui.charcreate.draw.0.label') }, { btn: 'left', label: R.T('ui.charcreate.draw.1.label') }, { btn: 'b', label: R.T('ui.charcreate.draw.2.label') }]);
    },
  });
})(window.RPG);
