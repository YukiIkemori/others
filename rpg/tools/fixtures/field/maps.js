// Field test fixtures: a small world (sea, ship, barrier, zones), a town
// (NPCs, counter, doors, chest, hidden item, sign, inn/church fallbacks,
// conds, onEnter, step event) and a two-floor dungeon (stairs, silver door,
// lava, poison, visible boss, tilePatch seal). Loaded only by the field test
// harness — never part of the game build.
(function (R) {
  'use strict';
  const DB = R.DB;

  Object.assign(DB.maps, {
    fx_world: {
      name: 'テストの せかい', type: 'world', legend: 'world', bgm: 'overworld',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~bbbbbbbbb~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~bb...TTT.bb~~~~~~~~~~~~~~~~~bbbb~~~~~',
        '~~~b...TTTTT.b~~~~~~~~~~~~~~~~bb..bb~~~~',
        '~~~b..nnTTMMMbb~~~~~~~~~~~~~~~b..e.b~~~~',
        '~~~b.a..nnMMMMb~~~~~~~~~~~~~~~b....b~~~~',
        '~~~b.......MMMb~~~~~~~~~~~~~~~bb..bb~~~~',
        '~~~b..@.....c.b~~~~~~~~~~~~~~~~bbbb~~~~~',
        '~~~b.........xb~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~b..,,,,..xxb~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~bb.,,,,...bb~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~bb..=...bb~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~bbb|bbbb~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~bb.bbg~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~b.....b~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~b..TT.b~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~bb...bb~~~~~~~~~~~~~~~~wwwwww~~~~~',
        '~~~~~~~bbbbb~~~~~~~~~~~~~~~~ww^^^^ww~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~w^kkkk^w~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~w^kXkk^w~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~w^kkkkkw~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~ww^^^kww~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~wwwwwww~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      marks: {
        '@': { spawn: 'start', dir: 'down' },
        'a': { warp: { to: 'fx_town', spawn: 'entrance' }, spawn: 'fx_town', under: 'V' },
        'c': { warp: { to: 'fx_dungeon_1', spawn: 'entrance' }, spawn: 'fx_dungeon_1', under: 'O' },
        'e': { warp: { to: 'fx_town', spawn: 'entrance' }, spawn: 'fx_village', under: 'v' },
        'g': { spawn: 'fx_dock', dir: 'left', under: '~' },
      },
      zones: [{ x: 0, y: 0, w: 20, h: 30, zone: 'fx_w1' }],
      defaultZone: 'fx_w2',
    },

    fx_town: {
      name: 'テストの まち', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
      location: 'fx_town', outside: ',',
      rows: [
        ',,,,,,,,,,,,,,,,,,,,,,',
        ',TTTTTTTTT::TTTTTTTTT,',
        ',T,,f,,,,,::,,,,,,,fT,',
        ',T,BBBBBB,::,BBBBBB,T,',
        ',T,B____B,::,B++++B,T,',
        ',T,B_A__B,::,B++++B,T,',
        ',T,BccccB,::,B++++B,T,',
        ',T,B___$B,::,BBBDBB,T,',
        ',T,BBDBBB,::,,,,:,,,T,',
        ',T,,,::::::::::::,,,T,',
        ',T,%,,,,,,::,,,,,,,,T,',
        ',T,,,,,,,,::,,&,,,E,T,',
        ',T,f,,G,,,::,,,,,,,,T,',
        ',T,,,,,,,,::,,H,,,f,T,',
        ',TTTTTTTTT@:TTTTTTTTT,',
        ',,,,,,,,,,::,,,,,,,,,,',
      ],
      marks: {
        '@': { spawn: 'entrance', dir: 'up', under: ':' },
        'A': { npc: { id: 'shopkeeper', sprite: 'npc:merchant', dir: 'down', event: 'fx_shop' }, under: '_' },
        '$': { chest: { id: 'fx_town_c1', item: 'holy_water', n: 2 }, under: '_' },
        'G': { npc: { id: 'kid', sprite: 'npc:boy', move: 'wander', text: ['ぼく いつか ぼうけんしゃに なるんだ！'] }, under: ',' },
        'E': { npc: { id: 'elder', sprite: 'npc:elder', dir: 'left', event: 'fx_elder' }, under: ',' },
        'H': { npc: { id: 'guard', sprite: 'npc:soldier', move: 'spin', text: 'この まちは へいわだよ。\fでも そとには まものが いるから きをつけてね。' }, under: ',' },
        '%': { sign: { text: 'ここは テストの まち。\nきたに いどが ある。' }, under: 'm' },
        '&': { hidden: { id: 'fx_town_h1', item: 'seed_str' }, under: 'W' },
      },
      npcs: [
        { id: 'priest', x: 16, y: 5, sprite: 'npc:priest', dir: 'down', event: 'fx_church' },
        { id: 'ghost_girl', x: 4, y: 11, sprite: 'npc:girl', move: 'wander', cond: 'fx_elder_done', text: 'ちょうろうさんと おはなし したんだね！' },
      ],
      hidden: [{ id: 'fx_town_h2', x: 19, y: 2, gold: 50 }],
      events: [{ x: 10, y: 12, id: 'fx_step_hello', trigger: 'step', once: 'fx_step_hello_done' }],
      exit: { to: 'fx_world', spawn: 'fx_town' },
      onEnter: 'fx_town_enter',
    },

    fx_dungeon_1: {
      name: 'テストの どうくつ', type: 'dungeon', legend: 'local', theme: 'cave', bgm: 'cave',
      encounter: 'fx_d1', encRate: 12,
      rows: [
        '####################',
        '#<....#...........##',
        '#.....#.LLLLL.....##',
        '#..$..1.LLLLL..>..##',
        '#.....#.LLLLL.....##',
        '##.####...........##',
        '##.#####xxxxxx######',
        '##..............%..#',
        '####################',
      ],
      marks: {
        '<': { warp: { to: 'fx_world', spawn: 'fx_dungeon_1' }, spawn: 'entrance', dir: 'down', under: 'S' },
        '>': { warp: { to: 'fx_dungeon_2', spawn: 'up' }, spawn: 'down', under: 's' },
        '$': { chest: { id: 'fx_d1_c1', gold: 120 } },
        '%': { chest: { id: 'fx_d1_key', item: 'silver_key' } },
      },
      escape: { to: 'fx_world', spawn: 'fx_dungeon_1' },
    },

    fx_dungeon_2: {
      name: 'テストの どうくつ ちか2かい', type: 'dungeon', legend: 'local', theme: 'cave', bgm: 'cave',
      encounter: 'fx_d2',
      rows: [
        '##i###i####',
        '#<.......##',
        '#...#....##',
        '#...#....##',
        '#.......###',
        '#####3#####',
        '#.........#',
        '#....$....#',
        '###########',
      ],
      marks: {
        '<': { warp: { to: 'fx_dungeon_1', spawn: 'down' }, spawn: 'up', dir: 'down', under: 'S' },
        '$': { chest: { id: 'fx_d2_c1', item: 'crest_wind' } },
      },
      npcs: [{ id: 'boss', x: 5, y: 4, sprite: 'mon:golem', cond: '!fx_boss_done', event: 'fx_boss' }],
      tilePatches: [{ cond: 'fx_boss_done', x: 5, y: 5, ch: '.' }],
      escape: { to: 'fx_world', spawn: 'fx_dungeon_1' },
    },
  });

  Object.assign(DB.locations, {
    fx_town: { name: 'テストの まち', map: 'fx_world', spawn: 'fx_town', dock: 'fx_dock' },
  });

  Object.assign(DB.events, {
    fx_town_enter: {
      run: async (ev) => {
        if (ev.flag('fx_town_seen')) return;
        ev.setFlag('fx_town_seen');
        await ev.say('テストの まちに ついた。');
      },
    },
    fx_step_hello: {
      run: async (ev) => {
        await ev.say('いしだたみの みちが つづいている。');
      },
    },
    fx_elder: {
      meta: { gives: ['flag:fx_elder_done', 'item:gold_key'] },
      run: async (ev) => {
        ev.npc('elder').face('player');
        if (ev.flag('fx_elder_done')) { await ev.say('ふねは みなみの はまべに あるぞ。'); return; }
        await ev.say('おお {leader}よ。 よくぞ まいった。');
        const i = await ev.ask('わしの ねがいを きいて くれるか？', ['はい', 'いいえ']);
        if (i !== 0) { await ev.say('そうか……。 きが かわったら また きておくれ。'); return; }
        await ev.say('では これを もっていくがよい。');
        await ev.give('gold_key');
        ev.giveShip('fx_dock');
        ev.setFlag('fx_elder_done');
        await ev.say('みなみの はまべに ふねも よういした。\nきを つけて いくのじゃぞ。');
        await ev.npc('elder').walk('LL');
        ev.npc('elder').face('right');
      },
    },
    fx_shop: {
      run: async (ev) => {
        await ev.say('いらっしゃい！ どうぐやへ ようこそ。');
        await ev.shop('regnas_item');
      },
    },
    fx_church: { run: async (ev) => { await ev.church(); } },
    fx_boss: {
      meta: { gives: ['flag:fx_boss_done'] },
      run: async (ev) => {
        await ev.say('ゴーレムが たちはだかった！');
        const r = await ev.battle('fx_golem', { noEscape: true });
        if (r !== 'win') return false;
        ev.npc('boss').hide();
        ev.setFlag('fx_boss_done');
        await ev.say('ふういんが とけた！');
      },
    },
  });

  if (!DB.troops.fx_golem) DB.troops.fx_golem = { mons: [['golem', 1, 1]], bg: 'cave', bgm: 'boss', noEscape: true };
  for (const z of ['fx_w1', 'fx_w2', 'fx_d1', 'fx_d2']) {
    if (!DB.encounters[z]) DB.encounters[z] = { lv: [1, 3], bg: z.startsWith('fx_d') ? 'cave' : 'grass', groups: [{ w: 1, mons: [['jelly', 1, 3]] }] };
  }
})(window.RPG);
