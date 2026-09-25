// Event runtime (DESIGN §7.3): runs R.DB.events[id].run(ev) scripts with the
// `ev` API. Events are serialised (one at a time; the field is frozen while any
// is queued or running). Consecutive ev.say calls share one message window; it
// closes before battles, warps, shops, menus and at the end of the event.
//
//   R.Events.run(id | async (ev) => {...}, ctx)   → Promise(result)
//   ctx: {self, npc, trigger:'talk'|'step'|'examine'|'enter', once:'flag', x, y}
//   `once`: skipped while the flag is set; set automatically when the event
//   finishes normally (not when it returned false, errored, ended in a game
//   over, or a battle in it was escaped) — so lost/escaped boss fights retry.
(function (R) {
  'use strict';
  const DB = R.DB;

  const ABORT = { eventAbort: true }; // thrown to end an event after a game over

  let queue = Promise.resolve();
  let pending = 0; // queued + running events
  let current = null; // ctx of the event that is executing
  let gen = 0; // bumped by reset(): events of an older generation abort at their next ev call

  const leaderName = () => (R.Game ? R.State.leader().name : '');
  const fmt = (text) => String(text == null ? '' : text).replace(/\{leader\}/g, leaderName());
  const closeWin = () => { if (R.UI && R.UI.closeMessage) R.UI.closeMessage(); };

  /** width of the message window's text area (logical px) */
  function msgWidth() {
    const M = R.UI && R.UI.MSG;
    return M ? M.w - M.pad * 2 : 220;
  }
  function textW(s) {
    try { return R.Gfx.textWidth(s); } catch (e) { return String(s).length * (R.Gfx.FS || 10.7); } // no canvas (node tools)
  }
  /**
   * Join message phrases, starting a new line only where the next phrase would
   * overflow the message window, so long names break at a phrase boundary:
   *   lines('メテムは', 'サファイアのロッドを', '手に入れた！')
   *   → 'メテムはサファイアのロッドを\n手に入れた！'
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

  /** message + jingle together; resolves when both are done (DQ "got item" fanfare) */
  function gotItem(text, jingleId) {
    const j = R.jingle(jingleId);
    return Promise.all([R.UI.say(fmt(text), { keep: true }), j]);
  }

  function makeEv(ctx) {
    const st = { battles: [] };
    const field = () => R.Field;
    const ev = {
      ctx,
      self: ctx.self != null ? ctx.self : null,
      get map() { return field() && field().map ? field().map.id : null; },
      get leader() { return leaderName(); },

      // ------------------------------------------------------------ text
      async say(text, opts) {
        if (Array.isArray(text)) { for (const t of text) await ev.say(t, opts); return; }
        await R.UI.say(fmt(text), Object.assign({ keep: true }, opts));
      },
      async ask(text, choices, opts) {
        if (text) await R.UI.say(fmt(text), { noWait: true });
        return R.UI.choose(choices, opts || {});
      },
      async yesno(text) { return R.UI.yesno(text ? fmt(text) : text); },
      gotItem(text, jingleId) { return gotItem(text, jingleId); },
      closeMessage: closeWin,

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

      /** 「{leader}は✕✕を手に入れた！」 (line break before 手に入れた when it would overflow) + jingle ('keyitem' for key items) */
      async give(item, n = 1, opts) {
        const o = opts || {};
        const it = DB.items[item];
        if (!it) { R.warn('ev.give: unknown item', item); return false; }
        if (R.State.count(item) + n > 99) {
          if (!o.silent) await ev.say(lines(leaderName() + 'は', it.name + 'を', '受け取ろうとした。') + '\nしかし、これ以上は持てない！');
          return false;
        }
        R.State.addItem(item, n);
        if (!o.silent) {
          await gotItem(lines(leaderName() + 'は', ...gotPhrases(it.name, n, '手に入れた！')), it.type === 'key' ? 'keyitem' : 'item');
        }
        return true;
      },
      async giveGold(n, opts) {
        R.State.addGold(n);
        if (opts && opts.silent) return;
        R.sfx('gold');
        await ev.say(lines(leaderName() + 'は', n + 'ゴールドを', '手に入れた！'));
      },

      // ------------------------------------------------------------ battle
      /** → 'win' | 'lose' | 'escape'. A lost battle without canLose runs the game over and ends the event. */
      async battle(troopId, opts) {
        const o = Object.assign({}, opts || {});
        closeWin();
        if (troopId && typeof troopId === 'object') Object.assign(o, troopId);
        else if (troopId) o.troop = troopId;
        if (o.troop && !DB.troops[o.troop]) R.warn('ev.battle: unknown troop', o.troop);
        if (!R.Battle || !R.Battle.start) { R.warn('ev.battle: battle system missing'); st.battles.push('win'); return 'win'; }
        const troop = o.troop && DB.troops[o.troop];
        if (!o.bg) o.bg = (troop && troop.bg) || (field() && field().battleBg ? field().battleBg() : undefined);
        const f = field(), lay = f && f.layer;
        if (lay) lay.locks++;
        let res;
        try { res = await R.Battle.start(o); } finally { if (lay) lay.locks = Math.max(0, lay.locks - 1); }
        st.battles.push(res);
        if (res === 'lose') {
          if (o.canLose) {
            for (const c of R.Game.party) if (c.hp <= 0) { c.hp = 1; c.status = {}; }
            return 'lose';
          }
          await f.gameOver();
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
      heal() { R.State.healAll(); },
      /** standard inn; sets respawn; → bool */
      async inn(price) {
        const ok = R.Shop && R.Shop.inn ? await R.Shop.inn(price) : await fallbackInn(ev, price);
        if (ok) field().setRespawnHere();
        return !!ok;
      },
      async shop(shopId) {
        closeWin();
        if (R.Shop && R.Shop.open) return R.Shop.open(shopId);
        R.warn('ev.shop: shop system missing', shopId);
        return null;
      },
      /** church: save / revive / cure; sets respawn */
      async church() {
        field().setRespawnHere();
        if (R.Shop && R.Shop.church) return R.Shop.church();
        return fallbackChurch(ev);
      },
      async saveMenu() {
        field().setRespawnHere();
        closeWin();
        if (R.Menu && R.Menu.saveMenu) return R.Menu.saveMenu();
        if (R.Menu && R.Menu.save) return R.Menu.save();
        return quickSave(ev);
      },
      setObjective(id) {
        if (!DB.objectives || !DB.objectives[id]) R.warn('ev.setObjective: unknown objective', id);
        R.Game.objective = id;
        R.emit('objective', id);
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

  // ------------------------------------------------------------ fallbacks (used only when the menu owner's services are absent)
  async function fallbackInn(ev, price) {
    const yes = await ev.yesno('旅人の宿屋へようこそ。\nひと晩' + price + 'ゴールドです。\nお泊まりになりますか？');
    if (!yes) { await ev.say('またのお越しをお待ちしております。'); return false; }
    if (!R.State.takeGold(price)) { await ev.say('おや、お金が足りないようですね。'); return false; }
    await ev.say('では、ごゆっくりお休みください。');
    closeWin();
    await R.Engine.fadeOut(30);
    R.State.healAll();
    await R.jingle('inn');
    await R.Engine.wait(20);
    await R.Engine.fadeIn(30);
    await ev.say('おはようございます。\nいってらっしゃいませ。');
    return true;
  }
  async function fallbackChurch(ev) {
    for (;;) {
      const i = await ev.ask('ここは神の家。\n今日はどのようなご用かな？', ['お祈りをする', '生き返らせる', '毒の治療', 'やめる']);
      if (i === 0) { await ev.saveMenu(); continue; }
      if (i === 1 || i === 2) {
        const need = R.Game.party.filter((c) => (i === 1 ? c.hp <= 0 : c.hp > 0 && c.status && c.status.poison));
        if (!need.length) { await ev.say(i === 1 ? '生き返らせる者はいないようじゃ。' : '毒に冒された者はいないようじゃ。'); continue; }
        const c = need[0];
        const price = i === 1 ? c.level * 10 : 10;
        if (!(await ev.yesno(c.name + 'を' + (i === 1 ? '生き返らせるには' : '治すには') + '\n' + price + 'ゴールドいただくが、よいかな？'))) continue;
        if (!R.State.takeGold(price)) { await ev.say('お金が足りないようじゃな。'); continue; }
        if (i === 1) { c.hp = R.Rules.stats(c).hp; c.status = {}; R.sfx('revive'); await ev.say('おお、神よ！\n' + c.name + 'に今ひとたびの\n命を与えたまえ！'); }
        else { delete c.status.poison; R.sfx('heal'); await ev.say(c.name + 'の体から毒が消え去った。'); }
        continue;
      }
      await ev.say('あなたに神のご加護がありますように。');
      return;
    }
  }
  async function quickSave(ev) {
    if (!(await ev.yesno('冒険の記録をつけますか？'))) return false;
    const ok = await R.Save.save(R.Save.lastSlot || 0, R.State.serialize());
    if (ok) { await R.jingle('save'); await ev.say('冒険の記録をつけました。'); }
    else await ev.say('記録に失敗しました。');
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
      const p = queue.then(() => (c.gen === gen ? exec(idOrFn, c, false) : undefined)).finally(() => { if (c.gen === gen) pending--; });
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
    /** talk to a field npc: its event, or its text pages */
    talk(npc) {
      const ctx = { self: npc.id, npc, trigger: 'talk' };
      if (npc.event) return Events.run(npc.event, ctx);
      const pages = npc.text != null ? npc.text : '……';
      return Events.run(async (ev) => { await ev.say(pages); }, ctx);
    },
    gotItem,
    lines,
    gotPhrases,
    makeEv,
  });
})(window.RPG);
