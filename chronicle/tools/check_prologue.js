#!/usr/bin/env node
// Prologue conformance + balance probes (owner A18b; node, exit 1 on failure). DESIGN §10.7 and the rules it points to.
//
//   spec  — DESIGN.md is read at run time: every 「…」 line of the §10.7 table is in the prologue scripts (word for
//           word, line breaks ignored), the tutorial call equals §10.7 P8 / §9.11.7, the §10.13.9 event ids, the
//           §10.13.7 prologue flags (each given by some meta.gives), the §10.6.1 / §10.6.2 table rows (type, theme,
//           BGM, battle backdrop, zone), the §10.6.3 location map, the §10.6.4 secret passage of lighthouse_2,
//           DB.config.start (§10.7), and the obj_p_* objectives registered by the prologue (§13.1).
//   probe — the real battle engine (R.Battle.simulate, seeded):
//           T  the tutorial (tr_tutorial, hero alone, glimmerForce) for the 6 hero variants: win rate and the
//              guaranteed 閃き on the hero's first action (§4.9.6)
//           M4 zw_prologue with one Lv1–3 hero (§9.13.1 M4: win rate ≥ 97%)
//           C  the whole prologue as a campaign: solo world battles → tutorial → 3 random companions (the tavern's
//              join level) → world → lighthouse 1F–3F (zone battles by the floor's walking budget) → the rest lamp →
//              ページ食らい. Hero level at the boss (§10.7: Lv4–6), 閃き in the prologue (§4.9.5: ≥ 4 incl. the
//              tutorial), boss win rate (§12.3 B1: ≥ 85%), trash wipes.
//
//   node tools/check_prologue.js            both sections (≈ 25 s of CPU)
//   node tools/check_prologue.js spec       one section
//   node tools/check_prologue.js probe --runs 400 [--extra N: N more battles on 2F, sensitivity]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const origWarn = console.warn;
console.warn = () => {};
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true });
console.warn = origWarn;
const PM = require(path.join(ROOT, 'tools/lib/party_model'));
const DB = R.DB;

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
const warns = [];
/** a target that another area tunes (the check reports it; the owner is named in the message) */
function warn(cond, msg) { if (cond) passes++; else { warns.push(section + ': ' + msg); console.log('  WARN:', msg); } }
const report = [];
const measure = (k, v) => { report.push([section, k, v]); };
const argv = process.argv.slice(2);
const argN = (name, d) => { const i = argv.indexOf('--' + name); return i >= 0 ? Number(argv[i + 1]) : d; };

const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8').split('\n');
const SRC_FILES = ['src/events/prologue.js', 'src/events/prologue_roa.js', 'src/events/prologue_lute.js', 'src/events/prologue_lighthouse.js',
  'src/maps/prologue_00_kit.js', 'src/maps/prologue_roa.js', 'src/maps/prologue_lute.js', 'src/maps/prologue_lighthouse.js'];
const SRC = SRC_FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
/** the lines of DESIGN.md from the heading that starts with `head` to the next heading of the same or a higher level */
function sectionLines(head) {
  const s = DESIGN.findIndex((l) => l.startsWith(head));
  if (s < 0) return [];
  const lvl = head.match(/^#+/)[0].length;
  let e = s + 1;
  while (e < DESIGN.length && !(DESIGN[e].match(/^#+ /) && DESIGN[e].match(/^#+/)[0].length <= lvl)) e++;
  return DESIGN.slice(s, e);
}
const cells = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
const ticks = (s) => (s.match(/`[^`]+`/g) || []).map((t) => t.slice(1, -1));

// ============================================================ spec
function testSpec() {
  section = 'spec';
  console.log('[spec]');
  const norm = (t) => t.replace(/\\n|\\f|\n|\f|\s|　/g, '');
  const S = norm(SRC);
  const s107 = sectionLines('### 10.7 ');
  ok(s107.length > 10, '§10.7 found in DESIGN.md');
  let quotes = 0;
  for (const row of s107) {
    const id = (row.match(/^\| (P\d+)/) || [])[1];
    if (!id) continue;
    for (const q0 of row.match(/「[^「」]*」/g) || []) {
      const q = q0.replace('槍・弓・鞭の', '槍・弓・杖の');   // SYSTEMS_REWORK §3.7 (A19: the staff reaches, the whip is gone)
      quotes++;
      ok(S.includes(norm(q.slice(1, -1))), id + ' line in the scripts: ' + q.slice(0, 40));
    }
  }
  measure('§10.7 lines checked word for word', quotes);
  ok(quotes >= 30, 'at least 30 §10.7 lines found (' + quotes + ')');

  // the tutorial call (§10.7 P8 = §9.11.7 = §4.9.6, word for word)
  const call = s107.join('\n').match(/ev\.battle\((\{troop:'tr_tutorial'[^)]*\})\)/);
  ok(!!call, '§10.7 P8 tutorial call found');
  const mine = SRC.match(/const TUTORIAL = (\{[^;]*\});/);
  ok(!!mine, 'lighthouse_1_tutorial keeps the call in const TUTORIAL');
  if (call && mine) {
    const a = Function('return ' + call[1])(), b = Function('return ' + mine[1])();
    ok(JSON.stringify(a) === JSON.stringify(b), 'tutorial battle options equal §10.7 P8 (' + JSON.stringify(b) + ')');
    ok(/ev\.battle\(TUTORIAL\)/.test(SRC), 'the tutorial calls ev.battle(TUTORIAL)');
  }

  // §10.13.9: the prologue's event ids (the world row without common_* / world_*)
  const s1399 = sectionLines('#### 10.13.9 ');
  const worldRow = s1399.find((l) => /^\| world /.test(l));
  const evIds = ticks(worldRow || '').filter((id) => !/^(common_|world_)/.test(id));
  ok(evIds.length >= 13, '§10.13.9 prologue event ids found (' + evIds.length + ')');
  for (const id of evIds) ok(!!DB.events[id] && typeof DB.events[id].run === 'function', 'event ' + id + ' registered');
  measure('§10.13.9 prologue events registered', evIds.filter((id) => DB.events[id]).length + '/' + evIds.length);

  // §10.13.7: the prologue flags, each given by a prologue event's meta
  const flagRow = sectionLines('#### 10.13.7 ').find((l) => /^\| 序章 /.test(l));
  const flags = ticks(flagRow || '');
  ok(flags.length === 9, '§10.13.7 nine prologue flags (' + flags.length + ')');
  const own = Object.keys(DB.events).filter((id) => /^(roa_|lute_|lighthouse_)/.test(id));
  const gives = new Set();
  for (const id of own) for (const g of (DB.events[id].meta && DB.events[id].meta.gives) || []) gives.add(g);
  for (const f of flags) {
    if (f === 'hero_created') continue;
    ok(gives.has('flag:' + f), 'flag ' + f + ' is in some prologue meta.gives');
    ok(new RegExp("setFlag\\('" + f + "'\\)").test(SRC), 'flag ' + f + ' is set by a prologue script');
  }
  for (const k of ['k_lighthouse_key', 'k_chronicle', 'k_quill', 'k_bell', 'ac_otto_lantern']) {
    ok(gives.has('item:' + k), k + ' in meta.gives');
    ok(!!DB.items[k], k + ' exists in DB.items');
  }

  // §10.6.1 (towns) and §10.6.2 (dungeons) rows
  const townRows = sectionLines('#### 10.6.1 ').filter((l) => /^\| `(roa|lute)` /.test(l)).map(cells);
  ok(townRows.length === 2, '§10.6.1 rows for roa and lute');
  for (const c of townRows) {
    const id = ticks(c[0])[0], m = DB.maps[id];
    ok(!!m, 'map ' + id);
    if (!m) continue;
    ok(m.name === c[1], id + ' name ' + c[1] + ' (' + m.name + ')');
    ok(m.type === c[3] && m.theme === c[4], id + ' type/theme ' + c[3] + '/' + c[4] + ' (' + m.type + '/' + m.theme + ')');
    ok(m.bgm === ticks(c[5])[0], id + ' BGM ' + c[5] + ' (' + m.bgm + ')');
  }
  const lh = sectionLines('#### 10.6.2 ').map(cells).find((c) => c[0] === 'lighthouse');
  ok(!!lh, '§10.6.2 lighthouse row');
  if (lh) {
    for (const n of [1, 2, 3]) {
      const m = DB.maps['lighthouse_' + n];
      ok(!!m, 'map lighthouse_' + n);
      if (!m) continue;
      ok(String(m.name).startsWith(lh[1]), 'lighthouse_' + n + ' name starts with ' + lh[1] + ' (' + m.name + ')');
      ok(m.theme === ticks(lh[4])[0] && m.bbg === ticks(lh[5])[0] && m.bgm === ticks(lh[6])[0], 'lighthouse_' + n + ' theme/bbg/bgm ' + [m.theme, m.bbg, m.bgm]);
      ok(m.encounter === ticks(lh[7])[0], 'lighthouse_' + n + ' zone ' + m.encounter);
      ok(m.type === 'dungeon' && m.region === 'prologue' && m.location === 'lighthouse', 'lighthouse_' + n + ' type/region/location');
    }
  }
  // §10.6.3 location, §10.7 maps, the start
  for (const id of ['roa_house', 'roa']) ok(DB.maps[id] && DB.maps[id].location === 'roa', id + ' location roa');
  ok(DB.maps.lute && DB.maps.lute.location === 'lute', 'lute location lute');
  const start = DB.config && DB.config.start;
  ok(start && start.map === 'roa_house' && start.spawn === 'bed' && DB.maps.roa_house.spawns.bed, 'DB.config.start = roa_house / bed and the spawn exists');
  // §10.6.4: lighthouse_2 has the secret passage with p_supply and p_gold beyond it
  const l2 = DB.maps.lighthouse_2;
  const secretTiles = l2 ? l2.rows.join('').split('%').length - 1 : 0;
  ok(secretTiles >= 1 && secretTiles <= 3, 'lighthouse_2 secret passage 1–3 tiles (' + secretTiles + ')');
  const pools = new Set(((l2 && l2.chests) || []).map((c) => c.pool));
  ok(pools.has('p_supply') && pools.has('p_gold'), 'lighthouse_2 has p_supply and p_gold chests');
  const otherSecret = ['roa', 'roa_house', 'lute', 'lighthouse_1', 'lighthouse_3'].filter((id) => DB.maps[id] && DB.maps[id].rows.join('').includes('%'));
  ok(!otherSecret.length, 'no secret passage on the other prologue maps (' + otherSecret + ')');

  // §13.1: the prologue registers its own objectives obj_p_* and sets only those (plus the world's obj_regions)
  const objs = Object.keys(DB.objectives).filter((id) => /^obj_p_/.test(id));
  ok(objs.length === 4, 'four obj_p_* objectives (' + objs + ')');
  const set = (SRC.match(/setObjective\('([^']+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]);
  for (const id of set) ok(/^obj_p_/.test(id) || id === 'obj_regions', 'setObjective(' + id + ') has an allowed prefix');
  for (const id of set) ok(!!DB.objectives[id], 'objective ' + id + ' registered');
  const w = sectionLines('#### 10.13.8 ').filter((l) => /^\| `obj_w_/.test(l)).map(cells);
  for (const c of w) {
    const p = ticks(c[0])[0].replace('obj_w_', 'obj_p_');
    ok(DB.objectives[p] && DB.objectives[p].text === c[1].replace(/\\n/g, '\n'), p + ' text = §10.13.8 ' + ticks(c[0])[0]);
  }
}

// ============================================================ probe
function testProbe() {
  section = 'probe';
  console.log('[probe]');
  const runs = argN('runs', 60);
  R.State.newGame();
  const inv0 = () => ({ i_salve: 3 });
  const hero = (v, lv) => {
    const c = R.Rules.newChar({ id: 'hero', level: lv || 1, heroSpec: { name: 'ルカ', gender: 'f', type: v.heroType, favor: v.favor } });
    const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {};
    return c;
  };
  const known = (c) => (c.techs || []).length + (c.spells || []).length;
  const vName = (v) => v.heroType + '/' + v.favor.id;

  // ---- T: the tutorial
  let tWin = 0, tGlim = 0, tN = 0, tFirst = 0;
  for (const v of PM.HERO_VARIANTS) {
    for (let s = 0; s < 40; s++) {
      const h = hero(v);
      const before = known(h);
      const r = R.Battle.simulate({ party: [h], inv: inv0(), troop: 'tr_tutorial', members: ['hero'], glimmerForce: 'hero', canLose: true, noEscape: true, seed: 1000 + s, rewards: true });
      tN++;
      if (r.result === 'win') tWin++;
      const g = (r.glimmers || []).filter((x) => x.char === 'hero');
      if (g.length) tGlim++;
      const after = r.party && r.party[0];
      if (after && known(after) > before) tFirst++;
    }
  }
  measure('T tutorial win rate (6 hero variants × 40, Lv1 alone)', pct(tWin, tN));
  measure('T tutorial 閃き (hero)', pct(tGlim, tN));
  ok(tGlim === tN, 'T the hero always glimmers in the tutorial (' + tGlim + '/' + tN + ')');
  ok(tFirst === tN, 'T the learned action is kept on the CharState (' + tFirst + '/' + tN + ')');
  ok(tWin / tN >= 0.97, 'T tutorial win rate ≥ 97% (' + pct(tWin, tN) + '; losses retry in the event)');

  // ---- M4: zw_prologue, one hero Lv1–3
  const m4 = {};
  let mWin = 0, mN = 0;
  for (const v of PM.HERO_VARIANTS) {
    for (const lv of [1, 2, 3]) {
      let w = 0;
      for (let s = 0; s < 60; s++) {
        const r = R.Battle.simulate({ party: [hero(v, lv)], inv: inv0(), zone: 'zw_prologue', seed: 5000 + lv * 100 + s });
        if (r.result === 'win' || r.result === 'escape') w++;
      }
      m4[vName(v) + ' Lv' + lv] = w;
      mWin += w; mN += 60;
    }
  }
  const worst = Object.entries(m4).sort((a, b) => a[1] - b[1])[0];
  measure('M4 zw_prologue solo Lv1–3 win rate (6 variants × 3 levels × 60)', pct(mWin, mN) + ' (worst ' + worst[0] + ' ' + pct(worst[1], 60) + ')');
  ok(mWin / mN >= 0.97, 'M4 zw_prologue solo win rate ≥ 97% (' + pct(mWin, mN) + ')');

  // ---- C: the whole prologue as a campaign
  const comps = Object.keys(DB.companions);
  const plan = [ // [zone, battles, lvOff] — battle counts from test_prologue's walking budget (encRate 22, first visit ×2.5)
    ['solo', 'zw_prologue', 3],       // roa → lute (≈10 world tiles + a little wandering) and back and forth
    ['tutorial'],
    ['party'],
    ['walk', 'zw_prologue', 5],       // lute → the lighthouse cape
    ['walk', 'z_prologue_lighthouse', 9, 0],  // 1F (the store rooms)
    ['walk', 'z_prologue_lighthouse', 12 + argN('extra', 0), 2], // 2F (the spiral, lvOff 2); --extra N adds battles (sensitivity)
    ['rest'],                          // the rest lamp before the boss (§10.6.2-5)
    ['walk', 'z_prologue_lighthouse', 1, 0],  // 3F landing
    ['boss'],
  ];
  let seed = 90000;
  let rs = 4242; // a private PRNG for the companion picks (the engine's seed is set per battle)
  const rnd = (n) => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return Math.floor((rs / 0x80000000) * n); };
  const bossWins = [], lvAtBoss = [], compLv = [], glimTotal = [], trashWipes = [], battlesTotal = [];
  const byVariant = {};
  for (let run = 0; run < runs; run++) {
    const v = PM.HERO_VARIANTS[run % PM.HERO_VARIANTS.length];
    let party = [hero(v)];
    let inv = inv0();
    let glim = 0, wipes = 0, n = 0, bossWin = false;
    const pick = [];
    while (pick.length < 3) { const id = comps[rnd(comps.length)]; if (!pick.includes(id)) pick.push(id); }
    const fight = (o) => {
      const r = R.Battle.simulate(Object.assign({ party, inv, seed: seed++, rewards: true }, o));
      n++;
      glim += (r.glimmers || []).length;
      if (r.result === 'win' || r.result === 'escape') {
        party = r.party; inv = r.inv;
        PM.afterBattle(R, party, r.result);
      } else {
        // a wipe: the player is sent back to the last inn (full heal, keeps EXP gained before)
        for (const c of party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {}; }
      }
      return r;
    };
    for (const step of plan) {
      if (step[0] === 'solo' || step[0] === 'walk') {
        for (let i = 0; i < step[2]; i++) {
          const r = fight({ zone: step[1], lvOff: step[3] || 0 });
          if (!(r.result === 'win' || r.result === 'escape')) wipes++;
        }
        if (step[0] === 'solo') for (const c of party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.wp = st.wp; } // the inn in Faros
      } else if (step[0] === 'tutorial') {
        for (let k = 0; k < 5; k++) {
          const r = fight({ troop: 'tr_tutorial', members: ['hero'], glimmerForce: 'hero', canLose: true, noEscape: true });
          if (r.result === 'win') break;
        }
      } else if (step[0] === 'party') {
        const joinLv = Math.max(1, Math.floor(party[0].level * ((R.Rules.K && R.Rules.K.JOIN_LEVEL) || 0.9)));
        for (const id of pick) {
          const c = R.Rules.newChar({ id, level: joinLv });
          const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {};
          party.push(c);
        }
        inv.i_salve = (inv.i_salve || 0) + 4; // 50 gold from the master + the first battles' gold → a few salves in Faros
      } else if (step[0] === 'rest') {
        for (const c of party) { const st = R.Rules.stats(c); c.hp = st.hp; c.mp = st.mp; c.status = {}; }
      } else if (step[0] === 'boss') {
        lvAtBoss.push(party[0].level);
        for (const c of party.slice(1)) compLv.push(c.level);
        const r = R.Battle.simulate({ party, inv, troop: 'tr_b_pageeater', seed: seed++, rewards: true });
        n++;
        glim += (r.glimmers || []).length;
        bossWin = r.result === 'win';
      }
    }
    bossWins.push(bossWin ? 1 : 0);
    glimTotal.push(glim);
    trashWipes.push(wipes);
    battlesTotal.push(n);
    const k = vName(v);
    (byVariant[k] = byVariant[k] || []).push(bossWin ? 1 : 0);
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
  measure('C runs (hero variant cycles, 3 random companions of 20)', runs);
  measure('C battles in the prologue (mean)', mean(battlesTotal).toFixed(1));
  measure('C hero level at the boss (mean / p10 / p90)', mean(lvAtBoss).toFixed(2) + ' / ' + q(lvAtBoss, 0.1) + ' / ' + q(lvAtBoss, 0.9));
  measure('C companion level at the boss (mean)', mean(compLv).toFixed(2));
  measure('C 閃き in the prologue, whole party incl. the tutorial (mean / p10)', mean(glimTotal).toFixed(2) + ' / ' + q(glimTotal, 0.1));
  measure('C trash wipes per prologue (mean)', mean(trashWipes).toFixed(3));
  measure('C boss ページ食らい win rate', pct(mean(bossWins) * runs, runs));
  for (const k in byVariant) measure('C boss win rate, hero ' + k, pct(mean(byVariant[k]) * byVariant[k].length, byVariant[k].length));
  ok(mean(lvAtBoss) >= 4 && mean(lvAtBoss) <= 6, 'C hero level at the boss in Lv4–6 (§10.7; ' + mean(lvAtBoss).toFixed(2) + ')');
  // the glimmer rate is R.Glimmer's (A8 spells, §4.9.4); the prologue only supplies the battles (≈ 35)
  warn(mean(glimTotal) >= 4, 'C ≥ 4 閃き in the prologue on average (§4.9.5; ' + mean(glimTotal).toFixed(2) + ' — rate owned by A8 R.Glimmer)');
  ok(mean(bossWins) >= 0.85, 'C boss win rate ≥ 85% (§12.3 B1; ' + pct(mean(bossWins) * runs, runs) + ')');
  ok(mean(trashWipes) <= 0.05, 'C trash wipes ≤ 0.05 per prologue (' + mean(trashWipes).toFixed(3) + ')');
}
function pct(a, b) { return b ? (Math.round((1000 * a) / b) / 10) + '%' : '—'; }

// ============================================================ run
const want = argv.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const t0 = Date.now();
if (!want.length || want.includes('spec')) testSpec();
if (!want.length || want.includes('probe')) testProbe();
console.log('\nmeasured:');
for (const [s, k, v] of report) console.log('  [' + s + '] ' + k + ': ' + v);
if (warns.length) { console.log('\nwarnings (targets tuned by other areas):'); for (const w of warns) console.log('  ' + w); }
if (failed.length) { console.log('\nfailed:'); for (const f of failed) console.log('  ' + f); }
console.log('\ncheck_prologue: ' + passes + ' passed, ' + fails + ' failed, ' + warns.length + ' warning(s) (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
process.exit(fails ? 1 : 0);
