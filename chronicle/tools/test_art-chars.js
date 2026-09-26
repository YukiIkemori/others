#!/usr/bin/env node
// Unit tests for art-chars (A13): registrations, the party look tables against
// DESIGN.md §5.2.8 / §5.3.7 (parsed from the spec itself), part-grid lint, the
// distinguishability rule, NPC / object / icon / face keys, and cross-checks with
// the data other areas have landed (companions, hero types, items' icons, NPC
// sprites used by maps, R.Party.spriteKey). Node only (no browser); pixel checks
// are in tools/check_art-chars.js.
//
//   node tools/test_art-chars.js [-v]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });
const CA = R.Art.Chars, P = CA.parts;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; if (VERBOSE) console.log('  ok', msg); } else { fail++; fails.push(msg); console.log('  FAIL', msg); } }
function section(t) { console.log('\n# ' + t); }

// ------------------------------------------------------------------ spec tables
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
function between(a, b) { const i = DESIGN.indexOf(a), j = DESIGN.indexOf(b, i + 1); return i < 0 || j < 0 ? '' : DESIGN.slice(i, j); }
function rows(text) {
  return text.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-\s|]+\|$/.test(l)).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()));
}
const hexes = (s) => (s.match(/#[0-9a-f]{6}/gi) || []).map((h) => h.toLowerCase());
const clean = (s) => s.replace(/[★`*]/g, '').trim();
const none = (s) => !s || s === '—' || s === '-' || s === 'なし';

section('spec tables parsed from DESIGN.md');
const T537 = rows(between('#### 5.3.7', '#### 5.3.8')).filter((r) => /^[a-z]+$/.test(r[0]) && r[0] !== 'id');
ok(T537.length === 20, `§5.3.7 has 20 companion rows (got ${T537.length})`);
const T528 = rows(between('#### 5.2.8', '#### 5.2.9')).filter((r) => /^(戦士|狩人|術師|術剣士|旅人)$/.test(r[0]));
ok(T528.length === 5, `§5.2.8 has 5 hero type rows (got ${T528.length})`);
const T533 = rows(between('#### 11.3.3', '#### 11.3.4')).filter((r) => /^`npc:/.test(r[0]));
const T534 = rows(between('#### 11.3.4', '#### 11.3.5')).filter((r) => /^`npc:/.test(r[0]));
ok(T533.length === 7, `§11.3.3 has 7 story NPC rows (got ${T533.length})`);
ok(T534.length === 9, `§11.3.4 has 9 town NPC rows (got ${T534.length})`);
const T536 = rows(between('#### 11.3.6', '**戦闘の状態の印')).filter((r) => /^`icon:/.test(r[0]));
ok(T536.length === 15, `§11.3.6 has 15 new icon rows (got ${T536.length})`);

// ------------------------------------------------------------------ registrations
section('registered keys');
const G = R.Gfx;
const SPEC_COMP = T537.map((r) => r[0]);
ok(JSON.stringify(CA.COMPANION_IDS) === JSON.stringify(SPEC_COMP), 'CA.COMPANION_IDS = §5.3.7 order');
const TYPE_ID = { 戦士: 'warrior', 狩人: 'ranger', 術師: 'mage', 術剣士: 'spellblade', 旅人: 'wanderer' };
ok(JSON.stringify(CA.HERO_TYPES) === JSON.stringify(T528.map((r) => TYPE_ID[r[0]])), 'CA.HERO_TYPES = §5.2.8 order');
ok(CA.PARTY_IDS.length === 30, 'PARTY_IDS has 30 ids');
for (const id of CA.PARTY_IDS) ok(G.has('party:' + id) && P.party[id], 'party:' + id + ' registered with a table entry');
ok(Object.keys(P.party).length === 30, `exactly 30 party entries (got ${Object.keys(P.party).length}: no leftover Crest looks)`);
ok(!Object.keys(G._defs).some((k) => /^party:[^:]+:[^:]+$/.test(k)), 'no per-job party:<char>:<job> keys remain');
ok(CA.heroSpriteId('f', 'mage') === 'hero_f_mage' && CA.heroSpriteId('m', 'nope') === 'hero_m_warrior' && CA.heroSpriteId(undefined, 'ranger') === 'hero_m_ranger', 'CA.heroSpriteId');
const CREST_NPC = 'king queen princess minister soldier knight old_man old_woman man woman boy girl merchant innkeeper priest nun sage elder sailor captain bandit elf dwarf scholar dancer spirit demon ghost cat dog'.split(' ');
const NEW_NPC = T533.concat(T534).flatMap((r) => r[0].match(/npc:[a-z_]+/g)).map((k) => k.slice(4));
ok(NEW_NPC.length === 17, `17 new NPC keys in §11.3.3/§11.3.4 (got ${NEW_NPC.length})`);
for (const t of CREST_NPC.concat(NEW_NPC)) ok(G.has('npc:' + t) && CA.NPC_TYPES.includes(t), 'npc:' + t + ' registered and in CA.NPC_TYPES');
for (const t of NEW_NPC) ok(t in CA.npcs, 'npc:' + t + ' has its own art (not a stand-in)');
const OBJ = ['chest', 'chest_rare', 'sparkle', 'shadow', 'glimmer', 'quill', 'lantern', 'page', 'crest_glow', 'ship'];
for (const o of OBJ) ok(G.has('obj:' + o), 'obj:' + o + ' registered');
const WT = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
if (R.DB.weaponTypes && Object.keys(R.DB.weaponTypes).length) ok(JSON.stringify(Object.keys(R.DB.weaponTypes).sort()) === JSON.stringify(WT.slice().sort()), 'DB.weaponTypes = the 11 families');
const ICON_KEYS = WT.concat('shield head body hands feet acc herb potion key'.split(' '), ['fire', 'water', 'wind', 'earth', 'light', 'dark'].map((e) => 'el_' + e));
for (const i of ICON_KEYS) ok(G.has('icon:' + i), 'icon:' + i + ' registered (§3.1.2)');
// §11.3.6 gives the P2 grid of every new icon (or names the icon it copies). Ours must be
// that grid; fist / hands / feet add one shade (knuckles, cuff, sole) but keep the spec's
// silhouette exactly.
const GRIDS = R.Art.ICON_GRIDS || {};
const SHADED = new Set(['fist', 'hands', 'feet']);
const mask = (g) => g.map((row) => row.replace(/[^.]/g, '#')).join('/');
for (const r of T536) {
  const id = r[0].replace(/`/g, '').slice(5);
  const want = ((r[3] || '').match(/`[.A-Za-z]{8}`/g) || []).map((s) => s.slice(1, -1));
  ok(R.Art.ICON_IDS && R.Art.ICON_IDS.includes(id), 'icon:' + id + ' drawn as its own grid');
  const same = /（`(\w+)` と同じ）/.exec(r[3] || '');
  if (same) { ok(GRIDS[id] && GRIDS[id] === GRIDS[same[1]], `icon:${id} is icon:${same[1]} (§11.3.6)`); continue; }
  ok(want.length === 8, `§11.3.6 gives an 8-row grid for icon:${id}`);
  const have = GRIDS[id] || [];
  if (SHADED.has(id)) ok(mask(have) === mask(want), `icon:${id} has the §11.3.6 silhouette`);
  else ok(have.join('/') === want.join('/'), `icon:${id} = the §11.3.6 grid`);
}
for (const id of CA.PARTY_IDS) ok(G.has('face:' + id), 'face:' + id + ' registered');
const pend = (R.Art.PENDING || []).filter((k) => /^(party|npc|obj|icon|face):/.test(k));
ok(pend.length === 0, `R.Art.PENDING has no art-chars stand-ins (got ${pend.join(' ') || 'none'})`);

// ------------------------------------------------------------------ §5.3.7 table = CA.parts.party
section('§5.3.7 companion looks = the spec table');
const SKIN = { A: 'A', B: 'B', C: 'C', 森: 'forest', 青白: 'pale' };
const OVERS = ['eyepatch', 'freckles', 'earrings', 'quill', 'elfEars', 'glasses'];
const BEARDS = ['beard', 'beardShort', 'mustache'];
for (const r of T537) {
  const [id, skin, hairP, hairC, face, body, hat, cape, overs, main, sub, trim, extra] = r;
  const w = P.party[id]; if (!w) { ok(false, id + ' exists'); continue; }
  const st = w.style || {};
  ok(w.skin === SKIN[skin], `${id} skin ${skin}`);
  const hp = clean(hairP.replace(/（.*?）/g, '')).split('＋').map((s) => s.trim());
  ok(JSON.stringify([].concat(w.hairPart)) === JSON.stringify(hp), `${id} hair part ${hp.join('+')} (have ${[].concat(w.hairPart).join('+')})`);
  const hc = hexes(hairC);
  ok(hc.length === 4 ? JSON.stringify(w.hair) === JSON.stringify(hc) : w.hair === clean(hairC), `${id} hair colour ${clean(hairC)}`);
  ok(w.face === clean(face), `${id} face ${clean(face)}`);
  ok(st.body === clean(body) || (st.bodyF === clean(body) && w.gender === 'f'), `${id} body ${clean(body)}`);
  ok(none(hat) ? !st.hat : st.hat === clean(hat), `${id} hat ${hat}`);
  ok(none(cape) ? !st.cape : st.cape === clean(cape), `${id} cape ${cape}`);
  const ov = none(overs) ? [] : clean(overs).split('、').map((s) => s.trim());
  const wantOver = ov.filter((o) => OVERS.includes(o)), wantBeard = ov.filter((o) => BEARDS.includes(o));
  ok(ov.every((o) => OVERS.includes(o) || BEARDS.includes(o)), `${id} over/beard names known (${ov.join(',')})`);
  ok(JSON.stringify((w.over || []).slice().sort()) === JSON.stringify(wantOver.sort()), `${id} over ${wantOver.join(',') || '-'}`);
  ok((w.beard || null) === (wantBeard[0] || null), `${id} beard ${wantBeard[0] || '-'}`);
  const o = w.outfit || {};
  ok(o.main === hexes(main)[0] && o.sub === hexes(sub)[0] && o.trim === hexes(trim)[0], `${id} outfit ${main} ${sub} ${trim}`);
  const colors = w.colors || {};
  for (const k of ['steel', 'leather']) {
    const m = new RegExp(k + '\\s*`(#[0-9a-f]{6})`', 'i').exec(extra || '');
    if (m) ok(colors[k] === m[1].toLowerCase(), `${id} ${k} ${m[1]}`);
  }
  const acc = /acc（[^）]*）`(#[0-9a-f]{6})`/.exec(extra || '');
  if (acc) ok(colors.acc === acc[1].toLowerCase(), `${id} acc ${acc[1]}`);
  if (/小柄/.test(extra || '')) ok(w.small === true, `${id} small (head parts lowered like the dwarf)`);
  if (/袴/.test(extra || '')) ok(st.variant === 'hakama', `${id} white top + scarlet hakama variant`);
}
const EYES = { sylvain: '#1c3020', morga: '#3a1030', ilse: '#1c2450' };
for (const id of CA.COMPANION_IDS) ok((P.party[id].eye || '#1c1430') === (EYES[id] || '#1c1430'), `${id} eye colour`);
ok(CA.partyPalette(P.party.selma).e === '#1c1430', 'default eye #1c1430 reaches the palette');

section('§5.2.8 hero looks = the spec table');
for (const r of T528) {
  const type = TYPE_ID[r[0]];
  const [bm, bf] = clean(r[1]).split('/').map((s) => s.trim());
  for (const g of ['m', 'f']) {
    const id = 'hero_' + g + '_' + type, w = P.party[id], st = w.style;
    const body = g === 'f' ? (bf || bm) : bm;
    ok(((g === 'f' && st.bodyF) || st.body) === body, `${id} body ${body}`);
    ok(none(r[2]) ? !st.hat : st.hat === clean(r[2]), `${id} hat ${r[2]}`);
    ok(none(r[3]) ? !st.cape : st.cape === clean(r[3]), `${id} cape ${r[3]}`);
    ok(w.outfit.main === hexes(r[4])[0] && w.outfit.sub === hexes(r[5])[0] && w.outfit.trim === hexes(r[6])[0], `${id} outfit`);
    ok(w.hairPart === (g === 'f' ? 'hairHeroF' : 'hairHeroM') && w.hair === 'chestnut' && w.skin === 'A' && w.face === (g === 'f' ? 'gentle' : 'boy'), `${id} hair/skin/face`);
    ok((w.over || []).includes('quill'), `${id} wears the quill`);
  }
}
ok(JSON.stringify(CA.HAIR.chestnut) === JSON.stringify(['#3c2414', '#6c4424', '#9c6c3c', '#c89860']), 'hero chestnut hair = §5.2.8');
ok(JSON.stringify(CA.SKIN.A) === JSON.stringify(['#d8966a', '#f4c49c', '#fde2c8']) && JSON.stringify(CA.SKIN.pale) === JSON.stringify(['#b8a8a8', '#e0d0cc', '#f4ece8']), 'skin tables = §5.3.7');

// ------------------------------------------------------------------ §11.3.3 / §11.3.4 NPC tables
// part objects → their names (a CA.use() copy has the part as its prototype)
const partName = (grp, p) => {
  if (!p) return null;
  for (const k of Object.keys(grp || {})) if (grp[k] === p || Object.getPrototypeOf(p) === grp[k]) return k;
  return '?';
};
const hairName = (p) => partName(Object.fromEntries(Object.keys(P).filter((k) => /^hair|^tuft$/.test(k)).map((k) => [k, P[k]])), p);
const npcSpec = (t) => { const n = CA.npcs[t]; return n && n.spec ? n.spec() : null; };
const overNames = (sp) => [].concat(sp.over || []).map((o) => partName(P.over, o));

section('§11.3.3 story characters = the spec table');
// Named deviations (reported in the A13 report):
//   berna  cane: over.caneOut, the same walking stick one pixel out from the wide robe (over.cane vanishes on it);
//          colours: the table lists マント / 服 / 縁, so the mantle colour is `sub` (the mantle part draws in sub).
const DEV533 = { berna: { over: ['cane', 'caneOut'] } };
for (const r of T533) {
  const t = r[0].replace(/`/g, '').slice(4), parts = r[2] || '', cols = r[3] || '';
  const sp = npcSpec(t), dev = DEV533[t] || {};
  if (t === 'fine_fade') { ok(CA.npcs.fine_fade && CA.npcs.fine_fade.build, 'npc:fine_fade builds from npc:fine (dither on the lowest 6 rows)'); continue; }
  if (!sp) { ok(false, `npc:${t} has a figure spec`); continue; }
  const body = /体 `(\w+)`/.exec(parts);
  if (body) ok(partName(P.body, sp.body) === body[1], `npc:${t} body ${body[1]} (have ${partName(P.body, sp.body)})`);
  const face = /face\.(\w+)/.exec(parts);
  if (face) ok([].concat(sp.head)[1] === P.face[face[1]], `npc:${t} face.${face[1]}`);
  const hair = /髪 `(\w+)`/.exec(parts);
  if (hair) {
    const want = dev.hair && dev.hair[0] === hair[1] ? dev.hair[1] : hair[1];
    ok([].concat(sp.hair).map(hairName).includes(want), `npc:${t} hair ${want}${want !== hair[1] ? ' (for ' + hair[1] + ')' : ''}`);
  }
  const cape = /cape:(\w+)/.exec(parts);
  ok(cape ? partName(P.cape, sp.cape) === cape[1] : !sp.cape, `npc:${t} cape ${cape ? cape[1] : '-'}`);
  const hat = /hat:(\w+)/.exec(parts);
  ok(hat ? partName(P.hat, sp.hat) === hat[1] : !sp.hat, `npc:${t} hat ${hat ? hat[1] : '-'}`);
  for (const m of parts.matchAll(/over\.(\w+)/g)) {
    const want = dev.over && dev.over[0] === m[1] ? dev.over[1] : m[1];
    ok(overNames(sp).includes(want), `npc:${t} over.${want}`);
  }
  const PROPS533 = { 三つ編み: 'braidSide', 襟を立てる: 'collar', 後ろで結ぶ: 'napeTail', 黒い手帳: 'notebook', 銀の筆: 'brush', 本の紋: 'bookCrest' };
  for (const k in PROPS533) if (parts.includes(k)) ok(overNames(sp).includes(PROPS533[k]), `npc:${t} ${PROPS533[k]} (${k})`);
  const beard = /(?:ひげ|口ひげ) `(\w+)`/.exec(parts);
  if (beard) ok(partName(P, sp.beard) === beard[1], `npc:${t} beard ${beard[1]}`);
  const pal = CA.npcs[t].pal, three = hexes(cols).slice(0, 3);
  const mine = [pal.main, pal.sub, pal.trim].map((h) => h.toLowerCase());
  if (t === 'berna') ok(mine[0] === three[1] && mine[1] === three[0] && mine[2] === three[2], 'npc:berna robe 服 = main, mantle マント = sub, trim 縁');
  else ok(JSON.stringify(mine) === JSON.stringify(three), `npc:${t} main/sub/trim ${three.join(' ')}`);
  const hn = /髪 (black|white|grey|brown|blond|red|auburn|green)/.exec(cols), hx = /髪 ((?:`#[0-9a-f]{6}` ?){4})/i.exec(cols);
  if (hn) ok(JSON.stringify(pal.hair) === JSON.stringify(CA.HAIR[hn[1]]), `npc:${t} hair colour ${hn[1]}`);
  if (hx) ok(JSON.stringify(pal.hair) === JSON.stringify(hexes(hx[1])), `npc:${t} hair colour ${hexes(hx[1]).join(' ')}`);
  const sk = /肌 (A|B|C|青白|森)/.exec(cols);
  if (sk) ok(JSON.stringify(pal.skin) === JSON.stringify(CA.SKIN[SKIN[sk[1]]]), `npc:${t} skin ${sk[1]}`);
}

section('§11.3.4 town folk = the spec table');
// Named deviations (the table's part name is a different shape in chars_parts.js):
//   farmer  麦わら帽 `wide` → hat.straw   (`wide` is the pointed witch hat with a broad brim)
//   miner   ランプの帽子 `cap` → hat.lampcap (`cap` has no lamp)
//   noble   `tophat` → hat.tophatPlain  (the Crest top hat carries the time-mage crescent)
const DEV534 = { farmer: { wide: 'straw' }, miner: { cap: 'lampcap', goggles: 'lampcap' }, noble: { tophat: 'tophatPlain' } };
const PROPS = { 竪琴: 'lyre', くわ: 'hoe', すすけた: 'soot', 網: 'net', 本: 'book', 口もとの布: 'veilMouth' };
for (const r of T534) {
  const form = r[2] || '';
  for (const key of r[0].match(/npc:[a-z_]+/g)) {
    const t = key.slice(4), n = CA.npcs[t];
    if (/animal/.test(form)) { ok(n && typeof n.build === 'function', `npc:${t} is an animal grid (like cat / dog)`); continue; }
    const sp = npcSpec(t);
    if (!sp) { ok(false, `npc:${t} has a figure spec`); continue; }
    const words = [...form.matchAll(/`(\w+)`/g)].map((m) => m[1]);
    const bodyN = partName(P.body, sp.body), hatN = partName(P.hat, sp.hat);
    const named = (w) => (DEV534[t] && DEV534[t][w]) || w;
    const bodies = words.filter((w) => P.body[w] && !(t === 'miner' && w === 'dwarf'));
    if (bodies.length) ok(bodies.includes(bodyN), `npc:${t} body ${bodies.join('/')} (have ${bodyN})`);
    const hats = words.filter((w) => (P.hat[w] || (DEV534[t] && DEV534[t][w])) && !form.includes('`' + w + '` の体')).map(named);
    if (hats.length) ok(hats.includes(hatN), `npc:${t} hat ${hats.join('/')} (have ${hatN})`);
    for (const k in PROPS) if (form.includes(k)) ok(overNames(sp).includes(PROPS[k]), `npc:${t} carries ${PROPS[k]} (${k})`);
    if (/長いマント/.test(form)) ok(partName(P.cape, sp.cape) === 'long', `npc:${t} long cape`);
    if (/緋の袴/.test(form)) {
      const noela = P.party.noela, pal = n.pal;
      ok(bodyN === 'hakama' && pal.main === noela.outfit.main && pal.sub === noela.outfit.sub, `npc:${t} white top + scarlet hakama in noela's colours`);
      ok(hairName(sp.hair) !== [].concat(noela.hairPart)[0], `npc:${t} hair differs from noela's`);
    }
  }
}
ok(CA.NPC_TYPES.length === 47 && new Set(CA.NPC_TYPES).size === 47, `CA.NPC_TYPES has the 47 types (30 reused + 17 new), no duplicates (${CA.NPC_TYPES.length})`);

// ------------------------------------------------------------------ parts exist, no stand-ins
section('new parts (§5.3.8) exist');
for (const n of ['hairPony', 'hairTail', 'hairBraid', 'hairCurly', 'hairCrop', 'hairWave', 'hairHime', 'hairSide', 'hairHeroM', 'hairHeroF', 'face.old', 'face.narrow', 'over.eyepatch', 'over.freckles', 'over.earrings', 'over.quill'])
  ok(CA.hasPart(n), 'part ' + n);
for (const id of CA.PARTY_IDS) ok(CA.pendingParts(P.party[id]).length === 0, `${id} uses no stand-in part`);
// the stand-ins (§5.3.8 「代わり」) are the spec's, and the fallback path really draws them
const T538 = rows(between('#### 5.3.8', '#### 5.3.9')).filter((r) => /^`/.test(r[1] || ''));
ok(T538.length === 16, `§5.3.8 has 16 part rows (got ${T538.length})`);
for (const r of T538) {
  const ids = r[1].match(/`([\w.:]+)`/g).map((s) => s.slice(1, -1));
  const alt = none(r[4]) ? [] : r[4].replace(/`/g, '').split('/').map((s) => s.trim());
  ids.forEach((id, i) => {
    if (id.startsWith('npc:')) { ok(JSON.stringify(CA.NPC_FALLBACK[id.slice(4)]) === JSON.stringify([(alt[0] || '').slice(4)]), `${id} stand-in ${alt[0]}`); return; }
    const want = alt.length ? alt[i] || alt[0] : null;
    ok(id in CA.PART_FALLBACK && CA.PART_FALLBACK[id] === want, `${id} stand-in ${want || 'なし'} (have ${CA.PART_FALLBACK[id]})`);
    if (want) ok(CA.hasPart(want), `stand-in part ${want} exists`);
  });
}
{
  const real = P.hairPony;
  delete P.hairPony;
  try {
    ok(JSON.stringify(CA.pendingParts(P.party.selma)) === '["hairPony"]' && CA.part('hairPony') === P.hairNon, 'a missing part is listed as pending and drawn with its stand-in');
    const h = CA.partySpec(P.party.selma).hair;
    ok(h.length === 1 && (h[0] === P.hairNon || Object.getPrototypeOf(h[0]) === P.hairNon), 'partySpec uses the stand-in part');
  } finally { P.hairPony = real; }
}
// NPC stand-ins (§11.3.3 / §11.3.4 「代わり」): the base type of the recolour
for (const [r, col] of T533.map((r) => [r, 5]).concat(T534.map((r) => [r, 4]))) {
  const base = /`npc:([a-z_]+)`/.exec(r[col] || '');
  for (const key of r[0].match(/npc:[a-z_]+/g)) {
    const t = key.slice(4), fb = CA.NPC_FALLBACK[t];
    ok(fb && base && fb[0] === base[1] && (CA.NPC_TYPES.includes(fb[0])), `npc:${t} stand-in npc:${base && base[1]} (have ${fb && fb[0]})`);
  }
}

// ------------------------------------------------------------------ distinguishability
section('distinguishability (§5.3.7 rule)');
// §5.3.7: "20 人と主人公 10 枚を 1 枚に並べ、同じ髪の部品＋同じ体の組み合わせが 2 人いない"
const seen = {};
let dup = 0;
for (const id of CA.PARTY_IDS) {
  const w = P.party[id], st = w.style;
  const k = [].concat(w.hairPart).join('+') + '|' + (st.variant || (w.gender === 'f' && st.bodyF) || st.body);
  if (seen[k]) { dup++; ok(false, `${seen[k]} and ${id} share hair part + body ${k}`); } else seen[k] = id;
}
ok(dup === 0, 'no two of the 30 party looks share hair part + body');
// companions vs townsfolk: never the same hair + body + hat + beard + cape as a town NPC type.
// The fixed story characters (§11.3.3) are left to the pixel-distance check of check_art-chars.js:
// their parts come from the spec (フィーネ = robe + hood + hairLong, like モルガ) and colour tells them apart.
const STORY = new Set(T533.flatMap((r) => r[0].match(/npc:[a-z_]+/g)).map((k) => k.slice(4)));
const npcTriples = {};
for (const t of CA.NPC_TYPES) {
  const n = CA.npcs[t]; if (!n || !n.spec || STORY.has(t)) continue;
  const sp = n.spec();
  const nm = (p) => { if (!p) return '-'; for (const k in P) if (P[k] === p || Object.getPrototypeOf(p) === P[k]) return k; for (const g of ['body', 'hat']) for (const k in P[g]) if (P[g][k] === p || Object.getPrototypeOf(p) === P[g][k]) return k; return '?'; };
  const hair = [].concat(sp.hair || []).map(nm).join('+');
  const cape = sp.cape ? (Object.keys(P.cape).find((k) => P.cape[k] === sp.cape || Object.getPrototypeOf(sp.cape) === P.cape[k]) || '?') : '-';
  npcTriples[hair + '|' + nm(sp.body) + '|' + nm(sp.hat) + '|' + nm(sp.beard) + '|' + cape] = t;
}
for (const id of CA.PARTY_IDS) {
  const w = P.party[id], st = w.style;
  const k = [].concat(w.hairPart).join('+') + '|' + (st.variant || (w.gender === 'f' && st.bodyF) || st.body) + '|' + (st.hat || '-') + '|' + (w.beard || '-') + '|' + (st.cape || '-');
  ok(!npcTriples[k], `${id} does not share hair+body+hat+beard+cape with npc:${npcTriples[k] || '-'}`);
}

// ------------------------------------------------------------------ part grid lint
section('part grids');
const KNOWN = new Set(Object.keys(CA.BASE_PAL).concat('.', ' ', 'x', '1', '2', '3', '4', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'N', 'P', 'Q', 'R', 'U', 'V', 'W', 'X', 'Y', 'Z', 'o', 'O'));
let layers = 0, bad = 0;
function lint(o, where, seenSet, extraKnown) {
  if (!o || typeof o !== 'object' || seenSet.has(o)) return;
  seenSet.add(o);
  if (Array.isArray(o.g) && typeof o.y === 'number') {
    layers++;
    o.g.forEach((row, i) => {
      if (row.length !== 16) { bad++; console.log(`  FAIL ${where} row ${i}: width ${row.length} "${row}"`); }
      for (const ch of row) if (!KNOWN.has(ch) && !(extraKnown && extraKnown.has(ch))) { bad++; console.log(`  FAIL ${where} row ${i}: unknown letter '${ch}'`); }
    });
    if (o.y < 0 || o.y + o.g.length > 24) { bad++; console.log(`  FAIL ${where}: out of frame y=${o.y} h=${o.g.length}`); }
    return;
  }
  for (const k of Object.keys(o)) if (typeof o[k] === 'object') lint(o[k], where + '.' + k, seenSet, extraKnown);
}
lint(P, 'parts', new Set());
for (const t of CA.NPC_TYPES) { const n = CA.npcs[t]; if (n && n.spec) lint(n.spec(), 'npc.' + t, new Set()); }
ok(bad === 0, `${layers} part layers: rows 16 wide, known palette letters, inside 16x24 (${bad} problems)`);

// ------------------------------------------------------------------ palettes
section('palettes');
for (const id of CA.PARTY_IDS) {
  const pal = CA.partyPalette(P.party[id]);
  const letters = new Set();
  const spec = CA.partySpec(P.party[id]);
  const collect = (o, s) => { if (!o || typeof o !== 'object' || s.has(o)) return; s.add(o); if (Array.isArray(o.g)) { for (const r of o.g) for (const c of r) letters.add(c); return; } for (const k in o) if (typeof o[k] === 'object') collect(o[k], s); };
  for (const slot in spec) collect(spec[slot], new Set());
  const missing = [...letters].filter((c) => c !== '.' && c !== ' ' && c !== 'x' && !pal[c]);
  ok(missing.length === 0, `${id}: every letter used has a colour (${missing.join('') || 'ok'})`);
}
for (const t of CA.NPC_TYPES) {
  const n = CA.npcs[t]; if (!n || !n.spec) continue;
  const pal = CA.palette(Object.assign({ acc2: '#44405c', acc: '#d83c5c' }, n.pal));
  ok(pal.k && pal.A && pal['1'] !== undefined, `npc:${t} palette resolves`);
}

// ------------------------------------------------------------------ cross-checks with other areas
section('cross-checks with landed data');
const DB = R.DB;
if (DB.companions && Object.keys(DB.companions).length) {
  const ids = Object.keys(DB.companions);
  ok(JSON.stringify(ids) === JSON.stringify(CA.COMPANION_IDS), `DB.companions order = the 20 sprites (${ids.length})`);
  for (const id of ids) { const sp = DB.companions[id].sprite || id; ok(G.has('party:' + sp), `DB.companions.${id} sprite party:${sp}`); }
} else console.log('  (DB.companions not loaded — skipped)');
if (DB.heroTypes && Object.keys(DB.heroTypes).length) ok(JSON.stringify(Object.keys(DB.heroTypes)) === JSON.stringify(CA.HERO_TYPES), 'DB.heroTypes = CA.HERO_TYPES');
if (R.Party && typeof R.Party.spriteKey === 'function') {
  let n = 0;
  for (const g of ['m', 'f']) for (const t of CA.HERO_TYPES) {
    const k = R.Party.spriteKey({ id: 'hero', gender: g, heroType: t, heroSpec: { gender: g, type: t } });
    ok(G.has(k), `R.Party.spriteKey(hero ${g} ${t}) → ${k} is registered`); n++;
  }
  for (const id of CA.COMPANION_IDS) ok(G.has(R.Party.spriteKey({ id })), `R.Party.spriteKey(${id}) registered`);
} else console.log('  (R.Party.spriteKey not loaded yet — skipped)');
// item icons: default rule (§8.2.8) and explicit icons must resolve
if (DB.items && Object.keys(DB.items).length) {
  const EL = (it) => (typeof it.stone === 'string' ? it.stone : it.stone && (it.stone.element || it.stone.el)) || it.element;
  const def = (it) => {
    if (it.icon) return it.icon.startsWith('icon:') ? it.icon : 'icon:' + it.icon;
    if (it.type === 'weapon') return 'icon:' + it.wtype;
    if (['shield', 'head', 'body', 'hands', 'feet', 'acc'].includes(it.type)) return 'icon:' + it.type;
    if (it.type === 'key') return 'icon:key';
    if (it.stone || /^i_stone/.test(it.id || '')) return 'icon:el_' + EL(it);
    return null;
  };
  let n = 0, miss = [];
  for (const id in DB.items) { const k = def(Object.assign({ id }, DB.items[id])); if (!k) continue; n++; if (!G.has(k)) miss.push(id + '→' + k); }
  ok(miss.length === 0, `${n} items resolve to a registered icon (${miss.slice(0, 8).join(' ') || 'all'})`);
} else console.log('  (DB.items not loaded — skipped)');
// NPC sprites used anywhere in maps / events source
const used = new Set();
for (const d of ['src/maps', 'src/events', 'src/systems', 'src/data']) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/['"`](npc|obj|face|icon):([a-z_0-9]*[a-z0-9])['"`]/g)) used.add(m[1] + ':' + m[2]);
  }
}
const unknown = [...used].filter((k) => !G.has(k));
ok(unknown.length === 0, `${used.size} npc/obj/face/icon keys named in src/ are registered (${unknown.join(' ') || 'all'})`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('failures:\n  ' + fails.slice(0, 40).join('\n  ')); process.exitCode = 1; }
