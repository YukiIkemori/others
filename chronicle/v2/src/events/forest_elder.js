// CONTENT-F: 千年樹のイベントと森の締め（V2_PLAN §3.3 F10・F11・F12、STORY_BIBLE §7.1・§11.8）
//   elder_fine（F10、v_fine_forest_01）・elder_boss（F11: 根食らい tr_b_rooteater → エルム v_elm_forest_01〜05）→
//   forest_finale（野営地へ画面を移して ev.clearRegion('r_forest') → v_elm_forest_06 → 4 人が光る道を帰る →
//   フェルンの広場で歌 → 年代記に書く選択 ch_forest_write → 最後に見つけた人の一品物）。
//   ボイスの付いた文は 1 字も変えない（改行の位置だけ窓に合わせる。今の木の region1_forest.js と同じ）。
(function (R) {
  'use strict';
  /** 今のマップの BGM（予告の曲 omen・霧の曲の後に戻す） */
  const mapBgm = (ev, o) => { const p = R.Field && R.Field.pos, m = p && R.DB.maps[p.map]; if (m && m.bgm) ev.bgm(m.bgm, o); };
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const ELM = { name: R.T('ev.forest_elder.ELM.name'), face: false };

  // ---------------------------------------------------------------- F10 入口のフィーネ（一言だけで去る）
  E('elder_fine', async (ev) => {
    if (ev.flag('forest_fine') || ev.flag('cleared_r_forest')) return;
    R.Audio.pushBgm('fine_theme');
    try {
      try { await ev.npc('fine').face('s'); } catch (e) { /* */ }
      await ev.say('fine', R.T('events.elder_fine.say'), { voice: 'v_fine_forest_01', name: R.T('events.elder_fine.say.name') });
      await ev.say('fine', R.T('events.elder_fine.say_2'), { voice: 'v_fine_forest_02', name: R.T('events.elder_fine.say.name') });
      ev.sfx('magic');
      await ev.fade('out', 240);
      ev.setFlag('forest_fine');
      try { await ev.npc('fine').hide(); } catch (e) { /* */ }
      await ev.fade('in', 240);
      await ev.caption(R.T('events.elder_fine.caption'), { ms: 2200 });
    } finally { R.Audio.popBgm(); }
  }, { meta: { needs: [], gives: ['flag:forest_fine'] } });

  E('elder_carving', async (ev) => {
    await ev.say(null, R.T('events.elder_carving.say'));
  });

  // 根の戸（閉じた根。ピムの抜け穴のスイッチで開く）を調べた: 道がふさがれているのを一言で知らせる（持ち主 2026-09-28「上部真ん中から下がいけない」）
  //   ピムを野営地へ帰した（ch_forest_pim = send）ときも詰まらない: 門を調べると、ピムが野営地から追いかけてきて、ついてくる
  //   （テスター 2026-09-30「帰すを選ぶと根の門が開かない」）。抜け穴のスイッチは「ついてくる人」で押す（elder_1・elder_2 の switch by:'guest'）
  E('elder_root_gate', async (ev) => {
    await ev.say(null, R.T('events.elder_root_gate.say'));
    if (!ev.flag('forest_pim_guest') && ev.flag('forest_found_pim') && !ev.flag('forest_boss')) {
      await ev.say('npc_pim', R.T('events.elder_root_gate.pim_back'), { name: R.T('events.elder_root_gate.say.name') });
      ev.setFlag('forest_pim_guest');
      ev.guest('npc_pim');
      await ev.caption(R.T('events.verda_pim.caption'), { ms: 1600 });
    }
    if (ev.flag('forest_pim_guest')) await ev.say('npc_pim', R.T('events.elder_root_gate.say_2'), { name: R.T('events.elder_root_gate.say.name') });
    else await ev.say(null, R.T('events.elder_root_gate.say_3'));
  });

  // ---------------------------------------------------------------- 根の間: 伸びない年輪（時の証 lo_time_forest）
  E('elder_rings', async (ev) => {
    await ev.say(null, R.T('events.elder_rings.say'));
    await F().lore(ev, 'lo_time_forest');
  }, { meta: { needs: [], gives: ['flag:lo_time_forest'] } });

  // ピムを連れてきたとき: 根食らいの手前（控えの間）で野営地へ帰る
  E('elder_pim_home', async (ev) => {
    if (!ev.flag('forest_pim_guest')) return;
    await ev.say('npc_pim', R.T('events.elder_pim_home.say'), { name: R.T('events.elder_pim_home.say.name') });
    // 根食らいの前のヒント（テスター 2026-09-30 の 3-3「触手は火で焼くとよいが、戦う前のヒントがほとんどない」）
    if (!ev.flag('forest_boss')) await ev.say('npc_pim', R.T('events.elder_pim_home.hint'), { name: R.T('events.elder_pim_home.say.name') });
    ev.guest(null);
    ev.setFlag('forest_pim_guest', false);
    await ev.caption(R.T('events.elder_pim_home.caption'), { ms: 1800 });
  }, { meta: { needs: ['flag:forest_pim_guest'], gives: [] } });

  // ---------------------------------------------------------------- F11 根食らい → エルム → 締め
  E('elder_boss', async (ev) => {
    if (ev.flag('cleared_r_forest')) return;
    if (ev.flag('forest_pim_guest')) await ev.call('elder_pim_home');
    if (!ev.flag('forest_boss')) {
      ev.bgm('omen');
      await ev.say(null, R.T('events.elder_boss.say'));
      await ev.say(null, R.T('events.elder_boss.say_2'));
      ev.sfx('roar');
      const r = await ev.battle('tr_b_rooteater', { boss: true });
      mapBgm(ev);   // 予告の曲は鳴り終わっている: マップの曲へ
      if (r !== 'win') return;
      ev.setFlag('forest_boss');
      await ev.say(null, R.T('events.elder_boss.say_3'));
    }
    await ev.say(null, R.T('events.elder_boss.say_4'));
    if (ev.var('forest_verses') >= 3) {
      await ev.say(null, R.T('events.elder_boss.say_5'));
      ev.sfx('quill');
      await ev.caption(F().SONG, { ms: 5000 });
    }
    ev.sfx('light');
    await ev.say(null, R.T('events.elder_boss.say_6'));
    await ev.say('elm', R.T('events.elder_boss.say_7'), Object.assign({ voice: 'v_elm_forest_01' }, ELM));
    await ev.say('elm', R.T('events.elder_boss.say_8'), Object.assign({ voice: 'v_elm_forest_02' }, ELM));
    await ev.say('elm', R.T('events.elder_boss.say_9'), Object.assign({ voice: 'v_elm_forest_03' }, ELM));
    await ev.say('elm', R.T('events.elder_boss.say_10'), Object.assign({ voice: 'v_elm_forest_04' }, ELM));
    await ev.say('elm', R.T('events.elder_boss.say_11'), Object.assign({ voice: 'v_elm_forest_05' }, ELM));
    await ev.call('forest_finale');
  }, {
    meta: {
      needs: ['flag:forest_found_hans', 'flag:forest_found_ben', 'flag:forest_found_roy', 'flag:forest_found_pim'],
      gives: ['flag:forest_boss', 'region:r_forest', 'flag:forest_finale_done', 'choice:ch_forest_write'],
      calls: ['forest_finale', 'elder_pim_home'],
    },
  });

  // 灯り直す場面（STORY_BIBLE §7.1 の 6・7）
  E('forest_finale', async (ev) => {
    const f = F();
    if (ev.flag('forest_finale_done')) return;
    // 1. 画面は野営地へ
    await ev.fade('out', 600);
    await ev.warp('verda_1', 'camp');
    // 2. 大灯火（こずえに歌の灯）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_forest');
    ev.sfx('light');
    ev.bgm('dawn');
    await ev.caption(R.T('events.forest_finale.caption'), { ms: 3000 });
    // 3. エルムの声が森じゅうに響く（v_elm_forest_06 は野営地で）
    await ev.say(null, R.T('events.forest_finale.say'), Object.assign({ voice: 'v_elm_forest_06' }, ELM));
    // 4. 野営地の人が立ち上がり、光る道を村へ帰っていく
    const walkers = ['camp_hans', 'camp_ben', 'camp_roy', 'camp_pim'];
    const moves = [];
    walkers.forEach((id, i) => {
      try { moves.push(ev.npc(id).move([[29 + (i % 2), 36], [29 + (i % 2), 44], [29 + (i % 2), 50]], { speed: 1 })); } catch (e) { /* */ }
    });
    await Promise.race([Promise.all(moves), ev.wait(4200)]);
    try { await ev.leave(walkers, { path: [], ms: 500, stagger: 0 }); } catch (e) { /* */ }   // 歩いた先で薄れて消える
    await ev.caption(R.T('events.forest_finale.caption_2'), { ms: 2200 });
    ev.setFlag('forest_finale_done');
    // 5. フェルンの広場で歌
    await ev.fade('out', 600);
    await ev.warp('fern', 'plaza');
    ev.bgm('village');
    await ev.caption(R.T('events.forest_finale.caption_3'), { ms: 2400 });
    await ev.say('npc_rita', R.T('events.forest_finale.say_2'), { name: R.T('events.forest_finale.say.name'), voice: 'v_rita_forest_03' });
    await ev.caption(f.SONG, { ms: 5200 });
    await ev.say(null, R.T('events.forest_finale.say_3'));
    if (ev.choiceOf('ch_forest_pim') === 'take') await ev.say('npc_pim', R.T('events.forest_finale.say_4'), { name: R.T('events.forest_finale.say.name_2') });
    await ev.say('hanna', R.T('events.forest_finale.say_5'), { name: R.T('events.forest_finale.say.name_3') });
    // 6. 年代記に書く選択（ch_forest_write。痛みの側は R.Game の数を足す）
    await ev.say(null, R.T('events.forest_finale.say_6'));
    const i = await ev.choose(R.T('events.forest_finale.i.choose'), { text: R.T('events.forest_finale.i.choose.text') });
    if (i === 0) {
      ev.choice('ch_forest_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.forest_finale.say_7'));
    } else {
      ev.choice('ch_forest_write', 'oath');
      await ev.say(null, R.T('events.forest_finale.say_8'));
    }
    ev.sfx('quill');
    // 7. 最後に見つけた人が一品物を渡す（F12。どれも同じ強さ）
    await ev.call('fern_after');
  }, { meta: { needs: ['flag:forest_boss'], gives: ['region:r_forest', 'flag:forest_finale_done', 'choice:ch_forest_write'], calls: ['fern_after'], warp: { to: 'fern', spawn: 'plaza' } } });

  E('fern_after', async (ev) => {
    const f = F();
    if (ev.flag('forest_unique_given')) return;
    const who = f.last(ev) || 'hans';
    const p = f.PEOPLE[who];
    const talk = {
      hans: R.T('events.fern_after.talk.hans'),
      ben: R.T('events.fern_after.talk.ben'),
      roy: R.T('events.fern_after.talk.roy'),
      pim: R.T('events.fern_after.talk.pim'),
    }[who];
    await ev.say(p.look, talk, { name: p.name });
    f.give(ev, p.unique, 1);
    ev.setFlag('forest_unique_given');
  }, { meta: { needs: ['flag:forest_finale_done'], gives: ['flag:forest_unique_given', 'item:u_hans_axe|u_ben_whistle|u_roy_charm|u_pim_cap'] } });

  // ---------------------------------------------------------------- 解決の後の千年樹
  E('elder_elm', async (ev) => {
    if ((R.Tier && R.Tier.get ? R.Tier.get() : 0) >= 6) {
      await ev.say('elm', R.T('events.elder_elm.say'), ELM);
      return;
    }
    await ev.say('elm', R.T('events.elder_elm.say_2'), ELM);
  });
  E('elder_altar', async (ev) => {
    if (ev.flag('forest_boss')) await ev.say(null, R.T('events.elder_altar.say'));
    else await ev.say(null, R.T('events.elder_altar.say_2'));
  });
})(window.RPG);
