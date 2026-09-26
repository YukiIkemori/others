// 仮の実装: RULES（R.Rules・R.Growth・R.Glimmer・R.Party）。本物は src/systems/{rules,growth,glimmer,party}.js。V2_PLAN §2.5.12
(function (R) {
  'use strict';
  R.Stubs.define('Rules', {
    K: { SLOTS: ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'], WTYPES: ['sword', 'greatsword', 'dagger', 'bow', 'staff'] },
    abilMul() { return 1; },
    stats(c) { return { maxHp: R.Growth.baseMax(c, 'hp'), maxMp: R.Growth.baseMax(c, 'mp'), atk: 10, def: 10, mag: 10, spd: 10 }; },
    preview() { return {}; },
    optimize() { return {}; },
    applyLoadout() {},
    profRank(pts) { return Math.max(1, Math.min(100, pts | 0)); },
    train() {},
    commandList() { return ['attack', 'skill', 'spell', 'defend', 'item']; },
    canEquip() { return true; },
    fillItem(item) { return item; },
    profAt(tier) { return 1 + (tier | 0) * 4; },
  });

  R.Stubs.define('Growth', {
    init(c, o) { c.gl = R.Growth.glAt((o && o.tier) || 0, 'party'); c.hp = R.Growth.baseMax(c, 'hp'); c.mp = R.Growth.baseMax(c, 'mp'); },
    baseMax(c, k) { return k === 'hp' ? 60 + (c.gl || 0) * 6 : 12 + (c.gl || 0) * 2; },
    afterBattle() { return []; },
    equivLevel(c) { return c.gl || 0; },
    cap(T) { return 10 + (T | 0) * 6; },
    glAt(tier) { return (tier | 0) * 4; },
  });

  R.Stubs.define('Glimmer', { roll() { return null; } });

  R.Stubs.define('Party', {
    members() { const G = R.Game; return G ? G.party.map((id) => G.chars[id]).filter(Boolean) : []; },
    reserve() { const G = R.Game; return G ? G.reserve.map((id) => G.chars[id]).filter(Boolean) : []; },
    swap(a, b) {
      const G = R.Game, all = G.party.concat(G.reserve);
      const i = all.indexOf(a), j = all.indexOf(b);
      if (i < 0 || j < 0) return false;
      all[i] = b; all[j] = a;
      G.party = all.slice(0, G.party.length); G.reserve = all.slice(G.party.length);
      return true;
    },
    setRow(id, row) { const c = R.Game.chars[id]; if (c) c.row = row; },
    join(id) {
      const G = R.Game;
      if (!G.chars[id]) {
        const d = R.DB.companions[id] || {};
        const c = R.State.blankChar ? R.State.blankChar(id, { name: d.name || id, look: id }) : { id, name: d.name || id, look: id };
        R.Growth.init(c, { tier: G.tier, joinFrom: 'tavern' });
        G.chars[id] = c;
      }
      if (!G.joined.includes(id)) G.joined.push(id);
      if (G.party.includes(id) || G.reserve.includes(id)) return;
      if (G.party.length < R.PARTY_MAX) G.party.push(id); else G.reserve.push(id);
    },
    heal(all) { for (const c of R.Party.members().concat(all ? R.Party.reserve() : [])) if (c.hp > 0) { c.hp = R.Growth.baseMax(c, 'hp'); c.mp = R.Growth.baseMax(c, 'mp'); } },
    fullHeal() { for (const c of R.Party.members().concat(R.Party.reserve())) { c.hp = R.Growth.baseMax(c, 'hp'); c.mp = R.Growth.baseMax(c, 'mp'); c.status = []; } },
  });
})(window.RPG);
