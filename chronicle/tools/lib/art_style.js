// Style guide prompts for the hi-res art (BRIEF Part A16). One place for every sentence that decides the look, so
// that the prototype and the later mass production use the very same words. See design/art_proto/PLAN.md §4.
'use strict';

/** candidate styles (prototype). Each: {id, name, look (appended to every prompt), chars, mons, env} */
const STYLES = {
  anime: {
    id: 'anime',
    name: 'A 厚塗りアニメ調（HD イラスト JRPG）',
    look: 'Polished high-resolution 2D fantasy JRPG game art in a modern anime illustration style: clean confident dark-brown lineart with varied weight, soft painterly cel shading with subtle gradients, warm key light from the upper left and a thin cool rim light, rich saturated but harmonious colors, crisp readable silhouettes. Looks like official in-game art of a premium console 2D RPG. Not pixel art, not 3D render, not photo.',
    body: 'stylized proportions about 5 heads tall',
  },
  chibi: {
    id: 'chibi',
    name: 'B セル調ちびキャラ',
    look: 'Cute high-resolution 2D chibi JRPG game art: clean vector-like shapes, bold smooth dark outlines, crisp two-tone cel shading with one soft highlight, glossy vibrant candy colors, big expressive eyes, charming toy-like forms. Looks like a premium console/mobile chibi RPG. Not pixel art, not 3D render.',
    body: 'chibi proportions about 2.5 heads tall with a big head',
  },
  storybook: {
    id: 'storybook',
    name: 'C 絵本の水彩（語り部の年代記）',
    look: 'Hand-painted storybook illustration for a 2D fantasy RPG: delicate sepia ink linework, transparent watercolor washes with soft edges, gentle color bleeding and fine paper grain, warm muted palette with a few jewel-tone accents, like a classic European fairy-tale picture book brought to life as a game. Not pixel art, not 3D render.',
    body: 'gently stylized proportions about 4 heads tall',
  },
};

/** background rule for cut-out sprites: a flat key color the keyer removes (tools/art_key.py) */
const CHROMA = {
  magenta: 'The background must be one perfectly flat solid pure magenta color (#FF00FF) filling the whole image edge to edge: no gradient, no vignette, no floor, no ground line, no cast shadow, no reflections, no frame, no text, no labels, no watermark. Nothing in the subjects uses magenta or pink. Every subject is complete (never cropped by the image edge) and separated from the others by wide empty magenta gaps.',
};

const PARTY = {
  hero: 'the hero: a 17-year-old young man, messy chestnut hair, a white feather quill tucked behind his right ear, friendly determined face, royal-blue tunic with a steel-gray shoulder guard and small gold trim, brown leather belt, satchel and boots, holding a steel longsword',
  brigitta: 'Brigitta: a 23-year-old woman soldier, auburn hair in a long braid, sharp eyes, olive-green padded gambeson with steel plates and bronze trim, holding a long iron spear',
  sylvain: 'Sylvain: a forest elf man with long green hair, long pointed ears, calm narrow eyes, dark teal hunter tunic with brown leather bracers and a feathered cap, holding a wooden longbow',
  marta: 'Marta: a gentle 34-year-old woman town doctor, brown hair in a low bun, cream-white long coat with a blue scarf and a red cross-shaped pin, holding a wooden staff with a small blue crystal',
};

const MONS = {
  jelly: 'Puchi Jelly: a small round translucent teal-green jelly slime with a glowing golden core inside, two cute black eyes, glossy highlights',
  wolf: 'Frost-fang Wolf: a lean pale blue-gray wolf with frost crystals and icicle spikes along its back and tail, bared white fangs, fierce yellow eyes, prowling stance',
  goblin: 'Goblin Axeman: a stocky green goblin with pointy ears, yellow eyes and small tusks, a battered dome iron helmet, brown leather armor with a belt, gripping a one-handed battle axe',
};

module.exports = { STYLES, CHROMA, PARTY, MONS };
