// R.BattleCore（BATTLE）: 戦闘の計算。移植の元は chronicle/src/systems/battle.js（DESIGN §3.3.8・§4.5〜§4.13・§6.2.4・§9.1.6・§9.11.1）に
// STATS_REWORK（§2.2 の式・§7.3 盗み専用・§8.2 武器枠 1 つ・§9 レベルなし）、WORLD_REDESIGN の E6（闇の強まり）・E18（ボスの予告）を当てた。
// 登録だけ。DOM に触れない。音も鳴らさない（演出は BSCENE）。
//
//   const B = R.BattleCore.create(setup)     V2_PLAN §2.5.13 の「戦闘の 1 回」（OBJ_API.battle）。R.Game を読む（書くのは B.finish() の 1 回だけ）
//   B.units / options(uid) / partyOptions() / submit(uid, {cmd, id, target}) / repeat() / repeatOn / setRepeat(v)
//   B.intro() → Event[]                       出てきた・先手を取った などの最初の出来事（round() の前に 1 回。呼ばなければ最初の round() が含める）
//   B.round() → Event[]                       1 ラウンドを解決して見せる順の出来事（R.Contract.BATTLE_EVENTS）
//   B.over / B.rewards() / B.escape() / B.finish()
//   R.BattleCore.Engine                       計算の本体（sim・テストは直接使う）。R.BattleCore.simulate(o) は頭だけの戦闘（sim）
//
// 中の出来事（Engine の yield。旧のまま＋足した物）は B が契約の出来事に写す（下の toEvents）。
(function (R) {
  'use strict';
  const DB = R.DB;
  const BC = (R.BattleCore = R.BattleCore || {});
  R.Stubs && R.Stubs.claim && R.Stubs.claim('BattleCore');

  // ------------------------------------------------------------ 乱数（R.Mon が持つ。戦闘ごとに差し替える）
  const RN = () => R.Mon.rng();
  const chance = (p) => RN().chance(p);
  const rf = (a, b) => RN().rf(a, b);
  const ri = (a, b) => RN().ri(a, b);
  const pick = (arr) => (arr && arr.length ? RN().pick(arr) : undefined);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  // ------------------------------------------------------------ 定数（R.Rules.K が正。無い間は今の rules.js と STATS_REWORK の値）
  const KF = {
    STAGE: [0.63, 0.77, 1, 1.3, 1.6],
    DK: (L) => 40 + 5 * L,
    LZ: (T) => 6 + 6 * T,
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    ROW: { middleTaken: 0.7, weight: { front: 2, middle: 1 }, aimMiddle: { front: 1, middle: 3 } },
    AFTER: { mpPct: 0.12 },
    ESCAPE: { base: 0.55, step: 0.12, agi: 0.5, min: 0.25, max: 0.95 },
    PREEMPT: 1 / 16,
    MODCAP: { party: 150, preempt: 30, cost: -50 },
    RARE_ENC: 80,
    RARE_MON: { lvOff: 2 },
    DEFEND: 0.5,
    DMG: { physRand: [0.9, 1.1], magRand: [0.95, 1.05], breathRand: [0.9, 1.1], fixedRand: [0.95, 1.05], max: 9999 },
    HIT: { min: 20, max: 100, blind: 0.5 },
    CRIT: { mult: 1.5 },
    EVA: { nimble: 25 },
    ABIL: { mid: 16, minMul: 0.5, tech: 0.01, sf: 0.04 },
    SF: { min: 0.6, max: 1.8 },
    METAL: { dmg: 1, critDmg: 2, hitMul: 3 },
    STATUS: { mndPer: 0.005, resistCap: 0.9, pCap: 0.95, bossDebuff: 0.5 },
    STEAL: { base: 0.35, agiDiv: 200, min: 0.1, max: 0.8, boss: 0.5, rareMul: 4, rareCap: 0.5, autoRare: 0.5, only: { cap: 0.5, autoMul: 0.5, golden: 2 } },
    BOSS_RES: { death: 1, sleep: 0.75, paralyze: 0.75, freeze: 0.75, confuse: 0.75, stun: 0.5, silence: 0.5, blind: 0.5, poison: 0.25, burn: 0.25 },
    GROW: { add: { boss: 4, rare: 2, golden: 1, metal: 6 } },
    DARK: { ambush: 0.08, stat: 1.1 },
    MAX_GOLD: 9999999,
    MAX_ITEM: 99,
  };
  function K(key) {
    const k = R.Rules && R.Rules.K;
    const v = k && k[key];
    const f = KF[key];
    if (v == null) return f;
    if (f && typeof f === 'object' && !Array.isArray(f) && typeof v === 'object' && !Array.isArray(v)) {
      const out = Object.assign({}, f);
      for (const x in v) out[x] = (f[x] && typeof f[x] === 'object' && !Array.isArray(f[x]) && v[x] && typeof v[x] === 'object') ? Object.assign({}, f[x], v[x]) : v[x];
      return out;
    }
    return v;
  }
  const stageMult = (s) => K('STAGE')[clamp(s | 0, -2, 2) + 2];
  const dkOf = (L) => (R.Rules && typeof R.Rules.dk === 'function' ? R.Rules.dk(L) : (typeof K('DK') === 'function' ? K('DK')(L) : 40 + 5 * L));
  const LZ = (T) => { const f = K('LZ'); return typeof f === 'function' ? f(T) : 6 + 6 * T; };
  const Wt = (T) => { const w = K('W'); return w[clamp(T | 0, 0, w.length - 1)]; };
  const tierNow = () => (R.Tier && R.Tier.get ? R.Tier.get() : (R.Game && R.Game.tier) || 0);
  const glimTierNow = () => (R.Tier && R.Tier.effective ? R.Tier.effective() : tierNow());
  const abilMul = (a, k) => (R.Mon && R.Mon.abilMul ? R.Mon.abilMul(a, k) : Math.max(0.5, 1 + k * ((a == null ? 16 : a) - 16)));
  const BUFF_STATS = ['atk', 'def', 'mag', 'mdef', 'agi'];
  const LETTERS = 'ＡＢＣＤＥＦＧＨ';
  const EMPTY = Object.freeze({});
  const PARTY_KEYS = { goldPct: 1, dropPct: 1, rarePct: 1, superPct: 1, rareEncPct: 1, goldenPct: 1, escapePct: 1 };

  // ------------------------------------------------------------ 行動の表（v2: 技・術・雑魚の行動・ボスの行動は別の表）
  /** id → 行動の定義（kind は tech・spell・enemy）。旧の DB.actions もあれば読む */
  function ACT(id) {
    if (!id) return null;
    let a = DB.techs && DB.techs[id];
    if (a) return a.kind ? a : normKind(a, 'tech');
    a = DB.spells && DB.spells[id];
    if (a) return a.kind ? a : normKind(a, 'spell');
    a = (DB.enemyActions && DB.enemyActions[id]) || (DB.bossActions && DB.bossActions[id]) || (DB.actions && DB.actions[id]);
    return a || null;
  }
  const kindCache = new WeakMap();
  function normKind(a, kind) {
    let c = kindCache.get(a);
    if (!c) { c = Object.assign({ kind }, a); kindCache.set(a, c); }
    return c;
  }
  const isUseItem = (it) => !!(it && (it.slot === 'use' || it.type === 'consumable'));

  // ------------------------------------------------------------ 状態（§4.8.1。DB.statuses が正、これは予備）
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
  };
  const elemName = (e) => (DB.elements && DB.elements[e] && DB.elements[e].name) || NAMES.elem[e] || e;
  // 選べない理由 → 説明の文（§11.5.3、STYLE_JA §9）
  const UNUSABLE_TEXT = {
    mp: 'MPが足りない！', silence: '術を封じられている！', reach: '後列からは届かない。', field: '戦闘中は使えない。',
    noescape: 'この戦いからは逃げられない！', seal: 'この武器では技が使えない。', noweapon: 'この技を使う武器を持っていない。', none: '今は使えない。',
  };

  // 通常攻撃の絵（魔物は系統、味方は武器の系統。品の art が上書き。STATS_REWORK §8.6）
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
  const WEAPON_FX = { sword: 'slash', greatsword: 'slash2', dagger: 'pierce', bow: 'arrow', staff: 'strike', fist: 'strike' };
  const ITEM_ART_FX = { katana: 'slash', rapier: 'pierce', axe: 'slash2', club: 'strike' };
  // STATS_REWORK §8.1: 5 系統（弓・杖は後列から届く）＋素手
  const WTYPE_FALLBACK = {
    sword: { kind: 'slash', reach: false }, greatsword: { kind: 'slash', reach: false }, dagger: { kind: 'pierce', reach: false },
    bow: { kind: 'pierce', reach: true }, staff: { kind: 'blunt', reach: true }, fist: { kind: 'blunt', reach: false },
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
  function weaponItem(W) { return (W && ((W.id && DB.items[W.id]) || W)) || EMPTY; }
  const FOE_T = { enemy: 1, enemies: 1, group: 1, random: 1, front: 1 };
  const BATTLE_EFFECT = { damage: 1, heal: 1, healMp: 1, revive: 1, cure: 1, status: 1, regen: 1, buff: 1, dispel: 1, steal: 1, scan: 1, escape: 1, cover: 1, summon: 1, special: 1 };
  const GATED = { status: 1, steal: 1, dispel: 1 };
  const hasBattleEffect = (a) => !!(a && ((a.effects && a.effects.some((e) => BATTLE_EFFECT[e.type])) || a.telegraph));
  const isMagicAct = (a) => !!(a && (a.magic || a.kind === 'spell' || (a.effects || []).some((e) => e.type === 'damage' && e.formula === 'magic')));
  const isPhysSingle = (a) => !!(a && a.target === 'enemy' && (a.effects || []).some((e) => e.type === 'damage' && (e.formula || 'phys') === 'phys'));
  const isEscape = (act) => !!(act && act.effects && act.effects.length && act.effects.every((e) => e.type === 'escape' || !BATTLE_EFFECT[e.type]) && act.effects.some((e) => e.type === 'escape'));

  // ---------------------------------------------------------------- 人と魔物
  class Unit {
    constructor(side, key, eng) {
      this.side = side; this.key = key;
      Object.defineProperty(this, 'eng', { value: eng, enumerable: false, writable: true });
      this.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      this.turns = {};
      this.defending = false;
      this.acts = 0;
      this.used = {};
      this.gone = false;
    }
    get alive() { return this.hp > 0 && !this.gone; }
    get isParty() { return this.side === 'party'; }
    hpRate() { return this.mhp ? this.hp / this.mhp : 0; }
    disabled() { for (const s of DISABLE) if (this.status[s]) return s; return null; }
    canAct() { return this.alive && !this.disabled(); }
    commandable() { return this.canAct() && !this.status.confuse; }
  }

  /**
   * v2 の R.Rules.stats(c)（K.stats: maxHp maxMp atk mag def mdef hit eva crit spd 能力値 6 つ wtype、mods は RULES が足す）を
   * 旧の形（hp mp w.weapon1/fist mods）に読み替える。武器は 1 本（STATS_REWORK §8.2）
   */
  function normStats(st, c) {
    st = Object.assign({}, st || {});
    st.mods = st.mods || {};
    if (st.hp == null || st.maxHp != null) st.hp = st.maxHp != null ? st.maxHp : st.hp;
    if (st.mp == null || st.maxMp != null) st.mp = st.maxMp != null ? st.maxMp : st.mp;
    if (st.mag == null) st.mag = st.int || 0;
    if (st.spd == null) st.spd = st.agi || 0;
    const w = (st.w = Object.assign({}, st.w || {}));
    const wid = c && c.equip && c.equip.weapon1;
    if (!w.weapon1 && wid && DB.items[wid]) {
      const it = DB.items[wid];
      const wt = st.wtype || it.wtype || 'sword';
      const info = wtypeInfo(wt);
      w.weapon1 = {
        id: wid, wtype: wt, atk: st.atk != null ? st.atk : it.atk || 0, hit: st.hit, crit: st.crit,
        kind: it.kind || info.kind, reach: it.reach != null ? it.reach : undefined, element: it.element || null, onHit: it.onHit || null,
      };
    }
    if (!w.fist) w.fist = { id: null, wtype: 'fist', atk: st.atk != null ? st.atk : 4, hit: st.hit != null ? st.hit : 90, crit: st.crit != null ? st.crit : 2, reach: false };
    return st;
  }

  class PartyUnit extends Unit {
    constructor(c, i, eng) {
      super('party', 'p' + i, eng);
      this.c = c; this.idx = i;
      this.uid = 'p_' + c.id;
      c.status = {};   // 状態は戦闘をまたがない（§3.2.6）
      if (c.mp == null) c.mp = 0;
      this.refresh();
    }
    refresh() {
      let st = null;
      try { st = R.Rules && R.Rules.stats ? R.Rules.stats(this.c) : null; } catch (e) { R.warn('battle: R.Rules.stats failed', this.c && this.c.id, e && e.message); }
      this.st = normStats(st, this.c);
      this.permRegen = !!this.st.mods.regen;
    }
    get name() { return this.c.name; }
    get hp() { return this.c.hp; }
    set hp(v) { this.c.hp = v; }
    get mp() { return this.c.mp; }
    set mp(v) { this.c.mp = v; }
    get mhp() { return this.st.hp || 1; }
    get mmp() { return this.st.mp || 0; }
    get status() { return this.c.status; }
    set status(v) { this.c.status = v; }
    get mods() { return this.st.mods; }
    get boss() { return false; }
    get rare() { return false; }
    get metal() { return false; }
    get golden() { return false; }
    get level() { return (R.Growth && R.Growth.equivLevel ? R.Growth.equivLevel(this.c) : this.c.gl) || 1; }
    get row() { return this.eng ? this.eng.effRow(this) : rowOf(this.c); }
    flag() { return false; }
    physMult() { return 1; }
    /** 武器（1 本。素手は fist） */
    weapon() { const w = this.st.w; return w.weapon1 || w.fist; }
    defaultSlot() { return this.st.w.weapon1 ? 'weapon1' : null; }
    attackSlots() { return [this.defaultSlot()]; }
    /** 持っている武器の系統（素手は 'fist'） */
    get wtype() { const W = this.weapon(); return W ? W.wtype : 'fist'; }
    stat(k) {
      const st = this.st;
      switch (k) {
        case 'atk': return (this.weapon() || {}).atk || st.atk || 0;
        case 'hit': { const W = this.weapon(); return W && W.hit != null ? W.hit : st.hit != null ? st.hit : 98; }
        case 'crit': { const W = this.weapon(); return W && W.crit != null ? W.crit : st.crit || 0; }
        case 'spd': return st.spd != null ? st.spd : st.agi || 0;
        default: return st[k] || 0;
      }
    }
    elemMult(e) { const r = this.st.elemResist || this.st.mods.elemResist; return e && r && r[e] != null ? r[e] : 1; }
    elemBoost(e) { const b = this.st.mods.elemBoost; return (e && b && b[e]) || 0; }
    /** STATS_REWORK §2.2: statusImmune → 1、ほかは min(0.9, 0.005 × 精神 + statusResist[s]) */
    resist(s) {
      const im = this.st.statusImmune || this.st.mods.statusImmune;
      if (im && im.includes(s)) return 1;
      const sr = this.st.statusResist || this.st.mods.statusResist;
      const S = K('STATUS');
      return Math.min(S.resistCap, (this.st.mnd || 0) * (S.mndPer != null ? S.mndPer : 0.005) + ((sr && sr[s]) || 0));
    }
  }
  const rowOf = (c) => (c && (c.row === 'back' || c.row === 'middle') ? 'back' : 'front');

  class MonUnit extends Unit {
    /** entry: 魔物の id か {id, golden, summoned} */
    constructor(entry, i, eng) {
      super('mon', 'm' + i, eng);
      const e = typeof entry === 'string' ? { id: entry } : entry || {};
      const id = e.id;
      const d = (R.Mon && R.Mon.def ? R.Mon.def(id, { Lb: eng && eng.lv, golden: !!e.golden, dark: !!(eng && eng.dark) }) : null) || DB.monsters[id];
      this.id = id; this.idx = i; this.d = d;
      this.uid = 'e_' + i;
      this.golden = !!(d.golden || e.golden) && !!d.golden;
      this.summoned = !!e.summoned;
      this.base = d.name; this.name = d.name;
      this.hp = this.mhp = Math.max(1, d.hp | 0);
      this.mp = this.mmp = 0;
      this.status = {};
      this.flags = (d.flags || []).slice();
      if (this.golden && !this.flags.includes('golden')) this.flags.push('golden');
      if (this.summoned) this.flags.push('summoned');
      this.stolen = false;
      this.stolenSt = false;
      this.permRegen = false;
      this.phaseDone = {};
      this.reserved = null;   // E18: 予告した次の手番の行動 {id, cancel, from}
    }
    get species() { return this.id + (this.golden ? '*' : ''); }
    get mods() { return EMPTY; }
    get boss() { return this.flags.includes('boss'); }
    get rare() { return this.flags.includes('rare'); }
    get metal() { return this.flags.includes('metal'); }
    get level() { return this.d.lv || 1; }
    get lvShow() { return this.d.lvShow || this.d.lv || 1; }
    get race() { return this.d.race; }
    flag(f) { return this.flags.includes(f) || this.d.race === f; }
    ownDef() { if (!this._own) { this.d = Object.assign({}, this.d); this._own = true; } return this.d; }
    actsPerTurn() { return clamp(this.d.actsPerTurn || 1, 1, 3); }
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
      if (this.metal) return 1;
      const r = this.d.statusRes;
      const v = r && r[s] != null ? r[s] : 0;
      if (this.boss || this.rare) return Math.max(v, K('BOSS_RES')[s] || 0);
      return v;
    }
  }

  // ---------------------------------------------------------------- 計算の本体
  class Engine {
    /**
     * o: {party:[CharState]（写し。Engine が書き換える）, mons:[monId | {id, golden, summoned}], inv:{id:n}（写し）, gold,
     *     noEscape, canLose, surprise:'pre'|'ambush'|null（固定）, noSurprise, tier (Tb), lv (Lb), glimTier, glimmerForce:'hero',
     *     zone, troop, rare, dark（E6 の闇の強まり）, rng（R.Mon.mkRng の物。無ければ o.seed から）}
     */
    constructor(o) {
      o = this.o = o || {};
      this.rng = o.rng || R.Mon.mkRng(o.seed != null ? o.seed : 'battle');
      this.use();
      this.inv = o.inv || {};
      this.tier = o.tier != null ? o.tier : tierNow();
      this.dark = !!o.dark;
      const entries = (o.mons || []).map((e) => (typeof e === 'string' ? { id: e } : Object.assign({}, e))).filter((e) => {
        if (DB.monsters[e.id]) return true;
        R.warn('battle: unknown monster', e.id);
        return false;
      });
      let lv = o.lv;
      if (lv == null) lv = entries.reduce((m, e) => Math.max(m, DB.monsters[e.id].lv || 1), 1);
      this.lv = Math.max(1, Math.round(lv));
      this.dk = dkOf(this.lv);
      this.glimTier = o.glimTier != null ? o.glimTier : glimTierNow();
      this.party = (o.party || []).map((c, i) => new PartyUnit(c, i, this));
      this.mons = entries.map((e, i) => new MonUnit(e, i, this));
      this.relabel();
      this.boss = this.mons.some((m) => m.boss);
      this.rare = this.mons.some((m) => m.rare);
      this.golden = this.mons.some((m) => m.golden);
      this.metal = this.mons.some((m) => m.metal);
      this.noEscape = !!o.noEscape || this.boss;
      this.canLose = !!o.canLose;
      const gp = R.Glimmer && R.Glimmer.params ? safe(() => R.Glimmer.params(this.mons.map((u) => ({ def: u.d, flags: u.flags, golden: u.golden })), this.tier), null) : null;
      this.rankB = gp ? gp.rankB : this.mons.reduce((m, u) => Math.max(m, R.Mon.rank(u.d, this.tier)), this.tier + 1);
      this.ef = gp ? gp.ef : this.mons.reduce((m, u) => Math.max(m, R.Mon.ef(u.d)), 1);
      this.forceGlim = o.glimmerForce === 'hero' || o.glimmerForce === true ? 'hero' : null;
      this.forceUsed = false;
      this.round = 0;
      this.escapeFails = 0;
      this.result = null;
      this.surprise = null;
      this.killed = [];
      this.stolen = [];
      this.gains = [];       // 盗んだ品（B.finish が R.State.gain で入れる）
      this.goldLost = 0;     // 魔物に盗まれたお金
      this.gold0 = o.gold || 0;
      this.glimmers = [];
      this.profUps = [];
      this.reactQ = [];
      this.said = 0;
      this.coverSeq = 0;
      this.phaseQ = new Set();
      this.flags = {};       // 戦闘の中の旗（根を焼いた 等。行動の cond の flag / noFlag が読む）
      this.stats = { dealt: 0, taken: 0, deaths: 0, mpUsed: 0, casts: {}, techs: {}, items: 0 };
      this.finished = false;
    }
    /** この戦闘の乱数を R.Mon に渡す（計算の前に毎回。ほかの戦闘と混ざらない） */
    use() { R.Mon.setRng(this.rng); return this; }

    // ------------------------------------------------------- 問い
    units() { return this.party.concat(this.mons); }
    living(side) { return (side === 'party' ? this.party : this.mons).filter((u) => u.alive); }
    foes(u) { return this.living(u.isParty ? 'mon' : 'party'); }
    friends(u) { return this.living(u.side); }
    leaderName() { const l = this.party.find((p) => p.alive) || this.party[0]; return l ? l.name : ''; }
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
    partyMod(key) {
      let s = 0;
      for (const p of this.party) if (p.alive) s += p.mods[key] || 0;
      const cap = K('MODCAP');
      if (key === 'preemptPct') return Math.min(cap.preempt, s);
      if (PARTY_KEYS[key]) return Math.min(cap.party, s);
      return s;
    }
    partyMods() { const o = {}; for (const k in PARTY_KEYS) o[k] = this.partyMod(k); o.preemptPct = this.partyMod('preemptPct'); return o; }
    /** 見かけの列（§4.5.3）: 後列の人は、前列に生きている人がいないと前列あつかい */
    effRow(u) {
      if (!u.isParty) return 'front';
      if (rowOf(u.c) !== 'back') return 'front';
      return this.party.some((p) => p.alive && rowOf(p.c) !== 'back') ? 'back' : 'front';
    }
    slotReaches(u) {
      const W = u.weapon();
      if (!W) return false;
      if (W.reach === true || W.reach === 'any') return true;
      if (W.reach === false || W.reach === 'front') return false;
      return wtypeInfo(W.wtype).reach;
    }
    canReach(u) { return this.effRow(u) !== 'back' || this.slotReaches(u); }
    attackIssue(u) { return u.isParty && !this.canReach(u) ? 'reach' : null; }
    /** 技・術の MP（R.Rules.mpCost が techCostPct・mpCostPct・熟練の割引を持つ） */
    mpCost(u, id) {
      const a = ACT(id);
      if (!u.isParty || !a || !a.mp) return 0;
      if (R.Rules && R.Rules.mpCost) { try { const n = R.Rules.mpCost(u.c, id); if (n != null) return n; } catch (e) { /* 下へ */ } }
      const pct = a.kind === 'tech' ? u.mods.techCostPct : u.mods.mpCostPct;
      return Math.max(1, Math.round(a.mp * (1 + Math.max(K('MODCAP').cost, pct || 0) / 100)));
    }
    /**
     * 今それを選べない理由（null = 選べる）: 'mp' 'silence' 'reach' 'field' 'noescape' 'seal' 'noweapon' 'none'
     * 技は持っている武器の系統だけ（STATS_REWORK §8.2。控えの枠で補わない）
     */
    unusable(u, id) {
      const a = ACT(id);
      if (!a) {
        const it = DB.items[id];
        if (!it) return 'none';
        if (!it.use || !it.use.battle || !hasBattleEffect(it.use)) return 'field';
        if (this.count(id) <= 0) return 'none';
        if (u.isParty && this.noEscape && isEscape(it.use)) return 'noescape';
        return null;
      }
      if (u.isParty) {
        if (a.kind === 'tech') {
          if (u.wtype !== a.wtype) return 'noweapon';
          if (weaponItem(u.weapon()).sealTech) return 'seal';
          if (a.magic && u.status.silence) return 'silence';
          if (this.effRow(u) === 'back' && !a.reach) return 'reach';
          if (u.mp < this.mpCost(u, id)) return 'mp';
        } else if (a.kind === 'spell') {
          if (u.mods.noSpell) return 'none';
          if (u.status.silence) return 'silence';
          if (u.mp < this.mpCost(u, id)) return 'mp';
        } else if (a.magic && u.status.silence) return 'silence';
      } else if (isMagicAct(a) && u.status.silence) return 'silence';
      if (!hasBattleEffect(a)) return 'field';
      if (u.isParty && a.target === 'ally_other' && !this.friends(u).some((x) => x !== u)) return 'none';
      if (u.isParty && this.noEscape && isEscape(a)) return 'noescape';
      return null;
    }
    weaponFx(u) {
      if (u.isParty) {
        const W = u.weapon();
        const it = W && W.id ? DB.items[W.id] : null;
        return (it && (it.fx || ITEM_ART_FX[it.art])) || wtypeInfo(W ? W.wtype : 'fist').fx;
      }
      const d = u.d;
      return d.attackFx || MON_ATTACK_FX[d.lineage] || MON_ATTACK_FX[String(d.sprite || '').split('_')[0]] || 'claw';
    }

    // ------------------------------------------------------ 袋（写し）
    count(id) { return this.inv[id] || 0; }
    takeItem(id) {
      if (!this.inv[id]) return false;
      if (--this.inv[id] <= 0) delete this.inv[id];
      return true;
    }
    canCarry(id, n) {
      const got = this.gains.filter((g) => g.item === id).reduce((s, g) => s + g.n, 0);
      return !!DB.items[id] && (this.inv[id] || 0) + got + (n || 1) <= K('MAX_ITEM');
    }
    giveItem(id, n) {
      n = n || 1;
      if (!this.canCarry(id, n)) return false;
      this.gains.push({ item: id, n });
      return true;
    }

    // ------------------------------------------------------- 始まり
    *begin() {
      this.use();
      for (const g of this.groups()) {
        const u0 = g.units[0];
        if (u0.golden) yield { t: 'golden', u: u0 };
        yield this.m(g.n > 1 ? `${g.name}が${g.n}匹現れた！` : `${g.name}が現れた！`);
        if (g.n === 1 && u0.d.appear) yield this.m(u0.d.appear.replace(/\{user\}/g, u0.name));
      }
      if (this.o.surprise !== undefined && this.o.surprise !== null) this.surprise = this.o.surprise;
      else if (!this.o.noSurprise && !this.boss) {
        if (this.dark && chance(K('DARK').ambush)) this.surprise = 'ambush';
        else if (chance(this.preemptChance())) this.surprise = 'pre';
      }
      if (this.surprise === 'pre') yield this.m('魔物たちは、まだこちらに気づいていない。\n先手を取った！');
      if (this.surprise === 'ambush') yield this.m('暗がりから、魔物たちが襲いかかってきた！');
      if (this.dark && this.mons.some((m) => m.d.darkBoost)) yield this.m('闇の中で、魔物たちの力が増している……。');
      for (const p of this.party) {
        const sb = p.mods.startBuffs;
        if (!p.alive || !sb) continue;
        for (const k in sb) {
          if (!BUFF_STATS.includes(k)) continue;
          const nv = clamp(p.buffs[k] + sb[k], -2, 2);
          if (nv !== p.buffs[k]) { const d = nv - p.buffs[k]; p.buffs[k] = nv; yield { t: 'buff', u: p, stat: k, d, stage: nv, start: true }; }
        }
      }
    }
    preemptChance() {
      const avg = (l) => (l.length ? l.reduce((s, u) => s + u.stat('spd'), 0) / l.length : 1);
      const ratio = clamp(avg(this.living('party')) / Math.max(1, avg(this.living('mon'))), 0.5, 2);
      return K('PREEMPT') * ratio + this.partyMod('preemptPct') / 100;
    }

    // ------------------------------------------------------- ラウンド
    /**
     * 1 ラウンド。cmds: 味方の番号ごとの {type:'attack', target} {type:'tech', id, target} {type:'spell', id, target}
     * {type:'item', id, target} {type:'defend'}、または cmds.flee = true（一行で逃げる）。target は Unit
     */
    *playRound(cmds) {
      this.use();
      if (this.result) return;
      this.round++;
      const pre = this.round === 1 && this.surprise === 'pre';
      const ambush = this.round === 1 && this.surprise === 'ambush';
      cmds = cmds || [];
      let partyActs = !ambush;
      if (cmds.flee && !ambush) {
        if (yield* this.tryEscape(pre)) { this.checkEnd(); return; }
        partyActs = false;
      }
      const order = [];
      const init = (u) => u.stat('spd') * stageMult(u.buffs.agi) * rf(0.75, 1.0);
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
      this.pending = order.filter((s) => s.u.isParty && s.cmd);
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
      if (cmd.type === 'tech' || cmd.type === 'spell') { const a = ACT(cmd.id); return !!(a && a.quick); }
      return false;
    }

    *turn(u, cmd) {
      yield* this.clearNext(u);
      if (u.isParty && !cmd && u.commandable()) {
        let first = true;
        for (const ev of this.endTurn(u)) { if (first) { first = false; yield { t: 'actor', u }; } yield ev; }
        u.acts++;
        return;
      }
      yield { t: 'actor', u };
      const dis = u.disabled();
      if (dis) {
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
        if (!u.isParty && u.reserved) { u.reserved = null; yield { t: 'telegraph', u, text: '', pose: 'idle', tint: '', next: '', cancel: true }; }
      } else if (!u.isParty) {
        if (this.monFlees(u)) {
          u.gone = true;
          yield this.m(`${u.name}は逃げ出した！`);
          yield { t: 'flee', u };
          this.checkEnd();
          return;
        }
        if (u.reserved && this.round > u.reserved.round && ACT(u.reserved.id)) {
          // E18: 予告した大技（予約）は次のラウンドの最初の手番に。AI は選ばない
          cmd = { type: 'ability', id: u.reserved.id, target: null, reserved: true };
          u.reserved = null;
        } else cmd = R.BattleAI && R.BattleAI.monster ? R.BattleAI.monster(this, u) : { type: 'attack', target: pick(this.foes(u)) };
      }
      if (cmd) yield* this.execute(u, cmd);
      yield* this.flushReactions();
      yield* this.afterAction();
      if (!this.checkEnd()) yield* this.endTurn(u);
      u.acts++;
    }
    monFlees(u) {
      if (u.boss) return false;
      const rate = u.d.fleeRate != null ? u.d.fleeRate : u.flags.includes('flee') ? 0.3 : 0;
      if (!rate) return false;
      if (this.round < (u.d.fleeFrom || 1)) return false;
      return chance(rate);
    }
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
      const t = mates.length && (chance(0.5) || !foes.length) ? pick(mates) : pick(foes);
      return { type: 'attack', target: t || u, confused: true };
    }
    normCmd(u, cmd) {
      cmd = Object.assign({}, cmd);
      if (cmd.type === 'ability' && u.isParty) {
        const a = ACT(cmd.id);
        cmd.type = a && a.kind === 'spell' ? 'spell' : 'tech';
      }
      if (cmd.type === 'skill') cmd.type = 'tech';
      return cmd;
    }

    *execute(u, cmd) {
      cmd = this.normCmd(u, cmd);
      if (u.isParty && !cmd.confused) {
        const g = yield* this.glimmerStep(u, cmd);
        if (g && g.replace) {
          const r = yield* this.useAction(u, g.id, g.act, g.target, { free: true, glimmed: true });
          yield* this.trainAfter(u, g.act.kind === 'spell' ? { kind: 'spell', act: g.act, id: g.id } : { kind: 'tech', act: g.act, id: g.id }, r);
          return;
        }
      }
      switch (cmd.type) {
        case 'attack': {
          if (u.isParty && !cmd.confused && !this.canReach(u)) {
            u.defending = true;
            yield this.m(`${u.name}は守りを固めている。`);
            return;
          }
          const r = yield* this.attack(u, cmd.target, { confused: cmd.confused });
          if (u.isParty && !cmd.confused) yield* this.trainAfter(u, { kind: 'attack' }, r);
          return;
        }
        case 'defend':
          u.defending = true;
          yield { t: 'fx', fx: 'defend', user: u, targets: [u], kind: 'defend', cmd: 'defend', id: 'defend', name: '防御' };
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
          const a = ACT(cmd.id);
          if (!a) return yield* this.attack(u, cmd.target, {});
          const r = yield* this.useAction(u, cmd.id, a, cmd.target, {});
          if (u.isParty && r.done) yield* this.trainAfter(u, a.kind === 'spell' ? { kind: 'spell', act: a, id: cmd.id } : { kind: 'tech', act: a, id: cmd.id }, r);
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

    // ------------------------------------------------------- 閃き（§3.3.7・§4.9.2。技の候補は今の武器の系統だけ、STATS_REWORK §8.6）
    *glimmerStep(u, cmd) {
      const c = u.c;
      const force = this.forceGlim === 'hero' && !this.forceUsed && c.id === 'hero';
      if (force) this.forceUsed = true;
      let ctx = null;
      if (cmd.type === 'attack') {
        const W = u.weapon();
        if (W && this.canReach(u) && this.foes(u).length) ctx = { kind: 'tech', wtype: W.wtype, used: 'attack', sealTech: !!weaponItem(W).sealTech };
      } else if (cmd.type === 'tech') {
        const a = ACT(cmd.id);
        if (a && !this.unusable(u, cmd.id)) ctx = { kind: 'tech', wtype: a.wtype, used: cmd.id };
      } else if (cmd.type === 'spell') {
        const a = ACT(cmd.id);
        if (a && !this.unusable(u, cmd.id) && this.targets(u, a, cmd.target).length) ctx = { kind: 'spell', elements: (a.elements || []).slice(), used: cmd.id };
      } else if (cmd.type === 'item') {
        const it = DB.items[cmd.id];
        if (it && it.stone && this.count(cmd.id) > 0) ctx = { kind: 'spell', elements: [it.stone], used: cmd.id, stone: true };
      }
      if (!ctx && !force) return null;
      if (!ctx) ctx = { kind: 'tech', wtype: null, used: cmd.type };
      let res = null;
      const row = this.effRow(u);
      Object.assign(ctx, { rankB: this.rankB, ef: this.ef, tier: this.glimTier, row, middle: row === 'back', silenced: !!u.status.silence, force, fallbackWtype: u.wtype, rng: this.rng });
      if (R.Glimmer && R.Glimmer.roll) {
        try { res = R.Glimmer.roll(c, ctx); } catch (e) { R.warn('battle: R.Glimmer.roll failed', e && e.message); res = null; }
      }
      if (!res && force) res = this.forcedGlimmer(u);
      if (!res || !ACT(res.id)) return null;
      const id = res.id, a = ACT(id);
      const kind = a.kind === 'spell' ? 'spell' : 'tech';
      this.learn(u, id, a);
      yield { t: 'glimmer', u, id, kind, name: a.name };
      yield this.m(`${u.name}は${a.name}を閃いた！`);
      this.glimmers.push({ char: c.id, id, kind });
      const target = this.glimTarget(u, cmd, a);
      if (kind === 'spell' && !this.targets(u, a, target).length) return { replace: false };
      return { replace: true, id, act: a, target };
    }
    /** glimmerForce の予備: 今の武器の系統のまだ知らない技で glim.lv が最も低い物 */
    forcedGlimmer(u) {
      const wtype = u.wtype;
      const known = new Set(u.c.techs || []);
      const back = this.effRow(u) === 'back';
      let best = null;
      for (const id in DB.techs || {}) {
        const a = ACT(id);
        if (!a || a.wtype !== wtype || known.has(id)) continue;
        if (back && !a.reach) continue;
        if (a.magic && u.status.silence) continue;
        const lv = (a.glim && a.glim.lv) || a.rank || 99;
        if (!best || lv < best.lv) best = { id, lv };
      }
      return best ? { id: best.id, kind: 'tech' } : null;
    }
    learn(u, id, a) {
      const c = u.c;
      if (R.Glimmer && R.Glimmer.learn && !(R.Stubs && R.Stubs.installed && (R.Stubs.installed.Glimmer || []).includes('learn'))) {
        try { R.Glimmer.learn(c, id, { record: false, quiet: true }); return; } catch (e) { R.warn('battle: R.Glimmer.learn failed', e && e.message); }
      }
      const key = a.kind === 'spell' ? 'spells' : 'techs';
      c[key] = c[key] || [];
      if (!c[key].includes(id)) c[key].push(id);
    }
    glimTarget(u, cmd, a) {
      const orig = cmd.type === 'attack' ? { target: 'enemy' } : cmd.type === 'defend' ? null : ACT(cmd.id) || (DB.items[cmd.id] && DB.items[cmd.id].use) || null;
      const newFoe = !!FOE_T[a.target];
      if (orig && !!FOE_T[orig.target] === newFoe) {
        const t = cmd.target;
        if (!newFoe) return t || null;
        if (t && t.alive && t.side !== u.side) return t;
        const foes = this.foes(u);
        if (t && !t.isParty) { const same = foes.filter((m) => m.species === t.species); if (same.length) return pick(same); }
        return pick(foes) || null;
      }
      if (newFoe) return pick(this.foes(u)) || null;
      if (a.target === 'ally' || a.target === 'ally_any') return this.friends(u).slice().sort((x, y) => x.hpRate() - y.hpRate())[0] || u;
      return null;
    }
    /** 熟練度: 味方の攻撃・技・術・魔石のたびに R.Rules.train（写しの人に。B.finish が R.Game に写す） */
    *trainAfter(u, info, r) {
      if (!R.Rules || !R.Rules.train || !r || r.done === false) return;
      const tgt = (r && r.target) || (r && r.targets && r.targets[0]) || null;
      const x = { kind: info.kind, actionId: info.id || (info.kind === 'attack' ? 'attack' : undefined), killed: !!(r && r.killed), tier: this.glimTier };
      if (info.kind === 'attack' || info.kind === 'tech') {
        x.slot = 'weapon1';
        x.wtype = info.act ? info.act.wtype : u.wtype;
      } else {
        x.elements = info.stone ? [info.stone] : (info.act && info.act.elements) || [];
        if (info.stone) x.stone = true;
      }
      x.mon = tgt && !tgt.isParty ? { lv: tgt.level, rank: this.rankB, boss: tgt.boss } : { lv: this.lv, rank: this.rankB, boss: this.boss };
      let ups = null;
      try { ups = R.Rules.train(u.c, x); } catch (e) { R.warn('battle: R.Rules.train failed', e && e.message); }
      for (const up of Array.isArray(ups) ? ups : []) {
        this.profUps.push(Object.assign({ char: u.c.id }, up));
        yield { t: 'prof', u, kind: up.kind, id: up.id, rank: up.rank, from: up.from };
      }
    }

    // ------------------------------------------------------- 手番の終わり
    *endTurn(u) {
      if (!u.alive) return;
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
    /** ボスの段階（§9.11.1）: 行動の終わりに、越えたしきいごとに 1 回 */
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
          if (set.buffs) for (const k in set.buffs) if (BUFF_STATS.includes(k)) m.buffs[k] = clamp(m.buffs[k] + set.buffs[k], -2, 2);
          yield { t: 'phase', u: m, text: p.msg || '', sprite: set.sprite || null };
        }
      }
    }

    // ------------------------------------------------------- 逃げる（§4.11.3）
    *tryEscape(sure) {
      yield { t: 'actor', u: null };
      if (this.noEscape) {
        yield { t: 'escape', ok: false };
        yield this.m('この戦いからは逃げられない！');
        return false;
      }
      yield this.m('{hero}たちは逃げ出した。');
      if (sure || chance(this.escapeChance())) {
        this.result = 'escape';
        yield { t: 'escape', ok: true };
        return true;
      }
      this.escapeFails++;
      yield { t: 'escape', ok: false };
      yield this.m('しかし行く手をふさがれた！');
      return false;
    }
    escapeChance() {
      const E = K('ESCAPE');
      const avg = (l) => (l.length ? l.reduce((s, u) => s + u.stat('spd') * stageMult(u.buffs.agi), 0) / l.length : 0);
      const ap = avg(this.living('party')), am = avg(this.living('mon'));
      const p = clamp(E.base + E.step * this.escapeFails + E.agi * (ap - am) / Math.max(1, ap + am), E.min, E.max);
      return Math.min(1, p * (1 + this.partyMod('escapePct') / 100));
    }

    // ------------------------------------------------------- ねらい
    pickFoe(u, t, aim) {
      if (t && t.alive && t.side !== u.side) return t;
      const foes = this.foes(u);
      if (!foes.length) return null;
      if (u.isParty) {
        // 選んだ相手が倒れていたら同じ種（列）の次（A6）
        if (t && !t.isParty) {
          const same = foes.filter((m) => m.species === t.species);
          if (same.length) return same.slice().sort((a, b) => Math.abs(a.idx - t.idx) - Math.abs(b.idx - t.idx) || a.idx - b.idx)[0];
        }
        if (R.BattleAI && R.BattleAI.focusOrder) return R.BattleAI.focusOrder(this, this.pendingPlan())[0] || pick(foes);
        return pick(foes);
      }
      if (R.BattleAI && R.BattleAI.pickPartyTarget) return R.BattleAI.pickPartyTarget(this, aim) || pick(foes);
      return pick(foes);
    }
    pendingPlan() {
      const dmg = new Map();
      for (const s of this.pending || []) {
        const c = s.cmd, t = c && c.target;
        if (!t || !t.alive || t.isParty || !s.u.commandable()) continue;
        let d = 0;
        if (c.type === 'attack') d = this.expectAttack(s.u, t);
        else if ((c.type === 'tech' || c.type === 'spell' || c.type === 'ability') && ACT(c.id) && ACT(c.id).target === 'enemy') d = this.expectDamage(s.u, ACT(c.id), t);
        if (d > 0) dmg.set(t, (dmg.get(t) || 0) + d);
      }
      return { dmg };
    }
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
        // v2（根食らいの根の全体攻撃）: 前列（見かけの列）だけ
        case 'front': return foes.filter((x) => !x.isParty || this.effRow(x) === 'front');
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

    // ------------------------------------------------------- 攻撃
    *attack(u, target, o) {
      o = o || {};
      const res = { done: true, landed: false, target: null, killed: false };
      yield this.m(o.counter ? `${u.name}の反撃！` : `${u.name}の攻撃！`);
      let t;
      if (o.confused) t = target && target.alive && target !== u ? target : pick(this.units().filter((x) => x.alive && x !== u));
      else t = this.pickFoe(u, target);
      if (!t || !u.alive) { yield this.m('しかし効き目がなかった。'); return res; }
      let mul = 1;
      if (!o.counter && !o.confused) {
        const g = yield* this.guard(u, t);
        if (g.parried) { res.target = g.t; return res; }
        t = g.t; mul = g.mul;
      }
      res.target = t;
      yield { t: 'fx', fx: this.weaponFx(u), user: u, targets: [t], kind: o.counter ? 'counter' : 'attack', cmd: 'attack', id: 'attack', name: o.counter ? '反撃' : '攻撃' };
      const W = u.isParty ? u.weapon() : null;
      const eff = { type: 'damage', formula: 'phys', power: o.power || 1, critBonus: o.critBonus || 0 };
      const r = this.roll(u, t, eff, { W, attack: true, coverMul: mul });
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
      if (ct && ct.parry > 0 && d.canAct() && !d.status.confuse && chance(ct.parry)) {
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
          o = { power: st.power != null ? st.power : 1, critBonus: st.critBonus || 0 };
        } else if (r.kind === 'auto') {
          if (!chance(Math.min(1, u.mods.autoCounter))) continue;
          o = { power: 1 };
        } else continue;
        yield { t: 'react', u, kind: 'counter' };
        yield* this.attack(u, r.src, Object.assign({ counter: true }, o));
      }
      this.reactQ = [];
    }

    // ------------------------------------------------------- ダメージ（§4.6、STATS_REWORK §2.2）
    elementsOf(att, eff, ctx, f, W) {
      if (eff.element) return [eff.element];
      const act = ctx.act;
      if (act && act.elements && act.elements.length) return act.elements;
      if (att.isParty) return f === 'phys' && W && W.element ? [W.element] : [];
      return f === 'phys' && att.d.element ? [att.d.element] : [];
    }
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
    vsMult(vs, tgt) {
      if (!vs) return 1;
      let v = 1;
      for (const k in vs) if (tgt.flag(k) || tgt.status[k] || tgt.race === k) v *= vs[k];
      return v;
    }
    hitCount(eff) {
      const h = eff && eff.hits;
      if (Array.isArray(h)) return ri(h[0], h[1]);
      return Math.max(1, (h | 0) || 1);
    }
    /**
     * 当たりの 1 回を振る。ctx: {act, kind, W, item, atk, coverMul, expect}（expect: AI の平均。乱数なし）
     * → {dmg, crit, miss, immune, zero, el, weak}
     */
    roll(att, tgt, eff, ctx) {
      ctx = ctx || {};
      const x = !!ctx.expect;
      const rnd = (a, b) => (x ? (a + b) / 2 : rf(a, b));
      const f = eff.formula || (ctx.kind === 'spell' ? 'magic' : 'phys');
      const P = eff.power != null ? eff.power : 1;
      const party = att.isParty;
      const W = party && f === 'phys' ? ctx.W || att.weapon() : null;
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
          hitP = clamp(hitV * (eff.acc != null ? eff.acc : 1) - eva, Kh.min, Kh.max) / 100;
          if (att.status.blind) hitP *= Kh.blind;
        }
        if (!x && hitP < 1 && !chance(hitP)) return { miss: true, dmg: 0 };
        const cv = W && W.crit != null ? W.crit : att.stat('crit');
        critP = clamp((cv + (eff.critBonus || 0)) / 100, 0, 1);
      }
      const crit = !x && f === 'phys' && critP > 0 && chance(critP);
      if (tgt.metal) {
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
      const profM = this.profMul(att, ctx);
      let d, zero = E.mult === 0;
      if (f === 'phys') {
        const A = ctx.atk != null ? ctx.atk : W ? W.atk || 0 : att.stat('atk');
        const ig = eff.ignoreDef === true ? 1 : clamp(eff.ignoreDef || 0, 0, 1);
        const guardN = this.dk / (this.dk + Math.max(0, tgt.stat('def')) * (1 - ig));
        const kind = eff.kind || (W ? W.kind || wtypeInfo(W.wtype).kind : null);
        const kindM = kind ? tgt.physMult(kind) : 1;
        const vs = this.vsMult(eff.vs, tgt) * (W ? this.vsMult(weaponItem(W).vs, tgt) : 1);
        const rowM = tgt.isParty && this.effRow(tgt) === 'back' ? K('ROW').middleTaken : 1;
        const stage = stageMult(att.buffs.atk) / stageMult(tgt.buffs.def);
        const pct = 1 + this.pct(att, 'physPct') / 100;
        // STATS_REWORK §2.2: 技（物理）だけ × abilMul(器用さ, K.ABIL.tech)
        const techM = party && ctx.kind === 'tech' ? abilMul(att.stat('dex'), K('ABIL').tech) : 1;
        const base = A * P * kindM * E.mult * (1 + E.boost / 100) * vs * rowM * stage * pct * defendM * takenM * (ctx.coverMul || 1) * profM * techM;
        const cm = K('CRIT').mult;
        if (x) d = base * ((1 - critP) * guardN + critP * cm) * hitP;
        else d = base * (crit ? cm : guardN) * rnd(Kd.physRand[0], Kd.physRand[1]);
        zero = zero || kindM === 0 || vs === 0;
      } else if (f === 'magic') {
        const ig = clamp(eff.ignoreMdef || 0, 0, 1);
        const mdef = Math.max(0, tgt.stat('mdef')) * (1 - ig);
        d = att.stat('mag') * P * (this.dk / (this.dk + mdef)) * E.mult * (1 + E.boost / 100) *
          (stageMult(att.buffs.mag) / stageMult(tgt.buffs.mdef)) * (1 + this.pct(att, 'magicPct') / 100) * profM * defendM * takenM * rnd(Kd.magRand[0], Kd.magRand[1]);
      } else if (f === 'breath') {
        d = att.stat('atk') * P * E.mult * defendM * takenM * rnd(Kd.breathRand[0], Kd.breathRand[1]);
      } else if (f === 'tier') {
        d = P * Wt(this.tier) * E.mult * defendM * takenM * rnd(Kd.breathRand[0], Kd.breathRand[1]);
      } else {
        d = P * defendM * takenM * rnd(Kd.fixedRand[0], Kd.fixedRand[1]);
      }
      return { dmg: d, crit, zero, el: E.el, weak: E.mult >= 1.5 };
    }
    profMul(att, ctx) {
      if (!att.isParty || !att.c || ctx.item || !(R.Rules && R.Rules.profPowerMul)) return 1;
      try {
        if (ctx.attack) return R.Rules.profPowerMul(att.c, null, 'weapon1') || 1;
        if (ctx.kind !== 'tech' && ctx.kind !== 'spell') return 1;
        return R.Rules.profPowerMul(att.c, ctx.act, 'weapon1') || 1;
      } catch (e) { return 1; }
    }
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
          else yield* this.restore(att, g, 'hp', 'drain');
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
      yield { t: 'dmg', u: tgt, n: dmg, crit: !!r.crit, weak: !!r.weak, kind, src: att, el: info.element || null };
      yield this.m(`${tgt.name}に${dmg}のダメージ！`);
      if (tgt.hp <= 0) yield* this.die(tgt, att, info.element || null);
      else {
        if (tgt.status.sleep && chance(0.5)) yield* this.clearStatus(tgt, 'sleep');
        if (tgt.status.confuse && kind === 'phys' && chance(0.5)) yield* this.clearStatus(tgt, 'confuse');
        if (tgt.status.freeze && info.element === 'fire') yield* this.clearStatus(tgt, 'freeze');
        if (!tgt.isParty && tgt.d.phases) this.phaseQ.add(tgt);
        // E18: 予告を消す属性で打たれた（ダストウィングの羽の光を風で吹き飛ばす 等）
        if (!tgt.isParty && tgt.reserved && tgt.reserved.cancel && info.element && tgt.reserved.cancel.element === info.element) {
          const c = tgt.reserved.cancel;
          tgt.reserved = null;
          yield { t: 'telegraph', u: tgt, text: '', pose: 'idle', tint: '', next: '', cancel: true };
          if (c.msg) yield this.m(c.msg.replace(/\{user\}/g, tgt.name));
        }
        // v2（氷壁の巨人・雪原）: 守りの氷（守りの段が上がっている間）をその属性で割る → 守りの段が to（既定 −2）に落ちる
        const mt = !tgt.isParty && tgt.alive && tgt.d.melt;
        if (mt && info.element === mt.element && tgt.buffs.def > 0) {
          const to = mt.to != null ? mt.to : -2, d0 = to - tgt.buffs.def;
          tgt.buffs.def = to;
          if (mt.flag) this.flags[mt.flag] = true;
          yield { t: 'buff', u: tgt, stat: 'def', d: d0, stage: to };
          if (mt.msg) yield this.m(mt.msg.replace(/\{user\}/g, tgt.name));
          if (mt.clear) yield* this.clearStatus(tgt, mt.clear, true);
          for (const k of mt.reset || []) if (tgt.buffs[k] > 0) { const dk = -tgt.buffs[k]; tgt.buffs[k] = 0; yield { t: 'buff', u: tgt, stat: k, d: dk, stage: 0 }; }
        }
      }
      if (info.drain && att.alive && dealt > 0) yield* this.restore(att, Math.round(dealt * info.drain), 'hp', 'drain');
      return true;
    }

    *die(u, killer, element) {
      u.hp = 0;
      u.status = {};
      u.turns = {};
      u.buffs = { atk: 0, def: 0, mag: 0, mdef: 0, agi: 0 };
      u.defending = false;
      if (!u.isParty) u.reserved = null;
      yield { t: 'die', u, killer };
      yield this.m(`${u.name}は倒れた！`);
      if (u.isParty) {
        this.stats.deaths++;
        const x = u.mods.autoRevive;
        if (x > 0 && !u.revived) {
          u.revived = true;
          u.hp = Math.max(1, Math.floor(u.mhp * Math.min(1, x)));
          yield { t: 'react', u, kind: 'revive' };
          yield { t: 'revive', u };
          yield this.m(`${u.name}は立ち上がった！`);
        }
        return;
      }
      if (!this.killed.includes(u)) this.killed.push(u);
      // v2（根食らい）: その属性で倒されたら戦闘の旗を立てる（行動の cond の noFlag が読む）
      const ob = u.d.onBurn || u.d.onKilledBy;
      if (ob && element && ob.element === element && ob.flag && !this.flags[ob.flag]) {
        this.flags[ob.flag] = true;
        if (ob.msg) yield this.m(ob.msg.replace(/\{user\}/g, u.name));
      }
      // v2（砂漠）: 倒れたときの特別な効果（d.onDeath = BC.specials の名前。鷹団の弓兵・砂の王の玉）
      if (u.d.onDeath && BC.specials && BC.specials[u.d.onDeath]) yield* BC.specials[u.d.onDeath](this, u, killer, { type: 'special', id: u.d.onDeath }, { death: true, element });
      // v2（狼の群れ頭）: 頭が倒れると群れが逃げる
      if (u.d.leader) {
        const rest = this.mons.filter((m) => m.alive && m !== u && (!m.boss || m.d.bossType === 'add'));
        if (rest.length) {
          yield this.m(u.d.leader.msg || '残った群れは、散り散りに逃げていった！');
          for (const m of rest) { m.gone = true; yield { t: 'flee', u: m }; }
        }
      }
    }

    *restore(t, n, kind, how) {
      n = Math.max(0, Math.round(n));
      const cur = kind === 'mp' ? t.mp : t.hp;
      const max = kind === 'mp' ? t.mmp : t.mhp;
      const got = Math.max(0, Math.min(max - cur, n));
      if (kind === 'mp') t.mp += got; else t.hp += got;
      if (got <= 0 && (how === 'drain' || how === 'regen' || how === 'quiet' || how === 'multi')) return 0;
      yield { t: 'heal', u: t, n: got, mp: kind === 'mp' };
      if (how === 'quiet') return got;
      const L = kind === 'mp' ? 'MP' : 'HP';
      if (got > 0) yield this.m(`${t.name}の${L}が${got}回復した！`);
      else yield this.m('しかし効き目がなかった。');
      return got;
    }

    // ------------------------------------------------------- 状態（§4.8.3、STATS_REWORK §2.2 の SF）
    /** SF: 味方 = clamp(abilMul(S, 0.04), 0.6, 1.8)（S = 術・術扱いの技は知力、技は器用さ）、魔物 1 */
    sf(u, stat) {
      if (!u.isParty || !stat) return 1;
      const S = K('SF');
      return clamp(abilMul(u.stat(stat), K('ABIL').sf || 0.04), S.min, S.max);
    }
    sfStat(ctx) {
      if (!ctx || ctx.item) return null;
      if (ctx.kind === 'spell') return 'int';
      if (ctx.kind === 'tech') return ctx.act && (ctx.act.magic || (ctx.act.effects || []).some((e) => e.formula === 'magic')) ? 'int' : 'dex';
      return null;
    }
    rollTurns(def, t) {
      const tr = (t.boss || t.rare) && def.bossTurns ? def.bossTurns : def.turns;
      if (Array.isArray(tr)) return ri(tr[0], tr[1]);
      return tr === 'next' ? 'next' : null;
    }
    *inflict(u, t, s, ch, o) {
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
      const p = clamp((ch != null ? ch : 1) * this.sf(u, o.sf) * (1 - res), 0, K('STATUS').pCap);
      if (s === 'death') {
        if (t.boss || t.rare || t.metal || res >= 1 || !chance(p)) { const f = fail(); if (f) yield f; return false; }
        yield { t: 'status', u: t, s: 'death', on: true };
        yield* this.die(t, u);
        return true;
      }
      if (t.status[s] || res >= 1 || !chance(p)) { const f = fail(); if (f) yield f; return false; }
      if (isDisabling(s)) for (const xs of DISABLE) if (xs !== s && t.status[xs]) yield* this.clearStatus(t, xs, true);
      if (s === 'burn' && t.status.freeze) yield* this.clearStatus(t, 'freeze', true);
      if (s === 'freeze' && t.status.burn) yield* this.clearStatus(t, 'burn', true);
      t.status[s] = true;
      const n = this.rollTurns(def, t);
      if (n == null) delete t.turns[s]; else t.turns[s] = n;
      yield { t: 'status', u: t, s, on: true };
      if (def.on) yield this.m(fmtName(def.on, t.name));
      if (!t.isParty && t.reserved && isDisabling(s)) {
        // 動けなくなった魔物の予告は消える（眠らせる・しびれさせるも答えの 1 つ）
        t.reserved = null;
        yield { t: 'telegraph', u: t, text: '', pose: 'idle', tint: '', next: '', cancel: true };
      }
      return true;
    }

    // ------------------------------------------------------- 技・術・道具・魔物の行動
    announce(u, a, item) {
      if (item) return `${u.name}は${item.name}を使った！`;
      if (a.msg) return a.msg.replace(/\{user\}/g, u.name).replace(/\{name\}/g, a.name);
      return a.kind === 'spell' ? `${u.name}は${a.name}を唱えた！` : `${u.name}の${a.name}！`;
    }
    /** 行動: 払う（MP・道具）→ 知らせる → 効果を相手ごとに順に。o: {item, free, glimmed} → {done, landed, target, targets, killed} */
    *useAction(u, id, a, chosen, o) {
      o = o || {};
      const item = o.item || null;
      const kind = item ? 'item' : a.kind || (u.isParty ? 'tech' : 'enemy');
      const res = { done: false, landed: false, target: null, targets: [], killed: false };
      const refuse = function* (eng, text) { yield eng.m(eng.announce(u, a, null)); yield eng.m(text); };
      if (!item && !o.free) {
        if (u.isParty && kind === 'tech') {
          if (u.wtype !== a.wtype) { yield* refuse(this, 'しかしこの技を使う武器を持っていない！'); return res; }
          if (a.magic && u.status.silence) { yield* refuse(this, 'しかし術を封じられている！'); return res; }
          if (!a.reach && this.effRow(u) === 'back') { yield* refuse(this, 'しかし後列からは届かない！'); return res; }
          const cost = this.mpCost(u, id);
          if (u.mp < cost) { yield* refuse(this, 'しかしMPが足りない！'); return res; }
          u.mp -= cost; this.stats.mpUsed += cost;
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
      const cmdName = item ? 'item' : kind === 'spell' ? 'spell' : kind === 'tech' ? 'skill' : 'enemy';
      yield this.m(this.announce(u, a, item));
      // E18: 予告の行動（効果なし）は構えと端の文を出して、次の手番の行動を予約する
      if (a.telegraph && !u.isParty) {
        const T = a.telegraph;
        yield { t: 'fx', fx: a.fx || 'tele', user: u, targets: [], kind: 'ability', cmd: cmdName, id, name: a.name, telegraphing: true };
        yield { t: 'telegraph', u, text: T.text || '', pose: T.pose || 'tele', tint: T.tint || '', next: T.next || '' };
        if (T.next && u.alive) u.reserved = { id: T.next, cancel: T.cancel || null, from: id, round: this.round };
        if (!(a.effects && a.effects.length)) return res;
      }
      const effects = a.effects || [];
      const hpCost = effects.reduce((mx, e) => Math.max(mx, e.hpCost || 0), 0);
      if (hpCost > 0) {
        const pay = Math.min(u.hp - 1, Math.floor(u.mhp * hpCost));
        if (pay > 0) { u.hp -= pay; yield { t: 'dmg', u, n: pay, kind: 'cost' }; }
      }
      const ctx = { act: a, item, id, kind, W: u.isParty && kind === 'tech' ? u.weapon() : null, fx: a.fx || null, onHit: new Set(), glimmed: !!o.glimmed, sf: null, cmd: cmdName };
      ctx.sf = this.sfStat(ctx);
      const main = effects.filter((e) => !e.on);
      const onFx = effects.filter((e) => e.on);
      const said = this.said;
      const actName = item ? item.name : a.name;
      if (a.target === 'random') {
        const n = this.hitCount(main.find((e) => e.type === 'damage'));
        ctx.once = true; ctx.multi = true;
        for (let i = 0; i < n; i++) {
          const foes = this.foes(u);
          if (!foes.length || !u.alive) break;
          const t = pick(foes);
          res.targets.push(t);
          yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab: a, kind: 'ability', cmd: cmdName, id, name: actName, again: i > 0 };
          yield* this.applyEffects(u, t, main, ctx, res);
        }
      } else {
        let targets = this.targets(u, a, chosen);
        if (!targets.length && !onFx.length) { yield this.m('しかし効き目がなかった。'); return res; }
        if (targets.length === 1 && !u.isParty && isPhysSingle(a)) {
          const g = yield* this.guard(u, targets[0]);
          if (g.parried) { res.target = g.t; return res; }
          targets = [g.t];
          ctx.coverMul = g.mul;
        }
        res.targets = targets;
        res.target = targets[0] || null;
        ctx.multi = targets.length > 1;
        if (targets.length) yield { t: 'fx', fx: ctx.fx, user: u, targets, ab: a, kind: 'ability', cmd: cmdName, id, name: actName };
        else if (a.target === 'front' && !u.isParty) yield this.m('しかし前列には誰もいなかった！');
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
    *applyEffects(u, t, effects, ctx, res) {
      let gate = false, hit = false;   // hit: ダメージの後の状態・弱体は外れても黙る（「〜のダメージ！しかし効き目がなかった。」にしない）
      for (const eff of effects) {
        if (this.result === 'escape') return;
        if (!t.alive && eff.type !== 'revive') break;
        if (gate && (GATED[eff.type] || (eff.type === 'buff' && (eff.stages || 1) < 0))) continue;
        if (eff.type === 'damage') {
          const r = yield* this.damageEffect(u, t, eff, ctx);
          if (r.landed) res.landed = true;
          if (ctx.kind === 'tech' ? !r.landed : r.phys && r.tried && !r.landed && r.missed) gate = true;
          hit = true;
        } else yield* this.effect(u, t, eff, hit && !ctx.quietExtra ? Object.assign({}, ctx, { quietExtra: true }) : ctx);
      }
    }
    *damageEffect(u, t, eff, ctx) {
      const f = eff.formula || (ctx.kind === 'spell' ? 'magic' : 'phys');
      const n = ctx.once ? 1 : this.hitCount(eff);
      let landed = false, tried = false, missed = true;
      const drain = Math.max(eff.drain || 0, ctx.W && f === 'phys' ? weaponItem(ctx.W).drain || 0 : 0);
      for (let i = 0; i < n; i++) {
        if (!t.alive || !u.alive) break;
        if (i > 0) yield { t: 'fx', fx: ctx.fx, user: u, targets: [t], ab: ctx.act, kind: 'ability', again: true, cmd: ctx.cmd, id: ctx.id, name: ctx.act && ctx.act.name };
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
          const n = R.Mon.healAmount(u, t, eff, { item: !!ctx.item, action: u.isParty && !ctx.item && (ctx.kind === 'tech' || ctx.kind === 'spell') ? ctx.act : null, slot: 'weapon1' });
          return yield* this.restore(t, n, 'hp', ctx.multi ? 'multi' : undefined);
        }
        case 'healMp': {
          if (!t.alive) return;
          const n = eff.pct != null ? Math.max(1, Math.ceil(t.mmp * eff.pct)) : eff.power || 0;
          return yield* this.restore(t, n, 'mp', ctx.multi ? 'multi' : undefined);
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
          const data = eff.status === 'counter' ? { power: eff.power != null ? eff.power : 1, parry: eff.parry || 0, critBonus: eff.critBonus || 0 } : undefined;
          return yield* this.inflict(u, t, eff.status, eff.chance, { sf: ctx.sf, multi: ctx.multi, data, quiet: !!ctx.quietExtra });
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
        case 'teleport': case 'exit': case 'repel': case 'encounter':
          yield this.m('ここでは使えない。');
          return;
        case 'special': {
          const fn = BC.specials && BC.specials[eff.id];
          if (fn) yield* fn(this, u, t, eff, ctx);
          return;
        }
      }
    }

    *buff(u, t, eff, ctx) {
      if (!t.alive || !BUFF_STATS.includes(eff.stat)) return;
      const st = eff.stages || 1;
      const name = NAMES.buff[eff.stat];
      const quiet = !!(ctx && ctx.quietExtra);
      const fail = () => (quiet ? { t: 'noop' } : this.m(ctx && ctx.multi ? `${t.name}には効き目がなかった。` : 'しかし効き目がなかった。'));
      if (st < 0 && u.side !== t.side) {
        if (t.metal || t.status.veil) { yield fail(); return; }
        const KS = K('STATUS');
        let p = eff.chance == null ? 1 : eff.chance * this.sf(u, ctx ? ctx.sf || (ctx.kind === 'spell' ? 'int' : null) : null);
        if (t.boss || t.rare) p *= KS.bossDebuff;
        if (eff.chance != null || t.boss || t.rare) p = Math.min(KS.pCap, p);
        if (!chance(p)) { yield fail(); return; }
      }
      const cur = t.buffs[eff.stat], nv = clamp(cur + st, -2, 2), d = nv - cur;
      if (!d) { yield this.m(`しかし${t.name}の${name}はもう${st > 0 ? '上がらない' : '下がらない'}！`); return; }
      t.buffs[eff.stat] = nv;
      yield { t: 'buff', u: t, stat: eff.stat, d, stage: nv };
      yield this.m(`${t.name}の${name}が${d > 0 ? '上がった' : '下がった'}！`);
    }
    *dispel(u, t, eff, ctx) {
      if (!t.alive) return;
      const side = eff.side || (t.side === u.side ? 'bad' : 'good');
      let changed = false;
      for (const k of BUFF_STATS) {
        if ((side === 'good' && t.buffs[k] > 0) || (side === 'bad' && t.buffs[k] < 0)) { t.buffs[k] = 0; changed = true; yield { t: 'buff', u: t, stat: k, d: 0, stage: 0, dispel: side }; }
      }
      if (side === 'good') for (const s of GOOD) if (t.status[s]) { yield* this.clearStatus(t, s, true); changed = true; }
      if (!changed) { if (!(ctx && ctx.multi)) yield this.m('しかし効き目がなかった。'); return; }
      yield this.m(side === 'good' ? `${t.name}の強化の効果が消えた！` : `${t.name}の弱体の効果が消えた！`);
    }

    // ------------------------------------------------------- 盗む（§4.10.1、STATS_REWORK §7.3）
    /** clamp(0.35 + (速さ spd − 魔物の agi)/200, 0.1, 0.8) × (1 + stealPct/100)（ボス ×0.5） */
    stealChance(u, t) {
      const S = K('STEAL');
      let p = clamp(S.base + (u.stat('spd') - t.stat('agi')) / S.agiDiv, S.min, S.max);
      p *= 1 + this.pct(u, 'stealPct') / 100;
      if (t.boss) p *= S.boss;
      return Math.min(1, p);
    }
    /** 盗み専用の枠が残っているか（通常・レア魔物は何か盗んだら終わり、ボスは取れるまで何度でも。召喚された魔物には無い） */
    stealOnlyOpen(t) {
      const s = t.d && t.d.drops && t.d.drops.steal;
      if (!s || !s.item || t.summoned || t.stolenSt) return false;
      return t.boss ? true : !t.stolen;
    }
    /** 盗み専用の当たりの率: min(cap, (1/rate) × (1 + stealPct/100)) × (ついでに 0.5) × (金色 2) */
    stealOnlyChance(u, t, auto) {
      const s = t.d.drops.steal;
      const O = K('STEAL').only || { cap: 0.5, autoMul: 0.5, golden: 2 };
      let p = (1 / Math.max(1, s.rate || 32)) * (1 + this.pct(u, 'stealPct') / 100);
      if (auto) p *= O.autoMul;
      if (t.golden) p *= O.golden;
      return Math.min(O.cap, p);
    }
    stealPick(t, rareMul) {
      const dr = t.d && t.d.drops;
      if (!dr) return null;
      const ch = R.Mon.dropChances(t.d, { golden: t.golden, mods: this.partyMods() });
      const S = K('STEAL');
      if (dr.rare && dr.rare.item && chance(Math.min(S.rareCap, (ch.rare || 0) * S.rareMul) * (rareMul || 1))) return { item: dr.rare.item, n: 1, grade: 'rare' };
      if (dr.normal) {
        if (dr.normal.item) return { item: dr.normal.item, n: 1, grade: 'normal' };
        if (dr.normal.pool) { const p = R.Mon.pickPool(dr.normal.pool, this.tier); if (p && p.item) return { item: p.item, n: p.n || 1, grade: 'normal' }; }
      }
      return null;
    }
    /** 通常・レアの枠がある（盗み専用は stealOnlyOpen） */
    stealable(t) {
      if (t.stolen) return false;
      const dr = t.d && t.d.drops;
      return !!(dr && ((dr.normal && (dr.normal.item || dr.normal.pool)) || (dr.rare && dr.rare.item)));
    }
    canSteal(t) { return this.stealOnlyOpen(t) || this.stealable(t); }
    *takeStolen(u, t, pick0, stealOnly) {
      if (stealOnly) { t.stolenSt = true; if (!t.boss) t.stolen = true; } else t.stolen = true;
      this.giveItem(pick0.item, pick0.n || 1);
      this.stolen.push({ mon: t.id, item: pick0.item, grade: pick0.grade, char: u.c.id, stealOnly: !!stealOnly });
      const it = DB.items[pick0.item] || {};
      yield { t: 'gain', item: pick0.item, grade: pick0.grade, stolen: true, stealOnly: !!stealOnly, u, target: t, mon: t.id };
      yield this.m(`${u.name}は${pick0.grade !== 'normal' ? '★' : ''}${it.name || pick0.item}を盗んだ！`);
    }
    /** 1 回の成功のあと: 盗み専用を先に判定 → 外れたら旧の stealPick（STATS_REWORK §7.3 の 2〜3） */
    pickOnSuccess(u, t, auto) {
      if (this.stealOnlyOpen(t) && chance(this.stealOnlyChance(u, t, auto))) {
        return { pick: { item: t.d.drops.steal.item, n: 1, grade: 'super' }, only: true };
      }
      if (!this.stealable(t)) return null;
      const p = this.stealPick(t, auto ? K('STEAL').autoRare : 1);
      return p ? { pick: p, only: false } : null;
    }
    *steal(u, t) {
      if (!u.isParty) {
        const g = Math.min(Math.max(0, this.gold0 - this.goldLost), (u.level || 1) * 5);
        if (!g) { yield this.m('しかし何も盗めなかった。'); return; }
        this.goldLost += g;
        yield this.m(`{hero}たちは${g}ゴールドを盗まれた！`);
        return;
      }
      if (t.isParty) return;
      const fail = function* (eng) { yield { t: 'steal', u, target: t, item: null }; yield eng.m('しかし何も盗めなかった。'); };
      if (!this.canSteal(t) || !chance(this.stealChance(u, t))) { yield* fail(this); return; }
      const r = this.pickOnSuccess(u, t, false);
      if (!r || !this.canCarry(r.pick.item, r.pick.n)) { yield* fail(this); return; }
      yield* this.takeStolen(u, t, r.pick, r.only);
    }
    /** ついでに盗む（autoSteal）: 当たった攻撃で 盗みの率 × autoSteal/100、レア枠と盗み専用は率が半分。何も取れなければ黙る */
    *autoSteal(u, t) {
      if (!this.canSteal(t)) return;
      if (!chance(this.stealChance(u, t) * Math.min(100, u.mods.autoSteal) / 100)) return;
      const r = this.pickOnSuccess(u, t, true);
      if (!r || !this.canCarry(r.pick.item, r.pick.n)) return;
      yield* this.takeStolen(u, t, r.pick, r.only);
    }
    /** 調べる（Lv は出さない。STATS_REWORK §9.4） */
    *scan(t) {
      yield this.m(`${t.name}　HP${t.hp}/${t.mhp}`);
      if (t.isParty) return;
      const el = t.d.elem || {};
      const order = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
      const keys = order.filter((e) => el[e] != null).concat(Object.keys(el).filter((e) => !order.includes(e)));
      const weak = keys.filter((e) => el[e] >= 1.5).map(elemName);
      const absorb = keys.filter((e) => el[e] < 0).map(elemName);
      yield this.m(weak.length ? `弱点：${weak.join('・')}` : '弱点は見つからない。');
      if (absorb.length) yield this.m(`吸収：${absorb.join('・')}`);
    }
    *summon(u, eff) {
      const max = Math.min(8, eff.max != null ? eff.max : 8);
      const n = Math.max(1, eff.n || 1);
      const id = R.Mon.resolve(eff.mon || 'same', this.tier, u.id);
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
      yield { t: 'summon', units: added.map((m) => m.idx), by: u };
      for (const m of added) yield this.m(`${m.name}が現れた！`);
    }

    // ------------------------------------------------------- リピート（§11.5.3a、A6）
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
      const attack = () => {
        if (!this.canReach(u)) return { type: 'defend' };
        const old = foeOf(p && p.target);
        if (old && old.alive) { planAdd(old, this.expectAttack(u, old)); return { type: 'attack', target: old }; }
        // 倒れていたら同じ列（種）の次（A6）
        let t = old ? this.pickFoe(u, old) : null;
        if (!t && plan && R.BattleAI && R.BattleAI.focusOrder) t = R.BattleAI.focusOrder(this, plan)[0] || null;
        if (!t) t = this.pickFoe(u, null);
        if (t) planAdd(t, this.expectAttack(u, t));
        return { type: 'attack', target: t };
      };
      if (!p) return attack();
      if (p.type === 'attack') return attack();
      if (p.type === 'defend') return { type: 'defend' };
      let act, type = p.type;
      if (type === 'ability' || type === 'skill') { const a = ACT(p.id); type = a && a.kind === 'spell' ? 'spell' : 'tech'; }
      if (type === 'tech' || type === 'spell') {
        act = ACT(p.id);
        if (!act) return attack();
        if (this.unusable(u, p.id)) return attack();
      } else if (type === 'item') {
        const it = DB.items[p.id];
        if (!it || !it.use || !it.use.battle || this.count(p.id) - (reserved[p.id] || 0) <= 0) return attack();
        if (this.noEscape && isEscape(it.use)) return attack();
        act = it.use;
      } else return attack();
      let t = this.repeatTarget(u, act, p.target);
      if (t === false) return attack();
      if (act.target === 'enemy' && t && t.alive) planAdd(t, this.expectDamage(u, act, t, { item: type === 'item' }));
      if (type === 'item') reserved[p.id] = (reserved[p.id] || 0) + 1;
      return { type, id: p.id, target: t };
    }
    repeatTarget(u, act, t) {
      const friends = this.friends(u);
      const side = (u.isParty ? this.party : this.mons).filter((x) => !x.gone);
      switch (act.target) {
        case 'enemy': case 'group': return this.pickFoe(u, t && t.side !== u.side && !t.gone ? t : null) || false;
        case 'ally': case 'ally_other': {
          const ok = (x) => x && x.alive && !x.gone && x.side === u.side && (act.target !== 'ally_other' || x !== u);
          if ((act.effects || []).some((e) => e.type === 'heal')) return friends.filter(ok).sort((a, b) => a.hpRate() - b.hpRate())[0] || false;
          if (ok(t)) return t;
          return friends.filter(ok).sort((a, b) => a.hpRate() - b.hpRate())[0] || false;
        }
        case 'ally_dead': {
          if (t && !t.alive && !t.gone && t.side === u.side) return t;
          return side.find((x) => !x.alive) || false;
        }
        case 'ally_any': return t && !t.gone && t.side === u.side ? t : u;
        default: return t || null;
      }
    }

    // ------------------------------------------------------- AI の見込み
    expectDamage(u, act, t, o) {
      o = o || {};
      const kind = o.item ? 'item' : act.kind || (u.isParty ? 'tech' : 'enemy');
      const ctx = { expect: true, act, kind, item: o.item ? {} : null, W: u.isParty && kind === 'tech' ? u.weapon() : null };
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
    expectAttack(u, t) {
      if (!t) return 0;
      if (u.isParty && !this.canReach(u)) return 0;
      const r = this.roll(u, t, { formula: 'phys', power: 1 }, { expect: true, attack: true });
      return r.zero ? 0 : Math.max(0, r.dmg);
    }
    expectHeal(u, act, t, item) {
      let n = 0;
      for (const eff of act.effects || []) {
        if (eff.type !== 'heal') continue;
        n += R.Mon.healAmount(u, t, eff, { item: !!item, action: u.isParty && !item && (act.kind === 'tech' || act.kind === 'spell') ? act : null });
      }
      return n;
    }

    // ------------------------------------------------------- 報酬（§3.3.8・§4.10。経験値は無い）
    /** お金とドロップを振る（1 回だけ。R.Game には書かない） */
    computeRewards() {
      if (this.rewardInfo) return this.rewardInfo;
      this.use();
      let gold = 0;
      for (const m of this.killed) gold += m.d.gold || 0;
      gold = Math.round(gold * (1 + this.partyMod('goldPct') / 100));
      const mods = this.partyMods();
      const drops = [];
      for (const m of this.killed) {
        if (m.summoned) continue;
        const list = R.Mon.rollDrops(m.d, { golden: m.golden, mods, tier: this.tier });
        for (const x of list) drops.push(Object.assign({ mon: m.id, name: m.base }, x));
      }
      const rank = { normal: 0, rare: 1, super: 2 };
      drops.sort((a, b) => (rank[a.grade] || 0) - (rank[b.grade] || 0));
      const got = [];
      for (const d of drops) {
        if (d.gold) { gold += d.gold; continue; }
        const it = DB.items[d.item];
        if (!it) { R.warn('battle: unknown drop item', d.item); continue; }
        const shown = it.grade === 'super' || d.grade === 'super' ? 'super' : it.grade === 'rare' || d.grade === 'rare' ? 'rare' : 'normal';
        const ok = this.giveItem(d.item, d.n || 1);
        got.push({ item: d.item, grade: shown, slot: d.grade, n: d.n || 1, mon: d.mon, name: d.name, kept: ok });
      }
      this.rewardInfo = { gold, drops: got };
      return this.rewardInfo;
    }
    /** 勝ったときの出来事（ドロップの gain）。旧の文の順（§3.3.8）は BSCENE の勝利の画面が持つ */
    *rewards() {
      const rw = this.computeRewards();
      if (!this.killed.length) { yield this.m('魔物たちはいなくなった。'); return; }
      yield { t: 'victory' };
      for (const d of rw.drops) yield { t: 'drop', mon: d.mon, name: d.name, item: d.item, grade: d.grade, slot: d.slot, n: d.n, kept: d.kept };
    }
    /** 伸び（R.Growth.afterBattle）に渡す敵の強さ（STATS_REWORK §9.3: E = Lb + 補正の最大） */
    growthInfo() {
      const A = K('GROW').add || { boss: 4, rare: 2, golden: 1, metal: 6 };
      let add = 0;
      for (const m of this.killed.concat(this.mons.filter((x) => x.gone))) {
        if (m.boss) add = Math.max(add, A.boss);
        if (m.rare) add = Math.max(add, A.rare);
        if (m.golden) add = Math.max(add, A.golden);
        if (m.metal) add = Math.max(add, A.metal);
      }
      return { E: this.lv + add, Lb: this.lv, add, boss: this.boss, rare: this.rare, golden: this.golden, metal: this.metal, tier: this.tier,
        fallen: this.party.filter((p) => !p.alive).map((p) => p.c.id), members: this.party.map((p) => p.c.id),
        killed: this.killed.map((m) => ({ id: m.id, boss: m.boss, rare: m.rare, golden: m.golden, metal: m.metal })), rng: this.rng };
    }
    /** 戦闘の後の回復（§4.12.1）: 勝ち → 生きている人の HP 全快・MP + 12%、逃げた → HP 全快。状態は消える */
    recover(result) {
      const A = K('AFTER');
      for (const p of this.party) {
        const c = p.c;
        c.status = {};
        if ((result === 'win' || result === 'escape') && c.hp > 0) {
          c.hp = p.mhp;
          if (result === 'win') c.mp = Math.min(p.mmp, c.mp + Math.ceil(p.mmp * A.mpPct));
        }
        c.hp = clamp(c.hp, 0, p.mhp); c.mp = clamp(c.mp, 0, p.mmp);
      }
    }
  }

  // ---------------------------------------------------------------- 準備（setup → 魔物の並び）
  /**
   * setup（K.setup）の魔物を決める: troop / zone / mons。R.Mon.encounter が決めた物（mons と lv と golden の番号）はそのまま。
   * → {kind, Tb, Lb, mons:[{id, golden}], rare, golden} | null
   */
  function resolveMonsters(o, mods) {
    o = o || {};
    const troop = o.troop && DB.troops[o.troop];
    const zone = o.zone && DB.encounters[o.zone];
    const cur = o.tier != null ? o.tier : tierNow();
    let kind, Tb, Lb = null, spec = null, rare = !!o.rare;
    if (o.mons) {
      kind = zone ? 'zone' : 'mons';
      Tb = cur;
      spec = o.mons;
      Lb = o.lv != null ? o.lv : LZ(Tb) + (o.lvOff || 0);
    } else if (troop) {
      kind = 'troop';
      Tb = troop.tier != null ? troop.tier : cur;
      spec = troop.mons;
      if (o.lv != null) Lb = o.lv;
      else if (troop.lv != null && troop.scale !== 'tier') Lb = troop.lv;
      else Lb = LZ(Tb) + (o.lvOff != null ? o.lvOff : troop.lvOff || 0);
    } else if (zone) {
      // 出現表だけ（sim・デバッグ）: R.Mon.encounter と同じ組の選び方
      kind = 'zone';
      Tb = typeof zone.tier === 'number' ? zone.tier : cur;
      const lb = R.Mon.zoneLb(zone, Tb);
      Lb = o.lv != null ? o.lv : lb.lo === lb.hi ? lb.lo : ri(lb.lo, lb.hi);
      const rr = !o.noRare && DB.rareEncounters && DB.rareEncounters[o.zone];
      const row = Array.isArray(rr) ? rr[0] : rr;
      if (row && DB.monsters[row.mon] && (o.rare === 'force' || (o.rare !== false && chance((1 / Math.max(1, row.rate || K('RARE_ENC'))) * (1 + Math.min(150, (mods && mods.rareEncPct) || 0) / 100))))) {
        rare = true; spec = [[row.mon, 1]]; Lb += K('RARE_MON').lvOff;
      }
      if (!spec) { const g = R.Mon.zoneGroup(o.zone, Tb); spec = g ? g.mons : null; }
    } else return null;
    const ids = R.Mon.buildList(spec || [], Tb, { keepOrder: kind !== 'zone' || !!o.mons });
    if (!ids.length) return null;
    let gi = -1;
    if (typeof o.golden === 'number') gi = o.golden < ids.length ? o.golden : -1;
    else if (kind === 'zone' && !rare && !o.noGolden && o.golden !== false) {
      gi = o.golden === 'force' ? ids.findIndex((id) => R.Mon.canBeGolden(DB.monsters[id])) : R.Mon.rollGolden(ids, mods || {});
    }
    return { kind, Tb, Lb, mons: ids.map((id, i) => ({ id, golden: i === gi })), rare, golden: gi >= 0 };
  }
  function safe(fn, dflt) { try { const v = fn(); return v == null ? dflt : v; } catch (e) { return dflt; } }
  function charsMods(chars) {
    const out = {};
    for (const c of chars || []) {
      if (!c || !(c.hp > 0)) continue;
      let m = null;
      try { const st = R.Rules && R.Rules.stats ? R.Rules.stats(c) : null; m = st && st.mods; } catch (e) { m = null; }
      if (!m) continue;
      for (const k in PARTY_KEYS) out[k] = (out[k] || 0) + (m[k] || 0);
      out.preemptPct = (out.preemptPct || 0) + (m.preemptPct || 0);
    }
    for (const k in PARTY_KEYS) out[k] = Math.min(150, out[k] || 0);
    return out;
  }
  function drain(gen, sink) { for (const ev of gen) if (sink) sink(ev); }

  // ---------------------------------------------------------------- 契約の出来事へ（V2_PLAN §2.5.13、R.Contract.BATTLE_EVENTS）
  const uidOf = (u) => (u ? u.uid : null);
  const CMD_OF_KIND = { attack: 'attack', counter: 'attack', defend: 'defend' };
  /** 中の出来事 1 つ → 契約の出来事の列（0 個以上）。heroName は '{hero}' の置き換え */
  function toEvents(ev, heroName, out, eng) {
    switch (ev.t) {
      case 'msg': out.push({ t: 'msg', text: String(ev.text).replace(/\{hero\}/g, heroName) }); break;
      case 'actor': if (ev.u) out.push({ t: 'turn', uid: ev.u.uid }); break;
      case 'fx':
        if (ev.again) break;
        out.push({ t: 'act', uid: uidOf(ev.user), cmd: ev.cmd || CMD_OF_KIND[ev.kind] || 'enemy', id: ev.id || (ev.ab && ev.ab.id) || 'attack', name: ev.name || (ev.ab && ev.ab.name) || '', targets: (ev.targets || []).map(uidOf), fx: ev.fx || null, counter: ev.kind === 'counter' || undefined, telegraphing: ev.telegraphing || undefined });
        break;
      case 'dmg': {
        const e = { t: 'dmg', uid: uidOf(ev.u), n: ev.n, crit: !!ev.crit, weak: !!ev.weak, kind: ev.mp ? 'mp' : ev.el && ev.kind !== 'cost' ? ev.el : ev.kind || 'phys' };   // 属性があれば kind は属性（BSCENE の依頼 28）
        if (ev.mp) e.mp = true;
        if (ev.el) e.el = ev.el;
        out.push(e);
        break;
      }
      case 'heal': out.push({ t: 'heal', uid: uidOf(ev.u), n: ev.n, mp: !!ev.mp }); break;
      case 'miss': out.push(ev.parry ? { t: 'miss', uid: uidOf(ev.u), parry: true } : { t: 'miss', uid: uidOf(ev.u) }); break;
      case 'die': out.push({ t: 'ko', uid: uidOf(ev.u) }); break;
      case 'revive': out.push({ t: 'revive', uid: uidOf(ev.u) }); break;
      case 'status': out.push({ t: 'status', uid: uidOf(ev.u), id: ev.s, on: !!ev.on }); break;
      case 'buff': out.push({ t: 'status', uid: uidOf(ev.u), id: 'buff_' + ev.stat, on: (ev.stage || 0) !== 0, stage: ev.stage || 0 }); break;
      case 'glimmer': out.push({ t: 'glimmer', uid: uidOf(ev.u), kind: ev.kind, id: ev.id, name: ev.name || (ACT(ev.id) || {}).name || ev.id }); break;
      case 'telegraph': out.push({ t: 'telegraph', uid: uidOf(ev.u), text: ev.text || '', pose: ev.pose || 'tele', tint: ev.tint || '', next: ev.next || '' }); break;
      case 'summon': for (const i of ev.units || []) out.push({ t: 'summon', uid: 'e_' + i, mon: eng && eng.mons[i] ? eng.mons[i].id : null, by: uidOf(ev.by) }); break;
      case 'flee': out.push({ t: 'flee', uid: uidOf(ev.u) }); break;
      case 'phase': if (ev.text) out.push({ t: 'msg', text: ev.text, phase: true, uid: uidOf(ev.u) }); break;
      case 'steal': out.push({ t: 'steal', uid: uidOf(ev.u), target: uidOf(ev.target), item: null }); break;
      case 'gain':
        out.push({ t: 'steal', uid: uidOf(ev.u), target: uidOf(ev.target), item: ev.item, grade: ev.grade, stealOnly: !!ev.stealOnly });
        out.push({ t: 'gain', item: ev.item, grade: ev.grade, stolen: true, stealOnly: !!ev.stealOnly });
        break;
      case 'drop': out.push({ t: 'gain', item: ev.item, grade: ev.grade, mon: ev.mon, n: ev.n || 1, kept: ev.kept !== false }); break;
      case 'prof': out.push({ t: 'prof', c: ev.u && ev.u.c ? ev.u.c.id : null, key: ev.id, uid: uidOf(ev.u), kind: ev.kind, rank: ev.rank, from: ev.from }); break;   // uid・rank・from: 戦闘中の「剣+1」（prof_ui.js）
      default: break;   // crit（dmg に入れた）・golden・cover・react・escape・victory
    }
    return out;
  }

  // ---------------------------------------------------------------- 戦闘の 1 回（B）
  const seenKey = (cid, id) => cid + ':' + id;
  /**
   * R.BattleCore.create(setup) → B（OBJ_API.battle）。R.Game の人と袋の「写し」で戦い、B.finish() が 1 回だけ R.Game に書く。
   * 乱数の種: setup.seed、無ければ R.Game.seed ＋ 歩数 ＋ 編成か出現表 ＋ setup.retry（直前の戦闘からのやり直しは retry を 1 つ増やす）
   */
  function create(setup) {
    setup = setup || {};
    const G = R.Game;
    const troop = setup.troop && DB.troops[setup.troop];
    let chars = R.Party && R.Party.members ? R.Party.members() : [];
    if (setup.members && setup.members.length && G) chars = setup.members.map((id) => G.chars[id]).filter(Boolean);
    const reserveChars = (G ? (G.party || []).concat(G.reserve || []) : []).map((id) => G.chars[id]).filter((c) => c && !chars.includes(c));
    const copies = chars.map((c) => clone(c));
    const seed = setup.seed != null ? setup.seed
      : `${(G && G.seed) || 0}:${(G && G.steps) || 0}:${setup.troop || setup.zone || ''}:${setup.retry || 0}`;
    const rng = R.Mon.mkRng(seed);
    R.Mon.setRng(rng);
    const res = resolveMonsters(Object.assign({}, setup, { tier: setup.tier != null ? setup.tier : undefined }), charsMods(chars));
    if (!res) throw new Error('R.BattleCore.create: no monsters for ' + JSON.stringify(setup).slice(0, 120));
    const eng = new Engine({
      party: copies, mons: res.mons, inv: clone((G && G.items) || {}), gold: (G && G.gold) || 0, rng,
      noEscape: !!(setup.noEscape || (troop && troop.noEscape)), canLose: !!(setup.canLose || (troop && troop.canLose)),
      surprise: setup.surprise, noSurprise: res.kind !== 'zone',
      tier: res.Tb, lv: res.Lb, glimmerForce: setup.glimmerForce, zone: setup.zone, troop: setup.troop, rare: res.rare, dark: !!setup.dark,
    });
    const heroName = () => {
      const h = G && G.chars && G.chars[G.hero || 'hero'];
      return (h && h.name) || eng.leaderName();
    };
    // 表の unit（K.unit）: 中の unit を読む窓
    const views = [];
    const viewOf = new Map();
    function view(u) {
      if (viewOf.has(u)) return viewOf.get(u);
      const v = {};
      const P = u.isParty;
      Object.defineProperties(v, {
        uid: { value: u.uid, enumerable: true },
        side: { value: P ? 'party' : 'enemy', enumerable: true },
        id: { value: P ? u.c.id : u.id, enumerable: true },
        name: { get: () => u.name, enumerable: true },
        hp: { get: () => Math.max(0, u.hp), enumerable: true },
        mp: { get: () => Math.max(0, u.mp || 0), enumerable: true },
        maxHp: { get: () => u.mhp, enumerable: true },
        maxMp: { get: () => u.mmp || 0, enumerable: true },
        row: { get: () => (P ? eng.effRow(u) : 'front'), enumerable: true },
        status: { get: () => Object.keys(u.status || {}).filter((s) => u.status[s]).concat(BUFF_STATS.filter((k) => u.buffs[k]).map((k) => 'buff_' + k)), enumerable: true },
        buffs: { get: () => Object.assign({}, u.buffs), enumerable: true },
        sprite: { get: () => (P ? u.c.look : (u.d.sprite || u.id)), enumerable: true },
        size: { get: () => (P ? 'm' : u.d.size || (u.boss ? 'l' : 'm')), enumerable: true },
        alive: { get: () => u.alive, enumerable: true },
        gone: { get: () => !!u.gone, enumerable: true },
        wtype: { get: () => (P ? u.wtype : null), enumerable: true },
        golden: { get: () => !!u.golden, enumerable: true },
        boss: { get: () => !!u.boss && !(u.d && u.d.artKind === 'mon'), enumerable: true },   // 絵のキー（根の子分は hd:mon）
        rare: { get: () => !!u.rare, enumerable: true },
        defending: { get: () => !!u.defending, enumerable: true },
        telegraph: { get: () => (!P && u.reserved ? u.reserved.id : null), enumerable: true },
      });
      if (P) Object.defineProperty(v, 'look', { value: u.c.look, enumerable: true });
      viewOf.set(u, v);
      views.push(v);
      return v;
    }
    for (const u of eng.units()) view(u);
    const byUid = (uid) => eng.units().find((u) => u.uid === uid) || null;

    let begun = false, repeatOn = false, fleeNext = false, finished = null;
    let pending = [];          // この手番の命令（味方の番号ごと、中の形）
    let lastCmds = null;       // 前のラウンドの命令（リピート）
    const newThisBattle = new Set();
    const lastRoundOut = [];

    function collect(gen, out) {
      eng.use();
      for (const ev of gen) {
        if (ev.t === 'glimmer' && ev.u && ev.u.c) newThisBattle.add(seenKey(ev.u.c.id, ev.id));
        if (ev.t === 'summon') for (const i of ev.units || []) view(eng.mons[i]);
        toEvents(ev, heroName(), out, eng);
      }
      return out;
    }
    function isNew(c, id) {
      const k = seenKey(c.id, id);
      if (newThisBattle.has(k)) return true;
      const s = G && G.seenSkill;
      return !!(s && s[k] === false);
    }
    function reasonRow(u, id, a) {
      const why = eng.unusable(u, id);
      return { id, name: a.name, mp: eng.mpCost(u, id), usable: !why, reason: why || null, isNew: isNew(u.c, id), target: a.target || 'enemy' };
    }

    const B = {
      setup, engine: eng,
      get units() { return views; },
      get over() { return eng.result === 'win' || eng.result === 'lose' || eng.result === 'escape' ? eng.result : null; },
      get repeatOn() { return repeatOn; },
      setRepeat(v) { repeatOn = !!v; },
      unit(uid) { const u = byUid(uid); return u ? view(u) : null; },
      /** 最初の出来事（出てきた・先手・闇の強まり）。1 回だけ */
      intro() {
        if (begun) return [];
        begun = true;
        return collect(eng.begin(), []);
      },
      /** 人ごとのコマンド（K.option）。技は今の武器の系統だけ（A29）、届かない物は usable:false reason:'reach' */
      options(uid) {
        const u = byUid(uid);
        if (!u || !u.isParty) return [];
        const out = [];
        const reach = eng.canReach(u);
        const atk = { cmd: 'attack', target: 'enemy', wtype: u.wtype, name: u.wtype === 'fist' ? '素手' : wtypeInfo(u.wtype).name };
        if (!reach) { atk.usable = false; atk.reason = 'reach'; } else atk.usable = true;
        out.push(atk);
        const techs = (u.c.techs || []).map((id) => [id, ACT(id)]).filter(([, a]) => a && a.kind === 'tech' && a.wtype === u.wtype && hasBattleEffect(a));
        if (techs.length) out.push({ cmd: 'skill', target: 'enemy', list: techs.map(([id, a]) => reasonRow(u, id, a)) });
        const spells = u.mods.noSpell ? [] : (u.c.spells || []).map((id) => [id, ACT(id)]).filter(([, a]) => a && a.kind === 'spell' && hasBattleEffect(a));
        if (spells.length) out.push({ cmd: 'spell', target: 'enemy', list: spells.map(([id, a]) => reasonRow(u, id, a)) });
        out.push({ cmd: 'defend', target: 'self' });
        const items = Object.keys(eng.inv).filter((id) => { const it = DB.items[id]; return isUseItem(it) && it.use && it.use.battle && hasBattleEffect(it.use) && eng.count(id) > 0; });
        out.push({ cmd: 'item', target: 'ally', list: items.map((id) => { const it = DB.items[id]; const why = eng.unusable(u, id); return { id, name: it.name, n: eng.count(id), usable: !why, reason: why || null, isNew: false, target: it.use.target || 'ally' }; }) });
        return out;
      },
      /** ラウンドの初めの一行の命令（MODERN_UI §6.17） */
      partyOptions() {
        const o = ['fight'];
        if (lastCmds) o.push('repeat');
        if (!eng.noEscape) o.push('escape');
        return o;
      },
      /** 命令を 1 人分。cmd: 'attack'|'skill'|'spell'|'defend'|'item'、target: 相手の uid（全体・自分は null） */
      submit(uid, c) {
        const u = byUid(uid);
        if (!u || !u.isParty || !c) return false;
        const t = c.target != null ? byUid(c.target) : null;
        const type = c.cmd === 'skill' ? 'tech' : c.cmd;
        if (!['attack', 'tech', 'spell', 'defend', 'item'].includes(type)) return false;
        pending[u.idx] = { type, id: c.id, target: t };
        return true;
      },
      /** リピート: 前のラウンドの全員の行動（相手が倒れていたら同じ列の次）。命令を埋める */
      repeat() {
        if (!lastCmds) return false;
        eng.use();
        pending = eng.repeatCommands(lastCmds);
        return true;
      },
      /** 一行で逃げる。次の round() で判定 */
      escape() { fleeNext = true; },
      round() {
        const out = [];
        if (!begun) { begun = true; collect(eng.begin(), out); }
        if (eng.result) return out;
        let cmds;
        if (fleeNext) { cmds = []; cmds.flee = true; fleeNext = false; }
        else {
          if (repeatOn && lastCmds) {
            eng.use();
            const rep = eng.repeatCommands(lastCmds);
            for (const p of eng.party) if (!pending[p.idx] && rep[p.idx]) pending[p.idx] = rep[p.idx];
          }
          cmds = pending;
        }
        collect(eng.playRound(cmds), out);
        if (!cmds.flee) {
          lastCmds = [];
          for (const p of eng.party) if (cmds[p.idx]) lastCmds[p.idx] = cmds[p.idx];
          lastRoundOut.length = 0;
          for (const p of eng.party) { const x = cmds[p.idx]; if (x) lastRoundOut.push({ uid: p.uid, cmd: x.type === 'tech' ? 'skill' : x.type, id: x.id || null, target: x.target ? x.target.uid : null }); }
        }
        pending = [];
        if (eng.result === 'win') collect(eng.rewards(), out);
        if (eng.result && eng.result !== 'timeout') out.push({ t: 'end', result: eng.result });
        return out;
      },
      /** B.finish の後の出来事（伸び {t:'grow', c, hp, mp}）。勝利の画面が rewards().grow と同じ物を出来事で読むとき */
      afterEvents() { return finished && finished.grow ? finished.grow.map((g) => ({ t: 'grow', c: g.c, hp: g.hp, mp: g.mp })) : []; },
      rewards() {
        const rw = eng.result === 'win' ? eng.computeRewards() : { gold: 0, drops: [] };
        return {
          gold: rw.gold,
          drops: rw.drops.map((d) => ({ item: d.item, grade: d.grade, n: d.n, mon: d.mon, kept: d.kept })),
          grow: finished && finished.grow ? finished.grow : [],
          prof: eng.profUps.map((p) => ({ c: p.char, key: p.id, kind: p.kind, rank: p.rank, from: p.from })),
          glimmers: eng.glimmers.map((g) => ({ c: g.char, kind: g.kind, id: g.id })),
          stolen: eng.stolen.map((s) => ({ c: s.char, item: s.item, grade: s.grade, stealOnly: s.stealOnly, mon: s.mon })),
          goldLost: eng.goldLost,
        };
      },
      /**
       * R.Game に 1 回だけ写す（V2_PLAN §2.11「戦闘の結果を書く所」）: HP/MP（勝ち・逃げの回復込み）・熟練・閃いた技と術（NEW）・
       * 使った道具・盗んだ品とドロップ（R.State.gain）・お金・図鑑・伸び（R.Growth.afterBattle）。→ rewards（勝ち以外は null）
       */
      finish() {
        if (finished) return finished.r;
        const result = eng.result;
        eng.recover(result);
        if (result === 'win') eng.computeRewards();
        finished = { r: null, grow: [] };
        if (!G) { finished.r = result === 'win' ? B.rewards() : null; return finished.r; }
        // 人: 写しから戻す
        copies.forEach((cp, i) => {
          const c = chars[i];
          c.hp = cp.hp; c.mp = cp.mp;
          c.status = [];
          if (cp.wprof) c.wprof = cp.wprof;
          if (cp.eprof) c.eprof = cp.eprof;
          for (const k of ['techs', 'spells']) if (Array.isArray(cp[k])) c[k] = cp[k].slice();
        });
        // 熟練度の「▲」（強さの画面。R.Battle.profUI.note）: 見るまで上がる前の段階を覚える
        try { if (R.Battle && R.Battle.profUI && R.Battle.profUI.note) R.Battle.profUI.note(G, eng.profUps); } catch (e) { R.warn('battle: profUI.note failed', e && e.message); }
        G.seenSkill = G.seenSkill || {};
        for (const g of eng.glimmers) {
          G.seenSkill[seenKey(g.char, g.id)] = false;
          R.emit('glimmer', { c: g.char, id: g.id, kind: g.kind });
        }
        // 袋: 使った分を減らす（入る物は R.State.gain）
        const inv0 = G.items || (G.items = {});
        for (const id of Object.keys(inv0)) {
          const n = eng.inv[id] || 0;
          if (n < inv0[id]) { if (n > 0) inv0[id] = n; else delete inv0[id]; }
        }
        const gainOne = (item, n) => {
          if (R.State && R.State.gain) { try { return R.State.gain(item, n); } catch (e) { R.warn('battle: R.State.gain failed', item, e && e.message); } }
          inv0[item] = Math.min(K('MAX_ITEM'), (inv0[item] || 0) + n);
          return null;
        };
        for (const s of eng.stolen) gainOne(s.item, 1);
        G.gold = Math.max(0, (G.gold || 0) - eng.goldLost);
        // 図鑑（g.book.mon[id] = {seen, kills, normal, rare, super, steal}）
        G.book = G.book || { mon: {} };
        G.book.mon = G.book.mon || {};
        const book = (id) => (G.book.mon[id] = G.book.mon[id] || { seen: true, kills: 0 });
        for (const m of eng.mons) book(m.id).seen = true;
        for (const m of eng.killed) book(m.id).kills = (book(m.id).kills || 0) + 1;
        for (const s of eng.stolen) book(s.mon)[s.stealOnly ? 'steal' : s.grade] = true;
        G.battle = G.battle || { cursor: {}, lastRound: [] };
        G.battle.lastRound = lastRoundOut.slice();
        if (result === 'win') {
          const rw = eng.computeRewards();
          G.gold = Math.min(K('MAX_GOLD'), (G.gold || 0) + rw.gold);
          for (const d of rw.drops) {
            if (!d.kept) continue;
            gainOne(d.item, d.n || 1);
            if (d.slot !== 'bonus') book(d.mon)[d.slot] = true;
          }
          // 伸び（STATS_REWORK §9.3）: 勝った戦闘ごとに。出撃中（倒れた人も）と控え
          if (R.Growth && R.Growth.afterBattle) {
            let rows = null;
            try { rows = R.Growth.afterBattle(chars, reserveChars, eng.growthInfo()); } catch (e) { R.warn('battle: R.Growth.afterBattle failed', e && e.message); }
            finished.grow = (Array.isArray(rows) ? rows : []).filter((r) => r && (r.hp || r.mp)).map((r) => ({ c: r.c && r.c.id ? r.c.id : r.c, hp: r.hp || 0, mp: r.mp || 0 }));
          }
          finished.r = B.rewards();
        }
        R.emit('battle:finish', { result, setup });
        return finished.r;
      },
    };
    return B;
  }

  // ---------------------------------------------------------------- 頭だけの戦闘（sim・テスト）
  /**
   * o: {party:[CharState]（写して使う）, inv, gold, mons|troop|zone, tier, lv, lvOff, glimTier, maxRounds = 50, seed, dark,
   *     ai: (eng, round) → cmds（無ければ R.BattleAI.partyCommands）, rewards (true = ドロップも振る), surprise, golden, rare,
   *     glimmerForce, noEscape, log (true = 文の列を返す), events (true = 契約の出来事の列を返す)}
   * → {result, rounds, hpLossPct, partyHpPct, partyMpPct, deaths, damageDealt, damageTaken, mpUsed, mpUsedBy, casts, techs, itemsUsed,
   *    killed, mons, gold, drops, stolen, glimmers, profUps, golden, rare, boss, Tb, Lb, party, inv, log, events, eng}
   */
  function simulate(o) {
    o = o || {};
    const saved = R.Mon.rng();
    const rng = R.Mon.mkRng(o.seed != null ? o.seed : 'sim');
    R.Mon.setRng(rng);
    try {
      const party = (o.party || []).map((c) => clone(c));
      const inv = clone(o.inv || {});
      const troop = o.troop && DB.troops[o.troop];
      const ro = Object.assign({}, o);
      if (!o.rare) ro.noRare = true;
      if (!o.golden) ro.noGolden = true;
      const r0 = resolveMonsters(ro, charsMods(party));
      if (!r0) return { result: 'none', rounds: 0, party, inv };
      const eng = new Engine({
        party, mons: r0.mons, inv, gold: o.gold || 0, rng,
        noEscape: !!(o.noEscape || (troop && troop.noEscape)), canLose: !!o.canLose,
        surprise: o.surprise, noSurprise: o.surprise === undefined ? r0.kind !== 'zone' : undefined,
        tier: r0.Tb, lv: r0.Lb, glimTier: o.glimTier != null ? o.glimTier : r0.Tb, glimmerForce: o.glimmerForce, dark: !!o.dark,
      });
      const log = o.log ? [] : null;
      const events = o.events ? [] : null;
      const sink = (ev) => {
        if (log && ev.t === 'msg') log.push(ev.text);
        if (events) toEvents(ev, eng.leaderName(), events, eng);
      };
      const mhp0 = eng.party.reduce((s, p) => s + p.mhp, 0);
      const mp0 = eng.party.map((p) => p.mp);
      drain(eng.begin(), sink);
      const maxR = o.maxRounds || 50;
      while (!eng.result && eng.round < maxR) {
        eng.use();
        const cmds = o.ai ? o.ai(eng, eng.round + 1) : (R.BattleAI && R.BattleAI.partyCommands ? R.BattleAI.partyCommands(eng, o.aiOpts) : []);
        drain(eng.playRound(cmds), sink);
      }
      if (eng.result === 'win' && o.rewards) drain(eng.rewards(), sink);
      if (events && eng.result) events.push({ t: 'end', result: eng.result });
      const hpEnd = eng.party.reduce((s, p) => s + Math.max(0, p.hp), 0);
      const growthInfo = eng.growthInfo();
      if (o.after) eng.recover(eng.result);
      const sum = (k) => eng.party.reduce((s, p) => s + Math.max(0, p[k]), 0);
      const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
      const rw = eng.rewardInfo || { gold: 0, drops: [] };
      return {
        result: eng.result || 'timeout',
        rounds: eng.round,
        partyHpPct: pct(hpEnd, mhp0),
        partyMpPct: pct(sum('mp'), sum('mmp')),
        hpLossPct: pct(eng.stats.taken, mhp0),
        deaths: eng.stats.deaths,
        down: eng.party.filter((p) => !p.alive).length,
        damageDealt: eng.stats.dealt,
        damageTaken: eng.stats.taken,
        mpUsed: eng.stats.mpUsed,
        mpUsedBy: eng.party.map((p, i) => Math.max(0, mp0[i] - p.mp)),
        casts: Object.assign({}, eng.stats.casts), techs: Object.assign({}, eng.stats.techs), itemsUsed: eng.stats.items,
        killed: eng.killed.length,
        mons: eng.mons.map((m) => m.id),
        gold: rw.gold || 0,
        drops: rw.drops.map((d) => ({ item: d.item, grade: d.grade, mon: d.mon })),
        stolen: eng.stolen.slice(),
        glimmers: eng.glimmers.slice(),
        profUps: eng.profUps.slice(),
        growthInfo,
        golden: eng.golden, rare: eng.rare, metal: eng.metal, boss: eng.boss, Tb: eng.tier, Lb: eng.lv,
        party, inv, log, events, eng,
      };
    } finally { R.Mon.setRng(saved); }
  }

  Object.assign(BC, {
    create,
    Engine, Unit, PartyUnit, MonUnit, NAMES, BUFF_STATS, STATUS_DEFAULTS: ST, UNUSABLE_TEXT,
    stageMult, stDef, badStatuses, isDisabling, wtypeInfo, weaponItem, hasBattleEffect, isMagicAct, isEscape, ACT, normStats, rowOf,
    MON_ATTACK_FX, WEAPON_FX, BATTLE_EFFECT, K, KF,
    resolveMonsters, simulate, drain, charsMods, toEvents,
    reasonText(why) { return UNUSABLE_TEXT[why] || ''; },
    specials: BC.specials || {},
  });
})(window.RPG);
