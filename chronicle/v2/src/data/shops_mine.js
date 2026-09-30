// ガルド山地の店（RULES の形 K.shop。WORLD_REDESIGN §4.6・§5.10）。どのティアで来ても並ぶように 0〜8 の段を持つ。
//   shop_dovan_items  ドヴァンの道具屋（keepOld）
//   shop_dovan_forge  鍛冶場の武器・防具（鍛冶衆の売り台。いちばん新しい段）。鍛冶衆につく（B）か仲裁（C）で、一段上の品が先に並ぶ
//   shop_dovan_guild  鉱夫組合の売り台（坑夫の道具・薬・アクセサリ）。組合につく（A）か仲裁（C）で、一段上の品が先に並ぶ
//   A で鍛冶衆は町を去る（鍛冶場の売り台は閉まる。WORLD §4.6 の表。売り手は event の側で「店じまい」を言う）
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
    0: ['i_salve', 'i_revive', 'i_antidote', 'i_waker', 'i_torch', 'i_repel', 'i_smoke', 'i_stone_earth', 'ac_ward_blind'],
    1: ['i_potion', 'i_ether', 'i_clear', 'i_numb', 'i_lens', 'i_stone_fire'],
    2: ['i_incense', 'i_horn', 'i_censer', 'i_bomb'],
    3: ['i_potion2', 'i_ether2', 'i_panacea'],
    5: ['i_elixir'],
  };
  // 珍しい武器（items_weapons_rare.js の段 1・3・5・7。一本ずつ打つので 4 品だけ）
  const RARE = (t) => ['w_sword_r' + t, 'w_greatsword_r' + t + 'm', 'w_bow_r' + t, 'w_staff_r' + t].filter(has);
  const items = (t) => (IT[t] || []).filter(has);
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`).filter(has);
  // 選んだ道で一段上の品を先取り（ティアの段を 1 つ前へ）
  const side = () => { const G = R.Game; return (G && G.choices && G.choices.ch_mine_side) || null; };
  const ahead = (tbl) => { const up = {}; for (const [t, v] of Object.entries(tbl)) up[Math.max(0, +t - 1)] = (up[Math.max(0, +t - 1)] || []).concat(v); return up; };
  R.onData(function () {
    const forgeTier = byTier((t) => gear(WEAPON_LINES, t).concat(gear(ARMOR_LINES, t)));
    const guild = { 1: items(1).concat(ACC(0)), 2: items(2).concat(ACC(1)), 4: items(3).concat(ACC(2)), 5: items(5), 6: ACC(3) };
    R.defs('shops', {
      shop_dovan_items: { name: R.T('shops.shop_dovan_items.name'), kind: 'item', keepOld: true, sell: true, items: items(0).concat(ACC(0)), tier: { 1: items(1), 2: items(2).concat(ACC(1)), 3: items(3), 5: (ACC(2).length ? ACC(2) : items(3)).concat(items(5)) } },
      shop_dovan_forge: { name: R.T('shops.shop_dovan_forge.name'), kind: 'weapon', keepOld: false, sell: true, items: gear(WEAPON_LINES, 0).concat(gear(ARMOR_LINES, 0)),
        get tier() { const s = side(); return s === 'smiths' || s === 'accord' ? ahead(forgeTier) : forgeTier; } },
      // (2026-09-30) 鍛冶衆の隠れ村ヴォルクの大鍛冶場（ティアで入れ替わる珍しい武器 3〜4 品。WORLD §2.7 #16）
      shop_volk_arms: { name: R.T('shops.shop_volk_arms.name'), kind: 'weapon', keepOld: false, sell: true, items: RARE(1),
        tier: { 2: RARE(1).concat(RARE(3).slice(0, 1)), 3: RARE(3), 5: RARE(5), 7: RARE(7) } },
      shop_dovan_guild: { name: R.T('shops.shop_dovan_guild.name'), kind: 'special', keepOld: true, sell: true, items: items(0).concat(['i_potion', 'i_ether'].filter(has)),
        get tier() { const s = side(); return s === 'guild' || s === 'accord' ? ahead(guild) : guild; } },
    });
  });
})(window.RPG);
