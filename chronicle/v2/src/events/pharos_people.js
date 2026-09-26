// CONTENT-P: ファロスの町の人・店・宿・依頼・酒場の噂（V2_PLAN §3.3「話す見返りのある人」・§3.4・§3.5、WORLD_REDESIGN §3.3、STORY_BIBLE §3.5・§8.10・§10.2）
//   話す見返り（町・屋内で 10 人以上、種類は ①手がかり ②依頼 ⑤一度だけの品 ④隠し場所のほのめかし ⑥ボスの癖 ⑦近況）:
//     潮風亭の噂の 3 人（手がかり）・井戸の子（依頼 q_pharos_well）・タデオ（依頼 q_pharos_lamp）・造船所の見習い（依頼 q_pharos_delivery）・
//     漁師のおかみ（一度だけの品）・老水夫（灯台 2 階の隠し通路）・旅の剣士（ページ食らいの癖）・門番／船乗り／広場の人（近況）
//   世代で分けた台詞（STORY_BIBLE §3.5）: 桟橋の子（二十歳より下）・行商人（二十〜四十）・ベンチの年寄り（年寄り）
//   読み物: pharos_oilboard（lo_pharos_oilboard）・pharos_tract（lo_silent_tract）
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;
  const say = (who, lines) => ({ meta: { needs: [], gives: [] }, run: async (ev) => { const E = X(); await E.say(ev, who, E.pick(lines)); } });

  // ------------------------------------------------------------ 近況の人（ティアと序章の進みで変わる）
  D.pharos_gateguard = say('gateguard', [
    { cond: 'cleared_r_forest', text: '西の森の灯が戻ったそうだな。\n北の野の灯籠も、\n心なしか明るいよ。' },
    { cond: 'prologue_done', text: ['よい灯りを、旅の方。\n跳ね橋が下りたぞ。', '北の野を抜ければ、\n西の森へ続く街道だ。\n灯籠を目印に行くといい。'] },
    { text: ['よい灯りを、旅の方。\n灯台の火が消えてから、\n夜の海から魔物が上がってくる。', 'それで、領主さまが\n北の跳ね橋を上げさせたのさ。'] },
  ]);
  D.pharos_ship_sailor = say('ship_sailor', [
    { cond: 'prologue_done', text: ['灯台が戻っても、定期船は\nまだ出せないんだ。', '沖の潮の流れがおかしくてな。\n船長が、しばらく欠航だとさ。'] },
    { text: '定期船も止まったままさ。\n灯台の火が無けりゃ、\n夜の海には出られない。' },
  ]);
  D.pharos_plaza_woman = say('plaza_woman', [
    { cond: 'prologue_boss', text: 'ゆうべ、岬が真っ白に\n光ったのよ！\nまるで昔話みたいだった。' },
    { text: ['よい灯りを。\n灯台の火は、細りはじめて三晩。\nきのう、とうとう消えちまった。', '灯台の光が町の時計がわり\nだったのにねえ。'] },
  ]);
  D.pharos_bench_old = say('bench_old', [
    { cond: 'prologue_done', text: ['わしの祖父の代から、\nずっと夜じゃったよ。', '……いや、戦のころまでは、\nもう少し……。\nはて、何の戦じゃったか。'] },
    { text: ['跳ね橋を上げさせたのは\n領主さまよ。魔物が橋を\n渡ってこぬようにな。', 'わしの祖父の代から、\nずっと夜じゃったよ。……たぶんな。'] },
  ]);
  D.pharos_merchant = say('merchant', [
    { cond: 'prologue_done', text: ['子どものころは、もう少し\n空が明るかった気がするんだ。', '……気のせいかな。\n品物の色が、昔はもっと\nきれいに見えた。'] },
    { text: '灯台が消えてから、\n荷の船が入らなくてね。\n棚ががらがらだよ。' },
  ]);
  D.pharos_kid_pier = say('kid_pier', [
    { text: ['朝の鐘って、なんで\n『朝』っていうの？', '……だれも知らないんだって。\nへんなの。'] },
  ]);
  D.pharos_clerk = say('clerk', [
    { cond: 'prologue_done', text: '本院から、また写しの\n指示が来ている。\n……今度は西の森の歌だそうだ。' },
    { text: '記録院の書記です。\n伝承の写しの受け付けは\nこちらではありませんよ。' },
  ]);
  D.pharos_shipwright = say('shipwright', [
    { cond: 'prologue_done', text: ['この小舟は、オットーじいさんの\n昔の舟でな。', '直してはいるが、\n沖の潮が落ち着くまでは\n出せんよ。'] },
    { text: '灯台が消えたままじゃ、\n舟を直しても\n出しようがないのう。' },
  ]);

  // ------------------------------------------------------------ 静夜会（遠くで説いている姿だけ。STORY_BIBLE §8.10）
  D.pharos_yena = say('yena', [{ text: '名は重荷ですよ、旅の方。' }]);
  D.pharos_tract = {
    meta: { needs: [], gives: ['lore:lo_silent_tract'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '木箱の上に、刷り物の束が\n置いてある。');
      await E.narr(ev, '「夜は安らぎ、名は重荷。\n名を手放し、静かな夜を。\n――静夜会」');
      E.lore(ev, 'lo_silent_tract');
    },
  };

  // ------------------------------------------------------------ 読み物・掲示板
  D.pharos_oilboard = {
    meta: { needs: [], gives: ['lore:lo_pharos_oilboard'] },
    run: async (ev) => {
      const E = X();
      const k = [1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6][Math.min(8, (R.Game && R.Game.tier) || 0)];
      const p = (n) => Math.round(n * k);
      await E.narr(ev, '油の相場の札が立っている。');
      await E.narr(ev, `「半島の魚油 ${p(12)} G／森の樹脂 ${p(15)} G\n砂漠の黒い油 ${p(30)} G／鉱山の燐石 ${p(40)} G」`);
      await E.narr(ev, '札の端に、小さく\n「大灯火が細るほど、値は上がる」\nと書き足してある。');
      E.lore(ev, 'lo_pharos_oilboard');
    },
  };
  D.pharos_board = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '町の掲示板に、張り紙がある。');
      await E.narr(ev, E.pick([
        { cond: 'prologue_done', text: '「北の跳ね橋、下ろしました。\n北の野の峠のうち、東と北は\n崖崩れのため通行止め」' },
        { text: '「灯台の火が消えています。\n夜の漁は控えること。\n――港の組合」' },
      ]));
      if (ev.flag('prologue_done')) await E.narr(ev, '「造船所より。届け物の人手、\n求む。行き先は西の森の村」');
    },
  };

  // ------------------------------------------------------------ 一度だけの品・ほのめかし・ボスの癖
  D.pharos_fishwife = {
    meta: { needs: [], gives: ['item:i_salve'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_fishwife')) {
        await E.say(ev, 'fishwife', 'よい灯りを。\n夜の漁に出られなくってね。\n……傷薬でよけりゃ、持っておいき。');
        await E.give(ev, 'i_salve', 2);
        ev.setFlag('prologue_fishwife');
        return;
      }
      await E.say(ev, 'fishwife', E.pick([
        { cond: 'prologue_done', text: '灯台が戻って、\nやっと漁に出られるよ。\nありがとうね。' },
        { text: '灯台の火が戻ったら、\n焼きたての干物を\nごちそうしてあげるよ。' },
      ]));
    },
  };
  D.pharos_old_sailor = say('old_sailor', [
    { text: ['灯台の二階は、ぐるぐる回る\nらせんになっておる。', '北東の壁にひびがあってな、\n昔から風が抜けておった。\n……今もそうかのう。'] },
  ]);
  D.pharos_swordsman = say('swordsman', [
    { cond: 'prologue_boss', text: '灯台の化け物を倒したって？\n紙吹雪をよく防いだな。\n大したもんだ。' },
    { text: ['灯台に、紙を食う化け物が\n住みついたって噂だ。', '紙を吸いこみはじめたら、\n次は紙吹雪が来る。\nみなで身を守れば半分で済むさ。'] },
  ]);

  // ------------------------------------------------------------ 依頼
  // q_pharos_well（井戸の子 → 旅人の古井戸。巣を見つけると解決。optional_well.js の well_nest）
  D.pharos_well_child = {
    meta: { needs: [], gives: ['lead:q_pharos_well'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_well_nest')) { await E.say(ev, 'well_child', '井戸の底に、光る\nうさぎがいたの？\nいいなあ！　見たかったなあ。'); return; }
      await E.say(ev, 'well_child', ['ねえ、知ってる？\n北の分かれ道の枯れ井戸から、\nきらきらした音がするんだ。', 'でも、父ちゃんが\n近づいちゃだめだって。\n……だれか、見てきてくれないかな。']);
      ev.lead('q_pharos_well');
    },
  };
  // q_pharos_lamp（タデオ → 半島の消えた灯籠 2 つに組合の火種。見晴らし台と、ロアからの夜道。world_pen_lamp）
  D.pharos_tadeo = {
    meta: { needs: [], gives: ['lead:q_pharos_lamp', 'flag:prologue_lamp_quest', 'gold'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_tadeo')) {
        await E.say(ev, 'tadeo', ['よい灯りを。\n灯守組合の、タデオだ。', '油が高いのは、\n大灯火が細ったからさ。\n……うちの商売には、痛いがね。']);
        ev.setFlag('prologue_tadeo');
        if (!ev.flag('prologue_done')) return;
      }
      if (!ev.flag('prologue_done')) { await E.say(ev, 'tadeo', '灯台の火が消えたままじゃ、\n油を運ぶ船も入らん。\n困ったもんだ。'); return; }
      if (!ev.flag('prologue_lamp_quest')) {
        await E.say(ev, 'tadeo', ['灯台が戻ったついでに、\nひとつ頼まれてくれないか。', '半島の見晴らし台の古い灯籠と、\nロアからの夜道の灯籠が、\n消えたままなんだ。', '組合の火種を渡しておく。\n灯籠にともしてやってくれ。']);
        ev.setFlag('prologue_lamp_quest');
        ev.lead('q_pharos_lamp');
        await E.narr(ev, '組合の火種を預かった。');
        return;
      }
      const both = ev.flag('prologue_lamp_road') && ev.flag('prologue_lamp_lookout');
      if (both && !ev.flag('prologue_lamp_paid')) {
        await E.say(ev, 'tadeo', 'どっちの灯籠も、ともったな！\nこれで半島の夜道も安心だ。\n少ないが、礼だよ。');
        E.gold(ev, 100);
        ev.setFlag('prologue_lamp_paid');
        ev.leadDone('q_pharos_lamp');
        return;
      }
      await E.say(ev, 'tadeo', both ? '灯籠のまわりは、\n魔物も寄りつかん。\n灯りってのは、ありがたいもんだ。' : '見晴らし台は、半島の北の\n分かれ道から東だ。\nもうひとつは、ロアへの夜道さ。');
    },
  };
  // q_pharos_delivery（造船所の見習い → 包みをフェルンの樵頭ゴードへ。受け取りは CONTENT-F の fern_gord）
  D.pharos_apprentice = {
    meta: { needs: ['flag:prologue_done'], gives: ['lead:q_pharos_delivery', 'item:k_ship_parcel'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_done')) { await E.say(ev, 'apprentice', '親方の手伝いで、\n小舟の板を削ってるんだ。\n灯台が戻れば、また海に出られる。'); return; }
      if (ev.flag('q_pharos_delivery_done')) { await E.say(ev, 'apprentice', '包み、届けてくれたんだね！\nゴードさんから、礼の手紙が\n来たよ。ありがとう！'); return; }
      if (!ev.flag('prologue_parcel')) {
        await E.say(ev, 'apprentice', ['ちょうどよかった！\n西の森の村フェルンの、\n樵頭ゴードさんに届け物があるんだ。', '頼んでいた斧の柄の木を\n削り直したんだけど、\n跳ね橋が上がってて出せなくてさ。', 'この包み、届けてくれない？']);
        await E.give(ev, 'k_ship_parcel', 1, { say: true });
        ev.setFlag('prologue_parcel');
        ev.lead('q_pharos_delivery');
        return;
      }
      await E.say(ev, 'apprentice', 'フェルンは、北の野から\n西の森へ入った先だよ。\n樵頭のゴードさんに渡してね。');
    },
  };

  // ------------------------------------------------------------ 店・宿
  D.pharos_innkeeper = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      const price = R.Tier && R.Tier.innPrice ? R.Tier.innPrice() : 10;
      await E.say(ev, 'innkeeper', 'いらっしゃい。\nひと晩 ' + price + ' ゴールドだよ。');
      const ok = await ev.inn(price);
      await E.say(ev, 'innkeeper', ok ? 'よく眠れたかい？\n……よい灯りを。' : 'またどうぞ。');
    },
  };
  D.pharos_shopkeeper = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'shopkeeper', 'よい灯りを。\n旅の道具なら、うちにおまかせ。');
      await ev.shop('shop_pharos_items');
    },
  };
  D.pharos_smithy = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'smith', 'おう、武器か防具か。\n港の職人の仕事だ、\n手に取って見ていきな。');
      await ev.shop('shop_pharos_arms');
    },
  };

  // ------------------------------------------------------------ 潮風亭の噂の 3 人（WORLD_REDESIGN §3.3。1 回話すごとに次の噂。序章の後）
  const RUMORS = {
    gossip: ['l_rumor_forest', 'l_opt_hut', 'l_rumor_marsh', 'l_rumor_isles'],
    bard: ['l_rumor_snow', 'l_rumor_star', 'l_rumor_ash', 'l_opt_windhill'],
    trader: ['l_rumor_desert', 'l_opt_yura', 'l_rumor_mine'],
  };
  const TALK = {
    l_rumor_forest: '西の森の村で、樵が三人\n帰ってこないんだって。\nそれを探しに、子どもまで森に入ったとか。',
    l_opt_hut: '森の東の縁の休み小屋に、\n樵の日誌が置いてあるそうよ。\nある日で、ぷっつり途切れてるって。',
    l_rumor_marsh: '東の湿原の町ロッホじゃ、\n霧の中で子どもが消えるそうよ。\n……おお、こわい。',
    l_rumor_isles: '南東の島々に、青い鬼火の\n幽霊船が出るんだって。\n船乗りはみんな陸にいるわ。',
    l_rumor_snow: '北の雪の村は、大火祭の\n支度で大忙しさ。ただ、今年は\n冬至の火が細いって、首をかしげてる。',
    l_rumor_star: '北東の学術都市オルビスでは、\n夜空の星が、ひと晩にひとつずつ\n消えていくそうだよ。',
    l_rumor_ash: '南の灰の荒野じゃ、\n火の鳥の卵が冷えていくと、\n族長が闘技大会を開くらしい。',
    l_opt_windhill: '森の北の丘で、風が歌のように\n鳴るんだ。灰色のマントの人影が\n立っていた、なんて話もある。',
    l_rumor_desert: '南の砂漠のカシムじゃ、\n隊商が出られなくて品が届かない。\n護衛を探してるって話だ。',
    l_opt_yura: '森の奥に、地図にない灯りが\nひとつだけ瞬いてるそうだ。\n名前を忘れた人の里だとか。',
    l_rumor_mine: '北の鉱山町ドヴァンで、\n坑道の奥から鉄の番人が出たとさ。\n組合と鍛冶衆がにらみ合ってる。',
  };
  const BEFORE = {
    gossip: '灯台の火が消えて三晩。\n……ううん、細りだしたのが三晩前で、\n消えたのはきのうよ。',
    bard: '♪　むかしむかし、海の向こう……\n……おっと、続きが出てこない。\nこの歌も、白紙かねえ。',
    trader: '跳ね橋が上がってちゃ、\n商売あがったりだ。\n早く下りないものかね。',
  };
  function rumorEvent(key) {
    return {
      meta: { needs: [], gives: RUMORS[key].map((l) => 'lead:' + l) },
      run: async (ev, ctx) => {
        const E = X();
        const who = (ctx && ctx.npc) || key;
        if (!ev.flag('prologue_done')) { await E.say(ev, who, BEFORE[key]); return; }
        const next = RUMORS[key].find((l) => !(R.Game.leads && R.Game.leads[l]));
        if (!next) { await E.say(ev, who, '噂なら、もうみんな話したよ。\n新しい話が入ったら、\nまた教えてあげる。'); return; }
        await E.say(ev, who, TALK[next]);
        ev.lead(next);
      },
    };
  }
  D.pharos_rumor_gossip = rumorEvent('gossip');
  D.pharos_rumor_bard = rumorEvent('bard');
  D.pharos_rumor_trader = rumorEvent('trader');
})(window.RPG);
