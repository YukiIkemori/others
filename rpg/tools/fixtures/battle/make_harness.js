#!/usr/bin/env node
// Writes a battle test page = debug.html + battle fixtures (data + stand-in art),
// loaded before main.js. Then drive it with tools/shot.js, e.g.
//   node tools/build.js && node tools/fixtures/battle/make_harness.js /tmp/claude-0/battle/h.html [--field]
//   node tools/shot.js --html /tmp/claude-0/battle/h.html --eval "RPG.fxBattle({mons:[['tb_goblin',3]]})" --wait 2500 --out /tmp/x.png
// RPG.fxBattle(opts, level) starts a fresh game with the fixture party and opens a battle.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const out = process.argv[2] || '/tmp/claude-0/battle/harness.html';
let html = fs.readFileSync(path.join(ROOT, 'debug.html'), 'utf8');
const boot = `<script>
(function (R) {
  R.fxBattle = function (opts, level) {
    R.Engine.clear();
    R.State.newGame();
    R.Game.party = R.fxBattleParty(level || 10);
    R.Game.inv = { tb_herb: 5, tb_potion: 2, tb_feather: 1, tb_firebomb: 3, tb_nut: 1 };
    R.Settings.msgSpeed = 2; R.Settings.battleSpeed = 1;
    const L = new R.Layer(); L.opaque = true; L.draw = () => R.Gfx.clear('#203020');
    R.Engine.push(L);
    R.fxResult = null;
    R.Battle.start(opts).then((r) => { R.fxResult = r; });
    return 'started';
  };
  // play an effect directly on the running scene: side 'party' (party → monsters) or 'mon'
  R.fxPlay = function (fx, side, ui, tis, abId) {
    const s = R.Battle.current, e = s.eng;
    const user = side === 'party' ? e.party[ui] : e.mons[ui];
    const targets = tis.map((i) => (side === 'party' ? e.mons[i] : e.party[i]));
    const ab = abId ? R.DB.abilities[abId] : { magic: side === 'party' };
    s.playFx({ t: 'fx', fx, user, targets, ab, kind: fx === 'attack' ? 'attack' : 'ability' });
    return fx;
  };
  // run engine events on the scene (e.g. R.fxEvents(e => e.useAbility(...)))
  R.fxEvents = function (fn) { const s = R.Battle.current; s.play(fn(s.eng, s)); return 'ok'; };
})(window.RPG);
</script>`;
const fx = ['tools/fixtures/battle/data.js', 'tools/fixtures/battle/art_stub.js'];
// --field: also load the field fixtures (small world/town/dungeon) to test field → battle → field
if (process.argv.includes('--field')) fx.push('tools/fixtures/field/maps.js', 'tools/fixtures/field/art_stub.js');
const tags = fx.map((f) => `<script src="${f}"></script>`).join('\n');
html = html.replace('<script src="src/main.js"></script>', tags + '\n' + boot + '\n<script src="src/main.js"></script>');
html = html.replace('<head>', `<head>\n<base href="file://${ROOT}/">`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('harness →', out);
