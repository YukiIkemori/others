// CONTENT（マレア諸島）: 岬の村ネレイ（WORLD_REDESIGN §4.5 の流れ 5・6・§5.9、STORY_BIBLE §7.5・§8.6・§11.8）。
//   マリナ（待つ人。本物の朝の証人）: 舟歌の前半しか覚えていない。朝日の色の話（lo_time_isles、3 行）。
//     人魚の歌う岩で後半の節を聞いていれば、その場で最後まで歌える（v_marina_nerei_01・待つ人のくし）。
//     聞いていなければ、マリナが思い出すまで一晩（村の宿で 1 泊）→ 翌朝、思い出す（v_marina_nerei_01）。
//   岬の先: マリナが歌う前に行くと、灰色のマントの少女（v_fine_isles_01、録音の文のまま）。
//   夜の桟橋: 海図の海域が絞れていて、外洋船があれば、マリナが歌う（v_marina_pier_01）→ 霧 → 自分の船で霧の中へ（幽霊船）。
//   灯り守り: 岬の灯と灯台島の灯（【灯りを守る】灯台の油）・記録官の小舟の話（本筋の手がかり）。雑貨屋（組合の配達の届け先）・宿（一晩）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const MARINA = { name: 'マリナ' }, FINE = { name: '灰色のマントの少女' };

  E('nerei_arrival', async (ev) => {
    if (ev.flag('isles_nerei_seen')) return;
    ev.setFlag('isles_nerei_seen');
    await ev.caption('岬の村ネレイ。細い尾根に、\n白い家がひと筋に並んでいる。', { ms: 2600 });
  });

  // ---------------------------------------------------------------- マリナ
  E('nerei_marina', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.call('nerei_marina_after'); return; }
    if (!ev.flag('isles_marina_met')) {
      ev.setFlag('isles_marina_met');
      await ev.say('marina', '……おや、旅の人かい。\nコーラルから来たんだね。', MARINA);
      await ev.say('marina', '沖の鬼火のことだろう？\nあれは、グレンの船だよ。\n六十年前、朝日の中を出ていって、\n帰らなかった人……。', MARINA);
      await ev.say('marina', '今の子は、朝日を知らないんだってね。\n……わたしは、覚えてるよ。\nあの人を見送った朝だもの。', MARINA);
      await ev.say('marina', '海の向こうが白んで、次に\n金色の線が走って、それから\n水が一面、桃色に染まるのさ。', MARINA);
      await ev.say('marina', 'いつ、朝が来なくなったのかって？\n……さあね。ついこのあいだまで、\nあったような気がするんだけどね。', MARINA);
      await x.lore(ev, 'lo_time_isles');
      await ev.say('marina', 'あの人の舟歌を、ずっと歌ってきた。\n霧の晩に歌えば、沖の灯が\n答えてくれたんだ。……去年まではね。', MARINA);
      await ev.caption(x.SHANTY_A, { ms: 3200 });
      await ev.say('marina', '……続きが、出てこないんだよ。\nこの年になって、あの人の歌を\n忘れるなんてね。', MARINA);
      ev.leadDone('l_isles_song');
      ev.lead('l_isles_fog');
    }
    if (!ev.flag('isles_song_ready')) {
      if (ev.flag('isles_siren_heard')) { await ev.call('isles_marina_remember_siren'); return; }
      if (ev.flag('isles_marina_night')) { await ev.call('isles_marina_remember'); return; }
      await ev.say('marina', '一晩、ゆっくり思い出してみるよ。\n村の宿にでも泊まって、\n明日また来ておくれ。', MARINA);
      return;
    }
    if (!ev.flag('isles_song_done')) {
      if (ev.flag('isles_fog_found') && ev.flag('isles_ship')) { await ev.call('isles_night_pier'); return; }
      await ev.say('marina', '歌ってやりたいけど、霧の海が\nどこなのか分からなきゃね。\f港の親方の海図の空白を\n埋めておいで。自分の船でね。', MARINA);
      return;
    }
    await ev.say('marina', 'あの人の船が、霧の中で待っている。\nどうか、あの人に舟歌を\n届けておくれ。', MARINA);
  }, { meta: { needs: [], gives: ['flag:isles_marina_met', 'lore:lo_time_isles', 'lead:l_isles_fog'], calls: ['isles_marina_remember_siren', 'isles_marina_remember', 'isles_night_pier', 'nerei_marina_after'] } });
  // 岩の節を聞いていた → その場で最後まで歌える（対の品: 待つ人のくし）
  E('isles_marina_remember_siren', async (ev) => {
    if (ev.flag('isles_song_ready')) return;
    await ev.say(null, '{hero}は、人魚の歌う岩で覚えた節を\n口ずさんだ。');
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    await ev.say('marina', '……ああ、この歌だよ。', Object.assign({ voice: 'v_marina_nerei_01' }, MARINA));
    await ev.say('marina', '岩が覚えていてくれたんだね。\nあの人は、よくあの岩の陰で\n帆を休めていたんだよ。', MARINA);
    await ev.say('marina', 'お礼に、これをあげよう。\n若いころ、あの人と対にして\n買ったくしさ。', MARINA);
    ev.item('u_shore_comb', 1);
    ev.setFlag('isles_song_ready');
    await X().lore(ev, 'lo_isles_shanty');
  }, { meta: { needs: ['flag:isles_siren_heard', 'flag:isles_marina_met'], gives: ['flag:isles_song_ready', 'item:u_shore_comb', 'lore:lo_isles_shanty'] } });
  // 一晩待った → 翌朝、思い出す
  E('isles_marina_remember', async (ev) => {
    if (ev.flag('isles_song_ready')) return;
    await ev.say('marina', 'ゆうべ、夢の中で、あの人が\n甲板で歌っていたんだよ。', MARINA);
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    await ev.say('marina', '……ああ、この歌だよ。', Object.assign({ voice: 'v_marina_nerei_01' }, MARINA));
    ev.setFlag('isles_song_ready');
    await X().lore(ev, 'lo_isles_shanty');
  }, { meta: { needs: ['flag:isles_marina_night'], gives: ['flag:isles_song_ready', 'lore:lo_isles_shanty'] } });

  // ---------------------------------------------------------------- 夜の桟橋（マリナが歌う → 霧 → 自分の船で霧の中へ）
  E('isles_night_pier', async (ev) => {
    if (ev.flag('isles_song_done')) return;
    await ev.say('marina', '今夜、桟橋で歌うよ。\nあんたの船も、つないでおきな。', MARINA);
    await ev.fade('out', 700);
    await ev.caption('その夜――', { ms: 1800 });
    ev.setFlag('isles_song_scene');
    await ev.warp('nerei', 'pier');
    ev.bgm('ghost');
    await ev.say(null, 'マリナは桟橋の先に立ち、\n霧の海へ向かって歌いはじめた。');
    ev.sfx('bell');
    await ev.caption(X().SHANTY_A, { ms: 3200 });
    await ev.caption(X().SHANTY_B, { ms: 3200 });
    try { R.Field.flash && R.Field.flash('#9fc8ff', 500); } catch (e) { /* */ }
    await ev.say(null, '沖に、白い霧が湧き上がった。\n霧の奥に、青白い灯が\nひとつ、またひとつ……。');
    await ev.say('marina_pier', 'あの人の船だ……。', Object.assign({ voice: 'v_marina_pier_01' }, MARINA));
    await ev.say('marina_pier', 'あの船は、この桟橋までは\n来てくれない。……迷っているんだ。\f{hero}、あんたの船で追っておくれ。\nわたしは、ここで待っているよ。\n六十年、待ったんだもの。', MARINA);
    ev.setFlag('isles_song_done');
    ev.setFlag('isles_fog_open');
    await ev.fade('out', 600);
    ev.sfx('ship');
    await ev.caption('{hero}たちは外洋船に乗りこみ、\n霧の中へ舵を切った。', { ms: 2600 });
    ev.setFlag('isles_song_scene', false);
    await ev.warp('ghost_ship_1', 'board');
  }, { meta: { needs: ['flag:isles_song_ready', 'flag:isles_fog_found', 'flag:isles_ship'], gives: ['flag:isles_song_done', 'flag:isles_fog_open'], warp: { to: 'ghost_ship_1', spawn: 'board' } } });

  // ---------------------------------------------------------------- 岬の先（灰色のマントの少女。マリナが歌う前）
  E('isles_fine_cape', async (ev) => {
    if (ev.flag('isles_fine_seen') || ev.flag('isles_song_done') || !ev.flag('isles_marina_met')) return;
    R.Audio && R.Audio.pushBgm && R.Audio.pushBgm('fine_theme');
    try {
      await ev.say(null, '岬の灯のそばに、灰色のマントの\n少女が立っていた。\n霧の海を、じっと見ている。');
      await ev.say('fine', '待っている人がいる限り、\n物語は終わらない。', Object.assign({ voice: 'v_fine_isles_01' }, FINE));
      const t = Math.min(7, X().tier());
      if (t >= 3) await ev.caption('少女の足もとが、透けて見えた。', { ms: 1800 });
      ev.sfx('magic');
      ev.setFlag('isles_fine_seen');
      try { await ev.leave('fine', { ms: 900 }); } catch (e) { /* */ }
      await ev.caption('振り向くと、少女の姿はなかった。', { ms: 2000 });
    } finally { R.Audio && R.Audio.popBgm && R.Audio.popBgm(); }
  }, { meta: { needs: ['flag:isles_marina_met'], gives: ['flag:isles_fine_seen'] } });
  E('nerei_cape_lamp', async (ev) => {
    if (cleared(ev)) { await ev.say(null, '岬の石の灯。橙の灯が、\n沖の灯台島の灯と\n呼びあうように揺れている。'); return; }
    await ev.say(null, '岬の先の石の灯。\nマリナが六十年、毎晩ともしてきた灯だ。\n霧の晩も、消えたことがない。');
  });

  // ---------------------------------------------------------------- 解決の後のマリナ（潮騒の耳飾り）
  E('nerei_marina_after', async (ev) => {
    if (!ev.flag('isles_reward_given')) {
      ev.setFlag('isles_reward_given');
      await ev.say('marina', '{hero}、ありがとう。\nあの人は、ちゃんと\n帰ってきてくれたよ。', MARINA);
      await ev.say('marina', 'これを、持っていっておくれ。\nあの人が、船出の前にくれた\n耳飾りさ。\f潮騒の音がするだろう？\nあの人の船が、いつも\nそばにいるようでね。', MARINA);
      ev.item('ac_tale_isles', 1);
      return;
    }
    const t = X().tier();
    await ev.say('marina', t >= 6 ? 'この島でも、子守歌を忘れる人が\n出ているんだよ。……わたしは\n忘れない。舟歌も、あの人の顔も。'
      : '毎朝、桟橋で舟歌を歌うのよ。\nあの人に、聞こえるようにね。', MARINA);
  }, { meta: { needs: ['flag:cleared_r_isles'], gives: ['flag:isles_reward_given', 'item:ac_tale_isles'] } });
  E('nerei_marina_shelf', async (ev) => {
    await ev.say(null, ev.flag('isles_ink_given') ? '古い本が並んでいた棚。\n墨の写しのあった所が、\nひとつ空いている。'
      : '古い本が並んでいる。背に\n「グレン船長　航海日誌　写」と\n書かれた一冊がある。');
  });

  // ---------------------------------------------------------------- 灯り守り（岬の灯・灯台島の灯・記録官の小舟）
  E('nerei_lampkeeper', async (ev) => {
    if (cleared(ev)) { await ev.say('lampkeeper', '灯台島の灯が、橙になった。\nグレン船長の灯だ。\nわしの仕事が、ひとつ減ったよ。'); return; }
    if (!ev.flag('isles_light_on')) {
      ev.setFlag('isles_light_on');
      await ev.say('lampkeeper', 'わしは、この村の灯り守りだ。\n岬の灯と、沖の灯台島の灯の番をする。\f……だが、灯台島には、もう何年も\n渡れておらん。灯台守もいない。\n霧の晩が、多すぎてな。');
      await ev.say('lampkeeper', '船があるなら、頼まれてくれんか。\nこの油を、灯室のランプにさしてくれ。\nそれだけで、沖まで光が届く。');
      ev.item('k_lamp_oil', 1);
      ev.lead('q_isles_light');
      await ev.say('lampkeeper', 'そうそう、去年、記録院の男が\n灯台島から小舟を出してな。\n沖の鬼火まで行ったらしい。\f戻ってきたとき、脇に分厚い\n白い本を抱えておった。\n灯台の日誌に、何か残っとるかもしれん。');
      ev.lead('l_main_recorder_isles');
      return;
    }
    await ev.say('lampkeeper', ev.flag('isles_light_lit') ? '灯台に灯が入ったな。\nここからでも見える。ありがとうよ。' : '灯台島は、コーラルの南西の沖だ。\n船の舵で選べばいい。');
  }, { meta: { needs: [], gives: ['item:k_lamp_oil', 'lead:q_isles_light', 'lead:l_main_recorder_isles'] } });

  // ---------------------------------------------------------------- 雑貨屋（組合の配達の届け先）・宿（一晩）
  E('nerei_store_keeper', async (ev) => {
    if (ev.has('k_guild_parcel')) {
      await ev.say('store_keeper', 'あら、組合の荷！　港が閉じてから、\n届かなくて困ってたのよ。');
      ev.take('k_guild_parcel', 1);
      ev.setFlag('isles_delivery_done');
      ev.leadDone('q_isles_delivery');
      ev.gold(150 + 50 * X().tier());
      await ev.say('store_keeper', 'はい、お代よ。組合長にも\nよろしく言っておいて。');
    }
    await ev.say('store_keeper', 'いらっしゃい。小さな店だけど、\n旅の品はそろってるよ。');
    await ev.shop('shop_nerei');
  }, { meta: { needs: ['item:k_guild_parcel'], gives: ['flag:isles_delivery_done'] } });
  E('nerei_inn_keeper', async (ev) => {
    await ev.say('nerei_inn_keeper', 'いらっしゃいませ。\n岬の宿へようこそ。');
    const i = await ev.choose(['泊まる', 'やめる'], { text: '泊まっていきますか？' });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (ok === false) return;
    if (ev.flag('isles_marina_met') && !ev.flag('isles_marina_night') && !ev.flag('isles_song_ready')) await ev.call('isles_marina_night');
  }, { meta: { needs: [], gives: [], calls: ['isles_marina_night'] } });
  E('isles_marina_night', async (ev) => {
    if (ev.flag('isles_marina_night')) return;
    ev.setFlag('isles_marina_night');
    await ev.caption('夜ふけ、岬のほうから、\n途切れ途切れの歌が聞こえた。', { ms: 2400 });
  }, { meta: { needs: ['flag:isles_marina_met'], gives: ['flag:isles_marina_night'] } });
  E('nerei_inn_guest', async (ev) => {
    await ev.say('nerei_inn_guest', '北の人魚の歌う岩を知ってるかい。\n風が吹くと、古い舟歌の節を\n歌うんだ。漁師はみんな知ってる。');
    ev.lead('l_opt_siren');
  }, { meta: { needs: [], gives: ['lead:l_opt_siren'] } });

  // ---------------------------------------------------------------- 村の人
  E('nerei_fisher', async (ev) => {
    if (cleared(ev)) { await ev.say('nerei_fisher', '霧が出ても、舟歌を歌えば\n迷わない。昔に戻ったのさ。'); return; }
    await ev.say('nerei_fisher', '霧の晩は、網を上げて早く帰る。\n鬼火について行った仲間は、\n誰も帰らなかったからな。');
  });
  E('nerei_child', async (ev) => {
    await ev.say('nerei_child', cleared(ev) ? 'マリナばあちゃん、毎朝\n桟橋で歌ってるよ！' : 'マリナばあちゃんはね、毎晩\n岬の灯をともすの。\n一回も休んだことないんだって。');
  });
  E('nerei_oldman', async (ev) => {
    const s = X().skyLine();
    await ev.say('nerei_oldman', s || '洞窟の大ダコはな、足を切っても\nまた生やしてくる。\n本体をたたくのが早道じゃよ。');
  }, { meta: { needs: [], gives: [] } });
  E('nerei_house_wife', async (ev) => {
    await ev.say('house_wife', 'マリナさんは、若いころ\n記録院の分室で働いてたって。\n本を読むのが好きな人なのよ。');
  });
})(window.RPG);
