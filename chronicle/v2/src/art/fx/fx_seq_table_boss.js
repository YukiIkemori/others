// BSCENE: ボスの必殺技・大技の演出の表（R.BFX.seq.table。キーはボスの行動 eb_* と、ボスの合体技の行 ec_b_*）。
//   持ち主（2026-10-02）「ボスの必殺技、極め技のエフェクト、全部オリジナルのを作っちゃっていいよ。ラスボスとか、重要なボスはオリジナルエフェクト沢山」
//   部品は画像生成で描いた帯（tools/vfx/vfx_parts.json の group 'boss'、assets/fx/<id>.webp）。手続きの層（ring・sparks・glow…）は下に薄く重ねる。
//   ult: 1 の行は必殺技: 始まる前に差し込み（画面が暗くなり、技名の帯、ボスへ寄って揺れる。src/systems/battle/ult_fx.js）。
//   行動への結び付け: R.onData でボスの行動に seq（'sq:<id>'）を足す（データのファイルは道具で移した物なので手で直さない）。
//   置き方の部品（ここで足す）:
//     span  流れの帯（息）を、的から使い手の方へ伸ばして向ける（部品の左の端 = 広がった先を的に。長さは使い手までの距離 × L.k）
//     drop  大きな 1 枚の絵（錨・金床・筆…）が上から落ちて突き立つ（L.land で着く、L.from 落ち始めの高さ px）
(function (R) {
  'use strict';
  const S = R.BFX.seq;
  const PAL = S.PAL;
  const T = S.table;
  const E = S.E;
  const L = (p, t0, t1, at, o) => Object.assign({ p, t0, t1, at: at || 'tgt' }, o || {});
  const H = (p, t1, o) => L(p, 0, t1, (o && o.at) || 'tgt', o);
  // 不透明な部品（マゼンタの地を抜いた岩・根…）と、煙のようにふつうに重ねる部品
  const OVER = /^(re_root_quake|re_thorn_coil|sw_sand_maw|rk_cave_in|iw_anvil|lb_obsidian_burst|pe_paper_storm|sk_sand_wave|ig_avalanche|mb_mist_vortex|mb_mist_breath|lb_ash_storm)$/;
  /** 画像の層（p 'img' | 'span' | 'drop'） */
  // 平たく回る円（地面の紋・渦）は disc（平たくしてから回す。img は回してから平たくする）
  const I = (id, t0, t1, at, o, p) => L(p || (o && o.flat && o.spin ? 'disc' : 'img'), t0, t1, at, Object.assign({ id, blend: OVER.test(id) ? 'source-over' : 'lighter' }, o || {}));
  const IH = (id, t1, o) => I(id, 0, t1, (o && o.at) || 'tgt', o);
  const SPAN = (id, t0, t1, at, o) => I(id, t0, t1, at, o, 'span');
  const DROP = (id, t0, t1, at, o) => I(id, t0, t1, at, o, 'drop');
  const rgb = (a, b, c) => [a, b, c];
  const def = (id, pal, o) => { T[id] = Object.assign({ pal: typeof pal === 'string' ? PAL[pal] : pal, banner: false }, o); };

  // ---------------------------------------------------------------- 置き方の部品
  S.prim('span', (g, u, L0, c, e) => {
    const d = Math.hypot(e.sx, e.sy);
    if (!(d > 20)) return;
    const img = S.prims.img;
    if (img) img(g, u, Object.assign({}, L0, { p: 'img', pxw: Math.max(120, d * (L0.k || 0.92)), rot: (L0.rot || 0) + Math.atan2(e.sy, e.sx) }), c, e);
  });
  S.prim('disc', (g, u, L0, c, e) => {
    const img = S.prims.img;
    if (!img) return;
    // 置き場所のずらし（足もと・dy2）は平たくする前に
    const y = (L0.foot ? ((c.tc.fy - c.tc.y) || 0) / (L0.s || 1) : 0) + (L0.dy2 || 0);
    if (y) g.translate(0, y);
    g.scale(1, L0.flat || 1);
    img(g, u, Object.assign({}, L0, { p: 'img', flat: 1, foot: 0, dy2: 0 }), c, e);
  });
  S.prim('drop', (g, u, L0, c, e) => {
    const I0 = R.BFX.img;
    if (!I0 || !I0.on) return;
    const m = I0.meta(L0.id);
    if (!m) return;
    const land = L0.land || 0.4;
    const k = E.win(u, 0, land);
    const y = -(L0.from || 260) * (1 - E.in(k));
    let a = (L0.a == null ? 1 : L0.a) * E.cl(u / 0.06) * (1 - E.win(u, L0.hold || 0.72, 1));
    if (a <= 0.004) return;
    // 着いた瞬間に少しつぶれて戻る（重さ）
    const sq = u >= land ? 1 - 0.08 * Math.max(0, 1 - (u - land) / 0.08) : 1;
    const s = (L0.px || 200) / (m.h * (m.scale || 0.5) * 0.9 * (L0.s || 1));
    g.save();
    g.translate(0, y);
    if (sq !== 1) g.scale(1 / sq, sq);
    I0.drawFrame(g, L0.id, 0, { s, rot: L0.rot || 0, a });
    g.restore();
  });

  // ================================================================ 序章・森
  def('eb_confetti', rgb('235,205,140', '255,248,225', '150,110,60'), { ult: 1, tier: 5, lead: 560, c: '【紙吹雪】ページ食らいが吸い込んだ紙が、刃の嵐になって全員を切り刻む', main: [
    I('pe_paper_storm', -520, 520, 'tgt', { px: 300, env: 1, fi: 0.2, fo: 0.3 }),
    L('vortex', -420, 420, 'tfoot', { r: 120, n: 30, spin: 7, flat: 0.35, col: '240,220,170' }),
    L('petals', -300, 600, 'tgt', { n: 30, w: 260, h: 160, kind: 'petal', swirl: 1.6, col: '245,235,205', col2: '255,255,245' }),
  ], hit: [IH('slash_multi', 520, { th: 3.1, tint: 0 }), H('sparks', 320, { n: 10, v: 40, len: 8, col: 1 })], shakes: [[0, 5, 380]] });
  def('eb_devour', rgb('170,110,230', '235,215,255', '40,20,70'), { tier: 3, c: '丸かじり: 墨の顎が上下から閉じる', hit: [IH('pe_ink_maw', 560, { th: 3.1 }), H('sparks', 300, { n: 8, v: 30, len: 6, col: 0 })] });
  def('eb_lord_bite', rgb('190,215,255', '250,252,255', '90,120,200'), { tier: 3, c: '頭の牙: 月の光の狼の牙が斜めにかみ合う', main: [L('glow', -200, 160, 'src', { r: 60, a: 0.5, col: 1 })], hit: [IH('wl_moon_fang', 600, { th: 3.1 }), H('ring', 320, { r: 34, w: 2, col: 0 })] });
  def('eb_sleep_dust', rgb('200,180,255', '245,240,255', '120,140,230'), { ult: 1, tier: 5, lead: 520, c: '【眠りのりん粉】光るりん粉の雲が全員を包み、眠りへ誘う', dimCol: '20,14,40', main: [
    I('mo_sleep_dust', -480, 700, 'tgt', { px: 300, env: 1, fi: 0.25, fo: 0.35, a: 0.95 }),
    L('motes', -300, 700, 'tgt', { n: 40, w: 300, h: 200, col: 1 }),
  ], hit: [IH('mo_sleep_dust', 640, { th: 1.6, a: 0.7 }), H('sparks', 300, { n: 6, v: 16, len: 0, star: 1, size: 4, col: 1 })], shakes: [[0, 2, 200]] });
  def('eb_root_quake', rgb('150,200,110', '230,245,200', '90,60,30'), { ult: 1, tier: 5, lead: 560, c: '【根の大地震】もぐった根が前の列の足もとから一斉に突き上げる', main: [
    L('crack', -320, 520, 'tfoot', { n: 8, len: 90, col: '120,90,50' }),
    I('re_root_quake', -120, 700, 'eachfoot', { px: 210, tint: '125,95,60' }),
    L('debris', -80, 600, 'tfoot', { n: 14, v: 90, size: 5 }),
  ], hit: [H('sparks', 300, { n: 10, v: 40, len: 6, col: 0 })], shakes: [[-120, 4, 200], [0, 7, 420]] });
  def('eb_rot_breath', rgb('170,220,90', '235,255,200', '110,60,150'), { tier: 4, lead: 420, c: '腐れの息: 黄緑と紫の胞子の息が、根食らいから全員へ流れる', main: [SPAN('re_rot_breath', -340, 520, 'tgt', { env: 1, fi: 0.15, fo: 0.3 })], hit: [IH('poison_bubbles', 600, { th: 1.4, a: 0.8 })] });
  def('eb_root_drain', rgb('130,230,120', '230,255,220', '60,120,40'), { tier: 3, c: '根で吸う: いばらの根が巻きつき、緑の命の光を吸い上げる', hit: [IH('re_thorn_coil', 700, { th: 2.5 }), H('motes', 600, { n: 12, w: 40, h: 60, col: 0 })] });
  def('ec_b_root_bind', rgb('140,200,100', '235,250,210', '100,60,30'), { tier: 4, lead: 360, c: '合体: 根の締めつけ。突き上がる根といばらが的を締め上げる', main: [I('re_root_quake', -260, 520, 'tfoot', { px: 230, tint: '125,95,60' })], hit: [IH('re_thorn_coil', 700, { th: 2.7 }), H('ring', 320, { r: 40, w: 3, col: 2 })] });
  def('ec_b_lord_pack', rgb('190,215,255', '250,252,255', '120,40,60'), { tier: 4, lead: 320, c: '合体: 群れ頭の号令。月の牙と赤い牙が同じ的へ重なる', main: [L('dash', -260, 60, 'tgt', { n: 8, len: 90, col: 0 })], hit: [IH('wl_moon_fang', 620, { th: 3.4 }), IH('bite_fangs', 420, { th: 1.8, tint: '255,90,100' })] });

  // ================================================================ 砂漠
  def('eb_hawk_storm', rgb('245,200,110', '255,245,215', '170,110,40'), { ult: 1, tier: 5, lead: 540, c: '【砂刃の嵐】砂と刃風の竜巻が全員をのみこむ', dimCol: '30,18,6', main: [
    I('hk_sand_gale', -460, 560, 'tgt', { px: 320, env: 1, fi: 0.2, fo: 0.3 }),
    L('gale', -460, 560, 'scr', { n: 40, kind: 'leaf', col: '230,190,120', a: 0.4, len: 30 }),
  ], hit: [IH('wind_slash', 460, { th: 2.6, tint: '240,200,120' }), H('smoke', 420, { n: 5, r: 14, col: '210,180,130', a: 0.35, blend: 'source-over' })], shakes: [[0, 5, 360]] });
  def('eb_worm_burst', rgb('225,180,110', '255,240,205', '130,90,40'), { ult: 1, tier: 5, lead: 560, c: '【地の底からの一撃】砂の下から大口とともに砂の噴き上げが全員を打ち上げる', main: [
    L('crack', -360, 400, 'tfoot', { n: 6, len: 80, col: '150,110,60' }),
    I('sw_sand_maw', -160, 760, 'tfoot', { px: 300 }),
    L('debris', -60, 600, 'tfoot', { n: 16, v: 110, size: 5 }),
  ], hit: [H('smoke', 420, { n: 6, r: 16, col: '210,180,130', a: 0.35, blend: 'source-over' })], shakes: [[-160, 3, 200], [0, 8, 460]] });
  def('eb_swallow_whole', rgb('225,180,110', '255,240,205', '130,90,40'), { tier: 3, c: 'ひとのみ: 足もとが沈み、砂の噴き上げと大口', hit: [IH('sw_sand_maw', 700, { th: 3.1, foot: 1 }), IH('bite_fangs', 380, { th: 1.6, tint: '230,190,120' })] });
  def('eb_king_judgment', rgb('255,215,120', '255,250,225', '200,140,50'), { ult: 1, tier: 5, lead: 640, c: '【砂の王の裁き】空の呪いの紋から、金の砂の柱が全員へ降りそそぐ', dimCol: '30,20,4', main: [
    I('sk_name_glyphs', -620, 640, 'tgt', { px: 300, flat: 0.32, dy: -150, spin: 0.7, env: 1, fi: 0.2, fo: 0.3, a: 0.9 }),
    I('sk_sand_judgment', -180, 640, 'eachfoot', { px: 260 }),
    L('rays', -200, 500, 'tgt', { n: 12, len: 160, col: 0, a: 0.5 }),
  ], hit: [H('smoke', 460, { n: 6, r: 16, col: '230,200,140', a: 0.35, blend: 'source-over' }), H('sparks', 300, { n: 10, v: 40, len: 6, col: 1 })], shakes: [[-40, 4, 200], [60, 7, 420]] });
  def('eb_king_call', rgb('190,120,255', '240,220,255', '200,150,60'), { tier: 4, lead: 400, c: '名を呼ぶ声: 名を刻まれた者の足もとに呪いの紋が開き、紫の光が噴き上がる', main: [I('sk_name_glyphs', -380, 520, 'eachfoot', { px: 150, flat: 0.34, spin: 1.2, env: 1 })], hit: [IH('dark_spikes', 560, { th: 1.6 }), H('ring', 300, { r: 30, w: 2, col: 0 })] });
  def('eb_king_sand', rgb('235,200,130', '255,245,220', '150,110,60'), { tier: 4, lead: 360, c: '王の砂けむり: 金の砂の波が横から押し寄せる', main: [I('sk_sand_wave', -320, 520, 'tfoot', { pxw: 420, env: 1, fi: 0.2, fo: 0.3 })], hit: [IH('dust_cloud', 520, { th: 1.4 })] });
  def('eb_withering', rgb('170,110,230', '235,215,255', '120,90,40'), { tier: 3, c: '命を枯らす: 呪いの紋が的の上で回り、闇が吸い上げる', hit: [IH('sk_name_glyphs', 640, { px: 110, flat: 0.4, spin: 1.6, env: 1, dy2: -10 }), IH('dark_orb', 520, { th: 1.2 })] });
  def('ec_b_hawk_hunt', rgb('245,200,110', '255,245,215', '170,110,40'), { tier: 4, lead: 320, c: '合体: 鷹の狩り。射止めた的へ砂刃の竜巻', hit: [IH('hk_sand_gale', 680, { th: 3.1 }), IH('slash_x', 420, { th: 2.6, tint: 0 })] });

  // ================================================================ 好敵手 ロウェル
  def('eb_rowell_verdict', rgb('225,235,255', '255,255,255', '110,140,220'), { ult: 1, tier: 5, lead: 620, c: '【記録の裁き】光の銀筆が空から全員の前に突き立ち、白い光が爆ぜる', main: [
    L('runes', -560, 300, 'tfoot', { r: 130, flat: 0.34, sides: 6, rings: 2, glyphs: 18, spin: 0.8, col: 0 }),
    DROP('rw_verdict_quill', -300, 560, 'eachfoot', { px: 170, land: 0.5, from: 300 }),
    L('rays', 0, 520, 'tgt', { n: 12, len: 180, col: 1, a: 0.6 }),
  ], hit: [IH('holy_burst', 560, { th: 1.8 }), H('sparks', 300, { n: 10, v: 40, len: 8, col: 1 })], shakes: [[0, 6, 380]] });
  def('eb_rowell_redact', rgb('230,240,255', '255,255,255', '90,120,210'), { ult: 1, tier: 5, lead: 520, c: '【抹消】銀の光の取り消し線が、注釈を書かれた者たちを横に塗りつぶす', main: [
    I('rw_redact', -300, 520, 'tgt', { pxw: 520, env: 1, fi: 0.1, fo: 0.3 }),
    L('dash', -300, 60, 'tgt', { n: 10, len: 140, col: 1 }),
  ], hit: [IH('rw_redact', 520, { pxw: 160, a: 0.8 }), H('sparks', 300, { n: 8, v: 36, len: 8, col: 0 })], shakes: [[0, 5, 320]] });
  def('eb_pen_flurry', rgb('225,235,255', '255,255,255', '110,140,220'), { tier: 3, c: '連続突き: 銀筆の光の筆先が何度も突く', hit: [IH('thrust_streak', 360, { pxw: 220, rot: Math.PI, tint: 0 }), IH('rw_redact', 380, { pxw: 110, a: 0.6 })] });

  // ================================================================ 雪原
  def('eb_bw_frostfang', rgb('170,225,255', '245,252,255', '80,140,230'), { tier: 3, c: '凍て牙: 氷の結晶の牙が上下から閉じ、雪が散る', hit: [IH('bw_frost_fang', 600, { th: 3 }), H('sparks', 320, { n: 8, v: 30, len: 5, col: 1 })] });
  def('ec_b_siege_hunt', rgb('170,225,255', '245,252,255', '160,40,60'), { tier: 4, lead: 300, c: '合体: 群れの挟み撃ち。赤い牙の後に大狼の凍て牙が食らいつく', main: [L('blades', -260, 200, 'tgt', { n: 6, col: 'ice', len: 22, spread: 60, dist: 120 })], hit: [IH('bw_frost_fang', 640, { th: 3.5 }), IH('ice_shards', 520, { th: 1.8 })] });
  def('eb_ice_hammer', rgb('170,225,255', '245,252,255', '80,140,230'), { tier: 4, lead: 380, c: '氷の大槌: 叩きつけた所に氷の針の穴と霜の波', main: [L('glow', -300, 0, 'src', { r: 70, col: 1, a: 0.5 })], hit: [IH('ig_glacier_hammer', 720, { th: 3.4, foot: 1 }), H('ring', 380, { r: 60, flat: 0.34, w: 3, at: 'tfoot', col: 1 })], shakes: [[0, 5, 300]] });
  def('eb_avalanche_drop', rgb('230,240,255', '255,255,255', '120,160,220'), { ult: 1, tier: 5, lead: 560, c: '【雪崩落とし】巨人が崩した雪の壁が、氷の塊ごと全員の上へなだれ落ちる', main: [
    I('ig_avalanche', -420, 640, 'tgt', { px: 330, dy: -30, env: 1, fi: 0.15, fo: 0.3 }),
    L('smoke', -100, 600, 'tfoot', { n: 10, r: 26, col: '235,240,250', a: 0.4, blend: 'source-over' }),
  ], hit: [IH('ice_shards', 520, { th: 1.7 })], shakes: [[-200, 3, 300], [0, 7, 460]] });
  def('eb_glacier_fall', rgb('170,225,255', '245,252,255', '70,120,220'), { ult: 1, tier: 5, lead: 600, c: '【氷河落とし】白竜が呼んだ巨大な氷の槍が空から突き落ちる', dimCol: '6,14,30', main: [
    L('sky', -560, 600, 'scr', { top: '30,60,120', bot: '170,220,255', a: 0.45 }),
    I('wd_glacier_fall', -240, 640, 'tfoot', { px: 330 }),
    L('ring', 0, 500, 'tfoot', { r: 120, flat: 0.34, w: 4, n: 2, col: 1 }),
  ], hit: [IH('ice_shards', 560, { th: 2.9 }), H('sparks', 320, { n: 12, v: 50, len: 6, col: 1 })], shakes: [[0, 8, 460]] });
  def('eb_white_blizzard', rgb('190,230,255', '250,252,255', '90,140,230'), { tier: 4, lead: 420, c: '白い吹雪: 白竜の口から吹雪の息が流れ、全員を凍らせる', main: [
    SPAN('wd_blizzard_breath', -360, 560, 'tgt', { env: 1, fi: 0.15, fo: 0.3 }),
    L('gale', -300, 560, 'scr', { n: 50, kind: 'snow', col: '240,248,255', a: 0.5, len: 20 }),
  ], hit: [IH('ice_crystal', 640, { px: 120 })] });
  def('eb_ice_claw', rgb('170,225,255', '245,252,255', '80,140,230'), { tier: 3, c: '氷の爪: 氷の三本の爪が斜めに裂く', hit: [IH('wd_ice_claw', 560, { th: 3.1 }), H('sparks', 300, { n: 8, v: 30, len: 6, col: 1 })] });
  def('eb_admiral_cannon', rgb('170,225,255', '245,252,255', '70,110,200'), { ult: 1, tier: 5, lead: 560, c: '【氷の一斉砲撃】凍った砲弾が全員の前で炸裂し、つららの破片が飛ぶ', main: [
    L('shots', -460, -20, 'each', { kind: 'orb', n: 1, size: 1.4, fly: 1, arc: 40, col: 1 }),
    I('fa_ice_cannon', 0, 640, 'each', { th: 2.6 }),
  ], hit: [IH('ice_shards', 480, { th: 1.5 })], shakes: [[0, 6, 380]] });
  def('ec_b_admiral_volley', rgb('170,225,255', '245,252,255', '70,110,200'), { tier: 4, lead: 300, c: '合体: 氷の一斉射。つららの後に、凍った砲弾が的で炸裂', hit: [IH('fa_ice_cannon', 640, { th: 3.1 }), IH('slash_x', 420, { th: 2.5, tint: 0 })] });

  // ================================================================ 湿原
  def('eb_doll_waltz', rgb('255,120,150', '255,235,240', '210,160,60'), { ult: 1, tier: 5, lead: 480, c: '【死の円舞】紅と金のリボンの刃が円を描いて舞い、次々に切りつける', main: [
    I('dl_waltz_ribbons', -440, 300, 'tgt', { px: 300, flat: 0.6, env: 1, spin: 1.5 }),
    L('petals', -300, 500, 'tgt', { n: 24, w: 200, h: 140, kind: 'petal', swirl: 1.4, col: 0 }),
  ], hit: [IH('dl_waltz_ribbons', 520, { th: 1.6, a: 0.9 }), IH('slash_arc_a', 360, { th: 1.8, tint: 0 })], shakes: [[0, 3, 240]] });
  def('ec_b_doll_trio', rgb('255,120,150', '255,235,240', '210,160,60'), { tier: 4, lead: 320, c: '合体: 人形の三重奏。太鼓・弦の後に、リボンの刃の輪', hit: [IH('dl_waltz_ribbons', 640, { th: 2.9 }), H('ring', 360, { r: 40, w: 3, n: 3, col: 1 })] });
  def('eb_mist_hand', rgb('210,225,230', '250,255,255', '80,170,170'), { tier: 3, c: '霧の手: 濃い霧の渦が的を包む', hit: [IH('mb_mist_vortex', 700, { th: 2.9, a: 0.85 }), H('motes', 500, { n: 10, w: 40, h: 50, col: 2 })] });
  def('eb_witch_mimic', rgb('150,240,140', '230,255,220', '140,70,200'), { tier: 4, lead: 400, c: '魔女のまね: 緑の呪いの紋と鬼火が全員の上で燃える', main: [L('runes', -360, 300, 'srcfoot', { r: 80, flat: 0.34, col: 0, spin: -1 })], hit: [IH('mb_witch_curse', 680, { th: 2.6 })] });
  def('eb_mist_breath', rgb('220,230,235', '255,255,255', '90,170,170'), { tier: 4, lead: 400, c: '白い霧の息: 重い霧の息が流れて全員の目をくらます', main: [SPAN('mb_mist_breath', -340, 560, 'tgt', { env: 1, fi: 0.15, fo: 0.3, a: 0.9 })], hit: [IH('smoke_puff', 520, { th: 1.4, a: 0.6 })] });
  def('ec_b_mist_embrace', rgb('150,240,200', '240,255,250', '120,70,200'), { tier: 4, lead: 360, c: '合体: 霧の抱擁。分身の冷たい手の後、霧の渦と魔女の火が的を包む', main: [I('mb_mist_vortex', -300, 600, 'tgt', { px: 260, a: 0.85 })], hit: [IH('mb_witch_curse', 680, { th: 2.9 })] });

  // ================================================================ 群島
  def('eb_whirl', rgb('80,170,200', '215,245,255', '60,30,110'), { tier: 4, lead: 380, c: '渦: 墨の混じった深い海の渦が全員の足もとで回る', main: [I('oc_whirlpool_ink', -320, 600, 'tfoot', { px: 300, flat: 0.42, env: 1, fi: 0.2, fo: 0.3 })], hit: [IH('water_splash', 520, { th: 1.6, foot: 1 })] });
  def('ec_b_octo_squeeze', rgb('80,170,200', '215,245,255', '60,30,110'), { tier: 4, lead: 340, c: '合体: 締め上げ。墨の渦が的を巻き込み、足が締めつける', main: [I('oc_whirlpool_ink', -280, 600, 'tfoot', { px: 240, flat: 0.45, env: 1 })], hit: [IH('pe_ink_maw', 560, { th: 2.9 }), H('ring', 320, { r: 36, w: 3, n: 2, col: 0 })] });
  def('eb_captain_barrage', rgb('120,255,190', '230,255,240', '40,140,110'), { ult: 1, tier: 5, lead: 520, c: '【亡霊艦隊の砲撃】亡霊の砲弾の雨。緑の鬼火の爆ぜが次々に上がる', dimCol: '4,20,16', main: [
    L('rain', -420, 200, 'tfoot', { n: 10, w: 300, h: 360, kind: 'orb', slant: 0.4, trail: 40, life: 0.4, col: 0 }),
    I('cp_ghost_cannon', -60, 640, 'tgt', { px: 220 }),
  ], hit: [IH('cp_ghost_cannon', 600, { th: 2.6 }), H('smoke', 420, { n: 5, r: 14, col: '170,210,190', a: 0.3, blend: 'source-over' })], shakes: [[0, 5, 300]] });
  def('eb_fire_volley', rgb('120,255,190', '230,255,240', '40,140,110'), { tier: 4, lead: 380, c: '一斉砲撃: 全員の前で亡霊の火が一斉に爆ぜる', main: [L('shots', -360, -20, 'each', { kind: 'orb', n: 1, fly: 1, arc: 50, col: 0 })], hit: [IH('cp_ghost_cannon', 620, { th: 2.9 })] });
  def('eb_anchor_throw', rgb('120,255,190', '230,255,240', '40,140,110'), { tier: 4, lead: 460, c: 'いかり投げ: 亡霊の錨が空から落ちて突き刺さる', main: [DROP('cp_anchor', -420, 420, 'tfoot', { px: 210, land: 0.55, from: 320 })], hit: [IH('cp_ghost_cannon', 520, { th: 1.6, a: 0.8 }), H('ring', 360, { r: 60, flat: 0.34, w: 3, at: 'tfoot', col: 0 })], shakes: [[0, 6, 320]] });
  def('eb_cutlass', rgb('120,255,190', '230,255,240', '40,140,110'), { tier: 3, c: '亡霊のカトラス: 緑の三日月が X に交わる', hit: [IH('cp_cutlass', 600, { th: 3.2 }), H('sparks', 300, { n: 8, v: 30, len: 6, col: 1 })] });
  def('eb_ghost_shanty', rgb('140,240,220', '235,255,250', '80,120,230'), { tier: 4, lead: 360, c: '亡霊の舟歌: 鬼火の輪がゆっくり回り、眠りへ誘う', main: [I('cp_ghost_wisps', -340, 700, 'tgt', { px: 260, flat: 0.7, env: 1, fi: 0.25, fo: 0.3 })], hit: [IH('sparkle_twinkle', 520, { th: 1.4, tint: 0 })] });
  def('ec_b_captain_boarding', rgb('120,255,190', '230,255,240', '40,140,110'), { tier: 4, lead: 320, c: '合体: 斬りこみの号令。組みついた所へ亡霊のカトラスの X', hit: [IH('cp_cutlass', 660, { th: 3.6 }), IH('cp_ghost_cannon', 520, { th: 1.6, a: 0.7 })] });

  // ================================================================ 鉱山
  def('eb_cave_in', rgb('210,180,140', '255,240,215', '110,90,70'), { ult: 1, tier: 5, lead: 520, c: '【大落盤】天井が崩れ、岩の雨が全員に降りそそぐ', main: [
    L('crack', -460, 0, 'sky', { n: 6, len: 120, col: '120,100,80' }),
    I('rk_cave_in', -260, 600, 'each', { th: 2.6, dy: -20 }),
    L('smoke', 0, 600, 'tfoot', { n: 10, r: 24, col: '190,170,150', a: 0.4, blend: 'source-over' }),
  ], hit: [H('sparks', 300, { n: 8, v: 30, len: 4, col: 0 })], shakes: [[-200, 3, 300], [0, 7, 460]] });
  def('eb_anvil_drop', rgb('255,150,70', '255,235,200', '120,60,40'), { ult: 1, tier: 5, lead: 600, c: '【金床落とし】赤く焼けた金床が真上から落ち、火花と衝撃の輪', main: [
    L('glow', -560, -100, 'tgt', { r: 80, col: 0, a: 0.4, dy: -120 }),
    DROP('iw_anvil', -420, 480, 'tfoot', { px: 150, land: 0.5, from: 340 }),
    L('ring', 0, 460, 'tfoot', { r: 110, flat: 0.34, w: 4, n: 2, col: 0 }),
  ], hit: [IH('iw_slag_burst', 560, { th: 1.8 }), H('sparks', 360, { n: 16, v: 60, len: 8, col: 1, grav: 120 })], shakes: [[0, 8, 420]] });
  def('eb_forge_breath', rgb('255,170,80', '255,240,200', '200,70,20'), { tier: 4, lead: 400, c: '炉の息: 白く焼けた炉の炎が全員へ吹きつける', main: [SPAN('iw_forge_breath', -340, 520, 'tgt', { env: 1, fi: 0.15, fo: 0.3 })], hit: [IH('fire_burst', 520, { th: 1.6 })] });
  def('eb_warden_slag', rgb('255,170,80', '255,240,200', '200,70,20'), { tier: 3, c: '鉄くず散らし: 溶けた鉄のしぶきが飛び散る', hit: [IH('iw_slag_burst', 600, { th: 2.9 }), H('sparks', 320, { n: 10, v: 50, len: 6, col: 1, grav: 120 })] });
  def('eb_vein_storm', rgb('120,240,230', '235,255,255', '170,90,230'), { ult: 1, tier: 5, lead: 520, c: '【結晶の嵐】青緑と紫の結晶の刃が全員の周りで渦を巻く', main: [
    I('vl_crystal_storm', -420, 600, 'tgt', { px: 320, env: 1, fi: 0.2, fo: 0.3 }),
    L('shards', -200, 500, 'tgt', { n: 16, r: 120, size: 7, col: 0 }),
  ], hit: [IH('ice_shards', 480, { th: 1.6, tint: 0 })], shakes: [[0, 5, 360]] });
  def('ec_b_vein_resonance', rgb('120,240,230', '235,255,255', '170,90,230'), { tier: 4, lead: 320, c: '合体: 結晶の共鳴。照り返しの光の後、結晶の嵐が的で爆ぜる', hit: [IH('vl_crystal_storm', 680, { th: 3.1 }), H('rays', 360, { n: 8, len: 60, col: 1 })] });

  // ================================================================ 灰の地方
  def('eb_tamer_whip', rgb('255,160,70', '255,235,190', '200,70,30'), { tier: 3, c: '獣使いの鞭: 炎の鞭がしなって鳴る', hit: [IH('at_whip_crack', 520, { th: 2.9 }), H('sparks', 300, { n: 8, v: 36, len: 6, col: 1 })] });
  def('ec_b_tamer_charge', rgb('255,160,70', '255,235,190', '150,100,60'), { tier: 4, lead: 320, c: '合体: 鞭と突進。炎の鞭の合図で岩の獣がぶつかる', hit: [IH('at_whip_crack', 520, { th: 2.6 }), IH('rock_eruption', 600, { th: 2.6, foot: 1 }), H('ring', 340, { r: 50, flat: 0.4, w: 3, col: 0 })] });
  def('eb_sumi_ember', rgb('255,120,60', '255,235,170', '200,40,30'), { tier: 3, c: '火の粉: 紅と金の二筋の火が全員の上でより合う', hit: [IH('as_twin_flame', 600, { th: 2.5 })] });
  def('ec_b_sister_flames', rgb('255,110,60', '255,235,170', '230,150,40'), { tier: 4, lead: 360, c: '合体: 姉妹の連なる火。紅と金の二筋の火柱が螺旋になって的を焼く', main: [L('flames', -260, 400, 'tfoot', { n: 12, w: 40, h: 60, size: 8 })], hit: [IH('as_twin_flame', 680, { th: 3.4 }), IH('fire_burst', 480, { th: 1.6 })] });
  def('eb_barga_bash', rgb('210,215,230', '255,255,255', '120,130,160'), { ult: 1, tier: 5, lead: 520, c: '【鉄壁崩し】鉄鎧のバルガが大盾ごと突っこみ、鉄の衝撃の輪と気絶の星', main: [L('dash', -420, 40, 'tgt', { n: 10, len: 120, col: 0 }), L('glow', -480, -60, 'src', { r: 70, col: 1, a: 0.5 })], shakes: [[0, 6, 360]], hit: [IH('ab_shield_bash', 620, { th: 3.4 }), H('ring', 400, { r: 60, w: 4, n: 2, col: 0 }), H('sparks', 520, { n: 5, v: 22, star: 1, size: 5, len: 0, ang: -1.57, spread: 2.5, grav: -20, col: 1 })] });
  def('eb_zakuro_iai', rgb('255,90,100', '255,235,235', '150,20,40'), { ult: 1, tier: 5, lead: 620, c: '【居合・柘榴】静けさの後、画面を横に割る白い一線と、紅の花びらが散る', dimCol: '20,0,6', main: [
    L('cut', -560, -420, 'src', { n: 1, len: 40, ang: -1.4, w: 2, col: 1 }),
    I('zk_iai_flash', -80, 560, 'tgt', { pxw: 620 }),
    L('petals', 0, 700, 'tgt', { n: 30, w: 220, h: 120, kind: 'petal', swirl: 1.2, col: 0 }),
  ], hit: [H('sparks', 380, { n: 14, v: 60, len: 10, col: 0 }), IH('slash_line', 360, { pxw: 200, flat: 2, tint: 1 })], shakes: [[0, 6, 300]] });
  def('eb_lava_breath', rgb('255,140,50', '255,235,170', '170,30,10'), { ult: 1, tier: 5, lead: 520, c: '【獄炎の息】番犬の口から溶岩の奔流が全員へ流れ、地面が燃える', dimCol: '24,4,0', main: [
    SPAN('hh_lava_breath', -360, 560, 'tgt', { env: 1, fi: 0.15, fo: 0.3 }),
    I('fire_ground', -60, 640, 'eachfoot', { px: 90, env: 1 }),
  ], hit: [IH('fire_burst', 520, { th: 1.6 })], shakes: [[0, 4, 360]] });
  def('eb_eruption', rgb('255,140,50', '255,235,170', '170,30,10'), { ult: 1, tier: 5, lead: 600, c: '【大噴火】巨獣の背の火口から火柱が噴き上がり、溶岩の弾が降りそそぐ', dimCol: '24,4,0', main: [
    I('lb_eruption', -560, 200, 'srcfoot', { px: 300 }),
    L('meteor', -160, 260, 'tfoot', { n: 3, size: 0.8 }),
    L('rain', -200, 300, 'tfoot', { n: 10, w: 300, h: 380, kind: 'orb', slant: -0.3, trail: 50, life: 0.35, col: 0 }),
  ], hit: [IH('fire_burst', 600, { th: 2.6 }), IH('lb_obsidian_burst', 520, { th: 1.4 })], shakes: [[-500, 4, 400], [0, 6, 360]] });
  def('eb_lava_wave', rgb('255,140,50', '255,235,170', '170,30,10'), { tier: 4, lead: 400, c: '溶岩の波: 横から溶岩の大波が押し寄せる', main: [I('lb_lava_wave', -340, 560, 'tfoot', { pxw: 460 })], hit: [IH('fire_burst', 500, { th: 1.4 })], shakes: [[0, 4, 300]] });
  def('eb_obsidian_crush', rgb('255,140,50', '255,220,170', '40,30,40'), { tier: 4, lead: 380, c: '黒曜の拳: 黒曜石のかけらと溶岩のひびが爆ぜる', hit: [IH('lb_obsidian_burst', 640, { th: 3.1 }), H('ring', 360, { r: 50, flat: 0.34, w: 3, at: 'tfoot', col: 0 })], shakes: [[0, 6, 320]] });
  def('eb_ash_storm', rgb('200,190,180', '255,240,220', '255,120,40'), { tier: 4, lead: 380, c: '灰の嵐: 燃えさしの混じった灰の渦が全員をくらます', main: [I('lb_ash_storm', -320, 620, 'tgt', { px: 320, env: 1, fi: 0.2, fo: 0.3, a: 0.9 })], hit: [H('sparks', 300, { n: 8, v: 26, len: 4, col: 2 })] });
  def('eb_magma_fist', rgb('255,150,60', '255,235,170', '170,40,10'), { tier: 3, c: '溶岩の拳: 溶けた岩のしぶきと火の爆ぜ', hit: [IH('iw_slag_burst', 560, { th: 2.6 }), IH('fire_burst', 480, { th: 1.5 })] });

  // ================================================================ 星の地方
  def('eb_orrery_eclipse', rgb('255,220,140', '255,255,240', '40,30,70'), { ult: 1, tier: 5, lead: 600, c: '【皆既日食】空の太陽が黒い円に隠れ、白い光の冠が全員を焼く', dimCol: '4,2,14', dim: 0.62, main: [
    I('or_eclipse', -560, 640, 'tgt', { px: 300, dy: -110 }),
    L('rays', -100, 560, 'tgt', { n: 14, len: 200, col: 1, a: 0.5, dy: -110 }),
  ], hit: [IH('holy_burst', 520, { th: 1.6 })], shakes: [[0, 5, 360]] });
  def('eb_orrery_reverse', rgb('255,220,140', '255,255,240', '140,120,220'), { tier: 4, lead: 420, c: '逆回り: 天球の軌道の輪が逆に回り、昼と夜が入れ替わる', main: [I('or_orbit_rings', -380, 600, 'src', { px: 260, flat: 0.5, spin: -2.2, env: 1 })], hit: [IH('sparkle_twinkle', 480, { th: 1.4, tint: 1 })] });
  def('eb_sun_orb', rgb('255,170,80', '255,240,200', '220,90,30'), { tier: 3, c: '太陽の球: 軌道の輪から太陽の球が飛ぶ', main: [I('or_orbit_rings', -260, 200, 'src', { px: 180, flat: 0.5, spin: 1.6, env: 1, a: 0.8 })], hit: [IH('fireball', 360, { th: 1.6 }), IH('fire_burst', 520, { th: 1.8 })] });
  def('eb_moon_orb', rgb('170,200,255', '240,248,255', '90,110,220'), { tier: 3, c: '月の球: 軌道の輪から月の光が降りる', main: [I('or_orbit_rings', -260, 200, 'src', { px: 180, flat: 0.5, spin: -1.6, env: 1, a: 0.8 })], hit: [IH('water_splash', 520, { th: 1.6 })] });
  def('eb_star_orb', rgb('255,240,170', '255,255,240', '200,160,80'), { tier: 3, c: '星の球: 軌道の輪から流れ星', main: [I('or_orbit_rings', -260, 200, 'src', { px: 180, flat: 0.5, spin: 2.4, env: 1, a: 0.8 })], hit: [IH('se_starfall', 560, { th: 1.8 })] });
  def('eb_dark_nova', rgb('170,100,255', '240,215,255', '40,20,90'), { ult: 1, tier: 5, lead: 600, c: '【闇の新星】虚空がしぼんで、紫と黒の新星が全員の真ん中で爆ぜる', dimCol: '6,0,16', main: [
    L('void', -560, -40, 'tgt', { r: 40, n: 20 }),
    I('se_dark_nova', -200, 640, 'tgt', { px: 300 }),
    L('ring', 0, 520, 'tgt', { r: 160, w: 4, n: 2, col: 1 }),
  ], hit: [H('sparks', 320, { n: 10, v: 40, len: 6, col: 1 })], shakes: [[0, 7, 420]] });
  def('eb_star_devour', rgb('170,120,255', '255,235,180', '30,20,80'), { tier: 4, lead: 400, c: '名を食む: 的の上に開いた黒い穴が、星の光ごと吸い込む', main: [I('se_star_devour', -340, 600, 'tgt', { px: 230, env: 1 })], hit: [IH('sparkle_twinkle', 480, { th: 1.3, tint: 1 })] });
  def('eb_swallow_star', rgb('170,120,255', '255,235,180', '30,20,80'), { tier: 4, lead: 400, c: '星を飲む: 星食らいの口に黒い穴が開き、星の流れを飲み込む', ally: 1, main: [I('se_star_devour', -340, 640, 'src', { px: 260, env: 1 })], hit: [IH('sparkle_twinkle', 480, { th: 1.3, tint: 1 })] });
  def('eb_star_spit', rgb('255,235,160', '255,255,240', '200,150,70'), { tier: 4, lead: 360, c: '星くず吐き: 流れ星の雨が次々に降る', main: [I('se_starfall', -300, 500, 'tgt', { px: 320 })], hit: [IH('holy_burst', 420, { th: 1.2 })] });
  def('eb_void_fang', rgb('170,100,255', '240,215,255', '30,10,60'), { tier: 3, c: '虚空の牙: 星の入った黒い牙が上下から閉じる', hit: [IH('se_void_fang', 600, { th: 3.1 }), H('sparks', 300, { n: 8, v: 30, len: 5, col: 1 })] });
  def('eb_star_night', rgb('140,100,230', '230,220,255', '10,6,30'), { tier: 4, lead: 420, c: '星を消す夜: 空の星が黒い穴へ吸われ、夜が降りる', dim: 0.55, dimCol: '2,0,10', main: [I('se_star_devour', -380, 640, 'tgt', { px: 320, dy: -120, env: 1, a: 0.9 })], hit: [IH('debuff_smoke', 520, { th: 1.4 })] });

  // ================================================================ 終盤（白の大書庫）
  def('eb_tome_slam', rgb('255,225,150', '255,250,230', '160,110,60'), { tier: 4, lead: 400, c: '大書の一撃: 巨大な本が叩きつけられ、ページと光の輪が吹き飛ぶ', hit: [IH('bg_tome_slam', 700, { th: 3.4, foot: 1 }), H('ring', 380, { r: 60, flat: 0.34, w: 3, at: 'tfoot', col: 0 })], shakes: [[0, 6, 320]] });
  def('eb_page_blizzard', rgb('255,235,180', '255,250,235', '170,120,60'), { ult: 1, tier: 5, lead: 520, c: '【紙吹雪の嵐】本の巨人の体からほどけたページが、刃の嵐になって舞う', main: [
    I('pe_paper_storm', -460, 600, 'tgt', { px: 300, env: 1, fi: 0.2, fo: 0.3 }),
    I('bg_tome_slam', -100, 600, 'tfoot', { px: 220, a: 0.8 }),
  ], hit: [IH('slash_multi', 480, { th: 2.6, tint: 0 })], shakes: [[0, 5, 320]] });
  def('eb_shade_crest', rgb('255,215,120', '255,250,225', '80,40,140'), { tier: 4, lead: 460, c: '紋章の剣: 金の紋をつけた影の大剣が空から突き立つ', main: [DROP('hs_shade_sword', -420, 460, 'tfoot', { px: 230, land: 0.55, from: 320 })], hit: [IH('holy_burst', 520, { th: 1.6 }), H('ring', 340, { r: 50, flat: 0.34, w: 3, at: 'tfoot', col: 0 })], shakes: [[0, 5, 300]] });
  def('ec_b_three_heroes', rgb('255,215,120', '255,255,255', '140,80,230'), { tier: 5, lead: 640, c: '合体: 三英雄の再演。金・白・紫の三筋の光が一つに集まり、影の大剣が落ちる', main: [
    I('hs_trinity_burst', -260, 600, 'tgt', { px: 280 }),
    DROP('hs_shade_sword', -560, 300, 'tfoot', { px: 240, land: 0.6, from: 340 }),
  ], hit: [IH('slash_x', 520, { th: 3.1, tint: 1 }), H('sparks', 360, { n: 14, v: 50, len: 8, col: 0 })], shakes: [[0, 7, 400]] });
  def('eb_silver_quill', rgb('225,235,255', '255,255,255', '60,90,200'), { tier: 3, c: '銀の筆: 光る銀の墨の筆の線が斜めに走る', hit: [IH('lz_quill_strokes', 600, { th: 3.1 }), H('sparks', 300, { n: 8, v: 30, len: 6, col: 1 })] });
  def('eb_lazaro_redact', rgb('245,245,255', '255,255,255', '120,120,170'), { ult: 1, tier: 5, lead: 620, c: '【削除】白い光の波が赤字の者たちを消しゴムのように拭い去る', dimCol: '10,10,20', main: [
    I('lz_erasure', -300, 640, 'tgt', { px: 310, flat: 0.8 }),
    L('flash', -20, 300, 'scr', { a: 0.3, col: '255,255,255' }),
  ], hit: [IH('rw_redact', 480, { pxw: 140, a: 0.8 })], shakes: [[0, 5, 360]] });
  def('eb_lazaro_rewrite', rgb('225,235,255', '255,255,255', '200,60,60'), { ult: 1, tier: 5, lead: 520, ally: 1, c: '【書き換え】大書記の周りを銀の筆の線と赤字が回り、己の物語を書き換える', main: [
    L('runes', -500, 400, 'srcfoot', { r: 110, flat: 0.34, sides: 7, rings: 3, glyphs: 24, spin: 1.2, col: 0 }),
    I('lz_quill_strokes', -300, 400, 'src', { px: 260, spin: 2 }),
    I('lz_erasure', -100, 500, 'src', { px: 260, a: 0.7 }),
  ], hit: [IH('aura_rise', 600, { th: 1.4, tint: 2 })] });
  def('ec_b_lazaro_scribes', rgb('225,235,255', '255,255,255', '60,90,200'), { tier: 4, lead: 320, c: '合体: 写しの赤字。墨で汚された的に銀の筆の線が何重にも走る', hit: [IH('lz_quill_strokes', 640, { th: 3.4 }), IH('lz_quill_strokes', 560, { th: 2.6, mx: 1, a: 0.7 })] });

  // ================================================================ 虚ろの王（ラスボスの第一形態）
  def('eb_blank_storm', rgb('235,235,250', '255,255,255', '150,150,200'), { tier: 4, lead: 420, c: '白い嵐: 白紙のページの竜巻が切り刻む', main: [I('n1_blank_storm', -360, 560, 'tgt', { px: 280, env: 1, fi: 0.2, fo: 0.3 })], hit: [IH('slash_multi', 460, { th: 1.8, tint: 1 })], shakes: [[0, 4, 300]] });
  def('eb_whiteout', rgb('240,235,255', '255,255,255', '170,160,220'), { ult: 1, tier: 5, lead: 620, c: '【白紙に還す】虚ろの王の白い光がふくらみ、全てを白紙へ戻す光の丸屋根が広がる', dim: 0.2, dimCol: '40,36,60', flashCol: '255,255,255', main: [
    I('n1_whiteout', -460, 700, 'tgt', { px: 340 }),
    L('flash', 0, 520, 'scr', { a: 0.42, col: '255,255,255' }),
  ], hit: [IH('n1_oblivion_wave', 520, { th: 1.4, flat: 0.6 })], shakes: [[0, 6, 420]] });
  def('eb_oblivion_wave', rgb('210,200,255', '255,255,255', '140,130,210'), { tier: 4, lead: 400, c: '忘却の波: 銀とすみれ色の波紋が全員の足もとに広がる', main: [I('n1_oblivion_wave', -300, 640, 'tfoot', { px: 300, flat: 0.5 })], hit: [IH('sparkle_twinkle', 480, { th: 1.3, tint: 1 })] });
  def('eb_paper_hand', rgb('235,235,250', '255,255,255', '150,150,200'), { tier: 3, c: '紙の手: 白い紙の渦がつかみ、打ちつける', hit: [IH('n1_blank_storm', 600, { th: 2.6 }), IH('impact_flash', 360, { th: 1.8, tint: 1 })] });
  def('eb_erase_name', rgb('240,240,255', '255,255,255', '130,130,190'), { tier: 3, c: '名を消す: 白い光の取り消し線が名を塗りつぶす', hit: [IH('rw_redact', 600, { pxw: 200 })] });
  def('eb_nemrea_lull', rgb('225,220,255', '255,255,255', '150,140,210'), { tier: 4, lead: 460, lines: false, c: '白い子守歌: 白紙のページが木の葉のように揺れて舞い降り、すみれ色のかすみと三日月の光の中で全員を眠りへ誘う', dimCol: '18,14,40', dim: 0.4, main: [
    I('n1_lullaby_pages', -460, 760, 'tgt', { px: 340, env: 1, fi: 0.2, fo: 0.35 }),
    L('motes', -300, 760, 'tgt', { n: 30, w: 320, h: 220, col: 1 }),
  ], hit: [IH('n1_lullaby_pages', 640, { th: 1.3, env: 1, a: 0.6 }), H('sparks', 360, { n: 6, v: 14, len: 0, star: 1, size: 4, col: 2 })] });
  def('eb_nemrea_snatch', rgb('240,240,255', '255,255,255', '255,205,110'), { tier: 3, lead: 320, c: '名を拾う: 白紙の帯が的に巻きついて金の名札の光をさらい、虚ろの王の手もとへ引き戻す', main: [
    L('stream', 60, 640, 'tgt', { n: 26, rev: 0, col: 2, col2: 1, curve: 70 }),
  ], hit: [IH('n1_paper_snatch', 660, { th: 3.6 }), H('sparks', 320, { n: 8, v: 30, len: 6, col: 2 })], shakes: [[0, 3, 220]] });

  // ================================================================ ネムレア（ラスボス）
  def('eb_nemrea2_close', rgb('255,230,160', '255,255,245', '170,120,230'), { ult: 1, tier: 6, lead: 760, bars: true, c: '【物語を閉じる】終わりの魔法陣が空に開き、光の大きな本が全員の上で閉じる', dimCol: '6,2,16', dim: 0.66, main: [
    I('n2_end_sigil', -720, 900, 'tgt', { px: 340, flat: 0.34, dy: -140, spin: 0.5, env: 1, fi: 0.15, fo: 0.3 }),
    L('sky', -720, 900, 'scr', { top: '40,20,80', bot: '255,210,150', a: 0.4 }),
    I('n2_story_close', -400, 700, 'tgt', { px: 330 }),
    L('rays', 0, 700, 'tgt', { n: 16, len: 260, col: 1, a: 0.6 }),
    L('petals', 0, 900, 'scr', { n: 50, w: 1200, h: 700, kind: 'petal', col: '255,240,210', col2: '255,255,255', drift: 160 }),
  ], hit: [IH('holy_burst', 600, { th: 1.8 }), H('sparks', 360, { n: 12, v: 50, len: 8, col: 1 })], shakes: [[0, 8, 520]] });
  def('eb_eight_legends', rgb('255,215,140', '255,255,240', '150,100,230'), { ult: 1, tier: 5, lead: 620, c: '【八つの伝承】八つの属性の光の輪が回り、八つの伝承が次々に降りそそぐ', main: [
    I('n2_eight_ring', -560, 500, 'src', { px: 300, flat: 0.5, spin: 1.6, env: 1, fi: 0.2, fo: 0.2, dy: -20 }),
    L('rain', -260, 400, 'tfoot', { n: 16, w: 320, h: 380, kind: 'orb', slant: -0.3, trail: 50, life: 0.35, col: 0 }),
  ], hit: [IH('combo_burst', 520, { th: 1.8, tint: 0 }), H('sparks', 300, { n: 10, v: 40, len: 6, col: 1 })], shakes: [[0, 5, 320]] });
  def('eb_unwrite', rgb('230,220,255', '255,255,255', '30,10,60'), { tier: 4, lead: 460, c: '書き消し: 虚空の裂け目が的の文字をはがして吸い込む', main: [L('glow', -360, 0, 'src', { r: 70, col: 2, a: 0.5 })], hit: [IH('n2_unwrite', 720, { th: 3.6 })], shakes: [[0, 6, 320]] });
  def('eb_oblivion_breath', rgb('235,210,255', '255,255,255', '140,200,230'), { tier: 4, lead: 420, c: '忘却の吐息: 夢の色の息が流れ、思い出の光が消えていく', main: [SPAN('n2_dream_breath', -360, 580, 'tgt', { env: 1, fi: 0.15, fo: 0.3 })], hit: [IH('sparkle_twinkle', 520, { th: 1.4, tint: 1 })] });
  def('eb_nemrea_rewrite', rgb('255,230,160', '255,255,245', '140,230,190'), { ult: 1, tier: 5, lead: 560, ally: 1, c: '【物語の書き直し】終わりの魔法陣が足もとで回り、光の柱の中で物語が書き直される', main: [
    I('n2_end_sigil', -520, 600, 'srcfoot', { px: 310, flat: 0.34, spin: -0.8, env: 1 }),
    I('light_pillar', -300, 600, 'srcfoot', { px: 310, env: 1, tint: 0 }),
    I('n2_story_close', -200, 500, 'src', { px: 300, a: 0.7 }),
  ], hit: [IH('heal_sparkles', 600, { th: 1.6 })] });
  def('eb_nemrea2_mark', rgb('255,230,160', '255,255,245', '170,120,230'), { tier: 3, c: '結末の予約: 的の足もとに終わりの魔法陣が刻まれる', hit: [IH('n2_end_sigil', 700, { px: 120, flat: 0.34, spin: 1.2, env: 1, foot: 1 })] });
  def('eb_nemrea2_page', rgb('170,150,255', '235,230,255', '40,24,110'), { tier: 4, lead: 520, ally: 1, flash: 0, c: 'ページ返し（夜）: 夜空のページが大きくめくれて星くずが降り、ネムレアの体が闇の側へ傾く', dimCol: '4,2,22', dim: 0.5, main: [
    L('sky', -520, 760, 'scr', { top: '8,4,36', bot: '70,48,140', a: 0.45 }),
    I('n2_night_page', -460, 560, 'src', { px: 390, env: 1, fi: 0.1, fo: 0.3 }),
    L('petals', -160, 760, 'scr', { n: 40, w: 1200, h: 700, kind: 'petal', col: '200,190,255', col2: '255,255,255', drift: 120 }),
  ], hit: [IH('dark_orb', 520, { th: 0.5, a: 0.55 }), H('sparks', 380, { n: 10, v: 26, len: 0, star: 1, size: 4, col: 1 })] });
  def('eb_nemrea2_page2', rgb('255,215,140', '255,252,235', '255,160,150'), { tier: 4, lead: 520, ally: 1, flash: 0, c: 'ページ返し（朝）: 朝日のページが大きくめくれて金の光がさし、ネムレアの体が光の側へ傾く', dimCol: '30,16,8', dim: 0.3, flashCol: '255,240,200', main: [
    L('sky', -520, 760, 'scr', { top: '255,190,140', bot: '255,240,200', a: 0.3 }),
    I('n2_dawn_page', -460, 560, 'src', { px: 390, a: 0.72, env: 1, fi: 0.1, fo: 0.3 }),
    L('rays', -100, 600, 'src', { n: 14, len: 220, col: 1, a: 0.5 }),
  ], hit: [IH('holy_burst', 520, { th: 0.5, a: 0.5 }), H('sparks', 420, { n: 10, v: 30, len: 0, star: 1, size: 4, col: 0 })] });
  def('eb_dream_sleep', rgb('235,210,255', '255,255,255', '140,200,230'), { tier: 4, lead: 360, c: '眠りの誘い: 夢の色のりん粉の雲が全員を包む', main: [I('mo_sleep_dust', -320, 640, 'tgt', { px: 300, env: 1, a: 0.8 })], hit: [IH('sparkle_twinkle', 480, { th: 1.3, tint: 1 })] });

  // ================================================================ クリア後: 魔王の残影・円環竜
  def('eb_echo_despair', rgb('255,70,80', '255,210,210', '40,0,10'), { ult: 1, tier: 5, lead: 620, c: '【絶望の残響】魔王の残影から黒と紅の波が広がり、全員の心をくじく', dimCol: '14,0,2', dim: 0.6, main: [
    L('glow', -560, 0, 'src', { r: 90, col: 2, a: 0.6 }),
    I('vz_despair', -200, 700, 'tgt', { px: 330 }),
    L('ring', 0, 600, 'tgt', { r: 180, w: 4, n: 3, col: 0 }),
  ], hit: [IH('debuff_smoke', 520, { th: 1.4, tint: '200,40,60' })], shakes: [[0, 6, 440]] });
  def('eb_echo_flame', rgb('255,70,60', '255,210,180', '40,0,10'), { tier: 4, lead: 420, c: '魔炎: 黒と紅の火柱が全員の足もとから立つ', main: [I('vz_demon_flame', -160, 620, 'eachfoot', { px: 230 })], hit: [IH('fire_burst', 480, { th: 1.4 })], shakes: [[0, 4, 300]] });
  def('eb_echo_claw', rgb('255,60,70', '255,210,210', '30,0,10'), { tier: 3, c: '残影の爪: 紅く燃える影の四本の爪', hit: [IH('vz_shadow_claw', 600, { th: 3.1 }), H('sparks', 300, { n: 8, v: 30, len: 6, col: 0 })] });
  def('eb_echo_dread', rgb('255,70,90', '255,215,220', '30,0,12'), { tier: 4, lead: 480, c: '恐れの残響: 魔王の残影から黒と紅の残響の輪が残像を引いて幾重にも広がり、全員の心を揺さぶる', dimCol: '12,0,4', dim: 0.45, main: [
    L('glow', -480, 0, 'src', { r: 80, col: 2, a: 0.55 }),
    I('vz_dread_echo', -400, 140, 'src', { px: 260, env: 1, fi: 0.2, fo: 0.4, a: 0.75 }),
    I('vz_dread_echo', -140, 660, 'tgt', { px: 340 }),
  ], hit: [IH('vz_dread_echo', 620, { th: 1.4, a: 0.7 }), H('sparks', 420, { n: 6, v: 16, len: 0, star: 1, size: 4, col: 0 })], shakes: [[0, 3, 320]] });
  def('eb_echo_gather', rgb('255,60,80', '255,200,210', '20,0,8'), { tier: 3, lead: 420, ally: 1, c: '闇をまとう: 四方の影と紅い火の粉が残影へ渦を巻いて集まり、傷を包んでふさぐ', main: [
    L('tendrils', -420, 100, 'srcfoot', { n: 6, len: 80, w: 90, gy: 0, col: 2 }),
    I('vz_shadow_gather', -420, 300, 'src', { px: 320 }),
  ], hit: [IH('vz_shadow_gather', 600, { th: 0.7, a: 0.7 }), H('glow', 520, { r: 50, col: 0, a: 0.35 }), H('sparks', 380, { n: 8, v: 20, len: 0, star: 1, size: 4, col: 0 })] });
  def('eb_echo_gaze', rgb('255,50,60', '255,220,200', '30,0,8'), { tier: 4, lead: 500, c: '恐れのまなざし: 残影の上に紅い眼が開いてにらみ、射すくめる光が全員の体を縛る', dimCol: '10,0,2', dim: 0.5, main: [
    I('vz_dread_gaze', -500, 380, 'src', { px: 260 }),
    L('rays', -60, 360, 'tgt', { n: 12, len: 170, col: 0, a: 0.5 }),
  ], hit: [IH('vz_dread_gaze', 600, { th: 1.1, a: 0.65 }), H('chains', 600, { n: 2, r: 30, col: 0, col2: 1 })], shakes: [[0, 4, 280]] });
  def('eb_echo_shroud', rgb('255,60,70', '255,230,200', '10,0,4'), { tier: 4, lead: 520, c: '闇の帳: 黒い帳が全員の上から降り、かかっていた力の光の紋を砕いてかき消す', dimCol: '6,0,2', dim: 0.55, main: [
    L('glow', -520, 0, 'src', { r: 90, col: 2, a: 0.6 }),
    I('vz_dark_shroud', -300, 640, 'tgt', { px: 380 }),
    L('shards', -20, 520, 'tgt', { n: 12, r: 90, size: 9, col: 1 }),
  ], hit: [IH('debuff_smoke', 520, { th: 1.3, tint: '150,20,40' }), H('sparks', 360, { n: 8, v: 30, len: 6, col: 1 })], shakes: [[0, 4, 320]] });
  def('eb_echo_soul', rgb('255,70,80', '255,210,210', '40,0,10'), { tier: 3, c: '魂吸い: 紅い光が的から吸い出される', hit: [IH('vz_despair', 600, { th: 1.6, a: 0.8 }), H('motes', 500, { n: 12, w: 40, h: 60, col: 0 })] });
  def('eb_ouro_end', rgb('140,255,190', '255,250,210', '200,160,50'), { ult: 1, tier: 6, lead: 760, bars: true, c: '【輪の終わり】空いっぱいの円環竜のうろこの輪が締まり、金と翠の光になって弾ける', dimCol: '0,10,8', dim: 0.66, main: [
    L('sky', -720, 900, 'scr', { top: '0,40,40', bot: '200,230,150', a: 0.4 }),
    I('ou_ring_end', -560, 800, 'tgt', { px: 380 }),
    I('ou_time_rewind', -700, 0, 'tgt', { px: 300, flat: 0.5, env: 1, a: 0.6 }),
    L('ring', 0, 600, 'tgt', { r: 200, w: 5, n: 3, col: 1 }),
  ], hit: [IH('ou_scale_storm', 560, { th: 1.6, a: 0.8 }), H('sparks', 360, { n: 12, v: 50, len: 8, col: 1 })], shakes: [[0, 9, 520]] });
  def('eb_rewind', rgb('120,240,220', '240,255,250', '220,180,80'), { ult: 1, tier: 5, lead: 560, c: '【巻き戻し】時計の輪が逆に回り、強めた力も傷も巻き戻る', dimCol: '0,14,14', main: [
    I('ou_time_rewind', -520, 600, 'tgt', { px: 300, env: 1, fi: 0.2, fo: 0.3 }),
    I('ou_time_rewind', -460, 600, 'src', { px: 280, env: 1, a: 0.7, mx: 1 }),
  ], hit: [IH('sparkle_twinkle', 480, { th: 1.4, tint: 0 })] });
  def('eb_scale_storm', rgb('140,255,190', '255,250,210', '200,160,50'), { tier: 4, lead: 400, c: 'うろこの嵐: 翠と金のうろこが刃の竜巻になって舞う', main: [I('ou_scale_storm', -340, 560, 'tgt', { px: 280, env: 1, fi: 0.2, fo: 0.3 })], hit: [IH('slash_multi', 460, { th: 1.8, tint: 0 })], shakes: [[0, 4, 300]] });
  def('eb_eternal_breath', rgb('120,240,200', '250,255,230', '200,160,50'), { tier: 4, lead: 420, c: '終わらない息: 無限の輪を描く翠と金の息が全員へ流れる', main: [SPAN('ou_eternal_breath', -360, 580, 'tgt', { env: 1, fi: 0.15, fo: 0.3 })], hit: [IH('sparkle_twinkle', 480, { th: 1.4, tint: 1 })] });
  def('eb_ring_crush', rgb('140,255,190', '255,250,210', '200,160,50'), { tier: 4, lead: 400, c: '円環の締めつけ: うろこの輪が的を締めつけて弾ける', hit: [IH('ou_ring_end', 720, { th: 3.4 }), H('ring', 360, { r: 40, w: 4, n: 2, col: 1 })], shakes: [[0, 6, 320]] });
  def('eb_time_loop', rgb('120,240,220', '240,255,250', '220,180,80'), { tier: 4, lead: 360, c: 'くり返しの呪い: 小さな時計の輪が全員の上で逆に回る', hit: [IH('ou_time_rewind', 640, { th: 2.4, flat: 0.6 })] });
  def('eb_ouro_mark', rgb('140,255,190', '255,250,210', '200,160,50'), { tier: 4, lead: 420, c: '尾の刻印: 円環竜の尾の光が的へ走り、己の尾をかむ輪の印が足もとと体に焼きつく', main: [
    L('glow', -420, 0, 'src', { r: 70, col: 0, a: 0.5 }),
    L('dash', -260, 40, 'tgt', { n: 6, len: 120, col: 1 }),
    I('ou_tail_mark', -160, 760, 'tfoot', { px: 180, flat: 0.34, spin: 1.4, env: 1, fi: 0.2, fo: 0.3 }),
  ], hit: [IH('ou_tail_mark', 700, { px: 120, grow: [1.7, 1], env: 1, fi: 0.05, fo: 0.4 }), H('ring', 360, { r: 46, w: 3, n: 2, col: 1 })], shakes: [[0, 4, 260]] });
  def('eb_tail_devour', rgb('140,255,190', '255,250,210', '200,160,50'), { ult: 1, tier: 5, lead: 520, ally: 1, c: '【尾をのむ】円環竜が己の尾をのみ、うろこの輪が体を包んで力が満ちる', main: [
    I('ou_ring_end', -480, 560, 'src', { px: 310 }),
    I('aura_rise', -300, 560, 'srcfoot', { th: 1.4, env: 1, tint: 0 }),
  ], hit: [IH('sparkle_twinkle', 480, { th: 1.4, tint: 1 })] });

  // ---------------------------------------------------------------- データへの結び付け
  // 合体技: 最後の段（ボスが締める）の演出をボスの行（ec_b_*）へ
  const COMBO_ROW = { c_b_lord_pack: 'ec_b_lord_pack', c_b_root_bind: 'ec_b_root_bind', c_b_tamer_charge: 'ec_b_tamer_charge', c_b_sister_flames: 'ec_b_sister_flames',
    c_b_hawk_hunt: 'ec_b_hawk_hunt', c_b_three_heroes: 'ec_b_three_heroes', c_b_lazaro_scribes: 'ec_b_lazaro_scribes', c_b_octo_squeeze: 'ec_b_octo_squeeze',
    c_b_captain_boarding: 'ec_b_captain_boarding', c_b_doll_trio: 'ec_b_doll_trio', c_b_mist_embrace: 'ec_b_mist_embrace', c_b_vein_resonance: 'ec_b_vein_resonance',
    c_b_siege_hunt: 'ec_b_siege_hunt', c_b_admiral_volley: 'ec_b_admiral_volley' };
  S.bossRows = () => Object.keys(T).filter((k) => /^(eb_|ec_b_)/.test(k));
  /** 必殺技の行か（差し込みを出す） */
  S.isUlt = (sid) => { const r = sid && T[String(sid).replace(/^sq:/, '')]; return !!(r && r.ult); };
  /** 行が使う画像の部品の id（先に読む用） */
  S.partsOf = (sid) => { const r = T[String(sid).replace(/^sq:/, '')]; return r ? [...new Set([...(r.main || []), ...(r.hit || [])].filter((x) => x.id).map((x) => x.id))] : []; };
  // 使い手の溜めの気（fx_seq_img.js の extras: 使い手の背の 1.5 倍ほどの aura_rise）は、大きなボスでは絵より大きな白い炎になる:
  // ボスの行では小さく・行の色で（ボスの体の中ほどまで）
  const get1 = S.get;
  S.get = function (sid) {
    const sp = get1(sid);
    if (sp && !sp._bossAura && /^(eb_|ec_b_)/.test(sp.key || '')) {
      sp._bossAura = true;
      for (const L0 of sp.main) if (L0.p === 'img' && L0.id === 'aura_rise' && L0.at === 'srcfoot' && L0.t0 === 0) { L0.th = 0.75; L0.tint = 0; L0.a = 0.6; }
    }
    return sp;
  };
  if (R.onData) R.onData(function () {
    const BA = R.DB.bossActions || {}, EC = R.DB.enemyCombos || {};
    for (const k of Object.keys(T)) if (/^eb_/.test(k) && BA[k] && !BA[k].seq) BA[k].seq = 'sq:' + k;
    for (const [cid, row] of Object.entries(COMBO_ROW)) {
      const C = EC[cid];
      if (!C || !C.steps || !C.steps.length) continue;
      C.steps[C.steps.length - 1].seq = 'sq:' + row;
    }
  });
})(window.RPG);
