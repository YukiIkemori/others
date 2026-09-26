// Event runtime (DESIGN §3.3.11): runs R.DB.events[id].run(ev) scripts with the
// `ev` API. Events are serialised (one at a time; the field is frozen while any
// is queued or running). Consecutive ev.say calls share one message window; it
// closes before battles, warps, shops, menus and at the end of the event.
//
//   R.Events.run(id | async (ev) => {...}, ctx)   → Promise(result)
//   ctx: {self, npc, trigger:'talk'|'step'|'examine'|'enter', once:'flag', x, y}
//   `once`: skipped while the flag is set; set automatically when the event
//   finishes normally (not when it returned false, errored, ended in a wipe,
//   or a battle in it was escaped) — so lost/escaped boss fights retry.
//
// Also here: the stage layer behind ev.caption (§11.6.5) and the chapter scene
// of ev.clearRegion (§11.6.6), NPC / sign text forms (§3.2.4), and the money word.
(function (R) {
  'use strict';
  const DB = R.DB;

  const ABORT = { eventAbort: true }; // thrown to end an event after a wipe / a new game
  const GOLD = 'ゴールド'; // the currency word (DESIGN §3.3.10-9): the one place it is written in code

  let queue = Promise.resolve();
  let pending = 0; // queued + running events
  let current = null; // ctx of the event that is executing
  let gen = 0; // bumped by reset(): events of an older generation abort at their next ev call

  const fmt = (text) => (R.Text && R.Text.fmt ? R.Text.fmt(text) : String(text == null ? '' : text));
  const closeWin = () => { if (R.UI && R.UI.closeMessage) R.UI.closeMessage(); };
  const hero = () => (R.Game ? (R.State.hero ? R.State.hero() : null) || R.Game.party.find((c) => c.id === 'hero') || R.Game.party[0] : null);
  const leaderName = () => (R.Game ? R.State.leader().name : '');

  /** width of the message window's text area (logical px) */
  function msgWidth() {
    const M = R.UI && R.UI.MSG;
    return M ? M.w - M.pad * 2 : 220;
  }
  function textW(s) {
    try { if (R.Gfx.ctx) return R.Gfx.textWidth(s); } catch (e) { /* no canvas (node tools) */ }
    return R.Text && R.Text.approxWidth ? R.Text.approxWidth(s) : String(s).length * (32 / 3);
  }
  /**
   * Join message phrases, starting a new line only where the next phrase would
   * overflow the message window, so long names break at a phrase boundary:
   *   lines('{leader}は', '日の出の剣を', '手に入れた！')
   */
  function lines(...parts) {
    const w = msgWidth(), out = [];
    let line = '';
    for (const p of parts) {
      if (!p) continue;
      if (line && textW(line + p) > w) { out.push(line); line = p; } else line += p;
    }
    out.push(line);
    return out.join('\n');
  }
  /** 「〇〇を手に入れた！」 phrases: item (+ count) and the verb, for lines() */
  function gotPhrases(itemName, n, verb) {
    return [itemName + 'を', (n > 1 ? n + '個' : '') + verb];
  }
  /** message + jingle together; resolves when both are done (the "got item" fanfare) */
  function gotItem(text, jingleId) {
    const j = R.jingle(jingleId);
    return Promise.all([R.UI.say(text, { keep: true }), j]);
  }
  /** the jingle for an item (DESIGN §11.6.3): key → keyitem, 超レア → superrare, レア → rare, else item */
  function itemJingle(it) {
    if (!it) return 'item';
    if (it.type === 'key') return 'keyitem';
    if (it.grade === 'super') return 'superrare';
    if (it.grade === 'rare') return 'rare';
    return 'item';
  }
  /** the mark before an item's name in messages (§8.2.8, STYLE_JA §9): ◆ for a one-off reward
   *  (`unique`), ★ for レア・超レア, none for the rest — the same rule as the menus' itemLabel */
  function itemMark(it) {
    if (!it) return '';
    if (it.unique) return '◆';
    return it.grade === 'rare' || it.grade === 'super' ? '★' : '';
  }

  /**
   * NPC / sign text (DESIGN §3.2.4): a string ('\f' separates pages), an array of pages, or an
   * array of {cond, text} picked top-down (the first whose cond holds; no cond = always).
   * Returns a string / page array, or null when nothing applies.
   */
  function pickText(t) {
    if (t == null) return null;
    if (typeof t === 'string') return t;
    if (!Array.isArray(t)) return typeof t === 'object' && 'text' in t ? (R.State.check(t.cond) ? pickText(t.text) : null) : String(t);
    if (t.length && t[0] && typeof t[0] === 'object' && !Array.isArray(t[0])) {
      for (const e of t) if (e && R.State.check(e.cond)) return pickText(e.text);
      return null;
    }
    return t;
  }

  // ------------------------------------------------------------ stage (captions, the chapter scene)
  // A see-through layer that darkens the screen and draws big centred text and a few sprites.
  // On a black screen (a fade-out that has finished) it takes the fade over, so captions show
  // 「暗転のまま」 (§10.7 P1), and gives it back when it closes.
  const BAND = { y: 76, h: 72 }; // §11.6.5
  class StageLayer extends R.Layer {
    constructor(dim) {
      super();
      this.opaque = false;
      this.isStage = true; // the field hides its map-name banner under a stage
      this.dim = 0; this.dimFrom = 0; this.dimTo = 0; this.dimT = 0; this.dimDur = 1;
      this.base = dim == null ? 0.6 : dim;
      this.fadeTaken = 0;
      const E = R.Engine;
      if (E.fadeAlpha > 0 && !E._fade) { this.fadeTaken = E.fadeAlpha; this.dim = E.fadeAlpha; E.fadeAlpha = 0; }
      this.cap = null; // {lines, size, lh, alpha, hi, color, pos}
      this.els = []; // {img, x, y, scale, alpha} drawn centred at (x,y)
      this.line = null; // {x0, x1, y}: the white pen line of the chapter scene
      this.waitA = null;
      this.t = 0;
    }
    /** animate the darkness to `to` over n frames */
    dimTo_(to, n) {
      this.dimFrom = this.dim; this.dimTo = Math.max(to, this.fadeTaken); this.dimT = 0; this.dimDur = Math.max(1, n | 0);
      if (n <= 0) this.dim = this.dimTo;
      return R.Engine.wait(Math.max(0, n | 0));
    }
    tick() {
      this.t++;
      if (this.dimT < this.dimDur) { this.dimT++; this.dim = this.dimFrom + (this.dimTo - this.dimFrom) * (this.dimT / this.dimDur); }
      if (this.cap && this.cap.fade) {
        const c = this.cap;
        c.alpha = Math.max(0, Math.min(1, c.alpha + c.fade));
      }
    }
    update() {
      if (this.waitA && (R.Input.pressed('a') || R.Input.pressed('b'))) { const r = this.waitA; this.waitA = null; R.sfx('confirm_soft'); r(true); }
    }
    /** resolve on A/B, or after n frames (whichever first) */
    wait(n) {
      return new Promise((res) => {
        let done = false;
        const fin = (v) => { if (!done) { done = true; this.waitA = null; res(v); } };
        this.waitA = fin;
        R.Engine.wait(n).then(() => fin(false));
      });
    }
    setCaption(text, o) {
      o = o || {};
      const size = o.size === 16 ? 16 : null;
      const lh = size ? 20 : 14, max = size ? 3 : 4;
      const s = fmt(text);
      let ls = [];
      for (const para of s.split('\n')) {
        const w = R.Gfx.ctx ? R.Gfx.wrap(para, 232, size || undefined) : [para];
        ls = ls.concat(w);
      }
      if (ls.length > max) ls = ls.slice(0, max);
      this.cap = { lines: ls, size, lh, alpha: 0, fade: 0.1, hi: o.highlight ? fmt(o.highlight) : null, color: o.color || '#ffffff', hiColor: o.hiColor || R.Gfx.C.gold, pos: o.pos || 'middle' };
    }
    hideCaption() { if (this.cap) this.cap.fade = -0.1; return R.Engine.wait(10); }
    close(v) {
      if (this.fadeTaken > 0) R.Engine.fadeAlpha = Math.max(R.Engine.fadeAlpha, this.fadeTaken);
      super.close(v);
    }
    draw() {
      const G = R.Gfx, c = G.ctx;
      if (this.dim > 0) { c.globalAlpha = Math.min(1, this.dim); G.rect(0, 0, R.W, R.H, '#000'); c.globalAlpha = 1; }
      if (this.line && this.line.x1 > this.line.x0) G.rect(Math.round(this.line.x0), this.line.y, Math.round(this.line.x1 - this.line.x0), 1, '#ffffff');
      for (const e of this.els) {
        if (!e.img) continue;
        const k = e.scale || 1, w = e.img.width * k, h = e.img.height * k;
        const a = c.globalAlpha;
        if (e.alpha != null) c.globalAlpha = a * e.alpha;
        c.imageSmoothingEnabled = false;
        c.drawImage(e.img, Math.round(e.x - w / 2), Math.round(e.y - h / 2), w, h);
        c.globalAlpha = a;
      }
      const cap = this.cap;
      if (cap && cap.alpha > 0) {
        const bandY = cap.pos === 'top' ? 20 : cap.pos === 'bottom' ? 140 : BAND.y;
        const top = bandY + Math.round((BAND.h - cap.lines.length * cap.lh) / 2);
        cap.lines.forEach((ln, i) => drawLine(ln, top + i * cap.lh + (cap.lh - (cap.size || G.FS)) / 2, cap));
      }
    }
  }
  function drawLine(ln, y, cap) {
    const G = R.Gfx;
    const o = { size: cap.size || undefined, alpha: cap.alpha, shadow: '#000' };
    const hi = cap.hi && ln.indexOf(cap.hi) >= 0 ? cap.hi : null;
    if (!hi) { G.text(ln, R.W / 2, y, Object.assign({ align: 'center', color: cap.color }, o)); return; }
    const k = ln.indexOf(hi), a = ln.slice(0, k), b = ln.slice(k + hi.length);
    const wa = G.textWidth(a, o.size), wh = G.textWidth(hi, o.size), wb = G.textWidth(b, o.size);
    let x = Math.round(R.W / 2 - (wa + wh + wb) / 2);
    G.text(a, x, y, Object.assign({ color: cap.color }, o)); x += wa;
    G.text(hi, x, y, Object.assign({ color: cap.hiColor }, o)); x += wh;
    G.text(b, x, y, Object.assign({ color: cap.color }, o));
  }
  function pushStage(dim) {
    const st = new StageLayer(dim);
    R.Engine.push(st);
    return st;
  }
  /** ev.caption: a big centred caption on a darkened screen; A goes on (§11.6.5) */
  async function caption(text, opts) {
    const o = Object.assign({ frames: 150, pos: 'middle' }, opts || {});
    closeWin();
    const st = pushStage(o.dim);
    try {
      await st.dimTo_(st.base, 12);
      st.setCaption(text, o);
      await R.Engine.wait(10);
      await st.wait(Math.max(1, o.frames - 10));
      await st.hideCaption();
      await st.dimTo_(0, 12);
    } finally { st.close(); }
  }
  /** the image for an obj key, or its stand-in (§11.2.12) scaled to the same size */
  function objImage(key, fallback, frame) {
    const G = R.Gfx;
    if (!G.ctx) return null; // no canvas (node tools): the scene runs without pictures
    const k = G.has(key) ? key : G.has(fallback) ? fallback : null;
    if (!k) return null;
    let g = null;
    try { g = G.get(k); } catch (e) { return null; }
    if (Array.isArray(g)) return g[(frame || 0) % g.length];
    if (g && !g.width && typeof g === 'object') { const a = g.down || g[Object.keys(g)[0]]; return Array.isArray(a) ? a[0] : a; }
    return g;
  }

  // ------------------------------------------------------------ party helpers (fallbacks while rules/newgame are partial)
  function isRecruited(id) {
    if (R.Party && R.Party.isRecruited) return R.Party.isRecruited(id);
    const g = R.Game;
    return !!(g && (g.party.some((c) => c.id === id) || (g.reserve || []).some((c) => c.id === id)));
  }
  function doRecruit(id, o) {
    if (R.Party && R.Party.recruit) return R.Party.recruit(id, o);
    const g = R.Game;
    if (isRecruited(id)) return R.State.char ? R.State.char(id) : null;
    let c = null;
    try { c = R.Rules.newChar({ id }); } catch (e) { c = null; }
    if (!c) { R.warn('ev.recruit: cannot build ' + id); return null; }
    g.reserve = g.reserve || [];
    if (g.party.length < (R.PARTY_MAX || 4) && !(o && o.toParty === false)) g.party.push(c); else g.reserve.push(c);
    R.State.setFlag('joined_' + id);
    R.emit('recruit', c);
    return c;
  }
  /** 「{name}が仲間に加わった！」 + the join line (+ 「控えで待っている。」), jingle `recruit` (§5.5.2) */
  async function announceJoin(c, jingle) {
    if (!c) return;
    const def = (DB.companions && DB.companions[c.id]) || {};
    const j = jingle ? R.jingle('recruit') : null;
    let text = c.name + 'が仲間に加わった！';
    if (def.joinLine) text += '\f' + def.joinLine;
    if ((R.Game.reserve || []).includes(c)) text += '\f' + c.name + 'は控えで待っている。';
    await Promise.all([R.UI.say(text, { keep: true }), j]);
  }

  function makeEv(ctx) {
    const st = { battles: [] };
    const field = () => R.Field;
    const ev = {
      ctx,
      self: ctx.self != null ? ctx.self : null,
      get map() { return field() && field().map ? field().map.id : null; },
      get leader() { return leaderName(); },
      /** the hero's CharState (read only) */
      get hero() { return hero(); },
      /** R.Battle.last (the last battle's result) */
      get lastBattle() { return R.Battle ? R.Battle.last || null : null; },

      // ------------------------------------------------------------ text
      /** opts as R.UI.say (keep is on); opts.voice:'v_<speaker>_<scene>_<nn>' plays assets/voice/<id>.* with
       *  the line (fixed story characters only, BRIEF A9; list: node tools/voice_script.js) */
      async say(text, opts) {
        const t = pickText(text);
        if (t == null) return;
        if (Array.isArray(t)) {
          // opts.voice: an array gives one line per text, a single id belongs to the first text only
          const v = opts && opts.voice;
          for (let i = 0; i < t.length; i++) {
            const o = v ? Object.assign({}, opts, { voice: Array.isArray(v) ? v[i] : i === 0 ? v : null }) : opts;
            await ev.say(t[i], o);
          }
          return;
        }
        await R.UI.say(t, Object.assign({ keep: true }, opts));
      },
      async ask(text, choices, opts) {
        if (text) await R.UI.say(text, { noWait: true });
        return R.UI.choose(choices, opts || {});
      },
      async yesno(text) { return R.UI.yesno(text); },
      gotItem(text, jingleId) { return gotItem(text, jingleId); },
      closeMessage: closeWin,
      /** big centred caption (§11.6.5): {frames = 150, pos:'middle', size, highlight} */
      caption(text, opts) { return caption(text, opts); },

      // ------------------------------------------------------------ state (sync)
      flag(name) { return R.State.flag(name); },
      setFlag(name, v = true) { R.State.setFlag(name, v); },
      check(cond) { return R.State.check(cond); },
      var(name) { return R.State.getVar(name); },
      setVar(name, n) { R.State.setVar(name, n); },
      has(item, n = 1) { return R.State.hasItem(item, n); },
      take(item, n = 1) { return R.State.removeItem(item, n); },
      gold() { return R.Game.gold; },
      takeGold(n) { return R.State.takeGold(n); },
      tier() { return R.Tier && R.Tier.current ? R.Tier.current() : (R.Game.tier || 0); },
      cleared(regionId) { return R.Tier && R.Tier.isCleared ? R.Tier.isCleared(regionId) : (R.Game.regionsCleared || []).includes(regionId); },
      inParty(id) { return R.Game.party.some((c) => c.id === id); },
      recruited(id) { return isRecruited(id); },
      /** pick by the hero's gender */
      g(male, female) { const h = hero(); return h && h.gender === 'f' ? female : male; },

      /** 「{leader}は✕✕を手に入れた！」 + jingle by kind and grade (§11.6.3) */
      async give(item, n = 1, opts) {
        const o = opts || {};
        const it = DB.items[item];
        if (!it) { R.warn('ev.give: unknown item', item); return false; }
        if (R.State.count(item) + n > 99) {
          if (!o.silent) await ev.say(lines('{leader}は', it.name + 'を', '受け取ろうとした。') + '\nこれ以上は持てない。');
          return false;
        }
        R.State.addItem(item, n);
        if (!o.silent) await gotItem(lines('{leader}は', ...gotPhrases(itemMark(it) + it.name, n, '手に入れた！')), itemJingle(it));
        return true;
      },
      async giveGold(n, opts) {
        R.State.addGold(n);
        if (opts && opts.silent) return;
        R.sfx('gold');
        await ev.say(lines('{leader}は', n + GOLD + 'を', '手に入れた！'));
      },

      // ------------------------------------------------------------ battle
      /** → 'win' | 'lose' | 'escape'. Options as R.Battle.start (§3.3.8): canLose, noEscape, noRare,
       *  noGolden, bgm, bg, glimmerForce, members, lvOff. A lost battle without canLose ends this
       *  event (no once flag, the event count unwinds) and the field then runs the wipe (§4.12.2). */
      async battle(troopId, opts) {
        const o = Object.assign({}, opts || {});
        closeWin();
        if (troopId && typeof troopId === 'object') Object.assign(o, troopId);
        else if (troopId) o.troop = troopId;
        if (o.troop && !DB.troops[o.troop]) R.warn('ev.battle: unknown troop', o.troop);
        if (!R.Battle || !R.Battle.start) { R.warn('ev.battle: battle system missing'); st.battles.push('win'); return 'win'; }
        const troop = o.troop && DB.troops[o.troop];
        if (!o.bg) o.bg = (troop && troop.bg) || (field() && field().battleBg ? field().battleBg(o.zone) : undefined);
        const f = field(), lay = f && f.layer;
        if (lay) lay.locks++;
        let res;
        try { res = await R.Battle.start(o); } finally { if (lay) lay.locks = Math.max(0, lay.locks - 1); }
        // no random battle in the first 6 steps after any battle (§4.11.1)
        if (lay && lay.resetEnc && f.map) lay.resetEnc();
        st.battles.push(res);
        if (res === 'lose') {
          if (o.canLose) {
            for (const c of R.Game.party) if (c.hp <= 0) { c.hp = 1; c.status = {}; }
            return 'lose';
          }
          // always through the field's wipe flow (§4.12.2): it runs once this event has unwound and
          // holds the respawn map's onEnter back until the wake-up window is done. Never call
          // R.GameOver.run() from here (the respawn's onEnter could close the wake-up window).
          if (f && f.requestWipe) f.requestWipe();
          else if (f && f.gameOver) f.gameOver();
          else R.warn('ev.battle: lost, but no field wipe flow (R.Field.requestWipe) to run');
          throw ABORT;
        }
        return res;
      },

      // ------------------------------------------------------------ movement & screen
      warp(map, spawn, opts) { closeWin(); return field().warp(map, spawn, opts); },
      wait(frames) { return R.Engine.wait(frames | 0); },
      fadeOut(f = 20) { closeWin(); return R.Engine.fadeOut(f); },
      fadeIn(f = 20) { return R.Engine.fadeIn(f); },
      shake(f = 20, mag = 3) { R.Engine.shake(f, mag); return R.Engine.wait(f); },
      flash(color = '#ffffff', f = 8) { R.Engine.flashScreen(color, f); return R.Engine.wait(f); },
      sfx(id) { R.sfx(id); },
      /** play a track; bgm() with no id restores the current map's music */
      bgm(id, opts) {
        const m = field() && field().map;
        R.bgm(id || (m ? (R.Game.onShip ? 'sea' : m.bgm) : null), opts);
      },
      jingle(id) { return R.jingle(id); },

      npc(id) {
        const get = () => field().npc(id);
        if (!get()) R.warn('ev.npc: no npc "' + id + '" on map ' + ev.map);
        const h = {
          get x() { const n = get(); return n ? n.x : null; },
          get y() { const n = get(); return n ? n.y : null; },
          get dir() { const n = get(); return n ? n.dir : null; },
          get visible() { const n = get(); return !!(n && n.present); },
          face(dir) {
            const n = get();
            if (!n) return h;
            if (dir === 'player') {
              const p = field().pos();
              dir = Math.abs(p.x - n.x) > Math.abs(p.y - n.y) ? (p.x > n.x ? 'right' : 'left') : (p.y > n.y ? 'down' : 'up');
            }
            if (R.U.DX[dir] !== undefined) n.dir = dir;
            return h;
          },
          walk(path, frames) { return field().walkNpc(get(), path, frames); },
          hide() { const n = get(); if (n) { n.hidden = true; n.forced = false; n.present = false; n.mv = null; } return h; },
          show() { const n = get(); if (n) { n.hidden = false; n.forced = true; n.present = true; } return h; },
          setPos(x, y, dir) {
            const n = get();
            if (n) { n.x = x; n.y = y; n.homeX = x; n.homeY = y; n.mv = null; if (dir) n.dir = dir; }
            return h;
          },
        };
        return h;
      },
      player: {
        get x() { return R.Field.pos().x; },
        get y() { return R.Field.pos().y; },
        get dir() { return R.Field.pos().dir; },
        face(dir) { R.Field.facePlayer(dir); },
        walk(path, frames) { return R.Field.walkParty(path, frames); },
        setPos(x, y, dir) { R.Field.setPlayerPos(x, y, dir); },
      },

      // ------------------------------------------------------------ services
      heal() { R.State.healAll({ reserve: true }); },
      /** the inn; price defaults to R.Tier.innPrice() (§4.12.3) → bool */
      async inn(price) {
        closeWin();
        const p = price != null ? price : innPrice();
        const ok = R.Shop && R.Shop.inn ? await R.Shop.inn(p) : await fallbackInn(ev, p);
        return !!ok;
      },
      /** 休息の灯 (§11.6.4): full HP/MP/WP and revive, white flash, the fixed line */
      async rest() {
        R.sfx('heal');
        R.Engine.flashScreen('#ffffff', 8);
        R.State.healAll({ reserve: true });
        await ev.say('灯の光に包まれて、\n疲れが消えていく……。');
      },
      async shop(shopId) {
        closeWin();
        if (R.Shop && R.Shop.open) return R.Shop.open(shopId);
        R.warn('ev.shop: shop system missing', shopId);
        return null;
      },
      async saveMenu() {
        closeWin();
        if (R.Menu && R.Menu.saveMenu) return R.Menu.saveMenu();
        if (R.Menu && R.Menu.save) return R.Menu.save();
        return quickSave(ev);
      },
      /** setObjective(id, {region}): with region it becomes that region's objective (年代記), else the global one */
      setObjective(id, opts) {
        if (!DB.objectives || !DB.objectives[id]) R.warn('ev.setObjective: unknown objective', id);
        const region = opts && opts.region;
        if (region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[region] = id; }
        else R.Game.objective = id;
        R.emit('objective', id, region || null);
      },
      /** the explicit respawn point (default: here) */
      setRespawn(map, spawn) {
        if (map) R.Game.respawn = { map, spawn: spawn || 'entrance' };
        else field().setRespawnHere();
      },
      giveShip(worldSpawnName) {
        const wid = R.FieldMap.findWorld(worldSpawnName);
        const p = wid && R.FieldMap.spawnPos(worldSpawnName, wid);
        if (!p) { R.warn('ev.giveShip: unknown world spawn', worldSpawnName); return; }
        R.Game.ship = { map: wid, x: p.x, y: p.y, dir: p.dir || 'down' };
      },
      refresh() { field().refresh(); },
      async ending() {
        closeWin();
        if (R.Ending && R.Ending.start) return R.Ending.start();
        R.warn('ev.ending: ending system missing');
        return null;
      },
      /** run another event's script inline (shares this window) */
      call(id) { return runInline(id, Object.assign({}, ctx, { self: ctx.self })); },

      // ------------------------------------------------------------ Chronicle additions (§3.3.11)
      /** make the hero anew with R.CharCreate (name, gender, type, favour); progress stays; flag hero_created */
      async createHero() {
        closeWin();
        const g = R.Game;
        if (!R.CharCreate || !R.CharCreate.run) {
          R.warn('ev.createHero: R.CharCreate missing');
          R.State.setFlag('hero_created');
          return hero();
        }
        const spec = await R.CharCreate.run({ cancel: false });
        if (!spec) return null;
        let c = null;
        if (R.State.setHero) c = R.State.setHero(spec);
        else {
          const old = hero();
          try { c = R.Rules.newChar({ id: 'hero', heroSpec: spec }); } catch (e) { c = null; }
          if (!c) { R.warn('ev.createHero: R.Rules.newChar failed'); return null; }
          if (old) {
            c.level = old.level; c.exp = old.exp;
            if (old.counts) c.counts = old.counts;
            if (old.joined) c.joined = old.joined;
          }
          try { const s = R.Rules.stats(c); c.hp = s.hp; c.mp = s.mp; c.wp = s.wp; } catch (e) { /* keep */ }
          const i = old ? g.party.indexOf(old) : -1;
          if (i >= 0) g.party[i] = c; else g.party.unshift(c);
          if (R.State.noteLearned) for (const a of (c.techs || []).concat(c.spells || [])) R.State.noteLearned('hero', a);
        }
        R.State.setFlag('hero_created');
        R.emit('partyChange');
        if (field()) field().refresh();
        return c;
      },
      /** the first companions: R.Tavern.chooseStart → recruit each (join lines, jingle once) → ids */
      async chooseCompanions(opts) {
        const count = (opts && opts.count) || 3;
        closeWin();
        if (!R.Tavern || !R.Tavern.chooseStart) { R.warn('ev.chooseCompanions: R.Tavern missing'); return []; }
        const ids = (await R.Tavern.chooseStart({ count })) || [];
        let first = true;
        for (const id of ids) {
          if (isRecruited(id)) continue; // the tavern screen recruited (and announced) them itself
          const c = doRecruit(id, { toParty: true });
          await announceJoin(c, first);
          first = false;
        }
        closeWin();
        ev.bgm();
        if (field()) field().refresh();
        return ids;
      },
      /** the tavern (swap, recruit, order and rows): R.Tavern.open */
      async tavern(opts) {
        const recruit = !(opts && opts.recruit === false);
        closeWin();
        if (!R.Tavern || !R.Tavern.open) { R.warn('ev.tavern: R.Tavern missing'); return; }
        await R.Tavern.open({ recruit });
        ev.bgm();
        if (field()) field().refresh();
      },
      /** recruit one companion (join line + jingle `recruit` unless silent) → CharState */
      async recruit(id, opts) {
        if (!DB.companions || !DB.companions[id]) R.warn('ev.recruit: unknown companion', id);
        if (isRecruited(id)) return R.State.char ? R.State.char(id) : null;
        const c = doRecruit(id, {});
        if (!(opts && opts.silent)) await announceJoin(c, true);
        if (field()) field().refresh();
        return c;
      },
      /** a region is cleared: R.Tier.clear, then the chapter scene (§11.6.6) → the new tier */
      async clearRegion(regionId) { return clearRegion(ev, regionId); },
      /** the chronicle screen (menu) */
      async chronicle() {
        closeWin();
        if (R.Menu && R.Menu.chronicleScreen) return R.Menu.chronicleScreen();
        R.warn('ev.chronicle: R.Menu.chronicleScreen missing');
        return null;
      },
    };
    guard(ev, ctx.gen);
    guard(ev.player, ctx.gen);
    return { ev, st };
  }
  /** make every ev method throw ABORT once a newer game generation has started */
  function guard(obj, g) {
    const check = () => { if (g !== gen) throw ABORT; };
    for (const k of Object.keys(obj)) {
      const d = Object.getOwnPropertyDescriptor(obj, k);
      if (!d || typeof d.value !== 'function') continue;
      const fn = d.value;
      obj[k] = function (...a) {
        check();
        const r = fn.apply(this, a);
        return r && typeof r.then === 'function' ? r.then((v) => { check(); return v; }) : r;
      };
    }
  }
  function innPrice() {
    if (R.Tier && R.Tier.innPrice) { try { const p = R.Tier.innPrice(); if (p != null) return p; } catch (e) { /* fall through */ } }
    const tbl = DB.config && DB.config.innPrice;
    const t = R.Game ? (R.Game.gameClear ? 9 : R.Game.tier || 0) : 0;
    return Array.isArray(tbl) && tbl.length ? tbl[Math.min(t, tbl.length - 1)] : 10;
  }

  // ------------------------------------------------------------ region clear (§3.3.11, §10.4, §11.6.6)
  async function clearRegion(ev, id) {
    const g = R.Game;
    const reg = (DB.regions && DB.regions[id]) || null;
    if (!reg) R.warn('ev.clearRegion: unknown region', id);
    const already = R.Tier && R.Tier.isCleared ? R.Tier.isCleared(id) : (g.regionsCleared || []).includes(id);
    if (already) return g.tier;
    if (R.Tier && R.Tier.clear) R.Tier.clear(id);
    else {
      g.regionsCleared = g.regionsCleared || [];
      g.regionsCleared.push(id);
      g.tier = g.regionsCleared.length;
      R.State.setFlag('cleared_' + id);
      R.emit('tier', g.tier, id);
    }
    const n = (g.regionsCleared || []).indexOf(id) + 1 || g.tier;
    const title = (reg && reg.chapter && reg.chapter.title) || (reg && reg.name) || '';
    const page = reg && reg.fragment && DB.items[reg.fragment];
    closeWin();
    const st = pushStage(0.6);
    try {
      // 1. the quill writes across the middle of the screen
      await st.dimTo_(st.base, 14);
      const quill = objImage('obj:quill', 'icon:staff');
      const scale = quill && quill.width <= 8 ? 4 : 2;
      const q = { img: quill, x: R.W / 2 - 40, y: 100, scale };
      st.els.push(q);
      // the pen line runs just under the nib, and grows to wherever the nib is
      const nib = nibOf(quill, scale);
      st.line = { x0: q.x + nib.x, x1: q.x + nib.x, y: 100 + nib.y + 1 };
      R.sfx('quill');
      for (let f = 1; f <= 40; f++) {
        q.x = R.W / 2 - 40 + f * 2;
        q.y = 100 + Math.round(Math.sin(f / 3) * 2);
        st.line.x1 = q.x + nib.x;
        await R.Engine.wait(1);
      }
      await R.Engine.wait(12);
      st.els = []; st.line = null;
      // 2. the chapter caption (title in gold) with the chapter jingle
      const chap = '『' + title + '』';
      st.setCaption('{hero}は年代記に\n第' + n + '章' + chap + 'を書き記した。', { highlight: chap });
      const j = R.jingle('chapter');
      await R.Engine.wait(10);
      await Promise.all([Promise.resolve(j), st.wait(150)]);
      await st.hideCaption();
      // 3. the page floats up; 「〈ページ名〉を手に入れた！」 (given silently: no keyitem jingle)
      if (page) {
        const pg = { img: objImage('obj:page', 'obj:crest_glow', 0), x: R.W / 2, y: 104, scale: 2, alpha: 0 };
        st.els.push(pg);
        R.sfx('page');
        for (let f = 0; f < 40; f++) {
          pg.img = objImage('obj:page', 'obj:crest_glow', Math.floor(f / 6));
          pg.alpha = Math.min(1, f / 14);
          pg.y = 110 - f / 5;
          await R.Engine.wait(1);
        }
        await ev.give(reg.fragment, 1, { silent: true });
        let fr = 40;
        const bob = setIntervalFrames(() => { fr++; pg.img = objImage('obj:page', 'obj:crest_glow', Math.floor(fr / 6)); pg.y = 102 + Math.round(Math.sin(fr / 10) * 2); });
        try { await R.UI.say(page.name + 'を手に入れた！', { keep: false }); } finally { bob.stop(); }
        st.els = [];
      }
      // 4. brighten again
      await st.dimTo_(0, 16);
    } finally { st.close(); }
    closeWin();
    if (R.Field) R.Field.refresh();
    return g.tier;
  }
  /** where the pen touches the page: the lowest opaque pixel of the image (the leftmost one in that
   *  row), as an offset from the image's centre at `scale` (the stage draws images centred) */
  function nibOf(img, scale) {
    const s = scale || 1;
    if (!img || !img.getContext) return { x: -6 * s, y: 7 * s };
    try {
      const w = img.width, h = img.height, d = img.getContext('2d').getImageData(0, 0, w, h).data;
      for (let y = h - 1; y >= 0; y--) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 128) return { x: (x + 0.5 - w / 2) * s, y: (y + 1 - h / 2) * s };
        }
      }
    } catch (e) { /* no pixel access: the default below */ }
    return { x: -6 * s, y: 7 * s };
  }
  /** call fn once per frame until stop() (frame-driven, no timers) */
  function setIntervalFrames(fn) {
    let on = true;
    (async () => { while (on) { await R.Engine.wait(1); if (on) fn(); } })();
    return { stop() { on = false; } };
  }

  // ------------------------------------------------------------ fallbacks (used only when the menu owner's services are absent)
  async function fallbackInn(ev, price) {
    const yes = await ev.yesno('いらっしゃいませ。\nひと晩' + price + GOLD + 'です。\nお泊まりになりますか？');
    if (!yes) { await ev.say('またのお越しをお待ちしております。'); return false; }
    if (!R.State.takeGold(price)) { await ev.say('おや、お金が足りないようですね。'); return false; }
    await ev.say('では、ごゆっくりお休みください。');
    closeWin();
    await R.Engine.fadeOut(30);
    R.State.healAll({ reserve: true });
    await R.jingle('inn');
    await R.Engine.wait(20);
    await R.Engine.fadeIn(30);
    await ev.say('おはようございます。\nいってらっしゃいませ。');
    return true;
  }
  async function quickSave(ev) {
    if (!(await ev.yesno('記録' + ((R.Save.lastSlot || 0) + 1) + 'に書き記しますか？'))) return false;
    const slot = R.Save.lastSlot || 0;
    const ok = await R.Save.save(slot, R.State.serialize());
    if (ok) { await R.jingle('save'); await ev.say('記録' + (slot + 1) + 'に書き記した。'); }
    return ok;
  }

  // ------------------------------------------------------------ runner
  function resolveFn(idOrFn) {
    if (typeof idOrFn === 'function') return idOrFn;
    const def = DB.events[idOrFn];
    if (!def) { R.warn('unknown event', idOrFn); return null; }
    const fn = typeof def === 'function' ? def : def.run;
    if (typeof fn !== 'function') { R.warn('event without run()', idOrFn); return null; }
    return fn;
  }
  async function exec(idOrFn, ctx, inline) {
    const fn = resolveFn(idOrFn);
    if (!fn) return undefined;
    if (ctx.gen == null) ctx.gen = gen;
    if (ctx.onlyOnMap && (!R.Field.map || R.Field.map.id !== ctx.onlyOnMap)) return undefined;
    if (ctx.once && R.State.flag(ctx.once)) return undefined;
    const { ev, st } = makeEv(ctx);
    const prev = current;
    current = ctx;
    let result, ok = false;
    try { result = await fn(ev); ok = true; }
    catch (e) {
      if (e === ABORT) { if (inline) throw e; }
      else { console.error('[event ' + (typeof idOrFn === 'string' ? idOrFn : 'inline') + ']', e); if (R.Engine.reportError) R.Engine.reportError(e); }
    } finally {
      if (ctx.gen === gen) current = prev;
      if (!inline && ctx.gen === gen) closeWin();
    }
    if (ctx.gen !== gen) return undefined;
    if (ok && ctx.once && result !== false && !st.battles.includes('escape') && !R.State.flag(ctx.once)) R.State.setFlag(ctx.once);
    if (!inline && R.Field && R.Field.refresh) R.Field.refresh();
    return result;
  }
  function runInline(idOrFn, ctx) { return exec(idOrFn, ctx || {}, true); }

  const Events = (R.Events = {
    ABORT,
    GOLD,
    /**
     * Run an event id (R.DB.events) or an inline async (ev)=>{} script.
     * Called from inside a running event it runs inline (no deadlock), unless ctx.defer
     * (then it is queued after the current one, e.g. onEnter after an ev.warp).
     */
    run(idOrFn, ctx) {
      const c = Object.assign({}, ctx || {});
      c.gen = gen;
      if (current && !c.defer) return runInline(idOrFn, c);
      pending++;
      const p = queue.then(() => (c.gen === gen ? exec(idOrFn, c, false) : undefined)).finally(() => { if (c.gen === gen) pending = Math.max(0, pending - 1); });
      queue = p.catch(() => {});
      return p;
    },
    /** forget queued/running events (new game / title): they abort at their next ev call */
    reset() {
      gen++;
      pending = 0;
      current = null;
      queue = Promise.resolve();
    },
    /** true while any event is queued or running (the field is frozen) */
    busy() { return pending > 0; },
    get running() { return pending > 0; },
    get current() { return current; },
    /** talk to a field npc: its event, or its text (§3.2.4 forms) */
    talk(npc) {
      const ctx = { self: npc.id, npc, trigger: 'talk' };
      if (npc.event) return Events.run(npc.event, ctx);
      const pages = pickText(npc.text);
      return Events.run(async (ev) => { await ev.say(pages != null ? pages : '……'); }, ctx);
    },
    /** read a sign (text forms as NPCs) */
    read(sign) {
      const pages = pickText(sign.text);
      return Events.run(async (ev) => { if (pages != null) await ev.say(pages); }, { self: 'sign', sign });
    },
    /** caption outside events (e.g. from menus): same as ev.caption */
    caption,
    pickText,
    itemJingle,
    itemMark,
    gotItem,
    lines,
    gotPhrases,
    makeEv,
    StageLayer,
  });
})(window.RPG);
