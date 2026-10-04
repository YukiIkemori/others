// v2（BATTLE、2026-10-01 ボスの組み直し w_boss2）: ボスの数値 s の最後の上書き（bosses*.js の後に読む。fillStats は onData なのでここで効く）。
//   オーナー「勝率低めでいいよ」: 台本（sim_bosses の script）の勝率が 序盤 75〜85%・中盤 65〜80%・終盤 60〜70%、長さが 中盤 6〜12・終盤 10〜16 ラウンドになるように、
//   各地方のファイルの s に群ごとの倍率（atk・mag × k、hp × h）を掛けた値。調整は scratch の autotune.js（群は groups.js）。各地方のファイルの s を直すときはここも見ること
// @@JSON {"wolves":[1.39,1],"moth":[1.64,1],"rooteater":[1.45,1],"bwolf":[2.24,1],"icegiant":[1.18,1],"whitedragon":[1.57,1],"admiral":[1.16,1],"vein":[1.38,1],"dolls":[1.28,1],"mist":[1.12,1],"ash_r2":[3.58,1.44],"ash_r3":[3.2,1.21],"ash_r4":[10,0.9],"zakuro":[3.32,1.2],"hellhound":[3.95,1.44],"lavabeast":[1.96,1.44],"octopus":[1.16,1],"captain":[1.15,1],"rockeater":[1.25,1],"ironwarden":[1.1,1],"orrery":[1.8,1],"stareater":[1.92,1.44],"rowell2":[1.57,1],"bookgolem":[3.2,1.44],"shades":[1.89,1.1],"lazaro":[2,1],"nemrea1":[1.65,1],"nemrea2":[1.7,1.73],"pageeater":[2.7,1],"hawk":[3.5,1.18],"sandworm":[4.06,0.83],"sandking":[3.76,1.64],"rowell1":[4.5,1]}
(function (R) {
  'use strict';
  const S = {
    b_pageeater: { hp: 1.3, atk: 1.89, mag: 2.7 },   // pageeater
    b_wolflord: { hp: 1.6, atk: 2.08, mag: 1.39 },   // wolves
    b_packwolf: { atk: 1.11, mag: 1.11, hp: 1 },   // wolves
    b_moth: { hp: 1.2, atk: 3.61, mag: 3.61 },   // moth
    b_rooteater: { hp: 0.95, atk: 2.17, mag: 2.17 },   // rooteater
    b_root: { hp: 1, atk: 0.72, mag: 0.72 },   // rooteater
    b_hawk_chief: { hp: 1, atk: 3.5, mag: 3.5 },   // hawk
    b_hawk_bow: { atk: 2.45, mag: 2.45, hp: 1.18 },   // hawk
    b_sandworm: { hp: 1.12, atk: 4.06, mag: 4.06 },   // sandworm
    b_sandking: { hp: 0.85, atk: 2.26, mag: 2.26 },   // sandking
    b_sun_orb: { atk: 2.26, mag: 2.26, hp: 1.64 },   // sandking
    b_moon_orb: { atk: 2.26, mag: 2.26, hp: 1.64 },   // sandking
    b_rowell1: { hp: 1.35, atk: 4.5, mag: 4.5 },   // rowell1
    b_blizzardwolf: { hp: 1.6, atk: 3.14, mag: 3.14 },   // bwolf
    b_blizzardwolf_1: { hp: 1.6, atk: 3.14, mag: 3.14 },   // bwolf
    b_blizzardwolf_2: { hp: 1.6, atk: 3.14, mag: 3.14 },   // bwolf
    b_siegewolf: { hp: 0.8, atk: 0.9, mag: 0.9 },   // bwolf
    b_icegiant: { hp: 1, atk: 3.19, mag: 3.19 },   // icegiant
    b_whitedragon: { hp: 1, atk: 1.1, mag: 1.1 },   // whitedragon
    b_frost_admiral: { hp: 0.5, atk: 0.81, mag: 0.81 },   // admiral
    b_frost_sailor: { atk: 0.7, mag: 0.7, hp: 1 },   // admiral
    b_vein_lord: { hp: 0.5, atk: 1.38, mag: 1.38 },   // vein
    b_vein_shard: { atk: 0.76, mag: 0.76, hp: 1 },   // vein
    b_doll_conductor: { hp: 2.7, atk: 1.05, mag: 1.05 },   // dolls
    b_doll_violin: { hp: 1.05, atk: 0.96, mag: 0.96 },   // dolls
    b_doll_drum: { hp: 1.05, atk: 0.96, mag: 0.96 },   // dolls
    b_doll_flute: { hp: 1.05, atk: 0.96, mag: 0.96 },   // dolls
    b_mistbeast: { hp: 0.47, atk: 1.18, mag: 1.18 },   // mist
    b_mist_double: { hp: 0.7, atk: 0.56, mag: 0.56 },   // mist
    b_tamer: { hp: 1.3, atk: 1.97, mag: 1.97 },   // ash_r2
    b_rockbeast: { hp: 1.3, atk: 1.97, mag: 1.97 },   // ash_r2
    b_sister_elder: { hp: 0.97, atk: 1.76, mag: 1.76 },   // ash_r3
    b_sister_younger: { hp: 0.97, atk: 1.76, mag: 1.76 },   // ash_r3
    b_armorman: { hp: 1.17, atk: 5.5, mag: 5.5, def: 1.4 },   // ash_r4
    b_zakuro: { hp: 1.68, atk: 1.99, mag: 1.99 },   // zakuro
    b_hellhound: { hp: 1.37, atk: 1.58, mag: 1.58 },   // hellhound
    b_lavabeast: { hp: 0.72, atk: 1.14, mag: 1.14 },   // lavabeast
    b_octopus: { hp: 1.3, atk: 2.78, mag: 2.78 },   // octopus
    b_tentacle: { hp: 1.1, atk: 1.97, mag: 1.97 },   // octopus
    b_captain: { hp: 0.5, atk: 1.32, mag: 1.32 },   // captain
    b_rockeater: { hp: 1.2, atk: 4.13, mag: 4.13 },   // rockeater
    b_ironwarden: { hp: 0.52, atk: 0.88, mag: 0.88 },   // ironwarden
    b_orrery: { hp: 1.15, atk: 2.52, mag: 2.52 },   // orrery
    b_stareater: { hp: 0.89, atk: 1.13, mag: 1.13 },   // stareater
    b_rowell2: { hp: 1.1, atk: 1.57, mag: 1.57 },   // rowell2
    b_bookgolem: { hp: 0.65, atk: 2.72, mag: 2.72 },   // bookgolem
    b_shade_sword: { hp: 0.94, atk: 1.13, mag: 1.13 },   // shades
    b_shade_prayer: { hp: 1.04, atk: 1.13, mag: 1.13 },   // shades
    b_shade_star: { hp: 1.04, atk: 1.13, mag: 1.13 },   // shades
    b_lazaro: { hp: 0.68, atk: 2, mag: 2 },   // lazaro
    // 持ち主 2026-10-04（装備のティアの見直し）: 最後のボスは店 8 だけでは勝てず（台本 ≤ 35%）、終章のレア 9 を集めると勝てる・超レア 10 があれば楽（tools/sim_gear_bosses.js の F-a・F-b・F-c）。
    //   第 1 形態 hp 0.5 → 0.7・atk 1.48 → 1.8、第 2 形態 hp 1.73 → 2.3・atk 1.05 → 1.35
    b_nemrea1: { hp: 0.7, atk: 1.8, mag: 1.8 },   // nemrea1
    b_nemrea2: { atk: 1.35, mag: 1.35, hp: 2.3 },   // nemrea2
  };
  for (const id of Object.keys(S)) if (R.DB.monsters[id]) R.DB.monsters[id].s = S[id];
})(window.RPG);
