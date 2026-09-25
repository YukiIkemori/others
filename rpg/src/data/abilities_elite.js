// Abilities, tiers 3–4: 魔法剣士 パラディン 忍者 賢者 竜騎士
// 時空術師 暗黒騎士 勇者. JP 200–900 (tier 3) / 400–1200 (tier 4).
// See abilities.js for the balance notes.
(function (R) {
  'use strict';

  // ------------------------------------------------------------ builders
  const phys = (power, o) => Object.assign({ type: 'damage', formula: 'phys', power }, o);
  const magic = (power, scale, element, o) => Object.assign({ type: 'damage', formula: 'magic', power, scale }, element ? { element } : {}, o);
  const heal = (power, scale) => ({ type: 'heal', power, scale });
  const buff = (stat, stages, chance) => Object.assign({ type: 'buff', stat, stages }, chance != null ? { chance } : {});
  const status = (s, chance) => ({ type: 'status', status: s, chance });
  const cure = (statuses) => ({ type: 'cure', statuses });
  const act = (name, jp, desc, o) => Object.assign({ name, kind: 'action', jp, desc }, o);
  const reaction = (name, jp, desc, trigger, chance, react) => ({ name, kind: 'reaction', jp, desc, trigger, chance, react });
  const support = (name, jp, desc, mods) => ({ name, kind: 'support', jp, desc, mods });
  const field = (name, jp, desc, mods) => ({ name, kind: 'field', jp, desc, mods });
  const add = (job, list) => { for (const id in list) R.DB.abilities[id] = Object.assign({ job }, list[id]); };
  const JUTSU = '{user}は{name}を使った！';

  // ============================================================ 魔法剣士
  add('spellblade', {
    spellblade_flame: act('紅蓮斬り', 200, '炎をまとった剣で斬りつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'fire' })], fx: 'fire1',
    }),
    spellblade_frost: act('氷結斬り', 200, '氷をまとった剣で斬りつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'ice' })], fx: 'ice1',
    }),
    spellblade_thunder: act('雷鳴斬り', 250, '雷をまとった剣で斬りつける。', {
      mp: 4, target: 'enemy', effects: [phys(1.4, { element: 'thunder' })], fx: 'thunder1',
    }),
    spellblade_seal: act('魔封斬り', 300, '斬りつけて敵の魔法を封じる。', {
      mp: 3, target: 'enemy', effects: [phys(1.0), status('silence', 0.6)], fx: 'slash',
    }),
    spellblade_gale: act('風切り', 400, '風をまとった剣で敵の群れを斬る。', {
      mp: 6, target: 'group', effects: [phys(0.9, { element: 'wind' })], fx: 'wind2',
    }),
    spellblade_enchant: act('魔剣覚醒', 500, '自分の攻撃力と魔力を上げる。', {
      mp: 6, target: 'self', effects: [buff('atk', 1), buff('mag', 1)], fx: 'buff',
    }),
    spellblade_dance: act('魔剣乱舞', 800, '魔剣が舞い踊り、4回斬り裂く。', {
      mp: 12, target: 'random', effects: [phys(0.8, { hits: 4 })], fx: 'slash3',
    }),
    spellblade_riposte: reaction('魔剣の返し', 500, '魔法を受けると、ときどき斬り返す。', 'hitMagic', 0.6, { type: 'counter' }),
    spellblade_equip_sword: support('剣装備', 500, 'どのジョブでも剣を装備できる。', { equip: ['sword'] }),
    spellblade_dual_path: support('文武の道', 600, '力と知力が10%上がる。', { strPct: 10, intPct: 10 }),
  });

  // ============================================================ パラディン
  add('paladin', {
    paladin_holy_blade: act('光の剣', 250, '聖なる一撃。アンデッドに強い。', {
      mp: 5, target: 'enemy', effects: [phys(1.4, { element: 'holy', vs: { undead: 1.5 } })], fx: 'holy1',
    }),
    paladin_heal: act('聖なる癒やし', 300, '仲間ひとりのHPを大きく回復する。', {
      mp: 8, magic: true, target: 'ally', effects: [heal(50, 0.9)], fx: 'heal2', fieldUse: true,
    }),
    paladin_purify: act('破邪の光', 350, '味方全員の状態異常を治す。', {
      mp: 10, magic: true, target: 'allies', effects: [cure('all')], fx: 'cure', fieldUse: true,
    }),
    paladin_sacrifice: act('命分け', 400, '自分のHPを分け与え、仲間を大きく癒やす。', {
      mp: 0, target: 'ally', effects: [{ type: 'heal', pct: 0.6, hpCost: 0.25 }], fx: 'heal',
    }),
    paladin_wave: act('光の波', 500, '光の波で敵全体を撃つ。', {
      mp: 10, target: 'enemies', effects: [phys(0.8, { element: 'holy', vs: { undead: 1.5 } })], fx: 'holy2',
    }),
    paladin_cross: act('十字斬り', 600, '聖なる十字を刻む2連撃。', {
      mp: 8, target: 'enemy', effects: [phys(1.0, { element: 'holy', hits: 2, vs: { undead: 1.5 } })], fx: 'holy3',
    }),
    paladin_last_stand: reaction('不屈の誓い', 800, '倒れても一度だけ立ち上がる。', 'ko', 1, { type: 'revive', pct: 0.5 }),
    paladin_guardian: reaction('守り人', 500, 'HPの少ない仲間を必ずかばう。', 'allyLowHp', 1, { type: 'cover' }),
    paladin_ward: support('破邪の心', 600, '毒・眠り・麻痺・混乱を防ぐ。', { statusImmune: ['poison', 'sleep', 'paralyze', 'confuse'] }),
    paladin_life: support('聖なる命', 700, '戦闘中、HPが少しずつ回復する。', { regen: true }),
  });

  // ============================================================ 忍者
  add('ninja', {
    ninja_shuriken: act('手裏剣', 200, '手裏剣を投げ、敵を3回攻撃する。', {
      mp: 3, target: 'random', effects: [phys(0.7, { hits: 3 })], fx: 'pierce', msg: JUTSU,
    }),
    ninja_smoke: act('煙隠れ', 200, '煙に紛れて必ず逃げ出す。', {
      mp: 2, target: 'self', effects: [{ type: 'escape' }], fx: 'smoke', msg: JUTSU,
    }),
    ninja_bind: act('影縛り', 300, '影を縫いとめ、敵を麻痺させる。', {
      mp: 4, target: 'enemy', effects: [status('paralyze', 0.5)], fx: 'paralyze', msg: JUTSU,
    }),
    ninja_mirage: act('幻影術', 350, '幻で自分の素早さと守備力を上げる。', {
      mp: 4, target: 'self', effects: [buff('agi', 2), buff('def', 1)], fx: 'buff', msg: JUTSU,
    }),
    ninja_flame: act('ほむらの術', 400, '炎の渦で敵全体を焼く。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'fire' })], fx: 'fire2', msg: JUTSU,
    }),
    ninja_thunder: act('鳴神', 400, '雷を呼び、敵全体を撃つ。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'thunder' })], fx: 'thunder2', msg: JUTSU,
    }),
    ninja_water: act('みずちの術', 400, '水の竜が敵全体を飲み込む。', {
      mp: 8, target: 'enemies', effects: [phys(0.7, { element: 'water' })], fx: 'water2', msg: JUTSU,
    }),
    ninja_assassin: act('忍び討ち', 600, '影からの一撃。会心が出やすい。', {
      mp: 5, target: 'enemy', effects: [phys(1.6, { critBonus: 30 })], fx: 'slash3',
    }),
    ninja_retaliate: reaction('返り討ち', 700, 'どんな攻撃を受けても、よく反撃する。', 'hitAny', 0.45, { type: 'counter' }),
    ninja_two_swords: support('二刀流', 900, '武器を二つ持ち、2回攻撃する。', { twoSwords: true }),
    ninja_equip_katana: support('刀装備', 500, 'どのジョブでも刀を装備できる。', { equip: ['katana'] }),
  });

  // ============================================================ 賢者
  add('sage', {
    sage_full_heal: act('フルヒール', 350, '仲間ひとりのHPを全回復する。', {
      mp: 18, magic: true, target: 'ally', effects: [{ type: 'heal', pct: 1 }], fx: 'heal3', fieldUse: true,
    }),
    sage_blessed_rain: act('恵みの雨', 500, '味方全員のHPを大きく回復する。', {
      mp: 24, magic: true, target: 'allies', effects: [heal(70, 1.0)], fx: 'heal3', fieldUse: true,
    }),
    sage_prominence: act('プロミネンス', 600, '太陽の炎で敵を焼き尽くす。', {
      mp: 30, magic: true, target: 'enemy', effects: [magic(40, 1.2, 'fire')], fx: 'fire3',
    }),
    sage_zero: act('絶対零度', 600, 'すべてを凍らせる冷気で敵を撃つ。', {
      mp: 30, magic: true, target: 'enemy', effects: [magic(40, 1.2, 'ice')], fx: 'ice3',
    }),
    sage_mother: act('聖母の祈り', 700, '倒れた仲間全員を生き返らせる。', {
      mp: 40, magic: true, target: 'allies', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', fieldUse: true,
    }),
    sage_stardust: act('星くずの雨', 800, '星くずを降らせ、敵全体を撃つ。', {
      mp: 36, magic: true, target: 'enemies', effects: [magic(10, 0.75)], fx: 'meteor3',
    }),
    sage_mana_return: reaction('魔力還元', 450, 'ダメージを受けるとMPが戻る。', 'hitAny', 0.5, { type: 'mp', power: 12 }),
    sage_half_mp: support('MP半減', 900, '消費MPが半分になる。', { mpCostPct: -50 }),
  });

  // ============================================================ 竜騎士
  add('dragoon', {
    dragoon_wyvern: act('飛竜突き', 250, '空を飛ぶ敵と竜に強い突き。', {
      mp: 4, target: 'enemy', effects: [phys(1.5, { vs: { flying: 1.5, dragon: 1.5 } })], fx: 'pierce',
    }),
    dragoon_leech: act('吸血突き', 300, '突き刺して敵のHPを吸い取る。', {
      mp: 3, target: 'enemy', effects: [phys(1.0, { drain: 0.5 })], fx: 'drain',
    }),
    dragoon_pierce: act('鎧貫き', 350, '守備力を無視して貫く。', {
      mp: 4, target: 'enemy', effects: [phys(1.2, { ignoreDef: true })], fx: 'pierce2',
    }),
    dragoon_roar: act('雄叫び', 400, '雄叫びで敵全体の攻撃力を下げる。', {
      mp: 6, target: 'enemies', effects: [buff('atk', -1, 0.6)], fx: 'debuff',
    }),
    dragoon_breath: act('竜の息吹', 500, '炎を吐き、敵全体を焼く。', {
      mp: 10, target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 60, element: 'fire' }], fx: 'breath_fire',
    }),
    dragoon_meteor: act('流星突き', 650, '高く跳び上がり、敵を貫く。', {
      mp: 6, target: 'enemy', effects: [phys(2.2, { acc: 0.9 })], fx: 'jump',
    }),
    dragoon_great_breath: act('ドラゴンブレス', 800, '大いなる竜の吐息で敵全体を撃つ。', {
      mp: 24, target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 110 }], fx: 'breath',
    }),
    dragoon_wrath: reaction('竜の怒り', 450, '攻撃されると攻撃力が上がる。', 'hitAny', 0.4, { type: 'buff', stat: 'atk', stages: 1 }),
    dragoon_equip_spear: support('槍装備', 450, 'どのジョブでも槍を装備できる。', { equip: ['spear'] }),
    dragoon_might: support('竜の力', 700, '武器で与えるダメージが20%上がる。', { physPct: 20 }),
  });

  // ============================================================ 時空術師
  add('timemage', {
    timemage_haste: act('加速', 200, '仲間ひとりの素早さを大きく上げる。', {
      mp: 5, magic: true, target: 'ally', effects: [buff('agi', 2)], fx: 'buff',
    }),
    timemage_slow: act('減速', 250, '敵の群れの素早さを下げる。', {
      mp: 5, magic: true, target: 'group', effects: [buff('agi', -1, 0.8)], fx: 'debuff',
    }),
    timemage_dispel: act('解呪', 250, '敵ひとりにかかった効果を打ち消す。', {
      mp: 4, magic: true, target: 'enemy', effects: [{ type: 'dispel' }], fx: 'dispel',
    }),
    timemage_gravity: act('重力', 400, '敵の群れのHPを4分の1削る。', {
      mp: 8, magic: true, target: 'group', effects: [{ type: 'damage', formula: 'percent', power: 0.25, acc: 0.8 }], fx: 'gravity',
    }),
    timemage_haste_all: act('時空加速', 500, '味方全員の素早さを上げる。', {
      mp: 14, magic: true, target: 'allies', effects: [buff('agi', 1)], fx: 'buff',
    }),
    timemage_stop: act('時止め', 600, '時を止め、敵の群れを動けなくする。', {
      mp: 10, magic: true, target: 'group', effects: [status('paralyze', 0.4)], fx: 'paralyze',
    }),
    timemage_meteor: act('流星雨', 800, '隕石を呼び寄せ、敵に5回降らせる。', {
      mp: 36, magic: true, target: 'random', effects: [magic(12, 0.6, null, { hits: 5 })], fx: 'meteor3',
    }),
    timemage_close_call: reaction('危機一髪', 400, 'HPが減ると、素早さが大きく上がる。', 'lowHp', 1, { type: 'buff', stat: 'agi', stages: 2 }),
    timemage_swift: support('俊足', 700, '戦闘開始時から素早さが上がる。', { startBuffs: { agi: 1 } }),
    timemage_float: field('浮遊の術', 400, '宙に浮き、床のダメージを受けない。', { noFloorDamage: true }),
  });

  // ============================================================ 暗黒騎士
  add('darkknight', {
    darkknight_shadow: act('闇斬り', 250, 'HPを削り、闇の剣で斬りつける。', {
      mp: 0, target: 'enemy', effects: [phys(1.5, { element: 'dark', hpCost: 0.06 })], fx: 'dark1',
    }),
    darkknight_drain: act('吸精剣', 300, '斬りつけて敵のHPを吸い取る。', {
      mp: 4, target: 'enemy', effects: [phys(1.2, { element: 'dark', drain: 0.5 })], fx: 'drain',
    }),
    darkknight_curse: act('呪い斬り', 300, '斬りつけて毒と暗闇を与える。', {
      mp: 4, target: 'enemy', effects: [phys(1.0, { element: 'dark' }), status('poison', 0.5), status('blind', 0.5)], fx: 'dark1',
    }),
    darkknight_pact: act('血の契約', 400, 'HPを捧げ、攻撃力と魔力を上げる。', {
      mp: 0, target: 'self', effects: [Object.assign(buff('atk', 2), { hpCost: 0.15 }), buff('mag', 1)], fx: 'buff',
    }),
    darkknight_wave: act('闇の波動', 500, 'HPを削り、敵全体を闇で撃つ。', {
      mp: 0, target: 'enemies', effects: [phys(1.0, { element: 'dark', hpCost: 0.12 })], fx: 'dark2',
    }),
    darkknight_reaper: act('命狩り', 600, '斬りつけ、ときどき息の根を止める。', {
      mp: 8, target: 'enemy', effects: [phys(0.8, { element: 'dark' }), status('death', 0.25)], fx: 'death',
    }),
    darkknight_doom: act('滅びの刃', 800, 'HPを4分の1捧げる滅びの一撃。', {
      mp: 0, target: 'enemy', effects: [phys(2.8, { element: 'dark', hpCost: 0.25 })], fx: 'dark3',
    }),
    darkknight_fury: reaction('怒りの炎', 500, 'HPが減ると攻撃力が大きく上がる。', 'lowHp', 1, { type: 'buff', stat: 'atk', stages: 2 }),
    darkknight_power: support('力アップ', 700, '力が20%上がる。', { strPct: 20 }),
  });

  // ============================================================ 勇者
  add('hero', {
    hero_radiant: act('聖光斬', 400, '光をまとった剣で敵を斬り裂く。', {
      mp: 8, target: 'enemy', effects: [phys(1.8, { element: 'holy' })], fx: 'holy2',
    }),
    hero_courage: act('勇気の灯火', 400, '味方全員の攻撃力と守備力を上げる。', {
      mp: 18, magic: true, target: 'allies', effects: [buff('atk', 1), buff('def', 1)], fx: 'buff',
    }),
    hero_verdict: act('光の裁き', 550, '光のつるぎで敵全体を斬る。', {
      mp: 16, target: 'enemies', effects: [phys(0.9, { element: 'holy' })], fx: 'holy2',
    }),
    hero_judgment: act('ジャッジメント', 650, '天の光で敵全体を裁く。', {
      mp: 30, magic: true, target: 'enemies', effects: [magic(90, 0.5, 'holy')], fx: 'holy3',
    }),
    hero_hope: act('希望の光', 650, '味方全員を全回復し、状態異常も治す。', {
      mp: 40, magic: true, target: 'allies', effects: [{ type: 'heal', pct: 1 }, cure('all')], fx: 'heal3', fieldUse: true,
    }),
    hero_luminous: act('ルミナス', 900, '紋章の光を込めた一撃。', {
      mp: 30, target: 'enemy', effects: [phys(3.0, { element: 'holy', ignoreDef: true })], fx: 'holy3',
    }),
    hero_guiding_light: reaction('導きの光', 400, '仲間がピンチのとき、光で癒やす。', 'allyLowHp', 0.6, { type: 'heal', pct: 0.5 }),
    hero_heart: support('勇者の心', 600, 'HPとすべての能力値が10%上がる。', { hpPct: 10, strPct: 10, vitPct: 10, agiPct: 10, intPct: 10, mndPct: 10 }),
    hero_aura: field('光の加護', 400, '魔物を避け、歩くとHPが回復する。', { encounterPct: -50, walkHeal: 2, noFloorDamage: true }),
  });
})(window.RPG);
