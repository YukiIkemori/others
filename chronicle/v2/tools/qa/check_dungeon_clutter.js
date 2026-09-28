#!/usr/bin/env node
// QA: ダンジョンの通れない小物（樽・木箱・壺・岩…）の置き場所と数。node だけ。
//   持ち主 2026-09-28「ダンジョンに樽とか木箱みたいに移動通り抜け不可のはあまり置かないで。奥としても端っことかにして。通路真ん中にはおかないで。」
//
//   node v2/tools/qa/check_dungeon_clutter.js [--map id,…] [--verbose] [--strict]
//
// 対象: kind 'dungeon' のマップ。当たる（solid で soft でない）prop のうち、
//   CONTAINER（樽・木箱・壺・かめ・たきぎ…）= 数と置き場所の両方を見る
//   SMALL（岩・丸太・切り株・崩れた柱・雪だまり…）= 置き場所だけ見る
// 検査（小物のマスを「床」とみなして、まわりのマスで決める。ほかの小物も床とみなす = 1 つずつ見る）:
//  1 通路: 小物のマスの通り幅（左右が床なら上下に続く床の数、上下が床なら左右に続く床の数）が 2 以下 → 通路をふさぐ／半分にする
//  2 すきま: 小物を置くと、となり（上下左右）の床の通り幅が 1 になる → 1 マスのすきましか残さない
//  3 分断: まわり 8 マスの床が 2 つ以上のかたまりに分かれる → 小物が道の間に挟まっている
//  4 壁ぎわ: 上下左右のどれかが壁（マスの当たり）か、壁ぎわの小物につながっている。でなければ床の真ん中
//  5 数: CONTAINER は 1 つのマップ（1 階）に MAX（4）まで
// painted（下絵に描いてある物）は動かせない（描き直しが要る）ので、既定では「要描き直し」として数えるだけ（--strict で失敗にする）。
'use strict';
const { ok, section, done } = require('../lib/testkit');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const VERBOSE = argv.includes('--verbose');
const STRICT = argv.includes('--strict');
const ONLY = arg('--map', null);
const MAX = 4;

const CONTAINER = /^(barrel|crate|box|clay_jars|cart_barrels|tomb_urn|water_urn|snow_barrel|firewood|hay|keg|jar|urn|pot_big)/;
const SMALL = /^(rock|snow_rock|snow_bank|log|log_moss|stump|bush|broken_pillar|rubble|sled|debris)/;

const R = require('../lib/load')({ quiet: true });
const F = R.Field;
R.State.newGame({ seed: 1 });

const isSolid = (o) => { const meta = (R.DB.props && R.DB.props[o.id]) || {}; return !!meta.solid && !meta.soft && !o.soft; };
const condOk = (c) => { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } };

function checkMap(m) {
  const painted = new Set((m.art && m.art.painted) || []);
  const list = [];
  for (const o of m.objects || []) {
    if (o.type !== 'prop' || o.x == null || (o.lv || 0) !== 0 || !isSolid(o) || !condOk(o.cond)) continue;
    const kind = CONTAINER.test(o.id) ? 'container' : SMALL.test(o.id) ? 'small' : null;
    if (!kind) continue;
    list.push({ id: o.id, x: o.x, y: o.y, kind, painted: painted.has(o.id) || painted.has(o.id + '@' + o.x + ',' + o.y), bad: [] });
  }
  const at = new Map(list.map((c) => [c.x + ',' + c.y, c]));
  // 床: マスが歩けて、物に当たらない（小物だけのマスは床とみなす）
  const floor = (x, y) => {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (F._walkable(m, x, y, null, 0)) return true;
    return at.has(x + ',' + y) && F.passable(m, x, y, null, 0);
  };
  const wall = (x, y) => !F.passable(m, x, y, null, 0);
  const run = (x, y, dx, dy, blk) => {   // (x, y) を通る dx,dy 向きの床の数
    let n = 1;
    for (const s of [1, -1]) for (let k = 1; k < 64; k++) { const X = x + dx * k * s, Y = y + dy * k * s; if (!floor(X, Y) || (blk && X === blk.x && Y === blk.y)) break; n++; }
    return n;
  };
  const width = (x, y, blk) => {
    let w = Infinity;
    if (floor(x - 1, y) && !(blk && blk.x === x - 1 && blk.y === y) && floor(x + 1, y) && !(blk && blk.x === x + 1 && blk.y === y)) w = Math.min(w, run(x, y, 0, 1, blk));
    if (floor(x, y - 1) && !(blk && blk.x === x && blk.y === y - 1) && floor(x, y + 1) && !(blk && blk.x === x && blk.y === y + 1)) w = Math.min(w, run(x, y, 1, 0, blk));
    return w;
  };
  const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  for (const c of list) {
    const { x, y } = c;
    const w = width(x, y, null);
    if (w <= 2) c.bad.push('passage(w' + w + ')');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (floor(X, Y) && width(X, Y, c) <= 1) { c.bad.push('squeeze@' + X + ',' + Y); break; }
    }
    // まわり 8 マスの床のかたまり（輪の上でとなり合う床の並び）。斜めの 1 マスだけの並びは小物のマスとも行き来できないので数えない
    const open = RING.map(([dx, dy]) => floor(x + dx, y + dy));
    let groups = 0;
    for (let i = 0; i < 8; i++) {
      if (!open[i] || open[(i + 7) % 8]) continue;   // 並びの始まりだけ
      let len = 0; while (len < 8 && open[(i + len) % 8]) len++;
      if (len === 1 && i % 2 === 0) continue;         // 斜めの 1 マスだけ
      groups++;
    }
    if (groups >= 2) c.bad.push('split');
  }
  // 壁ぎわ（壁に触れる小物から、上下左右でつながる小物も壁ぎわ）
  const edge = new Set();
  for (const c of list) if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wall(c.x + dx, c.y + dy))) edge.add(c);
  for (let grow = true; grow;) {
    grow = false;
    for (const c of list) if (!edge.has(c) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = at.get((c.x + dx) + ',' + (c.y + dy)); return n && edge.has(n); })) { edge.add(c); grow = true; }
  }
  for (const c of list) if (!edge.has(c)) c.bad.push('mid-floor');
  return list;
}

const maps = Object.keys(R.DB.maps).filter((id) => R.DB.maps[id].kind === 'dungeon' && (!ONLY || ONLY.split(',').includes(id))).sort();
const repaint = [];
const table = [];
for (const id of maps) {
  const m = R.DB.maps[id];
  section(id);
  const list = checkMap(m);
  const cont = list.filter((c) => c.kind === 'container');
  const sprite = cont.filter((c) => !c.painted);
  table.push({ map: id, container: cont.length, painted: cont.length - sprite.length, small: list.length - cont.length });
  if (VERBOSE) for (const c of list) console.log(`   ${c.id}@${c.x},${c.y}${c.painted ? ' (painted)' : ''}${c.bad.length ? '  ← ' + c.bad.join(' ') : ''}`);
  for (const c of list) {
    const name = `${id}: ${c.id}@${c.x},${c.y} は通路・床の真ん中に無い`;
    if (c.painted && c.bad.length) { repaint.push(`${id} ${c.id}@${c.x},${c.y} ${c.bad.join(' ')}`); if (STRICT) ok(name, false, c.bad); continue; }
    ok(name, !c.bad.length, c.bad);
  }
  // 数: 動かせる（描いていない）物だけで MAX まで。描いた物が多いマップは要描き直しとして書き出す
  ok(`${id}: 樽・木箱・壺は ${MAX} つまで（描いていない物 ${sprite.length}）`, sprite.length <= MAX || (!STRICT && cont.length - sprite.length > 0 && sprite.length <= 1), sprite.map((c) => c.id + '@' + c.x + ',' + c.y));
  if (cont.length > MAX && cont.length - sprite.length > 0) repaint.push(`${id}: 下絵に描いた樽・木箱・壺が ${cont.length - sprite.length}（全部で ${cont.length}、${MAX} まで）`);
  if (STRICT) ok(`${id}: 樽・木箱・壺は全部で ${MAX} つまで`, cont.length <= MAX, cont.length);
}
console.log('\n== 数（container = 樽・木箱・壺、painted = そのうち下絵に描いた物、small = 岩・丸太…）');
for (const t of table) if (t.container || t.small) console.log(`   ${t.map.padEnd(16)} container ${String(t.container).padStart(2)}  painted ${String(t.painted).padStart(2)}  small ${String(t.small).padStart(2)}`);
if (repaint.length) { console.log('\n== 要描き直し（下絵に描いてあるので動かせない。--strict で失敗）'); for (const s of repaint) console.log('   ' + s); }
done('check_dungeon_clutter');
