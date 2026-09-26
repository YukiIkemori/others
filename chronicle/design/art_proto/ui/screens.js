// Mock screens: battle family (command, tech list + target, glimmer, victory). Logical units.
'use strict';
(function (G) {
  const { T } = K;
  const ctx = K.ctx;
  const SCREENS = (G.SCREENS = G.SCREENS || {});

  const PARTY = [
    { id: 'arun', name: 'アルン', title: '語り部見習い', row: '前', lv: 18, hp: 417, mhp: 452, mp: 47, mmp: 60, w: 'sword' },
    { id: 'selma', name: 'セルマ', title: '元衛兵', row: '前', lv: 18, hp: 512, mhp: 540, mp: 22, mmp: 34, w: 'spear' },
    { id: 'sylvan', name: 'シルヴァン', title: '森の狩人', row: '後', lv: 17, hp: 301, mhp: 330, mp: 38, mmp: 52, w: 'bow' },
    { id: 'viola', name: 'ヴィオラ', title: '没落貴族', row: '後', lv: 17, hp: 58, mhp: 268, mp: 86, mmp: 120, w: 'staff' },
  ];
  G.PARTY = PARTY;

  // ------------------------------------------------------------------ battle party panel (top-right)
  function partyPanel(x, y, w, o) {
    o = Object.assign({ active: 0, glow: -1, rowH: 44 }, o);
    const U = K.U, rowH = U(o.rowH);
    PARTY.forEach((p, i) => {
      const ry = y + i * rowH;
      if (i === o.glow) {
        ctx.save(); const g = ctx.createLinearGradient(x - 30, 0, x + w, 0); g.addColorStop(0, 'rgba(255,214,120,0)'); g.addColorStop(0.3, 'rgba(255,214,120,0.34)'); g.addColorStop(1, 'rgba(255,214,120,0.12)');
        ctx.fillStyle = g; K.rr(x - 30, ry - U(2), w + 34, rowH - U(2), 6); ctx.fill(); ctx.restore();
        K.glow(x + w * 0.35, ry + rowH / 2, w * 0.7, [255, 220, 140], 0.35);
      }
      if (i === o.active) K.focus(x - U(8), ry - U(2), w + U(12), rowH - U(4), { strong: false, cursor: true });
      const ty = ry + U(15);
      K.tag(p.row, x + U(4), ty + U(1), 10);
      K.text(p.name, x + U(24), ty, { size: 14, w: 700, c: p.hp / p.mhp < 0.25 ? T.c.hpLow[1] : T.c.text, shadow: true });
      // HP / MP blocks
      const bw = (w - U(30)) / 2, bx1 = x + U(24), bx2 = bx1 + bw + U(8), vy = ry + U(33);
      const block = (bx, lab, cur, max, kind) => {
        K.text(lab, bx, vy, { size: 9.5, w: 700, c: T.c.text3, shadow: true });
        K.frac(cur, max, bx + bw - U(2), vy, { size: 14, c: kind === 'hp' && cur / max < 0.25 ? T.c.hpLow[1] : T.c.text, shadow: true });
        K.gauge(bx, vy + U(4), bw - U(2), cur / max, kind === 'mp' ? 'mp' : cur / max < 0.25 ? T.c.hpLow : 'hp', { h: 2.5 });
      };
      block(bx1, 'HP', p.hp, p.mhp, 'hp'); block(bx2, 'MP', p.mp, p.mmp, 'mp');
    });
  }

  function speedChip(x, y) {
    let cx = x;
    cx -= K.chip('×2', cx - 40, y, { icon: 'ff', size: 10.5 }) ;
  }

  function battleBase(o) {
    const tall = o.layout === 'tall';
    const Wl = tall ? 540 : 960, Hl = tall ? 1169 : 540;
    K.begin(Wl, Hl, tall ? 1.3 : 1);
    const st = BATTLE_ART.stage(tall ? { W: 1080, H: 1300, layout: 'tall', mode: o.mode, noFoes: o.noFoes } : { W: 1920, H: 1080, layout: 'wide', mode: o.mode, noFoes: o.noFoes });
    K.device(); ctx.drawImage(st.canvas, 0, 0); K.logical();
    const A = {}; st.actors.forEach((a) => { A[a.id] = { x: a.x / 2, y: a.y / 2, top: a.top / 2, left: a.left / 2, w: a.w / 2, h: a.h / 2, name: a.name, foe: a.foe }; });
    if (tall) {
      // the stage melts into the UI sheet below
      const g = ctx.createLinearGradient(0, 560, 0, 700); g.addColorStop(0, 'rgba(12,12,18,0)'); g.addColorStop(1, 'rgba(12,12,18,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 560, 540, 140); ctx.fillStyle = '#0c0c12'; ctx.fillRect(0, 699, 540, Hl - 699);
    }
    return { A, tall, W: Wl, H: Hl };
  }
  function enemyTags(A, o) {
    o = o || {};
    for (const k in A) { const a = A[k]; if (!a.foe) continue;
      const y = a.y + 14; K.hline(a.x - 44, a.x + 44, y - 8, 0.5);
      K.text(a.name, a.x, y + 4, { size: 10.5, c: '#f2ede2', align: 'center', shadow: true });
    }
  }
  function cmdPanel(x, y, items, sel, o) {
    o = Object.assign({ w: 128, title: null, rowH: 26 }, o);
    const U = K.U, rowH = U(o.rowH), head = o.title ? U(26) : U(6);
    const h = head + items.length * rowH + U(8);
    K.panel(x, y, U(o.w), h, { a: 0.66, r: 10, blur: 6 });
    if (o.title) { K.text(o.title, x + U(12), y + U(17), { size: 10.5, w: 700, c: T.c.gold }); K.rule(x + U(10), x + U(o.w) - U(10), y + U(23), 0.18); }
    items.forEach((it, i) => {
      const ry = y + head + i * rowH;
      if (i === sel) K.focus(x + U(4), ry + U(2), U(o.w) - U(8), rowH - U(2));
      const dis = it.disabled;
      if (it.icon) K.icon(it.icon, x + U(14), ry + rowH / 2 - U(7.5), U(15), dis ? T.c.disabled : i === sel ? T.c.goldHi : T.c.text2);
      K.text(it.label, x + U(it.icon ? 36 : 16), ry + rowH / 2 + U(5), { size: 14, w: i === sel ? 700 : 500, c: dis ? T.c.disabled : i === sel ? '#fff8e6' : T.c.text });
      if (it.isNew) K.chip('NEW', x + U(36) + K.measure(it.label, 14, i === sel ? 700 : 500) + U(6), ry + rowH / 2 - U(7), { size: 8, c: '#241a08', bg: T.c.gold, line: 'rgba(255,240,200,0.6)', pad: 4 });
      if (it.right) K.text(it.right, x + U(o.w) - U(12), ry + rowH / 2 + U(4.5), { size: 11.5, w: 700, c: it.free ? T.c.teal : dis ? T.c.disabled : T.c.text2, align: 'right' });
    });
    return h;
  }
  function turnHead(x, y, name, sub) {
    K.diamond(x + 14, y + 14, 13, 'rgba(40,52,78,0.55)', 'rgba(236,230,214,0.85)', 1); K.diamond(x + 14, y + 14, 8, null, 'rgba(236,230,214,0.55)', 0.75);
    K.hline(x + 30, x + 360, y + 13, 0.55); K.hline(x + 30, x + 360, y + 16, 0.2);
    K.text(name, x + 38, y + 8, { size: 16, w: 700, shadow: true });
    if (sub) K.text(sub, x + 38, y + 32, { size: 11.5, c: T.c.text2, shadow: true });
  }

  SCREENS.battle = async function (o) {
    const b = battleBase({ layout: o.layout, mode: 'cmd' });
    const { A } = b;
    if (!b.tall) {
      K.fadePanel(600, 0, 360, 200, 'right', 0.62);
      partyPanel(716, 12, 232, { active: 0 });
      turnHead(16, 14, 'アルンの番', '武器の技を選ぶ。');
      const h = A.arun;
      cmdPanel(h.left - 150, h.top - 128, [{ label: '剣', icon: 'sword' }, { label: '術', icon: 'arts' }, { label: '防御', icon: 'shield' }, { label: '道具', icon: 'bag' }], 0, { title: 'アルン' });
      enemyTags(A);
      K.chip('×2', 16, 500, { icon: 'ff', size: 10.5 });
      K.prompts([['a', '決定'], ['b', 'ひとつ戻る'], ['x', '詳しく'], ['r', '速さ']], 944, 510, { size: 11.5 });
    } else {
      const U = K.U;
      turnHead(12, 28, 'アルンの番', '武器の技を選ぶ。');
      enemyTags(A);
      // party: 2×2 cards under the stage
      PARTY.forEach((p, i) => {
        const cx = 16 + (i % 2) * 258, cy = 640 + Math.floor(i / 2) * 76;
        K.panel(cx, cy, 250, 70, { a: 0.7, r: 10, frost: false });
        if (i === 0) K.focus(cx + 2, cy + 2, 246, 66, { cursor: false, strong: false });
        K.tag(p.row, cx + 10, cy + 24, 10);
        K.text(p.name, cx + 36, cy + 24, { size: 15, w: 700, c: p.hp / p.mhp < 0.25 ? T.c.hpLow[1] : T.c.text });
        const bw = 108;
        [['HP', p.hp, p.mhp, 'hp', 10], ['MP', p.mp, p.mmp, 'mp', 132]].forEach(([lab, c, m, k, dx]) => {
          K.text(lab, cx + dx, cy + 50, { size: 9.5, w: 700, c: T.c.text3 });
          K.frac(c, m, cx + dx + bw, cy + 50, { size: 13.5, c: k === 'hp' && c / m < 0.25 ? T.c.hpLow[1] : T.c.text });
          K.gauge(cx + dx, cy + 56, bw, c / m, k === 'mp' ? 'mp' : c / m < 0.25 ? T.c.hpLow : 'hp', { h: 3 });
        });
      });
      // commands: big thumb row
      const cmds = [['剣', 'sword'], ['術', 'arts'], ['防御', 'shield'], ['道具', 'bag']];
      K.text('アルン', 20, 830, { size: 12, w: 700, c: T.c.gold });
      cmds.forEach(([l, ic], i) => {
        const x = 16 + i * 128, y = 842, w = 120, h = 92;
        K.panel(x, y, w, h, { a: i === 0 ? 0.5 : 0.72, r: 14, frost: false });
        if (i === 0) { K.focus(x, y, w, h, { cursor: false }); }
        K.icon(ic, x + w / 2 - 16, y + 14, 32, i === 0 ? T.c.goldHi : T.c.text2);
        K.text(l, x + w / 2, y + 74, { size: 16, w: 700, align: 'center', c: i === 0 ? '#fff8e6' : T.c.text });
      });
      K.panel(16, 948, 508, 52, { a: 0.6, r: 12, frost: false });
      K.text('剣の技と通常の攻撃。敵をひとり選ぶ。', 32, 980, { size: 13, c: T.c.text2 });
      K.chip('×2', 16, 1020, { icon: 'ff', size: 11 }); K.chip('リピート', 90, 1020, { icon: 'auto', size: 11, c: T.c.text3 }); K.chip('逃げる', 206, 1020, { icon: 'exit', size: 11, c: T.c.text3 });
      K.text('タップで決定　・　長押しで説明', 270, 1130, { size: 11, c: T.c.text3, align: 'center' });
    }
  };

  SCREENS.battle_tech = async function (o) {
    const b = battleBase({ layout: o.layout, mode: 'cmd' });
    const { A } = b;
    K.fadePanel(600, 0, 360, 200, 'right', 0.62);
    partyPanel(716, 12, 232, { active: 0 });
    const h = A.arun;
    const items = [{ label: '攻撃', right: '' }, { label: '二段斬り', right: 'M 4' }, { label: '稲妻突き', right: 'M 6' }, { label: '疾風剣', right: 'M 0', free: true, isNew: true }, { label: '流し斬り', right: 'M 12', disabled: true }];
    const LX = h.left - 200, LY = h.top - 228;
    const ph = cmdPanel(LX, LY, items, 2, { w: 172, title: 'アルン ›  剣' });
    // description / tooltip under the list (no effect numbers, A17)
    K.panel(LX + 180, LY + 60, 190, 50, { a: 0.6, r: 8, blur: 6 });
    K.text('雷をまとった鋭い突き。', LX + 192, LY + 80, { size: 11.5, c: T.c.text2 });
    K.text('ひとりに　・　ねらい：氷狼', LX + 192, LY + 98, { size: 10.5, c: T.c.text3 });
    // target: the wolf, with a marker and a name card
    const w = A.wolf;
    K.glow(w.x, w.top + 4, 26, [255, 230, 170], 0.5); K.diamond(w.x + 10, w.top - 8, 6, T.c.goldHi, 'rgba(80,60,30,0.9)', 1);
    turnHead(16, 14, 'アルンの番', '剣の技を選ぶ（ねらいは前回の相手を覚えている）');
    enemyTags(A);
    K.prompts([['a', '決定'], ['b', 'ひとつ戻る'], ['x', '詳しく'], ['dpad', '相手を変える']], 944, 510, { size: 11.5 });
  };

  SCREENS.glimmer = async function (o) {
    const b = battleBase({ layout: o.layout, mode: 'glimmer' });
    const { A } = b;
    K.fadePanel(600, 0, 360, 200, 'right', 0.62);
    partyPanel(716, 12, 232, { active: -1, glow: 0 });
    // bulb over the head (glimmer)
    const h = A.arun;
    const bx = h.x + 2, by = h.top - 18;
    K.glow(bx, by, 60, [255, 236, 170], 0.9); K.glow(bx, by, 24, [255, 255, 230], 0.9);
    K.icon('bulb', bx - 14, by - 16, 28, '#fff6d6', { lw: 2.2 });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2; K.ctx.save(); K.ctx.strokeStyle = 'rgba(255,240,200,0.9)'; K.ctx.lineWidth = 1.5; K.ctx.beginPath(); K.ctx.moveTo(bx + Math.cos(a) * 20, by + Math.sin(a) * 20); K.ctx.lineTo(bx + Math.cos(a) * 28, by + Math.sin(a) * 28); K.ctx.stroke(); K.ctx.restore(); }
    // big technique banner (left-centre), light streak behind
    const cx = 260, cy = 120;
    ctx.save(); const g = ctx.createLinearGradient(0, cy - 40, 0, cy + 30); g.addColorStop(0, 'rgba(10,10,16,0)'); g.addColorStop(0.5, 'rgba(10,10,16,0.55)'); g.addColorStop(1, 'rgba(10,10,16,0)'); ctx.fillStyle = g; ctx.fillRect(0, cy - 44, 620, 84); ctx.restore();
    K.hline(40, 580, cy - 36, 0.7, '255,226,160'); K.hline(40, 580, cy + 30, 0.7, '255,226,160');
    K.glow(cx, cy - 6, 220, [255, 214, 130], 0.25);
    K.text('閃き', cx, cy - 16, { size: 13, w: 700, c: T.c.gold, align: 'center', track: 6, shadow: true });
    K.text('稲妻突き', cx, cy + 20, { size: 34, w: 700, align: 'center', grad: ['#fffdf2', '#ffe7a8', '#e2b35c'], shadow: 'rgba(60,30,0,0.9)', blur: 10, track: 4 });
    // damage number over the wolf (critical style)
    const w = A.wolf, dx = w.x + 30, dy = w.top + 10;
    K.text('会心', dx - 38, dy - 30, { size: 12, w: 700, c: T.c.gold, shadow: true, stroke: ['rgba(40,20,0,0.9)', 3] });
    K.text('1,284', dx, dy, { size: 34, w: 700, align: 'center', grad: ['#ffffff', '#fff0c0', '#ffc860'], stroke: ['rgba(40,22,6,0.95)', 5] });
    // a heal number on Selma (other event in the same frame, to show the colour set)
    const s = A.selma;
    K.text('+86', s.x, s.top - 4, { size: 20, w: 700, align: 'center', c: '#b8f0a0', stroke: ['rgba(10,30,10,0.9)', 4] });
    enemyTags(A);
    K.prompts([['a', '早送り'], ['r', '速さ']], 944, 510, { size: 11.5 });
  };

  SCREENS.victory = async function (o) {
    const b = battleBase({ layout: o.layout, mode: 'victory', noFoes: true });
    const U = K.U;
    // soft darkening on the left where the card sits
    K.fadePanel(0, 0, 620, 540, 'left', 0.7);
    // header
    K.text('勝利', 48, 70, { size: 32, w: 700, grad: ['#fffdf2', '#f2d08a'], shadow: 'rgba(0,0,0,0.8)', blur: 8, track: 6 });
    K.hline(40, 520, 84, 0.5, '255,226,160');
    // rewards
    const row = (y, ic, label, val, col) => { K.icon(ic, 48, y - 14, 18, T.c.text2); K.text(label, 76, y, { size: 13, c: T.c.text2 }); K.text(val, 300, y, { size: 18, w: 700, align: 'right', c: col || T.c.text }); };
    row(118, 'star', '経験値', '+1,240'); row(146, 'coin', 'ゴールド', '+380 G', T.c.gold);
    K.text('手に入れた物', 48, 186, { size: 11.5, w: 700, c: T.c.text3, track: 2 });
    const drops = [['氷狼の毛皮', '×2', null], ['傷薬', '×1', null], ['霜の牙の短剣', '', 'rare']];
    drops.forEach(([n, q, r], i) => {
      const y = 196 + i * 34;
      if (r) { K.panel(40, y, 290, 30, { a: 0.4, r: 8, frost: false, tone: [30, 36, 54] }); K.glow(56, y + 15, 40, [134, 200, 255], 0.35); }
      K.icon(r ? 'dagger' : i === 1 ? 'potion' : 'gem', 50, y + 6, 18, r ? T.c.rare : T.c.text2);
      K.text(n, 76, y + 20, { size: 14, w: r ? 700 : 500, c: r ? T.c.rare : T.c.text });
      if (r) K.stars(1, 76 + K.measure(n, 14, 700) + 6, y + 8, 12, T.c.rare);
      K.text(q, 318, y + 20, { size: 13, c: T.c.text2, align: 'right' });
    });
    // per member
    K.text('仲間', 48, 318, { size: 11.5, w: 700, c: T.c.text3, track: 2 });
    const grow = [{ lv: 19, hp: 12, mp: 3 }, { lv: 0, hp: 0, mp: 0 }, { lv: 18, hp: 9, mp: 4 }, { lv: 0, hp: 0, mp: 0 }];
    PARTY.forEach((p, i) => {
      const y = 330 + i * 40;
      K.portrait(BATTLE_ART.LOOKS[p.id], 48, y, 32, 32, { scale: 1.9, dy: 0, r: 16 });
      K.text(p.name, 90, y + 14, { size: 13.5, w: 700 });
      const gr = grow[i];
      if (gr.lv) { K.chip('レベルアップ', 90, y + 18, { size: 9, c: '#241a08', bg: T.c.gold, line: 'rgba(255,240,200,0.6)', pad: 5 }); K.text('Lv ' + gr.lv, 180, y + 29, { size: 11, w: 700, c: T.c.gold }); }
      else K.gauge(90, y + 24, 110, [0.62, 0.35, 0.81, 0.48][i], 'exp', { h: 3 });
      if (gr.hp) K.text('最大HP +' + gr.hp, 330, y + 14, { size: 12, c: T.c.up, align: 'right' });
      if (gr.mp) K.text('最大MP +' + gr.mp, 330, y + 30, { size: 12, c: T.c.up, align: 'right' });
    });
    K.prompts([['a', '次へ'], ['x', 'まとめて見る']], 944, 510, { size: 11.5 });
    K.text('熟練が上がった：剣・弓・火', 48, 506, { size: 11, c: T.c.text3 });
  };

  G.BATTLE_UI = { partyPanel, cmdPanel, turnHead, enemyTags };
})(window);
