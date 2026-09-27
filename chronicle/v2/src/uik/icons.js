// UIK: アイコン（MODERN_UI §3.4。線画のベクター、24 単位の箱、線の太さ 1.8、角は丸）
//   icon(g, name, x, y, size, color, o)   (x, y) は箱の左上、size は掛けた後の論理 px。o = {lw}
//   名前は R.Contract.ICONS のすべて（知らない名前は四角）。道は初めて使うときに Path2D にして使い回す（毎フレーム作らない）。
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});

  // 道の書き方: 'M…' = 線、'F:M…' = 塗り、['c', x, y, r] = 丸の線、['cf', x, y, r] = 丸の塗り、['lw', n] = 線の太さ
  const rays = (n, r0, r1, a0) => {
    let d = '';
    for (let i = 0; i < n; i++) { const a = (a0 || 0) + i * Math.PI * 2 / n; d += `M${(12 + Math.cos(a) * r0).toFixed(2)} ${(12 + Math.sin(a) * r0).toFixed(2)}L${(12 + Math.cos(a) * r1).toFixed(2)} ${(12 + Math.sin(a) * r1).toFixed(2)}`; }
    return d;
  };
  const DEF = {
    bag: ['M6 9h12l-1.2 11H7.2z', 'M9 9V7a3 3 0 0 1 6 0v2', 'M10 13h4'],
    arts: ['M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z', 'F:M19 3.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z'],
    equip: ['M5 19L16 8', 'M14 5l5 0 0 5', 'M5 15l4 4', 'M3 21l2-2'],
    sword: ['M5 19L17 7', 'M15 5h4v4', 'M5.5 14.5l4 4', 'M3.5 20.5l2-2'],
    greatsword: ['M4 20L16 8', 'M13 5l6-1-1 6', 'M5 14l5 5', 'M3 21l1.5-1.5', ['lw', 3.2], 'M8 16L17 7'],
    dagger: ['M7 17l8-8', 'M14 7l3 0 0 3', 'M6.5 13.5l4 4', 'M5 19l1.5-1.5'],
    bow: ['M7 3c7 3 11 7 14 14', 'M7 3l14 14', 'M4 20l10-10', 'M4 16v4h4'],
    staff: ['M6 21L15 9', ['c', 16.5, 7, 3.2], ['cf', 16.5, 7, 1.4]],
    shield: ['M12 3l7 2.5v6c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5v-6z', 'M12 7v10'],
    helm: ['M5 15a7 7 0 0 1 14 0v3H5z', 'M9 15v3M15 15v3', 'M12 6V4'],
    armor: ['M8 4l4 2 4-2 3 3-2 3v10H7V10L5 7z', 'M12 6v14'],
    glove: ['M8 21v-6L5 11l1.5-1.5L9 12V5a1.3 1.3 0 0 1 2.6 0v5M11.6 9V4a1.3 1.3 0 0 1 2.6 0v6M14.2 10V5.5a1.3 1.3 0 0 1 2.6 0V16c0 3-2 5-5 5z'],
    boots: ['M8 3h6v11l5 2.5V20H6v-4c1.5 0 2-1 2-3z', 'M6 18h13'],
    ring: [['c', 12, 14, 6], 'M9 6l3-3 3 3-3 2z'],
    order: ['M5 7h6M5 12h6M5 17h6', 'M15 5l3-2 3 2M18 3v18M15 19l3 2 3-2'],
    beast: ['M5 9l1-5 4 3h4l4-3 1 5c1 2 1 5-1 7l-3 3.5h-6L6 16c-2-2-2-5-1-7z', ['cf', 9.5, 12, 1.1], ['cf', 14.5, 12, 1.1], 'M11 16h2'],
    book: ['M4 5.5C7 4 9.5 4 12 6c2.5-2 5-2 8-.5V19c-3-1.5-5.5-1.5-8 .5-2.5-2-5-2-8-.5z', 'M12 6v13.5'],
    journal: ['M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z', 'M9 3v18', 'M12 8h3M12 12h3'],
    map: ['M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z', 'M9 4v14M15 6v14'],
    save: ['M12 3l6 6-6 12-6-12z', 'M6 9h12M12 3v18'],
    gear: [['c', 12, 12, 3.2], ['c', 12, 12, 6.2], () => rays(8, 6, 8.8)],
    warp: ['M12 3v4M12 17v4M3 12h4M17 12h4', ['c', 12, 12, 5]],
    exit: ['M14 4h5v16h-5', 'M4 12h10M10 8l4 4-4 4'],
    potion: ['M10 3h4M10.5 3v5L6.5 15a5 5 0 0 0 4.4 6h2.2a5 5 0 0 0 4.4-6l-4-7V3', 'M7.5 14h9'],
    gem: ['M7 4h10l4 5-9 12L3 9z', 'M3 9h18M9 4l3 5 3-5M12 9v12'],
    coin: [['c', 12, 12, 8], 'M12 7.5v9M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4'],
    clock: [['c', 12, 12, 8.5], 'M12 7v5l3.5 2'],
    pin: ['M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z', ['c', 12, 10, 2.2]],
    quest: ['M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z', 'M10 8.5a2 2 0 1 1 2.8 1.8c-.6.3-.8.7-.8 1.4', ['cf', 12, 13.6, 0.9]],
    bulb: ['M9 17h6M10 20h4', 'M8.5 14.5C6.5 13 5.5 11 5.5 9a6.5 6.5 0 0 1 13 0c0 2-1 4-3 5.5V17h-7z'],
    inn: ['M3 18h18M4 18v-7h16v7', 'M4 11c0-2 1-3 3-3h4v3', 'M3 21v-3M21 21v-3'],
    shop: ['M4 9l1.5-5h13L20 9', 'M4 9h16c0 2-1.5 3-3.2 3S14 11 14 9c0 2-1 3-2 3s-2-1-2-3c0 2-1.3 3-3 3S4 11 4 9z', 'M5.5 12v8h13v-8'],
    ff: ['F:M3 6l8 6-8 6zM12 6l8 6-8 6z'],
    log: ['M5 5h14M5 10h14M5 15h9', 'M16 18l2 2 3-4'],
    skip: ['F:M4 6l8 6-8 6zM13 6l6 6-6 6z', 'M20.5 6v12'],
    star: ['F:M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    lock: ['M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
    door: ['M6 21V4h12v17', 'M3 21h18', ['cf', 14.5, 12.5, 1]],
    chat: ['M4 5h16v11H10l-4 4v-4H4z'],
    person: [['c', 12, 8, 3.8], 'M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6'],
    search: [['c', 10.5, 10.5, 6], 'M15 15l5 5'],
    heal: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', 'M12 10v5M9.5 12.5h5'],
    sun: [['c', 12, 12, 4], () => rays(8, 6.5, 9)],
    up: ['F:M12 5l6 8H6z'],
    down: ['F:M12 19l6-8H6z'],
    // 版 2 で足した物
    key: [['c', 7.5, 8.5, 3.8], 'M10.3 11.3L20 21', 'M15.5 16.5l2.2-2.2M18 19l2-2'],
    lamp: ['M9 3h6M12 3v2', 'M7.5 6.5h9l-1 11h-7z', 'M6.5 20.5h11', 'M8.5 17.5v3M15.5 17.5v3', 'F:M12 9.2c1.4 1.6 2 2.6 2 3.6a2 2 0 0 1-4 0c0-1 .6-2 2-3.6z'],
    spring: ['M4 15.5h16c0 3-3.6 5.5-8 5.5s-8-2.5-8-5.5z', 'M12 13V5', 'M12 5c-2 .5-3.5 2.4-4 5M12 5c2 .5 3.5 2.4 4 5', ['cf', 12, 3.6, 1.1]],
    chest: ['M4 11h16v9H4z', 'M4 11c0-3.5 3-5.5 8-5.5s8 2 8 5.5', 'M4 14h16', 'F:M10.8 12.6h2.4v3.2h-2.4z'],
    secret: ['M4 20V4h16v16', 'M4 9h5M15 9h5M4 14h3M17 14h3M9 4v5M15 4v5', 'M9 20v-5a3 3 0 0 1 6 0v5', 'M3 20h18'],
    fire: ['M12 3c.8 3.6 6 5.8 6 11a6 6 0 0 1-12 0c0-3 1.7-4.3 2.8-6 .2 2 1 3 2.2 3.3C11 9 11 6 12 3z'],
    ice: ['M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', 'M9.8 4.8L12 7l2.2-2.2M9.8 19.2L12 17l2.2 2.2', 'M4.5 10.6l3-.8-.8-3M19.5 13.4l-3 .8.8 3', 'M4.5 13.4l3 .8-.8 3M19.5 10.6l-3-.8.8-3'],
    water: ['M12 3c2.6 3.8 6 7.3 6 11a6 6 0 0 1-12 0c0-3.7 3.4-7.2 6-11z', 'M9 14.5a3 3 0 0 0 3 3'],   // 版 3: 属性の水（しずく）
    thunder: ['M13.5 2.5L5.5 13.5h6l-1.5 8 8.5-11.5h-6z'],
    wind: ['M3 8.5h11a3 3 0 1 0-3-3', 'M3 12.5h15a3 3 0 1 1-3 3', 'M3 16.5h7'],
    earth: ['M2.5 19.5l6.5-10 4 5.5 2.5-3 6 7.5z', 'M7.5 12l1.5 1.5 1.5-1.5'],
    light: ['M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4', 'M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1', 'F:M12 8.2l3.8 3.8-3.8 3.8-3.8-3.8z'],
    dark: ['M15.5 3.5a8.5 8.5 0 1 0 5 13.4A7 7 0 0 1 15.5 3.5z', 'F:M18.5 5.5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5z'],
    repeat: ['M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3', 'M18 3v4h-4M6 21v-4h4'],
    steal: ['M6 11h12l-1 10H7z', 'M9 11V9.5a3 3 0 0 1 6 0V11', 'M12 1.5v7M9.5 6l2.5 2.5L14.5 6'],
  };
  UIK.ICON_NAMES = Object.keys(DEF);

  const cache = {}; // name → [{t:'s'|'f'|'lw', p:Path2D|n}]
  function compile(name) {
    const out = [];
    for (let op of DEF[name]) {
      if (typeof op === 'function') op = op();
      if (typeof op === 'string') {
        const fill = op.indexOf('F:') === 0;
        out.push({ t: fill ? 'f' : 's', p: new Path2D(fill ? op.slice(2) : op) });
      } else if (op[0] === 'lw') out.push({ t: 'lw', n: op[1] });
      else {
        const p = new Path2D(); p.arc(op[1], op[2], op[3], 0, Math.PI * 2);
        out.push({ t: op[0] === 'cf' ? 'f' : 's', p });
      }
    }
    return out;
  }

  UIK.icon = function (g, name, x, y, size, color, o) {
    const s = (size || UIK.u(16)) / 24;
    const col = color || UIK.T.color.text;
    g.save();
    g.translate(x, y); g.scale(s, s);
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = (o && o.lw) || 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
    if (!DEF[name] || typeof Path2D === 'undefined') { g.strokeRect(4, 4, 16, 16); g.restore(); return; }
    const ops = cache[name] || (cache[name] = compile(name));
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.t === 'lw') g.lineWidth = op.n;
      else if (op.t === 'f') g.fill(op.p);
      else g.stroke(op.p);
    }
    g.restore();
  };
  UIK.hasIcon = function (name) { return !!DEF[name]; };
})(window.RPG);
