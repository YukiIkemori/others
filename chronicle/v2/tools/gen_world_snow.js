// ワールドの生成器の雪原の分（gen_world.js が最後に呼ぶ。生成物は src/maps/world.js）。WORLD_REDESIGN §2.3〜§2.7・§4.3、V2_PLAN §3.2
//   ノルデン雪原（x 12〜93、y 2〜43）を上から描き直す: 雪原・凍った湖（解決の前は水、解決で氷の道）・北の流氷原・白竜の峰の山塊・東の峠（山地へ。まだ閉じる）。
//   町と入口: ユール（3 つの門）・雪の林・白竜の峰・つららの回廊（#11）・峠の宿（#14）・オーロラの崖（#12）・氷に閉じた帆船（#13）。
//   道しるべの灯籠（ユール〜峠の宿の 3 つは消えている → 依頼【灯りを守る】）、景色の目印、出現表、地名。
//   凡例を足す: 'Y' 雪のもみ（地面は雪）・'M' 雪の岩・'I' 氷（歩ける）・'P' 雪の道・'N' 雪（'n' と同じ。雪原の塗り）
'use strict';
module.exports = function snow(A) {
  const { get, set, rect, road, h2, fbm, P, S, LAMP, objects, npcs, exits, triggers, tilePatches, spawns, zones, areas, LEGEND } = A;
  Object.assign(LEGEND, {
    Y: { mat: 'tree', solid: true, under: 'snow', tree: ['snow_fir'] },
    M: { mat: 'wall_snow', solid: true, rise: 1 },
    I: { mat: 'ice' },
    P: { mat: 'snow_path' },
  });
  const X0 = 8, X1 = 93, Y0 = 1, Y1 = 43;
  // ---------------------------------------------------------------- 陸の形
  const main = (x, y) => y >= (x >= 47 && x <= 78 ? 10 : 15) + (fbm(x, y, 7, 501) - 0.5) * 3 && x >= 19 + (fbm(x, y, 6, 503) - 0.5) * 3 && y <= 43;
  const floe = (x, y) => (((x - 31) / 17) ** 2 + ((y - 8) / 5.2) ** 2) < 1 + (fbm(x, y, 5, 505) - 0.5) * 0.5;
  const lake = (x, y) => (((x - 31) / 8.5) ** 2 + ((y - 23) / 7.5) ** 2) < 1 + (fbm(x, y, 5, 507) - 0.5) * 0.35 || (x >= 27 && x <= 35 && y >= 12 && y <= 18);
  const massif = (x, y) => x >= 50 && x <= 74 && y >= 2 && y <= 13 + (fbm(x, y, 5, 509) - 0.5) * 4 && (((x - 62) / 13) ** 2 + ((y - 6) / 9) ** 2) < 1.15;
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    let c = 'O';
    if (y >= 3 && (floe(x, y) || (main(x, y) && x <= 91) || (massif(x, y)))) c = 'n';
    if (c === 'O' && y >= 2 && x >= 14 && x <= 48 && y <= 16) c = '~';          // 流氷原のまわりの海（浅い）
    if (c === 'n' && lake(x, y)) c = 'w';
    if (c === 'n' && massif(x, y)) c = h2(x, y, 511) > 0.18 ? 'M' : 'Y';
    if (c === 'n') {
      const n = fbm(x, y, 9, 513), r = h2(x, y, 515);
      if (n > 0.66) c = 'Y';
      else if (n > 0.55 && r < 0.28) c = 'Y';
      else if (r < 0.018) c = 'M';
      if (floe(x, y) && !main(x, y)) c = r < 0.5 ? 'I' : (r < 0.53 ? 'M' : 'n');
    }
    set(x, y, c);
  }
  // 東の尾根（山地との境）と峠。峠の先は山地（縦切りの間は崖崩れで閉じる）
  for (let y = 14; y <= 43; y++) for (let x = 89; x <= 93; x++) if (get(x, y) !== 'O') set(x, y, h2(x, y, 517) > 0.3 ? 'M' : 'c');
  // 南東の縁（山地・北の野との境）: y 42〜44 の x 60 より東は雪の岩（北の野の北の帯へ抜けない）
  for (let y = 42; y <= 44; y++) for (let x = 60; x <= 93; x++) if (get(x, y) !== 'O') set(x, y, h2(x, y, 519) > 0.3 ? 'M' : 'c');
  rect(89, 30, 5, 2, 'P');
  // 西の崖（つららの回廊）
  for (let y = 26; y <= 38; y++) for (let x = 17; x <= 21; x++) if (get(x, y) === 'n' || get(x, y) === 'Y') set(x, y, 'M');
  // 北の尾根（森との境）は gen_world.js の ridge のまま（峠 x 37〜39 だけ空く）

  // ---------------------------------------------------------------- 道
  const R2 = (pts, o) => road(pts, Object.assign({ ch: 'P', zone: 'snowroad' }, o || {}));
  R2([[38, 47], [38, 36], [40, 36], [40, 27], [44, 27]]);                         // 北の峠 → ユールの西の門
  R2([[38, 36], [24, 36], [24, 33], [22, 33]], { wd: 1 });                          // → つららの回廊（西の崖）
  R2([[41, 30], [36, 30], [36, 31]], { wd: 1, zone: null });                        // 湖の岸（そりの渡し）
  R2([[55, 27], [66, 27], [66, 32], [83, 32]]);                                     // ユールの東の門 → 峠の宿
  R2([[84, 32], [89, 32]], { wd: 2, zone: null });                                  // 峠の宿 → 東の峠
  R2([[66, 32], [66, 38]], { wd: 1 });                                              // → 雪の林
  R2([[49, 21], [49, 16], [60, 16], [60, 14]]);                                     // ユールの北の門 → 白竜の峰
  // 道の両側の木と岩をどける
  const clear = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ('YM'.includes(get(x, y)) && !(x >= 89)) set(x, y, 'n'); };
  clear(37, 33, 42, 38); clear(39, 25, 45, 30); clear(22, 32, 39, 38); clear(54, 25, 68, 30); clear(64, 30, 86, 34); clear(64, 32, 68, 40); clear(47, 14, 62, 22);
  clear(34, 28, 42, 32); clear(80, 26, 88, 34);
  // ---------------------------------------------------------------- 町と入口
  // ユール（x 44〜54、y 20〜29）: 雪に埋もれた家と氷の灯籠
  rect(44, 21, 11, 8, 'n');
  const H = (id, x, y, o) => objects.push(Object.assign({ type: 'building', id, x, y, w: 5, h: 4, wall: 2, roof: 'slate', mat: 'log', windows: 2, lamp: true, chimney: true, art: 'snow_house_s' }, o || {}));
  H('w_yule1', 44, 21); H('w_yule2', 50, 21); H('w_yule3', 47, 25, { w: 6, h: 5, art: 'snow_shop_m' });
  for (const [x, y] of [[43, 25], [43, 29], [55, 25], [55, 29], [48, 20], [51, 20], [46, 30], [53, 30]]) P('snow_lamp', x, y);
  P('beacon', 49, 24, { cond: 'cleared_r_snow' });                                  // 冬至の火（大灯火の光の柱）
  exits.push({ x: 44, y: 27, w: 1, h: 1, to: { map: 'yule', spawn: 'gate_w' } });
  exits.push({ x: 54, y: 27, w: 1, h: 1, to: { map: 'yule', spawn: 'gate_e' } });
  exits.push({ x: 49, y: 21, w: 1, h: 1, to: { map: 'yule', spawn: 'gate_n' } });
  spawns.yule_w = { x: 42, y: 27, dir: 'w' }; spawns.yule_e = { x: 56, y: 27, dir: 'e' }; spawns.yule_n = { x: 49, y: 19, dir: 'n' }; spawns.yule = spawns.yule_w;
  set(44, 27, 'P'); set(54, 27, 'P'); set(49, 21, 'P');
  S(41, 25, '雪の村ユール\n雪のトンネルの村。');
  // 峠の宿（#14、x 81〜86、y 27〜31）
  rect(80, 27, 8, 6, 'n');
  objects.push({ type: 'building', id: 'w_passinn', x: 81, y: 27, w: 6, h: 5, wall: 2, roof: 'slate', mat: 'log', windows: 2, lamp: true, chimney: true, art: 'snow_shop_m' });
  exits.push({ x: 84, y: 32, w: 1, h: 1, to: { map: 'pass_inn', spawn: 'gate' } });
  spawns.pass_inn = { x: 84, y: 33, dir: 's' };
  P('stove_pipe', 87, 29); P('snow_lamp', 80, 31); P('snow_lamp', 87, 31); P('tent', 79, 28);
  S(82, 34, '宿場「峠の宿」\n湯気の立つ峠の宿。');
  // 雪の林（入口）
  objects.push({ type: 'stairs', x: 66, y: 39, to: { map: 'snow_woods', spawn: 'south' } });
  spawns.snow_woods = { x: 66, y: 38, dir: 'n' };
  P('snow_fir', 64, 39); P('snow_fir', 68, 39); P('firewood', 65, 37); S(68, 37, '雪の林\n薪になる倒木が多い。');
  // 白竜の峰（入口は山塊の南の裾）
  for (let y = 11; y <= 14; y++) for (let x = 58; x <= 62; x++) set(x, y, 'P');
  objects.push({ type: 'stairs', x: 60, y: 11, to: { map: 'peak_1', spawn: 'south' } });
  spawns.peak = { x: 60, y: 12, dir: 's' };
  P('snow_lamp', 58, 13); P('ice_crystal', 62, 12); S(57, 15, '白竜の峰\n吹雪の奥に、竜が眠るという。');
  P('beacon', 62, 5, { cond: 'cleared_r_snow' });
  // つららの回廊（#11、西の崖）
  set(21, 33, 'P'); set(22, 33, 'P');
  objects.push({ type: 'stairs', x: 20, y: 33, to: { map: 'icicle_1', spawn: 'entrance' } });
  set(20, 33, 'P');
  spawns.icicle = { x: 21, y: 33, dir: 'w' };
  P('ice_crystal', 20, 31); P('ice_crystal', 20, 35); S(23, 35, 'つららの回廊\n氷の中に、何かが閉じこめられている。');
  // 凍った湖: 解決で氷の道（北の流氷原へ）。そりの渡し（依頼 迷子のそり犬）は町のそり犬の小屋から
  const ice = [];
  for (let y = 12; y <= 30; y++) ice.push('II');
  tilePatches.push({ cond: 'cleared_r_snow', rect: [30, 12, 2, 19], rows: ice });
  P('sled', 35, 31); P('snow_sign', 37, 31); objects.push({ type: 'examine', x: 36, y: 31, event: 'world_snow_lake' });
  S(38, 32, '凍った湖\n今年は氷が薄い。渡るべからず。');
  // 北の流氷原（上陸の場所・オーロラの崖・氷に閉じた帆船）
  for (let y = 9; y <= 11; y++) for (let x = 29; x <= 32; x++) set(x, y, 'I');
  spawns.floe = { x: 31, y: 11, dir: 'n' };
  P('snow_lamp', 33, 10); P('sled', 29, 11); objects.push({ type: 'examine', x: 30, y: 11, event: 'world_snow_floe_sled' });
  objects.push({ type: 'stairs', x: 22, y: 6, to: { map: 'aurora', spawn: 'south' } });
  for (let y = 5; y <= 8; y++) for (let x = 20; x <= 24; x++) set(x, y, 'n');
  spawns.aurora = { x: 22, y: 7, dir: 's' };
  P('ice_crystal', 20, 5); P('ice_crystal', 24, 5); S(24, 8, 'オーロラの崖\n空が七色に揺れる崖。');
  objects.push({ type: 'stairs', x: 41, y: 6, to: { map: 'frost_ship_1', spawn: 'entrance' } });
  for (let y = 5; y <= 8; y++) for (let x = 39; x <= 43; x++) set(x, y, 'I');
  spawns.frost_ship = { x: 41, y: 7, dir: 's' };
  P('snow_rock', 43, 5); S(38, 8, '氷に閉じた帆船\n――危険。強い魔物の気配がする。');
  road([[31, 10], [22, 10], [22, 8]], { ch: 'I', wd: 1 }); road([[32, 9], [41, 9], [41, 8]], { ch: 'I', wd: 1 });

  // ---------------------------------------------------------------- 道しるべの灯籠（ユール〜峠の宿の 3 つは消えている）
  for (const [x, y] of [[39, 43], [39, 38], [33, 37], [26, 37], [42, 32], [59, 26], [48, 17], [55, 17], [67, 35], [74, 31], [80, 35]]) LAMP('wl_snow_' + x + '_' + y, x, y, true);
  LAMP('wl_snow_1', 63, 29, 'q_snow_lamps_1', { event: 'snow_waylamp' });
  LAMP('wl_snow_2', 69, 31, 'q_snow_lamps_2', { event: 'snow_waylamp' });
  LAMP('wl_snow_3', 77, 34, 'q_snow_lamps_3', { event: 'snow_waylamp' });
  // 氷尾ギツネの足あと（峠の道の途中。調べる物。解決の前後どちらでも）
  objects.push({ type: 'examine', x: 72, y: 34, event: 'world_snow_fox' });
  P('snow_rock', 72, 35);
  // 景色の目印・旅人
  const camp = (x, y) => { P('tent', x, y); P('firewood', x + 1, y + 1); P('snow_lamp', x - 1, y); };
  camp(30, 40); camp(73, 28); camp(58, 36);
  // 西の湖岸と北東の雪原のまん中（画面 1 枚に目印 1 つ）
  camp(22, 21); P('snow_lamp', 83, 16); P('tent', 84, 17); P('snow_lamp', 79, 12);
  P('ice_crystal', 26, 29); P('snow_rock', 45, 35); P('snow_rock', 53, 35);
  npcs.push({ id: 'snow_trapper', look: 'npc_snow_man', name: 'わな猟師', x: 31, y: 41, dir: 's', move: 'still', talk: 'world_snow_trapper', reward: 'hint', key: 'world_snow_trapper' });
  npcs.push({ id: 'snow_pilgrim', look: 'npc_snow_old_m', name: '峠越えの年寄り', x: 74, y: 29, dir: 'w', move: 'still', talk: 'world_snow_pilgrim', reward: 'news', key: 'world_snow_pilgrim' });
  npcs.push({ id: 'snow_scout', look: 'npc_snow_watch', name: '見回りの若者', x: 51, y: 16, dir: 's', move: 'still', talk: 'world_snow_scout', reward: 'boss', key: 'world_snow_scout' });
  S(40, 41, '北の峠を越えて\n↑ 雪の村ユール');
  S(64, 25, '← ユール　　峠の宿 →');
  // 東の峠の崖崩れ（山地。縦切りの間は閉じる）
  const rows = []; for (let j = 0; j < 2; j++) rows.push('mmm');
  tilePatches.push({ cond: { slice: true }, rect: [90, 30, 3, 2], rows });
  npcs.push({ id: 'guard_snow_east', look: 'npc_guard_1', name: '番人', x: 89, y: 33, dir: 'e', move: 'still', pushable: false, cond: { slice: true },
    talk: { lines: [{ text: ['この先の峠は、崖崩れで\nふさがっておる。', '山の鉱山町へ行くのは、\n道が片づくまで待ってくれ。'] }] }, reward: 'news', key: 'world_guard_snow_east' });

  // ---------------------------------------------------------------- 出現表と地名（上から最初に合う物）
  const zs = [];
  for (const r of A.ROADS) if (r.zone === 'snowroad') for (let i = 0; i < r.pts.length - 1; i++) {
    const [x0, y0] = r.pts[i], [x1, y1] = r.pts[i + 1];
    zs.push({ rect: [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + r.wd, Math.abs(y1 - y0) + r.wd], zone: 'zw_snow_road' });
  }
  zs.push({ rect: [14, 1, 48, 13], zone: 'z_snow_floe' });
  zs.push({ rect: [X0, 14, X1 - X0 + 1, 30], zone: 'zw_snow' });
  zones.unshift(...zs);
  areas.push({ rect: [14, 1, 48, 13], name: '北の流氷原', sub: 'オーロラの海' });
  areas.push({ rect: [X0, 14, X1 - X0 + 1, 30], name: 'ノルデン雪原', sub: '吹雪のやまない雪原' });
  // 北の流氷原は、解決の後の氷の道か、そりの渡し（依頼）で渡る（gen_world.js の到達の検査はここを後回しにする）
  return { box: { x0: X0, x1: X1, y0: Y0, y1: 48, late: (x, y) => y <= 13 && x <= 62 } };
};
