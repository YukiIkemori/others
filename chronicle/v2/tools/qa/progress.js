#!/usr/bin/env node
// QA: 進み方の検査（V2_PLAN §3.16 の 2）。node だけ（FIELD の当たりは tools/lib/maps.js 経由）。
//
//   node v2/tools/qa/progress.js [--json] [--verbose]
//
// 1. 筋の閉包: 始まり（DB.config.start）から、地図の上で届くイベントを meta.needs がそろった順に「走らせ」（meta.gives を当てる）、
//    何も増えなくなるまで回す。ピム（送る／連れる）× 小鹿（手当て／そっと）の 4 通りで、どれも clearRegion('r_forest') と story_t1 に着く。
// 2. 必須の物: 同じ閉包を「隠し通路を通らない・寄り道のマップ（optional）に入らない・依頼（q_*）と小さな遊びを走らせない」で回しても着く。
// 3. 全マップの到達: 縦切りのマップすべてに、どこかの時点で入れる。
// 4. 閉じた道: cond つきの出口・扉・階段が、閉包のどこかの時点で通れる（通れないまま終わる物の一覧）。
// 5. 縦切りの閉じ方（DB.config.slice）: {slice:true} の tilePatches は見える物（崖崩れ・岩）で埋め、3 マス以内に番人（cond {slice:true}）がいる。
//    見えない壁（歩ける素材のまま solid・素材の無い legend）は 0。
'use strict';
const path = require('path');
const fs = require('fs');
const { ok, section, done } = require('../lib/testkit');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
let R = null, M = null;
/** R を渡すと、その R で閉包を回す（check_springs・sim_zones --segments が同じ R で使う） */
function init(r) { R = r || require('../lib/load')({ quiet: true }); M = require('../lib/maps').create(R); return { R, M }; }
const K = (x, y, lv) => x + ',' + y + ',' + (lv || 0);

/** 今の状態で、start から届く全マスをマップごとに → Map(mapId → Set('x,y,lv')) */
function reachAll(start, o) {
  o = o || {};
  const out = new Map();
  const seenNode = new Set();
  const q = [start].concat(o.extra || []);
  const secretBlock = (map) => (x, y) => { const c = R.MapUtil.cell(map, x, y); return !!(c && c.secret); };
  while (q.length) {
    const n = q.shift();
    const nk = n.map + ':' + K(n.x, n.y, n.lv);
    if (seenNode.has(nk)) continue;
    seenNode.add(nk);
    const map = R.DB.maps[n.map];
    if (!map) continue;
    if (!out.has(n.map)) out.set(n.map, new Set());
    const set = out.get(n.map);
    if (set.has(K(n.x, n.y, n.lv)) && n !== start && !o.full) continue;
    const res = M.bfs(map, [n], { blocked: o.noSecrets ? secretBlock(map) : null, npcs: true });
    for (const k of res.dist.keys()) set.add(k);
    for (const h of res.portals) {
      const t = M.dest(h.p.to);
      if (!t) continue;
      if (o.noOptional && R.DB.maps[t.map] && R.DB.maps[t.map].optional) continue;
      q.push(t);
    }
  }
  return out;
}

function placeReachable(reach, p) {
  const set = reach.get(p.map);
  if (!set) return false;
  if (p.kind === 'enter') return true;
  return M.standCells(p.map, p).some((c) => set.has(K(c.x, c.y, c.lv)));
}

function needsOk(ev) {
  const G = R.Game;
  for (const n of (ev.meta && ev.meta.needs) || []) {
    const [k, v] = n.split(':');
    if (k === 'flag' && !G.flags[v]) return false;
    if ((k === 'cleared' || k === 'region') && !(G.cleared && G.cleared[v])) return false;
  }
  return true;
}

function applyGives(id, variant, trace, depth) {
  const ev = R.DB.events[id];
  if (!ev || depth > 6) return;
  const G = R.Game;
  for (const gv of (ev.meta && ev.meta.gives) || []) {
    const i = gv.indexOf(':');
    const k = i < 0 ? gv : gv.slice(0, i), v = i < 0 ? '' : gv.slice(i + 1);
    if (k === 'flag' || k === 'lore') G.flags[v] = true;
    else if (k === 'item') { const it = v.split('|')[0]; G.items[it] = (G.items[it] || 0) + 1; }
    else if (k === 'lead') G.leads[v] = G.leads[v] || { got: 0, pin: false, seen: false };
    else if (k === 'var') { const m = /^(\w+)\+(\d+)$/.exec(v); if (m) G.vars[m[1]] = (G.vars[m[1]] || 0) + +m[2]; else G.vars[v] = (G.vars[v] || 0) + 1; }
    else if (k === 'choice') G.choices[v] = variant[v] || G.choices[v] || 'x';
    else if (k === 'region') { G.cleared[v] = true; G.flags['cleared_' + v] = true; G.tier = Math.max(G.tier || 0, 1); G.pendingTier = 1; }
    else if (k === 'hero') { if (!G.chars.hero) R.State.setHero(R.DB.config.defaultHero); }
  }
  // 選択の後の旗（イベントの中で立つ物）: ピムを連れると forest_pim_guest、送ると野営地
  if (id === 'verda_pim' && variant.ch_forest_pim === 'take') G.flags.forest_pim_guest = true;
  if (id === 'verda_pim') { G.flags.forest_fawn_done = true; G.choices.ch_forest_fawn = variant.ch_forest_fawn; }
  if (id === 'elder_pim_home') G.flags.forest_pim_guest = false;
  if (id === 'verda_hollow' && G.flags.forest_got_flute) G.flags.forest_roy_out = true;
  if (trace) trace.push(id);
  for (const c of (ev.meta && ev.meta.calls) || []) if (needsOk(R.DB.events[c] || {})) applyGives(c, variant, trace, depth + 1);
  R.MapUtil.invalidate();
}

/** 閉包を回す。o: {variant, restricted} → {trace, final:{…}, visited:Set(map), portalsOpen:Set} */
function closure(o) {
  o = o || {};
  const variant = o.variant || {};
  R.State.newGame({ seed: 1 });
  const G = R.Game;
  R.MapUtil.invalidate();
  const s = R.DB.config.start;
  const sp = M.dest({ map: s.map, spawn: s.spawn });
  const start = { map: sp.map, x: sp.x, y: sp.y, lv: sp.lv };
  const ran = new Set();
  const trace = [];
  if (s.event) { applyGives(s.event, variant, trace, 0); ran.add(s.event); }
  // イベントの warp（meta.warp）で着く所も、そこから歩ける始まりに足す（出口の無い夜の村・野営地など）
  const extra = [];
  const addWarp = (id) => { const w = R.DB.events[id] && R.DB.events[id].meta && R.DB.events[id].meta.warp; const d = w && M.dest({ map: w.to || w.map, spawn: w.spawn, x: w.x, y: w.y }); if (d && R.DB.maps[d.map]) extra.push({ map: d.map, x: d.x, y: d.y, lv: d.lv }); };
  const visited = new Set();
  const portalsOpen = new Set();
  const optionalEv = (id) => /^(q_|mini_)/.test(id) || /_quest|_herb|_acorn|_song_|_letters|_fireflies|_delivery|_lamp/.test(id);
  for (let iter = 0; iter < 60; iter++) {
    const reach = reachAll(start, { noSecrets: o.restricted, noOptional: o.restricted, extra });
    for (const [m, set] of reach) if (set.size) visited.add(m);
    for (const mid of M.sliceMaps()) for (const p of M.portals(mid, { all: true })) if (p.cond != null && M.portals(mid).some((q) => q.x === p.x && q.y === p.y)) portalsOpen.add(mid + ':' + p.x + ',' + p.y);
    let changed = false;
    for (const id of Object.keys(R.DB.events)) {
      if (ran.has(id)) continue;
      const ev = R.DB.events[id];
      if (o.restricted && optionalEv(id)) continue;
      if (!needsOk(ev)) continue;
      const places = M.eventPlaces(id);
      if (!places.length) continue;
      const pl = places.find((p) => (!o.restricted || !(R.DB.maps[p.map] || {}).optional) && placeReachable(reach, p));
      if (!pl) continue;
      ran.add(id);
      if (ev.meta && ev.meta.warp) { addWarp(id); changed = true; }
      if (!((ev.meta && ev.meta.gives) || []).length && !((ev.meta && ev.meta.calls) || []).length) continue;
      applyGives(id, variant, trace, 0);
      changed = true;
    }
    // 話しかけ直し: 走らせたイベントが呼ぶ（meta.calls）イベントの needs が後でそろったら、それも走らせる（村長にもう一度話す、など）
    for (const id of [...ran]) {
      for (const c of (R.DB.events[id] && R.DB.events[id].meta && R.DB.events[id].meta.calls) || []) {
        if (ran.has(c) || !R.DB.events[c] || !needsOk(R.DB.events[c]) || !(R.DB.events[c].meta && R.DB.events[c].meta.needs || []).length) continue;
        if (o.restricted && optionalEv(c)) continue;
        ran.add(c);
        applyGives(c, variant, trace, 0);
        const walk = (e, d) => { addWarp(e); if (d < 6) for (const cc of (R.DB.events[e] && R.DB.events[e].meta && R.DB.events[e].meta.calls) || []) if (needsOk(R.DB.events[cc] || {})) walk(cc, d + 1); };
        walk(c, 0);
        changed = true;
      }
    }
    // T1: 宿か町に入ったとき（E17）
    if (G.cleared.r_forest && !G.flags.story_t1 && R.DB.events.story_t1 && reach.has('fern')) { applyGives('story_t1', variant, trace, 0); ran.add('story_t1'); changed = true; }
    if (!changed) break;
  }
  return { trace, cleared: !!G.cleared.r_forest, t1: !!G.flags.story_t1, visited, portalsOpen, ran, flags: Object.assign({}, G.flags), prologue: !!G.flags.prologue_done };
}

function sliceClosure() {
  const bad = [], info = [];
  for (const id of M.sliceMaps()) {
    const m = R.DB.maps[id];
    (m.tilePatches || []).forEach((p, i) => {
      const c = p.cond;
      const isSlice = c && typeof c === 'object' && !Array.isArray(c) && c.slice === true;
      if (!isSlice) return;
      const rect = p.rect || [p.x, p.y, 1, 1];
      const chars = new Set(p.rows ? p.rows.join('').replace(/ /g, '') : p.ch);
      for (const ch of chars) {
        const L = m.legend[ch];
        if (!L) { bad.push(`${id} patch ${i}: '${ch}' is not in the legend`); continue; }
        if (L.walk !== false && !L.solid) bad.push(`${id} patch ${i}: '${ch}' (${L.mat}) is walkable — does not close`);
        if (!L.mat || (R.DB.materials && !R.DB.materials[L.mat])) bad.push(`${id} patch ${i}: '${ch}' material ${L.mat} unknown (invisible wall?)`);
        // 周りの床と同じ素材の壁は「見えない壁」
        const around = new Set();
        for (let y = rect[1] - 1; y <= rect[1] + rect[3]; y++) for (let x = rect[0] - 1; x <= rect[0] + rect[2]; x++) {
          const ins = x >= rect[0] && y >= rect[1] && x < rect[0] + rect[2] && y < rect[1] + rect[3];
          if (ins) continue;
          const cc = R.MapUtil.cell(m, x, y);
          if (cc && cc.walk !== false && !cc.solid) around.add(cc.mat);
        }
        if (around.has(L.mat)) bad.push(`${id} patch ${i}: '${ch}' uses the floor material ${L.mat} (invisible wall)`);
      }
      const guard = (m.npcs || []).find((n) => n.cond && typeof n.cond === 'object' && n.cond.slice === true && n.x >= rect[0] - 3 && n.x < rect[0] + rect[2] + 3 && n.y >= rect[1] - 3 && n.y < rect[1] + rect[3] + 3);
      const sign = (m.objects || []).find((o) => (o.type === 'sign' || o.type === 'examine' || o.type === 'prop') && o.x >= rect[0] - 3 && o.x < rect[0] + rect[2] + 3 && o.y >= rect[1] - 3 && o.y < rect[1] + rect[3] + 3);
      if (!guard && !sign) bad.push(`${id} patch ${i} at ${rect.join(',')}: no guard (npc cond {slice:true}) or sign within 3 cells`);
      info.push(`${id} ${rect.join(',')} ${[...chars].map((ch) => m.legend[ch] && m.legend[ch].mat).join('/')} guard=${guard ? guard.id : '-'}`);
    });
  }
  return { bad, info };
}

function main() {
  init();
  const report = {};
  section('1. 筋の閉包（4 通りの選択）');
  const variants = [];
  for (const pim of ['send', 'take']) for (const fawn of ['heal', 'leave']) variants.push({ ch_forest_pim: pim, ch_forest_fawn: fawn, ch_forest_write: 'pain' });
  let full = null;
  for (const v of variants) {
    const r = closure({ variant: v });
    if (!full) full = r;
    const tag = `pim=${v.ch_forest_pim} fawn=${v.ch_forest_fawn}`;
    ok(`${tag}: prologue_done`, r.prologue, r.trace.slice(-8));
    ok(`${tag}: clearRegion('r_forest') に着く`, r.cleared, r.trace.slice(-10));
    ok(`${tag}: story_t1 に着く`, r.t1);
    report[tag] = { events: r.trace.length, cleared: r.cleared, t1: r.t1 };
    if (VERBOSE) console.log('   ' + r.trace.join(' → '));
  }
  section('2. 必須の物（隠し通路・寄り道・依頼・小さな遊びなし）');
  for (const v of variants.slice(0, 4)) {
    const r = closure({ variant: v, restricted: true });
    const tag = `pim=${v.ch_forest_pim} fawn=${v.ch_forest_fawn}`;
    ok(`${tag}: 隠し通路と寄り道なしで clearRegion と story_t1`, r.cleared && r.t1, { cleared: r.cleared, t1: r.t1, last: r.trace.slice(-6) });
  }
  // 縦切りの後に作った地方: 雪原（regions の slice の錠が外れていれば）。昔話の選び方 3 通り（寄り道ありを 1 本・なしを 2 本）
  if (R.DB.regions.r_snow && !R.DB.regions.r_snow.slice) {
    section('2b. 雪原の閉包（clearRegion(\'r_snow\')）');
    for (const [tale, restricted] of [['dragon', false], ['hunter', true], ['fire_child', true]]) {
      const r = closure({ variant: Object.assign({}, variants[0], { ch_snow_tale: tale, ch_snow_write: 'pain' }), restricted });
      ok(`昔話=${tale}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 籠城 → 夜明け → 峰 → clearRegion('r_snow')`, !!(r.flags.snow_siege_done && r.flags.snow_dawn && r.flags.cleared_r_snow), { siege: !!r.flags.snow_siege_done, dawn: !!r.flags.snow_dawn, cleared: !!r.flags.cleared_r_snow });
    }
  }
  // 砂漠（regions の slice の錠が外れていれば）: 鷹団 3 通り × 近道／遠回り、寄り道あり／なし
  if (R.DB.regions.r_desert && !R.DB.regions.r_desert.slice) {
    section('2c. 砂漠の閉包（clearRegion(\'r_desert\')）');
    for (const hawk of ['fight', 'water', 'pay']) for (const route of ['short', 'long']) for (const restricted of [false, true]) {
      if (restricted && hawk !== 'water') continue;
      const r = closure({ variant: Object.assign({}, variants[0], { ch_desert_hawk: hawk, ch_desert_route: route, ch_desert_write: 'pain' }), restricted });
      ok(`鷹団=${hawk} 道=${route}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 隊商 → 王墓 → 砂の王 → clearRegion('r_desert')`,
        !!(r.flags.desert_camp3_done && r.flags.desert_worm && r.flags.desert_king && r.flags.cleared_r_desert && r.flags.desert_finale_done),
        { camp3: !!r.flags.desert_camp3_done, worm: !!r.flags.desert_worm, king: !!r.flags.desert_king, cleared: !!r.flags.cleared_r_desert });
    }
  }
  section('3. 全マップの到達');
  const maps = M.sliceMaps();
  const miss = maps.filter((m) => !full.visited.has(m));
  ok(`縦切りのマップ ${maps.length} 枚すべてに入れる`, miss.length === 0, miss);
  report.unreached = miss;
  section('4. 閉じた道（cond つきの出入り口）');
  const never = [];
  for (const mid of maps) {
    if (!full.visited.has(mid)) continue;
    for (const p of M.portals(mid, { all: true })) {
      if (p.cond == null) continue;
      if (!full.portalsOpen.has(mid + ':' + p.x + ',' + p.y)) never.push(`${mid} ${p.kind} ${p.x},${p.y} → ${p.to.map} cond ${JSON.stringify(p.cond)}`);
    }
  }
  // 縦切りで閉じたままにする物（slice）は除く
  const neverReal = never.filter((s) => !/"slice":true/.test(s));
  ok('cond つきの出入り口は、筋のどこかで通れるようになる', neverReal.length === 0, neverReal);
  report.neverOpen = neverReal;
  section('5. 縦切りの閉じ方（DB.config.slice）');
  ok('DB.config.slice = true', R.DB.config.slice === true);
  const sc = sliceClosure();
  ok(`slice の閉じ方 ${sc.info.length} か所: 見える物で埋め、番人か看板がそばにいる`, sc.info.length > 0 && sc.bad.length === 0, sc.bad);
  if (VERBOSE) sc.info.forEach((s) => console.log('   ' + s));
  report.slice = sc;
  if (argv.includes('--json')) {
    const f = path.join(__dirname, '..', '..', 'design', 'qa', 'progress.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(report, null, 1));
  }
  done('progress');
}
module.exports = { init, closure: (o) => { if (!R) init(); return closure(o); }, reachAll };
if (require.main === module) main();
