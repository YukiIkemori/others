#!/usr/bin/env node
// test_qa.js (owner qa A22) — unit tests of the QA tools themselves (node, exit 1 on a failure).
//   Q1  tools/lib/cond.js: the §3.2.3 grammar, and exact parity with R.State.check on random states × conditions
//   Q2  tools/lib/maps.js: parseMap reads what R.FieldMap.compile reads (tiles, spawns, npcs, warps, secrets)
//   Q3  tools/lib/party_model.js: PM.build (members, levels, EXPECT(T) actions, full HP, status {}), levelAt / profAt,
//       withGame restores R.Game, the §8.13.1 sets of gear-a at T8, COMBOS / HERO_VARIANTS
//   Q4  validate.js on tools/fixtures/qa/bad: each planted fault is reported (V1 V2 V3 V4 V5 V10 V14 CH4 CH6 CH7)
//   Q5  progress.js on tools/fixtures/qa/world: the BFS, warp conds, meta.calls, and the Part A4 secret-passage rule
//   Q6  check_text.js: width, string extraction (comments skipped, ${…} dropped), spacing / ellipsis rules, STYLE_JA lists
//   Q7  playthrough.js: the dry-run ev (unknown API calls reported, nested ev.call gives belong to the callee)
//   Q8  shots.js / smoke.js: the shot list covers §11.12.2 #1–#22; --only parsing
//   Q9  check_density.js: every town/house map is measured, rooms are found on each, walled streets are not rooms
//   node tools/test_qa.js [--verbose]
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

let pass = 0, fail = 0;
const fails = [];
function ok(c, name) { if (c) { pass++; if (VERBOSE) console.log('  ✓ ' + name); } else { fail++; fails.push(name); console.log('  ✗ ' + name); } }
function eq(a, b, name) { const s = JSON.stringify(a) === JSON.stringify(b); ok(s, s ? name : `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
function section(n) { console.log(n); }

// deterministic PRNG for the random parity test
function rng(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

(async function main() {
  const t0 = Date.now();
  const Cond = require('./lib/cond');
  const M = require('./lib/maps');
  const PM = require('./lib/party_model');
  const R = require('./lib/load')({ quiet: true });
  R.warn = () => {};
  const DB = R.DB;

  // ------------------------------------------------------------------------------------------ Q1
  section('Q1 cond.js');
  {
    const S = Cond.fromSets({ flags: ['a', 'b'], items: ['k_x'], cleared: ['r_forest'], tier: 3, members: ['marta'], recruited: ['sylvain'], vars: { n: 2 }, gender: 'f', heroType: 'mage' });
    const T = (c, want, name) => eq(Cond.check(c, S), want, `check ${name || JSON.stringify(c)}`);
    T(null, true); T(undefined, true, 'undefined'); T(true, true); T(false, false); T('', true, "''");
    T('a', true); T('!a', false); T('zz', false); T('!zz', true);
    T(['a', 'b'], true); T(['a', 'zz'], false); T([], true);
    T({ flag: 'a', notFlag: 'zz' }, true); T({ flag: 'a', notFlag: 'b' }, false);
    T({ item: 'k_x' }, true); T({ notItem: 'k_x' }, false);
    T({ all: ['a', { item: 'k_x' }] }, true); T({ any: ['zz', 'b'] }, true); T({ any: ['zz', 'yy'] }, false);
    T({ tier: 3 }, true); T({ tier: 4 }, false); T({ tierBelow: 4 }, true); T({ tierBelow: 3 }, false);
    T({ cleared: 'r_forest' }, true); T({ notCleared: 'r_forest' }, false); T({ cleared: 'r_star' }, false);
    T({ member: 'marta' }, true); T({ member: 'sylvain' }, false); T({ recruited: 'sylvain' }, true); T({ recruited: 'marta' }, true); T({ recruited: 'viola' }, false);
    T({ hero: 'f' }, true); T({ hero: 'm' }, false); T({ heroType: 'mage' }, true); T({ heroType: 'warrior' }, false);
    T({ var: 'n' }, true); T({ var: 'zz' }, false); T({ var: 'n', gte: 2 }, true); T({ var: 'n', lt: 2 }, false); T({ var: 'n', eq: 2 }, true);
    T({ postgame: false }, true); T({ postgame: true }, false);
    T({ flag: 'a', tier: 9 }, false, 'several keys must all hold');
    eq(Cond.check('game_clear', Cond.fromSets({ postgame: true })), true, 'game_clear follows postgame in fromSets');
    const refs = Cond.refs([{ flag: 'x', any: [{ item: 'k_y' }, '!z'] }, { var: 'v', gte: 1, cleared: 'r_ash' }]);
    eq([refs.flags.sort(), refs.items, refs.vars, refs.regions], [['x', 'z'], ['k_y'], ['v'], ['r_ash']], 'refs collects flags, items, vars, regions');
    ok(Cond.validate({ flagg: 'x' }).some((p) => /unknown condition key 'flagg'/.test(p)), 'validate: unknown key');
    ok(Cond.validate({ tier: '3' }).some((p) => /tier must be a number/.test(p)), 'validate: tier type');
    ok(Cond.validate({ gte: 1 }).some((p) => /without var/.test(p)), 'validate: gte without var');
    ok(Cond.validate({ item: 'k_nope' }, { items: DB.items }).some((p) => /unknown item/.test(p)), 'validate: unknown item id');
    eq(Cond.validate(['a', { any: [{ tier: 2 }, { cleared: 'r_forest' }] }], { regions: DB.regions }), [], 'validate: a good condition has no problems');

    // parity with the game's R.State.check on random states × random conditions
    if (R.State && R.State.newGame && R.State.check) {
      const rnd = rng(20260926);
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      const FL = ['f1', 'f2', 'f3', 'game_clear', 'cleared_r_forest'];
      const IT = Object.keys(DB.items).filter((id) => /^k_/.test(id)).slice(0, 3).concat(['i_herb']);
      const RG = ['r_forest', 'r_desert', 'r_snow'];
      const CP = ['brigitta', 'marta', 'sylvain', 'viola'];
      const atom = () => {
        switch (Math.floor(rnd() * 16)) {
          case 0: return pick(FL);
          case 1: return '!' + pick(FL);
          case 2: return { flag: pick(FL) };
          case 3: return { notFlag: pick(FL) };
          case 4: return { item: pick(IT) };
          case 5: return { notItem: pick(IT) };
          case 6: return { tier: Math.floor(rnd() * 5) };
          case 7: return { tierBelow: Math.floor(rnd() * 5) };
          case 8: return { cleared: pick(RG) };
          case 9: return { notCleared: pick(RG) };
          case 10: return { member: pick(CP) };
          case 11: return { recruited: pick(CP) };
          case 12: return { hero: pick(['m', 'f']) };
          case 13: return { heroType: pick(['warrior', 'mage', 'spellblade']) };
          case 14: { const c = { var: pick(['v1', 'v2']) }; const k = pick(['gte', 'lt', 'eq', null]); if (k) c[k] = Math.floor(rnd() * 4); return c; }
          default: return { postgame: rnd() < 0.5 };
        }
      };
      const gen = (d) => { const r = rnd(); if (d > 2 || r < 0.45) return atom(); if (r < 0.65) return [gen(d + 1), gen(d + 1)]; if (r < 0.8) return { all: [gen(d + 1), gen(d + 1)] }; if (r < 0.95) return { any: [gen(d + 1), gen(d + 1)] }; return Object.assign({}, atom(), atom()); };
      let diffs = 0, n = 0, firstDiff = null;
      const saved = R.Game;
      for (let st = 0; st < 24; st++) {
        try {
          R.State.newGame({ name: 'テスト', gender: pick(['m', 'f']), type: pick(['warrior', 'mage', 'spellblade']), favor: { kind: 'weapon', id: 'sword' } });
        } catch (e) { R.State.newGame(); }
        const g = R.Game;
        for (const f of FL) if (rnd() < 0.4) R.State.setFlag(f);
        for (const i of IT) if (rnd() < 0.4 && DB.items[i]) R.State.addItem(i, 1);
        g.tier = Math.floor(rnd() * 6);
        g.regionsCleared = RG.filter(() => rnd() < 0.4);
        for (const c of CP) if (rnd() < 0.5 && R.Party && R.Party.recruit) { try { R.Party.recruit(c, { toParty: rnd() < 0.5, catchUp: false }); } catch (e) { /* ignore */ } }
        g.vars = { v1: Math.floor(rnd() * 4), v2: Math.floor(rnd() * 4) };
        g.gameClear = rnd() < 0.3;
        const A = Cond.fromGame(R);
        for (let k = 0; k < 60; k++) {
          const c = gen(0);
          const a = Cond.check(c, A), b = !!R.State.check(c);
          n++;
          if (a !== b) { diffs++; if (!firstDiff) firstDiff = { c, a, b }; }
        }
      }
      R.Game = saved;
      ok(diffs === 0, `parity with R.State.check: ${n} random conditions × states, ${diffs} difference(s)${firstDiff ? ' e.g. ' + JSON.stringify(firstDiff) : ''}`);
    } else ok(true, 'parity skipped (R.State missing)');
  }

  // ------------------------------------------------------------------------------------------ Q2
  section('Q2 maps.js');
  {
    const ids = Object.keys(DB.maps);
    ok(ids.length > 0, `${ids.length} maps registered`);
    let bad = 0;
    for (const id of ids.slice(0, 12)) {
      const P = M.parseMap(R, id);
      const g = R.Game; R.Game = null;
      let fm = null; try { fm = R.FieldMap.compile(id); } catch (e) { fm = null; } finally { R.Game = g; }
      if (!P || !fm) { bad++; continue; }
      if (P.w !== fm.w || P.h !== fm.h) bad++;
      for (let y = 0; y < P.h; y += 3) for (let x = 0; x < P.w; x += 3) if (P.tileAt(x, y) !== fm.tileAt(x, y)) bad++;
    }
    ok(bad === 0, `parseMap agrees with R.FieldMap.compile on 12 maps (${bad} difference(s))`);
    eq(M.parseMap(R, 'qa_no_such_map'), null, 'parseMap of an unknown map is null');
    ok(M.isSecret(R, 'secret_wall') && !M.isSecret(R, 'wall') && !M.isSecret(R, null), 'isSecret');
    const w = DB.maps.world && M.parseMap(R, 'world');
    if (w) { ok(w.wrap && w.baseAt(-1, -1) === w.baseAt(w.w - 1, w.h - 1), 'the world wraps (baseAt(-1,-1) = the far corner)'); eq(M.kindOf(w), 'world', 'kindOf(world)'); }
    const lute = DB.maps.lute && M.parseMap(R, 'lute');
    if (lute) {
      eq(M.kindOf(lute), 'town', 'kindOf(lute)');
      ok(lute.npcs.length > 10 && lute.spawns.entrance && lute.inMap(lute.spawns.entrance.x, lute.spawns.entrance.y), 'lute: npcs and the entrance spawn');
      ok(lute.baseAt(-5, -5) === lute.outside, 'outside the map is `outside`');
      const rooms = M.rooms ? M.rooms(R, lute, {}) : [];
      ok(rooms.length > 3, `rooms(lute): ${rooms.length}`);
    }
  }

  // ------------------------------------------------------------------------------------------ Q3
  section('Q3 party_model.js');
  {
    eq([0, 3, 8].map((T) => PM.levelAt(T)), [7, 25, 55], 'levelAt(T) = LZ+1');
    eq([PM.levelAt(3, 'boss'), PM.levelAt(0, 'prologue'), PM.levelAt(8, 'last'), PM.levelAt(9, 'super')], [27, 5, 58, 64], 'levelAt kinds');
    eq([PM.profAt(4, 'S'), PM.profAt(4, 'D')], [108, 14], 'profAt(T, apt) = PEXP(T) × apt');
    const before = R.Game;
    const r = PM.withGame(R, { tier: 4 }, (g) => g && g.tier);
    ok(R.Game === before, 'withGame restores R.Game');
    eq(r, 4, 'withGame runs fn with the tier');
    const b = PM.build(R, { tier: 3, members: ['hero', 'brigitta', 'marta', 'sylvain'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, gear: 'shop' });
    eq(b.party.map((c) => c.id), ['hero', 'brigitta', 'marta', 'sylvain'], 'build: the members in order');
    ok(b.party.every((c) => c.level === PM.levelAt(3)), 'build: level LZ+1');
    const K = PM.K(R);
    const exp = K.GLIM.expect[3];
    ok(b.party.every((c) => (c.techs || []).length + (c.spells || []).length >= Math.min(exp, 2)), `build: learned actions ≈ EXPECT(3) = ${exp} (${b.party.map((c) => (c.techs || []).length + (c.spells || []).length).join('/')})`);
    ok(b.party.every((c) => { const st = R.Rules.stats(c); return c.hp === st.hp && c.mp === st.mp && c.wp === st.wp && Object.keys(c.status || {}).length === 0; }), 'build: full HP/MP/WP, status {}');
    ok(b.party.every((c) => c.equip && c.equip.weapon1), 'build: everyone holds a weapon');
    if (R.GearA && R.GearA.BUILD_SETS) {
      const mage = PM.build(R, { tier: 8, members: ['hero'], heroType: 'mage', favor: { kind: 'element', id: 'fire' }, build: 'magic', weapons: ['staff', 'staff'], gear: 'super', learned: false }).party[0];
      const S = R.GearA.BUILD_SETS.int.S, slots = R.GearA.BUILD_SLOTS;
      eq(slots.map((s) => mage.equip[s]), S, 'T8 super int build = R.GearA.BUILD_SETS.int.S (§8.13.1)');
      const war = PM.build(R, { tier: 8, members: ['hero'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, build: 'phys', weapons: ['sword', 'sword'], gear: 'shop', learned: false }).party[0];
      eq(slots.map((s) => war.equip[s]), R.GearA.BUILD_SETS.str.N, 'T8 shop str build = BUILD_SETS.str.N');
      const t7 = PM.build(R, { tier: 7, members: ['hero'], heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, gear: 'shop', learned: false }).party[0];
      ok(slots.some((s) => t7.equip[s] !== R.GearA.BUILD_SETS.str.N[slots.indexOf(s)]), 'T7 is not forced to the T8 set');
    } else ok(true, 'BUILD_SETS missing (gear-a): skipped');
    eq(PM.COMBOS.length, 12, 'COMBOS: the 12 fixed parties of §5.4.3');
    ok(PM.HERO_VARIANTS.length >= 6, `HERO_VARIANTS: ${PM.HERO_VARIANTS.length}`);
    const st = PM.standard(R, 2);
    eq(st.party.map((c) => c.id), ['hero', 'brigitta', 'marta', 'sylvain'], 'standard(T): hero + brigitta marta sylvain');
  }

  // ------------------------------------------------------------------------------------------ Q4
  section('Q4 validate.js on the planted faults (tools/fixtures/qa/bad)');
  {
    const V = require('./validate');
    const { rep } = V.run({ with: [path.join(ROOT, 'tools', 'fixtures', 'qa', 'bad')], only: ['V1', 'V2', 'V3', 'V4', 'V5', 'V10', 'V14', 'CH4', 'CH6', 'CH7'] });
    const all = rep.items.filter((x) => /qa/.test(x.msg));
    const has = (level, check, re, name) => ok(all.some((x) => x.level === level && x.check === check && re.test(x.msg)), `${check} ${name}`);
    has('error', 'V5', /qa_bad_town: no 'outside'/, 'a town without outside');
    has('error', 'V5', /qa_bad_town.*'hidden' items are abolished/, 'hidden items');
    has('error', 'V5', /chest qa_bad_town_c2 has a fixed item/, 'a chest with a fixed item');
    has('error', 'V5', /qa_bad_floor.*must be a wall/, 'a small floor whose outside is not a wall');
    has('warn', 'V5', /npc qa_walker has neither fixed nor push/, 'an npc with neither fixed nor push (warning)');
    has('error', 'V2', /duplicate chest id qa_bad_town_c1/, 'a duplicate chest id');
    has('error', 'V2', /qa_bad_town: chest @5,3 has no explicit chest id/, 'a chest without id');
    has('error', 'V14', /map qa_bad_town: no 'location'/, 'a town without location');
    has('error', 'V14', /qa_bad_floor.*qa_nowhere/, 'a location that is not in DB.locations');
    has('error', 'V1', /qa_no_such_map/, 'a warp to an unknown map');
    has('error', 'V1', /qa_bad_floor_gate.*qa_no_such_map/, 'an event meta.warp to an unknown map');
    has('error', 'V3', /ac_qa_long/, 'a name over the length');
    has('error', 'V4', /qaNoSuchKey/, 'an unknown mods key');
    has('error', 'V10', /t_sword_qa: glim\.lv 12/, 'glim.lv outside 1–10');
    has('error', 'CH6', /t_sword_qa_from: glim\.from 't_axe_qa_nope' is not a lower sword tech/, 'a tech that comes from another weapon type');
    has('error', 'CH7', /s_fire_qa: must not have 'scale'/, "a spell with its own 'scale'");
    has('error', 'CH7', /s_fire_qa: must not have 'element'/, "a spell with 'element' (elements[] only)");
    has('error', 'CH4', /hd_qa_units: 3 stat unit\(s\) on a head/, 'a hat over the §4.3.3 unit budget');
    if (VERBOSE) for (const x of all) console.log(`     ${x.level} ${x.check} ${x.msg}`);
  }

  // ------------------------------------------------------------------------------------------ Q5
  section('Q5 progress.js on a planted world (tools/fixtures/qa/world)');
  {
    const P = require('./progress');
    const V = require('./validate');
    const L = V.loadTracked({ with: [path.join(ROOT, 'tools', 'fixtures', 'qa', 'world')] });
    const R2 = L.R;
    R2.warn = () => {};
    R2.DB.config.start = { map: 'qa_p_start', spawn: 'entrance' };
    // the fixture world only: drop the real maps from the model (faster, and nothing else is reachable anyway)
    const model = P.Model(R2);
    for (const id of Object.keys(model.maps)) if (!/^qa_p_/.test(id)) delete model.maps[id];
    const s = P.newState(model);
    const res = P.run(model, s, {});
    ok(res.reachedMaps.has('qa_p_goal'), 'the goal map is reached through the warp that needs qa_key');
    ok(s.flags.has('qa_key') && s.flags.has('qa_goal'), 'flags qa_key and qa_goal are given');
    ok(s.flags.has('qa_called'), 'meta.calls: the called event fires once its needs hold');
    const s2 = P.newState(model);
    const res2 = P.run(model, s2, { noSecret: true });
    ok(!s2.flags.has('qa_key') && !res2.reachedMaps.has('qa_p_goal'), 'with secret passages closed, qa_key and the goal are lost (Part A4)');
    ok(P.tokenOk('flag:qa_key', s) && !P.tokenOk('flag:qa_key', s2) && P.tokenOk('var:x>=0', s2), 'tokenOk');
    const s3 = P.newState(model);
    const S3 = P.condState(s3);
    ok(Cond.check({ tier: 0 }, S3) && !Cond.check({ tier: 1 }, S3), 'condState: tier = regions cleared');
  }

  // ------------------------------------------------------------------------------------------ Q6
  section('Q6 check_text.js');
  {
    const T = require('./check_text');
    eq(T.width('あいう'), 3, 'width of kana'); eq(T.width('HP99'), 2, 'width of half-width'); eq(T.width('{hero}は'), 6, '{hero} counts as 5');
    const ss = T.strings("// 'コメント'\nconst a = 'あい';\n/* \"ない\" */ const b = `う${x}え`; const r = /'x'/g;");
    eq(ss.map((x) => x.s), ['あい', 'う\u0000え'], 'strings: literals only (comments, regex skipped; ${…} → \\0)');
    eq(ss.map((x) => x.line), [2, 3], 'strings: line numbers');
    const col = (fn, t) => { const a = []; fn(t, (m) => a.push(m)); return a; };
    eq(col(T.checkSpacing, 'やあ！　元気？').length, 0, 'spacing: a full-width space after ！ is allowed');
    eq(col(T.checkSpacing, '攻　+3　術　+9').length, 0, 'spacing: a UI list is allowed');
    ok(col(T.checkSpacing, 'おお　ゆうしゃよ　しんでしまうとは').length > 0, 'spacing: DQ-style word spacing (full-width) is an error');
    ok(col(T.checkSpacing, '宿屋に 泊まる').length > 0, 'spacing: a half-width space between Japanese words is an error');
    ok(col(T.checkEllipsis, 'そうか…').length > 0, 'ellipsis: a single … is an error');
    ok(col(T.checkEllipsis, 'そうか……').length > 0, 'ellipsis: a sentence ending in …… without 。 is an error');
    eq(col(T.checkEllipsis, 'そうか……。').length, 0, 'ellipsis: ……。 is fine');
    ok(col(T.checkEllipsis, 'まさか・・・').length > 0, 'ellipsis: ・・・ is an error');
    const st = T.readStyle();
    ok(st.partial.length > 100 && st.exact.length > 10 && st.src.includes('冒険の書') && st.allowedKanji.length > 5, `STYLE_JA lists read (§7.1 ${st.partial.length}, §7.2 ${st.exact.length}, §7.3 ${st.src.length}, §2 ${st.allowedKanji.length})`);
    ok(st.partial.includes('スライム') || st.partial.includes('キングスライム'), 'the banned list has the DQ monster names');
  }

  // ------------------------------------------------------------------------------------------ Q7
  section('Q7 playthrough.js');
  {
    const PT = require('./playthrough');
    const V = require('./validate');
    const L = V.loadTracked({ with: [path.join(ROOT, 'tools', 'fixtures', 'qa', 'world')] });
    const R3 = L.R;
    R3.warn = () => {};
    R3.DB.events.qa_p_start_outer = { meta: { needs: [], gives: ['flag:qa_outer'], calls: ['qa_p_start_keeper'] }, run: async (ev) => { ev.setFlag('qa_outer'); await ev.call('qa_p_start_keeper'); } };
    R3.DB.events.qa_p_start_sloppy = { meta: { needs: [], gives: [] }, run: async (ev) => { await ev.teleportMagic(); ev.setFlag('qa_undeclared'); } };
    const out = await PT.playthrough(R3, { events: ['qa_p_start_outer', 'qa_p_goal_sage', 'qa_p_start_sloppy'] });
    const msgs = out.errors.map((e) => e.msg).concat(out.warns.map((w) => w.msg));
    ok(!msgs.some((m) => /qa_p_start_outer.*qa_key/.test(m)), 'a give of an ev.call-ed event is the callee\'s, not the caller\'s');
    ok(msgs.some((m) => /ev\.teleportMagic is not part of the ev API/.test(m)), 'an unknown ev API call is reported');
    ok(msgs.some((m) => /qa_p_start_sloppy: sets undeclared flag 'qa_undeclared'/.test(m)), 'an undeclared flag is reported');
    ok(!msgs.some((m) => /qa_p_goal_sage/.test(m)), 'a correct event has no finding');
  }

  // ------------------------------------------------------------------------------------------ Q8
  section('Q8 shots.js / smoke.js');
  {
    const SH = require('./shots');
    const nums = new Set();
    for (const s of SH.SHOTS) { const m = String(s.no).match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) nums.add(i); else nums.add(+s.no); }
    const missing = []; for (let i = 1; i <= 22; i++) if (!nums.has(i)) missing.push(i);
    eq(missing, [], 'every §11.12.2 shot #1–#22 has an entry');
    eq(SH.pickShots('2').map((s) => s.no), ['1-3'], "--only 2 picks the entry '1-3'");
    ok(SH.pickShots('8-13').length >= 6 && SH.pickShots('8-13').every((s) => +s.no >= 8 && +s.no <= 13), '--only 8-13');
    const SM = require('./smoke');
    ok(typeof SM.Driver === 'function' && typeof SM.HELPER === 'function' && SM.KEY.a === 'KeyZ', 'smoke exports the driver for shots.js');
    eq(SM.brief({ top: 'FieldLayer', map: 'lute', x: 3, y: 4 }), 'FieldLayer lute@3,4', 'brief()');
  }

  // ------------------------------------------------------------------------------------------ Q9
  section('Q9 check_density.js');
  {
    const CD = require('./check_density');
    const r = CD.run({ R });
    ok(r && Array.isArray(r.findings) && r.table && typeof r.table === 'object', 'run() returns {findings, table}');
    const towns = Object.keys(DB.maps).filter((id) => ['town', 'castle', 'village'].includes(DB.maps[id].type) || /_house/.test(id));
    eq(Object.keys(r.table).sort(), towns.sort(), 'every town / castle / village / house map is measured (§11.2.7)');
    const noRooms = towns.filter((id) => !(r.table[id] || []).length);
    eq(noRooms, [], 'rooms are found on every town/house map');
    const bad = [];
    for (const [id, rooms] of Object.entries(r.table)) for (const x of rooms) if (!(x.block >= 0 && x.block <= 1 && x.soft >= 0 && x.soft <= 1 && x.size >= 6)) bad.push(id);
    eq(bad, [], 'room ratios are within 0–1 and rooms have ≥ 6 cells');
    // a walled town's street (many building doors on its edge) is not "1 部屋" — dovan's cavern street, if the map is there
    if (r.table.dovan) {
      ok((r.table.dovan.streets || []).length >= 1, 'dovan: the cavern street is recognised as a street');
      ok(!r.table.dovan.some((x) => x.size > 300 && x.doors >= 4), 'dovan: no street is measured as a room');
    }
    if (VERBOSE) console.log('     density:', r.findings.length, 'warning(s)');
  }

  console.log(`\ntest_qa: ${pass} passed, ${fail} failed — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (fail) { for (const f of fails) console.log('  FAIL ' + f); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exit(2); });
