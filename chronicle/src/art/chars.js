// Character art engine (party & NPC field sprites, 16x24, 4 dirs x 2 frames).
// Sprites are composed from small hand-authored ASCII layers (chars_parts.js,
// chars_npc.js) and recoloured per job/NPC through a semantic palette:
//
//   k outline  w white  e eye  m blush/mouth   s d t  skin mid/dark/light
//   1 2 3 4    hair dark → highlight
//   A B C      main  (job outfit.main)   dark/mid/light
//   D E F      sub   (job outfit.sub)
//   G H I      trim  (job outfit.trim)
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
  const OUTLINE = '#170f1f';
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

  /** stamp items [{layer, flip, dy, pal, clipY}] in order, then outline the silhouette */
  function frame(items, pal) {
    const buf = new Array(W * H).fill(null);
    for (const it of items) if (it && it.layer) stamp(buf, it.layer, it.pal || pal, it.flip, it.dy, it.clipY);
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

  // ------------------------------------------------------------ party
  const JOB_IDS = ['warrior', 'priest', 'mage', 'thief', 'knight', 'monk', 'whitemage', 'blackmage', 'hunter',
    'bard', 'alchemist', 'spellblade', 'paladin', 'ninja', 'sage', 'dragoon', 'timemage', 'darkknight', 'hero'];
  const CHAR_IDS = ['yuki', 'non', 'metem'];
  CA.JOB_IDS = JOB_IDS; CA.CHAR_IDS = CHAR_IDS;

  // Fallback outfits (used only if jobs data lacks one)
  const DEFAULT_OUTFIT = {
    warrior: ['#b8402c', '#8c94a4', '#e8b040'], priest: ['#eae6d8', '#3c6cc0', '#d8a838'],
    mage: ['#6a3aa8', '#2c2450', '#f0d060'], thief: ['#3e7a44', '#5a4030', '#c8c8c0'],
    knight: ['#c4ccd8', '#2c4c9c', '#e8c850'], monk: ['#e0782c', '#3a2c20', '#f0e0a8'],
    whitemage: ['#f6f6f2', '#c83c3c', '#e8b848'], blackmage: ['#24285a', '#16162a', '#f0d040'],
    hunter: ['#6a7c2c', '#8a5a2c', '#d8c890'], bard: ['#2ca0a4', '#e8e0a0', '#c8488c'],
    alchemist: ['#8c6a3c', '#e8dcc0', '#4aa04a'], spellblade: ['#3a44b8', '#b83c3c', '#e0e0e8'],
    paladin: ['#f0ecd8', '#c89830', '#4c7cd8'], ninja: ['#30303c', '#9c2c2c', '#a0a4b0'],
    sage: ['#2c8a5c', '#f0e4b8', '#e8b840'], dragoon: ['#4c3c90', '#2c8c8c', '#e0c858'],
    timemage: ['#c8a030', '#40285c', '#f0f0f0'], darkknight: ['#28202e', '#6c1a2c', '#8c8ca0'],
    hero: ['#2c5cd0', '#f4f4f8', '#f0c830'],
  };
  function outfitOf(job) {
    const j = R.DB.jobs && R.DB.jobs[job];
    const o = j && j.outfit;
    const d = DEFAULT_OUTFIT[job] || ['#6a7890', '#404858', '#d8c070'];
    return { main: (o && o.main) || d[0], sub: (o && o.sub) || d[1], trim: (o && o.trim) || d[2] };
  }
  CA.outfitOf = outfitOf;

  /** party sheet for a character in a job */
  function partySheet(charId, job) {
    const P = CA.parts;
    const who = P.party && P.party[charId];
    const style = (P.jobs && (P.jobs[job] || P.jobs._default)) || null;
    if (!who || !style) return null;
    const o = outfitOf(job);
    const cols = Object.assign({ main: o.main, sub: o.sub, trim: o.trim }, style.colors ? style.colors(o) : null);
    const pal = palette(Object.assign({ leather: '#8a5a34', steel: '#9ca4b8', acc2: '#44405c' }, cols, {
      hair: who.hair, skin: who.skin, acc: who.acc, eye: who.eye,
    }));
    return sheet(CA.partySpec(who, style), pal);
  }
  CA.partySheet = partySheet;

  /** figure spec for a character in a job style (girls' body variant, hair clipped under the hat) */
  CA.partySpec = function (who, style) {
    const P = CA.parts;
    const fem = who.gender === 'f';
    const body = P.body[(fem && style.bodyF) || style.body];
    const hat = style.hat ? P.hat[style.hat] : null;
    const cape = style.cape ? P.cape[style.cape] : null;
    let hair = who.hairPart;
    if (!Array.isArray(hair)) hair = [hair];
    if (hat && hat.hairClip) hair = hair.map((h) => use(h, { clipY: hat.hairClip }));
    const over = [];
    // Metem keeps a small ribbon on most headgear (hat.bow = per-direction [x, y])
    if (hat && hat.bow && who.bow) {
      const b = {};
      for (const d of ['down', 'up', 'right']) if (hat.bow[d]) b[d] = { x: hat.bow[d][0], y: hat.bow[d][1], g: who.bow };
      over.push(b);
    }
    return {
      capeBack: cape && cape.back ? use(cape.back, { map: style.capeMap }) : null,
      cape: cape ? use(cape, { map: style.capeMap }) : null,
      body: use(body, { map: style.bodyMap }),
      head: who.head,
      hair,
      hat: hat ? use(hat, { map: style.hatMap }) : null,
      over,
    };
  };

  /** register every party sheet (jobs from the design contract + any extra job ids found at boot) */
  function defParty(job) {
    for (const c of CHAR_IDS) {
      const key = 'party:' + c + ':' + job;
      if (!R.Gfx.has(key)) R.Gfx.def(key, () => partySheet(c, job) || R.Gfx.placeholder(16, 24));
    }
  }
  CA.defParty = defParty;
  for (const j of JOB_IDS) defParty(j);
  R.onBoot(() => { for (const j in R.DB.jobs) defParty(j); });

  // ------------------------------------------------------------ NPCs
  /** NPC sheet from CA.npcs[type] = {spec() → figure spec, pal: palette groups} or {build() → sheet} */
  CA.npcSheet = function (type) {
    const n = CA.npcs[type];
    if (!n) return null;
    if (n.build) return n.build();
    return sheet(n.spec(), palette(Object.assign({ acc2: '#44405c', acc: '#d83c5c' }, n.pal)));
  };
  CA.NPC_TYPES = ['king', 'queen', 'princess', 'minister', 'soldier', 'knight', 'old_man', 'old_woman', 'man',
    'woman', 'boy', 'girl', 'merchant', 'innkeeper', 'priest', 'nun', 'sage', 'elder', 'sailor', 'captain',
    'bandit', 'elf', 'dwarf', 'scholar', 'dancer', 'spirit', 'demon', 'ghost', 'cat', 'dog'];
  for (const t of CA.NPC_TYPES) R.Gfx.def('npc:' + t, () => CA.npcSheet(t) || R.Gfx.placeholder(16, 24));
})(window.RPG);
