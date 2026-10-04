// CONTENT（クリア後）: 忘却の底のイベント（旧版 chronicle/src/events/oblivion.js の筋を v2 の作りで。マップは maps/oblivion.js）。
//   oblivion_<n>_arrive    各階に初めて入ったとき: 階の名の字幕と数行（旗 = イベントの id）
//   oblivion_stone         1 階の岸の石碑（忘れられた伝承のかけら。o.stone = 1〜4）・oblivion_graves 名のない墓の輪
//   oblivion_torn_seam     2 階のちぎれた紙の橋の端
//   oblivion_statue        3 階の恐れの像
//   oblivion_3_echo        3 階 玉座の間の入口で魔王の残影（v_valzard_oblivion_01〜03 → tr_b_valzard_echo）→ oblivion_echo。
//                          倒した後は玉座を調べると「もう一度挑みますか？」（レア・超レアの落とし物のため）
//   oblivion_4_hint / oblivion_4_loop   4 階 終わらない回廊（光の無い廊下を進むと最初の部屋へ。3 回ごとに白い紙が正しい口を示す）
//   oblivion_ring_stone    5 階 輪の石碑
//   oblivion_5_ouroboros   5 階 フィーネの声（v_fine_oblivion_01・02）→ 円環竜オウロボラ（tr_b_ouroboros）→「円環が、ほどけた」→
//                          外伝『円環の竜』（読み物 lo_ouroboros）→ oblivion_ouroboros。倒した後は渦の中ほどを調べるともう一度戦える
// ボス戦は逃げられない（boss）。負け・全滅では何も記録しない（踏み板からまた始まる）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const narr = (ev, text) => ev.say(null, text, { face: false });
  const fx = {
    flash(c, ms) { try { if (R.Field && R.Field.flash) R.Field.flash(c || '#ffffff', ms || 400); } catch (e) { /* */ } },
    shake(p, ms) { try { if (R.Field && R.Field.shake) R.Field.shake(p || 3, ms || 600); } catch (e) { /* */ } },
  };

  // ================================================================ 各階に着いたとき
  const arrive = (n, lines) => E('oblivion_' + n + '_arrive', async (ev) => {
    const id = 'oblivion_' + n + '_arrive';
    if (ev.flag(id)) return;
    ev.setFlag(id);
    if (n === 1) ev.leadDone('l_post_oblivion');
    await ev.wait(200);
    await ev.caption(R.T('events.' + id + '.caption'), { ms: 2600 });
    for (let i = 0; i < lines; i++) await narr(ev, R.T('events.' + id + '.narr' + (i ? '_' + (i + 1) : '')));
  }, { meta: { needs: [], gives: ['flag:oblivion_' + n + '_arrive'] } });
  arrive(1, 3); arrive(2, 1); arrive(3, 1); arrive(4, 1); arrive(5, 2);

  // ================================================================ 1 階 岸の石碑と墓
  E('oblivion_stone', async (ev, ctx) => {
    const n = (ctx && ctx.stone) || 1;
    await narr(ev, R.T('events.oblivion_stone.s' + n));
    await narr(ev, R.T('events.oblivion_stone.s' + n + '_2'));
  });
  E('oblivion_graves', async (ev) => {
    await narr(ev, R.T('events.oblivion_graves.narr'));
    await narr(ev, R.T('events.oblivion_graves.narr_2'));
  });
  // ================================================================ 2 階・3 階・5 階の調べる物
  E('oblivion_torn_seam', async (ev) => { await narr(ev, R.T('events.oblivion_torn_seam.narr')); });
  E('oblivion_statue', async (ev) => { await narr(ev, R.T('events.oblivion_statue.narr')); });
  E('oblivion_ring_stone', async (ev) => { await narr(ev, R.T('events.oblivion_ring_stone.narr')); });

  /** 「もう一度挑みますか？」→ 同じボスともう一度（落とし物のため）。勝てば true */
  async function rematch(ev, troop, intro, gone) {
    await narr(ev, intro);
    const i = await ev.choose(R.T('events.oblivion_rematch.choose'), { cancel: 1, text: R.T('events.oblivion_rematch.choose.text') });
    if (i !== 0) return false;
    ev.sfx('roar');
    fx.shake(4, 700);
    const r = await ev.battle(troop, { boss: true });
    ev.mapBgm();
    if (r !== 'win') return false;
    ev.sfx('light');
    fx.flash('#ffffff', 400);
    await narr(ev, gone);
    return true;
  }

  // ================================================================ 3 階 魔王の残影
  E('oblivion_3_echo', async (ev) => {
    if (ev.flag('oblivion_echo')) {
      await rematch(ev, 'tr_b_valzard_echo', R.T('events.oblivion_3_echo.again'), R.T('events.oblivion_3_echo.again_gone'));
      return;
    }
    ev.bgm('omen');
    await narr(ev, R.T('events.oblivion_3_echo.narr'));
    ev.sfx('dark');
    fx.flash('#201828', 500);
    await ev.wait(300);
    await ev.say(null, R.T('events.oblivion_3_echo.say'), { voice: 'v_valzard_oblivion_01', name: R.T('ev.oblivion.who.valzard'), face: false });
    await ev.say(null, R.T('events.oblivion_3_echo.say_2'), { voice: 'v_valzard_oblivion_02', name: R.T('ev.oblivion.who.valzard'), face: false });
    ev.sfx('roar');
    fx.shake(5, 900);
    const r = await ev.battle('tr_b_valzard_echo', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    await ev.wait(300);
    await ev.say(null, R.T('events.oblivion_3_echo.say_3'), { voice: 'v_valzard_oblivion_03', name: R.T('ev.oblivion.who.valzard'), face: false });
    ev.sfx('light');
    fx.flash('#ffffff', 600);
    ev.setFlag('oblivion_echo');
    await narr(ev, R.T('events.oblivion_3_echo.narr_2'));
    ev.mapBgm();
    await narr(ev, R.T('events.oblivion_3_echo.narr_3'));
  }, { meta: { needs: [], gives: ['flag:oblivion_echo'] } });

  // ================================================================ 4 階 終わらない回廊
  const LOOP_VAR = 'oblivion_4_loops';
  E('oblivion_4_hint', async (ev) => {
    await narr(ev, R.T('events.oblivion_4_hint.narr'));
    await narr(ev, R.T('events.oblivion_4_hint.narr_2'));
  });
  E('oblivion_4_loop', async (ev) => {
    const n = ev.addVar(LOOP_VAR, 1);
    ev.sfx('warp');
    await ev.fade('out', 360);
    await ev.warp('oblivion_4', 'loop');
    await ev.fade('in', 360);
    await narr(ev, R.T('events.oblivion_4_loop.narr'));
    if (n % 3 === 0) {
      await narr(ev, R.T('events.oblivion_4_loop.narr_2'));
      await narr(ev, R.T('events.oblivion_4_loop.narr_3'));
    }
  }, { meta: { needs: [], gives: [], warp: { to: 'oblivion_4', spawn: 'loop' } } });

  // ================================================================ 5 階 円環竜オウロボラ
  E('oblivion_5_ouroboros', async (ev) => {
    if (ev.flag('oblivion_ouroboros')) {
      await rematch(ev, 'tr_b_ouroboros', R.T('events.oblivion_5_ouroboros.again'), R.T('events.oblivion_5_ouroboros.again_gone'));
      return;
    }
    ev.bgm('omen');
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr'));
    await ev.wait(400);
    ev.sfx('magic');
    fx.flash('#e8ecff', 400);
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_2'));
    await ev.say(null, R.T('events.oblivion_5_ouroboros.fine'), { voice: 'v_fine_oblivion_01', name: R.T('ev.oblivion.who.fine'), face: false });
    await ev.say(null, R.T('events.oblivion_5_ouroboros.fine_2'), { voice: 'v_fine_oblivion_02', name: R.T('ev.oblivion.who.fine'), face: false });
    await ev.say(null, R.T('events.oblivion_5_ouroboros.fine_3'), { name: R.T('ev.oblivion.who.fine'), face: false });
    ev.sfx('roar');
    fx.shake(6, 1100);
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_3'));
    const r = await ev.battle('tr_b_ouroboros', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    await ev.wait(300);
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_4'));
    ev.sfx('light');
    fx.flash('#ffffff', 900);
    ev.setFlag('oblivion_ouroboros');
    await ev.wait(500);
    ev.sfx('quill');
    try { ev.jingle('chapter'); } catch (e) { /* */ }
    await ev.caption(R.T('events.oblivion_5_ouroboros.caption'), { ms: 3400 });
    ev.lore('lo_ouroboros');
    ev.mapBgm();
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_5'));
  }, { meta: { needs: ['flag:oblivion_echo'], gives: ['flag:oblivion_ouroboros', 'lore:lo_ouroboros'] } });

  // ---------------------------------------------------------------- 古いセーブ（R.SaveFixups。R.State.deserialize が呼ぶ）
  // クリアした（final_clear）のに忘却の底の手がかりが無い → 手がかりを足す（入口は町の広場の階段。前は大書庫の手すりを調べたときだけ）。
  // 町（ビブリア）はクリアの後もワープで行ける: 着いた旗（final_arrived）があればワープの一覧に載せる
  (R.SaveFixups = R.SaveFixups || []).push(function (G) {
    const f = G && G.flags;
    if (!f || !f.final_clear) return;
    G.leads = G.leads || {};
    if (!G.leads.l_post_oblivion && !f.oblivion_1_arrive) G.leads.l_post_oblivion = { got: Math.floor(G.playMs || 0), pin: false, seen: false };
    if (f.final_arrived) { G.warps = G.warps || {}; G.warps.biblia = true; }
  });

  // ---------------------------------------------------------------- 読み物（外伝『円環の竜』）
  if (!R.DB.lore.lo_ouroboros) R.def('lore', 'lo_ouroboros', { region: 'finale', kind: 'main', must: false, title: R.T('lore.lo_ouroboros.title'), text: R.T('lore.lo_ouroboros.text') });
})(window.RPG);
