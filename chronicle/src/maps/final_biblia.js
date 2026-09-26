// 書の都ビブリア (biblia): the last town, on ビブリア島 in the middle of the inner sea (DESIGN §10.10.2,
// §10.6.1, §11.2.6). Owner: story (A19). Theme `town_white` (marble streets, white stone houses), BGM
// `sorrow` while the town is white (final_arrived … the ending), `town` after the ending (§11.10.4).
//
// Layout (48×42), inside a white town wall:
//   north   : the gate to the island's road (exit → world spawn `biblia`; 白の大書庫 is to the north-east)
//             · 記録院 本院 (the hall of the Records with ラザロ's portrait) · the great library
//   middle  : ノアの宿 (inn) · the plaza with the fountain and the nameless storyteller's statue · the tavern
//   south   : the item shop · the weapon & armour shop · two homes · the harbour basin (ferry pier, spawn dock)
//
// Contracts: spawns entrance / inn / dock (§10.13.3) and plaza (the ending's E4). NPC ids inn · tavern ·
// shop_item / shop_weapon / shop_armor · ferry (ferryFrom 'biblia') · folk_a (rumor biblia_a) · noa · rowell
// (the north gate, ['final_arrived','!final_rowell']). onEnter biblia_arrival (once, §10.10.2).
(function (R) {
  'use strict';
  const K = R.Final;
  const POST = { postgame: true };

  // ------------------------------------------------------------ terrain
  const g = K.grid(48, 42, ',');
  // the fields outside the wall, the north road
  K.put(g, 0, 0, ',TT,T,,TT,,T,,TT,,T,,,,..,,,,T,,TT,,T,,TT,,T,TT,');
  K.put(g, 0, 1, 'T,,T,,T,,,T,,T,,,,T,,,,..,,,T,,,T,,,T,,T,,,T,,T');
  // the town wall and the streets inside
  K.fill(g, 1, 2, 46, 40, '#');
  K.fill(g, 2, 3, 44, 34, '.');
  K.put(g, 23, 2, '..');
  // gardens: grass along the walls
  K.fill(g, 2, 15, 1, 12, ',');
  K.fill(g, 45, 15, 1, 12, ',');
  // 記録院 本院
  K.house(g, 3, 4, 18, 11, { floor: '_', doors: [8] });
  K.fill(g, 10, 7, 3, 7, '+'); // the carpet from the door to the desk
  K.put(g, 4, 6, ['kkkkk', 'k']);
  K.put(g, 15, 6, ['kkkkk', '    k']);
  K.put(g, 5, 10, 'tt');
  K.put(g, 16, 10, 'tt');
  // the great library
  K.house(g, 27, 4, 18, 10, { floor: '_', doors: [9] });
  K.put(g, 28, 6, 'kkkkkk');
  K.put(g, 38, 6, 'kkkkkk');
  K.put(g, 29, 8, 'kkkk');
  K.put(g, 39, 8, 'kkkk');
  K.put(g, 29, 10, 'kkkk');
  K.put(g, 39, 10, 'kkkk');
  K.put(g, 35, 8, 'C');
  // the plaza
  K.fill(g, 17, 17, 14, 9, ',');
  K.fill(g, 17, 20, 14, 3, '.');
  K.fill(g, 22, 17, 4, 9, '.');
  K.put(g, 23, 18, 'Y');
  // ノアの宿
  K.house(g, 3, 17, 12, 9, { floor: '_', doors: [6] });
  K.put(g, 4, 21, 'cccc');
  K.put(g, 11, 19, ['b b', 'b b']);
  K.put(g, 13, 23, 'b');
  K.put(g, 13, 22, 'b');
  K.put(g, 10, 23, 't');
  // the tavern
  K.house(g, 33, 17, 12, 9, { floor: '_', doors: [5] });
  K.put(g, 34, 21, 'ccccc');
  K.put(g, 41, 20, 't');
  K.put(g, 36, 23, 't');
  K.put(g, 41, 23, 't');
  // the item shop
  K.house(g, 3, 28, 9, 7, { floor: '_', doors: [4] });
  K.put(g, 4, 31, 'ccc');
  K.put(g, 9, 30, 'uu');
  // the weapon & armour shop
  K.house(g, 14, 28, 13, 7, { floor: '_', doors: [3, 9] });
  K.put(g, 15, 31, 'ccc');
  K.put(g, 21, 31, 'ccc');
  // two homes
  K.house(g, 29, 28, 8, 7, { floor: '_', doors: [3] });
  K.put(g, 30, 30, ['b', 'b']);
  K.put(g, 34, 31, 't');
  K.house(g, 38, 28, 8, 7, { floor: '_', doors: [3] });
  K.put(g, 43, 30, ['b', 'b']);
  K.put(g, 39, 31, 'k');
  // the harbour basin (the sea gate in the south wall), the ferry pier
  K.fill(g, 2, 37, 44, 4, '~');
  K.put(g, 22, 41, '~~~~');
  K.put(g, 36, 37, ['|', '|']);
  K.put(g, 10, 37, ['|']);
  // trees and flowers in the streets
  K.put(g, 2, 3, 'T'); K.put(g, 45, 3, 'T'); K.put(g, 2, 13, 'T'); K.put(g, 45, 13, 'T');
  K.put(g, 17, 17, 'T'); K.put(g, 30, 17, 'T'); K.put(g, 17, 25, 'T'); K.put(g, 30, 25, 'T');
  K.put(g, 2, 36, 'T'); K.put(g, 45, 36, 'T');
  K.put(g, 27, 36, 'ff'); K.put(g, 13, 36, 'ff');
  // sign posts (the signs below stand on them)
  K.put(g, 21, 3, 'm'); K.put(g, 13, 15, 'm'); K.put(g, 40, 14, 'm'); K.put(g, 8, 3, 'm');

  // ------------------------------------------------------------ decor
  // wall faces: windows, scroll racks, the portrait of ラザロ, the library's arch windows, signs by the doors
  K.deco(g, 3, 5, '..w..}..P..}..w...');
  K.deco(g, 27, 5, '..W....w..w....W..');
  K.deco(g, 3, 18, '..w.F..w....');
  K.deco(g, 33, 18, '.HH..w..NN..');
  K.deco(g, 3, 29, '.$..k....');
  K.deco(g, 14, 29, '..X..x..YY...');
  K.deco(g, 29, 29, '..w..v..');
  K.deco(g, 38, 29, '..w..A..');
  // 記録院 本院: the great desk, lecterns, piles of books, chairs
  K.deco(g, 10, 8, '.D.');
  K.put(g, 5, 9, 'hh');
  K.put(g, 16, 9, 'hh');
  K.put(g, 5, 11, 'hh');
  K.put(g, 16, 11, 'hh');
  K.deco(g, 7, 12, '>');
  K.deco(g, 15, 12, '>');
  K.deco(g, 4, 13, '{');
  K.deco(g, 19, 13, '{{');
  K.deco(g, 8, 8, '=');
  K.deco(g, 14, 10, '=');
  // the library: globe, lectern, reading chairs, piles
  K.deco(g, 28, 12, 'I');
  K.deco(g, 43, 12, 'Q');
  K.deco(g, 34, 11, '>');
  K.deco(g, 36, 11, '{');
  K.put(g, 30, 12, 'hh');
  K.put(g, 40, 12, 'hh');
  // the inn: rug, chairs, plant
  K.deco(g, 7, 23, '&&');
  K.put(g, 9, 23, 'h');
  K.put(g, 11, 23, 'h');
  K.deco(g, 4, 24, 'Z');
  K.deco(g, 9, 19, 'y');
  // the tavern: chairs round the tables, a stage
  K.put(g, 40, 20, 'h h');
  K.put(g, 35, 23, 'h h');
  K.put(g, 40, 23, 'h h');
  K.deco(g, 43, 19, 'Z');
  // shops
  K.deco(g, 4, 30, 'q');
  K.deco(g, 10, 33, 'v');
  K.deco(g, 25, 30, 'U');
  K.deco(g, 20, 33, 'Z');
  // homes
  K.put(g, 33, 31, 'h h');
  K.deco(g, 32, 33, '&');
  K.deco(g, 40, 31, '!');
  K.deco(g, 42, 33, '?');
  // the streets: lamps, signs, benches, flowerbeds, the fountain, papers drifting in the white town
  K.deco(g, 4, 15, '3...............3.......3..............3');
  K.deco(g, 8, 26, '7');
  K.deco(g, 39, 26, 'j');
  K.deco(g, 6, 35, '4');
  K.deco(g, 16, 35, '5');
  K.deco(g, 24, 35, '6');
  K.deco(g, 18, 18, '11');
  K.deco(g, 28, 18, '11');
  K.deco(g, 18, 24, '11');
  K.deco(g, 28, 24, '11');
  K.deco(g, 23, 20, ['JJJ', 'JJJ', 'JJJ']);
  K.deco(g, 19, 21, 'e');
  K.deco(g, 28, 21, 'e');
  K.deco(g, 20, 17, '3');
  K.deco(g, 27, 17, '3');
  K.deco(g, 20, 25, '3');
  K.deco(g, 27, 25, '3');
  K.deco(g, 13, 16, '=');
  K.deco(g, 31, 22, '=');
  K.deco(g, 25, 27, '=');
  K.deco(g, 5, 27, '=');
  K.deco(g, 42, 15, '=');
  K.deco(g, 32, 36, 'N');
  K.deco(g, 34, 36, 'U');
  K.deco(g, 12, 38, '|');
  K.deco(g, 20, 36, '(');

  // ------------------------------------------------------------ people
  const WHITE = { cond: ['final_arrived', '!game_clear'] }; // the town lost itself (§10.10.2)
  const lines = (post, white) => [{ cond: POST, text: post }, { text: white }];

  const def = {
    name: '書の都ビブリア', type: 'town', theme: 'town_white',
    get bgm() { return R.Game && R.Game.gameClear ? 'town' : 'sorrow'; },
    location: 'biblia', region: 'finale', outside: ',', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'biblia' },
    onEnter: 'biblia_arrival',
    decorLegend: { '|': 'boat' },
    rows: K.rows(g),
    decor: K.decor(g),
    spawns: {
      entrance: { x: 24, y: 3, dir: 'down' },
      inn: { x: 9, y: 26, dir: 'down' },
      dock: { x: 36, y: 37, dir: 'up' },
      plaza: { x: 24, y: 24, dir: 'up' },
    },
    npcs: [
      // --- the north gate
      K.npc('rowell', 'rowell', 25, 4, { event: 'biblia_rowell', cond: ['final_arrived', '!final_rowell'], dir: 'down', fixed: true }),
      K.talk('gate_guard', 'soldier', 22, 4, lines(
        '大書庫は、北東の丘の上だ。\n霧が晴れて、道がよく\n見えるようになったよ。',
        '……門番？　そうだ、\nわたしは門番だった……\nはずだ。たぶん。'), { dir: 'down', fixed: true }),
      // --- 記録院 本院
      K.talk('clerk_a', 'scholar', 6, 9, lines(
        '白の書は、もうありません。\nこれからは、書き写すより\n先に、聞くことから始めます。',
        '写さなければ……\nでも、何を写すんでしたっけ。\n白いページしか、ない……。'), { dir: 'down', fixed: true }),
      K.talk('clerk_b', 'scholar', 17, 9, lines(
        '院長さまは、小さな部屋で\n古い本を手で写しています。\nそっとしておいてあげて。',
        '院長さまが、わたしたちに\n何か言いつけていたような。\n……思い出せません。'), { dir: 'down', fixed: true }),
      K.talk('clerk_c', 'scribe', 11, 12, lines(
        'わたしも、昔は各地の伝承を\n写して回っていました。\n今度は、覚えて回ります。',
        '伝承を、書物に……\n書物に、すれば……\nあれ、何のためだっけ。'), { move: 'wander', push: true }),
      // --- the great library
      K.talk('librarian', 'sage', 35, 7, lines(
        '棚の本に、字が戻ってきた。\nまるで、長い冬が\n明けたようです。',
        '棚の本の字が、白く……\nわたしは、ここで何を\n守っていたのだろう。'), { dir: 'down', fixed: true }),
      K.talk('reader', 'scholar', 31, 11, lines(
        '「紋章の大陸」の伝説を\n読み返しています。\n名の残らない勇者たちの話を。',
        '字を追っても、\n頭に残らないんです。\n……読むって、何でしたっけ。'), { dir: 'up', push: true }),
      K.talk('reader_girl', 'girl', 41, 11, lines(
        'お母さんが、ねる前に\nお話を読んでくれたの！\nあしたも読んでくれるって。',
        '……ご本、まっしろ。\nおはなし、どこへ\nいっちゃったの？'), { dir: 'up', push: true }),
      // --- ノアの宿
      K.npc('inn', 'innkeeper', 6, 20, { event: 'common_inn', fixed: true,
        greet: '……いらっしゃいませ。\nええと……そう、宿屋です。\nノアが、教えてくれました。' }),
      K.npc('noa', 'woman', 8, 22, { event: 'biblia_noa', dir: 'down', fixed: true }),
      // --- the plaza
      K.npc('folk_a', 'man', 20, 23, { event: 'story_rumor', rumor: 'biblia_a', move: 'wander', push: true }),
      K.talk('bench_old', 'old_man', 19, 21, lines(
        'ミラお嬢さんが、よく\nこの噴水のそばで\n歌っていたものじゃ。',
        '噴水の音は、覚えておる。\nじゃが、誰と聞いたのか……\nそれが、思い出せん。'), { dir: 'right', push: true }),
      K.talk('plaza_boy', 'boy', 26, 23, lines(
        '語り部さんのお話、\n広場で聞いたよ！\nぼくも、覚えて帰るんだ！',
        'ぼくの名前……\nなんだっけ。\n母さんが、呼んでたのに。'), { move: 'wander', push: true }),
      K.talk('mother', 'woman', 27, 21, lines(
        'あの子の名前を、ちゃんと\n呼んであげられるの。\n……当たり前のことなのにね。',
        'あの子を探しているの。\nでも、どんな子だったか\n思い出せなくて……。'), { dir: 'left', push: true }),
      // --- the tavern
      K.npc('tavern', 'bartender', 36, 20, { event: 'common_tavern', fixed: true,
        greet: '……ああ、客か。\n手が、覚えているんだ。\n酒場の仕事ってやつを。' }),
      K.talk('bard', 'bard', 42, 21, lines(
        '三人の勇者の歌を、\n東の大陸の吟遊詩人から\n教わったんだ。一曲どうだい？',
        '♪　ラ、ラ……\n……だめだ。歌の続きが、\nまっしろだ。'), { dir: 'left', fixed: true }),
      K.talk('merchant', 'merchant', 37, 23, lines(
        'レグナスの商船が、\nこの島にも寄るように\nなるそうだ。楽しみだね。',
        '商いの帳簿が、真っ白でね。\nいくら貸したか、\nいくら借りたか……。'), { dir: 'up', push: true }),
      K.talk('drinker', 'sailor', 42, 24, lines(
        '記録院の連中も、今じゃ\nここで歌ってるよ。\n下手くそだけどな！',
        '……乾杯。\nなにに、乾杯……\nするんだったかな。'), { dir: 'up', push: true }),
      // --- shops
      K.npc('shop_item', 'merchant', 5, 30, { event: 'common_shop', shop: 'biblia_item', fixed: true }),
      K.npc('shop_weapon', 'dwarf', 16, 30, { event: 'common_shop', shop: 'biblia_weapon', fixed: true }),
      K.npc('shop_armor', 'merchant', 22, 30, { event: 'common_shop', shop: 'biblia_armor', fixed: true }),
      // --- homes
      K.talk('home_old', 'old_woman', 32, 32, lines(
        '亡くなった夫の口ぐせを、\n思い出したよ。\n「今日も、いい日だ」ってね。',
        'この家には、誰かと\n住んでいた気がするの。\n……気のせいかしら。'), { dir: 'left', push: true }),
      K.talk('home_man', 'man', 41, 32, lines(
        '娘が、機織りの歌を\n歌ってくれるんだ。\n母親ゆずりの、いい声だよ。',
        '機織り機があるのに、\n使い方が分からない。\n……俺のものだったかな。'), { dir: 'down', push: true }),
      // --- the harbour
      K.npc('ferry', 'sailor', 37, 36, { event: 'common_ferry', ferryFrom: 'biblia', dir: 'down', fixed: true }),
      K.talk('ship', 'obj:ship', 38, 38, '定期船だ。\nファロスの港と、\nこの島を結んでいる。', { dir: 'left', fixed: true }),
      K.talk('quay_fisher', 'fisher', 12, 36, lines(
        '海の向こうから、\n霧のない朝日が昇るんだ。\n毎朝、見とれちまうよ。',
        '釣り道具を持って、\nここに立っていた。\nそれしか、覚えてないんだ。'), { dir: 'down', push: true }),
      K.talk('cat', 'cat', 27, 32, 'ニャーオ。\n猫は、何も忘れていない\nような顔をしている。', { move: 'wander', push: true }),
    ],
    signs: [
      K.sign(21, 3, '書の都ビブリア\n記録院の本院のある町'),
      K.sign(13, 15, '記録院　本院'),
      K.sign(40, 14, 'ビブリア大図書館'),
      K.sign(8, 3, '北東の丘の上に、\n白の大書庫がある。'),
    ],
    chests: [
      K.chest('biblia_c1', 44, 32, 'p_supply'),
      K.chest('biblia_c2', 4, 33, 'p_gold'),
    ],
    events: [
      K.exam('biblia_portrait', 11, 5),
      K.exam('biblia_statue', 23, 18),
      K.exam('biblia_tome', 35, 8),
    ],
  };
  R.DB.maps.biblia = K.check('biblia', def);
  K.BIBLIA_WHITE = WHITE;
})(window.RPG);
