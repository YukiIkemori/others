// 白竜の峰と雪原の締め（WORLD_REDESIGN §4.3 の 5〜7・§4.10、STORY_BIBLE §7.3・§11.8）
//   peak_icewall（冬至の火の火種で氷の壁をとかす）・peak_giant（氷壁の巨人 tr_b_icegiant）・peak_neve（頂で白竜ネーヴェ: 語る／戦う）→
//   snow_finale（冬至の火を竜に渡す → 吹雪が止み、空いっぱいのオーロラ → ev.clearRegion('r_snow') → ユールで夜数えの板・日継ぎの主張 →
//   年代記に書く選択 ch_snow_write）・snow_day2（遅れた大火祭の二日目。痛みの側はヨルンが被害の家の名を読み上げる）
//   録音済みの文（巨人・ネーヴェ）は 1 字も変えずに地の文として置く（声はあとで）。
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Snow.ev;
  const objAt = (ctx, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === 'examine' && o.event === event && o.x === ctx.x && o.y === ctx.y); };
  const NEVE = { name: '白竜ネーヴェ', face: false };
  const GIANT = { name: '氷壁の巨人', face: false };

  E('peak_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption('白竜の峰。\n吹雪が、横なぐりに吹きつける。', { ms: 2200 });
    if (!ev.has('k_winter_flame')) await ev.caption('……この先は、厚い氷が\n道をふさいでいるらしい。', { ms: 2000 });
  }, { meta: { needs: [], gives: [] } });

  // 氷の壁（冬至の火の火種でとける）
  E('peak_icewall', async (ev, ctx) => {
    const o = objAt(ctx, 'peak_icewall');
    const n = (o && o.wall) || 1;
    const f = 'snow_ice_' + n;
    if (ev.flag(f)) { await ev.say(null, 'とけた氷の水が、\n足もとで凍りかけている。'); return; }
    if (!ev.has('k_winter_flame')) {
      await ev.say(null, ['分厚い氷の壁が、道をふさいでいる。\nたたいても、びくともしない。', 'ただの火では、とけそうにない。\n……冬至の火のような、\n強い火でなければ。']);
      return;
    }
    await ev.say(null, '冬至の火の火種を、\n氷の壁にかざした。');
    ev.sfx('fire');
    try { R.Field.flash('#ffc070', 300); } catch (e) { /* */ }
    ev.setFlag(f);
    await ev.caption('氷の壁が、音を立ててとけていく……！', { ms: 1800 });
  }, { meta: { needs: ['item:k_winter_flame'], gives: ['flag:snow_ice_1', 'flag:snow_ice_2', 'flag:snow_ice_3'] } });

  E('peak_overlook', async (ev) => {
    await ev.say(null, X().cleared(ev) ? ['岩棚から、雪原が見渡せる。\nユールの冬至の火が、\n赤い点のように見える。'] : ['岩棚から、吹雪の雪原を\n見下ろした。', 'ずっと下に、ユールの\n大かまどの火が、かすかに見える。']);
  });

  // 氷壁の巨人（中ボス）
  E('peak_giant', async (ev) => {
    if (ev.flag('snow_giant')) return;
    ev.bgm('omen');
    await ev.say(null, 'ズシン……ズシン……。\n氷の壁そのものが、立ち上がった。');
    await ev.say('icegiant', '……ここより上へは、\n誰も通さぬ……。', Object.assign({ voice: 'v_giant_peak_01' }, GIANT));
    ev.sfx('roar');
    const r = await ev.battle('tr_b_icegiant', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('snow_giant');
    await ev.say(null, ['巨人の体が、ひび割れて崩れた。\n氷のかけらが、吹雪に散っていく。', 'その奥に、頂へ続く\n石段が現れた。']);
  }, { meta: { needs: ['flag:snow_ice_2'], gives: ['flag:snow_giant'] } });

  E('peak_top_arrive', async (ev) => {
    if (X().cleared(ev)) return;
    await ev.caption('白竜の峰の頂。\n吹きさらしの岩の上に、\n吹雪が渦を巻いている。', { ms: 2600 });
  });
  E('peak_epitaph', async (ev) => {
    await ev.say(null, ['大きな岩に、古い字が彫られている。\n爪で刻んだような、深い字だ。', '「いつか朝が来なくなっても、\n朝は壊れたのではない。\nめくられなくなっただけ」']);
    await X().lore(ev, 'lo_snow_epitaph');
  }, { meta: { needs: [], gives: ['flag:lo_snow_epitaph'] } });
  E('peak_altar', async (ev) => {
    await ev.say(null, X().cleared(ev) ? ['氷の祭壇に、冬至の火が燃えている。\n吹雪は、もう吹かない。', 'ネーヴェの気配が、\n峰じゅうに満ちている。'] : '氷の祭壇。\n火を置く台が、空いている。');
  });

  // 頂で白竜ネーヴェ（語る／戦う）
  E('peak_neve', async (ev) => {
    if (X().cleared(ev)) return;
    if (!ev.has('k_winter_flame')) return;
    ev.bgm('omen');
    try { R.Field.shake(6, 900); } catch (e) { /* */ }
    await ev.caption('吹雪を裂いて、白い竜が\n祭壇に舞い降りた。', { ms: 2400 });
    await ev.say('neve', '……去れ……人の子よ……。\nこの峰に、もはや\n語るべき物語はない……！', Object.assign({ voice: 'v_neve_peak_01' }, NEVE));
    const canTalk = ev.flag('snow_logs_done') && ev.flag('snow_ice_done') && ev.flag('snow_tales_done') && ev.choiceOf('ch_snow_tale') === 'dragon';
    let how = 'fight';
    if (canTalk) {
      const i = await ev.choose(['物語を語る', '戦う'], { text: 'ネーヴェが、翼を広げた。' });
      how = i === 0 ? 'talk' : 'fight';
    } else {
      await ev.say(null, '竜の目は、凍りついたように\n冷たい。……言葉は届きそうにない。');
    }
    if (how === 'talk') {
      await ev.say(null, ['{hero}は、冬至の火を掲げ、\n祭で語った話を、もう一度語った。', '竜と、火を運んだ娘の約束の話を。']);
      ev.bgm('legend');
      for (const l of X().TALES.dragon.lines) await ev.caption(l, { ms: 3000 });
      await ev.caption('ネーヴェの目の奥で、\n何かがゆっくりと、とけていく。', { ms: 2600 });
    } else {
      ev.sfx('roar');
      const r = await ev.battle('tr_b_whitedragon', { boss: true });
      if (r !== 'win') { ev.mapBgm(); return; }
      await ev.say(null, '白竜は膝を折り、\n吹雪がふっと弱まった。');
    }
    ev.choice('ch_snow_neve', how);
    ev.bgm('dawn');
    await ev.say('neve', '……あたたかい。人の子らは、\nわたしを忘れてはいなかったのか。', Object.assign({ voice: 'v_neve_peak_02' }, NEVE));
    await ev.say('neve', '吹雪は、わたしが鎮めよう。\n語り部よ、礼を言う。', Object.assign({ voice: 'v_neve_peak_03' }, NEVE));
    ev.setFlag('snow_neve');
    await ev.call('snow_finale');
  }, {
    meta: {
      needs: ['flag:snow_giant', 'item:k_winter_flame'],
      gives: ['flag:snow_neve', 'choice:ch_snow_neve', 'region:r_snow', 'flag:snow_finale_done', 'choice:ch_snow_write'],
      calls: ['snow_finale'],
    },
  });

  // ---------------------------------------------------------------- 灯り直す場面と締め
  E('snow_finale', async (ev) => {
    if (ev.flag('snow_finale_done')) return;
    const x = X();
    // 竜の品（戦う: 竜の牙の剣／語る: 竜のうろこのお守り。同じ強さの別の品）
    if (ev.choiceOf('ch_snow_neve') === 'talk') {
      await ev.say('neve', '……これを持っていくがよい。\nわたしの、うろこの一枚だ。', Object.assign({ voice: 'v_neve_peak_04' }, NEVE));
      ev.item('u_dragon_scale', 1);
    } else {
      await ev.say(null, '戦いで折れた竜の牙が、\n雪の上に落ちていた。');
      ev.item('u_dragon_fang', 1);
    }
    await ev.say(null, '{hero}は、冬至の火を\n氷の祭壇に置いた。');
    ev.take('k_winter_flame', 1);
    ev.sfx('fire');
    // 大灯火（冬至の火）: ページ・ティア・光の柱・章の札（EVENTS の共通の筋）
    await ev.clearRegion('r_snow');
    ev.bgm('dawn');
    ev.sfx('light');
    await ev.caption('吹雪が、止んだ。', { ms: 2000 });
    await ev.caption('雲が割れて、空いっぱいに\nオーロラが揺れた。\n緑と、薄紅と、青。', { ms: 3200 });
    await ev.caption('地平が、ほんの少しだけ、\n白んだ気がした。', { ms: 2600 });
    ev.setFlag('snow_aurora_seen');
    // ユールへ: 夜数えの板・日継ぎの主張
    await ev.fade('out', 800);
    await ev.warp('yule', 'hearth');
    await ev.caption('ユール。\n吹雪のやんだ広場に、\n村じゅうの人が空を見上げていた。', { ms: 2600 });
    await ev.say('sonja', ['{hero}！　おかえりなさい。', '夜数えの板に、今夜の刻みを\n入れようとしたの。\n……でも、手が止まっちゃった。', '……今夜は、いつもより\n空が明るい。'], { voice: ['v_sonja_snow_05', 'v_sonja_snow_06', 'v_sonja_snow_07'] });   // 1 つ目は名前を読まない
    ev.setFlag('snow_board_stop');
    await ev.say('old_m', ['冬至に火を峰へ運ぶから、\nいつか太陽が戻ってくる。', '……わしのじいさまは、\nそう言っておったよ。'], { name: '村の年寄り' });
    // 年代記に書く選択（ch_snow_write。痛みの側は pain_count を足す）
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    await ev.say(null, '{hero}は、年代記を開いた。\nこの村のことを、どう書こう。');
    const i = await ev.choose(['勝ったことだけを書く', broken.length ? '守れなかった門のことも書く' : '村が震えた夜のことも書く'], { text: '年代記に何を書く？' });
    if (i === 1) {
      ev.choice('ch_snow_write', 'pain');
      ev.addVar('pain_count', 1);
      await ev.say(null, '「……守れなかった門があった。\nそこで壊れたもののことも、\nここに記す」');
    } else {
      ev.choice('ch_snow_write', 'glory');
      await ev.say(null, '「ユールの人々は大火祭の夜、\n氷の狼を退け……」');
    }
    ev.sfx('quill');
    ev.setFlag('snow_finale_done');
    ev.leadDone('l_snow_peak');
    await ev.call('snow_jorn_reward');
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_neve'], gives: ['region:r_snow', 'flag:snow_finale_done', 'choice:ch_snow_write', 'flag:snow_board_stop', 'item:u_dragon_fang|u_dragon_scale'], calls: ['snow_jorn_reward'], warp: { to: 'yule', spawn: 'hearth' } } });

  // 遅れた大火祭の二日目（締めのあと、次にユールに入ったとき）
  E('snow_day2', async (ev) => {
    if (ev.flag('snow_day2') || !ev.flag('snow_finale_done')) return;
    ev.setFlag('snow_day2');
    ev.bgm('bonfire');
    await ev.caption('遅れた大火祭の、二日目。\n広場に屋台が並び、\n子どもたちが雪の中を走り回る。', { ms: 2800 });
    const broken = ['n', 'e', 'w'].filter((g) => ev.flag('snow_gate_' + g + '_broken'));
    if (ev.choiceOf('ch_snow_write') === 'pain' && broken.length) {
      await ev.say('jorn', ['……祭の前に、ひとつ。', broken.map((g) => X().GATES[g]).join('と') + 'のそばで、\n家を壊された者がいる。\n名を読み上げさせてくれ。']);
      await ev.caption('ヨルンは、壊れた門のそばで、\n家の名をひとつずつ読み上げた。\n広場は、しばらく静かだった。', { ms: 3200 });
    }
    await ev.say('sonja', ['{hero}、冬至の火をね、\n分けておいたの。', '峠の道の灯籠が、三つ\n消えたままなんだって。\nこれで、ともしてあげて。']);
    ev.item('k_yule_ember', 1);
    ev.lead('q_snow_lamps');
    const ok = ['n', 'e', 'w'].filter((g) => !ev.flag('snow_gate_' + g + '_broken'));
    if (ok.length) await ev.caption('守りきった門の家の前に、\n礼の箱が置かれている。', { ms: 2000 });
    ev.mapBgm();
  }, { meta: { needs: ['flag:snow_finale_done'], gives: ['flag:snow_day2', 'item:k_yule_ember', 'lead:q_snow_lamps'] } });
})(window.RPG);
