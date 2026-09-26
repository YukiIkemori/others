// 小道具（CORE）: R.U・R.rng（種つきの乱数、§2.1）・文字列のハッシュ
(function (R) {
  'use strict';

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 文字列 → 32 bit の種（FNV-1a）。絵を焼く種はキーからこれで作る（同じキーなら同じ画素） */
  function hash(s) {
    s = String(s);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  /** R.rng(seed) → {next(), int(a,b), pick(arr), chance(p), float(a,b), shuffle(arr), weighted(arr,key)}。seed は数か文字列 */
  R.rng = function (seed) {
    const f = mulberry32(typeof seed === 'number' ? seed : hash(seed));
    const r = {
      next: f,
      int(a, b) { return a + Math.floor(f() * (b - a + 1)); },
      float(a, b) { return a + (b - a) * f(); },
      pick(arr) { return arr[Math.floor(f() * arr.length)]; },
      chance(p) { return f() < p; },
      shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
      weighted(arr, key) {
        key = key || 'w';
        let total = 0;
        for (const e of arr) total += e[key] || 0;
        let x = f() * total;
        for (const e of arr) { x -= e[key] || 0; if (x < 0) return e; }
        return arr[arr.length - 1];
      },
    };
    return r;
  };

  R.U = {
    hash,
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); },
    ease: {
      out(t) { return 1 - (1 - t) * (1 - t); },
      inOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    },
    /** 8 方向（dx, dy）と向きの名前 's' 'n' 'e' 'w' */
    DIR: { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] },
    dirOf(dx, dy, prev) {
      if (dx === 0 && dy === 0) return prev || 's';
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w';
      if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 's' : 'n';
      // 斜め: 前の向きが軸のどちらかと合えばそれを保つ
      const h = dx > 0 ? 'e' : 'w', v = dy > 0 ? 's' : 'n';
      return prev === h || prev === v ? prev : v;
    },
    /** ミリ秒 → 「h:mm」 */
    playTime(ms) {
      const m = Math.floor((ms || 0) / 60000);
      return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    },
    /** 日付 → 「2026/09/26 21:04」 */
    date(t) {
      const d = new Date(t || Date.now());
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
  };
})(window.RPG);
