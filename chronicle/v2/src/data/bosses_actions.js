// v2（BATTLE）: tools/port/port_mons.js が chronicle/src/data/bosses_actions.js から移した（手で直さない所は道具で。手で足す物は @@V2 の区画に）
// Boss and rare-monster actions (eb_ 191). DESIGN §9.11.5 (normative; copied as is).
// Order: rare monsters 64 → bosses 127 (troop order). Shape §9.1.6:
//   { name, kind:'enemy', target, effects:[…], fx, msg, aim?, elements? }
// New effect/cond features used here (battle A2): summon, mp:true (+drain heals HP),
// on:'self', multi-element `elements` (the one that hurts the target most).
(function (R) {
  'use strict';
  Object.assign(R.DB.bossActions, {
    eb_hare_kick: {name: R.T('bossActions.eb_hare_kick.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}], fx: 'strike', msg: R.T('bossActions.eb_hare_kick.msg')},
    eb_jewel_shine: {name: R.T('bossActions.eb_jewel_shine.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: R.T('bossActions.eb_jewel_shine.msg')},
    eb_hop_rest: {name: R.T('bossActions.eb_hop_rest.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: R.T('bossActions.eb_hop_rest.msg')},
    eb_petal_storm: {name: R.T('bossActions.eb_petal_storm.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'wind', msg: R.T('bossActions.eb_petal_storm.msg')},
    eb_antler_thrust: {name: R.T('bossActions.eb_antler_thrust.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'pierce'}], fx: 'pierce', msg: R.T('bossActions.eb_antler_thrust.msg')},
    eb_fawn_bloom: {name: R.T('bossActions.eb_fawn_bloom.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}, {type: 'status', status: 'regen'}], fx: 'regen', msg: R.T('bossActions.eb_fawn_bloom.msg')},
    eb_glass_scale: {name: R.T('bossActions.eb_glass_scale.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}, {type: 'status', status: 'blind', chance: 0.2}], fx: 'confuse', msg: R.T('bossActions.eb_glass_scale.msg')},
    eb_prism_wing: {name: R.T('bossActions.eb_prism_wing.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2}], fx: 'magic2', msg: R.T('bossActions.eb_prism_wing.msg'), elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
    eb_flutter: {name: R.T('bossActions.eb_flutter.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'agi', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_flutter.msg')},
    eb_acorn_barrage: {name: R.T('bossActions.eb_acorn_barrage.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4}], fx: 'strike', msg: R.T('bossActions.eb_acorn_barrage.msg')},
    eb_shell_guard: {name: R.T('bossActions.eb_shell_guard.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_shell_guard.msg')},
    eb_diamond_scales: {name: R.T('bossActions.eb_diamond_scales.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_diamond_scales.msg')},
    eb_tail_whip: {name: R.T('bossActions.eb_tail_whip.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4}], fx: 'strike', msg: R.T('bossActions.eb_tail_whip.msg')},
    eb_idol_ray: {name: R.T('bossActions.eb_idol_ray.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.4, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_idol_ray.msg')},
    eb_idol_ward: {name: R.T('bossActions.eb_idol_ward.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_idol_ward.msg')},
    eb_idol_curse: {name: R.T('bossActions.eb_idol_curse.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'debuff', msg: R.T('bossActions.eb_idol_curse.msg')},
    eb_aurora_veil: {name: R.T('bossActions.eb_aurora_veil.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}, {type: 'status', status: 'veil'}], fx: 'buff', msg: R.T('bossActions.eb_aurora_veil.msg')},
    eb_aurora_ray: {name: R.T('bossActions.eb_aurora_ray.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8}], fx: 'holy2', msg: R.T('bossActions.eb_aurora_ray.msg'), elements: ['water', 'light']},
    eb_ice_foxfire: {name: R.T('bossActions.eb_ice_foxfire.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.15}], fx: 'ice2', msg: R.T('bossActions.eb_ice_foxfire.msg')},
    eb_nine_tails: {name: R.T('bossActions.eb_nine_tails.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4}], fx: 'strike', msg: R.T('bossActions.eb_nine_tails.msg')},
    eb_fox_trick: {name: R.T('bossActions.eb_fox_trick.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'confuse', chance: 0.4}], fx: 'confuse', msg: R.T('bossActions.eb_fox_trick.msg')},
    eb_lotus_dew: {name: R.T('bossActions.eb_lotus_dew.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.3}], fx: 'heal', msg: R.T('bossActions.eb_lotus_dew.msg')},
    eb_lotus_bubble: {name: R.T('bossActions.eb_lotus_bubble.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'water', msg: R.T('bossActions.eb_lotus_bubble.msg')},
    eb_hot_tea: {name: R.T('bossActions.eb_hot_tea.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.3}], fx: 'fire', msg: R.T('bossActions.eb_hot_tea.msg')},
    eb_tea_party: {name: R.T('bossActions.eb_tea_party.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}, {type: 'buff', stat: 'agi', stages: 1}], fx: 'heal', msg: R.T('bossActions.eb_tea_party.msg')},
    eb_steam_puff: {name: R.T('bossActions.eb_steam_puff.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: R.T('bossActions.eb_steam_puff.msg')},
    eb_bell_toll: {name: R.T('bossActions.eb_bell_toll.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'song', msg: R.T('bossActions.eb_bell_toll.msg')},
    eb_shell_retreat: {name: R.T('bossActions.eb_shell_retreat.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_shell_retreat.msg')},
    eb_slime_trail: {name: R.T('bossActions.eb_slime_trail.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}], fx: 'debuff', msg: R.T('bossActions.eb_slime_trail.msg')},
    eb_stardust_spout: {name: R.T('bossActions.eb_stardust_spout.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 4}], fx: 'magic2', msg: R.T('bossActions.eb_stardust_spout.msg')},
    eb_whale_song: {name: R.T('bossActions.eb_whale_song.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: R.T('bossActions.eb_whale_song.msg')},
    eb_star_tide: {name: R.T('bossActions.eb_star_tide.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: R.T('bossActions.eb_star_tide.msg')},
    eb_coin_toss: {name: R.T('bossActions.eb_coin_toss.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3}], fx: 'strike', msg: R.T('bossActions.eb_coin_toss.msg')},
    eb_goblet_guard: {name: R.T('bossActions.eb_goblet_guard.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_goblet_guard.msg')},
    eb_greed_claw: {name: R.T('bossActions.eb_greed_claw.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'claw', msg: R.T('bossActions.eb_greed_claw.msg')},
    eb_gem_quills: {name: R.T('bossActions.eb_gem_quills.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 4, kind: 'pierce'}], fx: 'pierce', msg: R.T('bossActions.eb_gem_quills.msg')},
    eb_curl_up: {name: R.T('bossActions.eb_curl_up.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_curl_up.msg')},
    eb_sparkle: {name: R.T('bossActions.eb_sparkle.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: R.T('bossActions.eb_sparkle.msg')},
    eb_prism_beam: {name: R.T('bossActions.eb_prism_beam.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.5}], fx: 'magic3', msg: R.T('bossActions.eb_prism_beam.msg'), elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
    eb_refract: {name: R.T('bossActions.eb_refract.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_refract.msg')},
    eb_hot_splash: {name: R.T('bossActions.eb_hot_splash.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'water2', msg: R.T('bossActions.eb_hot_splash.msg')},
    eb_bath_heal: {name: R.T('bossActions.eb_bath_heal.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.3}, {type: 'status', status: 'regen'}], fx: 'regen', msg: R.T('bossActions.eb_bath_heal.msg')},
    eb_towel_snap: {name: R.T('bossActions.eb_towel_snap.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}], fx: 'strike', msg: R.T('bossActions.eb_towel_snap.msg')},
    eb_shell_eruption: {name: R.T('bossActions.eb_shell_eruption.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.55, element: 'fire', hits: 3}], fx: 'fire2', msg: R.T('bossActions.eb_shell_eruption.msg')},
    eb_lava_bite: {name: R.T('bossActions.eb_lava_bite.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'fire'}], fx: 'fire', msg: R.T('bossActions.eb_lava_bite.msg')},
    eb_moon_lullaby: {name: R.T('bossActions.eb_moon_lullaby.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'song', msg: R.T('bossActions.eb_moon_lullaby.msg')},
    eb_wool_puff: {name: R.T('bossActions.eb_wool_puff.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_wool_puff.msg')},
    eb_moonbeam: {name: R.T('bossActions.eb_moonbeam.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'light'}], fx: 'holy', msg: R.T('bossActions.eb_moonbeam.msg')},
    eb_tick_tock: {name: R.T('bossActions.eb_tick_tock.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'agi', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_tick_tock.msg')},
    eb_gear_peck: {name: R.T('bossActions.eb_gear_peck.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3}], fx: 'pierce', msg: R.T('bossActions.eb_gear_peck.msg')},
    eb_alarm: {name: R.T('bossActions.eb_alarm.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'song', msg: R.T('bossActions.eb_alarm.msg')},
    eb_nibble_page: {name: R.T('bossActions.eb_nibble_page.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true}], fx: 'mp', msg: R.T('bossActions.eb_nibble_page.msg')},
    eb_spectacle_glare: {name: R.T('bossActions.eb_spectacle_glare.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'holy', msg: R.T('bossActions.eb_spectacle_glare.msg')},
    eb_study: {name: R.T('bossActions.eb_study.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mag', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_study.msg')},
    eb_golden_script: {name: R.T('bossActions.eb_golden_script.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_golden_script.msg')},
    eb_rewrite_self: {name: R.T('bossActions.eb_rewrite_self.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: R.T('bossActions.eb_rewrite_self.msg')},
    eb_ink_blot: {name: R.T('bossActions.eb_ink_blot.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: R.T('bossActions.eb_ink_blot.msg')},
    eb_memory_bubble: {name: R.T('bossActions.eb_memory_bubble.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'water', msg: R.T('bossActions.eb_memory_bubble.msg')},
    eb_forget_splash: {name: R.T('bossActions.eb_forget_splash.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.9, mp: true}], fx: 'mp', msg: R.T('bossActions.eb_forget_splash.msg')},
    eb_fin_heal: {name: R.T('bossActions.eb_fin_heal.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: R.T('bossActions.eb_fin_heal.msg')},
    eb_dream_eat: {name: R.T('bossActions.eb_dream_eat.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1, mp: true, drain: 1}, {type: 'damage', formula: 'phys', power: 1.2, vs: {sleep: 2}}], fx: 'drain', msg: R.T('bossActions.eb_dream_eat.msg')},
    eb_sleep_mist: {name: R.T('bossActions.eb_sleep_mist.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.3}], fx: 'sleep', msg: R.T('bossActions.eb_sleep_mist.msg')},
    eb_nightmare: {name: R.T('bossActions.eb_nightmare.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}], fx: 'dark2', msg: R.T('bossActions.eb_nightmare.msg')},
    eb_tapir_nap: {name: R.T('bossActions.eb_tapir_nap.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.25}], fx: 'heal', msg: R.T('bossActions.eb_tapir_nap.msg')},
    eb_page_storm: {name: R.T('bossActions.eb_page_storm.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.5, hits: 3, kind: 'slash'}], fx: 'slash', msg: R.T('bossActions.eb_page_storm.msg')},
    eb_eat_words: {name: R.T('bossActions.eb_eat_words.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 0.8, mp: true}, {type: 'status', status: 'silence', chance: 0.4}], fx: 'mp', msg: R.T('bossActions.eb_eat_words.msg'), aim: 'middle'},
    eb_ink_spit: {name: R.T('bossActions.eb_ink_spit.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: R.T('bossActions.eb_ink_spit.msg')},
    eb_devour: {name: R.T('bossActions.eb_devour.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'bite2', msg: R.T('bossActions.eb_devour.msg')},
    eb_scale_sleep: {name: R.T('bossActions.eb_scale_sleep.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'sleep', msg: R.T('bossActions.eb_scale_sleep.msg')},
    eb_scale_poison: {name: R.T('bossActions.eb_scale_poison.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'poison', chance: 0.3}], fx: 'poison', msg: R.T('bossActions.eb_scale_poison.msg')},
    eb_wing_gale: {name: R.T('bossActions.eb_wing_gale.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'wind'}], fx: 'wind2', msg: R.T('bossActions.eb_wing_gale.msg')},
    eb_eye_spots: {name: R.T('bossActions.eb_eye_spots.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'confuse', chance: 0.2}], fx: 'confuse', msg: R.T('bossActions.eb_eye_spots.msg')},
    eb_moth_dive: {name: R.T('bossActions.eb_moth_dive.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5}], fx: 'strike2', msg: R.T('bossActions.eb_moth_dive.msg')},
    eb_root_drain: {name: R.T('bossActions.eb_root_drain.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'earth', drain: 0.5}], fx: 'drain', msg: R.T('bossActions.eb_root_drain.msg')},
    eb_rot_breath: {name: R.T('bossActions.eb_rot_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.5}, {type: 'status', status: 'poison', chance: 0.3}], fx: 'breath_poison', msg: R.T('bossActions.eb_rot_breath.msg')},
    eb_call_roots: {name: R.T('bossActions.eb_call_roots.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_root', n: 1, max: 3}], fx: 'earth', msg: R.T('bossActions.eb_call_roots.msg')},
    eb_body_slam: {name: R.T('bossActions.eb_body_slam.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5}], fx: 'strike2', msg: R.T('bossActions.eb_body_slam.msg')},
    eb_root_whip: {name: R.T('bossActions.eb_root_whip.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}, {type: 'status', status: 'paralyze', chance: 0.15}], fx: 'strike', msg: R.T('bossActions.eb_root_whip.msg')},
    eb_feed: {name: R.T('bossActions.eb_feed.name'), kind: 'enemy', target: 'ally', effects: [{type: 'heal', pct: 0.05}], fx: 'regen', msg: R.T('bossActions.eb_feed.msg')},
    eb_sink: {name: R.T('bossActions.eb_sink.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_sink.msg')},
    eb_sand_strike: {name: R.T('bossActions.eb_sand_strike.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9}], fx: 'strike3', msg: R.T('bossActions.eb_sand_strike.msg')},
    eb_quicksand: {name: R.T('bossActions.eb_quicksand.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.6, element: 'earth'}, {type: 'buff', stat: 'agi', stages: -1, chance: 0.4}], fx: 'earth2', msg: R.T('bossActions.eb_quicksand.msg')},
    eb_swallow_whole: {name: R.T('bossActions.eb_swallow_whole.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9, acc: 0.75}], fx: 'bite2', msg: R.T('bossActions.eb_swallow_whole.msg')},
    eb_steal_name: {name: R.T('bossActions.eb_steal_name.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.5}, {type: 'damage', formula: 'magic', power: 0.6, mp: true}], fx: 'silence', msg: R.T('bossActions.eb_steal_name.msg'), aim: 'middle'},
    eb_king_sand: {name: R.T('bossActions.eb_king_sand.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'earth'}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'earth2', msg: R.T('bossActions.eb_king_sand.msg')},
    eb_raise_guard: {name: R.T('bossActions.eb_raise_guard.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: '@mummy', n: 1, max: 3}], fx: 'dark', msg: R.T('bossActions.eb_raise_guard.msg')},
    eb_withering: {name: R.T('bossActions.eb_withering.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'dark', drain: 0.5}], fx: 'drain', msg: R.T('bossActions.eb_withering.msg')},
    eb_ice_wall: {name: R.T('bossActions.eb_ice_wall.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_ice_wall.msg')},
    eb_ice_hammer: {name: R.T('bossActions.eb_ice_hammer.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.7, element: 'water'}], fx: 'ice3', msg: R.T('bossActions.eb_ice_hammer.msg')},
    eb_avalanche_drop: {name: R.T('bossActions.eb_avalanche_drop.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.7, element: 'water'}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'ice2', msg: R.T('bossActions.eb_avalanche_drop.msg')},
    eb_frost_exhale: {name: R.T('bossActions.eb_frost_exhale.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.5, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.12}], fx: 'breath_ice', msg: R.T('bossActions.eb_frost_exhale.msg')},
    eb_white_blizzard: {name: R.T('bossActions.eb_white_blizzard.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.7, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.15}], fx: 'breath_ice', msg: R.T('bossActions.eb_white_blizzard.msg')},
    eb_ice_claw: {name: R.T('bossActions.eb_ice_claw.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, element: 'water'}], fx: 'claw', msg: R.T('bossActions.eb_ice_claw.msg')},
    eb_dragon_tail: {name: R.T('bossActions.eb_dragon_tail.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65}], fx: 'strike2', msg: R.T('bossActions.eb_dragon_tail.msg')},
    eb_frozen_roar: {name: R.T('bossActions.eb_frozen_roar.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.5}], fx: 'debuff', msg: R.T('bossActions.eb_frozen_roar.msg')},
    eb_glacier_fall: {name: R.T('bossActions.eb_glacier_fall.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.6, element: 'water'}], fx: 'ice3', msg: R.T('bossActions.eb_glacier_fall.msg')},
    eb_encore: {name: R.T('bossActions.eb_encore.name'), kind: 'enemy', target: 'ally_dead', effects: [{type: 'revive', pct: 0.5}], fx: 'revive', msg: R.T('bossActions.eb_encore.msg')},
    eb_baton: {name: R.T('bossActions.eb_baton.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2}], fx: 'strike', msg: R.T('bossActions.eb_baton.msg')},
    eb_crescendo: {name: R.T('bossActions.eb_crescendo.name'), kind: 'enemy', target: 'allies', effects: [{type: 'buff', stat: 'atk', stages: 1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_crescendo.msg')},
    eb_sad_tune: {name: R.T('bossActions.eb_sad_tune.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'atk', stages: -1, chance: 0.5}], fx: 'song', msg: R.T('bossActions.eb_sad_tune.msg')},
    eb_bow_slash: {name: R.T('bossActions.eb_bow_slash.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.2, kind: 'slash'}], fx: 'slash', msg: R.T('bossActions.eb_bow_slash.msg')},
    eb_drum_roll: {name: R.T('bossActions.eb_drum_roll.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.45}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'strike', msg: R.T('bossActions.eb_drum_roll.msg')},
    eb_flute_lullaby: {name: R.T('bossActions.eb_flute_lullaby.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: R.T('bossActions.eb_flute_lullaby.msg')},
    eb_shrill: {name: R.T('bossActions.eb_shrill.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.2, element: 'wind'}], fx: 'wind', msg: R.T('bossActions.eb_shrill.msg')},
    eb_mist_hand: {name: R.T('bossActions.eb_mist_hand.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3}, {type: 'status', status: 'sleep', chance: 0.15}], fx: 'strike', msg: R.T('bossActions.eb_mist_hand.msg')},
    eb_mist_breath: {name: R.T('bossActions.eb_mist_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.55}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'breath', msg: R.T('bossActions.eb_mist_breath.msg')},
    eb_call_double: {name: R.T('bossActions.eb_call_double.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_mist_double', n: 1, max: 3}], fx: 'smoke', msg: R.T('bossActions.eb_call_double.msg')},
    eb_inhale_mist: {name: R.T('bossActions.eb_inhale_mist.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.08}], fx: 'regen', msg: R.T('bossActions.eb_inhale_mist.msg')},
    eb_witch_mimic: {name: R.T('bossActions.eb_witch_mimic.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'dark'}], fx: 'dark2', msg: R.T('bossActions.eb_witch_mimic.msg')},
    eb_cold_touch: {name: R.T('bossActions.eb_cold_touch.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.1, element: 'water'}], fx: 'ice', msg: R.T('bossActions.eb_cold_touch.msg')},
    eb_ink_cloud: {name: R.T('bossActions.eb_ink_cloud.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.3}], fx: 'smoke', msg: R.T('bossActions.eb_ink_cloud.msg')},
    eb_crush_hug: {name: R.T('bossActions.eb_crush_hug.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: R.T('bossActions.eb_crush_hug.msg')},
    eb_regrow: {name: R.T('bossActions.eb_regrow.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_tentacle', n: 1, max: 3}], fx: 'regen', msg: R.T('bossActions.eb_regrow.msg')},
    eb_whirl: {name: R.T('bossActions.eb_whirl.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}], fx: 'water2', msg: R.T('bossActions.eb_whirl.msg')},
    eb_tentacle_bind: {name: R.T('bossActions.eb_tentacle_bind.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9}, {type: 'status', status: 'paralyze', chance: 0.25}], fx: 'strike', msg: R.T('bossActions.eb_tentacle_bind.msg')},
    eb_cutlass: {name: R.T('bossActions.eb_cutlass.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, kind: 'slash'}], fx: 'slash2', msg: R.T('bossActions.eb_cutlass.msg')},
    eb_fire_volley: {name: R.T('bossActions.eb_fire_volley.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.75, element: 'fire'}], fx: 'explosion', msg: R.T('bossActions.eb_fire_volley.msg')},
    eb_ghost_shanty: {name: R.T('bossActions.eb_ghost_shanty.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'song', msg: R.T('bossActions.eb_ghost_shanty.msg')},
    eb_call_crew: {name: R.T('bossActions.eb_call_crew.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: '@skeleton', n: 1, max: 3}], fx: 'dark', msg: R.T('bossActions.eb_call_crew.msg')},
    eb_anchor_throw: {name: R.T('bossActions.eb_anchor_throw.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8, acc: 0.85}], fx: 'strike3', msg: R.T('bossActions.eb_anchor_throw.msg')},
    eb_rock_crunch: {name: R.T('bossActions.eb_rock_crunch.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}, {type: 'buff', stat: 'def', stages: 1}], fx: 'earth', msg: R.T('bossActions.eb_rock_crunch.msg')},
    eb_gravel_spit: {name: R.T('bossActions.eb_gravel_spit.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 3, element: 'earth'}], fx: 'earth', msg: R.T('bossActions.eb_gravel_spit.msg')},
    eb_cave_in: {name: R.T('bossActions.eb_cave_in.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.7, element: 'earth'}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'earth2', msg: R.T('bossActions.eb_cave_in.msg')},
    eb_grind: {name: R.T('bossActions.eb_grind.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'bite2', msg: R.T('bossActions.eb_grind.msg')},
    eb_iron_fist: {name: R.T('bossActions.eb_iron_fist.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: R.T('bossActions.eb_iron_fist.msg')},
    eb_anvil_drop: {name: R.T('bossActions.eb_anvil_drop.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 2, acc: 0.8}], fx: 'strike3', msg: R.T('bossActions.eb_anvil_drop.msg')},
    eb_forge_breath: {name: R.T('bossActions.eb_forge_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.6, element: 'fire'}], fx: 'breath_fire', msg: R.T('bossActions.eb_forge_breath.msg')},
    eb_iron_wall: {name: R.T('bossActions.eb_iron_wall.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_iron_wall.msg')},
    eb_twin_fang: {name: R.T('bossActions.eb_twin_fang.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.9, hits: 2, element: 'fire'}], fx: 'bite', msg: R.T('bossActions.eb_twin_fang.msg')},
    eb_flame_howl: {name: R.T('bossActions.eb_flame_howl.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'burn', chance: 0.25}], fx: 'fire2', msg: R.T('bossActions.eb_flame_howl.msg')},
    eb_hound_fury: {name: R.T('bossActions.eb_hound_fury.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'atk', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_hound_fury.msg')},
    eb_lava_breath: {name: R.T('bossActions.eb_lava_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.6, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.15}], fx: 'breath_fire', msg: R.T('bossActions.eb_lava_breath.msg')},
    eb_lava_wave: {name: R.T('bossActions.eb_lava_wave.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'fire'}, {type: 'status', status: 'burn', chance: 0.2}], fx: 'fire3', msg: R.T('bossActions.eb_lava_wave.msg')},
    eb_eruption: {name: R.T('bossActions.eb_eruption.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 4, element: 'fire'}], fx: 'explosion2', msg: R.T('bossActions.eb_eruption.msg')},
    eb_magma_fist: {name: R.T('bossActions.eb_magma_fist.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6, element: 'fire'}], fx: 'fire2', msg: R.T('bossActions.eb_magma_fist.msg')},
    eb_obsidian_crush: {name: R.T('bossActions.eb_obsidian_crush.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8, element: 'earth'}], fx: 'strike3', msg: R.T('bossActions.eb_obsidian_crush.msg')},
    eb_ash_storm: {name: R.T('bossActions.eb_ash_storm.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'earth'}, {type: 'status', status: 'blind', chance: 0.25}], fx: 'earth2', msg: R.T('bossActions.eb_ash_storm.msg')},
    eb_sun_orb: {name: R.T('bossActions.eb_sun_orb.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.3, element: 'fire'}], fx: 'fire2', msg: R.T('bossActions.eb_sun_orb.msg')},
    eb_moon_orb: {name: R.T('bossActions.eb_moon_orb.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'water'}], fx: 'water2', msg: R.T('bossActions.eb_moon_orb.msg')},
    eb_star_orb: {name: R.T('bossActions.eb_star_orb.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 3}], fx: 'holy2', msg: R.T('bossActions.eb_star_orb.msg')},
    eb_orbit_shield: {name: R.T('bossActions.eb_orbit_shield.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}], fx: 'buff', msg: R.T('bossActions.eb_orbit_shield.msg')},
    eb_swallow_star: {name: R.T('bossActions.eb_swallow_star.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'dark', msg: R.T('bossActions.eb_swallow_star.msg')},
    eb_star_spit: {name: R.T('bossActions.eb_star_spit.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, element: 'light', hits: 5}], fx: 'holy2', msg: R.T('bossActions.eb_star_spit.msg')},
    eb_void_fang: {name: R.T('bossActions.eb_void_fang.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, element: 'dark', drain: 0.3}], fx: 'dark2', msg: R.T('bossActions.eb_void_fang.msg')},
    eb_dark_nova: {name: R.T('bossActions.eb_dark_nova.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}], fx: 'dark3', msg: R.T('bossActions.eb_dark_nova.msg')},
    eb_silver_thrust: {name: R.T('bossActions.eb_silver_thrust.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.4, kind: 'pierce'}], fx: 'pierce', msg: R.T('bossActions.eb_silver_thrust.msg')},
    eb_copy_power: {name: R.T('bossActions.eb_copy_power.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'dispel', side: 'good'}, {type: 'status', status: 'silence', chance: 0.4}], fx: 'dispel', msg: R.T('bossActions.eb_copy_power.msg')},
    eb_ink_guard: {name: R.T('bossActions.eb_ink_guard.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'def', stages: 1}, {type: 'buff', stat: 'mdef', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_ink_guard.msg')},
    eb_record_light: {name: R.T('bossActions.eb_record_light.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.7, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_record_light.msg')},
    eb_white_page: {name: R.T('bossActions.eb_white_page.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'silence', chance: 0.25}, {type: 'damage', formula: 'magic', power: 0.5, mp: true}], fx: 'dispel', msg: R.T('bossActions.eb_white_page.msg')},
    eb_pen_flurry: {name: R.T('bossActions.eb_pen_flurry.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 3, kind: 'pierce'}], fx: 'pierce2', msg: R.T('bossActions.eb_pen_flurry.msg')},
    eb_page_blizzard: {name: R.T('bossActions.eb_page_blizzard.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 4, kind: 'slash'}], fx: 'slash2', msg: R.T('bossActions.eb_page_blizzard.msg')},
    eb_tome_slam: {name: R.T('bossActions.eb_tome_slam.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8}], fx: 'strike3', msg: R.T('bossActions.eb_tome_slam.msg')},
    eb_rebind: {name: R.T('bossActions.eb_rebind.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.1}], fx: 'regen', msg: R.T('bossActions.eb_rebind.msg')},
    eb_call_books: {name: R.T('bossActions.eb_call_books.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'book_1', n: 1, max: 4}], fx: 'magic', msg: R.T('bossActions.eb_call_books.msg')},
    eb_dust_of_ages: {name: R.T('bossActions.eb_dust_of_ages.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'blind', chance: 0.25}], fx: 'smoke', msg: R.T('bossActions.eb_dust_of_ages.msg')},
    eb_shade_blade: {name: R.T('bossActions.eb_shade_blade.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.5, kind: 'slash'}], fx: 'slash2', msg: R.T('bossActions.eb_shade_blade.msg')},
    eb_shade_crest: {name: R.T('bossActions.eb_shade_crest.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.3, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_shade_crest.msg')},
    eb_shade_sweep: {name: R.T('bossActions.eb_shade_sweep.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 0.65, kind: 'slash'}], fx: 'slash2', msg: R.T('bossActions.eb_shade_sweep.msg')},
    eb_shade_heal: {name: R.T('bossActions.eb_shade_heal.name'), kind: 'enemy', target: 'allies', effects: [{type: 'heal', pct: 0.2}], fx: 'heal', msg: R.T('bossActions.eb_shade_heal.msg')},
    eb_shade_raise: {name: R.T('bossActions.eb_shade_raise.name'), kind: 'enemy', target: 'ally_dead', effects: [{type: 'revive', pct: 0.4}], fx: 'revive', msg: R.T('bossActions.eb_shade_raise.msg')},
    eb_shade_holy: {name: R.T('bossActions.eb_shade_holy.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_shade_holy.msg')},
    eb_shade_meteor: {name: R.T('bossActions.eb_shade_meteor.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.55, hits: 4}], fx: 'explosion2', msg: R.T('bossActions.eb_shade_meteor.msg')},
    eb_shade_frost: {name: R.T('bossActions.eb_shade_frost.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'water'}, {type: 'status', status: 'freeze', chance: 0.1}], fx: 'ice2', msg: R.T('bossActions.eb_shade_frost.msg')},
    eb_shade_fire: {name: R.T('bossActions.eb_shade_fire.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.75, element: 'fire'}], fx: 'fire2', msg: R.T('bossActions.eb_shade_fire.msg')},
    eb_white_book: {name: R.T('bossActions.eb_white_book.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.5}, {type: 'dispel', side: 'good'}], fx: 'dispel', msg: R.T('bossActions.eb_white_book.msg'), aim: 'middle'},
    // SYSTEMS_REWORK phase 3 (A18: techs pay MP now): the party-wide MP damage 0.6 → 0.1, so a hit costs the party about
    // what it cost when only the casters' MP was hit (warriors' WP was untouched). sim_bosses X1 lazaro / X4 last boss.
    eb_erase_memory: {name: R.T('bossActions.eb_erase_memory.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.1, mp: true}], fx: 'mp', msg: R.T('bossActions.eb_erase_memory.msg')},
    eb_silver_quill: {name: R.T('bossActions.eb_silver_quill.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'magic', power: 1.4, element: 'light'}], fx: 'holy2', msg: R.T('bossActions.eb_silver_quill.msg')},
    eb_page_shield: {name: R.T('bossActions.eb_page_shield.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'mdef', stages: 2}, {type: 'buff', stat: 'def', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_page_shield.msg')},
    eb_call_scribes: {name: R.T('bossActions.eb_call_scribes.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'scribe_1', n: 1, max: 3}], fx: 'magic', msg: R.T('bossActions.eb_call_scribes.msg')},
    eb_whiteout: {name: R.T('bossActions.eb_whiteout.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}, {type: 'damage', formula: 'magic', power: 0.7}], fx: 'dispel', msg: R.T('bossActions.eb_whiteout.msg')},
    eb_oblivion_wave: {name: R.T('bossActions.eb_oblivion_wave.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.1, mp: true}, {type: 'status', status: 'silence', chance: 0.2}], fx: 'mp', msg: R.T('bossActions.eb_oblivion_wave.msg')},
    eb_paper_hand: {name: R.T('bossActions.eb_paper_hand.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.6}], fx: 'strike2', msg: R.T('bossActions.eb_paper_hand.msg')},
    eb_erase_name: {name: R.T('bossActions.eb_erase_name.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'status', status: 'silence', chance: 0.6}, {type: 'buff', stat: 'atk', stages: -1, chance: 0.6}], fx: 'dispel', msg: R.T('bossActions.eb_erase_name.msg')},
    eb_blank_storm: {name: R.T('bossActions.eb_blank_storm.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.55, hits: 4, kind: 'slash'}], fx: 'slash2', msg: R.T('bossActions.eb_blank_storm.msg')},
    eb_eight_legends: {name: R.T('bossActions.eb_eight_legends.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'magic', power: 0.5, hits: 8}], fx: 'magic3', msg: R.T('bossActions.eb_eight_legends.msg'), elements: ['fire', 'water', 'wind', 'earth', 'light', 'dark']},
    eb_oblivion_breath: {name: R.T('bossActions.eb_oblivion_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.7}, {type: 'status', status: 'silence', chance: 0.25}], fx: 'breath', msg: R.T('bossActions.eb_oblivion_breath.msg')},
    eb_unwrite: {name: R.T('bossActions.eb_unwrite.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.8}, {type: 'dispel', side: 'good'}], fx: 'strike3', msg: R.T('bossActions.eb_unwrite.msg')},
    eb_dream_sleep: {name: R.T('bossActions.eb_dream_sleep.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'sleep', chance: 0.25}], fx: 'sleep', msg: R.T('bossActions.eb_dream_sleep.msg')},
    eb_nemrea_rewrite: {name: R.T('bossActions.eb_nemrea_rewrite.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.08}], fx: 'regen', msg: R.T('bossActions.eb_nemrea_rewrite.msg')},
    eb_echo_despair: {name: R.T('bossActions.eb_echo_despair.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'dark'}, {type: 'buff', stat: 'atk', stages: -1, chance: 0.3}], fx: 'dark3', msg: R.T('bossActions.eb_echo_despair.msg')},
    eb_echo_claw: {name: R.T('bossActions.eb_echo_claw.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.1, hits: 2, element: 'dark'}], fx: 'claw', msg: R.T('bossActions.eb_echo_claw.msg')},
    eb_echo_flame: {name: R.T('bossActions.eb_echo_flame.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.8, element: 'fire'}], fx: 'fire3', msg: R.T('bossActions.eb_echo_flame.msg')},
    eb_echo_gaze: {name: R.T('bossActions.eb_echo_gaze.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'status', status: 'stun', chance: 0.2}], fx: 'debuff', msg: R.T('bossActions.eb_echo_gaze.msg')},
    eb_echo_gather: {name: R.T('bossActions.eb_echo_gather.name'), kind: 'enemy', target: 'self', effects: [{type: 'heal', pct: 0.06}], fx: 'dark', msg: R.T('bossActions.eb_echo_gather.msg')},
    eb_rewind: {name: R.T('bossActions.eb_rewind.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'dispel', side: 'good'}], fx: 'warp', msg: R.T('bossActions.eb_rewind.msg')},
    eb_eternal_breath: {name: R.T('bossActions.eb_eternal_breath.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'breath', power: 0.8}], fx: 'breath_dark', msg: R.T('bossActions.eb_eternal_breath.msg')},
    eb_ring_crush: {name: R.T('bossActions.eb_ring_crush.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.9}, {type: 'status', status: 'paralyze', chance: 0.15}], fx: 'strike3', msg: R.T('bossActions.eb_ring_crush.msg')},
    eb_time_loop: {name: R.T('bossActions.eb_time_loop.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'buff', stat: 'agi', stages: -1, chance: 0.6}, {type: 'status', status: 'stun', chance: 0.15}], fx: 'debuff', msg: R.T('bossActions.eb_time_loop.msg')},
    eb_scale_storm: {name: R.T('bossActions.eb_scale_storm.name'), kind: 'enemy', target: 'random', effects: [{type: 'damage', formula: 'phys', power: 0.6, hits: 5}], fx: 'slash2', msg: R.T('bossActions.eb_scale_storm.msg')},
    eb_tail_devour: {name: R.T('bossActions.eb_tail_devour.name'), kind: 'enemy', target: 'self', effects: [{type: 'buff', stat: 'atk', stages: 1}, {type: 'buff', stat: 'mag', stages: 1}], fx: 'buff', msg: R.T('bossActions.eb_tail_devour.msg')},
  });
  // @@V2-BEGIN 予告と考えどころの行動（WORLD_REDESIGN §4.10・E18、V2_PLAN §2.6.5、BATTLE）
  // telegraph = {text, pose, tint, next, guard, cancel?}: 使うと画面の端の文と構え（BSCENE）、次の手番（次のラウンドの最初の手番）に next を使う。
  // guard は sim の台本が読む答え（画面には出さない）。cancel = {element, msg}: その属性で打たれると予約が消える。
  // 効果の無い行動は「構えるだけ」（しかし効き目がなかった、は出さない）。
  Object.assign(R.DB.bossActions, {
    // ページ食らい（序章）: 紙をため込む → 次の手番に全体の紙吹雪 → 防御で半分（教える戦いなので罰は軽く）
    eb_page_gather: {name: R.T('bossActions.eb_page_gather.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_page_gather.msg'),
      telegraph: {text: R.T('bossActions.eb_page_gather.telegraph.text'), pose: 'tele', tint: '#e8dcb8', next: 'eb_confetti', guard: 'defend'}},
    eb_confetti: {name: R.T('bossActions.eb_confetti.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'phys', power: 2.4, kind: 'slash', sure: true}], fx: 'slash2', msg: R.T('bossActions.eb_confetti.msg')},
    // ダストウィング（森の中ボス）: 羽が光る → 次の手番に全員へ眠りのりん粉。風の術・技で打つと吹き飛ぶ（予約が消える）
    eb_wing_glow: {name: R.T('bossActions.eb_wing_glow.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_wing_glow.msg'),
      telegraph: {text: R.T('bossActions.eb_wing_glow.telegraph.text'), pose: 'tele', tint: '#b8e0ff', next: 'eb_sleep_dust', guard: 'element:wind',
        cancel: {element: 'wind', msg: R.T('bossActions.eb_wing_glow.telegraph.cancel.msg')}}},
    eb_sleep_dust: {name: R.T('bossActions.eb_sleep_dust.name'), kind: 'enemy', target: 'enemies', effects: [{type: 'damage', formula: 'magic', power: 0.5}, {type: 'status', status: 'sleep', chance: 0.9}], fx: 'sleep', msg: R.T('bossActions.eb_sleep_dust.msg')},
    // 根食らい（森の地方ボス）: 根が地面にもぐる → 次の手番に前列へ根の突き上げ。後列の人には届かない・防御で半分
    eb_root_sink: {name: R.T('bossActions.eb_root_sink.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_root_sink.msg'),
      telegraph: {text: R.T('bossActions.eb_root_sink.telegraph.text'), pose: 'tele', tint: '#8fd6d8', next: 'eb_root_quake', guard: 'back'}},
    eb_root_quake: {name: R.T('bossActions.eb_root_quake.name'), kind: 'enemy', target: 'front', effects: [{type: 'damage', formula: 'phys', power: 2.4, sure: true}], fx: 'earth2', msg: R.T('bossActions.eb_root_quake.msg')},
    // 狼の群れ頭（救出の戦い）: 大きく息を吸う → 次の手番に遠吠えで狼が 1 匹増える。頭を倒すと群れが逃げる
    eb_lord_breath: {name: R.T('bossActions.eb_lord_breath.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_lord_breath.msg'),
      telegraph: {text: R.T('bossActions.eb_lord_breath.telegraph.text'), pose: 'tele', tint: '#c8d0e8', next: 'eb_pack_howl', guard: 'focus'}},
    eb_pack_howl: {name: R.T('bossActions.eb_pack_howl.name'), kind: 'enemy', target: 'self', effects: [{type: 'summon', mon: 'b_packwolf', n: 2, max: 6}], fx: 'song', msg: R.T('bossActions.eb_pack_howl.msg')},
    eb_lord_bite: {name: R.T('bossActions.eb_lord_bite.name'), kind: 'enemy', target: 'enemy', effects: [{type: 'damage', formula: 'phys', power: 1.35}], fx: 'bite2', msg: R.T('bossActions.eb_lord_bite.msg')},
  });
  // ---- 2026-10-01（ボスの組み直し w_boss2。オーナー「溜めての即死級はもう飽きた。色んな角度から、ボスの見た目・属性に合った技で」）
  //   ボスの技の道具（effect {type:'special', id}。battle_core の effect 'special' が呼ぶ）。場の効果は旗（eng.flags）で、旗のある間だけ使える技を足す（cond.flag）
  R.onData(function () {
    const BC = (R.BattleCore = R.BattleCore || {});
    const SP = (BC.specials = BC.specials || {});
    const say = (eng, text, o) => eng.m(String(text || '').replace(/\{user\}/g, (o && o.user) || '').replace(/\{name\}/g, (o && o.name) || ''));
    // 時間差の呪い: 印をつけ（boss_mark）、のちの手番で印の人だけを最大 HP の割合で打つ（boss_mark_burst）。守っていれば guardPct だけ。印は倒れると消える
    SP.boss_mark = function* (eng, u, t, eff) {
      if (!t || !t.alive || !t.isParty) return;
      const flag = eff.flag || 'boss_mark';
      t.bossMark = { flag, pct: eff.pct != null ? eff.pct : 0.25, guardPct: eff.guardPct != null ? eff.guardPct : 0.08 };
      eng.flags[flag] = true;
      yield say(eng, R.T('data.bosses_kit.mark.m'), { name: t.name });
    };
    SP.boss_mark_burst = function* (eng, u, t, eff) {
      const flag = eff.flag || 'boss_mark';
      if (t && t.isParty && t.bossMark && t.bossMark.flag === flag) {
        const mk = t.bossMark;
        t.bossMark = null;
        if (t.alive) {
          yield say(eng, R.T('data.bosses_kit.burst.m'), { name: t.name });
          yield* eng.hit(u, t, { dmg: Math.max(1, Math.round(t.mhp * (t.defending ? mk.guardPct : mk.pct))) }, { kind: eff.kind || 'magic', element: eff.element || null });
        }
      }
      if (!eng.party.some((p) => p.alive && p.bossMark && p.bossMark.flag === flag)) eng.flags[flag] = false;
    };
    // 品を奪う: 戦闘で使える品を 1 つ取る。そのボスを倒すと取り返す（d.onDeath: 'boss_return'）
    SP.boss_snatch = function* (eng, u, t) {
      if (!t || !t.isParty || !u.alive) return;
      const ids = Object.keys(eng.inv || {}).filter((id) => eng.inv[id] > 0 && R.DB.items[id] && R.DB.items[id].use && R.DB.items[id].use.battle);
      if (!ids.length) { yield say(eng, R.T('data.bosses_kit.snatch.none'), { user: u.name }); return; }
      const id = ids[R.Mon.rng().ri(0, ids.length - 1)];
      eng.inv[id] -= 1;
      (u.bossLoot = u.bossLoot || []).push(id);
      yield say(eng, R.T('data.bosses_kit.snatch.m', { item: R.DB.items[id].name }), { user: u.name });
    };
    SP.boss_return = function* (eng, u) {
      const loot = u.bossLoot || [];
      u.bossLoot = [];
      for (const id of loot) eng.inv[id] = (eng.inv[id] || 0) + 1;
      if (loot.length) yield say(eng, R.T('data.bosses_kit.return.m', { n: loot.length }), { user: u.name });
    };
    // 構え・属性の切り替え: 弱点（elem）と物理の通り（phys）が変わる。base はふだんの値（何度でも切り替えられる）
    SP.boss_shift = function* (eng, u, t, eff) {
      const d = u.ownDef();
      if (!d.elemBase) { d.elemBase = Object.assign({}, d.elem || {}); d.physBase = Object.assign({}, d.phys || {}); }
      d.elem = Object.assign({}, d.elemBase, eff.elem || {});
      d.phys = Object.assign({}, d.physBase, eff.phys || {});
      if (eff.flag) eng.flags[eff.flag] = true;
      if (eff.clear) eng.flags[eff.clear] = false;
      if (eff.msg) yield say(eng, eff.msg, { user: u.name });
    };
    // 場の効果: 旗を立てる（旗のある間だけ使える技は cond.flag）。同じ技の status・buff が場の始まりの効き目
    SP.boss_field = function* (eng, u, t, eff) {
      if (eff.clear) eng.flags[eff.clear] = false;
      if (eng.flags[eff.flag]) return;
      eng.flags[eff.flag] = true;
      if (eff.msg) yield say(eng, eff.msg, { user: u.name });
    };
  });
  // @@V2-END
})(window.RPG);
