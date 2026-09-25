// Sanity check for the char-art part grids: every row exactly 16 wide, every
// char has a palette entry, layers stay inside the 16x24 frame.
'use strict';
const R = require('../../lib/load')({ quiet: true });
const CA = R.Art.Chars;
const known = new Set(Object.keys(CA.BASE_PAL).concat('.', ' ', 'x', '1', '2', '3', '4',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'P', 'Q', 'R', 'U', 'V', 'W', 'o', 'O', 'g', 'y', 'z', 'n', 'c', 'b', 'a', 'h', 'i', 'j', 'l', 'p', 'q', 'r', 'u', 'v', 'f'));
let bad = 0;
function walk(o, path, seen) {
  if (!o || typeof o !== 'object' || seen.has(o)) return;
  seen.add(o);
  if (Array.isArray(o.g) && typeof o.y === 'number') {
    o.g.forEach((row, i) => {
      if (row.length !== 16) { console.log(`${path} row ${i}: width ${row.length} "${row}"`); bad++; }
      for (const ch of row) if (!known.has(ch)) { console.log(`${path} row ${i}: unknown char '${ch}'`); bad++; }
    });
    if (o.y + o.g.length > 24 || o.y < 0) { console.log(`${path}: out of frame y=${o.y} h=${o.g.length}`); bad++; }
    return;
  }
  for (const k of Object.keys(o)) if (typeof o[k] === 'object') walk(o[k], path + '.' + k, seen);
}
walk(CA.parts, 'parts', new Set());
for (const t in CA.npcs) walk(CA.npcs[t], 'npc.' + t, new Set());
// every graphics key of DESIGN §4 owned by art-chars is registered
const keys = [];
for (const c of ['yuki', 'non', 'metem']) for (const j of CA.JOB_IDS.concat(Object.keys(R.DB.jobs))) keys.push('party:' + c + ':' + j);
for (const t of 'king queen princess minister soldier knight old_man old_woman man woman boy girl merchant innkeeper priest nun sage elder sailor captain bandit elf dwarf scholar dancer spirit demon ghost cat dog'.split(' ')) keys.push('npc:' + t);
for (const o of ['chest', 'ship', 'sparkle', 'crest_glow', 'shadow']) keys.push('obj:' + o);
for (const i of 'sword knife axe spear staff rod bow claw katana harp shield helm hat heavy light robe acc herb potion key'.split(' ')) keys.push('icon:' + i);
// extra job ids are registered from R.DB.jobs at boot (same call as the boot hook)
for (const j in R.DB.jobs) CA.defParty(j);
for (const k of keys) if (!R.Gfx.has(k)) { console.log('missing graphic key', k); bad++; }
for (const j in R.DB.jobs) if (!CA.parts.jobs[j]) { console.log('job without a style (falls back to _default):', j); }
console.log(bad ? bad + ' problem(s)' : 'parts OK (' + keys.length + ' keys registered)');
process.exitCode = bad ? 1 : 0;
