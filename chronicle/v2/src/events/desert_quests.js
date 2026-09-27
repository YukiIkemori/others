// CONTENT（砂漠）: カシムの小さな依頼（WORLD_REDESIGN §4.2 の小さな依頼 1〜5、§5.5）。どれも本筋に要らない・失っても何も失わない。
//   q_kasim_anklet   ナディアの足鈴 → 市場の子（なつめやしと取り替え）→ ナディアに u_nadia_bell
//   q_kasim_dig      井戸掘りのオマル → ワールドの 3 か所を掘る（当たりで小さな泉 = 町の外の回復の泉）→ u_well_charm
//   q_kasim_camel    ギルドの帳場 → 南東の砂丘のラクダを連れ帰る（ついてくる人）→ 品とお金
//   q_kasim_beacons  灯守組合のタデオ → 隊商路ののろし台 3 つに黒い泉の油（ワールドの waylamp）→ u_signal_mirror
//   q_kasim_salt     塩売りのカリム → 宿場「砂の縁」の行商人ロッタへ塩の包み → お金（ロッタの籠の品が増える）
//   q_kasim_maps     地図屋のヤズ → 宝の地図（ティアで 1 枚ずつ。行き先は地方をまたぐ = data だけ）
//   q_kasim_indigo   藍染めのライラ → 森の村ユールの母へ藍の布（地方をまたぐ依頼。ユールに人を 1 人足す）→ u_caravan_scarf
//   占い（まだ聞いていないうわさを 1 つ）・市場の屋台の値切り（R.Mini.timing。勝つと屋台が 15% 安い）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const objAt = (ctx, type, event) => { const m = R.DB.maps[ctx && ctx.map]; return m && (m.objects || []).find((o) => o.type === type && (!event || o.event === event) && o.x === ctx.x && o.y === ctx.y); };

  // 依頼の lead（side）とユールへの品
  R.def('leads', 'q_kasim_indigo', { kind: 'side', region: 'r_desert', title: '藍の布を母へ', from: '藍染めのライラ', place: 'yura', dir: '北の森',
    text: 'カシムの藍染め職人ライラから、\n森の村ユールの母へ、藍の布を\n届けてほしいと頼まれた。', done: 'desert_indigo_done' });
  R.def('items', 'k_desert_indigo', { name: '藍の布', slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', icon: 'bag', sort: 9420,
    desc: 'ライラが染めた藍の布。\n森の村ユールの母に届ける。' });
  // ユールの村に、ライラの母を足す（地方をまたぐ依頼。村のファイルは編集しない）
  R.onData(function () {
    const m = R.DB.maps.yura;
    if (m && !(m.npcs || []).some((n) => n.id === 'laila_mother')) {
      m.npcs.push({ id: 'laila_mother', look: 'npc_old_f_2', name: '藍染めのばあさま', x: 3, y: 16, dir: 's', move: 'still', talk: 'desert_yura_mother', reward: 'side', key: 'yura_laila_mother', cond: 'yura_dyer_asked' });
    }
  });

  // ---------------------------------------------------------------- ナディアの足鈴
  E('kasim_nadia', async (ev) => {
    if (cleared(ev)) {
      if (!ev.flag('desert_nadia_letter')) {
        ev.setFlag('desert_nadia_letter');
        await ev.say('nadia', ['王さまの歌、書き写したの。\nあなたにも一枚あげる。', 'こんどは名前を忘れないように。\n書いて、歌って、また書くの。']);
        await ev.letter('letter_desert_nadia');
        return;
      }
      await ev.say('nadia', T(ev) >= 3 ? 'ほかの町にも、名の抜けた歌が\nあるのかしら。……わたし、\nいつか聞きに行きたいな。' : '「その名はハザル、日輪の友」\nふふ、何回歌っても、\n胸がすうっとするの。');
      return;
    }
    if (!ev.flag('desert_nadia_met')) {
      ev.setFlag('desert_nadia_met');
      await ev.say('nadia', ['わたしはナディア。踊り子よ。\n毎晩、広場で王さまの歌を\n歌って踊るの。聞いて。']);
      ev.sfx('bell');
      await ev.caption(X().SONG_BLANK, { ms: 4200 });
      await ev.say('nadia', ['……名前の所だけ、\nどうしても歌えないの。\n母さんも、おばあちゃんも。', '王さまの名前、王墓の石に\n刻まれてたって聞いたわ。\n誰も、読みに行けないけど。']);
      ev.lead('l_desert_song');
    }
    if (ev.flag('desert_anklet_done')) { await ev.say('nadia', '足鈴、ありがとう！\n踊るたびに、しゃらりって\n鳴るの。聞こえる？'); return; }
    if (ev.has('k_desert_anklet')) {
      await ev.say('nadia', ['わたしの足鈴！\n見つけてくれたの！？']);
      ev.take('k_desert_anklet', 1);
      await ev.say('nadia', ['これ、もう片方。\nおそろいで持っていて。', '走るときに鳴らすと、\n足が軽くなるのよ。']);
      ev.item('u_nadia_bell', 1);
      ev.setFlag('desert_anklet_done');
      ev.leadDone('q_kasim_anklet');
      return;
    }
    if (!ev.flag('desert_anklet_asked')) {
      ev.setFlag('desert_anklet_asked');
      await ev.say('nadia', ['それとね……困ってるの。\n銀の足鈴を、片方\n失くしちゃって。', '市場の子が拾ったのを\n見た人がいるの。でも、\nただじゃ返してくれないみたい。']);
      ev.lead('q_kasim_anklet');
      return;
    }
    await ev.say('nadia', '足鈴、市場の子が持ってるはず。\nあの子、甘いものに目がないのよ。');
  }, { meta: { needs: [], gives: ['lead:l_desert_song', 'lead:q_kasim_anklet', 'flag:desert_anklet_done', 'item:u_nadia_bell'] } });
  const T = () => X().tier();

  E('kasim_child', async (ev) => {
    if (ev.flag('desert_anklet_done') || ev.flag('desert_anklet_traded')) { await ev.say('child_dates', cleared(ev) ? '泉で、ナディアが踊ってたよ！\n足鈴、ちゃんと鳴ってた！' : 'なつめやし、おいしかった！\nまた持ってきてね。'); return; }
    if (!ev.flag('desert_anklet_asked')) { await ev.say('child_dates', 'しゃらしゃら鳴る、\nきれいな鈴を拾ったんだ。\n……あげないよ！'); return; }
    if (ev.has('k_desert_dates')) {
      await ev.say('child_dates', 'わあ、なつめやし！\n……しかたないなあ。\n鈴と取り替えてあげる。');
      ev.take('k_desert_dates', 1);
      ev.item('k_desert_anklet', 1);
      ev.setFlag('desert_anklet_traded');
      return;
    }
    await ev.say('child_dates', ['この鈴？　ナディアのだって\n知ってるよ。', 'でも、ただじゃ返さない。\nなつめやしと取り替えなら、\nいいよ！']);
  }, { meta: { needs: ['flag:desert_anklet_asked'], gives: ['item:k_desert_anklet', 'flag:desert_anklet_traded'] } });

  E('kasim_dates', async (ev) => {
    const price = 40;
    await ev.say('dates_vendor', cleared(ev) ? '泉が戻って、なつめやしの木も\n元気になるよ。' : 'なつめやしだよ。\n干したのは、甘くて日持ちがする。');
    if (ev.has('k_desert_dates')) return;
    const i = await ev.choose([`買う（${price} G）`, 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say('dates_vendor', 'お金が足りないねえ。'); return; }
    ev.gold(-price);
    ev.item('k_desert_dates', 1);
    await ev.say('dates_vendor', 'まいど。市場の子どもらの\n大好物さ。');
  }, { meta: { needs: [], gives: ['item:k_desert_dates'] } });

  // ---------------------------------------------------------------- 井戸掘りの手伝い
  E('kasim_digger', async (ev) => {
    if (ev.flag('desert_dig_done')) { await ev.say('digger', cleared(ev) ? '町の泉が戻った。わしの掘った\n泉も、少しは役に立ったかのう。' : 'あの小さな泉、旅の者の\nいい休み場になっとるそうじゃ。'); return; }
    if (ev.flag('desert_dig_found')) {
      await ev.say('digger', ['水が出たか！　よくやった！', '小さな泉じゃが、町の外で\n休める所ができた。\nこれは礼じゃ。持っていけ。']);
      ev.take('k_desert_shovel', 1);
      ev.item('u_well_charm', 1);
      ev.setFlag('desert_dig_done');
      ev.leadDone('q_kasim_dig');
      return;
    }
    if (ev.flag('desert_dig_asked')) { await ev.say('digger', '町の南の砂地に、砂の盛り上がりが\n三つある。そこを掘ってくれ。\n水の上の砂は、少し冷たい。'); return; }
    await ev.say('digger', ['わしは井戸掘りのオマル。\n町の井戸も泉も細る一方で、\n新しい水脈を探しとる。', 'じゃが、この腰でな……。\n町の南の砂地を、三か所\n掘ってみてくれんか。']);
    const i = await ev.choose(['引き受ける', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('desert_dig_asked');
    ev.item('k_desert_shovel', 1);
    ev.lead('q_kasim_dig');
    await ev.say('digger', '頼んだぞ。このすきを貸そう。\n南の門……いや、西の門を出て\n南へ回った砂地じゃ。');
  }, { meta: { needs: [], gives: ['lead:q_kasim_dig', 'item:k_desert_shovel', 'flag:desert_dig_asked', 'flag:desert_dig_done', 'item:u_well_charm'] } });

  E('desert_dig', async (ev, ctx) => {
    const o = objAt(ctx, 'examine', 'desert_dig');
    const n = (o && o.dig) || 1;
    if (!ev.has('k_desert_shovel') && !ev.flag('desert_dig_done')) { await ev.say(null, '砂が小さく盛り上がっている。\n手で掘るには、固すぎる。'); return; }
    if (ev.flag('desert_dig_' + n)) { await ev.say(null, n === 2 ? '掘った穴から、水が\nこんこんと湧いている。' : 'もう掘った跡だ。'); return; }
    ev.setFlag('desert_dig_' + n);
    ev.sfx('hit');
    if (n === 2) {
      await ev.say(null, ['すきを入れると、砂が\nひんやりと湿っていた。', '掘り進めると……\n水が、ぷくりと湧き出した！']);
      ev.setFlag('desert_dig_found');
      ev.sfx('spring');
      await ev.caption('小さな泉ができた。\nオマルに知らせよう。', { ms: 1800 });
      return;
    }
    if (n === 3) { await ev.say(null, ['乾いた砂ばかりだ。', '……底から、古い銅貨が\n何枚か出てきた。']); ev.gold(X().gold(60)); return; }
    await ev.say(null, '乾いた砂ばかりだ。\n水の気配はない。');
  }, { meta: { needs: ['item:k_desert_shovel'], gives: ['flag:desert_dig_found', 'flag:desert_dig_1', 'flag:desert_dig_2', 'flag:desert_dig_3'] } });

  // ---------------------------------------------------------------- 迷子のラクダ
  E('kasim_guild_clerk', async (ev) => {
    if (ev.flag('desert_camel_done')) { await ev.say('guild_clerk', cleared(ev) ? '隊商路が戻って、帳面が\n追いつかないくらいです。' : 'ラクダは元気にしてますよ。\nありがとうございました。'); return; }
    if (ev.flag('desert_camel_found')) {
      if (ev.flag('desert_camel_guest')) { ev.guest(null); ev.setFlag('desert_camel_guest', false); }
      await ev.say('guild_clerk', ['ラクダを連れ帰ってくれたんですね！\nこの子、焼き印を見るまで\n動かないって頑固で……。', 'これはギルドからのお礼です。']);
      ev.gold(X().gold(150));
      X().small(ev, [['i_ether', 1], ['i_ether', 2], ['i_ether', 2], ['i_ether2', 1], ['i_ether2', 2]]);
      ev.setFlag('desert_camel_done');
      ev.leadDone('q_kasim_camel');
      return;
    }
    if (ev.flag('desert_camel_asked')) { await ev.say('guild_clerk', 'ラクダは南東の砂丘あたりで\n見かけたそうです。\nギルドの焼き印があります。'); return; }
    await ev.say('guild_clerk', ['隊商ギルドの帳場です。\n……困ったことに、ギルドの\nラクダが一頭、迷子で。', '南東の砂丘で見たという話が\nあるんです。連れ帰って\nいただけませんか？']);
    ev.setFlag('desert_camel_asked');
    ev.item('k_desert_camel_rope', 1);
    ev.lead('q_kasim_camel');
  }, { meta: { needs: [], gives: ['lead:q_kasim_camel', 'flag:desert_camel_asked', 'flag:desert_camel_done'] } });

  E('desert_camel_world', async (ev) => {
    if (ev.flag('desert_camel_found')) return;
    await ev.say(null, ['ギルドの焼き印のラクダだ。\n砂丘のかげで、のんびり\n草をかんでいる。', '手綱を見せると、ラクダは\n鼻を鳴らして立ち上がった。']);
    ev.take('k_desert_camel_rope', 1);
    ev.setFlag('desert_camel_found');
    if (ev.flag('desert_caravan_on')) {
      await ev.caption('ラクダは、隊の列の\n最後にくっついた。', { ms: 1800 });
    } else {
      ev.guest('ani_camel');
      ev.setFlag('desert_camel_guest');
      await ev.caption('ラクダがついてきた。\nカシムの隊商ギルドへ連れ帰ろう。', { ms: 1800 });
    }
  }, { meta: { needs: ['flag:desert_camel_asked'], gives: ['flag:desert_camel_found'] } });

  // ---------------------------------------------------------------- 隊商路ののろし（灯りを守る）
  E('kasim_tadeo', async (ev) => {
    if (ev.flag('desert_beacons_done')) { await ev.say('tadeo', cleared(ev) ? 'のろしを目印に、荷車が夜も\n走ってる。組合の者として、\nこんなにうれしいことはない。' : 'のろしが戻った。灯守組合の\n者として、礼を言うよ。'); return; }
    const n = ev.var('desert_beacons');
    if (n >= 3) {
      await ev.say('tadeo', ['三つとも火が戻ったか！\n隊商路が、夜でも見える。', 'これは組合からの礼だ。\nのろしの火を映す鏡さ。']);
      ev.item('u_signal_mirror', 1);
      ev.setFlag('desert_beacons_done');
      ev.leadDone('q_kasim_beacons');
      return;
    }
    if (ev.flag('desert_beacons_asked')) { await ev.say('tadeo', `のろし台は、隊商路ぞいに三つ。\nあと ${3 - n} つだ。油のつぼを\n台の火皿に注いでくれ。`); return; }
    await ev.say('tadeo', ['やあ、港で会ったかな。\n灯守組合のタデオだ。\n油を売りに、ここまで来た。', '隊商路ののろし台が、三つとも\n消えてしまってね。油が\n届かなかったんだ。', 'この黒い泉の油を、\n台に注いでくれないか。\n隊商路ぞいに三つある。']);
    ev.setFlag('desert_beacons_asked');
    ev.item('k_desert_oil', 1);
    ev.lead('q_kasim_beacons');
  }, { meta: { needs: [], gives: ['lead:q_kasim_beacons', 'item:k_desert_oil', 'flag:desert_beacons_asked', 'flag:desert_beacons_done', 'item:u_signal_mirror'] } });

  E('desert_beacon', async (ev, ctx) => {
    const o = objAt(ctx, 'waylamp');
    const m = o && /^wl_desert_beacon_(\d)$/.exec(o.id || '');
    if (!m) { await ev.say(null, 'のろし台だ。'); return; }
    const key = 'q_kasim_beacon_' + m[1];
    if (ev.flag(key)) { await ev.say(null, 'のろし台の火皿で、黒い油が\nあかあかと燃えている。'); return; }
    if (!ev.has('k_desert_oil')) { await ev.say(null, ['石を積んだのろし台だ。\n火皿は空で、すすけている。', '……油があれば、また\n火がともせそうだ。']); return; }
    await ev.say(null, '火皿に、黒い泉の油を注いで\n火をともした。');
    ev.sfx('lamp');
    ev.setFlag(key);
    const n = ev.addVar('desert_beacons', 1);
    await ev.caption(`のろしが燃えあがった。（${n}/3）`, { ms: 1600 });
    if (n >= 3) { ev.take('k_desert_oil', 1); await ev.caption('油のつぼが空になった。\nタデオに知らせよう。', { ms: 1600 }); }
  }, { meta: { needs: ['item:k_desert_oil'], gives: ['var:desert_beacons+1', 'flag:q_kasim_beacon_1', 'flag:q_kasim_beacon_2', 'flag:q_kasim_beacon_3'] } });

  // ---------------------------------------------------------------- 塩の包み（砂の縁のロッタへ）
  E('kasim_salt', async (ev) => {
    if (ev.flag('desert_salt_done')) { await ev.say('salt_vendor', 'ロッタの籠、また品が増えたろう？\nあいつは商売がうまい。'); return; }
    if (ev.flag('desert_salt_delivered')) {
      await ev.say('salt_vendor', ['届けてくれたか！\nロッタから、礼の品と\nことづてを預かった……いや、', 'あいつの字だと読めないな。\nまあいい、これは駄賃だ。']);
      ev.gold(X().gold(120));
      ev.setFlag('desert_salt_done');
      ev.leadDone('q_kasim_salt');
      return;
    }
    if (ev.flag('desert_salt_asked')) { await ev.say('salt_vendor', '宿場「砂の縁」は、町の北、\n森へ向かう街道の途中だ。\nロッタは中庭の東にいる。'); return; }
    await ev.say('salt_vendor', ['塩売りのカリムだ。\n南の浜の白い塩さ。', '頼みがある。宿場「砂の縁」の\n行商人ロッタに、この塩の包みを\n届けてくれないか。']);
    const i = await ev.choose(['引き受ける', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('desert_salt_asked');
    ev.item('k_desert_salt', 1);
    ev.lead('q_kasim_salt');
  }, { meta: { needs: [], gives: ['lead:q_kasim_salt', 'item:k_desert_salt', 'flag:desert_salt_asked', 'flag:desert_salt_done'] } });

  E('sandedge_lotta', async (ev) => {
    if (ev.has('k_desert_salt')) {
      await ev.say('lotta', ['カリムの塩！　待ってたのよ。\n森の村で、いい値で売れるの。', 'お礼に、籠の品を増やしておくわ。\n見ていって。']);
      ev.take('k_desert_salt', 1);
      ev.setFlag('desert_salt_delivered');
      ev.addVar('desert_lotta', 1);
    } else if (!ev.flag('desert_lotta_met')) {
      ev.setFlag('desert_lotta_met');
      await ev.say('lotta', ['行商人のロッタよ。\n森と砂漠と灰の街道を、\n籠ひとつで回ってるの。', '珍しい物が好き？\nなら、見ていって。']);
    } else {
      await ev.say('lotta', cleared(ev) ? 'カシムの泉が戻ったって！\n砂漠の塩、また高く売れるわ。' : 'いらっしゃい。今日は何を？');
    }
    await ev.shop('shop_lotta');
  }, { meta: { needs: [], gives: ['flag:desert_salt_delivered', 'var:desert_lotta+1'] } });

  // ---------------------------------------------------------------- 地図屋のヤズ（宝の地図）
  const MAPS = [
    { id: 'k_tmap_3', lead: 'l_tmap_3', tier: 1, price: 600, pitch: '灰の荒野の地図だ。\n折れた剣の碑の下の段に、\n封じの扉があるという。' },
    { id: 'k_tmap_5', lead: 'l_tmap_5', tier: 3, price: 1500, pitch: '西の海の霧の地図だ。\n百の帆柱が立つ船の墓場。\n……船が要るな。' },
    { id: 'k_tmap_6', lead: 'l_tmap_6', tier: 5, price: 3000, pitch: 'にじんで読めない地図だ。\n星のかけらがあれば読める、と\n前の持ち主は言っていた。' },
  ];
  E('kasim_mapmaker', async (ev) => {
    ev.lead('q_kasim_maps');
    const t = T();
    const can = MAPS.filter((m) => t >= m.tier && !ev.has(m.id));
    if (!can.length) {
      const next = MAPS.find((m) => t < m.tier && !ev.has(m.id));
      await ev.say('mapmaker', next ? ['地図屋のヤズだ。\n古い宝の地図を集めとる。', '今、読める地図は無いな。\n……灯が戻るたびに、\nにじんだ線が読めるようになる。'] : '売れる地図は、もう無いよ。\nあんたが全部持っていった。');
      return;
    }
    const m = can[0];
    await ev.say('mapmaker', ['地図屋のヤズだ。\n古い宝の地図を集めとる。', m.pitch]);
    const i = await ev.choose([`買う（${m.price} G）`, 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < m.price) { await ev.say('mapmaker', 'お金が足りんな。\n地図は逃げんよ。'); return; }
    ev.gold(-m.price);
    ev.item(m.id, 1);
    ev.lead(m.lead);
    await ev.say('mapmaker', '毎度。地図の行き先は、\nまだ誰も行ったことのない所だ。\n……いつか、行けるといいな。');
  }, { meta: { needs: [], gives: ['lead:q_kasim_maps', 'item:k_tmap_3', 'item:k_tmap_5', 'item:k_tmap_6', 'lead:l_tmap_3', 'lead:l_tmap_5', 'lead:l_tmap_6'] } });
  E('kasim_mapshop_wall', async (ev) => {
    await ev.say(null, ['壁いっぱいの、砂漠の地図だ。', '北に宿場「砂の縁」と岩場。\n西に岩の台地。南西に隊商路と\n三つの野営地。', '南の浜のあたりに、\n小さく「柱？」と書き込みがある。']);
  });

  // ---------------------------------------------------------------- 占い（まだ聞いていないうわさを 1 つ）
  const FORTUNE = [
    ['l_opt_mirage', '消灯の刻に、砂の真ん中に\n灯りの列が見える……。\n宿で、消灯の刻まで休むといい。'],
    ['l_opt_temple', '南の浜……満月の晩に、\n砂から柱が立ちあがる。\n三度の消灯の刻ののちに。'],
    ['l_opt_rocks', '北の岩場で、虹色の光……。\n逃げる光は、盗むがよい。'],
    ['l_opt_hawknest', '西の岩の台地から、鷹の笛……。\n台地の南の洞に、何かがある。'],
    ['l_opt_sandedge', '北の街道のまん中に、灯り……。\n甘い水の宿がある。'],
  ];
  E('kasim_fortune', async (ev) => {
    const price = X().gold(50);
    await ev.say('fortune', ['……ようこそ。\n砂に映る、先の道を\n占ってしんぜよう。']);
    const i = await ev.choose([`占ってもらう（${price} G）`, 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say('fortune', '……お代が足りぬようじゃ。'); return; }
    const f = FORTUNE.find(([id]) => !((R.Game.leads && R.Game.leads[id]) || ev.flag('desert_fortune_' + id)));
    if (!f) { await ev.say('fortune', ['……砂は、もう何も語らぬ。\nおまえは、この砂漠のことを\nよう知っておる。', 'お代は、いらぬよ。']); return; }
    ev.gold(-price);
    ev.sfx('magic');
    await ev.say('fortune', f[1]);
    ev.setFlag('desert_fortune_' + f[0]);
    ev.lead(f[0]);
  }, { meta: { needs: [], gives: ['lead:l_opt_mirage', 'lead:l_opt_temple', 'lead:l_opt_rocks', 'lead:l_opt_hawknest', 'lead:l_opt_sandedge'] } });

  // ---------------------------------------------------------------- 市場の屋台（値切り）
  E('kasim_bazaar', async (ev) => {
    await ev.say('bazaar', cleared(ev) ? 'いらっしゃい！　泉のお祝いで、\n今日は気前がいいよ。' : 'いらっしゃい。石もお守りも\nそろってるよ。');
    const opts = ev.flag('desert_haggled') ? ['見る', 'やめておく'] : ['見る', '値切る', 'やめておく'];
    const i = await ev.choose(opts, { cancel: opts.length - 1 });
    if (opts[i] === 'やめておく') return;
    if (opts[i] === '値切る') {
      await ev.say('bazaar', 'ほう、値切ろうってのかい。\nあたしの目を見て、\nいい所で手を打ちな！');
      const r = await ev.mini.timing({ title: '値切り', tries: 3, speed: 1300, zones: [[0.4, 0.56]] });
      if (r && r.hits >= 2) {
        ev.setFlag('desert_haggled');
        await ev.say('bazaar', 'まいった、まいった！\nあんたには、ずっと\n一割五分引きだよ。');
      } else {
        await ev.say('bazaar', 'あはは、まだまだだね。\nまた挑んでおいで。');
      }
    }
    await ev.shop('shop_kasim_bazaar');
  }, { meta: { needs: [], gives: ['flag:desert_haggled'] } });

  // ---------------------------------------------------------------- 藍の布（ユールへ）
  E('kasim_yura_dyer', async (ev) => {
    if (ev.flag('desert_indigo_done')) { await ev.say('yura_returnee', '母さんの手紙、毎晩読んでるの。\n「森の蛍も戻った」って。'); return; }
    if (ev.flag('yura_dyer_home')) {
      await ev.say('yura_returnee', ['母さんに会えたのね！\n……元気だった？\nよかった……。', 'お礼に、わたしの染めた\n頭布をあげる。砂よけになるわ。']);
      ev.item('u_caravan_scarf', 1);
      ev.setFlag('desert_indigo_done');
      ev.leadDone('q_kasim_indigo');
      return;
    }
    if (ev.flag('yura_dyer_asked')) { await ev.say('yura_returnee', '母さんは、森の村ユールの\n西の家にいるわ。藍の布、\nよろしくね。'); return; }
    await ev.say('yura_returnee', ['わたしはライラ。森の村ユールから\n藍染めの修業に来たの。', '母さんに、わたしの染めた布を\n届けたいの。泉の水で染めた、\n最後の布かもしれないから。']);
    const i = await ev.choose(['引き受ける', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('yura_dyer_asked');
    ev.item('k_desert_indigo', 1);
    ev.lead('q_kasim_indigo');
  }, { meta: { needs: [], gives: ['lead:q_kasim_indigo', 'item:k_desert_indigo', 'flag:yura_dyer_asked', 'flag:desert_indigo_done', 'item:u_caravan_scarf'] } });

  E('desert_yura_mother', async (ev) => {
    if (ev.flag('yura_dyer_home')) { await ev.say('laila_mother', 'ライラは、元気でやってるかねえ。\n……あの子の藍は、空の色だよ。'); return; }
    if (!ev.has('k_desert_indigo')) { await ev.say('laila_mother', '娘が砂漠の町へ修業に行ってね。\n便りが、なかなか来ないのさ。'); return; }
    await ev.say(null, '{hero}は、ライラの藍の布を渡した。');
    ev.take('k_desert_indigo', 1);
    await ev.say('laila_mother', ['まあ……ライラの藍だ。\nこんなに深い色が、\n出せるようになったんだね。', 'ありがとう。娘に伝えておくれ。\n母さんは元気だよ、って。']);
    ev.setFlag('yura_dyer_home');
  }, { meta: { needs: ['item:k_desert_indigo'], gives: ['flag:yura_dyer_home'] } });
})(window.RPG);
