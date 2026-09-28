// MENUS: 画面の土台（V2_PLAN §2.5.15・§3.11、MODERN_UI §3・§6）。R.Screens.open / tip / detail と、画面どうしで使う部品。
//
//   R.Screens.open(id, params) → Promise<result>   id は R.Contract.SCREEN_IDS。結果の形は R.Contract.SCREEN_RESULTS
//   R.Screens.tip(id)                              初めての仕組みの説明の札（1 回だけ。R.Game.flags['tip_<id>']）
//   R.Screens.detail(itemOrSkill)                  Y／長押しの詳しい表示（id の文字か {kind, id}）
//
// 各画面のファイルは S.def(id, view) で登録するだけ（読み込み時に document・ほかのファイルに触れない）。
//   view = {opaque?, frost?, touch?, init(p), update(), draw(g), layout?()}。関数の中の this が画面の 1 回分（params は this.p）。
//   this.close(result) で閉じる（140 ms で消えてから Engine から外す）。this.list に今の一覧を置く（テストとタッチが読む）。
//   this.ask({title, text, choices, cancel, index}) → Promise<index|-1>  画面の中の小さな選択（別の場面を積まない）
//   this.note({title, lines}) → Promise                                   読むだけの札（A/B で閉じる）
// 場面の id は 'screen:<id>'（R.Contract.SCENE_IDS）。開くとき R.Input.touchLayout('menu')、閉じたら前の配置に戻す。
// すりガラス（§2.10）: 画面でない場面（フィールド・戦闘）の上に最初の画面を開いたときだけ R.UIK.snapshot() を 1 回。
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Screens');
  const S = (R.Screens = R.Screens || {});
  const DEFS = (S._defs = S._defs || {});
  const UIK = () => R.UIK;
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  /** 画面を登録（各画面のファイルが読み込み時に呼ぶ） */
  S.def = function (id, view) {
    if (DEFS[id]) { R.loadErrors.push('duplicate screen ' + id); return; }
    DEFS[id] = view;
  };
  // 先に読まれた画面のファイルは仮の登録（S._defs に直に書く）を使っている。どちらも同じ表に入る

  let openCount = 0;
  const isScreen = (sc) => !!(sc && typeof sc.id === 'string' && sc.id.indexOf('screen:') === 0);

  // ---------------------------------------------------------------- 開く
  S.open = function (id, params) {
    const def = (S._defs || {})[id];
    if (!def) { R.warn('Screens.open: unknown screen ' + id); return Promise.resolve(undefined); }
    const prevLayout = R.Input.layoutName;
    const below = R.Engine.top();
    const v = Object.create(def);
    v.id = id;
    v.p = params || {};
    v.t0 = R.Engine.time;
    v.closing = false;
    v.modal = null;
    v.layer = new R.UIK.Layer({ anchor: 'c' });
    const scene = {
      id: 'screen:' + id,
      opaque: def.opaque !== false,
      view: v,
      enter() {
        R.Input.touchLayout(def.touch || 'menu');
        v.layer.open();
      },
      exit() { if (v.exit) { try { v.exit(); } catch (e) { console.error(e); } } },
      update(dt) {
        if (v.closing) return;
        if (v.modal) { S._modalUpdate(v); return; }
        try { v.update(dt); } catch (e) { R.Engine.reportError ? R.Engine.reportError(e) : console.error(e); }
      },
      draw(g) {
        if (scene.opaque) S.backdrop(g, v);
        g.save();
        if (!scene.opaque && def.dim !== 0) R.UIK.dim(g, (def.dim != null ? def.dim : 0.45) * v.layer.alpha());
        v.layer.apply(g);
        v.draw(g);
        g.restore();
        if (v.modal) S._modalDraw(g, v);
      },
      onLayout() { if (v.layout) v.layout(); },
    };
    // 今の一覧（テスト・タッチが読む）
    Object.defineProperty(scene, 'list', { get() { return v.modal ? v.modal.list : v.list; } });
    v.scene = scene;
    v.close = function (result) {
      if (v.closing) return;
      v.closing = true;
      v.layer.close().then(() => R.Engine.remove(scene, result));
    };
    if (!isScreen(below) && def.frost !== false && def.opaque !== false) {
      try { R.UIK.snapshot(); } catch (e) { /* 写しは無くてよい */ }
    }
    openCount++;
    try { v.init(v.p); } catch (e) { console.error('[screen ' + id + ']', e); }
    return R.Engine.await(scene, params).then((r) => {
      openCount--;
      if (openCount <= 0) { openCount = 0; try { R.UIK.dropSnapshot(); } catch (e) { /* */ } }
      R.Input.touchLayout(prevLayout);
      return r;
    });
  };
  /** 初めての仕組みの説明の札（1 回だけ）。o.force で見た後も開く（設定 › 遊び方） */
  S.tip = function (id, o) {
    const G = R.Game;
    if (!R.DB.tips || !R.DB.tips[id]) return Promise.resolve();
    if (!(o && o.force) && G && G.flags && G.flags['tip_' + id]) return Promise.resolve();
    return S.open('tip', { id, force: !!(o && o.force) });
  };
  /** 詳しい表示: 'w_sword_iron' | {kind, id} */
  S.detail = function (x) {
    if (!x) return Promise.resolve();
    const p = typeof x === 'string' ? { id: x } : { kind: x.kind, id: x.id || x.item || x.skill, c: x.c || null };
    return S.open('detail', p);
  };

  // ---------------------------------------------------------------- 後ろ（すりガラスの写しか夜の色）
  S.backdrop = function (g, v) {
    const snap = R.UIK.lastSnapshot && R.UIK.lastSnapshot();
    if (snap && !(v && v.plainBg)) {
      g.save(); g.imageSmoothingEnabled = true; g.drawImage(snap, 0, 0, R.W, R.H); g.restore();
      g.save(); g.fillStyle = 'rgba(8,9,18,0.34)'; g.fillRect(0, 0, R.W, R.H); g.restore();
    } else {
      const gr = g.createLinearGradient(0, 0, 0, R.H);
      gr.addColorStop(0, '#12142c'); gr.addColorStop(0.55, '#171830'); gr.addColorStop(1, '#221c34');
      g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
      R.UIK.glow(g, R.W * 0.7, R.H * 0.25, R.W * 0.5, [120, 110, 200], 0.10);
      R.UIK.glow(g, R.W * 0.2, R.H * 0.85, R.W * 0.4, [255, 190, 120], 0.06);
    }
    // 周辺減光
    const vg = g.createRadialGradient(R.W / 2, R.H / 2, Math.min(R.W, R.H) * 0.35, R.W / 2, R.H / 2, Math.max(R.W, R.H) * 0.75);
    vg.addColorStop(0, 'rgba(4,5,10,0)'); vg.addColorStop(1, 'rgba(4,5,10,0.45)');
    g.fillStyle = vg; g.fillRect(0, 0, R.W, R.H);
  };

  // ---------------------------------------------------------------- 並べ方
  /** 画面の中の使える箱（セーフエリアと余白、下のボタン表示の行を除く） */
  S.box = function (o) {
    const s = R.safe || { l: 0, t: 0, r: 0, b: 0 }, m = R.UIK.margin();
    const foot = o && o.noFoot ? 0 : u(30);
    return { x: s.l + m, y: s.t + m, w: R.W - s.l - s.r - m * 2, h: R.H - s.t - s.b - m * 2 - foot, tall: R.layout === 'tall', m };
  };
  S.tall = () => R.layout === 'tall';
  S.hit = (r, x, y) => R.UIK.hit(r, x, y);
  /** 今のフレームでポインタが rect を押したか */
  S.clicked = function (rect) {
    const p = R.Input.pointer;
    return !!(rect && p && p.pressed && R.UIK.hit(rect, p.x, p.y));
  };
  S.over = function (rect) {
    const p = R.Input.pointer;
    return !!(rect && p && R.Input.lastDevice === 'mouse' && R.UIK.hit(rect, p.x, p.y));
  };
  /** ボタン表示の行（右下）。縦持ちは下の中央 */
  S.prompts = function (g, list) {
    if (!list || !list.length) return;
    if (S.tall()) {
      const s = R.safe || { b: 0 };
      R.UIK.prompts(g, list, { x: R.W / 2 + u(24), y: R.H - s.b - R.UIK.margin() - u(8), align: 'center' });
    } else R.UIK.prompts(g, list, 'br');
  };

  // ---------------------------------------------------------------- 見出し
  /** 「メ ニ ュ ー」の見出し（琥珀・字間・下に細い線）。→ 下端の y */
  S.heading = function (g, s, x, y, w, o) {
    o = o || {};
    const sz = u(o.size || 15);
    R.UIK.text(g, s, x, y, { size: sz, weight: 700, color: T().color.gold, track: o.track != null ? u(o.track) : u(6) });
    if (w) R.UIK.hline(g, x - u(6), x + w, y + sz + u(10), 0.28, '236,201,124');
    return y + sz + u(16);
  };
  /** 小さな見出し（窓の中）。→ 下端の y */
  S.label = function (g, s, x, y, o) {
    o = o || {};
    const sz = u(o.size || T().size.label);
    R.UIK.text(g, s, x, y, { size: sz, weight: 700, color: o.color || T().color.gold, track: u(o.track != null ? o.track : 1.5), align: o.align });
    return y + sz + u(8);
  };

  // ---------------------------------------------------------------- 人
  S.party = () => (R.Party && R.Game ? R.Party.members() : []);
  S.char = (id) => (R.Game && R.Game.chars ? R.Game.chars[id] : null);
  S.stats = function (c) { try { return R.Rules.stats(c); } catch (e) { return { maxHp: c.hp || 1, maxMp: c.mp || 0 }; } };
  /** 肩書き（A17 の短い肩書きだけ） */
  S.title = function (c) {
    if (!c) return '';
    if (c.id === 'hero') { const ht = R.DB.heroTypes && R.DB.heroTypes[c.type]; return ht ? ht.name : ''; }
    const cp = R.DB.companions && R.DB.companions[c.id];
    return (cp && cp.title) || '';
  };
  /** 得意な武器・属性の名前（文字の段は出さない、A14・A17） */
  S.favorites = function (c) {
    const out = { w: [], e: [] };
    if (!c) return out;
    const Rl = R.Rules;
    const order = ['S', 'A', 'B', 'C', 'D'];
    let L = null;
    try { L = Rl.aptLetters(c); } catch (e) { L = null; }
    if (L) {
      for (const k of ['w', 'e']) {
        const t = L[k] || {};
        const best = Object.keys(t).reduce((b, id) => Math.min(b, order.indexOf(t[id])), 9);
        if (best <= 1) for (const id of Object.keys(t)) if (order.indexOf(t[id]) === best) out[k].push(id);
      }
    }
    if (c.fav) { const k = (Rl.WTYPES || []).includes(c.fav) ? 'w' : 'e'; if (!out[k].includes(c.fav)) out[k].unshift(c.fav); }
    return out;
  };
  /** 属性・系統のアイコン（無い名前は近い物で） */
  S.elemIcon = (e) => (R.UIK.hasIcon(e) ? e : 'arts');
  S.wname = (w) => (R.DB.weaponTypes && R.DB.weaponTypes[w] && R.DB.weaponTypes[w].name) || (R.Rules.WTYPE_NAMES || {})[w] || w;
  S.ename = (e) => (R.DB.elements && R.DB.elements[e] && (R.Rules.ELEMENT_NAMES || {})[e]) || (R.Rules.ELEMENT_NAMES || {})[e] || e;

  /** 顔の枠（丸）。look の顔を円に切り抜く */
  S.faceCircle = function (g, look, cx, cy, r, o) {
    o = o || {};
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    // 顔は R.Portrait の fit 'circle'（髪のてっぺん〜顎を切り出して丸をほぼ埋める。上に空きを作らない）
    R.UIK.portraitFrame(g, { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, look, { ring: false, r: 0, dim: o.dim, fit: 'circle' });
    g.restore();
    g.save(); g.beginPath(); g.arc(cx, cy, r - 0.25, 0, Math.PI * 2);
    g.strokeStyle = o.ring || (o.dim ? 'rgba(240,228,200,0.12)' : 'rgba(240,228,200,0.3)'); g.lineWidth = 0.75; g.stroke(); g.restore();
  };

  /** HP・MP の 2 本（名前の下の段）。w は全体の幅。o.stack で縦に 2 段（縦持ちの札） */
  S.hpmp = function (g, c, x, y, w, o) {
    o = o || {};
    const st = S.stats(c), C = T().color;
    const sz = u(o.size || 16.5), lab = u(10);
    const one = (lx, ly, lw, key, cur, max, kind) => {
      R.UIK.text(g, key, lx, ly + sz * 0.42, { size: lab, weight: 700, color: C.text3, track: u(0.5) });
      R.UIK.frac(g, cur, max, lx + lw, ly, { size: sz });
      R.UIK.gauge(g, { x: lx, y: ly + sz + u(5), w: lw, h: u(2) }, cur, max, kind);
    };
    if (o.stack) {
      one(x, y, w, 'HP', c.hp, st.maxHp, 'hp');
      one(x, y + sz + u(18), w, 'MP', c.mp, st.maxMp, 'mp');
      return y + (sz + u(18)) * 2;
    }
    const gap = u(14), hw = (w - gap) * 0.52, mw = w - gap - hw;
    one(x, y, hw, 'HP', c.hp, st.maxHp, 'hp');
    one(x + hw + gap, y, mw, 'MP', c.mp, st.maxMp, 'mp');
    return y + sz + u(10);
  };

  /** 人の札（顔・前/後・名前・肩書き・HP/MP）。ハブ・道具・技の画面が使う */
  S.charCard = function (g, c, r, o) {
    o = o || {};
    const C = T().color;
    R.UIK.card(g, r, { focused: o.focused, a: o.a, frost: true });
    if (o.glow) { g.save(); R.UIK.rr(g, r.x, r.y, r.w, r.h, u(8)); g.fillStyle = 'rgba(236,201,124,0.10)'; g.fill(); g.restore(); }
    const pad = u(10);
    const fs = o.face != null ? o.face : Math.min(r.h - pad * 2, u(o.compact ? 56 : 76));
    const dead = !(c.hp > 0);
    R.UIK.portraitFrame(g, { x: r.x + pad, y: r.y + (o.stackFace ? pad : (r.h - fs) / 2), w: fs, h: fs }, c.look, { dim: dead || o.dim });
    const x = r.x + pad * 2 + fs, w = r.x + r.w - pad * 1.4 - x;
    let y = r.y + (o.compact ? u(8) : u(12));
    const tw = R.UIK.tag(g, c.row, x, y + u(2), u(11));
    const nm = u(o.compact ? 16 : 18);
    const nw = R.UIK.text(g, c.name, x + tw + u(8), y - u(1), { size: nm, weight: 700, color: dead ? C.disabled : o.focused ? C.goldHi : C.text, maxW: w * 0.5 });
    if (!o.noTitle) R.UIK.text(g, S.title(c), x + tw + u(16) + nw, y + nm * 0.28, { size: u(12.5), color: C.text2, maxW: Math.max(0, w - tw - nw - u(20)) });
    if (dead) R.UIK.chip(g, x + w - u(60), y, '戦闘不能', { kind: 'plain', size: 10, color: C.down });
    if (o.note) R.UIK.text(g, o.note, x + w, y + (dead ? u(20) : u(1)), { size: u(12), color: C.text3, align: 'right' });   // 選べないわけ（魔石の「もう覚えている」など）
    if (o.extra) o.extra(g, x, y, w);
    y += nm + (o.compact ? u(10) : u(18));
    if (o.hpmp !== false) S.hpmp(g, c, x, y, w, { size: o.compact ? 15 : 16.5, stack: o.stack });
  };

  // ---------------------------------------------------------------- 品
  S.item = (id) => (R.DB.items && R.DB.items[id]) || null;
  S.gradeColor = function (it) {
    const C = T().color;
    if (!it) return C.text;
    return it.grade === 'super' ? C.superRare : it.grade === 'rare' ? C.rare : null;
  };
  S.iconOf = function (it) {
    if (!it) return 'bag';
    if (it.icon && R.UIK.hasIcon(it.icon)) return it.icon;
    return { weapon: it.wtype || 'sword', shield: 'shield', head: 'helm', body: 'armor', hands: 'glove', feet: 'boots', acc: 'ring', use: 'potion', key: 'key' }[it.slot] || 'bag';
  };
  /** 品の行: アイコン・名前（レアの色と星）。→ 名前の右端の x */
  S.itemLabel = function (g, id, x, y, o) {
    o = o || {};
    const it = S.item(id), C = T().color;
    const sz = o.size || u(T().size.body);
    const col = o.disabled ? C.disabled : S.gradeColor(it) || (o.focused ? C.goldHi : C.text);
    R.UIK.icon(g, S.iconOf(it), x, y + (sz - sz * 1.1) / 2, sz * 1.1, o.disabled ? C.disabled : o.focused ? C.gold : C.text2);
    const nx = x + sz * 1.1 + u(9);
    const w = R.UIK.text(g, it ? it.name : id, nx, y, { size: sz, weight: o.focused ? 700 : 500, color: col, maxW: o.maxW ? o.maxW - (nx - x) - u(24) : undefined });
    let ex = nx + Math.min(w, o.maxW || 1e9);
    if (it && (it.grade === 'rare' || it.grade === 'super')) ex += u(4) + R.UIK.stars(g, it.grade, ex + u(4), y + sz * 0.05, sz * 0.8);
    return ex;
  };
  /** 出どころの言葉 */
  S.srcName = function (it) {
    return ({ shop: '店の品', drop: '魔物の落とし物', mdrop: '魔物の落とし物', super: '魔物の落とし物', relic: '古い遺物', reward: 'お礼の品', steal: '盗んだ品', unique: '一品物', chest: '宝箱' })[it && it.src] || '';
  };
  /** 種類の言葉（「剣 ・ 片手」「体 ・ 重い鎧」…） */
  S.kindLine = function (it) {
    if (!it) return '';
    const parts = [];
    if (it.slot === 'weapon') {
      parts.push(S.wname(it.wtype));
      const two = it.twoHanded != null ? it.twoHanded : !!(R.DB.weaponTypes[it.wtype] || {}).twoHanded;
      parts.push(two ? '両手' : '片手');
    } else {
      parts.push((R.Rules.GROUP_NAMES || {})[it.slot] || it.slot);
      if (it.weight) parts.push({ heavy: '重い防具', light: '軽い防具', cloth: '布の防具' }[it.weight] || '');
    }
    const s = S.srcName(it);
    if (s && s !== '店の品') parts.push(s);
    return parts.filter(Boolean).join('　・　');
  };
  /** 品の主な値（攻撃 58 など。品の値だけ）→ [{key, name, v}] */
  S.mainStats = function (it) {
    if (!it) return [];
    const N = R.Rules.DIFF_NAMES || {};
    const keys = it.slot === 'weapon' ? ['atk', 'mag'] : ['def', 'mdef'];
    return keys.filter((k) => it[k]).map((k) => ({ key: k, name: N[k] || k, v: it[k] }));
  };
  /** 比べる行に出す値の名前（差のある物＋枠の主な物、最大 n） */
  S.diffKeys = function (diff, it, n) {
    const main = it && it.slot === 'weapon' ? ['atk', 'mag', 'hit'] : ['def', 'mdef'];
    const keys = [];
    for (const k of main) if (!keys.includes(k)) keys.push(k);
    for (const k of R.Rules.DIFF_KEYS || []) if (diff && diff[k] && !keys.includes(k)) keys.push(k);
    const nz = keys.filter((k) => diff && diff[k]);
    const rest = keys.filter((k) => !(diff && diff[k]));
    return nz.concat(rest).slice(0, n || 4);
  };
  /** ▲+n / ▼−n の描き（色と形）。x は右端。→ 幅 */
  S.delta = function (g, d, x, y, o) {
    o = o || {};
    const C = T().color, sz = o.size || u(15);
    if (!d) { if (o.zero) return R.UIK.text(g, o.zero, x, y, { size: sz, color: C.same, align: 'right' }); return 0; }
    const up = d > 0, col = up ? C.up : C.down;
    const s = (up ? '+' : '−') + Math.abs(d);
    const w = R.UIK.text(g, s, x, y, { size: sz, weight: 700, color: col, align: 'right' });
    const ax = x - w - u(6) - sz * 0.35, ay = y + sz * 0.5;
    g.save(); g.fillStyle = col; g.beginPath();
    const a = sz * 0.3;
    if (up) { g.moveTo(ax, ay - a); g.lineTo(ax + a, ay + a * 0.7); g.lineTo(ax - a, ay + a * 0.7); } else { g.moveTo(ax, ay + a); g.lineTo(ax + a, ay - a * 0.7); g.lineTo(ax - a, ay - a * 0.7); }
    g.closePath(); g.fill(); g.restore();
    return w + u(6) + a * 2;
  };

  /** 袋の中身（数 > 0） */
  S.bag = function () { const G = R.Game; return G && G.items ? Object.keys(G.items).filter((id) => G.items[id] > 0) : []; };
  S.count = (id) => ((R.Game && R.Game.items && R.Game.items[id]) || 0);
  S.gold = () => ((R.Game && R.Game.gold) || 0);

  // ---------------------------------------------------------------- タブ
  /** タブ（札の列）。→ [rect]。o = {size, pad} */
  S.tabs = function (g, labels, index, x, y, o) {
    o = o || {};
    const C = T().color, sz = u(o.size || 15), h = sz + u(18);
    const rects = [];
    let cx = x;
    labels.forEach((lab, i) => {
      const w = Math.max(u(o.min || 84), R.UIK.measure(lab, { size: sz, weight: 700 }) + u(36));
      const r = { x: cx, y, w, h };
      if (i === index) {
        g.save(); R.UIK.rr(g, r.x, r.y, r.w, r.h, h / 2);
        const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, 'rgba(236,201,124,0.30)'); gr.addColorStop(1, 'rgba(236,201,124,0.14)');
        g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(236,201,124,0.6)'; g.lineWidth = 0.75; g.stroke(); g.restore();
      }
      R.UIK.text(g, lab, r.x + r.w / 2, r.y + (h - sz) / 2 - u(0.5), { size: sz, weight: 700, color: i === index ? C.goldHi : C.text3, align: 'center' });
      rects.push(r);
      cx += w + u(6);
    });
    return rects;
  };
  /** タブの入力（L/R と押した札）。→ 新しい index か -1 */
  S.tabInput = function (rects, index, n) {
    const I = R.Input;
    if (I.pressed('l')) { R.UIK.sfx('cursor'); return (index + n - 1) % n; }
    if (I.pressed('r')) { R.UIK.sfx('cursor'); return (index + 1) % n; }
    for (let i = 0; i < (rects || []).length; i++) if (i !== index && S.clicked(rects[i])) { R.UIK.sfx('cursor'); return i; }
    return -1;
  };
  /** L/R の札（人の切り替え）。x は右端。→ 左端 */
  S.lrChips = function (g, x, y) {
    const s = u(12);
    const w1 = R.UIK.glyph(g, 'r', x - s, y, { size: s });
    R.UIK.glyph(g, 'l', x - s - w1 - u(14), y, { size: s });
    return x - w1 * 2 - u(18);
  };
  /** L/R で人を替える。→ 新しい index か -1 */
  S.charInput = function (index, n, rects) {
    const I = R.Input;
    if (n <= 1) return -1;
    if (I.pressed('r')) { R.UIK.sfx('cursor'); return (index + 1) % n; }
    if (I.pressed('l')) { R.UIK.sfx('cursor'); return (index + n - 1) % n; }
    if (rects) {
      if (S.clicked(rects.l)) { R.UIK.sfx('cursor'); return (index + n - 1) % n; }
      if (S.clicked(rects.r)) { R.UIK.sfx('cursor'); return (index + 1) % n; }
    }
    return -1;
  };

  // ---------------------------------------------------------------- 画面の中の小さな選択と札
  function modalBase(v, m) {
    v.modal = m;
    m.layer = new R.UIK.Layer({ anchor: 'c' });
    m.layer.open();
    return new Promise((res) => { m.resolve = res; });
  }
  function modalEnd(v, value) {
    const m = v.modal;
    if (!m || m.ending) return;
    m.ending = true;
    m.layer.close().then(() => { if (v.modal === m) v.modal = null; m.resolve(value); });
  }
  /** 選択の札。o = {title, text, choices:[label | {label, disabled, right}], cancel: index（B の値、既定 -1）, index} → Promise<index|-1> */
  S.ask = function (v, o) {
    const rows = (o.choices || ['はい', 'いいえ']).map((c, i) => (typeof c === 'string' ? { label: c, value: i } : Object.assign({ value: i }, c)));
    const list = new R.UIK.List({ rows, rowH: 36, index: o.index || 0 });
    const m = { kind: 'ask', o, list };
    list.onSelect = (row) => modalEnd(v, row.value);
    list.onCancel = () => modalEnd(v, o.cancel != null ? o.cancel : -1);
    return modalBase(v, m);
  };
  /** 読むだけの札。o = {title, lines:[string | {text, color, icon}], face?} → Promise */
  S.note = function (v, o) {
    const m = { kind: 'note', o, list: null };
    return modalBase(v, m);
  };
  S._modalUpdate = function (v) {
    const m = v.modal;
    if (m.ending) return;
    if (m.kind === 'ask') { m.list.update(); return; }
    const I = R.Input;
    if (I.pressed('a') || I.pressed('b') || (I.pointer.pressed && I.lastDevice !== 'mouse') || (I.pointer.pressed && m.rect && S.hit(m.rect, I.pointer.x, I.pointer.y))) {
      R.UIK.sfx('confirm'); modalEnd(v, undefined);
    }
  };
  S._modalDraw = function (g, v) {
    const m = v.modal, o = m.o, C = T().color;
    g.save();
    R.UIK.dim(g, 0.5 * m.layer.alpha());
    m.layer.apply(g);
    const tall = S.tall();
    const w = Math.min(R.W - u(40), u(o.w || (m.kind === 'ask' ? 420 : 460)));
    const lines = [];
    const tw = w - u(48);
    if (o.text) for (const l of R.UIK.wrap(o.text, tw, { size: u(15) })) lines.push({ text: l });
    if (o.lines) for (const l of o.lines) { if (typeof l === 'string') for (const s of R.UIK.wrap(l, tw, { size: u(15) })) lines.push({ text: s }); else lines.push(l); }
    const lh = u(26);
    const listH = m.kind === 'ask' ? m.list.rows.length * m.list.rowPx() : 0;
    const h = u(24) + (o.title ? u(34) : 0) + lines.length * lh + (lines.length ? u(10) : 0) + listH + u(m.kind === 'ask' ? 18 : 40);
    const x = (R.W - w) / 2, y = Math.max(u(20), (R.H - h) / 2 - (tall ? R.H * 0.05 : 0));
    m.rect = { x, y, w, h };
    R.UIK.panel(g, m.rect, { dense: true, frost: true });
    let cy = y + u(20);
    if (o.title) { R.UIK.text(g, o.title, x + u(24), cy, { size: u(18), weight: 700, color: C.gold }); cy += u(34); }
    for (const l of lines) {
      let lx = x + u(24);
      if (l.icon) { R.UIK.icon(g, l.icon, lx, cy + u(1), u(16), l.color || C.gold); lx += u(24); }
      R.UIK.text(g, l.text, lx, cy, { size: u(15), color: l.color || C.text, maxW: x + w - u(24) - lx });
      if (l.right) R.UIK.text(g, l.right, x + w - u(24), cy, { size: u(15), color: C.text2, align: 'right' });
      cy += lh;
    }
    if (lines.length) cy += u(10);
    if (m.kind === 'ask') m.list.draw(g, { x: x + u(12), y: cy, w: w - u(24), h: listH });
    else R.UIK.prompts(g, [{ btn: 'a', label: '閉じる' }], { x: x + w - u(20), y: y + h - u(22), align: 'right' });
    g.restore();
  };

  // ---------------------------------------------------------------- 使う（フィールド）
  // 道具と術のフィールドでの効き目（HP・MP・状態・蘇生・魔除けの香）。数字は R.Rules の式（healF・profPowerMul・mods）から。
  // learnSpell = 魔石（使った仲間がその属性の最初の術を覚える。R.Glimmer.useStone）
  const FIELD_EFFECTS = ['heal', 'healMp', 'cure', 'revive', 'encounter', 'learnSpell'];
  /** フィールドで使えるか（効き目が全部ここで扱える物） */
  S.fieldUsable = function (a) {
    if (!a) return false;
    const use = a.use || a;
    if (a.use && !a.use.field) return false;
    if (!a.use && a.field !== true) return false;
    const eff = use.effects || [];
    if (!eff.length) return false;
    if (eff.some((e) => !FIELD_EFFECTS.includes(e.type) && e.type !== 'buff' && e.type !== 'status' && e.type !== 'dispel')) return false;
    if (!eff.some((e) => FIELD_EFFECTS.includes(e.type))) return false;
    if (eff.some((e) => e.type === 'encounter' && (e.pct || 0) > 0)) return false;   // 呼び寄せはフィールドの命令が無い
    return true;
  };
  /** 相手の種類: 'one' | 'all' | 'none'（自分・一行に効く物） */
  S.targetKind = function (a) {
    const t = (a && a.use ? a.use.target : a && a.target) || 'ally';
    if (t === 'allies' || t === 'party') return 'all';
    if (t === 'self') return 'none';
    return 'one';
  };
  /** 効き目を当てる。caster は術を唱える人（道具は null）。targets は CharState の配列。→ {changed, lines:[文]} */
  S.applyField = function (a, caster, targets) {
    const use = a.use || a;
    const lines = [];
    let changed = false;
    const Rl = R.Rules;
    for (const c of targets) {
      const st = S.stats(c);
      const hp0 = c.hp, mp0 = c.mp, dead = !(c.hp > 0);
      const m = Rl.mods ? Rl.mods(caster || c) : {};
      const mul = caster ? Rl.healF(caster) * (1 + ((m.healPct || 0) / 100)) * (Rl.profPowerMul ? Rl.profPowerMul(caster, a) : 1) : 1 + ((Rl.mods(c).itemPct || 0) / 100);
      for (const e of use.effects || []) {
        // 決まった量 amount（「HPを40回復」）があればそれ、無ければ 最大値 × pct
        if (e.type === 'revive' && dead) { c.hp = e.amount != null ? Math.max(1, Math.min(st.maxHp, Math.floor(e.amount))) : Math.max(1, Math.floor(st.maxHp * (e.pct || 0.3))); c.status = []; }
        else if (e.type === 'heal' && c.hp > 0) c.hp = Math.min(st.maxHp, c.hp + Math.max(1, Math.floor((e.amount != null ? e.amount : st.maxHp * (e.pct || 0)) * mul)));
        else if (e.type === 'healMp' && c.hp > 0) c.mp = Math.min(st.maxMp, c.mp + Math.max(1, Math.floor(e.amount != null ? e.amount : st.maxMp * (e.pct || 0))));
        else if (e.type === 'cure' && c.hp > 0 && (c.status || []).length) { c.status = []; changed = true; lines.push(c.name + 'の状態が治った。'); }
        else if (e.type === 'learnSpell' && R.Glimmer && R.Glimmer.useStone) { const r = R.Glimmer.useStone(c, a); if (r.ok) { changed = true; lines.push(r.line); } }
      }
      if (c.hp !== hp0) { changed = true; lines.push(dead ? `${c.name}が起き上がった。` : `${c.name}のHPが ${c.hp - hp0} 回復した。`); }
      if (c.mp !== mp0) { changed = true; lines.push(`${c.name}のMPが ${c.mp - mp0} 回復した。`); }
    }
    for (const e of use.effects || []) {
      if (e.type === 'encounter' && (e.pct || 0) < 0 && R.Field && R.Field.encounter && R.Field.encounter.ward) {
        R.Field.encounter.ward(e.steps || 100); changed = true; lines.push('弱い魔物が寄ってこなくなった。');
      }
    }
    return { changed, lines };
  };
  /** 相手になれないわけ（札に出す短い言葉。なれるなら ''）。今は魔石だけ: 「もう覚えている」「術を使えない」 */
  S.targetReason = function (a, c) {
    const use = (a && (a.use || a)) || {};
    if (!c || !(use.effects || []).some((e) => e.type === 'learnSpell') || !R.Glimmer || !R.Glimmer.stoneBlock) return '';
    return R.Glimmer.stoneBlock(c, a) || '';
  };
  /** 相手になれるか（蘇生は倒れた人だけ、魔石は術を覚えられる人（倒れていてもよい）、ほかは生きている人） */
  S.canTarget = function (a, c) {
    const use = a.use || a;
    const t = use.target || '';
    if (S.targetReason(a, c)) return false;
    if ((use.effects || []).some((e) => e.type === 'learnSpell')) return true;
    const rev = (use.effects || []).some((e) => e.type === 'revive');
    if (t === 'ally_dead' || (rev && t !== 'allies' && t !== 'party')) return !(c.hp > 0);
    return c.hp > 0;
  };
})(window.RPG);
