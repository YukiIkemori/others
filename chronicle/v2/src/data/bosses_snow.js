// 雪原のボス（BATTLE の形。WORLD_REDESIGN §4.3・§4.10・E18、STORY_BIBLE §7.3）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   吹雪の大狼 b_blizzardwolf（籠城の 3 波目。新規）: 遠吠え → 次の手番に全体の吹雪の牙（守る）。守らなかった門の数だけ援軍（_1・_2 の変化形）。
//       頭が倒れると群れは散る（leader）。絵は狼の群れ頭の大きい灰色狼（hd:boss:boss_wolflord）。籠城の山場なので盗み専用の品は持たない（§4.11）。
//   氷壁の巨人 b_icegiant（峰の中ボス）: 体が白く光る（予告）→ 次の手番に氷の鎧（守り +2）。光っている間に火で打つと張れない（cancel）。
//       鎧を張った後も、火で打てば砕けて守りが −2 に落ちる（melt。battle_core の雪原の口）。物理はそこでよく効く。
//   白竜ネーヴェ b_whitedragon（地方ボス。戦う道のとき）: 深く息を吸う（予告）→ 次の手番に全体の大吹雪（守る・水の耐性）。
//       HP が半分を切ると、祭で語った昔話の一節を思い出して 1 手番止まる（祭のご褒美、§4.10）。第 2 の姿は hd:boss:boss_whitedragon@p2。
//   氷の船団長 b_frost_admiral（隠しボス、#13 氷に閉じた帆船。強さ固定）: 号令（予告）→ 氷の砲撃（全体）、手下の水兵を呼ぶ、凍てつく旗。
(function (R) {
  'use strict';
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const L = R.DB.monsters;

  // ---------------------------------------------------------------- 行動
  Object.assign(R.DB.bossActions, {
    // 吹雪の大狼
    eb_bw_howl: { name: R.T('bossActions.eb_bw_howl.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_bw_howl.msg'),
      telegraph: { text: R.T('bossActions.eb_bw_howl.telegraph.text'), pose: 'tele', tint: '#d8e4ff', next: 'eb_bw_storm', guard: 'defend' } },
    eb_bw_storm: { name: R.T('bossActions.eb_bw_storm.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 6.0, element: 'water', sure: true }, { type: 'status', status: 'freeze', chance: 0.1 }], fx: 'breath_ice', msg: R.T('bossActions.eb_bw_storm.msg') },
    eb_bw_bite: { name: R.T('bossActions.eb_bw_bite.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.35 }], fx: 'bite2', msg: R.T('bossActions.eb_bw_bite.msg') },
    eb_bw_call_0: { name: R.T('bossActions.eb_bw_call_0.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_siegewolf', n: 1, max: 3 }], fx: 'song', msg: R.T('bossActions.eb_bw_call_0.msg') },
    eb_bw_call_1: { name: R.T('bossActions.eb_bw_call_1.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_siegewolf', n: 1, max: 4 }], fx: 'song', msg: R.T('bossActions.eb_bw_call_1.msg') },
    eb_bw_call_2: { name: R.T('bossActions.eb_bw_call_2.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_siegewolf', n: 2, max: 5 }], fx: 'song', msg: R.T('bossActions.eb_bw_call_2.msg') },
    // 氷壁の巨人
    eb_frost_glow: { name: R.T('bossActions.eb_frost_glow.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_frost_glow.msg'),
      telegraph: { text: R.T('bossActions.eb_frost_glow.telegraph.text'), pose: 'tele', tint: '#e8f4ff', next: 'eb_ice_armor', guard: 'element:fire',
        cancel: { element: 'fire', msg: R.T('bossActions.eb_frost_glow.telegraph.cancel.msg') } } },
    eb_ice_armor: { name: R.T('bossActions.eb_ice_armor.name'), kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'def', stages: 4 }, { type: 'buff', stat: 'mdef', stages: 2 }, { type: 'buff', stat: 'atk', stages: 2 }, { type: 'heal', pct: 0.25 }, { type: 'status', status: 'regen' }], fx: 'buff', msg: R.T('bossActions.eb_ice_armor.msg') },
    // 白竜ネーヴェ
    eb_dragon_inhale: { name: R.T('bossActions.eb_dragon_inhale.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_dragon_inhale.msg'),
      telegraph: { text: R.T('bossActions.eb_dragon_inhale.telegraph.text'), pose: 'tele', tint: '#dff0ff', next: 'eb_dragon_whiteout', guard: 'defend' } },
    eb_dragon_whiteout: { name: R.T('bossActions.eb_dragon_whiteout.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'breath', power: 2.0, element: 'water', sure: true }, { type: 'status', status: 'freeze', chance: 0.2 }], fx: 'breath_ice', msg: R.T('bossActions.eb_dragon_whiteout.msg') },
    eb_dragon_remember: { name: R.T('bossActions.eb_dragon_remember.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_dragon_remember.msg') },
    // 氷の船団長
    eb_admiral_order: { name: R.T('bossActions.eb_admiral_order.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_admiral_order.msg'),
      telegraph: { text: R.T('bossActions.eb_admiral_order.telegraph.text'), pose: 'tele', tint: '#c8e0ff', next: 'eb_admiral_cannon', guard: 'defend' } },
    eb_admiral_cannon: { name: R.T('bossActions.eb_admiral_cannon.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 2.0, element: 'water', sure: true }], fx: 'ice3', msg: R.T('bossActions.eb_admiral_cannon.msg') },
    eb_admiral_crew: { name: R.T('bossActions.eb_admiral_crew.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_frost_sailor', n: 2, max: 4 }], fx: 'magic', msg: R.T('bossActions.eb_admiral_crew.msg') },
    eb_admiral_flag: { name: R.T('bossActions.eb_admiral_flag.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'buff', stat: 'agi', stages: -1, chance: 0.6 }, { type: 'status', status: 'freeze', chance: 0.2 }], fx: 'debuff', msg: R.T('bossActions.eb_admiral_flag.msg') },
    eb_admiral_slash: { name: R.T('bossActions.eb_admiral_slash.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, element: 'water', hits: 2 }], fx: 'slash2', msg: R.T('bossActions.eb_admiral_slash.msg') },
    // 2026-10-01（ボスの組み直し）: 決まった順の「予告 → 大技」をやめて、手の幅を足す
    eb_bw_frostfang: { name: R.T('bossActions.eb_bw_frostfang.name'), kind: 'enemy', target: 'enemy', aim: 'low', effects: [{ type: 'damage', formula: 'phys', power: 1.15, element: 'water' }, { type: 'status', status: 'freeze', chance: 0.15 }], fx: 'bite2', msg: R.T('bossActions.eb_bw_frostfang.msg') },
    eb_giant_grab: { name: R.T('bossActions.eb_giant_grab.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.2, element: 'water' }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }], fx: 'ice2', msg: R.T('bossActions.eb_giant_grab.msg') },
    eb_bw_snowveil: { name: R.T('bossActions.eb_bw_snowveil.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'blind', chance: 0.35 }, { type: 'special', id: 'boss_field', flag: 'snowveil', msg: R.T('bossActions.eb_bw_snowveil.field') }, { type: 'status', status: 'nimble', on: 'self' }], fx: 'breath_ice', msg: R.T('bossActions.eb_bw_snowveil.msg') },
    eb_bw_chill_howl: { name: R.T('bossActions.eb_bw_chill_howl.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'buff', stat: 'agi', stages: -1, chance: 0.6 }, { type: 'buff', stat: 'def', stages: -1, chance: 0.4 }], fx: 'song', msg: R.T('bossActions.eb_bw_chill_howl.msg') },
    eb_giant_armor: { name: R.T('bossActions.eb_giant_armor.name'), kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'def', stages: 2 }, { type: 'status', status: 'regen' }], fx: 'buff', msg: R.T('bossActions.eb_giant_armor.msg') },
    eb_giant_stomp: { name: R.T('bossActions.eb_giant_stomp.name'), kind: 'enemy', target: 'front', effects: [{ type: 'damage', formula: 'phys', power: 1.0, element: 'earth' }, { type: 'status', status: 'stun', chance: 0.2 }], fx: 'earth2', msg: R.T('bossActions.eb_giant_stomp.msg') },
    eb_admiral_fog: { name: R.T('bossActions.eb_admiral_fog.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'freeze', chance: 0.2 }, { type: 'buff', stat: 'agi', stages: -1, chance: 0.5 }, { type: 'special', id: 'boss_field', flag: 'ice_fog', msg: R.T('bossActions.eb_admiral_fog.field') }], fx: 'breath_ice', msg: R.T('bossActions.eb_admiral_fog.msg') },
    eb_admiral_parry: { name: R.T('bossActions.eb_admiral_parry.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 0.9 }], fx: 'buff', msg: R.T('bossActions.eb_admiral_parry.msg') },
  });

  // ---------------------------------------------------------------- ボス
  const def = (id, d) => { L[id] = d; R.DB.bosses[id] = d; };
  const base = {
    name: R.T('data.bosses_snow.base.name'), sprite: 'boss_wolflord', bossType: 'mid', lv: 9, actsPerTurn: 1, size: 'l',
    race: 'beast', affinity: 'water', flags: ['boss'], eva: 10,
    elem: { fire: 1.25, water: 0.25, earth: 1.25 }, phys: {}, statusRes: { sleep: 0.25, freeze: 1 },
    s: { hp: 1.6, atk: 1.4, mag: 1.4 },   // 2026-10-01（組み直し）: hp 1.15 → 1.6・atk 0.9 → 1.4（毎手番攻める型。sim_bosses の台本 90%・8 ラウンド）
    leader: { msg: R.T('data.bosses_snow.base.leader.msg') },
    drops: MID('i_ether'),
    desc: R.T('data.bosses_snow.base.desc'),
  };
  // 2026-10-01（ボスの組み直し、オーナー「溜めての即死級はもう飽きた」）: 前は 呼ぶ → 遠吠え（予告）→ 吹雪の牙（守らないと倒れる）の 3 手番の決まった繰り返し。
  //   いまは溜めなし: 噛みつく・凍て牙（弱った人へ、凍結）・雪けむり（目つぶし、身軽になる）・凍える遠吠え（素早さと守りを下げる）・群れが減ったら手下を呼ぶ
  const bwActs = (call) => A([['attack', 1], ['eb_bw_bite', 3], ['eb_bw_frostfang', 3], ['eb_bw_snowveil', 1, { noFlag: 'snowveil' }], ['eb_bw_chill_howl', 1, { round: 2 }]]
    .concat(call ? [[call, 2, { countBelow: call === 'eb_bw_call_2' ? 5 : call === 'eb_bw_call_1' ? 4 : 3 }]] : []));
  def('b_blizzardwolf', Object.assign({}, base, { actions: bwActs('eb_bw_call_0') }));
  def('b_blizzardwolf_1', Object.assign({}, base, { actions: bwActs('eb_bw_call_1') }));
  def('b_blizzardwolf_2', Object.assign({}, base, { actions: bwActs('eb_bw_call_2') }));
  def('b_siegewolf', {
    name: R.T('data.bosses_snow.b_siegewolf.name'), sprite: 'wolf_1', artKind: 'mon', bossType: 'add', addOf: 'b_blizzardwolf', lv: 9, hpShare: 3, actsPerTurn: 1, size: 's',
    race: 'beast', flags: ['boss'], eva: 10, elem: { water: 0.25, earth: 1.25 }, phys: {}, statusRes: {},
    actions: A([['attack', 3], ['e_bite', 1]]), s: { hp: 0.8, atk: 0.4, mag: 0.4 }, drops: {},
    desc: R.T('data.bosses_snow.b_siegewolf.desc'),
  });

  // 氷壁の巨人（今の数値と行動に予告と融ける氷を足す）
  const G = L.b_icegiant;
  if (G) {
    // 2026-10-01（ボスの組み直し）: 前は 2 手番ごとに 光る（予告）→ 氷の鎧 の繰り返しで、ダメージのある手番が 2〜3 割しかなかった。
    //   いまは溜めなし: 大槌・氷の手（素早さを下げる）・踏みつけ（前列、気絶）・雪崩落とし・凍える息（凍結）。HP 8 割を切ると氷の鎧を張る（守り +2・再生。火で打つと割れて守り −2 は前のまま）
    G.actions = A([['attack', 1], ['eb_ice_hammer', 3], ['eb_giant_grab', 2], ['eb_giant_stomp', 2], ['eb_avalanche_drop', 2], ['eb_frost_exhale', 1], ['eb_giant_armor', 2, { hpBelow: 0.8 }]]);
    G.melt = { element: 'fire', to: -2, clear: 'regen', reset: ['atk'], msg: R.T('data.bosses_snow.melt.msg') };
    G.s = { hp: 1.0, atk: 2.7, mag: 2.7 };   // 2026-10-01（組み直し）: atk 1.6 → 2.7（前は 2 手番に 1 度しか攻めなかった。中ボスの目安 台本 85〜95%・7 ラウンド）
    G.desc = R.T('data.bosses_snow.desc');
  }
  // 白竜ネーヴェ（予告の大吹雪・昔話の一節）
  const D = L.b_whitedragon;
  if (D) {
    D.s = { hp: 1.0, atk: 0.7, mag: 0.7 };   // 2026-10-01（組み直し）: 毎ラウンド 2 回とも攻める型に。atk 0.6 → 0.7（台本 90〜96%・11 ラウンド）
    // 2026-10-01（ボスの組み直し）: 1 ラウンドに 2 回（重い手 1 つ＋軽い手 1 つ）。前は 2 ラウンドごとに必ず 予告 → 大吹雪 だった。
    //   HP 6 割で氷の壁、半分で氷河落とし・思い出す間（祭のご褒美）は前のまま
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    //   （2026-10-01 オーナー「溜めはいらない」: 息を吸う予告 → 大吹雪 はやめた。白い吹雪（凍結）・凍てつく咆哮（素早さ）・氷の壁は軽い手に）
    D.actions = A([['eb_ice_claw', 3, HV], ['eb_dragon_tail', 2, HV], ['attack', 1, HV], ['eb_glacier_fall', 3, { every: [2, 0], hpBelow: 0.5 }],
      ['attack', 1, LT], ['eb_white_blizzard', 3, LT], ['eb_frozen_roar', 1, LT], ['eb_ice_wall', 3, { every: [2, 1], hpBelow: 0.6, once: true }],
      ['eb_dragon_remember', 400, { hpBelow: 0.5, once: true }]]);
  }

  // 氷の船団長（隠しボス。強さ固定）と凍った水兵
  def('b_frost_admiral', {
    name: R.T('data.bosses_snow.b_frost_admiral.name'), sprite: 'frostling_5', artKind: 'mon', bossType: 'fmid', lv: 9, actsPerTurn: 2, size: 'l',
    race: 'undead', affinity: 'water', flags: ['boss'], eva: 10,
    elem: { water: 0, earth: 1.25, light: 1.25 }, phys: {}, statusRes: { death: 1, freeze: 1, sleep: 0.5 },
    // 2026-10-01（ボスの組み直し）: 重い手（二段斬り・氷の砲撃）＋軽い手（凍てつく旗・氷霧・受け流しの構え・水兵を呼ぶ）。前は 3 手番ごとに必ず号令（予告）→ 砲撃。溜めはやめた
    actions: A([['eb_admiral_slash', 3, { every: [2, 0] }], ['eb_admiral_cannon', 1, { every: [2, 0], round: 2 }], ['attack', 1, { every: [2, 0] }],
      ['eb_admiral_flag', 2, { every: [2, 1] }], ['eb_admiral_fog', 1, { every: [2, 1], noFlag: 'ice_fog' }], ['eb_admiral_parry', 1, { every: [2, 1] }],
      ['eb_admiral_crew', 2, { every: [2, 1], countBelow: 3 }], ['attack', 1, { every: [2, 1] }]]),
    phases: [{ hpBelow: 0.4, msg: R.T('data.bosses_snow.b_frost_admiral.phases.0.msg'), set: { buffs: { atk: 1 } } }],
    s: { hp: 0.5, atk: 0.7, mag: 0.7 },   // 2026-10-01（組み直し）: hp 0.6 → 0.5・atk 0.5 → 0.7（台本 90%・12 ラウンド）
    drops: { normal: { pool: 'p_boss', rate: 1 }, bonus: { pool: 'p_heal', rate: 1 } },   // 確定の 2 つ目: 終盤の前は癒やしの水（pools.js p_heal）
    desc: R.T('data.bosses_snow.b_frost_admiral.desc'),
  });
  def('b_frost_sailor', {
    name: R.T('data.bosses_snow.b_frost_sailor.name'), sprite: 'frostling_4', artKind: 'mon', bossType: 'add', addOf: 'b_frost_admiral', lv: 9, hpShare: 3, actsPerTurn: 1, size: 's',
    race: 'undead', flags: ['boss'], eva: 5, elem: { water: 0, earth: 1.25 }, phys: {}, statusRes: { death: 1 },
    actions: A([['attack', 3], ['e_icicle', 1]]), s: { atk: 0.6, mag: 0.6 }, drops: {},
    desc: R.T('data.bosses_snow.b_frost_sailor.desc'),
  });
  // ---------------------------------------------------------------- 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
  R.defs('enemyCombos', {
    // 群れの挟み撃ち: 手下の狼が弱った人へ飛びかかり、大狼が同じ人へ凍て牙
    c_b_siege_hunt: { name: R.T('enemyCombos.c_b_siege_hunt.name'), members: [{ mon: ['b_blizzardwolf', 'b_blizzardwolf_1', 'b_blizzardwolf_2'] }, { mon: 'b_siegewolf' }],
      steps: [{ by: 1, act: 'ec_pack_fang', aim: 'low', seq: 'sq:ec_pack_fang' }, { by: 0, act: 'eb_bw_frostfang', same: true, seq: 'sq:ec_ice_fang' }], round: 2, chance: 0.35, cd: 3 },
    // 氷の一斉射: 水兵 2 人がつららを放ち、船団長が弱った人へ二段斬り
    c_b_admiral_volley: { name: R.T('enemyCombos.c_b_admiral_volley.name'), members: [{ mon: 'b_frost_admiral' }, { mon: 'b_frost_sailor', n: 2 }],
      steps: [{ by: 1, act: 'e_icicle' }, { by: 2, act: 'e_icicle' }, { by: 0, act: 'eb_admiral_slash', aim: 'low', seq: 'sq:ec_cross_slash' }], round: 2, chance: 0.35, cd: 3 },
  });
})(window.RPG);
