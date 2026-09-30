// RULES・EVENTS（マレア諸島）: 諸島の大事な物・一品物（WORLD_REDESIGN §4.5・§2.8、STORY_BIBLE §7.5）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）。
//   光る貝がら（潮鳴りの洞窟の奥。外洋船の船首に付ける習わし）・港の親方の海図（空白が 4 つ）・墨の写し（六十年前、写し手アルノ）・
//   灯台の油（灯り守りから。灯台島の灯室へ）・組合の荷（配達の依頼）・宝の地図 その4（座礁した商船の船長。助けたとき）。
//   人魚のくし（人魚の歌う岩 #34）と、その対の待つ人のくし（岩の節を聞いてからマリナに会うと）・夜光貝の守り（貝がら 12）・旗の見習いの襟巻き（旗信号の試験）。
//   諸島は好きな順で来られる（T1 から）: レアの率・落とす率の品は置かない（持ち主の決まり: 中盤より後だけ）。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_glow_shell: K('光る貝がら', '夜光虫の光をためた白い貝がら。\n船首に付けると、霧でも帆が張れる。', { icon: 'gem' }),
    k_sea_chart: K('港の親方の海図', '幽霊船の出る海のまわりに、空白が\n4つある海図。船で行くと埋まる。', { icon: 'map' }),
    k_ink_copy: K('墨の写し', 'グレン船長の航海日誌を、六十年前に\n墨で写した控え。写し手はアルノ。', { icon: 'journal' }),
    k_lamp_oil: K('灯台の油', 'ネレイの灯り守りの魚油のつぼ。\n灯台島の灯室のランプにさす。', { icon: 'lamp' }),
    k_guild_parcel: K('組合の荷', '船乗り組合から預かった、\nネレイの雑貨屋あての包み。', { icon: 'bag' }),
    k_tmap_4: K('宝の地図・その4', '商船の船長がくれた古い地図。\n水に沈んだ礼拝堂の絵がある。', { icon: 'map', tmap: { n: 4, place: 'sunken_chapel', region: 'r_marsh', hint: '沈んだ礼拝堂。祭壇の裏の、\n封じの扉の奥。' } }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9500 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // 人魚の歌う岩（#34）と、その対の品（岩の節を聞いてからマリナに会うと。同じ強さの別の品ではなく、並べて着けられる対）
    u_siren_comb: U('acc', '人魚のくし', { mods: { mpRegen: 1, statusResist: { sleep: 0.5 } }, icon: 'ring',
      desc: '人魚の歌う岩にはさまっていた、\n真珠色のくし。かすかに歌が聞こえる。' }),
    u_shore_comb: U('acc', '待つ人のくし', { mods: { hpPct: 5, statusResist: { confuse: 0.5 } }, icon: 'ring',
      desc: 'マリナが若いころに使った木のくし。\n人魚のくしと同じ波の模様がある。' }),
    // 貝がら集め（12 種）の礼
    u_shell_charm: U('acc', '夜光貝の守り', { mods: { spd: 3, encounterPct: -10 }, icon: 'ring',
      desc: '夜光虫で光る12の貝がらを\n糸でつないだお守り。' }),
    // 旗信号の見習い試験（3 段）の礼
    u_flag_scarf: U('head', '信号旗の襟巻き', { weight: 'light', mods: { escapePct: 15, spd: 2 }, icon: 'helm',
      desc: '旗信号の試験に受かった見習いが\n首に巻く、赤と白の襟巻き。' }),
  });
})(window.RPG);
