// テスト用メニューの画面（src/tester/tester.js の R.Tester が有効なときだけ開く。F9／パッドは セレクト＋L＋R）
//   タブ（L/R）: 切り替え（←→・決定で値を変える）／実行（決定で 1 回）／ワープ（決定で飛ぶ。体験版の範囲の町・ダンジョン・野）
//   R.Screens の画面の表（SCREEN_IDS）には入れない: 場面 'tester' を直に積む（製品版で src/tester/ を外しても表が変わらない）。
//   見た目はほかの画面と同じ部品（R.UIK.panel・List・S.heading・S.tabs・S.prompts）。
//   宝箱・隠し通路の表示が入っている間は、フィールドの上にも印を描く（重ね描き 'tester_reveal'）。
(function (R) {
  'use strict';
  const T = R.Tester;
  if (!T) return;
  const u = (v) => R.UIK.u(v);
  const TK = () => R.UIK.T;
  const S = () => R.Screens || {};
  const ONOFF = { false: 'オフ', true: 'オン' };
  const X = (v) => '×' + v;

  const TOGGLES = [
    { key: 'noEnc', name: 'エンカウントなし', names: ONOFF, desc: '歩いていて魔物に出会わない。イベントとボスの戦闘はそのまま起きる。' },
    { key: 'exp', name: '経験値（成長）', fmt: X, desc: '勝った後の成長を N 倍にする（伸びる確率を N 倍、あふれた分は伸びの量へ）。弱すぎる敵では伸びないのは同じ。' },
    { key: 'prof', name: '熟練度', fmt: X, desc: '戦闘で武器・属性の熟練度に入る点を N 倍にする（技と術の覚え方が熟練度なので、閃きも早まる）。' },
    { key: 'glim', name: '閃き確率', fmt: X, desc: '技・術を閃く確率を N 倍にする（1 回の行動で 100% まで）。' },
    { key: 'gold', name: 'お金', fmt: X, desc: '戦闘で手に入るお金を N 倍にする。' },
    { key: 'invincible', name: '戦闘で無敵', names: ONOFF, desc: '味方がダメージ・悪い状態・即死を受けない。' },
    { key: 'onehit', name: '一撃で倒す', names: ONOFF, desc: '味方の攻撃・技・術が敵に当たれば必ず倒れる（ボスも）。' },
    { key: 'flee', name: '逃げるが必ず成功', names: ONOFF, desc: '「逃げる」が必ず成功する。逃げられない戦闘はそのまま。' },
    { key: 'speed', name: '移動速度', fmt: X, desc: 'フィールドで歩く・走る速さ。' },
    { key: 'reveal', name: '宝箱・隠し通路を表示', names: ONOFF, desc: '開けていない宝箱（金）と見つけていない隠し通路の入口（桃色）を、地図と画面に印で出す。' },
  ];
  const ACTIONS = [
    { act: 'heal', name: '全員 HP・MP 全回復', desc: '出撃中も控えも満タンにし、倒れた人も起こす（状態異常も消える）。', game: true },
    { act: 'cure', name: '状態異常を治す', desc: '全員の状態異常だけを消す。', game: true },
    { act: 'gold', name: 'お金 +10000G', desc: '所持金に 10,000 G 足す。', game: true },
    { act: 'goldMax', name: 'お金 MAX', desc: '所持金を上限（9,999,999 G）にする。', game: true },
    { act: 'items', name: '道具を全種 ×99', desc: '使う道具（回復・魔石など）を全種類 99 個にする。装備と大事な物は増やさない。', game: true },
    { act: 'lv1', name: 'レベルを上げる ＋1', desc: '全員（控えも）の成長を 1 段上げる。このゲームに見えるレベルは無いので、最大 HP・MP と強さで確かめる。', game: true },
    { act: 'lv10', name: 'レベルを上げる ＋10', desc: '全員（控えも）の成長を 10 段上げる（上限 99）。', game: true },
    { act: 'reset', name: '切り替えを全部戻す', desc: '「切り替え」のタブを全部ふつうの値に戻す（上の TEST の札も消える）。' },
    { act: 'off', name: 'テスト用メニューを切る', desc: 'このブラウザでテスト用メニューを無効にする（?tester=0 と同じ。?tester=1 でまた使える）。' },
  ];
  const TABS = ['切り替え', '実行', 'ワープ'];
  const KIND = { town: '町', dungeon: 'ダンジョン', field: '野', world: 'ワールド' };

  let scene = null;
  const M = (T.Menu = {
    isOpen() { return !!scene && R.Engine.stack.includes(scene); },
    /** 開けるか: フィールド（イベント・暗転の外）かタイトルの上 */
    canOpen() {
      const top = R.Engine.top();
      if (!top) return false;
      if (top.id === 'screen:title') return true;
      if (top.id !== 'field') return false;
      if (R.Events && R.Events.busy && R.Events.busy()) return false;
      if (R.Field && R.Field._locked && R.Field._locked()) return false;
      return !(R.Engine.fade && R.Engine.fade.a > 0.01);
    },
    open(o) {
      if (M.isOpen()) return true;
      if (!M.canOpen()) {
        try { R.UIK.toast('テスト用メニューはフィールドかタイトルで開ける', { icon: 'bulb', anchor: 'bl' }); } catch (e) { /* */ }
        return false;
      }
      scene = makeScene(o || {});
      R.Engine.push(scene);
      return true;
    },
    close() { if (scene && scene.view) scene.view.close(); },
    /** テスト・スクショ用: 今の場面の見た目の状態 */
    state() { return scene && M.isOpen() ? { tab: scene.view.tab, index: scene.view.list.index, rows: scene.view.list.rows.map((r) => r.value) } : null; },
  });

  function valueName(it, v) {
    if (it.fmt) return it.fmt(v);
    const n = it.names && it.names[String(v)];
    return n != null ? n : String(v);
  }

  function makeScene(o) {
    const v = {
      tab: o.tab || 0,
      list: new R.UIK.List({ rows: [], rowH: 40 }),
      layer: new R.UIK.Layer({ anchor: 'c' }),
      closing: false,
      busy: false,
      arrows: [],
      msg: null,
    };
    const warps = T.warpList();
    v.rowsOf = (i) => {
      if (i === 0) return TOGGLES.map((it) => Object.assign({ value: it.key, label: it.name }, it));
      if (i === 1) return ACTIONS.map((it) => Object.assign({ value: it.act, label: it.name, disabled: !!(it.game && !R.Game) }, it));
      const can = T.canWarp(), here = R.Field && R.Field.pos ? R.Field.pos.map : null;
      return warps.map((w) => ({ value: w.map, label: w.name, w, disabled: !can, here: w.map === here,
        desc: `${w.map}（${KIND[w.kind] || w.kind}）の ${w.spawn || '最初の入口'} へ飛ぶ。` + (can ? '' : ' ワープはゲームの中のフィールドでだけ使える。') }));
    };
    v.refresh = (keep) => v.list.setRows(v.rowsOf(v.tab), keep);
    v.refresh(false);
    v.list.onSelect = (row) => v.act(row, 1);
    v.list.onCancel = () => v.close();
    v.close = () => {
      if (v.closing) return;
      v.closing = true;
      v.layer.close().then(() => R.Engine.remove(sc));
    };
    v.note = (s) => { v.msg = { text: s, t0: R.Engine.time }; };
    v.shift = (it, d) => {
      const ch = T.OPTS[it.key];
      if (!ch) return;
      const i = Math.max(0, ch.indexOf(T.opts[it.key]));
      const j = (i + d + ch.length) % ch.length;
      T.set(it.key, ch[j]);
      R.UIK.sfx('cursor');
    };
    v.act = async (row, d) => {
      if (v.tab === 0) { v.shift(row, d); return; }
      if (v.tab === 2) {
        v.busy = true;
        v.close();
        await R.until(() => !R.Engine.stack.includes(sc));
        await T.warp(row.w.map, row.w.spawn);
        return;
      }
      const G = R.Game;
      switch (row.act) {
        case 'heal': T.healAll(); v.note('全員を全回復した'); break;
        case 'cure': T.cure(); v.note('状態異常を治した'); break;
        case 'gold': T.addGold(10000); v.note('所持金 ' + R.UIK.num(G.gold) + ' G'); break;
        case 'goldMax': T.goldMax(); v.note('所持金 ' + R.UIK.num(G.gold) + ' G'); break;
        case 'items': { const n = T.items99(); v.note('道具を全種 99 個にした（' + n + ' 種を増やした）'); break; }
        case 'lv1': case 'lv10': {
          const n = T.levelUp(row.act === 'lv1' ? 1 : 10);
          v.note(n ? n + ' 人の成長を上げた' : 'もう上がらない（上限）');
          break;
        }
        case 'reset': T.reset(); v.note('切り替えを全部戻した'); break;
        case 'off': T.enable(false); v.close(); try { R.UIK.toast('テスト用メニューを切った（?tester=1 でまた使える）', { icon: 'bulb', anchor: 'bl' }); } catch (e) { /* */ } break;
        default: break;
      }
    };
    v.update = () => {
      if (v.closing || v.busy) return;
      const I = R.Input, Sc = S();
      const k = Sc.tabInput ? Sc.tabInput(v.tabRects, v.tab, TABS.length) : -1;
      if (k >= 0) { v.tab = k; v.refresh(false); return; }
      const row = v.list.current();
      if (v.tab === 0 && row) {
        if (I.repeat('left')) { v.shift(row, -1); return; }
        if (I.repeat('right')) { v.shift(row, 1); return; }
        for (const a of v.arrows) if (Sc.clicked && Sc.clicked(a.r)) { v.list.focusIndex(a.i); v.shift(v.list.rows[a.i], a.d); return; }
      }
      // 実行のタブの「ゲームの中だけ」の行は、読み込み・新しい旅のあとに使えるように並べ直す
      if (v.tab === 1) for (const r of v.list.rows) r.disabled = !!(r.game && !R.Game);
      v.list.update();
    };
    v.draw = (g) => {
      const Sc = S(), C = TK().color;
      const b = Sc.box ? Sc.box() : { x: u(24), y: u(24), w: R.W - u(48), h: R.H - u(78) };
      const w = Math.min(b.w, u(780)), x = b.x + (b.w - w) / 2;
      if (Sc.heading) Sc.heading(g, 'テスト用メニュー', x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      R.UIK.text(g, 'テストプレイ用。製品版には入らない。', x + w - u(8), b.y + u(7), { size: u(12), color: C.text3, align: 'right' });
      v.tabRects = Sc.tabs ? Sc.tabs(g, TABS, v.tab, x, b.y + u(40), { size: 15, min: 96 }) : [];
      const p = { x, y: b.y + u(88), w, h: b.h - u(88) - u(64) };
      R.UIK.panel(g, p, { frost: true });
      v.arrows = [];
      v.list.render = (gg, row, rect, f) => {
        const sz = u(15.5), cy = rect.y + (rect.h - sz) / 2 - u(1);
        const col = row.disabled ? (f ? C.text2 : C.disabled) : f ? C.goldHi : C.text;
        if (v.tab === 2) {
          const ic = row.w.kind === 'town' ? 'inn' : row.w.kind === 'dungeon' ? 'door' : 'pin';
          R.UIK.icon(gg, ic, rect.x + u(16), cy, u(16), row.disabled ? C.disabled : f ? C.gold : C.text2);
          R.UIK.text(gg, row.label, rect.x + u(44), cy, { size: sz, weight: f ? 700 : 500, color: col, maxW: rect.w * 0.45 });
          const rn = Sc.regionName ? Sc.regionName(row.w.region) : row.w.region;
          R.UIK.text(gg, (row.here ? 'いまいる所　' : '') + row.w.map + '　' + (KIND[row.w.kind] || '') + '・' + (rn || ''), rect.x + rect.w - u(14), cy + u(2), { size: u(12.5), color: C.text3, align: 'right', maxW: rect.w * 0.5 });
          return;
        }
        R.UIK.text(gg, row.name, rect.x + u(18), cy, { size: sz, weight: f ? 700 : 500, color: col, maxW: rect.w * 0.5 });
        if (v.tab === 1) { R.UIK.icon(gg, 'star', rect.x + rect.w - u(36), cy, sz, row.disabled ? C.disabled : f ? C.gold : C.text2); return; }
        const val = T.opts[row.key], def = T.OPTS[row.key][0];
        const vx = rect.x + rect.w * 0.72;
        const i = v.list.rows.indexOf(row);
        R.UIK.text(gg, valueName(row, val), vx, cy, { size: sz, weight: 700, color: val !== def ? C.teal : f ? C.goldHi : C.text, align: 'center', maxW: rect.w * 0.3 });
        const aw = u(26), ay = rect.y + rect.h / 2, off = rect.w * 0.14;
        for (const [d, cx0] of [[-1, vx - off], [1, vx + off]]) {
          v.arrows.push({ r: { x: cx0 - aw / 2, y: rect.y, w: aw, h: rect.h }, i, d });
          gg.save(); gg.fillStyle = f ? C.gold : C.text3; gg.beginPath(); const s = u(5);
          if (d < 0) { gg.moveTo(cx0 - s, ay); gg.lineTo(cx0 + s * 0.7, ay - s); gg.lineTo(cx0 + s * 0.7, ay + s); } else { gg.moveTo(cx0 + s, ay); gg.lineTo(cx0 - s * 0.7, ay - s); gg.lineTo(cx0 - s * 0.7, ay + s); }
          gg.closePath(); gg.fill(); gg.restore();
        }
      };
      v.list.draw(g, { x: p.x + u(10), y: p.y + u(10), w: p.w - u(20), h: p.h - u(20) });
      const row = v.list.current();
      const dy = p.y + p.h + u(14);
      const m = v.msg && R.Engine.time - v.msg.t0 < 2400 ? v.msg : null;
      if (m) {
        R.UIK.icon(g, 'star', x + u(8), dy, u(15), C.gold);
        R.UIK.text(g, m.text, x + u(30), dy, { size: u(14), weight: 700, color: C.goldHi, maxW: w - u(30) });
      } else if (row) {
        R.UIK.icon(g, 'bulb', x + u(8), dy, u(15), C.teal);
        R.UIK.text(g, row.desc || '', x + u(30), dy, { size: u(14), color: C.text2, maxW: w - u(30) });
      }
      const pr = v.tab === 0 ? [{ btn: 'left', label: '変える' }] : v.tab === 1 ? [{ btn: 'a', label: '実行' }] : [{ btn: 'a', label: '飛ぶ' }];
      if (Sc.prompts) Sc.prompts(g, pr.concat([{ btn: 'l', label: 'タブ' }, { btn: 'b', label: '閉じる' }]));
    };
    const sc = {
      id: 'tester',
      opaque: false,
      view: v,
      enter() { v.layer.open(); if (R.Input.touchLayout) { v.prevLayout = R.Input.layoutName; R.Input.touchLayout('menu'); } },
      exit() { if (R.Input.touchLayout && v.prevLayout) R.Input.touchLayout(v.prevLayout); },
      update() { try { v.update(); } catch (e) { R.Engine.reportError ? R.Engine.reportError(e) : console.error(e); } },
      draw(g) {
        R.UIK.dim(g, 0.55 * v.layer.alpha());
        g.save();
        v.layer.apply(g);
        v.draw(g);
        g.restore();
      },
    };
    Object.defineProperty(sc, 'list', { get() { return v.list; } });
    return sc;
  }

  // ---------------------------------------------------------------- フィールドの上の印（宝箱・隠し通路の入口）
  function drawReveal(g) {
    if (!T.opt('reveal')) return;
    const top = R.Engine.top();
    if (!top || top.id !== 'field') return;
    const F = R.Field, Sx = F && F._s, m = Sx && Sx.map;
    if (!m || !F._cam) return;
    const cam = F._cam({}), t = cam.t;
    const G = R.Game || {};
    const opened = (G.chests && G.chests[m.id]) || [];
    const pulse = 0.85 + 0.15 * Math.sin(R.Engine.time / 300);
    const mark = (x, y, col) => {
      const sx = x * t + t / 2 - cam.cx, sy = y * t + t / 2 - cam.cy;
      if (sx < -t || sy < -t || sx > R.W + t || sy > R.H + t) return;
      g.save(); g.globalAlpha = pulse;
      R.UIK.glow(g, sx, sy - t * 0.7, t * 0.6, col === '#ff7ad0' ? [255, 122, 208] : [255, 214, 140], 0.5);
      R.UIK.diamond(g, sx, sy - t * 0.7, Math.max(5, t * 0.22), col, 'rgba(20,12,4,0.9)', 1.5);
      g.restore();
    };
    for (const o of m.objects || []) {
      if (o.type !== 'chest' || opened.includes(o.id)) continue;
      if (o.cond != null && !R.State.check(o.cond)) continue;
      mark(o.x, o.y, TK().color.gold);
    }
    if (R.MapUtil.secretAreas) {
      for (const a of R.MapUtil.secretAreas(m)) for (const k of a.gate) {
        const [gx, gy] = k.split(',').map(Number);
        if (!R.MapUtil.secretFound(m.id, gx, gy)) mark(gx, gy, '#ff7ad0');
      }
    }
  }
  const install0 = T._install;
  T._install = function () {
    install0();
    if (R.Engine && R.Engine.overlay) R.Engine.overlay('tester_reveal', drawReveal, 940);
  };
  const uninstall0 = T._uninstall;
  T._uninstall = function () {
    uninstall0();
    if (R.Engine && R.Engine.overlay) R.Engine.overlay('tester_reveal', null);
  };
  if (T._installed && R.Engine && R.Engine.overlay) R.Engine.overlay('tester_reveal', drawReveal, 940);
})(window.RPG);
