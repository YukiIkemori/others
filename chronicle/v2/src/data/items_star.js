// RULES・EVENTS（オルビス高原）: 高原の大事な物・一品物（WORLD_REDESIGN §4.8・§2.7 #19・§2.8、STORY_BIBLE §7.8）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   潜入の準備: 鍵の組み合わせのメモ（学生 3 人から 1 つずつ）・夜番の日誌（見回りの順番）・学院の制服（仕立屋で買う／洗濯場で借りる）。
//   保管庫: 星図（k_star_chart、items_key.js）と封鎖の命令書（学長に渡す／黙って戻す）。黙って戻すと学長から星図の写し（寄り道 3 か所の印）。
//   星のかけら（星降りの窪地 #19。宝の地図その6を読むのに要る）。依頼: 星灯の油・学生の落とし物・恋文。
//   学者の長衣（こっそり＋黙る）、星見の羅針（星見 3 段）、試験の飾り紐（学院の試験）。
//   高原は好きな順で来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ。片眼鏡 ac_tale_star は締めの礼）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_vault_code: K('鍵の組み合わせのメモ', '学生たちから聞いた三つの数。\n保管庫の扉の文字盤の組み合わせ。', { icon: 'journal' }),
    k_patrol_log: K('夜番の日誌', '年寄りの守衛の日誌。\n消灯の後の見回りの道と、曲がり角の\nチョークの印が書いてある。', { icon: 'journal' }),
    k_uniform: K('学院の制服', '紺の長衣に星の刺繍。\n着ていれば、夜の廊下で学生に\n会っても騒がれない。', { icon: 'bag' }),
    k_seal_order: K('封鎖の命令書', '「星読みの塔の封鎖を命ず。\n星図は学院の保管庫に移すこと。\n大書記ラザロ」', { icon: 'journal' }),
    k_star_chart_copy: K('星図の写し', '学長が写した星図。高原と海の\n三か所に、小さな星の印がある。', { icon: 'map' }),
    k_star_shard: K('星のかけら', '星降りの窪地の底で見つけた、\n青く冷たいかけら。古い地図の\n星の印を読むのに要るという。', { icon: 'gem' }),
    k_star_oil: K('星灯の油', '天文台の星灯の塔に運ぶ、\n青く澄んだ油。', { icon: 'lamp' }),
    k_silver_pen: K('銀の羽ペン', '学生の落とし物。\n軸に小さく名前が彫ってある。', { icon: 'key' }),
    k_love_letter: K('恋文', '学生から預かった手紙。\n封には、つたない星の絵。', { icon: 'journal' }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9600 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // こっそり忍びこみ、命令書を黙って戻したときの学長の礼（WORLD §4.8 の報酬）
    u_scholar_robe: U('body', '学者の長衣', { weight: 'light', units: 'sv2', mods: { mpRegen: 1, statusResist: { silence: 0.5, confuse: 0.5 } }, icon: 'armor',
      desc: 'オクタヴィアが若いころに着た長衣。\n沈黙と混乱に強く、魔力が少しずつ戻る。' }),
    // 星見（天文台の望遠鏡で星座を探す遊び。3 段）の礼
    u_star_compass: U('acc', '星見の羅針', { mods: { spd: 2, escapePct: 10, encounterPct: -5 }, icon: 'ring',
      desc: '針のかわりに小さな星が北を指す。\n逃げやすく、魔物に会いにくい。' }),
    // 学院の試験（伝承の問答）の礼
    u_exam_ribbon: U('head', '試験の飾り紐', { weight: 'light', mods: { glimPct: { tech: 5, spell: 10 } }, icon: 'helm',
      desc: '試験に通った学生が髪に結ぶ紐。\n技と術を閃きやすい。' }),
  });
})(window.RPG);
