// PV の撮影でページに入れる小道具（window.PV）。ゲームのファイルは変えず、開いたページの中の関数を包む・差し替えるだけ。
//   PV.clean()            HUD・行き先の札・矢印を描かない（すっきりした画面）
//   PV.noEnc()            歩いて出る戦闘を出さない（テスト用メニューの札「TEST」を出さないため、切り替えではなくここで）
//   PV.state(name, flags) 状態のフィクスチャを当ててフラグを足す
//   PV.enter(map, spawn)  暗転なしでマップに入る → Promise
//   PV.btn({right:1, b:1}) 押しているボタンをまとめて決める（書かないボタンは離す）
//   PV.autoMsg(n)         会話が出そろってから n フレームで送る（0 で止める）
//   PV.pan(x0, y0, x1, y1, ms) カメラをマスの座標で動かす
//   PV.lastLine()         いちばん新しい会話の文（ログの最後）
module.exports = `(() => {
  const R = window.RPG;
  const BTNS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'l', 'r', 'start'];
  const PV = (window.PV = {
    clean() {
      R.Field.hud.draw = () => {};
      R.Field._wayfindLabels = () => {};
      R.Field._wayfind = () => {};
      PV.cleanMsg();
      if (R.Save) R.Save.autosave = () => {};   // 「オートセーブ」の札を出さない（PV の撮影ではセーブしない）
      return true;
    },
    /** 会話の窓の上の手引き（ログ・自動送り・早送り・文字の速さ）を描かない */
    cleanMsg() {
      const U = R.UIK;
      if (U.__pvClean) return true;
      U.__pvClean = true;
      const pr = U.prompts, ch = U.chip;
      U.prompts = function (g, list, o) { if (Array.isArray(list) && list.some((b) => b && b.label === 'ログ')) return; return pr.apply(this, arguments); };
      U.chip = function (g, x, y, label) { if (typeof label === 'string' && (label.startsWith('文字の速さ') || label.startsWith('自動送り'))) return; return ch.apply(this, arguments); };
      return true;
    },
    noEnc() { R.Mon.encounter = () => null; return true; },
    state(name, flags) {
      R.Dev.applyState(name);
      for (const id of Object.keys(R.DB.tips || {})) R.Game.flags['tip_' + id] = true;   // はじめての説明の札を出さない
      Object.assign(R.Game.flags, flags || {});
      return true;
    },
    /** 状態のフィクスチャの場所に入る（spawn を渡せばそこへ） */
    fixture(name, flags, spawn) { PV.state(name, flags); const fx = window.RPG_FIXTURES.states[name]; return PV.enter(fx.map.id, spawn || fx.map.spawn); },
    enter(map, spawn) { R.Engine.clear(); return R.Field.enter(map, spawn, { fade: 0, noAutosave: true }); },
    btn(o) { o = o || {}; for (const b of BTNS) R.Input._set(b, !!o[b]); return true; },
    tapQ: [],
    tap(b, n) { R.Input._set(b, true); PV.tapQ.push({ b, left: n || 3 }); return true; },
    auto: 0, fullFor: 0, autoChoose: false,
    autoMsg(n) { PV.auto = n || 0; PV.fullFor = 0; return true; },
    pan(x0, y0, x1, y1, ms) { R.Field.camera.focus(x0, y0, { ms: 0 }); return R.Field.camera.focus(x1, y1, { ms }); },
    /** 戦闘の指示を台本にする: PV.plan(st, u, round) → {cmd, id, target}（null なら攻撃）。パーティのメニューは「戦う」 */
    round: 0, plan: null,
    scriptBattle(plan) {
      const C = R.Battle._.cmd;
      PV.plan = plan; PV.round = 0;
      C.partyMenu = async () => 'fight';
      C.member = async (st, u) => {
        PV.st = st;
        if (u.id === 'hero') PV.round++;   // ラウンドの数（主人公の番が来るたびに 1 つ）
        const t = st.aliveEnemies()[0];
        const c = (PV.plan && PV.plan(st, u, PV.round)) || { cmd: 'attack', id: 'attack' };
        if (c.target == null) c.target = c.self ? u.uid : t ? t.uid : null;
        return c;
      };
      return true;
    },
    /** 敵に入るダメージを n 倍にする（戦闘を台本の長さで終わらせる用。テスト用メニューの差し込み口を使うが、切り替えは入れないので「TEST」の札は出ない） */
    dmgMul: 1, kill: false,
    boost(n) {
      const Tt = R.Tester;
      if (!Tt) return false;
      Tt.enabled = true;
      Tt.hitFix = (tgt, r) => r;
      Tt.dmgFix = (tgt, dmg) => (tgt && !tgt.isParty ? (PV.kill ? Math.max(dmg, tgt.hp || 1) : PV.dmgMul !== 1 ? Math.round(dmg * PV.dmgMul) : dmg) : dmg);   // PV.kill: 当たれば倒れる
      PV.dmgMul = n;
      return true;
    },
    /** 仲間に技・術を足す（台本用） */
    teach(id, techs, spells) { const c = R.Game.chars[id]; if (techs) c.techs = Array.from(new Set((c.techs || []).concat(techs))); if (spells) c.spells = Array.from(new Set((c.spells || []).concat(spells))); return true; },
    // ---------------------------------------------------------------- 道に沿って歩く（壁に向かって押し続けない）
    /** 道らしいマス（道・土・橋・板・石畳） */
    roadish(c) { return !!c && (/road|dirt|bridge|path|plank|cobble|pave|stone|floor|wood/.test(String(c.mat || '')) || !!c.road || !!c.bridge); },
    /** 今の位置から入れるマスの重み付きの道のり（8 方向。斜めは両隣が入れるときだけ。出入り口・人のマスは通らない）。
     *  o.off: 道でないマスの重さ（既定 6）。→ {dist, prev, W, H} */
    _flood(o) {
      o = o || {};
      const F = R.Field, S = F._s, m = S.map, W = m.w, H = m.h, lv = S.lv || 0;
      const off = o.off == null ? 6 : o.off;
      const dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), steps = new Int32Array(W * H);
      const ok = (fx, fy, x, y, d) => x >= 0 && y >= 0 && x < W && y < H && F._canEnter(m, fx, fy, x, y, lv, d) && !F._warpAt(m, x, y, lv) && !F._npcAt(x, y, lv);
      const D8 = [[1, 0, 'e'], [-1, 0, 'w'], [0, 1, 's'], [0, -1, 'n'], [1, 1, 'se'], [1, -1, 'ne'], [-1, 1, 'sw'], [-1, -1, 'nw']];
      const q = [[0, S.x, S.y]];
      dist[S.y * W + S.x] = 0;
      while (q.length) {
        let bi = 0; for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
        const [d0, x, y] = q[bi]; q[bi] = q[q.length - 1]; q.pop();
        if (d0 > dist[y * W + x]) continue;
        for (const [dx, dy, dn] of D8) {
          const nx = x + dx, ny = y + dy;
          if (!ok(x, y, nx, ny, dn)) continue;
          if (dx && dy && !(ok(x, y, x + dx, y, dx > 0 ? 'e' : 'w') && ok(x, y, x, y + dy, dy > 0 ? 's' : 'n'))) continue;
          const c = R.MapUtil.cell(m, nx, ny);
          const w = (PV.roadish(c) ? 1 : off) * (dx && dy ? 1.41 : 1);
          const nd = d0 + w, k = ny * W + nx;
          if (nd < dist[k]) { dist[k] = nd; prev[k] = y * W + x; steps[k] = steps[y * W + x] + 1; q.push([nd, nx, ny]); }
        }
      }
      return { dist, prev, steps, W, H };
    },
    _trace(fl, x, y) {
      const out = []; let k = y * fl.W + x;
      if (!isFinite(fl.dist[k])) return null;
      while (k >= 0) { out.push([k % fl.W, (k / fl.W) | 0]); k = fl.prev[k]; }
      out.reverse(); out.shift();   // 今のマスは除く
      return out;
    },
    /** 道に沿って歩く: pts = [[x, y], ...]（順に通る）。o.run: 走る。→ 歩数 */
    go(pts, o) {
      o = o || {};
      const F = R.Field, S = F._s, sx = S.x, sy = S.y;
      let route = [];
      for (const [tx, ty] of pts) {
        const fl = PV._flood(o);
        const seg = PV._trace(fl, tx, ty);
        if (!seg) throw new Error('PV.go: 届かない ' + tx + ',' + ty);
        route = route.concat(seg);
        S.x = tx; S.y = ty;   // 次の区間の起点（下で戻す）
      }
      S.x = sx; S.y = sy;
      PV.route = route; PV.ri = 0; PV.run = !!o.run; PV.idleF = 0; PV.stuck = 0;
      return route.length;
    },
    /** 今の位置から n 歩ほど道に沿って歩ける所（道のマスを好む。向き (hx, hy) へ進む所ほど良い）を選んで歩く。
     *  n 歩に届く道の行き先が無ければ、道でないマスも行き先にする（屋内・ダンジョン） */
    goFar(n, hx, hy, o) {
      o = o || {};
      const S = R.Field._s, fl = PV._flood(o);
      const pick = (roadOnly) => {
        let best = null, bs = -1e9;
        for (let k = 0; k < fl.dist.length; k++) {
          const st = fl.steps[k];
          if (!isFinite(fl.dist[k]) || st > n) continue;
          const x = k % fl.W, y = (k / fl.W) | 0;
          if (roadOnly && !PV.roadish(R.MapUtil.cell(S.map, x, y))) continue;
          const sc = st + 0.5 * ((x - S.x) * hx + (y - S.y) * hy);
          if (sc > bs) { bs = sc; best = [x, y, st]; }
        }
        return best;
      };
      let best = pick(true);
      if (!best || best[2] < n * 0.85) { const b2 = pick(false); if (b2 && (!best || b2[2] > best[2])) best = b2; }
      if (!best) throw new Error('PV.goFar: 行き先なし');
      return PV.go([[best[0], best[1]]], o);
    },
    /** 毎フレーム（撮りの each）: 次のマスへ向けてボタンを押す。着いたら離す */
    steer() {
      const S = R.Field._s, r = PV.route;
      if (!r) return 0;
      while (PV.ri < r.length && r[PV.ri][0] === S.x && r[PV.ri][1] === S.y) PV.ri++;
      if (PV.ri >= r.length) { PV.route = null; PV.btn({}); return 0; }
      const [tx, ty] = r[PV.ri], dx = Math.sign(tx - S.x), dy = Math.sign(ty - S.y);
      if (Math.abs(tx - S.x) > 1 || Math.abs(ty - S.y) > 1) PV.stuck++;   // 道から外れた（押し流された）
      if (!S.mv) { if (++PV.idleF > 2) PV.stuck++; } else PV.idleF = 0;
      PV.btn({ right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0, b: PV.run });
      return 1;
    },
    lastLine() { const L = R.UIK.Message.log(); return L.length ? L[L.length - 1].text : ''; },
  });
  R.Engine.addTick(() => {
    for (let i = PV.tapQ.length - 1; i >= 0; i--) { const q = PV.tapQ[i]; if (--q.left <= 0) { R.Input._set(q.b, false); PV.tapQ.splice(i, 1); } }
    if (PV.auto > 0) {
      const st = R.UIK.Message.state();
      if (st && st.full && (st.choiceRect == null || PV.autoChoose)) { if (++PV.fullFor >= PV.auto) { PV.fullFor = 0; PV.tap('a', 2); } } else PV.fullFor = 0;
    }
  });
  return true;
})()`;
