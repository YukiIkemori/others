// FIELD のテストとスクショ用のマップ（id は field_ で始める。本物の地図は CONTENT-P・F が書く。V2_PLAN §4.4 の FIELD の行）
// dev_test_field_fx.html だけに入る（node v2/tools/build.js --with v2/tools/test_field_fx）。node のテストは load({extra}) で読む。
//   field_pharos  港町（町・桟橋・街灯・建物・NPC の歩き回り）       field_fern   樹上の村（2 つの高さ: 足場とはしご）
//   field_verda   迷いの森（ダンジョン・暗がりの広場・燭台・泉・隠し通路・一方通行の段差・足あと）
//   field_world   ワールド（街道・道しるべの灯籠・森・川）             field_lighthouse  灯台 1 階（屋内のダンジョン・階段・泉・隠し通路）
//   field_lab     試験場（node の試験で座標を決め打ちする小さなマップ）
(function (R) {
  'use strict';
  function G(w, h, ch) { const a = []; for (let y = 0; y < h; y++) a.push(new Array(w).fill(ch)); return a; }
  function rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[j].length) g[j][i] = ch; }
  function put(g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch; }
  function border(g, ch) { const h = g.length, w = g[0].length; rect(g, 0, 0, w, 1, ch); rect(g, 0, h - 1, w, 1, ch); rect(g, 0, 0, 1, h, ch); rect(g, w - 1, 0, 1, h, ch); }
  function rows(g) { return g.map((r) => r.join('')); }
  function blob(g, cx, cy, rx, ry, ch, seed) {
    const rng = R.rng('blob' + seed);
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
      if (d < 1 - rng.next() * 0.25) put(g, x, y, ch);
    }
  }
  function path(g, pts, ch, wdt) {
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
      while (x !== x2 || y !== y2) {
        rect(g, x, y, wdt || 1, wdt || 1, ch);
        if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y);
      }
      rect(g, x, y, wdt || 1, wdt || 1, ch);
    }
  }
  const def = (id, m) => { m.id = id; m.rows = rows(m.rows); m.h = m.rows.length; m.w = m.rows[0].length; R.def('maps', id, m); };

  // ================================================================ 港町（町、48×34）
  (function () {
    const g = G(48, 34, 'c');
    rect(g, 0, 0, 48, 2, '#');                 // 上の町の奥の壁
    rect(g, 0, 21, 48, 2, 'W');                // 擁壁
    rect(g, 21, 21, 6, 2, 'e');                // 階段
    rect(g, 0, 23, 48, 5, 'p');                // 遊歩道（板）
    rect(g, 0, 28, 48, 6, '~');                // 海
    rect(g, 8, 28, 4, 5, 'p'); rect(g, 30, 28, 5, 6, 'p');   // 桟橋
    rect(g, 0, 2, 2, 19, ','); rect(g, 46, 2, 2, 19, ',');
    rect(g, 1, 11, 1, 3, 'c');                 // 西の出口
    const legend = {
      c: { mat: 'cobble' }, ',': { mat: 'grass' }, '#': { mat: 'wall_stone', solid: true, rise: 1 }, W: { mat: 'wall_stone', solid: true, rise: 1 },
      e: { mat: 'stone_floor', name: 'stairs' }, p: { mat: 'pier' }, '~': { mat: 'sea', walk: false },
    };
    const b = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'plaster', windows: 2 }, o);
    const objects = [
      b('ph_inn', 3, 2, 8, 5, { door: { x: 6, y: 6, to: { map: 'field_pharos', spawn: 'plaza' } }, sign: 'inn', lamp: true, windows: 3 }),
      b('ph_tavern', 13, 2, 9, 5, { door: { x: 17, y: 6, to: { map: 'field_pharos', spawn: 'plaza' } }, sign: 'tavern', lamp: true, windows: 3, roof: 'terra' }),
      b('ph_shop', 25, 2, 7, 5, { door: { x: 28, y: 6, to: { map: 'field_pharos', spawn: 'plaza' } }, sign: 'shop', lamp: true }),
      b('ph_house1', 35, 2, 6, 5, { door: { x: 37, y: 6, to: { map: 'field_pharos', spawn: 'plaza' } } }),
      b('ph_house2', 41, 2, 5, 5, { door: { x: 43, y: 6, to: { map: 'field_pharos', spawn: 'plaza' } }, roof: 'terra' }),
      { type: 'prop', id: 'lamp_post', x: 4, y: 9 }, { type: 'prop', id: 'lamp_post', x: 44, y: 9 }, { type: 'prop', id: 'lamp_post', x: 4, y: 19 },
      { type: 'prop', id: 'lamp_post', x: 44, y: 19 }, { type: 'prop', id: 'lamp_post', x: 18, y: 18 }, { type: 'prop', id: 'lamp_post', x: 30, y: 18 },
      { type: 'prop', id: 'lamp_post', x: 24, y: 13 },
      { type: 'prop', id: 'lamp_post', x: 6, y: 25 }, { type: 'prop', id: 'lamp_post', x: 24, y: 25 }, { type: 'prop', id: 'lamp_post', x: 42, y: 25 },
      { type: 'prop', id: 'barrel', x: 12, y: 8 }, { type: 'prop', id: 'barrel', x: 33, y: 8 }, { type: 'prop', id: 'crate', x: 34, y: 8 },
      { type: 'prop', id: 'bench', x: 21, y: 15 }, { type: 'prop', id: 'bench', x: 27, y: 15 }, { type: 'prop', id: 'flower_pot', x: 10, y: 8 },
      { type: 'prop', id: 'crate', x: 14, y: 25 }, { type: 'prop', id: 'barrel', x: 15, y: 25 }, { type: 'prop', id: 'sack', x: 38, y: 24 },
      { type: 'sign', x: 8, y: 12, text: '港町ファロス\n西へ行けば、街道。' },
      { type: 'chest', id: 'ph_c1', x: 45, y: 24, item: 'i_potion', n: 2 },
    ];
    const npcs = [
      { id: 'ph_hanna', look: 'npc_hanna', name: 'ハンナ', x: 23, y: 16, dir: 's', move: 'still', talk: { lines: [{ text: '灯台の火が消えて、もう三晩になるわ。' }] }, reward: 'news', key: 'ph_hanna' },
      { id: 'ph_sailor', look: 'npc_sailor_1', x: 32, y: 25, dir: 'w', move: 'wander', talk: { lines: [{ text: '潮の具合がおかしいんだ。' }] }, key: 'ph_sailor' },
      { id: 'ph_child', look: 'npc_child_2', x: 12, y: 14, dir: 'e', move: { route: [[12, 14], [18, 14], [18, 12], [12, 12]], wait: 900 }, talk: { lines: [{ text: 'ねえ、灯台って本当に光るの？' }] } },
      { id: 'ph_guard', look: 'npc_guard_1', x: 2, y: 10, dir: 'e', move: 'still', pushable: false, talk: { lines: [{ text: '西は街道だ。夜は気をつけろ。' }] } },
    ];
    def('field_pharos', {
      name: '港町ファロス', kind: 'town', region: 'prologue', location: 'field_pharos', legend, rows: g, outside: 'sea', objects, npcs,
      spawns: { plaza: { x: 24, y: 16, dir: 's' }, gate_w: { x: 2, y: 12, dir: 'e' }, pier: { x: 24, y: 25, dir: 'n' } },
      exits: [{ x: 0, y: 11, w: 1, h: 3, to: { map: 'field_world', spawn: 'pharos' } }],
      light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' }, bgm: 'town', theme: 'harbor', meta: { sub: '潮風と灯台の町' },
    });
  })();

  // ================================================================ 樹上の村（町、40×30。足場 = lv 1、はしご）
  (function () {
    const g = G(40, 30, '.');
    border(g, 'T');
    rect(g, 0, 0, 40, 3, 'T'); rect(g, 0, 27, 40, 3, 'T');
    blob(g, 5, 8, 3, 3, 'T', 1); blob(g, 34, 22, 4, 3, 'T', 2); blob(g, 33, 6, 3, 2, 'T', 3);
    rect(g, 10, 8, 20, 6, '=');                // 足場（樹上の広場）
    put(g, 9, 11, ':'); put(g, 30, 10, ':');   // はしご
    path(g, [[19, 3], [19, 26]], ',', 2);      // 足場の下をくぐる道（草）
    rect(g, 10, 8, 20, 6, '=');
    rect(g, 0, 18, 1, 3, '.');                 // 西の出口
    const legend = {
      '.': { mat: 'moss_earth' }, ',': { mat: 'grass' }, T: { mat: 'tree', solid: true }, '=': { mat: 'plank', deck: true }, ':': { mat: 'ladder', ladder: true },
    };
    def('field_fern', {
      name: '森の村フェルン', kind: 'town', region: 'r_forest', location: 'field_fern', legend, rows: g, outside: 'forest_dark',
      objects: [
        { type: 'prop', id: 'lantern', x: 12, y: 8, lv: 1 }, { type: 'prop', id: 'lantern', x: 27, y: 8, lv: 1 }, { type: 'prop', id: 'lamp_post', x: 7, y: 20 },
        { type: 'prop', id: 'lamp_post', x: 24, y: 22 }, { type: 'prop', id: 'mushroom_glow', x: 15, y: 20 }, { type: 'prop', id: 'stump', x: 26, y: 18 },
        { type: 'sign', x: 17, y: 16, text: '捜索隊、求む。' },
      ],
      npcs: [
        { id: 'fe_rita', look: 'npc_rita', name: 'リタ', x: 20, y: 10, lv: 1, dir: 's', move: 'still', talk: { lines: [{ text: '樵の三人が、森から戻らないの。' }] }, reward: 'lead', key: 'fe_rita' },
        { id: 'fe_gord', look: 'npc_gord', name: 'ゴード', x: 14, y: 20, dir: 'e', move: 'wander', talk: { lines: [{ text: '捜索隊を集めておる。' }] }, key: 'fe_gord' },
      ],
      spawns: { gate_w: { x: 1, y: 19, dir: 'e' }, square: { x: 20, y: 11, lv: 1, dir: 's' }, under: { x: 19, y: 18, dir: 'n' } },
      exits: [{ x: 0, y: 18, w: 1, h: 3, to: { map: 'field_world', spawn: 'fern' } }],
      light: { ambient: '#5a6aa0', k: 0.5, mood: 'forest_night' }, bgm: 'village', theme: 'treetop', meta: { sub: '樹上の村', underDeck: 'moss_earth' },
    });
  })();

  // ================================================================ 迷いの森（ダンジョン、56×44）
  (function () {
    const g = G(56, 44, 'T');
    // 広場と小道
    blob(g, 8, 36, 6, 5, '.', 11); blob(g, 22, 30, 7, 5, '.', 12); blob(g, 12, 18, 6, 5, '.', 13);
    blob(g, 30, 14, 6, 4, '.', 14); blob(g, 44, 12, 8, 7, '.', 15); blob(g, 44, 32, 7, 6, '.', 16);
    path(g, [[8, 36], [22, 30], [12, 18], [30, 14], [44, 12]], ',', 2);
    path(g, [[22, 30], [44, 32]], ',', 2);
    path(g, [[4, 40], [4, 43]], '.', 3);       // 入口（南西）
    rect(g, 18, 19, 7, 5, '.'); rect(g, 20, 24, 5, 2, ',');   // 北の広場から南へ下りる段差（一方通行、南へだけ）
    rect(g, 26, 20, 4, 3, '.'); put(g, 25, 21, 'S');   // 隠し通路の先の小部屋（見た目は周りの木と同じ）
    const legend = {
      '.': { mat: 'moss_earth' }, ',': { mat: 'dirt' }, T: { mat: 'tree', solid: true }, S: { mat: 'tree', solid: true, secret: true, floor: 'moss_earth' },
    };
    def('field_verda', {
      name: '迷いの森', kind: 'dungeon', region: 'r_forest', location: 'field_verda', legend, rows: g, outside: 'forest_dark',
      objects: [
        { type: 'spring', id: 'fv_s1', x: 21, y: 29 },
        { type: 'chest', id: 'fv_c1', x: 9, y: 16, pool: 'p_T' }, { type: 'chest', id: 'fv_c2', x: 48, y: 9, pool: 'p_rare' },
        { type: 'chest', id: 'fv_c3', x: 28, y: 21, item: 'i_potion', n: 1 }, { type: 'chest', id: 'fv_c4', x: 46, y: 34, gold: 120 },
        { type: 'brazier', id: 'fv_b1', x: 40, y: 9 }, { type: 'brazier', id: 'fv_b2', x: 48, y: 15 }, { type: 'brazier', id: 'fv_b3', x: 42, y: 16 },
        { type: 'trail', id: 'fv_pim', path: [[12, 19], [14, 18], [16, 18], [18, 17], [20, 16], [22, 16], [24, 15], [26, 15]], cond: 'field_hat' },
        { type: 'prop', id: 'mushroom_glow', x: 6, y: 34 }, { type: 'prop', id: 'mushroom_glow', x: 26, y: 31 }, { type: 'prop', id: 'firefly', x: 11, y: 20 },
        { type: 'prop', id: 'rock_small', x: 24, y: 33 }, { type: 'prop', id: 'stump', x: 33, y: 13 },
      ],
      npcs: [{ id: 'fv_hans', look: 'npc_hans', name: 'ハンス', x: 46, y: 12, dir: 'w', move: 'still', talk: { lines: [{ text: '助かった……暗くて動けなかったんだ。' }] }, key: 'fv_hans' }],
      spawns: { entry: { x: 4, y: 41, dir: 'n' }, glade: { x: 44, y: 12, dir: 'w' }, spring: { x: 22, y: 32, dir: 'n' } },
      exits: [{ x: 3, y: 43, w: 3, h: 1, to: { map: 'field_world', spawn: 'verda' } }],
      oneway: [{ x: 20, y: 24, dir: 's' }, { x: 21, y: 24, dir: 's' }, { x: 22, y: 24, dir: 's' }, { x: 23, y: 24, dir: 's' }, { x: 24, y: 24, dir: 's' }],
      zones: [{ rect: null, zone: 'z_stub' }],
      dark: [{ rect: [34, 4, 21, 16] }],
      light: { ambient: '#4a5a90', k: 0.5, mood: 'forest_night' }, bgm: 'forest', bbg: 'forest', theme: 'forest_dungeon', meta: { floor: '1 階' },
    });
  })();

  // ================================================================ ワールド（80×50）
  (function () {
    const g = G(80, 50, ',');
    border(g, 'T');
    blob(g, 14, 12, 10, 7, 'T', 21); blob(g, 60, 36, 12, 8, 'T', 22); blob(g, 40, 8, 8, 4, 'T', 23); blob(g, 20, 40, 7, 5, 'T', 24);
    path(g, [[66, 1], [66, 10], [74, 20], [74, 30]], '~', 3);   // 川
    rect(g, 70, 42, 10, 8, '~');
    blob(g, 30, 26, 4, 3, '#', 25);
    path(g, [[72, 25], [58, 25], [58, 18], [40, 18], [30, 18], [20, 26], [8, 26], [8, 34]], 'r', 2);   // 街道
    rect(g, 70, 24, 3, 3, 'r');
    const legend = { ',': { mat: 'grass' }, r: { mat: 'road' }, T: { mat: 'tree', solid: true }, '~': { mat: 'water', walk: false }, '#': { mat: 'cliff', solid: true, rise: 1 } };
    const wl = (id, x, y, lit) => ({ type: 'waylamp', id, x, y, lit });
    def('field_world', {
      name: 'ファロス街道', kind: 'world', region: 'prologue', location: 'field_world', legend, rows: g, outside: 'forest_dark',
      objects: [
        wl('fw_l1', 64, 23, { slice: true }), wl('fw_l2', 56, 20, { slice: true }), wl('fw_l3', 46, 17, { slice: true }), wl('fw_l4', 36, 20, 'field_never'),
        wl('fw_l5', 26, 23, 'field_never'), wl('fw_l6', 14, 24, { slice: true }),
        { type: 'sign', x: 60, y: 27, text: '東 ファロス ／ 西 フェルン' },
        { type: 'prop', id: 'rock_small', x: 50, y: 22 }, { type: 'prop', id: 'flower_pot', x: 44, y: 21 },
      ],
      npcs: [],
      spawns: { pharos: { x: 71, y: 25, dir: 'w' }, fern: { x: 8, y: 33, dir: 'n' }, verda: { x: 9, y: 28, dir: 'e' }, road: { x: 50, y: 18, dir: 'w' } },
      exits: [
        { x: 72, y: 24, w: 1, h: 3, to: { map: 'field_pharos', spawn: 'gate_w' } },
        { x: 8, y: 35, w: 2, h: 1, to: { map: 'field_fern', spawn: 'gate_w' } },
      ],
      zones: [{ rect: null, zone: 'z_stub' }],
      light: { ambient: '#7c6cca', k: 0.4, mood: 'night' }, bgm: 'overworld', theme: 'world', meta: { sub: '西の森へ続く道' },
    });
  })();

  // ================================================================ 灯台 1 階（ダンジョン、32×26）
  (function () {
    const g = G(32, 26, '#');
    rect(g, 2, 2, 28, 22, '.');
    rect(g, 12, 2, 1, 14, '#'); rect(g, 12, 18, 1, 6, '#');   // 仕切り
    rect(g, 20, 8, 10, 1, '#'); rect(g, 20, 8, 1, 10, '#');
    put(g, 12, 10, 'S');                                        // 隠し通路
    rect(g, 3, 20, 3, 3, '~');
    const legend = { '.': { mat: 'stone_floor' }, '#': { mat: 'wall_stone', solid: true, rise: 1 }, S: { mat: 'wall_stone', solid: true, secret: true, floor: 'stone_floor' }, '~': { mat: 'shallow', walk: false } };
    def('field_lighthouse', {
      name: 'ファロス灯台', kind: 'dungeon', region: 'prologue', location: 'field_lighthouse', legend, rows: g, outside: 'wall_stone',
      objects: [
        { type: 'stairs', x: 26, y: 4, to: { map: 'field_lighthouse', spawn: 'entry' } },
        { type: 'spring', id: 'fl_s1', x: 16, y: 18 },
        { type: 'chest', id: 'fl_c1', x: 4, y: 4, pool: 'p_T' }, { type: 'chest', id: 'fl_c2', x: 24, y: 12, item: 'i_potion' },
        { type: 'brazier', id: 'fl_b1', x: 8, y: 12 }, { type: 'prop', id: 'crate', x: 15, y: 4 }, { type: 'prop', id: 'barrel', x: 16, y: 4 },
      ],
      npcs: [],
      spawns: { entry: { x: 7, y: 22, dir: 'n' } },
      exits: [{ x: 7, y: 23, w: 1, h: 1, to: { map: 'field_world', spawn: 'road' } }],
      zones: [{ rect: null, zone: 'z_stub' }],
      light: { ambient: '#6a60b0', k: 0.45, mood: 'tower' }, bgm: 'tower', theme: 'lighthouse', meta: { floor: '1 階' },
    });
  })();

  // ================================================================ 試験場（node の試験、24×16）
  (function () {
    const g = G(24, 16, '.');
    border(g, '#');
    put(g, 5, 3, '#');                 // (4,4) から北東へ: 東 (5,4) は空き、北 (4,3) は空き、(5,3) が壁 → 斜めは角を切らないので止まる／滑る
    rect(g, 8, 2, 1, 6, '#');          // 縦の壁（壁沿いの滑り）
    put(g, 8, 5, 'S');                 // 隠し通路
    rect(g, 14, 2, 6, 3, '=');         // 足場
    put(g, 13, 3, ':');                // はしご
    rect(g, 2, 12, 5, 1, ',');         // 一方通行の段差（南へ）
    rect(g, 17, 10, 5, 4, '~');
    const legend = { '.': { mat: 'moss_earth' }, ',': { mat: 'dirt' }, '#': { mat: 'rock', solid: true, rise: 1 }, S: { mat: 'rock', solid: true, secret: true, floor: 'moss_earth' },
      '=': { mat: 'plank', deck: true }, ':': { mat: 'ladder', ladder: true }, '~': { mat: 'water', walk: false } };
    def('field_lab', {
      name: '試験場', kind: 'dungeon', region: 'prologue', location: 'field_lab', legend, rows: g, outside: 'rock',
      objects: [
        { type: 'spring', id: 'lab_s', x: 2, y: 2 },
        { type: 'waylamp', id: 'lab_wl', x: 22, y: 14, lit: { slice: true } },
        { type: 'chest', id: 'lab_c', x: 10, y: 10, gold: 50 },
        { type: 'brazier', id: 'lab_b', x: 12, y: 12 },
        { type: 'switch', id: 'lab_sw', x: 11, y: 7, flag: 'lab_sw', look: 'plate' },
      ],
      npcs: [
        { id: 'lab_push', look: 'npc_man_1', x: 4, y: 8, dir: 's', move: 'still', talk: { lines: [{ text: 'おっと。' }] } },
        { id: 'lab_rock', look: 'npc_guard_1', x: 6, y: 8, dir: 's', move: 'still', pushable: false, talk: { lines: [{ text: '動かんぞ。' }] } },
      ],
      spawns: { a: { x: 4, y: 4, dir: 's' } },
      exits: [],
      triggers: [
        { id: 'every', on: 'enter', event: 'field_lab_enter' }, { id: 'first', on: 'enter', event: 'field_lab_once', once: true },
        { id: 'plate', on: 'step', x: 10, y: 4, event: 'field_lab_step', once: true },
      ],
      oneway: [{ x: 2, y: 12, dir: 's' }, { x: 3, y: 12, dir: 's' }, { x: 4, y: 12, dir: 's' }, { x: 5, y: 12, dir: 's' }, { x: 6, y: 12, dir: 's' }],
      zones: [{ rect: null, zone: 'z_stub' }],
      dark: [{ rect: [9, 8, 14, 7] }],
      light: { ambient: '#5c5aa0', k: 0.45, mood: 'cave' }, bgm: 'cave', meta: {},
    });
  })();

  // 試験場のトリガーのイベント（数えるだけ）
  const C = (R._fieldLab = R._fieldLab || { enter: 0, once: 0, step: 0 });
  R.def('events', 'field_lab_enter', { async run() { C.enter++; }, meta: { needs: [], gives: [], calls: [] } });
  R.def('events', 'field_lab_once', { async run() { C.once++; }, meta: { needs: [], gives: [], calls: [] } });
  R.def('events', 'field_lab_step', { async run() { C.step++; }, meta: { needs: [], gives: [], calls: [] } });

  // 場所（ワープの一覧用）
  const L = (id, name, kind, map, spawn, region) => R.def('locations', id, { name, region: region || 'prologue', kind, map, spawn });
  L('field_pharos', '港町ファロス', 'town', 'field_pharos', 'plaza');
  L('field_fern', '森の村フェルン', 'town', 'field_fern', 'gate_w', 'r_forest');
  L('field_verda', '迷いの森', 'dungeon', 'field_verda', 'entry', 'r_forest');
  L('field_lighthouse', 'ファロス灯台', 'dungeon', 'field_lighthouse', 'entry');
  L('field_world', 'ファロス街道', 'place', 'field_world', 'road');
  L('field_lab', '試験場', 'dungeon', 'field_lab', 'a');
  // 手がかり（目印の札の見本）
  R.def('leads', 'l_field_demo', { title: '森で人が消える', text: '西の森で、樵の三人が戻らない。', region: 'r_forest', place: 'フェルン', dir: 'w', kind: 'main' });
})(window.RPG);
