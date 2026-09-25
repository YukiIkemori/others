// Browser smoke test (never shipped): talk to every NPC / examine every event on
// every town map with UI & services stubbed, for several story stages.
//   node tools/shot.js --eval "$(cat tools/fixtures/towns/smoke_npcs.js)"
(async () => {
  const R = window.RPG;
  const log = [];
  R.UI.say = async () => {};
  R.UI.choose = async () => 1;
  R.UI.yesno = async () => false;
  R.UI.closeMessage = () => {};
  R.Shop.open = async () => {}; R.Shop.inn = async () => false; R.Shop.church = async () => {};
  if (R.Menu) R.Menu.saveScreen = R.Menu.saveMenu = async () => false;
  const errs = [];
  R.on('error', (e) => errs.push(String(e && e.stack || e).split('\n')[0]));
  const maps = Object.keys(R.DB.maps).filter((id) => /^(regnas_|milt_|east_gate|porta_|elfin_|salva_|frost_|arcana_|light_temple|edge_shrine)/.test(id));
  const stages = [
    [],
    ['intro_done'],
    ['intro_done', 'gate_open', 'bandits_defeated', 'has_ship'],
    ['intro_done', 'gate_open', 'bandits_defeated', 'has_ship', 'barrier_broken', 'game_clear'],
  ];
  const items = [[], ['crest_wind'], ['crest_wind', 'silver_key', 'crest_water', 'gold_key'], ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star', 'gold_key', 'silver_key', 'light_crest']];
  let talks = 0;
  R.State.newGame();
  await R.Field.start('regnas_town', 'entrance');
  for (let s = 0; s < stages.length; s++) {
    R.State.newGame();
    for (const f of stages[s]) R.Game.flags[f] = true;
    for (const i of items[s]) R.State.addItem(i, 1);
    for (const id of maps) {
      await R.Field.warp(id, 'entrance', { fade: false });
      await new Promise((r) => setTimeout(r, 30));
      for (const n of R.Field.map.npcs.slice()) {
        if (!n.present) continue;
        try { await R.Events.talk(n); talks++; } catch (e) { errs.push(id + ':' + n.id + ' ' + e); }
      }
      for (const e of R.Field.map.events) {
        try { await R.Events.run(e.id, { self: e.id, trigger: e.trigger }); } catch (er) { errs.push(id + ':' + e.id + ' ' + er); }
      }
    }
  }
  // the ceremony with all crests (stage 2 items + the rest)
  R.State.newGame();
  for (const i of items[3].filter((i) => i !== 'light_crest')) R.State.addItem(i, 1);
  await R.Field.warp('light_temple', 'entrance', { fade: false });
  await R.Events.talk(R.Field.npc('keeper'));
  return JSON.stringify({ talks, errors: errs.slice(0, 10), nErrors: errs.length, lightCrest: R.State.hasItem('light_crest'), barrier: R.State.flag('barrier_broken') });
})()
