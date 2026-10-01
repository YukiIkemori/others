// 英語の文の表（maps_prologue）。key は日本語の表（src/i18n/ja/maps_prologue.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/prologue_lighthouse.js
    'map.prologue_lighthouse.objects.sign': 'Pharos Lighthouse\nNo entry except for the lighthouse keeper.',
    'map.prologue_lighthouse.objects.lh1_door.locked': 'The door is locked.',
    'map.prologue_lighthouse.lighthouse_1.name': 'Pharos Lighthouse',
    'map.prologue_lighthouse.lighthouse_1.meta.floor': '1F',
    'map.prologue_lighthouse.lighthouse_1.meta.sub': 'Cape Storehouse',
    'map.prologue_lighthouse.objects.22.text': 'An old doorway sealed with stone.\nThe mortar has crumbled, and a draft\nslips through...',
    'map.prologue_lighthouse.lighthouse_2.name': 'Pharos Lighthouse',
    'map.prologue_lighthouse.lighthouse_2.meta.floor': '2F',
    'map.prologue_lighthouse.lighthouse_2.meta.sub': 'Spiral Staircase',
    'map.prologue_lighthouse.npcs.fine.name': 'Girl in a Gray Cloak',
    'map.prologue_lighthouse.lighthouse_3.name': 'Pharos Lighthouse',
    'map.prologue_lighthouse.lighthouse_3.meta.floor': '3F',
    'map.prologue_lighthouse.lighthouse_3.meta.sub': 'Lamp Room',
    // ---- src/maps/prologue_roa.js
    'map.prologue_roa.objects.sign': 'Roa\nVillage of storytellers. Head east for the peninsula highway.',
    'map.prologue_roa.npcs.gatewoman.name': 'Gatekeeper',
    'map.prologue_roa.npcs.gatewoman2.name': 'Gatekeeper',
    'map.prologue_roa.npcs.elder.name': 'Village Elder',
    'map.prologue_roa.npcs.stroller.name': 'Village Girl',
    'map.prologue_roa.npcs.lines.0.text': 'In the evening, everyone gathers\naround the story stone.\nIt\'s the village\'s favorite pastime.',
    'map.prologue_roa.npcs.cat.name': 'Cat',
    'map.prologue_roa.npcs.lines.0.text_2': 'The cat is stretching.',
    'map.prologue_roa.roa.name': 'Roa',
    'map.prologue_roa.roa.name_ruby': '',
    'map.prologue_roa.roa.meta.sub': 'Village of storytellers',
    'map.prologue_roa.npcs.berna.name': 'Berna',
    'map.prologue_roa.npcs.berna_desk.name': 'Berna',
    'map.prologue_roa.roa_house.name': 'Berna\'s House',
    'map.prologue_roa.roa_house.meta.sub': 'Storyteller\'s House',
  });
})(window.RPG);
