#!/usr/bin/env node
// クリア後のダンジョン「忘却の底」（maps/oblivion.js・events/oblivion.js・ビブリアの入口）のテスト（node）。持ち主 2026-10-04
//   node v2/tools/test_oblivion.js
//   1 形: 地下 1〜5 階が 1 枚の下絵（@24・@32・@40 がマップの大きさ）・当たりの字が凡例にある・場所 oblivion（ワープ、クリアの後）・出現表・ボスの編成
//   2 入口: ビブリアの広場の階段はクリアの前は通せんぼ（出口の印も出ない）、クリアの後は「下りますか？」で地下 1 階へ。
//          大書庫 1 階の手すりの階段はクリアの前は見るだけ、後は下りられる。手がかりの文は広場の階段を指し、「別のお話」と言わない
//   3 つながり: 町 → 地下 1 → 2 → 3 → 4 → 5 の階段がそろい、着く所が戻りの階段のそば。どの階も出発から階段・宝箱・調べる物へ届く。
//          町の入口から 3 階の魔王の残影・5 階の円環竜の踏み板へ歩いて行ける。4 階の回廊は正しい廊下だけで抜けられる
//   4 泉: このダンジョンに 1 つ（5 階）、入口の階に無い、円環竜の踏み板を踏まずに着ける、ボスの前 60 歩以内
//   5 筋: 残影 → oblivion_echo（もう一度戦える）、回廊の輪（3 回ごとの手がかり）、円環竜 → oblivion_ouroboros・外伝の読み物（もう一度戦える）、
//          ボイスは script.csv の行のまま。負けたら旗は立たない
//   6 報酬: 宝箱はティア 9（chestTier）・ボスの落とし物（p_boss・レア・超レア）・円環竜の打ち消しの AI 条件（roundGap・foeBuffsAtLeast）
//   7 古いセーブ: クリア済みで手がかりが無い → 手がかりとビブリアのワープ（R.SaveFixups）
//   8 文: 使う key が 5 言語の表にある
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const CHRON = path.resolve(V2, '..');
const F = R.Field, S = F._s;
D.config.slice = false;
if (R.MapUtil && R.MapUtil.invalidate) R.MapUtil.invalidate();
const M = require('./lib/maps').create(R);
const FLOORS = ['oblivion_1', 'oblivion_2', 'oblivion_3', 'oblivion_4', 'oblivion_5'];
const T = (k) => R.T(k);

function newGame(flags) {
  R.Screens.tip = async () => {}; R.Screens.open = async () => undefined;
  R.State.newGame({ seed: 11 });
  R.State.setHero({ type: 'warrior', sex: 'm', name: 'アル', fav: 'sword' });
  Object.assign(R.Game.flags, flags || {});
  R.MapUtil.invalidate();
  return R.Game;
}
const LOG = [];
function mkEv(ctx, o) {
  o = o || {};
  const real = R.Events.makeEv(ctx || {});
  return Object.assign({}, real, {
    say: async (who, t, op) => { LOG.push({ k: 'say', t: String(t), voice: op && op.voice, face: op && op.face, name: op && op.name }); },
    choose: async (labels) => { LOG.push({ k: 'choose', labels }); return o.choose == null ? 0 : o.choose; },
    caption: async (t) => { LOG.push({ k: 'caption', t: String(t) }); },
    fade: async () => {}, wait: async () => {},
    warp: async (map, sp) => { LOG.push({ k: 'warp', map, sp }); },
    bgm: () => {}, sfx: () => {}, mapBgm: () => {}, jingle: async () => {},
    battle: async (troop) => { LOG.push({ k: 'battle', troop }); return o.result || 'win'; },
  });
}
const run = async (id, ctx, o) => { LOG.length = 0; await D.events[id].run(mkEv(ctx || {}, o), ctx || {}); return LOG.slice(); };

(async function () {
  // ================================================================ 1
  section('1. 形');
  ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
  for (const id of FLOORS) {
    const m = D.maps[id];
    if (!ok(`${id} がある（K.map）`, !!m && R.Contract.check('map', m).ok, m && R.Contract.check('map', m).errors)) continue;
    const a = m.art || {};
    const bad = [];
    for (const t of [24, 32, 40]) {
      const f = path.join(V2, 'assets', 'env', (a.image || '?') + '@' + t + '.png');
      if (!fs.existsSync(f)) { bad.push('no ' + t); continue; }
      const b = fs.readFileSync(f);
      if (b.readUInt32BE(16) !== m.w * t || b.readUInt32BE(20) !== m.h * t) bad.push(`${t}: ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
    }
    ok(`${id}: 1 枚の下絵（oblivion/under、@24・@32・@40 がマップの大きさ）`, /^oblivion\/under\//.test(a.image || '') && !bad.length, bad);
    const chars = new Set(m.rows.join(''));
    ok(`${id}: 当たりの字がどれも凡例にある`, [...chars].every((c) => m.legend[c]), [...chars].filter((c) => !m.legend[c]));
    ok(`${id}: 名前「${m.name}」・場所 oblivion・ダンジョン・宝箱ティア 9・BGM postgame・戦闘背景 oblivion`, m.name === T('map.oblivion.name') && m.location === 'oblivion' && m.kind === 'dungeon' && m.chestTier === 9 && m.bgm === 'postgame' && m.bbg === 'oblivion');
    const zs = (m.zones || []).map((z) => z.zone);
    const want = id === 'oblivion_1' || id === 'oblivion_2' ? 'z_postgame_oblivion_lo' : 'z_postgame_oblivion_hi';
    ok(`${id}: 出現表 ${want}`, zs.length > 0 && zs.every((z) => z === want) && D.encounters[want] && D.encounters[want].tier === 9, zs);
  }
  ok('5 階の内の円（円環竜の寝床）は出現なし、輪の床は出る', M.zoneAt('oblivion_5', 17, 17) == null && M.zoneAt('oblivion_5', 4, 17) === 'z_postgame_oblivion_hi');
  const loc = D.locations.oblivion;
  ok('場所 oblivion（ダンジョン・ワープはクリアの後・地下 1 階の from_town）', !!loc && R.Contract.check('location', loc).ok && loc.kind === 'dungeon' && loc.warp === 'final_clear' && loc.map === 'oblivion_1' && D.maps.oblivion_1.spawns[loc.spawn]);
  ok('ボスの編成 tr_b_valzard_echo・tr_b_ouroboros（ティア 9・背景 oblivion）', ['tr_b_valzard_echo', 'tr_b_ouroboros'].every((t) => D.troops[t] && D.troops[t].tier === 9 && D.troops[t].bg === 'oblivion'));

  // ================================================================ 2
  section('2. 入口（ビブリアの広場の階段・大書庫 1 階の手すり）');
  const bib = D.maps.biblia;
  const gates = (bib.objects || []).filter((o) => o.type === 'stairs' && o.to && o.to.map === 'oblivion_1');
  ok('ビブリアの広場に忘却の底への階段（2 マス幅の 1 つ、描いた下絵の上 = look none）', gates.length === 1 && gates[0].w === 2 && gates.every((o) => o.look === 'none' && D.maps.oblivion_1.spawns[o.to.spawn]), gates);
  ok('階段のマスは歩ける（描いた段）・まわりの手すりは当たり', gates.every((o) => F._walkable(bib, o.x, o.y, null, 0) && F._walkable(bib, o.x + 1, o.y, null, 0)) && [[31, 27], [34, 27], [32, 26], [33, 27]].every(([x, y]) => !F._walkable(bib, x, y, null, 0)));
  ok('階段の前（着く所 biblia.oblivion）は歩ける広場', !!bib.spawns.oblivion && F._walkable(bib, bib.spawns.oblivion.x, bib.spawns.oblivion.y, null, 0));
  newGame({ final_arrived: true });
  ok('クリアの前: 通せんぼ（gate が閉じている）', gates.every((o) => F._gateShut(o.gate)) && gates[0].gate.text === T('map.final_biblia.oblivion_gate.closed'));
  const W = F.wayfind;
  const label = () => { R.Game.flags._x = Math.random(); const inf = W.info(bib); delete R.Game.flags._x; return inf.exits.filter((e) => e.to && e.to.map === 'oblivion_1'); };
  ok('クリアの前: 出口の印と札を出さない', label().length === 0);
  newGame({ final_arrived: true, final_clear: true });
  ok('クリアの後: 開く（gate が開く・「下りますか？」の問い）', gates.every((o) => !F._gateShut(o.gate)) && gates[0].confirm === T('map.final_biblia.oblivion_gate.confirm'));
  {
    const ls = label();
    ok(`クリアの後: 出口の印と札「${ls[0] && ls[0].label}」`, ls.length > 0 && ls[0].label.includes(T('map.oblivion.name')), ls);
  }
  ok('ワープの一覧: クリアの後、地下 1 階に入ると「忘却の底」、町のビブリアも載る', (() => {
    R.Game.warps = { biblia: true, oblivion: true };
    const L = F.warpList().map((w) => w.id);
    return L.includes('oblivion') && L.includes('biblia');
  })());
  newGame({ final_arrived: true });
  R.Game.warps = { biblia: true, oblivion: true };
  ok('ワープの一覧: クリアの前は忘却の底を出さない', !F.warpList().some((w) => w.id === 'oblivion'));
  // 大書庫 1 階
  newGame({ final_arrived: true });
  let log = await run('archive_oblivion');
  ok('大書庫の手すり（クリアの前）: 見るだけ（下りない・手がかりなし）', !log.some((e) => e.k === 'warp') && !R.Game.leads.l_post_oblivion);
  newGame({ final_arrived: true, final_clear: true });
  log = await run('archive_oblivion', {}, { choose: 0 });
  ok('大書庫の手すり（クリアの後）: 手がかり l_post_oblivion → 「下りる」で地下 1 階', !!R.Game.leads.l_post_oblivion && log.some((e) => e.k === 'warp' && e.map === 'oblivion_1' && D.maps.oblivion_1.spawns[e.sp]));
  log = await run('archive_oblivion', {}, { choose: 1 });
  ok('… 「やめておく」なら下りない', !log.some((e) => e.k === 'warp'));
  {
    const lead = D.leads.l_post_oblivion;
    const langs = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
    ok('手がかり l_post_oblivion: 場所はビブリア、地下 1 階に着いたら済み', lead.place === 'biblia' && lead.done === 'oblivion_1_arrive');
    const src = langs.map((l) => fs.readFileSync(path.join(V2, 'src', 'i18n', l, 'events_final.js'), 'utf8'));
    const textOf = (s) => (s.match(/'leads\.l_post_oblivion\.text': '((?:[^'\\]|\\.)*)'/) || [])[1] || '';
    ok('手がかりの文は広場の階段を指し、「それは、また別のお話」と言わない（5 言語）', src.every((s) => textOf(s) && !/別のお話|another story|另一个故事|另一個故事|또 다른 이야기/.test(textOf(s))) && /広場/.test(textOf(src[0])));
    const fin = i18nInline(fs.readFileSync(path.join(V2, 'src', 'events', 'final_ending.js'), 'utf8'));
    ok('エンディングの「それは、また別のお話」は残る（手がかりだけ直した）', /また別のお話|別のお話/.test(fin + fs.readFileSync(path.join(V2, 'src', 'i18n', 'ja', 'events_final.js'), 'utf8')));
  }

  // ================================================================ 3
  section('3. つながりと届く所');
  {
    const chain = [['biblia', 'oblivion_1'], ['oblivion_1', 'oblivion_2'], ['oblivion_2', 'oblivion_3'], ['oblivion_3', 'oblivion_4'], ['oblivion_4', 'oblivion_5']];
    const miss = [];
    for (const [a, b] of chain) {
      const down = (D.maps[a].objects || []).filter((o) => o.type === 'stairs' && o.to && o.to.map === b);
      const up = (D.maps[b].objects || []).filter((o) => o.type === 'stairs' && o.to && o.to.map === a);
      if (!down.length || !up.length) { miss.push(`${a} ↔ ${b}`); continue; }
      const s1 = D.maps[b].spawns[down[0].to.spawn], s2 = D.maps[a].spawns[up[0].to.spawn];
      if (!s1 || !up.some((o) => Math.abs(o.x - s1.x) + Math.abs(o.y - s1.y) <= 3)) miss.push(`${b}.${down[0].to.spawn} は戻りの階段のそばでない`);
      if (!s2 || !down.some((o) => Math.abs(o.x - s2.x) + Math.abs(o.y - s2.y) <= 3)) miss.push(`${a}.${up[0].to.spawn} は戻りの階段のそばでない`);
    }
    ok('町 → 地下 1 → 2 → 3 → 4 → 5: 上りと下りの階段がそろい、着く所が戻りの階段のそば', miss.length === 0, miss);
  }
  newGame({ final_arrived: true, final_clear: true });
  for (const id of FLOORS) {
    const m = D.maps[id];
    const starts = Object.values(m.spawns).map((s) => ({ x: s.x, y: s.y, lv: 0 }));
    const res = M.bfs(id, starts, { through: false });
    const near = (x, y) => [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => res.get(x + dx, y + dy, 0) != null);
    const bad = [];
    for (const o of m.objects || []) {
      if (!['stairs', 'chest', 'examine', 'spring'].includes(o.type)) continue;
      if (o.type === 'spring' ? !near(o.x - 1, o.y) && !near(o.x, o.y - 1) && !near(o.x + 2, o.y) : !near(o.x, o.y)) bad.push(`${o.type} ${o.id || o.event || ''} (${o.x},${o.y})`);
    }
    for (const [k, s] of Object.entries(m.spawns)) if (!F._walkable(m, s.x, s.y, null, 0)) bad.push(`spawn ${k}`);
    for (const o of m.objects || []) if (o.type === 'chest' && /[X~rTF]/.test(m.rows[o.y][o.x])) bad.push(`chest ${o.id} が当たりの上`);
    ok(`${id}: 階段・宝箱・調べる物・泉に出発から届く（spawn は歩ける）`, bad.length === 0, bad);
  }
  {
    const goal = (ev) => (mid) => M.eventPlaces(ev, { all: true }).filter((p) => p.map === mid && p.kind === 'trigger').flatMap((p) => M.standCells(mid, p));
    const plan3 = M.plan({ map: 'biblia', x: 32, y: 29, lv: 0 }, goal('oblivion_3_echo'));
    ok('町の広場の階段から 3 階の魔王の残影の踏み板へ歩いて行ける', !!plan3 && plan3.legs.some((l) => l.map === 'oblivion_3'), plan3 && plan3.cost);
    R.Game.flags.oblivion_echo = true; R.MapUtil.invalidate();
    const plan5 = M.plan({ map: 'biblia', x: 32, y: 29, lv: 0 }, goal('oblivion_5_ouroboros'));
    ok('… 5 階の円環竜の踏み板へ（残影の後）', !!plan5 && plan5.legs.some((l) => l.map === 'oblivion_5'), plan5 && plan5.cost);
    // 回廊: 輪のトリガーを踏まずに 1 の部屋から階段の間へ
    const m4 = D.maps.oblivion_4;
    const loops = (m4.triggers || []).filter((t) => t.event === 'oblivion_4_loop');
    const inLoop = (x, y) => loops.some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
    const r4 = M.bfs('oblivion_4', [{ x: m4.spawns.from3.x, y: m4.spawns.from3.y, lv: 0 }], { blocked: (x, y) => inLoop(x, y) });
    ok('4 階: 輪の廊下（3 本）を踏まずに、光のある廊下だけで下りの階段へ', loops.length === 3 && r4.get(44, 18, 0) != null);
    ok('4 階: 光（page_glow）は正しい廊下の口にだけ', (m4.objects || []).filter((o) => o.id === 'page_glow').every((o) => !inLoop(o.x, o.y)) && (m4.objects || []).filter((o) => o.id === 'page_glow').length === 3);
    ok('4 階: 輪の着く所 loop は 1 の部屋', !!m4.spawns.loop && m4.spawns.loop.x < 12);
  }

  // ================================================================ 4
  section('4. 泉（このダンジョンに 1 つ、ボスの前）');
  {
    const sp = FLOORS.flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'spring').map((o) => ({ id, o })));
    ok('泉は 1 つ（5 階）、入口の階（地下 1 階）に無い', sp.length === 1 && sp[0].id === 'oblivion_5', sp.map((s) => s.id));
    const m5 = D.maps.oblivion_5, s = sp[0] && sp[0].o;
    const boss = (m5.triggers || []).find((t) => t.event === 'oblivion_5_ouroboros');
    const inBoss = (x, y) => boss && x >= boss.x && x < boss.x + boss.w && y >= boss.y && y < boss.y + boss.h;
    const res = M.bfs('oblivion_5', [{ x: m5.spawns.from4.x, y: m5.spawns.from4.y, lv: 0 }], { blocked: (x, y) => inBoss(x, y) });
    const d = s ? [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2], [-1, 1], [2, 1]].map(([dx, dy]) => res.get(s.x + dx, s.y + dy, 0)).filter((v) => v != null) : [];
    ok('5 階の泉: 着く所から円環竜の踏み板を踏まずに泉の前へ', d.length > 0, d);
    const fromSpring = M.bfs('oblivion_5', [{ x: s.x, y: s.y + 2, lv: 0 }]);
    const toBoss = boss ? fromSpring.get(boss.x, boss.y, 0) : null;
    ok(`5 階の泉から円環竜の踏み板まで 60 歩以内（${toBoss} 歩）`, toBoss != null && toBoss <= 60);
    const m3 = D.maps.oblivion_3;
    const c3 = (m3.objects || []).filter((o) => o.type === 'chest' && o.item === 'i_elixir');
    ok('3 階（中ボス）: 泉の代わりに回復の宝箱（エリクサー）が手前にある（泉は 1 ダンジョン 1 つの決まり）', c3.length > 0 && c3.every((o) => o.y > 9));
  }

  // ================================================================ 5
  section('5. 筋（残影・回廊・円環竜）');
  newGame({ final_arrived: true, final_clear: true });
  log = await run('oblivion_1_arrive');
  ok('地下 1 階に着く: 字幕「忘却の底」・手がかり済み・旗', R.Game.flags.oblivion_1_arrive && log.some((e) => e.k === 'caption' && e.t === T('events.oblivion_1_arrive.caption')));
  log = await run('oblivion_1_arrive');
  ok('… 2 度目は何も出さない', log.length === 0);
  log = await run('oblivion_3_echo', {}, { result: 'lose' });
  ok('残影に負けたら旗は立たない', !R.Game.flags.oblivion_echo && log.some((e) => e.k === 'battle' && e.troop === 'tr_b_valzard_echo'));
  log = await run('oblivion_3_echo');
  ok('残影に勝つ → oblivion_echo（ボイス v_valzard_oblivion_01〜03）', R.Game.flags.oblivion_echo && ['v_valzard_oblivion_01', 'v_valzard_oblivion_02', 'v_valzard_oblivion_03'].every((v) => log.some((e) => e.voice === v)));
  ok('3 階の踏み板は oblivion_echo の後は消え、下りの階段は玉座の間の奥', D.maps.oblivion_3.triggers.find((t) => t.event === 'oblivion_3_echo').cond === '!oblivion_echo');
  log = await run('oblivion_3_echo', {}, { choose: 0 });
  ok('残影の後に玉座を調べる →「もう一度挑みますか？」→ もう一度戦える', log.some((e) => e.k === 'choose') && log.some((e) => e.k === 'battle' && e.troop === 'tr_b_valzard_echo'));
  log = await run('oblivion_3_echo', {}, { choose: 1 });
  ok('… やめておけば戦わない', !log.some((e) => e.k === 'battle'));
  R.Game.vars.oblivion_4_loops = 0;
  log = await run('oblivion_4_loop');
  ok('回廊の輪: 最初の部屋（loop）へ戻る', log.some((e) => e.k === 'warp' && e.map === 'oblivion_4' && e.sp === 'loop'));
  await run('oblivion_4_loop'); log = await run('oblivion_4_loop');
  ok('… 3 回目に白い紙の手がかり', log.some((e) => e.t === T('events.oblivion_4_loop.narr_3')));
  log = await run('oblivion_5_ouroboros', {}, { result: 'lose' });
  ok('円環竜に負けたら旗は立たない', !R.Game.flags.oblivion_ouroboros);
  log = await run('oblivion_5_ouroboros');
  ok('円環竜に勝つ → oblivion_ouroboros・外伝『円環の竜』（読み物 lo_ouroboros）・フィーネの声 2 本', R.Game.flags.oblivion_ouroboros && R.Game.flags.lo_ouroboros && D.lore.lo_ouroboros &&
    ['v_fine_oblivion_01', 'v_fine_oblivion_02'].every((v) => log.some((e) => e.voice === v)) && log.some((e) => e.k === 'caption' && e.t === T('events.oblivion_5_ouroboros.caption')));
  {
    // テスター 2026-10-07 Z3・Z4: ボス 2 体が顔と名前つきで話す・円環竜の締めの場面と「年代記に外伝が加わった」の字幕
    const said = (l, k) => l.find((e) => e.k === 'say' && e.t === T(k));
    const vz = await run('oblivion_3_echo', {}, {});   // 旗の立った後 = もう一度（下でまず最初の場面を流し直す）
    R.Game.flags.oblivion_echo = false;
    const v1 = await run('oblivion_3_echo');
    const vKeys = ['say', 'say_2', 'say_4', 'say_5', 'say_3', 'say_6'].map((k) => 'events.oblivion_3_echo.' + k);
    ok('残影の初めの場面: 声の 3 行と足した 3 行がどれも顔 b_valzard_echo・名前「魔王の残影」', vKeys.every((k) => { const e = said(v1, k); return e && e.face === 'b_valzard_echo' && e.name === T('ev.oblivion.who.valzard'); }));
    ok('残影の別れの一言（say_6）は勝った後・「光の……紋章……」の次', v1.findIndex((e) => e.t === T('events.oblivion_3_echo.say_6')) === v1.findIndex((e) => e.t === T('events.oblivion_3_echo.say_3')) + 1 &&
      v1.findIndex((e) => e.k === 'battle') < v1.findIndex((e) => e.t === T('events.oblivion_3_echo.say_6')));
    ok('残影のもう一度: 顔つきの短い一言（again_say）', vz.some((e) => e.t === T('events.oblivion_3_echo.again_say') && e.face === 'b_valzard_echo'));
    const oz = await run('oblivion_5_ouroboros', {}, { choose: 1 });
    ok('円環竜のもう一度: 顔つきの短い一言（again_say）・やめたら戦わない', oz.some((e) => e.t === T('events.oblivion_5_ouroboros.again_say') && e.face === 'b_ouroboros') && !oz.some((e) => e.k === 'battle'));
    R.Game.flags.oblivion_ouroboros = false;
    const o1 = await run('oblivion_5_ouroboros');
    const oName = T('data.bosses.LIST.b_ouroboros.name');
    const bi = o1.findIndex((e) => e.k === 'battle');
    ok('円環竜が戦いの前に 3 行話す（顔 b_ouroboros・名前）', ['say', 'say_2', 'say_3'].every((k) => { const e = said(o1, 'events.oblivion_5_ouroboros.' + k); return e && e.face === 'b_ouroboros' && e.name === oName && o1.indexOf(e) < bi; }));
    const iLast = o1.findIndex((e) => e.t === T('events.oblivion_5_ouroboros.last')), iCap = o1.findIndex((e) => e.k === 'caption' && e.t === T('events.oblivion_5_ouroboros.caption'));
    ok('勝った後: 竜の最後の言葉 2 行（顔つき）→ 字幕「年代記に外伝『円環の竜』が加わった」→ 余韻 2 行', iLast > bi && o1[iLast].face === 'b_ouroboros' && said(o1, 'events.oblivion_5_ouroboros.last_2') && iCap > iLast &&
      o1.findIndex((e) => e.t === T('events.oblivion_5_ouroboros.narr_6')) > iCap && R.Game.flags.oblivion_ouroboros && R.Game.flags.lo_ouroboros);
    ok('フィーネの声の行は今のまま（顔なし）', said(o1, 'events.oblivion_5_ouroboros.fine').face === false);
  }
  log = await run('oblivion_5_ouroboros', {}, { choose: 0 });
  ok('円環竜の後に渦の中ほどを調べる → もう一度戦える', log.some((e) => e.k === 'battle' && e.troop === 'tr_b_ouroboros'));
  ok('5 階の踏み板は oblivion_ouroboros の後は消え、渦の中ほどの調べる物は後だけ', D.maps.oblivion_5.triggers.find((t) => t.event === 'oblivion_5_ouroboros').cond === '!oblivion_ouroboros' &&
    D.maps.oblivion_5.objects.filter((o) => o.event === 'oblivion_5_ouroboros').every((o) => o.cond === 'oblivion_ouroboros'));
  {
    const rows = fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const head = rows.shift().split(',');
    const script = {};
    for (const r of rows) { const c = r.split(','); script[c[head.indexOf('id')]] = c[head.indexOf('text')]; }
    const pairs = [['events.oblivion_3_echo.say', 'v_valzard_oblivion_01'], ['events.oblivion_3_echo.say_2', 'v_valzard_oblivion_02'], ['events.oblivion_3_echo.say_3', 'v_valzard_oblivion_03'],
      ['events.oblivion_5_ouroboros.fine', 'v_fine_oblivion_01'], ['events.oblivion_5_ouroboros.fine_2', 'v_fine_oblivion_02']];
    const bad = pairs.filter(([k, v]) => T(k).replace(/\n/g, '') !== script[v] || !fs.existsSync(path.join(CHRON, 'assets', 'voice', v + '.ogg')));
    ok('ボイスの文は script.csv の行のまま・音のファイルがある', bad.length === 0, bad);
  }

  // ================================================================ 6
  section('6. 報酬とボスの AI');
  {
    const src = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'move.js'), 'utf8');
    ok('宝箱を開けるときマップの chestTier（9）を使う（move.js）', /m\.chestTier/.test(src));
    // 宝箱を本当に開ける（地下 1 階のレアの箱）: ★ の装備は手に入れたティア 9 の値（レア 11）で写る（今のティアは 8）
    newGame({ final_clear: true }); R.Game.tier = 8;
    const m1 = D.maps.oblivion_1, box = m1.objects.find((o) => o.id === 'oblivion_1_c1');
    const keep = { dirty: F.chunks && F.chunks.dirtyAt, refresh: F.hud && F.hud.refresh, run: F._run };
    if (F.chunks) F.chunks.dirtyAt = () => {}; if (F.hud) F.hud.refresh = () => {}; F._run = () => {};
    S.map = m1;
    const before = Object.keys(R.Game.items || {});
    F._openChest(box);
    const got = Object.keys(R.Game.items || {}).filter((k) => !before.includes(k));
    if (F.chunks) F.chunks.dirtyAt = keep.dirty; if (F.hud) F.hud.refresh = keep.refresh; F._run = keep.run; S.map = null;
    const it = got.map((k) => D.items[k]).find((x) => x && x.grow === 'drop');
    const u = it && R.Game.uniques && R.Game.uniques[got.find((k) => D.items[k] === it)];
    ok('地下 1 階の奥の箱（p_boss）: ★ の装備がティア 9 の値で手に入る（今のティア 8 でも）', !!it && !!u && u.tier >= 9, { got, u });
    const echo = D.monsters.b_valzard_echo, ou = D.monsters.b_ouroboros;
    ok('ボスの落とし物: 残影・円環竜とも p_boss（必ず）・レア・超レア（gear_tiers.md）', [echo, ou].every((b) => b.drops.normal.pool === 'p_boss' && b.drops.normal.rate === 1 && b.drops.rare && b.drops.super) && ou.drops.rare.item === 'ac_ouroboros_ring' && ou.drops.super.item === 'ac_sr_ouroboros');
    const AI = R.BattleAI;
    const acts = ou.actions.filter((a) => a.id === 'eb_rewind');
    const fake = (round, buffs, used) => ({ eng: { round, living: () => [{ buffs }], flags: {} }, u: { hpRate: () => 0.9, acts: round, used: {}, usedRound: used != null ? { eb_rewind: used } : {}, side: 'mon', isParty: false } });
    const can = (round, buffs, used) => acts.some((a) => { const f = fake(round, buffs, used); return AI.condOk(f.eng, f.u, a); });
    ok('円環竜の巻き戻し: 2 本（roundGap 4／roundGap 2 ＋ foeBuffsAtLeast 6）', acts.length === 2 && acts.some((a) => a.cond.roundGap === 4) && acts.some((a) => a.cond.roundGap === 2 && a.cond.foeBuffsAtLeast === 6));
    ok('… 3 ラウンド目までは使わない（強化なし）、4 ラウンド目に使える', !can(3, { atk: 1 }, null) && can(4, {}, null));
    ok('… 4 ラウンド目に使った後、6 では強化 5 段なら使わず 6 段なら前倒し', !can(6, { atk: 2, def: 3 }, 4) && can(6, { atk: 3, def: 3 }, 4));
    ok('… 前倒しでも 2 ラウンドはあける（5 ラウンド目は強化 6 段でも使わない）', !can(5, { atk: 6 }, 4));
    ok('… HP が 25% 以下では使わない', (() => { const f = fake(8, { atk: 9 }, 0); f.u.hpRate = () => 0.2; return !acts.some((a) => AI.condOk(f.eng, f.u, a)); })());
  }

  // ================================================================ 7
  section('7. 古いセーブ（クリア済み）');
  {
    newGame({ final_arrived: true, final_clear: true });
    const G = JSON.parse(JSON.stringify(R.State.serialize ? R.State.serialize() : R.Game));
    const g = G.game || G;
    delete (g.leads || {}).l_post_oblivion; g.warps = {};
    const okLoad = R.State.deserialize(G);
    ok('クリア済みの古いセーブを読む → 忘却の底の手がかり・ビブリアのワープが足される', okLoad && !!R.Game.leads.l_post_oblivion && R.Game.warps.biblia === true, { okLoad, leads: Object.keys(R.Game.leads || {}) });
    newGame({ final_arrived: true });
    const G2 = JSON.parse(JSON.stringify(R.State.serialize ? R.State.serialize() : R.Game));
    R.State.deserialize(G2);
    ok('… クリアの前のセーブには足さない', !R.Game.leads.l_post_oblivion);
  }

  // ================================================================ 8
  section('8. 文（5 言語）');
  {
    const files = ['src/maps/oblivion.js', 'src/events/oblivion.js', 'src/maps/final_biblia.js', 'src/data/locations_finale.js', 'src/events/final_archive.js'].map((f) => fs.readFileSync(path.join(V2, f), 'utf8')).join('\n');
    const keys = [...new Set([...files.matchAll(/R\.T\('([^']+)'/g)].map((m) => m[1]))].filter((k) => /oblivion/.test(k) && !/[._]$|\.s$/.test(k));
    const langs = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
    const tables = {};
    for (const l of langs) tables[l] = fs.readdirSync(path.join(V2, 'src', 'i18n', l)).map((f) => fs.readFileSync(path.join(V2, 'src', 'i18n', l, f), 'utf8')).join('\n');
    const miss = [];
    for (const k of keys.concat(['map.oblivion.oblivion_1.sub', 'map.oblivion.oblivion_5.sub', 'events.oblivion_stone.s4_2', 'events.oblivion_5_arrive.narr_2'])) for (const l of langs) if (!tables[l].includes(`'${k}'`)) miss.push(l + ' ' + k);
    ok(`忘却の底の key ${keys.length} 個が 5 言語の表にある`, keys.length > 20 && miss.length === 0, miss.slice(0, 10));
    ok('古い key events.archive_oblivion.narr_4（「別のお話」）は消した', langs.every((l) => !tables[l].includes("'events.archive_oblivion.narr_4'")));
  }
  done('test_oblivion');
})().catch((e) => { console.error(e); process.exitCode = 1; });
