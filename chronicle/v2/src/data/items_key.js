// EVENTS — 大事な物（slot 'key'。K.item）。移植の元は chronicle/src/data/items_key.js（名前・説明はそのまま、形を v2 に）。
//   - 使っても減らない・売れない（price 0）・1 つだけ（R.State.gain が 2 つ目を入れない）。
//   - k_quill（ワープ）・k_bell（脱出）は飾りの品: use.effects の 'warp'・'escape' を見て MENUS が R.Field.warp の一覧・R.Field.escape を呼ぶ。
//   - k_page_<rs> は ev.clearRegion が渡す（R.DB.regions[rid].page で変えられる）。k_chronicle は序章 P10 でベルナが渡す。
//   - 縦切りの森・ファロスの依頼の物（k_pim_hat ほか）は V2_PLAN §3.3・§3.4 から。CONTENT が足りない物は EVENTS に依頼する。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const FIELD = (effect) => ({ target: 'self', effects: [{ type: effect }], field: true, battle: false });
  const PAGE = R.T('data.items_key.PAGE');

  const KEYS = {
    // 序章（P7・P10）
    k_chronicle: K(R.T('data.items_key.KEYS.k_chronicle.K'), R.T('data.items_key.KEYS.k_chronicle.K_2'), { icon: 'book' }),
    k_quill: K(R.T('data.items_key.KEYS.k_quill.K'), R.T('data.items_key.KEYS.k_quill.K_2'), { icon: 'warp', use: FIELD('warp') }),
    k_bell: K(R.T('data.items_key.KEYS.k_bell.K'), R.T('data.items_key.KEYS.k_bell.K_2'), { icon: 'exit', use: FIELD('escape') }),
    k_lighthouse_key: K(R.T('data.items_key.KEYS.k_lighthouse_key.K'), R.T('data.items_key.KEYS.k_lighthouse_key.K_2')),
    k_leadbook: K(R.T('data.items_key.KEYS.k_leadbook.K'), R.T('data.items_key.KEYS.k_leadbook.K_2'), { icon: 'journal' }),
    // 年代記のページ 8（地方の順）
    k_page_forest: K(R.T('data.items_key.KEYS.k_page_forest.K'), PAGE, { icon: 'journal' }),
    k_page_desert: K(R.T('data.items_key.KEYS.k_page_desert.K'), PAGE, { icon: 'journal' }),
    k_page_snow: K(R.T('data.items_key.KEYS.k_page_snow.K'), PAGE, { icon: 'journal' }),
    k_page_marsh: K(R.T('data.items_key.KEYS.k_page_marsh.K'), PAGE, { icon: 'journal' }),
    k_page_isles: K(R.T('data.items_key.KEYS.k_page_isles.K'), PAGE, { icon: 'journal' }),
    k_page_mine: K(R.T('data.items_key.KEYS.k_page_mine.K'), PAGE, { icon: 'journal' }),
    k_page_ash: K(R.T('data.items_key.KEYS.k_page_ash.K'), PAGE, { icon: 'journal' }),
    k_page_star: K(R.T('data.items_key.KEYS.k_page_star.K'), PAGE, { icon: 'journal' }),
    // 森（V2_PLAN §3.3 F2・§3.4）
    k_pim_hat: K(R.T('data.items_key.KEYS.k_pim_hat.K'), R.T('data.items_key.KEYS.k_pim_hat.K_2'), { icon: 'search' }),
    k_moss_ember: K(R.T('data.items_key.KEYS.k_moss_ember.K'), R.T('data.items_key.KEYS.k_moss_ember.K_2'), { icon: 'lamp' }),
    k_fern_herbs: K(R.T('data.items_key.KEYS.k_fern_herbs.K'), R.T('data.items_key.KEYS.k_fern_herbs.K_2'), { icon: 'bag' }),
    k_fern_letters: K(R.T('data.items_key.KEYS.k_fern_letters.K'), R.T('data.items_key.KEYS.k_fern_letters.K_2'), { icon: 'journal' }),
    // ファロス（§3.4）
    k_ship_parcel: K(R.T('data.items_key.KEYS.k_ship_parcel.K'), R.T('data.items_key.KEYS.k_ship_parcel.K_2'), { icon: 'bag' }),
    // 地方の鍵（残り 7 地方。縦切りでは使わないが id は残す）
    k_winter_flame: K(R.T('data.items_key.KEYS.k_winter_flame.K'), R.T('data.items_key.KEYS.k_winter_flame.K_2'), { icon: 'fire' }),
    k_marsh_key: K(R.T('data.items_key.KEYS.k_marsh_key.K'), R.T('data.items_key.KEYS.k_marsh_key.K_2')),
    k_shanty: K(R.T('data.items_key.KEYS.k_shanty.K'), R.T('data.items_key.KEYS.k_shanty.K_2')),
    k_oath_hammer: K(R.T('data.items_key.KEYS.k_oath_hammer.K'), R.T('data.items_key.KEYS.k_oath_hammer.K_2')),
    k_star_chart: K(R.T('data.items_key.KEYS.k_star_chart.K'), R.T('data.items_key.KEYS.k_star_chart.K_2'), { icon: 'map' }),
    k_rowell_note: K(R.T('data.items_key.KEYS.k_rowell_note.K'), R.T('data.items_key.KEYS.k_rowell_note.K_2'), { icon: 'journal' }),
  };

  const IDS = Object.keys(KEYS);
  IDS.forEach((id, i) => { KEYS[id].sort = 9000 + i; R.def('items', id, KEYS[id]); });

  R.ItemsKey = {
    ids: () => IDS.slice(),
    pages: () => IDS.filter((id) => id.indexOf('k_page_') === 0),
  };
})(window.RPG);
