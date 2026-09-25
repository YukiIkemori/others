// Main story events (DESIGN §7.3/§7.4): the king's summons, the king's advice
// and save, the east gate soldier, the captain of Porta and the ship, and the
// light temple ceremony. Also R.Story: the story-stage / objective logic.
//
// Flags used here:  intro_done gate_open heard_bandits has_ship barrier_broken
// Flags read here:  bandits_defeated (fort boss event), game_clear (last boss)
// Key items read:   crest_wind crest_water crest_earth crest_fire crest_star gold_key light_crest
(function (R) {
  'use strict';
  const DB = R.DB;
  const CRESTS = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star'];
  const CREST_NAME = { crest_wind: '風', crest_water: '水', crest_earth: '大地', crest_fire: '炎', crest_star: '星' };
  const has = (id) => R.State.hasItem(id);
  const flag = (f) => R.State.flag(f);

  // ------------------------------------------------------------ objectives
  /** current story stage (R.DB.objectives id), derived from flags and key items */
  const visited = (loc) => !!(R.Game.visited && R.Game.visited[loc]);
  function objective() {
    if (!R.Game) return 'obj_start';
    if (flag('abyss_clear')) return 'obj_abyss_clear';
    if (flag('game_clear')) return 'obj_postgame';
    if (flag('barrier_broken') || has('light_crest')) return 'obj_demon';
    if (!flag('intro_done')) return 'obj_start';
    if (!has('crest_wind')) return 'obj_wind';
    if (!flag('has_ship') && !R.Game.ship) {
      if (flag('bandits_defeated')) return 'obj_ship';
      if (flag('heard_bandits')) return 'obj_bandits';
      if (visited('porta')) return 'obj_porta';
      return 'obj_gate';
    }
    if (CRESTS.every(has)) return 'obj_temple';
    if (!has('crest_water')) return visited('elfin') ? 'obj_water2' : 'obj_water';
    if (!has('crest_earth')) return 'obj_earth';
    if (!has('gold_key')) return visited('frost') ? 'obj_frost2' : 'obj_frost';
    if (!has('crest_fire')) return 'obj_fire';
    return 'obj_star';
  }
  /** recompute R.Game.objective (cheap; called on map load, flag change and every step) */
  function refreshObjective() {
    if (!R.Game) return;
    const id = objective();
    if (R.Game.objective !== id && DB.objectives && DB.objectives[id]) {
      R.Game.objective = id;
      R.emit('objective', id);
    }
  }

  /**
   * Respawn default (modern QoL): entering a town / castle / shrine makes its
   * entrance the wake-up point after a wipe. Inns and churches (and the king's
   * save) still set the exact spot; whichever happened last wins.
   */
  function autoRespawn(mapId) {
    const def = DB.maps[mapId];
    if (!R.Game || !def || !def.location || def.type === 'world' || def.type === 'dungeon') return;
    if (flag('game_clear')) return;
    const r = R.Game.respawn;
    if (r && r.map === mapId) return; // keep an inn/church spot inside this very map
    R.Game.respawn = { map: mapId, spawn: 'entrance' };
  }

  R.Story = {
    CRESTS,
    CREST_NAME,
    OBJECTIVES: ['obj_start', 'obj_wind', 'obj_gate', 'obj_porta', 'obj_bandits', 'obj_ship', 'obj_water', 'obj_water2', 'obj_earth',
      'obj_frost', 'obj_frost2', 'obj_fire', 'obj_star', 'obj_temple', 'obj_demon', 'obj_clear', 'obj_postgame', 'obj_abyss_clear'],
    objective,
    refreshObjective,
    autoRespawn,
    crestCount() { return CRESTS.filter(has).length; },
  };
  R.onBoot(() => {
    R.on('mapload', (id) => { refreshObjective(); autoRespawn(id); });
    R.on('flag', refreshObjective);
    R.on('step', refreshObjective);
  });

  // ------------------------------------------------------------ helpers
  const E = DB.events;
  const lead = () => R.State.leader().name;
  const faceNpc = (ev, id, dir) => { const n = R.Field && R.Field.npc(id); if (n) ev.npc(id).face(dir); };

  // ------------------------------------------------------------ the king's summons
  async function intro(ev) {
    faceNpc(ev, 'king', 'down');
    faceNpc(ev, 'minister', 'right');
    faceNpc(ev, 'queen', 'down');
    await ev.wait(40);
    await ev.say('おお、よくぞ参った！\n{yuki}、{non}、{metem}よ。');
    await ev.say('わしがこのレグナスの王じゃ。\nそなたたちを呼んだのは、\nほかでもない。');
    await ev.say('今より100年の昔……\n魔王ヴァルザードは、\n光の紋章の力によって\n封じられた。');
    await ev.say('その紋章は五つに分かたれ、\n風・水・大地・炎・星の紋章として\n世界の各地に祀られたのじゃ。');
    await ev.say('だが近ごろ封印が弱まり、\n世界中に魔物があふれ出しておる。\f魔王の目覚めも、\n近いのかもしれぬ……。');
    await ev.say('そなたたち3人は、\n紋章の光を宿して\n生まれた者たち。');
    await ev.say('剣士の家に生まれた{yuki}。\n神殿で育った{non}。\n魔法学院始まって以来の天才、\n{metem}。');
    await ev.say('どうか五つの紋章を集め、\n光の神殿で\n光の紋章をよみがえらせてほしい。');
    await ev.say('そして魔の渦の向こう、\n魔王の島へと渡り、\nヴァルザードを討ち倒すのじゃ！');
    await ev.say('{yuki}「任せてください！\n必ずやり遂げてみせます！」');
    await ev.say('{non}「わたし、がんばります。\n神様、どうかわたしたちを\nお守りください。」');
    await ev.say('{metem}「ふふん、任せなさい。\nわたしの魔法があれば、\n魔王なんてひとひねりよ！」');
    await ev.say('うむ、頼もしい限りじゃ。\fまずは、この城のはるか北、\n山のふもとにある風の洞窟へ\n向かうがよい。\nそこに風の紋章が祀られておる。');
    await ev.say('わずかだが、旅の資金を授けよう。');
    await ev.giveGold(150);
    faceNpc(ev, 'minister', 'down');
    await ev.say('大臣「冒険に迷ったら、\nBボタンでメニューを開き、\n『次の目的』を確かめると\nよいですぞ。」');
    await ev.say('大臣「また、王様に話しかければ、\n冒険の記録をつけることが\nできますぞ。」');
    faceNpc(ev, 'minister', 'right');
    await ev.say('では行け！\n{yuki}、{non}、{metem}！\nそなたたちに光の加護が\nあらんことを！');
    ev.setFlag('intro_done');
    ev.setObjective('obj_wind');
  }

  E.regnas_castle_enter = {
    meta: { needs: [], gives: ['flag:intro_done'] },
    run: async (ev) => {
      if (!ev.flag('intro_done')) await intro(ev);
    },
  };

  // ------------------------------------------------------------ the king (advice, EXP report, save)
  function expReport() {
    const lines = [];
    for (const c of R.Game.party) {
      let n = 0;
      try { n = R.Rules.expToNext(c); } catch (e) { n = 0; }
      lines.push(c.name + (n > 0 ? 'はあと' + n + 'ポイント' : 'はこれ以上伸びぬよう'));
    }
    return '次のレベルまでに必要な経験値は……\f' + lines.join('、\n') + 'じゃ。\n精進するがよいぞ。';
  }

  E.king_talk = {
    meta: { needs: [], gives: ['flag:intro_done'] },
    run: async (ev) => {
      if (!ev.flag('intro_done')) { await intro(ev); return; }
      refreshObjective();
      const o = DB.objectives[R.Game.objective] || {};
      if (ev.flag('game_clear')) {
        await ev.say('おお、勇者たちよ！\nそなたたちのおかげで、\n世界に平和が戻った。\n本当にありがとう。');
        await ev.say('いつでもこの城に\n帰ってくるがよいぞ。');
        if (o.king && (R.Game.objective === 'obj_postgame' || R.Game.objective === 'obj_abyss_clear')) await ev.say(o.king);
      } else {
        const away = visited('milt') || ev.has('crest_wind');
        await ev.say(away ? 'おお、' + lead() + 'たちよ！\nよくぞ戻った。' : 'どうした、' + lead() + 'たちよ。\nまだ城におったのか。');
        if (o.king) await ev.say(o.king);
        await ev.say(expReport());
      }
      if (await ev.yesno('そなたたちの冒険を\n記録していくか？')) {
        await ev.saveMenu();
        await ev.say('では、また会おう。\nそなたたちに光の加護を！');
      } else {
        await ev.say('では行け！\nそなたたちに光の加護を！');
      }
    },
  };

  // ------------------------------------------------------------ east gate
  E.gate_soldier = {
    meta: { needs: ['item:crest_wind'], gives: ['flag:gate_open'] },
    run: async (ev) => {
      if (ev.flag('gate_open')) {
        await ev.say('気をつけて行くのだぞ。\n港町ポルタは、関所を出て\n北東へ進んだ先にある。');
        return;
      }
      if (!ev.has('crest_wind')) {
        await ev.say('ここはレグナスの東の関所。');
        await ev.say('魔物が増えて危険なため、\n王の印を持たぬ者は\n通すわけにはいかぬ。');
        return false;
      }
      await ev.say('む？　そなたたちが持っている\nその光は……！');
      R.sfx('holy');
      await ev.flash('#c8f0ff', 10);
      await ev.say('風の紋章……王の印だ。\n通るがよい。');
      const self = ev.self;
      if (self && R.Field.npc(self)) {
        await ev.npc(self).walk('U');
        ev.npc(self).face('down');
      }
      ev.setFlag('gate_open');
      await ev.say('武運を祈っておるぞ。');
    },
  };

  // ------------------------------------------------------------ Porta: captain and ship
  E.porta_captain = {
    meta: { needs: ['flag:bandits_defeated'], gives: ['flag:has_ship'] },
    run: async (ev) => {
      if (ev.flag('has_ship') || R.Game.ship) {
        await ev.say('よう、' + lead() + '！\n船の調子はどうだい？');
        await ev.say('船は町を出てすぐの\n港に停めてあるぜ。\nあんたたちの船だ。\n好きに使ってくれ！');
        return;
      }
      if (!ev.flag('bandits_defeated')) {
        ev.setFlag('heard_bandits');
        await ev.say('おれはこの港の船長だ。\nだが見てのとおり、\n船は出せねえ。');
        await ev.say('近ごろ港の外に、\n盗賊どもが居座ってな。\n船を出せば、たちまち襲われて\n積み荷を奪われちまう。');
        await ev.say('やつらのねぐら、盗賊の砦は\nこの町のはるか南、\n岬の先にあるらしい。');
        await ev.say('誰か、やつらのお頭を\n懲らしめてくれりゃあなあ……。');
        return false;
      }
      await ev.say('おお！　あんたたちが\n盗賊どもを懲らしめて\nくれたのか！');
      await ev.say('これで港も元どおりだ。\n本当にありがとうよ！');
      await ev.say('……なに？　船で世界を\n回りたいだって？');
      await ev.say('よし！　おれの自慢の船を\nあんたたちに託すぜ！\n持ってけ泥棒……\nいや、勇者さま！');
      ev.giveShip('porta_dock');
      ev.setFlag('has_ship');
      await ev.gotItem(lead() + 'たちは船を手に入れた！', 'keyitem');
      await ev.say('船は町を出てすぐの\n港に停めてある。\n陸に向かって進めば、\nそのまま降りられるぜ。');
      await ev.say('南の海に浮かぶ森の島には、\nエルフの住む村、エルフィンが\nあるそうだ。\nいい風が吹いてるぜ！');
      refreshObjective();
    },
  };

  // ------------------------------------------------------------ light temple ceremony
  const GLOWS = ['glow_wind', 'glow_water', 'glow_earth', 'glow_fire', 'glow_star'];
  E.temple_altar = {
    meta: { needs: CRESTS.map((c) => 'item:' + c), gives: ['item:light_crest', 'flag:barrier_broken'] },
    run: async (ev) => {
      if (ev.flag('barrier_broken')) {
        await ev.say('光の紋章は、\nあなたたちとともにあります。');
        await ev.say('魔の渦は消えました。\n南東の海に浮かぶ最果ての祠で、\n旅の支度を整えるのです。');
        return;
      }
      const missing = CRESTS.filter((c) => !ev.has(c));
      if (missing.length) {
        await ev.say('ここは光の神殿。\n五つの紋章を台座に捧げるとき、\n光の紋章はよみがえるのです。');
        const got = CRESTS.length - missing.length;
        if (got > 0) {
          await ev.say('あなたたちは' + got + 'つの紋章を\n持っていますね。\n残るは' + missing.map((c) => CREST_NAME[c]).join('・') + 'の紋章……。');
        } else {
          await ev.say('紋章の光を宿す者たちよ。\n五つの紋章を集めて、\nここへ戻るのです。');
        }
        return false;
      }
      await ev.say('おお……五つの紋章が、\nついにそろったのですね。');
      await ev.say('さあ、紋章を台座へ。');
      R.Audio && R.Audio.stopBGM && R.Audio.stopBGM(60);
      for (let i = 0; i < CRESTS.length; i++) {
        if (R.Field.npc(GLOWS[i])) ev.npc(GLOWS[i]).show();
        R.sfx('holy');
        await ev.flash('#ffffff', 8);
        await ev.say(lead() + 'は' + DB.items[CRESTS[i]].name + 'を\n台座に捧げた。', { speed: 3 });
        await ev.wait(12);
      }
      R.UI.closeMessage();
      await ev.wait(30);
      R.sfx('magic');
      await ev.shake(40, 2);
      for (let i = 0; i < 3; i++) { R.sfx('holy'); await ev.flash('#fff8d0', 10); await ev.wait(6); }
      await ev.say('五つの光が、\n祭壇の上に集まってゆく……！');
      if (R.Field.npc('glow_light')) ev.npc('glow_light').show();
      R.sfx('revive');
      await ev.flash('#ffffff', 30);
      ev.bgm();
      await ev.give('light_crest');
      ev.setFlag('barrier_broken');
      await ev.say('光の紋章が、\nよみがえりました……！');
      await ev.say('その光は魔の渦を払い、\n魔王の島への道を\n開くでしょう。');
      await ev.say('南東の海に、\n最果ての祠があります。\nそこで支度を整え、\n魔王城へ向かうのです。');
      await ev.say('{yuki}「いよいよだな……。」');
      await ev.say('{non}「みんなで必ず、\n帰ってきましょうね。」');
      await ev.say('{metem}「当然よ。\nさっさと魔王を倒して、\nおいしいものでも食べましょ。」');
      refreshObjective();
    },
  };
})(window.RPG);
