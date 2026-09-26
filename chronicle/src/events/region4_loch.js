// Region 4 グレイモア湿原 (r_marsh) — objectives and the events of 水辺の町ロッホ (DESIGN §10.8.5).
// Owner: reg-4 (R4).
//
// Objectives (「次の目的」, §10.13.8 — the region's own prefix obj_marsh_*, set with {region:'r_marsh'}):
//   obj_marsh_1  #1 visit the witch of the fog manor        (loch_intro)
//   obj_marsh_2  #4 take the bell key to the bog             (mist_manor_2_melda)
//   obj_marsh_3  #5 the fog gathered in the heart of the bog (the third bell)
//
// Events here:
//   loch_intro          #1 onEnter of loch (once, flag marsh_start): Emma and the angry townsman
//   loch_emma_gate      talking to them at the gate (before the intro has run) runs the intro
//   loch_tobias         #2 鐘つきトビアス: the bell song he cannot remember, Rowell's trace (before the
//                       clear), the bells in the bog (with the key); after the clear → loch_tobias_reward
//   loch_tobias_reward  the region's reward (once): ac_tale_marsh 朝の鐘の守り (§8.8)
//   loch_bard           the tavern's bard (the bell song comes back after the clear)
(function (R) {
  'use strict';
  const E = R.DB.events;
  const K = R.Reg4 = R.Reg4 || {};

  Object.assign(R.DB.objectives, {
    obj_marsh_1: { text: '東の霧の館に住むという\n魔女を訪ねよう。' },
    obj_marsh_2: { text: '鐘の鍵を持って、\n鐘沈みの沼へ向かおう。' },
    obj_marsh_3: { text: '霧が集まった沼の中心へ\n向かおう。' },
  });

  /** the bell song Melda teaches (sung again after the clear) */
  K.BELL_SONG = '♪　鳴れよ、七つの鐘\n霧は沼の底へ、\n朝は町の窓へ';
  K.REWARD = 'ac_tale_marsh';

  /** first matching {cond, text} entry (§3.2.4 form) for lines chosen inside scripts */
  K.pick = function (ev, list) {
    for (const e of list) if (e && ev.check(e.cond)) return e.text;
    return null;
  };

  /** a free cell `d` tiles from the player for a scene NPC (falls back to where it stands) */
  function spotNear(ev, npc, d) {
    const F = R.Field, M = F && F.map;
    const p = ev.player;
    const cand = [[-d, 0], [d, 0], [0, d], [0, -d], [-d, 1], [d, 1], [-d, -1], [d, -1]];
    for (const [dx, dy] of cand) {
      const x = p.x + dx, y = p.y + dy;
      let ok = true;
      try { ok = M && M.walkable ? M.walkable(x, y) : true; } catch (e) { ok = true; }
      if (ok && M && M.npcAt) { try { if (M.npcAt(x, y)) ok = false; } catch (e) { /* keep */ } }
      if (ok) { npc.setPos(x, y); return true; }
    }
    return false;
  }

  // ------------------------------------------------------------ #1 霧の中に子どもが消える
  E.loch_intro = {
    meta: { needs: [], gives: ['flag:marsh_start'] },
    run: async (ev) => {
      if (ev.flag('marsh_start')) return;
      if (ev.cleared('r_marsh')) { ev.setFlag('marsh_start'); return; }   // came here first after the clear
      const emma = ev.npc('emma_gate'), man = ev.npc('angry_gate');
      const p = ev.player;
      // arriving by ferry or at the inn: the two come running up to the party
      if (Math.abs(p.x - emma.x) + Math.abs(p.y - emma.y) > 6) {
        spotNear(ev, emma, 2);
        spotNear(ev, man, 3);
      }
      await ev.wait(24);
      emma.face('player');
      await ev.say('……ああ、旅の方！\nうちの子を、ニコを\n見ませんでしたか？');
      await ev.say('うちの子が、霧の中へ……。\n朝、水路のそばで\n遊んでいたはずなのに。');
      ev.closeMessage();
      man.face('player');
      await ev.wait(10);
      await ev.say('霧の館の魔女のしわざだ！\nこれで、三人目だぞ。');
      await ev.say('東の湿原の館には、昔から\n魔女が住んでるんだ。\n霧を呼んで、子どもを……！');
      ev.closeMessage();
      emma.face('player');
      await ev.say('魔女が……本当に？\n……お願いです、旅の方。\nあの子を、ニコを……。');
      ev.closeMessage();
      ev.setFlag('marsh_start');
      ev.setObjective('obj_marsh_1', { region: 'r_marsh' });
      await ev.fadeOut(16);
      ev.refresh();
      await ev.fadeIn(16);
    },
  };
  E.loch_emma_gate = {
    meta: { needs: [], gives: ['flag:marsh_start'] },
    run: async (ev) => {
      if (ev.flag('marsh_start')) return;
      await ev.call('loch_intro');
    },
  };

  // ------------------------------------------------------------ #2 鐘つきトビアス
  E.loch_tobias = {
    meta: { needs: [], gives: [], calls: ['loch_tobias_reward'] },
    run: async (ev) => {
      if (ev.cleared('r_marsh')) {
        if (!ev.flag('loch_tobias_reward')) { await ev.call('loch_tobias_reward'); return; }
        await ev.say(K.pick(ev, [
          { cond: { postgame: true }, text: 'ニコのやつが、毎朝\n鐘つきの修業に来おる。\nわしも、まだまだ現役じゃ！' },
          { cond: 'final_open', text: '内海の霧まで晴れたそうじゃ。\n鐘の音が、ビブリア島まで\n届くかもしれんのう。' },
          { text: '♪　鳴れよ、七つの鐘……\nわっはっは、歌えるぞ！\n毎朝、鳴らしておるよ。' },
        ]));
        return;
      }
      if (ev.has('k_marsh_key')) {
        await ev.say('その鍵……メルダさまの\n鐘の鍵か！');
        await ev.say('沼の七つの鐘のうち、\n鎖が水の上に出ておるのは\n三つだけじゃ。');
        await ev.say('鐘の歌を歌いながら、\n鎖を引くんじゃ。\n……頼んだぞ。');
        return;
      }
      await ev.say('昔は毎朝、鐘の歌を歌ったもんだ。\n……今は、鐘の音がどんなだったかも\n思い出せん。');
      await ev.say('記録院の人に、鐘の歌を\n教えてやったんだが……\nそれきり、思い出せん。');
      if (ev.flag('marsh_mid')) await ev.say('メルダさまの幽霊に会った？\n……そうか。わしの祖父の\n言っておったとおりじゃ。');
      else await ev.say('町の者は魔女を恨んでおるが、\nわしの祖父は、メルダさまに\n助けられたと言っておった。');
    },
  };

  // ------------------------------------------------------------ the region's reward (§10.8.5 クリア後, §8.8)
  E.loch_tobias_reward = {
    meta: { needs: ['region:r_marsh'], gives: ['item:' + K.REWARD] },
    run: async (ev) => {
      if (ev.flag('loch_tobias_reward')) return;
      await ev.say('聞こえたか、今朝の鐘を！\nわしの耳に、鐘の歌が\n戻ってきたんじゃ。');
      await ev.say('これは、わしが子どものころ\nメルダさまからいただいた\nお守りじゃ。持っていけ。');
      const ok = await ev.give(K.REWARD, 1);
      if (!ok) { await ev.say('……おや、持ちきれんか。\n荷物を減らしてから、\nまた来るといい。'); return false; }
      ev.setFlag('loch_tobias_reward');
      await ev.say('朝の鐘の音が、\nおまえさんを守ってくれる。\n達者でな。');
    },
  };

  // ------------------------------------------------------------ the tavern's bard
  E.loch_bard = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      if (ev.check({ postgame: true })) {
        await ev.say('新しい歌ができたんだ。\n霧の沼で鐘を鳴らした、\n語り部の歌さ。');
        await ev.caption(K.BELL_SONG, { frames: 180 });
        return;
      }
      if (ev.cleared('r_marsh')) {
        await ev.say('鐘の歌の文句が、\nやっと戻ってきたんだ！\nひとつ、聞いておくれ。');
        ev.closeMessage();
        await ev.caption(K.BELL_SONG, { frames: 180 });
        await ev.say('町のみんなも、朝の鐘に\n合わせて歌ってるよ。');
        return;
      }
      if (ev.tier() >= 6) {
        await ev.say('どの歌も、続きが白く\nぬけていくんだ。\n……歌うたいが歌えないなんて。');
        return;
      }
      await ev.say('鐘の歌を歌ってくれと\n頼まれるんだが、\n節しか残っていなくてね。');
      await ev.say('ラーラ、ラララ……。\n言葉が、どうしても\n出てこないんだ。');
    },
  };
})(window.RPG);
