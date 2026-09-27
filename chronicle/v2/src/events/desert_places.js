// CONTENT（砂漠）: ワールドの砂漠と寄り道の場所のイベント（WORLD_REDESIGN §2.7 #6〜#10、§4.2）。
//   ワールド: 夜明け待ちの巡礼・油運び・しんきろうの市の平地（昼）・沈んだ柱の浜
//   宿場「砂の縁」: 宿・売り台・うまや（解決の後は隊商路の荷車でカシムへ）・森と灰から来た旅人
//   しんきろうの市（消灯の刻だけ）: 一品物の 3 人の売り手（ティアで入れ替わる）・古老・踊り子
//   砂の鷹団のアジト: 選択 ch_desert_hawk で敵・味方・中立。頭との再戦 tr_b_hawkhold（敵のとき）→ 鷹の手袋
//   金剛トカゲの岩場・古い野営跡・井戸の小屋・砂に沈んだ神殿（日輪の盤・黄金の守護像たち → 日輪の杖）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const X = () => R.Desert.ev;
  const cleared = (ev) => ev.flag('cleared_r_desert');
  const T = () => X().tier();

  // ================================================================ ワールド
  E('desert_world_pilgrim', async (ev) => {
    if (cleared(ev)) { await ev.say('pilgrim', ['カシムの方の空が、\nほんのり金色じゃ。', 'わしが待っとる「夜明け」とは、\nあんな色かのう。']); return; }
    await ev.say('pilgrim', ['わしは「夜明け」を待っとる巡礼じゃ。\n祖母の祖母が、そう言うておった。', '夜明けが何かは、知らん。\n……じゃが、待つことは\n忘れんようにしとる。']);
    if (!ev.flag('desert_pilgrim_gift')) { ev.setFlag('desert_pilgrim_gift'); await ev.say('pilgrim', '旅の者、これをお持ち。\n砂漠の夜は冷える。'); X().small(ev, [['i_salve', 2], ['i_potion', 1], ['i_potion', 2], ['i_ether', 1], ['i_ether', 2]]); }
  });
  E('desert_world_oil', async (ev) => {
    if (ev.flag('desert_beacons_done')) { await ev.say('oil_caravan', 'のろしが戻って、夜道が楽になった。\n組合のタデオさんに、よろしくな。'); return; }
    await ev.say('oil_caravan', ['黒い泉の油を運んでるんだ。\n灰の荒野の峠が崩れて、\nカシムで足止めさ。', '隊商路ののろし台が、三つとも\n消えてるのを見たかい？\n組合のタデオさんが困ってたよ。']);
  });
  E('desert_mirage_empty', async (ev) => {
    await ev.say(null, ev.flag('desert_mirage_seen') ? ['昼の砂の平地だ。\n市の跡は、何も残っていない。', '砂の上に、ラクダの足あとが\nいくつか……途中で消えている。'] : ['砂の真ん中の、平たい所だ。\n何もない。', '……消灯の刻に、ここで灯りが\n揺れるという話を聞いた。']);
  });
  E('desert_temple_sand', async (ev) => {
    const n = ev.var('desert_nights');
    await ev.say(null, ['砂から、見たことのない\n柱の先が突き出ている。', n > 0 ? `砂が、少しずつ引いている。\n……満月の晩なら、入口が\n見えるかもしれない。（消灯の刻 ${n}/3）` : '柱のまわりの砂は固く、\n入口らしいものは見えない。']);
  });

  // ================================================================ 宿場「砂の縁」
  E('sandedge_arrive', async (ev) => {
    if (ev.flag('desert_sandedge_seen')) return;
    ev.setFlag('desert_sandedge_seen');
    await ev.caption('宿場「砂の縁」。\n森の終わりに立つ、石になった\n大樹の根もとの隊商宿。', { ms: 2400 });
  });
  E('sandedge_notice', async (ev) => {
    await ev.say(null, ['宿場の掲示だ。', '「東の峠、灰の崩れにより不通。\n灰の荒野へ向かう者は\n片づくまで待たれよ」', T() >= 2 ? '「北の雪原へ向かう者、\n防寒の備えを忘れるな」' : '「カシムの泉、細る。\n水は宿場で足していかれよ」']);
  });
  E('sandedge_innkeeper', async (ev) => {
    await ev.say('keeper', '砂の縁の宿へようこそ。\n井戸の水が甘いのが自慢さ。');
    const i = await ev.choose(['泊まる', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    const ok = await ev.inn();
    if (ok) ev.setFlag('desert_night', false);
  }, { meta: { needs: [], gives: [] } });
  E('sandedge_shop', async (ev) => {
    await ev.say('stall', '売り台だ。街道の旅に\n要る物は、ひととおり。');
    await ev.shop('shop_sandedge');
  });
  E('sandedge_stable', async (ev) => {
    if (ev.flag('desert_cart')) {
      await ev.say('stable', 'カシムへ荷車が出るよ。\n乗っていく？');
      const i = await ev.choose(['乗る（カシムへ）', 'やめておく'], { cancel: 1 });
      if (i !== 0) return;
      await ev.fade('out', 400);
      await ev.warp('kasim', 'warp');
      await ev.fade('in', 400);
      await ev.caption('荷車にゆられて、ひと晩。\nオアシスの町カシムに着いた。', { ms: 1800 });
      return;
    }
    await ev.say('stable', ['ラクダの世話係だよ。\n隊商が出ないから、ラクダも\n退屈してるんだ。', 'カシムまで、昔は荷車が\n毎晩走ってたのに。']);
  });
  E('sandedge_forest_traveler', async (ev) => {
    await ev.say('forest_trav', ev.flag('cleared_r_forest') ? ['森から来た。千年樹のこずえが\n光ってから、森の道で\n迷う者がいなくなったよ。', '砂漠の塩と森の樹脂を\n取り替えに来たんだ。'] : ['北の森を抜けてきた。\n……森の中で、何度も\n同じ所に戻ってしまってね。', 'フェルンの村では、きこりが\n帰らないと騒いでたよ。']);
  });
  E('sandedge_ash_traveler', async (ev) => {
    await ev.say('ash_trav', ['灰の荒野から、崩れる前の峠を\n最後に越えてきた兵だ。', 'カルデラでは、火の鳥の卵が\n冷えていくのを止めるために、\n族長が闘技大会を開くそうだ。']);
    ev.lead('l_rumor_ash');
  }, { meta: { needs: [], gives: ['lead:l_rumor_ash'] } });
  E('sandedge_well_girl', async (ev) => {
    await ev.say('well_girl', cleared(ev) ? '井戸の水、前より冷たくて\n甘くなったの！　カシムの泉と、\nつながってるのかな。' : ['この井戸の水はね、\nどんなに疲れてても\n一杯で元気になるの。', 'ほんとだよ。飲んでみて！\n（井戸は回復の泉だ）']);
  });
  E('sandedge_rumor', async (ev) => {
    await ev.say('drinker', ['隊商のサドだ。\n消灯の刻の砂漠を歩いてたら、\n砂の真ん中に市が立っててよ。', '近づいたら、消えちまった。\n……カシムの宿で、消灯の刻まで\n休んでみな。見えるかもしれねえ。']);
    ev.lead('l_opt_mirage');
  }, { meta: { needs: [], gives: ['lead:l_opt_mirage'] } });
  E('sandedge_bard', async (ev) => {
    await ev.say('bard', T() >= 2 ? ['港の灯台、森の千年樹……\n灯がひとつ戻るたびに、\n歌がひとつ増える。', '次は、どこの歌だろうね。'] : ['街道の歌を集めてるんだ。\n森と砂漠と灰の街道の歌。', '……どの歌も、どこかが\n抜けてるんだよね。ふしぎだろう？']);
  });

  // ================================================================ しんきろうの市
  E('desert_mirage_arrive', async (ev) => {
    const first = !ev.flag('desert_mirage_seen');
    ev.setFlag('desert_mirage_seen');
    ev.setFlag('desert_night', false);   // その晩の市は一度きり
    if (first) await ev.caption('砂の上に、灯りの列と\n市のにぎわいが揺れている。\n……人の声が、少し遠い。', { ms: 2600 });
  }, { meta: { needs: ['flag:desert_night'], gives: ['flag:desert_mirage_seen'] } });
  const MIRAGE_PRICE = (t) => 500 + t * 350;
  E('desert_mirage_seller', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'm_seller_a';
    const k = { m_seller_a: 0, m_seller_b: 1, m_seller_c: 2 }[id] || 0;
    const data = R.DesertData && R.DesertData.mirage;
    const list = data ? (T() >= 3 ? data.high : data.low) : [];
    const item = list[k];
    if (!item || !R.DB.items[item]) { await ev.say(id, '……今夜は、売る物がない。'); return; }
    if (ev.has(item)) { await ev.say(id, '……その品は、もうおまえの物だ。\n砂の上の市は、同じ物を\n二度は売らぬ。'); return; }
    const price = MIRAGE_PRICE(T());
    await ev.say(id, [`……これは「${R.DB.items[item].name}」。`, R.DB.items[item].desc || '']);
    const i = await ev.choose([`買う（${price} G）`, 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    if (ev.gold(0) < price) { await ev.say(id, '……砂金が足りぬ。'); return; }
    ev.gold(-price);
    ev.item(item, 1);
    await ev.say(id, '……灯が戻れば、市の品も変わる。\nまた、消灯の刻においで。');
  }, { meta: { needs: ['flag:desert_mirage_seen'], gives: ['item:u_mirage_lamp|u_mirage_veil|u_mirage_dagger|u_mirage_harp|u_mirage_boots|u_mirage_bow'] } });
  E('desert_mirage_elder', async (ev) => {
    await ev.say('m_old', ['この市はな、ハザル王の時代の市じゃ。\n王が水を招いた年、砂漠じゅうの\n隊商がここに集まった。', '砂は、そのにぎわいを覚えておる。\n消灯の刻になると、思い出すのよ。', cleared(ev) ? '……王の名が戻って、砂も\nうれしそうじゃ。' : '……王の名を、誰も呼ばんように\nなってから、市も薄くなった。']);
  });
  E('desert_mirage_child', async (ev) => {
    await ev.say('m_child', ['おにいさん、どこから来たの？\nぼく、ずっとここにいるよ。', 'お日さまって、見たことある？\nぼく、あるよ。……たぶん。']);
  });
  E('desert_mirage_dancer', async (ev) => {
    await ev.say('m_dancer', cleared(ev) ? ['「その名はハザル、日輪の友」\nあら、あなたもこの歌を\n知っているの？'] : ['「砂の海に、水を招いた王よ」\n……名前？　ふふ、', '名前は、呼ぶ人がいなくなると\n砂に溶けてしまうのよ。']);
  });
  E('desert_mirage_obelisk', async (ev) => {
    await ev.say(null, ['市の北の端の、石の柱だ。\n「隊商の市・日輪の王の御代に」', '柱の影が、砂の上に\nくっきり落ちている。\n……灯りは、柱の前にしかないのに。']);
  });

  // ================================================================ 砂の鷹団のアジト
  E('desert_hawks_arrive', async (ev) => {
    if (!ev.flag('desert_hawk_met')) return;
    const c = X().hawk(ev);
    if (!ev.flag('desert_hawks_seen')) {
      ev.setFlag('desert_hawks_seen');
      await ev.caption(c === 'fight' ? '洞の奥から、鷹の笛が鳴った。\n……見張りに見つかった！' : c === 'water' ? '洞の見張りが、手を上げた。\n「頭の客だ。通れ」' : '洞の見張りが、じろりと見た。\n「払う物を払うなら、通れ」', { ms: 2200 });
    }
  });
  E('desert_hawks_sentry', async (ev) => {
    await ev.say('sentry', ['……止まれ。ここは砂の鷹の巣だ。\n見ない顔は通さねえ。', '頭に用があるなら、隊商路で\n会えるだろうよ。\n……水を運ぶ隊の後ろでな。']);
  });
  E('desert_hawks_member', async (ev, ctx) => {
    const id = (ctx && ctx.npc) || 'hawk_door';
    const c = X().hawk(ev);
    const pain = ev.choiceOf('ch_desert_write') === 'pain';
    const lines = {
      hawk_door: c === 'water' ? '頭の客人だ。ゆっくりしていけ。\n水は、分けてもらった分しか\n無いがな。' : '払った分は、通っていい。\n……変な気は起こすなよ。',
      hawk_cook: pain && cleared(ev) ? 'あんたが年代記に書いてくれた\nって聞いたよ。\n……ありがとうね。' : '洞には、子どもも年寄りもいる。\n水は、いつも足りないのさ。',
      hawk_guard_l: '頭は、二十年前の話をすると\n黙りこむ。……おれたちもだ。',
      hawk_guard_r: '町の者は、おれたちを\n盗賊と呼ぶ。……まあ、\nそのとおりだがな。',
    };
    await ev.say(id, lines[id] || '……ここは砂の鷹の巣だ。');
  });
  E('desert_hawks_old', async (ev) => {
    await ev.say('hawk_old', ['わしは、日輪同盟の古い兵じゃ。\n代理試合の夜のことは、\n今でも夢に見る。', '歌が聞こえた。敵の陣から。\n火の鳥の歌じゃった。……いや、\n誰の歌だったか、思い出せん。']);
    if (!ev.flag('desert_hawks_old_gift')) { ev.setFlag('desert_hawks_old_gift'); await ev.say('hawk_old', '古い兵の、お守りじゃ。\nわしには、もう要らん。'); X().small(ev, [['i_smoke', 2], ['i_smoke', 3], ['i_bomb', 1], ['i_bomb', 2], ['i_bomb', 2]]); }
  });
  E('desert_hawks_shop', async (ev) => {
    const c = X().hawk(ev);
    await ev.say('hawk_shop', c === 'pay' ? '闇市だ。……あんたは身内じゃ\nないんでね。値は五割増しだ。' : '闇市だ。頭の客なら、\n町の値で売ってやる。');
    await ev.shop('shop_hawks');
  });
  E('desert_hawks_water', async (ev) => {
    await ev.say(null, ['大きな水がめが並んでいる。\n隊商から奪った水だ。', X().hawk(ev) === 'water' ? '……分けてもらった水の印が、\n一つ一つ、壁に刻んである。' : '壁に、誰が何杯飲んだか、\n刻んで数えてある。']);
  });
  E('desert_hawks_bunks', async (ev) => {
    await ev.say(null, ['寝ぐらの壁に、子どもの\n落書きがある。', '鷹の絵と……丸い、大きな\n光る絵。「おひさま」と\n書いてある。']);
  });
  E('desert_hawks_memorial', async (ev) => {
    await ev.say(null, ['頭の広間の、新しい石の碑だ。\n「砂の鷹・日輪の兵」', '死んだ仲間の名が、\n一つ一つ、ていねいに\n彫ってある。']);
  });
  E('desert_hawks_map_table', async (ev) => {
    await ev.say(null, ['台の上に、砂漠の地図が\n広げてある。隊商路に\n印がいくつも。', '地図のすみに、灰の荒野の\n古戦場の絵がある。\n折れた剣の碑……？']);
  });
  E('desert_hawks_rashid', async (ev) => {
    const c = X().hawk(ev);
    if (c === 'fight' && !ev.flag('desert_hawkhold_done')) { await ev.call('desert_hawks_boss'); return; }
    if (c === 'fight') {
      await ev.say('rashid', ['……負けは負けだ。\nおれたちは、もう隊を襲わん。', '……年代記、とか言ったか。\nおれたちのことを書くなら、\n盗賊とでも書いておけ。']);
      return;
    }
    if (!ev.flag('desert_hawks_rashid_gift')) {
      ev.setFlag('desert_hawks_rashid_gift');
      if (c === 'water') {
        await ev.say('rashid', ['よく来たな。水の礼だ。\n受け取れ。', '一つは、おれの手袋。\n盗みのこつが染みついてる。', 'もう一つは、灰の古戦場の\n宝の地図だ。……おれには、\nあそこへ戻る足がない。']);
        ev.item('u_hawk_gloves', 1);
        if (!ev.has('k_tmap_3')) { ev.item('k_tmap_3', 1); ev.lead('l_tmap_3'); }
        return;
      }
      // pay: 中立。手袋は買う
      const price = X().gold(400);
      await ev.say('rashid', ['……払う物を払った客だ。\n話くらいは聞いてやる。', `おれの手袋が欲しいなら、\n${price} G だ。盗みのこつが\n染みついてる。`]);
      const i = await ev.choose([`買う（${price} G）`, 'やめておく'], { cancel: 1 });
      if (i !== 0 || ev.gold(0) < price) { ev.setFlag('desert_hawks_rashid_gift', false); if (i === 0) await ev.say('rashid', '……足りんな。出直してこい。'); return; }
      ev.gold(-price);
      ev.item('u_hawk_gloves', 1);
      await ev.say('rashid', '……商売成立だ。');
      return;
    }
    await ev.say('rashid', cleared(ev) ? ['泉が戻ったそうだな。\n……ハザル王、か。', '名を呼ばれて眠れる王が\nうらやましい。おれたちの戦には、\n名が無いからな。'] : ['王墓へ行くなら、王の間の手前で\n一度休め。あそこの王は、\n日と月の灯を従えてる。', '……おれの祖父は、王の火のために\n戦ったと言っていた。']);
  }, { meta: { needs: ['flag:desert_hawk_met'], gives: ['item:u_hawk_gloves', 'item:k_tmap_3', 'lead:l_tmap_3'] } });
  E('desert_hawks_boss', async (ev) => {
    if (ev.flag('desert_hawkhold_done')) return;
    ev.bgm('tension');
    try { await ev.npc('rashid').face('s'); } catch (e) { /* */ }
    await ev.say('rashid', ['……来たか。隊商の犬め。\nここは、おれたちの最後の巣だ。', '今度は、手加減せんぞ！']);
    const r = await ev.battle('tr_b_hawkhold', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_hawkhold_done');
    await ev.say('rashid', ['……まいった。\nおれたちの負けだ。', 'この手袋を持っていけ。\n……もう、盗みはやめる。\n洞の者を食わせる道を探すさ。']);
    ev.item('u_hawk_gloves', 1);
  }, { meta: { needs: ['flag:desert_hawk_met'], gives: ['flag:desert_hawkhold_done', 'item:u_hawk_gloves'] } });

  // ================================================================ 金剛トカゲの岩場
  E('desert_rocks_watcher', async (ev) => {
    await ev.say('watcher', ['わたしはトカゲを見る学者だ。\n金剛トカゲの研究をしている。', 'やつのうろこは、ダイヤより硬い。\n倒しても、うろこは砕けて\n手に入らんのだ。', 'だから、盗むしかない。\n……逃げ足が速いから、\n最初の一手が勝負だよ。']);
  });
  E('desert_rocks_scales', async (ev) => {
    await ev.say(null, ['岩のすきまに、虹色の\nうろこのかけらが落ちている。', '拾おうとすると、指の中で\n砂のように崩れた。']);
  });

  // ================================================================ 古い野営跡・井戸の小屋
  E('desert_oldcamp_arrive', async (ev) => {
    await ev.caption('砂嵐の岩陰に、古い野営の跡。\n天幕は破れ、荷は砂に\nうもれかけている。', { ms: 2400 });
  });
  E('desert_oldcamp_notes', async (ev) => {
    await ev.say(null, ['砂に刺さった板きれに、\n字が書いてある。', '「嵐の晩、王墓の方角に灯りの列。\n近づくと消えた。市の声がした」']);
    await X().lore(ev, 'lo_desert_camp_notes');
  }, { meta: { needs: [], gives: ['flag:lo_desert_camp_notes'] } });
  E('desert_wellroom_keeper', async (ev) => {
    if (ev.flag('desert_thirst')) {
      await ev.say('wellkeeper', 'おや、のどが渇いた顔だねえ。\nこの井戸の水をお飲み。');
      ev.setFlag('desert_thirst', false);
      ev.rest();
      await ev.caption('冷たい井戸の水で、\nのどの渇きがいえた。', { ms: 1600 });
      return;
    }
    await ev.say('wellkeeper', ['この井戸は、遠回りの隊の\n休み場さ。わたしは井戸守り。', '泉が細っても、この井戸だけは\n枯れない。ハザル王の井戸、\nって祖母は呼んでたよ。']);
  });
  E('desert_wellroom_journal', async (ev) => {
    await ev.say(null, ['井戸守りの帳面だ。\n休んでいった隊の名が並んでいる。', '二十年前の冬から、\n書き込みが急に減っている。']);
  });

  // ================================================================ 砂に沈んだ神殿
  E('desert_temple_arrive', async (ev) => {
    await ev.caption('砂の下に、神殿がまるごと\n眠っていた。柱に、日輪の紋が\n刻まれている。', { ms: 2400 });
  });
  E('desert_temple_door', async (ev) => {
    const n = ['desert_tp_disc_1', 'desert_tp_disc_2', 'desert_tp_disc_3'].filter((f) => ev.flag(f)).length;
    await ev.say(null, ['日輪の紋の、重い扉だ。\n丸い溝が三つある。', `光っている溝は ${n} つ。\n西と東の小部屋、北西の部屋に\n金の盤があった……。`]);
  });
  E('desert_temple_claim', async (ev) => {
    await ev.say(null, ['日継ぎの民の碑だ。', '「日輪の火は太陽のかけら。\n王、空より取りて泉に預く。\n我ら日を継ぐ者なり」']);
    if (T() >= 2) await ev.say(null, '……碑の裏に、小さな字。\n「王は名を差し出した。\n取ったのではない」');
  });
  E('desert_temple_disk', async (ev) => {
    await ev.say(null, ['祭壇の奥の、金の円盤だ。\n空に掛けて、光を受けたらしい。', '円盤は冷たく、\n何も映していない。']);
  });
  E('desert_temple_guard', async (ev) => {
    if (ev.flag('desert_temple_guard')) return;
    ev.sfx('shake');
    await ev.say(null, ['奥殿の両脇で、石の像が\n目を開けた。', '「日を継がぬ者、\n通すべからず――」']);
    const r = await ev.battle('tr_desert_sun_guard', { boss: true });
    ev.mapBgm();
    if (r !== 'win') return;
    ev.setFlag('desert_temple_guard');
    await ev.caption('像は崩れ、祭壇への道が開いた。', { ms: 1800 });
  }, { meta: { needs: [], gives: ['flag:desert_temple_guard'] } });
})(window.RPG);
