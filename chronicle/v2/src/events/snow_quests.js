// 雪原の小さな依頼と、雪の林・ワールドのイベント（WORLD_REDESIGN §4.3「小さな依頼」・§5.1・§1.3・E8・E21、V2_PLAN §3.4 の形）
//   どれも本筋に要らない・失っても何も失わない（祭の支度の薪だけは本筋。雪の林の woods_log）。
//   q_snow_fishing  氷上の釣り大会（釣り小屋のトーレ。R.Mini.timing、3 段。段ごとに品。三段目は一品物）
//   q_snow_dog      迷子のそり犬（雪の林の北東で見つけて連れ帰る。E8 ついてくる人）→ そり犬の渡し（凍った湖を越えて北の流氷原へ）
//   q_snow_statue   雪像づくり（リーサ。飾りの材料 3 つ → 像の形を選ぶ。広場の見た目と小さな品）
//   q_snow_base     子どもの秘密基地（合言葉は町の子のほのめかしから。見える宝箱。町なので隠し通路にはしない）
//   q_snow_lamps    【灯りを守る】峠の道しるべ（解決の後、冬至の火のおすそ分けで消えた灯籠 3 つに火を。周り 5 マスは魔物が出ない）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const objAt = (ctx, type, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === type && (!event || o.event === event) && o.x === ctx.x && o.y === ctx.y); };

  // ================================================================ 氷上の釣り大会
  const FISH = [
    { label: '一段目（小ザカナ）', speed: 1500, zones: [[0.36, 0.64]], need: 'B', reward: ['i_ether', 2] },
    { label: '二段目（銀ザカナ）', speed: 1150, zones: [[0.4, 0.6]], need: 'A', reward: ['hd_yeti_fur', 1] },
    { label: '三段目（氷の主）', speed: 850, zones: [[0.44, 0.56]], need: 'S', reward: ['u_ice_rod_charm', 1] },
  ];
  const RANK = { S: 3, A: 2, B: 1, C: 0 };
  E('snow_fishing_talk', async (ev) => {
    if (!ev.flag('snow_fish_met')) {
      await ev.say('fisher', ['祭の間は、氷上の釣り大会よ。\n小屋の中の穴で、糸を垂らす。', '魚が食いついたら、\n息を合わせて引き上げる。\n三段まであるぞ。']);
      ev.setFlag('snow_fish_met');
      ev.lead('q_snow_fishing');
    }
    if (ev.flag('snow_saw') && !ev.flag('snow_ice_done')) await ev.say('fisher', '灯籠の氷は、池の真ん中だ。\nのこぎりは、切り終えたら\n返してくれればいい。');
    else if (ev.flag('snow_fish_3')) await ev.say('fisher', '氷の主を釣り上げたのは、\nわしの知るかぎり、あんたで二人目だ。');
    else await ev.say('fisher', '釣るなら、奥の穴だ。');
  }, { meta: { needs: [], gives: ['flag:snow_fish_met', 'lead:q_snow_fishing'] } });

  E('yule_fish_hole', async (ev) => {
    if (!ev.flag('snow_fish_met')) { await ev.say(null, '氷に開けた釣りの穴。\n釣り小屋のじいさまに\n聞いてみよう。'); return; }
    const labels = FISH.map((f, i) => f.label + (ev.flag('snow_fish_' + (i + 1)) ? '（済み）' : ''));
    const i = await ev.choose(labels.concat(['やめておく']), { cancel: FISH.length, text: 'どの段で釣る？' });
    if (i >= FISH.length || i < 0) return;
    if (i > 0 && !ev.flag('snow_fish_' + i)) { await ev.say('fisher', 'その段は、前の段を\n済ませてからだ。', { name: 'トーレ' }); return; }
    const f = FISH[i];
    const r = (await ev.mini.timing({ title: '氷上の釣り・' + f.label, speed: f.speed, zones: f.zones, tries: 3, theme: 'night' })) || {};
    if ((RANK[r.rank] || 0) < RANK[f.need]) { await ev.say('fisher', '逃げられたか。\n氷の下の魚は、せっかちだぞ。', { name: 'トーレ' }); return; }
    const key = 'snow_fish_' + (i + 1);
    if (ev.flag(key)) { await ev.caption('見事に釣り上げた！', { ms: 1400 }); return; }
    ev.setFlag(key);
    ev.sfx('item');
    await ev.caption('見事に釣り上げた！', { ms: 1400 });
    await ev.say('fisher', i === 2 ? 'こいつは……氷の主だ！\nほれ、名人の証をやろう。' : 'いい腕だ。ほれ、賞品だ。', { name: 'トーレ' });
    ev.item(f.reward[0], f.reward[1]);
    if (i === 2) ev.leadDone('q_snow_fishing');
  }, { meta: { needs: ['flag:snow_fish_met'], gives: ['flag:snow_fish_1', 'flag:snow_fish_2', 'flag:snow_fish_3'] } });

  // ================================================================ 迷子のそり犬 → そり犬の渡し
  E('yule_sled', async (ev) => {
    if (ev.flag('snow_dog_found') && !ev.flag('snow_dog_home')) {
      await ev.say('sled_man', ['ブランカ！　おまえ、\nどこへ行ってたんだ！', '……連れて帰ってくれたのか。\nありがとう、旅の人。']);
      ev.guest(null);
      ev.setFlag('snow_dog_home');
      ev.leadDone('q_snow_dog');
      await ev.say('sled_man', ['礼に、そりを出してやろう。\nブランカがいれば、薄い氷の上も\nすべって渡れる。', '凍った湖の向こう、\n北の流氷原へ、いつでもな。']);
      ev.gold(X().tier() * 60 + 120);
      return;
    }
    if (ev.flag('snow_dog_home')) {
      const i = await ev.choose(['北の流氷原へ渡る', 'やめておく'], { cancel: 1, text: 'そりに乗っていくかい？' });
      if (i !== 0) return;
      await ev.fade('out', 500);
      await ev.caption('犬たちが吠え、そりが走り出した。\n凍った湖の上を、風のように。', { ms: 2400 });
      await ev.warp('world', 'floe');
      return;
    }
    if (!ev.flag('snow_dog_asked')) {
      await ev.say('sled_man', ['おれはニルス。\nそり犬の世話をしてる。', '先頭犬のブランカが、\n吹雪の夜に逃げ出しちまった。\n雪の林の方へ走っていったきりだ。']);
      await ev.say('sled_man', ['あいつがいないと、そりが\n出せないんだ。見つけたら、\n連れて帰ってくれないか。']);
      ev.setFlag('snow_dog_asked');
      ev.lead('q_snow_dog');
      return;
    }
    await ev.say('sled_man', 'ブランカは、雪の林の奥だと思う。\n北東の、くぼ地のあたりかな。');
  }, { meta: { needs: [], gives: ['flag:snow_dog_asked', 'lead:q_snow_dog', 'flag:snow_dog_home'] } });
  E('yule_dog', async (ev) => { await ev.say('sled_dog', 'ワウッ！\n（しっぽを大きく振っている）', { name: 'ブランカ' }); });
  E('snow_woods_dog', async (ev) => {
    if (ev.flag('snow_dog_found')) return;
    await ev.say(null, ['雪のくぼ地に、そり犬が\n一匹うずくまっていた。', '首輪に「ブランカ」と\n焼き印がある。']);
    if (!ev.flag('snow_dog_asked')) { await ev.say(null, '誰かの犬だろうか。\n……ユールで聞いてみよう。'); ev.lead('q_snow_dog'); return; }
    await ev.say('lost_dog', 'ワフッ！\n（ついてくる気のようだ）', { name: 'ブランカ' });
    ev.setFlag('snow_dog_found');
    await ev.fade('out', 300);
    try { await ev.npc('lost_dog').hide(); } catch (e) { /* */ }
    ev.guest('ani_dog');
    await ev.fade('in', 300);
    await ev.caption('ブランカが、あとをついてくる。\nユールのニルスのもとへ連れて帰ろう。', { ms: 2200 });
  }, { meta: { needs: ['flag:snow_dog_asked'], gives: ['flag:snow_dog_found'] } });

  // 北の流氷原の上陸の場所（そりで帰る）
  E('world_snow_floe_sled', async (ev) => {
    if (ev.flag('cleared_r_snow')) { await ev.say(null, '凍った湖に、厚い氷の道が\nできている。歩いて帰れそうだ。'); }
    if (!ev.flag('snow_dog_home')) return;
    const i = await ev.choose(['ユールへ戻る', 'やめておく'], { cancel: 1, text: 'ブランカのそりが待っている。' });
    if (i !== 0) return;
    await ev.fade('out', 500);
    await ev.warp('yule', 'sled');
  }, { meta: { needs: [], gives: [] } });

  // ================================================================ 雪像づくり
  const MATS = { snow_mat_ice: '澄んだ氷のかけら', snow_mat_coal: '大かまどの炭', snow_mat_berry: '雪の林の赤い実' };
  E('yule_sculptor', async (ev) => {
    if (ev.flag('snow_statue_done')) { await ev.say('sculptor', 'あの像、村の子たちに\n大人気なの！\nありがとう。'); return; }
    if (!ev.flag('snow_statue_asked')) {
      await ev.say('sculptor', ['わたしはリーサ。祭の雪像を\n作ってるの。……でも、\n飾りの材料が足りなくて。', '澄んだ氷のかけら、\n大かまどの炭、\n雪の林の赤い実。']);
      await ev.say('sculptor', '三つそろったら、あなたの\n好きな形にしてあげる！');
      ev.setFlag('snow_statue_asked');
      ev.lead('q_snow_statue');
      return;
    }
    const got = Object.keys(MATS).filter((k) => ev.flag(k));
    if (got.length < 3) { await ev.say('sculptor', ['あと ' + (3 - got.length) + ' つ！', Object.keys(MATS).filter((k) => !ev.flag(k)).map((k) => MATS[k]).join('、') + '。']); return; }
    const i = await ev.choose(['竜', '狼と猟師', '大かまど'], { text: 'どんな像にする？' });
    const c = ['dragon', 'wolf', 'hearth'][i] || 'dragon';
    ev.choice('ch_snow_statue', c);
    await ev.fade('out', 500);
    await ev.caption('リーサと子どもたちが、\n雪をかため、削り、飾りをつけた……。', { ms: 2400 });
    ev.setFlag('snow_statue_done');
    await ev.fade('in', 500);
    ev.leadDone('q_snow_statue');
    await ev.say('sculptor', 'できた！\nお礼に、これをどうぞ。');
    X().small(ev, [['i_potion', 3], ['i_elixir', 1], ['i_elixir', 2], ['i_elixir', 3]]);
  }, { meta: { needs: [], gives: ['flag:snow_statue_asked', 'lead:q_snow_statue', 'flag:snow_statue_done', 'choice:ch_snow_statue'] } });
  // 材料（ついでに拾える所。雪像を頼まれていなくても拾える）
  E('snow_mat', async (ev, ctx) => {
    const o = objAt(ctx, 'examine');
    const k = o && o.mat;
    if (!k || ev.flag(k)) { await ev.say(null, 'もう十分に拾った。'); return; }
    ev.setFlag(k);
    ev.sfx('item');
    await ev.caption(MATS[k] + 'を拾った。', { ms: 1600 });
  }, { meta: { needs: [], gives: ['flag:snow_mat_ice', 'flag:snow_mat_coal', 'flag:snow_mat_berry'] } });

  // ================================================================ 子どもの秘密基地（合言葉）
  E('yule_base_kid', async (ev) => {
    if (ev.flag('snow_base_open')) return;
    await ev.say('base_kid', ['ここは、秘密基地！\n入りたかったら、合言葉！', '竜の、いちばん\n好きなものは、なーんだ？']);
    ev.lead('q_snow_base');
    const i = await ev.choose(['火', '氷', '物語', 'わからない'], { cancel: 3 });
    if (i === 2) {
      await ev.say('base_kid', 'せいかーい！\n入っていいよ！');
      ev.setFlag('snow_base_open');
      ev.leadDone('q_snow_base');
      await ev.fade('out', 250);
      try { await ev.npc('base_kid').hide(); } catch (e) { /* */ }
      await ev.fade('in', 250);
      return;
    }
    await ev.say('base_kid', i === 3 ? '村の子に聞いてみなよ！' : 'ぶぶー！　ちがうよー。\n火は、おまけなんだって。');
  }, { meta: { needs: [], gives: ['flag:snow_base_open', 'lead:q_snow_base'] } });

  // ================================================================ 【灯りを守る】峠の道しるべ
  E('snow_waylamp', async (ev, ctx) => {
    const o = objAt(ctx, 'waylamp');
    const n = o ? +String(o.id).replace(/\D/g, '') : 1;
    const f = 'q_snow_lamps_' + n;
    if (ev.flag(f)) { await ev.say(null, '道しるべの灯籠に、\n冬至の火がともっている。\nまわりの吹雪が、やわらいだ。'); return; }
    if (!ev.has('k_yule_ember')) { await ev.say(null, ['道しるべの灯籠の火が、\n消えている。', '獣脂が凍って、\nただの火ではつかないようだ。']); return; }
    await ev.say(null, '冬至の火のおすそ分けを、\n灯籠に移した。');
    ev.setFlag(f);
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    await ev.caption('灯籠に、火がともった！\nこのあたりには、もう\n魔物が寄りつかないだろう。', { ms: 2200 });
    if ([1, 2, 3].every((k) => ev.flag('q_snow_lamps_' + k)) && !ev.flag('snow_lamps_done')) {
      ev.setFlag('snow_lamps_done');
      ev.leadDone('q_snow_lamps');
      await ev.caption('峠の道の灯籠が、\nすべてともった。', { ms: 1800 });
      X().small(ev, [['gold', 200], ['gold', 260], ['gold', 340], ['gold', 420], ['gold', 520], ['gold', 640], ['gold', 780], ['gold', 900]]);
    }
  }, { meta: { needs: ['item:k_yule_ember'], gives: ['flag:q_snow_lamps_1', 'flag:q_snow_lamps_2', 'flag:q_snow_lamps_3', 'flag:snow_lamps_done'] } });

  // ================================================================ 雪の林（薪集め・雪男・野営地）
  E('snow_woods_arrive', async (ev) => {
    await ev.caption('雪の林。\n吹雪に倒された木が、\nあちこちに横たわっている。', { ms: 2400 });
  });
  E('snow_woods_camp', async (ev) => {
    // ④ ほのめかし・⑤
    if (!ev.flag('snow_woods_camp_given')) {
      await ev.say('woods_hunter', ['薪割りか？　ユールの祭の。\nおれも運んでいる途中さ。', 'これ、腹の足しにしてくれ。']);
      ev.item('i_salve', 3);
      ev.setFlag('snow_woods_camp_given');
    }
    await ev.say('woods_hunter', ['北の広場の雪男は、でかいが\n火に弱い。', '北西の岩の間は、雪の斜面を\n下りると戻れない。宝箱を\n取ったら、西の小道から帰れ。']);
  }, { meta: { needs: [], gives: ['flag:snow_woods_camp_given'] } });
  E('snow_woods_yeti', async (ev) => {
    if (ev.flag('snow_woods_yeti')) return;
    ev.bgm('omen');
    await ev.say(null, '倒木の陰で、白い毛の山が動いた。\n……雪男だ！');
    ev.sfx('roar');
    const r = await ev.battle('tr_snow_woods_yeti');
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_woods_yeti');
    await ev.say(null, '雪男は、林の奥へ逃げていった。');
  }, { meta: { needs: [], gives: ['flag:snow_woods_yeti'] } });
  E('snow_woods_log', async (ev, ctx) => {
    const o = objAt(ctx, 'examine', 'snow_woods_log');
    const n = (o && o.log) || 1;
    const f = 'snow_log_' + n;
    if (ev.flag(f)) { await ev.say(null, '倒木の切り株。\n薪は、もう運び出した。'); return; }
    if (n === 2 && !ev.flag('snow_woods_yeti')) { await ev.call('snow_woods_yeti'); if (!ev.flag('snow_woods_yeti')) return; }
    await ev.say(null, ['よく乾いた倒木だ。', '{hero}は、倒木を\n運べる大きさに切り分けた。']);
    ev.setFlag(f);
    ev.sfx('item');
    const k = ev.addVar('snow_logs', 1);
    await ev.caption(`大火祭の薪を集めた。（${k}/3）`, { ms: 1800 });
    if (k >= 3 && !ev.flag('snow_logs_done')) {
      ev.setFlag('snow_logs_done');
      ev.item('k_yule_logs', 1);
      await ev.caption('薪が三本そろった。\nユールの村長ヨルンに知らせよう。', { ms: 2200 });
    }
  }, { meta: { needs: [], gives: ['flag:snow_log_1', 'flag:snow_log_2', 'flag:snow_log_3', 'flag:snow_logs_done', 'item:k_yule_logs', 'var:snow_logs+3'], calls: ['snow_woods_yeti'] } });

  // ================================================================ ワールドの雪原
  E('world_snow_lake', async (ev) => {
    if (ev.flag('cleared_r_snow')) { await ev.say(null, ['凍った湖に、厚い氷の道が\n北へまっすぐ延びている。', '向こうは、北の流氷原だ。']); return; }
    await ev.say(null, ['凍った湖。今年は氷が薄く、\nところどころ黒い水がのぞいている。', 'そり犬なら、すべって渡れるかも\nしれない。']);
    ev.lead('l_opt_aurora');
  }, { meta: { needs: [], gives: ['lead:l_opt_aurora'] } });
  E('world_snow_fox', async (ev) => {
    await ev.say(null, ['雪の上に、小さな獣の足あと。\nかすかに、青白く光っている。', '足あとは、北の方へ\n続いているようだ。']);
    if (!ev.flag('snow_fox_seen')) { ev.setFlag('snow_fox_seen'); ev.item('k_fox_charm', 1); ev.lead('l_snow_fox'); }
  }, { meta: { needs: [], gives: ['flag:snow_fox_seen', 'lead:l_snow_fox'] } });
  E('world_snow_trapper', async (ev) => {
    // ④ ほのめかし（つららの回廊）・⑥
    await ev.say('snow_trapper', ['西の崖の氷の洞、\nつららの回廊ってんだ。', '奥の暗い所に、つらら番がいる。\n火皿に火をともしてから\n近づくといい。']);
    ev.lead('l_opt_icicle');
  }, { meta: { needs: [], gives: ['lead:l_opt_icicle'] } });
  E('world_snow_pilgrim', async (ev) => {
    // ⑦ 近況・寄り道
    await ev.say('snow_pilgrim', X().cleared(ev) ? ['吹雪がやんでから、峠が\nずいぶん楽になった。', '峠の宿で、湯につかって\nいくといい。'] : ['山の町へ越えるつもりが、\n峠の先は崖崩れだ。', '峠の宿で、雪がやむのを\n待つとしよう。']);
    ev.lead('l_opt_pass_inn');
  }, { meta: { needs: [], gives: ['lead:l_opt_pass_inn'] } });
  E('world_snow_scout', async (ev) => {
    // ⑥ ボスの癖
    await ev.say('snow_scout', X().cleared(ev) ? '峰の竜が、空を飛んでいくのを\n見たんだ！　……夢じゃないよな。' : ['峰の上の竜は、息を大きく\n吸いこんでから、吹雪を吐く。', '吸いこむのを見たら、\nみんなで身を固めるんだ。\n……と、じいちゃんが言ってた。']);
  });
})(window.RPG);
