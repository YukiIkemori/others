// src/data/items_weapons_rare.js（担当 weapons A9）
// 武器の帯のレア品 59（DESIGN §8.5。grade:'rare'、src:'drop'）。宝箱の p_rare とボスの p_boss だけで手に入る（魔物の枠・店には無い）。
// 帯 T1・T3・T5・T7・T9 のそれぞれに 11 系統が 1 本ずつ（T7・T9 は杖の 2 本目と精神の杖を足して 13 本）。
// 能力値はレア（×2）、攻撃・術は同じティアの通常品と同じ（数値は R.onData で R.WeaponItems.finish → fillItem）。
// 特殊効果 1 つ、クセは 4 本だけ（§8.3.3）。読み込み時はこのファイルの中のコードだけで登録する（§1.2-2。ロード順に依らない）。
// 書き方: B(id, 名前, 系統, T, 特殊効果, クセ, 説明)。特殊効果・クセは §8.5 の表の書き方のまま（武器の項目は品に、ほかは mods に入る）。
(function (R) {
  'use strict';
  const DB = R.DB;
  const WI = (R.WeaponItems = R.WeaponItems || {});
  const ids = ((WI.ids = WI.ids || {}).rare = []);
  // 武器の項目（品に置く。§8.2.2）。ほかのキーは mods（§8.5 の読み方）
  const FIELDS = ['element', 'onHit', 'vs', 'drain', 'crit', 'hit', 'twoHanded', 'sealTech', 'metalHit'];
  const UNITS = { sword: 's2', greatsword: 's2', axe: 's2', dagger: 'd2', bow: 'd2', spear: 's1d1', katana: 's1d1', club: 's1v1', fist: 's1a1', whip: 'd1a1', staff: 'i2' };
  const SERIES = { sword: 0, greatsword: 1, dagger: 2, axe: 3, spear: 4, bow: 5, club: 6, staff: 7, katana: 9, fist: 10, whip: 11 };   // §8.1.2（精神の杖は 8）
  function put(it, fx) {
    for (const [k, v] of Object.entries(fx || {})) {
      if (FIELDS.includes(k)) it[k] = v;
      else { const m = (it.mods = it.mods || {}); m[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign(m[k] || {}, v) : v; }
    }
  }
  const B = (id, name, wtype, tier, fx, q, desc, units) => {
    const it = { name, type: 'weapon', grade: 'rare', tier, wtype, units: units || UNITS[wtype] };
    put(it, fx);
    put(it, q);
    if (q) it.quirk = true;
    it.src = 'drop';
    it.desc = desc.replace(/／/g, '\n');
    it.sort = tier * 100 + (it.units === 'm2' ? 8 : SERIES[wtype]) + 50;   // §8.2.1（レア +50）
    if (DB.items[id]) R.loadErrors.push('weapons: 品の id が重なった ' + id);
    DB.items[id] = it;
    ids.push(id);
  };
  const ON = (status, chance) => ({ onHit: { status, chance } });

  // ---------------------------------------------------------------- レア帯 T1（11）
  B('w_sword_r1', '若葉の剣', 'sword', 1, { element: 'wind' }, null, '風の属性で攻撃する。');
  B('w_greatsword_r1', '木こりの大剣', 'greatsword', 1, { vs: { plant: 1.5 } }, null, '植物に大きなダメージ。');
  B('w_dagger_r1', '蜂の針', 'dagger', 1, ON('poison', 0.3), null, '毒にすることがある。');
  B('w_axe_r1', '熊落としの斧', 'axe', 1, { vs: { beast: 1.5 } }, null, '獣に大きなダメージ。');
  B('w_spear_r1', '鳥追いの槍', 'spear', 1, { vs: { flying: 1.5 } }, null, '飛ぶ敵に大きなダメージ。');
  B('w_bow_r1', '朝露の弓', 'bow', 1, { element: 'water' }, null, '水の属性で攻撃する。');
  B('w_club_r1', '墓守の棍棒', 'club', 1, { vs: { undead: 1.5 } }, null, '不死の魔物に大きなダメージ。');
  B('w_staff_r1', '灯火の杖', 'staff', 1, { elemBoost: { fire: 20 } }, null, '火の攻撃が強くなる。');
  B('w_katana_r1', '山鳥の刀', 'katana', 1, { crit: 10 }, null, '会心が出やすい。');
  B('w_fist_r1', '狐の爪', 'fist', 1, ON('blind', 0.25), null, '目をくらませることがある。');
  B('w_whip_r1', 'しびれ草の鞭', 'whip', 1, ON('paralyze', 0.2), null, 'まひさせることがある。');

  // ---------------------------------------------------------------- レア帯 T3（11）
  B('w_sword_r3', '白銀の騎士剣', 'sword', 3, { element: 'light' }, null, '光の属性で攻撃する。');
  B('w_greatsword_r3', '旋風の大剣', 'greatsword', 3, { element: 'wind' }, null, '風の属性で攻撃する。');
  B('w_dagger_r3', '眠り羽の短剣', 'dagger', 3, ON('sleep', 0.2), null, '眠らせることがある。');
  B('w_axe_r3', '荒くれの斧', 'axe', 3, { crit: 15 }, { defPct: -25 }, '会心が出やすい。ただし守備力が下がる。');
  B('w_spear_r3', '竜狩りの槍', 'spear', 3, { vs: { dragon: 1.5 } }, null, '竜に大きなダメージ。');
  B('w_bow_r3', '静けさの弓', 'bow', 3, ON('silence', 0.3), null, '術を封じることがある。');
  B('w_club_r3', '歯車砕きの槌', 'club', 3, { vs: { construct: 1.5 } }, null, 'からくりに大きなダメージ。');
  B('w_staff_r3', '月しずくの杖', 'staff', 3, { mpRegen: 1 }, null, '戦闘中、MPが少しずつ戻る。');
  B('w_katana_r3', '夕凪の刀', 'katana', 3, ON('stun', 0.15), null, '気絶させることがある。');
  B('w_fist_r3', 'ほむらの拳当て', 'fist', 3, { element: 'fire' }, null, '火の属性で攻撃する。');
  B('w_whip_r3', '惑わしの鞭', 'whip', 3, ON('confuse', 0.15), null, '混乱させることがある。');

  // ---------------------------------------------------------------- レア帯 T5（11）
  B('w_sword_r5', '紅蓮の剣', 'sword', 5, { element: 'fire' }, null, '火の属性で攻撃する。');
  B('w_greatsword_r5', '氷河の大剣', 'greatsword', 5, ON('freeze', 0.15), null, '凍らせることがある。');
  B('w_dagger_r5', '影刺しの短剣', 'dagger', 5, ON('paralyze', 0.2), null, 'まひさせることがある。');
  B('w_axe_r5', '雷鳴の斧', 'axe', 5, ON('stun', 0.2), null, '気絶させることがある。');
  B('w_spear_r5', '潮騒の槍', 'spear', 5, { element: 'water' }, null, '水の属性で攻撃する。');
  B('w_bow_r5', '追い風の弓', 'bow', 5, { element: 'wind' }, null, '風の属性で攻撃する。');
  B('w_club_r5', '聖鐘の槌', 'club', 5, { element: 'light' }, null, '光の属性で攻撃する。');
  B('w_staff_r5', '星詠みの杖', 'staff', 5, { glimPct: { spell: 15 } }, null, '術を閃きやすい。');
  B('w_katana_r5', '残照の刀', 'katana', 5, { drain: 0.1 }, null, '与えた傷の一部を吸い取る。');
  B('w_fist_r5', '虎牙の拳当て', 'fist', 5, { crit: 15 }, null, '会心が出やすい。');
  B('w_whip_r5', '砂けむりの鞭', 'whip', 5, ON('blind', 0.3), null, '目をくらませることがある。');

  // ---------------------------------------------------------------- レア帯 T7（13）
  B('w_sword_r7', '竜断ちの剣', 'sword', 7, { vs: { dragon: 1.5 } }, null, '竜に大きなダメージ。');
  B('w_greatsword_r7', '地鳴りの大剣', 'greatsword', 7, { element: 'earth' }, null, '土の属性で攻撃する。');
  // 表は chance 0.4 だが、§8.3.5 のレアの上限 0.30 に合わせた（報告に書いた）
  B('w_dagger_r7', '黒蛇の牙', 'dagger', 7, ON('poison', 0.3), null, '毒にすることがある。');
  B('w_axe_r7', '巨岩割りの斧', 'axe', 7, { crit: 20 }, { twoHanded: true }, '会心が出やすい。／ただし両手持ちで盾は不可。');
  B('w_spear_r7', '白光の槍', 'spear', 7, { element: 'light' }, null, '光の属性で攻撃する。');
  B('w_bow_r7', '弦月の弓', 'bow', 7, ON('sleep', 0.25), null, '眠らせることがある。');
  B('w_club_r7', '岩震の槌', 'club', 7, ON('stun', 0.25), null, '気絶させることがある。');
  B('w_staff_r7', '大術師の杖', 'staff', 7, { magicPct: 15 }, null, '術の威力が上がる。');
  B('w_staff_r7b', '黒曜の杖', 'staff', 7, { mag: 7 }, { hpPct: -10 }, '術力が上がる。ただし最大HPが下がる。');
  B('w_staff_prayer_r7', '慈愛の聖杖', 'staff', 7, { healPct: 35 }, null, '回復の術がよく効く。', 'm2');
  B('w_katana_r7', 'しらさぎ丸', 'katana', 7, { crit: 15 }, null, '会心が出やすい。');
  B('w_fist_r7', '竜牙の拳当て', 'fist', 7, { element: 'fire' }, null, '火の属性で攻撃する。');
  B('w_whip_r7', '雷蛇の鞭', 'whip', 7, ON('paralyze', 0.25), null, 'まひさせることがある。');

  // ---------------------------------------------------------------- レア帯 T9（13。クリア後だけ）
  B('w_sword_r9', '朝焼けの剣', 'sword', 9, { element: 'light' }, null, '光の属性で攻撃する。');
  B('w_greatsword_r9', '天裂きの大剣', 'greatsword', 9, { crit: 15 }, null, '会心が出やすい。');
  B('w_dagger_r9', '夜想の短剣', 'dagger', 9, ON('sleep', 0.3), null, '眠らせることがある。');
  B('w_axe_r9', '天雷の斧', 'axe', 9, ON('stun', 0.25), null, '気絶させることがある。');
  B('w_spear_r9', '流星の槍', 'spear', 9, { element: 'wind' }, null, '風の属性で攻撃する。');
  B('w_bow_r9', '極光の弓', 'bow', 9, { element: 'water' }, null, '水の属性で攻撃する。');
  B('w_club_r9', '審判の槌', 'club', 9, { vs: { demon: 1.5 } }, null, '魔族に大きなダメージ。');
  B('w_staff_r9', '天球の杖', 'staff', 9, { magicPct: 15 }, null, '術の威力が上がる。');
  B('w_staff_r9b', '極夜の杖', 'staff', 9, { mag: 9 }, { hpPct: -10 }, '術力が上がる。ただし最大HPが下がる。');
  B('w_staff_prayer_r9', '天恵の聖杖', 'staff', 9, { mpCostPct: -25 }, null, '術のMPの消費が減る。', 'm2');
  B('w_katana_r9', '夜叉丸', 'katana', 9, { element: 'dark' }, null, '闇の属性で攻撃する。');
  B('w_fist_r9', '天狼の爪', 'fist', 9, { crit: 20 }, null, '会心が出やすい。');
  B('w_whip_r9', '星鎖の鞭', 'whip', 9, ON('silence', 0.3), null, '術を封じることがある。');

  R.onData(() => {
    if (!R.WeaponItems.finish) { R.loadErrors.push('items_weapons_rare: items_weapons.js（R.WeaponItems.finish）が読み込まれていない'); return; }
    R.WeaponItems.finish(ids);
  });
})(window.RPG);
