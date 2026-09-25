// newgame (A6) test fixture: stand-ins for the APIs other owners are still building, so the
// title / creation / name entry / tavern screens can be tested in isolation (node and debug_newgame.html).
// Everything here only fills what is MISSING (or visibly broken) at run time; real modules win.
//   RPG.NGFixture.game(heroSpec?)            → a fresh R.Game (real R.State.newGame when it works)
//   RPG.NGFixture.party(ids, {level, reserve:[ids]}) → recruit ids (via R.Party) into party / reserve
//   RPG.NGFixture.show(name, opts)           → open a screen for screenshots
(function (R) {
  'use strict';
  const DB = R.DB;
  const SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
  const W = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const E = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const F = (R.NGFixture = { stubbed: [] });
  const TWO = { greatsword: 1, spear: 1, bow: 1 };
  const WTYPE_OF = (id) => (DB.items[id] && DB.items[id].wtype) || (/^w_([a-z]+)_/.exec(id || '') || [])[1] || null;

  // ------------------------------------------------------------ characters (§5.2.7 in miniature)
  function growthMax(letter, base, per, level) {
    const k = { S: 1.3, A: 1.15, B: 1, C: 0.8, D: 0.6 }[letter] || 1;
    return Math.max(1, Math.round((base + per * (level - 1)) * k));
  }
  function stubChar(spec) {
    const lv = Math.max(1, spec.level || 1);
    let c;
    if (spec.id === 'hero') {
      const hs = spec.heroSpec || (DB.config && DB.config.defaultHero) || { name: 'アルン', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } };
      const T = DB.heroTypes[hs.type] || DB.heroTypes.warrior;
      const apt = R.CharCreate ? R.CharCreate.previewApt(hs.type, hs.favor) : T.apt;
      const kit = DB.starterKit || {};
      const w1 = hs.favor.kind === 'weapon' ? kit.weapon[hs.favor.id] : T.defaultWeapon;
      const acts = R.CharCreate ? R.CharCreate.startActions(hs.type, hs.favor) : { techs: [], spells: [] };
      const equip = Object.assign({}, T.startEquip, { weapon1: w1 });
      if (TWO[WTYPE_OF(w1)]) equip.shield = null;
      c = { id: 'hero', name: hs.name, gender: hs.gender, heroType: hs.type, favor: { kind: hs.favor.kind, id: hs.favor.id }, apt, growth: T.growth, equip, techs: acts.techs, spells: acts.spells,
        row: R.CharCreate ? R.CharCreate.heroRow(hs.type, hs.favor) : 'front' };
    } else {
      const d = DB.companions[spec.id];
      c = { id: spec.id, name: d.name, gender: d.gender, apt: d.apt, growth: d.growth, equip: Object.assign({}, d.startEquip), techs: d.startTechs.slice(), spells: d.startSpells.slice(), row: d.row };
    }
    const prof = (DB.starterKit && DB.starterKit.prof) || { S: 15, A: 5 };
    const wprof = {}, eprof = {};
    for (const w of W) wprof[w] = prof[c.apt.w[w]] || 0;
    for (const e of E) eprof[e] = prof[c.apt.e[e]] || 0;
    const equip = {};
    for (const s of SLOTS) equip[s] = c.equip[s] || null;
    const out = {
      id: c.id, name: c.name, gender: c.gender, level: lv, exp: 0, bonus: { hp: 0, mp: 0, wp: 0 }, status: {}, equip, wprof, eprof,
      techs: c.techs, spells: c.spells, row: c.row, mem: { cmd: 0, list: {}, item: 0, target: null }, joined: { tier: 0, frame: 0 }, counts: { battles: 0, kills: 0, glimmers: 0 },
    };
    if (c.heroType) { out.heroType = c.heroType; out.favor = c.favor; }
    out.hp = F.maxOf(out, 'hp'); out.mp = F.maxOf(out, 'mp'); out.wp = F.maxOf(out, 'wp');
    return out;
  }
  F.maxOf = function (c, k) {
    try { if (R.Rules && R.Rules.stats && !F.stubbed.includes('Rules.newChar')) { const s = R.Rules.stats(c); if (s && s[k] > 0) return s[k]; } } catch (e) { /* stub below */ }
    const d = c.id === 'hero' ? DB.heroTypes[c.heroType] : DB.companions[c.id];
    const g = d ? d.growth[k] : 'B';
    return k === 'hp' ? growthMax(g, 17, 12, c.level) : k === 'mp' ? growthMax(g, 8, 1.6, c.level) : growthMax(g, 5, 1, c.level);
  };
  /** true when rules' newChar understands the Chronicle spec (§5.2.7) */
  function rulesNewCharOk() {
    try {
      if (!R.Rules || !R.Rules.newChar) return false;
      const c = R.Rules.newChar({ id: 'selma' });
      const h = R.Rules.newChar({ id: 'hero', heroSpec: { name: 'テスト', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'fire' } } });
      return !!(c && c.id === 'selma' && c.equip && c.equip.weapon1 === 'w_sword_iron' && h && h.id === 'hero' && h.heroType === 'mage');
    } catch (e) { return false; }
  }
  F.newChar = (spec) => (F.stubbed.includes('Rules.newChar') ? stubChar(spec) : R.Rules.newChar(spec));

  // ------------------------------------------------------------ the game (R.State.newGame when it works)
  F.game = function (heroSpec) {
    let ok = false;
    try {
      if (!F.forced && R.State && R.State.newGame) R.State.newGame(heroSpec);
      ok = !F.forced && !!(R.Game && Array.isArray(R.Game.party) && R.Game.party[0] && R.Game.party[0].id === 'hero' && Array.isArray(R.Game.reserve));
      if (ok && heroSpec && R.Game.party[0].name !== heroSpec.name) ok = false;
    } catch (e) { ok = false; }
    if (!ok) {
      if (!F.stubbed.includes('State.newGame')) F.stubbed.push('State.newGame');
      R.Game = { game: 'chronicle', version: R.VERSION, party: [F.newChar({ id: 'hero', heroSpec })], reserve: [], tier: 0, regionsCleared: [], flags: {}, vars: {}, gold: 300, inv: {},
        chests: {}, visited: {}, book: { mon: {}, tech: {}, spell: {} }, pos: { map: null, x: 0, y: 0, dir: 'down' }, respawn: null, secrets: {}, steps: 0, playFrames: 0, battles: 0, wins: 0, escapes: 0,
        records: { glimmers: 0, rareDrops: 0, superDrops: 0, goldens: 0, rareMons: 0 } };
      R.State = R.State || {};
      if (!R.State.hero || !safe(() => R.State.hero())) R.State.hero = () => R.Game.party.find((c) => c.id === 'hero');
      R.State.leader = () => R.Game.party.find((c) => c.hp > 0) || R.Game.party[0];
    }
    return R.Game;
  };
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  // ------------------------------------------------------------ R.Party (§3.3.4) when rules has not landed it
  const all = () => R.Game.party.concat(R.Game.reserve);
  const heal = (c) => { c.hp = F.maxOf(c, 'hp'); c.mp = F.maxOf(c, 'mp'); c.wp = F.maxOf(c, 'wp'); c.status = {}; };
  const stubParty = {
    MAX: 4,
    candidates: () => Object.keys(DB.companions),
    isRecruited: (id) => all().some((c) => c.id === id),
    joinLevel: () => Math.max(1, Math.floor(((R.Game.party.find((c) => c.id === 'hero') || {}).level || 1) * 0.9)),
    recruit(id, o) {
      if (!DB.companions[id] || stubParty.isRecruited(id)) return null;
      const c = F.newChar({ id, level: stubParty.joinLevel() });
      c.joined = { tier: R.Game.tier || 0, frame: R.Game.playFrames || 0 };
      R.Game.flags['joined_' + id] = true;
      if ((!o || o.toParty !== false) && R.Game.party.length < 4) R.Game.party.push(c); else R.Game.reserve.push(c);
      R.emit('recruit', c); R.emit('partyChange');
      return c;
    },
    setParty(ids) {
      if (!ids.includes('hero') || ids.length < 1 || ids.length > 4) return false;
      const pool = all();
      const next = ids.map((id) => pool.find((c) => c.id === id));
      if (next.some((c) => !c)) return false;
      const left = R.Game.party.filter((c) => !ids.includes(c.id));
      for (const c of next) if (R.Game.reserve.includes(c)) heal(c);
      R.Game.reserve = left.concat(R.Game.reserve.filter((c) => !ids.includes(c.id)));
      R.Game.party = next;
      R.emit('partyChange');
      return true;
    },
    swap(activeId, reserveId) {
      if (activeId === 'hero') return false;
      const a = R.Game.party.find((c) => c.id === activeId), b = R.Game.reserve.find((c) => c.id === reserveId);
      if (!a || !b) return false;
      R.Game.party = R.Game.party.filter((c) => c !== a).concat([b]);
      b.row = DB.companions[b.id] ? DB.companions[b.id].row : b.row;
      heal(b);
      R.Game.reserve = [a].concat(R.Game.reserve.filter((c) => c !== b));
      R.emit('partyChange');
      return true;
    },
    setOrder(ids) {
      if (ids.length !== R.Game.party.length) return false;
      const next = ids.map((id) => R.Game.party.find((c) => c.id === id));
      if (next.some((c) => !c)) return false;
      R.Game.party = next;
      R.emit('partyChange');
      return true;
    },
    setRow(id, row) { const c = all().find((m) => m.id === id); if (c) c.row = row; return !!c; },
    canSwapHere: () => true,
    spriteKey: (c) => (c.id === 'hero' ? 'party:hero_' + c.gender + '_' + c.heroType : 'party:' + ((DB.companions[c.id] && DB.companions[c.id].sprite) || c.id)),
    faceKey: (c) => stubParty.spriteKey(c).replace('party:', 'face:'),
    mod: () => 0,
  };
  /** install the stand-ins that are needed (force: use every stand-in, to test the screens against the spec alone) */
  F.install = function (force) {
    if ((force || !rulesNewCharOk()) && !F.stubbed.includes('Rules.newChar')) F.stubbed.push('Rules.newChar');
    const P = R.Party || {};
    const need = ['candidates', 'isRecruited', 'recruit', 'setParty', 'swap', 'setOrder', 'setRow', 'spriteKey', 'joinLevel'];
    if ((force || need.some((k) => typeof P[k] !== 'function')) && !F.stubbed.includes('Party')) { R.Party = Object.assign({}, stubParty); F.stubbed.push('Party'); }
    if (force && !F.forced) {
      F.forced = true;
      R.State = Object.assign({}, R.State, { newGame: (hs) => F.game(hs), flag: (n) => !!(R.Game && R.Game.flags[n]) });
    }
    R.Rules = R.Rules || {};
    if (typeof R.Rules.unequipAll !== 'function' || F.stubbed.includes('Rules.newChar')) {
      R.Rules.unequipAll = function (c) {
        for (const s of SLOTS) {
          const id = c.equip[s];
          if (!id) continue;
          const n = R.Game.inv[id] || 0;
          if (n >= 99) continue;
          R.Game.inv[id] = n + 1;
          c.equip[s] = null;
        }
      };
      F.stubbed.push('Rules.unequipAll');
    }
    return F.stubbed;
  };

  /** recruit ids (party first, then reserve) at a level, through R.Party */
  F.party = function (ids, o) {
    const opt = o || {};
    for (const id of ids || []) R.Party.recruit(id);
    for (const id of opt.reserve || []) R.Party.recruit(id, { toParty: false });
    if (opt.level) for (const c of R.Game.party.concat(R.Game.reserve)) { c.level = c.id === 'hero' ? opt.level : Math.max(1, opt.level - (c.id.length % 4)); heal(c); }
    return R.Game;
  };

  /** open a screen for screenshots: title | create | name | choose | choose2 | tavern | swap */
  F.show = async function (name, o) {
    const opt = o || {};
    F.install();
    R.Engine.clear();
    R.Engine.fade(0, 0);
    if (name === 'title') return R.Title.start();
    F.game(opt.hero);
    if (name === 'create') return R.CharCreate.run({ cancel: false, initial: opt.initial });
    if (name === 'name') return R.NameEntry.run({ initial: opt.initial == null ? 'リーネ' : opt.initial, max: 5, spriteKey: 'party:hero_' + (opt.gender || 'f') + '_' + (opt.type || 'spellblade'), gender: opt.gender || 'f' });
    if (name === 'choose') return R.Tavern.chooseStart({ count: 3, advice: opt.advice });
    F.party(opt.party || ['brigitta', 'marta', 'sylvain'], { level: opt.level || 34, reserve: opt.reserve || ['selma', 'hagen', 'dokka', 'basil', 'bartolo', 'viola', 'shigure', 'rouga', 'titta', 'zafira'] });
    if (name === 'tavern') return R.Tavern.open({ recruit: opt.recruit !== false });
    if (name === 'swap') return R.Tavern.swapScreen();
    if (name === 'browse') return R.Tavern.browse();
    return null;
  };
})(window.RPG);
