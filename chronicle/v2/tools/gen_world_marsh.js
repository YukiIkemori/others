// ワールドの生成器の湿原の分（gen_world.js が雪原の後に呼ぶ。生成物は src/maps/world.js）。WORLD_REDESIGN §2.3〜§2.7・§4.4・§5.7
//   グレイモア湿原（x 155〜212、y 55〜114）を上から描き直す: 泥炭の原・沼・葦原・枯れ木・はすの池。
//   町と入口: ロッホ（西の門・東の門）・霧の館（ロッホの東）・鐘沈みの沼（南。集会の前は霧の壁）・沼の縁の鐘の歌の石碑（証拠 6）・はすの池（#22、はすの精の巣）。
//   山あいの街道（仮）: 北の野の東の峠（guard_east。縦切りでは崖崩れと番人で閉じる）から、山地の北の縁を東へ抜けて湿原の北の入口へ。
//     ガルド山地・オルビス高原はまだ作っていないので、この道は仮（山地・高原を作る担当が引き直してよい）。湿原の北の入口にも縦切りの閉じ方（guard_marsh）。
//   凡例を足す: 'G' 泥炭の草（歩ける）・'W' 沼の水・'R' 葦原（通れない）・'V' 枯れ木（通れない、地面は泥炭）・'K' 板の道・'Z' 泥の道
'use strict';
module.exports = function marsh(A) {
  const { get, set, rect, road, h2, fbm, P, S, LAMP, objects, npcs, exits, triggers, tilePatches, spawns, zones, areas, LEGEND } = A;
  Object.assign(LEGEND, {
    G: { mat: 'peat_grass' },
    W: { mat: 'marsh_water', walk: false },
    R: { mat: 'tall_grass', solid: true },
    V: { mat: 'tree', solid: true, under: 'peat_grass', tree: ['swamp_tree'] },
    K: { mat: 'plank' },
    Z: { mat: 'mud' },
  });
  const X0 = 155, X1 = 212, Y0 = 55, Y1 = 114;
  const inBox = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
  // ---------------------------------------------------------------- 1. 陸の形（見取り図の湿原のまま、材料を湿原に）
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    const c = get(x, y);
    if (c === 'O' || c === '~') continue;
    if (y < 57 && c === ',') continue;                          // 北の高原はそのまま
    const n = fbm(x, y, 7, 601), m = fbm(x, y, 4, 603), r = h2(x, y, 605);
    let ch = 'G';
    if (c === 'w' || n > 0.62) ch = 'W';                        // 沼
    else if (m > 0.66) ch = 'R';                                // 葦原
    else if (r < 0.03) ch = 'V';                                // 枯れ木
    set(x, y, ch);
  }
  // 沼の岸に葦（水に接する草の一部）
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (get(x, y) !== 'G') continue;
    let wet = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, y + dy) === 'W') wet = true;
    if (wet && h2(x, y, 607) < 0.25) set(x, y, 'R');
  }
  // 東の岸は x 205 まで（その先の東の果ての岬は別の地方。縦切りの外から見える端に歩けるマスを出さない）
  for (let y = Y0; y <= Y1; y++) for (let x = 206; x <= X1; x++) if (get(x, y) !== 'O') set(x, y, '~');
  // 北の縁（オルビス高原との境）: 岩と葦の尾根。入口の道（x 166〜167）だけ空く
  for (let x = 146; x <= 205; x++) for (const y of [56, 57]) {
    if (x >= 166 && x <= 167) continue;
    const c = get(x, y);
    if (c === 'O' || c === '~') continue;
    if (y === 56 || h2(x, y, 613) < 0.5) set(x, y, h2(x, y, 615) < 0.7 ? 'm' : 'c');
  }
  // ---------------------------------------------------------------- 2. 山あいの街道（仮）: 東の峠 → 山地の北の縁 → 湿原の北の入口
  //   峠の東（x 116〜117）の海を陸にして北へ。峠そのものは縦切りでは崖崩れ（gen_world.js の guard_east）なので、体験版からは出られない
  for (let y = 50; y <= 64; y++) for (let x = 116; x <= 118; x++) if ('~O'.includes(get(x, y))) set(x, y, x === 118 ? 'm' : 'd');
  const LINK = [[115, 63], [117, 63], [117, 51], [140, 51], [140, 49], [158, 49], [158, 53], [166, 53], [166, 58]];
  road(LINK, { wd: 2, ch: '.', zone: 'marsh_link' });
  for (let i = 0; i < LINK.length - 1; i++) {                   // 道の両側の岩をどける
    const [ax, ay] = LINK[i], [bx, by] = LINK[i + 1];
    for (let y = Math.min(ay, by) - 1; y <= Math.max(ay, by) + 2; y++) for (let x = Math.min(ax, bx) - 1; x <= Math.max(ax, bx) + 2; x++) if ('mcT'.includes(get(x, y)) && !(x <= 116 && y >= 60)) set(x, y, 'd');
  }
  // 街道は山あいの切り通し: 道の両側を岩の壁にして、まだ作っていない山地・高原の原へ出ない（道だけを通る）。
  //   道の脇の野営の空き地（旅人）だけ 1 か所あける
  const isRoad = (x, y) => get(x, y) === '.';
  const camp0 = [[160, 55], [161, 55], [162, 55], [160, 56], [161, 56], [162, 56]];
  for (const [x, y] of camp0) set(x, y, ',');
  const keep = new Set(camp0.map(([x, y]) => x + ',' + y));
  const fence = [];
  for (let y = 44; y <= 60; y++) for (let x = 112; x <= 170; x++) {
    if (isRoad(x, y) || keep.has(x + ',' + y)) continue;
    const c = get(x, y);
    if ('~Om'.includes(c)) continue;
    if (y >= 57 && x >= 146) continue;                          // 湿原の側は北の縁の尾根で閉じる
    let near = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isRoad(x + i, y + j) || keep.has((x + i) + ',' + (y + j))) near = true;
    if (near) fence.push([x, y]);
  }
  for (const [x, y] of fence) set(x, y, h2(x, y, 617) < 0.75 ? 'm' : 'c');
  // 切り通しのわきの岩に掛けた灯（街道の目印。道の上には置かない）
  for (const [x, y] of [[116, 58], [116, 53], [123, 50], [131, 53], [139, 50], [147, 48], [155, 48], [157, 52], [164, 52], [165, 55]]) if ('mc'.includes(get(x, y))) P('lantern', x, y);
  // ---------------------------------------------------------------- 3. 湿原の道（泥の道。沼を渡る所は板の道）
  const ROUTES = [];
  const Z2 = (pts, wd) => {
    wd = wd || 2;
    ROUTES.push({ pts, wd });
    if (A.ROADS) A.ROADS.push({ pts, wd, ch: 'Z', wet: 'K', zone: null });   // WORLD v3: ワールドを大きくするとき、この道も写して描き直す（沼の水の上は板の道）
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
      const put = () => { for (let j = 0; j < wd; j++) for (let q = 0; q < wd; q++) { const c = get(x + q, y + j); if (c === '~' || c === 'O') continue; set(x + q, y + j, c === 'W' || c === 'K' ? 'K' : 'Z'); } };
      put();
      while (x !== x2 || y !== y2) { if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y); put(); }
    }
  };
  Z2([[166, 58], [166, 66], [172, 66], [172, 74], [177, 74]]);              // 北の入口 → ロッホの西の門
  Z2([[189, 74], [196, 74], [196, 68], [200, 68], [200, 71]], 1);           // ロッホの東の門 → 霧の館
  Z2([[172, 74], [172, 86], [180, 86], [180, 96], [184, 96], [184, 101]]);  // ロッホの西から南へ → 沼の入口
  Z2([[180, 86], [191, 86], [191, 88]], 1);                                  // → はすの池（沼の道の東）
  // ---------------------------------------------------------------- 4. 町と入口
  const block = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
  const clearG = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r + 0.3 && 'WRV'.includes(get(x, y))) set(x, y, 'G'); };
  // ロッホ（x 178〜188、y 68〜79）: 湖の上の町。ワールドには湖と高床の家と鐘楼
  block(176, 66, 15, 15, 'W');
  block(178, 71, 11, 6, 'K');
  objects.push({ type: 'building', id: 'w_loch1', x: 179, y: 68, w: 4, h: 3, wall: 1, roof: 'thatch', mat: 'log', windows: 1, small: true, art: 'marsh_house_s', lamp: true });
  objects.push({ type: 'building', id: 'w_loch2', x: 184, y: 68, w: 5, h: 3, wall: 1, roof: 'slate', mat: 'log', windows: 1, small: true, art: 'marsh_shop_m', lamp: true });
  objects.push({ type: 'building', id: 'w_loch3', x: 180, y: 77, w: 4, h: 3, wall: 1, roof: 'thatch', mat: 'log', windows: 1, small: true, art: 'marsh_house_s' });
  P('bell_frame', 186, 77); P('wisp_lamp', 177, 70); P('wisp_lamp', 189, 70); P('wisp_lamp', 177, 77); P('wisp_lamp', 189, 77);
  set(177, 73, 'K'); set(177, 74, 'K'); set(189, 73, 'K'); set(189, 74, 'K');
  exits.push({ x: 177, y: 73, w: 1, h: 2, to: { map: 'loch', spawn: 'gate_w' } });
  exits.push({ x: 189, y: 73, w: 1, h: 2, to: { map: 'loch', spawn: 'gate_e' } });
  for (let y = 72; y <= 75; y++) { set(175, y, 'Z'); set(176, y, 'Z'); set(190, y, 'Z'); set(191, y, 'Z'); }
  spawns.loch = { x: 175, y: 74, dir: 'w' };
  spawns.loch_e = { x: 191, y: 74, dir: 'e' };
  S(174, 71, '水辺の町ロッホ\n――湖の上の、鐘の町');
  // 霧の館（x 198〜203、y 64〜70）: 枯れ木の庭の中の館。入口は南の扉
  clearG(200, 69, 4);
  objects.push({ type: 'building', id: 'w_manor', x: 198, y: 65, w: 5, h: 4, wall: 2, roof: 'slate', mat: 'stone', windows: 2, small: false, art: 'marsh_hall_l',
    door: { x: 200, y: 68, to: { map: 'marsh_manor_1', spawn: 'entrance' } } });
  set(200, 69, 'Z'); set(200, 70, 'Z');
  spawns.manor = { x: 200, y: 70, dir: 's' };
  P('swamp_tree', 196, 66); P('swamp_tree', 204, 66); P('swamp_tree', 204, 70); P('grave_moss', 197, 70);
  S(202, 71, '霧の館\n夜ごと、楽の音が聞こえる。');
  // 鐘沈みの沼（南）: 入口の霧の壁（集会の前は入れない）と、沼の縁の鐘の歌の石碑（証拠 6）
  clearG(184, 100, 3);
  objects.push({ type: 'stairs', x: 184, y: 102, to: { map: 'marsh_bog', spawn: 'entrance' }, cond: 'marsh_assembly_done' });
  objects.push({ type: 'examine', x: 184, y: 102, event: 'marsh_mistwall', cond: { not: 'marsh_assembly_done' } });
  set(184, 102, 'Z'); set(183, 102, 'W'); set(185, 102, 'W');
  spawns.bog = { x: 184, y: 101, dir: 'n' };
  P('grave_moss', 187, 98); objects.push({ type: 'examine', x: 187, y: 98, event: 'marsh_songstone' });
  S(181, 99, '鐘沈みの沼\n――霧の来る所');
  P('bell_frame', 188, 104); P('bell_frame', 180, 105);
  // はすの池（#22、はすの精の巣）
  clearG(192, 90, 2);
  for (const [x, y] of [[190, 91], [191, 92], [192, 92], [193, 92], [194, 91], [192, 93], [191, 93], [193, 93]]) set(x, y, 'W');
  P('lily_pads', 191, 92); P('lily_pads', 193, 92); P('pale_mushrooms', 195, 89);
  objects.push({ type: 'examine', x: 192, y: 92, event: 'marsh_lotus' });
  S(189, 89, 'はすの池\n消灯の刻に、青く光る蓮が咲くという。');
  // ---------------------------------------------------------------- 5. 旅人・景色・灯籠
  npcs.push({ id: 'marsh_traveler', look: 'npc_traveler', name: '湿原の旅人', x: 161, y: 56, dir: 'n', move: 'still', talk: 'marsh_world_traveler', reward: 'news', key: 'world_marsh_traveler' });
  P('tent', 162, 56); P('lantern', 160, 55); P('log', 160, 56);
  S(168, 59, 'グレイモア湿原\n南 → 水辺の町ロッホ');
  S(116, 61, '山あいの街道\n北 → グレイモア湿原');
  // 道しるべの灯籠（街道にそって。沼の道は鬼火の灯）
  for (const [x, y] of [[169, 68], [174, 80], [178, 88], [182, 93], [176, 104], [196, 104], [199, 90], [188, 108]]) P('wisp_lamp', x, y);   // 湿原の南と東の原の目印（鬼火の灯）
  // 景色の飾り（枯れ木・葦・光るきのこ）。道と出口のまわりには置かない
  const solidAt = (x, y) => objects.some((o) => o.x === x && o.y === y);
  for (let y = Y0 + 2; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (get(x, y) !== 'G' || solidAt(x, y)) continue;
    let near = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ('ZK.'.includes(get(x + i, y + j))) near = true;
    for (const e of exits) if (x >= e.x - 2 && x <= e.x + e.w + 1 && y >= e.y - 2 && y <= e.y + e.h + 1) near = true;
    if (near) continue;
    const r = h2(x, y, 611);
    if (r < 0.01) P('swamp_tree', x, y);
    else if (r < 0.018) P('pale_mushrooms', x, y);
    else if (r < 0.024) P('rotten_stump', x, y);
  }
  // ---------------------------------------------------------------- 6. 縦切りの閉じ方（湿原の北の入口。峠の guard_east と二重）
  tilePatches.push({ cond: { slice: true }, rect: [166, 56, 2, 2], rows: ['mm', 'mm'] });
  set(168, 57, 'G'); set(168, 58, 'G');
  npcs.push({ id: 'guard_marsh', look: 'npc_guard_1', name: '番人', x: 168, y: 57, dir: 'n', move: 'still', pushable: false, cond: { slice: true },
    talk: { lines: [{ text: ['この先の湿原は、霧が深くて\n道が見えないんだ。', 'ロッホへ行くのは、\n霧が晴れるまで待ってくれ。'] }] }, reward: 'news', key: 'world_guard_marsh' });
  // ---------------------------------------------------------------- 7. 出現表（上から最初に合う物。先頭に入れる）と地名
  const Z = [{ rect: [188, 88, 9, 7], zone: 'zw_marsh_lotus' }];
  for (const r of ROUTES) for (let i = 0; i < r.pts.length - 1; i++) {
    const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
    Z.push({ rect: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + r.wd, Math.abs(y1 - y0) + r.wd], zone: 'zw_marsh_road' });
  }
  Z.push({ rect: [X0, Y0, X1 - X0 + 1, Y1 - Y0 + 1], zone: 'zw_marsh' }, { rect: [116, 44, 40, 21], zone: 'zw_marsh_road' });
  zones.unshift(...Z);
  // ロッホのまわりは町の灯りで出ない（ともした灯籠の 5 マスは出ない）
  for (const [x, y] of [[174, 76], [192, 72]]) LAMP('wl_loch_' + x + '_' + y, x, y, true);
  areas.unshift(
    { rect: [174, 64, 20, 18], name: 'ロッホのまわり', sub: '湖の上の町の外' },
    { rect: [188, 87, 9, 8], name: 'はすの池', sub: '消灯の刻に光る蓮' },
    { rect: [X0, Y0, X1 - X0 + 1, Y1 - Y0 + 1], name: 'グレイモア湿原', sub: '霧と鐘の湿原' },
    { rect: [115, 44, 55, 21], name: '山あいの街道', sub: '北の野と湿原をつなぐ道' },
  );
  return { box: { x0: X0, y0: Y0, x1: X1, y1: Y1 } };
};
