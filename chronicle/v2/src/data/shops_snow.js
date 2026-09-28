// 雪原の店（RULES の形 K.shop。WORLD_REDESIGN §4.3「守った門で品ぞろえ」・§5 ユール・§2.7 #14 峠の宿）。どのティアで来ても並ぶように 0〜8 の段を持つ。
//   shop_yule_items    ユールの道具屋（keepOld。凍え・やけどの薬と火のつぼを早めに）
//   shop_yule_arms     ユールの武具屋（いちばん新しい段）。籠城で東の門が破られると、倉が荒らされて 1 段下の品ぞろえ（shop_yule_arms_low）
//   shop_yule_fur      毛皮の行商（防具だけ。祭の間だけ広場に出る）
//   shop_pass_inn      峠の宿の売店（道具＋ティアの防具）
(function (R) {
  'use strict';
  const WEAPON_LINES = ['w_sword', 'w_greatsword', 'w_greatsword_maul', 'w_dagger', 'w_bow', 'w_staff', 'w_staff_prayer'];
  // 防具は 1 枠・1 重さに 1 系列（名前しか違わなかった 2 系列は items_armor.js でまとめた。消した id は R.DB.itemAlias）
  const ARMOR_LINES = ['sh_buckler', 'sh_shield', 'sh_book', 'hd_helm', 'hd_cap', 'hd_hood',
    'bd_mail', 'bd_vest', 'bd_robe', 'hn_gauntlet', 'hn_glove', 'hn_longglove', 'ft_greave', 'ft_boots', 'ft_sandal'];
  const T0ID = { w_sword: 'w_sword_iron', w_greatsword: 'w_greatsword_iron', w_greatsword_maul: 'w_greatsword_club', w_dagger: 'w_dagger_iron',
    w_bow: 'w_bow_short', w_staff: 'w_staff_novice', bd_mail: 'bd_iron_cuirass', sh_buckler: 'sh_iron_buckler',
    bd_vest: 'bd_leather_vest', hd_cap: 'hd_leather_cap', sh_shield: 'sh_leather', bd_robe: 'bd_hemp_robe', hd_hood: 'hd_wool_hood', sh_book: 'sh_primer' };
  const at = (line, t) => (t === 0 && T0ID[line]) || `${line}_${t}`;
  const has = (id) => !!(R.DB.items && R.DB.items[id]);
  const gear = (lines, t) => lines.map((l) => at(l, t)).filter(has);
  const TIERS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const byTier = (fn, from) => { const o = {}; for (const t of TIERS) if (t >= (from || 1)) o[t] = fn(t); return o; };
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  const IT = {
    0: ['i_salve', 'i_revive', 'i_antidote', 'i_waker', 'i_firepot', 'i_torch', 'i_repel', 'i_smoke', 'ac_ward_freeze', 'ac_ward_sleep', 'i_stone_fire'],
    1: ['i_potion', 'i_ether', 'i_clear', 'i_numb', 'i_lens', 'i_lure', 'ac_ward_stun', 'ac_ward_confuse'].concat(STONES),
    2: ['i_thaw', 'i_incense', 'i_bomb', 'i_horn', 'i_censer'],
    3: ['i_potion2', 'i_ether2', 'i_panacea'],   // 中盤の回復（HP150・MP40。items_use.js の段）
    5: ['i_elixir'],
  };
  // 癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28「全回復系は基本終盤から」。pools.js の LATE）
  const items = (t) => (IT[t] || []).filter(has);
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`).filter(has);
  R.onData(function () {
    const arms = (sh) => ({ items: gear(WEAPON_LINES, Math.max(0, sh)).concat(gear(ARMOR_LINES, Math.max(0, sh))), tier: byTier((t) => gear(WEAPON_LINES, Math.max(0, t + sh)).concat(gear(ARMOR_LINES, Math.max(0, t + sh)))) });
    R.defs('shops', {
      shop_yule_items: { name: 'ユールの道具屋', kind: 'item', keepOld: true, sell: true, items: items(0).concat(ACC(0)), tier: { 1: items(1), 2: items(2).concat(ACC(1)), 3: items(3), 5: (ACC(2).length ? ACC(2) : items(3)).concat(items(5)) } },
      shop_yule_arms: Object.assign({ name: 'ユールの武具屋', kind: 'weapon', keepOld: false, sell: true }, arms(0)),
      shop_yule_arms_low: Object.assign({ name: 'ユールの武具屋（荒らされた倉）', kind: 'weapon', keepOld: false, sell: true }, arms(-1)),
      shop_yule_fur: { name: '毛皮の行商', kind: 'weapon', keepOld: false, sell: true, items: gear(ARMOR_LINES, 0), tier: byTier((t) => gear(ARMOR_LINES, t)) },
      shop_pass_inn: { name: '峠の宿の売店', kind: 'item', keepOld: true, sell: true, items: items(0).concat(items(1)), tier: { 2: items(2), 3: items(3), 5: items(5) } },
    });
  });
})(window.RPG);
