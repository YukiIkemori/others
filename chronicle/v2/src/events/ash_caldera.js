// CONTENT（灰の荒野）: 炎の町カルデラの人と物・炎の試練（闘技大会）（WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8）。
//   流れ: 着く（闘技場の歓声・受付の列）→ 受付で出場（名簿 = lo_ev_ash）→ 5 回戦（回ごとに控え室で全快、負けたらその回から）
//         → 4 回戦のあと宿で休むと、決勝の前夜の使い（八百長の誘い ch_ash_bribe）→ 決勝ザクロ → 優勝（ash_champion。族長が火山の岩戸を開ける）
//         → 火山（ash_volcano.js）。巫女カヤ（卵・壁画）と族長ドルガ（歌い手の夜 = lo_war_ash）は好きな時に。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
//   ボイスは本筋の要の台詞だけ（ドルガ・カヤ・ザクロ。design/voice/story_v2_lines.csv）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Ash.ev;
  const cleared = (ev) => ev.flag('cleared_r_ash');
  const champ = (ev) => ev.flag('ash_champion');
  const KAYA = { name: 'カヤ' }, DORGA = { name: 'ドルガ' }, ZAKURO = { name: 'ザクロ' };

  // ---------------------------------------------------------------- 町に入る・闘技場に入る
  E('caldera_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('ash_arrived_after')) { ev.setFlag('ash_arrived_after'); await ev.caption('カルデラ。溶岩の堀が、\n前より明るく町を照らしている。', { ms: 2400 }); }
      return;
    }
    if (ev.flag('ash_arrived')) return;
    ev.setFlag('ash_arrived');
    await ev.caption('炎の町カルデラ。\n冷えた古い火口の内側に、\n輪の段々が底へ下りていく町。', { ms: 2600 });
    await ev.caption('町の底の闘技場から、\n歓声が湧き上がった。', { ms: 2000 });
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['flag:ash_arrived', 'lead:l_ash_trial'] } });
  E('arena_arrive', async (ev) => {
    if (ev.flag('ash_arena_seen')) return;
    ev.setFlag('ash_arena_seen');
    await ev.caption(cleared(ev) ? '闘技場。今夜も、腕試しの\n歓声が響いている。' : '闘技場。受付の前に、\n出場を待つ闘士の列ができている。', { ms: 2200 });
  });

  // ---------------------------------------------------------------- 受付（出場・次の回・決勝の前夜・挑戦者の間）
  E('arena_reception', async (ev) => {
    const x = X();
    if (cleared(ev)) { await ev.call('arena_challenge'); return; }
    if (champ(ev)) { await ev.say('receptionist', ['優勝、おめでとうございます！\n火山の岩戸は、族長が開けました。', '闘技場の売り台も、どうぞ。']); await ev.shop('shop_arena'); return; }
    if (!ev.flag('ash_entered')) {
      await ev.say('receptionist', ['炎の試練の受付です。\n勝ち抜いた一人だけが、\n火口に入ることを許されます。', 'よそのお方も出られますよ。\n五回勝てば、優勝です。']);
      const i = await ev.choose(['出場する', 'やめておく'], { text: '炎の試練に出場する？' });
      if (i !== 0) return;
      ev.setFlag('ash_entered');
      ev.item('k_arena_token', 1);
      await ev.say('receptionist', ['名簿に書き入れました。\nあなたは十七番。', '十六番の方も、よそのお方ですよ。\n……記録院付き、ですって。']);
      ev.lead('l_ash_stranger');
      ev.leadDone('l_ash_trial');
      ev.lead('l_ash_trial');
      return;
    }
    const n = x.round(ev) + 1;
    if (n > 5) return;
    if (n === 5 && !ev.flag('ash_eve_done')) {
      await ev.say('receptionist', ['四回戦まで勝ち抜きましたね！', '決勝は、明日の夜です。\n今夜は宿で、ゆっくり休んで。']);
      return;
    }
    const b = x.BOUTS[n];
    const i = await ev.choose([`${b.name}に出る`, 'まだ支度をする'], { text: `${b.name}の相手は、${b.foe}。` });
    if (i !== 0) return;
    await ev.call('arena_bout', { n });
  }, { meta: { needs: [], gives: ['flag:ash_entered', 'item:k_arena_token', 'lead:l_ash_stranger'], calls: ['arena_bout', 'arena_challenge'] } });

  // 1 回戦ぶん: 砂の場へ → 相手が現れる → 戦い → 勝てば控え室で全快（負けてもその回から）
  E('arena_bout', async (ev, ctx) => {
    const x = X();
    const n = (ctx && ctx.n) || x.round(ev) + 1;
    const b = x.BOUTS[n];
    if (!b) return;
    await ev.fade('out', 500);
    await ev.warp('caldera_arena', 'sand');
    ev.setVar('ash_bout', n);
    ev.sfx('cheer');
    await ev.caption(`炎の試練、${b.name}！\n観客席が、足踏みで揺れる。`, { ms: 2000 });
    await ev.say(null, b.intro);
    if (n === 5) await ev.call('arena_final_words');
    const r = await ev.battle(b.troop, { canLose: true, boss: n >= 4 });
    ev.setVar('ash_bout', 0);
    if (r !== 'win') {
      ev.addVar('ash_losses', 1);
      await ev.fade('out', 500);
      await ev.warp('caldera_arena', 'waiting');
      ev.rest();
      await ev.caption('控え室で、目を覚ました。\n（HP・MP が回復した）', { ms: 2000 });
      await ev.say('receptionist', `もう一度、${b.name}からですよ。\n支度ができたら、声をかけて。`);
      return;
    }
    ev.setVar('ash_round', n);
    ev.setFlag('ash_round_' + n);
    if (n === 5) { await ev.call('arena_champion'); return; }
    await ev.caption(`${b.name}、勝ち抜き！\n歓声が、火口の縁まで\n駆け上がっていく。`, { ms: 2200 });
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    await ev.caption('控え室で、ひと息ついた。\n（HP・MP が回復した）', { ms: 1800 });
  }, { meta: { needs: ['flag:ash_entered'], gives: ['var:ash_round+5', 'flag:ash_round_4'], calls: ['arena_champion', 'arena_final_words'] } });

  // 決勝の前のザクロ（律儀）
  E('arena_final_words', async (ev) => {
    await ev.say('opp_5', ['ザクロだ。雇われだが、\n手は抜かねえ。', '大技の前には、そう言う。\nそれが決まりだ。……構えな。'], ZAKURO);
    if (ev.choiceOf('ch_ash_bribe') === 'accept') await ev.say('opp_5', '……前の晩の使いの話は、\n聞かなかったことにしてくれ。\n俺は、ああいうのは好かねえ。', ZAKURO);
  });

  // 優勝: 族長が砂に下りてくる → 火口の岩戸を開ける（ash_champion）
  E('arena_champion', async (ev) => {
    if (champ(ev)) return;
    ev.setFlag('ash_champion');
    if (!ev.var('ash_losses')) ev.setFlag('ash_unbeaten');
    ev.bgm('dawn');
    await ev.caption('ザクロが、刀を砂に置いた。\n……闘技場が、一瞬しんとなり、\nそれから割れるような歓声。', { ms: 2800 });
    await ev.say(null, '族長のドルガが、観客席から\n砂の上へ下りてきた。');
    await ev.say('dorga', ['炎の試練の勝者よ。\n一族のしきたりにより、\n火口の岩戸を開けよう。', '火の鳥の卵は、火口の底だ。\n……巫女のカヤにも、会っていけ。'], DORGA);
    if (ev.choiceOf('ch_ash_bribe') === 'accept') await ev.say('dorga', ['前の晩、使いが来たそうだな。\nわしの耳は、闘技場じゅうにある。', '使いの金は、わしが突き返した。\n……それで帳消しにはならんがな。'], DORGA);
    if (ev.flag('ash_unbeaten')) await ev.caption('一度も砂に膝をつかなかった。\n勝ち抜きの板に、\n「無敗の語り部」の名が刻まれた。', { ms: 2600 });
    ev.leadDone('l_ash_trial');
    ev.leadDone('l_ash_stranger');
    ev.lead('l_ash_volcano');
    ev.lead('l_ash_egg');
    ev.take('k_arena_token', 1);
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    ev.mapBgm();
  }, { meta: { needs: ['var:ash_round>=5'], gives: ['flag:ash_champion', 'lead:l_ash_volcano', 'lead:l_ash_egg'], warp: { to: 'caldera_arena', spawn: 'waiting' } } });

  // ---------------------------------------------------------------- 決勝の前夜（宿で休むと使いが来る。八百長の誘い）
  E('ash_eve', async (ev) => {
    if (ev.flag('ash_eve_done') || X().round(ev) < 4) return;
    ev.setFlag('ash_eve_on');
    await ev.caption('その夜。戸を、小さく\nたたく音がした。', { ms: 2000 });
    try { await ev.appear('messenger', { ms: 700 }); } catch (e) { /* */ }
    await ev.say('messenger', ['夜分に失礼。ザクロの旦那の\n雇い主の、使いの者です。', '明日の決勝、負けてくれれば\n金を出しましょう。', 'こちらは、火口の壁画を\n写すだけでいい。……誰も\n困りはしない話でしょう？']);
    const i = await ev.choose(['断る', '受ける'], { text: '決勝で負けてくれ、という。' });
    if (i === 1) {
      ev.choice('ch_ash_bribe', 'accept');
      await ev.say('messenger', ['話が早い。金は、決勝のあとで。', '旦那の組は、明後日の夜明け前、\n消灯の刻が明けるころに、\n火山の西の壁画を写しに入る手はずです。', '……おっと、余計なことを。\nでは、よい試合を。']);
      await ev.say(null, '――明後日の、夜明け前。\n西の壁画。……覚えておこう。');
    } else {
      ev.choice('ch_ash_bribe', 'refuse');
      await ev.say('messenger', ['……そうですか。', 'まあ、どのみち写すものは\n写しますがね。では。']);
    }
    try { await ev.leave('messenger', { ms: 700 }); } catch (e) { /* */ }
    ev.setFlag('ash_eve_on', false);
    ev.setFlag('ash_eve_done');
  }, { meta: { needs: ['flag:ash_round_4'], gives: ['flag:ash_eve_done', 'choice:ch_ash_bribe'] } });

  // ---------------------------------------------------------------- 宿「湯けむり亭」
  E('caldera_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? 'いらっしゃい。火の鳥が飛んでから、\n湯が前よりあったかいのよ。' : 'いらっしゃい、湯けむり亭へ。\n闘士さんは、よく眠って。');
    const i = await ev.choose(['休む', 'やめる'], { text: '泊まっていく？' });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (!ok) return;
    if (X().round(ev) >= 4 && !ev.flag('ash_eve_done')) await ev.call('ash_eve');
  }, { meta: { needs: [], gives: [], calls: ['ash_eve'] } });
  E('caldera_inn_guest', async (ev) => {
    await ev.say('inn_guest', ['荒野の北の岩の間に、\n湯の郷があるんだ。湯気が\n噴き出してるから、すぐわかる。', '西の折れた剣の碑には、\n近づかんほうがいい。\n夜ごと、鬨の声がするそうだ。']);
    ev.lead('l_opt_spa');
    ev.lead('l_opt_battlefield');
  }, { meta: { needs: [], gives: ['lead:l_opt_spa', 'lead:l_opt_battlefield'] } });

  // ---------------------------------------------------------------- 火の神殿（巫女カヤ・種火・火の鳥の巡りの記録）
  E('caldera_kaya', async (ev) => {
    if (cleared(ev)) { await ev.call('caldera_kaya_after'); return; }
    if (!ev.flag('ash_kaya_met')) {
      ev.setFlag('ash_kaya_met');
      await ev.say('kaya', 'わたしは、火の神殿の巫女カヤ。', KAYA);
      await ev.say('kaya', '卵が、冷えていくの。\n火の鳥の物語を、語ってあげなきゃ\nいけないのに……。', Object.assign({ voice: 'v_kaya_ash_01' }, KAYA));
      await ev.say('kaya', '去年、記録院の人に語ったら、\nそれきり……声に出そうとしても、\n出てこないの。', Object.assign({ voice: 'v_kaya_ash_02' }, KAYA));
      await ev.say('kaya', ['火山の壁には、昔の巫女たちが\n描いた絵が残っているはず。', 'でも、火口に入れるのは、\n炎の試練の勝者だけ。\n……一族のしきたりなの。'], KAYA);
      ev.lead('l_ash_egg');
      ev.lead('l_ash_murals');
      ev.lead('l_ash_trial');
      ev.lead('l_main_recorder_ash');
      return;
    }
    const k = X().murals(ev);
    if (ev.flag('ash_lavabeast')) await ev.say('kaya', '卵のそばで、壁画の物語を\n語ってあげて。……お願い。', KAYA);
    else if (k >= 3) await ev.say('kaya', ['三つの壁画を、全部……？\nそれが、火の鳥の物語よ。', '火口へ行って。\n卵のそばで、語ってあげて。'], KAYA);
    else if (k > 0) await ev.say('kaya', '壁画を見つけたのね！\n残りも、きっと\n火山の中にあるわ。', KAYA);
    else if (champ(ev)) await ev.say('kaya', ['優勝したのね。……火山の壁画を、\n読み解いてきて。', '壁画は三つ。三つ読めば、\n火口への岩戸が開くはず。'], KAYA);
    else await ev.say('kaya', '火口に入れるのは、試練の勝者だけ。\n……闘技場の受付へ。', KAYA);
  }, { meta: { needs: [], gives: ['flag:ash_kaya_met', 'lead:l_ash_egg', 'lead:l_ash_murals', 'lead:l_main_recorder_ash'], calls: ['caldera_kaya_after'] } });
  // 解決の後: 残り火の宝珠（ac_tale_ash）と、火の鳥の背（止まり木）
  E('caldera_kaya_after', async (ev) => {
    if (!ev.flag('ash_kaya_reward')) {
      ev.setFlag('ash_kaya_reward');
      await ev.say('kaya', ['火の鳥が、空へ飛んでいくのが\n見えたわ。', 'あなたが語ってくれた物語、\n今度は、わたしが覚えておく。\n百年後の巫女に、伝えられるように。'], KAYA);
      await ev.say('kaya', 'これは、神殿に伝わる宝珠。\n火の鳥の残り火が\n宿っているんですって。', KAYA);
      ev.item('ac_tale_ash', 1);
      await ev.say('kaya', ['それから、これ。火の鳥の羽よ。', '神殿の止まり木で羽をかざせば、\n火の鳥が、あなたを背に乗せて\n飛んでくれるわ。'], KAYA);
      ev.item('k_phoenix_plume', 1);
      return;
    }
    const i = await ev.choose(['火の鳥の背に乗る', '話を聞く'], { text: 'カヤは、止まり木の前に立っている。' });
    if (i === 0) { await ev.call('caldera_phoenix'); return; }
    const t = X().tier();
    await ev.say('kaya', t >= 6 ? '火の鳥が、何日も前から\n北の空をにらんでいるの。' : t >= 4 ? '記録院のお触れ……。\n物語は、紙の中じゃなくて\n人の声の中で生きるのに。' : '火の鳥の物語は、もう\n忘れない。毎晩、神殿で\n語っているの。', KAYA);
  }, { meta: { needs: ['flag:cleared_r_ash'], gives: ['flag:ash_kaya_reward', 'item:ac_tale_ash', 'item:k_phoenix_plume'] } });
  // 火の鳥の背（WORLD §2.5）: 行ったことのある町へ飛ぶ。天空の石舞台などの止まり木は、あとの工程で足す
  E('caldera_phoenix', async (ev) => {
    if (!ev.has('k_phoenix_plume')) return;
    const list = (R.Field && R.Field.warpList ? R.Field.warpList() : []).filter((l) => l.kind === 'town' && l.id !== 'caldera');
    if (!list.length) { await ev.say(null, '火の鳥は、首をかしげた。\n（行ったことのある町がない）'); return; }
    const i = await ev.choose(list.map((l) => l.name).concat(['やめる']), { text: 'どこへ飛んでもらう？' });
    if (i < 0 || i >= list.length) return;
    await ev.caption('火の鳥の背に乗ると、\n町の灯りが、みるみる\n足の下へ遠ざかった。', { ms: 2200 });
    await ev.fade('out', 600);
    const loc = R.DB.locations[list[i].id];
    await ev.warp(loc.map, loc.spawn);
  }, { meta: { needs: ['item:k_phoenix_plume'], gives: [] } });
  E('caldera_acolyte_in', async (ev) => {
    await ev.say('acolyte_in', cleared(ev) ? ['巫女さまが、毎晩\n物語を語っています。', '子どもたちも、もう\n覚えてしまいましたよ。'] : ['巫女さまは、ずっと\n祈っておいでです。', '種火だけは、絶やしてはならない。\nそれが、神殿の決まりです。']);
  });
  E('caldera_temple_record', async (ev) => {
    await ev.say(null, ['神殿の棚の、古い記録帳。\n「火の鳥の巡り」とある。', '百年ごとの火の鳥の飛んだ晩が、\n巫女の字で書き継がれている。\n「朝日の中を飛ぶ」――', '光暦二九二年、冬至の前夜。\nその欄で、記録は止まっていた。\n翌朝の欄は、白い。']);
    await X().lore(ev, 'lo_time_ash');
  }, { meta: { needs: [], gives: ['lore:lo_time_ash'] } });
  // 【灯りを守る】火守りの見習い: 神殿の種火を、崖の上の灯籠 3 つへ
  E('caldera_seed_fire', async (ev) => {
    if (ev.flag('q_ash_lanterns_on') && !ev.has('k_seed_fire') && !ev.flag('ash_lanterns_done')) {
      await ev.say(null, '祭壇の種火を、素焼きの火壺に\n分けてもらった。');
      ev.item('k_seed_fire', 1);
      return;
    }
    await ev.say(null, ['祭壇の上で、種火が\n静かに燃えている。', cleared(ev) ? '火の鳥の羽が一枚、\n祭壇に供えられていた。' : '火は小さいが、消えそうにはない。']);
  }, { meta: { needs: ['flag:q_ash_lanterns_on'], gives: ['item:k_seed_fire'] } });
  E('caldera_apprentice', async (ev) => {
    if (ev.flag('ash_lanterns_done')) { await ev.say('apprentice', '段々の灯籠のまわりは、\n灰の魔物も寄りつかないんだ。\nありがとう！'); return; }
    const lit = [1, 2, 3].filter((n) => ev.flag('ash_lantern_' + n)).length;
    if (lit >= 3) {
      ev.setFlag('ash_lanterns_done');
      ev.leadDone('q_ash_lanterns');
      ev.take('k_seed_fire', 1);
      await ev.say('apprentice', ['三つとも、ともしてくれたの？\n段々が、ずいぶん明るくなった！', 'これ、見習いのお給金の\n分け前。少ないけど。']);
      X().small(ev, [['gold', 200], ['gold', 300], ['gold', 450], ['gold', 600], ['gold', 800]]);
      return;
    }
    if (ev.flag('q_ash_lanterns_on')) { await ev.say('apprentice', `崖の上の灯籠は、あと ${3 - lit} つ。\n種火は、神殿の祭壇で\n分けてもらえるよ。`); return; }
    await ev.say('apprentice', ['ぼく、火守りの見習いのトト。\n段々の崖の上の灯籠が、\n灰で三つも消えちゃったんだ。', '神殿の祭壇で種火を分けてもらって、\nともして回ってくれない？\nぼく、高い所がこわくて……。']);
    ev.setFlag('q_ash_lanterns_on');
    ev.lead('q_ash_lanterns');
  }, { meta: { needs: [], gives: ['flag:q_ash_lanterns_on', 'lead:q_ash_lanterns', 'flag:ash_lanterns_done'] } });
  E('caldera_lantern', async (ev, ctx) => {
    const o = ctx && R.DB.maps.caldera && (R.DB.maps.caldera.objects || []).find((q) => q.type === 'examine' && q.event === 'caldera_lantern' && q.x === ctx.x && q.y === ctx.y);
    const n = (o && o.lamp) || 1;
    if (ev.flag('ash_lantern_' + n)) { await ev.say(null, '灯籠の火が、崖の下の段々を\n赤く照らしている。'); return; }
    if (!ev.has('k_seed_fire')) { await ev.say(null, '崖の上の、灰に埋もれた灯籠。\n火は、とうに消えている。'); return; }
    ev.setFlag('ash_lantern_' + n);
    ev.sfx('fire');
    await ev.say(null, '灰を払って、種火をともした。');
  }, { meta: { needs: ['item:k_seed_fire'], gives: ['flag:ash_lantern_1', 'flag:ash_lantern_2', 'flag:ash_lantern_3'] } });

  // ---------------------------------------------------------------- 族長ドルガ（歌い手の夜 = lo_war_ash）
  E('caldera_dorga', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'dorga';
    if (ev.flag('ash_finale_done')) {
      await ev.say(id, ev.choiceOf('ch_ash_write') === 'pain' ? ['銘板の下に、板を一枚打ち付けた。\n歌い手の席だ。', 'いつか名がわかったら、\nそこに彫る。……わしの手でな。'] : ['火の鳥が飛んだ夜のことは、\n一族の子らが語り継ぐだろう。', '……あの砂の上のことも、\nいつか、誰かが。'], DORGA);
      return;
    }
    if (!ev.flag('ash_dorga_met')) {
      ev.setFlag('ash_dorga_met');
      await ev.say(id, ['族長のドルガだ。\n旅の者が、よう来た。', '火口の卵が冷えていく。\n灰の荒野の赤も、年々鈍る。', '火口に入れるのは、炎の試練の\n勝者だけだ。よそ者でも構わん。'], DORGA);
      ev.lead('l_ash_trial');
      return;
    }
    if (!ev.flag('lo_war_ash')) {
      await ev.say(id, ['二十年前、わしは代理の闘士だった。\n火の鳥同盟の側のな。', '戦を決める、最後の試合だった。'], DORGA);
      await ev.say(id, '試合の最中に、娘が二人、\n砂の上に下りてきて歌った。\n敵も味方も、剣を止めた。', Object.assign({ voice: 'v_dorga_ash_01' }, DORGA));
      await ev.say(id, '……何を歌っていたのか、\n思い出せん。あの夜から、わしは\nこの大会を『試練』と呼ぶことにした。', Object.assign({ voice: 'v_dorga_ash_02' }, DORGA));
      await X().lore(ev, 'lo_war_ash');
      return;
    }
    await ev.say(id, champ(ev) ? '火口の岩戸は開けておいた。\n……卵を、頼む。' : ['大会の名簿を見たか。\n記録院付きの闘士が出ておる。', '去年は記録官が、火口の壁画を\n写しに来た。……今年も、か。'], DORGA);
  }, { meta: { needs: [], gives: ['flag:ash_dorga_met', 'lead:l_ash_trial', 'lore:lo_war_ash'] } });
  E('caldera_dorga_blade', async (ev) => {
    await ev.say(null, ['壁の刀掛けに、刃こぼれした\n古い大刀が掛かっている。', '柄に巻いた布に、\n火の鳥の紋が縫い取られていた。']);
  });

  // ---------------------------------------------------------------- 闘技場の人と物（名簿・銘板・立会人の席・賭け・ザクロ）
  E('arena_roster', async (ev) => {
    await ev.say(null, ['受付の台の上の、大会の名簿。', '若者組・獣使いのガロ・\n術師の姉妹・鉄鎧のバルガ……', '「十六番　ザクロ（記録院付き）」\nそこだけ、見慣れない字の札だ。']);
    await X().lore(ev, 'lo_ev_ash');
    ev.lead('l_main_recorder_ash');
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lore:lo_ev_ash', 'lead:l_main_recorder_ash', 'lead:l_ash_stranger'] } });
  E('arena_plaque', async (ev) => {
    const lines = ['西の観客席の柱に、\n小さな銘板がある。', '「光暦二九二年　冬至の前夜\n最後の代理試合」', 'その下に、名が二つ\n彫られていたらしい。\n……削れて、読めない。'];
    if (ev.flag('ash_singer_board')) lines.push('銘板の下に、新しい板が一枚。\n「歌い手の席」とだけ、\n彫られている。');
    await ev.say(null, lines);
    await X().lore(ev, 'lo_time_ash');
  }, { meta: { needs: [], gives: ['lore:lo_time_ash'] } });
  E('arena_witness_seat', async (ev) => {
    await ev.say(null, ['西の観客席の上に、背もたれの\n高い石の席がひとつ。', '立会人の席だという。\n二十年、誰も座っていない。\n席の上に、灰が薄く積もっている。']);
  });
  E('arena_board', async (ev) => {
    const lines = ['勝ち抜きの板。\n今年の炎の試練の勝ち上がりが、\n焼き印で押されている。'];
    if (ev.flag('ash_unbeaten')) lines.push('いちばん上に、\n「無敗の語り部」と刻まれている。');
    else if (champ(ev)) lines.push('いちばん上に、十七番の札。');
    await ev.say(null, lines);
  });
  E('arena_rest', async (ev) => {
    if (!ev.flag('ash_entered') || champ(ev)) { await ev.say(null, '控え室の長椅子。\n汗と、湯の花の匂いがする。'); return; }
    const i = await ev.choose(['休む', 'やめる'], { text: '控え室の長椅子で、ひと休みする？' });
    if (i !== 0) return;
    await ev.fade('out', 400);
    ev.rest();
    await ev.fade('in', 400);
    await ev.caption('ひと休みした。\n（HP・MP が回復した）', { ms: 1600 });
  });
  E('arena_zakuro_bag', async (ev) => {
    if (!champ(ev)) { await ev.say(null, ['ザクロの控え室の荷だ。\n……勝手に開けるのは、やめておこう。']); return; }
    await ev.say(null, ev.flag('ash_zakuro_letter') ? '荷は、きちんと縛り直されている。' : ['ザクロの荷だ。\n本人に断ってからにしよう。']);
  });
  E('arena_zakuro', async (ev) => {
    if (ev.flag('ash_zakuro_letter')) { await ev.say('zakuro', ['俺は北へ行く。\n雇い主には、降りたと伝えた。', '……次に会うときは、\n雇われじゃなく会いたいもんだ。'], ZAKURO); return; }
    await ev.say('zakuro', ['負けたよ。いい腕だ。', '記録院に雇われて、\n火口の絵を写す仕事だった。\n写せば、この土地の争いの種が\nなくなるらしい。'], ZAKURO);
    await ev.say('zakuro', '……写す仕事は降りる。\n後味が悪い。', Object.assign({ voice: 'v_zakuro_ash_02' }, ZAKURO));
    await ev.say('zakuro', ['それと、これだ。雇い主から\n預かった荷に、まぎれてた。', '宛名が違う。……俺は開けてねえ。'], ZAKURO);
    await ev.say('zakuro', '人の手紙は読まねえ。\nそういう決まりで生きてる。', Object.assign({ voice: 'v_zakuro_ash_03' }, ZAKURO));
    ev.setFlag('ash_zakuro_letter');
    await X().lz(ev);
    try { await ev.leave('zakuro'); } catch (e) { /* */ }
    ev.setFlag('ash_zakuro_gone');
  }, { meta: { needs: ['flag:ash_champion'], gives: ['flag:ash_zakuro_letter', 'flag:ash_zakuro_gone'] } });
  E('arena_dorga', async (ev) => { await ev.call('caldera_dorga', { npc: 'dorga_plaque' }); });
  E('arena_fan', async (ev) => {
    await ev.say('arena_fan', cleared(ev) ? (X().skyLine() || ['火の鳥、見た？\n闘技場の上を、ぐるっと\n回っていったよ！']) : champ(ev) ? 'ねえ、ザクロを倒したの？\nすっげえ！' : ['四回戦の鉄鎧のバルガは、\n剣がぜんぜん通らないんだ。', 'でも、棍棒や槌で\nたたくと、よく響くんだって！']);
  });
  E('arena_vet', async (ev) => {
    await ev.say('arena_vet', ['術師の姉妹とやるなら、\n姉のヒノエを先に落とせ。\n妹を何度でも起こすからな。', '妹が目を閉じて長く唱えたら、\n身を固めろ。火柱が来るぞ。', '……南の黒い砂浜にゃ、\n動く岩がいる。火山ガメだ。']);
    ev.lead('l_opt_turtle');
  }, { meta: { needs: [], gives: ['lead:l_opt_turtle'] } });
  // 賭け（順番・選択: ほかの試合の勝ちを当てる。段位ごとに 1 回だけ品）
  E('arena_bookie', async (ev) => {
    const x = X();
    await ev.say('bookie', ev.flag('ash_bet_done') ? '当て屋の旦那、今夜も一口どうだい。' : ['賭け屋のボッツだ。\nほかの試合に、一口どうだい。', '当てるたびに、段が上がる。\n三段まで行ったら、いい物をやるよ。']);
    ev.lead('q_ash_bet');
    const MATCHES = [
      { a: '若者組の赤', b: '若者組の青', odds: 2, hint: '赤の頭は、ゆうべ飲みすぎたらしい。' },
      { a: '獣使いのガロ', b: '流れ者のデン', odds: 2, hint: 'デンは、獣が大の苦手だそうだ。' },
      { a: '術師の姉妹', b: '鉄鎧のバルガ', odds: 3, hint: '姉妹は、鎧の継ぎ目を知っている。' },
    ];
    const step = Math.min(ev.var('ash_bet_step'), 2);
    const m = MATCHES[step];
    const stake = [100, 200, 300][step];
    const i = await ev.choose([`${m.a}に賭ける`, `${m.b}に賭ける`, 'やめる'], { text: `${m.a} 対 ${m.b}（${stake} ゴールド）` });
    if (i === 2 || i < 0) return;
    if ((R.Game.gold || 0) < stake) { await ev.say('bookie', '持ち合わせが足りないね。'); return; }
    ev.gold(-stake, { silent: true });
    await ev.caption(`${m.a} 対 ${m.b}。\n……砂けむりの向こうで、\n勝負が決まった。`, { ms: 2000 });
    // 勝つのは、ほのめかしのとおり（前の賭けで聞ける）。はじめの一口は運
    const seed = (R.Game.seed || 1) + ':ash_bet:' + step + ':' + (ev.var('ash_bet_tries') || 0);
    ev.addVar('ash_bet_tries', 1);
    const heard = ev.flag('ash_bet_hint_' + step);
    const winner = heard ? (step === 0 ? 1 : step === 1 ? 0 : 0) : (R.rng(seed).next() < 0.5 ? 0 : 1);
    if (i === winner) {
      ev.gold(stake * m.odds);
      ev.setVar('ash_bet_step', step + 1);
      await ev.say('bookie', step + 1 >= 3 && !ev.flag('ash_bet_done') ? ['三つ続けて当てたか！\n当て屋の旦那だ。', 'これは、賭け屋の守り札。\n持っていきな。'] : '当たりだ！\n払い戻しだよ。');
      if (step + 1 >= 3 && !ev.flag('ash_bet_done')) {
        ev.setFlag('ash_bet_done');
        ev.leadDone('q_ash_bet');
        x.small(ev, [['i_ether', 3], ['i_ether', 3], ['i_ether2', 1], ['i_ether2', 2], ['i_elixir', 1]]);
      }
    } else {
      ev.setFlag('ash_bet_hint_' + step);
      await ev.say('bookie', ['はずれだ。……まあ、そういう夜もある。', 'ひとつ教えてやろう。\n' + m.hint]);
    }
  }, { meta: { needs: [], gives: ['lead:q_ash_bet', 'flag:ash_bet_done'] } });
  // 挑戦者の間（解決の後。5 組の勝ち抜き。3 組と 5 組で品。ティア連動）
  E('arena_challenge', async (ev) => {
    await ev.say('receptionist', ev.flag('ash_challenge_done') ? '挑戦者の間は、いつでも\n開いていますよ。' : ['大会は終わりましたが、\n挑戦者の間が開いています。', '五組を勝ち抜く腕試し。\n三組、五組で品が出ますよ。']);
    ev.lead('q_ash_challenge');
    const i = await ev.choose(['挑戦者の間に入る', '売り台を見る', 'やめる'], { text: '受付のミランが、札を差し出している。' });
    if (i === 1) { await ev.shop('shop_arena'); return; }
    if (i !== 0) return;
    const list = ['tr_ash_r1', 'tr_ash_r2', 'tr_ash_r3', 'tr_ash_r4', 'tr_b_zakuro'];
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'sand');
    let won = 0;
    for (let k = 0; k < list.length; k++) {
      if (k > 0) {
        const c = await ev.choose(['続ける', 'ここでやめる'], { text: `${k} 組を勝ち抜いた。` });
        if (c !== 0) break;
      }
      await ev.caption(`挑戦者の間、${k + 1} 組目！`, { ms: 1200 });
      const r = await ev.battle(list[k], { canLose: true, boss: k >= 3 });
      if (r !== 'win') break;
      won = k + 1;
      if (won === 3 && !ev.flag('ash_challenge_3')) { ev.setFlag('ash_challenge_3'); X().small(ev, [['i_potion', 3], ['i_potion', 4], ['i_elixir', 1], ['i_elixir', 2], ['i_elixir', 2]]); }
      if (won === 5 && !ev.flag('ash_challenge_done')) { ev.setFlag('ash_challenge_done'); ev.leadDone('q_ash_challenge'); X().small(ev, [['gold', 800], ['gold', 1200], ['gold', 1800], ['gold', 2400], ['gold', 3000]]); }
    }
    await ev.fade('out', 400);
    await ev.warp('caldera_arena', 'waiting');
    ev.rest();
    await ev.caption(`挑戦者の間: ${won} 組を勝ち抜いた。\n（HP・MP が回復した）`, { ms: 2000 });
  }, { meta: { needs: ['flag:cleared_r_ash'], gives: ['lead:q_ash_challenge', 'flag:ash_challenge_done'] } });

  // ---------------------------------------------------------------- 店・酒場
  E('caldera_item_keeper', async (ev) => { await ev.say('item_keeper', '殻の道具屋へようこそ。\nやけどの薬なら、ここで。'); await ev.shop('shop_caldera_items'); });
  E('caldera_smith', async (ev) => { await ev.say('smith', '大会に出るなら、得物は\n大事にしな。……打撃の武器もな。'); await ev.shop('shop_caldera_arms'); });
  E('caldera_barkeep', async (ev) => {
    await ev.say('barkeep', cleared(ev) ? ['殻の中の酒場へ、ようこそ。', '火の鳥が飛んだ晩は、\n殻が、ほんのり温かかったんだ。'] : ['殻の中の酒場へ、ようこそ。', 'この殻は、百年前にかえった\n火の鳥の卵の殻さ。', '奥の隅で水ばかり飲んでる闘士、\n「記録院付き」の名札だ。\n……今年は、妙なのが混じってる。']);
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lead:l_ash_stranger'] } });
  E('caldera_zakuro', async (ev) => {
    await ev.say('zakuro_tav', ['……何だ。', 'ザクロだ。雇われの闘士だよ。\n決勝で会うかもな。', '酒は飲まねえ。\n仕事の前は、水だけだ。']);
    ev.lead('l_ash_stranger');
  }, { meta: { needs: [], gives: ['lead:l_ash_stranger'] } });
  E('caldera_tav_fighter', async (ev) => {
    await ev.say('tav_fighter', ['二回戦の獣使いのガロは、\n口笛で獣を突っこませる。', '口笛が鳴ったら、身を固めな。\nガロ本人を倒せば、獣は座る。']);
  });
  E('caldera_tav_bookie', async (ev) => { await ev.say('tav_bookie', '賭けなら闘技場の受付の横だ。\n今夜も一口どうだい。'); ev.lead('q_ash_bet'); }, { meta: { needs: [], gives: ['lead:q_ash_bet'] } });

  // ---------------------------------------------------------------- 町の人（近況・ほのめかし）・温泉の番
  E('caldera_gate_w', async (ev) => {
    await ev.say('guard_w', cleared(ev) ? ['火の鳥が飛んでから、\n荒野の赤が戻ってきた。'] : ['西の門の先は、灰の荒野だ。\n峠を越えれば、砂漠のカシム。', '火口に入れるのは、炎の試練の\n勝者だけだ。受付は町の底の\n闘技場だよ。']);
    ev.lead('l_ash_trial');
  }, { meta: { needs: [], gives: ['lead:l_ash_trial'] } });
  E('caldera_gate_e', async (ev) => {
    await ev.say('guard_e', champ(ev) ? ['東の火山の岩戸は、族長が開けた。', '番犬には気をつけな。\n二つの頭が息を吸ったら、\n身を固めることだ。'] : ['東の門の先は、灰の火山と\n潮見橋だ。北の橋を渡れば、\n湿原に出る。', '火山の岩戸は、試練の勝者の\nためにしか開かん。']);
    if (champ(ev)) ev.lead('l_ash_volcano');
  }, { meta: { needs: [], gives: [] } });
  E('caldera_oldman', async (ev) => {
    await ev.say('oldman', cleared(ev) ? ['火の鳥が朝日の中を飛ぶ、と\n昔は言ったもんだ。', '……朝日、か。なんだったかな。'] : ['族長の話を聞いたかね。\n二十年前の、最後の代理試合の。', '族長は、あの夜のことを\n誰にでも話すわけじゃない。\n……家を訪ねてみなされ。']);
  });
  E('caldera_woman', async (ev) => {
    await ev.say('woman', cleared(ev) ? '溶岩の堀が、明るくなったわ。\n段々の灯りも、あったかい色。' : ['「火の鳥が太陽を背負って\n空を渡る」――って、\nこの町の古い言い草よ。', '太陽って、火の鳥の\nことだったのかしらね。']);
  });
  E('caldera_child', async (ev) => { await ev.say('child', X().skyLine() || (champ(ev) ? 'ザクロを倒したんだって？\nすっげえ！' : 'おっきくなったら、ぼくも\n炎の試練に出るんだ！')); });
  E('caldera_spa', async (ev) => {
    if (ev.flag('ash_spa_done')) {
      const i = await ev.choose(['湯につかる', 'やめる'], { text: '湯けむりの立つ温泉だ。' });
      if (i !== 0) return;
      await ev.fade('out', 500);
      ev.rest();
      await ev.fade('in', 500);
      await ev.caption('体の芯まで温まった。\n（HP・MP が回復した）', { ms: 1800 });
      return;
    }
    await ev.say(null, ['灰が積もって、湯が\n黒くにごっている。', 'とても入れそうにない。']);
  });
  E('caldera_spa_keeper', async (ev) => {
    if (ev.flag('ash_spa_done')) { await ev.say('spa_keeper', '湯が澄んだよ。\nいつでも入っておいき。\nお代はいらないよ。'); return; }
    if (ev.has('k_spa_salt')) {
      ev.take('k_spa_salt', 1);
      ev.setFlag('ash_spa_done');
      ev.leadDone('q_ash_spa');
      ev.sfx('heal');
      await ev.say('spa_keeper', ['湯の花だね！\nどれ、湯にまいてみよう。', '……ほうら、澄んできた。\nこれで、町の湯も元どおりさ。', 'いつでも入っておいき。\nお代はいらないよ。']);
      return;
    }
    await ev.say('spa_keeper', ['湯守りのばあさまだよ。\n町の湯が、灰でにごっちまった。', '荒野の北の、湯の郷の\n岩の割れ目で採れる湯の花が\nあれば、澄むんだがねえ。']);
    ev.setFlag('q_ash_spa_on');
    ev.lead('q_ash_spa');
    ev.lead('l_opt_spa');
  }, { meta: { needs: [], gives: ['flag:q_ash_spa_on', 'lead:q_ash_spa', 'lead:l_opt_spa', 'flag:ash_spa_done'] } });
  E('caldera_board', async (ev) => {
    const lines = [];
    lines.push(cleared(ev) ? '「祝・火の鳥の巡り。\n今宵、段々の灯籠をともす。\n――族長ドルガ」' : '「炎の試練、開催中。\n受付は闘技場にて。\nよそ者の出場も認む」');
    lines.push(ev.flag('ash_spa_done') ? '「町の湯、澄む。湯守り」' : '「町の湯、灰のため休み。\n湯の花を持つ方は湯守りまで」');
    if (X().tier() >= 2) lines.push('「北の潮見橋、\n風の強い晩は渡るべからず」');
    await ev.say(null, lines);
  });
  E('caldera_house_spear', async (ev) => { await ev.say(null, ['壁に、古い槍が掛かっている。\n穂先に、火の鳥の紋。', '「代理試合の年に、\n夫が最後に持った槍」\nと、札が下がっていた。']); });
  E('caldera_widow', async (ev) => {
    if (!ev.flag('ash_widow_gift')) {
      ev.setFlag('ash_widow_gift');
      await ev.say('widow', ['うちの人も、昔は闘士でね。\n代理試合の年に、砂の上で\n槍を置いてきたよ。', 'あんた、大会に出るのかい。\nこれ、持っておいき。\nやけどの薬さ。']);
      X().small(ev, [['i_salve', 3], ['i_potion', 2], ['i_potion', 3], ['i_panacea', 1], ['i_panacea', 2]]);
      return;
    }
    await ev.say('widow', cleared(ev) ? '火の鳥が飛んだ晩、うちの人の\n槍が、かたかた鳴ったよ。' : '無理だけは、おしでないよ。');
  });
  E('caldera_house_kid', async (ev) => { await ev.say('house_kid', ['じいちゃんの槍、\nさわっちゃだめなんだ。', 'でも、火の鳥の紋は\nかっこいいんだ！']); });
})(window.RPG);
