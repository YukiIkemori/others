// 英語の文の表（events_optional）。key は日本語の表（src/i18n/ja/events_optional.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    'events.hut_arrive.caption': 'The woodcutters\' resting hut.\nThe ashes in the hearth are\nstill faintly warm.',
    'events.hut_bed.say': 'A bed stuffed with hay.\nMaybe rest here a while?',
    'events.hut_bed.i.choose': ['Rest', 'Not now'],
    'events.hut_bed.caption': 'You slept soundly and\nfeel completely refreshed.',
    'events.hut_journal.say': ['A woodcutter\'s journal lies\nopen on the table.', '"Day three. The forest paths\nhave changed again. Hans says he\nhears singing. I hear nothing."', '"A man from the Archive went into\nthe empty hut deep in the woods.\nWhat did he come to write?"'],
    'events.hut_journal.say_2': 'The journal breaks off there.',
    'events.hut_notes.say': 'The notebook at the back of the shelf.\n"After I copied it, the village\nchildren could no longer sing."',
    'events.hut_notes.say_2': ['A leather notebook is shoved\nto the back of the shelf.\nIt bears the Archive\'s seal.', '"I copied the song of the forest\'s\nsong stone. After I copied it, the\nvillage children could no longer sing."', '"Should I report this?\n...Does copying make people forget?"'],
    'ev.optional_well.well_nest.run.narr': 'In a hollow full of flowers\nis the nest of a small creature\nwith shining fur.',
    'ev.optional_well.well_nest.run.narr_2': 'A jewel hare\'s nest...!\nSo that\'s where the tinkling\nsound was coming from.',
    'ev.optional_well.well_grave.run.narr': 'An old traveler\'s grave marker.',
    'ev.optional_well.well_grave.run.narr_2': '"Someday I wanted to show my\ndaughter the flowers at the\nbottom of the well."',
    'ev.optional_windhill.windhill_notes.run.narr': 'The wind is singing.',
    'ev.optional_windhill.windhill_notes.run.caption': '...The wind is singing.',
    'ev.optional_windhill.windhill_notes.run.narr_2': 'An old note is tucked\ninto a hollow in the rock.',
    'ev.optional_windhill.windhill_notes.run.narr_3': '"On Windsong Hill I saw someone\nin a gray cloak. The wind, she\nsaid, remembers the old songs. -- A storyteller of Roa"',
    'ev.optional_windhill.windhill_notes.run.narr_4': 'You thought you saw a figure\nin a gray cloak atop the hill.',
    'ev.optional_windhill.windhill_notes.run.say': '...So the wind remembers the song, too.',
    'ev.optional_windhill.windhill_notes.run.say.name': 'Girl in a Gray Cloak',
    'ev.optional_windhill.windhill_notes.run.narr_5': 'You turned around, but no one\nwas there. A little bell was\nleft in the hollow of the rock.',
  });
})(window.RPG);
