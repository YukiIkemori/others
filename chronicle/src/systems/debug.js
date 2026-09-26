// Debug hooks (DESIGN §3.3.13): R.debug.* from the browser console, tools/shot.js
// (--eval "RPG.debug.quickStart({tier:3})") and every owner's tests.
// ?debug=1 also shows the map id and tile coordinates in the corner.
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;

  // §10.8.1: the regions in their list order, and their short names (flags <rs>_boss …)
  const REGION_ORDER = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
  const RS = { r_forest: 'forest', r_desert: 'desert', r_snow: 'snow', r_marsh: 'marsh', r_isles: 'isles', r_mine: 'mine', r_ash: 'ash', r_star: 'star' };
  const PROLOGUE_FLAGS = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];
  const PROLOGUE_KEYS = ['k_chronicle', 'k_quill', 'k_bell'];
  const DEFAULT_COMPANIONS = ['brigitta', 'marta', 'sylvain']; // §4.17.1 standard party (§5.8, critique 37)
  const ELEMENTS = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

  const regionOrder = () => {
    const keys = Object.keys(DB.regions || {});
    return keys.length ? keys : REGION_ORDER;
  };
  function need() { if (!R.Game) R.State.newGame(); return R.Game; }
  function all() { const g = need(); return g.party.concat(g.reserve || []); }
  function charOf(id) { return all().find((c) => c.id === id) || null; }
  function chars(charId) { return charId ? [charOf(charId)].filter(Boolean) : need().party; }
  function refresh() { if (R.Field && R.Field.map) R.Field.refresh(); }
  function fill(c) {
    try { const s = R.Rules.stats(c); c.hp = s.hp; c.mp = s.mp; if (s.wp != null) c.wp = s.wp; } catch (e) { /* partial rules */ }
    c.status = {};
  }
  function setLevel(c, n) {
    const max = (R.Rules && R.Rules.MAX_LEVEL) || 99;
    c.level = U.clamp(n | 0, 1, max);
    try { if (R.Rules.expForLevel) c.exp = R.Rules.expForLevel(c.level); } catch (e) { /* keep */ }
    fill(c);
  }
  /** hero spec from quickStart options: {hero:{name,gender,type,favor}} or top-level {name,gender,type,fav|favor} */
  function heroSpec(o) {
    const d = (DB.config && DB.config.defaultHero) || { name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } };
    const h = Object.assign({}, d, o.hero || {});
    if (o.name) h.name = o.name;
    if (o.gender) h.gender = o.gender;
    if (o.type) h.type = o.type;
    let fav = o.favor || o.fav || (o.hero && (o.hero.favor || o.hero.fav)) || null;
    if (typeof fav === 'string') fav = { kind: ELEMENTS.includes(fav) ? 'element' : 'weapon', id: fav };
    if (fav) h.favor = fav;
    else if (o.type && o.type !== d.type) {
      // a type whose favour kind differs from the default's: take the type's first option
      const t = DB.heroTypes && DB.heroTypes[o.type];
      if (t && t.favorOptions) {
        const kind = t.favorKind === 'element' ? 'element' : t.favorKind === 'weapon' ? 'weapon' : (h.favor && h.favor.kind) || 'weapon';
        const opts = t.favorOptions[kind] || [];
        if (opts.length && !(h.favor && h.favor.kind === kind && opts.includes(h.favor.id))) h.favor = { kind, id: opts[0] };
      }
    }
    delete h.fav;
    return h;
  }
  function recruit(id) {
    if (!DB.companions || !DB.companions[id]) { R.warn('debug.recruit: unknown companion ' + id); }
    if (charOf(id)) return charOf(id);
    if (R.Party && R.Party.recruit) return R.Party.recruit(id);
    let c = null;
    try { c = R.Rules.newChar({ id }); } catch (e) { c = null; }
    if (!c) return null;
    const g = need();
    g.reserve = g.reserve || [];
    if (g.party.length < (R.PARTY_MAX || 4)) g.party.push(c); else g.reserve.push(c);
    R.State.setFlag('joined_' + id);
    return c;
  }
  function clearState(id) {
    const g = need();
    if (R.Tier && R.Tier.clear) R.Tier.clear(id);
    else {
      g.regionsCleared = g.regionsCleared || [];
      if (!g.regionsCleared.includes(id)) g.regionsCleared.push(id);
      g.tier = g.regionsCleared.length;
      R.State.setFlag('cleared_' + id);
    }
    if (RS[id]) R.State.setFlag(RS[id] + '_boss');
    // the region's page, as ev.clearRegion hands it over (so the chronicle screen matches the tier)
    const page = DB.regions && DB.regions[id] && DB.regions[id].fragment;
    if (page && DB.items[page] && !R.State.hasItem(page)) R.State.addItem(page, 1);
    return g.tier;
  }
  /** undo clearState (debug.tier going down) */
  function unclearState(id) {
    R.State.setFlag('cleared_' + id, false);
    if (RS[id]) R.State.setFlag(RS[id] + '_boss', false);
    const page = DB.regions && DB.regions[id] && DB.regions[id].fragment;
    if (page && R.State.count(page)) R.State.removeItem(page, R.State.count(page));
  }
  /** normal shop gear of tier ≤ T: for weapons the same weapon type, else the same line / type */
  function tierGear(c, T) {
    if (!R.Rules || !R.Rules.equip) return 0;
    const items = DB.items;
    const best = (pred) => {
      let pick = null;
      for (const id in items) {
        const it = items[id];
        if (!it || it.grade && it.grade !== 'normal') continue;
        if (it.src && it.src !== 'shop') continue;
        if ((it.tier || 0) > T || !pred(it, id)) continue;
        if (!pick || (it.tier || 0) > (items[pick].tier || 0)) pick = id;
      }
      return pick;
    };
    let n = 0;
    for (const slot of ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet']) {
      const cur = c.equip && c.equip[slot];
      const ci = cur && items[cur];
      let pick = null;
      if (slot.startsWith('weapon')) {
        if (!ci) continue;
        pick = best((it) => it.type === 'weapon' && it.wtype === ci.wtype && (!ci.line || it.line === ci.line || !it.line)) || best((it) => it.type === 'weapon' && it.wtype === ci.wtype);
      } else if (ci) pick = best((it) => it.type === ci.type && ci.line && it.line === ci.line) || best((it) => it.type === ci.type && it.weight === ci.weight);
      else if (slot !== 'shield') pick = best((it, id) => it.type === slot && (!R.Rules.canEquip || R.Rules.canEquip(c, id, slot)));
      if (!pick || pick === cur) continue;
      if (R.Rules.canEquip && !R.Rules.canEquip(c, pick, slot)) continue;
      R.State.addItem(pick, 1);
      const r = R.Rules.equip(c, slot, pick);
      if (r && (r.ok || r === true)) n++; else R.State.removeItem(pick, 1);
    }
    return n;
  }

  R.debug = {
    /**
     * Skip the title and start a playable game (DESIGN §3.3.13):
     *   quickStart({hero:{name,gender,type,favor}, companions:[ids], tier, level, map, spawn, gear:'start'|'tier', prologue})
     *   (also accepts top-level gender / type / fav|favor / name)
     * Defaults: DB.config.defaultHero, ['brigitta','marta','sylvain'], tier 0, level 1, map 'lute' spawn 'inn',
     * the prologue finished (its flags, k_chronicle/k_quill/k_bell, visited roa/lute/lighthouse, objective obj_regions).
     * tier > 0 clears the first `tier` regions in the §10.8.1 order (cleared_<id>, <rs>_boss and the region's
     * page, as ev.clearRegion would leave them). prologue:true starts before the prologue.
     */
    async quickStart(o) {
      o = o || {};
      R.Engine.clear();
      R.Engine.fade(0, 0);
      if (R.Events) R.Events.reset();
      const spec = heroSpec(o);
      R.State.newGame(spec);
      const g = R.Game;
      if (!g.party.length || !g.party.some((c) => c.id === 'hero')) R.warn('debug.quickStart: newGame made no hero');
      if (R.Battle) R.Battle.autoCarry = false;
      if (o.prologue) {
        if (o.level) for (const c of g.party) setLevel(c, o.level);
        const st = R.Field.startPoint();
        await R.Field.start(o.map || st.map, o.map ? (o.spawn || 'entrance') : st.spawn);
        return R.debug.pos();
      }
      for (const f of PROLOGUE_FLAGS) R.State.setFlag(f);
      for (const k of PROLOGUE_KEYS) if (DB.items[k] && !R.State.hasItem(k)) R.State.addItem(k, 1);
      g.visited = g.visited || {};
      for (const l of ['roa', 'lute', 'lighthouse']) if (!DB.locations || DB.locations[l] || !Object.keys(DB.locations).length) g.visited[l] = true;
      g.objective = 'obj_regions';
      const comps = o.companions || DEFAULT_COMPANIONS;
      for (const id of comps) recruit(id);
      const tier = U.clamp((o.tier | 0), 0, 8);
      const regs = regionOrder();
      for (let i = 0; i < tier && i < regs.length; i++) clearState(regs[i]);
      if (o.tier === 9 || o.postgame) { R.State.setFlag('game_clear'); g.gameClear = true; g.clearCount = Math.max(1, g.clearCount || 0); }
      const lv = o.level || 1;
      for (const c of g.party.concat(g.reserve || [])) setLevel(c, lv);
      if (o.gear === 'tier') { const T = g.gameClear ? 9 : g.tier || 0; for (const c of g.party) { tierGear(c, T); fill(c); } }
      if (o.gold != null) g.gold = o.gold | 0;
      let map = o.map || 'lute', spawn = o.spawn != null ? o.spawn : o.map ? 'entrance' : 'inn';
      if (!DB.maps[map]) {
        const st = R.Field.startPoint();
        R.warn('debug.quickStart: no map ' + map + ' — starting at ' + st.map);
        map = st.map; spawn = st.spawn;
      }
      await R.Field.start(map, spawn);
      if (o.noEncounter) R.Field.noEncounter = true;
      return R.debug.pos();
    },
    /** fresh game started directly at map/spawn (skips the title) */
    newGameAt(map, spawn) {
      R.Engine.clear();
      R.State.newGame();
      const st = R.Field.startPoint();
      return R.Field.start(map || st.map, spawn != null ? spawn : map ? 'entrance' : st.spawn);
    },
    /** warp(map, spawnName | {x,y,dir}) without a fade */
    warp(map, spawn) { need(); return R.Field.warp(map, spawn, { fade: false }); },
    give(item, n = 1) {
      need();
      if (!DB.items[item]) return 'unknown item ' + item;
      R.State.addItem(item, n);
      return item + ' ×' + R.State.count(item);
    },
    /** one of every item of a kind: 'weapon' | 'armor' | 'acc' | 'consumable' | 'key' | a type | 'all' */
    giveAll(kind) {
      need();
      const ARMOR = { shield: 1, head: 1, body: 1, hands: 1, feet: 1 };
      let n = 0;
      for (const id in DB.items) {
        const t = DB.items[id].type;
        const ok = !kind || kind === 'all' || t === kind || (kind === 'armor' && ARMOR[t]);
        if (!ok) continue;
        if (R.State.addItem(id, t === 'consumable' ? 9 : 1)) n++;
      }
      return n;
    },
    gold(n) { need(); R.State.addGold(n); return R.Game.gold; },
    flag(name, v = true) { need(); R.State.setFlag(name, v); refresh(); return R.State.flag(name); },
    /** set every active member (or one character) to level n, full HP/MP/WP */
    level(n, charId) {
      need();
      for (const c of chars(charId)) setLevel(c, n);
      return R.Game.party.map((c) => c.name + ' Lv' + c.level);
    },
    /** tier(n): exactly the first n regions (§10.8.1 order) cleared */
    tier(n) {
      const g = need();
      n = U.clamp(n | 0, 0, 8);
      const regs = regionOrder();
      for (const id of (g.regionsCleared || []).slice()) if (regs.indexOf(id) >= n) unclearState(id);
      g.regionsCleared = (g.regionsCleared || []).filter((id) => regs.indexOf(id) < n);
      g.tier = g.regionsCleared.length;
      for (let i = 0; i < n && i < regs.length; i++) if (!g.regionsCleared.includes(regs[i])) clearState(regs[i]);
      g.tier = g.regionsCleared.length;
      refresh();
      return g.tier;
    },
    /** clear one region (state only, no scene; debug.chapter plays the scene) */
    clearRegion(id) { const t = clearState(id); refresh(); return t; },
    /** the chapter scene of ev.clearRegion (for screenshots) */
    chapter(id) { return R.Events.run((ev) => ev.clearRegion(id), { self: 'debug' }); },
    /** a caption (ev.caption) */
    caption(text, opts) { return R.Events.run((ev) => ev.caption(text, opts), { self: 'debug' }); },
    recruit(id) { const c = recruit(id); refresh(); return c ? c.name : null; },
    /** party([ids]): the active party (hero included automatically) */
    party(ids) {
      const g = need();
      const want = ['hero'].concat((ids || []).filter((id) => id !== 'hero')).slice(0, R.PARTY_MAX || 4);
      for (const id of want) if (id !== 'hero' && !charOf(id)) recruit(id);
      if (R.Party && R.Party.setParty) R.Party.setParty(want);
      else {
        const everyone = all();
        g.party = want.map((id) => everyone.find((c) => c.id === id)).filter(Boolean);
        g.reserve = everyone.filter((c) => !g.party.includes(c));
      }
      refresh();
      return R.Game.party.map((c) => c.id);
    },
    /** prof(charId, 'w'|'e', id, pts): set a proficiency to pts points */
    prof(charId, kind, id, pts) {
      const c = charOf(charId);
      if (!c) return 'unknown char ' + charId;
      const k = kind === 'e' ? 'eprof' : 'wprof';
      c[k] = c[k] || {};
      c[k][id] = pts | 0;
      return c[k][id];
    },
    /** learn(charId, actionId): a tech (t_) or a spell (s_) */
    learn(charId, actionId) {
      const c = charOf(charId);
      if (!c) return 'unknown char ' + charId;
      const a = DB.actions && DB.actions[actionId];
      if (!a) return 'unknown action ' + actionId;
      const list = (a.kind === 'spell' || actionId.startsWith('s_')) ? (c.spells = c.spells || []) : (c.techs = c.techs || []);
      if (!list.includes(actionId)) { list.push(actionId); if (R.State.noteLearned) R.State.noteLearned(c.id, actionId); }
      return list.length;
    },
    /** every tech and spell (one character or the whole active party) */
    learnAll(charId) {
      const ids = Object.keys(DB.actions || {}).filter((id) => id.startsWith('t_') || id.startsWith('s_'));
      for (const c of chars(charId)) for (const id of ids) R.debug.learn(c.id, id);
      return ids.length;
    },
    noEncounter(v = true) { R.Field.noEncounter = !!v; return R.Field.noEncounter; },
    heal() { need(); R.State.healAll({ reserve: true }); return true; },
    /** battle(zoneId | troopId | {mons:[…], …}) */
    battle(id) {
      if (!R.Battle || !R.Battle.start) return 'no battle system';
      if (id && typeof id === 'object') return R.Events.run((ev) => ev.battle(id), { self: 'debug' });
      if (DB.troops[id]) return R.Events.run((ev) => ev.battle(id), { self: 'debug' });
      return R.Field.encounter(id);
    },
    event(id) { return R.Events.run(id, { self: 'debug' }); },
    /** put the (dormant) ship at a world spawn (or {x,y}) */
    ship(spawn) {
      need();
      const wid = R.Field.map && R.Field.map.isWorld && typeof spawn === 'object' ? R.Field.map.id : R.FieldMap.findWorld(typeof spawn === 'string' ? spawn : null);
      const p = wid && R.FieldMap.spawnPos(spawn, wid);
      if (!p) return 'unknown spawn';
      R.Game.ship = { map: wid, x: p.x, y: p.y, dir: p.dir || 'down' };
      return R.Game.ship;
    },
    visitAll() { need(); R.Game.visited = R.Game.visited || {}; for (const id in DB.locations) R.Game.visited[id] = true; return Object.keys(R.Game.visited); },
    teleport(loc) { return R.Field.teleport(loc); },
    pos() { const p = R.Field.pos(); return p && Object.assign({ map: R.Field.map && R.Field.map.id }, p); },
    maps() { return Object.keys(DB.maps); },

    // ---- extras for tests and screenshots
    /** stand at (x,y) facing dir on the current map */
    here(x, y, dir) { R.Field.setPlayerPos(x, y, dir); return R.debug.pos(); },
    /** field zoom: 'normal' | 'wide' | 'wider' */
    zoom(z) { R.Settings.fieldZoom = z; if (R.Save && R.Save.saveSettings) { try { R.Save.saveSettings(); } catch (e) { /* ignore */ } } return R.Field.view(); },
    /** 魔除け / 誘い寄せ: encItem(pct, steps, weakOnly) */
    encItem(pct = -100, steps = 100, weakOnly = pct < 0) { return R.Field.setEncItem({ id: null, pct, steps, weakOnly }); },
    /** the whole party falls and the wipe runs (as after a lost battle) */
    wipe() { for (const c of need().party) c.hp = 0; return R.Field.requestWipe(); },
    /** found / total secret-passage cells */
    secrets() { return { found: R.Field.secretsFound(), total: R.Field.secretTotal() }; },
  };

  R.onBoot(() => {
    try {
      if (/[?&]debug=1\b/.test(window.location.search || '')) R.Field.showCoords = true;
    } catch (e) { /* no location (tools) */ }
  });
})(window.RPG);
