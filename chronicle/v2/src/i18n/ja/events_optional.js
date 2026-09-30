// 日本語の文の表（events_optional）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/events_optional.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/events/optional_hut.js
    'events.hut_arrive.caption': 'きこりたちの休み小屋だ。\nかまどの灰が、まだ\nほんのり温かい。',
    'events.hut_bed.say': '干し草を詰めた寝床だ。\n少し、休んでいこうか。',
    'events.hut_bed.i.choose': ['休む', 'やめておく'],
    'events.hut_bed.caption': 'ぐっすり眠って、\nすっかり元気になった。',
    'events.hut_journal.say': ['卓の上に、きこりの日誌が\n開いたまま置いてある。', '「三日目。森の道が、また変わった。\nハンスは歌が聞こえると言う。\nおれには何も聞こえない。」', '「記録院の男が、森の奥の\n空き小屋へ入っていった。\n何を書きに来たのか。」'],
    'events.hut_journal.say_2': '日誌は、そこで途切れている。',
    'events.hut_notes.say': '棚の奥の帳面。\n「写したあと、村の子が\n歌えなくなった。」',
    'events.hut_notes.say_2': ['棚の奥に、革の帳面が\n押しこまれている。\n記録院の印がある。', '「森の歌の石の歌を写した。\n写したあと、村の子が\n歌えなくなった。」', '「報告すべきか。\n……写すと、忘れるのか？」'],
    // ---- src/events/optional_well.js
    'ev.optional_well.well_nest.run.narr': '花の咲くくぼみに、\n光る毛並みの小さなけものの\n巣がある。',
    'ev.optional_well.well_nest.run.narr_2': '宝石ウサギの巣だ……！\nきらきらした音の正体は、\nこれだったのか。',
    'ev.optional_well.well_grave.run.narr': '古い旅人の墓標がある。',
    'ev.optional_well.well_grave.run.narr_2': '「井戸の底の花を、\nいつか娘に見せたかった。」',
    // ---- src/events/optional_windhill.js
    'ev.optional_windhill.windhill_notes.run.narr': '風が、歌のように鳴っている。',
    'ev.optional_windhill.windhill_notes.run.caption': '……風が、歌のように鳴っている。',
    'ev.optional_windhill.windhill_notes.run.narr_2': '岩のくぼみに、古い書き付けが\nはさまっている。',
    'ev.optional_windhill.windhill_notes.run.narr_3': '「風の丘で、灰色のマントの人を見た。\n風は、昔の歌を覚えているのだという。\n――ロアの語り部」',
    'ev.optional_windhill.windhill_notes.run.narr_4': '丘の上に、灰色のマントの人影が\n見えた気がした。',
    'ev.optional_windhill.windhill_notes.run.say': '……風も、歌を覚えているのね。',
    'ev.optional_windhill.windhill_notes.run.say.name': '灰色のマントの少女',
    'ev.optional_windhill.windhill_notes.run.narr_5': '振り向くと、だれもいなかった。\n岩のくぼみに、小さな鈴が\n残されている。',
  });
})(window.RPG);
