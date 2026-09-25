// ダンジョン 後半のイベント (DESIGN §7.3, §7.4): ひょうけつのどうくつ・ほのおのかざん・
// ほしみのとう・まおうじょう の ボスせん、もんしょうの だいざ、ボスのあとに ひらく
// でぐちの まほうじん、まおうじょうの ふういんされた ちかみち、そして さいごの たたかい。
// マップは src/maps/dungeons_b.js。
//
// Flags set here:  boss_ice_done  boss_volcano_done got_crest_fire  boss_star_done got_crest_star
//                  demon_voice_heard  boss_general1_done  boss_general2_done
//                  boss_king1_done  boss_king2_done  game_clear
// Items given:     gold_key  crest_fire  crest_star
(function (R) {
  'use strict';
  const E = R.DB.events;
  const CRESTS = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star'];
  const KAZU = ['ゼロ', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ'];

  // ------------------------------------------------------------ helpers
  /** turn the leader toward an NPC (bosses are drawn big; they may be talked to from the side) */
  function faceNpc(ev, id) {
    const f = R.Field;
    const n = f && f.npc ? f.npc(id) : null;
    if (!n || !f.pos) return;
    const p = f.pos();
    const dx = n.x - p.x, dy = n.y - p.y;
    if (!dx && !dy) return;
    ev.player.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  /** point the menu's objective at the current story stage */
  function nextObjective(ev, fallback) {
    let id = R.Story && R.Story.objective ? R.Story.objective() : fallback;
    if (!R.DB.objectives || !R.DB.objectives[id]) id = fallback;
    if (id && R.DB.objectives && R.DB.objectives[id]) ev.setObjective(id);
  }
  /** a boss (and its escorts) leaves the map: flag, redraw, short pause */
  async function vanish(ev, flag, fx) {
    ev.closeMessage();
    if (fx === 'flash') await ev.flash('#ffffff', 12);
    else if (fx === 'fade') await ev.fadeOut(24);
    ev.setFlag(flag);
    ev.refresh();
    if (fx === 'fade') await ev.fadeIn(24);
    else await ev.wait(16);
  }
  /** the crest altar: take the crest (an NPC floating over a pedestal) */
  async function takeCrest(ev, o) {
    if (ev.flag(o.got) || !ev.flag(o.boss)) return false;
    await ev.say(o.look);
    ev.sfx('holy');
    await ev.flash('#fff8d0', 10);
    ev.setFlag(o.got);
    ev.refresh();
    await ev.give(o.item);
    await ev.say(o.after);
    const n = CRESTS.filter((id) => ev.has(id)).length;
    await ev.say(n >= CRESTS.length
      ? 'ついに いつつの もんしょうが\nすべて そろった！\fうみの まんなかの ひかりの しんでんへ\nもっていこう。'
      : 'これで もんしょうは ' + KAZU[n] + '。\nのこる もんしょうは あと ' + KAZU[CRESTS.length - n] + 'だ。');
    nextObjective(ev, o.fallback);
    await ev.say('……ふと みると ゆかの まほうじんが\nあわく ひかっている。\nあれに のれば そとへ でられそうだ。');
    return true;
  }

  // ------------------------------------------------------------ exit circle (after each boss)
  E.db_exit_circle = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      const def = R.DB.maps[ev.map];
      const esc = def && def.escape;
      if (!esc) return false;
      ev.sfx('warp');
      if (!(await ev.yesno('まほうじんが しずかに ひかっている。\nそとへ でますか？'))) return false;
      ev.sfx('teleport');
      await ev.warp(esc.to, esc.spawn, { dir: 'down' });
      return true;
    },
  };

  // ============================================================ ひょうけつのどうくつ
  E.ice_boss = {
    meta: { needs: [], gives: ['flag:boss_ice_done', 'item:gold_key'] },
    async run(ev) {
      if (ev.flag('boss_ice_done')) return;
      faceNpc(ev, 'ice_giant');
      await ev.shake(30, 2);
      await ev.say('ゴゴゴゴ……\nこおりの かべが ふるえている……！');
      ev.sfx('roar');
      await ev.say('ひょうがのきょじん「……だれだ。\nながき ねむりを さますのは。」');
      await ev.say('「……ひかりの においが する。\nおまえたちが まおうさまの いう\nもんしょうの こらか。\fこがねの かぎは わたさぬ。\nこおりの ひつぎで ねむるが よい！」');
      if ((await ev.battle('boss_ice')) !== 'win') return false;
      faceNpc(ev, 'ice_giant');
      await ev.say('ひょうがのきょじん「グ……ヌウ……。\nからだが…… とけて ゆく……。」');
      ev.sfx('ice');
      await ev.shake(24, 3);
      await vanish(ev, 'boss_ice_done', 'flash');
      await ev.say('きょじんの からだは くだけちり\nこおりの つぶと なって きえた……。');
      await ev.say('あとには きんいろに かがやく\nかぎが おちている。');
      await ev.give('gold_key');
      await ev.say('これで せかいの どこかに ある\nこがねの とびらを ひらけるはずだ。');
      nextObjective(ev, 'obj_fire');
      await ev.say('おくの まほうじんが\nあわく ひかりはじめた……。');
    },
  };

  // ============================================================ ほのおのかざん
  E.volcano_boss = {
    meta: { needs: [], gives: ['flag:boss_volcano_done'] },
    async run(ev) {
      if (ev.flag('boss_volcano_done')) return;
      faceNpc(ev, 'volcano_lord');
      ev.sfx('fire');
      await ev.flash('#ff6010', 10);
      await ev.say('ようがんが ごうっと ふきあがった！');
      await ev.say('えんまじん「フハハハハ！\nよくぞ ここまで きたな\nひかりの こらよ！」');
      await ev.say('「ここは まおうさまに ささげられた\nほのおの せいいき。\fほのおの もんしょうが ほしいか？\nならば この ほのおで\nほねまで やきつくして くれるわ！」');
      if ((await ev.battle('boss_volcano')) !== 'win') return false;
      faceNpc(ev, 'volcano_lord');
      await ev.say('えんまじん「ば ばかな……！\nこの わしの ほのおが……\nきえる だと……！」');
      ev.sfx('fire');
      await ev.shake(30, 3);
      await vanish(ev, 'boss_volcano_done', 'flash');
      await ev.say('えんまじんは ほのおと ともに\nようがんの なかへ きえていった……。');
      await ev.say('おくの だいざで なにかが\nあかく かがやいている……。');
    },
  };
  E.volcano_crest = {
    meta: { needs: ['flag:boss_volcano_done'], gives: ['item:crest_fire', 'flag:got_crest_fire'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_volcano_done', got: 'got_crest_fire', item: 'crest_fire', fallback: 'obj_star',
      look: 'だいざの うえで\nあかい もんしょうが\nほのおの ように ゆらめいている……。',
      after: 'ほのおの もんしょうを てにすると\nからだの おくから あつい ちからが\nわきあがってきた……。',
    }),
  };

  // ============================================================ ほしみのとう
  E.star_boss = {
    meta: { needs: [], gives: ['flag:boss_star_done'] },
    async run(ev) {
      if (ev.flag('boss_star_done')) return;
      faceNpc(ev, 'star_guardian');
      ev.sfx('holy');
      await ev.flash('#e8f0ff', 10);
      await ev.say('よぞらの ほしが いっせいに\nまたたいた……！');
      await ev.say('ほしのしゅごしん「……まっていた。\nひかりの もんしょうに\nえらばれし ものたちよ。」');
      await ev.say('メテム「ほしみの とうの しゅごしん……！\nがくいんの ほんで よんだ とおりだわ。」');
      await ev.say('ほしのしゅごしん「ほしの もんしょうは\nまことの ゆうしゃにのみ たくされる。\fそなたらの ちからと こころ\nこの われが ためさせて もらう！」');
      if ((await ev.battle('boss_star')) !== 'win') return false;
      faceNpc(ev, 'star_guardian');
      await ev.say('ほしのしゅごしん「……みごとだ。\nそなたらこそ ひかりを つぐ もの。」');
      await ev.say('「ほしの もんしょうを もってゆけ。\nそして まおうの やみから\nこの せかいを すくうのだ……。」');
      ev.sfx('holy');
      await vanish(ev, 'boss_star_done', 'flash');
      await ev.say('しゅごしんの すがたは\nほしくずと なって\nよぞらへ のぼっていった……。');
    },
  };
  E.star_crest = {
    meta: { needs: ['flag:boss_star_done'], gives: ['item:crest_star', 'flag:got_crest_star'] },
    run: (ev) => takeCrest(ev, {
      boss: 'boss_star_done', got: 'got_crest_star', item: 'crest_star', fallback: 'obj_temple',
      look: 'だいざの うえで\nぎんいろの もんしょうが\nほしぞらの ように きらめいている……。',
      after: 'ほしの もんしょうから あふれた ひかりが\n3にんの みちを\nてらしだす ように かがやいた……。',
    }),
  };
  /** the star-reading circle: a talking inscription that hints at the right pad */
  E.star_hint = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      await ev.say('ゆかに ほしぞらの ずが\nきざまれている……。');
      await ev.say('「まよえる たびびとよ\nうごかぬ ほしを めざせ。\fきたの そらに ひとつ\nけっして うごかぬ ほし あり」');
    },
  };

  // ============================================================ まおうじょう
  E.demon_castle_voice = {
    meta: { needs: [], gives: ['flag:demon_voice_heard'] },
    async run(ev) {
      if (ev.flag('demon_voice_heard')) return;
      ev.setFlag('demon_voice_heard');
      await ev.wait(30);
      ev.sfx('dark');
      await ev.flash('#300018', 16);
      await ev.say('どこからともなく\nひくい こえが ひびいてきた……。');
      await ev.say('「……きたか ひかりの こらよ。\fひゃくねんの ねむりの あいだ\nこの ときを まっていたぞ。\fわが しろにて ほろびるが よい……。」');
      await ev.say('ノン「いまの こえ……！」\nユウキ「まおうだ。 いこう みんな！」');
    },
  };
  /** the sealed circles near the entrance: examined while still sealed */
  E.demon_seal = {
    meta: { needs: [], gives: [] },
    async run(ev) {
      await ev.say('まほうじんが まがまがしい\nふういんで とざされている……。');
      await ev.say('この しろの どこかに\nふういんの ぬしが いるのだろう。');
    },
  };
  /** open shortcut circles (sealed until the general that holds them falls) */
  const SHORTCUT = {
    demon_gate_west: ['demon_castle_3', 'gate_w'],
    demon_gate_east: ['demon_castle_4', 'gate_e'],
    demon_gate_back3: ['demon_castle_1', 'gate_w'],
    demon_gate_back4: ['demon_castle_1', 'gate_e'],
  };
  for (const id in SHORTCUT) {
    const [map, spawn] = SHORTCUT[id];
    E[id] = {
      meta: { needs: [], gives: [] },
      async run(ev) {
        ev.sfx('teleport');
        await ev.flash('#c8a0ff', 8);
        await ev.warp(map, spawn);
      },
    };
  }

  E.demon_general1 = {
    meta: { needs: [], gives: ['flag:boss_general1_done'] },
    async run(ev) {
      if (ev.flag('boss_general1_done')) return;
      faceNpc(ev, 'dark_general');
      ev.sfx('dark');
      await ev.say('くろい よろいの きしが\nゆっくりと つるぎを ぬいた……。');
      await ev.say('あんこくしょうぐん「まっていたぞ\nひかりの もんしょうの こらよ。\fわれこそは まおうぐん さいきょうの けん\nあんこくしょうぐん！\fまおうさまの もとへは\nいっぽたりとも ゆかせぬ！」');
      await ev.say('ユウキ「そこを どいてもらう！」');
      if ((await ev.battle('boss_general1')) !== 'win') return false;
      faceNpc(ev, 'dark_general');
      await ev.say('あんこくしょうぐん「み みごと……。\nだが まおうさまの ちからは\nこんな ものでは ない……。」');
      ev.sfx('dark');
      await vanish(ev, 'boss_general1_done', 'fade');
      await ev.say('あんこくしょうぐんは\nくろい けむりと なって きえた……。');
      ev.sfx('warp');
      await ev.say('どこかで ふういんの とける\nおとが した……。');
    },
  };

  E.demon_general2 = {
    meta: { needs: [], gives: ['flag:boss_general2_done'] },
    async run(ev) {
      if (ev.flag('boss_general2_done')) return;
      faceNpc(ev, 'lich_general');
      ev.sfx('dark');
      await ev.flash('#40c060', 8);
      await ev.say('やみのだいまどうし「クックック……\nあんこくしょうぐんを やぶるとはな。」');
      await ev.say('「だが わしの やみの まほうの まえでは\nひかりなど むりょく！\fおまえたちの たましい\nまおうさまへの ささげものと\nしてくれようぞ！」');
      await ev.say('メテム「まほうで わたしに\nかてると おもわないでよね！」');
      if ((await ev.battle('boss_general2')) !== 'win') return false;
      faceNpc(ev, 'lich_general');
      await ev.say('やみのだいまどうし「ば ばかな……\nしを こえた この わしが……！\fまおうさま…… おゆるしを……。」');
      ev.sfx('dark');
      await vanish(ev, 'boss_general2_done', 'flash');
      await ev.say('だいまどうしの すがたは\nちりと なって くずれおちた……。');
      ev.sfx('warp');
      await ev.say('どこかで また ふういんの とける\nおとが した……。\fそして うえの かいから\nおそろしい けはいが ただよってくる……。');
    },
  };

  // ------------------------------------------------------------ the demon king
  async function kingTrueForm(ev) {
    ev.sfx('roar');
    await ev.shake(50, 4);
    await ev.say('まじん ヴァルザード「ほう……\nまだ ひかりに すがるか。\fよかろう！ なんど こようと\nやみに かえして くれるわ！」');
    const res = await ev.battle('boss_king2');
    return res === 'win';
  }
  async function finale(ev) {
    faceNpc(ev, 'demon_king2');
    await ev.say('まじん ヴァルザード「グオオオ……！\nば ばかな……！\fこの わしが……\nひかりに…… やぶれる など……！」');
    await ev.say('「……だが おぼえておけ……\nひとの こころに やみの ある かぎり\nわしは いつか また……\nよみがえる…… ぞ……。」');
    ev.closeMessage();
    ev.sfx('boss_die');
    await ev.flash('#ffffff', 20);
    ev.setFlag('boss_king2_done');
    ev.refresh();
    await ev.wait(40);
    await ev.say('まおう ヴァルザードは\nひかりの なかへ きえていった……。');
    await ev.wait(20);
    ev.closeMessage();
    ev.sfx('shake');
    await ev.shake(90, 3);
    await ev.say('ゴゴゴゴゴ……！\nまおうじょうが おおきく ゆれはじめた！');
    ev.sfx('earth');
    await ev.shake(70, 5);
    await ev.say('ノン「しろが くずれます！」\nメテム「はやく にげないと……！」');
    ev.closeMessage();
    ev.sfx('holy');
    await ev.flash('#fff8d0', 30);
    await ev.say('そのとき ひかりの もんしょうが\nまばゆく かがやき\n3にんを やさしく つつみこんだ……。');
    ev.setFlag('game_clear');
    nextObjective(ev, 'obj_clear');
    await ev.flash('#ffffff', 40);
    if (R.Ending && R.Ending.start) {
      await ev.ending();
      return;
    }
    // no ending system: bring the party out safely
    await ev.warp('world', 'demon_castle_1');
    await ev.say('せかいに へいわが もどった。\nおめでとう！');
  }

  E.demon_king = {
    meta: { needs: [], gives: ['flag:boss_king1_done', 'flag:boss_king2_done', 'flag:game_clear'] },
    async run(ev) {
      if (ev.flag('boss_king2_done')) return;
      if (ev.flag('boss_king1_done')) {
        // the true form waits on the throne after a lost fight
        faceNpc(ev, 'demon_king2');
        if (!(await kingTrueForm(ev))) return false;
        await finale(ev);
        return;
      }
      faceNpc(ev, 'demon_king');
      if (R.Audio && R.Audio.stopBGM) { try { R.Audio.stopBGM(60); } catch (e) { /* ignore */ } }
      await ev.wait(40);
      await ev.say('ぎょくざの まおうが\nゆっくりと たちあがった……。');
      await ev.say('まおう「……よくぞ まいった\nひかりの もんしょうに\nえらばれし ものたちよ。」');
      await ev.say('「ひゃくねん まえ わしを ふうじた\nあの にくき ひかり……\nおまえたちの なかにも みえるぞ。\fだが ひかりは いつか かならず\nやみに のまれる。\nそれが この せかいの さだめ。」');
      await ev.say('「さあ こい！\nひゃくねんの うらみ\nその みで おもいしるが よい！」');
      await ev.say('ユウキ「……いくぞ みんな！」\nノン「はい！」\nメテム「とうぜん！」');
      if ((await ev.battle('boss_king1')) !== 'win') return false;
      faceNpc(ev, 'demon_king');
      await ev.say('まおう「ぐ…… ぐおお……。\nまさか これほどとは……。」');
      await ev.say('「……だが これで おわりと おもうな！\nみるが よい……\nこれが わが まことの すがた！」');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.flash('#600020', 16);
      await ev.shake(60, 5);
      ev.setFlag('boss_king1_done');
      ev.refresh();
      await ev.flash('#600020', 16);
      await ev.wait(30);
      faceNpc(ev, 'demon_king2');
      await ev.say('まじん ヴァルザード「グオオオオ！\nこの すがたを みて\nいきて かえった ものは おらぬ！」');
      ev.sfx('holy');
      await ev.flash('#fff8d0', 16);
      ev.heal();
      await ev.say('そのとき ひかりの もんしょうが\nまばゆく かがやいた！\f3にんの きずが\nみるみる いえていく……！');
      await ev.say('まじん「おのれ いまいましい ひかりめ！\nまとめて やみに かえしてくれる！」');
      if ((await ev.battle('boss_king2')) !== 'win') return false;
      await finale(ev);
    },
  };
})(window.RPG);
