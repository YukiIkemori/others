// The story across the regions (DESIGN §10.9). Owner: story (A19).
//   story_after_clear   the morning after a region is cleared (§10.9.2): the scene of the new tier T1–T8,
//                       once each (flag st_t<n>). Called by every region's boss event after
//                       ev.warp(<town>,'inn') + ev.heal() + the caption 「その夜は、町の宿で眠った。」.
//                       Uses the town's scene slots st_rival / st_fine / st_extra (§10.8.0-7).
//   story_home_t6       ロアの里 at tier 6+: the master has forgotten her pupil (§10.9.3). roa's onEnter
//                       (A18b's roa_enter) calls it when ['st_t6','!st_berna_forgot']; roa_berna calls it too.
//   story_fine_<rs>     the girl in grey before each region boss (§10.9.4): step event (once <rs>_fine) and
//                       the talk event of the NPC `fine` placed by the region owner.
(function (R) {
  'use strict';
  const E = R.DB.events;
  const S = R.Story;
  const say = S.said;

  // ------------------------------------------------------------ helpers
  /** an NPC walks one tile up to the hero, the scene runs, it walks back and is gone (§10.9.2) */
  async function visit(ev, slot, fn, o) {
    const opt = o || {};
    const n = S.slot(ev, slot, opt.sprite);
    try {
      await ev.wait(20);
      await n.walk('U', opt.slow ? 22 : undefined);
      n.face('up');
      await ev.wait(10);
      await fn(n);
      ev.closeMessage();
      await ev.wait(10);
      if (opt.vanish) {
        ev.sfx('magic');
        await ev.flash('#e8ecff', 10);
        n.hide();
      } else {
        n.face('down');
        await n.walk('D', opt.slow ? 22 : undefined);
      }
      await ev.wait(12);
    } finally {
      S.hideSlot(ev, slot);
    }
  }
  /** 「{hero}に、師匠ベルナから手紙が届いていた。」 + the letter's pages */
  async function letter(ev, intro, pages) {
    ev.bgm('home');
    await ev.say(intro);
    ev.sfx('page');
    for (const p of pages) await ev.say(say('letter', p));
  }
  /** the rival fight (canLose): → true when won. The fight is fixed-tier (§10.13.5). */
  async function rivalFight(ev, troop) {
    ev.closeMessage();
    const r = await ev.battle(troop, { canLose: true });
    return r === 'win';
  }

  // ------------------------------------------------------------ T1 手紙 → 少女
  async function t1(ev) {
    await letter(ev, '{hero}に、師匠ベルナから\n手紙が届いていた。', [
      '第一章、おめでとう。\nあなたの声は、きっと\nあの土地の人たちに届いたよ。',
      'ただね、里の語り石の文字が\nまた一つ消えたの。',
      '急がなくていい。でも、\n立ち止まらないで。',
    ]);
    ev.bgm();
    await ev.say('手紙をたたむと、\n宿の前に、灰色のマントの\n少女が立っていた。');
    await visit(ev, 'st_fine', async () => {
      await ev.say(say('fine', '一つ目……。\nあと、七つね。'), { voice: 'v_fine_t1_01' });
      await ev.say(say('fine', 'わたし？　ただの、\n通りすがりよ。'), { voice: 'v_fine_t1_02' });
    }, { vanish: true });
    await ev.say('少女の姿は、朝の光の中に\n溶けるように消えた。');
  }

  // ------------------------------------------------------------ T2 ロウェル 1戦目
  async function t2(ev) {
    let won = false;
    await visit(ev, 'st_rival', async () => {
      ev.bgm('tension');
      await ev.say('また会ったな、語り部。', { voice: 'v_rowell_t2_01' });
      await ev.say('伝承を言いふらして回るのは、\nもうやめろ。記録院が写して\n保管すれば、それで十分だ。', { voice: 'v_rowell_t2_02' });
      await ev.say('口で言っても分からない\nなら、力ずくで止める。', { voice: 'v_rowell_t2_03' });
      won = await rivalFight(ev, 'tr_b_rowell1');
      ev.setFlag('st_rival_duel1');
      if (won) {
        await ev.say('……くっ。その筆、\nまぐれではないようだな。', { voice: 'v_rowell_t2_04' });
        await ev.say('覚えておけ。伝承は、\n人を縛る鎖にもなる。', { voice: 'v_rowell_t2_05' });
        ev.setFlag('st_rival_won1');
        await ev.say('ロウェルは、銀の筆を\n投げてよこした。');
        await ev.give('ac_rival_pen');
        await ev.say('受け取っておけ。\n借りを作るのは好かない。', { voice: 'v_rowell_t2_06' });
      } else {
        await ev.say('これが力の差だ。\n……頭を冷やせ、語り部。', { voice: 'v_rowell_t2_07' });
      }
    });
    ev.heal();
    ev.bgm();
    if (!won) await ev.say('宿の主人が、手当てを\nしてくれた。');
  }

  // ------------------------------------------------------------ T3 手紙（物忘れ）→ フィーネが名乗る
  async function t3(ev) {
    await letter(ev, '{hero}に、師匠ベルナから\nまた手紙が届いていた。', [
      '近ごろ、物忘れがひどくてね。\nあなたの顔を思い浮かべるのに、\n少し時間がかかるの。',
      '……笑ってちょうだい。\n年を取るって、こういうことさ。',
    ]);
    await ev.say('手紙の字は、ところどころ\n乱れていた。');
    ev.bgm();
    await visit(ev, 'st_fine', async () => {
      await ev.say(say('fine', '三つ目。よくやったわ。'), { voice: 'v_fine_t3_01' });
      await ev.say(say('fine', '……わたしはフィーネ。\n名前くらいは、覚えておいて。'), { voice: 'v_fine_t3_02' });
      ev.setFlag('st_t3');
      ev.closeMessage();
      await ev.caption('フィーネの指先が、\nかすかに透けて見えた。');
    }, { vanish: true });
  }

  // ------------------------------------------------------------ T4 お触れ → ロウェル
  async function t4(ev) {
    ev.bgm('tension');
    await ev.say('町の広場が、なにやら\n騒がしい……。');
    await visit(ev, 'st_extra', async () => {
      await ev.say(say('scribe', '記録院より、お触れである！'));
      await ev.say(say('scribe', '大書記ラザロさまの名において\n告げる。古い伝承を記した書物は、\nすべて記録院へ納めよ！'));
      await ev.say(say('scribe', '従わぬ者は、記録院の敵と\nみなす！'));
    });
    await visit(ev, 'st_rival', async () => {
      if (ev.flag('st_rival_won1')) await ev.say(say('rowell', '……また会ったな。\nこの前の借りは、まだ\n返していないぞ。'), { voice: 'v_rowell_t4_01' });
      await ev.say(say('rowell', '……聞いたか。\n院長は本気だ。'), { voice: 'v_rowell_t4_02' });
      await ev.say(say('rowell', '院長は、悲しみのない世界を\n作ろうとしている。\nおまえには分からないだろうが。'), { voice: 'v_rowell_t4_03' });
    });
    ev.bgm();
    await ev.caption('内海の白い霧が、\nいっそう濃くなったという。');
  }

  // ------------------------------------------------------------ T5 ロウェル 2戦目 → 同じ手紙が二通
  async function t5(ev) {
    let won = false;
    await visit(ev, 'st_rival', async () => {
      ev.bgm('tension');
      if (ev.flag('st_rival_won1')) await ev.say(say('rowell', '今度は、まぐれとは言わせない。'), { voice: 'v_rowell_t5_01' });
      await ev.say(say('rowell', 'なぜだ……。おまえが語り直した\n伝承は、また人の口にのぼる。'), { voice: 'v_rowell_t5_02' });
      await ev.say(say('rowell', 'それが争いの種になると、\nなぜ分からない！'), { voice: 'v_rowell_t5_03' });
      won = await rivalFight(ev, 'tr_b_rowell2');
      ev.setFlag('st_rival_duel2');
      if (won) {
        await ev.say(say('rowell', '……おれは……本当に、\n正しいのか……。'), { voice: 'v_rowell_t5_04' });
        ev.setFlag('st_rival_won2');
        await ev.say('ロウェルは、傷だらけの\n手甲を外して、足元に置いた。');
        await ev.give('hn_rival_bracer');
      } else {
        await ev.say(say('rowell', '……勝ったのに、どうしてだ。\n少しも、すっきりしない。'), { voice: 'v_rowell_t5_05' });
      }
    });
    ev.heal();
    await letter(ev, '{hero}のもとに、ベルナから\n手紙が二通届いていた。', ['元気にしているかい。\n里は変わりないよ。']);
    await ev.say('もう一通を開くと……\n同じ文面だった。');
    ev.sfx('page');
    await ev.say(say('letter', '元気にしているかい。\n里は変わりないよ。'));
    await ev.say('二通とも、日付は同じ日だった。');
    ev.bgm();
  }

  // ------------------------------------------------------------ T6 フィーネ「ロアへ帰って」
  async function t6(ev) {
    ev.bgm('sorrow');
    await visit(ev, 'st_fine', async () => {
      await ev.say('六つ目……。', { voice: 'v_fine_t6_01' });
      await ev.say('{hero}。ロアの里へ、\n帰ってあげて。');
      await ev.say('あなたの師匠は、もう……。', { voice: 'v_fine_t6_02' });
      ev.closeMessage();
      await ev.caption('フィーネの足元は、\nもう半分ほど透けていた。');
    }, { vanish: true, sprite: 'npc:fine_fade' });
    ev.setObjective('obj_s_t6_home');
    ev.bgm();
  }

  // ------------------------------------------------------------ T7 ロウェルが寝返る
  async function t7(ev) {
    ev.bgm('tension');
    await ev.say('宿の前に、傷を負った\nロウェルが倒れこんできた！');
    await visit(ev, 'st_rival', async () => {
      await ev.say('……待ってくれ。話がある。', { voice: 'v_rowell_t7_01' });
      if (ev.flag('st_rival_won2')) await ev.say('おまえに負けてから、ずっと\n考えていた。……答えが出た。', { voice: 'v_rowell_t7_02' });
      await ev.say('院長は、白の書に伝承を写すと、\nその伝承が人の心から消えると\n知っていた。', { voice: 'v_rowell_t7_03' });
      await ev.say('知っていて、おれたちに\n写させていたんだ。', { voice: 'v_rowell_t7_04' });
      await ev.say('おれは、自分の母の顔を\n思い出せない。自分の日記を、\n白の書に写したからだ。', { voice: 'v_rowell_t7_05' });
      await ev.say('これを持っていけ。大書庫の\n封印の扉を開ける言葉が\n書いてある。', { voice: 'v_rowell_t7_06' });
      await ev.give('k_rowell_note');
      ev.setFlag('st_rival_defect');
      await ev.say('おれは、もう記録院には\n戻らない。', { voice: 'v_rowell_t7_07' });
    }, { slow: true });
    ev.bgm();
  }

  // ------------------------------------------------------------ T8 フィーネの正体
  async function t8(ev) {
    await ev.caption('八枚のページが、\nひとりでに光りはじめた。');
    ev.sfx('page');
    await ev.flash('#fffbe0', 12);
    ev.bgm('shrine');
    await visit(ev, 'st_fine', async () => {
      await ev.say('八つ目。……ありがとう、\n{hero}。');
      await ev.say('今なら話せるわ。わたしは\nフィーネ。千年前、始まりの\n年代記を書いた語り部。', { voice: 'v_fine_t8_01' });
      await ev.say('世界がまだ白い闇だったころ、\nわたしは最初の物語を語って、\nその闇を眠らせた。', { voice: 'v_fine_t8_02' });
      await ev.say('海の向こうでは、紋章が\n魔王を封じたという。\nこの大陸では、物語が\n封印になったの。', { voice: 'v_fine_t8_03' });
      await ev.say('その闇――虚ろの王が、\nいま目を覚ましかけている。', { voice: 'v_fine_t8_04' });
      await ev.say('八枚がそろった今なら、\n内海の霧を払える。', { voice: 'v_fine_t8_05' });
      await ev.say('ロアの里へ。すべてが\n始まった場所へ、帰りましょう。', { voice: 'v_fine_t8_06' });
    }, { vanish: true, sprite: 'npc:fine_fade' });
    ev.setFlag('st_fine_reveal');
    ev.setObjective('obj_s_final_roa');
    ev.bgm();
  }

  /** the screen visible (a finished or running fade-out is taken back) and the map's music on */
  async function lit(ev) {
    const Eng = R.Engine;
    if (Eng && (Eng.fadeAlpha > 0 || (Eng._fade && Eng._fade.to > 0))) await ev.fadeIn(24);
    ev.bgm();
  }
  S.lit = lit;

  const SCENES = { 1: t1, 2: t2, 3: t3, 4: t4, 5: t5, 6: t6, 7: t7, 8: t8 };
  S.SCENES = SCENES;

  E.story_after_clear = {
    meta: {
      needs: [],
      gives: ['flag:st_t1', 'flag:st_t2', 'flag:st_t3', 'flag:st_t4', 'flag:st_t5', 'flag:st_t6', 'flag:st_t7', 'flag:st_t8',
        'flag:st_rival_duel1', 'flag:st_rival_duel2', 'flag:st_rival_defect', 'flag:st_fine_reveal', 'item:k_rowell_note',
        'flag:st_rival_won1', 'flag:st_rival_won2', 'item:ac_rival_pen', 'item:hn_rival_bracer'],
      // what each tier's scene gives (tools: progress / playthrough read `byTier`)
      byTier: {
        1: ['flag:st_t1'], 2: ['flag:st_t2', 'flag:st_rival_duel1'], 3: ['flag:st_t3'], 4: ['flag:st_t4'],
        5: ['flag:st_t5', 'flag:st_rival_duel2'], 6: ['flag:st_t6'], 7: ['flag:st_t7', 'flag:st_rival_defect', 'item:k_rowell_note'],
        8: ['flag:st_t8', 'flag:st_fine_reveal'],
      },
    },
    run: async (ev) => {
      S.autoPos(ev);
      const t = Math.min(8, ev.tier());
      if (t < 1) return;
      const todo = [];
      // the note of T7 opens the archive's seal: never skip it (e.g. a region cleared with a debug tier jump)
      if (t === 8 && !ev.flag('st_t7')) todo.push(7);
      if (!ev.flag('st_t' + t)) todo.push(t);
      if (!todo.length) return;
      ev.closeMessage();
      await ev.caption('翌朝――');
      // the caption hands a black screen back when the region faded out for the night (it takes the
      // fade over and returns it): the morning is always shown lit, with the town's music (D6).
      // A caller that faded in first leaves fadeAlpha at 0, so nothing fades twice.
      await lit(ev);
      for (const k of todo) {
        await SCENES[k](ev);
        ev.closeMessage();
        ev.setFlag('st_t' + k);
      }
      S.dropActors();
      ev.refresh();
      // a tier scene may end on a fade-out or its own track (battle, 'sorrow'): never hand the
      // region caller a dark screen or a scene's music
      await lit(ev);
    },
  };

  // ------------------------------------------------------------ ロアの里 at tier 6+ (§10.9.3)
  // Berna lives in roa_house; roa's onEnter plays this at the story stone with a stand-in of her.
  // Called from roa_berna (inside roa_house) the lines are said where she stands.
  const HOME_T6 = [
    '旅の方？　ようこそ、\nロアの里へ。',
    'わたしはベルナ。昔は、語り部を\nしていたんだけどね。',
    '……不思議ね。あなたの顔、\nどこかで見たような気がする。',
  ];
  S.HOME_T6 = HOME_T6;
  E.story_home_t6 = {
    meta: { needs: ['flag:st_t6'], gives: ['flag:st_berna_forgot'] },
    run: async (ev) => {
      S.autoPos(ev);
      if (ev.flag('st_berna_forgot')) return;
      const inRoa = ev.map === 'roa' && R.Field && R.Field.map;
      let berna = null, elder = null;
      if (inRoa) {
        ev.bgm('sorrow');
        await ev.fadeOut(24);
        ev.player.setPos(22, 18, 'up');
        berna = S.actor(ev, 'st_berna', 'npc:berna', 21, 17, 'right');
        elder = S.actor(ev, 'st_elder', 'npc:elder', 25, 19, 'left');
        elder.hide();
        await ev.fadeIn(24);
        await ev.wait(20);
        await ev.say('里の語り石が、真っ白に\nなっていた……。');
        ev.closeMessage();
        await ev.wait(20);
        berna.face('down');
        await ev.wait(16);
        ev.player.face('left');
      } else {
        const b = R.Field && R.Field.npc ? R.Field.npc('berna') : null;
        if (b) ev.npc('berna').face('player');
      }
      for (const p of HOME_T6) await ev.say(p);
      ev.closeMessage();
      if (inRoa) {
        await ev.wait(20);
        berna.face('up');
        await ev.wait(20);
        elder.setPos(26, 19, 'left');
        elder.show();
        await elder.walk('L');
        ev.player.face('right');
      }
      // the village elder explains (in roa; in the master's house she is alone, and the elder says it
      // later from his own house: A18b's `elder` has the same line under st_berna_forgot)
      if (inRoa) {
        await ev.say('ベルナさんは、ひと月ほど前から\nあの調子でな……。\nおまえのことだけは、最後まで\n覚えておったんじゃが。');
        await ev.say('今は、自分の家で\n休んでおるよ。……顔を\n見せてやっておくれ。');
      }
      ev.setFlag('st_berna_forgot');
      if (R.Game.objective === 'obj_s_t6_home') ev.setObjective('obj_regions');
      if (inRoa) {
        ev.closeMessage();
        await ev.fadeOut(24);
        S.dropActors();
        ev.refresh();
        ev.bgm();
        await ev.fadeIn(24);
      }
    },
  };

  // ------------------------------------------------------------ the girl in grey before each boss (§10.9.4)
  const FINE = {
    forest: 'この根の奥に、伝承の核があるわ。\n……根を食べているものがいる。',
    desert: '名を失ったものは、名を持つ\nものをうらやむの。\n……あの王も、きっと。',
    snow: '凍っているのは、竜の体じゃない。\n心のほうよ。',
    marsh: '霧は形を持たないから、\n誰の姿にでもなれるの。',
    isles: '待っている人がいる限り、\n物語は終わらない。',
    mine: '誓いは、破られても消えない。\n忘れられたときに、消えるの。',
    ash: '燃え尽きることと、\n忘れられることは、違うわ。',
    star: '名前を呼ばれない星は、\n夜空にいても見えないの。',
  };
  const CLOSE = {
    0: { line: '……気をつけて。', cap: null },
    3: { line: 'わたしのことは気にしないで。\n先へ進みなさい。', cap: 'フィーネの足元が、\n透けて見えた。' },
    6: { line: '……もう、あまり時間がないの。', cap: 'フィーネの足元が、\n透けて見えた。' },
  };
  S.FINE = FINE;
  S.FINE_CLOSE = CLOSE;
  for (const rs of Object.keys(FINE)) {
    E['story_fine_' + rs] = {
      meta: { needs: [], gives: ['flag:' + rs + '_fine'] },
      run: async (ev) => {
      S.autoPos(ev);
        if (ev.flag(rs + '_boss')) return;
        const f = ev.npc('fine');
        const m = R.Field && R.Field.map;
        const n = m && m.npc('fine');
        if (n) n.sprite = S.fineSprite();
        const again = ev.flag(rs + '_fine');
        await ev.wait(12);
        f.face('player');
        await ev.wait(16);
        const c = S.tierLine(Math.min(7, ev.tier()), CLOSE);
        if (!again) await ev.say(FINE[rs]);
        await ev.say(c.line);
        ev.closeMessage();
        if (c.cap && !again) await ev.caption(c.cap);
        ev.sfx('magic');
        await ev.flash('#e8ecff', 10);
        f.hide();
        ev.setFlag(rs + '_fine');
        await ev.wait(20);
      },
    };
  }
})(window.RPG);
