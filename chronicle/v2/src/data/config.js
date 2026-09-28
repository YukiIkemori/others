// EVENTS — ゲームの設定 R.DB.config（V2_PLAN §2.5.10・§3.1・§3.13。移植の元は chronicle/src/data/config.js）
//   start          「はじめから」の場所 {map, spawn, event}: ロアの里のベルナの家で目を覚ます（P1）。
//                  event の roa_house_intro（C-P）が ev.createHero() で主人公を作る。
//                  P1 の間だけ: roa_house と roa_house_intro の両方がそろうまでは（CONTENT の作業中）、仮の一本道（stub_road）から始める
//                  （起動の通し tools/test_core_flow.js を止めない。そろった時点で CORE の通しのテストは序章に合わせ直す）
//   slice          縦切り（{slice:true} の条件・手がかりの slice:'locked'）
//   sliceOpen      体験版（slice の間）で行ける地方の region。ほかの地方の手がかりは帳で「まだ語られていない」（R.Leads.locked）。
//                  行けないこと自体はワールドの峠の崖崩れと番人（cond {slice:true}）
//   startGold / startItems   0 と {}（ベルナが P2 で 50 G と回復の品 3 を渡す）
//   defaultHero    主人公の作成を飛ばしたとき（フィクスチャ・createHero を閉じたまま）の主人公（K.hero）
//   innPrice       ティアごとの宿の値段（R.Tier.innPrice、ev.inn の既定）
//   chronicle      年代記の画面の序章の章（MENUS が読む）
(function (R) {
  'use strict';
  const START = { map: 'roa_house', spawn: 'bed', event: 'roa_house_intro' };
  const C = R.DB.config;
  Object.defineProperty(C, 'start', {
    enumerable: true, configurable: true,
    get() {
      const M = R.DB.maps || {}, E = R.DB.events || {};
      if ((M[START.map] && E[START.event]) || !M.stub_road) return START;
      return { map: 'stub_road', spawn: 'start' };
    },
  });
  Object.assign(C, {
    slice: true,
    sliceOpen: ['prologue', 'r_forest', 'world'],
    startGold: 0,
    startItems: {},
    defaultHero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' },
    innPrice: [10, 16, 24, 32, 42, 54, 66, 80, 96, 112],
    chronicle: {
      prologue: {
        title: '灯台守の歌', flag: 'prologue_done',
        summary: '港町ファロスの灯台は、\n守り歌が忘れられて\n火を失っていた。\n語り部の見習いが歌を\n取り戻し、灯はふたたび\n海を照らした。',
      },
    },
  });
  R.Config = { START };
})(window.RPG);
