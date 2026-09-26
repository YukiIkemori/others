// Visual check for area A7 (techs), loaded by `node tools/build.js --with tools/fixtures/techs`
// into debug_techs.html. Draws, for one weapon type, what the battle screen shows of its
// techs — with the battle screen's own geometry (DESIGN §11.5.3; R.Battle.HELP / BOX):
//   * the help strip (240×19 window, desc drawn with fitText in 220px) for all the type's techs (up to 17),
//   * the tech list window (R.UI.List 240×68, 2 columns × 3 rows, lineH 16, padY 10,
//     「攻撃」 first, M + cost on the right; names squeezed to fit before the cost; drawn like battle_scene.js drawListItem) as its two pages,
//   * the same list from the middle row (reach:false techs and a non-reaching 攻撃 grey).
// A desc wider than 220px (it would be squeezed) gets a red bar at the strip's right end.
//
//   node tools/build.js --with tools/fixtures/techs && node tools/shot.js --html debug_techs.html --size 1100x2000 \
//     --eval "(RPG.techsSheet('sword'), 1)" --out /tmp/…/techs_sword.png      (RPG.techsWidths() = real-font widths)
(function (R) {
  'use strict';
  if (!R) return;

  function techsOf(w) {
    const A = R.DB.actions;
    return Object.keys(A).filter((id) => A[id] && A[id].kind === 'tech' && A[id].wtype === w).map((id) => Object.assign({ id }, A[id]));
  }

  /** logical height of one sheet */
  const SHEET_H = 44 + 17 * 19 + 10 + 3 * 80 + 6;   // up to 17 techs a type (sword, SYSTEMS_REWORK §3.4)

  function drawSheet(w, y0) {
    const G = R.Gfx, WT = R.DB.weaponTypes[w];
    const list = techsOf(w);
    const HELP_W = 240, HELP_H = 19, TEXT_W = 220;
    // header: icon, name, holding, reach, desc
    G.window(4, y0 + 2, 248, 38);
    const icon = G.has(WT.icon) ? G.get(WT.icon) : null;
    if (icon) G.draw(icon, 14, y0 + 10, { w: 8, h: 8 });
    else G.text('？', 12, y0 + 7, { color: G.C.red });
    G.text(`${WT.name}　${w}`, 26, y0 + 7, { color: G.C.yellow });
    const tags = [WT.twoHanded ? '両手持ち' : '片手持ち', { slash: '斬', blunt: '打', pierce: '突' }[WT.kind], WT.reach ? '後列から届く' : '前列から'];
    G.text(tags.join('・'), 244, y0 + 7, { align: 'right', color: G.C.cyan });
    G.text(WT.desc, 14, y0 + 22);
    // help strips, one per tech (battle: window(8, HELP.y, 240, 19), text at +10,+4, max 220)
    let y = y0 + 44;
    for (const t of list) {
      G.window(8, y, HELP_W, HELP_H + 2);
      const tw = G.textWidth(t.desc);
      if (tw > TEXT_W) G.rect(8 + HELP_W - 6, y + 4, 2, HELP_H - 6, G.C.red);
      G.fitText(t.desc, 18, y + 4, TEXT_W);
      // lv on the left margin (outside the battle's text area)
      G.text(String(t.glim.lv), 4, y + 5, { size: 7, color: t.glim.lv >= 9 ? G.C.gold : G.C.gray, align: 'center' });
      y += HELP_H;
    }
    y += 10;
    // the tech list, both pages, front row
    const items = (mid) => [{ label: '攻撃', disabled: mid && !WT.reach }].concat(list.map((t) => ({
      label: t.name, right: 'M' + t.mp, disabled: mid && !t.reach,
    })));
    // same item drawing as battle_scene.js drawListItem (not exported): cost right-aligned
    // 13px short of the column end, so the next column's cursor does not touch it
    const drawItem = (it, x, yy, w) => {
      const colW = w + 4, color = it.disabled ? G.C.gray : G.C.white;
      const right = it.right != null && it.right !== '' ? String(it.right) : null;
      if (right) {
        G.fitText(it.label, x, yy, colW - 16 - G.textWidth(right), { color });
        G.text(right, x + colW - 13, yy, { color, align: 'right' });
      } else G.fitText(it.label, x, yy, colW - 8, { color });
    };
    const page = (its, top, yy, title, cursor) => {
      const L = new R.UI.List({ x: 8, y: yy, w: 240, h: 68, cols: 2, rows: 3, lineH: 16, padY: 10, title, items: its, index: cursor, active: false, drawItem });
      L.top = top;
      L.draw({ showInactiveCursor: true });
    };
    page(items(false), 0, y, WT.name, 1); y += 80;
    page(items(false), 3, y, WT.name, 7); y += 80;
    // middle row: page with the most reach:false techs greyed, cursor on the first usable tech
    const mid = items(true);
    const firstOk = Math.max(0, mid.findIndex((it) => !it.disabled));
    page(mid, firstOk >= 6 ? 3 : 0, y, WT.name + '（後列）', firstOk);
    return list;
  }

  /** draw the sheet of one weapon type (or of several, stacked) onto #screen and pause the engine */
  R.techsSheet = function (wtypes) {
    const ws = [].concat(wtypes || Object.keys(R.DB.weaponTypes));
    const G = R.Gfx;
    if (R.Engine) R.Engine.paused = true;
    const cv = G.canvas;
    const H = SHEET_H * ws.length;
    cv.width = R.W * R.SCALE; cv.height = H * R.SCALE;
    // main.js fit() restyles #screen on every resize: pin the sheet's size with !important rules
    let st = document.getElementById('techs-sheet-style');
    if (!st) { st = document.createElement('style'); st.id = 'techs-sheet-style'; document.head.appendChild(st); }
    st.textContent = `#screen{width:${cv.width}px!important;height:${cv.height}px!important}` +
      'html,body{overflow:visible!important;height:auto!important}#game{height:auto!important;justify-content:flex-start!important}';
    G.reset();
    const c = G.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#20283c'); g.addColorStop(1, '#10141e');
    c.fillStyle = g; c.fillRect(0, 0, R.W, H);
    const report = {};
    ws.forEach((w, i) => {
      const list = drawSheet(w, i * SHEET_H);
      report[w] = list.map((t) => ({
        id: t.id,
        nameW: +G.textWidth(t.name).toFixed(1),
        squeeze: +Math.min(1, (109 - 16 - G.textWidth('M' + t.mp)) / G.textWidth(t.name)).toFixed(3),
        descW: +G.textWidth(t.desc).toFixed(1),
      }));
    });
    return report;
  };

  /** widths of every tech name/desc with the real font: names in the battle list column (109px − 16 − cost), descs in 220px */
  R.techsWidths = function () {
    const G = R.Gfx, out = { over: [], minSqueeze: 1, maxDesc: 0 };
    for (const id of Object.keys(R.DB.actions)) {
      const t = R.DB.actions[id];
      if (!t || t.kind !== 'tech') continue;
      const room = 109 - 16 - G.textWidth('M' + t.mp);
      const sq = Math.min(1, room / G.textWidth(t.name));
      const dw = G.textWidth(t.desc);
      out.minSqueeze = Math.min(out.minSqueeze, sq);
      out.maxDesc = Math.max(out.maxDesc, dw);
      if (dw > 220) out.over.push(id + ' desc ' + dw.toFixed(1));
      if (G.textWidth(t.name) * sq / [...t.name].length < 7) out.over.push(id + ' name < 7px/char');
    }
    out.minSqueeze = +out.minSqueeze.toFixed(3); out.maxDesc = +out.maxDesc.toFixed(1);
    return out;
  };
})(window.RPG);
