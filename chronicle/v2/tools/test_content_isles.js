#!/usr/bin/env node
// マレア諸島（isles_*.js・field_isles_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_isles.js
//   1 形: マップ・イベント・手がかり・編成・店・場所が契約どおり、参照がそろう。町・洞窟・幽霊船・島々は 1 枚の下絵（絵のファイルがあり、大きさがマップと同じ）。
//        地方 r_isles は作った（dungeons・ボス・光の柱・章の要約）が、体験版の錠 slice:'locked' は残す（持ち主の決まり）
//   2 置き場所: 泉は幽霊船の 1 つだけ（長いダンジョン・入口の階でない）・洞窟は 0、宝箱は床の上、隠し通路なし（A27）、戸口は 1 マス、
//              街灯（lamp_post・snow_lamp）を置かない（港の灯 lamp_pillar は擁壁・崖・水の上）、下絵の町の物は働く物だけ
//   3 文: ボイスは声の担当の一覧の id だけで、それぞれ 1 回・仲間 20 人の名前を出さない（A36）・録音済みの文を 1 字も変えずに置く
//   4 筋: 閉包で clearRegion('r_isles') に着く（商船 2 通り・年代記 2 通り・寄り道と依頼なし）。縦切りのあいだは諸島へ行けない（定期船の桟橋）。
//        潮の石で満ち引きが替わる（2 通りの tilePatches、入口は切れない）。海図の空白 3 つで海域が絞れる。マリナ: 岩の節 → その場で／一晩待つ。
//        商船: 助ける = 地図 その4・組合の売り台が一段上、積荷 = ティア宝箱 3。年代記の（痛）は名札 1 枚以上のときだけ。解決でティア +1・ページ
//   5 戦闘: ボスの予告、出現表の数（1 組 5 匹まで）、盗み専用の品はイベントで渡さない
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');   // R.T('key') を日本語の文に戻して文面を確かめる（i18n）
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => D.maps[id].region === 'r_isles');
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^isles_/.test(f));
const SRC = i18nInline(EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /isles_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n'));
const PAINTED = ['coral', 'nerei', 'isles_cave_1', 'isles_cave_2', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3', 'i_cliff', 'i_cove', 'i_cape', 'i_light', 'i_siren', 'i_crab', 'i_wreck'];

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`諸島のマップ ${MY_MAPS.length} 枚（エリア 7・町 2・屋内 15・洞窟 2・幽霊船 3）`, MY_MAPS.length >= 29, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]).concat(['isles_sail_light', 'isles_sail_siren', 'isles_sail_crab', 'isles_sail_wreck']);
ok(`諸島のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.length >= 80 && myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const bad = myEvents.filter((id) => !R.Contract.check('event', D.events[id]).ok);
  ok('諸島のイベントが K.event', bad.length === 0, bad);
  const miss = [];
  for (const id of MY_MAPS.concat(['pharos'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
    const tos = (m.exits || []).map((e) => e.to).concat((m.objects || []).map((o) => o.to || (o.door && o.door.to)).filter(Boolean));
    for (const to of tos) if (!D.maps[to.map] || !(D.maps[to.map].spawns || {})[to.spawn]) miss.push(`${id} → ${to.map}:${to.spawn}`);
  }
  ok('マップの人・物・範囲のイベントと行き先（マップ・spawn）がすべてある', miss.length === 0, miss);
  const lost = [];
  for (const m of SRC.matchAll(/ev\.(?:appear|leave|say)\(\[?'([a-z0-9_]+)'/g)) if (!MY_MAPS.some((id) => (D.maps[id].npcs || []).some((n) => n.id === m[1]))) lost.push(m[1]);
  ok('話す人・appear・leave する人がマップにいる', lost.length === 0, [...new Set(lost)]);
  const warps = [...SRC.matchAll(/ev\.warp\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)].filter((m) => !(D.maps[m[1]] && D.maps[m[1]].spawns[m[2]])).map((m) => m[1] + ':' + m[2]);
  ok('ev.warp の行き先がある', warps.length === 0, warps);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_isles');
ok(`諸島の手がかり ${leads.length} 件（地方・依頼・うわさ）`, leads.length >= 12, leads.length);
ok('手がかりが K.lead', leads.every(([, l]) => R.Contract.check('lead', l).ok), leads.filter(([, l]) => !R.Contract.check('lead', l).ok).map(([id]) => id));
ok('編成（深みの大ダコ・亡霊船長グレン）', ['tr_b_octopus', 'tr_b_captain'].every((t) => D.troops[t] && R.Contract.check('troop', D.troops[t]).ok));
ok('場所 coral・nerei・tidecave・ghostship・lighthouse_isle', ['coral', 'nerei', 'tidecave', 'ghostship', 'lighthouse_isle'].every((id) => D.locations[id] && D.locations[id].region === 'r_isles' && D.maps[D.locations[id].map] && D.maps[D.locations[id].map].spawns[D.locations[id].spawn]));
ok('店 4 つ（道具屋・武具屋・船乗り組合・ネレイの雑貨屋）と品がそろう', ['shop_coral_items', 'shop_coral_arms', 'shop_coral_guild', 'shop_nerei'].every((id) => D.shops[id] && R.Contract.check('shop', D.shops[id]).ok &&
  [...D.shops[id].items, ...Object.values(D.shops[id].tier || {}).flat()].every((it) => D.items[it])));
{
  const g = D.regions.r_isles;
  ok('地方 r_isles: 体験版の錠（slice:locked）は残し、ダンジョン・光の柱・ボス・章の要約がある', g.slice === 'locked' && (g.dungeons || []).length === 2 && !!g.beaconAt && D.maps[g.beaconAt.map] && g.bossTroop === 'tr_b_captain' && !!g.chapter.summary);
}
ok('年代記の章 r_isles（E14）', !!(D.chronicle && D.chronicle.r_isles && R.Contract.check('chronicleEntry', D.chronicle.r_isles).ok));
ok('読み物 lo_ev_isles・lo_time_isles（必）・lo_war_isles', ['lo_ev_isles', 'lo_time_isles', 'lo_war_isles', 'lo_isles_shanty'].every((id) => D.lore[id]) && D.lore.lo_ev_isles.must && D.lore.lo_time_isles.must && !D.lore.lo_war_isles.must);
ok('大事な物・一品物（光る貝がら・海図・墨の写し・灯台の油・組合の荷・地図その4・人魚のくし・待つ人のくし・夜光貝の守り・信号旗の襟巻き・潮騒の耳飾り・潮のページ）',
  ['k_glow_shell', 'k_sea_chart', 'k_ink_copy', 'k_lamp_oil', 'k_guild_parcel', 'k_tmap_4', 'u_siren_comb', 'u_shore_comb', 'u_shell_charm', 'u_flag_scarf', 'ac_tale_isles', 'k_page_isles'].every((id) => D.items[id]));
{
  const miss = [];
  for (const id of PAINTED) {
    const a = D.maps[id].art;
    if (!a || !a.image) { miss.push(id + ' no art'); continue; }
    const [theme, , name] = a.image.split('/');
    for (const f of [`${name}@32.png`, `${name}@24.png`, `${name}.json`]) if (!fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', f))) miss.push(`${id} ${f}`);
    if (a.closed && !fs.existsSync(path.join(V2, 'assets', 'env', theme, 'under', a.closed.split('/')[2] + '@32.png'))) miss.push(`${id} closed`);
    if (miss.length) continue;
    const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', theme, 'under', name + '.json'), 'utf8'));
    if (j.size32[0] !== D.maps[id].w * 32 || j.size32[1] !== D.maps[id].h * 32) miss.push(`${id} size ${j.size32}`);
  }
  ok(`町・洞窟・幽霊船・島の道・島々 ${PAINTED.length} 枚は 1 枚の下絵（絵とメタがあり、大きさがマップと同じ）`, miss.length === 0, miss);
  const c1 = D.maps.isles_cave_1;
  const j = JSON.parse(fs.readFileSync(path.join(V2, 'assets', 'env', 'isles', 'under', 'isles_cave_1.json'), 'utf8'));
  const same = (j.live || []).length === (c1.tilePatches || []).length && (j.live || []).every((L, i) => JSON.stringify(L.cond) === JSON.stringify({ not: c1.tilePatches[i].cond }));
  ok('潮鳴りの洞窟 1 階の下絵は両方乾いた形、水の下の方は閉じた絵（live が tilePatches と同じ）', !!c1.art.closed && same);
}

// ================================================================ 2
section('2. 置き場所（泉・宝箱・戸口・灯り）');
{
  const byName = {};
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'dungeon')) (byName[D.maps[id].name] = byName[D.maps[id].name] || []).push(id);
  const springs = (ids) => ids.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'spring').map((o) => id));
  ok('潮鳴りの洞窟（2 階）に泉は置かない', springs(byName['潮鳴りの洞窟'] || []).length === 0);
  ok('幽霊船（3 階）は泉 1 つ、入口の甲板には置かない', JSON.stringify(springs(byName['幽霊船'] || [])) === JSON.stringify(['ghost_ship_2']));
  const secret = MY_MAPS.filter((id) => Object.values(D.maps[id].legend).some((l) => l.secret) && R.MapUtil.grid(D.maps[id]).some((r) => [...r].some((c) => D.maps[id].legend[c] && D.maps[id].legend[c].secret)));
  ok('隠し通路なし', secret.length === 0, secret);
  const fieldChests = MY_MAPS.filter((id) => D.maps[id].kind === 'field').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest' && o.cond == null).map((o) => id + ':' + o.id));
  ok(`島の道・島々の宝箱は 1 エリアに 1 つまで（${fieldChests.length} 個）`, MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest' && o.cond == null).length <= 1), fieldChests);
  const townChests = MY_MAPS.filter((id) => D.maps[id].kind === 'town').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').map((o) => id + ':' + o.id));
  ok(`町の宝箱は見える物だけ（${townChests.length} 個）`, townChests.length <= 3, townChests);
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
  const street = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'prop' && /^(lamp_post|snow_lamp)$/.test(o.id)).map((o) => id + ':' + o.x + ',' + o.y));
  ok('街灯（lamp_post・snow_lamp）を置かない（諸島の灯は港の灯 lamp_pillar）', street.length === 0, street);
  const onWalk = [];
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind !== 'interior')) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'prop' && /^(lamp_pillar|wisp_lamp)$/.test(q.id))) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (c && c.walk !== false && !c.solid) onWalk.push(`${id} ${o.id} ${o.x},${o.y}`);
    }
  }
  ok('港の灯・鬼火は擁壁・崖・船べり・水の上（歩けるマスに無い）', onWalk.length === 0, onWalk);
  const deco = [];
  for (const id of ['coral', 'nerei', 'isles_cave_1', 'isles_cave_2', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3']) for (const o of (D.maps[id].objects || []).filter((q) => q.type === 'prop')) if (!/^(lamp_pillar|wisp_lamp|glow_plankton|map_sign|ship)$/.test(o.id)) deco.push(`${id} ${o.id}`);
  ok('下絵の町とダンジョンの物のスプライトは、働く物だけ（飾りは絵の中）', deco.length === 0, deco);
  const shells = MY_MAPS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.event === 'isles_shell').map((o) => o.shell));
  ok('光る貝がら 12 種（町の浜・洞窟の中。フィールドには置かない A27）', shells.length === 12 && new Set(shells).size === 12 &&
    MY_MAPS.filter((id) => D.maps[id].kind === 'field').every((id) => !(D.maps[id].objects || []).some((o) => o.event === 'isles_shell')), shells);
}

// ================================================================ 3
section('3. 文（声・A36・録音の文）');
{
  const ids = [...SRC.matchAll(/'(v_[a-z0-9_]+)'/g)].map((m) => m[1]);
  const csv = fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
  const unknown = ids.filter((id) => !csv.includes(id));
  ok(`諸島のイベントのボイス ${ids.length} 本は、声の担当の一覧にある id だけ`, unknown.length === 0, unknown);
  const want = ['v_marina_nerei_01', 'v_marina_pier_01', 'v_marina_dawn_01', 'v_marina_dawn_02', 'v_glen_ship_01', 'v_glen_ship_02', 'v_glen_ship_03', 'v_glen_ship_04', 'v_glen_dawn_01', 'v_fine_isles_01'];
  const count = (id) => ids.filter((x) => x === id).length;
    ok('マリナ 4・グレン 5・フィーネ 1 の声を、それぞれ 1 か所に置く（v_marina_nerei_01 は岩の節の道・一晩の道の両方から呼ぶ 1 か所）', want.every((id) => count(id) === 1), want.map((id) => id + ':' + count(id)));
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を諸島の文に出さない（A36）`, hits.length === 0, hits);
  const rows = csv.split(/\r?\n/).filter((l) => want.some((id) => l.startsWith(id + ',')));
  const flat = SRC.replace(/\\n/g, '');
  const missing = rows.map((l) => l.split(',')[7]).filter((t) => t && !flat.includes(t));
  ok('録音済みの文（マリナ・グレン・フィーネ）を 1 字も変えずに置く', rows.length === want.length && missing.length === 0, missing);
}

// ================================================================ 4
section('4. 筋（閉包・潮・海図・マリナ・商船・解決）');
{
  const P = require('./qa/progress');
  P.init(R);
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const [wreck, write, restricted] of [['help', 'pain', false], ['cargo', 'story', false], ['help', 'story', true]]) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_isles_wreck: wreck, ch_isles_write: write }, restricted });
    ok(`商船=${wreck} 年代記=${write}${restricted ? '（寄り道・依頼なし）' : ''}: clearRegion('r_isles')`, !!(r.flags.cleared_r_isles && r.flags.isles_finale_done && r.flags.isles_captain), { shell: !!r.flags.isles_shell, ship: !!r.flags.isles_ship, song: !!r.flags.isles_song_done, cleared: !!r.flags.cleared_r_isles });
  }
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  ok('縦切りのあいだ（slice）は諸島へ行けない（定期船は欠航）', (() => { const q = P.closure({ variant: {} }); return !q.visited.has('coral') && !q.visited.has('nerei') && !q.visited.has('isles_cave_1'); })());
  const ph = D.maps.pharos;
  const door = (ph.objects || []).find((o) => o.to && o.to.map === 'coral');
  ok('ファロスの定期船の桟橋に、コーラルへ渡る乗り場（cond {not:{slice:true}}・はい／いいえ）と欠航の札（slice の間）', !!(door && door.cond && door.cond.not && door.cond.not.slice === true && door.confirm) &&
    (ph.objects || []).some((o) => o.event === 'isles_ferry_closed' && o.cond && o.cond.slice === true));
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
    call: async (id, args) => D.events[id].run(ev, Object.assign({}, args || {})), letter: async () => {}, rest: () => { said.push(['rest']); }, inn: async () => true, shop: async () => {},
    battle: async (t) => { const r = battles.length ? battles.shift() : 'win'; said.push(['battle', t, r]); return r; }, clearRegion: async () => { G.flags.cleared_r_isles = true; return 1; },
    mini: { sequence: async () => ({ rank: 'A' }), timing: async () => ({ hits: 3 }) },
  };
  return { ev, said };
}
async function story() {
  const X = R.Isles.ev;
  R.State.newGame({ seed: 3 });
  const G = R.Game;
  // 潮の石: 引き潮 = 北の渡り場が水、満ち潮 = 東の洞の口が水（南の渡り場はいつも乾いている）
  const c1 = D.maps.isles_cave_1;
  const water = (x, y) => { const c = R.MapUtil.cell(c1, x, y); return !!(c && c.walk === false); };
  R.MapUtil.invalidate();
  const low = water(23, 10) && !water(30, 18) && !water(23, 25);
  let f = fakeEv({ choose: [0] }); await D.events.isles_tide_stone.run(f.ev, {}); R.MapUtil.invalidate();
  const high = !water(23, 10) && water(30, 18) && !water(23, 25);
  f = fakeEv({ choose: [0] }); await D.events.isles_tide_stone.run(f.ev, {}); R.MapUtil.invalidate();
  ok('潮の石: 引き潮は北の渡り場が水の下、叩くと満ち潮（東の洞の口が水の下）、もう一度で戻る。南の渡り場はいつも歩ける', low && high && water(23, 10) && !water(30, 18));
  // 大ダコ → 光る貝がら → 外洋船
  f = fakeEv({}); await D.events.isles_glow_shell.run(f.ev, {});
  ok('大ダコの前は、光る貝がらを拾えない', !G.flags.isles_shell);
  f = fakeEv({ battles: ['win'] }); await D.events.isles_octopus.run(f.ev, {});
  f = fakeEv({}); await D.events.isles_glow_shell.run(f.ev, {});
  ok('深みの大ダコ（tr_b_octopus）→ 奥の岩棚の光る貝がら', G.flags.isles_octopus && G.flags.isles_shell && (G.items.k_glow_shell || 0) > 0);
  f = fakeEv({}); await D.events.coral_drake.run(f.ev, {}); await D.events.coral_drake.run(f.ev, {});
  ok('ドレイクが貝がらを船首に付けて、外洋船（isles_ship）', G.flags.isles_ship && !(G.items.k_glow_shell || 0));
  // 海図: 空白を先に 1 つ見てから海図 → 3 つ目で海域が絞れる
  f = fakeEv({}); await D.events.isles_sail_light.run(f.ev, {});
  f = fakeEv({}); await D.events.coral_harbormaster.run(f.ev, {});
  const before = !G.flags.isles_fog_found && G.flags.isles_chart_got;
  f = fakeEv({}); await D.events.isles_sail_siren.run(f.ev, {});
  f = fakeEv({ choose: [0] }); await D.events.isles_sail_wreck.run(f.ev, {});
  ok('海図の空白: 2 つでは絞れず、3 つ目で幽霊船の海域が絞れる', before && G.flags.isles_fog_found && X.charted(f.ev) === 3);
  // 座礁した商船: 助ける → 3 往復、船長が酒場で地図 その4、組合の売り台が一段上
  f = fakeEv({ choose: [0] }); await D.events.isles_wreck.run(f.ev, {});
  ok('商船: 船員を助ける（小舟で 3 往復）', G.choices.ch_isles_wreck === 'help' && f.said.filter((s) => s[0] === 'caption' && /往|浜へ運んだ/.test(String(s[1]))).length === 3);
  f = fakeEv({}); await D.events.coral_merchant.run(f.ev, {});
  const shopT = (T) => R.Rules.shopItems('shop_coral_guild', T);
  ok('助けた: 商船の船長から宝の地図・その4、組合の売り台に一段上の品', (G.items.k_tmap_4 || 0) > 0 && shopT(1).length >= R.Rules.shopItems('shop_coral_guild', 2).length - 0 && shopT(1).some((it) => /i_incense|i_horn|ac_\w+_1/.test(it)));
  // マリナ: 岩の節を聞いていない → 一晩（宿）→ 翌朝思い出す
  f = fakeEv({}); await D.events.nerei_marina.run(f.ev, {});
  ok('マリナ: 朝日の色の話（lo_time_isles）、前半だけ', G.flags.isles_marina_met && G.flags.lo_time_isles && !G.flags.isles_song_ready);
  f = fakeEv({ choose: [0] }); await D.events.nerei_inn_keeper.run(f.ev, {});
  f = fakeEv({}); await D.events.nerei_marina.run(f.ev, {});
  ok('岩の節なし: 村の宿で一晩 → マリナが思い出す（v_marina_nerei_01）', G.flags.isles_marina_night && G.flags.isles_song_ready && f.said.some((s) => s[2] === 'v_marina_nerei_01'));
  f = fakeEv({}); await D.events.nerei_marina.run(f.ev, {});
  ok('夜の桟橋: マリナが歌う（v_marina_pier_01）→ 霧 → 自分の船で幽霊船へ', G.flags.isles_song_done && G.flags.isles_fog_open && f.said.some((s) => s[2] === 'v_marina_pier_01') && f.said.some((s) => s[0] === 'warp' && s[1] === 'ghost_ship_1:board'));
  // 名札 0 枚: 年代記の（痛）は出ない
  f = fakeEv({ battles: ['win'], choose: [0] }); await D.events.isles_captain.run(f.ev, {});
  const opts = f.said.find((s) => s[0] === 'choose' && Array.isArray(s[1]) && s[1].length && /船長とマリナ/.test(s[1][0]));
  ok('亡霊船長グレン → 舟歌 → 白い日誌 → 夜明け（マリナ・グレン）→ 解決 → 墨の写し・lo_ev_isles', G.flags.isles_captain && G.flags.isles_log_white && G.flags.isles_dawn_done && G.flags.cleared_r_isles && (G.items.k_ink_copy || 0) > 0 && G.flags.lo_ev_isles &&
    ['v_glen_ship_01', 'v_glen_ship_02', 'v_glen_ship_03', 'v_glen_ship_04', 'v_marina_dawn_01', 'v_glen_dawn_01', 'v_marina_dawn_02'].every((v) => f.said.some((s) => s[2] === v)));
  ok('名札 0 枚: 年代記の（痛）の選択は出ない', !!opts && opts[1].length === 1 && G.choices.ch_isles_write === 'story' && !G.flags.isles_wall_names);
  ok('灯り直す場面の最後に日継ぎの主張', f.said.some((s) => /東の海から来る船/.test(String(s[1]))));
  // 別の道: 岩の節を聞いてからマリナ（その場で歌える・対のくし）、名札 2 枚 → （痛）で後家の壁に名
  R.State.newGame({ seed: 4 });
  const G2 = R.Game;
  f = fakeEv({}); await D.events.isles_siren_rock.run(f.ev, {});
  f = fakeEv({}); await D.events.nerei_marina.run(f.ev, {});
  ok('岩の節を聞いた: 一晩待たずに歌える、人魚のくしと対の待つ人のくし', G2.flags.isles_song_ready && !G2.flags.isles_marina_night && (G2.items.u_siren_comb || 0) > 0 && (G2.items.u_shore_comb || 0) > 0);
  const gs2 = D.maps.ghost_ship_2;
  for (const n of [2, 6]) { const o = gs2.objects.find((q) => q.event === 'isles_nametag' && q.tag === n); f = fakeEv({}); await D.events.isles_nametag.run(f.ev, { map: 'ghost_ship_2', x: o.x, y: o.y }); }
  G2.flags.isles_fog_open = true;
  f = fakeEv({ battles: ['win'], choose: [1] }); await D.events.isles_captain.run(f.ev, {});
  ok('名札 2 枚 → 年代記の（痛）で船員の名を読み上げ、後家の壁に名が足される', G2.choices.ch_isles_write === 'pain' && G2.flags.isles_wall_names && (G2.vars.pain_count || 0) === 1 &&
    f.said.some((s) => s[0] === 'caption' && /帆手のルーカス/.test(String(s[1])) && /見習いのベッポ/.test(String(s[1]))));
  const chron = D.chronicle.r_isles.text;
  ok('年代記の章に、（痛）の選択と名が出る', /ともに沈んだ者たちの名/.test(chron) && /帆手のルーカス/.test(chron) && !/甲板長トビアス/.test(chron));
  f = fakeEv({}); await D.events.nerei_marina.run(f.ev, {});
  ok('解決の後: マリナから潮騒の耳飾り（ac_tale_isles）', (G2.items.ac_tale_isles || 0) > 0);
  // 積荷: ティア宝箱 3
  const w = D.maps.i_wreck;
  const cargo = (w.objects || []).filter((o) => o.type === 'chest' && o.cond && o.cond.is === 'cargo');
  G2.choices.ch_isles_wreck = 'cargo';
  ok('積荷を拾う: 岩礁にティア宝箱 3（選んだときだけ見える）', cargo.length === 3 && cargo.every((o) => o.pool === 'p_T' && R.State.check(o.cond)));
}
function clearing() {
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  return R.Events._clearRegion('r_isles').then((v) => { t = v; }).then(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_isles', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_isles === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_isles').pageId;
    ok('clearRegion: ページ（潮のページ）を持つ', page === 'k_page_isles' && (G.items[page] || 0) > 0, page);
  });
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・出現表・落とし物）');
  const A = D.bossActions;
  for (const id of ['eb_octo_dive', 'eb_captain_aim']) ok(`${id} は予告（telegraph → next、守る）`, !!(A[id] && A[id].telegraph && A[A[id].telegraph.next] && A[id].telegraph.guard === 'defend'));
  ok('大ダコ・グレンの行動に予告が入る', D.monsters.b_octopus.actions.some((a) => a.id === 'eb_octo_dive') && D.monsters.b_captain.actions.some((a) => a.id === 'eb_captain_aim'));
  ok('グレン: 第 2 の姿（hpBelow 0.5）', !!(D.monsters.b_captain.phases || []).length);
  ok('盗み専用: 亡霊船長 ac_st_captain は盗みだけ（イベントで渡さない）', !!(D.items.ac_st_captain && D.items.ac_st_captain.stealOnly) && !SRC.includes('ac_st_captain'));
  const zones = ['zw_isles', 'z_r_isles_cave', 'z_r_isles_ship'];
  ok('出現表 3 つ（島・洞窟・船）', zones.every((z) => D.encounters[z] && D.encounters[z].region === 'r_isles'));
  const big = [];
  for (const z of zones) for (const g of D.encounters[z].groups) { const n = g.mons.reduce((a, m) => a + m[2], 0); if (n > 5) big.push(`${z} ${n}`); }
  ok('1 組は 5 匹まで', big.length === 0, big);
  ok('町とダンジョンの出現表が実在（マップの zones）', MY_MAPS.every((id) => (D.maps[id].zones || []).every((z) => !z.zone || D.encounters[z.zone])));
  ok('町と屋内は魔物が出ない', MY_MAPS.filter((id) => /town|interior/.test(D.maps[id].kind)).every((id) => !(D.maps[id].zones || []).some((z) => z.zone)));
  ok('人魚のくし・待つ人のくし・夜光貝の守りはレアの率・落とす率を上げない（諸島は T1 から）', ['u_siren_comb', 'u_shore_comb', 'u_shell_charm', 'u_flag_scarf'].every((id) => { const m = D.items[id].mods || {}; return !m.rarePct && !m.dropPct; }));
  done('test_content_isles');
}

story().then(clearing).then(battle).catch((e) => { console.error(e); process.exit(1); });
