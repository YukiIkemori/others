// テスト用メニュー（テストプレイ用の特殊機能。オーナー「エンカウントゼロとか経験値20倍とかHPMP全回復とか」）
//
// 公開のテスト版（dist/index.html → pack_web.py の写し）には入るが、ふだんは眠っている:
//   ・URL に ?tester=1 を付けて開くと有効になり、localStorage（luminous_chronicle_v2_tester）に覚える。?tester=0 で無効に戻す
//   ・有効の間だけ F9（パッドは セレクト＋L＋R）でメニューを開く・閉じる（フィールドとタイトルの上だけ）
//   ・製品版（Steam）には入れない: node tools/build.js --release（= --no-tester --no-dev）で src/tester/ を丸ごと外す。
//     外すと R.Tester が無くなり、下の差し込み口は全部「R.Tester が無い = 何もしない」になる
//
// 切り替えの値は「この PC のこのブラウザ」に残る（localStorage。セーブには入らない）。どの記録を読んでも同じ設定で遊べる。
// 何か 1 つでも効いている間は画面の上に小さな「TEST」の札を出し、その間の旅は R.Game.testerUsed = true（セーブに残る）→
// 記録の札にも「TEST」の印（src/core/save.js の makeCard → src/screens/saveload.js）。
//
// 差し込み口（本物の処理の中。どれも R.Tester が無い／有効でなければ元のまま）:
//   R.Mon.encounter（mon.js）                 noEncounter()   歩いて出る戦闘を出さない（イベント・ボスの戦闘は R.Battle.start なのでそのまま）
//   R.Growth.afterBattle（growth.js）         mul('exp')      伸びの期待値を N 倍（確率を N 倍、1 を越えた分は 1 回の伸びの量へ）
//   R.Rules.train（rules.js）                 mul('prof')     戦闘の熟練度の点を N 倍
//   Engine.computeRewards（battle_core.js）   gold(g)         戦闘のお金を N 倍
//   Engine.hit / dotDamage / 状態（battle_core.js）hitFix・dmgFix・guard  無敵（味方にダメージと悪い状態が入らない）・一撃（敵に当たれば倒れる）
//   Engine.tryEscape（battle_core.js）        opt('flee')     逃げるが必ず成功（逃げられない戦闘はそのまま）
//   R.Glimmer.chance（glimmer.js）            glim(p)         閃きの確率を ×10（1 まで）
//   F._step（field/move.js）                  moveMul()       1 歩の時間を半分に（移動速度 ×2）
//   minimap の body（field/minimap.js）       opt('reveal')   開けていない宝箱と見つけていない隠し通路の入口を地図に出す
(function (R) {
  'use strict';
  const KEY = 'luminous_chronicle_v2_tester';

  // 切り替えの一覧（値の候補。最初が既定 = 何もしない）
  const OPTS = {
    noEnc: [false, true],
    invincible: [false, true],
    onehit: [false, true],
    flee: [false, true],
    speed: [1, 2],
    reveal: [false, true],
    exp: [1, 2, 5, 10, 20],
    prof: [1, 5, 20],
    gold: [1, 10],
    glim: [1, 10],
  };
  const defaults = () => { const o = {}; for (const k of Object.keys(OPTS)) o[k] = OPTS[k][0]; return o; };

  function ls() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
  function readStore() {
    const s = ls();
    try { const v = s && s.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeStore() {
    const s = ls();
    try { if (s) s.setItem(KEY, JSON.stringify({ on: T.enabled, o: T.opts })); } catch (e) { /* 書けなくても今の間は効く */ }
  }

  const T = (R.Tester = {
    OPTS,
    enabled: false,
    opts: defaults(),

    /** 有効・無効（?tester=1/0 と同じ。テストからも呼ぶ）。無効にしても切り替えの値は残す（次に有効にしたとき同じ） */
    enable(v) {
      T.enabled = !!v;
      writeStore();
      if (T.enabled) T._install(); else T._uninstall();
      return T.enabled;
    },
    /** 値を変える（候補に無い値は無視）→ 今の値 */
    set(k, v) {
      if (!OPTS[k]) return undefined;
      if (OPTS[k].indexOf(v) < 0) return T.opts[k];
      T.opts[k] = v;
      writeStore();
      T.stamp();
      return v;
    },
    /** 全部の切り替えを既定へ */
    reset() { T.opts = defaults(); writeStore(); },
    /** 何か 1 つでも効いているか（無効なら false） */
    get on() {
      if (!T.enabled) return false;
      for (const k of Object.keys(OPTS)) if (T.opts[k] !== OPTS[k][0]) return true;
      return false;
    },
    /** 切り替えの今の値（無効なら既定） */
    opt(k) { return T.enabled && OPTS[k] ? T.opts[k] : OPTS[k] ? OPTS[k][0] : undefined; },
    /** 倍率（無効なら 1） */
    mul(k) { const v = T.opt(k); return typeof v === 'number' && v > 0 ? v : 1; },

    // ------------------------------------------------------------ 差し込み口（本物の処理が呼ぶ）
    noEncounter() { return !!T.opt('noEnc'); },
    gold(g) { const m = T.mul('gold'); return m === 1 ? g : Math.round(g * m); },
    glim(p) { const m = T.mul('glim'); return m === 1 ? p : Math.min(1, p * m); },
    moveMul() { return T.mul('speed') > 1 ? 1 / T.mul('speed') : 1; },
    /** 味方を守るか（無敵） */
    guard(u) { return !!(u && u.isParty && T.opt('invincible')); },
    /** 当たった 1 回の結果 r を書き換える（Engine.hit の最初）。無敵: 味方への害を 0、一撃: 敵に当たれば残りの HP 以上 */
    hitFix(tgt, r, info) {
      if (!tgt || !r) return r;
      if (tgt.isParty && T.opt('invincible')) {
        if (r.dmg > 0 || r.zero) { r.dmg = 0; r.zero = true; r.crit = false; }
      } else if (!tgt.isParty && T.opt('onehit') && !(info && info.mp) && !(r.dmg < 0)) {
        r.miss = false; r.zero = false;
        r.dmg = Math.max(r.dmg || 0, tgt.hp || 1);
      }
      return r;
    },
    /** 丸めた後のダメージ（上限 K.DMG.max で止まった物も）: 一撃なら敵の残りの HP */
    dmgFix(tgt, dmg, info) {
      if (tgt && !tgt.isParty && T.opt('onehit') && !(info && info.mp)) return Math.max(dmg, tgt.hp || 1);
      return dmg;
    },

    // ------------------------------------------------------------ ボタン（R.Game を書く）
    /** その旅に TEST の印（セーブの札に出る）。何か効いている間は毎フレーム、ボタンを使ったときも */
    stamp(force) { if (R.Game && (force || T.on)) R.Game.testerUsed = true; },
    members() { return R.Game && R.Party && R.Party.all ? R.Party.all() : []; },
    /** 全員（控えも）HP・MP 全回復・倒れた人も起こす・状態も消す（宿と同じ R.Party.restoreAll） */
    healAll() {
      if (!R.Game) return false;
      R.Party.restoreAll();
      T.stamp(true);
      return true;
    },
    /** 状態異常だけ治す */
    cure() {
      if (!R.Game) return false;
      for (const c of T.members()) c.status = [];
      T.stamp(true);
      return true;
    },
    maxGold() { return (R.Rules && R.Rules.K && R.Rules.K.MAX_GOLD) || 9999999; },
    addGold(n) {
      if (!R.Game) return false;
      R.Game.gold = Math.max(0, Math.min(T.maxGold(), (R.Game.gold || 0) + n));
      T.stamp(true);
      return R.Game.gold;
    },
    goldMax() { if (!R.Game) return false; R.Game.gold = T.maxGold(); T.stamp(true); return R.Game.gold; },
    /** 使う道具（slot 'use'）を全種 99（K.MAX_ITEM）に → 足した種類の数 */
    items99() {
      if (!R.Game) return false;
      const max = (R.Rules && R.Rules.K && R.Rules.K.MAX_ITEM) || 99;
      let n = 0;
      for (const id of Object.keys(R.DB.items || {})) {
        const it = R.DB.items[id];
        if (!it || it.slot !== 'use' || it.hidden) continue;
        if ((R.Game.items[id] || 0) < max) n++;
        R.Game.items[id] = max;
      }
      T.stamp(true);
      return n;
    },
    /**
     * レベルを上げる = 成長の点 gl を n だけ上げる（このゲームにレベルは無い。gl は内部の相当レベル。ティアの上限は越えてよい、glMax まで）。
     * 最大 HP・MP の増えは今の HP・MP にも足す（R.Growth.afterBattle と同じ）→ 上げた人の数
     */
    levelUp(n) {
      if (!R.Game) return false;
      const K = R.Rules.K.GROW;
      let k = 0;
      for (const c of T.members()) {
        const gl0 = R.Growth.gl(c);
        const gl1 = Math.min(K.glMax, Math.floor(gl0) + n);
        if (gl1 <= gl0) continue;
        const before = R.Rules.stats(c);
        c.gl = gl1;
        const after = R.Rules.stats(c);
        if (c.hp > 0) c.hp = Math.min(after.maxHp, c.hp + Math.max(0, after.maxHp - before.maxHp));
        c.mp = Math.min(after.maxMp, (c.mp || 0) + Math.max(0, after.maxMp - before.maxMp));
        k++;
      }
      T.stamp(true);
      return k;
    },

    // ------------------------------------------------------------ ワープ
    /** 体験版の範囲（pack_web.py --scope demo と同じ: regions.js で slice: 'locked' の地方を除く）の町・ダンジョン・野・ワールド → [{map, spawn, name, kind, region}] */
    warpList() {
      const DB = R.DB, locked = new Set();
      for (const [rid, r] of Object.entries(DB.regions || {})) if (r && r.slice === 'locked') locked.add(rid);
      const regionOrder = ['prologue'].concat(Object.keys(DB.regions || {}));
      const KIND = { town: 0, dungeon: 1, field: 2, world: 3 };
      const out = [];
      for (const [id, m] of Object.entries(DB.maps || {})) {
        if (!m || KIND[m.kind] == null || /^stub_/.test(id)) continue;
        const loc = m.location && DB.locations && DB.locations[m.location];
        const region = m.region || (loc && loc.region) || 'prologue';
        if (locked.has(region)) continue;
        const spawns = Object.keys(m.spawns || {});
        const spawn = loc && loc.map === id && loc.spawn && m.spawns && m.spawns[loc.spawn] ? loc.spawn : spawns[0];
        out.push({ map: id, spawn, name: m.name || id, kind: m.kind, region });
      }
      const ri = (r) => { const i = regionOrder.indexOf(r); return i < 0 ? 99 : i; };
      out.sort((a, b) => ri(a.region) - ri(b.region) || KIND[a.kind] - KIND[b.kind] || (a.map < b.map ? -1 : a.map > b.map ? 1 : 0));
      return out;
    },
    /** 今ワープできるか（フィールドにいて、イベント・戦闘・暗転の間でない） */
    canWarp() {
      if (!R.Game || !R.Field || !R.Engine.has('field')) return false;
      if (R.Events && R.Events.busy && R.Events.busy()) return false;
      if (R.Field._locked && R.Field._locked()) return false;
      return !R.Engine.has('battle');
    },
    async warp(mapId, spawn) {
      const m = R.DB.maps[mapId];
      if (!m || !T.canWarp()) return false;
      T.stamp(true);
      await R.Field.enter(mapId, spawn, { fade: 260, noAutosave: true });
      return true;
    },

    // ------------------------------------------------------------ 有効な間だけの仕掛け（キー・パッド・札）
    _installed: false,
    _install() {
      if (T._installed || !R.Engine) return;
      T._installed = true;
      R.Engine.addTick(T._tick);
      if (R.Engine.overlay) R.Engine.overlay('tester', T._drawBadge, 950);
      if (typeof window !== 'undefined' && window.addEventListener && typeof document !== 'undefined') {
        window.addEventListener('keydown', T._onKey, true);
      }
    },
    _uninstall() {
      if (!T._installed) return;
      T._installed = false;
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('keydown', T._onKey, true);
      if (R.Engine.overlay) R.Engine.overlay('tester', null);
      // addTick は外せないので、_tick の中で enabled を見る
    },
    _want: false,
    _padDown: false,
    _onKey(e) {
      if (!T.enabled || e.code !== 'F9' || e.repeat) return;
      e.preventDefault();
      T._want = true;
    },
    _tick() {
      if (!T.enabled) return;
      // パッド: セレクト（標準配置の 8）＋L（4）＋R（5）を同時に
      try {
        const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
        let down = false;
        for (const p of pads || []) {
          if (!p || !p.buttons) continue;
          const b = (i) => p.buttons[i] && p.buttons[i].pressed;
          if (b(8) && b(4) && b(5)) down = true;
        }
        if (down && !T._padDown) T._want = true;
        T._padDown = down;
      } catch (e) { /* パッドが読めなくてもキーで開ける */ }
      if (T._want) { T._want = false; T.toggleMenu(); }
      T.stamp();
    },
    /** メニューを開く・閉じる（src/tester/tester_menu.js が R.Tester.Menu を置く） */
    toggleMenu() {
      if (!T.Menu) return false;
      if (T.Menu.isOpen()) { T.Menu.close(); return false; }
      return T.Menu.open();
    },
    _drawBadge(g) {
      if (!T.on) return;
      const U = R.UIK;
      if (!U || !U.chip) return;
      const s = R.safe || { t: 0 };
      const k = R.uiScale || 1;
      const text = 'TEST';
      const w = U.measure(text, { size: 11 * k, weight: 700 }) + 14 * k;
      U.chip(g, R.W / 2 - w / 2, s.t + 6 * k, text, { size: 11, bg: 'rgba(160,40,40,0.78)', line: 'rgba(255,200,180,0.8)', color: '#ffe8e0' });
    },
  });

  // 起動: 保存した値 → URL の ?tester=1/0（ブラウザだけ。node のテストは enable() を呼ぶ）
  const st = readStore();
  if (st && st.o && typeof st.o === 'object') for (const k of Object.keys(OPTS)) if (OPTS[k].indexOf(st.o[k]) >= 0) T.opts[k] = st.o[k];
  let on = !!(st && st.on);
  try {
    if (typeof location !== 'undefined' && location.search && typeof URLSearchParams !== 'undefined') {
      const q = new URLSearchParams(location.search).get('tester');
      if (q === '1' || q === 'on' || q === 'true') on = true;
      else if (q === '0' || q === 'off' || q === 'false') on = false;
      if (q != null) { T.enabled = on; writeStore(); }
    }
  } catch (e) { /* 読めなければ保存した値 */ }
  T.enabled = on;
  if (on) {
    if (R.onBoot) R.onBoot(() => T._install());
    else T._install();
  }
})(window.RPG);
