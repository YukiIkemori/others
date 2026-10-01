// tech_tags.js — 技の「特徴の短い言葉」（R.Rules.techTags）。戦闘の技の一覧の説明・技と術の画面・詳しい表示が使う。
// 持ち主（2026-10-01）「MP5 の技が多いけど、どれも別段強くないし、同じようなのがあって違いも分からん」→ 技ごとの役目を
// データ（effects・quick・reach）から 先制・2回・火・守備無視・会心・気絶 … のような短い言葉にして、一目で違いが分かるようにする。
// 数字の効果は出さない（A17）。回数（2回）は説明の文と同じく出す。狙い（単体・全体）は別に出しているので、ここには入れない。
(function (R) {
  'use strict';
  const T = (k, p) => String(R.T('sys.techTags.' + k, p));
  // 相手を動けなくする状態（寝首かき の vs）
  const DISABLE = ['sleep', 'paralyze', 'freeze', 'stun'];

  /** 技（または術）a → 特徴の言葉の配列（並び: 先制 → 回数 → 属性 → 守り・会心・必中 → 相手の種類 → 状態・弱体 → 支え） */
  function techTags(a) {
    if (!a || !Array.isArray(a.effects)) return [];
    const DB = R.DB || {};
    const Ru = R.Rules || {};
    const W = (DB.weaponTypes && DB.weaponTypes[a.wtype]) || null;
    const out = [];
    const add = (s) => { if (s && !out.includes(s)) out.push(s); };
    const effs = a.effects;
    const dmg = effs.filter((e) => e.type === 'damage');
    if (a.quick) add(T('quick'));
    if (a.kind === 'tech' && a.reach && W && !W.reach) add(T('reach'));
    for (const e of dmg) {
      const h = Array.isArray(e.hits) ? e.hits[1] : e.hits | 0;
      if (h > 1) add(T('hits', { n: h }));
      if (e.element && Ru.ELEMENT_NAMES && Ru.ELEMENT_NAMES[e.element]) add(String(Ru.ELEMENT_NAMES[e.element]));
      const ig = e.ignoreDef === true ? 1 : +e.ignoreDef || 0;
      if (ig >= 1) add(T('ignoreDef'));
      else if (ig >= 0.5) add(T('halfDef'));
      if ((e.critBonus || 0) >= 10) add(T('crit'));
      if (e.sure) add(T('sure'));
      if (e.acc != null && e.acc < 1) add(T('heavy'));
      if (e.kind && W && W.kind && e.kind !== W.kind && a.kind === 'tech') add(T('kind_' + e.kind));
      if (e.vs) {
        const ks = Object.keys(e.vs).filter((k) => e.vs[k] > 1);
        if (ks.length && ks.every((k) => DISABLE.includes(k))) add(T('vsDisabled'));
        else for (const k of ks) add(T(k === 'flying' ? 'vsFlying' : k === 'undead' ? 'vsUndead' : 'vsOther'));
      }
      if (e.metalHit) add(T('metal'));
      if (e.drain) add(T('drain'));
      if (e.hpCost) add(T('hpCost'));
    }
    for (const e of effs) {
      if (e.type === 'status') {
        if (e.status === 'counter') add(T('counter'));
        else {
          const sd = DB.statuses && DB.statuses[e.status];
          if (sd && sd.bad) add(String(sd.name));
        }
      } else if (e.type === 'cover') add(T('cover'));
      else if (e.type === 'buff') {
        const nm = (Ru.DIFF_NAMES && Ru.DIFF_NAMES[e.stat]) || e.stat;
        const st = e.stages || 1;
        add(T(st < 0 ? (st <= -2 ? 'down2' : 'down') : 'up', { stat: String(nm) }));
      } else if (e.type === 'dispel') add(T('dispel'));
      else if (e.type === 'steal') add(T('steal'));
      else if (e.type === 'heal') add(T('heal'));
      else if (e.type === 'healMp') add(T('healMp'));
      else if (e.type === 'cure') add(T('cure'));
    }
    return out;
  }
  /** 言葉をつないだ 1 行（無ければ ''） */
  function techTagLine(a) { const t = techTags(a); return t.length ? t.join(T('sep')) : ''; }

  const Ru = (R.Rules = R.Rules || {});
  Ru.techTags = techTags;
  Ru.techTagLine = techTagLine;
})(window.RPG);
