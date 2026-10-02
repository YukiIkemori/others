// CONTENT（砂漠）: オアシスの町カシムの人と物（WORLD_REDESIGN §5.5・§4.2、STORY_BIBLE §7.2・§8.3）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。解決の後とティアで台詞が変わる。
//   依頼の人（ナディアの足鈴・井戸掘り・迷子のラクダ・のろし・塩・地図屋・占い・値切り・藍染め）は desert_quests.js。
//   仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const T = () => X().tier();

  // ---------------------------------------------------------------- 町に入る
  E('kasim_arrival', async (ev) => {
    if (!ev.flag('desert_arrived')) {
      ev.setFlag('desert_arrived');
      await ev.caption(R.T('events.kasim_arrival.caption'), { ms: 2600 });
      await ev.caption(R.T('events.kasim_arrival.caption_2'), { ms: 2200 });
      await ev.caption(R.T('events.kasim_arrival.caption_3'), { ms: 2200 });
      ev.lead('l_rumor_desert');
      return;
    }
    if (cleared(ev) && !ev.flag('desert_arrived_after')) {
      ev.setFlag('desert_arrived_after');
      await ev.caption(R.T('events.kasim_arrival.caption_4'), { ms: 2400 });
    }
  }, { meta: { needs: [], gives: ['flag:desert_arrived', 'lead:l_rumor_desert'] } });

  // ---------------------------------------------------------------- 広場
  E('kasim_fara', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'fara';
    if (cleared(ev)) {
      await ev.say(id, T() >= 3 ? R.T('events.kasim_fara.say') : R.T('events.kasim_fara.say_2'));
      return;
    }
    if (!ev.flag('desert_fara_met')) {
      ev.setFlag('desert_fara_met');
      await ev.say(id, R.T('events.kasim_fara.say_3'));
      ev.lead('l_desert_spring');
      return;
    }
    await ev.say(id, ev.flag('lo_desert_spring_letters') ? R.T('events.kasim_fara.say_4') : R.T('events.kasim_fara.say_5'));
  }, { meta: { needs: [], gives: ['lead:l_desert_spring'] } });

  E('kasim_spring_letters', async (ev) => {
    if (cleared(ev)) { await ev.say(null, R.T('events.kasim_spring_letters.say')); return; }
    await ev.say(null, R.T('events.kasim_spring_letters.say_2'));
    await X().lore(ev, 'lo_desert_spring_letters');
  }, { meta: { needs: [], gives: ['flag:lo_desert_spring_letters'] } });

  E('kasim_sundial', async (ev) => {
    await ev.say(null, R.T('events.kasim_sundial.say'));
    ev.setFlag('desert_sundial_seen');
    if (ev.flag('desert_ledger_seen')) await X().lore(ev, 'lo_time_desert');
    else await ev.say(null, R.T('events.kasim_sundial.say_2'));
  }, { meta: { needs: [], gives: ['flag:desert_sundial_seen', 'flag:lo_time_desert'] } });
  // 巨像の台座（名の削れた王。王墓の名なき王と同じ）
  E('kasim_colossus', async (ev) => {
    await ev.say(null, R.T('events.kasim_colossus.say'));
    if (cleared(ev)) await ev.say(null, R.T('events.kasim_colossus.say_2'));
    else if (ev.flag('desert_abul_met')) await ev.say(null, R.T('events.kasim_colossus.say_3'));
  });
  E('kasim_guild_ledger', async (ev) => {
    await ev.say(null, R.T('events.kasim_guild_ledger.say'));
    ev.setFlag('desert_ledger_seen');
    if (ev.flag('desert_sundial_seen')) await X().lore(ev, 'lo_time_desert');
    else await ev.say(null, R.T('events.kasim_guild_ledger.say_2'));
  }, { meta: { needs: [], gives: ['flag:desert_ledger_seen', 'flag:lo_time_desert'] } });
  E('kasim_old_man', async (ev) => {
    if (cleared(ev)) { await ev.say('sundial_old', R.T('events.kasim_old_man.say')); return; }
    await ev.say('sundial_old', R.T('events.kasim_old_man.say_2'));
    ev.lead('l_desert_sundial');
  }, { meta: { needs: [], gives: ['lead:l_desert_sundial'] } });

  E('kasim_board', async (ev) => {
    const lines = [];
    if (!ev.flag('desert_camp3_done')) lines.push(R.T('events.kasim_board'));
    else if (!cleared(ev)) lines.push(R.T('events.kasim_board_2'));
    else lines.push(R.T('events.kasim_board_3'));
    lines.push(ev.flag('desert_camel_done') ? R.T('events.kasim_board_4') : R.T('events.kasim_board_5'));
    if (T() >= 2) lines.push(R.T('events.kasim_board_6'));
    await ev.say(null, lines);
  });
  E('kasim_memorial', async (ev) => {
    if (cleared(ev) && ev.choiceOf('ch_desert_write') === 'pain') { await ev.say(null, R.T('events.kasim_memorial.say')); return; }
    await ev.say(null, R.T('events.kasim_memorial.say_2'));
  });
  E('kasim_well', async (ev) => {
    await ev.say(null, cleared(ev) ? R.T('events.kasim_well.say') : R.T('events.kasim_well.say_2'));
  });

  // 日焼けした男（沈んだ神殿のうわさ・鷹団の話）
  E('kasim_hawk_friend', async (ev) => {
    if (!ev.flag('desert_hawk_met')) {
      await ev.say('hawk_friend', R.T('events.kasim_hawk_friend.say'));
      ev.lead('l_opt_temple');
      return;
    }
    const c = X().hawk(ev);
    await ev.say('hawk_friend', c === 'fight' ? R.T('events.kasim_hawk_friend.say_2') : R.T('events.kasim_hawk_friend.say_3'));
    ev.lead('l_opt_temple');
  }, { meta: { needs: [], gives: ['lead:l_opt_temple'] } });

  // 門番（西: 鷹団のうわさ・ボスの癖／東: 灰の荒野への峠）
  E('kasim_gate_w', async (ev) => {
    if (cleared(ev)) { await ev.say('guard_w', R.T('events.kasim_gate_w.say')); return; }
    if (!ev.flag('desert_hawk_met')) {
      await ev.say('guard_w', R.T('events.kasim_gate_w.say_2'));
      ev.lead('l_desert_hawks');
      ev.lead('l_opt_hawknest');
      return;
    }
    await ev.say('guard_w', R.T('events.kasim_gate_w.say_3'));
  }, { meta: { needs: [], gives: ['lead:l_desert_hawks', 'lead:l_opt_hawknest'] } });
  E('kasim_gate_e', async (ev) => {
    await ev.say('guard_e', R.T('events.kasim_gate_e.say'));
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });

  E('kasim_water_woman', async (ev) => {
    if (!ev.flag('desert_water_gift_' + T())) {
      ev.setFlag('desert_water_gift_' + T());
      await ev.say('woman_mid', cleared(ev) ? [R.T('events.kasim_water_woman.say.0')] : R.T('events.kasim_water_woman.say'));
      X().small(ev, [['i_salve', 2], ['i_potion', 2], ['i_potion', 3], ['i_ether', 2], ['i_ether', 3]]);
      return;
    }
    await ev.say('woman_mid', cleared(ev) ? R.T('events.kasim_water_woman.say_2') : R.T('events.kasim_water_woman.say_3'));
  }, { meta: { needs: [], gives: [] } });

  E('kasim_kid', async (ev) => {
    if (cleared(ev)) { await ev.say('pilgrim_kid', R.T('events.kasim_kid.say')); return; }
    await ev.say('pilgrim_kid', ev.flag('desert_dig_asked') && !ev.flag('desert_dig_found') ? R.T('events.kasim_kid.say_2') : R.T('events.kasim_kid.say_3'));
  });

  E('kasim_rashid_memorial', async (ev) => {
    await ev.say('rashid_memorial', R.T('events.kasim_rashid_memorial.say'));
  });

  // ---------------------------------------------------------------- ザイード（ギルド・広場・解決の後）
  E('kasim_zaid', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'zaid_guild';
    if (cleared(ev)) {
      if (ev.flag('desert_cart')) {
        await ev.say(id, [R.T('events.kasim_zaid.say.0')]);
        const i = await ev.choose(R.T('events.kasim_zaid.i.choose'), { cancel: 1 });
        if (i === 0) {
          await ev.fade('out', 400);
          await ev.warp('sandedge', 'warp');
          await ev.fade('in', 400);
          await ev.caption(R.T('events.kasim_zaid.caption'), { ms: 1800 });
        }
        return;
      }
      await ev.say(id, R.T('events.kasim_zaid.say'));
      return;
    }
    if (!ev.flag('desert_zaid_met')) {
      ev.setFlag('desert_zaid_met');
      await ev.say(id, R.T('events.kasim_zaid.say_2'), { voice: ['v_zaid_desert_01', 'v_zaid_desert_02', 'v_zaid_desert_03'] });
      ev.lead('l_desert_caravan');
    } else {
      await ev.say(id, R.T('events.kasim_zaid.say_3'));
    }
    const i = await ev.choose(R.T('events.kasim_zaid.i.choose_2'), { cancel: 1, text: R.T('events.kasim_zaid.i.choose.text') });
    if (i !== 0) { await ev.say(id, R.T('events.kasim_zaid.say_4')); return; }
    await ev.say(id, R.T('events.kasim_zaid.say_5'));
    await ev.call('desert_caravan_depart');
  }, { meta: { needs: [], gives: ['flag:desert_zaid_met', 'lead:l_desert_caravan'], calls: ['desert_caravan_depart'] } });

  // ---------------------------------------------------------------- 市場
  E('kasim_arms', async (ev) => {
    await ev.say('arms_vendor', cleared(ev) ? R.T('events.kasim_arms.say') : R.T('events.kasim_arms.say_2'));
    await ev.shop('shop_kasim_arms', { line: cleared(ev) ? R.T('events.kasim_arms.line_2') : R.T('events.kasim_arms.line') });
  });
  E('kasim_shop_keeper', async (ev) => {
    await ev.say('shop_keeper', cleared(ev) ? R.T('events.kasim_shop_keeper.say') : R.T('events.kasim_shop_keeper.say_2'));
    await ev.shop('shop_kasim_items');
  });

  // ---------------------------------------------------------------- 宿・酒場
  E('kasim_inn_keeper', async (ev) => {
    const price = R.Tier && R.Tier.innPrice ? R.Tier.innPrice() : 20;
    await ev.say('inn_keeper', R.T('events.kasim_inn_keeper.say'));
    // 「朝の鐘まで？ 消灯の刻まで？」の問いに、宿の画面がそのまま答える（前は選択肢の後に「泊まる」だけの画面が重なった。テスター 2026-10-02 P37）
    const ok = await ev.inn(price, { choices: R.T('events.kasim_inn_keeper.inn') });
    if (!ok) return;
    const i = ok.pick;
    if (i === 1) {
      ev.setFlag('desert_night');
      const n = ev.addVar('desert_nights', 1);
      await ev.caption(n === 3 ? R.T('events.kasim_inn_keeper.caption') : R.T('events.kasim_inn_keeper.caption_2'), { ms: 2600 });
      ev.lead('l_opt_mirage');
    } else {
      ev.setFlag('desert_night', false);
      await ev.say('inn_keeper', R.T('events.kasim_inn_keeper.say_2'));
    }
  }, { meta: { needs: [], gives: ['flag:desert_night', 'var:desert_nights+1', 'lead:l_opt_mirage'] } });
  E('kasim_inn_guest', async (ev) => {
    await ev.say('inn_guest', R.T('events.kasim_inn_guest.say'));
    ev.lead('l_opt_sandedge');
  }, { meta: { needs: [], gives: ['lead:l_opt_sandedge'] } });
  E('kasim_inn_window', async (ev) => {
    if (ev.flag('desert_night')) { await ev.say(null, R.T('events.kasim_inn_window.say')); return; }
    await ev.say(null, cleared(ev) ? R.T('events.kasim_inn_window.say_2') : R.T('events.kasim_inn_window.say_3'));
  });
  E('kasim_tavern_master', async (ev) => {
    const news = [
      R.T('events.kasim_tavern_master.news.0'),
      R.T('events.kasim_tavern_master.news.1'),
      R.T('events.kasim_tavern_master.news.2'),
    ];
    if (cleared(ev)) { await ev.say('tavern_master', R.T('events.kasim_tavern_master.say')); return; }
    await ev.say('tavern_master', news[Math.min(T(), news.length - 1)]);
  });
  E('kasim_tavern_poster', async (ev) => {
    await ev.say(null, ev.flag('desert_hawk_met') ? R.T('events.kasim_tavern_poster.say') : R.T('events.kasim_tavern_poster.say_2'));
  });
  E('kasim_rumor_a', async (ev) => {
    await ev.say('rumor_a', R.T('events.kasim_rumor_a.say'));
    ev.lead('l_opt_rocks');
  }, { meta: { needs: [], gives: ['lead:l_opt_rocks'] } });
  E('kasim_rumor_b', async (ev) => {
    if (cleared(ev)) { await ev.say('rumor_b', R.T('events.kasim_rumor_b.say')); return; }
    await ev.say('rumor_b', R.T('events.kasim_rumor_b.say_2'));
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });
  E('kasim_rumor_c', async (ev) => {
    await ev.say('rumor_c', R.T('events.kasim_rumor_c.say'));
    ev.lead('l_rumor_snow');
  }, { meta: { needs: [], gives: ['lead:l_rumor_snow'] } });

  // ---------------------------------------------------------------- ギルド
  E('kasim_caravan_man', async (ev) => {
    if (cleared(ev)) { await ev.say('caravan_man', R.T('events.kasim_caravan_man.say')); return; }
    await ev.say('caravan_man', R.T('events.kasim_caravan_man.say_2'));
  });

  // ---------------------------------------------------------------- アブル（王墓の番。名の文字・ボスの癖）
  E('kasim_abul', async (ev) => {
    if (cleared(ev)) { await ev.say('abul', R.T('events.kasim_abul.say')); return; }
    ev.setFlag('desert_abul_met');
    await ev.say('abul', R.T('events.kasim_abul.say_2'));
    ev.lead('l_desert_glyphs');
    await ev.say('abul', R.T('events.kasim_abul.say_3'));
  }, { meta: { needs: [], gives: ['flag:desert_abul_met', 'lead:l_desert_glyphs'] } });
  E('kasim_abul_altar', async (ev) => {
    await ev.say(null, [R.T('events.kasim_abul_altar.say.0'), cleared(ev) ? R.T('events.kasim_abul_altar.say.1') : R.T('events.kasim_abul_altar.say.1_2')]);
  });
})(window.RPG);
