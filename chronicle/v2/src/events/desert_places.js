// CONTENT（砂漠）: ワールドの砂漠と寄り道の場所のイベント（WORLD_REDESIGN §2.7 #6〜#10、§4.2）。
//   ワールド: 夜明け待ちの巡礼・油運び・しんきろうの市の平地（昼）・沈んだ柱の浜
//   宿場「砂の縁」: 宿・売り台・うまや（解決の後は隊商路の荷車でカシムへ）・森と灰から来た旅人
//   しんきろうの市（消灯の刻だけ）: 一品物の 3 人の売り手（ティアで入れ替わる）・古老・踊り子
//   砂の鷹団のアジト: 選択 ch_desert_hawk で敵・味方・中立。頭との再戦 tr_b_hawkhold（敵のとき）→ 鷹の手袋
//   金剛トカゲの岩場・古い野営跡・井戸の小屋・砂に沈んだ神殿（日輪の盤・黄金の守護像たち → 日輪の杖）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const T = () => X().tier();

  // ================================================================ ワールド
  E('desert_world_pilgrim', async (ev) => {
    if (cleared(ev)) { await ev.say('pilgrim', R.T('events.desert_world_pilgrim.say')); return; }
    await ev.say('pilgrim', R.T('events.desert_world_pilgrim.say_2'));
    if (!ev.flag('desert_pilgrim_gift')) { ev.setFlag('desert_pilgrim_gift'); await ev.say('pilgrim', R.T('events.desert_world_pilgrim.say_3')); X().small(ev, [['i_salve', 2], ['i_potion', 1], ['i_potion', 2], ['i_ether', 1], ['i_ether', 2]]); }
  });
  E('desert_world_oil', async (ev) => {
    if (ev.flag('desert_beacons_done')) { await ev.say('oil_caravan', R.T('events.desert_world_oil.say')); return; }
    await ev.say('oil_caravan', R.T('events.desert_world_oil.say_2'));
  });
  E('desert_mirage_empty', async (ev) => {
    await ev.say(null, ev.flag('desert_mirage_seen') ? R.T('events.desert_mirage_empty.say') : R.T('events.desert_mirage_empty.say_2'));
  });
  E('desert_temple_sand', async (ev) => {
    const n = ev.var('desert_nights');
    await ev.say(null, [R.T('events.desert_temple_sand.say.0'), n > 0 ? R.T('events.desert_temple_sand.say.1', { n }) : R.T('events.desert_temple_sand.say.1_2')]);
  });

  // ================================================================ 宿場「砂の縁」
  E('sandedge_arrive', async (ev) => {
    if (ev.flag('desert_sandedge_seen')) return;
    ev.setFlag('desert_sandedge_seen');
    await ev.caption(R.T('events.sandedge_arrive.caption'), { ms: 2400 });
  });
  E('sandedge_notice', async (ev) => {
    await ev.say(null, [R.T('events.sandedge_notice.say.0'), R.T('events.sandedge_notice.say.1'), T() >= 2 ? R.T('events.sandedge_notice.say.2') : R.T('events.sandedge_notice.say.2_2')]);
  });
  E('sandedge_innkeeper', async (ev) => {
    await ev.say('keeper', R.T('events.sandedge_innkeeper.say'));
    const i = await ev.choose(R.T('events.sandedge_innkeeper.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (ok) ev.setFlag('desert_night', false);
  }, { meta: { needs: [], gives: [] } });
  E('sandedge_shop', async (ev) => {
    await ev.say('stall', R.T('events.sandedge_shop.say'));
    await ev.shop('shop_sandedge');
  });
  E('sandedge_stable', async (ev) => {
    if (ev.flag('desert_cart')) {
      await ev.say('stable', R.T('events.sandedge_stable.say'));
      const i = await ev.choose(R.T('events.sandedge_stable.i.choose'), { cancel: 1 });
      if (i !== 0) return;
      await ev.fade('out', 400);
      await ev.warp('kasim', 'warp');
      await ev.fade('in', 400);
      await ev.caption(R.T('events.sandedge_stable.caption'), { ms: 1800 });
      return;
    }
    await ev.say('stable', R.T('events.sandedge_stable.say_2'));
  });
  E('sandedge_forest_traveler', async (ev) => {
    await ev.say('forest_trav', ev.flag('cleared_r_forest') ? R.T('events.sandedge_forest_traveler.say') : R.T('events.sandedge_forest_traveler.say_2'));
  });
  E('sandedge_ash_traveler', async (ev) => {
    await ev.say('ash_trav', R.T('events.sandedge_ash_traveler.say'));
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });
  E('sandedge_well_girl', async (ev) => {
    await ev.say('well_girl', cleared(ev) ? R.T('events.sandedge_well_girl.say') : R.T('events.sandedge_well_girl.say_2'));
  });
  E('sandedge_rumor', async (ev) => {
    await ev.say('drinker', R.T('events.sandedge_rumor.say'));
    ev.lead('l_opt_mirage');
  }, { meta: { needs: [], gives: ['lead:l_opt_mirage'] } });
  E('sandedge_bard', async (ev) => {
    await ev.say('bard', T() >= 2 ? R.T('events.sandedge_bard.say') : R.T('events.sandedge_bard.say_2'));
  });

  // ================================================================ しんきろうの市
  E('desert_mirage_arrive', async (ev) => {
    const first = !ev.flag('desert_mirage_seen');
    ev.setFlag('desert_mirage_seen');
    ev.setFlag('desert_night', false);   // その晩の市は一度きり
    if (first) await ev.caption(R.T('events.desert_mirage_arrive.caption'), { ms: 2600 });
  }, { meta: { needs: ['flag:desert_night'], gives: ['flag:desert_mirage_seen'] } });
  const MIRAGE_PRICE = (t) => 500 + t * 350;
  E('desert_mirage_seller', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'm_seller_a';
    const k = { m_seller_a: 0, m_seller_b: 1, m_seller_c: 2 }[id] || 0;
    const data = R.DesertData && R.DesertData.mirage;
    const list = data ? (T() >= 3 ? data.high : data.low) : [];
    const item = list[k];
    if (!item || !R.DB.items[item]) { await ev.say(id, R.T('events.desert_mirage_seller.say')); return; }
    if (ev.has(item)) { await ev.say(id, R.T('events.desert_mirage_seller.say_2')); return; }
    const price = MIRAGE_PRICE(T());
    await ev.say(id, [R.T('events.desert_mirage_seller.say.0', { name: R.DB.items[item].name }), R.DB.items[item].desc || '']);
    const i = await ev.choose([R.T('events.desert_mirage_seller.i.choose.0', { price }), R.T('events.desert_mirage_seller.i.choose.1')], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say(id, R.T('events.desert_mirage_seller.say_3')); return; }
    ev.gold(-price);
    ev.item(item, 1);
    await ev.say(id, R.T('events.desert_mirage_seller.say_4'));
  }, { meta: { needs: ['flag:desert_mirage_seen'], gives: ['item:u_mirage_lamp|u_mirage_veil|u_mirage_dagger|u_mirage_harp|u_mirage_boots|u_mirage_bow'] } });
  E('desert_mirage_elder', async (ev) => {
    await ev.say('m_old', [R.T('events.desert_mirage_elder.say.0'), R.T('events.desert_mirage_elder.say.1'), cleared(ev) ? R.T('events.desert_mirage_elder.say.2') : R.T('events.desert_mirage_elder.say.2_2')]);
  });
  E('desert_mirage_child', async (ev) => {
    await ev.say('m_child', R.T('events.desert_mirage_child.say'));
  });
  E('desert_mirage_dancer', async (ev) => {
    await ev.say('m_dancer', cleared(ev) ? [R.T('events.desert_mirage_dancer.say.0')] : R.T('events.desert_mirage_dancer.say'));
  });
  E('desert_mirage_obelisk', async (ev) => {
    await ev.say(null, R.T('events.desert_mirage_obelisk.say'));
  });

  // ================================================================ 砂の鷹団のアジト
  E('desert_hawks_arrive', async (ev) => {
    if (!ev.flag('desert_hawk_met')) return;
    const c = X().hawk(ev);
    if (!ev.flag('desert_hawks_seen')) {
      ev.setFlag('desert_hawks_seen');
      await ev.caption(c === 'fight' ? R.T('events.desert_hawks_arrive.caption') : c === 'water' ? R.T('events.desert_hawks_arrive.caption_2') : R.T('events.desert_hawks_arrive.caption_3'), { ms: 2200 });
    }
  });
  E('desert_hawks_sentry', async (ev) => {
    await ev.say('sentry', R.T('events.desert_hawks_sentry.say'));
  });
  E('desert_hawks_member', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'hawk_door';
    const c = X().hawk(ev);
    const pain = ev.choiceOf('ch_desert_write') === 'pain';
    const lines = {
      hawk_door: c === 'water' ? R.T('events.desert_hawks_member.lines.hawk_door') : R.T('events.desert_hawks_member.lines.hawk_door_2'),
      hawk_cook: pain && cleared(ev) ? R.T('events.desert_hawks_member.lines.hawk_cook') : R.T('events.desert_hawks_member.lines.hawk_cook_2'),
      hawk_guard_l: R.T('events.desert_hawks_member.lines.hawk_guard_l'),
      hawk_guard_r: R.T('events.desert_hawks_member.lines.hawk_guard_r'),
    };
    await ev.say(id, lines[id] || R.T('events.desert_hawks_member.say'));
  });
  E('desert_hawks_old', async (ev) => {
    await ev.say('hawk_old', R.T('events.desert_hawks_old.say'));
    if (!ev.flag('desert_hawks_old_gift')) { ev.setFlag('desert_hawks_old_gift'); await ev.say('hawk_old', R.T('events.desert_hawks_old.say_2')); X().small(ev, [['i_smoke', 2], ['i_smoke', 3], ['i_bomb', 1], ['i_bomb', 2], ['i_bomb', 2]]); }
  });
  E('desert_hawks_shop', async (ev) => {
    const c = X().hawk(ev);
    await ev.say('hawk_shop', c === 'pay' ? R.T('events.desert_hawks_shop.say') : R.T('events.desert_hawks_shop.say_2'));
    await ev.shop('shop_hawks');
  });
  E('desert_hawks_water', async (ev) => {
    await ev.say(null, [R.T('events.desert_hawks_water.say.0'), X().hawk(ev) === 'water' ? R.T('events.desert_hawks_water.say.1') : R.T('events.desert_hawks_water.say.1_2')]);
  });
  E('desert_hawks_bunks', async (ev) => {
    await ev.say(null, R.T('events.desert_hawks_bunks.say'));
  });
  E('desert_hawks_memorial', async (ev) => {
    await ev.say(null, R.T('events.desert_hawks_memorial.say'));
  });
  E('desert_hawks_map_table', async (ev) => {
    await ev.say(null, R.T('events.desert_hawks_map_table.say'));
  });
  E('desert_hawks_rashid', async (ev) => {
    const c = X().hawk(ev);
    if (c === 'fight' && !ev.flag('desert_hawkhold_done')) { await ev.call('desert_hawks_boss'); return; }
    if (c === 'fight') {
      await ev.say('rashid', R.T('events.desert_hawks_rashid.say'));
      return;
    }
    if (!ev.flag('desert_hawks_rashid_gift')) {
      ev.setFlag('desert_hawks_rashid_gift');
      if (c === 'water') {
        await ev.say('rashid', R.T('events.desert_hawks_rashid.say_2'));
        ev.item('u_hawk_gloves', 1);
        if (!ev.has('k_tmap_3')) { ev.item('k_tmap_3', 1); ev.lead('l_tmap_3'); }
        return;
      }
      // pay: 中立。手袋は買う
      const price = X().gold(400);
      await ev.say('rashid', [R.T('events.desert_hawks_rashid.say.0'), R.T('events.desert_hawks_rashid.say.1', { price })]);
      const i = await ev.choose([R.T('events.desert_hawks_rashid.i.choose.0', { price }), R.T('events.desert_hawks_rashid.i.choose.1')], { cancel: 1 });
      if (i !== 0 || ev.gold(0) < price) { ev.setFlag('desert_hawks_rashid_gift', false); if (i === 0) await ev.say('rashid', R.T('events.desert_hawks_rashid.say_3')); return; }
      ev.gold(-price);
      ev.item('u_hawk_gloves', 1);
      await ev.say('rashid', R.T('events.desert_hawks_rashid.say_4'));
      return;
    }
    await ev.say('rashid', cleared(ev) ? R.T('events.desert_hawks_rashid.say_5') : R.T('events.desert_hawks_rashid.say_6'));
  }, { meta: { needs: ['flag:desert_hawk_met'], gives: ['item:u_hawk_gloves', 'item:k_tmap_3', 'lead:l_tmap_3'] } });
  E('desert_hawks_boss', async (ev) => {
    if (ev.flag('desert_hawkhold_done')) return;
    ev.bgm('tension');
    try { await ev.npc('rashid').face('s'); } catch (e) { /* */ }
    await ev.say('rashid', R.T('events.desert_hawks_boss.say'), { voice: ['v_rashid_hawks_01', 'v_rashid_hawks_02'] });
    const r = await ev.battle('tr_b_hawkhold', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_hawkhold_done');
    await ev.say('rashid', R.T('events.desert_hawks_boss.say_2'), { voice: ['v_rashid_hawks_03', 'v_rashid_hawks_04'] });
    ev.item('u_hawk_gloves', 1);
  }, { meta: { needs: ['flag:desert_hawk_met'], gives: ['flag:desert_hawkhold_done', 'item:u_hawk_gloves'] } });

  // ================================================================ 金剛トカゲの岩場
  E('desert_rocks_watcher', async (ev) => {
    await ev.say('watcher', R.T('events.desert_rocks_watcher.say'));
  });
  E('desert_rocks_scales', async (ev) => {
    await ev.say(null, R.T('events.desert_rocks_scales.say'));
  });

  // ================================================================ 古い野営跡・井戸の小屋
  E('desert_oldcamp_arrive', async (ev) => {
    await ev.caption(R.T('events.desert_oldcamp_arrive.caption'), { ms: 2400 });
  });
  E('desert_oldcamp_notes', async (ev) => {
    await ev.say(null, R.T('events.desert_oldcamp_notes.say'));
    await X().lore(ev, 'lo_desert_camp_notes');
  }, { meta: { needs: [], gives: ['flag:lo_desert_camp_notes'] } });
  E('desert_wellroom_keeper', async (ev) => {
    if (ev.flag('desert_thirst')) {
      await ev.say('wellkeeper', R.T('events.desert_wellroom_keeper.say'));
      ev.setFlag('desert_thirst', false);
      ev.rest();
      await ev.caption(R.T('events.desert_wellroom_keeper.caption'), { ms: 1600 });
      return;
    }
    await ev.say('wellkeeper', R.T('events.desert_wellroom_keeper.say_2'));
  });
  E('desert_wellroom_journal', async (ev) => {
    await ev.say(null, R.T('events.desert_wellroom_journal.say'));
  });

  // ================================================================ 砂に沈んだ神殿
  E('desert_temple_arrive', async (ev) => {
    await ev.caption(R.T('events.desert_temple_arrive.caption'), { ms: 2400 });
  });
  E('desert_temple_door', async (ev) => {
    const n = ['desert_tp_disc_1', 'desert_tp_disc_2', 'desert_tp_disc_3'].filter((f) => ev.flag(f)).length;
    await ev.say(null, [R.T('events.desert_temple_door.say.0'), R.T('events.desert_temple_door.say.1', { n })]);
  });
  E('desert_temple_claim', async (ev) => {
    await ev.say(null, R.T('events.desert_temple_claim.say'));
    if (T() >= 2) await ev.say(null, R.T('events.desert_temple_claim.say_2'));
  });
  E('desert_temple_disk', async (ev) => {
    await ev.say(null, R.T('events.desert_temple_disk.say'));
  });
  E('desert_temple_guard', async (ev) => {
    if (ev.flag('desert_temple_guard')) return;
    ev.sfx('shake');
    await ev.say(null, R.T('events.desert_temple_guard.say'));
    const r = await ev.battle('tr_desert_sun_guard', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_temple_guard');
    await ev.caption(R.T('events.desert_temple_guard.caption'), { ms: 1800 });
  }, { meta: { needs: [], gives: ['flag:desert_temple_guard'] } });
})(window.RPG);
