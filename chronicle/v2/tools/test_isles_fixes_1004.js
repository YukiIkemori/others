#!/usr/bin/env node
// 持ち主の試遊（2026-10-04）の諸島の報告で直した物の戻りの確かめ: node v2/tools/test_isles_fixes_1004.js
//   1 船乗り組合の組合長は話すだけ（話の後に売り台が開かない）。組合の品は売り台の係（guild_clerk、売り台の内側）が売る。
//   2 コーラルの北の橋 → 白崖の道（i_cliff）: 着いた所（south 12,36）から北へ歩いて、描いた石の橋（x 12〜13、y 32〜37）を渡り切れる。
//     橋の幅 2 マスぜんぶが歩ける（fit.py が x 12 を岩にしていた → 見えない壁）。逆向き（i_cliff → コーラル）も橋を南へ渡って出られる。
//     生成の layout.json の rows_fit がマップの rows と同じ（作り直しても戻らない。fix.json の open）。
//   3 潮鳴りの洞窟の戦闘背景は描いた watercave。画像が読めないあいだの控え（コード）も洞窟（月夜の野原でない）。
//     どのマップ・出現表・編成の背景 id も描いた絵（assets/env/bbg/<id>/back.png）がある。
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
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
