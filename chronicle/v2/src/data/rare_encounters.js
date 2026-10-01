// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/rare_encounters.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// Rare-monster rows (DESIGN §9.7.3, §9.10): one rare monster per zone, 23 of the 26
// zones. `rate` is a denominator (80 = 1/80, §9.0 0.18); battle applies rareEncPct and
// the lure ×2 (§4.10.3). 夢食いバク is the super-rare one (1/200).
(function (R) {
  'use strict';
  Object.assign(R.DB.rareEncounters, {
    zw_prologue: { mon: 'rm_jewel_hare', rate: 80 },
    zw_forest: { mon: 'rm_bloom_fawn', rate: 80 },
    z_r_forest_maze: { mon: 'rm_glass_moth', rate: 80 },
    z_r_forest_tree: { mon: 'rm_acorn_prince', rate: 80 },
    zw_desert: { mon: 'rm_diamond_lizard', rate: 80 },
    z_r_desert_tomb: { mon: 'rm_gold_idol', rate: 80 },
    zw_snow: { mon: 'rm_aurora_bird', rate: 80 },
    z_r_snow_peak: { mon: 'rm_icetail_fox', rate: 80 },
    zw_marsh: { mon: 'rm_lotus_sprite', rate: 80 },
    z_r_marsh_manor: { mon: 'rm_ghost_teapot', rate: 80 },
    z_r_marsh_bog: { mon: 'rm_bell_snail', rate: 80 },
    zw_isles: { mon: 'rm_star_whale', rate: 80 },
    z_r_isles_ship: { mon: 'rm_treasure_crab', rate: 80 },
    zw_mine: { mon: 'rm_gem_hedgehog', rate: 80 },
    z_r_mine_mine: { mon: 'rm_prisma', rate: 80 },
    zw_ash: { mon: 'rm_spa_monkey', rate: 80 },
    z_r_ash_volcano: { mon: 'rm_volcano_turtle', rate: 80 },
    zw_star: { mon: 'rm_moon_sheep', rate: 80 },
    z_r_star_tower: { mon: 'rm_clock_bird', rate: 80 },
    z_finale_archive_lo: { mon: 'rm_bookworm', rate: 80 },
    z_finale_archive_hi: { mon: 'rm_golden_quill', rate: 80 },
    z_postgame_oblivion_lo: { mon: 'rm_memory_fish', rate: 80 },
    z_postgame_oblivion_hi: { mon: 'rm_dream_tapir', rate: 200 },
  });
  // @@V2-BEGIN 縦切りの差し替え（V2_PLAN §3.6、BATTLE）。配列は上から順に cond（R.State.check）が成り立つ最初の行
  Object.assign(R.DB.rareEncounters, {
    zw_peninsula: { mon: 'rm_jewel_hare', rate: 80 },
    zw_forest: { mon: 'rm_acorn_prince', rate: 80 },
    zw_forest_road: { mon: 'rm_acorn_prince', rate: 80 },
    // 花角の小鹿は森を解決した後の巣（迷いの森）。それまではどんぐり王子
    z_verda: [{ mon: 'rm_bloom_fawn', rate: 40, cond: 'cleared_r_forest' }, { mon: 'rm_acorn_prince', rate: 80 }],
    z_well: { mon: 'rm_jewel_hare', rate: 40 },   // 宝石ウサギの巣
  });
  // 実際の率はこの rate（分母）に R.Mon.K.RARE_SCALE（2）を掛けた物（持ち主 2026-10-01「レア敵が多すぎるのは駄目なので下げる」。systems/mon.js）
  // @@V2-END
})(window.RPG);
