// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_postgame.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: クリア後 忘却の底（虚無の騎士・混沌獣）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- void 虚無の騎士（霊体・m）: 忘れられた騎士たちの虚無。闇の剣と虚無の波。3 段目の騎士王は守りの力を消し、即死の言葉を放つ。
    void_1: {
      name: R.T('monsters.void_1.name'), sprite: 'void_1', lineage: 'void', stage: 1, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.25, atk: 0.43, mag: 0.41 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 } },
      desc: R.T('monsters.void_1.desc'),
    },
    void_2: {
      name: R.T('monsters.void_2.name'), sprite: 'void_2', lineage: 'void', stage: 2, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.88, atk: 0.42, mag: 0.4 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [3, 2] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 } },
      desc: R.T('monsters.void_2.desc'),
    },
    void_3: {
      name: R.T('monsters.void_3.name'), sprite: 'void_3', lineage: 'void', stage: 3, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.27, atk: 0.59, mag: 0.57 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [3, 1] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'hd_void_helm', rate: 32 }, super: { item: 'sh_sr_void_aegis', rate: 256 } },
      desc: R.T('monsters.void_3.desc'),
    },
    // ---- chaos 混沌獣（獣・l）: 忘れられた恐れが寄り集まった獣。3 段目の祖獣は大地を揺らし、気合いをこめて暴れる。
    chaos_1: {
      name: R.T('monsters.chaos_1.name'), sprite: 'chaos_1', lineage: 'chaos', stage: 1, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.14, atk: 0.46, mag: 0.38, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_rampage', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }, { id: 'e_chaos_breath', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 } },
      desc: R.T('monsters.chaos_1.desc'),
    },
    chaos_2: {
      name: R.T('monsters.chaos_2.name'), sprite: 'chaos_2', lineage: 'chaos', stage: 2, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.04, atk: 0.51, mag: 0.45, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_chaos_breath', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 } },
      desc: R.T('monsters.chaos_2.desc'),
    },
    chaos_3: {
      name: R.T('monsters.chaos_3.name'), sprite: 'chaos_3', lineage: 'chaos', stage: 3, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 1.89, atk: 0.35, mag: 0.32, agi: 0.9 }, actsPerTurn: 2,   // 2 回動く精鋭（w_combo）: 1 回の強さは 0.72 倍
      eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_chaos_breath', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'ac_chaos_eye', rate: 32 }, super: { item: 'hn_sr_chaos_claw', rate: 256 } },
      desc: R.T('monsters.chaos_3.desc'),
    },
  });
})(window.RPG);
