// CONTENT（砂漠）: カシムの小さな依頼（WORLD_REDESIGN §4.2 の小さな依頼 1〜5、§5.5）。どれも本筋に要らない・失っても何も失わない。
//   q_kasim_anklet   ナディアの足鈴 → 市場の子（なつめやしと取り替え）→ ナディアに u_nadia_bell
//   q_kasim_dig      井戸掘りのオマル → ワールドの 3 か所を掘る（当たりで小さな泉 = 町の外の回復の泉）→ u_well_charm
//   q_kasim_camel    ギルドの帳場 → 南東の砂丘のラクダを連れ帰る（ついてくる人）→ 品とお金
//   q_kasim_beacons  灯守組合のタデオ → 隊商路ののろし台 3 つに黒い泉の油（ワールドの waylamp）→ u_signal_mirror
//   q_kasim_salt     塩売りのカリム → 宿場「砂の縁」の行商人ロッタへ塩の包み → お金（ロッタの籠の品が増える）
//   q_kasim_maps     地図屋のヤズ → 宝の地図（ティアで 1 枚ずつ。行き先は地方をまたぐ = data だけ）
//   q_kasim_indigo   藍染めのライラ → 隠れ里ユラの母へ藍の布（地方をまたぐ依頼。ユラに人を 1 人足す）→ u_caravan_scarf
//   占い（まだ聞いていないうわさを 1 つ）・市場の屋台の値切り（R.Mini.timing。勝つと屋台が 15% 安い）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const objAt = (ctx, type, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === type && (!event || o.event === event) && o.x === ctx.x && o.y === ctx.y); };

  // 依頼の lead（side）とユラへの品
  R.def('leads', 'q_kasim_indigo', { kind: 'side', region: 'r_desert', title: R.T('leads.q_kasim_indigo.title'), from: R.T('leads.q_kasim_indigo.from'), place: 'yura', dir: R.T('leads.q_kasim_indigo.dir'),
    text: R.T('leads.q_kasim_indigo.text'), done: 'desert_indigo_done' });
  R.def('items', 'k_desert_indigo', { name: R.T('items.k_desert_indigo.name'), slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', icon: 'bag', sort: 9420,
    desc: R.T('items.k_desert_indigo.desc') });
  // ユラの村に、ライラの母を足す（地方をまたぐ依頼。村のファイルは編集しない）
  R.onData(function () {
    const m = R.DB.maps.yura;
    // 宿の前（戸口 6,17 の左）。前は (3, 16) = 宿の小屋の敷地（描いた石壁）の中に立っていた（tools/qa/check_props.js）
    if (m && !(m.npcs || []).some((n) => n.id === 'laila_mother')) {
      m.npcs.push({ id: 'laila_mother', look: 'npc_old_f_2', name: R.T('ev.desert_quests.laila_mother.name'), x: 3, y: 18, dir: 's', move: 'still', talk: 'desert_yura_mother', reward: 'side', key: 'yura_laila_mother', cond: 'yura_dyer_asked' });
    }
  });

  // ---------------------------------------------------------------- ナディアの足鈴
  E('kasim_nadia', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('desert_nadia_letter')) {
        ev.setFlag('desert_nadia_letter');
        await ev.say('nadia', R.T('events.kasim_nadia.say'));
        await ev.letter('letter_desert_nadia');
        return;
      }
      await ev.say('nadia', T(ev) >= 3 ? R.T('events.kasim_nadia.say_2') : R.T('events.kasim_nadia.say_3'));
      return;
    }
    if (!ev.flag('desert_nadia_met')) {
      ev.setFlag('desert_nadia_met');
      await ev.say('nadia', [R.T('events.kasim_nadia.say.0')], { voice: 'v_nadia_desert_01' });
      ev.sfx('bell');
      await ev.caption(X().SONG_BLANK, { ms: 4200, voice: X().SONG_VOICE.blank });
      await ev.say('nadia', R.T('events.kasim_nadia.say_4'), { voice: ['v_nadia_desert_02', 'v_nadia_desert_03'] });
      ev.lead('l_desert_song');
    }
    if (ev.flag('desert_anklet_done')) { await ev.say('nadia', R.T('events.kasim_nadia.say_5')); return; }
    if (ev.has('k_desert_anklet')) {
      await ev.say('nadia', [R.T('events.kasim_nadia.say.0_2')]);
      ev.take('k_desert_anklet', 1);
      await ev.say('nadia', R.T('events.kasim_nadia.say_6'));
      ev.item('u_nadia_bell', 1);
      ev.setFlag('desert_anklet_done');
      ev.leadDone('q_kasim_anklet');
      return;
    }
    if (!ev.flag('desert_anklet_asked')) {
      ev.setFlag('desert_anklet_asked');
      await ev.say('nadia', R.T('events.kasim_nadia.say_7'));
      ev.lead('q_kasim_anklet');
      return;
    }
    await ev.say('nadia', R.T('events.kasim_nadia.say_8'));
  }, { meta: { needs: [], gives: ['lead:l_desert_song', 'lead:q_kasim_anklet', 'flag:desert_anklet_done', 'item:u_nadia_bell'] } });
  const T = () => X().tier();

  E('kasim_child', async (ev) => {
    if (ev.flag('desert_anklet_done') || ev.flag('desert_anklet_traded')) { await ev.say('child_dates', cleared(ev) ? R.T('events.kasim_child.say') : R.T('events.kasim_child.say_2')); return; }
    if (!ev.flag('desert_anklet_asked')) { await ev.say('child_dates', R.T('events.kasim_child.say_3')); return; }
    if (ev.has('k_desert_dates')) {
      await ev.say('child_dates', R.T('events.kasim_child.say_4'));
      ev.take('k_desert_dates', 1);
      ev.item('k_desert_anklet', 1);
      ev.setFlag('desert_anklet_traded');
      return;
    }
    await ev.say('child_dates', R.T('events.kasim_child.say_5'));
  }, { meta: { needs: ['flag:desert_anklet_asked'], gives: ['item:k_desert_anklet', 'flag:desert_anklet_traded'] } });

  E('kasim_dates', async (ev) => {
    const price = 40;
    await ev.say('dates_vendor', cleared(ev) ? R.T('events.kasim_dates.say') : R.T('events.kasim_dates.say_2'));
    if (ev.has('k_desert_dates')) return;
    const i = await ev.choose([R.T('events.kasim_dates.i.choose.0', { price }), R.T('events.kasim_dates.i.choose.1')], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say('dates_vendor', R.T('events.kasim_dates.say_3')); return; }
    ev.gold(-price);
    ev.item('k_desert_dates', 1);
    await ev.say('dates_vendor', R.T('events.kasim_dates.say_4'));
  }, { meta: { needs: [], gives: ['item:k_desert_dates'] } });

  // ---------------------------------------------------------------- 井戸掘りの手伝い
  E('kasim_digger', async (ev) => {
    if (ev.flag('desert_dig_done')) { await ev.say('digger', cleared(ev) ? R.T('events.kasim_digger.say') : R.T('events.kasim_digger.say_2')); return; }
    if (ev.flag('desert_dig_found')) {
      await ev.say('digger', R.T('events.kasim_digger.say_3'));
      ev.take('k_desert_shovel', 1);
      ev.item('u_well_charm', 1);
      ev.setFlag('desert_dig_done');
      ev.leadDone('q_kasim_dig');
      return;
    }
    if (ev.flag('desert_dig_asked')) { await ev.say('digger', R.T('events.kasim_digger.say_4')); return; }
    await ev.say('digger', R.T('events.kasim_digger.say_5'));
    const i = await ev.choose(R.T('events.kasim_digger.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('desert_dig_asked');
    ev.item('k_desert_shovel', 1);
    ev.lead('q_kasim_dig');
    await ev.say('digger', R.T('events.kasim_digger.say_6'));
  }, { meta: { needs: [], gives: ['lead:q_kasim_dig', 'item:k_desert_shovel', 'flag:desert_dig_asked', 'flag:desert_dig_done', 'item:u_well_charm'] } });

  E('desert_dig', async (ev, ctx) => {
    const o = objAt(ctx, 'examine', 'desert_dig');
    const n = (o && o.dig) || 1;
    if (!ev.has('k_desert_shovel') && !ev.flag('desert_dig_done')) { await ev.say(null, R.T('events.desert_dig.say')); return; }
    if (ev.flag('desert_dig_' + n)) { await ev.say(null, n === 2 ? R.T('events.desert_dig.say_2') : R.T('events.desert_dig.say_3')); return; }
    ev.setFlag('desert_dig_' + n);
    ev.sfx('hit');
    if (n === 2) {
      await ev.say(null, R.T('events.desert_dig.say_4'));
      ev.setFlag('desert_dig_found');
      ev.sfx('spring');
      await ev.caption(R.T('events.desert_dig.caption'), { ms: 1800 });
      return;
    }
    if (n === 3) { await ev.say(null, R.T('events.desert_dig.say_5')); ev.gold(X().gold(60)); return; }
    await ev.say(null, R.T('events.desert_dig.say_6'));
  }, { meta: { needs: ['item:k_desert_shovel'], gives: ['flag:desert_dig_found', 'flag:desert_dig_1', 'flag:desert_dig_2', 'flag:desert_dig_3'] } });

  // ---------------------------------------------------------------- 迷子のラクダ
  E('kasim_guild_clerk', async (ev) => {
    if (ev.flag('desert_camel_done')) { await ev.say('guild_clerk', cleared(ev) ? R.T('events.kasim_guild_clerk.say') : R.T('events.kasim_guild_clerk.say_2')); return; }
    if (ev.flag('desert_camel_found')) {
      if (ev.flag('desert_camel_guest')) { ev.guest(null); ev.setFlag('desert_camel_guest', false); }
      await ev.say('guild_clerk', R.T('events.kasim_guild_clerk.say_3'));
      ev.gold(X().gold(150));
      X().small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
      ev.setFlag('desert_camel_done');
      ev.leadDone('q_kasim_camel');
      return;
    }
    if (ev.flag('desert_camel_asked')) { await ev.say('guild_clerk', R.T('events.kasim_guild_clerk.say_4')); return; }
    await ev.say('guild_clerk', R.T('events.kasim_guild_clerk.say_5'));
    ev.setFlag('desert_camel_asked');
    ev.item('k_desert_camel_rope', 1);
    ev.lead('q_kasim_camel');
  }, { meta: { needs: [], gives: ['lead:q_kasim_camel', 'flag:desert_camel_asked', 'flag:desert_camel_done'] } });

  E('desert_camel_world', async (ev) => {
    if (ev.flag('desert_camel_found')) return;
    await ev.say(null, R.T('events.desert_camel_world.say'));
    ev.take('k_desert_camel_rope', 1);
    ev.setFlag('desert_camel_found');
    if (ev.flag('desert_caravan_on')) {
      await ev.caption(R.T('events.desert_camel_world.caption'), { ms: 1800 });
    } else {
      ev.guest('ani_camel');
      ev.setFlag('desert_camel_guest');
      await ev.caption(R.T('events.desert_camel_world.caption_2'), { ms: 1800 });
    }
  }, { meta: { needs: ['flag:desert_camel_asked'], gives: ['flag:desert_camel_found'] } });

  // ---------------------------------------------------------------- 隊商路ののろし（灯りを守る）
  E('kasim_tadeo', async (ev) => {
    if (ev.flag('desert_beacons_done')) { await ev.say('tadeo', cleared(ev) ? R.T('events.kasim_tadeo.say') : R.T('events.kasim_tadeo.say_2')); return; }
    const n = ev.var('desert_beacons');
    if (n >= 3) {
      await ev.say('tadeo', R.T('events.kasim_tadeo.say_3'));
      ev.item('u_signal_mirror', 1);
      ev.setFlag('desert_beacons_done');
      ev.leadDone('q_kasim_beacons');
      return;
    }
    if (ev.flag('desert_beacons_asked')) { await ev.say('tadeo', R.T('events.kasim_tadeo.say_4', { p0: 3 - n })); return; }
    await ev.say('tadeo', R.T('events.kasim_tadeo.say_5'));
    ev.setFlag('desert_beacons_asked');
    ev.item('k_desert_oil', 1);
    ev.lead('q_kasim_beacons');
  }, { meta: { needs: [], gives: ['lead:q_kasim_beacons', 'item:k_desert_oil', 'flag:desert_beacons_asked', 'flag:desert_beacons_done', 'item:u_signal_mirror'] } });

  E('desert_beacon', async (ev, ctx) => {
    const o = objAt(ctx, 'waylamp');
    const m = o && /^wl_desert_beacon_(\d)$/.exec(o.id || '');
    if (!m) { await ev.say(null, R.T('events.desert_beacon.say')); return; }
    const key = 'q_kasim_beacon_' + m[1];
    if (ev.flag(key)) { await ev.say(null, R.T('events.desert_beacon.say_2')); return; }
    if (!ev.has('k_desert_oil')) { await ev.say(null, R.T('events.desert_beacon.say_3')); return; }
    await ev.say(null, R.T('events.desert_beacon.say_4'));
    ev.sfx('lamp');
    ev.setFlag(key);
    const n = ev.addVar('desert_beacons', 1);
    await ev.caption(R.T('events.desert_beacon.caption', { n }), { ms: 1600 });
    if (n >= 3) { ev.take('k_desert_oil', 1); await ev.caption(R.T('events.desert_beacon.caption_2'), { ms: 1600 }); }
  }, { meta: { needs: ['item:k_desert_oil'], gives: ['var:desert_beacons+1', 'flag:q_kasim_beacon_1', 'flag:q_kasim_beacon_2', 'flag:q_kasim_beacon_3'] } });

  // ---------------------------------------------------------------- 塩の包み（砂の縁のロッタへ）
  E('kasim_salt', async (ev) => {
    if (ev.flag('desert_salt_done')) { await ev.say('salt_vendor', R.T('events.kasim_salt.say')); return; }
    if (ev.flag('desert_salt_delivered')) {
      await ev.say('salt_vendor', R.T('events.kasim_salt.say_2'));
      ev.gold(X().gold(120));
      ev.setFlag('desert_salt_done');
      ev.leadDone('q_kasim_salt');
      return;
    }
    if (ev.flag('desert_salt_asked')) { await ev.say('salt_vendor', R.T('events.kasim_salt.say_3')); return; }
    await ev.say('salt_vendor', R.T('events.kasim_salt.say_4'));
    const i = await ev.choose(R.T('events.kasim_salt.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('desert_salt_asked');
    ev.item('k_desert_salt', 1);
    ev.lead('q_kasim_salt');
  }, { meta: { needs: [], gives: ['lead:q_kasim_salt', 'item:k_desert_salt', 'flag:desert_salt_asked', 'flag:desert_salt_done'] } });

  E('sandedge_lotta', async (ev) => {
    if (ev.has('k_desert_salt')) {
      await ev.say('lotta', R.T('events.sandedge_lotta.say'));
      ev.take('k_desert_salt', 1);
      ev.setFlag('desert_salt_delivered');
      ev.addVar('desert_lotta', 1);
    } else if (!ev.flag('desert_lotta_met')) {
      ev.setFlag('desert_lotta_met');
      await ev.say('lotta', R.T('events.sandedge_lotta.say_2'));
    } else {
      await ev.say('lotta', cleared(ev) ? R.T('events.sandedge_lotta.say_3') : R.T('events.sandedge_lotta.say_4'));
    }
    await ev.shop('shop_lotta');
  }, { meta: { needs: [], gives: ['flag:desert_salt_delivered', 'var:desert_lotta+1'] } });

  // ---------------------------------------------------------------- 地図屋のヤズ（宝の地図）
  const MAPS = [
    { id: 'k_tmap_3', lead: 'l_tmap_3', tier: 1, price: 600, pitch: R.T('ev.desert_quests.MAPS.k_tmap_3.pitch') },
    { id: 'k_tmap_5', lead: 'l_tmap_5', tier: 3, price: 1500, pitch: R.T('ev.desert_quests.MAPS.k_tmap_5.pitch') },
    { id: 'k_tmap_6', lead: 'l_tmap_6', tier: 5, price: 3000, pitch: R.T('ev.desert_quests.MAPS.k_tmap_6.pitch') },
    // マレア諸島の座礁した商船で「積荷を拾う」を選んだ人にだけ: 船長がヤズに売っていった地図 その4（助けた人は船長から直にもらう）
    { id: 'k_tmap_4', lead: null, tier: 1, price: 1200, pitch: R.T('ev.desert_quests.MAPS.k_tmap_4.pitch'), cond: (ev) => ev.choiceOf('ch_isles_wreck') === 'cargo' },
  ];
  E('kasim_mapmaker', async (ev) => {
    ev.lead('q_kasim_maps');
    const t = T();
    const can = MAPS.filter((m) => t >= m.tier && !ev.has(m.id) && (!m.cond || m.cond(ev)));
    if (!can.length) {
      const next = MAPS.find((m) => t < m.tier && !ev.has(m.id) && (!m.cond || m.cond(ev)));
      await ev.say('mapmaker', next ? R.T('events.kasim_mapmaker.say') : R.T('events.kasim_mapmaker.say_2'));
      return;
    }
    const m = can[0];
    await ev.say('mapmaker', [R.T('events.kasim_mapmaker.say.0'), m.pitch]);
    const i = await ev.choose([R.T('events.kasim_mapmaker.i.choose.0', { price: m.price }), R.T('events.kasim_mapmaker.i.choose.1')], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < m.price) { await ev.say('mapmaker', R.T('events.kasim_mapmaker.say_3')); return; }
    ev.gold(-m.price);
    ev.item(m.id, 1);
    if (m.lead) ev.lead(m.lead);
    await ev.say('mapmaker', R.T('events.kasim_mapmaker.say_4'));
  }, { meta: { needs: [], gives: ['lead:q_kasim_maps', 'item:k_tmap_3', 'item:k_tmap_4', 'item:k_tmap_5', 'item:k_tmap_6', 'lead:l_tmap_3', 'lead:l_tmap_5', 'lead:l_tmap_6'] } });
  E('kasim_mapshop_wall', async (ev) => {
    await ev.say(null, R.T('events.kasim_mapshop_wall.say'));
  });

  // ---------------------------------------------------------------- 占い（まだ聞いていないうわさを 1 つ）
  const FORTUNE = [
    ['l_opt_mirage', R.T('ev.desert_quests.FORTUNE.0.1')],
    ['l_opt_temple', R.T('ev.desert_quests.FORTUNE.1')],
    ['l_opt_rocks', R.T('ev.desert_quests.FORTUNE.2.1')],
    ['l_opt_hawknest', R.T('ev.desert_quests.FORTUNE.3.1')],
    ['l_opt_sandedge', R.T('ev.desert_quests.FORTUNE.4.1')],
  ];
  E('kasim_fortune', async (ev) => {
    const price = X().gold(50);
    await ev.say('fortune', [R.T('events.kasim_fortune.say.0')]);
    const i = await ev.choose([R.T('events.kasim_fortune.i.choose.0', { price }), R.T('events.kasim_fortune.i.choose.1')], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say('fortune', R.T('events.kasim_fortune.say')); return; }
    const f = FORTUNE.find(([id]) => !((R.Game.leads && R.Game.leads[id]) || ev.flag('desert_fortune_' + id)));
    if (!f) { await ev.say('fortune', R.T('events.kasim_fortune.say_2')); return; }
    ev.gold(-price);
    ev.sfx('magic');
    await ev.say('fortune', f[1]);
    ev.setFlag('desert_fortune_' + f[0]);
    ev.lead(f[0]);
  }, { meta: { needs: [], gives: ['lead:l_opt_mirage', 'lead:l_opt_temple', 'lead:l_opt_rocks', 'lead:l_opt_hawknest', 'lead:l_opt_sandedge'] } });

  // ---------------------------------------------------------------- 市場の屋台（値切り）
  E('kasim_bazaar', async (ev) => {
    await ev.say('bazaar', cleared(ev) ? R.T('events.kasim_bazaar.say') : R.T('events.kasim_bazaar.say_2'));
    const opts = ev.flag('desert_haggled') ? R.T('events.kasim_bazaar.opts') : R.T('events.kasim_bazaar.opts_2');
    const i = await ev.choose(opts, { cancel: opts.length - 1 });
    if (opts[i] === R.T('events.kasim_dates.i.choose.1')) return;
    if (opts[i] === R.T('events.kasim_bazaar')) {
      await ev.say('bazaar', R.T('events.kasim_bazaar.say_3'));
      const r = await ev.mini.timing({ title: R.T('events.kasim_bazaar.r.title'), tries: 3, speed: 1300, zones: [[0.4, 0.56]] });
      if (r && r.hits >= 2) {
        ev.setFlag('desert_haggled');
        await ev.say('bazaar', R.T('events.kasim_bazaar.say_4'));
      } else {
        await ev.say('bazaar', R.T('events.kasim_bazaar.say_5'));
      }
    }
    await ev.shop('shop_kasim_bazaar');
  }, { meta: { needs: [], gives: ['flag:desert_haggled'] } });

  // ---------------------------------------------------------------- 藍の布（ユラへ）
  E('kasim_yura_dyer', async (ev) => {
    if (ev.flag('desert_indigo_done')) { await ev.say('yura_returnee', R.T('events.kasim_yura_dyer.say')); return; }
    if (ev.flag('yura_dyer_home')) {
      await ev.say('yura_returnee', R.T('events.kasim_yura_dyer.say_2'));
      ev.item('u_caravan_scarf', 1);
      ev.setFlag('desert_indigo_done');
      ev.leadDone('q_kasim_indigo');
      return;
    }
    if (ev.flag('yura_dyer_asked')) { await ev.say('yura_returnee', R.T('events.kasim_yura_dyer.say_3')); return; }
    await ev.say('yura_returnee', R.T('events.kasim_yura_dyer.say_4'));
    const i = await ev.choose(R.T('events.kasim_yura_dyer.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('yura_dyer_asked');
    ev.item('k_desert_indigo', 1);
    ev.lead('q_kasim_indigo');
  }, { meta: { needs: [], gives: ['lead:q_kasim_indigo', 'item:k_desert_indigo', 'flag:yura_dyer_asked', 'flag:desert_indigo_done', 'item:u_caravan_scarf'] } });

  E('desert_yura_mother', async (ev) => {
    if (ev.flag('yura_dyer_home')) { await ev.say('laila_mother', R.T('events.desert_yura_mother.say')); return; }
    if (!ev.has('k_desert_indigo')) { await ev.say('laila_mother', R.T('events.desert_yura_mother.say_2')); return; }
    await ev.say(null, R.T('events.desert_yura_mother.say_3'));
    ev.take('k_desert_indigo', 1);
    await ev.say('laila_mother', R.T('events.desert_yura_mother.say_4'));
    ev.setFlag('yura_dyer_home');
  }, { meta: { needs: ['item:k_desert_indigo'], gives: ['flag:yura_dyer_home'] } });
})(window.RPG);
