#!/usr/bin/env node
// check_menu.js (menu A5) — the field menu, shops and the game over against the written spec. Reads DESIGN.md /
// STYLE_JA.md themselves, so a spec edit the code did not follow shows up here.
//   C1 main-menu commands = the §11.7.1 order                  C2 settings rows = the §11.7.15 table (12 rows, keys, defaults in save.js)
//   C3 the fixed texts of STYLE_JA §9 that the menu owns appear verbatim in the menu sources
//   C4 every sfx / jingle id the menu files play is in the §11.11.4 lists
//   C5 names for everything the screens print: races, statuses, weapon types, elements, action targets, item types
//   C6 every item / action icon key the lists draw is registered (R.Gfx.has)
//   C7 §0.7 tests T1–T8 exist in tools/test_menu.js; menu_jobs.js is gone and Menu.kitStar lives in menu.js
//   C8 the popup covers every mods key of §3.3.16 (Menu.MOD_KEYS) and the data uses no other key
//   node tools/check_menu.js [-v]      exit 1 on an error (C6 only warns: icons are the art owners')
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB, M = R.Menu;
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
const STYLE = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
const SRC_FILES = fs.readdirSync(path.join(ROOT, 'src/systems')).filter((f) => /^menu.*\.js$/.test(f)).concat(['shop.js', 'gameover.js']);
const SRC = {};
for (const f of SRC_FILES) SRC[f] = fs.readFileSync(path.join(ROOT, 'src/systems', f), 'utf8');
const ALL = Object.values(SRC).join('\n');

let errors = 0, warnings = 0, checks = 0;
const err = (k, m) => { errors++; console.log(`ERROR [${k}] ${m}`); };
const warn = (k, m) => { warnings++; console.log(`WARN  [${k}] ${m}`); };
const ok = (k, m) => { checks++; if (VERBOSE) console.log(`ok    [${k}] ${m}`); };
const section = (h) => { const i = DESIGN.indexOf(h); if (i < 0) return ''; const rest = DESIGN.slice(i + h.length); const j = rest.search(/\n#{2,4} /); return DESIGN.slice(i, i + h.length + (j < 0 ? rest.length : j)); };

// ---------------------------------------------------------------- C1 commands
{
  const s = section('#### 11.7.1 ');
  const m = s.match(/並び（行ごとに左 → 右）: `([^`]+)`/);
  if (!m) err('C1', '§11.7.1 command order line not found');
  else {
    const want = m[1].replace(/\s*\/\s*/g, ' ').split(/\s+/).filter(Boolean);
    const have = M.COMMANDS.map((c) => c.label);
    if (want.join(' ') !== have.join(' ')) err('C1', 'commands ' + have.join(' ') + ' ≠ spec ' + want.join(' '));
    else ok('C1', want.length + ' commands in the §11.7.1 order');
  }
}

// ---------------------------------------------------------------- C2 settings
{
  const s = section('#### 11.7.15 ');
  const rows = [...s.matchAll(/^\| (?:\*\*)?([^|*]+?)(?:\*\*)? \| (?:`([a-zA-Z]+)`)? *\|/gm)].map((m) => ({ label: m[1].trim(), key: m[2] || null })).filter((r) => r.label !== '行' && !/^-+$/.test(r.label));
  const have = M.SETTINGS.map((x) => ({ label: x.label, key: x.key || null }));
  // the table has 戻る as its 12th row; the screen adds 戻る itself
  const specRows = rows.filter((r) => r.key);
  if (specRows.length !== have.length) err('C2', 'settings rows ' + have.length + ' ≠ spec ' + specRows.length);
  specRows.forEach((r, i) => {
    const h = have[i];
    if (!h || h.key !== r.key || h.label !== r.label) err('C2', 'row ' + (i + 1) + ': ' + JSON.stringify(h) + ' ≠ spec ' + r.label + ' ' + r.key);
  });
  if (rows.length !== 12) err('C2', 'the §11.7.15 table should list 12 rows (with 戻る), found ' + rows.length);
  const saveSrc = fs.readFileSync(path.join(ROOT, 'src/core/save.js'), 'utf8');
  const defBlock = (saveSrc.match(/DEFAULT_SETTINGS = \{([\s\S]*?)\};/) || [])[1] || '';
  for (const x of M.SETTINGS) {
    if (!new RegExp('\\b' + x.key + ':').test(defBlock)) err('C2', 'setting ' + x.key + ' has no default in save.js DEFAULT_SETTINGS');
    const dflt = R.Settings[x.key];
    if (x.values && !x.values.includes(dflt) && typeof dflt !== 'number') err('C2', 'default of ' + x.key + ' (' + dflt + ') is not one of its values');
    if (x.desc && [...x.desc].length > 20) err('C2', 'setting help of ' + x.key + ' is over 20 chars: ' + x.desc);
  }
  if (R.Settings.windowColor !== 'ink') err('C2', 'windowColor default should be ink, is ' + R.Settings.windowColor);
  if (R.Settings.fieldZoom !== 'wide') err('C2', 'fieldZoom default should be wide, is ' + R.Settings.fieldZoom);
  const h = 12 * 14 + 16;
  if (h !== 184) err('C2', 'window height'); else ok('C2', specRows.length + ' settings + 戻る = 12 rows, height 184, defaults present');
}

// ---------------------------------------------------------------- C3 fixed texts
{
  const s9 = STYLE.slice(STYLE.indexOf('## 9. '), STYLE.indexOf('## 10. '));
  const wanted = [
    '{hero}たちは全滅した……。', '{hero}たちは目を覚ました。', '所持金が半分になった。',
    'に書き記した。', 'に上書きしますか？', '――　空き　――', '冒険の合言葉を見る',
    'いらっしゃいませ！　何をお求めですか？', 'これは売れない。',
    'ここでは使えない。', 'ダンジョンから脱出しますか？',
    'MPが足りない！', '使っても効果がない。', '今は使えない。',
    '盾を外した。', 'ほかに変わる能力はない。', 'この装備にしますか？', '今の装備がいちばんだ。',
    'どこへ行く？', 'の入口', '飛んでいける場所がない！',
    '入手：店で買える', '入手：宝箱・ボス', '入手：宝箱・魔物', 'が落とす（レア）', 'だけが落とす', '入手：めずらしい魔物', '入手：物語のお礼の一品物',
    '能力値の増減なし', 'まだ誰も覚えていない。', 'ひと晩', 'お泊まりになりますか？', 'おはようございます。', 'いってらっしゃいませ。', '隠し通路',
  ];
  let n = 0;
  for (const t of wanted) {
    const inStyle = s9.includes(t.replace(/\\n/g, ''));
    if (!inStyle) { err('C3', 'text not in STYLE_JA §9 (update the list): ' + t); continue; }
    if (!ALL.includes(t)) { err('C3', 'STYLE_JA §9 text missing from the menu sources: ' + t); continue; }
    n++;
  }
  for (const bad of ['全滅してしまった', 'お金が半分になってしまった', '冒険の書', '復活の呪文']) if (ALL.includes(bad)) err('C3', 'banned wording in the menu sources: ' + bad);
  ok('C3', n + ' fixed texts found verbatim');
}

// ---------------------------------------------------------------- C4 sound ids
{
  const s = section('#### 11.11.4 ');
  const list = (label) => { const m = s.match(new RegExp('\\*\\*' + label + '[^*]*\\*\\*: ([^\\n]+)')); return new Set(m ? [...m[1].matchAll(/`([^`]+)`/g)].flatMap((x) => x[1].split(/\s+/)) : []); };
  const sfx = list('効果音'), jin = list('ジングル');
  const crest = (DESIGN.match(/クレストの 48 はすべて残す（`([^`]+)`/) || [])[1];
  if (crest) crest.split(/\s+/).forEach((x) => sfx.add(x));
  let n = 0;
  for (const [f, src] of Object.entries(SRC)) {
    for (const m of src.matchAll(/R\.sfx\('([a-z_0-9]+)'\)/g)) { n++; if (!sfx.has(m[1])) err('C4', f + ': sfx ' + m[1] + ' is not in §11.11.4'); }
    for (const m of src.matchAll(/R\.jingle\('([a-z_0-9]+)'\)/g)) { n++; if (!jin.has(m[1])) err('C4', f + ': jingle ' + m[1] + ' is not in §11.11.4'); }
  }
  ok('C4', n + ' sound calls checked');
}

// ---------------------------------------------------------------- C5 names
{
  const K = M.kit;
  const races = new Set(Object.values(DB.monsters).map((m) => m.race).filter(Boolean));
  for (const r of races) if (!K.raceName(r) || K.raceName(r) === r) err('C5', 'race ' + r + ' has no Japanese name (図鑑 page 2)');
  for (const s of Object.keys(DB.statuses)) if (!K.statusName(s) || K.statusName(s) === s) err('C5', 'status ' + s + ' has no name');
  for (const w of Object.keys(DB.weaponTypes)) if (!K.wtypeName(w) || K.wtypeName(w) === w) err('C5', 'weapon type ' + w + ' has no name');
  for (const e of Object.keys(DB.elements)) if (!K.elemName(e) || K.elemName(e) === e) err('C5', 'element ' + e + ' has no name');
  const targets = new Set(Object.values(DB.actions).map((a) => a.target).concat(Object.values(DB.items).map((i) => i.use && i.use.target)).filter(Boolean));
  for (const t of targets) if (!M.TARGET_NAMES[t]) err('C5', 'target ' + t + ' has no display name (技・術 / 道具 detail)');
  ok('C5', races.size + ' races, ' + Object.keys(DB.statuses).length + ' statuses, ' + Object.keys(DB.weaponTypes).length + ' weapon types, ' + targets.size + ' targets named');
}

// ---------------------------------------------------------------- C6 icons
{
  const K = M.kit;
  const miss = new Map();
  for (const id of Object.keys(DB.items)) {
    const k = K.iconKey(id);
    if (k && !R.Gfx.has(k)) miss.set(k, (miss.get(k) || 0) + 1);
  }
  for (const e of Object.keys(DB.elements)) if (!R.Gfx.has('icon:el_' + e)) miss.set('icon:el_' + e, 1);
  for (const [k, n] of miss) warn('C6', 'icon ' + k + ' not registered (' + n + ' items draw nothing)');
  ok('C6', Object.keys(DB.items).length + ' item icons resolved');
}

// ---------------------------------------------------------------- C7 structure
{
  const test = fs.readFileSync(path.join(ROOT, 'tools/test_menu.js'), 'utf8');
  for (let i = 1; i <= 8; i++) if (!new RegExp("'T" + i + ' ').test(test)) err('C7', 'test_menu.js has no T' + i + ' check');
  if (fs.existsSync(path.join(ROOT, 'src/systems/menu_jobs.js'))) err('C7', 'menu_jobs.js must be deleted (§13.1)');
  if (!/Menu\.kitStar = /.test(SRC['menu.js'] || '')) err('C7', 'Menu.kitStar must live in menu.js');
  for (const fn of ['itemDetail', 'actionDetail', 'detailLines', 'previewStats', 'equipCandidates', 'equipScreen', 'statusScreen', 'orderScreen', 'skillBookScreen', 'bookScreen', 'chronicleScreen', 'saveScreen', 'saveMenu', 'settings', 'pickMember', 'applyFieldEffect', 'useItem', 'codeOverlay', 'itemScreen', 'spellScreen', 'open']) {
    if (typeof M[fn] !== 'function') err('C7', 'R.Menu.' + fn + ' is missing (§4 API table)');
  }
  for (const fn of ['itemLabel', 'itemColor', 'iconKey']) if (typeof M.kit[fn] !== 'function') err('C7', 'R.Menu.kit.' + fn + ' is missing (§11.1.2)');
  if (!M.kit.APT_COLOR) err('C7', 'R.Menu.kit.APT_COLOR is missing');
  if (typeof R.Shop.open !== 'function' || typeof R.Shop.inn !== 'function' || R.Shop.church) err('C7', 'R.Shop.open / inn (and no church)');
  if (typeof R.GameOver.run !== 'function') err('C7', 'R.GameOver.run is missing');
  ok('C7', 'API surface and tests present');
}

// ---------------------------------------------------------------- C8 mods keys
{
  const s = section('#### 3.3.16 ');
  const table = s.slice(0, s.indexOf('| ファイル') > 0 ? s.indexOf('| ファイル') : s.length);
  const specKeys = [...new Set(table.split('\n').filter((l) => l.startsWith('| `')).flatMap((l) => {
    const first = l.split('|')[1];
    return [...first.matchAll(/`([^`]+)`/g)].flatMap((m) => m[1].split(/\s+/).map((w) => w.replace(/[:*].*$/, '').replace(/\*/g, '')));
  }).filter((k) => /^[a-zA-Z]+$/.test(k)))];
  if (specKeys.length < 50) err('C8', '§3.3.16 table parse found only ' + specKeys.length + ' keys');
  const missing = specKeys.filter((k) => !M.MOD_KEYS.includes(k));
  if (specKeys.length && missing.length) err('C8', 'popup lacks §3.3.16 mods keys: ' + missing.join(' '));
  const used = new Set();
  for (const it of Object.values(DB.items)) for (const k of Object.keys(it.mods || {})) used.add(k);
  const unknown = [...used].filter((k) => !M.MOD_KEYS.includes(k));
  if (unknown.length) err('C8', 'items use mods keys the popup cannot phrase: ' + unknown.join(' '));
  ok('C8', specKeys.length + ' spec keys, ' + M.MOD_KEYS.length + ' popup keys; ' + used.size + ' keys used by items');
}

console.log(`check_menu: ${checks} ok, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
