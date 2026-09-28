// RULES・EVENTS（湿原）: グレイモア湿原の大事な物・一品物（WORLD_REDESIGN §4.4、STORY_BIBLE §7.4）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   探偵の帽子（一度で正しく名指しした）と、詫びの鈴（間違えて名指しした後の町のお詫び）は同じ強さの別の品（§3.5-2）。
//   湿原はどのティアでも来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。探偵の帽子は「見抜く」守りにした。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  R.defs('items', {
    u_sleuth_hat: U('head', '探偵の帽子', { weight: 'light', mods: { statusResist: { confuse: 1, blind: 0.5 }, hpPct: 4 }, icon: 'helm',
      desc: '混乱しない。暗闇にかかりにくい。\n霧のまねごとを見抜いた者の帽子。' }),
    u_apology_bell: U('acc', '詫びの鈴', { mods: { statusResist: { sleep: 1, blind: 0.5 }, hpPct: 4 }, icon: 'ring',
      desc: '眠らない。暗闇にかかりにくい。\n町が罪なき人に贈った小さな鈴。' }),
    // 大事な物
    k_bell_key: K('鐘の鍵', 'メルダから受け取った、\n沼の鐘を鳴らす古い青銅の鍵。', { icon: 'key' }),
    k_blank_score: K('白紙の楽譜', '記録院から返ってきた鐘の歌の楽譜。\n五線だけで、音符がひとつもない。', { icon: 'book' }),
    k_ink_score: K('墨の楽譜', 'クラウスが、メルダの歌を聞き取って\n墨で書き直した鐘の歌の楽譜。', { icon: 'book' }),
    k_lost_cat: K('迷い猫', '夜の高床の下で見つけた猫。\n首輪に「ミーナ」とある。', { icon: 'bag' }),
    k_canal_oil: K('灯籠の油', '灯籠守のヨストから預かった油の小びん。\n運河の灯籠をともすのに使う。', { icon: 'lamp' }),
  });
})(window.RPG);
