// BSCENE: ボスの声と字幕（持ち主 2026-10-03「ボスに声を」）。台詞と声の id は src/data/boss_voice.js（R.DB.bossVoice）。
//   鳴らす所: 戦闘の始め（ボスの名前の札）・暴走（「怒り狂った」「本気になった」）・必殺技の差し込み（ult_fx.js）・倒れた時。
//   口は仲間の戦闘ボイスと同じ（voice.js の playClip: 新しい声が前の声を止める。BGM を下げない）。待たない（戦闘の流れを止めない）。
//   設定「戦闘ボイス」: 'off' なら鳴らさず字幕も出さない。'big'（大技だけ）でもボスの声は鳴らす（どれも大きな場面）。
//   倍速・リピート中: 始めと暴走の声は出さない。必殺技はその戦闘で初めての技だけ。倒れた時の声は出す。
//   字幕: ボスの名前の札の下に短い一行（声の長さだけ、無ければ字数からの目安）。帯（閃き・必殺技）より上に描く。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const BV = (_.bossVoice = {});
  BV.log = [];   // テスト用: [{uid, kind, id|null, why}]

  const db = () => (R.DB && R.DB.bossVoice) || {};
  function note(o) { BV.log.push(o); if (BV.log.length > 50) BV.log.shift(); }
  /** その敵の台詞の表（無ければ null） */
  BV.entry = function (st, uid) {
    const u = st.unit ? st.unit(uid) : null;
    const a = !u && st.actor ? st.actor(uid) : null;
    const id = (u || a || {}).id;
    return (id && db()[id]) || null;
  };
  const fast = (st) => ((st.speed && st.speed()) || 1) > 1 || !!(st.B && st.B.repeatOn);
  const pick = (list, st) => {
    if (!list || !list.length) return null;
    const r = st.vrng ? st.vrng.next() : Math.random();
    return list[Math.floor(r * list.length) % list.length];
  };
  /** 字数からの長さの目安（ms）: 1 秒 7 字＋「……」の間 */
  BV.estMs = function (text) {
    const s = String(text || '');
    const n = [...s.replace(/[…！？。、「」―ー〜!?\s　.,'"-]/g, '')].length;
    const lat = /^[\x00-\x7f]*$/.test(s);
    return Math.round(((lat ? n / 14 : n / 7) + (s.match(/……|\.\.\./g) || []).length * 0.35 + 0.6) * 1000);
  };

  /** 鳴らす（kind: start / enrage / ult / defeat）。line = {id, text} → 鳴らした id か null */
  function say(st, uid, kind, line) {
    const why = (w) => { note({ uid, kind, id: null, why: w }); return null; };
    if (!line) return why('no-line');
    const V = _.voice;
    if (V && V.mode && V.mode() === 'off') return why('off');
    const id = V && V.playClip ? V.playClip(line.id, { who: uid, kind: 'boss_' + kind }) : null;
    if (!id) return why('no-clip');
    const c = V.current ? V.current() : null;
    st.bossLine = { uid, kind, id, text: line.text || '', t0: R.Engine.time, minMs: BV.estMs(line.text), h: (c && c.id === id && c.h) || null, end: 0 };
    note({ uid, kind, id, why: 'play' });
    return id;
  }

  /** 戦闘の始め（scene.js の intro の初め）: 出てくるボスの声を先に読む */
  BV.prepare = function (st) {
    const ids = [];
    for (const a of st.actors || []) {
      if (a.side !== 'enemy') continue;
      const e = db()[a.id];
      if (!e) continue;
      for (const k of ['start', 'enrage', 'defeat']) for (const l of e[k] || []) ids.push(l.id);
      for (const l of Object.values(e.ult || {})) ids.push(l.id);
    }
    st._bvUlt = {};
    if (ids.length && R.Audio && R.Audio.preloadVoice) { try { R.Audio.preloadVoice(ids); } catch (e) { /* ignore */ } }
    return ids;
  };
  /** ボスの名前の札が出た時（a = 札のボスの actor） */
  BV.start = function (st, a) {
    if (!a) return null;
    const e = db()[a.id];
    if (!e || !e.start) return null;
    if (fast(st)) { note({ uid: a.uid, kind: 'start', id: null, why: 'fast' }); return null; }
    return say(st, a.uid, 'start', pick(e.start, st));
  };
  /** 暴走（playback.js の P.enrage） */
  BV.enrage = function (st, ev) {
    const e = BV.entry(st, ev.uid);
    if (!e || !e.enrage) return null;
    if (fast(st)) { note({ uid: ev.uid, kind: 'enrage', id: null, why: 'fast' }); return null; }
    return say(st, ev.uid, 'enrage', pick(e.enrage, st));
  };
  /** 必殺技の差し込み（ult_fx.js）。sid = 演出の id（'sq:eb_…' か行動の id） */
  BV.ult = function (st, ev, sid) {
    const e = BV.entry(st, ev.uid);
    const mv = String(ev.id || sid || '').replace(/^sq:/, '');
    const line = e && e.ult && (e.ult[mv] || e.ult[String(sid || '').replace(/^sq:/, '')]);
    if (!line) return null;
    const seen = (st._bvUlt = st._bvUlt || {});
    if (fast(st) && seen[line.id]) { note({ uid: ev.uid, kind: 'ult', id: null, why: 'fast' }); return null; }
    seen[line.id] = 1;
    return say(st, ev.uid, 'ult', line);
  };
  /** 倒れた時（playback.js の H.ko の敵の側） */
  BV.defeat = function (st, ev) {
    const e = BV.entry(st, ev.uid);
    if (!e || !e.defeat) return null;
    return say(st, ev.uid, 'defeat', pick(e.defeat, st));
  };
  /** 今ボスの声（倒れた時の声）が鳴っているか（result.js: 勝利の声はその後に） */
  BV.defeatBusy = function (st) {
    const b = st && st.bossLine;
    return !!(b && b.kind === 'defeat' && _.voice && _.voice.current && _.voice.current() && _.voice.current().id === b.id && _.voice.busy());
  };

  // ---------------------------------------------------------------- 字幕
  /** 字幕の濃さ 0..1（声が鳴っている間と目安の長さ。終わったら 0.4 秒で消える） */
  function alphaOf(b, now) {
    const h = b.h;
    const playing = !!(h && !h.stopped && (h.src || (now - b.t0) < 2500));
    const live = playing || (now - b.t0) < b.minMs;
    if (live) { b.end = 0; return Math.min(1, (now - b.t0) / 160); }
    if (!b.end) b.end = now;
    return Math.max(0, 1 - (now - b.end) / 400);
  }
  BV.draw = function (g, st) {
    const b = st.bossLine;
    if (!b || st.result || st.phase === 'gameover') return;
    const now = R.Engine.time;
    const al = alphaOf(b, now);
    if (al <= 0) { st.bossLine = null; return; }
    const a = st.actor ? st.actor(b.uid) : null;
    const K = R.UIK;
    if (!a || !K || !b.text) return;
    const k = R.uiScale || 1;
    const size = Math.max(14 * k, R.minFont || 0);
    const maxW = Math.min(R.W * 0.42, 560 * k);
    const lines = K.wrap ? K.wrap(b.text, maxW, { size }) : [b.text];
    const lh = size * 1.35, padX = 12 * k, padY = 7 * k;
    let w = 0;
    for (const l of lines) w = Math.max(w, K.measure(l, { size, weight: 500 }));
    const bw = w + padX * 2, bh = lines.length * lh + padY * 2;
    // 名前の札（hud.js の enemyTags: 足もとの線 a.y + 8、札の高さ 11k＋5k）の下
    const v = st.vis && st.vis[b.uid];
    const H = st.L && st.L.tall ? st.L.stageH : R.H;
    let cx = a.x + ((v && v.dx) || 0);
    let y = a.y + 8 + Math.max(11 * k, R.minFont || 0) + 12 * k;
    cx = Math.max(bw / 2 + 12 * k, Math.min(R.W - bw / 2 - 12 * k, cx));
    y = Math.min(y, H - bh - 70 * k);
    // 下に収まらず名前の札に重なる時（縦の画面で敵が下の方にいる）は、ボスの頭の上に出す（三角は下向き）
    const tagBot = a.y + 10 + Math.max(11 * k, R.minFont || 0) + 5 * k;
    let up = false;
    if (y < tagBot + 4 * k) {
      const hh = _.actors && _.actors.height ? _.actors.height(a) : 100;
      y = Math.max(8 * k, a.y + ((v && v.dy) || 0) - hh - bh - 10 * k);
      up = true;
    }
    g.save();
    g.globalAlpha = al;
    g.fillStyle = 'rgba(10,8,18,0.78)';
    g.beginPath(); if (g.roundRect) g.roundRect(cx - bw / 2, y, bw, bh, 6 * k); else g.rect(cx - bw / 2, y, bw, bh); g.fill();
    g.strokeStyle = 'rgba(255,196,150,0.42)'; g.lineWidth = 1; g.stroke();
    // 小さな三角（ボスの方を指す）
    g.fillStyle = 'rgba(10,8,18,0.78)';
    if (up) { g.beginPath(); g.moveTo(cx - 6 * k, y + bh); g.lineTo(cx + 6 * k, y + bh); g.lineTo(cx, y + bh + 6 * k); g.closePath(); g.fill(); }
    else { g.beginPath(); g.moveTo(cx - 6 * k, y); g.lineTo(cx + 6 * k, y); g.lineTo(cx, y - 6 * k); g.closePath(); g.fill(); }
    lines.forEach((l, i) => K.text(g, l, cx, y + padY + i * lh + (lh - size) / 2, { size, align: 'center', color: '#ffe6c6', weight: 500, raw: true, shadow: true }));
    g.restore();
  };

  // 帯を描く関数（閃き・必殺技の帯の後。ult_fx.js が包んだ物）をさらに包む: 字幕は帯と暗さの上
  const G = _.glimmer;
  if (G && G.drawBanner && !G.drawBanner._bv) {
    const db0 = G.drawBanner;
    G.drawBanner = function (g, st) {
      db0(g, st);
      if (st.bossLine) BV.draw(g, st);
    };
    G.drawBanner._bv = true;
    G.drawBanner._ult = db0._ult;
  }
})(window.RPG);
