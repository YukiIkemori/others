#!/usr/bin/env node
// QA: 縦切りの画面の一覧を撮る（V2_PLAN §2.9・§3.16 の 12、§3.11 の全画面）。
//
//   node v2/tools/qa/shots_slice.js [--sizes wide,phone,land] [--only name,…] [--build]
//
// 1920×1080（wide）とスマホ縦 390×844 DPR 3（phone）、町・ワールド・ダンジョン・戦闘はスマホ横 844×390（land）も。dist/dev.html の
// フィクスチャ（?fixture= 状態・?scene= 場面）を開き、場面が落ち着いてから撮る。タイトルだけは遊ぶ用の index.html。
// 出力: v2/design/shots/slice/<名前>_<大きさ>.png、一覧の v2/design/shots/slice/index.html と index.json
// （撮った時のコンソールのエラー・R.Stubs.report()・一番上の場面）。撮った PNG は必ず Read で見る（§2.9）。
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('../lib/browser');

const V2 = path.resolve(__dirname, '..', '..');
const OUT = path.join(V2, 'design', 'shots', 'slice');
const D = 'RPG.Battle.debug()';
const FIELD = "RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02 && !RPG.Field._s.entering";
const IN = `${D} && ${D}.ui && ${D}.phase==='input'`;
const TOP = (id) => `RPG.Engine.top() && RPG.Engine.top().id==='${id}'`;
const LAND = ['wide', 'phone', 'land'];
// [名前, 分類, 開くページ, 手順, 大きさ]。手順: {until, ms} {wait} {keys} {eval}
const SHOTS = [
  // タイトル・作成
  ['title', 'タイトル', 'index.html', [{ until: TOP('screen:title'), ms: 20000 }, { wait: 1800 }]],
  ['title_continue', 'タイトル（つづきから）', 'dev.html?scene=menus_title', [{ until: TOP('screen:title') }, { wait: 1400 }]],
  ['charcreate', '主人公の作成', 'dev.html?scene=menus_charcreate', [{ until: TOP('screen:charcreate') }, { wait: 900 }]],
  ['nameentry', '名前の入力', 'dev.html?scene=menus_nameentry', [{ until: TOP('screen:nameentry') }, { wait: 900 }]],
  ['partyselect', '仲間選び', 'dev.html?scene=menus_partySelect', [{ until: TOP('screen:partySelect') }, { wait: 900 }]],
  // フィールド
  ['roa', 'ロアの里（町）', 'dev.html?fixture=content_p_roa', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['pharos', 'ファロス（町）', 'dev.html?fixture=content_p_pharos', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['pharos_harbor', 'ファロスの港', 'dev.html?fixture=content_p_pharos_harbor', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['pharos_tavern', '潮風亭（屋内）', 'dev.html?fixture=content_p_pharos_tavern', [{ until: FIELD, ms: 15000 }, { wait: 1200 }]],
  ['world', 'ワールド', 'dev.html?fixture=content_p_world_pharos', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['world_forest', 'ワールド（森）', 'dev.html?fixture=content_p_world_forest', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['lighthouse', 'ファロス灯台（ダンジョン）', 'dev.html?fixture=content_p_lighthouse_2', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['fern', 'フェルン（町）', 'dev.html?fixture=content_f_fern_plaza', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['fern_deck', 'フェルンの樹上', 'dev.html?fixture=content_f_fern_deck', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['verda', '迷いの森', 'dev.html?fixture=content_f_verda_1', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['verda_dark', '迷いの森（暗がり）', 'dev.html?fixture=content_f_verda_2_dark', [{ until: FIELD, ms: 15000 }, { wait: 1500 }], LAND],
  ['elder', '千年樹', 'dev.html?fixture=content_f_elder_2', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['well', '旅人の古井戸（洞窟）', 'dev.html?fixture=content_p_well', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['yura', '隠れ里ユラ', 'dev.html?fixture=content_f_yura', [{ until: FIELD, ms: 15000 }, { wait: 1500 }]],
  ['notify', '通知（宝箱・隠し通路・泉）', 'dev.html?fixture=content_p_lighthouse_2', [{ until: FIELD, ms: 15000 }, { eval: "RPG.Field.hud.toast('傷薬 ×2 を手に入れた', {icon:'chest'}); RPG.Field.hud.toast('隠し通路を見つけた！', {icon:'secret'})" }, { wait: 700 }]],
  // 会話・手紙
  ['talk', '会話（記録院のロウェル）', 'dev.html?fixture=content_p_pharos_record', [{ until: FIELD, ms: 15000 }, { eval: "RPG.Events.run('pharos_rowell', {map:'pharos_record', npc:'rowell'})" }, { until: "RPG.UIK.Message.busy()", ms: 8000 }, { wait: 300 }, { keys: ['a'] }, { wait: 1800 }]],
  ['talk_choice', '会話（選択肢）', 'dev.html?fixture=content_p_roa_house', [{ until: FIELD, ms: 15000 }, { eval: "RPG.Events.run('roa_lectern', {map:'roa_house'})" }, { until: "RPG.UIK.Message.busy()", ms: 8000 }, { keys: ['a', 'a', 'a', 'a', 'a'] }, { wait: 1500 }]],
  ['letter', '手紙', 'dev.html?scene=menus_letter', [{ until: TOP('screen:letter') }, { wait: 900 }]],
  // メニュー
  ['hub', 'メインメニュー', 'dev.html?scene=menus_menu', [{ until: TOP('screen:menu') }, { wait: 900 }]],
  ['items', '道具', 'dev.html?scene=menus_items', [{ until: TOP('screen:items') }, { wait: 900 }]],
  ['skills', '技・術', 'dev.html?scene=menus_skills', [{ until: TOP('screen:skills') }, { wait: 900 }]],
  ['equip', '装備', 'dev.html?scene=menus_equip', [{ until: TOP('screen:equip') }, { wait: 900 }]],
  ['status', '強さ', 'dev.html?scene=menus_status', [{ until: TOP('screen:status') }, { wait: 900 }]],
  ['order', '並びと隊列', 'dev.html?scene=menus_order', [{ until: TOP('screen:order') }, { wait: 900 }]],
  ['bestiary', '図鑑', 'dev.html?scene=menus_bestiary', [{ until: TOP('screen:bestiary') }, { wait: 900 }]],
  ['chronicle', '年代記・手がかり帳', 'dev.html?scene=menus_chronicle', [{ until: TOP('screen:chronicle') }, { wait: 900 }]],
  ['chronicle_leads', '手がかり帳（タブ）', 'dev.html?scene=menus_chronicle', [{ until: TOP('screen:chronicle') },
    { eval: "for (const id of ['l_main_rumors','l_rumor_forest','l_rumor_snow','l_rumor_desert','l_forest_board','l_forest_pim','l_forest_woodcutters','l_forest_song','q_fern_letters','q_forest_fireflies','l_opt_hut']) RPG.Leads.add(id); RPG.Leads.pin('l_forest_pim')" },
    { wait: 800 }, { keys: ['r'] }, { wait: 1000 }]],
  ['chronicle_book', '年代記（章の文）', 'dev.html?fixture=content_f_fern_plaza', [{ until: FIELD, ms: 15000 },
    { eval: "const G = RPG.Game; G.flags.prologue_done = true; G.cleared.r_forest = true; G.flags.cleared_r_forest = true; G.choices.ch_forest_pim = 'take'; G.choices.ch_forest_fawn = 'heal'; G.choices.ch_forest_write = 'pain'; RPG.ContentP.ev.chapter('prologue'); RPG.ContentP.ev.chapter('r_forest'); RPG.Screens.open('chronicle')" },
    { until: TOP('screen:chronicle') }, { wait: 1200 }]],
  ['map', '地図', 'dev.html?scene=menus_map', [{ until: TOP('screen:map') }, { wait: 1400 }]],
  ['save', 'セーブ', 'dev.html?scene=menus_save', [{ until: TOP('screen:save') }, { wait: 900 }]],
  ['load', 'ロード', 'dev.html?scene=menus_load', [{ until: TOP('screen:load') }, { wait: 900 }]],
  ['settings', '設定', 'dev.html?scene=menus_settings', [{ until: TOP('screen:settings') }, { wait: 900 }]],
  ['shop', '店', 'dev.html?scene=menus_shop', [{ until: TOP('screen:shop') }, { wait: 900 }]],
  ['inn', '宿', 'dev.html?scene=menus_inn', [{ until: TOP('screen:inn') }, { wait: 900 }]],
  ['tavern', '酒場', 'dev.html?scene=menus_tavern', [{ until: TOP('screen:tavern') }, { wait: 900 }]],
  ['detail', '詳しい表示', 'dev.html?scene=menus_detail', [{ until: TOP('screen:detail') }, { wait: 900 }]],
  ['tip', '初めての説明の札', 'dev.html?scene=menus_tip', [{ until: TOP('screen:tip') }, { wait: 900 }]],
  ['warp', 'ワープの一覧', 'dev.html?scene=menus_warp', [{ until: TOP('screen:warp') }, { wait: 900 }]],
  ['passphrase', '冒険の合言葉', 'dev.html?scene=menus_passphrase', [{ until: TOP('screen:passphrase') }, { wait: 900 }]],
  // 歌あわせ・地方の解決
  ['song', '歌あわせ', 'dev.html?fixture=content_f_fern_rita', [{ until: FIELD, ms: 15000 }, { eval: "window.__song = RPG.Mini.sequence({title:'歌あわせ', rounds:3, seed:'qa'})" }, { until: "RPG.Mini.state() && RPG.Mini.state().phase==='play' && RPG.Mini.state().lit >= 0", ms: 6000 }, { wait: 200 }]],
  ['clear', '地方の解決（大灯火）', 'dev.html?fixture=content_f_fern_plaza', [{ until: FIELD, ms: 15000 }, { eval: "RPG.Events.run ? (RPG.DB.events.__qa_clear = {run: async (ev) => { await ev.clearRegion('r_forest'); }}, RPG.Events.run('__qa_clear', {map:'fern'})) : null" }, { until: "RPG.Engine.has('celebrate') && RPG.Engine.fade.a < 0.05", ms: 10000 }, { wait: 1200 }]],
  ['clear_card', '地方の解決（章の札）', 'dev.html?fixture=content_f_fern_plaza', [{ until: FIELD, ms: 15000 }, { eval: "RPG.DB.events.__qa_clear = {run: async (ev) => { await ev.clearRegion('r_forest'); }}; RPG.Events.run('__qa_clear', {map:'fern'})" }, { until: "RPG.Engine.has('celebrate') && RPG.Engine.fade.a < 0.05", ms: 10000 }, { wait: 3200 }]],
  // 戦闘（本物の出現表・ボス）
  ['battle', '戦闘（迷いの森の雑魚）', 'dev.html?scene=battle_zone_verda', [{ until: IN, ms: 15000 }, { wait: 500 }], LAND],
  ['battle_command', '戦闘（行動の一覧）', 'dev.html?scene=battle_zone_verda', [{ until: IN, ms: 15000 }, { keys: ['a'] }, { wait: 500 }]],
  ['battle_techs', '戦闘（技の一覧）', 'dev.html?scene=battle_zone_verda', [{ until: IN, ms: 15000 }, { keys: ['a', 'a'] }, { wait: 500 }]],
  ['boss_pageeater', 'ボス ページ食らい', 'dev.html?scene=battle_b_pageeater', [{ until: IN, ms: 15000 }, { wait: 500 }], LAND],
  ['boss_wolflord', '中ボス 狼の群れ頭', 'dev.html?scene=battle_b_wolflord', [{ until: IN, ms: 15000 }, { wait: 500 }]],
  ['boss_moth', 'ボス ダストウィング', 'dev.html?scene=battle_b_moth', [{ until: IN, ms: 15000 }, { wait: 500 }]],
  ['boss_rooteater', 'ボス 根食らい', 'dev.html?scene=battle_b_rooteater', [{ until: IN, ms: 15000 }, { wait: 500 }], LAND],
  ['battle_real', '戦闘（本物の一行）', 'dev.html?scene=bscene_real', [{ until: IN, ms: 15000 }, { wait: 500 }]],
  // 戦闘の見本（BSCENE の demo 台本: 閃き・術・予告・盗み・勝利・全滅の瞬間を決まった形で出す）
  ['glimmer', '閃きの瞬間', 'dev.html?scene=bscene_glimmer', [{ until: `${D} && ${D}.banner && ${D}.pops.some((p)=>p.kind==='crit')`, ms: 15000 }, { wait: 120 }]],
  ['spell', '術の詠唱', 'dev.html?scene=bscene_spell', [{ until: `${D} && ${D}.fxs.some((f)=>f.id==='cast' && ${D}.clock - f.t0 > 180)`, ms: 15000 }]],
  ['tele', 'ボスの予告', 'dev.html?scene=bscene_tele', [{ until: `${D} && ${D}.tele && RPG.Engine.time - ${D}.tele.t0 > 400`, ms: 15000 }]],
  ['steal', 'レアを盗んだ', 'dev.html?scene=bscene_steal', [{ until: `${D} && ${D}.card && RPG.Engine.time - ${D}.card.t0 > 400`, ms: 15000 }]],
  ['victory', '勝利と報酬', 'dev.html?scene=bscene_victory', [{ until: `${D} && ${D}.result && RPG.Engine.time - ${D}.result.t0 > 1100`, ms: 15000 }]],
  ['wipe', '全滅（3 つの選択）', 'dev.html?scene=bscene_wipe', [{ until: `${D} && ${D}.go && ${D}.ui`, ms: 15000 }, { wait: 500 }]],
];
const SIZES = { wide: { size: [1920, 1080] }, phone: { phone: true }, land: { land: true } };

async function openPage(S, page, o) {
  if (!o.land) return B.open(S, page, o);
  const ctx = await S.browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e)));
  await p.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(S.base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue(); errors.push('[outside] ' + u); return route.abort(); });
  await p.goto(S.base + page);
  await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 20000 });
  await p.waitForTimeout(300);
  return { ctx, page: p, errors, close: () => ctx.close() };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  if (argv.includes('--build')) require('child_process').execFileSync('node', [path.join(V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const sizes = arg('--sizes', 'wide,phone,land').split(',');
  const only = arg('--only', null);
  fs.mkdirSync(OUT, { recursive: true });
  const S = await B.start();
  const idxFile = path.join(OUT, 'index.json');
  const prev = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : { shots: [] };
  const keep = new Map(prev.shots.map((s) => [s.file, s]));
  let bad = 0, n = 0;
  for (const [name, label, page, steps, szs] of SHOTS) {
    if (only && !only.split(',').includes(name)) continue;
    for (const sz of (szs || ['wide', 'phone']).filter((s) => sizes.includes(s))) {
      const file = `${name}_${sz}.png`;
      const rec = { name, label, size: sz, file, page, ok: true, errors: [], stubs: [], top: null };
      let P = null;
      try {
        P = await openPage(S, page, SIZES[sz]);
        for (const s of steps) {
          if (s.eval) await P.page.evaluate('(() => { ' + s.eval + '; })()');   // Promise を待たない（歌あわせ・イベントは終わらない）
          if (s.until) { const r = await B.waitFor(P.page, s.until, s.ms || 8000); if (!r) { rec.ok = false; rec.errors.push('timeout: ' + s.until.slice(0, 80)); break; } }
          if (s.wait) await P.page.waitForTimeout(s.wait);
          if (s.keys) for (const k of s.keys) { await B.press(P.page, k); await P.page.waitForTimeout(180); }
        }
        await B.shot(P.page, path.join(OUT, file));
        const info = await P.page.evaluate(() => ({ top: (RPG.Engine.top() || {}).id, stubs: RPG.Stubs.report(), err: RPG.Engine.error ? RPG.Engine.error.msg.slice(0, 200) : null, loadErrors: RPG.loadErrors.length }));
        rec.top = info.top; rec.stubs = info.stubs;
        if (info.err) rec.errors.push('engine: ' + info.err);
        if (info.loadErrors) rec.errors.push('loadErrors ' + info.loadErrors);
        rec.errors.push(...P.errors.slice(0, 5));
      } catch (e) { rec.ok = false; rec.errors.push(String(e).slice(0, 300)); }
      finally { if (P) await P.close(); }
      if (rec.errors.length) rec.ok = false;
      if (!rec.ok) bad++;
      n++;
      keep.set(file, rec);
      console.log(`${rec.ok ? 'ok  ' : 'FAIL'} ${file}${rec.errors.length ? '  ' + rec.errors.join(' | ').slice(0, 200) : ''}`);
    }
  }
  await B.stop(S);
  const shots = SHOTS.flatMap(([name, , , , szs]) => (szs || ['wide', 'phone']).map((sz) => keep.get(`${name}_${sz}.png`)).filter(Boolean));
  fs.writeFileSync(idxFile, JSON.stringify({ date: new Date().toISOString(), shots }, null, 1));
  fs.writeFileSync(path.join(OUT, 'index.html'), html(shots));
  console.log(`\nshots_slice: ${n - bad}/${n} ok → ${path.relative(process.cwd(), path.join(OUT, 'index.html'))}`);
  if (bad) process.exitCode = 1;
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function html(shots) {
  const groups = new Map();
  for (const s of shots) { if (!groups.has(s.name)) groups.set(s.name, []); groups.get(s.name).push(s); }
  const rows = [...groups.values()].map((g) => `<section><h2>${esc(g[0].label)} <small>${esc(g[0].name)}</small></h2><div class="row">${g.map((s) =>
    `<figure class="${s.size}${s.ok ? '' : ' bad'}"><a href="${esc(s.file)}"><img loading="lazy" src="${esc(s.file)}" alt="${esc(s.label)} ${s.size}"></a><figcaption>${s.size}${s.ok ? '' : ' — ' + esc(s.errors.join(' / ').slice(0, 160))}</figcaption></figure>`).join('')}</div></section>`).join('\n');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>縦切りの画面の一覧</title>
<style>:root{--bg:#10121a;--fg:#e8e4da;--mut:#9a96a8;--bad:#e0605a}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}small{color:var(--mut);font-weight:400}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0}figure img{display:block;border:1px solid #333;border-radius:4px}.wide img{width:480px}.phone img{width:130px}.land img{width:282px}
figcaption{color:var(--mut);font-size:12px}.bad figcaption{color:var(--bad)}@media (max-width:600px){.wide img{width:100%}}</style></head>
<body><h1>縦切りの画面の一覧（§3.11）</h1><p>${shots.length} 枚・${new Date().toISOString().slice(0, 16).replace('T', ' ')}・1920×1080 / スマホ縦 390×844 / スマホ横 844×390。失敗 ${shots.filter((s) => !s.ok).length}</p>
${rows}</body></html>\n`;
}
module.exports = { SHOTS };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
