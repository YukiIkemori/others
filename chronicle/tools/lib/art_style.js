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

// ---- round 2 (BRIEF A16 追記): small 2.5–3-head characters, very detailed sprites, lit layered environments.
// No commercial title is named anywhere: the look is described by its traits only.
const R2_BODY = 'small-statured characters about 2.5 to 3 heads tall (large head, compact body, short legs, NOT realistic proportions and NOT super-deformed), with highly detailed costumes: layered cloth, stitching, buckles, metal highlights';
const R2_WORLD = 'the look of a modern "HD-2D" style fantasy JRPG: detailed sprites placed in atmospheric diorama-like environments with depth, warm light, soft shadows, dappled sunlight and a slightly miniature feeling';
STYLES.hdpix = {
  id: 'hdpix',
  name: 'V1 精細ドット（HD-2D 風）',
  look: `Exquisite high-resolution PIXEL ART for ${R2_WORLD}. Crisp, clean, deliberate pixels on a visible pixel grid (every pixel about the same size, no blur, no smeared anti-aliasing), a rich palette with many subtle color ramps, careful pixel clusters, hue-shifted shading, bright warm rim light along the lit edges and a thin dark outline only where needed. Top-tier modern pixel artist quality, far more detailed than 16-bit sprites. Not a painting, not 3D render, not vector.`,
  body: R2_BODY,
  pixel: true,
};
STYLES.hdpaint = {
  id: 'hdpaint',
  name: 'V2 滑らか手描き（HD-2D 風）',
  look: `Exquisite high-resolution hand-painted 2D sprite art for ${R2_WORLD}. Smooth painterly rendering with soft gradients and crisp clean silhouettes, fine detail, rich but harmonious colors, warm key light from the upper left, bright rim light on the edges, subtle ambient occlusion. Premium console quality. Not pixel art, not 3D render, not flat vector.`,
  body: R2_BODY,
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
