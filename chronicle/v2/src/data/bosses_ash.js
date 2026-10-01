// 灰の荒野のボスと大会の相手（BATTLE の形。WORLD_REDESIGN §4.7・§4.10・E18、STORY_BIBLE §7.7）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   炎の試練（闘技大会）5 回戦: 回ごとに相手の型が違う（どれも scale:'tier'。間に控え室で全快、負けたらその回から）。
//     1 回戦 一族の若者たち（4 人。数が多い）
//     2 回戦 獣使いのガロと岩の獣・火トカゲの子 2（獣使いが群れの頭: 倒れると獣は座りこむ。口笛を吹く予告 → 岩の獣の突進（全体。守る））
//     3 回戦 術師の姉妹（姉ヒノエが妹を起こし・癒やす = 先に姉を倒す（群れの頭）。妹スミの詠唱の予告 → 火柱（全体。守る））
//     4 回戦 鉄鎧のバルガ（硬い。打撃がよく効く。大きく振りかぶる予告 → 大なぎ（全体。守る））
//     決勝   記録院付きの闘士ザクロ（律儀に「構えな」と言う予告 → 居合の一閃（全体。守る）。半分を切ると二本目の刀（本気））
//   炎の番犬 tr_b_hellhound（火山 1 階の中ボス）: 二つの頭が息を吸う予告 → 業火の雄たけび（全体。守る）。水に弱い。
//   溶岩の巨獣 tr_b_lavabeast（地方ボス）: 背の火口がふくれる予告 → 大噴火（全体。守る）。半分で溶岩が冷えて黒い岩に（今の第 2 の姿）。
//   記録院の写し手 tr_ash_copyists（八百長を受けたときだけ、火山 1 階の壁画の前で）。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const L = R.DB.monsters;

  // ------------------------------------------------------------ 雑魚の形の相手（1 回戦・2 回戦のお供・写し手）
  const MOBS = {
    ash_youth: {
      name: R.T('data.bosses_ash.MOBS.ash_youth.name'), sprite: 'ash_youth', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.25, atk: 0.95, agi: 1.05 }, elem: { fire: 0.75, water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }, { id: 'e_focus', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_youth.desc'),
    },
    ash_pup: {
      name: R.T('data.bosses_ash.MOBS.ash_pup.name'), sprite: 'salamander_1', size: 's', lv: 8, race: 'beast', affinity: 'fire', flags: [],
      s: { hp: 0.9, atk: 0.9 }, elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_pup.desc'),
    },
    ash_copyist: {
      name: R.T('data.bosses_ash.MOBS.ash_copyist.name'), sprite: 'scribe_1', size: 'm', lv: 8, race: 'humanoid', affinity: 'light', flags: [],
      s: { hp: 1.1, atk: 0.8, mag: 1.0 }, elem: { light: 0.5, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_ink', w: 2 }, { id: 'e_transcribe', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: R.T('data.bosses_ash.MOBS.ash_copyist.desc'),
    },
  };
  for (const id in MOBS) L[id] = MOBS[id];

  // ------------------------------------------------------------ 大会の相手とザクロ（ボスの形）
  const LIST = {
    b_rockbeast: {
      name: R.T('data.bosses_ash.LIST.b_rockbeast.name'), sprite: 'golem_1', artKind: 'mon', bossType: 'add', addOf: 'b_tamer', lv: 8, hpShare: 4, actsPerTurn: 1, size: 'l',
      race: 'beast', affinity: 'earth', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { sleep: 0.5 },
      actions: A([['attack', 3], ['e_crush', 2]]),
      drops: {},
      desc: R.T('data.bosses_ash.LIST.b_rockbeast.desc'),
    },
    b_tamer: {
      name: R.T('data.bosses_ash.LIST.b_tamer.name'), sprite: 'b_ash_tamer', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: {}, phys: {}, statusRes: {},
      // 2026-10-01（ボスの組み直し）: 口笛（予告）→ 突進 の決まりはやめた。鞭・投げ縄（後列をまひ）・けしかけ（獣の攻めを上げる）と、岩の獣との合体技「鞭と突進」
      actions: A([['attack', 2], ['eb_tamer_whip', 3], ['eb_tamer_snare', 2], ['e_howl', 1]]),
      leader: { msg: R.T('data.bosses_ash.LIST.b_tamer.leader.msg') },
      drops: MID('i_potion'),
      desc: R.T('data.bosses_ash.LIST.b_tamer.desc'),
    },
    b_sister_elder: {
      name: R.T('data.bosses_ash.LIST.b_sister_elder.name'), sprite: 'b_ash_hinoe', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: A([['e_fire_bolt', 2], ['eb_hinoe_mend', 2], ['e_veil_ally', 1], ['eb_hinoe_raise', SCHED, { allyDown: true }]]),   // 2026-10-01: 守りの火（加護）を足した
      leader: { msg: R.T('data.bosses_ash.LIST.b_sister_elder.leader.msg') },
      drops: MID('i_ether'),
      desc: R.T('data.bosses_ash.LIST.b_sister_elder.desc'),
    },
    b_sister_younger: {
      name: R.T('data.bosses_ash.LIST.b_sister_younger.name'), sprite: 'b_ash_sumi', bossType: 'add', addOf: 'b_sister_elder', lv: 8, hpShare: 5, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      // 2026-10-01（ボスの組み直し）: 詠唱（予告）→ 火柱 の決まりはやめた。火の玉・火の雨・火の粉（やけど）と、姉と合わせる合体技「姉妹の連なる火」
      actions: A([['e_fire_bolt', 3], ['e_fire_rain', 2], ['eb_sumi_ember', 2]]),
      drops: {},
      desc: R.T('data.bosses_ash.LIST.b_sister_younger.desc'),
    },
    b_armorman: {
      name: R.T('data.bosses_ash.LIST.b_armorman.name'), sprite: 'b_ash_barga', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.25 }, phys: { slash: 0.6, pierce: 0.75, blunt: 1.4 }, statusRes: { stun: 0.5 },
      // 2026-10-01（ボスの組み直し）: 振りかぶる（予告）→ 大なぎ の決まりはやめた。鎧砕き（守りを下げる）・盾打ち（気絶）・固くなる・返しの構え（打ちこむと殴り返す）
      actions: A([['attack', 2], ['e_armor_break', 2], ['eb_barga_bash', 2], ['e_harden', 1, { once: true }], ['e_focus', 1, { hpBelow: 0.6, once: true }], ['eb_barga_counter', 1]]),
      drops: MID('i_potion'),
      desc: R.T('data.bosses_ash.LIST.b_armorman.desc'),
    },
    b_zakuro: {
      name: R.T('data.bosses_ash.LIST.b_zakuro.name'), sprite: 'b_ash_zakuro', bossType: 'mid', lv: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 10, elem: {}, phys: {}, statusRes: { sleep: 0.5, confuse: 0.5 },
      // 2026-10-01（ボスの組み直し）: 居合の構え（予告）→ 一閃 の決まりはやめた。斬りつけ・居合（回復役をねらう）・払い（前列、素早さを下げる）・
      //   後の先（打ちこむと斬り返す）。半分を切ると二本目の刀を抜き、1 ラウンドに 2 回動く
      actions: A([['attack', 2], ['eb_zakuro_cut', 3], ['eb_zakuro_iai', 1, { round: 2 }], ['eb_zakuro_sweep', 2], ['eb_zakuro_guard', 1], ['eb_zakuro_draw', SCHED, { hpBelow: 0.5, once: true }]]),
      phases: [{ hpBelow: 0.5, msg: R.T('data.bosses_ash.LIST.b_zakuro.phases.0.msg'), set: { buffs: { agi: 1 }, actsPerTurn: 2 } }],
      drops: MID('i_ether'),
      desc: R.T('data.bosses_ash.LIST.b_zakuro.desc'),
    },
  };
  for (const id in LIST) L[id] = LIST[id];

  // ------------------------------------------------------------ 行動（予告 → 次の手番の大技。E18）
  Object.assign(R.DB.bossActions, {
    eb_tamer_whip: { name: R.T('bossActions.eb_tamer_whip.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'slash' }], fx: 'slash', msg: R.T('bossActions.eb_tamer_whip.msg') },
    eb_tamer_whistle: { name: R.T('bossActions.eb_tamer_whistle.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_tamer_whistle.msg'),
      telegraph: { text: R.T('bossActions.eb_tamer_whistle.telegraph.text'), pose: 'tele', tint: '#e8c890', next: 'eb_rock_charge', guard: 'defend', lethal: true } },
    eb_rock_charge: { name: R.T('bossActions.eb_rock_charge.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt' }], fx: 'strike3', msg: R.T('bossActions.eb_rock_charge.msg') },
    eb_hinoe_mend: { name: R.T('bossActions.eb_hinoe_mend.name'), kind: 'enemy', target: 'ally', effects: [{ type: 'heal', pct: 0.3 }], fx: 'heal', msg: R.T('bossActions.eb_hinoe_mend.msg') },
    eb_hinoe_raise: { name: R.T('bossActions.eb_hinoe_raise.name'), kind: 'enemy', target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', msg: R.T('bossActions.eb_hinoe_raise.msg') },
    eb_sumi_chant: { name: R.T('bossActions.eb_sumi_chant.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_sumi_chant.msg'),
      telegraph: { text: R.T('bossActions.eb_sumi_chant.telegraph.text'), pose: 'tele', tint: '#ffb070', next: 'eb_sumi_pillar', guard: 'defend', lethal: true } },
    eb_sumi_pillar: { name: R.T('bossActions.eb_sumi_pillar.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'fire3', msg: R.T('bossActions.eb_sumi_pillar.msg') },
    eb_barga_raise: { name: R.T('bossActions.eb_barga_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_barga_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_barga_raise.telegraph.text'), pose: 'tele', tint: '#d0d0d8', next: 'eb_barga_sweep', guard: 'defend', lethal: true } },
    eb_barga_sweep: { name: R.T('bossActions.eb_barga_sweep.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: R.T('bossActions.eb_barga_sweep.msg') },
    eb_zakuro_cut: { name: R.T('bossActions.eb_zakuro_cut.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash' }], fx: 'slash2', msg: R.T('bossActions.eb_zakuro_cut.msg') },
    eb_zakuro_stance: { name: R.T('bossActions.eb_zakuro_stance.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_zakuro_stance.msg'),
      telegraph: { text: R.T('bossActions.eb_zakuro_stance.telegraph.text'), pose: 'tele', tint: '#e0e8ff', next: 'eb_zakuro_flash', guard: 'defend', lethal: true } },
    eb_zakuro_flash: { name: R.T('bossActions.eb_zakuro_flash.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.95, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: R.T('bossActions.eb_zakuro_flash.msg') },
    eb_tamer_snare: { name: R.T('bossActions.eb_tamer_snare.name'), kind: 'enemy', target: 'enemy', aim: 'back', effects: [{ type: 'damage', formula: 'phys', power: 0.6 }, { type: 'status', status: 'paralyze', chance: 0.4 }], fx: 'strike', msg: R.T('bossActions.eb_tamer_snare.msg') },
    eb_sumi_ember: { name: R.T('bossActions.eb_sumi_ember.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 0.35, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.35 }], fx: 'fire', msg: R.T('bossActions.eb_sumi_ember.msg') },
    eb_barga_bash: { name: R.T('bossActions.eb_barga_bash.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.2, kind: 'blunt' }, { type: 'status', status: 'stun', chance: 0.3 }], fx: 'strike2', msg: R.T('bossActions.eb_barga_bash.msg') },
    eb_zakuro_iai: { name: R.T('bossActions.eb_zakuro_iai.name'), kind: 'enemy', target: 'enemy', aim: 'healer', effects: [{ type: 'damage', formula: 'phys', power: 1.6, kind: 'slash', critBonus: 15 }], fx: 'slash3', msg: R.T('bossActions.eb_zakuro_iai.msg') },
    eb_zakuro_sweep: { name: R.T('bossActions.eb_zakuro_sweep.name'), kind: 'enemy', target: 'front', effects: [{ type: 'damage', formula: 'phys', power: 0.9, kind: 'slash' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.4 }], fx: 'slash2', msg: R.T('bossActions.eb_zakuro_sweep.msg') },
    eb_hound_scorch: { name: R.T('bossActions.eb_hound_scorch.name'), kind: 'enemy', target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.1, element: 'fire' }, { type: 'status', status: 'burn', chance: 0.5 }], fx: 'bite2', msg: R.T('bossActions.eb_hound_scorch.msg') },
    eb_beast_scorch_ground: { name: R.T('bossActions.eb_beast_scorch_ground.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'burn', chance: 0.45 }, { type: 'special', id: 'boss_field', flag: 'scorched', msg: R.T('bossActions.eb_beast_scorch_ground.field') }, { type: 'buff', stat: 'atk', stages: 1, on: 'self' }], fx: 'fire3', msg: R.T('bossActions.eb_beast_scorch_ground.msg') },
    eb_barga_counter: { name: R.T('bossActions.eb_barga_counter.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 1.0 }], fx: 'buff', msg: R.T('bossActions.eb_barga_counter.msg') },
    eb_zakuro_guard: { name: R.T('bossActions.eb_zakuro_guard.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 1.1 }], fx: 'buff', msg: R.T('bossActions.eb_zakuro_guard.msg') },
    eb_zakuro_draw: { name: R.T('bossActions.eb_zakuro_draw.name'), kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: R.T('bossActions.eb_zakuro_draw.msg') },
    eb_hound_inhale: { name: R.T('bossActions.eb_hound_inhale.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_hound_inhale.msg'),
      telegraph: { text: R.T('bossActions.eb_hound_inhale.telegraph.text'), pose: 'tele', tint: '#ffa060', next: 'eb_hound_inferno', guard: 'defend', lethal: true } },
    eb_hound_inferno: { name: R.T('bossActions.eb_hound_inferno.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'breath_fire', msg: R.T('bossActions.eb_hound_inferno.msg') },
    eb_beast_swell: { name: R.T('bossActions.eb_beast_swell.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_beast_swell.msg'),
      telegraph: { text: R.T('bossActions.eb_beast_swell.telegraph.text'), pose: 'tele', tint: '#ff9050', next: 'eb_beast_eruption', guard: 'defend', lethal: true } },
    eb_beast_eruption: { name: R.T('bossActions.eb_beast_eruption.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'explosion2', msg: R.T('bossActions.eb_beast_eruption.msg') },
  });

  // ------------------------------------------------------------ 炎の番犬・溶岩の巨獣（bosses.js の形に予告を足す）
  const H = L.b_hellhound;
  if (H) {
    // 2026-10-01（ボスの組み直し）: 二つの頭で 1 ラウンドに 2 回（重い手: ふたつ牙・溶岩の息・焦がし咬み（弱った人、やけど） ＋ 軽い手: 炎の遠吠え（やけど）・怒り）。
    //   前は 2 ラウンドごとに必ず 息を吸う（予告）→ 業火。溜めはやめた
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    H.actions = A([['eb_twin_fang', 3, HV], ['eb_lava_breath', 2, HV], ['eb_hound_scorch', 2, HV],
      ['attack', 2, LT], ['eb_flame_howl', 2, LT], ['eb_hound_fury', 3, { every: [2, 1], hpBelow: 0.5, once: true }]]);
    H.desc = R.T('data.bosses_ash.desc');
    H.s = { hp: 0.95, atk: 0.4, mag: 0.4 };
  }
  const B = L.b_lavabeast;
  if (B) {
    // 2026-10-01（ボスの組み直し）: 1 ラウンドに重い手 1 つ＋軽い手 1 つ。燃えている間（HP 半分まで）は マグマの拳・溶岩の波／噴火（ばらまき）、
    //   冷えて黒い岩になってから は 黒曜の一撃・灰の嵐（目つぶし）。灼熱の大地（全員やけど・自分の攻めが上がる）は 1 戦に 1 度。
    //   前は 2 ラウンドごとに必ず 火口がふくれる（予告）→ 大噴火。溜めはやめた
    const BH = { every: [2, 0] }, BL = { every: [2, 1] };
    B.actions = A([['eb_magma_fist', 3, { every: [2, 0], hpAbove: 0.5 }], ['eb_lava_wave', 2, { every: [2, 0], hpAbove: 0.5 }], ['attack', 1, BH],
      ['eb_obsidian_crush', 3, { every: [2, 0], hpBelow: 0.5 }], ['eb_ash_storm', 2, { every: [2, 0], hpBelow: 0.5 }],
      ['eb_eruption', 2, { every: [2, 1], hpAbove: 0.5 }], ['attack', 1, BL], ['eb_ash_storm', 1, { every: [2, 1], hpBelow: 0.5 }],
      ['eb_beast_scorch_ground', 2, { every: [2, 1], noFlag: 'scorched' }]]);
    B.desc = R.T('data.bosses_ash.desc_2');
    B.s = { hp: 0.5, atk: 0.58, mag: 0.58 };   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
    // 第 2 の姿の絵（冷えた黒い岩）は無いので、同じ絵のまま（b_lavabeast_cold の絵は描いていない）
    for (const p of B.phases || []) if (p.set && p.set.sprite && !(typeof window !== 'undefined' && window.RPG_MEDIA && window.RPG_MEDIA.monsters && window.RPG_MEDIA.monsters[p.set.sprite])) delete p.set.sprite;
  }
  for (const id of ['b_tamer', 'b_rockbeast']) if (L[id]) L[id].s = { hp: 0.9, atk: 0.55, mag: 0.55 };
  for (const id of ['b_sister_elder', 'b_sister_younger']) if (L[id]) L[id].s = { hp: 0.8, atk: 0.55, mag: 0.55 };
  if (L.b_armorman) L.b_armorman.s = { hp: 1.3, atk: 0.55, mag: 0.55, def: 1.4 };
  if (L.b_zakuro) L.b_zakuro.s = { hp: 1.4, atk: 0.6, mag: 0.6 };
  // ---------------------------------------------------------------- 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
  R.defs('enemyCombos', {
    // 鞭と突進: 獣使いが鞭で 1 人を打ち、岩の獣が同じ人へ突っこむ
    c_b_tamer_charge: { name: R.T('enemyCombos.c_b_tamer_charge.name'), members: [{ mon: 'b_tamer' }, { mon: 'b_rockbeast' }],
      steps: [{ by: 0, act: 'eb_tamer_whip' }, { by: 1, act: 'e_crush', same: true, seq: 'sq:ec_brute_smash' }], round: 2, chance: 0.35, cd: 3 },
    // 姉妹の連なる火: 妹の火の玉が弱った人を焼き、姉が同じ人へ重ねる
    c_b_sister_flames: { name: R.T('enemyCombos.c_b_sister_flames.name'), members: [{ mon: 'b_sister_elder' }, { mon: 'b_sister_younger' }],
      steps: [{ by: 1, act: 'e_fire_bolt', aim: 'low' }, { by: 0, act: 'e_fire_bolt', same: true, seq: 'sq:s_fire_wind_b' }], round: 2, chance: 0.35, cd: 3 },
  });
})(window.RPG);
