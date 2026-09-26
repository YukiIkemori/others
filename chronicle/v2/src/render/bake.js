// RENDER: 焼く列（R.Hd.pump・R.Hd.schedule・R.Hd.want）。V2_PLAN §2.10・§2.11「焼く仕事の予算は誰が守る」
// - pump(ms) は CORE が毎フレーム 1 回だけ呼ぶ（main.js）。ほかの担当は呼ばない。暗転中の同期の焼きは R.Hd.now。
// - 列には 2 種類: ① schedule(job, prio) の仕事（K.bakeJob: step(ms) は ms 以内で戻る、終われば done）
//                  ② want(key, opts, prio)・get の「このキーを焼いて」（factory を 1 回呼ぶ）
// - prio の大きい順、同じ prio は積んだ順。factory の見込みの時間（前に焼いた時間の平均）が残りの予算に入らなければ後回し。
//   ただし 1 回も入らないまま 30 フレーム待った物は、そのフレームの最初に 1 つだけ焼く（飢えないように。stats().over に数える）。
//   大きい絵（1 人 12 コマなど）は factory が K.bakeJob を返せば、切れ端で焼ける（結果の Sheet がキャッシュに入る）。
// - factory が null を返したら「まだ焼けない」: 覚えずに、30 フレームの間は列に積み直さない（原画の画像の読み込み待ちなど）。
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});
  const S = (Hd._s = Hd._s || {});
  S.queue = S.queue || [];       // [{t:'job'|'want', prio, seq, job?, ck?, key?, opts?, waited}]
  S.queued = S.queued || new Map();   // ck → want の項目
  S.seq = S.seq || 0;
  S.failed = S.failed || new Map();   // ck → factory が null を返したフレーム
  S.baked = S.baked || {};            // kind → {n, sum, max}
  S.bakedKey = S.bakedKey || new Map();   // key → 平均 ms（見込み）
  S.over = S.over || 0;               // 予算を超えて焼いた回数
  S.pumpMs = S.pumpMs || { last: 0, max: 0 };
  S.tick = S.tick || 0;

  // 時計（テストでは Hd._clock を差し替えて、決まった時間で予算の決まりを確かめる）
  Hd._clock = Hd._clock || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));
  const now = () => Hd._clock();
  Hd._now = now;
  const RETRY = 30;

  function isJob(x) { return x && typeof x.step === 'function' && typeof x.done === 'boolean'; }
  Hd._isJob = isJob;

  function record(key, ms) {
    const kind = Hd.kindOf(key);
    const b = (S.baked[kind] = S.baked[kind] || { n: 0, sum: 0, max: 0 });
    b.n++; b.sum += ms; if (ms > b.max) b.max = ms;
    const prev = S.bakedKey.get(key);
    S.bakedKey.set(key, prev == null ? ms : prev * 0.7 + ms * 0.3);
  }
  Hd._record = record;
  function estimate(key) {
    const k = S.bakedKey.get(key);
    if (k != null) return k;
    // 初めてのキーは、同じ種類の一番遅かった時間で見込む（安全な側。飢えは 30 フレームの決まりで防ぐ）
    const b = S.baked[Hd.kindOf(key)];
    return b && b.n ? Math.max(b.sum / b.n, b.max * 0.9) : 1.5;
  }

  /** factory を呼ぶ（例外は null）。→ Sheet | K.bakeJob | null */
  function callFactory(d, key, opts) {
    try { return d.factory(opts || {}, key) || null; } catch (e) { console.error('[Hd] factory ' + key, e); return null; }
  }
  Hd._callFactory = callFactory;

  function push(item) {
    item.seq = S.seq++;
    item.waited = 0;
    S.queue.push(item);
    S.dirty = true;
    return item;
  }

  /** 版 2: 焼く仕事（K.bakeJob）を共通の列に積む。prio が大きいほど先 */
  Hd.schedule = function (job, prio) {
    if (!isJob(job) || job.done) return job;
    for (const it of S.queue) if (it.job === job) { if ((prio || 0) > it.prio) { it.prio = prio || 0; S.dirty = true; } return job; }
    push({ t: 'job', job, prio: prio || 0 });
    return job;
  };

  /** キーを焼く列に積む（もう焼けていれば true）。prio が大きいほど先 */
  Hd.want = function (key, opts, prio) {
    const ck = Hd._ck(key, opts);
    if (Hd._has(ck)) return true;
    if (!Hd.has(key)) return false;
    const f = S.failed.get(ck);
    if (f != null && S.tick - f < RETRY) return false;
    const q = S.queued.get(ck);
    if (q) { if ((prio || 0) > q.prio) { q.prio = prio || 0; S.dirty = true; } return false; }
    S.queued.set(ck, push({ t: 'want', ck, key, opts: opts || null, prio: prio || 0 }));
    return false;
  };

  /** want の項目を 1 つ焼く。→ 使った ms */
  function bakeWant(it, left) {
    const t0 = now();
    S.queued.delete(it.ck);
    const d = Hd._def(it.key);
    if (!d || Hd._has(it.ck)) return now() - t0;
    const r = callFactory(d, it.key, it.opts);
    if (!r) { S.failed.set(it.ck, S.tick); return now() - t0; }
    if (isJob(r)) {
      // 大きい絵: 切れ端で続きを焼く。終わったらキャッシュへ
      const job = r, key = it.key, ck = it.ck;
      let spent = 0;
      const step = job.step.bind(job);
      const wrap = {
        kind: job.kind || Hd.kindOf(key), done: false, result: null,
        step(ms) { const a = now(); step(ms); spent += now() - a; if (job.done) { wrap.done = true; wrap.result = job.result; } },
        onDone(res) { if (res) { Hd._put(ck, key, res); record(key, spent); } else S.failed.set(ck, S.tick); if (job.onDone) job.onDone(res); },
      };
      const item = push({ t: 'job', job: wrap, prio: it.prio, ck });
      S.queued.set(ck, item);
      const rest = (left != null ? left : (Hd.BUDGET.frameBakeMs || 3)) - (now() - t0);
      if (rest > 0.25) wrap.step(rest);
      if (wrap.done) finishJob(item);
      return now() - t0;
    }
    const ms = now() - t0;
    Hd._put(it.ck, it.key, r);
    record(it.key, ms);
    return ms;
  }

  function finishJob(it) {
    const i = S.queue.indexOf(it);
    if (i >= 0) S.queue.splice(i, 1);
    if (it.ck) S.queued.delete(it.ck);
    if (it.job.onDone) { try { it.job.onDone(it.job.result); } catch (e) { console.error('[Hd] job onDone', e); } }
  }

  /** 1 フレームの焼く仕事（CORE の main.js が毎フレーム 1 回だけ呼ぶ）。→ 使った ms */
  Hd.pump = function (ms) {
    S.tick++;
    const budget = ms || (Hd.BUDGET && Hd.BUDGET.frameBakeMs) || 3;
    const t0 = now();
    if (!S.queue.length) { S.pumpMs.last = 0; return 0; }
    if (S.dirty) { S.queue.sort((a, b) => b.prio - a.prio || a.seq - b.seq); S.dirty = false; }
    let did = 0;
    for (let i = 0; i < S.queue.length;) {
      const left = budget - (now() - t0);
      if (left <= 0.05) break;
      const it = S.queue[i];
      if (it.t === 'job') {
        if (it.job.done) { finishJob(it); continue; }
        try { it.job.step(Math.max(0.25, left)); } catch (e) { console.error('[Hd] job', e); it.job.done = true; it.job.result = null; }
        did++;
        if (it.job.done) { finishJob(it); continue; }
        break;   // 仕事は予算を使い切るまで step した（次のフレームへ）
      }
      // want
      if (Hd._has(it.ck) || !Hd.has(it.key)) { S.queue.splice(i, 1); S.queued.delete(it.ck); continue; }
      const est = estimate(it.key);
      if (est > left) {
        const starved = it.waited >= RETRY && did === 0 && now() - t0 < 0.2;
        if (!starved) { it.waited++; i++; continue; }
        S.over++;
      }
      S.queue.splice(i, 1);
      bakeWant(it, left);
      did++;
    }
    const used = now() - t0;
    S.pumpMs.last = used;
    if (used > S.pumpMs.max) S.pumpMs.max = used;
    return used;
  };

  /** 同期で焼く（暗転中・戦闘の開始だけ）。仕事を返す factory も最後まで焼く。→ Sheet | null */
  Hd._bakeNow = function (key, opts, ck) {
    const d = Hd._def(key);
    if (!d) return null;
    const t0 = now();
    let r = callFactory(d, key, opts);
    if (isJob(r)) { let n = 0; while (!r.done && n++ < 100000) r.step(1e9); r = r.result || null; }
    if (!r) { S.failed.set(ck, S.tick); return null; }
    const q = S.queued.get(ck);
    if (q) { const i = S.queue.indexOf(q); if (i >= 0) S.queue.splice(i, 1); S.queued.delete(ck); }
    record(key, now() - t0);
    return Hd._put(ck, key, r);
  };

  /** 列に残っている数 */
  Hd._queueLen = function () { return S.queue.length; };
  /** 列を空にする（テスト用） */
  Hd._clearQueue = function () { S.queue.length = 0; S.queued.clear(); S.failed.clear(); };
})(window.RPG);
