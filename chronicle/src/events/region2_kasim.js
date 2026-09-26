// Region 2 r_desert ザハラ砂漠 (R2 reg2) — the town events and the region's objectives.
// DESIGN §10.8.0 (common rules), §10.8.3 (the region's table), §10.13.8 (objectives).
//   kasim_intro        onEnter of kasim, once (flag desert_start): 隊商の長ザイード tells of the sandstorm
//                      and the drying spring → objective obj_desert_1 (region r_desert)
//   kasim_abul         墓守アブル: the king and the three letters; ロウェルの痕跡 before the clear; after
//                      the clear he gives the region's reward (kasim_abul_reward)
//   kasim_abul_reward  once: 砂王の印章 ac_tale_desert (§8 報酬の表, §10.15 装備の章 2)
//   kasim_nadia        踊り子ナディア: the blank in the evening prayer / the dance for ハザル王
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_desert';

  // ------------------------------------------------------------ objectives (obj_desert_1..3, §10.8.3)
  Object.assign(R.DB.objectives, {
    obj_desert_1: { text: '南西の砂の王墓で、\n王の名を探そう。' },
    obj_desert_2: { text: '墓守の像の台座から、\n王の名の文字を集めよう。' },
    obj_desert_3: { text: '王墓の奥で、\n名なき王に名を返そう。' },
  });

  // ------------------------------------------------------------ #1 隊商の長ザイード (onEnter, once)
  E.kasim_intro = {
    meta: { needs: [], gives: ['flag:desert_start'] },
    run: async (ev) => {
      if (ev.flag('desert_start')) return;
      if (ev.cleared(REGION)) { ev.setFlag('desert_start'); return; }
      await ev.wait(12);
      const z = ev.npc('zaid');
      const p = ev.player;
      // ザイード hurries over from the caravan camp to the traveller at the gate
      if (z.visible && p.x != null) {
        z.setPos(p.x + 3, p.y - 2, 'left');
        await z.walk('LL');
        z.face('player');
      }
      await ev.say('旅の人か。よく、この砂嵐を\n抜けてきたな。');
      await ev.say('わたしはザイード。この町の\n隊商をまとめている。');
      await ev.say('砂嵐のせいで、隊商が出せない。');
      await ev.say('オアシスの水も、日に日に減っている。');
      await ev.say('嵐は、南西の王墓のあたりから\n吹いてくるようだ。\n墓守のアブルじいさんなら、\n何か知っているかもしれん。');
      ev.closeMessage();
      ev.setFlag('desert_start');
      ev.setObjective('obj_desert_1', { region: REGION });
      if (z.visible) {
        await z.walk('RR');
        z.setPos(33, 33, 'down');
      }
    },
  };

  // ------------------------------------------------------------ #2 墓守アブル
  const REWARD = 'ac_tale_desert';
  E.kasim_abul = {
    meta: { needs: [], gives: [], calls: ['kasim_abul_reward'] },
    run: async (ev) => {
      const n = ev.var('desert_letters') || 0;
      if (ev.cleared(REGION)) {
        if (!ev.flag('kasim_abul_reward')) { await ev.call('kasim_abul_reward'); return; }
        if (ev.check({ postgame: true })) {
          await ev.say('世界じゅうの昔話が\n戻ってきたそうじゃな。\nハザル王も、きっと\n喜んでおられるじゃろう。');
          return;
        }
        if (ev.check({ tier: 4 })) {
          await ev.say('記録院の書記が、王墓の\n碑文を写させろと言ってきた。\n……今度は、断ったわい。');
          return;
        }
        await ev.say('ハザル王は、また静かに\n眠っておられる。\n墓守の仕事も、はかどるわい。');
        return;
      }
      if (n >= 3) {
        await ev.say('ハザル……そうじゃ、\nハザル王じゃ！\nわしとしたことが、なぜ\n忘れておったのか。');
        await ev.say('王墓の奥で、王に名を\n返してさしあげてくだされ。\n王は、ご自分の名を\n探しておられるのじゃ。');
        return;
      }
      if (n >= 1) {
        await ev.say('台座の文字を見つけなすったか。\n三つそろえば、\n王の名になるはずじゃ。');
        await ev.say('墓守の像は、王墓の\n一階から三階まで、\nひとつずつ立っておる。');
        return;
      }
      await ev.say('王墓の王が目覚めたのじゃ。\n名を忘れられて……。');
      await ev.say('大干ばつの年、王はご自分の\n名を砂の精霊に差し出して、\nこのオアシスの水を得たのじゃ。');
      await ev.say('民は、毎日の夕べの祈りで\n王の名を唱えると誓った。\n……その名が、出てこんのじゃ。');
      await ev.say('王の名は、\n墓守の像の台座に一文字ずつ刻まれておる。');
      await ev.say('記録院の若者が、碑文を\n写しに来たことがあった。\nそれからじゃ、王の名が\n誰の口からも出なくなった。');
    },
  };

  // ------------------------------------------------------------ the region's reward (once)
  E.kasim_abul_reward = {
    meta: { needs: ['region:' + REGION], gives: ['item:' + REWARD, 'flag:kasim_abul_reward'] },
    run: async (ev) => {
      if (ev.flag('kasim_abul_reward')) return;
      await ev.say('おお……王の名を、\n呼んでくださったのじゃな。');
      await ev.say('今朝の祈りで、町の者が\nみな「ハザル王」と唱えておった。\n……わしも、泣けてきてのう。');
      await ev.say('これは、墓守の家に代々\n伝わる王の印章じゃ。\nあなたが持つのが、\nいちばんふさわしい。');
      const ok = await ev.give(REWARD);
      if (ok === false) {
        await ev.say('持ち物がいっぱいのようじゃな。\n身軽になったら、\nまた来てくだされ。');
        return false;
      }
      ev.setFlag('kasim_abul_reward');
    },
  };

  // ------------------------------------------------------------ #3 踊り子ナディア
  E.kasim_nadia = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.check({ postgame: true })) {
        await ev.say('旅の一座に誘われたの。\nハザル王の踊りを、\n大陸じゅうで踊ってくるわ！');
        return;
      }
      if (ev.cleared(REGION)) {
        await ev.say('ハザル王に捧げる踊りよ。\n名前を呼ぶところで、\nくるっと回るの！');
        ev.sfx('glimmer');
        await ev.say('ゆうべは、町じゅうの人が\n声をそろえて呼んでくれたわ。\n……{hero}、ありがとう。');
        return;
      }
      await ev.say('夕べの祈りで、王さまの\n名前を呼んでいたはずなのに、\nその名前だけが白く抜けてるの。');
      if ((ev.var('desert_letters') || 0) >= 3) {
        await ev.say('ハザル……ハザル王！\nそうよ、その名前よ！\n早く王さまに届けてあげて。');
        return;
      }
      await ev.say('踊りの振りは覚えてるのよ。\nでも、名前を呼ぶところで、\n足が止まっちゃうの。');
    },
  };
})(window.RPG);
