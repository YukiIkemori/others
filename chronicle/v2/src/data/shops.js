// 店（R.DB.shops。RULES）。縦切りの 5 つ（V2_PLAN §3.7）。今の木の src/data/shops.js の品ぞろえをティア 0〜1 に絞って移した。
//   K.shop = {name, items:[ティア 0 の品], tier?:{T:[品]}, sell?}。ここでは足して:
//     kind 'item'|'weapon'|'special'、keepOld（true: ティアの段を足していく道具屋 / false: いちばん新しい段だけ＝武具屋）
//   並ぶ品は R.Rules.shopItems(id, tier?) で引く（tier の既定は R.Tier.get()）。店の画面（MENUS）はこれだけを読む。
// - 店に置くのは通常品（src 'shop'）と、ユラの珍しいアクセサリだけ。レア・超レア・遺物・報酬・盗み専用は置かない。
// - 装備の品は並びを「武器（系統の順）→ 盾 → 頭 → 体 → 手 → 足」、同じ枠の中は 重装 → 軽装 → 布。
(function (R) {
  'use strict';
  const WEAPON_LINES = ['w_sword', 'w_greatsword', 'w_greatsword_maul', 'w_dagger', 'w_bow', 'w_staff', 'w_staff_prayer'];
  // 防具は 1 枠・1 重さに 1 系列（名前しか違わなかった 2 系列は items_armor.js でまとめた。消した id は R.DB.itemAlias）
  const ARMOR_LINES = [
    'sh_buckler', 'sh_shield', 'sh_book', 'hd_helm', 'hd_cap', 'hd_hood',
    'bd_mail', 'bd_vest', 'bd_robe', 'hn_gauntlet', 'hn_glove', 'hn_longglove', 'ft_greave', 'ft_boots', 'ft_sandal',
  ];
  // T0 だけ最初の装備の決まった id を使う系列（今の木の §8.1.2 のまま）
  const T0ID = { w_sword: 'w_sword_iron', w_greatsword: 'w_greatsword_iron', w_greatsword_maul: 'w_greatsword_club', w_dagger: 'w_dagger_iron',
    w_bow: 'w_bow_short', w_staff: 'w_staff_novice', bd_mail: 'bd_iron_cuirass', sh_buckler: 'sh_iron_buckler',
    bd_vest: 'bd_leather_vest', hd_cap: 'hd_leather_cap', sh_shield: 'sh_leather', bd_robe: 'bd_hemp_robe', hd_hood: 'hd_wool_hood', sh_book: 'sh_primer' };
  const at = (line, t) => (t === 0 && T0ID[line]) || `${line}_${t}`;
  const gear = (lines, t) => lines.map((l) => at(l, t));
  // 道具屋の段（ティア 0・1。keepOld で足していく）
  const ITEMS_T0 = ['i_salve', 'i_revive', 'i_antidote', 'i_clear', 'i_waker', 'i_repel', 'i_torch', 'i_smoke', 'i_firepot',
    'ac_ward_poison', 'ac_ward_blind', 'ac_ward_sleep'];
  const ITEMS_T1 = ['i_potion', 'i_ether', 'i_numb', 'i_throat', 'i_lure', 'i_lens', 'ac_ward_paralyze', 'ac_ward_silence', 'ac_ward_confuse', 'ac_ward_stun'];
  const STONES = ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => `i_stone_${e}`);
  // 能力値の T0 のアクセサリ（銅の腕輪など 6 品）。sim の標準の一行（tools/lib/party_model.js）は「そのティアの店の品」で 2 つずつ付けるので、
  // 縦切りの店でも買えるようにする（QA: 店で買えない品を前提にボスの釣り合いを取っていた）
  const ACC_T0 = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'].map((s) => `ac_${s}_0`);

  R.defs('shops', {
    // ファロスの道具屋（薬・毒消し・目覚まし・目薬・魔除けの香・松明…）
    shop_pharos_items: { name: R.T('shops.shop_pharos_items.name'), kind: 'item', keepOld: true, sell: true, items: ITEMS_T0.concat(ACC_T0), tier: { 1: ITEMS_T1.concat(STONES) } },
    // ファロスの武具屋（5 系統の T0 の武器・盾・頭・体・手・足）
    shop_pharos_arms: { name: R.T('shops.shop_pharos_arms.name'), kind: 'weapon', keepOld: false, sell: true,
      items: gear(WEAPON_LINES, 0).concat(['w_sword_uchi'], gear(ARMOR_LINES, 0)), tier: { 1: gear(WEAPON_LINES, 1).concat(gear(ARMOR_LINES, 1)) } },
    // フェルンの道具屋
    shop_fern_items: { name: R.T('shops.shop_fern_items.name'), kind: 'item', keepOld: true, sell: true, items: ITEMS_T0.concat(ACC_T0, STONES), tier: { 1: ITEMS_T1 } },
    // フェルンの広場の行商（T0〜T1 の武器）
    shop_fern_peddler: { name: R.T('shops.shop_fern_peddler.name'), kind: 'weapon', keepOld: false, sell: true,
      items: gear(WEAPON_LINES, 0).concat(gear(WEAPON_LINES, 1)), tier: { 1: gear(WEAPON_LINES, 1).concat(gear(WEAPON_LINES, 2)) } },
    // 隠れ里ユラ（ティアで入れ替わる珍しいアクセサリ 3 品）
    shop_yura: { name: R.T('shops.shop_yura.name'), kind: 'special', keepOld: false, sell: true,
      items: ['ac_flee', 'ac_quiet', 'ac_sachet'], tier: { 1: ['ac_sachet', 'ac_flee', 'ac_quiet'],   // 先制（ac_watch）・レア率（ac_clover）・ドロップ率（ac_loupe）は中盤以降（持ち主 2026-09-27）
      2: ['ac_purse', 'ac_float', 'ac_quickhand'] } },
  });
})(window.RPG);
