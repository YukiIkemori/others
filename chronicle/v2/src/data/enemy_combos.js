// v2（BATTLE、2026-10-01 w_combo）: 敵の合体技（オーナー「敵も特殊な合体技とか使ってきたり、もっともっとバリュエーション作ってよ」）。
//   決まりは scratch の COMBO_SPEC.md と同じ。選ぶのは R.BattleAI.comboFor、出すのは Engine#combo（battle_core.js）。
//   R.DB.enemyCombos[id] = {
//     name,                       技名（帯と見出しに出る）
//     members: [{mon|lin|race|flag, stage?, n?}],   仲間の決まり（mon・lin は id か配列。n はその決まりの数）
//     steps: [{by|each, act, to?, same?, aim?, seq?}],  順に出す行動（by = members を並べた番号。each = 全員。to = 仲間へ。same = 前の的）
//     merge?: {mon, seq?},        全員が消えて 1 体の大きな魔物になる（steps の代わり）
//     tierMin?, tierMax?, round?, cond?, chance?（既定 0.35）, cd?（既定 3）, max?
//   }
//   加われるのは、生きていて動ける（眠り・まひ・凍り・気絶・混乱・予告中でない）、このラウンドの手番が残っている仲間だけ。
//   合体技は加わった全員の手番を使う。出る地方: 下の表の見出し（序盤は 3 つだけ、ティア 3 から増える）
(function (R) {
  'use strict';
  R.defs('enemyCombos', {
    // ---- 序盤（森・序章の井戸・湿原の蓮の沼。ティア 0 から）
    c_jelly_merge: { name: R.T('enemyCombos.c_jelly_merge.name'), members: [{ lin: 'jelly', n: 3 }], merge: { mon: 'jelly_big', seq: 'sq:ec_jelly_merge' }, round: 2, chance: 0.3, max: 1 },
    c_pack_hunt: { name: R.T('enemyCombos.c_pack_hunt.name'), members: [{ lin: 'wolf', n: 2 }], steps: [{ each: true, act: 'ec_pack_fang', same: true, seq: 'sq:ec_pack_fang' }], chance: 0.3, cd: 3, max: 2 },
    c_thorn_cage: { name: R.T('enemyCombos.c_thorn_cage.name'), members: [{ lin: 'treant' }, { lin: 'plant' }], steps: [{ by: 0, act: 'ec_root_snare' }, { by: 1, act: 'ec_thorn_bite', same: true, seq: 'sq:ec_thorn_bite' }], chance: 0.35, cd: 3 },
    // ---- 森（ティア 2 から: 群れのハチ・妖精とキノコ）
    c_bee_swarm: { name: R.T('enemyCombos.c_bee_swarm.name'), members: [{ lin: 'bee', n: 3 }], steps: [{ by: 0, act: 'ec_bee_storm', seq: 'sq:ec_bee_storm' }], tierMin: 2, chance: 0.3, max: 1 },
    c_spore_dance: { name: R.T('enemyCombos.c_spore_dance.name'), members: [{ lin: 'fairy' }, { lin: 'mushroom' }], steps: [{ by: 0, act: 'ec_spore_dance', seq: 'sq:ec_spore_dance' }], tierMin: 2, chance: 0.3, max: 1 },
    // ---- 砂漠
    c_venom_pincer: { name: R.T('enemyCombos.c_venom_pincer.name'), members: [{ lin: 'snake' }, { lin: 'scorpion' }], steps: [{ by: 0, act: 'ec_coil' }, { by: 1, act: 'ec_venom_tail', same: true, seq: 'sq:ec_venom_tail' }], tierMin: 1, chance: 0.35, cd: 3 },
    c_hawk_pincer: { name: R.T('enemyCombos.c_hawk_pincer.name'), members: [{ mon: 'desert_hawk_bow' }, { mon: 'desert_hawk_blade' }], steps: [{ by: 0, act: 'ec_pin_arrow' }, { by: 1, act: 'ec_hawk_slash', same: true, seq: 'sq:ec_hawk_slash' }], chance: 0.4, cd: 3 },
    c_quicksand: { name: R.T('enemyCombos.c_quicksand.name'), members: [{ lin: 'sandworm' }, { lin: ['scorpion', 'snake'] }], steps: [{ by: 0, act: 'ec_quicksand', seq: 'sq:s_wind_earth_a' }], tierMin: 3, chance: 0.35, max: 1 },
    // ---- 雪原（群れ狩りは上）
    c_blizzard_fang: { name: R.T('enemyCombos.c_blizzard_fang.name'), members: [{ lin: 'frostling' }, { lin: 'wolf' }], steps: [{ by: 0, act: 'ec_snow_veil' }, { by: 1, act: 'ec_ice_fang', seq: 'sq:ec_ice_fang' }], tierMin: 1, chance: 0.35, cd: 3 },
    c_avalanche: { name: R.T('enemyCombos.c_avalanche.name'), members: [{ lin: 'yeti' }, { lin: ['frostling', 'wolf'] }], steps: [{ by: 0, act: 'ec_avalanche', seq: 'sq:ec_avalanche' }], tierMin: 3, chance: 0.3, max: 1 },
    c_stomp_signal: { name: R.T('enemyCombos.c_stomp_signal.name'), members: [{ lin: 'owl' }, { lin: 'mammoth' }], steps: [{ by: 0, act: 'ec_lull_song' }, { by: 1, act: 'ec_crushing_stomp', same: true, seq: 'sq:ec_crushing_stomp' }], tierMin: 5, chance: 0.35, cd: 3 },
    // ---- 湿原（ゼリー合体は上）
    c_tongue_lance: { name: R.T('enemyCombos.c_tongue_lance.name'), members: [{ lin: 'frog' }, { lin: 'lizardman' }], steps: [{ by: 0, act: 'ec_tongue_grab' }, { by: 1, act: 'ec_pinned_thrust', same: true, seq: 'sq:ec_pinned_thrust' }], tierMin: 1, chance: 0.35, cd: 3 },
    c_wisp_parade: { name: R.T('enemyCombos.c_wisp_parade.name'), members: [{ lin: 'ghost' }, { lin: 'wisp' }], steps: [{ by: 1, act: 'ec_wisp_parade', seq: 'sq:s_fire_dark_a' }], tierMin: 3, chance: 0.35, max: 1 },
    c_puppet_strings: { name: R.T('enemyCombos.c_puppet_strings.name'), members: [{ lin: 'doll' }, { lin: 'ghost' }], steps: [{ by: 0, act: 'ec_puppet_strings', seq: 'sq:ec_puppet_strings' }], tierMin: 5, chance: 0.35, max: 1 },
    // ---- 諸島
    c_whirlpool: { name: R.T('enemyCombos.c_whirlpool.name'), members: [{ lin: 'merman' }, { lin: 'jelly' }], steps: [{ by: 0, act: 'ec_whirlpool', seq: 'sq:s_water_5' }], tierMin: 1, chance: 0.35, max: 1 },
    c_cannon_grapple: { name: R.T('enemyCombos.c_cannon_grapple.name'), members: [{ lin: 'kraken' }, { lin: 'skeleton' }], steps: [{ by: 0, act: 'ec_grapple' }, { by: 1, act: 'ec_point_blank', same: true, seq: 'sq:ec_point_blank' }], tierMin: 3, chance: 0.35, cd: 3 },
    // ---- 山地
    c_goblin_cannon: { name: R.T('enemyCombos.c_goblin_cannon.name'), members: [{ lin: 'golem' }, { lin: 'goblin' }], steps: [{ by: 0, act: 'ec_goblin_cannon', seq: 'sq:s_fire_earth_a' }], tierMin: 1, chance: 0.35, max: 1 },
    c_burrow_strike: { name: R.T('enemyCombos.c_burrow_strike.name'), members: [{ lin: 'mole' }, { lin: 'beetle' }], steps: [{ by: 0, act: 'ec_tunnel' }, { by: 1, act: 'ec_upthrust', seq: 'sq:ec_upthrust' }], tierMin: 5, chance: 0.35, cd: 3 },
    // ---- 灰の荒野
    c_fire_tornado: { name: R.T('enemyCombos.c_fire_tornado.name'), members: [{ lin: 'salamander' }, { lin: 'imp' }], steps: [{ by: 0, act: 'ec_fire_tornado', seq: 'sq:s_fire_wind_b' }], tierMin: 1, chance: 0.35, max: 1 },
    c_war_cry: { name: R.T('enemyCombos.c_war_cry.name'), members: [{ lin: 'imp' }, { lin: 'orc' }], steps: [{ by: 0, act: 'ec_dark_blessing', to: 1 }, { by: 1, act: 'ec_brute_smash', seq: 'sq:ec_brute_smash' }], tierMin: 3, chance: 0.35, cd: 3 },
    c_hellfire: { name: R.T('enemyCombos.c_hellfire.name'), members: [{ lin: 'chimera' }, { lin: 'salamander' }], steps: [{ by: 0, act: 'ec_hellfire', seq: 'sq:ec_hellfire' }], tierMin: 5, chance: 0.3, max: 1 },
    // ---- 高原・諸島の船（鎧・骸骨の二人組）
    c_cross_slash: { name: R.T('enemyCombos.c_cross_slash.name'), members: [{ lin: ['armor', 'skeleton'], stage: 2, n: 2 }], steps: [{ by: 0, act: 'ec_cross_slash', seq: 'sq:ec_cross_slash' }], tierMin: 1, chance: 0.35, cd: 3 },
    c_arcane_cannon: { name: R.T('enemyCombos.c_arcane_cannon.name'), members: [{ lin: 'darkmage' }, { lin: 'automaton' }], steps: [{ by: 0, act: 'ec_charge_core', to: 1 }, { by: 1, act: 'ec_mana_cannon', seq: 'sq:ec_mana_cannon' }], tierMin: 1, chance: 0.35, cd: 3 },
    // ---- 終盤（白の大書庫）・クリア後
    c_blank_page: { name: R.T('enemyCombos.c_blank_page.name'), members: [{ lin: 'scribe' }, { lin: 'book' }], steps: [{ by: 0, act: 'ec_blank_page', seq: 'sq:s_light_dark_a' }], tierMin: 8, chance: 0.35, max: 1 },
    c_void_chaos: { name: R.T('enemyCombos.c_void_chaos.name'), members: [{ lin: 'void' }, { lin: ['chaos', 'demon'] }], steps: [{ by: 0, act: 'ec_void_chaos', seq: 'sq:s_dark_5' }], tierMin: 8, chance: 0.35, cd: 3 },
  });

  // ---- ゼリー合体で生まれる大きなゼリー（段の無い 1 体。強さは戦闘のレベルで決まる）
  R.defs('monsters', {
    jelly_big: {
      name: R.T('monsters.jelly_big.name'), sprite: 'jelly_4', size: 'l', lv: 7, race: 'slime',
      flags: [], s: { hp: 1.5, atk: 0.75, mag: 0.8, agi: 0.6 }, eva: 3, rw: { gold: 2 },
      elem: { fire: 1.25 }, phys: { slash: 1.25, blunt: 0.5 }, statusRes: { poison: 0.5 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_crush', w: 2 }, { id: 'e_tackle', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 16 } },
      desc: R.T('monsters.jelly_big.desc'),
    },
  });

  R.onData(function () {
    // ---- 属性の色変わり（e_elem_shift）: 体の色が変わり、弱点と攻撃の属性が入れ替わる（水晶・鬼火など）
    const BC = R.BattleCore;
    const OPP = { fire: 'water', water: 'fire', wind: 'earth', earth: 'wind', light: 'dark', dark: 'light' };
    if (BC && BC.specials) {
      BC.specials.elem_shift = function* (eng, u) {
        if (!u || u.isParty) return;
        const base = R.DB.monsters[u.id] || {};
        const d = u.ownDef();
        const pool = Object.keys(OPP).filter((e) => e !== d.shifted);
        const el = pool[R.Mon.rng().ri(0, pool.length - 1)];
        d.shifted = el;
        d.element = el;
        d.elem = Object.assign({}, base.elem || {}, { [el]: 0.5, [OPP[el]]: 1.5 });
        yield { t: 'status', u, s: 'buff_def', on: false };
        yield eng.m(R.T('sys.battle_core.elem_shift.m', { name: u.name, el: (R.DB.elements[el] || {}).name || el, weak: (R.DB.elements[OPP[el]] || {}).name || OPP[el] }));
      };
    }
    // ---- 合体技の演出の行（R.BFX.seq.combo。test_fx_seq は enemyActions の id の行を許す）
    const S = R.BFX && R.BFX.seq;
    if (!S || !S.combo) return;
    const L = (p, t0, t1, at, o) => Object.assign({ p, t0, t1, at: at || 'tgt' }, o || {});
    const H = (p, t1, o) => L(p, 0, t1, (o && o.at) || 'tgt', o);
    S.combo('ec_jelly_merge', 'water', 'heal', { c: '合体: 3 体のゼリーの気がより合い、大きな渦の中で 1 つになる', tier: 4, slash: false, hit: [H('ring', 500, { r: 60, w: 3, n: 3, col: 'water' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_pack_fang', 'blood', 'steel', { c: '群れ狩り: 赤い気をまとった牙が同じ的へ次々に食らいつく', tier: 3, slash: false, hit: [H('cut', 260, { n: 3, len: 44, ang: -0.9, step: 0.5, w: 3, col: 'blood' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_thorn_bite', 'earth', 'poison', { c: 'いばらのかご: 根が的を縛り、毒のとげの花が食らいつく', tier: 4, slash: false, main: [L('tendrils', -300, 500, 'tfoot', { n: 8, len: 70, w: 120, gy: 0 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_bee_storm', 'gold', 'poison', { c: '蜂の嵐: 金と毒の色の針が渦を巻いて降りそそぐ', tier: 4, slash: false, main: [L('rain', -200, 600, 'tfoot', { n: 24, w: 300, h: 300, kind: 'arrow', slant: 0.3, trail: 20, life: 0.4 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_spore_dance', 'wind', 'poison', { c: '胞子の舞: 妖精の風に乗って眠りの胞子が敵の側を覆う', tier: 4, slash: false, main: [L('smoke', -300, 600, 'tgt', { n: 14, r: 28, v: 30, col: '200,230,160', a: 0.4, blend: 'source-over' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_venom_tail', 'poison', 'earth', { c: '毒牙の挟み撃ち: しめつけた的へ毒の尾針が突き立つ', tier: 4, hit: [H('thrust', 360, { len: 110, w: 5, through: 60 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_hawk_slash', 'gold', 'steel', { c: '鷹の挟み撃ち: 矢で縫い止めた的へ、金の弧の斬り下ろし', tier: 4 });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_ice_fang', 'ice', 'wind', { c: '吹雪の牙: 吹雪を裂いて氷の牙が食らいつく', tier: 4, slash: false, main: [L('gale', -400, 500, 'scr', { n: 60, kind: 'snow', col: '230,245,255', a: 0.5, len: 24 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_avalanche', 'ice', 'earth', { c: '大雪崩: 雪と岩の塊が敵の側を押し流す', tier: 5, slash: false, main: [L('debris', -200, 600, 'tfoot', { n: 18, v: 90, size: 7, col: '235,245,255' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_crushing_stomp', 'earth', 'steel', { c: '眠らせて踏みつけ: 眠った的の上に巨大な足が落ちて地が割れる', tier: 5, slash: false, hit: [H('crack', 500, { n: 8, len: 60, at: 'tfoot' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_pinned_thrust', 'water', 'steel', { c: '舌からめの槍: 舌で捕らえた的を水をまとう槍が貫く', tier: 4, slash: false, hit: [H('thrust', 380, { len: 130, w: 5, through: 90 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_puppet_strings', 'dark', 'blood', { c: '操り糸: 黒い糸が的に絡みつき、紅い渦の中で心を奪う', tier: 4, slash: false });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_point_blank', 'fire', 'water', { c: '捕らえて大砲: 触手で押さえた的へ、至近の大砲の炎と煙', tier: 5, slash: false, hit: [H('smoke', 520, { n: 8, r: 18, v: 40, col: '120,110,100', a: 0.5, blend: 'source-over' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_upthrust', 'earth', 'steel', { c: '地中からの突き上げ: 後列の足もとが割れ、角が突き上がる', tier: 4, hit: [H('debris', 480, { n: 10, v: 70, size: 5, at: 'tfoot' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_brute_smash', 'blood', 'dark', { c: '鬼の加勢: 闇の加護で赤く燃えた大鬼の一撃', tier: 5, slash: false, hit: [H('ring', 420, { r: 80, flat: 0.34, w: 4, n: 2, at: 'tfoot' })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_hellfire', 'fire', 'blood', { c: '三つ首の業火: 二つの炎が渦を巻き、敵の側を焼き尽くす', tier: 5, slash: false, main: [L('flames', -300, 700, 'tfoot', { n: 30, w: 300, h: 120, size: 10 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_cross_slash', 'steel', 'light', { c: '十字斬り: 二人の剣が左右から交わり、光の X が刻まれる', tier: 5 });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
    S.combo('ec_mana_cannon', 'light', 'staff', { c: '魔導砲: 魔力を注がれた機巧の砲口から光の奔流', tier: 5, slash: false, main: [L('pillar', -100, 500, 'each', { w: 30, n: 12 })] });   // i18n:ignore（c は演出の考えのメモ。画面に出ない）
  });
})(window.RPG);
