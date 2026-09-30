// RULES・EVENTS（オルビス高原）: 高原の大事な物・一品物（WORLD_REDESIGN §4.8・§2.7 #19・§2.8、STORY_BIBLE §7.8）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   潜入の準備: 鍵の組み合わせのメモ（学生 3 人から 1 つずつ）・夜番の日誌（見回りの順番）・学院の制服（仕立屋で買う／洗濯場で借りる）。
//   保管庫: 星図（k_star_chart、items_key.js）と封鎖の命令書（学長に渡す／黙って戻す）。黙って戻すと学長から星図の写し（寄り道 3 か所の印）。
//   星のかけら（星降りのくぼ地 #19。宝の地図その6を読むのに要る）。依頼: 星灯の油・学生の落とし物・恋文。
//   学者の長衣（こっそり＋黙る）、星見の羅針（星見 3 段）、試験の飾りひも（学院の試験）。
//   高原は好きな順で来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ。片眼鏡 ac_tale_star は締めの礼）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_vault_code: K(R.T('data.items_star.KEYS.k_vault_code.K'), R.T('data.items_star.KEYS.k_vault_code.K_2'), { icon: 'journal' }),
    k_patrol_log: K(R.T('data.items_star.KEYS.k_patrol_log.K'), R.T('data.items_star.KEYS.k_patrol_log.K_2'), { icon: 'journal' }),
    k_uniform: K(R.T('data.items_star.KEYS.k_uniform.K'), R.T('data.items_star.KEYS.k_uniform.K_2'), { icon: 'bag' }),
    k_seal_order: K(R.T('data.items_star.KEYS.k_seal_order.K'), R.T('data.items_star.KEYS.k_seal_order.K_2'), { icon: 'journal' }),
    k_star_chart_copy: K(R.T('data.items_star.KEYS.k_star_chart_copy.K'), R.T('data.items_star.KEYS.k_star_chart_copy.K_2'), { icon: 'map' }),
    k_star_shard: K(R.T('data.items_star.KEYS.k_star_shard.K'), R.T('data.items_star.KEYS.k_star_shard.K_2'), { icon: 'gem' }),
    k_star_oil: K(R.T('data.items_star.KEYS.k_star_oil.K'), R.T('data.items_star.KEYS.k_star_oil.K_2'), { icon: 'lamp' }),
    k_silver_pen: K(R.T('data.items_star.KEYS.k_silver_pen.K'), R.T('data.items_star.KEYS.k_silver_pen.K_2'), { icon: 'key' }),
    k_love_letter: K(R.T('data.items_star.KEYS.k_love_letter.K'), R.T('data.items_star.KEYS.k_love_letter.K_2'), { icon: 'journal' }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9600 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // こっそり忍びこみ、命令書を黙って戻したときの学長の礼（WORLD §4.8 の報酬）
    u_scholar_robe: U('body', R.T('items.u_scholar_robe.body'), { weight: 'light', units: 'sv2', mods: { mpRegen: 1, statusResist: { silence: 0.5, confuse: 0.5 } }, icon: 'armor',
      desc: R.T('items.u_scholar_robe.body.desc') }),
    // 星見（天文台の望遠鏡で星座を探す遊び。3 段）の礼
    u_star_compass: U('acc', R.T('items.u_star_compass.acc'), { mods: { spd: 2, escapePct: 10, encounterPct: -5 }, icon: 'ring',
      desc: R.T('items.u_star_compass.acc.desc') }),
    // 学院の試験（伝承の問答）の礼
    u_exam_ribbon: U('head', R.T('items.u_exam_ribbon.head'), { weight: 'light', mods: { glimPct: { tech: 5, spell: 10 } }, icon: 'helm',
      desc: R.T('items.u_exam_ribbon.head.desc') }),
  });
})(window.RPG);
