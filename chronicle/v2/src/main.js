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
      R.Audio.bgm('title', { fade: 600 });
      const r = await R.Screens.open('title');
      if (r && r.cmd === 'continue' && R.Save.load(r.slot)) return Flow.resume();
      if (r && r.cmd === 'load') return Flow.resume();
      return Flow.newGame(r || {});
    },
    /** 新しいゲーム。R.DB.config.start = {map, spawn, event?} */
    async newGame(o) {
      o = o || {};
      const s = (R.DB.config && R.DB.config.start) || {};
      const hero = o.hero || (s.event ? null : await R.Screens.open('charcreate'));
      R.State.newGame({ hero, seed: o.seed });
      await R.Field.enter(s.map, s.spawn, { fade: 0, noAutosave: true });
      if (s.event) await R.Events.run(s.event, { map: s.map });
    },
    /** 読み込んだ R.Game の場所から続ける */
    async resume() {
      const p = R.Game.pos || {};
      await R.Field.enter(p.map, { x: p.x, y: p.y, dir: p.dir }, { fade: 260, noAutosave: true });
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
    await waitFonts();
    R.Engine.addTick((dt, real) => { if (R.Game && R.Engine.has('field')) R.Game.playMs = (R.Game.playMs || 0) + real; });
    for (const fn of R._bootHooks) { try { await fn(); } catch (e) { console.error('boot hook failed', e); } }
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
