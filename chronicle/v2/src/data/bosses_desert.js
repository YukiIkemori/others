// BATTLE（砂漠）: ザハラ砂漠のボスと考えどころ（WORLD_REDESIGN §4.10・§4.11・E18、V2_PLAN §2.6.5）。
//   砂の鷹団の頭 b_hawk_chief（中ボス、野営地 1 で戦う選択とアジトの奥）: 弓兵 b_hawk_bow がいるあいだは「かばわれて」刃も術も
//     ほとんど届かない → 弓兵を先に。弓兵が全員倒れると守りが解ける（special desert_guard_down）。頭の予告「砂を巻き上げる」→ 砂塵の舞（全体）→ 守る。
//   砂もぐり b_sandworm（中ボス、王墓 2 階）: 身を沈める予告 → 次の手番に砂にもぐる（刃と打撃はほとんど効かず、突き・土はそのまま）→
//     その次に砂中の一撃（全体）。予告の手番に土で打つと砂が固まって、もぐれない（cancel）。もぐっている間に土で打つと引きずり出す。
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
    b_sandking: { hp: 0.65, atk: 0.45, mag: 0.45 },
    b_sandworm: { hp: 2.0 },
  };
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const MID = (seed) => ({ normal: { pool: 'p_boss_mid', rate: 1 }, bonus: { item: seed, rate: 1 } });
  const ALL = (v) => ({ fire: v, water: v, wind: v, earth: v, light: v, dark: v });

  // ------------------------------------------------------------ 雑魚: 砂の鷹団（アジトが敵のとき）
  const MOBS = {
    desert_hawk_blade: {
      name: '鷹団の曲刀使い', sprite: 'desert_hawk_blade', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 1.1, atk: 1.15, agi: 1.1 }, elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 4 }, { id: 'e_slash', w: 2 }, { id: 'e_double', w: 1 }],
      drops: { normal: { item: 'i_potion', rate: 8 } },
      desc: '黒い布で顔をおおった\n砂の鷹団の団員。曲刀が速い。',
    },
    desert_hawk_bow: {
      name: '鷹団の弓使い', sprite: 'desert_hawk_bow', size: 'm', lv: 8, race: 'humanoid', flags: [],
      s: { hp: 0.9, atk: 1.1, agi: 1.2 }, elem: {}, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_arrow', w: 4 }],
      drops: { normal: { item: 'i_antidote', rate: 8 } },
      desc: '岩の上から矢を射かける\n砂の鷹団の見張り。',
    },
  };
  for (const id in MOBS) R.DB.monsters[id] = MOBS[id];

  // ------------------------------------------------------------ ボス
  const LIST = {
    b_hawk_chief: {
      name: '鷹団の頭ラシード', sprite: 'b_hawk_chief', bossType: 'mid', lv: 8, actsPerTurn: 1, size: 'l',
      race: 'humanoid', flags: ['boss'], eva: 10,
      // 弓兵に守られている間の倍率（desert_guard_down で elemBase・physBase＝ふだんの値に戻す）
      elem: ALL(0.2), phys: { slash: 0.2, blunt: 0.2, pierce: 0.2 }, elemBase: {}, physBase: {}, guarded: true, statusRes: { sleep: 0.5 },
      actions: A([['attack', 3], ['eb_hawk_cut', 2], ['eb_hawk_dust', SCHED, { every: [3, 1] }], ['eb_hawk_rally', SCHED, { flag: 'hawk_guard_down', once: true }]]),
      s: { hp: 1.5 },
      drops: MID('i_ether'),
      desc: '砂の鷹団の頭。もとは日輪同盟の兵。\n手下の弓に守られて戦う。',
    },
    b_hawk_bow: {
      name: '鷹団の弓兵', sprite: 'desert_hawk_bow', artKind: 'mon', bossType: 'add', addOf: 'b_hawk_chief', lv: 8, hpShare: 1.6, actsPerTurn: 1, size: 's',
      race: 'humanoid', flags: ['boss'], eva: 10, elem: {}, phys: {}, statusRes: {},
      actions: A([['e_arrow', 3], ['eb_hawk_volley', 1]]),
      onDeath: 'desert_guard_down',
      s: { atk: 0.7, mag: 0.7 },
      drops: {},
      desc: '頭の前に矢を並べる弓兵。\n弓兵がいるかぎり、頭に刃は届かない。',
    },
    b_sun_orb: {
      name: '日の玉', sprite: 'desert_sun_orb', artKind: 'mon', bossType: 'add', addOf: 'b_sandking', lv: 7, hpShare: 0.8, actsPerTurn: 1, size: 's',
      race: 'spirit', flags: ['boss'], eva: 0, elem: { water: 1.5, fire: 0.25, light: 0.25 }, phys: {}, statusRes: { poison: 1, sleep: 1, death: 1 },
      actions: A([['eb_orb_flare', 3]]), orb: 'sun', onDeath: 'desert_orb_break',
      s: { atk: 0.6, mag: 0.6 },
      drops: {},
      desc: '王の杖が呼んだ日の光の玉。\n玉があるうち、王は火と光を吸う。',
    },
    b_moon_orb: {
      name: '月の玉', sprite: 'desert_moon_orb', artKind: 'mon', bossType: 'add', addOf: 'b_sandking', lv: 7, hpShare: 0.8, actsPerTurn: 1, size: 's',
      race: 'spirit', flags: ['boss'], eva: 0, elem: { fire: 1.5, water: 0.25, dark: 0.25 }, phys: {}, statusRes: { poison: 1, sleep: 1, death: 1 },
      actions: A([['eb_orb_moonlight', 3]]), orb: 'moon', onDeath: 'desert_orb_break',
      s: { atk: 0.6, mag: 0.6 },
      drops: {},
      desc: '王の杖が呼んだ月の光の玉。\n玉があるうち、王は水と闇を吸う。',
    },
  };
  for (const id in LIST) { R.DB.monsters[id] = LIST[id]; R.DB.bosses[id] = LIST[id]; }

  // 移した砂もぐり・砂の王の行動を考えどころの形に（数値 s は sim_bosses で合わせた値）
  // （bosses.js の後に読むので、ここで書けば fillStats の前に効く）
  {
    const W = R.DB.monsters.b_sandworm, K = R.DB.monsters.b_sandking;
    if (W) {
      W.actions = A([['attack', 3], ['eb_quicksand', 2, { noFlag: 'worm_sunk' }], ['eb_swallow_whole', 1, { noFlag: 'worm_sunk' }],
        ['eb_worm_rear', SCHED, { every: [3, 1], noFlag: 'worm_sunk' }], ['eb_worm_surface', SCHED, { flag: 'worm_sunk' }]]);
      W.sunk = { phys: { slash: 0.15, blunt: 0.15, pierce: 1 }, elem: { fire: 0.15, water: 0.15, wind: 0.15, light: 0.15, dark: 0.15, earth: 1.5 } };
      W.drops = Object.assign({}, W.drops);
      W.desc = '王墓の流砂にひそむ大ミミズ。\n砂にもぐると、刃も術も届かない。';
    }
    if (K) {
      K.actions = A([['attack', 2], ['eb_steal_name', 2], ['eb_king_sand', 2],
        ['eb_king_sun', SCHED, { every: [12, 1], countBelow: 5, noFlag: 'orb_out' }], ['eb_king_moon', SCHED, { every: [12, 7], countBelow: 5, noFlag: 'orb_out' }],
        ['eb_raise_guard', 1, { every: [5, 2], countBelow: 3 }], ['eb_withering', 2],
        ['eb_king_raise', SCHED, { hpBelow: 0.5, every: [4, 0] }]]);
      K.phases = [{ hpBelow: 0.4, msg: '王の顔の包帯がほどけ、\nうつろな目がのぞいた……。', set: { buffs: { atk: 1, mag: 1 } } }];
      K.orbHost = true;
      K.desc = '名を砂の精霊に差し出した王。\n日と月の玉を呼び、忘れた名を探す。';
    }
    if (K) K.s = Object.assign({}, K.s, DS.b_sandking);
    if (W) W.s = Object.assign({}, W.s, DS.b_sandworm);
  }

  // ------------------------------------------------------------ 行動（予告は E18。効果の無い予告は構えるだけ）
  Object.assign(R.DB.bossActions, {
    // 鷹団の頭
    eb_hawk_cut: { name: '鷹の爪', kind: 'enemy', target: 'enemy', effects: [{ type: 'damage', formula: 'phys', power: 1.5, kind: 'slash' }], fx: 'slash2', msg: '{user}は曲刀を低く走らせた！' },
    eb_hawk_dust: { name: '砂を巻き上げる', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は足で砂をすくい上げた！',
      telegraph: { text: 'ラシードが砂を巻き上げている……。', pose: 'tele', tint: '#e8cf98', next: 'eb_hawk_storm', guard: 'defend' } },
    eb_hawk_storm: { name: '砂塵の舞', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 4.0, kind: 'slash', sure: true }, { type: 'status', status: 'blind', chance: 0.3 }], fx: 'slash2', msg: '砂けむりの中から、曲刀が四方へ走った！' },
    eb_hawk_rally: { name: 'ひとり立つ', kind: 'enemy', target: 'self', effects: [{ type: 'buff', stat: 'atk', stages: 1 }], fx: 'buff', msg: '{user}は曲刀を構え直した。「……最後は、おれ一人か」' },
    eb_hawk_volley: { name: '一斉射ち', kind: 'enemy', target: 'random', effects: [{ type: 'damage', formula: 'phys', power: 0.6, hits: 2, kind: 'pierce' }], fx: 'arrow', msg: '{user}は続けざまに矢を放った！' },
    // 砂もぐり
    eb_worm_rear: { name: '身を沈める', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は、ずぶずぶと砂に身を沈めはじめた……。',
      telegraph: { text: '砂もぐりが砂に身を沈めはじめた……。', pose: 'tele', tint: '#d8b878', next: 'eb_worm_sink', guard: 'element:earth',
        cancel: { element: 'earth', msg: '土の力が足もとの砂を固めた！\n砂もぐりは、もぐれない！' } } },
    eb_worm_sink: { name: '砂にもぐる', kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'desert_worm_sink' }], fx: 'earth', msg: '{user}は砂の中へ消えた！',
      telegraph: { text: '砂の下で、何かが這いまわっている……。', pose: 'idle', tint: '#b89868', next: 'eb_worm_burst', guard: 'defend',
        cancel: { element: 'earth', msg: '土の力が、砂の中の砂もぐりを\n引きずり出した！' } } },
    eb_worm_burst: { name: '砂中の一撃', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'phys', power: 3.6, sure: true }, { type: 'special', id: 'desert_worm_surface' }], fx: 'strike3', msg: '足もとの砂が裂け、{user}が飛び出した！' },
    eb_worm_surface: { name: '顔を出す', kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'desert_worm_surface' }], fx: 'earth', msg: '{user}が、砂の上に顔を出した。' },
    // 名なき砂の王
    eb_king_sun: { name: '日の玉', kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_sun_orb', n: 1, max: 5 }, { type: 'special', id: 'desert_orb_absorb', orb: 'sun' }], fx: 'fire2',
      msg: '{user}の杖に、日の光が集まった！\n王の体を、光の膜が包む……。' },
    eb_king_moon: { name: '月の玉', kind: 'enemy', target: 'self', effects: [{ type: 'summon', mon: 'b_moon_orb', n: 1, max: 5 }, { type: 'special', id: 'desert_orb_absorb', orb: 'moon' }], fx: 'water2',
      msg: '{user}の杖に、月の光が集まった！\n王の体を、光の膜が包む……。' },
    eb_king_raise: { name: '杖を掲げる', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '{user}は砂の杖を高く掲げた……。',
      telegraph: { text: '王が杖を掲げた。砂が空へ昇っていく……。', pose: 'tele', tint: '#f0d890', next: 'eb_king_judgment', guard: 'defend',
        cancel: { element: 'fire', msg: '炎が杖の砂を焼き固めた！\n砂の滝は、降ってこない。' } } },
    eb_king_judgment: { name: '砂の審判', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 3.0, element: 'earth', sure: true }, { type: 'status', status: 'blind', chance: 0.35 }], fx: 'earth2',
      msg: '空から、砂の滝が降りそそいだ！' },
    eb_orb_flare: { name: '日輪の炎', kind: 'enemy', target: 'enemies', effects: [{ type: 'damage', formula: 'magic', power: 1.0, element: 'fire' }], fx: 'fire2', msg: '{user}が燃え上がった！' },
    eb_orb_moonlight: { name: '月の癒やし', kind: 'enemy', target: 'ally_other', effects: [{ type: 'heal', pct: 0.1 }], fx: 'heal', msg: '{user}の冷たい光が、王の傷をふさいだ。' },
  });

  // ------------------------------------------------------------ 特別な効果（battle_core の effect 'special' と d.onDeath）
  R.onData(function () {
    const BC = (R.BattleCore = R.BattleCore || {});
    const SP = (BC.specials = BC.specials || {});
    const saveBase = (d) => { if (!d.elemBase) { d.elemBase = Object.assign({}, d.elem || {}); d.physBase = Object.assign({}, d.phys || {}); } };
    // 鷹団の弓兵が倒れた: 残りの弓兵がいなければ頭の守りが解ける
    SP.desert_guard_down = function* (eng, u) {
      const left = eng.mons.filter((m) => m !== u && m.alive && m.d.onDeath === 'desert_guard_down');
      if (left.length) { yield eng.m(`弓兵はあと ${left.length} 人。頭はまだ、矢の陰にいる。`); return; }
      const chief = eng.mons.find((m) => m.alive && m.d.guarded);
      if (!chief) return;
      const d = chief.ownDef();
      d.elem = Object.assign({}, d.elemBase || {});
      d.phys = Object.assign({}, d.physBase || {});
      eng.flags.hawk_guard_down = true;
      yield eng.m('守りの矢が途絶えた！\nラシードの前が、がら空きになった！');
    };
    // 砂もぐりが砂にもぐる／顔を出す
    SP.desert_worm_sink = function* (eng, u) {
      const d = u.ownDef();
      saveBase(d);
      d.elem = Object.assign({}, d.elemBase, (d.sunk || {}).elem || {});
      d.phys = Object.assign({}, d.physBase, (d.sunk || {}).phys || {});
      eng.flags.worm_sunk = true;
      yield eng.m('砂の中の相手には、刃も術も\nほとんど届かない。突くか、土で……！');
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
      yield eng.m(u.d.orb === 'sun' ? '日の玉が砕けた！\n王を包む光の膜が消えた。' : '月の玉が砕けた！\n王を包む光の膜が消えた。');
    };
    // 王の名を呼ぶ（道具 i_desert_kingname）。第 2 の姿の後だけ効く。早すぎたら道具は戻る
    SP.desert_call_name = function* (eng, u, t, eff, ctx) {
      const king = eng.mons.find((m) => m.alive && m.d.orbHost);
      const id = (ctx && ctx.id) || 'i_desert_kingname';
      if (!king) { eng.inv[id] = (eng.inv[id] || 0) + 1; yield eng.m('呼ぶべき相手が、ここにはいない。'); return; }
      if (!(king.hpRate() < 0.4 || (king.phaseDone && king.phaseDone[0]))) {
        eng.inv[id] = (eng.inv[id] || 0) + 1;
        yield eng.m('{hero}は王の名を呼んだ。\n……砂のうなりが、声をかき消した。');
        yield eng.m('王の包帯の奥の耳には、\nまだ届かないようだ。');
        return;
      }
      yield eng.m('{hero}は、三つの文字をつないで\n王の名を呼んだ。――ハザル。');
      yield eng.m('名なき砂の王の動きが、止まった。');
      eng.flags.king_named = true;
      if (R.Game && R.Game.flags) R.Game.flags.desert_named = true;
      for (const m of eng.mons) if (m !== king && m.alive) { m.gone = true; yield { t: 'flee', u: m }; }
      yield* eng.die(king, u, null);
    };
    // 玉は「倒れた」ときの効果を持つ（battle_core の die → d.onDeath）
  });

  // ------------------------------------------------------------ 盗み専用（A28）: 金剛トカゲ（レア、率 16）
  R.defs('items', {
    sh_st_diamond_lizard: { name: '金剛うろこの盾', slot: 'shield', grade: 'super', tier: 5, src: 'steal', stealOnly: true, weight: 'light', units: 'a2',
      mods: { elemResist: { earth: 0.5 }, takenPct: -5 }, abil: { vit: 1 }, icon: 'shield' },
  });
  R.onData(function () {
    const L = R.DB.monsters.rm_diamond_lizard;
    if (L) L.drops = Object.assign({}, L.drops, { steal: { item: 'sh_st_diamond_lizard', rate: 16 } });
    if (R.DB.stealSources) R.DB.stealSources.sh_st_diamond_lizard = { mon: 'rm_diamond_lizard', rate: 16 };
  });

  // ------------------------------------------------------------ 編成
  const boss = (mons, o) => Object.assign({ mons, noEscape: true }, o);
  Object.assign(R.DB.troops, {
    // 野営地 1 で「戦う」を選んだとき（中ボス）
    tr_b_hawkchief: boss([['b_hawk_bow', 1], ['b_hawk_chief', 1], ['b_hawk_bow', 1]], { scale: 'tier', lvOff: 1, bg: 'desert', bgm: 'boss' }),
    // アジトが敵の砦になったときの奥の戦い（弓兵が 3 人）
    tr_b_hawkhold: boss([['b_hawk_bow', 1], ['b_hawk_chief', 1], ['b_hawk_bow', 2]], { scale: 'tier', lvOff: 2, bg: 'cave', bgm: 'boss' }),
    // 隊が襲われた（ワールドの隊商路の決まった所。雑魚の組、逃げられない）
    tr_desert_ambush: { mons: [['@scorpion', 2], ['@snake', 1]], scale: 'tier', lvOff: 0, bg: 'desert', bgm: 'battle', noEscape: true },
    tr_desert_ambush2: { mons: [['@cactus', 2], ['@sandworm', 1]], scale: 'tier', lvOff: 0, bg: 'desert', bgm: 'battle', noEscape: true },
    tr_desert_ambush3: { mons: [['@snake', 2], ['@scorpion', 2]], scale: 'tier', lvOff: 1, bg: 'desert', bgm: 'battle', noEscape: true },
  });
  // 王墓のボスの背景（painted の desert・cave）
  R.onData(function () {
    const T = R.DB.troops;
    if (T.tr_b_sandworm) Object.assign(T.tr_b_sandworm, { bg: 'cave' });
    if (T.tr_b_sandking) Object.assign(T.tr_b_sandking, { bg: 'cave', mons: [['@mummy', 1], ['b_sandking', 1]] });
  });
})(window.RPG);
