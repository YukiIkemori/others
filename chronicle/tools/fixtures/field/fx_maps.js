// Field fixtures (owner A4): a small wrapping world (roads, forest, a secret rock
// passage to a chest, a conditional warp, fog), a 40×32 town (inn, tavern, shop,
// counters, pushable folk, a fixed guard, {cond,text} lines, a tier sign, pool
// chests, a step event, onEnter), a two-floor cave (stairs, damage floor, a secret
// wall to a rare chest, a vine wall opened by two levers through a {var,gte}
// tilePatch, a conditional warp pad, a rest lantern, a visible boss), and small
// rooms for the movement / push / wrap / camera tests. Loaded only by
// tools/test_field.js and the harness page (node tools/build.js --with
// tools/fixtures/field → debug_field.html) — never part of the game build.
(function (R) {
  'use strict';
  const DB = R.DB;

  // ------------------------------------------------------------ helpers (rows from painted grids)
  const grid = (w, h, ch) => Array.from({ length: h }, () => Array(w).fill(ch));
  const paint = (g, x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] != null) g[j][i] = ch; };
  const put = (g, x, y, ch) => { if (g[y] && g[y][x] != null) g[y][x] = ch; };
  const rows = (g) => g.map((r) => r.join(''));
  /** a house: housewall ring, wooden floor, a door in the bottom wall, a counter row */
  function house(g, x, y, w, h, doorX, counterY) {
    paint(g, x, y, w, h, 'B');
    paint(g, x + 1, y + 1, w - 2, h - 2, '_');
    put(g, doorX, y + h - 1, 'D');
    if (counterY != null) paint(g, x + 1, counterY, w - 2, 1, 'c');
  }

  // ------------------------------------------------------------ world (48×36, wraps)
  const W = grid(48, 36, '~');
  paint(W, 4, 4, 40, 28, '.');
  paint(W, 5, 5, 6, 4, 'T');
  paint(W, 28, 5, 12, 4, 'M');
  paint(W, 22, 22, 10, 7, 'T');
  paint(W, 8, 16, 30, 1, 'r'); // the road
  paint(W, 12, 11, 1, 5, 'r');
  paint(W, 36, 17, 1, 3, 'r');
  // a rock ridge with a secret passage (secret_rock '&') to a hidden hollow holding a chest
  paint(W, 37, 21, 7, 9, 'M');
  paint(W, 41, 24, 2, 3, '.');
  put(W, 38, 25, '&'); put(W, 39, 25, '&'); put(W, 40, 25, '&');
  paint(W, 44, 10, 2, 3, 'g'); // a patch of white fog on the sea
  put(W, 12, 10, 'V'); // town icon
  put(W, 36, 20, 'O'); // cave icon
  put(W, 20, 8, 'A'); // shrine icon: its warp only works once fx_shrine_open is set

  // ------------------------------------------------------------ town (40×32)
  const T = grid(40, 32, ',');
  paint(T, 0, 0, 40, 1, 'T'); paint(T, 0, 0, 1, 32, 'T'); paint(T, 39, 0, 1, 32, 'T'); paint(T, 0, 31, 40, 1, 'T');
  paint(T, 19, 11, 2, 21, ':'); // the main street, open at the bottom edge
  paint(T, 3, 12, 34, 2, ':');
  house(T, 3, 2, 11, 9, 8, 5); // inn
  house(T, 16, 2, 9, 9, 20, 5); // tavern
  house(T, 27, 2, 10, 9, 31, 5); // shop
  paint(T, 8, 11, 1, 1, ':'); paint(T, 20, 11, 1, 1, ':'); paint(T, 31, 11, 1, 1, ':');
  put(T, 17, 15, 'm'); // the notice board
  // a fenced lane (1 wide) with a townsman in it, a dead end at its east end
  paint(T, 25, 23, 11, 1, 'F'); paint(T, 25, 25, 11, 1, 'F'); put(T, 35, 24, 'F');
  paint(T, 25, 24, 10, 1, ':');
  paint(T, 5, 22, 5, 3, 'f'); // flowers
  put(T, 3, 26, 'W'); // a well

  // ------------------------------------------------------------ cave floor 1 (34×30)
  const D1 = grid(34, 30, '#');
  paint(D1, 2, 2, 11, 9, '.'); // room A (entrance)
  put(D1, 3, 2, 'S'); // back to the world
  put(D1, 3, 10, 'C'); put(D1, 11, 10, 'C'); // two lever pedestals
  paint(D1, 13, 6, 7, 1, '.'); // corridor A → B
  put(D1, 16, 6, 'V'); // vine wall: opens when both levers are pulled (fx_levers ≥ 2)
  paint(D1, 20, 2, 12, 11, '.'); // room B
  paint(D1, 22, 7, 8, 1, 'L'); // lava strip (damagePct), row 4 stays free
  put(D1, 30, 3, 's'); // stairs down
  put(D1, 26, 11, 'P'); // warp pad (only while fx_pad_on)
  paint(D1, 7, 11, 1, 6, '.'); // a dead end going south from room A …
  put(D1, 7, 17, '%'); put(D1, 7, 18, '%'); // … whose end is a secret wall (2 cells)
  paint(D1, 5, 19, 5, 4, '.'); // the hidden room

  // ------------------------------------------------------------ cave floor 2 (34×30)
  const D2 = grid(34, 30, '#');
  paint(D2, 2, 2, 14, 8, '.');
  put(D2, 3, 2, 'S');
  paint(D2, 8, 10, 1, 4, '.');
  put(D2, 8, 11, '3'); // a seal before the boss hall, removed after the boss
  paint(D2, 3, 14, 20, 9, '.');
  paint(D2, 10, 17, 4, 1, 'L');

  Object.assign(DB.maps, {
    fx_world: {
      name: 'テストの世界', type: 'world', legend: 'world', bgm: 'overworld',
      rows: rows(W),
      spawns: {
        start: { x: 16, y: 16, dir: 'down' },
        fx_town: { x: 12, y: 10, dir: 'down' },
        fx_dungeon_1: { x: 36, y: 20, dir: 'up' },
        fx_shrine: { x: 20, y: 8, dir: 'down' },
        fx_hollow: { x: 42, y: 25, dir: 'left' },
      },
      warps: [
        { x: 12, y: 10, to: 'fx_town', spawn: 'entrance' },
        { x: 36, y: 20, to: 'fx_dungeon_1', spawn: 'entrance' },
        { x: 20, y: 8, to: 'fx_town', spawn: 'inn', cond: 'fx_shrine_open' },
      ],
      chests: [{ id: 'fx_world_c1', x: 42, y: 25, pool: 'p_gold' }],
      zones: [{ x: 0, y: 0, w: 24, h: 36, zone: 'fx_w1' }],
      defaultZone: 'fx_w2',
    },

    fx_town: {
      name: 'テストの町', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
      location: 'fx_town', region: 'prologue', outside: 'T',
      rows: rows(T),
      spawns: {
        entrance: { x: 19, y: 30, dir: 'up' },
        inn: { x: 8, y: 11, dir: 'down' },
      },
      npcs: [
        { id: 'inn', x: 8, y: 4, sprite: 'npc:innkeeper', dir: 'down', event: 'fx_inn', fixed: true },
        { id: 'tavern', x: 20, y: 4, sprite: 'npc:bartender', dir: 'down', event: 'fx_tavern', fixed: true },
        { id: 'shop_item', x: 31, y: 4, sprite: 'npc:merchant', dir: 'down', event: 'fx_shop', shop: 'lute_item', fixed: true },
        { id: 'kid', x: 10, y: 17, sprite: 'npc:boy', move: 'wander', push: true, text: 'ぼく、いつか旅に出るんだ！' },
        { id: 'teller', x: 14, y: 20, sprite: 'npc:woman', dir: 'right', push: true,
          text: [
            { cond: { tier: 1 }, text: 'どこかで伝承が語り直されたらしいよ。' },
            { cond: 'fx_elder_done', text: ['長老さんとお話ししたのね。', 'この町をよろしくね。'] },
            { text: '近ごろ、昔話の続きが\n出てこないのよ。' },
          ] },
        { id: 'elder', x: 26, y: 16, sprite: 'npc:elder', dir: 'left', event: 'fx_elder', fixed: true },
        { id: 'brawler', x: 12, y: 27, sprite: 'npc:soldier', dir: 'up', event: 'fx_brawl', fixed: true },
        { id: 'loafer', x: 30, y: 24, sprite: 'npc:man', dir: 'left', push: true, text: 'ここは通り道なんだけどね。' },
        { id: 'guard', x: 23, y: 27, sprite: 'npc:soldier', dir: 'down', fixed: true, text: '町の外には魔物が出る。気をつけろ。' },
        { id: 'fan', x: 16, y: 18, sprite: 'npc:girl', move: 'wander', cond: 'fx_elder_done', push: true, text: 'わたしも長老さんに会ったの！' },
      ],
      signs: [
        { x: 17, y: 15, text: [
          { cond: { tier: 1 }, text: '伝承をお持ちの方は、\n記録院の出張所へ。' },
          { text: 'ここはテストの町。\n北に宿屋と酒場がある。' },
        ] },
      ],
      chests: [
        { id: 'fx_town_c1', x: 33, y: 20, pool: 'p_supply' },
        { id: 'fx_town_c2', x: 35, y: 20, pool: 'p_rare' },
      ],
      events: [{ x: 19, y: 20, id: 'fx_step_hello', trigger: 'step', once: 'fx_step_hello_done' }],
      exit: { to: 'fx_world', spawn: 'fx_town' },
      onEnter: 'fx_town_enter',
    },

    fx_dungeon_1: {
      name: 'テストの洞窟　1階', type: 'dungeon', legend: 'local', theme: 'cave', bgm: 'cave',
      location: 'fx_cave', region: 'prologue', outside: '#',
      encounter: 'fx_d1', encRate: 12,
      rows: rows(D1),
      spawns: {
        entrance: { x: 3, y: 3, dir: 'down' },
        from_next: { x: 29, y: 3, dir: 'left' },
      },
      warps: [
        { x: 3, y: 2, to: 'fx_world', spawn: 'fx_dungeon_1' },
        { x: 30, y: 3, to: 'fx_dungeon_2', spawn: 'from_prev' },
        { x: 26, y: 11, to: 'fx_town', spawn: 'inn', cond: 'fx_pad_on', sfx: 'warp' },
      ],
      chests: [{ id: 'fx_d1_c1', x: 7, y: 21, pool: 'p_rare' }],
      npcs: [{ id: 'rest', x: 30, y: 10, sprite: 'obj:lantern', event: 'fx_rest', fixed: true }],
      events: [
        { x: 16, y: 6, id: 'fx_vine', trigger: 'examine', cond: { var: 'fx_levers', lt: 2 } },
        { x: 3, y: 10, id: 'fx_lever_a', trigger: 'examine', once: 'fx_lever_a' },
        { x: 11, y: 10, id: 'fx_lever_b', trigger: 'examine', once: 'fx_lever_b' },
      ],
      tilePatches: [{ cond: { var: 'fx_levers', gte: 2 }, x: 16, y: 6, ch: '.' }],
      escape: { to: 'fx_world', spawn: 'fx_dungeon_1' },
    },

    fx_dungeon_2: {
      name: 'テストの洞窟　2階', type: 'dungeon', legend: 'local', theme: 'cave', bgm: 'cave',
      location: 'fx_cave', region: 'prologue', outside: '#', lvOff: 2, chestTier: 3,
      encounter: 'fx_d2',
      rows: rows(D2),
      spawns: { from_prev: { x: 3, y: 3, dir: 'down' } },
      warps: [{ x: 3, y: 2, to: 'fx_dungeon_1', spawn: 'from_next' }],
      npcs: [{ id: 'boss', x: 8, y: 9, sprite: 'npc:spirit', cond: '!fx_boss_done', event: 'fx_boss', fixed: true }],
      chests: [{ id: 'fx_d2_c1', x: 12, y: 20, pool: 'p_gear' }],
      tilePatches: [{ cond: 'fx_boss_done', x: 8, y: 11, ch: '.' }],
      escape: { map: 'fx_world', spawn: 'fx_dungeon_1' }, // the {map, spawn} spelling of §3.3.10 works too
    },

    // an open room for the movement tests
    fx_open: {
      name: 'ひろば', type: 'dungeon', legend: 'local', theme: 'cave', outside: '#', location: 'fx_cave',
      rows: [
        '############',
        '#..........#',
        '#..#.......#',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############',
      ],
      spawns: { entrance: { x: 5, y: 3, dir: 'down' } },
      npcs: [{ id: 'fx_n', x: 4, y: 6, sprite: 'npc:man', dir: 'up', event: 'fx_talk', fixed: true }],
      chests: [{ id: 'fx_open_c', x: 9, y: 1, pool: 'p_supply' }],
      events: [{ x: 6, y: 4, id: 'fx_cnt', trigger: 'step' }],
      warps: [{ x: 9, y: 5, to: 'fx_town', spawn: 'entrance' }],
    },

    // pushing townsfolk aside
    fx_yard: {
      name: 'なかにわ', type: 'town', legend: 'local', theme: 'town', outside: '#', noRespawn: true, location: 'fx_town',
      rows: [
        '##########',
        '#........#',
        '#........#',
        '#........#',
        '##########',
        '#....#####',
        '##########',
      ],
      spawns: { entrance: { x: 2, y: 2, dir: 'right' } },
      npcs: [
        { id: 'loafer', x: 5, y: 2, sprite: 'npc:man', text: 'ひまだなあ。' },
        { id: 'boss', x: 7, y: 2, sprite: 'npc:soldier', event: 'fx_hi' },
        { id: 'mover', x: 2, y: 5, sprite: 'npc:man', text: 'せまいね。', push: true },
        { id: 'post', x: 3, y: 5, sprite: 'npc:soldier', text: 'ここは通さん。', fixed: true },
      ],
    },

    // an all-land wrapping world for the seam tests
    fx_torus: {
      name: 'わのせかい', type: 'world', legend: 'world', bgm: 'overworld',
      rows: [
        '..........M',
        '..........M',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
        '...........',
      ],
      spawns: { entrance: { x: 0, y: 5, dir: 'left' } },
      defaultZone: 'fx_w2',
    },

    // a room smaller than every view (camera centring, `outside` walls, over:true decor)
    fx_small: {
      name: '小部屋', type: 'dungeon', legend: 'local', theme: 'cave', outside: '#', location: 'fx_cave',
      rows: ['#######', '#.....#', '#.....#', '#.....#', '#######'],
      decor: ['.......', '..a....', '.......', '.......', '.......'],
      decorLegend: { a: 'fx_arch' },
      spawns: { entrance: { x: 3, y: 2, dir: 'down' } },
    },
  });

  // a map-legend decor that is drawn above the sprites (arch / eaves: DESIGN §11.2.10 over:true)
  if (!DB.decor.fx_arch) DB.decor.fx_arch = { name: 'アーチ', pass: true, over: true, tall: true };

  Object.assign(DB.locations, {
    fx_town: { name: 'テストの町', map: 'fx_world', spawn: 'fx_town', region: 'prologue', kind: 'town' },
    fx_cave: { name: 'テストの洞窟', map: 'fx_world', spawn: 'fx_dungeon_1', region: 'prologue', kind: 'dungeon' },
  });

  R.fxEnter = 0; // how many times the town's onEnter ran (§4.12.2 ⑦)
  Object.assign(DB.events, {
    fx_town_enter: {
      run: async (ev) => {
        R.fxEnter++;
        if (ev.flag('fx_town_seen')) return;
        ev.setFlag('fx_town_seen');
        await ev.say('テストの町に着いた。');
      },
    },
    fx_step_hello: { run: async (ev) => { await ev.say('石畳の道が続いている。'); } },
    fx_elder: {
      meta: { gives: ['flag:fx_elder_done'] },
      run: async (ev) => {
        ev.npc('elder').face('player');
        if (ev.flag('fx_elder_done')) { await ev.say('気をつけて行くのじゃぞ。'); return; }
        await ev.say('おお、{hero}よ。\nよくぞ参った。');
        const i = await ev.ask('わしの願いを聞いてくれるか？', ['はい', 'いいえ']);
        if (i !== 0) { await ev.say('そうか……。\n気が変わったら、また来ておくれ。'); return; }
        ev.setFlag('fx_elder_done');
        await ev.say('ありがとう。\n町の者にも伝えておこう。');
        await ev.npc('elder').walk('R');
        ev.npc('elder').face('left');
      },
    },
    fx_inn: { run: async (ev) => { await ev.inn(); } },
    fx_tavern: { run: async (ev) => { await ev.tavern(); } },
    fx_shop: { run: async (ev) => { await ev.say('いらっしゃいませ！　何をお求めですか？'); await ev.shop(ev.ctx.npc.shop); } },
    fx_brawl: {
      run: async (ev) => {
        await ev.say('腕試しだ！　かかってこい！');
        const r = await ev.battle('fx_golem');
        if (r !== 'win') return false;
        await ev.say('まいった！');
      },
    },
    fx_rest: { run: async (ev) => { await ev.rest(); } },
    fx_vine: { run: async (ev) => { await ev.say('太いつるが道をふさいでいる。\n仕掛けを動かせば、ほどけそうだ。'); } },
    fx_lever_a: { run: async (ev) => { await fxLever(ev); } },
    fx_lever_b: { run: async (ev) => { await fxLever(ev); } },
    fx_boss: {
      meta: { gives: ['flag:fx_boss_done'] },
      run: async (ev) => {
        await ev.say('森の主が立ちはだかった！');
        const r = await ev.battle('fx_golem', { noEscape: true });
        if (r !== 'win') return false;
        ev.setFlag('fx_boss_done');
        await ev.say('封印が解けた！');
      },
    },
    fx_talk: { run: async (ev) => { await ev.say('こんにちは。'); } },
    fx_hi: { run: async (ev) => { await ev.say('やあ。'); } },
    fx_cnt: { run: async () => { R.fxStepHits = (R.fxStepHits || 0) + 1; } },
  });
  async function fxLever(ev) {
    ev.setVar('fx_levers', ev.var('fx_levers') + 1);
    ev.refresh();
    if (ev.var('fx_levers') >= 2) {
      ev.sfx('unlock');
      await ev.flash('#ffffff', 6);
      await ev.say('どこかで、つるのほどける音がした。');
    } else await ev.say('仕掛けが動いた。');
  }

  if (!DB.troops.fx_golem) DB.troops.fx_golem = { mons: [['@rat', 1, 1]], bg: 'cave', bgm: 'boss', noEscape: true };
  for (const z of ['fx_w1', 'fx_w2', 'fx_d1', 'fx_d2']) {
    if (!DB.encounters[z]) DB.encounters[z] = { region: 'prologue', tier: 0, lv: [1, 3], bg: z.startsWith('fx_d') ? 'cave' : 'grass', groups: [{ w: 1, mons: [['@rat', 1, 2]] }] };
  }
})(window.RPG);
