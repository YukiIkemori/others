// CONTENT（クリア後）: 忘却の底のイベント（旧版 chronicle/src/events/oblivion.js の筋を v2 の作りで。マップは maps/oblivion.js）。
//   oblivion_<n>_arrive    各階に初めて入ったとき: 階の名の字幕と数行（旗 = イベントの id）
//   oblivion_stone         1 階の岸の石碑（忘れられた伝承のかけら。o.stone = 1〜4）・oblivion_graves 名のない墓の輪
//   oblivion_torn_seam     2 階のちぎれた紙の橋の端
//   oblivion_statue        3 階の恐れの像
//   oblivion_3_echo        3 階 玉座の間の入口で魔王の残影（v_valzard_oblivion_01〜03 → tr_b_valzard_echo）→ oblivion_echo。
//                          倒した後は玉座を調べると「もう一度挑みますか？」（レア・超レアの落とし物のため）
//   oblivion_4_loop       4 階 終わらない回廊（光の無い廊下を進むと最初の部屋へ。3 回ごとに白い紙が正しい口を示す。入口の立て札が手がかり）
//   oblivion_5_ouroboros   5 階 フィーネの声（v_fine_oblivion_01・02）→ 竜が目を開けて話す（顔つき）→ 円環竜オウロボラ（tr_b_ouroboros）→「円環が、ほどけた」→
//                          竜の最後の言葉 → 字幕「年代記に外伝『円環の竜』が加わった」→ 外伝（読み物 lo_ouroboros）→ oblivion_ouroboros。
//                          倒した後は渦の中ほどを調べるともう一度戦える
//   ボス 2 体は顔（描いた一枚絵 b_valzard_echo・b_ouroboros）と名前つきで話す（テスター 2026-10-07 Z3。足した文は声なし）
// ボス戦は逃げられない（boss）。負け・全滅では何も記録しない（踏み板からまた始まる）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const narr = (ev, text) => ev.say(null, text, { face: false });
  // ボスの顔（描いた一枚絵 assets/portraits/<敵の id>_neutral.webp。look は無いので顔の鍵をそのまま渡す）と名前。
  //   顔の絵が無い作り（--portraits none・テスト）では R.Portrait.has が null → 会話の窓は名前だけになる
  const BOSS = {
    valzard: { face: 'b_valzard_echo', name: () => R.T('ev.oblivion.who.valzard') },
    ouroboros: { face: 'b_ouroboros', name: () => R.T('data.bosses.LIST.b_ouroboros.name') },
  };
  const bossSay = (ev, who, text, o) => ev.say(null, text, Object.assign({ name: BOSS[who].name(), face: BOSS[who].face }, o || {}));
  /** 顔の絵の読み込みを先に始める（会話の窓が開いたとき、はじめの数コマに空の枠が出ないように） */
  const warmFace = (who) => { try { if (R.Portrait && R.Portrait.has) R.Portrait.has(BOSS[who].face, 'neutral'); } catch (e) { /* */ } };
  const fx = {
    flash(c, ms) { try { if (R.Field && R.Field.flash) R.Field.flash(c || '#ffffff', ms || 400); } catch (e) { /* */ } },
    shake(p, ms) { try { if (R.Field && R.Field.shake) R.Field.shake(p || 3, ms || 600); } catch (e) { /* */ } },
  };

  // ================================================================ 各階に着いたとき
  const arrive = (n, keys) => E('oblivion_' + n + '_arrive', async (ev) => {
    const id = 'oblivion_' + n + '_arrive';
    if (ev.flag(id)) return;
    ev.setFlag(id);
    if (n === 1) ev.leadDone('l_post_oblivion');
    await ev.wait(200);
    await ev.caption(keys[0], { ms: 2600 });
    for (const t of keys.slice(1)) await narr(ev, t);
  }, { meta: { needs: [], gives: ['flag:oblivion_' + n + '_arrive'] } });
  arrive(1, [R.T('events.oblivion_1_arrive.caption'), R.T('events.oblivion_1_arrive.narr'), R.T('events.oblivion_1_arrive.narr_2'), R.T('events.oblivion_1_arrive.narr_3')]);
  arrive(2, [R.T('events.oblivion_2_arrive.caption'), R.T('events.oblivion_2_arrive.narr')]);
  arrive(3, [R.T('events.oblivion_3_arrive.caption'), R.T('events.oblivion_3_arrive.narr')]);
  arrive(4, [R.T('events.oblivion_4_arrive.caption'), R.T('events.oblivion_4_arrive.narr')]);
  arrive(5, [R.T('events.oblivion_5_arrive.caption'), R.T('events.oblivion_5_arrive.narr'), R.T('events.oblivion_5_arrive.narr_2')]);

  // ================================================================ 1 階 岸の石碑と墓
  const STONES = [
    [R.T('events.oblivion_stone.s1'), R.T('events.oblivion_stone.s1_2')], [R.T('events.oblivion_stone.s2'), R.T('events.oblivion_stone.s2_2')],
    [R.T('events.oblivion_stone.s3'), R.T('events.oblivion_stone.s3_2')], [R.T('events.oblivion_stone.s4'), R.T('events.oblivion_stone.s4_2')],
  ];
  E('oblivion_stone', async (ev, ctx) => {
    const pages = STONES[((ctx && ctx.stone) || 1) - 1] || STONES[0];
    for (const t of pages) await narr(ev, t);
  });
  E('oblivion_graves', async (ev) => {
    await narr(ev, R.T('events.oblivion_graves.narr'));
    await narr(ev, R.T('events.oblivion_graves.narr_2'));
  });
  // ================================================================ 2 階・3 階・5 階の調べる物
  E('oblivion_torn_seam', async (ev) => { await narr(ev, R.T('events.oblivion_torn_seam.narr')); });
  E('oblivion_statue', async (ev) => { await narr(ev, R.T('events.oblivion_statue.narr')); });

  /** 「もう一度挑みますか？」→ 同じボスともう一度（落とし物のため）。勝てば true */
  async function rematch(ev, troop, intro, gone, who, line) {
    warmFace(who);
    await narr(ev, intro);
    if (who && line) await bossSay(ev, who, line);
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
      await rematch(ev, 'tr_b_valzard_echo', R.T('events.oblivion_3_echo.again'), R.T('events.oblivion_3_echo.again_gone'), 'valzard', R.T('events.oblivion_3_echo.again_say'));
      return;
    }
    warmFace('valzard');
    ev.bgm('omen');
    await narr(ev, R.T('events.oblivion_3_echo.narr'));
    ev.sfx('dark');
    fx.flash('#201828', 500);
    await ev.wait(300);
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say'), { voice: 'v_valzard_oblivion_01' });
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say_2'), { voice: 'v_valzard_oblivion_02' });
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say_4'));
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say_5'));
    ev.sfx('roar');
    fx.shake(5, 900);
    const r = await ev.battle('tr_b_valzard_echo', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    await ev.wait(300);
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say_3'), { voice: 'v_valzard_oblivion_03' });
    await bossSay(ev, 'valzard', R.T('events.oblivion_3_echo.say_6'));   // 別れの一言（声なし）
    ev.sfx('light');
    fx.flash('#ffffff', 600);
    ev.setFlag('oblivion_echo');
    await narr(ev, R.T('events.oblivion_3_echo.narr_2'));
    ev.mapBgm();
    await narr(ev, R.T('events.oblivion_3_echo.narr_3'));
  }, { meta: { needs: [], gives: ['flag:oblivion_echo'] } });

  // ================================================================ 4 階 終わらない回廊
  const LOOP_VAR = 'oblivion_4_loops';
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
      await rematch(ev, 'tr_b_ouroboros', R.T('events.oblivion_5_ouroboros.again'), R.T('events.oblivion_5_ouroboros.again_gone'), 'ouroboros', R.T('events.oblivion_5_ouroboros.again_say'));
      return;
    }
    warmFace('ouroboros');
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
    // 竜が自分の口で（声なし。テスター: 竜が一言も話さない）
    await bossSay(ev, 'ouroboros', R.T('events.oblivion_5_ouroboros.say'));
    await bossSay(ev, 'ouroboros', R.T('events.oblivion_5_ouroboros.say_2'));
    await bossSay(ev, 'ouroboros', R.T('events.oblivion_5_ouroboros.say_3'));
    const r = await ev.battle('tr_b_ouroboros', { boss: true });
    if (r !== 'win') { ev.mapBgm(); return; }
    await ev.wait(300);
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_4'));
    // 締めの場面（テスター: 勝った後が薄い・外伝が加わったのに気づかない）: 竜の最後の言葉 → 光 → 字幕「年代記に外伝が加わった」と右上の通知 → 余韻
    await bossSay(ev, 'ouroboros', R.T('events.oblivion_5_ouroboros.last'));
    await bossSay(ev, 'ouroboros', R.T('events.oblivion_5_ouroboros.last_2'));
    ev.sfx('light');
    fx.flash('#ffffff', 900);
    ev.setFlag('oblivion_ouroboros');
    await ev.wait(500);
    ev.sfx('quill');
    try { ev.jingle('chapter'); } catch (e) { /* */ }
    await ev.caption(R.T('events.oblivion_5_ouroboros.caption'), { ms: 4200 });
    ev.lore('lo_ouroboros');   // 右上の通知「書庫に書き写した：外伝『円環の竜』」は次の文の間も出ている
    ev.mapBgm();
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_5'));
    await narr(ev, R.T('events.oblivion_5_ouroboros.narr_6'));
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
