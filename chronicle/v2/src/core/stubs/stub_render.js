// 仮の実装: RENDER（R.Hd・R.Light・R.Post・R.Sky）。本物は src/render/*（RENDER）。V2_PLAN §2.5.5
// 焼く列は無く、get は登録があればその場で焼く。絵のキーが無いときは null（呼ぶ側が仮の箱を描く）。
(function (R) {
  'use strict';
  const defs = {}, cache = new Map(), pins = new Set();
  const jobs = []; // [{job, prio}] R.Hd.schedule の列（仮: 優先の高い順に ms まで step）
  const tracked = {}; // kind → {id: bytes}（R.Hd.track）
  const MOOD = {
    night: { ambient: '#3a3f78', lightDir: [-0.4, -1], shadow: 'rgba(8,8,24,0.45)', grade: { sh: '#1a1840', hi: '#ffe2b0', lift: 0.04, sat: 0.9 }, vignette: 0.35, bloom: 0.2 },
  };
  function ck(key, opts) { return opts ? key + '|' + JSON.stringify(opts) : key; }

  R.Stubs.define('Hd', {
    STYLE: { olMix: 0.82, maxColors: 32, rim: 0.35, steps: 4 },
    // 性能の予算（V2_PLAN §2.10 の表。desk / phone は CPU 4 倍遅くした見込み）
    BUDGET: {
      frameBakeMs: 3,
      chunkBakeMs: { desk: 4, phone: 16 },
      mapEnterMs: { desk: 150, phone: 500 },
      postMs: { desk: 0.5, phone: 2 },
      charBakeMs: { desk: 25, phone: 100 },
      menuFrameMs: { desk: 1, phone: 4 },
      snapshotMs: { desk: 8, phone: 30 },
      mb: { chunk: 40, field: 30, btl: 30, mon: 30, boss: 30, bbg: 20, prop: 20, fx: 20, face: 10, total: 150 },
      longFrames: { frames: 600, over33: 1 },
    },
    def(key, factory, meta) {
      if (defs[key]) { R.loadErrors.push(`duplicate R.Hd.def ${key} (ignored)`); return false; }
      defs[key] = { factory, meta: meta || {} };
      return true;
    },
    has(key) { return !!defs[key]; },
    get(key, opts) { return R.Hd.now(key, opts); },
    now(key, opts) {
      const d = defs[key];
      if (!d) return null;
      const k = ck(key, opts);
      if (!cache.has(k)) {
        // factory が null を返したら「まだ焼けない」（原画の画像の読み込み待ちなど）。覚えずに次に呼ばれたときにまた試す（版 2）
        let sh = null;
        try { sh = d.factory(opts || {}); } catch (e) { console.error('[Hd stub]', key, e); }
        if (!sh) return null;
        cache.set(k, sh);
      }
      return cache.get(k);
    },
    want() {},
    /** 1 フレームの焼く仕事（CORE の main.js が毎フレーム 1 回だけ呼ぶ）。仮: schedule の仕事だけを ms まで進める */
    pump(ms) {
      const t0 = Date.now();
      jobs.sort((a, b) => b.prio - a.prio);
      while (jobs.length && Date.now() - t0 < (ms || 3)) {
        const e = jobs[0];
        try { e.job.step(Math.max(0.5, (ms || 3) - (Date.now() - t0))); } catch (err) { console.error('[Hd stub job]', err); e.job.done = true; }
        if (e.job.done) { jobs.shift(); if (e.job.onDone) { try { e.job.onDone(e.job.result); } catch (err) { console.error(err); } } }
      }
      return Date.now() - t0;
    },
    /** 版 2: 焼く仕事（K.bakeJob。TERRAIN のチャンク・CAST の大きい絵など）を共通の列に積む。prio が大きいほど先 */
    schedule(job, prio) { if (job && !job.done) jobs.push({ job, prio: prio || 0 }); return job; },
    /** 版 2: R.Hd の外で持つ焼いた絵（FIELD のチャンク・UIK のすりガラス）の量を届ける。bytes = null で消す */
    track(kind, id, bytes) { const t = (tracked[kind] = tracked[kind] || {}); if (bytes == null) delete t[id]; else t[id] = bytes; },
    /** 版 2: 'hd:bld:xx' → 'prop' など（R.Contract.HD_KINDS）。stats().byKind の名前 */
    kindOf(key) { const k = String(key).split(':')[1]; return (R.Contract && R.Contract.HD_KINDS[k]) || k || 'other'; },
    ready(key, opts) { return cache.has(ck(key, opts)); },
    draw(g, frame, x, y, o) {
      if (!frame || !frame.c) return;
      o = o || {};
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      const ox = frame.ox || 0, oy = frame.oy || 0;
      if (o.flip) { g.translate(Math.round(x), Math.round(y)); g.scale(-1, 1); g.drawImage(frame.c, -ox, -oy); }
      else g.drawImage(frame.c, Math.round(x - ox), Math.round(y - oy));
      g.restore();
    },
    blur(canvas) { return canvas; },
    mood(id) { return MOOD[id] || MOOD.night; },
    grade(canvas) { return canvas; },
    quality() { return R.Settings.get('fx'); },
    stats() {
      const byKind = {};
      let bytes = 0;
      for (const k of Object.keys(tracked)) for (const id of Object.keys(tracked[k])) { byKind[k] = (byKind[k] || 0) + tracked[k][id]; bytes += tracked[k][id]; }
      return { bytes, byKind, queue: jobs.length, bakedMs: {} };
    },
    pin(key) { pins.add(key); },
    unpin(key) { pins.delete(key); },
  });

  R.Stubs.define('Light', {
    compose() {},
    glow(g, x, y, o) {
      o = o || {};
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = o.color || 'rgba(255,200,120,0.5)';
      g.globalAlpha = 0.35;
      g.beginPath(); g.arc(x, y, o.r || 6, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    ring(g, x, y, r) {
      g.save();
      const gr = g.createRadialGradient(x, y, 0, x, y, r || 88);
      gr.addColorStop(0, 'rgba(255,214,150,0.28)');
      gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr;
      g.fillRect(x - (r || 88), y - (r || 88), (r || 88) * 2, (r || 88) * 2);
      g.restore();
    },
  });

  R.Stubs.define('Post', {
    frame(g, o) {
      o = o || {};
      const b = o.brightness != null ? o.brightness : R.Settings.get('brightness');
      if (b < 1) { g.fillStyle = `rgba(7,8,18,${(1 - b) * 1.2})`; g.fillRect(0, 0, R.W, R.H); }
      else if (b > 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(60,60,80,${(b - 1) * 0.8})`; g.fillRect(0, 0, R.W, R.H); g.restore(); }
    },
  });

  R.Stubs.define('Sky', {
    at(tier) {
      const t = Math.max(0, Math.min(8, tier | 0));
      return { ambientMul: 0.5 + t * 0.06, horizon: `hsl(${240 - t * 6},40%,${10 + t * 3}%)`, tint: '#5c5aa0' };
    },
  });
})(window.RPG);
