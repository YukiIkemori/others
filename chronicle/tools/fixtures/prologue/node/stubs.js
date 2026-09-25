// Node-only stand-ins for tools/test_prologue.js (not part of the browser fixture page):
// hero creation and the tavern pick return fixed answers, battles are a short layer whose result
// comes from a script (and which grants the tutorial's guaranteed 閃き), sounds are recorded.
(function (R) {
  'use strict';
  const S = (R.fxPro = {
    HERO: { name: 'ルカ', gender: 'f', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } },
    PICK: ['selma', 'marta', 'teo'],
    created: 0, battles: [], battleScript: [], glimmer: 'tech', jingles: [], sfx: [], bgm: [],
  });
  R.CharCreate = { run: async () => { S.created++; return R.U.clone(S.HERO); } };
  R.Tavern = Object.assign({}, R.Tavern || {}, { chooseStart: async (o) => S.PICK.slice(0, (o && o.count) || 3) });
  class FxBattle extends R.Layer {
    constructor(o) { super(); this.opaque = true; this.o = o; this.t = 0; }
    update() { if (++this.t > 12) this.close(S.battleScript.length ? S.battleScript.shift() : 'win'); }
  }
  function learn(c, kind) {
    const A = R.DB.actions || {};
    const have = new Set([].concat(c.techs || [], c.spells || []));
    const id = Object.keys(A).find((k) => A[k].kind === kind && !have.has(k) && (kind === 'spell' ? /^s_/.test(k) : /^t_/.test(k)));
    if (!id) return;
    (kind === 'spell' ? (c.spells = c.spells || []) : (c.techs = c.techs || [])).push(id);
  }
  R.Battle = Object.assign(R.Battle || {}, {
    start(o) {
      S.battles.push(R.U.clone(o));
      return R.Engine.run(new FxBattle(o)).then((res) => {
        const party = R.Game.party.filter((c) => !o.members || o.members.includes(c.id));
        if (res === 'lose') for (const c of party) c.hp = 0;
        else {
          for (const c of R.Game.party) if (c.hp > 0) { try { c.hp = R.Rules.stats(c).hp; } catch (e) { /* keep */ } }
          if (o.glimmerForce) { const h = R.Game.party.find((c) => c.id === o.glimmerForce); if (h) learn(h, S.glimmer === 'spell' ? 'spell' : 'tech'); }
        }
        R.Battle.last = { result: res, troop: o.troop || null, zone: o.zone || null, killed: [], glimmers: [] };
        return res;
      });
    },
  });
  R.Audio = {
    sfx: (id) => S.sfx.push(id), playBGM: (id) => S.bgm.push(id), stopBGM() {}, pushBGM() {}, popBGM() {},
    playJingle: (id) => { S.jingles.push(id); return R.Engine.wait(3); }, duck() {}, current: null,
  };
})(window.RPG);
