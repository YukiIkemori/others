// オルビス高原の店（RULES の形 K.shop。WORLD_REDESIGN §4.8・§5.12）。どのティアで来ても並ぶように 0〜8 の段を持つ。
//   shop_orbis_items   道具屋（keepOld）
//   shop_orbis_arms    武具屋（いちばん新しい段）
//   shop_orbis_magic   学院の術具店（石・書・アクセサリ）。学長が表向き無関係でいられた（こっそり）なら学院の口ききで 1 割安い（priceMul）。
//                      騒ぎを起こして学長が職を退くと、割引はなくなる（WORLD §4.8 の選択と結果）
//   shop_orbis_tailor  仕立屋の売り台（学院の制服・長衣の類。制服は大事な物なので事件の中で売る: events）
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
    0: ['i_salve', 'i_revive', 'i_antidote', 'i_waker', 'i_torch', 'i_repel', 'i_smoke', 'i_stone_water', 'ac_ward_blind'],
    1: ['i_potion', 'i_ether', 'i_clear', 'i_numb', 'i_lens', 'i_stone_wind'],
    2: ['i_incense', 'i_horn', 'i_censer', 'i_bomb'],
    3: ['i_potion2', 'i_ether2', 'i_panacea'],
    5: ['i_elixir'],
  };
  const items = (t) => (IT[t] || []).filter(has);
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`).filter(has);
  const MAGIC = (t) => ['ac_int_' + t, 'ac_mnd_' + t].concat(gear(['sh_book', 'bd_robe', 'hd_hood', 'w_staff', 'w_staff_prayer'], t)).filter(has);
  // 学院の口きき: 解決のあと、こっそり（学長が表向き無関係）なら 1 割安い。騒ぎなら割引なし
  const academy = () => { const G = R.Game; return G && G.flags && G.flags.cleared_r_star && G.choices && G.choices.ch_star_way === 'sneak' ? 0.9 : 1; };
  R.onData(function () {
    const arms = { items: gear(WEAPON_LINES, 0).concat(gear(ARMOR_LINES, 0)), tier: byTier((t) => gear(WEAPON_LINES, t).concat(gear(ARMOR_LINES, t))) };
    R.defs('shops', {
      shop_orbis_items: { name: 'オルビスの道具屋', kind: 'item', keepOld: true, sell: true, items: items(0).concat(ACC(0)), tier: { 1: items(1), 2: items(2).concat(ACC(1)), 3: items(3), 5: (ACC(2).length ? ACC(2) : items(3)).concat(items(5)) } },
      shop_orbis_arms: Object.assign({ name: 'オルビスの武具屋', kind: 'weapon', keepOld: false, sell: true }, arms),
      shop_orbis_magic: { name: '学院の術具店', kind: 'special', priceMul: academy, keepOld: false, sell: true,
        items: MAGIC(0).concat(['i_ether', 'i_lens'].filter(has)), tier: byTier((t) => MAGIC(t)) },
    });
  });
})(window.RPG);
