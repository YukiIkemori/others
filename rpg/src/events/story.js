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
  const CREST_NAME = { crest_wind: 'かぜ', crest_water: 'みず', crest_earth: 'だいち', crest_fire: 'ほのお', crest_star: 'ほし' };
  const has = (id) => R.State.hasItem(id);
  const flag = (f) => R.State.flag(f);

  // ------------------------------------------------------------ objectives
  /** current story stage (R.DB.objectives id), derived from flags and key items */
  function objective() {
    if (!R.Game) return 'obj_start';
    if (flag('game_clear')) return 'obj_clear';
    if (flag('barrier_broken') || has('light_crest')) return 'obj_demon';
    if (!flag('intro_done')) return 'obj_start';
    if (!has('crest_wind')) return 'obj_wind';
    if (!flag('has_ship') && !R.Game.ship) {
      if (flag('bandits_defeated')) return 'obj_ship';
      if ((R.Game.visited && R.Game.visited.porta) || flag('heard_bandits')) return 'obj_bandits';
      return 'obj_gate';
    }
    if (CRESTS.every(has)) return 'obj_temple';
    if (!has('crest_water')) return 'obj_water';
    if (!has('crest_earth')) return 'obj_earth';
    if (!has('gold_key')) return 'obj_frost';
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
    OBJECTIVES: ['obj_start', 'obj_wind', 'obj_gate', 'obj_bandits', 'obj_ship', 'obj_water', 'obj_earth', 'obj_frost',
      'obj_fire', 'obj_star', 'obj_temple', 'obj_demon', 'obj_clear'],
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
    await ev.say('おお ユウキ ノン メテム！\nよくぞ まいった！');
    await ev.say('わしは この くにの おう レグナス。\nそなたたちを よんだのは\nほかでもない。');
    await ev.say('いまより 100ねん むかし……\nまおう ヴァルザードは\nひかりの もんしょうの ちからで\nふうじられた。');
    await ev.say('その もんしょうは いつつに わかたれ\nかぜ みず だいち ほのお ほしの\nもんしょうとして\nせかいの ちに まつられたのじゃ。');
    await ev.say('だが ちかごろ ふういんが よわまり\nせかいじゅうに まものが\nあふれだして おる。\fまおうの めざめも\nちかいのかも しれぬ……。');
    await ev.say('そなたたち 3にんは\nもんしょうの ひかりを やどして\nうまれた ものたち。');
    await ev.say('けんしの いえに うまれた ユウキ。\nしんでんで そだった ノン。\nまほうがくいん はじまって いらいの\nてんさい メテム。');
    await ev.say('どうか いつつの もんしょうを あつめ\nひかりの しんでんで\nひかりの もんしょうを\nよみがえらせて ほしい。');
    await ev.say('そして まのうずの むこう\nまおうの しまへ わたり\nヴァルザードを うちたおすのじゃ！');
    await ev.say('ユウキ「まかせて ください！\nかならず やりとげて みせます！」');
    await ev.say('ノン「わたし がんばります。\nかみさま どうか\nわたしたちを おまもりください。」');
    await ev.say('メテム「ふふん まかせなさい。\nわたしの まほうが あれば\nまおうなんて ひとひねりよ！」');
    await ev.say('うむ たのもしい かぎりじゃ。\fまずは この しろの はるか きた\nやまの ふもとの かぜの どうくつへ\nむかうが よい。\nかぜの もんしょうが まつられて おる。');
    await ev.say('わずかだが たびの しきんを\nさずけよう。');
    await ev.giveGold(150);
    faceNpc(ev, 'minister', 'down');
    await ev.say('だいじん「ぼうけんに まよったら\nBボタンで メニューを ひらき\n『つぎの もくてき』を\nたしかめると よいですぞ。」');
    await ev.say('だいじん「また おうさまに\nはなしかければ ぼうけんの きろくを\nつけることが できますぞ。」');
    faceNpc(ev, 'minister', 'right');
    await ev.say('では ゆけ！ ユウキ ノン メテムよ！\nそなたたちに ひかりの\nかごが あらんことを！');
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
      lines.push(c.name + (n > 0 ? ' あと ' + n + 'ポイント' : ' これいじょうは のびぬ'));
    }
    return 'つぎの レベルまでに ひつような\nけいけんちは……\f' + lines.join('\n') + '\nじゃ。 はげむが よいぞ。';
  }

  E.king_talk = {
    meta: { needs: [], gives: ['flag:intro_done'] },
    run: async (ev) => {
      if (!ev.flag('intro_done')) { await intro(ev); return; }
      refreshObjective();
      const o = DB.objectives[R.Game.objective] || {};
      if (ev.flag('game_clear')) {
        await ev.say('おお ゆうしゃたちよ！\nそなたたちの おかげで\nせかいに へいわが もどった。\nほんとうに ありがとう。');
        await ev.say('いつでも この しろに\nかえって くるが よいぞ。');
      } else {
        await ev.say('おお ' + lead() + 'たちよ！\nよくぞ もどった。');
        if (o.king) await ev.say(o.king);
        await ev.say(expReport());
      }
      if (await ev.yesno('そなたたちの ぼうけんを\nきろく してゆくか？')) {
        await ev.saveMenu();
        await ev.say('では また あおう。\nそなたたちに ひかりの かごを！');
      } else {
        await ev.say('では ゆけ！\nそなたたちに ひかりの かごを！');
      }
    },
  };

  // ------------------------------------------------------------ east gate
  E.gate_soldier = {
    meta: { needs: ['item:crest_wind'], gives: ['flag:gate_open'] },
    run: async (ev) => {
      if (ev.flag('gate_open')) {
        await ev.say('きを つけて いくのだぞ。\nみなとまち ポルタは\nせきしょを でて きたへ すすんだ\nさきに ある。');
        return;
      }
      if (!ev.has('crest_wind')) {
        await ev.say('ここは レグナスの ひがしの せきしょ。');
        await ev.say('まものが ふえて きけんな ため\nおうの しるしを もたぬ ものは\nとおす わけには いかぬ。');
        return false;
      }
      await ev.say('む？ そなたたちが もっている\nその ひかりは……！');
      R.sfx('holy');
      await ev.flash('#c8f0ff', 10);
      await ev.say('かぜの もんしょう… おうの しるしだ。\nとおりなさい。');
      const self = ev.self;
      if (self && R.Field.npc(self)) {
        await ev.npc(self).walk('U');
        ev.npc(self).face('down');
      }
      ev.setFlag('gate_open');
      await ev.say('ぶうんを いのって おるぞ。');
    },
  };

  // ------------------------------------------------------------ Porta: captain and ship
  E.porta_captain = {
    meta: { needs: ['flag:bandits_defeated'], gives: ['flag:has_ship'] },
    run: async (ev) => {
      if (ev.flag('has_ship') || R.Game.ship) {
        await ev.say('よう ' + lead() + '！\nふねの ちょうしは どうだい？');
        await ev.say('ふねは まちを でて すぐの\nみなとに とめてあるぜ。\nあんたたちの ふねだ。\nすきに つかって くれ！');
        return;
      }
      if (!ev.flag('bandits_defeated')) {
        ev.setFlag('heard_bandits');
        await ev.say('おれは この みなとの せんちょうだ。\nだが みてのとおり\nふねは だせねえ。');
        await ev.say('ちかごろ みなとの そとに\nとうぞくどもが いすわってな。\nふねを だせば たちまち おそわれて\nにもつを うばわれちまう。');
        await ev.say('やつらの とりでは この まちの\nはるか みなみ みさきの さきに\nあるらしい。');
        await ev.say('だれか やつらの おかしらを\nこらしめて くれりゃあなあ……。');
        return false;
      }
      await ev.say('おお！ あんたたちが\nとうぞくどもを こらしめて\nくれたのか！');
      await ev.say('これで みなとも もとどおりだ。\nほんとうに ありがとうよ！');
      await ev.say('……なに？ ふねで せかいを\nまわりたい だって？');
      await ev.say('よし！ おれの じまんの ふねを\nあんたたちに たくすぜ！\nもってけ どろぼう……\nいや ゆうしゃさま！');
      ev.giveShip('porta_dock');
      ev.setFlag('has_ship');
      await ev.gotItem(lead() + 'たちは ふねを てにいれた！', 'keyitem');
      await ev.say('ふねは まちを でて すぐの\nみなとに とめて ある。\nりくに むかって すすめば\nそのまま おりられるぜ。');
      await ev.say('みなみの うみの もりの しまには\nエルフの むらが あるそうだ。\nいい かぜが ふいてるぜ！');
      refreshObjective();
    },
  };

  // ------------------------------------------------------------ light temple ceremony
  const GLOWS = ['glow_wind', 'glow_water', 'glow_earth', 'glow_fire', 'glow_star'];
  E.temple_altar = {
    meta: { needs: CRESTS.map((c) => 'item:' + c), gives: ['item:light_crest', 'flag:barrier_broken'] },
    run: async (ev) => {
      if (ev.flag('barrier_broken')) {
        await ev.say('ひかりの もんしょうは\nそなたたちと ともに あります。');
        await ev.say('まのうずは きえました。\nみなみの うみの さいはてに\nちいさな ほこらが あります。\nそこで たびの したくを。');
        return;
      }
      const missing = CRESTS.filter((c) => !ev.has(c));
      if (missing.length) {
        await ev.say('ここは ひかりの しんでん。\nいつつの もんしょうを だいざに\nささげる とき ひかりの もんしょうは\nよみがえるのです。');
        const got = CRESTS.length - missing.length;
        if (got > 0) {
          await ev.say('あなたたちは ' + got + 'つの もんしょうを\nもって いますね。\nのこる もんしょうは\n' + missing.map((c) => CREST_NAME[c]).join(' ') + '……。');
        } else {
          await ev.say('もんしょうの ひかりを やどす\nものたちよ。 いつつの もんしょうを\nあつめて ここへ もどるのです。');
        }
        return false;
      }
      await ev.say('おお…… いつつの もんしょうが\nついに そろったのですね。');
      await ev.say('さあ もんしょうを だいざへ。');
      R.Audio && R.Audio.stopBGM && R.Audio.stopBGM(60);
      for (let i = 0; i < CRESTS.length; i++) {
        if (R.Field.npc(GLOWS[i])) ev.npc(GLOWS[i]).show();
        R.sfx('holy');
        await ev.flash('#ffffff', 8);
        await ev.say(lead() + 'は ' + DB.items[CRESTS[i]].name + 'を\nだいざに ささげた。', { speed: 3 });
        await ev.wait(12);
      }
      R.UI.closeMessage();
      await ev.wait(30);
      R.sfx('magic');
      await ev.shake(40, 2);
      for (let i = 0; i < 3; i++) { R.sfx('holy'); await ev.flash('#fff8d0', 10); await ev.wait(6); }
      await ev.say('いつつの ひかりが\nさいだんの うえに あつまってゆく……！');
      if (R.Field.npc('glow_light')) ev.npc('glow_light').show();
      R.sfx('revive');
      await ev.flash('#ffffff', 30);
      ev.bgm();
      await ev.give('light_crest');
      ev.setFlag('barrier_broken');
      await ev.say('ひかりの もんしょうが\nよみがえりました……！');
      await ev.say('その ひかりは まのうずを はらい\nまおうの しまへの みちを\nひらくでしょう。');
      await ev.say('みなみの うみの さいはてに\nちいさな ほこらが あります。\nそこで したくを ととのえ\nまおうじょうへ むかうのです。');
      await ev.say('ユウキ「いよいよ だな……。」');
      await ev.say('ノン「みんなで かならず\nかえって きましょうね。」');
      await ev.say('メテム「とうぜんよ。\nさっさと まおうを たおして\nおいしい ものでも たべましょ。」');
      refreshObjective();
    },
  };
})(window.RPG);
