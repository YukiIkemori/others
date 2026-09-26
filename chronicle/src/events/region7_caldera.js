// Region 7 灰の荒野 (r_ash) — town events of 炎の町カルデラ and the region's objectives (DESIGN §10.8.8).
// Owner: reg7 (R7).
//   caldera_intro          onEnter: 族長ドルガ meets the party at the gate (ash_start, obj_ash_1)
//   caldera_kaya           火の巫女カヤ before the chapter: the forgotten story, Rowell's trace, obj_ash_2
//   caldera_kaya_reward    カヤ after the chapter: 残り火の宝珠 (ac_tale_ash, once), then tier lines
//   caldera_spring         the hot spring after the chapter: a free full heal (§10.8.8 クリア後)
//   caldera_spring_closed  the hot spring before it: choked with ash
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_ash';

  // ------------------------------------------------------------ objectives (§10.13.8, obj_ash_*)
  Object.assign(R.DB.objectives, {
    obj_ash_1: { text: '灰の火山の火口に眠る、\n火の鳥の卵を目指そう。' },
    obj_ash_2: { text: '灰の火山の壁画から、\n火の鳥の物語を読み取ろう。' },
    obj_ash_3: { text: '火口へ向かい、\n卵に物語を語り聞かせよう。' },
  });

  const OBJ = [null, 'obj_ash_1', 'obj_ash_2', 'obj_ash_3'];
  /** the region objective, never going back (1 → 2 → 3) */
  function advance(ev, n) {
    const cur = (R.Game.regionObj && R.Game.regionObj[REGION]) || '';
    const now = +(cur.match(/^obj_ash_(\d)$/) || [0, 0])[1];
    if (n > now) ev.setObjective(OBJ[n], { region: REGION });
  }
  R.Reg7 = R.Reg7 || {};
  R.Reg7.advance = advance;

  // ------------------------------------------------------------ 1. 族長ドルガ（町に着く）
  E.caldera_intro = {
    meta: { needs: [], gives: ['flag:ash_start'] },
    run: async (ev) => {
      if (ev.flag('ash_start')) return;
      if (ev.cleared(REGION)) { ev.setFlag('ash_start'); return; }
      const d = ev.npc('dorga_gate');
      await ev.wait(20);
      if (d.visible) d.face('player');
      await ev.say('旅の方か。ようこそ、\n炎の町カルデラへ。\n……と言いたいところだが。');
      await ev.say('わしは族長のドルガ。\nこの灰を見てくれ。');
      await ev.say('火山が灰を吐き続けて、\n畑が全滅だ。');
      await ev.say('今年は、火の鳥が\nよみがえる百年目の\nはずなのに……。');
      await ev.say('火の鳥は、百年ごとに\n火口で灰になり、\n卵からよみがえる。\f巫女がその前で、火の鳥の\n物語を語るのが習わしだ。');
      await ev.say('神殿の巫女、カヤなら\n何か知っているかもしれん。\n神殿は、町の北の奥だ。');
      ev.closeMessage();
      ev.setObjective('obj_ash_1', { region: REGION });
      if (d.visible) {
        await d.walk('UUU');
        d.hide();
      }
      ev.setFlag('ash_start');
    },
  };

  // ------------------------------------------------------------ 2. 火の巫女カヤ（クリア前）
  E.caldera_kaya = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const k = ev.var('ash_murals') || 0;
      const kaya = ev.npc('kaya');
      if (kaya.visible) kaya.face('player');
      if (!ev.flag('caldera_kaya')) {
        await ev.say('わたしは、火の神殿の巫女、\nカヤ。');
        await ev.say('百年目の祭りでは、\n巫女が卵の前で\n火の鳥の物語を語るの。\nでも、物語が出てこない……。');
        await ev.say('記録院の人に、火の鳥の\n物語を語ったの。\nそれから、声に出そうと\nしても出てこなくて……。');
        await ev.say('火山の壁には、\n昔の巫女たちが描いた絵が\n残っているはず。');
        await ev.say('お願い、{hero}さん。\n壁画を読み解いて、\n火の鳥に物語を届けて。');
        ev.setFlag('caldera_kaya');
        if (k < 3) advance(ev, 2);
        return;
      }
      if (k >= 3) {
        await ev.say('三つの壁画を、全部……？\nそれが、火の鳥の物語よ。');
        await ev.say('火口へ行って。\n卵のそばで、その物語を\n語ってあげて。');
      } else if (k > 0) {
        await ev.say('壁画を見つけたのね！\n残りも、きっと\n火山の中にあるわ。');
      } else if (ev.flag('ash_mid')) {
        await ev.say('炎の番犬が倒れたって？\nあの犬は、昔から壁画を\n守っていたと聞くわ。');
      } else {
        await ev.say('火山の壁画を探して。\n昔の巫女たちが、物語を\n残してくれたはずなの。');
      }
    },
  };

  // ------------------------------------------------------------ クリア後: カヤの報酬 (§10.8.8, §8.8)
  E.caldera_kaya_reward = {
    meta: { needs: ['region:r_ash'], gives: ['item:ac_tale_ash'] },
    run: async (ev) => {
      const kaya = ev.npc('kaya_after');
      if (kaya.visible) kaya.face('player');
      if (!ev.flag('caldera_kaya_reward')) {
        await ev.say('{hero}さん！　火の鳥が、\n空へ飛んでいくのが\n見えたわ。');
        await ev.say('あなたが語ってくれた物語、\n今度は、わたしが覚えておく。\n百年後の巫女に、ちゃんと\n伝えられるように。');
        await ev.say('これは、神殿に伝わる宝珠。\n火の鳥の残り火が\n宿っているんですって。');
        await ev.give('ac_tale_ash');
        ev.setFlag('caldera_kaya_reward');
        return;
      }
      if (ev.check({ postgame: true })) await ev.say('祭りでは、毎晩\n火の鳥の物語を語っているの。\n子どもたちも、すっかり\n覚えてしまったわ。');
      else if (ev.flag('final_open')) await ev.say('内海の霧が晴れたって。\n火の鳥が、何日も前から\n北の空をにらんでいたの。');
      else if (ev.check({ tier: 4 })) await ev.say('記録院のお触れ……。\n物語は、紙の中じゃなくて\n人の声の中で生きるのに。');
      else await ev.say('火の鳥の物語は、もう\n忘れない。毎晩、神殿で\n語っているの。');
    },
  };

  // ------------------------------------------------------------ クリア後: 温泉 (caldera_spring)
  E.caldera_spring = {
    meta: { needs: ['region:r_ash'], gives: [] },
    run: async (ev) => {
      await ev.say('湯けむりの立つ温泉だ。\nひと休みしていこう。');
      ev.closeMessage();
      await ev.fadeOut(24);
      ev.sfx('heal');
      ev.heal();
      await ev.wait(30);
      await ev.fadeIn(24);
      await ev.say('体の芯まで温まった。\n疲れがすっかり取れた！');
    },
  };
  E.caldera_spring_closed = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('灰が積もって、湯が\n黒くにごっている。\nとても入れそうにない。');
    },
  };
})(window.RPG);
