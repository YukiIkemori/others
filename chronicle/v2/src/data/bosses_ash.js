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
      name: '一族の若者', sprite: 'ash_youth', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.25, atk: 0.95, agi: 1.05 }, elem: { fire: 0.75, water: 1.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }, { id: 'e_focus', w: 1 }],
      drops: { normal: { item: 'i_salve', rate: 8 } },
      desc: '炎の試練に出る一族の若者。\n四人で組んで、数で押してくる。',
    },
    ash_pup: {
      name: '火トカゲの子', sprite: 'salamander_1', size: 's', lv: 8, race: 'beast', affinity: 'fire', flags: [],
      s: { hp: 0.9, atk: 0.9 }, elem: { fire: 0.25, water: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_fire_bite', w: 2 }],
      drops: { normal: { item: 'i_stone_fire', rate: 8 } },
      desc: '獣使いのガロが育てた火トカゲ。\nかみつくと、やけどをする。',
    },
    ash_copyist: {
      name: '記録院の写し手', sprite: 'scribe_1', size: 'm', lv: 8, race: 'humanoid', affinity: 'light', flags: [],
      s: { hp: 1.1, atk: 0.8, mag: 1.0 }, elem: { light: 0.5, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_ink', w: 2 }, { id: 'e_transcribe', w: 1 }],
      drops: { normal: { item: 'i_ether', rate: 8 } },
      desc: '記録院の白衣の写し手。\n壁画を写し取りに来た。',
    },
  };
  for (const id in MOBS) L[id] = MOBS[id];

  // ------------------------------------------------------------ 大会の相手とザクロ（ボスの形）
  const LIST = {
    b_rockbeast: {
      name: '岩の獣', sprite: 'golem_1', artKind: 'mon', bossType: 'add', addOf: 'b_tamer', lv: 8, hpShare: 4, actsPerTurn: 1, size: 'l',
      race: 'beast', affinity: 'earth', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.5, earth: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { sleep: 0.5 },
      actions: A([['attack', 3], ['e_crush', 2]]),
      drops: {},
      desc: '獣使いのガロの相棒。\n岩の皮は硬いが、打てば割れる。',
    },
    b_tamer: {
      name: '獣使いのガロ', sprite: 'b_ash_tamer', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: {}, phys: {}, statusRes: {},
      actions: A([['attack', 2], ['eb_tamer_whip', 2], ['eb_tamer_whistle', SCHED, { every: [3, 1] }], ['e_howl', 1]]),
      leader: { msg: '獣使いのガロが倒れると、\n獣たちはおとなしく座りこんだ！' },
      drops: MID('i_potion'),
      desc: '岩の獣と火トカゲを連れた獣使い。\n口笛を吹いたら、獣の突進が来る。',
    },
    b_sister_elder: {
      name: '術師の姉ヒノエ', sprite: 'b_ash_hinoe', bossType: 'mid', lv: 8, hpShare: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: A([['e_fire_bolt', 2], ['eb_hinoe_mend', 2], ['eb_hinoe_raise', SCHED, { allyDown: true }]]),
      leader: { msg: '姉のヒノエが膝をつくと、\n妹のスミは杖を下ろした。「……参りました」' },
      drops: MID('i_ether'),
      desc: '術師の姉妹の姉。妹を癒やし、\n倒れても起こす。先に姉を。',
    },
    b_sister_younger: {
      name: '術師の妹スミ', sprite: 'b_ash_sumi', bossType: 'add', addOf: 'b_sister_elder', lv: 8, hpShare: 5, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 5, elem: { water: 1.25 }, phys: {}, statusRes: {},
      actions: A([['e_fire_bolt', 3], ['e_fire_rain', 1], ['eb_sumi_chant', SCHED, { every: [4, 0] }]]),
      drops: {},
      desc: '術師の姉妹の妹。長い詠唱のあとに\n火柱が来る。身を固めよ。',
    },
    b_armorman: {
      name: '鉄鎧のバルガ', sprite: 'b_ash_barga', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 0,
      elem: { water: 1.25, wind: 1.25 }, phys: { slash: 0.6, pierce: 0.75, blunt: 1.4 }, statusRes: { stun: 0.5 },
      actions: A([['attack', 3], ['e_armor_break', 1], ['e_harden', 1, { once: true }], ['eb_barga_raise', SCHED, { every: [3, 0] }]]),
      drops: MID('i_potion'),
      desc: '鉄の鎧に身を包んだ大男。\n刃は通りにくいが、打てば響く。',
    },
    b_zakuro: {
      name: 'ザクロ', sprite: 'b_ash_zakuro', bossType: 'mid', lv: 9, actsPerTurn: 1, size: 'm',
      race: 'humanoid', flags: ['boss'], eva: 10, elem: {}, phys: {}, statusRes: { sleep: 0.5, confuse: 0.5 },
      actions: A([['attack', 3], ['eb_zakuro_cut', 2], ['eb_zakuro_stance', SCHED, { every: [3, 1] }], ['eb_zakuro_draw', SCHED, { hpBelow: 0.5, once: true }]]),
      phases: [{ hpBelow: 0.5, msg: 'ザクロは、背の二本目の刀を抜いた。\n「……ここからは、本気で行く」', set: { buffs: { atk: 1, agi: 1 } } }],
      drops: MID('i_ether'),
      desc: '記録院付きの雇われ闘士。律儀で、\n大技の前に「構えな」と言う。',
    },
  };
  for (const id in LIST) L[id] = LIST[id];

  // ------------------------------------------------------------ 行動（予告 → 次の手番の大技。E18）
  Object.assign(R.DB.bossActions, {
    eb_tamer_whip: { name: '獣使いの鞭', kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.3, kind: 'slash' }], fx: 'slash', msg: '{user}は鞭をしならせた！' },
    eb_tamer_whistle: { name: '口笛', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}が、鋭く口笛を吹いた……！',
      telegraph: { text: '岩の獣が、砂をかいて身をかがめた……。', pose: 'tele', tint: '#e8c890', next: 'eb_rock_charge', guard: 'defend', lethal: true } },
    eb_rock_charge: { name: '岩の獣の突進', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt' }], fx: 'strike3', msg: '岩の獣が、砂を蹴って一行へ突っこんだ！' },
    eb_hinoe_mend: { name: '癒やしの火', kind: 'enemy', target: 'ally', effects: [{ type: 'heal', pct: 0.3 }], fx: 'heal', msg: '{user}は、妹の傷に火の粉をかざした。' },
    eb_hinoe_raise: { name: '起きなさい', kind: 'enemy', target: 'ally_dead', effects: [{ type: 'revive', pct: 0.5 }], fx: 'revive', msg: '「スミ、起きなさい！」\n妹が、ふらつきながら立ち上がった！' },
    eb_sumi_chant: { name: '長い詠唱', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は、目を閉じて長い詠唱を始めた……！',
      telegraph: { text: '砂の上に、赤い輪が広がっていく……。', pose: 'tele', tint: '#ffb070', next: 'eb_sumi_pillar', guard: 'defend', lethal: true } },
    eb_sumi_pillar: { name: '火柱', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'fire3', msg: '砂の輪から、火柱が噴き上がった！' },
    eb_barga_raise: { name: '振りかぶる', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は、大斧を大きく振りかぶった……！',
      telegraph: { text: '鉄の鎧が、ぎしりと鳴った……。', pose: 'tele', tint: '#d0d0d8', next: 'eb_barga_sweep', guard: 'defend', lethal: true } },
    eb_barga_sweep: { name: '大なぎ', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: '大斧が、砂ごと一行をなぎ払った！' },
    eb_zakuro_cut: { name: 'けさ斬り', kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash' }], fx: 'slash2', msg: '{user}の刀が、斜めに走った！' },
    eb_zakuro_stance: { name: '居合の構え', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は刀をさやに納め、腰を落とした。\n「……次のは、でかいぞ。構えな」',
      telegraph: { text: 'ザクロの気配が、しんと静まった……。', pose: 'tele', tint: '#e0e8ff', next: 'eb_zakuro_flash', guard: 'defend', lethal: true } },
    eb_zakuro_flash: { name: '一閃', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.95, guardPct: 0.08, kind: 'slash' }], fx: 'slash3', msg: '白い一閃が、砂の上を走り抜けた！' },
    eb_zakuro_draw: { name: '二本目', kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: '{user}は、二本目の刀を抜いた！' },
    eb_hound_inhale: { name: '息を吸う', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}の二つの頭が、深く息を吸いこんだ……！',
      telegraph: { text: '番犬の喉の奥で、溶岩が赤く渦を巻く……。', pose: 'tele', tint: '#ffa060', next: 'eb_hound_inferno', guard: 'defend', lethal: true } },
    eb_hound_inferno: { name: '業火の雄たけび', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'breath_fire', msg: '二つの口から、業火がほとばしった！' },
    eb_beast_swell: { name: '火口がふくれる', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}の背の火口が、赤くふくれ上がった……！',
      telegraph: { text: '火口の底から、地鳴りが近づいてくる……。', pose: 'tele', tint: '#ff9050', next: 'eb_beast_eruption', guard: 'defend', lethal: true } },
    eb_beast_eruption: { name: '大噴火', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'fire', element: 'fire' }], fx: 'explosion2', msg: '巨獣の背が火を噴き、溶岩の雨が降り注いだ！' },
  });

  // ------------------------------------------------------------ 炎の番犬・溶岩の巨獣（bosses.js の形に予告を足す）
  const H = L.b_hellhound;
  if (H) {
    H.actions = A([['attack', 2], ['eb_twin_fang', 2], ['eb_flame_howl', 1], ['eb_lava_breath', 1], ['eb_hound_inhale', SCHED, { every: [4, 1] }],
      ['eb_hound_fury', 1, { hpBelow: 0.5, once: true }]]);
    H.desc = '火口の壁画を守る二つ頭の犬。\n深く息を吸ったら、身を固めよ。';
    H.s = { hp: 0.95, atk: 0.4, mag: 0.4 };
  }
  const B = L.b_lavabeast;
  if (B) {
    B.actions = A([['attack', 2], ['eb_lava_wave', 2, { hpAbove: 0.5 }], ['eb_magma_fist', 2, { hpAbove: 0.5 }], ['eb_beast_swell', SCHED, { every: [4, 1] }],
      ['eb_obsidian_crush', 3, { hpBelow: 0.5 }], ['eb_ash_storm', 2, { hpBelow: 0.5 }]]);
    B.desc = '守り手を失った山の火の獣。\n背の火口がふくれたら、身を固めよ。';
    B.s = { hp: 0.5, atk: 0.36, mag: 0.36 };
    // 第 2 の姿の絵（冷えた黒い岩）は無いので、同じ絵のまま（b_lavabeast_cold の絵は描いていない）
    for (const p of B.phases || []) if (p.set && p.set.sprite && !(typeof window !== 'undefined' && window.RPG_MEDIA && window.RPG_MEDIA.monsters && window.RPG_MEDIA.monsters[p.set.sprite])) delete p.set.sprite;
  }
  for (const id of ['b_tamer', 'b_rockbeast']) if (L[id]) L[id].s = { hp: 0.9, atk: 0.55, mag: 0.55 };
  for (const id of ['b_sister_elder', 'b_sister_younger']) if (L[id]) L[id].s = { hp: 0.8, atk: 0.55, mag: 0.55 };
  if (L.b_armorman) L.b_armorman.s = { hp: 1.3, atk: 0.55, mag: 0.55, def: 1.4 };
  if (L.b_zakuro) L.b_zakuro.s = { hp: 1.4, atk: 0.6, mag: 0.6 };
})(window.RPG);
