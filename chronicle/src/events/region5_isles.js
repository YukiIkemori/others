// Region 5 マレア諸島 (r_isles) — 「帰らずの船長」. Owner: reg-5 (R5). DESIGN §10.8.6, §10.8.0.
//
// Flow (§10.8.6):
//   1 coral_intro          coral onEnter (once by isles_start): Drake tells of the ghost ship → obj_isles_1
//   2 nerei_marina         Marina: Glen, the forgotten shanty, the shell in the cave → isles_marina, obj_isles_2
//   3 tide_cave_1_boss     mid-boss 深みの大ダコ (tr_b_octopus) blocks the rock shelf → isles_mid
//   4 tide_cave_1_shell    the glowing shell on the shelf → k_shanty, obj_isles_3
//   5 nerei_marina_song    Marina gets the shell: that night she sings on the pier, the ghost ship comes
//                          alongside → isles_ship, obj_isles_4, warp ghost_ship_1 entrance
//   6 nerei_pier           the pier (step, cond isles_ship): board again (also after the clear; no boss then)
//   7 ghost_ship_3_fine    the girl in grey before the captain's cabin → story_fine_isles (story), isles_fine
//     ghost_ship_3_boss    亡霊船長グレン (tr_b_captain) → isles_boss
//   8 (same event)         the shanty told to the captain → dawn at the pier (Marina and Glen) →
//                          ev.clearRegion('r_isles') → the inn in Coral → story_after_clear (story)
//   nerei_marina_reward    after the clear: Marina's one-of-a-kind reward 潮騒の耳飾り (ac_tale_isles)
// Other scripts: coral_drake (the harbour master, tier lines + ロウェルの痕跡), the ship's log (signs),
// ghost_ship_1_arrival (the first step on the deck), ghost_ship_3_door.
//
// Objectives obj_isles_1..4 are registered here (§13 A21 / §13.1 R5) and set as the region objective
// (ev.setObjective(id, {region:'r_isles'}), §10.13.8).
(function (R) {
  'use strict';
  const E = R.DB.events;
  const RS = 'r_isles';
  const K = R.Isles;

  Object.assign(R.DB.objectives, {
    obj_isles_1: { text: '島の東の岬の村ネレイで、\n幽霊船の話を聞こう。' },
    obj_isles_2: { text: '潮鳴りの洞窟の奥の岩棚で、\n光る貝がらを探そう。' },
    obj_isles_3: { text: 'ネレイのマリナに、\n貝がらを届けよう。' },
    obj_isles_4: { text: '幽霊船の船長室を\n目指そう。' },
  });

  const obj = (ev, id) => { if (!ev.cleared(RS)) ev.setObjective(id, { region: RS }); };
  const pick = (ev, list) => { for (const e of list) if (e && ev.check(e.cond)) return e.text; return null; };
  const hasEvent = (id) => !!(R.DB.events[id]);
  /** a colour wash for the night / dawn scenes (closed in finally) */
  const tint = (c, a, m) => (K && K.tint ? K.tint(c, a, m) : { fade: async () => {}, close() {}, set() {}, color() {} });
  const NIGHT = '#0c1238', DAWN = '#ff9448';
  /** the pier scenes put the message window at the top, so the ship below the pier stays in view */
  const TOP = { pos: 'top' };
  /** a scene NPC present on this map (hidden ones included) */
  const npcOn = (ev, id) => !!(R.Field && R.Field.npc && R.Field.npc(id));
  /** clear the pier for a scene: Marina's cottage figure and the angler step aside */
  const clearPier = (ev) => { for (const id of ['marina', 'marina_song', 'marina_wait', 'marina_home', 'pier_fisher']) if (npcOn(ev, id)) ev.npc(id).hide(); };

  // ================================================================ 1 coral_intro (onEnter coral)
  E.coral_intro = {
    meta: { needs: [], gives: ['flag:isles_start'] },
    run: async (ev) => {
      if (ev.flag('isles_start')) return;
      if (ev.cleared(RS)) { ev.setFlag('isles_start'); return; } // debug starts past the region
      await ev.wait(10);
      if (npcOn(ev, 'drake')) ev.npc('drake').face('player');
      await ev.say('港の親方らしい、日に焼けた\n大男が声をかけてきた。');
      await ev.say([
        '霧の夜になると、幽霊船が出るんだ。',
        'あれについて行った船は、\nみんな岩礁で座礁しちまった。',
        '岬の村ネレイのマリナばあさんなら、\n何か知ってるかもしれねえ。',
      ]);
      await ev.say('ネレイは、この島の東の岬だ。\n町の東の橋を渡って、\n海ぞいに行きな。');
      ev.setFlag('isles_start');
      obj(ev, 'obj_isles_1');
    },
  };

  // ================================================================ coral_drake (talk)
  E.coral_drake = {
    meta: { needs: [], gives: ['flag:isles_start'] },
    run: async (ev) => {
      const post = ev.check({ postgame: true });
      if (post) {
        await ev.say('祭りの夜は、港じゅうの船が\n舟歌を歌うんだ。\n……いい眺めだぜ、{hero}。');
        return;
      }
      if (ev.cleared(RS)) {
        await ev.say(pick(ev, [
          { cond: 'final_open', text: '内海の霧が晴れたってな。\n白い塔が見えるとか。\n……世の中、変わるもんだ。' },
          { cond: { tier: 4 }, text: '記録院の書記どもが、\n舟歌を書いた本まで\n持っていこうとしやがる。\f渡すもんか。歌は、\n歌ってこそのもんだ。' },
          { text: '霧の夜でも、船が出せるように\nなった。舟歌を歌えば、\n互いの船の場所が分かる。\fあんたのおかげだ、{hero}。\nグレン船長も、きっと\n喜んでるだろうよ。' },
        ]));
        return;
      }
      if (!ev.flag('isles_start')) { await ev.call('coral_intro'); return; }
      if (ev.flag('isles_ship')) {
        await ev.say('幽霊船が、ネレイの桟橋に\n横づけされたって？\n……乗り込むのか、あんた。');
        await ev.say('グレン船長は、この港の誇りだ。\nどうか、あの人を\n楽にしてやってくれ。');
        return;
      }
      if (ev.has('k_shanty')) {
        await ev.say('舟歌の貝がら？　そいつを\nマリナばあさんに届けてやりな。\nネレイは島の東の岬だ。');
        return;
      }
      if (ev.flag('isles_marina')) {
        await ev.say('潮鳴りの洞窟なら、町と\nネレイの間の、海ぞいの岩場だ。\f中は潮が満ち引きしてる。\n足もとに気をつけな。');
        return;
      }
      // ロウェルの痕跡 (§10.8.6, before the clear)
      await ev.say('記録院のやつに、舟歌を\n歌ってやったんだ。\nそのあとからよ、誰も\n歌えなくなっちまったのは。');
      await ev.say('ネレイのマリナばあさんは、\nグレン船長の許婚だった人だ。\n何か知ってるかもしれねえ。');
    },
  };

  // ================================================================ 2 / 5 nerei_marina (talk)
  E.nerei_marina = {
    meta: { needs: [], gives: ['flag:isles_marina'] },
    run: async (ev) => {
      if (ev.cleared(RS)) { await ev.call('nerei_marina_reward'); return; }
      if (ev.flag('isles_ship')) {
        await ev.say('あの人の船が、桟橋で\n待っているよ。');
        await ev.say('どうか、あの人に\n舟歌を届けておくれ。\n……わたしの声では、\nもう届かないのかもしれない。');
        return;
      }
      if (ev.has('k_shanty')) { await ev.call('nerei_marina_song'); return; }
      if (ev.flag('isles_marina')) {
        await ev.say('潮鳴りの洞窟の奥の岩棚に、\n貝がらを隠したの。\n二人で歌を刻んだ貝がらさ。');
        await ev.say('洞窟は、コーラルとこの村の\n間の岩場にあるよ。\n……気をつけてお行き。');
        return;
      }
      await ev.say([
        'あれは、グレンの船だよ。六十年前、\n嵐の海へ出て、帰らなかった人……。',
        'あの人の舟歌を、\nわたしまで忘れてしまった。',
        '若いころ、二人で歌を刻んだ貝がらを、\n潮鳴りの洞窟に隠したの。',
      ]);
      await ev.say('あの貝がらがあれば、\n歌を思い出せるかもしれない。\n……取ってきてくれるかい？');
      ev.setFlag('isles_marina');
      if (!ev.flag('isles_start')) ev.setFlag('isles_start');
      obj(ev, 'obj_isles_2');
    },
  };

  // ================================================================ 5 nerei_marina_song (talk, with the shell)
  E.nerei_marina_song = {
    meta: { needs: ['item:k_shanty'], gives: ['flag:isles_ship', 'flag:isles_marina'], warp: { to: 'ghost_ship_1', spawn: 'entrance' } },
    run: async (ev) => {
      if (ev.flag('isles_ship')) { await ev.call('nerei_marina'); return; }
      await ev.say('{hero}は、光る貝がらを\nマリナに渡した。');
      await ev.say('……ああ、この歌だよ。');
      await ev.say('今夜、桟橋で歌ってみる。\nあの人に届くかもしれない。');
      ev.closeMessage();
      await ev.fadeOut(40);
      await ev.caption('その夜――', { frames: 110 });
      ev.setFlag('isles_marina');
      // the pier at night
      await ev.warp('nerei', 'pier', { fade: false, dir: 'right' });
      const night = tint(NIGHT, 0.5);
      try {
        clearPier(ev);
        const m = ev.npc('marina_pier');
        m.show(); m.face('right');
        if (npcOn(ev, 'ghostship')) ev.npc('ghostship').hide();
        ev.bgm('ghost');
        await ev.fadeIn(40);
        await ev.wait(30);
        await ev.say('マリナは、桟橋の先に立ち、\n霧の海へ向かって歌いはじめた。', TOP);
        ev.closeMessage();
        ev.sfx('bell');
        await ev.caption('♪　霧の海でも、迷いはしない\n岬の灯が、おれを呼ぶから', { frames: 240 });
        await ev.wait(20);
        await night.fade(0.62, 40);
        await ev.say('霧の向こうに、青白い灯が\nひとつ、またひとつと\nともりはじめた……。', TOP);
        ev.closeMessage();
        ev.sfx('ship');
        await ev.shake(24, 1);
        ev.setFlag('isles_ship');
        ev.refresh();
        if (npcOn(ev, 'ghostship')) ev.npc('ghostship').show();
        await ev.flash('#b8d8ff', 16);
        await ev.say('幽霊船が、桟橋に横づけされた……！', TOP);
        m.face('left');
        await ev.say('あの人の船だ……。', TOP);
        await ev.say('{hero}、どうか、あの人に\nこの歌を届けておくれ。\nわたしは、ここで待っているよ。\n六十年、待ったんだもの。', TOP);
        ev.closeMessage();
        obj(ev, 'obj_isles_4');
        await ev.fadeOut(30);
      } finally { night.close(); }
      await ev.warp('ghost_ship_1', 'entrance', { fade: false });
      await ev.fadeIn(30);
    },
  };

  // ================================================================ 6 nerei_pier (step, cond isles_ship)
  E.nerei_pier = {
    meta: { needs: ['flag:isles_ship'], gives: [], warp: { to: 'ghost_ship_1', spawn: 'entrance' } },
    run: async (ev) => {
      const after = ev.cleared(RS);
      const yes = after
        ? await ev.yesno('岬の岩場に、あの船が\n静かに横たわっている。\n乗り込みますか？')
        : await ev.yesno('幽霊船に乗り込みますか？');
      if (!yes) return false;
      ev.closeMessage();
      await ev.warp('ghost_ship_1', 'entrance', { sfx: 'door' });
    },
  };

  // ================================================================ nerei_marina_reward (after the clear)
  E.nerei_marina_reward = {
    meta: { needs: ['region:r_isles'], gives: ['item:ac_tale_isles', 'flag:nerei_marina_reward'] },
    run: async (ev) => {
      if (!ev.flag('nerei_marina_reward')) {
        await ev.say('{hero}、ありがとう。\nあの人は、ちゃんと\n帰ってきてくれたよ。');
        await ev.say('これを、持っていっておくれ。\nあの人が、船出の前に\nくれた耳飾りさ。\f潮騒の音がするだろう？\nあの人の船が、いつも\nそばにいるようでね。');
        const ok = await ev.give('ac_tale_isles');
        if (ok === false) { await ev.say('おや、荷物がいっぱいだね。\nまた来ておくれ。'); return false; }
        ev.setFlag('nerei_marina_reward');
        await ev.say('大事にしておくれ。\n……ああ、今日は\n海がよく晴れているね。');
        return;
      }
      await ev.say(pick(ev, [
        { cond: { postgame: true }, text: '子どもたちに、あの人の\n舟歌を教えているの。\nみんな、すぐに覚えるのよ。' },
        { cond: 'final_open', text: '内海の霧が晴れたそうだね。\nあの人が見たら、\nきっと船を出したがるよ。' },
        { cond: { tier: 6 }, text: 'この島でも、子守歌を\n忘れる人が出ているんだよ。\n……わたしは、忘れない。\n舟歌も、あの人の顔も。' },
        { text: '毎朝、桟橋で舟歌を歌うのよ。\nあの人に、聞こえるようにね。' },
      ]));
    },
  };

  // ================================================================ 3 tide_cave_1_boss (step band + the visible boss)
  E.tide_cave_1_boss = {
    meta: { needs: [], gives: ['flag:isles_mid'] },
    run: async (ev) => {
      if (ev.flag('isles_mid')) return;
      await ev.say('岩棚へ渡る水路を、巨大な\nタコがふさいでいる……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      const r = await ev.battle('tr_b_octopus');
      if (r !== 'win') return false;
      ev.setFlag('isles_mid');
      if (npcOn(ev, 'boss')) ev.npc('boss').hide();
      for (const id of ['tentacle_a', 'tentacle_b']) if (npcOn(ev, id)) ev.npc(id).hide();
      ev.sfx('water');
      await ev.flash('#8ad0ff', 10);
      await ev.say('大ダコは、深みへと\n沈んでいった。');
      await ev.say('水路の奥の岩棚で、何かが\nきらりと光った。');
      ev.refresh();
    },
  };

  // ================================================================ 4 tide_cave_1_shell (the sparkle on the shelf)
  E.tide_cave_1_shell = {
    meta: { needs: ['flag:isles_mid'], gives: ['item:k_shanty', 'flag:isles_shell'] },
    run: async (ev) => {
      if (ev.flag('isles_shell')) return;
      await ev.say('岩棚の上で、白い貝がらが\n光っている。');
      await ev.say('貝がらの内側に、細い字で\n歌が刻まれている……。');
      ev.closeMessage();
      await ev.give('k_shanty');
      ev.setFlag('isles_shell');
      if (npcOn(ev, 'shell')) ev.npc('shell').hide();
      await ev.say('耳に当てると、波の音に\nまじって、誰かの歌声が\n聞こえた気がした。');
      obj(ev, 'obj_isles_3');
      ev.refresh();
    },
  };

  // ================================================================ ghost ship: the first step on the deck
  E.ghost_ship_1_arrival = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.cleared(RS)) {
        // the first visit after the clear: the ship is only an old wreck now
        if (ev.flag('isles_deck_after')) return;
        ev.setFlag('isles_deck_after');
        await ev.wait(16);
        await ev.say('船は静まり返っている。\n青白い灯は、もう\nどこにもともっていない。');
        return;
      }
      if (ev.flag('isles_deck')) return;
      ev.setFlag('isles_deck');
      await ev.wait(16);
      await ev.say('ぎしり、と甲板がきしんだ。\n破れた帆が、風もないのに\nゆれている……。');
      await ev.say('船のどこかから、\n途切れ途切れの舟歌が\n聞こえてくる。');
    },
  };

  // ================================================================ 7 the girl in grey (step, once isles_fine)
  E.ghost_ship_3_fine = {
    meta: { needs: [], gives: ['flag:isles_fine'], calls: ['story_fine_isles'] },
    run: async (ev) => {
      if (ev.flag('isles_boss')) return;
      if (ev.flag('isles_fine')) {
        // talked to again (she stands in the vestibule again after the player left the floor):
        // the story owner's script plays only the closing line and she fades; the door stays open
        if (hasEvent('story_fine_isles')) await ev.call('story_fine_isles');
        else await fineFallback(ev, true);
        return;
      }
      if (hasEvent('story_fine_isles')) await ev.call('story_fine_isles');
      else await fineFallback(ev);
      ev.setFlag('isles_fine');
      ev.refresh();
      ev.sfx('door');
      await ev.say('船長室の扉が、ひとりでに\n音もなく開いた……。');
    },
  };
  /** the scene of §10.9.4 when the story owner's story_fine_isles is not loaded */
  async function fineFallback(ev, again) {
    const t = ev.tier();
    const f = npcOn(ev, 'fine') ? ev.npc('fine') : null;
    if (f) f.face('player');
    await ev.wait(16);
    if (!again) await ev.say('待っている人がいる限り、\n物語は終わらない。');
    const end = t >= 6 ? '……もう、あまり時間がないの。' : t >= 3 ? 'わたしのことは気にしないで。\n先へ進みなさい。' : '……気をつけて。';
    await ev.say(end);
    ev.closeMessage();
    if (t >= 3 && !again) await ev.caption('フィーネの足元が、\n透けて見えた。', { frames: 150 });
    ev.sfx('magic');
    await ev.flash('#e8ecff', 10);
    if (f) f.hide();
    await ev.wait(20);
  }

  // the sealed cabin door (examine, before the girl in grey)
  E.ghost_ship_3_door = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('船長室の扉は、固く\n閉ざされている。\n扉の向こうから、かすかに\n舟歌が聞こえる……。');
    },
  };

  // ================================================================ 7 / 8 ghost_ship_3_boss
  E.ghost_ship_3_boss = {
    meta: {
      needs: ['flag:isles_ship'],
      gives: ['flag:isles_boss', 'region:r_isles'],
      warp: { to: 'coral', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('isles_boss') || ev.cleared(RS)) return;
      await ev.say('♪　霧の海でも……迷い……\n……続きが、出てこない……。');
      await ev.say('おれは……どこへ帰るんだった？\n誰が、待っていた……？\n思い出せない……思い出せない！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(24, 3);
      const r = await ev.battle('tr_b_captain');
      if (r !== 'win') return false;
      ev.setFlag('isles_boss');
      // the shanty told to the captain
      if (npcOn(ev, 'boss')) ev.npc('boss').hide();
      const g = ev.npc('glen');
      if (npcOn(ev, 'glen')) { g.show(); g.face('player'); }
      ev.sfx('magic');
      await ev.flash('#d8ecff', 14);
      await ev.wait(20);
      await ev.say('{hero}は、マリナの舟歌を\n船長に語り聞かせた。');
      ev.closeMessage();
      await ev.caption('♪　霧の海でも、迷いはしない\n岬の灯が、おれを呼ぶから', { frames: 210 });
      ev.sfx('quill');
      await ev.say('……マリナ。そうだ、\nおれは帰ると約束したんだ。');
      await ev.say('岬の灯は、あいつだったのか。\n六十年も、待たせちまったな。\n……帰ろう。');
      ev.closeMessage();
      await ev.fadeOut(40);
      // dawn at the pier (§10.8.6 #8)
      await ev.warp('nerei', 'pier', { fade: false, dir: 'right' });
      const dawn = tint(DAWN, 0.55, 'soft-light');
      try {
        clearPier(ev);
        const m = ev.npc('marina_pier'), gl = ev.npc('glen_pier');
        m.show(); gl.show();
        m.face('right'); gl.face('left');
        ev.bgm('sorrow');
        await ev.fadeIn(50);
        await ev.wait(40);
        await ev.say('夜明けの桟橋に、\nひとつの影が降り立った。', TOP);
        ev.closeMessage();
        await ev.wait(20);
        await ev.say('おかえりなさい、グレン。', TOP);
        await ev.wait(10);
        await ev.say('ただいま、マリナ。', TOP);
        ev.closeMessage();
        await ev.wait(40);
        await dawn.fade(0.95, 60);
        ev.sfx('light');
        await ev.flash('#fff4e0', 20);
        gl.hide();
        if (npcOn(ev, 'ghostship')) ev.npc('ghostship').hide();
        if (npcOn(ev, 'wreck')) ev.npc('wreck').show();
        await ev.flash('#fff4e0', 12);
        await ev.say('船長の姿は、朝日の中へ\n溶けるように消えていった。', TOP);
        await ev.say('あとには、岩場に乗り上げた\n古い船だけが残された。', TOP);
        ev.closeMessage();
        await dawn.fade(0.3, 40);
        m.face('down');
        await ev.say('……ありがとう。\nあの人は、やっと帰ってきた。', TOP);
        ev.closeMessage();
        await ev.wait(20);
        await ev.clearRegion(RS);
        await ev.fadeOut(40);
      } finally { dawn.close(); }
      // the night at the inn (§10.8.0-3)
      await ev.caption('その夜は、町の宿で眠った。', { frames: 140 });
      ev.heal();
      await ev.warp('coral', 'inn', { fade: false, dir: 'down' });
      ev.bgm();
      await ev.fadeIn(30);
      if (hasEvent('story_after_clear')) await ev.call('story_after_clear');
    },
  };
})(window.RPG);
