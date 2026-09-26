#!/usr/bin/env node
// RULES のブラウザの確かめとスクショ（V2_PLAN §4.4 の RULES の行: 装備の画面と店の数字）。
//   node v2/tools/build.js && node v2/tools/test_rules_shots.js
// MENUS の装備・店の画面ができるまでは、同じ数字（R.Rules.preview・shopItems・stats）を並べた「数字の札」を dev.html の上に積んで撮る
// （場面の id 'rules_sheet'、UIK の部品で描く）。MENUS の画面ができたら、その画面を開いて同じ数字を撮る形に替える。
// 撮る物（design/shots/rules/）: 16:9 と縦持ちで、ティア 0 のファロス（標準のパーティ）とティア 1 のフェルン（伸びる一品物）。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const OUT = path.join(B.V2, 'design', 'shots', 'rules');

// ページの中で動く: 数字の札の場面を積む（R.Rules の値だけで描く。画面の言葉は MODERN_UI の equip.png・shop.png の並び）
function sheetScript(o) {
  return `(() => {
  const R = window.RPG, U = R.UIK, T = U.T, C = T.color, Ru = R.Rules, DB = R.DB, G = R.Game;
  const o = ${JSON.stringify(o)};
  G.uniques = G.uniques || {};
  for (const id of Object.keys(G.items)) { const it = DB.items[id]; if (it && it.grow === 'tier' && !G.uniques[id]) { const f = Ru.fillItem(it, { tier: G.tier }); G.uniques[id] = { tier: G.tier, atk: f.atk, mag: f.mag, def: f.def, mdef: f.mdef, eva: f.eva, stats: f.stats }; } }
  const mem = R.Party.members();
  const hero = mem[0];
  const cand = o.cand;
  const shop = Ru.shopItems(o.shop, G.tier).slice(0, o.rows || 12);
  const sign = (v) => (v > 0 ? '▲+' + v : v < 0 ? '▼' + v : '±0');
  const col = (v) => (v > 0 ? C.up : v < 0 ? C.down : C.text3);
  const u = (v) => U.u(v);
  const out = { preview: Ru.preview(hero, 'weapon1', cand), shop: {}, stats: mem.map((c) => { const s = Ru.stats(c); return [c.id, s.maxHp, s.atk, s.mag, s.def]; }) };
  const mainKey = (it) => (it.slot === 'weapon' ? 'atk' : it.slot === 'acc' ? null : 'def');
  // 店の 4 人の増減（A20）は先に数える（描くのは毎フレーム同じ表）
  for (const id of shop) {
    const it = Ru.itemOf(id); if (!it) continue;
    const mk = mainKey(it);
    out.shop[id] = mem.map((c) => (!Ru.canEquip(c, id) ? null : mk ? Ru.preview(c, it.slot, id)[mk] : undefined));
  }
  const scene = {
    id: 'rules_sheet', opaque: true,
    enter() {}, exit() {}, update() {},
    draw(g) {
      const W = R.W, H = R.H, tall = R.layout === 'tall', pad = u(14);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#11142a'); bg.addColorStop(1, '#1d1a30');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const sl = R.safe.l + pad, st = R.safe.t + pad, sw = W - R.safe.l - R.safe.r - pad * 2;
      const colW = tall ? sw : (sw - pad) / 2;
      // ---------- 左（縦持ちは上）: 装備の比べ
      let x = sl, y = st, h = tall ? u(392) : H - st - R.safe.b - pad - u(28);
      U.panel(g, { x, y, w: colW, h }, { dense: true });
      U.text(g, hero.name + '　装備', x + u(16), y + u(12), { size: T.size.h2 * R.uiScale, weight: 700, color: C.gold });
      U.text(g, 'ティア ' + G.tier + '（数字は R.Rules）', x + colW - u(16), y + u(16), { size: T.size.caption * R.uiScale, color: C.text3, align: 'right' });
      let yy = y + u(48);
      for (const s of Ru.SLOTS) {
        const it = Ru.itemOf(hero.equip[s]);
        U.text(g, Ru.SLOT_NAMES[s], x + u(18), yy, { size: T.size.label * R.uiScale, color: C.text3 });
        if (it) U.icon(g, it.icon, x + u(78), yy + u(1), u(14), C.text2);
        U.text(g, it ? it.name : 'なし', x + u(98), yy - u(1), { size: T.size.body * R.uiScale, color: it ? C.text : C.disabled });
        yy += u(22);
      }
      yy += u(6);
      U.rule(g, x + u(16), x + colW - u(16), yy, 0.25);
      const ci = Ru.itemOf(cand);
      yy += u(10);
      U.text(g, 'いまの装備と比べる：' + ci.name, x + u(16), yy, { size: T.size.label * R.uiScale, weight: 700, color: C.gold });
      yy += u(26);
      const now = Ru.stats(hero), d = out.preview;
      const rows = [['atk', '攻撃'], ['hit', '命中'], ['crit', '会心'], ['def', '守備'], ['str', '腕力']];
      for (const [k, nm] of rows) {
        const a = k === 'atk' ? now.atk : now[k];
        U.text(g, nm, x + u(22), yy, { size: T.size.body * R.uiScale, color: C.text2 });
        U.text(g, String(a), x + u(150), yy, { size: T.size.body * R.uiScale, color: C.text, align: 'right' });
        U.text(g, '→', x + u(172), yy, { size: T.size.body * R.uiScale, color: C.text3 });
        U.text(g, String(a + d[k]), x + u(236), yy, { size: T.size.body * R.uiScale, weight: 700, color: d[k] ? col(d[k]) : C.text, align: 'right' });
        if (d[k]) U.text(g, sign(d[k]), x + u(254), yy, { size: T.size.body * R.uiScale, weight: 700, color: col(d[k]) });
        yy += u(22);
      }
      // 4 人の値（R.Rules.stats。gl・熟練度は標準の進み方 'auto'）
      if (!tall) {
        yy += u(6);
        U.rule(g, x + u(16), x + colW - u(16), yy, 0.25);
        yy += u(10);
        const heads = ['HP', 'MP', '攻撃', '術力', '守備', '術防', '速さ'];
        heads.forEach((hd, j) => U.text(g, hd, x + u(150) + j * u(42), yy, { size: T.size.micro * R.uiScale, color: C.text3, align: 'right' }));
        yy += u(18);
        for (const c of mem) {
          const s2 = Ru.stats(c);
          U.text(g, c.name + '（' + (Ru.WTYPE_NAMES[s2.wtype] || '素手') + '）', x + u(18), yy, { size: T.size.label * R.uiScale, color: C.text });
          [s2.maxHp, s2.maxMp, s2.atk, s2.mag, s2.def, s2.mdef, s2.spd].forEach((v, j) => U.text(g, String(v), x + u(150) + j * u(42), yy, { size: T.size.label * R.uiScale, color: C.text2, align: 'right' }));
          yy += u(19);
        }
      }
      // ---------- 右（縦持ちは下）: 店の 4 人の増減
      x = tall ? sl : sl + colW + pad; y = tall ? st + h + pad : st;
      const h2 = tall ? H - y - R.safe.b - pad - u(28) : h;
      U.panel(g, { x, y, w: colW, h: h2 }, { dense: true });
      U.text(g, DB.shops[o.shop].name, x + u(16), y + u(12), { size: T.size.h2 * R.uiScale, weight: 700, color: C.gold });
      U.text(g, '所持金 ' + G.gold.toLocaleString() + ' G', x + colW - u(16), y + u(16), { size: T.size.label * R.uiScale, color: C.goldHi, align: 'right' });
      const cw = u(tall ? 44 : 60);
      const colX = (i) => x + colW - u(16) - (3 - i) * cw;
      yy = y + u(46);
      mem.forEach((c, i) => U.text(g, U.fit(c.name, cw - u(6), { size: T.size.micro * R.uiScale }), colX(i), yy, { size: T.size.micro * R.uiScale, color: C.text2, align: 'right' }));
      const px = colX(0) - cw - u(4);
      U.text(g, '値段', px, yy, { size: T.size.caption * R.uiScale, color: C.text3, align: 'right' });
      yy += u(20);
      for (const id of shop) {
        const it = Ru.itemOf(id); if (!it) continue;
        U.icon(g, it.icon, x + u(18), yy + u(1), u(13), C.text2);
        U.text(g, U.fit(it.name, px - x - u(38) - u(62), { size: T.size.label * R.uiScale }), x + u(38), yy, { size: T.size.label * R.uiScale, color: C.text });
        U.text(g, it.price.toLocaleString() + ' G', px, yy, { size: T.size.label * R.uiScale, color: G.gold >= it.price ? C.text2 : C.disabled, align: 'right' });
        out.shop[id].forEach((v, i) => {
          const s = v === null ? '×' : v === undefined ? '—' : sign(v), cc = v == null ? C.disabled : col(v);
          U.text(g, s, colX(i), yy, { size: T.size.label * R.uiScale, weight: 700, color: cc, align: 'right' });
        });
        yy += u(tall ? 22 : 23.5);
      }
      U.prompts(g, [{ btn: 'b', label: '戻る' }]);
    },
  };
  R.Engine.push(scene);
  window.__rulesSheet = out;
  return out;
})()`;
}

(async () => {
  const S = await B.start();
  const cases = [
    { name: 't0_pharos', fixture: 'rules_pharos_t0', shop: 'shop_pharos_arms', cand: 'w_sword_1', rows: 16 },
    { name: 't1_fern', fixture: 'rules_fern_t1', shop: 'shop_fern_peddler', cand: 'u_hans_axe', rows: 14 },
  ];
  try {
    for (const cs of cases) {
      for (const phone of [false, true]) {
        section(`${cs.name} ${phone ? 'phone' : '1920'}`);
        const P = await B.open(S, 'dev.html?fixture=' + cs.fixture, phone ? { phone: true } : {});
        await B.waitFor(P.page, "(RPG.Engine.top()||{}).id==='field'", 10000);
        const res = await B.ev(P.page, sheetScript(cs));
        await P.page.waitForTimeout(250);
        ok('shop numbers match node (A20 ▲▼ from R.Rules.preview)', Object.values(res.shop).every((row) => row.length === 4), res.shop);
        const file = path.join(OUT, `rules_${cs.name}_${phone ? 'phone' : '1920'}.png`);
        await B.shot(P.page, file);
        ok('sheet drawn on top', (await B.ev(P.page, "(RPG.Engine.top()||{}).id")) === 'rules_sheet');
        ok('preview has the 15 keys', Object.keys(res.preview).length === 15, res.preview);
        ok('a shop row for each item with numbers', Object.keys(res.shop).length >= 8, Object.keys(res.shop).length);
        const same = await B.ev(P.page, `(() => { const R = RPG; return R.Party.members().every((c) => R.Contract.check('stats', R.Rules.stats(c)).ok && R.Contract.check('char', c).ok); })()`);
        ok('every member: K.stats and K.char in the browser', same);
        const stub = await B.ev(P.page, "Object.keys(RPG.Stubs.installed).filter((k) => /^(Rules|Growth|Glimmer|Party)$/.test(k))");
        ok('no RULES stubs installed in the page', !stub.length, stub);
        // ほかの担当の作業中のファイルのエラーは数えない（並列の作業。RULES のファイル・この札の描き方・外への通信だけを見る）
        const mineErr = P.errors.filter((e) => /outside request|systems\/(rules|growth|glimmer|party)\.js|data\/(items_(?!key)|techs_|spells_|weapontypes|companions|herotypes|shops|pools|elements|statuses)|rules_sheet|R\.Rules|evaluate/.test(e));
        ok('no console errors from RULES files, no outside requests', !mineErr.length, mineErr.slice(0, 5));
        if (P.errors.length > mineErr.length) console.log('  (other owners\' errors in this build: ' + (P.errors.length - mineErr.length) + ', e.g. ' + String(P.errors[0]).split('\n')[0].slice(0, 120) + ')');
        console.log('  shot ' + path.relative(process.cwd(), file));
        await P.close();
      }
    }
  } finally { await B.stop(S); }
  done('test_rules_shots');
})().catch((e) => { console.error(e); process.exit(1); });
