// 日本語の文の表（maps_prologue）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/maps_prologue.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/maps/prologue_lighthouse.js
    'map.prologue_lighthouse.objects.sign': 'ファロス灯台\n灯台守のほか、立ち入りを禁ず。',
    'map.prologue_lighthouse.objects.lh1_door.locked': '扉には、鍵がかかっている',
    'map.prologue_lighthouse.lighthouse_1.name': 'ファロス灯台',
    'map.prologue_lighthouse.lighthouse_1.meta.floor': '1階',
    'map.prologue_lighthouse.lighthouse_1.meta.sub': '岬の倉庫',
    'map.prologue_lighthouse.objects.22.text': '石でふさいだ古い戸口だ。\n目地が崩れて、すきま風が\n抜けてくる……。',
    'map.prologue_lighthouse.lighthouse_2.name': 'ファロス灯台',
    'map.prologue_lighthouse.lighthouse_2.meta.floor': '2階',
    'map.prologue_lighthouse.lighthouse_2.meta.sub': 'らせん階段',
    'map.prologue_lighthouse.npcs.fine.name': '灰色のマントの少女',
    'map.prologue_lighthouse.lighthouse_3.name': 'ファロス灯台',
    'map.prologue_lighthouse.lighthouse_3.meta.floor': '3階',
    'map.prologue_lighthouse.lighthouse_3.meta.sub': '灯室',
    // ---- src/maps/prologue_roa.js
    'map.prologue_roa.objects.sign': 'ロアの里\n語り部の里。東へ出れば、半島の街道。',
    'map.prologue_roa.npcs.gatewoman.name': '門番のおかみ',
    'map.prologue_roa.npcs.gatewoman2.name': '門番のおかみ',
    'map.prologue_roa.npcs.elder.name': '里の年寄り',
    'map.prologue_roa.npcs.stroller.name': '里の娘',
    'map.prologue_roa.npcs.lines.0.text': '夕方になると、みんな\n語り石のまわりに集まるの。\n里の、いちばんの楽しみよ。',
    'map.prologue_roa.npcs.cat.name': 'ねこ',
    'map.prologue_roa.npcs.lines.0.text_2': 'ねこが、のびをしている。',
    'map.prologue_roa.roa.name': 'ロアの里',
    'map.prologue_roa.roa.name_ruby': 'ろあのさと',
    'map.prologue_roa.roa.meta.sub': '語り部の里',
    'map.prologue_roa.npcs.berna.name': 'ベルナ',
    'map.prologue_roa.npcs.berna_desk.name': 'ベルナ',
    'map.prologue_roa.roa_house.name': 'ベルナの家',
    'map.prologue_roa.roa_house.meta.sub': '語り部の家',
  });
})(window.RPG);
