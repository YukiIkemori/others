// CONTENT（マレア諸島）: 潮鳴りの洞窟・幽霊船・灯り直す場面（WORLD_REDESIGN §4.5 の流れ 1・6〜8・§6.4、STORY_BIBLE §7.5・§11.8）。
//   潮鳴りの洞窟 1 階: 潮の石（叩くたびに満ち引きが替わる。引き潮 = 東の洞へ行ける・北の渡り場 B が水の下／満ち潮 = B が歩ける・東の洞の口が水の下。
//     2 通りの tilePatches。下絵は両方が乾いた形で、水の下の方は閉じた絵）。2 階: 深みの大ダコ（中ボス）→ 奥の岩棚の光る貝がら。
//   幽霊船 3 階: 甲板（自分の船から渡り板）→ 船室（船員の名札 6 枚、任意・水樽の休息の灯）→ 船倉（暗がり。ランタンに火）と船長室。
//   船長室: グレン（v_glen_ship_01・02）→ 亡霊船長グレン tr_b_captain → 舟歌を語る → v_glen_ship_03・04 → 途中から白い航海日誌 →
//   地平が白むころのネレイの桟橋: v_marina_dawn_01・v_glen_dawn_01・v_marina_dawn_02 → 灯が青からだいだい色に戻り、沖の灯台島へ渡ってともる
//   → clearRegion('r_isles') → マリナが墨の写しを託す（写し手 アルノ）→ lo_ev_isles → 年代記に書く選択 ch_isles_write
//   （船長とマリナの話 story ／（痛）沈んだ船員たちの名も pain。名札 1 枚以上のときだけ）→ 日継ぎの主張。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const objAt = (ctx, event) => { const m = ctx && R.DB.maps[ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const GLEN = { name: R.T('ev.isles_dungeons.GLEN.name') }, MARINA = { name: R.T('ev.isles_dungeons.MARINA.name') };

  // ================================================================ 潮鳴りの洞窟
  E('isles_cave_arrive', async (ev) => {
    if (ev.flag('isles_cave_seen')) return;
    ev.setFlag('isles_cave_seen');
    await ev.caption(R.T('events.isles_cave_arrive.caption'), { ms: 2400 });
    await ev.caption(R.T('events.isles_cave_arrive.caption_2'), { ms: 2200 });
  }, { meta: { needs: [], gives: ['flag:isles_cave_seen'] } });
  E('isles_tide_stone', async (ev) => {
    const high = ev.flag('isles_tide_high');
    await ev.say(null, R.T('events.isles_tide_stone.say'));
    const i = await ev.choose(R.T('events.isles_tide_stone.i.choose'), { text: high ? R.T('events.isles_tide_stone.i.choose.text') : R.T('events.isles_tide_stone.i.choose.text_2') });
    if (i !== 0) return;
    ev.setFlag('isles_tide_high', !high);
    ev.sfx('water');
    try { R.Field.shake(3, 700); } catch (e) { /* */ }
    await ev.caption(high ? R.T('events.isles_tide_stone.caption') : R.T('events.isles_tide_stone.caption_2'), { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:isles_tide_high'] } });
  E('isles_cave_carving', async (ev) => {
    await ev.say(null, R.T('events.isles_cave_carving.say'));
  });
  E('isles_cave2_arrive', async (ev) => {
    if (ev.flag('isles_cave2_seen')) return;
    ev.setFlag('isles_cave2_seen');
    await ev.caption(R.T('events.isles_cave2_arrive.caption'), { ms: 2400 });
  });
  // 深みの大ダコ（中ボス。北の洞の入口）
  E('isles_octopus', async (ev) => {
    if (ev.flag('isles_octopus')) return;
    ev.bgm('omen');
    await ev.say(null, R.T('events.isles_octopus.say'));
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    await ev.say(null, R.T('events.isles_octopus.say_2'));
    const r = await ev.battle('tr_b_octopus', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('isles_octopus');
    ev.sfx('water');
    await ev.say(null, R.T('events.isles_octopus.say_3'));
  }, { meta: { needs: [], gives: ['flag:isles_octopus'] } });
  E('isles_glow_shell', async (ev) => {
    if (ev.flag('isles_shell')) { await ev.say(null, R.T('events.isles_glow_shell.say')); return; }
    if (!ev.flag('isles_octopus')) return;
    await ev.say(null, R.T('events.isles_glow_shell.say_2'));
    ev.item('k_glow_shell', 1);
    ev.setFlag('isles_shell');
    ev.leadDone('l_isles_shell');
    await ev.say(null, R.T('events.isles_glow_shell.say_3'));
  }, { meta: { needs: ['flag:isles_octopus'], gives: ['item:k_glow_shell', 'flag:isles_shell'] } });

  // ================================================================ 幽霊船
  E('isles_ghost_arrive', async (ev) => {
    if (cleared(ev)) {
      if (ev.flag('isles_ghost_after')) return;
      ev.setFlag('isles_ghost_after');
      await ev.caption(R.T('events.isles_ghost_arrive.caption'), { ms: 2400 });
      return;
    }
    if (ev.flag('isles_ghost_seen')) return;
    ev.setFlag('isles_ghost_seen');
    await ev.caption(R.T('events.isles_ghost_arrive.caption_2'), { ms: 2800 });
    await ev.caption(R.T('events.isles_ghost_arrive.caption_3'), { ms: 2400 });
  }, { meta: { needs: [], gives: ['flag:isles_ghost_seen'] } });
  E('isles_ghost_mast', async (ev) => {
    await ev.say(null, R.T('events.isles_ghost_mast.say'));
  });
  E('isles_ghost_skylight', async (ev) => {
    await ev.say(null, R.T('events.isles_ghost_skylight.say'));
  });
  // 船員の名札（6 枚、任意）
  E('isles_nametag', async (ev, ctx) => {
    const o = objAt(ctx, 'isles_nametag');
    const n = (o && o.tag) || 1;
    const f = 'isles_tag_' + n;
    const name = X().CREW[n];
    if (ev.flag(f)) { await ev.say(null, R.T('events.isles_nametag.say', { name })); return; }
    ev.setFlag(f);
    const k = X().tags(ev);
    ev.setVar('isles_tags', k);
    ev.sfx('item');
    await ev.say(null, R.T('events.isles_nametag.say_2', { name, k }));
    if (k === 1) await ev.say(null, R.T('events.isles_nametag.say_3'));
  }, { meta: { needs: [], gives: ['flag:isles_tag_1', 'flag:isles_tag_2', 'flag:isles_tag_3', 'flag:isles_tag_4', 'flag:isles_tag_5', 'flag:isles_tag_6', 'var:isles_tags+6'] } });
  E('isles_ghost_doll', async (ev) => {
    await ev.say(null, R.T('events.isles_ghost_doll.say'));
  });
  E('isles_hold_arrive', async (ev) => {
    if (ev.flag('isles_hold_seen')) return;
    ev.setFlag('isles_hold_seen');
    await ev.caption(R.T('events.isles_hold_arrive.caption'), { ms: 2600 });
  });
  E('isles_cabin_door', async (ev) => {
    await ev.say(null, R.T('events.isles_cabin_door.say'));
  });

  // ---------------------------------------------------------------- 船長室: グレン → 亡霊船長 → 舟歌 → 白い日誌 → 夜明け
  E('isles_captain', async (ev) => {
    if (ev.flag('isles_captain') || cleared(ev)) return;
    const x = X();
    ev.bgm('omen');
    await ev.say(null, R.T('events.isles_captain.say'));
    await ev.say('glen', R.T('events.isles_captain.say_2'), Object.assign({ voice: 'v_glen_ship_01' }, GLEN));
    await ev.say('glen', R.T('events.isles_captain.say_3'), Object.assign({ voice: 'v_glen_ship_02' }, GLEN));
    ev.sfx('roar');
    try { R.Field.shake(5, 900); } catch (e) { /* */ }
    const r = await ev.battle('tr_b_captain', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    ev.setFlag('isles_captain');
    ev.leadDone('l_isles_fog');
    ev.sfx('magic');
    try { R.Field.flash && R.Field.flash('#d8ecff', 500); } catch (e) { /* */ }
    await ev.say(null, R.T('events.isles_captain.say_4'));
    ev.bgm('sorrow');
    await ev.caption(x.SHANTY_A, { ms: 3000 });
    await ev.caption(x.SHANTY_B, { ms: 3000 });
    ev.sfx('quill');
    await ev.say('glen', R.T('events.isles_captain.say_5'), Object.assign({ voice: 'v_glen_ship_03' }, GLEN));
    await ev.say('glen', R.T('events.isles_captain.say_6'), Object.assign({ voice: 'v_glen_ship_04' }, GLEN));
    await ev.call('isles_captain_log');
    await ev.call('isles_dawn');
  }, { meta: { needs: ['flag:isles_fog_open'], gives: ['flag:isles_captain'], calls: ['isles_captain_log', 'isles_dawn'] } });
  // 途中から白い航海日誌（比べ読みの片方）
  E('isles_captain_log', async (ev) => {
    if (!ev.flag('isles_log_white')) {
      ev.setFlag('isles_log_white');
      await ev.say(null, R.T('events.isles_captain_log.say'));
      await ev.say(null, R.T('events.isles_captain_log.say_2'));
      await ev.say(null, R.T('events.isles_captain_log.say_3'));
      return;
    }
    await ev.say(null, ev.flag('lo_ev_isles') ? R.T('events.isles_captain_log.say_4') : R.T('events.isles_captain_log.say_5'));
  }, { meta: { needs: ['flag:isles_captain'], gives: ['flag:isles_log_white'] } });

  // ---------------------------------------------------------------- 灯り直す場面（地平が白むころのネレイの桟橋）
  E('isles_dawn', async (ev) => {
    if (ev.flag('isles_dawn_done')) return;
    const x = X();
    await ev.fade('out', 900);
    ev.setFlag('isles_dawn_scene');
    await ev.warp('nerei', 'pier_end');
    ev.bgm('dawn');
    await ev.caption(R.T('events.isles_dawn.caption'), { ms: 2600 });
    await ev.say(null, R.T('events.isles_dawn.say'));
    await ev.say('marina_dawn', R.T('events.isles_dawn.say_2'), Object.assign({ voice: 'v_marina_dawn_01' }, MARINA));
    await ev.say('glen_dawn', R.T('events.isles_dawn.say_3'), Object.assign({ voice: 'v_glen_dawn_01' }, GLEN));
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd8a0', 700); } catch (e) { /* */ }
    await ev.caption(R.T('events.isles_dawn.caption_2'), { ms: 3000 });
    try { await ev.leave('glen_dawn', { ms: 1200 }); } catch (e) { /* */ }
    await ev.caption(R.T('events.isles_dawn.caption_3'), { ms: 3000 });
    await ev.say('marina_dawn', R.T('events.isles_dawn.say_4'), Object.assign({ voice: 'v_marina_dawn_02' }, MARINA));
    ev.setFlag('isles_dawn_done');
    // 大灯火（グレンの船の灯 → 灯台島）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_isles');
    await ev.call('isles_finale');
  }, { meta: { needs: ['flag:isles_captain'], gives: ['flag:isles_dawn_done', 'region:r_isles'], calls: ['isles_finale'], warp: { to: 'nerei', spawn: 'pier_end' } } });
  E('isles_finale', async (ev) => {
    if (ev.flag('isles_finale_done')) return;
    const x = X();
    // 墨の写し（比べ読み → lo_ev_isles）
    await ev.say('marina_dawn', R.T('events.isles_finale.say'), MARINA);
    ev.item('k_ink_copy', 1);
    ev.setFlag('isles_ink_given');
    await ev.say(null, R.T('events.isles_finale.say_2'));
    await ev.say(null, R.T('events.isles_finale.say_3'));
    await x.lore(ev, 'lo_ev_isles');
    await ev.say('marina_dawn', R.T('events.isles_finale.say_4'), MARINA);
    // 年代記に書く選択（（痛）は名札が 1 枚以上のときだけ）
    const tags = x.tags(ev);
    const labels = [R.T('events.isles_finale.labels.0')].concat(tags > 0 ? [R.T('events.isles_finale.labels.0_2')] : []);
    const i = await ev.choose(labels, { text: R.T('events.isles_finale.i.choose.text') });
    if (i === 1 && tags > 0) {
      ev.choice('ch_isles_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, R.T('events.isles_finale.say_5'));
      const names = [1, 2, 3, 4, 5, 6].filter((n) => ev.flag('isles_tag_' + n)).map((n) => x.CREW[n]);
      await ev.caption(names.join('\n'), { ms: 1200 + 700 * names.length });
      await ev.say(null, R.T('events.isles_finale.say_6'));
      ev.setFlag('isles_wall_names');
      await ev.say('marina_dawn', R.T('events.isles_finale.say_7'), MARINA);
    } else {
      ev.choice('ch_isles_write', 'story');
      await ev.say(null, R.T('events.isles_finale.say_8'));
    }
    ev.sfx('quill');
    // 日継ぎの主張（灯り直す場面の最後に、町の誰かが）
    await ev.say('dawn_fisher', R.T('events.isles_finale.say_9'));
    ev.setFlag('isles_dawn_scene', false);
    ev.setFlag('isles_finale_done');
    ev.leadDone('l_isles_harbor');
    ev.mapBgm();
  }, { meta: { needs: ['flag:isles_dawn_done'], gives: ['flag:isles_finale_done', 'item:k_ink_copy', 'lore:lo_ev_isles', 'choice:ch_isles_write', 'flag:isles_wall_names'] } });
})(window.RPG);
