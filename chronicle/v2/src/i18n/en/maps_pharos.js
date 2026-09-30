// 英語の文の表（maps_pharos）。key は日本語の表（src/i18n/ja/maps_pharos.js）と同じ。無い key は日本語が出る
// 差し込み {name} は日本語と同じ名前を残す。数の言い分けは {n, plural, one {…} other {…}}（core/i18n.js）
(function (R) {
  'use strict';
  R.I18n.add('en', {
    // ---- src/maps/pharos_interiors.js
    'map.pharos_interiors.pharos_inn': 'Pharos Inn',
    'map.pharos_interiors.pharos_inn.innkeeper.name': 'Innkeeper',
    'map.pharos_interiors.pharos_tavern': 'Sea Breeze Tavern',
    'map.pharos_interiors.pharos_tavern.master.name': 'Sea Breeze Tavern Master',
    'map.pharos_interiors.pharos_tavern.gossip.name': 'Gossipy Landlady',
    'map.pharos_interiors.pharos_tavern.bard.name': 'Bard',
    'map.pharos_interiors.pharos_tavern.trader.name': 'Traveling Merchant',
    'map.pharos_interiors.pharos_tavern.swordsman.name': 'Traveling Swordsman',
    'map.pharos_interiors.pharos_shop': 'Pharos Item Shop',
    'map.pharos_interiors.pharos_shop.shopkeeper.name': 'Item Shopkeeper',
    'map.pharos_interiors.pharos_smith': 'Pharos Armory',
    'map.pharos_interiors.pharos_smith.smith.name': 'Armory Master',
    'map.pharos_interiors.pharos_record': 'Archive Pharos Office',
    'map.pharos_interiors.pharos_record.rowell.name': 'Young Recorder',
    'map.pharos_interiors.pharos_record.clerk.name': 'Scribe',
    'map.pharos_interiors.pharos_shipyard': 'Shipyard Hut',
    'map.pharos_interiors.pharos_shipyard.shipwright.name': 'Shipwright',
    'map.pharos_interiors.pharos_shipyard.apprentice.name': 'Apprentice',
    // ---- src/maps/pharos_town.js
    'map.pharos_town.objects.sign': 'Port Pharos\nHead west for the peninsula highway.',
    'map.pharos_town.objects.sign_2': 'Shipyard\nSmall boat repairs taken.',
    'map.pharos_town.objects.sign_3': 'Ferry Pier\n"Service suspended for the time being."',
    'map.pharos_town.npcs.otto.name': 'Otto',
    'map.pharos_town.npcs.otto.title': 'Lighthouse Keeper',
    'map.pharos_town.npcs.gateguard.name': 'Gatekeeper',
    'map.pharos_town.npcs.tadeo.name': 'Tadeo',
    'map.pharos_town.npcs.tadeo.title': 'Lampkeepers\' Oil Seller',
    'map.pharos_town.npcs.yena.name': 'Yena',
    'map.pharos_town.npcs.yena.title': 'Order of the Still Night',
    'map.pharos_town.npcs.dog.name': 'Dog',
    'map.pharos_town.npcs.lines.0.text': 'The dog is wagging its tail.',
    'map.pharos_town.npcs.berna.name': 'Berna',
    'map.pharos_town.pharos.name': 'Port Pharos',
    'map.pharos_town.pharos.name_ruby': '',
    'map.pharos_town.pharos.meta.sub': 'Town of sea breeze and lighthouse',
  });
})(window.RPG);
