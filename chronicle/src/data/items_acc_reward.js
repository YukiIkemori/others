// items_acc_reward.js — gear-a (A10a). Story-reward accessories (11).
// Numbers (def mdef eva stats price) are filled by R.Rules.fillItem in R.onData (DESIGN §8.2.9); the data
// only carries tier / grade / units / weight. Spec: DESIGN §8 (definitions) and §9.12 (monster → item).
(function (R) {
  'use strict';
  // Story rewards (DESIGN §8.8): one of each (unique, price 0 = cannot be sold), given by ev.give('<id>') in the
  // event named in the comment (once = that event id; the two rival duels give theirs in story_after_clear when
  // st_rival_won1 / st_rival_won2 is set). No stats (mods only), so every region's reward is worth the same in any
  // order. The rival's second reward, hn_rival_bracer, is in items_armor_rare.js.
  const ITEMS = {
    // once: lute_otto_reward
    ac_otto_lantern: { name: '灯台守のランタン', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { glimPct: { tech: 10, spell: 10 }, /* クセ */ encounterPct: 50 },
      price: 0,
      desc: '技と術を閃きやすい。ただし魔物を呼ぶ。' },
    // once: fern_hanna_reward
    ac_tale_forest: { name: '木霊の首飾り', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { mndPct: 10, regen: true, /* クセ */ elemResist: { fire: 1.25 } },
      price: 0,
      desc: '精神が割合で上がる。HPが戻る。\nただし火に弱くなる。' },
    // once: kasim_abul_reward
    ac_tale_desert: { name: '砂王の印章', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { strPct: 10, goldPct: 20, /* クセ */ expPct: -25 },
      price: 0,
      desc: '腕力が割合で上がる。お金が増える。\nただし経験値が減る。' },
    // once: yule_jorn_reward
    ac_tale_snow: { name: '冬至の火の守り', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { vitPct: 10, statusImmune: ['freeze', 'burn'], /* クセ */ mdefPct: -25 },
      price: 0,
      desc: '凍結・やけどが効かない。\n体力が割合で上がる。ただし術防が下がる。' },
    // once: loch_tobias_reward
    ac_tale_marsh: { name: '朝の鐘の守り', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { agiPct: 10, statusImmune: ['confuse'], /* クセ */ elemResist: { dark: 1.25 } },
      price: 0,
      desc: '素早さが割合で上がる。混乱が効かない。\nただし闇に弱くなる。' },
    // once: nerei_marina_reward
    ac_tale_isles: { name: '潮騒の耳飾り', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { dexPct: 10, wpRegen: 1, /* クセ */ mpCostPct: 25 },
      price: 0,
      desc: '器用さが割合で上がる。WPが戻る。\nただしMPの消費が増える。' },
    // once: dovan_borg_reward
    ac_tale_mine: { name: '誓いの腕輪', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { hpPct: 15, defPct: 15, /* クセ */ spd: -15 },
      price: 0,
      desc: '最大HPが上がる。守備力が上がる。\nただし動きが遅くなる。' },
    // once: caldera_kaya_reward
    ac_tale_ash: { name: '残り火の宝珠', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { intPct: 10, elemBoost: { fire: 20 }, /* クセ */ elemResist: { water: 1.25 } },
      price: 0,
      desc: '知力が割合で上がる。火の攻撃が強くなる。\nただし水に弱くなる。' },
    // once: orbis_octavia_reward
    ac_tale_star: { name: '星読みの片眼鏡', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { rareEncPct: 20, rarePct: 20, /* クセ */ goldPct: -25 },
      price: 0,
      desc: 'めずらしい魔物に出会いやすい。\nレアをよく落とす。ただしお金が減る。' },
    // once: st_rival_won1
    ac_rival_pen: { name: '記録院の銀筆', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { mpCostPct: -15, wpCostPct: -15, /* クセ */ mdefPct: -25 },
      price: 0,
      desc: '術のMPの消費が減る。技のWPの消費が減る。\nただし術防が下がる。' },
    // once: roa_berna_gift
    ac_berna_charm: { name: '語り部の首飾り', type: 'acc', grade: 'rare', tier: 0, src: 'reward', unique: true, quirk: true,
      mods: { glimPct: { tech: 15, spell: 15 }, statusImmune: ['sleep', 'confuse'], /* クセ */ hpPct: -10 },
      price: 0,
      desc: '閃きやすい。眠り・混乱が効かない。\nただし最大HPが下がる。' },
  };

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_acc_reward: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => {
    if (!R.GearA || !R.GearA.finish) { R.loadErrors.push('items_acc_reward: items_armor.js (R.GearA) did not load'); return; }
    R.GearA.finish(Object.keys(ITEMS), 'reward');
  });
})(window.RPG);
