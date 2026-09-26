// items_armor.js — gear-a (A10a). Normal armor: 30 lines × T0–T9 = 300 (DESIGN §8.4.2), and the shared finishing
// code of every gear-a data file (R.GearA). Numbers (def mdef eva stats price) and the normal-item desc are made by
// R.Rules.fillItem / R.Rules.autoDesc in R.onData (§8.2.9, §8.2.7); until rules provides them the same formulas run
// here (R.GearA.localFill, constants of §4.3.1 / §4.18.1). Data only carries tier / grade / units / weight / line.
//
// Load order: items_acc_*.js < items_acc.js < items_armor_*.js < items_armor.js (localeCompare puts '_' before '.'),
// so the other gear-a files must not call R.GearA at load time — they register plain objects and call
// R.GearA.finish(ids) from their own R.onData hook, which runs after every file has loaded.
(function (R) {
  'use strict';
  const G = (R.GearA = R.GearA || {});

  // ------------------------------------------------------------------ constants (fallback for R.Rules.K)
  const K0 = {
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
    D: (T) => 70 + 30 * T,
    PRICE: [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600],
    GRADE_MULT: { normal: 1, rare: 2, super: 3 },
    WEIGHT: { heavy: { def: 1, mdef: 0.2, eva: 8 }, light: { def: 0.65, mdef: 0.35, eva: 5 }, cloth: { def: 0.4, mdef: 0.6, eva: 2 } },
    SLOT_SHARE: { shield: 0.20, head: 0.15, body: 0.40, hands: 0.10, feet: 0.15 },
    PRICE_SLOT: { weapon: 1.6, body: 1.4, shield: 1.0, head: 0.8, hands: 0.6, feet: 0.6, acc: 1.2 },
  };
  G.K0 = K0;
  /** the constants in use: R.Rules.K where it has them, else §4.3.1 */
  G.K = function () {
    const K = (R.Rules && R.Rules.K) || {};
    const o = {};
    for (const k in K0) o[k] = K[k] !== undefined ? K[k] : K0[k];
    return o;
  };
  const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
  const STAT_NAME = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const WEIGHT_TEXT = { heavy: '重くて守りが固い。', light: '軽くて動きやすい。', cloth: '術から身を守る。' };

  /** §8.2.7 desc of a normal armor / accessory: 重さの文（アクセは「身につける飾り。」）＋「〇が上がる。」 */
  G.localAutoDesc = function (it) {
    const l1 = it.type === 'acc' ? '身につける飾り。' : (WEIGHT_TEXT[it.weight] || '');
    const up = Object.keys(it.stats || {}).filter((k) => it.stats[k] > 0).map((k) => STAT_NAME[k]);
    return up.length ? `${l1}\n${up.join('と')}が上がる。` : l1;
  };
  /** §8.2.9 for armor and accessories (the weapon part is weapons' own). Values already written are kept. */
  G.localFill = function (it) {
    const K = G.K(), T = it.tier || 0, g = it.grade || 'normal', GM = K.GRADE_MULT[g];
    const U1 = (u) => Math.max(1, Math.round(u * K.U[T])) * GM;
    if (it.units && !it.stats) {
      it.stats = {};
      for (const m of it.units.matchAll(/([svdaim])(\d)/g)) it.stats[SK[m[1]]] = U1(+m[2]);
      for (const [k, v] of Object.entries(it.statsAdd || {})) it.stats[k] = (it.stats[k] || 0) + v;
    }
    if (K.SLOT_SHARE[it.type] !== undefined) {
      const wt = K.WEIGHT[it.weight], D = K.D(T), sh = K.SLOT_SHARE[it.type];
      if (it.def === undefined) it.def = Math.round(sh * D * wt.def);
      if (it.mdef === undefined) it.mdef = Math.round(sh * D * wt.mdef);
      if (it.type === 'shield' && it.eva === undefined) it.eva = wt.eva;
    }
    if (it.price === undefined && it.type !== 'consumable' && it.type !== 'key')
      it.price = Math.round(K.PRICE[T] * K.PRICE_SLOT[it.type] / 10) * 10 * { normal: 1, rare: 3, super: 6 }[g];
    if (!it.desc) it.desc = ((R.Rules && typeof R.Rules.autoDesc === 'function') ? R.Rules.autoDesc : G.localAutoDesc)(it);
    return it;
  };
  const SORT_OFF = (it) => (it.src === 'relic' || it.src === 'reward' ? 90 : it.grade === 'super' ? 70 : it.grade === 'rare' ? 50 : 10);
  /** every gear-a id, by the kind of the file that registered it (tools/test_gear.js reads this) */
  G.owned = G.owned || {};
  /**
   * Finish the items of one gear-a file (called from its R.onData): default `sort` (§8.2.1: tier × 100 + line,
   * rare +50, super +70, relic / reward +90), then the numbers with R.Rules.fillItem (or the local copy).
   */
  G.finish = function (ids, kind) {
    const fill = (R.Rules && typeof R.Rules.fillItem === 'function') ? R.Rules.fillItem : G.localFill;
    G.owned[kind] = (G.owned[kind] || []).concat(ids);
    ids.forEach((id, i) => {
      const it = R.DB.items[id];
      if (!it) return;
      try {
        if (it.sort === undefined) it.sort = (it.tier || 0) * 100 + SORT_OFF(it) + i / 100;
        fill(it);
      } catch (e) { R.loadErrors.push(`gear-a fillItem ${id}: ${e && e.message}`); }
    });
  };

  // ------------------------------------------------------------------ normal armor (§8.1.2 order = shop / list order)
  // [line, type, weight, units, T0 fixed id (04 chapter's starting gear), names T0 … T9]
  // heavy = 腕力 / 体力, light = 器用さ / 素早さ, cloth = 知力 / 精神 (§4.3.3); body 2 units, the rest 1.
  const LINES = [
    ['bd_mail', 'body', 'heavy', 's2', 'bd_iron_cuirass', ['鉄の胸当て', '鋼の鎧', '黒鋼の鎧', '銀の鎧', '青鋼の鎧', '竜骨の鎧', '聖銀の鎧', '金剛の鎧', '星鉄の鎧', '天鋼の鎧']],
    ['bd_plate', 'body', 'heavy', 'v2', null, ['鉄の大鎧', '鋼の大鎧', '黒鋼の大鎧', '銀の大鎧', '青鋼の大鎧', '竜骨の大鎧', '聖銀の大鎧', '金剛の大鎧', '星鉄の大鎧', '天鋼の大鎧']],
    ['bd_vest', 'body', 'light', 'd2', 'bd_leather_vest', ['革の胴着', '硬革の胴着', '鹿革の胴着', '狼革の胴着', '蛇革の胴着', '飛竜革の胴着', '霊獣革の胴着', '竜革の胴着', '月狼革の胴着', '天馬革の胴着']],
    ['bd_garb', 'body', 'light', 'a2', null, ['革の装束', '硬革の装束', '鹿革の装束', '狼革の装束', '蛇革の装束', '飛竜革の装束', '霊獣革の装束', '竜革の装束', '月狼革の装束', '天馬革の装束']],
    ['bd_robe', 'body', 'cloth', 'i2', 'bd_hemp_robe', ['麻の法衣', '綿のローブ', '絹のローブ', '魔絹のローブ', '月絹のローブ', '精霊絹のローブ', '星絹のローブ', '聖絹のローブ', '天絹のローブ', '虹絹のローブ']],
    ['bd_habit', 'body', 'cloth', 'm2', null, ['麻の僧衣', '綿の僧衣', '絹の僧衣', '魔絹の僧衣', '月絹の僧衣', '精霊絹の僧衣', '星絹の僧衣', '聖絹の僧衣', '天絹の僧衣', '虹絹の僧衣']],
    ['hd_helm', 'head', 'heavy', 's1', null, ['鉄の兜', '鋼の兜', '黒鋼の兜', '銀の兜', '青鋼の兜', '竜骨の兜', '聖銀の兜', '金剛の兜', '星鉄の兜', '天鋼の兜']],
    ['hd_band', 'head', 'heavy', 'v1', 'hd_iron_band', ['鉄の額当て', '鋼の額当て', '黒鋼の額当て', '銀の額当て', '青鋼の額当て', '竜骨の額当て', '聖銀の額当て', '金剛の額当て', '星鉄の額当て', '天鋼の額当て']],
    ['hd_cap', 'head', 'light', 'd1', 'hd_leather_cap', ['革の帽子', '硬革の帽子', '鹿革の帽子', '狼革の帽子', '蛇革の帽子', '飛竜革の帽子', '霊獣革の帽子', '竜革の帽子', '月狼革の帽子', '天馬革の帽子']],
    ['hd_scarf', 'head', 'light', 'a1', null, ['革の鉢巻き', '硬革の鉢巻き', '鹿革の鉢巻き', '狼革の鉢巻き', '蛇革の鉢巻き', '飛竜革の鉢巻き', '霊獣革の鉢巻き', '竜革の鉢巻き', '月狼革の鉢巻き', '天馬革の鉢巻き']],
    ['hd_hat', 'head', 'cloth', 'i1', null, ['麻の三角帽', '綿の三角帽', '絹の三角帽', '魔絹の三角帽', '月絹の三角帽', '精霊絹の三角帽', '星絹の三角帽', '聖絹の三角帽', '天絹の三角帽', '虹絹の三角帽']],
    ['hd_hood', 'head', 'cloth', 'm1', 'hd_wool_hood', ['毛織りの頭巾', '綿の頭巾', '絹の頭巾', '魔絹の頭巾', '月絹の頭巾', '精霊絹の頭巾', '星絹の頭巾', '聖絹の頭巾', '天絹の頭巾', '虹絹の頭巾']],
    ['sh_buckler', 'shield', 'heavy', 's1', 'sh_iron_buckler', ['鉄の小盾', '鋼の小盾', '黒鋼の小盾', '銀の小盾', '青鋼の小盾', '竜骨の小盾', '聖銀の小盾', '金剛の小盾', '星鉄の小盾', '天鋼の小盾']],
    ['sh_tower', 'shield', 'heavy', 'v1', null, ['鉄の大盾', '鋼の大盾', '黒鋼の大盾', '銀の大盾', '青鋼の大盾', '竜骨の大盾', '聖銀の大盾', '金剛の大盾', '星鉄の大盾', '天鋼の大盾']],
    ['sh_shield', 'shield', 'light', 'd1', 'sh_leather', ['革の盾', '硬革の盾', '鹿革の盾', '狼革の盾', '蛇革の盾', '飛竜革の盾', '霊獣革の盾', '竜革の盾', '月狼革の盾', '天馬革の盾']],
    ['sh_round', 'shield', 'light', 'a1', null, ['木の円盾', '堅木の円盾', '鹿角の円盾', '狼牙の円盾', '蛇骨の円盾', '飛竜の円盾', '霊木の円盾', '竜骨の円盾', '月狼の円盾', '天馬の円盾']],
    ['sh_book', 'shield', 'cloth', 'i1', 'sh_primer', ['術の手引き', '初歩の術書', '学徒の術書', '古びた術書', '月の術書', '精霊の術書', '星の術書', '聖なる術書', '天の術書', '虹の術書']],
    ['sh_charm', 'shield', 'cloth', 'm1', null, ['木の護符', '銅の護符', '銀の護符', '白樺の護符', '月の護符', '精霊の護符', '星の護符', '聖なる護符', '天の護符', '虹の護符']],
    ['hn_gauntlet', 'hands', 'heavy', 's1', null, ['鉄の籠手', '鋼の籠手', '黒鋼の籠手', '銀の籠手', '青鋼の籠手', '竜骨の籠手', '聖銀の籠手', '金剛の籠手', '星鉄の籠手', '天鋼の籠手']],
    ['hn_bracer', 'hands', 'heavy', 'v1', null, ['鉄のガントレット', '鋼のガントレット', '黒鋼のガントレット', '銀のガントレット', '青鋼のガントレット', '竜骨のガントレット', '聖銀のガントレット', '金剛のガントレット', '星鉄のガントレット', '天鋼のガントレット']],
    ['hn_glove', 'hands', 'light', 'd1', null, ['革の手袋', '硬革の手袋', '鹿革の手袋', '狼革の手袋', '蛇革の手袋', '飛竜革の手袋', '霊獣革の手袋', '竜革の手袋', '月狼革の手袋', '天馬革の手袋']],
    ['hn_armlet', 'hands', 'light', 'a1', null, ['革の腕当て', '硬革の腕当て', '鹿革の腕当て', '狼革の腕当て', '蛇革の腕当て', '飛竜革の腕当て', '霊獣革の腕当て', '竜革の腕当て', '月狼革の腕当て', '天馬革の腕当て']],
    ['hn_longglove', 'hands', 'cloth', 'i1', null, ['麻の長手袋', '綿の長手袋', '絹の長手袋', '魔絹の長手袋', '月絹の長手袋', '精霊絹の長手袋', '星絹の長手袋', '聖絹の長手袋', '天絹の長手袋', '虹絹の長手袋']],
    ['hn_mitten', 'hands', 'cloth', 'm1', null, ['麻のミトン', '綿のミトン', '絹のミトン', '魔絹のミトン', '月絹のミトン', '精霊絹のミトン', '星絹のミトン', '聖絹のミトン', '天絹のミトン', '虹絹のミトン']],
    ['ft_greave', 'feet', 'heavy', 's1', null, ['鉄のグリーブ', '鋼のグリーブ', '黒鋼のグリーブ', '銀のグリーブ', '青鋼のグリーブ', '竜骨のグリーブ', '聖銀のグリーブ', '金剛のグリーブ', '星鉄のグリーブ', '天鋼のグリーブ']],
    ['ft_shin', 'feet', 'heavy', 'v1', null, ['鉄のすね当て', '鋼のすね当て', '黒鋼のすね当て', '銀のすね当て', '青鋼のすね当て', '竜骨のすね当て', '聖銀のすね当て', '金剛のすね当て', '星鉄のすね当て', '天鋼のすね当て']],
    ['ft_boots', 'feet', 'light', 'd1', null, ['革のブーツ', '硬革のブーツ', '鹿革のブーツ', '狼革のブーツ', '蛇革のブーツ', '飛竜革のブーツ', '霊獣革のブーツ', '竜革のブーツ', '月狼革のブーツ', '天馬革のブーツ']],
    ['ft_shoes', 'feet', 'light', 'a1', null, ['革の靴', '硬革の靴', '鹿革の靴', '狼革の靴', '蛇革の靴', '飛竜革の靴', '霊獣革の靴', '竜革の靴', '月狼革の靴', '天馬革の靴']],
    ['ft_slipper', 'feet', 'cloth', 'i1', null, ['麻の布靴', '綿の布靴', '絹の布靴', '魔絹の布靴', '月絹の布靴', '精霊絹の布靴', '星絹の布靴', '聖絹の布靴', '天絹の布靴', '虹絹の布靴']],
    ['ft_sandal', 'feet', 'cloth', 'm1', null, ['麻のサンダル', '綿のサンダル', '絹のサンダル', '魔絹のサンダル', '月絹のサンダル', '精霊絹のサンダル', '星絹のサンダル', '聖絹のサンダル', '天絹のサンダル', '虹絹のサンダル']],
  ];
  G.ARMOR_LINES = LINES.map(([line, type, weight, units]) => ({ line, type, weight, stat: SK[units[0]] }));
  const ITEMS = {};
  const nth = {};
  for (const [line, type, weight, units, t0, names] of LINES) {
    const li = (nth[type] = nth[type] === undefined ? 0 : nth[type] + 1);          // line number within its type
    names.forEach((name, T) => {
      ITEMS[T === 0 && t0 ? t0 : `${line}_${T}`] = { name, type, weight, grade: 'normal', tier: T, units, line, src: 'shop', sort: T * 100 + li };
    });
  }

  // §8.13.1 build sets (9 positions: weapon1 weapon2 shield head body hands feet acc1 acc2) for the Z / N / R / S models
  // of qa's tools/lib/party_model.js (gear 'shop' = N, 'rare' = R7 / R9, 'super' = S; §8.15). Weapons are weapons' ids.
  G.BUILD_SETS = {
    int: {
      N: ['w_staff_8', 'w_staff_8', 'sh_book_8', 'hd_hat_8', 'bd_robe_8', 'hn_longglove_8', 'ft_slipper_8', 'ac_int_8', 'ac_int_8'],
      R7: ['w_staff_r7', 'w_staff_r7b', 'sh_r7_int', 'hd_r7_int', 'bd_r7_int', 'hn_r7_int', 'ft_r7_int', 'ac_r7_int', 'ac_r7_int'],
      R9: ['w_staff_r9', 'w_staff_r9b', 'sh_r9_int', 'hd_r9_int', 'bd_r9_int', 'hn_r9_int', 'ft_r9_int', 'ac_r9_int', 'ac_r9_int'],
      S: ['w_staff_sr_cosmos', 'w_staff_sr_moon', 'sh_sr_blank', 'hd_sr_dusk', 'bd_sr_starry', 'hn_sr_words', 'ft_sr_cloud', 'ac_sr_owl', 'ac_sr_ink'],
    },
    str: {
      N: ['w_sword_8', 'w_sword_8', 'sh_buckler_8', 'hd_helm_8', 'bd_mail_8', 'hn_gauntlet_8', 'ft_greave_8', 'ac_str_8', 'ac_str_8'],
      R7: ['w_sword_r7', 'w_axe_r7', 'sh_r7_str', 'hd_r7_str', 'bd_r7_str', 'hn_r7_str', 'ft_r7_str', 'ac_r7_str', 'ac_r7_str'],
      R9: ['w_sword_r9', 'w_axe_r9', 'sh_r9_str', 'hd_r9_str', 'bd_r9_str', 'hn_r9_str', 'ft_r9_str', 'ac_r9_str', 'ac_r9_str'],
      S: ['w_sword_sr_hegemon', 'w_axe_sr_titan', 'sh_sr_steadfast', 'hd_sr_oni', 'bd_sr_dragonhide', 'hn_sr_mighty', 'ft_sr_quake', 'ac_sr_beastheart', 'ac_sr_bloodoath'],
    },
    dex: {
      N: ['w_dagger_8', 'w_dagger_8', 'sh_shield_8', 'hd_cap_8', 'bd_vest_8', 'hn_glove_8', 'ft_boots_8', 'ac_dex_8', 'ac_dex_8'],
      R7: ['w_dagger_r7', 'w_dagger_r7', 'sh_r7_dex', 'hd_r7_dex', 'bd_r7_dex', 'hn_r7_dex', 'ft_r7_dex', 'ac_r7_dex', 'ac_r7_dex'],
      R9: ['w_dagger_r9', 'w_dagger_r9', 'sh_r9_dex', 'hd_r9_dex', 'bd_r9_dex', 'hn_r9_dex', 'ft_r9_dex', 'ac_r9_dex', 'ac_r9_dex'],
      S: ['w_dagger_sr_moonfang', 'w_dagger_sr_silk', 'sh_sr_phantom', 'hd_sr_heaveneye', 'bd_sr_shadow', 'hn_sr_hundred', 'ft_sr_whirl', 'ac_sr_eagle', 'ac_sr_needle'],
    },
  };
  G.BUILD_SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];

  // register now (ids must exist for other owners' load-time checks); numbers are filled in R.onData
  for (const id in ITEMS) {
    if (R.DB.items[id]) R.loadErrors.push('items_armor: duplicate item id ' + id);
    R.DB.items[id] = ITEMS[id];
  }
  R.onData(() => G.finish(Object.keys(ITEMS), 'normal'));
})(window.RPG);
