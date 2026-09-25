// gear-b（A10b）の目で見る確認用（debug_gear-b.html だけに入る。node tools/build.js --with tools/fixtures/gear-b）。
//   debug_gear-b.html?gearb=list&p=0   道具の一覧（2 列。アイコン・名前・レアの色）p=0,1 が道具、p=2 が大事なもの
//   debug_gear-b.html?gearb=desc&p=0   説明文の窓（道具の画面の説明の窓と同じ幅 248。1 ページ 4 品。長い順）
//   debug_gear-b.html?gearb=shop&id=lute_item&t=3   店の品ぞろえ（参照の実装。ティア t、&pg=1 でクリア後）
//   R.GearBSheet.measure() … 名前と説明の行の幅（ピクセル）の最大
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
  const ids = () => Object.keys(R.DB.items).filter((id) => /^i_/.test(id)).sort((a, b) => R.DB.items[a].sort - R.DB.items[b].sort);
  const keyIds = () => Object.keys(R.DB.items).filter((id) => /^k_/.test(id)).sort((a, b) => R.DB.items[a].sort - R.DB.items[b].sort);
  const color = (it) => (it.grade === 'super' ? G().C.super : it.grade === 'rare' ? G().C.rare : G().C.white);
  const label = (it) => (it.grade === 'rare' || it.grade === 'super' ? '★' : '') + it.name;
  const ICON_DEFAULT = (it) => {
    if (it.type === 'key') return 'key';
    const e = (it.use && it.use.effects) || [];
    if (it.stone) return 'el_' + it.stone;
    return e.some((x) => x.type === 'heal' || x.type === 'revive' || x.type === 'grow') ? 'herb' : 'potion';
  };
  function icon(it, x, y) {
    let k = it.icon ? String(it.icon).replace(/^icon:/, '') : ICON_DEFAULT(it);
    if (!G().has('icon:' + k)) k = it.stone ? 'potion' : 'acc';   // §11.3.6: 無ければ acc（魔石は仮に水差し）
    if (G().has('icon:' + k)) G().draw(G().get('icon:' + k), x, y);
  }
  function shopItems(shop, st) {
    const ok = (c) => !c || ((c.postgame === undefined || !!c.postgame === !!st.postgame) && (c.cleared === undefined || st.cleared.includes(c.cleared)));
    const steps = (shop.stock || []).filter((s) => s.tier <= st.tier && ok(s.cond));
    return [...(shop.items || []), ...(shop.keepOld ? steps.flatMap((s) => s.items) : (steps.length ? steps[steps.length - 1].items : []))];
  }

  class Sheet extends R.Layer {
    constructor(mode, page) { super(); this.opaque = true; this.mode = mode; this.page = page; }
    draw() {
      G().clear('#000');
      if (this.mode === 'list') this.drawList();
      else if (this.mode === 'desc') this.drawDesc();
      else if (this.mode === 'shop') this.drawShop();
    }
    drawList() {
      const list = this.page < 2 ? ids().slice(this.page * 30, this.page * 30 + 30) : keyIds();
      const title = this.page < 2 ? `道具　${this.page * 30 + 1}〜${this.page * 30 + list.length}／${ids().length}` : `大事なもの　${list.length}`;
      G().window(4, 4, 248, 22);
      G().text(title, 12, 9);
      G().window(4, 28, 248, 192);
      list.forEach((id, i) => {
        const it = R.DB.items[id], col = i < 15 ? 0 : 1, row = i % 15;
        const x = 12 + col * 120, y = 35 + row * 12;
        icon(it, x, y + 2);
        G().fitText(label(it), x + 11, y, 104, { color: color(it) });
      });
    }
    drawDesc() {
      const all = [...ids(), ...keyIds()].map((id) => {
        const it = R.DB.items[id];
        const w = Math.max(...String(it.desc).split('\n').map((l) => G().textWidth(l)));
        return { id, it, w };
      }).sort((a, b) => b.w - a.w);
      const list = all.slice(this.page * 4, this.page * 4 + 4);
      list.forEach(({ id, it, w }, i) => {
        const y = 2 + i * 55;
        G().window(4, y, 248, 53);
        icon(it, 12, y + 8);
        G().text(label(it), 23, y + 6, { color: color(it) });
        G().text(it.price ? it.price + 'G' : '売れない', 244, y + 6, { align: 'right', color: '#a8b0c8' });
        String(it.desc).split('\n').forEach((l, k) => G().text(l, 12, y + 20 + k * 13));
        G().text(Math.round(w) + 'px', 244, y + 33, { align: 'right', color: '#606880', size: 8 });
      });
    }
    drawShop() {
      const shop = R.DB.shops[q.get('id') || 'lute_item'];
      const st = { tier: +(q.get('t') || 0), postgame: q.get('pg') === '1', cleared: q.get('mine') === '1' ? ['r_mine'] : [] };
      const l = shopItems(shop, st), start = +(q.get('from') || 0);
      G().window(4, 4, 166, 216);
      G().window(172, 4, 80, 24);
      G().text('9999G', 246, 10, { align: 'right' });
      G().window(172, 30, 80, 40);
      G().fitText(shop.name, 178, 36, 70);
      G().text(`T${st.tier}${st.postgame ? '＋' : ''}　${l.length}品`, 178, 50, { color: '#a8b0c8' });
      l.slice(start, start + 15).forEach((id, i) => {
        const it = R.DB.items[id] || { name: '？？？' + id, price: 0 };
        const y = 10 + i * 13.6;
        if (it.type) icon(it, 12, y + 2);
        G().fitText(label(it), 23, y, 104, { color: color(it) });
        G().text(String(it.price), 164, y, { align: 'right' });
      });
    }
  }

  R.GearBSheet = {
    measure() {
      const out = { name: [0, ''], desc: [0, ''], over: [] };
      for (const id of [...ids(), ...keyIds()]) {
        const it = R.DB.items[id];
        const nw = G().textWidth(label(it));
        if (nw > out.name[0]) out.name = [Math.round(nw * 10) / 10, id];
        for (const l of String(it.desc).split('\n')) {
          const w = G().textWidth(l);
          if (w > out.desc[0]) out.desc = [Math.round(w * 10) / 10, id + ' ' + l];
          if (w > 228) out.over.push(id);
        }
      }
      return out;
    },
    show(mode, page) { R.Engine.layers.length = 0; R.Engine.push(new Sheet(mode, page)); },
  };
  const mode = q.get('gearb');
  if (mode) R.on('booted', () => setTimeout(() => R.GearBSheet.show(mode, +(q.get('p') || 0)), 50));
})(window.RPG);
