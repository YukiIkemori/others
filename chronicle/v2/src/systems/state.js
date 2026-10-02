// EVENTS — 状態 R.State（V2_PLAN §2.5.10・§2.6.3・§2.11。人の中身は RULES の R.Party.makeChar）
//
//   R.State.newGame({hero, seed})          R.Game を新しく作る（K.game）。hero（K.hero）があれば setHero まで
//   R.State.setHero(h)                     主人公を作って一行の先頭に（ev.createHero・新しいゲーム）
//   R.State.blankChar(id, o)               空の CharState（K.char。R.Party.makeChar が土台に使う）
//   R.State.serialize() → obj              保存する物（R.Game の写し。JSON にできる物だけ）
//   R.State.deserialize(obj) → bool        版 2 でなければ false（読まない・壊れない）。足りない項目は既定で埋める
//   R.State.wipeRecover() → K.place|null   全滅して「宿から」: 所持金半分・全員全快（R.Party.restoreAll）。出られない場面（wipeSafe）では所持金はそのまま
//   R.State.check(cond) → bool             条件（下の文法）。R.State.checkIn(G, cond, env) は同じ物を任意の状態で（tools/lib/cond.js も使う）
//   R.State.gain(id, n) → K.gain           品を入れる 1 か所（ev.item・宝箱・店・戦闘の報酬）。u_* はその時のティアの個体を R.Game.uniques に
//   足した物: take(id, n) → bool / owned(id) → 袋＋装備の数 / hero() → CharState / heroName() / gold(n)
//   migrateChars(G) → 派生技の回数 techUse・derived を埋める（deserialize が呼ぶ）
//   canonItem(id) → 今の id（R.DB.itemAlias: まとめて消した品 → 残した品）/ migrateItems(G) → 袋と装備を付け替えた数（deserialize が呼ぶ）
//
// 条件 Cond（§2.5.10。ここに無い書き方は R.warn して false）
//   null・undefined・true → 真 / false → 偽 / 'flag' / '!flag' / 'cleared_<rid>'（R.Game.cleared）/ 配列（すべて）
//   {any:[…]} / {all:[…]} / {not: cond} / {flag} / {item, n?}（袋＋装備）/ {var, gte|lte|eq}（何も無ければ 0 でない）
//   {tier: {gte|lte|eq}} か {tier: n}（n 以上）/ {lead: id, state: 'got'|'done'} / {choice: key, is}
//   {heard: key} / {guest: look}（look が null なら「連れていない」）/ {slice: true}（DB.config.slice）
//   {member: id}（出撃中の 4 人）/ {joined: id} / {visited: mapId} / {sex: 'm'|'f'}（主人公）
//   1 つの物に複数の鍵を書いたら、すべてが真のときだけ真。
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('State');
  const State = (R.State = R.State || {});
  const EQUIP = ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
  const VER = 2;

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  /** 空のゲーム（K.game の全部の項目） */
  function blankGame(seed) {
    return {
      ver: VER, seed, playMs: 0, chapter: 0,
      hero: 'hero', chars: {}, party: [], reserve: [], joined: [],
      gold: 0, items: {}, flags: {}, vars: {}, choices: {},
      tier: 0, pendingTier: null, cleared: {}, regionTier: {},   // regionTier: 解決した地方の出現の固定ティア {rid: T}（R.Tier.forZone）
      pos: { map: '', x: 0, y: 0, dir: 's' }, lastTown: null, lastInn: null, visited: {}, warps: {},
      chests: {}, secrets: {}, springs: {}, lit: {}, lamps: {},
      leads: {}, heard: {}, seenSkill: {},
      book: { mon: {} },
      chronicle: { chapters: [] }, guest: null,
      battle: { cursor: {}, lastRound: [] },
      uniques: {}, steps: 0,
    };
  }
  State.blankGame = function (seed) { return blankGame(seed == null ? 0 : seed); };

  State.blankChar = function (id, o) {
    o = o || {};
    const c = {
      id, name: o.name || id, look: o.look || id, type: o.type, gl: 0, hp: 1, mp: 0,
      equip: {}, wprof: {}, eprof: {}, techs: [], spells: [], status: [], row: o.row || 'front',
      techUse: {}, derived: {},   // 派生技: 技を使った回数・派生で覚えた技の元（R.Glimmer.countUse・learnDerived）
    };
    if (c.type === undefined) delete c.type;
    for (const k of EQUIP) c.equip[k] = null;
    return c;
  };

  State.newGame = function (o) {
    o = o || {};
    let seed = o.seed;
    if (seed == null) seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const G = (R.Game = blankGame(seed));
    const cfg = R.DB.config || {};
    if (typeof cfg.startGold === 'number') G.gold = cfg.startGold;
    for (const id of Object.keys(cfg.startItems || {})) G.items[id] = cfg.startItems[id];
    if (o.hero) State.setHero(o.hero);
    return G;
  };

  State.setHero = function (h) {
    const G = R.Game;
    h = h || (R.DB.config && R.DB.config.defaultHero) || { type: 'warrior', sex: 'm', name: R.T('sys.state.setHero.h.name') };
    const c = R.Party.makeChar('hero', { hero: h, tier: G.tier || 0 });
    if (h.fav) c.fav = h.fav;
    if (h.sex) c.sex = h.sex;
    G.chars.hero = c;
    G.hero = 'hero';
    if (!G.party.includes('hero')) G.party.unshift('hero');
    if (!G.joined.includes('hero')) G.joined.push('hero');
    return c;
  };

  State.hero = function () { const G = R.Game; return G && G.chars ? G.chars[G.hero || 'hero'] || null : null; };
  State.heroName = function () { const h = State.hero(); return (h && h.name) || ''; };
  State.heroSex = function (G) {
    G = G || R.Game;
    const h = G && G.chars && G.chars[G.hero || 'hero'];
    if (!h) return null;
    if (h.sex) return h.sex;
    return /_f_/.test(h.look || '') ? 'f' : 'm';
  };

  // ---------------------------------------------------------------- 品の id の付け替え（まとめて消した品 → 残した品）
  /** R.DB.itemAlias（items_armor.js: 名前しか違わなかった防具の系列をまとめたときの 消した id → 残した id）で今の id にする */
  State.canonItem = function (id) {
    const A = R.DB.itemAlias;
    let n = 0;
    while (id && A && Object.prototype.hasOwnProperty.call(A, id) && n++ < 8) id = A[id];
    return id;
  };
  /** 古いセーブの袋と全員（控えも）の装備の id を付け替える。→ 付け替えた数 */
  State.migrateItems = function (G) {
    if (!G) return 0;
    let n = 0;
    const items = G.items || {};
    for (const id of Object.keys(items)) {
      const to = State.canonItem(id);
      if (to === id) continue;
      if (!R.DB.items[to]) continue;
      items[to] = Math.min(99, (items[to] || 0) + (items[id] || 0));
      delete items[id];
      n++;
    }
    for (const cid of Object.keys(G.chars || {})) {
      const eq = G.chars[cid] && G.chars[cid].equip;
      if (!eq) continue;
      for (const k of Object.keys(eq)) {
        const to = State.canonItem(eq[k]);
        if (to !== eq[k] && R.DB.items[to]) { eq[k] = to; n++; }
      }
    }
    n += State.retireItems(G);
    return n;
  };
  /**
   * 体験版で持てない品を古いセーブから外す（持ち主 2026-09-27「削除しちゃうか、代替品に変えるかしていいよ」）:
   *   もう無い id は捨てる。体験版（DB.config.slice）では レア率・ドロップ率・先制・レア遭遇 の品（中盤以降の品）を
   *   外して、1 つにつき代わりの品（RETIRE_TO）を袋へ。→ 外した数
   */
  const RETIRE_TO = 'i_incense';   // 全回復の霊水は終盤から（オーナー 2026-09-28「全回復系は基本終盤から」）→ 癒やしの香炉
  const EARLY = ['rarePct', 'dropPct', 'preemptPct', 'rareEncPct'];
  State.retireItems = function (G) {
    if (!G) return 0;
    const DB = R.DB, slice = !!(DB.config && DB.config.slice);
    const tooEarly = (id) => { const it = DB.items[id]; return !!(slice && it && it.mods && EARLY.some((k) => it.mods[k])); };
    let n = 0, give = 0;
    const items = G.items || {};
    const RENAMED = { ac_st_lucky_spore: 'ac_st_spore_sachet' };   // 付け替えた体験版の盗み品（2026-09-27）
    for (const id of Object.keys(items)) {
      if (RENAMED[id] && DB.items[RENAMED[id]]) { items[RENAMED[id]] = Math.min(99, (items[RENAMED[id]] || 0) + items[id]); delete items[id]; n++; continue; }
      if (!DB.items[id]) { delete items[id]; n++; continue; }
      if (tooEarly(id)) { give += items[id] || 0; delete items[id]; n++; }
    }
    for (const cid of Object.keys(G.chars || {})) {
      const eq = G.chars[cid] && G.chars[cid].equip;
      if (!eq) continue;
      for (const k of Object.keys(eq)) {
        if (!eq[k]) continue;
        if (RENAMED[eq[k]] && DB.items[RENAMED[eq[k]]]) { eq[k] = RENAMED[eq[k]]; n++; continue; }
        if (!DB.items[eq[k]]) { eq[k] = null; n++; continue; }
        if (tooEarly(eq[k])) { eq[k] = null; give++; n++; }
      }
    }
    if (give && DB.items[RETIRE_TO]) items[RETIRE_TO] = Math.min(99, (items[RETIRE_TO] || 0) + give);
    G.items = items;
    return n;
  };

  /** 全員（控えも）の techUse・derived を正しい形に（古いセーブには無い → {}。知らない技・負の数は捨てる）→ G */
  State.migrateChars = function (G) {
    for (const cid of Object.keys((G && G.chars) || {})) {
      const c = G.chars[cid];
      if (!c || typeof c !== 'object') continue;
      if (R.Glimmer && R.Glimmer.sanitize) R.Glimmer.sanitize(c);
      else { if (!c.techUse || typeof c.techUse !== 'object') c.techUse = {}; if (!c.derived || typeof c.derived !== 'object') c.derived = {}; }
    }
    return G;
  };

  // ---------------------------------------------------------------- 保存と読み込み
  State.serialize = function () {
    const G = R.Game;
    if (!G) return null;
    const out = clone(G);
    out.ver = VER;
    return out;
  };

  /** 足りない項目を既定で埋める（P2 までの小さな形の変化で読めなくならないように）。形が大きく違えば false */
  State.deserialize = function (obj) {
    if (!obj || typeof obj !== 'object' || obj.ver !== VER) return false;
    if (!obj.chars || typeof obj.chars !== 'object' || !Array.isArray(obj.party)) return false;
    const G = Object.assign(blankGame(obj.seed != null ? obj.seed : 0), clone(obj));
    const base = blankGame(0);
    for (const k of Object.keys(base)) {
      if (G[k] === undefined) { G[k] = clone(base[k]); continue; }
      const obj = base[k] !== null && typeof base[k] === 'object';
      if (obj && Array.isArray(base[k]) !== Array.isArray(G[k])) G[k] = clone(base[k]);
      else if (obj && !Array.isArray(base[k]) && (G[k] === null || typeof G[k] !== 'object')) G[k] = clone(base[k]);
    }
    if (!G.book.mon) G.book.mon = {};
    if (!Array.isArray(G.chronicle.chapters)) G.chronicle.chapters = [];
    if (!G.battle.cursor) G.battle.cursor = {};
    if (!Array.isArray(G.battle.lastRound)) G.battle.lastRound = [];
    State.migrateItems(G);   // 消した品の id（R.DB.itemAlias）を残した品へ
    State.migrateChars(G);   // 派生技の回数（techUse・derived）: 古いセーブには無い → {}
    if (R.Tier && R.Tier.migrateLocks) R.Tier.migrateLocks(G);   // 出現の固定: 古いセーブの解決済みの地方は章の並びから
    const chk =R.Contract && R.Contract.check ? R.Contract.check('game', G) : { ok: true };
    if (!chk.ok) { R.warn('R.State.deserialize: ' + chk.errors.slice(0, 3).join('; ')); return false; }
    R.Game = G;
    return true;
  };

  State.wipeRecover = function () {
    const G = R.Game;
    if (!G) return null;
    const safe = State.wipeSafe();
    if (!safe) G.gold = Math.floor((G.gold || 0) / 2);
    R.Party.restoreAll();
    return safe || G.lastInn || null;
  };
  /**
   * 出られない場面（雪の籠城の夜など）で全滅したときの戻り先: {map, spawn, event?（起きた後に走らせるイベント）} | null。
   *   中身の側が State._safe に関数を足す（() → {map, spawn} | null）。どれかが返せば、「宿から」は所持金を減らさず、その場所で全快して起きる
   *   （テスター 2026-10-02 P23・P24: 籠城の夜は出口もワープも無く、負けると宿へ飛ばされ所持金が半分、村に入り直すとまた夜へ）
   */
  State._safe = State._safe || [];
  State.wipeSafe = function () {
    if (!R.Game) return null;
    for (const fn of State._safe) { try { const r = fn(R.Game); if (r && r.map) return r; } catch (e) { /* */ } }
    return null;
  };

  // ---------------------------------------------------------------- 品とお金
  /** 袋＋装備している数 */
  function owned(G, id) {
    if (!G) return 0;
    id = State.canonItem(id);
    let n = (G.items && G.items[id]) || 0;
    for (const cid of Object.keys(G.chars || {})) {
      const eq = G.chars[cid] && G.chars[cid].equip;
      if (!eq) continue;
      for (const k of EQUIP) if (eq[k] === id) n++;
    }
    return n;
  }
  State.owned = function (id) { return owned(R.Game, id); };
  /** 年代記に書いた「痛み」の数（STORY_BIBLE §12.1）: vars.pain_count と、choices の ch_*_write === 'pain' の多い方 */
  State.painCount = function (G) {
    G = G || R.Game;
    if (!G) return 0;
    const v = (G.vars && G.vars.pain_count) || 0;
    const c = Object.keys(G.choices || {}).filter((k) => /^ch_.*_write$/.test(k) && G.choices[k] === 'pain').length;
    return Math.max(v, c);
  };

  State.gain = function (id, n) {
    const G = R.Game;
    n = n == null ? 1 : Math.floor(n);
    id = State.canonItem(id);
    const it = R.DB.items[id];
    if (!it) R.warn('R.State.gain: unknown item ' + id);
    // 大事な物は 1 つだけ（2 つ目は入れない）
    if (it && it.slot === 'key') n = owned(G, id) > 0 ? 0 : Math.min(1, n);
    if (n > 0) G.items[id] = (G.items[id] || 0) + n;
    // 伸びる一品物（u_*）: その時のティアの値を個体として写す（1 回目だけ。RULES の R.Rules.itemOf が重ねて読む）
    if (n > 0 && it && (it.grow === 'tier' || /^u_/.test(id)) && !(G.uniques && G.uniques[id])) {
      G.uniques = G.uniques || {};
      const tier = (R.Tier && R.Tier.effective ? R.Tier.effective() : G.tier) || 0;
      let filled = {};
      try { filled = (R.Rules && R.Rules.fillItem ? R.Rules.fillItem(Object.assign({}, it), { tier }) : null) || {}; } catch (e) { R.warn('R.State.gain: fillItem ' + id + ' ' + (e && e.message)); }
      const u = { tier };
      for (const k of ['atk', 'mag', 'def', 'mdef', 'eva']) if (typeof filled[k] === 'number') u[k] = filled[k];
      if (filled.stats && typeof filled.stats === 'object') u.stats = clone(filled.stats);
      G.uniques[id] = u;
    }
    // 魔物から取る ★ の装備（grow 'drop'）: 手に入れたティアの値を写す。もっと上のティアでまた手に入れたら、その値に上げる
    //   （同じ品は 1 つの値。持ち主 2026-10-02「レア・盗みの装備はその時の店の品より少し上」）
    if (n > 0 && it && it.grow === 'drop') {
      G.uniques = G.uniques || {};
      const tier = (R.Tier && R.Tier.effective ? R.Tier.effective() : G.tier) || 0;
      const old = G.uniques[id];
      if (!old || tier > (old.tier | 0)) {
        let filled = {};
        try { filled = (R.Rules && R.Rules.fillItem ? R.Rules.fillItem(it, { tier }) : null) || {}; } catch (e) { R.warn('R.State.gain: fillItem ' + id + ' ' + (e && e.message)); }
        const u = { tier };
        for (const k of ['atk', 'mag', 'def', 'mdef', 'price']) if (typeof filled[k] === 'number') u[k] = filled[k];
        G.uniques[id] = u;
      }
    }
    if (n > 0) R.emit('item:gain', { id, n });
    return { item: id, n, grade: (it && it.grade) || 'normal', name: (it && it.name) || id };
  };

  /** 袋から減らす。足りなければ減らさず false */
  State.take = function (id, n) {
    const G = R.Game;
    n = n == null ? 1 : Math.floor(n);
    id = State.canonItem(id);
    const have = (G.items[id] || 0);
    if (have < n) return false;
    if (have - n > 0) G.items[id] = have - n; else delete G.items[id];
    return true;
  };
  /** お金を足す（負で引く。0 より下にはしない）→ 今の所持金 */
  State.gold = function (n) { const G = R.Game; G.gold = Math.max(0, Math.floor((G.gold || 0) + (n || 0))); return G.gold; };

  // ---------------------------------------------------------------- 条件
  const COND_KEYS = ['any', 'all', 'not', 'flag', 'item', 'n', 'var', 'gte', 'lte', 'eq', 'tier', 'lead', 'state', 'choice', 'is',
    'heard', 'guest', 'slice', 'member', 'joined', 'visited', 'sex'];
  State.COND_KEYS = COND_KEYS;

  function cmp(v, c) {
    if (c.gte != null && !(v >= c.gte)) return false;
    if (c.lte != null && !(v <= c.lte)) return false;
    if (c.eq != null && !(v === c.eq)) return false;
    return true;
  }

  /**
   * 条件を任意の状態で読む（R.State.check と tools/lib/cond.js の共通の中身）。
   * env = {DB, warn}（省くと R.DB）。手がかりの「解決」は R.Game.leads[id].done か、DB.leads[id].done の条件。
   */
  function checkIn(G, cond, env, depth) {
    env = env || {};
    const DB = env.DB || R.DB;
    depth = depth || 0;
    if (depth > 24) return false;
    const rec = (c) => checkIn(G, c, env, depth + 1);
    if (cond == null || cond === true) return true;
    if (cond === false) return false;
    G = G || {};
    if (typeof cond === 'string') {
      if (!cond.length) return true;
      if (cond.charAt(0) === '!') return !rec(cond.slice(1));
      if (cond.indexOf('cleared_') === 0) return !!((G.cleared && G.cleared[cond.slice(8)]) || (G.flags && G.flags[cond]));
      return !!(G.flags && G.flags[cond]);
    }
    if (Array.isArray(cond)) return cond.every(rec);
    if (typeof cond !== 'object') return !!cond;
    const c = cond;
    let known = false;
    if (c.any !== undefined) { known = true; if (!(Array.isArray(c.any) && c.any.some(rec))) return false; }
    if (c.all !== undefined) { known = true; if (!(Array.isArray(c.all) && c.all.every(rec))) return false; }
    if (c.not !== undefined) { known = true; if (rec(c.not)) return false; }
    if (c.flag !== undefined) { known = true; if (!rec(String(c.flag))) return false; }
    if (c.item !== undefined) { known = true; if (!(owned(G, c.item) >= (c.n != null ? c.n : 1))) return false; }
    if (c.var !== undefined) {
      known = true;
      const v = +((G.vars && G.vars[c.var]) || 0);
      if (c.gte == null && c.lte == null && c.eq == null) { if (!v) return false; } else if (!cmp(v, c)) return false;
    }
    if (c.tier !== undefined) {
      known = true;
      const t = G.tier || 0;
      if (typeof c.tier === 'number') { if (!(t >= c.tier)) return false; } else if (!cmp(t, c.tier || {})) return false;
    }
    if (c.lead !== undefined) {
      known = true;
      const l = G.leads && G.leads[c.lead];
      if (c.state === 'done') { if (!leadDoneIn(G, c.lead, env, depth + 1)) return false; } else if (!l) return false;
    }
    if (c.choice !== undefined) { known = true; if (!(G.choices && G.choices[c.choice] === c.is)) return false; }
    if (c.heard !== undefined) { known = true; if (!(G.heard && G.heard[c.heard])) return false; }
    if (c.guest !== undefined) {
      known = true;
      const gl = G.guest ? G.guest.look : null;
      if (c.guest === null || c.guest === false) { if (gl) return false; } else if (gl !== c.guest) return false;
    }
    if (c.slice !== undefined) { known = true; if (!!(DB.config && DB.config.slice) !== !!c.slice) return false; }
    if (c.member !== undefined) { known = true; if (!(G.party || []).includes(c.member)) return false; }
    if (c.joined !== undefined) { known = true; if (!(G.joined || []).includes(c.joined)) return false; }
    if (c.visited !== undefined) { known = true; if (!(G.visited && G.visited[c.visited])) return false; }
    if (c.sex !== undefined) { known = true; if (State.heroSex(G) !== c.sex) return false; }
    if (!known) { (env.warn || R.warn)('unknown cond ' + JSON.stringify(cond)); return false; }
    return true;
  }
  function leadDoneIn(G, id, env, depth) {
    const l = G.leads && G.leads[id];
    if (l && l.done) return true;
    const D = ((env && env.DB) || R.DB).leads || {};
    const d = D[id];
    return !!(l && d && d.done != null && d.done !== false && checkIn(G, d.done, env, depth));
  }
  State.checkIn = checkIn;
  State.leadDoneIn = leadDoneIn;
  State.check = function (cond) { return checkIn(R.Game, cond); };

  /** 条件の中の名前（QA と tools/lib/cond.js 用）→ {flags, items, vars, regions, leads, choices, heard, looks, maps, members} */
  State.condRefs = function (cond, out) {
    out = out || { flags: [], items: [], vars: [], regions: [], leads: [], choices: [], heard: [], looks: [], maps: [], members: [] };
    const add = (k, v) => { if (v != null && !out[k].includes(v)) out[k].push(v); };
    const walk = (c) => {
      if (c == null || typeof c === 'boolean') return;
      if (typeof c === 'string') {
        const s = c.charAt(0) === '!' ? c.slice(1) : c;
        if (s.indexOf('cleared_') === 0) add('regions', s.slice(8)); else if (s) add('flags', s);
        return;
      }
      if (Array.isArray(c)) { c.forEach(walk); return; }
      if (typeof c !== 'object') return;
      if (c.any) walk(c.any);
      if (c.all) walk(c.all);
      if (c.not) walk(c.not);
      if (c.flag) walk(String(c.flag));
      if (c.item) add('items', c.item);
      if (c.var) add('vars', c.var);
      if (c.lead) add('leads', c.lead);
      if (c.choice) add('choices', c.choice);
      if (c.heard) add('heard', c.heard);
      if (c.guest) add('looks', c.guest);
      if (c.visited) add('maps', c.visited);
      if (c.member) add('members', c.member);
      if (c.joined) add('members', c.joined);
    };
    walk(cond);
    return out;
  };

  /** 条件の書き方の検査（QA の validate）→ [問題の文] */
  State.condProblems = function (cond, path) {
    const out = [];
    path = path || 'cond';
    const walk = (c, p) => {
      if (c == null || typeof c === 'boolean') return;
      if (typeof c === 'string') { if (!c.length) out.push(p + ': empty string'); return; }
      if (Array.isArray(c)) { c.forEach((x, i) => walk(x, p + '[' + i + ']')); return; }
      if (typeof c !== 'object') { out.push(p + ': bad type ' + typeof c); return; }
      const ks = Object.keys(c);
      if (!ks.length) out.push(p + ': empty object');
      for (const k of ks) if (!COND_KEYS.includes(k)) out.push(p + ': unknown key ' + k);
      if (c.any) { if (!Array.isArray(c.any)) out.push(p + '.any: not an array'); else walk(c.any, p + '.any'); }
      if (c.all) { if (!Array.isArray(c.all)) out.push(p + '.all: not an array'); else walk(c.all, p + '.all'); }
      if (c.not !== undefined) walk(c.not, p + '.not');
      if ((c.gte != null || c.lte != null || c.eq != null) && c.var === undefined) out.push(p + ': gte/lte/eq without var');
      if (c.state != null && c.lead === undefined) out.push(p + ': state without lead');
      if (c.state != null && !['got', 'done'].includes(c.state)) out.push(p + ': state must be got|done');
      if (c.is !== undefined && c.choice === undefined) out.push(p + ': is without choice');
      if (c.tier != null && typeof c.tier !== 'number' && typeof c.tier !== 'object') out.push(p + ': tier must be a number or {gte|lte|eq}');
    };
    walk(cond, path);
    return out;
  };
})(window.RPG);
