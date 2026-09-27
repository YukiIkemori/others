// CONTENT-P: 手がかり帳の本筋・世界・ファロスの依頼（R.DB.leads、K.lead。V2_PLAN §3.5、WORLD_REDESIGN §3.2）と、
// 序章・世界の読み物（R.DB.lore、STORY_BIBLE §10.2 の lo_*。契約の外の表 → TODO(リード): K.lore と手がかり帳の「書庫」のタブ）。
//   region: 'world' = 世界のうわさ・本筋、'prologue' = ファロス半島、'r_<rs>' = 地方（地方の見出しでまとめる）
//   slice:'locked' = 縦切りで行けない地方のうわさ（帳には入るが「この先は、まだ語られていない」と薄く出す）
//   地方の手がかり（l_forest_*）と森の依頼（q_fern_* q_forest_*）、森の寄り道のうわさ（l_opt_hut・l_opt_yura）は CONTENT-F が forest_*.js に書く。
(function (R) {
  'use strict';
  R.defs('leads', {
    // ---------------------------------------------------------------- 本筋（main）
    l_main_rumors: {
      title: 'うわさは酒場に集まる', kind: 'main', region: 'world', from: '師匠ベルナ', place: 'pharos', dir: '港',
      text: '八つの伝承が、白紙になりかけている。\nうわさは酒場に集まるものさ、と師匠は言った。\nまずは港の酒場「潮風亭」で。',
      done: { any: ['cleared_r_forest', { lead: 'l_rumor_forest' }] },
    },
    l_main_recorder_forest: {
      title: '記録官の帳面', kind: 'main', region: 'world', from: 'きこりの休み小屋', place: 'hut', dir: '森の東',
      text: '「歌の石の歌を写した。写したあと、\n村の子が歌えなくなった。報告すべきか」\n写すと、忘れる……？',
    },
    l_main_margin_1: {
      title: '余白の一行', kind: 'main', region: 'world', from: '手がかり帳の余白',
      text: '灯のページの裏に、別の古い字が透けている。\n「はじめに言葉はなく、\nただ白い闇があった。名も、時もなかった。」',
    },

    // ---------------------------------------------------------------- 潮風亭のうわさ（rumor、ティア 0。森以外は縦切りでは行けない）
    l_rumor_forest: {
      title: '森で人が消える', kind: 'rumor', region: 'r_forest', from: '潮風亭のうわさ好き', place: 'fern', dir: '西',
      text: '西の森の村フェルンで、きこりが三人\n帰ってこない。探しに入った子どもまで、\n森で迷っているらしい。',
      done: 'cleared_r_forest',
    },
    l_rumor_snow: {
      title: '冬至の火が細い', kind: 'rumor', region: 'r_snow', from: '潮風亭の吟遊詩人', dir: '北', slice: 'locked',
      text: '北の雪の村ユールは、大火祭の支度で\n大忙し。ただ、今年は冬至の火が\n細いという。', done: 'cleared_r_snow',
    },
    l_rumor_desert: {
      title: '隊商の護衛', kind: 'rumor', region: 'r_desert', from: '潮風亭の旅の商人', dir: '南西', slice: 'locked',
      text: '南の砂漠のカシムでは、隊商が出られず\n品が届かない。護衛を探している\nという話だ。', done: 'cleared_r_desert',
    },
    l_rumor_marsh: {
      title: '霧に消える子ども', kind: 'rumor', region: 'r_marsh', from: '潮風亭のうわさ好き', dir: '東', slice: 'locked',
      text: '東の湿原の町ロッホでは、\n霧の中で子どもが消えるという。', done: 'cleared_r_marsh',
    },
    l_rumor_isles: {
      title: '青い鬼火の船', kind: 'rumor', region: 'r_isles', from: '潮風亭のうわさ好き', dir: '南東', slice: 'locked',
      text: '南東の島々に、青い鬼火をともした\n幽霊船が出るという。\n船乗りはみな陸にいる。', done: 'cleared_r_isles',
    },
    l_rumor_mine: {
      title: '坑道の鉄の番人', kind: 'rumor', region: 'r_mine', from: '潮風亭の旅の商人', dir: '北', slice: 'locked',
      text: '北の鉱山町ドヴァンで、坑道の奥から\n鉄の番人が出た。組合と鍛冶衆が\nにらみ合っているらしい。', done: 'cleared_r_mine',
    },
    l_rumor_ash: {
      title: '冷えていく卵', kind: 'rumor', region: 'r_ash', from: '潮風亭の吟遊詩人', dir: '南', slice: 'locked',
      text: '南の灰の荒野では、火の鳥の卵が\n冷えていくので、族長が\n闘技大会を開くという。', done: 'cleared_r_ash',
    },
    l_rumor_star: {
      title: '消えていく星', kind: 'rumor', region: 'r_star', from: '潮風亭の吟遊詩人', dir: '北東', slice: 'locked',
      text: '北東の学術都市オルビスでは、\n夜空の星が、ひと晩にひとつずつ\n消えていくという。', done: 'cleared_r_star',
    },

    // ---------------------------------------------------------------- 寄り道のうわさ（rumor）
    l_opt_well: {
      title: '枯れ井戸の音', kind: 'rumor', region: 'prologue', from: 'ロアの若者', place: 'well', dir: '半島の北',
      text: '半島の北の分かれ道の枯れ井戸。\n底のほうで、きらきら光るものを\n見た者がいるという。',
      done: 'prologue_well_nest',
    },
    l_opt_windhill: {
      title: '風の鳴る丘', kind: 'rumor', region: 'r_forest', from: '潮風亭の吟遊詩人', dir: '森の北',
      text: '森の北の丘で、風が歌のように鳴る。\n灰色のマントの人影が\n立っていたという。',
      done: 'prologue_windhill',
    },

    // ---------------------------------------------------------------- ファロスの依頼（side。id は依頼と同じ q_*）
    q_pharos_well: {
      title: '枯れ井戸のきらきら', kind: 'side', region: 'prologue', from: 'ファロスの子ども', place: 'well', dir: '半島の北',
      text: '北の分かれ道の枯れ井戸から、\nきらきらした音がするという。\n底をのぞいてみよう。',
      done: 'prologue_well_nest',
    },
    q_pharos_lamp: {
      title: '半島の灯籠に火を', kind: 'side', region: 'prologue', from: '灯守組合のタデオ', dir: '半島',
      text: '見晴らし台の古い灯籠と、\nロアからの夜道の灯籠に、\n組合の火種をともす。',
      done: ['prologue_lamp_road', 'prologue_lamp_lookout'],
    },
    q_pharos_delivery: {
      title: '造船所の届け物', kind: 'side', region: 'prologue', from: '造船所の見習い', place: 'fern', dir: '西',
      text: '造船所の見習いの包みを、\n西の森の村フェルンの\nきこり頭ゴードへ届ける。',
      done: 'q_pharos_delivery_done',
    },
  });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2。序章の分）
  //   {title, text, kind:'main'|'rumor'…, region, must}。調べると R.ContentP.ev.lore(ev, id) がフラグ id を立てる。
  R.defs('lore', {
    lo_roa_stone: { title: 'ロアの語り石', region: 'prologue', must: true, text: '「……ひとりの語り部が、この森に火をともした。」\n石の前の半分は、白く抜けて読めない。' },
    lo_roa_seat: { title: '朝の席', region: 'prologue', must: false, text: '食卓の東向きの席が、ひとつ空けてある。\n「昔からの習わしさ。誰の席かは……忘れちまったよ。」' },
    lo_roa_register: { title: '語り部の名簿', region: 'prologue', must: true, text: 'アルノ、ベルナ、リオナ……。リオナの欄に「戦にて」。\nその横に小さく、あとから「子も、病にて」。' },
    lo_ev_prologue: { title: '写し取り済みの掲示', region: 'prologue', must: true, text: '「ファロス灯台の守り歌、保管のため写し取り済み。\n――記録院ファロス出張所」' },
    lo_lighthouse_song: { title: '灯台の守り歌', region: 'prologue', must: true, text: '♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ' },
    lo_pharos_oilboard: { title: '油の相場の札', region: 'prologue', must: false, text: '半島の魚油、森の樹脂、砂漠の黒い油、鉱山のりん石。\n「大灯火が細るほど、値は上がる」' },
    lo_silent_tract: { title: '静夜会の刷り物', region: 'prologue', must: false, text: '「夜は安らぎ、名は重荷。\n名を手放し、静かな夜を。――静夜会」' },
  });
})(window.RPG);
