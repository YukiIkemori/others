// Jobs (DESIGN §5.2): 19 FFT-style jobs in four tiers. Ids, names, tiers and
// requirements are fixed by the design; abilities live in abilities*.js.
//
// Growth design:
//   tier 1  warrior priest mage thief                      (JP 30–300, ~3000 to master)
//   tier 2  knight monk whitemage blackmage hunter bard alchemist   (100–600, ~4000)
//   tier 3  spellblade paladin ninja sage dragoon timemage darkknight (200–900, ~4700)
//   tier 4  hero                                           (400–1200, ~5000)
// The prized passives sit deep in the tree so that mixing pays off:
//   二刀流 (ninja) · 重装備 (knight) · MP半減 (sage) · レアハンター (thief)
//   修行 EXP+50% (monk) · 学びの心 JP+50% (bard) · 回復アップ (whitemage)
//   魔法アップ (blackmage) · 竜の力 (dragoon) · 俊足 (timemage)
//   不屈の誓い auto-revive (paladin) · とっさの薬 auto-item (alchemist)
//
// mult: multipliers on the character's base stats (chars.js growth). Menu order
// on the job board = definition order within a tier.
(function (R) {
  'use strict';

  const job = (o) => Object.assign({ heads: ['hat'], bodies: ['light'], shield: false, req: [] }, o);

  Object.assign(R.DB.jobs, {
    // ================================================================ tier 1
    warrior: job({
      name: '戦士', tier: 1, command: '戦技',
      desc: '武器を振るい、前に出て戦う。\n力と体力に優れる。',
      mult: { hp: 1.2, mp: 0.6, str: 1.2, vit: 1.15, agi: 0.95, int: 0.7, mnd: 0.8, luk: 1.0 },
      weapons: ['sword', 'axe', 'spear'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'],
      abilities: [
        'warrior_power_slash', 'warrior_first_aid', 'warrior_armor_break', 'warrior_weapon_break', 'warrior_double',
        'warrior_sweep', 'warrior_rush', 'warrior_war_cry', 'warrior_mighty',
        'warrior_counter', 'warrior_brace',
        'warrior_hp_up', 'warrior_equip_axe', 'warrior_crit_up',
      ],
      outfit: { main: '#b8402c', sub: '#8c94a4', trim: '#e8b040' },
    }),
    priest: job({
      name: '僧侶', tier: 1, command: '祈り',
      desc: '祈りで仲間の傷を癒やす。\n守りの祈りも使える。',
      mult: { hp: 1.0, mp: 1.15, str: 0.85, vit: 0.95, agi: 1.0, int: 0.9, mnd: 1.25, luk: 1.0 },
      weapons: ['staff'], shield: true, heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'priest_heal', 'priest_cure', 'priest_holy', 'priest_protect', 'priest_awaken', 'priest_silence',
        'priest_barrier', 'priest_heal_all', 'priest_revive',
        'priest_mp_regain',
        'priest_mnd_up', 'priest_pure',
        'priest_walk_heal',
      ],
      outfit: { main: '#eae6d8', sub: '#3c6cc0', trim: '#d8a838' },
    }),
    mage: job({
      name: '魔法使い', tier: 1, command: '魔法',
      desc: '炎や氷の魔法を操る。\n一度訪れた町へワープもできる。',
      mult: { hp: 0.85, mp: 1.3, str: 0.7, vit: 0.8, agi: 1.0, int: 1.3, mnd: 1.0, luk: 1.0 },
      weapons: ['rod', 'knife'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'mage_fire', 'mage_scan', 'mage_ice', 'mage_exit', 'mage_thunder', 'mage_sleep', 'mage_blind',
        'mage_wind', 'mage_teleport', 'mage_missile',
        'mage_ward',
        'mage_mp_up', 'mage_int_up', 'mage_mp_save',
      ],
      outfit: { main: '#6a3aa8', sub: '#2c2450', trim: '#f0d060' },
    }),
    thief: job({
      name: '盗賊', tier: 1, command: '小技',
      desc: '素早い身のこなしで道具を盗む。\n珍しいお宝にも目ざとい。',
      mult: { hp: 0.95, mp: 0.75, str: 0.95, vit: 0.9, agi: 1.3, int: 0.85, mnd: 0.85, luk: 1.3 },
      weapons: ['knife'], heads: ['hat'], bodies: ['light'],
      abilities: [
        'thief_steal', 'thief_sand', 'thief_flee', 'thief_repel', 'thief_quick', 'thief_poison',
        'thief_mug', 'thief_steal_rare',
        'thief_nimble',
        'thief_rare_hunter', 'thief_steal_up', 'thief_ambush',
        'thief_treasure',
      ],
      outfit: { main: '#3e7a44', sub: '#5a4030', trim: '#c8c8c0' },
    }),

    // ================================================================ tier 2
    knight: job({
      name: 'ナイト', tier: 2, command: '騎士道', req: [['warrior', 3]],
      desc: '重い鎧と盾で仲間を守る。\n敵の力をくじく技も持つ。',
      mult: { hp: 1.25, mp: 0.7, str: 1.2, vit: 1.3, agi: 0.85, int: 0.7, mnd: 1.0, luk: 0.9 },
      weapons: ['sword', 'spear'], shield: true, heads: ['helm'], bodies: ['heavy', 'light'],
      abilities: [
        'knight_bash', 'knight_mind_break', 'knight_speed_break', 'knight_fortress', 'knight_oath',
        'knight_full_power', 'knight_breaker',
        'knight_cover', 'knight_iron_wall',
        'knight_equip_armor', 'knight_guard_stance',
      ],
      outfit: { main: '#c4ccd8', sub: '#2c4c9c', trim: '#e8c850' },
    }),
    monk: job({
      name: '武闘家', tier: 2, command: '拳法', req: [['warrior', 2], ['priest', 2]],
      desc: '鍛えた拳で戦う武術家。\n武器がなくても強い。',
      mult: { hp: 1.3, mp: 0.7, str: 1.25, vit: 1.1, agi: 1.15, int: 0.65, mnd: 1.0, luk: 1.0 },
      weapons: ['claw'], heads: ['hat'], bodies: ['light'],
      innate: { unarmed: 12 },
      abilities: [
        'monk_chi', 'monk_stun', 'monk_focus', 'monk_flurry', 'monk_whirl_kick', 'monk_quake',
        'monk_revive', 'monk_tiger',
        'monk_counter', 'monk_ibuki',
        'monk_brawler', 'monk_training',
      ],
      outfit: { main: '#e0782c', sub: '#3a2c20', trim: '#f0e0a8' },
    }),
    whitemage: job({
      name: '白魔術師', tier: 2, command: '白魔法', req: [['priest', 3]],
      desc: '回復と蘇生の魔法の使い手。\n光の魔法で魔を払う。',
      mult: { hp: 0.95, mp: 1.3, str: 0.7, vit: 0.9, agi: 0.95, int: 1.0, mnd: 1.35, luk: 1.0 },
      weapons: ['staff'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'whitemage_healing', 'whitemage_esuna', 'whitemage_regen', 'whitemage_arrow', 'whitemage_purge',
        'whitemage_guard', 'whitemage_heal_wind', 'whitemage_resurrect',
        'whitemage_mending_hand',
        'whitemage_heal_up', 'whitemage_robe',
      ],
      outfit: { main: '#f6f6f2', sub: '#c83c3c', trim: '#e8b848' },
    }),
    blackmage: job({
      name: '黒魔術師', tier: 2, command: '黒魔法', req: [['mage', 3]],
      desc: '破壊の魔法を極めた魔術師。\n敵の群れをまとめてなぎ払う。',
      mult: { hp: 0.85, mp: 1.3, str: 0.65, vit: 0.8, agi: 1.0, int: 1.4, mnd: 0.95, luk: 1.0 },
      weapons: ['rod'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'blackmage_fire2', 'blackmage_ice2', 'blackmage_poison', 'blackmage_thunder2', 'blackmage_confuse',
        'blackmage_osmose', 'blackmage_blast', 'blackmage_death', 'blackmage_inferno',
        'blackmage_awaken',
        'blackmage_magic_up', 'blackmage_elem_up',
      ],
      outfit: { main: '#24285a', sub: '#16162a', trim: '#f0d040' },
    }),
    hunter: job({
      name: '狩人', tier: 2, command: '弓術', req: [['thief', 3]],
      desc: '弓の名手。毒矢やしびれ矢で\n獲物の急所を狙う。',
      mult: { hp: 1.05, mp: 0.8, str: 1.1, vit: 1.0, agi: 1.2, int: 0.8, mnd: 0.9, luk: 1.15 },
      weapons: ['bow', 'knife'], heads: ['hat'], bodies: ['light'],
      abilities: [
        'hunter_aim', 'hunter_venom', 'hunter_double', 'hunter_sleep', 'hunter_numb', 'hunter_skyshot',
        'hunter_rain', 'hunter_deadeye',
        'hunter_cover_fire',
        'hunter_equip_bow', 'hunter_spoils',
        'hunter_lure',
      ],
      outfit: { main: '#6a7c2c', sub: '#8a5a2c', trim: '#d8c890' },
    }),
    bard: job({
      name: '吟遊詩人', tier: 2, command: '歌', req: [['priest', 2], ['thief', 2]],
      desc: '歌で仲間を奮い立たせ、\n敵を眠らせる旅の歌い手。',
      mult: { hp: 0.95, mp: 1.1, str: 0.85, vit: 0.9, agi: 1.15, int: 1.05, mnd: 1.2, luk: 1.2 },
      weapons: ['harp', 'knife'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'bard_lullaby', 'bard_swift', 'bard_hymn', 'bard_battle', 'bard_requiem', 'bard_bewilder',
        'bard_mana', 'bard_life',
        'bard_rally',
        'bard_learning',
        'bard_calm',
      ],
      outfit: { main: '#2ca0a4', sub: '#e8e0a0', trim: '#c8488c' },
    }),
    alchemist: job({
      name: '薬師', tier: 2, command: '調合', req: [['mage', 2], ['thief', 2]],
      desc: '薬と爆薬を扱う。\n道具の効果も高める。',
      mult: { hp: 1.0, mp: 1.05, str: 0.9, vit: 1.0, agi: 1.05, int: 1.15, mnd: 1.1, luk: 1.15 },
      weapons: ['knife', 'staff'], heads: ['hat'], bodies: ['light', 'robe'],
      innate: { itemPct: 25 },
      abilities: [
        'alchemist_salve', 'alchemist_panacea', 'alchemist_venom', 'alchemist_fire_flask', 'alchemist_numb',
        'alchemist_tonic', 'alchemist_ether', 'alchemist_revive', 'alchemist_blast',
        'alchemist_auto_potion', 'alchemist_first_aid',
        'alchemist_item_lore', 'alchemist_profit',
      ],
      outfit: { main: '#8c6a3c', sub: '#e8dcc0', trim: '#4aa04a' },
    }),

    // ================================================================ tier 3
    spellblade: job({
      name: '魔法剣士', tier: 3, command: '魔剣', req: [['knight', 3], ['blackmage', 3]],
      desc: '剣に魔法を宿して戦う。\n敵の弱点を斬り裂く。',
      mult: { hp: 1.1, mp: 1.05, str: 1.15, vit: 1.05, agi: 1.05, int: 1.2, mnd: 0.95, luk: 1.0 },
      weapons: ['sword', 'knife'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'],
      abilities: [
        'spellblade_flame', 'spellblade_frost', 'spellblade_thunder', 'spellblade_seal', 'spellblade_gale',
        'spellblade_enchant', 'spellblade_dance',
        'spellblade_riposte',
        'spellblade_equip_sword', 'spellblade_dual_path',
      ],
      outfit: { main: '#3a44b8', sub: '#b83c3c', trim: '#e0e0e8' },
    }),
    paladin: job({
      name: 'パラディン', tier: 3, command: '聖剣', req: [['knight', 5], ['whitemage', 4]],
      desc: '聖なる力を宿す騎士。\n魔を払い、仲間を守り抜く。',
      mult: { hp: 1.3, mp: 0.95, str: 1.2, vit: 1.3, agi: 0.9, int: 0.85, mnd: 1.2, luk: 1.0 },
      weapons: ['sword', 'spear'], shield: true, heads: ['helm'], bodies: ['heavy', 'light'],
      abilities: [
        'paladin_holy_blade', 'paladin_heal', 'paladin_purify', 'paladin_sacrifice', 'paladin_wave',
        'paladin_cross',
        'paladin_last_stand', 'paladin_guardian',
        'paladin_ward', 'paladin_life',
      ],
      outfit: { main: '#f0ecd8', sub: '#c89830', trim: '#4c7cd8' },
    }),
    ninja: job({
      name: '忍者', tier: 3, command: '忍法', req: [['hunter', 4], ['monk', 3]],
      desc: '影に生きる忍び。武器を二つ持ち、\n誰よりも速く動く。',
      mult: { hp: 1.05, mp: 0.8, str: 1.15, vit: 0.95, agi: 1.4, int: 0.95, mnd: 0.85, luk: 1.15 },
      weapons: ['katana', 'knife'], heads: ['hat'], bodies: ['light'],
      innate: { twoSwords: true },
      abilities: [
        'ninja_shuriken', 'ninja_smoke', 'ninja_bind', 'ninja_mirage', 'ninja_flame', 'ninja_thunder',
        'ninja_water', 'ninja_assassin',
        'ninja_retaliate',
        'ninja_two_swords', 'ninja_equip_katana',
      ],
      outfit: { main: '#30303c', sub: '#9c2c2c', trim: '#a0a4b0' },
    }),
    sage: job({
      name: '賢者', tier: 3, command: '秘術', req: [['whitemage', 5], ['blackmage', 5]],
      desc: '白と黒の魔法を極めた者。\n最高位の呪文を操る。',
      mult: { hp: 0.95, mp: 1.4, str: 0.7, vit: 0.9, agi: 1.0, int: 1.3, mnd: 1.3, luk: 1.05 },
      weapons: ['staff', 'rod'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'sage_full_heal', 'sage_blessed_rain', 'sage_prominence', 'sage_zero', 'sage_mother', 'sage_stardust',
        'sage_mana_return',
        'sage_half_mp',
      ],
      outfit: { main: '#2c8a5c', sub: '#f0e4b8', trim: '#e8b840' },
    }),
    dragoon: job({
      name: '竜騎士', tier: 3, command: '槍術', req: [['knight', 4], ['hunter', 4]],
      desc: '竜の力を槍に宿す騎士。\n空から舞い降りて敵を貫く。',
      mult: { hp: 1.2, mp: 0.8, str: 1.3, vit: 1.15, agi: 1.0, int: 0.7, mnd: 0.85, luk: 0.95 },
      weapons: ['spear'], shield: true, heads: ['helm'], bodies: ['heavy', 'light'],
      abilities: [
        'dragoon_wyvern', 'dragoon_leech', 'dragoon_pierce', 'dragoon_roar', 'dragoon_breath',
        'dragoon_meteor', 'dragoon_great_breath',
        'dragoon_wrath',
        'dragoon_equip_spear', 'dragoon_might',
      ],
      outfit: { main: '#4c3c90', sub: '#2c8c8c', trim: '#e0c858' },
    }),
    timemage: job({
      name: '時空術師', tier: 3, command: '時空魔法', req: [['blackmage', 4], ['bard', 3]],
      desc: '時と重力を操る術師。\n隕石を呼ぶこともできる。',
      mult: { hp: 0.9, mp: 1.35, str: 0.65, vit: 0.85, agi: 1.1, int: 1.25, mnd: 1.15, luk: 1.05 },
      weapons: ['rod', 'staff'], heads: ['hat'], bodies: ['light', 'robe'],
      abilities: [
        'timemage_haste', 'timemage_slow', 'timemage_dispel', 'timemage_gravity', 'timemage_haste_all',
        'timemage_stop', 'timemage_meteor',
        'timemage_close_call',
        'timemage_swift',
        'timemage_float',
      ],
      outfit: { main: '#c8a030', sub: '#40285c', trim: '#f0f0f0' },
    }),
    darkknight: job({
      name: '暗黒騎士', tier: 3, command: '暗黒剣', req: [['warrior', 6], ['blackmage', 4]],
      desc: '自らの命を削り、\n闇の力を振るう騎士。',
      mult: { hp: 1.3, mp: 0.9, str: 1.35, vit: 1.15, agi: 0.9, int: 1.0, mnd: 0.7, luk: 0.85 },
      weapons: ['sword', 'axe'], shield: true, heads: ['helm'], bodies: ['heavy'],
      innate: { elemResist: { dark: 0.5 } },
      abilities: [
        'darkknight_shadow', 'darkknight_drain', 'darkknight_curse', 'darkknight_pact', 'darkknight_wave',
        'darkknight_reaper', 'darkknight_doom',
        'darkknight_fury',
        'darkknight_power',
      ],
      outfit: { main: '#28202e', sub: '#6c1a2c', trim: '#8c8ca0' },
    }),

    // ================================================================ tier 4
    hero: job({
      name: '勇者', tier: 4, command: '奇跡', req: [['paladin', 5], ['spellblade', 5]],
      desc: '光に選ばれし勇者。\n光の奇跡で闇を打ち払う。',
      mult: { hp: 1.3, mp: 1.1, str: 1.3, vit: 1.25, agi: 1.15, int: 1.1, mnd: 1.15, luk: 1.2 },
      weapons: ['sword', 'spear', 'katana'], shield: true, heads: ['helm', 'hat'], bodies: ['heavy', 'light'],
      innate: { statusImmune: ['death'] },
      abilities: [
        'hero_radiant', 'hero_courage', 'hero_verdict', 'hero_judgment', 'hero_hope', 'hero_luminous',
        'hero_guiding_light',
        'hero_heart',
        'hero_aura',
      ],
      outfit: { main: '#2c5cd0', sub: '#f4f4f8', trim: '#f0c830' },
    }),
  });
})(window.RPG);
