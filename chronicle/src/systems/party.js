// Party (R.Party): recruiting the 20 companions, active party (1–4, always with
// the hero) and the reserve, order and rows, EXP awards (the reserve gets 60%),
// after-battle recovery, party-wide modifiers and sprite keys. DESIGN.md §3.3.4, §5.5.
// Pure logic (no DOM). The tavern screens (R.Tavern) call only these functions.
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const SWAP_TYPES = ['town', 'castle', 'village', 'house', 'interior'];

  const game = () => R.Game;
  const K = () => R.Rules.K;
  const heal = (c) => R.Rules.fullHeal(c);
  const dataRow = (c) => {
    if (c.id === 'hero') return c.row;
    const d = DB.companions[c.id];
    return d && d.row === 'middle' ? 'middle' : 'front';
  };

  const Party = (R.Party = {
    MAX: R.PARTY_MAX || 4,
    RESERVE_RATE: 0.6,

    /** companion ids in DB order (the tavern's list) */
    candidates() { return Object.keys(DB.companions); },
    isRecruited(id) { return !!R.State.char(id); },
    /** not yet recruited, in DB order */
    unrecruited() { return Party.candidates().filter((id) => !Party.isRecruited(id)); },
    /** level of a companion joining now: max(1, floor(hero level × 0.9)) (§3.3.4) */
    joinLevel() {
      const h = R.State.hero();
      return Math.max(1, Math.floor(((h && h.level) || 1) * K().JOIN_LEVEL));
    },
    /**
     * add a companion (§5.5.2): level joinLevel(), full HP/MP, starting gear on.
     * From the 4th companion on, proficiency catches up (§4.9.1; opts.catchUp overrides).
     * Goes to the party if there is room (and opts.toParty !== false), else the reserve.
     * Sets joined_<id>, emits 'recruit'(c) and 'partyChange'. Already recruited → that CharState.
     */
    recruit(id, opts) {
      opts = opts || {};
      const g = game();
      const have = R.State.char(id);
      if (have) return have;
      if (!DB.companions[id]) { R.warn('recruit: unknown companion', id); return null; }
      const c = R.Rules.newChar({ id, level: Party.joinLevel() });
      const before = Party.recruitedCount();
      const catchUp = opts.catchUp != null ? !!opts.catchUp : before >= 3;
      if (catchUp) R.Rules.catchUpProf(c, R.Tier ? R.Tier.effective() : 0);
      c.joined = { tier: g.tier || 0, frame: g.playFrames || 0, n: before };
      heal(c);
      const toParty = opts.toParty !== false && g.party.length < Party.MAX;
      if (toParty) g.party.push(c); else { g.reserve.push(c); Party.sortReserve(); }
      R.State.setFlag('joined_' + id);
      for (const a of c.techs.concat(c.spells)) R.State.noteLearned(c.id, a);
      R.emit('recruit', c);
      R.emit('partyChange');
      return c;
    },
    /** companions recruited so far (party + reserve, without the hero) */
    recruitedCount() { return R.State.all().filter((c) => c.id !== 'hero').length; },
    /** the reserve stays in joining order (§3.2.1, §5.6.3) */
    sortReserve() {
      const order = Party.candidates();
      const key = (c) => (c.joined && c.joined.n != null ? c.joined.n : 100 + order.indexOf(c.id));
      game().reserve.sort((a, b) => key(a) - key(b));
    },
    /** bring a reserve member into the party: full heal, the row from its data, at the end */
    enter(c) {
      heal(c);
      c.row = dataRow(c);
      c.status = {};
    },
    /**
     * set the whole active party (hero included, 1–4, recruited only). Members left out
     * go to the reserve; members coming from the reserve are fully healed.
     */
    setParty(ids) {
      const g = game();
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > Party.MAX || !ids.includes('hero')) return false;
      if (new Set(ids).size !== ids.length) return false;
      const chars = ids.map((id) => R.State.char(id));
      if (chars.some((c) => !c)) return false;
      const all = R.State.all();
      for (const c of chars) if (g.reserve.includes(c)) Party.enter(c);
      g.party = chars;
      g.reserve = all.filter((c) => !chars.includes(c));
      Party.sortReserve();
      R.emit('partyChange');
      return true;
    },
    /**
     * swap an active member with a reserve member (§5.5.3). The hero cannot leave.
     * swap(activeId, null) sends one to the reserve; swap(null, reserveId) adds one
     * when the party has room. The newcomer goes to the end, healed, with its data row.
     */
    swap(activeId, reserveId) {
      const g = game();
      const a = activeId ? g.party.find((c) => c.id === activeId) : null;
      const r = reserveId ? g.reserve.find((c) => c.id === reserveId) : null;
      if ((activeId && !a) || (reserveId && !r) || (!a && !r)) return false;
      if (a && a.id === 'hero') return false;
      if (!a && g.party.length >= Party.MAX) return false;
      if (a) {
        g.party.splice(g.party.indexOf(a), 1);
        g.reserve.push(a);
      }
      if (r) {
        g.reserve.splice(g.reserve.indexOf(r), 1);
        Party.enter(r);
        g.party.push(r);
      }
      Party.sortReserve();
      R.emit('partyChange');
      return true;
    },
    toReserve(id) { return Party.swap(id, null); },
    toParty(id) { return Party.swap(null, id); },
    /** reorder the active party (same members) */
    setOrder(ids) {
      const g = game();
      if (!Array.isArray(ids) || ids.length !== g.party.length || new Set(ids).size !== ids.length) return false;
      const list = ids.map((id) => g.party.find((c) => c.id === id));
      if (list.some((c) => !c)) return false;
      g.party = list;
      R.emit('partyChange');
      return true;
    },
    /** swap the places of two active members */
    swapOrder(i, j) {
      const p = game().party;
      if (!p[i] || !p[j] || i === j) return false;
      [p[i], p[j]] = [p[j], p[i]];
      R.emit('partyChange');
      return true;
    },
    setRow(id, row) {
      const c = R.State.char(id);
      if (!c || (row !== 'front' && row !== 'middle')) return false;
      c.row = row;
      R.emit('partyChange');
      return true;
    },
    /** can the party be changed here? towns / castles / villages (map.def.partySwap overrides) */
    canSwapHere() {
      const g = game();
      if (!g || !g.pos) return false;
      const f = R.Field && R.Field.map;
      const def = (f && f.def && f.id === g.pos.map ? f.def : null) || DB.maps[g.pos.map];
      if (!def) return false;
      if (def.partySwap != null) return !!def.partySwap;
      return SWAP_TYPES.includes(def.type || 'town');
    },

    // ------------------------------------------------------------ battles
    /**
     * EXP after a won battle (§4.2.3, §5.5.4): active fighters get battleExp, fallen
     * members, non-fighters (o.members) and the reserve 60%. The falloff uses each
     * one's own level. o = {killed:[{def, golden}|{id, golden}], members?, party?, reserve?}
     * → [{c, exp, levels, gains, level, reserve}]
     */
    award(o) {
      o = o || {};
      const g = game();
      const party = o.party || (g && g.party) || [];
      const reserve = o.reserve || (g && g.reserve) || [];
      const killed = o.killed || [];
      const rate = K().RESERVE_RATE;
      const out = [];
      const give = (c, share, isReserve) => {
        const exp = killed.length ? R.Rules.battleExp(c, killed, share) : 0;
        const r = R.Rules.gainExp(c, exp);
        out.push({ c, exp, levels: r.levels, gains: r.gains, level: c.level, reserve: isReserve });
      };
      for (const c of party) {
        const fights = !o.members || o.members.includes(c.id);
        give(c, fights && c.hp > 0 ? 1 : rate, false);
      }
      for (const c of reserve) give(c, rate, true);
      return out;
    },
    /**
     * recovery after a battle (§4.12.1): win → the living get full HP and K.AFTER.mpPct (12 %, A18) of max
     * MP (rounded up); escape → the living get full HP; statuses always clear.
     * The fallen stay down. o.party / o.members as in award.
     */
    afterBattle(result, o) {
      o = o || {};
      const res = typeof result === 'string' ? result : result && result.result;
      const party = o.party || game().party;
      const A = K().AFTER;
      for (const c of party) {
        c.status = {};
        const fought = !o.members || o.members.includes(c.id);
        if (fought) {
          c.counts = Object.assign({ battles: 0, kills: 0, glimmers: 0 }, c.counts);
          c.counts.battles++;
        }
        if (!(c.hp > 0)) { c.hp = 0; continue; }
        if (res !== 'win' && res !== 'escape') continue;
        const st = R.Rules.stats(c);
        c.hp = st.hp;
        if (res === 'win') c.mp = Math.min(st.mp, (c.mp || 0) + Math.ceil(st.mp * A.mpPct));
      }
    },
    /** tavern / inn helper: heal everyone (party and reserve) */
    healAll() { R.State.healAll(); },

    // ----------------------------------------------------------- modifiers
    /**
     * a party-wide modifier: the 8 keys of §3.3.16 (*) come capped from
     * R.Rules.partyMods(); any other key is summed over the living active members
     * (booleans: anyone). The reserve's innates never count.
     */
    mod(key, party) {
      const K2 = K();
      if (K2.PARTY_KEYS.includes(key)) return R.Rules.partyMods(party)[key];
      party = party || game().party;
      let sum = 0, any = false;
      for (const c of party) {
        if (!(c.hp > 0)) continue;
        const v = R.Rules.mods(c)[key];
        if (typeof v === 'number') sum += v;
        else if (v === true) any = true;
      }
      return any && !sum ? true : sum;
    },
    /**
     * field modifiers (§3.3.4): encounterPct = the value with the largest size among
     * the living active members, 0 when equal sizes of both signs meet, within ±50;
     * walkHeal = the largest; noFloorDamage = anyone has it
     */
    fieldMods(party) {
      party = party || game().party;
      const vals = [];
      let walkHeal = 0, noFloor = false;
      for (const c of party) {
        if (!(c.hp > 0)) continue;
        const m = R.Rules.mods(c);
        if (m.encounterPct) vals.push(m.encounterPct);
        if (m.walkHeal > walkHeal) walkHeal = m.walkHeal;
        if (m.noFloorDamage) noFloor = true;
      }
      let enc = 0;
      if (vals.length) {
        const top = Math.max(...vals.map(Math.abs));
        const pos = vals.includes(top), neg = vals.includes(-top);
        enc = pos && neg ? 0 : pos ? top : -top;
      }
      const cap = K().MODCAP.encounter;
      return { encounterPct: U.clamp(enc, -cap, cap), walkHeal, noFloorDamage: noFloor };
    },

    // ------------------------------------------------------------- sprites
    spriteId(c) {
      if (!c) return 'hero_m_warrior';
      if (c.id === 'hero') return 'hero_' + (c.gender === 'f' ? 'f' : 'm') + '_' + (c.heroType || 'warrior');
      const d = DB.companions[c.id];
      return (d && d.sprite) || c.id;
    },
    /** 'party:<spriteId>' — hero 'party:hero_<m|f>_<type>', companion 'party:<id>' (§3.1.2) */
    spriteKey(c) { return 'party:' + Party.spriteId(c); },
    faceKey(c) { return 'face:' + Party.spriteId(c); },
  });
})(window.RPG);
