// EVENTS — ティアと、地方の解決の演出（V2_PLAN §2.5.14・§3.1 の 8〜9・§3.14 の E17・E20、WORLD_REDESIGN §3.4）
//
//   R.Tier.get() → 0〜8               解決した地方の数（R.Game.tier）
//   R.Tier.effective()                 縦切りでは get() と同じ（クリア後の 9 は範囲の外）
//   R.Tier.pending() / consumePending() E17: 地方を解決したときに立つ「次のティアの場面」の番号
//   R.Tier.celebrate(rid) → Promise    大灯火の演出の共通の筋（ev.clearRegion が呼ぶ）:
//       暗転 → R.emit('tier')（R.Sky・FIELD のチャンクがここで引き直す）→ カメラを光の柱へ → 明ける → 光の柱が立つ →
//       章の札（第 N 章・章題・ページ）→ A か 7 秒で閉じる → カメラを先頭へ戻す
//       o.card === false は光の柱だけ（ev.clearRegion がイベントの中で使う）、o.cardOnly は章の札だけ（そのイベントの終わり、
//       締めの「年代記に何を書こう」の後に R.Events が出す。テスター 2026-10-04 R17）
//   足した物: MAX / pick(table, tier) / innPrice(tier?) / scene（場面 id 'celebrate'）
//   地方ごとの出現の固定: forZone(zoneId, t?) → 出現表のティア / lockOf(rid) → 解決した地方の固定ティア|null /
//     lockRegion(rid, t?)（ev.clearRegion）/ migrateLocks(G)（R.State.deserialize）。R.Game.regionTier = {rid: T}
//
// E17（ティアの場面の遅らせ）: 'inn'（ev.inn）と町（map.kind 'town'）の 'map:enter'（Tier.holdOnEnter が真のときは起こさない）、町から外へ出た 'leave'（Tier.wakeOnLeave が真のとき）で pending() があれば、
//   走っているイベントが終わってから story_t<N>（中身は CONTENT-P）を ctx {map, reason:'inn'|'enter'|'leave', tier:N, from} で走らせる。
//   Tier.sceneFor(N) があればその id（CONTENT-P の story_tiers: まだ見ていない T1〜TN を順に。null = もう全部見た → pending を消す）。
//   地方を解決した同じイベントの中の宿・町（締めの演出でフェルンへ戻るなど）では起こさない（次の宿・町で）。
//   story_t<N> がまだ無いときは pending のまま（R.warn を 1 回）。
//
// R.DB.regions[rid]（CONTENT-P）から読む物: name・chapter.title（章題。無ければ name）・page（ページの品。無ければ k_page_<rs>）・
//   beaconAt {map, x, y, src?}（光の柱の場所。src = 光の出どころの形 {kind, dy, w, ground, glow}（下の SRC_KIND）。beacon が {map, x, y} の物でもよい。無ければ今のマップの {type:'prop', id:'beacon'} の物、それも無ければ一行の先頭の上）
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
    // 町に入ってすぐは起こさない場面（ロウェル。CONTENT-P の Tier.holdOnEnter(p)）: 宿に泊まるか、町を出るときまで待つ
    if (reason === 'enter' && Tier.holdOnEnter && Tier.holdOnEnter(p, mapId)) return;
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
    if (b && b.map === pos.map && b.x != null) return { x: b.x, y: b.y, own: true, src: b.src || null };
    const m = R.DB.maps[pos.map];
    // 大灯火の物（beacon）は足もとのマスに置く。柱は足もとではなく火の籠に落とす（1 マス上 = 籠の上の段。持ち主「光の柱が物の中心からずれている」2026-10-01）
    for (const o of (m && m.objects) || []) if (o.type === 'prop' && (o.id === 'beacon' || o.beacon === true)) return { x: o.x, y: o.y - BEACON_LIFT, own: true, src: null };
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
        if (st.pillarOnly) {
          // 光の柱だけ: 立ちきってから A で、押さなければ holdUntil で閉じる
          if (t > st.holdUntil || (t > st.holdUntil - 900 && (I.pressed('a') || (I.pointer && I.pointer.pressed)))) st.close();
          return;
        }
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

  // ---- 光の柱の根元（持ち主 2026-10-03「出元がいかにも上からエフェクトを乗せたみたいに雑。直線で切れている」）
  // 灯す物の形ごとの出どころ（regions の beaconAt.src。無ければ beacon の物 = 火の籠）:
  //   kind = 'fire'（火の籠）| 'lamp'（灯の窓）| 'bell'（鐘）| 'egg'（卵の割れ目）| 'orb'（天球儀の芯）| 'stone'（床の碑の紋）
  //   dy = 柱の落ちる所（マス (x + 0.5, y + 0.8)）から口までのマス（上が −）、w = 物の幅（マス）、
  //   ground = 落ちる所から物の足もとの地面までのマス（光だまりの中心）、glow = 物そのものを照らす光の中心（落ちる所から、マス）
  const SRC_KIND = {
    fire: { flare: [255, 236, 186], ember: [255, 176, 86], flick: 1, pool: 0.5 },   // 火の籠は物の灯りが地面の光だまりを持つので、足すのは半分
    lamp: { flare: [255, 238, 196], ember: [255, 200, 120], flick: 0.6, glowK: 2 },   // 灯の窓は物の照りを強く（窓のガラスが灯る）
    bell: { flare: [255, 244, 214], ember: [255, 226, 150], flick: 0 },
    egg: { flare: [255, 224, 168], ember: [255, 146, 70], flick: 0.7 },
    orb: { flare: [246, 244, 255], ember: [236, 226, 255], flick: 0 },
    stone: { flare: [255, 240, 204], ember: [255, 212, 140], flick: 0 },
  };
  const SRC_FIRE = { kind: 'fire', dy: -0.35, w: 0.9, ground: 0.95, glow: 0.05 };
  Tier.SRC_KIND = SRC_KIND;
  function srcOf(st) {
    const s = Object.assign({}, SRC_FIRE, st.src || {});
    if (!SRC_KIND[s.kind]) s.kind = 'fire';
    if (s.glow == null) s.glow = (s.dy + s.ground) / 2;
    return s;
  }
  /** 柱の 1 段（横の色の帯を y0〜y1 に、幅を wf 倍・濃さ a で）。帯は中心 0 の横のグラデ（作り置き） */
  function slab(g, grad, cx, y0, y1, half, wf, a) {
    if (a <= 0.003 || y1 <= y0) return;
    g.save();
    g.globalAlpha = Math.min(1, a);
    g.translate(cx, 0); g.scale(wf, 1);
    g.fillStyle = grad; g.fillRect(-half, y0, half * 2, y1 - y0);
    g.restore();
  }
  function hgrad(g, half, rgb, a, mid) {
    const gr = g.createLinearGradient(-half, 0, half, 0);
    const c = rgb.join(',');
    gr.addColorStop(0, `rgba(${c},0)`);
    if (mid) { gr.addColorStop(0.5 - mid, `rgba(${c},${(a * 0.45).toFixed(3)})`); gr.addColorStop(0.5 + mid, `rgba(${c},${(a * 0.45).toFixed(3)})`); }
    gr.addColorStop(0.5, `rgba(${c},${a.toFixed(3)})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    return gr;
  }
  function radial(g, x, y, r, sx, sy, stops) {
    g.save(); g.translate(x, y); g.scale(sx, sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

  function drawPillar(g, st, t, rm) {
    const k = Math.max(0, Math.min(1, t / 1600));
    const e = 1 - Math.pow(1 - k, 3);
    const p = screenOf(st.bx, st.by), T = p.t;
    const S = srcOf(st), K = SRC_KIND[S.kind];
    const landY = p.y + T * 0.3;                 // 柱の落ちる所（物の見た目の中心）
    const mouthY = landY + S.dy * T;             // 光の出る口
    const groundY = landY + S.ground * T;        // 物の足もとの地面
    const topY = mouthY - (mouthY + 40) * e;
    // 昼の明るい地面では足し算の光が白く飛ぶので、光だまりと物の照りを少し弱める（R.Light の場面の明るさ）
    const br = R.Light && R.Light.current && R.Light.current.bright != null ? R.Light.current.bright : 0.6;
    const day = sm(0.6, 1, br);
    // ゆらぎ: 火の物は速く細かく、ほかはゆっくり息づく
    const tt = rm ? 0 : t;
    const flick = 1 + K.flick * (0.06 * Math.sin(tt / 61) + 0.05 * Math.sin(tt / 37 + 1.3) + 0.03 * Math.sin(tt / 23 + 2.1));
    const pulse = rm ? 1 : 0.88 + 0.12 * Math.sin(t / 380);
    // 灯る瞬間のふくらみ（立ち上がりの頭で口がいちばん明るい）
    const burst = rm ? 0 : Math.exp(-Math.pow((t - 260) / 320, 2)) * 0.8;
    const wCore = Math.max(3, T * 0.22), wHalo = T * 1.6;
    const fr = K.flare.join(','), er = K.ember;
    g.save();
    g.globalCompositeOperation = 'lighter';

    // 1. 足もとの光だまり（地面の楕円。奥行きに合わせて縦を潰す。物の幅で大きさを変える）
    const pr = T * (1.3 + S.w * 0.55) * (0.55 + 0.45 * e) * (0.97 + 0.03 * flick);
    const pa = (0.7 - 0.3 * day) * (K.pool != null ? K.pool : 1) * e * flick;
    radial(g, p.x, groundY, pr, 1, 0.4, [[0, `rgba(255,226,170,${pa.toFixed(3)})`], [0.35, `rgba(255,196,120,${(pa * 0.5).toFixed(3)})`], [0.7, `rgba(255,170,90,${(pa * 0.16).toFixed(3)})`], [1, 'rgba(255,170,90,0)']]);
    // 広い薄いにじみ（光だまりの外へ柔らかく）
    radial(g, p.x, groundY, pr * 1.9, 1, 0.42, [[0, `rgba(255,210,150,${(pa * 0.22).toFixed(3)})`], [1, 'rgba(255,210,150,0)']]);

    // 2. 物そのものの照り（物の形の上に淡く。縁が光を受けたように）
    const ga = Math.min(0.95, (0.44 - 0.14 * day) * (K.glowK || 1) * Math.min(1, e * 1.6 + burst * 0.5) * flick);
    radial(g, p.x, landY + S.glow * T, T * (0.35 + S.w * 0.55), 1, 1.15, [[0, `rgba(${fr},${ga.toFixed(3)})`], [0.55, `rgba(${fr},${(ga * 0.4).toFixed(3)})`], [1, `rgba(${fr},0)`]]);

    // 3. 柱（横のグラデの帯を段に積む。根元は口へ向かって細く・淡く溶け、少し上でいちばん太く柔らかい。頭も柔らかく）
    if (mouthY - topY > 1) {
      const hh = wHalo, hc = wCore * 2;
      const gH = hgrad(g, hh, [255, 214, 140], 0.22 * pulse, 0.12);
      const gC = hgrad(g, hc, [255, 248, 226], 0.85 * pulse, 0);
      const F = T * 1.7;                        // 根元の溶ける長さ
      const head = Math.min(T * 1.2, (mouthY - topY) * 0.5);
      const yF = Math.max(topY, mouthY - F);    // 溶ける所の上の端
      // 頭と根元の間（まっすぐの所）
      const yH = topY + head;
      if (yF > yH) { slab(g, gH, p.x, yH, yF, hh, 1, e); slab(g, gC, p.x, yH, yF, hc, 1, e); }
      // 頭（立ち上がる先。上へ淡く）
      const step = 1.5;
      for (let y = topY; y < Math.min(yH, yF); y += step) {
        const u = (y - topY) / head;
        slab(g, gH, p.x, y, y + step, hh, 0.8 + 0.2 * u, e * sm(0, 1, u));
        slab(g, gC, p.x, y, y + step, hc, 0.7 + 0.3 * u, e * sm(0, 1, u));
      }
      // 根元（u = 0 が口、1 が溶ける所の上の端）
      for (let y = Math.max(yF, topY); y < mouthY; y += step) {
        const u = (mouthY - y) / F;
        const wf = 0.55 + 0.45 * sm(0, 0.55, u) + 0.28 * Math.sin(Math.min(1, u) * Math.PI) * (1 - u * 0.4);   // 口で細く → 少し上でふくらむ → 柱の幅
        const wc = 0.35 + 0.65 * sm(0, 0.6, u);
        const head2 = topY > yF ? sm(0, 1, (y - topY) / head) : 1;
        slab(g, gH, p.x, y, y + step, hh, wf, e * sm(0, 0.75, u) * head2);
        slab(g, gC, p.x, y, y + step, hc, wc, e * sm(0.04, 0.5, u) * head2);
      }
    }

    // 4. 口の光（白い芯と温かいにじみ、横に少し流れる光の筋）。柱の溶けた根元がここへつながる
    const fa = Math.min(1, (0.75 * e + burst) * flick);
    const fr2 = T * (0.42 + S.w * 0.18);
    radial(g, p.x, mouthY, fr2 * 2.6, 1, 0.9, [[0, `rgba(${fr},${(fa * 0.42).toFixed(3)})`], [0.4, `rgba(255,200,120,${(fa * 0.14).toFixed(3)})`], [1, 'rgba(255,190,110,0)']]);
    radial(g, p.x, mouthY, fr2, 1.15, 0.8, [[0, `rgba(255,255,248,${(fa * 0.95).toFixed(3)})`], [0.35, `rgba(${fr},${(fa * 0.6).toFixed(3)})`], [1, `rgba(${fr},0)`]]);
    radial(g, p.x, mouthY, T * (1.0 + S.w * 0.5), 1, 0.07, [[0, `rgba(255,246,220,${(fa * 0.32).toFixed(3)})`], [1, 'rgba(255,240,210,0)']]);

    // 5. 口から立つ火の粉・光の粒（口の幅から出て、揺れながら昇って消える。根元ほど多い）
    if (e > 0.02) {
      const sp = rm ? 0.2 : 1;
      for (let i = 0; i < 30; i++) {
        const s1 = st.seed[i * 3], s2 = st.seed[i * 3 + 1], s3 = st.seed[i * 3 + 2];
        const near = i < 18;                     // 口のまわりの短い粒 / 柱を昇る長い粒
        const life = near ? 900 + s1 * 900 : 2600 + s1 * 1800;
        const ph = ((t * sp + s2 * life) % life) / life;
        const rise = near ? T * (1.2 + s3 * 1.6) : mouthY - topY;
        const spread = (s3 - 0.5) * T * (near ? S.w * 0.9 : 2.0);
        const px = p.x + spread * (1 - (near ? ph * 0.5 : 0)) + Math.sin(ph * 6.28 * (near ? 1.5 : 1) + s1 * 9) * T * (near ? 0.12 : 0.2);
        const py = mouthY - Math.pow(ph, near ? 0.8 : 1) * rise;
        if (py < topY) continue;
        const a = Math.sin(Math.min(1, ph * 1.15) * Math.PI) * (near ? 0.95 : 0.85) * e;
        const r = near ? 0.6 + s2 * 1.1 : 0.8 + s2 * 1.6;
        const c = near && s1 > 0.35 ? er : [255, 220 + ((s1 * 30) | 0), 150 + ((s3 * 60) | 0)];
        g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
        g.fillRect(Math.round(px - r), Math.round(py - r), Math.ceil(r * 2), Math.ceil(r * 2));
      }
    }
    g.restore();
  }

  function drawStage(g, st) {
    const t = R.Engine.time - st.t0;
    const U = R.UIK.u, T = R.UIK.T, C = T.color;
    const rm = R.UIK.reduceMotion ? R.UIK.reduceMotion() : false;
    // ---- 光の柱（灯す物の口から空へ。0〜1.6 秒で立ち上がる）。札だけの時（cardOnly）は立てない
    if (!st.noPillar) drawPillar(g, st, t, rm);
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
    // o.cardOnly: 章の札だけ（光の柱は立てない。締めの場面の後に、今の画面の上へ。R17）
    if (o.cardOnly) {
      const st = { bx: 0, by: 0, src: null, seed: [], n: (G && G.chapter) || Tier.get() || 1, title: info.title, page: info.pageName, region: info.name, cardAt: 0, cardMs: o.cardMs, noPillar: true };
      let res;
      const closed = new Promise((r) => { res = r; });
      const scene = stageScene(st);
      st.close = () => { if (st.done) return; st.done = true; R.Engine.remove(scene); res(); };
      R.Engine.push(scene);
      try { R.Audio.jingle('chapter'); } catch (e) { /* */ }
      await closed;
      return true;
    }
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
    const st = { bx: b.x, by: b.y, src: b.src || null, seed, n: (G && G.chapter) || Tier.get() || 1, title: info.title, page: info.pageName, region: info.name, cardAt: null, cardMs: o.cardMs };
    let resolveClose;
    const closed = new Promise((res) => { resolveClose = res; });
    const scene = stageScene(st);
    st.close = () => { if (st.done) return; st.done = true; R.Engine.remove(scene); resolveClose(); };
    R.Engine.push(scene);
    try { R.Audio.sfx('lamp'); } catch (e) { /* */ }
    await R.Engine.fadeTo(0, o.fadeMs != null ? o.fadeMs : 900);
    await R.wait(o.pillarMs != null ? o.pillarMs : 1500);
    // o.card === false: 光の柱だけ（章の札はあとで cardOnly で。R17）。柱が立ちきってひと呼吸、A で早く閉じる
    if (o.card === false) {
      st.pillarOnly = true;
      st.holdUntil = R.Engine.time - st.t0 + (o.holdMs != null ? o.holdMs : 1600);
      await closed;
      if (hasField && R.Field.camera && R.Field.camera.follow) { try { await R.Field.camera.follow({ ms: 600 }); } catch (e) { /* */ } }
      return true;
    }
    // 3. 章の札（章のジングル）
    st.cardAt = R.Engine.time - st.t0;
    try { R.Audio.jingle('chapter'); } catch (e) { /* */ }
    await closed;
    if (hasField && R.Field.camera && R.Field.camera.follow) { try { await R.Field.camera.follow({ ms: 600 }); } catch (e) { /* */ } }
    return true;
  };
})(window.RPG);
