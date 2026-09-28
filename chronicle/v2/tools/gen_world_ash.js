// ワールドの生成器の灰の荒野の分（gen_world.js が湿原の後に呼ぶ。生成物は src/maps/world.js）。WORLD_REDESIGN §2.3〜§2.7・§4.7・§5.11
//   灰の荒野（x 96〜206、y 115〜162）を上から描き直す: 灰の原・岩・溶岩の原・焦げた木・黒い砂浜。
//   町と入口: カルデラ（西の門・東の門）・灰の火山（町の東。大会に勝つまで岩戸で閉じる）・灰見の宿（#27、潮見橋のたもと）・
//             湯の郷（#25、湯けむり猿の巣）・火山ガメの浜（#26）・折れた剣の碑（#24。古戦場の中はあとの工程）。
//   道: カシムの東の峠（x 91〜94、y 140〜142。縦切りでは砂漠の側の guard_ash で閉じる）→ 灰の街道 → カルデラ。
//       カルデラの東の門 → 北の潮見橋（x 186〜187、y 113〜121）→ 湿原の南の岸（鐘沈みの沼の入口の道 x 184〜185、y 101 へつなぐ）。
//       湿原の山あいの街道（仮、gen_world_marsh.js）とあわせて、北の野 → 湿原 → 灰 → 砂漠 → 森の輪になる。
//   座標は下の PL の 1 か所にまとめる（ワールドを大きくするときは、ここと BOX を写せばよい）。飾りはハッシュで散らすだけ。
//   凡例を足す: '%' 溶岩（通れない）・'j' 黒い砂浜（黒曜石）・'v' 焦げた木（通れない、地面は灰）
'use strict';
module.exports = function ash(A) {
  const { get, set, road, h2, fbm, P, S, LAMP, objects, npcs, exits, tilePatches, spawns, zones, areas, LEGEND } = A;
  void tilePatches;
  Object.assign(LEGEND, {
    '%': { mat: 'lava', walk: false },
    j: { mat: 'obsidian' },
    v: { mat: 'tree', solid: true, under: 'ash', tree: ['charred_tree'] },
  });
  const BOX = { x0: 96, x1: 206, y0: 115, y1: 162 };
  // ---------------------------------------------------------------- 場所（ここだけ見れば、どこに何があるかわかる）
  const PL = {
    pass: [95, 141],                  // カシムの東の峠の出口（砂漠の道の続き）
    town: { x: 161, y: 131, w: 12, h: 11, gateW: [161, 135], gateE: [172, 135] },
    volcano: { cx: 193, cy: 136, rx: 8, ry: 10, door: [185, 141] },
    inn: { x: 189, y: 122, w: 5, h: 3, door: [191, 124] },
    bridge: { x: 186, y0: 113, y1: 121 },
    marshRoad: [186, 101],            // 湿原の沼の入口の道（gen_world_marsh.js の x 184〜185、y 96〜101）の東隣
    spa: [133, 128], beach: [158, 157], stone: [106, 150], camp: [100, 137], lavaLake: [133, 149],
  };
  // 箱の北西の角（x 96〜115、y 115〜132）は縦切りの半島の南の岸なので描かない（灰の陸は y 133 より南か、x 116 より東）
  const inBox = (x, y) => x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1 && (y >= 133 || x >= 116);
  const land = (x, y) => !'~O'.includes(get(x, y));
  // ---------------------------------------------------------------- 1. 地面（見取り図の陸のまま、材料を灰の荒野に）
  for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) {
    if (!inBox(x, y) || !land(x, y)) continue;
    const n = fbm(x, y, 8, 701), m = fbm(x, y, 5, 703), r = h2(x, y, 705);
    let ch = 'a';
    if (n > 0.66) ch = 'm';                                      // 岩の出っぱり
    else if (m > 0.7) ch = '%';                                  // 溶岩の原
    else if (r < 0.02) ch = 'v';                                 // 焦げた木
    set(x, y, ch);
  }
  // 海に接する灰は黒い砂浜
  for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) {
    if (!inBox(x, y) || get(x, y) !== 'a') continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('~O'.includes(get(x + dx, y + dy))) { set(x, y, 'j'); break; }
  }
  // 灰の火山（町の東の円錐。岩の山と、南へ流れ下る溶岩の筋）
  const V = PL.volcano;
  for (let y = V.cy - V.ry - 1; y <= V.cy + V.ry + 1; y++) for (let x = V.cx - V.rx - 1; x <= V.cx + V.rx + 1; x++) {
    const d = ((x - V.cx) / V.rx) ** 2 + ((y - V.cy) / V.ry) ** 2 + (h2(x, y, 711) - 0.5) * 0.2;
    if (d < 1 && land(x, y)) set(x, y, d < 0.35 ? '^' : 'm');
  }
  for (let y = V.cy; y <= V.cy + V.ry + 4; y++) { const x = V.cx + 2 + Math.round(Math.sin(y * 0.6) * 1.2); if (land(x, y)) { set(x, y, '%'); set(x + 1, y, '%'); } }
  // 溶岩の湖（荒野のまん中の南。景色の目印）
  const [lx, ly] = PL.lavaLake;
  for (let y = ly - 3; y <= ly + 3; y++) for (let x = lx - 5; x <= lx + 5; x++) if (((x - lx) / 5) ** 2 + ((y - ly) / 3) ** 2 < 1 && land(x, y)) set(x, y, '%');
  // ---------------------------------------------------------------- 2. 道（灰をかぶった街道）
  const ROUTES = [];
  const R2 = (pts, wd) => { ROUTES.push({ pts, wd: wd || 2 }); road(pts, { wd: wd || 2, ch: '.' }); };
  const T = PL.town;
  R2([PL.pass, [112, 141], [112, 137], [134, 137], [134, 139], [150, 139], [150, 135], [T.gateW[0] - 1, 135]]);   // 峠 → カルデラの西の門
  R2([[T.gateE[0] + 1, 135], [180, 135], [180, 126], [PL.bridge.x, 126], [PL.bridge.x, PL.bridge.y1 + 1]]);      // 東の門 → 潮見橋
  R2([[180, 135], [180, 141], [PL.volcano.door[0] - 1, 141]]);                                                    // → 火山の岩戸
  R2([[PL.bridge.x, 126], [PL.inn.door[0], 126], [PL.inn.door[0], PL.inn.door[1] + 1]], 1);                        // → 灰見の宿
  R2([[130, 137], [130, 130]], 1);                                                                                  // → 湯の郷
  R2([[150, 140], [150, 150], [PL.beach[0], 150], [PL.beach[0], PL.beach[1] - 2]], 1);                             // → 火山ガメの浜
  R2([[112, 142], [112, 149], [PL.stone[0] + 1, 149]], 1);                                                          // → 折れた剣の碑
  // 潮見橋（海を渡る石の橋）と、湿原の南の岸の道
  for (let y = PL.bridge.y0; y <= PL.bridge.y1; y++) for (let x = PL.bridge.x; x <= PL.bridge.x + 1; x++) set(x, y, '=');
  for (let y = PL.marshRoad[1]; y < PL.bridge.y0; y++) for (let x = PL.marshRoad[0]; x <= PL.marshRoad[0] + 1; x++) set(x, y, get(x, y) === 'W' || get(x, y) === '~' ? 'K' : 'Z');
  // 道のわきの溶岩・岩・焦げた木をどける（道の両側 1 マス）
  for (const r of ROUTES) for (let i = 0; i < r.pts.length - 1; i++) {
    const [ax, ay] = r.pts[i], [bx, by] = r.pts[i + 1];
    for (let y = Math.min(ay, by) - 1; y <= Math.max(ay, by) + r.wd; y++) for (let x = Math.min(ax, bx) - 1; x <= Math.max(ax, bx) + r.wd; x++) if (inBox(x, y) && '%mv^'.includes(get(x, y))) set(x, y, 'a');
  }
  // ---------------------------------------------------------------- 3. 町と入口
  const block = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
  // カルデラ（火口の町）: ワールドには火口の縁の岩の輪と、中の段々の家
  block(T.x, T.y, T.w, T.h, 'm');
  block(T.x + 1, T.y + 1, T.w - 2, T.h - 2, 'a');
  objects.push({ type: 'building', id: 'w_caldera1', x: T.x + 2, y: T.y + 2, w: 3, h: 3, wall: 1, roof: 'slate', mat: 'stone', windows: 1, small: true, art: 'ash_house_s', lamp: true });
  objects.push({ type: 'building', id: 'w_caldera2', x: T.x + 6, y: T.y + 2, w: 4, h: 3, wall: 1, roof: 'slate', mat: 'stone', windows: 1, small: true, art: 'ash_shop_m', lamp: true });
  objects.push({ type: 'building', id: 'w_caldera3', x: T.x + 4, y: T.y + 6, w: 5, h: 3, wall: 1, roof: 'slate', mat: 'stone', windows: 1, small: true, art: 'ash_hall_l' });
  for (const [gx, gy] of [T.gateW, T.gateE]) { set(gx, gy, '.'); set(gx, gy + 1, '.'); }
  exits.push({ x: T.gateW[0], y: T.gateW[1], w: 1, h: 2, to: { map: 'caldera', spawn: 'gate_w' } });
  exits.push({ x: T.gateE[0], y: T.gateE[1], w: 1, h: 2, to: { map: 'caldera', spawn: 'gate_e' } });
  spawns.caldera = { x: T.gateW[0] - 2, y: T.gateW[1] + 1, dir: 'w' };
  spawns.caldera_e = { x: T.gateE[0] + 2, y: T.gateE[1] + 1, dir: 'e' };
  S(T.gateW[0] - 3, T.gateW[1] - 2, '炎の町カルデラ\n――火口の段々と闘技場の町');
  // 灰の火山の岩戸（大会に勝つまで閉じる）
  const [dx, dy] = PL.volcano.door;
  set(dx, dy, '.'); set(dx + 1, dy, 'm');
  objects.push({ type: 'stairs', x: dx, y: dy, to: { map: 'ash_volcano_1', spawn: 'entrance' }, cond: 'ash_champion' });
  objects.push({ type: 'examine', x: dx, y: dy, event: 'ash_rockdoor_world', cond: { not: 'ash_champion' } });
  spawns.volcano = { x: dx - 1, y: dy, dir: 'w' };
  S(dx - 2, dy - 2, '灰の火山\n炎の試練の勝者のほか、入るべからず。');
  // 灰見の宿（#27、潮見橋のたもと）
  const I = PL.inn;
  block(I.x - 1, I.y - 1, I.w + 2, I.h + 2, 'a');
  objects.push({ type: 'building', id: 'w_haimi', x: I.x, y: I.y, w: I.w, h: I.h, wall: 1, roof: 'slate', mat: 'stone', windows: 2, small: true, art: 'ash_shop_m', lamp: true,
    door: { x: I.door[0], y: I.door[1], to: { map: 'haimi_inn', spawn: 'door' } } });
  set(I.door[0], I.door[1] + 1, '.');
  spawns.haimi = { x: I.door[0], y: I.door[1] + 1, dir: 's' };
  S(PL.bridge.x - 1, PL.bridge.y1 + 3, '潮見橋\n北 → グレイモア湿原');
  objects.push({ type: 'examine', x: PL.bridge.x + 2, y: PL.bridge.y1 + 1, event: 'ash_bridge_sign' });
  set(PL.bridge.x + 2, PL.bridge.y1 + 1, 'a');
  S(PL.marshRoad[0] + 2, PL.marshRoad[1] + 1, '南 → 潮見橋・灰の荒野');
  // 湯の郷（#25）: 湯気の噴き出す岩の間の湯
  const [sx, sy] = PL.spa;
  for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 3; x <= sx + 3; x++) if (land(x, y) && Math.hypot(x - sx, y - sy) < 3.2) set(x, y, 'a');
  set(sx, sy - 1, 'w'); set(sx + 1, sy - 1, 'w');
  objects.push({ type: 'examine', x: sx, y: sy - 1, event: 'ash_spa_pool' });
  P('steam_vent', sx - 2, sy - 1); P('steam_vent', sx + 3, sy); P('hot_spring', sx + 2, sy + 1);
  S(sx - 3, sy + 2, '溶岩洞の湯の郷\n岩の割れ目から、湯が湧く。');
  // 火山ガメの浜（#26）と、折れた剣の碑（#24）
  const [bx, by] = PL.beach;
  for (let y = by - 2; y <= by + 2; y++) for (let x = bx - 4; x <= bx + 4; x++) if (land(x, y)) set(x, y, 'j');
  P('volcanic_rocks', bx - 2, by); P('volcanic_rocks', bx + 2, by + 1); objects.push({ type: 'examine', x: bx, y: by, event: 'ash_beach_rock' });
  S(bx - 3, by - 3, '黒い砂浜\n動く岩に注意。');
  const [tx, ty] = PL.stone;
  set(tx, ty, 'a'); set(tx, ty - 1, 'm');
  objects.push({ type: 'examine', x: tx, y: ty - 1, event: 'ash_battlefield_stone' });
  P('lava_rock', tx - 1, ty - 1);
  S(tx + 2, ty + 1, '灰の古戦場\n折れた剣の碑');
  // ---------------------------------------------------------------- 4. 旅人・灯り
  const [cx, cy] = PL.camp;
  npcs.push({ id: 'ash_traveler', look: 'npc_traveler', name: '灰の荒野の旅人', x: cx, y: cy, dir: 's', move: 'still', talk: 'ash_world_traveler', reward: 'news', key: 'world_ash_traveler' });
  P('tent', cx + 1, cy - 1); P('lantern', cx - 1, cy - 1);
  S(PL.pass[0] + 2, PL.pass[1] - 2, '灰の荒野\n東 → 炎の町カルデラ');
  // 道しるべの鉄のかがり火（街道にそって、道の外）
  for (const [x, y] of [[104, 139], [120, 135], [140, 141], [150, 133], [158, 138], [178, 133], [182, 128], [178, 143], [128, 132], [152, 148], [114, 147]]) if (get(x, y) === 'a') P('iron_brazier', x, y);
  // 景色の飾り（焦げた木・硫黄・溶岩石）。道と出口のまわりには置かない
  const solidAt = (x, y) => objects.some((o) => o.x === x && o.y === y);
  for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) {
    if (!inBox(x, y) || get(x, y) !== 'a' || solidAt(x, y)) continue;
    let near = false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ('.=K'.includes(get(x + i, y + j))) near = true;
    for (const e of exits) if (x >= e.x - 2 && x <= e.x + e.w + 1 && y >= e.y - 2 && y <= e.y + e.h + 1) near = true;
    if (near) continue;
    const r = h2(x, y, 721);
    if (r < 0.008) P('charred_stump', x, y);
    else if (r < 0.014) P('sulphur', x, y);
    else if (r < 0.02) P('lava_rock', x, y);
  }
  // ---------------------------------------------------------------- 5. 出現表（上から最初に合う物。先頭に入れる）と地名
  const Z = [
    { rect: [sx - 8, sy - 4, 17, 9], zone: 'zw_ash_spa' },
    { rect: [bx - 10, by - 6, 22, 10], zone: 'zw_ash_beach' },
  ];
  for (const r of ROUTES) for (let i = 0; i < r.pts.length - 1; i++) {
    const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
    Z.push({ rect: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + r.wd, Math.abs(y1 - y0) + r.wd], zone: 'zw_ash_road' });
  }
  Z.push({ rect: [PL.bridge.x, PL.marshRoad[1], 2, PL.bridge.y1 - PL.marshRoad[1] + 1], zone: 'zw_ash_road' });
  Z.push({ rect: [BOX.x0, BOX.y0 + 6, BOX.x1 - BOX.x0 + 1, BOX.y1 - BOX.y0 - 5], zone: 'zw_ash_plain' });
  zones.unshift(...Z);
  // カルデラと灰見の宿のまわりは町の灯りで出ない（ともした灯籠の 5 マスは出ない）
  for (const [x, y] of [[T.gateW[0] - 3, T.gateW[1] + 3], [T.gateE[0] + 3, T.gateE[1] + 3], [I.x - 2, I.y + 3]]) if (get(x, y) === 'a' || get(x, y) === '.') LAMP('wl_ash_' + x + '_' + y, x, y, true);
  areas.unshift(
    { rect: [T.x - 4, T.y - 4, T.w + 8, T.h + 8], name: 'カルデラのまわり', sub: '火口の町の外' },
    { rect: [V.cx - V.rx - 2, V.cy - V.ry - 2, V.rx * 2 + 5, V.ry * 2 + 5], name: '灰の火山', sub: '火の鳥の眠る山' },
    { rect: [PL.bridge.x - 3, PL.bridge.y0, 8, PL.bridge.y1 - PL.bridge.y0 + 6], name: '潮見橋', sub: '湿原と灰をつなぐ橋' },
    { rect: [sx - 8, sy - 4, 17, 9], name: '溶岩洞の湯の郷', sub: '湯けむりの岩場' },
    { rect: [bx - 10, by - 6, 22, 10], name: '火山ガメの浜', sub: '黒い砂浜' },
    { rect: [BOX.x0, BOX.y0 + 6, BOX.x1 - BOX.x0 + 1, BOX.y1 - BOX.y0 - 5], name: '灰の荒野', sub: '火の鳥の眠る荒野' },
  );
  return { box: BOX };
};
