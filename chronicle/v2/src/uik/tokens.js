// UIK（UI の部品）: トークン R.UIK.T と共通の小道具（V2_PLAN §2.5.6・§2.11、MODERN_UI §3、見本 design/art_proto/ui/kit.js）
//
// R.UIK は 12 のファイルで作る（tokens text panel focus gauge icons list layer message prompts toast portrait_frame）。
// どのファイルも「登録だけ」。DOM に触るのはキャンバスを作る所（snapshot・焼いた文字）だけで、読み込み時には触らない。
// uiScale（§2.11）: primitive（text/measure/fit/panel/card/focus/gauge/icon/stars/portraitFrame）に渡す座標・大きさは
//   掛けた後の論理 px。自分で並ぶ部品（List の rowH・Message・toast・bubble・prompts・chip の o.size）は掛ける前の値を受け取り中で掛ける。
(function (R) {
  'use strict';
  // UIK は名前空間を丸ごと本物で持つ（仮の stub_uik.js で穴を埋めない）
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('UIK');
  const UIK = (R.UIK = R.UIK || {});

  // ---------------------------------------------------------------- トークン（名前は K.uikTokens。値は UIK が決める）
  const T = {
    color: {
      text: '#f6f0e3', text2: '#d2c9b6', text3: '#bbb29f', disabled: '#a39b8b',
      panel: 'rgba(14,16,26,0.74)', panelDense: 'rgba(12,13,22,0.92)', edge: 'rgba(240,228,200,0.14)', edge2: 'rgba(240,228,200,0.30)',
      gold: '#ecc97c', goldHi: '#fff1c8', goldLo: '#b98f47', teal: '#8fd6d8',
      hp: ['#5f9e5a', '#a9dc8e'], hpLow: ['#c0852a', '#f4c86c'], hpCrit: ['#a8402f', '#f07a60'],
      hpAssist: ['#3f7fb8', '#8fd0f4'],          // 色覚の補助（colorAssist）: HP の緑 → 青
      mp: ['#3d6aa6', '#92bdf0'], exp: ['#8a6a2a', '#f0cf7c'],
      up: '#8ee08a', down: '#f47e6c', same: '#8e8878',
      rare: '#86c8ff', superRare: '#ffb65e', front: '#f2c28a', back: '#a9d2f2',
      fire: '#ff8a5a', water: '#6ab8ff', ice: '#9ad8ff', thunder: '#ffe070', wind: '#8ee0a8', earth: '#d8b070', light: '#fff0a0', dark: '#b08ae0',
      // 会話の羊皮紙（MODERN_UI §6.3、STYLE_REFERENCE §7.2）
      paper: ['rgba(240,230,206,0.95)', 'rgba(222,206,176,0.95)'], ink: '#3a2a1a', ink2: '#6b5638', inkName: '#9a5a1a', inkLine: 'rgba(70,50,26,0.35)',
      ink3: '#8a7556', paperFocus: 'rgba(120,80,30,0.14)', paperEdge: 'rgba(70,50,26,0.6)',
      glass: [14, 16, 26],                        // 窓の地の色（rgb）
      bg: '#070812',
    },
    size: { display: 40, h1: 26, h2: 20, title: 17, body: 15, talk: 16.5, label: 13, caption: 11.5, micro: 10 },
    space: { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 },
    radius: 12,
    radii: { s: 4, m: 8, l: 12 },
    pad: 16,
    padTall: 20,
    // 動き（MODERN_UI §3.6）
    ms: { cursor: 80, focus: 120, open: 180, close: 140, screen: 260, place: 2400, toast: 2400, toastIn: 180, toastOut: 300, pulse: 1600, dmgRise: 520 },
    // 行の高さ（掛ける前）
    row: { list: 34, talk: 28, choice: 38 },
    // 会話の窓（MODERN_UI §6.3。掛ける前の論理 px）
    talk: { w: 760, h: 150, face: 118, lines: 3, choiceW: 210 },
    // 文字の速さ（字/秒。設定 textSpeed）と、自動送り（1 字 60 ms ＋ 1.2 秒、MODERN_UI §5.4）
    textSpeed: { slow: 28, normal: 55, fast: 110, instant: 1e9 },
    auto: { perChar: 60, base: 1200 },
    log: 100,
    // 決まった幅（はみ出しの検査で使う。掛ける前）: 5 字の人名・14 字の品名・HP 999/999・MP 250/250
    fitW: { name: 88, item: 230, hp: 74, mp: 62 },
  };
  UIK.T = T;

  /** v × uiScale（位置と大きさを決める側の道具、§2.11） */
  UIK.u = function (v) { return v * (R.uiScale || 1); };
  /** 設定の読み（node や起動前でも既定で動く） */
  UIK.setting = function (key, def) {
    try { const v = R.Settings && R.Settings.get ? R.Settings.get(key) : undefined; return v === undefined ? def : v; } catch (e) { return def; }
  };
  /** 動きを減らす／点滅を減らす */
  UIK.reduceMotion = function () { return !!UIK.setting('reduceMotion', false); };
  UIK.lessFlash = function () { return !!UIK.setting('lessFlash', false); };
  /** 縦持ちか */
  UIK.tall = function () { return R.layout === 'tall'; };
  /** 画面の余白（MODERN_UI §3.7: 16、スマホ 20）を掛けた後の px で */
  UIK.margin = function () { return UIK.u(UIK.tall() ? T.padTall : T.pad); };
  /** フィールドの常時のボタン表示を出すか（設定 prompts: always / first2h / never） */
  UIK.promptsOn = function () {
    const s = UIK.setting('prompts', 'first2h');
    if (s === 'always') return true;
    if (s === 'never') return false;
    const ms = (R.Game && R.Game.playMs) || 0;
    return ms < 2 * 3600 * 1000;
  };
  /** 0〜1 の ease-out */
  UIK.ease = function (k) { k = k < 0 ? 0 : k > 1 ? 1 : k; return 1 - (1 - k) * (1 - k) * (1 - k); };
  /** 効果音（無くても止まらない） */
  UIK.sfx = function (id) { try { if (R.Audio && R.Audio.sfx) R.Audio.sfx(id); } catch (e) { /* 音は無くてよい */ } };
  /** 角丸の道（g の上に path を作るだけ） */
  UIK.rr = function (g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  };
  /** 点が rect の中か */
  UIK.hit = function (rect, x, y) { return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h; };
})(window.RPG);
