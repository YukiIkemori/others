// Field menu: 強さ (3-page status per member), 並び替え (swap order) and
// 図鑑 (monster book: list + detail with sprite, stats, drops, resistances).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  let lastMember = 0;
  let lastPage = 0;
  let lastMon = 0;

  let C = null;
  const cls = () => C || (C = build());
  Menu.statusScreen = (o) => R.Engine.run(new (cls().StatusScreen)(o || {}));
  Menu.bookScreen = () => R.Engine.run(new (cls().BookScreen)());

  /** 並び替え: pick two members and swap them (repeat until B) */
  Menu.orderScreen = async function () {
    const party = R.Game.party;
    let a = 0;
    for (;;) {
      a = await Menu.pickMember({
        title: '誰を入れ替える？', initial: a, x: 53, y: 40,
        // formation matters: single-target enemy attacks favour the front (battle_ai pickPartyTarget)
        info: (x, y) => {
          G().window(x, y, 200, 38);
          G().text('先頭ほど敵に狙われやすくなります。', x + 10, y + 6);
          G().text('（先頭50%・2番目30%・3番目20%）', x + 10, y + 20, { color: G().C.gray });
        },
      });
      if (a < 0) return;
      const b = await Menu.pickMember({
        title: '誰と入れ替える？', initial: a, x: 53, y: 40, mark: a,
        info: (x, y) => { G().window(x, y, 150, 24); G().text(party[a].name + 'と…', x + 12, y + 6, { color: G().C.yellow }); },
      });
      if (b < 0 || b === a) continue;
      [party[a], party[b]] = [party[b], party[a]];
      R.sfx('confirm_soft');
      a = b;
    }
  };

  // ------------------------------------------------------------ monster list
  /** book order: regular monsters by level, bosses last (stable) */
  function monsterOrder() {
    const ids = Object.keys(DB.monsters);
    const boss = (id) => ((DB.monsters[id].flags || []).includes('boss') ? 1 : 0);
    return ids.map((id, i) => ({ id, i })).sort((p, q) => boss(p.id) - boss(q.id) || (DB.monsters[p.id].lv || 0) - (DB.monsters[q.id].lv || 0) || p.i - q.i).map((p) => p.id);
  }
  Menu.monsterOrder = monsterOrder;
  const rec = (id) => (R.Game.bestiary && R.Game.bestiary[id]) || null;
  const seen = (id) => { const b = rec(id); return !!(b && (b.seen || b.kills)); };
  const beaten = (id) => { const b = rec(id); return !!(b && b.kills); };
  const isRareMon = (id) => !!(DB.monsters[id] && (DB.monsters[id].flags || []).includes('rare'));
  /** stats / weaknesses are shown once beaten or scanned (スキャン) */
  const known = (r) => !!(r && (r.kills || r.scan));
  /** rare item obtained from this monster (dropped, or stolen when it is the same item) */
  const gotRare = (m, r) => !!(r && (r.rare || (r.stealRare && m.steal && m.rare && m.steal.rare === m.rare.item)));
  function monSprite(m) {
    const key = 'mon:' + m.sprite;
    if (!G().has(key)) return null;
    const v = m.hue || m.sat != null || m.bri != null || m.pal ? G().variant(key, { hue: m.hue, sat: m.sat, bri: m.bri, pal: m.pal }) : G().get(key);
    return Array.isArray(v) ? v[0] : v;
  }
  /** draw a monster sprite centred on (cx, bottom), scaled down to fit maxW x maxH */
  function drawMon(m, cx, bottom, maxW, maxH, dark) {
    const img = monSprite(m);
    if (!img) { G().text('？', cx, bottom - 20, { align: 'center', color: G().C.gray }); return; }
    let s = 1;
    while ((img.width * s > maxW || img.height * s > maxH) && s > 0.25) s /= 2;
    const w = img.width * s, h = img.height * s;
    if (dark) G().drawTinted(img, cx - w / 2, bottom - h, '#000000', 0.85);
    else G().draw(img, cx - w / 2, bottom - h, s !== 1 ? { w, h } : null);
  }
  const pad3 = (n) => U.padL(n, 3, '0');

  function build() {
    const K = Menu.kit;

    // ============================================================ 強さ
    const PAGES = ['能力', '装備・アビリティ', '耐性・特性'];
    class StatusScreen extends K.Screen {
      constructor(o) {
        super();
        this.m = o.member != null ? o.member : lastMember < R.Game.party.length ? lastMember : 0;
        this.page = lastPage;
      }
      get c() { return R.Game.party[this.m]; }
      input() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          const n = R.Game.party.length;
          this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
          lastMember = this.m;
          R.sfx('cursor');
        } else if (d === 'up' || d === 'down') {
          this.page = (this.page + (d === 'up' ? PAGES.length - 1 : 1)) % PAGES.length;
          lastPage = this.page;
          R.sfx('cursor');
        }
        if (In().pressed('a')) { this.page = (this.page + 1) % PAGES.length; lastPage = this.page; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); }
      }
      render() {
        const c = this.c;
        const st = R.Rules.stats(c);
        // header
        G().window(4, 4, 248, 40);
        K.drawSprite(c, 26, 38, { frame: Math.floor(R.Engine.frame / 20) });
        G().text(c.name, 42, 10, { color: K.condColor(c) });
        const stt = K.statusText(c);
        if (stt) G().text(stt.text, 42 + G().textWidth(c.name) + 8, 10, { color: stt.color });
        G().text('Lv ' + c.level, 150, 10);
        G().text(K.jobName(c.job) + ' Lv' + R.Rules.jobLevel(c, c.job), 42, 24, { color: G().C.cyan });
        G().text('JP ' + ((c.jobs[c.job] && c.jobs[c.job].jp) || 0), 240, 24, { align: 'right', color: G().C.yellow });
        G().text((this.page + 1) + '/' + PAGES.length, 240, 10, { align: 'right', color: G().C.gray });
        K.lrArrows(8, 248, 18);
        if (this.page === 0) this.page1(c, st);
        else if (this.page === 1) this.page2(c, st);
        else this.page3(c, st);
      }
      page1(c, st) {
        G().window(4, 46, 122, 128, { title: '基本' });
        const L = [['HP', c.hp + '/' + st.hp], ['MP', c.mp + '/' + st.mp], ['力', st.str], ['体力', st.vit], ['素早さ', st.agi], ['知力', st.int], ['精神', st.mnd], ['運', st.luk]];
        L.forEach(([k, v], i) => { G().text(k, 13, 55 + i * 14, { color: G().C.gray }); G().text(String(v), 117, 55 + i * 14, { align: 'right', color: i === 0 ? K.condColor(c) === G().C.purple ? G().C.white : K.condColor(c) : G().C.white }); });
        G().window(130, 46, 122, 128, { title: '戦闘' });
        const Rr = [['攻撃力', st.atk2 ? st.atk + '/' + st.atk2 : st.atk], ['守備力', st.def], ['魔力', st.mag], ['魔法防御', st.mdef], ['命中', st.hit], ['回避', st.eva], ['会心', st.crit + '%'], ['属性', st.element ? K.elemName(st.element) : 'なし']];
        Rr.forEach(([k, v], i) => { G().text(k, 139, 55 + i * 14, { color: G().C.gray }); G().text(String(v), 243, 55 + i * 14, { align: 'right' }); });
        G().window(4, 176, 248, 44);
        G().text('経験値', 14, 183, { color: G().C.gray });
        G().text(String(c.exp), 240, 183, { align: 'right' });
        G().text('次のレベルまで', 14, 197, { color: G().C.gray });
        const nx = R.Rules.expToNext(c);
        G().text(c.level >= R.Rules.MAX_LEVEL ? '―' : String(nx), 240, 197, { align: 'right', color: G().C.yellow });
      }
      page2(c) {
        G().window(4, 46, 248, 86, { title: '装備' });
        const SL = [['weapon', '武器'], ['shield', R.Rules.mods(c, { ignoreEquip: true }).twoSwords ? '左手' : '盾'], ['head', '頭'], ['body', '体'], ['acc', 'アクセサリ']];
        SL.forEach(([s, lbl], i) => {
          const y = 55 + i * 14;
          G().text(lbl, 14, y, { color: G().C.gray });
          const id = c.equip[s];
          if (id) { K.drawIcon(DB.items[id], 76, y + 2); G().text(K.itemLabel(id), 88, y, { color: DB.items[id].rare ? G().C.yellow : G().C.white }); }
          else G().text('―――', 88, y, { color: G().C.dark });
        });
        G().window(4, 134, 248, 86, { title: 'アビリティ' });
        const cmd = (j) => (DB.jobs[j] && DB.jobs[j].command) || '';
        const AL = [
          ['コマンド', cmd(c.job), K.KIND_COLORS.action],
          ['サブ', c.set.sub ? cmd(c.set.sub) + '（' + K.jobName(c.set.sub) + '）' : '', K.KIND_COLORS.action],
          ['リアクション', c.set.reaction ? K.abName(c.set.reaction) : '', K.KIND_COLORS.reaction],
          ['サポート', c.set.support ? K.abName(c.set.support) : '', K.KIND_COLORS.support],
          ['フィールド', c.set.field ? K.abName(c.set.field) : '', K.KIND_COLORS.field],
        ];
        AL.forEach(([lbl, v, col], i) => {
          const y = 143 + i * 14;
          G().text(lbl, 14, y, { color: col });
          G().text(v || '―――', 88, y, { color: v ? G().C.white : G().C.dark });
        });
      }
      page3(c, st) {
        const m = st.mods || {};
        const res = m.elemResist || {}, boost = m.elemBoost || {};
        G().window(4, 46, 248, 72, { title: '属性' });
        K.ELEMS.forEach((e, i) => {
          const x = 14 + (i % 2) * 120, y = 55 + Math.floor(i / 2) * 14;
          G().text(K.elemName(e), x, y, { color: G().C.gray });
          const r = res[e];
          let t = '―', col = G().C.dark;
          if (r != null && r < 0) { t = '吸収'; col = G().C.cyan; }
          else if (r === 0) { t = '無効'; col = G().C.green; }
          else if (r != null && r < 1) { t = '半減'; col = G().C.green; }
          else if (r != null && r > 1) { t = '弱点'; col = G().C.red; }
          if (boost[e]) { t = (t === '―' ? '' : t + ' ') + '威力+' + boost[e]; col = t.startsWith('威力') ? G().C.orange : col; }
          // never over the element label (耐性 + 威力 together are long)
          K.fitText(t, x + 110, y, 110 - G().textWidth(K.elemName(e)) - 6, { align: 'right', color: col });
        });
        G().window(4, 120, 248, 72, { title: '状態異常' });
        const imm = m.statusImmune || [];
        ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death'].forEach((s, i) => {
          const x = 14 + (i % 2) * 120, y = 129 + Math.floor(i / 2) * 14;
          G().text(K.statusName(s), x, y, { color: G().C.gray });
          const on = imm.includes(s);
          G().text(on ? '無効' : '―', x + 110, y, { align: 'right', color: on ? G().C.green : G().C.dark });
        });
        G().window(4, 194, 248, 26);
        const tr = traits(m);
        K.fitText(tr.length ? tr.join('・') : '特性なし', 14, 201, 228, { color: tr.length ? G().C.white : G().C.dark });
      }
    }

    /** short labels for notable modifiers */
    function traits(m) {
      const t = [];
      if (m.twoSwords) t.push('二刀流');
      if (m.regen) t.push('再生');
      if (m.walkHeal) t.push('歩行回復');
      if (m.encounterPct < 0) t.push('魔物よけ');
      if (m.encounterPct > 0) t.push('魔物寄せ');
      if (m.noFloorDamage) t.push('床ダメージ無効');
      if (m.treasureSense) t.push('宝探し');
      if (m.expPct) t.push('経験値+' + m.expPct + '%');
      if (m.jpPct) t.push('JP+' + m.jpPct + '%');
      if (m.goldPct) t.push('G+' + m.goldPct + '%');
      if (m.dropPct || m.rarePct) t.push('ドロップ+' + ((m.dropPct || 0) + (m.rarePct || 0)) + '%');
      if (m.stealPct) t.push('盗み+' + m.stealPct + '%');
      if (m.mpCostPct) t.push('消費MP' + m.mpCostPct + '%');
      if (m.healPct) t.push('回復+' + m.healPct + '%');
      if (m.magicPct) t.push('魔法+' + m.magicPct + '%');
      if (m.physPct) t.push('物理+' + m.physPct + '%');
      if (m.escapePct) t.push('逃走+' + m.escapePct + '%');
      if (m.preemptPct) t.push('先制+' + m.preemptPct + '%');
      return t;
    }

    // ============================================================ 図鑑
    class BookScreen extends K.Screen {
      constructor() {
        super();
        this.ids = monsterOrder();
        this.detail = false;
        this.page = 0;
        this.list = new R.UI.List({
          x: 4, y: 46, w: 150, rows: 9, index: U.clamp(lastMon, 0, Math.max(0, this.ids.length - 1)),
          items: this.ids.map((id) => ({ id })),
          onChange: (i) => { lastMon = i; },
          drawItem: (row, x, y, w, i) => this.drawRow(row, x, y, w, i),
        });
        const all = this.ids.length;
        this.nSeen = this.ids.filter(seen).length;
        this.nBeat = this.ids.filter(beaten).length;
        this.all = all;
      }
      get id() { return this.ids[this.list.index]; }
      input() {
        if (this.detail) return this.inputDetail();
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select') {
          if (!seen(this.id)) { R.sfx('buzzer'); return; }
          this.detail = true; this.page = 0;
        }
      }
      inputDetail() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          // previous / next monster that has been seen
          const n = this.ids.length;
          let i = this.list.index;
          for (let k = 0; k < n; k++) {
            i = (i + (d === 'left' ? n - 1 : 1)) % n;
            if (seen(this.ids[i])) break;
          }
          this.list.index = i; this.list.scrollTo(); lastMon = i;
          R.sfx('cursor');
        } else if (d === 'up' || d === 'down' || In().pressed('a')) {
          this.page = 1 - this.page;
          R.sfx('cursor');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.detail = false; }
      }
      drawRow(row, x, y, w, i) {
        const s = seen(row.id), b = beaten(row.id);
        G().text(pad3(i + 1), x, y, { color: G().C.gray });
        const m = DB.monsters[row.id];
        const r = rec(row.id);
        const rareMon = s && isRareMon(row.id);
        // right side: 「レア」 tag for rare monsters, ★ once its rare item was obtained; the name never runs under them
        let right = x + w - (r && gotRare(m, r) ? 12 : 0);
        if (r && gotRare(m, r)) Menu.kitStar(x + w - 9, y + 3);
        if (rareMon) { G().text('レア', right, y, { align: 'right', color: G().C.gold }); right -= G().textWidth('レア') + 2; }
        K.fitText(s ? m.name : '？？？？？', x + 20, y, right - x - 22, { color: s ? (b ? G().C.white : '#b0b0c0') : G().C.dark });
      }
      render() {
        if (this.detail) { this.renderDetail(); return; }
        G().window(4, 4, 248, 40);
        G().text('モンスター図鑑', 14, 10, { color: G().C.yellow });
        G().text('見つけた', 14, 24, { color: G().C.gray });
        G().text(this.nSeen + '/' + this.all, 110, 24, { align: 'right' });
        G().text('倒した', 130, 24, { color: G().C.gray });
        G().text(this.nBeat + '/' + this.all, 240, 24, { align: 'right' });
        this.list.draw();
        // preview
        G().window(156, 46, 96, 140);
        const id = this.id, m = DB.monsters[id];
        if (m && seen(id)) {
          G().rect(164, 150, 80, 1, '#2a2a40');
          drawMon(m, 204, 148, 80, 90, false);
          const r = rec(id) || {};
          G().text('倒した数', 164, 158, { color: G().C.gray });
          G().text(String(r.kills || 0), 244, 172, { align: 'right' });
        } else if (m) {
          G().text('？', 204, 100, { align: 'center', color: G().C.dark, size: 24 });
        }
        G().window(4, 188, 248, 30);
        G().text(m && seen(id) ? 'Aボタンで詳しく見る' : 'まだ出会っていない', 14, 196, { color: G().C.gray });
      }
      renderDetail() {
        const id = this.id, m = DB.monsters[id], r = rec(id) || {};
        const b = known(r);
        // title
        G().window(4, 4, 248, 26);
        G().text('No.' + pad3(this.list.index + 1), 14, 11, { color: G().C.gray });
        G().text(m.name, 64, 11, { color: G().C.yellow });
        if (isRareMon(id)) {
          const tx = 64 + G().textWidth(m.name) + 6;
          G().rect(tx, 10, G().textWidth('レア') + 6, 13, '#6a4a00');
          G().text('レア', tx + 3, 11, { color: G().C.gold });
        }
        G().text((this.page + 1) + '/2', 240, 11, { align: 'right', color: G().C.gray });
        // sprite panel with a little ground
        G().window(4, 32, 108, 98);
        G().rect(10, 112, 96, 12, '#1a1a28');
        G().rect(10, 112, 96, 1, '#34344c');
        drawMon(m, 58, 118, 96, 84, false);
        K.lrArrows(8, 108, 76);
        if (this.page === 0) this.detail1(m, r, b);
        else this.detail2(m, r, b);
      }
      detail1(m, r, b) {
        const q = (v) => (b ? String(v) : '？？？');
        G().window(114, 32, 138, 98);
        const rows = [['レベル', m.lv], ['HP', m.hp], ['攻撃力', m.atk], ['守備力', m.def], ['素早さ', m.agi], ['倒した数', r.kills || 0]];
        rows.forEach(([k, v], i) => {
          G().text(k, 124, 40 + i * 14, { color: G().C.gray });
          G().text(i === 5 ? String(v) : q(v), 242, 40 + i * 14, { align: 'right', color: i === 5 ? G().C.cyan : G().C.white });
        });
        G().window(4, 132, 248, 88);
        G().text('経験値', 14, 139, { color: G().C.gray }); G().text(q(m.exp), 80, 139, { align: 'right' });
        G().text('ゴールド', 92, 139, { color: G().C.gray }); G().text(q(m.gold), 170, 139, { align: 'right' });
        G().text('JP', 182, 139, { color: G().C.gray }); G().text(q(m.jp), 242, 139, { align: 'right' });
        const rareOk = gotRare(m, r);
        const drop = (slot, got) => {
          if (!m[slot] || !m[slot].item) return b ? 'なし' : '？？？';
          return got ? K.itemLabel(m[slot].item) : '？？？';
        };
        G().text('ドロップ', 14, 152, { color: G().C.gray });
        K.fitText(drop('drop', r.drop), 82, 152, 160, { color: r.drop ? G().C.white : G().C.dark });
        G().text('レア', 14, 165, { color: G().C.gray });
        K.fitText(drop('rare', rareOk), 82, 165, 160, { color: rareOk ? G().C.yellow : G().C.dark });
        // up to 3 lines of description (boss texts are long)
        let dl = G().wrap(m.desc || '', 226);
        if (dl.length > 3) dl = G().wrap(String(m.desc).replace(/\n/g, ''), 226); // author line breaks may not fit: reflow
        dl.slice(0, 3).forEach((l, i) => G().text(l, 14, 179 + i * 12, { color: '#d0d0e0' }));
      }
      detail2(m, r, b) {
        const q = (v) => (b ? String(v) : '？？？');
        G().window(114, 32, 138, 98);
        const acts = m.actsPerTurn || 1;
        const rows = [['MP', q(m.mp || 0)], ['魔力', q(m.mag || 0)], ['魔法防御', q(m.mdef || 0)], ['回避', b ? (m.eva != null ? m.eva : 3) + '%' : '？？？'], ['行動回数', b ? acts + '回' : '？？？']];
        rows.forEach(([k, v], i) => {
          G().text(k, 124, 40 + i * 14, { color: G().C.gray });
          G().text(v, 242, 40 + i * 14, { align: 'right' });
        });
        G().window(4, 132, 248, 88, { title: '特徴' });
        if (!b) { G().text('倒すか、スキャンすると分かる。', 14, 144, { color: G().C.dark }); return; }
        const el = m.elem || {};
        const weak = [], strong = [];
        for (const e of K.ELEMS) {
          const v = el[e] == null ? 1 : el[e];
          if (v > 1) weak.push(K.elemName(e));
          else if (v < 0) strong.push(K.elemName(e) + '(吸収)');
          else if (v === 0) strong.push(K.elemName(e) + '(無効)');
          else if (v < 1) strong.push(K.elemName(e));
        }
        const sr = m.statusRes || {};
        const immune = Object.keys(sr).filter((s) => sr[s] >= 1).map(K.statusName);
        const FL = { rare: 'レア', boss: 'ボス', metal: 'メタル', undead: 'アンデッド', flying: '飛行', dragon: 'ドラゴン', flee: '逃げやすい' };
        const tags = (m.flags || []).map((f) => FL[f]).filter(Boolean);
        const lines = [
          ['弱点', weak.join('・') || 'なし', weak.length ? G().C.green : G().C.gray],
          ['耐性', strong.join('・') || 'なし', strong.length ? G().C.orange : G().C.gray],
          ['効かない', immune.join('・') || 'なし', immune.length ? G().C.white : G().C.gray],
        ];
        if (m.steal && (m.steal.item || m.steal.rare)) {
          const parts = [];
          if (m.steal.item) parts.push(r.steal ? K.itemLabel(m.steal.item) : '？？？');
          if (m.steal.rare) parts.push(r.stealRare ? '★' + K.itemLabel(m.steal.rare).replace(/★$/, '') : '★？？？');
          lines.push(['盗める', parts.join('／'), r.steal || r.stealRare ? G().C.white : G().C.dark]);
        }
        if (tags.length) lines.push(['種族', tags.join('・'), G().C.yellow]);
        lines.slice(0, 5).forEach(([k, v, col], i) => {
          G().text(k, 14, 141 + i * 14, { color: G().C.gray });
          K.fitText(v, 76, 141 + i * 14, 166, { color: col });
        });
      }
    }

    return { StatusScreen, BookScreen };
  }
})(window.RPG);
