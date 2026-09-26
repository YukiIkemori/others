// Battle rules engine (DESIGN §3.3.8, §4.5–§4.13, §6.2.4, §7.3, §8.3.7, §9.1.6, §9.11.1). Pure logic, no DOM.
// Owner: battle (A2). The scene (battle_scene.js, bui) only animates the events produced here.
//
// An Engine resolves a battle as a stream of small events produced by generator functions. State is
// mutated exactly when the matching event is yielded, so the scene can animate every step in sync and
// the headless simulator (R.Battle.simulate) runs the very same code by draining the stream.
//
// Events (the table of §3.3.8 is the reference; fields added here are optional extras):
//   {t:'msg',text} {t:'actor',u} {t:'fx',fx,user,targets,ab,kind:'attack'|'ability'|'counter'}
//   {t:'dmg',u,n,crit,mp,kind:'phys'|'magic'|'breath'|'tier'|'fixed'|'percent'|'poison'|'burn'|'cost',src,el}
//   {t:'heal',u,n,mp,wp} {t:'miss',u,att,parry} {t:'crit',u} {t:'die',u,killer} {t:'revive',u}
//   {t:'status',u,s,on} {t:'buff',u,stat,d,dispel} {t:'flee',u} {t:'escape',ok} {t:'cover',u,ally} {t:'react',u,kind}
//   {t:'glimmer',u,id,kind} {t:'golden',u} {t:'summon',units:[idx]} {t:'phase',u,text,sprite}
//   {t:'gain',item,grade,stolen:true} {t:'drop',mon,name,item,grade,n} {t:'levelup',c,level,gains} {t:'prof',u,kind,id,rank}
//   {t:'victory'} {t:'jingle',id} {t:'pause'} {t:'clear'}
// The engine never plays sounds (R.sfx / R.jingle / shake belong to the scene).
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const B = (R.Battle = R.Battle || {});

  // ------------------------------------------------------------ constants
  // Fallbacks of R.Rules.K (§4.18.1); the live values are always read from R.Rules.K first.
  const KF = {
    STAGE: [0.63, 0.77, 1, 1.3, 1.6],
    DK: (L) => 40 + 5 * L,
    LZ: (T) => 6 + 6 * T,
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    ROW: { middleTaken: 0.7, weight: { front: 2, middle: 1 }, aimMiddle: { front: 1, middle: 3 } },
    AFTER: { mpPct: 0.1, wpPct: 0.1 },
    ESCAPE: { base: 0.55, step: 0.12, agi: 0.5, min: 0.25, max: 0.95 },
    PREEMPT: 1 / 16,
    MODCAP: { party: 150, preempt: 30, exp: 30, expMin: -100, cost: -50 },
    FALLOFF: { up: 0.75, downStep: 0.1, downMax: 10, min: 0.03 },
    RESERVE_RATE: 0.6,
    RARE_ENC: 80,
    RARE_MON: { lvOff: 2 },
    DEFEND: 0.5,
    DMG: { physRand: [0.9, 1.1], magRand: [0.95, 1.05], breathRand: [0.9, 1.1], fixedRand: [0.95, 1.05], max: 9999 },
    HIT: { min: 20, max: 100, blind: 0.5 },
    CRIT: { mult: 1.5 },
    EVA: { nimble: 25 },
    SF: { base: 128, div: 168, min: 0.6, max: 2.0 },
    METAL: { dmg: 1, critDmg: 2, hitMul: 3 },
    STATUS: { mndDiv: 500, resistCap: 0.9, pCap: 0.95, bossDebuff: 0.5 },
    STEAL: { base: 0.35, agiDiv: 200, min: 0.1, max: 0.8, boss: 0.5, rareMul: 4, rareCap: 0.5, autoRare: 0.5 },
    BOSS_RES: { death: 1, sleep: 0.75, paralyze: 0.75, freeze: 0.75, confuse: 0.75, stun: 0.5, silence: 0.5, blind: 0.5, poison: 0.25, burn: 0.25 },
  };
  function K(key) {
    const k = R.Rules && R.Rules.K;
    const v = k && k[key];
    const f = KF[key];
    if (v == null) return f;
    if (f && typeof f === 'object' && !Array.isArray(f) && typeof v === 'object' && !Array.isArray(v)) return Object.assign({}, f, v);
    return v;
  }
  const stageMult = (s) => K('STAGE')[U.clamp(s | 0, -2, 2) + 2];
  const dkOf = (L) => (R.Rules && R.Rules.dk ? R.Rules.dk(L) : (typeof K('DK') === 'function' ? K('DK')(L) : 40 + 5 * L));
  const LZ = (T) => { const f = K('LZ'); return typeof f === 'function' ? f(T) : 6 + 6 * T; };
  const Wt = (T) => { const w = K('W'); return w[U.clamp(T | 0, 0, w.length - 1)]; };
  const tierNow = () => (R.Tier && R.Tier.current ? R.Tier.current() : (R.Game && R.Game.tier) || 0);
  const glimTierNow = () => (R.Tier && R.Tier.effective ? R.Tier.effective() : R.Game ? (R.Game.gameClear ? 9 : R.Game.tier || 0) : 0);
  const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
  const LETTERS = 'ＡＢＣＤＥＦＧＨ';
  const EMPTY = Object.freeze({});
  const PARTY_KEYS = { goldPct: 1, dropPct: 1, rarePct: 1, superPct: 1, rareEncPct: 1, goldenPct: 1, escapePct: 1 };

  // statuses (§4.8.1, §7.9.2). DB.statuses (spells) is the reference; this is the fallback copy.
  const ST = {
    poison: { name: '毒', bad: true, turns: null, on: '{name}は毒におかされた！', off: '{name}の毒が消えた。' },
    burn: { name: 'やけど', bad: true, turns: [3, 3], on: '{name}はやけどを負った！', off: '{name}のやけどが治った。' },
    sleep: { name: '眠り', bad: true, turns: [2, 4], bossTurns: [1, 1], disable: true, on: '{name}は眠ってしまった！', off: '{name}は目を覚ました！' },
    paralyze: { name: 'まひ', bad: true, turns: [1, 3], bossTurns: [1, 1], disable: true, on: '{name}は体がしびれて動けない！', off: '{name}のまひが治った。' },
    freeze: { name: '凍結', bad: true, turns: [1, 2], bossTurns: [1, 1], disable: true, on: '{name}は凍りついた！', off: '{name}の氷が溶けた。' },
    stun: { name: '気絶', bad: true, turns: [1, 1], disable: true, on: '{name}は気を失った！', off: '{name}は気がついた。' },
    confuse: { name: '混乱', bad: true, turns: [2, 4], bossTurns: [1, 2], on: '{name}は混乱した！', off: '{name}は正気に戻った。' },
    silence: { name: '沈黙', bad: true, turns: [3, 5], on: '{name}は術を封じられた！', off: '{name}は術を使えるようになった。' },
    blind: { name: '暗闇', bad: true, turns: [3, 5], on: '{name}は目が見えなくなった！', off: '{name}の目が見えるようになった。' },
    death: { name: '即死', bad: true, instant: true, on: '{name}は息絶えた！', off: '' },
    regen: { name: '再生', bad: false, turns: [5, 5], on: '{name}は再生の力に包まれた！', off: '{name}の再生の力が消えた。' },
    veil: { name: '加護', bad: false, turns: [3, 3], on: '{name}は加護に守られた！', off: '{name}の加護が消えた。' },
    counter: { name: '反撃の構え', bad: false, turns: 'next', on: '{name}は反撃の構えをとった！', off: '' },
    nimble: { name: '身軽', bad: false, turns: [3, 3], on: '{name}は身軽になった！', off: '{name}の身軽さが消えた。' },
    cover: { name: 'かばう', bad: false, turns: 'next', on: '{name}は仲間の前に立ちはだかった！', off: '' },
  };
  function stDef(s) { const d = DB.statuses && DB.statuses[s]; return d ? Object.assign({}, ST[s], d) : ST[s] || { name: s, bad: true, turns: [3, 3], on: '', off: '' }; }
  const isDisabling = (s) => { const d = stDef(s); return !!(d.disable || s === 'sleep' || s === 'paralyze' || s === 'freeze' || s === 'stun'); };
  const DISABLE = ['sleep', 'paralyze', 'freeze', 'stun'];
  const GOOD = ['regen', 'veil', 'counter', 'nimble', 'cover'];
  function badStatuses() {
    const out = [];
    const keys = new Set(Object.keys(ST).concat(Object.keys(DB.statuses || {})));
    for (const s of keys) { const d = stDef(s); if (d.bad && !d.instant) out.push(s); }
    return out;
  }
  const fmtName = (text, name) => String(text || '').replace(/\{name\}/g, name);
  const SKIP_MSG = {
    sleep: (n) => `${n}は眠っている。`,
    paralyze: (n) => `${n}は体がしびれて動けない！`,
    freeze: (n) => `${n}は凍りついて動けない！`,
    stun: (n) => `${n}は気を失っている。`,
  };
  const NAMES = {
    elem: { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' },
    buff: { atk: '攻撃力', def: '守備力', mag: '術力', mdef: '術防', agi: '素早さ' },
    stat: { hp: '最大HP', mp: '最大MP', wp: '最大WP', str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' },
  };
  const elemName = (e) => (DB.elements && DB.elements[e] && DB.elements[e].name) || NAMES.elem[e] || e;
  // why an action cannot be chosen → help text (§11.5.3; STYLE_JA §9)
  const UNUSABLE_TEXT = { wp: 'WPが足りない！', mp: 'MPが足りない！', silence: '術を封じられている！', reach: '中列からは届かない。', field: '戦闘中は使えない。', noescape: 'この戦いからは逃げられない！', seal: 'この武器では技が使えない。', none: '今は使えない。' };

  // default normal-attack animation per lineage (monsters) and per weapon type (party; DB.weaponTypes[w].fx first)
  const MON_ATTACK_FX = {
    jelly: 'strike', rat: 'bite', bat: 'bite', paper: 'claw', crab: 'claw', seabird: 'pierce', bee: 'pierce', mushroom: 'strike',
    plant: 'bite', fairy: 'strike', treant: 'strike', scorpion: 'claw', snake: 'bite', mummy: 'claw', cactus: 'pierce', sandworm: 'bite',
    wolf: 'bite', yeti: 'claw', frostling: 'claw', owl: 'pierce', mammoth: 'strike', ghost: 'claw', wisp: 'strike', frog: 'strike',
    doll: 'slash', lizardman: 'slash', spider: 'bite', merman: 'pierce', kraken: 'strike', skeleton: 'slash', golem: 'strike',
    mole: 'claw', beetle: 'strike', crystal: 'strike', goblin: 'slash', salamander: 'bite', imp: 'claw', gargoyle: 'claw',
    orc: 'strike', chimera: 'bite', eyeball: 'strike', darkmage: 'strike', automaton: 'strike', armor: 'slash', wyvern: 'bite',
    scribe: 'strike', book: 'strike', mimic: 'bite', void: 'slash', chaos: 'bite', demon: 'claw', quicksilver: 'strike',
    mirror: 'strike', platinum: 'strike',
  };
  const WEAPON_FX = { sword: 'slash', greatsword: 'slash2', dagger: 'pierce', axe: 'slash2', spear: 'pierce', bow: 'arrow', club: 'strike', staff: 'strike', katana: 'slash', fist: 'strike', whip: 'lash' };
  const WTYPE_FALLBACK = {
    sword: { kind: 'slash', reach: false }, greatsword: { kind: 'slash', reach: false }, dagger: { kind: 'pierce', reach: false },
    axe: { kind: 'slash', reach: false }, spear: { kind: 'pierce', reach: true }, bow: { kind: 'pierce', reach: true },
    club: { kind: 'blunt', reach: false }, staff: { kind: 'blunt', reach: false }, katana: { kind: 'slash', reach: false },
    fist: { kind: 'blunt', reach: false }, whip: { kind: 'blunt', reach: true },
  };
  function wtypeInfo(w) {
    const d = DB.weaponTypes && DB.weaponTypes[w];
    const k = R.Rules && R.Rules.K && R.Rules.K.WTYPE && R.Rules.K.WTYPE[w];
    const f = WTYPE_FALLBACK[w] || { kind: 'blunt', reach: false };
    return {
      kind: (d && d.kind) || (k && k.kind) || f.kind,
      reach: d && d.reach != null ? !!d.reach : k && k.reach != null ? !!k.reach : f.reach,
      fx: (d && d.fx) || WEAPON_FX[w] || 'slash',
      name: (d && d.name) || w,
    };
  }
  /** the item of a weapon W (vs / drain / metalHit / sealTech / fx live on the item) */
  function weaponItem(W) { return (W && ((W.id && DB.items[W.id]) || W)) || EMPTY; }
  const FOE_T = { enemy: 1, enemies: 1, group: 1, random: 1 };
  const BATTLE_EFFECT = { damage: 1, heal: 1, healMp: 1, healWp: 1, revive: 1, cure: 1, status: 1, regen: 1, buff: 1, dispel: 1, steal: 1, scan: 1, escape: 1, grow: 1, cover: 1, summon: 1, special: 1 };
  const GATED = { status: 1, steal: 1, dispel: 1 };
  const hasBattleEffect = (a) => !!(a && a.effects && a.effects.some((e) => BATTLE_EFFECT[e.type]));
  /** a monster (or magic:true) action that silence blocks: magic:true or a magic-formula damage effect */
  const isMagicAct = (a) => !!(a && (a.magic || a.kind === 'spell' || (a.effects || []).some((e) => e.type === 'damage' && e.formula === 'magic')));
  const isPhysSingle = (a) => !!(a && a.target === 'enemy' && (a.effects || []).some((e) => e.type === 'damage' && (e.formula || 'phys') === 'phys'));

  // ---------------------------------------------------------------- units
  class Unit {
    constructor(side, key, eng) {
      this.side = side; this.key = key;
      Object.defineProperty(this, 'eng', { value: eng, enumerable: false, writable: true });
      this.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      this.turns = {}; // timed status → turns left ('next' = until the next own turn)
      this.defending = false;
      this.acts = 0; // actions taken so far ('every' conds)
      this.used = {}; // ids used this battle ('once' conds)
      this.gone = false; // ran away
    }
    get alive() { return this.hp > 0 && !this.gone; }
    get isParty() { return this.side === 'party'; }
    hpRate() { return this.mhp ? this.hp / this.mhp : 0; }
    /** asleep / paralysed / frozen / stunned */
    disabled() { for (const s of DISABLE) if (this.status[s]) return s; return null; }
    /** can take a turn of its own */
    canAct() { return this.alive && !this.disabled(); }
    /** can be given a command by the player */
    commandable() { return this.canAct() && !this.status.confuse; }
  }

  function normStats(st) {
    st = st || {};
    st.mods = st.mods || {};
    st.w = st.w || {};
    if (!st.w.fist) st.w.fist = { id: null, wtype: 'fist', atk: st.atk != null ? st.atk : 4, hit: st.hit != null ? st.hit : 90, crit: st.crit != null ? st.crit : 2, reach: false };
    if (st.mag == null) st.mag = st.int || 0;
    if (st.spd == null) st.spd = st.agi || 0;
    return st;
  }

  class PartyUnit extends Unit {
    constructor(c, i, eng) {
      super('party', 'p' + i, eng);
      this.c = c; this.idx = i;
      c.status = {}; // statuses never outlive a battle (§3.2.6): a fresh set for this one
      if (c.wp == null) c.wp = 0;
      if (c.mp == null) c.mp = 0;
      this.refresh();
    }
    refresh() {
      let st = null;
      try { st = R.Rules && R.Rules.stats ? R.Rules.stats(this.c) : null; } catch (e) { R.warn('battle: R.Rules.stats failed', this.c && this.c.id, e && e.message); }
      this.st = normStats(st);
      this.permRegen = !!this.st.mods.regen;
    }
    get name() { return this.c.name; }
    get hp() { return this.c.hp; }
    set hp(v) { this.c.hp = v; }
    get mp() { return this.c.mp; }
    set mp(v) { this.c.mp = v; }
    get wp() { return this.c.wp; }
    set wp(v) { this.c.wp = v; }
    get mhp() { return this.st.hp || 1; }
    get mmp() { return this.st.mp || 0; }
    get mwp() { return this.st.wp || 0; }
    get status() { return this.c.status; }
    set status(v) { this.c.status = v; }
    get mods() { return this.st.mods; }
    get boss() { return false; }
    get rare() { return false; }
    get metal() { return false; }
    get golden() { return false; }
    get level() { return this.c.level || 1; }
    get row() { return this.eng ? this.eng.effRow(this) : this.c.row || 'front'; }
    flag() { return false; }
    physMult() { return 1; }
    /** W of a command slot: 'weapon1'|'weapon2' (null if empty, fist when both are), null = fist, undefined = default */
    weapon(slot) {
      const w = this.st.w;
      const bare = !w.weapon1 && !w.weapon2;
      if (slot === 'weapon1' || slot === 'weapon2') return w[slot] || (bare ? w.fist : null);
      if (slot === null) return bare ? w.fist : w.weapon1 || w.weapon2;
      return w[this.defaultSlot()] || w.fist;
    }
    defaultSlot() { const w = this.st.w; return w.weapon1 ? 'weapon1' : w.weapon2 ? 'weapon2' : null; }
    /** the weapon commands of this member (§3.3.3 commands): slots with a weapon, or [null] (体術) when both are empty */
    attackSlots() { const w = this.st.w; const out = []; if (w.weapon1) out.push('weapon1'); if (w.weapon2) out.push('weapon2'); return out.length ? out : [null]; }
    /** the slot whose weapon is of type wtype (false = none) */
    slotFor(wtype) { for (const s of this.attackSlots()) { const W = this.weapon(s); if (W && W.wtype === wtype) return s; } return false; }
    stat(k) {
      const st = this.st;
      switch (k) {
        case 'atk': return (this.weapon() || {}).atk || 0;
        case 'hit': { const W = this.weapon(); return W && W.hit != null ? W.hit : st.hit || 90; }
        case 'crit': { const W = this.weapon(); return W && W.crit != null ? W.crit : st.crit || 0; }
        case 'spd': return st.spd != null ? st.spd : st.agi || 0;
        default: return st[k] || 0;
      }
    }
    elemMult(e) { const r = this.st.elemResist || this.st.mods.elemResist; return e && r && r[e] != null ? r[e] : 1; }
    elemBoost(e) { const b = this.st.mods.elemBoost; return (e && b && b[e]) || 0; }
    /** §4.8.3: statusImmune → 1, else min(0.9, 精神/500 + statusResist[s]) */
    resist(s) {
      const im = this.st.statusImmune || this.st.mods.statusImmune;
      if (im && im.includes(s)) return 1;
      const sr = this.st.statusResist || this.st.mods.statusResist;
      const S = K('STATUS');
      return Math.min(S.resistCap, (this.st.mnd || 0) / S.mndDiv + ((sr && sr[s]) || 0));
    }
  }

  // ボスの既定の耐性 (§4.8.3, K.BOSS_RES): the larger of this and the data applies to bosses and rare monsters
  const BOSS_RES = KF.BOSS_RES;

  class MonUnit extends Unit {
    /** entry: monster id or {id, golden, summoned} */
    constructor(entry, i, eng) {
      super('mon', 'm' + i, eng);
      const e = typeof entry === 'string' ? { id: entry } : entry || {};
      const id = e.id;
      const Lb = eng && eng.lv;
      let d = null;
      if (R.Mon && R.Mon.def) d = R.Mon.def(id, { Lb, golden: !!e.golden });
      if (!d) d = DB.monsters[id];
      this.id = id; this.idx = i; this.d = d;
      this.golden = !!(d.golden || e.golden) && !!d.golden;
      this.summoned = !!e.summoned;
      this.base = d.name; this.name = d.name;
      this.hp = this.mhp = Math.max(1, d.hp | 0);
      this.mp = this.mmp = 0;
      this.wp = this.mwp = 0;
      this.status = {};
      this.flags = (d.flags || []).slice();
      if (this.golden && !this.flags.includes('golden')) this.flags.push('golden');
      if (this.summoned) this.flags.push('summoned');
      this.stolen = false;
      this.permRegen = false;
      this.phaseDone = {};
    }
    /** species key for letters / groups (a golden individual is its own group) */
    get species() { return this.id + (this.golden ? '*' : ''); }
    get mods() { return EMPTY; }
    get boss() { return this.flags.includes('boss'); }
    get rare() { return this.flags.includes('rare'); }
    get metal() { return this.flags.includes('metal'); }
    get level() { return this.d.lv || 1; }
    get lvShow() { return this.d.lvShow || this.d.lv || 1; }
    get race() { return this.d.race; }
    flag(f) { return this.flags.includes(f) || this.d.race === f; }
    /** own copy of the (shared, cached) definition before changing it (boss phases) */
    ownDef() { if (!this._own) { this.d = Object.assign({}, this.d); this._own = true; } return this.d; }
    actsPerTurn() { return U.clamp(this.d.actsPerTurn || 1, 1, 3); }
    stat(k) {
      const d = this.d;
      switch (k) {
        case 'hit': return d.hit != null ? d.hit : 95;
        case 'eva': return d.eva != null ? d.eva : 5;
        case 'crit': return d.crit != null ? d.crit : this.boss ? 3 : 2;
        case 'spd': case 'agi': return d.agi || 1;
        case 'dex': return d.dex != null ? d.dex : d.agi || 1;
        case 'int': return d.mag || 0;
        case 'mnd': return d.mnd || 0;
        default: return d[k] || 0;
      }
    }
    elemMult(e) { return e && this.d.elem && this.d.elem[e] != null ? this.d.elem[e] : 1; }
    elemBoost() { return 0; }
    physMult(k) { return k && this.d.phys && this.d.phys[k] != null ? this.d.phys[k] : 1; }
    resist(s) {
      if (this.metal) return 1; // 鋼: no status, death or debuff lands (§4.10.5)
      const r = this.d.statusRes;
      const v = r && r[s] != null ? r[s] : 0;
      if (this.boss || this.rare) return Math.max(v, K('BOSS_RES')[s] || 0);
      return v;
    }
  }

  // --------------------------------------------------------------- engine
  class Engine {
    /**
     * o: {party:[CharState], reserve:[CharState] (bench: 60 % EXP), mons:[monId | {id, golden, summoned}], inv:{id:n},
     *     live (writes R.Game: bestiary, gold, items, R.Battle.last, after-battle recovery), noEscape, canLose,
     *     surprise:'pre'|null (forced), noSurprise, tier (Tb), lv (Lb), glimTier (R.Tier.effective), glimmerForce:'hero',
     *     zone, troop, rare, after (non-live: apply the after-battle recovery in finish())}
     */
    constructor(o) {
      o = this.o = o || {};
      this.live = !!o.live;
      this.inv = o.inv || {};
      const meta = (o.mons && o.mons.meta) || {};
      this.tier = o.tier != null ? o.tier : meta.Tb != null ? meta.Tb : tierNow();
      const entries = (o.mons || []).map((e, i) => {
        const x = typeof e === 'string' ? { id: e } : Object.assign({}, e);
        if (meta.golden === i) x.golden = true;
        return x;
      }).filter((e) => {
        if (DB.monsters[e.id]) return true;
        R.warn('battle: unknown monster', e.id);
        return false;
      });
      let lv = o.lv != null ? o.lv : meta.Lb;
      if (lv == null) lv = entries.reduce((m, e) => Math.max(m, DB.monsters[e.id].lv || 1), 1);
      this.lv = Math.max(1, Math.round(lv));
      this.dk = dkOf(this.lv);
      this.glimTier = o.glimTier != null ? o.glimTier : glimTierNow();
      this.party = (o.party || []).map((c, i) => new PartyUnit(c, i, this));
      this.bench = o.reserve != null ? o.reserve : this.live && R.Game ? (R.Game.reserve || []).slice() : [];
      this.mons = entries.map((e, i) => new MonUnit(e, i, this));
      this.relabel();
      this.boss = this.mons.some((m) => m.boss);
      this.rare = this.mons.some((m) => m.rare);
      this.golden = this.mons.some((m) => m.golden);
      this.metal = this.mons.some((m) => m.metal);
      this.noEscape = !!o.noEscape || this.boss;
      this.canLose = !!o.canLose;
      // glimmer rank / enemy factor of the battle, from the monsters present at the start (§4.9.2)
      const gp = R.Glimmer && R.Glimmer.params ? safe(() => R.Glimmer.params(this.mons.map((u) => ({ def: u.d, flags: u.flags, golden: u.golden })), this.tier), null) : null;
      this.rankB = gp ? gp.rankB : this.mons.reduce((m, u) => Math.max(m, R.Mon && R.Mon.rank ? R.Mon.rank(u.d, this.tier) : this.tier + 1), this.tier + 1);
      this.ef = gp ? gp.ef : this.mons.reduce((m, u) => Math.max(m, R.Mon && R.Mon.ef ? R.Mon.ef(u.d) : 1), 1);
      this.forceGlim = o.glimmerForce === 'hero' ? 'hero' : null;
      this.forceUsed = false;
      this.round = 0;
      this.escapeFails = 0;
      this.result = null;
      this.surprise = null;
      this.killed = [];
      this.stolen = [];
      this.glimmers = [];
      this.profUps = [];
      this.reactQ = [];
      this.said = 0;
      this.coverSeq = 0;
      this.phaseQ = new Set();
      this.stats = { dealt: 0, taken: 0, deaths: 0, mpUsed: 0, wpUsed: 0, casts: {}, techs: {}, items: 0 };
      this.finished = false;
    }

    // ------------------------------------------------------- queries
    units() { return this.party.concat(this.mons); }
    living(side) { return (side === 'party' ? this.party : this.mons).filter((u) => u.alive); }
    foes(u) { return this.living(u.isParty ? 'mon' : 'party'); }
    friends(u) { return this.living(u.side); }
    leaderName() { const l = this.party.find((p) => p.alive) || this.party[0]; return l ? l.name : ''; }
    /** monster groups in display order: [{id, key, name, units, n (alive), golden}] */
    groups(all) {
      const out = [], by = {};
      for (const m of this.mons) {
        if (!all && !m.alive) continue;
        let g = by[m.species];
        if (!g) { g = by[m.species] = { id: m.id, key: m.species, name: m.base, units: [], n: 0, golden: m.golden, metal: m.metal, rare: m.rare }; out.push(g); }
        g.units.push(m); g.n++;
      }
      return out;
    }
    /** duplicate species get full-width letters Ａ…Ｈ */
    relabel() {
      const by = {};
      for (const m of this.mons) (by[m.species] = by[m.species] || []).push(m);
      for (const k in by) {
        const l = by[k];
        l.forEach((m, i) => { m.name = l.length > 1 && i < LETTERS.length ? m.base + LETTERS[i] : m.base; });
      }
    }
    checkEnd() {
      if (this.result) return this.result;
      if (!this.party.some((p) => p.alive)) this.result = 'lose';
      else if (!this.mons.some((m) => m.alive)) this.result = 'win';
      return this.result;
    }
    m(text) { this.said++; return { t: 'msg', text }; }
    pct(u, key) { return u.isParty ? u.mods[key] || 0 : 0; }
    /** a party-wide mod: sum over the living members of this battle, capped (§3.3.16) */
    partyMod(key) {
      let s = 0;
      for (const p of this.party) if (p.alive) s += p.mods[key] || 0;
      const cap = K('MODCAP');
      if (key === 'preemptPct') return Math.min(cap.preempt, s);
      if (PARTY_KEYS[key]) return Math.min(cap.party, s);
      return s;
    }
    partyMods() { const o = {}; for (const k in PARTY_KEYS) o[k] = this.partyMod(k); o.preemptPct = this.partyMod('preemptPct'); return o; }
    /** effective row (§4.5.3): a middle-row member counts as front when no front-row member is alive */
    effRow(u) {
      if (!u.isParty) return 'front';
      if ((u.c.row || 'front') !== 'middle') return 'front';
      return this.party.some((p) => p.alive && (p.c.row || 'front') !== 'middle') ? 'middle' : 'front';
    }
    /** can the weapon of slot reach from u's row */
    slotReaches(u, slot) {
      const W = u.weapon(slot);
      if (!W) return false;
      if (W.reach === true || W.reach === 'any') return true;
      if (W.reach === false || W.reach === 'front') return false;
      return wtypeInfo(W.wtype).reach;
    }
    canReach(u, slot) { return this.effRow(u) !== 'middle' || this.slotReaches(u, slot); }
    /** why u cannot 攻撃 with slot (null = it can) */
    attackIssue(u, slot) { return u.isParty && !this.canReach(u, slot) ? 'reach' : null; }
    wpCost(u, id) {
      const a = DB.actions[id];
      if (!u.isParty || !a || !a.wp) return 0;
      if (R.Rules && R.Rules.wpCost) { try { const n = R.Rules.wpCost(u.c, id); if (n != null) return n; } catch (e) { /* fallback */ } }
      return Math.max(1, Math.round(a.wp * (1 + Math.max(K('MODCAP').cost, u.mods.wpCostPct || 0) / 100)));
    }
    mpCost(u, id) {
      const a = DB.actions[id];
      if (!u.isParty || !a || !a.mp) return 0;
      if (R.Rules && R.Rules.mpCost) { try { const n = R.Rules.mpCost(u.c, id); if (n != null) return n; } catch (e) { /* fallback */ } }
      return Math.max(1, Math.round(a.mp * (1 + Math.max(K('MODCAP').cost, u.mods.mpCostPct || 0) / 100)));
    }
    cost(u, id) { return { wp: this.wpCost(u, id), mp: this.mpCost(u, id) }; }
    /**
     * why an action cannot be chosen right now (null = usable):
     * 'wp' | 'mp' | 'silence' | 'reach' | 'field' | 'noescape' | 'seal' (sealTech weapon) | 'none'
     */
    unusable(u, id, slot) {
      const a = DB.actions[id];
      if (!a) {
        const it = DB.items[id];
        if (!it) return 'none';
        if (!it.use || !it.use.battle || !hasBattleEffect(it.use)) return 'field';
        if (this.count(id) <= 0) return 'none';
        if (u.isParty && this.noEscape && B.isEscape(it.use)) return 'noescape';
        return null;
      }
      if (u.isParty) {
        if (a.kind === 'tech') {
          const s = slot !== undefined ? slot : u.slotFor(a.wtype);
          const W = s === false ? null : u.weapon(s);
          if (!W || W.wtype !== a.wtype) return 'none';
          if (weaponItem(W).sealTech) return 'seal';
          if (a.magic && u.status.silence) return 'silence';
          if (this.effRow(u) === 'middle' && !a.reach) return 'reach';
          if (u.wp < this.wpCost(u, id)) return 'wp';
        } else if (a.kind === 'spell') {
          if (u.mods.noSpell) return 'none';
          if (u.status.silence) return 'silence';
          if (u.mp < this.mpCost(u, id)) return 'mp';
        } else if (a.magic && u.status.silence) return 'silence';
      } else if (isMagicAct(a) && u.status.silence) return 'silence';
      if (!hasBattleEffect(a)) return 'field';
      if (u.isParty && this.noEscape && B.isEscape(a)) return 'noescape';
      return null;
    }
    weaponFx(u, slot) {
      if (u.isParty) {
        const W = u.weapon(slot);
        const it = W && W.id ? DB.items[W.id] : null;
        return (it && it.fx) || wtypeInfo(W ? W.wtype : 'fist').fx;
      }
      const d = u.d;
      return d.attackFx || MON_ATTACK_FX[d.lineage] || MON_ATTACK_FX[String(d.sprite || '').split('_')[0]] || 'claw';
    }

    // ------------------------------------------------------ inventory
    count(id) { return this.inv[id] || 0; }
    takeItem(id) {
      if (this.live && R.State && R.Game && this.inv === R.Game.inv && R.State.removeItem) return R.State.removeItem(id, 1);
      if (!this.inv[id]) return false;
      if (--this.inv[id] <= 0) delete this.inv[id];
      return true;
    }
    canCarry(id, n) { return !!DB.items[id] && (this.inv[id] || 0) + (n || 1) <= 99; }
    giveItem(id, n) {
      n = n || 1;
      if (!this.canCarry(id, n)) return false;
      if (this.live && R.State && R.Game && this.inv === R.Game.inv && R.State.addItem) return R.State.addItem(id, n) !== false;
      this.inv[id] = Math.min(99, (this.inv[id] || 0) + n);
      return true;
    }

    // ------------------------------------------------------- start
    *begin() {
      for (const g of this.groups()) {
        const u0 = g.units[0];
        if (u0.golden) yield { t: 'golden', u: u0 };
        yield this.m(g.n > 1 ? `${g.name}が${g.n}匹現れた！` : `${g.name}が現れた！`);
        if (g.n === 1 && u0.d.appear) yield this.m(u0.d.appear.replace(/\{user\}/g, u0.name)); // rare monsters' own entrance line (§11.5.9)
      }
      if (this.live && R.State && R.Game && R.State.seen) for (const id of new Set(this.mons.map((m) => m.id))) R.State.seen(id);
      if (this.o.surprise !== undefined) this.surprise = this.o.surprise === 'pre' ? 'pre' : null; // forced (no ambushes, §4.11.2)
      else if (!this.o.noSurprise && !this.boss && U.chance(this.preemptChance())) this.surprise = 'pre';
      if (this.surprise === 'pre') yield this.m('魔物たちは、まだこちらに気づいていない。\n先手を取った！');
      for (const p of this.party) {
        const sb = p.mods.startBuffs;
        if (!p.alive || !sb) continue;
        for (const k in sb) {
          if (!BUFF_STATS.includes(k)) continue;
          const nv = U.clamp(p.buffs[k] + sb[k], -2, 2);
          if (nv !== p.buffs[k]) { const d = nv - p.buffs[k]; p.buffs[k] = nv; yield { t: 'buff', u: p, stat: k, d, start: true }; }
        }
      }
    }
    /** §4.11.2: 1/16 × clamp(party avg speed / monster avg speed, 0.5, 2) + preemptPct/100 */
    preemptChance() {
      const avg = (l) => (l.length ? l.reduce((s, u) => s + u.stat('spd'), 0) / l.length : 1);
      const ratio = U.clamp(avg(this.living('party')) / Math.max(1, avg(this.living('mon'))), 0.5, 2);
      return K('PREEMPT') * ratio + this.partyMod('preemptPct') / 100;
    }

    // ------------------------------------------------------- rounds
    /**
     * One round. cmds: array by party index of
     *   {type:'attack', slot, target} {type:'tech', id, slot, target} {type:'spell', id, target}
     *   {type:'item', id, target} {type:'defend'}           (legacy {type:'ability', id} is read as tech / spell)
     * or cmds.flee = true for the whole party. Targets are Unit objects of this engine.
     */
    *playRound(cmds) {
      if (this.result) return;
      this.round++;
      const pre = this.round === 1 && this.surprise === 'pre';
      cmds = cmds || [];
      let partyActs = true;
      if (cmds.flee) {
        if (yield* this.tryEscape(pre)) { this.checkEnd(); return; }
        partyActs = false;
      }
      const order = [];
      const init = (u) => u.stat('spd') * stageMult(u.buffs.agi) * U.rf(0.75, 1.0);
      if (partyActs) {
        for (const p of this.party) {
          if (!p.alive) continue;
          const cmd = cmds[p.idx] || null;
          p.defending = !!cmd && cmd.type === 'defend' && p.commandable();
          const quick = p.defending || (cmd && p.commandable() && this.isQuick(cmd));
          order.push({ u: p, cmd, v: init(p) + (quick ? 10000 : 0) });
        }
      }
      if (!pre) {
        for (const m of this.mons) {
          if (!m.alive) continue;
          const n = m.actsPerTurn();
          for (let k = 0; k < n; k++) order.push({ u: m, cmd: null, v: init(m) });
        }
      }
      order.sort((a, b) => b.v - a.v);
      this.pending = order.filter((s) => s.u.isParty && s.cmd); // party commands still to come (focus-fire retargeting)
      for (const s of order) {
        if (this.checkEnd()) break;
        if (s.u.isParty) this.pending = this.pending.filter((x) => x !== s);
        if (!s.u.alive) continue;
        yield* this.turn(s.u, s.cmd);
      }
      this.pending = null;
      for (const u of this.units()) u.defending = false;
      this.checkEnd();
    }
    isQuick(cmd) {
      if (cmd.type === 'tech' || cmd.type === 'spell' || cmd.type === 'ability') { const a = DB.actions[cmd.id]; return !!(a && a.quick); }
      return false;
    }

    *turn(u, cmd) {
      yield* this.clearNext(u);
      if (u.isParty && !cmd && u.commandable()) {
        // nothing chosen (revived this round, …): only end-of-turn upkeep, announced if anything happens
        let first = true;
        for (const ev of this.endTurn(u)) { if (first) { first = false; yield { t: 'actor', u }; } yield ev; }
        u.acts++;
        return;
      }
      yield { t: 'actor', u };
      const dis = u.disabled();
      if (dis) {
        // 眠り・まひ・凍結・気絶: the turn is skipped, and skipped turns count the status down (§4.8.1)
        yield this.m(SKIP_MSG[dis] ? SKIP_MSG[dis](u.name) : `${u.name}は動けない！`);
        const left = (typeof u.turns[dis] === 'number' ? u.turns[dis] : 1) - 1;
        if (left <= 0) yield* this.clearStatus(u, dis);
        else u.turns[dis] = left;
        yield* this.afterAction();
        if (!this.checkEnd()) yield* this.endTurn(u);
        u.acts++;
        return;
      }
      if (u.status.confuse) {
        yield this.m(`${u.name}は混乱している！`);
        cmd = this.confusedCommand(u);
      } else if (!u.isParty) {
        if (this.monFlees(u)) {
          u.gone = true;
          yield this.m(`${u.name}は逃げ出した！`);
          yield { t: 'flee', u };
          this.checkEnd();
          return;
        }
        cmd = R.BattleAI && R.BattleAI.monster ? R.BattleAI.monster(this, u) : { type: 'attack', target: U.pick(this.foes(u)) };
      }
      if (cmd) yield* this.execute(u, cmd);
      yield* this.flushReactions();
      yield* this.afterAction();
      if (!this.checkEnd()) yield* this.endTurn(u);
      u.acts++;
    }
    /** a rare / metal monster may run at its turn (§4.10.3, §4.10.5) */
    monFlees(u) {
      if (u.boss) return false;
      const rate = u.d.fleeRate != null ? u.d.fleeRate : u.flags.includes('flee') ? 0.3 : 0;
      if (!rate) return false;
      if (this.round < (u.d.fleeFrom || 1)) return false;
      return U.chance(rate);
    }
    /** 反撃の構え and かばう last until the owner's next turn starts (§6.2.4-A2) */
    *clearNext(u) {
      for (const s of ['counter', 'cover']) {
        if (u.status[s] && u.turns[s] === 'next') {
          delete u.status[s]; delete u.turns[s];
          yield { t: 'status', u, s, on: false };
        }
      }
    }
    confusedCommand(u) {
      const mates = this.friends(u).filter((f) => f !== u);
      const foes = this.foes(u);
      const t = mates.length && (U.chance(0.5) || !foes.length) ? U.pick(mates) : U.pick(foes);
      return { type: 'attack', target: t || u, confused: true, slot: u.isParty ? u.defaultSlot() : undefined };
    }
    normCmd(u, cmd) {
      cmd = Object.assign({}, cmd);
      if (cmd.type === 'ability' && u.isParty) {
        const a = DB.actions[cmd.id];
        cmd.type = a && a.kind === 'spell' ? 'spell' : 'tech';
      }
      if (u.isParty && cmd.type === 'attack' && cmd.slot === undefined) cmd.slot = u.defaultSlot();
      if (u.isParty && cmd.type === 'tech' && cmd.slot === undefined) { const a = DB.actions[cmd.id]; const s = a ? u.slotFor(a.wtype) : false; cmd.slot = s === false ? undefined : s; }
      return cmd;
    }

    *execute(u, cmd) {
      cmd = this.normCmd(u, cmd);
      if (u.isParty && !cmd.confused) {
        const g = yield* this.glimmerStep(u, cmd);
        if (g && g.replace) {
          const r = yield* this.useAction(u, g.id, g.act, g.target, { slot: g.slot, free: true, glimmed: true });
          yield* this.trainAfter(u, g.act.kind === 'spell' ? { kind: 'spell', act: g.act, id: g.id } : { kind: 'tech', act: g.act, id: g.id, slot: g.slot }, r);
          return;
        }
      }
      switch (cmd.type) {
        case 'attack': {
          if (u.isParty && !cmd.confused && !this.canReach(u, cmd.slot)) {
            // the row changed since the command was chosen: guard instead of swinging at air
            u.defending = true;
            yield this.m(`${u.name}は守りを固めている。`);
            return;
          }
          const r = yield* this.attack(u, cmd.target, { slot: cmd.slot, confused: cmd.confused });
          if (u.isParty && !cmd.confused) yield* this.trainAfter(u, { kind: 'attack', slot: cmd.slot }, r);
          return;
        }
        case 'defend':
          u.defending = true;
          yield this.m(`${u.name}は守りを固めている。`);
          return;
        case 'wait':
          yield this.m(`${u.name}はじっとこちらを見ている。`);
          return;
        case 'flee':
          if (!u.isParty && !u.boss) {
            u.gone = true;
            yield this.m(`${u.name}は逃げ出した！`);
            yield { t: 'flee', u };
          }
          return;
        case 'tech': case 'spell': case 'ability': {
          const a = DB.actions[cmd.id];
          if (!a) return yield* this.attack(u, cmd.target, { slot: cmd.slot });
          const r = yield* this.useAction(u, cmd.id, a, cmd.target, { slot: cmd.slot });
          if (u.isParty && r.done) yield* this.trainAfter(u, a.kind === 'spell' ? { kind: 'spell', act: a, id: cmd.id } : { kind: 'tech', act: a, id: cmd.id, slot: cmd.slot }, r);
          return;
        }
        case 'item': {
          const it = DB.items[cmd.id];
          if (!it || !it.use) return;
          const r = yield* this.useAction(u, cmd.id, it.use, cmd.target, { item: it });
          if (u.isParty && it.stone && r.done) yield* this.trainAfter(u, { kind: 'spell', stone: it.stone, id: cmd.id }, r);
          return;
        }
      }
    }

    // ------------------------------------------------------- 閃き (glimmer, §3.3.7, §4.9.2)
    /**
     * Just before a party member's attack / tech / spell / 魔石, roll R.Glimmer once. On a hit: {t:'glimmer'},
     * the line 「〜は〈技名〉を閃いた！」, learn, and return the replacement action (used at no cost).
     * glimmerForce 'hero': the hero's first action always glimmers, whatever it is (§3.3.7).
     */
    *glimmerStep(u, cmd) {
      const c = u.c;
      const force = this.forceGlim === 'hero' && !this.forceUsed && c.id === 'hero';
      if (force) this.forceUsed = true;
      let ctx = null;
      if (cmd.type === 'attack') {
        const W = u.weapon(cmd.slot);
        if (W && this.canReach(u, cmd.slot) && this.foes(u).length) ctx = { kind: 'tech', wtype: W.wtype, used: 'attack', sealTech: !!weaponItem(W).sealTech };
      } else if (cmd.type === 'tech') {
        const a = DB.actions[cmd.id];
        if (a && !this.unusable(u, cmd.id, cmd.slot)) ctx = { kind: 'tech', wtype: a.wtype, used: cmd.id };
      } else if (cmd.type === 'spell') {
        const a = DB.actions[cmd.id];
        if (a && !this.unusable(u, cmd.id) && this.targets(u, a, cmd.target).length) ctx = { kind: 'spell', elements: (a.elements || []).slice(), used: cmd.id };
      } else if (cmd.type === 'item') {
        const it = DB.items[cmd.id];
        if (it && it.stone && this.count(cmd.id) > 0) ctx = { kind: 'spell', elements: [it.stone], used: cmd.id, stone: true };
      }
      if (!ctx && !force) return null;
      if (!ctx) ctx = { kind: 'tech', wtype: null, used: cmd.type }; // 防御・道具 under glimmerForce: R.Glimmer falls back to weapon 1's type
      let res = null;
      {
        const W1 = u.weapon(u.defaultSlot());
        Object.assign(ctx, { rankB: this.rankB, ef: this.ef, tier: this.glimTier, row: this.effRow(u), silenced: !!u.status.silence, force, fallbackWtype: W1 ? W1.wtype : 'fist' });
        if (R.Glimmer && R.Glimmer.roll) {
          try { res = R.Glimmer.roll(c, ctx); } catch (e) { R.warn('battle: R.Glimmer.roll failed', e && e.message); res = null; }
        }
      }
      if (!res && force) res = this.forcedGlimmer(u);
      if (!res || !DB.actions[res.id]) return null;
      const id = res.id, a = DB.actions[id];
      const kind = a.kind === 'spell' ? 'spell' : 'tech';
      this.learn(u, id, a);
      yield { t: 'glimmer', u, id, kind };
      yield this.m(`${u.name}は${a.name}を閃いた！`);
      this.glimmers.push({ char: c.id, id, kind });
      const target = this.glimTarget(u, cmd, a);
      // a new spell with nothing to act on (蘇生 with nobody down): learnt, and the original action goes ahead (§7.0 0.12)
      if (kind === 'spell' && !this.targets(u, a, target).length) return { replace: false };
      let slot;
      if (kind === 'tech') {
        slot = cmd.type === 'attack' || cmd.type === 'tech' ? cmd.slot : undefined;
        const W = slot === undefined ? null : u.weapon(slot);
        if (!W || W.wtype !== a.wtype) { const s = u.slotFor(a.wtype); slot = s === false ? u.defaultSlot() : s; }
      }
      return { replace: true, id, act: a, target, slot };
    }
    /** glimmerForce fallback: the unknown tech of weapon 1's type (体術 when bare) with the lowest glim.lv */
    forcedGlimmer(u) {
      const W = u.weapon(u.defaultSlot());
      const wtype = W ? W.wtype : 'fist';
      const known = new Set(u.c.techs || []);
      const middle = this.effRow(u) === 'middle';
      let best = null;
      for (const id in DB.actions) {
        const a = DB.actions[id];
        if (!a || a.kind !== 'tech' || a.wtype !== wtype || known.has(id)) continue;
        if (middle && !a.reach) continue;
        if (a.magic && u.status.silence) continue;
        const lv = (a.glim && a.glim.lv) || a.rank || 99;
        if (!best || lv < best.lv) best = { id, lv };
      }
      return best ? { id: best.id, kind: 'tech' } : null;
    }
    learn(u, id, a) {
      const c = u.c;
      if (R.Glimmer && R.Glimmer.learn) {
        // a simulated battle learns on its clone only (no book / records / event)
        try { R.Glimmer.learn(c, id, this.live ? undefined : { record: false }); return; } catch (e) { R.warn('battle: R.Glimmer.learn failed', e && e.message); }
      }
      const key = a.kind === 'spell' ? 'spells' : 'techs';
      c[key] = c[key] || [];
      if (!c[key].includes(id)) c[key].push(id);
      if (c.counts) c.counts.glimmers = (c.counts.glimmers || 0) + 1;
      if (this.live && R.Game) {
        if (R.State && R.State.noteLearned) R.State.noteLearned(c.id, id);
        if (R.Game.records) R.Game.records.glimmers = (R.Game.records.glimmers || 0) + 1;
        R.emit('glimmer', c, id, a.kind);
      }
    }
    /** target of the replacing action (§4.9.2-5) */
    glimTarget(u, cmd, a) {
      const orig = cmd.type === 'attack' ? { target: 'enemy' } : cmd.type === 'defend' ? null
        : DB.actions[cmd.id] || (DB.items[cmd.id] && DB.items[cmd.id].use) || null;
      const newFoe = !!FOE_T[a.target];
      if (orig && !!FOE_T[orig.target] === newFoe) {
        const t = cmd.target;
        if (!newFoe) return t || null;
        if (t && t.alive && t.side !== u.side) return t;
        const foes = this.foes(u);
        if (t && !t.isParty) { const same = foes.filter((m) => m.species === t.species); if (same.length) return U.pick(same); }
        return U.pick(foes) || null;
      }
      if (newFoe) return U.pick(this.foes(u)) || null;
      if (a.target === 'ally' || a.target === 'ally_any') return this.friends(u).slice().sort((x, y) => x.hpRate() - y.hpRate())[0] || u;
      return null;
    }
    /** 熟練度: R.Rules.train after every attack / tech / spell / 魔石 of a party member (§3.3.3, §4.9.1) */
    *trainAfter(u, info, r) {
      if (!R.Rules || !R.Rules.train || !r || r.done === false) return;
      const tgt = (r && r.target) || (r && r.targets && r.targets[0]) || null;
      const x = { kind: info.kind, actionId: info.id || (info.kind === 'attack' ? 'attack' : undefined), killed: !!(r && r.killed), tier: this.glimTier };
      if (info.kind === 'attack' || info.kind === 'tech') {
        const slot = info.slot !== undefined ? info.slot : info.act ? u.slotFor(info.act.wtype) : u.defaultSlot();
        const W = u.weapon(slot === false ? undefined : slot);
        x.slot = slot === false ? null : slot;
        x.wtype = info.act ? info.act.wtype : W ? W.wtype : 'fist';
      } else {
        x.elements = info.stone ? [info.stone] : (info.act && info.act.elements) || [];
        if (info.stone) x.stone = true;
      }
      x.mon = tgt && !tgt.isParty ? { lv: tgt.level, rank: this.rankB, boss: tgt.boss } : { lv: this.lv, rank: this.rankB, boss: this.boss };
      let ups = null;
      try { ups = R.Rules.train(u.c, x); } catch (e) { R.warn('battle: R.Rules.train failed', e && e.message); }
      for (const up of ups || []) {
        this.profUps.push(Object.assign({ char: u.c.id }, up));
        yield { t: 'prof', u, kind: up.kind, id: up.id, rank: up.rank };
      }
    }

    // ------------------------------------------------------- upkeep
    *endTurn(u) {
      if (!u.alive) return;
      // upkeep (poison, burn, regen, countdowns) once per round, even for monsters acting 2–3 times
      if (this.round > 0 && u.upkeep === this.round) return;
      u.upkeep = this.round;
      const taken = u.isParty ? Math.max(0, 1 + (u.mods.takenPct || 0) / 100) : 1;
      const dot = (div, bossDiv) => Math.min(999, Math.max(1, Math.floor((u.mhp / (u.boss ? bossDiv : div)) * taken)));
      if (u.status.poison) {
        yield* this.dotDamage(u, dot(16, 64), 'poison', '毒');
        if (!u.alive) return;
      }
      if (u.status.burn) {
        yield* this.dotDamage(u, dot(10, 40), 'burn', 'やけど');
        if (!u.alive) return;
      }
      if (u.status.regen && u.hp < u.mhp) yield* this.restore(u, Math.max(1, Math.floor(u.mhp / (u.isParty ? 10 : 20))), 'hp', 'regen');
      else if (u.permRegen && u.hp < u.mhp) yield* this.restore(u, Math.max(1, Math.floor(u.mhp / 20)), 'hp', 'regen');
      if (u.isParty) {
        if (u.mods.mpRegen && u.mp < u.mmp) yield* this.restore(u, u.mods.mpRegen, 'mp', 'quiet');
        if (u.mods.wpRegen && u.wp < u.mwp) yield* this.restore(u, u.mods.wpRegen, 'wp', 'quiet');
        if (u.mods.hpLoss > 0 && u.hp > 1) {
          const n = Math.min(u.hp - 1, Math.max(1, Math.floor(u.mhp * u.mods.hpLoss / 100)));
          if (n > 0) { u.hp -= n; this.stats.taken += n; yield { t: 'dmg', u, n, kind: 'cost' }; }
        }
      }
      for (const s of Object.keys(u.status)) {
        if (!u.status[s] || isDisabling(s)) continue;
        if (typeof u.turns[s] !== 'number') continue;
        if ((u.turns[s] -= 1) <= 0) yield* this.clearStatus(u, s);
      }
    }
    *dotDamage(u, n, kind, label) {
      u.hp = Math.max(0, u.hp - n);
      if (u.isParty) this.stats.taken += n; else this.stats.dealt += n;
      yield { t: 'dmg', u, n, kind };
      yield this.m(`${label}で${u.name}に${n}のダメージ！`);
      if (u.hp <= 0) yield* this.die(u, null);
    }
    *clearStatus(u, s, quiet) {
      if (!u.status[s]) return false;
      delete u.status[s];
      delete u.turns[s];
      yield { t: 'status', u, s, on: false };
      const off = stDef(s).off;
      if (!quiet && off) yield this.m(fmtName(off, u.name));
      return true;
    }
    /** boss phases (§9.11.1): at the end of an action, once per threshold crossed */
    *afterAction() {
      if (!this.phaseQ.size) return;
      const list = [...this.phaseQ];
      this.phaseQ.clear();
      for (const m of list) {
        const ph = m.d.phases;
        if (!ph || !m.alive) continue;
        for (let i = 0; i < ph.length; i++) {
          const p = ph[i];
          if (m.phaseDone[i] || !(m.hpRate() < (p.hpBelow != null ? p.hpBelow : 0.5))) continue;
          m.phaseDone[i] = true;
          const set = p.set || {};
          const d = m.ownDef();
          if (set.actsPerTurn != null) d.actsPerTurn = set.actsPerTurn;
          if (set.elem) d.elem = Object.assign({}, d.elem, set.elem);
          if (set.phys) d.phys = Object.assign({}, d.phys, set.phys);
          if (set.sprite) d.sprite = set.sprite;
          if (set.buffs) for (const k in set.buffs) if (BUFF_STATS.includes(k)) m.buffs[k] = U.clamp(m.buffs[k] + set.buffs[k], -2, 2);
          yield { t: 'phase', u: m, text: p.msg || '', sprite: set.sprite || null };
        }
      }
    }

    // ------------------------------------------------------- escape
    *tryEscape(sure) {
      yield { t: 'actor', u: null };
      if (this.noEscape) {
        yield { t: 'escape', ok: false };
        yield this.m('この戦いからは逃げられない！');
        return false;
      }
      yield this.m('{hero}たちは逃げ出した。');
      if (sure || U.chance(this.escapeChance())) {
        this.result = 'escape';
        yield { t: 'escape', ok: true };
        return true;
      }
      this.escapeFails++;
      yield { t: 'escape', ok: false };
      yield this.m('しかし行く手をふさがれた！');
      return false;
    }
    /** §4.11.3 */
    escapeChance() {
      const E = K('ESCAPE');
      const avg = (l) => (l.length ? l.reduce((s, u) => s + u.stat('spd') * stageMult(u.buffs.agi), 0) / l.length : 0);
      const ap = avg(this.living('party')), am = avg(this.living('mon'));
      const p = U.clamp(E.base + E.step * this.escapeFails + E.agi * (ap - am) / Math.max(1, ap + am), E.min, E.max);
      return Math.min(1, p * (1 + this.partyMod('escapePct') / 100));
    }

    // ------------------------------------------------------- targeting
    /**
     * a living target for u: the chosen one if still valid; else, for the party, the focus-fire target
     * (R.BattleAI.focusOrder), for monsters a row-weighted pick (§4.5.3, aim: 'rand'|'low'|'middle')
     */
    pickFoe(u, t, aim) {
      if (t && t.alive && t.side !== u.side) return t;
      const foes = this.foes(u);
      if (!foes.length) return null;
      if (u.isParty) {
        if (t && !t.isParty) { const same = foes.filter((m) => m.species === t.species); if (same.length && !(R.BattleAI && R.BattleAI.focusOrder)) return U.pick(same); }
        if (R.BattleAI && R.BattleAI.focusOrder) return R.BattleAI.focusOrder(this, this.pendingPlan())[0] || U.pick(foes);
        return U.pick(foes);
      }
      if (R.BattleAI && R.BattleAI.pickPartyTarget) return R.BattleAI.pickPartyTarget(this, aim) || U.pick(foes);
      return U.pick(foes);
    }
    /** expected damage the party members still to act this round have aimed at each monster */
    pendingPlan() {
      const dmg = new Map();
      for (const s of this.pending || []) {
        const c = s.cmd, t = c && c.target;
        if (!t || !t.alive || t.isParty || !s.u.commandable()) continue;
        let d = 0;
        if (c.type === 'attack') d = this.expectAttack(s.u, t, c.slot);
        else if ((c.type === 'tech' || c.type === 'spell' || c.type === 'ability') && DB.actions[c.id] && DB.actions[c.id].target === 'enemy') d = this.expectDamage(s.u, DB.actions[c.id], t, { slot: c.slot });
        if (d > 0) dmg.set(t, (dmg.get(t) || 0) + d);
      }
      return { dmg };
    }
    /** targets for an action; chosen = Unit picked in the menu (or by the AI) */
    targets(u, act, chosen) {
      const foes = this.foes(u), friends = this.friends(u);
      const side = (u.isParty ? this.party : this.mons).filter((x) => !x.gone);
      switch (act.target) {
        case 'enemy': { const t = this.pickFoe(u, chosen, act.aim); return t ? [t] : []; }
        case 'group': {
          const t = this.pickFoe(u, chosen, act.aim);
          if (!t) return [];
          return t.isParty ? foes : foes.filter((m) => m.species === t.species);
        }
        case 'enemies': case 'random': return foes;
        case 'ally': case 'ally_other': {
          const ok = (x) => x && x.alive && x.side === u.side && (act.target !== 'ally_other' || x !== u);
          if (ok(chosen)) return [chosen];
          const t = friends.filter(ok).sort((a, b) => a.hpRate() - b.hpRate())[0];
          return t ? [t] : [];
        }
        case 'allies': return (act.effects || []).some((e) => e.type === 'revive') ? side : friends;
        case 'party': return side;
        case 'self': return [u];
        case 'ally_dead': {
          if (chosen && !chosen.alive && !chosen.gone && chosen.side === u.side) return [chosen];
          const t = side.find((x) => !x.alive);
          return t ? [t] : [];
        }
        case 'ally_any': return chosen && chosen.side === u.side && !chosen.gone ? [chosen] : [u];
      }
      return [];
    }

    // ------------------------------------------------------- attacks
    /**
     * 攻撃 (normal attack) and 反撃 (o.counter). o: {slot, power, critBonus, counter, confused}
     * → {done, landed, target, killed}
     */
    *attack(u, target, o) {
      o = o || {};
      const res = { done: true, landed: false, target: null, killed: false };
      const slot = u.isParty ? (o.slot !== undefined ? o.slot : u.defaultSlot()) : undefined;
      yield this.m(o.counter ? `${u.name}の反撃！` : `${u.name}の攻撃！`);
      let t;
      if (o.confused) {
        t = target && target.alive && target !== u ? target : U.pick(this.units().filter((x) => x.alive && x !== u));
      } else t = this.pickFoe(u, target);
      if (!t || !u.alive) { yield this.m('しかし効き目がなかった。'); return res; }
      let mul = 1;
      if (!o.counter && !o.confused) {
        const g = yield* this.guard(u, t);
        if (g.parried) { res.target = g.t; return res; }
        t = g.t; mul = g.mul;
      }
      res.target = t;
      yield { t: 'fx', fx: this.weaponFx(u, slot), user: u, targets: [t], kind: o.counter ? 'counter' : 'attack' };
      const W = u.isParty ? u.weapon(slot) : null;
      const eff = { type: 'damage', formula: 'phys', power: o.power || 1, critBonus: o.critBonus || 0 };
      const r = this.roll(u, t, eff, { slot, W, attack: true, coverMul: mul });
      const drain = W ? weaponItem(W).drain || 0 : 0;
      res.landed = yield* this.hit(u, t, r, { kind: 'phys', drain, element: r.el });
      if (res.landed) {
        const onHit = u.isParty ? W && W.onHit : u.d.onHit;
        if (onHit && t.alive) yield* this.inflict(u, t, onHit.status, onHit.chance, { quiet: true, sf: 'dex' });
        if (u.isParty && !t.isParty && u.mods.autoSteal) yield* this.autoSteal(u, t);
      }
      if (!o.counter && !o.confused && t.isParty && u.side !== t.side) this.queueCounter(t, u);
      res.killed = !t.alive;
      return res;
    }
    /**
     * An enemy's single-target physical attack on a party member: かばう redirects it, 反撃の構え may parry
     * it (§6.2.4). → {t (final target), mul (cover damage multiplier), parried}
     */
    *guard(att, t) {
      const out = { t, mul: 1, parried: false };
      if (!t || !t.isParty || att.side === t.side) return out;
      if (!t.status.cover) {
        const cov = this.party.filter((p) => p !== t && p.alive && p.status.cover && p.canAct() && !p.status.confuse)
          .sort((a, b) => (a.status.cover.seq || 0) - (b.status.cover.seq || 0))[0];
        if (cov) {
          yield { t: 'cover', u: cov, ally: t };
          yield this.m(`${cov.name}は${t.name}をかばった！`);
          out.t = cov;
          out.mul = cov.status.cover.mul != null ? cov.status.cover.mul : 1;
        }
      }
      const d = out.t;
      const ct = d.status.counter;
      if (ct && ct.parry > 0 && d.canAct() && !d.status.confuse && U.chance(ct.parry)) {
        yield { t: 'miss', u: d, att, parry: true };
        yield this.m(`${d.name}は攻撃を受け流した！`);
        out.parried = true;
        this.queueCounter(d, att);
      }
      return out;
    }
    queueCounter(def, src) {
      if (!def.isParty || !def.alive) return;
      const kind = def.status.counter ? 'stance' : def.mods.autoCounter > 0 ? 'auto' : null;
      if (!kind || this.reactQ.some((q) => q.u === def)) return;
      this.reactQ.push({ u: def, src, kind });
    }
    /** counters queued during the action: 1 per defender per enemy action, after it (§6.2.4-A3, §8.3.7 autoCounter) */
    *flushReactions() {
      const q = this.reactQ;
      this.reactQ = [];
      for (const r of q) {
        if (this.checkEnd()) break;
        const u = r.u;
        if (!u.alive || !u.canAct() || u.status.confuse || !r.src.alive) continue;
        let o;
        if (r.kind === 'stance' && u.status.counter) {
          const st = u.status.counter;
          o = { slot: st.slot, power: st.power != null ? st.power : 1, critBonus: st.critBonus || 0 };
        } else if (r.kind === 'auto') {
          if (!U.chance(Math.min(1, u.mods.autoCounter))) continue;
          o = { slot: u.defaultSlot(), power: 1 };
        } else continue;
        yield { t: 'react', u, kind: 'counter' };
        yield* this.attack(u, r.src, Object.assign({ counter: true }, o));
      }
      this.reactQ = [];
    }

    // ------------------------------------------------------- damage
    elementsOf(att, eff, ctx, f, W) {
      if (eff.element) return [eff.element];
      const act = ctx.act;
      if (act && act.elements && act.elements.length) return act.elements;
      if (att.isParty) return f === 'phys' && W && W.element ? [W.element] : [];
      return f === 'phys' && att.d.element ? [att.d.element] : [];
    }
    /** the best multiplier among the elements (§4.6.2), and the best elemBoost */
    elemFactor(att, tgt, els) {
      if (!els || !els.length) return { mult: 1, boost: 0, el: null };
      let mult = -Infinity, el = null, boost = 0;
      for (const e of els) {
        const m = tgt.elemMult(e);
        if (m > mult) { mult = m; el = e; }
        boost = Math.max(boost, att.elemBoost(e));
      }
      return { mult, boost, el };
    }
    /** vs: {race | flag | status: mult} — every matching key multiplies (§6.2.4-D) */
    vsMult(vs, tgt) {
      if (!vs) return 1;
      let v = 1;
      for (const k in vs) if (tgt.flag(k) || tgt.status[k] || tgt.race === k) v *= vs[k];
      return v;
    }
    hitCount(eff) {
      const h = eff && eff.hits;
      if (Array.isArray(h)) return U.ri(h[0], h[1]);
      return Math.max(1, (h | 0) || 1);
    }
    /**
     * Roll one hit of a damage effect (§4.6). ctx: {act, kind, slot, W, item, atk, coverMul, expect}
     * (expect: AI mean values — no RNG, × hit chance, crits averaged in). → {dmg, crit, miss, immune, zero, el}
     */
    roll(att, tgt, eff, ctx) {
      ctx = ctx || {};
      const x = !!ctx.expect;
      const rf = (a, b) => (x ? (a + b) / 2 : U.rf(a, b));
      const f = eff.formula || (ctx.kind === 'spell' ? 'magic' : 'phys');
      const P = eff.power != null ? eff.power : 1;
      const party = att.isParty;
      const W = party && f === 'phys' ? ctx.W || att.weapon(ctx.slot) : null;
      const Kd = K('DMG'), Kh = K('HIT');
      const defendM = tgt.defending ? K('DEFEND') : 1;
      const takenM = tgt.isParty ? Math.max(0, 1 + (tgt.mods.takenPct || 0) / 100) : 1;
      if (f === 'percent') {
        if (tgt.boss || tgt.rare || tgt.metal) return { immune: true, dmg: 0 };
        return { dmg: Math.max(1, Math.floor(tgt.hp * P)) };
      }
      let hitP = 1, critP = 0;
      if (f === 'phys') {
        if (!eff.sure && !tgt.disabled()) {
          const hitV = W && W.hit != null ? W.hit : att.stat('hit');
          const eva = tgt.status.paralyze || tgt.status.freeze ? 0 : tgt.stat('eva') + (tgt.status.nimble ? K('EVA').nimble : 0);
          hitP = U.clamp(hitV * (eff.acc != null ? eff.acc : 1) - eva, Kh.min, Kh.max) / 100;
          if (att.status.blind) hitP *= Kh.blind;
        }
        if (!x && hitP < 1 && !U.chance(hitP)) return { miss: true, dmg: 0 };
        const cv = W && W.crit != null ? W.crit : att.stat('crit');
        critP = U.clamp((cv + (eff.critBonus || 0)) / 100, 0, 1);
      }
      const crit = !x && f === 'phys' && critP > 0 && U.chance(critP);
      if (tgt.metal) {
        // 鋼: 1 per hit whatever the attack (2 on a crit); metalHit techs / weapons ceil(3 × P) (§4.10.5, §9.9)
        const MT = K('METAL') || {};
        const one = MT.dmg != null ? MT.dmg : 1, oneCrit = MT.critDmg != null ? MT.critDmg : 2;
        const mh = !!(eff.metalHit || (W && weaponItem(W).metalHit));
        const base = mh ? Math.ceil((MT.hitMul || 3) * P) : one;
        const extra = oneCrit - one;
        if (x) return { dmg: (base + critP * extra) * hitP };
        return { dmg: base + (crit ? extra : 0), crit, el: null };
      }
      const els = this.elementsOf(att, eff, ctx, f, W);
      const E = this.elemFactor(att, tgt, els);
      let d, zero = E.mult === 0;
      if (f === 'phys') {
        const A = ctx.atk != null ? ctx.atk : W ? W.atk || 0 : att.stat('atk');
        const ig = eff.ignoreDef === true ? 1 : U.clamp(eff.ignoreDef || 0, 0, 1);
        const guardN = this.dk / (this.dk + Math.max(0, tgt.stat('def')) * (1 - ig));
        const kind = eff.kind || (W ? W.kind || wtypeInfo(W.wtype).kind : null);
        const kindM = kind ? tgt.physMult(kind) : 1;
        const vs = this.vsMult(eff.vs, tgt) * (W ? this.vsMult(weaponItem(W).vs, tgt) : 1);
        const rowM = tgt.isParty && this.effRow(tgt) === 'middle' ? K('ROW').middleTaken : 1;
        const stage = stageMult(att.buffs.atk) / stageMult(tgt.buffs.def);
        const pct = 1 + this.pct(att, 'physPct') / 100;
        const base = A * P * kindM * E.mult * (1 + E.boost / 100) * vs * rowM * stage * pct * defendM * takenM * (ctx.coverMul || 1);
        const cm = K('CRIT').mult;
        if (x) d = base * ((1 - critP) * guardN + critP * cm) * hitP;
        else d = base * (crit ? cm : guardN) * rf(Kd.physRand[0], Kd.physRand[1]);
        zero = zero || kindM === 0 || vs === 0;
      } else if (f === 'magic') {
        const ig = U.clamp(eff.ignoreMdef || 0, 0, 1);
        const mdef = Math.max(0, tgt.stat('mdef')) * (1 - ig);
        d = att.stat('mag') * P * (this.dk / (this.dk + mdef)) * E.mult * (1 + E.boost / 100) *
          (stageMult(att.buffs.mag) / stageMult(tgt.buffs.mdef)) * (1 + this.pct(att, 'magicPct') / 100) * defendM * takenM * rf(Kd.magRand[0], Kd.magRand[1]);
      } else if (f === 'breath') {
        d = att.stat('atk') * P * E.mult * defendM * takenM * rf(Kd.breathRand[0], Kd.breathRand[1]);
      } else if (f === 'tier') {
        // 道具・魔石 (§4.6.3, §8.2): SP × W(Tb) × element — no stat, no mods (itemPct is for healing items only)
        d = P * Wt(this.tier) * E.mult * defendM * takenM * rf(Kd.breathRand[0], Kd.breathRand[1]);
      } else {
        d = P * defendM * takenM * rf(Kd.fixedRand[0], Kd.fixedRand[1]); // fixed
      }
      return { dmg: d, crit, zero, el: E.el };
    }

    /** apply a rolled hit to tgt; true when it connected (damage > 0, or MP lost) */
    *hit(att, tgt, r, info) {
      const kind = info.kind || 'phys';
      if (r.miss) {
        yield { t: 'miss', u: tgt, att };
        yield this.m(`${tgt.name}は攻撃をかわした！`);
        return false;
      }
      if (r.crit) {
        yield { t: 'crit', u: att };
        yield this.m(att.isParty ? '会心の手ごたえ！' : '強烈な一撃！');
      }
      if (r.dmg < 0) {
        // the element is absorbed: the hit heals
        yield* this.restore(tgt, Math.min(9999, Math.max(1, Math.round(-r.dmg))), 'hp');
        return false;
      }
      const dmg = r.zero ? 0 : Math.min(K('DMG').max, Math.max(1, Math.round(r.dmg)));
      if (info.mp) {
        const n = Math.min(tgt.mp || 0, dmg);
        if (tgt.isParty) tgt.mp -= n;
        yield { t: 'dmg', u: tgt, n, mp: true, kind };
        if (n <= 0) { yield this.m('しかし効き目がなかった。'); return false; }
        yield this.m(`${tgt.name}のMPが${n}減った！`);
        if (info.drain && att.alive) {
          const g = Math.round(n * info.drain);
          if (att.isParty) yield* this.restore(att, g, 'mp', 'drain');
          else yield* this.restore(att, g, 'hp', 'drain'); // monsters have no MP: the stolen MP heals HP (§9.1.6)
        }
        return true;
      }
      if (dmg <= 0) {
        yield { t: 'dmg', u: tgt, n: 0, kind };
        yield this.m(`${tgt.name}には傷ひとつない！`);
        return false;
      }
      const dealt = Math.min(tgt.hp, dmg);
      tgt.hp = Math.max(0, tgt.hp - dmg);
      if (tgt.isParty) this.stats.taken += dealt; else this.stats.dealt += dealt;
      yield { t: 'dmg', u: tgt, n: dmg, crit: !!r.crit, kind, src: att, el: info.element || null };
      yield this.m(`${tgt.name}に${dmg}のダメージ！`);
      if (tgt.hp <= 0) yield* this.die(tgt, att);
      else {
        if (tgt.status.sleep && U.chance(0.5)) yield* this.clearStatus(tgt, 'sleep');
        if (tgt.status.confuse && kind === 'phys' && U.chance(0.5)) yield* this.clearStatus(tgt, 'confuse');
        if (tgt.status.freeze && info.element === 'fire') yield* this.clearStatus(tgt, 'freeze');
        if (!tgt.isParty && tgt.d.phases) this.phaseQ.add(tgt);
      }
      if (info.drain && att.alive && dealt > 0) yield* this.restore(att, Math.round(dealt * info.drain), 'hp', 'drain');
      return true;
    }

    *die(u, killer) {
      u.hp = 0;
      u.status = {};
      u.turns = {};
      u.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      u.defending = false;
      yield { t: 'die', u, killer };
      yield this.m(`${u.name}は倒れた！`);
      if (u.isParty) {
        this.stats.deaths++;
        const x = u.mods.autoRevive;
        if (x > 0 && !u.revived) {
          // 倒れても 1 回起き上がる (§8.3.7): once per battle, even after instant death
          u.revived = true;
          u.hp = Math.max(1, Math.floor(u.mhp * Math.min(1, x)));
          yield { t: 'react', u, kind: 'revive' };
          yield { t: 'revive', u };
          yield this.m(`${u.name}は立ち上がった！`);
        }
      } else {
        if (!this.killed.includes(u)) this.killed.push(u);
        if (killer && killer.isParty && killer.c.counts) killer.c.counts.kills = (killer.c.counts.kills || 0) + 1;
      }
    }

    /** restore hp/mp/wp by n (capped). how: 'drain' | 'regen' | 'quiet' | undefined (changes the wording) */
    *restore(t, n, kind, how) {
      n = Math.max(0, Math.round(n));
      const cur = kind === 'mp' ? t.mp : kind === 'wp' ? t.wp : t.hp;
      const max = kind === 'mp' ? t.mmp : kind === 'wp' ? t.mwp : t.mhp;
      const got = Math.max(0, Math.min(max - cur, n));
      if (kind === 'mp') t.mp += got; else if (kind === 'wp') t.wp += got; else t.hp += got;
      if (got <= 0 && (how === 'drain' || how === 'regen' || how === 'quiet' || how === 'multi')) return 0;
      yield { t: 'heal', u: t, n: got, mp: kind === 'mp', wp: kind === 'wp' };
      if (how === 'quiet') return got;
      const L = kind === 'mp' ? 'MP' : kind === 'wp' ? 'WP' : 'HP';
      if (got > 0) yield this.m(`${t.name}の${L}が${got}回復した！`);
      else yield this.m('しかし効き目がなかった。');
      return got;
    }

    // ------------------------------------------------------- statuses
    /** SF (§4.8.3): party = clamp((128 + S)/168, 0.6, 2.0), S = 知力 for spells / magic techs, 器用さ for weapons; monsters 1 */
    sf(u, stat) {
      if (!u.isParty || !stat) return 1;
      const S = K('SF');
      return U.clamp((S.base + u.stat(stat)) / S.div, S.min, S.max);
    }
    sfStat(ctx) {
      if (!ctx || ctx.item) return null;
      if (ctx.kind === 'spell') return 'int';
      if (ctx.kind === 'tech') return ctx.act && (ctx.act.magic || (ctx.act.effects || []).some((e) => e.formula === 'magic')) ? 'int' : 'dex';
      return null;
    }
    rollTurns(def, t) {
      const tr = (t.boss || t.rare) && def.bossTurns ? def.bossTurns : def.turns;
      if (Array.isArray(tr)) return U.ri(tr[0], tr[1]);
      return tr === 'next' ? 'next' : null;
    }
    /**
     * inflict status s. o: {quiet, sf:'int'|'dex'|null, multi, data (value stored for counter / cover)}
     * bad: p = chance × SF × (1 − resist), 0..0.95; good: always, the duration is refreshed (§7.3.3)
     */
    *inflict(u, t, s, chance, o) {
      o = o || {};
      if (!t || !t.alive || !s) return false;
      const def = stDef(s);
      const fail = () => (o.quiet ? null : this.m(o.multi ? `${t.name}には効き目がなかった。` : 'しかし効き目がなかった。'));
      if (s !== 'death' && def.bad === false) {
        t.status[s] = o.data || true;
        const n = this.rollTurns(def, t);
        if (n == null) delete t.turns[s]; else t.turns[s] = n;
        yield { t: 'status', u: t, s, on: true };
        if (def.on) yield this.m(fmtName(def.on, t.name));
        return true;
      }
      const hostile = u.side !== t.side;
      if (hostile && t.status.veil) { const f = fail(); if (f) yield f; return false; }
      const res = t.resist(s);
      const p = U.clamp((chance != null ? chance : 1) * this.sf(u, o.sf) * (1 - res), 0, K('STATUS').pCap);
      if (s === 'death') {
        if (t.boss || t.rare || t.metal || res >= 1 || !U.chance(p)) { const f = fail(); if (f) yield f; return false; }
        yield { t: 'status', u: t, s: 'death', on: true };
        yield* this.die(t, u);
        return true;
      }
      if (t.status[s] || res >= 1 || !U.chance(p)) { const f = fail(); if (f) yield f; return false; }
      if (isDisabling(s)) for (const x of DISABLE) if (x !== s && t.status[x]) yield* this.clearStatus(t, x, true);
      if (s === 'burn' && t.status.freeze) yield* this.clearStatus(t, 'freeze', true);
      if (s === 'freeze' && t.status.burn) yield* this.clearStatus(t, 'burn', true);
      t.status[s] = true;
      const n = this.rollTurns(def, t);
      if (n == null) delete t.turns[s]; else t.turns[s] = n;
      yield { t: 'status', u: t, s, on: true };
      if (def.on) yield this.m(fmtName(def.on, t.name));
      return true;
    }

    // ------------------------------------------------------- actions (techs, spells, items, monster actions)
    announce(u, a, item) {
      if (item) return `${u.name}は${item.name}を使った！`;
      if (a.msg) return a.msg.replace(/\{user\}/g, u.name).replace(/\{name\}/g, a.name);
      return a.kind === 'spell' ? `${u.name}は${a.name}を唱えた！` : `${u.name}の${a.name}！`;
    }
    /**
     * Run an action: pay (WP / MP / the item), announce, then every effect on every target in order.
     * o: {item, slot, free (glimmer: no cost), glimmed} → {done, landed, target, targets, killed}
     */
    *useAction(u, id, a, chosen, o) {
      o = o || {};
      const item = o.item || null;
      const kind = item ? 'item' : a.kind || (u.isParty ? 'tech' : 'enemy');
      const res = { done: false, landed: false, target: null, targets: [], killed: false };
      const refuse = function* (eng, text) { yield eng.m(eng.announce(u, a, null)); yield eng.m(text); };
      if (!item && !o.free) {
        if (u.isParty && kind === 'tech') {
          if (a.magic && u.status.silence) { yield* refuse(this, 'しかし術を封じられている！'); return res; }
          // §6.4.4-1: a reach:false tech cannot be used from the middle row (the row may have changed since the command)
          if (!a.reach && this.effRow(u) === 'middle') { yield* refuse(this, 'しかし中列からは届かない！'); return res; }
          const cost = this.wpCost(u, id);
          if (u.wp < cost) { yield* refuse(this, 'しかしWPが足りない！'); return res; }
          u.wp -= cost; this.stats.wpUsed += cost;
        } else if (u.isParty && kind === 'spell') {
          if (u.status.silence) { yield* refuse(this, 'しかし術を封じられている！'); return res; }
          const cost = this.mpCost(u, id);
          if (u.mp < cost) { yield* refuse(this, 'しかしMPが足りない！'); return res; }
          u.mp -= cost; this.stats.mpUsed += cost;
        } else if (!u.isParty && isMagicAct(a) && u.status.silence) { yield* refuse(this, 'しかし術を封じられている！'); return res; }
      } else if (item && !o.free) {
        if (!this.takeItem(id)) {
          yield this.m(`${u.name}は${item.name}を使おうとした！`);
          yield this.m(`しかし${item.name}はもう残っていない。`);
          return res;
        }
        this.stats.items++;
      }
      res.done = true;
      u.used[id] = true;
      if (u.isParty) {
        const bag = kind === 'spell' ? this.stats.casts : kind === 'tech' ? this.stats.techs : null;
        if (bag) bag[u.c.id] = (bag[u.c.id] || 0) + 1;
      }
      yield this.m(this.announce(u, a, item));
      const effects = a.effects || [];
      const hpCost = effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0);
      if (hpCost > 0) {
        const pay = Math.min(u.hp - 1, Math.floor(u.mhp * hpCost));
        if (pay > 0) { u.hp -= pay; yield { t: 'dmg', u, n: pay, kind: 'cost' }; }
      }
      const ctx = { act: a, item, id, kind, slot: o.slot, W: u.isParty && kind === 'tech' ? u.weapon(o.slot) : null, fx: a.fx || null, onHit: new Set(), glimmed: !!o.glimmed, sf: null };
      ctx.sf = this.sfStat(ctx);
      const main = effects.filter((e) => !e.on);
      const onFx = effects.filter((e) => e.on);
      const said = this.said;
      if (a.target === 'random') {
        const n = this.hitCount(main.find((e) => e.type === 'damage'));
        ctx.once = true; ctx.multi = true;
        for (let i = 0; i < n; i++) {
          const foes = this.foes(u);
          if (!foes.length || !u.alive) break;
          const t = U.pick(foes);
          res.targets.push(t);
          yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab: a, kind: 'ability' };
          yield* this.applyEffects(u, t, main, ctx, res);
        }
      } else {
        let targets = this.targets(u, a, chosen);
        if (!targets.length && !onFx.length) { yield this.m('しかし効き目がなかった。'); return res; }
        // an enemy's single-target physical action on a party member: かばう / 受け流し (§6.2.4)
        if (targets.length === 1 && !u.isParty && isPhysSingle(a)) {
          const g = yield* this.guard(u, targets[0]);
          if (g.parried) { res.target = g.t; return res; }
          targets = [g.t];
          ctx.coverMul = g.mul;
        }
        res.targets = targets;
        res.target = targets[0] || null;
        ctx.multi = targets.length > 1;
        if (targets.length) yield { t: 'fx', fx: ctx.fx, user: u, targets, ab: a, kind: 'ability' };
        for (const t of targets) {
          if (this.result === 'escape') return res;
          yield* this.applyEffects(u, t, main, ctx, res);
          if (!u.isParty && isPhysSingle(a) && t.isParty) this.queueCounter(t, u);
        }
      }
      for (const eff of onFx) {
        const list = eff.on === 'self' ? [u] : this.friends(u);
        for (const f of list) yield* this.effect(u, f, eff, Object.assign({}, ctx, { multi: list.length > 1 }));
      }
      if (this.said === said) yield this.m('しかし効き目がなかった。');
      res.killed = res.targets.some((t) => !t.isParty && !t.alive);
      return res;
    }
    /**
     * the effects of one action on one target, in order. A target that falls stops the rest (revive
     * excepted). Techs: status / debuff / steal / dispel after a damage effect only when that damage landed
     * (§6.2.4-C); other actions: only when every physical hit was dodged (the Crest rule).
     */
    *applyEffects(u, t, effects, ctx, res) {
      let gate = false;
      for (const eff of effects) {
        if (this.result === 'escape') return;
        if (!t.alive && eff.type !== 'revive') break;
        if (gate && (GATED[eff.type] || (eff.type === 'buff' && (eff.stages || 1) < 0))) continue;
        if (eff.type === 'damage') {
          const r = yield* this.damageEffect(u, t, eff, ctx);
          if (r.landed) res.landed = true;
          if (ctx.kind === 'tech' ? !r.landed : r.phys && r.tried && !r.landed && r.missed) gate = true;
        } else yield* this.effect(u, t, eff, ctx);
      }
    }
    *damageEffect(u, t, eff, ctx) {
      const f = eff.formula || (ctx.kind === 'spell' ? 'magic' : 'phys');
      const n = ctx.once ? 1 : this.hitCount(eff);
      let landed = false, tried = false, missed = true;
      const drain = Math.max(eff.drain || 0, ctx.W && f === 'phys' ? weaponItem(ctx.W).drain || 0 : 0);
      for (let i = 0; i < n; i++) {
        if (!t.alive || !u.alive) break;
        if (i > 0) yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab: ctx.act, kind: 'ability', again: true };
        const r = this.roll(u, t, eff, ctx);
        tried = true;
        if (!r.miss) missed = false;
        if (r.immune) {
          yield { t: 'miss', u: t, att: u };
          yield this.m(ctx.multi ? `${t.name}には効き目がなかった。` : 'しかし効き目がなかった。');
          break;
        }
        if (yield* this.hit(u, t, r, { kind: f === 'phys' ? 'phys' : f, mp: !!eff.mp, drain, element: r.el })) landed = true;
      }
      // the weapon's on-hit status: once per tech per target, after the first landed hit (§6.0 0.14)
      if (landed && t.alive && ctx.W && f === 'phys' && ctx.kind === 'tech' && ctx.W.onHit && !ctx.onHit.has(t)) {
        ctx.onHit.add(t);
        yield* this.inflict(u, t, ctx.W.onHit.status, ctx.W.onHit.chance, { quiet: true, sf: 'dex' });
      }
      return { landed, tried, phys: f === 'phys', missed };
    }

    *effect(u, t, eff, ctx) {
      switch (eff.type) {
        case 'damage': return yield* this.damageEffect(u, t, eff, ctx);
        case 'heal': {
          if (!t.alive) return;
          const n = R.Mon && R.Mon.healAmount ? R.Mon.healAmount(u, t, eff, { item: !!ctx.item }) : Math.round(t.mhp * (eff.pct || 0));
          return yield* this.restore(t, n, 'hp', ctx.multi ? 'multi' : undefined);
        }
        case 'healMp': case 'healWp': {
          if (!t.alive) return;
          const k = eff.type === 'healMp' ? 'mp' : 'wp';
          const max = k === 'mp' ? t.mmp : t.mwp;
          const n = eff.pct != null ? Math.max(1, Math.ceil(max * eff.pct)) : eff.power || 0;
          return yield* this.restore(t, n, k, ctx.multi ? 'multi' : undefined);
        }
        case 'revive': {
          if (t.alive || t.gone) return;
          t.hp = Math.max(1, Math.floor(t.mhp * (eff.pct != null ? eff.pct : 0.25)));
          const i = this.killed.indexOf(t);
          if (i >= 0) this.killed.splice(i, 1);
          yield { t: 'revive', u: t };
          yield this.m(`${t.name}は生き返った！`);
          return;
        }
        case 'cure': {
          const list = eff.statuses === 'all' ? badStatuses() : eff.statuses || [];
          for (const s of list) if (t.status[s]) yield* this.clearStatus(t, s);
          return;
        }
        case 'status': {
          const data = eff.status === 'counter' ? {
            slot: ctx.kind === 'tech' && ctx.slot !== undefined ? ctx.slot : u.isParty ? u.defaultSlot() : null,
            power: eff.power != null ? eff.power : 1, parry: eff.parry || 0, critBonus: eff.critBonus || 0,
          } : undefined;
          return yield* this.inflict(u, t, eff.status, eff.chance, { sf: ctx.sf, multi: ctx.multi, data });
        }
        case 'regen': return yield* this.inflict(u, t, 'regen', null, { multi: ctx.multi });
        case 'cover': {
          if (!t.alive) return;
          const def = stDef('cover');
          t.status.cover = { mul: eff.mul != null ? eff.mul : 1, seq: ++this.coverSeq };
          t.turns.cover = 'next';
          yield { t: 'status', u: t, s: 'cover', on: true };
          if (def.on) yield this.m(fmtName(def.on, t.name));
          return;
        }
        case 'buff': return yield* this.buff(u, t, eff, ctx);
        case 'dispel': return yield* this.dispel(u, t, eff, ctx);
        case 'steal': return yield* this.steal(u, t);
        case 'scan': return yield* this.scan(t);
        case 'summon': return yield* this.summon(u, eff);
        case 'escape': {
          if (!u.isParty) {
            if (u.boss) return;
            u.gone = true;
            yield this.m(`${u.name}は逃げ出した！`);
            yield { t: 'flee', u };
            return;
          }
          if (this.result) return;
          if (this.noEscape) { yield this.m('この戦いからは逃げられない！'); return; }
          this.result = 'escape';
          yield { t: 'escape', ok: true };
          yield this.m('{hero}たちは逃げ出した。');
          return;
        }
        case 'grow': return yield* this.grow(t, eff);
        case 'teleport': case 'exit': case 'repel': case 'encounter':
          yield this.m('ここでは使えない。');
          return;
        case 'special': {
          const fn = B.specials && B.specials[eff.id];
          if (fn) yield* fn(this, u, t, eff, ctx);
          return;
        }
      }
    }

    /** §4.8.2 buffs and debuffs: party-side boosts always land; a debuff on the other side rolls (§7.3.3) */
    *buff(u, t, eff, ctx) {
      if (!t.alive || !BUFF_STATS.includes(eff.stat)) return;
      const st = eff.stages || 1;
      const name = NAMES.buff[eff.stat];
      const fail = () => this.m(ctx && ctx.multi ? `${t.name}には効き目がなかった。` : 'しかし効き目がなかった。');
      if (st < 0 && u.side !== t.side) {
        if (t.metal || t.status.veil) { yield fail(); return; }
        const KS = K('STATUS');
        // chance × SF (§7.3.3, §4.8.3): 知力 for spells and magic techs, 器用さ for physical techs; items and monsters 1
        let p = eff.chance == null ? 1 : eff.chance * this.sf(u, ctx ? ctx.sf || (ctx.kind === 'spell' ? 'int' : null) : null);
        if (t.boss || t.rare) p *= KS.bossDebuff;
        if (eff.chance != null || t.boss || t.rare) p = Math.min(KS.pCap, p);
        if (!U.chance(p)) { yield fail(); return; }
      }
      const cur = t.buffs[eff.stat], nv = U.clamp(cur + st, -2, 2), d = nv - cur;
      if (!d) { yield this.m(`しかし${t.name}の${name}はもう${st > 0 ? '上がらない' : '下がらない'}！`); return; }
      t.buffs[eff.stat] = nv;
      yield { t: 'buff', u: t, stat: eff.stat, d };
      yield this.m(`${t.name}の${name}が${d > 0 ? '上がった' : '下がった'}！`);
    }
    /** dispel side:'good' (positive stages + good statuses) / 'bad' (negative stages); default by the side (§7.3.4-2) */
    *dispel(u, t, eff, ctx) {
      if (!t.alive) return;
      const side = eff.side || (t.side === u.side ? 'bad' : 'good');
      let changed = false;
      for (const k of BUFF_STATS) {
        if ((side === 'good' && t.buffs[k] > 0) || (side === 'bad' && t.buffs[k] < 0)) { t.buffs[k] = 0; changed = true; }
      }
      if (side === 'good') for (const s of GOOD) if (t.status[s]) { yield* this.clearStatus(t, s, true); changed = true; }
      if (!changed) { if (!(ctx && ctx.multi)) yield this.m('しかし効き目がなかった。'); return; }
      yield { t: 'buff', u: t, stat: null, d: 0, dispel: side };
      yield this.m(side === 'good' ? `${t.name}の強化の効果が消えた！` : `${t.name}の弱体の効果が消えた！`);
    }

    // ------------------------------------------------------- steal / scan / summon / grow
    /** 盗む (§4.10.1): clamp(0.35 + (素早さ − 魔物の素早さ)/200, 0.1, 0.8) × (1 + stealPct/100) (boss ×0.5) */
    stealChance(u, t) {
      const S = K('STEAL');
      let p = U.clamp(S.base + (u.stat('agi') - t.stat('agi')) / S.agiDiv, S.min, S.max);
      p *= 1 + this.pct(u, 'stealPct') / 100;
      if (t.boss) p *= S.boss;
      return Math.min(1, p);
    }
    /** what a steal takes: the rare slot with min(0.5, rare drop chance × 4) (× rareMul), else the normal slot */
    stealPick(t, rareMul) {
      const dr = t.d && t.d.drops;
      if (!dr) return null;
      const chances = R.Mon && R.Mon.dropChances ? R.Mon.dropChances(t.d, { golden: t.golden, mods: this.partyMods() }) : { rare: 0 };
      const S = K('STEAL');
      if (dr.rare && dr.rare.item && U.chance(Math.min(S.rareCap, (chances.rare || 0) * S.rareMul) * (rareMul || 1))) return { item: dr.rare.item, n: 1, grade: 'rare' };
      if (dr.normal) {
        if (dr.normal.item) return { item: dr.normal.item, n: 1, grade: 'normal' };
        if (dr.normal.pool && R.Mon && R.Mon.pickPool) { const p = R.Mon.pickPool(dr.normal.pool, this.tier); if (p && p.item) return { item: p.item, n: p.n || 1, grade: 'normal' }; }
      }
      return null;
    }
    stealable(t) { const dr = t.d && t.d.drops; return !!(dr && ((dr.normal && (dr.normal.item || dr.normal.pool)) || (dr.rare && dr.rare.item))); }
    *takeStolen(u, t, pick) {
      t.stolen = true;
      this.giveItem(pick.item, pick.n || 1);
      this.stolen.push({ mon: t.id, item: pick.item, grade: pick.grade, char: u.c.id });
      if (this.live && R.State && R.Game && R.State.noteDrop) R.State.noteDrop(t.id, pick.grade, { stolen: true });
      const it = DB.items[pick.item] || {};
      yield { t: 'gain', item: pick.item, grade: pick.grade, stolen: true, u, mon: t.id };
      yield this.m(`${u.name}は${pick.grade !== 'normal' ? '★' : ''}${it.name || pick.item}を盗んだ！`);
    }
    *steal(u, t) {
      if (!u.isParty) {
        // monster thieves take a little gold (real battles only)
        const g = this.live && R.Game ? Math.min(R.Game.gold || 0, (u.level || 1) * 5) : 0;
        if (!g) { yield this.m('しかし何も盗めなかった。'); return; }
        R.Game.gold -= g;
        yield this.m(`{hero}たちは${g}ゴールドを盗まれた！`);
        return;
      }
      if (t.isParty) return;
      if (t.stolen || !this.stealable(t) || !U.chance(this.stealChance(u, t))) { yield this.m('しかし何も盗めなかった。'); return; }
      const pick = this.stealPick(t, 1);
      if (!pick || !this.canCarry(pick.item, pick.n)) { yield this.m('しかし何も盗めなかった。'); return; }
      yield* this.takeStolen(u, t, pick);
    }
    /**
     * ついでに盗む (autoSteal, §8.3.7): a landed 攻撃 (or 反撃) also rolls a steal at the steal chance × autoSteal/100,
     * the rare slot at half the steal rate; once per monster; silent when nothing is taken
     */
    *autoSteal(u, t) {
      if (t.stolen || !this.stealable(t)) return;
      if (!U.chance(this.stealChance(u, t) * Math.min(100, u.mods.autoSteal) / 100)) return;
      const pick = this.stealPick(t, K('STEAL').autoRare);
      if (!pick || !this.canCarry(pick.item, pick.n)) return;
      yield* this.takeStolen(u, t, pick);
    }
    *scan(t) {
      yield this.m(`${t.name}　Lv${t.isParty ? t.level : t.lvShow}　HP${t.hp}/${t.mhp}`);
      if (t.isParty) return;
      const el = t.d.elem || {};
      const order = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
      const keys = order.filter((e) => el[e] != null).concat(Object.keys(el).filter((e) => !order.includes(e)));
      const weak = keys.filter((e) => el[e] >= 1.5).map(elemName);
      const absorb = keys.filter((e) => el[e] < 0).map(elemName);
      yield this.m(weak.length ? `弱点：${weak.join('・')}` : '弱点は見つからない。');
      if (absorb.length) yield this.m(`吸収：${absorb.join('・')}`);
      if (this.live && R.State && R.Game && R.State.noteDrop) R.State.noteDrop(t.id, 'scan');
    }
    /** 仲間を呼ぶ (§9.1.6): new monsters at the battle level on the right; none when max living or 8 would be exceeded */
    *summon(u, eff) {
      const max = Math.min(8, eff.max != null ? eff.max : 8);
      const n = Math.max(1, eff.n || 1);
      const id = R.Mon && R.Mon.resolve ? R.Mon.resolve(eff.mon || 'same', this.tier, u.id) : u.id;
      const added = [];
      if (id && DB.monsters[id]) {
        for (let k = 0; k < n; k++) {
          if (this.living('mon').length >= max) break;
          const m = new MonUnit({ id, summoned: true }, this.mons.length, this);
          this.mons.push(m);
          added.push(m);
        }
      }
      if (!added.length) { yield this.m('しかし、誰も来なかった。'); return; }
      this.relabel();
      if (this.live && R.State && R.Game && R.State.seen) R.State.seen(id);
      yield { t: 'summon', units: added.map((m) => m.idx) };
      for (const m of added) yield this.m(`${m.name}が現れた！`);
    }
    *grow(t, eff) {
      if (!t.isParty || !t.alive) return;
      const k = eff.stat;
      if (k !== 'hp' && k !== 'mp' && k !== 'wp') return;
      const c = t.c;
      const before = { hp: t.mhp, mp: t.mmp, wp: t.mwp };
      const cur = { hp: t.hp, mp: t.mp, wp: t.wp };
      let added = 0;
      if (R.Rules && R.Rules.grow) {
        // R.Rules.grow owns the cap (K.BONUS_CAP) and raises the current value with the max (§8.2.5)
        try { added = R.Rules.grow(c, k, eff.n || 1) || 0; } catch (e) { R.warn('battle: R.Rules.grow failed', e && e.message); added = 0; }
      } else {
        const CAP = { hp: 200, mp: 30, wp: 30 };
        c.bonus = c.bonus || { hp: 0, mp: 0, wp: 0 };
        added = Math.max(0, Math.min(eff.n || 1, CAP[k] - (c.bonus[k] || 0)));
        c.bonus[k] = (c.bonus[k] || 0) + added;
      }
      if (added <= 0) { yield this.m('これ以上は効かない。'); return; }
      t.refresh();
      for (const x of ['hp', 'mp', 'wp']) {
        const max = x === 'hp' ? t.mhp : x === 'mp' ? t.mmp : t.mwp;
        const up = Math.max(0, max - before[x]);
        t[x] = Math.min(max, Math.max(t[x], cur[x] + up));
      }
      const gain = (k === 'hp' ? t.mhp : k === 'mp' ? t.mmp : t.mwp) - before[k];
      yield { t: 'buff', u: t, stat: k, d: 1, grow: true };
      yield this.m(`${t.name}の${NAMES.stat[k]}が${gain}増えた！`);
    }

    // ------------------------------------------------------- リピート (§11.5.3a, Part A6)
    /**
     * every commandable member repeats their command of the previous round (prev, by party index):
     * same action / item / target; the fallbacks of §11.5.3a (R1–R6).
     */
    repeatCommands(prev) {
      const out = [];
      const reserved = {};
      const plan = R.BattleAI && R.BattleAI.newPlan ? R.BattleAI.newPlan() : null;
      for (const u of this.party) if (u.commandable()) out[u.idx] = this.repeatOne(u, prev && prev[u.idx], reserved, plan);
      return out;
    }
    repeatOne(u, p, reserved, plan) {
      const foeOf = (t) => (t && t.side !== u.side && !t.gone ? t : null);
      const planAdd = (t, d) => { if (plan && t) plan.dmg.set(t, (plan.dmg.get(t) || 0) + d); };
      // 攻撃: a repeated 攻撃 keeps its weapon slot (防御 when that slot cannot reach from the middle row); the
      // fallbacks R3 / R6 take the first slot that reaches (防御 when none does)
      const attack = (slot) => {
        if (slot === undefined) {
          slot = u.defaultSlot();
          if (!this.canReach(u, slot)) {
            const alt = u.attackSlots().find((s) => this.canReach(u, s));
            if (alt === undefined) return { type: 'defend' };
            slot = alt;
          }
        } else if (!this.canReach(u, slot)) return { type: 'defend' };
        const old = foeOf(p && p.target);
        if (old && old.alive) { planAdd(old, this.expectAttack(u, old, slot)); return { type: 'attack', slot, target: old }; }
        let t = null;
        if (plan && R.BattleAI && R.BattleAI.focusOrder) t = R.BattleAI.focusOrder(this, plan)[0] || null;
        if (!t) t = this.pickFoe(u, null);
        if (t) planAdd(t, this.expectAttack(u, t, slot));
        return { type: 'attack', slot, target: t };
      };
      if (!p) return attack(); // R6: did not act last round
      if (p.type === 'attack') return attack(p.slot);
      if (p.type === 'defend') return { type: 'defend' };
      let act, type = p.type, slot = p.slot;
      if (type === 'ability') { const a = DB.actions[p.id]; type = a && a.kind === 'spell' ? 'spell' : 'tech'; }
      if (type === 'tech' || type === 'spell') {
        act = DB.actions[p.id];
        if (!act) return attack();
        const why = this.unusable(u, p.id, type === 'tech' ? slot : undefined);
        if (why) return attack(); // R3: WP / MP / 沈黙 / 届かない → 攻撃 (防御 when nothing reaches)
      } else if (type === 'item') {
        const it = DB.items[p.id];
        if (!it || !it.use || !it.use.battle || this.count(p.id) - (reserved[p.id] || 0) <= 0) return attack(); // R4
        if (this.noEscape && B.isEscape(it.use)) return attack();
        act = it.use;
      } else return attack();
      let t = this.repeatTarget(u, act, p.target);
      if (t === false) return attack();
      // a single-target action whose target fell goes for the focus-fire target (R2)
      if (act.target === 'enemy' && (!p.target || !p.target.alive) && plan && R.BattleAI && R.BattleAI.focusOrder) t = R.BattleAI.focusOrder(this, plan)[0] || t;
      if (act.target === 'enemy' && t && t.alive) planAdd(t, this.expectDamage(u, act, t, { slot, item: type === 'item' }));
      if (type === 'item') reserved[p.id] = (reserved[p.id] || 0) + 1;
      const out = { type, id: p.id, target: t };
      if (type === 'tech') out.slot = slot;
      return out;
    }
    /** target for a repeated action: the old one if still valid, else a sensible one (false = pointless) */
    repeatTarget(u, act, t) {
      const friends = this.friends(u);
      const side = (u.isParty ? this.party : this.mons).filter((x) => !x.gone);
      switch (act.target) {
        case 'enemy': case 'group': return this.pickFoe(u, t && t.side !== u.side && !t.gone ? t : null) || false;
        case 'ally': case 'ally_other': {
          const ok = (x) => x && x.alive && !x.gone && x.side === u.side && (act.target !== 'ally_other' || x !== u);
          // a heal goes to whoever needs it most now
          if ((act.effects || []).some((e) => e.type === 'heal')) return friends.filter(ok).sort((a, b) => a.hpRate() - b.hpRate())[0] || false;
          if (ok(t)) return t;
          return friends.filter(ok).sort((a, b) => a.hpRate() - b.hpRate())[0] || false;
        }
        case 'ally_dead': {
          if (t && !t.alive && !t.gone && t.side === u.side) return t;
          return side.find((x) => !x.alive) || false;
        }
        case 'ally_any': return t && !t.gone && t.side === u.side ? t : u;
        default: return t || null; // all / self / random / party: no choice
      }
    }

    // ------------------------------------------------------- AI helpers
    /** expected HP damage of an action's damage effects on t (mean rolls × hit chance). o: {slot, item} */
    expectDamage(u, act, t, o) {
      o = o || {};
      const kind = o.item ? 'item' : act.kind || (u.isParty ? 'tech' : 'enemy');
      const ctx = { expect: true, act, kind, slot: o.slot, item: o.item ? {} : null, W: u.isParty && kind === 'tech' ? u.weapon(o.slot) : null };
      let sum = 0;
      for (const eff of act.effects || []) {
        if (eff.type !== 'damage' || eff.mp || eff.on) continue;
        const r = this.roll(u, t, eff, ctx);
        if (r.immune) continue;
        let d = r.zero ? 0 : r.dmg;
        if (t.metal) d = Math.min(d * (act.target === 'random' ? 1 : this.hitCountMean(eff)), t.hp);
        else if (act.target !== 'random') d *= this.hitCountMean(eff);
        sum += d;
      }
      return sum;
    }
    hitCountMean(eff) { const h = eff && eff.hits; return Array.isArray(h) ? (h[0] + h[1]) / 2 : Math.max(1, (h | 0) || 1); }
    expectAttack(u, t, slot) {
      if (!t) return 0;
      if (u.isParty && slot === undefined) slot = u.defaultSlot();
      if (u.isParty && !this.canReach(u, slot)) return 0;
      const r = this.roll(u, t, { formula: 'phys', power: 1 }, { expect: true, slot, attack: true });
      return r.zero ? 0 : Math.max(0, r.dmg);
    }
    /** expected HP healed on t by an action (0 if it does not heal) */
    expectHeal(u, act, t, item) {
      let n = 0;
      for (const eff of act.effects || []) {
        if (eff.type !== 'heal') continue;
        n += R.Mon && R.Mon.healAmount ? R.Mon.healAmount(u, t, eff, { item: !!item }) : t.mhp * (eff.pct || 0);
      }
      return n;
    }

    // ------------------------------------------------------- rewards (§3.3.8, §4.2.3, §4.10)
    /** §4.2.3 f(d) per monster, Σ round(exp × f) × (1 + expPct/100) (R.Rules.battleExp when present) */
    battleExp(c, defs, share) {
      if (share == null) share = 1;
      if (R.Rules && R.Rules.battleExp) { try { const n = R.Rules.battleExp(c, defs, share); if (n != null) return n; } catch (e) { /* fallback */ } }
      const F = K('FALLOFF');
      let sum = 0;
      for (const d of defs) {
        const diff = (c.level || 1) - (d.lv || 1);
        const f = diff <= 0 ? 1 + F.downStep * Math.min(F.downMax, -diff) : Math.max(F.min, Math.pow(F.up, diff));
        sum += Math.round((d.exp || 0) * f);
      }
      let pct = 0;
      try { const st = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null; pct = (st && st.mods && st.mods.expPct) || 0; } catch (e) { pct = 0; }
      const cap = K('MODCAP');
      return defs.length ? Math.max(1, Math.round(sum * share * (1 + U.clamp(pct, cap.expMin, cap.exp) / 100))) : 0;
    }
    computeRewards() {
      // plain {exp, lv} per kill (the scaled / golden values of this battle; a monster def's own `def` is its 守備力)
      const defs = this.killed.map((m) => ({ exp: m.d.exp || 0, lv: m.d.lv || 1, gold: m.d.gold || 0 }));
      let gold = 0;
      for (const d of defs) gold += d.gold || 0;
      gold = Math.round(gold * (1 + this.partyMod('goldPct') / 100));
      const RR = K('RESERVE_RATE');
      const expOf = (c, share) => (defs.length ? Math.max(1, this.battleExp(c, defs, share)) : 0);
      const each = this.party.map((p) => ({ u: p, c: p.c, exp: expOf(p.c, p.alive ? 1 : RR), reserve: false }));
      const bench = this.bench.map((c) => ({ u: null, c, exp: expOf(c, RR), reserve: true }));
      const mods = this.partyMods();
      const drops = [];
      for (const m of this.killed) {
        if (m.summoned) continue;
        const list = R.Mon && R.Mon.rollDrops ? R.Mon.rollDrops(m.d, { golden: m.golden, mods, tier: this.tier }) : [];
        for (const x of list) drops.push(Object.assign({ mon: m.id, name: m.base }, x));
      }
      const rank = { normal: 0, rare: 1, super: 2 };
      drops.sort((a, b) => (rank[a.grade] || 0) - (rank[b.grade] || 0)); // stable: same grade in kill order (§11.5.8)
      return { gold, drops, each, bench };
    }
    gainExp(c, n) {
      const lv0 = c.level || 1;
      const before = { hp: this.maxOf(c, 'hp'), mp: this.maxOf(c, 'mp'), wp: this.maxOf(c, 'wp') };
      let res = null;
      if (R.Rules && R.Rules.gainExp) { try { res = R.Rules.gainExp(c, n); } catch (e) { R.warn('battle: R.Rules.gainExp failed', e && e.message); } }
      else c.exp = (c.exp || 0) + n;
      let levels = 0, gains = null;
      if (res && typeof res === 'object') { levels = res.levels || 0; gains = res.gains || null; }
      else if (typeof res === 'number') levels = res;
      if (!levels) levels = (c.level || 1) - lv0;
      if (levels > 0 && !gains) gains = { hp: this.maxOf(c, 'hp') - before.hp, mp: this.maxOf(c, 'mp') - before.mp, wp: this.maxOf(c, 'wp') - before.wp };
      return { levels, gains: gains || { hp: 0, mp: 0, wp: 0 } };
    }
    maxOf(c, k) { try { const st = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null; return (st && st[k]) || 0; } catch (e) { return 0; } }
    /** victory: messages + apply EXP / gold / items (to R.Game when live) in the order of §3.3.8 */
    *rewards() {
      const rw = (this.rewardInfo = this.computeRewards());
      if (!this.killed.length) { yield this.m('魔物たちはいなくなった。'); yield { t: 'pause' }; return; }
      yield { t: 'victory' };
      yield this.m('魔物たちを倒した！');
      const got = rw.each.filter((e) => e.exp > 0);
      if (got.length) {
        if (got.every((e) => e.exp === got[0].exp)) yield this.m(got.length > 1 ? `それぞれ${got[0].exp}の経験値を得た！` : `${got[0].c.name}は${got[0].exp}の経験値を得た！`);
        else for (const e of got) yield this.m(`${e.c.name}は${e.exp}の経験値を得た！`);
      }
      if (rw.gold > 0) {
        if (this.live && R.State && R.Game && R.State.addGold) R.State.addGold(rw.gold);
        yield this.m(`${rw.gold}ゴールドを手に入れた！`);
      }
      this.gold = rw.gold;
      yield { t: 'pause' };
      this.levelUps = [];
      let jingle = false;
      for (const e of got) {
        const r = this.gainExp(e.c, e.exp);
        if (e.u) e.u.refresh();
        if (!r.levels) continue;
        this.levelUps.push({ char: e.c.id, level: e.c.level });
        yield { t: 'clear' };
        if (!jingle) { jingle = true; yield { t: 'jingle', id: 'levelup' }; }
        yield { t: 'levelup', c: e.c, u: e.u, level: e.c.level, gains: r.gains };
        yield this.m(`${e.c.name}はレベル${e.c.level}に上がった！`);
        const parts = ['hp', 'mp', 'wp'].filter((k) => r.gains[k] > 0).map((k) => `${NAMES.stat[k]}+${r.gains[k]}`);
        if (parts.length) yield this.m(parts.join('　'));
        if (this.live && !(R.Rules && R.Rules.gainExp)) R.emit('levelup', e.c, e.c.level);
        yield { t: 'pause' };
      }
      this.dropsGot = [];
      for (const d of rw.drops) {
        yield { t: 'clear' };
        if (d.gold) {
          if (this.live && R.State && R.Game && R.State.addGold) R.State.addGold(d.gold);
          this.gold += d.gold;
          yield this.m(`${d.gold}ゴールドを手に入れた！`);
          yield { t: 'pause' };
          continue;
        }
        const it = DB.items[d.item];
        if (!it) { R.warn('battle: unknown drop item', d.item); continue; }
        const shown = it.grade === 'super' || d.grade === 'super' ? 'super' : it.grade === 'rare' || d.grade === 'rare' ? 'rare' : 'normal';
        const label = (shown !== 'normal' ? '★' : '') + it.name;
        if (!this.giveItem(d.item, d.n || 1)) {
          yield this.m(`${d.name}は${label}を残していった！`);
          yield this.m('これ以上は持てない。');
          yield { t: 'pause' };
          continue;
        }
        this.dropsGot.push({ item: d.item, grade: d.grade, mon: d.mon });
        if (this.live && R.Game) {
          // R.State.noteDrop fills the bestiary slot and counts rare / super-rare finds in R.Game.records
          if (R.State && R.State.noteDrop) { if (d.slot !== 'bonus') R.State.noteDrop(d.mon, d.grade); }
          else if (R.Game.records) { if (d.grade === 'rare') R.Game.records.rareDrops = (R.Game.records.rareDrops || 0) + 1; if (d.grade === 'super') R.Game.records.superDrops = (R.Game.records.superDrops || 0) + 1; }
          R.emit('drop', d.item, d.grade, d.mon);
        }
        yield { t: 'drop', mon: d.mon, name: d.name, item: d.item, grade: shown, slot: d.grade, n: d.n || 1 };
        yield this.m(`${d.name}は${label}を残していった！`);
        if (shown === 'rare') yield this.m('レアアイテムだ！');
        if (shown === 'super') yield this.m('超レアアイテムだ！');
        yield { t: 'pause' };
      }
      const bench = rw.bench.filter((e) => e.exp > 0);
      if (bench.length) {
        for (const e of bench) {
          const r = this.gainExp(e.c, e.exp);
          if (r.levels) { this.levelUps.push({ char: e.c.id, level: e.c.level, reserve: true }); if (this.live && !(R.Rules && R.Rules.gainExp)) R.emit('levelup', e.c, e.c.level); }
        }
        yield { t: 'clear' };
        yield this.m('控えの仲間も経験値を得た。');
        yield { t: 'pause' };
      }
    }

    // ------------------------------------------------------- the end
    /**
     * after-battle recovery (§4.12.1): won → survivors HP full, MP/WP +10 % of max (rounded up); escaped → HP full;
     * statuses and buffs always go. R.Party.afterBattle is used for a live battle when it exists.
     */
    recover(result) {
      const A = K('AFTER');
      for (const p of this.party) {
        const c = p.c;
        c.status = {};
        if ((result === 'win' || result === 'escape') && c.hp > 0) {
          c.hp = p.mhp;
          if (result === 'win') {
            c.mp = Math.min(p.mmp, c.mp + Math.ceil(p.mmp * A.mpPct));
            c.wp = Math.min(p.mwp, c.wp + Math.ceil(p.mwp * A.wpPct));
          }
        }
      }
    }
    /** bookkeeping once the battle is over (real and simulated); runs once */
    finish() {
      if (this.finished) return;
      this.finished = true;
      const result = this.result;
      if (this.live && R.Game) {
        // the bestiary and R.Game.records belong to R.State (killed() counts goldens, seen() rare monsters)
        if (R.State && R.State.killed) for (const m of this.killed) R.State.killed(m.id, { golden: m.golden });
        else if (R.Game.records) for (const m of this.killed) if (m.golden) R.Game.records.goldens = (R.Game.records.goldens || 0) + 1;
      }
      const partyAfter = this.live && R.Party && R.Party.afterBattle;
      for (const p of this.party) {
        const c = p.c;
        c.status = {};
        if (!partyAfter) { c.counts = c.counts || { battles: 0, kills: 0, glimmers: 0 }; c.counts.battles = (c.counts.battles || 0) + 1; }
        if (c.hp <= 0) c.hp = 0;
        if (R.Rules && R.Rules.clampHpMp) { try { R.Rules.clampHpMp(c); } catch (e) { /* ignore */ } }
        c.hp = U.clamp(c.hp, 0, p.mhp); c.mp = U.clamp(c.mp, 0, p.mmp); c.wp = U.clamp(c.wp, 0, p.mwp);
      }
      if (this.live) {
        const rw = this.rewardInfo;
        B.last = {
          result, rounds: this.round, zone: this.o.zone || null, troop: this.o.troop || null,
          killed: this.killed.map((m) => ({ id: m.id, golden: m.golden })),
          exp: rw ? rw.each.reduce((mx, e) => Math.max(mx, e.exp), 0) : 0,
          gold: this.gold || 0,
          drops: (this.dropsGot || []).slice(),
          stolen: this.stolen.slice(),
          glimmers: this.glimmers.slice(),
          levelUps: (this.levelUps || []).slice(),
        };
        // §4.12.1 recovery (and counts.battles) once, here — the scene must not call it again
        const G = R.Game;
        const members = G && G.party && this.party.length < G.party.length ? this.party.map((p) => p.c.id) : undefined;
        if (partyAfter) { try { R.Party.afterBattle(result, members ? { members } : undefined); } catch (e) { R.warn('battle: R.Party.afterBattle failed', e && e.message); this.recover(result); } }
        else this.recover(result);
      } else if (this.o.after) this.recover(result);
    }
  }

  /** an action whose only battle effect is running away (煙玉 …) */
  B.isEscape = (act) => !!(act && act.effects && act.effects.length && act.effects.every((e) => e.type === 'escape' || !BATTLE_EFFECT[e.type]) && act.effects.some((e) => e.type === 'escape'));

  // ------------------------------------------------------------ battle setup
  /**
   * Resolve what a battle is made of (§3.3.8): the tier Tb, the battle level Lb, the monsters (rare swap →
   * R.Mon.buildList → golden roll for zone battles). o: R.Battle.start's options; ctx: {party (for mods), noGame}.
   * → {kind:'zone'|'troop'|'mons', Tb, Lb, mons:[{id, golden}], rare, golden, zone, troop} | null
   */
  function resolveMonsters(o, ctx) {
    o = o || {};
    ctx = ctx || {};
    const troop = o.troop && DB.troops[o.troop];
    const zone = o.zone && DB.encounters[o.zone];
    const cur = o.tier != null ? o.tier : tierNow();
    let kind, Tb, Lb = null, spec = null, rare = false;
    if (o.mons) {
      kind = 'mons';
      Tb = cur;
      spec = o.mons;
      Lb = o.lv != null ? o.lv : LZ(Tb) + (o.lvOff || 0);
    } else if (troop) {
      // a troop's own tier is fixed (最終地方・裏); scale:'tier' troops follow the current tier (§4.14.1)
      kind = 'troop';
      Tb = troop.tier != null ? troop.tier : cur;
      spec = troop.mons;
      if (o.lv != null) Lb = o.lv;
      else if (troop.lv != null && troop.scale !== 'tier') Lb = troop.lv;
      else if (troop.scale === 'tier' || troop.tier != null || troop.lvOff != null) Lb = LZ(Tb) + (o.lvOff != null ? o.lvOff : troop.lvOff || 0);
    } else if (zone) {
      // a zone's numeric tier is fixed (prologue 0, final 8, post-game 9); 'dyn' follows the current tier (§4.14.1)
      kind = 'zone';
      Tb = typeof zone.tier === 'number' ? zone.tier : cur;
      if (o.lv != null) Lb = o.lv;
      else if (zone.lv && zone.lv.length) Lb = U.ri(zone.lv[0], zone.lv[zone.lv.length - 1]);
      else if (o.lvOff != null) Lb = LZ(Tb) + o.lvOff;
      else {
        let zl = null;
        if (R.Rules && R.Rules.zoneLevel && o.tier == null) {
          try { zl = R.Rules.zoneLevel(o.zone, (R.Field && R.Field.map && (R.Field.map.def || R.Field.map)) || null); } catch (e) { zl = null; }
        }
        Lb = zl && zl.Lb != null ? zl.Lb : LZ(Tb) + (zone.lvOff || 0);
      }
      const rr = !o.noRare && DB.rareEncounters && DB.rareEncounters[o.zone];
      if (rr && DB.monsters[rr.mon] && o.rare !== false) {
        const mods = ctx.mods || {};
        const cap = K('MODCAP').party;
        const lure = R.Game && R.Game.encItem && R.Game.encItem.pct > 0 ? 2 : 1;
        const p = (1 / Math.max(1, rr.rate || K('RARE_ENC'))) * (1 + Math.min(cap, mods.rareEncPct || 0) / 100) * lure;
        if (o.rare === 'force' || U.chance(p)) { rare = true; spec = [[rr.mon, 1]]; Lb += K('RARE_MON').lvOff; }
      }
      if (!spec) { const g = R.Mon && R.Mon.zoneGroup ? R.Mon.zoneGroup(o.zone, Tb) : null; spec = g ? g.mons : null; }
    } else return null;
    const ids = R.Mon && R.Mon.buildList ? R.Mon.buildList(spec || [], Tb, { keepOrder: kind === 'troop' }) : [];
    if (!ids.length) return null;
    let gi = -1;
    if (kind === 'zone' && !rare && !o.noGolden && o.golden !== false && R.Mon && R.Mon.rollGolden) {
      if (o.golden === 'force') { gi = ids.findIndex((id) => R.Mon.canBeGolden(DB.monsters[id])); }
      else gi = R.Mon.rollGolden(ids, ctx.mods || { goldenPct: 0 });
    }
    if (Lb == null) Lb = ids.reduce((m, id) => Math.max(m, (DB.monsters[id] && DB.monsters[id].lv) || 1), 1);
    return { kind, Tb, Lb, mons: ids.map((id, i) => ({ id, golden: i === gi })), rare, golden: gi >= 0, zone: o.zone || null, troop: o.troop || null };
  }
  /** capped party-wide mods of a list of CharStates (living ones) — used before an Engine exists */
  function charsMods(chars) {
    const out = {};
    const cap = K('MODCAP');
    for (const c of chars || []) {
      if (!c || !(c.hp > 0)) continue;
      let m = null;
      try { const st = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null; m = st && st.mods; } catch (e) { m = null; }
      if (!m) continue;
      for (const k in PARTY_KEYS) out[k] = (out[k] || 0) + (m[k] || 0);
      out.preemptPct = (out.preemptPct || 0) + (m.preemptPct || 0);
    }
    for (const k in PARTY_KEYS) out[k] = Math.min(cap.party, out[k] || 0);
    out.preemptPct = Math.min(cap.preempt, out.preemptPct || 0);
    return out;
  }
  /**
   * Everything R.Battle.start needs before the scene opens (§3.3.8): monsters, the engine, backdrop, BGM and
   * whether オート carries over. Needs R.Game. → {eng, bg, bgm, autoStart, rare, golden, metal, boss, kind, o} | null
   */
  function setup(o) {
    o = Object.assign({}, o || {});
    const G = R.Game;
    if (!G) throw new Error('R.Battle.setup: no game in progress');
    const troop = o.troop && DB.troops[o.troop];
    const zone = o.zone && DB.encounters[o.zone];
    const all = G.party || [];
    const party = o.members && o.members.length ? all.filter((c) => o.members.includes(c.id)) : all.slice();
    const bench = all.filter((c) => !party.includes(c)).concat(G.reserve || []);
    const R0 = resolveMonsters(o, { mods: R.Rules && R.Rules.partyMods ? safe(() => R.Rules.partyMods(), charsMods(party)) : charsMods(party) });
    if (!R0) return null;
    const eng = new Engine({
      party, reserve: bench, mons: R0.mons, inv: G.inv, live: true,
      noEscape: !!(o.noEscape || (troop && troop.noEscape)), canLose: !!o.canLose,
      surprise: o.surprise, noSurprise: R0.kind !== 'zone',
      tier: R0.Tb, lv: R0.Lb, glimmerForce: o.glimmerForce, zone: o.zone, troop: o.troop, rare: R0.rare,
    });
    const special = eng.rare || eng.golden || eng.metal;
    let bg = o.bg || (troop && troop.bg) || (zone && zone.bg) || null;
    if (!bg && R.Field && R.Field.battleBg) { try { bg = R.Field.battleBg(o.zone); } catch (e) { bg = null; } }
    const bgm = o.bgm || (troop && troop.bgm) || (special ? 'rarebattle' : eng.boss ? 'boss' : 'battle');
    const autoStart = R0.kind === 'zone' && !o.canLose && !eng.noEscape && !eng.boss && !special &&
      !!(R.Settings && R.Settings.autoKeep !== false) && !!B.autoCarry;
    return { eng, bg: bg || 'grass', bgm, autoStart, rare: eng.rare, golden: eng.golden, metal: eng.metal, boss: eng.boss, kind: R0.kind, canLose: !!o.canLose, o };
  }
  function safe(fn, dflt) { try { const v = fn(); return v == null ? dflt : v; } catch (e) { return dflt; } }
  /**
   * Crest-compatible monster list for a battle ({mons}|{troop}|{zone}); the resolved tier / level / golden index ride
   * along as list.meta, which the Engine reads (so an older R.Battle.start still scales monsters to the tier).
   */
  function buildMons(o) {
    const r = resolveMonsters(o || {}, { mods: R.Game ? charsMods(R.Game.party) : {} });
    if (!r) return [];
    const out = r.mons.map((m) => m.id);
    out.meta = { Tb: r.Tb, Lb: r.Lb, golden: r.mons.findIndex((m) => m.golden), rare: r.rare };
    return out;
  }

  function drain(gen, sink) { for (const ev of gen) if (sink) sink(ev); }

  /**
   * Headless battle (balance tools, §3.3.8). Clones of the party / inventory, the party AI (オート unless o.ai) for the
   * player side, the normal monster AI. Same resolution code as real battles; R.Game is not changed.
   * o: {party (default R.Game.party), reserve, inv, mons|troop|zone, tier, lv, lvOff, glimTier, maxRounds = 50, seed,
   *     items (true = the AI may use any consumable; default 'auto'), ai (partyCommands options), rewards (apply EXP / drops),
   *     surprise, log, golden (true = roll like a zone battle, 'force'), rare (true = roll the rare swap, 'force'),
   *     glimmerForce, members, after (after-battle recovery), noEscape}
   * → {result, rounds, partyHpPct, partyMpPct, partyWpPct, hpLossPct, deaths, damageDealt, damageTaken, mpUsed, wpUsed,
   *    casts, techs, killed, mons, exp, gold, drops, glimmers, profUps, golden, rare, Tb, Lb, party, reserve, inv, log}
   */
  function simulate(o) {
    o = o || {};
    const saved = U.rng;
    if (o.seed != null) U.seed(o.seed);
    try {
      const src = o.party || (R.Game && R.Game.party) || [];
      let party = src.map((c) => U.clone(c));
      let reserve = (o.reserve || []).map((c) => U.clone(c));
      if (o.members && o.members.length) { reserve = reserve.concat(party.filter((c) => !o.members.includes(c.id))); party = party.filter((c) => o.members.includes(c.id)); }
      const inv = U.clone(o.inv || (R.Game && R.Game.inv) || {});
      const troop = o.troop && DB.troops[o.troop];
      const ro = Object.assign({}, o, { golden: o.golden === 'force' ? 'force' : o.golden ? true : false, rare: o.rare === 'force' ? 'force' : o.rare ? true : false });
      if (!o.rare) ro.noRare = true;
      if (!o.golden) ro.noGolden = true;
      const r0 = resolveMonsters(ro, { mods: charsMods(party) });
      if (!r0) return { result: 'none', rounds: 0, party, reserve, inv };
      const eng = new Engine({
        party, reserve, mons: r0.mons, inv, live: false,
        noEscape: !!(o.noEscape || (troop && troop.noEscape)), canLose: !!o.canLose,
        surprise: o.surprise, noSurprise: o.surprise === undefined ? r0.kind !== 'zone' : undefined,
        tier: r0.Tb, lv: r0.Lb, glimTier: o.glimTier != null ? o.glimTier : r0.Tb, glimmerForce: o.glimmerForce, after: !!o.after,
      });
      const log = o.log ? [] : null;
      const sink = log ? (ev) => { if (ev.t === 'msg') log.push(ev.text); } : null;
      const mhp0 = eng.party.reduce((s, p) => s + p.mhp, 0);
      const mp0 = eng.party.map((p) => p.mp), wp0 = eng.party.map((p) => p.wp);
      drain(eng.begin(), sink);
      const maxR = o.maxRounds || 50;
      const ai = Object.assign({}, (R.BattleAI && R.BattleAI.AUTO_OPTS) || { thrift: true, items: 'auto' }, o.items !== undefined ? { items: o.items } : null, o.ai);
      while (!eng.result && eng.round < maxR) {
        const cmds = R.BattleAI && R.BattleAI.partyCommands ? R.BattleAI.partyCommands(eng, ai) : [];
        drain(eng.playRound(cmds), sink);
      }
      if (eng.result === 'win' && o.rewards) drain(eng.rewards(), sink);
      const rw = eng.rewardInfo || (eng.result === 'win' ? eng.computeRewards() : { each: [], gold: 0, drops: [] });
      const hpEnd = eng.party.reduce((s, p) => s + Math.max(0, p.hp), 0);
      const mpUsed = eng.stats.mpUsed, wpUsed = eng.stats.wpUsed;
      eng.finish();
      const sum = (k) => eng.party.reduce((s, p) => s + Math.max(0, p[k]), 0);
      const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
      return {
        result: eng.result || 'timeout',
        rounds: eng.round,
        partyHpPct: pct(hpEnd, mhp0),
        partyMpPct: pct(sum('mp'), sum('mmp')),
        partyWpPct: pct(sum('wp'), sum('mwp')),
        hpLossPct: pct(eng.stats.taken, mhp0),
        deaths: eng.stats.deaths,
        damageDealt: eng.stats.dealt,
        damageTaken: eng.stats.taken,
        mpUsed, wpUsed,
        mpUsedBy: eng.party.map((p, i) => Math.max(0, mp0[i] - p.mp)),
        wpUsedBy: eng.party.map((p, i) => Math.max(0, wp0[i] - p.wp)),
        casts: Object.assign({}, eng.stats.casts), techs: Object.assign({}, eng.stats.techs), itemsUsed: eng.stats.items,
        killed: eng.killed.length,
        mons: eng.mons.map((m) => m.id),
        exp: rw.each ? rw.each.reduce((mx, e) => Math.max(mx, e.exp), 0) : 0, gold: rw.gold || 0,
        expEach: rw.each ? rw.each.map((e) => e.exp) : [],
        drops: (eng.dropsGot || rw.drops || []).map((d) => ({ item: d.item, grade: d.grade, mon: d.mon })),
        stolen: eng.stolen.slice(),
        glimmers: eng.glimmers.slice(),
        profUps: eng.profUps.slice(),
        golden: eng.golden, rare: eng.rare, metal: eng.metal, boss: eng.boss, Tb: eng.tier, Lb: eng.lv,
        party, reserve, inv, log,
      };
    } finally { U.rng = saved; }
  }

  Object.assign(B, {
    Engine, Unit, PartyUnit, MonUnit, NAMES, BUFF_STATS, STATUS_DEFAULTS: ST, BOSS_RES, UNUSABLE_TEXT,
    stageMult, stDef, badStatuses, isDisabling, wtypeInfo, weaponItem, hasBattleEffect, isMagicAct,
    MON_ATTACK_FX, WEAPON_FX, BATTLE_EFFECT, K,
    resolveMonsters, setup, buildMons, simulate, drain, charsMods,
    /** §3.3.6: the one healing formula (battle + field menu) */
    healAmount(user, target, eff, opts) { return R.Mon && R.Mon.healAmount ? R.Mon.healAmount(user, target, eff, opts) : 0; },
    /** help text for an unusable reason (§11.5.3) */
    reasonText(why) { return UNUSABLE_TEXT[why] || ''; },
    /** registry for effect type 'special': B.specials[id] = function* (engine, user, target, eff, ctx) */
    specials: B.specials || {},
    autoCarry: !!B.autoCarry,
    last: B.last || null,
  });
})(window.RPG);
