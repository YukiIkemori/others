#!/usr/bin/env node
// CONTENT-P: ワールドの生成器（V2_PLAN §3.2 の world、WORLD_REDESIGN §2）。→ v2/src/maps/world.js（生成物。手で直さない）
//
//   node v2/tools/gen_world.js            生成して書く（同じ入力なら同じ出力）
//   node v2/tools/gen_world.js --check    書かずに検査だけ（歩ける数・到達・閉じ方・30 歩の空白）
//   node v2/tools/gen_world.js --ascii x0 y0 x1 y1   その範囲を文字で出す（目で見る用）
//
// 作り方:
//   1. 見取り図（WORLD_REDESIGN §2.3、1 字 = 8×8 マス、28×24）を 224×192 に広げる（座標をノイズでゆがめて海岸線を自然に）。
//   2. 縦切りの範囲（ファロス半島・北の野・ヴェルダの森）を上から描き直す: 陸の形・尾根（他の地方との境）・街道と小道・町の入口・寄り道。
//   3. 物（道しるべの灯籠・看板・野営の跡・光る苔と蛍・岩）と、町の入口の建物・出口・spawn・出現表・閉じ方（DB.config.slice の崖崩れと番人）。
//   4. 検査: 縦切りの範囲の歩けるマスの数、全部の入口に着く、閉じ方で外へ出られない、30 歩の円に何も無い道のマス 0。
//
// 縦切りだけの閉じ方（V2_PLAN §3.2 の最後）: 北（雪原へ）・東（山地へ）・南（砂漠へ）の街道の峠に、cond {slice:true} の tilePatch（崩れた岩）と
//   番人（cond {slice:true} の NPC）。見えない壁は使わない。序章の間は跳ね橋が上がっている（cond '!prologue_done' の tilePatch と番人）。
'use strict';
const fs = require('fs');
const path = require('path');

const W = 224, H = 192;
const OUT = path.join(__dirname, '..', 'src', 'maps', 'world.js');

// ------------------------------------------------------------------ 乱数とノイズ（種つき）
function h2(x, y, s) {
  let h = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1442695041, 1274126177);
  h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const sm = (t) => t * t * (3 - 2 * t);
function vn(x, y, L, s) {
  x /= L; y /= L;
  const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = h2(i, j, s), b = h2(i + 1, j, s), c = h2(i, j + 1, s), d = h2(i + 1, j + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const fbm = (x, y, L, s) => vn(x, y, L, s) * 0.6 + vn(x, y, L / 2, s + 7) * 0.3 + vn(x, y, L / 4, s + 13) * 0.1;

// ------------------------------------------------------------------ 見取り図（WORLD_REDESIGN §2.3）
const SKETCH = [
  '::::::::::::::::::::::::::::',
  ':::NNN+:::::::::::::::::::::',
  '::NNNNN~~:::::::::::::::::::',
  '::::~SSSSSSMMMMMMMAAAAAA::::',
  ':::~SSaSS+SMMbMMM+AAcAAAA:::',
  ':::~SSSSSSSMMMMM+MAAAA+AAA::',
  ':::~S+SSSS..MM+MMMAAAAA+AA::',
  '::~~~FFF......~~~~AAAAAWW:::',
  '::~FFFFFF..~~~~~~~~~WWWWWW:E',
  ':%~FFdFF+~=~~~~~~~~~~WWeWW:E',
  ':%%~F+FFF~P~~~~+~~~~~W+WWW:E',
  ':%:~FFFFF~Pj~~~CC~~~~WWWWW~+',
  ':%:~FFF+F~kP~~~ClC~~+~WW+W~:',
  '::~~FFFF~~PP+~~CC~~~~~WWWW~:',
  '::~DDDDD~~~~~~~~~~~~~~~==~~:',
  '::~DDfDD+DDD~~~~~~~~~HHHHH~:',
  ':::DDDDDDDDDHHHHHHHHHHgHH~::',
  ':::D+DDDDDDDHHH+HHHHHHHHH~::',
  ':::DDDD+DDDDHHHHHH+HHHH~~:::',
  '::::DDDDDDD~~HHHHHHHH~~:::::',
  ':::::::~~~~~~~~~~~~~~~::IIII',
  '::::::::::::::::::::::IhII+I',
  ':::::::::::::::+::::::IIiI::',
  '::::::::::::::::::::::::::::',
];
const LAND = { N: 'n', S: 'n', M: 'd', A: ',', F: 'h', P: ',', W: 'h', D: 's', H: 'a', I: ',', C: ',', E: ',', '.': ',' };

// ------------------------------------------------------------------ 格子
const g = [];
for (let y = 0; y < H; y++) g.push(new Array(W).fill('O'));
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const get = (x, y) => (inB(x, y) ? g[y][x] : 'O');
const set = (x, y, c) => { if (inB(x, y)) g[y][x] = c; };
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };

function sketchAt(x, y) {
  const r = SKETCH[Math.max(0, Math.min(23, Math.floor(y / 8)))];
  return r[Math.max(0, Math.min(27, Math.floor(x / 8)))];
}
function landOf(ch, x, y) {
  if (ch === ':' || ch === '%') return 'O';
  if (ch === '~' || ch === '=') return '~';
  if (LAND[ch]) return LAND[ch];
  // 町の小文字・'+' は周りの陸
  for (const [dx, dy] of [[-8, 0], [8, 0], [0, -8], [0, 8]]) { const c = sketchAt(x + dx, y + dy); if (LAND[c]) return LAND[c]; }
  return ',';
}

// 1. 見取り図から（座標をゆがめて）
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const wx = x + (fbm(x, y, 14, 11) - 0.5) * 12, wy = y + (fbm(x, y, 14, 23) - 0.5) * 12;
  const ch = sketchAt(wx, wy);
  let c = landOf(ch, wx, wy);
  if (c === '~' && ch === '~') {
    // 外洋に接する浅い海は '~'、見取り図の ':' は外洋
  }
  const n = fbm(x, y, 9, 31);
  if (c === 'n' && n > 0.62) c = 'T';
  if (c === 'd' && n > 0.55) c = 'm';
  if (c === 'a' && n > 0.66) c = 'm';
  if (c === 'h' && ch === 'W' && n > 0.6) c = 'w';
  if (c === ',' && (ch === 'A' || ch === 'I') && n > 0.7) c = 'd';
  set(x, y, c);
}
// 陸の縁に砂浜（海に接する草地）
function beaches(x0, y0, x1, y1) {
  const add = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const c = get(x, y);
    if (!',h'.includes(c)) continue;
    let sea = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('~O'.includes(get(x + dx, y + dy))) sea = true;
    if (sea) add.push([x, y]);
  }
  for (const [x, y] of add) set(x, y, 's');
}

// ------------------------------------------------------------------ 2. 縦切りの範囲を描き直す
const BOX = { x0: 6, y0: 40, x1: 118, y1: 134 };
// 陸の形
const pen = (x, y) => {
  const n = (fbm(x, y, 7, 41) - 0.5) * 0.35;
  const a = ((x - 91) / 20) ** 2 + ((y - 101) / 21) ** 2;
  const c = ((x - 93) / 17) ** 2 + ((y - 86) / 8) ** 2;
  const b = ((x - 104) / 7.5) ** 2 + ((y - 123) / 6.5) ** 2;
  return a < 1 + n || b < 1 + n || c < 1 + n;
};
const forest = (x, y) => x >= 12 + (fbm(x, y, 8, 43) - 0.5) * 6 && x <= 62 + (fbm(x, y, 8, 47) - 0.5) * 4 && y >= 44 && y <= 121;
const plains = (x, y) => x >= 58 && x <= 115 && y >= 44 && y <= 71 - (x > 60 && x < 112 ? 0 : 0) + ((fbm(x, y, 6, 53) - 0.5) * 2 | 0);
for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) {
  let c;
  if (pen(x, y) && y >= 78) c = ',';
  else if (plains(x, y) && y <= 71) c = ',';
  else if (forest(x, y)) c = 'h';
  else if (x >= 63 && y >= 72) c = '~';
  else if (y > 121 || y < 44 || x > 115) continue;   // 見取り図のまま（砂漠・雪原・山地）
  else c = x < 16 ? '~' : 'h';
  set(x, y, c);
}
// 西の海岸（森の西は内海）
for (let y = 44; y <= 121; y++) for (let x = BOX.x0; x < 22; x++) if (!forest(x, y)) set(x, y, x < 10 ? 'O' : '~');

// 尾根（他の地方との境。峠の道だけ空く）
function ridge(pts, wd, seed) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
      for (let j = -wd; j <= wd; j++) for (let q = -wd; q <= wd; q++) {
        if (Math.abs(j) + Math.abs(q) > wd + (h2(x + q, y + j, seed) > 0.5 ? 1 : 0)) continue;
        const c = get(x + q, y + j);
        if (c === 'O' || c === '~') continue;
        set(x + q, y + j, h2(x + q, y + j, seed + 1) > 0.35 ? 'm' : 'c');
      }
    }
  }
}
ridge([[10, 46], [36, 45], [62, 46], [90, 47], [116, 46]], 2, 101);    // 北（雪原・山地との境）
ridge([[114, 46], [114, 60], [113, 72]], 2, 103);                       // 東（山地との境）
ridge([[12, 119], [36, 120], [62, 119]], 2, 107);                        // 南（砂漠との境）
set(10, 46, 'm');

// 北の野の南の海岸と、半島の北の海岸のあいだの海峡（y 72〜77）
for (let x = 63; x <= 115; x++) for (let y = 72; y <= 77; y++) set(x, y, '~');
// 森と半島のあいだの水路
for (let y = 72; y <= 134; y++) for (let x = 63; x <= 70; x++) set(x, y, '~');

// 森の中: 地面の変化と木
for (let y = 44; y <= 121; y++) for (let x = 12; x <= 64; x++) {
  if (get(x, y) !== 'h') continue;
  const n = fbm(x, y, 10, 61), m = fbm(x, y, 5, 67), r = h2(x, y, 71);
  let c = m > 0.6 ? ',' : m < 0.32 ? ';' : 'h';
  if (n > 0.64) c = 'F';
  else if (n > 0.5 && r < 0.3) c = 'T';
  else if (r < 0.05) c = 'T';
  set(x, y, c);
}
// 北の野: 草・花・木立
for (let y = 44; y <= 71; y++) for (let x = 58; x <= 115; x++) {
  if (get(x, y) !== ',') continue;
  const n = fbm(x, y, 9, 81), m = fbm(x, y, 5, 83), r = h2(x, y, 85);
  let c = m > 0.72 ? '"' : m < 0.3 ? ';' : ',';
  if (n > 0.7) c = 'T';
  else if (r < 0.025) c = 'T';
  else if (r > 0.99) c = 'm';
  set(x, y, c);
}
// 半島: 草・花・林
for (let y = 78; y <= 134; y++) for (let x = 70; x <= 116; x++) {
  if (get(x, y) !== ',') continue;
  const n = fbm(x, y, 8, 91), m = fbm(x, y, 5, 93), r = h2(x, y, 95);
  let c = m > 0.72 ? '"' : m < 0.3 ? ';' : ',';
  if (n > 0.72) c = 'T';
  else if (r < 0.02) c = 'T';
  else if (r > 0.992) c = 'm';
  set(x, y, c);
}
beaches(66, 76, 116, 134);
beaches(58, 64, 116, 71);

// ------------------------------------------------------------------ 道
const ROADS = [];     // {pts, wd, ch, zone}
function road(pts, o) {
  o = o || {};
  const wd = o.wd || 2, ch = o.ch || '.';
  ROADS.push({ pts, wd, ch, zone: o.zone });
  for (let i = 0; i < pts.length - 1; i++) {
    let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
    const paint = () => { for (let j = 0; j < wd; j++) for (let q = 0; q < wd; q++) { const c = get(x + q, y + j); if (c !== '=' && c !== 'w') set(x + q, y + j, ch); } };
    paint();
    while (x !== x2 || y !== y2) { if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y); paint(); }
  }
}
/** 道の両側 margin マスの木・岩をどける（通りを空ける） */
function clearAround(pts, wd, margin) {
  for (let i = 0; i < pts.length - 1; i++) {
    let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
    const clr = () => { for (let j = -margin; j < wd + margin; j++) for (let q = -margin; q < wd + margin; q++) { const c = get(x + q, y + j); if ('TFbm'.includes(c)) set(x + q, y + j, h2(x + q, y + j, 5) > 0.5 ? ',' : 'h'); } };
    clr();
    while (x !== x2 || y !== y2) { if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y); clr(); }
  }
}
function clearing(cx, cy, r, ch) {
  for (let y = cy - r - 1; y <= cy + r + 1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
    const d = Math.hypot(x - cx, y - cy) + (h2(x, y, 9) - 0.5) * 1.2;
    if (d <= r && !'~Ow.'.includes(get(x, y))) set(x, y, ch || (h2(x, y, 11) > 0.6 ? '"' : ','));
  }
}

// 地名の座標（下の物・出口・spawn が使う）
const PL = {
  bridge: { x: 86, y: 71, w: 3, h: 8 },          // 跳ね橋（x 86〜88、y 71〜78）
  nj: [87, 83],                                   // 半島の北の分かれ道
  well: [76, 86],                                 // 古井戸の下り口
  lookout: [100, 80],                             // 見晴らし台の古い灯籠
  roaGate: [82, 91],                              // ロアの門（出口）
  pharosGate: [100, 108],                         // ファロスの門（出口）
  lighthouse: [106, 124],                         // 灯台の扉
  junction: [87, 63],                             // 北の野の分かれ道
  hutDoor: [68, 61],                              // 樵の休み小屋の戸口
  fernS: [44, 81], fernN: [44, 71],               // フェルンの南の門・北の門
  verda: [33, 107],                               // 迷いの森の入口
  yura: [26, 59],                                 // ユラの入口
  windhill: [40, 54],                             // 風鳴りの丘
  acorn: [55, 104],                               // 森の南の広場（どんぐり王子）
  passN: [38, 44], passE: [113, 61], passS: [31, 118],   // 峠（縦切りでは閉じる）
  twin: [53, 113],                                // 双子の見張り塔（あとで）
  elder: [24, 84],                                // 千年樹（森の上に突き出す巨木。入口は迷いの森の中）
};

// 半島の道
road([[87, 79], [87, 91], [87, 98], [92, 98], [92, 105], [97, 105], [97, 108], [99, 108]], { zone: null });   // 橋 → 分かれ道 → ロアの前 → ファロス
road([[87, 83], [80, 83], [80, 86], [77, 86]], { wd: 1, ch: 'd' });                                         // 分かれ道 → 古井戸
road([[88, 83], [100, 83], [100, 81]], { wd: 1, ch: 'd' });                                        // 分かれ道 → 見晴らし台
road([[83, 91], [87, 91]], { wd: 2 });                                                                       // ロアの門
road([[97, 109], [95, 109], [95, 117], [100, 117], [100, 120], [104, 120], [104, 126], [106, 126]], { wd: 1, ch: 'd' });   // ファロス → 灯台
// 北の野と森の街道
road([[86, 71], [86, 63], [74, 63], [74, 66], [64, 66], [64, 70], [56, 70], [56, 77], [50, 77], [50, 82], [44, 82]], { zone: 'road' });
road([[88, 63], [111, 63], [115, 63]], { zone: 'road' });                                                   // 東の峠へ（縦切りでは崖崩れ）
road([[68, 62], [68, 63]], { wd: 1, ch: 'd' });                                                              // 休み小屋の戸口
// 森の小道
road([[44, 83], [44, 86], [50, 86], [50, 95], [42, 95], [42, 101], [33, 101], [33, 106]], { wd: 1, ch: 'd', zone: 'road' });   // フェルン → 迷いの森
road([[50, 95], [55, 95], [55, 101]], { wd: 1, ch: 'd' });                                                   // どんぐりの広場へ
road([[42, 101], [42, 112], [31, 112], [31, 121]], { wd: 2, zone: 'road' });                               // 南の街道（砂漠へ。峠で閉じる）
road([[42, 112], [51, 112], [51, 114]], { wd: 1, ch: 'd' });                                                 // 双子の見張り塔（あとで）
road([[44, 70], [44, 62], [40, 62], [40, 56], [38, 56], [38, 42]], { wd: 1, ch: 'd', zone: 'road' });      // 北の小道（風鳴りの丘・北の峠）
road([[40, 62], [34, 62], [34, 58], [27, 58], [27, 59]], { wd: 1, ch: 'd' });                              // ユラへの獣道
for (const r of ROADS) clearAround(r.pts, r.wd, r.wd === 2 ? 1 : 1);
// 広場・町の前
clearing(87, 64, 3); clearing(87, 84, 3); clearing(44, 84, 3); clearing(44, 69, 3); clearing(33, 104, 3); clearing(55, 104, 4, '"');
clearing(40, 54, 3); clearing(27, 59, 3); clearing(68, 60, 3); clearing(78, 86, 2); clearing(100, 81, 2); clearing(99, 108, 2);
clearing(106, 125, 2); clearing(52, 114, 2);
// 道を塗り直す（広場で消えた所）
for (const r of ROADS.slice()) road(r.pts, { wd: r.wd, ch: r.ch });
ROADS.length = ROADS.length / 2;

// 跳ね橋（序章の間は上がっている = tilePatch）
rect(86, 71, 3, 8, '=');
// 見晴らし台: 小さな岩の段（南から上る）
for (const [x, y] of [[98, 79], [102, 79], [99, 78], [101, 78], [100, 78], [97, 80], [103, 80]]) if (!'~O'.includes(get(x, y))) set(x, y, 'm');
// 峠の道の岩をどける（尾根を道が抜ける所）
for (const [x, y, w, h] of [[37, 40, 3, 8], [110, 62, 6, 3], [30, 116, 3, 7]]) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if ('mc'.includes(get(i, j))) set(i, j, '.');
// 千年樹のまわりは深い森（入口は迷いの森の中。ワールドからは梢だけが見える）
for (let y = 78; y <= 90; y++) for (let x = 18; x <= 30; x++) if (Math.hypot(x - 24, y - 84) < 6.5) set(x, y, 'F');
for (let y = 82; y <= 86; y++) for (let x = 22; x <= 26; x++) set(x, y, 'h');
// フェルン・ロア・ファロス・ユラの町の塊（ワールドの上の建物の下は歩けない土地）
function townBlock(x, y, w, h, c) { rect(x, y, w, h, c || 'h'); }
townBlock(39, 72, 11, 9, 'h');     // フェルン（x 39〜49、y 72〜80）
townBlock(74, 87, 8, 8, ',');      // ロア（x 74〜81、y 87〜94）
townBlock(101, 104, 9, 10, ',');   // ファロス（x 101〜109、y 104〜113）
townBlock(19, 55, 7, 8, 'h');      // ユラ（x 19〜25、y 55〜62）

// ------------------------------------------------------------------ 3. 物
const objects = [], npcs = [], exits = [], triggers = [], tilePatches = [];
const spawns = {};
const P = (id, x, y, o) => objects.push(Object.assign({ type: 'prop', id, x, y }, o || {}));
const B = (id, x, y, w, h, o) => objects.push(Object.assign({ type: 'building', id, x, y, w, h, wall: 1, roof: 'slate', mat: 'plaster', windows: 1, small: true }, o || {}));
const S = (x, y, text) => objects.push({ type: 'sign', x, y, text });
const LAMP = (id, x, y, lit, o) => objects.push(Object.assign({ type: 'waylamp', id, x, y, lit }, o || {}));
const solidAt = (x, y) => objects.some((o) => o.x === x && o.y === y);

// --- 町の入口（建物の見た目。中へは出口から）
// ロア（丘の上の小さな里）
B('w_roa1', 74, 87, 3, 3, { roof: 'thatch', mat: 'plaster', lamp: true }); B('w_roa2', 78, 87, 3, 3, { roof: 'moss', mat: 'log' });
B('w_roa3', 75, 91, 4, 3, { roof: 'thatch', mat: 'log', lamp: true, chimney: true });
P('lamp_post', 81, 90); P('lamp_post', 81, 93); P('tree', 80, 94);
exits.push({ x: PL.roaGate[0], y: PL.roaGate[1], w: 1, h: 2, to: { map: 'roa', spawn: 'gate' } });
spawns.roa = { x: 84, y: 91, dir: 'e' };
S(84, 89, 'ロアの里\n語り部の里。');
// ファロス（港町。灯台の光）
B('w_ph1', 102, 104, 4, 3, { roof: 'terra', mat: 'plaster', lamp: true }); B('w_ph2', 106, 104, 3, 3, { roof: 'slate', mat: 'brick' });
B('w_ph3', 102, 110, 4, 3, { roof: 'slate', mat: 'stone', lamp: true }); B('w_ph4', 106, 109, 4, 4, { roof: 'terra', mat: 'plaster', chimney: true });
P('lamp_post', 101, 107); P('lamp_post', 101, 110); P('ship', 111, 111); P('lantern', 110, 106);
exits.push({ x: PL.pharosGate[0], y: PL.pharosGate[1], w: 1, h: 2, to: { map: 'pharos', spawn: 'gate_w' } });
spawns.pharos = { x: 98, y: 108, dir: 'w' };
S(98, 110, '港町ファロス');
// 灯台（岬の先）
B('w_lighthouse', 105, 121, 3, 4, { roof: 'slate', mat: 'stone', wall: 3, windows: 1, small: false, door: { x: 106, y: 124, to: { map: 'lighthouse_1', spawn: 'entrance' } } });
P('beacon', 106, 120, { cond: 'prologue_boss' });
spawns.lighthouse = { x: 106, y: 126, dir: 'n' };
S(104, 127, 'ファロス灯台');
// 古井戸（下り口）
objects.push({ type: 'stairs', x: PL.well[0], y: PL.well[1], to: { map: 'well', spawn: 'entrance' } });
P('well', 75, 86); P('rock_small', 75, 88); P('rock_small', 78, 88);
spawns.well = { x: 77, y: 86, dir: 'e' };
S(79, 85, '旅人の古井戸\n枯れ井戸。底へ下りる縄ばしごがある。');
// 見晴らし台（古い灯籠。依頼 q_pharos_lamp でともす）
LAMP('wl_pen_lookout', 100, 80, 'prologue_lamp_lookout', { event: 'world_pen_lamp' });
S(98, 81, '見晴らし台\n半島の北の海を見わたす。');
P('bench', 102, 81);
// 跳ね橋
spawns.bridge_s = { x: 87, y: 80, dir: 'n' };
spawns.bridge_n = { x: 87, y: 69, dir: 's' };
tilePatches.push({ cond: '!prologue_done', rect: [86, 72, 3, 6], rows: ['~~~', '~~~', '~~~', '~~~', '~~~', '~~~'] });
npcs.push({ id: 'bridge_guard', look: 'npc_guard_2', name: '橋番', x: 89, y: 79, dir: 'w', move: 'still', pushable: false, talk: 'world_bridge_guard', reward: 'news', key: 'world_bridge_guard' });
P('lamp_post', 85, 79); P('lamp_post', 89, 70); P('bollard', 85, 70);
// 北の野の分かれ道
S(89, 61, '北の野の分かれ道\n西 … ヴェルダの森・フェルン\n東 … ガルド山地\n南 … 跳ね橋・ファロス半島');
// 樵の休み小屋（#1）
B('w_hut', 66, 58, 4, 4, { roof: 'shingle', mat: 'log', lamp: true, chimney: true, small: false, door: { x: PL.hutDoor[0], y: PL.hutDoor[1], to: { map: 'hut', spawn: 'door' } } });
P('log', 65, 62); P('stump', 71, 60); P('crate', 70, 62);
spawns.hut = { x: 68, y: 62, dir: 's' };
// フェルン（樹上の村の入口）
B('w_fern1', 39, 73, 4, 3, { roof: 'moss', mat: 'log', lamp: true }); B('w_fern2', 45, 72, 4, 3, { roof: 'bark', mat: 'bark', lamp: true });
B('w_fern3', 41, 77, 3, 3, { roof: 'moss', mat: 'bark' }); B('w_fern4', 46, 77, 3, 3, { roof: 'moss', mat: 'log', lamp: true });
P('tree_giant', 44, 75); P('lantern', 43, 80); P('lantern', 46, 80); P('lantern', 43, 72); P('lantern', 46, 71);
exits.push({ x: PL.fernS[0], y: PL.fernS[1], w: 1, h: 1, to: { map: 'fern', spawn: 'gate_s' } });
exits.push({ x: PL.fernN[0], y: PL.fernN[1], w: 1, h: 1, to: { map: 'fern', spawn: 'gate_n' } });
set(PL.fernS[0], PL.fernS[1], 'd'); set(PL.fernN[0], PL.fernN[1], 'd');
spawns.fern_s = { x: 44, y: 83, dir: 's' }; spawns.fern_n = { x: 44, y: 69, dir: 'n' };
S(46, 84, '森の村フェルン');
// 迷いの森（入口。木のアーチ）
exits.push({ x: PL.verda[0], y: PL.verda[1], w: 1, h: 1, to: { map: 'verda_1', spawn: 'entrance' } });
set(PL.verda[0], PL.verda[1], 'd');
for (const [x, y] of [[31, 107], [35, 107], [31, 108], [32, 108], [34, 108], [35, 108]]) set(x, y, 'F');
set(33, 108, 'F');
P('tree_giant', 32, 106); P('tree_giant', 34, 106);
spawns.verda = { x: 33, y: 105, dir: 'n' };
S(35, 104, '迷いの森\n森が道を変えるという。');
// ユラ（隠れ里。獣道の先の小さな灯り）
B('w_yura1', 19, 56, 3, 3, { roof: 'moss', mat: 'log' }); B('w_yura2', 22, 58, 3, 3, { roof: 'moss', mat: 'bark', lamp: true });
P('lantern', 25, 57); P('lantern', 25, 61);
exits.push({ x: PL.yura[0], y: PL.yura[1], w: 1, h: 1, to: { map: 'yura', spawn: 'gate' } });
set(PL.yura[0], PL.yura[1], 'd');
spawns.yura = { x: 28, y: 59, dir: 'e' };
for (const [x, y] of [[30, 58], [32, 60], [35, 59]]) P('lantern', x, y);
// 千年樹（ワールドからは梢。森の解決で光の柱）
P('tree_giant', 24, 84); P('tree_giant', 23, 83); P('tree_giant', 25, 83);
P('beacon', 24, 82, { cond: 'cleared_r_forest' });
// 風鳴りの丘（#2）
for (const [x, y] of [[38, 53], [42, 53], [39, 52], [41, 55]]) set(x, y, 'm');
P('rock', 40, 52); objects.push({ type: 'examine', x: 40, y: 53, event: 'windhill_notes' }); P('signboard', 42, 55);
S(41, 57, '風鳴りの丘\n風が歌のように鳴るという。');
// どんぐりの広場（森の南の広場。レア魔物のうわさ）
P('stump', 55, 103); P('mushroom_glow', 53, 105); P('mushroom_glow', 58, 104); P('firefly', 56, 102);
S(53, 101, '森の南の広場');
// 双子の見張り塔（あとで。縦切りでは立ち入り禁止の看板だけ。WORLD_REDESIGN §2.7-5）
P('fence', 50, 115); P('fence', 51, 115); P('fence', 52, 115); P('fence', 53, 115);
S(53, 114, '双子の見張り塔\n修理中につき、立ち入り禁止。');
// TODO(CONTENT-F / リード): 双子の見張り塔（optional_twin*）を入れると決まったら、この看板を出口 {map:'twin_a1', spawn:'entrance'} に替える。

// --- 縦切りだけの閉じ方（崖崩れと番人。cond {slice:true}）
function closure(id, x, y, w, h, guard, text) {
  const rows = []; for (let j = 0; j < h; j++) rows.push('m'.repeat(w));
  tilePatches.push({ cond: { slice: true }, rect: [x, y, w, h], rows });
  npcs.push(Object.assign({ id, look: 'npc_guard_1', name: '番人', move: 'still', pushable: false, cond: { slice: true }, talk: { lines: [{ text }] }, reward: 'news', key: 'world_' + id }, guard));
}
closure('guard_north', 37, 42, 3, 3, { x: 39, y: 46, dir: 'n' }, ['この先の峠は、崖崩れで\nふさがっておる。', '北の雪原へ行くのは、\n道が片づくまで待ってくれ。']);
closure('guard_east', 112, 62, 3, 3, { x: 110, y: 64, dir: 'e' }, ['東の峠は、ゆうべの\n崖崩れで通れないんだ。', '山地の鉱山町へ行くなら、\nしばらく待ってくれ。']);
closure('guard_south', 30, 119, 3, 3, { x: 33, y: 117, dir: 's' }, ['南の砂漠へ抜ける峠は、\n崖崩れでふさがってるよ。', '片づくまでは、\n森を回ってくれ。']);

// --- 道しるべの灯籠（街道に 28〜34 歩ごと。縦切りの消えた灯籠: 半島 1・森 3）
const LIT = true;
let lampN = 0;
function lampsAlong(pts, every, side, skip) {
  let acc = 0, k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
    while (x !== x2 || y !== y2) {
      if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y);
      acc++;
      if (acc >= every) {
        const horiz = x !== x2;
        let placed = false;
        for (const sd of [side, -side]) for (const off of [2, 3, 1]) {
          if (placed) break;
          const ox = x + (horiz ? 0 : sd * off), oy = y + (horiz ? sd * off : 0);
          const c = get(ox, oy);
          if (!'~Ow=.dmcTFbs'.includes(c) && !solidAt(ox, oy)) {
            k++;
            if (!(skip && skip.includes(k))) LAMP('wl_' + (++lampN), ox, oy, LIT);
            acc = 0; placed = true;
          }
        }
      }
    }
  }
}
lampsAlong([[86, 63], [74, 63], [74, 66], [64, 66], [64, 70], [56, 70], [56, 77], [50, 77], [50, 82], [44, 82]], 12, -1, []);
lampsAlong([[88, 63], [111, 63]], 11, 1);
lampsAlong([[87, 79], [87, 91], [87, 98], [92, 98], [92, 105], [97, 105]], 11, 1);
lampsAlong([[42, 101], [42, 112], [31, 112], [31, 117]], 11, 1);
lampsAlong([[44, 70], [44, 62], [40, 62], [40, 56], [38, 56], [38, 47]], 10, 1);
lampsAlong([[44, 83], [44, 86], [50, 86], [50, 95], [42, 95], [42, 101], [33, 101]], 12, -1);
// P3 の消えた灯籠（ロアからファロスへの夜道。依頼 q_pharos_lamp でともす）
LAMP('wl_pen_road', 89, 96, 'prologue_lamp_road', { event: 'world_pen_lamp' });
// 【灯りを守る】森の街道の消えた灯籠 3 つ（q_forest_fireflies、CONTENT-F。lit は依頼の条件、調べると forest_waylamp）
LAMP('wl_forest_1', 72, 65, 'q_forest_fireflies_1', { event: 'forest_waylamp' });
LAMP('wl_forest_2', 62, 72, 'q_forest_fireflies_2', { event: 'forest_waylamp' });
LAMP('wl_forest_3', 52, 80, 'q_forest_fireflies_3', { event: 'forest_waylamp' });
// 近すぎる灯籠を間引く（消えた灯籠のそば 8 マスの ともった灯籠は外す）
for (let i = objects.length - 1; i >= 0; i--) {
  const o = objects[i];
  if (o.type !== 'waylamp' || o.lit !== true) continue;
  if (objects.some((q) => q !== o && q.type === 'waylamp' && q.lit !== true && Math.hypot(q.x - o.x, q.y - o.y) < 8)) objects.splice(i, 1);
}

// --- 野営の跡・旅人（景色の目印）
function camp(x, y) { P('tent', x, y); P('lantern', x + 1, y + 1); P('log', x - 1, y + 1); }
camp(96, 57); camp(58, 90); camp(25, 70); camp(96, 124 - 9);
npcs.push({ id: 'traveler_plains', look: 'npc_merchant_2', name: '旅の行商人', x: 97, y: 59, dir: 's', move: 'still', talk: 'world_traveler_plains', reward: 'news', key: 'world_traveler_plains' });
npcs.push({ id: 'woodcutter_road', look: 'npc_woodcutter_1', name: '樵', x: 59, y: 91, dir: 'w', move: 'still', talk: 'world_woodcutter', reward: 'hint', key: 'world_woodcutter' });
npcs.push({ id: 'shepherd', look: 'npc_old_m_2', name: '羊飼いの年寄り', x: 93, y: 93, dir: 'w', move: 'still', cond: 'prologue_done', talk: 'world_shepherd', reward: 'news', key: 'world_shepherd' });

// --- 景色の飾り（森の光る苔・蛍、野の岩・切り株）。道と出口には置かない
function freeFor(x, y) {
  const c = get(x, y);
  if (!',;"hs'.includes(c)) return false;
  if (solidAt(x, y)) return false;
  for (const e of exits) if (x >= e.x - 1 && x <= e.x + e.w && y >= e.y - 1 && y <= e.y + e.h) return false;
  for (const n of npcs) if (Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1) return false;
  for (const k of Object.keys(spawns)) if (Math.abs(spawns[k].x - x) <= 1 && Math.abs(spawns[k].y - y) <= 1) return false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('.d='.includes(get(x + dx, y + dy))) return false;
  return true;
}
for (let y = 44; y <= 130; y++) for (let x = 12; x <= 116; x++) {
  if (!freeFor(x, y)) continue;
  const r = h2(x, y, 201), inForest = x <= 64 && y >= 44 && y <= 121;
  if (inForest) {
    if (r < 0.018) P('mushroom_glow', x, y);
    else if (r < 0.03) P('firefly', x, y);
    else if (r < 0.037) P('stump', x, y);
    else if (r < 0.042) P('log', x, y);
    else if (r < 0.05) P('rock_small', x, y);
  } else {
    if (r < 0.012) P('rock_small', x, y);
    else if (r < 0.018) P('firefly', x, y);
    else if (r < 0.022) P('stump', x, y);
    else if (r < 0.026) P('rock', x, y);
  }
}

// ------------------------------------------------------------------ 出現表（上から最初に合う物。V2_PLAN §3.6）
const zones = [];
zones.push({ rect: [72, 86, 30, 26], zone: 'zw_prologue' });                       // ロア〜ファロスの夜道（仲間を選ぶ前に歩く）
zones.push({ rect: [66, 72, 52, 63], zone: 'zw_peninsula' });                      // 半島の残り（北・灯台の岬）
zones.push({ rect: [58, 40, 60, 32], zone: 'zw_forest_road' });                    // 北の野（街道と同じ率）
for (const r of ROADS) {
  if (r.zone !== 'road') continue;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
    zones.push({ rect: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + r.wd, Math.abs(y1 - y0) + r.wd], zone: 'zw_forest_road' });
  }
}
zones.push({ rect: [8, 40, 58, 84], zone: 'zw_forest' });                          // 森の原野

// ------------------------------------------------------------------ 地名（HUD の場所の名前と副題。FIELD に依頼中の meta.areas）
const areas = [
  { rect: [66, 72, 52, 63], name: 'ファロス半島', sub: '灯台の岬と牧草地' },
  { rect: [58, 40, 60, 32], name: '北の野', sub: '半島と森をつなぐ街道' },
  { rect: [8, 40, 58, 84], name: 'ヴェルダの森', sub: '歌を忘れた森' },
];

// ------------------------------------------------------------------ 4. 検査
const LEGEND = {
  O: { mat: 'deep_water', walk: false }, '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false }, _: { mat: 'shallow' },
  s: { mat: 'sand' }, ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, d: { mat: 'dirt' },
  h: { mat: 'moss_earth' }, T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
  m: { mat: 'rock', solid: true, rise: 1 }, c: { mat: 'cliff', solid: true, rise: 1 }, '=': { mat: 'bridge' },
  n: { mat: 'snow' }, a: { mat: 'ash' },
};
const walkCh = (ch) => { const l = LEGEND[ch]; return !!l && !l.solid && l.walk !== false; };
function applyPatches(on) {
  const gg = g.map((r) => r.slice());
  for (const p of tilePatches) {
    if (!on(p.cond)) continue;
    const [px, py] = p.rect;
    p.rows.forEach((r, dy) => [...r].forEach((ch, dx) => { if (ch !== ' ') gg[py + dy][px + dx] = ch; }));
  }
  return gg;
}
const SOLID_OBJ = new Set(['building', 'chest', 'spring', 'brazier', 'waylamp', 'sign']);
function blockedByObj(x, y, cond) {
  for (const o of objects) {
    if (o.cond && !cond(o.cond)) continue;
    if (o.type === 'building') { if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && !(o.door && o.door.x === x && o.door.y === y)) return true; continue; }
    if (o.x !== x || o.y !== y) continue;
    if (SOLID_OBJ.has(o.type)) return true;
    if (o.type === 'prop' && /^(barrel|crate|table|bed|bookshelf|counter|stove|lamp_post|fence|planter|well|signboard|board|rock|stump|log|tent|grave|hay|tree|pine|tree_giant|bush|roots|bollard|stall|rowboat|ship|crystal|songstone)$/.test(o.id)) return true;
  }
  return false;
}
function bfs(gg, sx, sy, cond) {
  const seen = new Uint8Array(W * H), q = [[sx, sy]];
  seen[sy * W + sx] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inB(nx, ny) || seen[ny * W + nx]) continue;
      if (!walkCh(gg[ny][nx]) || blockedByObj(nx, ny, cond)) continue;
      seen[ny * W + nx] = 1; q.push([nx, ny]);
    }
  }
  return seen;
}
function check() {
  const errs = [], info = {};
  const sliceOn = (c) => c && c.slice === true ? true : c === '!prologue_done' ? false : c === 'cleared_r_forest' ? false : false;
  const gg = applyPatches((c) => sliceOn(c));
  const seen = bfs(gg, spawns.roa.x, spawns.roa.y, sliceOn);
  let n = 0, pen = 0, fst = 0, pl = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y * W + x]) { n++; if (y >= 78 && x >= 66) pen++; else if (x <= 64) fst++; else pl++; }
  info.walk = n; info.peninsula = pen; info.forest = fst; info.plains = pl;
  // 入口に着く（出口のマスの隣か上）
  for (const e of exits) {
    let ok = false;
    for (let j = e.y - 1; j <= e.y + e.h; j++) for (let i = e.x - 1; i <= e.x + e.w; i++) if (inB(i, j) && seen[j * W + i]) ok = true;
    if (!ok) errs.push('exit not reachable: ' + JSON.stringify(e.to));
  }
  for (const o of objects) if (o.type === 'building' && o.door) { if (!seen[(o.door.y + 1) * W + o.door.x]) errs.push('door not reachable: ' + o.id); }
  for (const o of objects) if (o.type === 'stairs' && !seen[o.y * W + o.x]) errs.push('stairs not reachable ' + o.x + ',' + o.y);
  for (const k of Object.keys(spawns)) { const s = spawns[k]; if (!walkCh(gg[s.y][s.x]) && k !== 'bridge_n') errs.push('spawn on a wall: ' + k); if (!seen[s.y * W + s.x] && k !== 'bridge_n') errs.push('spawn not reachable: ' + k); }
  // 閉じ方: 縦切りの範囲の外（雪原・山地・砂漠）に出られない
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y * W + x] && (y < 40 || x > 118 || y > 134)) { errs.push('slice leaks at ' + x + ',' + y); y = H; break; }
  // 跳ね橋が上がっている間、半島から出られない
  const pro = (c) => c && c.slice === true ? true : c === '!prologue_done' ? true : false;
  const gp = applyPatches(pro);
  const sp = bfs(gp, spawns.roa.x, spawns.roa.y, pro);
  if (sp[63 * W + 87]) errs.push('the drawbridge does not close the peninsula in the prologue');
  // 30 歩の空白（街道と小道のマスから半径 15 に目印が 1 つも無い）
  const marks = objects.filter((o) => o.type === 'waylamp' || o.type === 'sign' || o.type === 'building' || o.type === 'stairs' || o.type === 'examine' ||
    (o.type === 'prop' && /lamp|lantern|tent|mushroom_glow|firefly|beacon|tree_giant|ship/.test(o.id))).map((o) => [o.x, o.y]);
  for (const n2 of npcs) marks.push([n2.x, n2.y]);
  let empty = 0; const emptyAt = [];
  for (let y = 40; y <= 134; y++) for (let x = 6; x <= 118; x++) {
    if (!seen[y * W + x] || !'.d'.includes(gg[y][x])) continue;
    if (!marks.some(([mx, my]) => Math.abs(mx - x) <= 15 && Math.abs(my - y) <= 8)) { empty++; if (emptyAt.length < 8) emptyAt.push(x + ',' + y); }
  }
  info.emptyRoad = empty; if (empty) info.emptyAt = emptyAt;
  info.objects = objects.length; info.npcs = npcs.length; info.lamps = objects.filter((o) => o.type === 'waylamp').length;
  return { errs, info };
}

// ------------------------------------------------------------------ 書き出し
function emit() {
  const rows = g.map((r) => r.join(''));
  const js = [];
  js.push('// 生成物（CONTENT-P の tools/gen_world.js）。手で直さない: node v2/tools/gen_world.js で作り直す。');
  js.push('// ワールド（224×192）。縦切りの範囲はファロス半島・北の野・ヴェルダの森（V2_PLAN §3.2、WORLD_REDESIGN §2）。');
  js.push('// 他の地方への峠は DB.config.slice の間だけ崖崩れと番人で閉じる（tilePatches・npcs の cond {slice:true}）。');
  js.push('(function (R) {');
  js.push("  'use strict';");
  js.push("  R.def('maps', 'world', {");
  js.push("    id: 'world', name: 'エルセリア', kind: 'world', region: 'prologue', theme: 'world', w: " + W + ', h: ' + H + ',');
  js.push('    legend: ' + JSON.stringify(LEGEND) + ',');
  js.push("    outside: 'deep_water',");
  js.push('    rows: [');
  for (const r of rows) js.push('      ' + JSON.stringify(r) + ',');
  js.push('    ],');
  js.push('    objects: [');
  for (const o of objects) js.push('      ' + JSON.stringify(o) + ',');
  js.push('    ],');
  js.push('    npcs: [');
  for (const n of npcs) js.push('      ' + JSON.stringify(n) + ',');
  js.push('    ],');
  js.push('    spawns: ' + JSON.stringify(spawns) + ',');
  js.push('    exits: ' + JSON.stringify(exits) + ',');
  js.push('    triggers: ' + JSON.stringify(triggers) + ',');
  js.push('    tilePatches: ' + JSON.stringify(tilePatches) + ',');
  js.push('    zones: ' + JSON.stringify(zones) + ',');
  js.push("    light: { ambient: '#4a5290', k: 0.5, mood: 'night' }, bgm: 'overworld', bbg: 'forest',");
  js.push('    meta: ' + JSON.stringify({ sub: '長い夜の大陸', areas }) + ',');
  js.push('  });');
  js.push('})(window.RPG);');
  return js.join('\n') + '\n';
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--ascii') {
    const [x0, y0, x1, y1] = argv.slice(1).map(Number);
    const gg = g.map((r) => r.slice());
    for (const o of objects) {
      const mk = { building: 'B', waylamp: 'L', sign: '!', stairs: '>', examine: '?' }[o.type] || (o.type === 'prop' ? '*' : 'o');
      if (o.type === 'building') { for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) if (gg[o.y + j]) gg[o.y + j][o.x + i] = 'B'; }
      else if (gg[o.y]) gg[o.y][o.x] = mk;
    }
    for (const n of npcs) gg[n.y][n.x] = '@';
    for (const e of exits) for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) gg[e.y + j][e.x + i] = 'X';
    for (const k of Object.keys(spawns)) gg[spawns[k].y][spawns[k].x] = '&';
    for (let y = y0; y <= y1; y++) console.log(String(y).padStart(3) + ' ' + gg[y].slice(x0, x1 + 1).join(''));
    process.exit(0);
  }
  const r = check();
  console.log('[gen_world]', JSON.stringify(r.info));
  for (const e of r.errs) console.log('  ERROR', e);
  if (argv[0] === '--check') { process.exitCode = r.errs.length ? 1 : 0; return; }
  fs.writeFileSync(OUT, emit());
  console.log('[gen_world] wrote', path.relative(process.cwd(), OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
  if (r.errs.length) process.exitCode = 1;
}
module.exports = { check, W, H };
