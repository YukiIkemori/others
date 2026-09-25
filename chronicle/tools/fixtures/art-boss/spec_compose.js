// DESIGN §9.11.6 boss compose table, transcribed verbatim (normative), for test_art-boss.js T1.
// FIXES: rows whose hsb the art deliberately differs from, with the reason (see bosses_compose.js
// and the A15a report): a hue rotation of 25° / 60° contradicts the table's own description.
'use strict';
const TABLE = {
  b_sandworm: ['boss_serpent', { hue: 25, sat: 0.7, bri: 1.05 }, []],
  b_sandking: ['boss_general_b', { hue: 60, sat: 0.6, bri: 1.1 }, []],
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
};
const FIXES = {
  b_sandworm: { hue: -150, sat: 0.7, bri: 1.05 }, // teal → ochre body, the water as sand waves
  b_sandking: { hue: 125, sat: 0.6, bri: 1.1 }, // purple hood and robe → sand
};
// eye rows of the Crest sprites used as they are or as compose bases (read from bosses.js /
// the art-mons anchor table), for the §11.4.2 window-band check (T6)
const CREST_FACE = {
  boss_frost_giant: 20, boss_flame_lord: 24, boss_star_guardian: 22, boss_serpent: 17, boss_general_b: 20,
  boss_bandit: 12, boss_general_a: 22, boss_demon_king: 22, doll: 12, ghost: 16, kraken: 31, sandworm: 17,
};
module.exports = { TABLE, FIXES, CREST_FACE };
