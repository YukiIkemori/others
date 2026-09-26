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
      name: '白衣の書記', goldName: '金衣の書記', sprite: 'scribe_1', lineage: 'scribe', stage: 1, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { mag: 2.01, mdef: 1.2, hp: 1.57, atk: 1.69 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 2 }, { id: 'e_transcribe', w: 2 }, { id: 'e_ink', w: 2 }, { id: 'e_light_ray', w: 1 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'hd_scribe_hood', rate: 32 }, super: { item: 'ac_sr_ink', rate: 128 } },
      desc: '記録院の白衣の書記。\n相手の力を書き写して消す。',
    },
    scribe_2: {
      name: '白衣の写本師', goldName: '金衣の写本師', sprite: 'scribe_2', lineage: 'scribe', stage: 2, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { hp: 1.6, mag: 2.5, mdef: 1.25, atk: 2.5 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_transcribe', w: 2 }, { id: 'e_forget', w: 2 }, { id: 'e_heal_ally', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_ward', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'bd_scribe_coat', rate: 32 }, super: { item: 'hn_sr_words', rate: 128 } },
      desc: '白の書を写し続ける写本師。\nふれた記憶を奪っていく。',
    },
    scribe_3: {
      name: '白衣の司書長', goldName: '金衣の司書長', sprite: 'scribe_3', lineage: 'scribe', stage: 3, lv: 55, size: 'm', race: 'humanoid', affinity: 'light',
      flags: [], s: { hp: 1.61, mag: 1.88, mdef: 1.3, atk: 1.46 }, eva: 5,
      elem: { light: 0.25, dark: 1.5 }, phys: {}, statusRes: {},
      actions: [{ id: 'attack', w: 1 }, { id: 'e_forget', w: 2 }, { id: 'e_erase_all', w: 1, cond: { every: [3, 1] } }, { id: 'e_light_ray', w: 2 }, { id: 'e_heal_all', w: 1, cond: { hpBelow: 0.6 } }, { id: 'e_call_lesser', w: 1, cond: { countBelow: 5 } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_archive_key', rate: 32 }, super: { item: 'ac_sr_needle', rate: 128 } },
      desc: '大書庫を取りしきる司書長。\n書記たちを呼び集める。',
    },
    // ---- book 魔書（魔造・s）: 大書庫の本が魔物になったもの。紙なので火に弱い。
    book_1: {
      name: 'かみつき本', sprite: 'book_1', lineage: 'book', stage: 1, lv: 55, size: 's', race: 'construct',
      flags: [], s: { hp: 2.5, atk: 0.49, agi: 1.1, mag: 0.49 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_bite', w: 2 }, { id: 'e_paper_cut', w: 2 }],
      drops: { normal: { item: 'i_potion', rate: 8 }, rare: { item: 'hd_scribe_hood', rate: 32 }, super: { item: 'sh_sr_blank', rate: 128 } },
      desc: '表紙を口のように開く本。\n読もうとするとかみつく。',
    },
    book_2: {
      name: '呪いの書', sprite: 'book_2', lineage: 'book', stage: 2, lv: 55, size: 's', race: 'construct', affinity: 'dark',
      flags: [], s: { mag: 0.92, mdef: 1.2, hp: 2.41, atk: 0.72 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75, light: 1.5, dark: 0.25 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_curse', w: 2 }, { id: 'e_dark_bolt', w: 2 }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_panacea', rate: 8 }, rare: { item: 'bd_scribe_coat', rate: 32 }, super: { item: 'w_staff_sr_moon', rate: 128 } },
      desc: '鎖でしばられた呪いの書。\n読んだ者の声を奪う。',
    },
    book_3: {
      name: '白紙の書', goldName: '金紙の書', sprite: 'book_3', lineage: 'book', stage: 3, lv: 55, size: 's', race: 'construct', affinity: 'light',
      flags: [], s: { hp: 2.5, mag: 0.78, mdef: 1.3, atk: 0.59 }, eva: 5,
      elem: { fire: 1.5, water: 1.25, wind: 0.75, light: 0.25, dark: 1.5 }, phys: { slash: 0.75, blunt: 1.5, pierce: 0.75 }, statusRes: { poison: 1, sleep: 1, confuse: 1, death: 1 },
      actions: [{ id: 'attack', w: 1 }, { id: 'e_forget', w: 3 }, { id: 'e_erase_all', w: 1, cond: { every: [3, 0] } }, { id: 'e_light_ray', w: 2 }],
      drops: { normal: { item: 'i_ether2', rate: 8 }, rare: { item: 'ac_archive_key', rate: 32 }, super: { item: 'w_staff_sr_cosmos', rate: 128 } },
      desc: '文字が一つもない白い本。\nふれた記憶を白紙にする。',
    },
    // ---- demon 魔神（魔族・l）: 海の向こうの伝説に語られた魔王の軍勢の、忘れられた影。
    demon_1: {
      name: '忘れられた魔兵', sprite: 'demon_1', lineage: 'demon', stage: 1, lv: 55, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 2.1, atk: 0.81, mag: 0.73 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_fire_rain', w: 1 }, { id: 'e_howl', w: 1, cond: { once: true } }],
      drops: { normal: { item: 'i_elixir', rate: 8 }, rare: { item: 'ac_archive_key', rate: 32 }, super: { item: 'ac_sr_bloodoath', rate: 128 } },
      desc: '伝説の魔王の兵の影。\n名も顔も忘れられている。',
    },
    demon_2: {
      name: '忘れられた魔将', sprite: 'demon_2', lineage: 'demon', stage: 2, lv: 61, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 2.07, atk: 0.84, def: 1.15, mag: 0.67 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 3 }, { id: 'e_dark_slash', w: 2 }, { id: 'e_sweep', w: 2 }, { id: 'e_gloom', w: 1 }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'ac_void_shard', rate: 32 }, super: { item: 'hd_sr_demon_general', rate: 256 } },
      desc: '魔王軍の将だった影。\n三百年たっても剣を振るう。',
    },
    demon_3: {
      name: '忘れられた魔神', sprite: 'demon_3', lineage: 'demon', stage: 3, lv: 61, size: 'l', race: 'demon', affinity: 'dark',
      flags: [], s: { hp: 1.79, atk: 0.31, mag: 0.31 }, eva: 5,
      elem: { light: 1.5, dark: 0.25 }, phys: {}, statusRes: { death: 0.8 },
      actions: [{ id: 'attack', w: 2 }, { id: 'e_dark_mist', w: 2 }, { id: 'e_inferno_breath', w: 1 }, { id: 'e_death_word', w: 1 }, { id: 'e_gloom', w: 1 }, { id: 'e_dispel', w: 1, cond: { every: [4, 3] } }],
      drops: { normal: { item: 'i_phoenix', rate: 8 }, rare: { item: 'w_greatsword_chaoshorn', rate: 32 }, super: { item: 'ac_sr_demon_eye', rate: 256 } },
      desc: '第三の眼をもつ魔神の影。\n恐れの記憶だけで動いている。',
    },
  });
})(window.RPG);
