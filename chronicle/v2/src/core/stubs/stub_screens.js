// 仮の実装: MENUS（R.Screens）。本物は src/screens/*（MENUS）。V2_PLAN §2.5.15・§3.11
// タイトル・主人公の作成（決め打ち）・ハブ・セーブ／ロード は動く形。ほかの画面は「（仮）」の札と B で戻るだけ。
(function (R) {
  'use strict';
  const NAMES = {
    title: 'タイトル', charcreate: '主人公の作成', nameentry: '名前の入力', partySelect: '仲間選び', menu: 'メニュー', items: '道具',
    skills: '技・術', equip: '装備', status: '強さ', order: '並びと隊列', bestiary: '図鑑', chronicle: '年代記・手がかり', map: '地図',
    save: 'セーブ', load: 'ロード', settings: '設定', shop: '店', inn: '宿', tavern: '酒場', passphrase: '冒険の合言葉',
    detail: '詳しく', tip: '説明', warp: 'ワープ',
  };
  const T = () => R.UIK.T;
  const k = () => R.uiScale || 1;

  function night(g) {
    const gr = g.createLinearGradient(0, 0, 0, R.H);
    gr.addColorStop(0, '#0d1030'); gr.addColorStop(0.6, '#1b1d44'); gr.addColorStop(1, '#2b2446');
    g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
    const rng = R.rng('title-stars');
    for (let i = 0; i < 120; i++) {
      const x = rng.float(0, R.W), y = rng.float(0, R.H * 0.7), a = 0.3 + 0.5 * Math.abs(Math.sin(R.Engine.time / 900 + i));
      g.fillStyle = `rgba(230,230,255,${a * 0.7})`; g.fillRect(x, y, 1.2, 1.2);
    }
    // 海と灯台（仮の形）
    g.fillStyle = '#141a36'; g.fillRect(0, R.H * 0.72, R.W, R.H * 0.28);
    const lx = R.W * 0.78, ly = R.H * 0.72;
    g.fillStyle = '#2a2e4e'; g.fillRect(lx - 10, ly - 120, 20, 120);
    R.Light.glow(g, lx, ly - 126, { r: 14, color: 'rgba(255,214,150,0.9)' });
  }

  /** 行の一覧の場面。rows = [{label, disabled?, value}] */
  function listScene(id, o) {
    const list = new R.UIK.List({ rows: o.rows, rowH: 38 });
    const scene = {
      id: 'screen:' + id, opaque: !!o.opaque, list,
      enter() { R.Input.touchLayout(o.touch || 'menu'); },
      exit() {},
      update() {
        list.onSelect = (row, i) => { if (!row.disabled) o.onSelect(row, i, scene); };
        list.onCancel = () => { if (o.onCancel) o.onCancel(scene); };
        list.update();
      },
      draw(g) {
        if (o.bg) o.bg(g);
        const K = k(), s = R.safe;
        const w = (o.w || 300) * K, h = list.rows.length * 38 * K + 64 * K;
        const x = o.x != null ? o.x(w) : s.l + 24 * K, y = o.y != null ? o.y(h) : s.t + 24 * K;
        R.UIK.panel(g, { x, y, w, h }, { dense: true });
        R.UIK.text(g, o.title || NAMES[id] || id, x + 20 * K, y + 16 * K, { size: T().size.h2 * K, weight: 700, color: T().color.gold });
        list.draw(g, { x: x + 8 * K, y: y + 52 * K, w: w - 16 * K, h: list.rows.length * 38 * K });
        if (o.side) o.side(g, list.index);
        if (R.Engine.top() === scene) R.UIK.prompts(g, o.prompts || [{ btn: 'a', label: '決定' }, { btn: 'b', label: '戻る' }]);
      },
    };
    return scene;
  }

  function cardText(c) {
    if (!c) return '（空き）';
    if (c.bad) return '前の版のセーブのため読めません';
    return `${c.place}  第${c.chapter}章  ${R.U.playTime(c.playMs)}  ${R.U.date(c.date)}`;
  }
  function newestCard() {
    let best = null;
    for (const e of R.Save.cards()) if (e.card && !e.card.bad && (!best || e.card.date > best.card.date)) best = e;
    return best;
  }

  const OPEN = {
    title() {
      const cont = newestCard();
      const rows = [{ label: 'はじめから', value: 'new' }, { label: 'つづきから', value: 'continue', disabled: !cont }, { label: '設定', value: 'settings' }];
      return listScene('title', {
        rows, opaque: true, w: 260,
        title: ' ', prompts: [{ btn: 'a', label: '決定' }],
        x: (w) => (R.W - w) / 2, y: (h) => R.H * (R.layout === 'tall' ? 0.52 : 0.5),
        bg(g) {
          night(g);
          const K = k(), cy = R.H * (R.layout === 'tall' ? 0.28 : 0.2);
          R.UIK.text(g, 'LUMINOUS CHRONICLE', R.W / 2, cy - 30 * K, { size: 18 * K, family: 'en', align: 'center', color: T().color.goldLo });
          R.UIK.text(g, R.TITLE, R.W / 2, cy, { size: (R.layout === 'tall' ? 38 : 44) * K, weight: 700, align: 'center', color: T().color.goldHi, shadow: true });
          R.UIK.text(g, R.SUBTITLE, R.W / 2, cy + 58 * K, { size: 20 * K, weight: 700, align: 'center', color: T().color.gold, shadow: true });
          R.UIK.text(g, `${R.COPYRIGHT}   v${R.VERSION}`, R.safe.l + 16 * K, R.H - R.safe.b - 28 * K, { size: 11.5 * K, color: T().color.text3 });
          if (cont) R.UIK.text(g, 'つづき: ' + cardText(cont.card), R.W / 2, R.H * (R.layout === 'tall' ? 0.52 : 0.5) - 26 * K, { size: 12.5 * K, align: 'center', color: T().color.text2 });
        },
        onSelect(row, i, sc) {
          if (row.value === 'settings') { R.Screens.open('settings'); return; }
          R.Engine.remove(sc, row.value === 'continue' ? { cmd: 'continue', slot: cont.slot } : { cmd: 'new' });
        },
      });
    },
    charcreate() {
      return listScene('charcreate', {
        opaque: true, bg: night, w: 360,
        rows: [{ label: '旅の剣士（男）アルン', value: { type: 'warrior', sex: 'm', name: 'アルン' } }, { label: '射手（女）ミラ', value: { type: 'ranger', sex: 'f', name: 'ミラ' } }],
        title: '主人公の作成（仮）',
        onSelect(row, i, sc) { R.Engine.remove(sc, row.value); },
      });
    },
    menu() {
      const cmds = ['items', 'skills', 'equip', 'order', 'bestiary', 'chronicle', 'map', 'save', 'settings'];
      return listScene('menu', {
        rows: cmds.map((c) => ({ label: NAMES[c], value: c })),
        onSelect(row) { R.Screens.open(row.value); },
        onCancel(sc) { R.Engine.remove(sc); },
        side(g) {
          const K = k(), mem = R.Party.members();
          const tall = R.layout === 'tall';
          const w = (tall ? 300 : 300) * K, x = tall ? R.safe.l + 24 * K : R.W - R.safe.r - w - 24 * K;
          const y0 = tall ? R.safe.t + 24 * K + (cmds.length * 38 + 64) * K + 16 * K : R.safe.t + 24 * K;
          mem.forEach((c, i) => {
            const y = y0 + i * 76 * K, mh = R.Growth.baseMax(c, 'hp'), mm = R.Growth.baseMax(c, 'mp');
            R.UIK.card(g, { x, y, w, h: 68 * K }, {});
            R.UIK.portraitFrame(g, { x: x + 6 * K, y: y + 6 * K, w: 56 * K, h: 56 * K }, c.look, {});
            R.UIK.text(g, c.name, x + 72 * K, y + 8 * K, { size: 16 * K, weight: 700 });
            R.UIK.text(g, `HP ${c.hp}/${mh}   MP ${c.mp}/${mm}`, x + 72 * K, y + 34 * K, { size: 13 * K, color: T().color.text2 });
          });
          R.UIK.text(g, `${R.Game.gold} G   ${R.U.playTime(R.Game.playMs)}`, x, y0 + mem.length * 76 * K + 6 * K, { size: 13 * K, color: T().color.gold });
        },
      });
    },
    save() {
      const slots = ['s1', 's2', 's3'];
      const rows = () => slots.map((s, i) => ({ label: `記録 ${i + 1}   ` + cardText((R.Save.cards().find((e) => e.slot === s) || {}).card), value: s }));
      return listScene('save', {
        rows: rows(), w: 620,
        onSelect(row, i, sc) {
          if (R.Save.save(row.value)) R.UIK.toast('セーブしました', { anchor: 'bl' });
          sc.list.rows = rows();
        },
        onCancel(sc) { R.Engine.remove(sc); },
      });
    },
    load() {
      const rows = R.Save.cards().map((e) => ({ label: `${e.slot}   ${cardText(e.card)}`, value: e.slot, disabled: !e.card || !!e.card.bad }));
      return listScene('load', {
        rows, w: 620,
        onSelect(row, i, sc) { R.Engine.remove(sc, R.Save.load(row.value) ? { slot: row.value } : null); },
        onCancel(sc) { R.Engine.remove(sc, null); },
      });
    },
  };

  function generic(id, params) {
    return listScene(id, {
      rows: [{ label: `（仮）${NAMES[id] || id}の画面`, value: 0 }],
      w: 360,
      onSelect(row, i, sc) { R.Engine.remove(sc); },
      onCancel(sc) { R.Engine.remove(sc); },
    });
  }

  R.Stubs.define('Screens', {
    open(id, params) {
      if (id === 'tip' || id === 'detail') return Promise.resolve();
      const make = OPEN[id] || ((p) => generic(id, p));
      const prev = R.Input.layoutName;
      return R.Engine.await(make(params || {}), params).then((r) => { R.Input.touchLayout(prev); return r; });
    },
    tip() { return Promise.resolve(); },
    detail() { return Promise.resolve(); },
  });
})(window.RPG);
