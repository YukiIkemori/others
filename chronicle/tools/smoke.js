#!/usr/bin/env node
// Browser E2E smoke test (A22 qa; DESIGN §12.1 smoke.js, §12.5-3/4, §0.7 Part A6).
//
//   node tools/smoke.js [--only slice,SW1,SW2,SW3,SR1] [--html dist/index.html] [--out <dir>]
//                       [--no-build] [--timeout <s>] [--verbose] [--json] [--keep-going]
//
// Stages (PASS / FAIL / SKIP each; exit 1 on any FAIL, on console.error / pageerror / RPG.loadErrors):
//   slice   the vertical slice with real key presses: タイトル → はじめから → 主人公の作成 (女・術剣士・火,
//           名前は入力画面の「決定」) → 師匠ベルナ → ファロス → 酒場で 3 人 → 灯台守 → 灯台のチュートリアル
//           (閃き) → ページ食らい → 翌朝 → メニュー → 地方 1 つ (content が有れば) → セーブ → つづきから →
//           冒険の合言葉 (書き出し → タイトルで読み込み). The story order comes from progress.js (its
//           acquisition log); travel between maps uses R.debug.warp, every talk / step is a real key press.
//   SW1-3   全滅 → 復活 → 歩ける (§0.7 A6-6): (1) a world random battle (R.Field.encounter), (2) a town
//           event battle without canLose, (3) the dungeon boss event. Everyone's HP is set to 0 at the
//           party command; the wipe runs; the game-over screen is skipped with A and the wake-up text
//           sent with A; §4.12.2 ①–⑥ must hold within 60 frames (⑦ onEnter once is reported too);
//           walk right 3 tiles; Y opens the menu, B closes it; another random battle is won.
//   SR1     リピート (§0.7 A6-3): リピート → 3 rounds without the party command → B → the round ends and the
//           party command comes back (repeating off) → the next battle starts without リピート.
//   sweep   the QA sweep of validate.js (SWEEP: check_battle A2 — BRIEF A2.4, check_mons-base A14b — BRIEF A14b.3),
//           each in its own process; a non-zero exit is a FAIL (runs first, and even without playwright).
// Screenshots of the main screens go to --out (default: <os tmp>/chronicle_smoke).
// The driver (class Driver: load / state / press / drive / shot) is exported for tools/shots.js.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', y: 'KeyC', l: 'KeyQ', r: 'KeyE', dash: 'ShiftLeft' };
const DX = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return require(p); } catch (e) { /* next */ } }
  return null;
}

// ============================================================================ in-page helper
/* eslint-disable no-undef */
function HELPER() {
  const R = window.RPG;
  if (!R || !R.Engine) return false;
  const Q = (window.__qa = window.__qa || {});
  if (Q.ready) return true;
  const nm = (l) => (l ? (l.constructor && l.constructor.name) || '?' : null);
  const lab = (it) => (it && typeof it === 'object' ? it.label : it);
  Q.nm = nm;
  Q.pm = 0; Q.pmLog = []; Q.enterLog = []; Q.scenes = 0; Q.lastScene = null; Q.pushLog = [];
  // capture battle scenes (repeat state, party-menu count) and onEnter runs (⑦)
  const push0 = R.Engine.push.bind(R.Engine);
  R.Engine.push = function (l) {
    const n = nm(l);
    Q.pushLog.push(n); if (Q.pushLog.length > 200) Q.pushLog.shift();
    if (n === 'BattleScene') {
      Q.lastScene = l; Q.scenes++;
      const proto = Object.getPrototypeOf(l);
      if (proto && proto.partyMenu && !proto.partyMenu.__qa) {
        const pm0 = proto.partyMenu;
        proto.partyMenu = function () { Q.pm++; Q.pmLog.push({ round: this.eng && this.eng.round, frame: R.Engine.frame, repeating: !!this.repeating }); return pm0.apply(this, arguments); };
        proto.partyMenu.__qa = true;
      }
    }
    return push0(l);
  };
  if (R.Events && R.Events.run && !R.Events.run.__qa) {
    const run0 = R.Events.run;
    R.Events.run = function (id, ctx) {
      if (ctx && ctx.trigger === 'enter') Q.enterLog.push({ id: typeof id === 'string' ? id : '(fn)', map: ctx.self, frame: R.Engine.frame });
      return run0.apply(this, arguments);
    };
    R.Events.run.__qa = true;
  }
  Q.state = () => {
    const E = R.Engine, F = R.Field, top = E.top(), L = F && F.layer;
    const s = {
      top: nm(top), layers: E.layers.map(nm), frame: E.frame, fade: +(E.fadeAlpha || 0).toFixed(3), paused: !!E.paused,
      input: R.Input.enabled !== false, evBusy: !!(R.Events && R.Events.busy && R.Events.busy()),
      busy: !!(F && F.isBusy && F.isBusy()), wipe: !!(F && F.wipePending), game: !!R.Game, overlay: !!document.getElementById('code-overlay'),
      scenes: Q.scenes, pm: Q.pm,
    };
    if (F && F.map && R.Game && L) { const p = F.pos(); s.map = F.map.id; s.x = p.x; s.y = p.y; s.dir = p.dir; s.locks = L.locks; s.mv = !!L.mv; }
    s.idle = s.top === 'FieldLayer' && !s.busy && !s.evBusy && !s.wipe && s.fade === 0 && !s.overlay;
    const t = top;
    try {
      if (s.top === 'MessageLayer') s.msg = { text: (t.pages[t.page] || []).join('／'), waiting: !!t.resolveText, typed: t.shown >= t.pageLen() };
      else if (s.top === 'ChoiceLayer' || s.top === 'MenuLayer' || s.top === 'MainMenu') s.list = { index: t.list.index, items: t.list.items.map(lab), n: t.list.items.length, cols: t.list.cols || 1, hidden: !!t.hidden, busy: !!t.busy };
      else if (s.top === 'CreateLayer') s.create = { step: t.step, gender: t.g, type: t.type, favor: t.favor && t.favor.id, busy: !!t.busy, yes: t.yes, name: t.name };
      else if (s.top === 'NameLayer') s.name = { cy: t.cy, cx: t.cx, cr: t.cr, cc: t.cc, str: t.str, busy: !!t.busy };
      else if (s.top === 'ChooseLayer') s.choose = { cur: t.cur, id: t.id, ids: t.ids.slice(), chosen: t.chosen.slice(), count: t.count, mode: t.mode, busy: !!t.busy, page: t.page };
      else if (s.top === 'TitleLayer') s.title = { stage: t.stage, busy: !!t.busy, t: t.t };
      else if (s.top === 'SlotPicker' || s.top === 'SaveScreen') s.slot = { index: t.index, loaded: s.top === 'SlotPicker' || !!t.slots, busy: !!t.busy };
      else if (s.top === 'GameOverLayer') s.gameover = { canSkip: !!t.canSkip, t: t.t };
      else if (s.top === 'BattleScene') {
        const m = t.msg || {}, eng = t.eng || {};
        const pl = t.panel && t.panel.left;
        const items = pl && pl.items ? pl.items.map(lab) : null;
        s.battle = {
          input: !!t.input, party: !!(t.input && items && items[0] === '戦う' && items.length === 4), index: pl ? pl.index : null, items: items && items.slice(0, 6),
          cols: pl && pl.cols ? pl.cols : 1,
          waitKey: !!(m.resolve && m.key && m.ch >= m.need && !t.locked), round: eng.round, result: eng.result || null,
          repeating: !!t.repeating, repeatCancel: !!t.repeatCancel, auto: !!t.auto, canRepeat: !!t.canRepeat, ready: !!t.ready,
          php: (eng.party || []).map((u) => u.hp), mhp: (eng.mons || []).map((u) => u.hp), boss: !!eng.boss,
        };
      } else if (t && t.list && t.list.items) s.list = { index: t.list.index, items: t.list.items.map(lab), n: t.list.items.length, cols: t.list.cols || 1 };
    } catch (e) { s.stateError = String(e); }
    return s;
  };
  /** the §4.12.2 invariants ①–⑥ (a list of failures; empty = all true) */
  Q.inv = (o) => {
    o = o || {};
    const f = [], E = R.Engine, F = R.Field, L = F.layer, top = E.top();
    if (nm(top) !== 'FieldLayer') f.push('① top is ' + nm(top));
    const left = E.layers.map(nm).filter((n) => n !== 'FieldLayer');
    if (left.length) f.push('① layers left: ' + left.join(','));
    if (R.UI && R.UI._msg && !R.UI._msg.closed) f.push('① message window open');
    if (!L || L.locks !== 0) f.push('② locks ' + (L && L.locks));
    if (F.isBusy()) f.push('② Field.isBusy');
    if (R.Events.busy()) f.push('② Events.busy');
    if (F.wipePending) f.push('② wipe pending');
    if (E.fadeAlpha !== 0) f.push('③ fadeAlpha ' + E.fadeAlpha);
    if (E.paused) f.push('③ paused');
    if (R.Input.enabled !== true) f.push('④ Input.enabled ' + R.Input.enabled);
    if (document.getElementById('code-overlay')) f.push('④ code overlay open');
    for (const c of R.State.all()) {
      const st = R.Rules.stats(c);
      if (c.hp !== st.hp || c.mp !== st.mp) f.push(`⑤ ${c.id} HP ${c.hp}/${st.hp} MP ${c.mp}/${st.mp}`);
      if (c.status && Object.keys(c.status).length) f.push(`⑤ ${c.id} status ${Object.keys(c.status).join(',')}`);
    }
    if (o.gold != null && R.Game.gold !== o.gold) f.push(`⑤ gold ${R.Game.gold} (expected ${o.gold})`);
    if (R.Battle && R.Battle.autoCarry !== false) f.push('⑥ autoCarry ' + R.Battle.autoCarry);
    if (R.Game.encItem !== null) f.push('⑥ encItem ' + JSON.stringify(R.Game.encItem));
    if (Q.lastScene && Q.lastScene.repeating) f.push('⑥ repeating kept on the last battle scene');
    return f;
  };
  /** poll the invariants every frame; ok when all hold within `max` frames of engine frame f0 */
  Q.waitInv = (max, f0, o) => new Promise((res) => {
    const step = () => {
      const f = Q.inv(o), n = R.Engine.frame - f0;
      if (!f.length) return res({ ok: true, frames: n });
      if (n > max) return res({ ok: false, frames: n, fails: f });
      requestAnimationFrame(step);
    };
    step();
  });
  /** a free cell to talk to (x,y) from: a neighbour, or across a counter; → {x,y,dir} */
  Q.approach = (x, y, prefer) => {
    const M = R.Field.map;
    if (!M) return null;
    const free = (xx, yy) => M.inBounds(xx, yy) && M.walkable(xx, yy) && !M.npcAt(xx, yy);
    const out = [];
    for (const [d, [dx, dy]] of Object.entries({ down: [0, -1], up: [0, 1], right: [-1, 0], left: [1, 0] })) {
      // standing at (x+dx', y+dy') facing d means the target is one step in direction d
      const sx = x + dx, sy = y + dy;
      if (free(sx, sy)) out.push({ x: sx, y: sy, dir: d, k: 1 });
      if (M.counterAt(sx, sy) && free(x + 2 * dx, y + 2 * dy)) out.push({ x: x + 2 * dx, y: y + 2 * dy, dir: d, k: 2 });
    }
    if (!out.length) return null;
    out.sort((a, b) => (prefer && a.dir === prefer ? -1 : 0) - (prefer && b.dir === prefer ? -1 : 0) || b.k - a.k);
    return out[0];
  };
  /** stand next to (x,y) so that one step walks onto it; → {x,y,dir} (dir = the key to press) */
  Q.besides = (x, y) => {
    const M = R.Field.map;
    const free = (xx, yy) => M.inBounds(xx, yy) && M.walkable(xx, yy) && !M.npcAt(xx, yy);
    for (const [d, [dx, dy]] of Object.entries({ up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] })) if (free(x + dx, y + dy)) return { x: x + dx, y: y + dy, dir: d };
    return null;
  };
  Q.npc = (id) => { const M = R.Field.map; const n = M && M.npcs.find((k) => k.id === id); return n ? { id: n.id, x: Math.round(n.x), y: Math.round(n.y), present: n.present !== false } : null; };
  Q.snapshot = () => {
    const g = R.Game, p = R.Field.pos();
    return { map: R.Field.map && R.Field.map.id, x: p && p.x, y: p && p.y, gold: g.gold, party: g.party.map((c) => c.id + ':' + c.name + ':' + c.level), reserve: (g.reserve || []).map((c) => c.id), flags: Object.keys(g.flags || {}).filter((k) => g.flags[k]).length, items: Object.keys(g.items || g.inv || {}).length, playFrames: g.playFrames };
  };
  Q.ready = true;
  return true;
}
/* eslint-enable no-undef */

// ============================================================================ driver
class Driver {
  constructor(o) {
    this.o = Object.assign({ html: path.join(ROOT, 'dist', 'index.html'), out: path.join(os.tmpdir(), 'chronicle_smoke'), verbose: false, size: [1024, 896] }, o || {});
    this.errors = []; // {stage, text}
    this.warnCount = 0;
    this.stage = 'boot';
    this.shots = [];
    this.pw = loadPlaywright();
  }
  log(...a) { if (this.o.verbose) console.log('   ·', ...a); }
  async open() {
    if (!this.pw) throw new Error('playwright is not installed');
    this.browser = await this.pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    this.ctx = await this.browser.newContext({ viewport: { width: this.o.size[0] + 40, height: this.o.size[1] + 40 } });
    this.page = await this.ctx.newPage();
    this.page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        // a source file that failed to load (the dist wrapper and main.js print it on every page load): once, tagged
        if (/^(LOAD ERRORS:|src\/[\w/.-]+\.js[: ])/.test(t)) {
          this.seenLoadErrors = this.seenLoadErrors || new Set();
          const key = (t.match(/src\/[\w/.-]+\.js/) || [t.split('\n')[0]])[0];
          if (this.seenLoadErrors.has(key)) return;
          this.seenLoadErrors.add(key);
          this.errors.push({ stage: this.stage, text: '[console.error] ' + t, load: true });
          console.log(`   ✗ [${this.stage}] load error: ${t.replace(/^LOAD ERRORS:\s*/, '').split('\n')[0].slice(0, 200)}`);
          return;
        }
        this.errors.push({ stage: this.stage, text: '[console.error] ' + t }); console.log(`   ✗ [${this.stage}] console.error: ${t.slice(0, 300)}`);
      }
      else if (m.type() === 'warning') { this.warnCount++; if (this.o.verbose) console.log('   · warn:', m.text().slice(0, 200)); }
    });
    this.page.on('pageerror', (e) => { const t = String((e && e.stack) || e); this.errors.push({ stage: this.stage, text: '[pageerror] ' + t }); console.log(`   ✗ [${this.stage}] pageerror: ${t.slice(0, 300)}`); });
    fs.mkdirSync(this.o.out, { recursive: true });
  }
  async close() { try { if (this.browser) await this.browser.close(); } catch (e) { /* ignore */ } this.browser = null; }
  /** (re)load the page and install the helper; settings: instant text, fast battles */
  async load(o) {
    o = o || {};
    await this.page.goto('file://' + this.o.html + (o.query ? '?' + o.query : ''));
    await this.page.waitForFunction(() => window.RPG && window.RPG.Engine && window.RPG.Engine.layers && window.RPG.Engine.layers.length > 0, null, { timeout: 30000 });
    const ok = await this.page.evaluate(HELPER);
    if (!ok) throw new Error('RPG not booted');
    const le = await this.page.evaluate(() => (window.RPG && window.RPG.loadErrors) || []);
    this.seenLoadErrors = this.seenLoadErrors || new Set();
    for (const e of le) {
      const key = (String(e).match(/src\/[\w/.-]+\.js/) || [String(e).split('\n')[0]])[0];
      if (this.seenLoadErrors.has(key)) continue;        // the same file fails on every page load: report it once
      this.seenLoadErrors.add(key);
      this.errors.push({ stage: this.stage, text: '[loadError] ' + e, load: true });
      console.log(`   ✗ [${this.stage}] loadError: ${String(e).split('\n')[0]}`);
    }
    if (o.settings !== false) {
      await this.page.evaluate((s) => { const S = window.RPG.Settings; Object.assign(S, s); }, Object.assign({ msgSpeed: 3, battleSpeed: 2 }, o.settingsVals || {}));
    }
  }
  st() { return this.page.evaluate(() => window.__qa.state()); }
  ev(fn, arg) { return this.page.evaluate(fn, arg); }
  wait(ms) { return this.page.waitForTimeout(ms); }
  async press(k, hold) {
    await this.page.keyboard.down(KEY[k]);
    await this.page.waitForTimeout(hold || 45);
    await this.page.keyboard.up(KEY[k]);
    await this.page.waitForTimeout(55);
  }
  async shot(name) {
    const file = path.join(this.o.out, name.replace(/[^\w.-]+/g, '_') + '.png');
    await this.page.locator('#screen').screenshot({ path: file });
    this.shots.push(file);
    this.log('shot', file);
    return file;
  }
  /** poll until fn(state) is true (no key presses) */
  async until(fn, timeoutMs, what) {
    const t0 = Date.now();
    for (;;) {
      const s = await this.st();
      if (fn(s)) return s;
      if (Date.now() - t0 > (timeoutMs || 10000)) throw new Error(`timeout waiting for ${what || 'state'}: ${brief(s)}`);
      await this.wait(50);
    }
  }
  /** wait until the field is idle for a few polls (no key presses) */
  async idle(timeoutMs) {
    let n = 0;
    return this.until((s) => (s.idle ? ++n >= 3 : ((n = 0), false)), timeoutMs || 15000, 'the field to be idle');
  }
  /**
   * Press keys by policy until `done(state)` is true. Policy keys:
   *   create {gender:'m'|'f', type, favor}, companions [ids], battle 'auto'|'fight', choice index|fn,
   *   killMons (mons HP → 1 at the party command), wipe (party HP → 0 at the party command),
   *   onState(state) → optional side effects (screenshots), menus 'close' (default) | 'leave'.
   */
  async drive(pol, done, timeoutMs, what) {
    pol = pol || {};
    const t0 = Date.now();
    let sig = '', same = 0, idleN = 0;
    const seen = new Set();
    for (;;) {
      const s = await this.st();
      if (pol.onState) await pol.onState(s, seen);
      if (done(s)) return s;
      if (Date.now() - t0 > (timeoutMs || 60000)) throw new Error(`timeout (${what || 'drive'}): ${brief(s)}`);
      const k = await this.decide(s, pol);
      const g = brief(s) + '|' + k;
      if (g === sig) same++; else { sig = g; same = 0; }
      // a stage (the chapter scene, captions) runs on timers and only skips waits on A: it may look the same for long
      if (same > (s.top === 'StageLayer' ? 900 : 60) && k !== 'wait') throw new Error(`stuck (${what || 'drive'}): ${brief(s)} (pressing ${k})`);
      if (s.idle && !done(s)) { if (++idleN > (pol.idleLimit || 40)) throw new Error(`the field is idle but ${what || 'the goal'} was not reached: ${brief(s)}`); } else idleN = 0;
      if (k === 'wait') await this.wait(60);
      else if (k === 'close-message') { await this.ev(() => window.RPG.UI.closeMessage()); this.errors.push({ stage: this.stage, text: `[smoke] a message window was left open after the event (${s.msg && s.msg.text})` }); }
      else await this.press(k);
    }
  }
  async decide(s, pol) {
    const t = s.top;
    if (s.overlay) return 'b';
    if (t === 'MessageLayer') {
      if (s.msg && !s.msg.waiting) return s.evBusy ? 'wait' : 'close-message';
      return 'a';
    }
    if (t === 'ChoiceLayer') {
      const want = typeof pol.choice === 'function' ? pol.choice(s) : pol.choice != null ? pol.choice : 0;
      if (want === 'b') return 'b';
      if (s.list && s.list.index !== want && want < s.list.n) return s.list.index < want ? 'down' : 'up';
      return 'a';
    }
    if (t === 'NumberLayer') return 'a';
    if (t === 'TitleLayer') return s.title && s.title.stage === 'press' ? 'a' : 'wait';
    if (t === 'MenuLayer') { // the title's command window
      const want = pol.titleIndex != null ? pol.titleIndex : 0;
      if (s.list.index !== want) return s.list.index < want ? 'down' : 'up';
      return 'a';
    }
    if (t === 'SlotPicker') { const want = pol.slot || 0; if (s.slot.index !== want) return 'down'; return 'a'; }
    if (t === 'CreateLayer') {
      const c = s.create, w = pol.create || {};
      if (c.busy) return 'wait';
      if (c.step === 0) return w.gender && c.gender !== w.gender ? 'right' : 'a';
      if (c.step === 1) return w.type && c.type !== w.type ? 'down' : 'a';
      if (c.step === 2) return w.favor && c.favor !== w.favor && (this._favTries = (this._favTries || 0) + 1) < 40 ? 'down' : 'a';
      if (c.step === 4) return c.yes ? 'left' : 'a';
      return 'wait';
    }
    if (t === 'NameLayer') {
      const n = s.name;
      if (n.busy) return 'wait';
      if (n.cy < 9) return 'up';
      if (n.cr !== 1) return 'down';
      if (n.cc !== 2) return 'right';
      return 'a';
    }
    if (t === 'ChooseLayer') {
      const c = s.choose;
      if (c.busy) return 'wait';
      if (c.mode === 'browse') return 'b';
      const want = (pol.companions || ['brigitta', 'marta', 'sylvain']).filter((id) => c.ids.includes(id) && !c.chosen.includes(id));
      const target = want[0] || c.ids.find((id) => !c.chosen.includes(id));
      if (c.chosen.length >= c.count) return 'wait';
      if (c.id !== target) {
        // オーナー指示 A15: a 10-wide grid — ↑↓ change the row (same column), →  steps along the row (wrapping)
        const COLS = 10, ti = c.ids.indexOf(target);
        return Math.floor(ti / COLS) !== Math.floor(c.cur / COLS) ? 'down' : 'right';
      }
      return 'a';
    }
    if (t === 'GameOverLayer') return s.gameover.canSkip ? 'a' : 'wait';
    if (t === 'BattleScene') {
      const b = s.battle;
      if (b.waitKey) return 'a';
      if (!b.input) return 'wait';
      if (b.party) {
        if (pol.wipe) { await this.ev(() => { for (const u of window.__qa.lastScene.eng.party) u.hp = 0; }); return 'a'; }
        if (pol.killMons) await this.ev(() => { for (const u of window.__qa.lastScene.eng.mons) if (u.hp > 1) u.hp = 1; });
        // オート (index 2) wins a battle whatever the members carry; 戦う (index 0) + 防御 each is the manual round
        const mode = pol.killMons ? 'auto' : pol.battle || 'auto';
        return b.index === (mode === 'auto' ? 2 : 0) ? 'a' : gridStep(b.index, mode === 'auto' ? 2 : 0, b.cols);
      }
      // a member's command window: move to 防御 and take it; any sub-list (weapon techs, spells,
      // items, a target) is left with B — a manual round is "everyone defends", which is valid in every row
      const items = b.items || [], di = items.indexOf('防御');
      if (di < 0) return 'b';
      if (b.index === di) return 'a';
      return gridStep(b.index, di, b.cols);
    }
    if (t === 'StageLayer') return 'a';
    if (t === 'FieldLayer') return 'wait';
    // menus and screens (MainMenu, Screen subclasses, shops, tavern commands …): leave them
    if (pol.menus === 'leave') return 'wait';
    return 'b';
  }
  /** warp to map (spawn or {x,y,dir}) through the debug hook, then let onEnter run */
  async warp(map, spawn, pol) {
    await this.ev(([m, sp]) => { window.RPG.debug.warp(m, sp); }, [map, spawn == null ? 'entrance' : spawn]);
    await this.until((s) => s.map === map && !s.busy || s.top !== 'FieldLayer', 8000, 'warp to ' + map);
    await this.drive(pol || {}, (s) => s.idle && s.map === map, 60000, 'onEnter of ' + map);
  }
  /** tap a direction and wait for the step to finish; → the new position */
  async step(dir) {
    await this.press(dir);
    return this.until((s) => !s.mv, 3000, 'the step to finish');
  }
}
/** the key that moves a list cursor from `from` toward `to` in a grid of `cols` columns (row first, then column;
 *  the party command window is 1 column since the side-view layout, a member's command window 2) */
function gridStep(from, to, cols) {
  cols = Math.max(1, cols || 1);
  const r0 = Math.floor(from / cols), r1 = Math.floor(to / cols);
  if (r0 !== r1) return r0 < r1 ? 'down' : 'up';
  return from < to ? 'right' : 'left';
}
function brief(s) {
  if (!s) return '?';
  const bits = [s.top];
  if (s.map) bits.push(`${s.map}@${s.x},${s.y}`);
  if (s.msg) bits.push('msg:' + String(s.msg.text).slice(0, 40) + (s.msg.waiting ? '' : '(idle)'));
  if (s.list) bits.push('list#' + s.list.index);
  if (s.create) bits.push(`create step ${s.create.step} ${s.create.gender}/${s.create.type}/${s.create.favor}`);
  if (s.name) bits.push(`name cy${s.name.cy} cr${s.name.cr} cc${s.name.cc} '${s.name.str}'`);
  if (s.choose) bits.push(`choose ${s.choose.id} [${s.choose.chosen}]`);
  if (s.battle) bits.push(`battle r${s.battle.round} in${+s.battle.input} party${+s.battle.party} key${+s.battle.waitKey} ${s.battle.result || ''}`);
  if (s.busy) bits.push('busy');
  if (s.evBusy) bits.push('event');
  if (s.fade) bits.push('fade ' + s.fade);
  if (s.wipe) bits.push('wipe');
  return bits.join(' ');
}

// ============================================================================ stages
class Stages {
  constructor(D, o) { this.D = D; this.o = o; this.results = []; }
  async run(id, fn) {
    const D = this.D;
    D.stage = id;
    const e0 = D.errors.length;
    const t0 = Date.now();
    let status = 'PASS', detail = '', notes = [];
    const ctx = { note: (s) => notes.push(s), skip: (why) => { const e = new Error(why); e.skip = true; throw e; } };
    try {
      const r = await fn(ctx);
      if (r && r.status) { status = r.status; detail = r.detail || ''; } else if (typeof r === 'string') detail = r;
    } catch (e) {
      if (e.skip) { status = 'SKIP'; detail = e.message; } else { status = 'FAIL'; detail = e.message.split('\n')[0]; if (this.o.verbose) console.log(e.stack); }
      if (!e.skip) { try { await D.shot('FAIL_' + id); } catch (e2) { /* ignore */ } }
    }
    const errs = D.errors.slice(e0);
    if (errs.length && status === 'PASS') { status = 'FAIL'; detail = `${errs.length} console error(s): ${errs[0].text.slice(0, 160)}` + (detail ? ' — ' + detail : ''); }
    const res = { id, status, detail, notes, ms: Date.now() - t0 };
    this.results.push(res);
    const mark = status === 'PASS' ? '✓' : status === 'SKIP' ? '–' : '✗';
    console.log(`${mark} ${status.padEnd(4)} ${id.padEnd(22)} ${(res.ms / 1000).toFixed(1).padStart(5)}s  ${detail}`);
    for (const n of notes) console.log(`         ${n}`);
    return res;
  }
  ok(id) { const r = this.results.find((x) => x.id === id); return !!r && r.status === 'PASS'; }
}

// ---------------------------------------------------------------- the story plan (progress.js)
function storyPlan() {
  const R = require('./lib/load')();
  const P = require('./progress.js');
  const model = new P.Model(R);
  const s = P.newState(model);
  P.run(model, s, { decorPass: true });
  const plain = (l) => ({
    event: l.event, why: l.why, gives: l.gives, round: l.round,
    map: l.at && l.at.map, npc: l.at && l.at.npc ? { id: l.at.npc.id, x: l.at.npc.x, y: l.at.npc.y } : null,
    spot: l.at && l.at.event ? { x: l.at.event.x, y: l.at.event.y, trigger: l.at.event.trigger || 'step' } : null,
    onEnter: /^onEnter /.test(l.why || ''),
  });
  // an event run by ev.call ('called by …') happens inside its caller: it is not a step of its own
  const log = s.log.map(plain).filter((l) => l.map && l.gives.some((g) => !/^warp:/.test(g)) && !/^common_/.test(l.event) && !/^called by /.test(l.why || ''));
  const mapRegion = {};
  for (const [id, d] of Object.entries(R.DB.maps || {})) mapRegion[id] = d.region || null;
  const R0 = { regions: Object.keys(R.DB.regions || {}), order: (R.DB.config && R.DB.config.regionOrder) || null, locations: R.DB.locations || {}, mapRegion };
  return { log, meta: R0 };
}

async function runPlanEntry(D, e, ctx, pol) {
  // already given? (the tutorial step cells after the keeper's talk, …)
  const have = await D.ev((gives) => {
    const R = window.RPG;
    return gives.every((g) => {
      const m = String(g).match(/^(\w+):(.*)$/); if (!m) return true;
      const [, k, v] = m;
      if (k === 'flag') return !!R.State.flag(v);
      if (k === 'item') return !!R.State.hasItem(v);
      if (k === 'region') return (R.Game.regionsCleared || []).includes(v);
      if (k === 'recruit') return R.State.all().some((c) => c.id === v);
      return true;
    });
  }, e.gives.filter((g) => !/^var:/.test(g)));
  if (have) return 'already';
  let s = await D.st();
  if (s.map !== e.map) {
    const spawn = await D.ev((m) => { const d = window.RPG.DB.maps[m]; const sp = (d && d.spawns) || {}; return sp.entrance ? 'entrance' : Object.keys(sp)[0] || 'entrance'; }, e.map);
    await D.warp(e.map, spawn, pol);
    s = await D.st();
  }
  if (e.onEnter) return 'entered';
  if (e.npc) {
    const n = await D.ev((id) => window.__qa.npc(id), e.npc.id);
    if (!n) throw new Error(`npc ${e.npc.id} is not on ${e.map}`);
    const at = await D.ev(([x, y]) => window.__qa.approach(x, y), [n.x, n.y]);
    if (!at) throw new Error(`no free cell next to npc ${e.npc.id} (${n.x},${n.y})`);
    await D.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [at.x, at.y, at.dir]);
    await D.wait(80);
    await D.press('a');
  } else if (e.spot) {
    if (e.spot.trigger === 'step') {
      const at = await D.ev(([x, y]) => window.__qa.besides(x, y), [e.spot.x, e.spot.y]);
      if (!at) throw new Error(`no free cell beside the step event at ${e.spot.x},${e.spot.y}`);
      await D.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [at.x, at.y, at.dir]);
      await D.wait(80);
      await D.press(at.dir);
    } else {
      const at = await D.ev(([x, y]) => window.__qa.approach(x, y), [e.spot.x, e.spot.y]);
      if (!at) throw new Error(`no free cell next to ${e.spot.x},${e.spot.y}`);
      await D.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [at.x, at.y, at.dir]);
      await D.wait(80);
      await D.press('a');
    }
  }
  return 'fired';
}
async function givesMissing(D, gives) {
  return D.ev((gv) => {
    const R = window.RPG;
    return gv.filter((g) => {
      const m = String(g).match(/^(\w+):(.*)$/); if (!m) return false;
      const [, k, v] = m;
      if (k === 'flag') return !R.State.flag(v);
      if (k === 'item') return !R.State.hasItem(v);
      if (k === 'region') return !(R.Game.regionsCleared || []).includes(v);
      if (k === 'recruit') return !R.State.all().some((c) => c.id === v);
      return false;
    });
  }, gives.filter((g) => !/^var:/.test(g)));
}

// ---------------------------------------------------------------- the vertical slice
async function slice(D, S, o) {
  const plan = o.plan || storyPlan();
  const pol = { battle: 'auto', create: { gender: 'f', type: 'spellblade', favor: 'fire' }, companions: ['brigitta', 'marta', 'sylvain'] };
  const shotOnce = (key, name) => async (s, seen) => { if (!seen.has(key) && name(s)) { seen.add(key); await D.shot(name(s)); } };
  let started = false;

  await S.run('slice.title', async (c) => {
    D.stage = 'slice.title';
    await D.load();
    await D.ev(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    await D.load();
    await D.until((s) => s.top === 'TitleLayer', 15000, 'the title screen');
    await D.wait(1200);
    await D.shot('01_title');
    await D.drive(pol, (s) => s.top === 'MenuLayer', 10000, 'the title menu');
    await D.shot('02_title_menu');
    return 'title → press → menu';
  });
  await S.run('slice.newgame', async (c) => {
    if (!S.ok('slice.title')) c.skip('no title');
    let seenCreate = false;
    await D.drive(Object.assign({}, pol, { titleIndex: 0 }), (s) => (seenCreate = seenCreate || s.top === 'CreateLayer'), 30000, 'はじめから → the hero creation');
    started = true;
    const s = await D.st();
    return `はじめから → ${s.layers.join(' > ')}`;
  });
  await S.run('slice.create', async (c) => {
    if (!started) c.skip('no new game');
    const snap = async (s, seen) => {
      if (s.top === 'CreateLayer' && !s.create.busy) { const k = 'create' + s.create.step; if (!seen.has(k) && s.create.step !== 3) { seen.add(k); await D.wait(150); await D.shot(`03_create_step${s.create.step}`); } }
      if (s.top === 'NameLayer' && !seen.has('name')) { seen.add('name'); await D.wait(150); await D.shot('04_name_entry'); }
    };
    await D.drive(Object.assign({}, pol, { onState: snap }), (s) => s.top !== 'CreateLayer' && s.top !== 'NameLayer', 60000, 'the hero creation');
    const h = await D.ev(() => { const h = window.RPG.State.hero(); return h && { name: h.name, gender: h.gender, type: h.heroType || h.type, favor: h.favor, level: h.level }; });
    if (!h || !h.name) throw new Error('no hero after the creation');
    if (h.type !== 'spellblade' || h.gender !== 'f') throw new Error('hero made as ' + JSON.stringify(h));
    return `hero ${h.name} (${h.gender}/${h.type}/${h.favor && h.favor.id})`;
  });
  // ---- the prologue by the progress plan
  const iDone = plan.log.findIndex((l) => l.gives.includes('flag:prologue_done'));
  const pro = iDone >= 0 ? plan.log.slice(0, iDone + 1) : plan.log;
  const after = iDone >= 0 ? plan.log.slice(iDone + 1) : [];
  let glimBefore = null;
  await S.run('slice.prologue', async (c) => {
    if (!started) c.skip('no new game');
    if (iDone < 0) c.note('progress: prologue_done is never given (running what there is)');
    await D.drive(pol, (s) => s.idle, 60000, 'the opening');
    await D.shot('05_field_start');
    const done = [];
    for (const e of pro) {
      const tag = `${e.event}${e.npc ? '(' + e.npc.id + ')' : ''}`;
      const pre = await D.ev(() => { const h = window.RPG.State.hero(); return { t: (h.techs || []).length, s: (h.spells || []).length, lv: h.level }; });
      if (/tutorial|lighthouse_1_otto/.test(e.event) && !glimBefore) glimBefore = pre;
      if (/boss/.test(e.event)) {
        // the smoke walks with no encounters, so it reaches the boss at Lv1; a normal player arrives at about Lv4
        // (check_prologue campaign: hero Lv4, companions Lv4, wins 94–95%), so the party is raised to that first
        const low = await D.ev(() => Math.min.apply(null, window.RPG.Game.party.map((c) => c.level)));
        if (low < 4) { await D.ev(() => window.RPG.debug.level(4)); c.note(`${e.event}: party raised from Lv${low} to Lv4 (a normal player's level here)`); }
      }
      const how = await runPlanEntry(D, e, c, pol);
      if (how === 'already') continue;
      const seenScenes = await D.ev(() => window.__qa.scenes);
      await D.drive(Object.assign({}, pol, {
        onState: async (s, seen) => {
          if (s.top === 'ChooseLayer' && !seen.has('choose') && !s.choose.busy) { seen.add('choose'); await D.wait(200); await D.shot('06_tavern_choose'); }
          if (s.top === 'ChooseLayer' && s.choose.chosen.length === 2 && !seen.has('choose2')) { seen.add('choose2'); await D.shot('07_tavern_two_picked'); }
          if (s.top === 'BattleScene' && s.battle.party && !seen.has('battle')) { seen.add('battle'); await D.shot(`08_battle_${e.event}`); }
        },
      }), (s) => s.idle, 240000, tag);
      let miss = await givesMissing(D, e.gives);
      const battles = (await D.ev(() => window.__qa.scenes)) - seenScenes;
      if (miss.length && battles && /boss/.test(e.event)) {
        // lost the boss: note the levels, raise them and try again (the smoke's purpose is the flow)
        const lv = await D.ev(() => window.RPG.Game.party.map((c) => c.id + ' Lv' + c.level).join(', '));
        c.note(`${e.event}: the boss was not beaten with オート (${lv}) — retried at Lv 8 (debug)`);
        await D.ev(() => window.RPG.debug.level(8));
        await runPlanEntry(D, e, c, pol);
        await D.drive(pol, (s) => s.idle, 240000, tag + ' (retry)');
        miss = await givesMissing(D, e.gives);
      }
      if (miss.length) throw new Error(`${tag}: meta.gives not given in the game: ${miss.join(' ')}`);
      done.push(tag);
      if (/tutorial|lighthouse_1_otto/.test(e.event) && glimBefore) {
        const post = await D.ev(() => { const h = window.RPG.State.hero(); const L = window.RPG.Battle.last || {}; return { t: (h.techs || []).length, s: (h.spells || []).length, glim: (L.glimmers || []).length, drops: (L.drops || []).length }; });
        if (post.t + post.s <= glimBefore.t + glimBefore.s) throw new Error('the tutorial battle gave no 閃き');
        c.note(`tutorial: 閃き ✓ (techs ${glimBefore.t}→${post.t}, spells ${glimBefore.s}→${post.s})`);
      }
      if (/boss/.test(e.event)) {
        const L = await D.ev(() => { const L = window.RPG.Battle.last || {}; return { result: L.result, drops: (L.drops || []).map((d) => d.id || d.item || d), exp: L.exp, gold: L.gold, rounds: L.rounds }; });
        c.note(`boss: ${L.result} in ${L.rounds} rounds, exp ${L.exp}, gold ${L.gold}, drops ${JSON.stringify(L.drops)}`);
      }
    }
    const s = await D.st();
    await D.shot('09_after_prologue');
    const fl = await D.ev(() => ({ done: !!window.RPG.State.flag('prologue_done'), party: window.RPG.Game.party.map((c) => c.id + ' Lv' + c.level) }));
    if (iDone >= 0 && !fl.done) throw new Error('prologue_done is not set at the end');
    return `${done.length} story events: ${done.join(' → ')}; now ${s.map}@${s.x},${s.y}; party ${fl.party.join(', ')}`;
  });
  const storyOk = S.ok('slice.prologue');
  if (!storyOk && started) {
    // continue the later stages from a quick start so they still report
    await D.ev(() => window.RPG.debug.quickStart({ noEncounter: true }));
    await D.idle(20000);
  }
  await S.run('slice.menu', async (c) => {
    if (!started) c.skip('no game');
    await D.idle(20000);
    await D.press('y');
    await D.until((s) => s.top === 'MainMenu', 3000, 'the main menu');
    await D.wait(200);
    await D.shot('10_menu');
    // オーナー指示 A15: no 強さ command — → from the commands focuses the party cards, A opens that member's 強さ
    const pages = [['道具', 'items'], ['装備', 'equip'], [null, 'status']];
    const opened = [];
    for (const [idx, nm] of pages) {
      if (idx) await navList(D, idx);
      else { for (let i = 0; i < 2; i++) { await D.press('right'); await D.wait(80); } }
      await D.press('a');
      await D.until((s) => s.top !== 'MainMenu' || (s.list && s.list.hidden), 3000, 'the ' + nm + ' screen');
      await D.wait(250);
      const s = await D.st();
      if (s.top === 'MainMenu') continue;
      await D.shot('11_menu_' + nm);
      opened.push(nm + ':' + s.top);
      for (let i = 0; i < 6; i++) { const t = await D.st(); if (t.top === 'MainMenu' && !(t.list && t.list.hidden)) break; await D.press('b'); await D.wait(80); }
      if (!idx) { await D.press('left'); await D.wait(80); } // back from the party cards to the commands
    }
    await D.press('b');
    await D.idle(5000);
    return 'Y → ' + opened.join(', ') + ' → B';
  });
  // ---- one region (when its content has landed)
  await S.run('slice.region', async (c) => {
    if (!storyOk) c.skip('the prologue did not finish');
    // one region (§12.6-3 「地方 1 つ」): the one whose clear needs the fewest steps; only that region's steps are played
    // (any-order rule: a region's keys are inside the region)
    const regionOfStep = (l) => plan.meta.mapRegion[l.map] || null;
    let best = null;
    for (let i = 0; i < after.length; i++) {
      const g = after[i].gives.find((x) => /^region:/.test(x));
      if (!g) continue;
      const rid = g.slice(7);
      const steps = after.slice(0, i + 1).filter((l, k) => k === i || regionOfStep(l) === rid);
      if (!best || steps.length < best.steps.length) best = { rid, steps };
    }
    if (!best) c.skip(`no region can be cleared yet (progress: regions ${plan.meta.regions.length}, no region:<id> give reachable after the prologue)`);
    c.note(`region ${best.rid}: ${best.steps.length} step(s)`);
    const part = best.steps;
    for (const e of part) {
      const how = await runPlanEntry(D, e, c, pol);
      if (how === 'already') continue;
      await D.drive(pol, (s) => s.idle, 300000, e.event);
      let miss = await givesMissing(D, e.gives);
      if (miss.length && /boss/.test(e.event)) {
        c.note(`${e.event}: lost with オート — retried 3 levels higher (debug)`);
        await D.ev(() => window.RPG.debug.level(window.RPG.State.hero().level + 3));
        await runPlanEntry(D, e, c, pol);
        await D.drive(pol, (s) => s.idle, 300000, e.event + ' (retry)');
        miss = await givesMissing(D, e.gives);
      }
      if (miss.length) throw new Error(`${e.event}: not given: ${miss.join(' ')}`);
    }
    await D.shot('12_region_cleared');
    const reg = part[part.length - 1].gives.find((g) => /^region:/.test(g));
    return `${part.length} events → ${reg}`;
  });
  // ---- save → load → 冒険の合言葉
  let saved = null, code = null;
  await S.run('slice.save', async (c) => {
    if (!started) c.skip('no game');
    await D.idle(20000);
    await D.press('y');
    await D.until((s) => s.top === 'MainMenu', 3000, 'the main menu');
    await navList(D, 'セーブ');
    await D.press('a');
    await D.until((s) => s.top === 'SaveScreen' && s.slot.loaded, 5000, 'the save screen');
    await D.wait(150);
    await D.shot('13_save');
    saved = await D.ev(() => window.__qa.snapshot());
    await D.press('a');
    // (an overwrite question → はい) → 「記録1に書き記した。」 → back to the menu
    await D.drive({ menus: 'leave' }, (s) => s.top === 'MainMenu' && !(s.list && s.list.hidden), 10000, 'saving');
    const slots = await D.ev(() => window.RPG.Save.list());
    if (!slots || !slots[0]) throw new Error('slot 1 is empty after saving');
    // the 冒険の合言葉 (row 4 of the save screen)
    await navList(D, 'セーブ');
    await D.press('a');
    await D.until((s) => s.top === 'SaveScreen' && s.slot.loaded, 5000, 'the save screen');
    for (let i = 0; i < 3; i++) await D.press('down');
    await D.press('a');
    await D.until((s) => s.overlay, 5000, 'the code overlay');
    await D.wait(200);
    await D.page.screenshot({ path: path.join(D.o.out, '14_code_export.png') });
    code = await D.page.$eval('#code-overlay textarea', (t) => t.value);
    if (!code || code.length < 16) throw new Error('empty 冒険の合言葉');
    await D.press('b');
    await D.until((s) => !s.overlay, 3000, 'the overlay to close');
    for (let i = 0; i < 4; i++) { const s = await D.st(); if (s.idle) break; await D.press('b'); await D.wait(100); }
    await D.idle(5000);
    return `slot 1 at ${saved.map}@${saved.x},${saved.y}; 合言葉 ${code.length} chars`;
  });
  await S.run('slice.load', async (c) => {
    if (!saved) c.skip('nothing saved');
    await D.load();
    await D.until((s) => s.top === 'TitleLayer', 15000, 'the title screen');
    await D.wait(900);
    await D.drive({ titleIndex: 1 }, (s) => s.top === 'SlotPicker', 10000, 'つづきから');
    await D.wait(150);
    await D.shot('15_continue_slots');
    await D.drive({ titleIndex: 1 }, (s) => s.idle, 20000, 'loading slot 1');
    const now = await D.ev(() => window.__qa.snapshot());
    const diff = cmpSnap(saved, now);
    if (diff.length) throw new Error('loaded game differs: ' + diff.join('; '));
    await D.shot('16_loaded');
    return `つづきから → ${now.map}@${now.x},${now.y} (party, gold, flags, position equal)`;
  });
  await S.run('slice.code', async (c) => {
    if (!code) c.skip('no 合言葉');
    await D.load();
    await D.until((s) => s.top === 'TitleLayer', 15000, 'the title screen');
    await D.wait(900);
    await D.drive({ titleIndex: 2 }, (s) => s.overlay, 10000, '冒険の合言葉');
    await D.page.fill('#code-overlay textarea', code);
    await D.page.screenshot({ path: path.join(D.o.out, '17_code_import.png') });
    await D.page.click('#code-overlay button:has-text("決定")');
    await D.drive({ titleIndex: 2 }, (s) => s.idle, 20000, 'booting the 合言葉');
    const now = await D.ev(() => window.__qa.snapshot());
    const diff = cmpSnap(saved, now);
    if (diff.length) throw new Error('the 合言葉 game differs: ' + diff.join('; '));
    // a broken code is refused with the STYLE_JA line (and the title stays usable)
    return `合言葉 → ${now.map}@${now.x},${now.y} (same as the save)`;
  });
}
function cmpSnap(a, b) {
  const out = [];
  for (const k of ['map', 'x', 'y', 'gold', 'flags', 'items']) if (a[k] !== b[k]) out.push(`${k} ${a[k]} → ${b[k]}`);
  if (a.party.join() !== b.party.join()) out.push(`party ${a.party} → ${b.party}`);
  if (a.reserve.join() !== b.reserve.join()) out.push(`reserve ${a.reserve} → ${b.reserve}`);
  return out;
}
/** move a List cursor (MainMenu and other lists; the column count comes from the list, row-major) to `target`:
 *  an index, or an item label (e.g. 'セーブ') looked up in the list — the menu order is not hard-coded */
async function navList(D, target) {
  let last = null, same = 0;
  for (let i = 0; i < 60; i++) {
    const s = await D.st();
    if (!s.list) throw new Error('no list on ' + s.top);
    const want = typeof target === 'string' ? s.list.items.indexOf(target) : target;
    if (want < 0) throw new Error(`no '${target}' in the list (${s.list.items.join(' ')})`);
    const cur = s.list.index;
    if (cur === want) return;
    same = cur === last ? same + 1 : 0; last = cur;
    if (same > 4) break;
    await D.press(gridStep(cur, want, s.list.cols));
  }
  throw new Error('could not move the cursor to ' + target);
}

// ---------------------------------------------------------------- 全滅 → 復活 → 歩ける (S-W1〜S-W3)
async function wipeCase(D, c, kind) {
  await D.load();
  const setup = await D.ev(async (k) => {
    const R = window.RPG, DB = R.DB;
    await R.debug.quickStart({ noEncounter: true, gold: 101 });
    const zone0 = Object.keys(DB.encounters || {}).find((z) => (DB.encounters[z].tier || 0) === 0) || Object.keys(DB.encounters || {})[0];
    const out = { zone: zone0, respawn: R.Game.respawn && R.Game.respawn.map };
    if (k === 'world') {
      const loc = DB.locations && DB.locations.lute;
      const wid = R.FieldMap.findWorld ? R.FieldMap.findWorld(loc && loc.spawn) : 'world';
      await R.Field.warp(wid, loc ? loc.spawn : 'entrance', { fade: false });
      // step off the town tile onto open land (the zone of that cell)
      const M = R.Field.map, p = R.Field.pos();
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]]) {
        const x = p.x + dx, y = p.y + dy;
        if (M.walkable(x, y) && M.zoneAt(x, y)) { R.Field.setPlayerPos(x, y, 'down'); out.zone = M.zoneAt(x, y); break; }
      }
      out.map = M.id;
    } else if (k === 'boss') {
      R.debug.flag('pro_boss', false);
      await R.Field.warp('lighthouse_3', 'entrance', { fade: false });
      R.Field.refresh();
      out.map = R.Field.map && R.Field.map.id;
      const n = window.__qa.npc('boss');
      out.boss = n;
    } else out.map = R.Field.map && R.Field.map.id;
    return out;
  }, kind);
  await D.idle(20000);
  c.note(`start ${setup.map}; respawn → ${setup.respawn}; zone ${setup.zone}`);
  const enter0 = await D.ev(() => window.__qa.enterLog.length);
  const scenes0 = await D.ev(() => window.__qa.scenes);
  // ---- the losing battle
  if (kind === 'world') await D.ev((z) => { window.RPG.debug.battle(z); }, setup.zone);
  else if (kind === 'town') {
    await D.ev((z) => {
      const R = window.RPG, enc = R.DB.encounters[z] || {};
      const groups = enc.groups || enc.troops || [];
      let mons = null;
      for (const g of groups) { const m = g.mons || g.m || g; if (Array.isArray(m) && m.length) { mons = m.map((x) => (typeof x === 'string' ? x : x.id || x[0])).filter((id) => R.DB.monsters[id]); if (mons.length) break; } }
      if (!mons || !mons.length) mons = Object.keys(R.DB.monsters).filter((id) => (R.DB.monsters[id].tier || 0) === 0 && !(R.DB.monsters[id].flags || []).includes('rare') && !R.DB.monsters[id].boss).slice(0, 2);
      window.__qa.after = false;
      R.Events.run(async (ev) => { await ev.battle({ mons }); window.__qa.after = true; await ev.say('（この文は出てはいけない）'); }, { self: 'smoke' });
    }, setup.zone);
  } else {
    if (!setup.boss) c.skip('no boss npc on lighthouse_3');
    const at = await D.ev(([x, y]) => window.__qa.approach(x, y), [setup.boss.x, setup.boss.y]);
    await D.ev(([x, y, d]) => window.RPG.debug.here(x, y, d), [at.x, at.y, at.dir]);
    await D.wait(80);
    await D.press('a');
  }
  let wiped = false;
  await D.drive({ wipe: true, menus: 'leave' }, (s) => (s.top === 'GameOverLayer' ? (wiped = true) : false), 90000, 'the wipe');
  await D.wait(300);
  await D.shot(`20_gameover_${kind}`);
  // skip the game over with A, then the wake-up text with A
  await D.until((s) => s.top !== 'GameOverLayer' || s.gameover.canSkip, 10000, 'the game-over skip');
  await D.press('a');
  const s1 = await D.until((s) => s.top === 'MessageLayer' && s.msg && s.msg.waiting && s.msg.typed, 20000, 'the wake-up text');
  await D.shot(`21_wakeup_${kind}`);
  if (!/目を覚ました/.test(s1.msg.text)) c.note('wake-up text: ' + s1.msg.text);
  let f0 = await D.ev(() => window.RPG.Engine.frame);
  await D.press('a');
  // a second page (「所持金が半分になった。」 is on the same page by default)
  let s2 = await D.st();
  if (s2.top === 'MessageLayer' && s2.msg.waiting) { f0 = await D.ev(() => window.RPG.Engine.frame); await D.press('a'); }
  const inv = await D.ev(([f, g]) => window.__qa.waitInv(60, f, { gold: g }), [f0, 50]);
  if (!inv.ok) throw new Error(`§4.12.2 invariants not true within 60 frames: ${inv.fails.join('; ')}`);
  c.note(`invariants ①–⑥ true ${inv.frames} frame(s) after the last A`);
  const post = await D.ev((e0) => ({ enter: window.__qa.enterLog.slice(e0), map: window.RPG.Field.map.id, after: window.__qa.after, busy: window.RPG.Events.busy() }), enter0);
  const onEnterRuns = post.enter.filter((e) => e.map === post.map).length;
  const hasOnEnter = await D.ev((m) => !!(window.RPG.DB.maps[m] && window.RPG.DB.maps[m].onEnter), post.map);
  if (onEnterRuns > 1) throw new Error(`⑦ the onEnter of ${post.map} ran ${onEnterRuns} times after the wipe`);
  c.note(`⑦ onEnter of ${post.map}: ${hasOnEnter ? onEnterRuns + ' run' : 'none on the map'}`);
  if (kind === 'town' && post.after) throw new Error('the event went on after the lost ev.battle (it must be aborted)');
  if (post.map !== setup.respawn && setup.respawn) c.note(`woke up on ${post.map} (respawn said ${setup.respawn})`);
  // ---- walk right 3 tiles
  const p0 = await D.st();
  let moved = 0, dirUsed = 'right';
  for (const dir of ['right', 'left', 'down', 'up']) {
    let last = await D.st();
    for (let i = 0; i < 3; i++) { const n = await D.step(dir); if (n.x !== last.x || n.y !== last.y) moved++; last = n; }
    if (moved) { dirUsed = dir; break; }
  }
  const p1 = await D.st();
  if (!moved) throw new Error(`cannot walk after the wipe (stays at ${p0.x},${p0.y})`);
  if (dirUsed !== 'right') c.note(`right is blocked at the respawn point; walked ${dirUsed}`);
  // ---- Y → menu, B → field
  await D.press('y');
  await D.until((s) => s.top === 'MainMenu', 3000, 'the menu after the wipe');
  await D.press('b');
  await D.until((s) => s.idle, 3000, 'the field after closing the menu');
  // ---- another random battle, won
  const nScenes = await D.ev(() => window.__qa.scenes);
  await D.ev((z) => { window.RPG.debug.battle(z); }, setup.zone);
  await D.drive({ battle: 'fight', killMons: true, menus: 'leave' }, (s) => s.idle && s.scenes > nScenes, 60000, 'the next battle');
  const last = await D.ev((n0) => ({ res: window.RPG.Battle.last && window.RPG.Battle.last.result, scenes: window.__qa.scenes - n0 }), scenes0);
  if (last.scenes < 2 || last.res !== 'win') throw new Error(`the battle after the wipe: ${last.res} (${last.scenes} battle scene(s))`);
  return `lost → gameover → ${post.map}; inv ${inv.frames}f; walked ${moved} (${p0.x},${p0.y}→${p1.x},${p1.y}); menu ✓; next battle won`;
}

// ---------------------------------------------------------------- リピート (S-R1)
async function repeatCase(D, c) {
  await D.load();
  const mons = await D.ev(async () => {
    const R = window.RPG;
    await R.debug.quickStart({ noEncounter: true, level: 30 });
    const id = Object.keys(R.DB.monsters).find((k) => { const m = R.DB.monsters[k]; return (m.tier || 0) === 0 && !m.boss && !/^(b_|rm_)/.test(k) && !(m.flags || []).some((f) => f === 'boss' || f === 'rare' || f === 'metal'); });
    return [id];
  });
  await D.idle(20000);
  const start = () => D.ev((m) => { window.RPG.Events.run((ev) => ev.battle({ mons: m, noRare: true, noGolden: true }), { self: 'smoke' }); }, mons);
  await start();
  const b0 = await D.until((s) => s.top === 'BattleScene' && s.battle.party, 20000, 'the party command');
  await D.ev(() => { for (const u of window.__qa.lastScene.eng.mons) { u.hp = 60000; } });
  // round 1: 戦う + everyone defends
  await D.drive({ battle: 'fight', menus: 'leave' }, (s) => s.top === 'BattleScene' && !s.battle.input, 20000, 'round 1 commands');
  const s2 = await D.until((s) => s.top === 'BattleScene' && s.battle.party, 30000, 'the party command of round 2');
  if (!s2.battle.canRepeat) throw new Error('リピート is not enabled after round 1');
  // リピート (index 1 of 戦う / リピート / オート / 逃げる; the window's column count decides the key)
  for (let i = 0; i < 4; i++) { const s = await D.st(); if (s.battle.index === 1) break; await D.press(gridStep(s.battle.index, 1, s.battle.cols)); }
  await D.shot('30_repeat_select');
  const pm0 = await D.ev(() => window.__qa.pm);
  await D.press('a');
  const r0 = (await D.until((s) => s.top === 'BattleScene' && s.battle.repeating, 5000, 'repeating on')).battle.round;
  await D.wait(300);
  await D.shot('31_repeat_on');
  const r3 = await D.until((s) => s.top === 'BattleScene' && (s.battle.round >= r0 + 3 || s.battle.result), 90000, '3 repeated rounds');
  const pm1 = await D.ev(() => window.__qa.pm);
  if (r3.battle.result) throw new Error('the battle ended during the repeat');
  if (pm1 !== pm0) throw new Error(`the party command came back during リピート (${pm1 - pm0} time(s))`);
  c.note(`rounds ${r0}→${r3.battle.round} without the party command`);
  // B: the round finishes, then the party command is back and リピート is off
  await D.press('b');
  const sb = await D.until((s) => s.top === 'BattleScene' && (s.battle.repeatCancel || !s.battle.repeating), 3000, 'リピート解除');
  await D.shot('32_repeat_cancel');
  const rb = sb.battle.round;
  const back = await D.until((s) => s.top === 'BattleScene' && s.battle.party, 30000, 'the party command after B');
  const pmLog = await D.ev(() => window.__qa.pmLog.slice(-1)[0]);
  if (back.battle.repeating || back.battle.repeatCancel) throw new Error('リピート still on at the party command after B');
  if (back.battle.round - rb > 1) throw new Error(`the party command came ${back.battle.round - rb} rounds after B (must be the next input)`);
  c.note(`B at round ${rb} → party command at round ${back.battle.round} (repeating ${pmLog && pmLog.repeating})`);
  // finish: monsters HP 1, 戦う
  let nS = await D.ev(() => window.__qa.scenes);
  await D.drive({ battle: 'fight', killMons: true, menus: 'leave' }, (s) => s.idle, 60000, 'finishing the battle');
  // the next battle starts without リピート
  nS = await D.ev(() => window.__qa.scenes);
  await start();
  await D.until((s) => s.scenes > nS, 10000, 'the next battle scene');
  const n1 = await D.until((s) => s.top === 'BattleScene' && s.battle.party, 20000, 'the next battle');
  if (n1.battle.repeating) throw new Error('the next battle starts with リピート on');
  if (n1.battle.canRepeat) c.note('the next battle offers リピート on round 1 (lastCmds carried over)');
  await D.drive({ battle: 'fight', killMons: true, menus: 'leave' }, (s) => s.idle, 60000, 'the next battle');
  void b0;
  return `リピート ${r3.battle.round - r0} rounds without input → B → party command next input → next battle manual`;
}

// ============================================================================ main
async function main() {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const flag = (k) => argv.includes('--' + k);
  const only = opt('only', 'sweep,slice,SW1,SW2,SW3,SR1').split(',');
  const o = { html: path.resolve(opt('html', path.join(ROOT, 'dist', 'index.html'))), out: path.resolve(opt('out', path.join(os.tmpdir(), 'chronicle_smoke'))), verbose: flag('verbose') };
  if (!flag('no-build') && !argv.includes('--html')) {
    try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js')], { stdio: 'pipe' }); } catch (e) { console.log('build failed:', String(e.stderr || e).slice(0, 400)); }
  }
  const t0 = Date.now();
  const pre = [];                               // results of the non-browser stages
  if (only.includes('sweep')) {
    const V = require('./validate');
    for (const x of V.runSweep()) {
      const st = x.rc === 0 ? 'PASS' : 'FAIL', last = x.tail.split('\n').slice(-1)[0];
      console.log(`${st} sweep ${x.tool} [${x.owner}] rc=${x.rc} ${(x.ms / 1000).toFixed(1)}s — ${last}`);
      pre.push({ id: 'sweep ' + x.tool, status: st, detail: `[${x.owner}] rc=${x.rc} ${last}` });
    }
  }
  const browserStages = only.filter((k) => k !== 'sweep');
  const D = new Driver(o);
  if (!D.pw || !browserStages.length) {
    if (!D.pw && browserStages.length) console.log('SKIP smoke browser stages: playwright is not installed');
    const nf = pre.filter((r) => r.status === 'FAIL').length;
    console.log(`\nsmoke: ${pre.length - nf} pass, ${nf} fail — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    if (nf) process.exitCode = 1;
    return;
  }
  const S = new Stages(D, o);
  S.results.push(...pre);
  console.log(`smoke: ${path.relative(ROOT, o.html)} → screenshots in ${o.out}`);
  try {
    await D.open();
    if (only.includes('slice')) await slice(D, S, o);
    if (only.includes('SW1')) await S.run('S-W1 world battle', (c) => wipeCase(D, c, 'world'));
    if (only.includes('SW2')) await S.run('S-W2 town event', (c) => wipeCase(D, c, 'town'));
    if (only.includes('SW3')) await S.run('S-W3 dungeon boss', (c) => wipeCase(D, c, 'boss'));
    if (only.includes('SR1')) await S.run('S-R1 repeat', (c) => repeatCase(D, c));
  } catch (e) {
    console.log('smoke aborted:', e.stack || e);
    S.results.push({ id: 'driver', status: 'FAIL', detail: String(e.message || e) });
  } finally {
    await D.close();
  }
  const n = (st) => S.results.filter((r) => r.status === st).length;
  console.log(`\nsmoke: ${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skip — ${D.errors.length} console error(s), ${D.warnCount} warning(s), ${D.shots.length} screenshot(s) — ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (flag('json')) console.log(JSON.stringify({ results: S.results, errors: D.errors, shots: D.shots }, null, 1));
  if (n('FAIL') || D.errors.length) process.exitCode = 1;
}

module.exports = { Driver, HELPER, KEY, brief, gridStep, navList, storyPlan, runPlanEntry, givesMissing };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
