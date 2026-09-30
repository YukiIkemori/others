// CONTENT（マレア諸島）: 自分の船での航海（WORLD_REDESIGN §4.5 の流れ 2〜4・§2.5、STORY_BIBLE §7.5 の 1）。
//   外洋船（isles_ship）の舵: コーラルの真ん中の桟橋・ネレイの夜の桟橋・島々の桟橋で調べると、行き先を選ぶ（固定航路のように）。
//   行き先: コーラル・ネレイ・灯台島・人魚の歌う岩・財宝ヤドカリの島・座礁した商船・霧の海（マリナが歌ったあと = 幽霊船）。
//   島へ着くと海図の空白が埋まる（X.chart。3 つで幽霊船の海域が絞れる）。
//   島: 灯台島（灯台守のいない灯台。灯室にラザロの手紙・【灯りを守る】）・人魚の歌う岩（#34。舟歌の後半の節・人魚のくし）・
//       財宝ヤドカリの島（#35。巣）・座礁した商船（選択 ch_isles_wreck: 船員を助ける（小舟で 3 往復）／積荷を拾う（ティア宝箱 3））。
//   航海のイベントは行き先ごとに 1 本（meta.warp。tools/qa/progress.js の閉包が行き先ごとに着ける）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');

  // ---------------------------------------------------------------- 舵（行き先を選ぶ）
  const DEST = [
    { id: 'coral', label: '港町コーラル', ev: 'isles_sail_coral' },
    { id: 'nerei', label: '岬の村ネレイ', ev: 'isles_sail_nerei' },
    { id: 'light', label: '灯台島', ev: 'isles_sail_light' },
    { id: 'siren', label: '人魚の歌う岩', ev: 'isles_sail_siren' },
    { id: 'crab', label: '財宝ヤドカリの島', ev: 'isles_sail_crab' },
    { id: 'wreck', label: '座礁した商船', ev: 'isles_sail_wreck' },
    { id: 'fog', label: '霧の海（幽霊船）', ev: 'isles_sail_fog', cond: 'isles_fog_open' },
  ];
  E('isles_helm', async (ev, ctx) => {
    if (!ev.flag('isles_ship')) { await ev.say(null, 'ここは船をつなぐ桟橋だ。\n今は、何もつながれていない。'); return; }
    const here = { coral: 'coral', nerei: 'nerei', i_light: 'light', i_siren: 'siren', i_crab: 'crab', i_wreck: 'wreck', ghost_ship_1: 'fog' }[ctx && ctx.map];
    const list = DEST.filter((d) => d.id !== here && (!d.cond || ev.flag(d.cond)));
    const i = await ev.choose(list.map((d) => d.label + (X().CHART.includes(d.id) && !ev.flag('isles_chart_' + d.id) ? '（海図の空白）' : '')).concat(['やめる']),
      { cancel: list.length, text: '外洋船の舵を取る。どこへ向かう？' });
    if (i >= list.length) return;
    await ev.call(list[i].ev);
  }, { meta: { needs: [], gives: [], calls: DEST.map((d) => d.ev) } });
  // 島の桟橋の船（調べると舵）
  E('isles_boat', async (ev, ctx) => { await ev.call('isles_helm', ctx); }, { meta: { needs: [], gives: [], calls: ['isles_helm'] } });

  async function sail(ev, map, spawn, cap) {
    await ev.fade('out', 500);
    ev.sfx('ship');
    await ev.warp(map, spawn);
    if (cap) await ev.caption(cap, { ms: 1800 });
  }
  const S = (id, map, spawn, run, o) => E(id, run, Object.assign({ meta: Object.assign({ needs: ['flag:isles_ship'], gives: [], warp: { to: map, spawn } }, (o && o.meta) || {}) }));
  S('isles_sail_coral', 'coral', 'ship', async (ev) => { await sail(ev, 'coral', 'ship', '港町コーラルに着いた。'); });
  S('isles_sail_nerei', 'nerei', 'pier_end', async (ev) => { await sail(ev, 'nerei', 'pier_end', '岬の村ネレイの桟橋に着いた。'); });
  for (const k of ['light', 'siren', 'crab', 'wreck']) {
    S('isles_sail_' + k, 'i_' + k, 'boat', async (ev) => {
      await sail(ev, 'i_' + k, 'boat', X().CHART_NAME[k] + 'に着いた。');
      await X().chart(ev, k);
    }, { meta: { gives: ['flag:isles_chart_' + k, 'var:isles_chart', 'flag:isles_fog_found'] } });   // fog_found は 3 つ目で立つ（閉包は 4 つとも回るので、ここに書く）
  }
  S('isles_sail_fog', 'ghost_ship_1', 'board', async (ev) => {
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption(cleared(ev) ? '霧の晴れた海に、古い船が\n静かに浮かんでいる。' : '霧の中へ、船を進める。\n青い鬼火が、ひとつ、またひとつ……。', { ms: 2400 });
    await ev.warp('ghost_ship_1', 'board');
  }, { meta: { needs: ['flag:isles_ship', 'flag:isles_fog_open'] } });

  // ---------------------------------------------------------------- 灯台島（灯台守のいない灯台・灯室）
  E('isles_light_plaque', async (ev) => {
    await ev.say(null, '灯台の石の銘板。\n「マレア諸島　東の灯台\n灯台守　不在」');
  });
  E('isles_light_arrive', async (ev) => {
    if (ev.flag('isles_light_seen')) return;
    ev.setFlag('isles_light_seen');
    await ev.caption(ev.flag('isles_light_lit') || cleared(ev) ? '灯台の上で、灯が回っている。' : '白い灯台が、灯をともさずに立っている。\n灯台守の小屋は、屋根が落ちている。', { ms: 2400 });
  });
  E('isles_lamp', async (ev) => {
    if (cleared(ev)) { await ev.say(null, '大きなランプの中で、橙の灯が\n静かに燃えている。\n六十年、海を渡ってきた灯だ。'); return; }
    if (ev.flag('isles_light_lit')) { await ev.say(null, 'ランプに灯がともっている。\n沖まで、光が届いているはずだ。'); return; }
    if (!ev.has('k_lamp_oil')) { await ev.say(null, '灯室の大きなランプ。油が\n乾ききっていて、火が入らない。'); return; }
    const i = await ev.choose(['油をさして、灯をともす', 'やめる'], { text: '灯台の油を持っている。' });
    if (i !== 0) return;
    ev.take('k_lamp_oil', 1);
    ev.sfx('light');
    try { R.Field.flash && R.Field.flash('#ffd890', 400); } catch (e) { /* */ }
    ev.setFlag('isles_light_lit');
    await ev.caption('灯台に、灯がともった。\n光の帯が、夜の海を回りはじめる。', { ms: 2600 });
    ev.leadDone('q_isles_light');
  }, { meta: { needs: ['item:k_lamp_oil'], gives: ['flag:isles_light_lit'] } });
  E('isles_lamproom_letter', async (ev) => {
    if (ev.flag('isles_lz_found')) { await ev.say(null, '手紙のあった机。ほかには\n何も残っていない。'); return; }
    ev.setFlag('isles_lz_found');
    await ev.say(null, '灯室の机の引き出しに、\n封のされた手紙が残っていた。\n灯台守の物ではないようだ。');
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:isles_lz_found'] } });
  E('isles_keeper_log', async (ev) => {
    await ev.say(null, '灯台守のいない灯台の日誌。\n最後の書きこみは、去年のものだ。');
    await ev.say(null, '「記録院の方、小舟を借りたいと。\n霧の晩に、沖の鬼火まで。\n返ってきた舟には、誰も\n乗っていなかった。」');
    await ev.say(null, '……いや、日誌の続きには、\n「白い本を抱えて、翌朝\n泳いで戻った」とある。');
    ev.lead('l_main_recorder_isles');
  }, { meta: { needs: [], gives: ['lead:l_main_recorder_isles'] } });

  // ---------------------------------------------------------------- 人魚の歌う岩（#34）
  E('isles_siren_rock', async (ev) => {
    if (ev.flag('isles_siren_heard')) { await ev.say(null, '風が吹くたびに、穴の空いた岩が\nかすかに歌う。'); return; }
    await ev.say(null, '丸い穴のたくさん空いた、黒い岩。\n風が吹きぬけると、低い音が\n鳴りはじめた。');
    ev.sfx('bell');
    await ev.caption(X().SHANTY_B, { ms: 3400 });
    ev.setFlag('isles_siren_heard');
    await ev.say(null, '……歌だ。古い舟歌の節に聞こえる。\n{hero}は、節を覚えた。');
    await ev.say(null, '岩のすき間に、真珠色のくしが\nはさまっていた。');
    ev.item('u_siren_comb', 1);
    ev.leadDone('l_opt_siren');
  }, { meta: { needs: [], gives: ['flag:isles_siren_heard', 'item:u_siren_comb'] } });

  // ---------------------------------------------------------------- 財宝ヤドカリの島（#35）
  E('isles_crab_nest', async (ev) => {
    if (ev.flag('isles_crab_seen')) { await ev.say(null, '貝がらと古い金貨の山。\n巣の主は、今は留守のようだ。'); return; }
    ev.setFlag('isles_crab_seen');
    await ev.say(null, '貝がらと古い金貨とサンゴが、\n山のように積まれている。\n大きなヤドカリの巣だ。');
    await ev.say(null, '砂の上に、宝箱ほどの大きさの\n足あとが続いている……。\n巣の主は、海の上の船の近くに\nよく出るらしい。');
    ev.gold(80 + 40 * X().tier());
    ev.leadDone('l_opt_crab');
  }, { meta: { needs: [], gives: ['flag:isles_crab_seen'] } });

  // ---------------------------------------------------------------- 座礁した商船（選択 ch_isles_wreck）
  E('isles_wreck', async (ev) => {
    if (ev.flag('isles_wreck_done')) {
      await ev.say(null, ev.choiceOf('ch_isles_wreck') === 'help' ? '岩に乗り上げた商船。船員たちは\nもう、誰も残っていない。' : '岩に乗り上げた商船。流れ出た\n積荷は、もう拾い尽くした。');
      return;
    }
    await ev.say('wreck_captain', 'おおい、そこの船！\n助けてくれ、岩に乗り上げちまった！\f船員が六人、船に残ってる。\nこっちの小舟じゃ、波に負けるんだ！');
    await ev.say(null, '潮が満ちてきた。船べりから、\n積荷の箱が次々と流れ出している。\n……両方は、間に合いそうにない。');
    const i = await ev.choose(['船員を助ける', '積荷を拾う'], { text: 'どうする？' });
    ev.setFlag('isles_wreck_done');
    if (i === 0) {
      ev.choice('ch_isles_wreck', 'help');
      for (let n = 1; n <= 3; n++) {
        await ev.fade('out', 400);
        ev.sfx('water');
        await ev.caption('小舟を出して、船員を二人ずつ\n浜へ運んだ。（' + n + '/3）', { ms: 1800 });
        await ev.fade('in', 400);
      }
      await ev.say('wreck_captain', '全員、無事だ……！\nありがとう、本当にありがとう。\f礼をしたいが、今は何もない。\nコーラルの酒場で、また会おう。');
      ev.setFlag('isles_wreck_saved');
    } else {
      ev.choice('ch_isles_wreck', 'cargo');
      ev.sfx('water');
      await ev.caption('流れ出た積荷の箱を、\n浜へ引き上げた。', { ms: 2000 });
      await ev.say('wreck_captain', '……おい、おれたちは箱以下かよ！\nいいさ、自分で泳ぐさ！');
      await ev.say(null, '船員たちは、なんとか自分で\n浜へ泳ぎついた。');
    }
    try { await ev.leave('wreck_captain', { ms: 600 }); } catch (e) { /* */ }
  }, { meta: { needs: [], gives: ['flag:isles_wreck_done', 'choice:ch_isles_wreck'] } });
  // ---------------------------------------------------------------- 島の道（白崖の道・夜光虫の入り江・ネレイの岬道）
  E('isles_watchtower', async (ev) => {
    await ev.say(null, '崩れた白い見張り塔。石に、\n古い落書きが刻まれている。\n「霧の晩、沖に橙の灯。グレンの船」');
  });
  E('isles_cove_glow', async (ev) => {
    await ev.say(null, cleared(ev) ? '波打ちぎわで、夜光虫が青く光っている。\n遠くの灯台島の灯が、水にうつる。'
      : '波打ちぎわで、夜光虫が青く光っている。\n沖の霧の中にも、青い光がひとつ。\n……鬼火だろうか。');
  });
  E('isles_signal_mast', async (ev) => {
    await ev.say(null, '古い信号の帆柱。すり切れた綱に、\n色のあせた旗が一枚だけ残っている。\n「帰港せよ」の旗だ。');
  });
})(window.RPG);
