#!/usr/bin/env node
// TERRAIN: テーマごとの見本のマップ（テストとスクショ用。R.DB.maps には入れず、ページに注入して使う）。V2_PLAN §4.4 の TERRAIN の行
//   const { MAPS } = require('./test_terrain_maps');   MAPS[theme] = K.map の形（id 'tt_<theme>'）
//   node v2/tools/test_terrain_maps.js                 一覧と R.Contract.check('map') の結果
'use strict';

function G(W, H, ch) { const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill(ch)); return g; }
function rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch; }
function put(g, x, y, ch) { if (g[y] && g[y][x] !== undefined) g[y][x] = ch; }
function line(g, pts, ch, w) { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); rect(g, x, y, w || 1, w || 1, ch); } } }
function blob(g, cx, cy, rx, ry, ch, seed) { for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; const wob = Math.sin((x * 7 + y * 13 + (seed || 0)) * 0.9) * 0.18; if (d < 1 + wob) put(g, x, y, ch); } }
const rows = (g) => g.map((r) => r.join(''));
const base = (id, name, kind, theme, g, legend, extra) => Object.assign({ id, name, kind, region: 'prologue', theme, w: g[0].length, h: g.length, legend, rows: rows(g), spawns: { start: { x: 2, y: 2, dir: 's' } } }, extra);

const MAPS = {};

// ---------------------------------------------------------------- 港町（ファロス）: 上の町 → 擁壁と階段 → 板の遊歩道 → 桟橋・海
{
  const W = 34, H = 22, g = G(W, H, '.');
  rect(g, 0, 6, W, 7, '.'); rect(g, 4, 8, 26, 4, '_');
  rect(g, 0, 8, 2, 4, ','); rect(g, 32, 8, 2, 4, ',');
  rect(g, 0, 13, W, 1, 'W'); rect(g, 15, 13, 4, 1, 's');
  rect(g, 0, 14, W, 2, '=');
  rect(g, 0, 16, W, 6, '~');
  rect(g, 6, 16, 2, 5, 'p'); rect(g, 24, 16, 2, 6, 'p'); rect(g, 14, 18, 6, 2, 'p');
  MAPS.harbor = base('tt_harbor', '港町（見本）', 'town', 'harbor', g, {
    '.': { mat: 'cobble' }, '_': { mat: 'stone_floor' }, ',': { mat: 'grass' }, 'W': { mat: 'wall_stone', solid: true, rise: 1 }, 's': { mat: 'stone_floor' },
    '=': { mat: 'plank' }, 'p': { mat: 'pier' }, '~': { mat: 'sea', walk: false },
  }, {
    outside: 'sea', light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' },
    objects: [
      { type: 'building', id: 'h_inn', x: 0, y: 0, w: 8, h: 6, wall: 3, roof: 'slate', mat: 'plaster', door: { x: 3, y: 5 }, windows: 3, sign: 'inn', flowers: true },
      { type: 'building', id: 'h_tavern', x: 9, y: 0, w: 10, h: 6, wall: 3, roof: 'terra', mat: 'stone', door: { x: 14, y: 5 }, windows: 4, sign: 'tavern', hip: true },
      { type: 'building', id: 'h_shop', x: 20, y: 1, w: 6, h: 5, wall: 2, roof: 'slate', mat: 'plaster', door: { x: 24, y: 5 }, windows: 2, sign: 'shop', awning: true },
      { type: 'building', id: 'h_house', x: 27, y: 0, w: 7, h: 6, wall: 3, roof: 'terra', mat: 'plaster', door: { x: 29, y: 5 }, windows: 2 },
      { type: 'prop', id: 'beacon', x: 16, y: 9 },
      ...[[3, 7], [30, 7], [3, 11], [30, 11], [13, 12], [20, 12], [1, 14], [32, 14], [7, 19], [25, 20]].map(([x, y]) => ({ type: 'prop', id: 'lamp_post', x, y })),
      { type: 'prop', id: 'barrel', x: 8, y: 6 }, { type: 'prop', id: 'barrel', x: 19, y: 6 }, { type: 'prop', id: 'crate', x: 18, y: 6 }, { type: 'prop', id: 'board', x: 6, y: 7 },
      { type: 'prop', id: 'stall', x: 22, y: 9 }, { type: 'prop', id: 'stall', x: 26, y: 9 }, { type: 'prop', id: 'bench', x: 10, y: 9 },
      { type: 'prop', id: 'bollard', x: 4, y: 15 }, { type: 'prop', id: 'bollard', x: 11, y: 15 }, { type: 'prop', id: 'bollard', x: 21, y: 15 }, { type: 'prop', id: 'net', x: 28, y: 14 },
      { type: 'prop', id: 'barrel', x: 2, y: 14 }, { type: 'prop', id: 'crate', x: 30, y: 14 },
      { type: 'chest', id: 'h_c1', x: 27, y: 15, item: 'i_potion' },
      { type: 'prop', id: 'rowboat', x: 3, y: 18 }, { type: 'prop', id: 'rowboat', x: 11, y: 20 }, { type: 'prop', id: 'ship', x: 17, y: 17 },
    ],
  });
}

// ---------------------------------------------------------------- 樹上の村（フェルン）: 苔の土・大きな木・樹上の足場とはしご・丸太の家
{
  const W = 34, H = 22, g = G(W, H, '.');
  rect(g, 0, 0, W, 2, 'F'); rect(g, 0, 0, 2, H, 'F'); rect(g, 32, 0, 2, H, 'F'); rect(g, 0, 20, W, 2, 'F');
  line(g, [[2, 12], [12, 12], [16, 16], [31, 16]], ',', 2);
  for (const [x, y] of [[5, 3], [13, 4], [20, 3], [28, 5], [4, 17], [25, 18], [10, 18], [30, 11]]) put(g, x, y, 'T');
  rect(g, 8, 6, 8, 2, '='); rect(g, 15, 8, 2, 4, '='); rect(g, 16, 10, 8, 2, '='); put(g, 7, 7, ':'); put(g, 24, 11, ':');
  rect(g, 21, 13, 3, 1, 'f');
  MAPS.treetop = base('tt_treetop', '樹上の村（見本）', 'town', 'treetop', g, {
    '.': { mat: 'moss_earth' }, ',': { mat: 'dirt' }, 'F': { mat: 'forest_dark', solid: true }, 'T': { mat: 'tree', solid: true },
    '=': { mat: 'deck', deck: true }, ':': { mat: 'ladder', ladder: true }, 'f': { mat: 'flowers' },
  }, {
    outside: 'forest_dark', light: { ambient: '#58689e', k: 0.45, mood: 'forest_night' },
    objects: [
      { type: 'building', id: 'f_inn', x: 3, y: 13, w: 6, h: 4, wall: 2, roof: 'thatch', mat: 'log', door: { x: 5, y: 16 }, windows: 2, sign: 'inn' },
      { type: 'building', id: 'f_house', x: 22, y: 3, w: 5, h: 4, wall: 2, roof: 'thatch', mat: 'log', door: { x: 24, y: 6 }, windows: 1 },
      { type: 'building', id: 'f_hut', x: 18, y: 16, w: 5, h: 4, wall: 2, roof: 'moss', mat: 'bark', door: { x: 20, y: 19 }, windows: 1 },
      { type: 'prop', id: 'lantern', x: 9, y: 6, lv: 1 }, { type: 'prop', id: 'lantern', x: 20, y: 10, lv: 1 }, { type: 'prop', id: 'lantern', x: 12, y: 12 }, { type: 'prop', id: 'lantern', x: 27, y: 15 },
      { type: 'prop', id: 'fence', x: 25, y: 13 }, { type: 'prop', id: 'fence', x: 26, y: 13 }, { type: 'prop', id: 'stump', x: 29, y: 8 }, { type: 'prop', id: 'log', x: 10, y: 15 },
      { type: 'prop', id: 'mushroom_glow', x: 3, y: 9 }, { type: 'prop', id: 'mushroom_glow', x: 30, y: 17 }, { type: 'prop', id: 'barrel', x: 9, y: 16 },
    ],
  });
}

// ---------------------------------------------------------------- 苔の里（ユラ）: 苔の土・敷石の道・苔の石垣・樹皮の家・光る茸
{
  const W = 34, H = 22, g = G(W, H, '.');
  rect(g, 0, 0, W, 2, 'F'); rect(g, 0, 20, W, 2, 'F');
  line(g, [[0, 11], [33, 11]], 'o', 2); line(g, [[16, 2], [16, 19]], 'o', 2);
  rect(g, 2, 15, 10, 1, 'M'); rect(g, 22, 6, 10, 1, 'M');
  for (const [x, y] of [[4, 4], [11, 7], [28, 16], [24, 3], [3, 18], [30, 9]]) put(g, x, y, 'b');
  for (const [x, y] of [[9, 3], [20, 17], [27, 13]]) put(g, x, y, 'T');
  blob(g, 7, 8, 2, 1, '~', 3);
  MAPS.moss_village = base('tt_moss', '苔の里（見本）', 'town', 'moss_village', g, {
    '.': { mat: 'moss_earth' }, 'o': { mat: 'cobble' }, 'F': { mat: 'forest_dark', solid: true }, 'M': { mat: 'wall_moss', solid: true, rise: 1 },
    'b': { mat: 'bush', solid: true }, 'T': { mat: 'tree', solid: true }, '~': { mat: 'water', walk: false },
  }, {
    outside: 'forest_dark', light: { ambient: '#56609a', k: 0.45, mood: 'forest_night' },
    objects: [
      { type: 'building', id: 'y_elder', x: 19, y: 12, w: 7, h: 5, wall: 2, roof: 'moss', mat: 'bark', door: { x: 22, y: 16 }, windows: 2, sign: 'record' },
      { type: 'building', id: 'y_house', x: 3, y: 2, w: 5, h: 4, wall: 2, roof: 'moss', mat: 'stone', door: { x: 5, y: 5 }, windows: 1 },
      { type: 'building', id: 'y_shop', x: 24, y: 1, w: 6, h: 5, wall: 2, roof: 'thatch', mat: 'bark', door: { x: 27, y: 5 }, windows: 2, sign: 'shop' },
      ...[[13, 10], [19, 10], [13, 14], [30, 12]].map(([x, y]) => ({ type: 'prop', id: 'lantern', x, y })),
      ...[[2, 9], [10, 13], [25, 18], [31, 3], [18, 4]].map(([x, y], i) => ({ type: 'prop', id: 'mushroom_glow', x, y, variant: i })),
      { type: 'prop', id: 'well', x: 11, y: 5 }, { type: 'prop', id: 'rock', x: 6, y: 17 }, { type: 'prop', id: 'sack', x: 29, y: 7 }, { type: 'prop', id: 'planter', x: 26, y: 11 },
      { type: 'prop', id: 'songstone', x: 8, y: 11 },
    ],
  });
}

// ---------------------------------------------------------------- 森のダンジョン（迷いの森）: 深い森の壁・草の道・深い草・根・かがり火・泉・宝箱
{
  const W = 34, H = 22, g = G(W, H, 'F');
  line(g, [[1, 10], [9, 10], [12, 5], [22, 5], [25, 12], [33, 12]], ',', 3);
  line(g, [[12, 6], [14, 17], [26, 17]], ',', 3);
  blob(g, 18, 11, 3, 2, ',', 1); blob(g, 5, 16, 3, 2, '"', 2); rect(g, 3, 15, 4, 3, '"'); line(g, [[6, 12], [5, 15]], ',', 2);
  blob(g, 28, 7, 2, 2, '"', 5);
  for (const [x, y] of [[16, 9], [21, 13], [9, 11], [27, 16]]) put(g, x, y, 'R');
  for (const [x, y] of [[11, 8], [24, 6], [19, 16]]) put(g, x, y, 'T');
  MAPS.forest_dungeon = base('tt_forest', '迷いの森（見本）', 'dungeon', 'forest_dungeon', g, {
    ',': { mat: 'grass' }, '"': { mat: 'tall_grass' }, 'F': { mat: 'forest_dark', solid: true }, 'R': { mat: 'roots', solid: true }, 'T': { mat: 'tree', solid: true },
  }, {
    outside: 'forest_dark', light: { ambient: '#4c5890', k: 0.55, mood: 'forest_night' },
    objects: [
      { type: 'spring', id: 'v_s1', x: 17, y: 10 }, { type: 'chest', id: 'v_c1', x: 4, y: 16, item: 'i_potion' }, { type: 'chest', id: 'v_c2', x: 29, y: 12, pool: 'p_rare' },
      { type: 'brazier', id: 'v_b1', x: 13, y: 5 }, { type: 'brazier', id: 'v_b2', x: 22, y: 17, on: true }, { type: 'waylamp', id: 'v_w1', x: 3, y: 9, lit: null },
      { type: 'prop', id: 'mushroom_glow', x: 24, y: 11 }, { type: 'prop', id: 'stump', x: 7, y: 9 }, { type: 'prop', id: 'rock', x: 30, y: 13 },
      { type: 'switch', id: 'v_sw', x: 14, y: 14, flag: 'x', look: 'plate', color: 'teal' },
      { type: 'trail', id: 'v_trail', path: [[26, 16], [27, 16], [28, 17], [29, 17], [30, 17]] },
    ],
  });
}

// ---------------------------------------------------------------- 樹の中（千年樹）: 樹の壁・樹の床・根の床・根・水たまり・光る茸
{
  const W = 34, H = 22, g = G(W, H, 'B');
  blob(g, 10, 10, 7, 6, '.', 1); blob(g, 24, 9, 7, 5, '.', 2); rect(g, 15, 9, 5, 3, '.'); blob(g, 20, 17, 5, 2, 'r', 3); rect(g, 17, 13, 3, 3, 'r');
  blob(g, 26, 10, 2, 1, '~', 1);
  for (const [x, y] of [[7, 8], [13, 12], [22, 7], [28, 12]]) put(g, x, y, 'R');
  rect(g, 4, 10, 2, 2, 'r');
  MAPS.tree_inside = base('tt_tree', '千年樹の中（見本）', 'dungeon', 'tree_inside', g, {
    '.': { mat: 'bark_floor' }, 'r': { mat: 'root_floor' }, 'B': { mat: 'wall_bark', solid: true, rise: 1 }, 'R': { mat: 'roots', solid: true }, '~': { mat: 'water', walk: false },
  }, {
    outside: 'wall_bark', light: { ambient: '#5a6c8a', k: 0.66, mood: 'tree' },
    objects: [
      ...[[5, 7], [11, 14], [21, 10], [29, 8], [18, 18], [14, 7]].map(([x, y], i) => ({ type: 'prop', id: 'mushroom_glow', x, y, variant: i })),
      { type: 'prop', id: 'crystal', x: 26, y: 12 }, { type: 'chest', id: 't_c1', x: 9, y: 6, item: 'i_potion' }, { type: 'stairs', id: 't_up', x: 22, y: 18, look: 'up' },
      { type: 'brazier', id: 't_b', x: 16, y: 9, on: true },
    ],
  });
}

// ---------------------------------------------------------------- 灯台: 石の壁・敷石・敷物・階段・かがり火・本棚・隠し通路
{
  const W = 34, H = 22, g = G(W, H, 'W');
  rect(g, 4, 3, 26, 16, '.'); rect(g, 13, 8, 8, 6, 'c'); rect(g, 15, 3, 1, 5, 'W'); rect(g, 15, 14, 1, 5, 'W'); put(g, 15, 5, 'S');
  rect(g, 22, 3, 1, 7, 'W'); rect(g, 22, 12, 1, 7, 'W');
  MAPS.lighthouse = base('tt_lighthouse', '灯台（見本）', 'dungeon', 'lighthouse', g, {
    '.': { mat: 'stone_floor' }, 'c': { mat: 'carpet' }, 'W': { mat: 'wall_stone', solid: true, rise: 1 }, 'S': { mat: 'wall_stone', solid: true, secret: true, floor: 'stone_floor' },
  }, {
    outside: 'wall_stone', light: { ambient: '#6c62ac', k: 0.55, mood: 'tower' },
    objects: [
      { type: 'stairs', id: 'l_up', x: 27, y: 4, look: 'up' }, { type: 'stairs', id: 'l_dn', x: 6, y: 16, look: 'down' },
      { type: 'brazier', id: 'l_b1', x: 10, y: 4, on: true }, { type: 'brazier', id: 'l_b2', x: 19, y: 16 }, { type: 'prop', id: 'torch', x: 25, y: 14 },
      { type: 'prop', id: 'bookshelf', x: 5, y: 3 }, { type: 'prop', id: 'bookshelf', x: 7, y: 3 }, { type: 'prop', id: 'barrel', x: 28, y: 17 }, { type: 'prop', id: 'crate', x: 27, y: 17 },
      { type: 'prop', id: 'table', x: 17, y: 10 }, { type: 'prop', id: 'chair', x: 16, y: 11 }, { type: 'chest', id: 'l_c1', x: 11, y: 17, item: 'i_potion' }, { type: 'spring', id: 'l_s', x: 25, y: 7 },
    ],
  });
}

// ---------------------------------------------------------------- 洞窟: 洞窟の壁・床・水・結晶・泉・宝箱・松明
{
  const W = 34, H = 22, g = G(W, H, '#');
  blob(g, 9, 9, 7, 6, '.', 1); blob(g, 24, 11, 8, 7, '.', 2); rect(g, 14, 9, 6, 4, '.'); blob(g, 16, 17, 5, 3, '.', 3);
  blob(g, 18, 5, 2, 2, '~', 4); blob(g, 26, 15, 3, 2, '~', 5); rect(g, 12, 14, 1, 1, '#');
  put(g, 20, 13, '#'); put(g, 21, 13, '#');
  MAPS.cave = base('tt_cave', '洞窟（見本）', 'dungeon', 'cave', g, {
    '.': { mat: 'cave_floor' }, '#': { mat: 'wall_cave', solid: true, rise: 1 }, '~': { mat: 'water', walk: false },
  }, {
    outside: 'wall_cave', light: { ambient: '#7a6abc', k: 0.63, mood: 'cave' },
    objects: [
      { type: 'spring', id: 'c_s', x: 7, y: 8 }, { type: 'chest', id: 'c_c1', x: 28, y: 9, item: 'i_potion' }, { type: 'chest', id: 'c_c2', x: 4, y: 12, item: 'i_potion' },
      ...[[13, 6], [29, 13], [19, 18]].map(([x, y], i) => ({ type: 'prop', id: 'crystal', x, y, variant: i })),
      ...[[6, 4], [22, 5], [30, 8]].map(([x, y]) => ({ type: 'prop', id: 'torch', x, y })),
      { type: 'prop', id: 'rock', x: 11, y: 12 }, { type: 'prop', id: 'rock_small', x: 23, y: 12 }, { type: 'stairs', id: 'c_dn', x: 25, y: 7, look: 'down' },
    ],
  });
}

// ---------------------------------------------------------------- ワールド: 草原・街道・森・崖・川と橋・浜・海・村・道しるべの灯籠
{
  const W = 34, H = 22, g = G(W, H, ',');
  rect(g, 0, 0, 12, 7, 'h'); rect(g, 0, 7, 12, 1, 'C'); put(g, 5, 7, 'r');
  rect(g, 0, 0, 7, 5, 'T'); rect(g, 1, 12, 7, 6, 'T'); rect(g, 22, 0, 4, 4, 'T'); blob(g, 15, 18, 3, 2, 'T', 2);
  line(g, [[18, 0], [18, 4], [20, 8], [19, 12], [21, 16], [21, 21]], '~', 2);
  line(g, [[0, 10], [33, 10]], 'r', 1); line(g, [[5, 5], [5, 10]], 'r', 1); line(g, [[28, 3], [28, 10]], 'r', 1);
  rect(g, 19, 10, 3, 1, 'b');
  for (let y = 13; y < H; y++) for (let x = 0; x < W; x++) { const d = x - (y - 13) * 1.6 - 22; if (d > 1) put(g, x, y, '~'); else if (d > -1.5) put(g, x, y, 's'); }
  rect(g, 26, 0, 8, 7, '.');
  MAPS.world = base('tt_world', 'ワールド（見本）', 'world', 'world', g, {
    ',': { mat: 'grass' }, 'h': { mat: 'grass' }, 'C': { mat: 'cliff', solid: true, rise: 1 }, 'T': { mat: 'tree', solid: true }, '~': { mat: 'water', walk: false },
    'r': { mat: 'road' }, 'b': { mat: 'bridge' }, 's': { mat: 'sand' }, '.': { mat: 'dirt' },
  }, {
    outside: 'grass', light: { ambient: '#7c6cca', k: 0.45, mood: 'night' },
    objects: [
      { type: 'building', id: 'w_v1', x: 26, y: 0, w: 4, h: 3, wall: 1, roof: 'terra', mat: 'plaster', door: { x: 27, y: 2 }, windows: 1 },
      { type: 'building', id: 'w_v2', x: 30, y: 1, w: 4, h: 3, wall: 1, roof: 'slate', mat: 'stone', door: { x: 32, y: 3 }, windows: 1 },
      { type: 'building', id: 'w_v3', x: 26, y: 4, w: 3, h: 2, wall: 1, roof: 'slate', mat: 'plank', door: { x: 27, y: 5 }, windows: 1 },
      ...[[8, 9], [15, 9], [24, 11], [31, 9]].map(([x, y], i) => ({ type: 'waylamp', id: 'wl_' + i, x, y, lit: i < 3 ? null : 'never' })),
      { type: 'prop', id: 'tent', x: 9, y: 3 }, { type: 'prop', id: 'rock', x: 14, y: 14 }, { type: 'prop', id: 'rock_small', x: 25, y: 13 },
      { type: 'prop', id: 'lamp_post', x: 29, y: 6 },
    ],
  });
  // 灯籠: lit が null ならともっている扱い（o.lit == null は条件なし → R.State.check が無ければ偽になるので、見本では lamps で点ける）
  MAPS.world.lamps = { wl_0: true, wl_1: true, wl_2: true };
}

// ---------------------------------------------------------------- 丘の里（ロア）: 草・土の道・花・漆喰の家・柵・井戸・木
{
  const W = 34, H = 22, g = G(W, H, ',');
  line(g, [[0, 12], [10, 12], [14, 9], [33, 9]], '.', 2); line(g, [[14, 9], [14, 21]], '.', 2);
  blob(g, 26, 16, 4, 2, 'f', 1); blob(g, 5, 4, 3, 2, 'f', 2);
  for (const [x, y] of [[2, 16], [8, 18], [31, 3], [20, 19], [29, 12], [1, 8]]) put(g, x, y, 'T');
  rect(g, 0, 20, W, 2, 'C'); rect(g, 0, 21, W, 1, '~');
  MAPS.hill_village = base('tt_hill', '丘の里（見本）', 'town', 'hill_village', g, {
    ',': { mat: 'grass' }, '.': { mat: 'dirt' }, 'f': { mat: 'flowers' }, 'T': { mat: 'tree', solid: true }, 'C': { mat: 'cliff', solid: true, rise: 1 }, '~': { mat: 'sea', walk: false },
  }, {
    outside: 'grass', light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night' },
    objects: [
      { type: 'building', id: 'r_berna', x: 17, y: 2, w: 7, h: 5, wall: 2, roof: 'terra', mat: 'plaster', door: { x: 20, y: 6 }, windows: 2, flowers: true },
      { type: 'building', id: 'r_house1', x: 3, y: 13, w: 6, h: 4, wall: 2, roof: 'thatch', mat: 'plank', door: { x: 5, y: 16 }, windows: 2 },
      { type: 'building', id: 'r_house2', x: 25, y: 2, w: 6, h: 5, wall: 2, roof: 'slate', mat: 'stone', door: { x: 27, y: 6 }, windows: 2 },
      { type: 'prop', id: 'well', x: 11, y: 7 }, { type: 'prop', id: 'fence', x: 17, y: 12 }, { type: 'prop', id: 'fence', x: 18, y: 12 }, { type: 'prop', id: 'fence', x: 19, y: 12 },
      { type: 'prop', id: 'hay', x: 22, y: 13 }, { type: 'prop', id: 'barrel', x: 24, y: 7 }, { type: 'prop', id: 'flower_pot', x: 16, y: 7 }, { type: 'prop', id: 'signboard', x: 12, y: 11 },
      ...[[10, 11], [16, 10], [23, 10], [31, 10], [13, 16]].map(([x, y]) => ({ type: 'prop', id: 'lamp_post', x, y })),
      { type: 'prop', id: 'grave', x: 6, y: 9 }, { type: 'prop', id: 'bench', x: 8, y: 8 },
    ],
  });
}

// 宝箱 × 8 種の床（WORLD_REDESIGN §6.3。開けた箱も）
{
  const floors = ['grass', 'moss_earth', 'dirt', 'cobble', 'stone_floor', 'wood_floor', 'cave_floor', 'bark_floor'];
  const W = 30, H = 12, g = G(W, H, 'x');
  const legend = { x: { mat: 'wall_stone', solid: true } };
  const objects = [];
  floors.forEach((f, i) => {
    const ch = String.fromCharCode(97 + i);
    legend[ch] = { mat: f };
    const x0 = 1 + (i % 4) * 7, y0 = 1 + Math.floor(i / 4) * 5;
    rect(g, x0, y0, 6, 4, ch);
    objects.push({ type: 'chest', id: 'ch_' + f + '_c', x: x0 + 1, y: y0 + 1, item: 'i_potion' }, { type: 'chest', id: 'ch_' + f + '_o', x: x0 + 3, y: y0 + 1, item: 'i_potion' }, { type: 'chest', id: 'ch_' + f + '_r', x: x0 + 4, y: y0 + 2, pool: 'p_rare' });
  });
  MAPS.chests = base('tt_chests', '宝箱と床（見本）', 'dungeon', 'lighthouse', g, legend, { outside: 'wall_stone', light: { ambient: '#6c62ac', k: 0.55, mood: 'tower' }, objects, opened: floors.map((f) => 'ch_' + f + '_o') });
  MAPS.chests.floors = floors;
}

// 泉・燭台（消えた／ともった）・灯籠（消えた／ともった）
{
  const W = 30, H = 9, g = G(W, H, '.');
  rect(g, 0, 0, W, 1, '#'); rect(g, 0, 8, W, 1, '#');
  MAPS.lights = base('tt_lights', '泉と灯り（見本）', 'dungeon', 'cave', g, { '.': { mat: 'cave_floor' }, '#': { mat: 'wall_cave', solid: true } }, {
    outside: 'wall_cave', light: { ambient: '#7a6abc', k: 0.6, mood: 'cave' },
    objects: [
      { type: 'spring', id: 'L_s', x: 3, y: 3 },
      { type: 'brazier', id: 'L_b0', x: 9, y: 4 }, { type: 'brazier', id: 'L_b1', x: 12, y: 4, on: true },
      { type: 'waylamp', id: 'L_w0', x: 16, y: 4 }, { type: 'waylamp', id: 'L_w1', x: 19, y: 4 },
      { type: 'switch', id: 'L_sw0', x: 23, y: 4, flag: 'no_flag', look: 'lever', color: 'gold' }, { type: 'prop', id: 'torch', x: 26, y: 4 },
    ],
  });
  MAPS.lights.lamps = { L_w1: true };
}

module.exports = { MAPS, THEMES9: ['harbor', 'treetop', 'moss_village', 'forest_dungeon', 'tree_inside', 'lighthouse', 'cave', 'world', 'hill_village'] };

if (require.main === module) {
  const R = require('./lib/load')({ quiet: true });
  for (const k of Object.keys(MAPS)) { const r = R.Contract.check('map', MAPS[k]); console.log(`${r.ok ? 'ok  ' : 'BAD '} ${k.padEnd(15)} ${MAPS[k].w}x${MAPS[k].h} theme=${R.Terrain.theme(MAPS[k]).id}`, r.ok ? '' : r.errors.slice(0, 3)); }
}
