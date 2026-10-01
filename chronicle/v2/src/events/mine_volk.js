// CONTENT（ガルド山地）: 鍛冶衆の隠れ村ヴォルク（#16。WORLD_REDESIGN §2.7・§5.14・§4.6、STORY_BIBLE §7.6 の「戦の傷」）。
//   二十年前、ドヴァンが両方の同盟に武器を売ったとき、「刃は守りのために打つ」という鍛冶神の誓いを守って町を出た鍛冶衆の村。
//   住人は鉱山の話の選び方で変わる（ch_mine_side）: 選ぶ前 = よそ者を疑う／A 組合 = 町を去ったヘルガたちがここへ移る／
//   B 鍛冶衆 = 石段の下り道（mine_volk_open）が開き、ピップが行き来する／C 仲裁 = 組合の鉱夫が鉱石を売りに来る。
//   旗: volk_seen（着いた）・volk_gunnar_told（老鍛冶の二十年前の話）・volk_shrine_prayed（祠）・volk_anvil_struck（庭の金床）。
//   手がかり: l_opt_volk（寄り道のうわさ。ドヴァンの通りの女・トロッコ乗り場の古い坑夫）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Mine.ev;
  const side = (ev) => ev.choiceOf('ch_mine_side');
  const cleared = (ev) => ev.flag('cleared_r_mine');

  E('volk_arrive', async (ev) => {
    if (!ev.flag('volk_seen')) {
      ev.setFlag('volk_seen');
      ev.leadDone('l_opt_volk');
      await ev.caption(R.T('events.volk_arrive.caption'), { ms: 2400 });
      await ev.caption(R.T('events.volk_arrive.caption_2'), { ms: 2000 });
    }
  }, { meta: { needs: [], gives: ['flag:volk_seen'] } });

  // ---------------------------------------------------------------- 外の人と物
  E('volk_bridge_old', async (ev) => {
    const s = side(ev);
    if (s === 'guild') { await ev.say('bridge_old', R.T('events.volk_bridge_old.say')); return; }
    if (s === 'smiths') { await ev.say('bridge_old', R.T('events.volk_bridge_old.say_2')); return; }
    if (s === 'accord') { await ev.say('bridge_old', R.T('events.volk_bridge_old.say_3')); return; }
    await ev.say('bridge_old', R.T('events.volk_bridge_old.say_4'));
  });
  E('volk_yard_smith', async (ev) => {
    await ev.say('yard_smith', cleared(ev) ? R.T('events.volk_yard_smith.say')
      : R.T('events.volk_yard_smith.say_2'));
  });
  E('volk_child', async (ev) => {
    if (!ev.flag('mine_race_heard')) {
      ev.setFlag('mine_race_heard');
      await ev.say('volk_child', R.T('events.volk_child.say'));
      ev.lead('q_mine_trolley');
      return;
    }
    await ev.say('volk_child', R.T('events.volk_child.say_2'));
  }, { meta: { needs: [], gives: ['lead:q_mine_trolley'] } });
  E('volk_pip', async (ev) => {
    await ev.say('volk_pip', R.T('events.volk_pip.say'));
  });
  E('volk_trader', async (ev) => {
    await ev.say('volk_trader', R.T('events.volk_trader.say'));
  });
  E('volk_apprentice', async (ev) => {
    await ev.say('volk_apprentice', R.T('events.volk_apprentice.say'));
  });
  E('volk_shrine', async (ev) => {
    if (ev.flag('volk_shrine_prayed')) { await ev.say(null, R.T('events.volk_shrine.say')); return; }
    ev.setFlag('volk_shrine_prayed');
    await ev.say(null, R.T('events.volk_shrine.say_2'));
    await ev.caption(R.T('events.volk_shrine.caption'), { ms: 1800 });
    ev.item('i_stone_fire', 2);
  }, { meta: { needs: [], gives: ['flag:volk_shrine_prayed', 'item:i_stone_fire'] } });
  E('volk_wheel', async (ev) => {
    await ev.say(null, R.T('events.volk_wheel.say'));
  });
  E('volk_anvil', async (ev) => {
    if (ev.flag('volk_anvil_struck')) { await ev.say(null, R.T('events.volk_anvil.say')); return; }
    ev.setFlag('volk_anvil_struck');
    ev.sfx('hit');
    await ev.say(null, R.T('events.volk_anvil.say_2'));
    ev.item('i_stone_earth', 2);
  }, { meta: { needs: [], gives: ['flag:volk_anvil_struck', 'item:i_stone_earth'] } });
  E('volk_stair', async (ev) => {
    await ev.say(null, R.T('events.volk_stair.say'));
  });

  // ドヴァンの上の段の西の岩壁の割れ目（鍛冶衆の下り道。開くまで）
  E('dovan_volkpath', async (ev) => {
    await ev.say(null, R.T('events.dovan_volkpath.say'));
    ev.lead('l_opt_volk');
  }, { meta: { needs: [], gives: ['lead:l_opt_volk'] } });

  // ---------------------------------------------------------------- 屋内
  E('volk_innkeep', async (ev) => {
    await ev.say('volk_innkeep', cleared(ev) ? R.T('events.volk_innkeep.say') : R.T('events.volk_innkeep.say_2'));
    const i = await ev.choose(R.T('events.volk_innkeep.i.choose'), { who: 'volk_innkeep', text: R.T('events.volk_innkeep.i.choose.text') });
    if (i !== 0) return;
    await ev.inn();
  });
  E('volk_guest', async (ev) => {
    await ev.say('volk_guest', R.T('events.volk_guest.say'));
    ev.lead('l_opt_vein');
  }, { meta: { needs: [], gives: ['lead:l_opt_vein'] } });
  E('volk_master', async (ev) => {
    const s = side(ev);
    if (!ev.flag('volk_master_met')) {
      ev.setFlag('volk_master_met');
      await ev.say('volk_master', R.T('events.volk_master.say'));
    } else {
      await ev.say('volk_master', s === 'smiths' || s === 'accord' ? R.T('events.volk_master.say_2') : R.T('events.volk_master.say_3'));
    }
    await ev.shop('shop_volk_arms');
  });
  E('volk_helga', async (ev) => {
    await ev.say('volk_helga', R.T('events.volk_helga.say'));
  });
  E('volk_dovan_seller', async (ev) => {
    await ev.say('volk_dovan_seller', R.T('events.volk_dovan_seller.say'));
    await ev.shop('shop_dovan_forge');
  });
  E('volk_forge_stone', async (ev) => {
    await ev.say(null, R.T('events.volk_forge_stone.say'));
  });
  E('volk_wife', async (ev) => {
    await ev.say('volk_wife', side(ev) ? R.T('events.volk_wife.say') : R.T('events.volk_wife.say_2'));
  });
  E('volk_gunnar', async (ev) => {
    if (!ev.flag('volk_gunnar_told')) {
      ev.setFlag('volk_gunnar_told');
      await ev.say('volk_gunnar', R.T('events.volk_gunnar.say'));
      return;
    }
    const s = side(ev);
    if (s === 'guild') { await ev.say('volk_gunnar', R.T('events.volk_gunnar.say_2')); return; }
    if (s) { await ev.say('volk_gunnar', R.T('events.volk_gunnar.say_3')); return; }
    await ev.say('volk_gunnar', R.T('events.volk_gunnar.say_4'));
  }, { meta: { needs: [], gives: ['flag:volk_gunnar_told'] } });
  E('volk_elder_book', async (ev) => {
    await ev.say(null, R.T('events.volk_elder_book.say'));
  });
})(window.RPG);
