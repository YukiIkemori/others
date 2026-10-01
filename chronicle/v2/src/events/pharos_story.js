// CONTENT-P: 港町ファロスの本筋（V2_PLAN §3.3 P4〜P7・P10、STORY_BIBLE §9.1・§6.4・§6.7・§11）
//   pharos_arrival        P4 onEnter（入るたび）: 初めてのときだけ町の空気の地の文（話しかけてくる人は置かない）。
//                         灯台がともった後で旅立ちの場面が途中で切れていたら、pharos_departure をもう一度
//   pharos_rowell         P5 記録院の出張所の若い記録官（v_rowell_prologue_01・02）。机の上の白紙の束
//   pharos_record_notice  出張所の掲示「ファロス灯台の守り歌、保管のため写し取り済み」（lo_ev_prologue、序章の物証）
//   pharos_record_papers  白紙の束
//   pharos_tavern_master  P6 潮風亭のマスター: ev.chooseCompanions({count: 3})（表示は MENUS の仲間選び。物語なし、A36）。以後は入れ替え ev.tavern
//   pharos_otto           P7 灯台守オットー: 鍵と心得（書き直した 3 行）。灯がともった後は pharos_otto_reward
//   pharos_otto_reward    灯台守のランタン ac_keeper_lantern（1 回）と「朝番」の昔話
//   pharos_departure      P10 朝の鐘のファロス: v_berna_lute_01〜05、年代記・羽ペン・鈴、序章の章、手がかり帳（l_main_rumors）、
//                         ベルナの一瞬の詰まり（最初の物忘れの影）、オットーの礼、跳ね橋が下りる → prologue_done
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  // ------------------------------------------------------------ P4 着いたとき
  D.pharos_arrival = {
    meta: { needs: [], gives: ['flag:prologue_pharos'], calls: ['pharos_departure'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_boss') && !ev.flag('prologue_done')) { await ev.call('pharos_departure'); return; }
      if (ev.flag('prologue_pharos')) return;
      ev.setFlag('prologue_pharos');
      await E.narr(ev, R.T('ev.pharos_story.pharos_arrival.run.narr'));
    },
  };

  // ------------------------------------------------------------ P5 記録院の出張所
  D.pharos_rowell = {
    meta: { needs: [], gives: ['flag:prologue_rowell'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_rowell')) {
        await E.narr(ev, R.T('ev.pharos_story.pharos_rowell.run.narr'));
        await ev.say('rowell', R.T('ev.pharos_story.pharos_rowell.run.say'), { voice: 'v_rowell_prologue_01', face: 'rowell:neutral' });
        await ev.say('rowell', R.T('ev.pharos_story.pharos_rowell.run.say_2'), { voice: 'v_rowell_prologue_02', face: 'rowell:angry' });
        ev.setFlag('prologue_rowell');
        return;
      }
      const pk = E.pickEntry([
        { cond: 'prologue_done', text: R.T('ev.pharos_story.pharos_rowell.run.pk.0.text') },
        { cond: 'prologue_key', text: R.T('ev.pharos_story.pharos_rowell.run.pk.1.text') },
        { text: R.T('ev.pharos_story.pharos_rowell.run.pk.2.text') },
      ]);
      await E.say(ev, 'rowell', pk.text, { voice: pk.voice, face: 'rowell:neutral' });
    },
  };
  D.pharos_record_notice = {
    meta: { needs: [], gives: ['lore:lo_ev_prologue'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.pharos_story.pharos_record_notice.run.narr'));
      await E.narr(ev, R.T('ev.pharos_story.pharos_record_notice.run.narr_2'));
      E.lore(ev, 'lo_ev_prologue');
    },
  };
  D.pharos_record_papers = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, R.T('ev.pharos_story.pharos_record_papers.run.narr'));
    },
  };

  // ------------------------------------------------------------ P6 潮風亭のマスター（仲間選び・入れ替え）
  D.pharos_tavern_master = {
    meta: { needs: ['flag:prologue_berna'], gives: ['flag:prologue_party'] },
    run: async (ev, ctx) => {
      const E = X();
      const who = (ctx && ctx.npc) || 'master';
      if (!ev.flag('prologue_party')) {
        if (!ev.flag('prologue_berna')) { await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say')); return; }
        await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say_2'));
        await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say_3'));
        const ids = await ev.chooseCompanions({ count: 3 });
        if (!ids || !ids.length) { await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say_4')); return; }
        await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say_5'));
        await E.say(ev, who, R.T('ev.pharos_story.pharos_tavern_master.run.say_6'));
        ev.setFlag('prologue_party');
        return;
      }
      const i = await ev.choose(R.T('ev.pharos_story.pharos_tavern_master.run.i.choose'), { cancel: 2, who, text: E.t(R.T('ev.pharos_story.pharos_tavern_master.choose.text.t')) });
      if (i === 0) { await ev.tavern({ swap: true }); return; }
      if (i === 1) {
        await E.say(ev, who, E.pick([
          { cond: 'prologue_done', text: R.T('ev.pharos_story.pharos_tavern_master.run.pick.0.text') },
          { text: R.T('ev.pharos_story.pharos_tavern_master.run.pick.1.text') },
        ]));
      }
    },
  };

  // ------------------------------------------------------------ P7 灯台守オットー
  const OTTO_TIPS = R.T('ev.pharos_story.OTTO_TIPS');
  async function tips(ev) { for (const t of OTTO_TIPS) await ev.say('otto', t, { face: 'otto:neutral' }); }
  D.pharos_otto = {
    meta: { needs: ['flag:prologue_party'], gives: ['flag:prologue_key', 'item:k_lighthouse_key'], calls: ['pharos_otto_reward'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_boss')) { await ev.call('pharos_otto_reward'); return; }
      if (!ev.flag('prologue_party')) {
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say'), { voice: 'v_otto_pharos_01', face: 'otto:sad' });
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_2'), { voice: 'v_otto_pharos_02', face: 'otto:surprise' });
        return;
      }
      if (!ev.flag('prologue_key')) {
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_3'), { voice: 'v_otto_pharos_03', face: 'otto:smile' });
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_4'), { voice: 'v_otto_pharos_04', face: 'otto:sad' });
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_5'), { voice: 'v_otto_pharos_05', face: 'otto:neutral' });
        await E.give(ev, 'k_lighthouse_key', 1, { say: true });
        ev.setFlag('prologue_key');
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_6'), { voice: 'v_otto_pharos_06', face: 'otto:neutral' });
        await tips(ev);
        return;
      }
      await ev.say('otto', ev.flag('prologue_tutorial') ? R.T('ev.pharos_story.pharos_otto.run.say_7') : R.T('ev.pharos_story.pharos_otto.run.say_8'), { face: 'otto:neutral' });
      const i = await ev.choose(R.T('ev.pharos_story.pharos_otto.run.i.choose'), { cancel: 1, who: 'otto', face: 'otto:neutral', text: R.T('ev.pharos_story.pharos_otto.run.i.choose.text') });
      if (i === 0) await tips(ev);
      else await ev.say('otto', R.T('ev.pharos_story.pharos_otto.run.say_9'), { face: 'otto:smile' });
    },
  };
  D.pharos_otto_reward = {
    meta: { needs: ['flag:prologue_boss'], gives: ['item:ac_keeper_lantern', 'flag:prologue_otto_reward'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_otto_reward')) {
        await E.say(ev, 'otto', R.T('ev.pharos_story.pharos_otto_reward.run.say'), { voice: 'v_otto_reward_05', face: 'otto:smile' });   // 声は名前を読まない
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto_reward.run.say_2'), { voice: 'v_otto_reward_01', face: 'otto:smile' });
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto_reward.run.say_3'), { voice: 'v_otto_reward_02', face: 'otto:neutral' });
        await E.give(ev, 'ac_keeper_lantern', 1, { say: true });
        ev.setFlag('prologue_otto_reward');
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto_reward.run.say_4'), { voice: 'v_otto_reward_03', face: 'otto:smile' });
        await ev.say('otto', R.T('ev.pharos_story.pharos_otto_reward.run.say_5'), { voice: 'v_otto_reward_04', face: 'otto:sad' });
        return;
      }
      await E.say(ev, 'otto', E.pick([
        { cond: 'cleared_r_forest', text: R.T('ev.pharos_story.pharos_otto_reward.run.pick.0.text') },
        { text: R.T('ev.pharos_story.pharos_otto_reward.run.pick.1.text') },
      ]), { face: 'otto:smile' });
    },
  };

  // ------------------------------------------------------------ P10 朝の鐘のファロス
  D.pharos_departure = {
    meta: {
      needs: ['flag:prologue_boss'],
      gives: ['flag:prologue_done', 'item:k_chronicle', 'item:k_quill', 'item:k_bell', 'lead:l_main_rumors', 'item:ac_keeper_lantern'],
      calls: ['pharos_otto_reward'],
    },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_done') || !ev.flag('prologue_boss')) return;
      ev.bgm('dawn');   // 朝の鐘（最後の R.Audio.bgm('town') で町の曲へ）
      try { R.Audio.sfx('bell'); } catch (e) { /* */ }
      await ev.caption(R.T('ev.pharos_story.pharos_departure.run.caption'), { ms: 2800 });
      await E.say(ev, 'cheer_a', R.T('ev.pharos_story.pharos_departure.run.say'), { name: R.T('ev.pharos_story.pharos_departure.run.townsfolk') });
      await ev.npc('berna').move([[7, 11], [6, 11]]);
      // 仲間は出さない（持ち主 2026-09-27: 急に皆が出るのは違和感。フィールドは主人公だけ）
      await E.say(ev, 'berna', R.T('ev.pharos_story.pharos_departure.run.say_2'), { face: 'berna:smile' });
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_3'), { voice: 'v_berna_lute_01', face: 'berna:smile' });
      await E.give(ev, 'k_chronicle', 1, { say: true });
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_4'), { voice: 'v_berna_lute_02', face: 'berna:neutral' });
      await E.give(ev, 'k_quill', 1, { quiet: true });
      await E.give(ev, 'k_bell', 1, { quiet: true });
      await E.narr(ev, R.T('ev.pharos_story.pharos_departure.run.narr'));
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_5'), { face: 'berna:neutral' });
      try { R.Audio.sfx('quill'); } catch (e) { /* */ }
      E.chapter('prologue');
      await Promise.all([ev.caption(R.T('ev.pharos_story.pharos_departure.run.caption_2'), { ms: 3000 }), ev.jingle('chapter')]);
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_6'), { voice: 'v_berna_lute_03', face: 'berna:sad' });
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_7'), { voice: 'v_berna_lute_04', face: 'berna:neutral' });
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_8'), { voice: 'v_berna_depart_01', face: 'berna:smile' });
      ev.lead('l_main_rumors');
      await E.narr(ev, R.T('ev.pharos_story.pharos_departure.run.narr_2'));
      try { if (R.DB.tips && R.DB.tips.leads) await R.Screens.tip('leads'); } catch (e) { /* 札が無くても止めない */ }
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_9'), { voice: 'v_berna_lute_05', face: 'berna:smile' });
      // 最初の物忘れの影（STORY_BIBLE §9.1 P10）
      await ev.say('berna', R.T('ev.pharos_story.pharos_departure.run.say_10'), { voice: 'v_berna_depart_02', face: 'berna:smile' });
      await E.narr(ev, R.T('ev.pharos_story.pharos_departure.run.narr_3'));
      await E.say(ev, 'berna', R.T('ev.pharos_story.pharos_departure.run.say_11'), { face: 'berna:smile' });
      // 立ち去る（持ち主 2026-09-27: 話が終わったら背を向けて数歩歩き、薄れて消える）。ベルナは西の門から里へ
      await ev.leave('berna', { path: [[5, 11], [4, 11], [3, 11]] });
      await E.narr(ev, R.T('ev.pharos_story.pharos_departure.run.narr_4'));
      await ev.call('pharos_otto_reward');
      // オットーの礼の後、集まっていた町の娘が跳ね橋の知らせ（旧版では朝の場面の頭。名札で話し手を分ける）
      await E.say(ev, 'cheer_b', R.T('ev.pharos_story.pharos_departure.run.say_12'), { name: R.T('ev.pharos_story.pharos_departure.run.townsfolk') });
      await ev.leave(['cheer_b', 'cheer_a']);   // 集まっていた町の人も、それぞれ歩いて去る
      ev.setFlag('prologue_done');
      try { R.Audio.bgm('town'); } catch (e) { /* */ }
    },
  };
})(window.RPG);
