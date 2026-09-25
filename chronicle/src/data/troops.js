// Troops (DESIGN §9.1.5, §9.11.4 table 2, §9.11.7, §10.13.5): 26 boss troops + the
// tutorial event troop. `mons` is left→right. '@lineage' entries are ordinary mobs whose
// stage is picked by the battle's tier and stretched to the same Lb.
//   scale:'tier'  → tier = R.Game.tier (mid-game regions, 0..7), Lb = LZ(T) + lvOff
//   tier:n        → fixed tier (prologue 0, rival 2/5, finale 8, postgame 9)
//   lv:n          → prologue only: Lb written directly
// Rival fights have no bg (they use the town's own backdrop). The event side calls
// ev.battle('<troop>'); Rowell is canLose, the tutorial is §9.11.7's exact call.
(function (R) {
  'use strict';

  const boss = (mons, o) => Object.assign({ mons, noEscape: true }, o);

  Object.assign(R.DB.troops, {
    // 序章
    tr_b_pageeater: boss([['b_pageeater', 1]], { tier: 0, lv: 8, bg: 'tower', bgm: 'boss' }),
    // 中盤の 8 地方（中ボス → 地方ボス）
    tr_b_moth: boss([['b_moth', 1]], { scale: 'tier', lvOff: 2, bg: 'forest', bgm: 'boss' }),
    tr_b_rooteater: boss([['b_root', 1], ['b_rooteater', 1], ['b_root', 1]], { scale: 'tier', lvOff: 3, bg: 'tree', bgm: 'boss2' }),
    tr_b_sandworm: boss([['b_sandworm', 1]], { scale: 'tier', lvOff: 2, bg: 'pyramid', bgm: 'boss' }),
    tr_b_sandking: boss([['@mummy', 1], ['b_sandking', 1], ['@mummy', 1]], { scale: 'tier', lvOff: 3, bg: 'pyramid', bgm: 'boss2' }),
    tr_b_icegiant: boss([['b_icegiant', 1]], { scale: 'tier', lvOff: 2, bg: 'ice', bgm: 'boss' }),
    tr_b_whitedragon: boss([['b_whitedragon', 1]], { scale: 'tier', lvOff: 3, bg: 'snow', bgm: 'boss2' }),
    tr_b_dolls: boss([['b_doll_violin', 1], ['b_doll_conductor', 1], ['b_doll_drum', 1], ['b_doll_flute', 1]],
      { scale: 'tier', lvOff: 2, bg: 'manor', bgm: 'boss' }),
    tr_b_mistbeast: boss([['b_mistbeast', 1]], { scale: 'tier', lvOff: 3, bg: 'swamp', bgm: 'boss2' }),
    tr_b_octopus: boss([['b_tentacle', 1], ['b_octopus', 1], ['b_tentacle', 1]], { scale: 'tier', lvOff: 2, bg: 'watercave', bgm: 'boss' }),
    tr_b_captain: boss([['@skeleton', 1], ['b_captain', 1], ['@skeleton', 1]], { scale: 'tier', lvOff: 3, bg: 'ship', bgm: 'boss2' }),
    tr_b_rockeater: boss([['b_rockeater', 1]], { scale: 'tier', lvOff: 2, bg: 'mine', bgm: 'boss' }),
    tr_b_ironwarden: boss([['b_ironwarden', 1]], { scale: 'tier', lvOff: 3, bg: 'mine', bgm: 'boss2' }),
    tr_b_hellhound: boss([['b_hellhound', 1]], { scale: 'tier', lvOff: 2, bg: 'volcano', bgm: 'boss' }),
    tr_b_lavabeast: boss([['b_lavabeast', 1]], { scale: 'tier', lvOff: 3, bg: 'volcano', bgm: 'boss2' }),
    tr_b_orrery: boss([['b_orrery', 1]], { scale: 'tier', lvOff: 2, bg: 'tower', bgm: 'boss' }),
    tr_b_stareater: boss([['b_stareater', 1]], { scale: 'tier', lvOff: 3, bg: 'tower', bgm: 'boss2' }),
    // ライバル（町で戦う。負けても続く）
    tr_b_rowell1: boss([['b_rowell1', 1]], { tier: 2, lvOff: 2, bgm: 'rival' }),
    tr_b_rowell2: boss([['b_rowell2', 1]], { tier: 5, lvOff: 2, bgm: 'rival' }),
    // 終盤 白の大書庫
    tr_b_bookgolem: boss([['b_bookgolem', 1]], { tier: 8, lvOff: 2, bg: 'library', bgm: 'boss2' }),
    tr_b_heroshades: boss([['b_shade_sword', 1], ['b_shade_prayer', 1], ['b_shade_star', 1]], { tier: 8, lvOff: 2, bg: 'library', bgm: 'boss2' }),
    tr_b_lazaro: boss([['b_lazaro', 1]], { tier: 8, lvOff: 2, bg: 'library', bgm: 'tension' }),
    tr_b_nemrea1: boss([['b_nemrea1', 1]], { tier: 8, lvOff: 4, bg: 'library', bgm: 'boss2' }),
    tr_b_nemrea2: boss([['b_nemrea2', 1]], { tier: 8, lvOff: 4, bg: 'library', bgm: 'lastboss' }),
    // クリア後 忘却の底
    tr_b_valzard_echo: boss([['b_valzard_echo', 1]], { tier: 9, lvOff: 4, bg: 'oblivion', bgm: 'boss2' }),
    tr_b_ouroboros: boss([['b_ouroboros', 1]], { tier: 9, lvOff: 8, bg: 'oblivion', bgm: 'superboss' }),

    // イベント戦: 灯台1階のチュートリアル（§9.11.7。主人公ひとりで野ネズミ 2 匹）
    tr_tutorial: { mons: [['rat_1', 2]], tier: 0, lv: 2, bg: 'tower', bgm: 'battle', noEscape: true },
  });

  // P2 backdrops/tunes (§11.0 0.17, §11.2.13, §11.13): switch to them once they exist.
  // Nothing breaks without them (the art/audio side also falls back on its own).
  R.onData(() => {
    const T = R.DB.troops;
    const hasBg = (id) => !!(R.Gfx && R.Gfx.has && R.Gfx.has('bbg:' + id));
    const hasBgm = (id) => !!(R.DB.music && R.DB.music[id]);
    if (hasBg('hollow')) { T.tr_b_nemrea1.bg = 'hollow'; T.tr_b_nemrea2.bg = 'hollow'; }
    if (hasBg('ring')) T.tr_b_ouroboros.bg = 'ring';
    if (hasBgm('hollowking')) T.tr_b_nemrea1.bgm = 'hollowking';
    if (hasBgm('valzard')) T.tr_b_valzard_echo.bgm = 'valzard';
  });
})(window.RPG);
