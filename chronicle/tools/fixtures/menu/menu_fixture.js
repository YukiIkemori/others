// Menu test / screenshot fixture (A5). Loaded by tools/test_menu.js (node) and by
// `node tools/build.js --with tools/fixtures/menu` → debug_menu.html (browser).
//   RPG.menuFixture.enrich(o)   fill R.Game with a mid-game state (4 members, gear of every grade,
//                               learned techs / spells, bestiary progress, pages, secrets…)
//   await RPG.menuFixture.setup(o)   R.debug.quickStart + enrich (browser)
//   RPG.menuFixture.worst()     the worst-case names / numbers (§12.5: 5-char names, HP 999, MP 250)
// Everything is picked deterministically from the real registries (no randomness).
(function (R) {
  'use strict';
  const DB = R.DB;
  const ids = (pred) => Object.keys(DB.items).filter((id) => pred(DB.items[id], id));
  const firstOf = (pred) => ids(pred)[0] || null;

  function learn(c, id) {
    if (!DB.actions[id]) return;
    const list = DB.actions[id].kind === 'spell' ? (c.spells = c.spells || []) : (c.techs = c.techs || []);
    if (!list.includes(id)) list.push(id);
    if (R.State.noteLearned) R.State.noteLearned(c.id, id);
  }
  /** the techs of a weapon type up to rank n */
  const techsOf = (w, n) => Object.keys(DB.actions).filter((id) => DB.actions[id].kind === 'tech' && DB.actions[id].wtype === w && (DB.actions[id].rank || 1) <= n);
  const spellsOf = (pred) => Object.keys(DB.actions).filter((id) => DB.actions[id].kind === 'spell' && pred(DB.actions[id]));

  function enrich(o) {
    o = o || {};
    const g = R.Game;
    const party = g.party;
    const tier = o.tier != null ? o.tier : g.tier || 0;
    // names (worst case on request)
    if (o.heroName) R.State.hero().name = o.heroName;
    // levels
    const lv = o.level || 34;
    for (const c of party.concat(g.reserve || [])) {
      if (R.Rules.setLevel) R.Rules.setLevel(c, lv); else c.level = lv;
      const st = R.Rules.stats(c);
      c.hp = st.hp; c.mp = st.mp;
    }
    // techs by each member's weapons, spells by their best elements
    for (const c of party) {
      for (const s of ['weapon1', 'weapon2']) {
        const it = DB.items[c.equip[s]];
        if (it) for (const id of techsOf(it.wtype, o.techRank || 6)) learn(c, id);
      }
      const apt = R.Rules.aptLetters ? R.Rules.aptLetters(c) : { e: {} };
      const els = Object.keys(apt.e || {}).filter((e) => apt.e[e] === 'S' || apt.e[e] === 'A' || apt.e[e] === 'B');
      for (const id of spellsOf((a) => (a.elements || []).length === 1 && els.includes(a.elements[0]) && (a.step || 1) <= 3)) learn(c, id);
    }
    if (o.combos !== false) {
      const caster = party.find((c) => (c.spells || []).length >= 4) || party[party.length - 1];
      for (const id of spellsOf((a) => (a.elements || []).length === 2).slice(0, 5)) learn(caster, id);
      for (const id of spellsOf((a) => a.field)) learn(caster, id);
      learn(caster, spellsOf((a) => (a.elements || []).length === 3)[0]);
    }
    // inventory: normal consumables, rare ones, gear of every grade, key items and the pages
    g.inv = {};
    const add = (id, n) => { if (id && DB.items[id]) R.State.addItem(id, n || 1); };
    ids((it) => it.type === 'consumable' && it.src === 'shop').forEach((id, i) => add(id, 1 + ((i * 7) % 12)));
    ids((it) => it.type === 'consumable' && it.grade === 'rare').slice(0, 6).forEach((id) => add(id, 2));
    const T = Math.max(1, Math.min(8, tier));
    for (const type of ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc']) {
      ids((it) => it.type === type && it.src === 'shop' && it.tier === T).slice(0, 5).forEach((id) => add(id, type === 'acc' ? 1 : 1));
      add(firstOf((it) => it.type === type && it.grade === 'rare' && it.tier >= T - 1 && it.tier <= T + 1));
      add(firstOf((it) => it.type === type && it.grade === 'super' && it.quirk));
    }
    add(firstOf((it) => it.type === 'weapon' && it.grade === 'super' && it.element));
    add(firstOf((it) => it.unique && it.type === 'acc'));
    add(firstOf((it) => it.unique && it.type === 'weapon'));
    add(firstOf((it) => it.type === 'acc' && it.mods && it.mods.rarePct));
    add(firstOf((it) => it.type === 'acc' && it.mods && it.mods.glimPct));
    add(firstOf((it) => it.type === 'head' && it.src === 'shop' && it.tier === T && it.stats && it.stats.int));
    for (const k of ['k_chronicle', 'k_quill', 'k_bell', 'k_lighthouse_key']) add(k);
    for (const r of g.regionsCleared || []) if (DB.regions[r] && DB.regions[r].fragment) add(DB.regions[r].fragment);
    // gold / time / visited / secrets / objectives
    g.gold = o.gold != null ? o.gold : 12345;
    g.playFrames = o.playFrames != null ? o.playFrames : (32 * 3600 + 5 * 60) * 60;
    g.visited = g.visited || {};
    for (const id in DB.locations) g.visited[id] = true;
    g.secrets = g.secrets || {};
    ['lighthouse_2:4,7', 'verda_maze_1:20,3', 'sand_tomb_2:11,9'].forEach((k) => { g.secrets[k] = true; });
    for (const r of Object.keys(DB.regions)) {
      if ((g.regionsCleared || []).includes(r)) continue;
      const oid = Object.keys(DB.objectives).find((k) => k.startsWith('obj_' + (DB.regions[r].short || '') + '_'));
      if (oid) g.regionObj[r] = oid;
    }
    // bestiary: most mobs seen, many beaten, drops / steals recorded, a few goldens; bosses of cleared regions
    const order = R.Menu.monsterOrder();
    order.forEach((id, i) => {
      const m = DB.monsters[id];
      const boss = (m.flags || []).includes('boss'), rare = (m.flags || []).includes('rare');
      if (boss && i % 3) return;
      if (rare && i % 4) return;
      if (!boss && !rare && i % 5 === 4) return;
      const e = R.State.mon(id);
      e.seen = 3 + (i % 9);
      if (i % 7 !== 3) e.kills = 1 + ((i * 13) % 40);
      if (i % 2 === 0) e.drop = true;
      if (i % 5 === 0) e.rare = true;
      if (i % 23 === 0) e.sr = true;
      if (i % 11 === 0 && e.kills) e.gold = 1 + (i % 3);
      if (i % 7 === 3 && i % 2 === 0) { e.stole = { normal: true }; }
    });
    // conditions
    const hurt = o.hurt !== false;
    if (hurt) {
      party.forEach((c, i) => {
        const st = R.Rules.stats(c);
        if (i === 1) c.hp = Math.max(1, Math.floor(st.hp * 0.18));
        if (i === 2) { c.hp = Math.floor(st.hp * 0.6); c.mp = Math.floor(st.mp * 0.5); }
      });
    }
    if (o.dead != null && party[o.dead]) party[o.dead].hp = 0;
    return R.debug && R.debug.pos ? R.debug.pos() : true;
  }

  /** worst-case display: 5-char names, HP 999, MP 250 (§12.5) */
  function worst() {
    const g = R.Game;
    R.State.hero().name = 'アルンハルト'.slice(0, 5);
    for (const c of g.party) {
      c.level = 99;
      c.hp = 999; c.mp = 250;
    }
    return g.party.map((c) => c.name);
  }

  async function setup(o) {
    o = o || {};
    await R.debug.quickStart(Object.assign({ tier: 5, level: 34, companions: ['brigitta', 'marta', 'sylvain'], gear: 'tier', noEncounter: true }, o));
    return enrich(o);
  }

  /** open a menu screen without awaiting it (for screenshots): 'main' | Menu function name + args */
  function show(name, ...args) {
    if (name === 'main') { R.Menu.open(); return true; }
    const fn = R.Menu[name];
    if (typeof fn !== 'function') return 'no ' + name;
    Promise.resolve(fn(...args)).catch((e) => console.error(e));
    return true;
  }

  R.menuFixture = { enrich, setup, worst, show, learn };
})(window.RPG);
