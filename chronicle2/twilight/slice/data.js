// Game data of the first slice (始まりの村 → F01 麦の丘 → 崖の修道院 マップ1).
// Numbers and names come from the scenario tables (results/4周目/data/*.csv, 2周目/依頼11); lines from 依頼5 and 依頼22.
window.RPGDATA = (function () {
  'use strict';
  // stat = base + growth x Lv  (依頼11)
  const chars = {
    teto:  { name: 'テト',   sprite: 'party/hero',   row: 'front', hp: [32, 11],  mp: [6, 1],    str: [8, 2],   def: [6, 1.6], int: [3, .6],  spd: [5, 1.1], dex: [5, 1],  equip: { weapon: 'sw01', shield: 'sh01' } },
    metem: { name: 'メテム', sprite: 'party/sword',  row: 'back',  hp: [24, 7.5], mp: [14, 4],   str: [3, .8],  def: [3, .9],  int: [9, 2.1], spd: [5, 1],   dex: [4, .8], equip: { weapon: 'st01' } },
    pamp:  { name: 'パンプ', sprite: 'party/rogue',  row: 'front', hp: [26, 8],   mp: [8, 1.5],  str: [6, 1.4], def: [4, 1.1], int: [4, .9],  spd: [8, 1.8], dex: [9, 2],  equip: { weapon: 'dg01' } },
    bani:  { name: 'バニ',   sprite: 'party/priest', row: 'back',  hp: [24, 8],   mp: [12, 3.5], str: [5, 1.3], def: [4, 1.2], int: [7, 1.7], spd: [4, .9],  dex: [5, 1],  equip: { weapon: 'hs01' } },
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
    tent:       { name: 'テント', kind: 'tent', price: 300, help: 'セーブ結晶の所で使うと、全員が全回復' },
    koke:   { name: '苔のかけら', kind: 'mat', sell: 16, help: '売ればお金になる' },
    kegawa: { name: 'うさぎの毛皮', kind: 'mat', sell: 22, help: '売ればお金になる' },
    kiba:   { name: '獣の牙', kind: 'mat', sell: 28, help: '売ればお金になる' },
    hane:   { name: '黒い羽', kind: 'mat', sell: 34, help: '売ればお金になる' },
    koishi: { name: '光る小石', kind: 'mat', sell: 34, help: '売ればお金になる' },
    kouhane:{ name: 'コウモリの羽', kind: 'mat', sell: 40, help: '売ればお金になる' },
    tane:   { name: '草の種', kind: 'mat', sell: 40, help: '売ればお金になる' },
    ito:    { name: '蜘蛛の糸', kind: 'mat', sell: 46, help: '売ればお金になる' },
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
    sh01: { name: '木の丸盾', kind: 'gear', slot: 'shield', user: 'teto', def: 2, price: 20, help: 'テトの盾。剣の時だけ持てる' },
    hd01: { name: '革の帽子', kind: 'gear', slot: 'head', def: 1, price: 20, help: '誰でもかぶれる' },
    hn03: { name: '鉄の小手', kind: 'gear', slot: 'hand', user: 'teto', def: 2, sell: 60, help: 'テトの小手' },
    ac02: { name: '鈴の首飾り', kind: 'gear', slot: 'acc', sell: 125, help: '眠りを防ぐ' },
  };
  const SLOTS = [['weapon', '武器'], ['shield', '盾'], ['head', '頭'], ['hand', '手'], ['acc', '飾り']];
  const BODY_DEF = 3;            // the clothes everyone starts in
  // art: file in mon/, h = height in dots on screen, float = hovers; act: attack style (effect), ai: special behaviour
  const monsters = {
    mn001: { name: '苔ぬめり',   lv: 1, hp: 24, atk: 10, def: 5,  spd: 5,  exp: 10, gold: 16, weak: 'fire',  drop: 'kizugusuri', steal: 'koke',       act: 'tackle', ai: 'split' },
    mn005: { name: '角うさぎ',   lv: 2, hp: 26, atk: 12, def: 6,  spd: 9,  exp: 17, gold: 22, weak: 'fire',  drop: 'kegawa',     steal: 'kizugusuri', act: 'thrust', ai: 'runs' },
    mn009: { name: 'のら犬',     lv: 3, hp: 29, atk: 15, def: 8,  spd: 8,  exp: 24, gold: 28, weak: 'fire',  drop: 'kiba',       steal: 'kizugusuri', act: 'bite' },
    mn025: { name: '歩きだけ',   lv: 3, hp: 29, atk: 18, def: 8,  spd: 8,  exp: 24, gold: 28, weak: 'fire',  drop: 'kinoko',     steal: 'kizugusuri', act: 'tackle' },
    mn045: { name: '小鬼',       lv: 4, hp: 51, atk: 17, def: 9,  spd: 9,  exp: 33, gold: 34, weak: 'fire',  drop: null,         steal: 'kizugusuri', act: 'club', ai: 'pickpocket' },
    mn033: { name: '灰ガラス',   lv: 4, hp: 41, atk: 17, def: 9,  spd: 14, exp: 33, gold: 34, weak: 'earth', drop: 'hane',       steal: 'koishi',     act: 'peck', float: 1 },
    mn013: { name: '洞コウモリ', lv: 5, hp: 48, atk: 19, def: 10, spd: 15, exp: 42, gold: 40, weak: 'earth', drop: 'kouhane',    steal: 'kizugusuri', act: 'claw', float: 1, evade: .25 },
    mn029: { name: 'つぼみ食い', lv: 5, hp: 42, atk: 23, def: 10, spd: 10, exp: 42, gold: 40, weak: 'fire',  drop: 'tane',       steal: 'kizugusuri', act: 'bite' },
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
  };
  // villagers of 始まりの村 (依頼5).  lines[n] = what they say the n-th time (the last one repeats)
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
  };
  const shops = {
    goods: { name: 'よろず屋', items: ['yakusou', 'dokukeshi', 'tent', 'sh01', 'hd01'] },
    smith: { name: '鍛冶屋', items: ['sw01', 'gs01', 'st01', 'bk01', 'dg01', 'bw01', 'hs01', 'mc01'] },
  };
  // chests and hidden places (chests.csv).  give: [[item, n] ...], gold
  const chests = {
    ch001: { give: [['yakusou', 2]] }, ch002: { give: [['kizugusuri', 1]], gold: 30 },
    ch014: { give: [['yakusou', 3]] }, ch015: { give: [['ac02', 1]] },
    ch045: { give: [['hn03', 1]] }, ch046: { give: [['dg02', 1]] }, ch047: { give: [['yakusou', 3]], gold: 50 },
    cedar: { give: [['spoon', 1]] },
  };
  const start = { gold: 60, items: { yakusou: 3 }, map: 'village', spawn: 'start' };
  return { chars, order, skills, passives, EL, items, SLOTS, BODY_DEF, monsters, encounters, npcs, shops, chests, start };
})();
