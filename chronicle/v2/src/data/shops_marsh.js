// 湿原の店（RULES の形 K.shop。WORLD_REDESIGN §4.4・§5.7）。どのティアで来ても並ぶように 0〜8 の段を持つ。
//   shop_loch_items    大鐘の道具屋（keepOld。毒・眠り・暗闇の備えを早めに）
//   shop_loch_arms     大鐘の武具屋（いちばん新しい段）
//   shop_loch_night    夜市の屋台（消灯の刻だけ。珍しい道具と、段ごとのお守り）
(function (R) {
  'use strict';
  const WEAPON_LINES = ['w_sword', 'w_greatsword', 'w_greatsword_maul', 'w_dagger', 'w_bow', 'w_staff', 'w_staff_prayer'];
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
  const IT = {
    0: ['i_salve', 'i_revive', 'i_antidote', 'i_waker', 'i_torch', 'i_repel', 'i_smoke', 'ac_ward_sleep', 'ac_ward_poison', 'i_stone_wind'],
    1: ['i_potion', 'i_ether', 'i_clear', 'i_numb', 'i_lens', 'ac_ward_blind', 'ac_ward_confuse', 'i_stone_light'],
    2: ['i_incense', 'i_horn', 'i_censer', 'i_bomb'],
    3: ['i_elixir', 'i_ether2', 'i_panacea'],
  };
  const items = (t) => (IT[t] || []).filter(has);
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`).filter(has);
  R.onData(function () {
    const arms = { items: gear(WEAPON_LINES, 0).concat(gear(ARMOR_LINES, 0)), tier: byTier((t) => gear(WEAPON_LINES, t).concat(gear(ARMOR_LINES, t))) };
    R.defs('shops', {
      shop_loch_items: { name: '大鐘の道具屋', kind: 'item', keepOld: true, sell: true, items: items(0).concat(ACC(0)), tier: { 1: items(1), 2: items(2).concat(ACC(1)), 3: items(3), 5: ACC(2).length ? ACC(2) : items(3) } },
      shop_loch_arms: Object.assign({ name: '大鐘の武具屋', kind: 'weapon', keepOld: false, sell: true }, arms),
      shop_loch_night: { name: '夜市の屋台', kind: 'item', keepOld: true, sell: true, items: items(1).concat(['i_lotus_dew'].filter(has)), tier: { 2: items(2).concat(ACC(1)), 4: items(3).concat(ACC(2)) } },
    });
  });
})(window.RPG);
