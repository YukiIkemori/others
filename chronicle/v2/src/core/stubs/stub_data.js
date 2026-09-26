// 仮のデータ: 一本道のマップ・人 2 人・仮の戦闘・始まりの場所（V2_PLAN §4.3 P0）。
// R.DB に同じ id が無いときだけ入る（CONTENT・BATTLE・EVENTS の本物が来たら使われなくなる。id は stub_ で始める）。
// R.DB.config.start = {map, spawn, event?}（新しいゲームの始まり。event があれば主人公の作成はそのイベントが ev.createHero() で行う）
(function (R) {
  'use strict';
  const W = 40;
  const put = (row, xs, ch) => { const a = [...row]; for (const x of xs) a[x] = ch; return a.join(''); };
  const edge = '#' + ','.repeat(W - 2) + '#';
  const rows = [
    '#'.repeat(W),
    '#' + ','.repeat(W - 2) + '#',
    '#' + ','.repeat(W - 2) + '#',
    put(edge, [17, 18, 19, 20], '~'),
    '#' + ','.repeat(3) + '.'.repeat(W - 8) + ','.repeat(3) + '#',
    '#' + ','.repeat(3) + '.'.repeat(W - 8) + ','.repeat(3) + '#',
    '#' + ','.repeat(3) + '.'.repeat(W - 8) + ','.repeat(3) + '#',
    '#' + ','.repeat(W - 2) + '#',
    put(edge, [4, 5, 14, 15, 32, 33], '#'),
    '#' + ','.repeat(W - 2) + '#',
    '#'.repeat(W),
  ];

  R.Stubs.defineData('maps', 'stub_road', {
    id: 'stub_road', name: '仮の夜道', kind: 'world', region: 'prologue', location: 'stub_road',
    w: W, h: rows.length,
    legend: { '#': { mat: 'stub_tree', solid: true }, ',': { mat: 'stub_grass' }, '.': { mat: 'stub_road' }, '~': { mat: 'stub_water', walk: false } },
    rows, outside: 'stub_tree',
    objects: [{ type: 'sign', x: 8, y: 3, text: 'この先、仮の街道。\n（P0 の骨組みの一本道です）' }],
    npcs: [
      { id: 'stub_elder', look: 'npc_old_m_1', name: '語り部', x: 6, y: 4, dir: 's', move: 'still', talk: { lines: [{ text: ['夜の街道へようこそ。', 'この道は、まだ色の箱でできておる。\nじきに灯りがともるじゃろう。'], face: 'npc_old_m_1:smile' }] }, reward: 'news', key: 'stub_elder' },
      { id: 'stub_guard', look: 'npc_guard_1', name: '番兵', x: 14, y: 6, dir: 'w', move: 'still', talk: 'stub_guard_talk', reward: 'hint', key: 'stub_guard' },
    ],
    spawns: { start: { x: 3, y: 5, dir: 'e' } },
    exits: [],
    triggers: [],
    zones: [{ rect: [20, 1, 19, 9], zone: 'z_stub' }],
    light: { ambient: '#5c5aa0', k: 0.45, mood: 'night' },
    dark: false,
    bgm: 'overworld',
    meta: {},
  });

  R.Stubs.defineData('events', 'stub_guard_talk', {
    async run(ev) {
      await ev.say('stub_guard', '腕だめしをしていくか？', { face: 'npc_guard_1:neutral' });
      const i = await ev.choose(['たたかう', 'やめておく'], { cancel: 1 });
      if (i !== 0) { await ev.say('stub_guard', 'そうか。気をつけてな。'); return; }
      const r = await ev.battle({ troop: 'tr_stub' });
      await ev.say('stub_guard', r === 'win' ? 'やるな！ この先も気をつけて行け。' : 'まだまだだな。');
    },
    meta: { needs: [], gives: [], calls: [] },
  });

  R.Stubs.defineData('troops', 'tr_stub', { mons: [['stub_slime', 2]] });
  R.Stubs.defineData('monsters', 'stub_slime', { name: 'ためしスライム' });
  R.Stubs.defineData('encounters', 'z_stub', { mons: [['stub_slime', 3]] });
  R.Stubs.defineData('locations', 'stub_road', { name: '仮の夜道', region: 'prologue', kind: 'place', map: 'stub_road', spawn: 'start' });
  R.Stubs.defineData('config', '*', { start: { map: 'stub_road', spawn: 'start' }, slice: true });
})(window.RPG);
