// 「次にやること」の収まりのブラウザのテスト（持ち主 2026-10-11）: メニューの上の 1 行とフィールドの L の札に、全部の文が入るか（5 言語・横 16:9・縦持ちの手元）。
//   node v2/tools/build.js && node v2/tools/test_goals_browser.js [--out <dir>] [--shots | --only-shots]
//   ・UIK.fitSize を横取りして、各言語の全部の文（序章の段・地方の一歩・寄り道）を 1 つずつ出し、「…」で切られた物・縮められた物を数える
//     （切られた文は 0。縮めた文は 0.85 倍まで許すが、数を出す）
//   ・--shots: 序章のはじめ・地方の途中・終盤の 3 か所を ja / en で、メニューの上の 1 行と L の札を撮る（<out>/goals_<点>_<言語>_menu|card.png）
//   使う状態は R.Game を直接書き換える（フィクスチャ menus_party の上で）。撮った画像は必ず見る
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(B.V2, 'design', 'shots', 'goals');
const SHOTS = args.includes('--shots') || args.includes('--only-shots');
const ONLY_SHOTS = args.includes('--only-shots');
const TOP = B.TOP;
const LANGS = ['ja', 'en', 'ko', 'zh-Hans', 'zh-Hant'];

// 撮る 3 か所（状態は test_goals.js の歩きと同じ旗）
const POINTS = {
  start: { label: 'prologue start', flags: {}, leads: [], vars: {}, items: {}, expect: 'g_berna' },
  mid: { label: 'mid-region (isles: filling the chart)', flags: { prologue_done: true, cleared_r_forest: true, story_t1: true, isles_arrived: true, isles_drake_met: true, isles_ship: true, isles_chart_got: true }, leads: ['l_main_rumors', 'l_rumor_isles', 'l_isles_chart'], vars: { isles_chart: 2 }, items: {}, expect: 'isles:chart', tier: 1 },
  finale: { label: 'finale (3rd-floor seal)', flags: { prologue_done: true, story_t8: true, final_roa: true, final_open: true, final_arrived: true, final_archive_seen: true, final_golem: true }, leads: ['l_main_rumors', 'l_main_final_archive'], vars: {}, items: {}, expect: 'finale:seal', tier: 8 },
};
const SET = `(P) => { const R = RPG, G = R.Game;
  R.DB.config.slice = false;   // dev.html は体験版の錠が掛かっている。製品版（deploy --full）と同じにして、地方・終盤の道しるべを出す
  G.flags = Object.assign({}, P.flags); G.vars = Object.assign({}, P.vars); G.items = Object.assign({}, P.items); G.leads = {}; G.tier = P.tier || 0; G.pendingTier = null; G.pos.map = 'pharos'; G.lastTown = null;
  for (const l of P.leads) R.Leads.add(l, { silent: true });
  R.Leads.unpin(); return R.Leads.goal(); }`;

(async () => {
  const S = await B.start();
  try {
    // 全部の文（序章の段の文 + 地方の一歩 + 寄り道）を言語ごとに集める
    for (const phone of ONLY_SHOTS ? [] : [false, true]) {
      section(phone ? '縦持ち（390×844）の収まり' : '横 16:9（1920×1080）の収まり');
      for (const lang of LANGS) {
        const P = await B.open(S, `dev.html?fixture=menus_party&lang=${lang}`, { phone });
        const p = P.page;
        ok(`${lang}: field opens`, await B.waitFor(p, `${TOP}==='field'`, 15000));
        await p.waitForTimeout(2800);
        await B.ev(p, `(() => { window.__fit = []; window.__watch = null; const f = RPG.UIK.fitSize; RPG.UIK.fitSize = function (s, w, o) { const r = f.call(this, s, w, o); if (window.__watch && String(s).indexOf(window.__watch) === 0) window.__fit.push({ w, size: r.size, req: (o && o.size) || 0, cut: r.s !== s }); return r; }; return 1; })()`);
        const texts = await B.ev(p, `(() => { const out = []; const rows = RPG.DB.goals; for (const id of Object.keys(rows)) { const t = rows[id].text; for (const x of (Array.isArray(t) ? t.map((y) => y.text) : [t])) out.push([id, x.replace(/\\{flags:\\{[A-Za-z]+\\}\\}/g, '0').replace(/\\{(flags|var):[^}]*\\}/g, '0')]); }
          for (const sid of Object.keys(RPG.DB.goalstories)) for (const st of RPG.DB.goalstories[sid].steps || []) out.push([sid + ':' + st.id, st.text.replace(/\\{flags:\\{[A-Za-z]+\\}\\}/g, '0').replace(/\\{(flags|var):[^}]*\\}/g, '0')]); return out; })()`);
        // メニューの上の 1 行
        await B.press(p, 'y');
        ok(`${lang}: menu opens`, await B.waitFor(p, `${TOP}==='screen:menu'`, 4000));
        await p.waitForTimeout(500);
        const menuRes = [];
        for (const [id, t] of texts) {
          await B.ev(p, `(() => { RPG.Leads.goal = () => ({ id: 'x', text: ${JSON.stringify(t)}, lead: null }); window.__fit = []; window.__watch = ${JSON.stringify(t.slice(0, 6))}; return 1; })()`);
          await p.waitForTimeout(110);
          const r = await B.ev(p, 'window.__fit.slice(-1)[0] || null');
          menuRes.push([id, t, r]);
        }
        await B.press(p, 'b');
        await B.waitFor(p, `${TOP}==='field'`, 3000);
        // L の札
        const cardRes = [];
        for (const [id, t] of texts) {
          await B.ev(p, `(() => { RPG.Leads.goal = () => ({ id: 'x', text: ${JSON.stringify(t)}, lead: null }); window.__fit = []; window.__watch = ${JSON.stringify(t.slice(0, 6))}; RPG.Field.hud.showGoal(900); return 1; })()`);
          await p.waitForTimeout(110);
          const r = await B.ev(p, 'window.__fit.slice(-1)[0] || null');
          cardRes.push([id, t, r]);
        }
        const rep = (name, arr) => {
          const miss = arr.filter(([, , r]) => !r).length;
          const cut = arr.filter(([, , r]) => r && r.cut);
          const shrunk = arr.filter(([, , r]) => r && !r.cut && r.size < r.req - 0.01);
          ok(`${lang} ${name}: no line is cut with 「…」 (${arr.length} lines, ${shrunk.length} shrunk to fit)`, cut.length === 0 && miss === 0, { cut: cut.map(([id, t]) => id + ' ' + t), miss });
          if (shrunk.length) console.log('      shrunk: ' + shrunk.map(([id, , r]) => id + '(' + Math.round(r.size / r.req * 100) + '%)').join(' '));
          if (cut.length) console.log('      cut: ' + cut.map(([id]) => id).join(' '));
        };
        rep('menu bar', menuRes);
        rep('L card', cardRes);
        ok(`${lang}: no console errors`, P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
    }

    if (SHOTS) {
      section('撮影（ja / en × 3 か所 × メニュー・L の札）');
      for (const lang of ['ja', 'en']) {
        const P = await B.open(S, `dev.html?fixture=menus_party&lang=${lang}`);
        const p = P.page;
        await B.waitFor(p, `${TOP}==='field'`, 15000);
        await p.waitForTimeout(2800);
        for (const [key, pt] of Object.entries(POINTS)) {
          const g = await B.ev(p, `(${SET})(${JSON.stringify(pt)})`);
          ok(`${lang} ${key}: the real goal is ${pt.expect}`, g && g.id === pt.expect, g);
          await p.waitForTimeout(600);
          await B.press(p, 'l');
          await p.waitForTimeout(700);
          await B.shot(p, path.join(OUT, `goals_${key}_${lang}_card.png`));
          await p.waitForTimeout(4200);
          await B.press(p, 'y');
          await B.waitFor(p, `${TOP}==='screen:menu'`, 4000);
          await p.waitForTimeout(600);
          await B.shot(p, path.join(OUT, `goals_${key}_${lang}_menu.png`));
          await B.press(p, 'b');
          await B.waitFor(p, `${TOP}==='field'`, 3000);
          await p.waitForTimeout(300);
        }
        ok(`${lang}: no console errors`, P.errors.length === 0, P.errors.slice(0, 3));
        await P.close();
      }
    }
  } finally { await B.stop(S); }
  done('test_goals_browser');
})().catch((e) => { console.error(e); process.exit(1); });
