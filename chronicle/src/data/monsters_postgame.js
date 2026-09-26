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
      name: '虚無の騎士', sprite: 'void_1', lineage: 'void', stage: 1, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.25, atk: 0.43, mag: 0.41 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_curse', w: 1 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_void_shard', rate: 32 }, super: { item: 'w_sword_sr_void', rate: 256 } },
      desc: '名を忘れられた騎士の成れの果て。\n鎧の中は星のない夜。',
    },
    void_2: {
      name: '虚無の騎士団長', sprite: 'void_2', lineage: 'void', stage: 2, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.88, atk: 0.42, mag: 0.4 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [3, 2] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'ac_void_shard', rate: 32 }, super: { item: 'bd_sr_oblivion', rate: 256 } },
      desc: '虚無の騎士たちを率いる団長。\n守りの力を打ち消してくる。',
    },
    void_3: {
      name: '虚無の騎士王', sprite: 'void_3', lineage: 'void', stage: 3, lv: 61, size: 'm', race: 'spirit', affinity: 'dark',
      flags: [], s: { hp: 2.27, atk: 0.59, mag: 0.57 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 0.75, pierce: 0.75 }, statusRes: { poison: 1, death: 1, stun: 1 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_void_wave', w: 2 }, { id: 'e_death_word', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [3, 1] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'hd_void_helm', rate: 32 }, super: { item: 'sh_sr_void_aegis', rate: 256 } },
      desc: '忘れられた王国の最後の王。\n虚無の騎士たちがひざまずく。',
    },
    // ---- chaos 混沌獣（獣・l）: 忘れられた恐れが寄り集まった獣。3 段目の祖獣は大地を揺らし、気合いをこめて暴れる。
    chaos_1: {
      name: '混沌の獣', sprite: 'chaos_1', lineage: 'chaos', stage: 1, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.14, atk: 0.46, mag: 0.38, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 3 }, { id: 'e_rampage', w: 2 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }, { id: 'e_chaos_breath', w: 2 }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'w_greatsword_chaoshorn', rate: 32 }, super: { item: 'w_axe_sr_chaos', rate: 256 } },
      desc: '七つの目をもつ混沌の獣。\n恐れの形が集まってできた。',
    },
    chaos_2: {
      name: '混沌の王獣', sprite: 'chaos_2', lineage: 'chaos', stage: 2, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 2.04, atk: 0.51, mag: 0.45, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_chaos_breath', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'w_greatsword_chaoshorn', rate: 32 }, super: { item: 'bd_sr_chaos_hide', rate: 256 } },
      desc: '冠のような角をもつ混沌の王。\n忘却の底の奥深くにひそむ。',
    },
    chaos_3: {
      name: '混沌の祖獣', sprite: 'chaos_3', lineage: 'chaos', stage: 3, lv: 61, size: 'l', race: 'beast', affinity: 'dark',
      flags: [], s: { hp: 1.89, atk: 0.48, mag: 0.44, agi: 0.9 }, eva: 5,
      elem: { fire: 1.25, light: 1.5, dark: 0.25 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_rampage', w: 2 }, { id: 'e_chaos_breath', w: 2 }, { id: 'e_quake', w: 1 }, { id: 'e_roar', w: 1, cond: { every: [4, 1] } }, { id: 'e_focus', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'ac_chaos_eye', rate: 32 }, super: { item: 'hn_sr_chaos_claw', rate: 256 } },
      desc: 'すべての混沌の獣の祖という。\n忘却の底でいちばん古い恐れ。',
    },
  });
})(window.RPG);
