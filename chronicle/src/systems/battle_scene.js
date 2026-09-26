// DQ-style battle scene (owner: bui A3 — DESIGN §11.5): backdrop + monsters, four
// party status windows on top, command menus / messages at the bottom. It drives a
// R.Battle.Engine and only animates the events the engine yields (battle.js), so
// real battles and R.Battle.simulate share every rule. The scene alone plays sounds,
// jingles and screen shakes (§3.3.8).
//
//   const result = await R.Battle.start({zone|troop|mons, bg, bgm, canLose, noEscape, surprise,
//                                        noRare, noGolden, tier, lvOff, glimmerForce, members});
//   → 'win' | 'lose' | 'escape'          R.Battle.last = {result, rounds, killed, exp, gold, drops, glimmers, levelUps, …}
//
// Public layout constants (§11.5.1 / §11.11.3): R.Battle.WIN WIN_BOTTOM HELP BOX GROUND BANNER CARD.
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const B = (R.Battle = R.Battle || {});

  // layout constants (DESIGN §11.5.1 / §11.11.3 — public: R.Battle.WIN / BOX / HELP …)
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }; // 4 party status windows (y 5–51, bottom tags to 55)
  const WIN_BOTTOM = 56; // bottom edge of the window band (every Crest "52" became this)
  const HELP = { x: 8, y: 133, w: 240, h: 19 }; // help / target strip (command input only)
  const BOX = { x: 8, y: 150, w: 240, h: 68, lines: 4 }; // bottom window (commands / 4 message lines)
  const GROUND = 130; // monsters' feet
  const BANNER = { y: 64, h: 32 }; // glimmer tech-name banner
  const CARD = { y: 64 }; // drop card
  const ENEMY_WIN = { x: 138, y: 150, w: 110, h: 68 }; // enemy names beside the party / member command window (§11.5.4)
  const CMD_W = 128;

  const AUTO_OPTS = { thrift: true, items: 'auto' }; // オート: conserve MP, items only as a last resort
  const BACK = { back: true };
  const METAL_COL = '#c8d0e0'; // 鋼の魔物の名前 (§11.1.2)
  const GOLD_TINT = '#ffd24a';
  const GLOW_FILL = '#fff0a0', GLOW_EDGE = '#ffd24a';
  const GLOW_FRAMES = 40;
  const GLIM_MIN = 36; // the tech's own fx never starts earlier than this after the ピコーン (§11.0 0.5)
  // unusable(u, id, slot) → help line (§11.5.3 / STYLE_JA §9)
  const WHY = {
    wp: 'WPが足りない！', mp: 'MPが足りない！', silence: '術を封じられている！', reach: '中列からは届かない。',
    field: '戦闘中は使えない。', noescape: 'この戦いからは逃げられない！',
  };
  const HELP_REPEAT = '前と同じ行動を、Bを押すまで続ける。';
  const HELP_REPEAT_NONE = 'くり返す行動がまだない。';
  const HELP_NOESCAPE = 'この戦いからは逃げられない！';
  // used only while DB.statuses is empty (order of §7.9.2)
  const BASE_STATUSES = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'regen', 'veil', 'counter', 'nimble', 'cover'];
  const GRADE_RANK = { normal: 0, rare: 1, super: 2 };

  // ------------------------------------------------------------ small helpers
  function mem(c) {
    const blank = () => ({ cmd: 0, list: {}, item: 0, target: null });
    if (!c) return blank();
    if (R.Settings && R.Settings.cursorMemory === false) return blank();
    if (!c.mem || typeof c.mem !== 'object') c.mem = blank();
    if (!c.mem.list || typeof c.mem.list !== 'object') c.mem.list = {};
    return c.mem;
  }
  const flagOf = (m, f) => !!m && (typeof m.flag === 'function' ? m.flag(f) : !!(m.d && m.d.flags && m.d.flags.includes(f)));
  const isGolden = (m) => !!m && !!(m.golden || (m.d && m.d.golden) || flagOf(m, 'golden'));
  const isMetal = (m) => flagOf(m, 'metal');
  const isRareMon = (m) => flagOf(m, 'rare');
  const actionOf = (id) => (DB.actions && DB.actions[id]) || null;
  const wpOf = (u) => (u.wp != null ? u.wp : (u.c && u.c.wp) || 0);
  function mwpOf(u) {
    if (u.mwp != null) return u.mwp;
    if (u.st && u.st.wp != null) return u.st.wp;
    try { return (R.Rules.stats(u.c) || {}).wp || 0; } catch (e) { return 0; }
  }
  /** the six element ids in their official order (DB.elements key order) */
  const elemOrder = () => { const k = Object.keys(DB.elements || {}); return k.length ? k : ['fire', 'water', 'wind', 'earth', 'light', 'dark']; };
  /** オート: the party AI with the in-game options (battle_ai's own AUTO_OPTS when it defines them) */
  function autoCommands(eng) {
    const AI = R.BattleAI;
    return AI && AI.partyCommands ? AI.partyCommands(eng, AI.AUTO_OPTS || AUTO_OPTS) : [];
  }
  /** a 2-line item desc on the 1-line help strip: joined when it still reads (≥ 7 px a character), else its first line */
  function helpLine(desc) {
    const lines = String(desc || '').split('\n');
    const joined = lines.join('');
    return G().textWidth(joined) * (7 / (32 / 3)) <= HELP.w - 20 ? joined : lines[0];
  }
  function copyCmds(cmds) {
    const out = [];
    cmds.forEach((c, i) => { out[i] = c ? Object.assign({}, c) : c; });
    return out;
  }

  // item names in battle: ★ (rare, yellow) / ★ (super, pink) / ◆ (unique, cyan) — menu's kit when it has the new API
  function kit() { return R.Menu && R.Menu.kit && R.Menu.kit.itemColor ? R.Menu.kit : null; }
  function itemLabel(id) {
    const K = kit();
    if (K && K.itemLabel) return K.itemLabel(id);
    const it = DB.items[id];
    if (!it) return '？？？';
    return (it.unique ? '◆' : it.grade === 'rare' || it.grade === 'super' || it.rare ? '★' : '') + it.name;
  }
  function itemColor(id) {
    const K = kit();
    if (K && K.itemColor) return K.itemColor(id);
    const it = DB.items[id], C = G().C;
    if (!it) return C.white;
    return it.unique ? C.cyan : it.grade === 'super' ? C.super : it.grade === 'rare' || it.rare ? C.rare : C.white;
  }
  /** icon key of an item (§8.2.8 defaults; R.Menu.kit.iconKey when available); always a registered key */
  function iconKey(id) {
    const it = DB.items[id];
    const K = R.Menu && R.Menu.kit;
    let k = null;
    if (K && K.iconKey) { try { k = K.iconKey(it); } catch (e) { k = null; } }
    if (!k && it) {
      if (it.icon) k = String(it.icon).startsWith('icon:') ? it.icon : 'icon:' + it.icon;
      else if (it.type === 'weapon') k = 'icon:' + it.wtype;
      else if (['shield', 'head', 'body', 'hands', 'feet'].includes(it.type)) k = 'icon:' + it.type;
      else if (it.type === 'acc') k = 'icon:acc';
      else if (it.type === 'key') k = 'icon:key';
      else if (it.stone) k = 'icon:el_' + it.stone;
      else if (it.type === 'consumable') {
        const e = (it.use && it.use.effects) || [];
        k = e.some((x) => x.type === 'heal' || x.type === 'revive' || x.type === 'grow') ? 'icon:herb' : 'icon:potion';
      }
    }
    return k && G().has(k) ? k : 'icon:acc';
  }

  // ------------------------------------------------------------ the scene
  class BattleScene extends R.Layer {
    constructor(eng, o) {
      super();
      this.eng = eng;
      this.o = o || {};
      this.opaque = false; // the field stays visible during the intro flashes
      this.ready = false;
      this.fxList = [];
      this.pops = [];
      this.msg = { lines: [], start: 0, ch: 0, need: 0, hold: 0, wait: 0, key: false, resolve: null };
      this.input = null;
      this.panel = null;
      this.auto = !!this.o.autoStart;
      this.autoCancel = false;
      this.repeating = false; // リピート: on until B (this battle only, never in c.mem — §11.5.3a)
      this.repeatCancel = false;
      this.lastCmds = null;
      this.acting = null;
      this.picking = null; // {units:[...]} | {ally} | {allies:true}
      this.winFx = eng.party.map(() => ({ shake: 0, flash: 0, glow: 0, raise: 0 }));
      this.partyIdx = 0;
      this.glim = null; // glimmer banner {u, t0, H, name, title, color, w}
      this.glimUntil = 0; // the next fx waits until this frame
      this.card = null; // drop card {grade, item, t0, transient}
      this.dim = 0; // super-rare: backdrop + monsters darkened
      this.locked = false; // super-rare jingle: key waits refuse input until it ends
      this.levelJingle = false;
      this.log = { glimmers: [], drops: [], levelUps: [], stolen: [] };
      this.goldenShown = new Set();
      this.layout();
    }
    get spd() { return [1, 1.6, 2.6][R.Settings.battleSpeed] || 1.6; }

    // ------------------------------------------------------------ layout
    spriteKey(m) { const d = m.d || {}; return 'mon:' + (m.spriteOverride || m.sprite || d.sprite || d.baseId || m.id); }
    monImg(m) {
      const d = m.d || {};
      const key = this.spriteKey(m);
      const opts = {};
      if (d.hue) opts.hue = d.hue;
      if (d.sat != null) opts.sat = d.sat;
      if (d.bri != null) opts.bri = d.bri;
      if (isGolden(m)) opts.tint = GOLD_TINT;
      let img = Object.keys(opts).length ? G().variant(key, opts) : G().get(key);
      if (Array.isArray(img)) img = img[0];
      return img;
    }
    /** feet of a sprite of height h: tall ones sink (§11.4.2) */
    static feet(h, back) { return GROUND - (back ? 12 : 0) + U.clamp(Math.round((h - 64) / 2.4), 0, 20); }
    /** positions for units in display order: one centred row, or two rows when > 256 px and ≥ 4 (§11.4.2) */
    arrange(list) {
      const imgs = new Map(list.map((m) => [m, this.visImg(m)]));
      const total = list.reduce((s, m) => s + imgs.get(m).width, 0);
      const two = total > 256 && list.length >= 4;
      // odd-numbered (1st, 3rd, …) go to the back row (drawn first), even-numbered to the front
      const rows = two ? [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)] : [list];
      const out = new Map();
      rows.forEach((row, ri) => {
        const back = two && ri === 0;
        const tot = row.reduce((s, m) => s + imgs.get(m).width, 0);
        const gap = row.length > 1 ? Math.min(8, (244 - tot) / (row.length - 1)) : 0;
        let x = 128 - (tot + gap * (row.length - 1)) / 2;
        for (const m of row) {
          const img = imgs.get(m);
          out.set(m, { x: Math.round(x), y: BattleScene.feet(img.height, back) - img.height, back });
          x += img.width + gap;
        }
      });
      return out;
    }
    visImg(m) { const v = this.vis && this.vis.get(m); return v ? v.img : this.monImg(m); }
    newVis(m, i, img) {
      return {
        m, img, x: 0, y: 0, w: img.width, h: img.height, i, back: false,
        flash: 0, shake: 0, blink: 0, lunge: 0, dodge: 0, appear: 0, appearN: 20, solid: 0, gflash: 0,
        die: null, flee: null, gone: false, move: null, spk: [], fly: flagOf(m, 'flying'),
      };
    }
    layout() {
      this.vis = new Map();
      const list = this.eng.mons;
      list.forEach((m, i) => this.vis.set(m, this.newVis(m, i, this.monImg(m))));
      const pos = this.arrange(list);
      for (const [m, p] of pos) Object.assign(this.vis.get(m), p);
    }
    /** summoned monsters: re-arrange everyone still standing; newcomers slide in from the nearer edge (§11.4.2) */
    relayout(newcomers) {
      const fresh = new Set(newcomers);
      for (const m of newcomers) if (!this.vis.has(m)) this.vis.set(m, this.newVis(m, this.eng.mons.indexOf(m), this.monImg(m)));
      const list = this.eng.mons.filter((m) => fresh.has(m) || (m.alive && !this.vis.get(m).gone && !this.vis.get(m).die));
      const pos = this.arrange(list);
      for (const [m, p] of pos) {
        const v = this.vis.get(m);
        v.back = p.back;
        if (fresh.has(m)) {
          const fromLeft = p.x + v.w / 2 < 128;
          v.x = fromLeft ? -v.w - 4 : R.W + 4; v.y = p.y;
          v.appear = 12; v.appearN = 12;
          v.die = null; v.flee = null; v.gone = false;
        }
        v.move = { x0: v.x, y0: v.y, x1: p.x, y1: p.y, t: 0, n: 12 };
      }
    }
    /** geometry used by effects and damage numbers */
    rectOf(u) {
      if (u.isParty) {
        const x = WIN.xs[u.idx] != null ? WIN.xs[u.idx] : WIN.xs[3], y = WIN.y;
        return { x, y, w: WIN.w, h: WIN.h, cx: x + 30, cy: y + 23, bottom: y + WIN.h, side: 'party' };
      }
      const v = this.vis.get(u);
      if (!v) return { x: 112, y: 70, w: 32, h: 32, cx: 128, cy: 88, bottom: 100, side: 'mon' };
      return { x: v.x, y: v.y, w: v.w, h: v.h, cx: v.x + v.w / 2, cy: v.y + v.h * 0.55, bottom: v.y + v.h - 2, side: 'mon' };
    }
    addFx(f) { this.fxList.push(f); }
    rowOf(p) {
      const c = p.c;
      if (R.Rules && R.Rules.effectiveRow && c) {
        try { return R.Rules.effectiveRow(c, this.eng.party.map((x) => x.c)); } catch (e) { /* fall through */ }
      }
      return (typeof p.row === 'string' ? p.row : c && c.row) === 'middle' ? 'middle' : 'front';
    }
    /** status icons of a party member, in DB.statuses order then up/down (§11.3.6) */
    iconsOf(p) {
      if (!this._iconOrder) {
        const keys = Object.keys(DB.statuses || {});
        this._iconOrder = (keys.length ? keys : BASE_STATUSES).filter((s) => s !== 'death' && G().has('bfx:icon_' + s));
      }
      const st = p.status || {};
      const out = this._iconOrder.filter((s) => st[s] || (s === 'regen' && p.permRegen && p.alive));
      if (p.alive && p.buffs) {
        const v = Object.values(p.buffs);
        if (v.some((x) => x > 0)) out.push('up');
        if (v.some((x) => x < 0)) out.push('down');
      }
      return out;
    }

    // ------------------------------------------------------------ helpers
    frames(n) { return R.Engine.wait(Math.max(1, Math.ceil(n / this.spd))); }
    ask(fn) { return new Promise((res) => { this.input = fn; this.inputRes = res; }); }
    pop(u, n, color) {
      const r = this.rectOf(u);
      const same = this.pops.filter((p) => p.u === u && p.t < 20).length;
      const x = r.cx;
      const y = u.isParty ? WIN.y + 57 - 4 + same * 9 : Math.max(WIN_BOTTOM, r.y + r.h * 0.4) - same * 9;
      this.pops.push({ u, x, y, str: n == null ? 'MISS' : String(n), color, t: 0, party: u.isParty });
    }

    // ------------------------------------------------------------ messages
    clearMsg() { const m = this.msg; m.lines = []; m.start = 0; m.ch = 0; m.need = 0; }
    async say(text) {
      const lines = G().wrap(text, BOX.w - 20);
      // paged mode (rewards): never scroll unread lines away — wait for a key and start a new page
      if (this.paged && this.msg.lines.length && this.msg.lines.length + lines.length > BOX.lines) {
        await this.waitKey();
        this.clearMsg();
      }
      return new Promise((resolve) => {
        const m = this.msg;
        m.lines = m.lines.concat(lines);
        while (m.lines.length > BOX.lines) m.lines.shift();
        m.start = m.lines.length - lines.length;
        m.ch = 0;
        m.need = lines.join('').length;
        m.hold = 0;
        m.wait = 30;
        m.key = false;
        m.resolve = resolve;
      });
    }
    waitKey() {
      return new Promise((resolve) => {
        const m = this.msg;
        m.ch = m.need; m.key = true; m.resolve = resolve;
      });
    }
    tickMsg() {
      const m = this.msg;
      if (!m.resolve) return;
      if (m.ch < m.need) {
        const rate = ([0.5, 1, 2, 999][R.Settings.msgSpeed] || 2) * this.spd * (In().down('a') ? 3 : 1);
        m.ch = Math.min(m.need, m.ch + rate);
        return;
      }
      if (m.key) return;
      m.hold += this.spd * (In().down('a') ? 2.5 : this.auto ? 1.4 : 1);
      if (m.hold >= m.wait) { const r = m.resolve; m.resolve = null; r(); }
    }

    // ------------------------------------------------------------ main flow
    onPush() { this.main(); }
    async main() {
      let result = 'escape';
      const eng = this.eng;
      try {
        await this.intro();
        await this.play(eng.begin());
        await this.goldenEntrance(); // for an engine that yields no {t:'golden'}
        while (!eng.result) {
          const ambush = eng.round === 0 && eng.surprise === 'ambush';
          const cmds = ambush ? null : await this.commandPhase();
          // リピート repeats what was really entered last round (menus, リピート or オート); 逃げる never repeats
          if (cmds && !cmds.flee && cmds.some(Boolean)) this.lastCmds = copyCmds(cmds);
          this.panel = null;
          this.acting = null;
          await this.play(eng.playRound(cmds));
          this.acting = null;
          this.clearTransientCard();
        }
        result = eng.result;
        if (this.autoCancel || result === 'lose') B.autoCarry = false; // B pressed during the last round / wiped
        this.auto = false;
        this.repeating = false;
        this.repeatCancel = false;
        this.acting = null;
        await this.waitGlimmerClosed();
        if (result === 'win') await this.victory();
        else if (result === 'lose') await this.defeat();
        else await this.frames(16);
      } catch (e) {
        R.Engine.reportError(e);
        result = eng.result || (eng.party.some((p) => p.alive) ? 'escape' : 'lose');
      }
      this.card = null; this.dim = 0; this.locked = false;
      try { eng.finish(); } catch (e) { R.Engine.reportError(e); }
      await R.Engine.fadeOut(16);
      // ↓ used to page the rewards: wait for its release so it does not walk the party on the field
      for (let i = 0; i < 600 && this.downLatch && In().down('down'); i++) await R.Engine.wait(1);
      this.downLatch = false;
      In().consume();
      this.close(result);
      R.Engine.fadeIn(12);
    }
    async intro() {
      // two flashes over the field, then black stripes zip in from alternate sides
      for (let i = 0; i < 2; i++) { R.Engine.flashScreen('#ffffff', 7); await R.Engine.wait(8); }
      this.wipe = { t: 0, n: 22 };
      await R.Engine.wait(this.wipe.n + 2);
      this.wipe = null;
      R.Engine.fadeAlpha = 1;
      this.opaque = true;
      this.ready = true;
      await R.Engine.fadeIn(14);
      if (this.eng.boss) { R.sfx('roar'); R.Engine.shake(24, 2); await R.Engine.wait(20); }
      if (this.o.rare || this.eng.mons.some(isRareMon)) {
        // めずらしい魔物: two golden flashes + the fanfare, then the usual appearance lines (§11.5.9)
        for (let i = 0; i < 2; i++) { R.Engine.flashScreen('#ffe890', 14); await R.Engine.wait(12); }
        const j = R.jingle('rare');
        await this.say('めったに出会えない魔物が現れた！');
        await j;
        await this.frames(10);
      }
    }
    async goldenEntrance() {
      for (const m of this.eng.mons) if (isGolden(m) && !this.goldenShown.has(m)) await this.onGolden({ u: m });
    }
    async play(gen) { for (const ev of gen) await this.handle(ev); }

    async victory() {
      await this.frames(12);
      this.clearMsg();
      this.paged = true;
      await this.play(this.eng.rewards());
      this.paged = false;
    }
    async defeat() {
      if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(20);
      this.clearMsg();
      await this.say(this.o.canLose ? '{hero}たちは力つきた……。' : '{hero}たちは全滅した……。');
      await this.waitKey();
    }

    // ------------------------------------------------------------ events
    async handle(ev) {
      const s = this;
      switch (ev.t) {
        case 'msg': return s.say(ev.text);
        case 'clear': s.clearMsg(); return;
        case 'actor':
          s.clearMsg();
          s.lastFx = null;
          s.clearTransientCard();
          s.acting = ev.u && ev.u.isParty ? ev.u : null;
          if (ev.u && !ev.u.isParty && s.vis.get(ev.u)) { s.vis.get(ev.u).blink = 10; await s.frames(8); }
          return;
        case 'fx': return s.playFx(ev);
        case 'dmg': return s.onDamage(ev);
        case 'heal':
          if (ev.n > 0) s.pop(ev.u, ev.n, ev.wp ? 'orange' : ev.mp ? 'cyan' : 'green');
          return;
        case 'miss': {
          R.sfx(ev.parry ? 'parry' : 'miss'); // 反撃の構え's parry rings like steel
          if (!ev.u.isParty && s.vis.get(ev.u)) s.vis.get(ev.u).dodge = 12;
          s.pop(ev.u, null, 'gray');
          return s.frames(6);
        }
        case 'crit':
          R.sfx('crit');
          R.Engine.flashScreen('#ffffff', 6);
          return s.frames(8);
        case 'die': return s.onDie(ev);
        case 'revive': {
          if (!ev.u.isParty) { const v = s.vis.get(ev.u); if (v) { v.die = null; v.flee = null; v.gone = false; v.appear = 20; v.appearN = 20; } }
          if (s.lastFx !== 'revive') { s.lastFx = 'revive'; R.BattleFX.play(s, 'revive', { targets: [s.rectOf(ev.u)] }); }
          else R.sfx('revive');
          return s.frames(12);
        }
        case 'status': return s.onStatus(ev);
        case 'buff':
          if (ev.stat && ev.d) R.sfx(ev.d > 0 ? 'buff' : 'debuff');
          return;
        case 'flee': {
          R.sfx('escape');
          const v = s.vis.get(ev.u);
          if (v) v.flee = { t: 0 };
          return s.frames(18);
        }
        case 'escape':
          if (ev.ok) { R.sfx('escape'); await s.frames(24); }
          return;
        case 'cover':
          // かばう: the one who steps in rises (§11.5.10a)
          R.sfx('jump');
          if (ev.u && ev.u.isParty) s.acting = ev.u;
          return s.frames(10);
        case 'counter':
        case 'react':
          // autoCounter / 反撃の構え: parry sound, the window rises 3px for 6 frames, then the counter's own fx.
          // autoRevive ({kind:'revive'}) only rises: the revive pillar and 「…は立ち上がった！」 follow
          if (ev.t === 'counter' || ev.kind !== 'revive') R.sfx('parry');
          if (ev.u && ev.u.isParty && s.winFx[ev.u.idx]) s.winFx[ev.u.idx].raise = 6;
          else if (ev.u && s.vis.get(ev.u)) s.vis.get(ev.u).blink = 6;
          return s.frames(6);
        case 'gain': return s.onGain(ev);
        case 'rare': // old engine form of a rare drop
          R.Engine.flashScreen('#fff4b0', 16);
          R.jingle('rare');
          return s.frames(12);
        case 'drop': return s.onDrop(ev);
        case 'golden': return s.onGolden(ev);
        case 'glimmer': return s.onGlimmer(ev);
        case 'phase': return s.onPhase(ev);
        case 'summon': return s.onSummon(ev);
        case 'levelup': {
          const c = ev.c || (ev.u && ev.u.c);
          const inParty = c && s.eng.party.some((p) => p.c === c);
          s.log.levelUps.push({ char: c ? c.id : null, level: ev.level });
          if (inParty && !ev.reserve && !s.levelJingle) { s.levelJingle = true; R.jingle('levelup'); }
          return;
        }
        case 'prof': return; // proficiency rank-ups are not shown in battle (§11.5.6)
        case 'victory':
          if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(6);
          R.jingle('victory');
          return;
        case 'jingle':
          if (ev.id === 'levelup') { if (s.levelJingle) return; s.levelJingle = true; }
          R.jingle(ev.id);
          return;
        case 'pause':
          await s.waitKey();
          s.card = null; s.dim = 0;
          return;
      }
    }
    clearTransientCard() { if (this.card && this.card.transient) this.card = null; }
    async waitGlimmer() {
      const F = R.Engine.frame;
      if (this.glimUntil > F) await R.Engine.wait(this.glimUntil - F);
    }
    async waitGlimmerClosed() {
      if (!this.glim) return;
      const end = this.glim.t0 + this.glim.H + 6, F = R.Engine.frame;
      if (end > F) await R.Engine.wait(end - F);
    }
    async playFx(ev) {
      await this.waitGlimmer();
      const user = ev.user ? this.rectOf(ev.user) : null;
      const targets = (ev.targets || []).filter(Boolean).map((t) => this.rectOf(t));
      const monUser = ev.user && !ev.user.isParty;
      const ab = ev.ab || null;
      if (monUser && ev.kind === 'attack' && this.vis.get(ev.user)) { this.vis.get(ev.user).lunge = 12; await this.frames(7); }
      if (ev.user && ev.user.isParty && ab && (ab.kind === 'spell' || ab.magic) && ev.kind !== 'counter' && !ev.again) {
        R.BattleFX.FX.cast(this, { user });
        R.sfx('magic');
        await this.frames(10);
      }
      if (monUser && ev.kind !== 'attack' && this.vis.get(ev.user)) { this.vis.get(ev.user).blink = 10; await this.frames(6); }
      let ids = ev.fx;
      if (!ids && ev.kind === 'attack') ids = this.weaponFx(ev.user, ev.slot);
      const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x != null);
      if (!list.length) list.push(null);
      // fx arrays (§7.3.4-7): left to right, the 2nd+ at 60 % length; numbers come at the last one's impact
      for (let i = 0; i < list.length; i++) {
        const rate = i === 0 ? 1 : 1 / 0.6;
        this.lastFx = R.BattleFX.resolve(list[i], ab).kind;
        const hold = R.BattleFX.play(this, list[i], { user, targets, ab, kind: ev.kind, rate });
        await this.frames(hold);
      }
    }
    /** the fx of a plain attack when the event carries none: the weapon type's fx (§6.8.1) */
    weaponFx(u, slot) {
      if (!u || !u.isParty) return (u && u.d && u.d.attackFx) || 'claw';
      const c = u.c || {}, eq = c.equip || {};
      const it = DB.items[eq[slot || 'weapon1']] || DB.items[eq.weapon1] || DB.items[eq.weapon2];
      const wt = it ? it.wtype : 'fist';
      return (it && it.fx) || (DB.weaponTypes && DB.weaponTypes[wt] && DB.weaponTypes[wt].fx) || 'strike';
    }
    async onDamage(ev) {
      const u = ev.u;
      if (ev.kind === 'cost') { this.pop(u, ev.n, 'gray'); return this.frames(6); }
      const color = ev.wp ? 'orange' : ev.mp ? 'cyan' : ev.kind === 'poison' ? 'purple' : ev.kind === 'burn' ? 'orange' : ev.crit ? 'yellow' : 'white';
      const dot = ev.kind === 'poison' || ev.kind === 'burn';
      if (u.isParty) {
        if (ev.n > 0) {
          const f = this.winFx[u.idx];
          if (f) { f.shake = 18; f.flash = 14; }
          if (!ev.mp && !ev.wp) R.Engine.shake(dot ? 6 : 12, ev.crit ? 4 : 2);
          R.sfx(ev.kind === 'poison' ? 'poison' : ev.kind === 'burn' ? 'burn' : 'hurt');
        }
      } else {
        const v = this.vis.get(u);
        if (ev.n > 0 && v) { v.flash = 12; v.shake = 12; R.sfx(ev.kind === 'poison' ? 'poison' : ev.kind === 'burn' ? 'burn' : 'hit'); }
      }
      this.pop(u, ev.n, color);
      return this.frames(8);
    }
    async onDie(ev) {
      const u = ev.u;
      if (u.isParty) {
        R.sfx('death');
        if (this.winFx[u.idx]) this.winFx[u.idx].flash = 16;
        return this.frames(12);
      }
      const v = this.vis.get(u);
      if (!v) return;
      v.flash = 0; v.shake = 0; v.solid = 0; v.gflash = 0;
      if (u.boss) {
        R.sfx('boss_die');
        v.die = { t: 0, boss: true };
        await this.frames(116);
        R.Engine.flashScreen('#ffffff', 16);
      } else {
        R.sfx('enemy_die');
        v.die = { t: 0 };
        await this.frames(14);
      }
    }
    async onStatus(ev) {
      const s = ev.s;
      if (!ev.on || s === 'death') return;
      const FX = R.BattleFX.FX;
      // statuses from weapons / damage skills get their own puff (a spell for that status already showed one)
      const key = s === 'counter' || s === 'cover' ? 'stance' : s;
      if (this.lastFx !== key && FX[key] && !(ev.u && ev.u.isParty && key === 'stance')) {
        R.BattleFX.play(this, key, { user: this.rectOf(ev.u), targets: [this.rectOf(ev.u)] });
        return this.frames(10);
      }
      R.sfx({ poison: 'poison', sleep: 'sleep', burn: 'burn', freeze: 'freeze' }[s] || 'status');
    }
    async onGain(ev) {
      // stolen item (§3.3.8 gain {item, grade, stolen}): steal sound; a rare one gets the rare card too
      const grade = ev.grade || (ev.rare ? 'rare' : 'normal');
      if (ev.stolen || ev.grade) this.log.stolen.push({ item: ev.item, grade });
      if (ev.stolen || ev.grade) {
        R.sfx('steal');
        if (grade === 'rare') {
          R.Engine.flashScreen('#fff4b0', 16);
          R.jingle('rare');
          this.card = { grade: 'rare', item: ev.item, t0: R.Engine.frame, transient: !this.paged };
        }
        return;
      }
      R.sfx(ev.rare ? 'item' : 'steal'); // old engine form
    }
    async onDrop(ev) {
      const grade = ev.grade || (ev.rare ? 'rare' : 'normal');
      const mon = ev.mon && typeof ev.mon === 'object' ? ev.mon.id : ev.mon;
      this.log.drops.push({ item: ev.item, grade, mon });
      this.card = null; this.dim = 0;
      if (grade === 'normal') { R.sfx('item'); return; }
      if (grade === 'rare') {
        R.Engine.flashScreen('#fff4b0', 16);
        R.jingle('rare'); // not awaited (§11.10.6)
        this.card = { grade: 'rare', item: ev.item, t0: R.Engine.frame };
        return this.frames(6);
      }
      // super rare: the scene darkens, the fanfare plays to the end before any key is taken (§11.5.8)
      this.dim = 0.45;
      this.card = { grade: 'super', item: ev.item, t0: R.Engine.frame };
      R.Engine.flashScreen('#ffe0f4', 10);
      const tok = (this.lockTok = (this.lockTok || 0) + 1);
      this.locked = true;
      const unlock = () => { if (this.lockTok === tok) this.locked = false; };
      Promise.resolve(R.jingle('superrare')).then(unlock, unlock);
      R.Engine.wait(360).then(unlock); // safety net: never lock the rewards for good
      return this.frames(8);
    }
    async onGolden(ev) {
      const m = ev.u;
      if (!m || this.goldenShown.has(m)) return;
      this.goldenShown.add(m);
      const v = this.vis.get(m);
      if (v) v.gflash = 24; // #fff4b0 every 4 frames for 24 frames (§11.5.9)
      R.sfx('golden');
      await R.Engine.wait(14);
    }
    async onGlimmer(ev) {
      // one banner at a time: a second glimmer in the same round waits until the first has closed
      await this.waitGlimmerClosed();
      const u = ev.u;
      const ab = actionOf(ev.id) || {};
      R.sfx('glimmer');
      if (R.Audio && R.Audio.duck) { try { R.Audio.duck(-6, 18); } catch (e) { /* optional */ } }
      if (u && u.isParty && this.winFx[u.idx]) this.winFx[u.idx].glow = GLOW_FRAMES;
      R.Engine.flashScreen('#fff8d0', 4);
      const H = Math.max(GLIM_MIN, Math.round(50 / this.spd));
      this.glim = Object.assign({ u, t0: R.Engine.frame, H, id: ev.id, kind: ev.kind }, bannerOf(ab, ev.kind));
      this.glimUntil = this.glim.t0 + H;
      this.log.glimmers.push({ char: u && u.c ? u.c.id : null, id: ev.id, kind: ev.kind || ab.kind });
      // frame 12: the banner is open — hand back so the 「〇〇は〇〇を閃いた！」 line types under it
      await R.Engine.wait(12);
    }
    async onPhase(ev) {
      const v = this.vis.get(ev.u);
      R.sfx('shake');
      R.Engine.shake(20, 2);
      if (v) v.solid = 12;
      await this.frames(6);
      if (v && ev.sprite && G().has('mon:' + ev.sprite)) {
        // swap the sprite at frame 6, keeping the feet and the centre
        const feet = v.y + v.h, cx = v.x + v.w / 2;
        ev.u.spriteOverride = ev.sprite;
        v.img = this.monImg(ev.u);
        v.w = v.img.width; v.h = v.img.height;
        v.x = Math.round(cx - v.w / 2); v.y = feet - v.h;
        v.mask = null;
      }
      await this.frames(6);
      if (ev.text) await this.say(ev.text);
    }
    async onSummon(ev) {
      const units = (ev.units || []).map((i) => (typeof i === 'number' ? this.eng.mons[i] : i)).filter(Boolean);
      if (!units.length) return;
      this.relayout(units);
      await this.frames(14);
    }

    // ------------------------------------------------------------ commands
    /** the commands of one round (menus, オート or リピート); the panel is closed when it returns */
    async commandPhase() {
      const cmds = await this.commandInput();
      this.panel = null;
      return cmds;
    }
    async commandInput() {
      const eng = this.eng;
      if (this.auto && this.autoCancel) { this.auto = false; this.autoCancel = false; B.autoCarry = false; }
      if (this.auto) return autoCommands(eng);
      // リピート stays on until B; B stops it before the next input and the party menu opens on 戦う
      if (this.repeating && this.repeatCancel) { this.repeating = false; this.repeatCancel = false; this.partyIdx = 0; }
      if (this.repeating && this.lastCmds) return this.repeatCmds();
      if (!eng.party.some((p) => p.commandable())) { await this.frames(24); return []; }
      this.clearMsg();
      for (;;) {
        const r = await this.partyMenu();
        if (r === 'auto') {
          this.auto = true; this.autoCancel = false; B.autoCarry = true;
          return autoCommands(eng);
        }
        if (r === 'repeat') { this.repeating = true; this.repeatCancel = false; return this.repeatCmds(); }
        if (r === 'flee') return { flee: true };
        const cmds = await this.memberCommands();
        if (cmds) return cmds;
      }
    }
    repeatCmds() {
      const eng = this.eng;
      if (eng.repeatCommands) return eng.repeatCommands(this.lastCmds);
      const out = [];
      for (const p of eng.party) if (p.commandable()) out[p.idx] = this.lastCmds[p.idx] ? Object.assign({}, this.lastCmds[p.idx]) : { type: 'attack', slot: 'weapon1', target: null };
      return out;
    }
    get canRepeat() { return !!(this.lastCmds && this.lastCmds.some(Boolean)); }
    async partyMenu() {
      // 戦う リピート / オート 逃げる
      const ids = ['fight', 'repeat', 'auto', 'flee'];
      const canRepeat = this.canRepeat;
      const list = new R.UI.List({
        x: BOX.x, y: BOX.y, w: CMD_W, h: BOX.h, cols: 2, rows: 2, lineH: 16, padY: 10, cancel: false,
        items: ['戦う', { label: 'リピート', disabled: !canRepeat }, 'オート', { label: '逃げる', disabled: !!this.eng.noEscape }],
        index: this.partyIdx,
      });
      if (list.isDisabled(list.index)) list.index = 0;
      this.panel = {
        left: list, enemies: true,
        help: () => {
          const id = ids[list.index];
          if (id === 'repeat') return canRepeat ? HELP_REPEAT : HELP_REPEAT_NONE;
          if (id === 'flee' && this.eng.noEscape) return HELP_NOESCAPE;
          return '';
        },
      };
      const r = await this.ask(() => (list.update() === 'select' ? list.index : undefined));
      this.partyIdx = r === 1 || r === 2 ? r : 0;
      return ids[r];
    }
    async memberCommands() {
      const order = this.eng.party.filter((p) => p.commandable());
      const cmds = [];
      const reserved = {};
      let k = 0;
      while (k < order.length) {
        const u = order[k];
        const c = await this.memberMenu(u, reserved);
        if (c === BACK) {
          if (k === 0) { this.acting = null; return null; }
          k--;
          const prev = cmds[order[k].idx];
          if (prev && prev.type === 'item') reserved[prev.id]--;
          cmds[order[k].idx] = undefined;
          continue;
        }
        if (c.type === 'item') reserved[c.id] = (reserved[c.id] || 0) + 1;
        cmds[u.idx] = c;
        k++;
      }
      this.acting = null;
      return cmds;
    }
    battleItems(reserved) {
      const inv = this.eng.inv || {};
      const gr = (it) => GRADE_RANK[it.grade] || (it.rare ? 1 : 0);
      return Object.keys(inv)
        .filter((id) => { const it = DB.items[id]; return it && it.type === 'consumable' && it.use && it.use.battle && inv[id] > 0; })
        .sort((a, b) => { const x = DB.items[a], y = DB.items[b]; return gr(x) - gr(y) || ((x.sort || 0) - (y.sort || 0)) || ((x.price || 0) - (y.price || 0)) || (a < b ? -1 : a > b ? 1 : 0); })
        .map((id) => ({ id, it: DB.items[id], n: inv[id] - ((reserved && reserved[id]) || 0), noEsc: !!(this.eng.noEscape && B.isEscape && B.isEscape(DB.items[id].use)) }));
    }
    commandsOf(c) {
      if (R.Rules && R.Rules.commands) { try { return R.Rules.commands(c) || []; } catch (e) { R.warn('battle: Rules.commands failed', e); } }
      return [{ type: 'weapon', slot: 'weapon1', wtype: 'fist', name: '体術' }, { type: 'defend', name: '防御' }, { type: 'item', name: '道具' }];
    }
    async memberMenu(u, reserved) {
      const c = u.c, m = mem(c);
      const cmds = this.commandsOf(c);
      const items = cmds.map((k) => ({
        label: k.name || (k.type === 'spell' ? '術' : k.type === 'defend' ? '防御' : k.type === 'item' ? '道具' : k.wtype),
        disabled: k.type === 'item' && !this.battleItems(reserved).some((x) => x.n > 0),
      }));
      const list = new R.UI.List({ x: BOX.x, y: BOX.y, w: CMD_W, h: BOX.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title: c.name, index: Math.min(m.cmd || 0, items.length - 1) });
      if (list.isDisabled(list.index)) list.index = 0;
      this.acting = u;
      for (;;) {
        this.panel = { left: list, enemies: true };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.cmd = i;
        const k = cmds[i];
        list.active = false;
        let r = BACK;
        if (k.type === 'weapon') r = await this.weaponMenu(u, k);
        else if (k.type === 'spell') r = await this.spellMenu(u);
        else if (k.type === 'defend') return { type: 'defend' };
        else if (k.type === 'item') r = await this.itemMenu(u, reserved);
        else if (k.type === 'attack') { const t = await this.pickTarget(u, 'enemy'); if (t !== BACK) r = { type: 'attack', slot: k.slot || null, target: t }; }
        if (r !== BACK) return r;
      }
    }
    /** why the plain 攻撃 of a weapon slot can't be chosen (null = usable): only 'reach' (§4.5.3) */
    attackIssue(u, k) {
      const eng = this.eng;
      if (eng.attackIssue) { try { return eng.attackIssue(u, k.slot); } catch (e) { /* fall through */ } }
      const wt = DB.weaponTypes && DB.weaponTypes[k.wtype];
      if (wt && wt.reach === false && this.rowOf(u) === 'middle') return 'reach';
      return null;
    }
    weaponName(c, slot) {
      const it = slot && c.equip && DB.items[c.equip[slot]];
      return it ? it.name : null;
    }
    listOpts(title, items, index) {
      return { x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title, index: U.clamp(index || 0, 0, Math.max(0, items.length - 1)), drawItem: drawListItem };
    }
    /** 攻撃 + the techs of that slot's weapon type; right column W and the cost (§11.5.3) */
    async weaponMenu(u, k) {
      const c = u.c, m = mem(c), eng = this.eng;
      const key = k.slot || 'weapon1';
      const techs = R.Rules && R.Rules.techList ? R.Rules.techList(c, k.wtype, k.slot) : [];
      const atkWhy = this.attackIssue(u, k);
      const rows = [{ id: 'attack', why: atkWhy }].concat(techs.map((id) => ({ id, ab: actionOf(id), why: eng.unusable ? eng.unusable(u, id, k.slot) || null : null })));
      const items = rows.map((r) => {
        if (r.id === 'attack') return { label: '攻撃', disabled: !!r.why };
        const cost = R.Rules && R.Rules.wpCost ? R.Rules.wpCost(c, r.id) : (r.ab && r.ab.wp) || 0;
        return { label: r.ab ? r.ab.name : r.id, right: 'W' + cost, disabled: !!r.why };
      });
      const wname = (DB.weaponTypes && DB.weaponTypes[k.wtype] && DB.weaponTypes[k.wtype].name) || k.name;
      const list = new R.UI.List(this.listOpts(wname, items, m.list[key]));
      const help = () => {
        const r = rows[list.index];
        if (!r) return '';
        if (r.why) return WHY[r.why] || '';
        if (r.id === 'attack') { const n = this.weaponName(c, k.slot); return n ? `${n}で攻撃する。` : '素手で攻撃する。'; }
        return (r.ab && r.ab.desc) || '';
      };
      for (;;) {
        this.panel = { left: list, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.list[key] = i;
        list.active = false;
        const r = rows[i];
        if (r.id === 'attack') {
          const t = await this.pickTarget(u, 'enemy');
          if (t !== BACK) return { type: 'attack', slot: k.slot || null, target: t };
        } else {
          const t = await this.pickTarget(u, (r.ab && r.ab.target) || 'enemy');
          if (t !== BACK) return { type: 'tech', id: r.id, slot: k.slot || null, target: t };
        }
      }
    }
    async spellMenu(u) {
      const c = u.c, m = mem(c), eng = this.eng;
      const ids = R.Rules && R.Rules.spellList ? R.Rules.spellList(c) : (c.spells || []);
      const rows = ids.map((id) => ({ id, ab: actionOf(id), why: eng.unusable ? eng.unusable(u, id) || null : null }));
      const items = rows.map((r) => {
        const cost = R.Rules && R.Rules.mpCost ? R.Rules.mpCost(c, r.id) : (r.ab && r.ab.mp) || 0;
        return { label: r.ab ? r.ab.name : r.id, right: 'M' + cost, disabled: !!r.why };
      });
      if (!items.length) { R.sfx('buzzer'); return BACK; }
      const list = new R.UI.List(this.listOpts('術', items, m.list.spell));
      const help = () => { const r = rows[list.index]; return r ? (r.why ? WHY[r.why] || '' : (r.ab && r.ab.desc) || '') : ''; };
      for (;;) {
        this.panel = { left: list, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.list.spell = i;
        list.active = false;
        const r = rows[i];
        const t = await this.pickTarget(u, (r.ab && r.ab.target) || 'enemy');
        if (t !== BACK) return { type: 'spell', id: r.id, target: t };
      }
    }
    async itemMenu(u, reserved) {
      const m = mem(u.c);
      const list0 = this.battleItems(reserved);
      if (!list0.length) { R.sfx('buzzer'); return BACK; }
      const items = list0.map((x) => {
        const dis = x.n <= 0 || x.noEsc;
        return { label: itemLabel(x.id), right: String(Math.max(0, x.n)), disabled: dis, color: dis ? G().C.gray : itemColor(x.id) };
      });
      const list = new R.UI.List(this.listOpts('道具', items, m.item));
      const help = () => {
        const x = list0[list.index];
        if (!x) return '';
        if (x.noEsc) return WHY.noescape;
        return helpLine(x.it.desc);
      };
      for (;;) {
        this.panel = { left: list, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.item = i;
        const it = list0[i].it;
        list.active = false;
        const t = await this.pickTarget(u, (it.use && it.use.target) || 'self');
        if (t !== BACK) return { type: 'item', id: list0[i].id, target: t };
      }
    }

    // ------------------------------------------------------------ targeting
    async pickTarget(u, type) {
      if (type === 'enemy' || type === 'group') return this.pickEnemy(u, type === 'group');
      if (type === 'ally' || type === 'ally_any' || type === 'ally_dead' || type === 'ally_other') return this.pickAlly(u, type);
      if (type === 'enemies' || type === 'random' || type === 'allies') return this.confirmAll(type);
      return null; // self / party: no choice (§7.3.2)
    }
    /** all-target actions: highlight every target and confirm with A (B = back) */
    async confirmAll(type) {
      const foes = type !== 'allies';
      const prevPanel = this.panel;
      const label = foes ? (type === 'random' ? '敵全体にランダム' : '敵全体') : '味方全員';
      this.panel = Object.assign({}, prevPanel, { help: () => label, helpCenter: true });
      this.picking = foes ? { units: this.eng.mons.filter((m) => m.alive) } : { allies: true };
      const r = await this.ask(() => {
        if (In().pressed('a')) { R.sfx('confirm'); return null; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      return r;
    }
    groupsOf() {
      const eng = this.eng;
      if (eng.groups) return eng.groups().map((g) => g.units.filter((x) => x.alive)).filter((l) => l.length);
      const by = new Map();
      for (const m of eng.mons) if (m.alive) { if (!by.has(m.id)) by.set(m.id, []); by.get(m.id).push(m); }
      return [...by.values()];
    }
    async pickEnemy(u, group) {
      const m = mem(u.c);
      const vx = (x) => (this.vis.get(x) ? this.vis.get(x).x : 0);
      const alive = this.eng.mons.filter((x) => x.alive).sort((a, b) => vx(a) - vx(b));
      if (!alive.length) return BACK;
      const choices = group ? this.groupsOf().sort((a, b) => vx(a[0]) - vx(b[0])) : alive.map((x) => [x]);
      let i = Math.max(0, choices.findIndex((l) => l.some((x) => x.key === m.target)));
      const prevPanel = this.panel;
      const name = () => { const l = choices[i]; return group && l.length > 1 ? `${l[0].base || l[0].name}　${l.length}匹` : l[0].name; };
      const color = () => { const l = choices[i]; return isGolden(l[0]) ? G().C.gold : isMetal(l[0]) ? METAL_COL : null; };
      this.panel = Object.assign({}, prevPanel, { help: name, helpColor: color, helpCenter: true });
      this.picking = { units: choices[i] };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d && choices.length > 1) {
          i = (i + (d === 'left' || d === 'up' ? -1 : 1) + choices.length) % choices.length;
          this.picking.units = choices[i];
          R.sfx('cursor');
        }
        if (In().pressed('a')) { R.sfx('confirm'); return choices[i][0]; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      if (r !== BACK) m.target = r.key;
      return r;
    }
    async pickAlly(u, type) {
      const party = this.eng.party;
      const n = party.length;
      const ok = (p) => (type === 'ally' ? p.alive : type === 'ally_other' ? p.alive && p !== u : type === 'ally_dead' ? !p.alive && !p.gone : true);
      const cands = party.filter(ok);
      if (!cands.length) { R.sfx('buzzer'); return BACK; }
      const most = type === 'ally' || type === 'ally_other';
      let t = type === 'ally_dead' ? cands[0] : most ? cands.slice().sort((a, b) => a.hpRate() - b.hpRate())[0] : u;
      if (most && t.hpRate() >= 1) t = ok(u) ? u : cands[0];
      let i = party.indexOf(t);
      const prevPanel = this.panel;
      const line = () => {
        const p = party[i];
        return `${p.name}　HP ${p.hp}/${p.mhp}　MP ${p.mp}/${p.mmp}　WP ${wpOf(p)}/${mwpOf(p)}`;
      };
      this.panel = Object.assign({}, prevPanel, { help: line, helpCenter: true });
      this.picking = { ally: party[i] };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d) {
          const step = d === 'left' || d === 'up' ? -1 : 1;
          let j = i;
          // the cursor goes round all members (% party.length — the Crest code had % 3)
          for (let k = 0; k < n; k++) { j = (j + step + n) % n; if (ok(party[j])) break; }
          if (j !== i && ok(party[j])) { i = j; this.picking.ally = party[i]; R.sfx('cursor'); }
        }
        if (In().pressed('a')) { R.sfx('confirm'); return party[i]; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      return r;
    }

    // ------------------------------------------------------------ layer hooks
    update() {
      if (this.auto && !this.autoCancel && In().pressed('b')) { this.autoCancel = true; R.sfx('cancel'); }
      if (this.repeating && !this.repeatCancel && In().pressed('b')) { this.repeatCancel = true; R.sfx('cancel'); }
      const m = this.msg;
      // a page waiting for a key (rewards, level-ups, drops, pause): A, B or ↓ — not while the super-rare fanfare plays
      const down = In().pressed('down');
      if (m.resolve && m.key && m.ch >= m.need && !this.locked && (In().pressed('a') || In().pressed('b') || down)) {
        R.sfx('confirm_soft');
        if (down) this.downLatch = true; // the held ↓ must not move a menu cursor / the party afterwards
        In().consume();
        const r = m.resolve; m.resolve = null; m.key = false;
        r();
        return;
      }
      if (this.downLatch) {
        if (In().down('down')) return;
        this.downLatch = false;
      }
      if (this.input) {
        const v = this.input();
        if (v !== undefined) { const f = this.inputRes; this.input = null; f(v); }
      }
    }
    tick() {
      if (this.wipe) this.wipe.t++;
      const s = this.spd;
      const F = R.Engine.frame;
      for (const v of this.vis.values()) {
        for (const k of ['flash', 'shake', 'blink', 'lunge', 'dodge', 'appear', 'solid']) if (v[k] > 0) v[k] = Math.max(0, v[k] - s);
        if (v.gflash > 0) v.gflash--;
        if (v.move) {
          v.move.t += s;
          const q = Math.min(1, v.move.t / v.move.n), e = 1 - (1 - q) * (1 - q);
          v.x = Math.round(v.move.x0 + (v.move.x1 - v.move.x0) * e);
          v.y = Math.round(v.move.y0 + (v.move.y1 - v.move.y0) * e);
          if (q >= 1) v.move = null;
        }
        if (v.flee) v.flee.t += s;
        // golden: a sparkle somewhere on the body every 30 frames (0.5 s, §9.8 / §11.4.2)
        if (isGolden(v.m) && v.m.alive && !v.die && !v.flee && (F + v.i * 7) % 30 === 0) {
          const p = this.opaquePoint(v);
          v.spk.push({ x: p[0], y: p[1], t0: F });
        }
        if (v.spk.length) v.spk = v.spk.filter((q) => F - q.t0 < 16);
        if (v.die) {
          v.die.t += s;
          if (v.die.boss && v.die.t < 70 && (v.die.nb = (v.die.nb || 0) + s) >= 9) {
            v.die.nb = 0;
            const r = { cx: v.x + U.rf(0.2, 0.8) * v.w, cy: v.y + U.rf(0.2, 0.8) * v.h, w: 20, h: 20, side: 'mon' };
            r.x = r.cx - 10; r.y = r.cy - 10; r.bottom = r.cy + 10;
            R.BattleFX.FX.fire(this, { targets: [r] }, 1);
            R.sfx('fire');
            R.Engine.shake(8, 2);
          }
        }
      }
      for (const f of this.winFx) {
        if (f.shake > 0) f.shake = Math.max(0, f.shake - s);
        if (f.flash > 0) f.flash = Math.max(0, f.flash - s);
        if (f.raise > 0) f.raise = Math.max(0, f.raise - s);
        if (f.glow > 0) f.glow--; // glimmer glow runs in real frames (not shortened by battle speed)
      }
      if (this.glim && F > this.glim.t0 + this.glim.H + 6) this.glim = null;
      if (this.fxList.length) this.fxList = this.fxList.filter((f) => (f.t += s * (f.rate || 1)) < f.life);
      if (this.pops.length) this.pops = this.pops.filter((p) => (p.t += s) < 52);
      this.tickMsg();
    }
    /** a random opaque pixel of a monster sprite (relative to the screen) */
    opaquePoint(v) {
      if (!v.mask) {
        v.mask = [];
        try {
          const img = v.img, c = img.getContext ? img.getContext('2d', { willReadFrequently: true }) : null;
          if (c) {
            const d = c.getImageData(0, 0, img.width, img.height).data;
            for (let y = 2; y < img.height - 2; y += 2) for (let x = 2; x < img.width - 2; x += 2) if (d[(y * img.width + x) * 4 + 3] > 0) v.mask.push([x, y]);
          }
        } catch (e) { /* no pixel access: use the box */ }
      }
      const p = v.mask.length ? U.pick(v.mask) : [U.rf(0.2, 0.8) * v.w, U.rf(0.2, 0.8) * v.h];
      return [v.x + p[0], v.y + p[1]];
    }

    // ------------------------------------------------------------ drawing
    draw() {
      if (!this.ready) { if (this.wipe) this.drawWipe(); return; }
      G().clear('#000');
      this.drawBackdrop();
      this.drawMonsters();
      this.drawFx('mid');
      this.drawEnemyCursor();
      this.drawPops(false);
      if (this.dim > 0) G().rect(0, 0, R.W, BOX.y, 'rgba(0,0,0,' + this.dim + ')');
      this.drawWindows();
      this.drawBulb();
      this.drawFx('top');
      this.drawPops(true);
      this.drawBanner();
      this.drawCard();
      if (this.panel) this.drawPanel(); else this.drawMsg();
      this.drawAuto();
    }
    drawWipe() {
      const k = this.wipe.t / this.wipe.n;
      for (let i = 0; i < 16; i++) {
        const w = Math.round(U.clamp(k * 1.6 - (i / 16) * 0.6, 0, 1) * R.W);
        if (w > 0) G().rect(i % 2 ? R.W - w : 0, i * 14, w, 14, '#000');
      }
    }
    drawBackdrop() {
      const id = this.o.bg || 'grass';
      let bg = G().has('bbg:' + id) ? G().get('bbg:' + id) : R.BattleFX.fallbackBg(id);
      if (Array.isArray(bg)) bg = bg[Math.floor(R.Engine.frame / 16) % bg.length];
      G().draw(bg, 0, 0);
    }
    drawMonsters() {
      const F = R.Engine.frame;
      const list = [...this.vis.values()].sort((a, b) => (a.back === b.back ? a.i - b.i : a.back ? -1 : 1));
      for (const v of list) {
        const m = v.m;
        if (v.gone || (!m.alive && !v.die && !v.flee)) continue;
        let x = v.x, y = v.y, alpha = 1;
        if (v.fly && !v.die) y += Math.round(Math.sin(F / 18 + v.i) * 2);
        if (v.shake > 0) x += Math.floor(v.shake) % 4 < 2 ? 2 : -2;
        if (v.lunge > 0) y += Math.round(Math.sin(((12 - v.lunge) / 12) * Math.PI) * 5);
        if (v.dodge > 0) x += Math.round(Math.sin(((12 - v.dodge) / 12) * Math.PI) * 10);
        if (v.appear > 0) alpha = 1 - v.appear / (v.appearN || 20);
        if (v.flee) {
          x += v.flee.t * 5 * (v.x + v.w / 2 < 128 ? -1 : 1);
          alpha = 1 - v.flee.t / 18;
          if (alpha <= 0) { v.gone = true; continue; }
        }
        if (v.die) { if (this.drawDying(v, x, y)) v.gone = true; continue; }
        const targeted = this.picking && this.picking.units && this.picking.units.includes(m);
        if (v.solid > 0) G().drawTinted(v.img, x, y, '#ffffff', 0.9);
        else if (v.flash > 0 && Math.floor(v.flash / 2) % 2 === 0) G().drawTinted(v.img, x, y, '#ffffff', 0.9);
        else if (v.gflash > 0 && Math.floor(v.gflash / 4) % 2 === 0) G().drawTinted(v.img, x, y, '#fff4b0', 0.85);
        else if (v.blink > 0 && Math.floor(v.blink / 3) % 2 === 0) G().drawTinted(v.img, x, y, '#ffffff', 0.55);
        else if (targeted) G().drawTinted(v.img, x, y, '#ffffff', 0.18 + 0.18 * Math.sin(F * 0.2));
        else G().draw(v.img, x, y, alpha < 1 ? { alpha } : undefined);
        if (isRareMon(m)) this.drawSparkles(v, x, y, F);
        if (v.spk.length) this.drawGoldSparkles(v, F);
      }
    }
    /** twinkling stars around a rare monster (white and pale gold, period 90 frames) */
    drawSparkles(v, x, y, F) {
      const g = G();
      for (let k = 0; k < 5; k++) {
        const t = (F + k * 37) % 90;
        if (t > 30) continue;
        const px = x + ((k * 53 + Math.floor((F + k * 37) / 90) * 29) % Math.max(8, v.w));
        const py = y + ((k * 31 + Math.floor((F + k * 37) / 90) * 17) % Math.max(8, v.img.height - 4));
        const r = t < 15 ? Math.ceil(t / 5) : Math.ceil((30 - t) / 5);
        const c = k % 2 ? '#fff6c0' : '#ffffff';
        g.rect(px, py - r, 1, r * 2 + 1, c);
        g.rect(px - r, py, r * 2 + 1, 1, c);
      }
    }
    drawGoldSparkles(v, F) {
      const sp = G().has('obj:sparkle') ? G().get('obj:sparkle') : null;
      for (const q of v.spk) {
        const f = Math.min(3, Math.floor((F - q.t0) / 4));
        if (sp && sp[f]) G().draw(sp[f], q.x - 8, q.y - 8);
        else R.BattleFX.twinkle(G(), q.x, q.y, [1, 2, 3, 1][f], '#ffe45a');
      }
    }
    /** returns true when the dissolve is finished */
    drawDying(v, x, y) {
      const t = v.die.t;
      const frames = R.BattleFX.dissolve(v.img);
      if (v.die.boss) {
        if (t < 70) {
          const sx = x + (Math.floor(t) % 4 < 2 ? 2 : -2);
          const k = Math.floor(t / 4) % 3;
          if (k === 0) G().drawTinted(v.img, sx, y, '#ffffff', 0.8);
          else if (k === 1) G().drawTinted(v.img, sx, y, '#ff4030', 0.6);
          else G().draw(v.img, sx, y);
          return false;
        }
        const f = Math.floor((t - 70) / 4);
        if (f >= frames.length) return true;
        G().draw(frames[f], x, y);
        return false;
      }
      if (t < 6) { G().drawTinted(v.img, x, y, '#ffffff', 0.9); return false; }
      const f = Math.floor((t - 6) / 2);
      if (f >= frames.length) return true;
      G().draw(frames[f], x, y);
      return false;
    }
    drawFx(layer) {
      for (const f of this.fxList) if (f.layer === layer) f.draw(G(), f.t);
    }
    drawEnemyCursor() {
      if (!this.picking || !this.picking.units || Math.floor(R.Engine.frame / 10) % 3 === 2) return;
      for (const m of this.picking.units) {
        const v = this.vis.get(m);
        if (!v) continue;
        // a tall monster whose top is under the window band gets a → on its left instead of a ↓ above
        if (v.y - 9 < WIN_BOTTOM) { rightArrow(Math.max(2, v.x - 8), Math.round(Math.max(WIN_BOTTOM + 8, v.y + Math.min(v.h / 2, 40)))); continue; }
        downArrow(Math.round(v.x + v.w / 2), v.y - 9);
      }
    }
    drawPops(party) {
      for (const p of this.pops) {
        if (p.party !== party) continue;
        const gl = R.BattleFX.glyphs(p.color);
        const w = p.str.length * 6 + 1;
        const alpha = p.t > 40 ? (52 - p.t) / 12 : 1;
        for (let i = 0; i < p.str.length; i++) {
          const a = p.t - i * 1.5;
          if (a < 0) continue;
          const dy = a < 10 ? -Math.sin((a / 10) * Math.PI) * 7 : 0;
          const img = gl[p.str[i]];
          if (img) G().draw(img, Math.round(p.x - w / 2 + i * 6), Math.round(p.y + dy), { alpha });
        }
      }
    }
    isPicked(p) { return !!(this.picking && (this.picking.ally === p || (this.picking.allies && !p.gone))); }
    theme() { const T = G().WINDOW_THEMES; return T[R.Settings.windowColor] || T.ink || T.black; }
    drawWindows() {
      const g = G(), C = g.C, F = R.Engine.frame;
      const theme = this.theme();
      this.eng.party.forEach((p, i) => {
        const f = this.winFx[i];
        if (!f || WIN.xs[i] == null) return;
        let x = WIN.xs[i], y = WIN.y;
        if (f.shake > 0) x += Math.round(Math.sin(f.shake * 1.3) * 2);
        const picked = this.isPicked(p);
        if (this.acting === p || picked || f.raise > 0) y -= 3;
        const red = f.flash > 0 && Math.floor(f.flash / 3) % 2 === 0;
        const th = red ? g.WINDOW_THEMES.red : theme;
        g.window(x, y, WIN.w, WIN.h, { theme: red ? 'red' : undefined });
        // glimmer glow: 40 frames of warm light fading out; a gold inner edge blinks for the first 16
        if (f.glow > 0) {
          const t = GLOW_FRAMES - f.glow;
          const c = g.ctx, a0 = c.globalAlpha;
          c.globalAlpha = a0 * 0.35 * (f.glow / GLOW_FRAMES);
          g.rect(x + 3, y + 3, WIN.w - 6, WIN.h - 6, GLOW_FILL);
          c.globalAlpha = a0;
          if (t < 16 && Math.floor(t / 4) % 2 === 0) g.strokeRect(x + 2, y + 2, 57, 42, GLOW_EDGE);
        }
        const col = p.hp <= 0 ? C.dead : p.hp < p.mhp * 0.25 ? C.yellow : C.white;
        // name on the top border
        const nw = Math.min(52, Math.ceil(g.textWidth(p.name)));
        const tw = nw + 8, tx = x + Math.floor((WIN.w - tw) / 2);
        g.rect(tx, y, tw, 5, th.fill);
        // name at y − 3 (§11.5.2); a raised window (y 2) would push the kana's top row off the screen, so the
        // name never goes above the screen's first row (it rises 2 px instead of 3 there)
        g.fitText(p.name, tx + 4, Math.max(0, y - 3), 52, { color: col });
        g.text('H', x + 6, y + 6, { color: col });
        g.text(String(p.hp), x + 54, y + 6, { color: col, align: 'right' });
        g.text('M', x + 6, y + 17, { color: col });
        g.text(String(p.mp), x + 54, y + 17, { color: col, align: 'right' });
        g.text('W', x + 6, y + 28, { color: col });
        g.text(String(wpOf(p)), x + 54, y + 28, { color: col, align: 'right' });
        // bottom border: row tag (left) — the row that really applies (effectiveRow)
        const mid = this.rowOf(p) === 'middle';
        const fill2 = th.fill2 || th.fill;
        g.rect(x + 4, y + 39, 15, 8, fill2);
        g.text(mid ? '中' : '前', x + 6, y + 38, { color: mid ? C.cyan : C.orange });
        // bottom border: status icons (right), up to 3; more rotate every 60 frames
        const icons = this.iconsOf(p);
        if (icons.length) {
          const pages = Math.ceil(icons.length / 3);
          const pg = pages > 1 ? Math.floor(F / 60) % pages : 0;
          const show = icons.slice(pg * 3, pg * 3 + 3);
          const iw = show.length * 9 + 3, ix = x + 56 - iw;
          g.rect(ix, y + 39, iw, 8, fill2);
          show.forEach((s, k) => g.draw(R.BattleFX.get('icon_' + s), ix + 2 + k * 9, y + 39));
        }
        if (picked && Math.floor(F / 10) % 3 !== 2) upArrow(WIN.xs[i] + 30, WIN.y + 51);
      });
    }
    /** the glimmer bulb under the member's window: rises 8px in 8 frames, frames 0/1 swap every 4 */
    drawBulb() {
      const gl = this.glim;
      if (!gl || !gl.u || !gl.u.isParty) return;
      const t = R.Engine.frame - gl.t0;
      if (t < 0 || t > gl.H) return;
      const x0 = WIN.xs[gl.u.idx];
      if (x0 == null) return;
      const img = G().has('obj:glimmer') ? G().get('obj:glimmer') : R.BattleFX.get('bulb');
      const fr = Array.isArray(img) ? img[Math.floor(t / 4) % img.length] : img;
      const dy = t < 8 ? Math.round(8 * (1 - t / 8)) : 0;
      G().draw(fr, x0 + 30 - 8, WIN_BOTTOM + 1 + dy, t < 8 ? { alpha: t / 8 } : undefined);
    }
    /** the tech-name banner: opens 6→12, stays until H, closes H→H+6 (§11.5.7) */
    drawBanner() {
      const gl = this.glim;
      if (!gl) return;
      const t = R.Engine.frame - gl.t0;
      let h;
      if (t < 6) return;
      if (t < 12) h = (BANNER.h * (t - 6)) / 6;
      else if (t <= gl.H) h = BANNER.h;
      else if (t <= gl.H + 6) h = BANNER.h * (1 - (t - gl.H) / 6);
      else return;
      h = Math.round(h);
      if (h < 2) return;
      const g = G(), w = gl.w, x = Math.round(128 - w / 2), cy = BANNER.y + BANNER.h / 2;
      const y = Math.round(cy - h / 2);
      if (h < 10) {
        const th = this.theme();
        g.rect(x + 2, y, w - 4, h, th.fill);
        g.rect(x + 4, Math.round(cy), w - 8, 1, th.border);
        return;
      }
      g.window(x, y, w, h);
      const c = g.ctx;
      c.save();
      c.beginPath(); c.rect(x, y + 3, w, h - 6); c.clip();
      g.text(gl.name, 128, BANNER.y + 8, { size: 16, align: 'center', color: gl.color, shadow: '#000' });
      c.restore();
      if (h >= BANNER.h - 4) titlePlate(x, BANNER.y, w, gl.title, gl.titleColor || g.C.white, this.theme());
    }
    /** the drop card (rare / super rare) with its sparkles (§11.5.8) */
    drawCard() {
      const cd = this.card;
      if (!cd) return;
      const g = G(), C = g.C, F = R.Engine.frame, t = F - cd.t0;
      const sup = cd.grade === 'super';
      const x = 44, y = sup ? 62 : CARD.y, w = 168, h = sup ? 46 : 30;
      // pops open over 5 frames
      const k = Math.min(1, (t + 1) / 5);
      if (k < 1) {
        const hh = Math.max(4, Math.round(h * k));
        g.window(x, Math.round(y + (h - hh) / 2), w, hh);
        return;
      }
      g.window(x, y, w, h);
      titlePlate(x, y, w, sup ? '超レア' : 'レア', sup ? C.super : C.white, this.theme());
      const it = DB.items[cd.item];
      const name = '★' + (it ? it.name : cd.item);
      g.draw(g.get(iconKey(cd.item)), x + (sup ? 14 : 12), y + (sup ? 10 : 11));
      g.fitText(name, x + (sup ? 26 : 24), y + (sup ? 8 : 9), w - (sup ? 26 : 24) - 10, { color: sup ? C.super : C.rare });
      if (sup) g.text('ほかでは手に入らない一品', x + 14, y + 24, { color: '#c8c8d8' });
      if (sup) {
        // seven pink and white crosses round the card, radius 1–3, blinking on a 20-frame cycle
        const P = [[x - 6, y + 8], [x + 30, y - 7], [x + 104, y - 8], [x + w + 5, y + 12], [x + w - 16, y + h + 6], [x + 58, y + h + 7], [x - 5, y + h - 6]];
        P.forEach(([px, py], i) => {
          const q = (t + i * 7) % 20;
          const r = q < 10 ? 1 + Math.floor(q / 4) : Math.max(0, 3 - Math.floor((q - 10) / 3));
          if (r > 0) R.BattleFX.twinkle(g, px, py, Math.min(3, r), i % 2 ? '#ffffff' : C.super, '#ffffff');
        });
      } else {
        // two white crosses left and right of the card
        [[x - 7, y + h / 2], [x + w + 6, y + h / 2]].forEach(([px, py], i) => {
          const q = (t + i * 10) % 20;
          const r = q < 10 ? 1 + Math.floor(q / 4) : Math.max(0, 3 - Math.floor((q - 10) / 3));
          if (r > 0) R.BattleFX.twinkle(g, px, py, Math.min(3, r), '#ffffff', '#ffffff');
        });
      }
    }
    drawMsg() {
      const m = this.msg;
      G().window(BOX.x, BOX.y, BOX.w, BOX.h);
      let left = Math.floor(m.ch);
      m.lines.forEach((line, i) => {
        let s = line;
        if (i >= m.start) { s = line.slice(0, Math.max(0, left)); left -= line.length; }
        G().text(s, BOX.x + 10, BOX.y + 7 + i * 14);
      });
      if (m.resolve && m.key && m.ch >= m.need && !this.locked) G().moreArrow(BOX.x + BOX.w / 2 - 3, BOX.y + BOX.h - 8);
    }
    drawPanel() {
      const p = this.panel;
      if (!p.left) this.drawMsg(); // a target choice with no list under it keeps the message window
      if (p.enemies && p.left) this.drawEnemyList(ENEMY_WIN.x, ENEMY_WIN.y, ENEMY_WIN.w, ENEMY_WIN.h);
      // help / target strip first: the command window's title tab may overlap its bottom border
      if (p.help) {
        const s = p.help();
        if (s) {
          G().window(HELP.x, HELP.y, HELP.w, HELP.h);
          const color = (p.helpColor && p.helpColor()) || undefined;
          if (p.helpCenter) {
            const w = Math.min(HELP.w - 20, G().textWidth(s));
            G().fitText(s, Math.round(HELP.x + (HELP.w - w) / 2), HELP.y + 4, HELP.w - 20, { color });
          } else G().fitText(s, HELP.x + 10, HELP.y + 4, HELP.w - 20, { color });
        }
      }
      if (p.left) p.left.draw({ showInactiveCursor: true });
    }
    /** enemy names: one line per species group (golden ones apart), ≤ 4 lines (§11.5.4) */
    enemyGroups() {
      const out = [], by = {};
      for (const m of this.eng.mons) {
        if (!m.alive) continue;
        const gold = isGolden(m);
        const k = (m.id || m.base) + (gold ? '*' : '');
        let g = by[k];
        if (!g) { g = by[k] = { name: m.base || m.name, n: 0, gold, metal: isMetal(m) }; out.push(g); }
        g.n++;
      }
      return out;
    }
    drawEnemyList(x, y, w, h) {
      const g = G(), C = g.C;
      g.window(x, y, w, h);
      this.enemyGroups().slice(0, 4).forEach((gr, i) => {
        const ty = y + 8 + i * 14;
        const nw = Math.ceil(g.textWidth(String(gr.n)));
        const color = gr.gold ? C.gold : gr.metal ? METAL_COL : C.white;
        g.fitText(gr.name, x + 9, ty, w - 22 - nw, { color });
        g.text(String(gr.n), x + 101, ty, { align: 'right', color });
      });
    }
    drawAuto() {
      if (!this.auto && !this.repeating) return;
      const cancel = this.auto ? this.autoCancel : this.repeatCancel;
      const name = this.auto ? 'オート' : 'リピート';
      const s = cancel ? name + '解除' : name + '　Bで解除';
      const w = Math.ceil(G().textWidth(s)) + 16;
      G().window(BOX.x + BOX.w - w, BOX.y - 20, w, 20);
      G().text(s, BOX.x + BOX.w - w + 8, BOX.y - 16, { color: cancel ? G().C.yellow : G().C.white });
    }
  }

  /**
   * one row of a 2-column battle list (techs / spells / items): the name squeezed into
   * colW − 16 − width(cost) (= 77 px for 'W12', §11.5.3), the cost right-aligned 13 px before the
   * next column so it never touches that column's cursor
   */
  function drawListItem(it, x, y, w) {
    const g = G(), colW = w + 4;
    const label = typeof it === 'object' ? it.label : it;
    const dis = typeof it === 'object' && it.disabled;
    const color = (typeof it === 'object' && it.color) || (dis ? g.C.gray : g.C.white);
    const right = typeof it === 'object' && it.right != null && it.right !== '' ? String(it.right) : null;
    if (right) {
      g.fitText(label, x, y, colW - 16 - g.textWidth(right), { color });
      g.text(right, x + colW - 13, y, { color, align: 'right' });
    } else g.fitText(label, x, y, colW - 8, { color });
  }
  /** title plate on a window's top border in a given colour (Gfx.window only draws white titles) */
  function titlePlate(x, y, w, title, color, theme) {
    const g = G();
    const tw = Math.ceil(g.textWidth(title)) + 8;
    const tx = x + Math.floor((w - tw) / 2);
    g.rect(tx, Math.max(0, y - 3), tw, 8 + Math.min(0, y - 3), theme.fill);
    g.text(title, tx + 4, y - 3, { color });
  }
  /** banner text for a glimmered action: title, name colour, width (§11.5.7) */
  function bannerOf(ab, kind) {
    const C = G().C;
    const name = ab.name || '？？？';
    let title = '閃き！', color = '#fff8d0', titleColor = null;
    const isSpell = (ab.kind || kind) === 'spell';
    if (isSpell) {
      const els = Array.isArray(ab.elements) ? ab.elements : [];
      if (els.length >= 2) title = '合成術';
      const first = elemOrder().find((e) => els.includes(e)) || els[0];
      color = (first && DB.elements && DB.elements[first] && DB.elements[first].color) || '#fff8d0';
    } else {
      const lv = (ab.glim && ab.glim.lv) || ab.rank || 0;
      if (lv >= 10) { title = '極意'; color = C.super; titleColor = C.super; } else if (lv === 9) { title = '奥義'; color = C.gold; titleColor = C.gold; }
    }
    const tw = Math.ceil(G().textWidth(name, 16));
    const w = Math.max(128, tw + 40);
    return { name, title, color, titleColor, w };
  }

  // target cursors: a white triangle with a full 1-px black outline (readable over clouds, snow and light sprites)
  /** ▼ whose tip is at (cx, y + 4) */
  function downArrow(cx, y) {
    const g = G();
    g.rect(cx - 5, y - 1, 11, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - 5 + i, y + i, 11 - i * 2, 1, '#000000');
    g.rect(cx, y + 5, 1, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - 4 + i, y + i, 9 - i * 2, 1, '#ffffff');
  }
  /** ▲ whose tip is at (cx, y) */
  function upArrow(cx, y) {
    const g = G();
    g.rect(cx, y - 1, 1, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - i - 1, y + i, i * 2 + 3, 1, '#000000');
    g.rect(cx - 5, y + 5, 11, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - i, y + i, i * 2 + 1, 1, '#ffffff');
  }
  /** ▶ whose tip is at (x + 4, cy) */
  function rightArrow(x, cy) {
    const g = G();
    g.rect(x - 1, cy - 5, 1, 11, '#000000');
    for (let i = 0; i < 5; i++) g.rect(x + i, cy - 5 + i, 1, 11 - i * 2, '#000000');
    g.rect(x + 5, cy, 1, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(x + i, cy - 4 + i, 1, 9 - i * 2, '#ffffff');
  }

  // --------------------------------------------------------------- entry
  const monDef = (id) => (DB.monsters && DB.monsters[id]) || null;
  const hasFlag = (id, f) => { const d = monDef(id); return !!(d && d.flags && d.flags.includes(f)); };
  function partyMod(key) {
    try {
      if (R.Rules && R.Rules.partyMods) { const m = R.Rules.partyMods(); if (m && m[key] != null) return m[key]; }
      if (R.Party && R.Party.mod) return R.Party.mod(key) || 0;
    } catch (e) { /* no party mods yet */ }
    return 0;
  }
  /** Tb of a battle (§4.14.1): o.tier, the troop's fixed tier, the zone's fixed tier, else the world tier */
  function battleTier(o, troop, zone) {
    if (o.tier != null) return o.tier;
    const cur = R.Tier && R.Tier.current ? R.Tier.current() : (R.Game && R.Game.tier) || 0;
    if (troop) return troop.tier != null ? troop.tier : cur;
    if (zone && typeof zone.tier === 'number') return zone.tier;
    return cur;
  }
  function buildIds(spec, tier) {
    if (R.Mon && R.Mon.buildList) return R.Mon.buildList(spec, tier);
    return B.buildMons ? B.buildMons({ mons: spec }) : [];
  }
  /** the zone's めずらしい魔物 swap (§3.3.8): p = 1/rate × (1 + min(150, rareEncPct)/100) × (lure ? 2 : 1) */
  function rollRare(zoneId) {
    const rr = DB.rareEncounters && DB.rareEncounters[zoneId];
    if (!rr || !monDef(rr.mon)) return null;
    const N = +rr.rate || 0;
    if (N <= 0) return null;
    const base = N >= 1 ? 1 / N : N; // rate is a denominator (80 = 1/80); an old probability < 1 still works
    const lure = R.Game && R.Game.encItem && R.Game.encItem.pct > 0 ? 2 : 1;
    const p = base * (1 + Math.min(150, partyMod('rareEncPct')) / 100) * lure;
    return U.r() < p ? rr.mon : null;
  }
  /**
   * Decide everything about a battle before it starts (pure except for the random rolls):
   * monsters (rare swap → build → golden roll), party / reserve (members), BGM, backdrop, auto start.
   */
  function prepare(o) {
    o = Object.assign({}, o || {});
    const troop = (o.troop && DB.troops && DB.troops[o.troop]) || null;
    const zone = (o.zone && DB.encounters && DB.encounters[o.zone]) || null;
    const tier = battleTier(o, troop, zone);
    const zoneFight = !!(o.zone && !o.troop && !o.mons);
    let rareMon = o.rareMon || null;
    if (zoneFight && !rareMon && !o.noRare) rareMon = rollRare(o.zone);
    let ids = [];
    if (rareMon) ids = [rareMon];
    else if (o.mons) ids = buildIds(o.mons, tier);
    else if (troop) ids = buildIds(troop.mons, tier);
    else if (zone) {
      const grp = R.Mon && R.Mon.zoneGroup ? R.Mon.zoneGroup(o.zone, tier) : zone.groups && zone.groups.length ? U.weighted(zone.groups) : null;
      ids = grp ? buildIds(grp.mons, tier) : [];
    }
    // 金色の魔物: random zone fights only; not after a rare swap; never a metal-only group (rollGolden skips metal / rare / boss)
    let golden = -1;
    if (zoneFight && !rareMon && !o.noGolden && ids.length && R.Mon && R.Mon.rollGolden) golden = R.Mon.rollGolden(ids);
    const boss = ids.some((id) => hasFlag(id, 'boss'));
    const metal = ids.some((id) => hasFlag(id, 'metal'));
    const rare = !!rareMon || ids.some((id) => hasFlag(id, 'rare'));
    const mons = golden >= 0 ? ids.map((id, i) => ({ id, golden: i === golden })) : ids.slice();
    const bgm = o.bgm || (troop && troop.bgm) || (rare || golden >= 0 || metal ? 'rarebattle' : boss ? 'boss' : 'battle');
    const bg = o.bg || (troop && troop.bg) || (zone && zone.bg) || 'grass';
    // members: only these fight; the others of the party are treated like the reserve (60 % EXP)
    const all = (R.Game && R.Game.party) || [];
    let party = all, reserve = ((R.Game && R.Game.reserve) || []).slice();
    if (Array.isArray(o.members) && o.members.length) {
      const inBattle = all.filter((c) => o.members.includes(c.id));
      if (inBattle.length) { party = inBattle; reserve = all.filter((c) => !inBattle.includes(c)).concat(reserve); }
    }
    const noEscape = !!(o.noEscape || (troop && troop.noEscape) || boss);
    // オート継続 (§3.3.8): plain random zone fights only, never with a boss / rare / golden / metal monster
    const autoStart = zoneFight && !o.canLose && !noEscape && !boss && !rare && golden < 0 && !metal &&
      R.Settings.autoKeep !== false && !!B.autoCarry;
    return { o, troop, zone, tier, zoneFight, rareMon, ids, mons, golden, boss, metal, rare, bgm, bg, party, reserve, noEscape, autoStart };
  }

  /**
   * Start a battle (§3.3.8). o: {zone | troop | mons, bg, bgm, canLose, noEscape, surprise, noRare, noGolden,
   * tier, lvOff, glimmerForce, members}. Resolves 'win' | 'lose' | 'escape'. On 'lose' the party is left as is
   * (the caller runs the game over / canLose recovery).
   */
  async function start(o) {
    o = o || {};
    if (!R.Game) throw new Error('R.Battle.start: no game in progress');
    // the engine side (battle.js R.Battle.setup: tier, level, rare swap, golden roll, members) decides the fight;
    // prepare() below is the same logic for an engine without setup()
    const S = setupBattle(o);
    if (!S || !S.eng || !S.eng.mons.length) { R.warn('battle: no monsters for', o.zone || o.troop || o.mons); return 'win'; }
    const eng = S.eng;
    const A = R.Audio;
    const prev = A && A.current;
    if (A && A.pushBGM) A.pushBGM(S.bgm); else R.bgm(S.bgm);
    R.Game.battles = (R.Game.battles || 0) + 1;
    const lastBefore = B.last;
    const scene = new BattleScene(eng, { bg: S.bg, bgm: S.bgm, canLose: !!o.canLose, autoStart: !!S.autoStart, rare: !!S.rare });
    B.current = scene;
    let res;
    try {
      res = await R.Engine.run(scene);
    } finally {
      B.current = null;
      if (A && A.popBGM) A.popBGM(); else if (prev) R.bgm(prev);
    }
    if (res === 'win' && eng.killed && eng.killed.length) R.Game.wins = (R.Game.wins || 0) + 1;
    if (res === 'escape') R.Game.escapes = (R.Game.escapes || 0) + 1;
    // a live engine writes R.Battle.last in finish(); fill in what it left out from the scene's own log
    const mine = lastOf(eng, scene, res, o);
    B.last = B.last && B.last !== lastBefore ? Object.assign(mine, B.last, { result: res }) : mine;
    R.emit('battleEnd', res, o);
    return res;
  }
  /** {eng, bg, bgm, autoStart, rare} for R.Battle.start */
  function setupBattle(o) {
    if (B.setup) return B.setup(o);
    const P = prepare(o);
    if (!P.mons.length) return null;
    const eo = {
      party: P.party, reserve: P.reserve, mons: P.mons, inv: R.Game.inv, live: true,
      noEscape: P.noEscape, noSurprise: !P.zoneFight, canLose: !!o.canLose,
      zone: o.zone || null, troop: o.troop || null, tier: P.tier, glimmerForce: o.glimmerForce || null, rare: P.rare,
    };
    if (o.surprise !== undefined) eo.surprise = o.surprise;
    let bg = P.bg;
    if (!o.bg && !(P.troop && P.troop.bg) && !(P.zone && P.zone.bg) && R.Field && R.Field.battleBg) { try { bg = R.Field.battleBg(o.zone) || bg; } catch (e) { /* keep grass */ } }
    return { eng: new B.Engine(eo), bg, bgm: P.bgm, autoStart: P.autoStart, rare: P.rare };
  }
  /** R.Battle.last (§3.3.8): what the battle gave, for events and tests */
  function lastOf(eng, scene, result, o) {
    const rw = eng.rewardInfo || {};
    const base = eng.last && typeof eng.last === 'object' ? eng.last : {};
    return Object.assign({
      result, rounds: eng.round, zone: o.zone || null, troop: o.troop || null,
      killed: (eng.killed || []).map((m) => ({ id: (m.d && m.d.baseId) || m.id, golden: isGolden(m) })),
      exp: rw.exp || 0, gold: rw.gold || 0,
      drops: scene.log.drops.slice(),
      glimmers: scene.log.glimmers.slice(),
      levelUps: scene.log.levelUps.slice(),
      stolen: scene.log.stolen.slice(),
    }, base);
  }

  Object.assign(B, {
    start, prepare, setupBattle, Scene: BattleScene, current: null, last: B.last || null,
    WIN, WIN_BOTTOM, HELP, BOX, GROUND, BANNER, CARD, ENEMY_WIN,
    ui: { itemLabel, itemColor, iconKey, bannerOf, helpLine, WHY },
  });
})(window.RPG);
