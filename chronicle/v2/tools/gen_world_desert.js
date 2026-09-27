// CONTENT（砂漠）: ワールドの砂漠の地方（ザハラ砂漠）を gen_world.js の上から描く（WORLD_REDESIGN §2.3・§2.6・§2.7・§4.2、§5.5）。
//   gen_world.js が最後に require('./gen_world_desert')(api) を呼ぶ。ここは地面・道・物・出口・spawn・出現表・地名だけを足す。
//   手で直さない生成物（src/maps/world.js）は node v2/tools/gen_world.js で作り直す。
//
// 置き場所（マス）:
//   森からの峠（31,121）→ 宿場「砂の縁」（#10、36,125）→ オアシスの町カシム（47〜57, 134〜143。西の門・東の門）
//   東の門 → 灰の荒野への峠（x 91、縦切りでは崖崩れと番人で閉じる）
//   西の門 → 隊商路: 野営地 1「岩の井戸」（36,152）→ 野営地 2「星の石」（24,155）→ 近道（砂嵐の窪地、古い野営跡）／遠回り（西の浜、井戸の小部屋）
//            → 野営地 3「王墓のオアシス」（15,145。王墓の入口はこの中）
//   岩の台地（24〜32, 133〜140）の南に砂の鷹団のアジト（#7）、北東の岩場に金剛トカゲの岩場（#9）、真ん中に蜃気楼の市（#8、消灯の刻だけ）、
//   南の浜に砂に沈んだ神殿（#6、柱の先だけ見える。砂漠の解決の後か、満月の消灯の刻に入口）。
//   【灯りを守る】烽火台 3（q_kasim_beacons）、井戸掘りの 3 か所（q_kasim_dig）、迷子のラクダ（q_kasim_camel）。
'use strict';

module.exports = function desert(A) {
  const { g, get, set, h2, fbm, road, clearing, P, B, S, LAMP, objects, npcs, exits, triggers, tilePatches, spawns, zones, areas, LEGEND, lampsAlong } = A;
  const X0 = 8, X1 = 95, Y0 = 122, Y1 = 166;
  const inBox = (x, y) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;

  Object.assign(LEGEND, {
    u: { mat: 'dune_sand' },
    k: { mat: 'cracked_clay' },
    X: { mat: 'wall_sandstone', solid: true, rise: 1 },
    Q: { mat: 'sandstone_floor' },
  });

  // ---------------------------------------------------------------- 1. 陸の形
  const land = (x, y) => {
    const n = (fbm(x, y, 7, 301) - 0.5) * 5;
    if (y < 122 || y > 161 + n * 0.6) return false;
    if (x < 13 + n * 0.7) return false;
    if (x > 93) return false;
    if (x >= 63 && y < 134 + n * 0.4) return false;      // 半島との海峡
    return true;
  };
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (x > 91 && get(x, y) === 'a') continue;             // 灰の荒野はそのまま
    if (!land(x, y)) { if (get(x, y) === 'm' || get(x, y) === 'c') continue; set(x, y, (x < 11 || y > 163) ? 'O' : '~'); continue; }
    const dn = fbm(x, y, 6, 311), cl = fbm(x, y, 11, 317), r = h2(x, y, 319);
    let c = 's';
    if (dn > 0.56) c = 'u';                                 // 砂丘の筋
    if (cl < 0.3 && y > 128) c = 'k';                       // 枯れ川の粘土
    if (y < 132 && fbm(x, y, 5, 321) > 0.62) c = 'm';       // 北の岩の荒れ地
    if (r > 0.994) c = 'm';
    set(x, y, c);
  }
  // 浜（海に接する砂）
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    if (!'uk'.includes(get(x, y))) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ('~O'.includes(get(x + dx, y + dy))) { set(x, y, 's'); break; }
  }
  // 東の境（灰の荒野との尾根）。峠（y 140〜142）は東の門からの道が抜ける
  for (let y = 132; y <= 164; y++) for (let x = 90; x <= 94; x++) {
    if ('~O'.includes(get(x, y))) continue;
    const edge = Math.abs(x - 92) + (h2(x, y, 331) > 0.5 ? 1 : 0);
    if (edge <= 2) set(x, y, h2(x, y, 333) > 0.4 ? 'm' : 'c');
  }
  // 岩の台地（メサ）: 鷹団のアジトの台地・王墓の北の台地・南の台地
  const mesa = (cx, cy, rx, ry, seed) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (h2(x, y, seed) - 0.5) * 0.35;
      if (d < 1 && land(x, y)) set(x, y, 'X');
    }
  };
  mesa(28, 137, 5, 3.5, 341);        // 鷹団の台地
  mesa(21, 136, 3, 2.5, 343);        // 王墓の北の岩
  mesa(62, 152, 4, 2.5, 345);        // 南の台地
  mesa(47, 157, 3, 2, 347);
  mesa(76, 150, 3, 2.5, 349);
  // 砂嵐の窪地（近道。野営地 2 の北）: 砂岩の壁で囲み、南の入口は選択で開く。北の口から王墓のオアシスへ
  for (let y = 146; y <= 155; y++) for (let x = 18; x <= 30; x++) if (land(x, y)) set(x, y, h2(x, y, 351) > 0.3 ? 'u' : 's');
  for (let x = 17; x <= 31; x++) set(x, 145, 'X');
  for (let y = 145; y <= 156; y++) { set(17, y, 'X'); set(31, y, 'X'); set(32, y, 'X'); }
  for (let x = 17; x <= 32; x++) if (x < 21 || x > 23) set(x, 156, 'X');
  set(19, 145, 's'); set(20, 145, 's');
  // ---------------------------------------------------------------- 2. 道
  const R2 = (pts, o) => road(pts, Object.assign({ wd: 2, ch: 'd' }, o || {}));
  // 森からの峠 → 砂の縁 → カシムの西の門
  R2([[31, 118], [31, 128], [40, 128], [40, 133], [44, 133], [44, 139], [46, 139]]);
  road([[36, 128], [36, 127]], { wd: 1, ch: 'd' });                                   // 砂の縁の入口
  // カシムの東の門 → 灰の荒野の峠（閉じている）
  R2([[58, 138], [70, 138], [70, 141], [94, 141]]);
  // 隊商路（西の門から南へ、野営地 1 → 2）
  road([[44, 140], [44, 146], [38, 146], [38, 151]], { wd: 1, ch: 'd' });
  road([[36, 153], [36, 159], [27, 159], [27, 158]], { wd: 1, ch: 'd' });
  // 遠回り（西の浜を回る）→ 野営地 3
  road([[25, 159], [14, 159], [14, 142], [16, 142]], { wd: 1, ch: 'd' });
  // 近道（砂嵐の窪地を北へ）
  road([[22, 158], [22, 150], [19, 150], [19, 143], [17, 143]], { wd: 1, ch: 'k' });
  // アジト・岩場・神殿への小道
  road([[40, 139], [34, 139], [34, 142], [28, 142]], { wd: 1, ch: 'd' });
  road([[44, 130], [52, 130], [52, 127], [56, 127]], { wd: 1, ch: 'd' });
  road([[56, 143], [56, 150], [58, 150], [58, 157]], { wd: 1, ch: 'd' });
  for (const [x, y, w, h] of [[30, 118, 3, 5]]) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if ('mcX'.includes(get(i, j))) set(i, j, 'd');

  // 町・場所の塊
  const block = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
  block(47, 134, 11, 10, 's');   // カシム
  block(33, 122, 7, 6, 's');     // 砂の縁
  clearing(16, 141, 3, 's');     // 王墓のオアシス（野営地 3）
  clearing(36, 152, 2, 's'); clearing(27, 158, 2, 's'); clearing(40, 142, 3, 's'); clearing(57, 125, 2, 's');
  for (const [x, y] of [[14, 139], [15, 139], [16, 139]]) set(x, y, 'w');   // 古い泉（ワールドから見える水面）
  for (const [x, y] of [[51, 133], [52, 133], [53, 133]]) set(x, y, 's');

  // ---------------------------------------------------------------- 3. 物
  // 古い飾り（森の飾りのループが砂の上に置いた物）を外す
  for (let i = objects.length - 1; i >= 0; i--) { const o = objects[i]; if (o.type === 'prop' && inBox(o.x, o.y) && o.y >= 122) objects.splice(i, 1); }
  const solidAt = (x, y) => objects.some((o) => o.x === x && o.y === y);
  // カシム（泉を囲む市場の町。ワールドには外壁の家と門の灯り）
  B('w_kasim1', 48, 134, 4, 3, { roof: 'flat', mat: 'plaster', art: 'desert_house_s', lamp: true });
  B('w_kasim2', 53, 134, 4, 3, { roof: 'flat', mat: 'plaster', lamp: true });
  B('w_kasim3', 48, 140, 4, 3, { roof: 'flat', mat: 'plaster', lamp: true });
  B('w_kasim4', 53, 140, 4, 3, { roof: 'flat', mat: 'plaster', chimney: false });
  P('desert_palm', 51, 137); P('desert_palm', 55, 138, { variant: 1 }); P('copper_brazier', 47, 137); P('copper_brazier', 47, 141); P('copper_brazier', 57, 137); P('copper_brazier', 57, 141);
  exits.push({ x: 46, y: 138, w: 1, h: 2, to: { map: 'kasim', spawn: 'gate_w' } });
  exits.push({ x: 58, y: 138, w: 1, h: 2, to: { map: 'kasim', spawn: 'gate_e' } });
  spawns.kasim = { x: 44, y: 139, dir: 'w' };
  spawns.kasim_e = { x: 60, y: 139, dir: 'e' };
  S(43, 136, 'オアシスの町カシム\n――泉を囲む市場');
  // 宿場「砂の縁」（#10）
  B('w_sandedge', 34, 123, 5, 4, { roof: 'flat', mat: 'plaster', art: 'desert_house_s', lamp: true, sign: 'inn', door: { x: 36, y: 126, to: { map: 'sandedge', spawn: 'gate' } } });
  P('desert_palm', 33, 122); P('cart_barrels', 39, 126); P('copper_brazier', 33, 127);
  spawns.sandedge = { x: 36, y: 128, dir: 's' };
  S(38, 128, '宿場「砂の縁」\n森と砂漠と灰の街道の、まん中の宿');
  // 峠の出口の看板
  S(29, 124, 'ザハラ砂漠\n北 → ヴェルダの森　南東 → カシム');
  // 野営地（隊商路の小さな場所。中は desert_camp1〜3）
  const camp = (id, x, y, name, spawn, o) => {
    P('tent', x - 1, y - 1); P('copper_brazier', x + 1, y - 1); P('clay_jars', x - 2, y);
    exits.push({ x, y, w: 1, h: 1, to: { map: id, spawn: 'road' } });
    set(x, y, 'd');
    spawns[spawn] = { x: o.sx, y: o.sy, dir: o.dir || 's' };
    S(x + 2, y + 1, name);
  };
  camp('desert_camp1', 37, 152, '野営地「岩の井戸」', 'camp1', { sx: 37, sy: 154 });
  camp('desert_camp2', 27, 158, '野営地「星の石」', 'camp2', { sx: 27, sy: 160 });
  camp('desert_camp3', 16, 141, '王墓のオアシス', 'camp3', { sx: 16, sy: 143, dir: 's' });
  P('obelisk', 19, 139); P('broken_pillar', 13, 142); P('desert_palm', 13, 140); P('desert_palm', 17, 138, { variant: 1 });
  // 近道の砂嵐の入口（選んだあとか、解決のあと開く）と、古い野営跡（desert_oldcamp）
  const shortOpen = { any: [{ choice: 'ch_desert_route', is: 'short' }, 'cleared_r_desert'] };
  tilePatches.push({ cond: { not: shortOpen }, rect: [21, 156, 3, 1], rows: ['XXX'] });
  S(24, 157, '砂嵐の窪地\n――風のやまない近道。');
  exits.push({ x: 27, y: 150, w: 1, h: 1, to: { map: 'desert_oldcamp', spawn: 'road' } });
  set(27, 150, 'd'); set(26, 150, 'd'); set(25, 150, 'd'); set(24, 150, 'd'); set(23, 150, 'd'); P('tent', 28, 149); P('bones', 28, 151);
  spawns.oldcamp = { x: 26, y: 150, dir: 'w' };
  // 遠回りの井戸の小部屋（desert_wellroom）
  exits.push({ x: 13, y: 151, w: 1, h: 1, to: { map: 'desert_wellroom', spawn: 'road' } });
  set(13, 151, 'd'); P('dry_well', 12, 150);
  spawns.wellroom = { x: 14, y: 151, dir: 'e' };
  S(15, 153, '古い井戸の小屋');
  // 砂の鷹団のアジト（#7、台地の南の洞）
  exits.push({ x: 28, y: 141, w: 1, h: 1, to: { map: 'desert_hawks_1', spawn: 'mouth' } });
  set(28, 141, 'd');
  spawns.hawks = { x: 28, y: 142, dir: 's' };
  P('bones', 26, 142); P('thorn_bush', 31, 142);
  S(30, 143, '岩の台地\n夜、鷹の笛が聞こえるという。');
  // 金剛トカゲの岩場（#9）
  exits.push({ x: 57, y: 125, w: 1, h: 1, to: { map: 'desert_rocks', spawn: 'mouth' } });
  set(57, 125, 'd');
  spawns.rocks = { x: 57, y: 126, dir: 's' };
  S(55, 128, '北の岩場\n「岩が動いた」と隊商が言う。');
  // 蜃気楼の市（#8、消灯の刻だけ灯りの列が現れる）
  const night = 'desert_night';
  for (const [x, y] of [[38, 141], [42, 141], [38, 144], [42, 144], [40, 140]]) P('lantern', x, y, { cond: night });
  exits.push({ x: 40, y: 142, w: 1, h: 1, to: { map: 'desert_mirage', spawn: 'road' }, cond: night });
  spawns.mirage = { x: 40, y: 143, dir: 's' };
  objects.push({ type: 'examine', x: 40, y: 142, event: 'desert_mirage_empty', cond: { not: night } });
  S(43, 144, '砂の真ん中の平地\n消灯の刻に、灯りの列が揺れるという。');
  // 砂に沈んだ神殿（#6、南の浜。柱の先だけ見える）
  const temple = { any: ['cleared_r_desert', { var: 'desert_nights', gte: 3 }] };
  P('broken_pillar', 56, 158); P('broken_pillar', 60, 158); P('obelisk', 58, 157);
  objects.push({ type: 'stairs', x: 58, y: 158, to: { map: 'desert_temple_1', spawn: 'entrance' }, cond: temple });
  objects.push({ type: 'examine', x: 58, y: 158, event: 'desert_temple_sand', cond: { not: temple } });
  spawns.temple = { x: 58, y: 159, dir: 's' };
  S(55, 156, '沈んだ柱の浜\n砂嵐が晴れた晩、柱が増えるという。');
  // 【灯りを守る】隊商路の烽火台（q_kasim_beacons、調べると desert_beacon）
  LAMP('wl_desert_beacon_1', 42, 147, 'q_kasim_beacon_1', { event: 'desert_beacon' });
  LAMP('wl_desert_beacon_2', 32, 160, 'q_kasim_beacon_2', { event: 'desert_beacon' });
  LAMP('wl_desert_beacon_3', 12, 146, 'q_kasim_beacon_3', { event: 'desert_beacon' });
  // 井戸掘りの 3 か所（q_kasim_dig）。当たりの所には泉が湧く（町の外の回復の泉）
  for (const [x, y, n] of [[51, 147, 1], [55, 146, 2], [49, 150, 3]]) { objects.push({ type: 'examine', x, y, event: 'desert_dig', dig: n }); P('sand_mound', x + 1, y); }
  objects.push({ type: 'spring', id: 'world_desert_spring', x: 55, y: 147, cond: 'desert_dig_found' });
  // 迷子のラクダ（q_kasim_camel）
  npcs.push({ id: 'lost_camel', look: 'ani_camel', name: 'ラクダ', x: 72, y: 153, dir: 'w', move: 'still', cond: ['desert_camel_asked', '!desert_camel_found'], talk: 'desert_camel_world', reward: 'side', key: 'world_lost_camel' });
  // 旅人（景色の目印・話す見返り）
  npcs.push({ id: 'pilgrim', look: 'npc_desert_old_f', name: '夜明け待ちの巡礼', x: 41, y: 131, dir: 's', move: 'still', talk: 'desert_world_pilgrim', reward: 'news', key: 'world_pilgrim' });
  npcs.push({ id: 'oil_caravan', look: 'npc_oil_carrier', name: '油運び', x: 75, y: 139, dir: 'w', move: 'still', talk: 'desert_world_oil', reward: 'hint', key: 'world_oil_caravan' });
  P('cart_barrels', 76, 138);
  npcs.push({ id: 'oil_camel', look: 'ani_camel', name: 'ラクダ', x: 77, y: 139, dir: 'w', move: 'still', talk: { lines: [{ text: 'ラクダは、油の壺を背に\nのんびり砂をかんでいる。' }] }, reward: null });
  // 隊が襲われる（隊と一緒のとき、道の上で 1 度ずつ。§4.2 の流れ 1）
  const amb = (n, x, y, w, h, extra) => triggers.push({ id: 'desert_ambush_' + n + (extra || ''), x, y, w, h, on: 'step', event: 'desert_ambush_' + n,
    cond: ['desert_caravan_on', '!desert_ambush_' + n + '_done'] });
  amb(1, 43, 145, 3, 1); amb(2, 35, 156, 3, 1); amb(3, 13, 155, 3, 1); amb(3, 21, 152, 3, 1, 'b');
  // 灰の荒野への峠（縦切りでは崖崩れ。cond {slice:true}）
  tilePatches.push({ cond: { slice: true }, rect: [90, 140, 3, 3], rows: ['mmm', 'mmm', 'mmm'] });
  npcs.push({ id: 'guard_ash', look: 'npc_guard_1', name: '番人', x: 88, y: 139, dir: 'e', move: 'still', pushable: false, cond: { slice: true },
    talk: { lines: [{ text: ['灰の荒野へ抜ける峠は、\n灰の崩れでふさがってるんだ。', 'カルデラへ行くなら、\n片づくまで待ってくれ。'] }] }, reward: 'news', key: 'world_guard_ash' });
  S(86, 142, '東 → 灰の荒野・カルデラ');

  // 道しるべの灯籠（ともった物）と、景色の飾り
  lampsAlong([[31, 122], [31, 128], [40, 128], [40, 133], [44, 133]], 10, 1);
  lampsAlong([[58, 138], [70, 138], [70, 141], [86, 141]], 10, 1);
  lampsAlong([[44, 140], [44, 146]], 9, 1);
  const free = (x, y) => {
    const c = get(x, y);
    if (!'suk'.includes(c) || solidAt(x, y)) return false;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if ('d.'.includes(get(x + dx, y + dy))) return false;
    for (const e of exits) if (x >= e.x - 2 && x <= e.x + e.w + 1 && y >= e.y - 2 && y <= e.y + e.h + 1) return false;
    for (const n of npcs) if (Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1) return false;
    for (const k of Object.keys(spawns)) if (Math.abs(spawns[k].x - x) <= 1 && Math.abs(spawns[k].y - y) <= 1) return false;
    if (x >= 47 && x <= 57 && y >= 133 && y <= 144) return false;
    return true;
  };
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= 90; x++) {
    if (!free(x, y)) continue;
    const r = h2(x, y, 361);
    if (r < 0.012) P('cactus', x, y);
    else if (r < 0.02) P('thorn_bush', x, y);
    else if (r < 0.026) P('sand_mound', x, y);
    else if (r < 0.03) P('bones', x, y);
    else if (r < 0.034) P('rock_small', x, y);
  }
  // 小さなオアシス（景色の目印）
  for (const [x, y] of [[65, 146], [30, 131], [80, 156]]) {
    set(x, y, 'w'); set(x + 1, y, 'w');
    P('desert_palm', x - 1, y - 1); P('desert_palm', x + 2, y, { variant: 1 });
  }

  // ---------------------------------------------------------------- 4. 出現表（上から最初に合う物。先頭に入れる）
  const Z = [
    { rect: [44, 130, 16, 16], zone: null },                             // カシムのまわり（町の外の灯り）
    { rect: [18, 146, 13, 10], zone: 'zw_desert_storm' },
    { rect: [8, 133, 88, 34], zone: 'zw_desert_caravan', cond: 'desert_caravan_on' },
    { rect: [30, 118, 4, 14], zone: 'zw_desert_road' },
    { rect: [58, 137, 36, 6], zone: 'zw_desert_road' },
    { rect: [8, 122, 88, 45], zone: 'zw_desert' },
  ];
  // zone: null の範囲は出現なし（MapUtil.zoneAt は最初に合った物を返す）
  zones.unshift(...Z.filter((z) => z.zone));
  // カシムのまわりは町の灯りで出ない: 出現なしの表を使わず、範囲を切り抜く代わりに灯籠を置く（ともった灯籠の 5 マスは出ない）
  for (const [x, y] of [[45, 136], [45, 142], [59, 136], [59, 142]]) LAMP('wl_kasim_' + x + '_' + y, x, y, true);

  // ---------------------------------------------------------------- 5. 地名
  areas.unshift(
    { rect: [44, 131, 16, 15], name: 'カシムのまわり', sub: 'オアシスの町の外' },
    { rect: [18, 146, 13, 10], name: '砂嵐の窪地', sub: '隊商路の近道' },
    { rect: [8, 118, 88, 49], name: 'ザハラ砂漠', sub: '名を売った王の砂漠' },
  );
  return { box: { x0: X0, y0: 118, x1: 93, y1: Y1 } };
};
