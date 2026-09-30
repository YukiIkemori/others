// 終盤の店（RULES の形 K.shop）。書の都ビブリアの「白紙堂」（道具と武具をひとつの店で）。終盤はティア 8 なので 8 の段が並ぶ。
//   shop_biblia        道具（keepOld）とアクセサリ
//   shop_biblia_arms   武具（いちばん新しい段）
(function (R) {
  'use strict';
  const WEAPON_LINES = ['w_sword', 'w_greatsword', 'w_greatsword_maul', 'w_dagger', 'w_bow', 'w_staff', 'w_staff_prayer'];
  const ARMOR_LINES = ['sh_buckler', 'sh_shield', 'sh_book', 'hd_helm', 'hd_cap', 'hd_hood',
    'bd_mail', 'bd_vest', 'bd_robe', 'hn_gauntlet', 'hn_glove', 'hn_longglove', 'ft_greave', 'ft_boots', 'ft_sandal'];
  const has = (id) => !!(R.DB.items && R.DB.items[id]);
  const gear = (lines, t) => lines.map((l) => `${l}_${t}`).filter(has);
  const IT = ['i_potion2', 'i_ether2', 'i_panacea', 'i_elixir', 'i_revive', 'i_antidote', 'i_waker', 'i_clear', 'i_numb', 'i_lens', 'i_repel', 'i_smoke'];
  const LADDER = { i_potion2: 1, i_ether2: 1, i_elixir: 1 };
  const ACC = (t) => ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_${t}`).filter(has);
  R.onData(function () {
    const top = (t) => { for (let k = t; k >= 1; k--) { const g = gear(WEAPON_LINES, k).concat(gear(ARMOR_LINES, k)); if (g.length) return g; } return []; };
    const acc = () => { for (let k = 8; k >= 1; k--) { const a = ACC(k); if (a.length) return a; } return []; };
    R.defs('shops', {
      // 回復の段（RULES: 癒やしの清水などの中盤の品は MID から、癒やしの霊水は LATE から）に合わせて段に分ける。終盤（ティア 8）ではどれも並ぶ
      shop_biblia: { name: R.T('shops.shop_biblia.name'), kind: 'item', keepOld: true, sell: true, items: IT.filter((id) => has(id) && !LADDER[id]).concat(acc()),
        tier: { [R.Pools.MID]: ['i_potion2', 'i_ether2'].filter(has), [R.Pools.LATE]: ['i_elixir'].filter(has) } },
      shop_biblia_arms: { name: R.T('shops.shop_biblia_arms.name'), kind: 'weapon', keepOld: false, sell: true, items: top(8) },
    });
  });
})(window.RPG);
