#!/usr/bin/env node
// ガルド山地（mine_*.js・field_mine_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_mine.js
//   1 形: マップ・イベント・手がかり・編成・店・場所が契約どおり、参照がそろう。町・坑道・山地のエリアは 1 枚の下絵（絵のファイルがあり、大きさがマップと同じ）。
//        地方 r_mine は作った（dungeons・ボス・光の柱・章の要約）が、体験版の錠 slice:'locked' は残す（持ち主の決まり）。雪原の湯けむりの峠の東の端 → ガルドの峠道
//   2 置き場所: 泉は七の層の 1 つだけ（長いダンジョン・入口の階でない）、宝箱は床の上、隠し通路なし（A27）、戸口は 1 マス、
//              街灯（lamp_post・snow_lamp）を置かない（山地の灯は坑夫のカンテラ hook_lamp・道しるべの灯 waylamp の組 'mine'）、下絵の町の物は働く物だけ
//   3 文: ボイスは声の担当の一覧の id だけで、それぞれ 1 回・仲間 20 人の名前を出さない（A36）・録音済みの文を 1 字も変えずに置く・フィーネは出ない（§6.2）
//   4 筋: 閉包で clearRegion('r_mine') に着く（組合・鍛冶衆・仲裁 × 年代記・寄り道と依頼なし）。縦切りのあいだは山地へ行けない。
//        救出 3 人 → ハンマー → 岩戸（_01）→ 集会所（仲裁は 4 つの仕事で出る）→ 番人（A 戦う・B 歌・C 問答。_03 は B・C だけ）→ 炉の火 → 礼と近道 → 年代記（痛）
//   5 戦闘: ボスの予告、出現表の数（1 組 5 匹まで）
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');   // R.T('key') を日本語の文に戻して文面を確かめる（i18n）
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => D.maps[id].region === 'r_mine');
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^mine_/.test(f));
const SRC = i18nInline(EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^(mine_|field_mine_)/.test(f) && !/painted_rows/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n'));
const PAINTED = ['dovan', 'mine_1', 'mine_2', 'mine_3', 'g_pass', 'g_valley', 'g_rail', 'volk', 'vein_1', 'vein_2', 'vein_3'];

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`山地のマップ ${MY_MAPS.length} 枚（エリア 3・町 1・屋内 9・坑道 3）`, MY_MAPS.length >= 16, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]);
ok(`山地のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 60 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('山地のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['f_passinn'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
    const tos = (m.exits || []).map((e) => e.to).concat((m.objects || []).map((o) => o.to || (o.door && o.door.to)).filter(Boolean));
    for (const to of tos) if (!D.maps[to.map] || !(D.maps[to.map].spawns || {})[to.spawn]) miss.push(`${id} → ${to.map}:${to.spawn}`);
  }
  ok('マップの人・物・範囲のイベントと行き先（マップ・spawn）がすべてある', miss.length === 0, miss);
  const SPEAK_OK = new Set(['warden']);   // 番人は描いた玉座の上（人の絵を持たない。名前だけで話す）
  const lost = [];
  for (const m of SRC.matchAll(/ev\.(?:appear|leave|say)\(\[?'([a-z0-9_]+)'/g)) if (!SPEAK_OK.has(m[1]) && !MY_MAPS.some((id) => (D.maps[id].npcs || []).some((n) => n.id === m[1]))) lost.push(m[1]);
  ok('話す人・appear・leave する人がマップにいる', lost.length === 0, [...new Set(lost)]);
  const warps = [...SRC.matchAll(/ev\.warp\('([a-z0-9_]+)', ([a-z]+ \? )?'([a-z0-9_]+)'/g)].filter((m) => !(D.maps[m[1]] && D.maps[m[1]].spawns[m[3]])).map((m) => m[1] + ':' + m[3]);
  ok('ev.warp の行き先がある', warps.length === 0, warps);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_mine');
ok(`山地の手がかり ${leads.length} 件（地方・依頼・うわさ）`, leads.length >= 12, leads.length);
ok('手がかりが K.lead', leads.every(([, l]) => R.Contract.check('lead', l).ok), leads.filter(([, l]) => !R.Contract.check('lead', l).ok).map(([id]) => id));
ok('編成（岩食らい・鉄の番人）', ['tr_b_rockeater', 'tr_b_ironwarden'].every((t) => D.troops[t] && R.Contract.check('troop', D.troops[t]).ok));
ok('場所 dovan・deepmine・hermit', ['dovan', 'deepmine', 'hermit'].every((id) => D.locations[id] && D.locations[id].region === 'r_mine' && D.maps[D.locations[id].map] && D.maps[D.locations[id].map].spawns[D.locations[id].spawn]));
ok('店 3 つ（道具屋・鍛冶衆の売り台・組合の売り台）と品がそろう', ['shop_dovan_items', 'shop_dovan_forge', 'shop_dovan_guild'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok &&
  [...D.shops[id].items, ...Object.values(D.shops[id].tier || {}).flat()].every((it) => D.items[it])));
{
  const g = D.regions.r_mine;
  ok('地方 r_mine: 体験版の錠（slice:locked）は残し、ダンジョン・光の柱・ボス・章の要約がある', g.slice === 'locked' && (g.dungeons || []).length === 1 && !!g.beaconAt && D.maps[g.beaconAt.map] && g.bossTroop === 'tr_b_ironwarden' && !!g.chapter.summary);
}
ok('年代記の章 r_mine（E14）', !!(D.chronicle && D.chronicle.r_mine && R.Contract.check('chronicleEntry', D.chronicle.r_mine).ok));
ok('読み物 lo_ev_mine・lo_time_mine（必）・lo_war_mine（任）', ['lo_ev_mine', 'lo_time_mine', 'lo_war_mine', 'lo_mine_oath'].every((id) => D.lore[id]) && D.lore.lo_ev_mine.must && D.lore.lo_time_mine.must && !D.lore.lo_war_mine.must);
ok('大事な物・一品物（誓いのハンマー・坑夫の灯油・碑文の古い写し・組合のつるはし・誓いの槌・和解の指輪・隠者の数珠・坑夫の守り灯・誓いの腕輪・ページ）',
  ['k_oath_hammer', 'k_mine_oil', 'k_oath_copy', 'u_guild_pick', 'u_oath_hammer', 'u_accord_ring', 'u_hermit_beads', 'u_miner_lamp', 'ac_tale_mine', 'k_page_mine'].every((id) => D.items[id]));
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
  ok(`町・坑道・山地のエリア ${PAINTED.length} 枚は 1 枚の下絵（絵とメタがあり、大きさがマップと同じ）`, miss.length === 0, miss);
  const set = ['waylamp', 'brazier', 'lantern', 'signboard', 'board'].filter((b) => !fs.existsSync(path.join(V2, 'assets', 'env', 'mine', 'props', b + '__mine@32.png')));
  ok('山地の小道具の組 mine（道しるべ・しょく台 = 坑夫のカンテラの柱、置き灯・看板・掲示板）', set.length === 0 && MY_MAPS.filter((id) => D.maps[id].kind !== 'interior').every((id) => D.maps[id].propSet === 'mine'), set);
  const pi = D.maps.f_passinn;
  const e = (pi.exits || []).find((q) => q.to && q.to.map === 'g_pass');
  ok('雪原の湯けむりの峠の東の端 → ガルドの峠道（体験版のあいだは閉じる cond のまま）', !!(e && e.cond && e.cond.not && e.cond.not.slice === true) && D.maps.g_pass.exits.some((q) => q.to.map === 'f_passinn'));
}

// ================================================================ 2
section('2. 置き場所（泉・宝箱・戸口・灯り）');
{
  const byName = {};
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'dungeon')) (byName[D.maps[id].name] = byName[D.maps[id].name] || []).push(id);
  const springs = (ids) => ids.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'spring').map(() => id));
  ok('深き坑道（3 階）は泉 1 つ、七の層（番人の手前）だけ', JSON.stringify(springs(byName['深き坑道'] || [])) === JSON.stringify(['mine_3']));
  const secret = MY_MAPS.filter((id) => Object.values(D.maps[id].legend).some((l) => l.secret));
  ok('隠し通路なし', secret.length === 0, secret);
  const fieldChests = MY_MAPS.filter((id) => D.maps[id].kind === 'field').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest' && o.cond == null).map((o) => id + ':' + o.id));
  ok(`山地のエリアの宝箱は 1 エリアに 1 つまで（${fieldChests.length} 個）`, MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest' && o.cond == null).length <= 1), fieldChests);
  const townChests = MY_MAPS.filter((id) => D.maps[id].kind === 'town').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').map((o) => id + ':' + o.id));
  ok(`町の宝箱は見える物だけ、1 つの町に 3 つまで（${townChests.length} 個）`, MY_MAPS.filter((id) => D.maps[id].kind === 'town').every((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').length <= 3), townChests);
  const bad = [];
  for (const id of MY_MAPS) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'chest')) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (!c || c.solid || c.walk === false) bad.push(`${id} ${o.id} not on floor`);
      if ((m.objects || []).some((q) => q !== o && q.type !== 'chest' && q.x === o.x && q.y === o.y)) bad.push(`${id} ${o.id} under another object`);
    }
  }
  ok('宝箱は床の上で、ほかの物と重ならない', bad.length === 0, bad);
  const wide = [];
  for (const id of MY_MAPS) for (const o of D.maps[id].objects || []) if (o.type === 'building' && o.door && (o.door.w || 1) !== 1) wide.push(id + ':' + o.id);
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'interior')) for (const e of D.maps[id].exits || []) if (e.w !== 1 || e.h !== 1) wide.push(id);
  ok('戸口は 1 マス（町の建物と屋内の出口）', wide.length === 0, wide);
  const street = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'prop' && /^(lamp_post|snow_lamp|lamp_pillar)$/.test(o.id)).map((o) => id + ':' + o.x + ',' + o.y));
  ok('街灯・港の灯を置かない（山地の灯は坑夫のカンテラ）', street.length === 0, street);
  const onWalk = [];
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind !== 'interior')) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'prop' && q.id === 'hook_lamp')) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (c && c.walk !== false && !c.solid) onWalk.push(`${id} ${o.x},${o.y}`);
    }
  }
  ok('坑夫のカンテラ（hook_lamp）は岩壁の際（歩けるマスに無い）', onWalk.length === 0, onWalk);
  const deco = [];
  for (const id of ['dovan', 'mine_1', 'mine_2', 'mine_3']) for (const o of (D.maps[id].objects || []).filter((q) => q.type === 'prop')) if (!/^(hook_lamp|forge_glow|white_glow|crystal_glow|window_glow|ember_glow|mine_cart|board|lantern)$/.test(o.id)) deco.push(`${id} ${o.id}`);
  ok('下絵の町とダンジョンの物のスプライトは、働く物だけ（飾りは絵の中）', deco.length === 0, deco);
  const lamps = ['mine_1', 'mine_2', 'mine_3'].map((id) => (D.maps[id].objects || []).filter((o) => o.type === 'waylamp' && /^wl_mine_\d$/.test(o.id)).length);
  ok('坑夫のカンテラ（灯りを守る）は各階に 1 つ、油でともる（lit の旗）', lamps.join() === '1,1,1' && ['mine_1', 'mine_2', 'mine_3'].every((id) => (D.maps[id].objects || []).filter((o) => o.type === 'waylamp').every((o) => /^mine_lamp_\d$/.test(o.lit))));
  const m3 = D.maps.mine_3;
  ok('七の層は暗がり（岩戸の手前の坑道。しょく台 6 つ）', (m3.dark === true || (Array.isArray(m3.dark) && m3.dark.length > 0)) && (m3.objects || []).filter((o) => o.type === 'brazier').length === 6);
  const m1 = D.maps.mine_1;
  ok('1 階: 縦穴の架台は歩けない（トロッコで渡る）、東の坂は一方通行', [42, 43, 44, 45, 46].every((x) => { const c = R.MapUtil.cell(m1, x, 21); return !!(c && (c.solid || c.walk === false)); }) &&
    (m1.oneway || []).length >= 1 && (m1.oneway || []).every((o) => o.dir === 's'));
}

// ================================================================ 3
section('3. 文（声・A36・録音の文・フィーネ）');
{
  const ids = [...SRC.matchAll(/'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const csv = fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
  const unknown = ids.filter((id) => !csv.includes(id));
  ok(`山地のイベントのボイス ${ids.length} 本は、声の担当の一覧にある id だけ`, unknown.length === 0, unknown);
  const want = ['v_guardian_mine_01', 'v_guardian_mine_02', 'v_guardian_mine_03'];
  const count = (id) => ids.filter((x) => x === id).length;
  ok('番人の声 3 本を、それぞれ 1 か所に置く（_03 は誓いが生きている道だけの 1 か所）', want.every((id) => count(id) === 1), want.map((id) => id + ':' + count(id)));
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を山地の文に出さない（A36）`, hits.length === 0, hits);
  const rows = csv.split(/\r?\n/).filter((l) => want.some((id) => l.startsWith(id + ',')));
  const flat = SRC.replace(/\\n/g, '');
  const missing = rows.map((l) => l.split(',')[7]).filter((t) => t && !flat.includes(t));
  ok('録音済みの文（鉄の番人）を 1 字も変えずに置く', rows.length === want.length && missing.length === 0, missing);
  ok('フィーネは山地に出ない（STORY_BIBLE §6.2）', !/v_fine_/.test(SRC) && !MY_MAPS.some((id) => (D.maps[id].npcs || []).some((n) => n.look === 'fine')));
}

// ================================================================ 4
section('4. 筋（閉包・救出・岩戸・選ぶ・番人・解決）');
{
  const P = require('./qa/progress');
  P.init(R);
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const [side, write, restricted] of [['guild', 'pain', false], ['smiths', 'story', false], ['accord', 'pain', false], ['smiths', 'story', true]]) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_mine_side: side, ch_mine_write: write }, restricted });
    ok(`道=${side} 年代記=${write}${restricted ? '（寄り道・依頼なし）' : ''}: clearRegion('r_mine')`, !!(r.flags.cleared_r_mine && r.flags.mine_finale_done && r.flags.mine_warden_done), { rescued: !!r.flags.mine_rescued_all, choice: !!r.flags.mine_choice, cleared: !!r.flags.cleared_r_mine });
  }
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  ok('縦切りのあいだ（slice）は山地へ行けない（峠の番人）', (() => { const q = P.closure({ variant: {} }); return !q.visited.has('g_pass') && !q.visited.has('dovan') && !q.visited.has('mine_1'); })());
}
function fakeEv(opts) {
  const G = R.Game;
  const said = [];
  const choose = opts.choose || [];
  const battles = opts.battles || [];
  const ev = {
    flag: (k) => !!G.flags[k], setFlag: (k, v) => { G.flags[k] = v === undefined ? true : v; }, var: (k) => G.vars[k] || 0,
    setVar: (k, v) => { G.vars[k] = v; return v; }, addVar: (k, n) => { G.vars[k] = (G.vars[k] || 0) + (n == null ? 1 : n); return G.vars[k]; },
    has: (id) => (G.items[id] || 0) > 0, item: (id, n) => { G.items[id] = (G.items[id] || 0) + (n || 1); }, take: (id, n) => { G.items[id] = Math.max(0, (G.items[id] || 0) - (n || 1)); },
    gold: (n) => { G.gold = Math.max(0, (G.gold || 0) + (n || 0)); }, lead: () => {}, leadDone: () => {}, lore: (id) => { G.flags[id] = true; }, choice: (k, v) => { G.choices[k] = v; }, choiceOf: (k) => G.choices[k],
    say: async (who, t, o) => { said.push([who, t, o && o.voice]); }, caption: async (t) => { said.push(['caption', t]); }, choose: async (list) => { said.push(['choose', list]); const v = choose.shift(); return typeof v === 'function' ? v(list) : v == null ? 0 : v; },
    fade: async () => {}, wait: async () => {}, warp: async (m, s) => { said.push(['warp', m + ':' + s]); }, sfx: () => {}, bgm: () => {}, mapBgm: () => {}, jingle: () => {}, leave: async () => {}, appear: async () => {},
    call: async (id, args) => D.events[id].run(ev, Object.assign({}, args || {})), letter: async () => {}, rest: () => { said.push(['rest']); }, inn: async () => true, shop: async () => {}, guest: () => {},
    battle: async (t) => { const r = battles.length ? battles.shift() : 'win'; said.push(['battle', t, r]); return r; }, clearRegion: async () => { G.flags.cleared_r_mine = true; return 1; },
    mini: { sequence: async () => ({ rank: 'A' }), timing: async () => ({ hits: 3 }) },
  };
  return { ev, said };
}
const run = async (id, o, ctx) => { const f = fakeEv(o || {}); await D.events[id].run(f.ev, ctx || {}); return f; };
async function rescueAll() {
  await run('mine_miner1'); await run('mine_miner2');
  await run('mine_rockeater', { battles: ['win'] }); await run('mine_pip');
}
// (2026-10-03) 進行の詰まり: 3 人を救ったあと、ヘルガ・ボルグが「まずは子らを」のままで先が分からなかった。
//   どの順で救っても 3 人目で mine_rescued_all と次の手がかり（l_mine_seven = 七の層の岩戸）が付き、ヘルガ・ボルグが岩戸へ送る。古いセーブも読み込みで直る
async function rescueOrder() {
  const T = (k) => R.T(k);
  const orders = [['mine_miner1', 'mine_miner2', 'pip'], ['pip', 'mine_miner2', 'mine_miner1'], ['mine_miner2', 'pip', 'mine_miner1']];
  for (const order of orders) {
    R.State.newGame({ seed: 5 });
    const G = R.Game;
    const leads = [];
    const go = async (id, o) => { const f = fakeEv(o || {}); f.ev.lead = (l) => { leads.push(l); G.leads[l] = G.leads[l] || { got: 0, pin: false, seen: false }; }; await D.events[id].run(f.ev, {}); return f; };
    await go('dovan_helga');   // 初めて会う
    let f = await go('dovan_helga');
    const before = f.said.some((q) => q[1] === T('events.dovan_helga.say_9'));
    for (const id of order) { if (id === 'pip') { await go('mine_rockeater', { battles: ['win'] }); await go('mine_pip'); } else await go(id); }
    f = await go('dovan_helga');
    const helga = f.said.map((q) => q[1]);
    await go('dovan_borg');
    const fb = await go('dovan_borg');
    ok(`救う順 ${order.join('→')}: 3 人で mine_rescued_all・手がかり「七の層へ」、ヘルガは「まずは子らを」と言わず岩戸へ送る（ボルグも）`,
      before && G.flags.mine_rescued_all && G.vars.mine_rescued === 3 && leads.includes('l_mine_seven') &&
      !helga.includes(T('events.dovan_helga.say_9')) && helga.includes(T('events.dovan_helga.say_18')) &&
      fb.said.some((q) => q[1] === T('events.dovan_borg.say_15')), { helga, leads });
    await go('mine_rockdoor');
    f = await go('dovan_helga');
    ok(`  … 岩戸を見たあとは、ヘルガの頼み（隠者の写し・石像の祈り）に進む`, G.flags.mine_door_seen && G.flags.mine_helga_jobs && f.said.some((q) => q[1] === T('events.dovan_helga.say_10')));
  }
  // 古いセーブ: 3 人の旗だけあって mine_rescued_all・手がかりが無い → 読み込みで直る
  R.State.newGame({ seed: 6 });
  Object.assign(R.Game.flags, { mine_miner1: true, mine_miner2: true, mine_pip: true, mine_rockeater: true, mine_helga_met: true });
  R.Game.items.k_oath_hammer = 1;
  R.Game.leads.l_mine_trapped = { got: 0, pin: true, seen: true };
  const snap = JSON.parse(JSON.stringify(R.State.serialize()));
  ok('古いセーブ（3 人の旗はあり、まとめの旗が無い）が読める', R.State.deserialize(snap) === true);
  const G2 = R.Game;
  ok('  … 読み込みで mine_rescued_all・救った数 3・「閉じ込められた鉱夫」を解決・「七の層へ」を足す', G2.flags.mine_rescued_all && G2.vars.mine_rescued === 3 && G2.leads.l_mine_trapped.done && !!G2.leads.l_mine_seven);
  const f2 = fakeEv({});
  await D.events.dovan_helga.run(f2.ev, {});
  ok('  … ヘルガが岩戸へ送る', f2.said.some((q) => q[1] === T('events.dovan_helga.say_18')));
  R.State.newGame({ seed: 7 });
  Object.assign(R.Game.flags, { mine_miner1: true });
  ok('2 人以下のセーブは触らない', R.State.deserialize(JSON.parse(JSON.stringify(R.State.serialize()))) && !R.Game.flags.mine_rescued_all && !R.Game.leads.l_mine_seven);
}
// (2026-10-03) トロッコ競走「ちゃんと押しているのに反応がおかしい」: 見えていた印が当たりの中で押しても、押しが届くまでの遅れ（約 50 ms）で外れていた。
//   人の手を真似る: 描いた印が当たりの中ほどに来たフレームで押す気になり、押しは lagMs 後のフレームで届く（60 Hz・144 Hz）
async function trolleyInput() {
  const step = async (ms) => { R.Engine.step(ms); await new Promise((r) => setImmediate(r)); };
  R.Engine.clear && R.Engine.clear();
  // 当たりのまん中で押す気になる → lagMs 後に届く。当たり外の早すぎる押しは外れ
  async function play(o, frameMs, lagMs, aim) {
    const p = R.Mini.timing(o);
    let fin = null; p.then((v) => { fin = v; });
    let pressAt = -1, released = true, guard = 0;
    while (!fin && guard++ < 4000) {
      await step(frameMs);
      const st = R.Mini.state();
      if (st && st.kind === 'timing' && st.phase === 'input' && pressAt < 0 && released) {
        if (aim(st.pos, st.zones[0])) pressAt = R.Engine.time + lagMs;   // 描いた印（この時刻）を見て押す
      }
      if (pressAt >= 0 && R.Engine.time + frameMs >= pressAt) { R.Input._set('a', true); pressAt = -1; released = false; }
      else if (!released) { R.Input._set('a', false); released = true; }
    }
    R.Input._set('a', false);
    return { fin, frames: guard };
  }
  const mid = (pos, z) => Math.abs(pos - (z[0] + z[1]) / 2) < 0.02;
  const early = (pos, z) => pos < z[0] - 0.25 && pos > 0.05;
  const zHard = [[0.445, 0.555]];
  for (const [hz, fm] of [[60, 1000 / 60], [144, 1000 / 144]]) {
    const r = await play({ tries: 1, speed: 945, zones: zHard, auto: true }, fm, 50, mid);
    ok(`トロッコの間合い（上級のカーブ・${hz} Hz）: 当たりのまん中を見て押す → 押しの遅れ 50 ms でも当たり`, r.fin && r.fin.hits === 1, r);
    const e = await play({ tries: 1, speed: 945, zones: zHard, auto: true }, fm, 50, early);
    ok(`  … 当たりのずっと手前で押すと外れ（${hz} Hz）`, e.fin && e.fin.hits === 0, e);
  }
  {
    const r = await play({ tries: 1, speed: 1500, zones: [[0.4, 0.6]], auto: true }, 1000 / 60, 0, mid);
    ok('  … auto: 判定のあと結果の札で A を待たずに閉じる（1 秒ほどで返る）', r.fin && r.fin.hits === 1 && r.frames < 200, r);
  }
  // 競走を最後まで: 本物の R.Mini.timing で、遅れ 50 ms の手が各区間のまん中で押す → 上級でも記録やぶり
  R.State.newGame({ seed: 8 });
  Object.assign(R.Game.flags, { mine_race_met: true, mine_race_1: true, mine_race_2: true });
  const f = fakeEv({ choose: [2] });
  f.ev.mini = R.Mini;
  let fin = false;
  D.events.dovan_race_keeper.run(f.ev, {}).then(() => { fin = true; });
  let pressAt = -1, held = false, g = 0;
  while (!fin && g++ < 20000) {
    await step(1000 / 60);
    const st = R.Mini.state();
    if (held) { R.Input._set('a', false); held = false; }
    if (st && st.kind === 'timing' && st.phase === 'input' && pressAt < 0 && mid(st.pos, st.zones[0])) pressAt = R.Engine.time + 50;
    if (pressAt >= 0 && R.Engine.time + 1000 / 60 >= pressAt) { R.Input._set('a', true); held = true; pressAt = -1; }
  }
  R.Input._set('a', false);
  ok('トロッコ競走 上級（7 区間）: 遅れ 50 ms の手で全部当たり → 記録やぶり・トロッコ乗りの鈴', fin && R.Game.flags.mine_race_3 && R.Game.flags.mine_race_done && (R.Game.items.u_cart_bell || 0) > 0,
    { fin, said: f.said.filter((q) => q[0] === 'caption').map((q) => q[1]).slice(-3) });
}
async function story() {
  const X = R.Mine.ev;
  // ---- A 組合: 救出 → 岩戸（_01）→ 集会所 → 番人と戦う（_02、_03 は流さない）→ 炉の火 → つるはし・トロッコ線
  R.State.newGame({ seed: 3 });
  let G = R.Game;
  let f = await run('mine_pip');
  ok('岩食らいの前は、ピップに会えない（横穴の奥）', !G.flags.mine_pip && !(G.items.k_oath_hammer || 0));
  await rescueAll();
  ok('救出 3 人（ダグ・ロルフ・ピップ）→ 誓いのハンマー、ピップが名前を一瞬忘れた話をする', G.flags.mine_rescued_all && G.vars.mine_rescued === 3 && (G.items.k_oath_hammer || 0) > 0);
  f = await run('mine_rockdoor');
  ok('岩戸の前: 隙間の向こうが白い → 番人が目を覚ましかける（v_guardian_mine_01）→ 町へ戻る', G.flags.mine_door_seen && !G.flags.mine_door_open && f.said.some((s) => s[2] === 'v_guardian_mine_01'));
  f = await run('mine_rockdoor');
  ok('選ぶ前は岩戸が開かない', !G.flags.mine_door_open);
  f = await run('dovan_hall_chair', { choose: [(list) => list.indexOf('仲裁する（上の層だけを掘る）')] });
  ok('仕事をしていないと、仲裁の道は出ない', !f.said.some((s) => s[0] === 'choose' && Array.isArray(s[1]) && s[1].some((t) => /仲裁/.test(t))) && !G.flags.mine_choice);
  f = await run('dovan_hall_chair', { choose: [0] });
  ok('集会所で組合につく（ch_mine_side = guild）', G.choices.ch_mine_side === 'guild' && G.flags.mine_choice);
  await run('mine_rockdoor');
  ok('選んだあと: 誓いのハンマーで岩戸が開く', G.flags.mine_door_open);
  f = await run('mine_warden', { battles: ['win'], choose: [1] });
  ok('A: 番人（_02）→ 戦う tr_b_ironwarden → 声なしの締め（_03 は流さない）', G.flags.mine_warden_fought && f.said.some((s) => s[2] === 'v_guardian_mine_02') && !f.said.some((s) => s[2] === 'v_guardian_mine_03') && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_b_ironwarden'));
  ok('炉に火が戻る → 解決 → 誓いの腕輪と組合のつるはし、トロッコ線と深淵の鉱脈の旗', G.flags.mine_relight_done && G.flags.cleared_r_mine && (G.items.ac_tale_mine || 0) > 0 && (G.items.u_guild_pick || 0) > 0 && G.flags.mine_cartline && G.flags.mine_vein_open && !G.flags.mine_smithpath);
  ok('A: 年代記の（痛）→ ボルグとヘルガが同じ卓で帳簿を閉じる（どの道でも）', G.choices.ch_mine_write === 'pain' && G.flags.mine_ledger_closed);
  ok('解決のとき lo_ev_mine・lo_time_mine が必ず手に入る', G.flags.lo_ev_mine && G.flags.lo_time_mine);
  ok('灯り直す場面の最後に日継ぎの主張', f.said.some((s) => /鍛冶神が炉で打った/.test(String(s[1]))));
  f = await run('dovan_cart_station', { choose: [0] });
  ok('組合の道: ドヴァンのトロッコ乗り場から崖の終点へ走れる', f.said.some((s) => s[0] === 'warp' && s[1] === 'g_rail:railend'));
  // ---- B 鍛冶衆: 歌 → _03、（痛）の年代記
  R.State.newGame({ seed: 4 });
  G = R.Game;
  await rescueAll();
  await run('mine_rockdoor');
  await run('dovan_hall_chair', { choose: [1] });
  await run('mine_rockdoor');
  f = await run('mine_warden', { choose: [1] });
  ok('B: 番人（_02）→ 誓いの歌（字幕）→ _03 → 眠る（戦わない）', G.choices.ch_mine_side === 'smiths' && !G.flags.mine_warden_fought && f.said.some((s) => s[2] === 'v_guardian_mine_03') && !f.said.some((s) => s[0] === 'battle') &&
    f.said.some((s) => s[0] === 'caption' && /鉄の番人よ、眠れ/.test(String(s[1]))));
  ok('B: 年代記の（痛）→ 帳簿を閉じる場面と張り紙、誓いの槌・鍛冶衆の抜け道', G.choices.ch_mine_write === 'pain' && G.flags.mine_ledger_closed && (G.vars.pain_count || 0) === 1 && (G.items.u_oath_hammer || 0) > 0 && G.flags.mine_smithpath && !G.flags.mine_cartline);
  const chron = D.chronicle.r_mine.text;
  ok('年代記の章に、選んだ道と（痛）の文が出る', /誓いの歌/.test(chron) && /戦に売った刃の上/.test(chron) && !/打ち倒した/.test(chron));
  f = await run('dovan_forge_boy', { choose: [0] });
  ok('鍛冶衆の道: 鍛冶場の見習いが抜け道で峠道へ送る', f.said.some((s) => s[0] === 'warp' && s[1] === 'g_pass:tunnel'));
  // ---- C 仲裁: 4 つの仕事（家族 2・帳簿・隠者の写し・石像）→ 仲裁 → 問答 → _03
  R.State.newGame({ seed: 5 });
  G = R.Game;
  await rescueAll();
  await run('mine_rockdoor');
  await run('dovan_borg'); await run('dovan_borg'); await run('dovan_borg');
  await run('dovan_helga'); await run('dovan_helga'); await run('dovan_helga');
  await run('dovan_dag_wife'); await run('dovan_rolf_mother'); await run('dovan_ledger');
  await run('mine_hermit'); await run('dovan_helga'); await run('dovan_forge_statue');
  ok('組合の仕事 2（家族に知らせる・出納帳 lo_war_mine）と鍛冶衆の仕事 2（隠者の写し・石像の祈り）', G.flags.mine_job_g1 && G.flags.mine_job_g2 && G.flags.mine_job_s1 && G.flags.mine_job_s2 && G.flags.lo_war_mine && X.accordOk(fakeEv({}).ev));
  f = await run('dovan_hall_chair', { choose: [2] });
  ok('4 つの仕事で仲裁の道が出る（ch_mine_side = accord）', G.choices.ch_mine_side === 'accord');
  await run('mine_rockdoor');
  f = await run('mine_warden', { choose: [0, 0] });
  ok('C: 番人（_02）→ 誓い直しの問答（3 つ）→ _03 → 眠る', f.said.some((s) => s[0] === 'choose' && Array.isArray(s[1]) && s[1].length === 3) && f.said.some((s) => s[2] === 'v_guardian_mine_03') && !G.flags.mine_warden_fought);
  ok('C: 和解の指輪、近道は両方（トロッコ線・鍛冶衆の抜け道）', (G.items.u_accord_ring || 0) > 0 && G.flags.mine_cartline && G.flags.mine_smithpath);
  const up = R.Rules.shopItems('shop_dovan_guild', 1), base = (() => { const c = G.choices.ch_mine_side; G.choices.ch_mine_side = null; const v = R.Rules.shopItems('shop_dovan_guild', 1); G.choices.ch_mine_side = c; return v; })();
  ok('仲裁: 組合の売り台に一段上の品が先に並ぶ', up.length > base.length, { up: up.length, base: base.length });
  // ---- 隠者の問答・依頼
  R.State.newGame({ seed: 6 });
  G = R.Game;
  f = await run('mine_hermit', { choose: [0, 0, 1, 1] });
  ok('隠者の問答（3 問、伝承の中身）→ 隠者の数珠', G.flags.mine_hermit_quiz && (G.items.u_hermit_beads || 0) > 0);
  await run('dovan_tadeo');
  for (const [m, n] of [['mine_1', 1], ['mine_2', 2], ['mine_3', 3]]) { const o = D.maps[m].objects.find((q) => q.id === 'wl_mine_' + n); await run('mine_lamp', {}, { map: m, x: o.x, y: o.y }); }
  await run('dovan_tadeo');
  ok('坑夫のカンテラ 3 つ（油）→ 坑夫の守り灯', G.flags.mine_lamp_1 && G.flags.mine_lamp_2 && G.flags.mine_lamp_3 && G.flags.mine_lamps_done && (G.items.u_miner_lamp || 0) > 0);
  await run('mine_ghost');
  const c4 = D.maps.mine_2.objects.find((o) => o.id === 'mine_2_c4');
  ok('坑道の幽霊（休み場のカンテラがともると出る）→ 最後まで聞くと宝箱が見える', G.flags.mine_ghost_done && R.State.check(c4.cond));
  await run('dovan_cat_kid'); await run('mine_kitten'); await run('dovan_cat_kid');
  ok('落盤の子猫: 割れ目で見つけて連れ帰る', G.flags.mine_kitten_home);
  await run('dovan_forge_boy'); await run('dovan_bellows');
  ok('鍛冶場の火起こし（R.Mini.timing）', G.flags.mine_bellows_done);
}
function clearing() {
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  return R.Events._clearRegion('r_mine').then((v) => { t = v; }).then(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_mine', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_mine === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_mine').pageId;
    ok('clearRegion: ページを持つ', page === 'k_page_mine' && (G.items[page] || 0) > 0, page);
  });
}

// ================================================================ 6（2026-09-30）寄り道 #16 ヴォルク・#17 深淵の鉱脈・トロッコ競走
async function optional() {
  section('6. 寄り道（鍛冶衆の隠れ村ヴォルク・深淵の鉱脈）とトロッコ競走');
  const M = D.maps;
  const NEW = ['volk', 'vein_1', 'vein_2', 'vein_3'];
  for (const id of NEW) {
    const m = M[id], f = path.join(V2, 'assets', 'env', 'mine', 'under', id + '.json');
    let j = null;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* */ }
    ok(`${id}: 描いた下絵があり、大きさがマップと同じ`, !!(m && j && j.size32 && j.size32[0] === m.w * 32 && j.size32[1] === m.h * 32), j && j.size32);
  }
  ok('ヴォルクの屋内 4 つ（宿・大鍛冶場・家・老鍛冶の家）', ['volk_inn', 'volk_forge', 'volk_house', 'volk_elder'].every((id) => M[id] && M[id].kind === 'interior'));
  ok('鉱石の谷の南西の端 → 古い吊り橋 → ヴォルク（いつでも。見える道 A27）', (M.g_valley.exits || []).some((e) => e.to.map === 'volk' && !e.cond) && M.g_valley.spawns.volk);
  const dv = (M.dovan.objects || []).find((o) => o.to && o.to.map === 'volk');
  const vs = (M.volk.objects || []).find((o) => o.to && o.to.map === 'dovan');
  ok('ドヴァン ⇔ ヴォルクの鍛冶衆の下り道は mine_volk_open で開く（B・C）', dv && dv.cond === 'mine_volk_open' && vs && vs.cond === 'mine_volk_open' && M.dovan.spawns.volkpath);
  const sh = (M.mine_3.objects || []).find((o) => o.type === 'stairs' && o.to.map === 'vein_1');
  R.State.newGame({ seed: 7 });
  let G = R.Game;
  const open = () => R.State.check(sh.cond);
  const c0 = open();
  G.flags.mine_vein_open = true; const c1 = open(); G.flags.mine_vein_open = false;
  G.tier = 6; const c2 = open(); G.tier = 0;
  ok('七の層の広間の縦穴 → 深淵の鉱脈: 組合・仲裁の旗か、ティア 6 で開く', sh && !c0 && c1 && c2);
  ok('深淵の鉱脈の 1・2 階は暗がり（A25）、しょく台がある', ['vein_1', 'vein_2'].every((id) => Array.isArray(M[id].dark) && M[id].objects.some((o) => o.type === 'brazier')));
  ok('2 階に宝石ハリネズミの巣（レアの率が高い区画）と休息の灯', M.vein_2.zones[0].zone === 'z_mine_vein_nest' && D.rareEncounters.z_mine_vein_nest.mon === 'rm_gem_hedgehog' && D.rareEncounters.z_mine_vein_nest.rate < D.rareEncounters.z_mine_vein.rate && M.vein_2.objects.some((o) => o.type === 'spring'));
  ok('泉は七の層と深淵の鉱脈 2 階だけ', MY_MAPS.filter((id) => (M[id].objects || []).some((o) => o.type === 'spring')).sort().join() === 'mine_3,vein_2');
  const T = D.troops.tr_b_vein_lord, A = D.bossActions;
  ok('隠しボス 鉱脈の主: 強さ固定（ティア 6）、結晶の嵐・結晶の膜・かけら（2026-10-01 予告はやめた）', T && T.tier === 6 && !T.scale && ['eb_vein_storm', 'eb_vein_crystal', 'eb_vein_shards'].every((id) => D.monsters.b_vein_lord.actions.some((a) => a.id === id)));
  ok('手前の看板で「危険」を知らせる', M.vein_3.objects.some((o) => o.type === 'sign' && /鉱脈の主/.test(i18nInline(JSON.stringify(o.text)))));
  const axe = M.vein_3.objects.find((o) => o.type === 'chest' && o.item === 'u_vein_axe');
  ok('鉱脈の斧は主を倒したあとの宝箱（cond mine_vein_lord）', axe && axe.cond === 'mine_vein_lord');
  let f = await run('vein_lord', { choose: [1] });
  ok('鉱脈の主: 引き返せる（戦わない）', !G.flags.mine_vein_lord);
  f = await run('vein_lord', { choose: [0], battles: ['win'] });
  ok('鉱脈の主: 勝つと旗', G.flags.mine_vein_lord && f.said.some((s) => s[0] === 'battle' && s[1] === 'tr_b_vein_lord'));
  // 住人は選び方で変わる
  const who = (id) => (M.volk_forge.npcs.find((n) => n.id === id) || {}).cond;
  G.choices.ch_mine_side = 'guild';
  ok('組合につくと、町を去ったヘルガがヴォルクの大鍛冶場に', R.State.check(who('volk_helga')));
  G.choices.ch_mine_side = 'smiths';
  ok('鍛冶衆につくと、ヘルガは町のまま（ピップが村へ来る）', !R.State.check(who('volk_helga')) && R.State.check(M.volk.npcs.find((n) => n.id === 'volk_pip').cond));
  const shop = D.shops.shop_volk_arms;
  ok('ヴォルクの大鍛冶場: ティアで入れ替わる珍しい武器', shop && shop.items.length >= 3 && Object.keys(shop.tier).length >= 3 && shop.items.every((id) => D.items[id] && D.items[id].grade === 'rare'));
  // トロッコ競走（R.Mini.timing。段ごとに 1 回だけの礼）
  R.State.newGame({ seed: 8 });
  G = R.Game;
  f = await run('dovan_race_keeper', { choose: [2] });
  ok('トロッコ競走: 下の段で勝つまで上の段は走れない', !G.flags.mine_race_3 && G.leads && f.said.some((s) => s[0] === 'choose'));
  await run('dovan_race_keeper', { choose: [0] });
  ok('トロッコ競走 初級: 分かれ道とカーブを抜けて記録やぶり → 礼', G.flags.mine_race_1 && (G.items.i_potion || 0) >= 3);
  await run('dovan_race_keeper', { choose: [1] });
  await run('dovan_race_keeper', { choose: [2] });
  ok('上級まで勝つと トロッコ乗りの鈴 と依頼の終わり', G.flags.mine_race_done && (G.items.u_cart_bell || 0) > 0);
  const n = G.items.u_cart_bell;
  await run('dovan_race_keeper', { choose: [2] });
  ok('礼は段ごとに 1 回だけ', G.items.u_cart_bell === n);
  ok('競走の区間は R.Mini.timing（分かれ道 = 梃子・カーブ = ブレーキ）', /mini\.timing/.test(SRC) && /梃子/.test(SRC) && /ブレーキ/.test(SRC));
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・出現表）');
  const A = D.bossActions;
  // 2026-10-01（ボスの組み直し）: 溜め（予告）はやめ、色んな角度から攻める
  ok('岩食らい・番人・鉱脈の主は予告を使わない', ['b_rockeater', 'b_ironwarden', 'b_vein_lord'].every((id) => !D.monsters[id].actions.some((a) => D.bossActions[a.id] && D.bossActions[a.id].telegraph)));
  ok('岩食らい: 酸（守りを下げる・毒）・落盤・砂利吐き', ['eb_rock_acid', 'eb_cave_in', 'eb_gravel_spit'].every((id) => D.monsters.b_rockeater.actions.some((a) => a.id === id)));
  ok('番人: 最初から 2 回動く、鉄の構え（反撃）・鉄くず散らし', D.monsters.b_ironwarden.actsPerTurn === 2 && ['eb_warden_guard', 'eb_warden_slag'].every((id) => D.monsters.b_ironwarden.actions.some((a) => a.id === id)));
  const zones = ['zw_mine', 'z_r_mine_mine'];
  ok('出現表 2 つ（山地・坑道）', zones.every((z) => D.encounters[z] && D.encounters[z].region === 'r_mine'));
  const big = [];
  for (const z of zones) for (const g of D.encounters[z].groups) { const n = g.mons.reduce((a, m) => a + m[2], 0); if (n > 5) big.push(`${z} ${n}`); }
  ok('1 組は 5 匹まで', big.length === 0, big);
  ok('町とダンジョンの出現表が実在（マップの zones）', MY_MAPS.every((id) => (D.maps[id].zones || []).every((z) => !z.zone || D.encounters[z.zone])));
  ok('町と屋内は魔物が出ない', MY_MAPS.filter((id) => /town|interior/.test(D.maps[id].kind)).every((id) => !(D.maps[id].zones || []).some((z) => z.zone)));
  ok('山地の一品物はレアの率・落とす率を上げない（山地は T1 から）', ['u_guild_pick', 'u_oath_hammer', 'u_accord_ring', 'u_hermit_beads', 'u_miner_lamp'].every((id) => { const m = D.items[id].mods || {}; return !m.rarePct && !m.dropPct; }));
  done('test_content_mine');
}

story().then(rescueOrder).then(trolleyInput).then(clearing).then(optional).then(battle).catch((e) => { console.error(e); process.exit(1); });
