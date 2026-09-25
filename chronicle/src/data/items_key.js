// 大事なもの（type:'key'）18。担当 gear-b（A10b）。正は DESIGN.md §8.10（id・use）と §10.13.6（名前・説明・手に入る所）。
// 例外 1 つ: k_quill の説明は BRIEF Part A6（ワープ先にダンジョンの入口）に合わせた（下の注）。
//
//   { name, type:'key', price:0, desc, sort, icon（'icon:key'。羽ペンは icon:feather、鈴は icon:bell）, use?: { target:'self', effects:[{type:'teleport'}|{type:'exit'}], field:true, battle:false } }
//
// - 使っても減らない。捨てられない。売れない（price 0）。数は 1 つ（2 つ目は渡さない。ev.give / R.State.addItem が見る）。
// - k_quill（ワープ）と k_bell（脱出）は飾りの品（§8.0 の 0.10）。使うとメニューの「ワープ」「脱出」と同じ
//   R.Field.teleport / R.Field.exitDungeon を呼ぶ（menu が effects の teleport / exit を見て呼ぶ）。
//   ダンジョンの中のワープは「ここでは使えない。」、脱出は map.escape のあるマップだけ（§8.10）。
// - k_chronicle はメニューの「年代記」を出す条件（§3.3.12）。k_page_* は地方をクリアしたとき ev.clearRegion が渡す
//   （DB.regions[id].fragment）。
(function (R) {
  'use strict';

  const K = (name, desc, o) => Object.assign({ name, type: 'key', price: 0, desc, icon: 'icon:key' }, o || {});
  const FIELD = (effect) => ({ target: 'self', effects: [{ type: effect }], field: true, battle: false });
  const PAGE = '始まりの年代記から\n破り取られた1枚。';

  const KEYS = {
    // 序章 P10 / P7
    k_chronicle:      K('年代記', '語り部の本。集めた伝承が\n章になって記されていく。'),
    // 説明は §10.13.6 の「行ったことのある町へ\n一瞬で移動できる。」から直した: ワープ先には入ったことのある
    // ダンジョンの入口も入る（BRIEF Part A6。DESIGN §10.6.3・§11.7.12 は取り込み済みで、§10.13.6 の文だけが古い）
    k_quill:          K('語り部の羽ペン', '行ったことのある町や\nダンジョンの入口へ一瞬で移動できる。', { icon: 'icon:feather', use: FIELD('teleport') }),
    k_bell:           K('帰り道の鈴', 'ダンジョンの中から\n外へ脱出できる。', { icon: 'icon:bell', use: FIELD('exit') }),
    k_lighthouse_key: K('灯台の鍵', 'ファロス灯台の扉の鍵。'),
    // 年代記のページ 8（地方の順。§10.2.3）
    k_page_forest:    K('森のページ', PAGE),
    k_page_desert:    K('砂のページ', PAGE),
    k_page_snow:      K('氷のページ', PAGE),
    k_page_marsh:     K('霧のページ', PAGE),
    k_page_isles:     K('潮のページ', PAGE),
    k_page_mine:      K('鉄のページ', PAGE),
    k_page_ash:       K('灰のページ', PAGE),
    k_page_star:      K('星のページ', PAGE),
    // 地方の鍵（地方の中で手に入り、地方の中で使う。クリア後も持ったまま）
    k_winter_flame:   K('冬至の火種', 'ユールのかまどでともした火。\n氷をとかす。'),
    k_marsh_key:      K('鐘の鍵', '鐘沈みの沼の鐘の鎖を\n引くための鍵。'),
    k_shanty:         K('舟歌の貝がら', 'グレン船長の舟歌が\n刻まれた貝がら。'),
    k_oath_hammer:    K('誓いのハンマー', '鍛冶神の誓いが彫られた\n古いハンマー。'),
    k_star_chart:     K('星図', '賢者カペラが星の名を\n書き込んだ星図。'),
    // 終盤（T7）
    k_rowell_note:    K('ロウェルの手帳', '大書庫の封印を開ける\n言葉が書いてある。'),
  };

  const IDS = Object.keys(KEYS);
  IDS.forEach((id, i) => { KEYS[id].sort = 9000 + i; });
  Object.assign(R.DB.items, KEYS);

  R.ItemsKey = {
    ids: () => IDS.slice(),
    pages: () => IDS.filter((id) => id.startsWith('k_page_')),
  };

  R.onData(() => {
    const fill = R.Rules && R.Rules.fillItem;
    if (!fill) return;
    for (const id of IDS) { try { fill(R.DB.items[id]); } catch (e) { R.loadErrors.push(`fillItem ${id}: ${e && e.message}`); } }
  });
})(window.RPG);
