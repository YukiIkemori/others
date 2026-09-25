// Jobs screenshot fixture: a mid-game party built from the real job data.
// RPG.fxJobs.setup({level}) replaces R.Game; loaded only by the jobs harness.
(function (R) {
  'use strict';
  R.fxJobs = {
    setup(opts) {
      const o = opts || {};
      R.State.newGame();
      const g = R.Game;
      g.gold = 8420;
      g.playFrames = 60 * 60 * 200;
      const L = o.level || 24;
      for (const c of g.party) { c.level = L; c.exp = R.Rules.expForLevel(L) + 50; }
      const [y, n, m] = g.party;
      const jl = (c, job, lv, spare) => {
        const rec = R.Rules.jobRec(c, job);
        rec.total = R.Rules.jpForJobLevel(job, lv);
        rec.jp = spare != null ? spare : 120;
      };
      const learn = (c, ids) => { for (const a of ids) { const rec = R.Rules.jobRec(c, R.DB.abilities[a].job); if (!rec.learned.includes(a)) rec.learned.push(a); } };
      const learnAll = (c, job) => learn(c, R.Rules.jobAbilities(job));
      // ユウキ: warrior master → knight 5 → hunter/monk → ninja
      jl(y, 'warrior', 8); learnAll(y, 'warrior');
      jl(y, 'knight', 5, 640); learn(y, ['knight_bash', 'knight_mind_break', 'knight_fortress', 'knight_cover', 'knight_equip_armor']);
      jl(y, 'thief', 3); learn(y, ['thief_steal', 'thief_sand', 'thief_flee']);
      jl(y, 'hunter', 4); learn(y, ['hunter_aim', 'hunter_venom', 'hunter_double']);
      jl(y, 'priest', 2); jl(y, 'monk', 3); learn(y, ['monk_chi', 'monk_stun', 'monk_focus']);
      jl(y, 'ninja', 2, 480); learn(y, ['ninja_shuriken', 'ninja_smoke']);
      y.job = 'ninja';
      y.set = { sub: 'warrior', reaction: 'warrior_counter', support: 'knight_equip_armor', field: null };
      // ノン: priest master → whitemage 5 → bard 3
      jl(n, 'priest', 8); learnAll(n, 'priest');
      jl(n, 'whitemage', 5, 380); learn(n, ['whitemage_healing', 'whitemage_esuna', 'whitemage_regen', 'whitemage_arrow', 'whitemage_heal_wind', 'whitemage_mending_hand']);
      jl(n, 'thief', 2); learn(n, ['thief_steal', 'thief_sand']);
      jl(n, 'bard', 3); learn(n, ['bard_lullaby', 'bard_swift', 'bard_hymn', 'bard_calm']);
      n.job = 'whitemage';
      n.set = { sub: 'priest', reaction: 'whitemage_mending_hand', support: 'priest_mnd_up', field: 'bard_calm' };
      // メテム: mage master → blackmage 6 → alchemist 2
      jl(m, 'mage', 8); learnAll(m, 'mage');
      jl(m, 'blackmage', 6, 555); learn(m, ['blackmage_fire2', 'blackmage_ice2', 'blackmage_poison', 'blackmage_thunder2', 'blackmage_confuse', 'blackmage_osmose', 'blackmage_blast', 'blackmage_awaken']);
      jl(m, 'thief', 2); jl(m, 'alchemist', 2); learn(m, ['alchemist_salve', 'alchemist_panacea']);
      m.job = 'blackmage';
      m.set = { sub: 'mage', reaction: 'blackmage_awaken', support: 'mage_mp_up', field: null };
      const eq = { yuki: ['wakizashi', null, 'silver_helm', 'forest_garb'], non: ['silver_staff', null, 'circlet', 'moon_robe'], metem: ['ruby_rod', null, 'pointy_hat', 'moon_robe'] };
      for (const c of g.party) {
        const e = eq[c.id];
        R.Rules.SLOTS.slice(0, 4).forEach((s, i) => { c.equip[s] = e[i] && R.DB.items[e[i]] ? e[i] : null; });
        const st = R.Rules.stats(c);
        c.hp = Math.floor(st.hp * 0.8); c.mp = Math.floor(st.mp * 0.7);
      }
      for (const id of ['herb', 'healing_grass', 'revive_feather', 'mana_drop']) if (R.DB.items[id]) R.State.addItem(id, 3);
      return g;
    },
  };
})(window.RPG);
