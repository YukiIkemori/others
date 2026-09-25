// Character art engine (party & NPC field sprites, 16x24, 4 dirs x 2 frames).
// Sprites are composed from small hand-authored ASCII layers (chars_parts.js,
// chars_npc.js, chars_party.js, chars_story.js, chars_town.js) and recoloured per
// character / NPC through a semantic palette:
//
//   k outline  w white  e eye  m blush/mouth   s d t  skin mid/dark/light
//   1 2 3 4    hair dark → highlight
//   A B C      main  (outfit.main)   dark/mid/light
//   D E F      sub   (outfit.sub)
//   G H I      trim  (outfit.trim)
//   L M N      leather   X Y Z steel   P Q R accent   U V W accent 2
//   x          erase (clears the pixel of the layers below)
//
// Layers never draw the silhouette outline: compose() adds a 1px dark outline
// around the finished figure, so parts only author fills and inner lines.
// Frames are cached by R.Gfx (one sheet per key, built on first use).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});
  CA.parts = CA.parts || {};
  CA.npcs = CA.npcs || {};

  const W = 16, H = 24;
  const OUTLINE = '#1c1420'; // the figure outline `k` (DESIGN §11.3.1)
  CA.W = W; CA.H = H; CA.OUTLINE = OUTLINE;

  // --------------------------------------------------------------- colours
  function rgb(h) { return R.Gfx.hexToRgb(h); }
  function hex(r, g, b) { return R.Gfx.rgbToHex(clamp(r), clamp(g), clamp(b)); }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function lum(h) { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  /**
   * 3-step SFC ramp [dark, mid, light] around a base colour: shadows lean
   * cool/violet, highlights warm. Very dark bases get lifted so the dark step
   * still reads against the outline; very light bases get a visible shadow.
   */
  function ramp(base) {
    const L = lum(base);
    if (L > 0.8) {
      // white / cream cloth: bright highlight, soft cool shadow
      const mid = mix(base, '#c8cce0', 0.22);
      return [mix(base, '#6a7098', 0.42), mid, mix(base, '#ffffff', 0.75)];
    }
    let mid = base;
    if (L < 0.14) mid = mix(base, '#6a6488', 0.22);
    let dark = mix(mix(mid, '#000000', 0.42), '#281850', 0.18);
    if (lum(dark) < 0.07) dark = mix(dark, '#403858', 0.35);
    const light = mix(mix(mid, '#ffffff', 0.34), '#fff4d0', 0.12);
    return [dark, mid, light];
  }
  CA.ramp = ramp; CA.mix = mix; CA.lum = lum;

  const BASE_PAL = {
    k: OUTLINE, w: '#f8f8f8', e: '#1c1430', m: '#f09890',
    i: '#b4a488', j: '#f2ead4', o: '#c0203c', O: '#ff90a0',
    s: '#f4c8a0', d: '#d4966c', t: '#fde6cc',
    L: '#5a3420', M: '#8a5a34', N: '#b88450',
    X: '#5c6478', Y: '#9ca4b8', Z: '#dce2ee',
  };
  CA.BASE_PAL = BASE_PAL;

  /** fill a palette's three letters from a ramp */
  function put(pal, letters, base) {
    const r = ramp(base);
    pal[letters[0]] = r[0]; pal[letters[1]] = r[1]; pal[letters[2]] = r[2];
    return pal;
  }
  CA.put = put;
  /** palette from colour groups: {main, sub, trim, leather, steel, acc, acc2, hair:[4], skin:[d,s,t]} */
  function palette(o) {
    const p = Object.assign({}, BASE_PAL);
    if (o.main) put(p, 'ABC', o.main);
    if (o.sub) put(p, 'DEF', o.sub);
    if (o.trim) put(p, 'GHI', o.trim);
    if (o.leather) put(p, 'LMN', o.leather);
    if (o.steel) put(p, 'XYZ', o.steel);
    if (o.acc) put(p, 'PQR', o.acc);
    if (o.acc2) put(p, 'UVW', o.acc2);
    if (o.hair) { p[1] = o.hair[0]; p[2] = o.hair[1]; p[3] = o.hair[2]; p[4] = o.hair[3]; }
    if (o.skin) { p.d = o.skin[0]; p.s = o.skin[1]; p.t = o.skin[2]; }
    if (o.eye) p.e = o.eye;
    if (o.extra) Object.assign(p, o.extra);
    return p;
  }
  CA.palette = palette;

  // --------------------------------------------------------------- layers
  // A layer is {y, g:[rows]} (rows ≤ 16 chars, x from 0) or {y, x, g}.
  // Directions in part tables: down, up, right (left = mirrored right).
  const pad = (row) => (row.length >= W ? row.slice(0, W) : row + '.'.repeat(W - row.length));
  function mirrorRows(g) { return g.map((r) => pad(r).split('').reverse().join('')); }
  CA.mirrorRows = mirrorRows;

  /** stamp a layer into a pixel array (null = transparent); rows above clipY are skipped */
  function stamp(buf, layer, pal, flip, dy, clipY) {
    const g = flip ? mirrorRows(layer.g) : layer.g;
    const oy = (layer.y || 0) + (dy || 0), ox = flip ? -(layer.x || 0) : layer.x || 0;
    for (let j = 0; j < g.length; j++) {
      const row = g[j], y = oy + j;
      if (y < 0 || y >= H || (clipY && y - (dy || 0) < clipY)) continue;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const x = ox + i;
        if (x < 0 || x >= W) continue;
        if (ch === 'x') { buf[y * W + x] = null; continue; }
        const col = pal[ch];
        if (col === undefined) { if (!CA._warn[ch]) { CA._warn[ch] = 1; R.warn('char art: no colour for', ch); } continue; }
        buf[y * W + x] = col;
      }
    }
  }
  CA._warn = {};

  /** 1px outline around opaque pixels (4-neighbour) */
  function outline(buf, col) {
    const src = buf.slice();
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[y * W + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) buf[y * W + x] = col;
    }
  }

  function toCanvas(buf) {
    const p = R.Gfx.pix(W, H);
    for (let i = 0; i < buf.length; i++) p.d[i] = buf[i];
    return p.toCanvas();
  }

  /** a colour pixel on the frame edge has no room for its outline: it becomes the outline */
  function closeEdges(buf, col) {
    const c = col || OUTLINE;
    for (let x = 0; x < W; x++) if (buf[x]) buf[x] = c;
    for (let y = 0; y < H; y++) { if (buf[y * W]) buf[y * W] = c; if (buf[y * W + W - 1]) buf[y * W + W - 1] = c; }
  }
  CA.closeEdges = closeEdges;
  /** stamp items [{layer, flip, dy, pal, clipY}] in order, then outline the silhouette */
  function frame(items, pal) {
    const buf = new Array(W * H).fill(null);
    for (const it of items) if (it && it.layer) stamp(buf, it.layer, it.pal || pal, it.flip, it.dy, it.clipY);
    closeEdges(buf);
    outline(buf, OUTLINE);
    return buf;
  }
  CA.frame = frame; CA.toCanvas = toCanvas; CA.stamp = stamp; CA.outline = outline;

  /**
   * Build a full sheet {down,up,left,right} x [f0,f1] from a figure spec
   * {capeBack, body, cape, head, hair, beard, hat, over, dy, bob}; each slot is a
   * part {down, up, right} (a layer or [f0, f1] per direction) or an array of
   * parts. Left is the mirrored right.
   */
  function sheet(spec, pal) {
    const out = { down: [], up: [], left: [], right: [] };
    for (const dir of ['down', 'up', 'right']) {
      for (let f = 0; f < 2; f++) out[dir].push(toCanvas(figure(spec, pal, dir, f)));
    }
    out.left = out.right.map((c) => R.Gfx.flipH(c));
    return out;
  }
  CA.sheet = sheet;

  // draw order per direction (the cape hangs behind the body except seen from behind)
  const ORDER = {
    down: ['capeBack', 'body', 'head', 'hair', 'beard', 'hat', 'over'],
    up: ['body', 'cape', 'head', 'hair', 'beard', 'hat', 'over'],
    right: ['capeBack', 'body', 'head', 'hair', 'beard', 'hat', 'over'],
  };

  /** palette with letters redirected: map {B:'E'} makes 'B' draw in the colour of 'E' */
  function remap(pal, map) {
    const key = JSON.stringify(map);
    pal._remap = pal._remap || {};
    if (pal._remap[key]) return pal._remap[key];
    const out = Object.assign({}, pal);
    for (const k in map) out[k] = pal[map[k]];
    delete out._remap;
    pal._remap[key] = out;
    return out;
  }
  CA.remap = remap;
  /** a part with extra per-use options ({map, clipY, dy, walk}) without copying its layers */
  function use(part, opts) { return part ? Object.assign(Object.create(part), opts) : null; }
  CA.use = use;

  /** compose one frame of a figure spec → pixel array */
  function figure(spec, pal, dir, f) {
    const items = [];
    const srcDir = dir === 'left' ? 'right' : dir;
    const flipAll = dir === 'left';
    const bob = spec.bob ? spec.bob[f] || 0 : 0;
    for (const slot of ORDER[srcDir]) {
      let parts = spec[slot];
      if (!parts) continue;
      if (!Array.isArray(parts)) parts = [parts];
      for (const part of parts) {
        if (!part) continue;
        const v = part[srcDir];
        if (!v) continue;
        let layer, flip = false;
        if (Array.isArray(v)) {
          layer = v[f] || v[0];
          if (!v[f] && f === 1 && srcDir !== 'right' && part.walk !== false) flip = true;
        } else {
          layer = v;
          // single down/up layer + walk part → frame 1 mirrored
          if (f === 1 && srcDir !== 'right' && part.walk) flip = true;
        }
        const dy = (part.still ? 0 : bob) + (spec.dy || 0) + (part.dy || 0);
        items.push({ layer, flip: flip !== flipAll, dy, pal: part.map ? remap(pal, part.map) : part.pal, clipY: part.clipY });
      }
    }
    return frame(items, pal);
  }
  CA.figure = figure;


  // ------------------------------------------------------------ colour tables
  // Skin [dark, mid, light] and hair [dark → light] by name (DESIGN §5.3.7).
  CA.SKIN = {
    A: ['#d8966a', '#f4c49c', '#fde2c8'],
    B: ['#b87850', '#dca47c', '#f0c8a0'],
    C: ['#8c5a3c', '#b8805c', '#d8a47c'],
    forest: ['#dca47c', '#fcdcc0', '#fff4e8'],
    pale: ['#b8a8a8', '#e0d0cc', '#f4ece8'],
  };
  CA.HAIR = {
    brown: ['#2e1c14', '#553420', '#7c5030', '#a87848'],
    black: ['#141018', '#28242e', '#403a48', '#605a6c'],
    blond: ['#7c5418', '#b8862c', '#e0b850', '#f8e090'],
    red: ['#4c1810', '#88301c', '#b8502c', '#e08050'],
    grey: ['#4c4c58', '#80808c', '#b0b0bc', '#e0e0e8'],
    white: ['#707084', '#a8a8b8', '#d8d8e4', '#ffffff'],
    auburn: ['#3c1c18', '#6c3424', '#9c5634', '#c88050'],
    green: ['#1c3c2c', '#2c6a44', '#48a060', '#88d090'],
    chestnut: ['#3c2414', '#6c4424', '#9c6c3c', '#c89860'],   // the hero (§5.2.8)
  };
  const colorsOf = (tbl, v) => (Array.isArray(v) ? v : tbl[v]) || null;
  CA.hairColors = (v) => colorsOf(CA.HAIR, v);
  CA.skinColors = (v) => colorsOf(CA.SKIN, v || 'A');

  // ------------------------------------------------------------ parts by name
  // Tables name their parts ('hairPony', 'face.old', 'over.quill', 'beard'):
  // a part that does not exist yet is drawn with its stand-in (DESIGN §5.3.8 「代わり」)
  // and the sprite is listed in R.Art.PENDING.
  CA.PART_FALLBACK = {
    hairPony: 'hairNon', hairTail: 'hairShort', hairBraid: 'hairLong', hairCurly: 'hairNon', hairCrop: 'hairShort',
    hairWave: 'hairLong', hairHime: 'hairLong', hairSide: 'hairMetem', hairHeroM: 'hairYuki', hairHeroF: 'hairNon',
    'face.old': 'face.boy', 'face.narrow': 'face.sharp',
    'over.eyepatch': null, 'over.freckles': null, 'over.earrings': null, 'over.quill': null,
  };
  function lookPart(name) {
    const P = CA.parts, i = name.indexOf('.');
    if (i < 0) return P[name] || null;
    const grp = P[name.slice(0, i)];
    return (grp && grp[name.slice(i + 1)]) || null;
  }
  /** a part object from its name (objects pass through); missing → stand-in or null */
  function part(name) {
    if (!name) return null;
    if (typeof name !== 'string') return name;
    const p = lookPart(name);
    if (p) return p;
    if (name in CA.PART_FALLBACK) { const f = CA.PART_FALLBACK[name]; return f ? lookPart(f) : null; }
    if (!CA._warn['part:' + name]) { CA._warn['part:' + name] = 1; R.warn('char art: no part', name); }
    return null;
  }
  CA.part = part;
  CA.hasPart = (name) => typeof name !== 'string' || !!lookPart(name);

  // ------------------------------------------------------------ party
  // DESIGN §5.2.8 · §5.3.7 · §11.3.2. Every party member (20 companions + the
  // hero in 2 genders × 5 types) is a CA.parts.party[id] entry (chars_party.js):
  //   {gender, skin, hair, eye, face, hairPart, beard, over[], small,
  //    style:{body, bodyF, variant, hat, cape, bodyMap, capeMap, hatMap, colors(o)},
  //    outfit:{main, sub, trim}, colors:{leather, steel, acc, acc2}, extra}
  // registered at load time as 'party:<id>'. The key is always built by
  // R.Party.spriteKey(c); CA.heroSpriteId() gives the hero's id for a gender/type.
  CA.HERO_TYPES = ['warrior', 'ranger', 'mage', 'spellblade', 'wanderer'];
  CA.COMPANION_IDS = ['selma', 'hagen', 'dokka', 'basil', 'bartolo', 'viola', 'shigure', 'rouga', 'titta', 'brigitta',
    'sylvain', 'zafira', 'ferno', 'belladonna', 'boden', 'teo', 'ilse', 'morga', 'marta', 'noela'];
  CA.HERO_IDS = [];
  for (const g of ['m', 'f']) for (const t of CA.HERO_TYPES) CA.HERO_IDS.push('hero_' + g + '_' + t);
  CA.PARTY_IDS = CA.COMPANION_IDS.concat(CA.HERO_IDS);
  /** 'hero_<m|f>_<type>' (unknown type → warrior) */
  CA.heroSpriteId = (gender, type) => 'hero_' + (gender === 'f' ? 'f' : 'm') + '_' + (CA.HERO_TYPES.includes(type) ? type : 'warrior');

  const KID = 3; // small folk (dwarf, children): head parts sit 3px lower
  CA.KID = KID;

  /** figure spec for a party entry (girls' body variant, hair clipped under the hat, small folk lowered) */
  CA.partySpec = function (who, style) {
    const P = CA.parts;
    style = style || who.style || {};
    const fem = who.gender === 'f';
    const body = P.body[style.variant || (fem && style.bodyF) || style.body];
    const hat = style.hat ? P.hat[style.hat] : null;
    const cape = style.cape ? P.cape[style.cape] : null;
    const low = (p) => (p && who.small ? use(p, { dy: KID + (p.dy || 0) }) : p);
    let hair = (Array.isArray(who.hairPart) ? who.hairPart : [who.hairPart]).map(part).filter(Boolean);
    if (hat && hat.hairClip) hair = hair.map((h) => use(h, { clipY: hat.hairClip }));
    const head = who.head || [P.head, part('face.' + (who.face || 'boy'))];
    const over = [];
    // a ribbon / bow that shows through headgear (hat.bow = per-direction [x, y])
    if (hat && hat.bow && who.bow) {
      const b = {};
      for (const d of ['down', 'up', 'right']) if (hat.bow[d]) b[d] = { x: hat.bow[d][0], y: hat.bow[d][1], g: who.bow };
      over.push(b);
    }
    for (const o of who.over || []) {
      const p = part(o.indexOf('.') < 0 ? 'over.' + o : o);
      if (p) over.push(p.attach === 'body' ? p : low(p));
    }
    return {
      capeBack: cape && cape.back ? use(cape.back, { map: style.capeMap }) : null,
      cape: cape ? use(cape, { map: style.capeMap }) : null,
      body: use(body, { map: style.bodyMap }),
      head: head.map((h) => low(part(h))),
      hair: hair.map(low),
      beard: who.beard ? low(part(who.beard)) : null,
      hat: hat ? low(use(hat, { map: style.hatMap })) : null,
      over,
      bob: who.bob,
    };
  };

  /** palette for a party entry */
  CA.partyPalette = function (who) {
    const st = who.style || {}, o = who.outfit || {};
    const cols = Object.assign({ main: o.main, sub: o.sub, trim: o.trim }, st.colors ? st.colors(o) : null);
    return palette(Object.assign({ leather: '#8a5a34', steel: '#9ca4b8', acc: '#d83c5c', acc2: '#44405c' }, cols, who.colors || null, {
      hair: CA.hairColors(who.hair), skin: CA.skinColors(who.skin), eye: who.eye || '#1c1430', extra: who.extra,
    }));
  };

  /** the sheet {down,up,left,right}×[f0,f1] of a party entry */
  function charSheet(id) {
    const who = CA.parts.party && CA.parts.party[id];
    if (!who) return null;
    return sheet(CA.partySpec(who), CA.partyPalette(who));
  }
  CA.charSheet = charSheet;

  /** names of the parts an entry uses that are not drawn yet (→ stand-in) */
  CA.pendingParts = function (who) {
    const names = [].concat(who.hairPart || [], who.face ? ['face.' + who.face] : [], who.beard || [],
      (who.over || []).map((o) => (o.indexOf('.') < 0 ? 'over.' + o : o)));
    return names.filter((n) => typeof n === 'string' && !CA.hasPart(n));
  };

  const PENDING = (A.PENDING = A.PENDING || []);
  for (const id in CA.parts.party || {}) {
    R.Gfx.def('party:' + id, () => charSheet(id) || R.Gfx.placeholder(16, 24));
    if (CA.pendingParts(CA.parts.party[id]).length) PENDING.push('party:' + id);
  }

  // ------------------------------------------------------------ NPCs
  /** recolour every frame of a sheet (stand-ins while a type is not drawn) */
  function recolorSheet(sh, o) {
    if (!sh || !o) return sh;
    const out = {};
    for (const d of ['down', 'up', 'left', 'right']) out[d] = (sh[d] || []).map((c) => R.Gfx.hsvShift(c, o.hue || 0, o.sat == null ? 1 : o.sat, o.bri == null ? 1 : o.bri));
    return out;
  }
  CA.recolorSheet = recolorSheet;
  /** stand-in type (+ recolour) for NPC types that are not drawn yet (DESIGN §11.3.3 · §11.3.4) */
  CA.NPC_FALLBACK = {
    berna: ['old_woman'], rowell: ['scholar', { sat: 0.15, bri: 1.6 }], fine: ['nun', { sat: 0, bri: 1.8 }], fine_fade: ['fine'],
    lazaro: ['sage', { sat: 0.1, bri: 1.5 }], scribe: ['priest', { sat: 0.1 }], bartender: ['innkeeper'],
    bard: ['man'], farmer: ['man'], miner: ['dwarf'], noble: ['minister'], fisher: ['sailor'], teller: ['sage'],
    nomad: ['merchant'], priestess: ['nun'], sheep: ['dog'], chicken: ['dog'],
  };
  /** NPC sheet from CA.npcs[type] = {spec() → figure spec, pal: palette groups} or {build() → sheet} */
  CA.npcSheet = function (type) {
    const n = CA.npcs[type];
    if (!n) {
      const fb = CA.NPC_FALLBACK[type];
      return fb ? recolorSheet(CA.npcSheet(fb[0]), fb[1]) : null;
    }
    if (n.build) return n.build();
    return sheet(n.spec(), palette(Object.assign({ acc2: '#44405c', acc: '#d83c5c' }, n.pal)));
  };
  CA.NPC_TYPES = ['king', 'queen', 'princess', 'minister', 'soldier', 'knight', 'old_man', 'old_woman', 'man',
    'woman', 'boy', 'girl', 'merchant', 'innkeeper', 'priest', 'nun', 'sage', 'elder', 'sailor', 'captain',
    'bandit', 'elf', 'dwarf', 'scholar', 'dancer', 'spirit', 'demon', 'ghost', 'cat', 'dog',
    // Chronicle: fixed story characters (§11.3.3) and town folk (§11.3.4)
    'berna', 'rowell', 'fine', 'fine_fade', 'lazaro', 'scribe', 'bartender',
    'bard', 'farmer', 'miner', 'noble', 'fisher', 'teller', 'nomad', 'priestess', 'sheep', 'chicken'];
  for (const t of CA.NPC_TYPES) {
    R.Gfx.def('npc:' + t, () => CA.npcSheet(t) || R.Gfx.placeholder(16, 24));
    if (!(t in CA.npcs)) PENDING.push('npc:' + t);
  }
})(window.RPG);
