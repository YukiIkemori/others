// 忘却の底 (oblivion_1..5): the post-game dungeon's events (DESIGN §10.12, §10.13.9). Owner: OB.
//   oblivion_<n>_arrival   onEnter of each floor: the floor's name as a caption and a few lines,
//                          the first time only (flag = the event id)
//   oblivion_3_echo        魔王の残影 (tr_b_valzard_echo) before the broken throne → pg_echo; the black
//                          seal east of the throne room gives way (tilePatch) → the down stairs.
//                          After pg_echo the shade can be fought again (「もう一度挑みますか？」)
//   oblivion_3_seal        examining the black seal before pg_echo
//   oblivion_4_loop        the wrong exit of a room in the endless corridor: back to the first room
//   oblivion_5_ouroboros   Fine's voice → 円環竜オウロボラ (tr_b_ouroboros, BGM superboss) →
//                          「円環が、ほどけた……。」→ 外伝『円環の竜』→ R.Game.title = '大語り部',
//                          pg_ouroboros, pg_clear, objective obj_s_pg_clear. After pg_clear: rematch
// Boss fights cannot be fled and a loss is a wipe (§10.6.2-6); a lost or escaped fight returns false,
// so nothing is recorded and the step band starts it again.
(function (R) {
  'use strict';
  const E = R.DB.events;
  const K = R.Oblivion || {};
  const BOSS = { noEscape: true };
  // the floors are white paper: the default caption dim (0.6) leaves white text on light grey, so darken more
  const CAP_DIM = 0.78;

  // ------------------------------------------------------------ arrivals (first visit of each floor)
  function arrival(id, title, pages) {
    E[id] = {
      meta: { needs: [], gives: ['flag:' + id] },
      run: async (ev) => {
        if (ev.flag(id)) return;
        ev.setFlag(id); // a floor's caption is shown once, even if the party leaves at once
        await ev.wait(16);
        await ev.caption(title, { frames: 170, dim: CAP_DIM });
        for (const p of pages) await ev.say(p);
      },
    };
  }
  arrival('oblivion_1_arrival', '忘却の底\n――忘れられた者の岸――', [
    '足もとに、白い紙のような\n砂が広がっている。',
    '黒い波が、音もなく\n寄せては返す……。',
    'ここは、誰にも語られなく\nなった物語が、流れ着く\n場所なのかもしれない。',
  ]);
  arrival('oblivion_2_arrival', '――継ぎはぎの森――', [
    '森、砂、雪……。\nどこかで見たような景色が、\n縫い合わされて続いている。',
  ]);
  arrival('oblivion_3_arrival', '――恐れの間――', [
    'ひやりとした気配が、\n奥から流れてくる……。',
  ]);
  arrival('oblivion_4_arrival', '――終わらない回廊――', [
    'どこまでも、同じ景色が\n続いているような気がする……。',
  ]);
  arrival('oblivion_5_arrival', '――円環の間――', [
    '床いっぱいに、白いページが\n渦を巻いている……。',
    '奥から、大きな何かの\n寝息が聞こえてくる。',
  ]);

  /** 「もう一度挑みますか？」→ the same boss fight again (for its rare and super-rare drops) */
  async function rematch(ev, troop, intro, gone) {
    await ev.say(intro);
    if (!(await ev.yesno('もう一度挑みますか？'))) return;
    ev.closeMessage();
    ev.sfx('roar');
    await ev.shake(16, 3);
    const r = await ev.battle(troop, BOSS);
    if (r !== 'win') return false;
    ev.npc('boss').hide();
    ev.sfx('light');
    await ev.flash('#ffffff', 12);
    await ev.say(gone);
  }

  // ------------------------------------------------------------ 3階 魔王の残影
  E.oblivion_3_echo = {
    meta: { needs: [], gives: ['flag:pg_echo'] },
    run: async (ev) => {
      if (ev.flag('pg_echo')) {
        return rematch(ev, 'tr_b_valzard_echo', '恐れの気配が、まだ\nこの玉座に残っている……。',
          '魔王の残影は、ふたたび\n霧のように消えていった。');
      }
      const b = ev.npc('boss');
      ev.closeMessage();
      await ev.wait(20);
      await ev.say('崩れた玉座の前に、\n青白い影が立っている……。');
      ev.closeMessage();
      ev.sfx('dark');
      await ev.flash('#201828', 10);
      await ev.wait(20);
      await ev.say('……ヴァルザード……\nそれが、われの名であったか。', { voice: 'v_valzard_oblivion_01' });
      await ev.say('三百年……忘れられてなお、\n恐れだけが残った……。', { voice: 'v_valzard_oblivion_02' });
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(24, 3);
      const r = await ev.battle('tr_b_valzard_echo', BOSS);
      if (r !== 'win') return false;
      await ev.wait(20);
      await ev.say('光の……紋章……。', { voice: 'v_valzard_oblivion_03' });
      ev.closeMessage();
      ev.sfx('light');
      await ev.flash('#ffffff', 16);
      b.hide();
      await ev.wait(30);
      await ev.say('魔王の残影は、\n霧のように消えていった。');
      ev.setFlag('pg_echo');
      ev.refresh();
      ev.sfx('unlock');
      await ev.shake(12, 2);
      await ev.say('玉座の間の東で、\n黒い封印がほどけていく……。');
    },
  };
  E.oblivion_3_seal = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.flag('pg_echo')) return;
      await ev.say('黒い封印が、道をふさいでいる。');
      await ev.say('玉座のほうから流れてくる\n恐れの気配が、封印を\n支えているようだ。');
    },
  };

  // ------------------------------------------------------------ 4階 終わらない回廊
  const LOOP_VAR = 'oblivion_4_loops';
  E.oblivion_4_loop = {
    meta: { needs: [], gives: [], warp: { to: 'oblivion_4', spawn: 'loop' } },
    run: async (ev) => {
      const n = (ev.var(LOOP_VAR) || 0) + 1;
      ev.setVar(LOOP_VAR, n);
      ev.sfx('warp');
      await ev.fadeOut(24);
      await ev.warp('oblivion_4', 'loop', { dir: 'right', fade: false });
      await ev.fadeIn(24);
      await ev.say('……気がつくと、さっきと\n同じ回廊に立っていた。');
      if (n >= 3 && n % 3 === 0) {
        await ev.say('ふと見ると、床に落ちた\n白い紙が、風もないのに\nどこかへ舞っていく……。');
        await ev.say('灯のともった出口の前で、\n紙は静かに止まった。');
      }
    },
  };

  // ------------------------------------------------------------ 5階 円環竜オウロボラ
  const TITLE = '大語り部';
  E.oblivion_5_ouroboros = {
    meta: { needs: [], gives: ['flag:pg_ouroboros', 'flag:pg_clear'] },
    run: async (ev) => {
      if (ev.flag('pg_clear')) {
        return rematch(ev, 'tr_b_ouroboros', '円環竜は、ふたたび\n自分の尾をくわえて\n眠っている……。',
          '円環竜の輪が、\nふたたびほどけていった。');
      }
      if (ev.flag('pg_ouroboros')) return finish(ev); // won before but the ending was cut short
      const b = ev.npc('boss');
      ev.closeMessage();
      await ev.wait(20);
      await ev.say('巨大な竜が、自分の尾を\nくわえて、輪になって\n眠っている……。');
      ev.closeMessage();
      await ev.wait(24);
      ev.sfx('magic');
      await ev.flash('#e8ecff', 8);
      await ev.say('どこからか、なつかしい\n声が聞こえてくる。');
      await ev.say('ここは、終わらない物語が\n沈む場所。', { voice: 'v_fine_oblivion_01' });
      await ev.say('その竜は物語の終わりを食べて、\n同じ話を永遠にくり返させるの。', { voice: 'v_fine_oblivion_02' });
      await ev.say('……{hero}。\nあなたの物語は、あなたの\n手で終わらせて。');
      ev.closeMessage();
      await ev.wait(30);
      b.face('down');
      ev.sfx('roar');
      await ev.shake(30, 4);
      await ev.say('円環竜が、目を開けた！');
      const r = await ev.battle('tr_b_ouroboros', BOSS);
      if (r !== 'win') return false;
      ev.setFlag('pg_ouroboros');
      return finish(ev);
    },
  };
  /** after the win: the ring comes undone, 外伝『円環の竜』, the title, pg_clear */
  async function finish(ev) {
    const b = ev.npc('boss');
    await ev.wait(20);
    await ev.say('円環が、ほどけた……。');
    ev.closeMessage();
    ev.sfx('light');
    await ev.flash('#ffffff', 20);
    b.hide();
    await ev.wait(40);
    ev.sfx('quill');
    await ev.wait(30);
    ev.jingle('chapter');
    await ev.caption('年代記に、外伝『円環の竜』が\n記された。', { frames: 220, dim: CAP_DIM, highlight: '『円環の竜』' }); // gold title, as the chapter captions
    ev.sfx('page');
    R.Game.title = TITLE;
    ev.setFlag('pg_clear');
    ev.setObjective('obj_s_pg_clear');
    await ev.say('{hero}は、「' + TITLE + '」と\n呼ばれるようになった。');
    ev.closeMessage();
    // the closing picture of the side chapter: the 外伝 panel, the 称号 and 「おしまい」 (R.Postgame, §10.12);
    // it fades back to the field and restores the music by itself
    if (R.Postgame && R.Postgame.bonusScene) await R.Postgame.bonusScene({ title: R.Game.title });
    ev.bgm();
    if (R.Engine.fadeAlpha > 0) await ev.fadeIn(30);
  }
  K.TITLE = TITLE;
})(window.RPG);
