// reg2 (R2) review fixture: jump straight into the states of region 2 r_desert for screenshots and manual
// walks. Loaded only by `node tools/build.js --with tools/fixtures/reg2` → debug_reg2.html:
//   node tools/shot.js --html debug_reg2.html --eval "RPG.Reg2Debug.scene('worm')" --wait 1500 --out x.png
// Scenes (all start from debug.quickStart at tier 0 unless noted, no random battles):
//   town_arrive  kasim, first arrival at the gate (the intro with ザイード runs)
//   town         kasim, after the intro, in front of the inn
//   town_clear   kasim after the clear (the spring is full, the prayer at the king's statue)
//   tomb1        sand_tomb_1 at the courtyard          statue1  in front of 墓守の像 1
//   worm         sand_tomb_2 at the worm's hall        quick    the quicksand (before the worm)
//   secret       sand_tomb_2 at the cracked wall       statue2  after the worm, in front of 墓守の像 2
//   ante         sand_tomb_3 antechamber (2 letters: the door is shut)
//   king         sand_tomb_3 in the king's hall (3 letters)
// RPG.Reg2Debug.autoWin(true) makes every battle a win (for event flow checks).
(function (R) {
  'use strict';
  const D = (R.Reg2Debug = {});
  const at = {
    town_arrive: ['kasim', 'entrance', {}],
    town: ['kasim', 'inn', { flags: ['desert_start'] }],
    town_clear: ['kasim', { x: 25, y: 13 }, { flags: ['desert_start'], clear: true }],
    tomb1: ['sand_tomb_1', 'entrance', { flags: ['desert_start'] }],
    statue1: ['sand_tomb_1', { x: 6, y: 6 }, { flags: ['desert_start'] }],
    worm: ['sand_tomb_2', { x: 23, y: 11 }, { flags: ['desert_start'] }],
    quick: ['sand_tomb_2', { x: 23, y: 25 }, { flags: ['desert_start'] }],
    secret: ['sand_tomb_2', { x: 38, y: 5 }, { flags: ['desert_start'] }],
    statue2: ['sand_tomb_2', { x: 7, y: 31 }, { flags: ['desert_start', 'desert_mid'], letters: 1 }],
    ante: ['sand_tomb_3', { x: 20, y: 17 }, { flags: ['desert_start', 'desert_mid'], letters: 2 }],
    king: ['sand_tomb_3', { x: 19, y: 9 }, { flags: ['desert_start', 'desert_mid', 'desert_fine'], letters: 3 }],
  };
  D.SCENES = Object.keys(at);
  D.scene = async function (name, o) {
    const s = at[name];
    if (!s) throw new Error('Reg2Debug: unknown scene ' + name + ' (' + D.SCENES.join(' ') + ')');
    const [map, spawn, st] = s;
    await R.debug.quickStart(Object.assign({ map: 'lute', spawn: 'inn', noEncounter: true }, o || {}));
    for (const f of st.flags || []) R.debug.flag(f, true);
    if (st.letters) R.State.setVar('desert_letters', st.letters);
    if (st.clear) R.debug.clearRegion('r_desert');
    await R.debug.warp(map, spawn);
    return R.debug.pos();
  };
  let orig = null;
  D.autoWin = function (on) {
    if (on && !orig) { orig = R.Battle.start; R.Battle.start = async () => 'win'; }
    if (!on && orig) { R.Battle.start = orig; orig = null; }
    return !!orig;
  };
})(window.RPG);
