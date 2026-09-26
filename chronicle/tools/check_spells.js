#!/usr/bin/env node
// A8 spells の突き合わせ（DESIGN §7.6〜§7.9 の表 ⇔ データ、STYLE_JA の文の決まり、ほかの担当とのつながり）。
//
//   node tools/check_spells.js [-v]
//
// エラー（exit 1）: この担当のデータ（術 77・属性・状態）が DESIGN の表・STYLE_JA と違う。
// 警告（数だけ）: ほかの担当の側の足りないもの（fx・効果音・絵のキー・エンジンのつなぎ）。報告の「依頼」に使う。
'use strict';
const fs = require('fs');
const path = require('path');
const VERBOSE = process.argv.includes('-v');
const H = require('./fixtures/spells/lib/harness')({});
const R = H.R, DB = R.DB;
const ROOT = H.ROOT;
const errors = [], warns = [];
const err = (m) => { errors.push(m); console.log('ERROR ' + m); };
const warn = (m) => { warns.push(m); if (VERBOSE) console.log('warn  ' + m); };
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').split('\n');
const STYLE = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
const spells = Object.keys(DB.actions).filter((k) => k.startsWith('s_'));
const A = (id) => DB.actions[id];
const width = (s) => { let w = 0; for (const ch of String(s)) w += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; };

// SYSTEMS_REWORK（A17 §1.4 の glim.prof、A18 §2.5 の勇気の灯火）を DESIGN §7 の表とコードに重ねる（DESIGN が直れば何もしない）
const clsOf = (id) => (/_[ab]$/.test(id) ? (id.endsWith('_a') ? 'comboA' : 'comboB') : /^s_[a-z]+_\d$/.test(id) ? 'single' + id.slice(-1) : 'triple');
const PROF_A17 = { single1: 1, single2: 4, single3: 10, single4: 19, single5: 32, comboA: 14, comboB: 25, triple: 34 };
const REWORK = { s_fire_light_b: { desc: '全員の攻撃力を上げ、再生の状態にする。', field: false,
  effects: [{ type: 'buff', stat: 'atk', stages: 1 }, { type: 'status', status: 'regen' }] } };

// ---------------------------------------------------------------- 1. §7.6 の表 ⇔ データ
const section = (from, to) => { const a = DESIGN.findIndex((l) => l.startsWith(from)); const b = DESIGN.findIndex((l, i) => i > a && l.startsWith(to)); return DESIGN.slice(a, b < 0 ? DESIGN.length : b); };
const rows = section('#### 7.6.1', '#### 7.6.4').filter((l) => /^\| `s_/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
const TGT = { '敵1体': 'enemy', '敵全体': 'enemies', '敵ランダム': 'random', '味方1人': 'ally', '味方全員': 'allies', '自分': 'self', '倒れた1人': 'ally_dead', '全員（倒れた人も）': 'party' };
const EJ = { '火': 'fire', '水': 'water', '風': 'wind', '土': 'earth', '光': 'light', '闇': 'dark' };
if (rows.length !== 77) err(`§7.6 の表の行が 77 でない（${rows.length}）`);
for (const r of rows) {
  const [idc, name, els, , glim, mp, tgt, effects, field, desc] = r;
  const id = idc.replace(/`/g, '');
  const a = A(id);
  if (!a) { err(`${id}: 表にあるがデータに無い`); continue; }
  if (a.name !== name) err(`${id}: 名前 ${a.name} ≠ 表 ${name}`);
  const rw = REWORK[id] || {};
  if (a.desc !== (rw.desc || desc)) err(`${id}: desc「${a.desc}」≠ 表「${rw.desc || desc}」`);
  if (a.mp !== +mp) err(`${id}: MP ${a.mp} ≠ 表 ${mp}`);
  if (a.target !== TGT[tgt]) err(`${id}: 対象 ${a.target} ≠ 表 ${tgt}`);
  const wantEls = els.split('＋').map((x) => EJ[x]);
  if (JSON.stringify(wantEls) !== JSON.stringify(a.elements)) err(`${id}: 属性 ${a.elements} ≠ 表 ${els}`);
  const [lv, prof] = glim.split('/').map((x) => +x.trim());
  if (a.glim.lv !== lv || a.glim.prof !== PROF_A17[clsOf(id)]) err(`${id}: glim ${a.glim.lv}/${a.glim.prof} ≠ 表 ${lv} / ${PROF_A17[clsOf(id)]}（段階 ${prof} → A17）`);
  if ((rw.field != null ? rw.field : field !== '—') !== !!a.field) err(`${id}: 外（field）${!!a.field} ≠ 表 ${field}`);
  // 効果の文の中の数（SP・%）がデータにあるか
  for (const m of effects.matchAll(/SP([0-9.]+)(?:×(\d+)回)?/g)) {
    const sp = +m[1], hits = m[2] ? +m[2] : undefined;
    if (!a.effects.some((e) => e.type === 'damage' && Math.abs(e.power - sp) < 1e-9 && (hits == null || e.hits === hits))) err(`${id}: 表の ${m[0]} がデータに無い`);
  }
  for (const m of effects.matchAll(/(毒|やけど|眠り|まひ|凍結|気絶|混乱|沈黙|暗闇|即死)(\d+)%/g)) {
    const S = { 毒: 'poison', やけど: 'burn', 眠り: 'sleep', まひ: 'paralyze', 凍結: 'freeze', 気絶: 'stun', 混乱: 'confuse', 沈黙: 'silence', 暗闇: 'blind', 即死: 'death' }[m[1]];
    if (!a.effects.some((e) => e.type === 'status' && e.status === S && Math.abs(e.chance - m[2] / 100) < 1e-9)) err(`${id}: 表の ${m[0]} がデータに無い`);
  }
  for (const m of effects.matchAll(/(?<!WP)(回復|蘇生)(\d+)%/g)) {
    const T = m[1] === '回復' ? 'heal' : 'revive';
    if (!a.effects.some((e) => e.type === T && Math.abs(e.pct - m[2] / 100) < 1e-9)) err(`${id}: 表の ${m[0]} がデータに無い`);
  }
  for (const m of effects.matchAll(/(攻撃力|守備力|術力|術防|素早さ)([+−])(\d)(?:（(\d+)%）)?/g)) {
    const st = { 攻撃力: 'atk', 守備力: 'def', 術力: 'mag', 術防: 'mdef', 素早さ: 'agi' }[m[1]];
    const stages = (m[2] === '+' ? 1 : -1) * +m[3];
    const ch = m[4] ? +m[4] / 100 : undefined;
    if (!a.effects.some((e) => e.type === 'buff' && e.stat === st && e.stages === stages && (ch === undefined ? e.chance === undefined : Math.abs(e.chance - ch) < 1e-9))) err(`${id}: 表の ${m[0]} がデータに無い`);
  }
  if (/［味方全員］/.test(effects) && !a.effects.some((e) => e.on === 'allies')) err(`${id}: 表の［味方全員］（on:'allies'）がデータに無い`);
  if (/先制/.test(effects) !== !!a.quick) err(`${id}: 先制（quick）が表と違う`);
  if (/WP回復(\d+)%/.test(effects) && !REWORK[id]) { const d = +effects.match(/WP回復(\d+)%/)[1] / 100; if (!a.effects.some((e) => e.type === 'healWp' && Math.abs(e.pct - d) < 1e-9)) err(`${id}: 表の WP回復 がデータに無い`); }
  if (/吸収(\d+)%/.test(effects)) { const d = +effects.match(/吸収(\d+)%/)[1] / 100; if (!a.effects.some((e) => e.drain === d)) err(`${id}: 表の吸収 ${d} がデータに無い`); }
  if (/術防(\d+)%無視/.test(effects)) { const d = +effects.match(/術防(\d+)%無視/)[1] / 100; if (!a.effects.some((e) => e.ignoreMdef === d)) err(`${id}: 表の術防無視がデータに無い`); }
}
// §7.8.1: SP 合計・MP
const t781 = section('#### 7.8.1', '#### 7.8.2').filter((l) => /^\| `s_/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
if (t781.length !== 77) err(`§7.8.1 の行が 77 でない（${t781.length}）`);
for (const [idc, , , mp, , sp] of t781) {
  const id = idc.replace(/`/g, ''), a = A(id);
  if (!a) continue;
  const tot = a.effects.filter((e) => e.type === 'damage' && e.formula === 'magic').reduce((s, e) => s + e.power * (e.hits || 1), 0);
  if (a.mp !== +mp) err(`${id}: §7.8.1 の MP ${mp} ≠ ${a.mp}`);
  if (sp !== '—' && Math.abs(tot - parseFloat(sp)) > 0.051) err(`${id}: §7.8.1 の SP 合計 ${sp} ≠ ${tot.toFixed(2)}`);
}
// §7.8.2: 効果ごとの出どころの数
const t782 = section('#### 7.8.2', '#### 7.8.3').filter((l) => /^\| /.test(l) && !/^\| 効果|^\|---/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
function countEff(key) {
  const m = key.match(/`([+-]?)([a-zA-Z_]+)`/);
  if (!m) return null;
  const sign = m[1], k = m[2];
  return spells.filter((id) => A(id).effects.some((e) => {
    if (sign) return e.type === 'buff' && e.stat === k && (sign === '+' ? e.stages > 0 : e.stages < 0);
    if (k === 'dispel_good') return e.type === 'dispel' && e.side === 'good';
    if (k === 'dispel_bad') return e.type === 'dispel' && e.side === 'bad';
    if (k === 'drain') return e.drain > 0;
    if (k === 'percent') return e.type === 'damage' && e.formula === 'percent';
    if (['heal', 'revive', 'cure', 'healWp'].includes(k)) return e.type === k;
    return e.type === 'status' && e.status === k;
  })).length;
}
// A18 (§2.5): 勇気の灯火 lost its WP heal and gained 再生
const T782_A18 = { healWp: -1, regen: +1 };
for (const [key, n] of t782) { const got = countEff(key); const k = (key.match(/`[+-]?([a-zA-Z_]+)`/) || [])[1]; const want = +n + (T782_A18[k] || 0); if (got != null && got !== want) err(`§7.8.2 ${key}: 表 ${n}（A18 で ${want}）≠ データ ${got}`); }
// §7.8.3: フィールドの術 15
const t783 = (section('#### 7.8.3', '#### 7.8.4').join(' ').match(/`s_[a-z_0-9]+`/g) || []).map((x) => x.replace(/`/g, ''));
const fieldIds = spells.filter((id) => A(id).field);
const t783a = t783.filter((id) => !(REWORK[id] && REWORK[id].field === false));   // A18: 勇気の灯火 is battle-only
if (t783.length !== 15 || JSON.stringify(t783a.slice().sort()) !== JSON.stringify(fieldIds.slice().sort())) err(`§7.8.3 のフィールドの術と field:true が違う（表 ${t783a.length}・データ ${fieldIds.length}）`);
// §7.9: 属性と状態は CODE の写しそのもの
{
  const blocks = H.designBlocks('#### 7.9.1', '### 7.10');
  const tmp = { DB: { elements: {}, statuses: {} } };
  for (const b of blocks) new Function('R', b)(tmp);
  if (JSON.stringify(tmp.DB.elements) !== JSON.stringify(DB.elements)) err('DB.elements が §7.9.1 のコードと違う');
  if (JSON.stringify(tmp.DB.statuses) !== JSON.stringify(DB.statuses)) err('DB.statuses が §7.9.2 のコードと違う');
}
// §7.7 CODE 1〜3 のデータがそのまま
{
  const tmp = { DB: { actions: {} } };
  const code0 = H.designBlocks('### 7.7', '### 7.8')[0];
  const b = H.designBlocks('### 7.7', '### 7.8').slice(1);
  for (const body of b) new Function('R', code0.replace('    // ↓ CODE 1 / CODE 2 / CODE 3 の中身', body).replace('})(window.RPG);', '})(R);'))(tmp);
  const want = Object.keys(tmp.DB.actions);
  for (const id of want) {
    const t = tmp.DB.actions[id];
    t.glim.prof = PROF_A17[clsOf(id)];
    if (REWORK[id]) { Object.assign(t, { desc: REWORK[id].desc, effects: REWORK[id].effects, fx: A(id) && A(id).fx }); delete t.field; }
  }
  if (want.length !== 77) err(`§7.7 のコードの術が 77 でない（${want.length}）`);
  for (const id of want) if (JSON.stringify(tmp.DB.actions[id]) !== JSON.stringify(A(id))) err(`${id}: §7.7 のコードと違う`);
}

// ---------------------------------------------------------------- 2. STYLE_JA
const partial = [], exact = [], srcBan = [];
{
  const s71 = STYLE.slice(STYLE.indexOf('### 7.1'), STYLE.indexOf('### 7.2'));
  for (const m of s71.matchAll(/`([^`]+)`/g)) partial.push(...m[1].split(/\s+/).filter(Boolean));
  const s72 = STYLE.slice(STYLE.indexOf('### 7.2'), STYLE.indexOf('### 7.3'));
  const first = s72.match(/`([^`]+)`/);
  if (first) exact.push(...first[1].split(/\s+/).filter(Boolean));
  const s73 = STYLE.slice(STYLE.indexOf('### 7.3'), STYLE.indexOf('### 7.4'));
  const line = s73.split('\n').find((l) => l.startsWith('`'));
  for (const m of (line || '').matchAll(/`([^`]+)`/g)) srcBan.push(m[1]);
}
if (partial.length < 100 || exact.length < 30 || srcBan.length < 20) err(`STYLE_JA §7 の一覧を読めない（${partial.length}/${exact.length}/${srcBan.length}）`);
const allowed = new Set('杖槍斧鞭鎧兜棍閃狼巫砦傭鷹槌吠沌翔淵獅鷲狐樺蓮凪叉'.split(''));
let joyo = null;
try { joyo = new Set([...fs.readFileSync(path.join(ROOT, 'tools/lib/joyo.txt'), 'utf8').trim()]); } catch (e) { warn('tools/lib/joyo.txt が無いので常用漢字の検査を飛ばす'); }
const kanji = /[㐀-鿿豈-﫿]/;
function textCheck(where, s) {
  for (const ch of s) if (kanji.test(ch) && joyo && !joyo.has(ch) && !allowed.has(ch)) err(`${where}: 常用外の字「${ch}」（${s}）`);
  if (/…/.test(s.replace(/……/g, ''))) err(`${where}: 三点リーダーは 2 つ（${s}）`);
  if (/[^！？]　/.test(s)) err(`${where}: 「！」「？」の後でない全角スペース（${s}）`);
  if (/ /.test(s.replace(/\{[a-z]+\}/g, ''))) err(`${where}: 半角スペース（分かち書き）（${s}）`);
  for (const w of srcBan) if (s.includes(w)) err(`${where}: 使わない語「${w}」（${s}）`);
  if (/(眠り|まひ|沈黙|混乱|凍結|気絶|暗闇|やけど)にする/.test(s) || /にならない/.test(s)) err(`${where}: 使わない形（${s}）`);
  if (/[０-９]/.test(s)) err(`${where}: 全角数字（${s}）`);
}
for (const id of spells) {
  const a = A(id);
  for (const w of partial) if (a.name.includes(w)) err(`${id}: 名前 ${a.name} に使ってはいけない語「${w}」（STYLE_JA §7.1）`);
  for (const w of exact) if (a.name === w) err(`${id}: 名前 ${a.name} は使ってはいけない名前（STYLE_JA §7.2）`);
  textCheck(id + '.name', a.name);
  textCheck(id + '.desc', a.desc);
  if (width(a.name) > 8) err(`${id}: 名前が 8 字を超える`);
  if (width(a.desc) > 20) err(`${id}: desc が 20 字を超える`);
  if (!/。$/.test(a.desc)) err(`${id}: desc は「。」で終わる（${a.desc}）`);
  if (/蘇生|魔法|呪文/.test(a.name + a.desc)) err(`${id}: 画面に出さない語（蘇生・魔法・呪文）`);
}
for (const [s, d] of Object.entries(DB.statuses)) { textCheck('statuses.' + s + '.on', d.on); if (d.off) textCheck('statuses.' + s + '.off', d.off); textCheck('statuses.' + s + '.name', d.name); }
for (const [e, d] of Object.entries(DB.elements)) textCheck('elements.' + e, d.name);
// STYLE_JA §4 の状態の名前と印
{
  const t = STYLE.slice(STYLE.indexOf('## 4.'), STYLE.indexOf('## 5.'));
  for (const [s, d] of Object.entries(DB.statuses)) {
    if (s === 'death') continue;
    if (!t.includes(`${d.name} / ${d.icon}`) && !t.includes(`${d.name} / ${d.icon}・`) && !t.includes(`${d.name} / ${d.icon}`)) err(`statuses.${s}: STYLE_JA §4 の「${d.name} / ${d.icon}」と違う`);
  }
}
// 名前の重なり（技・術・敵の行動。§7.13-3。魔物は §7.0 の 0.13 の例外だけ）
{
  const byName = {};
  for (const [id, a] of Object.entries(DB.actions)) (byName[a.name] = byName[a.name] || []).push(id);
  for (const [n, ids] of Object.entries(byName)) {
    const s = ids.filter((i) => i.startsWith('s_'));
    if (!s.length || ids.length < 2) continue;
    const others = ids.filter((i) => !i.startsWith('s_'));
    const okMon = s.length === 1 && A(s[0]).cls === 'single' && A(s[0]).step <= 3 && others.every((i) => /^e_|^eb_/.test(i));
    if (!okMon) err(`名前「${n}」が重なる: ${ids.join(', ')}`);
    else warn(`名前「${n}」を魔物の行動 ${others.join(',')} も使う（§7.0 の 0.13 で許される）`);
  }
  for (const it of Object.values(DB.items || {})) if (spells.some((id) => A(id).name === it.name)) err(`術の名前「${it.name}」が品の名前と重なる`);
  for (const m of Object.values(DB.monsters || {})) if (spells.some((id) => A(id).name === m.name)) err(`術の名前「${m.name}」が魔物の名前と重なる`);
}

// ---------------------------------------------------------------- 3. ほかの担当とのつながり（警告）
const FX = (R.BattleFX && R.BattleFX.FX) || {};
for (const id of spells) for (const f of [].concat(A(id).fx)) if (!FX[f.replace(/\d+$/, '')]) warn(`fx ${f}（${id}）が R.BattleFX.FX に無い（bui A3）`);
for (const [e, d] of Object.entries(DB.elements)) {
  if (!FX[d.fx]) warn(`属性 ${e} の fx ${d.fx} が無い（bui A3）`);
  if (DB.sfx && Object.keys(DB.sfx).length && !DB.sfx[d.sfx] && !(R.Audio && R.Audio.IDS && [].concat(R.Audio.IDS.sfx || []).includes(d.sfx))) warn(`属性 ${e} の効果音 ${d.sfx} が無い（audio A17）`);
  if (R.Gfx && R.Gfx.has && !R.Gfx.has(d.icon)) warn(`絵のキー ${d.icon} が無い（art-chars A13）`);
}
for (const s of ['burn', 'freeze', 'stun', 'veil', 'counter', 'nimble', 'cover']) if (R.Gfx && R.Gfx.has && !R.Gfx.has('bfx:icon_' + s)) warn(`状態の印 bfx:icon_${s} が無い（bui A3。§11.11.1）`);
{
  const src = (f) => { try { return fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'); } catch (e) { return ''; } };
  const battle = src('systems/battle.js'), scene = src('systems/battle_scene.js'), ai = src('systems/battle_ai.js');
  if (!/R\.Glimmer\.roll/.test(battle)) warn('battle.js が R.Glimmer.roll を呼んでいない（battle A2）');
  if (!/R\.Glimmer\.learn/.test(battle)) warn('battle.js が R.Glimmer.learn を呼んでいない（battle A2）');
  if (!/glimmer/.test(scene)) warn("battle_scene.js が 'glimmer' のイベントを描いていない（bui A3）");
  if (!/Glimmer\.candidates/.test(ai)) warn('battle_ai.js が閃きねらい（R.Glimmer.candidates。§4.13.2-d）を使っていない（battle A2）');
  if (!/Glimmer\.banner|合成術/.test(scene)) warn('閃きの札の見出し（合成術・奥義・極意。§11.5.7）が battle_scene.js に無い。R.Glimmer.banner(a) を使える（bui A3）');
  const menus = fs.readdirSync(path.join(ROOT, 'src/systems')).filter((f) => f.startsWith('menu')).map((f) => src('systems/' + f)).join('\n');
  if (!/術の書/.test(menus)) warn('術の書（§11.7.8）がメニューにまだ無い（menu A5）');
}
// 魔物の状態の耐性に知らない状態 id が無いか（mons A11・boss A12 の側。§9.14.2）
for (const [id, m] of Object.entries(DB.monsters || {})) for (const s of Object.keys(m.statusRes || {})) if (!DB.statuses[s]) warn(`魔物 ${id} の statusRes に知らない状態 ${s}`);
// 仲間・主人公の startSpells
for (const [id, c] of Object.entries(DB.companions)) for (const s of c.startSpells || []) if (!A(s)) err(`仲間 ${id} の startSpells ${s} が無い`);

console.log(`check_spells: ${rows.length} rows (§7.6), ${spells.length} spells — ${errors.length} error(s), ${warns.length} warning(s)`);
if (!VERBOSE && warns.length) for (const w of warns.slice(0, 30)) console.log('warn  ' + w);
process.exitCode = errors.length ? 1 : 0;
