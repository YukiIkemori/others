// 仮の実装: RULES（R.Rules・R.Growth・R.Glimmer・R.Party）。本物は src/systems/{rules,growth,glimmer,party}.js。V2_PLAN §2.5.12
(function (R) {
  'use strict';
  R.Stubs.define('Rules', {
    K: {
      SLOTS: ['weapon1', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'],
      WTYPES: ['sword', 'greatsword', 'dagger', 'bow', 'staff'],
      ELEMENTS: ['fire', 'ice', 'thunder', 'wind', 'earth', 'light'],
      ABILS: ['str', 'vit', 'dex', 'agi', 'int', 'mnd'],
    },
    abilMul() { return 1; },
    /** 仮: K.stats の形（版 2）で決まった値 */
    stats(c) {
      const w = c.equip && c.equip.weapon1 && R.DB.items[c.equip.weapon1];
      return {
        maxHp: R.Growth.baseMax(c, 'hp'), maxMp: R.Growth.baseMax(c, 'mp'), atk: 10, mag: 10, def: 10, mdef: 10, hit: 90, eva: 5, crit: 3, spd: 10,
        str: 8, vit: 8, dex: 8, agi: 8, int: 8, mnd: 8, wtype: (w && w.wtype) || null,
      };
    },
    preview() { return {}; },
    optimize() { return {}; },
    applyLoadout() {},
    profRank(pts) { return Math.max(1, Math.min(100, pts | 0)); },
    train() {},
    commandList() { return ['attack', 'skill', 'spell', 'defend', 'item']; },
    canEquip() { return true; },
    fillItem(item) { return item; },
    profAt(tier) { return 1 + (tier | 0) * 4; },
    /** 版 2: 宝箱の中身を決める（FIELD が開けた瞬間に呼ぶ）。chest = §2.6.1 の objects[type:'chest']、tier = 開けたときのティア */
    chestLoot(chest, tier, rng) {
      if (chest.gold) return { gold: chest.gold };
      if (chest.item) return { item: chest.item, n: chest.n || 1, grade: (R.DB.items[chest.item] || {}).grade || 'normal' };
      return { item: chest.pool === 'p_rare' ? 'i_elixir' : 'i_potion', n: 1, grade: chest.pool === 'p_rare' ? 'rare' : 'normal' };
    },
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
    /** 版 2: 人の CharState を作る（初めの装備・熟練度・技・gl まで）。hero = K.hero のときは主人公（id 'hero'）。
     *  R.State.setHero と R.Party.join の両方がこれを使う（作り方は RULES の 1 か所）。R.Game には入れない */
    makeChar(id, o) {
      o = o || {};
      const h = o.hero;
      const d = h ? {} : (R.DB.companions[id] || {});
      const c = R.State.blankChar(id, h
        ? { name: h.name || 'アルン', look: `hero_${h.sex || 'm'}_${h.type || 'warrior'}`, type: h.type || 'warrior' }
        : { name: d.name || id, look: d.look || id });
      R.Growth.init(c, { tier: o.tier != null ? o.tier : ((R.Game && R.Game.tier) || 0), joinFrom: o.joinFrom || (h ? 'start' : 'tavern') });
      return c;
    },
    join(id) {
      const G = R.Game;
      if (!G.chars[id]) G.chars[id] = R.Party.makeChar(id, { tier: G.tier, joinFrom: 'tavern' });
      if (!G.joined.includes(id)) G.joined.push(id);
      if (G.party.includes(id) || G.reserve.includes(id)) return;
      if (G.party.length < R.PARTY_MAX) G.party.push(id); else G.reserve.push(id);
    },
    /** 生きている人の HP・MP を満たす（蘇生しない）。all で控えも（ev.heal） */
    heal(all) { for (const c of R.Party.members().concat(all ? R.Party.reserve() : [])) if (c.hp > 0) { c.hp = R.Growth.baseMax(c, 'hp'); c.mp = R.Growth.baseMax(c, 'mp'); } },
    /** 版 2: ただで全快（宿・泉・無料の寝床・ev.rest・全滅の宿から）。蘇生・状態も消す・控えも */
    restoreAll() { for (const c of R.Party.members().concat(R.Party.reserve())) { c.hp = R.Growth.baseMax(c, 'hp'); c.mp = R.Growth.baseMax(c, 'mp'); c.status = []; } },
    /** 満タン（A2、メニューの X）: 覚えた回復の術 → 足りなければ安い回復の道具。→ K.fullHealResult（MENUS が 1 枚にまとめる）。
     *  道具を使う前の確かめ（A2）は MENUS が {dry: true} で先に呼んで見せる。仮: 何も使わず全快したことにする */
    fullHeal(o) {
      const healed = R.Party.members().filter((c) => c.hp > 0 && (c.hp < R.Growth.baseMax(c, 'hp') || c.mp < R.Growth.baseMax(c, 'mp'))).map((c) => c.id);
      if (!(o && o.dry)) R.Party.heal(false);
      return { used: [], healed, short: false };
    },
  });
})(window.RPG);
