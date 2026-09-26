// The way into the endgame: ロアの里 after the eighth page (DESIGN §10.10.1). Owner: story (A19).
//   story_final_roa   roa's onEnter (A18b's roa_enter calls it when ['st_fine_reveal','!final_roa']).
//                     The master (a stand-in of her in the village), フィーネ and ロウェル by the gate:
//                     the eight pages are read aloud, ベルナ remembers her pupil, the pages' light clears the
//                     inner sea's fog (final_open), and she gives her parting gift (roa_berna_gift).
(function (R) {
  'use strict';
  const E = R.DB.events;
  const S = R.Story;
  const say = S.said;

  /** the eight lines of the poem (§10.2.3), in the regions' order; the menu's table if it has one */
  const POEM = {
    k_page_forest: 'はじめに言葉はなく、\nただ白い闇があった。',
    k_page_desert: '名もなきものは、\n名を持つすべてを\nうらやんだ。',
    k_page_snow: 'わたしは火をともし、\n最初の物語を語った。',
    k_page_marsh: '白い闇は物語を恐れ、\n深い眠りについた。',
    k_page_isles: 'わたしは八つの土地に、\n八つの物語を預けた。',
    k_page_mine: '語り継がれる限り、\n白い闇は目覚めない。',
    k_page_ash: 'けれど忘れられたとき、\n闇はふたたび目を開く。',
    k_page_star: 'そのときは、\n白い闇の名を記しなさい。\nその名は――',
  };
  S.POEM = POEM;
  S.poem = function (id) {
    const c = R.DB.config && R.DB.config.chronicle;
    return (c && c.pages && c.pages[id]) || (R.DB.items[id] && R.DB.items[id].poem) || POEM[id];
  };

  E.story_final_roa = {
    meta: {
      needs: ['flag:st_fine_reveal', 'tier:8'],
      gives: ['flag:final_roa', 'flag:final_open', 'flag:st_berna_forgot', 'flag:roa_berna_gift', 'item:ac_berna_charm'],
    },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('final_roa')) return;
      const staged = ev.map === 'roa' && R.Field && R.Field.map;
      ev.bgm('home');
      // the story stone on the village green: the master in front of it, the hero; フィーネ and ロウェル come
      // along the green from the east
      let berna = null, fine = null, rowell = null;
      if (staged) {
        await ev.fadeOut(20);
        ev.player.setPos(22, 19, 'up');
        berna = S.actor(ev, 'st_berna', 'npc:berna', 22, 17, 'down');
        fine = S.slot(ev, 'st_fine', S.fineSprite());
        rowell = S.slot(ev, 'st_rival');
        fine.setPos(28, 19, 'left');
        rowell.setPos(28, 20, 'left');
        await ev.fadeIn(24);
        await ev.wait(20);
      }
      // 1. the master has forgotten (the first three lines of story_home_t6)
      if (!ev.flag('st_berna_forgot')) {
        for (const p of S.HOME_T6) await ev.say(say('berna', p));
      } else {
        await ev.say(say('berna', '旅の方？　また来てくれたのね。\n……ゆっくりしていきなさい。'));
      }
      ev.closeMessage();
      // 2. フィーネ and ロウェル arrive
      if (staged) {
        await Promise.all([fine.walk('L5'), rowell.walk('L5')]);
        await fine.walk('U');
        fine.face('left'); rowell.face('up');
        ev.player.face('right');
        await ev.wait(10);
        ev.player.face('up');
        await ev.wait(16);
      }
      await ev.say(say('fine', 'ベルナさん。\nあなたの弟子の物語を、\n聞いてくれる？'));
      await ev.say(say('berna', 'そちらのお嬢さんは……\nどこかで……。'));
      await ev.say(say('fine', '……いいの。わたしのことは、\nいつか思い出してくれれば。'));
      ev.closeMessage();
      ev.bgm('shrine');
      await ev.say('フィーネは、八枚のページを\n一枚ずつ読み上げた。');
      ev.closeMessage();
      for (const id of ['k_page_forest', 'k_page_desert', 'k_page_snow', 'k_page_marsh', 'k_page_isles', 'k_page_mine', 'k_page_ash', 'k_page_star']) {
        ev.sfx('page');
        await ev.caption(S.poem(id), { frames: 110 });
      }
      await ev.wait(20);
      // 3. she remembers
      ev.bgm('home');
      if (berna) { berna.face('down'); await ev.wait(10); }
      await ev.say(say('berna', '……{hero}……！\nああ、どうして\n忘れていたのかしら。'));
      await ev.say(say('berna', 'おかえり。……よく、\nここまで書いたね。'));
      ev.setFlag('st_berna_forgot');
      // 4. the way on
      await ev.say(say('berna', '始まりの年代記は、\nビブリアの大書庫の頂にある。\nわたしの師匠が、\nそう言っていた。'));
      await ev.say(say('rowell', '島へは、ファロスの港から\n船を出させる。……おれも行く。'));
      ev.closeMessage();
      // 5. the pages' light clears the fog of the inner sea
      if (rowell) rowell.face('right');
      ev.sfx('light');
      await ev.flash('#ffffff', 16);
      await ev.flash('#fffbe0', 12);
      await ev.caption('八枚のページの光が、\n内海の白い霧を払っていく……。', { frames: 180 });
      ev.setFlag('final_roa');
      ev.setFlag('final_open');
      ev.refresh();
      // 6. the master's parting gift
      if (!ev.flag('roa_berna_gift')) {
        await ev.say(say('berna', 'これを持ってお行き。\nわたしが若いころ、師匠から\nもらった首飾りだよ。'));
        await ev.give('ac_berna_charm');
        ev.setFlag('roa_berna_gift');
      }
      await ev.say(say('berna', '行っておいで、{hero}。\n今度こそ、ちゃんと\n覚えているからね。'));
      await ev.say(say('fine', '……先に、島で待っているわ。'));
      ev.closeMessage();
      if (staged) {
        ev.sfx('magic');
        await ev.flash('#e8ecff', 10);
        fine.hide();
        await ev.wait(16);
      }
      await ev.say(say('rowell', 'おれは先に港へ行って、\n船を用意させておく。\nファロスで会おう。'));
      ev.closeMessage();
      if (staged) {
        rowell.face('right');
        await rowell.walk('R6');
        await ev.fadeOut(20);
        S.hideSlot(ev, 'st_fine');
        S.hideSlot(ev, 'st_rival');
        S.dropActors();
        ev.refresh();
        await ev.fadeIn(20);
      } else {
        ev.setFlag('st_show_fine', false);
        ev.setFlag('st_show_rival', false);
      }
      ev.setObjective('obj_s_final_ferry');
      ev.bgm();
    },
  };
})(window.RPG);
