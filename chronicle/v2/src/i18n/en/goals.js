// 英語の文の表（goals）。key は日本語の表（src/i18n/ja/goals.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/data/goals.js
    'goals.g_berna.text': 'Talk to your mentor, Berna',
    'goals.g_pharos.text': 'Leave the village and head southeast to Port Pharos',
    'goals.g_tavern.text.0.text': 'Talk to your mentor Berna in Roa',
    'goals.g_tavern.text.1.text': 'Look for companions at the Sea Breeze tavern in Pharos',
    'goals.g_otto.text': 'Visit Otto, the lighthouse keeper at the harbor',
    'goals.g_lighthouse.text': 'Head to Pharos Lighthouse at the tip of the cape, south of town',
    'goals.g_climb.text': 'Climb the lighthouse to the lamp room at the top',
    'goals.g_return.text': 'Return to Pharos',
    'goals.g_rumors.text': 'Listen for rumors at the Sea Breeze',
    'goals.g_fern.text': 'Head west to Fern, the forest village',
    'goals.g_gord.text.0.text': 'Visit the house of Gord, Fern\'s head woodcutter',
    'goals.g_gord.text.1.text': 'Check the notice board in Fern\'s square',
    'goals.g_search.text.0.text': 'Ask Katri, Gord\'s wife, about her son',
    'goals.g_search.text.1.text': 'Find the four who went missing in the Wandering Woods ({flags:{FOUR}}/4)',
    'goals.g_song.text': 'Find the singing stones in the Wandering Woods ({var:forest_verses}/3)',
    'goals.g_elder.text': 'Go deep into the forest, to the Millennial Tree',
    'goals.g_rest.text': 'Return to the village for a rest',
    'goals.g_free.text.0.text': 'That\'s all for the demo. Enjoy the requests and side trips in the forest and peninsula',
    'goals.g_free.text.1.text': 'Listen for the next rumor at the Sea Breeze',
  });
})(window.RPG);
