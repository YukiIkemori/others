#!/usr/bin/env node
// 全体のつながりの検査（体験版の錠を外した本編の通し）。node だけ。
//   node v2/tools/test_integration.js [--verbose] [--quick]
//  1 地方のつなぎ目: 地方をまたぐ出口・扉・階段・建物の戸口・イベントのワープ（meta.warp）が、ある map と歩ける spawn へ行き、
//    行った先の地方から元の地方へ戻る道（どこかのつなぎ目）がある。序章から、つなぎ目だけで 8 つの地方とワールドに届く
//  2 前のワールド: 町・ダンジョン・エリアから前のワールド（world）へ出る所は、決めたつなぎ（森の十字路・湿原の北・星見の坂）だけ。
//    そこから歩ける前のワールドはその 3 つを結ぶ山あいの道だけで、町やダンジョンの入口（古い入口）には届かない
//  3 大灯火: 8 つの地方に、ページの品・光の柱の場所（beaconAt）・clearRegion('<地方>') を呼ぶイベント・年代記の章（DB.chronicle）。
//    章の文の選択（{choice, is}）はどれもイベントが渡す（meta.gives 'choice:…'）。どの選び方でも文が空でない
//  4 通し: 錠を外した 1 本の閉包（tools/qa/progress.js）で、序章から 8 つの地方がすべて解決し（ティア 8 = 終盤の解禁の条件）、
//    年代記の選択 ch_<地方>_write がすべて渡る
//  5 どの順でも: 森のあと、ほかの地方の解決（clearRegion）を 1 つも使わずに、それぞれの地方を解決できる（--quick で省く）
//  6 体験版の錠（DB.config.slice）: 行けるのは序章・森・ワールドだけ。ほかの 7 つの地方のマップは R.DemoGate.isOpen が偽
//  7 終盤（ビブリア島・白の大書庫・エンディング）: マップとイベントがあるか。まだ無ければ「未作成」と数える（失敗にはしない。--strict で失敗）
'use strict';
const { ok, section, done } = require('./lib/testkit');

const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');
const STRICT = process.argv.includes('--strict');
const P = require('./qa/progress');
const { R, M } = P.init();
const F = R.Field;
const MAPS = R.DB.maps;
const REGIONS = Object.keys(R.DB.regions).filter((k) => /^r_/.test(k)).sort((a, b) => R.DB.regions[a].n - R.DB.regions[b].n);
const regionOf = (id) => (R.DemoGate && R.DemoGate.regionOf ? R.DemoGate.regionOf(id) : (MAPS[id] && MAPS[id].region) || 'prologue');
const SLICE0 = !!R.DB.config.slice;
const pending = [];

// ---------------------------------------------------------------- 錠を外す（同じ R の中だけ）
R.DB.config.slice = false;
R.State.newGame({ seed: 1 });
R.MapUtil.invalidate();

/** どのマップからでも、行き先のある物（cond は問わない）とイベントのワープ → [{from, to:{map,spawn}, kind, where}] */
function links() {
  const out = [];
  for (const m of Object.values(MAPS)) {
    if (!m || /^stub_/.test(m.id)) continue;
    for (const p of M.portals(m, { all: true })) {
      if (!p.to || !p.to.map) continue;
      if (p.cond && typeof p.cond === 'object' && p.cond.slice === true) continue;   // 体験版の間だけの写し（demo_gate）
      out.push({ from: m.id, to: p.to, kind: p.kind, where: `${m.id}@${p.x},${p.y}` });
    }
  }
  for (const [id, ev] of Object.entries(R.DB.events)) {
    const ws = [].concat((ev && ev.meta && ev.meta.warp) || []);
    if (!ws.length) continue;
    const places = M.eventPlaces(id);
    for (const w of ws) for (const pl of places.length ? places : [{ map: null }]) {
      if (!pl.map) continue;
      out.push({ from: pl.map, to: { map: w.to || w.map, spawn: w.spawn, x: w.x, y: w.y }, kind: 'warp', where: `event ${id}` });
    }
  }
  return out;
}

/** cond つきの tilePatch の中のマス（その cond の間だけ閉じている所。開いたときに着く spawn） */
function patched(m, x, y) { return (m.tilePatches || []).some((p) => p.cond != null && p.rect && x >= p.rect[0] && y >= p.rect[1] && x < p.rect[0] + p.rect[2] && y < p.rect[1] + p.rect[3]); }
/** 前のワールドで、町・ダンジョン・エリアから出て歩ける所（その時の錠のまま）→ Set('x,y,lv') */
function worldReach() {
  const w = MAPS.world, sp = new Set();
  for (const m of Object.values(MAPS)) {
    if (!m || m.id === 'world' || /^stub_/.test(m.id)) continue;
    for (const p of M.portals(m)) if (p.to && p.to.map === 'world') sp.add(p.to.spawn);
  }
  for (const ev of Object.values(R.DB.events)) for (const wv of [].concat((ev.meta && ev.meta.warp) || [])) if (wv && (wv.to || wv.map) === 'world' && wv.spawn) sp.add(wv.spawn);
  const starts = [...sp].map((k) => w.spawns[k]).filter(Boolean);
  const res = M.bfs(w, starts, {});
  return { set: new Set(res.dist.keys()), spawns: [...sp], res };
}
/** 前のワールドの出入り口は、歩ける所から届く物だけ数える（前のワールドの届かない所に残った古い町の入口は数えない） */
function liveWorld(l, wr) { if (l.from !== 'world') return true; const [x, y] = l.where.split('@')[1].split(',').map(Number); return [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => wr.set.has((x + dx) + ',' + (y + dy) + ',0')); }

// ---------------------------------------------------------------- 1 地方のつなぎ目
section('1. 地方のつなぎ目');
const WR = worldReach();
const Lall = links();
const L = Lall.filter((l) => liveWorld(l, WR));
console.log(`  （前のワールドの届かない所の古い入口 ${Lall.length - L.length} 本は数えない）`);
const cross = L.filter((l) => MAPS[l.to.map] && regionOf(l.from) !== regionOf(l.to.map));
const badDest = [];
for (const l of L) {
  const t = MAPS[l.to.map];
  if (!t) { badDest.push(`${l.where} → ${l.to.map}（マップが無い）`); continue; }
  const d = M.dest(l.to);
  if (!d) { badDest.push(`${l.where} → ${l.to.map}.${l.to.spawn}（spawn が無い）`); continue; }
  if (!F._walkable(t, d.x, d.y, null, d.lv || 0) && !patched(t, d.x, d.y)) badDest.push(`${l.where} → ${l.to.map}.${l.to.spawn} (${d.x},${d.y}) が歩けない`);
}
ok(`どの出入り口・ワープも、ある map と歩ける spawn へ（${L.length} 本）`, !badDest.length, badDest.slice(0, 20));
const pairs = new Map();
for (const l of cross) { const k = regionOf(l.from) + '>' + regionOf(l.to.map); if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(l.where + ' → ' + l.to.map + '.' + (l.to.spawn || '')); }
if (VERBOSE) for (const [k, v] of pairs) console.log('   ', k, v.join(' | '));
const oneWay = [...pairs.keys()].filter((k) => { const [a, b] = k.split('>'); return !pairs.has(b + '>' + a); });
ok(`地方をまたぐつなぎ目 ${cross.length} 本（地方の組 ${pairs.size}）: どれも行った先から戻る道がある`, !oneWay.length, oneWay.map((k) => k + ' : ' + pairs.get(k).join(' | ')));
{
  const adj = new Map();
  for (const k of pairs.keys()) { const [a, b] = k.split('>'); if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); }
  const seen = new Set(['prologue']), q = ['prologue'];
  while (q.length) { const a = q.shift(); for (const b of adj.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
  const miss = REGIONS.filter((r) => !seen.has(r));
  ok('序章から、つなぎ目だけで 8 つの地方に届く', !miss.length && REGIONS.length === 8, { regions: REGIONS.length, miss });
}

// ---------------------------------------------------------------- 2 前のワールド
section('2. 前のワールド（world）');
{
  const w = MAPS.world;
  const into = L.filter((l) => l.to.map === 'world' && l.from !== 'world');
  const spawns = [...new Set(into.map((l) => l.to.spawn))];
  const INTENDED = { f_cross_e: 'f_cross', marsh_n: 'm_north', star_w: 's_steps' };
  const extra = into.filter((l) => !INTENDED[l.to.spawn]);
  ok(`前のワールドへ出るのは決めたつなぎだけ（${spawns.join('・')}）`, !extra.length, extra.map((l) => l.where + ' → world.' + l.to.spawn));
  const res = WR.res;
  const hit = [...new Set(res.portals.map((h) => h.p.to && h.p.to.map))];
  const stray = hit.filter((id) => !Object.values(INTENDED).includes(id));
  ok(`歩ける前のワールド ${res.dist.size} マス: 行けるのは 3 つのエリアだけ（${hit.join('・')}）`, !stray.length && res.dist.size < 5000, { stray, cells: res.dist.size });
}

// ---------------------------------------------------------------- 3 大灯火・年代記
section('3. 大灯火・ページ・年代記');
const src = {};
for (const [id, ev] of Object.entries(R.DB.events)) { try { src[id] = String(ev.run || ''); } catch (e) { src[id] = ''; } }
const givers = new Map();
for (const [id, ev] of Object.entries(R.DB.events)) for (const g of (ev.meta && ev.meta.gives) || []) if (/^choice:/.test(g)) givers.set(g.slice(7), id);
for (const rid of REGIONS) {
  const reg = R.DB.regions[rid], bad = [];
  const page = reg.page || 'k_page_' + reg.short;
  if (!R.DB.items[page]) bad.push('ページの品が無い ' + page);
  const ba = reg.beaconAt;
  if (!ba || !MAPS[ba.map]) bad.push('beaconAt のマップが無い');
  else { const m = MAPS[ba.map], x = ba.x != null ? ba.x : ba.lx, y = ba.y != null ? ba.y : ba.ly; if (!(x >= 0 && y >= 0 && x < m.w && y < m.h)) bad.push(`beaconAt (${x},${y}) がマップの外`); }
  const callers = Object.keys(src).filter((id) => src[id].includes(`clearRegion('${rid}')`));
  if (!callers.length) bad.push(`clearRegion('${rid}') を呼ぶイベントが無い`);
  const ch = R.DB.chronicle && R.DB.chronicle[rid];
  if (!ch) bad.push('年代記の章（DB.chronicle）が無い');
  else {
    const conds = (ch.parts || []).map((p) => p.cond).filter((c) => c && typeof c === 'object' && c.choice);
    const byChoice = {};
    for (const c of conds) (byChoice[c.choice] = byChoice[c.choice] || new Set()).add(c.is);
    for (const c of Object.keys(byChoice)) if (!givers.has(c)) bad.push(`章の選択 ${c} を渡すイベントが無い`);
    if (!byChoice['ch_' + reg.short + '_write']) bad.push(`章に ch_${reg.short}_write の文が無い`);
    // どの選び方でも文が空でない
    const G = R.Game;
    for (const [c, vals] of Object.entries(byChoice)) for (const v of vals) {
      G.choices = { [c]: v }; G.flags['cleared_' + rid] = true;
      const t = ch.text;
      if (!t || !String(t).trim()) bad.push(`${c}=${v} で章の文が空`);
    }
    G.choices = {}; delete G.flags['cleared_' + rid];
  }
  ok(`${rid}（${reg.name}）: ページ ${page}・光の柱 ${ba ? ba.map : '-'}・clearRegion（${callers.join(', ') || '-'}）・年代記の章`, !bad.length, bad);
}

// ---------------------------------------------------------------- 4 通し
section('4. 通し（錠を外した 1 本の閉包）');
const ALL = { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_snow_tale: 'dragon', ch_desert_hawk: 'water', ch_desert_route: 'long', ch_marsh_accuse: 'first',
  ch_ash_bribe: 'refuse', ch_isles_wreck: 'help', ch_mine_side: 'accord', ch_star_order: 'public', ch_star_way: 'sneak' };
for (const r of REGIONS) ALL['ch_' + R.DB.regions[r].short + '_write'] = 'pain';   // どの地方にもある選び方
const full = P.closure({ variant: ALL });
{
  const cl = REGIONS.filter((r) => full.flags['cleared_' + r]);
  ok(`序章から 8 つの地方がすべて解決する（${cl.length}/8）→ ティア 8（終盤の解禁の条件: 八節の光）`, cl.length === 8, REGIONS.filter((r) => !full.flags['cleared_' + r]));
  ok('序章が終わる（prologue_done）', !!full.prologue);
  const unvisited = Object.keys(MAPS).filter((id) => !/^stub_/.test(id) && !full.visited.has(id) && id !== 'world');
  ok(`地方のマップにすべて入る（入らない ${unvisited.length}）`, !unvisited.length, unvisited.slice(0, 30));
  const G = R.Game;
  const writes = REGIONS.map((r) => 'ch_' + R.DB.regions[r].short + '_write').filter((c) => !(G.choices && G.choices[c]));
  ok('年代記の選択 ch_<地方>_write がすべて渡る', !writes.length, writes);
}

// ---------------------------------------------------------------- 5 どの順でも
section('5. どの順でも（森のあと、ほかの地方の解決なしに）');
if (QUICK) console.log('  （--quick: 省く）');
else {
  // clearRegion を持つイベントの gives から 'region:' と cleared_ の旗を一時的に抜く（その地方だけ残す）
  const saved = new Map();
  const strip = (keep) => {
    for (const [id, ev] of Object.entries(R.DB.events)) {
      const g = ev.meta && ev.meta.gives;
      if (!g) continue;
      if (!saved.has(id)) saved.set(id, g.slice());
      ev.meta.gives = saved.get(id).filter((x) => { const m = /^(?:region:|flag:cleared_)(r_\w+)$/.exec(x); return !m || m[1] === keep || m[1] === 'r_forest'; });
    }
  };
  const unstrip = () => { for (const [id, g] of saved) R.DB.events[id].meta.gives = g; };
  try {
    for (const rid of REGIONS.filter((r) => r !== 'r_forest')) {
      strip(rid);
      const r = P.closure({ variant: ALL });
      const others = REGIONS.filter((x) => x !== rid && x !== 'r_forest' && r.flags['cleared_' + x]);
      ok(`${rid}: 森だけ解決した状態から解決できる`, !!r.flags['cleared_' + rid] && !others.length, { cleared: !!r.flags['cleared_' + rid], others });
    }
  } finally { unstrip(); }
}

// ---------------------------------------------------------------- 6 体験版の錠
section('6. 体験版の錠（DB.config.slice）');
R.DB.config.slice = SLICE0; R.MapUtil.invalidate();
ok('本物の設定は体験版（slice: true）', SLICE0 === true);
{
  const open = R.DB.config.sliceOpen || [];
  ok('体験版で行ける地方は 序章・森・ワールド', JSON.stringify(open.slice().sort()) === JSON.stringify(['prologue', 'r_forest', 'world']), open);
  const leak = Object.keys(MAPS).filter((id) => !/^stub_/.test(id) && REGIONS.includes(regionOf(id)) && regionOf(id) !== 'r_forest' && R.DemoGate.isOpen(id));
  ok('ほかの 7 つの地方のマップは体験版で閉じている', !leak.length, leak.slice(0, 20));
  // 開いた地方から閉じた地方へのつなぎ目は、体験版の間は通れない（cond が偽か、gate の通せんぼ）
  const G = R.Game; R.State.newGame({ seed: 1 });
  const WS = worldReach();
  const unguarded = [];
  for (const m of Object.values(MAPS)) {
    if (!m || /^stub_/.test(m.id) || !R.DemoGate.isOpen(m.id)) continue;
    for (const p of M.portals(m, { all: true })) {
      if (!p.to || !MAPS[p.to.map] || R.DemoGate.isOpen(p.to.map)) continue;
      if (m.id === 'world' && !liveWorld({ from: 'world', where: `world@${p.x},${p.y}` }, WS)) continue;   // 体験版で歩けない前のワールドの所
      const live = p.cond == null || R.State.check(p.cond);
      const obj = (m.exits || []).concat(m.objects || []).find((o) => o.x === p.x && o.y === p.y && ((o.to && o.to.map === p.to.map) || (o.door && o.door.to && o.door.to.map === p.to.map)));
      const gated = obj && ((obj.gate && obj.gate.demo) || (obj.door && obj.door.gate && obj.door.gate.demo));
      if (live && !gated) unguarded.push(`${m.id}@${p.x},${p.y} → ${p.to.map}`);
    }
  }
  ok('体験版の範囲から外へのつなぎ目は、どれも止まる（cond が偽か体験版の通せんぼ）', !unguarded.length, unguarded);
  R.Game = G;
}

// ---------------------------------------------------------------- 7 終盤
section('7. 終盤（ビブリア島・白の大書庫・エンディング）');
{
  const finMaps = Object.keys(MAPS).filter((id) => /biblia|archive|final/.test(id));
  const finEv = Object.keys(R.DB.events).filter((id) => /biblia|archive|ending|finale_(?!done)|story_t8/.test(id) && !/_finale_done$/.test(id));
  const t8 = !!R.DB.events.story_t8;
  const have = finMaps.length && finEv.length && t8;
  if (!have) {
    const msg = `未作成: マップ ${finMaps.length}（biblia/archive）・イベント ${finEv.length}・story_t8 ${t8 ? 'あり' : 'なし'}（ティア 8 には着くが、その先の終盤とエンディングが v2 にまだ無い）`;
    pending.push(msg);
    if (STRICT) ok('終盤の中身がある', false, msg);
    else console.log('  pending ' + msg);
  } else ok(`終盤: マップ ${finMaps.join('・')}・イベント ${finEv.length}`, true);
}

R.DB.config.slice = SLICE0; R.MapUtil.invalidate();
if (pending.length) console.log(`\n未作成（pending）${pending.length}: ` + pending.join(' / '));
done('test_integration');
