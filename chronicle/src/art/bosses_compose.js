// Boss sprite assembly (DESIGN §9.11.6, owner art-boss A15a).
//
// 1. MON_COMPOSE_BOSSES — the 14 boss sprites built from existing art: a base
//    sprite, an {hue, sat, bri} recolour, parts and an optional filter, exactly
//    the normative table of §9.11.6. Merged one by one into R.Art.MON_COMPOSE
//    (shared with the mob table of art-mons, §9.4.6: never assign it, warn on a
//    duplicate id and keep the first). Each id is registered as 'mon:<id>'; the
//    factory calls R.Art.compose at build time, so load order does not matter.
// 2. BOSS_SPRITES — boss monster id → sprite id (the 絵 column of §9.11.4, plus
//    the phase sprite of the lava beast). The sprite keys are drawn in
//    bosses.js / bosses_b.js / above; for every boss whose id differs from its
//    sprite, 'mon:<bossId>' is registered as an alias so the bestiary and any
//    code that draws 'mon:<monster id>' get the same picture (§11.4.1).
(function (R) {
  'use strict';
  R.Art = R.Art || {};

  // ---------------------------------------------------------------- §9.11.6 (normative)
  const BOSSES = (R.Art.MON_COMPOSE_BOSSES = {
    // b_sandworm / b_sandking: only the hue differs from the §9.11.6 table (25 / 60 there). A hue
    // rotation of 25° turns the serpent's teal bluer and 60° turns the lich's purple robes crimson,
    // against the table's own description (teal → ochre with sand waves; purple → sand). −150 and 125
    // give the described looks (checked on the contact sheet); reported to the lead to fix the table.
    b_sandworm: ['boss_serpent', { hue: -150, sat: 0.7, bri: 1.05 }, []],
    b_sandking: ['boss_general_b', { hue: 125, sat: 0.6, bri: 1.1 }, []],
    b_doll_conductor: ['doll', { sat: 0.4, bri: 0.9 }, [['hat', { c: '#202020', style: 'tophat' }], ['cape', { c: '#202020', c2: '#c02030', style: 'tailcoat' }], ['baton', { c: '#f0f0f0' }]]],
    b_doll_violin: ['doll', { hue: 330, sat: 0.8 }, [['violin', { c: '#a05020' }], ['ribbon', { c: '#c02040' }]]],
    b_doll_drum: ['doll', { hue: 200, sat: 0.8 }, [['drum', { c: '#c03030' }], ['hat', { c: '#2040a0', style: 'shako' }]]],
    b_doll_flute: ['doll', { hue: 90, sat: 0.7 }, [['flute', { c: '#d0c080' }], ['flower', { c: '#ffe080' }]]],
    b_mist_double: ['ghost', { sat: 0.1, bri: 0.9 }, [['hood', { c: '#8890a0', style: 'witch' }]], 'shade'],
    b_octopus: ['kraken', { hue: 250, sat: 0.9, bri: 0.8 }, [['coral', { c: '#e08070' }], ['crown', { c: '#c0c0a0', style: 'barnacle' }]]],
    b_captain: ['boss_bandit', { hue: 170, sat: 0.45, bri: 1.1 }, []],
    b_rockeater: ['sandworm', { sat: 0.25, bri: 0.8 }, [['armor_plates', { c: '#707078', style: 'rock' }], ['crystals', { c: '#80e0ff' }]]],
    b_ironwarden: ['boss_general_a', { hue: 15, sat: 0.5, bri: 1.15 }, []],
    b_lavabeast_cold: ['boss_flame_lord', { sat: 0.35, bri: 0.55 }, []],
    b_rowell2: ['boss_rowell', { bri: 0.95 }, [['aura', { c: '#ffffff' }]]],
    b_valzard_echo: ['boss_demon_king', { sat: 0.2, bri: 0.85 }, [], 'shade'],
  });

  // ---------------------------------------------------------------- stand-in while art-mons' compose is missing
  // §9.14.1: until R.Art.compose exists, return the recoloured base (plus the
  // 'shade' filter, which the two ghostly bosses cannot do without). Parts are
  // skipped. The id is listed in R.Art.PENDING so the shot report counts it.
  const pending = {};
  function note(id) {
    if (pending[id]) return;
    pending[id] = 1;
    (R.Art.PENDING = R.Art.PENDING || []).push('mon:' + id);
  }
  /** §9.4.5 'shade': luminance → white/blue ramp, the inside half see-through (checker), light outline */
  function shadeFilter(cv) {
    const w = cv.width, h = cv.height;
    const out = R.Gfx.makeCanvas(w, h), c = out.getContext('2d');
    c.drawImage(cv, 0, 0);
    const img = c.getImageData(0, 0, w, h), d = img.data;
    const src = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x];
    const RAMP = [[0x40, 0x4c, 0x80], [0x6a, 0x7a, 0xb8], [0x9c, 0xac, 0xe0], [0xc8, 0xd4, 0xf4], [0xec, 0xf0, 0xff], [0xff, 0xff, 0xff]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, k = i * 4;
      if (!src[i]) { d[k + 3] = 0; continue; }
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      const l = (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
      let rgb;
      if (edge) rgb = [0xa0, 0xb0, 0xe0];
      else {
        const inner = on(x - 2, y) && on(x + 2, y) && on(x, y - 2) && on(x, y + 2);
        if (inner && (x + y) % 2) { d[k + 3] = 0; continue; }
        rgb = RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(l, 0.7) * RAMP.length))];
      }
      d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return out;
  }
  function standIn(id) {
    const e = BOSSES[id];
    note(id);
    let cv = R.Gfx.variant('mon:' + e[0], e[1]);
    if (Array.isArray(cv)) cv = cv[0];
    if (e[3] === 'shade') cv = shadeFilter(cv);
    return cv;
  }
  function build(id) {
    const e = BOSSES[id];
    if (!R.Art.compose) return standIn(id);
    let cv;
    // id: a stable seed, as art-mons passes for its rows
    try { cv = R.Art.compose(e[0], e[1], e[2], e[3] || null, id); } catch (err) { R.warn('MON_COMPOSE_BOSSES: compose failed', id, String(err && err.message || err)); return standIn(id); }
    if (Array.isArray(cv)) cv = cv[0];
    if (!cv || !cv.width) { R.warn('MON_COMPOSE_BOSSES: compose returned nothing', id); return standIn(id); }
    return cv;
  }
  R.Art.bossComposeStandIn = standIn; // for the contact sheet (compare with the real compose)

  for (const id in BOSSES) {
    if (R.Art.MON_COMPOSE && R.Art.MON_COMPOSE[id]) { R.warn('MON_COMPOSE: duplicate', id); continue; }
    (R.Art.MON_COMPOSE = R.Art.MON_COMPOSE || {})[id] = BOSSES[id];
    R.Gfx.def('mon:' + id, () => build(id));
  }

  // ---------------------------------------------------------------- boss id → sprite (§9.11.4 絵)
  const SPRITES = (R.Art.BOSS_SPRITES = {
    b_pageeater: 'boss_pageeater',
    b_moth: 'boss_moth',
    b_rooteater: 'boss_rooteater',
    b_root: 'boss_root',
    b_sandworm: 'b_sandworm',
    b_sandking: 'b_sandking',
    b_icegiant: 'boss_frost_giant',
    b_whitedragon: 'boss_whitedragon',
    b_doll_conductor: 'b_doll_conductor',
    b_doll_violin: 'b_doll_violin',
    b_doll_drum: 'b_doll_drum',
    b_doll_flute: 'b_doll_flute',
    b_mistbeast: 'boss_mistbeast',
    b_mist_double: 'b_mist_double',
    b_octopus: 'b_octopus',
    b_tentacle: 'boss_tentacle',
    b_captain: 'b_captain',
    b_rockeater: 'b_rockeater',
    b_ironwarden: 'b_ironwarden',
    b_hellhound: 'boss_hellhound',
    b_lavabeast: 'boss_flame_lord',
    b_orrery: 'boss_star_guardian',
    b_stareater: 'boss_stareater',
    b_rowell1: 'boss_rowell',
    b_rowell2: 'b_rowell2',
    b_bookgolem: 'boss_bookgolem',
    b_shade_sword: 'boss_shade_sword',
    b_shade_prayer: 'boss_shade_prayer',
    b_shade_star: 'boss_shade_star',
    b_lazaro: 'boss_lazaro',
    b_nemrea1: 'boss_nemrea1',
    b_nemrea2: 'boss_nemrea2',
    b_valzard_echo: 'b_valzard_echo',
    b_ouroboros: 'boss_ouroboros',
  });
  // sprites swapped in by a phase change (§9.11.1 set.sprite)
  R.Art.BOSS_PHASE_SPRITES = { b_lavabeast: ['b_lavabeast_cold'] };
  for (const id in SPRITES) {
    const key = SPRITES[id];
    if (key === id || R.Gfx.has('mon:' + id)) continue;
    R.Gfx.def('mon:' + id, () => R.Gfx.get('mon:' + key));
  }
})(window.RPG);
