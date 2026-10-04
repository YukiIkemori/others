// 装備の画面の「いまの装備と比べる」（詳しい所 dp）で字が重ならないことのテスト（持ち主 2026-10-04:
//   星鉄の兜を付けて探偵の帽子を選ぶと、守備・術防の行に何かが重なって読めない → 4:3 の画面で「前の値」が名前に重なっていた）。
//   node v2/tools/build.js && node v2/tools/test_equip_compare_browser.js [--shots <dir>]
//   いくつもの大きさ × 言語（ja・en）× 効き目や説明の多い品で、詳しい所に描いた字の箱（UIK.text の幅 × 字の高さ）と区切りの線を集め、
//   ・字の箱どうしが重ならない ・字が詳しい所の外へはみ出さない ・区切りの線が字を横切らない ことを確かめる。候補の時と枠の時の両方。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const shotDir = args.includes('--shots') ? path.resolve(args[args.indexOf('--shots') + 1]) : null;
const SIZES = [['1920x1080', { size: [1920, 1080] }], ['1280x720', { size: [1280, 720] }], ['1024x768', { size: [1024, 768] }], ['720x540', { size: [720, 540] }], ['phone', { phone: true }], ['844x390', { size: [844, 390] }]];
const LANGS = ['ja', 'en'];

// ページの中: 品 ids を順に候補に出して描き、詳しい所の字の箱を調べる → 問題の行の一覧
const PROBE = `(() => {
  const R = RPG, v = R.Engine.top().view, U = R.UIK, D = R.DB.items, out = [], seen = [];
  const want = ['u_sleuth_hat', 'u_apology_bell'];
  // 効き目（mods）の数と説明の長さで多い物を足す（枠の組ごとに 2 つ）
  const score = (it) => Object.keys(it.mods || {}).length * 40 + String(it.desc || '').length;
  for (const grp of ['head', 'acc', 'body', 'hands', 'feet', 'shield', 'weapon']) {
    Object.keys(D).filter((id) => D[id] && D[id].slot === grp && !want.includes(id)).sort((a, b) => score(D[b]) - score(D[a])).slice(0, 2).forEach((id) => want.push(id));
  }
  let rec = null;
  const t0 = U.text, r0 = U.rule;
  U.text = function (g, s, x, y, o) {
    const w = t0.apply(this, arguments);
    if (rec) { o = o || {}; const sz = o.size || 14, al = o.align || 'left'; rec.push({ s: String(s), x: al === 'right' ? x - w : al === 'center' ? x - w / 2 : x, y, w, h: sz }); }
    return w;
  };
  U.rule = function (g, x0, x1, y) { if (rec) rec.push({ s: '<rule>', x: x0, y: y - 0.5, w: x1 - x0, h: 1, rule: true }); return r0.apply(this, arguments); };
  const g = document.createElement('canvas').getContext('2d');
  const c = v.char();
  const slotOf = (it) => (it.slot === 'acc' ? 'acc1' : it.slot === 'weapon' ? 'weapon1' : it.slot);
  const check = (label) => {
    rec = []; v.draw(g); const boxes = rec; rec = null;
    const dp = v._dp; if (!dp) return;
    const inb = boxes.filter((b) => b.x >= dp.x - 1 && b.x < dp.x + dp.w && b.y >= dp.y - 1 && b.y < dp.y + dp.h);
    const bad = [];
    for (const b of inb) if (!b.rule && (b.y + b.h > dp.y + dp.h + 1 || b.x + b.w > dp.x + dp.w + 1)) bad.push('outside:' + b.s);
    for (let i = 0; i < inb.length; i++) for (let j = i + 1; j < inb.length; j++) {
      const p = inb[i], q = inb[j];
      if (p.rule && q.rule) continue;
      const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x), oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (ox > 1 && oy > (p.rule || q.rule ? 0 : 1)) bad.push(JSON.stringify(p.s) + ' x ' + JSON.stringify(q.s));
    }
    if (bad.length) out.push(label + ': ' + bad.slice(0, 3).join(' | '));
  };
  try {
    for (const id of want) {
      const it = D[id]; if (!it) continue;
      const s = slotOf(it);
      if (!R.Rules.canEquip(c, id, s)) continue;
      seen.push(id);
      if (s === 'head') R.State.gain('hd_helm_8', 1), (c.equip.head = 'hd_helm_8');   // 持ち主の場面: 星鉄の兜を付けている
      v.mode = 'slot'; v.slist.focusIndex(v.slots.indexOf(s));
      const cur = c.equip[s];
      v.clist.setRows([cur ? { value: cur, label: '', cur: true } : null, { value: id, label: '' }, { value: null, label: '' }].filter(Boolean), false);
      v.clist.focusIndex(cur ? 1 : 0); v.mode = 'cand';
      check('cand ' + id);
      // 枠の時（付けている品の値の 2 列）
      const keep = c.equip[s]; c.equip[s] = id; v.mode = 'slot'; check('slot ' + id); c.equip[s] = keep;
    }
  } finally { U.text = t0; U.rule = r0; }
  return { out, seen };
})()`;

(async () => {
  const S = await B.start();
  try {
    for (const lang of LANGS) {
      section('lang ' + lang);
      for (const [name, o] of SIZES) {
        const P = await B.open(S, 'dev.html?scene=menus_equip&lang=' + lang, o);
        await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='screen:equip'", 15000);
        await P.page.waitForTimeout(300);
        const r = await P.page.evaluate(PROBE);
        ok(`${lang} ${name}: compare panel has no overlapping text (${r.seen.length} items)`, r.seen.length >= 6 && r.out.length === 0, r.out.slice(0, 4));
        if (shotDir && lang === 'ja') {
          await P.page.evaluate(`(() => { const R = RPG, v = R.Engine.top().view, c = v.char(); R.State.gain('hd_helm_8', 1); R.State.gain('u_sleuth_hat', 1); c.equip.head = 'hd_helm_8';
            v.mode = 'slot'; v.slist.focusIndex(v.slots.indexOf('head')); v.openSlot('head'); v.clist.focusIndex(v.clist.rows.findIndex((x) => x.value === 'u_sleuth_hat')); })()`);
          await P.page.waitForTimeout(400);
          await B.shot(P.page, path.join(shotDir, `equip_cmp_${name}.png`));
        }
        ok(`${lang} ${name}: no console errors`, P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
    }
  } finally { await B.stop(S); }
  done('test_equip_compare_browser');
})();
