#!/usr/bin/env node
// CAST の node のテスト（V2_PLAN §4.4 の CAST の行）: 見た目の一覧（§2.6.2 の id すべて・K.look）、主色の色相の差、頭の輪郭の違い、
// ポーズの数、R.Portrait（parse・key・契約）、絵のキーの登録、原画のスプライトの JSON（v2/assets/sprites/*）、顔絵の一覧（manifest）。
//   node v2/tools/test_cast.js
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const V2 = path.resolve(__dirname, '..');

const L = R.DB.looks || {};
section('見た目の一覧（§2.6.2）');
const TYPES = ['warrior', 'ranger', 'mage', 'spellblade', 'wanderer'];
const heroes = [].concat(...['m', 'f'].map((s) => TYPES.map((t) => `hero_${s}_${t}`)));
const comps = Object.keys(R.DB.companions || {});
const story = ['berna', 'rowell', 'fine', 'otto', 'elm'];
const named = ['npc_hanna', 'npc_rita', 'npc_gord', 'npc_pim_mother', 'npc_pim', 'npc_hans', 'npc_ben', 'npc_roy', 'npc_yura_elder'];
const ntypes = ['man', 'woman', 'old_m', 'old_f', 'child', 'sailor', 'merchant', 'woodcutter', 'guard', 'keeper', 'bard', 'yura_folk'];
const townsfolk = [].concat(...ntypes.map((t) => [1, 2, 3, 4].map((n) => `npc_${t}_${n}`)));
const animals = ['ani_cat', 'ani_dog', 'ani_hen', 'ani_fawn'];
ok('主人公 10', heroes.every((id) => L[id]), heroes.filter((id) => !L[id]));
ok('仲間 20（companions の look と同じ id）', comps.length === 20 && comps.every((id) => L[R.DB.companions[id].look]), comps.filter((id) => !L[R.DB.companions[id].look]));
ok('物語の人 5', story.every((id) => L[id]));
ok('名前のある町の人 9', named.every((id) => L[id]));
ok('町の人の型 12 × 4', townsfolk.every((id) => L[id]), townsfolk.filter((id) => !L[id]));
ok('動物 4', animals.every((id) => L[id]));
const bad = Object.keys(L).filter((id) => !R.Contract.check('look', L[id]).ok);
ok('全部の look が K.look', bad.length === 0, bad.slice(0, 5).map((id) => [id, R.Contract.check('look', L[id]).errors]));
ok('名前が空でない', Object.keys(L).every((id) => typeof L[id].name === 'string' && L[id].name.length > 0), Object.keys(L).filter((id) => !L[id].name));
ok('仮の実装の look に頼っていない（stub_data の npc_old_m_1・npc_guard_1 も本物）', L.npc_old_m_1 && L.npc_guard_1);

section('主色の色相の差（STYLE_REFERENCE §0.7・R.Hd.STYLE.hueGap）');
const gap = (a, b) => { const d = Math.abs(L[a].hue - L[b].hue) % 360; return Math.min(d, 360 - d); };
const GAP = (R.Hd.STYLE && R.Hd.STYLE.hueGap) || 45;
const groups = { 見本の4人: ['hero_m_warrior', 'selma', 'sylvain', 'viola'], 前列の例: ['hero_m_warrior', 'hagen', 'titta', 'viola'], 癒し手の例: ['hero_m_warrior', 'hagen', 'titta', 'noela'] };
for (const [name, g] of Object.entries(groups)) {
  let min = 999;
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) min = Math.min(min, gap(g[i], g[j]));
  ok(`${name}（${g.join(' ')}）の色相の差 ≥ ${GAP}°`, min >= GAP, { min });
}
const people = heroes.filter((h) => /^hero_m_/.test(h)).concat(comps);
const close = [];
for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) if (gap(people[i], people[j]) < 12) close.push(`${people[i]}/${people[j]} ${gap(people[i], people[j])}°`);
console.log(`  似た色の組（12° 未満、主人公の男 5＋仲間 20）: ${close.length}\n    ${close.join('\n    ')}`);
ok('セルマは赤茶（色相 0〜30）・ヴィオラは薄紫（260〜300）（A33 ④）', L.selma.hue >= 0 && L.selma.hue <= 30 && L.viola.hue >= 260 && L.viola.hue <= 300);

section('頭の輪郭の違い');
const sil = comps.map((id) => L[id].silhouette);
ok('仲間 20 の silhouette がすべて違う', new Set(sil).size === 20, sil);
const headKey = (id) => `${L[id].hair.style}|${typeof L[id].headwear === 'object' ? L[id].headwear.type : L[id].headwear || ''}`;
const hk = comps.map(headKey);
ok('仲間 20 の「髪の型＋かぶり物」がすべて違う（絵の上で違う形）', new Set(hk).size === 20, hk);
const styles = new Set(Object.values(L).map((l) => l.hair.style));
ok('使う髪の型はすべて骨組みにある', [...styles].every((s) => R.Art.rig.hair.STYLES.includes(s)), [...styles].filter((s) => !R.Art.rig.hair.STYLES.includes(s)));
const hws = new Set(Object.values(L).map((l) => (typeof l.headwear === 'object' && l.headwear ? l.headwear.type : l.headwear)).filter(Boolean));
ok('使うかぶり物はすべて骨組みにある', [...hws].every((s) => R.Art.rig.headwear.TYPES.includes(s)), [...hws]);

section('ポーズの数（§2.5.7）');
const BTL = ['idle', 'step', 'slash', 'thrust', 'smash', 'shoot', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory'];
ok('戦闘の骨組みのポーズ 13＋windup・evade = 15', BTL.concat(['windup', 'evade']).every((p) => R.Art.rig.BATTLE[p] && R.Art.rig.BATTLE[p].length) && R.Art.cast.BTL_POSES.length === 15);
ok('原画の戦闘の計画も 15', R.Art.cast.BTL_POSES.every((p) => R.Art.cast.sprites.BTL_PLAN[p]));
const ACT = ['nod', 'shake', 'surprise', 'laugh', 'sad', 'point', 'kneel', 'sit', 'bow', 'raise_lantern', 'think'];
ok('フィールドの演技 11 種（R6）', ACT.every((a) => R.Art.rig.ACTING[a]) && Object.keys(R.Art.rig.ACTING).length === 11);
ok('表情 5 つ', R.Contract.EXPRS.every((e) => R.Art.rig.EXPR[e]));
ok('系統 5 つ（A29）', R.Art.cast.WTYPES.join() === 'sword,greatsword,dagger,bow,staff' && R.Art.rig.weapons.WTYPES.length === 5);

section('絵のキーの登録（§2.5.7）');
const persons = Object.keys(L).filter((id) => !L[id].animal);
ok('hd:btl:<look>:<wtype> = 人 × 5 系統', persons.every((id) => R.Art.cast.WTYPES.every((w) => R.Hd.has(`hd:btl:${id}:${w}`))), persons.length);
ok('hd:field:<look> = 全部の look', Object.keys(L).every((id) => R.Hd.has('hd:field:' + id)));
const faceLooks = heroes.concat(comps.map((c) => R.DB.companions[c].look), story, named);
ok('hd:face = 主人公・仲間・物語の人・名前のある町の人（§6.1）', faceLooks.every((id) => R.Hd.has('hd:face:' + id)));
ok('町の人の型と動物は顔なし', townsfolk.concat(animals).every((id) => !R.Hd.has('hd:face:' + id)));
ok('動物は戦闘の絵なし', animals.every((id) => !R.Hd.has(`hd:btl:${id}:sword`)));
ok('HD_KINDS: btl・field・face', R.Hd.kindOf('hd:btl:selma:sword') === 'btl' && R.Hd.kindOf('hd:field:selma') === 'field' && R.Hd.kindOf('hd:face:selma') === 'face');

section('R.Portrait（§2.5.16）');
ok('契約の関数（key has draw parse）', R.Contract.checkApi('Portrait').ok);
ok('仮の実装を使っていない（claim）', !(R.Stubs.installed.Portrait || []).length && R.Stubs.claimed && R.Stubs.claimed.Portrait !== undefined);
ok("key('berna','smile')", R.Portrait.key('berna', 'smile') === 'portrait:berna:smile' && R.Portrait.key('berna') === 'portrait:berna:neutral');
const P = (s) => JSON.stringify(R.Portrait.parse(s));
ok("parse('berna:smile')", P('berna:smile') === '{"look":"berna","expr":"smile"}');
ok("parse('berna') → neutral", P('berna') === '{"look":"berna","expr":"neutral"}');
ok("parse('berna:cry') → neutral（無い表情）", P('berna:cry') === '{"look":"berna","expr":"neutral"}');
ok('parse の結果が K.portraitParse', R.Contract.check('portraitParse', R.Portrait.parse('selma:angry')).ok);
ok("has: 顔のある人 'placeholder'、町の人の型 null、無い id null", R.Portrait.has('selma') === 'placeholder' && R.Portrait.has('npc_man_1') === null && R.Portrait.has('nobody') === null);

section('原画のスプライト（v2/assets/sprites、§2.11）');
const SP = path.join(V2, 'assets', 'sprites');
const dirs = fs.existsSync(SP) ? fs.readdirSync(SP).filter((d) => fs.statSync(path.join(SP, d)).isDirectory()) : [];
ok('hero_m_warrior（アルンの設定資料）がある', dirs.includes('hero_m_warrior'));
for (const d of dirs) {
  ok(`${d} は look の id`, !!L[d]);
  for (const f of fs.readdirSync(path.join(SP, d)).filter((f) => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(SP, d, f), 'utf8'));
    const png = path.join(SP, d, f.replace('.json', '.png'));
    ok(`${d}/${f}: {cell, anchor, poses, fps, frames} と png`, Array.isArray(j.cell) && Array.isArray(j.anchor) && j.poses && j.fps && Array.isArray(j.frames) && fs.existsSync(png));
    ok(`${d}/${f}: poses の番号が frames の中`, Object.values(j.poses).every((l) => l.every((i) => i >= 0 && i < j.frames.length)));
    if (f === 'face.json') ok(`${d}/face.json: 表情 5 つの対応`, R.Contract.EXPRS.every((e) => j.expr && j.expr[e] != null));
    if (f === 'battle.json') ok(`${d}/battle.json: 左向き`, j.facing === 'left');
  }
}

section('顔絵の一覧（§6.2、A38）');
const MF = path.join(V2, '..', 'design', 'portraits', 'manifest.json');
const man = fs.existsSync(MF) ? JSON.parse(fs.readFileSync(MF, 'utf8')) : null;
ok('design/portraits/manifest.json がある', Array.isArray(man));
if (man) {
  ok('顔のある人が全部並ぶ', faceLooks.every((id) => man.some((m) => m.look === id)), faceLooks.filter((id) => !man.some((m) => m.look === id)));
  ok('形 {look, name, exprs, priority, status, note}', man.every((m) => m.look && m.name && Array.isArray(m.exprs) && [1, 2, 3].includes(m.priority) && ['todo', 'generated', 'approved', 'rejected'].includes(m.status)));
}
// 原画の置き場: v2/assets/sprites/<look>/ のフォルダはすべて R.DB.looks の id（名前のフォルダ arun/ などの使われない媒体をビルドに入れない）
{
  const fs = require('fs'), pth = require('path');
  const dir = pth.join(__dirname, '..', 'assets', 'sprites');
  const dirs = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.statSync(pth.join(dir, d)).isDirectory()) : [];
  const stray = dirs.filter((d) => !L[d]);
  ok(`assets/sprites のフォルダは look の id だけ（${dirs.join(' ')}）`, stray.length === 0, stray);
  for (const d of dirs.filter((x) => L[x])) {
    const kinds = fs.readdirSync(pth.join(dir, d)).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
    ok(`${d}: どの png にも同じ名前の json`, kinds.every((k) => fs.existsSync(pth.join(dir, d, k + '.json'))), kinds);
  }
}
done('test_cast');
