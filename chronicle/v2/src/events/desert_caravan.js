// CONTENT（砂漠）: 隊商の護衛の旅（WORLD_REDESIGN §4.2 の流れ 1・2、STORY_BIBLE §7.2 の主な場面 1・2）。
//   desert_caravan_depart  ザイードの隊が一行の後ろにつく（ついてくる人 E8 = ev.guest('npc_zaid')）。旗 desert_caravan_on
//   desert_ambush_1〜3     隊が襲われる（ワールドの道の上、1 度ずつ。勝てば隊は無事）
//   desert_camp1_scene     野営地「岩の井戸」: 星の歌 1 → 砂の鷹団が水を奪いに来る。選択 ch_desert_hawk（fight|water|pay）
//   desert_camp2_scene     野営地「星の石」: 星の歌 2 → 砂嵐。選択 ch_desert_route（short|long）。水を分けたならのどの渇き（MP が減る）
//   desert_camp3_scene     王墓のオアシス: 星の歌 3・「夜明け」の言葉 → 隊はここで待つ（desert_camp3_done、この先は一行だけ）
//   仲間の名前は出さない（A36）。ボイスは使わない。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const ZAID = { name: 'ザイード' };
  const RASHID = { name: 'ラシード' };

  // ---------------------------------------------------------------- 出発
  E('desert_caravan_depart', async (ev) => {
    if (ev.flag('desert_caravan_on') || ev.flag('desert_camp3_done')) return;
    await ev.fade('out', 400);
    ev.setFlag('desert_caravan_on');
    ev.lead('l_desert_caravan');
    ev.guest('npc_zaid');
    await ev.warp('world', 'kasim');
    await ev.fade('in', 400);
    ev.bgm('caravan', { fade: 600 });
    await ev.caption('荷車が一台、ラクダが二頭。\nザイードの隊が、一行の後ろに\nついて歩きだした。', { ms: 2600 });
    await ev.say('npc_zaid', ['最初の野営地は「岩の井戸」。\n西の門から道なりに南だ。', '隊と一緒のあいだは、\n魔物も寄ってきやすい。\n……頼りにしてるぞ。'], ZAID);
  }, { meta: { needs: ['flag:desert_zaid_met'], gives: ['flag:desert_caravan_on', 'lead:l_desert_caravan'], warp: { to: 'world', spawn: 'kasim' } } });

  // ---------------------------------------------------------------- 隊が襲われる（3 回）
  const AMBUSH = {
    1: { troop: 'tr_desert_ambush', text: '荷車の下の砂が、ざわりと動いた！\n砂さそりが、荷に食らいつく！' },
    2: { troop: 'tr_desert_ambush2', text: 'ラクダが悲鳴をあげて立ち止まった。\n砂の中から、何かが来る！' },
    3: { troop: 'tr_desert_ambush3', text: '星明かりの下、砂の上を\nいくつもの影がはってくる。\n隊を囲むつもりだ！' },
  };
  for (const n of [1, 2, 3]) {
    E('desert_ambush_' + n, async (ev) => {
      if (!ev.flag('desert_caravan_on') || ev.flag('desert_ambush_' + n + '_done')) return;
      ev.sfx('roar');
      await ev.say(null, AMBUSH[n].text);
      await ev.say('npc_zaid', n === 1 ? '荷を守れ！　水がめだけは\n割らせるな！' : n === 2 ? 'ラクダを下げろ！\n……頼む、前に出てくれ！' : '囲まれる前に、\n切りひらけ！', ZAID);
      const r = await ev.battle(AMBUSH[n].troop);
      if (r !== 'win') return;
      ev.setFlag('desert_ambush_' + n + '_done');
      await ev.say('npc_zaid', ['……助かった。荷も水も無事だ。', n === 3 ? 'オアシスは、もうすぐだ。' : 'さあ、野営地まで\nもうひと息だ。'], ZAID);
    }, { meta: { needs: ['flag:desert_caravan_on'], gives: ['flag:desert_ambush_' + n + '_done'] } });
  }

  // ---------------------------------------------------------------- たき火の歌（野営地ごとに 1 つ）
  async function starSong(ev, i) {
    ev.sfx('fire');
    await ev.caption(['たき火がはぜる。\nザイードが、星を見上げて歌いだした。', 'たき火のまわりに、隊の者が\n輪になって座った。ザイードが歌う。', 'オアシスの泉のほとりで、\n三晩目のたき火。ザイードが歌う。'][i], { ms: 2200 });
    ev.sfx('bell');
    await ev.caption(X().STARS[i], { ms: 3600 });
  }

  // ---------------------------------------------------------------- 野営地 1「岩の井戸」: 砂の鷹団
  E('desert_camp1_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || ev.flag('desert_camp1_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp1_seen')) {
        ev.setFlag('desert_camp1_seen');
        await ev.caption('岩に囲まれた古い井戸。\nたき火の跡が、いくつも残っている。', { ms: 2200 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp1', 'fire');
    await ev.fade('in', 400);
    await starSong(ev, 0);
    await ev.say('npc_zaid', ['北のくぎ星は、いつも同じ所にある。\nあれさえ見えれば、隊は迷わん。', '……もっとも、昔の隊は\n「日の沈む方」で道を読んだらしい。\n日とは何だったのやら。'], ZAID);
    // 砂の鷹団
    ev.sfx('whistle');
    await ev.caption('火が落ちたころ――\n岩の上で、鷹の笛が鳴った。', { ms: 2200 });
    ev.bgm('tension', { fade: 400 });
    await ev.say(null, '顔を布で覆った男たちが、\n岩の上から弓を向けている。');
    await ev.say('npc_rashid', ['動くな。命まではもらわん。', 'おれたちは「砂の鷹」。\n欲しいのは水だ。水がめを\n半分置いていけ。'], RASHID);
    await ev.say('npc_zaid', '……半分だと？　それでは\nオアシスまで持たん！', ZAID);
    const price = X().gold(160);
    const i = await ev.choose(['戦う', '水を分ける', `お金を払う（${price} G）`], { text: '砂の鷹団にどうする？' });
    if (i === 0) {
      ev.choice('ch_desert_hawk', 'fight');
      await ev.say('npc_rashid', '……そうか。なら、砂に聞け。', RASHID);
      const r = await ev.battle('tr_b_hawkchief', { boss: true });
      ev.mapBgm();
      if (r !== 'win') { ev.choice('ch_desert_hawk', undefined); return; }
      await ev.say(null, '覆面の男は膝をつき、\n曲刀を砂に突き立てた。');
      await ev.say('npc_rashid', ['……いい腕だ。おれはラシード。\n昔は、日輪同盟の兵だった。', '二十年前の代理試合の夜……\n歌が聞こえた。敵も味方も、\n手を止めた。', '……そのあとのことは、\nなぜか思い出せん。気づけば、\n砂の上で盗賊をしていた。', '行け。おれたちは台地の洞へ帰る。\n……次は、こうはいかんぞ。'], RASHID);
    } else if (i === 1) {
      ev.choice('ch_desert_hawk', 'water');
      ev.setFlag('desert_thirst');
      await ev.say('npc_zaid', '……わかった。命には代えられん。\n半分、持っていけ。', ZAID);
      await ev.say('npc_rashid', ['……すまん。洞には、\n子どもも年寄りもいるんだ。', '火に当たらせてもらっていいか。\n少し、話をしたい気分だ。'], RASHID);
      await ev.say(null, '覆面の男は、ラシードと名乗った。\nたき火のそばに腰を下ろす。');
    } else {
      if (ev.gold(0) < price) {
        await ev.say(null, 'お金が足りない……。');
        ev.choice('ch_desert_hawk', 'water');
        ev.setFlag('desert_thirst');
        await ev.say('npc_zaid', '……しかたない。水を半分、\n渡してやれ。', ZAID);
        await ev.say('npc_rashid', '……すまんな。洞には、\n子どもも年寄りもいるんだ。', RASHID);
      } else {
        ev.gold(-price);
        ev.choice('ch_desert_hawk', 'pay');
        await ev.say('npc_rashid', ['……金か。砂漠じゃ水は買えんが、\n町でなら買える。', '通っていい。おれはラシード。\n台地の洞に来ることがあれば、\n話くらいは聞いてやる。'], RASHID);
      }
    }
    ev.setFlag('desert_hawk_met');
    ev.lead('l_opt_hawknest');
    ev.setFlag('desert_camp1_done');
    ev.mapBgm({ fade: 600 });
    ev.rest();
    await ev.caption('たき火のそばで、短い眠り。\n（一行の体力と魔力が戻った）', { ms: 2000 });
    await ev.say('npc_zaid', ['次は野営地「星の石」だ。\nここから南へ、道なりに。', '……今夜のことは、ギルドの帳面に\nちゃんと書いておくよ。'], ZAID);
  }, {
    meta: {
      needs: ['flag:desert_caravan_on'],
      gives: ['flag:desert_camp1_done', 'flag:desert_hawk_met', 'choice:ch_desert_hawk', 'flag:desert_thirst', 'lead:l_opt_hawknest'],
      warp: { to: 'desert_camp1', spawn: 'fire' },
    },
  });

  // たき火のラシード（戦わなかったとき、野営地 1 に残る）
  E('desert_rashid_fire', async (ev) => {
    const c = X().hawk(ev);
    if (!ev.flag('desert_rashid_talked')) {
      ev.setFlag('desert_rashid_talked');
      await ev.say('rashid_fire', ['……おれたちは、日輪同盟の\n脱走兵の生き残りだ。', '二十年前、代理試合の夜。\n歌が聞こえた。敵も味方も、\n手を止めた。', 'そのあとのことは……\nなぜか、思い出せん。\n何のための戦だったのかも。']);
      await ev.say('rashid_fire', c === 'pay' ? '金は、洞の者の薬に使う。\n……恩に着る、とは言わんぞ。' : '水の礼だ。台地の洞に来たら、\n仲間として迎える。\n……それだけは、約束する。');
      return;
    }
    await ev.say('rashid_fire', 'この井戸も、昔は\n水があふれていたそうだ。\n……泉の火が弱ると、井戸も枯れる。');
  });

  // ---------------------------------------------------------------- 野営地 2「星の石」: 砂嵐と近道
  E('desert_camp2_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || !ev.flag('desert_camp1_done') || ev.flag('desert_camp2_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp2_seen')) {
        ev.setFlag('desert_camp2_seen');
        await ev.caption('星を刻んだ立ち石が、\n砂の上にぽつんと立っている。', { ms: 2200 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp2', 'fire');
    await ev.fade('in', 400);
    if (ev.flag('desert_thirst')) {
      await ev.say(null, ['水がめが軽い。\n隊の者は、ひと口ずつしか\n飲めなかった。', '一行は、のどが渇いている……。\n（魔力が少し減った）']);
      for (const c of (R.Party && R.Party.members ? R.Party.members() : [])) if (c && c.mp > 0) c.mp = Math.floor(c.mp * 0.7);
      ev.setFlag('desert_thirst', false);
      ev.setFlag('desert_thirst_felt');
    }
    await starSong(ev, 1);
    await ev.say('npc_zaid', '七つの泉星は、ひしゃくの形。\n祖母は「夜のしずくをまく星」と\n呼んでいた。', ZAID);
    ev.sfx('wind');
    await ev.caption('北の空が、茶色くにごった。\n風が、砂を巻き上げはじめる。', { ms: 2200 });
    await ev.say('npc_zaid', ['砂嵐だ。……道は二つある。', '北のくぼ地を突っ切る近道。\n嵐のまっただ中だ。魔物も多いが、\n昔の隊の野営跡がある。', 'それとも、西の浜を回る遠回り。\n安全だが、長い。途中に\n古い井戸の小屋がある。'], ZAID);
    const i = await ev.choose(['近道（砂嵐のくぼ地を抜ける）', '遠回り（西の浜を回る）'], { text: 'どちらの道を行く？' });
    if (i === 0) {
      ev.choice('ch_desert_route', 'short');
      await ev.say('npc_zaid', ['よし、くぼ地の南の口の\n砂をどけておく。', '星の石から北へ。くぼ地を抜ければ、\n王墓のオアシスはすぐだ。'], ZAID);
    } else {
      ev.choice('ch_desert_route', 'long');
      await ev.say('npc_zaid', ['慎重だな。……嫌いじゃない。', '星の石から西へ、浜に出たら北へ。\n井戸の小屋で、水を足していこう。'], ZAID);
    }
    ev.setFlag('desert_camp2_done');
    ev.rest();
    await ev.caption('嵐の音を聞きながら、短い眠り。\n（一行の体力と魔力が戻った）', { ms: 2000 });
  }, {
    meta: {
      needs: ['flag:desert_caravan_on', 'flag:desert_camp1_done'],
      gives: ['flag:desert_camp2_done', 'choice:ch_desert_route'],
      warp: { to: 'desert_camp2', spawn: 'fire' },
    },
  });

  // 記録官のくら袋（くべられなかった手紙、STORY_BIBLE §10.3）
  E('desert_camp2_saddlebag', async (ev) => {
    if (ev.flag('desert_saddlebag')) { await ev.say(null, '砂に半分うまった、\n古いくら袋だ。もう何も入っていない。'); return; }
    await ev.say(null, ['砂に半分うまった、古いくら袋だ。\n革に、羽ペンの焼き印がある。', '中に、封をしたままの手紙が\n一通残っていた。']);
    ev.setFlag('desert_saddlebag');
    await X().lz(ev);
  }, { meta: { needs: [], gives: ['flag:desert_saddlebag'] } });

  E('desert_camp2_stone', async (ev) => {
    await ev.say(null, ['星を刻んだ立ち石だ。\n北のくぎ星、七つの泉星。', 'いちばん下に、ほかより大きな\n丸い印が刻まれている。\n星にしては、大きすぎる。']);
    if (X().tier() >= 2) await ev.say(null, '……丸い印のまわりに、\n光の筋が彫られている。\nまるで、燃えているように。');
  });

  E('desert_camp2_child', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say('camp2_star', '星の石のいちばん下の、大きな丸。\nじいちゃんは「日輪」って言うんだ。\n……空にあったんだって。'); return; }
    await ev.say('camp2_star', ['ぼく、星読みの見習い。\n星の石で、星の名前を覚えてるの。', '北のくぼ地はね、嵐の晩に\n昔の隊の野営跡が見えるんだよ。\n宝物があるって、じいちゃんが。']);
  });

  // ---------------------------------------------------------------- 野営地 3「王墓のオアシス」
  E('desert_camp3_scene', async (ev) => {
    if (!ev.flag('desert_caravan_on') || !ev.flag('desert_camp2_done') || ev.flag('desert_camp3_done')) {
      if (!ev.flag('desert_caravan_on') && !ev.flag('desert_camp3_done') && !ev.flag('desert_camp3_seen')) {
        ev.setFlag('desert_camp3_seen');
        await ev.caption('古い泉のほとりに、\n砂岩の崖を掘った墓の入口がある。\n……入口は、砂でふさがれている。', { ms: 2600 });
      }
      return;
    }
    await ev.fade('out', 300);
    await ev.warp('desert_camp3', 'fire');
    await ev.fade('in', 400);
    await ev.caption('王墓のオアシス。\n古い泉は、底の石が見えるほど\n浅くなっていた。', { ms: 2400 });
    await starSong(ev, 2);
    await ev.say('npc_zaid', ['地の果ての、白む星……。\n祖母は、あれを「夜明けの星」と\n呼んでいた。', '……夜明け。\nふしぎな言葉だな。\n夜が、明ける？　何が明けるんだ？'], ZAID);
    await ev.say(null, 'ザイードは首をかしげて、\nたき火に薪を足した。');
    await ev.say('npc_zaid', ['供え物は、泉のほとりに置いた。\n隊はここで待つ。', '墓の入口の砂は、隊の者でどけた。\n……ここから先は、あんたたちだけだ。', '王墓の番のアブルじいさんも、\n古い道を通って来ているはずだ。\n話を聞いていくといい。'], ZAID);
    ev.guest(null);
    ev.setFlag('desert_caravan_on', false);
    ev.setFlag('desert_camp3_done');
    ev.setFlag('desert_abul_came');
    ev.leadDone('l_desert_caravan');
    ev.lead('l_desert_tomb');
    ev.rest();
    await ev.caption('泉のほとりで、短い眠り。\n（一行の体力と魔力が戻った）', { ms: 2000 });
  }, {
    meta: {
      needs: ['flag:desert_caravan_on', 'flag:desert_camp2_done'],
      gives: ['flag:desert_camp3_done', 'flag:desert_abul_came', 'lead:l_desert_tomb'],
      warp: { to: 'desert_camp3', spawn: 'fire' },
    },
  });

  // ---------------------------------------------------------------- 野営地の隊の人（進み具合で話が変わる）
  E('desert_camp_zaid', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'npc_zaid';
    if (ev.flag('desert_camp3_done')) {
      if (ev.flag('desert_king')) { await ev.say(id, '墓の奥で、何かが変わった。\n泉の底が……温かい。'); return; }
      await ev.say(id, ['隊は、泉のほとりで待っている。\n急がなくていい。……だが、\n無事に戻ってくれ。', '王の名か……。\nわしらの祈りの言葉には、\n名の所が無いんだ。昔からな。']);
      return;
    }
    if (ev.flag('desert_camp2_done')) { await ev.say(id, ev.choiceOf('ch_desert_route') === 'short' ? 'くぼ地は北だ。嵐の中では、\n星の石の方角を忘れるなよ。' : '西の浜へ出て北だ。\n井戸の小屋で、ひと休みしよう。'); return; }
    await ev.say(id, '次は「星の石」。南へ道なりだ。\n……今夜の星は、よく見える。');
  });
  E('desert_camp_man', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    const fad = /man1$/.test(id || '');
    if (ev.flag('desert_camp3_done')) {
      await ev.say(id, fad ? 'ラクダたちも、ここの水を\nうまそうに飲んでるよ。\n……浅いがな。' : 'おれ、王墓に入ったことはない。\n名を忘れた者は、出てこられない\nって言うだろ？');
      return;
    }
    if (ev.flag('desert_camp1_done')) {
      const c = X().hawk(ev);
      await ev.say(id, fad ? { fight: 'あの鷹団の頭、強かったな……。\nあんたたちがいてよかった。', water: '水は減ったが、誰も死ななかった。\n……おれは、それでいいと思う。', pay: '金で済むなら、それが一番さ。\nギルドの帳面には「通行料」だ。' }[c] || '鷹団か……。' : '砂嵐の匂いがする。\n鼻の奥が、ちりちりするんだ。');
      return;
    }
    await ev.say(id, fad ? 'おれはファド。荷車の番だ。\n車輪が砂にはまったら、\n押すのを手伝ってくれよ。' : 'おれはサミル。夜の見張りだ。\n岩の井戸のあたりは、\n盗賊が出るって話だ。');
  });

  // 野営地 1 の井戸と碑（戦の傷 lo_war_desert）・井戸守りの老人
  E('desert_camp1_well', async (ev) => {
    await ev.say(null, ['岩に囲まれた古い井戸だ。\n縄をたらしても、水の音がしない。', ev.flag('cleared_r_desert') ? '……いや、底のほうで、\nかすかに水が光った。' : '底の砂が、からからに乾いている。']);
  });
  E('desert_camp1_memorial', async (ev) => {
    await ev.say(null, ['風に削られた石の碑だ。\n日輪の紋が刻まれている。', '戦で死んだ兵の名が\n並んでいたらしいが……\nひとつも読めない。']);
    await X().lore(ev, 'lo_war_desert');
    if (ev.flag('cleared_r_desert') && ev.choiceOf('ch_desert_write') === 'pain') await ev.say(null, '碑のすみに、新しく彫られた名が\nいくつか並んでいる。\n刃物で、ていねいに。');
  }, { meta: { needs: [], gives: ['flag:lo_war_desert'] } });
  E('desert_camp1_old', async (ev) => {
    if (ev.flag('cleared_r_desert')) { await ev.say('camp1_old', '井戸の底に、水が戻りはじめた。\n……わしが生きとるうちに、\n見られるとはのう。'); return; }
    await ev.say('camp1_old', ['わしは、この井戸の守りじゃ。\n水が無くても、守りは守りよ。', 'あの碑？　二十年前の戦の碑じゃ。\n名は、風が持っていってしもうた。\n……誰が死んだのか、もう誰も知らん。']);
  });
})(window.RPG);
