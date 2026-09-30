#!/usr/bin/env node
// オルビス高原（star_*.js・field_star_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・潜入・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_star.js
//   1 形: マップ・イベント・手がかり・編成・店・場所が契約どおり、参照がそろう。高原のエリア・町・学院・塔は 1 枚の下絵（絵のファイルがあり、大きさがマップと同じ）。
//        地方 r_star は作った（dungeons・ボス・光の柱・章の要約）が、体験版の錠 slice:'locked' は残す（持ち主の決まり）
//   2 置き場所: 泉は置かない（学院も塔も外から 2 階までの短いダンジョン。check_springs の決まり）、宝箱は床の上、隠し通路なし（A27）、戸口は 1 マス、街灯（lamp_post・snow_lamp）を置かない、
//              エリアの宝箱は 1 エリアに 2 つまで、下絵の町・ダンジョンの物は働く物だけ、見回りの道は歩けるマス
//   3 文: ボイスは声の担当の一覧の id だけ（天球の番人 1 本を 1 回）・仲間 20 人の名前を出さない（A36）・録音済みの文を 1 字も変えずに置く。フィーネは出ない
//   4 筋: 閉包で clearRegion('r_star') に着く（命令書 2 通り・年代記 2 通り・寄り道と依頼なし）。縦切りのあいだは高原へ行けない（前のワールドの街道の端）。
//        潜入の準備は 2 つで入れる（鍵・見回り・制服）、見つかる = 外へ（取った物はそのまま）／押し通る = 騒ぎ。見回りの視線（E10）。
//        黒板 3 枚で文字盤が開く。こっそり＋黙る = 学者の長衣・星図の写し。騒ぎ = 学長が退く・割引なし。天球儀の輪で格子が入れ替わる。解決でティア +1・ページ
//   5 戦闘: ボスの予告、出現表の数（1 組 5 匹まで）、盗み専用の品はイベントで渡さない
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => D.maps[id].region === 'r_star');
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^star_/.test(f));
const SRC = i18nInline(EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /star_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n'));
const PAINTED = ['orbis', 'star_academy_1', 'star_academy_2', 'star_tower_1', 'star_tower_top', 's_steps', 's_plateau', 's_crater', 's_ridge'];

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`高原のマップ ${MY_MAPS.length} 枚（エリア 4・町 1・屋内 16・学院 2・塔 2）`, MY_MAPS.length >= 25, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(`高原のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 70 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('高原のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['world'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) {
      if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
      if (n.watch && !D.events[n.watch.event]) miss.push(`${id} watch ${n.id} → ${n.watch.event}`);
    }
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
    const tos = (m.exits || []).map((e) => e.to).concat((m.objects || []).map((o) => o.to || (o.door && o.door.to)).filter(Boolean));
    for (const to of tos) if (!D.maps[to.map] || !(D.maps[to.map].spawns || {})[to.spawn]) miss.push(`${id} → ${to.map}:${to.spawn}`);
  }
  ok('マップの人・物・範囲・見張りのイベントと行き先（マップ・spawn）がすべてある', miss.length === 0, miss);
  const lost = [];
  const ADHOC = new Set(['sentinel', 'octavia_obs']);   // 声だけの話し手（番人・ctx の人）
  for (const m of SRC.matchAll(/ev\.(?:appear|leave|say)\(\[?'([a-z0-9_]+)'/g)) if (!ADHOC.has(m[1]) && !MY_MAPS.some((id) => (D.maps[id].npcs || []).some((n) => n.id === m[1]))) lost.push(m[1]);
  ok('話す人・appear・leave する人がマップにいる', lost.length === 0, [...new Set(lost)]);
  const warps = [...SRC.matchAll(/ev\.warp\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)].filter((m) => !(D.maps[m[1]] && D.maps[m[1]].spawns[m[2]])).map((m) => m[1] + ':' + m[2]);
  ok('ev.warp の行き先がある', warps.length === 0, warps);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_star');
ok(`高原の手がかり ${leads.length} 件（地方・依頼・うわさ）`, leads.length >= 14, leads.length);
ok('手がかりが K.lead', leads.every(([, l]) => R.Contract.check('lead', l).ok), leads.filter(([, l]) => !R.Contract.check('lead', l).ok).map(([id]) => id));
ok('編成（天球の番人・星食らい・学院の騒ぎ 3）', ['tr_b_orrery', 'tr_b_stareater', 'tr_star_riot_1', 'tr_star_riot_2', 'tr_star_riot_3'].every((t) => D.troops[t] && R.Contract.check('troop', D.troops[t]).ok));
ok('場所 orbis・academy・startower・starfall', ['orbis', 'academy', 'startower', 'starfall'].every((id) => D.locations[id] && D.locations[id].region === 'r_star' && D.maps[D.locations[id].map] && D.maps[D.locations[id].map].spawns[D.locations[id].spawn]));
ok('店 3 つ（道具屋・武具屋・学院の術具店）と品がそろう', ['shop_orbis_items', 'shop_orbis_arms', 'shop_orbis_magic'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok &&
  [...D.shops[id].items, ...Object.values(D.shops[id].tier || {}).flat()].every((it) => D.items[it])));
{
  const g = D.regions.r_star;
  ok('地方 r_star: 体験版の錠（slice:locked）は残し、ダンジョン・光の柱・ボス・章の要約がある', g.slice === 'locked' && (g.dungeons || []).length === 2 && !!g.beaconAt && D.maps[g.beaconAt.map] && g.bossTroop === 'tr_b_stareater' && !!g.chapter.summary);
}
ok('年代記の章 r_star（E14）', !!(D.chronicle && D.chronicle.r_star && R.Contract.check('chronicleEntry', D.chronicle.r_star).ok));
ok('読み物 lo_ev_star・lo_time_star（必）・lo_war_star', ['lo_ev_star', 'lo_time_star', 'lo_war_star'].every((id) => D.lore[id]) && D.lore.lo_ev_star.must && D.lore.lo_time_star.must && !D.lore.lo_war_star.must);
ok('大事な物・一品物（星図・命令書・鍵のメモ・日誌・制服・星図の写し・星のかけら・星灯の油・羽ペン・恋文・長衣・羅針・飾りひも・片眼鏡・星のページ）',
  ['k_star_chart', 'k_seal_order', 'k_vault_code', 'k_patrol_log', 'k_uniform', 'k_star_chart_copy', 'k_star_shard', 'k_star_oil', 'k_silver_pen', 'k_love_letter', 'u_scholar_robe', 'u_star_compass', 'u_exam_ribbon', 'ac_tale_star', 'k_page_star'].every((id) => D.items[id]));
{
  const miss = [];
  for (const id of PAINTED) {
    const a = D.maps[id].art;
    if (!a || !a.image) { miss.push(id + ' no art'); continue; }
    const [theme, , name] = a.image.split('/');
    for (const f of [`${name}@32.png`, `${name}@24.png`, `${name}.json`]) if (!fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', f))) miss.push(`${id} ${f}`);
    if (miss.length) continue;
    const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', theme, 'under', name + '.json'), 'utf8'));
    if (j.size32[0] !== D.maps[id].w * 32 || j.size32[1] !== D.maps[id].h * 32) miss.push(`${id} size ${j.size32}`);
  }
  ok(`高原のエリア・町・学院・塔 ${PAINTED.length} 枚は 1 枚の下絵（絵とメタがあり、大きさがマップと同じ）`, miss.length === 0, miss);
  const set = ['waylamp__star', 'signboard__star', 'lantern__star', 'board__star'].filter((id) => !fs.existsSync(path.join(V2, 'assets', 'env', 'star', 'props', id + '@32.png')));
  ok('高原の小道具の組 star（星灯の道しるべ・石の看板・星のランタン・掲示板）', set.length === 0, set);
  ok('エリアは小道具の組 star を使う', MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => D.maps[id].propSet === 'star'));
}

// ================================================================ 2
section('2. 置き場所（泉・宝箱・戸口・灯り・見回り）');
{
  const springs = (id) => (D.maps[id].objects || []).filter((o) => o.type === 'spring').length;
  ok('泉: 学院・塔（短いダンジョン）には置かない', ['star_academy_1', 'star_academy_2', 'star_tower_1', 'star_tower_top'].every((id) => springs(id) === 0));
  const secret = MY_MAPS.filter((id) => Object.values(D.maps[id].legend).some((l) => l.secret) && R.MapUtil.grid(D.maps[id]).some((r) => [...r].some((c) => D.maps[id].legend[c] && D.maps[id].legend[c].secret)));
  ok('隠し通路なし', secret.length === 0, secret);
  ok('エリアの宝箱は 1 エリアに 2 つまで', MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').length <= 2));
  const bad = [];
  for (const id of MY_MAPS) {
    const m = D.maps[id];
    const walk = (x, y) => { const c = R.MapUtil.cell(m, x, y); return c && !c.solid && c.walk !== false; };
    for (const o of (m.objects || []).filter((q) => q.type === 'chest' || q.type === 'spring')) {
      const cells = o.type === 'spring' ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
      if (cells.some(([dx, dy]) => !walk(o.x + dx, o.y + dy))) bad.push(`${id} ${o.id} not on floor`);
    }
    for (const n of m.npcs || []) {
      if (!walk(n.x, n.y)) bad.push(`${id} npc ${n.id} on solid`);
      for (const p of (n.move && n.move.route) || []) if (!walk(p[0], p[1])) bad.push(`${id} ${n.id} route ${p}`);
    }
  }
  ok('宝箱・泉・人・見回りの道は床の上', bad.length === 0, bad);
  const wide = [];
  for (const id of MY_MAPS) for (const o of D.maps[id].objects || []) if (o.type === 'building' && o.door && (o.door.w || 1) !== 1) wide.push(id + ':' + o.id);
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'interior')) for (const e of D.maps[id].exits || []) if (e.w !== 1 || e.h !== 1) wide.push(id);
  ok('戸口は 1 マス（町の建物と屋内の出口）', wide.length === 0, wide);
  const street = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'prop' && /^(lamp_post|snow_lamp|lamp_pillar|wisp_lamp)$/.test(o.id)).map((o) => id + ':' + o.x + ',' + o.y));
  ok('ほかの地方の灯（街灯・港の灯・鬼火）を置かない（高原の灯は星灯 star_lamp）', street.length === 0, street);
  const deco = [];
  for (const id of PAINTED.filter((q) => D.maps[q].kind !== 'field')) for (const o of (D.maps[id].objects || []).filter((q) => q.type === 'prop')) if (!/^(star_lamp|star_glow|star_fire|iron_gate|lever|book_stack)$/.test(o.id)) deco.push(`${id} ${o.id}`);
  ok('下絵の町とダンジョンの物のスプライトは、働く物だけ（飾りは絵の中）', deco.length === 0, deco);
  const guards = ['star_academy_1', 'star_academy_2'].flatMap((id) => (D.maps[id].npcs || []).filter((n) => n.watch));
  ok(`見張り ${guards.length} 人（1 階 3＋学生 1・2 階 2）はランタンの視線（watch）と見回りの道`, guards.length === 6 && guards.filter((n) => n.move && n.move.route).length === 5);
  const zoneBad = ['star_academy_1', 'star_academy_2'].filter((id) => (D.maps[id].zones || []).some((z) => z.zone));
  ok('消灯後の学院は魔物が出ない', zoneBad.length === 0, zoneBad);
}

// ================================================================ 3
section('3. 文（声・A36・録音の文・フィーネ）');
{
  const ids = [...SRC.matchAll(/'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const csv = fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
  ok(`高原のイベントのボイスは天球の番人 v_sentinel_star_01 の 1 本を 1 回`, JSON.stringify(ids) === JSON.stringify(['v_sentinel_star_01']) && csv.includes('v_sentinel_star_01'), ids);
  const row = csv.split(/\r?\n/).find((l) => l.startsWith('v_sentinel_star_01,'));
  const flat = SRC.replace(/\\n/g, '');
  ok('録音済みの文（天球の番人）を 1 字も変えずに置く', !!row && flat.includes(row.split(',')[7]), row && row.split(',')[7]);
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を高原の文に出さない（A36）`, hits.length === 0, hits);
  ok('フィーネは星の地方に出ない（STORY_BIBLE §6.2）', !/v_fine_|'fine'/.test(SRC) && !/npc_fine|look: 'fine'/.test(MAP_SRC));
}

// ================================================================ 4
section('4. 筋（閉包・準備・潜入・見回り・命令書・塔・解決）');
{
  const P = require('./qa/progress');
  P.init(R);
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const [order, write, restricted] of [['public', 'pain', false], ['silent', 'story', false], ['silent', 'pain', true]]) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_star_order: order, ch_star_write: write, ch_star_way: 'sneak' }, restricted });
    ok(`命令書=${order} 年代記=${write}${restricted ? '（寄り道・依頼なし）' : ''}: clearRegion('r_star')`, !!(r.flags.cleared_r_star && r.flags.star_finale_done && r.flags.star_stareater), { ready: !!r.flags.star_ready, chart: !!r.flags.star_chart_got, cleared: !!r.flags.cleared_r_star });
  }
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  // 縦切りの止めは data/demo_gate.js の通せんぼ（gate.demo）: 閉包は gate を見ないので、ワールドの出口の形で確かめる
  ok('縦切りのあいだ（slice）は高原へ行けない（ワールドの出口は体験版では消え、同じ所の写しは通せんぼ）', (() => {
    R.State.newGame({ seed: 1 });
    const ex = (D.maps.world.exits || []).filter((e) => e.to && e.to.map === 's_steps');
    const live = ex.filter((e) => !e.cond || R.State.check(e.cond));
    return ex.length >= 1 && live.length >= 1 && live.every((e) => e.gate && e.gate.demo && R.State.check(e.gate.when)) && R.DemoGate.at('world', 476, 145) === 's_steps';
  })());
  const w = D.maps.world;
  const ex = (w.exits || []).find((e) => e.to && e.to.map === 's_steps');
  ok('前のワールドの北の街道の東の端に、星見の坂への出口（cond {not:{slice:true}}）と戻りの spawn star_w', !!(ex && ex.cond && ex.cond.not && ex.cond.not.slice === true && w.spawns.star_w));
  ok('星見の坂の西の端から前のワールドへ戻れる', (D.maps.s_steps.exits || []).some((e) => e.to.map === 'world' && e.to.spawn === 'star_w'));
}
function fakeEv(opts) {
  const G = R.Game;
  const said = [];
  const choose = opts.choose || [];
  const battles = opts.battles || [];
  const ev = {
    ctx: opts.ctx || {},
    flag: (k) => !!G.flags[k], setFlag: (k, v) => { if (v === false) delete G.flags[k]; else G.flags[k] = v === undefined ? true : v; }, var: (k) => G.vars[k] || 0,
    setVar: (k, v) => { G.vars[k] = v; return v; }, addVar: (k, n) => { G.vars[k] = (G.vars[k] || 0) + (n == null ? 1 : n); return G.vars[k]; },
    has: (id) => (G.items[id] || 0) > 0, item: (id, n) => { G.items[id] = (G.items[id] || 0) + (n || 1); }, take: (id, n) => { G.items[id] = Math.max(0, (G.items[id] || 0) - (n || 1)); },
    gold: (n) => { G.gold = Math.max(0, (G.gold || 0) + (n || 0)); }, lead: () => {}, leadDone: () => {}, lore: (id) => { G.flags[id] = true; }, choice: (k, v) => { G.choices[k] = v; }, choiceOf: (k) => G.choices[k],
    say: async (who, t, o) => { said.push([who, t, o && o.voice]); }, caption: async (t) => { said.push(['caption', t]); }, choose: async (list) => { said.push(['choose', list]); const v = choose.shift(); return typeof v === 'function' ? v(list) : v == null ? 0 : v; },
    fade: async () => {}, wait: async () => {}, warp: async (m, s) => { said.push(['warp', m + ':' + s]); }, sfx: () => {}, bgm: () => {}, mapBgm: () => {}, jingle: () => {}, leave: async () => {}, appear: async () => {},
    call: async (id, args) => D.events[id].run(ev, Object.assign({}, args || {})), letter: async () => {}, rest: () => {}, inn: async () => true, shop: async () => {},
    battle: async (t) => { const r = battles.length ? battles.shift() : 'win'; said.push(['battle', t, r]); return r; }, clearRegion: async () => { G.flags.cleared_r_star = true; return 1; },
    mini: { sequence: async () => ({ rank: 'A' }), timing: async () => ({ hits: 3 }) },
  };
  return { ev, said };
}
const run = async (id, o, ctx) => { const f = fakeEv(o || {}); await D.events[id].run(f.ev, ctx || {}); return f; };
async function story() {
  R.State.newGame({ seed: 3 });
  const G = R.Game;
  G.gold = 2000;
  // 手がかり 3 つ（ルカ・門の番兵・司書）
  let f = await run('star_luca');
  ok('ルカ: 消える星と観測録（lo_time_star「日出、観測されず」）', G.flags.star_luca_met && G.flags.lo_time_star && f.said.some((s) => /日出、観測されず/.test(String(s[1]))));
  await run('orbis_district_guard');
  f = await run('star_librarian');
  ok('司書: 学長の貸し出し票「保管庫、三つの鍵、夜の見回り」', G.flags.star_message && f.said.some((s) => /保管庫、三つの鍵、夜の見回り/.test(String(s[1]))));
  // 準備 1 つでは入れない
  f = await run('star_academy_door');
  ok('準備が足りないうちは学院に入れない（足りない準備を教える）', !G.flags.star_night_seen && f.said.some((s) => s[0] === 'caption' && /学生たち/.test(String(s[1]))));
  // 鍵の三つの数: セレス（問答）・ミロ（羽ペン）・ティモ（恋文 → イーダ）
  await run('star_student_exam', { choose: [1, 0, 2] });
  await run('star_student_pen'); await run('star_pen_spot'); await run('star_student_pen');
  await run('star_student_letter'); await run('star_ida'); await run('star_student_letter');
  ok('学生 3 人から文字盤の数を 1 つずつ → 鍵の組み合わせのメモ', G.flags.star_key_1 && G.flags.star_key_2 && G.flags.star_key_3 && G.flags.star_prep_key && (G.items.k_vault_code || 0) > 0 && !G.flags.star_ready);
  // 見回り: 夜番の年寄りに一杯おごる
  f = await run('star_old_watch', { choose: [0] });
  ok('夜番の年寄りに一杯 → 日誌（見回りの順番）→ 準備 2 つで忍びこめる', G.flags.star_prep_route && (G.items.k_patrol_log || 0) > 0 && G.flags.star_ready);
  f = await run('star_academy_door', { choose: [0] });
  ok('消灯の刻を待って忍びこむ → 勝手口から 1 階へ', G.flags.star_night_seen && f.said.some((s) => s[0] === 'warp' && s[1] === 'star_academy_1:service'));
  // 見つかった: 逃げる → 外へ（取った物はそのまま）
  f = await run('star_caught', { choose: [0] }, { npc: 'guard_s' });
  ok('見つかった → 逃げる: 外へつまみ出されるだけ（戦わない。取った物はそのまま）', f.said.some((s) => s[0] === 'warp' && s[1] === 'orbis:academy') && !f.said.some((s) => s[0] === 'battle') && G.flags.star_prep_key && (G.vars.star_caught || 0) === 1);
  // 制服が無い: 夜ふかしの学生が悲鳴 → 外へ
  f = await run('star_student_shout');
  ok('制服が無いと夜ふかしの学生が悲鳴を上げる → 外へ', f.said.some((s) => s[0] === 'warp' && s[1] === 'orbis:academy'));
  // 保管庫（鍵のメモで開く）→ 星図・命令書（lo_ev_star）・手紙
  await run('star_vault_lock');
  f = await run('star_vault_chart');
  ok('文字盤（七・三・九）→ 保管庫の星図と封鎖の命令書（大書記ラザロ。lo_ev_star）', G.flags.star_vault_open && G.flags.star_chart_got && (G.items.k_star_chart || 0) > 0 && G.flags.lo_ev_star && f.said.some((s) => /大書記ラザロ/.test(String(s[1]))));
  f = await run('star_vault_bundle');
  ok('命令書の束の中の、色の違う封筒（ラザロの手紙 lo_lz_*）', Object.keys(G.flags).some((k) => /^lo_lz_\d$/.test(k)) && G.flags.star_bundle_seen);
  // 学長: 黙って戻す（こっそり）→ 星図の写し・学者の長衣
  f = await run('star_octavia_night', { choose: [1] });
  ok('こっそり＋黙って戻す: 学長から星図の写しと学者の長衣（ch_star_order=silent, ch_star_way=sneak）', G.choices.ch_star_order === 'silent' && G.choices.ch_star_way === 'sneak' && (G.items.k_star_chart_copy || 0) > 0 && (G.items.u_scholar_robe || 0) > 0 && !(G.items.k_seal_order || 0));
  ok('学長のあと、夜のうちに学院を出る（町へ）', f.said.some((s) => s[0] === 'warp' && s[1] === 'orbis:academy') && G.flags.star_octavia_done);
  // 塔: 星図で扉 → 天球儀の輪で格子が入れ替わる → 番人 → 頂
  await run('star_tower_seal');
  ok('尾根の塔の扉の星の穴に星図 → 塔が開く', G.flags.star_tower_open);
  const t1 = D.maps.star_tower_1;
  const walk = (x, y) => { const c = R.MapUtil.cell(t1, x, y); return !!(c && !c.solid && c.walk !== false); };
  R.MapUtil.invalidate();
  const rest = walk(13, 23) && !walk(25, 11);
  await run('star_orrery_lever'); R.MapUtil.invalidate();
  const turned = walk(13, 23) && walk(25, 11);
  await run('star_orrery_lever'); R.MapUtil.invalidate();
  ok('天球儀の輪: 休む = 北の格子が閉じる、回す = 北が開く（戻らない。西の口はいつも開いている）', rest && turned && walk(25, 11));
  f = await run('star_sentinel', { battles: ['win'] });
  ok('天球の番人（v_sentinel_star_01 → tr_b_orrery。星図を持っていても戦う）', G.flags.star_sentinel && f.said.some((s) => s[2] === 'v_sentinel_star_01') && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_b_orrery'));
  // 頂: 星食らい → 名を読む → 灯り直す → 年代記（痛）
  f = await run('star_stareater', { battles: ['win'], choose: [1] });
  ok('星食らい（tr_b_stareater）→ 星の名を読み上げる → 手がかり帳の余白の一行', G.flags.star_stareater && G.flags.star_names_read && f.said.some((s) => s[0] === 'caption' && /名は、灯りでもある/.test(String(s[1]))));
  ok('灯り直す場面: オルビスの広場、町じゅうが屋根の上、ルカが観測録に書き足す → clearRegion', G.flags.star_dawn_done && G.flags.cleared_r_star && f.said.some((s) => s[0] === 'warp' && s[1] === 'orbis:plaza') && f.said.some((s) => /屋根に上って/.test(String(s[1]))));
  ok('年代記の（痛）: 朝は二十年前まであった → 学長が講堂で定説を撤回（学生の笑い・黙る年寄り）', G.choices.ch_star_write === 'pain' && (G.vars.pain_count || 0) === 1 && f.said.some((s) => /定説を撤回/.test(String(s[1]))) && f.said.some((s) => /学生たちは笑い/.test(String(s[1]))));
  ok('日継ぎの主張（太陽は星のひとつ。カペラが最初に名を付けた星）と星読みの片眼鏡', f.said.some((s) => /カペラが最初に/.test(String(s[1]))) && (G.items.ac_tale_star || 0) > 0 && G.flags.star_finale_done);
  const chron = D.chronicle.r_star.text;
  ok('年代記の章に、こっそり・命令書・（痛）の文が出る', /誰にも気づかれずに/.test(chron) && /黙って保管庫に戻された/.test(chron) && /朝があった/.test(chron));
  ok('こっそり: 学院の術具店は 1 割安い', D.shops.shop_orbis_magic.priceMul() === 0.9);
  // 別の道: 黒板 3 枚・制服・押し通る（騒ぎ）・公にする
  R.State.newGame({ seed: 4 });
  const G2 = R.Game;
  G2.gold = 2000;
  await run('star_librarian');
  await run('star_laundress');
  await run('star_guard_window');
  ok('洗濯場で制服を借りる・守衛室の窓からのぞく → 準備 2 つ', G2.flags.star_prep_uniform && G2.flags.star_prep_route && G2.flags.star_ready && !G2.flags.star_prep_key);
  await run('star_academy_door', { choose: [0] });
  f = await run('star_student_shout');
  ok('制服を着ていれば、夜ふかしの学生は騒がない', !f.said.some((s) => s[0] === 'warp'));
  await run('star_vault_lock');
  ok('鍵の数を知らないと保管庫は開かない', !G2.flags.star_vault_open);
  for (const n of [1, 2, 3]) await run('star_board', {}, { board: n });
  await run('star_vault_lock');
  ok('一階の教室の黒板 3 枚の数 → 文字盤が開く', G2.flags.star_code_known && G2.flags.star_vault_open);
  f = await run('star_caught', { choose: [1], battles: ['win'] }, { npc: 'guard_c' });
  ok('押し通る: 夜番の鎧と戦う（tr_star_riot_1）→ その見張りは倒れたまま・騒ぎ', G2.flags.star_riot && G2.flags.star_down_guard_c && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_star_riot_1'));
  await run('star_vault_chart');
  f = await run('star_octavia_night', { choose: [0] });
  ok('騒ぎ＋公にする: 学長が責めを負って退く、長衣と写しは無い（ch_star_way=riot, ch_star_order=public）', G2.choices.ch_star_way === 'riot' && G2.choices.ch_star_order === 'public' && !(G2.items.u_scholar_robe || 0) && !(G2.items.k_star_chart_copy || 0) && f.said.some((s) => /学長は退く/.test(String(s[1]))));
  G2.flags.cleared_r_star = true;
  ok('騒ぎ: 解決の後も術具店の割引なし、学長は天文台の一研究者', D.shops.shop_orbis_magic.priceMul() === 1 && R.State.check(D.maps.orbis_observatory.npcs.find((n) => n.id === 'octavia_obs').cond));
  // 見回りの視線（E10）: 正面 3 マス・2 マス目から左右 1 マスの扇・壁でさえぎる
  const F = R.Field, S = F._s;
  const m0 = S.map;
  S.map = D.maps.star_academy_1;
  const n = { x: 20, y: 30, dir: 'e', def: { watch: { range: 3 } } };
  const sees = F._watchSees;
  ok('見回りの視線: 正面 1〜3 マスは見える、4 マス先・背後は見えない、2 マス目から左右 1 マス', !!sees && sees(n, 21, 30) && sees(n, 23, 30) && !sees(n, 24, 30) && !sees(n, 19, 30) && !sees(n, 21, 31) && sees(n, 22, 31) && sees(n, 23, 29));
  const wallN = { x: 14, y: 12, dir: 'e', def: { watch: { range: 3 } } };
  ok('見回りの視線は壁（手すり・教室の壁）でさえぎられる', sees(wallN, 15, 12) && !sees(wallN, 17, 12));
  S.map = m0;
}
function clearing() {
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  return R.Events._clearRegion('r_star').then((v) => { t = v; }).then(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_star', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_star === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_star').pageId;
    ok('clearRegion: ページ（星のページ）を持つ', page === 'k_page_star' && (G.items[page] || 0) > 0, page);
  });
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・出現表・落とし物）');
  const A = D.bossActions;
  for (const id of ['eb_orrery_align', 'eb_star_gulp']) ok(`${id} は予告（telegraph → next、守る）`, !!(A[id] && A[id].telegraph && A[A[id].telegraph.next] && A[id].telegraph.guard === 'defend'));
  ok('番人・星食らいの行動に予告が入る', D.monsters.b_orrery.actions.some((a) => a.id === 'eb_orrery_align') && D.monsters.b_stareater.actions.some((a) => a.id === 'eb_star_gulp'));
  ok('番人: 日・月・星の玉の順（読める型）', ['eb_sun_orb', 'eb_moon_orb', 'eb_star_orb'].every((id) => D.monsters.b_orrery.actions.some((a) => a.id === id && a.cond && a.cond.every)));
  ok('星食らい: 第 2 の姿（hpBelow 0.5）', !!(D.monsters.b_stareater.phases || []).length);
  ok('盗み専用: 星食らい ac_st_stareater は盗みだけ（イベントで渡さない）', !!D.items.ac_st_stareater && !SRC.includes('ac_st_stareater'));
  const zones = ['zw_star', 'z_r_star_tower'];
  ok('出現表 2 つ（高原・塔）', zones.every((z) => D.encounters[z] && D.encounters[z].region === 'r_star'));
  const big = [];
  for (const z of zones) for (const g of D.encounters[z].groups) { const nn = g.mons.reduce((a, m) => a + m[2], 0); if (nn > 5) big.push(`${z} ${nn}`); }
  ok('1 組は 5 匹まで', big.length === 0, big);
  ok('エリアは高原の出現表、塔 1 階は塔の出現表', MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => (D.maps[id].zones || []).some((z) => z.zone === 'zw_star')) && D.maps.star_tower_1.zones.some((z) => z.zone === 'z_r_star_tower'));
  ok('町と屋内は魔物が出ない', MY_MAPS.filter((id) => /town|interior/.test(D.maps[id].kind)).every((id) => !(D.maps[id].zones || []).some((z) => z.zone)));
  ok('学者の長衣・星見の羅針・試験の飾りひもはレアの率・落とす率を上げない（高原は T1 から）', ['u_scholar_robe', 'u_star_compass', 'u_exam_ribbon'].every((id) => { const m = D.items[id].mods || {}; return !m.rarePct && !m.dropPct; }));
  done('test_content_star');
}

story().then(clearing).then(battle).catch((e) => { console.error(e); process.exit(1); });
