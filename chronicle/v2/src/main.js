// 起動（CORE）: 全ファイルを読んだ後に 1 回。仮の実装の穴埋め → データの後処理 → 起動の仕事 → タイトル
// R.Flow: タイトル → 新しいゲーム／つづき の流れ（タイトルの画面は MENUS、始まりの場所は R.DB.config.start）
(function (R) {
  'use strict';

  const Flow = (R.Flow = {
    /** 全部の場面を閉じてタイトルへ */
    async title() {
      R.Engine.clear();
      R.Engine.fade.a = 0;
      R.Game = null;
      R.Input.touchLayout('menu');
      // 起動して最初だけ BGM を 1.2 秒のフェードで入れ、タイトルは出てくる順を見せる（design/TITLE_ART.md §4・§5）
      const first = !Flow._titled;
      Flow._titled = true;
      R.Audio.bgm('title', { fade: first ? 1200 : 600 });
      const r = await R.Screens.open('title', { intro: first });
      if (r && r.cmd === 'continue' && R.Save.load(r.slot)) return Flow.resume();
      if (r && (r.cmd === 'load' || r.cmd === 'passphrase') && R.Game) return Flow.resume();   // 記録を選ぶ・冒険の合言葉は画面の中で読み込み済み
      return Flow.newGame(r || {});
    },
    /** 新しいゲーム。R.DB.config.start = {map, spawn, event?} */
    async newGame(o) {
      o = o || {};
      const s = (R.DB.config && R.DB.config.start) || {};
      // タイトルの「はじめから」は暗転して閉じる（o.faded）: 次の場面の幕が出たところで明ける
      const unfade = () => { if (o.faded) { o.faded = false; R.Engine.fadeTo(0, 300); } };
      if (!s.event) unfade();
      const hero = o.hero || (s.event ? null : await R.Screens.open('charcreate'));
      R.State.newGame({ hero, seed: o.seed });
      await R.Field.enter(s.map, s.spawn, { fade: 0, noAutosave: true });
      unfade();
      if (s.event) await R.Events.run(s.event, { map: s.map });
    },
    /** 読み込んだ R.Game の場所から続ける */
    async resume() {
      const p = R.Game.pos || {};
      await R.Field.enter(p.map, { x: p.x, y: p.y, dir: p.dir }, { fade: 260, noAutosave: true });
    },
    /**
     * 全滅して「宿から」「タイトルへ」を選んだ後の共通の片付け（契約の版 2、§2.5.3）。
     * 呼ぶのは BSCENE だけ: 戦闘の場面を外した後、R.Battle.start の Promise を {result:'abort', to} で解決する**前**に await する。
     *   'inn'  : 走っているイベントを R.Events.abort()（ev.battle はその後の guard で止まる）→ 開いた画面・会話を閉じる →
     *            R.Game.lastInn（{map,x,y,dir}）→ 無ければ lastTown → 無ければ R.DB.config.start へ R.Field.enter
     *            （所持金半分と全快 = R.State.wipeRecover() は BSCENE が先に呼ぶ）
     *   'title': R.Events.abort() → R.Flow.title()（await しない。タイトルの画面が開いたら戻る）
     * FIELD（歩いて出た戦闘）と EVENTS（ev.battle）は 'abort' を受けても何もしなくてよい。
     */
    async wipe(to) {
      if (R.Events && R.Events.busy && R.Events.busy()) R.Events.abort();
      if (to === 'title') { Flow.title(); return; }
      // フィールドより上に積まれた物（メニュー・会話）を閉じる
      const st = R.Engine.stack;
      for (let i = st.length - 1; i >= 0; i--) { if (st[i].id === 'field') break; R.Engine.remove(st[i]); }
      if (R.UIK && R.UIK.Message && R.UIK.Message.busy()) R.UIK.Message.close();
      const G = R.Game || {};
      const s = (R.DB.config && R.DB.config.start) || {};
      const p = G.lastInn || G.lastTown || null;
      if (p && p.map) await R.Field.enter(p.map, p.x != null ? { x: p.x, y: p.y, dir: p.dir || 's' } : p.spawn, { fade: 260, noAutosave: true });
      else await R.Field.enter(s.map, s.spawn, { fade: 260, noAutosave: true });
    },
  });

  function waitFonts() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
    const loads = ['500 16px "Zen Maru Gothic"', '700 16px "Zen Maru Gothic"', '400 16px "Cinzel"', '700 16px "Cinzel"']
      .map((f) => document.fonts.load(f, 'あ灯A').catch(() => null));
    // 起動の待ちだけは実時間で数える（Engine はまだ回っていない）
    return Promise.race([Promise.all(loads), new Promise((res) => setTimeout(res, 2500))]);
  }

  R.boot = async function () {
    if (R._booted) return;
    R._booted = true;
    const canvas = document.getElementById('screen');
    R.Stubs.install();
    R.runDataHooks();
    R.Settings.load();
    R.Gfx.init(canvas);
    R.fit(true);
    window.addEventListener('resize', () => R.fit());
    window.addEventListener('orientationchange', () => R.fit());
    R.Input.init(canvas);
    R.Input.onAnyPress(() => { try { R.Audio.init(); } catch (e) { console.error(e); } });
    // 読み込みの画面（主人公が進みの棒の上を走る。core/loading.js）: 書体と起動の仕事（原画・素材の先読み）の間
    if (R.Loading) R.Loading.boot();
    await waitFonts();
    R.Engine.addTick((dt, real) => { if (R.Game && R.Engine.has('field')) R.Game.playMs = (R.Game.playMs || 0) + real; });
    // 焼く列（版 2）: 毎フレーム R.Hd.pump(予算 3 ms) を CORE が 1 回だけ呼ぶ。ほかの担当は pump を呼ばない（暗転中の同期の焼きは R.Hd.now）
    R.Engine.addTick(() => { if (R.Hd && R.Hd.pump) R.Hd.pump((R.Hd.BUDGET && R.Hd.BUDGET.frameBakeMs) || 3); });
    for (const fn of R._bootHooks) { try { await fn(); } catch (e) { console.error('boot hook failed', e); } }
    if (R.Loading) R.Loading.bootDone();
    R.Engine.start(canvas);
    if (R.loadErrors.length) console.error('LOAD ERRORS:\n' + R.loadErrors.join('\n'));
    R.emit('booted');
    if (R.devBoot && (await R.devBoot())) return; // dev.html だけ: ?fixture= / ?scene=（src/dev/fixtures.js）
    Flow.title();
  };

  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'complete') R.boot();
    else window.addEventListener('load', () => R.boot());
  }
})(window.RPG);
