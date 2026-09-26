// R.Party（RULES）: 人を作る所（makeChar）、出撃中の 4 人と控え、並びと隊列、全快の 3 つ（restoreAll・heal・fullHeal）、
// 戦闘のあとの回復、一行の効果。V2_PLAN §2.5.12・§2.11、今の木の src/systems/party.js から移して直した。
// R.Game.party・reserve は id の配列、人の中身は R.Game.chars[id]（EVENTS の R.Game の形、§2.6.3）。DOM に触れない。
//
//   makeChar(id, {hero, tier, joinFrom, catchUp?}) → CharState   R.State.setHero と join はこれを呼ぶだけ（R.Game には入れない）
//   members() / reserve() → [CharState]      swap(a, b) / setRow(id, 'front'|'back') / join(id)
//   restoreAll()  ただで全快（宿・泉・無料の寝床・ev.rest・全滅の宿から）: 出撃中も控えも、生き返り・状態も消す
//   heal(all)     生きている人の HP・MP だけ（ev.heal）。all で控えも
//   fullHeal({dry}) → K.fullHealResult   満タン（A2、メニューの X）: 覚えた回復の術を MP の効率のよい順に → 足りなければ安い回復の道具
(function (R) {
  'use strict';
  R.Stubs.claim('Party');
  const DB = R.DB;
  const G = () => R.Game;
  const Rules = () => R.Rules;
  const chars = (ids) => (ids || []).map((id) => G().chars[id]).filter(Boolean);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const Party = (R.Party = R.Party || {});
  Object.assign(Party, {
    MAX: R.PARTY_MAX || 4,
    /** 仲間の id（酒場の並び） */
    candidates() { return Object.keys(DB.companions); },

    // ------------------------------------------------------------ 人を作る
    /**
     * CharState を作る（初めの装備・技・術・熟練度・隊列・gl・HP/MP）。hero = K.hero {type, sex, name, fav?} なら主人公（id 'hero'）。
     * o.tier（既定は R.Game.tier）、o.joinFrom 'start'|'tavern'|'event'、o.catchUp（途中加入の熟練度の追いつき。既定: 仲間が 3 人以上いるとき）
     */
    makeChar(id, o) {
      o = o || {};
      const h = o.hero;
      const kit = DB.starterKit || {};
      const tier = o.tier != null ? o.tier : ((G() && G().tier) || 0);
      let c, equip = {}, techs = [], spells = [];
      if (h) {
        const type = DB.heroTypes[h.type] ? h.type : 'warrior';
        const T = DB.heroTypes[type];
        const sex = h.sex === 'f' ? 'f' : 'm';
        c = R.State.blankChar('hero', { name: h.name || 'アルン', look: `hero_${sex}_${type}`, type });
        c.sex = sex;
        const fav = h.fav && (Rules().WTYPES.includes(h.fav) || Rules().ELEMENTS.includes(h.fav)) ? h.fav : null;
        if (fav) c.fav = fav;
        const fw = fav && Rules().WTYPES.includes(fav);
        equip.weapon1 = fw ? (kit.weapon && kit.weapon[fav]) : T.defaultWeapon;
        Object.assign(equip, T.startEquip || {});
        const on = (T.onFavor && T.onFavor[fw ? 'weapon' : fav ? 'element' : 'weapon']) || {};
        techs = (fw && kit.tech && kit.tech[fav] ? [kit.tech[fav]] : []).concat(on.techs || []);
        spells = (fav && !fw && kit.spell && kit.spell[fav] ? [kit.spell[fav]] : []).concat(on.spells || []);
      } else {
        const D = DB.companions[id];
        if (!D) R.warn('makeChar: unknown companion', id);
        c = R.State.blankChar(id, { name: (D && D.name) || id, look: (D && D.look) || id });
        c.sex = D && D.gender === 'f' ? 'f' : 'm';
        equip = Object.assign({}, (D && D.startEquip) || {});
        techs = (D && D.startTechs) || [];
        spells = (D && D.startSpells) || [];
      }
      c.equip = c.equip || {};
      for (const s of Rules().SLOTS) c.equip[s] = null;
      for (const s of Rules().SLOTS) {
        const it = equip[s];
        if (!it) continue;
        if (!DB.items[it]) { R.warn('makeChar: unknown start item', it); continue; }
        c.equip[s] = it;
      }
      if (Rules().hasTwoHanded(c)) c.equip.shield = null;
      const knownAct = (x) => !!Rules().actionOf(x) || (R.warn('makeChar: unknown action', x), false);
      c.techs = Array.from(new Set(techs)).filter(knownAct);
      c.spells = Array.from(new Set(spells)).filter(knownAct);
      // 初めの熟練度: 適性 S 25 点・A 11 点（段階 3 / 2）
      const L = Rules().aptLetters(c), sp = kit.prof || Rules().K.START_PROF;
      c.wprof = {}; c.eprof = {};
      for (const w of Rules().WTYPES) c.wprof[w] = sp[L.w[w]] || 0;
      for (const e of Rules().ELEMENTS) c.eprof[e] = sp[L.e[e]] || 0;
      const nComp = G() ? (G().joined || []).filter((x) => x !== 'hero').length : 0;
      const catchUp = o.catchUp != null ? !!o.catchUp : (!h && (nComp >= 3 || tier > 0));
      if (catchUp) Rules().catchUpProf(c, tier);
      // 隊列
      if (h) {
        const r = (DB.heroTypes[c.type] && DB.heroTypes[c.type].row) || 'auto';
        c.row = r === 'auto' ? (Rules().reach(c.equip.weapon1) === 'any' || Rules().favKind(c) === 'element' ? 'back' : 'front') : r === 'back' || r === 'middle' ? 'back' : 'front';
      } else {
        const D = DB.companions[id];
        c.row = D && (D.row === 'back' || D.row === 'middle') ? 'back' : 'front';
      }
      c.status = [];
      R.Growth.init(c, { tier, joinFrom: o.joinFrom || (h ? 'start' : 'tavern'), gl: o.gl });
      return c;
    },

    // ------------------------------------------------------------ 出撃と控え
    members() { return G() ? chars(G().party) : []; },
    reserve() { return G() ? chars(G().reserve) : []; },
    all() { return G() ? chars(G().party.concat(G().reserve)) : []; },
    isRecruited(id) { return !!(G() && G().chars[id]); },
    /**
     * 入れ替え（ファロスの潮風亭の画面が呼ぶ）: a・b は id。
     *   出撃中どうし → 並びを入れ替える / 出撃中と控え → 入れ替える（控えから出る人は全快、隊列はデータの物。主人公は控えに行かない）
     *   swap(a, null) → a を控えへ / swap(null, b) → b を出撃へ（空きがあるとき）
     */
    swap(a, b) {
      const g = G();
      if (!g) return false;
      const inP = (x) => x && g.party.includes(x), inR = (x) => x && g.reserve.includes(x);
      if (a && b && inP(a) && inP(b)) {
        const i = g.party.indexOf(a), j = g.party.indexOf(b);
        g.party[i] = b; g.party[j] = a;
        return true;
      }
      let act = inP(a) ? a : inP(b) ? b : null;
      let res = inR(a) ? a : inR(b) ? b : null;
      if ((a && !inP(a) && !inR(a)) || (b && !inP(b) && !inR(b))) return false;
      if (!act && !res) return false;
      if (act === 'hero' && res == null) return false;
      if (act === 'hero') return false;
      if (!act && g.party.length >= Party.MAX) return false;
      if (act && res) {
        g.party[g.party.indexOf(act)] = res;
        g.reserve[g.reserve.indexOf(res)] = act;
      } else if (act) {
        g.party.splice(g.party.indexOf(act), 1);
        g.reserve.push(act);
      } else {
        g.reserve.splice(g.reserve.indexOf(res), 1);
        g.party.push(res);
      }
      if (res) Party.enter(g.chars[res]);
      Party.sortReserve();
      return true;
    },
    /** 控えから出る人: 全快・状態を消す・データの隊列 */
    enter(c) {
      if (!c) return;
      Rules().fullRestore(c);
      if (c.id !== 'hero') { const D = DB.companions[c.id]; c.row = D && (D.row === 'back' || D.row === 'middle') ? 'back' : 'front'; }
    },
    /** 控えは加わった順 */
    sortReserve() {
      const g = G();
      const order = g.joined || [];
      g.reserve.sort((x, y) => order.indexOf(x) - order.indexOf(y));
    },
    setRow(id, row) {
      const c = G() && G().chars[id];
      if (!c) return false;
      row = row === 'middle' ? 'back' : row;
      if (row !== 'front' && row !== 'back') return false;
      c.row = row;
      return true;
    },
    /** 並びを決め直す（同じ顔ぶれ） */
    setOrder(ids) {
      const g = G();
      if (!Array.isArray(ids) || ids.length !== g.party.length || ids.some((x) => !g.party.includes(x))) return false;
      g.party = ids.slice();
      return true;
    },
    /** 仲間を加える（ev.chooseCompanions・酒場）。空きがあれば出撃、無ければ控え。もういれば何もしない → CharState */
    join(id, o) {
      const g = G();
      if (!g.chars[id]) g.chars[id] = Party.makeChar(id, Object.assign({ tier: g.tier || 0, joinFrom: 'tavern' }, o || {}));
      if (!g.joined.includes(id)) g.joined.push(id);
      if (!g.party.includes(id) && !g.reserve.includes(id)) {
        if (g.party.length < Party.MAX && !(o && o.toReserve)) g.party.push(id); else g.reserve.push(id);
      }
      return g.chars[id];
    },

    // ------------------------------------------------------------ 全快の 3 つ（V2_PLAN §2.11）
    restoreAll() { for (const c of Party.all()) Rules().fullRestore(c); },
    heal(all) {
      for (const c of Party.members().concat(all ? Party.reserve() : [])) {
        if (!(c.hp > 0)) continue;
        const st = Rules().stats(c);
        c.hp = st.maxHp; c.mp = st.maxMp;
      }
    },
    /**
     * 満タン（A2）: 出撃中の生きている人の HP を満たす。
     *   1. 覚えている回復の術（フィールドで使える物）を、治る量 / MP の効率のよい順に（全体の術は 2 人以上が減っているとき）
     *   2. 足りなければ、袋の安い回復の道具（1 人用・通常品。レアと全体回復は使わない）
     * {dry:true} は何も変えずに見込みだけ（MENUS が確かめの札に出す）。→ K.fullHealResult {used:[{who, what, n}], healed:[id], short}
     *   who = 術を唱えた人の id（道具は 'bag'）、what = 術か道具の id、n = 回数
     */
    fullHeal(o) {
      const dry = !!(o && o.dry);
      const mem = Party.members();
      const sim = dry ? mem.map((c) => clone(c)) : mem;
      const inv = dry ? Object.assign({}, (G() && G().items) || {}) : (G() && G().items) || {};
      const maxHp = sim.map((c) => Rules().stats(c).maxHp);
      const missing = (i) => (sim[i].hp > 0 ? maxHp[i] - sim[i].hp : 0);
      const hurt0 = sim.map((c, i) => (missing(i) > 0 ? c.id : null)).filter(Boolean);
      const used = {};
      const note = (who, what) => { const k = who + '|' + what; used[k] = used[k] || { who, what, n: 0 }; used[k].n++; };
      const healAmt = (caster, a, i) => {
        let pct = 0;
        for (const e of a.effects || []) if (e.type === 'heal') pct += e.pct || 0;
        const m = Rules().mods(caster);
        return Math.floor(maxHp[i] * pct * Rules().healF(caster) * (1 + (m.healPct || 0) / 100) * Rules().profPowerMul(caster, a));
      };
      // 1. 術
      for (let guard = 0; guard < 200; guard++) {
        const hurt = sim.map((c, i) => i).filter((i) => missing(i) > 0);
        if (!hurt.length) break;
        let best = null;
        for (const caster of sim) {
          if (!(caster.hp > 0) || Rules().mods(caster).noSpell) continue;
          for (const id of Rules().fieldSpells(caster).concat(Rules().techList(caster).filter((t) => Rules().actionOf(t).field === true))) {
            const a = Rules().actionOf(id);
            if (!a || !(a.effects || []).some((e) => e.type === 'heal')) continue;
            if (a.target !== 'ally' && a.target !== 'allies') continue;
            const cost = Rules().mpCost(caster, id);
            if (cost > (caster.mp || 0)) continue;
            let gain = 0, target = null;
            if (a.target === 'allies') { if (hurt.length < 2) continue; for (const i of hurt) gain += Math.min(missing(i), healAmt(caster, a, i)); }
            else {
              target = hurt.reduce((x, y) => (missing(y) > missing(x) ? y : x));
              gain = Math.min(missing(target), healAmt(caster, a, target));
            }
            if (gain <= 0) continue;
            const eff = gain / Math.max(0.5, cost);
            if (!best || eff > best.eff + 1e-9) best = { caster, id, a, cost, target, eff };
          }
        }
        if (!best) break;
        best.caster.mp -= best.cost;
        const targets = best.a.target === 'allies' ? hurt : [best.target];
        for (const i of targets) sim[i].hp = Math.min(maxHp[i], sim[i].hp + healAmt(best.caster, best.a, i));
        note(best.caster.id, best.id);
      }
      // 2. 道具（安い順。1 人用・通常品・フィールドで使えるもの）
      const items = Object.keys(inv).filter((id) => {
        const it = DB.items[id];
        if (!it || it.slot !== 'use' || !it.use || !it.use.field || (it.grade && it.grade !== 'normal')) return false;
        if (it.use.target !== 'ally') return false;
        return (it.use.effects || []).some((e) => e.type === 'heal');
      }).sort((x, y) => (DB.items[x].price || 0) - (DB.items[y].price || 0));
      for (let guard = 0; guard < 400; guard++) {
        const hurt = sim.map((c, i) => i).filter((i) => missing(i) > 0);
        if (!hurt.length) break;
        const i = hurt.reduce((x, y) => (missing(y) > missing(x) ? y : x));
        const id = items.find((x) => (inv[x] || 0) > 0);
        if (!id) break;
        let pct = 0;
        for (const e of DB.items[id].use.effects) if (e.type === 'heal') pct += e.pct || 0;
        const m = Rules().mods(sim[i]);
        sim[i].hp = Math.min(maxHp[i], sim[i].hp + Math.floor(maxHp[i] * pct * (1 + (m.itemPct || 0) / 100)));
        inv[id]--;
        if (!dry && inv[id] <= 0) delete inv[id];
        note('bag', id);
      }
      const short = sim.some((c, i) => missing(i) > 0);
      return { used: Object.values(used), healed: hurt0, short };
    },

    // ------------------------------------------------------------ 戦闘のあと
    /**
     * 戦闘のあとの回復（§4.12.1）: 勝ち → 生きている人は HP 満タン・MP を最大の 12%（切り上げ）、逃げ → 生きている人は HP 満タン。
     * 状態はいつも消える。倒れた人はそのまま。BATTLE の B.finish が呼ぶ（o.members は出撃した id）
     */
    afterBattle(result, o) {
      o = o || {};
      const res = typeof result === 'string' ? result : result && result.result;
      const A = Rules().K.AFTER;
      for (const c of Party.members()) {
        c.status = [];
        if (!(c.hp > 0)) { c.hp = 0; continue; }
        if (res !== 'win' && res !== 'escape') continue;
        const st = Rules().stats(c);
        c.hp = st.maxHp;
        if (res === 'win') c.mp = Math.min(st.maxMp, (c.mp || 0) + Math.ceil(st.maxMp * A.mpPct));
      }
    },

    // ------------------------------------------------------------ 一行の効果
    /** 一行の効果の値（8 つのキーは R.Rules.partyMods の上限つき、ほかは生きている出撃中の合計。真偽はどれか） */
    mod(key, party) {
      const K = Rules().K;
      const list = party ? party.map((x) => (typeof x === 'string' ? G().chars[x] : x)) : Party.members();
      if (K.PARTY_KEYS.includes(key)) return Rules().partyMods(list)[key];
      let sum = 0, any = false;
      for (const c of list) {
        if (!c || !(c.hp > 0)) continue;
        const v = Rules().mods(c)[key];
        if (typeof v === 'number') sum += v;
        else if (v === true) any = true;
      }
      return any && !sum ? true : sum;
    },
    /** フィールドの効果（§3.3.4）: encounterPct（絶対値の大きい方。同じ大きさの正負は 0）、walkHeal、noFloorDamage */
    fieldMods(party) {
      const list = party ? party.map((x) => (typeof x === 'string' ? G().chars[x] : x)) : Party.members();
      const vals = [];
      let walkHeal = 0, noFloor = false;
      for (const c of list) {
        if (!c || !(c.hp > 0)) continue;
        const m = Rules().mods(c);
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
      const cap = Rules().K.MODCAP.encounter;
      return { encounterPct: Math.max(-cap, Math.min(cap, enc)), walkHeal, noFloorDamage: noFloor };
    },
    /** 出撃中の gl の平均（魔除けの香: 平均 gl ≥ Lb + 3 の出現表だけ避ける。BATTLE の R.Mon.encounter が読む） */
    averageGl(party) {
      const list = party ? party.map((x) => (typeof x === 'string' ? G().chars[x] : x)).filter(Boolean) : Party.members();
      if (!list.length) return 1;
      return list.reduce((s, c) => s + R.Growth.equivLevel(c), 0) / list.length;
    },
  });
})(window.RPG);
