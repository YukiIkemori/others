#!/usr/bin/env node
// Battle pose sheets / cut-out parts for one character from a reference sprite (BRIEF Part A16 prototype).
//
//   node tools/art_pose.js --style anime --ref design/art_proto/ref/anime_hero.png --who "the hero" --weapon sword
//        [--jobs poses,parts] [--tag v1]
// → design/art_proto/raw/<style>/pose_<job>[.<tag>].png   (then tools/art_key.py sprites … to cut them out)
'use strict';
const path = require('path');
const GI = require('./lib/gemini_image.js');
const { STYLES, CHROMA } = require('./lib/art_style.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..');

const WEAPON_ACTS = {
  sword: 'raising the sword high behind the head (wind-up); a wide downward slash finished low in front (follow-through)',
  spear: 'drawing the spear back at the hip (wind-up); a long forward thrust with the arms extended (follow-through)',
  bow: 'nocking an arrow and drawing the bow string to the cheek (wind-up); the arrow just released, bow arm extended (follow-through)',
  staff: 'lifting the staff overhead with both hands (wind-up); swinging the staff down in front (follow-through)',
};

function jobs(S, who, weapon) {
  const keep = `Keep the character IDENTICAL to the reference image: same face, hair, outfit colors, armor pieces, bag, boots and ${weapon}, same art style, same scale, same line weight.`;
  return {
    poses: {
      aspect: '21:9', size: '2K',
      prompt: `${S.look}\n\nAnimation key-pose sheet for a side-view JRPG battle sprite of ${who} shown in the reference image. ${keep}\nEight full-body poses in ONE row, left to right, evenly spaced with wide empty gaps, all at exactly the same scale as each other, feet on a common baseline, EVERY pose facing LEFT (toward the enemies):\n1) idle: relaxed battle stance, ${weapon} ready;\n2) run: dashing toward the left, leaning forward, one foot off the ground;\n3) wind-up: ${(WEAPON_ACTS[weapon] || WEAPON_ACTS.sword).split(';')[0]};\n4) strike: ${((WEAPON_ACTS[weapon] || WEAPON_ACTS.sword).split(';')[1] || '').trim()}, body leaning into the blow;\n5) hurt: recoiling backward to the right, head snapped back, eyes shut, arms thrown out;\n6) weak: kneeling on one knee, leaning on the ${weapon}, panting;\n7) knocked out: lying flat on the ground on his side, eyes closed, ${weapon} dropped beside him;\n8) victory: ${weapon} raised high, confident grin.\nThe character's proportions (about 2.5–3 heads tall) must stay the same in every pose.\n\n${CHROMA.magenta}`,
    },
    parts: {
      aspect: '16:9', size: '2K',
      prompt: `${S.look}\n\nCut-out animation parts for a 2D skeletal rig (like Spine / Live2D-lite), made from ${who} in the reference image. ${keep}\nDraw the character's separate body parts laid out apart from each other with gaps, each part complete including the areas normally hidden by overlapping (so the parts can rotate without holes), all in the same side view facing LEFT and the same scale as the reference: the head with hair and quill; the torso with the tunic skirt; the upper and lower back arm; the front arm holding the ${weapon} (upper arm, forearm with hand and ${weapon} as one piece); the front thigh+shin+boot; the back thigh+shin+boot. Also draw one assembled full-body idle pose on the far left for reference.\n\n${CHROMA.magenta}`,
    },
  };
}

async function main() {
  const style = arg('--style', 'anime');
  const S = STYLES[style];
  const ref = path.resolve(arg('--ref'));
  const who = arg('--who', 'the character');
  const weapon = arg('--weapon', 'sword');
  const tag = arg('--tag', '');
  const J = jobs(S, who, weapon);
  const want = arg('--jobs', 'poses').split(',');
  await Promise.all(want.map(async (id) => {
    const j = J[id];
    const out = path.join(ROOT, 'design/art_proto/raw', style, `pose_${id}${tag ? '.' + tag : ''}.png`);
    try {
      const r = await GI.generate({ model: arg('--model', 'gemini-3-pro-image'), prompt: j.prompt, refs: [ref], aspect: j.aspect, size: j.size, out, purpose: `${style}/pose_${id}` });
      console.log('ok', path.relative(ROOT, r.file));
    } catch (e) { console.log('FAIL', id, GI.redact(e.message)); }
  }));
  console.log('API calls logged so far:', GI.count().calls);
}
main();
