#!/usr/bin/env node
// CAST の一覧表（V2_PLAN §4.4 の CAST の行）: dev.html で焼いて並べ、v2/design/shots/cast/*.png に書く。撮ったら必ず Read で見る。
//   node v2/tools/build.js && node v2/tools/test_cast_shots.js [--only field|battle|faces|party|lineup|perf] [--looks a,b]
//   field.png       30 人（主人公 10・仲間 20）× 4 方向（1:1）、field_x4.png は同じ物の ×4 の一部
//   field_npc.png   物語の人・名前のある町の人・町の人の型・動物 × 4 方向
//   battle_<wt>.png 戦闘の 15 ポーズ × 4 人（見本の 4 人）、系統ごと（5 枚）
//   battle_all.png  30 人の待機（系統は仲間の初めの武器）
//   faces.png       仮の顔 44 × 表情 5（枠 118 に R.Portrait.draw で）
//   lantern.png     先頭のランタンと演技 11 種
//   night.png       夜の地面に 4 人を並べた見本（MODERN_UI の見本の比べ）
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./lib/browser');
const OUT = path.join(B.V2, 'design', 'shots', 'cast');

function arg(n, d) { const i = process.argv.indexOf(n); return i < 0 ? d : process.argv[i + 1]; }

// ページの中で: 1 枚の大きな canvas に並べて dataURL を返す
function sheetInPage(o) {
  const R = window.RPG;
  const bg = o.bg || '#2a2c3c';
  const cv = document.createElement('canvas');
  cv.width = o.w; cv.height = o.h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = bg; g.fillRect(0, 0, o.w, o.h);
  const txt = (s, x, y, c, sz) => { g.fillStyle = c || '#c8c4d8'; g.font = `${sz || 11}px "Zen Maru Gothic", sans-serif`; g.fillText(s, x, y); };
  const K = o.k || 1;
  const put = (fr, x, y, flip) => {
    if (!fr) return;
    g.save(); g.translate(x, y); g.scale(K * (flip ? -1 : 1), K); g.drawImage(fr.c, -fr.ox, -fr.oy); g.restore();
  };
  const groundLine = (x, y, w) => { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, w, 1); };
  const COMP = R.DB.companions || {};
  const persons = Object.keys(R.DB.looks).filter((l) => /^hero_/.test(l)).concat(Object.keys(COMP));
  const wOf = (l) => { const c = COMP[l]; const it = c && c.startEquip && R.DB.items[c.startEquip.weapon1]; return (it && it.wtype) || 'sword'; };
  if (o.mode === 'field') {
    const looks = o.looks || persons;
    const cols = o.cols || 6, cw = 4 * 44 * K + 20, ch = 70 * K + 26;
    looks.forEach((l, i) => {
      const sh = R.Hd.now('hd:field:' + l, { scale: 1.15 });
      const x0 = (i % cols) * cw + 10, y0 = Math.floor(i / cols) * ch + 10;
      txt(l + (sh && sh.meta && sh.meta.placeholder ? '（仮）' : ''), x0, y0 + 11);
      ['s', 'e', 'n', 'w'].forEach((d, j) => {
        const fi = sh && sh.poses['stand_' + d];
        const flip = !(sh && sh.poses.stand_w) && d === 'w';
        put(fi && sh.frames[fi[0]], x0 + 22 * K + j * 44 * K, y0 + 16 + 60 * K, flip);
      });
      groundLine(x0, y0 + 16 + 60 * K, cw - 20);
    });
  } else if (o.mode === 'walk') {
    const looks = o.looks;
    looks.forEach((l, i) => {
      const sh = R.Hd.now('hd:field:' + l, { scale: 1.15, lantern: !!o.lantern });
      const y0 = i * (70 * K + 24) + 10;
      txt(l, 10, y0 + 12);
      let x = 10 + 24 * K;
      for (const p of o.poses) {
        const list = sh.poses[p] || [];
        list.forEach((fi) => { put(sh.frames[fi], x, y0 + 16 + 60 * K); x += 44 * K; });
        txt(p, x - 44 * K * list.length, y0 + 30 + 60 * K, '#8a88a0', 10);
        x += 10;
      }
    });
  } else if (o.mode === 'battle') {
    const looks = o.looks, poses = o.poses;
    const cw = 96 * K, ch = 100 * K;
    looks.forEach((l, r) => {
      const sh = R.Hd.now(`hd:btl:${l}:${o.wtype}`);
      txt(l + ' ' + o.wtype + (sh.meta.placeholder ? '（仮）' : '') + (sh.meta.weaponMismatch ? ' 武器=描かれた剣' : ''), 10, r * ch + 14);
      let x = 60;
      poses.forEach((p) => {
        const list = sh.poses[p] || [];
        const fi = list[Math.min(list.length - 1, o.frameAt === 'last' ? list.length - 1 : Math.floor(list.length / 2))];
        put(sh.frames[fi], x + cw / 2, r * ch + ch - 10);
        groundLine(x, r * ch + ch - 10, cw - 6);
        if (r === 0) txt(p, x + 4, ch * looks.length + 14, '#8a88a0', 11);
        x += cw;
      });
    });
  } else if (o.mode === 'strip') {
    // 1 つのポーズの全コマ（つなぎの確かめ）
    const sh = R.Hd.now(`hd:btl:${o.look}:${o.wtype}`);
    let y = 10;
    for (const p of o.poses) {
      const list = sh.poses[p] || [];
      txt(p, 10, y + 14);
      list.forEach((fi, j) => { put(sh.frames[fi], 90 + j * 90 * K + 45 * K, y + 90 * K); });
      y += 95 * K;
    }
  } else if (o.mode === 'battleAll') {
    const cols = 10, cw = 90 * K, ch = 96 * K;
    persons.forEach((l, i) => {
      const wt = /^hero_/.test(l) ? 'sword' : wOf(l);
      const sh = R.Hd.now(`hd:btl:${l}:${wt}`);
      const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch;
      put(sh.frames[sh.poses.idle[0]], x0 + cw / 2, y0 + ch - 14);
      txt(l, x0 + 4, y0 + ch - 2, '#8a88a0', 10);
    });
  } else if (o.mode === 'faces') {
    const looks = Object.keys(R.DB.looks).filter((l) => R.Hd.has('hd:face:' + l));
    const E = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
    const cols = 4, fw = 118, cw = fw * 5 + 30, ch = fw + 24;
    looks.forEach((l, i) => {
      const x0 = (i % cols) * cw + 10, y0 = Math.floor(i / cols) * ch + 8;
      txt(l, x0, y0 + 11);
      E.forEach((e, j) => {
        const rect = { x: x0 + j * (fw + 4), y: y0 + 16, w: fw, h: fw };
        g.fillStyle = '#1a1c2c'; g.fillRect(rect.x, rect.y, rect.w, rect.h);
        R.Portrait.draw(g, l, rect, { expr: e });
      });
    });
  } else if (o.mode === 'night') {
    // 夜の地面に 4 人（見本と同じ並び）
    const grd = g.createRadialGradient(o.w * 0.45, o.h * 0.62, 10, o.w * 0.45, o.h * 0.62, o.w * 0.5);
    grd.addColorStop(0, '#5a4630'); grd.addColorStop(0.4, '#2a2632'); grd.addColorStop(1, '#10121e');
    g.fillStyle = grd; g.fillRect(0, 0, o.w, o.h);
    const lineup = o.looks;
    const pos = [[0.62, 0.52], [0.66, 0.66], [0.74, 0.5], [0.78, 0.66]];
    lineup.forEach((l, i) => {
      const sh = R.Hd.now(`hd:btl:${l}:${o.wtypes[i]}`);
      const [px, py] = pos[i];
      g.fillStyle = 'rgba(8,8,20,0.4)'; g.beginPath(); g.ellipse(o.w * px, o.h * py, 20 * K, 5 * K, 0, 0, 7); g.fill();
      put(sh.frames[sh.poses[o.pose || 'idle'][0]], o.w * px, o.h * py);
    });
    const fsh = R.Hd.now('hd:field:' + lineup[0], { scale: 1.15, lantern: true });
    put(fsh.frames[fsh.poses.stand_s[0]], o.w * 0.2, o.h * 0.6);
    lineup.slice(1).forEach((l, i) => { const s2 = R.Hd.now('hd:field:' + l, { scale: 1.15 }); put(s2.frames[s2.poses.stand_s[0]], o.w * (0.26 + i * 0.06), o.h * 0.6); });
  }
  return cv.toDataURL('image/png');
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = arg('--only', null);
  const S = await B.start();
  const files = [];
  try {
    const P = await B.open(S, 'dev.html');
    await B.waitFor(P.page, 'window.RPG && RPG.Engine && RPG.Engine.time > 200', 20000);
    const save = async (name, o) => {
      const url = await P.page.evaluate(`(${sheetInPage})(${JSON.stringify(o)})`);
      const f = path.join(OUT, name);
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      files.push(path.relative(path.join(B.V2, '..'), f));
      console.log('wrote', f);
    };
    const LINE = ['hero_m_warrior', 'selma', 'sylvain', 'viola'];
    const POSES = ['idle', 'step', 'windup', 'slash', 'thrust', 'smash', 'shoot', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory', 'evade'];
    if (!only || only === 'field') {
      await save('field.png', { mode: 'field', w: 1900, h: 780, k: 1, cols: 6 });
      await save('field_x4.png', { mode: 'field', w: 1900, h: 900, k: 4, cols: 2, looks: ['hero_m_warrior', 'selma', 'sylvain', 'viola', 'teo', 'dokka'] });
      const npcs = ['berna', 'rowell', 'fine', 'otto', 'elm', 'npc_hanna', 'npc_rita', 'npc_gord', 'npc_pim_mother', 'npc_pim', 'npc_hans', 'npc_ben', 'npc_roy', 'npc_yura_elder',
        'npc_man_1', 'npc_woman_2', 'npc_old_m_1', 'npc_old_f_3', 'npc_child_2', 'npc_sailor_1', 'npc_merchant_1', 'npc_woodcutter_2', 'npc_guard_1', 'npc_keeper_1', 'npc_bard_1', 'npc_yura_folk_1',
        'ani_cat', 'ani_dog', 'ani_hen', 'ani_fawn'];
      await save('field_npc.png', { mode: 'field', w: 1900, h: 780, k: 1, cols: 6, looks: npcs });
      await save('lantern.png', { mode: 'walk', w: 1900, h: 760, k: 2, lantern: true, looks: ['hero_m_warrior', 'selma', 'viola'], poses: ['walk_s', 'walk_e', 'walk_n', 'walk_w'] });
      await save('acting.png', { mode: 'walk', w: 1900, h: 560, k: 2, looks: ['hero_m_warrior', 'npc_gord'], poses: ['nod', 'shake', 'surprise', 'laugh', 'sad', 'bow', 'kneel', 'sit', 'think', 'point', 'raise_lantern'] });
    }
    if (!only || only === 'battle') {
      for (const wt of ['sword', 'greatsword', 'dagger', 'bow', 'staff']) await save(`battle_${wt}.png`, { mode: 'battle', w: 1920, h: 440, k: 1, looks: LINE, poses: POSES, wtype: wt });
      await save('battle_x2.png', { mode: 'battle', w: 1920, h: 880, k: 2, looks: ['hero_m_warrior', 'selma', 'sylvain', 'viola'], poses: ['idle', 'slash', 'smash', 'shoot', 'cast', 'hit', 'weak', 'victory', 'ko'], wtype: 'sword' });
      await save('battle_strip_arun.png', { mode: 'strip', w: 900, h: 1500, k: 1, look: 'hero_m_warrior', wtype: 'sword', poses: POSES });
      await save('battle_strip_selma.png', { mode: 'strip', w: 900, h: 1500, k: 1, look: 'selma', wtype: 'sword', poses: POSES });
      await save('battle_all.png', { mode: 'battleAll', w: 1800, h: 580, k: 2 });
    }
    if (!only || only === 'faces') await save('faces.png', { mode: 'faces', w: 2560, h: 1580 });
    if (!only || only === 'night') {
      await save('night.png', { mode: 'night', w: 960, h: 540, k: 1, looks: LINE, wtypes: ['sword', 'sword', 'bow', 'staff'] });
      await save('night_x2.png', { mode: 'night', w: 1920, h: 1080, k: 2, looks: LINE, wtypes: ['sword', 'sword', 'bow', 'staff'] });
    }
    if (P.errors.length) { console.log('page errors:\n  ' + P.errors.join('\n  ')); process.exitCode = 1; }
    await P.close();
  } finally { await B.stop(S); }
  return files;
}
if (require.main === module) run().catch((e) => { console.error(e); process.exit(1); });
module.exports = { run, sheetInPage };
