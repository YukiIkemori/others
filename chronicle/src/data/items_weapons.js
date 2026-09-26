// src/data/items_weapons.js（担当 weapons A9。A19 の 7 系統: design/build/SYSTEMS_REWORK.md §3.2）
// 武器の通常品 91（9 系列 × T0〜T9 ＋ 打ち刀。grade:'normal'、src:'shop'）と、武器の 4 ファイルが
// R.onData の中で使う仕上げの道具 R.WeaponItems（finish・fill・all）。
//
// ロード順に依らない（§1.2-2）: 4 つのファイル（items_weapons.js / _rare.js / _super.js / _monster.js）は、読み込み時には
// 自分のファイルの中のコードだけで DB.items に品を登録する（id・名前・種別・tier・grade・units・src・効果・クセ・desc・sort）。
// 数値（atk mag stats price）と通常品の desc は、各ファイルの R.onData が R.WeaponItems.finish(ids) で埋める
// （R.Rules.fillItem（§8.2.9）。rules が無いとき・例外を出したときは同じ式の localFill。書いてある値は変えない）。
// onData は全ファイルを読み込んだ後に走るので、どのファイルが先に読まれても同じ品になる（tools/test_weapons.js が確かめる）。
(function (R) {
  'use strict';
  const DB = R.DB;
  const WI = (R.WeaponItems = R.WeaponItems || {});
  const ids = ((WI.ids = WI.ids || {}).normal = []);

  // ------------------------------------------------------------------ 通常品 90（9 系列。§8.4.1 の名前と能力）＋打ち刀
  // 名前: 素材（ティアごと）＋の＋品の名（§8.0 の 0.2）。T0 は §5.1.4 の固定の id と名前（杖の精神の系列だけ w_staff_prayer_0）。
  // 斧のメイス系列（旧 棍棒）は打撃・棍棒の絵（§3.2 の上書き: kind blunt、art/icon club、mult 1.05、hit +10）。
  const OV = {
    club: (it) => Object.assign(it, { kind: 'blunt', art: 'club', icon: 'icon:club', mult: 1.05, hit: (it.hit || 0) + 10 }),
    katana: (it) => Object.assign(it, { art: 'katana', icon: 'icon:katana', mult: 1.05, crit: (it.crit || 0) + 8 }),
  };
  const LINES = [
    ['w_sword', 'sword', 's2', 'w_sword_iron', ['鉄の剣', '鋼の剣', '黒鋼の剣', '銀の剣', '青鋼の剣', '竜骨の剣', '聖銀の剣', '金剛の剣', '星鉄の剣', '天鋼の剣']],
    ['w_greatsword', 'greatsword', 's2', 'w_greatsword_iron', ['鉄の大剣', '鋼の大剣', '黒鋼の大剣', '銀の大剣', '青鋼の大剣', '竜骨の大剣', '聖銀の大剣', '金剛の大剣', '星鉄の大剣', '天鋼の大剣']],
    ['w_dagger', 'dagger', 'd2', 'w_dagger_iron', ['鉄の短剣', '鋼の短剣', '黒鋼の短剣', '銀の短剣', '青鋼の短剣', '竜骨の短剣', '聖銀の短剣', '金剛の短剣', '星鉄の短剣', '天鋼の短剣']],
    ['w_axe', 'axe', 's2', 'w_axe_hand', ['手斧', '鋼の斧', '黒鋼の斧', '銀の斧', '青鋼の斧', '竜骨の斧', '聖銀の斧', '金剛の斧', '星鉄の斧', '天鋼の斧']],
    ['w_axe_mace', 'axe', 's1v1', 'w_axe_cudgel', ['木の棍棒', '鋼のメイス', '黒鋼のメイス', '銀のメイス', '青鋼のメイス', '竜骨のメイス', '聖銀のメイス', '金剛のメイス', '星鉄のメイス', '天鋼のメイス'], 'club'],
    ['w_spear', 'spear', 's1d1', 'w_spear_iron', ['鉄の槍', '鋼の槍', '黒鋼の槍', '銀の槍', '青鋼の槍', '竜骨の槍', '聖銀の槍', '金剛の槍', '星鉄の槍', '天鋼の槍']],
    ['w_bow', 'bow', 'd2', 'w_bow_short', ['短弓', '長弓', '合わせ弓', '鋼弦の弓', '蛇骨の弓', '飛竜の弓', '霊木の弓', '竜骨の弓', '星弦の弓', '天馬の弓']],
    ['w_staff', 'staff', 'i2', 'w_staff_novice', ['見習いの杖', '白木の杖', '術士の杖', '銀の杖', '月の杖', '精霊の杖', '星の杖', '聖樹の杖', '天の杖', '虹の杖']],
    ['w_staff_prayer', 'staff', 'm2', null, ['祈りの杖', '巡礼の杖', '銀の聖杖', '白樺の聖杖', '月の聖杖', '精霊の聖杖', '星の聖杖', '祝福の聖杖', '天の聖杖', '虹の聖杖']],
  ].map(([line, wtype, units, t0, names, ov]) => ({ line, wtype, units, t0, names, ov }));

  const put = (id, it) => {
    if (DB.items[id]) R.loadErrors.push('weapons: 品の id が重なった ' + id);
    DB.items[id] = it;
    ids.push(id);
  };
  LINES.forEach((L, series) => {
    for (let T = 0; T <= 9; T++) {
      const id = (T === 0 && L.t0) || `${L.line}_${T}`;
      // sort = tier × 100 + 系列の番号（§8.2.1。番号は上の並び 0〜8）
      const it = { name: L.names[T], type: 'weapon', grade: 'normal', tier: T, wtype: L.wtype, units: L.units, line: L.line, src: 'shop', sort: T * 100 + series };
      if (L.ov) OV[L.ov](it);
      // メイスの命中 +10 は斧の −10 を打ち消すだけなので、文には出さない（旧 棍棒の文。§8.2.7 の通常品の形）
      if (L.ov === 'club') it.desc = '打撃で、硬い敵や骨の敵に強い。\n腕力と体力が上がる。';
      put(id, it);
    }
  });
  // 打ち刀（旧 刀の T0。シグレ・ヴィオラの初期装備。1 本だけの系列で、店の段には置かない）
  put('w_sword_uchi', OV.katana({ name: '打ち刀', type: 'weapon', grade: 'normal', tier: 0, wtype: 'sword', units: 's1d1', line: 'w_sword_uchi', src: 'shop', sort: 9 }));

  // ------------------------------------------------------------------ 仕上げ（R.onData の中だけで使う）
  // §4.3.1・§4.3.4・§4.3.6 の定数（rules の K が無いときだけ使う）
  const LK = {
    W: [8, 14, 21, 30, 40, 51, 64, 78, 94, 112],
    U: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
    PRICE: [70, 160, 290, 450, 660, 900, 1200, 1500, 1900, 2600],
    GRADE_MULT: { normal: 1, rare: 2, super: 3 },
    PRICE_GRADE: { normal: 1, rare: 3, super: 6 },
    PRICE_WEAPON: 1.6,
    WTYPE: {   // §3.1 の 7 系統（fist は素手。品は無い）
      sword: { mult: 1.00, magMult: 0.5 }, greatsword: { mult: 1.40, magMult: 0.5 }, dagger: { mult: 0.75, magMult: 0.5 },
      axe: { mult: 1.15, magMult: 0.5 }, spear: { mult: 1.25, magMult: 0.5 }, bow: { mult: 1.10, magMult: 0.5 },
      staff: { mult: 0.60, magMult: 1.0 }, fist: { mult: 0.90, magMult: 0.5 },
    },
    TWO_HANDED: { greatsword: true, spear: true, bow: true },
  };
  const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
  const STAT_NAME = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const LOCAL_WT_DESC = {   // SYSTEMS_REWORK §3.1 の desc の控え（weapontypes.js が読めないとき）
    sword: '片手持ち。盾と合わせて攻守に強い。', greatsword: '両手持ち。重い一撃で敵をなぎ倒す。',
    dagger: '器用さで戦う。会心が出やすい。', axe: '一撃が重い。打撃の槌やメイスもこの系統。',
    spear: '両手持ち。後列からでも届く。', bow: '両手持ち。後列から確実に射る。', staff: '術の威力を高める。後列からも届く。',
  };
  const gearStat = (T, n, grade) => Math.max(1, Math.round(n * LK.U[T])) * LK.GRADE_MULT[grade || 'normal'];

  /** §8.2.7 の通常品の文（rules の autoDesc が無いとき） */
  function localAutoDesc(it) {
    const wt = (DB.weaponTypes && DB.weaponTypes[it.wtype]) || {};
    const names = [...String(it.units || '').matchAll(/([svdaim])(\d)/g)].map((m) => STAT_NAME[SK[m[1]]]);
    return (wt.desc || LOCAL_WT_DESC[it.wtype] || '') + '\n' + (names.length ? names.join('と') + 'が上がる。' : '');
  }
  /** §8.2.9 と同じ式（書いてある値は変えない。rules が埋めなかった項目だけを埋める） */
  function localFill(it) {
    const T = it.tier || 0, g = it.grade || 'normal';
    if (it.units && !it.stats) {
      it.stats = {};
      for (const m of it.units.matchAll(/([svdaim])(\d)/g)) it.stats[SK[m[1]]] = gearStat(T, +m[2], g);
      for (const [k, v] of Object.entries(it.statsAdd || {})) it.stats[k] = (it.stats[k] || 0) + v;   // クセの負の能力値
    }
    const w = LK.WTYPE[it.wtype] || LK.WTYPE.fist;
    if (it.atk === undefined) it.atk = Math.round(LK.W[T] * (it.mult !== undefined ? it.mult : w.mult));   // 品の mult が系統の値に勝つ（§3.1）
    if (it.mag === undefined) it.mag = Math.round(LK.W[T] * w.magMult);
    const wt = DB.weaponTypes && DB.weaponTypes[it.wtype];
    if (wt ? wt.twoHanded : LK.TWO_HANDED[it.wtype]) it.twoHanded = true;
    if (it.price === undefined) it.price = Math.round(LK.PRICE[T] * LK.PRICE_WEAPON / 10) * 10 * LK.PRICE_GRADE[g];
    if (!it.desc) it.desc = (R.Rules && typeof R.Rules.autoDesc === 'function') ? R.Rules.autoDesc(it) : localAutoDesc(it);
    return it;
  }

  Object.assign(WI, {
    LOCAL_K: LK,
    GROUPS: ['normal', 'rare', 'super', 'mrare', 'msuper', 'fixed'],
    gearStat,
    localFill,
    localAutoDesc,
    forceLocal: false,   // tools/fixtures/weapons/lib/spec.js の loadFull({local:true}) が立てる（rules に依らない検算）
    /** 1 本の数値を埋める: R.Rules.fillItem → localFill（rules が埋めなかった項目だけ） */
    fill(it) {
      const rf = !WI.forceLocal && R.Rules && typeof R.Rules.fillItem === 'function' ? R.Rules.fillItem : null;
      if (rf) {
        try { rf(it); } catch (e) { R.warn('fillItem failed for weapon', it && it.name, e && e.message); }
      }
      return localFill(it);
    },
    /** 各ファイルの R.onData から呼ぶ: その id の品を仕上げる */
    finish(list) { for (const id of list || []) if (DB.items[id]) WI.fill(DB.items[id]); },
    /** 260 本の id（通常 91・帯のレア・手作りの超レア・魔物のレア・魔物の超レア・固定ティアの超レア の順） */
    all() { return [].concat(...WI.GROUPS.map((g) => (WI.ids && WI.ids[g]) || [])); },
  });

  R.onData(() => WI.finish(ids));
})(window.RPG);
