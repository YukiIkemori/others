// EVENTS — 大事な物（slot 'key'。K.item）。移植の元は chronicle/src/data/items_key.js（名前・説明はそのまま、形を v2 に）。
//   - 使っても減らない・売れない（price 0）・1 つだけ（R.State.gain が 2 つ目を入れない）。
//   - k_quill（ワープ）・k_bell（脱出）は飾りの品: use.effects の 'warp'・'escape' を見て MENUS が R.Field.warp の一覧・R.Field.escape を呼ぶ。
//   - k_page_<rs> は ev.clearRegion が渡す（R.DB.regions[rid].page で変えられる）。k_chronicle は序章 P10 でベルナが渡す。
//   - 縦切りの森・ファロスの依頼の物（k_pim_hat ほか）は V2_PLAN §3.3・§3.4 から。CONTENT が足りない物は EVENTS に依頼する。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const FIELD = (effect) => ({ target: 'self', effects: [{ type: effect }], field: true, battle: false });
  const PAGE = '始まりの年代記から\n破り取られた1枚。';

  const KEYS = {
    // 序章（P7・P10）
    k_chronicle: K('年代記', '語り部の本。集めた伝承が\n章になって記されていく。', { icon: 'book' }),
    k_quill: K('語り部の羽ペン', '行ったことのある町や\nダンジョンの入口へ一瞬で移動できる。', { icon: 'warp', use: FIELD('warp') }),
    k_bell: K('帰り道の鈴', 'ダンジョンの中から\n外へ脱出できる。', { icon: 'exit', use: FIELD('escape') }),
    k_lighthouse_key: K('灯台の鍵', 'ファロス灯台の扉の鍵。'),
    k_leadbook: K('手がかり帳', '聞いた話を書き留める帳面。\n目印を付けた話は地図に出る。', { icon: 'journal' }),
    // 年代記のページ 8（地方の順）
    k_page_forest: K('森のページ', PAGE, { icon: 'journal' }),
    k_page_desert: K('砂のページ', PAGE, { icon: 'journal' }),
    k_page_snow: K('氷のページ', PAGE, { icon: 'journal' }),
    k_page_marsh: K('霧のページ', PAGE, { icon: 'journal' }),
    k_page_isles: K('潮のページ', PAGE, { icon: 'journal' }),
    k_page_mine: K('鉄のページ', PAGE, { icon: 'journal' }),
    k_page_ash: K('灰のページ', PAGE, { icon: 'journal' }),
    k_page_star: K('星のページ', PAGE, { icon: 'journal' }),
    // 森（V2_PLAN §3.3 F2・§3.4）
    k_pim_hat: K('ピムの帽子', 'ピムがかぶっていた帽子の片方。\n持っていると、森でピムの足あとが光る。', { icon: 'search' }),
    k_moss_ember: K('光る苔の火種', '千年樹の苔から分けてもらった火種。\n消えた道しるべの灯籠にともせる。', { icon: 'lamp' }),
    k_fern_herbs: K('薬草の包み', '迷いの森の広場で摘んだ薬草。\nフェルンの薬草園に届ける。', { icon: 'bag' }),
    k_fern_letters: K('樹上の家への手紙', 'フェルンの樹上の家々に\n届ける手紙の束。', { icon: 'journal' }),
    // ファロス（§3.4）
    k_ship_parcel: K('造船所の届け物', '造船所の見習いから預かった包み。\nフェルンの樵頭ゴードへ届ける。', { icon: 'bag' }),
    // 地方の鍵（残り 7 地方。縦切りでは使わないが id は残す）
    k_winter_flame: K('冬至の火種', 'ユールのかまどでともした火。\n氷をとかす。', { icon: 'fire' }),
    k_marsh_key: K('鐘の鍵', '鐘沈みの沼の鐘の鎖を\n引くための鍵。'),
    k_shanty: K('舟歌の貝がら', 'グレン船長の舟歌が\n刻まれた貝がら。'),
    k_oath_hammer: K('誓いのハンマー', '鍛冶神の誓いが彫られた\n古いハンマー。'),
    k_star_chart: K('星図', '賢者カペラが星の名を\n書き込んだ星図。', { icon: 'map' }),
    k_rowell_note: K('ロウェルの手帳', '大書庫の封印を開ける\n言葉が書いてある。', { icon: 'journal' }),
  };

  const IDS = Object.keys(KEYS);
  IDS.forEach((id, i) => { KEYS[id].sort = 9000 + i; R.def('items', id, KEYS[id]); });

  R.ItemsKey = {
    ids: () => IDS.slice(),
    pages: () => IDS.filter((id) => id.indexOf('k_page_') === 0),
  };
})(window.RPG);
