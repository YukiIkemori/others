// 日本語の文の表（events_world）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/events_world.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/events/world_poi.js
    'ev.world_poi.world_poi_shrine.run.narr': '道ばたの小さなほこら。\n旅の無事を願う石の像が\nまつられている。',
    'ev.world_poi.world_poi_shrine.run.narr_2': 'ほこらに手を合わせた。',
    'ev.world_poi.world_poi_shrine.run.narr_3': ['供えられた野の花が、\nまだ新しい。', 'だれかが灯したろうそくの跡が\n石に残っている。', '風が、少しだけやわらいだ\n気がした。'],
    'ev.world_poi.lines.0': '風車の扉は固く閉ざされている。\n今は入れないようだ。',
    'ev.world_poi.lines': ['古い立石が輪になって並んでいる。', '石の肌に、読めない文字が\nかすかに刻まれている。\n……灯火の印に、似ている。'],
    'ev.world_poi.lines_2': ['崩れかけた見張りの塔。', '石段の奥は、根と土で\nふさがっている。\n昔はここから森を見わたしたのだろう。'],
    'ev.world_poi.lines_3': ['こけむした柱が、円く並んでいる。', 'まん中の床石に、\n千年樹の葉の模様。'],
    'ev.world_poi.lines_4': ['倒れた大きな石像。\n衣をまとった人の姿だ。', '顔はもう、すり減って\nわからない。'],
    'ev.world_poi.lines_5': ['草に埋もれた石の土台。\n三段の石段だけが残っている。', '昔の宿場の跡だろうか。'],
    'ev.world_poi.lines_6': ['海を見下ろす、古い石の壁。', '窓の穴から、灯台の光が\n遠くに見える。'],
    'ev.world_poi.lines_7': ['木組みの物見台。', '上から見ると、半島の牧草地と\n北の海が一望できる。'],
    'ev.world_poi.lines_8': ['雪に埋もれた石の塔。', '北の流氷原の方角に、\n窓がひとつだけ開いている。'],
    'ev.world_poi.lines_9': ['砂に半分埋もれた神殿の顔。', '二本の柱のあいだから、\n冷たい風が吹いてくる。'],
    'ev.world_poi.lines_10': ['沼から突き出た、古い鐘楼。', 'こけの中に、さびた鐘が\n傾いて下がっている。\n……鳴らない。'],
    'ev.world_poi.lines_11': ['高床の小屋の跡。', '床板は抜け、屋根だけが\n沼の上に傾いている。'],
    'ev.world_poi.world_poi_cache.run.narr': '石のすきまには、もう何もない。',
    'ev.world_poi.world_poi_cache.run.narr_2': '石のすきまに、旅人の\n小さな包みが押しこまれている。',
    // ---- src/events/world_prologue.js
    'ev.world_prologue.world_pen_lamp.run.narr': '道しるべの灯籠に、\n火がともっている。\nまわりの闇が、少しやわらいだ。',
    'ev.world_prologue.world_pen_lamp.run.narr_2': '見晴らし台の古い灯籠は、\n火が消えたままだ。',
    'ev.world_prologue.world_pen_lamp.run.narr_3': '道しるべの灯籠の火が\n消えている。',
    'ev.world_prologue.world_pen_lamp.run.narr_4': '火種があれば、\nともせそうだ。',
    'ev.world_prologue.world_pen_lamp.run.narr_5': '組合の火種を、\n灯籠に移した。',
    'ev.world_prologue.world_pen_lamp.run.narr_6': '灯籠に、火がともった！\nこのあたりには、もう\n魔物が寄りつかないだろう。',
    'ev.world_prologue.world_pen_lamp.run.narr_7': 'タデオに知らせに行こう。',
    'ev.world_prologue.world_bridge_guard.run.pick.0.text': '西の森の上に、光の柱が\n見えるだろう？\nあれが大灯火ってやつかね。',
    'ev.world_prologue.world_bridge_guard.run.pick.1.text': ['跳ね橋は下ろしてある。\n北の野を抜ければ、\n西の森へ続く街道だ。', '東と北の峠は、崖崩れで\n通れないそうだ。気をつけてな。'],
    'ev.world_prologue.world_bridge_guard.run.pick.2.text': ['跳ね橋は、上げたままだ。\n灯台の火が消えてから、\n夜の魔物が橋を渡ってくるんでな。', '灯台に火が戻るまでは、\n下ろせんよ。'],
    'ev.world_prologue.world_traveler_plains.run.pick.0.text': '森の灯が戻ってから、\n夜道の樹脂の松明が\nよく売れるんだ。',
    'ev.world_prologue.world_traveler_plains.run.pick.1.text': ['よい灯りを。\n東の峠が崖崩れでね、\n山の町へ荷が運べないんだ。', 'しばらくは、ここで\n野宿さ。たき火にあたって\nいくかい？'],
    'ev.world_prologue.world_woodcutter.run.pick.0.text': '仲間たちが、みんな\n村へ帰ってきたよ。\n森の道も、もう迷わない。',
    'ev.world_prologue.world_woodcutter.run.pick.1.text': ['森が道を変えるんで、\n奥へは入れないんだ。', '街道の道しるべの灯籠が\n三つも消えててな。\n夜は、それが怖い。'],
    'ev.world_prologue.world_shepherd.run.pick.0.text': '近ごろ、空がほんの少し\n明るくないかい？\n羊たちも落ち着いておる。',
    'ev.world_prologue.world_shepherd.run.pick.1.text': ['灯台が戻ってから、\n羊が夜に鳴かなくなった。', 'わしの若いころは……\nはて、昼というのが\nあったような、なかったような。'],
  });
})(window.RPG);
