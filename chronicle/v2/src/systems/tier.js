// EVENTS — ティアと、地方の解決の演出（V2_PLAN §2.5.14・§3.1 の 8〜9・§3.14 の E17・E20、WORLD_REDESIGN §3.4）
//
//   R.Tier.get() → 0〜8               解決した地方の数（R.Game.tier）
//   R.Tier.effective()                 縦切りでは get() と同じ（クリア後の 9 は範囲の外）
//   R.Tier.pending() / consumePending() E17: 地方を解決したときに立つ「次のティアの場面」の番号
//   R.Tier.celebrate(rid) → Promise    大灯火の演出の共通の筋（ev.clearRegion が呼ぶ）:
//       暗転 → R.emit('tier')（R.Sky・FIELD のチャンクがここで引き直す）→ カメラを光の柱へ → 明ける → 光の柱が立つ →
//       章の札（第 N 章・章題・ページ）→ A か 7 秒で閉じる → カメラを先頭へ戻す
//   足した物: MAX / pick(table, tier) / innPrice(tier?) / scene（場面 id 'celebrate'）
//
// E17（ティアの場面の遅らせ）: 'inn'（ev.inn）と町（map.kind 'town'）の 'map:enter' で pending() があれば、
//   走っているイベントが終わってから story_t<N>（中身は CONTENT-P）を ctx {map, reason:'inn'|'enter', tier:N} で走らせる。
//   地方を解決した同じイベントの中の宿・町（締めの演出でフェルンへ戻るなど）では起こさない（次の宿・町で）。
//   story_t<N> がまだ無いときは pending のまま（R.warn を 1 回）。
//
// R.DB.regions[rid]（CONTENT-P）から読む物: name・chapter.title（章題。無ければ name）・page（ページの品。無ければ k_page_<rs>）・
//   beaconAt {map, x, y}（光の柱の場所。beacon が {map, x, y} の物でもよい。無ければ今のマップの {type:'prop', id:'beacon'} の物、それも無ければ一行の先頭の上）
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Tier');
  const Tier = (R.Tier = R.Tier || {});
  Tier.MAX = 8;

  Tier.get = function () { return (R.Game && R.Game.tier) || 0; };
  Tier.effective = function () { return Tier.get(); };
  Tier.pending = function () { return R.Game && R.Game.pendingTier != null ? R.Game.pendingTier : null; };
  Tier.consumePending = function () {
    if (!R.Game) return null;
    const p = R.Game.pendingTier;
    R.Game.pendingTier = null;
    return p == null ? null : p;
  };
  /** 表からティアの値: 配列 → table[min(t, len-1)]、{0:a, 3:b} → t 以下でいちばん大きいキー */
  Tier.pick = function (table, t) {
    if (table == null) return undefined;
    t = t == null ? Tier.get() : t;
    if (Array.isArray(table)) return table.length ? table[Math.max(0, Math.min(t | 0, table.length - 1))] : undefined;
    if (typeof table !== 'object') return table;
    let best = null;
    for (const k of Object.keys(table)) { const n = +k; if (!isNaN(n) && n <= t && (best === null || n > best)) best = n; }
    return best === null ? undefined : table[best];
  };
  /** 宿の値段（DB.config.innPrice、ティアごと） */
  Tier.innPrice = function (t) {
    const tbl = R.DB.config && R.DB.config.innPrice;
    const v = Tier.pick(tbl, t == null ? Tier.effective() : t);
    return typeof v === 'number' ? v : 10;
  };

  // ================================================================ E17: ティアの場面の遅らせ
  let armedRun = 0;      // 地方を解決したイベントの番号（その中の宿・町では起こさない）
  let waiting = false;
  const warned = {};
  /** ev.clearRegion が呼ぶ: 今走っているイベントの中では起こさない */
  Tier._arm = function () { armedRun = (R.Events && R.Events.runId) ? R.Events.runId() : 0; };
  function wake(reason, mapId) {
    const p = Tier.pending();
    if (p == null || waiting) return;
    if (reason === 'enter') { const m = R.DB.maps[mapId]; if (!m || m.kind !== 'town') return; }
    const busy = R.Events && R.Events.busy && R.Events.busy();
    if (busy && armedRun && R.Events.runId && R.Events.runId() === armedRun) return;
    const id = 'story_t' + p;
    if (!R.DB.events[id]) { if (!warned[id]) { warned[id] = true; R.warn('R.Tier: ' + id + ' is not written yet (pendingTier stays)'); } return; }
    waiting = true;
    const ready = () => {
      if (R.Events.busy()) return false;
      const top = R.Engine.top();
      return !!top && top.id === 'field' && R.Engine.fade.a < 0.01;
    };
    R.until(ready).then(() => {
      waiting = false;
      if (Tier.pending() !== p) return;
      Tier.consumePending();
      armedRun = 0;
      R.Events.run(id, { map: mapId || (R.Field.pos || {}).map, reason, tier: p });
    });
  }
  Tier._wake = wake;
  R.onData(function () {
    R.on('inn', (e) => wake('inn', e && e.map));
    R.on('map:enter', (e) => wake('enter', e && e.map));
  });

  // ================================================================ 大灯火の演出（E20）
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  function regionInfo(rid) {
    const reg = (R.DB.regions && R.DB.regions[rid]) || {};
    const rs = String(rid || '').replace(/^r_/, '');
    const pageId = reg.page || reg.fragment || ('k_page_' + rs);
    const page = R.DB.items[pageId];
    return {
      name: reg.name || rs,
      title: (reg.chapter && reg.chapter.title) || reg.chapterTitle || reg.name || rs,
      pageId, pageName: page ? page.name : null, beacon: reg.beaconAt || (reg.beacon && typeof reg.beacon === 'object' ? reg.beacon : null),
    };
  }
  Tier.regionInfo = regionInfo;

  /** 光の柱の場所（マス）: regions の beacon → 今のマップの beacon の物 → 先頭の上 */
  function beaconAt(info) {
    const pos = (R.Field && R.Field.pos) || {};
    const b = info.beacon;
    if (b && b.map === pos.map && b.x != null) return { x: b.x, y: b.y, own: true };
    const m = R.DB.maps[pos.map];
    for (const o of (m && m.objects) || []) if (o.type === 'prop' && (o.id === 'beacon' || o.beacon === true)) return { x: o.x, y: o.y, own: true };
    return { x: pos.x || 0, y: (pos.y || 0) - 2, own: false };
  }

  /** 演出の場面（id 'celebrate'。フィールドの上に重ねる。A か 7 秒で閉じる） */
  function stageScene(st) {
    return {
      id: 'celebrate', opaque: false,
      enter() { st.t0 = R.Engine.time; },
      exit() {},
      update() {
        const t = R.Engine.time - st.t0;
        const I = R.Input;
        if (st.cardAt != null && t > st.cardAt + 900 && (I.pressed('a') || I.pressed('b') || (I.pointer && I.pointer.pressed))) { R.UIK.sfx && R.UIK.sfx('confirm'); st.close(); }
        if (st.cardAt != null && t > st.cardAt + (st.cardMs || 7000)) st.close();
      },
      draw(g) { drawStage(g, st); },
    };
  }

  /** マス → 画面の論理 px（FIELD のカメラ。無ければ中央） */
  function screenOf(tx, ty) {
    const F = R.Field;
    if (F && F._cam && F._s && F._s.map) {
      const c = F._cam({});
      return { x: tx * c.t + c.t / 2 - c.cx, y: ty * c.t + c.t / 2 - c.cy, t: c.t };
    }
    return { x: R.W / 2, y: R.H * 0.55, t: 32 };
  }

  function drawStage(g, st) {
    const t = R.Engine.time - st.t0;
    const U = R.UIK.u, T = R.UIK.T, C = T.color;
    const rm = R.UIK.reduceMotion ? R.UIK.reduceMotion() : false;
    // ---- 光の柱（地面から空へ。0〜1.6 秒で立ち上がる）
    const k = Math.max(0, Math.min(1, t / 1600));
    const e = 1 - Math.pow(1 - k, 3);
    const p = screenOf(st.bx, st.by);
    const baseY = p.y + p.t * 0.3;
    const topY = baseY - (baseY + 40) * e;
    const pulse = rm ? 1 : 0.85 + 0.15 * Math.sin(t / 380);
    const wCore = Math.max(3, p.t * 0.22), wHalo = p.t * 1.6;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // にじみ（幅の広い柱）
    let gr = g.createLinearGradient(p.x - wHalo, 0, p.x + wHalo, 0);
    gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(0.5, `rgba(255,214,140,${0.22 * pulse * e})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = gr; g.fillRect(p.x - wHalo, topY, wHalo * 2, baseY - topY);
    // 芯
    gr = g.createLinearGradient(p.x - wCore * 2, 0, p.x + wCore * 2, 0);
    gr.addColorStop(0, 'rgba(255,244,210,0)'); gr.addColorStop(0.5, `rgba(255,248,226,${0.85 * pulse * e})`); gr.addColorStop(1, 'rgba(255,244,210,0)');
    g.fillStyle = gr; g.fillRect(p.x - wCore * 2, topY, wCore * 4, baseY - topY);
    // 根元の光だまり
    const rg = p.t * (2.2 + 1.4 * e);
    const rad = g.createRadialGradient(p.x, baseY, 0, p.x, baseY, rg);
    rad.addColorStop(0, `rgba(255,236,180,${0.55 * e})`); rad.addColorStop(0.45, `rgba(255,190,110,${0.18 * e})`); rad.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = rad; g.beginPath(); g.ellipse(p.x, baseY, rg, rg * 0.45, 0, 0, Math.PI * 2); g.fill();
    // 立ちのぼる光の粒（決まった種）
    if (e > 0.05) {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const s1 = st.seed[i * 3], s2 = st.seed[i * 3 + 1], s3 = st.seed[i * 3 + 2];
        const life = 2600 + s1 * 1800;
        const ph = ((t * (rm ? 0.2 : 1) + s2 * life) % life) / life;
        const px = p.x + (s3 - 0.5) * wHalo * 1.3 + Math.sin(ph * 6.28 + s1 * 9) * p.t * 0.2;
        const py = baseY - ph * (baseY - topY);
        const a = Math.sin(ph * Math.PI) * 0.9 * e;
        const r = 0.8 + s2 * 1.6;
        g.fillStyle = `rgba(255,${220 + ((s1 * 30) | 0)},${150 + ((s3 * 60) | 0)},${a.toFixed(3)})`;
        g.fillRect(Math.round(px - r), Math.round(py - r), Math.ceil(r * 2), Math.ceil(r * 2));
      }
    }
    g.restore();
    // ---- 章の札
    if (st.cardAt == null) return;
    const ct = t - st.cardAt;
    const ka = Math.max(0, Math.min(1, ct / 520));
    const ea = R.UIK.ease ? R.UIK.ease(ka) : ka;
    // 画面を少し落とす（札を読みやすく）
    g.save(); g.fillStyle = `rgba(6,7,14,${0.42 * ea})`; g.fillRect(0, 0, R.W, R.H); g.restore();
    const tall = R.layout === 'tall';
    const w = Math.min(R.W - U(40), U(tall ? 360 : 460));
    const h = U(tall ? 250 : 236);
    const x = Math.round((R.W - w) / 2), y = Math.round((R.H - h) / 2 + (1 - ea) * U(10) - (tall ? 0 : U(18)));
    g.save();
    g.globalAlpha = ea;
    R.UIK.panel(g, { x, y, w, h }, { dense: true });
    // 上の飾り: 琥珀の菱形と細い線
    const cx = x + w / 2;
    R.UIK.hline && R.UIK.hline(g, x + U(40), x + w - U(40), y + U(30), 0.3, [236, 201, 124]);
    R.UIK.diamond(g, cx, y + U(30), U(6), C.gold, C.goldHi, 1);
    R.UIK.text(g, 'CHAPTER ' + (ROMAN[st.n] || st.n), cx, y + U(46), { size: U(12), family: 'en', color: C.gold, align: 'center', track: U(4) });
    R.UIK.text(g, '第' + (KANJI[st.n] || st.n) + '章', cx, y + U(70), { size: U(15), weight: 700, color: C.text2, align: 'center', track: U(3) });
    R.UIK.text(g, st.title, cx, y + U(96), { size: U(tall ? 26 : 30), weight: 700, align: 'center', grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(236,180,90,0.35)', blur: 10, maxW: w - U(48) });
    R.UIK.rule(g, x + U(56), x + w - U(56), y + U(146), 0.16);
    if (st.page) {
      const line = st.page + 'を年代記にとじた';
      const tw = R.UIK.measure(line, { size: U(13.5) }) + U(24);
      R.UIK.icon(g, 'book', cx - tw / 2, y + U(160), U(17), C.gold);
      R.UIK.text(g, line, cx - tw / 2 + U(24), y + U(160), { size: U(13.5), color: C.text });
    }
    R.UIK.text(g, st.region + 'に灯りがもどった', cx, y + U(186), { size: U(12), color: C.text3, align: 'center' });
    if (ct > 900) R.UIK.prompts(g, [{ btn: 'a', label: 'つづける' }], { x: x + w - U(20), y: y + h - U(22), align: 'right' });
    g.restore();
  }

  Tier.celebrate = async function (rid, o) {
    o = o || {};
    const G = R.Game;
    const info = regionInfo(rid);
    if (R.UIK && R.UIK.Message && R.UIK.Message.busy()) R.UIK.Message.close();
    const hasField = !!(R.Engine.has && R.Engine.has('field'));
    // 1. 暗転。暗い間に空の段を引き直す（FIELD のチャンク・R.Sky は 'tier' で焼き直す）
    await R.Engine.fadeTo(1, o.fadeMs != null ? o.fadeMs : 700);
    R.emit('tier', { tier: G ? G.tier : Tier.get(), rid });
    const b = beaconAt(info);
    if (hasField && R.Field.camera && R.Field.camera.focus) { try { R.Field.camera.focus(b.x, b.y, { ms: 0 }); } catch (e) { /* */ } }
    await R.wait(o.darkMs != null ? o.darkMs : 500);
    // 2. 明ける → 光の柱が立つ
    const seed = [];
    const rng = R.rng('celebrate:' + rid);
    for (let i = 0; i < 90; i++) seed.push(rng.next());
    const st = { bx: b.x, by: b.y, seed, n: (G && G.chapter) || Tier.get() || 1, title: info.title, page: info.pageName, region: info.name, cardAt: null, cardMs: o.cardMs };
    let resolveClose;
    const closed = new Promise((res) => { resolveClose = res; });
    const scene = stageScene(st);
    st.close = () => { if (st.done) return; st.done = true; R.Engine.remove(scene); resolveClose(); };
    R.Engine.push(scene);
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    await R.Engine.fadeTo(0, o.fadeMs != null ? o.fadeMs : 900);
    await R.wait(o.pillarMs != null ? o.pillarMs : 1500);
    // 3. 章の札（章のジングル）
    st.cardAt = R.Engine.time - st.t0;
    try { R.Audio.jingle('chapter'); } catch (e) { /* */ }
    await closed;
    if (hasField && R.Field.camera && R.Field.camera.follow) { try { await R.Field.camera.follow({ ms: 600 }); } catch (e) { /* */ } }
    return true;
  };
})(window.RPG);
