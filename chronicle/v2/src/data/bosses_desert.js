// BATTLE（砂漠）: ザハラ砂漠のボスと考えどころ（WORLD_REDESIGN §4.10・§4.11・E18、V2_PLAN §2.6.5）。
//   砂の鷹団の頭 b_hawk_chief（中ボス、野営地 1 で戦う選択とアジトの奥）: 弓兵 b_hawk_bow がいるあいだは「かばわれて」刃も術も
//     ほとんど届かない → 弓兵を先に。弓兵が全員倒れると守りが解ける（special desert_guard_down）。頭の予告「砂を巻き上げる」→ 砂けむりの舞（全体）→ 守る。
//   砂もぐり b_sandworm（中ボス、王墓 2 階）: 身を沈める予告 → 次の手番に 1 人へ食らいつきながら砂にもぐる（刃と打撃はほとんど効かず、突き・土はそのまま）→
//     その次に砂中の一撃（全体）。予告の手番に土で打つと砂が固まって、もぐれない（cancel）。もぐっている間に土で打つと引きずり出す（cancel.special）。
//   名なき砂の王 b_sandking（地方ボス、王墓 3 階の王の間）: 日の玉・月の玉を呼ぶ → 玉がある間、玉と同じ属性（日＝火・光、月＝水・闇）を
//     王が吸う。玉を先に割る（special desert_orb_break）。HP 4 割で包帯がほどけ（第 2 の姿 @p2）、杖を掲げる予告 → 砂の審判（全体）→ 守る。
//     名の文字 3 つ（王の名の記し i_desert_kingname）を持っていれば、第 2 の姿の後に「使う」と名を呼べる（special desert_call_name、戦いが終わる）。
//   数値 s は tools/sim_bosses.js の 3 本立てで合わせる（標準の一行・そのティアの店の品）。
//   新しい行動の効果は BC.specials（battle_core の effect 'special'）。倒れたときの効果は d.onDeath（battle_core の die が呼ぶ）。
(function (R) {
  'use strict';
  const SCHED = 200;
  // 数値（sim_bosses の 3 本立てで合わせる）
  const DS = {
    b_sandking: { hp: 0.52, atk: 0.6, mag: 0.6 },
    b_sandworm: { hp: 1.35 },
  };
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const ALL = (v) => ({ fire: v, water: v, wind: v, earth: v, light: v, dark: v });

  // ------------------------------------------------------------ 雑魚: 砂の鷹団（アジトが敵のとき）
  const MOBS = {
    desert_hawk_blade: {
      name: R.T('data.bosses_desert.MOBS.desert_hawk_blade.name'), sprite: 'desert_hawk_blade', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.35, atk: 1.1, agi: 1.1 }, elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }, { id: 'e_double', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: R.T('data.bosses_desert.MOBS.desert_hawk_blade.desc'),
    },
    desert_hawk_bow: {
      name: R.T('data.bosses_desert.MOBS.desert_hawk_bow.name'), sprite: 'desert_hawk_bow', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.1, atk: 1.05, agi: 1.2 }, elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_arrow', w: 4 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: R.T('data.bosses_desert.MOBS.desert_hawk_bow.desc'),
    },
  };
  for (const id in MOBS) R.DB.monsters[id] = MOBS[id];

  // ------------------------------------------------------------ ボス
  const LIST = {
    b_hawk_chief: {
      name: R.T('data.bosses_desert.LIST.b_hawk_chief.name'), sprite: 'b_hawk_chief', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'l',
      race: 'humanoid', flags: ['boss'], eva: 10,
      // 弓兵に守られている間の倍率（desert_guard_down で elemBase・physBase＝ふだんの値に戻す）
      elem: ALL(0.2), phys: { slash: 0.2, blunt: 0.2, pierce: 0.2 }, elemBase: {}, physBase: {}, guarded: true, statusRes: { sleep: 0.5 },
      // 2026-10-01（ボスの組み直し）: 砂を巻き上げる構え（予告）は 3 手番ごとの決まりをやめ、たまに（2 ラウンド目から）。砂けむりの舞は最大 HP の 4 割（前は 9 割）。
      //   砂つぶて（目つぶし）を足す。弓兵と合わせる合体技「鷹の狩り」がある
      actions: A([['attack', 3], ['eb_hawk_cut', 3], ['eb_hawk_sand', 2], ['eb_hawk_dust', 1, { round: 2 }], ['eb_hawk_rally', SCHED, { flag: 'hawk_guard_down', once: true }]]),
      s: { hp: 0.85 },
      drops: MID('i_ether'),
      desc: R.T('data.bosses_desert.LIST.b_hawk_chief.desc'),
    },
    b_hawk_bow: {
      name: R.T('data.bosses_desert.LIST.b_hawk_bow.name'), sprite: 'desert_hawk_bow', artKind: 'mon', bossType: 'add', addOf: 'b_hawk_chief', lv: 8, hpShare: 1.0, actsPerTurn: 1, size: 's',
      race: 'humanoid', flags: ['boss'], eva: 10, elem: {}, phys: {}, statusRes: {},
      actions: A([['e_arrow', 3], ['eb_hawk_volley', 1]]),
      onDeath: 'desert_guard_down',
      s: { atk: 0.7, mag: 0.7 },
      drops: {},
      desc: R.T('data.bosses_desert.LIST.b_hawk_bow.desc'),
    },
    b_sun_orb: {
      name: R.T('data.bosses_desert.LIST.b_sun_orb.name'), sprite: 'desert_sun_orb', artKind: 'mon', bossType: 'add', addOf: 'b_sandking', lv: 7, hpShare: 0.8, actsPerTurn: 1, size: 's',
      race: 'spirit', flags: ['boss'], eva: 0, elem: { water: 1.5, fire: 0.25, light: 0.25 }, phys: {}, statusRes: { poison: 1, sleep: 1, death: 1 },
      actions: A([['eb_orb_flare', 3]]), orb: 'sun', onDeath: 'desert_orb_break',
      s: { atk: 0.6, mag: 0.6 },
      drops: {},
      desc: R.T('data.bosses_desert.LIST.b_sun_orb.desc'),
    },
    b_moon_orb: {
      name: R.T('data.bosses_desert.LIST.b_moon_orb.name'), sprite: 'desert_moon_orb', artKind: 'mon', bossType: 'add', addOf: 'b_sandking', lv: 7, hpShare: 0.8, actsPerTurn: 1, size: 's',
      race: 'spirit', flags: ['boss'], eva: 0, elem: { fire: 1.5, water: 0.25, dark: 0.25 }, phys: {}, statusRes: { poison: 1, sleep: 1, death: 1 },
      actions: A([['eb_orb_moonlight', 3]]), orb: 'moon', onDeath: 'desert_orb_break',
      s: { atk: 0.6, mag: 0.6 },
      drops: {},
      desc: R.T('data.bosses_desert.LIST.b_moon_orb.desc'),
    },
  };
  for (const id in LIST) { R.DB.monsters[id] = LIST[id]; R.DB.bosses[id] = LIST[id]; }

  // 移した砂もぐり・砂の王の行動を考えどころの形に（数値 s は sim_bosses で合わせた値）
  // （bosses.js の後に読むので、ここで書けば fillStats の前に効く）
  {
    const W = R.DB.monsters.b_sandworm, K = R.DB.monsters.b_sandking;
    if (W) {
      // 4 手番で 1 回り: 地上の技 → 身を沈める（予告）→ もぐりざまに食らいつく（もぐる。次の予告）→ 砂中の一撃（全体・顔を出す）。
      // 2026-10-01: 前は 3 手番ごとに 予告 → もぐる → 一撃 で、ダメージのある手番が 3 回に 1 回しかなかった（弱すぎる）。
      //   いまは予告の手番のほかは毎回打つ（攻めの手番 4 回に 3 回。岩食らい・大ダコと同じ）
      // 2026-10-01（ボスの組み直し）: 身を沈める（予告）は 4 手番ごとの決まりをやめ、たまに。砂中の一撃は最大 HP の 4 割（前は 10 割）
      W.actions = A([['attack', 3, { noFlag: 'worm_sunk' }], ['eb_quicksand', 2, { noFlag: 'worm_sunk' }], ['eb_swallow_whole', 2, { noFlag: 'worm_sunk' }],
        ['eb_worm_rear', 2, { noFlag: 'worm_sunk' }], ['eb_worm_surface', SCHED, { flag: 'worm_sunk' }]]);
      W.sunk = { phys: { slash: 0.15, blunt: 0.15, pierce: 1 }, elem: { fire: 0.15, water: 0.15, wind: 0.15, light: 0.15, dark: 0.15, earth: 1.5 } };
      W.drops = Object.assign({}, W.drops);
      W.desc = R.T('data.bosses_desert.desc');
    }
    if (K) {
      // 2026-10-01（ボスの組み直し）: 序盤の地方ボスは 1 手番に 1 回（前は 2 回）。王らしく「名」で攻める: 名を盗む（沈黙・MP）、名を刻む（呪いの印）→
      //   のちの手番に 名を呼ぶ声（印の人だけ最大 HP の 3 割。守れば 1 割弱）。日と月の玉・砂の審判の構え（予告、最大 HP の 4 割）は前の考えどころのまま、決まった順はない
      K.actsPerTurn = 1;
      K.actions = A([['attack', 2], ['eb_steal_name', 2], ['eb_king_sand', 2], ['eb_withering', 2],
        ['eb_king_sun', SCHED, { every: [10, 1], countBelow: 5, noFlag: 'orb_out' }], ['eb_king_moon', SCHED, { every: [10, 6], countBelow: 5, noFlag: 'orb_out' }],
        ['eb_king_mark', 2, { noFlag: 'king_mark' }], ['eb_king_call', 8, { flag: 'king_mark' }],
        ['eb_king_raise', 1]]);
      K.phases = [{ hpBelow: 0.4, msg: R.T('data.bosses_desert.phases.0.msg'), set: { buffs: { atk: 1, mag: 1 } } }];
      K.orbHost = true;
      K.desc = R.T('data.bosses_desert.desc_2');
    }
    if (K) K.s = Object.assign({}, K.s, DS.b_sandking);
    if (W) W.s = Object.assign({}, W.s, DS.b_sandworm);
  }

  // ------------------------------------------------------------ 行動（予告は E18。効果の無い予告は構えるだけ）
  Object.assign(R.DB.bossActions, {
    // 鷹団の頭
    eb_hawk_cut: { name: R.T('bossActions.eb_hawk_cut.name'), kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash' }], fx: 'slash2', msg: R.T('bossActions.eb_hawk_cut.msg') },
    eb_hawk_dust: { name: R.T('bossActions.eb_hawk_dust.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_hawk_dust.msg'),
      telegraph: { text: R.T('bossActions.eb_hawk_dust.telegraph.text'), pose: 'tele', tint: '#e8cf98', next: 'eb_hawk_storm', guard: 'defend', lethal: true } },
    eb_hawk_sand: { name: R.T('bossActions.eb_hawk_sand.name'), kind: 'enemy', target: 'enemy', aim: 'caster', effects: [{ type: 'damage', formula: 'phys', power: 0.8 }, { type: 'status', status: 'blind', chance: 0.5 }], fx: 'earth', msg: R.T('bossActions.eb_hawk_sand.msg') },
    eb_hawk_storm: { name: R.T('bossActions.eb_hawk_storm.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.4, guardPct: 0.1, kind: 'slash' }, { type: 'status', status: 'blind', chance: 0.3 }], fx: 'slash2', msg: R.T('bossActions.eb_hawk_storm.msg') },
    eb_hawk_rally: { name: R.T('bossActions.eb_hawk_rally.name'), kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: R.T('bossActions.eb_hawk_rally.msg') },
    eb_hawk_volley: { name: R.T('bossActions.eb_hawk_volley.name'), kind: 'enemy', target: 'random', effects: [{ type: 'damage', formula: 'phys', power: 0.6, hits: 2, kind: 'pierce' }], fx: 'arrow', msg: R.T('bossActions.eb_hawk_volley.msg') },
    // 砂もぐり
    eb_worm_rear: { name: R.T('bossActions.eb_worm_rear.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_worm_rear.msg'),
      telegraph: { text: R.T('bossActions.eb_worm_rear.telegraph.text'), pose: 'tele', tint: '#d8b878', next: 'eb_worm_sink', guard: 'element:earth',
        cancel: { element: 'earth', msg: R.T('bossActions.eb_worm_rear.telegraph.cancel.msg') } } },
    // もぐりざまに足もとの 1 人へ食らいつく（もぐっている間も攻める）。もぐっている間に土で打つと引きずり出す（cancel.special）
    eb_worm_sink: { name: R.T('bossActions.eb_worm_sink.name'), kind: 'enemy', target: 'random',
      effects: [{ type: 'damage', formula: 'phys', power: 1.6, kind: 'pierce' }, { type: 'special', id: 'desert_worm_sink', on: 'self' }], fx: 'earth', msg: R.T('bossActions.eb_worm_sink.msg'),
      telegraph: { text: R.T('bossActions.eb_worm_sink.telegraph.text'), pose: 'idle', tint: '#b89868', next: 'eb_worm_burst', guard: 'defend', lethal: true,
        cancel: { element: 'earth', special: 'desert_worm_surface', msg: R.T('bossActions.eb_worm_sink.telegraph.cancel.msg') } } },
    eb_worm_burst: { name: R.T('bossActions.eb_worm_burst.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.4, guardPct: 0.1, kind: 'blunt' }, { type: 'special', id: 'desert_worm_surface' }], fx: 'strike3', msg: R.T('bossActions.eb_worm_burst.msg') },
    eb_worm_surface: { name: R.T('bossActions.eb_worm_surface.name'), kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'desert_worm_surface' }], fx: 'earth', msg: R.T('bossActions.eb_worm_surface.msg') },
    // 名なき砂の王
    eb_king_sun: { name: R.T('bossActions.eb_king_sun.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_sun_orb', n: 1, max: 5 }, { type: 'special', id: 'desert_orb_absorb', orb: 'sun' }], fx: 'fire2',
      msg: R.T('bossActions.eb_king_sun.msg') },
    eb_king_moon: { name: R.T('bossActions.eb_king_moon.name'), kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_moon_orb', n: 1, max: 5 }, { type: 'special', id: 'desert_orb_absorb', orb: 'moon' }], fx: 'water2',
      msg: R.T('bossActions.eb_king_moon.msg') },
    eb_king_raise: { name: R.T('bossActions.eb_king_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_king_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_king_raise.telegraph.text'), pose: 'tele', tint: '#f0d890', next: 'eb_king_judgment', guard: 'defend', lethal: true,
        cancel: { element: 'fire', msg: R.T('bossActions.eb_king_raise.telegraph.cancel.msg') } } },
    eb_king_mark: { name: R.T('bossActions.eb_king_mark.name'), kind: 'enemy', target: 'enemy', aim: 'strong', effects: [{ type: 'special', id: 'boss_mark', flag: 'king_mark', pct: 0.3, guardPct: 0.08 }], fx: 'dark2', msg: R.T('bossActions.eb_king_mark.msg') },
    eb_king_call: { name: R.T('bossActions.eb_king_call.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'boss_mark_burst', flag: 'king_mark', kind: 'magic', element: 'dark' }], fx: 'dark3', msg: R.T('bossActions.eb_king_call.msg') },
    eb_king_judgment: { name: R.T('bossActions.eb_king_judgment.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.4, guardPct: 0.1, kind: 'earth', element: 'earth' }], fx: 'earth2',
      msg: R.T('bossActions.eb_king_judgment.msg') },
    eb_orb_flare: { name: R.T('bossActions.eb_orb_flare.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 1.0, element: 'fire' }], fx: 'fire2', msg: R.T('bossActions.eb_orb_flare.msg') },
    eb_orb_moonlight: { name: R.T('bossActions.eb_orb_moonlight.name'), kind: 'enemy', target: 'ally_other', effects: [{ type: 'heal', pct: 0.1 }], fx: 'heal', msg: R.T('bossActions.eb_orb_moonlight.msg') },
  });

  // ------------------------------------------------------------ 特別な効果（battle_core の effect 'special' と d.onDeath）
  R.onData(function () {
    const BC = (R.BattleCore = R.BattleCore || {});
    const SP = (BC.specials = BC.specials || {});
    const saveBase = (d) => { if (!d.elemBase) { d.elemBase = Object.assign({}, d.elem || {}); d.physBase = Object.assign({}, d.phys || {}); } };
    // 予告の大技（砂けむりの舞・砂中の一撃・砂の審判）: 最大 HP の割合で削る。守った人は guardPct だけ（予告を読んで守れば耐えられる）
    SP.desert_sweep = function* (eng, u, t, eff) {
      if (!t || !t.alive || !t.isParty) return;
      const p = t.defending ? (eff.guardPct != null ? eff.guardPct : 0.15) : (eff.pct != null ? eff.pct : 0.6);
      yield* eng.hit(u, t, { dmg: Math.max(1, Math.round(t.mhp * p)) }, { kind: eff.kind || 'phys', element: eff.element || null });
    };
    // 鷹団の弓兵が倒れた: 残りの弓兵がいなければ頭の守りが解ける
    SP.desert_guard_down = function* (eng, u) {
      const left = eng.mons.filter((m) => m !== u && m.alive && m.d.onDeath === 'desert_guard_down');
      if (left.length) { yield eng.m(R.T('data.bosses_desert.desert_guard_down.m', { length: left.length })); return; }
      const chief = eng.mons.find((m) => m.alive && m.d.guarded);
      if (!chief) return;
      const d = chief.ownDef();
      d.elem = Object.assign({}, d.elemBase || {});
      d.phys = Object.assign({}, d.physBase || {});
      eng.flags.hawk_guard_down = true;
      yield eng.m(R.T('data.bosses_desert.desert_guard_down.m_2'));
    };
    // 砂もぐりが砂にもぐる／顔を出す
    SP.desert_worm_sink = function* (eng, u) {
      const d = u.ownDef();
      saveBase(d);
      d.elem = Object.assign({}, d.elemBase, (d.sunk || {}).elem || {});
      d.phys = Object.assign({}, d.physBase, (d.sunk || {}).phys || {});
      eng.flags.worm_sunk = true;
      yield eng.m(R.T('data.bosses_desert.desert_worm_sink.m'));
    };
    SP.desert_worm_surface = function* (eng, u) {
      if (!eng.flags.worm_sunk) return;
      const d = u.ownDef();
      d.elem = Object.assign({}, d.elemBase || d.elem);
      d.phys = Object.assign({}, d.physBase || d.phys);
      eng.flags.worm_sunk = false;
    };
    // 砂の王の玉: 呼ぶと王が玉の属性を吸う、割ると戻る
    const ORB = { sun: { fire: -1, light: -1 }, moon: { water: -1, dark: -1 } };
    const recompute = (eng) => {
      const king = eng.mons.find((m) => m.alive && m.d.orbHost);
      if (!king) return null;
      const d = king.ownDef();
      saveBase(d);
      const e = Object.assign({}, d.elemBase);
      let any = false;
      for (const m of eng.mons) if (m.alive && m.d.orb && ORB[m.d.orb]) any = true;
      // 玉があるあいだは光の膜: 刃も術も 3 割しか通らず、玉と同じ属性は吸う
      if (any) for (const k of Object.keys(ORB.sun).concat(Object.keys(ORB.moon), ['wind', 'earth'])) e[k] = (e[k] != null ? e[k] : 1) * 0.3;
      for (const m of eng.mons) if (m.alive && m.d.orb && ORB[m.d.orb]) Object.assign(e, ORB[m.d.orb]);
      d.elem = e;
      d.phys = any ? { slash: 0.3, blunt: 0.3, pierce: 0.3 } : Object.assign({}, d.physBase);
      eng.flags.orb_out = any;
      return king;
    };
    SP.desert_orb_absorb = function* (eng) { recompute(eng); };
    SP.desert_orb_break = function* (eng, u) {
      const king = recompute(eng);
      if (!king) return;
      yield eng.m(u.d.orb === 'sun' ? R.T('data.bosses_desert.desert_orb_break.m') : R.T('data.bosses_desert.desert_orb_break.m_2'));
    };
    // 王の名を呼ぶ（道具 i_desert_kingname）。第 2 の姿の後だけ効く。早すぎたら道具は戻る
    SP.desert_call_name = function* (eng, u, t, eff, ctx) {
      const king = eng.mons.find((m) => m.alive && m.d.orbHost);
      const id = (ctx && ctx.id) || 'i_desert_kingname';
      if (!king) { eng.inv[id] = (eng.inv[id] || 0) + 1; yield eng.m(R.T('data.bosses_desert.desert_call_name.m')); return; }
      if (!(king.hpRate() < 0.4 || (king.phaseDone && king.phaseDone[0]))) {
        eng.inv[id] = (eng.inv[id] || 0) + 1;
        yield eng.m(R.T('data.bosses_desert.desert_call_name.m_2'));
        yield eng.m(R.T('data.bosses_desert.desert_call_name.m_3'));
        return;
      }
      yield eng.m(R.T('data.bosses_desert.desert_call_name.m_4'));
      yield eng.m(R.T('data.bosses_desert.desert_call_name.m_5'));
      eng.flags.king_named = true;
      if (R.Game && R.Game.flags) R.Game.flags.desert_named = true;
      for (const m of eng.mons) if (m !== king && m.alive) { m.gone = true; yield { t: 'flee', u: m }; }
      yield* eng.die(king, u, null);
    };
    // 玉は「倒れた」ときの効果を持つ（battle_core の die → d.onDeath）
  });

  // 盗み専用（A28）は items_steal.js の ac_st_sandking（砂の王）・hn_st_gold_idol（黄金の守護像）。36 品の決まった数なので足さない

  // ------------------------------------------------------------ 編成
  const boss = (mons, o) => Object.assign({ mons, noEscape: true }, o);
  Object.assign(R.DB.troops, {
    // 野営地 1 で「戦う」を選んだとき（中ボス）
    tr_b_hawkchief: boss([['b_hawk_bow', 1], ['b_hawk_chief', 1], ['b_hawk_bow', 1]], { scale: 'tier', lvOff: 1, bg: 'desert', bgm: 'boss' }),
    // アジトが敵の砦になったときの奥の戦い（弓兵が 3 人）
    tr_b_hawkhold: boss([['b_hawk_bow', 1], ['b_hawk_chief', 1], ['b_hawk_bow', 2]], { scale: 'tier', lvOff: 2, bg: 'cave', bgm: 'boss' }),
    // 隊が襲われた（ワールドの隊商路の決まった所。雑魚の組、逃げられない）
    // 砂に沈んだ神殿の奥殿の番（寄り道。日輪の杖の手前）: 黄金の守護像の兄弟たち
    tr_desert_sun_guard: boss([['@golem', 1], ['@mummy', 2]], { scale: 'tier', lvOff: 2, bg: 'cave', bgm: 'boss2' }),
    // 王墓 1 階の隠し部屋の金剛トカゲ（ティアごとに 1 度。盗みでしか取れない品のため）
    tr_desert_lizard_hole: { mons: [['rm_diamond_lizard', 1]], scale: 'tier', lvOff: 0, bg: 'cave', bgm: 'rarebattle' },
    tr_desert_ambush: { mons: [['@scorpion', 2], ['@snake', 1]], scale: 'tier', lvOff: 0, bg: 'desert', bgm: 'battle', noEscape: true },
    tr_desert_ambush2: { mons: [['@cactus', 2], ['@sandworm', 1]], scale: 'tier', lvOff: 0, bg: 'desert', bgm: 'battle', noEscape: true },
    tr_desert_ambush3: { mons: [['@snake', 2], ['@scorpion', 2]], scale: 'tier', lvOff: 1, bg: 'desert', bgm: 'battle', noEscape: true },
  });
  // 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）: 鷹の狩り（弓兵が矢で縫い止め、頭が同じ人を斬る）
  R.defs('enemyCombos', {
    c_b_hawk_hunt: { name: R.T('enemyCombos.c_b_hawk_hunt.name'), members: [{ mon: 'b_hawk_chief' }, { mon: 'b_hawk_bow' }],
      steps: [{ by: 1, act: 'ec_pin_arrow', aim: 'low' }, { by: 0, act: 'eb_hawk_cut', same: true, seq: 'sq:ec_hawk_slash' }], round: 2, chance: 0.35, cd: 3 },
  });
  // 王墓のボスの背景（描いた絵の pyramid＝王墓の王の間）
  R.onData(function () {
    const T = R.DB.troops;
    if (T.tr_b_sandworm) Object.assign(T.tr_b_sandworm, { bg: 'pyramid' });   // 王墓の中（描いた絵 bbg/pyramid）
    if (T.tr_b_sandking) Object.assign(T.tr_b_sandking, { bg: 'pyramid', mons: [['@mummy', 1], ['b_sandking', 1]] });
  });
})(window.RPG);
