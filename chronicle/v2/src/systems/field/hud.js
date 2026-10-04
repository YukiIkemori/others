// FIELD — HUD（MODERN_UI §6.2、town.png・field.png・dungeon.png・town_tall.png）
//   左上: 場所の名前（入ったときに 2.4 秒。ダンジョンは常に）＋ひとこと＋町の施設のアイコン、ダンジョンは「宝箱 開けた数/総数」、暗がりは「暗い」。
//         町では「新しい話 ◯人」（E19）。
//   右上: 目印の手がかりの札（題名・場所・方角の針）。目印が無ければ出さない。ダンジョンは下に小地図（minimap.js）。縦持ちは左上の場所の下。
//         X で 小地図 → 大きな地図（画面の中ほど、歩ける）→ 出さない（設定 fieldMap。H.cycleMap）。小地図の無いマップの X は世界の地図の画面。
//   物の上: 近づいたときだけ「[A] 調べる」「[A] 泉で休む」の吹き出し（R.UIK.bubble）。人の上には出さない（ほぼ誰とでも話せる。持ち主 2026-09-28）。
//   右下: ボタン表示（設定 prompts: always／最初の 2 時間／出さない）。タッチの操作パッドが出ているときは出さない。
//   上の中ほど: 「次にやること」の札（L で数秒。本筋の段が変わったときも一度。H.showGoal）。
//   通知: R.Field.hud.toast(text, {icon, anchor}) → R.UIK.toast（入手は右上 'tr'、システムは左下 'bl'）。
//   毎フレームの文字は refresh() で作っておく（毎フレーム新しい文字列を作らない）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const H = (F.hud = F.hud || {});
  const TWO_H = 2 * 3600 * 1000;
  const FAC = { inn: 'inn', shop: 'shop', tavern: 'chat', item: 'bag', weapon: 'sword', armor: 'shield', church: 'light', guild: 'journal', records: 'book', record: 'book' };
  const PROMPTS_TOWN = [{ btn: 'y', label: R.T('sys.hud.PROMPTS_TOWN.0.label') }, { btn: 'x', label: R.T('sys.hud.PROMPTS_TOWN.1.label') }, { btn: 'l', label: R.T('sys.hud.PROMPTS_TOWN.2.label') }, { btn: 'b', label: R.T('sys.hud.PROMPTS_TOWN.3.label') }];   // 町の X は「町の地図」（draw で）
  const PROMPTS_DUN = [{ btn: 'y', label: R.T('sys.hud.PROMPTS_DUN.0.label') }, { btn: 'x', label: R.T('sys.hud.PROMPTS_DUN.1.label') }, { btn: 'l', label: R.T('sys.hud.PROMPTS_DUN.2.label') }, { btn: 'b', label: R.T('sys.hud.PROMPTS_DUN.3.label') }];
  // ダンジョンの地図（設定 fieldMap）: X で 小地図 → 大きな地図 → 出さない → 小地図。ボタン表示は「次に押すと何になるか」
  const MAP_NEXT = { mini: 'big', big: 'off', off: 'mini' };
  const MAP_LABEL = { mini: R.T('sys.hud.MAP_LABEL.mini'), big: R.T('sys.hud.MAP_LABEL.big'), off: R.T('sys.hud.MAP_LABEL.off') };
  const MAP_TOAST = { mini: R.T('sys.hud.MAP_TOAST.mini'), big: R.T('sys.hud.MAP_TOAST.big'), off: R.T('sys.hud.MAP_TOAST.off') };
  const DIR_ANGLE = { n: 0, ne: Math.PI / 4, e: Math.PI / 2, se: Math.PI * 0.75, s: Math.PI, sw: -Math.PI * 0.75, w: -Math.PI / 2, nw: -Math.PI / 4 };
  const DIR_JA = { n: R.T('sys.hud.DIR_JA.n'), ne: R.T('sys.hud.DIR_JA.ne'), e: R.T('sys.hud.DIR_JA.e'), se: R.T('sys.hud.DIR_JA.se'), s: R.T('sys.hud.DIR_JA.s'), sw: R.T('sys.hud.DIR_JA.sw'), w: R.T('sys.hud.DIR_JA.w'), nw: R.T('sys.hud.DIR_JA.nw') };
  const B = [{ btn: 'a', label: '' }];

  // ---------------------------------------------------------------- 次にやること（L。オーナーの依頼 2026-09-28）
  //   フィールドで L（キーボード Q・パッド LB。フィールドでは空いていたボタン）を押すと、上の中ほどに「次にやること」の札を数秒。
  //   本筋の段（R.Leads.goal()）が変わったときも、落ち着いた（会話・暗転・メニューが無い）ところで一度だけ出す。読み込んだ直後は出さない。
  const GOAL_MS = 4200, GOAL_AUTO_MS = 3200;
  const goal = { t0: -1e9, ms: GOAL_MS, text: '', last: undefined, game: null, frame: 0, installed: false };
  function fieldCalm() {
    const top = R.Engine && R.Engine.top && R.Engine.top();
    return !!top && top === F.scene && !!S.map && !S.entering && !F._locked() && !(R.Events && R.Events.busy && R.Events.busy()) && R.Engine.fade.a < 0.01;
  }
  /** 札を出す（ms は出している長さ）。→ 出したら true（目標が無ければ false） */
  H.showGoal = function (ms) {
    const gl = R.Leads && R.Leads.goal ? R.Leads.goal() : null;
    if (!gl) return false;
    goal.text = gl.text; goal.t0 = R.Engine.time; goal.ms = ms || GOAL_MS; goal.last = gl.id;
    return true;
  };
  /** 今出している札（テスト用）: {text, age} | null */
  H._goal = function () { const age = R.Engine.time - goal.t0; return age >= 0 && age < goal.ms ? { text: goal.text, age } : null; };
  function goalTick() {
    if (!R.Game || R.Game !== goal.game) { goal.game = R.Game || null; goal.last = undefined; goal.t0 = -1e9; }
    if (!R.Game || !fieldCalm()) return;
    if (R.Input.pressed('l')) {
      R.Input.consume('l');
      if (H.showGoal(GOAL_MS)) R.UIK.sfx('cursor'); else R.UIK.sfx('buzzer');
      return;
    }
    // 段が変わったか（毎フレームは量らない）
    if (++goal.frame % 20) return;
    const gl = R.Leads && R.Leads.goal ? R.Leads.goal() : null;
    const id = gl ? gl.id : null;
    if (goal.last === undefined) { goal.last = id; return; }
    if (id && id !== goal.last) {
      // 手がかりの通知の札が出ている間は待つ（右上と重ねない）
      if (R.Leads._current && R.Leads._current()) return;
      H.showGoal(GOAL_AUTO_MS);
    } else goal.last = id;
  }
  function installGoal() {
    if (goal.installed || !R.Engine || !R.Engine.addTick) return;
    goal.installed = true;
    R.Engine.addTick(goalTick);
  }
  function drawGoal(g) {
    const age = R.Engine.time - goal.t0;
    if (age < 0 || age >= goal.ms || !goal.text) return;
    const U = R.UIK.u, T = R.UIK.T, C = T.color, s = R.safe, tall = R.layout === 'tall';
    const kin = Math.min(1, age / 200), kout = Math.min(1, (goal.ms - age) / 360);
    const a = Math.max(0, Math.min(kin, kout));
    if (a <= 0) return;
    const ts = U(15), lab = R.T('sys.hud.drawGoal.lab');
    const tw = R.UIK.measure(goal.text, { size: ts, weight: 700 });
    const maxW = Math.min(R.W - s.l - s.r - U(tall ? 32 : 40), U(460));
    const w = Math.min(maxW, Math.max(U(240), tw + U(64)));
    const h = U(54);
    const x = Math.round(s.l + (R.W - s.l - s.r - w) / 2);
    const y = Math.round(s.t + U(tall ? 64 : 16) - (1 - R.UIK.ease(kin)) * U(10));
    g.save();
    g.globalAlpha = a;
    R.UIK.panel(g, { x, y, w, h }, { r: U(12), a: 0.86 });
    g.fillStyle = 'rgba(236,201,124,0.85)';
    g.fillRect(x + U(1), y + U(12), U(2), h - U(24));
    R.UIK.icon(g, 'star', x + U(16), y + U(10), U(14), C.gold);
    R.UIK.text(g, lab, x + U(36), y + U(10), { size: U(11), weight: 700, color: C.gold, track: U(1.5) });
    R.UIK.text(g, goal.text, x + U(16), y + U(28), { size: ts, weight: 700, color: C.text, maxW: w - U(32) });
    g.restore();
  }

  H.toast = function (text, o) { R.UIK.toast(text, Object.assign({ anchor: 'tr' }, o || {})); };

  /** ダンジョンの地図の出し方（'mini'|'big'|'off'）。小地図の無いマップでは null */
  H.mapMode = function () { return S.hud && S.hud.showMini ? (MAP_NEXT[R.Settings.get('fieldMap')] ? R.Settings.get('fieldMap') : 'mini') : null; };
  /** X（field.js）: 小地図のあるマップなら出し方を次へ（設定に残す＝階を移っても・次に起動しても同じ）→ true。無ければ false（世界の地図を開く） */
  H.cycleMap = function () {
    const cur = H.mapMode();
    if (!cur) return false;
    const nx = MAP_NEXT[cur];
    R.Settings.set('fieldMap', nx);
    R.UIK.sfx('cursor');
    R.UIK.toast(MAP_TOAST[nx], { anchor: 'bl', icon: 'map' });
    return true;
  };

  /** 文字と数を作り直す（入る・宝箱・手がかり・会話・フラグのあと） */
  H.refresh = function () {
    const m = S.map, G = R.Game;
    installGoal();
    if (!m) return;
    const c = (S.hud = S.hud || {});
    c.name = m.name || m.id;
    const meta = m.meta || {};
    const loc = m.location && R.DB.locations[m.location];
    c.sub = meta.sub || meta.floor || (m.kind === 'world' && loc ? loc.name : '') || '';
    // ワールドの地方の名前（CONTENT-P の meta.areas = [{rect, name, sub}]。上から最初に合う物）
    const ar = areaAt(m, S.x, S.y);
    c.area = ar;
    if (ar) { c.name = ar.name || c.name; c.sub = ar.sub || ''; }
    // 施設のアイコン（町）: 建物の看板から
    c.icons = [];
    if (m.kind === 'town') for (const o of m.objects || []) if (o.type === 'building' && o.sign && FAC[o.sign] && !c.icons.includes(FAC[o.sign])) c.icons.push(FAC[o.sign]);
    // 宝箱の数は出さない（持ち主の決まり 2026-09-27: 開けた数・総数の表示はいらない。meta.chestsInfo も見ない）
    const chests = (m.objects || []).filter((o) => o.type === 'chest');
    const showChests = false && chests.length;
    const opened = G ? chests.filter((o) => ((G.chests[m.id] || []).includes(o.id))).length : 0;
    c.chests = showChests ? R.T('sys.hud.refresh.chests', { opened, length: chests.length }) : '';
    c.chestsDone = showChests && opened === chests.length;
    // 新しい話（E19。ハッシュは EVENTS）
    let nNew = 0;
    for (const n of S.npcs || []) {
      n.isNew = false;
      if (!n.vis || !n.def.key || !n.def.talk) continue;
      try { n.isNew = !!R.Events.isNew(m, n.def); } catch (e) { n.isNew = false; }
      if (n.isNew) nNew++;
    }
    // 町の名前の下の「新しい話 N人」は出さない（持ち主 2026-10-04「あれいらない」）。n.isNew は数えたまま（ほかで使う）
    c.newTalk = '';
    void nNew;
    // 目印の手がかり
    c.lead = null;
    try {
      const id = G && R.Leads.pinned();
      const L = id && R.DB.leads[id];
      // 目印の札は、目印が変わったときとマップに入ったときに 6 秒だけ出す（持ち主 2026-10-04「今のやつじゃない手がかりが
      //   ずっと右上に出っぱなしで鬱陶しい」）。手がかりの一覧（Q）ではいつでも見られる
      const key = (id || '') + '|' + m.id;
      if (H._leadKey !== key) { H._leadKey = key; H._leadT0 = Date.now(); }
      if (L) c.lead = { title: L.title, where: [L.dir ? DIR_JA[L.dir] : '', L.place || ''].filter(Boolean).join(R.T('sys.hud.refresh.lead.where.join')), ang: L.dir != null && DIR_ANGLE[L.dir] != null ? DIR_ANGLE[L.dir] : null };
    } catch (e) { c.lead = null; }
    c.showMini = m.kind === 'dungeon' && meta.minimap !== false;
  };

  function areaAt(m, x, y) {
    const A = m.meta && m.meta.areas;
    if (!A) return null;
    for (let i = 0; i < A.length; i++) if (R.MapUtil.inRect(x, y, A[i].rect)) return A[i];
    return null;
  }
  /** 歩くたび（ワールド）: 地方が変わったら札を出し直す */
  H.step = function () {
    const m = S.map;
    if (!m || !m.meta || !m.meta.areas) return;
    const ar = areaAt(m, S.x, S.y);
    // 同じ名前の別の四角（地形に合わせて付け替えた所、tools/world_zones.js）に移っただけなら札を出し直さない
    const nm = (a) => (a ? a.name + '\n' + (a.sub || '') : '');
    if (S.hud && nm(ar) !== nm(S.hud.area)) { H.refresh(); S.placeT0 = R.Engine.time; }
  };

  /** 場所の札を出している強さ 0〜1（入ったとき 2.4 秒、ダンジョンは常に） */
  function placeAlpha() {
    if (S.map.kind === 'dungeon') return 1;
    const dt = R.Engine.time - S.placeT0;
    if (dt < 0) return 0;
    if (dt < 250) return dt / 250;
    if (dt < F.PLACE_MS) return 1;
    return Math.max(0, 1 - (dt - F.PLACE_MS) / 450);
  }
  function showPrompts() {
    const p = R.Settings.get('prompts');
    if (p === 'never') return false;
    if (R.Input.touchVisible()) return false;
    if (p === 'always') return true;
    return !R.Game || (R.Game.playMs || 0) < TWO_H;
  }
  function diamond(g, x, y, r, fill, stroke) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }

  H.draw = function (g, cam) {
    const c = S.hud;
    if (!c || !S.map) return;
    const top = R.Engine.top() === F.scene;
    const U = R.UIK.u, T = R.UIK.T, s = R.safe, tall = R.layout === 'tall';
    const gold = T.color.gold;
    // ---- 左上: 場所
    const a = placeAlpha();
    let ly = s.t + U(18);
    if (a > 0.01) {
      g.save(); g.globalAlpha = a;
      const x = s.l + U(20), y = ly;
      diamond(g, x + U(10), y + U(14), U(9), 'rgba(236,201,124,0.18)', 'rgba(236,201,124,0.85)');
      diamond(g, x + U(10), y + U(14), U(4), gold, null);
      R.UIK.text(g, c.name, x + U(28), y + U(2), { size: U(19), weight: 700, shadow: true });
      const w = R.UIK.measure(c.name, { size: U(19), weight: 700 });
      const gr = g.createLinearGradient(x + U(24), 0, x + U(84) + w, 0);
      gr.addColorStop(0, 'rgba(236,201,124,0.55)'); gr.addColorStop(1, 'rgba(236,201,124,0)');
      g.fillStyle = gr; g.fillRect(x + U(24), y + U(28), w + U(60), 0.75);
      let sy = y + U(34);
      let sx = x + U(28);
      const sub = c.sub;
      if (sub) { R.UIK.text(g, sub, sx, sy, { size: U(11.5), color: T.color.text2, shadow: true }); sx += R.UIK.measure(sub, { size: U(11.5) }) + U(14); }
      if (c.chests) { R.UIK.text(g, c.chests, sx, sy, { size: U(11.5), color: c.chestsDone ? gold : T.color.text2, shadow: true }); sx += R.UIK.measure(c.chests, { size: U(11.5) }) + U(12); }
      if (F.dark.on() && R.MapUtil.darkAt(S.map, S.x, S.y)) R.UIK.chip(g, sx, sy - U(2), R.T('sys.hud.draw.chip'), { color: '#b8b0e8', bg: 'rgba(90,80,160,0.25)' });
      if (sub || c.chests) sy += U(18);
      if (c.icons.length) { for (let i = 0; i < c.icons.length; i++) R.UIK.icon(g, c.icons[i], x + U(28) + i * U(20), sy, U(14), T.color.text2); sy += U(20); }
      if (c.newTalk) { R.UIK.chip(g, x + U(28), sy, c.newTalk, {}); sy += U(22); }
      g.restore();
      ly = sy + U(8);
    }
    // ---- 右上（縦持ちは左上の下）: 手がかりの札・小地図
    let ry = s.t + U(18);
    const cw = tall ? Math.min(R.W - s.l - s.r - U(32), U(330)) : U(244);
    // タッチの操作パッドが出ているときは、右上のメニューのボタンを避ける
    let right = R.W - s.r - U(16);
    if (!tall && R.Input.touchVisible()) { const sp = R.Input.touchSpots().y; if (sp) right = Math.min(right, sp.x - sp.r - U(12)); }
    const cx0 = tall ? s.l + U(16) : right - cw;
    if (tall) ry = Math.max(ly, s.t + U(96));
    const leadAge = Date.now() - (H._leadT0 || 0), LEAD_MS = 6000;
    if (c.lead && leadAge < LEAD_MS) {
      g.save();
      g.globalAlpha *= Math.min(1, leadAge / 250, (LEAD_MS - leadAge) / 600);
      leadCard(g, cx0, ry, cw, c.lead);
      g.restore();
      ry += U(62);
    }
    const mode = H.mapMode();
    // 会話の窓・選択肢が出ている間は小地図を描かない（低い窓・縦持ちで窓や選択肢の札に重なった。テスト報告 P30）
    const talking = !!(R.UIK.Message && R.UIK.Message.busy && R.UIK.Message.busy());
    if (mode === 'mini' && !talking) F.minimap.draw(g, tall ? cx0 : right - U(138), ry + U(2), U(138), U(150));
    else if (mode === 'big') {
      // 大きな地図: 画面の中ほど（上の場所の札・下のボタン表示と重ならない高さ）。歩きながら見られる
      const ah = R.H - s.t - s.b - U(tall ? 260 : 150), aw = R.W - s.l - s.r - U(tall ? 24 : 120);
      F.minimap.drawBig(g, s.l + (R.W - s.l - s.r) / 2, s.t + U(tall ? 150 : 84) + ah / 2, Math.min(aw, U(760)), Math.min(ah, U(560)));
    }
    // ---- 吹き出し（近づいたときだけ。物だけ: 人の「[A] 話す」は出さない。持ち主の決まり 2026-09-28: ほぼ誰とでも話せるので要らない）
    if (top && !F._locked() && !S.mv && !R.Events.busy()) {
      const f = F._front();
      if (f && f.kind !== 'npc') {
        const t = cam.t;
        const bx = Math.round((f.x + (f.kind === 'obj' && f.obj.type === 'spring' ? 1 + (f.obj.dx || 0) : 0.5)) * t - cam.cx);
        const by = Math.round(f.y * t - cam.cy - 6);
        B[0].label = f.label;
        R.UIK.bubble(g, bx, by, B);
      }
    }
    // ---- 上の中ほど: 次にやること（L）
    if (top) drawGoal(g);
    // ---- 右下: ボタン表示
    if (top && showPrompts()) {
      PROMPTS_DUN[1].label = mode ? MAP_LABEL[mode] : R.T('sys.hud.draw.label');
      PROMPTS_TOWN[1].label = S.map.kind === 'town' ? R.T('sys.hud.draw.label_2') : R.T('sys.hud.draw.label');
      R.UIK.prompts(g, S.map.kind === 'dungeon' ? PROMPTS_DUN : PROMPTS_TOWN, 'br');
    }
  };

  function leadCard(g, x, y, w, L) {
    const U = R.UIK.u, T = R.UIK.T;
    R.UIK.panel(g, { x, y, w, h: U(54) }, { r: U(10) });
    R.UIK.icon(g, 'quest', x + U(10), y + U(10), U(16), T.color.gold);
    R.UIK.text(g, R.T('sys.hud.leadCard.text'), x + U(32), y + U(10), { size: U(10), weight: 700, color: T.color.gold });
    R.UIK.text(g, R.UIK.fit(L.title, w - U(70), { size: U(13.5), weight: 700 }), x + U(32), y + U(28), { size: U(13.5), weight: 700 });
    if (L.where) R.UIK.text(g, L.where, x + w - U(12), y + U(10), { size: U(10), color: T.color.text3, align: 'right' });
    if (L.ang != null) {
      const nx = x + w - U(22), ny = y + U(36);
      g.save(); g.translate(nx, ny); g.rotate(L.ang);
      g.beginPath(); g.moveTo(0, -U(8)); g.lineTo(U(4), U(4)); g.lineTo(0, U(1.5)); g.lineTo(-U(4), U(4)); g.closePath();
      g.fillStyle = T.color.gold; g.fill(); g.restore();
    }
  }
})(window.RPG);
