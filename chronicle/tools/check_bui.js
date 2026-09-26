#!/usr/bin/env node
// check_bui.js (bui A3) — the battle screen against the written spec. Reads DESIGN.md / STYLE_JA.md
// themselves, so a spec edit that the code did not follow shows up here.
//   K1 layout constants = the §11.5.1 block            K2 status icons = the §11.3.6 table (grid + colour)
//   K3 every fx id the spec names (§6.2.6, §9.14.2 ④, §11.5.12, §11.11.1) is an exact FX of battle_fx.js
//   K4 every fx id the data writes (actions, items, weapon types, elements) resolves exactly (warning per owner)
//   K5 the fixed battle texts of the scene appear verbatim in STYLE_JA §6 / §9 (and DESIGN §11.5)
//   K6 every sfx / jingle id the scene or fx play is in the §11.11.4 lists
//   K7 every event type battle.js yields is handled by the scene
//   K8 graphics the scene draws exist (obj:glimmer / obj:sparkle / icon:acc / bfx:icon_* for DB.statuses)
//   K9 every battle backdrop id used by encounters / troops has bbg:<id> or a fallback colour
//   node tools/check_bui.js [-v]      exit 1 on an error (K4 and K9 only warn: they are other owners' data)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB, B = R.Battle, FX = R.BattleFX;
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const STYLE = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
const SCENE = fs.readFileSync(path.join(ROOT, 'src/systems/battle_scene.js'), 'utf8');
const FXSRC = fs.readFileSync(path.join(ROOT, 'src/systems/battle_fx.js'), 'utf8');
const ENGINE = fs.existsSync(path.join(ROOT, 'src/systems/battle.js')) ? fs.readFileSync(path.join(ROOT, 'src/systems/battle.js'), 'utf8') : '';

let errors = 0, warnings = 0, checks = 0;
const err = (k, m) => { errors++; console.log(`ERROR [${k}] ${m}`); };
const warn = (k, m) => { warnings++; console.log(`WARN  [${k}] ${m}`); };
const okk = (k, m) => { checks++; if (VERBOSE) console.log(`ok    [${k}] ${m}`); };
const section = (h) => { const i = DESIGN.indexOf(h); if (i < 0) return ''; const rest = DESIGN.slice(i + h.length); const j = rest.search(/\n#{2,4} /); return DESIGN.slice(i, i + h.length + (j < 0 ? rest.length : j)); };

// ---------------------------------------------------------------- K1 layout
{
  const s = section('#### 11.5.1');
  const num = (re) => { const m = re.exec(s); return m ? m.slice(1).map(Number) : null; };
  const win = /WIN\s*=\s*\{\s*xs:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\],\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\}/.exec(s);
  const want = {
    WIN: win && { xs: win.slice(1, 5).map(Number), y: +win[5], w: +win[6], h: +win[7] },
    WIN_BOTTOM: (num(/WIN_BOTTOM\s*=\s*(\d+)/) || [])[0],
    HELP: (() => { const a = num(/HELP\s*=\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/); return a && { x: a[0], y: a[1], w: a[2], h: a[3] }; })(),
    BOX: (() => { const a = num(/BOX\s*=\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/); return a && { x: a[0], y: a[1], w: a[2], h: a[3] }; })(),
    GROUND: (num(/GROUND\s*=\s*(\d+)/) || [])[0],
    BANNER: (() => { const a = num(/BANNER\s*=\s*\{\s*y:\s*(\d+),\s*h:\s*(\d+)/); return a && { y: a[0], h: a[1] }; })(),
    CARD: (() => { const a = num(/CARD\s*=\s*\{\s*y:\s*(\d+)/); return a && { y: a[0] }; })(),
  };
  for (const k in want) {
    if (want[k] == null) { err('K1', `§11.5.1 has no ${k}`); continue; }
    let got = B[k];
    if (k === 'BOX' && got) got = { x: got.x, y: got.y, w: got.w, h: got.h };
    if (JSON.stringify(got) === JSON.stringify(want[k])) okk('K1', k); else err('K1', `R.Battle.${k} = ${JSON.stringify(got)}, §11.5.1 says ${JSON.stringify(want[k])}`);
  }
  // §11.11.3 repeats them
  const s3 = section('#### 11.11.3');
  if (!s3.replace(/\s+/g, '').includes('xs:[' + B.WIN.xs.join(',') + ']')) warn('K1', '§11.11.3 no longer lists WIN xs ' + B.WIN.xs.join(','));
  else okk('K1', '§11.11.3 agrees');
}

// ---------------------------------------------------------------- K2 status icons
{
  const s = section('#### 11.3.6');
  const rows = [...s.matchAll(/\|\s*`icon_(\w+)`\s*\|\s*`(#[0-9a-f]{6})`\s*\|\s*([^|]+)\|/g)];
  if (rows.length !== 7) err('K2', `§11.3.6 status-icon rows: ${rows.length} (7 expected)`);
  for (const m of rows) {
    const id = m[1], col = m[2], grid = [...m[3].matchAll(/`([.#]{8})`/g)].map((x) => x[1]);
    const got = FX.icons[id];
    if (!got) { err('K2', `no bfx icon ${id}`); continue; }
    if (got[1] !== col) err('K2', `icon_${id} colour ${got[1]} ≠ ${col}`);
    else if (JSON.stringify(got[0]) !== JSON.stringify(grid)) err('K2', `icon_${id} grid differs from §11.3.6`);
    else okk('K2', 'icon_' + id);
  }
  for (const k of ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'regen', 'up', 'down']) if (!FX.icons[k]) err('K2', `existing icon ${k} lost`);
}

// ---------------------------------------------------------------- K3 fx ids named by the spec
{
  const exact = (id) => { const b = String(id).toLowerCase().replace(/\d+$/, ''); return !!FX.FX[b] || b.startsWith('breath'); };
  const lists = {};
  const s626 = section('#### 6.2.6');
  lists['§6.2.6'] = [...s626.matchAll(/`([a-z]+\d?)`/g)].map((m) => m[1]).filter((x) => !['fx', 'resolve'].includes(x));
  const s9142 = section('#### 9.14.2');
  const four = /④ 使う fx: `([^`]+)`/.exec(s9142);
  lists['§9.14.2 ④'] = four ? four[1].replace(/\(([^)]*)\)/g, (m0, a) => ' ' + a.split(/\s+/).map((x) => 'breath' + x).join(' ')).split(/\s+/).filter(Boolean) : [];
  if (!four) err('K3', '§9.14.2 ④ list not found');
  const s1112 = section('#### 11.5.12');
  lists['§11.5.12'] = [...s1112.matchAll(/\|\s*`(\w+)`(?:\s*`(\w+)`)?(?:\s*`(\w+)`)?\s*\|/g)].flatMap((m) => m.slice(1).filter(Boolean));
  const s1111 = section('#### 11.11.1');
  const fxRow = /演出 fx（7）\s*\|\s*([^|]+)\|/.exec(s1111);
  lists['§11.11.1'] = fxRow ? [...fxRow[1].matchAll(/`?(\w+)`?/g)].map((m) => m[1]).filter((x) => /^[a-z]+\d?$/.test(x)) : [];
  for (const k in lists) {
    const bad = lists[k].filter((id) => !exact(id));
    if (!lists[k].length) err('K3', `${k}: no ids read`);
    else if (bad.length) err('K3', `${k}: not an exact fx: ${bad.join(' ')}`);
    else okk('K3', `${k} (${lists[k].length} ids)`);
  }
  // level digits: the trailing 1–3 sets the size
  for (const id of ['arrow3', 'lash2', 'slash3', 'fire3']) if (FX.resolve(id).level !== +id.slice(-1)) err('K3', `${id} level`);
  // keywords only on word boundaries (§11.5.12: 'jump' is not 'mp')
  const kw = { jump: 'pierce', slice: 'strike', uppercut: 'strike', sparkle: 'strike' };
  for (const k in kw) if (FX.resolve(k).kind !== kw[k]) err('K3', `keyword ${k} → ${FX.resolve(k).kind}`); else okk('K3', 'keyword ' + k);
}

// ---------------------------------------------------------------- K4 data fx
{
  const owner = (id) => (/^t_/.test(id) ? 'techs A7' : /^s_/.test(id) ? 'spells A8' : /^eb_/.test(id) ? 'boss A12' : /^e_/.test(id) ? 'mons A11' : /^i_/.test(id) ? 'gear-b A10b' : 'data');
  const bad = {};
  const see = (src, f) => {
    for (const x of [].concat(f || [])) {
      if (!x) continue;
      const b = String(x).toLowerCase().replace(/\d+$/, '');
      if (!FX.FX[b] && !b.startsWith('breath')) (bad[owner(src)] = bad[owner(src)] || []).push(`${src}:${x}`);
    }
  };
  let n = 0;
  for (const id in DB.actions) { see(id, DB.actions[id].fx); n++; }
  for (const id in DB.items) if (DB.items[id].use) { see(id, DB.items[id].use.fx); n++; }
  for (const w in DB.weaponTypes) see('weaponType ' + w, DB.weaponTypes[w].fx);
  for (const e in DB.elements) see('element ' + e, DB.elements[e].fx);
  for (const o in bad) warn('K4', `${o}: fx ids that are not exact (resolved by keyword / effects): ${bad[o].slice(0, 12).join(' ')}${bad[o].length > 12 ? ' …' : ''}`);
  if (!Object.keys(bad).length) okk('K4', `${n} actions / items: every fx id exact`);
}

// ---------------------------------------------------------------- K5 fixed texts
{
  const texts = {
    'めったに出会えない魔物が現れた！': STYLE, 'リピート　Bで解除': STYLE, 'リピート解除': STYLE, 'オート　Bで解除': STYLE, 'オート解除': STYLE,
    '前と同じ行動を、Bを押すまで続ける。': STYLE, 'くり返す行動がまだない。': STYLE,
    'WPが足りない！': STYLE, 'MPが足りない！': STYLE, '術を封じられている！': STYLE, '中列からは届かない。': STYLE, '戦闘中は使えない。': STYLE, 'この戦いからは逃げられない！': STYLE,
    '{hero}たちは全滅した……。': STYLE, '{hero}たちは力つきた……。': STYLE,
    '閃き！': STYLE, '奥義': STYLE, '極意': STYLE, '合成術': STYLE,
    'ほかでは手に入らない一品': DESIGN, '超レア': DESIGN, '敵全体にランダム': DESIGN, '味方全員': DESIGN, '敵全体': DESIGN,
  };
  // the badge is built as name + '　Bで解除' / name + '解除' (drawAuto)
  const badge = (t) => { const m = /^(オート|リピート)(　Bで解除|解除)$/.exec(t); return !!m && SCENE.includes(`'${m[1]}'`) && SCENE.includes(`'${m[2]}'`); };
  for (const t in texts) {
    const inScene = SCENE.includes(`'${t}'`) || SCENE.includes('`' + t) || SCENE.includes(t) || badge(t);
    if (!inScene) err('K5', `the scene does not use 「${t}」`);
    else if (!texts[t].includes(t)) err('K5', `「${t}」 is not in ${texts[t] === STYLE ? 'STYLE_JA' : 'DESIGN'} any more`);
    else okk('K5', t);
  }
  // no word of STYLE_JA §7.3 in the scene / fx strings (check_text covers src too; this is the quick local copy)
  const s73 = (/### 7\.3[\s\S]*?\n- 例外/.exec(STYLE) || [''])[0];
  const banned = [...s73.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const strs = [...(SCENE + FXSRC).matchAll(/'([^'\n]*[\u3040-\u30ff\u4e00-\u9fff][^'\n]*)'|`([^`]*[\u3040-\u30ff\u4e00-\u9fff][^`]*)`/g)].map((m) => m[1] || m[2]);
  for (const w of banned) for (const s of strs) if (s.includes(w)) err('K5', `banned word 「${w}」 in 「${s}」`);
  okk('K5', `${strs.length} strings checked against §7.3 (${banned.length} words)`);
}

// ---------------------------------------------------------------- K6 sounds
{
  const s = section('#### 11.11.4');
  const grab = (label) => { const m = new RegExp(label + '[^:：]*[:：]\\*?\\*?\\s*([^\\n]+)').exec(s); return m ? [...m[1].matchAll(/`([^`]+)`/g)].flatMap((x) => x[1].split(/\s+/)) : []; };
  const jin = new Set(grab('ジングル'));
  const sfx = new Set(grab('効果音'));
  for (const w of (/クレストの 48 はすべて残す（`([^`]+)`/.exec(DESIGN) || ['', ''])[1].split(/\s+/)) if (w) sfx.add(w);
  const usedS = new Set([...(SCENE + FXSRC).matchAll(/R\.sfx\('(\w+)'\)/g)].map((m) => m[1]).concat(Object.values(FX.SFX)));
  for (const m of SCENE.matchAll(/\{ poison: 'poison', sleep: 'sleep', burn: 'burn', freeze: 'freeze' \}/g)) void m;
  ['poison', 'sleep', 'burn', 'freeze', 'status', 'hurt', 'hit', 'cancel', 'confirm', 'cursor', 'buzzer', 'confirm_soft'].forEach((x) => usedS.add(x));
  const usedJ = new Set([...SCENE.matchAll(/R\.jingle\('(\w+)'\)/g)].map((m) => m[1]).concat(['levelup']));
  for (const e in DB.elements) if (DB.elements[e].sfx) usedS.add(DB.elements[e].sfx);
  if (!jin.size || !sfx.size) err('K6', '§11.11.4 lists not read');
  for (const id of usedS) if (!sfx.has(id)) err('K6', `sfx '${id}' is not in §11.11.4`); else okk('K6', 'sfx ' + id);
  for (const id of usedJ) if (!jin.has(id)) err('K6', `jingle '${id}' is not in §11.11.4`); else okk('K6', 'jingle ' + id);
  if (R.DB.sfx && Object.keys(R.DB.sfx).length) for (const id of usedS) if (!R.DB.sfx[id]) warn('K6', `sfx '${id}' has no DB.sfx entry yet (audio A17)`);
}

// ---------------------------------------------------------------- K7 events
{
  const header = ENGINE.split('(function')[0];
  const yielded = new Set([...header.matchAll(/t:'(\w+)'/g)].map((m) => m[1]));
  for (const m of ENGINE.matchAll(/yield \{ t: '(\w+)'/g)) yielded.add(m[1]);
  const handled = new Set([...SCENE.matchAll(/case '(\w+)':/g)].map((m) => m[1]));
  if (!yielded.size) warn('K7', 'battle.js not readable');
  for (const t of yielded) if (!handled.has(t)) err('K7', `battle.js yields {t:'${t}'} but the scene has no case for it`); else okk('K7', t);
  for (const t of ['glimmer', 'drop', 'golden', 'levelup', 'prof', 'gain', 'phase', 'summon']) if (!handled.has(t)) err('K7', `§3.3.8 event ${t} not handled`);
}

// ---------------------------------------------------------------- K8 graphics
{
  for (const k of ['obj:glimmer', 'obj:sparkle', 'icon:acc']) if (!R.Gfx.has(k)) warn('K8', `${k} not registered (the scene falls back)`); else okk('K8', k);
  for (const s in DB.statuses) if (s !== 'death' && !R.Gfx.has('bfx:icon_' + s)) err('K8', `status ${s} has no bfx:icon_${s}`);
  if (!R.Gfx.has('bfx:bulb')) err('K8', 'bfx:bulb (the glimmer bulb stand-in) missing');
  // digit colours of §11.5.6 (the canvases need a browser; the colour table is read from the source)
  const dc = /const DIGIT_COL = \{([\s\S]*?)\};/.exec(FXSRC);
  for (const c of ['white', 'yellow', 'purple', 'orange', 'cyan', 'green', 'gray']) if (!dc || !new RegExp('\\b' + c + ':').test(dc[1])) err('K8', `digit colour ${c} missing`);
  if (dc && !/orange: \[[^\]]*'#ffa53c'/.test(dc[1])) err('K8', "orange digits are not #ffa53c (§11.5.6)");
  okk('K8', 'status icons + digits');
}

// ---------------------------------------------------------------- K9 backdrops
{
  const ids = new Set();
  for (const z in DB.encounters) if (DB.encounters[z].bg) ids.add(DB.encounters[z].bg);
  for (const t in DB.troops) if (DB.troops[t].bg) ids.add(DB.troops[t].bg);
  for (const id of ids) if (!R.Gfx.has('bbg:' + id)) warn('K9', `bbg:${id} not registered (falls back to a plain gradient)`); else okk('K9', 'bbg:' + id);
}

console.log(`check_bui: ${errors} error(s), ${warnings} warning(s), ${checks} ok`);
process.exit(errors ? 1 : 0);
