#!/usr/bin/env node
// 後頭部の肌の検査（RENDER、ART_REWORK §2.3-6、STYLE_REFERENCE §9）。CAST が使う。
//
//   node v2/tools/hd_check_hair.js [--only <部分文字列>] [--max 0.08]
//
// hd:btl:* と hd:field:* の全コマで、頭の後ろ半分（顔の前の縁より後ろ・頭頂から顎まで）の画素のうち肌の色が 8% 以下であること。
// 読む物（CAST の Sheet に書いてもらう。無いキーは「skip」と出す）:
//   sheet.meta.skin   肌の色の一覧 ['#rrggbb'…]（無ければ skip。原画のシートは髪と肌がパレットを共有するので出さない）
//   anchors.head      頭の中心（描く点からの相対 [x, y] か {x, y}。コマごとの frame.anchors が先）
//   sheet.meta.headR  頭の半径（art px。無ければコマの高さ × 0.2）
//   向き: 戦闘は右向き（meta.facing があればそれ）、フィールドは stand_/walk_/run_ のポーズの向き（_w・_e は後ろ半分、_n は全部が後頭部、_s と演技は調べない）
'use strict';
const B = require('./lib/browser');

function args(argv) {
  const o = { only: null, max: 0.08 };
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--only') o.only = argv[++i]; else if (argv[i] === '--max') o.max = +argv[++i]; }
  return o;
}

function inspect(o) {
  const R = window.RPG, Hd = R.Hd;
  const keys = Hd.keys('hd:btl:').concat(Hd.keys('hd:field:')).filter((k) => !o.only || k.indexOf(o.only) >= 0);
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h)); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const pt = (a) => (a == null ? null : Array.isArray(a) ? { x: a[0], y: a[1] } : { x: a.x, y: a.y });
  const out = [];
  for (const key of keys) {
    const look = key.split(':')[2];
    const r = { key, frames: 0, worst: 0, skip: null };
    let sh = null;
    try { sh = Hd.now(key); } catch (e) { r.skip = 'bake threw'; out.push(r); continue; }
    if (!sh) { r.skip = 'no sheet'; out.push(r); continue; }

    // meta.skin だけを見る（原画は髪と肌が同じ共通パレットの色を使うので meta.skin を出さない → skip。CAST の依頼）
    let skin = sh.meta && sh.meta.skin;
    if (typeof skin === 'string') skin = [skin];
    skin = (skin || []).map(hex).filter(Boolean);
    if (!skin.length) { r.skip = 'no meta.skin'; out.push(r); continue; }
    const kindField = key.startsWith('hd:field:');
    const poseOf = {};
    for (const [p, list] of Object.entries(sh.poses || {})) for (const i of list) if (poseOf[i] == null) poseOf[i] = p;
    sh.frames.forEach((f, i) => {
      if (!f || !f.c) return;
      const head = pt((f.anchors && f.anchors.head) || (sh.anchors && sh.anchors.head));
      if (!head) { r.skip = r.skip || 'no anchors.head'; return; }
      const pose = poseOf[i] || '';
      let face = (sh.meta && sh.meta.facing === 'left') ? -1 : 1, all = false;
      // 向きはフィールドの立ち・歩き・走りのポーズだけ（演技 shake・bow・raise_lantern… は南向きなので数えない。CAST の依頼）
      if (kindField) {
        const m = /^(stand|walk|run)_(?:.*_)?(n|s|e|w|up|down|left|right)$/.exec(pose);
        if (!m) return;
        const d = m[2];
        if (d === 'n' || d === 'up') all = true; else if (d === 'w' || d === 'left') face = -1; else if (d === 'e' || d === 'right') face = 1; else return;
      }
      const hr = (sh.meta && sh.meta.headR) || f.c.height * 0.2;
      const cx = f.ox + head.x, cy = f.oy + head.y;
      const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data;
      let n = 0, s = 0;
      for (let y = Math.max(0, Math.floor(cy - hr)); y < Math.min(f.c.height, Math.ceil(cy + hr)); y++) for (let x = Math.max(0, Math.floor(cx - hr)); x < Math.min(f.c.width, Math.ceil(cx + hr)); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > hr * hr) continue;
        if (!all && dx * face > -hr * 0.1) continue;       // 後ろ半分だけ
        const q = (y * f.c.width + x) * 4;
        if (d[q + 3] < 128) continue;
        n++;
        if (skin.some((c) => Math.abs(c[0] - d[q]) + Math.abs(c[1] - d[q + 1]) + Math.abs(c[2] - d[q + 2]) < 40)) s++;
      }
      if (n > 8) { r.frames++; r.worst = Math.max(r.worst, s / n); }
    });
    out.push(r);
  }
  return out;
}

if (require.main === module) {
  (async () => {
    const o = args(process.argv.slice(2));
    const S = await B.start();
    let res, errors;
    try { const P = await B.open(S, 'dev.html'); res = await P.page.evaluate(`(${inspect})(${JSON.stringify(o)})`); errors = P.errors; await P.close(); } finally { await B.stop(S); }
    let fail = 0, skip = 0;
    for (const r of res) {
      if (r.skip && !r.frames) { skip++; console.log(`skip  ${r.key}  (${r.skip})`); continue; }
      const bad = r.worst > o.max;
      if (bad) fail++;
      console.log(`${bad ? 'FAIL' : 'ok  '}  ${r.key.padEnd(34)} back-of-head skin ${(r.worst * 100).toFixed(1)}% over ${r.frames} frames`);
    }
    console.log(`\nhd_check_hair: ${res.length} keys, ${fail} failed, ${skip} skipped (max ${o.max * 100}%)`);
    if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
    if (fail || errors.length) process.exitCode = 1;
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { inspect };
