#!/usr/bin/env node
// QA: 進み方の検査（V2_PLAN §3.16 の 2）。node だけ（FIELD の当たりは tools/lib/maps.js 経由）。
//
//   node v2/tools/qa/progress.js [--json] [--verbose]
//
// 1. 筋の閉包: 始まり（DB.config.start）から、地図の上で届くイベントを meta.needs がそろった順に「走らせ」（meta.gives を当てる）、
//    何も増えなくなるまで回す。ピム（送る／連れる）× 小鹿（手当て／そっと）の 4 通りで、どれも clearRegion('r_forest') と story_t1 に着く。
// 2. 必須の物: 同じ閉包を「隠し通路を通らない・寄り道のマップ（optional）に入らない・依頼（q_*）と小さな遊びを走らせない」で回しても着く。
// 3. 全マップの到達: 縦切りの錠（DB.config.slice）を外した全体の筋で、マップすべてにどこかの時点で入れる。
//    3b. 縦切りの範囲: 錠をかけたまま（本物の config）の筋は、峠の番人（guard_south / guard_north）で止まり、
//        砂漠・雪原（SLICE_OUT）のマップには入らず、それ以外のマップにはすべて入れる。
// 4. 閉じた道: cond つきの出口・扉・階段が、（錠を外した）閉包のどこかの時点で通れる（通れないまま終わる物の一覧）。
//    2b・2c・3・4 は tools/lib/routes.js と同じく、同じ R の中だけ slice を外して回し、終わったら元へ戻す（restore）。
// 5. 縦切りの閉じ方（DB.config.slice）: {slice:true} の tilePatches は見える物（崖崩れ・岩）で埋め、3 マス以内に番人（cond {slice:true}）がいる。
//    見えない壁（歩ける素材のまま solid・素材の無い legend）は 0。
'use strict';
const path = require('path');
const fs = require('fs');
const { ok, section, done } = require('../lib/testkit');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
let R = null, M = null;
/** 縦切り（slice）では峠の番人の先にある地方（3b） */
const SLICE_OUT = ['r_desert', 'r_snow', 'r_marsh', 'r_ash', 'r_isles', 'r_mine', 'r_star', 'finale'];   // finale = 終盤（ビブリア・白の大書庫・エンディングの朝の写し）
let SLICE0 = null;
/** 縦切りの錠を外す（同じ R の中だけ。本物の config のファイルは変えない） */
function sliceOff() { if (SLICE0 === null) SLICE0 = !!(R.DB.config && R.DB.config.slice); if (R.DB.config) R.DB.config.slice = false; R.MapUtil.invalidate(); }
/** sliceOff で外した錠を元へ */
function restore() { if (SLICE0 !== null && R.DB.config) R.DB.config.slice = SLICE0; SLICE0 = null; R.MapUtil.invalidate(); }
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
  // meta.warp は 1 つか一覧（行き先を選ぶトロッコ線など）
  const addWarp = (id) => { const ws = [].concat((R.DB.events[id] && R.DB.events[id].meta && R.DB.events[id].meta.warp) || []); for (const w of ws) { const d = w && M.dest({ map: w.to || w.map, spawn: w.spawn, x: w.x, y: w.y }); if (d && R.DB.maps[d.map]) extra.push({ map: d.map, x: d.x, y: d.y, lv: d.lv }); } };
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
    // T8: 8 つの地方を解決した後、宿か町に入ったとき（E17。events/final_story.js）→ 終盤（ロア → ビブリア → 白の大書庫 → エンディング）
    if (R.DB.events.story_t8 && !G.flags.story_t8 && needsOk(R.DB.events.story_t8)) { applyGives('story_t8', variant, trace, 0); ran.add('story_t8'); changed = true; }
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
  // ここから 2b・2c・3・4 は全体の筋: 縦切りの錠を外して回す（終わったら restore）
  sliceOff();
  let open = null;
  try {
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
    // 湿原（regions の slice の錠が外れていれば）: 名指しは一度で正しく／間違えてから。寄り道・依頼なしも 1 本
    if (R.DB.regions.r_marsh && !R.DB.regions.r_marsh.slice) {
      section('2d. 湿原の閉包（clearRegion(\'r_marsh\')）');
      for (const [write, restricted] of [['pain', false], ['legend', true]]) {
        const r = closure({ variant: Object.assign({}, variants[0], { ch_marsh_write: write, ch_marsh_accuse: 'first' }), restricted });
        ok(`年代記=${write}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 証拠 → 集会 → 館のメルダ → 沼の鐘 3 つ → 霧食らい → clearRegion('r_marsh')`,
          !!(r.flags.marsh_assembly_done && r.flags.marsh_melda_met && r.flags.marsh_bell_3 && r.flags.marsh_mistbeast && r.flags.cleared_r_marsh && r.flags.marsh_finale_done),
          { assembly: !!r.flags.marsh_assembly_done, melda: !!r.flags.marsh_melda_met, bell3: !!r.flags.marsh_bell_3, cleared: !!r.flags.cleared_r_marsh });
      }
    }
    // 灰の荒野（regions の slice の錠が外れていれば）: 八百長を断る／受ける × 年代記。寄り道・依頼なしも 1 本
    if (R.DB.regions.r_ash && !R.DB.regions.r_ash.slice) {
      section('2e. 灰の荒野の閉包（clearRegion(\'r_ash\')）');
      for (const [bribe, write, restricted] of [['refuse', 'pain', false], ['accept', 'rebirth', false], ['refuse', 'rebirth', true]]) {
        const r = closure({ variant: Object.assign({}, variants[0], { ch_ash_bribe: bribe, ch_ash_write: write }), restricted });
        ok(`八百長=${bribe} 年代記=${write}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 大会 5 回戦 → 優勝 → 壁画 3 つ → 番犬 → 巨獣 → 卵 → clearRegion('r_ash')`,
          !!(r.flags.ash_champion && r.flags.ash_hound && r.flags.ash_mural_3 && r.flags.ash_lavabeast && r.flags.cleared_r_ash && r.flags.ash_finale_done),
          { champion: !!r.flags.ash_champion, hound: !!r.flags.ash_hound, murals: [1, 2, 3].map((n) => !!r.flags['ash_mural_' + n]), beast: !!r.flags.ash_lavabeast, cleared: !!r.flags.cleared_r_ash });
      }
    }
    // マレア諸島（作った地方。regions の slice:'locked' は体験版の錠として残す）: 商船の選択 × 年代記。寄り道・依頼なしも 1 本
    if (R.DB.regions.r_isles && (R.DB.regions.r_isles.dungeons || []).length) {
      section('2f. マレア諸島の閉包（clearRegion(\'r_isles\')）');
      for (const [wreck, write, restricted] of [['help', 'pain', false], ['cargo', 'story', false], ['help', 'story', true]]) {
        const r = closure({ variant: Object.assign({}, variants[0], { ch_isles_wreck: wreck, ch_isles_write: write }), restricted });
        ok(`商船=${wreck} 年代記=${write}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 洞窟の貝がら → 外洋船 → 海図 → マリナの舟歌 → 幽霊船 → 船長 → 夜明け → clearRegion('r_isles')`,
          !!(r.flags.isles_shell && r.flags.isles_ship && r.flags.isles_fog_found && r.flags.isles_song_done && r.flags.isles_captain && r.flags.cleared_r_isles && r.flags.isles_finale_done),
          { shell: !!r.flags.isles_shell, ship: !!r.flags.isles_ship, fog: !!r.flags.isles_fog_found, song: !!r.flags.isles_song_done, captain: !!r.flags.isles_captain, cleared: !!r.flags.cleared_r_isles });
      }
    }
    // ガルド山地（作った地方。regions の slice:'locked' は体験版の錠として残す）: 選ぶ道（組合・鍛冶衆・仲裁）× 年代記。寄り道・依頼なしも 1 本
    if (R.DB.regions.r_mine && (R.DB.regions.r_mine.dungeons || []).length) {
      section('2g. ガルド山地の閉包（clearRegion(\'r_mine\')）');
      for (const [side, write, restricted] of [['guild', 'pain', false], ['smiths', 'story', false], ['accord', 'pain', false], ['smiths', 'story', true]]) {
        const r = closure({ variant: Object.assign({}, variants[0], { ch_mine_side: side, ch_mine_write: write }), restricted });
        ok(`道=${side} 年代記=${write}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 3 人の救出 → 誓いのハンマー → 岩戸 → 集会所 → 番人 → 炉の火 → clearRegion('r_mine')`,
          !!(r.flags.mine_rescued_all && r.flags.mine_door_seen && r.flags.mine_choice && r.flags.mine_warden_done && r.flags.cleared_r_mine && r.flags.mine_finale_done),
          { rescued: !!r.flags.mine_rescued_all, door: !!r.flags.mine_door_seen, choice: !!r.flags.mine_choice, warden: !!r.flags.mine_warden_done, cleared: !!r.flags.cleared_r_mine });
      }
    }
    // オルビス高原（作った地方。regions の slice:'locked' は体験版の錠として残す）: 命令書（公に・黙る）× 年代記。寄り道・依頼なしも 1 本
    if (R.DB.regions.r_star && (R.DB.regions.r_star.dungeons || []).length) {
      section('2h. オルビス高原の閉包（clearRegion(\'r_star\')）');
      for (const [order, write, restricted] of [['public', 'pain', false], ['silent', 'story', false], ['silent', 'pain', true]]) {
        const r = closure({ variant: Object.assign({}, variants[0], { ch_star_order: order, ch_star_write: write, ch_star_way: 'sneak' }), restricted });
        ok(`命令書=${order} 年代記=${write}${restricted ? '（隠し通路・寄り道・依頼なし）' : ''}: 学長の伝言 → 潜入の準備 → 消灯後の学院 → 保管庫の星図 → 学長 → 塔 → 番人 → 星食らい → 名を読む → clearRegion('r_star')`,
          !!(r.flags.star_message && r.flags.star_ready && r.flags.star_night_seen && r.flags.star_chart_got && r.flags.star_octavia_done && r.flags.star_tower_open && r.flags.star_sentinel && r.flags.star_stareater && r.flags.cleared_r_star && r.flags.star_finale_done),
          { message: !!r.flags.star_message, ready: !!r.flags.star_ready, night: !!r.flags.star_night_seen, chart: !!r.flags.star_chart_got, tower: !!r.flags.star_tower_open, sentinel: !!r.flags.star_sentinel, eater: !!r.flags.star_stareater, cleared: !!r.flags.cleared_r_star });
      }
    }
    // 終盤（T8 → ロア → ファロスの船 → ビブリア → 白の大書庫 1〜6 階 → エンディング）: 8 地方を解決した全体の筋の続き
    if (R.DB.events.story_t8) {
      section('2i. 終盤の閉包（T8 → エンディング）');
      const ALL8 = Object.assign({}, variants[0], { ch_snow_tale: 'dragon', ch_desert_hawk: 'water', ch_desert_route: 'long', ch_marsh_accuse: 'first', ch_ash_bribe: 'refuse',
        ch_isles_wreck: 'help', ch_mine_side: 'accord', ch_star_order: 'public', ch_star_way: 'sneak', ch_lazaro_write: 'father' });
      for (const rs of ['forest', 'desert', 'snow', 'marsh', 'isles', 'mine', 'ash', 'star']) ALL8['ch_' + rs + '_write'] = 'pain';
      const r = closure({ variant: ALL8 });
      const need = ['story_t8', 'st_fine_reveal', 'final_roa', 'final_open', 'final_sailed', 'final_arrived', 'final_golem', 'final_rowell', 'final_shades', 'final_lazaro', 'final_nemrea1', 'game_clear'];
      const miss = need.filter((f) => !r.flags[f]);
      ok(`T8 → 終盤のロア → ファロスの船 → ビブリア → 大書庫 1〜6 階（本の巨人・封印の扉・三つの影・ラザロ・虚ろの王）→ エンディング（game_clear）`, !miss.length, miss);
      const fin = Object.keys(R.DB.maps).filter((id) => R.DB.maps[id].region === 'finale');
      const unv = fin.filter((id) => !r.visited.has(id));
      ok(`終盤のマップ ${fin.length} 枚にすべて入る（エンディングの朝の写しを含む）`, !unv.length, unv);
      report.finale = { miss, unvisited: unv };
    }
    section('3. 全マップの到達（縦切りの錠を外した全体の筋）');
    open = closure({ variant: Object.assign({}, variants[0], { ch_snow_tale: 'dragon', ch_snow_write: 'pain', ch_desert_hawk: 'water', ch_desert_route: 'long', ch_desert_write: 'pain' }) });
    const maps = M.sliceMaps();
    const miss = maps.filter((m) => !open.visited.has(m));
    ok(`マップ ${maps.length} 枚すべてに入れる`, miss.length === 0, miss);
    report.unreached = miss;
    section('4. 閉じた道（cond つきの出入り口）');
    const never = [];
    for (const mid of maps) {
      if (!open.visited.has(mid)) continue;
      for (const p of M.portals(mid, { all: true })) {
        if (p.cond == null) continue;
        if (!open.portalsOpen.has(mid + ':' + p.x + ',' + p.y)) never.push(`${mid} ${p.kind} ${p.x},${p.y} → ${p.to.map} cond ${JSON.stringify(p.cond)}`);
      }
    }
    // 縦切りで閉じたままにする物（slice）は除く
    const neverReal = never.filter((s) => !/"slice":true/.test(s));
    ok('cond つきの出入り口は、筋のどこかで通れるようになる', neverReal.length === 0, neverReal);
    report.neverOpen = neverReal;
  } finally { restore(); }
  section('3b. 縦切りの範囲（slice のまま: 峠の番人で止まる）');
  ok('restore で DB.config.slice が戻る', R.DB.config.slice === true);
  const demo = M.sliceMaps();
  const outReached = demo.filter((m) => full.visited.has(m) && SLICE_OUT.includes(R.DB.maps[m].region));
  // エリア切り替えのフィールド（kind 'field'）があるときは、前のワールド（kind 'world'）は体験版では歩かない（峠の先にだけつながる）
  const hasAreas = Object.values(R.DB.maps).some((m) => m && m.kind === 'field');
  const inMissed = demo.filter((m) => !full.visited.has(m) && !SLICE_OUT.includes(R.DB.maps[m].region) && !(hasAreas && R.DB.maps[m].kind === 'world'));
  ok(`縦切りの筋は ${SLICE_OUT.join('・')} のマップに入らない`, outReached.length === 0, outReached);
  ok('縦切りの範囲のマップにはすべて入れる', inMissed.length === 0, inMissed);
  const world = R.DB.maps.world;
  const guards = ['guard_south', 'guard_north'].map((id) => (world && world.npcs || []).find((n) => n.id === id));
  ok('峠の番人（guard_south / guard_north）が縦切りのときだけ立つ（cond {slice:true}）', guards.every((g) => g && g.cond && g.cond.slice === true && R.State.check(g.cond)));
  report.demo = { outReached, inMissed };
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
module.exports = { init, closure: (o) => { if (!R) init(); return closure(o); }, reachAll, SLICE_OUT };
if (require.main === module) main();
