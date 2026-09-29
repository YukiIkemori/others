// CONTENT-F: 迷いの森のイベント（V2_PLAN §3.3 F5〜F9、WORLD_REDESIGN §4.1、STORY_BIBLE §7.1）
//   救出の 4 人（順番は自由）: ハンス（倒木の先。斧で開く）・ベン（狼の群れ tr_a21_forest_wolves）・ロイ（木のうろ。ベンの笛で出てくる）・
//   ピム（こけの語り石の前で小鹿をかばう）→ 見つけた人は 1 階の蛍だまりの野営地で待つ。
//   選択: ピム（送る＝野営地へ／連れる＝ついてくる人 E8）・小鹿（手当て＝獣道が開く／そっとしておく）。
//   歌の石 a・b・c（forest_verses）: 3 つで出口の入れ替えが止まり、つるの壁がほどける。c はダストウィングが守る。
(function (R) {
  'use strict';
  /** 今のマップの BGM（予告の曲 omen・霧の曲の後に戻す） */
  const mapBgm = (ev, o) => { const p = R.Field && R.Field.pos, m = p && R.DB.maps[p.map]; if (m && m.bgm) ev.bgm(m.bgm, o); };
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const F = () => R.ContentF.forest;
  const cleared = (ev) => ev.flag('cleared_r_forest');

  // ---------------------------------------------------------------- 入るとき・森が道を変える
  E('verda_arrive', async (ev) => {
    await ev.caption(R.T('events.verda_arrive.caption'), { ms: 2600 });
    if (ev.has('k_pim_hat')) await ev.caption(R.T('events.verda_arrive.caption_2'), { ms: 1800 });
  });
  E('verda_2_arrive', async (ev) => {
    await ev.caption(R.T('events.verda_2_arrive.caption'), { ms: 2400 });
  });
  E('verda_mist', async (ev) => {
    if (ev.var('forest_verses') >= 3) return;
    ev.bgm('lostwood', { fade: 800 });   // 霧の曲（design/bgm_changes.md）。歌の石が 3 つそろったらマップの曲へ戻す
    ev.sfx('wind');
    await ev.caption(R.T('events.verda_mist.caption'), { ms: 2200 });
  });

  // ---------------------------------------------------------------- F8 歌の石
  async function songStone(ev, key, verse, extra) {
    const f = F();
    if (ev.flag(key)) {
      await ev.say(null, R.T('ev.forest_verda.songStone.say'));
      await ev.caption(extra ? verse + '\n' + extra : verse, { ms: 2400 });
      return;
    }
    await ev.say(null, R.T('ev.forest_verda.songStone.say_2'));
    ev.sfx('bell');
    await ev.caption(verse, { ms: 3000 });
    if (extra) {
      await ev.say(null, R.T('ev.forest_verda.songStone.say_3'));
      await ev.caption(extra, { ms: 3200 });
    }
    ev.setFlag(key);
    const n = ev.addVar('forest_verses', 1);
    ev.sfx('quill');
    await ev.say(null, R.T('ev.forest_verda.songStone.say_4'));
    if (n >= 3) {
      ev.sfx('unlock');
      await ev.caption(R.T('ev.forest_verda.songStone.caption'), { ms: 2800 });
      await ev.caption(R.T('ev.forest_verda.songStone.caption_2'), { ms: 1800 });
      mapBgm(ev, { fade: 800 });
      ev.leadDone('l_forest_song');
    } else {
      await ev.say(null, n === 1 ? R.T('ev.forest_verda.songStone.say_5') : R.T('ev.forest_verda.songStone.say_6'));
    }
    void f;
  }
  E('verda_stone_a', (ev) => songStone(ev, 'forest_stone_a', F().VERSES[0]), { meta: { needs: [], gives: ['var:forest_verses+1', 'flag:forest_stone_a'] } });
  E('verda_stone_b', (ev) => songStone(ev, 'forest_stone_b', F().VERSES[1]), { meta: { needs: [], gives: ['var:forest_verses+1', 'flag:forest_stone_b'] } });
  E('verda_stone_c', async (ev) => {
    if (!ev.flag('forest_moth')) { await ev.say(null, R.T('events.verda_stone_c.say')); return; }
    await songStone(ev, 'forest_stone_c', F().VERSES[2], F().EXTRA);
  }, { meta: { needs: ['flag:forest_moth'], gives: ['var:forest_verses+1', 'flag:forest_stone_c'] } });

  E('verda_vines', async (ev) => {
    if (ev.var('forest_verses') >= 3) return;
    await ev.say(null, [R.T('events.verda_vines.say.0'), ev.var('forest_verses') > 0
      ? R.T('events.verda_vines.say.1')
      : R.T('events.verda_vines.say.1_2')]);
  });

  // ---------------------------------------------------------------- F9 ダストウィング（歌の石 c を守る）
  E('verda_moth', async (ev) => {
    if (ev.flag('forest_moth')) return;
    ev.bgm('omen');   // ボスの予告（1 回だけ鳴る）。戦闘の後は R.Audio が予告の前の曲に戻す
    await ev.say(null, R.T('events.verda_moth.say'));
    ev.sfx('roar');
    await ev.say(null, R.T('events.verda_moth.say_2'));
    const r = await ev.battle('tr_b_moth', { boss: true });
    if (r !== 'win') return;
    ev.setFlag('forest_moth');
    await ev.say(null, R.T('events.verda_moth.say_3'));
  }, { meta: { needs: [], gives: ['flag:forest_moth'] } });

  // ---------------------------------------------------------------- 持ち物（斧・笛）
  E('verda_axe', async (ev) => {
    if (ev.flag('forest_got_axe')) { await ev.say(null, R.T('events.verda_axe.say')); return; }
    await ev.say(null, R.T('events.verda_axe.say_2'));
    ev.setFlag('forest_got_axe');
    await ev.caption(R.T('events.verda_axe.caption'), { ms: 1600 });
    await ev.say(null, R.T('events.verda_axe.say_3'));
  }, { meta: { needs: [], gives: ['flag:forest_got_axe'] } });

  E('verda_flute', async (ev) => {
    if (ev.flag('forest_got_flute')) { await ev.say(null, R.T('events.verda_flute.say')); return; }
    await ev.say(null, R.T('events.verda_flute.say_2'));
    ev.setFlag('forest_got_flute');
    await ev.caption(R.T('events.verda_flute.caption'), { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:forest_got_flute'] } });

  // ---------------------------------------------------------------- F5 ハンス（倒木の先）
  E('verda_log', async (ev) => {
    if (ev.flag('forest_log_cut')) return;
    if (!ev.flag('forest_got_axe')) {
      await ev.say(null, R.T('events.verda_log.say'));
      return;
    }
    await ev.say(null, R.T('events.verda_log.say_2'));
    const i = await ev.choose(R.T('events.verda_log.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.sfx('hit');
    await ev.fade('out', 300);
    ev.setFlag('forest_log_cut');
    await ev.fade('in', 300);
    await ev.say(null, R.T('events.verda_log.say_3'));
  }, { meta: { needs: ['flag:forest_got_axe'], gives: ['flag:forest_log_cut'] } });

  E('verda_hans', async (ev) => {
    if (ev.flag('forest_found_hans')) return;
    await ev.say('hans', R.T('events.verda_hans.say'));
    await ev.say('hans', R.T('events.verda_hans.say_2'));
    await F().rescue(ev, 'hans');
  }, { meta: { needs: ['flag:forest_log_cut'], gives: ['flag:forest_found_hans'] } });

  // ---------------------------------------------------------------- F5 ベン（狼の群れ）
  E('verda_ben', async (ev) => {
    if (ev.flag('forest_found_ben')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.verda_ben.say'));
    await ev.say('ben', R.T('events.verda_ben.say_2'));
    const r = await ev.battle('tr_a21_forest_wolves');
    if (r !== 'win') return;
    await ev.say(null, R.T('events.verda_ben.say_3'));
    await ev.say('ben', R.T('events.verda_ben.say_4'));
    await ev.say('ben', R.T('events.verda_ben.say_5'));
    await F().rescue(ev, 'ben');
  }, { meta: { needs: [], gives: ['flag:forest_found_ben'] } });

  // ---------------------------------------------------------------- F5 ロイ（木のうろ。笛の音で出てくる）
  E('verda_hollow', async (ev) => {
    if (ev.flag('forest_found_roy')) { await ev.say(null, R.T('events.verda_hollow.say')); return; }
    if (!ev.flag('forest_got_flute')) {
      await ev.say(null, R.T('events.verda_hollow.say_2'));
      return;
    }
    await ev.say(null, R.T('events.verda_hollow.say_3'));
    const i = await ev.choose(R.T('events.verda_hollow.i.choose'), { cancel: 1 });
    if (i !== 0) return;
    ev.sfx('whistle');
    await ev.caption(R.T('events.verda_hollow.caption'), { ms: 1400 });
    ev.setFlag('forest_roy_out');
    await ev.wait(300);
    await ev.say('roy', R.T('events.verda_hollow.say_4'));
    await ev.say('roy', R.T('events.verda_hollow.say_5'));
    await F().rescue(ev, 'roy');
  }, { meta: { needs: ['flag:forest_got_flute'], gives: ['flag:forest_found_roy', 'flag:forest_roy_out'] } });

  // ---------------------------------------------------------------- F5・F6・F7 ピム（こけの語り石の前）と小鹿
  E('verda_pim', async (ev) => {
    if (ev.flag('forest_found_pim')) return;
    await ev.say('pim', R.T('events.verda_pim.say'));
    await ev.say('pim', R.T('events.verda_pim.say_2'));
    await F().rescue(ev, 'pim', { hide: false, quiet: true });
    // F6 ピムの選択（ch_forest_pim）
    const i = await ev.choose(R.T('events.verda_pim.i.choose'), { text: R.T('events.verda_pim.i.choose.text') });
    if (i === 0) {
      ev.choice('ch_forest_pim', 'send');
      await ev.say('pim', R.T('events.verda_pim.say_3'));
    } else {
      ev.choice('ch_forest_pim', 'take');
      await ev.say('pim', R.T('events.verda_pim.say_4'));
    }
    // F7 小鹿の選択（ch_forest_fawn）
    await ev.call('verda_fawn_choice');
    if (ev.choiceOf('ch_forest_pim') === 'take') {
      ev.setFlag('forest_pim_guest');
      ev.guest('npc_pim');
      await ev.caption(R.T('events.verda_pim.caption'), { ms: 1600 });
    } else {
      try { await ev.leave('pim'); } catch (e) { /* */ }
      await ev.caption(R.T('events.verda_pim.caption_2'), { ms: 2000 });
    }
  }, { meta: { needs: [], gives: ['flag:forest_found_pim', 'choice:ch_forest_pim', 'choice:ch_forest_fawn'], calls: ['verda_fawn_choice'] } });

  E('verda_fawn_choice', async (ev) => {
    if (ev.flag('forest_fawn_done')) return;
    await ev.say(null, R.T('events.verda_fawn_choice.say'));
    const heal = ['i_salve', 'i_potion', 'i_elixir'].find((id) => ev.has(id));
    const i = await ev.choose([heal ? R.T('events.verda_fawn_choice.i.choose.0', { p0: R.DB.items[heal] ? R.DB.items[heal].name : heal }) : R.T('events.verda_fawn_choice.i.choose.0_2'), R.T('events.verda_fawn_choice.i.choose.1')], { cancel: 1 });
    if (i === 0) {
      if (!heal) { await ev.say(null, R.T('events.verda_fawn_choice.say_2')); return; }
      ev.take(heal, 1);
      ev.choice('ch_forest_fawn', 'heal');
      ev.setFlag('forest_fawn_done');
      await ev.say(null, R.T('events.verda_fawn_choice.say_3'));
    } else {
      ev.choice('ch_forest_fawn', 'leave');
      ev.setFlag('forest_fawn_done');
      await ev.say(null, R.T('events.verda_fawn_choice.say_4'));
    }
    try { await ev.leave('fawn'); } catch (e) { /* */ }
  }, { meta: { needs: ['flag:forest_found_pim'], gives: ['choice:ch_forest_fawn', 'flag:forest_fawn_done'] } });

  E('verda_fawn_after', async (ev) => {
    await ev.say(null, R.T('events.verda_fawn_after.say'));
  });

  // ---------------------------------------------------------------- 野営地（蛍だまり）
  E('verda_camp_talk', async (ev, ctx) => {
    const who = String((ctx && ctx.npc) || '').replace(/^camp_/, '');
    const f = F();
    const n = f.count(ev);
    const lines = {
      hans: R.T('events.verda_camp_talk.lines.hans'),
      ben: R.T('events.verda_camp_talk.lines.ben'),
      roy: R.T('events.verda_camp_talk.lines.roy'),
      pim: R.T('events.verda_camp_talk.lines.pim'),
    };
    const L = lines[who] || ['……。'];
    await ev.say(ctx && ctx.npc, n >= 4 && who !== 'pim' ? [L[0], L[1], R.T('events.verda_camp_talk.say.2')] : L);
  });

  // ---------------------------------------------------------------- 読み物と調べる物
  E('verda_moss_stone', async (ev) => {
    await ev.say(null, R.T('events.verda_moss_stone.say'));
    await F().lore(ev, 'lo_forest_moss_stone');
  }, { meta: { needs: [], gives: ['flag:lo_forest_moss_stone'] } });

  E('verda_empty_hut', async (ev) => {
    if (ev.flag('lo_lz_1')) { await ev.say(null, R.T('events.verda_empty_hut.say')); return; }
    await ev.say(null, R.T('events.verda_empty_hut.say_2'));
    await ev.letter('letter_lz_1');
    await F().lore(ev, 'lo_lz_1');
    ev.leadDone('l_forest_hut');
  }, { meta: { needs: [], gives: ['flag:lo_lz_1'] } });

  E('verda_herb', async (ev, ctx) => R.ContentF.forest.herb(ev, ctx));
  E('verda_acorn', async (ev) => R.ContentF.forest.acorn(ev));
})(window.RPG);
