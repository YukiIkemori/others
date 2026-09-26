// Region 7 灰の荒野 (r_ash) — events of 灰の火山 (ash_volcano_1..3, DESIGN §10.8.8). Owner: reg7 (R7).
//   ash_volcano_1_mural   壁画1 (ash_murals +1)
//   ash_volcano_2_boss    中ボス 炎の番犬 tr_b_hellhound, in front of the second mural (ash_mid)
//   ash_volcano_2_mural   壁画2 (ash_murals +1)
//   ash_volcano_3_mural   壁画3 (ash_murals +1); with all three the rock door to the crater opens (tilePatch)
//   ash_volcano_3_door    the closed rock door (examine, while ash_murals < 3)
//   ash_volcano_3_fine    フィーネの場面 (step, once ash_fine) → story_fine_ash (story, §10.9.4)
//   ash_volcano_3_boss    ボス 溶岩の巨獣 tr_b_lavabeast → the story is told → 火の鳥 → ev.clearRegion('r_ash')
//                          → the night at the Caldera inn → story_after_clear (§10.8.0-3)
// The murals can be read in any order (1F is optional on the way up); whichever makes three opens the door.
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_ash';
  const advance = (ev, n) => (R.Reg7 && R.Reg7.advance ? R.Reg7.advance(ev, n) : ev.setObjective(['', 'obj_ash_1', 'obj_ash_2', 'obj_ash_3'][n], { region: REGION }));

  // ------------------------------------------------------------ 壁画 (3つ集める)
  const MURALS = {
    1: '壁画には、灰の中から\n小さな炎が生まれる姿が\n描かれている。',
    2: '炎は鳥の姿になり、\n山の火を静めながら\n大地を温めている。',
    3: '年老いた鳥は灰に還り、\n巫女の語る物語で、\nふたたび卵から生まれる。',
  };
  const LEFT = ['', '火の鳥の物語の、\nはじまりの場面だ。\n続きの壁画も、どこかに\nあるはずだ。', '物語の続きが見えてきた。\n壁画は、あとひとつ……。'];
  function mural(n) {
    return {
      meta: { needs: n === 2 ? ['flag:ash_mid'] : [], gives: ['var:ash_murals+1', 'flag:ash_volcano_' + n + '_mural'] },
      run: async (ev) => {
        const f = 'ash_volcano_' + n + '_mural';
        if (ev.flag(f)) {
          await ev.say('火の鳥の壁画だ。');
          await ev.say(MURALS[n]);
          return;
        }
        await ev.say('壁一面に、古い絵が\n描かれている……。');
        ev.closeMessage();
        ev.sfx('page');
        await ev.flash('#ffb060', 10);
        await ev.say(MURALS[n]);
        ev.setFlag(f);
        const k = Math.min(3, (ev.var('ash_murals') || 0) + 1);
        ev.setVar('ash_murals', k);
        await ev.say('{hero}は、壁画の場面を\n年代記に書き留めた。');
        if (k < 3) {
          await ev.say(LEFT[k]);
          advance(ev, 2);
          return;
        }
        // the third: the story is whole, and the rock door to the crater opens
        await ev.say('灰から生まれ、山を温め、\n灰に還って、また生まれる。\n……これが、火の鳥の物語だ。');
        ev.closeMessage();
        ev.refresh();
        ev.sfx('unlock');
        await ev.shake(24, 2);
        await ev.say(n === 3 ? '岩戸の方から、重い岩の\n動く音が響いた！' : 'どこか上の方で、\n重い岩の動く音がした……。');
        advance(ev, 3);
      },
    };
  }
  E.ash_volcano_1_mural = mural(1);
  E.ash_volcano_2_mural = mural(2);
  E.ash_volcano_3_mural = mural(3);

  E.ash_volcano_3_door = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const k = ev.var('ash_murals') || 0;
      await ev.say('大きな岩戸が、火口への道を\nふさいでいる。');
      await ev.say('表面に、鳥の形のくぼみが\n三つ刻まれている。');
      if (k > 0) await ev.say(k === 1 ? 'くぼみのひとつが、\nほのかに赤く光っている。' : 'くぼみのふたつが、\nほのかに赤く光っている。');
      else await ev.say('壁画の物語を知る者にだけ\n開く、と言われているらしい。');
    },
  };

  // ------------------------------------------------------------ 中ボス 炎の番犬 (§10.8.8 #4)
  E.ash_volcano_2_boss = {
    meta: { needs: [], gives: ['flag:ash_mid'] },
    run: async (ev) => {
      if (ev.flag('ash_mid')) return;
      await ev.say('グルルル……。');
      await ev.say('二つの頭を持つ炎の犬が、\n奥の壁画の前を\nふさいでいる！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(16, 3);
      const r = await ev.battle('tr_b_hellhound', { noEscape: true });
      if (r !== 'win') return false;
      ev.setFlag('ash_mid');
      const b = ev.npc('boss');
      if (b.visible) b.hide();
      await ev.say('炎の番犬は、ひと声ほえて\n溶岩の中へ崩れ落ちた。');
      await ev.say('奥の壁に、古い絵が\n見える。');
    },
  };

  // ------------------------------------------------------------ フィーネの場面 (§10.8.0-5)
  E.ash_volcano_3_fine = {
    meta: { needs: [], gives: ['flag:ash_fine'] },
    run: async (ev) => {
      if (ev.flag('ash_boss')) return;
      if (R.DB.events.story_fine_ash) { await ev.call('story_fine_ash'); return; }
      // Fallback while the story owner's script is missing from a build: §10.9.4 as written. Only one
      // fixed character speaks, so no speaker name or brackets (STYLE_JA §5).
      const f = ev.npc('fine');
      const again = ev.flag('ash_fine');
      if (f.visible) f.face('player');
      await ev.wait(12);
      const t = Math.min(7, ev.tier());
      const close = t >= 6 ? '……もう、あまり時間がないの。' : t >= 3 ? 'わたしのことは気にしないで。\n先へ進みなさい。' : '……気をつけて。';
      if (!again) await ev.say('燃え尽きることと、\n忘れられることは、違うわ。');
      await ev.say(close);
      ev.closeMessage();
      if (t >= 3 && !again) await ev.caption('フィーネの足元が、\n透けて見えた。');
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      if (f.visible) f.hide();
      ev.setFlag('ash_fine');
      await ev.wait(20);
    },
  };

  // ------------------------------------------------------------ ボス 溶岩の巨獣 → 火の鳥 → 章 (§10.8.8 #7–8)
  E.ash_volcano_3_boss = {
    meta: {
      needs: ['var:ash_murals>=3'],
      gives: ['flag:ash_boss', 'region:r_ash', 'item:k_page_ash'],
      warp: { to: 'caldera', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('ash_boss')) return;
      await ev.say('火口の奥に、灰をかぶった\n大きな卵が見える。');
      await ev.say('……その前で、煮えたぎる\n溶岩が盛り上がった！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(24, 3);
      await ev.say('守り手を失った山の火が、\n獣の姿になって\n立ちはだかる！');
      ev.closeMessage();
      const r = await ev.battle('tr_b_lavabeast', { noEscape: true });
      if (r !== 'win') return false;
      ev.setFlag('ash_boss');
      const boss = ev.npc('boss');
      if (boss.visible) boss.hide();
      await ev.say('溶岩の巨獣は、黒い岩になって\n崩れ落ちた。');
      await ev.say('火口が、しんと静まり返る。\n卵は、冷たい灰に\n包まれたままだ……。');
      ev.closeMessage();
      await ev.wait(20);
      // the story is told before the egg (the three murals, §10.8.8 #8)
      await ev.say('{hero}は卵の前で、\n壁画の物語を語った。');
      ev.closeMessage();
      await ev.caption('灰の中から、\n小さな炎が生まれた。', { frames: 170 });
      await ev.caption('炎は鳥の姿になり、\n山の火を静めながら\n大地を温めた。', { frames: 190 });
      await ev.caption('年老いた鳥は灰に還り、\n巫女の語る物語で、\nふたたび卵から生まれる。', { frames: 210 });
      // the egg hatches (light), and the firebird rises
      ev.sfx('light');
      await ev.flash('#ffd080', 12);
      await ev.shake(16, 2);
      await ev.flash('#ffffff', 18);
      ev.refresh(); // egg → hatched shell, the firebird appears
      const bird = ev.npc('firebird');
      if (bird.visible) bird.setPos(21, 3);
      ev.sfx('magic');
      await ev.flash('#ffb040', 10);
      await ev.say('火の鳥が、よみがえった！');
      ev.closeMessage();
      if (bird.visible) {
        for (let y = 2; y >= -1; y--) { bird.setPos(21, y); await ev.wait(8); }
        bird.hide();
      }
      await ev.say('火の鳥は、火口の空へ\n高く舞い上がっていった。');
      await ev.say('降り続いていた灰が、\nやんでいく……。');
      ev.closeMessage();
      await ev.clearRegion(REGION);
      // the night at the inn (§10.8.0-3), then the story owner's morning scene (§10.9.2)
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('caldera', 'inn', { fade: false });
      if (R.DB.events.story_after_clear) await ev.call('story_after_clear');
      // story_after_clear plays nothing when this tier's scene has already run: never leave the screen dark
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(30);
      ev.bgm();
    },
  };
})(window.RPG);
