// 日本語の文の表（maps_pharos）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/maps_pharos.js に同じ key で）
// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。
(function (R) {
  'use strict';
  R.I18n.add('ja', {
    // ---- src/maps/pharos_interiors.js
    'map.pharos_interiors.pharos_inn': 'ファロスの宿',
    'map.pharos_interiors.pharos_inn.innkeeper.name': '宿のおかみ',
    'map.pharos_interiors.pharos_tavern': '酒場「潮風亭」',
    'map.pharos_interiors.pharos_tavern.master.name': '潮風亭のマスター',
    'map.pharos_interiors.pharos_tavern.gossip.name': 'うわさ好きのおかみ',
    'map.pharos_interiors.pharos_tavern.bard.name': '吟遊詩人',
    'map.pharos_interiors.pharos_tavern.trader.name': '旅の商人',
    'map.pharos_interiors.pharos_tavern.swordsman.name': '旅の剣士',
    'map.pharos_interiors.pharos_shop': 'ファロスの道具屋',
    'map.pharos_interiors.pharos_shop.shopkeeper.name': '道具屋の主人',
    'map.pharos_interiors.pharos_smith': 'ファロスの武具屋',
    'map.pharos_interiors.pharos_smith.smith.name': '武具屋の親方',
    'map.pharos_interiors.pharos_record': '記録院ファロス出張所',
    'map.pharos_interiors.pharos_record.rowell.name': '若い記録官',
    'map.pharos_interiors.pharos_record.clerk.name': '書記',
    'map.pharos_interiors.pharos_shipyard': '造船所の小屋',
    'map.pharos_interiors.pharos_shipyard.shipwright.name': '造船所の職人',
    'map.pharos_interiors.pharos_shipyard.apprentice.name': '見習い',
    // ---- src/maps/pharos_town.js
    'map.pharos_town.objects.sign': '港町ファロス\n西へ出れば、半島の街道。',
    'map.pharos_town.objects.sign_2': '造船所\n小舟の修理、承ります。',
    'map.pharos_town.objects.sign_3': '定期船の桟橋\n「しばらく欠航いたします。」',
    'map.pharos_town.npcs.otto.name': 'オットー',
    'map.pharos_town.npcs.otto.title': '灯台守',
    'map.pharos_town.npcs.gateguard.name': '門番',
    'map.pharos_town.npcs.tadeo.name': 'タデオ',
    'map.pharos_town.npcs.tadeo.title': '灯守組合の油売り',
    'map.pharos_town.npcs.yena.name': 'イェナ',
    'map.pharos_town.npcs.yena.title': '静夜会',
    'map.pharos_town.npcs.dog.name': 'いぬ',
    'map.pharos_town.npcs.lines.0.text': 'いぬが、しっぽをふっている。',
    'map.pharos_town.npcs.berna.name': 'ベルナ',
    'map.pharos_town.pharos.name': '港町ファロス',
    'map.pharos_town.pharos.name_ruby': 'みなとまちふぁろす',
    'map.pharos_town.pharos.meta.sub': '潮風と灯台の町',
  });
})(window.RPG);
