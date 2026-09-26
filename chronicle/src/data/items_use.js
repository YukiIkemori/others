// 道具（type:'consumable'）58 = §8.9 の 35 ＋ §8.9.2 のレア魔物の道具 23。担当 gear-b（A10b）。
// 正は DESIGN.md §8.9・§8.9.2（id・名前・値段・対象・効果・演出・使える場面・説明）と §8.2.5（形）。
//
//   { name, type:'consumable', grade, src, price, desc, icon, sort,
//     use: { target, effects:[…], fx, battle, field },   // 「使えない」品（売るための品）は use を持たない
//     stone?: '<属性>',                                  // 魔石だけ（閃きの ctx.stone / ctx.elements。§4.9.6）
//     exclusive?: '<魔物id>' }                           // レア魔物の道具だけ（それを落とす、ただ 1 種の魔物）
//
// - 値段はティアで変わらない（§4.15）。price 0 は売れない（実と夢の果実）。売値は半分。
// - grade/src: 店の 29 品 = normal/shop、命のしずく・天の恵み・よみがえりの花・実 3 = rare/drop（店に置かない。宝箱・ボス・魔物）、
//   レア魔物の道具 23 = rare/relic（そのレア魔物の通常枠 1/2 だけ）。
// - 回復は割合（§4.6.4 の「道具の回復」＝最大値 × pct × (1 + itemPct/100)）。formula:'tier' は SP × W(Tb)（§4.6.3）。
// - 治療の道具はフィールドでは使えない（状態は戦闘の終わりに消える。§7.0 の 0.9）。
// - オートは魔石（stone）とレア魔物の道具（src:'relic'）を使わない（§4.9.6・§8.9.2。battle_ai が見る）。
// - icon は §11.3.6 の既存の 8×8 アイコン（icon:herb potion drop feather bomb powder seed bell flute rope key acc）と icon:el_<属性>、
//   A10b.2 の icon:mirror（見破りの鏡）・coin（金の延べ板・古い金貨の袋）・book（知恵のページ）。
//   同じ種類の品は同じ絵にそろえる（香 3 つ＝魔除け・誘い寄せ・守りは powder の香袋、鐘は bell、魔石は属性の印）。
// - sort は道具の一覧の並び（回復 → 生き返り → MP・WP → 治療 → 香 → 戦闘の道具 → 魔石 → 実 → レア魔物の道具）。
(function (R) {
  'use strict';

  const ELS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const EL_NAME = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const STONE_FX = { fire: 'fire', water: 'water', wind: 'wind', earth: 'earth', light: 'holy', dark: 'dark' };

  // effects
  const heal = (pct) => ({ type: 'heal', pct });
  const healMp = (pct) => ({ type: 'healMp', pct });
  const healWp = (pct) => ({ type: 'healWp', pct });
  const revive = (pct) => ({ type: 'revive', pct });
  const cure = (statuses) => ({ type: 'cure', statuses });
  const buff = (stat, stages) => ({ type: 'buff', stat, stages });
  const tierDmg = (power, element) => Object.assign({ type: 'damage', formula: 'tier', power }, element ? { element } : {});
  const status = (s, chance) => Object.assign({ type: 'status', status: s }, chance != null ? { chance } : {});
  const grow = (stat, n) => ({ type: 'grow', stat, n });

  // use blocks: B = 戦闘だけ、F = フィールドだけ、BF = 両方
  const BF = (target, effects, fx) => ({ target, effects, fx, battle: true, field: true });
  const B = (target, effects, fx) => ({ target, effects, fx, battle: true, field: false });
  const F = (target, effects, fx) => ({ target, effects, fx, battle: false, field: true });

  // 品の作り方。o = {icon, stone, exclusive}
  const SHOP = { grade: 'normal', src: 'shop' };
  const DROP = { grade: 'rare', src: 'drop' };
  const RELIC = { grade: 'rare', src: 'relic' };
  // icon は絵のキー（'icon:<id>'。§3.1.2・§8.2.8。rules の fillItem・weapontypes と同じ書き方）
  const C = (cls, name, price, use, desc, o) => {
    const it = Object.assign({ name, type: 'consumable', grade: cls.grade, src: cls.src, price, desc }, use ? { use } : {}, o || {});
    if (it.icon) it.icon = 'icon:' + it.icon;
    return it;
  };

  // ------------------------------------------------------------------ §8.9（35）
  const USE = {
    // HP の回復
    i_salve:    C(SHOP, '傷薬', 20, BF('ally', [heal(0.35)], 'heal'), '味方1人のHPを\n最大値の35%回復する。', { icon: 'herb' }),
    i_potion:   C(SHOP, '癒やしの水', 80, BF('ally', [heal(0.7)], 'heal'), '味方1人のHPを\n最大値の70%回復する。', { icon: 'potion' }),
    i_elixir:   C(SHOP, '癒やしの霊水', 300, BF('ally', [heal(1)], 'heal'), '味方1人のHPを\nすべて回復する。', { icon: 'potion' }),
    i_incense:  C(SHOP, '癒やしの香炉', 250, BF('allies', [heal(0.35)], 'heal'), '味方全員のHPを\n最大値の35%回復する。', { icon: 'powder' }),
    i_lifedew:  C(DROP, '命のしずく', 600, BF('ally', [heal(1), healMp(1), healWp(1)], 'heal'), '味方1人のHP・MP・WPを\nすべて回復する。', { icon: 'drop' }),
    i_grace:    C(DROP, '天の恵み', 900, BF('allies', [heal(1), cure('all')], 'heal3'), '味方全員のHPをすべて回復し、\n悪い状態を治す。', { icon: 'herb' }),
    // 生き返らせる
    i_revive:   C(SHOP, '気つけの羽根', 100, BF('ally_dead', [revive(0.35)], 'revive'), '倒れた味方1人を\nHP35%で生き返らせる。', { icon: 'feather' }),
    i_phoenix:  C(DROP, 'よみがえりの花', 600, BF('ally_dead', [revive(1)], 'revive'), '倒れた味方1人を\nHPすべてで生き返らせる。', { icon: 'herb' }),
    // MP・WP
    i_ether:    C(SHOP, '魔力の水', 150, BF('ally', [healMp(0.3)], 'mp'), '味方1人のMPを\n最大値の30%回復する。', { icon: 'drop' }),
    i_ether2:   C(SHOP, '魔力の霊水', 400, BF('ally', [healMp(0.6)], 'mp'), '味方1人のMPを\n最大値の60%回復する。', { icon: 'drop' }),
    i_tonic:    C(SHOP, '気力の茶', 120, BF('ally', [healWp(0.3)], 'mp'), '味方1人のWPを\n最大値の30%回復する。', { icon: 'potion' }),
    // 治療（戦闘だけ）
    i_antidote: C(SHOP, '解毒薬', 10, B('ally', [cure(['poison'])], 'cure'), '毒を治す。', { icon: 'potion' }),
    i_clear:    C(SHOP, '澄み目のしずく', 10, B('ally', [cure(['blind'])], 'cure'), '暗闇を治す。', { icon: 'drop' }),
    i_waker:    C(SHOP, '目覚まし草', 15, B('ally', [cure(['sleep', 'confuse', 'stun'])], 'cure'), '眠り・混乱・気絶を治す。', { icon: 'herb' }),
    i_numb:     C(SHOP, 'しびれ消し', 15, B('ally', [cure(['paralyze'])], 'cure'), 'まひを治す。', { icon: 'potion' }),
    i_throat:   C(SHOP, '澄み声のあめ', 15, B('ally', [cure(['silence'])], 'cure'), '沈黙を治す。', { icon: 'seed' }),
    i_thaw:     C(SHOP, '癒やしのぬり薬', 20, B('ally', [cure(['burn', 'freeze'])], 'cure'), 'やけどと凍結を治す。', { icon: 'powder' }),
    i_panacea:  C(SHOP, '清めの霊薬', 100, B('ally', [cure('all')], 'cure'), '悪い状態をすべて治す。', { icon: 'potion' }),
    // 香（フィールドだけ。R.Game.encItem = {id, pct, steps, weakOnly}。§4.11.1）
    i_repel:    C(SHOP, '魔除けの香', 60, F('self', [{ type: 'encounter', pct: -100, steps: 100, weakOnly: true }], 'buff'), '100歩のあいだ、弱い魔物が\n寄ってこない。', { icon: 'powder' }),
    i_lure:     C(SHOP, '誘い寄せの香', 60, F('self', [{ type: 'encounter', pct: 100, steps: 100 }], 'debuff'), '100歩のあいだ、魔物と\nめずらしい魔物が増える。', { icon: 'powder' }),
    // 戦闘の道具
    i_smoke:    C(SHOP, '煙玉', 30, B('self', [{ type: 'escape' }], 'smoke'), '戦闘から必ず逃げ出せる。\nボスには効かない。', { icon: 'bomb' }),
    i_lens:     C(SHOP, '見破りの鏡', 40, B('enemy', [{ type: 'scan' }], 'scan'), '敵1体のHPと弱点を\n見破る。', { icon: 'mirror' }),
    i_firepot:  C(SHOP, '火炎つぼ', 50, B('group', [tierDmg(0.8, 'fire')], 'fire2'), '同じ種類の敵すべてに\n火のダメージ。', { icon: 'bomb' }),
    i_bomb:     C(SHOP, 'はじけ玉', 150, B('enemies', [tierDmg(0.7)], 'explosion'), '敵全体にダメージ。', { icon: 'bomb' }),
    i_horn:     C(SHOP, '勇みの角笛', 120, B('allies', [buff('atk', 1)], 'buff'), '味方全員の攻撃力を\n1段階上げる。', { icon: 'flute' }),
    i_censer:   C(SHOP, '守りの香', 120, B('allies', [buff('def', 1)], 'buff'), '味方全員の守備力を\n1段階上げる。', { icon: 'powder' }),
  };
  // 魔石 6（§4.9.6: その属性の 1 段相当の攻撃 SP 1.2 ＋ 熟練度 +1 と術の閃きの判定。使うと減る。閃いたときだけ減らない）
  for (const el of ELS) {
    const n = EL_NAME[el];
    USE[`i_stone_${el}`] = C(SHOP, `${n}の魔石`, 30, B('enemy', [tierDmg(1.2, el)], STONE_FX[el]),
      `敵1体に${n}のダメージ。\n${n}の術を覚える入口になる。`, { icon: `el_${el}`, stone: el });
  }
  // 最大値を伸ばす実（フィールドだけ。bonus.hp ≤ 200・mp ≤ 30・wp ≤ 30。§8.2.5）
  Object.assign(USE, {
    i_seed_hp: C(DROP, '活力の実', 0, F('ally', [grow('hp', 10)], 'heal'), '食べると最大HPが\n10増える。', { icon: 'seed' }),
    i_seed_mp: C(DROP, '魔力の実', 0, F('ally', [grow('mp', 2)], 'mp'), '食べると最大MPが\n2増える。', { icon: 'seed' }),
    i_seed_wp: C(DROP, '気力の実', 0, F('ally', [grow('wp', 2)], 'mp'), '食べると最大WPが\n2増える。', { icon: 'seed' }),
  });

  // ------------------------------------------------------ §8.9.2 レア魔物の道具（23）
  const RM = (mon, name, price, use, desc, icon) => C(RELIC, name, price, use, desc, { icon, exclusive: mon });
  const SELL = '売ると高いお金になる。\n使うことはできない。';
  Object.assign(USE, {
    i_jewel_carrot:   RM('rm_jewel_hare', '宝石にんじん', 1000, BF('ally', [heal(1), healMp(1), healWp(1)], 'heal'), '味方1人のHP・MP・WPを\nすべて回復する。', 'seed'),
    i_bloom_nectar:   RM('rm_bloom_fawn', '花角の蜜', 1200, BF('allies', [heal(0.5)], 'heal3'), '味方全員のHPを\n最大値の50%回復する。', 'potion'),
    i_glass_dust:     RM('rm_glass_moth', 'きらめくりん粉', 1200, B('enemies', [status('blind', 0.6)], 'debuff'), '敵全体の目を\nくらませることがある。', 'powder'),
    i_golden_acorn:   RM('rm_acorn_prince', '黄金のどんぐり', 5000, null, SELL, 'seed'),
    i_diamond_dust:   RM('rm_diamond_lizard', '金剛石の粉', 1200, B('ally', [buff('def', 2)], 'buff'), '味方1人の守備力を\n2段階上げる。', 'powder'),
    i_gold_bar:       RM('rm_gold_idol', '金の延べ板', 6000, null, SELL, 'coin'),
    i_aurora_feather: RM('rm_aurora_bird', 'オーロラの羽根', 1500, BF('allies', [healMp(0.3)], 'mp'), '味方全員のMPを\n最大値の30%回復する。', 'feather'),
    i_fox_icicle:     RM('rm_icetail_fox', 'キツネのつらら', 1200, B('enemy', [status('freeze', 0.6)], 'water'), '敵1体を\n凍らせることがある。', 'drop'),
    i_lotus_dew:      RM('rm_lotus_sprite', 'はすの朝露', 1200, B('allies', [cure('all'), status('regen')], 'heal3'), '味方全員の悪い状態を治し、\n再生の状態にする。', 'drop'),
    i_ghost_tea:      RM('rm_ghost_teapot', 'おばけの紅茶', 1200, BF('ally', [heal(1), cure('all')], 'heal'), '味方1人のHPをすべて回復し、\n悪い状態を治す。', 'potion'),
    i_snail_bell:     RM('rm_bell_snail', '小さな鐘', 1000, B('allies', [cure(['sleep', 'confuse', 'stun'])], 'cure'), '味方全員の眠り・混乱・\n気絶を治す。', 'bell'),
    i_stardust:       RM('rm_star_whale', '星くずの小瓶', 1800, BF('allies', [healMp(0.4)], 'mp'), '味方全員のMPを\n最大値の40%回復する。', 'potion'),
    i_gold_coins:     RM('rm_treasure_crab', '古い金貨の袋', 4000, null, SELL, 'coin'),
    i_gem_quill:      RM('rm_gem_hedgehog', '宝石のとげ', 1200, B('enemy', [tierDmg(2.0)], 'pierce'), '敵1体に大きなダメージ。', 'feather'),
    i_prism_shard:    RM('rm_prisma', '虹晶のかけら', 1500, BF('ally', [healMp(1)], 'mp'), '味方1人のMPを\nすべて回復する。', 'drop'),
    i_spa_egg:        RM('rm_spa_monkey', '温泉たまご', 1200, BF('allies', [heal(0.7)], 'heal3'), '味方全員のHPを\n最大値の70%回復する。', 'seed'),
    i_volcano_stone:  RM('rm_volcano_turtle', '火山の熱石', 1200, B('enemies', [tierDmg(1.5, 'fire')], 'fire2'), '敵全体に火のダメージ。', 'bomb'),
    i_moon_wool:      RM('rm_moon_sheep', '月見の毛糸', 1500, BF('allies', [healWp(0.3)], 'mp'), '味方全員のWPを\n最大値の30%回復する。', 'rope'),
    i_spring_key:     RM('rm_clock_bird', 'ぜんまいの鍵', 1500, BF('ally', [healWp(1)], 'mp'), '味方1人のWPを\nすべて回復する。', 'key'),
    i_wisdom_page:    RM('rm_bookworm', '知恵のページ', 3000, BF('ally', [healMp(1), healWp(1)], 'mp'), '味方1人のMPとWPを\nすべて回復する。', 'book'),
    i_golden_ink:     RM('rm_golden_quill', '黄金のインク', 4000, BF('allies', [healMp(0.5), healWp(0.5)], 'mp'), '味方全員のMPとWPを\n最大値の50%回復する。', 'potion'),
    i_memory_bubble:  RM('rm_memory_fish', '思い出のしゃぼん', 6000, BF('allies', [heal(1), healMp(1)], 'heal3'), '味方全員のHPとMPを\nすべて回復する。', 'drop'),
    i_dream_fruit:    RM('rm_dream_tapir', '夢の果実', 0, F('ally', [grow('hp', 20), grow('mp', 5), grow('wp', 5)], 'heal'), '食べると最大HPが20、\n最大MPとWPが5増える。', 'seed'),
  });

  // 並び: 上の定義の順（sort = 1000 + 番号。種別の中の並びなので、ほかの種別の sort とは比べない）
  const IDS = Object.keys(USE);
  IDS.forEach((id, i) => { USE[id].sort = 1000 + i; });
  Object.assign(R.DB.items, USE);

  // 公開: ほかの担当・ツールが使う id の一覧（読み取り専用の複製を返す）
  R.ItemsUse = {
    ids: () => IDS.slice(),
    shopIds: () => IDS.filter((id) => USE[id].src === 'shop'),
    stones: () => ELS.map((e) => `i_stone_${e}`),
    relicOf: (monId) => IDS.find((id) => USE[id].exclusive === monId) || null,
  };

  // A10b.2: 鏡・金貨・本の 3 つのアイコン（icon:mirror coin book、担当 art-chars）。絵がまだ無い版では、前の絵に戻す
  // （アイコンの無い品を一覧に出さない）。絵が入れば、このままで新しい絵になる。
  const ICON_FALLBACK = { i_lens: 'icon:acc', i_gold_bar: 'icon:acc', i_gold_coins: 'icon:powder', i_wisdom_page: 'icon:potion' };
  R.ItemsUse.iconFallback = () => Object.assign({}, ICON_FALLBACK);
  R.onData(() => {
    if (!R.Gfx || !R.Gfx.has) return;
    for (const [id, fb] of Object.entries(ICON_FALLBACK)) {
      const it = R.DB.items[id];
      if (it && !R.Gfx.has(it.icon)) it.icon = fb;
    }
  });

  // §8.2.9: 数値を埋める（道具は値段・説明を表に書いたので、埋める物は無い。規則の関数がある時だけ呼ぶ）
  R.onData(() => {
    const fill = R.Rules && R.Rules.fillItem;
    if (!fill) return;
    for (const id of IDS) { try { fill(R.DB.items[id]); } catch (e) { R.loadErrors.push(`fillItem ${id}: ${e && e.message}`); } }
  });
})(window.RPG);
