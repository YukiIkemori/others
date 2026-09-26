// R3 (reg3) — 白竜の峰: the dungeon events of r_snow ノルデン雪原 (DESIGN §10.8.0, §10.8.4, §10.9.4).
//   frost_peak_1_ice / frost_peak_2_ice  #4 氷の壁 (examine): 「分厚い氷の壁だ。火があれば、とかせそうだが……。」
//   frost_peak_1_melt   entering 1F with 冬至の火種: the fire flares, the ice walls give way (flavour, once)
//   frost_peak_2_wall   the giant's ice wall on 2F (examine, until snow_mid)
//   frost_peak_2_boss   #5 中ボス 氷壁の巨人 (tr_b_icegiant) → snow_mid (his wall breaks)
//   frost_peak_3_fine   #6 the step before the col: フィーネ (story_fine_snow; once: snow_fine)
//   frost_peak_3_boss   #6–7 ボス 白竜ネーヴェ (tr_b_whitedragon) → snow_boss → the story told anew →
//                       ev.clearRegion('r_snow') → a night at yule's inn → story_after_clear (§10.8.0-3)
//   frost_peak_3_neve   the white dragon at rest on her crag after the clear
(function (R) {
  'use strict';
  const E = R.DB.events;
  const NONE = { needs: [], gives: [] };
  const has = (id) => !!(R.DB.events && R.DB.events[id]);

  // ------------------------------------------------------------ 氷の壁
  async function iceWall(ev) {
    await ev.say('分厚い氷の壁だ。\n火があれば、とかせそうだが……。');
    if (!ev.flag('snow_flame') && ev.flag('snow_start')) await ev.say('ユールの村の、古いかまどの\n話を思い出した……。');
  }
  E.frost_peak_1_ice = { meta: NONE, run: iceWall };
  E.frost_peak_2_ice = { meta: NONE, run: iceWall };
  E.frost_peak_1_melt = {
    meta: { needs: ['item:k_winter_flame'], gives: ['flag:frost_peak_1_melt'] },
    run: async (ev) => {
      if (ev.flag('frost_peak_1_melt')) return;
      ev.sfx('fire');
      await ev.flash('#ffb060', 8);
      await ev.say('冬至の火種が、赤く輝いた。');
      await ev.say('洞窟の奥で、氷のとける音がする……。');
    },
  };
  E.frost_peak_2_wall = {
    meta: NONE,
    run: async (ev) => {
      await ev.say('青く光る、分厚い氷の壁だ。\n冬至の火を近づけても、\nびくともしない。');
      await ev.say('氷の中から、巨人の\nうなり声が響いてくる……。');
    },
  };

  // ------------------------------------------------------------ #5 中ボス 氷壁の巨人
  E.frost_peak_2_boss = {
    meta: { needs: ['item:k_winter_flame'], gives: ['flag:snow_mid'] },
    run: async (ev) => {
      if (ev.flag('snow_mid')) return;
      const b = ev.npc('boss');
      await ev.say('氷の巨人が、峰へ続く道を\nふさいでいる……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      await ev.say('……ここより上へは、\n誰も通さぬ……。');
      const r = await ev.battle('tr_b_icegiant');
      if (r !== 'win') return false;
      ev.setFlag('snow_mid');
      b.hide();
      ev.sfx('ice');
      await ev.shake(24, 3);
      ev.refresh();
      await ev.say('巨人の体が砕け散り、\n氷の壁が崩れ落ちた！');
      await ev.say('奥に、上へ続く階段が見える。');
    },
  };

  // ------------------------------------------------------------ #6 フィーネ（台本は story_fine_snow。story 担当）
  // The script is story's (§10.9.4). While it is missing, the same scene is told here from the
  // table (the region line, then the tier's closing line and staging) so the game stays whole.
  E.frost_peak_3_fine = {
    meta: { needs: ['item:k_winter_flame'], gives: ['flag:snow_fine'], calls: ['story_fine_snow'] },
    run: async (ev) => {
      if (ev.flag('snow_fine') || ev.flag('snow_boss')) return;
      if (has('story_fine_snow')) { await ev.call('story_fine_snow'); return; }
      const f = ev.npc('fine');
      await ev.wait(12);
      f.face('player');
      await ev.wait(16);
      await ev.say('凍っているのは、竜の体じゃない。\n心のほうよ。');
      const t = ev.tier();
      if (t >= 6) await ev.say('……もう、あまり時間がないの。');
      else if (t >= 3) await ev.say('わたしのことは気にしないで。\n先へ進みなさい。');
      else await ev.say('……気をつけて。');
      ev.closeMessage();
      if (t >= 3) await ev.caption('フィーネの足元が、\n透けて見えた。');
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      f.hide();
    },
  };

  // ------------------------------------------------------------ #6–7 ボス 白竜ネーヴェ → 地方クリア
  E.frost_peak_3_boss = {
    meta: {
      needs: ['item:k_winter_flame', 'flag:snow_mid'],
      gives: ['flag:snow_boss', 'region:r_snow', 'item:k_page_snow'],
      warp: { to: 'yule', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('snow_boss')) return;
      await ev.say('吹雪の向こうに、白い竜の\n姿が浮かび上がった……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(24, 4);
      await ev.say('……去れ……人の子よ……。\nこの峰に、もはや\n語るべき物語はない……！');
      const r = await ev.battle('tr_b_whitedragon');
      if (r !== 'win') return false;
      ev.setFlag('snow_boss');
      // the story told anew: the fire of midwinter held high
      await ev.wait(20);
      await ev.say('白竜は、雪の上に\n静かに身を伏せた。');
      await ev.say('{hero}は冬至の火を掲げ、\n白竜の物語を語った。');
      ev.closeMessage();
      ev.sfx('fire');
      await ev.flash('#ffc070', 12);
      await ev.caption('白き竜は北の峰に住み、\n冬の吹雪を鎮めた。', { frames: 160 });
      await ev.caption('人々は冬至の夜に火をともし、\n竜の物語を峰へ届けた。\n――その約束は、今も続く。', { frames: 210 });
      ev.refresh(); // the calm dragon (neve) takes the fierce one's place
      await ev.flash('#ffffff', 10);
      await ev.say('……あたたかい。人の子らは、\nわたしを忘れてはいなかったのか。');
      await ev.say('吹雪は、わたしが鎮めよう。語り部よ、\n礼を言う。');
      ev.closeMessage();
      await ev.clearRegion('r_snow');
      // §10.8.0-3: a night at the village inn, then the morning scene (story)
      await ev.wait(20);
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('yule', 'inn', { fade: false });
      await ev.fadeIn(30);
      if (has('story_after_clear')) await ev.call('story_after_clear');
    },
  };

  // ------------------------------------------------------------ 白竜ネーヴェ（クリア後）
  E.frost_peak_3_neve = {
    meta: NONE,
    run: async (ev) => {
      if (ev.check({ postgame: true })) {
        await ev.say('語り部よ。ユールの子らの\n語る物語が、この峰まで\n届いておる。');
        await ev.say('わたしは眠らずに、\nその声を聞いていよう。');
        return;
      }
      if (ev.flag('final_open')) {
        await ev.say('南の海で、白い霧が晴れた。\n……古い、恐ろしいものの\n気配がする。');
        await ev.say('行け、語り部よ。\n物語を、守り抜け。');
        return;
      }
      await ev.say('吹雪は鎮めた。\n冬至の火が燃える限り、\nわたしは村を忘れぬ。');
      await ev.say('語り部よ。おまえの年代記に、\nわたしの物語も記しておくがいい。');
    },
  };
})(window.RPG);
