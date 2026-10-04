#!/usr/bin/env node
// 地面の拾う物のきらめき（glint）とオルビスの北東の家（持ち主 2026-10-04）の戻りの確かめ: node v2/tools/test_glints_1004.js
//   1 きらめき: prop 'glint' があり（歩ける・灯りつき）、R.GLINTS（maps/glints.js）の所すべてに置かれ、拾う前・頼まれている間だけ見え、拾ったら消える。
//     オルビスの銀の羽ペン（33,11）は頼まれてから拾う（届ける）までだけ。天文台の西の庭の草の上で、歩いて行ける。
//   2 拾う物には目印: 筋・依頼の物を渡す「調べる所」（item・flag・lead・var を渡す。年代記の覚え書き lo_* だけの物は除く）で、
//     床のマスにある物は、そのマスか隣に目に見える物（glint・物・人・宝箱・戸…）がある。わざと目印を置かない所は SKIP（理由つき）。
//   3 オルビス: 建物の戸口はどれも南門から歩いて行ける。北東の角の家（星図描きの家）へ大通りから本物の入力で歩いて入れる。
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true });
R.DB.config.slice = false;
R.State.newGame({ seed: 1 });
const D = R.DB, F = R.Field, S = F._s, I = R.Input, G = R.Game;
const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(50); await flush(); } }
async function step(b) {
  I._set(b, true);
  for (let t = 0; t < 34; t += 16.67) { adv(16.67); await flush(); }
  I._set(b, false);
  for (let i = 0; i < 40 && (S.mv || S.arriving); i++) { adv(16.67); await flush(); }
  await settle(60);
}
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);
const glintAt = (m, x, y) => (m.objects || []).find((o) => o.type === 'prop' && o.id === 'glint' && o.x === x && o.y === y);
const shown = (o) => !!o && (o.cond == null || R.State.check(o.cond));
function bfs(m, from, to) {
  const W = m.rows[0].length, H = m.rows.length, prev = new Map(), key = (x, y) => x + ',' + y, q = [from];
  prev.set(key(...from), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy, b] of [[0, -1, 'up'], [0, 1, 'down'], [1, 0, 'right'], [-1, 0, 'left']]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(k) || !pass(m, nx, ny)) continue;
      if (F._warpAt(m, nx, ny, 0) && !(nx === to[0] && ny === to[1])) continue;   // 途中で戸口に入らない
      prev.set(k, [x, y, b]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(...to))) return null;
  const out = []; let c = to;
  while (prev.get(key(...c))) { const p = prev.get(key(...c)); out.unshift({ b: p[2], at: c }); c = [p[0], p[1]]; }
  return out;
}

// わざと目印を置かない拾う所（理由）
const SKIP = {
  world_poi_cache: '名所の裏の隠し物（探すのが遊び）',
  isles_crab_nest: '描いた巣（大きく見える）の前',
  isles_siren_rock: '描いた歌う岩（島の真ん中の大岩）の前',
  world_snow_lake: '湖の眺め（景色の手がかり）',
  ash_beach_rock: 'ワールドの描いた岩',
  star_academy_door: '描いた学院の大扉',
};

const AMBIENT = /^(firefly|star_lamp|waylamp|lamp_post|star_glow|glow_plankton|torch|candelabra|wall_window|wall_painting|wall_herbs|chair|carpet|rug|bush|fern|grass|flowers?|tree|tree_[a-z_]+|rock_small|arena_banner)$/;
// 2 回目の見直し（2026-10-04）で置いた物証・証拠・オルゴールの所（どれも glint が要る）
const MUST = [['caldera_arena', 14, 25], ['desert_tomb_3', 20, 4], ['hut', 4, 3], ['yule_hall', 19, 4], ['dovan_forge', 9, 1], ['loch_tower', 3, 4], ['loch_emma', 3, 6], ['loch_beppo', 9, 3],
  ['marsh_manor_1', 10, 18], ['marsh_manor_2', 4, 28], ['marsh_manor_2', 44, 28], ['marsh_manor_2', 4, 5], ['verda_1', 12, 10], ['verda_1', 46, 12], ['orbis', 33, 11], ['s_crater', 28, 26], ['isles_cave_2', 22, 2]];

async function main() {
  section('1. きらめき（glint）');
  ok('prop glint: 歩ける・灯りつき', !!D.props.glint && D.props.glint.soft === true && !!D.props.glint.light);
  ok('R.GLINTS（maps/glints.js）に 40 か所以上', Array.isArray(R.GLINTS) && R.GLINTS.length >= 40, R.GLINTS && R.GLINTS.length);
  const miss = (R.GLINTS || []).filter((g) => { const o = glintAt(D.maps[g.map], g.x, g.y); return !o || JSON.stringify(o.cond) !== JSON.stringify(g.cond); });
  ok('R.GLINTS の所すべてに glint（同じ cond）', miss.length === 0, miss);
  const noEx = (R.GLINTS || []).filter((g) => !(D.maps[g.map].objects || []).some((o) => o.type === 'examine' && o.event === g.event && o.x === g.x && o.y === g.y));
  ok('glint の所に調べる所がある（同じマス）', noEx.length === 0, noEx);
  // 拾ったら消える・頼まれる前は出ない（例）
  {
    const pen = glintAt(D.maps.orbis, 33, 11);
    ok('オルビスの銀の羽ペン: glint がある（前の小さな光 firefly は無い）', !!pen && !(D.maps.orbis.objects || []).some((o) => o.id === 'firefly' && o.x === 33 && o.y === 11));
    ok('羽ペン: 頼まれる前は出ない', !shown(pen));
    G.flags.star_pen_asked = true;
    ok('羽ペン: 頼まれたら出る', shown(pen));
    G.items.k_silver_pen = 1;
    ok('羽ペン: 拾ったら消える', !shown(pen));
    delete G.items.k_silver_pen; G.flags.star_key_2 = true;
    ok('羽ペン: 届けた後も出ない', !shown(pen));
    delete G.flags.star_key_2; delete G.flags.star_pen_asked;
    ok('羽ペンの所（33,11）は描いた天文台の西の庭の草（歩ける）で、南門から歩いて行ける', pass(D.maps.orbis, 33, 11) && D.maps.orbis.rows[11][33] === ',' && !!bfs(D.maps.orbis, [28, 47], [33, 11]));
    const sh = glintAt(D.maps.isles_cave_1, 12, 13);
    ok('貝がら: 拾う前は出て、拾ったら消える', shown(sh) && (G.flags.isles_shell_6 = true, !shown(sh)));
    delete G.flags.isles_shell_6;
    const mat = glintAt(D.maps.f_lake, 13, 21);
    ok('雪像の材料: 頼まれる前は出ず、頼まれたら出て、拾ったら消える', !shown(mat) && (G.flags.snow_statue_asked = true, shown(mat)) && (G.flags.snow_mat_ice = true, !shown(mat)));
    delete G.flags.snow_statue_asked; delete G.flags.snow_mat_ice;
    const noG = MUST.filter(([mid, x, y]) => !glintAt(D.maps[mid], x, y));
    ok(`筋の物証・沼の証拠・霧の館のオルゴールなど ${MUST.length} か所に glint`, noG.length === 0, noG);
    const ros = glintAt(D.maps.caldera_arena, 14, 25);
    ok('物証（闘技場の名簿）: 読む前は出て、読んだら消える', shown(ros) && (G.flags.lo_ev_ash = true, !shown(ros)));
    delete G.flags.lo_ev_ash;
    const doll = glintAt(D.maps.loch_beppo, 9, 3);
    ok('沼の証拠（人形）: エマに会う前は出ず、会ったら出て、手に入れたら・集会の後は消える',
      !shown(doll) && (G.flags.marsh_emma_met = true, shown(doll)) && (G.flags.marsh_ev_doll = true, !shown(doll)) && (delete G.flags.marsh_ev_doll, G.flags.marsh_assembly_done = true, !shown(doll)));
    delete G.flags.marsh_emma_met; delete G.flags.marsh_assembly_done;
    const box = glintAt(D.maps.marsh_manor_2, 44, 28), sheet = glintAt(D.maps.marsh_manor_1, 10, 18);
    ok('霧の館: 楽譜は読むまで、オルゴールは楽譜を読んでから鳴らし終えるまで', shown(sheet) && !shown(box) && (G.flags.marsh_sheet_read = true, !shown(sheet) && shown(box)) && (G.flags.marsh_boxes_done = true, !shown(box)));
    delete G.flags.marsh_sheet_read; delete G.flags.marsh_boxes_done;
    // 実際の調べる所を動かして、旗が cond と合うか（読んだら消える）
    for (const [mid, x, y, evid, pre] of [['desert_tomb_3', 20, 4, 'desert_tomb_rubbing', {}], ['loch_tower', 3, 4, 'loch_tower_book', { marsh_emma_met: true }], ['yule_hall', 19, 4, 'yule_blank_book', {}], ['dovan_forge', 9, 1, 'dovan_receipt', {}]]) {
      Object.assign(G.flags, pre);
      const gl = glintAt(D.maps[mid], x, y), before = shown(gl);
      let fin = false;
      R.Events.run(evid, { map: mid, x, y }).then(() => { fin = true; }, () => { fin = true; });
      for (let i = 0; i < 600 && !fin; i++) { I._set('a', true); adv(34); await flush(); I._set('a', false); adv(34); await flush(); }
      ok(`${mid} ${evid}: 調べる前は glint が出て、調べた後は消える`, before && !shown(gl), { before, after: shown(gl) });
    }
  }

  section('2. 拾う所には目印');
  {
    const bad = [], skipped = [];
    for (const [mid, m] of Object.entries(D.maps)) for (const o of m.objects || []) {
      if (o.type !== 'examine') continue;
      const ev = D.events[o.event]; if (!ev) continue;
      const g = (ev.meta && ev.meta.gives) || [], src = String(ev.run);
      const pickup = g.some((x) => /^(item|flag|lead|var):/.test(x) && !/^flag:lo_/.test(x)) || /ev\.item\(|addVar\(/.test(src);
      if (!pickup) continue;
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (c && (c.solid || c.walk === false)) continue;   // 描いた物（壁・岩・水・像）を調べる
      if (SKIP[o.event]) { skipped.push(`${mid} ${o.x},${o.y} ${o.event}`); continue; }
      // 目印に数えない物: 灯り・草木・家具の飾り（どこにでもあり「ここに何か」とは読めない）
      const mark = (m.objects || []).some((q) => q.type !== 'examine' && q.type !== 'trigger' && !(q.type === 'prop' && AMBIENT.test(q.id)) && Math.abs(q.x - o.x) <= 1 && Math.abs(q.y - o.y) <= 1) ||
        (m.npcs || []).some((n) => Math.abs(n.x - o.x) <= 1 && Math.abs(n.y - o.y) <= 1);
      if (!mark) bad.push(`${mid} ${o.x},${o.y} ${o.event}`);
    }
    ok('筋・依頼の物を拾う床の所には、そのマスか隣に目に見える物がある', bad.length === 0, bad);
    ok(`わざと目印を置かない所 ${skipped.length}（${Object.keys(SKIP).join('・')}）`, skipped.length <= 12, skipped);
  }

  section('3. オルビスの戸口');
  {
    const m = D.maps.orbis;
    const bld = (m.objects || []).filter((o) => o.type === 'building' && o.door && o.door.to);
    const far = bld.filter((o) => !bfs(m, [28, 47], [o.door.x, o.door.y]));
    ok(`建物の戸口 ${bld.length} がどれも南門から歩いて行ける`, bld.length >= 17 && far.length === 0, far.map((o) => o.id));
    const h6 = bld.find((o) => o.id === 'orbis_house6');
    ok('北東の角の家（星図描きの家）に戸口 (49,8) → orbis_house6', !!h6 && h6.door.x === 49 && h6.door.y === 8 && h6.door.to.map === 'orbis_house6' && !!D.maps.orbis_house6);
    ok('戸の前（49,9）と東の木ぎわ（53, 9〜12）は描いた草で歩ける', [[49, 9], [50, 9], [51, 9], [52, 9], [53, 9], [53, 10], [53, 11], [53, 12]].every(([x, y]) => pass(m, x, y)));
    ok('下の家（orbis_house4）の戸口と敷地はそのまま入れる', pass(m, 49, 13) && !pass(m, 47, 11));
    // 本物の入力: 大通り（53,14）から戸の前へ歩いて北へ入る
    const keep = m.triggers; m.triggers = [];   // 着いたときの字幕は止める（道だけ）
    await F.enter('orbis', { x: 53, y: 14, dir: 'n' }, { fade: 0, noAutosave: true }); await settle(300);
    m.triggers = keep;
    F.encounter.suppress(1000);
    const route = bfs(m, [53, 14], [49, 8]) || [];
    for (const s of route) { await step(s.b); if (S.map.id !== 'orbis') break; }
    await settle(2500);
    ok(`大通りから ${route.length} 歩で北東の角の家に入れる`, S.map.id === 'orbis_house6', { map: S.map.id, x: F.pos.x, y: F.pos.y });
  }
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
