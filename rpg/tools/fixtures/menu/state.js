// Menu test fixture: a mid-game party state. RPG.fxMenu.setup() replaces R.Game.
(function (R) {
  'use strict';
  const has = (id) => !!R.DB.items[id];
  R.fxMenu = {
    setup(opts) {
      const o = opts || {};
      R.State.newGame();
      const g = R.Game;
      g.gold = o.gold != null ? o.gold : 12345;
      g.playFrames = 60 * 60 * 83 + 60 * 17;
      g.objective = 'obj_wind';
      const lv = o.level || 14;
      for (const c of g.party) {
        c.level = lv; c.exp = R.Rules.expForLevel(lv) + 40;
      }
      const [y, n, m] = g.party;
      const jl = (c, job, l) => {
        const rec = R.Rules.jobRec(c, job);
        const total = R.Rules.JP_TABLE[l - 1];
        rec.jp += total - rec.total + 60; rec.total = total;
      };
      jl(y, 'warrior', 6); jl(y, 'knight', 3); jl(y, 'priest', 2); jl(y, 'thief', 1);
      jl(n, 'priest', 5); jl(n, 'whitemage', 2); jl(n, 'thief', 2);
      jl(m, 'mage', 4); jl(m, 'blackmage', 1); jl(m, 'thief', 3);
      const learn = (c, ids) => { for (const a of ids) if (R.DB.abilities[a]) { const rec = R.Rules.jobRec(c, R.DB.abilities[a].job); if (!rec.learned.includes(a)) rec.learned.push(a); } };
      learn(y, ['warrior_power_slash', 'warrior_counter', 'warrior_hp_up', 'warrior_first_aid', 'warrior_equip_axe']);
      learn(n, ['priest_heal', 'priest_cure', 'priest_heal_all', 'priest_revive', 'priest_walk_heal', 'thief_repel']);
      learn(m, ['mage_fire', 'mage_teleport', 'mage_exit', 'thief_steal', 'thief_treasure', 'thief_encounter_down']);
      y.set.reaction = R.DB.abilities.warrior_counter ? 'warrior_counter' : null;
      y.set.support = R.DB.abilities.warrior_hp_up ? 'warrior_hp_up' : null;
      n.set.field = R.DB.abilities.priest_walk_heal ? 'priest_walk_heal' : null;
      m.set.sub = 'thief';
      // equipment
      if (has('iron_sword')) y.equip.weapon = 'iron_sword';
      if (has('bronze_helm')) y.equip.head = 'bronze_helm';
      if (has('chain_mail')) y.equip.body = 'chain_mail';
      if (has('oak_shield')) y.equip.shield = 'oak_shield';
      // inventory
      const inv = {
        herb: 7, healing_grass: 3, mana_drop: 2, antidote: 2, revive_feather: 1, holy_water: 2, wing: 3, escape_rope: 1,
        fire_bomb: 4, seed_str: 1, light_drop: 1, smoke_bomb: 2,
        iron_spear: 1, dagger: 2, hand_axe: 1, bastard_sword: 1, swallow_sword: 1, copper_staff: 1, apprentice_rod: 1,
        iron_helm: 1, cloth_hat: 1, leather_vest: 1, apprentice_robe: 1, bronze_shield: 1, power_bracer: 1, clover: 1, poison_bell: 1,
        crest_wind: 1, silver_key: 1,
      };
      for (const id in inv) if (has(id)) R.State.addItem(id, inv[id]);
      // bestiary
      const b = g.bestiary;
      const mons = Object.keys(R.DB.monsters);
      mons.forEach((id, i) => {
        if (i % 5 === 4) return; // some unseen
        b[id] = { seen: 3 + i, kills: i % 3 === 2 ? 0 : 2 + i };
        if (i % 2 === 0) b[id].drop = true;
        if (i % 3 === 0) b[id].rare = true;
      });
      // hurt / statuses
      for (const c of g.party) { const s = R.Rules.stats(c); c.hp = Math.floor(s.hp * 0.6); c.mp = Math.floor(s.mp * 0.5); }
      n.status = { poison: true };
      if (o.dead) m.hp = 0;
      for (const id in R.DB.locations) g.visited[id] = true;
      return g;
    },
  };
})(window.RPG);
