// 雪原の小さな依頼と、雪の林・ワールドのイベント（WORLD_REDESIGN §4.3「小さな依頼」・§5.1・§1.3・E8・E21、V2_PLAN §3.4 の形）
//   どれも本筋に要らない・失っても何も失わない（祭の支度の薪だけは本筋。雪の林の woods_log）。
//   q_snow_fishing  氷上の釣り大会（釣り小屋のトーレ。R.Mini.timing、3 段。段ごとに品。三段目は一品物）
//   q_snow_dog      迷子のそり犬（雪の林の北東で見つけて連れ帰る。E8 ついてくる人）→ そり犬の渡し（凍った湖を越えて北の流氷原へ）
//   q_snow_statue   雪像づくり（リーサ。飾りの材料 3 つ → 像の形を選ぶ。広場の見た目と小さな品）
//   q_snow_base     子どもの秘密基地（合言葉は町の子のほのめかしから。見える宝箱。町なので隠し通路にはしない）
//   q_snow_lamps    【灯りを守る】峠の道しるべ（解決の後、冬至の火のおすそ分けで消えた灯籠 3 つに火を。周り 5 マスは魔物が出ない）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const objAt = (ctx, type, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === type && (!event || o.event === event) && o.x === ctx.x && o.y === ctx.y); };

  // ================================================================ 氷上の釣り大会
  const FISH = [
    { label: R.T('ev.snow_quests.FISH.0.label'), speed: 1500, zones: [[0.36, 0.64]], need: 'B', reward: ['i_ether', 2] },
    { label: R.T('ev.snow_quests.FISH.1.label'), speed: 1150, zones: [[0.4, 0.6]], need: 'A', reward: ['hd_yeti_fur', 1] },
    { label: R.T('ev.snow_quests.FISH.2.label'), speed: 850, zones: [[0.44, 0.56]], need: 'S', reward: ['u_ice_rod_charm', 1] },
  ];
  const RANK = { S: 3, A: 2, B: 1, C: 0 };
  E('snow_fishing_talk', async (ev) => {
    if (!ev.flag('snow_fish_met')) {
      await ev.say('fisher', R.T('events.snow_fishing_talk.say'));
      ev.setFlag('snow_fish_met');
      ev.lead('q_snow_fishing');
    }
    if (ev.flag('snow_saw') && !ev.flag('snow_ice_done')) await ev.say('fisher', R.T('events.snow_fishing_talk.say_2'));
    else if (ev.flag('snow_fish_3')) await ev.say('fisher', R.T('events.snow_fishing_talk.say_3'));
    else await ev.say('fisher', R.T('events.snow_fishing_talk.say_4'));
  }, { meta: { needs: [], gives: ['flag:snow_fish_met', 'lead:q_snow_fishing'] } });

  E('yule_fish_hole', async (ev) => {
    if (!ev.flag('snow_fish_met')) { await ev.say(null, R.T('events.yule_fish_hole.say')); return; }
    const labels = FISH.map((f, i) => f.label + (ev.flag('snow_fish_' + (i + 1)) ? R.T('events.yule_fish_hole.labels') : ''));
    const i = await ev.choose(labels.concat([R.T('events.yule_fish_hole.i.choose.0')]), { cancel: FISH.length, text: R.T('events.yule_fish_hole.i.choose.text') });
    if (i >= FISH.length || i < 0) return;
    if (i > 0 && !ev.flag('snow_fish_' + i)) { await ev.say('fisher', R.T('events.yule_fish_hole.say_2'), { name: R.T('events.yule_fish_hole.say.name') }); return; }
    const f = FISH[i];
    const r = (await ev.mini.timing({ title: R.T('events.yule_fish_hole.r.title', { label: f.label }), speed: f.speed, zones: f.zones, tries: 3, theme: 'night' })) || {};
    if ((RANK[r.rank] || 0) < RANK[f.need]) { await ev.say('fisher', R.T('events.yule_fish_hole.say_3'), { name: R.T('events.yule_fish_hole.say.name') }); return; }
    const key = 'snow_fish_' + (i + 1);
    if (ev.flag(key)) { await ev.caption(R.T('events.yule_fish_hole.caption'), { ms: 1400 }); return; }
    ev.setFlag(key);
    ev.sfx('item');
    await ev.caption(R.T('events.yule_fish_hole.caption'), { ms: 1400 });
    await ev.say('fisher', i === 2 ? R.T('events.yule_fish_hole.say_4') : R.T('events.yule_fish_hole.say_5'), { name: R.T('events.yule_fish_hole.say.name') });
    ev.item(f.reward[0], f.reward[1]);
    if (i === 2) ev.leadDone('q_snow_fishing');
  }, { meta: { needs: ['flag:snow_fish_met'], gives: ['flag:snow_fish_1', 'flag:snow_fish_2', 'flag:snow_fish_3'] } });

  // ================================================================ 迷子のそり犬 → そり犬の渡し
  E('yule_sled', async (ev) => {
    if (ev.flag('snow_dog_found') && !ev.flag('snow_dog_home')) {
      await ev.say('sled_man', R.T('events.yule_sled.say'));
      ev.guest(null);
      ev.setFlag('snow_dog_home');
      ev.leadDone('q_snow_dog');
      await ev.say('sled_man', R.T('events.yule_sled.say_2'));
      ev.gold(X().tier() * 60 + 120);
      return;
    }
    if (ev.flag('snow_dog_home')) {
      const i = await ev.choose(R.T('events.yule_sled.i.choose'), { cancel: 1, who: 'sled_man', text: R.T('events.yule_sled.i.choose.text') });
      if (i !== 0) return;
      await ev.fade('out', 500);
      await ev.caption(R.T('events.yule_sled.caption'), { ms: 2400 });
      await ev.warp('f_floe', 'landing');   // 北の流氷原のエリアのそりの着き場
      return;
    }
    if (!ev.flag('snow_dog_asked')) {
      await ev.say('sled_man', R.T('events.yule_sled.say_3'));
      await ev.say('sled_man', [R.T('events.yule_sled.say.0')]);
      ev.setFlag('snow_dog_asked');
      ev.lead('q_snow_dog');
      return;
    }
    await ev.say('sled_man', R.T('events.yule_sled.say_4'));
  }, { meta: { needs: [], gives: ['flag:snow_dog_asked', 'lead:q_snow_dog', 'flag:snow_dog_home'] } });
  E('yule_dog', async (ev) => { await ev.say('sled_dog', R.T('events.yule_dog.say'), { name: R.T('events.yule_dog.say.name') }); });
  E('snow_woods_dog', async (ev) => {
    if (ev.flag('snow_dog_found')) return;
    await ev.say(null, R.T('events.snow_woods_dog.say'));
    if (!ev.flag('snow_dog_asked')) { await ev.say(null, R.T('events.snow_woods_dog.say_2')); ev.lead('q_snow_dog'); return; }
    await ev.say('lost_dog', R.T('events.snow_woods_dog.say_3'), { name: R.T('events.snow_woods_dog.say.name') });
    ev.setFlag('snow_dog_found');
    await ev.fade('out', 300);
    try { await ev.npc('lost_dog').hide(); } catch (e) { /* */ }
    ev.guest('ani_dog');
    await ev.fade('in', 300);
    await ev.caption(R.T('events.snow_woods_dog.caption'), { ms: 2200 });
  }, { meta: { needs: ['flag:snow_dog_asked'], gives: ['flag:snow_dog_found'] } });

  // 北の流氷原の上陸の場所（そりで帰る）
  E('world_snow_floe_sled', async (ev) => {
    if (ev.flag('cleared_r_snow')) { await ev.say(null, R.T('events.world_snow_floe_sled.say')); }
    if (!ev.flag('snow_dog_home')) return;
    const i = await ev.choose(R.T('events.world_snow_floe_sled.i.choose'), { cancel: 1, text: R.T('events.world_snow_floe_sled.i.choose.text') });
    if (i !== 0) return;
    await ev.fade('out', 500);
    await ev.warp('yule', 'sled');
  }, { meta: { needs: [], gives: [] } });

  // ================================================================ 雪像づくり
  const MATS = { snow_mat_ice: R.T('ev.snow_quests.MATS.snow_mat_ice'), snow_mat_coal: R.T('ev.snow_quests.MATS.snow_mat_coal'), snow_mat_berry: R.T('ev.snow_quests.MATS.snow_mat_berry') };
  E('yule_sculptor', async (ev) => {
    if (ev.flag('snow_statue_done')) { await ev.say('sculptor', R.T('events.yule_sculptor.say')); return; }
    if (!ev.flag('snow_statue_asked')) {
      await ev.say('sculptor', R.T('events.yule_sculptor.say_2'));
      await ev.say('sculptor', R.T('events.yule_sculptor.say_3'));
      ev.setFlag('snow_statue_asked');
      ev.lead('q_snow_statue');
      return;
    }
    const got = Object.keys(MATS).filter((k) => ev.flag(k));
    if (got.length < 3) { await ev.say('sculptor', [R.T('events.yule_sculptor.say.0', { p0: 3 - got.length }), R.T('events.yule_sculptor.say.1', { list: Object.keys(MATS).filter((k) => !ev.flag(k)).map((k) => MATS[k]).join(R.T('events.yule_sculptor.say.1.join')) })]); return; }
    const i = await ev.choose(R.T('events.yule_sculptor.i.choose'), { text: R.T('events.yule_sculptor.i.choose.text') });
    const c = ['dragon', 'wolf', 'hearth'][i] || 'dragon';
    ev.choice('ch_snow_statue', c);
    await ev.fade('out', 500);
    await ev.caption(R.T('events.yule_sculptor.caption'), { ms: 2400 });
    ev.setFlag('snow_statue_done');
    await ev.fade('in', 500);
    ev.leadDone('q_snow_statue');
    await ev.say('sculptor', R.T('events.yule_sculptor.say_4'));
    X().small(ev, [['i_potion', 3], ['i_potion', 4], ['i_incense', 2], ['i_incense', 3], ['i_incense', 3], ['i_elixir', 3]]);   // 表はティア順。癒やしの霊水（全回復）は終盤（ティア 5）から（オーナー 2026-09-28）
  }, { meta: { needs: [], gives: ['flag:snow_statue_asked', 'lead:q_snow_statue', 'flag:snow_statue_done', 'choice:ch_snow_statue'] } });
  // 材料（ついでに拾える所。雪像を頼まれていなくても拾える）
  E('snow_mat', async (ev, ctx) => {
    const o = objAt(ctx, 'examine');
    const k = o && o.mat;
    if (!k || ev.flag(k)) { await ev.say(null, R.T('events.snow_mat.say')); return; }
    ev.setFlag(k);
    ev.sfx('item');
    await ev.caption(R.T('events.snow_mat.caption', { p0: MATS[k] }), { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:snow_mat_ice', 'flag:snow_mat_coal', 'flag:snow_mat_berry'] } });

  // ================================================================ 子どもの秘密基地（合言葉）
  E('yule_base_kid', async (ev) => {
    if (ev.flag('snow_base_open')) return;
    await ev.say('base_kid', R.T('events.yule_base_kid.say'));
    ev.lead('q_snow_base');
    const i = await ev.choose(R.T('events.yule_base_kid.i.choose'), { cancel: 3 });
    if (i === 2) {
      await ev.say('base_kid', R.T('events.yule_base_kid.say_2'));
      ev.setFlag('snow_base_open');
      ev.leadDone('q_snow_base');
      // ペッカは基地の穴（戸）へ歩いて入り、薄れて消える（パッと消さない。戸の音）
      try { await ev.npc('base_kid').face('n'); } catch (e) { /* */ }
      ev.sfx('door');
      try { await ev.leave('base_kid', { path: [[36, 40]], ms: 520 }); } catch (e) { /* */ }
      return;
    }
    await ev.say('base_kid', i === 3 ? R.T('events.yule_base_kid.say_3') : R.T('events.yule_base_kid.say_4'));
  }, { meta: { needs: [], gives: ['flag:snow_base_open', 'lead:q_snow_base'] } });

  // ================================================================ 【灯りを守る】峠の道しるべ
  E('snow_waylamp', async (ev, ctx) => {
    const o = objAt(ctx, 'waylamp');
    const n = o ? +String(o.id).replace(/\D/g, '') : 1;
    const f = 'q_snow_lamps_' + n;
    if (ev.flag(f)) { await ev.say(null, R.T('events.snow_waylamp.say')); return; }
    if (!ev.has('k_yule_ember')) { await ev.say(null, R.T('events.snow_waylamp.say_2')); return; }
    await ev.say(null, R.T('events.snow_waylamp.say_3'));
    ev.setFlag(f);
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    await ev.caption(R.T('events.snow_waylamp.caption'), { ms: 2200 });
    if ([1, 2, 3].every((k) => ev.flag('q_snow_lamps_' + k)) && !ev.flag('snow_lamps_done')) {
      ev.setFlag('snow_lamps_done');
      ev.leadDone('q_snow_lamps');
      await ev.caption(R.T('events.snow_waylamp.caption_2'), { ms: 1800 });
      X().small(ev, [['gold', 200], ['gold', 260], ['gold', 340], ['gold', 420], ['gold', 520], ['gold', 640], ['gold', 780], ['gold', 900]]);
    }
  }, { meta: { needs: ['item:k_yule_ember'], gives: ['flag:q_snow_lamps_1', 'flag:q_snow_lamps_2', 'flag:q_snow_lamps_3', 'flag:snow_lamps_done'] } });

  // ================================================================ 雪の林（薪集め・雪男・野営地）
  E('snow_woods_arrive', async (ev) => {
    await ev.caption(R.T('events.snow_woods_arrive.caption'), { ms: 2400 });
  });
  E('snow_woods_camp', async (ev) => {
    // ④ ほのめかし・⑤
    if (!ev.flag('snow_woods_camp_given')) {
      await ev.say('woods_hunter', R.T('events.snow_woods_camp.say'));
      ev.item('i_salve', 3);
      ev.setFlag('snow_woods_camp_given');
    }
    await ev.say('woods_hunter', R.T('events.snow_woods_camp.say_2'));
  }, { meta: { needs: [], gives: ['flag:snow_woods_camp_given'] } });
  E('snow_woods_yeti', async (ev) => {
    if (ev.flag('snow_woods_yeti')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.snow_woods_yeti.say'));
    ev.sfx('roar');
    const r = await ev.battle('tr_snow_woods_yeti');
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_woods_yeti');
    await ev.say(null, R.T('events.snow_woods_yeti.say_2'));
  }, { meta: { needs: [], gives: ['flag:snow_woods_yeti'] } });
  E('snow_woods_log', async (ev, ctx) => {
    const o = objAt(ctx, 'examine', 'snow_woods_log');
    const n = (o && o.log) || 1;
    const f = 'snow_log_' + n;
    if (ev.flag(f)) { await ev.say(null, R.T('events.snow_woods_log.say')); return; }
    if (n === 2 && !ev.flag('snow_woods_yeti')) { await ev.call('snow_woods_yeti'); if (!ev.flag('snow_woods_yeti')) return; }
    await ev.say(null, R.T('events.snow_woods_log.say_2'));
    ev.setFlag(f);
    ev.sfx('item');
    const k = ev.addVar('snow_logs', 1);
    await ev.caption(R.T('events.snow_woods_log.caption', { k }), { ms: 1800 });
    if (k >= 3 && !ev.flag('snow_logs_done')) {
      ev.setFlag('snow_logs_done');
      ev.item('k_yule_logs', 1);
      await ev.caption(R.T('events.snow_woods_log.caption_2'), { ms: 2200 });
    }
  }, { meta: { needs: [], gives: ['flag:snow_log_1', 'flag:snow_log_2', 'flag:snow_log_3', 'flag:snow_logs_done', 'item:k_yule_logs', 'var:snow_logs+3'], calls: ['snow_woods_yeti'] } });

  // ================================================================ 雪原のエリアの景色（調べる所。どれも本筋に要らない）
  E('snow_pass_cairn', async (ev) => {
    await ev.say(null, R.T('events.snow_pass_cairn.say'));
  });
  E('snow_pass_hut', async (ev) => {
    await ev.say(null, R.T('events.snow_pass_hut.say'));
  });
  E('snow_foot_bones', async (ev) => {
    await ev.say(null, X().cleared(ev) ? R.T('events.snow_foot_bones.say') : R.T('events.snow_foot_bones.say_2'));
  });
  E('snow_foot_shrine', async (ev) => {
    await ev.say(null, X().cleared(ev) ? R.T('events.snow_foot_shrine.say') : R.T('events.snow_foot_shrine.say_2'));
  });
  E('snow_road_hut', async (ev) => {
    await ev.say(null, R.T('events.snow_road_hut.say'));
  });
  E('snow_pass_springs', async (ev) => {
    await ev.say(null, R.T('events.snow_pass_springs.say'));
  });

  // ================================================================ ワールドの雪原（今は雪原のエリアの上）
  E('world_snow_lake', async (ev) => {
    if (ev.flag('cleared_r_snow')) { await ev.say(null, R.T('events.world_snow_lake.say')); return; }
    await ev.say(null, R.T('events.world_snow_lake.say_2'));
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  E('world_snow_fox', async (ev) => {
    await ev.say(null, R.T('events.world_snow_fox.say'));
    if (!ev.flag('snow_fox_seen')) { ev.setFlag('snow_fox_seen'); ev.item('k_fox_charm', 1); ev.lead('l_snow_fox'); }
  }, { meta: { needs: [], gives: ['flag:snow_fox_seen', 'lead:l_snow_fox'] } });
  E('world_snow_trapper', async (ev) => {
    // ④ ほのめかし（つららの回廊）・⑥
    await ev.say('snow_trapper', R.T('events.world_snow_trapper.say'));
    ev.lead('l_opt_icicle');
  }, { meta: { needs: [], gives: ['lead:l_opt_icicle'] } });
  E('world_snow_pilgrim', async (ev) => {
    // ⑦ 近況・寄り道
    await ev.say('snow_pilgrim', X().cleared(ev) ? R.T('events.world_snow_pilgrim.say') : R.T('events.world_snow_pilgrim.say_2'));
    ev.lead('l_opt_pass_inn');
  }, { meta: { needs: [], gives: ['lead:l_opt_pass_inn'] } });
  E('world_snow_scout', async (ev) => {
    // ⑥ ボスの癖
    await ev.say('snow_scout', X().cleared(ev) ? R.T('events.world_snow_scout.say') : R.T('events.world_snow_scout.say_2'));
  });
})(window.RPG);
