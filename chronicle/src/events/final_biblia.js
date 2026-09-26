// 書の都ビブリア (DESIGN §10.10.2). Owner: story (A19).
//   biblia_arrival   onEnter: the first arrival by the ferry (once: final_arrived). The white town, ノア who still
//                    remembers, ロウェル who goes ahead to the north gate. → obj_s_final_archive
//   biblia_rowell    ロウェル at the north gate (until final_rowell)
//   biblia_noa       ノア, the inn's mistress: Mira's song, a free night's rest
//   biblia_portrait  the portrait of 大書記ラザロ in 記録院 本院 (examine)
//   biblia_statue    the nameless storyteller's statue in the plaza (examine)
//   biblia_tome      the legend of the eastern continent in the great library (examine; the Crest tie-in §10.1.3)
(function (R) {
  'use strict';
  const E = R.DB.events;
  const S = R.Story;
  const say = S.said;
  const NONE = { needs: [], gives: [] };

  E.biblia_arrival = {
    meta: { needs: ['flag:final_open'], gives: ['flag:final_arrived'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.map !== 'biblia') return;
      if (ev.flag('final_arrived')) {
        if (ev.check({ postgame: true })) ev.bgm('town');
        return;
      }
      const m = R.Field && R.Field.map;
      const p = R.Field && R.Field.pos ? R.Field.pos() : null;
      const atDock = !!(m && p && m.spawns.dock && p.x === m.spawns.dock.x && p.y === m.spawns.dock.y);
      let lost = null, noa = null, rowell = null;
      if (atDock) {
        // the party comes up the pier onto the quay; ロウェル came over on the same ship
        ev.player.face('up');
        rowell = S.actor(ev, 'st_rowell', 'npc:rowell', 35, 36, 'up');
        lost = S.actor(ev, 'st_lost', 'npc:woman', 31, 35, 'right');
        await ev.wait(30);
        await lost.walk('R4');
        lost.face('down');
        await ev.wait(10);
      }
      await ev.say('……あなたは、誰？\nわたしは……誰だったかしら。');
      ev.closeMessage();
      if (lost) {
        lost.face('left');
        await lost.walk('L5');
        lost.hide();
        await ev.wait(10);
        rowell.face('right');
      }
      await ev.say(say('rowell', '……ひどいな。町じゅうが、\n白紙になりかけている。'), { voice: 'v_rowell_biblia_01' });
      ev.closeMessage();
      if (atDock) {
        noa = S.actor(ev, 'st_noa', 'npc:woman', 29, 35, 'right');
        await noa.walk('R6');
        noa.face('down');
        rowell.face('up');
      }
      await ev.say('ノア「あなたたち、この町の人じゃ\nないわね。……ロウェル？」', { voice: 'v_noa_biblia_01' });
      await ev.say(say('rowell', 'ノアさん。あんたは、\n覚えているのか。'), { voice: 'v_rowell_biblia_02' });
      await ev.say('ノア「ミラに教わった歌を、\n毎晩歌っていたから……\nわたしだけ、忘れずにいるの。」', { voice: 'v_noa_biblia_02' });
      await ev.say('ノア「ここは記録院の町、ビブリア。\nでも、みんな大事なことを\n忘れてしまったの。」', { voice: 'v_noa_biblia_03' });
      await ev.say('ノア「院長さまのお嬢さん……\nミラは、わたしの友だちだった。\n二十年前の戦争で……。」', { voice: 'v_noa_biblia_04' });
      await ev.say(say('rowell', '大書庫の中は、院長の書記たちで\nいっぱいだ。3階の封印の扉は、\nおれの手帳の言葉で開く。'), { voice: 'v_rowell_biblia_03' });
      await ev.say(say('rowell', 'おれは、町の北の門で待つ。\n支度ができたら、来てくれ。'), { voice: 'v_rowell_biblia_04' });
      ev.closeMessage();
      if (rowell) {
        await rowell.walk('L');
        await rowell.walk('U3');
        rowell.hide();
      }
      await ev.say('ノア「疲れたら、宿へどうぞ。\nわたしは、宿のおかみなの。\n……あなたたちなら、お代は\nいらないわ。」');
      ev.closeMessage();
      if (noa) { await noa.walk('L6'); noa.hide(); }
      ev.setFlag('final_arrived');
      ev.setObjective('obj_s_final_archive');
      S.dropActors();
      ev.refresh();
    },
  };

  E.biblia_rowell = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      ev.npc('rowell').face('player');
      await ev.say('大書庫は、北東の丘の上だ。\n中は、院長の書記たちで\nいっぱいだろう。');
      await ev.say('3階の封印の扉は、\nおれの手帳の言葉で開く。\n……先に行って、待っている。');
    },
  };

  /** a free night at ノアの宿 */
  async function stay(ev) {
    if (!(await ev.yesno('休んでいく？'))) { await ev.say('いつでもどうぞ。\n……気をつけてね。'); return; }
    await ev.say('ゆっくり休んでいって。');
    ev.closeMessage();
    await ev.fadeOut(30);
    ev.heal();
    ev.setRespawn('biblia', 'inn');
    await ev.jingle('inn');
    await ev.wait(20);
    await ev.fadeIn(30);
    await ev.say('おはよう。よく眠れた？\nいってらっしゃい。');
  }
  E.biblia_noa = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      ev.npc('noa').face('player');
      if (ev.check({ postgame: true })) {
        await ev.say('ミラの歌を、町のみんなが\n歌えるようになったの。\n……ありがとう。');
        await ev.say('♪　白い本のページに、\nあなたの名を書こう\n忘れないように、なくさぬように');
      } else if (ev.flag('final_lazaro')) {
        await ev.say('院長さまに……会ったの？\n……そう。ミラのことを、\n思い出してくれたのね。', { voice: 'v_noa_biblia_05' });
      } else {
        await ev.say('ミラはね、歌が好きな子だった。\n「名前は、呼ばれるために\nあるのよ」って、よく言ってたわ。', { voice: 'v_noa_biblia_06' });
      }
      await stay(ev);
    },
  };

  E.biblia_portrait = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.check({ postgame: true })) {
        await ev.say('大書記ラザロの肖像画だ。\nとなりに、小さな女の子の\n絵が掛けられている。');
        await ev.say('女の子は、楽しそうに\n歌っているように見えた。');
        return;
      }
      await ev.say('大書記ラザロの肖像画だ。\n穏やかな目で、こちらを\n見下ろしている。');
      if (ev.flag('final_lazaro')) await ev.say('その目は、どこか\nさみしそうに見えた。');
    },
  };

  E.biblia_statue = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.check({ postgame: true })) {
        await ev.say('灰色のマントの少女の像だ。\n台座に、いつのまにか\n名前が刻まれていた。');
        await ev.caption('――フィーネ。');
        return;
      }
      await ev.say('灰色のマントの少女の像だ。\n「名もなき語り部」と\n呼ばれているらしい。');
      await ev.say('台座の文字は、\n白く消えている。');
    },
  };

  E.biblia_tome = {
    meta: NONE,
    run: async (ev) => {
      S.autoPos(ev);
      await ev.say('書見台に、古い本が\n開いたまま置かれている。\f「紋章の大陸の伝説」');
      if (!ev.check({ postgame: true })) await ev.say('ほかの本は白紙なのに、\nこの本の字だけは、\nかすかに残っている。');
      await ev.say('三百年前、海の向こうの大陸で、\n三人の勇者が、魔王\nヴァルザードを討ったという。');
      await ev.say('剣の家の若者、神殿の娘、\n魔法の天才。');
      await ev.say('光の紋章は魔王を封じ、\n大陸に光が戻った。');
      await ev.say('……勇者たちの名は、\nとうに忘れられてしまった。');
    },
  };
})(window.RPG);
