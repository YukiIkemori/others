// マレア諸島の店（RULES の形 K.shop。WORLD_REDESIGN §4.5・§5.8・§5.9）。どのティアで来ても並ぶように 0〜8 の段を持つ。
//   shop_coral_items   コーラルの道具屋（keepOld）
//   shop_coral_arms    コーラルの武具屋（いちばん新しい段）
//   shop_coral_guild   船乗り組合の売り台。座礁した商船の船員を助けると、港の評判が上がって一段上の品が並ぶ（ch_isles_wreck = help）
//   shop_nerei         ネレイの雑貨屋（小さな村の売り台）
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
  R.onData(function () {
    const arms = { items: gear(WEAPON_LINES, 0).concat(gear(ARMOR_LINES, 0)), tier: byTier((t) => gear(WEAPON_LINES, t).concat(gear(ARMOR_LINES, t))) };
    // 港の評判（WORLD §4.5 の選択）: 船員を助けた → 組合の売り台に一段上の品（ティアの段を 1 つ先取り）
    const helped = () => { const G = R.Game; return !!(G && G.choices && G.choices.ch_isles_wreck === 'help'); };
    const guild = { 1: items(1).concat(ACC(0)), 2: items(2).concat(ACC(1)), 4: items(3).concat(ACC(2)), 5: items(5), 6: ACC(3) };
    R.defs('shops', {
      shop_coral_items: { name: R.T('shops.shop_coral_items.name'), kind: 'item', keepOld: true, sell: true, items: items(0).concat(ACC(0)), tier: { 1: items(1), 2: items(2).concat(ACC(1)), 3: items(3), 5: (ACC(2).length ? ACC(2) : items(3)).concat(items(5)) } },
      shop_coral_arms: Object.assign({ name: R.T('shops.shop_coral_arms.name'), kind: 'weapon', keepOld: false, sell: true }, arms),
      shop_coral_guild: { name: R.T('shops.shop_coral_guild.name'), kind: 'special', keepOld: true, sell: true, items: items(0).concat(['i_potion', 'i_ether'].filter(has)),
        get tier() { if (!helped()) return guild; const up = {}; for (const [t, v] of Object.entries(guild)) up[Math.max(0, +t - 1)] = (up[Math.max(0, +t - 1)] || []).concat(v); return up; } },
      shop_nerei: { name: R.T('shops.shop_nerei.name'), kind: 'item', keepOld: true, sell: true, items: items(0).concat(['i_potion'].filter(has)), tier: { 2: items(1), 4: items(3), 5: items(5) } },
    });
  });
})(window.RPG);
