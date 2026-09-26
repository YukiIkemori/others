#!/usr/bin/env node
// Promo trailer footage capture: plays the REAL game (debug.html) in headless Chromium,
// frame-stepped and deterministic, and writes PNG frame sequences (1024x896, 30 fps).
//
//   node promo/capture.js                 capture every scene → promo/frames/<scene>/00000.png …
//   node promo/capture.js battle rare     only these scenes
//   node promo/capture.js --list          list scenes
//
// How it works: the engine's rAF loop is paused (R.Engine.paused = true) and every video
// frame runs R.Engine.step() twice (60 Hz game → 30 fps video) and R.Engine.render(), with a
// macrotask yield between steps so the game's async flows (await Engine.wait …) advance as
// in the browser. Input goes through R.Input._set (the same virtual buttons the keyboard
// drives). Audio never starts (no user gesture), so jingles resolve at once; the soundtrack
// is built separately by compose.py from the game's own tracks (tools/render_audio.js).
// Nothing under src/ is modified: every setup (party, jobs, gear, flags) is done here.
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'frames');

// ------------------------------------------------------------------ in-page helpers
const INSTALL = () => {
  const R = window.RPG;
  const yieldTask = () => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  const cap = (window.__cap = {
    grabbed: 0, // frames recorded so far (sound events are stamped with it)
    sounds: [], // [frame, 'sfx'|'jingle'|'bgm', id]
    taps: [], // buttons pressed for one step at the start of the next frame
    held: {}, // buttons held down
    async stepOne() {
      R.Engine.step();
      await yieldTask(); await yieldTask();
    },
    async frame(grab) {
      for (let s = 0; s < 2; s++) {
        const tapped = s === 0 ? cap.taps.splice(0) : [];
        for (const b of tapped) R.Input._set(b, true);
        for (const b in cap.held) R.Input._set(b, cap.held[b] || tapped.includes(b));
        await cap.stepOne();
        for (const b of tapped) R.Input._set(b, !!cap.held[b]);
      }
      R.Engine.alpha = 0;
      R.Engine.render();
      if (!grab) return null;
      cap.grabbed++;
      return R.Gfx.canvas.toDataURL('image/png');
    },
    async skip(frames) { for (let i = 0; i < frames; i++) await cap.frame(false); },
  });
  // log every sound the game asks for (audio itself never starts here), so compose.py can
  // lay the game's own SFX/jingles on the exact frames
  const osfx = R.sfx, ojingle = R.jingle, obgm = R.bgm;
  R.sfx = (id) => { cap.sounds.push([cap.grabbed, 'sfx', id]); return osfx(id); };
  R.jingle = (id) => { cap.sounds.push([cap.grabbed, 'jingle', id]); return ojingle(id); };
  R.bgm = (id, o) => { cap.sounds.push([cap.grabbed, 'bgm', id]); return obgm(id, o); };
  R.Engine.paused = true;
  R.Engine.error = null;
  return true;
};

// Late-game party (modelled on tools/sim_postgame.js PREPARED): mastered jobs, good gear.
const SETUP_PARTY = (o) => {
  const R = window.RPG, Rules = R.Rules, DB = R.DB;
  o = o || {};
  const T1 = ['warrior', 'priest', 'mage', 'thief'];
  const SPEC = {
    yuki: {
      master: [...T1, 'knight', 'monk', 'whitemage', 'blackmage', 'hunter', 'spellblade', 'paladin', 'ninja', 'dragoon', 'hero'],
      job: 'hero', sub: 'dragoon',
      equip: { weapon: 'pg_chaos_sword', shield: 'pg_dragon_lance', head: 'holy_helm', body: 'pg_abyss_mail', acc: 'pg_clarity_amulet' },
    },
    non: {
      master: ['priest', 'mage', 'warrior', 'whitemage', 'blackmage', 'knight', 'sage', 'paladin', 'bard'],
      job: 'sage', sub: 'whitemage',
      equip: { weapon: 'pg_aurora_staff', head: 'light_crown', body: 'pg_aurora_robe', acc: 'life_charm' },
    },
    metem: {
      master: [...T1, 'blackmage', 'whitemage', 'bard', 'knight', 'timemage', 'sage', 'paladin'],
      job: 'blackmage', sub: 'sage',
      equip: { weapon: 'pg_origin_rod', head: 'light_crown', body: 'holy_robe', acc: 'pg_clarity_amulet' },
    },
  };
  if (o.jobs) for (const id in o.jobs) SPEC[id].job = o.jobs[id];
  const L = o.level || 50;
  for (const c of R.Game.party) {
    const spec = SPEC[c.id];
    if (!spec) continue;
    c.level = L; c.exp = Rules.expForLevel(L);
    const master = o.fewMastered ? spec.master.slice(0, o.fewMastered) : spec.master;
    for (const job of master) {
      const rec = Rules.jobRec(c, job);
      rec.total = Rules.jpForJobLevel(job, 8); rec.jp = 0;
      rec.learned = Rules.jobAbilities(job).slice();
      Rules.isMastered(c, job);
    }
    if (!o.keepJob) c.job = spec.job;
    c.set.sub = spec.sub;
    for (const s of Rules.SLOTS) c.equip[s] = null;
    if (o.gear !== false) for (const s in spec.equip) if (DB.items[spec.equip[s]] && Rules.canEquip(c, spec.equip[s], s)) c.equip[s] = spec.equip[s];
    if (o.optimize) try { Rules.optimize(c, { acc: true }); } catch (e) { /* ignore */ }
    const st = Rules.stats(c);
    c.hp = st.hp; c.mp = st.mp; c.status = {};
  }
  R.Game.gold = 128450;
  for (const [it, n] of [['nectar', 12], ['healing_aroma', 5], ['revive_feather', 8], ['all_cure', 6], ['mana_crystal', 4], ['herb', 20]]) if (DB.items[it]) R.State.addItem(it, n);
  return R.Game.party.map((c) => c.name + ' ' + c.job + ' Lv' + c.level);
};

// ------------------------------------------------------------------ node side
class Session {
  constructor(page, name) { this.page = page; this.name = name; this.n = 0; this.dir = path.join(OUT, name); }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  js(src) { return this.page.evaluate(`(async()=>{ const R = window.RPG; return (${src}); })()`); }
  tap(...bs) { return this.page.evaluate((b) => { window.__cap.taps.push(...b); }, bs); }
  hold(b, v = true) { return this.page.evaluate(([b, v]) => { window.__cap.held[b] = v; if (!v) window.RPG.Input._set(b, false); }, [b, v]); }
  skip(frames) { return this.page.evaluate((n) => window.__cap.skip(n), frames); }
  /** record n frames (optionally calling each(i) before every frame) */
  async rec(frames, each) {
    fs.mkdirSync(this.dir, { recursive: true });
    for (let i = 0; i < frames; i++) {
      if (each) await each(i);
      const url = await this.page.evaluate(() => window.__cap.frame(true));
      fs.writeFileSync(path.join(this.dir, String(this.n++).padStart(5, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  /** skip frames until cond (JS expression) is true, max n frames */
  async until(cond, max = 600, recording = false) {
    for (let i = 0; i < max; i++) {
      if (await this.js(cond)) return i;
      if (recording) await this.rec(1); else await this.skip(1);
    }
    console.warn(`  [${this.name}] until timeout: ${cond}`);
    return -1;
  }
  topName() { return this.js('R.Engine.top() && R.Engine.top().constructor.name'); }
}

// ------------------------------------------------------------------ scenes
// Each scene gets a fresh page (clean state). Frame counts are the raw takes;
// compose.py picks the in/out points.
const SCENES = {};

// 1. title screen (boot → emblem + logo)
SCENES.title = async (S) => {
  await S.js('R.Engine.clear(), R.Title.start(), true');
  await S.rec(150);
};

// 2. the king's summons (story intro in the throne room)
SCENES.intro = async (S) => {
  await S.js("R.Settings.msgSpeed = 2, R.debug.newGameAt('regnas_castle', 'start'), true");
  await S.skip(10);
  // walk into the throne room until the intro event starts, then page through
  await S.until('R.Events && R.Events.busy && R.Events.busy()', 20);
  await S.rec(240, async (i) => { if (i % 50 === 49) await S.tap('a'); });
};

/** start the field at map/spawn with the late-game party (no encounters, no fade) */
async function fieldAt(S, map, spawn, partyOpts) {
  await S.js(`R.debug.newGameAt(${JSON.stringify(map)}, ${JSON.stringify(spawn)}), true`);
  await S.setupParty(partyOpts);
  await S.js("R.debug.noEncounter(true), R.debug.visitAll(), R.Game.flags.intro_done = true, true");
  await S.skip(30);
}
/** hold directions for n frames each: [['up', 20], ['right', 10]] (recorded) */
async function walk(S, path, dash = false) {
  if (dash) await S.hold('dash', true);
  for (const [d, n] of path) { await S.hold(d, true); await S.rec(n); await S.hold(d, false); }
  if (dash) await S.hold('dash', false);
}

// ---- battle helpers
const READY = '!!(R.Battle.current && R.Engine.top() === R.Battle.current && R.Battle.current.input && !R.Battle.current.msg.resolve && !R.Battle.current.popup)';
/** start a battle (not awaited) and record until the command menu is up */
async function battle(S, o, recIntro = true, maxIntro = 400) {
  await S.js(`(R.Battle.start(${JSON.stringify(o)}), true)`);
  const ready = READY;
  await S.until(ready, maxIntro, recIntro);
}
/** tap a button once the battle scene is waiting for input (recorded) */
async function btap(S, b, gap) {
  await S.until(READY, 300, true);
  if (process.env.TRACE) console.log('  tap', b, S.n, await S.js('[R.Battle.current.acting && R.Battle.current.acting.name, R.Battle.current.panel && R.Battle.current.panel.left && R.Battle.current.panel.left.index]'));
  await S.tap(b); await S.rec(gap);
}
/** move a grid cursor from index 0 to idx (cols per row) and confirm; every tap recorded */
async function pick(S, idx, cols = 2, gap = 5) {
  for (let i = 0; i < Math.floor(idx / cols); i++) await btap(S, 'down', gap);
  for (let i = 0; i < idx % cols; i++) await btap(S, 'right', gap);
  await btap(S, 'a', gap + 2);
}
/** index of an ability in a member's action list for a job */
function abIndex(S, member, job, ab) {
  return S.js(`R.Rules.actionList(R.Game.party[${member}], ${JSON.stringify(job)}).indexOf(${JSON.stringify(ab)})`);
}
/** command one member: cmd index (0 戦う, 1 main job, 2 sub job …), then an ability (or null), then confirm target */
async function command(S, member, cmdIdx, job, ab) {
  await pick(S, cmdIdx, 2);
  if (ab) {
    const i = await abIndex(S, member, job, ab);
    if (i < 0) console.warn('  ability not in list', member, job, ab);
    await pick(S, Math.max(0, i), 2);
  }
  await btap(S, 'a', 8); // target / confirm
}
/** record until the battle scene waits for commands again (or ends) */
async function untilInput(S, max = 900) {
  await S.rec(4);
  return S.until('!R.Battle.current || !!R.Battle.current.input || !!R.Battle.current.popup || !!(R.Battle.current.msg && R.Battle.current.msg.key)', max, true);
}

// 3a. a town (walk through サルバ with the late-game party in their job outfits)
SCENES.town = async (S) => {
  await fieldAt(S, 'salva_town', 'entrance');
  await walk(S, [['up', 48]]);
};
SCENES.town2 = async (S) => {
  await fieldAt(S, 'arcana_city', 'entrance');
  await walk(S, [['up', 60]]);
};

// 3b. sailing the ship on the world map
SCENES.ship = async (S) => {
  await fieldAt(S, 'regnas_castle', 'start');
  await S.js("R.debug.ship('elfin_dock'), R.Field.warp('world', 'elfin_dock', { fade: false }), true");
  await S.skip(40);
  await walk(S, [['right', 110]]);
};

// 4a. command battle with big spells (abyss monsters vs. a Lv50 party)
SCENES.battle = async (S) => {
  await fieldAt(S, 'abyss_2', 'up', { level: 52 });
  await S.js('R.U.seed(11), true');
  await battle(S, { zone: 'd_abyss2', noRare: true, surprise: null });
  await S.rec(10);
  await pick(S, 0); // 戦う
  await command(S, 0, 1, 'hero', 'hero_judgment');
  await command(S, 1, 1, 'sage', 'sage_stardust');
  await command(S, 2, 1, 'blackmage', 'blackmage_inferno');
  await untilInput(S, 900);
  await S.rec(30);
};

// 4b. オート battle (fast, hands-off)
SCENES.auto = async (S) => {
  await fieldAt(S, 'world', 'arcana_city', { level: 45 });
  await S.js('R.U.seed(5), true');
  await battle(S, { zone: 'w_demon', noRare: true, surprise: null });
  await S.rec(8);
  await pick(S, 2); // オート (row 2, col 1)
  await untilInput(S, 900);
  await S.rec(60);
};

// 4c. the demon king (final boss)
SCENES.boss = async (S) => {
  await fieldAt(S, 'world', 'demon_castle_1', { level: 48 });
  await S.js('R.U.seed(3), true');
  await battle(S, { troop: 'boss_king2' });
  await S.rec(10);
  await pick(S, 0);
  await command(S, 0, 1, 'hero', 'hero_luminous');
  await command(S, 1, 1, 'sage', 'sage_prominence');
  await command(S, 2, 1, 'blackmage', 'blackmage_inferno');
  await untilInput(S, 900);
  await S.rec(20);
};

/** tap a button n times, recording gap frames after each */
async function taps(S, b, n, gap) { for (let i = 0; i < n; i++) { await S.tap(b); await S.rec(gap); } }

// 5. jobs: the job board (outfits per job, ★ mastered), learning the last ability → mastery
SCENES.jobs = async (S) => {
  await fieldAt(S, 'arcana_city', 'entrance', { level: 50 });
  // ユウキ: 暗黒騎士 one ability short of mastery, with the JP for it
  const info = await S.js(`(() => {
    const c = R.Game.party[0], job = 'darkknight';
    if (!R.Rules.isJobUnlocked(c, job)) return 'locked';
    const rec = R.Rules.jobRec(c, job), abs = R.Rules.jobAbilities(job);
    rec.learned = abs.slice(0, abs.length - 1);
    rec.jp = 5000; rec.total = R.Rules.jpForJobLevel(job, 7);
    rec.mastered = false;
    return { n: abs.length, last: abs[abs.length - 1] };
  })()`);
  console.log('  jobs setup', info);
  await S.js('(R.Settings.msgSpeed = 2, R.Menu.jobScreen({ member: 0 }), true)');
  await S.rec(20);
  await taps(S, 'left', 3, 7);
  await taps(S, 'up', 1, 7);
  await taps(S, 'right', 3, 7);
  await S.tap('dash'); await S.rec(12); // next member
  await taps(S, 'down', 1, 7);
  await taps(S, 'left', 2, 7);
  await S.tap('dash'); await S.rec(12);
  await taps(S, 'up', 1, 7);
  await taps(S, 'right', 2, 7);
  await S.tap('dash'); await S.rec(10); // back to ユウキ
  await S.js("(R.Engine.top().place('darkknight'), true)");
  await S.rec(12);
  await S.tap('a'); await S.rec(10); // job options
  await S.tap('down'); await S.rec(6);
  await S.tap('a'); await S.rec(14); // アビリティを覚える
  await taps(S, 'down', info.n - 1, 3);
  await S.rec(8);
  await S.tap('a'); await S.rec(16); // yes/no
  await S.tap('a'); await S.rec(40); // はい → 覚えた！
  await S.tap('a'); await S.rec(90); // → マスターした！
  await S.tap('a'); await S.rec(70); // → 常に効く
  await S.tap('a'); await S.rec(24); // → セットしますか？
  await S.tap('b'); await S.rec(14); // いいえ
  // 転職: back on the board, change ユウキ's job to the freshly mastered 暗黒騎士
  await S.tap('b'); await S.rec(14);
  await S.tap('a'); await S.rec(12);
  await S.tap('a'); await S.rec(70);
  await S.tap('a'); await S.rec(30);
  await S.tap('a'); await S.rec(40);
};

// 6. a rare monster: golden flash + fanfare, then the forced rare drop 「★レアアイテム！」
SCENES.rare = async (S) => {
  await fieldAt(S, 'world', 'demon_castle_1', { level: 50 });
  // capture hook (not in src/): the reward roll of this battle always hits (rare drop shown)
  await S.js(`(() => {
    const E = R.Battle.Engine.prototype, orig = E.computeRewards;
    E.computeRewards = function () { const s = R.U.rng; R.U.rng = () => 0.0001; try { return orig.apply(this, arguments); } finally { R.U.rng = s; } };
    R.U.seed(${21 + (S.attempt || 0)}); R.Settings.msgSpeed = 2; return true;
  })()`);
  await battle(S, { zone: 'w_demon', mons: [['rare_idol', 1]], rareMon: 'rare_idol', surprise: null });
  await S.rec(10);
  await pick(S, 0); // 戦う
  await command(S, 0, 1, 'hero', 'hero_luminous');
  await command(S, 1, 1, 'sage', 'sage_prominence');
  await command(S, 2, 1, 'blackmage', 'blackmage_blast');
  // play the round and the rewards; page the result messages until the rare popup is up
  for (let k = 0; k < 400; k++) {
    const st = await S.js('R.Battle.current ? (R.Battle.current.popup ? "popup" : R.Battle.current.msg.key ? "key" : (' + READY + ') ? "input" : "run") : "done"');
    if (st === 'input') { await S.rec(10); await pick(S, 1); continue; } // リピート
    if (st === 'popup') break;
    if (st === 'done') throw new Error('RETRY');
    if (st === 'key') { await S.rec(24); await S.tap('a'); }
    await S.rec(6);
  }
  await S.rec(90);
  await S.tap('a'); await S.rec(30);
};

// 7. the bestiary: a well-filled モンスター図鑑, list scroll + detail pages
SCENES.book = async (S) => {
  await fieldAt(S, 'arcana_city', 'entrance', { level: 50 });
  await S.js(`(() => {
    R.U.seed(7);
    const ids = Object.keys(R.DB.monsters);
    ids.forEach((id, i) => {
      const d = R.DB.monsters[id];
      if (id === 'abyss_lord' || (i % 13 === 7)) return; // a few still unknown
      const b = { seen: 3 + (i * 7) % 20, kills: 2 + (i * 5) % 30 };
      if (d.drop) b.drop = true;
      if (d.rare && i % 3 === 0) b.rare = true;
      if (d.steal) b.steal = true;
      R.Game.bestiary[id] = b;
    });
    return ids.length;
  })()`);
  await S.js('(R.Menu.bookScreen(), true)');
  await S.rec(16);
  await S.hold('down', true); await S.rec(75); await S.hold('down', false);
  await S.rec(10);
  // jump to a showpiece and open its page
  const idx = await S.js(`(() => { const L = R.Engine.top(); const i = L.ids.indexOf('rare_whale'); L.list.index = i; L.list.scrollTo(); return i; })()`);
  console.log('  book index', idx);
  await S.rec(12);
  await S.tap('a'); await S.rec(45);
  await S.tap('down'); await S.rec(40); // second page
  await S.tap('right'); await S.rec(40);
  await S.tap('right'); await S.rec(40);
  await S.tap('right'); await S.rec(40);
};

// 8a. 深淵の迷宮: walking the carpet of the deepest floor toward アビスロード
SCENES.abyss_walk = async (S) => {
  await fieldAt(S, 'abyss_4', { x: 24, y: 22, dir: 'up' }, { level: 55 });
  await S.js("(R.Game.flags.game_clear = true, R.Game.flags.abyss_sanctuary = true, true)");
  await S.hold('up', true);
  await S.rec(40);
  await S.hold('up', false);
  await S.rec(200, async (i) => { if (i % 60 === 59) await S.tap('a'); });
};
SCENES.abyss_1 = async (S) => {
  await fieldAt(S, 'abyss_1', 'entrance', { level: 55 });
  await walk(S, [['down', 30], ['right', 30]]);
};

// 8b. アビスロード (post-game superboss)
SCENES.lord = async (S) => {
  await fieldAt(S, 'abyss_4', { x: 24, y: 14, dir: 'up' }, { level: 55, jobs: { metem: 'timemage' } });
  await S.js('R.U.seed(9), true');
  await battle(S, { troop: 'boss_abyss' });
  await S.rec(10);
  await pick(S, 0);
  await command(S, 0, 1, 'hero', 'hero_luminous');
  await command(S, 1, 1, 'sage', 'sage_stardust');
  await command(S, 2, 1, 'timemage', 'timemage_meteor');
  await untilInput(S, 1200);
  await S.rec(20);
};

SCENES.probe_fields = async (S) => {
  for (const [m, sp] of [['regnas_town', 'entrance'], ['porta_town', 'entrance'], ['arcana_city', 'entrance'], ['abyss_1', 'entrance'], ['abyss_2', 'up'], ['abyss_3', 'entrance'], ['abyss_4', 'entrance'], ['salva_town', 'entrance'], ['elfin_village', 'entrance']]) {
    await S.js(`R.debug.newGameAt(${JSON.stringify(m)}, ${JSON.stringify(sp)}), true`);
    await S.skip(30);
    await S.rec(1);
  }
};

module.exports = { SCENES, INSTALL, SETUP_PARTY };

// ------------------------------------------------------------------ main
async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) { console.log(Object.keys(SCENES).join('\n')); return; }
  const only = argv.filter((a) => !a.startsWith('--'));
  const list = only.length ? only : Object.keys(SCENES).filter((n) => !n.startsWith('probe') && n !== 'dbg');
  const retries = {};
  const browser = await playwright.chromium.launch();
  try {
    for (let li = 0; li < list.length; li++) {
      const name = list[li];
      if (!SCENES[name]) { console.log('unknown scene', name); continue; }
      const t0 = Date.now();
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 950 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.stack || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto('file://' + path.join(ROOT, 'debug.html'));
      await page.waitForFunction(() => window.RPG && window.RPG._booted && window.RPG.Engine.layers.length > 0, null, { timeout: 20000 });
      await page.waitForTimeout(300);
      await page.evaluate(INSTALL);
      fs.rmSync(path.join(OUT, name), { recursive: true, force: true });
      const S = new Session(page, name);
      const attempt = retries[name] || 0;
      S.attempt = attempt;
      S.setupParty = (o) => page.evaluate(SETUP_PARTY, o || {});
      try { await SCENES[name](S); } catch (e) {
        if (String(e.message) !== 'RETRY' || attempt >= 12) throw e;
        console.log(`  ${name}: retry ${attempt + 1}`);
        await ctx.close(); list.splice(list.indexOf(name) + 1, 0, name); retries[name] = attempt + 1; continue;
      }
      const sounds = await page.evaluate(() => window.__cap.sounds.filter((x) => x[0] < window.__cap.grabbed));
      if (S.n) fs.writeFileSync(path.join(OUT, name, 'sounds.json'), JSON.stringify(sounds));
      const err = await page.evaluate(() => window.RPG.Engine.error && window.RPG.Engine.error.msg);
      if (err) errors.push('Engine.error: ' + err);
      console.log(`${name}: ${S.n} frames (${((Date.now() - t0) / 1000).toFixed(1)}s)` + (errors.length ? '\n  ERRORS:\n  ' + errors.join('\n  ') : ''));
      await ctx.close();
    }
  } finally { await browser.close(); }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
