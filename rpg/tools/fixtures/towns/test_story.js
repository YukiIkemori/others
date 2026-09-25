// Node test for the story stage logic (R.Story) — never shipped.
//   node tools/fixtures/towns/test_story.js
'use strict';
const R = require('../../lib/load')({ quiet: true });
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
R.State.newGame();
const S = R.Story, st = R.State;
const step = (label, fn, want) => { fn(); S.refreshObjective(); assert(R.Game.objective === want, `${label} → ${want} (got ${R.Game.objective})`); };
step('new game', () => {}, 'obj_start');
step('intro', () => st.setFlag('intro_done'), 'obj_wind');
step('crest_wind', () => st.addItem('crest_wind'), 'obj_gate');
step('gate open', () => st.setFlag('gate_open'), 'obj_gate');
step('visited porta', () => { R.Game.visited.porta = true; }, 'obj_bandits');
step('fort cleared', () => { st.setFlag('bandits_defeated'); st.addItem('silver_key'); }, 'obj_ship');
step('ship', () => { st.setFlag('has_ship'); R.Game.ship = { map: 'world', x: 56, y: 44 }; }, 'obj_water');
step('pyramid first', () => st.addItem('crest_earth'), 'obj_water');
step('water', () => st.addItem('crest_water'), 'obj_frost');
step('gold key', () => st.addItem('gold_key'), 'obj_fire');
step('star first', () => st.addItem('crest_star'), 'obj_fire');
step('fire', () => st.addItem('crest_fire'), 'obj_temple');
step('ceremony', () => { st.addItem('light_crest'); st.setFlag('barrier_broken'); }, 'obj_demon');
step('clear', () => st.setFlag('game_clear'), 'obj_clear');
for (const id of S.OBJECTIVES) assert(R.DB.objectives[id] && R.DB.objectives[id].text && R.DB.objectives[id].king, `objective ${id} has text + king advice`);

// respawn default
R.State.newGame();
S.autoRespawn('regnas_castle');
assert(R.Game.respawn.map === 'regnas_castle' && R.Game.respawn.spawn === 'start', 'castle keeps the start respawn');
S.autoRespawn('regnas_town');
assert(R.Game.respawn.map === 'regnas_town' && R.Game.respawn.spawn === 'entrance', 'entering a town sets its entrance');
S.autoRespawn('regnas_house_yuki');
assert(R.Game.respawn.map === 'regnas_town', 'interiors (no location) do not change it');
R.Game.respawn = { map: 'porta_town', x: 8, y: 16, dir: 'down' };
S.autoRespawn('porta_town');
assert(R.Game.respawn.x === 8, 'an inn spot in the same town is kept');

// events present with meta
for (const id of ['regnas_castle_enter', 'king_talk', 'gate_soldier', 'porta_captain', 'temple_altar', 'shop', 'inn', 'church', 'chat', 'fortune', 'yuki_mother', 'metem_mother', 'elfin_spring'])
  assert(R.DB.events[id] && R.DB.events[id].meta && typeof R.DB.events[id].run === 'function', `event ${id}`);
assert(R.Ending && typeof R.Ending.start === 'function', 'R.Ending.start');

// text: the heroes' names are player-chosen (placeholders only), no DQ-style
// word spacing between Japanese phrases, and the placeholders resolve.
{
  const fs = require('fs'), path = require('path');
  const ROOT = path.resolve(__dirname, '../../..');
  const JA = /[ぁ-んァ-ヶー一-龯]/;
  const strs = [];
  for (const f of ['src/events/story.js', 'src/events/story_town.js', 'src/data/objectives.js', 'src/systems/ending.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const re = /'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) if (JA.test(m[1])) strs.push([f, m[1]]);
  }
  const named = strs.filter(([, s]) => /ユウキ|ノン|メテム/.test(s));
  assert(!named.length, `no hard-coded hero names in story text${named.length ? ': ' + named.map((x) => x[1]).join(' / ') : ''}`);
  const spaced = strs.filter(([, s]) => /[ぁ-んァ-ヶー一-龯。、] [ぁ-んァ-ヶー一-龯]/.test(s));
  assert(!spaced.length, `no DQ-style spaces in story text${spaced.length ? ': ' + spaced.map((x) => x[1]).join(' / ') : ''}`);
  R.Game.party.find((c) => c.id === 'yuki').name = 'Alex';
  assert(R.Text.fmt(R.Ending.EPILOGUES[0].text[0]).startsWith('Alex'), 'epilogue uses the chosen name');
  assert(R.Ending.CREDITS.some(([k, v]) => k === 'name' && R.Text.fmt(v).includes('Alex')), 'credits use the chosen names');
}
