// Region 6 ガルド山地 (R6) — the objectives obj_mine_* and the town events of 鉱山都市ドヴァン
// (DESIGN §10.8.7, §10.13.8).
//   dovan_intro        #1 onEnter (once, flag mine_start): 鉱山長ボルグ meets the party at the
//                      town's edge → obj_mine_1
//   dovan_borg         ボルグ in the mine office: the plea and ロウェルの痕跡 before the clear,
//                      his renewed oath and the reward afterwards
//   dovan_borg_reward  the one-off reward 誓いの腕輪 (ac_tale_mine, §8.8), once
//   dovan_helga        #2 鍛冶師ヘルガ: the oath song and why Borg dug below the seventh layer
//   dovan_bard         the tavern singer: the forgotten oath song, sung whole after the clear
(function (R) {
  'use strict';
  const E = R.DB.events;
  const NONE = { needs: [], gives: [] };
  const NUM = ['', '一', '二', '三'];

  Object.assign(R.DB.objectives, {
    obj_mine_1: { text: '深き坑道に閉じ込められた\n鉱夫たちを助けよう。' },
    obj_mine_2: { text: '誓いのハンマーを持って、\n七の層の扉を開けよう。' },
  });

  // the oath song (the region's lore, retold at the boss; also sung in the tavern after the clear)
  const SONG = [
    '♪　火をくれた神に誓う\n七の層より下は掘らぬ',
    '♪　鉄の番人よ、眠れ\nわれらの歌の、とどく限り',
  ];
  R.Reg6 = R.Reg6 || {};
  R.Reg6.SONG = SONG;

  /** a walkable free cell 2 steps from the player (for Borg to stand on), or null */
  function spotNearPlayer(ev) {
    const M = R.Field && R.Field.map;
    if (!M || !M.walkable) return null;
    const px = ev.player.x, py = ev.player.y;
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -1], [1, 0], [-1, 0]]) {
      const x = px + dx, y = py + dy;
      if (M.inMap(x, y) && M.walkable(x, y) && !(M.npcAt && M.npcAt(x, y))) return { x, y };
    }
    return null;
  }

  // ------------------------------------------------------------ #1 ボルグ、町の入口で
  E.dovan_intro = {
    meta: { needs: [], gives: ['flag:mine_start'] },
    run: async (ev) => {
      if (ev.flag('mine_start')) return;
      if (ev.map !== 'dovan') return;
      const b = ev.npc('borg_gate');
      if (b.visible && (Math.abs(b.x - ev.player.x) + Math.abs(b.y - ev.player.y)) > 4) {
        const s = spotNearPlayer(ev);
        if (s) b.setPos(s.x, s.y);
      }
      await ev.wait(24);
      await ev.say('おい、そこの旅の人！');
      ev.closeMessage();
      if (b.visible && b.y < ev.player.y - 2) await b.walk('D');
      b.face('player');
      await ev.say('鉱山長のボルグだ。\nよそ者に頼むのも情けねえが、\n話を聞いてくれ。');
      await ev.say('坑道の奥で、\n鉄の化け物が暴れてる。');
      await ev.say('若いのが三人、\n閉じ込められたままだ。');
      await ev.say('おれたちのつるはしじゃ、\nあの化け物には歯が立たねえ。');
      await ev.say('深き坑道は、町の北東の山だ。\nどうか、あいつらを……頼む。');
      await ev.say('おれは鉱山事務所にいる。\n何かあったら、寄ってくれ。');
      ev.closeMessage();
      if (b.visible) {
        await b.walk('UUUU');
        b.hide();
      }
      ev.setFlag('mine_start');
      ev.setObjective('obj_mine_1', { region: 'r_mine' });
      ev.refresh();
    },
  };

  // ------------------------------------------------------------ ボルグ（鉱山事務所）
  E.dovan_borg = {
    meta: NONE,
    run: async (ev) => {
      if (ev.cleared('r_mine')) {
        if (!ev.flag('dovan_borg_reward')) { await ev.call('dovan_borg_reward'); return; }
        if (ev.check({ postgame: true })) {
          await ev.say('誓いの歌は、孫の代まで\n伝えていくさ。\n二度と忘れねえようにな。');
        } else if (ev.flag('final_open')) {
          await ev.say('内海の霧が晴れたってな。\n{hero}、あんたの行く先にも\n鍛冶神さまのご加護を。');
        } else {
          await ev.say('もう七の層の下は掘らねえ。\n誓いの碑も、彫り直させたよ。');
          await ev.say('借金は、町のみんなと\n少しずつ返していく。\nまっとうにな。');
        }
        return;
      }
      if (ev.has('k_oath_hammer')) {
        await ev.say('……そのハンマーは、ピップの\nじいさんの！　そうか、\nあいつが渡したのか。');
        await ev.say('七の層の岩戸は、番人の\n眠る所の入口だ。誓いを知る者に\nしか開かねえと聞く。');
        await ev.say('あそこを開けて、番人を\n起こしたのは、おれなんだ。\n……頼む、{hero}。');
        return;
      }
      const n = ev.var('mine_rescued') | 0;
      if (n >= 1) {
        await ev.say('若いのを、' + NUM[Math.min(n, 3)] + '人も助けてくれた\nそうだな。礼を言う。');
        if (n < 3) await ev.say('あと' + NUM[3 - n] + '人だ。\nどうか、頼む……。');
        return;
      }
      await ev.say('坑道の奥に、若いのが三人。\n……全部、おれのせいだ。');
      await ev.say('借金を返すために、七の層より\n下を掘らせた。大きな鉱脈が\nあると、踏んだんだ。');
      await ev.say('記録院が、誓いの歌を\n写していった。\nそれからよ、うちの若いのが\n誰も歌わなくなったのは。');
      await ev.say('歌を忘れたら、誓いまで\n忘れちまった。\n……情けねえ話さ。');
    },
  };
  E.dovan_borg_reward = {
    meta: { needs: ['region:r_mine'], gives: ['flag:dovan_borg_reward', 'item:ac_tale_mine'] },
    run: async (ev) => {
      if (ev.flag('dovan_borg_reward')) return;
      await ev.say('{hero}。……番人は、\nまた眠ったんだな。');
      await ev.say('坑道の奥から、誓いの歌が\n聞こえた気がしたよ。\nガキのころ、親父に教わった歌だ。');
      await ev.say('おれは、もう七の層の下は\n掘らねえ。鍛冶神さまに、\nもう一度誓うぜ。');
      await ev.say('これを持っていってくれ。\n誓いの言葉を刻んだ腕輪だ。\n親父の形見さ。');
      const ok = await ev.give('ac_tale_mine');
      if (!ok) return false;
      await ev.say('そいつを見るたびに、\nおれも誓いを思い出す。\n……ありがとうよ。');
      ev.setFlag('dovan_borg_reward');
    },
  };

  // ------------------------------------------------------------ #2 鍛冶師ヘルガ
  E.dovan_helga = {
    meta: NONE,
    run: async (ev) => {
      if (ev.check({ postgame: true })) {
        await ev.say('ピップのやつが、弟子入りに\n来たよ。じいさんのハンマーを\n握りしめてね。');
        await ev.say('あの子なら、いい鍛冶屋に\nなるさ。あたしが保証するよ。');
        return;
      }
      if (ev.cleared('r_mine')) {
        await ev.say('炉の火が、いい音で\n鳴るようになったよ。\n山が落ち着いた証拠さ。');
        await ev.say('ボルグの借金返しに、\nあたしも手を貸すことにした。\n鍛冶場の品を増やしたから、\n見ていきな。');
        if (ev.tier() >= 4 && ev.tier() < 7) await ev.say('記録院の書記が、うちの\n古い型紙を欲しがったがね。\n追い返してやったよ。');
        return;
      }
      if (ev.has('k_oath_hammer')) {
        await ev.say('そのハンマー、ピップの\nじいさんのだね。柄の文字が\n読めるかい。');
        await ev.say('「火をくれた神に誓う」\n……誓いの言葉さ。');
        await ev.say('七の層の岩戸は、誓いを\n知る者にしか開かないって\n言い伝えだ。行っておいで。');
        return;
      }
      await ev.say('昔はハンマーを振るうたびに、\n誓いの歌を歌ったもんさ。\n『七の層より下を掘るな』ってね。');
      await ev.say('借金を返すために、\nボルグは七の層の下を\n掘らせたんだよ。');
      await ev.say('あたしは止めたんだがね。\n……山には、山の約束が\nあるってのに。');
    },
  };

  // ------------------------------------------------------------ 酒場の歌い手
  E.dovan_bard = {
    meta: NONE,
    run: async (ev) => {
      if (ev.cleared('r_mine')) {
        await ev.say('誓いの歌、全部思い出したんです！\n聞いてください。');
        ev.closeMessage();
        ev.sfx('bell');
        for (const s of SONG) await ev.caption(s, { frames: 180 });
        await ev.say('鉱夫たちが、また歌いながら\n坑道に入るようになりました。\nいい歌でしょう？');
        return;
      }
      await ev.say('♪　火をくれた神に誓う\n七の層より、ええと……。');
      await ev.say('……あれ？　続きが、\nどうしても出てこない。');
      await ev.say('町の年寄りも、続きを\n覚えていないんです。\n歌だけが、白紙になったみたいに。');
    },
  };
})(window.RPG);
