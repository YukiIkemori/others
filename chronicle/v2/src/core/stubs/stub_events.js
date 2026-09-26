// 仮の実装: EVENTS（R.State・R.Events・ev・R.Leads・R.Mini・R.Tier）。本物は src/systems/{state,events_runtime,leads,minigame,tier}.js。
// V2_PLAN §2.5.10・§2.5.14・§2.6.3
(function (R) {
  'use strict';
  const EQUIP = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];

  function blankChar(id, o) {
    o = o || {};
    const c = {
      id, name: o.name || id, look: o.look || id, type: o.type, gl: 0, hp: 1, mp: 0,
      equip: {}, wprof: {}, eprof: {}, techs: [], spells: [], status: [], row: o.row || 'front',
    };
    for (const k of EQUIP) c.equip[k] = null;
    return c;
  }

  function newGame(o) {
    o = o || {};
    const seed = o.seed != null ? o.seed : (Date.now() >>> 0);
    const G = (R.Game = {
      ver: 2, seed, playMs: 0, chapter: 0,
      hero: 'hero', chars: {}, party: [], reserve: [], joined: [],
      gold: 0, items: {}, flags: {}, vars: {}, choices: {},
      tier: 0, pendingTier: null, cleared: {},
      pos: { map: '', x: 0, y: 0, dir: 's' }, lastTown: null, lastInn: null, visited: {}, warps: {},
      chests: {}, secrets: {}, springs: {}, lit: {}, lamps: {},
      leads: {}, heard: {}, seenSkill: {},
      book: { mon: {} },
      chronicle: { chapters: [] }, guest: null,
      battle: { cursor: {}, lastRound: [] },
    });
    if (o.hero) R.State.setHero(o.hero);
    return G;
  }

  function check(cond) {
    const G = R.Game || {};
    if (cond == null || cond === true) return true;
    if (cond === false) return false;
    if (Array.isArray(cond)) return cond.every(check);
    if (typeof cond === 'string') {
      if (cond.charAt(0) === '!') return !check(cond.slice(1));
      if (cond.indexOf('cleared_') === 0) return !!(G.cleared && G.cleared[cond.slice(8)]);
      return !!(G.flags && G.flags[cond]);
    }
    if (cond.any) return cond.any.some(check);
    if (cond.item) return ((G.items && G.items[cond.item]) || 0) >= (cond.n || 1);
    if (cond.var) {
      const v = (G.vars && G.vars[cond.var]) || 0;
      if (cond.gte != null && !(v >= cond.gte)) return false;
      if (cond.lte != null && !(v <= cond.lte)) return false;
      if (cond.eq != null && !(v === cond.eq)) return false;
      return true;
    }
    if (cond.tier) {
      const t = G.tier || 0;
      if (cond.tier.gte != null && !(t >= cond.tier.gte)) return false;
      if (cond.tier.lte != null && !(t <= cond.tier.lte)) return false;
      return true;
    }
    if (cond.lead) {
      const l = G.leads && G.leads[cond.lead];
      if (cond.state === 'done') return !!(l && l.done);
      return !!l;
    }
    if (cond.choice) return G.choices && G.choices[cond.choice] === cond.is;
    if (cond.heard) return !!(G.heard && G.heard[cond.heard]);
    if (cond.guest) return !!(G.guest && G.guest.look === cond.guest);
    if (cond.slice) return !!(R.DB.config && R.DB.config.slice);
    R.warn('unknown cond ' + JSON.stringify(cond));
    return false;
  }

  R.Stubs.define('State', {
    newGame,
    /** 主人公を作る（ev.createHero と新しいゲームの両方から） hero = K.hero {type, sex, name, fav?}。中身は R.Party.makeChar（RULES） */
    setHero(h) {
      const G = R.Game;
      const c = R.Party.makeChar('hero', { hero: h, tier: G.tier || 0 });
      if (h.fav) c.fav = h.fav;
      G.chars.hero = c;
      if (!G.party.includes('hero')) G.party.unshift('hero');
      if (!G.joined.includes('hero')) G.joined.push('hero');
      return c;
    },
    blankChar,
    serialize() { return R.U.clone(R.Game); },
    deserialize(obj) {
      if (!obj || obj.ver !== 2) return false;
      R.Game = R.U.clone(obj);
      return true;
    },
    wipeRecover() {
      const G = R.Game;
      G.gold = Math.floor((G.gold || 0) / 2);
      R.Party.restoreAll();
      return G.lastInn;
    },
    check,
    /** 版 2: 品を入れる（ev.item・宝箱・店・戦闘の報酬が使う 1 か所）。u_* は R.Rules.fillItem で今のティアの値を R.Game.uniques に写す。→ K.gain */
    gain(id, n) {
      const G = R.Game;
      n = n == null ? 1 : n;
      G.items[id] = (G.items[id] || 0) + n;
      const it = R.DB.items[id];
      if (/^u_/.test(id) && it && !(G.uniques && G.uniques[id])) {
        G.uniques = G.uniques || {};
        const filled = R.Rules.fillItem(Object.assign({}, it), { tier: G.tier || 0 }) || {};
        G.uniques[id] = Object.assign({ tier: G.tier || 0 }, filled.stats || {});
      }
      R.emit('item:gain', { id, n });
      return { item: id, n, grade: (it && it.grade) || 'normal', name: (it && it.name) || id };
    },
  });

  // ---------------------------------------------------------------- 実行
  let busy = false, aborted = 0;
  function makeEv(ctx) {
    const G = () => R.Game;
    const token = aborted;
    const guard = () => { if (token !== aborted) throw Object.assign(new Error('event aborted'), { aborted: true }); };
    // 話者: who = NPC id（今のマップの）か look か null。名前は npc.name → looks[look].name の順（版 2）。
    // 顔は o.face（'look' / 'look:expr' / false）。o.face を書かなければ、その人の look に顔があれば（R.Portrait.has）出す
    const speaker = (who) => {
      if (!who) return { name: null, look: null };
      const map = R.DB.maps[(R.Field.pos || {}).map];
      const npc = map && (map.npcs || []).find((n) => n.id === who);
      const look = (npc && npc.look) || who;
      const L = R.DB.looks[look];
      return { name: (npc && npc.name) || (L && L.name) || null, look, title: npc && npc.title };
    };
    const ev = {
      async say(who, text, o) {
        guard(); o = o || {};
        const sp = speaker(who);
        let face = o.face;
        if (face == null) face = sp.look && R.Portrait.has(sp.look, 'neutral') ? sp.look : false;
        const r = await R.UIK.Message.say({ name: o.name || sp.name || undefined, title: o.title || sp.title, face, text, voice: o.voice });
        guard(); return r;
      },
      async choose(labels, o) { guard(); const r = await R.UIK.Message.say({ text: (o && o.text) || '', choices: labels, cancel: o && o.cancel }); guard(); return r; },
      async caption(text, o) { guard(); await R.UIK.Message.caption(text, o || {}); guard(); },
      async fade(dir, ms) { await R.Engine.fadeTo(dir === 'out' ? 1 : 0, ms == null ? 260 : ms); },
      wait(ms) { return R.wait(ms); },
      flag(id) { return !!G().flags[id]; },
      setFlag(id, v) { G().flags[id] = v === undefined ? true : v; R.emit('flag', { id, v: G().flags[id] }); },
      var(name) { return G().vars[name] || 0; },
      addVar(name, n) { G().vars[name] = (G().vars[name] || 0) + (n == null ? 1 : n); R.emit('var', { name, v: G().vars[name] }); return G().vars[name]; },
      item(id, n) { return R.State.gain(id, n); },
      take(id, n) { G().items[id] = Math.max(0, (G().items[id] || 0) - (n == null ? 1 : n)); },
      gold(n) { G().gold = Math.max(0, (G().gold || 0) + n); return G().gold; },
      has(id) { return (G().items[id] || 0) > 0; },
      async battle(setup, opts) {
        guard();
        if (typeof setup === 'string') setup = { troop: setup };
        const r = await R.Battle.start(Object.assign({}, setup, opts || {}));
        // 'abort'（全滅して宿・タイトル）: R.Flow.wipe がもう R.Events.abort() を呼んでいるので、ここの guard で止まる
        if (r && r.result === 'abort') { if (token === aborted) R.Events.abort(); guard(); }
        return r ? r.result : 'win';
      },
      warp(map, spawn) { return R.Field.enter(map, spawn); },
      heal() { R.Party.heal(true); },
      rest() { R.Party.restoreAll(); },
      /** 宿（版 2）: 画面（MENUS）は {stay} を返すだけ。お金・暗転・全快・lastInn・オートセーブ・ティアの場面はここ */
      async inn(price) {
        guard();
        const r = await R.Screens.open('inn', { price });
        guard();
        if (!r || !r.stay || (G().gold || 0) < price) return false;
        G().gold -= price;
        await R.Engine.fadeTo(1, 400);
        R.Audio.jingle && R.Audio.jingle('inn');
        R.Party.restoreAll();
        const p = R.Field.pos;
        G().lastInn = { map: p.map, x: p.x, y: p.y, dir: p.dir };
        await R.wait(600);
        await R.Engine.fadeTo(0, 400);
        R.Save.autosave('inn');
        R.emit('inn', { map: p.map });
        return true;
      },
      async shop(id) { return R.Screens.open('shop', { id }); },
      async tavern(o) { return R.Screens.open('tavern', o || {}); },
      async chooseCompanions(o) { return R.Screens.open('partySelect', o || { count: 3 }); },
      async createHero() { const h = await R.Screens.open('charcreate'); if (h) R.State.setHero(h); return h; },
      lead(id) { R.Leads.add(id); },
      leadDone(id) { R.Leads.done(id); },
      choice(key, value) { G().choices[key] = value; },
      choiceOf(key) { return G().choices[key]; },
      async clearRegion(rid) {
        G().cleared[rid] = true; G().tier = (G().tier || 0) + 1; G().pendingTier = G().tier;
        R.emit('region:clear', { rid }); R.emit('tier', { tier: G().tier });
        await R.Tier.celebrate(rid);
      },
      npc(id) { return R.Field.npc(id); },
      guest(look) { R.Field.setGuest(look ? { id: look, look } : null); },
      camera(x, y, ms) { return R.Field.camera.focus(x, y, { ms }); },
      mini: { sequence: (o) => R.Mini.sequence(o), timing: (o) => R.Mini.timing(o) },
      async letter(id) { guard(); await R.Screens.open('letter', { id }); guard(); },
      call(id, args) { const e = R.DB.events[id]; return e ? e.run(ev, Object.assign({}, ctx, args || {})) : undefined; },
      g(male, female) { const h = G().chars.hero; return h && /_f_/.test(h.look) ? female : male; },
      bgm(id) { R.Audio.bgm(id); },
      sfx(id) { R.Audio.sfx(id); },
      jingle(id) { return R.Audio.jingle(id); },
    };
    return ev;
  }

  function lineHash(line) { return R.U.hash(JSON.stringify(line && line.text)).toString(36); }
  function currentLine(npc) {
    if (typeof npc.talk === 'string') return { text: npc.talk };
    let line = null;
    for (const l of (npc.talk && npc.talk.lines) || []) if (!l.cond || R.State.check(l.cond)) line = l;
    return line;
  }

  R.Stubs.define('Events', {
    /** 版 2: 「新しい話」の印（E19）。npc.key があり、今の台詞のハッシュが R.Game.heard[key] と違えば true（FIELD の吹き出し・HUD の人数） */
    isNew(map, npc) {
      if (!npc || !npc.key || !R.Game) return false;
      const line = currentLine(npc);
      return !!line && R.Game.heard[npc.key] !== lineHash(line);
    },
    async run(id, ctx) {
      const e = R.DB.events[id];
      if (!e) { R.warn('no event ' + id); return undefined; }
      if (busy) { R.warn('event already running, ignored: ' + id); return undefined; }
      if (e.cond && !R.State.check(e.cond)) return undefined;
      if (e.once && R.Game.flags['ev_' + id]) return undefined;
      busy = true;
      R.Field.lock('event');
      try {
        const r = await e.run(makeEv(ctx || {}), ctx || {});
        if (e.once) R.Game.flags['ev_' + id] = true;
        return r;
      } catch (err) {
        if (!(err && err.aborted)) console.error('[event ' + id + ']', err);
        return undefined;
      } finally {
        busy = false;
        R.Field.unlock('event');
      }
    },
    busy() { return busy; },
    abort() {
      aborted++;
      if (R.UIK.Message.busy()) R.UIK.Message.close();
      busy = false;
      R.Field.unlock('event');
      R.Engine.fadeTo(0, 0);
    },
    async talk(map, npc) {
      R.emit('talk', { npc: npc.id });
      if (typeof npc.talk === 'string') {
        if (npc.key) R.Game.heard[npc.key] = lineHash(currentLine(npc));
        return R.Events.run(npc.talk, { map: map.id, npc: npc.id, x: npc.x, y: npc.y });
      }
      const lines = (npc.talk && npc.talk.lines) || [];
      let line = null;
      for (const l of lines) if (!l.cond || R.State.check(l.cond)) line = l;
      if (!line) return undefined;
      if (npc.key) R.Game.heard[npc.key] = lineHash(line);
      R.Field.lock('talk');
      try {
        return await makeEv({ map: map.id, npc: npc.id }).say(npc.id, line.text, { face: line.face, voice: line.voice });
      } finally { R.Field.unlock('talk'); }
    },
    makeEv,
  });

  R.Stubs.define('Leads', {
    add(id) { const L = R.Game.leads; if (!L[id]) { L[id] = { got: Math.floor(R.Game.playMs || 0), pin: false, seen: false }; R.emit('lead:add', { id }); } },
    pin(id) { for (const k of Object.keys(R.Game.leads)) R.Game.leads[k].pin = k === id; R.emit('lead:pin', { id }); },
    unpin() { for (const k of Object.keys(R.Game.leads)) R.Game.leads[k].pin = false; },
    list() {
      const by = {};
      for (const id of Object.keys(R.Game.leads)) {
        const d = R.DB.leads[id] || {}, l = R.Game.leads[id];
        const g = (by[d.region || '-'] = by[d.region || '-'] || { region: d.region || '-', items: [] });
        g.items.push({ id, state: l.done ? 'done' : l.seen ? 'open' : 'new', pinned: !!l.pin });
      }
      return Object.values(by);
    },
    done(id) { const l = R.Game.leads[id]; if (l) { l.done = true; l.pin = false; R.emit('lead:done', { id }); } },
    pinned() { return Object.keys(R.Game.leads).find((k) => R.Game.leads[k].pin) || null; },
  });

  R.Stubs.define('Mini', {
    async sequence() { return { score: 0, rank: 'C' }; },
    async timing() { return { hits: 0, rank: 'C' }; },
  });

  R.Stubs.define('Tier', {
    get() { return (R.Game && R.Game.tier) || 0; },
    effective() { return R.Tier.get(); },
    pending() { return R.Game ? R.Game.pendingTier : null; },
    consumePending() { const p = R.Game.pendingTier; R.Game.pendingTier = null; return p; },
    async celebrate() { await R.Engine.fadeTo(1, 200); await R.Engine.fadeTo(0, 200); },
  });
})(window.RPG);
