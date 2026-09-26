// Region 1 ヴェルダの森 (r_forest) — the region's events and objectives (DESIGN §10.8.2, §10.8.0,
// §10.13.7–§10.13.9). Owner: R1 (reg1). Maps: src/maps/region1_*.js.
//
//   fern_enter             fern onEnter: the first visit runs fern_intro (#1)
//   fern_intro             #1 長老ハンナ at the gate → forest_start, obj_forest_1
//   fern_rita              #2 歌い手リタ → obj_forest_2 (and her lines through the region; she sings after the clear)
//   fern_hanna             長老ハンナ at home; after the clear → fern_hanna_reward (once, the region's reward)
//   verda_maze_1_stone     #3 歌の石 1 (forest_verses +1)
//   verda_maze_1_dan       #4 木こりダン → forest_dan (he goes home; he is in fern from then on)
//   verda_maze_2_stone_a   #5 歌の石 2
//   verda_maze_2_boss      #6 ダストウィング (tr_b_moth) → forest_mid
//   verda_maze_2_stone_b   #7 歌の石 3; when the third verse is joined the vines untangle → obj_forest_3
//   verda_maze_2_vine      the つるの壁 (examine while closed)
//   verda_maze_twist       trails that end in mist move the party (「森が道を変える」), until the clear
//   elder_tree_2_fine      #9 the girl in grey → the story's story_fine_forest (once forest_fine)
//   elder_tree_2_boss      #9–#10 根食らい (tr_b_rooteater) → the song → エルム → ev.clearRegion('r_forest')
//                          → a night at the inn in fern → story_after_clear (§10.8.0-3)
//   elder_tree_2_elm       森の主エルム by the altar after the clear
//   elder_tree_2_altar     the root altar (examine)
// The three stones can be read in any order; whichever is the third opens the vines.
(function (R) {
  'use strict';
  const E = R.DB.events;
  const REGION = 'r_forest';
  const RO = { region: REGION };
  const TOP = { pos: 'top' }; // the message window at the top: the scene below stays in view

  Object.assign(R.DB.objectives, {
    obj_forest_1: { text: '迷いの森の奥にある、\n千年樹を目指そう。' },
    obj_forest_2: { text: '迷いの森で、歌の刻まれた\n石を三つ探そう。' },
    obj_forest_3: { text: '千年樹の中へ入り、\n根の奥を目指そう。' },
  });

  const VERSES = ['♪　眠れ森の主、千の年輪に', '♪　約束の歌を、葉ずれに乗せて', '♪　火の夜を忘れず、緑を守れ'];
  const SONG = VERSES.join('\n');
  const regionObj = () => (R.Game.regionObj || {})[REGION] || null;
  /** obj_forest_2 unless the vines are already open (never step an objective backwards) */
  function toStones(ev) { if (regionObj() !== 'obj_forest_3' && !ev.cleared(REGION)) ev.setObjective('obj_forest_2', RO); }

  // ------------------------------------------------------------ fern: the first visit
  E.fern_enter = {
    meta: { needs: [], gives: ['flag:forest_start'], calls: ['fern_intro'] },
    run: async (ev) => {
      if (ev.flag('forest_start') || ev.flag('forest_boss') || ev.cleared(REGION)) return;
      await ev.call('fern_intro');
    },
  };

  E.fern_intro = {
    meta: { needs: [], gives: ['flag:forest_start'] },
    run: async (ev) => {
      if (ev.flag('forest_start') || ev.flag('forest_boss')) return;
      const h = ev.npc('hanna_gate');
      h.face('player');
      await ev.say('……旅の方？　ようこそ、\n森の村フェルンへ。');
      await ev.say('わたしはハンナ。\nこの村の長老をしているの。');
      await ev.say('森の奥へ入った木こりたちが、\n三日も戻らないの。');
      await ev.say('森が道を変えてしまうのよ。\n千年樹の歌を忘れてから……。');
      await ev.say('森のいちばん奥には、\n千年樹という大きな木があって、\n森の主さまが眠っているの。');
      await ev.say('昔は毎年、夏至の祭りで、\n主さまに歌をささげたものよ。\n……その歌を、誰も思い出せない。');
      await ev.say('歌い手のリタなら、何か\n知っているかもしれないわ。\n南東の、木の上の家よ。');
      ev.closeMessage();
      ev.setFlag('forest_start');
      ev.setObjective('obj_forest_1', RO);
      if (h.visible) { await h.walk('UUUU'); h.hide(); }
      ev.refresh();
    },
  };

  // ------------------------------------------------------------ fern: 歌い手リタ
  E.fern_rita = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const n = ev.var('forest_verses');
      if (ev.check({ postgame: true })) {
        await ev.say('語り部さんの年代記、\n読ませてもらったの。\n今度は、その旅の歌を作るわ。');
        return;
      }
      if (ev.cleared(REGION)) {
        await ev.say('{hero}！　聞いて。\n歌を、最後まで歌えるの！');
        ev.closeMessage();
        await ev.caption(SONG, { frames: 240 });
        await ev.say('夏至の祭りでは、わたしが\n歌うことになったの。\nおばあちゃんみたいにね。');
        return;
      }
      if (n >= 3) {
        await ev.say('三つの石の歌が、\nつながったのね！');
        await ev.say('千年樹へ行って、\n森の主さまに届けて。\n……お願い。');
        return;
      }
      if (n > 0) {
        await ev.say('歌の石を見つけたのね！\n……ねえ、聞かせて。');
        await ev.say('残りの石も、きっと\n迷いの森のどこかに\nあるはずよ。');
        toStones(ev);
        return;
      }
      if (!ev.flag('fern_rita')) {
        await ev.say('♪　眠れ森の主、千の年輪に……。\nだめ。この先が、\nどうしても出てこないの。');
        await ev.say('歌は最初の一節しか\n思い出せないの。');
        await ev.say('森の道しるべの石に、歌が刻まれてるって、\nおばあちゃんが言ってた。');
        await ev.say('道しるべの石は、全部で三つ。\n歌も、三つに分けて\n刻んであるんだって。');
        await ev.say('去年の春、記録院の人が来て、\n歌を書き写していったの。\nそれから、歌が出てこなくて……。');
        ev.setFlag('fern_rita');
        toStones(ev);
        return;
      }
      await ev.say('森の道しるべの石を探して。\n迷いの森の中に、\n三つあるはずよ。');
      await ev.say('去年の春、記録院の人が来て、\n歌を書き写していったの。\nそれから、歌が出てこなくて……。');
      toStones(ev);
    },
  };

  // ------------------------------------------------------------ fern: 長老ハンナ and the reward
  E.fern_hanna = {
    meta: { needs: ['region:r_forest'], gives: ['item:ac_tale_forest', 'flag:fern_hanna_reward'], calls: ['fern_hanna_reward'] },
    run: async (ev) => {
      if (ev.cleared(REGION) && !ev.flag('fern_hanna_reward')) { await ev.call('fern_hanna_reward'); return; }
      if (ev.check({ postgame: true })) {
        await ev.say('語り部さん、また来てくれたのね。\n千年樹の歌は、今では\n子どもたちの子守歌よ。');
      } else if (ev.flag('final_open')) {
        await ev.say('内海の霧が晴れたそうね。\n森の主さまも、きっと\nあなたを見守っているわ。');
      } else if (ev.cleared(REGION)) {
        await ev.say('夏至の祭りには、また\n千年樹の歌を歌うわ。\n今度は、決して忘れない。');
      } else if (ev.flag('forest_mid')) {
        await ev.say('羽虫の化け物を倒したの？\n森の奥から、ほんの少し\n風が通るようになったわ。');
      } else if (ev.flag('forest_dan')) {
        await ev.say('ダンを連れ帰ってくれたのね。\n……でも、ほかの木こりたちは\nまだ森の奥にいるの。');
      } else {
        await ev.say('森の奥の千年樹には、\n森の主エルムさまが\n眠っているの。');
        await ev.say('歌い手のリタにも、\n話を聞いてあげて。\n南東の、木の上の家よ。');
      }
    },
  };

  E.fern_hanna_reward = {
    meta: { needs: ['region:r_forest'], gives: ['item:ac_tale_forest', 'flag:fern_hanna_reward'] },
    run: async (ev) => {
      if (ev.flag('fern_hanna_reward')) return;
      const h = ev.npc('hanna');
      h.face('player');
      await ev.say('{hero}、本当にありがとう。\n森が、また歌っているわ。');
      await ev.say('木こりたちも、みんな\n帰ってきた。村に、\n笑い声が戻ったわ。');
      await ev.say('これは、村に伝わる首飾り。\n木霊が宿っていると\n言われているの。');
      ev.closeMessage();
      await ev.give('ac_tale_forest');
      ev.setFlag('fern_hanna_reward');
      await ev.say('森の主さまの加護が、\nあなたの旅を守りますように。');
    },
  };

  // ------------------------------------------------------------ the song stones
  async function songStone(ev, id, verse) {
    if (ev.flag(id)) {
      await ev.say('歌の刻まれた、\n道しるべの石だ。');
      ev.closeMessage();
      await ev.caption(verse, { frames: 150 });
      return;
    }
    await ev.say('コケむした道しるべの石だ。\n表に、歌が刻まれている……。');
    ev.closeMessage();
    ev.sfx('bell');
    await ev.caption(verse, { frames: 200 });
    ev.setFlag(id);
    const n = Math.min(3, ev.var('forest_verses') + 1);
    ev.setVar('forest_verses', n);
    ev.sfx('quill');
    await ev.say('{hero}は、歌の一節を\n年代記に書き留めた。');
    if (n >= 3) {
      ev.closeMessage();
      ev.sfx('magic');
      await ev.flash('#e0ffd8', 14);
      await ev.say('三つの石の歌がつながった。\n千年樹へ続く道の、\nつるがほどけていく……。');
      ev.setObjective('obj_forest_3', RO);
      ev.refresh();
    } else {
      await ev.say(n === 1 ? '歌の石は、あとふたつ……。' : '歌の石は、あとひとつ……。');
      toStones(ev);
    }
  }
  E.verda_maze_1_stone = {
    meta: { needs: [], gives: ['var:forest_verses+1', 'flag:verda_maze_1_stone'] },
    run: (ev) => songStone(ev, 'verda_maze_1_stone', VERSES[0]),
  };
  E.verda_maze_2_stone_a = {
    meta: { needs: [], gives: ['var:forest_verses+1', 'flag:verda_maze_2_stone_a'] },
    run: (ev) => songStone(ev, 'verda_maze_2_stone_a', VERSES[1]),
  };
  E.verda_maze_2_stone_b = {
    meta: { needs: [], gives: ['var:forest_verses+1', 'flag:verda_maze_2_stone_b'] },
    run: (ev) => songStone(ev, 'verda_maze_2_stone_b', VERSES[2]),
  };

  E.verda_maze_2_vine = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      await ev.say('太いつるが、網のように\n道をふさいでいる。');
      await ev.say(ev.var('forest_verses') > 0
        ? '千年樹の歌がそろえば、\nほどけるかもしれない……。'
        : 'つるの向こうに、とてつもなく\n大きな木の幹が見える。');
    },
  };

  // ------------------------------------------------------------ the twisting paths of the maze (until the clear)
  // A step event at the end of a trail; the destination is on the map's event object: {to:{x, y, dir, back}}.
  E.verda_maze_twist = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const m = R.Field && R.Field.map;
      const c = ev.ctx || {};
      const e = m && m.events.find((q) => q.id === 'verda_maze_twist' && q.x === c.x && q.y === c.y);
      if (!e || !e.to || ev.cleared(REGION)) return;
      await ev.say('キノコの輪を踏んだとたん、\n足元から白い霧が\nわき上がった……。');
      ev.closeMessage();
      ev.sfx('wind');
      await ev.fadeOut(24);
      ev.player.setPos(e.to.x, e.to.y, e.to.dir || 'down');
      await ev.wait(12);
      await ev.fadeIn(24);
      await ev.say(e.to.back ? '気がつくと、元の道に\n戻されていた……。' : '気がつくと、見覚えのない\n場所に立っていた……。');
    },
  };

  // ------------------------------------------------------------ 木こりダン
  E.verda_maze_1_dan = {
    meta: { needs: [], gives: ['flag:forest_dan'] },
    run: async (ev) => {
      if (ev.flag('forest_dan')) return;
      const d = ev.npc('dan');
      d.face('player');
      await ev.say('おお、人か！　助かった……。\nおれはダン。\nフェルンの木こりだ。');
      await ev.say('仲間とはぐれちまってな。\n森の道が、いつの間にか\n変わっちまうんだ。');
      await ev.say('奥に、でっかい羽虫がいて\n進めねえんだ。');
      await ev.say('あいつのまく粉を吸うと、\n頭がぼうっとして、\n来た道も忘れちまう……。');
      await ev.say('おれは一度、村へ帰る。\nあんたも、気をつけてな。');
      ev.closeMessage();
      ev.setFlag('forest_dan');
      await ev.fadeOut(12);
      d.hide();
      await ev.fadeIn(12);
      await ev.say('ダンは、村へ帰っていった。');
    },
  };

  // ------------------------------------------------------------ ダストウィング (mid boss)
  E.verda_maze_2_boss = {
    meta: { needs: [], gives: ['flag:forest_mid'] },
    run: async (ev) => {
      if (ev.flag('forest_mid')) return;
      await ev.say('バサッ……バサッ……。\n重い羽音が、森の空気を\nふるわせている。');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(16, 2);
      await ev.say('白い粉をまき散らしながら、\n巨大な羽虫が舞い降りた！');
      const r = await ev.battle('tr_b_moth');
      if (r !== 'win') return false;
      ev.setFlag('forest_mid');
      ev.npc('boss').hide();
      await ev.wait(16);
      await ev.say('ダストウィングは、白い粉に\nなって、消えていった。');
      await ev.say('森の霧がうすれて、\n奥へ続く道が見えた。');
    },
  };

  // ------------------------------------------------------------ the girl in grey (§10.9.4, the story's script)
  E.elder_tree_2_fine = {
    meta: { needs: [], gives: ['flag:forest_fine'], calls: ['story_fine_forest'] },
    run: async (ev) => {
      if (ev.flag('forest_fine')) return;
      if (E.story_fine_forest) { await ev.call('story_fine_forest'); ev.setFlag('forest_fine'); return; }
      // stand-in until the story's script is in (the §10.9.4 lines)
      const f = ev.npc('fine');
      if (!f.visible) return;
      await ev.wait(12);
      f.face('player');
      await ev.say('この根の奥に、伝承の核があるわ。\n……根を食べているものがいる。');
      const t = ev.tier();
      const fade = t >= 3;
      if (t >= 6) await ev.say('……もう、あまり時間がないの。');
      else if (t >= 3) await ev.say('わたしのことは気にしないで。\n先へ進みなさい。');
      else await ev.say('……気をつけて。');
      ev.closeMessage();
      if (fade) await ev.caption('フィーネの足元が、\n透けて見えた。', { frames: 120 });
      ev.sfx('magic');
      await ev.flash('#e8ecff', 10);
      f.hide();
      ev.setFlag('forest_fine');
    },
  };

  // ------------------------------------------------------------ 根食らい and the clear (§10.8.0-3/4)
  E.elder_tree_2_boss = {
    meta: {
      needs: [],
      gives: ['flag:forest_boss', 'region:r_forest', 'item:k_page_forest'],
      warp: { to: 'fern', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.cleared(REGION)) return;
      const elm = ev.npc('elm');
      if (!ev.flag('forest_boss')) {
        await ev.say('ガリッ……ガリッ……。\n何かが、根をかじる音がする。');
        await ev.say('白くぶよぶよした巨大な虫が、\n千年樹の根に食らいついている！');
        ev.closeMessage();
        ev.sfx('roar');
        await ev.shake(20, 3);
        const r = await ev.battle('tr_b_rooteater');
        if (r !== 'win') return false;
        ev.setFlag('forest_boss');
        ev.npc('boss').hide();
        elm.hide();
        await ev.wait(16);
        await ev.say('根食らいは、白い紙くずの\nように崩れて、消えていった。');
      } else elm.hide();
      ev.closeMessage();
      // step down into the heart of the roots, so the altar (and who appears there) is in view
      const down = Math.max(0, 25 - (ev.player.y | 0));
      if (down && ev.player.x >= 21 && ev.player.x <= 23) await ev.player.walk('D'.repeat(down));
      ev.player.face('down');
      await ev.wait(20);
      await ev.say('千年樹の根が、かすかに\nふるえている……。');
      await ev.say('{hero}は、三つの石の歌を\nつないで語った。');
      ev.closeMessage();
      ev.sfx('quill');
      await ev.caption(SONG, { frames: 260 });
      ev.sfx('light');
      await ev.flash('#e8ffd8', 16);
      await ev.say('根が、やわらかな緑色に\n光りはじめた。');
      ev.closeMessage();
      ev.sfx('magic');
      await ev.flash('#ffffff', 12);
      elm.show();
      elm.face('player');
      await ev.wait(30);
      await ev.say('……思い出した。わたしは、\nこの森を守ると誓ったのだった。', TOP);
      await ev.say('千年前の火の夜……。\n燃える森を前に、わたしは\nこの木に宿り、火を封じた。', TOP);
      await ev.say('村の者たちは、歌で\nわたしの眠りを守ると\n約束してくれた。', TOP);
      await ev.say('歌が絶えて、わたしは約束を\n忘れた。森を閉ざし、\n人を迷わせてしまった……。', TOP);
      await ev.say('語り部よ、礼を言う。', TOP);
      await ev.say('森の道は、もう閉ざさぬ。\n木こりたちも、じきに\n村へ帰れるだろう。', TOP);
      ev.closeMessage();
      await ev.clearRegion(REGION);
      await ev.wait(20);
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('fern', 'inn', { fade: false });
      if (E.story_after_clear) await ev.call('story_after_clear');
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(30);
    },
  };

  // ------------------------------------------------------------ after the clear: 森の主エルム, the altar
  E.elder_tree_2_elm = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.check({ postgame: true })) {
        await ev.say('語り部よ。森はもう、\n迷わぬ。……また、歌を\n聞かせに来ておくれ。');
        return;
      }
      if (ev.tier() >= 6) {
        await ev.say('世界のあちこちで、白い闇が\n広がっているのを感じる。\n……語り部よ、急ぐがよい。');
        return;
      }
      await ev.say('森の道は、もう閉ざさぬ。\n夏至の歌も、村の者たちが\nまた歌ってくれるだろう。');
      await ev.say('ただ、迷いの森の魔物は、\nわたしにも鎮められぬ。\n腕を磨くには、よいだろう。');
    },
  };

  E.elder_tree_2_altar = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.flag('forest_boss')) await ev.say('根に囲まれた、古い祭壇だ。\n光るキノコが、ぼんやりと\nあたりを照らしている。');
      else await ev.say('根に囲まれた、古い祭壇だ。\nかじられた根から、\n白い粉がこぼれている。');
    },
  };
})(window.RPG);
