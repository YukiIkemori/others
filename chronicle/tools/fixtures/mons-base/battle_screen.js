// Shared battle-screen mock for the monster base contact sheets (area A14b mons-base):
// tools/sheet_monsters_a.js / sheet_monsters_b.js / sheet_monsters_c.js (context mode) and the
// in-engine gallery (gallery.js, `node tools/build.js --with tools/fixtures/mons-base`).
//
// Draws one 256×224 battle screen the way src/systems/battle_scene.js does (DESIGN §11.5.1,
// §11.5.2, §11.11.3, §11.4.2), with the real R.Gfx.window / text / fitText / cursor so the
// windows, the ink theme and the font match the game:
//   backdrop bbg:<bg> (0,0,256,144); monsters centred on GROUND = 130 (total ≤ 244, gap ≤ 8,
//   tall ones sink by clamp(round((h − 64) / 2.4), 0, 20); two rows when wider than 256 with 4+);
//   4 party windows 61×46 at x 3/66/129/192, y 5 (name tag on the top border, H/M/W right-aligned,
//   row tag 前/中 on the bottom border); the command list 戦う リピート / オート 逃げる (x 8, w 128)
//   and the enemy-name window (138,150,110,68) with the group counts.
//
//   RPG.MonsBaseScreen.draw(ctx, scale, offsetY, { bg, mons: [{ img, name, gold, fly }], frame })
(function (R) {
  'use strict';
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 };
  const BOX = { x: 8, y: 150, w: 240, h: 68 };
  const ENEMY = { x: 138, y: 150, w: 110, h: 68 };
  const CMD = { x: 8, y: 150, w: 128, h: 68, padX: 16, padY: 10, lineH: 16, cols: 2 };
  const GROUND = 130;
  const PARTY = [
    { name: 'アルン', hp: 212, mhp: 240, mp: 18, wp: 24, row: 'front' },
    { name: 'ブリギッタ', hp: 187, mhp: 200, mp: 6, wp: 31, row: 'front' },
    { name: 'マルタ', hp: 41, mhp: 180, mp: 45, wp: 9, row: 'middle' },
    { name: 'シルヴァン', hp: 160, mhp: 170, mp: 12, wp: 18, row: 'middle' },
  ];
  const COMMANDS = ['戦う', 'リピート', 'オート', '逃げる'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  /** feet of a sprite of height h: tall ones sink (§11.4.2) */
  const feet = (h, back) => GROUND - (back ? 12 : 0) + clamp(Math.round((h - 64) / 2.4), 0, 20);
  /** positions [{x, y, back}] in input order: one centred row, or two rows when > 256 px and ≥ 4 */
  function arrange(imgs) {
    const idx = imgs.map((_, i) => i);
    const total = imgs.reduce((s, im) => s + im.width, 0);
    const two = total > 256 && imgs.length >= 4;
    const rows = two ? [idx.filter((i) => i % 2 === 0), idx.filter((i) => i % 2 === 1)] : [idx];
    const out = [];
    rows.forEach((row, ri) => {
      const back = two && ri === 0;
      const tot = row.reduce((s, i) => s + imgs[i].width, 0);
      const gap = row.length > 1 ? Math.min(8, (244 - tot) / (row.length - 1)) : 0;
      let x = 128 - (tot + gap * (row.length - 1)) / 2;
      for (const i of row) {
        out[i] = { x: Math.round(x), y: feet(imgs[i].height, back) - imgs[i].height, back };
        x += imgs[i].width + gap;
      }
    });
    return out;
  }
  /** enemy groups for the name window: same name (and gold or not) counted together, first 4 */
  function groups(mons) {
    const by = {}, out = [];
    for (const m of mons) {
      const k = m.name + (m.gold ? '*' : '');
      if (!by[k]) out.push((by[k] = { name: m.name, gold: !!m.gold, n: 0 }));
      by[k].n++;
    }
    return out.slice(0, 4);
  }
  function statusWindow(G, p, x, y) {
    const C = G.C, theme = G.WINDOW_THEMES[(R.Settings && R.Settings.windowColor) || 'ink'] || G.WINDOW_THEMES.ink;
    G.window(x, y, WIN.w, WIN.h);
    const col = p.hp <= 0 ? C.dead : p.hp < p.mhp * 0.25 ? C.yellow : C.white;
    const nw = Math.min(52, Math.ceil(G.textWidth(p.name))), tw = nw + 8, tx = x + Math.floor((WIN.w - tw) / 2);
    G.rect(tx, y, tw, 5, theme.fill);
    G.fitText(p.name, tx + 4, y - 3, 52, { color: col });
    [['H', p.hp, 6], ['M', p.mp, 17], ['W', p.wp, 28]].forEach(([k, v, dy]) => {
      G.text(k, x + 6, y + dy, { color: col });
      G.text(String(v), x + 54, y + dy, { color: col, align: 'right' });
    });
    const mid = p.row === 'middle';
    G.rect(x + 4, y + 39, 15, 8, theme.fill2 || theme.fill);
    G.text(mid ? '中' : '前', x + 6, y + 38, { color: mid ? C.cyan : C.orange });
  }
  /**
   * Draw the screen into the 2D context `c` at `s`× with its top at `oy` (device px).
   * o.mons: [{img (canvas), name, gold, fly}]; o.frame bobs the flying ones ±2 px (§11.4.2).
   */
  function draw(c, s, oy, o) {
    const G = R.Gfx, C = G.C, prev = G.ctx;
    G.ctx = c;
    c.save();
    c.setTransform(s, 0, 0, s, 0, oy);
    c.imageSmoothingEnabled = false;
    c.textBaseline = 'top';
    try {
      G.rect(0, 0, 256, 224, '#000');
      let b = o.bg && G.has('bbg:' + o.bg) ? G.get('bbg:' + o.bg) : null;
      if (Array.isArray(b)) b = b[0];
      if (b) c.drawImage(b, 0, 0, 256, 144);
      else G.rect(0, 0, 256, 144, '#3a5a3a');
      const mons = o.mons || [];
      const pos = arrange(mons.map((m) => m.img));
      const order = mons.map((_, i) => i).sort((a, b2) => (pos[b2].back ? 1 : 0) - (pos[a].back ? 1 : 0));
      for (const i of order) {
        const m = mons[i], p = pos[i];
        const bob = m.fly && o.frame != null ? Math.round(Math.sin(o.frame / 18 + i) * 2) : 0;
        c.drawImage(m.img, p.x, p.y + bob);
      }
      PARTY.forEach((p, i) => statusWindow(G, p, WIN.xs[i], WIN.y));
      // the party command list and the enemy names beside it (§11.5.3, §11.5.4)
      G.window(CMD.x, CMD.y, CMD.w, CMD.h);
      const colW = Math.floor((CMD.w - CMD.padX - 6) / CMD.cols);
      COMMANDS.forEach((label, k) => {
        const x = CMD.x + CMD.padX + (k % 2) * colW, y = CMD.y + CMD.padY + Math.floor(k / 2) * CMD.lineH;
        G.fitText(label, x, y, colW - 6, { color: k === 1 ? C.gray : C.white });
        if (!k) G.cursor(x - 10, y + 1, false);
      });
      G.window(ENEMY.x, ENEMY.y, ENEMY.w, ENEMY.h);
      groups(mons).forEach((gr, i) => {
        const ty = ENEMY.y + 8 + i * 14, nw = Math.ceil(G.textWidth(String(gr.n)));
        const color = gr.gold ? C.gold : C.white;
        G.fitText(gr.name, ENEMY.x + 9, ty, ENEMY.w - 22 - nw, { color });
        G.text(String(gr.n), ENEMY.x + 101, ty, { align: 'right', color });
      });
    } finally {
      c.restore();
      G.ctx = prev;
    }
  }
  R.MonsBaseScreen = { WIN, BOX, ENEMY, GROUND, PARTY, feet, arrange, draw };
})(window.RPG);
