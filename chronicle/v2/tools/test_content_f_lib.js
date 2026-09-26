#!/usr/bin/env node
// CONTENT-F: テストの共通の小道具（地図の到達・文字の地図・状態の組み立て）。test_content_f*.js が読む。
//   node v2/tools/test_content_f_lib.js <mapId> [flag=1 var=n choice:key=value …]   文字の地図（物と人を重ねる）
'use strict';
const path = require('path');

const MY_MAPS = ['fern', 'fern_inn', 'fern_shop', 'fern_rita', 'fern_search', 'fern_gord', 'fern_pim_home',
  'verda_1', 'verda_2', 'elder_1', 'elder_2', 'yura', 'yura_inn', 'hut'];

function load() { return require('./lib/load')({ quiet: true }); }

/** 最小の R.Game（条件の判定用）。o = {flags, vars, choices, items, tier, cleared, guest} */
function state(R, o) {
  o = o || {};
  R.State.newGame({ seed: 1 });
  const G = R.Game;
  Object.assign(G.flags, o.flags || {});
  Object.assign(G.vars, o.vars || {});
  Object.assign(G.choices, o.choices || {});
  Object.assign(G.items, o.items || {});
  if (o.tier) G.tier = o.tier;
  if (o.cleared) for (const k of Object.keys(o.cleared)) { G.cleared[k] = true; G.flags['cleared_' + k] = true; }
  if (o.guest) G.guest = { id: o.guest, look: o.guest };
  if (o.leads) for (const id of o.leads) G.leads[id] = { got: 0, pin: false, seen: false };
  R.MapUtil.invalidate();
  return G;
}

const DIRS = [[0, 1, 's'], [0, -1, 'n'], [1, 0, 'e'], [-1, 0, 'w']];
/**
 * 到達の探索（4 方向。FIELD の passable ＝ マス・高さ・一方通行、_walkable ＝ 物の当たり）。
 * 同じマップへの出口（森が道を変える）は、その出口の先の spawn へつながる。→ {dist: Map('x,y,lv' → 歩数), far, cells}
 */
function reach(R, map, start, o) {
  o = o || {};
  const F = R.Field;
  const key = (x, y, lv) => x + ',' + y + ',' + lv;
  const dist = new Map();
  const q = [[start.x, start.y, start.lv || 0]];
  dist.set(key(start.x, start.y, start.lv || 0), 0);
  const exitAt = (x, y) => (map.exits || []).find((e) => x >= e.x && y >= e.y && x < e.x + (e.w || 1) && y < e.y + (e.h || 1) && (!e.cond || R.State.check(e.cond)));
  while (q.length) {
    const [x, y, lv] = q.shift();
    const d = dist.get(key(x, y, lv));
    const ex = exitAt(x, y);
    if (ex && d > 0) {
      if (ex.to.map === map.id) {
        const sp = R.MapUtil.spawn(map, ex.to.spawn);
        const k = key(sp.x, sp.y, 0);
        if (!dist.has(k)) { dist.set(k, d + 1); q.push([sp.x, sp.y, 0]); }
      }
      continue;   // 出口のマスから先へは歩かない
    }
    for (const [dx, dy, dir] of DIRS) {
      const nx = x + dx, ny = y + dy;
      for (const nlv of [lv, lv ? 0 : 1]) {
        if (nlv !== lv) {
          // 高さを変えるのは、はしごのマスからだけ（FIELD の決まり: はしご → 足場で lv 1、足場 → はしごで lv 0）
          const here = R.MapUtil.cell(map, x, y), there = R.MapUtil.cell(map, nx, ny);
          if (!(here && there && ((lv === 0 && here.ladder && there.deck) || (lv === 1 && there.ladder)))) continue;
        }
        if (!F.passable(map, nx, ny, dir, nlv)) continue;
        if (F._walkable && !F._walkable(map, nx, ny, dir, nlv)) {
          // 扉のある建物・出口の上は通れる扱い（F._walkable が建物の扉を通す）
          continue;
        }
        const k = key(nx, ny, nlv);
        if (dist.has(k)) continue;
        dist.set(k, d + 1);
        q.push([nx, ny, nlv]);
      }
    }
  }
  return { dist, get(x, y, lv) { return dist.get(key(x, y, lv || 0)); } };
}
/** 物の前（上下左右のどれか）に立てるか → 最短の歩数 | undefined */
function reachObj(r, o) {
  let best;
  const w = o.type === 'spring' ? 2 : o.w || 1, h = o.type === 'spring' ? 2 : o.h || 1;
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    const inside = i >= 0 && j >= 0 && i < w && j < h;
    const edge = (i === -1 || i === w) !== (j === -1 || j === h);
    if (!inside && !edge) continue;
    const d = r.get(o.x + i, o.y + j, o.lv || 0);
    if (d != null && (best == null || d < best)) best = d;
  }
  return best;
}

/** 文字の地図（物: C 宝箱・O 泉・B 燭台・? 調べる・! 看板・H 建物・N 人・# 硬い物・+ 柔らかい物・^ 足あと） */
function ascii(R, map) {
  const grid = R.MapUtil.grid(map).map((r) => [...r]);
  for (const o of map.objects || []) {
    if (o.cond != null && o.type !== 'trail' && !R.State.check(o.cond)) continue;
    if (o.type === 'trail') { for (const [x, y] of o.path) if (grid[y]) grid[y][x] = '^'; continue; }
    const cells = R.ContentF.kit.cellsOf(o);
    const ch = { chest: 'C', spring: 'O', brazier: 'B', examine: '?', sign: '!', building: 'H', waylamp: 'L', switch: 'X', stairs: '<', door: 'D' }[o.type] ||
      (((R.DB.props[o.id] || {}).solid && !(R.DB.props[o.id] || {}).soft) ? '#' : '+');
    for (const c of cells) { const [x, y] = c.split(',').map(Number); if (grid[y]) grid[y][x] = ch; }
    if (o.type === 'building' && o.door) grid[o.door.y][o.door.x] = 'D';
  }
  for (const n of map.npcs || []) if (!n.cond || R.State.check(n.cond)) grid[n.y][n.x] = 'N';
  return grid.map((r, y) => String(y).padStart(2) + ' ' + r.join('')).join('\n');
}

module.exports = { MY_MAPS, load, state, reach, reachObj, ascii };

if (require.main === module) {
  const R = load();
  const id = process.argv[2] || 'verda_1';
  const o = { flags: {}, vars: {}, choices: {}, items: {} };
  for (const a of process.argv.slice(3)) {
    const m = /^(choice:)?([\w]+)=(.*)$/.exec(a);
    if (!m) continue;
    if (m[1]) o.choices[m[2]] = m[3];
    else if (/^\d+$/.test(m[3])) o.vars[m[2]] = +m[3];
    else if (/^[ikuaw]_/.test(m[2])) o.items[m[2]] = 1;
    else o.flags[m[2]] = m[3] !== '0';
  }
  state(R, o);
  const map = R.DB.maps[id];
  if (!map) { console.log('no map', id); process.exit(1); }
  console.log(`${id} ${map.w}x${map.h}`);
  console.log('   ' + Array.from({ length: map.w }, (_, i) => i % 10).join(''));
  console.log(ascii(R, map));
  void path;
}
