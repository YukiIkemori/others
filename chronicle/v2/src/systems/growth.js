// R.Growth（RULES）: レベルと経験値の無い成長（STATS_REWORK §9、A30）。成長はこの 1 か所だけ。
//   各人は画面に出さない小数の成長の点 c.gl（1.0〜99.0、保存する）を持つ。最大 HP・MP の土台は gl で読む曲線 × 成長の文字。
//   勝った戦闘のあと、敵の強さ E と gl の差 d で決まる確率で gl が伸びる（弱い敵では伸びない。ティアごとの上限 cap(T) = LZ(T) + 6）。
//
//   init(c, {tier, joinFrom})                   新しい人の gl と HP・MP（'start' 主人公 1.0、'tavern' ほか = 出撃中の平均 × 0.9）
//   baseMax(c, 'hp'|'mp')                       装備の前の最大 HP・MP（R.Rules.maxOf が体力・hpPct をかける）
//   afterBattle(party, reserve, info) → [{c, hp, mp}]   勝った後（BATTLE の B.finish が 1 回呼ぶ）。伸びた人だけ、最大値の増え
//   equivLevel(c)                               内部の相当レベル = gl（魔除けの香・sim。画面には出さない）
//   cap(T)                                      ティア T の gl の上限
//   glAt(tier, kind)                            標準の進み方の gl（フィクスチャ 'auto' と sim が共有。§9.5）
(function (R) {
  'use strict';
  R.Stubs.claim('Growth');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const K = () => R.Rules.K;
  const tierNow = () => { try { return R.Tier && R.Tier.effective ? R.Tier.effective() | 0 : ((R.Game && R.Game.tier) | 0); } catch (e) { return 0; } };
  const charsOf = (list) => (list || []).map((x) => (typeof x === 'string' ? R.Game && R.Game.chars[x] : x)).filter(Boolean);

  const Growth = (R.Growth = R.Growth || {});
  Object.assign(Growth, {
    /** 旧の「同じ強さの敵で 1 レベルに要る戦闘数」bpl(L) = 16 − 12 e^(−L/12) */
    bpl(L) { const G = K().GROW; return G.bplMax - G.bplAmp * Math.exp(-L / G.bplTau); },
    /** 1 回の伸びの量の土台 step(L) = 1 / (0.30 × bpl(L)) */
    step(L) { return 1 / (K().GROW.p0 * Growth.bpl(L)); },
    /** HPlv(L) = 17.5 + 14.7 (L − 1)^0.90、MPlv(L) = 8 + 2.6 (L − 1)^0.85 */
    curve(key, L) { const P = K()[key === 'mp' ? 'MP' : 'HP']; return P.a + P.b * Math.pow(Math.max(0, L - 1), P.p); },
    gl(c) { return clamp(+(c && c.gl) || K().GROW.glMin, K().GROW.glMin, K().GROW.glMax); },
    baseMax(c, key) {
      key = key === 'mp' ? 'mp' : 'hp';
      const letter = R.Rules.growth(c)[key];
      return Math.round(Growth.curve(key, Growth.gl(c)) * K().GROWTH_LETTER[key][letter]);
    },
    equivLevel(c) { return Growth.gl(c); },
    cap(T) { return K().LZ(clamp((T == null ? tierNow() : T) | 0, 0, 9)) + K().GROW.capOff; },
    /**
     * 標準の進み方の gl（§9.5）: 'party'|'mob' 雑魚 LZ+1、'mid' 中ボス LZ+2、'boss'|'region' 地方ボス LZ+3、
     * 'prologue' 序章の終わり 5、'start' 1、'final' 56、'last' 58、'super' 64
     */
    glAt(tier, kind) {
      const T = clamp(tier | 0, 0, 9), L = K().LZ(T);
      switch (kind) {
        case 'start': return 1;
        case 'prologue': return 5;
        case 'mid': return L + 2;
        case 'boss': case 'region': return L + 3;
        case 'final': return 56;
        case 'last': return 58;
        case 'super': return 64;
        default: return L + 1;
      }
    },
    /** 新しい人の gl（加入: 出撃中の平均 × 0.9、1 以上。主人公は 1）と HP・MP の満タン */
    init(c, o) {
      o = o || {};
      const G = K().GROW;
      let gl = G.glMin;
      if (o.gl != null) gl = o.gl;
      else if (o.joinFrom && o.joinFrom !== 'start') {
        const act = R.Game ? charsOf(R.Game.party).filter((m) => m !== c && m.id !== c.id) : [];
        if (act.length) gl = Math.max(G.glMin, act.reduce((s, m) => s + Growth.gl(m), 0) / act.length * G.join);
        else if (o.tier) gl = Math.max(G.glMin, Growth.glAt(o.tier, 'party') * G.join);
      }
      c.gl = Math.round(clamp(gl, G.glMin, G.glMax) * 100) / 100;
      const st = R.Rules.stats(c);
      c.hp = st.maxHp; c.mp = st.maxMp;
      return c;
    },
    /** 敵の強さ E = Lb + max(倒した魔物の補正: ボス +4・レア +2・金色 +1・鋼 +6) */
    enemyStrength(info) {
      const add = K().GROW.add;
      let best = 0;
      for (const k of info.killed || []) {
        let a = 0;
        if (k.boss) a = Math.max(a, add.boss);
        if (k.rare) a = Math.max(a, add.rare);
        if (k.golden) a = Math.max(a, add.golden);
        if (k.metal) a = Math.max(a, add.metal);
        best = Math.max(best, a);
      }
      if (info.boss) best = Math.max(best, add.boss);
      return (info.Lb || 0) + best;
    },
    /** 1 人が伸びる確率（ボス戦は 1）: clamp(0.30 + 0.07 d, 0, 0.90) × (1 + growPct/100) × (控え 0.6 / 倒れた人 0.5) */
    chance(c, E, o) {
      o = o || {};
      const G = K().GROW;
      if (o.boss && !o.reserve && !(o.fallen)) return 1;
      const d = E - Growth.gl(c);
      let p = clamp(G.p0 + G.slope * d, 0, G.pmax);
      const m = R.Rules.mods(c);
      p *= Math.max(0, 1 + (m.growPct || 0) / 100);
      if (o.reserve) p *= G.reserve;
      else if (o.fallen) p *= G.fallen;
      if (o.boss) p = Math.max(p, o.reserve ? G.reserve : G.fallen);   // ボス戦は控え・倒れた人も必ず（× 0.6 / 0.5）
      return clamp(p, 0, 1);
    },
    /**
     * 勝った戦闘のあとの伸び（§9.3）。party・reserve は CharState か id の配列。
     * info = {E?, Lb, killed:[{boss?, rare?, golden?, metal?}], boss?, metal?, members?:[出撃した id], fallen?:[倒れていた id], rng?:()=>[0,1)|{next}, tier?}
     * → [{c, hp, mp}]（最大 HP・MP の増え。伸びた人だけ。今の HP・MP も同じだけ増やす。倒れた人の HP は増やさない）
     */
    afterBattle(party, reserve, info) {
      info = info || {};
      const G = K().GROW;
      const rnd = typeof info.rng === 'function' ? info.rng : info.rng && info.rng.next ? () => info.rng.next() : Math.random;
      const E = info.E != null ? info.E : Growth.enemyStrength(info);
      const capT = Growth.cap(info.tier);
      const metal = !!(info.metal || (info.killed || []).some((k) => k.metal));
      const out = [];
      const one = (c, o) => {
        if (!c) return;
        const p = Growth.chance(c, E, { boss: !!info.boss, reserve: o.reserve, fallen: o.fallen });
        if (!(rnd() < p)) return;
        const gl0 = Growth.gl(c);
        if (gl0 >= capT) return;
        const mul = info.boss ? G.mul.boss : metal ? G.mul.metal : 1;
        const d = Growth.step(gl0) * (G.rf[0] + (G.rf[1] - G.rf[0]) * rnd()) * mul;
        const before = R.Rules.stats(c);
        c.gl = Math.round(Math.min(capT, gl0 + d) * 1000) / 1000;
        const after = R.Rules.stats(c);
        const hp = Math.max(0, after.maxHp - before.maxHp), mp = Math.max(0, after.maxMp - before.maxMp);
        if (c.hp > 0) c.hp = Math.min(after.maxHp, c.hp + hp);
        c.mp = Math.min(after.maxMp, (c.mp || 0) + mp);
        if (hp || mp) out.push({ c, hp, mp });
      };
      const fallenIds = new Set(info.fallen || []);
      for (const c of charsOf(party)) {
        const fought = !info.members || info.members.includes(c.id);
        one(c, { fallen: !(c.hp > 0) || !fought || fallenIds.has(c.id) });
      }
      for (const c of charsOf(reserve)) one(c, { reserve: true });
      return out;
    },
  });
})(window.RPG);
