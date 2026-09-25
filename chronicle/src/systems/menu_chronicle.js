// Field menu: 年代記 (DESIGN §10.4, §11.7.10) — the hero's book. Left: 序章, 第1章〜第N章 in clear
// order, the regions still to visit (grey), the 8 pages, 終章 and 外伝. Right: the chosen entry
// (chapter title in gold, region name in cyan, summary; a region's hint and objective; a page's
// line of the poem). The header counts the chapters and the secret passages found (Part A4).
//   R.Menu.chronicleScreen() → Promise      R.Menu.chronicleEntries() → [{kind, label, …}]
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  // the poem of the 8 pages (§10.2.3, 「年代記の画面にそのまま出す」); DB.config.chronicle.pages overrides it
  const POEM = {
    k_page_forest: 'はじめに言葉はなく、\nただ白い闇があった。',
    k_page_desert: '名もなきものは、\n名を持つすべてを\nうらやんだ。',
    k_page_snow: 'わたしは火をともし、\n最初の物語を語った。',
    k_page_marsh: '白い闇は物語を恐れ、\n深い眠りについた。',
    k_page_isles: 'わたしは八つの土地に、\n八つの物語を預けた。',
    k_page_mine: '語り継がれる限り、\n白い闇は目覚めない。',
    k_page_ash: 'けれど忘れられたとき、\n闇はふたたび目を開く。',
    k_page_star: 'そのときは、\n白い闇の名を記しなさい。\nその名は――',
  };
  const REVEAL = '破れ目をつなぐと、文字が読めた。\n――ネムレア。';
  const PAGE_ORDER = ['k_page_forest', 'k_page_desert', 'k_page_snow', 'k_page_marsh', 'k_page_isles', 'k_page_mine', 'k_page_ash', 'k_page_star'];

  const flag = (n) => !!(R.Game && R.Game.flags && R.Game.flags[n]);
  const cfg = () => (DB.config && DB.config.chronicle) || {};
  const regionIds = () => Object.keys(DB.regions || {});
  /** the page ids in region order (§10.2.3: 地方の並び順 N) */
  function pageIds() {
    const fromRegions = regionIds().map((r) => DB.regions[r].fragment).filter(Boolean);
    return fromRegions.length ? fromRegions : PAGE_ORDER.slice();
  }
  const pageName = (id) => (DB.items[id] && DB.items[id].name) || '？？？';
  const poemOf = (id) => {
    const p = cfg().pages;
    return (p && p[id]) || (DB.items[id] && DB.items[id].poem) || POEM[id] || '';
  };
  /** the region whose page this is (for the page list order) */
  const regionOfPage = (id) => regionIds().find((r) => DB.regions[r].fragment === id) || null;

  /** every entry of the left list, in order */
  function chronicleEntries() {
    const g = R.Game;
    const out = [];
    const pro = cfg().prologue || { title: '灯台守の歌', flag: 'prologue_done' };
    out.push({ kind: 'prologue', label: '序章', done: flag(pro.flag || 'prologue_done'), title: pro.title, summary: pro.summary });
    const cleared = (g.regionsCleared || []).filter((r) => DB.regions[r]);
    cleared.forEach((r, i) => out.push({ kind: 'chapter', label: '第' + (i + 1) + '章', region: r, n: i + 1 }));
    for (const r of regionIds()) if (!cleared.includes(r)) out.push({ kind: 'region', label: DB.regions[r].name, region: r });
    const pages = pageIds();
    const allPages = pages.every((p) => R.State.hasItem ? R.State.hasItem(p) : R.State.count(p) > 0);
    pages.forEach((p, i) => {
      const got = R.State.hasItem ? R.State.hasItem(p) : R.State.count(p) > 0;
      out.push({ kind: 'page', label: got ? pageName(p) : '？？？', id: p, got, last: i === pages.length - 1, reveal: allPages && flag('st_fine_reveal') });
    });
    const fin = cfg().finale || { title: '語り部の旅', flag: 'final_open', doneFlag: 'game_clear' };
    if (flag(fin.flag || 'final_open') || flag(fin.doneFlag || 'game_clear')) out.push({ kind: 'finale', label: '終章', title: fin.title, done: flag(fin.doneFlag || 'game_clear'), summary: fin.summary, pending: fin.pending });
    const side = cfg().side || { title: '円環の竜', flag: 'pg_clear' };
    if (flag(side.flag || 'pg_clear')) out.push({ kind: 'side', label: '外伝', title: side.title, summary: side.summary });
    return out;
  }
  Menu.chronicleEntries = chronicleEntries;
  /** 「隠し通路　n/総数」 counts */
  function secretCounts() {
    const found = Object.keys((R.Game && R.Game.secrets) || {}).length;
    let total = 0;
    try { total = R.FieldMap && R.FieldMap.secretTotal ? R.FieldMap.secretTotal() : 0; } catch (e) { total = 0; }
    return { found, total: Math.max(total, found) };
  }
  Menu.secretCounts = secretCounts;

  let lastIndex = 0;
  let C = null;
  const cls = () => C || (C = build());
  Menu.chronicleScreen = () => R.Engine.run(new (cls().ChronicleScreen)());

  function build() {
    const Kt = K();
    class ChronicleScreen extends Kt.Screen {
      constructor() {
        super();
        this.entries = chronicleEntries();
        this.list = new R.UI.List({
          x: 4, y: 30, w: 96, h: 190, rows: 12, lineH: 14, padX: 16, padY: 9,
          items: this.entries, index: Math.min(lastIndex, this.entries.length - 1),
          onChange: (i) => { lastIndex = i; R.sfx('page'); },
          drawItem: (e, x, y) => this.drawRow(e, x, y),
        });
        R.sfx('page');
      }
      input() {
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select') R.sfx('page');
      }
      drawRow(e, x, y) {
        let col = '#ffffff';
        if (e.kind === 'region') col = Kt.COL.gray;
        else if (e.kind === 'page') col = e.got ? '#e8dcb8' : Kt.COL.gray;
        else if (e.kind === 'prologue' && !e.done) col = Kt.COL.gray;
        else if (e.kind === 'chapter' || e.kind === 'finale' || e.kind === 'side' || e.kind === 'prologue') col = G().C.gold;
        Kt.fitText(e.label, x, y, 74, { color: col });
      }
      render() {
        const g = R.Game;
        const t = (g.regionsCleared || []).length;
        G().window(4, 4, 248, 24);
        G().text('年代記', 14, 10, { color: G().C.yellow });
        G().text(g.gameClear || flag('game_clear') ? '終章まで' : t ? '第' + t + '章まで' : '序章', 56, 10);
        const s = secretCounts();
        G().text('隠し通路　' + s.found + '/' + s.total, 244, 10, { align: 'right', color: Kt.COL.sub });
        this.list.draw();
        G().window(102, 30, 150, 190);
        const e = this.list.item;
        if (e) this.drawEntry(e, 102, 30);
      }
      /** the right panel: text starting at (x+8, y+8), 134px wide */
      drawEntry(e, x, y) {
        const tx = x + 8, W = 134;
        const lines = (s, y0, col, max) => String(s || '').split('\n').slice(0, max || 12).forEach((l, i) => Kt.fitText(l, tx, y0 + i * 14, W, { color: col || '#ffffff' }));
        if (e.kind === 'prologue') {
          G().text('序章', tx, y + 8, { color: Kt.COL.sub });
          Kt.fitText('『' + (e.title || '') + '』', tx, y + 22, W, { color: G().C.gold });
          G().text('ファロス半島', tx, y + 36, { color: G().C.cyan });
          if (e.done) lines(e.summary, y + 54, '#ffffff', 9);
          else lines('（まだ書かれていない）', y + 54, Kt.COL.gray);
          return;
        }
        if (e.kind === 'chapter') {
          const reg = DB.regions[e.region];
          G().text('第' + e.n + '章', tx, y + 8, { color: Kt.COL.sub });
          Kt.fitText('『' + ((reg.chapter && reg.chapter.title) || '') + '』', tx, y + 22, W, { color: G().C.gold });
          Kt.fitText(reg.name, tx, y + 36, W, { color: G().C.cyan });
          lines(reg.chapter && reg.chapter.summary, y + 54, '#ffffff', 9);
          return;
        }
        if (e.kind === 'region') {
          const reg = DB.regions[e.region];
          G().text('まだ語られていない', tx, y + 8, { color: Kt.COL.sub });
          Kt.fitText(reg.name, tx, y + 22, W, { color: G().C.cyan });
          lines(reg.hint, y + 40, '#ffffff', 4);
          const oid = R.Game.regionObj && R.Game.regionObj[e.region];
          if (oid && DB.objectives[oid]) {
            G().rect(tx, y + 104, W, 1, '#3a4470');
            G().text('目的', tx, y + 110, { color: G().C.yellow });
            lines(Menu.objectiveText ? Menu.objectiveText(oid) : DB.objectives[oid].text, y + 126, '#ffffff', 4);
          }
          return;
        }
        if (e.kind === 'page') {
          G().text('ページ', tx, y + 8, { color: Kt.COL.sub });
          if (!e.got) {
            Kt.fitText('？？？', tx, y + 22, W, { color: Kt.COL.gray });
            const r = regionOfPage(e.id);
            if (r) lines(DB.regions[r].name + 'の伝承を\n語り直すと手に入る。', y + 44, Kt.COL.gray);
            return;
          }
          Kt.fitText(pageName(e.id), tx, y + 22, W, { color: '#e8dcb8' });
          // the torn page: a pale sheet with the line of the poem
          G().rect(tx - 2, y + 40, W + 4, 76, '#e8dcb8');
          G().rect(tx - 2, y + 40, W + 4, 1, '#fff6dc');
          for (let i = 0; i < W + 4; i += 6) G().rect(tx - 2 + i, y + 115 + ((i / 6) % 2), 4, 1, '#c8b890');
          String(poemOf(e.id)).split('\n').slice(0, 4).forEach((l, i) => Kt.fitText(l, tx + 2, y + 48 + i * 16, W - 4, { color: '#3a2c1c' }));
          if (e.last && e.reveal) lines(REVEAL, y + 126, G().C.gold, 3);
          return;
        }
        if (e.kind === 'finale') {
          G().text('終章', tx, y + 8, { color: Kt.COL.sub });
          Kt.fitText('『' + (e.title || '') + '』', tx, y + 22, W, { color: G().C.gold });
          lines(e.done ? e.summary : e.pending || '（まだ書き終えていない）', y + 44, e.done ? '#ffffff' : Kt.COL.gray, 9);
          return;
        }
        if (e.kind === 'side') {
          G().text('外伝', tx, y + 8, { color: Kt.COL.sub });
          Kt.fitText('『' + (e.title || '') + '』', tx, y + 22, W, { color: G().C.gold });
          lines(e.summary, y + 44, '#ffffff', 9);
        }
      }
    }
    return { ChronicleScreen };
  }
})(window.RPG);
