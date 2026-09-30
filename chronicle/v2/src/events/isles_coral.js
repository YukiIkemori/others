// CONTENT（マレア諸島）: 港町コーラルの人と物（WORLD_REDESIGN §4.5・§5.8、STORY_BIBLE §7.5・§8.6）。
//   着く（港に出られない船・腕を組むドレイク）→ 手がかり 3 つ（港の親方「港が閉じた」・ドレイク「乗り手のいない船」・酒場の老水夫「岬の村の歌」）
//   → 潮鳴りの洞窟の光る貝がら → ドレイクが船首に付ける（外洋船 isles_ship）→ 港の親方の海図（空白 4 つ）→ 島々（isles_sea.js）。
//   依頼: 旗信号の見習い試験（組合の旗手）・組合の配達（組合長）・光る貝がら集め（貝がら好きの子）。後家の壁（lo_war_isles）。
//   定期船: T 字の桟橋の先からファロスへ戻る（行きはファロスの桟橋。maps/field_isles_00_kit.js）。
//   話す見返り（E19）: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況。仲間の名前は出さない（A36）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Isles.ev;
  const cleared = (ev) => ev.flag('cleared_r_isles');
  const DRAKE = { name: 'ドレイク' };

  // ---------------------------------------------------------------- 町に入る
  E('coral_arrival', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('isles_arrived_after')) { ev.setFlag('isles_arrived_after'); await ev.caption('港に、帆を張った船が出入りしている。\n霧の晩でも、舟歌が聞こえる。', { ms: 2600 }); }
      return;
    }
    if (ev.flag('isles_arrived')) return;
    ev.setFlag('isles_arrived');
    await ev.caption('港町コーラル。白い家が、崖に\n段々に重なっている。', { ms: 2600 });
    await ev.caption('けれど港には、出られない船が\n帆をたたんだまま並んでいた。', { ms: 2600 });
  }, { meta: { needs: [], gives: ['flag:isles_arrived'] } });

  // ---------------------------------------------------------------- 造船所の親方ドレイク（岸壁。外洋船）
  E('coral_drake', async (ev) => {
    if (cleared(ev)) {
      const t = X().tier();
      await ev.say('drake', t >= 5 ? '記録院の書記が、舟歌を書いた本を\n持っていこうとしやがった。\n渡すもんか。歌は、歌ってこそだ。'
        : '霧の晩でも、船が出せるようになった。\n舟歌を歌えば、互いの船の場所が\n分かる。……あんたのおかげだ。', DRAKE);
      return;
    }
    if (ev.flag('isles_ship')) {
      await ev.say('drake', '船の調子はどうだ。\n海図の空白を埋めていけば、\n幽霊船の出る海が絞れるはずだ。', DRAKE);
      return;
    }
    if (ev.has('k_glow_shell')) { await ev.call('isles_ship_launch'); return; }
    if (!ev.flag('isles_drake_met')) {
      ev.setFlag('isles_drake_met');
      await ev.say(null, '日に焼けた大男が、造船所の中の\n船を見上げたまま、腕を組んでいる。');
      await ev.say('drake', '……ああ、仕上がってるさ。\n外洋を渡れる、いい船だ。\n乗り手がいないだけでな。', DRAKE);
      await ev.say('drake', 'この島じゃ、新しい船の船首には\n潮鳴りの洞窟の「光る貝がら」を\n付ける習わしがある。\f霧の中でも帆が迷わねえように、\nってな。だが、洞窟の奥には\n大ダコが住みついちまった。', DRAKE);
      await ev.say('drake', '貝がらを取ってこられるなら、\nこの船、あんたに預けてもいい。\n……港で腐らせるよりはましだ。', DRAKE);
      ev.lead('l_isles_ship');
      ev.lead('l_isles_shell');
      return;
    }
    await ev.say('drake', '潮鳴りの洞窟は、北の白崖の道の先、\n夜光虫の入り江の奥だ。\f中は潮が満ち引きしてる。\n潮の石を叩けば、潮が変わるって\n昔の漁師は言ってたな。', DRAKE);
  }, { meta: { needs: [], gives: ['flag:isles_drake_met', 'lead:l_isles_ship', 'lead:l_isles_shell'], calls: ['isles_ship_launch'] } });
  // 光る貝がらを船首に → 外洋船（ここからは島々へ船で渡れる。isles_sea.js の舵）
  E('isles_ship_launch', async (ev) => {
    if (ev.flag('isles_ship')) return;
    await ev.say('drake', '……そいつは、光る貝がらか！\n本当に、取ってきやがった。', DRAKE);
    ev.take('k_glow_shell', 1);
    await ev.fade('out', 500);
    ev.sfx('ship');
    await ev.caption('ドレイクは、船首に貝がらを打ちつけ、\n船を海へ下ろした。', { ms: 2600 });
    ev.setFlag('isles_ship');
    await ev.fade('in', 500);
    await ev.say('drake', '船は真ん中の桟橋につないである。\n舵のところで、行き先を選びな。\f港の親方が、幽霊船の海の海図を\n持ってる。見せてもらうといい。', DRAKE);
    ev.leadDone('l_isles_ship');
    ev.lead('l_isles_chart');
  }, { meta: { needs: ['flag:isles_shell'], gives: ['flag:isles_ship', 'lead:l_isles_chart'] } });

  // ---------------------------------------------------------------- 港の親方（上の段の家。港が閉じた・海図）
  E('coral_harbormaster', async (ev) => {
    if (cleared(ev)) {
      await ev.say('harbormaster', '港を開けたよ。定期船のほかに、\n漁の船も商いの船も出ている。\n海図の空白も、もう無い。');
      return;
    }
    if (ev.flag('isles_ship') && !ev.flag('isles_chart_got')) { await ev.call('coral_harbormaster_chart'); return; }
    if (ev.flag('isles_chart_got')) {
      const n = X().charted(ev);
      await ev.say('harbormaster', n >= 3 ? '空白が三つ埋まったか。\n残るまん中の海が、幽霊船の海だ。\f霧を呼ぶには……ネレイの\nマリナさんの舟歌だろうな。'
        : '空白はあと ' + (4 - n) + ' つ。灯台島、人魚の歌う岩、\n財宝ヤドカリの島、座礁した商船。\n近くへ船を寄せれば埋まる。');
      return;
    }
    await ev.say('harbormaster', '霧の晩になると、青い鬼火の\n幽霊船が出るんだ。あれについて\n行った船は、みんな岩礁で座礁した。');
    await ev.say('harbormaster', 'だから港は閉じた。定期船のほかは\n船を出させない。……わしの一存でな。\f船の墓場を、これ以上\n増やすわけにはいかん。');
    ev.lead('l_isles_harbor');
  }, { meta: { needs: [], gives: ['lead:l_isles_harbor'], calls: ['coral_harbormaster_chart'] } });
  E('coral_harbormaster_chart', async (ev) => {
    if (ev.flag('isles_chart_got')) return;
    ev.setFlag('isles_chart_got');
    await ev.say('harbormaster', 'ドレイクの船に乗るのは、あんたか。\n……なら、こいつを持っていけ。');
    ev.item('k_sea_chart', 1);
    await ev.say('harbormaster', '幽霊船の出る海のまわりに、\n空白が四つある。霧で、誰も\n近くまで行けなかった所だ。\f船で近くへ寄れば、空白は埋まる。\n三つ埋まれば、残りのまん中が\n幽霊船の海だ。');
    ev.lead('l_isles_chart');
    // 空白を先に（海図より前に）見てきた所は、ここで書きこむ
    const n = X().charted(ev);
    if (n > 0) {
      await ev.say('harbormaster', 'なんだ、もう ' + n + ' つも見てきたのか。\nどれ、書きこんでおこう。');
      if (n >= 3 && !ev.flag('isles_fog_found')) {
        ev.setFlag('isles_fog_found');
        ev.leadDone('l_isles_chart');
        ev.lead('l_isles_fog');
        await ev.say('harbormaster', '……まん中の潮の目だ。\n幽霊船が出るのは、きっとここだ。');
      }
    }
  }, { meta: { needs: ['flag:isles_ship'], gives: ['flag:isles_chart_got', 'item:k_sea_chart', 'lead:l_isles_chart'] } });
  E('coral_harbormaster_chart_table', async (ev) => {
    await ev.say(null, '古い海図が広げてある。島々のまわりに、\n座礁した船の印が、たくさん\n赤い墨で書きこまれている。');
  });
  E('coral_hm_wife', async (ev) => {
    const s = X().skyLine();
    await ev.say('hm_wife', s || '主人は、港を閉じてから\nよく眠れないのよ。\n船乗りに恨まれても、ってね。');
  });

  // ---------------------------------------------------------------- 酒場（老水夫「岬の村の歌」・亭主・水夫・商船の船長）
  E('coral_old_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('old_sailor', '♪　霧の海でも、迷いはしない……。\nへへ、また歌えるようになったよ。'); return; }
    await ev.say('old_sailor', 'あの青い鬼火はな、昔この海の船を\n導いた「帰らずの灯」の、\nなれの果てよ。');
    await ev.say('old_sailor', '六十年前、朝日の中を出ていって、\n帰らなかったグレン船長の船の灯だ。\f霧の晩に沖を渡る橙の灯は、\nわしらの目印だった。舟歌を歌えば\n灯が答えてくれたもんさ。');
    await ev.say('old_sailor', '去年、記録院の若いのに舟歌を\n歌ってやったんだ。そのあとからよ、\n誰も続きを歌えなくなったのは。\f岬の村ネレイのマリナばあさんは、\nグレン船長の許嫁だった人だ。\nあの人なら、覚えてるかもしれねえ。');
    ev.lead('l_isles_song');
  }, { meta: { needs: [], gives: ['lead:l_isles_song'] } });
  E('coral_barkeep', async (ev) => {
    const s = X().skyLine();
    if (s) { await ev.say('barkeep', s); return; }
    await ev.say('barkeep', '船が出ねえから、水夫たちは\n昼から飲んでばかりだ。\n酒場としちゃ、ありがたいがね。');
  });
  E('coral_tav_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('tav_sailor', '明日は漁だ！　ひさしぶりに\n網が濡れるぜ。'); return; }
    await ev.say('tav_sailor', '深みの大ダコはな、水面が渦を\n巻いたら大渦が来る合図だ。\n身を固めて、やりすごすのさ。');
  }, { meta: { needs: [], gives: [] } });
  // 座礁した商船の船長（選んだ後、酒場に来る）
  E('coral_merchant', async (ev) => {
    const w = ev.choiceOf('ch_isles_wreck');
    if (w === 'help') {
      if (!ev.flag('isles_tmap_given')) {
        ev.setFlag('isles_tmap_given');
        await ev.say('merchant', 'あんたか！　船員はみんな\n無事だった。礼をさせてくれ。');
        await ev.say('merchant', '昔、沈んだ礼拝堂の近くで\n手に入れた古い地図だ。\n羽ペンの紋が描いてある。');
        ev.item('k_tmap_4', 1);
        return;
      }
      await ev.say('merchant', 'あんたのことは、港じゅうに\n話しておいた。組合の売り台も、\nいい品を出すはずさ。');
      return;
    }
    await ev.say('merchant', '……あんたか。積荷は役に\n立ったかね。船員は、自分で\n浜まで泳いださ。まあ、いいがね。');
  }, { meta: { needs: ['flag:isles_wreck_done'], gives: ['item:k_tmap_4'] } });

  // ---------------------------------------------------------------- 宿・店
  E('coral_inn_keeper', async (ev) => {
    await ev.say('inn_keeper', cleared(ev) ? 'いらっしゃいませ。\n港が開いて、泊まりのお客さんも\n増えましたよ。' : 'いらっしゃいませ。\n船が出ないもので、部屋は\nいくらでも空いてますよ。');
    const i = await ev.choose(['泊まる', 'やめる'], { text: '泊まっていきますか？' });
    if (i !== 0) return;
    await ev.inn();
  });
  E('coral_inn_guest', async (ev) => {
    await ev.say('inn_guest', '東の小島で、宝箱が歩いてたって\n子どもが言うのよ。貝がらの山が\n光ってたとも。\f外洋の南じゃ、新月の晩に\n星の形の潮吹きが出るとか。\n……海には、何でもいるわね。');
    ev.lead('l_opt_crab');
  }, { meta: { needs: [], gives: ['lead:l_opt_crab'] } });
  E('coral_item_keeper', async (ev) => {
    await ev.say('item_keeper', 'いらっしゃいませ！\n何をお求めですか？');
    await ev.shop('shop_coral_items');
  });
  E('coral_smith', async (ev) => {
    await ev.say('smith', 'いらっしゃい。潮風に強い\n品を置いてるよ。');
    await ev.shop('shop_coral_arms');
  });

  // ---------------------------------------------------------------- 船乗り組合（組合長・旗手・売り台）
  E('coral_guild_master', async (ev) => {
    if (ev.flag('isles_delivery_done')) {
      await ev.say('guild_master', '配達、ご苦労だった。\n売り台も見ていってくれ。');
      await ev.shop('shop_coral_guild');
      return;
    }
    if (ev.has('k_guild_parcel')) {
      await ev.say('guild_master', 'ネレイの雑貨屋へ届けてくれ。\n陸を歩いても、船で行ってもいい。');
      await ev.shop('shop_coral_guild');
      return;
    }
    if (!ev.flag('isles_delivery_on')) {
      await ev.say('guild_master', '船乗り組合だ。港が閉じてから、\n島から島への荷が止まっていてな。\f一つ、頼まれてくれないか。\nネレイの雑貨屋あての荷だ。');
      const i = await ev.choose(['引き受ける', 'やめる'], { text: '荷を届けますか？' });
      if (i === 0) {
        ev.setFlag('isles_delivery_on');
        ev.item('k_guild_parcel', 1);
        ev.lead('q_isles_delivery');
        await ev.say('guild_master', '頼んだぞ。礼は、向こうの\n雑貨屋が払ってくれる。');
        return;
      }
    }
    await ev.shop('shop_coral_guild');
  }, { meta: { needs: [], gives: ['lead:q_isles_delivery', 'item:k_guild_parcel'] } });
  // 旗信号の見習い試験（mini.sequence。3 段。段ごとに品。3 段目で信号旗の襟巻き）
  const FLAG_STAGES = [
    { label: '初段（旗 3 枚）', rounds: 2, tempo: 640, reward: ['i_potion', 2] },
    { label: '二段（旗 4 枚）', rounds: 3, tempo: 560, reward: ['i_ether', 2] },
    { label: '三段（旗 5 枚）', rounds: 4, tempo: 480, reward: ['u_flag_scarf', 1] },
  ];
  const RANK_OK = { S: true, A: true, B: true };
  E('coral_flags', async (ev) => {
    if (!ev.flag('isles_flags_met')) {
      ev.setFlag('isles_flags_met');
      await ev.say('flag_officer', '見習いの試験を受けに来たのか？\n港に入る船の旗の並びを覚えて、\n同じ順に揚げるんだ。');
      ev.lead('q_isles_flags');
    }
    const next = FLAG_STAGES.findIndex((s, i) => !ev.flag('isles_flags_' + (i + 1)));
    const labels = FLAG_STAGES.map((s, i) => s.label + (ev.flag('isles_flags_' + (i + 1)) ? '（合格）' : ''));
    const i = await ev.choose(labels.concat(['やめる']), { cancel: FLAG_STAGES.length, text: next < 0 ? 'どの段を受け直す？' : 'どの段を受ける？' });
    if (i >= FLAG_STAGES.length) return;
    if (i > 0 && !ev.flag('isles_flags_' + i)) { await ev.say('flag_officer', 'まずは下の段からだ。'); return; }
    const st = FLAG_STAGES[i];
    const r = (await ev.mini.sequence({ title: '旗信号　' + st.label, symbols: ['赤', '白', '青', '黄', '黒'].slice(0, 3 + i), rounds: st.rounds, tempo: st.tempo, theme: 'harbor' })) || {};
    if (!RANK_OK[r.rank]) { await ev.say('flag_officer', '旗の順が違う。港の船が\n迷っちまうぞ。もう一度だ。'); return; }
    const key = 'isles_flags_' + (i + 1);
    if (ev.flag(key)) { await ev.say('flag_officer', 'いい手さばきだ。'); return; }
    ev.setFlag(key);
    await ev.say('flag_officer', st.label + '、合格だ！');
    ev.item(st.reward[0], st.reward[1]);
    if (i === 2) {
      ev.setFlag('isles_flags_done');
      ev.leadDone('q_isles_flags');
      await ev.say('flag_officer', 'これで一人前の旗手だ。\nその襟巻きを巻いていれば、\nどの港でも顔が利くぞ。');
    }
  }, { meta: { needs: [], gives: ['lead:q_isles_flags', 'flag:isles_flags_1', 'flag:isles_flags_2', 'flag:isles_flags_3', 'flag:isles_flags_done', 'item:u_flag_scarf'] } });
  E('coral_guild_board', async (ev) => {
    await ev.say(null, cleared(ev) ? '組合の掲示板。「定期船　毎日」\n「ネレイ行きの荷、受けつけます」'
      : '組合の掲示板。「霧の晩の出航を禁ず」\n「幽霊船を見た者は、港の親方へ」');
  });

  // ---------------------------------------------------------------- 後家の壁（lo_war_isles）と、そのそばの人
  E('coral_widows_wall', async (ev) => {
    const x = X();
    if (ev.flag('isles_wall_names')) {
      await ev.say(null, '後家の壁に、新しい名が刻まれている。\n六十年前の船員たちの名だ。\nそばに、真新しいリボンが結んである。');
      return;
    }
    await ev.say(null, '擁壁に、帰らなかった水夫の名が\n並んで刻まれている。名の横には、\n色のあせたリボン。');
    await x.lore(ev, 'lo_war_isles');
    await ev.say(null, '港の底に、沈んだ軍船の帆柱が\n二本見える。どの戦で沈んだのかは、\nどこにも刻まれていない。');
  }, { meta: { needs: [], gives: ['lore:lo_war_isles'] } });
  E('coral_widow', async (ev) => {
    if (ev.flag('isles_wall_names')) { await ev.say('widow', 'グレン船長の船の人たちの名を、\n壁に刻んでもらったのよ。\n……やっと、そろったわね。'); return; }
    await ev.say('widow', 'うちの人の名も、あの壁にあるの。\n二十年前の戦で沈んだって。\f何のための戦だったか、\n誰に聞いても、分からないのよ。\n「太陽は東の海から来る船」……\nそれを証すためだったって、それだけ。');
  }, { meta: { needs: [], gives: [] } });

  // ---------------------------------------------------------------- 町の人（見返り: 近況・ほのめかし・ボスの癖・うわさ）
  E('coral_gate_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('gate_sailor', '北の橋から、ネレイまでは\n白崖の道をまっすぐだ。\n今は霧も出ねえ。'); return; }
    await ev.say('gate_sailor', '北の橋を渡ると、白崖の道だ。\n夜光虫の入り江を越えて、\n岬の道を行けばネレイに着く。');
  });
  E('coral_child', async (ev) => {
    await ev.say('child', cleared(ev) ? 'ねえ、灯台島の灯、見た？\n夜になると、橙に光るんだよ！' : '幽霊船の鬼火、青いんだよ。\n母さんは、見ちゃだめって。\n……でも、ちょっと見たいな。');
  });
  E('coral_idle_sailor', async (ev) => {
    if (cleared(ev)) { await ev.say('idle_sailor', '船が出せるってのは、いいもんだ。'); return; }
    await ev.say('idle_sailor', '船は出せねえ、網は乾く。\n……霧さえ出なけりゃな。\f亡霊船長ってのは、半分まで\n削ると怒り出すそうだ。\n大砲に火縄を回したら、身を固めろ。');
  }, { meta: { needs: [], gives: [] } });
  E('coral_lookout', async (ev) => {
    await ev.say(null, '見晴らし台の石の看板。\n「北　人魚の歌う岩」\n「東　財宝ヤドカリの島」\f「南　座礁した商船」\n「南西　灯台島」\n「東の岬　ネレイ」');
  });
  E('coral_house1_widow', async (ev) => {
    await ev.say('house1_widow', ev.flag('isles_wall_names') ? '壁の名が増えたって聞いたよ。\n六十年、名のなかった人たちさ。'
      : '海で死んだ人の名は、壁に刻む。\n名が残れば、帰ってこられるって\nこの島じゃ言うんだよ。');
  });
  E('coral_house1_kid', async (ev) => {
    await ev.say('house1_kid', '朝日って、ほんとにあったの？\nばあちゃんは、見たことあるって。');
  });
  E('coral_sailor_wife', async (ev) => {
    await ev.say('sailor_wife', '霧の晩は、戸を閉めて\n灯を消すの。鬼火に呼ばれないように。\n……昔は、逆だったのにね。');
  });
  E('coral_fisher', async (ev) => {
    await ev.say('fisher', '北に、風が吹くと歌う岩がある。\nあれは古い舟歌の節だって、\nネレイの漁師は言うんだ。');
    ev.lead('l_opt_siren');
  }, { meta: { needs: [], gives: ['lead:l_opt_siren'] } });

  // ---------------------------------------------------------------- 光る貝がら集め（12 種。町の浜・入り江の洞・潮鳴りの洞窟の中）
  E('coral_shell_kid', async (ev) => {
    const n = ev.var('isles_shells');
    if (ev.flag('isles_shells_done')) { await ev.say('shell_kid', '貝がらのお守り、光ってる？\n夜道で、足もとが明るいでしょ。'); return; }
    if (!ev.flag('isles_shells_on')) {
      ev.setFlag('isles_shells_on');
      await ev.say('shell_kid', '夜光虫で光る貝がら、集めてるの。\nぜんぶで12種あるんだって。\f町の浜とか、入り江の小さな洞とか、\n潮鳴りの洞窟の中にあるよ。\nぜんぶそろったら、見せて！');
      ev.lead('q_isles_shells');
      return;
    }
    if (n >= 12) {
      ev.setFlag('isles_shells_done');
      ev.leadDone('q_isles_shells');
      await ev.say('shell_kid', 'わあ、12種そろってる！\n糸でつないで、お守りにしてあげる。');
      ev.item('u_shell_charm', 1);
      return;
    }
    await ev.say('shell_kid', 'いま ' + n + ' 種だね。\nあと ' + (12 - n) + ' 種！');
  }, { meta: { needs: [], gives: ['lead:q_isles_shells', 'flag:isles_shells_done', 'item:u_shell_charm'] } });
  E('isles_shell', async (ev, ctx) => {
    const m = R.DB.maps[ctx && ctx.map] || (R.Field && R.Field.pos && R.DB.maps[R.Field.pos.map]);
    const o = m && ctx && (m.objects || []).find((q) => q.type === 'examine' && q.event === 'isles_shell' && q.x === ctx.x && q.y === ctx.y);
    const key = 'isles_shell_' + ((o && o.shell) || 0);
    if (ev.flag(key)) { await ev.say(null, '砂の上で、夜光虫が小さく光っている。'); return; }
    ev.setFlag(key);
    const n = ev.addVar('isles_shells', 1);
    ev.sfx('item');
    await ev.say(null, '青く光る貝がらを拾った。（' + n + '/12）');
  });

  // ---------------------------------------------------------------- 桟橋（外洋船がまだ無いとき・定期船）
  E('isles_pier_empty', async (ev) => {
    await ev.say(null, 'ここは船をつなぐ桟橋だ。\n今は、何もつながれていない。');
  });
  E('coral_ferry_hand', async (ev) => {
    await ev.say('ferry_hand', cleared(ev) ? 'ファロス行きの定期船だ。\n霧が晴れて、揺れも少ないよ。' : 'ファロス行きの定期船だ。\n霧の晩でも、この船だけは出す。\n灯台の灯を頼りにな。');
  });
  E('isles_ferry_hand', async (ev) => {
    await ev.say('ferry_hand', '南東のマレア諸島へ渡る定期船だ。\n向こうじゃ、青い鬼火の幽霊船が\n出るってんで、港が閉じてるそうだ。');
    ev.lead('l_rumor_isles');
  }, { meta: { needs: [], gives: ['lead:l_rumor_isles'] } });
  E('isles_ferry_closed', async (ev) => {
    await ev.say(null, '定期船の桟橋。\n「しばらく欠航いたします。」');
  });
})(window.RPG);
