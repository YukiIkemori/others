// 光の神殿 (island in the middle of the sea): five pedestals around the altar;
// with all five crests the keeper performs the ceremony (event temple_altar →
// light_crest, flag barrier_broken). さいはてのほこら (inside the whirlpool
// ring, Lv 31+): the last inn, church and shops before the demon castle.
// Map ids: light_temple edge_shrine
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const hidden = (id, item, under) => ({ hidden: { id, item }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const glow = (id, under) => ({
    npc: { id, sprite: 'obj:crest_glow', cond: 'barrier_broken', fixedDir: true, text: 'もんしょうが あたたかな\nひかりを はなって いる。' },
    under,
  });
  const BROKEN = 'barrier_broken';

  R.DB.maps.light_temple = {
    name: 'ひかりの しんでん', type: 'shrine', legend: 'local', theme: 'shrine', bgm: 'shrine',
    location: 'light_temple', outside: '~',
    exit: { to: 'world', spawn: 'light_temple' },
    rows: [
      '#########################',
      '#~~~~#####i###i#####~~~~#',
      '#~,,~#......4......#~,,~#',
      '#~,f~#.l..+++++..l.#~f,~#',
      '#~,,~#..5.++A++.7..#~,,~#',
      '#~f,~#....++0++....#~,f~#',
      '#~,,~#.l..+++++..l.#~,,~#',
      '#~,,~#......+......#~,,~#',
      '#~,f~#...8..+..9...#~f,~#',
      '#~,,~#.l....+....l.#~,,~#',
      '#~~~~#......+......#~~~~#',
      '#,,,,#######D#######,,,,#',
      '#,,,,#......+......#,,,,#',
      '#,f,,#.Y.~~.+.~~.Y.#,,f,#',
      '#,,,,#...~~.+.~~...#,,,,#',
      '#,,f,#.N.~~.+.~~.M.#,f,,#',
      '#,,,,#...~~.+.~~...#,,,,#',
      '#,f,,#.Y.~~.+.~~.Y.#,,f,#',
      '#,,,,#......+.....$#,,,,#',
      '#,,,,###i###D###i###,,,,#',
      '#,f,,,,,,,,,:,,,,,,,,,f,#',
      '#,,,,f,,,,,,:,,,,,,f,,,,#',
      '#,,,,,,,,,,,:,,,,,,,,,,,#',
      '############@############',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      A: npc('keeper', 'sage', '+', { event: 'temple_altar', dir: 'down' }),
      '0': { npc: { id: 'glow_light', sprite: 'obj:crest_glow', cond: BROKEN, fixedDir: true, text: 'ひかりの もんしょうの\nちからが さいだんに\nやどって いる……。' }, under: 'a' },
      '4': glow('glow_wind', 'C'),
      '5': glow('glow_water', 'C'),
      '7': glow('glow_earth', 'C'),
      '8': glow('glow_fire', 'C'),
      '9': glow('glow_star', 'C'),
      N: npc('temple_nun', 'nun', '.', { event: 'church', greet: 'ひかりの しんでんへ ようこそ。\nここで やすみ おいのりを\nして いきなさい。', dir: 'right' }),
      M: chat('temple_monk', 'priest', '.', [
        { cond: BROKEN, text: 'まのうずの きえた いまこそ\nまおうを うつ ときです。\fかみの ひかりが\nあなたたちと ともに ありますように。' },
      ], ['この しんでんは 100ねん まえ\nゆうしゃたちが ひかりの もんしょうを\nうみだした ばしょ。', 'おくの さいだんを かこむ\nいつつの だいざに\nもんしょうを ささげるのです。'], { dir: 'left' }),
      '$': chest('light_temple_c1', 'light_drop', 1),
    },
  };

  R.DB.maps.edge_shrine = {
    name: 'さいはての ほこら', type: 'shrine', legend: 'local', theme: 'shrine', bgm: 'shrine',
    location: 'edge_shrine', outside: '~',
    exit: { to: 'world', spawn: 'edge_shrine' },
    rows: [
      '####i#####i##i#####i####',
      '#b.b.b.#.Y.O..Y.#uuuuuu#',
      '#b.b.b.#...aa...#E.G.H.#',
      '#......#...++...#cccccc#',
      '#...I..#.l.++.l.#......#',
      '#.cccc.#...++...D..v...#',
      '#......D...++...#......#',
      '#.N....#.l.++.l.#jo..?o#',
      '########...++...########',
      '#,,,,,,,###DD###,,,,,,,#',
      '#,f~~~f,,,,::,,,,f~~~f,#',
      '#,f~~~f,,,,::,,,,f~~~f,#',
      '#,,,,,,,z,,::,,y,,,,,,,#',
      '#,,,,,,,,,,::,,,,,,,,,,#',
      '###########@:###########',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      O: npc('priestess', 'nun', '.', { event: 'church', greet: 'さいはての ほこらへ ようこそ。\nここが さいごの いやしの ばしょ。', dir: 'down' }),
      I: npc('innkeeper', 'innkeeper', '.', { event: 'inn', price: 80, dir: 'down' }),
      E: shop('weapon', '.', 'edge_shrine_weapon', { dir: 'down' }),
      G: shop('armor', '.', 'edge_shrine_armor', { dir: 'down' }),
      H: shop('item', '.', 'edge_shrine_item', { dir: 'down' }),
      v: say('customer', 'woman', '.', 'ここまで きたら おしみなく\nいい そうびを そろえるのよ。\fおかねを のこしても\nまおうは まけて くれないわ。', { dir: 'up' }),
      N: say('inn_guest', 'knight', '.', 'わしは レグナスの きし。\fまおうじょうには まおうの しもべ\nふたりの しょうぐんが おると いう。\fくろい よろいの きしと\nやみの まどうし……。\nこころして いくのだぞ。', { dir: 'down' }),
      z: say('traveler', 'old_man', ',', 'まおうじょうは この しまの ひがし。\nやみの ちからが\nうずまいて おる……。\fなかは ふかく いりくんで おる。\nときどき もどって やすむのじゃ。', { dir: 'down' }),
      y: chat('maiden', 'girl', ',', [
        { cond: 'game_clear', text: 'まおうを たおして\nくださったのですね……！\nありがとう ございます！' },
      ], ['わたしは この ほこらの みこ。\fここの いのりは まおうの\nやみから みを まもる\nさいごの ひかりなのです。', 'まおうは ひかりの ちからを\nなにより おそれて いると\nつたえられて います。'], { dir: 'down' }),
      '?': hidden('edge_shrine_h1', 'revive_feather', 'o'),
    },
  };
})(window.RPG);
