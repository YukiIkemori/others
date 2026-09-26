// Field menu (DESIGN §8): the B-button command window with gold / play time /
// party / next-objective windows, plus the shared menu kit (screen base class,
// party picker, labels, drawing helpers) and the one helper that applies field
// effects of items and abilities (R.Menu.applyFieldEffect).
// Sub-screens live in menu_*.js; each registers itself on R.Menu at load time.
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  // ------------------------------------------------------------ labels
  const STAT_NAMES = {
    hp: '最大HP', mp: '最大MP', str: '力', vit: '体力', agi: '素早さ', int: '知力', mnd: '精神', luk: '運',
    atk: '攻撃力', def: '守備力', mag: '魔力', mdef: '魔法防御', hit: '命中', eva: '回避', crit: '会心',
  };
  const ELEM_NAMES = { fire: '炎', ice: '氷', thunder: '雷', wind: '風', earth: '大地', water: '水', holy: '聖', dark: '闇' };
  const STATUS_NAMES = { poison: '毒', sleep: '眠り', paralyze: '麻痺', confuse: '混乱', silence: '沈黙', blind: '暗闇', death: '即死', regen: '再生' };
  const KIND_NAMES = { action: 'アクション', reaction: 'リアクション', support: 'サポート', field: 'フィールド' };
  const KIND_COLORS = { action: '#ff9a5a', reaction: '#6fd8ff', support: '#8ce07a', field: '#e8c860' };
  const ELEMS = ['fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark'];

  const elemName = (e) => (DB.elements[e] && DB.elements[e].name) || ELEM_NAMES[e] || e;
  const statusName = (s) => (DB.statuses[s] && DB.statuses[s].name) || STATUS_NAMES[s] || s;
  const jobName = (j) => (DB.jobs[j] && DB.jobs[j].name) || '？？？';
  const itemName = (id) => (DB.items[id] && DB.items[id].name) || '？？？';
  const abName = (id) => (DB.abilities[id] && DB.abilities[id].name) || '？？？';

  // ------------------------------------------------------------ drawing kit
  const K = {
    STAT_NAMES, ELEM_NAMES, STATUS_NAMES, KIND_NAMES, KIND_COLORS, ELEMS,
    elemName, statusName, jobName, itemName, abName,

    /** text shrunk (never below 7px) so it fits maxW */
    fitText(str, x, y, maxW, opts) {
      const o = Object.assign({}, opts || {});
      const w = G().textWidth(str, o.size);
      if (w > maxW) o.size = Math.max(7, (o.size || G().FS) * maxW / w);
      G().text(str, x, y + (o.size && o.size < G().FS ? (G().FS - o.size) * 0.6 : 0), o);
    },
    /** 16x24 party sprite for member c in a job (or null if the art is missing) */
    sprite(c, job, dir, frame) {
      const key = 'party:' + c.id + ':' + (job || c.job);
      if (!G().has(key)) return null;
      const s = G().get(key);
      if (!s) return null;
      if (s.getContext || s.width) return s;
      const a = s[dir || 'down'] || s.down;
      return Array.isArray(a) ? a[(frame || 0) % a.length] : a;
    },
    /** draw a party sprite bottom-centred at (cx, bottom); fallback silhouette if no art */
    drawSprite(c, cx, bottom, opts) {
      const o = opts || {};
      const img = K.sprite(c, o.job, o.dir, o.frame);
      if (img) {
        if (o.dark) G().drawTinted(img, cx - (img.width >> 1), bottom - img.height, '#000000', o.darkAmt != null ? o.darkAmt : 0.85);
        else G().draw(img, cx - (img.width >> 1), bottom - img.height, o.alpha != null ? { alpha: o.alpha } : null);
        return;
      }
      const col = o.dark ? '#202028' : (DB.jobs[o.job || c.job] && DB.jobs[o.job || c.job].outfit && DB.jobs[o.job || c.job].outfit.main) || '#8090a0';
      G().rect(cx - 4, bottom - 22, 8, 8, o.dark ? '#202028' : '#f0c8a0');
      G().rect(cx - 5, bottom - 14, 10, 13, col);
    },
    iconKey(it) {
      if (!it) return null;
      if (it.icon && G().has('icon:' + it.icon)) return it.icon;
      switch (it.type) {
        case 'weapon': return it.wtype;
        case 'shield': return 'shield';
        case 'head': case 'body': return it.atype;
        case 'acc': return 'acc';
        case 'key': return 'key';
        case 'consumable': {
          const e = (it.use && it.use.effects) || [];
          return e.some((x) => x.type === 'heal' && !x.pct) && !e.some((x) => x.type === 'healMp') ? 'herb' : 'potion';
        }
      }
      return null;
    },
    drawIcon(it, x, y) {
      const k = K.iconKey(it);
      if (k && G().has('icon:' + k)) G().draw(G().get('icon:' + k), x, y);
    },
    /** job name with a leading ★ once c has mastered it (every job list uses this) */
    jobLabel(c, job) { return (c && R.Rules.isMastered(c, job) ? '★' : '') + jobName(job); },
    /** gold for a mastered job, else `base` */
    jobColor(c, job, base) { return c && R.Rules.isMastered(c, job) ? G().C.gold : base || G().C.white; },
    /** item name with ★ for rare ones */
    itemLabel(id) { const it = DB.items[id]; return it ? it.name + (it.rare ? '★' : '') : '？？？'; },
    /** name colour by condition (DQ: orange when low, red when down) */
    condColor(c) {
      if (c.hp <= 0) return G().C.dead;
      const s = R.Rules.stats(c);
      if (c.hp <= s.hp / 4) return G().C.hpLow;
      if (c.status && c.status.poison) return G().C.purple;
      return G().C.white;
    },
    statusText(c) {
      if (c.hp <= 0) return { text: '戦闘不能', color: G().C.dead };
      const s = c.status || {};
      for (const k of ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind']) if (s[k]) return { text: statusName(k), color: G().C.purple };
      return null;
    },
    /** small HP/MP gauge */
    gauge(x, y, w, cur, max, color) {
      G().rect(x, y, w, 2, '#303048');
      G().rect(x, y, Math.round(w * U.clamp(max ? cur / max : 0, 0, 1)), 2, color);
    },
    /** right-aligned number with a small label on the left */
    labelNum(label, value, x, y, w, opts) {
      const o = opts || {};
      G().text(label, x, y, { color: o.labelColor || G().C.white });
      G().text(String(value), x + w, y, { align: 'right', color: o.color || G().C.white });
    },
    /** blinking left/right arrows around a header (member switch hint) */
    lrArrows(x1, x2, y, keys) {
      // member switch: small L / R shoulder-button badges in place of the arrows
      if (keys) {
        K.keyBadge('L', x1 - 3, y);
        K.keyBadge('R', x2 - 5, y);
        return;
      }
      if (Math.floor(R.Engine.frame / 20) % 2) return;
      for (let i = 0; i < 4; i++) {
        G().rect(x1 + i, y + 4 - i, 1, 1 + i * 2, '#ffffff');
        G().rect(x2 - i, y + 4 - i, 1, 1 + i * 2, '#ffffff');
      }
    },
    /** L/R (keyboard Q/E, pad shoulders) member switch: -1, +1 or 0. Safe before 'l'/'r' exist. */
    memberStep() {
      const I = In();
      if (!I || typeof I.pressed !== 'function') return 0;
      if (I.pressed('l')) return -1;
      if (I.pressed('r')) return 1;
      return 0;
    },
    /** a tiny 9x9 button badge with a letter (L / R) */
    keyBadge(ch, x, y) {
      G().rect(x + 1, y, 7, 9, '#5a6498'); G().rect(x, y + 1, 9, 7, '#5a6498');
      G().rect(x + 1, y + 1, 7, 7, '#2a3060');
      G().text(ch, x + 5, y + 1, { size: 7, color: '#e8ecff', align: 'center' });
    },
    /** small 「L/R」 hint (member switch); align 'left' | 'right' | 'center' */
    lrHint(x, y, align) {
      G().text('L/R', x, y, { size: 7, color: '#8890b0', align: align || 'left' });
    },
    /** rectangle selection frame (grid cursors) */
    frame(x, y, w, h, color, blink) {
      if (blink && Math.floor(R.Engine.frame / 16) % 2) return;
      G().strokeRect(x, y, w, h, color || '#ffffff');
    },
    /** R.UI.say with explicit flags (a reused window would otherwise inherit noWait/auto) */
    say(text, opts) { return R.UI.say(text, Object.assign({ noWait: false, keep: false, auto: 0 }, opts)); },
    async msg(text) { await K.say(text); },
    async yesno(text) { const r = await R.UI.yesno(text); R.UI.closeMessage(); return r; },
    wrap(str, w, size) { return G().wrap(str, w, size); },
  };
  Menu.kit = K;

  // ------------------------------------------------------------ screen base
  /** A menu layer: input goes to input() unless an async flow is running. */
  class Screen extends R.Layer {
    constructor() { super(); this.busy = false; this.hidden = false; }
    update() { if (!this.busy && !this.closed) this.input(); }
    input() {}
    /** run an async sub-flow; input is ignored until it finishes */
    flow(fn) {
      if (this.busy) return;
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => {
        this.busy = false;
        R.Input.consume();
      });
    }
    draw() { if (!this.hidden) this.render(); }
    render() {}
  }
  K.Screen = Screen;

  // ------------------------------------------------------------ party picker
  class PickerLayer extends Screen {
    constructor(o) {
      super();
      this.o = o;
      this.party = R.Game.party;
      this.index = U.clamp(o.initial || 0, 0, this.party.length - 1);
      if (o.valid && !o.valid(this.party[this.index])) {
        const k = this.party.findIndex(o.valid);
        if (k >= 0) this.index = k;
      }
      this.w = 150; this.rowH = 30;
      this.h = 14 + this.party.length * this.rowH;
      this.x = o.x != null ? o.x : R.W - this.w - 6;
      this.y = o.y != null ? o.y : 50;
    }
    input() {
      const d = In().dirRepeat();
      const n = this.party.length;
      if (d === 'up' || d === 'down') {
        this.index = (this.index + (d === 'up' ? n - 1 : 1)) % n;
        R.sfx('cursor');
      }
      if (In().pressed('a')) {
        const c = this.party[this.index];
        if (this.o.valid && !this.o.valid(c)) { R.sfx('buzzer'); return; }
        if (this.o.use) {
          // repeat mode: the picker stays open on the same member after each use
          const r = this.o.use(this.index) || {};
          if (r.fail) R.sfx('buzzer');
          if (r.lines && r.lines.length) { this.note = r.lines.slice(-3); this.noteFail = !!r.fail; this.noteAt = R.Engine.frame; }
          if (r.done) { this.last = r; this.close(this.index); }
          return;
        }
        R.sfx('confirm');
        this.close(this.index);
      } else if (In().pressed('b')) { R.sfx('cancel'); this.close(-1); }
    }
    render() {
      const { x, y, w, h } = this;
      const title = typeof this.o.title === 'function' ? this.o.title() : this.o.title;
      G().window(x, y, w, h, { title });
      this.party.forEach((c, i) => {
        const ry = y + 8 + i * this.rowH;
        const ok = !this.o.valid || this.o.valid(c);
        if (this.o.mark === i) G().rect(x + 4, ry - 2, w - 8, this.rowH, '#23336e');
        const st = R.Rules.stats(c);
        K.drawSprite(c, x + 26, ry + 26, { frame: i === this.index ? Math.floor(R.Engine.frame / 16) : 0, alpha: ok ? 1 : 0.45 });
        const col = ok ? K.condColor(c) : G().C.gray;
        const stt = K.statusText(c);
        // long names shrink so they never run into the status label (e.g. 戦闘不能)
        K.fitText(c.name, x + 40, ry + 1, w - 50 - (stt ? G().textWidth(stt.text) + 4 : 0), { color: col });
        if (stt) G().text(stt.text, x + w - 10, ry + 1, { align: 'right', color: ok ? stt.color : G().C.gray });
        const tc = ok ? G().C.white : G().C.gray;
        G().text('H', x + 40, ry + 14, { color: tc });
        const hc = K.condColor(c);
        G().text(c.hp + '/' + st.hp, x + 92, ry + 14, { align: 'right', color: !ok ? tc : hc === G().C.purple ? G().C.white : hc });
        G().text('M', x + 97, ry + 14, { color: tc });
        G().text(String(c.mp), x + w - 10, ry + 14, { align: 'right', color: tc });
        K.gauge(x + 40, ry + 26, 52, c.hp, st.hp, c.hp <= st.hp / 4 ? '#ffb03c' : '#6ee07a');
        K.gauge(x + 97, ry + 26, 43, c.mp, st.mp, '#6fa8ff');
        if (i === this.index) G().cursor(x + 5, ry + 8, !this.busy);
      });
      if (this.o.info) this.o.info(x, y + h + 2);
      if (this.note) {
        // result of the last use (non-blocking: A uses it again, B closes)
        const ny = R.H - 6 - (16 + this.note.length * 14 - 2);
        G().window(4, ny, R.W - 8, 16 + this.note.length * 14 - 2);
        this.note.forEach((l, i) => K.fitText(l, 15, ny + 8 + i * 14, R.W - 30, { color: this.noteFail ? G().C.gray : G().C.white }));
      }
    }
  }
  /**
   * choose a party member → index or -1. o: {title (string | fn), valid(c), initial, x, y, info(x,y),
   * use(i) → {lines, fail, done}}. With `use` the picker stays open after each pick (repeat use) and
   * shows the returned lines below; it closes on B or when use() returns done.
   */
  Menu.pickMember = (o) => R.Engine.run(new PickerLayer(o || {}));

  // ------------------------------------------------------------ field effects
  const targetsOf = (effects) => effects || [];
  const hasType = (effects, t) => targetsOf(effects).some((e) => e.type === t);

  /** amount of a heal effect in the field (matches battle when R.Battle.healAmount exists) */
  function healAmount(eff, user, target, isItem, expect) {
    const st = R.Rules.stats(target);
    if (eff.pct) return Math.ceil(st.hp * eff.pct);
    if (!expect && R.Battle && typeof R.Battle.healAmount === 'function') {
      try {
        const v = R.Battle.healAmount(user, target, eff, { item: isItem, field: true });
        if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
      } catch (e) { /* fall through */ }
    }
    const um = user ? R.Rules.mods(user) : {};
    const us = user ? R.Rules.stats(user) : { mnd: 0 };
    const scale = eff.scale != null ? eff.scale : isItem ? 0 : 0.6;
    const bonus = isItem ? (um.itemPct || 0) : (um.healPct || 0);
    return Math.max(1, Math.round(((eff.power || 0) + us.mnd * scale) * (expect ? 1 : U.rf(0.95, 1.05)) * (1 + bonus / 100)));
  }
  /** expected HP a def ({effects}) heals on target (no randomness; 0 if it does not heal) */
  function expectHeal(def, user, target, isItem) {
    let n = 0;
    for (const e of targetsOf(def && def.effects)) if (e.type === 'heal') n += healAmount(e, user, target, isItem, true);
    return n;
  }

  /** would effects change anything for c? (prevents wasting items) */
  function affects(effects, c) {
    const st = R.Rules.stats(c);
    for (const e of targetsOf(effects)) {
      switch (e.type) {
        case 'heal': if (c.hp > 0 && c.hp < st.hp) return true; break;
        case 'healMp': if (c.hp > 0 && c.mp < st.mp) return true; break;
        case 'revive': if (c.hp <= 0) return true; break;
        case 'cure': {
          const s = c.status || {};
          if (c.hp > 0 && (e.statuses === 'all' ? Object.keys(s).some((k) => s[k]) : (e.statuses || []).some((k) => s[k]))) return true;
          break;
        }
        case 'grow': if (c.hp > 0) return true; break;
        default: break;
      }
    }
    return false;
  }
  Menu.affects = affects;

  /**
   * Apply field effects (item or ability) of `def` ({effects, target}) used by
   * `user` on `targets` (array of chars). Handles heal/healMp/revive/cure/grow and
   * repel directly; teleport/exit are reported back (they need the menu closed).
   * → {lines:[text], changed:bool, teleport?:true, exit?:true}
   */
  Menu.applyFieldEffect = function (def, user, targets, opts) {
    const o = opts || {};
    const isItem = !!o.item;
    const effects = targetsOf(def && def.effects);
    const out = { lines: [], changed: false };
    const um = user ? R.Rules.mods(user) : {};
    const itemMul = isItem ? 1 + (um.itemPct || 0) / 100 : 1;
    for (const e of effects) {
      if (e.type === 'teleport') { out.teleport = true; continue; }
      if (e.type === 'exit') { out.exit = true; continue; }
      if (e.type === 'repel') {
        const steps = e.steps || 150;
        if (R.Field && R.Field.repel) R.Field.repel(steps); else R.Game.repelSteps = Math.max(R.Game.repelSteps || 0, steps);
        out.lines.push('魔物が寄りつかなくなった！');
        out.changed = true;
        continue;
      }
    }
    for (const c of targets || []) {
      for (const e of effects) {
        const st = R.Rules.stats(c);
        switch (e.type) {
          case 'heal': {
            if (c.hp <= 0 || c.hp >= st.hp) break;
            const before = c.hp;
            c.hp = Math.min(st.hp, c.hp + Math.round(healAmount(e, user, c, isItem)));
            const d = c.hp - before;
            out.lines.push(c.hp >= st.hp ? c.name + 'のHPが全回復した！' : c.name + 'のHPが' + d + '回復した！');
            out.changed = true;
            break;
          }
          case 'healMp': {
            if (c.hp <= 0 || c.mp >= st.mp) break;
            const before = c.mp;
            c.mp = Math.min(st.mp, c.mp + Math.round((e.power || 0) * itemMul));
            out.lines.push(c.mp >= st.mp ? c.name + 'のMPが全回復した！' : c.name + 'のMPが' + (c.mp - before) + '回復した！');
            out.changed = true;
            break;
          }
          case 'revive': {
            if (c.hp > 0) break;
            c.hp = Math.max(1, Math.floor(st.hp * (e.pct != null ? e.pct : 0.25)));
            c.status = {};
            out.lines.push('なんと、' + c.name + 'が生き返った！');
            out.changed = true;
            break;
          }
          case 'cure': {
            if (c.hp <= 0) break;
            const s = c.status || (c.status = {});
            const list = e.statuses === 'all' ? Object.keys(s) : (e.statuses || []);
            const cured = list.filter((k) => s[k]);
            if (!cured.length) break;
            for (const k of cured) delete s[k];
            out.lines.push(cured.length > 1 ? c.name + 'はすっかり元気になった！' : c.name + 'の' + statusName(cured[0]) + 'が治った！');
            out.changed = true;
            break;
          }
          case 'grow': {
            if (c.hp <= 0) break;
            const n = e.n || 1;
            const s0 = R.Rules.stats(c);
            R.Rules.grow(c, e.stat, n);
            const s1 = R.Rules.stats(c);
            if (e.stat === 'hp') c.hp = Math.min(s1.hp, c.hp + (s1.hp - s0.hp));
            if (e.stat === 'mp') c.mp = Math.min(s1.mp, c.mp + (s1.mp - s0.mp));
            const gain = s1[e.stat] - s0[e.stat]; // the real change (caps, % mods) — never just n
            out.lines.push(gain > 0 ? c.name + 'の' + (STAT_NAMES[e.stat] || e.stat) + 'が' + gain + '上がった！'
              : c.name + 'の' + (STAT_NAMES[e.stat] || e.stat) + 'はもう上がらない。');
            out.changed = true;
            break;
          }
          default: break;
        }
      }
    }
    return out;
  };

  // ------------------------------------------------------------ use flows
  const needsPick = (t) => t === 'ally' || t === 'ally_dead' || t === 'ally_any' || t === 'ally_other';
  function validFor(target, effects, user) {
    return (c) => {
      if (target === 'ally_other' && c === user) return false;
      if (target === 'ally_dead') return c.hp <= 0;
      if (target === 'ally_any') return true;
      if (hasType(effects, 'revive') && !effects.some((e) => e.type !== 'revive')) return c.hp <= 0;
      return c.hp > 0;
    };
  }

  /**
   * Repeat-use target picker (item or ability): stays open on the same member after each use
   * so the same thing can be used again at once; closes on B or when it can no longer be paid.
   * spend() pays one use, canPay() says whether another use is possible.
   * → true if used at least once
   */
  async function repeatPick(o) {
    const { eff, valid, user, verbLine, canPay, spend, def, isItem } = o;
    const party = R.Game.party;
    let used = false, lastLines = null, done = false;
    await Menu.pickMember({
      title: o.title, valid, initial: o.initial,
      use: (i) => {
        const c = party[i];
        if (!affects(eff, c)) return { fail: true, lines: [c.name + 'には今は使う必要がないようだ。'] };
        spend();
        const r = Menu.applyFieldEffect(def, user, [c], { item: isItem });
        used = true;
        R.sfx(hasType(eff, 'revive') ? 'revive' : hasType(eff, 'grow') ? 'buff' : 'heal');
        lastLines = [verbLine].concat(r.lines);
        done = !canPay();
        return { lines: lastLines, done };
      },
    });
    // the last use emptied the stock / MP: show its result before going back to the list
    if (done && lastLines) await K.msg(lastLines.concat(o.outLine ? [o.outLine] : []).slice(0, 4).join('\n'));
    return used;
  }

  /** choose a teleport destination → location id or null */
  async function chooseTown() {
    const list = R.Field && R.Field.teleportList ? R.Field.teleportList() : [];
    if (!list.length) { await K.msg('飛んでいける場所がない！'); return null; }
    const i = await R.UI.choose(list.map((l) => l.name), { y: 16, title: 'どこへ行く？', rows: Math.min(list.length, 11) });
    return i < 0 ? null : list[i].id;
  }

  /** after the whole menu has closed: announce + teleport/exit on the field */
  function afterMenu(lines, act) {
    Menu._after = async () => {
      const run = async (ev) => {
        for (const l of lines) await K.say(l, { keep: true });
        R.UI.closeMessage();
        if (act.teleport && R.Field && R.Field.teleport) await R.Field.teleport(act.teleport);
        if (act.exit && R.Field && R.Field.exitDungeon) await R.Field.exitDungeon();
      };
      if (R.Events && R.Events.run) await R.Events.run(run, { self: 'menu' });
      else await run();
    };
  }

  /** who uses an item in the field: the living member with the best item bonus (else the leader) */
  function itemUser() {
    let best = R.State.leader(), bv = -1;
    for (const c of R.State.alive()) {
      const v = R.Rules.mods(c).itemPct || 0;
      if (v > bv) { bv = v; best = c; }
    }
    return bv > 0 ? best : R.State.leader();
  }
  Menu.itemUser = itemUser;

  /**
   * Field use of an inventory item. Returns 'exit' when the menu must close
   * (teleport / exit), true when something was used, false otherwise.
   */
  Menu.useItem = async function (id) {
    const it = DB.items[id];
    const u = it && it.use;
    if (!u || u.field === false || !(u.effects || []).length || (!u.field && u.battle)) {
      await K.msg(it && it.type === 'consumable' ? 'それは今は使えない。' : 'それは使うものではない。');
      return false;
    }
    const lead = itemUser();
    const eff = u.effects;
    if (hasType(eff, 'teleport') || hasType(eff, 'exit')) {
      const tp = hasType(eff, 'teleport');
      if (tp ? !(R.Field && R.Field.canTeleport && R.Field.canTeleport()) : !(R.Field && R.Field.canExit && R.Field.canExit())) {
        await K.msg('ここでは使えないようだ。');
        return false;
      }
      let loc = null;
      if (tp) { loc = await chooseTown(); if (!loc) return false; }
      R.State.removeItem(id, 1);
      afterMenu([lead.name + 'は' + it.name + 'を使った！'], tp ? { teleport: loc } : { exit: true });
      return 'exit';
    }
    if (hasType(eff, 'repel') && !needsPick(u.target)) {
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, [], { item: true });
      R.sfx('item');
      await K.msg(lead.name + 'は' + it.name + 'を使った！\n' + r.lines.join('\n'));
      return true;
    }
    if (!needsPick(u.target)) {
      const targets = u.target === 'self' ? [lead] : R.Game.party.slice();
      if (!targets.some((c) => affects(eff, c))) { await K.msg('今は使う必要がないようだ。'); return false; }
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, targets, { item: true });
      R.sfx(hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg(lead.name + 'は' + it.name + 'を使った！\n' + r.lines.join('\n'));
      return true;
    }
    // pick a target, repeatedly while the item lasts (the picker stays open on the same member)
    const valid = validFor(u.target, eff, lead);
    const last = R.Game.party.findIndex((c) => valid(c) && affects(eff, c));
    if (last < 0) { await K.msg('今は使う必要がないようだ。'); return false; }
    return repeatPick({
      eff, valid, user: lead, def: u, isItem: true, initial: last,
      title: () => it.name + ' ×' + R.State.count(id),
      verbLine: lead.name + 'は' + it.name + 'を使った！',
      canPay: () => R.State.count(id) > 0,
      spend: () => R.State.removeItem(id, 1),
      outLine: it.name + 'はもうない。',
    });
  };

  /** can c use ability ab in the field right now? → '' or reason */
  Menu.abilityBlock = function (c, abId) {
    const ab = DB.abilities[abId];
    if (!ab) return '使えない';
    if (c.hp <= 0) return '倒れている';
    if (c.mp < R.Rules.mpCost(c, abId)) return 'MPが足りない';
    return '';
  };

  /** field use of an action ability by c → 'exit' | true | false */
  Menu.useAbility = async function (c, abId) {
    const ab = DB.abilities[abId];
    if (!ab) return false;
    const cost = R.Rules.mpCost(c, abId);
    const verb = ab.magic ? 'を唱えた！' : 'を使った！';
    const block = Menu.abilityBlock(c, abId);
    if (block) { R.sfx('buzzer'); await K.msg(block === 'MPが足りない' ? 'MPが足りない！' : c.name + 'は' + block + '。'); return false; }
    const eff = ab.effects || [];
    if (hasType(eff, 'teleport') || hasType(eff, 'exit')) {
      const tp = hasType(eff, 'teleport');
      if (tp ? !(R.Field && R.Field.canTeleport && R.Field.canTeleport()) : !(R.Field && R.Field.canExit && R.Field.canExit())) {
        await K.msg('ここでは使えないようだ。');
        return false;
      }
      let loc = null;
      if (tp) { loc = await chooseTown(); if (!loc) return false; }
      c.mp -= cost;
      afterMenu([c.name + 'は' + ab.name + verb], tp ? { teleport: loc } : { exit: true });
      return 'exit';
    }
    if (hasType(eff, 'repel') && !needsPick(ab.target)) {
      c.mp -= cost;
      const r = Menu.applyFieldEffect(ab, c, [], {});
      R.sfx('magic');
      await K.msg(c.name + 'は' + ab.name + verb + '\n' + r.lines.join('\n'));
      return true;
    }
    if (!needsPick(ab.target)) {
      const targets = ab.target === 'self' ? [c] : R.Game.party.slice();
      if (!targets.some((t) => affects(eff, t))) { await K.msg('今は使う必要がないようだ。'); return false; }
      c.mp -= cost;
      const r = Menu.applyFieldEffect(ab, c, targets, {});
      R.sfx(hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg(c.name + 'は' + ab.name + verb + '\n' + r.lines.join('\n'));
      return true;
    }
    const valid = validFor(ab.target, eff, c);
    // the cursor starts on someone who needs it (the most hurt for heals), not on the caster
    const hurt = R.Game.party.map((t, i) => [t, i]).filter(([t]) => valid(t) && affects(eff, t))
      .sort((a, b) => a[0].hp / R.Rules.stats(a[0]).hp - b[0].hp / R.Rules.stats(b[0]).hp);
    const last = hurt.length ? hurt[0][1] : -1;
    if (last < 0) { await K.msg('今は使う必要がないようだ。'); return false; }
    return repeatPick({
      eff, valid, user: c, def: ab, isItem: false, initial: last,
      title: () => ab.name + (cost ? ' MP' + cost : ''),
      verbLine: c.name + 'は' + ab.name + verb,
      canPay: () => c.hp > 0 && c.mp >= cost,
      spend: () => { c.mp -= cost; },
      outLine: cost ? c.name + 'はMPが足りなくなった。' : '',
    });
  };

  // ------------------------------------------------------------ 満タン (field auto-heal)
  const missing = (c) => (c.hp > 0 ? Math.max(0, R.Rules.stats(c).hp - c.hp) : 0);
  const HEAL_TARGETS = { ally: 1, ally_other: 1, ally_any: 1, self: 1, allies: 1 };
  const onlyHeals = (def) => {
    const e = targetsOf(def && def.effects);
    return HEAL_TARGETS[def.target] && e.some((x) => x.type === 'heal') && e.every((x) => x.type === 'heal' || x.type === 'cure') && !e.some((x) => x.hpCost);
  };
  const curesPoison = (def) => !!HEAL_TARGETS[def.target] && targetsOf(def && def.effects).some((x) => x.type === 'cure' && (x.statuses === 'all' || (x.statuses || []).includes('poison')));
  /** field abilities of c that pass `pred` (HP heals / poison cures / revives) */
  const fieldAbs = (c, pred) => (R.Rules.fieldActions(c) || []).filter((id) => DB.abilities[id] && pred(DB.abilities[id]));
  const plainHeal = (u) => onlyHeals(u) && !targetsOf(u.effects).some((x) => x.pct);
  /** single-target field items for 満タン: plain heals (no %/revive/MP, not rare) or poison cures */
  function fieldItems(pred) {
    return R.State.items((it) => it.type === 'consumable' && !it.rare && it.use && it.use.field && (it.use.target === 'ally' || it.use.target === 'ally_any') && pred(it.use))
      .map((e) => e.id);
  }

  /**
   * Heal the whole party as cheaply as possible (the 満タン command).
   * Phase 'abilities': poison cures, then HP heals by the best HP per MP (ties → the caster with
   * the most MP left); a fallen healer is revived only when no living member can heal.
   * Phase 'items' (only when asked): the cheapest item that covers the gap, poison cures.
   * → log {abs:{key:{c, id, n, mp}}, items:{id:n}, cured:[names], revived:[names]}
   */
  Menu.autoHeal = function (o) {
    const opts = o || {};
    const log = opts.log || { abs: {}, items: {}, cured: [], revived: [] };
    const party = R.Game.party;
    const alive = () => party.filter((c) => c.hp > 0);
    const note = (c, id, cost) => {
      const k = c.id + ':' + id;
      const e = log.abs[k] || (log.abs[k] = { c, id, n: 0, mp: 0 });
      e.n++; e.mp += cost;
    };
    const cast = (c, id, targets) => {
      const ab = DB.abilities[id], cost = R.Rules.mpCost(c, id);
      c.mp -= cost;
      const had = targets.filter((t) => t.status && t.status.poison);
      Menu.applyFieldEffect(ab, c, targets, {});
      for (const t of had) if (!t.status.poison && !log.cured.includes(t.name)) log.cured.push(t.name);
      note(c, id, cost);
    };
    const pay = (c, id) => c.hp > 0 && c.mp >= R.Rules.mpCost(c, id);
    if (!opts.items) {
      for (let guard = 0; guard < 300; guard++) {
        // 1) poison
        const sick = alive().filter((c) => c.status && c.status.poison);
        let done = false;
        if (sick.length) {
          let best = null;
          for (const c of alive()) {
            for (const id of fieldAbs(c, curesPoison)) {
              if (!pay(c, id)) continue;
              const ab = DB.abilities[id], cost = R.Rules.mpCost(c, id);
              const tg = ab.target === 'allies' ? sick : ab.target === 'self' ? (sick.includes(c) ? [c] : []) : sick.filter((t) => ab.target !== 'ally_other' || t !== c).slice(0, 1);
              if (!tg.length) continue;
              const v = tg.length / Math.max(cost, 0.5);
              if (!best || v > best.v * 1.1 || (v > best.v / 1.1 && c.mp > best.c.mp)) best = { c, id, tg, v };
            }
          }
          if (best) { cast(best.c, best.id, best.tg); done = true; }
        }
        if (done) continue;
        // 2) HP
        const need = alive().filter((c) => missing(c) > 0);
        if (!need.length) break;
        let best = null;
        for (const c of alive()) {
          for (const id of fieldAbs(c, onlyHeals)) {
            if (!pay(c, id)) continue;
            const ab = DB.abilities[id], cost = R.Rules.mpCost(c, id);
            const sets = ab.target === 'allies' ? [alive()] : ab.target === 'self' ? [[c]]
              : need.filter((t) => ab.target !== 'ally_other' || t !== c).map((t) => [t]);
            for (const tg of sets) {
              const gain = tg.reduce((sum, t) => sum + Math.min(expectHeal(ab, c, t, false), missing(t)), 0);
              if (gain <= 0) continue;
              const v = gain / Math.max(cost, 0.5);
              // cheapest MP per HP; near-equal ones → the caster with the most MP left, then the bigger heal
              if (!best || v > best.v * 1.1 || (v > best.v / 1.1 && (c.mp > best.c.mp || (c === best.c && gain > best.gain)))) best = { c, id, tg, v, gain };
            }
          }
        }
        if (best) { cast(best.c, best.id, best.tg); continue; }
        // 3) HP still missing and nobody alive can heal it: revive a fallen healer who has the MP (only then)
        const fallen = party.find((c) => c.hp <= 0 && fieldAbs(c, onlyHeals).some((id) => c.mp >= R.Rules.mpCost(c, id)));
        if (!fallen) break;
        let rv = null;
        for (const c of alive()) for (const id of fieldAbs(c, (ab) => targetsOf(ab.effects).some((e) => e.type === 'revive'))) {
          const ab = DB.abilities[id];
          if (ab.target === 'allies' || ab.target === 'self' || !pay(c, id)) continue;
          if (!rv || R.Rules.mpCost(c, id) < rv.cost) rv = { c, id, cost: R.Rules.mpCost(c, id) };
        }
        if (!rv) break;
        cast(rv.c, rv.id, [fallen]);
        if (fallen.hp > 0) log.revived.push(fallen.name);
      }
      return log;
    }
    // items
    const user = itemUser();
    for (let guard = 0; guard < 300; guard++) {
      const sick = alive().find((c) => c.status && c.status.poison);
      if (sick) {
        const ids = fieldItems(curesPoison).filter((id) => R.State.count(id) > 0)
          .sort((a, b) => (DB.items[a].price || 0) - (DB.items[b].price || 0));
        if (ids.length) {
          R.State.removeItem(ids[0], 1);
          Menu.applyFieldEffect(DB.items[ids[0]].use, user, [sick], { item: true });
          log.items[ids[0]] = (log.items[ids[0]] || 0) + 1;
          if (!sick.status.poison && !log.cured.includes(sick.name)) log.cured.push(sick.name);
          continue;
        }
      }
      const need = alive().filter((c) => missing(c) > 0).sort((a, b) => missing(b) - missing(a));
      if (!need.length) break;
      const t = need[0], gap = missing(t);
      const cands = fieldItems(plainHeal).filter((id) => R.State.count(id) > 0)
        .map((id) => ({ id, h: expectHeal(DB.items[id].use, user, t, true), p: DB.items[id].price || 0 }));
      if (!cands.length) break;
      const cover = cands.filter((x) => x.h >= gap).sort((a, b) => a.p - b.p || a.h - b.h);
      const pick = cover[0] || cands.sort((a, b) => b.h - a.h || a.p - b.p)[0];
      R.State.removeItem(pick.id, 1);
      Menu.applyFieldEffect(DB.items[pick.id].use, user, [t], { item: true });
      log.items[pick.id] = (log.items[pick.id] || 0) + 1;
    }
    return log;
  };

  /** 満タン command: abilities first, items only when the player agrees; then a summary */
  Menu.fullHeal = async function () {
    const party = R.Game.party;
    const hurt = () => party.some((c) => missing(c) > 0 || (c.hp > 0 && c.status && c.status.poison));
    if (!hurt()) { await K.msg('みんな元気いっぱいだ。'); return false; }
    const log = Menu.autoHeal();
    const casts = Object.keys(log.abs).length;
    if (casts) R.sfx('heal');
    let asked = false;
    if (hurt() && (fieldItems(plainHeal).length || (party.some((c) => c.hp > 0 && c.status && c.status.poison) && fieldItems(curesPoison).length))) {
      asked = true;
      const why = casts ? 'アビリティだけでは回復しきれなかった。' : '回復できるアビリティがない。';
      if (await K.yesno(why + '\n道具も使いますか？')) {
        const before = JSON.stringify(log.items);
        Menu.autoHeal({ items: true, log });
        if (JSON.stringify(log.items) !== before) R.sfx('heal');
      }
    }
    await summary(log, asked);
    return casts > 0 || Object.keys(log.items).length > 0;
  };

  async function summary(log, asked) {
    const party = R.Game.party;
    const lines = [];
    for (const k of Object.keys(log.abs)) {
      const e = log.abs[k];
      lines.push({ t: e.c.name + '：' + abName(e.id) + '×' + e.n, r: e.mp ? 'MP ' + e.mp : '' });
    }
    for (const id of Object.keys(log.items)) lines.push({ t: '道具：' + itemName(id) + '×' + log.items[id], r: '残り' + R.State.count(id) });
    if (!lines.length) lines.push({ t: asked ? '何も使わなかった。' : '回復する手段がない。', gray: true });
    const foot = [];
    if (log.revived.length) foot.push({ t: log.revived.join('、') + 'が生き返った！', c: G().C.green });
    if (log.cured.length) foot.push({ t: log.cured.join('、') + 'の毒が治った！', c: G().C.green });
    const left = party.filter((c) => missing(c) > 0);
    const dead = party.filter((c) => c.hp <= 0);
    const sick = party.filter((c) => c.hp > 0 && c.status && c.status.poison);
    if (!left.length && !sick.length) foot.push({ t: dead.length ? '動ける仲間のHPは満タンになった！' : '全員のHPが満タンになった！', c: G().C.yellow });
    else if (left.length) foot.push({ t: left.map((c) => c.name).join('、') + 'は回復しきれなかった。', c: G().C.hpLow });
    if (sick.length) foot.push({ t: sick.map((c) => c.name).join('、') + 'は毒のままだ。', c: G().C.purple });
    if (dead.length) foot.push({ t: dead.map((c) => c.name).join('、') + 'は倒れている。', c: G().C.dead });
    await R.Engine.run(new SummaryLayer(lines, foot));
  }

  class SummaryLayer extends Screen {
    constructor(lines, foot) { super(); this.lines = lines.slice(0, 9); this.foot = foot.slice(0, 4); }
    input() { if (In().pressed('a') || In().pressed('b')) { R.sfx('confirm'); this.close(); } }
    render() {
      const x = 4, w = R.W - 8;
      const h = 22 + this.lines.length * 14 + (this.foot.length ? 6 + this.foot.length * 14 : 0);
      const y = Math.max(4, R.H - 6 - h);
      G().window(x, y, w, h, { title: '満タン' });
      let yy = y + 10;
      for (const l of this.lines) {
        K.fitText(l.t, x + 12, yy, w - 80, { color: l.gray ? G().C.gray : G().C.white });
        if (l.r) G().text(l.r, x + w - 12, yy, { align: 'right', color: G().C.cyan });
        yy += 14;
      }
      if (this.foot.length) {
        yy += 2;
        G().rect(x + 8, yy, w - 16, 1, '#50587c');
        yy += 4;
        for (const f of this.foot) { K.fitText(f.t, x + 12, yy, w - 24, { color: f.c }); yy += 14; }
      }
      if (Math.floor(R.Engine.frame / 20) % 2) G().cursor(x + w - 14, y + h - 12, true);
    }
  }

  // ------------------------------------------------------------ main menu
  const COMMANDS = [
    { id: 'items', label: '道具' }, { id: 'fullheal', label: '満タン' },
    { id: 'abilities', label: 'アビリティ' }, { id: 'jobs', label: 'ジョブ' },
    { id: 'set', label: 'セット' }, { id: 'equip', label: '装備' },
    { id: 'status', label: '強さ' }, { id: 'order', label: '並び替え' },
    { id: 'warp', label: 'ワープ' }, { id: 'escape', label: '脱出' },
    { id: 'map', label: '地図' }, { id: 'book', label: '図鑑' },
    { id: 'save', label: 'セーブ' }, { id: 'settings', label: '設定' },
  ];
  // ワープ / 脱出 are basic commands every party can use for free (no job or MP needed)
  const canWarp = () => !!(R.Field && R.Field.canTeleport && R.Field.canTeleport());
  const canEscape = () => !!(R.Field && R.Field.canExit && R.Field.canExit());
  const onWorld = () => !!(R.Field && R.Field.map && R.Field.map.isWorld);
  let lastCmd = 0;

  class MainMenu extends Screen {
    constructor() {
      super();
      this.list = new R.UI.List({
        x: 4, y: 4, w: 138, cols: 2, rows: 7, lineH: 13, padX: 13, padY: 7, index: lastCmd,
        items: COMMANDS.map((c) => ({
          label: c.label,
          disabled: (c.id === 'map' && !(onWorld() && R.Minimap && R.Minimap.open)) ||
            (c.id === 'warp' && !canWarp()) || (c.id === 'escape' && !canEscape()),
        })),
        onChange: (i) => { lastCmd = i; },
      });
    }
    input() {
      const r = this.list.update();
      if (r === 'cancel') this.close();
      else if (r === 'select') {
        const cmd = COMMANDS[this.list.index].id;
        lastCmd = this.list.index;
        this.flow(() => this.run(cmd));
      }
    }
    async run(cmd) {
      const screens = {
        items: Menu.itemScreen, abilities: Menu.abilityScreen, equip: Menu.equipScreen, jobs: Menu.jobScreen,
        set: Menu.setScreen, status: Menu.statusScreen, order: Menu.orderScreen, book: Menu.bookScreen,
        save: Menu.saveScreen, settings: Menu.settings,
      };
      if (cmd === 'fullheal') { await Menu.fullHeal(); return; }
      if (cmd === 'warp') {
        const id = await chooseTown();
        if (!id) return;
        afterMenu(['{leader}たちは光に包まれた！'], { teleport: id });
        this.close('exit');
        return;
      }
      if (cmd === 'escape') {
        afterMenu(['{leader}たちはダンジョンを脱出した！'], { exit: true });
        this.close('exit');
        return;
      }
      if (cmd === 'map') {
        this.hidden = true;
        try { await R.Minimap.open(); } finally { this.hidden = false; }
        return;
      }
      const fn = screens[cmd];
      if (typeof fn !== 'function') { R.sfx('buzzer'); return; }
      this.hidden = true;
      let res;
      try { res = await fn({ fromMenu: true }); } finally { this.hidden = false; }
      if (res === 'exit' || Menu._after) this.close('exit');
    }
    // compact layout: commands + gold + objective down the left, one slim party window top-right;
    // the field stays visible on the right and below
    render() {
      this.list.draw();
      const top = this.list.y + this.list.h + 2;
      const gh = drawGold(4, top, 138);
      drawParty(158, 4);
      drawObjective(4, top + gh + 2, 138, 4);
    }
  }

  /** gold + play time on one line (★称号 below when earned); returns the window height */
  function drawGold(x, y, w) {
    const title = R.Game.title; // 称号 earned in the post-game
    const h = title ? 34 : 20;
    G().window(x, y, w, h);
    G().text(R.Game.gold + ' G', x + 10, y + 4);
    G().text(U.playTime(R.Game.playFrames || 0), x + w - 10, y + 4, { align: 'right', color: G().C.gray });
    if (title) K.fitText('★' + title, x + 10, y + 18, w - 20, { color: G().C.gold });
    return h;
  }
  Menu.drawGold = drawGold;

  /** one window: name + Lv, then H / M, per member (DQ style) */
  function drawParty(x, y) {
    const w = 94, rowH = 30, n = R.Game.party.length;
    G().window(x, y, w, 8 + n * rowH + 2);
    R.Game.party.forEach((c, i) => {
      const yy = y + 5 + i * rowH;
      const col = K.condColor(c);
      K.fitText(c.name, x + 8, yy, w - 44, { color: col });
      G().text('Lv' + c.level, x + w - 8, yy, { align: 'right', color: col });
      G().text('H', x + 8, yy + 13, { color: G().C.gray });
      G().text(String(c.hp), x + 44, yy + 13, { align: 'right', color: col });
      G().text('M', x + 50, yy + 13, { color: G().C.gray });
      G().text(String(c.mp), x + w - 8, yy + 13, { align: 'right', color: col });
    });
  }
  Menu.drawParty = drawParty;

  function objectiveText() {
    const o = DB.objectives && R.Game.objective && DB.objectives[R.Game.objective];
    return o && o.text ? String(o.text) : '';
  }
  function drawObjective(x, y, w, maxLines) {
    const t = objectiveText();
    if (!t) return;
    const lines = G().wrap(t, w - 22).slice(0, maxLines || 4);
    G().window(x, y, w, 16 + lines.length * 14 - 2 + 2, { title: '次の目的' });
    lines.forEach((l, i) => G().text(l, x + 11, y + 9 + i * 14));
  }

  // ------------------------------------------------------------ public API
  let opened = null; // the live MainMenu layer
  /** open the field menu (B on the field); resolves when it closes */
  Menu.open = async function () {
    if ((opened && R.Engine.layers.includes(opened)) || !R.Game) return;
    Menu._after = null;
    R.sfx('menu_open');
    const L = (opened = new MainMenu());
    try {
      await R.Engine.run(L);
    } finally { if (opened === L) opened = null; }
    const after = Menu._after;
    Menu._after = null;
    if (after) await after();
  };
  Menu.isOpen = () => !!(opened && R.Engine.layers.includes(opened));
})(window.RPG);
