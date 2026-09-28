#!/usr/bin/env node
// 顔絵の道具（CAST、V2_PLAN §6.3）。ゲームの実行時には使わない・通信しない。
//
//   node v2/tools/portraits.js --list                    一覧（chronicle/design/portraits/manifest.json）と状態
//   node v2/tools/portraits.js --init                    一覧を R.DB.looks から作り直す（状態・メモは残す）
//   node v2/tools/portraits.js --export-refs [--only a,b] 今の顔（原画の表情か仮の顔）と全身を参考画像として design/portraits/refs/ に書く（ビルドが先）
//   node v2/tools/portraits.js --dry-run --only berna [--expr neutral,smile]   指示文を表示するだけ
//   node v2/tools/portraits.js --sheet                   描いた顔（chronicle/assets/portraits/<look>_<expr>.webp）の一覧表 design/portraits/sheet.html
//
// BRIEF A38（2026-09-26）で「顔絵の OpenAI は不要」になった: 顔はキャラのシート（画像 AI の原画、sprite_pipe のシート9）の表情から作る
// （hd:face:<look>、v2/assets/sprites/<look>/face.png）。そのためこの道具は画像 API を呼ばない（描く命令は案内だけを出して終了コード 0）。
// 描いた一枚絵を使うことになったときは、画像をオーナーが chronicle/assets/portraits/<look>_<expr>.webp に置き、一覧で approved にすればビルドが入れる（§6.2）。
// キー・モデルの名前はこのファイルにもリポジトリにも書かない。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');          // chronicle/
const DIR = path.join(ROOT, 'design', 'portraits');
const MANIFEST = path.join(DIR, 'manifest.json');
const PROMPTS = path.join(DIR, 'prompts.json');
const ASSETS = path.join(ROOT, 'assets', 'portraits');
const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];

function args(argv) {
  const o = { cmd: null, only: null, expr: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') o.only = argv[++i].split(',');
    else if (a === '--expr') o.expr = argv[++i].split(',');
    else if (a.startsWith('--')) o.cmd = o.cmd || a.slice(2);
  }
  return o;
}
function load() { return require('./lib/load')({ quiet: true }); }
function readManifest() { return fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : []; }

/** 顔を出す人（§6.1）と優先（1 = 物語の主な人 MAIN_CAST、2 = 仲間・主人公）。町の人は顔なし（オーナーの決まり 2026-09-28） */
function faceList(R) {
  const L = R.DB.looks;
  const out = [];
  for (const id of Object.keys(L)) {
    if (!R.Art.cast.hasFace(id)) continue;
    const pri = (R.Art.cast.MAIN_CAST || []).includes(id) ? 1 : 2;
    out.push({ look: id, name: L[id].name, pri });
  }
  return out.sort((a, b) => a.pri - b.pri || a.look.localeCompare(b.look));
}

function init() {
  const R = load();
  const old = {};
  for (const m of readManifest()) old[m.look] = m;
  const list = faceList(R).map((f) => {
    const o = old[f.look] || {};
    const hasSheet = fs.existsSync(path.join(ROOT, 'v2', 'assets', 'sprites', f.look, 'face.png'));
    return { look: f.look, name: f.name, exprs: EXPRS.slice(), priority: f.pri, status: o.status || 'todo',
      note: hasSheet ? '原画のシートの表情（sprite_pipe）を使用中' : o.note || '仮の顔（骨組み）。原画のシート9 待ち' };   // 原画の顔が届いたら古いメモは使わない
  });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(list, null, 1) + '\n');
  console.log(`manifest: ${list.length} 人 → ${path.relative(ROOT, MANIFEST)}`);
}

function list() {
  const man = readManifest();
  if (!man.length) { console.log('一覧が無い。 --init で作る'); return; }
  const by = {};
  for (const m of man) {
    by[m.status] = (by[m.status] || 0) + 1;
    const files = EXPRS.filter((e) => fs.existsSync(path.join(ASSETS, `${m.look}_${e}.webp`)));
    console.log(`${String(m.priority)}  ${m.status.padEnd(9)} ${m.look.padEnd(18)} ${m.name.padEnd(8)}  描いた顔 ${files.length}/5  ${m.note || ''}`);
  }
  console.log('\n' + Object.entries(by).map(([k, v]) => `${k} ${v}`).join('  '));
}

/** 人ごとの見た目の文（§6.3。作品名・固有の名前を入れない） */
function describe(R, look, expr) {
  const l = R.DB.looks[look];
  const P = fs.existsSync(PROMPTS) ? JSON.parse(fs.readFileSync(PROMPTS, 'utf8')) : { common: '', exprs: {} };
  const hw = l.headwear ? (typeof l.headwear === 'object' ? l.headwear.type : l.headwear) : null;
  const parts = [
    P.common,
    `人物: ${l.body.sex === 'f' ? '女性' : '男性'}、${{ adult: '大人', youth: '若者', short: '小柄（子どもか山の民）', old: '年配' }[l.body.age] || ''}、体つき ${l.body.build}。`,
    `髪: ${l.hair.style}、色 ${l.hair.color}${l.hair.ears === 'elf' ? '、長くとがった耳' : ''}。目の色 ${l.eyes}。肌 ${l.skin}。`,
    `服: ${l.outfit.type}、主色 ${l.outfit.main}、副色 ${l.outfit.sub}、ふち ${l.outfit.trim}${l.mantle ? '、マント' : ''}${l.scarf ? '、赤いマフラー' : ''}${hw ? '、かぶり物 ' + hw : ''}${(l.extras || []).length ? '、' + l.extras.join('・') : ''}。`,
    `表情: ${(P.exprs && P.exprs[expr]) || expr}。`,
  ];
  return parts.filter(Boolean).join('\n');
}
function dryRun(o) {
  const R = load();
  const looks = o.only || faceList(R).filter((f) => f.pri === 1).map((f) => f.look);
  const ex = o.expr || ['neutral'];
  let n = 0;
  for (const look of looks) {
    if (!R.DB.looks[look]) { console.log(`知らない look: ${look}`); continue; }
    for (const e of ex) { n++; console.log(`---- ${look}:${e}\n${describe(R, look, e)}\n`); }
  }
  console.log(`（dry-run: ${n} 枚分の指示文。画像 API は呼ばない。A38）`);
}

async function exportRefs(o) {
  const B = require('./lib/browser');
  const out = path.join(DIR, 'refs');
  fs.mkdirSync(out, { recursive: true });
  const S = await B.start();
  try {
    const P = await B.open(S, 'dev.html');
    const R = load();
    const looks = o.only || faceList(R).map((f) => f.look);
    const res = await P.page.evaluate((looks) => {
      const R = window.RPG, E = ['neutral', 'smile', 'sad', 'angry', 'surprise'], out = {};
      for (const l of looks) {
        const cv = document.createElement('canvas'); cv.width = 5 * 256 + 180; cv.height = 256;
        const g = cv.getContext('2d'); g.fillStyle = '#141a2c'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
        E.forEach((e, i) => R.Portrait.draw(g, l, { x: i * 256, y: 0, w: 256, h: 256 }, { expr: e }));
        const f = R.Hd.now('hd:field:' + l, { scale: 1.15 });
        if (f) { const fr = f.frames[f.poses.stand_s[0]]; g.save(); g.translate(5 * 256 + 90, 240); g.scale(3, 3); g.drawImage(fr.c, -fr.ox, -fr.oy); g.restore(); }
        out[l] = cv.toDataURL('image/png');
      }
      return out;
    }, looks);
    for (const [l, url] of Object.entries(res)) fs.writeFileSync(path.join(out, `${l}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`refs: ${Object.keys(res).length} 枚 → ${path.relative(ROOT, out)}`);
    if (P.errors.length) { console.log(P.errors.join('\n')); process.exitCode = 1; }
    await P.close();
  } finally { await B.stop(S); }
}

function sheet() {
  const man = readManifest();
  const rows = man.map((m) => `<tr><td>${m.look}<br>${m.name}<br><small>${m.status}</small></td>${EXPRS.map((e) => {
    const f = path.join(ASSETS, `${m.look}_${e}.webp`);
    return `<td>${fs.existsSync(f) ? `<img src="../../assets/portraits/${m.look}_${e}.webp" width="160">` : '—'}</td>`;
  }).join('')}</tr>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>顔絵の一覧</title><style>body{background:#141a2c;color:#ddd;font-family:sans-serif}td{padding:4px;text-align:center}</style>
<table><tr><th></th>${EXPRS.map((e) => `<th>${e}</th>`).join('')}</tr>${rows}</table>`;
  fs.writeFileSync(path.join(DIR, 'sheet.html'), html);
  console.log('sheet → ' + path.relative(ROOT, path.join(DIR, 'sheet.html')));
}

if (require.main === module) {
  const o = args(process.argv.slice(2));
  (async () => {
    if (o.cmd === 'init') init();
    else if (o.cmd === 'list') list();
    else if (o.cmd === 'dry-run') dryRun(o);
    else if (o.cmd === 'export-refs') await exportRefs(o);
    else if (o.cmd === 'sheet') sheet();
    else if (o.cmd === 'generate' || (!o.cmd && o.only)) {
      console.log('画像 API で顔絵は描かない（BRIEF A38「顔絵の OpenAI は不要」）。顔はキャラのシートの表情から: design/sprite_pipe（シート9）→ v2/assets/sprites/<look>/face.png。');
    } else console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 14).join('\n'));
  })().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
}
module.exports = { faceList, describe };
