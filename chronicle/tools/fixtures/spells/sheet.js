// A8（spells）の見た目の確かめ。`node tools/build.js --with tools/fixtures/spells` で debug_spells.html に入る。
// 戦闘画面と同じ寸法（DESIGN §11.5.3・§11.5.7・§11.11.3。R.Battle.HELP / BOX / BANNER）で、術のデータがどう見えるかを描く:
//   RPG.spellsSheet('help')    77 の説明文をヘルプ欄（240×19、文字は 220px）に。220px を超える文は右端に赤い印
//   RPG.spellsSheet('list')    戦闘の術の一覧（R.UI.List 240×68・2 列 × 3 行・右に M と MP）を、77 を覚えた人の全ページで
//   RPG.spellsSheet('banner')  閃きの札（R.Battle.ui.bannerOf の見出し・色・幅。大きさ 16）を、単属性・合成術・三属性の代表で
//   RPG.spellsSheet('marks')   属性の印と色、状態の印（1 字と bfx:icon_*）、状態の文（on/off）
//   RPG.spellsWidths()         実際のフォントでの幅（名前・説明・札）
//
//   node tools/build.js --with tools/fixtures/spells && node tools/shot.js --html debug_spells.html --size 1100x2400 \
//     --eval "(RPG.spellsSheet('list'), 1)" --out /tmp/…/spells_list.png
(function (R) {
  'use strict';
  if (!R) return;
  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const spells = () => Object.keys(R.DB.actions).filter((id) => id.startsWith('s_')).map((id) => Object.assign({ id }, R.DB.actions[id])).sort((a, b) => a.order - b.order);
  const STEP = (a) => (a.cls === 'single' ? a.step + '段' : a.cls === 'triple' ? '三' : '合');

  function prepare(H) {
    const G = R.Gfx;
    if (R.Engine) R.Engine.paused = true;
    const cv = G.canvas;
    cv.width = R.W * R.SCALE; cv.height = H * R.SCALE;
    let st = document.getElementById('spells-sheet-style');
    if (!st) { st = document.createElement('style'); st.id = 'spells-sheet-style'; document.head.appendChild(st); }
    st.textContent = `#screen{width:${cv.width}px!important;height:${cv.height}px!important}` +
      'html,body{overflow:visible!important;height:auto!important}#game{height:auto!important;justify-content:flex-start!important}';
    G.reset();
    const c = G.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#20283c'); g.addColorStop(1, '#10141e');
    c.fillStyle = g; c.fillRect(0, 0, R.W, H);
    return G;
  }
  function elIcons(G, a, x, y) {
    let dx = 0;
    for (const e of a.elements) {
      const key = R.DB.elements[e].icon;
      if (G.has(key)) G.draw(G.get(key), x + dx, y, { w: 8, h: 8 });
      else G.rect(x + dx + 1, y + 1, 6, 6, R.DB.elements[e].color);
      dx += 9;
    }
    return dx;
  }

  function sheetHelp(from, n) {
    const list = spells().slice(from || 0, (from || 0) + (n || 77));
    const H = 8 + list.length * 20 + 8;
    const G = prepare(H);
    let y = 6;
    for (const a of list) {
      G.window(8, y, 240, 21);
      const tw = G.textWidth(a.desc);
      if (tw > 220) G.rect(242, y + 4, 2, 13, G.C.red);
      G.fitText(a.desc, 18, y + 4, 220);
      elIcons(G, a, 250 - 1 - 9 * a.elements.length, y - 1);
      y += 20;
    }
    return list.map((a) => ({ id: a.id, descW: +G.textWidth(a.desc).toFixed(1) }));
  }

  function sheetList(from, n) {
    const list = spells();
    const p0 = Math.floor((from || 0) / 6), pages = Math.min(Math.ceil(list.length / 6) - p0, n ? Math.ceil(n / 6) : 99);
    const H = 6 + pages * 72 + 4;
    const G = prepare(H);
    const items = list.map((a) => ({ label: a.name, right: 'M' + a.mp, color: undefined }));
    for (let q = 0; q < pages; q++) {
      const p = p0 + q;
      const L = new R.UI.List({ x: 8, y: 6 + q * 72, w: 240, h: 68, cols: 2, rows: 3, lineH: 16, padY: 10, title: '術', items, index: p * 6, active: false });
      L.top = p * 3;
      L.draw({ showInactiveCursor: true });
    }
    return { pages };
  }

  function sheetBanner() {
    const pick = ['s_fire_5', 's_water_1', 's_wind_5', 's_earth_5', 's_light_4', 's_dark_2', 's_water_wind_a', 's_light_dark_b', 's_earth_light_a',
      's_fire_water_light', 's_fire_light_dark', 's_water_earth_light', 's_earth_light_dark', 's_wind_light_dark'];
    const H = 8 + pick.length * 44;
    const G = prepare(H);
    const ui = R.Battle && R.Battle.ui && R.Battle.ui.bannerOf;
    const out = [];
    pick.forEach((id, i) => {
      const a = R.DB.actions[id];
      const b = ui ? ui(a, 'spell') : Object.assign({ name: a.name, w: Math.max(128, Math.ceil(G.textWidth(a.name, 16)) + 40) }, R.Glimmer.banner(a));
      const y = 10 + i * 44;
      const x = Math.round(128 - b.w / 2);
      G.window(x, y, b.w, 32);
      G.text(b.name, 128, y + 8, { size: 16, align: 'center', color: b.color, shadow: '#000' });
      const tw = Math.ceil(G.textWidth(b.title)) + 8, tx = x + Math.floor((b.w - tw) / 2);
      G.rect(tx, y - 3, tw, 8, G.WINDOW_THEMES.ink.fill);
      G.text(b.title, tx + 4, y - 3, { color: b.titleColor || G.C.white });
      // R.Glimmer.banner と bui の札が同じ見出し・色か
      const mine = R.Glimmer.banner(a);
      if (mine.title !== b.title || mine.color !== b.color) G.rect(x + b.w + 2, y + 12, 4, 8, G.C.red);
      out.push({ id, w: b.w, title: b.title, color: b.color });
    });
    return out;
  }

  function sheetMarks() {
    const H = 224;
    const G = prepare(H);
    // 属性
    G.window(4, 4, 248, 40, { title: '属性' });
    EL.forEach((e, i) => {
      const d = R.DB.elements[e], x = 10 + i * 40;
      G.rect(x, 16, 10, 10, d.color);
      if (G.has(d.icon)) G.draw(G.get(d.icon), x + 14, 17, { w: 8, h: 8 });
      G.text(d.name, x + 25, 14, { color: d.color });
      G.text('弱' + R.DB.elements[d.weakTo].name, x + 2, 28, { size: 8, color: G.C.gray });
    });
    // 状態の印
    G.window(4, 48, 248, 60, { title: '状態の印' });
    const st = Object.keys(R.DB.statuses);
    st.forEach((s, i) => {
      const d = R.DB.statuses[s], col = i % 4, row = Math.floor(i / 4);
      const x = 12 + col * 60, y = 57 + row * 12;
      const key = 'bfx:icon_' + s;
      if (G.has(key)) G.draw(G.get(key), x, y + 2, { w: 8, h: 8 });
      G.text(d.icon || '―', x + 10, y, { color: d.bad ? '#ff9090' : '#90e0ff' });
      G.fitText(d.name, x + 22, y + 1, 34, { size: 8, color: G.C.white });
    });
    // 状態の文（{name} に 5 字の名前を入れて 20 字の窓に収まるか）
    G.window(4, 112, 248, 110, { title: '状態の文（5 字の名前）' });
    const nm = 'ヴィオラン';
    const lines = [];
    for (const s of st) { const d = R.DB.statuses[s]; if (d.on) lines.push(d.on.replace('{name}', nm)); if (d.off) lines.push(d.off.replace('{name}', nm)); }
    const over = [];
    lines.slice(0, 26).forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 12 + col * 120, y = 120 + row * 7.4;
      const w = G.textWidth(t);
      if (w > 220) over.push(t);
      G.fitText(t, x, y, 114, { size: 6, color: w > 220 ? G.C.red : G.C.white });
    });
    return { over, lines: lines.length };
  }

  R.spellsSheet = function (page, from, n) {
    if (page === 'help') return sheetHelp(from, n);
    if (page === 'list') return sheetList(from, n);
    if (page === 'banner') return sheetBanner();
    if (page === 'marks') return sheetMarks();
    return null;
  };
  R.spellsWidths = function () {
    const G = R.Gfx, out = { nameMax: 0, descMax: 0, bannerMax: 0, over: [], listSqueeze: 1 };
    for (const a of spells()) {
      const nw = G.textWidth(a.name), dw = G.textWidth(a.desc), bw = G.textWidth(a.name, 16);
      out.nameMax = Math.max(out.nameMax, nw); out.descMax = Math.max(out.descMax, dw); out.bannerMax = Math.max(out.bannerMax, bw);
      if (dw > 220) out.over.push(a.id + ' desc ' + dw.toFixed(1));
      // 戦闘の術の一覧: 列の幅 109（(240 − 16 − 6)/2）から右の M 数字を引いた幅に名前を詰める
      const room = 109 - 16 - G.textWidth('M' + a.mp);
      out.listSqueeze = Math.min(out.listSqueeze, Math.min(1, room / nw));
      for (const s of Object.values(R.DB.statuses)) for (const t of [s.on, s.off]) if (t && G.textWidth(t.replace('{name}', 'ヴィオラン')) > 220) out.over.push('status ' + t);
    }
    out.nameMax = +out.nameMax.toFixed(1); out.descMax = +out.descMax.toFixed(1); out.bannerMax = +out.bannerMax.toFixed(1); out.listSqueeze = +out.listSqueeze.toFixed(3);
    out.over = Array.from(new Set(out.over));
    return out;
  };
})(window.RPG);
