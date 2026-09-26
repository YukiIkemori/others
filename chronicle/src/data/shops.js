// 店 34（R.DB.shops）。担当 gear-b（A10b）。正本は DESIGN.md §8.11.3（品ぞろえの決まり §8.11.1、一覧 §8.11.2）。
//
// 店の形（§3.3.5）: { name, kind, items:[固定品], stock:[{tier, cond?, items:[…]}, …], keepOld }
//   R.Tier.shopItems(id) = 固定品 ＋ stock のうち「tier ≤ R.Tier.current() かつ R.State.check(cond)」の段。
//   keepOld:true  … それらの段をすべて足す（道具屋: ティアとともに品が増える）
//   keepOld:false … 条件を満たす段のうち、配列で最後の 1 段だけ（武器屋・防具屋: 今のティアの品だけ）
// - 店に置くのは通常品だけ（src:'shop' の装備と道具）。レア・超レア・遺物・報酬・レア魔物の道具は置かない（§8.14）。
// - 店の NPC（shop_item shop_weapon shop_armor shop_magic、shop:'<店id>'）は町の担当が置く（§10.6.1）。
// - §8.11.3 との違いは並びだけ（どのティア・条件でも、並ぶ品の集まりは正本と同じ。tools/test_gear-b.js の S3）:
//   道具屋は「道具 → アクセサリ」、その中は品の sort の順（onData で段と固定品を並べ直す）。武器屋・防具屋は装備の枠の順
//   （§3.1.1 の種別の順 = 店の画面の L/R の絞り込みの順）、同じ枠の中は §8.1.2 の系列の順（重装 → 軽装 → 布）。
//   R.Tier.shopItems が段の順にそのまま並べても、店の一覧が見やすい順に出る。
(function (R) {
  'use strict';
  const T9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // 武器の 9 系列（A19 の 7 系統。斧は斧とメイス、杖は知力と精神の 2 系列。SYSTEMS_REWORK §3.3）
  const ALLW = ['w_sword', 'w_greatsword', 'w_dagger', 'w_axe', 'w_axe_mace', 'w_spear', 'w_bow', 'w_staff', 'w_staff_prayer'];
  const ARMOR = {
    heavy: ['bd_mail', 'bd_plate', 'hd_helm', 'hd_band', 'sh_buckler', 'sh_tower', 'hn_gauntlet', 'hn_bracer', 'ft_greave', 'ft_shin'],
    light: ['bd_vest', 'bd_garb', 'hd_cap', 'hd_scarf', 'sh_shield', 'sh_round', 'hn_glove', 'hn_armlet', 'ft_boots', 'ft_shoes'],
    cloth: ['bd_robe', 'bd_habit', 'hd_hat', 'hd_hood', 'sh_book', 'sh_charm', 'hn_longglove', 'hn_mitten', 'ft_slipper', 'ft_sandal'],
  };
  const CH = { str: 'ac_str', vit: 'ac_vit', dex: 'ac_dex', agi: 'ac_agi', int: 'ac_int', mnd: 'ac_mnd' };
  // T0 だけ 04 キャラ章の固定の id を使う系列（§8.1.2）
  const T0ID = { w_sword: 'w_sword_iron', w_greatsword: 'w_greatsword_iron', w_dagger: 'w_dagger_iron', w_axe: 'w_axe_hand', w_spear: 'w_spear_iron',
    w_bow: 'w_bow_short', w_axe_mace: 'w_axe_cudgel', w_staff: 'w_staff_novice',
    bd_mail: 'bd_iron_cuirass', hd_band: 'hd_iron_band', sh_buckler: 'sh_iron_buckler', bd_vest: 'bd_leather_vest',
    hd_cap: 'hd_leather_cap', sh_shield: 'sh_leather', bd_robe: 'bd_hemp_robe', hd_hood: 'hd_wool_hood', sh_book: 'sh_primer' };
  const at = (line, t) => (t === 0 && T0ID[line]) || `${line}_${t}`;
  const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const WT = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'staff'];   // 腕章 7 つ
  const STS = ['poison', 'blind', 'sleep', 'paralyze', 'silence', 'confuse', 'stun', 'freeze', 'burn', 'death'];
  const BADGES = WT.map((w) => `ac_badge_${w}`), GUARDS = EL.map((e) => `ac_guard_${e}`), SPIRITS = EL.map((e) => `ac_spirit_${e}`);
  const WARDS = STS.map((s) => `ac_ward_${s}`), STONES = EL.map((e) => `i_stone_${e}`);

  // 道具屋の共通の 4 段（§8.11.2。keepOld:true で積み上がる）
  const ITEM_TABLE = [
    { tier: 0, items: ['i_salve', 'i_revive', 'i_antidote', 'i_clear', 'i_waker', 'i_repel', 'i_smoke', 'i_firepot', ...STONES, 'ac_ward_poison', 'ac_ward_blind', 'ac_ward_sleep'] },
    { tier: 1, items: ['i_potion', 'i_ether', 'i_numb', 'i_throat', 'i_lure', 'i_lens', 'ac_ward_paralyze', 'ac_ward_silence', 'ac_ward_confuse', 'ac_ward_stun', 'ac_quiet', 'ac_call', 'ac_flee', 'ac_watch', 'ac_pouch'] },
    { tier: 2, items: ['i_incense', 'i_thaw', 'i_bomb', 'i_horn', 'i_censer', 'ac_ward_freeze', 'ac_ward_burn', 'ac_ward_death', 'ac_float', 'ac_quickhand'] },
    { tier: 3, items: ['i_elixir', 'i_ether2', 'i_panacea'] },
  ];
  const split = (pred) => ITEM_TABLE.map((s) => ({ tier: s.tier, items: s.items.filter(pred) })).filter((s) => s.items.length);
  const ITEM_STEPS = [...split((id) => id.startsWith('i_')), ...split((id) => !id.startsWith('i_'))];

  // 武器屋・防具屋の並び: 装備の枠の順（§3.1.1: 武器 → 盾 → 頭 → 体 → 手 → 足 → アクセサリ）、
  // 武器は系統の順、防具は同じ枠の中で 重装 → 軽装 → 布（品の集まりは §8.11.3 と同じ。並びだけ）
  const SLOT_ORDER = ['w', 'sh', 'hd', 'bd', 'hn', 'ft', 'ac'];
  const WEIGHT_ORDER = [...ARMOR.heavy, ...ARMOR.light, ...ARMOR.cloth];
  const lineRank = (l) => [SLOT_ORDER.indexOf(l.split('_')[0]), l.startsWith('w_') ? ALLW.indexOf(l) : l.startsWith('ac_') ? Object.values(CH).indexOf(l) : WEIGHT_ORDER.indexOf(l)];
  const byRank = (a, b) => { const x = lineRank(a), y = lineRank(b); return x[0] - y[0] || x[1] - y[1]; };
  // 武器屋・防具屋の段（keepOld:false。条件を満たす段のうち、配列で最後のものを出す）
  function gearSteps(lines, extra, opt) {
    lines = lines.slice().sort(byRank);
    const steps = T9.map((t) => ({ tier: t, items: [...lines.map((l) => at(l, t)), ...(t >= 3 ? extra : [])] }));
    if (opt && opt.post9) steps.push({ tier: 8, cond: { postgame: true }, items: [...lines.map((l) => at(l, 9)), ...extra] });
    return steps;
  }
  const W = (name, lines, opt = {}) => ({ name, kind: 'weapon', keepOld: false, stock: gearSteps(lines, opt.extra || [], opt) });
  const A = (name, weights, charms, opt = {}) => {
    const lines = [...weights.flatMap((w) => ARMOR[w]), ...charms.map((c) => CH[c])];
    return { name, kind: 'armor', keepOld: false, stock: gearSteps(lines, ['ac_redcloth', 'ac_brooch', ...(opt.extra || [])], opt) };
  };
  const I = (name, extra = []) => ({ name, kind: 'item', keepOld: true, stock: [...ITEM_STEPS, ...extra] });

  const SHOPS = {
    roa_item: { name: 'ロアの道具屋', kind: 'item', keepOld: true, stock: [], items: ['i_salve', 'i_antidote', 'i_clear', 'i_waker', 'i_revive', 'i_repel'] },
    lute_item: I('ファロスの道具屋', [{ tier: 2, items: [...GUARDS, 'ac_loupe', 'ac_clover', 'ac_purse', 'ac_vial', 'ac_sachet'] }, { tier: 3, items: ['ac_sash'] }]),
    lute_weapon: W('ファロスの武器屋', ALLW, { extra: BADGES, post9: true }),
    lute_armor: A('ファロスの防具屋', ['heavy', 'light', 'cloth'], ['str', 'vit', 'dex', 'agi', 'int', 'mnd'], { post9: true }),
    fern_item: I('フェルンの道具屋'),
    fern_weapon: W('フェルンの武器屋', ['w_bow', 'w_spear', 'w_dagger', 'w_staff', 'w_staff_prayer']),
    fern_armor: A('フェルンの防具屋', ['light', 'cloth'], ['dex', 'agi', 'int', 'mnd']),
    kasim_item: I('カシムの道具屋'),
    kasim_weapon: W('カシムの武器屋', ['w_sword', 'w_dagger', 'w_axe', 'w_greatsword']),
    kasim_armor: A('カシムの防具屋', ['light', 'heavy'], ['str', 'vit', 'dex', 'agi']),
    yule_item: I('ユールの道具屋'),
    yule_weapon: W('ユールの武器屋', ['w_axe', 'w_spear', 'w_axe_mace', 'w_greatsword', 'w_bow']),
    yule_armor: A('ユールの防具屋', ['heavy', 'cloth'], ['str', 'vit', 'int', 'mnd']),
    loch_item: I('ロッホの道具屋'),
    loch_weapon: W('ロッホの武器屋', ['w_staff', 'w_staff_prayer', 'w_dagger', 'w_bow', 'w_axe_mace']),
    loch_armor: A('ロッホの防具屋', ['cloth', 'light'], ['int', 'mnd', 'dex', 'agi']),
    coral_item: I('コーラルの道具屋'),
    coral_weapon: W('コーラルの武器屋', ['w_sword', 'w_spear', 'w_bow', 'w_dagger']),
    coral_armor: A('コーラルの防具屋', ['light', 'heavy'], ['str', 'vit', 'dex', 'agi']),
    nerei_item: I('ネレイの雑貨屋'),
    dovan_item: I('ドヴァンの道具屋'),
    // ヘルガの鍛冶場: r_mine のクリア後は 9 系列すべて ＋ 腕章 7（§10.8.7・SYSTEMS_REWORK §3.3）。後ろの段が勝つので、クリア後はこちらが出る
    dovan_weapon: (() => { const s = W('ヘルガの鍛冶場', ['w_sword', 'w_greatsword', 'w_axe', 'w_axe_mace', 'w_spear']);
      s.stock.push(...T9.map((t) => ({ tier: t, cond: { cleared: 'r_mine' }, items: [...ALLW.map((l) => at(l, t)), ...BADGES] }))); return s; })(),
    dovan_armor: A('ドヴァンの防具屋', ['heavy'], ['str', 'vit']),
    caldera_item: I('カルデラの道具屋'),
    caldera_weapon: W('カルデラの武器屋', ['w_sword', 'w_axe', 'w_greatsword', 'w_axe_mace', 'w_staff']),
    caldera_armor: A('カルデラの防具屋', ['heavy', 'light'], ['str', 'vit', 'dex', 'agi']),
    orbis_item: I('オルビスの道具屋'),
    orbis_weapon: W('オルビスの武器屋', ['w_staff', 'w_staff_prayer', 'w_dagger', 'w_bow', 'w_spear']),
    orbis_armor: A('オルビスの防具屋', ['cloth', 'light'], ['int', 'mnd', 'dex', 'agi']),
    orbis_magic: { name: '学院の術具店', kind: 'magic', items: [...STONES, ...SPIRITS, 'ac_glim_tech', 'ac_glim_spell', 'ac_hourglass_mp', 'ac_hourglass_wp', 'ac_brooch', 'ac_sachet', 'ac_vial', 'i_lens'] },
    biblia_item: I('ビブリアの道具屋', [{ tier: 0, items: [...GUARDS, ...SPIRITS, 'ac_glim_tech', 'ac_glim_spell', 'ac_hourglass_mp', 'ac_hourglass_wp', 'ac_loupe', 'ac_clover', 'ac_purse', 'ac_sash', 'ac_vial', 'ac_sachet'] }]),
    biblia_weapon: W('ビブリアの武器屋', ALLW, { extra: BADGES, post9: true }),
    biblia_armor: A('ビブリアの防具屋', ['heavy', 'light', 'cloth'], ['str', 'vit', 'dex', 'agi', 'int', 'mnd'], { post9: true }),
    // 東の大陸の品。店の NPC は cond {cleared:'r_isles'}（町の担当）
    coral_regnas: { name: 'レグナスの商人', kind: 'special', items: [...BADGES, ...GUARDS, ...WARDS, 'ac_loupe', 'ac_clover', 'ac_purse', 'ac_sash', 'ac_quiet', 'ac_call'] },
  };
  // 形をそろえる（どの店も items・stock・keepOld を持つ）
  for (const s of Object.values(SHOPS)) {
    if (!s.items) s.items = [];
    if (!s.stock) s.stock = [];
    if (s.keepOld === undefined) s.keepOld = true;
  }
  Object.assign(R.DB.shops, SHOPS);

  // 道具屋（keepOld:true）の並び: 足し合わせた品が「道具 → アクセサリ」、その中は品の sort（道具の一覧と同じ順。
  // 回復 → 生き返り → MP → 治療 → 香 → 戦闘の道具 → 魔石）になるように段を並べ直す。
  // どのティア・条件でも、出る品の集まりは変わらない（段を品ごとに分け、同じティア・条件の隣どうしをまとめ直すだけ）。
  R.onData(() => {
    const sortOf = (id) => { const it = R.DB.items[id]; return it && Number.isFinite(it.sort) ? it.sort : 1e9; };
    const byItem = (a, b) => (a.startsWith('i_') ? 0 : 1) - (b.startsWith('i_') ? 0 : 1) || sortOf(a) - sortOf(b);
    // 固定品（items）も同じ並びにする: ロアの道具屋・学院の術具店（道具 → アクセサリ、その中は sort）。
    // レグナスの商人（kind special）は正本の「腕章 → 守り石 → 状態よけ → ほか」のまとまりのまま（どれも同じ種類なので）
    for (const s of Object.values(SHOPS)) if ((s.kind === 'item' || s.kind === 'magic') && s.items.length > 1) s.items = s.items.slice().sort(byItem);
    for (const s of Object.values(SHOPS)) {
      if (!s.keepOld || !s.stock.length) continue;
      const rows = [];
      s.stock.forEach((st, si) => st.items.forEach((id, k) => rows.push({ id, st, key: [id.startsWith('i_') ? 0 : 1, sortOf(id), st.tier, si, k] })));
      rows.sort((a, b) => { for (let i = 0; i < a.key.length; i++) if (a.key[i] !== b.key[i]) return a.key[i] - b.key[i]; return 0; });
      const out = [];
      for (const r of rows) {
        const last = out[out.length - 1], cond = r.st.cond ? JSON.stringify(r.st.cond) : '';
        if (last && last.tier === r.st.tier && (last.cond ? JSON.stringify(last.cond) : '') === cond) last.items.push(r.id);
        else out.push(Object.assign({ tier: r.st.tier }, r.st.cond ? { cond: r.st.cond } : {}, { items: [r.id] }));
      }
      s.stock = out;
    }
  });
})(window.RPG);
