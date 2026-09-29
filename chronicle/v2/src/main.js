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
      await Flow.ready();   // 起動の先読みの後（R.onBoot の差し込み＝製品版の引き継ぎなども済んでから）
      if (r && r.cmd === 'continue' && R.Save.load(r.slot)) return Flow.resume();
      if (r && (r.cmd === 'load' || r.cmd === 'passphrase') && R.Game) return Flow.resume();   // 記録を選ぶ・冒険の合言葉は画面の中で読み込み済み
      return Flow.newGame(r || {});
    },
    /** 起動の先読み（R.bootReady）の終わりを待つ。長いときは右下に小さな進み（R.Loading.wait）。→ Promise */
    ready() {
      const p = R.bootReady;
      if (!p || Flow._ready) return Promise.resolve();
      p.then(() => { Flow._ready = true; });
      const st = R.Media && R.Media.stat, b = Flow._bootStat;
      if (R.Loading && R.Loading.wait && st && b) {
        // 起動で読む見積もり（原画・魔物の全部＋今のマスの大きさの素材。R.Loading の起動の棒と同じ数え方）
        const T = (R.Media.table && R.Media.table()) || {};
        let n = Object.keys(T.sprites || {}).length + Object.keys(T.monsters || {}).length;
        try { const E = R.Terrain && R.Terrain.Env; if (E && E.bootCount) n += E.bootCount(); } catch (e) { /* 原画の分だけ */ }
        const done = () => st.done - b.done;
        R.Loading.wait(p, done, Math.max(1, n, st.req - b.req));
      }
      return p;
    },
    /** 新しいゲーム。R.DB.config.start = {map, spawn, event?} */
    async newGame(o) {
      o = o || {};
      await Flow.ready();
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
      await Flow.ready();
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
    // 記録と設定の置き場（デスクトップ版はファイルを先に全部読む。core/storage.js）
    try { if (R.Storage && R.Storage.init) await R.Storage.init(); } catch (e) { console.error('storage init failed', e); }
    R.Settings.load();
    R.Gfx.init(canvas);
    R.fit(true);
    window.addEventListener('resize', () => R.fit());
    window.addEventListener('orientationchange', () => R.fit());
    R.Input.init(canvas);
    if (R.Display && R.Display.init) R.Display.init();   // ウィンドウ／全画面（F11・Alt+Enter）
    R.Input.onAnyPress(() => { try { R.Audio.init(); } catch (e) { console.error(e); } });
    // 読み込みの画面（主人公が進みの棒の上を走る。core/loading.js）: 書体と起動の仕事（原画・素材の先読み）の間
    if (R.Loading) R.Loading.boot();
    await waitFonts();
    R.Engine.addTick((dt, real) => { if (R.Game && R.Engine.has('field')) R.Game.playMs = (R.Game.playMs || 0) + real; });
    // 焼く列（版 2）: 毎フレーム R.Hd.pump(予算 3 ms) を CORE が 1 回だけ呼ぶ。ほかの担当は pump を呼ばない（暗転中の同期の焼きは R.Hd.now）
    // 更新の速い画面（120・144 Hz）は 1 フレームが短いので、予算も間隔の 2 割までに（1 秒あたりの焼きの量は 60 Hz と同じくらい）
    R.Engine.addTick(() => {
      if (!R.Hd || !R.Hd.pump) return;
      const B = (R.Hd.BUDGET && R.Hd.BUDGET.frameBakeMs) || 3, per = R.Engine.period;
      R.Hd.pump(per > 0 ? Math.min(B, Math.max(1, per * 0.2)) : B);
    });
    // 起動の仕事（原画・素材の先読み）。遊ぶ版はタイトルを先に出し、読み込みはタイトルの裏で続ける（2026-09-29 性能: CPU 4 倍遅いで
    // タイトルまで 14.6 秒 → 数秒。はじめから・つづきからは Flow.ready() で読み終わりを待つ）。dev.html（フィクスチャ）は今までどおり待ってから
    const runHooks = async () => { for (const fn of R._bootHooks) { try { await fn(); } catch (e) { console.error('boot hook failed', e); } } };
    const early = !R.devBoot && !(typeof location !== 'undefined' && /[?&]bootWait=1/.test(location.search || ''));
    if (!early) { R.bootReady = runHooks(); await R.bootReady; }
    if (R.Loading) R.Loading.bootDone();
    R.Engine.start(canvas);
    if (R.loadErrors.length) console.error('LOAD ERRORS:\n' + R.loadErrors.join('\n'));
    if (early) {
      Flow.title();   // タイトルの絵の読み込みを先に頼む（下の先読みより前に並ぶ）
      Flow._bootStat = R.Media && R.Media.stat ? { req: R.Media.stat.req, done: R.Media.stat.done } : null;
      // 裏では並べて読む（原画・素材・魔物の読み込みと解きが重なる。1 つずつ待つより早く揃う）
      R.bootReady = Promise.all(R._bootHooks.map((fn) => Promise.resolve().then(fn).catch((e) => console.error('boot hook failed', e)))).then(() => undefined);
      R.bootReady.then(() => R.emit('booted'));
      return;
    }
    R.emit('booted');
    if (R.devBoot && (await R.devBoot())) return; // dev.html だけ: ?fixture= / ?scene=（src/dev/fixtures.js）
    Flow.title();
  };

  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'complete') R.boot();
    else window.addEventListener('load', () => R.boot());
  }
})(window.RPG);
