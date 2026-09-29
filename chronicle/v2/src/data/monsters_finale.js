// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/monsters_finale.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// ルミナス・クロニクル — 雑魚の魔物: 終盤 ビブリア島と白の大書庫（白衣の書記・魔書・魔神）
// 担当 A11 mons。正は DESIGN.md §9.5.2（系統と段）・§9.12（戦利品の割り当て）・§9.8（goldName）。
// 能力値の絶対値（hp atk mag def mdef agi exp gold）は書かない: R.Mon.fillStats（battle）が onData で
// 名目のレベル lv・大きさ size・倍率 s・報酬 rw から作る（§9.1.2）。eva は §9.2.3 の規則の値。
// 絵は mon:<id>（art-mons の MON_COMPOSE。§9.4.6）。hue/sat/bri は書かない（§9.0 の 0.6）。
(function (R) {
  'use strict';
  Object.assign(R.DB.monsters, {
    // ---- scribe 白衣の書記（人型・m）: 記録院の書記たち。白の書の力で相手の力と記憶を書き写して消す。
    scribe_1: {
      name: R.T('monsters.scribe_1.name'), goldName: R.T('monsters.scribe_1.goldName'), sprite: 'scribe_1', lineage: 'scribe', stage: 1, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { hp: 2.8, atk: 1.69, mag: 2.03, mdef: 1.2 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_transcribe', w: 2 }, { id: 'e_ink', w: 2 }, { id: 'e_light_ray', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 8 } },
      desc: R.T('monsters.scribe_1.desc'),
    },
    scribe_2: {
      name: R.T('monsters.scribe_2.name'), goldName: R.T('monsters.scribe_2.goldName'), sprite: 'scribe_2', lineage: 'scribe', stage: 2, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { hp: 2.71, atk: 2.64, mag: 3.3, mdef: 1.25 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_transcribe', w: 2 }, { id: 'e_forget', w: 2 }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_ether2', rate: 8 } },
      desc: R.T('monsters.scribe_2.desc'),
    },
    scribe_3: {
      name: R.T('monsters.scribe_3.name'), goldName: R.T('monsters.scribe_3.goldName'), sprite: 'scribe_3', lineage: 'scribe', stage: 3, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { hp: 2.06, atk: 1.35, mag: 1.75, mdef: 1.3 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_forget', w: 2 }, { id: 'e_erase_all', w: 1, cond: { every: [3, 1] } }, { id: 'e_light_ray', w: 2 }, { id: 'e_heal_all', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_archive_key', rate: 32 }, steal: { item: 'ac_st_librarian', rate: 32 } },
      desc: R.T('monsters.scribe_3.desc'),
    },
    // ---- book 魔書（魔造・s）: 大書庫の本が魔物になったもの。紙なので火に弱い。
    book_1: {
      name: R.T('monsters.book_1.name'), sprite: 'book_1', lineage: 'book', stage: 1, lv: 55, size: 's', race: 'construct',
      flags: [], s: { hp: 3.18, atk: 0.58, mag: 0.53, agi: 1.1 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_paper_cut', w: 2 }],
      drops: { normal: { item: 'i_potion2', rate: 8 } },
      desc: R.T('monsters.book_1.desc'),
    },
    book_2: {
      name: R.T('monsters.book_2.name'), sprite: 'book_2', lineage: 'book', stage: 2, lv: 55, size: 's', race: 'construct', affinity: 'dark',
      flags: [], s: { hp: 2.23, atk: 0.76, mag: 0.98, mdef: 1.2 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_curse', w: 2 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_panacea', rate: 8 } },
      desc: R.T('monsters.book_2.desc'),
    },
    book_3: {
      name: R.T('monsters.book_3.name'), goldName: R.T('monsters.book_3.goldName'), sprite: 'book_3', lineage: 'book', stage: 3, lv: 55, size: 's', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 2.68, atk: 0.58, mag: 0.75, mdef: 1.3 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_forget', w: 3 }, { id: 'e_erase_all', w: 1, cond: { every: [3, 0] } }, { id: 'e_light_ray', w: 2 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'ac_archive_key', rate: 32 }, super: { item: 'w_staff_sr_cosmos', rate: 128 } },
      desc: R.T('monsters.book_3.desc'),
    },
    // ---- demon 魔神（魔族・l）: 海の向こうの伝説に語られた魔王の軍勢の、忘れられた影。
    demon_1: {
      name: R.T('monsters.demon_1.name'), sprite: 'demon_1', lineage: 'demon', stage: 1, lv: 55, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 2.21, atk: 0.88, mag: 0.81 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_fire_rain', w: 1 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 } },
      desc: R.T('monsters.demon_1.desc'),
    },
    demon_2: {
      name: R.T('monsters.demon_2.name'), sprite: 'demon_2', lineage: 'demon', stage: 2, lv: 61, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 1.95, atk: 0.8, mag: 0.64, def: 1.15 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_sweep', w: 2 }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_phoenix', rate: 8 } },
      desc: R.T('monsters.demon_2.desc'),
    },
    demon_3: {
      name: R.T('monsters.demon_3.name'), sprite: 'demon_3', lineage: 'demon', stage: 3, lv: 61, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 2.22, atk: 0.71, mag: 0.71 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_inferno_breath', w: 1 }, { id: 'e_death_word', w: 1 }, { id: 'e_gloom', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [4, 3] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'w_greatsword_chaoshorn', rate: 32 }, super: { item: 'ac_sr_demon_eye', rate: 256 }, steal: { item: 'ac_st_demon_heart', rate: 32 } },
      desc: R.T('monsters.demon_3.desc'),
    },
  });
})(window.RPG);
