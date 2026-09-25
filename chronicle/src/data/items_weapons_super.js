// src/data/items_weapons_super.js（担当 weapons A9）
// 武器の手作りの超レア 10（DESIGN §8.6.5。grade:'super'、src:'super'、一品物）。
// - T8 の一式（知力・腕力・器用さ）の武器1・武器2 を 2 本ずつ（6 本）。落とす魔物の超レア枠の分母は 128（§8.0 の 0.20）。
// - クセの強い名品 3 本（狂い咲きの大剣・鏡割りの短剣・待宵丸）と、クリア後の魔王の残影の 1 本（残影の魔剣、1/4）。
// 能力値は超レア（×3）、攻撃・術は同じティアの通常品と同じ（数値は R.onData で R.WeaponItems.finish → fillItem）。
// exclusive はその品を落とすただ 1 種の魔物（§8.6.5 の割り当て）。読み込み時はこのファイルの中のコードだけで登録する（§1.2-2）。
// 書き方: S(id, 名前, 系統, T, 落とす魔物, 特殊効果, クセ, 説明, units（系列の振り方と違うときだけ）)。
(function (R) {
  'use strict';
  const DB = R.DB;
  const WI = (R.WeaponItems = R.WeaponItems || {});
  const ids = ((WI.ids = WI.ids || {}).super = []);
  // 武器の項目（品に置く。§8.2.2）。ほかのキーは mods（§8.5・§8.6.5 の読み方）
  const FIELDS = ['element', 'onHit', 'vs', 'drain', 'crit', 'hit', 'twoHanded', 'sealTech', 'metalHit'];
  const UNITS = { sword: 's2', greatsword: 's2', axe: 's2', dagger: 'd2', bow: 'd2', spear: 's1d1', katana: 's1d1', club: 's1v1', fist: 's1a1', whip: 'd1a1', staff: 'i2' };
  const SERIES = { sword: 0, greatsword: 1, dagger: 2, axe: 3, spear: 4, bow: 5, club: 6, staff: 7, katana: 9, fist: 10, whip: 11 };   // §8.1.2（精神の杖は 8）
  function put(it, fx) {
    for (const [k, v] of Object.entries(fx || {})) {
      if (FIELDS.includes(k)) it[k] = v;
      else { const m = (it.mods = it.mods || {}); m[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign(m[k] || {}, v) : v; }
    }
  }
  const S = (id, name, wtype, tier, exclusive, fx, q, desc, units) => {
    const it = { name, type: 'weapon', grade: 'super', tier, wtype, units: units || UNITS[wtype] };
    put(it, fx);
    put(it, q);
    if (q) it.quirk = true;
    it.src = 'super';
    it.exclusive = exclusive;
    it.desc = desc.replace(/／/g, '\n');
    it.sort = tier * 100 + (it.units === 'm2' ? 8 : SERIES[wtype]) + 70;   // §8.2.1（超レア +70）
    if (DB.items[id]) R.loadErrors.push('weapons: 品の id が重なった ' + id);
    DB.items[id] = it;
    ids.push(id);
  };

  // ---------------------------------------------------------------- 知力の一式（T8）の武器
  S('w_staff_sr_cosmos', '万象の杖', 'staff', 8, 'book_3', { mag: 16 }, { hpPct: -20 }, '術力が上がる。ただし最大HPが下がる。');
  S('w_staff_sr_moon', '月読みの杖', 'staff', 8, 'book_2', { mpCostPct: -35 }, { spd: -30 }, '術のMPの消費が減る。／ただし動きが遅くなる。');

  // ---------------------------------------------------------------- 腕力の一式（T8）の武器
  S('w_sword_sr_hegemon', '覇道の剣', 'sword', 8, 'goblin_5', { physPct: 15, crit: 10 }, { spd: -30 },
    '物理攻撃の威力が上がる。会心が出やすい。／ただし動きが遅くなる。');
  S('w_axe_sr_titan', '巨神の斧', 'axe', 8, 'golem_3', { crit: 20 }, { hit: -15 }, '会心が出やすい。ただし当たりにくい。');

  // ---------------------------------------------------------------- 器用さの一式（T8）の武器
  S('w_dagger_sr_moonfang', '月牙の短剣', 'dagger', 8, 'bat_5', { crit: 20, onHit: { status: 'sleep', chance: 0.35 } }, { hpPct: -20 },
    '会心が出やすい。眠らせることがある。／ただし最大HPが下がる。');
  S('w_whip_sr_silk', '銀糸の鞭', 'whip', 8, 'spider_4', { onHit: { status: 'paralyze', chance: 0.35 } }, { takenPct: 25 },
    'まひさせることがある。／ただし受けるダメージが増える。', 'd2');   // 器用さ +30: 2 単位を器用さに寄せた（§8.3.4 の例「鞭 d2」）

  // ---------------------------------------------------------------- クセの強い名品
  // 技が使えない代わりに物理 +50（§8.3.5 の例外）
  S('w_greatsword_sr_frenzy', '狂い咲きの大剣', 'greatsword', 2, 'orc_1', { physPct: 50 }, { sealTech: true },
    '物理攻撃の威力が上がる。／ただし技が使えない。');
  // 鋼の魔物（白銀ゼリー）から出る、鋼を斬れる短剣
  S('w_dagger_sr_mirror', '鏡割りの短剣', 'dagger', 5, 'quicksilver_1', { metalHit: true }, { hit: -15 },
    '鋼の魔物にも傷を与える。／ただし当たりにくい。');
  S('w_katana_sr_matsuyoi', '待宵丸', 'katana', 7, 'wolf_4', { autoCounter: 0.3 }, { spd: -30 },
    '攻撃を受けると反撃する。／ただし動きが遅くなる。');

  // ---------------------------------------------------------------- クリア後（T9）
  S('w_sword_sr_echo', '残影の魔剣', 'sword', 9, 'b_valzard_echo', { element: 'dark', drain: 0.2 }, { elemResist: { light: 1.5 } },
    '闇の属性。傷を吸う。ただし光に弱い。');

  R.onData(() => {
    if (!R.WeaponItems.finish) { R.loadErrors.push('items_weapons_super: items_weapons.js（R.WeaponItems.finish）が読み込まれていない'); return; }
    R.WeaponItems.finish(ids);
  });
})(window.RPG);
