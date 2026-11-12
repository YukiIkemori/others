// Game data of the first slice (始まりの村 → F01 麦の丘 → 崖の修道院 マップ1・2, and on to F02 草の高原 → 王都).
// Numbers and names come from the scenario tables (results/4周目/data/*.csv, 2周目/依頼11); lines from 依頼5 and 依頼22; the abbey's boss from 依頼1.
window.RPGDATA = (function () {
  'use strict';
  // stat = base + growth x Lv  (依頼11)
  const chars = {
    teto:  { name: 'テト',   sprite: 'party/hero',   row: 'front', hp: [32, 11],  mp: [6, 1],    str: [8, 2],   def: [6, 1.6], int: [3, .6],  spd: [5, 1.1], dex: [5, 1],  equip: { weapon: 'sw01', shield: 'sh01', body: 'bd01' } },
    metem: { name: 'メテム', sprite: 'party/sword',  row: 'back',  hp: [24, 7.5], mp: [14, 4],   str: [3, .8],  def: [3, .9],  int: [9, 2.1], spd: [5, 1],   dex: [4, .8], equip: { weapon: 'st01', body: 'bd01' } },
    pamp:  { name: 'パンプ', sprite: 'party/rogue',  row: 'front', hp: [26, 8],   mp: [8, 1.5],  str: [6, 1.4], def: [4, 1.1], int: [4, .9],  spd: [8, 1.8], dex: [9, 2],  equip: { weapon: 'dg01', body: 'bd01' } },
    bani:  { name: 'バニ',   sprite: 'party/priest', row: 'back',  hp: [24, 8],   mp: [12, 3.5], str: [5, 1.3], def: [4, 1.2], int: [7, 1.7], spd: [4, .9],  dex: [5, 1],  equip: { weapon: 'hs01', body: 'bd01' } },
  };
  const order = ['teto', 'metem', 'pamp', 'bani'];
  // power: x of the formula; el: element; fx: effect name in battle.js.  メテム knows the four basic element spells from the start (ユウキ, 2026-11-12)
  const skills = {
    tsuyogiri: { name: '強斬り',     user: 'teto',  lv: 3, mp: 3, kind: 'phys',  power: 1.5, target: 'enemy', fx: 'heavy',  help: '力をこめて斬る' },
    kabau:     { name: 'かばう',     user: 'teto',  lv: 6, mp: 2, kind: 'cover', target: 'ally',  fx: 'cover', help: 'このターン、仲間1人の代わりに受ける', need: 'shield' },
    hinotama:  { name: '火の玉',     user: 'metem', lv: 1, mp: 3, kind: 'spell', power: 1, el: 'fire',  target: 'enemy', fx: 'fire',  help: '炎の術。小さなダメージ' },
    mizu:      { name: '水つぶて',   user: 'metem', lv: 1, mp: 3, kind: 'spell', power: 1, el: 'water', target: 'enemy', fx: 'water', help: '水の術。小さなダメージ' },
    ishi:      { name: '石つぶて',   user: 'metem', lv: 1, mp: 3, kind: 'spell', power: 1, el: 'earth', target: 'enemy', fx: 'earth', help: '土の術。小さなダメージ' },
    kamaitachi:{ name: 'かまいたち', user: 'metem', lv: 1, mp: 3, kind: 'spell', power: 1, el: 'wind',  target: 'enemy', fx: 'wind',  help: '風の術。小さなダメージ' },
    // book: learned by reading that item (覚え方は、レベルか拾い物)
    tsumuji:   { name: 'つむじ風',   user: 'metem', book: 'sb08', mp: 8, kind: 'spell', power: .9, el: 'wind', target: 'enemies', fx: 'wind', help: '風の術。魔物すべてに小さなダメージ' },
    metsubushi:{ name: '目つぶし',   user: 'pamp',  lv: 6, mp: 3, kind: 'blind', target: 'enemy', fx: 'blind', help: '魔物の攻撃を当たりにくくする' },
    iyashi:    { name: 'いやしの祈り', user: 'bani', lv: 1, mp: 4, kind: 'heal', power: 1, target: 'ally', fx: 'heal', help: '仲間1人のHPを回復する' },
    tomoshibi: { name: 'ともしび',   user: 'bani',  lv: 3, mp: 3, kind: 'spell', power: 1, el: 'light', target: 'enemy', fx: 'light', help: '光の術。小さなダメージ' },
    kiyome:    { name: '清めの祈り', user: 'bani',  lv: 7, mp: 4, kind: 'cure',  target: 'ally', fx: 'heal', help: '仲間1人の悪い状態を治す' },
  };
  const passives = { nigeashi: { name: '逃げ足', user: 'pamp', lv: 4 } };
  const EL = { fire: '炎', water: '水', earth: '土', wind: '風', light: '光' };
  const items = {
    yakusou:    { name: '薬草', kind: 'use', heal: 40, price: 10, help: '1人のHPを40回復' },
    kizugusuri: { name: '傷薬', kind: 'use', heal: 120, price: 40, help: '1人のHPを120回復' },
    kinoko:     { name: '食べられるきのこ', kind: 'use', heal: 30, sell: 14, help: '1人のHPを30回復' },
    dokukeshi:  { name: '毒消し', kind: 'use', cure: 'poison', price: 12, help: '1人の毒を治す' },
    mpwater:    { name: '魔力の水', kind: 'use', mp: 30, price: 60, help: '1人のMPを30回復' },
    kitsuke:    { name: '気つけ薬', kind: 'use', revive: .25, sell: 125, help: '倒れた仲間を1人起こす（HPは4分の1）' },
    mame:       { name: '跳ねる豆', kind: 'use', haste: 1, sell: 25, help: '戦闘の間、1人の素早さが上がる（戦闘中だけ使える）' },
    sb08:       { name: '術の書「つむじ風」', kind: 'use', teach: 'tsumuji', sell: 300, help: 'メテムが読むと、風の全体術「つむじ風」を覚える' },
    tent:       { name: 'テント', kind: 'tent', price: 300, help: 'セーブ結晶の所で使うと、全員が全回復' },
    koke:   { name: '苔のかけら', kind: 'mat', sell: 16, help: '売ればお金になる' },
    kegawa: { name: 'うさぎの毛皮', kind: 'mat', sell: 22, help: '売ればお金になる' },
    kiba:   { name: '獣の牙', kind: 'mat', sell: 28, help: '売ればお金になる' },
    hane:   { name: '黒い羽', kind: 'mat', sell: 34, help: '売ればお金になる' },
    koishi: { name: '光る小石', kind: 'mat', sell: 34, help: '売ればお金になる' },
    kouhane:{ name: 'コウモリの羽', kind: 'mat', sell: 40, help: '売ればお金になる' },
    tane:   { name: '草の種', kind: 'mat', sell: 40, help: '売ればお金になる' },
    ito:    { name: '蜘蛛の糸', kind: 'mat', sell: 46, help: '売ればお金になる' },
    kara:   { name: '虫の殻', kind: 'mat', sell: 40, help: '売ればお金になる' },
    hebi:   { name: '蛇の皮', kind: 'mat', sell: 46, help: '売ればお金になる' },
    hai:    { name: '霊の灰', kind: 'mat', sell: 58, help: '売ればお金になる' },
    ya:     { name: '粗末な矢', kind: 'mat', sell: 64, help: '売ればお金になる' },
    shin:   { name: '灯の芯', kind: 'mat', sell: 64, help: '売ればお金になる' },
    hone:   { name: '古い骨', kind: 'mat', sell: 70, help: '売ればお金になる' },
    spoon:  { name: 'さびたスプーン', kind: 'mat', sell: 1, help: '一本杉の根もとから出てきた' },
    sw01: { name: '古い片手剣', kind: 'gear', slot: 'weapon', wtype: 'sword', user: 'teto', atk: 8, price: 40, help: 'テトの剣。盾を持てる' },
    gs01: { name: '薪割りの大剣', kind: 'gear', slot: 'weapon', wtype: 'great', user: 'teto', atk: 10, price: 40, help: 'テトの大剣。盾は持てない' },
    st01: { name: '樫の杖', kind: 'gear', slot: 'weapon', wtype: 'staff', user: 'metem', atk: 6, mag: 4, price: 40, help: 'メテムの杖' },
    bk01: { name: '手書きの覚え書き', kind: 'gear', slot: 'weapon', wtype: 'book', user: 'metem', atk: 2, mag: 7, price: 40, help: 'メテムの本。術が強い' },
    dg01: { name: '皮はぎナイフ', kind: 'gear', slot: 'weapon', wtype: 'dagger', user: 'pamp', atk: 7, steal: 5, price: 40, help: 'パンプの短剣。少し盗みやすい' },
    dg02: { name: '墓掘りの短剣', kind: 'gear', slot: 'weapon', wtype: 'dagger', user: 'pamp', atk: 17, steal: 5, sell: 200, help: 'パンプの短剣。少し盗みやすい' },
    bw01: { name: '狩りの小弓', kind: 'gear', slot: 'weapon', wtype: 'bow', user: 'pamp', atk: 7, price: 40, help: 'パンプの弓。後列でも弱くならない' },
    hs01: { name: '祈りの杖', kind: 'gear', slot: 'weapon', wtype: 'holy', user: 'bani', atk: 4, mag: 4, healp: 7, price: 40, help: 'バニの聖杖。回復が強い' },
    mc01: { name: '木槌', kind: 'gear', slot: 'weapon', wtype: 'mace', user: 'bani', atk: 8, mag: 2, healp: 4, price: 40, help: 'バニのメイス。殴りが強い' },
    // 王都の店 (items.csv, guide Lv8)
    sw02: { name: '鉄の片手剣', kind: 'gear', slot: 'weapon', wtype: 'sword', user: 'teto', atk: 22, price: 500, help: 'テトの剣。盾を持てる' },
    gs02: { name: '鉄の大剣', kind: 'gear', slot: 'weapon', wtype: 'great', user: 'teto', atk: 29, price: 500, help: 'テトの大剣。盾は持てない' },
    st02: { name: '灯り石の杖', kind: 'gear', slot: 'weapon', wtype: 'staff', user: 'metem', atk: 18, mag: 12, price: 500, help: 'メテムの杖' },
    bk02: { name: '術の入門書', kind: 'gear', slot: 'weapon', wtype: 'book', user: 'metem', atk: 7, mag: 20, price: 500, help: 'メテムの本。術が強い' },
    dg03: { name: '鉄の短剣', kind: 'gear', slot: 'weapon', wtype: 'dagger', user: 'pamp', atk: 19, steal: 5, price: 500, help: 'パンプの短剣。少し盗みやすい' },
    bw02: { name: '鉄弦の弓', kind: 'gear', slot: 'weapon', wtype: 'bow', user: 'pamp', atk: 20, price: 500, help: 'パンプの弓。後列でも弱くならない' },
    hs02: { name: '白樺の聖杖', kind: 'gear', slot: 'weapon', wtype: 'holy', user: 'bani', atk: 10, mag: 11, healp: 20, price: 500, help: 'バニの聖杖。回復が強い' },
    mc02: { name: '鉄のメイス', kind: 'gear', slot: 'weapon', wtype: 'mace', user: 'bani', atk: 22, mag: 7, healp: 10, price: 500, help: 'バニのメイス。殴りが強い' },
    mc03: { name: '鐘守りのメイス', kind: 'gear', slot: 'weapon', wtype: 'mace', user: 'bani', atk: 30, mag: 9, healp: 14, sell: 490, help: 'バニのメイス。大烏が守っていた' },
    sh01: { name: '木の丸盾', kind: 'gear', slot: 'shield', user: 'teto', def: 2, price: 20, help: 'テトの盾。剣の時だけ持てる' },
    hd01: { name: '革の帽子', kind: 'gear', slot: 'head', def: 1, price: 20, help: '誰でもかぶれる' },
    sh02: { name: '鉄の丸盾', kind: 'gear', slot: 'shield', user: 'teto', def: 6, price: 300, help: 'テトの盾。剣の時だけ持てる' },
    hd03: { name: '鉄の兜', kind: 'gear', slot: 'head', user: 'teto', def: 3, price: 200, help: 'テトの兜' },
    hd04: { name: '術師の頭巾', kind: 'gear', slot: 'head', users: ['metem', 'bani'], def: 2, mag: 2, price: 200, help: 'メテムとバニの頭巾。術が少し強い' },
    bd01: { name: '旅人の服', kind: 'gear', slot: 'body', def: 3, price: 30, help: '誰でも着られる' },
    bd03: { name: '象牙色のケープ', kind: 'gear', slot: 'body', user: 'metem', def: 5, mag: 2, price: 400, help: 'メテムのケープ。術が少し強い' },
    bd04: { name: '藍のローブ', kind: 'gear', slot: 'body', user: 'bani', def: 5, healp: 3, price: 400, help: 'バニのローブ。回復が少し強い' },
    bd05: { name: '綿入れの鎧', kind: 'gear', slot: 'body', user: 'teto', def: 7, price: 400, help: 'テトの鎧' },
    hn01: { name: '革の手袋', kind: 'gear', slot: 'hand', def: 1, price: 10, help: '誰でも付けられる' },
    hn02: { name: '指なし手袋', kind: 'gear', slot: 'hand', user: 'pamp', def: 1, steal: 5, price: 120, help: 'パンプの手袋。少し盗みやすい' },
    hn03: { name: '鉄の小手', kind: 'gear', slot: 'hand', user: 'teto', def: 2, price: 120, help: 'テトの小手' },
    ft01: { name: '革の靴', kind: 'gear', slot: 'foot', def: 1, price: 10, help: '誰でもはける' },
    ft02: { name: '鉄の脛当て', kind: 'gear', slot: 'foot', user: 'teto', def: 2, price: 120, help: 'テトの脛当て' },
    ac02: { name: '鈴の首飾り', kind: 'gear', slot: 'acc', price: 250, help: '眠りを防ぐ' },
    ac03: { name: '銀貨の指輪', kind: 'gear', slot: 'acc', goldup: .2, sell: 180, help: '戦闘で入るお金が、少し増える' },
  };
  const SLOTS = [['weapon', '武器'], ['shield', '盾'], ['head', '頭'], ['body', '体'], ['hand', '手'], ['foot', '足'], ['acc', '飾り']];
  const BODY_DEF = 0;            // (the clothes everyone starts in are an item now: 旅人の服)
  // art: file in mon/, float = hovers; act: attack style (effect), ai: special behaviour; weakMul: how much the weak element does (1.5 unless said);
  // weak2: a second weak element; evade: weapons miss that often; fixed: every hit does 1; el: the element of its own attack
  const monsters = {
    mn001: { name: '苔ぬめり',   lv: 1, hp: 24, atk: 10, def: 5,  spd: 5,  exp: 10, gold: 16, weak: 'fire',  drop: 'kizugusuri', steal: 'koke',       act: 'tackle', ai: 'split' },
    mn005: { name: '角うさぎ',   lv: 2, hp: 26, atk: 12, def: 6,  spd: 9,  exp: 17, gold: 22, weak: 'fire',  drop: 'kegawa',     steal: 'kizugusuri', act: 'thrust', ai: 'runs' },
    mn009: { name: 'のら犬',     lv: 3, hp: 29, atk: 15, def: 8,  spd: 8,  exp: 24, gold: 28, weak: 'fire',  drop: 'kiba',       steal: 'kizugusuri', act: 'bite' },
    mn025: { name: '歩きだけ',   lv: 3, hp: 29, atk: 18, def: 8,  spd: 8,  exp: 24, gold: 28, weak: 'fire',  drop: 'kinoko',     steal: 'kizugusuri', act: 'tackle' },
    mn045: { name: '小鬼',       lv: 4, hp: 51, atk: 17, def: 9,  spd: 9,  exp: 33, gold: 34, weak: 'fire',  drop: null,         steal: 'kizugusuri', act: 'club', ai: 'pickpocket' },
    mn033: { name: '灰ガラス',   lv: 4, hp: 41, atk: 17, def: 9,  spd: 14, exp: 33, gold: 34, weak: 'earth', drop: 'hane',       steal: 'koishi',     act: 'peck', float: 1 },
    mn013: { name: '洞コウモリ', lv: 5, hp: 48, atk: 19, def: 10, spd: 15, exp: 42, gold: 40, weak: 'earth', drop: 'kouhane',    steal: 'kizugusuri', act: 'claw', float: 1, evade: .25 },
    mn029: { name: 'つぼみ食い', lv: 5, hp: 42, atk: 23, def: 10, spd: 10, exp: 42, gold: 40, weak: 'fire',  drop: 'tane',       steal: 'kizugusuri', act: 'bite' },
    // F02 草の高原 (Lv5-9)
    mn017: { name: '鎧虫',       lv: 5, hp: 54, atk: 19, def: 16, spd: 7,  exp: 42, gold: 40, weak: 'fire',  drop: 'kara',       steal: 'kizugusuri', act: 'tackle' },
    mn037: { name: '草蛇',       lv: 6, hp: 69, atk: 21, def: 11, spd: 11, exp: 53, gold: 46, weak: 'fire',  drop: 'hebi',       steal: 'dokukeshi',  act: 'bite', ai: 'poison' },
    mn006: { name: '跳ねうさぎ', lv: 8, hp: 70, atk: 26, def: 14, spd: 21, exp: 77, gold: 58, weak: 'fire',  drop: 'kegawa',     steal: 'mame',       act: 'thrust', ai: 'leap' },
    mn046: { name: '小鬼の弓兵', lv: 9, hp: 96, atk: 28, def: 15, spd: 15, exp: 90, gold: 64, weak: 'fire',  drop: 'ya',         steal: 'kizugusuri', act: 'arrow', ai: 'snipe' },
    // 崖の修道院 マップ2 (Lv8-11).  灯り玉 comes in two colours: the red one burns and fears water, the blue one drenches and fears earth
    mn053: { name: '迷い霊',     lv: 8, hp: 87, atk: 21, def: 14, spd: 14, exp: 77, gold: 58, weak: 'light', weakMul: 2, drop: 'hai', steal: 'mpwater', act: 'claw', ai: 'drain', float: 1, evade: .5 },
    mn097r:{ name: '灯り玉',     lv: 9, hp: 96, atk: 22, def: 15, spd: 15, exp: 90, gold: 64, weak: 'water', drop: 'shin',       steal: 'mpwater',    act: 'ember', el: 'fire', float: 1 },
    mn097b:{ name: '灯り玉',     lv: 9, hp: 96, atk: 22, def: 15, spd: 15, exp: 90, gold: 64, weak: 'earth', drop: 'shin',       steal: 'mpwater',    act: 'ember', el: 'water', float: 1 },
    mn049: { name: '骨兵',       lv: 10, hp: 105, atk: 30, def: 16, spd: 16, exp: 105, gold: 70, weak: 'light', weakMul: 2, weak2: 'earth', drop: 'hone', steal: 'kizugusuri', act: 'club', ai: 'rise' },
    mn101: { name: '小銭虫',     lv: 10, hp: 10, atk: 30, def: 16, spd: 16, exp: 105, gold: 1050, weak: null, drop: null, rare: ['ac03', .08], steal: null, act: 'tackle', ai: 'coin', fixed: 1 },
    bs01:  { name: '鐘守りの大烏', lv: 12, hp: 738, atk: 41, def: 18, spd: 18, exp: 1096, gold: 656, weak: 'fire', drop: 'mc03', dropSure: 1, steal: 'kitsuke', act: 'claw', ai: 'dive', float: 1, boss: 1 },
    mn021: { name: '糸ぐも',     lv: 6, hp: 69, atk: 21, def: 11, spd: 11, exp: 53, gold: 46, weak: 'fire',  drop: 'ito',        steal: 'kizugusuri', act: 'claw', ai: 'web' },
  };
  // groups of monsters per map; w = how often; far = only away from the village gate (F01)
  const encounters = {
    f01: { bg: 'bg_f01', bgm: 'bgm25', groups: [
      { w: 5, m: ['mn001'] }, { w: 4, m: ['mn001', 'mn001'] }, { w: 4, m: ['mn005'] }, { w: 3, m: ['mn001', 'mn005'] }, { w: 2, m: ['mn005', 'mn005'] },
      { w: 3, m: ['mn009', 'mn009'], far: 1 }, { w: 2, m: ['mn009', 'mn009', 'mn009'], far: 1 }, { w: 3, m: ['mn025', 'mn001'], far: 1 }, { w: 2, m: ['mn025', 'mn025'], far: 1 },
      { w: 3, m: ['mn045'], far: 1 }, { w: 2, m: ['mn045', 'mn009'], far: 1 }, { w: 1, m: ['mn045', 'mn045'], far: 1 } ] },
    abbey: { bg: 'bg_abbey', bgm: 'bgm25', groups: [
      { w: 4, m: ['mn033'] }, { w: 3, m: ['mn033', 'mn033'] }, { w: 4, m: ['mn013', 'mn013'] }, { w: 3, m: ['mn029', 'mn033'] }, { w: 3, m: ['mn029', 'mn029'] },
      { w: 3, m: ['mn021'] }, { w: 2, m: ['mn021', 'mn013'] }, { w: 2, m: ['mn021', 'mn029'] }, { w: 1, m: ['mn013', 'mn013', 'mn033'] } ] },
    // far = not near the road down to 麦の丘 (the east end)
    f02: { bg: 'bg_f02', bgm: 'bgm25', groups: [
      { w: 4, m: ['mn017'] }, { w: 3, m: ['mn037', 'mn037'] }, { w: 3, m: ['mn029', 'mn037'] }, { w: 3, m: ['mn017', 'mn037'] }, { w: 2, m: ['mn017', 'mn029'] },
      { w: 3, m: ['mn006'], far: 1 }, { w: 2, m: ['mn006', 'mn006'], far: 1 }, { w: 3, m: ['mn046', 'mn017'], far: 1 }, { w: 2, m: ['mn046', 'mn046'], far: 1 },
      { w: 2, m: ['mn006', 'mn046'], far: 1 }, { w: 1, m: ['mn046', 'mn046', 'mn037'], far: 1 } ] },
    abbey2: { bg: 'bg_abbey2', bgm: 'bgm25', groups: [
      { w: 4, m: ['mn053'] }, { w: 3, m: ['mn097r', 'mn097b'] }, { w: 3, m: ['mn053', 'mn097r'] }, { w: 3, m: ['mn049'] }, { w: 3, m: ['mn049', 'mn053'] },
      { w: 2, m: ['mn049', 'mn049'] }, { w: 2, m: ['mn097b', 'mn097b', 'mn097r'] }, { w: 2, m: ['mn049', 'mn097b'] }, { w: .5, m: ['mn101'] }, { w: .3, m: ['mn101', 'mn053'] } ] },
  };
  // the fights that wait in one place (the map's `boss`): they cannot be fled from and never come back
  const bosses = { bs01: { bg: 'bg_abbey2', bgm: 'bgm27', group: ['bs01'] } };
  // villagers of 始まりの村 and the people of 王都 (依頼5, the lines of before the wedge).  lines[n] = what they say the n-th time (the last one repeats);
  // alt: other lines once a flag is set (the last that fits wins); offer: something they sell after their lines; inn: true = free, a number = the price
  const npcs = {
    moku:   { name: 'モクじい', lines: [['裏の崖に、鐘の鳴らん修道院がある。\n坊さんはとうにおらんが、', '置いていった物は残っとるそうじゃ。\n下のほうなら子どもでも肝だめしに行く。', '……鐘楼から上には行くなよ。\n行くなと言うと行くんじゃろうがな'], ['鐘楼の扉は内側から閉まっとるが、\n横の壁が崩れとる。', 'そこから登った腕自慢は、\nひとりも降りてきとらん。', 'てっぺんの先に、何か光る物が\nあるんだと。命が十個あったら行け']] },
    mother: { name: 'テトの母ちゃん', lines: [['一攫千金もけっこうだけど、\nごはんは食べていきな。', 'メテムちゃんの分もあるよ']], inn: true },
    yomo:   { name: 'ヨモばあ', lines: [['あの子が本を逆さまに読んどった頃から、\nこうなる気はしとったよ。', '火の術は外でやりな、外で']] },
    dorgo:  { name: 'ドルゴ', lines: [['剣か。くわの方が役に立つぞ。', '……まあいい、\n刃こぼれしたら持ってこい']], shop: 'smith' },
    hanna:  { name: 'ハンナ', lines: [['薬草は多めに持っていきな。\nあんたたち、どうせ無茶するんだから']], shop: 'goods' },
    oz:     { name: '村長のオズ', lines: [['王都へ行く途中の高原に、\n白い遺跡がぽつんと立っておる。', '底に『世界一のお宝』が眠るという\n言い伝えじゃ。', 'まあ、じいさんのじいさんの頃からの\n昔話じゃ。', '中の魔物は並ではないそうじゃぞ']] },
    sem:    { name: '老神官のセム', lines: [['バニや、あの三人を頼むぞ。', '……頼む相手は、\nたぶん間違えておらん'], ['礼拝堂の古い決まりは三つじゃ。', '灯を絶やすな。灯は分けて持て。\n鐘は鳴らすな。', '……三つめの意味は、わしも知らん']] },
    pico:   { name: '羊飼いのピコ', lines: [['晴れた日はね、裏の崖のてっぺんの、\nそのまた先に、', '島みたいなのが浮いて見えるんだ。\n雲の上だよ。', '兄ちゃんたち、あそこ行くの？'], ['村はずれの一本杉の根元に、\nむかしの山賊が', '金貨を埋めたんだって！']] },
    mil:    { name: 'ミル', lines: [['兄ちゃんのへそくり、\n床下にあったよ。', 'もう使っちゃったけど。\n一攫千金で返してね']] },
    bart:   { name: '行商人のバルト', lines: [['王都の酒場は、国じゅうの噂が\n集まる所でさ。', '宝の話なら、まずあそこだ。\n街道沿いに西へ歩けば着く']] },
    // 王都 (依頼5 2-3)
    garam:  { name: '酒場の主人ガラム', lines: [['宝の噂なら、売るほどあるぞ。', 'ただし、噂を聞いて帰ってきた奴の話は、\n売るほどはない。', 'まあ飲め']] },
    ryuka:  { name: '吟遊詩人のリュカ', lines: [['♪むかし偉い人ありて\n　世界と世界を断ち切りぬ', '♪打ちこみしものは今もなお\n　遺跡の奥に眠るとか……', '古い歌さ。\n意味は、誰も知らない']] },
    nezu:   { name: '古地図売りのネズ', lines: [['だんな、宝の地図ですぜ。', '王都の時計塔のてっぺんに、\n王家の冠が隠してある。', 'たったの50枚！']],
              offer: { flag: 'nezumap', price: 50, ask: '宝の地図を、50枚で買う？', yes: '買う', got: '宝の地図を買った。\n時計塔のてっぺんに、印がついている' },
              alt: [{ flag: 'nezumap', lines: [['まいど！\n時計塔は、城門前の広場ですぜ']] }, { flag: ['nezumap', 'nest'], lines: [['夢を買ったと思ってくだせえ']] }] },
    hash:   { name: '冒険者くずれのハッシュ', lines: [['西の港の洞穴で、沈んだ商船を見た。\n積み荷は、まだあった。', '俺は見ただけだ。\n見ただけで、この腕だ']] },
    bren:   { name: '武器屋のブレン', lines: [['いい剣がほしい？\nなら、雪の鉱山町まで行くんだね。', 'うちの倍は切れる。\nたどり着ければ、だけど']], shop: 'c_weapon' },
    sara:   { name: '宿の女将サラ', lines: [['遠くへ行くなら、一度行った町の名前は\n覚えておきな。', '帰り道が楽になるよ']], inn: 30 },
    marg:   { name: '貴婦人マルグリット', lines: [['遠くの砂漠には、砂に埋もれた都が\nあるんですって。', '王の宝物庫には、金貨が\n山になっているそうよ。', 'すてきね。砂は嫌いだけれど']] },
    jino:   { name: '街灯番の少年ジノ', lines: [['ぼく、街の灯りを見てまわる係なんだ。\n消えてたら、つけるの。', '今日は太陽がくっきり見えるから、\nいい日だよ']] },
    guard:  { name: '門番の衛兵', lines: [['王都へようこそ。', '街道の途中の高原に、\n白い遺跡があっただろう。', 'あそこには入るな。腕自慢の兵士でも、\n二つ目の扉で引き返してくる。', '入るなとは言ったぞ']] },
    toto:   { name: '水路番のじいさんトト', lines: [['地下水路か。下水のずっと下に、昔の都が\nそっくり埋まっとるという話だ。', '上の水路は、誰でも入れる。', 'だが二枚目の鉄格子から先へは、わしら\n水路番は、金を積まれても行かん']] },
    elma:   { name: '城の書記エルマ', lines: [['古い記録によると、高原の白い遺跡は、\nお城よりも古いそうです。', '何のために建てたのか。\n記録は、そこで破れています']] },
  };
  const shops = {
    goods: { name: 'よろず屋', items: ['yakusou', 'dokukeshi', 'tent', 'sh01', 'hd01', 'bd01', 'hn01', 'ft01'] },
    smith: { name: '鍛冶屋', items: ['sw01', 'gs01', 'st01', 'bk01', 'dg01', 'bw01', 'hs01', 'mc01'] },
    c_weapon: { name: '王都の武器屋', items: ['sw02', 'gs02', 'st02', 'bk02', 'dg03', 'bw02', 'hs02', 'mc02'] },
    c_armor:  { name: '王都の防具屋', items: ['sh02', 'hd03', 'hd04', 'bd03', 'bd04', 'bd05', 'hn02', 'hn03', 'ft02', 'ac02'] },
    c_item:   { name: '王都の道具屋', items: ['yakusou', 'kizugusuri', 'mpwater', 'dokukeshi', 'tent'] },
  };
  // chests and hidden places (chests.csv).  give: [[item, n] ...], gold; found: what is said instead of "物陰に、何かある。"
  const chests = {
    ch001: { give: [['yakusou', 2]] }, ch002: { give: [['kizugusuri', 1]], gold: 30 },
    ch014: { give: [['yakusou', 3]] }, ch015: { give: [['ac02', 1]] },
    ch045: { give: [['hn03', 1]] }, ch046: { give: [['dg02', 1]] }, ch047: { give: [['yakusou', 3]], gold: 50 },
    cedar: { give: [['spoon', 1]] },
    ch003: { give: [['mpwater', 1]] }, ch004: { give: [['kitsuke', 2]], gold: 100 },                                   // 王都
    ch016: { give: [['kizugusuri', 2]], gold: 60 }, ch018: { give: [['kitsuke', 1]], found: '誰かの荷物が、置き去りになっている。\n中に、まだ使える物がある。' },      // F02
    ch049: { give: [['sb08', 1]] },                                                                                    // 修道院 マップ2, behind the boss
  };
  // ワープ (the old game's menu row): places the party has been to.  A town, or the entrance of a dungeon; `map` + `spawn` = where one lands
  const warps = {
    village: { name: '始まりの村', kind: 'town', map: 'village', spawn: 'start' },
    capital: { name: '王都', kind: 'town', map: 'capital', spawn: 'start' },
    abbey:   { name: '崖の修道院', kind: 'dungeon', map: 'abbey', spawn: 'gate' },
  };
  const start = { gold: 60, items: { yakusou: 3 }, map: 'village', spawn: 'start' };
  return { chars, order, skills, passives, EL, items, SLOTS, BODY_DEF, monsters, encounters, bosses, npcs, shops, chests, warps, start };
})();
