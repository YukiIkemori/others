// R3 (reg3) — 雪の村ユール: the events of r_snow ノルデン雪原 in the village (DESIGN §10.8.0, §10.8.4).
//   yule_enter        yule's onEnter: runs yule_intro once (snow_start)
//   yule_intro        #1 村長ヨルン meets the traveller at the gate: the blizzard, the lost fire → obj_snow_1
//   yule_sonja        #2 火守りの娘ソーニャ (the carved stones, the recorder who came in autumn)
//   yule_hearth       #3 the great hearth: the story read aloud, the fire lit → k_winter_flame, obj_snow_2
//   yule_jorn         村長ヨルン in the hall (hints; after the clear → yule_jorn_reward)
//   yule_jorn_reward  the region reward 冬至の火の守り (ac_tale_snow, §8.8), once
//   yule_statue       白竜ネーヴェの像 in the plaza
// Objectives obj_snow_1..2 are registered here (§10.13.8: the region owner registers obj_<rs>_<n>).
(function (R) {
  'use strict';
  const E = R.DB.events;

  Object.assign(R.DB.objectives, {
    obj_snow_1: { text: '村の古いかまどで、\n冬至の火をともそう。' },
    obj_snow_2: { text: '冬至の火種を持って、\n白竜の峰の頂を目指そう。' },
  });
  const REGION = { region: 'r_snow' };

  // ------------------------------------------------------------ onEnter
  E.yule_enter = {
    meta: { needs: [], gives: ['flag:snow_start'], calls: ['yule_intro'] },
    run: async (ev) => {
      if (ev.map !== 'yule') return;
      if (!ev.flag('snow_start')) await ev.call('yule_intro');
    },
  };

  // ------------------------------------------------------------ #1 村長ヨルン
  E.yule_intro = {
    meta: { needs: [], gives: ['flag:snow_start'] },
    run: async (ev) => {
      if (ev.flag('snow_start')) return;
      const j = ev.npc('jorn_gate');
      await ev.wait(20);
      if (j.visible) {
        await j.walk('D');
        j.face('player');
      }
      await ev.say('……旅の方か。よくこの吹雪の中を\n来てくださった。');
      await ev.say('わしは、この村の村長の\nヨルンという。');
      await ev.say('この吹雪は、もう三か月も続いている。');
      await ev.say('冬至の火が消えたのだ。火の物語を、\n誰も思い出せん。');
      await ev.say('昔は、冬至の夜に集会所の\nかまどで大きな火をたき、\n北の峰の白竜さまに、\n竜の物語を届けたものじゃ。');
      await ev.say('……よかったら、集会所の\nかまどを見てやってくれんか。\n村の北の、大きな建物じゃ。');
      ev.closeMessage();
      if (j.visible) {
        await j.walk('UUUU');
        j.hide();
      }
      ev.setFlag('snow_start');
      ev.setObjective('obj_snow_1', REGION);
      ev.refresh();
    },
  };

  // ------------------------------------------------------------ #2 火守りの娘ソーニャ
  E.yule_sonja = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const s = ev.npc('sonja');
      s.face('player');
      if (ev.cleared('r_snow')) {
        if (ev.check({ postgame: true })) {
          await ev.say('冬至のお祭りでね、\n子どもたちが竜の物語を\n語ってくれたの。');
          await ev.say('{hero}のことも、\nちゃんと物語に入ってたわ。');
          return;
        }
        await ev.say('♪　白き竜よ、北の峰に\n冬至の火を、道しるべに');
        await ev.say('……ふふ、火の物語の歌よ。\nやっと、みんなで歌えるの。');
        await ev.say('この火は、もう消さないわ。\n毎年、白竜さまに\n物語を届けるの。');
        return;
      }
      if (ev.flag('snow_flame')) {
        await ev.say('この火を、峰の頂の\n白竜さまへ届けて。');
        await ev.say('白竜の峰は、村から北西。\n分厚い氷の壁も、\nこの火ならきっととかせるわ。');
        return;
      }
      await ev.say('わたしはソーニャ。\nこのかまどの火守りの家の\n娘なの。');
      await ev.say('集会所のかまどの石に、\n昔の物語が彫ってあるの。でも古い字で、\nわたしには読めない。');
      await ev.say('秋に、記録院の記録官が\n火の物語を聞きに来たの。\n書き写して帰っていったわ。\nそれから、火が消えたの。');
      await ev.say('語り部さんなら、\nかまどの石が読めるかしら。');
    },
  };

  // ------------------------------------------------------------ #3 かまど（冬至の火）
  E.yule_hearth = {
    meta: { needs: ['flag:snow_start'], gives: ['flag:snow_flame', 'item:k_winter_flame'] },
    run: async (ev) => {
      if (ev.flag('snow_flame')) {
        await ev.say('冬至の火が、赤々と\n燃えている。');
        await ev.say('かまどの石には、白竜と村の\n約束の物語が刻まれている。');
        if (!ev.has('k_winter_flame')) {
          // the key item cannot be sold or dropped, but keep the story whole if it is ever missing
          await ev.say('{hero}は、かまどの火を\nもう一度、火種に移した。');
          await ev.give('k_winter_flame');
        }
        return;
      }
      await ev.say('大きなかまどだ。火は消えて、\n灰が冷えきっている。');
      if (!ev.flag('snow_start')) return;
      await ev.say('かまどの石に、古い文字が\n一面に刻まれている……。');
      await ev.say('{hero}は、かまどの石の物語を\n読み解いて、声に出して語った。');
      ev.closeMessage();
      await ev.caption('白き竜は北の峰に住み、\n冬の吹雪を鎮めた。', { frames: 170 });
      await ev.caption('人々は冬至の夜に火をともし、\n竜の物語を峰へ届けると誓った。', { frames: 190 });
      ev.sfx('fire');
      await ev.flash('#ffb060', 10);
      ev.setFlag('snow_flame');
      ev.refresh();
      await ev.shake(10, 1);
      await ev.say('かまどに、火がともった！');
      const s = ev.npc('sonja');
      s.face('player');
      await ev.say('火が……！　この火を、\n峰の頂の白竜さまへ。');
      await ev.say('冬至の火種よ。\nこの火なら、峰の氷も\nとかせるはず。');
      await ev.give('k_winter_flame');
      const j = ev.npc('jorn');
      if (j.visible) {
        j.face('player');
        await ev.say('おお……冬至の火だ。\nこの火を見るのは、\nいつ以来じゃろう。');
        await ev.say('白竜の峰は、村から北西じゃ。\nどうか、竜の心に\n火を届けてくだされ。');
      }
      ev.setObjective('obj_snow_2', REGION);
    },
  };

  // ------------------------------------------------------------ 村長ヨルン
  E.yule_jorn = {
    meta: { needs: ['flag:snow_start'], gives: [], calls: ['yule_jorn_reward'] },
    run: async (ev) => {
      ev.npc('jorn').face('player');
      if (ev.cleared('r_snow')) {
        if (!ev.flag('yule_jorn_reward')) { await ev.call('yule_jorn_reward'); return; }
        if (ev.check({ postgame: true })) {
          await ev.say('今年の冬至は、村じゅうで\n盛大に祝うつもりじゃ。\n{hero}どのも、ぜひ。');
          return;
        }
        if (ev.flag('final_open')) {
          await ev.say('内海の霧が晴れたそうじゃな。\n……かまどの火は、\n今夜も燃えておる。');
          return;
        }
        if (ev.check({ tier: 4 })) {
          await ev.say('記録院のお触れか。\nこの村の物語は、\nわしらの口で守るとも。');
          return;
        }
        await ev.say('吹雪がやんで、村に日が差した。\nみな、{hero}どののおかげじゃ。');
        return;
      }
      if (ev.flag('snow_flame')) {
        await ev.say('その火種があれば、峰の氷も\nとけるはずじゃ。');
        await ev.say('峰の奥は冷える。\n宿で休んでから行きなされ。');
        return;
      }
      await ev.say('集会所のかまどを見てくだされ。\nかまどの石に、昔の物語が\n刻まれておるはずじゃ。');
    },
  };

  // ------------------------------------------------------------ 地方の報酬（§8.8、once）
  E.yule_jorn_reward = {
    meta: { needs: ['region:r_snow'], gives: ['flag:yule_jorn_reward', 'item:ac_tale_snow'] },
    run: async (ev) => {
      if (ev.flag('yule_jorn_reward')) return;
      await ev.say('{hero}どの。村を代表して\n礼を言わせてくだされ。');
      await ev.say('冬至の火は、もう二度と\n消さぬ。竜の物語も、\n子や孫へ語り継ごう。');
      await ev.say('これは、代々の村長が\n守ってきた冬至の火の守りじゃ。\n持っていきなされ。');
      const ok = await ev.give('ac_tale_snow');
      if (!ok) return false;
      ev.setFlag('yule_jorn_reward');
      await ev.say('寒さにも熱にも負けぬよう、\n火の神の加護がついておる。');
    },
  };

  // ------------------------------------------------------------ 白竜ネーヴェの像
  E.yule_statue = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('白竜ネーヴェの像だ。\n「北の峰の白き竜、\n吹雪を鎮め、村を守る」');
      if (ev.cleared('r_snow')) await ev.say('像の足もとに、誰かが\n小さな火をともしている。');
      else if (ev.flag('snow_flame')) await ev.say('像の目が、かまどの火を\n映して光ったように見えた。');
    },
  };
})(window.RPG);
