// items_postclear.js — クリア後（忘却の底、ゲームのティア 9）の専用の装備 48 品と、忘却の底の魔物の落とし物・盗みの割り当て（RULES）。
//   持ち主 2026-10-04「装備のティアの見直し」（design/notes/gear_tiers.md）:
//     「武器種によって 11 とか 12 がないのは不公平だから、それぞれ各 1 種ずつは作って。エモい名前のやつね。
//       12 は実質 13 レベルに強くて良いよ。手に入りづらいからその分性能は格別」
//   - レア（ティア 11）24 品: 武器 5 系統 × 1・防具 5 枠 × 3 重さ（重装 灯台守・軽装 夜渡り・布 月灯り）・アクセサリ 4
//   - 超レア（ティア 12、値は 13 の強さ = valueTier 13）24 品: 武器 5・防具 15（重装 大灯火・軽装 流星・布 追憶）・アクセサリ 4
//     （星結びの組ひも = あらゆる状態異常が効かない）
//   - ティアは決まっている（fixedTier。手に入れたティアで伸び縮みしない＝ grow 'drop' にしない）。店・宝箱の表には入れない
//   出どころ（忘却の底の魔物・レア魔物・ボスだけ）:
//     レア 11 = レアの落とし物（drops.rare.item）＋ 盗みのレア（drops.rare.steal）で全品
//     超レア 12 = 超レアの落とし物（drops.super）＋ 盗み専用（drops.steal。src 'steal'）で全品
//     通常の落とし物・通常の盗み（drops.normal）= ティア 9 の通常品の装備（天鋼・天馬革・虹絹… 22 品。店には並ばない）
//   率はクリア後だけ下がる（K.DROP.post: レア 1/16 → 1/24、超レアは半分）。終章（T8）の通常の枠は装備を出さない（消耗品のまま）
(function (R) {
  'use strict';
  const N = (id) => R.T('items.' + id + '.name');
  const W = (id, wtype, grade, o) => Object.assign({ name: N(id), slot: 'weapon', wtype, grade, icon: wtype, fixedTier: true }, o);
  const A = (id, slot, weight, grade, o) => Object.assign({ name: N(id), slot, weight, grade, fixedTier: true,
    icon: { shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots' }[slot] }, o);
  const C = (id, grade, o) => Object.assign({ name: N(id), slot: 'acc', grade, icon: 'ring', fixedTier: true }, o);
  // レア 11（src 'mdrop'）・超レア 12（src 'super' = 落とし物、'steal' = 盗み専用）
  const R11 = { tier: 11, src: 'mdrop' };
  const S12 = { tier: 12, valueTier: 13, src: 'super' };
  const ST12 = { tier: 12, valueTier: 13, src: 'steal', stealOnly: true };
  const ALL_BAD = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'death'];

  const ITEMS = {
    // ---------------------------------------------------------------- 武器 レア 11
    w_sword_p11: W('w_sword_p11', 'sword', 'rare', Object.assign({ units: 's2', element: 'fire', mods: { physPct: 10 } }, R11)),
    w_greatsword_p11: W('w_greatsword_p11', 'greatsword', 'rare', Object.assign({ units: 's2', vs: { spirit: 1.5, undead: 1.5 }, mods: { physPct: 10 } }, R11)),
    w_dagger_p11: W('w_dagger_p11', 'dagger', 'rare', Object.assign({ units: 'd2', crit: 15, onHit: { status: 'silence', chance: 0.25 } }, R11)),
    w_bow_p11: W('w_bow_p11', 'bow', 'rare', Object.assign({ units: 'd2', hit: 10, mods: { spd: 8 } }, R11)),
    w_staff_p11: W('w_staff_p11', 'staff', 'rare', Object.assign({ units: 'm2', magMult: 0.9, mods: { healPct: 25, mpRegen: 2 } }, R11)),
    // ---------------------------------------------------------------- 武器 超レア 12（13 の強さ）
    w_sword_p12: W('w_sword_p12', 'sword', 'super', Object.assign({ units: 's2', element: 'light', crit: 10, mods: { physPct: 20, startBuffs: { atk: 1 } } }, S12)),
    w_greatsword_p12: W('w_greatsword_p12', 'greatsword', 'super', Object.assign({ units: 's2', crit: 15, vs: { demon: 1.5, undead: 1.5, spirit: 1.5 }, mods: { physPct: 20 } }, S12)),
    w_dagger_st_p12: W('w_dagger_st_p12', 'dagger', 'super', Object.assign({ units: 'd2', crit: 25, onHit: { status: 'stun', chance: 0.25 }, mods: { spd: 15 } }, ST12)),
    w_bow_st_p12: W('w_bow_st_p12', 'bow', 'super', Object.assign({ units: 'd2', element: 'light', hit: 10, crit: 10, mods: { physPct: 15, preemptPct: 15 } }, ST12)),
    w_staff_p12: W('w_staff_p12', 'staff', 'super', Object.assign({ units: 'i2', mods: { magicPct: 25, mpCostPct: -25, mpRegen: 3 } }, S12)),

    // ---------------------------------------------------------------- 防具 レア 11: 重装 灯台守・軽装 夜渡り・布 月灯り
    sh_p11_heavy: A('sh_p11_heavy', 'shield', 'heavy', 'rare', Object.assign({ units: 'sv', mods: { elemResist: { water: 0.5, wind: 0.5 } } }, R11)),
    hd_p11_heavy: A('hd_p11_heavy', 'head', 'heavy', 'rare', Object.assign({ units: 'sv', mods: { statusResist: { stun: 0.5, paralyze: 0.5 } } }, R11)),
    bd_p11_heavy: A('bd_p11_heavy', 'body', 'heavy', 'rare', Object.assign({ units: 'sv', mods: { hpPct: 10 } }, R11)),
    hn_p11_heavy: A('hn_p11_heavy', 'hands', 'heavy', 'rare', Object.assign({ units: 'sv', mods: { physPct: 8 } }, R11)),
    ft_p11_heavy: A('ft_p11_heavy', 'feet', 'heavy', 'rare', Object.assign({ units: 'sv', mods: { statusResist: { sleep: 0.5, confuse: 0.5 } } }, R11)),
    sh_p11_light: A('sh_p11_light', 'shield', 'light', 'rare', Object.assign({ units: 'da', mods: { elemResist: { dark: 0.5 }, eva: 5 } }, R11)),
    hd_p11_light: A('hd_p11_light', 'head', 'light', 'rare', Object.assign({ units: 'da', mods: { hit: 10, statusResist: { blind: 0.5 } } }, R11)),
    bd_p11_light: A('bd_p11_light', 'body', 'light', 'rare', Object.assign({ units: 'da', mods: { spd: 8, hpPct: 5 } }, R11)),
    hn_p11_light: A('hn_p11_light', 'hands', 'light', 'rare', Object.assign({ units: 'da', mods: { crit: 8, stealPct: 20 } }, R11)),
    ft_p11_light: A('ft_p11_light', 'feet', 'light', 'rare', Object.assign({ units: 'da', mods: { spd: 10, preemptPct: 10 } }, R11)),
    sh_p11_cloth: A('sh_p11_cloth', 'shield', 'cloth', 'rare', Object.assign({ units: 'im', mods: { magicPct: 10 } }, R11)),
    hd_p11_cloth: A('hd_p11_cloth', 'head', 'cloth', 'rare', Object.assign({ units: 'im', mods: { mpPct: 10, statusResist: { silence: 0.5 } } }, R11)),
    bd_p11_cloth: A('bd_p11_cloth', 'body', 'cloth', 'rare', Object.assign({ units: 'im', mods: { mpRegen: 2 } }, R11)),
    hn_p11_cloth: A('hn_p11_cloth', 'hands', 'cloth', 'rare', Object.assign({ units: 'im', mods: { healPct: 15 } }, R11)),
    ft_p11_cloth: A('ft_p11_cloth', 'feet', 'cloth', 'rare', Object.assign({ units: 'im', mods: { mpCostPct: -10 } }, R11)),

    // ---------------------------------------------------------------- 防具 超レア 12: 重装 大灯火・軽装 流星（盗み専用）・布 追憶
    sh_p12_heavy: A('sh_p12_heavy', 'shield', 'heavy', 'super', Object.assign({ units: 'sv', mods: { takenPct: -10, elemResist: { light: 0.5, dark: 0.5 } } }, S12)),
    hd_p12_heavy: A('hd_p12_heavy', 'head', 'heavy', 'super', Object.assign({ units: 'sv', mods: { statusImmune: ['stun', 'paralyze', 'confuse'] } }, S12)),
    bd_p12_heavy: A('bd_p12_heavy', 'body', 'heavy', 'super', Object.assign({ units: 'sv', mods: { hpPct: 20, regen: true } }, S12)),
    hn_p12_heavy: A('hn_p12_heavy', 'hands', 'heavy', 'super', Object.assign({ units: 'sv', mods: { physPct: 15, crit: 10 } }, S12)),
    ft_p12_heavy: A('ft_p12_heavy', 'feet', 'heavy', 'super', Object.assign({ units: 'sv', mods: { hpPct: 10, startBuffs: { def: 1 } } }, S12)),
    sh_st_p12_light: A('sh_st_p12_light', 'shield', 'light', 'super', Object.assign({ units: 'da', mods: { eva: 10, autoCounter: 0.25 } }, ST12)),
    hd_st_p12_light: A('hd_st_p12_light', 'head', 'light', 'super', Object.assign({ units: 'da', mods: { crit: 12, hit: 10 } }, ST12)),
    bd_st_p12_light: A('bd_st_p12_light', 'body', 'light', 'super', Object.assign({ units: 'da', mods: { spd: 15, eva: 8 } }, ST12)),
    hn_st_p12_light: A('hn_st_p12_light', 'hands', 'light', 'super', Object.assign({ units: 'da', mods: { autoSteal: 50, stealPct: 30 } }, ST12)),
    ft_st_p12_light: A('ft_st_p12_light', 'feet', 'light', 'super', Object.assign({ units: 'da', mods: { spd: 20, preemptPct: 20 } }, ST12)),
    sh_p12_cloth: A('sh_p12_cloth', 'shield', 'cloth', 'super', Object.assign({ units: 'im', mods: { magicPct: 20, mpCostPct: -15 } }, S12)),
    hd_st_p12_cloth: A('hd_st_p12_cloth', 'head', 'cloth', 'super', Object.assign({ units: 'im', mods: { statusImmune: ['silence', 'sleep'], mpPct: 15 } }, ST12)),
    bd_p12_cloth: A('bd_p12_cloth', 'body', 'cloth', 'super', Object.assign({ units: 'im', mods: { mpRegen: 3, hpPct: 10 } }, S12)),
    hn_p12_cloth: A('hn_p12_cloth', 'hands', 'cloth', 'super', Object.assign({ units: 'im', mods: { healPct: 25, magicPct: 10 } }, S12)),
    ft_st_p12_cloth: A('ft_st_p12_cloth', 'feet', 'cloth', 'super', Object.assign({ units: 'im', mods: { mpCostPct: -20, spd: 8 } }, ST12)),

    // ---------------------------------------------------------------- アクセサリ レア 11・超レア 12
    ac_p11_ember: C('ac_p11_ember', 'rare', Object.assign({ units: 'v1', mods: { autoRevive: 0.3, hpPct: 10 } }, R11)),
    ac_p11_compass: C('ac_p11_compass', 'rare', Object.assign({ units: 'd1', mods: { hit: 10, crit: 10, preemptPct: 15 } }, R11)),
    ac_p11_lantern: C('ac_p11_lantern', 'rare', Object.assign({ units: 'a1', mods: { rarePct: 25, superPct: 25 } }, R11)),
    ac_p11_letter: C('ac_p11_letter', 'rare', Object.assign({ units: 'm1', mods: { glimPct: { tech: 20, spell: 20 } } }, R11)),
    // 星結びの組ひも: あらゆる状態異常（毒〜即死の 10）が効かない（statusImmune。戦闘の側は statusImmune を 1 として防ぐ）
    ac_st_p12_braid: C('ac_st_p12_braid', 'super', Object.assign({ units: 'm1', mods: { statusImmune: ALL_BAD.slice() }, desc: R.T('items.ac_st_p12_braid.desc') }, ST12)),
    ac_st_p12_wick: C('ac_st_p12_wick', 'super', Object.assign({ units: 's1', mods: { physPct: 20, magicPct: 20 } }, ST12)),
    ac_st_p12_bookmark: C('ac_st_p12_bookmark', 'super', Object.assign({ units: 'm1', mods: { mpRegen: 3, regen: true } }, ST12)),
    ac_p12_morning: C('ac_p12_morning', 'super', Object.assign({ units: 'v1', mods: { autoRevive: 0.6, hpPct: 15, startBuffs: { agi: 1 } } }, S12)),
  };
  R.defs('items', ITEMS);

  // ---------------------------------------------------------------- 忘却の底の魔物の枠（R.onData。pools.js の印付け・「どの魔物も落とさない品」の計算より前に走る）
  //   [通常の落とし物（ティア 9 の通常品）, レアの落とし物, 盗みのレア, 超レアの落とし物, 盗み専用（超レア）]。null = 今のまま
  //   レア魔物・ボスは今の品（遺物・円環竜の品など）を残し、空いた盗みの枠にだけ足す
  const LOOT = {
    void_1: ['w_sword_9'], void_2: ['hd_helm_9'], chaos_1: ['w_greatsword_maul_9'], chaos_2: ['hn_gauntlet_9'], demon_2: ['sh_buckler_9'],
    void_3: ['bd_mail_9', 'bd_p11_heavy', 'w_sword_p11', 'sh_p12_heavy', 'hd_st_p12_light'],
    chaos_3: ['w_greatsword_9', 'sh_p11_heavy', 'w_greatsword_p11', 'w_greatsword_p12', 'bd_st_p12_light'],
    demon_3: ['ft_greave_9', 'ac_p11_letter', 'ac_p11_ember', 'w_sword_p12', null],
    jelly_5: ['ft_sandal_9', 'bd_p11_cloth', 'ft_p11_cloth', 'bd_p12_cloth', 'ft_st_p12_cloth'],
    bat_5: ['w_dagger_9', 'hd_p11_light', 'w_dagger_p11', 'ac_p12_morning', 'w_dagger_st_p12'],
    bee_5: ['hn_glove_9', 'hn_p11_light', 'ft_p11_light', 'hn_p12_cloth', 'hn_st_p12_light'],
    plant_5: ['w_staff_prayer_9', 'w_staff_p11', 'hn_p11_cloth', 'ac_p12_morning', 'ac_st_p12_bookmark'],
    scorpion_5: ['sh_shield_9', 'sh_p11_light', 'hn_p11_heavy', 'hn_p12_heavy', 'sh_st_p12_light'],
    mummy_5: ['hn_longglove_9', 'hd_p11_cloth', 'ac_p11_letter', 'w_staff_p12', null],
    wolf_5: ['bd_vest_9', 'w_greatsword_p11', 'bd_p11_light', 'w_greatsword_p12', null],
    frostling_5: ['hd_hood_9', 'ft_p11_heavy', 'sh_p11_cloth', 'ft_p12_heavy', 'ft_st_p12_light'],
    ghost_5: ['bd_robe_9', 'ac_p11_lantern', 'hd_p11_cloth', 'sh_p12_cloth', 'hd_st_p12_cloth'],
    skeleton_5: ['ft_boots_9', 'hd_p11_heavy', 'ac_p11_compass', 'w_sword_p12', null],
    goblin_5: ['hd_cap_9', 'w_sword_p11', 'sh_p11_heavy', 'hd_p12_heavy', null],
    salamander_5: ['w_staff_9', 'ac_p11_ember', 'bd_p11_heavy', 'bd_p12_heavy', 'ac_st_p12_wick'],
    imp_5: ['sh_book_9', 'sh_p11_cloth', 'w_bow_p11', 'hn_p12_cloth', null],
    eyeball_5: ['w_bow_9', 'w_bow_p11', 'ac_p11_compass', 'sh_p12_heavy', null],
    rm_memory_fish: [null, null, 'ac_p11_lantern', null, 'w_bow_st_p12'],
    rm_dream_tapir: [null, null, 'w_dagger_p11', null, null],
    b_valzard_echo: [null, null, 'hd_p11_heavy', null, 'ac_st_p12_braid'],
    b_ouroboros: [null, null, 'w_staff_p11', null, null],
  };
  R.Postclear = { ITEMS: Object.keys(ITEMS), LOOT };
  R.onData(function postclearLoot() {
    const M = R.DB.monsters;
    for (const [mid, row] of Object.entries(LOOT)) {
      const m = M[mid];
      if (!m) { R.warn('items_postclear: unknown monster ' + mid); continue; }
      const d = (m.drops = Object.assign({}, m.drops || {}));
      const [nItem, rDrop, rSteal, sDrop, stOnly] = row;
      if (nItem) d.normal = Object.assign({}, d.normal || {}, { item: nItem, rate: (d.normal && d.normal.rate) || 8 });
      if (rDrop || rSteal) {
        const r = Object.assign({ rate: 16 }, d.rare || {});
        if (rDrop) r.item = rDrop;
        if (rSteal) r.steal = rSteal;
        if (!r.item) r.item = rSteal;
        d.rare = r;
      }
      if (sDrop) d.super = Object.assign({ rate: 256 }, d.super || {}, { item: sDrop });
      if (stOnly) {
        const boss = /^b_/.test(mid) || (m.flags || []).includes('boss');
        d.steal = { item: stOnly, rate: boss ? 16 : /^rm_/.test(mid) ? 12 : 16 };
        if (R.DB.stealSources) R.DB.stealSources[stOnly] = { mon: mid, rate: d.steal.rate };
      }
    }
  });
})(window.RPG);
