// 日本語の文の表（goals）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/goals.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/data/goals.js
    'goals.g_berna.text': '師匠ベルナと話そう',
    'goals.g_pharos.text': '里を出て、南東の港町ファロスへ向かおう',
    'goals.g_tavern.text.0.text': 'ロアの里の師匠ベルナと話そう',
    'goals.g_tavern.text.1.text': 'ファロスの酒場「潮風亭」で、旅の仲間を探そう',
    'goals.g_otto.text': '港にいる灯台守オットーを訪ねよう',
    'goals.g_lighthouse.text': '町の南、岬の先のファロス灯台へ向かおう',
    'goals.g_climb.text': '灯台を上って、てっぺんの灯室を目指そう',
    'goals.g_return.text': 'ファロスの町へ戻ろう',
    'goals.g_rumors.text': '潮風亭で、うわさを聞いてみよう',
    'goals.g_fern.text': '西の森の村フェルンへ向かおう',
    'goals.g_gord.text.0.text': 'フェルンのきこり頭ゴードの家を訪ねよう',
    'goals.g_gord.text.1.text': 'フェルンの広場の掲示板を見てみよう',
    'goals.g_search.text.0.text': 'ゴードの女房カトリに、息子のことを聞こう',
    'goals.g_search.text.1.text': '迷いの森で、行方知れずの四人を探そう（{flags:{FOUR}}/4 人）',
    'goals.g_song.text': '迷いの森の歌の石を探そう（{var:forest_verses}/3）',
    'goals.g_elder.text': '森の奥、千年樹のもとへ向かおう',
    'goals.g_rest.text': '村か里に戻って、ひと休みしよう',
    'goals.g_free.text.0.text': '体験版はここまで。森と半島の依頼や寄り道をどうぞ',
    'goals.g_free.text.1.text': '潮風亭で、次のうわさを聞いてみよう',
  });
})(window.RPG);
