// Abilities, tier 2: ナイト 武闘家 白魔術師 黒魔術師 狩人 吟遊詩人 薬師.
// JP 100–600 per ability; ~4000 JP to master a job. See abilities.js for the balance notes.
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
  const SONG = '{user}は{name}を歌った！';
  const BREW = '{user}は{name}を調合した！';

  // ============================================================ ナイト
  add('knight', {
    knight_bash: act('盾打ち', 100, '盾で殴りつけ、敵を麻痺させる。', {
      mp: 2, target: 'enemy', effects: [phys(1.0), status('paralyze', 0.25)], fx: 'strike',
    }),
    knight_mind_break: act('魔導砕き', 200, '斬りつけて敵の魔力を下げる。', {
      mp: 3, target: 'enemy', effects: [phys(0.9), buff('mag', -1, 0.8)], fx: 'slash',
    }),
    knight_speed_break: act('足砕き', 200, '足を狙って敵の素早さを下げる。', {
      mp: 3, target: 'enemy', effects: [phys(0.9), buff('agi', -1, 0.8)], fx: 'slash',
    }),
    knight_fortress: act('不動の構え', 250, '身を固め、守備力を大きく上げる。', {
      mp: 2, target: 'self', effects: [buff('def', 2), buff('mdef', 1)], fx: 'buff',
    }),
    knight_oath: act('守りの誓い', 400, '味方全員の守備力を上げる。', {
      mp: 6, target: 'allies', effects: [buff('def', 1)], fx: 'buff',
    }),
    knight_full_power: act('全力斬り', 450, 'ありったけの力で斬りつける。', {
      mp: 5, target: 'enemy', effects: [phys(1.8)], fx: 'slash3',
    }),
    knight_breaker: act('ブレイカー', 500, '斬りつけて敵の攻撃力と守備力を下げる。', {
      mp: 6, target: 'enemy', effects: [phys(1.2), buff('def', -1, 0.7), buff('atk', -1, 0.7)], fx: 'slash2',
    }),
    knight_cover: reaction('かばいだて', 450, 'HPの少ない仲間をかばう。', 'allyLowHp', 0.75, { type: 'cover' }),
    knight_iron_wall: reaction('鉄壁', 350, '攻撃されると守備力が上がる。', 'hitPhys', 0.4, { type: 'buff', stat: 'def', stages: 1 }),
    knight_equip_armor: support('重装備', 600, 'どのジョブでも鎧・兜・盾を装備できる。', { equip: ['heavy', 'helm', 'shield'] }),
    knight_guard_stance: support('守りの構え', 450, '戦闘開始時から守備力が上がる。', { startBuffs: { def: 1 } }),
  });

  // ============================================================ 武闘家
  add('monk', {
    monk_chi: act('気功', 100, '気を練って自分のHPを回復し、毒も消す。', {
      mp: 2, target: 'self', effects: [heal(24, 0.8), cure(['poison'])], fx: 'heal', fieldUse: true,
    }),
    monk_stun: act('当て身', 150, '急所を突いて敵を麻痺させる。', {
      mp: 2, target: 'enemy', effects: [phys(0.8), status('paralyze', 0.35)], fx: 'strike',
    }),
    monk_focus: act('闘気', 200, '自分の攻撃力を大きく上げる。', {
      mp: 3, target: 'self', effects: [buff('atk', 2)], fx: 'buff',
    }),
    monk_flurry: act('乱撃', 300, '敵に4回続けて殴りかかる。', {
      mp: 5, target: 'random', effects: [phys(0.55, { hits: 4 })], fx: 'strike',
    }),
    monk_whirl_kick: act('旋風脚', 300, '風をまとう回し蹴りで敵の群れを蹴散らす。', {
      mp: 4, target: 'group', effects: [phys(0.9, { element: 'wind' })], fx: 'wind2',
    }),
    monk_quake: act('地ならし', 350, '大地を揺らし、敵全体を攻撃する。', {
      mp: 5, target: 'enemies', effects: [phys(0.75, { element: 'earth' })], fx: 'earth2',
    }),
    monk_revive: act('活を入れる', 400, '活を入れて、倒れた仲間を生き返らせる。', {
      mp: 6, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.2 }], fx: 'revive', fieldUse: true, msg: '{user}は活を入れた！',
    }),
    monk_tiger: act('猛虎拳', 450, '猛烈な一撃を放つ。会心が出やすい。', {
      mp: 6, target: 'enemy', effects: [phys(1.8, { critBonus: 15 })], fx: 'strike3',
    }),
    monk_counter: reaction('返し技', 500, '攻撃を受けると、よく反撃する。', 'hitPhys', 0.5, { type: 'counter' }),
    monk_ibuki: reaction('息吹', 400, 'HPが減ると、息を整えて回復する。', 'lowHp', 0.6, { type: 'heal', pct: 0.4 }),
    monk_brawler: support('素手の心得', 400, '素手のときの攻撃力と会心率が上がる。', { unarmed: 30, crit: 5 }),
    monk_training: support('修行', 600, '戦闘で得る経験値が50%増える。', { expPct: 50 }),
  });

  // ============================================================ 白魔術師
  add('whitemage', {
    whitemage_healing: act('ヒーリング', 150, '仲間ひとりのHPを大きく回復する。', {
      mp: 6, magic: true, target: 'ally', effects: [heal(45, 1.0)], fx: 'heal2', fieldUse: true,
    }),
    whitemage_esuna: act('清めの光', 200, '仲間ひとりの状態異常を治す。', {
      mp: 4, magic: true, target: 'ally', effects: [cure('all')], fx: 'cure', fieldUse: true,
    }),
    whitemage_regen: act('命の泉', 300, '仲間ひとりのHPを少しずつ回復させる。', {
      mp: 5, magic: true, target: 'ally', effects: [{ type: 'regen' }], fx: 'regen',
    }),
    whitemage_arrow: act('光の矢', 300, '聖なる光の矢で敵を射抜く。', {
      mp: 7, magic: true, target: 'enemy', effects: [magic(30, 0.7, 'holy', { vs: { undead: 1.5 } })], fx: 'holy2',
    }),
    whitemage_purge: act('退魔の光', 350, '敵の群れを光で撃つ。アンデッドに特に強い。', {
      mp: 8, magic: true, target: 'group', effects: [magic(12, 0.4, 'holy', { vs: { undead: 3 } })], fx: 'holy',
    }),
    whitemage_guard: act('守護の光', 400, '味方全員の守備力と魔法防御を上げる。', {
      mp: 12, magic: true, target: 'allies', effects: [buff('def', 1), buff('mdef', 1)], fx: 'buff',
    }),
    whitemage_heal_wind: act('癒やしの風', 450, '味方全員のHPを回復する。', {
      mp: 12, magic: true, target: 'allies', effects: [heal(30, 0.7)], fx: 'heal2', fieldUse: true,
    }),
    whitemage_resurrect: act('リザレクション', 550, '倒れた仲間をHP6割で生き返らせる。', {
      mp: 18, magic: true, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.6 }], fx: 'revive', fieldUse: true,
    }),
    whitemage_mending_hand: reaction('癒やしの手', 500, '仲間がピンチのとき、HPを癒やす。', 'allyLowHp', 0.5, { type: 'heal', pct: 0.4 }),
    whitemage_heal_up: support('回復アップ', 500, '回復魔法の効果が30%上がる。', { healPct: 30 }),
    whitemage_robe: support('魔法の衣', 350, '魔法防御が30%上がる。', { mdefPct: 30 }),
  });

  // ============================================================ 黒魔術師
  add('blackmage', {
    blackmage_fire2: act('火炎の渦', 150, '炎の渦で敵の群れを焼き尽くす。', {
      mp: 7, magic: true, target: 'group', effects: [magic(4, 0.5, 'fire')], fx: 'fire2',
    }),
    blackmage_ice2: act('アイスストーム', 150, '氷の嵐が敵の群れを襲う。', {
      mp: 7, magic: true, target: 'group', effects: [magic(4, 0.5, 'ice')], fx: 'ice2',
    }),
    blackmage_poison: act('毒の霧', 150, '霧を広げ、敵の群れを毒にする。', {
      mp: 4, magic: true, target: 'group', effects: [status('poison', 0.65)], fx: 'poison',
    }),
    blackmage_thunder2: act('雷の雨', 200, '稲妻が敵全体に降り注ぐ。', {
      mp: 10, magic: true, target: 'enemies', effects: [magic(2, 0.38, 'thunder')], fx: 'thunder2',
    }),
    blackmage_confuse: act('惑わしの風', 250, '敵の群れを混乱させる。', {
      mp: 5, magic: true, target: 'group', effects: [status('confuse', 0.45)], fx: 'confuse',
    }),
    blackmage_osmose: act('魔力吸い', 300, '敵ひとりのMPを吸い取る。', {
      mp: 0, magic: true, target: 'enemy', effects: [magic(6, 0.2, null, { mp: true, drain: 1 })], fx: 'drain',
    }),
    blackmage_blast: act('岩石落とし', 300, '大岩を落とし、敵ひとりを押しつぶす。', {
      mp: 8, magic: true, target: 'enemy', effects: [magic(16, 0.8, 'earth')], fx: 'earth2',
    }),
    blackmage_death: act('魂抜き', 450, '敵ひとりの魂を抜き取る。', {
      mp: 10, magic: true, target: 'enemy', effects: [status('death', 0.35)], fx: 'death',
    }),
    blackmage_inferno: act('インフェルノ', 600, '業火で敵全体を焼き払う。', {
      mp: 15, magic: true, target: 'enemies', effects: [magic(6, 0.6, 'fire')], fx: 'fire3',
    }),
    blackmage_awaken: reaction('魔力覚醒', 400, '魔法を受けると魔力が上がる。', 'hitMagic', 0.6, { type: 'buff', stat: 'mag', stages: 1 }),
    blackmage_magic_up: support('魔法アップ', 600, '魔法のダメージが25%上がる。', { magicPct: 25 }),
    blackmage_elem_up: support('属性アップ', 450, '炎・氷・雷・風・大地の威力が25%上がる。', { elemBoost: { fire: 25, ice: 25, thunder: 25, wind: 25, earth: 25 } }),
  });

  // ============================================================ 狩人
  add('hunter', {
    hunter_aim: act('狙い撃ち', 100, 'よく狙って撃つ。会心が出やすい。', {
      mp: 2, target: 'enemy', effects: [phys(1.3, { acc: 1.3, critBonus: 10 })], fx: 'pierce',
    }),
    hunter_venom: act('毒矢', 150, '毒を塗った矢を放つ。', {
      mp: 2, target: 'enemy', effects: [phys(0.8), status('poison', 0.7)], fx: 'pierce',
    }),
    hunter_double: act('二連射', 200, '素早く2本の矢を射る。', {
      mp: 3, target: 'enemy', effects: [phys(0.8, { hits: 2 })], fx: 'pierce',
    }),
    hunter_sleep: act('眠り矢', 250, '眠り薬の矢で敵を眠らせる。', {
      mp: 3, target: 'enemy', effects: [phys(0.6), status('sleep', 0.5)], fx: 'pierce',
    }),
    hunter_numb: act('しびれ矢', 300, 'しびれ薬の矢で敵を麻痺させる。', {
      mp: 3, target: 'enemy', effects: [phys(0.6), status('paralyze', 0.4)], fx: 'pierce',
    }),
    hunter_skyshot: act('撃ち落とし', 300, '空を飛ぶ敵に大ダメージを与える。', {
      mp: 3, target: 'enemy', effects: [phys(1.2, { vs: { flying: 2 } })], fx: 'pierce2',
    }),
    hunter_rain: act('矢の雨', 400, '矢の雨を降らせ、敵を4回攻撃する。', {
      mp: 6, target: 'random', effects: [phys(0.55, { hits: 4 })], fx: 'pierce2',
    }),
    hunter_deadeye: act('必殺の矢', 550, 'まれに敵を一撃で仕留める。', {
      mp: 6, target: 'enemy', effects: [{ type: 'damage', formula: 'percent', power: 1, acc: 0.2 }], fx: 'pierce3',
    }),
    hunter_cover_fire: reaction('援護射撃', 450, '仲間がピンチになると敵を撃つ。', 'allyLowHp', 0.6, { type: 'counter' }),
    hunter_equip_bow: support('弓装備', 350, 'どのジョブでも弓を装備できる。', { equip: ['bow'] }),
    hunter_spoils: support('獲物狩り', 500, '魔物が道具を落としやすくなる。', { dropPct: 100 }),
    hunter_lure: field('獲物寄せ', 300, '魔物に出会いやすくなる。', { encounterPct: 100 }),
  });

  // ============================================================ 吟遊詩人
  add('bard', {
    bard_lullaby: act('子守歌', 100, '敵全体を眠りに誘う。', {
      mp: 4, target: 'enemies', effects: [status('sleep', 0.4)], fx: 'song', msg: SONG,
    }),
    bard_swift: act('疾風の歌', 200, '味方全員の素早さを上げる。', {
      mp: 5, target: 'allies', effects: [buff('agi', 1)], fx: 'song', msg: SONG,
    }),
    bard_hymn: act('癒やしの歌', 250, '味方全員のHPを回復する。', {
      mp: 6, target: 'allies', effects: [heal(12, 0.45)], fx: 'song', msg: SONG, fieldUse: true,
    }),
    bard_battle: act('戦いの歌', 300, '味方全員の攻撃力を上げる。', {
      mp: 7, target: 'allies', effects: [buff('atk', 1)], fx: 'song', msg: SONG,
    }),
    bard_requiem: act('鎮魂歌', 300, '魂を鎮める歌。アンデッドによく効く。', {
      mp: 8, target: 'enemies', effects: [magic(8, 0.35, 'holy', { vs: { undead: 2 } })], fx: 'song', msg: SONG,
    }),
    bard_bewilder: act('惑わしの歌', 350, '敵全体を混乱させる。', {
      mp: 6, target: 'enemies', effects: [status('confuse', 0.35)], fx: 'song', msg: SONG,
    }),
    bard_mana: act('魔力の歌', 400, '身を削って歌い、味方全員のMPを回復する。', {
      mp: 0, target: 'allies', oncePerBattle: true, effects: [{ type: 'healMp', power: 8, hpCost: 0.2 }], fx: 'song', msg: SONG,
    }),
    bard_life: act('命の歌', 500, '味方全員の毒を消し、HPを少しずつ癒やす。', {
      mp: 12, target: 'allies', effects: [cure(['poison']), { type: 'regen' }], fx: 'song', msg: SONG,
    }),
    bard_rally: reaction('立ち直り', 350, 'HPが減ると、歌って自分を癒やす。', 'lowHp', 0.7, { type: 'heal', pct: 0.3 }),
    bard_learning: support('学びの心', 600, '戦闘で得るJPが50%増える。', { jpPct: 50 }),
    bard_calm: field('安らぎの調べ', 450, '魔物に出会いにくくなる。', { encounterPct: -50 }),
  });

  // ============================================================ 薬師
  add('alchemist', {
    alchemist_salve: act('癒やしの薬', 100, '仲間ひとりのHPを回復する。', {
      mp: 3, target: 'ally', effects: [heal(30, 0.3)], fx: 'heal', msg: BREW, fieldUse: true,
    }),
    alchemist_panacea: act('特効薬', 150, '仲間ひとりの状態異常を治す。', {
      mp: 3, target: 'ally', effects: [cure('all')], fx: 'cure', msg: BREW, fieldUse: true,
    }),
    alchemist_venom: act('毒瓶', 150, '瓶を投げつけ、敵の群れを毒にする。', {
      mp: 3, target: 'group', effects: [status('poison', 0.7)], fx: 'poison', msg: BREW,
    }),
    alchemist_fire_flask: act('火炎瓶', 200, '燃える瓶を投げ、敵の群れを焼く。', {
      mp: 5, target: 'group', effects: [magic(6, 0.4, 'fire')], fx: 'fire2', msg: BREW,
    }),
    alchemist_numb: act('しびれ瓶', 250, 'しびれ薬で敵ひとりを麻痺させる。', {
      mp: 4, target: 'enemy', effects: [status('paralyze', 0.5)], fx: 'paralyze', msg: BREW,
    }),
    alchemist_tonic: act('強化薬', 300, '仲間ひとりの攻撃力と守備力を上げる。', {
      mp: 6, target: 'ally', effects: [buff('atk', 1), buff('def', 1)], fx: 'buff', msg: BREW,
    }),
    alchemist_ether: act('魔力薬', 400, '生気を込め、仲間ひとりのMPを15回復する。', {
      mp: 0, target: 'ally', oncePerBattle: true, effects: [{ type: 'healMp', power: 15, hpCost: 0.2 }], fx: 'mp', msg: BREW,
    }),
    alchemist_revive: act('復活薬', 450, '倒れた仲間をHP半分で生き返らせる。', {
      mp: 12, target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', msg: BREW, fieldUse: true,
    }),
    alchemist_blast: act('爆薬', 500, '爆薬で敵全体を吹き飛ばす。', {
      mp: 12, target: 'enemies', effects: [magic(16, 0.5)], fx: 'explosion2', msg: BREW,
    }),
    alchemist_auto_potion: reaction('とっさの薬', 450, 'HPが減ると、手持ちの薬で回復する。', 'lowHp', 1, { type: 'autoItem' }),
    alchemist_first_aid: reaction('薬の援護', 500, '仲間がピンチのとき、道具で癒やす。', 'allyLowHp', 0.7, { type: 'autoItem' }),
    alchemist_item_lore: support('道具の知識', 500, '道具の効果が50%上がる。', { itemPct: 50 }),
    alchemist_profit: support('金もうけ', 450, '戦闘で得るゴールドが50%増える。', { goldPct: 50 }),
  });
})(window.RPG);
