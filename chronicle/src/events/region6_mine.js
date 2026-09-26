// Region 6 ガルド山地 (R6) — the events of 深き坑道 (DESIGN §10.8.7 #3–#9, §10.8.0-3〜6).
//   deep_mine_1_miner  #3 miner 1 in the cave-in (mine_rescued +1; he goes home to dovan)
//   deep_mine_2_miner  #4 miner 2 in the flooded drift (mine_rescued +1)
//   deep_mine_2_boss   #5 岩食らい (tr_b_rockeater) blocks the side tunnel → mine_mid
//   deep_mine_2_pip    #6 Pip gives 誓いのハンマー (k_oath_hammer) → obj_mine_2 (mine_rescued +1)
//   deep_mine_3_door   #7 七の層の岩戸: without the hammer the reason; with it the door rolls away
//                      (flag mine_door; the tilePatch needs {item:'k_oath_hammer', flag:'mine_door'})
//   deep_mine_3_fine   #8 Fine before the warden's hall: story_fine_mine (story, A19); the same
//                      lines of §10.9.4 play here while that script is not registered
//   deep_mine_3_boss   #8–9 鉄の番人 (tr_b_ironwarden) → the oath is sung → ev.clearRegion('r_mine')
//                      → a night at the inn in Dovan → story_after_clear (§10.8.0-3)
(function (R) {
  'use strict';
  const E = R.DB.events;

  /** a rescued miner leaves for town: fade, hide, count (+ the first objective if the town was skipped) */
  async function goHome(ev, npcId, flag, line) {
    ev.closeMessage();
    await ev.fadeOut(24);
    ev.npc(npcId).hide();
    await ev.wait(10);
    await ev.fadeIn(24);
    await ev.say(line);
    const n = Math.min(3, (ev.var('mine_rescued') | 0) + 1);
    ev.setVar('mine_rescued', n);
    ev.setFlag(flag);
    await ev.say('助けた鉱夫　' + n + '/3');
    const g = R.Game || {};
    if (!(g.regionObj && g.regionObj.r_mine)) ev.setObjective('obj_mine_1', { region: 'r_mine' });
  }

  // ------------------------------------------------------------ #3 鉱夫1（落盤の奥）
  E.deep_mine_1_miner = {
    meta: { needs: [], gives: ['flag:deep_mine_1_miner', 'var:mine_rescued+1'] },
    run: async (ev) => {
      if (ev.flag('deep_mine_1_miner')) return;
      await ev.say('……だ、誰だ？\n町の人じゃ、ないな。');
      await ev.say('助けに来てくれたのか！\n落盤で、足をやられちまって\n動けなかったんだ……。');
      ev.sfx('heal');
      await ev.flash('#ffffff', 6);
      await ev.say('……ありがとう。これなら、\n町まで歩いて帰れそうだ。');
      await ev.say('奥には、まだ二人いるはずだ。\nピップのやつは、じいさんの\nハンマーを持って、奥へ……。');
      await ev.say('気をつけてくれ。鉄の化け物は、\n七の層の下から出てきたんだ。');
      await goHome(ev, 'miner1', 'deep_mine_1_miner', '鉱夫は、町へ帰っていった。');
    },
  };

  // ------------------------------------------------------------ #4 鉱夫2（水の出た坑道）
  E.deep_mine_2_miner = {
    meta: { needs: [], gives: ['flag:deep_mine_2_miner', 'var:mine_rescued+1'] },
    run: async (ev) => {
      if (ev.flag('deep_mine_2_miner')) return;
      await ev.say('助かった……！\n水が出て、帰り道が\n分からなくなってたんだ。');
      await ev.say('ピップを見なかったか？\nあいつ、じいさんのハンマーを\n握りしめて、東の横穴へ……。');
      await ev.say('横穴の前には、岩を食う\n化け物が居座ってる。\nどうか、あいつを頼む。');
      await goHome(ev, 'miner2', 'deep_mine_2_miner', '鉱夫は、町へ帰っていった。');
    },
  };

  // ------------------------------------------------------------ #5 中ボス 岩食らい
  E.deep_mine_2_boss = {
    meta: { needs: [], gives: ['flag:mine_mid'] },
    run: async (ev) => {
      if (ev.flag('mine_mid')) return;
      await ev.say('ガリ、ガリ、ガリ……。\n岩をかみくだく音がする。');
      await ev.say('巨大な化け物が、横穴の口を\nふさいでいる……！');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(18, 3);
      const r = await ev.battle('tr_b_rockeater');
      if (r !== 'win') return false;
      ev.npc('boss').hide();
      ev.setFlag('mine_mid');
      ev.refresh();
      ev.sfx('shake');
      await ev.shake(12, 2);
      await ev.say('岩食らいが崩れ落ち、\n横穴の口が開いた。');
      await ev.say('……だ、誰か、そこにいるの？');
    },
  };

  // ------------------------------------------------------------ #6 ピップと誓いのハンマー
  E.deep_mine_2_pip = {
    meta: { needs: ['flag:mine_mid'], gives: ['flag:deep_mine_2_pip', 'item:k_oath_hammer', 'var:mine_rescued+1'] },
    run: async (ev) => {
      if (ev.flag('deep_mine_2_pip')) return;
      const p = ev.npc('pip');
      p.face('player');
      await ev.say('た、助かった……！\nぼく、ピップ。\n鉱夫の見習いだよ。');
      await ev.say('鉄の化け物を止めなきゃって、\n思ったんだ。でも、岩食らいに\n出口をふさがれて……。');
      await ev.say('じいちゃんの形見のハンマーだ。柄に、\n誓いの言葉が彫ってある。');
      await ev.say('七の層の扉は、これで開くって聞いた。');
      await ev.say('ぼくじゃ、番人のところまで\n行けない。これ、使って。\nじいちゃんも、きっとそう言うよ。');
      const ok = await ev.give('k_oath_hammer');
      if (!ok) return false;
      await ev.say('ぼくは町に帰るよ。\nばあちゃんが心配してるから。');
      ev.setObjective('obj_mine_2', { region: 'r_mine' });
      await goHome(ev, 'pip', 'deep_mine_2_pip', 'ピップは、町へ帰っていった。');
    },
  };

  // ------------------------------------------------------------ #7 七の層の岩戸
  E.deep_mine_3_door = {
    meta: { needs: ['item:k_oath_hammer'], gives: ['flag:mine_door'] },
    run: async (ev) => {
      if (ev.flag('mine_door')) return;
      if (!ev.has('k_oath_hammer')) {
        await ev.say('大きな丸い岩が、\n道をふさいでいる。');
        await ev.say('岩の真ん中に、ハンマーの形の\nくぼみが彫られている……。');
        return false;
      }
      await ev.say('岩戸の真ん中に、ハンマーの形の\nくぼみが彫られている。');
      await ev.say('{hero}は、誓いのハンマーで\n岩戸を打ち鳴らした。');
      ev.closeMessage();
      ev.sfx('bell');
      await ev.flash('#fff4d0', 10);
      await ev.wait(20);
      ev.sfx('bell');
      await ev.flash('#fff4d0', 10);
      await ev.say('柄に彫られた誓いの言葉が、\nかすかに光った。');
      ev.closeMessage();
      ev.sfx('unlock');
      await ev.shake(30, 2);
      ev.setFlag('mine_door');
      ev.refresh();
      await ev.say('低い音を立てて、\n岩戸が転がっていく……！');
    },
  };

  // ------------------------------------------------------------ #8 フィーネ（§10.9.4）
  const FINE_LINE = '誓いは、破られても消えない。\n忘れられたときに、消えるの。';
  async function fineFallback(ev) {
    const f = ev.npc('fine');
    await ev.wait(12);
    f.face('player');
    await ev.wait(16);
    await ev.say(FINE_LINE);
    const t = ev.tier();
    if (t <= 2) {
      await ev.say('……気をつけて。');
    } else {
      await ev.say(t >= 6 ? '……もう、あまり時間がないの。' : 'わたしのことは気にしないで。\n先へ進みなさい。');
      ev.closeMessage();
      await ev.caption('フィーネの足元が、\n透けて見えた。');
    }
    ev.closeMessage();
    ev.sfx('magic');
    await ev.flash('#e8ecff', 10);
    f.hide();
  }
  E.deep_mine_3_fine = {
    meta: { needs: [], gives: ['flag:mine_fine'] },
    run: async (ev) => {
      if (ev.flag('mine_fine') || ev.flag('mine_boss')) return;
      if (R.DB.events.story_fine_mine) await ev.call('story_fine_mine');
      else await fineFallback(ev);
      if (ev.npc('fine').visible) ev.npc('fine').hide();
      ev.setFlag('mine_fine');
    },
  };

  // ------------------------------------------------------------ #8–9 鉄の番人 → 誓いの歌 → 第6章
  E.deep_mine_3_boss = {
    meta: {
      needs: ['item:k_oath_hammer', 'flag:mine_door'],
      gives: ['flag:mine_boss', 'region:r_mine'],
      warp: { to: 'dovan', spawn: 'inn' },
      calls: ['story_after_clear'],
    },
    run: async (ev) => {
      if (ev.flag('mine_boss')) return;
      const b = ev.npc('boss');
      await ev.say('ゴウン……ゴウン……。\n地の底から、鉄を打つような\n音が響いてくる。');
      ev.closeMessage();
      ev.sfx('roar');
      await ev.shake(20, 3);
      await ev.say('……誓いを忘れた者よ。\n七の層より下を掘った者よ。');
      await ev.say('鍛冶神との約束により、\nわれは、この山を守る。\n去らぬなら、打ち砕くのみ。');
      ev.closeMessage();
      const r = await ev.battle('tr_b_ironwarden');
      if (r !== 'win') return false;
      // the oath is retold
      await ev.say('鉄の番人が、ひざをついた。');
      await ev.say('{hero}は誓いのハンマーを打ち鳴らし、\n鍛冶神の誓いを唱えた。');
      ev.closeMessage();
      ev.sfx('bell');
      await ev.flash('#fff4d0', 12);
      const song = (R.Reg6 && R.Reg6.SONG) || [];
      for (const s of song) await ev.caption(s, { frames: 210 });
      await ev.say('……誓いは、まだ生きていたか。ならば、\nわれは眠ろう。');
      ev.closeMessage();
      ev.sfx('holy');
      await ev.flash('#ffffff', 16);
      b.hide();
      ev.setFlag('mine_boss');
      ev.refresh();
      await ev.wait(20);
      await ev.say('鉄の番人は、光の粒になって\n地の底へ沈んでいった。');
      ev.sfx('quill');
      await ev.say('{hero}は、\n誓いの歌を年代記に書き記した。');
      ev.closeMessage();
      await ev.clearRegion('r_mine');
      // a night at the inn in Dovan, then the story's morning scene (§10.8.0-3, §10.9.2)
      await ev.wait(20);
      await ev.fadeOut(48);
      await ev.caption('その夜は、町の宿で眠った。');
      ev.heal();
      await ev.warp('dovan', 'inn', { fade: false });
      if (R.DB.events.story_after_clear) await ev.call('story_after_clear');
      if (R.Engine.fadeAlpha > 0) await ev.fadeIn(40);
      ev.bgm();
    },
  };

})(window.RPG);
