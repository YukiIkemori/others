#!/usr/bin/env node
// 持ち主の試遊（2026-10-04）の諸島の報告で直した物の戻りの確かめ: node v2/tools/test_isles_fixes_1004.js
//   1 船乗り組合の組合長は話すだけ（話の後に売り台が開かない）。組合の品は売り台の係（guild_clerk、売り台の内側）が売る。
//   2 コーラルの北の橋 → 白崖の道（i_cliff）: 着いた所（south 12,36）から北へ歩いて、描いた石の橋（x 12〜13、y 32〜37）を渡り切れる。
//     橋の幅 2 マスぜんぶが歩ける（fit.py が x 12 を岩にしていた → 見えない壁）。逆向き（i_cliff → コーラル）も橋を南へ渡って出られる。
//     生成の layout.json の rows_fit がマップの rows と同じ（作り直しても戻らない。fix.json の open）。
//   3 潮鳴りの洞窟の戦闘背景は描いた watercave。画像が読めないあいだの控え（コード）も洞窟（月夜の野原でない）。
//     どのマップ・出現表・編成の背景 id も描いた絵（assets/env/bbg/<id>/back.png）がある。
//   4 外洋船（isles_ship）の泊め場: コーラル・ネレイ・島 4 つで、船の後だけ船の絵（ship／ship_small）が桟橋の脇の海に泊まり、
//     絵（船体・帆柱・帆桁・帆綱）が桟橋の板（'='）にも歩けるマスにも重ならない。舵（isles_helm／isles_boat）は桟橋の歩けるマスから向いて調べる海のマス。
//     道しるべの印（wayfind の marks「→ 外洋船の舵」）が船の後だけ出る。幽霊船の甲板の下の船は渡り板にかからない。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const GEN = path.resolve(V2, '..', 'design/art_ref/gen/env/_tools/under/field_isles');
const R = require('./lib/load')({ quiet: true, dev: true });
R.DB.config.slice = false;
R.State.newGame({ seed: 1 });
const D = R.DB, F = R.Field, S = F._s, I = R.Input;

const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(50); await flush(); } }
async function hold(btns, ms) {
  for (const b of [].concat(btns)) I._set(b, true);
  for (let t = 0; t < ms; t += 16.67) { adv(16.67); await flush(); }
  for (const b of [].concat(btns)) I._set(b, false);
}
async function step(b) {
  await hold(b, 34);
  for (let i = 0; i < 40 && (S.mv || S.arriving); i++) { adv(16.67); await flush(); }
  await settle(60);
}
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);

function fakeEv() {
  const G = R.Game, log = [];
  const ev = {
    flag: (k) => !!G.flags[k], setFlag: (k, v) => { G.flags[k] = v === undefined ? true : v; },
    has: (id) => (G.items[id] || 0) > 0, item: (id, n) => { G.items[id] = (G.items[id] || 0) + (n || 1); }, lead: () => {},
    say: async (who, t) => { log.push(['say', who, t]); }, choose: async (l) => { log.push(['choose', l]); return ev._pick || 0; },
    shop: async (id) => { log.push(['shop', id]); },
  };
  return { ev, log };
}

async function main() {
  // ================================================================ 1
  section('1. 船乗り組合: 組合長は話すだけ、売り台は係');
  {
    const g = D.maps.coral_guild;
    const master = g.npcs.find((n) => n.id === 'guild_master'), clerk = g.npcs.find((n) => n.id === 'guild_clerk');
    ok('組合に組合長と売り台の係がいる', !!master && !!clerk, g.npcs.map((n) => n.id));
    const below = clerk && (g.objects || []).find((o) => o.x === clerk.x && o.y === clerk.y + 1 && JSON.stringify(o).includes('counter'));
    ok('係は売り台の内側（すぐ下が売り台）で南を向き、押せない', !!clerk && clerk.dir === 's' && clerk.pushable === false && !!below, { clerk, below });
    const G = R.Game;
    const cases = [
      ['初めて・引き受ける', () => {}, 0],
      ['初めて・やめる', () => { delete G.flags.isles_delivery_on; G.items.k_guild_parcel = 0; }, 1],
      ['荷を持っている', () => { G.flags.isles_delivery_on = true; G.items.k_guild_parcel = 1; }, 0],
      ['配達のあと', () => { G.flags.isles_delivery_done = true; G.items.k_guild_parcel = 0; }, 0],
    ];
    for (const [name, prep, pick] of cases) {
      prep();
      const f = fakeEv(); f.ev._pick = pick;
      await D.events.coral_guild_master.run(f.ev, {});
      ok(`組合長（${name}）: 売り台を開かず、話して終わる`, !f.log.some((l) => l[0] === 'shop') && f.log.some((l) => l[0] === 'say' && l[1] === 'guild_master'), f.log);
    }
    const f = fakeEv();
    await D.events.coral_guild_clerk.run(f.ev, {});
    ok('係: ひとこと言ってから組合の売り台（shop_coral_guild）を開く', f.log.length === 2 && f.log[0][0] === 'say' && f.log[0][1] === 'guild_clerk' && f.log[1][0] === 'shop' && f.log[1][1] === 'shop_coral_guild', f.log);
    ok('組合の売り台の品がそろう', !!D.shops.shop_coral_guild && D.shops.shop_coral_guild.items.length > 0);
    for (const l of ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko']) {
      const src = ['events_isles.js', 'maps_isles.js'].map((f) => fs.readFileSync(path.join(V2, 'src/i18n', l, f), 'utf8')).join('\n');
      ok(`i18n ${l}: 係の名前・係の言葉・組合長の新しい言葉`, ['coral_guild.npcs.2.guild_clerk.name', 'events.coral_guild_clerk.say', 'events.coral_guild_master.say_5'].every((k) => src.includes(`'${k.startsWith('coral') ? 'map.isles_coral_interiors.' + k : k}'`)));
    }
  }

  // ================================================================ 2
  section('2. コーラルの北の橋 → 白崖の道');
  {
    const m = D.maps.i_cliff, sp = m.spawns.south;
    ok('白崖の道の south はコーラルからの着き場（12,36・北向き）', sp.x === 12 && sp.y === 36 && sp.dir === 'n', sp);
    const bad = [];
    for (let y = 32; y <= 37; y++) for (const x of [12, 13]) if (!pass(m, x, y)) bad.push([x, y]);
    ok('描いた橋（x 12〜13、y 32〜37）の幅ぜんぶが歩ける', bad.length === 0, bad);
    ok('橋の欄干の外（x 11・x 14、y 33〜37）は歩けない', [33, 34, 35, 36, 37].every((y) => !pass(m, 11, y) && !pass(m, 14, y)));
    const L = JSON.parse(fs.readFileSync(path.join(GEN, 'i_cliff', 'layout.json'), 'utf8'));
    ok('生成の rows_fit がマップの rows と同じ', JSON.stringify(L.rows_fit) === JSON.stringify(m.rows));
    const fx = JSON.parse(fs.readFileSync(path.join(GEN, 'i_cliff', 'fix.json'), 'utf8'));
    ok('fix.json の open に橋の x 12（fit.py の作り直しで戻らない）', [32, 33, 34, 35].every((y) => (fx.open || []).some((q) => q[0] === 12 && q[1] === y && q[2] === '=')));

    // 本当に歩く: コーラルの北の出口 → 白崖の道（着いた所から北へ）
    const ex = D.maps.coral.exits.find((e) => e.to.map === 'i_cliff');
    ok('コーラルの北の出口は白崖の道の south へ', !!ex && ex.to.spawn === 'south');
    for (const x0 of [12, 13]) {
      await F.enter('i_cliff', { x: x0, y: 36, dir: 'n' }, { fade: 0, noAutosave: true }); await settle(200);
      const path_ = [];
      for (let i = 0; i < 8; i++) { await step('up'); path_.push(F.pos.y); }
      ok(`白崖の道: 橋の x ${x0} から北へ 8 歩で橋を渡り切る（y ≤ 30）`, S.map.id === 'i_cliff' && F.pos.y <= 30 && F.pos.x === x0, { x: F.pos.x, path: path_ });
    }
    // 逆向き: 橋の上から南へ歩いてコーラルへ出る
    await F.enter('i_cliff', { x: 12, y: 31, dir: 's' }, { fade: 0, noAutosave: true }); await settle(200);
    for (let i = 0; i < 9 && S.map.id === 'i_cliff'; i++) await step('down');
    await settle(2500);
    ok('白崖の道: 橋の x 12 を南へ歩いてコーラルの北に出る', S.map.id === 'coral' && F.pos.y <= 3, { map: S.map.id, x: F.pos.x, y: F.pos.y });
    // コーラルの側: 着いた所（north 22,1）から南へ歩ける
    const c = D.maps.coral, cn = c.spawns.north;
    ok('コーラル: 北の橋の着き場から南へ 3 マス歩ける（橋の幅 4 マス）', [1, 2, 3].every((d) => pass(c, cn.x, cn.y + d)) && [21, 22, 23, 24].every((x) => pass(c, x, 1)));
    // 諸島のエリアのつなぎ目: 着き場から向いた方へ 2 マス以上歩ける（同じ見えない壁が他に無いこと）
    const DIR = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
    const stuck = [];
    for (const id of Object.keys(D.maps).filter((k) => D.maps[k].region === 'r_isles' && D.maps[k].kind !== 'interior')) {
      for (const e of D.maps[id].exits || []) {
        const t = D.maps[e.to.map], s = t && t.spawns[e.to.spawn];
        if (!s || t.kind === 'interior') continue;
        const d = DIR[s.dir] || [0, 0];
        if (!(pass(t, s.x + d[0], s.y + d[1]) && pass(t, s.x + 2 * d[0], s.y + 2 * d[1]))) stuck.push(`${id} → ${e.to.map}.${e.to.spawn}`);
      }
    }
    ok('諸島のエリアの出入りの着き場はどれも向いた方へ 2 マス歩ける', stuck.length === 0, stuck);
  }

  // ================================================================ 3
  section('3. 潮鳴りの洞窟の戦闘背景');
  {
    const ids = new Map();
    const add = (id, w) => { if (id) ids.set(id, (ids.get(id) || []).concat(w)); };
    for (const [k, m] of Object.entries(D.maps)) add(m.bbg, k);
    for (const [k, z] of Object.entries(D.encounters || {})) add(z.bg, k);
    for (const [k, t] of Object.entries(D.troops || {})) add(t.bg, k);
    ok('潮鳴りの洞窟（1・2 階・出現表・大ダコ）の背景は watercave', ['isles_cave_1', 'isles_cave_2'].every((k) => D.maps[k].bbg === 'watercave') &&
      D.encounters.z_r_isles_cave.bg === 'watercave' && D.troops.tr_b_octopus.bg === 'watercave');
    const miss = [...ids.keys()].filter((id) => !fs.existsSync(path.join(V2, 'assets/env/bbg', id, 'back.png')));
    ok('マップ・出現表・編成の背景 id はどれも描いた絵がある', miss.length === 0, miss.map((id) => id + ' ← ' + ids.get(id).slice(0, 4).join(',')));
    const src = fs.readFileSync(path.join(V2, 'src/art/bbg/bbg_regions.js'), 'utf8');
    ok('watercave の控え（画像が読めないとき）はコードの洞窟（like: cave）', /watercave: \{[^}]*like: 'cave'/.test(src) && /K\.caveDef = def/.test(fs.readFileSync(path.join(V2, 'src/art/bbg/bbg_cave.js'), 'utf8')));
  }
  // ================================================================ 4
  section('4. 外洋船の泊め場（船の絵・舵・道しるべ）');
  {
    const G = R.Game;
    const SPOTS = { coral: 'isles_helm', nerei: 'isles_helm', i_light: 'isles_boat', i_siren: 'isles_boat', i_crab: 'isles_boat', i_wreck: 'isles_boat' };
    // 絵の形（32 の論理 px。props.js の drawShip: 船体 −74〜+80・甲板の上 −48、帆柱 +14 の −98 まで、帆桁 −22〜+50 の −82、帆綱は帆柱の先から ±）
    const shape = (o) => {
      const k = o.id === 'ship_small' ? 0.72 : 1, cx = (o.x + 0.5 + (o.dx || 0)) * 32, fy = (o.y + 0.84) * 32;
      const boxes = [[cx - 74 * k, fy - 48 * k, cx + 80 * k, fy], [cx + 12 * k, fy - 98 * k, cx + 16 * k, fy], [cx - 22 * k, fy - 83 * k, cx + 50 * k, fy - 75 * k]];
      const lines = [[cx + 14 * k, fy - 98 * k, cx + 72 * k, fy - 24 * k], [cx + 14 * k, fy - 98 * k, cx - 60 * k, fy - 26 * k]];
      return { boxes, lines };
    };
    const cellsOf = (sh) => {
      const set = new Set(), add = (px, py) => set.add(Math.floor(px / 32) + ',' + Math.floor(py / 32));
      for (const [x0, y0, x1, y1] of sh.boxes) for (let x = x0 + 2; x <= x1 - 2; x += 4) for (let y = y0 + 2; y <= y1 - 2; y += 4) add(x, y);
      for (const [x0, y0, x1, y1] of sh.lines) for (let i = 0; i <= 40; i++) add(x0 + (x1 - x0) * i / 40, y0 + (y1 - y0) * i / 40);
      return [...set].map((q) => q.split(',').map(Number));
    };
    G.flags.isles_ship = false; R.MapUtil.invalidate && R.MapUtil.invalidate();
    for (const id of Object.keys(SPOTS)) {
      const m = D.maps[id];
      const ships = (m.objects || []).filter((o) => o.mooredShip);
      const helms = (m.objects || []).filter((o) => o.helm);
      ok(`${id}: 泊めた外洋船の絵 1 つと舵 2 つ以上（isles_ship の後だけ）`, ships.length === 1 && helms.length >= 2 && [...ships, ...helms].every((o) => o.cond === 'isles_ship') && !R.State.check('isles_ship'), { ships: ships.length, helms: helms.length });
      ok(`${id}: 舵の印（way）は船の前だけ出ない`, F.wayfind.info(m).marks.length === 0);
    }
    G.flags.isles_ship = true; R.MapUtil.invalidate && R.MapUtil.invalidate();
    for (const [id, evId] of Object.entries(SPOTS)) {
      const m = D.maps[id];
      const ship = (m.objects || []).find((o) => o.mooredShip);
      const helms = (m.objects || []).filter((o) => o.helm);
      const W = m.rows[0].length, H = m.rows.length;
      const bad = [];
      for (const [x, y] of cellsOf(shape(ship))) {
        if (x < 0 || y < 0 || x >= W || y >= H) { bad.push(`${x},${y} 外`); continue; }
        if (m.rows[y][x] === '=' || pass(m, x, y)) bad.push(`${x},${y} ${m.rows[y][x]}`);
      }
      ok(`${id}: 船の絵（${ship.id} ${ship.x},${ship.y}）が桟橋の板・歩けるマス・マップの外に重ならない`, bad.length === 0, bad);
      const hb = [];
      for (const h of helms) {
        const from = [[0, -1], [0, 1], [1, 0], [-1, 0]].map(([dx, dy]) => [h.x + dx, h.y + dy]).filter(([x, y]) => pass(m, x, y) && m.rows[y][x] === '=');
        if (pass(m, h.x, h.y) || !from.length || h.event !== evId) hb.push(h);
      }
      ok(`${id}: 舵は海のマスで、桟橋の歩けるマスから向いて調べられる（${evId}）`, hb.length === 0, hb);
      const near = helms.every((h) => Math.abs(h.x - ship.x - (ship.dx || 0)) <= 4 && Math.abs(h.y - ship.y) <= 3);
      ok(`${id}: 舵は船のすぐ脇`, near, { ship, helms: helms.map((h) => [h.x, h.y]) });
      ok(`${id}: 道しるべの印「外洋船の舵」が船の後に出る`, F.wayfind.info(m).marks.length === 1 && /外洋船の舵/.test(F.wayfind.info(m).marks[0].label), F.wayfind.info(m).marks);
      ok(`${id}: 古い「桟橋の先のマスの舵」は残っていない`, !(m.objects || []).some((o) => (o.event === 'isles_helm' || o.event === 'isles_boat') && !o.helm));
    }
    // 人魚の歌う岩: 船尾の下の浅瀬は船のあいだ海
    R.MapUtil.invalidate && R.MapUtil.invalidate();
    ok('i_siren: 船尾の下の浅瀬（32,17）は外洋船の後は歩けない', !pass(D.maps.i_siren, 32, 17));
    // 幽霊船の甲板の下の船は渡り板（x 28〜29）にかからない
    {
      const gs = D.maps.ghost_ship_1, sh = (gs.objects || []).find((o) => o.type === 'prop' && o.id === 'ship');
      const over = cellsOf(shape(sh)).filter(([x, y]) => gs.rows[y] && (gs.rows[y][x] === '=' || pass(gs, x, y)));
      ok('ghost_ship_1: 渡り板の下の外洋船の絵が渡り板・甲板に重ならない', over.length === 0, over);
    }
    // 舵を調べると行き先を聞く（コーラル）
    {
      const log = [];
      const ev = { flag: (k) => !!G.flags[k], choose: async (l, o) => { log.push(['choose', o && o.text]); return l.length - 1; }, say: async () => { log.push(['say']); }, call: async () => {} };
      await D.events.isles_helm.run(ev, { map: 'coral' });
      ok('コーラルの舵: 外洋船の後は「どこへ向かう？」を聞く', log.length === 1 && log[0][0] === 'choose', log);
    }
    // 渡したときのドレイクの言葉と手がかりが泊め場を言う
    const ja = fs.readFileSync(path.join(V2, 'src/i18n/ja/events_isles.js'), 'utf8');
    ok('ドレイク（外洋船を渡すとき）: 真ん中の桟橋の東に泊めてある・桟橋から船に向かって調べる', /'events\.isles_ship_launch\.say_2': '[^']*桟橋の東[^']*船に向かって/.test(ja));
    ok('手がかり「海図の空白」: コーラルの港に泊めた外洋船の舵', /'leads\.l_isles_chart\.text': '[^']*コーラルの\\n港に泊めた外洋船の舵/.test(ja));
    for (const l of ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko']) ok(`i18n ${l}: 舵の印の札`, fs.readFileSync(path.join(V2, 'src/i18n', l, 'maps_isles.js'), 'utf8').includes("'map.isles_00_kit.moor.way'"));
  }
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
