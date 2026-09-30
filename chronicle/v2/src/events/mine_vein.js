// CONTENT（ガルド山地）: 深淵の鉱脈（#17。WORLD_REDESIGN §2.7・§6.4・A25）。七の層の番人の広間の東のすみの縦穴から下りる 3 階。
//   開く: mine_vein_open（組合 A・仲裁 C。締めの場面で旗が立つ）か、ティア 6。閉じている間の縦穴は「縄ばしごが無い」。
//   1 階: トロッコ（裂け目の架台を渡る）。2 階: 宝石ハリネズミの巣・休息の灯。3 階: 隠しボス 鉱脈の主（強さ固定）→ 鉱脈の斧 u_vein_axe。
//   旗: vein_seen・vein_f2_seen・vein_f3_seen・mine_vein_lord（倒した）。手がかり l_opt_vein（寄り道のうわさ）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const objAt = (ctx, event) => { const m = ctx && R.DB.maps[ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };

  // 七の層の広間の東のすみの縦穴（閉じている間）
  E('mine_vein_shaft', async (ev) => {
    await ev.say(null, R.T('events.mine_vein_shaft.say'));
    ev.lead('l_opt_vein');
  }, { meta: { needs: [], gives: ['lead:l_opt_vein'] } });

  E('vein_arrive', async (ev) => {
    if (ev.flag('vein_seen')) return;
    ev.setFlag('vein_seen');
    ev.leadDone('l_opt_vein');
    await ev.caption(R.T('events.vein_arrive.caption'), { ms: 2400 });
    await ev.caption(R.T('events.vein_arrive.caption_2'), { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:vein_seen'] } });
  E('vein_f2_arrive', async (ev) => {
    if (ev.flag('vein_f2_seen')) return;
    ev.setFlag('vein_f2_seen');
    await ev.caption(R.T('events.vein_f2_arrive.caption'), { ms: 2400 });
  });
  E('vein_f3_arrive', async (ev) => {
    if (ev.flag('vein_f3_seen') || ev.flag('mine_vein_lord')) return;
    ev.setFlag('vein_f3_seen');
    await ev.caption(R.T('events.vein_f3_arrive.caption'), { ms: 2400 });
  });

  // トロッコ（1 階の裂け目の架台。乗り場の縁の架台を調べる）
  E('vein_cart_ride', async (ev, ctx) => {
    const o = objAt(ctx, 'vein_cart_ride');
    const to = (o && o.ride) || 'cart_e';
    await ev.say(null, R.T('events.vein_cart_ride.say'));
    const i = await ev.choose(R.T('events.vein_cart_ride.i.choose'), { text: R.T('events.vein_cart_ride.i.choose.text') });
    if (i !== 0) return;
    ev.sfx('earth');
    await ev.fade('out', 400);
    await ev.caption(R.T('events.vein_cart_ride.caption'), { ms: 1800 });
    await ev.warp('vein_1', to);
    await ev.fade('in', 400);
  }, { meta: { needs: [], gives: [], warp: { to: 'vein_1', spawn: 'cart_e' } } });

  E('vein_nest_note', async (ev) => {
    await ev.say(null, R.T('events.vein_nest_note.say'));
  });

  // 3 階: 鉱脈の心臓（北の壁）と、鉱脈の主
  E('vein_heart', async (ev) => {
    if (ev.flag('mine_vein_lord')) { await ev.say(null, R.T('events.vein_heart.say')); return; }
    await ev.say(null, R.T('events.vein_heart.say_2'));
  });
  E('vein_lord', async (ev) => {
    if (ev.flag('mine_vein_lord')) return;
    ev.bgm('omen');
    ev.sfx('roar');
    await ev.say(null, R.T('events.vein_lord.say'));
    const i = await ev.choose(R.T('events.vein_lord.i.choose'), { cancel: 1, text: R.T('events.vein_lord.i.choose.text') });
    if (i !== 0) { ev.mapBgm(); await ev.say(null, R.T('events.vein_lord.say_2')); return; }
    const r = await ev.battle('tr_b_vein_lord', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('mine_vein_lord');
    ev.leadDone('l_opt_vein');
    await ev.say(null, R.T('events.vein_lord.say_3'));
  }, { meta: { needs: [], gives: ['flag:mine_vein_lord'] } });
})(window.RPG);
