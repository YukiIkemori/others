// BATTLE（砂漠）: ザハラ砂漠の出現表（WORLD_REDESIGN §4.2・§6.5、V2_PLAN §3.6 の形）。移した表 zw_desert・z_r_desert_tomb は残し、
//   縦切りの形（ティアで段が変わる '@<系統>'、組の数は tools/sim_zones.js の標準の一行で合わせる）で新しく書いた。
//   Lb = LZ(T) + lvOff。段は R.Mon.resolve('@<系統>', T)（サソリ・ヘビ・サボテン・ミミズ・ミイラは段 1 と上の段の絵がある）。
//   zw_desert           原野（砂丘・枯れ川）
//   zw_desert_road      街道（率 0.3、WORLD_REDESIGN §2.2）
//   zw_desert_caravan   隊商と一緒のとき（率 1.4。WORLD §4.2 の「出現がやや多い」）
//   zw_desert_storm     砂嵐のくぼ地（近道。率 1.5、金剛トカゲが出やすい）
//   z_desert_tomb       王墓 1〜2 階・井戸の小部屋・古い野営跡
//   z_desert_tomb_deep  王墓 3 階（王の間の前）
//   z_desert_hawks      鷹団のアジト（敵のとき）
//   z_desert_rocks      金剛トカゲの岩場（#9、レアの巣）
//   z_desert_temple     砂に沈んだ神殿（#6、lvOff 2・黄金の守護像の巣）
//   ダンジョン（z_*）の組: 砂漠は体験版の後なので 4〜5 体の組も入れる（持ち主 2026-09-28「体験版以降は 4 匹でも 5 匹でもいい。バランスみてね」）。
//   大きい組は深い階・手ごわい所（王墓 3 階・鷹団・神殿）に寄せ、軽い魔物（コウモリ）か弱い組み合わせで数を増やす。
//   浅い所（王墓 1〜2 階・岩場）は 2〜3 体が中心のまま（4 体の組は少し）。牙の宝箱だけ 1 体。数は tools/sim_zones.js で合わせた
(function (R) {
  'use strict';
  const G = (w, mons, o) => Object.assign({ w, mons }, o || {});
  Object.assign(R.DB.encounters, {
    zw_desert: { region: 'r_desert', tier: 'dyn', lvOff: 0, bg: 'desert', groups: [
      G(8, [['@scorpion', 2, 3]]),
      G(8, [['@snake', 2, 3]]),
      G(7, [['@cactus', 2, 3]]),
      G(6, [['@scorpion', 1, 2], ['@snake', 1, 1]]),   // ヘビは 1 匹（4 体の組で p95 が 20 を越えた。sim_zones）
      G(5, [['@cactus', 1, 2], ['@scorpion', 1, 1]]),
      G(4, [['@sandworm', 1, 1], ['@snake', 1, 1]]),
      G(2, [['@sandworm', 1, 1], ['@scorpion', 1, 2]], { tierMin: 1 }),
    ] },
    zw_desert_road: { region: 'r_desert', tier: 'dyn', lvOff: 0, bg: 'desert', rate: 0.3, groups: [
      G(8, [['@scorpion', 2, 3]]),
      G(8, [['@snake', 2, 3]]),
      G(6, [['@cactus', 2, 2]]),
      G(4, [['@scorpion', 1, 1], ['@snake', 1, 2]]),
    ] },
    zw_desert_caravan: { region: 'r_desert', tier: 'dyn', lvOff: 0, bg: 'desert', rate: 1.4, groups: [
      G(8, [['@scorpion', 2, 3]]),
      G(8, [['@snake', 2, 3]]),
      G(6, [['@cactus', 2, 3]]),
      G(5, [['@scorpion', 1, 2], ['@snake', 1, 2]]),
      G(4, [['@sandworm', 1, 1], ['@scorpion', 1, 1]]),
    ] },
    zw_desert_storm: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'desert', rate: 1.5, groups: [
      G(8, [['@scorpion', 2, 3]]),
      G(7, [['@sandworm', 1, 1], ['@snake', 1, 1]]),
      G(7, [['@cactus', 2, 3]]),
      G(6, [['@snake', 2, 2]]),
    ] },
    z_desert_tomb: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'pyramid', groups: [
      G(9, [['@mummy', 2, 3]]),
      G(6, [['@bat', 2, 3]]),
      G(6, [['@scorpion', 2, 3]]),
      G(6, [['@mummy', 1, 2], ['@bat', 1, 1]]),
      G(5, [['@snake', 1, 2], ['@scorpion', 1, 1]]),
      G(3, [['@sandworm', 1, 1], ['@mummy', 1, 1]]),
      G(3, [['@bat', 4, 4]]),                                   // コウモリの群れ（4 体）
      G(1.5, [['@mimic', 1, 1]], { solo: true }),
    ] },
    z_desert_tomb_deep: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'pyramid', groups: [
      G(9, [['@mummy', 2, 3]]),
      G(6, [['@bat', 4, 5]]),                                   // コウモリの群れ（4〜5 体）
      G(5, [['@mummy', 1, 1], ['@bat', 3, 3]]),                 // 4 体
      G(4, [['@scorpion', 2, 2], ['@mummy', 1, 1]]),
      G(4, [['@sandworm', 1, 1], ['@mummy', 1, 1]]),
      G(1.5, [['@mimic', 1, 1]], { solo: true }),
    ] },
    z_desert_hawks: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'cave', groups: [
      G(8, [['desert_hawk_blade', 2, 3]]),
      G(7, [['desert_hawk_blade', 1, 1], ['desert_hawk_bow', 1, 2]]),
      G(6, [['desert_hawk_bow', 2, 3]]),
      G(4, [['desert_hawk_blade', 1, 1], ['@bat', 3, 3]]),      // 洞のコウモリを連れた見回り（4 体）
      G(3, [['desert_hawk_bow', 4, 4]]),                        // 弓手の待ち伏せ（4 体）
      G(4, [['@bat', 4, 5]]),                                   // コウモリの群れ（4〜5 体）
    ] },
    z_desert_rocks: { region: 'r_desert', tier: 'dyn', lvOff: 1, bg: 'desert', groups: [
      G(8, [['@scorpion', 2, 3]]),
      G(7, [['@snake', 2, 3]]),
      G(5, [['@sandworm', 1, 1], ['@scorpion', 1, 1]]),
    ] },
    z_desert_temple: { region: 'r_desert', tier: 'dyn', lvOff: 2, bg: 'cave', groups: [
      G(9, [['@mummy', 2, 2]]),
      G(7, [['@scorpion', 2, 2]]),
      G(6, [['@mummy', 1, 1], ['@snake', 1, 1]]),
      G(4, [['@sandworm', 1, 1], ['@mummy', 1, 1]]),
      G(3, [['@mummy', 4, 4]]),                                 // 奥殿の見回り（4 体。段 2 の魔物は硬いので 4 体まで）
      G(1.5, [['@mimic', 1, 1]], { solo: true }),
    ] },
  });
  // レア魔物（金剛トカゲの巣は岩場と砂嵐のくぼ地、黄金の守護像は王墓の奥と沈んだ神殿）
  Object.assign(R.DB.rareEncounters, {
    zw_desert: { mon: 'rm_diamond_lizard', rate: 80 },
    zw_desert_road: { mon: 'rm_diamond_lizard', rate: 120 },
    zw_desert_caravan: { mon: 'rm_diamond_lizard', rate: 80 },
    zw_desert_storm: { mon: 'rm_diamond_lizard', rate: 30 },
    z_desert_rocks: { mon: 'rm_diamond_lizard', rate: 12 },
    z_desert_tomb: { mon: 'rm_gold_idol', rate: 80 },
    z_desert_tomb_deep: { mon: 'rm_gold_idol', rate: 60 },
    z_desert_temple: { mon: 'rm_gold_idol', rate: 16 },
  });
})(window.RPG);
