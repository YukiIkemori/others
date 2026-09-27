// MENUS: 初めての仕組みの説明の札（R.DB.tips、K.tip）と、画面 'tip'・'letter'（MODERN_UI §5.7、V2_PLAN §2.11）
//   R.Screens.tip(id) → 1 回だけ（見たら R.Game.flags['tip_<id>']）。設定 › 遊び方 から読み直せる（{force:true}）。
//   R.Screens.open('letter', {id}) → R.DB.letters[id]（K.letter、中身は CONTENT）を羊皮紙の札で。
// 数字の効果は書かない（A17）。「オート」の字は使わない（A26）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };   // 読み込み順に依らない登録
  const u = (v) => R.UIK.u(v);

  R.defs('tips', {
    glimmer: { title: '閃き', text: '戦いの最中、仲間が新しい技や術を思いつくことがある。\n閃いた技は、メニューの「技・術」で見られる。\n強い相手ほど、閃きやすい。' },
    row: { title: '前列と後列', text: '仲間は前列と後列に並ぶ。\n後列は狙われにくいが、弓と杖のほかは前まで届かない。\n並びはメニューの「並びと隊列」で変えられる。' },
    leads: { title: '手がかり帳', text: '聞いた話は、手がかり帳に書き留められる。\nメニューの「年代記・手がかり」で読み、Y で目印を付けると、\n右上の札と地図に印が出る。' },
    spring: { title: '回復の泉', text: '泉で休むと、仲間全員の HP と MP が戻り、\n倒れた人も起き上がる。控えの仲間も元気になる。\n何度でも使える。' },
    chest: { title: '宝箱', text: 'ダンジョンでは、階の名前の横に\n開けた宝箱の数が出る。\n開けていない宝箱は、地図にも印が出る。' },
    secret: { title: '隠し通路', text: '壁の中には、通り抜けられる所がある。\n一度見つけた通路は、壁の縁に細い印が付く。' },
    fullheal: { title: '満タン', text: 'メニューで X を押すと、覚えている回復の術を\n効きのよい順に使って HP を満たす。\n足りなければ、確かめてから安い回復の道具を使う。' },
    repeat: { title: 'リピート', text: '「リピート」は、前のラウンドと同じ手を\nみんなでくり返す。B を押すまで続く。' },
    speed: { title: '戦闘の速さ', text: '戦闘中に R で倍速を切り替えられる。\n敵の構え（予告）からは目を離さないように。' },
    telegraph: { title: '大技の予告', text: '強い敵は、大技の前に構えを見せる。\n画面の端の言葉を読んで、守りや並びで備えよう。' },
    steal: { title: '盗む', text: '短剣の技などで、敵から品を盗める。\nめったに手に入らない品を持つ魔物もいる。' },
    equip: { title: '装備', text: '武器は 1 つ、防具は盾・頭・体・手・足、\nアクセサリは 2 つまで付けられる。\nX で「いちばん強く」をまとめて選べる（アクセサリは変えない）。' },
    warp: { title: 'ワープと脱出', text: 'メニューの「ワープ」で、行ったことのある町や\nダンジョンの入口へ飛べる。\nダンジョンの中では「脱出」で入口へ戻れる。' },
    bestiary: { title: '図鑑', text: '出会った魔物は図鑑に載る。\n落とし物や盗んだ品は、手に入れると名前が埋まる。' },
    save: { title: 'セーブ', text: '戦闘の外なら、いつでも記録できる。\n町やダンジョンの階に入ったとき、戦闘に勝ったときは\nオートセーブの枠にも書かれる。' },
    dark: { title: '暗がり', text: '暗がりでは、ランタンの届く所しか見えない。\nしょく台に火をともすと、周りが明るくなる。' },
    waylamp: { title: '道しるべの灯籠', text: '火のともった灯籠の周りには、\n魔物が寄ってこない。' },
    tavern: { title: '仲間の入れ替え', text: 'ファロスの潮風亭では、一緒に旅する仲間を\n入れ替えられる。控えの仲間も、戦いのあとの伸びを少し分けてもらえる。' },
  });

  // ---------------------------------------------------------------- 説明の札
  S.def('tip', {
    opaque: false, dim: 0.5,
    init(p) {
      this.tip = (R.DB.tips || {})[p.id] || { title: '説明', text: '' };
      if (R.Game && R.Game.flags && p.id) R.Game.flags['tip_' + p.id] = true;
    },
    update() {
      const I = R.Input;
      if (I.pressed('a') || I.pressed('b') || (I.pointer.pressed && this.rect && R.UIK.hit(this.rect, I.pointer.x, I.pointer.y)) || (I.pointer.pressed && I.lastDevice === 'touch')) {
        R.UIK.sfx('confirm'); this.close();
      }
    },
    draw(g) {
      const C = R.UIK.T.color, t = this.tip;
      const w = Math.min(R.W - u(40), u(520));
      const text = Array.isArray(t.text) ? t.text.join('\n') : String(t.text || '');
      const lines = R.UIK.wrap(text, w - u(56), { size: u(15) });
      const h = u(78) + lines.length * u(27) + u(52);
      const x = (R.W - w) / 2, y = (R.H - h) / 2;
      this.rect = { x, y, w, h };
      R.UIK.panel(g, this.rect, { dense: true, frost: true });
      R.UIK.icon(g, 'bulb', x + u(26), y + u(24), u(20), C.teal);
      R.UIK.text(g, 'はじめての説明', x + u(54), y + u(27), { size: u(11.5), weight: 700, color: C.teal, track: u(2) });
      R.UIK.text(g, t.title, x + u(26), y + u(48), { size: u(20), weight: 700, color: C.goldHi });
      R.UIK.rule(g, x + u(26), x + w - u(26), y + u(80), 0.16);
      let cy = y + u(92);
      for (const l of lines) { R.UIK.text(g, l, x + u(28), cy, { size: u(15), color: C.text }); cy += u(27); }
      R.UIK.text(g, 'あとで「設定 › 遊び方」から読み直せる', x + u(26), y + h - u(30), { size: u(11.5), color: C.text3 });
      R.UIK.prompts(g, [{ btn: 'a', label: '閉じる' }], { x: x + w - u(22), y: y + h - u(24), align: 'right' });
    },
  });

  // ---------------------------------------------------------------- 手紙（羊皮紙）
  S.def('letter', {
    opaque: false, dim: 0.55,
    init(p) {
      const L = (R.DB.letters || {})[p.id] || { title: '手紙', text: '' };
      this.L = L;
      this.text = Array.isArray(L.text) ? L.text.join('\n') : String(L.text || '');
    },
    update() {
      const I = R.Input;
      if (I.pressed('a') || I.pressed('b') || (I.pointer.pressed && this.rect && R.UIK.hit(this.rect, I.pointer.x, I.pointer.y)) || (I.pointer.pressed && I.lastDevice === 'touch')) {
        R.UIK.sfx('confirm'); this.close();
      }
    },
    draw(g) {
      const C = R.UIK.T.color, L = this.L, tall = R.layout === 'tall';
      const w = Math.min(R.W - u(tall ? 28 : 60), u(600));
      const tw = w - u(88);
      const lines = R.UIK.wrap(this.text, tw, { size: u(16.5) });
      const face = L.face && R.UIK.hasFace(L.face);
      const h = u(118) + lines.length * u(30) + u(66);
      const x = (R.W - w) / 2, y = Math.max(u(16), (R.H - h) / 2);
      this.rect = { x, y, w, h };
      if (R.UIK.paper) R.UIK.paper(g, this.rect, {}); else R.UIK.panel(g, this.rect, { dense: true });
      const ink = C.ink || '#3a2a1a', ink2 = C.ink2 || '#6b5638';
      let cy = y + u(38);
      if (face) { R.UIK.portraitFrame(g, { x: x + w - u(44) - u(72), y: y + u(28), w: u(72), h: u(72) }, L.face, { bg: ['#d8c6a0', '#b89c70'] }); }
      R.UIK.text(g, L.title || '手紙', x + u(44), cy, { size: u(21), weight: 700, color: C.inkName || '#9a5a1a', maxW: w - u(88) - (face ? u(84) : 0) });
      cy += u(34);
      if (L.from) R.UIK.text(g, L.from + ' より', x + u(46), cy, { size: u(13), color: ink2 });
      cy += u(30);
      R.UIK.rule(g, x + u(40), x + w - u(40), cy - u(8), 0, C.inkLine || 'rgba(70,50,26,0.35)');
      cy += u(8);
      for (const l of lines) { R.UIK.text(g, l, x + u(46), cy, { size: u(16.5), color: ink }); cy += u(30); }
      // 送りの菱形
      const t = (R.Engine.time % 1200) / 1200;
      R.UIK.diamond(g, x + w - u(40), y + h - u(34) + Math.sin(t * Math.PI * 2) * u(1.5), u(5), '#a8672a');
      R.UIK.prompts(g, [{ btn: 'a', label: '閉じる' }], { x: x + w - u(58), y: y + h - u(34), align: 'right' }, { color: ink2, shadow: false });
    },
  });
})(window.RPG);
