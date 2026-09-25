// DQ5-style battle scene: backdrop + monsters, three party status windows on
// top, command menus / messages at the bottom. It drives a R.Battle.Engine and
// only animates the events the engine produces (battle.js), so real battles
// and R.Battle.simulate share every rule.
//
//   const result = await R.Battle.start({zone|troop|mons, bg, bgm, canLose, noEscape});
//   → 'win' | 'lose' | 'escape'
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const B = (R.Battle = R.Battle || {});

  const WIN = { xs: [6, 88, 170], y: 6, w: 80, h: 44 }; // party status windows
  const BOX = { x: 8, y: 150, w: 240, h: 68, lines: 4 }; // bottom window
  const GROUND = 130; // monsters' feet (backdrop ground ≈ 124–132)
  const HELP_Y = 133;
  const AUTO_OPTS = { thrift: true, items: 'auto' }; // オート: conserve MP, items only as a last resort // help / target-name strip, directly above the bottom window
  const BACK = { back: true };
  const MEM = {}; // cursor memory per character id (kept for the session)
  const ICON_ORDER = ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'regen'];

  function mem(id) {
    if (!R.Settings.cursorMemory) return { cmd: 0, ab: {}, item: 0, target: null };
    return (MEM[id] = MEM[id] || { cmd: 0, ab: {}, item: 0, target: null });
  }
  /** battle messages use the shared phrase-aware wrap (R.Gfx.wrap) */
  function wrapPhrases(text, width) { return G().wrap(text, width); }
  function fitText(s, x, y, maxW, opts) {
    const w = G().textWidth(s);
    if (w <= maxW) { G().text(s, x, y, opts); return; }
    const c = G().ctx;
    c.save(); c.translate(x, y); c.scale(maxW / w, 1);
    G().text(s, 0, 0, opts);
    c.restore();
  }

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
      this.acting = null;
      this.picking = null; // {units:[...], ally:bool}
      this.winFx = eng.party.map(() => ({ shake: 0, flash: 0 }));
      this.partyIdx = 0;
      this.layout();
    }
    get spd() { return [1, 1.6, 2.6][R.Settings.battleSpeed] || 1.6; }

    // ------------------------------------------------------------ layout
    monImg(m) {
      const d = m.d;
      let img = G().variant('mon:' + d.sprite, { hue: d.hue, sat: d.sat, bri: d.bri });
      if (Array.isArray(img)) img = img[0];
      return img;
    }
    layout() {
      this.vis = new Map();
      const list = this.eng.mons;
      const imgs = list.map((m) => this.monImg(m));
      const total = imgs.reduce((s, i) => s + i.width, 0);
      const gap = list.length > 1 ? Math.min(8, (244 - total) / (list.length - 1)) : 0;
      let x = 128 - (total + gap * (list.length - 1)) / 2;
      list.forEach((m, i) => {
        const img = imgs[i];
        const feet = GROUND + (img.height > 64 ? Math.min(14, Math.round((img.height - 64) / 3)) : 0);
        // very tall sprites (final bosses): keep the head/horns below the party windows; their feet
        // may go behind the bottom window instead
        const y = img.height > 96 ? Math.max(feet - img.height, WIN.y + WIN.h - 2) : feet - img.height;
        this.vis.set(m, {
          m, img, x: Math.round(x), y, w: img.width, h: img.height, i,
          flash: 0, shake: 0, blink: 0, lunge: 0, dodge: 0, appear: 0, die: null, flee: null, gone: false,
          fly: m.flag('flying'),
        });
        x += img.width + gap;
      });
    }
    /** geometry used by effects and damage numbers */
    rectOf(u) {
      if (u.isParty) {
        const x = WIN.xs[u.idx], y = WIN.y;
        return { x, y, w: WIN.w, h: WIN.h, cx: x + WIN.w / 2, cy: y + WIN.h / 2 + 2, bottom: y + WIN.h, side: 'party' };
      }
      const v = this.vis.get(u);
      return { x: v.x, y: v.y, w: v.w, h: v.h, cx: v.x + v.w / 2, cy: v.y + v.h * 0.55, bottom: v.y + v.h - 2, side: 'mon' };
    }
    addFx(f) { this.fxList.push(f); }

    // ------------------------------------------------------------ helpers
    frames(n) { return R.Engine.wait(Math.max(1, Math.ceil(n / this.spd))); }
    ask(fn) { return new Promise((res) => { this.input = fn; this.inputRes = res; }); }
    pop(u, n, color) {
      const r = this.rectOf(u);
      const same = this.pops.filter((p) => p.u === u && p.t < 20).length;
      const x = r.cx, y = u.isParty ? r.y + r.h + 2 + same * 9 : Math.max(52, r.y + r.h * 0.4) - same * 9;
      this.pops.push({ u, x, y, str: n == null ? 'MISS' : String(n), color, t: 0, party: u.isParty });
    }

    // ------------------------------------------------------------ messages
    clearMsg() { const m = this.msg; m.lines = []; m.start = 0; m.ch = 0; m.need = 0; }
    async say(text) {
      const lines = wrapPhrases(text, BOX.w - 20);
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
      try {
        await this.intro();
        await this.play(this.eng.begin());
        while (!this.eng.result) {
          const cmds = this.eng.round === 0 && this.eng.surprise === 'ambush' ? null : await this.commandPhase();
          if (cmds && !cmds.flee && cmds.some(Boolean)) this.lastCmds = cmds.slice(); // for リピート
          this.panel = null;
          this.acting = null;
          await this.play(this.eng.playRound(cmds));
          this.acting = null;
        }
        result = this.eng.result;
        if (this.autoCancel || result === 'lose') R.Battle.autoCarry = false; // B pressed during the last round / wiped
        this.auto = false;
        this.repeating = false;
        this.acting = null;
        if (result === 'win') await this.victory();
        else if (result === 'lose') await this.defeat();
        else await this.frames(16);
      } catch (e) {
        R.Engine.reportError(e);
        result = this.eng.result || (this.eng.party.some((p) => p.alive) ? 'escape' : 'lose');
      }
      this.eng.finish();
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
      if (this.o.rare) {
        // rare monster: golden flashes + fanfare before the usual appearance message
        for (let i = 0; i < 2; i++) { R.Engine.flashScreen('#ffe890', 14); await R.Engine.wait(12); }
        this.rareGlow = true;
        const j = R.jingle('rare');
        await this.say('めったに出会えない魔物が現れた！');
        await j;
        await this.frames(10);
      }
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
      await this.say(`${this.eng.party[0].name}たちは全滅した……`);
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
          s.acting = ev.u && ev.u.isParty ? ev.u : null;
          if (ev.u && !ev.u.isParty) { s.vis.get(ev.u).blink = 10; await s.frames(8); }
          return;
        case 'fx': return s.playFx(ev);
        case 'dmg': return s.onDamage(ev);
        case 'heal':
          if (ev.n > 0) s.pop(ev.u, ev.n, ev.mp ? 'cyan' : 'green');
          return;
        case 'miss': {
          R.sfx('miss');
          if (!ev.u.isParty) s.vis.get(ev.u).dodge = 12;
          s.pop(ev.u, null, 'gray');
          return s.frames(6);
        }
        case 'crit':
          R.sfx('crit');
          R.Engine.flashScreen('#ffffff', 6);
          return s.frames(8);
        case 'die': return s.onDie(ev);
        case 'revive':
          if (!ev.u.isParty) { const v = s.vis.get(ev.u); v.die = null; v.flee = null; v.gone = false; v.appear = 20; }
          if (s.lastFx !== 'revive') { s.lastFx = 'revive'; R.BattleFX.play(s, 'revive', { targets: [s.rectOf(ev.u)] }); }
          else R.sfx('revive');
          return s.frames(12);
        case 'status':
          // statuses from weapons / damage skills get their own puff (spells already showed one)
          if (ev.on && ev.s !== 'death' && s.lastFx !== ev.s && R.BattleFX.FX[ev.s]) {
            R.BattleFX.play(s, ev.s, { targets: [s.rectOf(ev.u)] });
            return s.frames(10);
          }
          if (ev.on && ev.s !== 'death') R.sfx(ev.s === 'poison' ? 'poison' : ev.s === 'sleep' ? 'sleep' : 'status');
          return;
        case 'buff':
          if (ev.stat && ev.d) R.sfx(ev.d > 0 ? 'buff' : 'debuff');
          return;
        case 'flee': {
          R.sfx('escape');
          s.vis.get(ev.u).flee = { t: 0 };
          return s.frames(18);
        }
        case 'escape':
          if (ev.ok) { R.sfx('escape'); await s.frames(24); }
          return;
        case 'cover':
          R.sfx('jump');
          s.acting = ev.u;
          return s.frames(10);
        case 'react':
          s.acting = ev.u;
          return s.frames(6);
        case 'gain':
          R.sfx(ev.rare ? 'item' : 'steal');
          return;
        case 'rare':
          R.Engine.flashScreen('#fff4b0', 26);
          R.jingle('rare');
          return s.frames(12);
        case 'victory':
          if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(6);
          R.jingle('victory');
          return;
        case 'jingle': R.jingle(ev.id); return;
        case 'pause': return s.waitKey();
      }
    }
    async playFx(ev) {
      const user = ev.user ? this.rectOf(ev.user) : null;
      const targets = (ev.targets || []).map((t) => this.rectOf(t));
      const monUser = ev.user && !ev.user.isParty;
      if (monUser && ev.kind === 'attack') { this.vis.get(ev.user).lunge = 12; await this.frames(7); }
      if (ev.user && ev.user.isParty && ev.ab && ev.ab.magic) {
        R.BattleFX.FX.cast(this, { user });
        R.sfx('magic');
        await this.frames(10);
      }
      if (monUser && ev.kind === 'ability') { this.vis.get(ev.user).blink = 10; await this.frames(6); }
      const id = ev.fx || (ev.kind === 'attack' ? 'slash' : null);
      this.lastFx = R.BattleFX.resolve(id, ev.ab).kind;
      const hold = R.BattleFX.play(this, id, { user, targets, ab: ev.ab, kind: ev.kind });
      await this.frames(hold);
    }
    async onDamage(ev) {
      const u = ev.u;
      if (ev.kind === 'cost') { this.pop(u, ev.n, 'gray'); return this.frames(6); }
      const color = ev.mp ? 'cyan' : ev.kind === 'poison' ? 'purple' : ev.crit ? 'yellow' : 'white';
      if (u.isParty) {
        if (ev.n > 0) {
          const f = this.winFx[u.idx];
          f.shake = 18; f.flash = 14;
          if (!ev.mp) R.Engine.shake(ev.kind === 'poison' ? 6 : 12, ev.crit ? 4 : 2);
          R.sfx(ev.kind === 'poison' ? 'poison' : 'hurt');
        }
      } else {
        const v = this.vis.get(u);
        if (ev.n > 0) { v.flash = 12; v.shake = 12; R.sfx(ev.kind === 'poison' ? 'poison' : 'hit'); }
      }
      this.pop(u, ev.n, color);
      return this.frames(8);
    }
    async onDie(ev) {
      const u = ev.u;
      if (u.isParty) {
        R.sfx('death');
        this.winFx[u.idx].flash = 16;
        return this.frames(12);
      }
      const v = this.vis.get(u);
      v.flash = 0; v.shake = 0;
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

    // ------------------------------------------------------------ commands
    async commandPhase() {
      const eng = this.eng;
      if (this.auto && this.autoCancel) { this.auto = false; this.autoCancel = false; R.Battle.autoCarry = false; }
      if (this.auto) return R.BattleAI.partyCommands(eng, AUTO_OPTS);
      // リピート stays on (like オート) until B is pressed; this battle only
      if (this.repeating && this.repeatCancel) { this.repeating = false; this.repeatCancel = false; }
      if (this.repeating && this.lastCmds) return eng.repeatCommands(this.lastCmds);
      if (!eng.party.some((p) => p.commandable())) { await this.frames(24); return []; }
      this.clearMsg();
      for (;;) {
        const r = await this.partyMenu();
        if (r === 'auto') {
          this.auto = true; this.autoCancel = false; R.Battle.autoCarry = true;
          return R.BattleAI.partyCommands(eng, AUTO_OPTS);
        }
        if (r === 'repeat') { this.repeating = true; this.repeatCancel = false; return eng.repeatCommands(this.lastCmds); }
        if (r === 'flee') return { flee: true };
        const cmds = await this.memberCommands();
        if (cmds) return cmds;
      }
    }
    async partyMenu() {
      // 戦う リピート / オート 逃げる
      const ids = ['fight', 'repeat', 'auto', 'flee'];
      const canRepeat = !!(this.lastCmds && this.lastCmds.some(Boolean));
      const list = new R.UI.List({
        x: BOX.x, y: BOX.y, w: 128, h: BOX.h, cols: 2, rows: 2, lineH: 16, padY: 10, cancel: false,
        items: ['戦う', { label: 'リピート', disabled: !canRepeat }, 'オート', { label: '逃げる', disabled: this.eng.noEscape }],
        index: this.partyIdx,
      });
      if (list.isDisabled(list.index)) list.index = 0;
      this.panel = {
        left: list, enemies: true,
        help: () => (ids[list.index] === 'repeat' ? (canRepeat ? '前のターンと同じ行動をくり返す。（Bで解除）' : 'くり返す行動がまだない。') : ''),
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
      const inv = this.eng.inv;
      return Object.keys(inv)
        .filter((id) => { const it = DB.items[id]; return it && it.type === 'consumable' && it.use && it.use.battle && inv[id] > 0; })
        .sort((a, b) => (!!DB.items[a].rare - !!DB.items[b].rare) || ((DB.items[a].sort || 0) - (DB.items[b].sort || 0)) || ((DB.items[a].price || 0) - (DB.items[b].price || 0)))
        .map((id) => ({ id, it: DB.items[id], n: inv[id] - ((reserved && reserved[id]) || 0), noEsc: this.eng.noEscape && B.isEscape(DB.items[id].use) }));
    }
    async memberMenu(u, reserved) {
      const c = u.c, m = mem(c.id);
      const cmds = R.Rules.commands(c);
      const items = cmds.map((k) => ({
        label: k.name,
        disabled: (k.type === 'job' && !R.Rules.actionList(c, k.job).length) || (k.type === 'item' && !this.battleItems(reserved).some((x) => x.n > 0)),
      }));
      const list = new R.UI.List({ x: BOX.x, y: BOX.y, w: 128, h: BOX.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title: c.name, index: Math.min(m.cmd || 0, items.length - 1) });
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
        if (k.type === 'attack') {
          const t = await this.pickTarget(u, 'enemy');
          if (t !== BACK) return { type: 'attack', target: t };
        } else if (k.type === 'defend') return { type: 'defend' };
        else if (k.type === 'job') {
          const r = await this.abilityMenu(u, k);
          if (r !== BACK) return r;
        } else if (k.type === 'item') {
          const r = await this.itemMenu(u, reserved);
          if (r !== BACK) return r;
        }
      }
    }
    async abilityMenu(u, k) {
      const c = u.c, m = mem(c.id);
      const ids = R.Rules.actionList(c, k.job);
      const items = ids.map((id) => {
        const ab = DB.abilities[id];
        const cost = this.eng.mpCost(u, id, ab);
        return { label: ab.name, right: cost ? String(cost) : '', disabled: !!this.eng.unusable(u, id) };
      });
      const list = new R.UI.List({ x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title: k.name, index: Math.min(m.ab[k.job] || 0, items.length - 1) });
      for (;;) {
        this.panel = { left: list, help: () => { const ab = DB.abilities[ids[list.index]]; return ab ? this.abilityHelp(u, ids[list.index], ab) : ''; } };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.ab[k.job] = i;
        const id = ids[i], ab = DB.abilities[id];
        list.active = false;
        const t = await this.pickTarget(u, ab.target);
        if (t !== BACK) return { type: 'ability', id, target: t };
      }
    }
    abilityHelp(u, id, ab) {
      const why = this.eng.unusable(u, id);
      if (why === 'silence') return '魔法を封じられている！';
      if (why === 'mp') return 'MPが足りない！';
      if (why === 'once') return 'この戦いではもう使えない。';
      if (why === 'field') return '戦闘中は使えない。';
      if (why === 'noescape') return 'この戦いからは逃げられない！';
      return ab.desc || '';
    }
    async itemMenu(u, reserved) {
      const m = mem(u.c.id);
      const list0 = this.battleItems(reserved);
      if (!list0.length) { R.sfx('buzzer'); return BACK; }
      const items = list0.map((x) => ({ label: (x.it.rare ? '★' : '') + x.it.name, right: String(Math.max(0, x.n)), disabled: x.n <= 0 || x.noEsc }));
      const list = new R.UI.List({ x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title: '道具', index: Math.min(m.item || 0, items.length - 1) });
      for (;;) {
        this.panel = { left: list, help: () => { const x = list0[list.index]; return x ? (x.noEsc ? 'この戦いからは逃げられない！' : x.it.desc || '') : ''; } };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.item = i;
        const it = list0[i].it;
        list.active = false;
        const t = await this.pickTarget(u, it.use.target);
        if (t !== BACK) return { type: 'item', id: list0[i].id, target: t };
      }
    }

    // ------------------------------------------------------------ targeting
    async pickTarget(u, type) {
      if (type === 'enemy' || type === 'group') return this.pickEnemy(u, type === 'group');
      if (type === 'ally' || type === 'ally_any' || type === 'ally_dead' || type === 'ally_other') return this.pickAlly(u, type);
      if (type === 'enemies' || type === 'random' || type === 'allies') return this.confirmAll(type);
      return null; // self needs no choice
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
    async pickEnemy(u, group) {
      const m = mem(u.c.id);
      const alive = this.eng.mons.filter((x) => x.alive).sort((a, b) => this.vis.get(a).x - this.vis.get(b).x);
      if (!alive.length) return BACK;
      const choices = group ? this.eng.groups().map((g) => g.units.filter((x) => x.alive)).filter((l) => l.length)
        .sort((a, b) => this.vis.get(a[0]).x - this.vis.get(b[0]).x) : alive.map((x) => [x]);
      let i = Math.max(0, choices.findIndex((l) => l.some((x) => x.key === m.target)));
      const prevPanel = this.panel;
      const name = () => { const l = choices[i]; return group && l.length > 1 ? `${l[0].base}　${l.length}匹` : l[0].name; };
      this.panel = Object.assign({}, prevPanel, { help: name, helpCenter: true });
      this.picking = { units: choices[i] };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d) {
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
      const ok = (p) => (type === 'ally' ? p.alive : type === 'ally_other' ? p.alive && p !== u : type === 'ally_dead' ? !p.alive : true);
      const cands = party.filter(ok);
      if (!cands.length) { R.sfx('buzzer'); return BACK; }
      const most = type === 'ally' || type === 'ally_other';
      let t = type === 'ally_dead' ? cands[0] : most ? cands.slice().sort((a, b) => a.hpRate() - b.hpRate())[0] : u;
      if (most && t.hpRate() >= 1) t = ok(u) ? u : cands[0];
      let i = party.indexOf(t);
      const prevPanel = this.panel;
      this.panel = Object.assign({}, prevPanel, { help: () => { const p = party[i]; return `${p.name}  HP ${p.hp}/${p.mhp}  MP ${p.mp}/${p.mmp}`; }, helpCenter: true });
      this.picking = { ally: party[i] };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d) {
          const step = d === 'left' || d === 'up' ? -1 : 1;
          let j = i;
          for (let n = 0; n < 3; n++) { j = (j + step + 3) % 3; if (ok(party[j])) break; }
          if (j !== i) { i = j; this.picking.ally = party[i]; R.sfx('cursor'); }
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
      // a page waiting for a key (rewards, level-ups, drops, pause): A, B or ↓ (request: 十字キーの下でも進む)
      const down = In().pressed('down');
      if (m.resolve && m.key && m.ch >= m.need && (In().pressed('a') || In().pressed('b') || down)) {
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
      for (const v of this.vis.values()) {
        for (const k of ['flash', 'shake', 'blink', 'lunge', 'dodge', 'appear']) if (v[k] > 0) v[k] = Math.max(0, v[k] - s);
        if (v.flee) v.flee.t += s;
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
      for (const f of this.winFx) { if (f.shake > 0) f.shake = Math.max(0, f.shake - s); if (f.flash > 0) f.flash = Math.max(0, f.flash - s); }
      if (this.fxList.length) this.fxList = this.fxList.filter((f) => (f.t += s) < f.life);
      if (this.pops.length) this.pops = this.pops.filter((p) => (p.t += s) < 52);
      this.tickMsg();
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
      this.drawWindows();
      this.drawFx('top');
      this.drawPops(true);
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
      for (const v of this.vis.values()) {
        const m = v.m;
        if (v.gone || (!m.alive && !v.die && !v.flee)) continue;
        let x = v.x, y = v.y, alpha = 1;
        if (v.fly && !v.die) y += Math.round(Math.sin(F / 18 + v.i) * 2);
        if (v.shake > 0) x += Math.floor(v.shake) % 4 < 2 ? 2 : -2;
        if (v.lunge > 0) y += Math.round(Math.sin(((12 - v.lunge) / 12) * Math.PI) * 5);
        if (v.dodge > 0) x += Math.round(Math.sin(((12 - v.dodge) / 12) * Math.PI) * 10);
        if (v.appear > 0) alpha = 1 - v.appear / 20;
        if (v.flee) {
          x += v.flee.t * 5 * (v.x + v.w / 2 < 128 ? -1 : 1);
          alpha = 1 - v.flee.t / 18;
          if (alpha <= 0) { v.gone = true; continue; }
        }
        if (v.die) { if (this.drawDying(v, x, y)) v.gone = true; continue; }
        const targeted = this.picking && this.picking.units && this.picking.units.includes(m);
        if (v.flash > 0 && Math.floor(v.flash / 2) % 2 === 0) G().drawTinted(v.img, x, y, '#ffffff', 0.9);
        else if (v.blink > 0 && Math.floor(v.blink / 3) % 2 === 0) G().drawTinted(v.img, x, y, '#ffffff', 0.55);
        else if (targeted) G().drawTinted(v.img, x, y, '#ffffff', 0.18 + 0.18 * Math.sin(F * 0.2));
        else G().draw(v.img, x, y, alpha < 1 ? { alpha } : undefined);
        if (m.d && m.d.flags && m.d.flags.includes('rare')) this.drawSparkles(v, x, y, F);
      }
    }
    /** twinkling stars around a rare monster */
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
        if (v.y - 9 < 52) { rightArrow(Math.max(2, v.x - 8), Math.round(v.y + Math.min(v.h / 2, 40))); continue; }
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
    drawWindows() {
      const C = G().C;
      const theme = G().WINDOW_THEMES[R.Settings.windowColor] || G().WINDOW_THEMES.black;
      this.eng.party.forEach((p, i) => {
        const f = this.winFx[i];
        let x = WIN.xs[i], y = WIN.y;
        if (f.shake > 0) x += Math.round(Math.sin(f.shake * 1.3) * 2);
        const picked = this.picking && (this.picking.ally === p || (this.picking.allies && !p.gone));
        if (this.acting === p || picked) y -= 3;
        const red = f.flash > 0 && Math.floor(f.flash / 3) % 2 === 0;
        G().window(x, y, WIN.w, WIN.h, { theme: red ? 'red' : undefined });
        const col = p.hp <= 0 ? C.dead : p.hp < p.mhp * 0.25 ? C.yellow : C.white;
        // name on the top border (coloured like the rest of the window)
        const tw = Math.ceil(G().textWidth(p.name)) + 8;
        const tx = x + Math.floor((WIN.w - tw) / 2);
        G().rect(tx, y, tw, 5, red ? G().WINDOW_THEMES.red.fill : theme.fill);
        G().text(p.name, tx + 4, y - 3, { color: col });
        G().text('H', x + 9, y + 8, { color: col });
        G().text(String(p.hp), x + WIN.w - 9, y + 8, { color: col, align: 'right' });
        G().text('M', x + 9, y + 19, { color: col });
        G().text(String(p.mp), x + WIN.w - 9, y + 19, { color: col, align: 'right' });
        G().text('Lv', x + 9, y + 30, { color: col });
        G().text(String(p.level), x + 30, y + 30, { color: col });
        // status icons (right side of the Lv line)
        const icons = ICON_ORDER.filter((s) => p.status[s] || (s === 'regen' && p.permRegen && p.alive));
        if (p.alive) {
          if (U.clamp(Math.max(...Object.values(p.buffs)), 0, 2) > 0) icons.push('up');
          if (Math.min(...Object.values(p.buffs)) < 0) icons.push('down');
        }
        icons.slice(0, 3).forEach((s, k) => G().draw(R.BattleFX.get('icon_' + s), x + WIN.w - 16 - k * 9, y + 33));
        if (picked && Math.floor(R.Engine.frame / 10) % 3 !== 2) upArrow(x + WIN.w / 2, y + WIN.h + 1);
      });
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
      if (m.resolve && m.key && m.ch >= m.need) G().moreArrow(BOX.x + BOX.w / 2 - 3, BOX.y + BOX.h - 8);
    }
    drawPanel() {
      const p = this.panel;
      if (p.enemies && p.left) {
        const x = p.left.x + p.left.w + 2;
        this.drawEnemyList(x, BOX.y, BOX.x + BOX.w - x, BOX.h);
      }
      // help / target strip first: the command window's title tab may overlap its bottom border
      if (p.help) {
        const s = p.help();
        if (s) {
          G().window(BOX.x, HELP_Y, BOX.w, BOX.y - HELP_Y + 2);
          if (p.helpCenter) {
            const w = Math.min(BOX.w - 20, G().textWidth(s));
            fitText(s, BOX.x + (BOX.w - w) / 2, HELP_Y + 4, BOX.w - 20);
          } else fitText(s, BOX.x + 10, HELP_Y + 4, BOX.w - 20);
        }
      }
      if (p.left) p.left.draw({ showInactiveCursor: true });
    }
    drawEnemyList(x, y, w, h) {
      G().window(x, y, w, h);
      const groups = this.eng.groups();
      groups.slice(0, 4).forEach((g, i) => {
        const ty = y + 8 + i * 14;
        const nw = Math.ceil(G().textWidth(String(g.n)));
        fitText(g.name, x + 9, ty, w - 22 - nw);
        G().text(String(g.n), x + w - 9, ty, { align: 'right' });
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

  function downArrow(cx, y) {
    for (let i = 0; i < 5; i++) G().rect(cx - 5 + i, y + i, 11 - i * 2, 1, '#000000');
    for (let i = 0; i < 4; i++) G().rect(cx - 4 + i, y + i, 9 - i * 2, 1, '#ffffff');
  }
  function rightArrow(x, cy) {
    for (let i = 0; i < 5; i++) G().rect(x + i, cy - 5 + i, 1, 11 - i * 2, '#000000');
    for (let i = 0; i < 4; i++) G().rect(x + i, cy - 4 + i, 1, 9 - i * 2, '#ffffff');
  }
  function upArrow(cx, y) {
    for (let i = 0; i < 5; i++) G().rect(cx - 5 + i, y + 4 - i, 11 - i * 2, 1, '#000000');
    for (let i = 0; i < 4; i++) G().rect(cx - 4 + i, y + 3 - i, 9 - i * 2, 1, '#ffffff');
  }

  // --------------------------------------------------------------- entry
  /**
   * Start a battle. o: {zone | troop | mons:[[id,n]|[id,min,max]], bg, bgm, canLose, noEscape,
   *   surprise:'pre'|'ambush'|null (forced; omitted = rolled for random encounters)}
   * Resolves 'win' | 'lose' | 'escape'. On 'lose' the party is left as is (the caller runs the game over).
   */
  async function start(o) {
    o = o || {};
    if (!R.Game) throw new Error('R.Battle.start: no game in progress');
    // rare monster: a plain random encounter may be replaced by the zone's rare monster
    if (o.zone && !o.troop && !o.mons && !o.noRare) {
      const rr = DB.rareEncounters && DB.rareEncounters[o.zone];
      if (rr && DB.monsters[rr.mon] && U.r() < rr.rate) o = Object.assign({}, o, { mons: [[rr.mon, 1]], rareMon: rr.mon });
    }
    const troop = o.troop && DB.troops[o.troop];
    const zone = o.zone && DB.encounters[o.zone];
    const mons = B.buildMons(o);
    if (!mons.length) { R.warn('battle: no monsters for', o.zone || o.troop || o.mons); return 'win'; }
    const eng = new B.Engine({
      party: R.Game.party, mons, inv: R.Game.inv, live: true,
      noEscape: !!(o.noEscape || (troop && troop.noEscape)),
      surprise: o.surprise, noSurprise: !o.zone,
    });
    const bg = o.bg || (troop && troop.bg) || (zone && zone.bg) || 'grass';
    const bgm = o.bgm || (troop && troop.bgm) || (eng.boss ? 'boss' : 'battle');
    const A = R.Audio;
    const prev = A && A.current;
    if (A && A.pushBGM) A.pushBGM(bgm); else R.bgm(bgm);
    R.Game.battles = (R.Game.battles || 0) + 1;
    // オート継続: a plain random encounter starts in auto mode when the last
    // battle ended in auto (boss/event battles always start manual)
    const randomFight = !!(o.zone && !o.troop && !o.mons && !o.canLose && !eng.noEscape && !eng.boss);
    const autoStart = randomFight && R.Settings.autoKeep !== false && !!B.autoCarry;
    const scene = new BattleScene(eng, { bg, bgm, canLose: !!o.canLose, autoStart, rare: !!o.rareMon });
    B.current = scene;
    let res;
    try {
      res = await R.Engine.run(scene);
    } finally {
      B.current = null;
      if (A && A.popBGM) A.popBGM(); else if (prev) R.bgm(prev);
    }
    if (res === 'win' && eng.killed.length) R.Game.wins = (R.Game.wins || 0) + 1;
    if (res === 'escape') R.Game.escapes = (R.Game.escapes || 0) + 1;
    R.emit('battleEnd', res, o);
    return res;
  }

  Object.assign(B, { start, Scene: BattleScene, current: null, WIN, BOX });
})(window.RPG);
