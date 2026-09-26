'use strict';
// Mock screens: title, dialogue, main menu (hub), equip, shop, design-system sheet.
(function (G) {
  const { T } = K; const ctx = K.ctx; const SCREENS = (G.SCREENS = G.SCREENS || {});
  SCREENS.title = async function (o) {
    K.begin(960, 540);
    const bg = TITLE_ART.title(1920, 1080);
    K.device(); ctx.drawImage(bg, 0, 0); K.logical();
    K.fadePanel(0, 0, 520, 540, 'left', 0.55);
    // logotype
    K.glow(210, 150, 220, [255, 210, 140], 0.14);
    K.text('LUMINOUS CHRONICLE', 64, 106, { size: 15, fam: 'latin', w: 700, c: T.c.gold, track: 5, shadow: 'rgba(0,0,0,0.8)' });
    K.text('ルミナス・クロニクル', 60, 160, { size: 46, w: 700, grad: ['#fffdf4', '#f6e2b0', '#d8b06a'], shadow: 'rgba(30,20,0,0.9)', blur: 14, track: 2 });
    K.hline(60, 470, 176, 0.6, '236,201,124');
    K.text('〜 八つの伝承 〜', 64, 204, { size: 16, c: T.c.text2, track: 6, shadow: true });
    // menu
    const items = ['つづきから', 'はじめから', '設定', 'クレジット'];
    items.forEach((l, i) => {
      const y = 262 + i * 40;
      if (i === 0) K.focus(56, y - 22, 250, 34);
      K.text(l, 80, y, { size: 18, w: i === 0 ? 700 : 500, c: i === 0 ? '#fff8e6' : T.c.text2, shadow: true });
    });
    // resume card (what "つづきから" will load)
    const cx = 330, cy = 236;
    K.panel(cx, cy, 250, 120, { a: 0.6, r: 12, blur: 8 });
    K.text('最後の記録', cx + 16, cy + 24, { size: 10.5, w: 700, c: T.c.gold, track: 1 });
    K.text('オートセーブ　2分前', cx + 234, cy + 24, { size: 10, c: T.c.text3, align: 'right' });
    K.text('潮鳴りの洞窟　地下1階', cx + 16, cy + 48, { size: 14, w: 700 });
    K.text('第2章　・　12時間34分', cx + 16, cy + 68, { size: 11.5, c: T.c.text2 });
    ['arun', 'selma', 'sylvan', 'viola'].forEach((id, i) => K.portrait(BATTLE_ART.LOOKS[id], cx + 16 + i * 38, cy + 78, 32, 32, { scale: 1.9, dy: 0, r: 16 }));
    K.text('Lv 18', cx + 234, cy + 100, { size: 12, w: 700, c: T.c.text2, align: 'right' });
    K.prompts([['a', '決定'], ['dpad', '選ぶ']], 944, 516, { size: 11 });
    K.text('© Studio Metem　　ver 0.2', 24, 522, { size: 10, c: T.c.text3 });
  };
})(window);
(function (G) {
  const { T } = K; const ctx = K.ctx; const SCREENS = G.SCREENS;
  const U = (v) => K.U(v);
  const PARTY = G.PARTY, LOOKS = () => BATTLE_ART.LOOKS;

  function townBehind(o, blur, dimA) {
    const s = TOPDOWN.town();
    const v = G.fieldView(o, s, 32, 70, 240, 0);
    if (blur) K.blurAll(blur, v.W, v.H);
    if (dimA) K.dim(v.W, v.H, dimA);
    return v;
  }
  G.townBehind = townBehind;

  // ----------------------------------------------------------------- dialogue
  SCREENS.dialogue = async function (o) {
    const v = townBehind(o, 0, 0);
    const tall = v.tall;
    const W = v.W, H = v.H;
    // speaker marker over the innkeeper in the world
    const ix = 3.9 * 32 - v.vx, iy = 6.9 * 32 - v.vy - 58;
    if (!tall) { K.diamond(ix, iy, 5, T.c.goldHi, 'rgba(60,40,10,0.9)', 1); K.glow(ix, iy, 14, [255, 220, 150], 0.5); }
    const pw = tall ? W - 32 : 760, ph = tall ? U(190) : 150, px = tall ? 16 : (W - pw) / 2, py = tall ? H - ph - 36 : H - ph - 24;
    K.fadePanel(0, py - 60, W, H - py + 60, 'bottom', 0.55);
    K.panel(px, py, pw, ph, { a: 0.72, r: 14, blur: 8 });
    // portrait slot (left)
    const ps = tall ? U(96) : 118;
    K.portrait(BATTLE_ART.NPC.innkeeper, px + 14, py + (tall ? -ps * 0.45 : 16), ps, ps, { scale: tall ? 3.4 : 3.2, at: 0.5, r: 12, bg: ['#3a3040', '#171520'], ringC: 'rgba(236,201,124,0.45)' });
    const tx = px + (tall ? 16 : 150), ty = py + (tall ? ps * 0.62 : 22);
    // name plate
    const nw = K.measure('ロザンナ', 15, 700) + U(28);
    if (tall) { K.text('ロザンナ', px + ps + U(28), py + U(26), { size: 15, w: 700, c: T.c.gold }); K.text('宿「かもめ亭」のおかみ', px + ps + U(28), py + U(44), { size: 10.5, c: T.c.text3 }); }
    else { K.text('ロザンナ', tx, ty + 10, { size: 15, w: 700, c: T.c.gold }); K.text('宿「かもめ亭」のおかみ', tx + nw, ty + 10, { size: 10.5, c: T.c.text3 }); K.rule(tx, px + pw - 20, ty + 20, 0.16); }
    const lines = ['灯台の灯が消えてから、夜の海はずっと荒れたまま。', 'あんたたち、灯台まで行くつもりかい？', '――なら、今夜は泊まっておいき。'];
    const ly0 = tall ? py + ps * 0.62 + U(20) : ty + 46;
    lines.forEach((l, i) => K.text((i === 2 && tall) ? l.slice(0, 9) : l, tx, ly0 + i * U(tall ? 30 : 28), { size: tall ? 13.2 : 16.5, c: T.c.text }));
    // typewriter caret (mid-line on the 3rd line)
    const cw = K.measure(lines[2].slice(0, 9), tall ? 13.2 : 16.5, 500);
    if (tall) { ctx.fillStyle = T.c.gold; ctx.fillRect(tx + cw + 3, ly0 + 2 * U(30) - U(13), U(1.5), U(15)); }
    // controls (top-right of the box): log / auto / skip; text speed chip
    if (!tall) {
      K.prompts([['x', 'ログ'], ['y', 'オート'], ['r', 'スキップ']], px + pw - 12, py - 14, { size: 10.5, gap: 12 });
      K.chip('文字の速さ　速い', px, py - 26, { size: 9.5, c: T.c.text3 });
    } else {
      [['log', 'ログ'], ['auto', 'オート'], ['skip', 'スキップ']].forEach(([ic, l], i) => { const bx = 196 + i * 112; K.chip(l, bx, py - 40, { icon: ic, size: 10, c: T.c.text2 }); });
      K.text('タップで次へ　・　長押しで早送り', W / 2, H - 14, { size: 10.5, c: T.c.text3, align: 'center' });
    }
    // choice box (appears when the line finishes; shown here for the mock)
    if (!tall) {
      const cx = px + pw - 210, cy = py - 124;
      K.panel(cx, cy, 210, 92, { a: 0.78, r: 12, blur: 6 });
      K.focus(cx + 6, cy + 10, 198, 34);
      K.text('泊まる', cx + 28, cy + 33, { size: 15, w: 700, c: '#fff8e6' }); K.text('30 G', cx + 192, cy + 33, { size: 13, c: T.c.gold, align: 'right' });
      K.text('やめておく', cx + 28, cy + 73, { size: 15, c: T.c.text2 });
    }
  };

  // ----------------------------------------------------------------- main menu (hub)
  const COMMANDS = [['bag', '道具'], ['arts', '技・術'], ['equip', '装備'], ['order', '並びと隊列'], ['beast', '図鑑'], ['journal', '年代記・手がかり'], ['map', '地図'], ['save', 'セーブ'], ['gear', '設定']];
  const TIPS = { '装備': '武器・防具・アクセサリを付け替える。' };
  function memberCard(p, x, y, w, h, o) {
    o = o || {};
    K.panel(x, y, w, h, { a: o.sel ? 0.66 : 0.58, r: 12, blur: 8 });
    if (o.sel) K.focus(x, y, w, h, { r: 12, cursor: false, strong: false });
    const ps = h - U(20);
    K.portrait(LOOKS()[p.id], x + U(10), y + U(10), ps, ps, { scale: 2.4, r: 10 });
    const cx = x + U(20) + ps;
    K.tag(p.row, cx, y + U(24), 10);
    K.text(p.name, cx + U(22), y + U(24), { size: 16, w: 700 });
    K.text(p.title, cx + U(22) + K.measure(p.name, 16, 700) + U(8), y + U(24), { size: 10.5, c: T.c.text3 });
    K.text('Lv', x + w - U(44), y + U(24), { size: 10, w: 700, c: T.c.text3 });
    K.text(String(p.lv), x + w - U(12), y + U(24), { size: 16, w: 700, align: 'right' });
    const bw = (w - (cx - x) - U(20)) / 2;
    [['HP', p.hp, p.mhp, 'hp', 0], ['MP', p.mp, p.mmp, 'mp', 1]].forEach(([lab, c, m, k, i]) => {
      const bx = cx + i * (bw + U(8)), by = y + U(50);
      K.text(lab, bx, by, { size: 9.5, w: 700, c: T.c.text3 });
      K.frac(c, m, bx + bw, by, { size: 14, c: k === 'hp' && c / m < 0.25 ? T.c.hpLow[1] : T.c.text });
      K.gauge(bx, by + U(5), bw, c / m, k === 'mp' ? 'mp' : c / m < 0.25 ? T.c.hpLow : 'hp', { h: 3 });
    });
    K.text('次のレベルまで', cx, y + h - U(12), { size: 9.5, c: T.c.text3 });
    K.gauge(cx + U(76), y + h - U(15), w - (cx - x) - U(96), [0.62, 0.35, 0.81, 0.48][PARTY.indexOf(p)], 'exp', { h: 2 });
  }
  SCREENS.menu = async function (o) {
    const v = townBehind(o, 7, 0.35);
    const tall = v.tall, W = v.W, H = v.H;
    if (!tall) {
      // rail
      K.fadePanel(0, 0, 330, 540, 'left', 0.55);
      K.text('メニュー', 32, 46, { size: 13, w: 700, c: T.c.gold, track: 3 });
      K.hline(24, 200, 56, 0.4, '236,201,124');
      COMMANDS.forEach(([ic, l], i) => {
        const y = 70 + i * 36, sel = l === '装備';
        if (sel) K.focus(22, y, 188, 32);
        K.icon(ic, 36, y + 7, 18, sel ? T.c.goldHi : T.c.text2);
        K.text(l, 64, y + 22, { size: 15, w: sel ? 700 : 500, c: sel ? '#fff8e6' : T.c.text });
      });
      K.text(TIPS['装備'], 32, 418, { size: 11.5, c: T.c.text2 });
      // party cards
      PARTY.forEach((p, i) => memberCard(p, 236, 26 + i * 98, 350, 88, { sel: false }));
      // info
      const ix = 610;
      K.panel(ix, 26, 330, 128, { a: 0.55, r: 12, blur: 8 });
      [['coin', 'ゴールド', '12,345 G'], ['clock', 'プレイ時間', '12:34'], ['pin', '現在地', '港町ファロス']].forEach(([ic, l, val], i) => {
        const y = 58 + i * 36; K.icon(ic, ix + 16, y - 14, 17, T.c.text2); K.text(l, ix + 42, y, { size: 12.5, c: T.c.text2 }); K.text(val, ix + 314, y, { size: 15, w: 700, align: 'right', c: i === 0 ? T.c.gold : T.c.text });
      });
      K.panel(ix, 166, 330, 86, { a: 0.55, r: 12, blur: 8 });
      K.icon('quest', ix + 16, 180, 17, T.c.gold); K.text('目印を付けた手がかり', ix + 42, 194, { size: 11, w: 700, c: T.c.gold });
      K.text('森で人が消える', ix + 16, 222, { size: 15, w: 700 }); K.text('フェルンの酒場で聞いた　・　西', ix + 16, 242, { size: 11, c: T.c.text3 });
      K.prompts([['a', '決定'], ['b', '閉じる'], ['x', '満タン'], ['dpad', '仲間を選ぶと強さ']], 944, 518, { size: 11 });
    } else {
      // phone portrait: party 2×2 on top, command tiles 3×3 in the thumb zone
      K.text('メニュー', 20, 40, { size: 14, w: 700, c: T.c.gold, track: 3 });
      K.text('12,345 G　・　12:34', W - 20, 40, { size: 12, c: T.c.text2, align: 'right' });
      PARTY.forEach((p, i) => {
        const x = 16 + (i % 2) * 258, y = 58 + Math.floor(i / 2) * 150, w = 250, h = 142;
        K.panel(x, y, w, h, { a: 0.6, r: 12, blur: 8 });
        K.portrait(LOOKS()[p.id], x + 10, y + 10, 64, 64, { scale: 2.4, r: 10 });
        K.tag(p.row, x + 84, y + 30, 10); K.text(p.name, x + 112, y + 30, { size: 15, w: 700 });
        K.text('Lv ' + p.lv + '　' + p.title, x + 84, y + 58, { size: 10.5, c: T.c.text3 });
        [['HP', p.hp, p.mhp, 'hp'], ['MP', p.mp, p.mmp, 'mp']].forEach(([lab, c, m, k], j) => {
          const by = y + 98 + j * 30;
          K.text(lab, x + 12, by, { size: 9.5, w: 700, c: T.c.text3 }); K.frac(c, m, x + w - 12, by, { size: 14, c: k === 'hp' && c / m < 0.25 ? T.c.hpLow[1] : T.c.text });
          K.gauge(x + 12, by + 6, w - 24, c / m, k === 'mp' ? 'mp' : c / m < 0.25 ? T.c.hpLow : 'hp', { h: 3 });
        });
      });
      K.panel(16, 370, W - 32, 76, { a: 0.55, r: 12, blur: 8 });
      K.icon('quest', 30, 386, 18, T.c.gold); K.text('森で人が消える', 56, 402, { size: 15, w: 700 }); K.text('西・フェルン', W - 30, 402, { size: 11, c: T.c.text3, align: 'right' });
      K.text('フェルンの酒場で聞いた', 56, 428, { size: 11, c: T.c.text3 });
      COMMANDS.forEach(([ic, l], i) => {
        const x = 16 + (i % 3) * 172, y = 700 + Math.floor(i / 3) * 128, w = 164, h = 120, sel = l === '装備';
        K.panel(x, y, w, h, { a: 0.66, r: 14, blur: 8 });
        if (sel) K.focus(x, y, w, h, { r: 14, cursor: false });
        K.icon(ic, x + w / 2 - 18, y + 18, 36, sel ? T.c.goldHi : T.c.text2);
        K.text(l.replace('・手がかり', ''), x + w / 2, y + 94, { size: 14, w: 700, align: 'center', c: sel ? '#fff8e6' : T.c.text });
      });
      K.text('仲間をタップすると強さ', W / 2, H - 22, { size: 11, c: T.c.text3, align: 'center' });
    }
  };

  // ----------------------------------------------------------------- equip (member) and shop (4-member comparison)
  const SLOTS = [['sword', '武器1', '鋼の剣'], ['bow', '武器2', 'なし'], ['shield', '盾', '鉄の盾'], ['helm', '頭', '鉄の兜'], ['armor', '体', '革の鎧'], ['glove', '手', '革の小手'], ['boots', '足', '旅人の靴'], ['ring', 'アクセ1', '星見の指輪'], ['ring', 'アクセ2', 'なし']];
  const CANDS = [['鋼の剣', 'E', 0], ['銀の剣', '', 0], ['青鋼の剣', '', 0], ['霜の牙の剣', '', 1], ['長剣「潮騒」', '', 2]];
  function deltaRow(x, y, w, label, a, b) {
    const d = b - a;
    K.text(label, x, y, { size: 13, c: T.c.text2 });
    K.text(String(a), x + w * 0.52, y, { size: 14, align: 'right', c: T.c.text2 });
    K.text('→', x + w * 0.6, y, { size: 12, c: T.c.text3, align: 'center' });
    K.text(String(b), x + w * 0.8, y, { size: 15, w: 700, align: 'right', c: d > 0 ? T.c.up : d < 0 ? T.c.down : T.c.text });
    if (d) { K.icon(d > 0 ? 'up' : 'down', x + w * 0.83, y - 11, 12, d > 0 ? T.c.up : T.c.down); K.text((d > 0 ? '+' : '−') + Math.abs(d), x + w, y, { size: 12.5, w: 700, align: 'right', c: d > 0 ? T.c.up : T.c.down }); }
  }
  SCREENS.equip = async function (o) {
    const v = townBehind(o, 7, 0.45);
    const p = PARTY[0];
    // header: member + L/R
    K.panel(24, 22, 300, 70, { a: 0.62, r: 12 });
    K.portrait(LOOKS().arun, 34, 30, 54, 54, { scale: 2.4, r: 10 });
    K.text(p.name, 100, 52, { size: 17, w: 700 }); K.text(p.title + '　Lv ' + p.lv, 100, 74, { size: 11, c: T.c.text3 });
    K.glyph('l', 262, 58, { size: 10 }); K.glyph('r', 292, 58, { size: 10 });
    // slots
    K.panel(24, 102, 300, 386, { a: 0.62, r: 12 });
    K.text('装備', 40, 128, { size: 11, w: 700, c: T.c.gold, track: 2 });
    SLOTS.forEach(([ic, l, n], i) => {
      const y = 140 + i * 37;
      if (i === 0) K.focus(30, y, 288, 33);
      K.text(l, 44, y + 22, { size: 11, c: T.c.text3 });
      K.icon(ic, 94, y + 8, 17, n === 'なし' ? T.c.disabled : i === 0 ? T.c.goldHi : T.c.text2);
      K.text(n, 120, y + 22, { size: 14.5, w: i === 0 ? 700 : 500, c: n === 'なし' ? T.c.disabled : T.c.text });
    });
    // candidates
    K.panel(336, 102, 280, 250, { a: 0.66, r: 12 });
    K.text('武器1 の候補', 352, 128, { size: 11, w: 700, c: T.c.gold, track: 1 });
    CANDS.forEach(([n, e, r], i) => {
      const y = 140 + i * 40;
      if (i === 3) K.focus(342, y, 268, 36);
      K.icon('sword', 356, y + 10, 17, r === 2 ? T.c.super : r === 1 ? T.c.rare : T.c.text2);
      K.text(n, 382, y + 24, { size: 14.5, w: i === 3 ? 700 : 500, c: r === 2 ? T.c.super : r === 1 ? T.c.rare : T.c.text });
      if (r) K.stars(r, 382 + K.measure(n, 14.5, i === 3 ? 700 : 500) + 6, y + 13, 11, r === 2 ? T.c.super : T.c.rare);
      if (e) K.chip('装備中', 548, y + 9, { size: 9, c: T.c.text2, pad: 5 });
    });
    // comparison (item stats only; no calculated battle totals, A17)
    K.panel(628, 22, 308, 330, { a: 0.66, r: 12 });
    K.text('霜の牙の剣', 646, 56, { size: 18, w: 700, c: T.c.rare }); K.stars(1, 646 + K.measure('霜の牙の剣', 18, 700) + 8, 42, 14, T.c.rare);
    K.text('剣　・　片手　・　魔物の落とし物', 646, 78, { size: 11, c: T.c.text3 });
    K.rule(644, 920, 92, 0.16);
    K.text('いまの装備と比べる', 646, 114, { size: 11, w: 700, c: T.c.gold, track: 1 });
    deltaRow(646, 144, 272, '攻撃', 42, 51); deltaRow(646, 172, 272, '命中', 90, 90); deltaRow(646, 200, 272, '素早さ', 14, 15); deltaRow(646, 228, 272, '守備', 30, 30);
    K.rule(644, 920, 244, 0.16);
    K.text('斬りつけた相手を、ときどき凍らせる。', 646, 270, { size: 12.5, c: T.c.text });
    K.text('冷たい牙の欠片を打ち込んだ剣。', 646, 292, { size: 11.5, c: T.c.text3 });
    K.chip('水の技を閃きやすい', 646, 310, { size: 10, icon: 'bulb', c: T.c.teal, line: 'rgba(143,214,216,0.45)', bg: 'rgba(143,214,216,0.1)' });
    // who else can use it (no switching needed)
    K.panel(336, 364, 600, 124, { a: 0.6, r: 12 });
    K.text('ほかの仲間が付けると', 352, 390, { size: 11, w: 700, c: T.c.gold, track: 1 });
    const oth = [['selma', '攻撃 ▲+6', true], ['sylvan', '付けられない', false], ['viola', '攻撃 ▲+22', true]];
    oth.forEach(([id, t, ok], i) => { const x = 352 + i * 196, y = 404; K.portrait(LOOKS()[id], x, y, 40, 40, { scale: 2, r: 20 }); K.text(PARTY.find((q) => q.id === id).name, x + 50, y + 17, { size: 13, w: 700, c: ok ? T.c.text : T.c.disabled }); K.text(t, x + 50, y + 36, { size: 12, w: 700, c: ok ? T.c.up : T.c.disabled }); });
    K.prompts([['a', '付ける'], ['b', '戻る'], ['x', 'いちばん強く'], ['r', '次の仲間']], 944, 518, { size: 11 });
  };

  SCREENS.shop = async function (o) {
    const v = townBehind(o, 7, 0.45);
    // header with the shopkeeper
    K.panel(24, 22, 400, 70, { a: 0.62, r: 12 });
    K.portrait(BATTLE_ART.NPC.merchant, 34, 30, 54, 54, { scale: 2.4, r: 10 });
    K.text('武器と防具　ガルドの店', 100, 52, { size: 16, w: 700 }); K.text('「港の鍛冶場から今朝あがった品だよ」', 100, 74, { size: 11, c: T.c.text3 });
    K.panel(700, 30, 236, 54, { a: 0.62, r: 12 });
    K.icon('coin', 716, 45, 20, T.c.gold); K.text('所持金', 744, 62, { size: 12, c: T.c.text2 }); K.text('12,345 G', 920, 63, { size: 17, w: 700, c: T.c.gold, align: 'right' });
    // tabs
    const tabs = ['買う', '売る'];
    tabs.forEach((t, i) => { const x = 24 + i * 80; if (!i) { K.panel(x, 102, 72, 30, { a: 0.7, r: 15, frost: false, tone: [60, 48, 24] }); } K.text(t, x + 36, 122, { size: 13.5, w: 700, align: 'center', c: i ? T.c.text3 : T.c.goldHi }); });
    // list
    K.panel(24, 140, 400, 348, { a: 0.66, r: 12 });
    const items = [['sword', '銀の剣', 1400, 0], ['spear', '銀の槍', 1520, 0], ['bow', '樫の長弓', 1180, 1], ['staff', '月長石の杖', 1650, 0], ['armor', '鋼の鎧', 1300, 2], ['helm', '銀の兜', 760, 0], ['glove', '鎖の小手', 540, 1], ['boots', '革の長靴', 420, 3]];
    K.text('品物', 44, 164, { size: 10.5, c: T.c.text3 }); K.text('持っている', 330, 164, { size: 10.5, c: T.c.text3, align: 'right' }); K.text('値段', 404, 164, { size: 10.5, c: T.c.text3, align: 'right' });
    items.forEach(([ic, n, pr, own], i) => {
      const y = 174 + i * 38;
      if (i === 4) K.focus(30, y, 388, 34);
      K.icon(ic, 44, y + 9, 17, i === 4 ? T.c.goldHi : T.c.text2);
      K.text(n, 72, y + 23, { size: 14.5, w: i === 4 ? 700 : 500 });
      K.text(own ? String(own) : '—', 330, y + 23, { size: 13, c: T.c.text3, align: 'right' });
      K.text(pr.toLocaleString() + ' G', 404, y + 23, { size: 14, w: 700, align: 'right', c: pr > 12345 ? T.c.disabled : T.c.text });
      // small faces: who can equip (no ←→ switching, A17)
      const can = { sword: ['arun'], spear: ['selma'], bow: ['sylvan'], staff: ['viola'], armor: ['arun', 'selma'], helm: ['arun', 'selma', 'sylvan'], glove: ['arun', 'selma', 'sylvan', 'viola'], boots: ['arun', 'selma', 'sylvan', 'viola'] }[ic];
      ['arun', 'selma', 'sylvan', 'viola'].forEach((id, k) => { const ok = can.includes(id); ctx.save(); ctx.globalAlpha = ok ? 1 : 0.18; K.portrait(LOOKS()[id], 176 + k * 20, y + 7, 18, 18, { scale: 1.2, r: 9, ring: false }); ctx.restore(); });
    });
    // detail + 4-member deltas (A20: numbers, no member switching)
    K.panel(436, 102, 500, 386, { a: 0.66, r: 12 });
    K.text('鋼の鎧', 456, 136, { size: 20, w: 700 });
    K.text('体　・　重い鎧', 456, 158, { size: 11, c: T.c.text3 });
    K.text('守備', 780, 136, { size: 11, c: T.c.text3 }); K.text('34', 916, 138, { size: 22, w: 700, align: 'right' });
    K.text('厚い鋼の板を重ねた鎧。重いぶん、動きは少し鈍る。', 456, 190, { size: 12.5, c: T.c.text2 });
    K.rule(452, 920, 206, 0.16);
    K.text('いまの装備と比べると', 456, 230, { size: 11, w: 700, c: T.c.gold, track: 1 });
    const rows = [['arun', '革の鎧', [['守備', 14], ['素早さ', -1]]], ['selma', '鉄の鎧', [['守備', 6]]], ['sylvan', '付けられない', null], ['viola', '付けられない', null]];
    rows.forEach(([id, cur, ds], i) => {
      const y = 244 + i * 54, ok = !!ds, p = PARTY.find((q) => q.id === id);
      if (i === 0) { ctx.save(); K.rr(448, y - 2, 476, 50, 10); ctx.fillStyle = 'rgba(142,224,138,0.07)'; ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.globalAlpha = ok ? 1 : 0.4;
      K.portrait(LOOKS()[id], 458, y + 3, 40, 40, { scale: 2, r: 20 });
      K.text(p.name, 510, y + 20, { size: 14, w: 700 }); K.text(ok ? 'いま：' + cur : cur, 510, y + 38, { size: 11, c: T.c.text3 });
      if (ds) ds.forEach(([k, d], j) => { const xx = 916 - j * 150, col = d > 0 ? T.c.up : T.c.down; K.text(k, xx - 116, y + 28, { size: 12, c: T.c.text2 }); K.icon(d > 0 ? 'up' : 'down', xx - 64, y + 16, 13, col); K.text((d > 0 ? '+' : '−') + Math.abs(d), xx, y + 29, { size: 19, w: 700, c: col, align: 'right' }); });
      ctx.restore();
    });
    K.text('数量', 456, 470, { size: 11, c: T.c.text3 }); K.text('1', 520, 471, { size: 15, w: 700 }); K.text('合計 1,300 G', 916, 471, { size: 15, w: 700, c: T.c.gold, align: 'right' });
    K.prompts([['a', '買う'], ['b', '店を出る'], ['x', '詳しく'], ['r', '売る']], 944, 518, { size: 11 });
  };
})(window);
(function (G) {
  const { T } = K; const ctx = K.ctx; const SCREENS = G.SCREENS;
  SCREENS.kit = async function () {
    K.begin(960, 540); K.logical();
    const g = ctx.createLinearGradient(0, 0, 960, 540); g.addColorStop(0, '#141a2c'); g.addColorStop(1, '#090c16'); ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
    K.glow(700, 120, 300, [255, 190, 110], 0.08); K.glow(200, 480, 300, [110, 200, 230], 0.06);
    const H = (t, x, y) => { K.text(t, x, y, { size: 10.5, w: 700, c: T.c.gold, track: 2 }); K.hline(x - 4, x + 250, y + 6, 0.3, '236,201,124'); };
    // type scale
    H('文字（Zen Maru Gothic）', 24, 30);
    [['見出し大 26', 26, 700], ['見出し 20', 20, 700], ['項目 15', 15, 700], ['本文 15　灯台の灯が消えてから', 15, 500], ['補足 12.5', 12.5, 500], ['注記 11', 11, 500]].forEach(([t, s, w], i) => K.text(t, 24, 64 + i * 26 - (i ? 0 : 4), { size: s, w, c: i >= 4 ? T.c.text2 : T.c.text }));
    K.text('LUMINOUS CHRONICLE', 24, 222, { size: 13, fam: 'latin', w: 700, c: T.c.gold, track: 4 });
    // colours
    H('色', 300, 30);
    [['文字', T.c.text], ['補足', T.c.text2], ['注記', T.c.text3], ['琥珀', T.c.gold], ['青緑', T.c.teal], ['上がる', T.c.up], ['下がる', T.c.down], ['レア★', T.c.rare], ['超レア★★', T.c.super], ['前', T.c.front], ['後', T.c.back]].forEach(([n, c], i) => {
      const x = 300 + (i % 4) * 66, y = 44 + Math.floor(i / 4) * 44; ctx.fillStyle = c; K.rr(x, y, 56, 22, 5); ctx.fill(); K.text(n, x, y + 36, { size: 9.5, c: T.c.text2 });
    });
    // gauges
    H('ゲージ（HP 緑→琥珀 50%→赤 25%、MP 青）', 600, 30);
    [[0.9, 'hp'], [0.42, 'hp'], [0.18, 'hp'], [0.7, 'mp'], [0.55, 'exp']].forEach(([t, k], i) => { K.gauge(600, 50 + i * 16, 200, t, k, { h: 3, ghost: i === 1 ? 0.6 : null }); });
    K.text('被ダメージの直後は白い残像が 0.4 秒で縮む', 600, 142, { size: 9.5, c: T.c.text3 });
    // panels + focus
    H('窓・フォーカス', 24, 262);
    K.panel(24, 276, 250, 120, { a: 0.72, r: 12, frost: false });
    ['道具', '装備', '設定'].forEach((l, i) => { const y = 288 + i * 34; if (i === 1) K.focus(30, y, 238, 30); K.text(l, 50, y + 21, { size: 14, w: i === 1 ? 700 : 500, c: i === 1 ? '#fff8e6' : T.c.text }); });
    K.text('紺のすりガラス（背景を 1 回だけぼかした写し）＋琥珀の縁', 24, 414, { size: 9.5, c: T.c.text3 });
    // icons
    H('アイコン（24 単位の線画）', 300, 196);
    const ics = ['bag', 'arts', 'equip', 'order', 'beast', 'journal', 'map', 'save', 'gear', 'sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff', 'shield', 'helm', 'armor', 'glove', 'boots', 'ring', 'potion', 'gem', 'coin', 'clock', 'pin', 'quest', 'bulb', 'inn', 'shop', 'ff', 'auto', 'log', 'skip', 'chat'];
    ics.forEach((n, i) => K.icon(n, 300 + (i % 12) * 24, 210 + Math.floor(i / 12) * 26, 18, T.c.text2));
    // prompt glyph sets
    H('ボタン表示（入力に合わせて自動で切り替え）', 600, 196);
    [['pad', 'パッド'], ['kb', 'キーボード'], ['touch', 'タッチ']].forEach(([d, n], i) => { K.text(n, 600, 232 + i * 32, { size: 10.5, c: T.c.text3 }); K.prompts([['a', '決定'], ['b', '戻る'], ['y', 'メニュー']], 670, 228 + i * 32, { size: 11, align: 'left', device: d, gap: 12 }); });
    // chips / damage numbers
    H('札・数字', 300, 312);
    let cx = 300; cx += K.chip('NEW', cx, 326, { size: 9, c: '#241a08', bg: T.c.gold, pad: 5 }) + 8; cx += K.chip('装備中', cx, 326, { size: 9.5, c: T.c.text2 }) + 8; cx += K.chip('×2', cx, 326, { icon: 'ff', size: 9.5 }) + 8; K.chip('水の技を閃きやすい', cx, 326, { size: 9.5, icon: 'bulb', c: T.c.teal, bg: 'rgba(143,214,216,0.1)', line: 'rgba(143,214,216,0.45)' });
    K.text('248', 318, 386, { size: 26, w: 700, c: '#fff', stroke: ['rgba(20,14,10,0.95)', 4], align: 'center' });
    K.text('1,284', 386, 386, { size: 26, w: 700, grad: ['#ffffff', '#fff0c0', '#ffc860'], stroke: ['rgba(40,22,6,0.95)', 4], align: 'center' });
    K.text('+86', 450, 386, { size: 22, w: 700, c: '#b8f0a0', stroke: ['rgba(10,30,10,0.9)', 4], align: 'center' });
    K.text('+12', 500, 386, { size: 22, w: 700, c: '#a8d4ff', stroke: ['rgba(8,16,30,0.9)', 4], align: 'center' });
    K.text('ミス', 548, 386, { size: 15, w: 700, c: T.c.text3, stroke: ['rgba(0,0,0,0.8)', 3], align: 'center' });
    K.text('通常　 会心　 HP回復  MP回復  外れ', 300, 404, { size: 9.5, c: T.c.text3 });
    // motion
    H('動き（ms）', 600, 336);
    [['カーソル移動', 80], ['フォーカスの光', 120], ['窓が開く（下から 8px＋フェード）', 180], ['窓が閉じる', 140], ['画面の切り替え', 260], ['通知', 2400]].forEach(([n, ms], i) => { K.text(n, 600, 362 + i * 18, { size: 10.5, c: T.c.text2 }); K.text(String(ms), 940, 362 + i * 18, { size: 10.5, w: 700, align: 'right' }); });
    K.text('ルミナス・クロニクル　UI の部品（MODERN_UI.md §3）', 24, 520, { size: 10, c: T.c.text3 });
  };
})(window);
