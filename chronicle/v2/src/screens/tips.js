// MENUS: 初めての仕組みの説明の札（R.DB.tips、K.tip）と、画面 'tip'・'letter'（MODERN_UI §5.7、V2_PLAN §2.11）
//   R.Screens.tip(id) → 1 回だけ（見たら R.Game.flags['tip_<id>']）。設定 › 遊び方 から読み直せる（{force:true}）。
//   R.Screens.open('letter', {id}) → R.DB.letters[id]（K.letter、中身は CONTENT）を羊皮紙の札で。
// 数字の効果は書かない（A17）。「オート」の字は使わない（A26）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };   // 読み込み順に依らない登録
  const u = (v) => R.UIK.u(v);

  // 文の中の {btn:x} は今の入力のボタンの字（キーボード Q・パッド L など。R.Input.prompt）。1〜3 行（オーナー 2026-09-28「短く」）
  R.defs('tips', {
    glimmer: { title: '閃き', text: '戦いの最中、仲間が新しい技や術を閃くことがある。\n閃いた技と術は、メニューの「技・術」で見られる。\n強い相手ほど、閃きやすい。' },
    prof: { title: '熟練度', text: '武器の技や術は、使うほど熟練度が上がる。\n熟練度が高いほど、その武器や属性がよく効く。\n上がった所は「強さ」の画面に ▲ で出る。' },
    row: { title: '前列と後列', text: '後列は狙われにくいが、弓と杖のほかは前まで届かない。\n並びはメニューの「隊列」で変えられる。' },
    leads: { title: '手がかり帳', text: '聞いた話は、手がかり帳に書き留められる。\n「年代記・手がかり」で目印を付けると、右上の札と地図に印が出る。\n次にやることは、メニューの上とフィールドの {btn:l} で見られる。' },
    spring: { title: '女神の像', text: '女神の像に祈ると、控えも含めて全員の HP と MP が戻り、\n倒れた人も起き上がる。何度でも使える。\n町やオアシスの泉で休んでも同じ。' },
    chest: { title: '宝箱', text: '開けていない宝箱は、地図にも印が出る。' },
    secret: { title: '隠し通路', text: '壁の中には、通り抜けられる所がある。\n一度見つけた通路は、壁の縁に細い印が付く。' },
    fullheal: { title: '満タン', text: 'メニューで {btn:x} を押すと、回復の術を効きのよい順に使って HP を満たす。\n足りなければ、確かめてから安い回復の道具を使う。' },
    repeat: { title: 'リピートと速さ', text: '{btn:l} で「リピート」: 前のラウンドと同じ手を、みんなでくり返す。\nもう一度 {btn:l} か {btn:b} でやめる。\n{btn:r} で戦闘の速さを切り替えられる。' },
    speed: { title: '戦闘の速さ', text: '戦闘中に {btn:r} で速さを切り替えられる。\n敵の構え（予告）からは目を離さないように。' },
    telegraph: { title: '大技の予告', text: '強い敵は、大技の前に構えを見せる。\n画面の端の言葉を読んで、守りや並びで備えよう。' },
    steal: { title: '盗む', text: '短剣の技などで、敵から品を盗める。\nめったに手に入らない品を持つ魔物もいる。\n盗んだ品は図鑑にも載る。' },
    equip: { title: '装備', text: '武器・盾・頭・体・手・足と、アクセサリ 2 つの 8 か所に付けられる。\n{btn:x} で「いちばん強く」をまとめて選べる（アクセサリは変えない）。\n{btn:l}・{btn:r} で仲間を切り替える。' },
    tavern: { title: '仲間', text: '潮風亭には 20 人の腕利きがいて、一緒に旅するのは 3 人。\n仲間は、あとで潮風亭のマスターに頼めば入れ替えられる。\n控えの仲間も、戦いのあとの伸びを少し分けてもらえる。' },
    zonelock: { title: '魔物の強さ', text: '地方の事件を解決すると、その地方の魔物はそのときの強さのまま。\nまだ解決していない地方の魔物は、旅が進むほど手ごわくなる。' },
    stone: { title: '魔石', text: '魔石を仲間に使うと、その属性の最初の術を覚える。\nメニューの「道具」から、覚えさせたい仲間を選んで使う。\nもう覚えている人には使えない（石は減らない）。' },
    warp: { title: 'ワープと脱出', text: 'メニューの「ワープ」で、行ったことのある町やダンジョンの入口へ飛べる。\nダンジョンの中では「脱出」で入口へ戻れる。' },
    bestiary: { title: '図鑑', text: '出会った魔物は図鑑に載る。\n落とし物や盗んだ品は、手に入れると名前が埋まる。' },
    save: { title: 'セーブ', text: '戦闘の外なら、いつでも記録できる。\n町やダンジョンの階に入ったとき、戦闘に勝ったときは\nオートセーブの枠にも書かれる。' },
    dark: { title: '暗がり', text: '暗がりでは、ランタンの届く所しか見えない。\nしょく台に火をともすと、周りが明るくなる。' },
    waylamp: { title: '道しるべの灯籠', text: '火のともった灯籠の周りには、\n魔物が寄ってこない。' },
  });

  /** 説明の札の文（{btn:x} をボタンの字に） */
  S.tipText = function (t) {
    const text = Array.isArray(t && t.text) ? t.text.join('\n') : String((t && t.text) || '');
    return text.replace(/\{btn:([a-z]+)\}/g, (m, b) => {
      try { const p = R.Input.prompt(b); return p && p.label ? p.label : b.toUpperCase(); } catch (e) { return b.toUpperCase(); }
    });
  };

  // ---------------------------------------------------------------- 初めての時に出す（仕組みが初めて出てきた所。1 回だけ、R.Game.flags.tip_<id>）
  //   出来事（R.on）で「出す札」を積み、フィールドが一番上で落ち着いた（会話・暗転・メニュー・手がかりの通知が無い）ところで 1 枚ずつ開く。
  //   画面の札（装備・仲間選び・ワープ…）は、その画面が開いた次のフレームに画面の上へ。戦闘のリピートは、リピートが使える最初の命令の時。
  //   dev.html のフィクスチャ（?fixture= / ?scene=）と node では出さない（ほかの担当の撮影・テストを止めない）。?tips=1 か S.autoTips = 'force' で出す。
//   S.autoTips = false で止める。
  S.autoTips = true;
  const SCREEN_TIPS = { equip: 'equip', partySelect: 'tavern', tavern: 'tavern', warp: 'warp', bestiary: 'bestiary', order: 'row' };
  const tq = { list: [], game: null, busy: false, screen: null, installed: false };
  function query() { try { return (typeof location !== 'undefined' && location.search) || ''; } catch (e) { return ''; } }
  function autoOn() {
    if (!S.autoTips || !R.Game) return false;
    if (S.autoTips === 'force') return true;
    if (typeof document === 'undefined') return false;   // node（tools/lib/load.js）のテストでは出さない
    const q = query();
    if (/[?&]tips=1/.test(q)) return true;
    if (/[?&](fixture|scene)=/.test(q)) return false;
    return true;
  }
  /** 旅（R.Game）が替わったら積んだ札を忘れる */
  function syncGame() { if (tq.game !== R.Game) { tq.game = R.Game || null; tq.list.length = 0; tq.screen = null; } }
  const seen = (id) => !!(R.Game && R.Game.flags && R.Game.flags['tip_' + id]);
  /** 札を積む（もう見た・無い id は何もしない）。→ 積んだら true */
  S.tipLater = function (id) {
    if (!id || !R.DB.tips || !R.DB.tips[id] || seen(id) || !autoOn()) return false;
    syncGame();
    for (let i = tq.list.length - 1; i >= 0; i--) if (seen(tq.list[i])) tq.list.splice(i, 1);   // ほかの道で見た札は外す
    if (tq.list.includes(id)) return false;
    tq.list.push(id);
    installTips();
    return true;
  };
  S._tipQueue = () => tq.list.slice();
  function fieldCalm() {
    const E = R.Engine, top = E && E.top && E.top();
    if (!top || top.id !== 'field' || E.fade.a > 0.01) return false;
    if (R.Events && R.Events.busy && R.Events.busy()) return false;
    if (R.Field && R.Field._locked && R.Field._locked()) return false;
    if (R.Leads && R.Leads._current && R.Leads._current()) return false;
    return true;
  }
  function openTip(id) {
    tq.busy = true;
    Promise.resolve(S.tip(id)).catch((e) => R.warn('tip ' + id, e && e.message)).then(() => { tq.busy = false; });
  }
  function tipTick() {
    if (!R.Game || tq.busy) return;
    syncGame();
    const top = R.Engine.top && R.Engine.top();
    // 画面の札: 開いた画面が一番上（小さな選択の窓が無い）なら、その上に
    if (tq.screen) {
      const want = tq.screen;
      if (!top || top.id !== 'screen:' + want.screen) { if (!R.Engine.has('screen:' + want.screen)) tq.screen = null; }
      else if (!(top.view && top.view.modal)) { tq.screen = null; if (!seen(want.tip)) { openTip(want.tip); return; } }
    }
    // 戦闘のリピート: 2 ラウンド目の命令（リピートが使える）で 1 回
    if (top && top.id === 'battle' && !seen('repeat') && autoOn() && R.DB.tips.repeat) {
      const st = R.Battle && R.Battle.debug ? R.Battle.debug() : null;
      if (st && st.phase === 'input' && (st.partyOpts || []).includes('repeat') && !(st.setup && st.setup.autoInput) && !(st.B && st.B.repeatOn)) { openTip('repeat'); return; }
    }
    if (!tq.list.length || !fieldCalm()) return;
    const id = tq.list.shift();
    if (!seen(id)) openTip(id);
  }
  function installTips() {
    if (tq.installed || !R.Engine || !R.Engine.addTick) return;
    tq.installed = true;
    R.Engine.addTick(tipTick);
  }
  const isStone = (id) => { const it = R.DB.items && R.DB.items[id]; return !!(it && (it.stone || (it.use && (it.use.effects || []).some((e) => e && e.type === 'learnSpell')))); };
  const isStealTech = (id) => { const t = R.DB.techs && R.DB.techs[id]; return !!(t && (t.effects || []).some((e) => e && e.type === 'steal')); };
  function partyCanSteal() {
    const G = R.Game;
    if (!G || !G.chars) return false;
    return (G.party || []).some((id) => { const c = G.chars[id]; return !!(c && (c.techs || []).some(isStealTech)); });
  }
  // 出来事の聞き手（読み込み時に登録だけ。R.on はほかのファイルに触れない）
  if (R.on) {
    R.on('scene:push', (e) => {
      const id = e && typeof e.id === 'string' && e.id.indexOf('screen:') === 0 ? e.id.slice(7) : null;
      const tip = id && SCREEN_TIPS[id];
      if (!tip || seen(tip) || !autoOn()) return;
      syncGame();
      tq.screen = { screen: id, tip };
      installTips();
    });
    R.on('battle:start', () => { if (!seen('repeat') && autoOn()) installTips(); });
    R.on('glimmer', (e) => {
      S.tipLater('glimmer');
      if (e && e.kind !== 'spell' && isStealTech(e.id)) S.tipLater('steal');
    });
    R.on('battle:end', (res) => {
      const rw = (res && res.rewards) || {};
      if (rw.glimmers && rw.glimmers.length) S.tipLater('glimmer');
      // 1 回の戦闘の後に札を重ねすぎない: 閃きの札を出すときは、熟練度は次に上がった時
      if (rw.prof && rw.prof.length && !(tq.list.includes('glimmer') && !seen('glimmer'))) S.tipLater('prof');
      if ((rw.stolen && rw.stolen.length) || partyCanSteal()) S.tipLater('steal');
    });
    R.on('chest:open', () => S.tipLater('chest'));
    R.on('item:gain', (e) => { if (e && isStone(e.id)) S.tipLater('stone'); });
    R.on('region:clear', () => S.tipLater('zonelock'));
    R.on('spring:use', () => S.tipLater('spring'));
    R.on('secret:found', () => S.tipLater('secret'));
  }

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
      const w = Math.min(R.W - u(40), u(600));
      const text = S.tipText(t);
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
      R.UIK.prompts(g, [{ btn: 'a', label: '閉じる' }], { x: x + w - u(58), y: y + h - u(34), align: 'right' }, { color: ink, shadow: false });
    },
  });
})(window.RPG);
