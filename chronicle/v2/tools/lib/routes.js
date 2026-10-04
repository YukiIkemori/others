// QA: ダンジョンの道のりと「泉から泉の区間」（V2_PLAN §3.16 の 3「check_springs」・6「sim_zones --segments」、WORLD_REDESIGN §6.2）。
//   const { dungeonRoutes } = require('./routes');
//   dungeonRoutes(R) → [{id, total, cells:[{map,x,y}], springs:[{id,map,at,detour,frac}], rests:[i…], segments:[{from, to, steps, battles, byZone, zones}]}]
// 道のりは tools/lib/maps.js の FIELD の当たりで引く。地図の形は、筋の閉包（tools/qa/progress.js）の最後から、そのダンジョンを
// 初めて歩くときに立っていない旗を下ろした形（歌の石の前なら森は道を変える）。区間ごとの戦闘の数は、区間のマスの出現表の率から見込む。
'use strict';

const DUNGEONS = [
  { id: 'lighthouse', start: { map: 'lighthouse_1', spawn: 'entrance' }, goal: { map: 'lighthouse_3', ev: 'lighthouse_3_boss' },
    unset: ['prologue_boss', 'prologue_done', 'prologue_fine'], bosses: [['lighthouse_3', 'lighthouse_3_boss']] },
  { id: 'verda', start: { map: 'verda_1', spawn: 'south' }, goal: { map: 'verda_2', ev: 'verda_moth' },
    unset: ['forest_moth', 'forest_found_ben', 'forest_boss', 'cleared_r_forest', 'forest_stone_a', 'forest_stone_b', 'forest_stone_c'], vars: { forest_verses: 0 },
    bosses: [['verda_2', 'verda_moth'], ['verda_1', 'verda_ben']] },
  { id: 'elder', start: { map: 'elder_1', spawn: 'south' }, goal: { map: 'elder_2', ev: 'elder_boss' },
    unset: ['forest_boss', 'cleared_r_forest', 'forest_finale_done', 'forest_fine'], bosses: [['elder_2', 'elder_boss']] },
  { id: 'well', start: { map: 'well', spawn: 'entrance' }, goal: { map: 'well', far: true }, unset: [], bosses: [] },
  // 砂漠（desert_*.js）: 王墓（流砂は砂もぐりの後の形・封じの扉は開いた形で道を引く）・沈んだ神殿・鷹団のアジト・岩場・古い野営跡
  // 砂漠は縦切り（DB.config.slice）の外: open で閉包を slice なしで回し、砂漠の選び方（variant）を足す
  { id: 'tomb', open: true, variant: { ch_desert_hawk: 'water', ch_desert_route: 'long', ch_desert_write: 'pain' }, start: { map: 'desert_tomb_1', spawn: 'entrance' }, goal: { map: 'desert_tomb_3', ev: 'desert_tomb_king' },
    unset: ['desert_king', 'cleared_r_desert', 'desert_finale_done'], bosses: [['desert_tomb_3', 'desert_tomb_king'], ['desert_tomb_2', 'desert_tomb_worm']] },
  { id: 'temple', open: true, variant: { ch_desert_hawk: 'water', ch_desert_route: 'long' }, start: { map: 'desert_temple_1', spawn: 'entrance' }, goal: { map: 'desert_temple_2', ev: 'desert_temple_guard' },
    unset: ['desert_temple_guard'], bosses: [['desert_temple_2', 'desert_temple_guard']] },
  { id: 'hawks', open: true, variant: { ch_desert_hawk: 'fight', ch_desert_route: 'long' }, start: { map: 'desert_hawks_1', spawn: 'mouth' }, goal: { map: 'desert_hawks_2', ev: 'desert_hawks_boss' },
    unset: ['desert_hawkhold_done'], bosses: [['desert_hawks_2', 'desert_hawks_boss']] },
  { id: 'rocks', start: { map: 'desert_rocks', spawn: 'mouth' }, goal: { map: 'desert_rocks', far: true }, unset: [], bosses: [] },
  { id: 'oldcamp', start: { map: 'desert_oldcamp', spawn: 'road' }, goal: { map: 'desert_oldcamp', far: true }, unset: [], bosses: [] },
  // 湿原（marsh_*.js）: 霧の館（2 階、中ボスは音楽室の人形の楽団）・鐘沈みの沼（1 階。水の引いた形で道を引く = 鐘 3 つを鳴らした後、霧食らいの前）
  { id: 'manor', open: true, variant: { ch_marsh_accuse: 'first', ch_marsh_write: 'pain' }, start: { map: 'marsh_manor_1', spawn: 'entrance' }, goal: { map: 'marsh_manor_2', ev: 'manor_band' },
    unset: ['marsh_dolls', 'marsh_melda_met', 'marsh_mistbeast', 'cleared_r_marsh', 'marsh_finale_done'], bosses: [['marsh_manor_2', 'manor_band']] },
  { id: 'bog', open: true, variant: { ch_marsh_accuse: 'first', ch_marsh_write: 'pain' }, start: { map: 'marsh_bog', spawn: 'entrance' }, goal: { map: 'marsh_bog', ev: 'bog_mistbeast' },
    unset: ['marsh_mistbeast', 'cleared_r_marsh', 'marsh_finale_done'], bosses: [['marsh_bog', 'bog_mistbeast']] },
  // 灰の荒野（ash_*.js）: 灰の火山（1 階と火口。溶岩の堰は北の渡り場が冷えた形 = レバーを 1 度引いた後で道を引く。中ボスは東の部屋の炎の番犬）
  { id: 'volcano', open: true, variant: { ch_ash_bribe: 'refuse', ch_ash_write: 'pain' }, start: { map: 'ash_volcano_1', spawn: 'entrance' }, goal: { map: 'ash_volcano_2', ev: 'ash_crater_beast' },
    unset: ['ash_hound', 'ash_lavabeast', 'ash_egg', 'ash_fine_seen', 'cleared_r_ash', 'ash_finale_done'], bosses: [['ash_volcano_2', 'ash_crater_beast'], ['ash_volcano_1', 'volcano_hound']] },
  // 雪原（snow_*.js）: 雪の林・白竜の峰（氷の壁は冬至の火でとけた形・巨人の後の形で道を引く）・つららの回廊・オーロラの崖・氷に閉じた帆船
  // 雪原も縦切りの外（北の番人 guard_north が塞ぐ）: 砂漠と同じく open で閉包を slice なしで回す
  { id: 'snow_woods', open: true, variant: { ch_snow_tale: 'dragon' }, start: { map: 'snow_woods', spawn: 'south' }, goal: { map: 'snow_woods', far: true }, unset: [], bosses: [] },
  { id: 'peak', open: true, variant: { ch_snow_tale: 'dragon' }, start: { map: 'peak_1', spawn: 'south' }, goal: { map: 'peak_top', ev: 'peak_neve' },
    unset: ['snow_neve', 'snow_finale_done', 'cleared_r_snow'], bosses: [['peak_top', 'peak_neve'], ['peak_1', 'peak_giant']] },
  { id: 'icicle', open: true, variant: { ch_snow_tale: 'dragon' }, start: { map: 'icicle_1', spawn: 'entrance' }, goal: { map: 'icicle_2', ev: 'icicle_guard' },
    unset: ['snow_icicle_guard'], bosses: [['icicle_2', 'icicle_guard']] },
  { id: 'aurora', open: true, variant: { ch_snow_tale: 'dragon' }, start: { map: 'aurora', spawn: 'south' }, goal: { map: 'aurora', far: true }, unset: [], bosses: [] },
  { id: 'frost_ship', open: true, variant: { ch_snow_tale: 'dragon' }, start: { map: 'frost_ship_1', spawn: 'entrance' }, goal: { map: 'frost_ship_2', ev: 'frost_ship_boss' },
    unset: ['snow_admiral'], bosses: [['frost_ship_2', 'frost_ship_boss']] },
  // クリア後の忘却の底（maps/oblivion.js）: ビブリアの広場の階段から地下 1〜5 階。中ボスは 3 階の魔王の残影、裏ボスは 5 階の円環竜（泉はその前）
  { id: 'oblivion', open: true, start: { map: 'oblivion_1', spawn: 'from_town' }, goal: { map: 'oblivion_5', ev: 'oblivion_5_ouroboros' },
    unset: ['oblivion_echo', 'oblivion_ouroboros'], bosses: [['oblivion_5', 'oblivion_5_ouroboros'], ['oblivion_3', 'oblivion_3_echo']] },
];

let SLICE0 = null;
function prepare(R, d) {
  const P = require('../qa/progress');
  P.init(R);
  if (SLICE0 === null) SLICE0 = !!(R.DB.config && R.DB.config.slice);
  if (R.DB.config) R.DB.config.slice = d.open ? false : SLICE0;   // 縦切りの外の地方は、錠を外した形で道を引く（本物の config は変えない: 同じ R の中だけ）
  P.closure({ variant: Object.assign({ ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain' }, d.variant || {}) });
  const G = R.Game;
  for (const f of d.unset || []) delete G.flags[f];
  if ((d.unset || []).includes('cleared_r_forest')) { delete G.cleared.r_forest; G.tier = 0; }
  if ((d.unset || []).includes('cleared_r_desert')) delete G.cleared.r_desert;
  if ((d.unset || []).includes('cleared_r_marsh')) delete G.cleared.r_marsh;
  if ((d.unset || []).includes('cleared_r_snow')) delete G.cleared.r_snow;
  if ((d.unset || []).includes('cleared_r_ash')) delete G.cleared.r_ash;
  Object.assign(G.vars, d.vars || {});
  R.MapUtil.invalidate();
  return G;
}

/** prepare で外した縦切りの錠を元へ */
function restore(R) { if (SLICE0 !== null && R.DB.config) R.DB.config.slice = SLICE0; R.MapUtil.invalidate(); }

function dungeonRoutes(R, o) {
  o = o || {};
  const M = require('./maps').create(R);
  const out = [];
  for (const d of DUNGEONS) {
    if (o.only && !o.only.includes(d.id)) continue;
    prepare(R, d);
    const st = M.dest(d.start);
    let goalCells;
    if (d.goal.far) {
      const res = M.bfs(d.goal.map, [st]);
      let best = null;
      for (const [k, v] of res.dist) if (!best || v > best.d) { const [x, y, lv] = k.split(',').map(Number); best = { x, y, lv, d: v }; }
      goalCells = (m) => (m === d.goal.map ? [best] : []);
    } else {
      const places = M.eventPlaces(d.goal.ev, { all: true }).filter((p) => p.map === d.goal.map);
      goalCells = (m) => (m === d.goal.map ? places.flatMap((p) => M.standCells(m, p)) : []);
    }
    const pl = M.plan({ map: st.map, x: st.x, y: st.y, lv: st.lv }, goalCells, { avoidMap: (m) => !R.DB.maps[m] || R.DB.maps[m].kind !== 'dungeon' });
    if (!pl) { out.push({ id: d.id, def: d, error: 'no route' }); continue; }
    const cells = [];
    for (const leg of pl.legs) { const p = M.path(leg.res, leg.to.x, leg.to.y, leg.to.lv) || []; for (const c of p) cells.push({ map: leg.map, x: c.x, y: c.y }); }
    const total = cells.length - 1;
    const springs = [];
    for (const mid of [...new Set(cells.map((c) => c.map))]) for (const s of M.springs(mid)) {
      const res = M.bfs(mid, M.standCells(mid, { kind: 'obj', ref: s }).filter((c) => R.Field._walkable(R.DB.maps[mid], c.x, c.y, null, c.lv || 0)), { maxDist: 40 });
      let bi = -1, bd = 1e9;
      cells.forEach((c, i) => { if (c.map !== mid) return; const v = res.get(c.x, c.y, 0); if (v != null && v < bd) { bd = v; bi = i; } });
      springs.push({ map: mid, id: s.id, at: bi, detour: bd, frac: bi >= 0 ? bi / total : null });
    }
    const onRoute = springs.filter((s) => s.at >= 0 && s.detour <= 12).sort((a, b) => a.at - b.at);
    const rests = [0].concat(onRoute.map((s) => s.at)).concat([total]);
    const segments = [];
    for (let i = 1; i < rests.length; i++) {
      const a = rests[i - 1], b = rests[i];
      if (b <= a) continue;
      // 区間のマス（泉への寄り道の歩数も往復で足す）
      const seg = cells.slice(a, b + 1);
      const byMap = {};
      for (const c of seg) (byMap[c.map] = byMap[c.map] || []).push(c);
      let battles = 0;
      const byZone = {};
      for (const [mid, list] of Object.entries(byMap)) {
        const e = M.expectBattles(mid, list);
        battles += e.total;
        for (const [z, n] of Object.entries(e.byZone)) byZone[z] = (byZone[z] || 0) + n;
      }
      const detour = i < rests.length - 1 ? (onRoute[i - 1] ? onRoute[i - 1].detour * 2 : 0) : 0;
      segments.push({ from: i === 1 ? 'entrance' : onRoute[i - 2].id, to: i === rests.length - 1 ? (d.goal.far ? 'end' : d.goal.ev) : onRoute[i - 1].id, steps: b - a + detour, battles, byZone });
    }
    out.push({ id: d.id, def: d, total, cells, springs, onRoute, rests, segments });
  }
  restore(R);
  return out;
}

module.exports = { DUNGEONS, dungeonRoutes, prepare, restore };
