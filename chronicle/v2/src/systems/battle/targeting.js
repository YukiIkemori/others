// BSCENE: ねらい（MODERN_UI §6.17）。選ぶ前から前回の相手に琥珀の菱形（カーソル記憶）。十字で相手を替え、相手の名前を見出しに。
// 味方をねらうときは右上の一覧の行が光る。全体（enemies・allies）は全員が光り、A で決める。タップはその相手に決める。
//   _.target.pick(st, u, type, {row, mem}) → uid | null（全体）| 'back'
//   type: enemy・group（敵ひとり）、enemies・random（敵全体）、ally・ally_other・ally_any・ally_dead（味方ひとり）、allies・party（味方全体）、self
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const Tg = (_.target = {});
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* ignore */ } };

  // 味方を選ぶ相手の種類（ally_dead は倒れた人だけ）と、全員に当たる種類
  const PARTY = { ally: 1, ally_other: 1, ally_dead: 1, ally_any: 1, allies: 1, party: 1 };
  const GROUP = { enemies: 1, random: 1, allies: 1, party: 1 };
  /** 行（道具・術・技）の効き目に蘇生があるか */
  function revives(row) {
    const D = R.DB || {};
    const it = row.cmd === 'item' ? D.items && D.items[row.id] : null;
    const a = it ? it.use : (D.spells && D.spells[row.id]) || (D.techs && D.techs[row.id]) || null;
    return !!(a && (a.effects || []).some((e) => e.type === 'revive'));
  }

  function inActor(st, a, p) {
    const h = _.actors.height(a), w = Math.max(28, h * 0.6);
    return p.x >= a.x - w / 2 && p.x <= a.x + w / 2 && p.y >= a.y - h - 6 && p.y <= a.y + 10;
  }

  Tg.pick = function (st, u, type, o) {
    o = o || {};
    const M = o.mem || {};
    const row = o.row || {};
    if (type === 'self') return Promise.resolve(u.uid);
    const party = !!PARTY[type];
    const group = !!GROUP[type];
    let list;
    if (party) {
      // 倒れた人だけ（ally_dead）・生きている人だけ（ally・ally_other）・誰でも（ally_any）。全体の蘇生は倒れた人も光らせる
      const mine = st.actors.filter((a) => a.side === 'party' && !(type === 'ally_other' && a.uid === u.uid));
      const alive = (a) => !!(st.vis[a.uid] && st.vis[a.uid].alive);
      if (type === 'ally_dead') list = mine.filter((a) => !alive(a));
      else if (type === 'ally_any' || (group && revives(row))) list = mine;
      else list = mine.filter(alive);
      // 倒れた人がいない蘇生（ふつうは選ぶ前に灰色）: ブザーで一覧へ戻る
      if (!list.length && type === 'ally_dead') { sfx('buzzer'); return Promise.resolve('back'); }
      if (!list.length) list = mine.length ? mine : st.actors.filter((a) => a.side === 'party');
    } else {
      list = st.aliveEnemies().slice().sort((a, b) => (b.x - a.x) || (a.y - b.y));
    }
    if (!list.length) return Promise.resolve(group ? null : u.uid);
    let sel = 0;
    if (!group && type !== 'ally_dead') {   // 蘇生は最初の倒れた人から
      const memKey = party ? 'ally' : 'target';
      const want = M[memKey];
      const j = list.findIndex((a) => a.uid === want);
      if (j >= 0) sel = j;
      else if (party) sel = Math.max(0, list.findIndex((a) => a.uid === u.uid));
    }
    const prevHead = st.head;
    return new Promise((resolve) => {
      const w = { prompts: [{ btn: 'a', label: '決定' }, { btn: 'b', label: 'ひとつ戻る' }, { btn: 'left', label: '相手を変える' }], tallPrompts: false };
      if (group) w.prompts = [{ btn: 'a', label: '決定' }, { btn: 'b', label: 'ひとつ戻る' }];
      const setHot = () => {
        st.hot = {};
        if (group) for (const a of list) st.hot[a.uid] = true;
        else st.hot[list[sel].uid] = true;
        const name = row.label || '';
        st.head = { name: `${u.name}の番`, sub: group ? `${name} → ${party ? '味方全体' : '敵全体'}` : `${name} → ${list[sel].name}` };
      };
      setHot();
      const done = (v) => {
        st.hot = null;
        if (st.ui === w) st.ui = null;
        if (v === 'back') st.head = prevHead;
        else if (!group) { M[party ? 'ally' : 'target'] = v; }
        resolve(v);
      };
      w.update = function () {
        const I = R.Input;
        st.chipTap = null;
        if (!group) {
          const n = list.length;
          // 敵は x の順に並べてある（味方に近い方から）。←→ で横、↑↓ でも順に
          if (I.repeat(party ? 'down' : 'left') || I.repeat(party ? 'right' : 'down')) { sel = (sel + 1) % n; sfx('cursor'); setHot(); }
          if (I.repeat(party ? 'up' : 'right') || I.repeat(party ? 'left' : 'up')) { sel = (sel + n - 1) % n; sfx('cursor'); setHot(); }
        }
        const p = I.pointer;
        if (p && p.pressed) {
          // 敵・味方の絵、または右上の一覧の行
          const rects = party ? _.hud.partyRects(st) : null;
          for (let i = 0; i < list.length; i++) {
            const a = list[i];
            let hit = inActor(st, a, p);
            if (!hit && rects) { const pi = st.partyUnits().findIndex((x) => x.uid === a.uid); const r = rects[pi]; hit = r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
            if (hit) { sfx('confirm'); done(group ? null : a.uid); return; }
          }
        }
        if (I.pressed('a')) { sfx('confirm'); done(group ? null : list[sel].uid); }
        else if (I.pressed('b')) { sfx('cancel'); done('back'); }
      };
      w.draw = function (g) {
        const t = R.Engine.time, k = R.uiScale || 1;
        for (const a of group ? list : [list[sel]]) {
          // 倒れた味方（蘇生のねらい）は寝ている絵の上に菱形を置く
          const down = a.side === 'party' && st.vis[a.uid] && !st.vis[a.uid].alive;
          const h = down ? 34 : _.actors.height(a);
          const bob = R.Settings.get('reduceMotion') ? 0 : Math.sin(t / 220) * 2;
          const x = a.x + (a.side === 'enemy' ? 8 : -4), y = a.y - h - 12 + bob;
          g.save();
          g.globalCompositeOperation = 'lighter';
          const gr = g.createRadialGradient(x, y + 8, 1, x, y + 8, 26);
          gr.addColorStop(0, 'rgba(255,230,170,0.35)'); gr.addColorStop(1, 'rgba(255,230,170,0)');
          g.fillStyle = gr; g.fillRect(x - 26, y - 18, 52, 52);
          g.restore();
          _.K.diamond(g, x, y, 6 * k, _.K.COL.goldHi, 'rgba(80,60,30,0.9)', 1);
        }
        if (st.L.tall) {
          const Kt = _.K;
          const pad = 12 * k, by = st.L.cmdY + 20 * k;
          Kt.box(g, { x: pad, y: by, w: R.W - pad * 2, h: 52 * k }, { a: 0.72, r: 12 * k, edge: 'rgba(236,201,124,0.5)' });
          Kt.text(g, Kt.fit(st.head.sub || '', R.W - pad * 2 - 32 * k, { size: 15 * k, weight: 700 }), pad + 16 * k, by + 16 * k, { size: 15 * k, weight: 700, raw: true });
          Kt.text(g, group ? 'タップで決定' : '相手をタップ　・　B で戻る', R.W / 2, by + 64 * k, { size: 11.5 * k, color: Kt.COL.text3, align: 'center', raw: true });
        }
      };
      st.ui = w;
    });
  };
})(window.RPG);
