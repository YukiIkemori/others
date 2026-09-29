// Engine（CORE）: 場面の積み上げ・1 フレームの回し方・時間・暗転・重ね描き（V2_PLAN §2.5.1）
//
// 場面（Scene）= {id, enter(params, from), exit(to), update(dt), draw(g), onLayout?(), opaque?:bool, tick?(dt)}
//   - update(dt) は一番上の場面だけ（入力を受けるのは一番上だけ）
//   - tick(dt)（任意、契約の版 1 で足した）は積まれた全部の場面で毎フレーム（後ろの動き用。入力を読まない）
//   - draw(g) は一番上から数えて最初の opaque の場面から上へ順に
// 同じ場面の物を 2 回積んでもよい（積み上げの項目は {scene, params, resolve} で持つ）。
//
// 時間は R.Engine.time（ミリ秒）で数える。setTimeout を使わない。R.wait(ms) / R.until(pred)。
// R.Engine.speed（倍速の試験用）・R.Engine.pause()/resume()・R.Engine.advance(ms)（テスト用に手で進める）
// R.Engine.setTime(ms, {freeze}) は shot.js の --time（きらめき・ゆらぎを止めて比べる）
(function (R) {
  'use strict';

  const stack = []; // [{scene, params, resolve}]
  const waits = []; // [{at, resolve}] Engine.time が at を越えたら解決
  const untils = []; // [{pred, resolve}]
  const ticks = []; // [fn(dt, real)] 場面の外の毎フレームの仕事（プレイ時間・音など）
  const overlays = []; // [{id, draw(g), z}] すべての場面の上に描く物（通知・タッチの操作パッド・暗転）
  let raf = 0, last = 0, frozen = false;

  const perf = { n: 0, i: 0, ms: new Float32Array(600), long: 0 };

  // 画面の更新の間隔に揃える（2026-09-29 性能: 60/120/144 Hz でのむら）。requestAnimationFrame の時刻の揺れ（± 1〜2 ms）で
  // 1 フレームに進む時間がばらつくと、歩き・カメラの 1 フレームの動きがばらついてカクついて見える。
  // 間隔の平均（per）を見積もり、per の整数倍に近い間隔はその倍数に揃える。ずれは carry に貯め、少しずつ返す（実時間から離れない）。
  // 整数倍から外れた間隔（止まっていた・重いフレーム）はそのまま使う
  const pacer = { per: 0, carry: 0 };
  function pace(d) {
    const P = pacer;
    if (d > 3 && d < 40) P.per = P.per ? P.per + (d - P.per) * 0.05 : d;
    if (!P.per || d <= 0) return d;
    const n = Math.round(d / P.per);
    if (n < 1 || n > 3 || Math.abs(d - n * P.per) > P.per * 0.2) { P.carry = 0; return d; }
    P.carry += d - n * P.per;
    const back = P.carry * 0.1;
    P.carry -= back;
    return n * P.per + back;
  }

  const Engine = (R.Engine = {
    time: 0,
    dt: 0,
    frame: 0,
    speed: 1,
    paused: false,
    running: false,
    fade: { a: 0, color: '#070812', anim: null },
    error: null,
    perf,
    /** 画面の更新の間隔の見積もり（ms。60 Hz ≈ 16.7、144 Hz ≈ 6.9。まだ分からなければ 0） */
    get period() { return pacer.per; },

    get stack() { return stack.map((e) => e.scene); },
    top() { const e = stack[stack.length - 1]; return e ? e.scene : null; },
    has(id) { return stack.some((e) => e.scene.id === id); },

    /** 場面を積む。→ その場面の項目（pop で結果を返す相手） */
    push(scene, params) {
      const from = Engine.top();
      const entry = { scene, params, resolve: null };
      stack.push(entry);
      try { scene.enter && scene.enter(params, from); } catch (e) { report(e); }
      R.Input && R.Input.consume && R.Input.consume();
      R.emit('scene:push', { id: scene.id });
      return entry;
    },
    /** 一番上を閉じる。await の相手に result を返す */
    pop(result) {
      const entry = stack.pop();
      if (!entry) return;
      const to = Engine.top();
      try { entry.scene.exit && entry.scene.exit(to); } catch (e) { report(e); }
      R.Input && R.Input.consume && R.Input.consume();
      R.emit('scene:pop', { id: entry.scene.id, result });
      if (entry.resolve) { const r = entry.resolve; entry.resolve = null; r(result); }
    },
    /** 積み上げのどこにあっても、その場面を閉じる（上に積まれた物はそのまま） */
    remove(scene, result) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].scene !== scene) continue;
        if (i === stack.length - 1) { Engine.pop(result); return true; }
        const [entry] = stack.splice(i, 1);
        try { entry.scene.exit && entry.scene.exit(Engine.top()); } catch (e) { report(e); }
        R.emit('scene:pop', { id: entry.scene.id, result });
        if (entry.resolve) { const r = entry.resolve; entry.resolve = null; r(result); }
        return true;
      }
      return false;
    },
    /** 一番上を入れ替える。上の場面を await していた相手は、新しい場面の pop の結果を受け取る */
    replace(scene, params) {
      const old = stack.pop();
      const resolve = old ? old.resolve : null;
      if (old) {
        try { old.scene.exit && old.scene.exit(scene); } catch (e) { report(e); }
        R.emit('scene:pop', { id: old.scene.id });
      }
      const entry = Engine.push(scene, params);
      entry.resolve = resolve;
      return entry;
    },
    /** 積んで、pop(result) を待つ */
    await(scene, params) {
      return new Promise((res) => { const entry = Engine.push(scene, params); entry.resolve = res; });
    },
    /** 全部の場面を閉じる（タイトルへ戻るとき）。待っている相手は undefined で解決 */
    clear() {
      while (stack.length) Engine.pop(undefined);
    },

    /** 場面の外の毎フレームの仕事を足す: fn(dt, realMs) */
    addTick(fn) { if (!ticks.includes(fn)) ticks.push(fn); },

    // ---------------------------------------------------------------- 重ね描き
    /** 全部の場面の上に描く物を登録（id が同じなら入れ替え）。z が大きいほど上。z ≥ 1000 は暗転（fade）より上（読み込みの走る絵） */
    overlay(id, draw, z) {
      const i = overlays.findIndex((o) => o.id === id);
      if (i >= 0) overlays.splice(i, 1);
      if (draw) overlays.push({ id, draw, z: z || 0 });
      overlays.sort((a, b) => a.z - b.z);
    },

    // ---------------------------------------------------------------- 暗転
    /** 暗転（to=1）・明ける（to=0）。ms は Engine.time で数える */
    fadeTo(to, ms, color) {
      const f = Engine.fade;
      if (color) f.color = color;
      if (f.anim) { const r = f.anim.resolve; f.anim = null; r(); }
      return new Promise((res) => {
        if (!(ms > 0)) { f.a = to; res(); return; }
        f.anim = { from: f.a, to, t0: Engine.time, ms, resolve: res };
      });
    },

    // ---------------------------------------------------------------- ループ
    start(canvas) {
      if (Engine.running) return;
      Engine.running = true;
      if (canvas && R.Gfx && !R.Gfx.canvas) R.Gfx.init(canvas);
      last = performance.now();
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const real = pace(Math.min(50, Math.max(0, now - last)));
        last = now;
        if (Engine.paused) return;
        const t0 = performance.now();
        Engine.step(real);
        Engine.render();
        const spent = performance.now() - t0;
        perf.ms[perf.i] = spent; perf.i = (perf.i + 1) % perf.ms.length; perf.n++;
        if (real > 33.4 && perf.n > 5) perf.long++;
      };
      raf = requestAnimationFrame(loop);
    },
    stop() { Engine.running = false; if (raf) cancelAnimationFrame(raf); },
    pause() { Engine.paused = true; },
    resume() { Engine.paused = false; last = performance.now(); },
    /** テスト・スクショ用: ms だけ手で進める（16.67 ms ずつ） */
    advance(ms) {
      let left = ms;
      while (left > 0) { const d = Math.min(1000 / 60, left); Engine.step(d); left -= d; }
      Engine.render();
    },
    /** Engine.time を ms に合わせる。freeze なら以後進めない（shot.js --time） */
    setTime(ms, o) {
      Engine.time = +ms || 0;
      frozen = !!(o && o.freeze);
      Engine.render();
    },
    get frozen() { return frozen; },

    /** 1 フレーム。real は実時間のミリ秒 */
    step(real) {
      const dt = frozen ? 0 : real * Engine.speed;
      Engine.dt = dt;
      Engine.time += dt;
      Engine.frame++;
      if (R.Input && R.Input.update) R.Input.update(dt);
      for (let i = 0; i < ticks.length; i++) { try { ticks[i](dt, frozen ? 0 : real); } catch (e) { report(e); } }
      // 待ち
      for (let i = waits.length - 1; i >= 0; i--) {
        if (Engine.time >= waits[i].at) { const w = waits[i]; waits.splice(i, 1); w.resolve(); }
      }
      for (let i = untils.length - 1; i >= 0; i--) {
        let ok = false;
        try { ok = untils[i].pred(); } catch (e) { ok = true; report(e); }
        if (ok) { const w = untils[i]; untils.splice(i, 1); w.resolve(); }
      }
      // 暗転
      const f = Engine.fade, a = f.anim;
      if (a) {
        const k = Math.min(1, (Engine.time - a.t0) / a.ms);
        f.a = a.from + (a.to - a.from) * k;
        if (k >= 1) { f.anim = null; a.resolve(); }
      }
      // 場面
      for (let i = 0; i < stack.length; i++) {
        const s = stack[i].scene;
        if (s.tick) { try { s.tick(dt); } catch (e) { report(e); } }
      }
      const top = Engine.top();
      if (top && top.update) { try { top.update(dt); } catch (e) { report(e); } }
    },

    render() {
      const G = R.Gfx;
      if (!G || !G.ctx) return;
      G.reset();
      const g = G.g;
      let start = 0;
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].scene.opaque) { start = i; break; }
      if (!stack[start] || !stack[start].scene.opaque) G.clear();
      for (let i = start; i < stack.length; i++) {
        const s = stack[i].scene;
        g.save();
        try { s.draw && s.draw(g); } catch (e) { report(e); }
        g.restore();
        G.reset();
      }
      const over = (top) => {
        for (const o of overlays) {
          if ((o.z >= 1000) !== top) continue;
          g.save();
          try { o.draw(g); } catch (e) { report(e); }
          g.restore();
          G.reset();
        }
      };
      over(false);
      if (Engine.fade.a > 0) {
        g.globalAlpha = Math.min(1, Engine.fade.a);
        g.fillStyle = Engine.fade.color;
        g.fillRect(0, 0, R.W, R.H);
        g.globalAlpha = 1;
      }
      over(true);
      if (Engine.error) drawError(g);
    },

    /** 画面の大きさが変わった（R.fit が呼ぶ）: 全部の場面に onLayout */
    layoutChanged() {
      for (const e of stack) { if (e.scene.onLayout) { try { e.scene.onLayout(); } catch (err) { report(err); } } }
      Engine.render();
    },

    /** 最近 n フレームの描画と更新にかかった時間（perf.js が読む） */
    frameStats() {
      const n = Math.min(perf.n, perf.ms.length);
      const a = Array.from(perf.ms.slice(0, n)).sort((x, y) => x - y);
      const avg = a.reduce((s, v) => s + v, 0) / (n || 1);
      return { n, avg, p95: a[Math.floor(n * 0.95)] || 0, max: a[n - 1] || 0, long: perf.long };
    },
    resetStats() { perf.n = 0; perf.i = 0; perf.long = 0; },
    reportError: report,
  });

  /** Engine.time で ms 待つ（倍速・一時停止・--time に従う） */
  R.wait = function (ms) {
    return new Promise((res) => { if (!(ms > 0)) res(); else waits.push({ at: Engine.time + ms, resolve: res }); });
  };
  /** pred() が真になるフレームまで待つ */
  R.until = function (pred) {
    return new Promise((res) => { let ok = false; try { ok = pred(); } catch (e) { ok = true; } if (ok) res(); else untils.push({ pred, resolve: res }); });
  };

  function report(e) {
    console.error(e);
    Engine.error = { msg: String((e && e.stack) || e), time: Engine.time, frame: Engine.frame };
    R.emit('error', e);
  }
  // エラーは画面の上に少しの間だけ出す（遊んでいる人が報告できるように）。ゲームは止めない
  function drawError(g) {
    const e = Engine.error;
    if (Engine.frame - e.frame > 600) { Engine.error = null; return; }
    g.fillStyle = 'rgba(120,20,30,0.88)';
    g.fillRect(0, 0, R.W, 40);
    g.fillStyle = '#fff';
    g.font = '11px sans-serif';
    g.textBaseline = 'top';
    e.msg.split('\n').slice(0, 2).forEach((l, i) => g.fillText(l.slice(0, 140), 6, 5 + i * 15));
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('error', (ev) => report(ev.error || ev.message));
    window.addEventListener('unhandledrejection', (ev) => report(ev.reason));
  }
})(window.RPG);
