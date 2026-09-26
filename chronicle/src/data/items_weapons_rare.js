// src/data/items_weapons_rare.js（担当 weapons A9）
// 武器の帯のレア品 47（DESIGN §8.5。grade:'rare'、src:'drop'）。宝箱の p_rare とボスの p_boss だけで手に入る（魔物の枠・店には無い）。
// 帯 T1・T3 は 7 系統＋斧のメイス系列の 8 本、T5 は剣の刀（残照の刀）を足して 9 本、T7・T9 はさらに杖の 2 本目と精神の杖を足して 11 本。
// A19（SYSTEMS_REWORK §3.2）: 旧 刀は剣（K、刀の絵）、旧 棍棒は斧のメイス（M、打撃）。体術・鞭の帯のレアは消した（セーブは remap_a19.js）。
// 能力値はレア（×2）、攻撃・術は同じティアの通常品と同じ（数値は R.onData で R.WeaponItems.finish → fillItem）。
// 特殊効果 1 つ、クセは §8.3.6 の弱い方をどの品にもちょうど 1 つ（D3。表の 4 本のクセはそのまま、残りは品の趣に合わせて選んだ）。
// desc は「特殊効果の文 → クセの文（ただし〜）」（§8.2.7。2 行 × 全角 20 字。1 行が全角 19 字以下なら 1 行、20 字になるときは装備画面の見出し 210px で詰まらないよう「ただし」の前で改行）。読み込み時はこのファイルの中のコードだけで登録する（§1.2-2。ロード順に依らない）。
// 書き方: B(id, 名前, 系統, T, 特殊効果, クセ, 説明)。特殊効果・クセは §8.5 の表の書き方のまま（武器の項目は品に、ほかは mods に入る）。
(function (R) {
  'use strict';
  const DB = R.DB;
  const WI = (R.WeaponItems = R.WeaponItems || {});
  const ids = ((WI.ids = WI.ids || {}).rare = []);
  // 武器の項目（品に置く。§8.2.2）。ほかのキーは mods（§8.5 の読み方）
  const FIELDS = ['element', 'onHit', 'vs', 'drain', 'crit', 'hit', 'twoHanded', 'sealTech', 'metalHit'];
  const UNITS = { sword: 's2', greatsword: 's2', axe: 's2', dagger: 'd2', bow: 'd2', spear: 's1d1', staff: 'i2' };
  const SERIES = { sword: 0, greatsword: 1, dagger: 2, axe: 3, spear: 5, bow: 6, staff: 7 };   // items_weapons.js の系列の順（メイス 4、精神の杖 8）
  // A19 の上書き（SYSTEMS_REWORK §3.2）: 旧 刀 → 剣（刀の絵・会心 +8）、旧 棍棒 → 斧のメイス系列（打撃・命中 +10）。units は旧のまま
  const OV = {
    katana: { units: 's1d1', series: 0, set: (it) => Object.assign(it, { art: 'katana', icon: 'icon:katana', mult: 1.05, crit: (it.crit || 0) + 8 }) },
    club: { units: 's1v1', series: 4, set: (it) => Object.assign(it, { kind: 'blunt', art: 'club', icon: 'icon:club', mult: 1.05, hit: (it.hit || 0) + 10 }) },
  };
  function put(it, fx) {
    for (const [k, v] of Object.entries(fx || {})) {
      if (FIELDS.includes(k)) it[k] = v;
      else if (k === 'statsAdd') it.statsAdd = Object.assign(it.statsAdd || {}, v);   // 負の能力値のクセは品に（§8.2.1。fillItem が stats に足す）
      else { const m = (it.mods = it.mods || {}); m[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign(m[k] || {}, v) : v; }
    }
  }
  const B = (id, name, wtype, tier, fx, q, desc, units, ov) => {
    const o = ov ? OV[ov] : null;
    const it = { name, type: 'weapon', grade: 'rare', tier, wtype, units: units || (o && o.units) || UNITS[wtype] };
    put(it, fx);
    put(it, q);
    if (q) it.quirk = true;
    if (o) o.set(it);
    it.src = 'drop';
    it.desc = desc.replace(/／/g, '\n');
    it.sort = tier * 100 + (it.units === 'm2' ? 8 : o ? o.series : SERIES[wtype]) + 50;   // §8.2.1（レア +50）
    if (DB.items[id]) R.loadErrors.push('weapons: 品の id が重なった ' + id);
    DB.items[id] = it;
    ids.push(id);
  };
  const K = (id, name, wtype, tier, fx, q, desc) => B(id, name, wtype, tier, fx, q, desc, null, 'katana');
  const M = (id, name, wtype, tier, fx, q, desc) => B(id, name, wtype, tier, fx, q, desc, null, 'club');
  const ON = (status, chance) => ({ onHit: { status, chance } });

  // ---------------------------------------------------------------- レア帯 T1（8）
  B('w_sword_r1', '若葉の剣', 'sword', 1, { element: 'wind' }, { elemResist: { fire: 1.25 } }, '風の属性で攻撃する。／ただし火に弱くなる。');
  B('w_greatsword_r1', '木こりの大剣', 'greatsword', 1, { vs: { plant: 1.5 } }, { spd: -15 }, '植物に大きなダメージ。／ただし動きが遅くなる。');
  B('w_dagger_r1', '蜂の針', 'dagger', 1, ON('poison', 0.3), { hpPct: -10 }, '毒にすることがある。／ただし最大HPが下がる。');
  B('w_axe_r1', '熊落としの斧', 'axe', 1, { vs: { beast: 1.5 } }, { hit: -10 }, '獣に大きなダメージ。／ただし当たりにくい。');
  B('w_spear_r1', '鳥追いの槍', 'spear', 1, { vs: { flying: 1.5 } }, { defPct: -25 }, '飛ぶ敵に大きなダメージ。／ただし守備力が下がる。');
  B('w_bow_r1', '朝露の弓', 'bow', 1, { element: 'water' }, { elemResist: { earth: 1.25 } }, '水の属性で攻撃する。／ただし土に弱くなる。');
  M('w_axe_r1m', '墓守の棍棒', 'axe', 1, { vs: { undead: 1.5 } }, { elemResist: { dark: 1.25 } }, '不死の魔物に大きなダメージ。／ただし闇に弱くなる。');
  B('w_staff_r1', '灯火の杖', 'staff', 1, { elemBoost: { fire: 20 } }, { elemResist: { water: 1.25 } }, '火の攻撃が強くなる。／ただし水に弱くなる。');

  // ---------------------------------------------------------------- レア帯 T3（8）
  B('w_sword_r3', '白銀の騎士剣', 'sword', 3, { element: 'light' }, { elemResist: { dark: 1.25 } }, '光の属性で攻撃する。／ただし闇に弱くなる。');
  B('w_greatsword_r3', '旋風の大剣', 'greatsword', 3, { element: 'wind' }, { hit: -10 }, '風の属性で攻撃する。／ただし当たりにくい。');
  B('w_dagger_r3', '眠り羽の短剣', 'dagger', 3, ON('sleep', 0.2), { mdefPct: -25 }, '眠らせることがある。／ただし術防が下がる。');
  B('w_axe_r3', '荒くれの斧', 'axe', 3, { crit: 15 }, { defPct: -25 }, '会心が出やすい。ただし守備力が下がる。');
  B('w_spear_r3', '竜狩りの槍', 'spear', 3, { vs: { dragon: 1.5 } }, { elemResist: { fire: 1.25 } }, '竜に大きなダメージ。／ただし火に弱くなる。');
  B('w_bow_r3', '静けさの弓', 'bow', 3, ON('silence', 0.3), { mpCostPct: 25 }, '術を封じることがある。／ただし術のMPの消費が増える。');
  M('w_axe_r3m', '歯車砕きの槌', 'axe', 3, { vs: { construct: 1.5 } }, { spd: -15 }, 'からくりに大きなダメージ。／ただし動きが遅くなる。');
  B('w_staff_r3', '月しずくの杖', 'staff', 3, { mpRegen: 1 }, { hpPct: -10 }, '戦闘中、MPが少しずつ戻る。／ただし最大HPが下がる。');

  // ---------------------------------------------------------------- レア帯 T5（9）
  B('w_sword_r5', '紅蓮の剣', 'sword', 5, { element: 'fire' }, { elemResist: { water: 1.25 } }, '火の属性で攻撃する。／ただし水に弱くなる。');
  B('w_greatsword_r5', '氷河の大剣', 'greatsword', 5, ON('freeze', 0.15), { spd: -15 }, '凍らせることがある。／ただし動きが遅くなる。');
  B('w_dagger_r5', '影刺しの短剣', 'dagger', 5, ON('paralyze', 0.2), { elemResist: { light: 1.25 } }, 'まひさせることがある。／ただし光に弱くなる。');
  B('w_axe_r5', '雷鳴の斧', 'axe', 5, ON('stun', 0.2), { encounterPct: 50 }, '気絶させることがある。／ただし魔物を呼ぶ。');
  B('w_spear_r5', '潮騒の槍', 'spear', 5, { element: 'water' }, { elemResist: { earth: 1.25 } }, '水の属性で攻撃する。／ただし土に弱くなる。');
  B('w_bow_r5', '追い風の弓', 'bow', 5, { element: 'wind' }, { elemResist: { fire: 1.25 } }, '風の属性で攻撃する。／ただし火に弱くなる。');
  M('w_axe_r5m', '聖鐘の槌', 'axe', 5, { element: 'light' }, { encounterPct: 50 }, '光の属性で攻撃する。ただし魔物を呼ぶ。');
  B('w_staff_r5', '星詠みの杖', 'staff', 5, { glimPct: { spell: 15 } }, { defPct: -25 }, '術を閃きやすい。ただし守備力が下がる。');
  K('w_sword_r5k', '残照の刀', 'sword', 5, { drain: 0.1 }, { hpPct: -10 }, '与えた傷の一部を吸い取る。／ただし最大HPが下がる。');

  // ---------------------------------------------------------------- レア帯 T7（11）
  B('w_sword_r7', '竜断ちの剣', 'sword', 7, { vs: { dragon: 1.5 } }, { takenPct: 15 }, '竜に大きなダメージ。／ただし受けるダメージが増える。');
  B('w_greatsword_r7', '地鳴りの大剣', 'greatsword', 7, { element: 'earth' }, { elemResist: { wind: 1.25 } }, '土の属性で攻撃する。／ただし風に弱くなる。');
  // 表は chance 0.4 だが、§8.3.5 のレアの上限 0.30 に合わせた（報告に書いた）
  B('w_dagger_r7', '黒蛇の牙', 'dagger', 7, ON('poison', 0.3), { mdefPct: -25 }, '毒にすることがある。／ただし術防が下がる。');
  B('w_axe_r7', '巨岩割りの斧', 'axe', 7, { crit: 20 }, { twoHanded: true }, '会心が出やすい。／ただし両手持ちで盾は不可。');
  B('w_spear_r7', '白光の槍', 'spear', 7, { element: 'light' }, { elemResist: { dark: 1.25 } }, '光の属性で攻撃する。／ただし闇に弱くなる。');
  B('w_bow_r7', '弦月の弓', 'bow', 7, ON('sleep', 0.25), { elemResist: { light: 1.25 } }, '眠らせることがある。／ただし光に弱くなる。');
  M('w_axe_r7m', '岩震の槌', 'axe', 7, ON('stun', 0.25), { spd: -15 }, '気絶させることがある。／ただし動きが遅くなる。');
  B('w_staff_r7', '大術師の杖', 'staff', 7, { magicPct: 15 }, { mpCostPct: 25 }, '術の威力が上がる。／ただし術のMPの消費が増える。');
  B('w_staff_r7b', '黒曜の杖', 'staff', 7, { mag: 7 }, { hpPct: -10 }, '術力が上がる。ただし最大HPが下がる。');
  B('w_staff_prayer_r7', '慈愛の聖杖', 'staff', 7, { healPct: 35 }, { expPct: -25 }, '回復の術がよく効く。／ただし経験値が減る。', 'm2');
  K('w_sword_r7k', 'しらさぎ丸', 'sword', 7, { crit: 15 }, { hpPct: -10 }, '会心が出やすい。ただし最大HPが下がる。');

  // ---------------------------------------------------------------- レア帯 T9（11。クリア後だけ）
  B('w_sword_r9', '朝焼けの剣', 'sword', 9, { element: 'light' }, { elemResist: { dark: 1.25 } }, '光の属性で攻撃する。／ただし闇に弱くなる。');
  B('w_greatsword_r9', '天裂きの大剣', 'greatsword', 9, { crit: 15 }, { spd: -15 }, '会心が出やすい。ただし動きが遅くなる。');
  B('w_dagger_r9', '夜想の短剣', 'dagger', 9, ON('sleep', 0.3), { elemResist: { light: 1.25 } }, '眠らせることがある。／ただし光に弱くなる。');
  B('w_axe_r9', '天雷の斧', 'axe', 9, ON('stun', 0.25), { hit: -10 }, '気絶させることがある。／ただし当たりにくい。');
  B('w_spear_r9', '流星の槍', 'spear', 9, { element: 'wind' }, { defPct: -25 }, '風の属性で攻撃する。／ただし守備力が下がる。');
  B('w_bow_r9', '極光の弓', 'bow', 9, { element: 'water' }, { elemResist: { earth: 1.25 } }, '水の属性で攻撃する。／ただし土に弱くなる。');
  M('w_axe_r9m', '審判の槌', 'axe', 9, { vs: { demon: 1.5 } }, { techCostPct: 25 }, '魔族に大きなダメージ。／ただし技のMPの消費が増える。');
  B('w_staff_r9', '天球の杖', 'staff', 9, { magicPct: 15 }, { takenPct: 15 }, '術の威力が上がる。／ただし受けるダメージが増える。');
  B('w_staff_r9b', '極夜の杖', 'staff', 9, { mag: 9 }, { hpPct: -10 }, '術力が上がる。ただし最大HPが下がる。');
  B('w_staff_prayer_r9', '天恵の聖杖', 'staff', 9, { mpCostPct: -25 }, { spd: -15 }, '術のMPの消費が減る。／ただし動きが遅くなる。', 'm2');
  K('w_sword_r9k', '夜叉丸', 'sword', 9, { element: 'dark' }, { elemResist: { light: 1.25 } }, '闇の属性で攻撃する。／ただし光に弱くなる。');

  R.onData(() => {
    if (!R.WeaponItems.finish) { R.loadErrors.push('items_weapons_rare: items_weapons.js（R.WeaponItems.finish）が読み込まれていない'); return; }
    R.WeaponItems.finish(ids);
  });
})(window.RPG);
