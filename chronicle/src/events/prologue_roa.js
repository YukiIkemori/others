// Prologue (A18b) — ロアの里 (DESIGN §10.7 P1–P2, §10.9.3, §10.10.1).
//   roa_house_intro  P1  the opening narration, the master at the bedside, ev.createHero()
//   roa_berna        P2  the master's talk (白紙, the dark lighthouse, companions, 3 salves + 50 gold);
//                        afterwards her lines by tier and the free lodging (§10.9.3)
//   roa_stone            the half-blank story stone (examine)
//   roa_gate             stops the hero at the gate until the master has spoken
//   roa_enter            roa's onEnter: runs the story's scenes that belong to roa
//                        (story_final_roa §10.10.1, story_home_t6 §10.9.3) when their conds hold
(function (R) {
  'use strict';
  const E = R.DB.events;
  const K = R.Prologue;

  // ------------------------------------------------------------ P1 オープニング
  E.roa_house_intro = {
    meta: { needs: [], gives: ['flag:hero_created', 'flag:pro_start'] },
    run: async (ev) => {
      if (ev.flag('pro_start') || ev.map !== 'roa_house') return;
      await ev.fadeOut(0); // 暗転のまま (the captions keep the black screen)
      const berna = ev.npc('berna');
      berna.setPos(14, 4, 'up');
      ev.player.setPos(14, 3, 'down');
      await ev.wait(40);
      await ev.caption('……ねえ、聞こえる？');
      await ev.caption('これは、忘れられかけた物語。');
      await ev.caption('そして、それを語り直した、\nひとりの語り部の物語。');
      await ev.wait(30);
      await ev.fadeIn(48);
      await ev.wait(20);
      await ev.say('おはよう。今日は大事な日だよ。');
      await ev.say('語り部の名簿に、\nあなたのことを書いておかないとね。');
      await ev.say('さあ、見習いさん。\nあなたがどんな子だったか、\nもう一度聞かせておくれ。');
      await ev.createHero();
      await ev.say('{hero}。……うん、いい名前だ。');
      await ev.say('支度ができたら、\nわたしの書見台までおいで。\n話しておきたいことがあるんだ。');
      ev.closeMessage();
      await berna.walk('DL5U');
      berna.face('down');
      ev.setFlag('pro_start');
      ev.setObjective('obj_p_roa');
    },
  };
  // Field.start fades the first map in before its onEnter runs; for the very first scene the
  // screen must stay black (P1 「暗転のまま」). Start the intro as soon as roa_house loads — its
  // first step blacks the screen out before anything is drawn. The onEnter run that follows
  // finds pro_start set and does nothing.
  if (R.on) {
    R.on('mapload', (id) => {
      if (id !== 'roa_house' || !R.Game || R.State.flag('pro_start')) return;
      if (R.Events.busy && R.Events.busy()) return;
      R.Events.run('roa_house_intro', { trigger: 'enter', self: 'roa_house', onlyOnMap: 'roa_house' });
    });
  }

  // ------------------------------------------------------------ P2 師匠ベルナ
  const P2 = [
    'そうそう、大事な話があるんだ。',
    '近ごろ、あちこちで\n伝承が消えていくんだよ。\n歌の続きが出てこない、\n祭りの由来が分からない……。',
    'わたしたち語り部は、それを\n『白紙』と呼んでいる。\n里の語り石の文字も、\n半分が白く抜けてしまった。',
    'それにね、港町ファロスの\n灯台の火が、三晩も\n消えたままだそうだ。',
    'あの灯台には、守り歌という\n古い伝承があってね。\nきっと、それも白紙に\nなりかけているんだよ。',
    '{hero}、行っておくれ。\n語り部の見習いとしての、\n最初の仕事だよ。',
    'ただし、ひとりで行っちゃ\nだめだよ。ファロスの酒場で、\n旅の仲間を探しなさい。',
    'それから、これを持って\nお行き。',
  ];
  E.roa_berna = {
    meta: { needs: ['flag:pro_start'], gives: ['flag:pro_berna_sent', 'item:i_salve'] },
    run: async (ev) => {
      if (!ev.flag('pro_start')) return;
      if (!ev.flag('pro_berna_sent')) {
        for (const t of P2) await ev.say(t);
        await ev.give('i_salve', 3);
        await ev.giveGold(50);
        await ev.say('ファロスは、里を出て\n南東へ行った所だよ。\n……気をつけてお行き、{hero}。');
        ev.setFlag('pro_berna_sent');
        ev.setObjective('obj_p_to_lute');
        return;
      }
      // after the prologue: the first line that applies, then a free night (§10.9.3)
      if (ev.check({ postgame: true })) {
        await ev.say('おかえり、{hero}。子どもたちが、\nあなたの話を聞きたがってるよ。');
        await K.stay(ev);
        return;
      }
      if (ev.flag('final_roa')) {
        await ev.say('行っておいで、{hero}。\n今度こそ、ちゃんと\n覚えているからね。');
        await K.stay(ev);
        return;
      }
      if (ev.tier() >= 6) {
        if (!ev.flag('st_berna_forgot') && E.story_home_t6) await ev.call('story_home_t6');
        else await ev.say('旅の方？　よかったら、\n休んでいきなさい。');
        await K.stay(ev, true);
        return;
      }
      if (ev.tier() >= 3) {
        await ev.say('おかえり。……ええと、あなたは\n……そう、{hero}。ごめんね、\n名前がすぐに出てこなくて。');
        await K.stay(ev);
        return;
      }
      if (ev.flag('prologue_done')) {
        await ev.say('おかえり。年代記は、\nちゃんと書いているかい？');
        await K.stay(ev);
        return;
      }
      // still in the prologue
      if (ev.flag('pro_key')) await ev.say('灯台の鍵を預かったんだね。\n灯台は、半島の南の岬だよ。\n……気をつけてお行き。');
      else if (ev.flag('pro_party_chosen')) await ev.say('いい仲間に会えたようだね。\n……みんな、{hero}を\nよろしく頼むよ。');
      else await ev.say('ファロスは、里を出て\n南東へ行った所だよ。\n酒場で仲間を探しなさい。');
    },
  };

  // ------------------------------------------------------------ 語り石
  E.roa_stone = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.check([{ tier: 6 }, '!final_roa'])) {
        await ev.say('語り石が、真っ白になっている。\n刻まれていた物語が、\nすっかり消えてしまった……。');
        return;
      }
      if (ev.check({ postgame: true })) {
        await ev.say('語り石の文字は、\n半分が消えたままだ。');
        await ev.say('けれど里の人たちは、\nその続きを、声に出して\n語り継いでいる。');
        return;
      }
      await ev.say('石に物語が刻まれている。\f「むかし、ひとりの語り部が、\nこの森に火をともした。\nその火は、夜ごと――」');
      await ev.say('石に刻まれた物語の半分が、\n白く抜けている……。');
    },
  };

  // ------------------------------------------------------------ 里の出口
  E.roa_gate = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.flag('pro_berna_sent')) return;
      ev.npc('gatewoman').face('player');
      await ev.say('師匠に、あいさつして\nいかないのかい？');
      ev.closeMessage();
      await ev.player.walk('U');
    },
  };

  // ------------------------------------------------------------ roa の onEnter
  E.roa_enter = {
    meta: { needs: [], gives: [], calls: ['story_final_roa', 'story_home_t6'] },
    run: async (ev) => {
      if (ev.map !== 'roa') return;
      if (E.story_final_roa && ev.check(['st_fine_reveal', '!final_roa'])) { await ev.call('story_final_roa'); return; }
      if (E.story_home_t6 && ev.check(['st_t6', '!st_berna_forgot'])) await ev.call('story_home_t6');
    },
  };
})(window.RPG);
