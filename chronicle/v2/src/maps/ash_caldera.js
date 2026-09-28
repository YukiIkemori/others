// CONTENT（灰の荒野）: 炎の町カルデラ（caldera、町 54×54）。WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8。
//   四角い家の並ぶ町ではない。冷えた古い火口の内側に、輪の段々が底へ下りていく町（2026-09-28）:
//   外の輪  : 火口の縁の道（西の門・東の門）。いちばん上の北の岩に、火の神殿を彫りこむ（巫女カヤ。戸は縁の道に）。
//   段の崖  : 縁の道と下の段の間は、灰色の崖。石段が 3 か所（西・東・北東）。
//   中の輪  : 家の段。北に「大卵殻」= 百年前にかえった火の鳥の卵の殻。家ほどの大きさの白金色の殻が割れたまま段に座り、
//             殻の割れ目をふさいで戸が 3 つ: 西 = 道具屋、まん中 = 酒場「殻の中」、東 = 武具屋（1 つの建物に店が 3 つ、戸はそれぞれ）。
//             西に宿「湯けむり亭」（段に食いこむ石の湯屋）、東に族長ドルガの家（黒い石の塔の家）、南西に闘士の家、南に湯（温泉）。
//   溶岩の堀: 中の輪の内側を、光る溶岩の堀が輪になって回る。石の橋が 4 本（北・西・東・南）。
//   底の輪  : 堀の内側の敷石の輪。まん中に闘技場（丸い石の闘技場。戸は南）。
//   灯り: 溶岩の堀の照り返し（lava_glow、光だけ）と、崖・岩の上の鉄のかがり火（iron_brazier）。道・戸口の前・出入り口には置かない。
//   小物は道に置かない（持ち主の決まり）。宝箱は見える物 2 つ。隠し通路なし（A27）。
//   町の絵は 1 枚の下絵（v2/assets/env/ash/under/caldera*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;
    const W = 54, H = 54, CX = 27, CY = 27, RAD = 26;
    const g = K.grid(W, H, 'M');
    const rr = (x, y) => Math.hypot(x + 0.5 - (CX + 0.5), y + 0.5 - (CY + 0.5)) / RAD;
    // ---------------------------------------------------------------- 輪（外から: 縁の道・崖・家の段・溶岩の堀・底の輪・闘技場）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = rr(x, y);
      let ch = 'M';
      if (r <= 0.3) ch = 'X';
      else if (r <= 0.43) ch = 'c';
      else if (r <= 0.5) ch = '%';
      else if (r <= 0.78) ch = 'a';
      else if (r <= 0.84) ch = 'F';
      else if (r <= 0.96) ch = 'a';
      g[y][x] = ch;
    }
    // 西の門・東の門（縁の道から外へ）
    K.rect(g, 0, 26, 4, 2, 'c'); K.rect(g, 50, 26, 4, 2, 'c');
    // 石段（縁の道 ↔ 家の段）: 西・東・北東（崖の輪を、その向きで 2 マス幅に切る）
    const ang = (x, y) => Math.atan2(y + 0.5 - (CY + 0.5), x + 0.5 - (CX + 0.5));
    const near = (a, b, w) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) <= w;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== 'F') continue;
      const a = ang(x, y);
      if (near(a, Math.PI, 0.05) || near(a, 0, 0.05) || near(a, -Math.PI / 4, 0.05)) g[y][x] = 'e';
    }
    // 石の橋（溶岩の堀）: 北・西・東・南（2 マス幅）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '%') continue;
      if ((x === 26 || x === 27) || (y === 26 || y === 27)) g[y][x] = 'b';
    }
    // 湯（温泉）: 家の段の南
    for (let y = 43; y <= 47; y++) for (let x = 20; x <= 34; x++) { const d = ((x - 27) / 6.4) ** 2 + ((y - 45) / 2.3) ** 2; if (d < 1 && K.at(g, x, y) === 'a') K.put(g, x, y, 'h'); }

    // ---------------------------------------------------------------- 建物（戸口は 1 マス、敷地のいちばん下の行。出て着くのはその真下）
    const O = [];
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const bld = (id, x, y, w, h, o) => {
      const b = Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'stone', windows: 2, lamp: false }, o);
      O.push(b);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j]) g[y + j][x + i] = 'a';
      if (b.door) { g[b.door.y][b.door.x] = 'c'; if ('FM%'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'a'; }
      return b;
    };
    // 大卵殻（百年前の火の鳥の卵の殻。割れ目に 3 つの戸）: 西 = 道具屋、まん中 = 酒場、東 = 武具屋
    const bItems = bld('caldera_shell_items', 19, 8, 5, 5, { wall: 2, windows: 1, sign: 'item', door: door(21, 12, 'caldera_items') });
    const bTav = bld('caldera_shell_tavern', 24, 7, 6, 6, { wall: 2, windows: 2, sign: 'tavern', door: door(26, 12, 'caldera_tavern') });
    const bArms = bld('caldera_shell_arms', 30, 8, 5, 5, { wall: 2, windows: 1, sign: 'weapon', door: door(32, 12, 'caldera_arms') });
    const bTemple = bld('caldera_temple', 22, 0, 10, 4, { wall: 2, windows: 0, sign: 'shrine', door: door(27, 3, 'caldera_temple') });
    const bInn = bld('caldera_inn', 6, 19, 7, 6, { wall: 2, windows: 2, sign: 'inn', door: door(9, 24, 'caldera_inn') });
    const bDorga = bld('caldera_dorga', 41, 18, 6, 6, { wall: 3, windows: 2, door: door(43, 23, 'caldera_dorga') });
    const bHouse = bld('caldera_house', 9, 33, 5, 4, { wall: 2, windows: 1, door: door(11, 36, 'caldera_house') });
    // 闘技場（丸い石の闘技場。戸は南。丸い壁は描いた物 X、戸のまわりだけ建物）
    const bArena = bld('caldera_arena', 24, 32, 7, 3, { wall: 3, windows: 0, sign: 'guild', door: door(27, 34, 'caldera_arena') });
    for (let y = 32; y <= 34; y++) for (let x = 24; x <= 30; x++) if (!(x === 27 && y === 34)) { /* 建物の敷地 */ }
    // 戸の前（出て着く所）
    for (const b of [bItems, bTav, bArms, bTemple, bInn, bDorga, bHouse, bArena]) if ('FMX%h'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'a';

    const sp = AK.doorSpawn;
    K.def('caldera', {
      name: '炎の町カルデラ', kind: 'town', region: 'r_ash', location: 'caldera', theme: 'desert_town',
      legend: AK.TOWN(),
      rows: g, outside: 'rock',
      objects: O, npcs: [],
      spawns: {
        gate_w: { x: 2, y: 26, dir: 'e' },
        gate_e: { x: 51, y: 26, dir: 'w' },
        items: sp(bItems), tavern: sp(bTav), arms: sp(bArms), temple: sp(bTemple), inn: sp(bInn), dorga: sp(bDorga), house: sp(bHouse), arena: sp(bArena),
        warp: { x: 27, y: 37, dir: 's' },
      },
      exits: [
        { x: 0, y: 26, w: 1, h: 2, to: { map: 'world', spawn: 'caldera' } },
        { x: 53, y: 26, w: 1, h: 2, to: { map: 'world', spawn: 'caldera_e' } },
      ],
      triggers: [{ id: 'arrival', on: 'enter', event: 'caldera_arrival' }],
      zones: [],
      light: AK.LIGHT_TOWN,
      dark: false,
      bgm: 'town',
      meta: { sub: '火口の段々と闘技場の町', chestsInfo: false },
    });
  });
})(window.RPG);
