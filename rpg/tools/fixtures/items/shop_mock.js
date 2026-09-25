// Visual fixture: draws a shop-style list for one shop (or an id list) so item
// name widths / prices / descriptions can be eyeballed with tools/shot.js:
//   node tools/shot.js --out /tmp/x.png --eval "$(cat tools/fixtures/items/shop_mock.js)" --eval "RPG._mockShop('frost_weapon')"
(() => {
  const R = window.RPG;
  R._mockShop = (shopId, sel = 0) => {
    const ids = Array.isArray(shopId) ? shopId : R.DB.shops[shopId].items;
    const G = R.Gfx;
    R.Engine.clear();
    const L = new R.Layer();
    L.opaque = true;
    L.draw = () => {
      G.clear('#204060');
      const title = Array.isArray(shopId) ? 'リスト' : R.DB.shops[shopId].name;
      const rows = Math.min(ids.length, 12);
      G.window(64, 8, 184, rows * 14 + 16, { title });
      ids.slice(0, 12).forEach((id, i) => {
        const it = R.DB.items[id];
        const y = 16 + i * 14;
        if (i === sel) G.cursor(68, y + 1, false);
        G.text((it.rare ? '★' : '') + it.name, 78, y);
        G.text(it.price + 'G', 240, y, { align: 'right' });
      });
      G.window(4, 8, 58, 40);
      G.text('1200G', 56, 24, { align: 'right' });
      const it = R.DB.items[ids[sel]];
      G.window(4, 176 - 18, 248, 60);
      const lines = G.wrap(it.desc, 228);
      lines.forEach((l, i) => G.text(l, 14, 168 - 2 + i * 14));
      const st = it.atk ? `攻撃力+${it.atk}` : it.def ? `守備力+${it.def}` : '';
      if (st) G.text(st, 242, 166 + 2 * 14, { align: 'right', color: G.C.yellow });
    };
    R.Engine.push(L);
    let widest = 0, wid = '';
    for (const id in R.DB.items) { const w = G.textWidth(R.DB.items[id].name); if (w > widest) { widest = w; wid = id; } }
    let longDesc = 0, ld = '';
    for (const id in R.DB.items) { const n = G.wrap(R.DB.items[id].desc, 228).length; if (n > longDesc) { longDesc = n; ld = id; } }
    return { widest: [wid, Math.round(widest)], descLines: [ld, longDesc] };
  };
  return 'ok';
})()
