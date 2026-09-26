// Region 8 r_star オルビス高原 (R8 reg8): objectives and every event of the region
// (DESIGN §10.8.0, §10.8.9, §10.9.2–§10.9.4, §10.13.7–§10.13.9).
//
//   orbis_intro            #1 onEnter of orbis (and the astronomer at the gate): Luca tells of the
//                          vanishing stars → star_start, obj_star_1
//   orbis_octavia          #2 the head of the academy; after the clear hands over orbis_octavia_reward
//   orbis_octavia_reward   the one-off reward (ac_tale_star 星読みの片眼鏡, §8 reward table)
//   orbis_library_chart    #3 the 書見台 at the back of the library → k_star_chart, star_chart, obj_star_2
//   orbis_telescope        the observatory telescope (after the clear: the island in the inner sea)
//   stargaze_3_door        #6 the star-chart door (examine while it is closed)
//   stargaze_3_boss        #5 天球の番人 tr_b_orrery → star_mid
//   stargaze_4_fine        #7 Fine before the roof (story_fine_star) → star_fine
//   stargaze_4_boss        #7–#8 星食らい tr_b_stareater → star_boss, the stars come back,
//                          ev.clearRegion('r_star'), the night at the inn, story_after_clear
//   stargaze_4_telescope   the great telescope on the roof
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_star';

  Object.assign(R.DB.objectives, {
    obj_star_1: { text: 'オルビスの図書館の奥の書見台で、\n星の名を記した星図を探そう。' },
    obj_star_2: { text: '星図を持って、\n星読みの塔の頂を目指そう。' },
  });

  /** first matching {cond, text} entry's text (§3.2.4 form) */
  function pick(ev, list) {
    for (const e of list) if (e && ev.check(e.cond)) return e.text;
    return null;
  }
  const has = (id) => !!(R.DB.events && R.DB.events[id]);

  // ------------------------------------------------------------ #1 着いたとき（天文学者ルカ）
  E.orbis_intro = {
    meta: { needs: [], gives: ['flag:star_start'] },
    run: async (ev) => {
      if (ev.flag('star_start')) return;
      const luca = ev.npc('luca_gate');
      if (ev.ctx.trigger === 'enter') await ev.wait(20);
      if (luca.visible) luca.face('player');
      await ev.say('やあ、旅の人。\nぼくはルカ。この町の\n天文台で、星を数えている。');
      await ev.say('星が、毎晩ひとつずつ消えていくんだ。');
      await ev.say('星の名前を、\n誰も思い出せなくなってから……。');
      await ev.say('学長のオクタヴィアさまが、\n何か知っているかもしれない。\n学院は、町の北にあるよ。');
      ev.closeMessage();
      ev.setFlag('star_start');
      ev.setObjective('obj_star_1', { region: REGION });
      if (luca.visible) {
        await luca.walk('U7R15U2', 6);
        luca.hide();
      }
    },
  };

  // ------------------------------------------------------------ #2 学長オクタヴィア
  E.orbis_octavia = {
    meta: { needs: [], gives: [], calls: ['orbis_octavia_reward'] },
    run: async (ev) => {
      if (ev.cleared(REGION) || ev.flag('star_boss')) {
        if (!ev.flag('orbis_octavia_reward')) { await ev.call('orbis_octavia_reward'); return; }
        await ev.say(pick(ev, [
          { cond: { postgame: true }, text: '学院では、星の名を\n歌にして教えることに\nしました。忘れないように。' },
          { cond: 'final_open', text: '霧の晴れた島の白い塔は、\n記録院の本院だそうですね。\nどうか、お気をつけて。' },
          { cond: { tier: 4 }, text: '記録院から、学院の本を\n納めよとのお触れが\n届きました。……お断りです。' },
          { text: '星の名簿は、学院で\n写しを何冊も作りました。\n二度と、失わないように。' },
        ]));
        return;
      }
      if (ev.flag('star_chart')) {
        await ev.say('その星図を持って、\n星読みの塔の頂へ。\n観測台の扉が、開くはずです。');
        await ev.say('星の名を読み上げれば、\nきっと、星は空に戻ります。');
        return;
      }
      await ev.say('学院へようこそ。\nわたしは学長のオクタヴィアです。');
      await ev.say('記録院が、星の名簿を\n『保管のため』と\n持っていってしまいました。');
      await ev.say('写しが一枚だけ、\n図書館の奥に残っているかもしれません。');
      if (!ev.flag('star_start')) {
        ev.setFlag('star_start');
        ev.setObjective('obj_star_1', { region: REGION });
      }
    },
  };

  // ------------------------------------------------------------ 学長の報酬（一品物）
  E.orbis_octavia_reward = {
    meta: { needs: ['flag:star_boss'], gives: ['item:ac_tale_star', 'flag:orbis_octavia_reward'] },
    run: async (ev) => {
      if (ev.flag('orbis_octavia_reward')) return;
      await ev.say('{hero}さん。星を取り戻して\nくれて、本当にありがとう。');
      await ev.say('これは、賢者カペラが\n使っていたという片眼鏡です。\nどうか、お持ちください。');
      const got = await ev.give('ac_tale_star', 1);
      if (got === false) return false;
      ev.setFlag('orbis_octavia_reward');
      await ev.say('めずらしいものを見つける目を\n授けてくれる、と伝わっています。\nあなたの旅に、星の導きを。');
    },
  };

  // ------------------------------------------------------------ #3 図書館の書見台（星図）
  E.orbis_library_chart = {
    meta: { needs: ['flag:star_start'], gives: ['item:k_star_chart', 'flag:star_chart'] },
    run: async (ev) => {
      if (ev.flag('star_chart')) {
        await ev.say('星図が広げてあった\n古い書見台だ。');
        return;
      }
      if (!ev.flag('star_start')) {
        await ev.say('古い書見台だ。\n色あせた紙が、\n広げたままになっている。');
        return;
      }
      ev.sfx('page');
      await ev.say('古い星図を見つけた。\n星の名が、びっしりと\n書き込まれている。');
      ev.closeMessage();
      await ev.give('k_star_chart', 1);
      ev.setFlag('star_chart');
      ev.setObjective('obj_star_2', { region: REGION });
      const c = ev.npc('chart');
      if (c.visible) c.hide();
      await ev.say('星図のすみに、小さな字で\n「星読みの塔、観測台の扉に\n掲げよ」と書いてある。');
    },
  };

  // ------------------------------------------------------------ 天文台の望遠鏡
  E.orbis_telescope = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.cleared(REGION)) {
        if (ev.flag('final_open')) await ev.say('霧の晴れた島に、白い塔が\nそびえている。');
        else await ev.say('望遠鏡の向こう、内海の\n真ん中に、白い霧に包まれた\n島が見える……。');
        return;
      }
      await ev.say('大きな望遠鏡だ。\nレンズの向こうの空に、\n星はほとんど見えない……。');
    },
  };

  // ------------------------------------------------------------ #6 観測台への扉（星図の扉）
  E.stargaze_3_door = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('扉に星座の形のくぼみがある。\n星図があれば……。');
    },
  };

  // ------------------------------------------------------------ #5 中ボス 天球の番人
  E.stargaze_3_boss = {
    meta: { needs: [], gives: ['flag:star_mid'] },
    run: async (ev) => {
      if (ev.flag('star_mid')) return;
      await ev.say('通路をふさぐように、\n巨大な天球儀のからくりが\nそびえている。');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(16, 2);
      await ev.say('……タチイリ、キンシ。\nホシノナヲ、モタヌモノハ、\nトオサナイ……。', { voice: 'v_sentinel_star_01' });
      const r = await ev.battle('tr_b_orrery');
      if (r !== 'win') return false;
      ev.setFlag('star_mid');
      const b = ev.npc('boss');
      if (b.visible) b.hide();
      await ev.say('天球の番人は、歯車の音を\n立てて、動かなくなった。');
      await ev.say('奥に、星座の形のくぼみのある\n扉が見える。');
    },
  };

  // ------------------------------------------------------------ #7 フィーネ（ボスの部屋の手前）
  const FINE_LINE = '名前を呼ばれない星は、\n夜空にいても見えないの。';
  E.stargaze_4_fine = {
    meta: { needs: [], gives: ['flag:star_fine'], calls: ['story_fine_star'] },
    run: async (ev) => {
      if (ev.flag('star_boss')) return;
      if (has('story_fine_star')) {
        // the step band (once star_fine) and talking to her afterwards both go to story's script;
        // it plays the short version when star_fine is already set (§10.9.4)
        await ev.call('story_fine_star');
      } else {
        if (ev.flag('star_fine')) return;
        // the region's line and the tier ending of §10.9.4 (used until story's script is in)
        const f = ev.npc('fine');
        f.face('player');
        const t = ev.tier();
        const who = ev.flag('st_t3') ? 'フィーネ' : '少女';
        await ev.say(who + '「' + FINE_LINE + '」');
        if (t <= 2) await ev.say(who + '「……気をつけて。」');
        else if (t <= 5) await ev.say(who + '「わたしのことは気にしないで。\n先へ進みなさい。」');
        else await ev.say(who + '「……もう、あまり時間がないの。」');
        ev.closeMessage();
        if (t >= 3) await ev.caption('フィーネの足元が、\n透けて見えた。');
        ev.sfx('magic');
        await ev.flash('#e8ecff', 10);
        f.hide();
      }
      ev.setFlag('star_fine');
    },
  };

  // ------------------------------------------------------------ #7–#8 ボス 星食らい → 地方クリア
  const SKY = ['star_1', 'star_2', 'star_3', 'star_4', 'star_5', 'star_6', 'star_7', 'star_8', 'star_9', 'star_10'];
  E.stargaze_4_boss = {
    meta: {
      needs: ['item:k_star_chart'],
      gives: ['flag:star_boss', 'region:r_star', 'item:k_page_star'],
      warp: { to: 'orbis', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('star_boss')) return;
      await ev.say('観測台の真ん中で、\n黒い影が、夜空を\n飲みこんでいる……！');
      await ev.say('影の腹の中で、名を失った\n星たちが、かすかに\n光っている。');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(24, 3);
      const r = await ev.battle('tr_b_stareater');
      if (r !== 'win') return false;
      // the stars spill out of the star eater
      ev.npc('boss').hide();
      ev.sfx('magic');
      await ev.flash('#ffffff', 12);
      await ev.say('星食らいの体から、\n光の粒がこぼれ出した。');
      await ev.say('{hero}は星図を広げ、\n星の名を一つずつ\n読み上げた。');
      ev.closeMessage();
      ev.setFlag('star_boss');
      // one star after another comes back over the roof
      for (const id of SKY) {
        const s = ev.npc(id);
        s.show();
        ev.sfx('page');
        await ev.wait(10);
      }
      ev.sfx('light');
      await ev.flash('#fffbe0', 16);
      await ev.caption('夜空に、星が戻っていく……。', { frames: 200 });
      await ev.clearRegion(REGION);
      // the night at the inn (§10.8.0-3)
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('orbis', 'inn', { fade: false });
      if (has('story_after_clear')) await morning(ev);
      else await ev.caption('翌朝――');
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(30);
      ev.bgm();
    },
  };

  /** story_after_clear on the dark screen: its 「翌朝――」 caption shows on black, then the screen
   *  comes back before the tier scene plays (the scene itself never fades in). A watcher fades in as
   *  soon as the screen is dark with no caption stage on it; it does nothing when story fades in itself. */
  async function morning(ev) {
    const Eng = R.Engine;
    let done = false;
    const call = ev.call('story_after_clear').finally(() => { done = true; });
    const watch = (async () => {
      await ev.wait(2);
      while (!done) {
        const staged = (Eng.layers || []).some((l) => l && l.isStage);
        if (!staged && Eng.fadeAlpha > 0 && !Eng._fade) { await ev.fadeIn(30); return; }
        await ev.wait(1);
      }
    })();
    await call;
    await watch;
  }

  // ------------------------------------------------------------ 観測台の大望遠鏡
  E.stargaze_4_telescope = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.flag('star_boss')) {
        await ev.say('大きな望遠鏡だ。\n名を取り戻した星たちが、\nレンズいっぱいに光っている。');
        return;
      }
      await ev.say('大きな望遠鏡だ。\n星の名を刻んだ輪が、\nいくつも重なっている。');
    },
  };
})(window.RPG);
