#!/usr/bin/env node
// Hi-res art prototype generator (BRIEF Part A16). Tool-time only; needs GOOGLE_API_KEY in the environment
// (e.g. `set -a; . /tmp/claude-0/secrets/google.env; set +a`). The key is never written anywhere.
//
//   node tools/art_gen.js [--style anime,chibi,storybook] [--jobs party,mons,...] [--model gemini-3-pro-image]
//                         [--force] [--dry] [--conc 3] [--tag v2] [--refs bbg] [--prompt-extra '...']
//
// Writes design/art_proto/raw/<style>/<job>[.<tag>].png. Jobs that need the party image as a style reference run
// after it. Every call is logged to design/art_proto/api_log.jsonl (tools/lib/gemini_image.js).
'use strict';
const fs = require('fs');
const path = require('path');
const GI = require('./lib/gemini_image.js');
const { STYLES, CHROMA, PARTY, MONS } = require('./lib/art_style.js');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'design/art_proto/raw');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const MATCH = 'Match the art style of the attached reference image exactly (same line quality, shading, palette, level of detail and rendering), as if drawn by the same artist for the same game.';

/** job table for one style. refs: ids of earlier jobs of the same style (or {file}) */
function jobs(S) {
  const L = S.look, B = S.body;
  return [
    {
      id: 'party', aspect: '16:9', size: '2K', refs: [],
      prompt: `${L}\n\nBattle sprite sheet for a side-view JRPG (the party stands on the right side of the battle screen and faces the enemies on the LEFT). Four party members in a single row, evenly spaced, each shown full body from head to feet in a strict side view (profile, at most a slight three-quarter turn) FACING LEFT, in a relaxed battle-ready idle stance, same scale, ${B}, feet on one common baseline:\n1) ${PARTY.hero}.\n2) ${PARTY.brigitta}.\n3) ${PARTY.sylvain}.\n4) ${PARTY.marta}.\nAll four clearly face the left edge of the image.\n\n${CHROMA.magenta}`,
    },
    {
      id: 'mons', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH}\n\nEnemy battle sprites for a side-view JRPG: the enemies stand on the LEFT side of the battle screen and face RIGHT toward the heroes. Three monsters in one row, each shown whole in side / three-quarter view FACING RIGHT (heads and eyes toward the right edge of the image), menacing but readable, similar on-screen size to each other:\n1) ${MONS.jelly} (smallest).\n2) ${MONS.wolf}.\n3) ${MONS.goblin}.\nAll three clearly face the right edge of the image. Do not draw the reference characters.\n\n${CHROMA.magenta}`,
    },
    {
      id: 'bbg', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH} Do not draw any character.\n\nA side-view JRPG battle background, landscape: a sunny grassland at the foot of distant blue mountains with a few soft clouds. Low camera looking slightly down at a wide flat grassy battle ground that fills the lower 60% of the image (plenty of open ground where two groups of fighters will stand, left and right), gentle path and a few flowers and stones near the edges only, trees framing the far left and far right at the back. Horizon at about 38% from the top. No characters, no creatures, no text, no UI.`,
    },
    {
      id: 'ground', aspect: '1:1', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH} Do not draw any character.\n\nA texture sheet for a top-down (overhead, 3/4 JRPG map) game: a 3×3 grid of nine square seamless tileable ground textures, each seen straight from above, evenly lit, no perspective, no objects, no borders between cells (cells touch edge to edge, the grid is exact thirds of the image). Row 1: lush short grass; grass with small wildflowers; packed dirt road. Row 2: town cobblestone pavement; warm sand; deep blue sea water with small wave highlights. Row 3: dark dungeon stone-slab floor; wooden plank floor; fresh snow. Scale: each cell covers about 4×4 steps of a walking character.`,
    },
    {
      id: 'town', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH} Do not draw any character.\n\nTown map objects for a top-down JRPG in classic 3/4 overhead view (we see the roof from above and the front wall of each building facing the viewer, like a 16-bit JRPG town but high-resolution and illustrated). A sprite sheet of separate objects: a European half-timbered house with a red-orange tiled roof, a front door and two windows; a stone inn with a blue slate roof and a hanging sign; a round leafy deciduous tree; a small bush; a stone well; an iron street lamp; two wooden barrels; a short wooden fence piece; a flower planter box. Each object whole, upright, lit from the upper left.\n\n${CHROMA.magenta}`,
    },
    {
      id: 'world', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH} Do not draw any character.\n\nWorld map objects for a top-down JRPG overworld seen from a high 3/4 overhead angle (miniature diorama feeling, high-resolution illustration): a dense forest clump of many overlapping round tree crowns; a small pine forest clump; a rocky mountain with a snowy peak; a smaller grassy hill; a walled town seen from above with a few red roofs; a stone castle with blue spires; a wooden bridge; a small lighthouse. Each object separate and whole, lit from the upper left.\n\n${CHROMA.magenta}`,
    },
    {
      id: 'dungeon', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH} Do not draw any character.\n\nDungeon map pieces for a top-down JRPG in 3/4 overhead view (we see the top of the walls and their front faces), an ancient stone cave-temple: a straight segment of mossy gray stone-brick wall seen from the front with its top edge (a wide horizontal piece), a thick stone pillar, a wall torch with a warm flame, a wooden treasure chest with iron bands, a stone staircase going down (hole in the floor), a pile of rubble, a cracked stone statue. Each object separate and whole.\n\n${CHROMA.magenta}`,
    },
    {
      id: 'field', aspect: '16:9', size: '2K', refs: ['party'],
      prompt: `${L}\n${MATCH}\n\nField walking sprites for a top-down JRPG map (3/4 overhead view, characters seen slightly from above), full body, small-map proportions (big head, about 3 heads tall). Row of seven figures, same scale: the hero from the reference image (chestnut hair, white quill, royal-blue tunic, longsword on his back) seen from the FRONT (facing down/toward the viewer), from the BACK, and from the LEFT SIDE mid-step; then four townspeople seen from the front: a plump merchant with an apron, an old man with a cane and white beard, a young village girl in a green dress, a town guard with a spear.\n\n${CHROMA.magenta}`,
    },
  ];
}

async function main() {
  const styles = (arg('--style', 'anime,chibi,storybook')).split(',');
  const want = arg('--jobs', null);
  const model = arg('--model', 'gemini-3-pro-image');
  const tag = arg('--tag', '');
  const conc = +arg('--conc', 3);
  const queue = [];
  for (const s of styles) {
    const S = STYLES[s];
    if (!S) throw new Error('unknown style ' + s);
    for (const j of jobs(S)) if (!want || want.split(',').includes(j.id)) queue.push({ s, j });
  }
  const file = (s, id, t) => path.join(RAW, s, id + (t ? '.' + t : '') + '.png');
  const findRef = (s, id) => {
    for (const ext of ['.png', '.jpg', '.webp']) { const f = path.join(RAW, s, id + ext); if (fs.existsSync(f)) return f; }
    return null;
  };
  const extra = arg('--prompt-extra', '');
  // party first (the others use it as a reference)
  queue.sort((a, b) => (a.j.refs.length ? 1 : 0) - (b.j.refs.length ? 1 : 0));
  const first = queue.filter((q) => !q.j.refs.length), rest = queue.filter((q) => q.j.refs.length);
  const run = async (q) => {
    const out = file(q.s, q.j.id, tag);
    if (!has('--force') && ['.png', '.jpg'].some((e) => fs.existsSync(out.replace(/\.png$/, e)))) { console.log('skip', path.relative(ROOT, out)); return; }
    const refs = (arg('--refs', null) != null ? arg('--refs').split(',').filter(Boolean) : q.j.refs).map((r) => findRef(q.s, r)).filter(Boolean);
    if (has('--dry')) { console.log(`[dry] ${q.s}/${q.j.id} refs=${refs.length}\n${q.j.prompt}\n`); return; }
    const t0 = Date.now();
    try {
      const r = await GI.generate({ model, prompt: q.j.prompt + (extra ? '\n' + extra : ''), refs, aspect: q.j.aspect, size: q.j.size, out, purpose: `${q.s}/${q.j.id}`, log: console.log });
      console.log(`ok ${path.relative(ROOT, r.file)} ${(r.bytes.length / 1024).toFixed(0)}KB ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) { console.log(`FAIL ${q.s}/${q.j.id}: ${GI.redact(e.message)}`); }
  };
  const pool = async (list) => {
    const it = list[Symbol.iterator]();
    await Promise.all(Array.from({ length: conc }, async () => { for (let n = it.next(); !n.done; n = it.next()) await run(n.value); }));
  };
  await pool(first);
  await pool(rest);
  const c = GI.count();
  console.log(`API calls logged so far: ${c.calls}`, JSON.stringify(c.byModel));
}
if (require.main === module) main().catch((e) => { console.error(GI.redact(e.stack || e)); process.exit(1); });
module.exports = { jobs };
