// Field menu: 技の書・術の書 (DESIGN §11.7.8) — the whole party's record, not per member.
// 技の書: ←→ (and L/R) switch the weapon type, the 11 techs of that type in rank order (2 columns × 6
// rows). 術の書: tabs 火 水 風 土 光 闇 合成（3 pages of 12） 三属（2 pages）. Techs and spells nobody has
// glimmered yet show 「？？？」 with only their type and rank. The detail window below shows the cost,
// target, reach, description and who knows it (recruited members).
//   R.Menu.skillBookScreen({kind:'tech'|'spell'})   R.Menu.bookEntries(kind) → [{tab, ids}]
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  const lastTab = { tech: 0, spell: 0 };
  const lastIndex = { tech: 0, spell: 0 };

  const ids = (kind) => {
    const all = Object.keys(DB.actions).filter((id) => DB.actions[id].kind === kind);
    if (kind === 'spell') return all.sort((a, b) => (DB.actions[a].order || 999) - (DB.actions[b].order || 999));
    return all;
  };
  /** the pages (tabs) of a book: techs by weapon type; spells by element, then 合成 ×3 and 三属 ×2 (12 per page) */
  function bookEntries(kind) {
    const Kt = K();
    const list = ids(kind);
    if (kind === 'tech') {
      return Kt.wtypes().map((w) => ({
        tab: Kt.wtypeName(w), key: w,
        ids: list.filter((id) => DB.actions[id].wtype === w).sort((a, b) => (DB.actions[a].rank || 0) - (DB.actions[b].rank || 0) || Kt.techOrder(a) - Kt.techOrder(b)),
      }));
    }
    const pages = [];
    for (const e of Kt.elems()) {
      pages.push({ tab: Kt.elemName(e), key: e, ids: list.filter((id) => (DB.actions[id].elements || []).length === 1 && DB.actions[id].elements[0] === e) });
    }
    const pair = list.filter((id) => (DB.actions[id].elements || []).length === 2);
    const triple = list.filter((id) => (DB.actions[id].elements || []).length >= 3);
    const chunk = (arr, name, key) => {
      const n = Math.max(1, Math.ceil(arr.length / 12));
      for (let i = 0; i < n; i++) pages.push({ tab: name + (n > 1 ? ' ' + (i + 1) + '/' + n : ''), key, ids: arr.slice(i * 12, i * 12 + 12) });
    };
    chunk(pair, '合成', 'pair');
    chunk(triple, '三属', 'triple');
    return pages;
  }
  Menu.bookEntries = bookEntries;
  const bookOf = (kind) => (R.Game && R.Game.book && (kind === 'tech' ? R.Game.book.tech : R.Game.book.spell)) || {};
  /** discovered = at least one person has learned it (the book count) */
  const found = (kind, id) => ((bookOf(kind)[id] || []).length > 0);
  Menu.bookFound = found;
  /** who knows it, among the recruited members */
  const knowers = (kind, id) => (bookOf(kind)[id] || []).map((cid) => K().charById(cid)).filter(Boolean);

  let C = null;
  const cls = () => C || (C = build());
  Menu.skillBookScreen = (o) => R.Engine.run(new (cls().BookOfArts)((o && o.kind) || 'tech'));

  function build() {
    const Kt = K();
    class BookOfArts extends Kt.Screen {
      constructor(kind) {
        super();
        this.kind = kind;
        this.pages = bookEntries(kind);
        this.tab = Math.min(lastTab[kind] || 0, this.pages.length - 1);
        this.focus = -1; // L/R: highlight what one member knows (-1 = everyone)
        this.all = ids(kind);
        this.nFound = this.all.filter((id) => found(kind, id)).length;
        this.list = new R.UI.List({
          x: 4, y: 30, w: 248, h: 100, cols: 2, rows: 6, lineH: 14, padX: 16, padY: 8, colW: 116, items: [], wrap: true,
          drawItem: (row, x, y, w) => this.drawRow(row, x, y),
        });
        this.setTab(this.tab, lastIndex[kind] || 0);
      }
      setTab(t, index) {
        this.tab = t;
        lastTab[this.kind] = t;
        const pg = this.pages[t] || { ids: [] };
        this.list.setItems(pg.ids.map((id) => ({ id })), false);
        if (index) { this.list.index = Math.min(index, Math.max(0, pg.ids.length - 1)); this.list.scrollTo(); }
      }
      input() {
        const lr = Kt.memberStep();
        if (lr) {
          const n = R.Game.party.length;
          this.focus = this.focus < 0 ? (lr > 0 ? 0 : n - 1) : this.focus + lr;
          if (this.focus >= n || this.focus < -1) this.focus = -1;
          R.sfx('cursor');
          return;
        }
        const d = In().dirRepeat();
        // ←→ on the left / right column edge turns the page (tab)
        if ((d === 'left' && this.list.index % 2 === 0) || (d === 'right' && (this.list.index % 2 === 1 || this.list.index === this.list.items.length - 1))) {
          const n = this.pages.length;
          const row = Math.floor(this.list.index / 2);
          this.setTab((this.tab + (d === 'left' ? n - 1 : 1)) % n);
          const want = row * 2 + (d === 'left' ? 1 : 0);
          this.list.index = Math.min(want, Math.max(0, this.list.items.length - 1));
          this.list.scrollTo();
          R.sfx('page');
          return;
        }
        const r = this.list.update();
        lastIndex[this.kind] = this.list.index;
        if (r === 'cancel') this.close();
      }
      drawRow(row, x, y) {
        const a = DB.actions[row.id];
        const f = found(this.kind, row.id);
        const who = this.focus >= 0 ? R.Game.party[this.focus] : null;
        const mine = who && ((this.kind === 'tech' ? who.techs : who.spells) || []).includes(row.id);
        const dim = who && f && !mine;
        let nx = x;
        if (this.kind === 'spell') { Kt.drawElemIcons(a.elements || [], x, y + 2); nx = x + 28; }
        const name = f ? a.name : '？？？';
        const maxW = this.kind === 'spell' ? 62 : 84;
        const w = Kt.fitText(name, nx, y, maxW, { color: !f ? Kt.COL.gray : dim ? Kt.COL.off : '#ffffff' });
        if (this.kind === 'tech') {
          const lv = (a.glim && a.glim.lv) || a.rank || 1;
          if (lv >= 9) G().text(lv >= 10 ? '極' : '奥', nx + Math.min(maxW, w) + 3, y, { color: G().C.gold });
        } else {
          const els = a.elements || [];
          const step = els.length === 1 ? (a.step || a.rank || 1) + '段' : els.length === 2 ? '合' : '三';
          G().text(step, x + 104, y, { align: 'right', color: Kt.COL.sub });
        }
        if (mine) Kt.check(x + (this.kind === 'tech' ? 96 : 80), y + 1, G().C.green);
      }
      render() {
        const pg = this.pages[this.tab];
        const title = this.kind === 'tech' ? '技の書' : '術の書';
        G().window(4, 4, 248, 24);
        G().text(title, 14, 10, { color: G().C.yellow });
        G().text(this.nFound + '/' + this.all.length, 60, 10);
        const who = this.focus >= 0 ? R.Game.party[this.focus] : null;
        Kt.fitText(who ? who.name + 'の分' : '全員', 104, 10, 58, { color: who ? G().C.green : Kt.COL.sub });
        G().text('◀', 168, 11, { color: Kt.COL.gray, size: 8 });
        Kt.fitText(pg ? pg.tab : '', 207, 10, 56, { align: 'center', color: G().C.cyan });
        G().text('▶', 238, 11, { color: Kt.COL.gray, size: 8 });
        this.list.draw();
        if (!this.list.items.length) G().text('ここに記す技・術はまだない。', 20, 38, { color: Kt.COL.gray });
        this.drawDetail();
      }
      drawDetail() {
        const x = 4, y = 132;
        G().window(x, y, 248, 88);
        const row = this.list.item;
        if (!row) return;
        const id = row.id, a = DB.actions[id];
        const f = found(this.kind, id);
        const tech = this.kind === 'tech';
        const lv = (a.glim && a.glim.lv) || a.rank || 1;
        const kindText = tech
          ? Kt.wtypeName(a.wtype) + 'の技　格' + lv + (lv === 9 ? '（奥義）' : lv >= 10 ? '（極意）' : '')
          : null;
        const elemSegs = () => {
          const els = a.elements || [];
          const segs = [{ text: '属性：', color: Kt.COL.sub }];
          els.forEach((e, i) => { if (i) segs.push({ text: '＋', color: Kt.COL.sub }); segs.push({ text: Kt.elemName(e), color: Kt.elemColor(e) }); });
          const step = els.length === 1 ? '　' + (a.step || a.rank || 1) + '段' : els.length === 2 ? '　合成術' : '　三属性の術';
          segs.push({ text: step, color: Kt.COL.sub });
          return segs;
        };
        if (!f) {
          G().text('？？？', x + 10, y + 6, { color: Kt.COL.gray });
          if (tech) G().text(kindText, x + 10, y + 20, { color: Kt.COL.sub });
          else Kt.drawSegs(elemSegs(), x + 10, y + 20, 228);
          G().text('まだ誰も閃いていない。', x + 10, y + 62, { color: Kt.COL.gray });
          return;
        }
        Kt.fitText(a.name, x + 10, y + 6, 160, { color: tech && lv >= 9 ? G().C.gold : '#ffffff' });
        G().text((tech ? 'W ' + (a.wp || 0) : 'M ' + (a.mp || 0)), x + 238, y + 6, { align: 'right' });
        const tgt = (Menu.TARGET_NAMES && Menu.TARGET_NAMES[a.target]) || '―';
        const reach = !tech || !!a.reach;
        if (tech) {
          Kt.fitText('対象：' + tgt + '　中列から：' + (reach ? '届く' : '届かない'), x + 10, y + 20, 228);
          Kt.fitText(String(a.desc || '').split('\n')[0], x + 10, y + 34, 228);
          G().text(kindText, x + 10, y + 48, { color: Kt.COL.sub });
        } else {
          Kt.drawSegs(elemSegs(), x + 10, y + 20, 110);
          Kt.fitText('対象：' + tgt, x + 238, y + 20, 110, { align: 'right' });
          Kt.fitText(String(a.desc || '').split('\n')[0], x + 10, y + 34, 228);
          G().text(a.field ? '移動中にも使える。' : '中列からも届く。', x + 10, y + 48, { color: Kt.COL.sub });
        }
        const who = knowers(this.kind, id);
        Kt.fitText(who.length ? '覚えている：' + who.map((c) => c.name).join('　') : 'まだ誰も覚えていない。', x + 10, y + 62, 228,
          { color: who.length ? '#ffffff' : Kt.COL.gray });
      }
    }
    return { BookOfArts };
  }
})(window.RPG);
