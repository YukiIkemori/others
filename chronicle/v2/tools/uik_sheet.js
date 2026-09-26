#!/usr/bin/env node
// UIK の部品表（V2_PLAN §2.8・§4.4、MODERN_UI §3・§8.8）: 見本 design/art_proto/ui/out/kit.png と同じ内容を、本物の R.UIK で描いて撮る。
//
//   node v2/tools/uik_sheet.js [--out v2/design/shots/uik] [--html v2/dist/dev.html] [--scale 1|1.3]
//     → <out>/uik_sheet.png（1920×1080）・<out>/uik_sheet_vs_kit.png（上が本物、下が見本）
//       --scale 1.3 のときは uiScale 1.3 で撮った uik_sheet_13.png も
//   先に node v2/tools/build.js（dev.html に tools/fixtures/scenes/uik_sheet.json が入り、表の字が書体に入る）。
//   表の場面は dev.html?scene=uik_sheet を開いた後に、このファイルの中の関数をページで動かして積む（ゲームのファイルには入れない）。
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');

const V2 = path.resolve(__dirname, '..');
const KIT = path.resolve(V2, '..', 'design', 'art_proto', 'ui', 'out', 'kit.png');
function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

// ページの中で動かす: 部品表の場面（論理 960×540）
function sheetScene(scale) {
  const R = window.RPG, U = R.UIK, T = U.T, C = T.color;
  if (scale) { R.uiScale = scale; }
  const list = new U.List({ rows: [{ label: '道具', icon: 'bag' }, { label: '装備', icon: 'equip' }, { label: '設定', icon: 'gear' }], rowH: 34 });
  list.focusIndex(1);
  let snapped = false;
  function head(g, s, x, y, w) {
    U.text(g, s, x, y, { size: 11, weight: 700, color: C.gold, track: 3 });
    U.rule(g, x, x + w, y + 18, 0.22);
  }
  const scene = {
    id: 'uik_sheet', opaque: true,
    enter() {}, exit() {}, update() {},
    draw(g) {
      const W = R.W, H = R.H;
      const bg = g.createLinearGradient(0, 0, W * 0.3, H);
      bg.addColorStop(0, '#141a2c'); bg.addColorStop(1, '#0c0f1a');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const v = g.createRadialGradient(W * 0.5, H * 0.45, H * 0.2, W * 0.5, H * 0.5, W * 0.7);
      v.addColorStop(0, 'rgba(40,52,80,0.35)'); v.addColorStop(1, 'rgba(4,5,10,0.4)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
      // --- 文字
      const x1 = 24;
      head(g, '文字（Zen Maru Gothic）', x1, 20, 250);
      U.text(g, '見出し大 26', x1, 38, { size: 26, weight: 700 });
      U.text(g, '見出し 20', x1, 72, { size: 20, weight: 700 });
      U.text(g, '項目 15', x1, 102, { size: 15, weight: 700 });
      U.text(g, '本文 15　灯台の灯が消えてから', x1, 128, { size: 15 });
      U.text(g, '補足 12.5', x1, 156, { size: 12.5, color: C.text2 });
      U.text(g, '注記 11', x1, 183, { size: 11, color: C.text2 });
      U.text(g, 'LUMINOUS CHRONICLE', x1, 210, { size: 13, weight: 700, family: 'en', color: C.gold, track: 5, grad: [C.goldHi, C.gold, C.goldLo] });
      // --- 窓・フォーカス（本物の List と panel。すりガラスは 1 回だけ写した表の背景）
      head(g, '窓・フォーカス', x1, 252, 250);
      if (!snapped && R.Engine.frame > 2) { U.snapshot(); snapped = true; }
      U.panel(g, { x: x1, y: 276, w: 250, h: 120 }, { frost: true });
      list.draw(g, { x: x1 + 6, y: 285, w: 238, h: 102 });
      U.text(g, '紺のすりガラス（背景を 1 回だけぼかした写し）＋琥珀の縁', x1, 404, { size: 10, color: C.text3 });
      // --- 色
      const x2 = 300;
      head(g, '色', x2, 20, 250);
      const sw = [['文字', C.text], ['補足', C.text2], ['注記', C.text3], ['琥珀', C.gold], ['青緑', C.teal], ['上がる', C.up], ['下がる', C.down], ['レア★', C.rare], ['超レア★★', C.superRare], ['前', C.front], ['後', C.back]];
      sw.forEach(([n, c], i) => {
        const x = x2 + (i % 4) * 66, y = 44 + Math.floor(i / 4) * 44;
        R.Gfx.roundRect(x, y, 56, 22, 5, c);
        U.text(g, n, x, y + 26, { size: 9.5, color: C.text2 });
      });
      // --- アイコン（R.Contract.ICONS のすべて）
      head(g, 'アイコン（24 単位の線画）', x2, 180, 270);
      const icons = R.Contract.ICONS;
      icons.forEach((n, i) => { U.icon(g, n, x2 + (i % 12) * 23, 204 + Math.floor(i / 12) * 23, 16, C.text2); });
      // --- 札・数字
      head(g, '札・数字', x2, 330, 250);
      let cx = x2;
      cx += U.chip(g, cx, 352, 'NEW', { kind: 'new' }) + 6;
      cx += U.chip(g, cx, 352, '装備中', { kind: 'plain' }) + 6;
      cx += U.chip(g, cx, 352, '×2', { kind: 'plain', icon: 'ff' }) + 6;
      U.chip(g, cx, 352, '水の技を閃きやすい', { kind: 'teal', icon: 'bulb' });
      const nums = [['248', C.text, '通常', 1], [U.num(1284), C.superRare, '会心', 1], ['+86', C.up, 'HP回復', 1], ['+12', C.mp[1], 'MP回復', 1], ['ミス', C.text3, '外れ', 0.7]];
      let nx = x2;
      nums.forEach(([s, c, l, k]) => {
        const w = U.text(g, s, nx, 374 + (1 - k) * 12, { size: 24 * k, weight: 700, color: c, stroke: ['rgba(10,8,14,0.85)', 3] });
        U.text(g, l, nx, 406, { size: 9.5, color: C.text2 });
        nx += Math.max(w, 36) + 14;
      });
      // --- ゲージ
      const x3 = 600;
      head(g, 'ゲージ（HP 緑→琥珀 50%→赤 25%、MP 青）', x3, 20, 340);
      const gw = 200;
      U.gauge(g, { x: x3, y: 50, w: gw, h: 3 }, 90, 100, 'hp');
      U.gauge(g, { x: x3, y: 66, w: gw, h: 3 }, 42, 100, 'hp', { ghost: 0.6 });
      U.gauge(g, { x: x3, y: 82, w: gw, h: 3 }, 18, 100, 'hp');
      U.gauge(g, { x: x3, y: 98, w: gw, h: 3 }, 70, 100, 'mp');
      U.gauge(g, { x: x3, y: 114, w: gw, h: 3 }, 55, 100, 'exp');
      U.frac(g, 999, 999, x3 + gw + 74, 44, { size: 15 });
      U.frac(g, 18, 250, x3 + gw + 74, 76, { size: 15 });
      U.text(g, '被ダメージの直後は白い残像が 0.4 秒で縮む', x3, 132, { size: 10, color: C.text3 });
      // --- ボタン表示
      head(g, 'ボタン表示（入力に合わせて自動で切り替え）', x3, 180, 340);
      const rows = [['パッド', 'pad', { a: 'A', b: 'B', y: 'Y' }], ['キーボード', 'kb', { a: 'Z', b: 'X', y: 'C' }], ['タッチ', 'touch', { a: '', b: '', y: '' }]];
      rows.forEach(([n, kind, lab], i) => {
        const y = 214 + i * 32;
        U.text(g, n, x3, y - 7, { size: 10.5, color: C.text3, track: 2 });
        let bx = x3 + 76;
        for (const [b, l] of [['a', '決定'], ['b', '戻る'], ['y', 'メニュー']]) {
          const w = U.glyph(g, b, bx + 7, y, { size: 12, kind, label: lab[b] });
          U.text(g, l, bx + w + 5, y - 6.5, { size: 12, color: C.text });
          bx += w + 5 + U.measure(l, { size: 12 }) + 16;
        }
        U.glyph(g, 'l', bx + 7, y, { size: 12, kind, label: kind === 'kb' ? 'Q' : 'L' });
      });
      // --- 動き
      head(g, '動き（ms）', x3, 322, 340);
      const ms = [['カーソル移動', T.ms.cursor], ['フォーカスの光', T.ms.focus], ['窓が開く（下から 8px＋フェード）', T.ms.open], ['窓が閉じる', T.ms.close], ['画面の切り替え', T.ms.screen], ['通知', T.ms.toast]];
      ms.forEach(([n, v], i) => {
        U.text(g, n, x3, 344 + i * 18, { size: 10.5, color: C.text2 });
        U.text(g, String(v), x3 + 340, 344 + i * 18, { size: 10.5, weight: 700, color: C.text, align: 'right' });
      });
      // --- 見本に無い部品（下の段）: 札・隊列・星・吹き出し・羊皮紙・顔の枠
      head(g, '札・吹き出し・羊皮紙の会話の札', x1, 422, 560);
      U.card(g, { x: x1, y: 442, w: 150, h: 46 }, { focused: true });
      U.portraitFrame(g, { x: x1 + 5, y: 446, w: 38, h: 38 }, 'hero_m_warrior', {});
      U.text(g, 'アルン', x1 + 52, 447, { size: 13, weight: 700 });
      U.tag(g, 'front', x1 + 110, 448, 10);
      U.gauge(g, { x: x1 + 52, y: 470, w: 88, h: 2 }, 120, 180, 'hp');
      U.gauge(g, { x: x1 + 52, y: 477, w: 88, h: 2 }, 20, 40, 'mp');
      U.bubble(g, x1 + 220, 468, [{ btn: 'a', label: '話す' }]);
      U.stars(g, 'rare', x1 + 190, 474, 11); U.stars(g, 'super', x1 + 206, 474, 11);
      U.paper(g, { x: 300, y: 442, w: 250, h: 50 });
      U.text(g, 'ロザンナ', 314, 449, { size: 12, weight: 700, color: C.inkName });
      U.text(g, '灯台の灯が消えてから', 314, 468, { size: 12, color: C.ink });
      U.diamond(g, 538, 482, 3.5, '#a8672a');
      U.prompts(g, [{ btn: 'a', label: '決定' }, { btn: 'b', label: '戻る' }], { x: 940, y: 498, align: 'right' });
      U.text(g, 'ルミナス・クロニクル　UI の部品（MODERN_UI §3）', 940, 516, { size: 10, color: C.text3, align: 'right' });
    },
  };
  R.Engine.clear();
  R.Engine.push(scene);
  U.toastOffset.tr = 432;
  U.toast('オートセーブ', { icon: 'save', anchor: 'bl', ms: 60000 });
  U.toast('薬草 を 手に入れた', { icon: 'chest', anchor: 'tr', ms: 60000 });
  return true;
}

async function main() {
  const out = path.resolve(arg('--out', path.join(V2, 'design', 'shots', 'uik')));
  const html = arg('--html', 'dev.html');
  fs.mkdirSync(out, { recursive: true });
  const S = await B.start();
  const files = [];
  let bad = 0;
  try {
    for (const sc of [null].concat(process.argv.includes('--scale') ? [+arg('--scale', 1.3)] : [])) {
      const P = await B.open(S, html + '?scene=uik_sheet');
      await P.page.evaluate(`(${sheetScene.toString()})(${sc || 0})`);
      await P.page.waitForTimeout(500);
      const f = path.join(out, sc ? `uik_sheet_${String(sc).replace('.', '')}.png` : 'uik_sheet.png');
      await B.shot(P.page, f);
      files.push(f);
      if (P.errors.length) { bad++; console.log(P.errors.join('\n')); }
      await P.close();
    }
    // 本物（上）と見本（下）を並べる
    if (fs.existsSync(KIT)) {
      const ctx = await S.browser.newContext({ viewport: { width: 1920, height: 2160 } });
      const p = await ctx.newPage();
      const img = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      await p.setContent(`<body style="margin:0;background:#000"><img src="${img(files[0])}" style="display:block;width:1920px;height:1080px"><img src="${img(KIT)}" style="display:block;width:1920px;height:1080px"></body>`);
      await p.waitForTimeout(200);
      const f = path.join(out, 'uik_sheet_vs_kit.png');
      await p.screenshot({ path: f });
      files.push(f);
      await ctx.close();
    }
  } finally { await B.stop(S); }
  for (const f of files) console.log('→ ' + path.relative(process.cwd(), f));
  if (bad) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
