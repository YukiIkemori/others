// RULES・EVENTS（砂漠）: ザハラ砂漠の大事な物・一品物・戦闘で使う王の名（WORLD_REDESIGN §4.2・§2.7・§2.8・§4.9、STORY_BIBLE §7.2）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）、
//   王の名の記し i_desert_kingname（戦闘の中で「使う」と名を呼ぶ。bosses_desert.js の special desert_call_name）。
//   宝の地図は地方をまたぐ手がかり（§2.8）: 行き先の寄り道はまだ無い地方の中なので、行き先は data（map・hint）として持つだけ。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_desert_glyph_ha: K(R.T('data.items_desert.KEYS.k_desert_glyph_ha.K'), R.T('data.items_desert.KEYS.k_desert_glyph_ha.K_2'), { icon: 'gem' }),
    k_desert_glyph_za: K(R.T('data.items_desert.KEYS.k_desert_glyph_za.K'), R.T('data.items_desert.KEYS.k_desert_glyph_za.K_2'), { icon: 'gem' }),
    k_desert_glyph_ru: K(R.T('data.items_desert.KEYS.k_desert_glyph_ru.K'), R.T('data.items_desert.KEYS.k_desert_glyph_ru.K_2'), { icon: 'gem' }),
    k_desert_oil: K(R.T('data.items_desert.KEYS.k_desert_oil.K'), R.T('data.items_desert.KEYS.k_desert_oil.K_2'), { icon: 'lamp' }),
    k_desert_anklet: K(R.T('data.items_desert.KEYS.k_desert_anklet.K'), R.T('data.items_desert.KEYS.k_desert_anklet.K_2'), { icon: 'ring' }),
    k_desert_dates: K(R.T('data.items_desert.KEYS.k_desert_dates.K'), R.T('data.items_desert.KEYS.k_desert_dates.K_2'), { icon: 'bag' }),
    k_desert_salt: K(R.T('data.items_desert.KEYS.k_desert_salt.K'), R.T('data.items_desert.KEYS.k_desert_salt.K_2'), { icon: 'bag' }),
    k_desert_camel_rope: K(R.T('data.items_desert.KEYS.k_desert_camel_rope.K'), R.T('data.items_desert.KEYS.k_desert_camel_rope.K_2'), { icon: 'bag' }),
    k_desert_shovel: K(R.T('data.items_desert.KEYS.k_desert_shovel.K'), R.T('data.items_desert.KEYS.k_desert_shovel.K_2'), { icon: 'search' }),
    k_tmap_3: K(R.T('data.items_desert.KEYS.k_tmap_3.K'), R.T('data.items_desert.KEYS.k_tmap_3.K_2'), { icon: 'map', tmap: { n: 3, place: 'ash_battlefield', region: 'r_ash', hint: R.T('data.items_desert.KEYS.k_tmap_3.tmap.hint') } }),
    k_tmap_5: K(R.T('data.items_desert.KEYS.k_tmap_5.K'), R.T('data.items_desert.KEYS.k_tmap_5.K_2'), { icon: 'map', tmap: { n: 5, place: 'ship_graveyard', region: 'world', hint: R.T('data.items_desert.KEYS.k_tmap_5.tmap.hint') } }),
    k_tmap_6: K(R.T('data.items_desert.KEYS.k_tmap_6.K'), R.T('data.items_desert.KEYS.k_tmap_6.K_2'), { icon: 'map', tmap: { n: 6, place: 'storm_eye', region: 'world', needs: 'k_star_shard', hint: R.T('data.items_desert.KEYS.k_tmap_6.tmap.hint') } }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9400 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // 王の名（戦闘の中で使う。第 2 の姿の後でなければ戻る）
    i_desert_kingname: { name: R.T('items.i_desert_kingname.name'), slot: 'use', grade: 'normal', tier: 0, price: 0, src: 'key', icon: 'journal', sort: 9390,
      desc: R.T('items.i_desert_kingname.desc'),
      use: { target: 'enemy', effects: [{ type: 'special', id: 'desert_call_name' }], fx: 'holy', battle: true, field: false } },
    // 砂の鷹団（どの選択でも同じ品にたどり着く: 敵なら頭との戦いの宝箱、味方なら頭の礼、払ったならアジトの店で買う）
    u_hawk_gloves: U('hands', R.T('items.u_hawk_gloves.hands'), { weight: 'light', units: 'd1', mult: 1.2, mods: { stealPct: 20, spd: 2 }, icon: 'glove',
      desc: R.T('items.u_hawk_gloves.hands.desc') }),
    // 砂に沈んだ神殿（#6）
    u_sun_staff: U('weapon', R.T('items.u_sun_staff.weapon'), { wtype: 'staff', units: 's1v1', mult: 1.35, mods: { elemBoost: { fire: 15, light: 15 } }, icon: 'staff',
      desc: R.T('items.u_sun_staff.weapon.desc') }),
    // 依頼の礼
    u_nadia_bell: U('acc', R.T('items.u_nadia_bell.acc'), { mods: { spd: 4, escapePct: 15 }, icon: 'ring', desc: R.T('items.u_nadia_bell.acc.desc') }),
    u_signal_mirror: U('acc', R.T('items.u_signal_mirror.acc'), { mods: { encounterPct: -10, escapePct: 15 }, icon: 'ring', desc: R.T('items.u_signal_mirror.acc.desc') }),
    u_caravan_scarf: U('head', R.T('items.u_caravan_scarf.head'), { weight: 'light', mods: { statusResist: { blind: 0.5 }, hpPct: 4 }, icon: 'helm', desc: R.T('items.u_caravan_scarf.head.desc') }),
    u_well_charm: U('acc', R.T('items.u_well_charm.acc'), { mods: { hpPct: 5, statusResist: { poison: 0.5 } }, icon: 'ring', desc: R.T('items.u_well_charm.acc.desc') }),
    // しんきろうの市（#8、ティアで入れ替わる 3 品 × 2 段。代金は市の人がティアで決める）
    u_mirage_lamp: U('acc', R.T('items.u_mirage_lamp.acc'), { mods: { mpRegen: 1 }, icon: 'ring', desc: R.T('items.u_mirage_lamp.acc.desc') }),
    u_mirage_veil: U('body', R.T('items.u_mirage_veil.body'), { weight: 'cloth', units: 'a1', mods: { statusResist: { confuse: 0.5 } }, icon: 'armor', desc: R.T('items.u_mirage_veil.body.desc') }),
    u_mirage_dagger: U('weapon', R.T('items.u_mirage_dagger.weapon'), { wtype: 'dagger', units: 'd1', mult: 1.25, crit: 6, icon: 'dagger', desc: R.T('items.u_mirage_dagger.weapon.desc') }),
    u_mirage_harp: U('acc', R.T('items.u_mirage_harp.acc'), { mods: { glimPct: { spell: 12 } }, icon: 'ring', desc: R.T('items.u_mirage_harp.acc.desc') }),
    u_mirage_boots: U('feet', R.T('items.u_mirage_boots.feet'), { weight: 'light', units: 'a1', mods: { spd: 5, encounterPct: -5 }, icon: 'boots', desc: R.T('items.u_mirage_boots.feet.desc') }),
    u_mirage_bow: U('weapon', R.T('items.u_mirage_bow.weapon'), { wtype: 'bow', units: 'd2', mult: 1.3, hit: 6, icon: 'bow', desc: R.T('items.u_mirage_bow.weapon.desc') }),
  });

  // 宝の地図の行き先（地方をまたぐ手がかり。まだ無い寄り道は data だけ。WORLD_REDESIGN §2.8）
  R.DesertData = Object.assign(R.DesertData || {}, {
    treasureMaps: {
      k_tmap_3: { from: R.T('data.items_desert.DesertData.treasureMaps.k_tmap_3.from'), to: 'ash_battlefield', built: false },
      k_tmap_5: { from: R.T('data.items_desert.DesertData.treasureMaps.k_tmap_5.from'), to: 'ship_graveyard', built: false },
      k_tmap_6: { from: R.T('data.items_desert.DesertData.treasureMaps.k_tmap_6.from'), to: 'storm_eye', built: false, needs: 'k_star_shard' },
    },
    mirage: { low: ['u_mirage_lamp', 'u_mirage_veil', 'u_mirage_dagger'], high: ['u_mirage_harp', 'u_mirage_boots', 'u_mirage_bow'] },
  });
})(window.RPG);
