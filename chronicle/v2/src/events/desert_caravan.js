// CONTENT（砂漠）: 隊商の護衛の旅（WORLD_REDESIGN §4.2 の流れ 1・2、STORY_BIBLE §7.2 の主な場面 1・2）。
//   desert_caravan_depart  ザイードの隊が一行の後ろにつく（ついてくる人 E8 = ev.guest('npc_zaid')）。旗 desert_caravan_on
//   desert_ambush_1〜3     隊が襲われる（ワールドの道の上、1 度ずつ。勝てば隊は無事）
//   desert_camp1_scene     野営地「岩の井戸」: 星の歌 1 → 砂の鷹団が水を奪いに来る。選択 ch_desert_hawk（fight|water|pay）
//   desert_camp2_scene     野営地「星の石」: 星の歌 2 → 砂嵐。選択 ch_desert_route（short|long）。水を分けたならのどの渇き（MP が減る）
//   desert_camp3_scene     王墓のオアシス: 星の歌 3・「夜明け」の言葉 → 隊はここで待つ（desert_camp3_done、この先は一行だけ）
//   仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const ZAID = { name: R.T('ev.desert_caravan.ZAID.name') };
  const RASHID = { name: R.T('ev.desert_caravan.RASHID.name') };

  // ---------------------------------------------------------------- 出発
  E('desert_caravan_depart', async (ev) => {
    if (ev.flag('desert_caravan_on') || ev.flag('desert_camp3_done')) return;
    await ev.fade('out', 400);
    ev.setFlag('desert_caravan_on');
    ev.lead('l_desert_caravan');
    ev.guest('npc_zaid');
    await ev.warp('d_west', 'kasim');   // カシムの西の門の外（エリア 鷹の台地）
    await ev.fade('in', 400);
    ev.bgm('caravan', { fade: 600 });
    await ev.caption(R.T('events.desert_caravan_depart.caption'), { ms: 2600 });
    await ev.say('npc_zaid', R.T('events.desert_caravan_depart.say'), ZAID);
  }, { meta: { needs: ['flag:desert_zaid_met'], gives: ['flag:desert_caravan_on', 'lead:l_desert_caravan'], warp: { to: 'd_west', spawn: 'kasim' } } });

  // ---------------------------------------------------------------- 隊が襲われる（3 回）
  const AMBUSH = {
    1: { troop: 'tr_desert_ambush', text: R.T('ev.desert_caravan.AMBUSH.1.text') },
    2: { troop: 'tr_desert_ambush2', text: R.T('ev.desert_caravan.AMBUSH.2.text') },
    3: { troop: 'tr_desert_ambush3', text: R.T('ev.desert_caravan.AMBUSH.3.text') },
  };
  for (const n of [1, 2, 3]) {
    E('desert_ambush_' + n, async (ev) => {
      if (!ev.flag('desert_caravan_on') || ev.flag('desert_ambush_' + n + '_done')) return;
      ev.sfx('roar');
      await ev.say(null, AMBUSH[n].text);
      await ev.say('npc_zaid', n === 1 ? R.T('ev.desert_caravan.say') : n === 2 ? R.T('ev.desert_caravan.say_2') : R.T('ev.desert_caravan.say_3'), ZAID);
      const r = await ev.battle(AMBUSH[n].troop);
      if (r !== 'win') return;
      ev.setFlag('desert_ambush_' + n + '_done');
      await ev.say('npc_zaid', [R.T('ev.desert_caravan.say.0'), n === 3 ? R.T('ev.desert_caravan.say.1') : R.T('ev.desert_caravan.say.1_2')], ZAID);
    }, { meta: { needs: ['flag:desert_caravan_on'], gives: ['flag:desert_ambush_' + n + '_done'] } });
  }

  // ---------------------------------------------------------------- たき火の歌（野営地ごとに 1 つ）
  async function starSong(ev, i) {
    ev.sfx('fire');
    await ev.caption(R.T('ev.desert_caravan.starSong.caption')[i], { ms: 2200 });
    ev.sfx('bell');
    await ev.caption(X().STARS[i], { ms: 3600, voice: X().STARS_VOICE[i] });
  }

  // ---------------------------------------------------------------- 野営地 1「岩の井戸」: 砂の鷹団
  E('desert_camp1_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || ev.flag('desert_camp1_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp1_seen')) {
        ev.setFlag('desert_camp1_seen');
        await ev.caption(R.T('events.desert_camp1_scene.caption'), { ms: 2200 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp1', 'fire');
    await ev.fade('in', 400);
    await starSong(ev, 0);
    await ev.say('npc_zaid', R.T('events.desert_camp1_scene.say'), ZAID);
    // 砂の鷹団
    ev.sfx('whistle');
    await ev.caption(R.T('events.desert_camp1_scene.caption_2'), { ms: 2200 });
    ev.bgm('tension', { fade: 400 });
    await ev.say(null, R.T('events.desert_camp1_scene.say_2'));
    await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_3'), Object.assign({ voice: ['v_rashid_desert_01', 'v_rashid_desert_02'] }, RASHID));
    await ev.say('npc_zaid', R.T('events.desert_camp1_scene.say_4'), ZAID);
    const price = X().gold(160);
    const i = await ev.choose([R.T('events.desert_camp1_scene.i.choose.0'), R.T('events.desert_camp1_scene.i.choose.1'), R.T('events.desert_camp1_scene.i.choose.2', { price })], { important: true, text: R.T('events.desert_camp1_scene.i.choose.text') });
    if (i === 0) {
      ev.choice('ch_desert_hawk', 'fight');
      await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_5'), RASHID);
      const r = await ev.battle('tr_b_hawkchief', { boss: true });
      ev.mapBgm();
      if (r !== 'win') { ev.choice('ch_desert_hawk', undefined); return; }
      await ev.say(null, R.T('events.desert_camp1_scene.say_6'));
      await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_7'), Object.assign({ voice: ['v_rashid_desert_03', 'v_rashid_desert_04', 'v_rashid_desert_05', 'v_rashid_desert_06'] }, RASHID));
    } else if (i === 1) {
      ev.choice('ch_desert_hawk', 'water');
      ev.setFlag('desert_thirst');
      await ev.say('npc_zaid', R.T('events.desert_camp1_scene.say_8'), ZAID);
      await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_9'), RASHID);
      await ev.say(null, R.T('events.desert_camp1_scene.say_10'));
    } else {
      if (ev.gold(0) < price) {
        await ev.say(null, R.T('events.desert_camp1_scene.say_11'));
        ev.choice('ch_desert_hawk', 'water');
        ev.setFlag('desert_thirst');
        await ev.say('npc_zaid', R.T('events.desert_camp1_scene.say_12'), ZAID);
        await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_13'), RASHID);
      } else {
        ev.gold(-price);
        ev.choice('ch_desert_hawk', 'pay');
        await ev.say('npc_rashid', R.T('events.desert_camp1_scene.say_14'), RASHID);
      }
    }
    ev.lead('l_opt_hawknest');
    // 短い眠り: 暗転のあいだに旗を立てる（鷹団がたき火に残る・去るのを、パッと出し消ししない）
    await ev.fade('out', 500);
    ev.setFlag('desert_hawk_met');
    ev.setFlag('desert_camp1_done');
    ev.mapBgm({ fade: 600 });
    ev.rest();
    await ev.wait(300);
    await ev.fade('in', 600);
    await ev.caption(R.T('events.desert_camp1_scene.caption_3'), { ms: 2000 });
    await ev.say('npc_zaid', R.T('events.desert_camp1_scene.say_15'), ZAID);
  }, {
    meta: {
      needs: ['flag:desert_caravan_on'],
      gives: ['flag:desert_camp1_done', 'flag:desert_hawk_met', 'choice:ch_desert_hawk', 'flag:desert_thirst', 'lead:l_opt_hawknest'],
      warp: { to: 'desert_camp1', spawn: 'fire' },
    },
  });

  // たき火のラシード（戦わなかったとき、野営地 1 に残る）
  E('desert_rashid_fire', async (ev) => {
    const c = X().hawk(ev);
    if (!ev.flag('desert_rashid_talked')) {
      ev.setFlag('desert_rashid_talked');
      await ev.say('rashid_fire', R.T('events.desert_rashid_fire.say'));
      await ev.say('rashid_fire', c === 'pay' ? R.T('events.desert_rashid_fire.say_2') : R.T('events.desert_rashid_fire.say_3'));
      return;
    }
    await ev.say('rashid_fire', R.T('events.desert_rashid_fire.say_4'));
  });

  // ---------------------------------------------------------------- 野営地 2「星の石」: 砂嵐と近道
  E('desert_camp2_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || !ev.flag('desert_camp1_done') || ev.flag('desert_camp2_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp2_seen')) {
        ev.setFlag('desert_camp2_seen');
        await ev.caption(R.T('events.desert_camp2_scene.caption'), { ms: 2200 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp2', 'fire');
    await ev.fade('in', 400);
    if (ev.flag('desert_thirst')) {
      await ev.say(null, R.T('events.desert_camp2_scene.say'));
      for (const c of (R.Party && R.Party.members ? R.Party.members() : [])) if (c && c.mp > 0) c.mp = Math.floor(c.mp * 0.7);
      ev.setFlag('desert_thirst', false);
      ev.setFlag('desert_thirst_felt');
    }
    await starSong(ev, 1);
    await ev.say('npc_zaid', R.T('events.desert_camp2_scene.say_2'), ZAID);
    ev.sfx('wind');
    await ev.caption(R.T('events.desert_camp2_scene.caption_2'), { ms: 2200 });
    await ev.say('npc_zaid', R.T('events.desert_camp2_scene.say_3'), ZAID);
    const i = await ev.choose(R.T('events.desert_camp2_scene.i.choose'), { important: true, text: R.T('events.desert_camp2_scene.i.choose.text') });
    if (i === 0) {
      ev.choice('ch_desert_route', 'short');
      await ev.say('npc_zaid', R.T('events.desert_camp2_scene.say_4'), ZAID);
    } else {
      ev.choice('ch_desert_route', 'long');
      await ev.say('npc_zaid', R.T('events.desert_camp2_scene.say_5'), ZAID);
    }
    await ev.fade('out', 500);
    ev.setFlag('desert_camp2_done');
    ev.rest();
    await ev.wait(300);
    await ev.fade('in', 600);
    await ev.caption(R.T('events.desert_camp2_scene.caption_3'), { ms: 2000 });
  }, {
    meta: {
      needs: ['flag:desert_caravan_on', 'flag:desert_camp1_done'],
      gives: ['flag:desert_camp2_done', 'choice:ch_desert_route'],
      warp: { to: 'desert_camp2', spawn: 'fire' },
    },
  });

  // 記録官のくら袋（くべられなかった手紙、STORY_BIBLE §10.3）
  E('desert_camp2_saddlebag', async (ev) => {
    if (ev.flag('desert_saddlebag')) { await ev.say(null, R.T('events.desert_camp2_saddlebag.say')); return; }
    await ev.say(null, R.T('events.desert_camp2_saddlebag.say_2'));
    ev.setFlag('desert_saddlebag');
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:desert_saddlebag'] } });

  E('desert_camp2_stone', async (ev) => {
    await ev.say(null, R.T('events.desert_camp2_stone.say'));
    if (X().tier() >= 2) await ev.say(null, R.T('events.desert_camp2_stone.say_2'));
  });

  E('desert_camp2_child', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say('camp2_star', R.T('events.desert_camp2_child.say')); return; }
    await ev.say('camp2_star', R.T('events.desert_camp2_child.say_2'));
  });

  // ---------------------------------------------------------------- 野営地 3「王墓のオアシス」
  E('desert_camp3_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || !ev.flag('desert_camp2_done') || ev.flag('desert_camp3_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp3_done') && !ev.flag('desert_camp3_seen')) {
        ev.setFlag('desert_camp3_seen');
        await ev.caption(R.T('events.desert_camp3_scene.caption'), { ms: 2600 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp3', 'fire');
    await ev.fade('in', 400);
    await ev.caption(R.T('events.desert_camp3_scene.caption_2'), { ms: 2400 });
    await starSong(ev, 2);
    await ev.say('npc_zaid', R.T('events.desert_camp3_scene.say'), Object.assign({ voice: ['v_zaid_desert_04', 'v_zaid_desert_05'] }, ZAID));
    await ev.say(null, R.T('events.desert_camp3_scene.say_2'));
    await ev.say('npc_zaid', R.T('events.desert_camp3_scene.say_3'), ZAID);
    // 暗転のあいだに、ついてきたザイードが隊の輪に戻り、古い道を来たアブルが着く（出し消しを見せない）
    await ev.fade('out', 500);
    ev.guest(null);
    ev.setFlag('desert_caravan_on', false);
    ev.setFlag('desert_camp3_done');
    ev.setFlag('desert_abul_came');
    ev.leadDone('l_desert_caravan');
    ev.lead('l_desert_tomb');
    ev.rest();
    await ev.wait(300);
    await ev.fade('in', 600);
    await ev.caption(R.T('events.desert_camp3_scene.caption_3'), { ms: 2000 });
  }, {
    meta: {
      needs: ['flag:desert_caravan_on', 'flag:desert_camp2_done'],
      gives: ['flag:desert_camp3_done', 'flag:desert_abul_came', 'lead:l_desert_tomb'],
      warp: { to: 'desert_camp3', spawn: 'fire' },
    },
  });

  // ---------------------------------------------------------------- 野営地の隊の人（進み具合で話が変わる）
  E('desert_camp_zaid', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'npc_zaid';
    if (ev.flag('desert_camp3_done')) {
      if (ev.flag('desert_king')) { await ev.say(id, R.T('events.desert_camp_zaid.say')); return; }
      await ev.say(id, R.T('events.desert_camp_zaid.say_2'));
      return;
    }
    if (ev.flag('desert_camp2_done')) { await ev.say(id, ev.choiceOf('ch_desert_route') === 'short' ? R.T('events.desert_camp_zaid.say_3') : R.T('events.desert_camp_zaid.say_4')); return; }
    await ev.say(id, R.T('events.desert_camp_zaid.say_5'));
  });
  E('desert_camp_man', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    const fad = /man1$/.test(id || '');
    if (ev.flag('desert_camp3_done')) {
      await ev.say(id, fad ? R.T('events.desert_camp_man.say') : R.T('events.desert_camp_man.say_2'));
      return;
    }
    if (ev.flag('desert_camp1_done')) {
      const c = X().hawk(ev);
      await ev.say(id, fad ? { fight: R.T('events.desert_camp_man.say.fight'), water: R.T('events.desert_camp_man.say.water'), pay: R.T('events.desert_camp_man.say.pay') }[c] || R.T('events.desert_camp_man.say_3') : R.T('events.desert_camp_man.say_4'));
      return;
    }
    await ev.say(id, fad ? R.T('events.desert_camp_man.say_5') : R.T('events.desert_camp_man.say_6'));
  });

  // 野営地 1 の井戸と碑（戦の傷 lo_war_desert）・井戸守りの老人
  E('desert_camp1_well', async (ev) => {
    await ev.say(null, [R.T('events.desert_camp1_well.say.0'), ev.flag('cleared_r_desert') ? R.T('events.desert_camp1_well.say.1') : R.T('events.desert_camp1_well.say.1_2')]);
  });
  E('desert_camp1_memorial', async (ev) => {
    await ev.say(null, R.T('events.desert_camp1_memorial.say'));
    await X().lore(ev, 'lo_war_desert');
    if (ev.flag('cleared_r_desert') && ev.choiceOf('ch_desert_write') === 'pain') await ev.say(null, R.T('events.desert_camp1_memorial.say_2'));
  }, { meta: { needs: [], gives: ['flag:lo_war_desert'] } });
  E('desert_camp1_old', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say('camp1_old', R.T('events.desert_camp1_old.say')); return; }
    await ev.say('camp1_old', R.T('events.desert_camp1_old.say_2'));
  });
})(window.RPG);
