// 霧の館・鐘沈みの沼と湿原の締め（WORLD_REDESIGN §4.4 の 2・4・5・§4.10、STORY_BIBLE §7.4・§11.8）
//   館: manor_arrive・書庫の楽譜の書き付け（オルゴールの順）・2 階のオルゴール 3 つ（任意の隠し箱）・音楽室の人形の楽団（tr_b_dolls）→
//       メルダ（v_melda_manor_01〜05 の文のまま。証拠 5、鐘の鍵、鐘の歌）
//   沼: bog_arrive・鐘 3 つ（鐘の鍵で鳴らすと水が引く）・霧食らい（v_mistwitch_marsh_01 → tr_b_mistbeast → v_melda_marsh_01）→
//       marsh_finale（子どもたちが見つかる → ev.clearRegion('r_marsh') → ロッホで朝の鐘・七つの鐘楼の灯・クラウスの墨の楽譜・日継ぎの主張 →
//       年代記に書く選択 ch_marsh_write → 帽子かおわびの品）
//   ワールド: 沼の縁の鐘の歌の石碑（証拠 6）・沼の入口の霧の壁・山あいの街道の旅人。
//   録音済みの文は 1 字も変えずに地の文として置く（声はあとで）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Marsh.ev;
  const objAt = (ctx, map, event) => { const m = R.DB.maps[map]; return m && ctx && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const MELDA = { name: R.T('ev.marsh_dungeons.MELDA.name') };
  const WITCH = { name: R.T('ev.marsh_dungeons.WITCH.name'), face: false };

  // ================================================================ 霧の館
  E('manor_arrive', async (ev) => {
    if (X().cleared(ev)) { await ev.caption(R.T('events.manor_arrive.caption'), { ms: 2000 }); return; }
    await ev.caption(R.T('events.manor_arrive.caption_2'), { ms: 2600 });
  });
  E('manor_2_arrive', async (ev) => {
    if (ev.flag('marsh_dolls')) return;
    await ev.caption(R.T('events.manor_2_arrive.caption'), { ms: 2000 });
  });
  E('manor_sheet', async (ev) => {
    ev.setFlag('marsh_sheet_read');
    await ev.say(null, R.T('events.manor_sheet.say'));
  }, { meta: { needs: [], gives: ['flag:marsh_sheet_read'] } });
  E('manor_portrait', async (ev) => {
    await ev.say(null, R.T('events.manor_portrait.say'));
  });
  E('manor_fountain', async (ev) => {
    await ev.say(null, ev.flag('marsh_melda_met') ? R.T('events.manor_fountain.say') : R.T('events.manor_fountain.say_2'));
  });
  E('manor_dining', async (ev) => { await ev.say(null, [R.T('events.manor_dining.say.0')]); });
  E('manor_stand', async (ev) => {
    await ev.say(null, ev.flag('marsh_dolls') ? R.T('events.manor_stand.say') : R.T('events.manor_stand.say_2'));
  });
  E('manor_mirror', async (ev) => {
    await ev.say(null, [R.T('events.manor_mirror.say.0'), X().cleared(ev) ? R.T('events.manor_mirror.say.1') : R.T('events.manor_mirror.say.1_2')]);
  });
  // オルゴール 3 つ（弦・笛・太鼓の順。任意。そろうと回廊の飾り棚に箱が現れる）
  E('manor_musicbox', async (ev, ctx) => {
    const o = objAt(ctx, 'marsh_manor_2', 'manor_musicbox');
    const box = (o && o.box) || 'strings';
    const ORDER = ['strings', 'flute', 'drum'];
    const NAME = { strings: R.T('events.manor_musicbox.NAME.strings'), flute: R.T('events.manor_musicbox.NAME.flute'), drum: R.T('events.manor_musicbox.NAME.drum') };
    if (ev.flag('marsh_boxes_done')) { await ev.say(null, R.T('events.manor_musicbox.say')); return; }
    const i = await ev.choose(R.T('events.manor_musicbox.i.choose'), { text: R.T('events.manor_musicbox.i.choose.text', { p0: NAME[box] }) });
    if (i !== 0) return;
    const step = ev.var('marsh_box_step');
    if (ORDER[step] === box) {
      ev.setVar('marsh_box_step', step + 1);
      ev.sfx('chime');
      await ev.say(null, R.T('events.manor_musicbox.say_2', { p0: NAME[box] }));
      if (step + 1 >= 3) {
        ev.setFlag('marsh_boxes_done');
        await ev.caption(R.T('events.manor_musicbox.caption'), { ms: 2400 });
      }
    } else {
      ev.setVar('marsh_box_step', 0);
      await ev.say(null, R.T('events.manor_musicbox.say_3'));
    }
  }, { meta: { needs: ['flag:marsh_sheet_read'], gives: ['flag:marsh_boxes_done'] } });

  // 人形の楽団（中ボス）
  E('manor_band', async (ev) => {
    if (ev.flag('marsh_dolls')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.manor_band.say'));
    const r = await ev.battle('tr_b_dolls', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('marsh_dolls');
    await ev.say(null, R.T('events.manor_band.say_2'));
    try { await ev.appear('melda', { ms: 900 }); } catch (e) { /* */ }
  }, { meta: { needs: [], gives: ['flag:marsh_dolls'] } });

  // メルダ（録音の文のまま。声はあとで）→ 証拠 5・鐘の鍵・鐘の歌
  E('manor_melda', async (ev) => {
    if (!ev.flag('marsh_dolls')) return;
    if (ev.flag('marsh_melda_met')) {
      await ev.say('melda', ev.flag('marsh_assembly_done') ? R.T('events.manor_melda.say') : R.T('events.manor_melda.say_2'), MELDA);
      return;
    }
    ev.setFlag('marsh_melda_met');
    ev.bgm('sorrow');
    await ev.say(null, R.T('events.manor_melda.say_3'));
    await ev.say('melda', R.T('events.manor_melda.say_4'), Object.assign({ voice: 'v_melda_manor_01' }, MELDA));
    await ev.say('melda', R.T('events.manor_melda.say_5'), Object.assign({ voice: 'v_melda_manor_02' }, MELDA));
    await ev.say('melda', R.T('events.manor_melda.say_6'), Object.assign({ voice: 'v_melda_manor_03' }, MELDA));
    await ev.say('melda', R.T('events.manor_melda.say_7'), Object.assign({ voice: 'v_melda_manor_04' }, MELDA));
    await ev.say('melda', R.T('events.manor_melda.say_8'), Object.assign({ voice: 'v_melda_manor_05' }, MELDA));
    ev.item('k_bell_key', 1);
    await ev.caption(X().SONG, { ms: 3200, voice: X().SONG_VOICE });
    await X().lore(ev, 'lo_marsh_song');
    ev.leadDone('l_marsh_manor');
    ev.lead('l_marsh_bog');
    await X().evidence(ev, 'melda');
    if (!ev.flag('marsh_assembly_done')) await ev.say(null, R.T('events.manor_melda.say_9'));
    ev.mapBgm();
  }, { meta: { needs: ['flag:marsh_dolls'], gives: ['flag:marsh_melda_met', 'item:k_bell_key', 'lore:lo_marsh_song', 'flag:marsh_ev_melda', 'lead:l_marsh_ev_melda', 'var:marsh_evidence', 'lead:l_marsh_bog'] } });

  // ================================================================ 鐘沈みの沼
  E('bog_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption(R.T('events.bog_arrive.caption'), { ms: 2200 });
    if (!ev.has('k_bell_key')) await ev.caption(R.T('events.bog_arrive.caption_2'), { ms: 2000 });
  });
  E('bog_bell', async (ev, ctx) => {
    const o = objAt(ctx, 'marsh_bog', 'bog_bell');
    const n = (o && o.bell) || 1;
    const f = 'marsh_bell_' + n;
    if (ev.flag(f)) { await ev.say(null, R.T('events.bog_bell.say')); return; }
    await ev.say(null, R.T('events.bog_bell.say_2'));
    if (!ev.has('k_bell_key')) { await ev.say(null, R.T('events.bog_bell.say_3')); return; }
    await ev.say(null, [R.T('events.bog_bell.say.0'), X().SONG]);
    ev.sfx('bell');
    try { R.Field.shake(3, 600); } catch (e) { /* */ }
    ev.setFlag(f);
    const rung = [1, 2, 3].filter((k) => ev.flag('marsh_bell_' + k)).length;
    await ev.caption(n === 3 ? R.T('events.bog_bell.caption') : R.T('events.bog_bell.caption_2'), { ms: 2400 });
    if (n !== 3 && ev.flag('marsh_bell_1') && ev.flag('marsh_bell_2')) await ev.caption(R.T('events.bog_bell.caption_3'), { ms: 2000 });
    if (n === 3) await ev.caption(R.T('events.bog_bell.caption_4'), { ms: 2000 });
    if (rung === 1) ev.lead('l_marsh_bog');
  }, { meta: { needs: ['item:k_bell_key'], gives: ['flag:marsh_bell_1', 'flag:marsh_bell_2', 'flag:marsh_bell_3'] } });
  E('bog_stone', async (ev) => {
    await ev.say(null, [R.T('events.bog_stone.say.0'), R.T('events.bog_stone.say.1'), X().SONG]);
    await X().lore(ev, 'lo_marsh_song');
  }, { meta: { needs: [], gives: ['lore:lo_marsh_song'] } });

  // 霧食らい（録音の文のまま）→ メルダ → 子どもたち → 締め
  E('bog_mistbeast', async (ev) => {
    if (ev.flag('marsh_mistbeast') || !ev.flag('marsh_bell_3')) return;
    ev.bgm('omen');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.caption(R.T('events.bog_mistbeast.caption'), { ms: 2600 });
    await ev.say('mistwitch', R.T('events.bog_mistbeast.say'), Object.assign({ voice: 'v_mistwitch_marsh_01' }, WITCH));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_mistbeast', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('marsh_mistbeast');
    await ev.say(null, R.T('events.bog_mistbeast.say_2'));
    ev.bgm('dawn');
    await ev.say(null, R.T('events.bog_mistbeast.say_3'));
    await ev.say('melda', R.T('events.bog_mistbeast.say_4'), Object.assign({ voice: 'v_melda_marsh_01' }, MELDA));
    await ev.caption(R.T('events.bog_mistbeast.caption_2'), { ms: 2400 });
    try { await ev.appear(['bog_kid_a', 'bog_kid_b'], { ms: 900 }); } catch (e) { /* */ }
    await ev.call('marsh_finale');
  }, {
    meta: {
      needs: ['flag:marsh_bell_3'],
      gives: ['flag:marsh_mistbeast', 'region:r_marsh', 'flag:marsh_finale_done', 'choice:ch_marsh_write', 'flag:marsh_reward_given'],
      calls: ['marsh_finale'],
    },
  });
  E('bog_kids', async (ev, ctx) => {
    await ev.say((ctx && ctx.npc) || 'bog_kid_a', R.T('events.bog_kids.say'));
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('marsh_finale', async (ev) => {
    if (ev.flag('marsh_finale_done')) return;
    // 大灯火（七つの鐘楼の灯）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_marsh');
    ev.bgm('dawn');
    ev.sfx('bell');
    await ev.fade('out', 800);
    await ev.warp('loch', 'plaza');
    await ev.caption(R.T('events.marsh_finale.caption'), { ms: 2600 });
    await ev.caption(R.T('events.marsh_finale.caption_2'), { ms: 3000 });
    await ev.caption(R.T('events.marsh_finale.caption_3'), { ms: 2200 });
    // クラウスが、メルダの歌を聞き取って楽譜を墨で書き直す
    await ev.say(null, R.T('events.marsh_finale.say'), { face: false });
    await ev.say(null, R.T('events.marsh_finale.say_2'), { name: R.T('events.marsh_finale.say.name') });
    ev.item('k_ink_score', 1);
    await ev.say(null, R.T('events.marsh_finale.say_3'), { face: false });
    // 年代記に書く選択（ch_marsh_write。痛みの側は pain_count を足す）
    await ev.say(null, R.T('events.marsh_finale.say_4'));
    const i = await ev.choose(R.T('events.marsh_finale.i.choose'), { text: R.T('events.marsh_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_marsh_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.marsh_finale.say_5'));
    } else {
      ev.choice('ch_marsh_write', 'legend');
      await ev.say(null, R.T('events.marsh_finale.say_6'));
    }
    ev.sfx('quill');
    ev.setFlag('marsh_finale_done');
    ev.setFlag('marsh_melda_gone');
    ev.leadDone('l_marsh_bog');
    ev.leadDone('l_marsh_mist');
    await ev.call('marsh_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:marsh_mistbeast'], gives: ['region:r_marsh', 'flag:marsh_finale_done', 'choice:ch_marsh_write', 'item:k_ink_score', 'flag:marsh_melda_gone'], calls: ['marsh_reward'], warp: { to: 'loch', spawn: 'plaza' } } });
  // 町長の礼（一度で正しく名指し: 探偵の帽子／間違えた: わびの鈴。同じ強さ）
  E('marsh_reward', async (ev) => {
    if (ev.flag('marsh_reward_given')) return;
    ev.setFlag('marsh_reward_given');
    const wrong = ev.var('marsh_wrong');
    if (!wrong) {
      await ev.say(null, R.T('events.marsh_reward.say'), { face: false });
      ev.item('u_sleuth_hat', 1);
    } else {
      await ev.say(null, R.T('events.marsh_reward.say_2'), { face: false });
      ev.item('u_apology_bell', 1);
    }
    if (ev.choiceOf('ch_marsh_write') === 'pain') await ev.caption(R.T('events.marsh_reward.caption'), { ms: 2400 });
  }, { meta: { needs: ['flag:marsh_finale_done'], gives: ['flag:marsh_reward_given', 'item:u_sleuth_hat|u_apology_bell'] } });

  // ================================================================ ワールド
  // 沼の縁の鐘の歌の石碑（証拠 6）
  E('marsh_songstone', async (ev) => {
    await ev.say(null, [R.T('events.marsh_songstone.say.0'), X().SONG_CUT, R.T('events.marsh_songstone.say.2')]);
    if (ev.flag('marsh_emma_met')) await X().evidence(ev, 'stone');
  }, { meta: { needs: ['flag:marsh_emma_met'], gives: ['flag:marsh_ev_stone', 'lead:l_marsh_ev_stone', 'var:marsh_evidence'] } });
  // 沼の入口の霧の壁（集会の前）
  E('marsh_mistwall', async (ev) => {
    await ev.say(null, R.T('events.marsh_mistwall.say'));
    if (ev.flag('marsh_can_assemble')) await ev.say(null, R.T('events.marsh_mistwall.say_2'));
  });
  E('marsh_world_traveler', async (ev) => {
    await ev.say('marsh_traveler', X().cleared(ev) ? [R.T('events.marsh_world_traveler.say.0')] : R.T('events.marsh_world_traveler.say'));
    ev.lead('l_marsh_mist');
  }, { meta: { needs: [], gives: ['lead:l_marsh_mist'] } });
  E('marsh_lotus', async (ev) => {
    ev.addVar('marsh_lotus_seen', 1);
    await ev.say(null, R.T('events.marsh_lotus.say'));
  }, { meta: { needs: [], gives: ['var:marsh_lotus_seen'] } });
})(window.RPG);
