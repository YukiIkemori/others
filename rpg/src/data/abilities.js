// Abilities, tier 1: 戦士 僧侶 魔法使い 盗賊 (DESIGN §5.3).
// Tier 2 is in abilities_adv.js, tiers 3–4 in abilities_elite.js.
// Balance (DESIGN §6; `node tools/check_jobs.js` prints the damage/heal tables). mag ≈ atk at
// every level, and a spell deals ≈ (power + 0.5·mag) while a weapon hit is ≈ 0.4·atk, so spells
// are sized in "戦士 hits" (ratio at the level where they are usually bought):
//   single  T1 10–12 + mag×0.5–0.55 (≈1.5) · T2 16 + ×0.8 (≈2) · T4 40 + ×1.2 (≈3)
//   group   T1 8 + ×0.38 (≈0.9 each) · T2 4 + ×0.5 (≈1.1) · all T2 2 + ×0.38 (≈1.0) · all T3 6–10 + ×0.6–0.75 (≈1.3–1.5)
//   heals   ヒール 14+mnd×0.7 → ヒーリング 45+×1.0 → 恵みの雨 (all) 70+×1.0 → フルヒール / 希望の光
//   skills  phys power 1.3–2.0 single (MP 2–6), 0.7–0.9 on groups; hpCost skills trade HP for MP 0
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

  // ============================================================ 戦士
  add('warrior', {
    warrior_power_slash: act('力斬り', 30, '狙いは甘いが、力いっぱい斬りつける。', {
      mp: 0, target: 'enemy', effects: [phys(1.5, { acc: 0.8 })], fx: 'slash',
    }),
    warrior_first_aid: act('手当て', 80, '自分の傷を手当てし、毒も消す。', {
      mp: 2, target: 'self', effects: [heal(16, 0.5), cure(['poison'])], fx: 'heal', fieldUse: true,
    }),
    warrior_armor_break: act('鎧砕き', 120, '斬りつけて敵の守備力を下げる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), buff('def', -1, 0.8)], fx: 'slash',
    }),
    warrior_weapon_break: act('武器砕き', 160, '斬りつけて敵の攻撃力を下げる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), buff('atk', -1, 0.8)], fx: 'slash',
    }),
    warrior_double: act('連続斬り', 200, '素早く2回斬りつける。', {
      mp: 3, target: 'enemy', effects: [phys(0.75, { hits: 2 })], fx: 'slash',
    }),
    warrior_sweep: act('なぎ払い', 240, '武器を振り回し、敵全体を打つ。', {
      mp: 4, target: 'enemies', effects: [phys(0.7)], fx: 'slash',
    }),
    warrior_rush: act('突進', 260, '飛び込んで斬る。会心が出やすい。', {
      mp: 3, target: 'enemy', effects: [phys(1.2, { critBonus: 20 })], fx: 'strike',
    }),
    warrior_war_cry: act('ときの声', 280, '味方全員の攻撃力を上げる。', {
      mp: 6, target: 'allies', effects: [buff('atk', 1)], fx: 'buff',
    }),
    warrior_mighty: act('諸手斬り', 300, '両手で力いっぱい斬り下ろす。', {
      mp: 5, target: 'enemy', effects: [phys(1.9)], fx: 'slash3',
    }),
    warrior_counter: reaction('反撃', 300, '攻撃を受けると、ときどき反撃する。', 'hitPhys', 0.3, { type: 'counter' }),
    warrior_brace: reaction('踏ん張り', 250, 'HPが減ると守備力が大きく上がる。', 'lowHp', 0.8, { type: 'buff', stat: 'def', stages: 2 }),
    warrior_hp_up: support('HPアップ', 300, '最大HPが20%上がる。', { hpPct: 20 }),
    warrior_equip_axe: support('斧装備', 150, 'どのジョブでも斧を装備できる。', { equip: ['axe'] }),
    warrior_crit_up: support('会心アップ', 300, '会心の一撃が出やすくなる。', { crit: 8 }),
  });

  // ============================================================ 僧侶
  add('priest', {
    priest_heal: act('ヒール', 30, '仲間ひとりのHPを回復する。', {
      mp: 3, magic: true, target: 'ally', effects: [heal(14, 0.7)], fx: 'heal', fieldUse: true,
    }),
    priest_cure: act('解毒', 100, '仲間ひとりの毒と暗闇を治す。', {
      mp: 2, magic: true, target: 'ally', effects: [cure(['poison', 'blind'])], fx: 'cure', fieldUse: true,
    }),
    priest_holy: act('光のつぶて', 150, '聖なる光を放つ。アンデッドに強い。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'holy', { vs: { undead: 1.5 } })], fx: 'holy',
    }),
    priest_protect: act('守りの祈り', 180, '仲間ひとりの守備力を上げる。', {
      mp: 3, magic: true, target: 'ally', effects: [buff('def', 1)], fx: 'buff',
    }),
    priest_awaken: act('目覚めの祈り', 230, '仲間ひとりの眠り・麻痺・混乱・沈黙を治す。', {
      mp: 3, magic: true, target: 'ally', effects: [cure(['sleep', 'paralyze', 'confuse', 'silence'])], fx: 'cure', fieldUse: true,
    }),
    priest_silence: act('しじまの祈り', 250, '敵の群れの魔法を封じる。', {
      mp: 3, magic: true, target: 'group', effects: [status('silence', 0.6)], fx: 'silence',
    }),
    priest_barrier: act('光の壁', 260, '味方全員の魔法防御を上げる。', {
      mp: 6, magic: true, target: 'allies', effects: [buff('mdef', 1)], fx: 'buff',
    }),
    priest_heal_all: act('癒やしの輪', 300, '味方全員のHPを回復する。', {
      mp: 7, magic: true, target: 'allies', effects: [heal(14, 0.55)], fx: 'heal', fieldUse: true,
    }),
    priest_revive: act('リバイブ', 300, '倒れた仲間を生き返らせる。', {
      mp: 10, magic: true, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.25 }], fx: 'revive', fieldUse: true,
    }),
    priest_mp_regain: reaction('MP回収', 300, 'ダメージを受けると、MPが少し戻る。', 'hitAny', 0.4, { type: 'mp', power: 6 }),
    priest_mnd_up: support('精神アップ', 300, '精神が20%上がり、回復量が増す。', { mndPct: 20 }),
    priest_pure: support('清めの心', 300, '毒と暗闇にかからなくなる。', { statusImmune: ['poison', 'blind'] }),
    priest_walk_heal: field('癒やしの歩み', 300, '歩くたびにHPが少し回復する。', { walkHeal: 1 }),
  });

  // ============================================================ 魔法使い
  add('mage', {
    mage_fire: act('ファイアボール', 30, '火の玉で敵ひとりを焼く。', {
      mp: 2, magic: true, target: 'enemy', effects: [magic(10, 0.5, 'fire')], fx: 'fire1',
    }),
    mage_scan: act('アナライズ', 80, '敵のHPと弱点を見破る。', {
      mp: 1, magic: true, target: 'enemy', effects: [{ type: 'scan' }], fx: 'scan',
    }),
    mage_ice: act('アイスニードル', 120, '氷の針で敵ひとりを刺す。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'ice')], fx: 'ice1',
    }),
    mage_exit: act('脱出', 150, '洞窟や塔から外へ抜け出す。', {
      mp: 4, magic: true, target: 'self', effects: [{ type: 'exit' }], fx: 'warp', fieldUse: true,
    }),
    mage_thunder: act('ライトニング', 160, '稲妻で敵ひとりを撃つ。', {
      mp: 3, magic: true, target: 'enemy', effects: [magic(12, 0.55, 'thunder')], fx: 'thunder1',
    }),
    mage_sleep: act('眠りの霧', 200, '敵の群れを眠らせる。', {
      mp: 3, magic: true, target: 'group', effects: [status('sleep', 0.55)], fx: 'sleep',
    }),
    mage_blind: act('暗闇の霧', 220, '敵の群れの目をくらませる。', {
      mp: 3, magic: true, target: 'group', effects: [status('blind', 0.6)], fx: 'blind',
    }),
    mage_wind: act('かまいたち', 250, '風の刃で敵の群れを切り裂く。', {
      mp: 4, magic: true, target: 'group', effects: [magic(8, 0.38, 'wind')], fx: 'wind1',
    }),
    mage_teleport: act('ワープ', 250, '一度訪れた町や村へひとっ飛び。', {
      mp: 6, magic: true, target: 'self', effects: [{ type: 'teleport' }], fx: 'warp', fieldUse: true,
    }),
    mage_missile: act('魔力の矢', 300, '魔力の矢を放つ。属性を持たない。', {
      mp: 4, magic: true, target: 'enemy', effects: [magic(18, 0.6)], fx: 'magic',
    }),
    mage_ward: reaction('魔法の盾', 250, '魔法を受けると魔法防御が上がる。', 'hitMagic', 0.6, { type: 'buff', stat: 'mdef', stages: 1 }),
    mage_mp_up: support('MPアップ', 300, '最大MPが20%上がる。', { mpPct: 20 }),
    mage_int_up: support('知力アップ', 300, '知力が15%上がる。', { intPct: 15 }),
    mage_mp_save: support('MP節約', 300, '消費MPが15%減る。', { mpCostPct: -15 }),
  });

  // ============================================================ 盗賊
  add('thief', {
    thief_steal: act('盗む', 50, '敵の持ち物を盗む。', {
      mp: 0, target: 'enemy', effects: [{ type: 'steal' }], fx: 'steal', msg: '{user}は隙を見て飛びかかった！',
    }),
    thief_sand: act('砂かけ', 120, '砂をかけて敵の目をくらませる。', {
      mp: 0, target: 'enemy', effects: [status('blind', 0.7)], fx: 'blind',
    }),
    thief_flee: act('ずらかる', 150, '戦闘から必ず逃げ出す。', {
      mp: 2, target: 'self', effects: [{ type: 'escape' }], fx: 'smoke', msg: '{user}は一目散に逃げ出した！',
    }),
    thief_repel: act('気配消し', 180, 'しばらく魔物が寄ってこなくなる。', {
      mp: 3, target: 'self', effects: [{ type: 'repel', steps: 200 }], fx: 'magic', fieldUse: true,
    }),
    thief_quick: act('はやて斬り', 200, '目にも止まらぬ速さで2回斬る。', {
      mp: 2, target: 'enemy', effects: [phys(0.7, { hits: 2, acc: 1.1 })], fx: 'slash',
    }),
    thief_poison: act('毒の刃', 220, '毒を塗った刃で斬りつける。', {
      mp: 2, target: 'enemy', effects: [phys(0.9), status('poison', 0.6)], fx: 'slash',
    }),
    thief_mug: act('ひったくり', 280, '攻撃と同時に持ち物を盗む。', {
      mp: 3, target: 'enemy', effects: [phys(0.8), { type: 'steal' }], fx: 'steal',
    }),
    thief_steal_rare: act('大物狙い', 300, '珍しいお宝を狙って盗む。', {
      mp: 4, target: 'enemy', effects: [{ type: 'steal', rareBonus: 0.25 }], fx: 'steal',
    }),
    thief_nimble: reaction('早足', 250, '攻撃を受けると素早さが上がる。', 'hitAny', 0.5, { type: 'buff', stat: 'agi', stages: 1 }),
    thief_rare_hunter: support('レアハンター', 300, 'レアアイテムを手に入れやすくなる。', { rarePct: 100 }),
    thief_steal_up: support('盗みのコツ', 250, '盗みが成功しやすくなる。', { stealPct: 50 }),
    // 盗賊's signature (always on once mastered). autoSteal: % of the 盗む success chance a landed 戦う
    // also tries — silent when nothing is taken, rare item at half the rate (battle.js *autoSteal)
    thief_auto_steal: support('ついでに盗む', 300, '通常攻撃が当たると、ときどき盗む。', { autoSteal: 70 }),
    thief_ambush: support('先駆け', 300, '先制攻撃しやすく、逃げやすくもなる。', { preemptPct: 20, escapePct: 25 }),
    // (hidden items were removed from the game; this field ability now improves loot)
    thief_treasure: field('目利き', 300, '魔物の落とし物とゴールドが増える。', { dropPct: 100, goldPct: 25 }),
  });
})(window.RPG);
