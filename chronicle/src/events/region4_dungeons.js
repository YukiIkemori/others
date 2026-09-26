// Region 4 グレイモア湿原 (r_marsh) — the events of 霧の館 and 鐘沈みの沼 (DESIGN §10.8.5 #3–#7).
// Owner: reg-4 (R4).
//
//   mist_manor_1_fog        the fog over the passage foyer → stair hall (examine; gone after the clear)
//   mist_manor_2_fog        the fog door of Melda's room (examine; gone with marsh_mid)
//   mist_manor_2_boss       #3 中ボス 人形の楽団 tr_b_dolls → marsh_mid (the fog door lifts)
//   mist_manor_2_melda      #4 魔女メルダの幽霊 → 鐘の鍵 k_marsh_key, the bell song → marsh_key, obj_marsh_2
//   bell_marsh_1_bell_a/b/c #5 the three chains: without the key 「鍵がかかっていて、引けない」, with it the
//                           bell rings (marsh_bells +1); the third opens the fog gate → obj_marsh_3
//   bell_marsh_1_fog        the fog gate (examine, until the three bells have rung)
//   bell_marsh_1_fine       #6 the girl in grey before the heart of the bog (once marsh_fine) → story_fine_marsh
//   bell_marsh_1_boss       #6–#7 霧食らい tr_b_mistbeast → marsh_boss → the fog lifts, the children,
//                           Melda → ev.clearRegion('r_marsh') → the inn in Loch → story_after_clear
(function (R) {
  'use strict';
  const E = R.DB.events;
  const K = R.Reg4 = R.Reg4 || {};
  const DOLLS = ['boss', 'doll_violin', 'doll_drum', 'doll_flute'];
  const KAZU = ['', '一', '二', '三'];

  // ------------------------------------------------------------ closed passages (§10.8.0-6)
  E.mist_manor_1_fog = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('濃い霧が、通路をふさいでいる。\n押しても、押し返されてしまう……。');
    },
  };
  E.mist_manor_2_fog = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('扉の前で、濃い霧が渦を巻いている。\n奥から、人の気配がする……。');
    },
  };
  E.bell_marsh_1_fog = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('濃い霧が、壁のように立ちこめている。\n先へは進めない……。');
      const n = ev.var('marsh_bells') || 0;
      if (ev.has('k_marsh_key')) await ev.say(n ? '霧が、鐘の音をいやがる\nように震えている。\n残る鐘は、あと' + KAZU[3 - n] + 'つ……。' : '鐘の音があれば、\nこの霧を払えるかもしれない。');
    },
  };

  // ------------------------------------------------------------ #3 人形の楽団
  E.mist_manor_2_boss = {
    meta: { needs: [], gives: ['flag:marsh_mid'] },
    run: async (ev) => {
      if (ev.flag('marsh_mid')) return;
      await ev.say('舞台の上で、人形たちが\nいっせいに顔を上げた。');
      ev.closeMessage();
      ev.sfx('magic');
      await ev.shake(12, 2);
      await ev.say('カタ、カタ、カタ……。\n糸もないのに、人形たちが\n楽器を構える！');
      const r = await ev.battle('tr_b_dolls');
      if (r !== 'win') return false;
      for (const id of DOLLS) ev.npc(id).hide();
      ev.setFlag('marsh_mid');
      await ev.say('人形たちは、糸が切れた\nように崩れ落ちた。');
      ev.closeMessage();
      await ev.wait(20);
      ev.sfx('unlock');
      await ev.flash('#e8ecff', 10);
      ev.refresh();
      await ev.say('舞台の奥の扉にかかっていた\n霧が、すうっと晴れていく……。');
    },
  };

  // ------------------------------------------------------------ #4 魔女メルダの幽霊
  E.mist_manor_2_melda = {
    meta: { needs: ['flag:marsh_mid'], gives: ['item:k_marsh_key', 'flag:marsh_key'] },
    run: async (ev) => {
      if (ev.cleared('r_marsh')) {
        await ev.say(K.pick ? K.pick(ev, [
          { cond: { postgame: true }, text: 'ときどき、子どもたちが\n遊びに来てくれるのよ。\nこの館も、にぎやかになったわ。' },
          { text: '町の人たちが、花を持って\n謝りに来てくれたの。\nわたし、うれしくて……。' },
        ]) : '町の人たちが、花を持って\n謝りに来てくれたの。');
        return;
      }
      if (ev.flag('marsh_key')) {
        await ev.say('三つの鐘の鎖に、鍵を\n差して、歌いながら引くの。\n……子どもたちを、お願い。');
        return;
      }
      await ev.say('……驚かせてしまったわね。\nわたしはメルダ。\nこの館の、昔の主よ。', { voice: 'v_melda_manor_01' });
      await ev.say('わたしは子どもたちをさらってなどいない。\n霧が、わたしの姿をまねているの。', { voice: 'v_melda_manor_02' });
      await ev.say('昔、沼の霧から魔物が\nあふれたとき、わたしは\n七つの鐘を沈めて、\n鐘の音で霧を封じたの。', { voice: 'v_melda_manor_03' });
      await ev.say('でも、町の人たちが\n鐘の歌を忘れて、\n鐘は鳴らなくなった……。', { voice: 'v_melda_manor_04' });
      await ev.say('沼の鐘を鳴らして。これは鐘の鍵。そして、\nこれが鐘の歌よ。', { voice: 'v_melda_manor_05' });
      ev.closeMessage();
      await ev.give('k_marsh_key', 1);
      ev.sfx('bell');
      await ev.caption(K.BELL_SONG || '♪　鳴れよ、七つの鐘', { frames: 210 });
      await ev.say('{hero}は、鐘の歌を\n覚えた。');
      ev.setFlag('marsh_key');
      ev.setObjective('obj_marsh_2', { region: 'r_marsh' });
      await ev.say('鐘の鎖は、沼のあちこちに\n残っているはずよ。\n……気をつけてね。');
    },
  };

  // ------------------------------------------------------------ #5 三つの鐘
  const bellEvent = (k) => ({
    meta: { needs: ['item:k_marsh_key'], gives: ['var:marsh_bells+1', 'flag:bell_marsh_1_bell_' + k] },
    run: async (ev) => {
      const id = 'bell_marsh_1_bell_' + k;
      if (ev.flag(id)) {
        await ev.say('鐘の鎖だ。錠が外れて、\n水の中の鐘が\nかすかに光っている。');
        return;
      }
      if (!ev.has('k_marsh_key')) {
        await ev.say('沼から鎖が伸びている。\n鍵がかかっていて、引けない。');
        return false;
      }
      ev.sfx('unlock');
      await ev.say('{hero}は鐘の歌を口ずさみ、\n鎖を引いた。');
      ev.closeMessage();
      await ev.wait(16);
      ev.sfx('bell');
      await ev.shake(18, 2);
      ev.setFlag(id);
      const n = Math.min(3, (ev.var('marsh_bells') || 0) + 1);
      ev.setVar('marsh_bells', n);
      ev.refresh();
      await ev.say('……ゴーン……。');
      if (n >= 3) {
        ev.closeMessage();
        ev.sfx('unlock'); // the fog gate lifts (§11.13: ev.sfx('unlock') + ev.flash)
        await ev.flash('#e8ecff', 12);
        ev.sfx('bell');
        await ev.say('三つの鐘が鳴りわたると、\n霧が一か所に集まっていく……！');
        ev.setObjective('obj_marsh_3', { region: 'r_marsh' });
      } else {
        await ev.say('鐘の音が、沼の霧を\nかすかに震わせた。\n残る鐘は、あと' + KAZU[3 - n] + 'つ……。');
      }
    },
  });
  E.bell_marsh_1_bell_a = bellEvent('a');
  E.bell_marsh_1_bell_b = bellEvent('b');
  E.bell_marsh_1_bell_c = bellEvent('c');

  // ------------------------------------------------------------ #6 フィーネ (§10.8.0-5, story_fine_marsh)
  // The step band (once marsh_fine) and a talk to the NPC `fine` (cond '!marsh_boss', §10.8.0-5) both
  // come here. The scene is the story's story_fine_marsh (it says the shorter "again" line when
  // marsh_fine is already up); until it exists, the region's own line and the tier's ending (§10.9.4)
  // are said here — one speaker, so no name and no brackets (STYLE_JA §5).
  E.bell_marsh_1_fine = {
    meta: { needs: [], gives: ['flag:marsh_fine'], calls: ['story_fine_marsh'] },
    run: async (ev) => {
      if (ev.flag('marsh_boss')) return;
      if (R.DB.events.story_fine_marsh) {
        await ev.call('story_fine_marsh');
        ev.setFlag('marsh_fine');
        return;
      }
      const again = ev.flag('marsh_fine');
      const f = ev.npc('fine');
      await ev.wait(12);
      f.face('player');
      await ev.wait(16);
      const t = ev.tier();
      if (!again) await ev.say('霧は形を持たないから、\n誰の姿にでもなれるの。', { voice: 'v_fine_marsh_01' });
      if (t >= 6) await ev.say('……もう、あまり時間がないの。');
      else if (t >= 3) await ev.say('わたしのことは気にしないで。\n先へ進みなさい。');
      else await ev.say('……気をつけて。');
      ev.closeMessage();
      if (t >= 3 && !again) await ev.caption('フィーネの足元が、\n透けて見えた。');
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      f.hide();
      ev.setFlag('marsh_fine');
      await ev.wait(20);
    },
  };

  // ------------------------------------------------------------ #6–#7 霧食らい → 伝承の語り直し
  const CHILDREN = ['child_nico', 'child_lina', 'child_bram'];
  E.bell_marsh_1_boss = {
    meta: {
      needs: ['var:marsh_bells>=3'],
      gives: ['flag:marsh_boss', 'region:r_marsh'],
      warp: { to: 'loch', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('marsh_boss')) return;
      await ev.say('集まった霧が渦を巻き、\n人の形をとった。');
      await ev.say('頭巾をかぶった、魔女の\n姿……。だが、その目は\n白く、うつろに光っている。');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      await ev.say('……オイデ……コドモタチ……\nワスレラレタ……\nカネノ……ウタ……。', { voice: 'v_mistwitch_marsh_01' });
      const r = await ev.battle('tr_b_mistbeast');
      if (r !== 'win') return false;
      ev.setFlag('marsh_boss');
      ev.npc('boss').hide();
      ev.sfx('bell');
      await ev.flash('#ffffff', 16);
      await ev.say('霧食らいは、鐘の音に\nかき消されるように\n散っていった。');
      ev.closeMessage();
      // the fog lifts: the children, asleep by the water, and Melda
      await ev.fadeOut(24);
      for (const id of CHILDREN) ev.npc(id).show();
      await ev.fadeIn(32);
      await ev.say('霧が晴れると、沼のほとりで\n子どもたちが眠っていた。\nみんな、無事だ。');
      ev.closeMessage();
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      const m = ev.npc('melda');
      m.show();
      m.face('player');
      await ev.wait(20);
      await ev.say('ありがとう、語り部さん。これでまた、\n町の朝に鐘が鳴るわ。', { voice: 'v_melda_marsh_01' });
      ev.closeMessage();
      // the lore is told again (§10.8.0-3 伝承の語り直し)
      await ev.caption(K.BELL_SONG || '♪　鳴れよ、七つの鐘', { frames: 210 });
      await ev.say('{hero}は、魔女と七つの鐘の\n物語を、子どもたちに\n語って聞かせた。');
      ev.closeMessage();
      await ev.clearRegion('r_marsh');
      // the night at the inn of Loch (§10.8.0-3)
      await ev.fadeOut(40);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('loch', 'inn', { fade: false });
      // story_after_clear shows 「翌朝――」 on the black and lights the town itself (D6); the fade-in
      // below only covers the case where it has no scene to play
      if (R.DB.events.story_after_clear) await ev.call('story_after_clear');
      if (R.Engine && R.Engine.fadeAlpha > 0) await ev.fadeIn(30);
      ev.bgm();
    },
  };
})(window.RPG);
