// CONTENT（オルビス高原）: 星読みの塔・頂・灯り直す場面・締め（WORLD_REDESIGN §4.8 の流れ 4〜7、STORY_BIBLE §7.8 の場面 2・4、§11.8）。
//   尾根の塔の扉（星形の穴に星図を当てる）→ 1 階: 天球儀の輪を回すと内の壁の格子が入れ替わる（西 ↔ 北）→ 北の奥の間で
//   天球の番人（v_sentinel_star_01。星図を持っていても戦いは起きる）→ tr_b_orrery → 頂: 星食らい tr_b_stareater →
//   書見台で星の名を読み上げる（手がかり帳の余白に 1 行: l_star_margin）→ 灯り直す場面（オルビスの広場。町じゅうが屋根の上。
//   ルカが観測録に書き足す）→ clearRegion('r_star') → 年代記に書く選択 ch_star_write（story / （痛）朝は二十年前まであった → 学長が定説を撤回）→
//   日継ぎの主張 → 星読みの片眼鏡（ac_tale_star）。寄り道: 星降りのくぼ地の祭壇（星のかけら）、列柱の輪、倒れた柱。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Star.ev;
  const cleared = (ev) => ev.flag('cleared_r_star');
  const LUCA = { name: R.T('ev.star_tower.LUCA.name'), title: R.T('ev.star_tower.LUCA.title') };
  const OCTAVIA = { name: R.T('ev.star_tower.OCTAVIA.name'), title: R.T('ev.star_tower.OCTAVIA.title') };
  const SENTINEL = { name: R.T('ev.star_tower.SENTINEL.name') };
  // 星図の名（八つの伝承と響き合う名。いちばん上の大きな星の名だけが白く抜けている）
  const NAMES = R.T('ev.star_tower.NAMES');

  // ---------------------------------------------------------------- 尾根の塔の扉（星形の穴）
  E('star_tower_seal', async (ev) => {
    const x = X();
    if (ev.flag('star_tower_open')) { await x.narr(ev, R.T('events.star_tower_seal.narr')); return; }
    if (!ev.flag('star_chart_got')) {
      await x.narr(ev, R.T('events.star_tower_seal.narr_2'));
      ev.setFlag('star_gate_seen');
      ev.lead('l_star_tower');
      return;
    }
    await x.narr(ev, R.T('events.star_tower_seal.narr_3'));
    ev.sfx('door');
    try { R.Field.flash && R.Field.flash('#bcd8ff', 400); } catch (e) { /* */ }
    ev.setFlag('star_tower_open');
    ev.leadDone('l_star_tower');
    ev.lead('l_star_summit');
    await x.narr(ev, R.T('events.star_tower_seal.narr_4'));
  }, { meta: { needs: ['flag:star_chart_got'], gives: ['flag:star_tower_open', 'lead:l_star_summit'] } });

  // ---------------------------------------------------------------- 塔 1 階（天球儀の輪・番人）
  E('star_tower_arrive', async (ev) => {
    if (ev.flag('star_tower_seen')) return;
    ev.setFlag('star_tower_seen');
    await ev.caption(R.T('events.star_tower_arrive.caption'), { ms: 2600 });
    await ev.caption(R.T('events.star_tower_arrive.caption_2'), { ms: 2600 });
  });
  E('star_orrery_lever', async (ev) => {
    if (ev.flag('star_orrery_rot')) { await X().narr(ev, R.T('events.star_orrery_lever.say_done')); return; }
    await X().narr(ev, R.T('events.star_orrery_lever.narr'));
    ev.sfx('switch');
    try { R.Field.shake && R.Field.shake(2, 400); } catch (e) { /* */ }
    ev.setFlag('star_orrery_rot');
    await ev.caption(R.T('events.star_orrery_lever.caption'), { ms: 2000 });
  }, { meta: { needs: ['flag:star_tower_open'], gives: ['flag:star_orrery_rot'] } });
  E('star_orrery_dial', async (ev) => {
    await X().narr(ev, ev.flag('star_orrery_rot') ? R.T('events.star_orrery_dial.narr') : R.T('events.star_orrery_dial.narr_2'));
  });
  E('star_tower_gate', async (ev) => {
    await X().narr(ev, R.T('events.star_tower_gate.narr'));
  });
  E('star_sentinel', async (ev) => {
    if (ev.flag('star_sentinel')) return;
    ev.bgm('omen');
    await X().narr(ev, R.T('events.star_sentinel.narr'));
    await ev.say('sentinel', R.T('events.star_sentinel.say'), Object.assign({ voice: 'v_sentinel_star_01' }, SENTINEL));
    if (ev.has('k_star_chart')) await X().narr(ev, R.T('events.star_sentinel.narr_2'));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_orrery', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('star_sentinel');
    ev.mapBgm();
    await X().narr(ev, R.T('events.star_sentinel.narr_3'));
  }, { meta: { needs: ['flag:star_tower_open'], gives: ['flag:star_sentinel'] } });

  // ---------------------------------------------------------------- 頂（星食らい・星の名の読み上げ）
  E('star_top_arrive', async (ev) => {
    if (ev.flag('star_top_seen')) return;
    ev.setFlag('star_top_seen');
    await ev.caption(R.T('events.star_top_arrive.caption'), { ms: 2600 });
  });
  E('star_stareater', async (ev) => {
    if (ev.flag('star_stareater') || cleared(ev)) return;
    ev.bgm('omen');
    await X().narr(ev, R.T('events.star_stareater.narr'));
    await X().narr(ev, R.T('events.star_stareater.narr_2'));
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    const r = await ev.battle('tr_b_stareater', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('star_stareater');
    ev.leadDone('l_star_summit');
    ev.sfx('magic');
    await X().narr(ev, R.T('events.star_stareater.narr_3'));
    await ev.call('star_naming');
  }, { meta: { needs: ['flag:star_sentinel'], gives: ['flag:star_stareater'], calls: ['star_naming'] } });
  E('star_lectern', async (ev) => {
    if (ev.flag('star_names_read')) { await X().narr(ev, R.T('events.star_lectern.narr')); return; }
    if (ev.flag('star_stareater')) { await ev.call('star_naming'); return; }
    await X().narr(ev, R.T('events.star_lectern.narr_2'));
  }, { meta: { needs: ['flag:star_stareater'], gives: [], calls: ['star_naming'] } });
  E('star_naming', async (ev) => {
    if (ev.flag('star_names_read')) return;
    await X().narr(ev, R.T('events.star_naming.narr'));
    await X().narr(ev, R.T('events.star_naming.narr_2'));
    ev.bgm('legend');
    for (let i = 0; i < NAMES.length; i += 2) {
      await ev.caption(R.T('events.star_naming.pair', { a: NAMES[i], b: NAMES[i + 1] }), { ms: 1800 });   // かぎかっこは言語の表で
      ev.sfx('light');
      try { R.Field.flash && R.Field.flash('#dbe8ff', 250); } catch (e) { /* */ }
    }
    await X().narr(ev, R.T('events.star_naming.narr_3'));
    await X().narr(ev, R.T('events.star_naming.narr_4'));
    ev.setFlag('star_names_read');
    ev.lead('l_star_margin');
    ev.leadDone('l_star_margin');
    ev.leadDone('l_star_stars');
    await ev.caption(R.T('events.star_naming.caption'), { ms: 3200 });
    await ev.call('star_dawn');
  }, { meta: { needs: ['flag:star_stareater'], gives: ['flag:star_names_read', 'lead:l_star_margin'], calls: ['star_dawn'] } });

  // ---------------------------------------------------------------- 灯り直す場面（オルビスの広場。町じゅうが屋根の上）
  E('star_dawn', async (ev) => {
    if (ev.flag('star_dawn_done')) return;
    const x = X();
    await ev.fade('out', 900);
    ev.setFlag('star_dawn_scene');
    await ev.warp('orbis', 'plaza');
    ev.bgm('dawn');
    // 演出（テスター 2026-10-04 §7）: 広場の人が空を見上げ、カメラが夜空へ上がる。星が戻ってから、ルカが振り向いて指さす
    const S = R.Final && R.Final.ev;
    if (S) { for (const id of ['luca', 'octavia_dawn', 'roof_old', 'roof_kid']) await S.face(ev, id, 'n'); S.heroFace('n'); await S.cam(ev, 25, 25, 1400); }
    await ev.caption(R.T('events.star_dawn.caption'), { ms: 3000 });
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#dbe8ff', 500); } catch (e) { /* */ }
    await ev.caption(R.T('events.star_dawn.caption_2'), { ms: 2800 });
    if (S) { await S.camBack(ev, 900); await S.act(ev, 'roof_kid', 'laugh', 700); await S.face(ev, 'luca', 'hero'); await S.act(ev, 'luca', 'point', 900); }
    await ev.say('luca', R.T('events.star_dawn.say'), LUCA);
    if (!ev.flag('lo_time_star')) await ev.call('star_obs_log');
    await x.narr(ev, R.T('events.star_dawn.narr'));
    await ev.caption(R.T('events.star_dawn.caption_3'), { ms: 2400 });
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#cfe0ff', 700); } catch (e) { /* */ }
    ev.setFlag('star_dawn_done');
    // 大灯火（高原の星）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_star');
    await ev.call('star_finale');
  }, { meta: { needs: ['flag:star_names_read'], gives: ['flag:star_dawn_done', 'region:r_star'], calls: ['star_finale', 'star_obs_log'], warp: { to: 'orbis', spawn: 'plaza' } } });
  E('star_finale', async (ev) => {
    if (ev.flag('star_finale_done')) return;
    const x = X();
    const resigned = x.resigned(ev);
    const S = R.Final && R.Final.ev;
    if (S) await S.face(ev, 'octavia_dawn', 'hero');
    await ev.say('octavia_dawn', resigned ? R.T('events.star_finale.say') : R.T('events.star_finale.say_2'), OCTAVIA);
    // 年代記に書く選択
    const i = await ev.choose(R.T('events.star_finale.i.choose'), { important: true, text: R.T('events.star_finale.i.choose.text') });
    if (i === 1) {
      ev.choice('ch_star_write', 'pain');
      ev.addVar('pain_count', 1);
      await x.narr(ev, R.T('events.star_finale.narr'));
      await ev.fade('out', 600);
      await ev.caption(resigned ? R.T('events.star_finale.caption')
        : R.T('events.star_finale.caption_2'), { ms: 3200 });
      await ev.caption(R.T('events.star_finale.caption_3'), { ms: 3400 });
      await ev.caption(R.T('events.star_finale.caption_4'), { ms: 2800 });
      await ev.fade('in', 600);
    } else {
      ev.choice('ch_star_write', 'story');
      await x.narr(ev, R.T('events.star_finale.narr_2'));
    }
    ev.sfx('quill');
    await ev.say('luca', R.T('events.star_finale.say_3'), LUCA);
    ev.item('ac_tale_star', 1);
    // 日継ぎの主張（灯り直す場面の最後に、町の誰かが）
    await ev.say('roof_old', R.T('events.star_finale.say_4'));
    ev.setFlag('star_dawn_scene', false);
    ev.setFlag('star_finale_done');
    ev.mapBgm();
  }, { meta: { needs: ['flag:star_dawn_done'], gives: ['flag:star_finale_done', 'choice:ch_star_write', 'item:ac_tale_star'] } });

  // 解決の後の学長（騒ぎで退いたなら天文台の一研究者）
  E('star_octavia_after', async (ev) => {
    const x = X();
    if (!cleared(ev)) { await ev.say('octavia_dawn', R.T('events.star_octavia_after.say'), OCTAVIA); return; }
    await ev.say(ev.ctx && ev.ctx.npc ? ev.ctx.npc : 'octavia_obs', x.resigned(ev) ? R.T('events.star_octavia_after.say_2')
      : (ev.choiceOf('ch_star_order') === 'public' ? R.T('events.star_octavia_after.say_3') : R.T('events.star_octavia_after.say_4')), { name: R.T('events.star_octavia_after.say.name') });
  });

  // ---------------------------------------------------------------- 高原のエリア（寄り道・景色）
  E('star_crater_altar', async (ev) => {
    const x = X();
    ev.setFlag('star_crater_seen');
    if (ev.flag('star_shard')) { await x.narr(ev, R.T('events.star_crater_altar.narr')); return; }
    await x.narr(ev, R.T('events.star_crater_altar.narr_2'));
    ev.item('k_star_shard', 1);
    ev.setFlag('star_shard');
    ev.leadDone('l_opt_starfall');
    await x.narr(ev, R.T('events.star_crater_altar.narr_3'));
  }, { meta: { needs: [], gives: ['item:k_star_shard', 'flag:star_shard', 'flag:star_crater_seen'] } });
  E('star_column_ring', async (ev) => {
    await X().narr(ev, cleared(ev) ? R.T('events.star_column_ring.narr')
      : R.T('events.star_column_ring.narr_2'));
  });
  E('star_fallen_column', async (ev) => {
    await X().narr(ev, R.T('events.star_fallen_column.narr'));
  });
})(window.RPG);
