// RULES（砂漠）: ザハラ砂漠の店（WORLD_REDESIGN §5.5・§2.7 #7・#10、V2_PLAN §3.7 の形）。どの店もティアで品が変わる（地方は好きな順に遊ぶ）。
//   shop_kasim_items   カシムの道具屋（keepOld: 段を足していく）
//   shop_kasim_arms    カシムの市場の武具の屋台（その時のティアの段だけ）
//   shop_kasim_bazaar  市場の屋台（石・状態よけ・能力のアクセサリ。値切りの相手）
//   shop_sandedge      宿場「砂の縁」の道具
//   shop_lotta         行商人ロッタ（配達の回数で段が増える: 変数 desert_lotta。tier の段の代わりに EVENTS が段を選ぶ）
//   shop_hawks         砂の鷹団のアジトの盗賊の店（短剣・弓・盗みの品。払ったときは値が高い＝イベントが倍率を渡す）
(function (R) {
  'use strict';
  const WEAPON_LINES = ['w_sword', 'w_greatsword', 'w_greatsword_maul', 'w_dagger', 'w_bow', 'w_staff', 'w_staff_prayer'];
  const ARMOR_LINES = ['sh_buckler', 'sh_tower', 'sh_shield', 'sh_round', 'sh_book', 'sh_charm', 'hd_helm', 'hd_band', 'hd_cap', 'hd_scarf', 'hd_hat', 'hd_hood',
    'bd_mail', 'bd_plate', 'bd_vest', 'bd_garb', 'bd_robe', 'bd_habit', 'hn_gauntlet', 'hn_bracer', 'hn_glove', 'hn_armlet', 'hn_longglove', 'hn_mitten',
    'ft_greave', 'ft_shin', 'ft_boots', 'ft_shoes', 'ft_slipper', 'ft_sandal'];
  const T0ID = { w_sword: 'w_sword_iron', w_greatsword: 'w_greatsword_iron', w_greatsword_maul: 'w_greatsword_club', w_dagger: 'w_dagger_iron',
    w_bow: 'w_bow_short', w_staff: 'w_staff_novice', bd_mail: 'bd_iron_cuirass', hd_band: 'hd_iron_band', sh_buckler: 'sh_iron_buckler',
    bd_vest: 'bd_leather_vest', hd_cap: 'hd_leather_cap', sh_shield: 'sh_leather', bd_robe: 'bd_hemp_robe', hd_hood: 'hd_wool_hood', sh_book: 'sh_primer' };
  const at = (line, t) => (t === 0 && T0ID[line]) || `${line}_${t}`;
  const has = (id) => !!R.DB.items[id];
  const gear = (lines, t) => lines.map((l) => at(l, t)).filter(has);
  const S0 = ['i_salve', 'i_revive', 'i_antidote', 'i_clear', 'i_waker', 'i_repel', 'i_torch', 'i_smoke', 'i_firepot'];
  const S1 = ['i_potion', 'i_ether', 'i_numb', 'i_throat', 'i_lure', 'i_lens'];
  const S2 = ['i_incense', 'i_thaw', 'i_bomb', 'i_horn', 'i_censer'];
  const S3 = ['i_elixir', 'i_ether2', 'i_panacea'];
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  const WARDS = ['ac_ward_poison', 'ac_ward_blind', 'ac_ward_sleep', 'ac_ward_paralyze', 'ac_ward_silence', 'ac_ward_confuse', 'ac_ward_stun'];
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`);
  const tiers = (fn, from, to) => { const o = {}; for (let t = from; t <= to; t++) o[t] = fn(t); return o; };

  // 値の倍率（shop.js の priceMul）: 解決の後は隊商ギルドの口ききで 1 割安い。屋台は値切りに勝つとさらに安い。
  //   鷹団の闇市は、通行料を払った（中立）なら 5 割高い。
  const flag = (f) => !!(R.Game && R.Game.flags && R.Game.flags[f]);
  const guild = () => (flag('cleared_r_desert') ? 0.9 : 1);
  const bazaar = () => guild() * (flag('desert_haggled') ? 0.85 : 1);
  const hawks = () => { const c = R.Game && R.Game.choices && R.Game.choices.ch_desert_hawk; return c === 'pay' ? 1.5 : 1; };

  R.onData(function () {
    const f = (a) => a.filter(has);
    R.defs('shops', {
      shop_kasim_items: { name: 'カシムの道具屋', kind: 'item', priceMul: guild, keepOld: true, sell: true, items: f(S0.concat(S1, ['i_stone_earth', 'i_stone_wind'])), tier: { 2: f(S2), 4: f(S3) } },
      shop_kasim_arms: { name: '市場の武具の屋台', kind: 'weapon', priceMul: guild, keepOld: false, sell: true,
        items: gear(WEAPON_LINES, 0).concat(gear(WEAPON_LINES, 1), gear(ARMOR_LINES, 0)),
        tier: tiers((t) => gear(WEAPON_LINES, t).concat(gear(WEAPON_LINES, t + 1), gear(ARMOR_LINES, t)), 1, 8) },
      shop_kasim_bazaar: { name: '市場の屋台', kind: 'special', priceMul: bazaar, keepOld: false, sell: true,
        items: f(STONES.concat(WARDS.slice(0, 4), ACC(0))), tier: tiers((t) => f(STONES.concat(WARDS, ACC(Math.min(t, 8)))), 1, 8) },
      shop_sandedge: { name: '砂の縁の売り台', kind: 'item', keepOld: true, sell: true, items: f(S0.concat(['i_potion', 'i_ether'])), tier: { 2: f(['i_incense', 'i_thaw']), 4: f(['i_elixir']) } },
      shop_lotta: { name: 'ロッタの背負い籠', kind: 'special', keepOld: false, sell: true,
        items: f(['ac_watch', 'ac_quiet', 'i_lure']), tier: { 1: f(['ac_watch', 'ac_quiet', 'ac_loupe', 'i_lure', 'i_lens']), 2: f(['ac_watch', 'ac_quiet', 'ac_loupe', 'ac_clover', 'i_lure', 'i_lens']) } },
      shop_hawks: { name: '鷹団の闇市', kind: 'weapon', priceMul: hawks, keepOld: false, sell: true,
        items: f(gear(['w_dagger', 'w_bow'], 1).concat(['i_smoke', 'i_lure', 'ac_quickhand'])),
        tier: tiers((t) => f(gear(['w_dagger', 'w_bow'], t + 1).concat(['i_smoke', 'i_lure', 'ac_quickhand', 'ac_purse'])), 1, 8) },
    });
  });
})(window.RPG);
