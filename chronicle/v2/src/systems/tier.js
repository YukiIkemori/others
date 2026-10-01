// EVENTS — ティアと、地方の解決の演出（V2_PLAN §2.5.14・§3.1 の 8〜9・§3.14 の E17・E20、WORLD_REDESIGN §3.4）
//
//   R.Tier.get() → 0〜8               解決した地方の数（R.Game.tier）
//   R.Tier.effective()                 縦切りでは get() と同じ（クリア後の 9 は範囲の外）
//   R.Tier.pending() / consumePending() E17: 地方を解決したときに立つ「次のティアの場面」の番号
//   R.Tier.celebrate(rid) → Promise    大灯火の演出の共通の筋（ev.clearRegion が呼ぶ）:
//       暗転 → R.emit('tier')（R.Sky・FIELD のチャンクがここで引き直す）→ カメラを光の柱へ → 明ける → 光の柱が立つ →
//       章の札（第 N 章・章題・ページ）→ A か 7 秒で閉じる → カメラを先頭へ戻す
//   足した物: MAX / pick(table, tier) / innPrice(tier?) / scene（場面 id 'celebrate'）
//   地方ごとの出現の固定: forZone(zoneId, t?) → 出現表のティア / lockOf(rid) → 解決した地方の固定ティア|null /
//     lockRegion(rid, t?)（ev.clearRegion）/ migrateLocks(G)（R.State.deserialize）。R.Game.regionTier = {rid: T}
//
// E17（ティアの場面の遅らせ）: 'inn'（ev.inn）と町（map.kind 'town'）の 'map:enter'、町から外へ出た 'leave'（Tier.wakeOnLeave が真のとき）で pending() があれば、
//   走っているイベントが終わってから story_t<N>（中身は CONTENT-P）を ctx {map, reason:'inn'|'enter'|'leave', tier:N, from} で走らせる。
//   Tier.sceneFor(N) があればその id（CONTENT-P の story_tiers: まだ見ていない T1〜TN を順に。null = もう全部見た → pending を消す）。
//   地方を解決した同じイベントの中の宿・町（締めの演出でフェルンへ戻るなど）では起こさない（次の宿・町で）。
//   story_t<N> がまだ無いときは pending のまま（R.warn を 1 回）。
//
// R.DB.regions[rid]（CONTENT-P）から読む物: name・chapter.title（章題。無ければ name）・page（ページの品。無ければ k_page_<rs>）・
//   beaconAt {map, x, y}（光の柱の場所。beacon が {map, x, y} の物でもよい。無ければ今のマップの {type:'prop', id:'beacon'} の物、それも無ければ一行の先頭の上）
//   x, y はマス（小数でよい）。柱の芯は (x + 0.5, y + 0.8) マス（screenOf のマスの中心 + 根元の 0.3 マス）に落ちる。
//   だから灯す物の描いた見た目の中心 (vx, vy) に落とすなら x = vx − 0.5、y = vy − 0.8（tools/test_beacon.js が確かめる）
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
  // ================================================================ 地方ごとの出現の固定（持ち主 2026-09-28「解決した地方の魔物はその時の強さのまま」）
  // 雑魚の戦闘レベル LZ(T)・段（@系統）・組の tierMin/Max・落とし物の表・レア・金色は、その地方を解決したときのティアで止まる。
  //   止めるティア = 解決する直前の R.Game.tier（その地方で戦っていた強さ。ev.clearRegion が +1 する前に R.Game.regionTier[rid] に書く）。
  //   まだ解決していない地方は今までどおり全体のティアで伸びる（飛ばした地方は手ごたえが残る）。
  //   序章（'prologue'）は clearRegion を通らない: 年代記の章 'prologue'（E.chapter）が入った時を解決とみなす（その時のティアは 0）。
  //   地方の無い表・DB.regions に無い地方（z_stub など）は全体のティア。数のティアの表（終章 8・クリア後 9・序章の lv の表）はその数のまま。
  //   古いセーブ（regionTier が無い）: 解決済みの地方は年代記の章の並び（clearRegion が解決の順に足す）から「前に解決した地方の数」を出す。
  //   章に無いとき（テストの状態など）は min(地方の番号 n − 1, 今のティア − 1)（0 より下にはしない）。出した値は regionTier に書いて固定する。
  //   宿・店・宝箱・ボスとイベントの編成は全体のティアのまま（ここは使わない）。
  function isCleared(G, rid) {
    if (!G || !rid) return false;
    if (G.cleared && G.cleared[rid]) return true;
    if (G.flags && G.flags['cleared_' + rid]) return true;
    return rid === 'prologue' && !!(G.chronicle && Array.isArray(G.chronicle.chapters) && G.chronicle.chapters.some((c) => c && c.id === rid));
  }
  /** 記録の無い解決済みの地方の固定ティア（古いセーブ）: 章の並びで前にある解決済みの地方（序章を除く）の数 */
  function deriveLock(G, rid) {
    const ch = (G.chronicle && Array.isArray(G.chronicle.chapters)) ? G.chronicle.chapters.map((c) => c && c.id) : [];
    const i = ch.indexOf(rid);
    if (i >= 0) {
      let n = 0;
      for (let k = 0; k < i; k++) if (ch[k] && ch[k] !== 'prologue' && G.cleared && G.cleared[ch[k]]) n++;
      return Math.min(Tier.MAX, n);
    }
    if (rid === 'prologue') return 0;
    const reg = R.DB.regions && R.DB.regions[rid];
    const byN = reg && typeof reg.n === 'number' ? reg.n - 1 : Tier.MAX;
    return Math.max(0, Math.min(byN, (G.tier || 0) - 1));
  }
  /** 地方の固定ティア（解決していなければ null）。記録が無ければ出して書く */
  Tier.lockOf = function (rid, G) {
    G = G || R.Game;
    if (!G || !rid || !(R.DB.regions && R.DB.regions[rid]) || !isCleared(G, rid)) return null;
    if (!G.regionTier || typeof G.regionTier !== 'object') G.regionTier = {};
    const v = G.regionTier[rid];
    if (typeof v === 'number' && v >= 0) return v | 0;
    return (G.regionTier[rid] = deriveLock(G, rid));
  };
  /** ev.clearRegion が tier を +1 する前に呼ぶ: 今のティアで固定する（もう書いてあれば変えない） */
  Tier.lockRegion = function (rid, t) {
    const G = R.Game;
    if (!G || !rid) return null;
    if (!G.regionTier || typeof G.regionTier !== 'object') G.regionTier = {};
    if (typeof G.regionTier[rid] !== 'number') G.regionTier[rid] = Math.max(0, (t == null ? Tier.get() : t) | 0);
    return G.regionTier[rid];
  };
  /** 古いセーブ: 解決済みで記録の無い地方をまとめて埋める（R.State.deserialize が呼ぶ） */
  Tier.migrateLocks = function (G) {
    if (!G) return 0;
    if (!G.regionTier || typeof G.regionTier !== 'object' || Array.isArray(G.regionTier)) G.regionTier = {};
    let n = 0;
    for (const rid of Object.keys(R.DB.regions || {})) {
      if (typeof G.regionTier[rid] === 'number' || !isCleared(G, rid)) continue;
      G.regionTier[rid] = deriveLock(G, rid); n++;
    }
    return n;
  };
  /** 出現表のティア: 数のティアの表はその数、地方を解決していれば固定のティア、それ以外は t（既定は全体のティア） */
  Tier.forZone = function (zoneId, t) {
    const cur = t == null ? Tier.get() : t;
    const z = zoneId && R.DB.encounters && (typeof zoneId === 'string' ? R.DB.encounters[zoneId] : zoneId);
    if (!z) return cur;
    if (typeof z.tier === 'number') return z.tier;
    const lk = z.region ? Tier.lockOf(z.region) : null;
    return lk == null ? cur : lk;
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
  function wake(reason, mapId, from) {
    const p = Tier.pending();
    if (p == null || waiting) return;
    if (reason === 'enter') { const m = R.DB.maps[mapId]; if (!m || m.kind !== 'town') return; }
    // 'leave'（町から外へ出た。ロウェルの 2 戦は町の出口で。起こすかは CONTENT-P の Tier.wakeOnLeave(p) が決める）
    if (reason === 'leave' && !(Tier.wakeOnLeave && Tier.wakeOnLeave(p, mapId, from))) return;
    const busy = R.Events && R.Events.busy && R.Events.busy();
    if (busy && armedRun && R.Events.runId && R.Events.runId() === armedRun) return;
    // 走らせる場面: Tier.sceneFor(p)（CONTENT-P。飛ばしたティアも順に走らせる束 story_tiers）。無ければ story_t<p>
    const id = Tier.sceneFor ? Tier.sceneFor(p) : 'story_t' + p;
    if (id === null) { Tier.consumePending(); return; }
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
      R.Events.run(id, { map: mapId || (R.Field.pos || {}).map, reason, tier: p, from: from || null });
    });
  }
  Tier._wake = wake;
  R.onData(function () {
    R.on('inn', (e) => wake('inn', e && e.map));
    R.on('map:enter', (e) => {
      // 町（town）から、町でも屋内でもない所（ワールド・エリア・ダンジョン）へ出た → 'leave'
      const f = e && e.from && R.DB.maps[e.from], m = e && R.DB.maps[e.map];
      if (f && f.kind === 'town' && m && m.kind !== 'town' && m.kind !== 'interior') wake('leave', e.map, e.from);
      else wake('enter', e && e.map);
    });
  });

  // ================================================================ 大灯火の演出（E20）
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const KANJI = ['', R.T('sys.tier.KANJI.1'), R.T('sys.tier.KANJI.2'), R.T('sys.tier.KANJI.3'), R.T('sys.tier.KANJI.4'), R.T('sys.tier.KANJI.5'), R.T('sys.tier.KANJI.6'), R.T('sys.tier.KANJI.7'), R.T('sys.tier.KANJI.8'), R.T('sys.tier.KANJI.9')];

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

  const BEACON_LIFT = 1;   // beacon の物の足もと → 火の籠（マス）
  Tier.BEACON_LIFT = BEACON_LIFT;
  /** 光の柱の場所（マス）: regions の beacon → 今のマップの beacon の物 → 先頭の上 */
  function beaconAt(info) {
    const pos = (R.Field && R.Field.pos) || {};
    const b = info.beacon;
    if (b && b.map === pos.map && b.x != null) return { x: b.x, y: b.y, own: true };
    const m = R.DB.maps[pos.map];
    // 大灯火の物（beacon）は足もとのマスに置く。柱は足もとではなく火の籠に落とす（1 マス上 = 籠の上の段。持ち主「光の柱が物の中心からずれている」2026-10-01）
    for (const o of (m && m.objects) || []) if (o.type === 'prop' && (o.id === 'beacon' || o.beacon === true)) return { x: o.x, y: o.y - BEACON_LIFT, own: true };
    return { x: pos.x || 0, y: (pos.y || 0) - 2, own: false };
  }
  Tier._beaconAt = beaconAt;

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
    R.UIK.text(g, R.T('sys.tier.drawStage.text', { p0: KANJI[st.n] || st.n }), cx, y + U(70), { size: U(15), weight: 700, color: C.text2, align: 'center', track: U(3) });
    R.UIK.text(g, st.title, cx, y + U(96), { size: U(tall ? 26 : 30), weight: 700, align: 'center', grad: [C.goldHi, C.gold, C.goldLo], shadow: 'rgba(236,180,90,0.35)', blur: 10, maxW: w - U(48) });
    R.UIK.rule(g, x + U(56), x + w - U(56), y + U(146), 0.16);
    if (st.page) {
      const line = R.T('sys.tier.drawStage.line', { page: st.page });
      const tw = R.UIK.measure(line, { size: U(13.5) }) + U(24);
      R.UIK.icon(g, 'book', cx - tw / 2, y + U(160), U(17), C.gold);
      R.UIK.text(g, line, cx - tw / 2 + U(24), y + U(160), { size: U(13.5), color: C.text });
    }
    R.UIK.text(g, R.T('sys.tier.drawStage.text_2', { region: st.region }), cx, y + U(186), { size: U(12), color: C.text3, align: 'center' });
    if (ct > 900) R.UIK.prompts(g, [{ btn: 'a', label: R.T('sys.tier.drawStage.0.label') }], { x: x + w - U(20), y: y + h - U(22), align: 'right' });
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
