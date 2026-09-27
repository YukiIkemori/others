// 雪原（ユール・白竜の峰・寄り道）の品（RULES の形。WORLD_REDESIGN §4.3・§2.7 #11・#13、STORY_BIBLE §7.3）
//   伸びる一品物 u_*: 数値はもらったときのティア（items_unique.js と同じ決め方）。竜の牙の剣と竜の鱗のお守りは同じ強さの別の品（§3.5-2）。
//   大事な物 k_*: 支度の 3 つ・籠城・峰の火種・寄り道の依頼で使う。
(function (R) {
  'use strict';
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  R.defs('items', {
    // 竜と戦う／語る（どちらを選んでも同じ強さ）
    u_dragon_fang: U('weapon', '竜の牙の剣', { wtype: 'sword', units: 's2', mult: 1.25, crit: 3, vs: { dragon: 1.5 }, icon: 'sword',
      desc: '竜に大きなダメージ。会心が出やすい。\n白竜の抜けた牙から打った剣。' }),
    u_dragon_scale: U('acc', '竜のうろこのお守り', { mods: { elemResist: { water: 0.5, wind: 0.5 }, hpPct: 6 }, icon: 'ring',
      desc: '水と風の攻撃を半分に。最大HPが上がる。\n白竜が託した一枚のうろこ。' }),
    // つららの回廊（#11）・氷に閉じた帆船（#13）
    u_icicle_spear: U('weapon', 'つららの細剣', { wtype: 'sword', units: 's2', mult: 1.15, hit: 6, element: 'water', icon: 'sword',
      desc: '水の力をもつ。よく当たる。\n溶けないつららを研いだ細身の剣。' }),
    u_frost_compass: U('acc', '凍えの羅針盤', { mods: { preemptPct: 15, statusResist: { freeze: 1 }, elemResist: { water: 0.5 } }, icon: 'ring',
      desc: '先制しやすい。凍結が効かない。\n水の攻撃を半分に。氷の船団の羅針盤。' }),
    // 釣り大会の一等（段位ごとの品のいちばん上）
    u_ice_rod_charm: U('acc', '氷上の釣り名人の証', { mods: { rareEncPct: 25, goldPct: 10 }, icon: 'ring',
      desc: '珍しい魔物に出会いやすい。\nお金が少し増える。' }),
    // 大事な物
    k_yule_logs: K('大火祭の薪', '雪の林で集めた、よく乾いた倒木の薪。\n大かまどにくべる。', { icon: 'fire' }),
    k_ice_saw: K('氷切りのこぎり', '釣り小屋のじいさまに借りた、\n氷を切り出すのこぎり。', { icon: 'key' }),
    k_ice_blocks: K('氷の灯籠の氷', '凍った池から切り出した、\n澄んだ氷のかたまり。', { icon: 'gem' }),
    k_blank_book: K('白紙の祭の本', '大火祭で読む物語の本。\n中身が真っ白に抜けている。', { icon: 'book' }),
    k_yule_ember: K('冬至の火のおすそ分け', '大灯火になった冬至の火を分けた火種。\n消えた道しるべの灯籠にともせる。', { icon: 'lamp' }),
    k_hotspring_key: K('湯殿の鍵', '峠の宿の湯殿の、古い鍵。', { icon: 'key' }),
    k_fox_charm: K('氷尾ギツネの毛', '峠の道で拾った、青白く光る獣の毛。', { icon: 'search' }),
  });
})(window.RPG);
