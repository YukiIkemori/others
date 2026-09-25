// Visual check for area A9 (weapons), loaded by `node tools/build.js --with tools/fixtures/weapons` into debug_weapons.html.
//
//   RPG.weaponsSheet(group, page)  draws one page of weapon cards (2 columns × 8) onto #screen and pauses the engine.
//                                  group: 'normal' | 'rare' | 'super' | 'mrare' | 'msuper' | 'fixed' | 'all' | [ids]
//     A card is what the menus show of a weapon: the icon and ★ name in its rarity colour (R.Menu.kit when loaded),
//     the grade / tier / holding tag, 攻 / 術 and the stat changes (fillItem's numbers), the special effects in the
//     §11.7.18 wording, and the desc's 2 lines with fitText in the detail popup's 224px (§11.7.18 rows 10–11).
//     Red bars: a desc line wider than 224px (the popup would squeeze it) — or, thinner, wider than the equip header's
//     210px (§11.7.5; squeezed by fitText there); a name wider than the 100px candidate column (§11.7.5).
//   RPG.weaponsWidths()            real-font widths of every name / desc line against those columns (numbers for the report)
//
//   node tools/build.js --with tools/fixtures/weapons && node tools/shot.js --html debug_weapons.html --size 2100x1800 \
//     --eval "(RPG.weaponsSheet('msuper', 0), 1)" --out /tmp/…/weapons_msuper_0.png
(function (R) {
  'use strict';
  if (!R) return;
  const COLS = 2, ROWS = 8, CARD_W = 252, CARD_H = 74, GAP = 4, TOP = 16;
  const STAT = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const GRADE = { normal: '通常', rare: 'レア★', super: '超レア★' };

  const idsOf = (group) => {
    const WI = R.WeaponItems;
    if (Array.isArray(group)) return group;
    return group === 'all' || !group ? WI.all() : WI.ids[group] || [];
  };
  const kit = () => (R.Menu && R.Menu.kit) || null;
  function label(id) { const k = kit(); const it = R.DB.items[id]; return k && k.itemLabel ? k.itemLabel(id) : ((it.grade === 'normal' ? '' : '★') + it.name); }
  function color(id) {
    const k = kit(); if (k && k.itemColor) return k.itemColor(id);
    const g = R.DB.items[id].grade; return g === 'super' ? '#ff88d0' : g === 'rare' ? '#f8d838' : '#ffffff';
  }
  function drawIcon(it, x, y) {
    const G = R.Gfx, k = kit();
    if (k && k.drawIcon) return k.drawIcon(it, x, y);
    const key = 'icon:' + it.wtype;
    if (G.has(key)) G.draw(G.get(key), x, y); else G.rect(x + 1, y + 1, 6, 6, '#9aa0c0');
  }
  /** the special-effect rows 4–7 of the item popup (R.Menu.detailLines, §11.7.18) as [{text, color}] segments */
  function effectSegs(id) {
    if (!(R.Menu && typeof R.Menu.detailLines === 'function')) return null;
    try {
      const out = [];
      for (const l of R.Menu.detailLines(id, {}).slice(4, 8)) {
        const segs = l.segs || (l.text ? [{ text: l.text, color: l.color }] : []);
        for (const sg of segs) if (sg.text && sg.text.trim()) out.push({ text: sg.text.trim(), color: sg.color || '#ffffff' });
      }
      return out;
    } catch (e) { return [{ text: '（detailLines: ' + e.message + '）', color: '#ff6060' }]; }
  }

  function card(id, x, y) {
    const G = R.Gfx, it = R.DB.items[id];
    G.window(x, y, CARD_W, CARD_H);
    const ix = x + 8, iy = y + 7;
    drawIcon(it, ix, iy + 1);
    G.fitText(label(id), ix + 11, iy, 118, { color: color(id) });
    const nameW = G.textWidth(label(id));
    if (nameW > 100) G.rect(ix + 11 + 118 + 1, iy + 1, 1, 8, '#ff9040');   // wider than the 100px candidate column
    const wt = (R.DB.weaponTypes[it.wtype] || {}).name || it.wtype;
    G.text(`${GRADE[it.grade]} T${it.tier}　${wt}${it.twoHanded ? '・両手' : ''}`, x + CARD_W - 8, iy, { align: 'right', color: '#a8b0d0' });
    // numbers: 攻 / 術 and the stats (statsAdd included)
    // stat changes: up in green, down in red (Part A6 の読み替え「上がる物は緑、下がる物は赤」)
    const num = (label, v) => ({ text: `${label}${v > 0 ? '+' : ''}${v}`, color: v > 0 ? '#98e898' : '#ff6a5a' });
    const nums = Object.entries(it.stats || {}).filter(([, v]) => v).map(([k, v]) => num(STAT[k], v));
    if (it.hit) nums.push(num('命中', it.hit));
    if (it.crit) nums.push(num('会心', it.crit));
    G.text(`攻${it.atk} 術${it.mag}`, ix, iy + 12, { color: '#c8c8d8' });
    {
      const room = 120, full = nums.reduce((a, sg, i) => a + G.textWidth(sg.text) + (i ? 4 : 0), 0), k = Math.min(1, room / Math.max(1, full));
      let xx = ix + 58;
      for (const sg of nums) { const w = G.textWidth(sg.text) * k; G.fitText(sg.text, xx, iy + 12, w, { color: sg.color }); xx += w + 4 * k; }
    }
    G.text(`${it.price}G`, x + CARD_W - 8, iy + 12, { align: 'right', color: '#808090' });
    const segs = effectSegs(id);
    if (segs && segs.length) {
      let xx = ix;
      const room = 228, full = segs.reduce((a, sg, i) => a + G.textWidth(sg.text) + (i ? 8 : 0), 0), k = Math.min(1, room / full);
      segs.forEach((sg, i) => { const w = G.textWidth(sg.text) * k; G.fitText(sg.text, xx, iy + 24, w, { color: sg.color }); xx += w + 8 * k; });
    } else if (segs) G.text(it.grade === 'normal' ? '―' : '―（命中・会心は数値の行に出る）', ix, iy + 24, { color: '#606070' });
    // the desc: 2 lines, 224px (popup rows 10–11)
    const lines = String(it.desc || '').split('\n');
    lines.forEach((l, i) => {
      const yy = iy + 37 + i * 12, w = G.textWidth(l);
      G.fitText(l, ix, yy, 224);
      if (w > 224) G.rect(ix + 226, yy, 2, 9, G.C.red);
      else if (w > 210) G.rect(ix + 227, yy + 2, 1, 5, '#ff6060');
    });
    if (lines.length > 2) G.rect(x + 2, y + 2, 3, CARD_H - 4, G.C.red);
  }

  /** draw one page (16 cards) of a group; returns {ids, pages} */
  R.weaponsSheet = function (group, page) {
    const G = R.Gfx, ids = idsOf(group), per = COLS * ROWS, pages = Math.ceil(ids.length / per);
    page = Math.max(0, Math.min(pages - 1, page | 0));
    const list = ids.slice(page * per, page * per + per);
    if (R.Engine) R.Engine.paused = true;
    const LW = COLS * (CARD_W + GAP) + GAP, LH = TOP + ROWS * (CARD_H + GAP) + GAP;
    const cv = G.canvas;
    cv.width = LW * R.SCALE; cv.height = LH * R.SCALE;
    let st = document.getElementById('weapons-sheet-style');
    if (!st) { st = document.createElement('style'); st.id = 'weapons-sheet-style'; document.head.appendChild(st); }
    st.textContent = `#screen{width:${cv.width}px!important;height:${cv.height}px!important}` +
      'html,body{overflow:visible!important;height:auto!important}#game{height:auto!important;justify-content:flex-start!important}';
    G.reset();
    const c = G.ctx, g = c.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#20283c'); g.addColorStop(1, '#10141e');
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    G.text(`武器 ${Array.isArray(group) ? '選んだ品' : group}　${page + 1}/${pages}　（${ids.length} 品）`, GAP + 4, 4, { color: G.C.yellow });
    list.forEach((id, i) => card(id, GAP + (i % COLS) * (CARD_W + GAP), TOP + Math.floor(i / COLS) * (CARD_H + GAP)));
    return { ids: list, pages };
  };

  /** real-font widths: desc lines vs 224 (popup) / 210 (equip header) / 220 (shop), names vs 100 / 80 / 150 */
  R.weaponsWidths = function () {
    const G = R.Gfx, out = { n: 0, maxDesc: 0, maxName: 0, over224: [], over210: [], over220: [], name100: [], name80: 0, minPxPerChar80: 99 };
    for (const id of R.WeaponItems.all()) {
      const it = R.DB.items[id];
      out.n++;
      for (const l of String(it.desc).split('\n')) {
        const w = G.textWidth(l);
        out.maxDesc = Math.max(out.maxDesc, w);
        if (w > 224) out.over224.push(id + ' ' + w.toFixed(1));
        if (w > 220) out.over220.push(id);
        if (w > 210) out.over210.push(id);
      }
      const nl = label(id), nw = G.textWidth(nl);
      out.maxName = Math.max(out.maxName, nw);
      if (nw > 100) out.name100.push(id + ' ' + nw.toFixed(1));
      if (nw > 80) { out.name80++; out.minPxPerChar80 = Math.min(out.minPxPerChar80, 80 / [...nl].length); }
    }
    out.maxDesc = +out.maxDesc.toFixed(1); out.maxName = +out.maxName.toFixed(1); out.minPxPerChar80 = +out.minPxPerChar80.toFixed(2);
    out.over210 = out.over210.length; out.over220 = out.over220.length;
    return out;
  };
})(window.RPG);
