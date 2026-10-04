// CONTENT（クリア後）: 忘却の底 oblivion_1〜5（クリア後のダンジョン。旧版 chronicle/src/maps/oblivion_*.js の筋を v2 の描いた下絵で作り直した）。
//   入口: 書の都ビブリアの広場の白い階段（final_biblia.js。クリアの後に開く）。大書庫 1 階の手すりの向こうの階段からも下りられる（archive_oblivion）。
//   地下 1 階 oblivion_1 忘れられた者の岸（40×32）: 北西の上り階段（ビブリアへ）→ 白い紙の砂の岸を南へ、東へ → 南東の下り階段。
//        北の砂州は東の行き止まり（宝箱）、南の岸から砂の道が名のない墓の輪の小島へ。岸の石碑に忘れられた伝承のかけら。
//   地下 2 階 oblivion_2 継ぎはぎの森（44×34）: 森（北西、上り階段）・砂の国（南西）・雪原（東、下り階段）が霧の中に浮かび、白い紙の橋で縫われる。
//        森から東へのびる紙の橋は途中でちぎれている（行き止まりの宝箱）。
//   地下 3 階 oblivion_3 恐れの間（36×34）: 南の上り階段 → 恐れの像の柱の広間（西と東に小部屋）→ 控えの間 → 玉座の間の入口で魔王の残影
//        （tr_b_valzard_echo）→ 玉座の間の北東の小部屋の下り階段。倒した後は玉座を調べるともう一度戦える。
//   地下 4 階 oblivion_4 終わらない回廊（48×26）: 同じ部屋が 3 つ。部屋から次へは北と南の 2 本の廊下で、正しいのは淡い光のある方
//        （1 の部屋は北・2 は南・3 は北）。もう一方を進むと最初の部屋に戻る（oblivion_4_loop）。東の端の間に下り階段。
//   地下 5 階 oblivion_5 円環の間（36×34）: 南の上り階段 → 輪の床を回って北の門 → 門のそばに泉（女神の像。このダンジョンでただ一つ）→
//        内の円で円環竜オウロボラ（tr_b_ouroboros）→ 外伝『円環の竜』（oblivion_ouroboros）。倒した後は渦の中ほどを調べるともう一度戦える。
//   当たりは描いた絵に合わせた oblivion_painted_rows.js（R.Oblivion.PAINTED。design/art_ref/gen/env/_tools/under/oblivion/）。
//   出現: 1・2 階 z_postgame_oblivion_lo、3〜5 階 _hi（5 階は輪の床だけ。内の円は出ない）。宝箱はティア 9（chestTier）。泉は 1 つ（5 階、ボスの前。check_springs）。
(function (R) {
  'use strict';
  const O = (R.Oblivion = R.Oblivion || {});
  O.MAPS = ['oblivion_1', 'oblivion_2', 'oblivion_3', 'oblivion_4', 'oblivion_5'];
  O.ZONE_LO = 'z_postgame_oblivion_lo';
  O.ZONE_HI = 'z_postgame_oblivion_hi';
  O.CHEST_TIER = 9;
  /** 町の入口（ビブリアの広場の階段。final_biblia.js が置く）: 階段のマス・着く所 */
  O.GATE = { map: 'biblia', stairs: [[32, 28], [33, 28]], spawn: 'oblivion', at: { x: 32, y: 29, dir: 's' } };
  // 白の大書庫・虚ろの間より少し明るい、すみれ色の霧の光
  O.LIGHT = { ambient: '#7a78b4', k: 0.66, poolK: 1.2, spillR: 1.2, mood: 'tower' };

  /** 当たりの字（dng_oblivion.py と同じ） */
  O.LEGEND = function () {
    return {
      c: { mat: 'marble_floor' }, s: { mat: 'sand' }, ',': { mat: 'grass' }, ':': { mat: 'dune_sand' }, _: { mat: 'snow' },
      '=': { mat: 'white_paving' }, k: { mat: 'carpet' },
      '~': { mat: 'wall_stone', solid: true, name: 'outside' }, X: { mat: 'wall_stone', solid: true, name: 'painted' },
      T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, r: { mat: 'rock', solid: true },
    };
  };
  O.painted = function (id) {
    const p = O.PAINTED && O.PAINTED[id];
    if (p) return { rows: p.rows.slice(), art: Object.assign({}, p.art) };
    R.warn && R.warn('Oblivion.painted: no painted rows for ' + id);
    return { rows: ['XXX', 'XcX', 'XXX'], art: null };
  };

  R.onData(function () {
    const K = R.ContentF.kit;
    const floor = (n) => R.T('map.oblivion.floor', { n });
    const def = (id, n, o) => {
      const P = O.painted(id);
      K.def(id, Object.assign({
        name: R.T('map.oblivion.name'), kind: 'dungeon', region: 'finale', location: 'oblivion', theme: 'lighthouse', propSet: 'star',
        legend: O.LEGEND(), rows: P.rows, outside: 'wall_stone', npcs: [], exits: [], dark: false, bgm: 'postgame', bbg: 'oblivion',
        chestTier: O.CHEST_TIER, light: O.LIGHT,
        art: Object.assign({}, P.art, { painted: ['stairs_up', 'stairs_down'] }),
      }, o, { meta: Object.assign({ chestsInfo: true, floor: floor(n), sub: R.T('map.oblivion.' + id + '.sub') }, o.meta || {}) }));
    };
    const up = (x, y, to, spawn, id) => K.stairs(x, y, { map: to, spawn }, Object.assign({ look: 'up' }, id ? { id } : {}));
    const down = (x, y, to, spawn, id) => K.stairs(x, y, { map: to, spawn }, Object.assign({ look: 'down' }, id ? { id } : {}));
    const stone = (x, y, n) => K.exam(x, y, 'oblivion_stone', { stone: n });
    const glow = (pts) => pts.map(([x, y]) => K.prop('page_glow', x, y));
    const enter = (id) => ({ id: 'arrive', on: 'enter', event: id + '_arrive' });

    // ================================================================ 地下 1 階 忘れられた者の岸
    def('oblivion_1', 1, {
      objects: [
        Object.assign(up(6, 2, 'biblia', O.GATE.spawn, 'oblivion_1_up'), { w: 2 }),   // 町へ（2 マス幅の 1 つの階段: 出口の札が 1 つ）
        down(34, 27, 'oblivion_2', 'from1', 'oblivion_1_down'), down(35, 27, 'oblivion_2', 'from1'),
        stone(10, 3, 1), stone(3, 12, 2), stone(12, 21, 3), stone(30, 23, 4),
        K.exam(22, 10, 'oblivion_graves'), K.exam(19, 11, 'oblivion_graves'), K.exam(25, 11, 'oblivion_graves'),
        K.chest('oblivion_1_c1', 33, 5, { pool: 'p_boss' }), K.chest('oblivion_1_c2', 4, 23, { pool: 'p_T' }),
        K.chest('oblivion_1_c3', 22, 13, { item: 'i_elixir', n: 1 }), K.chest('oblivion_1_c4', 29, 26, { pool: 'p_T' }),
        ...glow([[22, 14], [33, 6], [6, 4]]),
      ],
      spawns: { from_town: { x: 6, y: 3, dir: 's' }, from2: { x: 34, y: 26, dir: 'n' } },
      triggers: [enter('oblivion_1')],
      zones: [{ rect: null, zone: O.ZONE_LO }],
    });

    // ================================================================ 地下 2 階 継ぎはぎの森
    def('oblivion_2', 2, {
      objects: [
        up(8, 3, 'oblivion_1', 'from2', 'oblivion_2_up'), up(9, 3, 'oblivion_1', 'from2'),
        down(33, 28, 'oblivion_3', 'from2', 'oblivion_2_down'), down(34, 28, 'oblivion_3', 'from2'),
        K.exam(25, 8, 'oblivion_torn_seam'), K.exam(25, 9, 'oblivion_torn_seam'),
        K.chest('oblivion_2_c1', 24, 8, { pool: 'p_rare' }), K.chest('oblivion_2_c2', 6, 28, { pool: 'p_T' }),
        K.chest('oblivion_2_c3', 40, 15, { pool: 'p_T' }), K.chest('oblivion_2_c4', 34, 6, { item: 'i_ether2', n: 2 }),
      ],
      spawns: { from1: { x: 8, y: 4, dir: 's' }, from3: { x: 33, y: 27, dir: 'n' } },
      triggers: [enter('oblivion_2')],
      zones: [{ rect: null, zone: O.ZONE_LO }],
    });

    // ================================================================ 地下 3 階 恐れの間（魔王の残影）
    def('oblivion_3', 3, {
      objects: [
        up(17, 31, 'oblivion_2', 'from3', 'oblivion_3_up'), up(18, 31, 'oblivion_2', 'from3'),
        // 玉座の間の北東の小部屋（下りの階段は描いた段の上の段。2 段目は踊り場）
        down(30, 3, 'oblivion_4', 'from3', 'oblivion_3_down'), down(31, 3, 'oblivion_4', 'from3'),
        K.exam(14, 19, 'oblivion_statue'), K.exam(21, 19, 'oblivion_statue'), K.exam(14, 24, 'oblivion_statue'), K.exam(21, 24, 'oblivion_statue'),
        K.exam(17, 3, 'oblivion_3_echo'), K.exam(18, 3, 'oblivion_3_echo'),   // 玉座（倒した後はもう一度挑める）
        K.chest('oblivion_3_c1', 4, 20, { pool: 'p_boss' }), K.chest('oblivion_3_c2', 31, 20, { item: 'i_elixir', n: 2 }),
        K.chest('oblivion_3_c3', 21, 11, { item: 'i_ether2', n: 2 }),
        K.prop('altar_glow', 17, 4),
      ],
      spawns: { from2: { x: 17, y: 30, dir: 'n' }, from4: { x: 29, y: 3, dir: 'w' } },
      triggers: [
        enter('oblivion_3'),
        { id: 'echo', x: 16, y: 9, w: 4, h: 1, on: 'step', event: 'oblivion_3_echo', cond: '!oblivion_echo' },
      ],
      zones: [{ rect: null, zone: O.ZONE_HI }],
    });

    // ================================================================ 地下 4 階 終わらない回廊
    def('oblivion_4', 4, {
      objects: [
        up(2, 12, 'oblivion_3', 'from4', 'oblivion_4_up'), up(2, 13, 'oblivion_3', 'from4'),
        down(44, 19, 'oblivion_5', 'from4', 'oblivion_4_down'), down(45, 19, 'oblivion_5', 'from4'),
        K.exam(3, 11, 'oblivion_4_hint'),
        K.chest('oblivion_4_c1', 45, 5, { pool: 'p_rare' }), K.chest('oblivion_4_c2', 25, 18, { pool: 'p_T' }), K.chest('oblivion_4_c3', 39, 6, { item: 'i_elixir', n: 1 }),
        // 正しい廊下の口の淡い光（1 の部屋は北・2 は南・3 は北）
        ...glow([[13, 6], [26, 18], [40, 6]]),
      ],
      spawns: { from3: { x: 3, y: 12, dir: 'e' }, from5: { x: 44, y: 17, dir: 'n' }, loop: { x: 4, y: 13, dir: 'e' } },
      triggers: [
        enter('oblivion_4'),
        { id: 'loop1', x: 15, y: 17, w: 1, h: 2, on: 'step', event: 'oblivion_4_loop' },
        { id: 'loop2', x: 28, y: 6, w: 1, h: 2, on: 'step', event: 'oblivion_4_loop' },
        { id: 'loop3', x: 41, y: 17, w: 1, h: 2, on: 'step', event: 'oblivion_4_loop' },
      ],
      zones: [{ rect: null, zone: O.ZONE_HI }],
    });

    // ================================================================ 地下 5 階 円環の間（円環竜オウロボラ）
    def('oblivion_5', 5, {
      objects: [
        up(17, 32, 'oblivion_4', 'from5', 'oblivion_5_up'), up(18, 32, 'oblivion_4', 'from5'),
        K.spring('oblivion_5_spring', 12, 4),
        K.exam(24, 4, 'oblivion_ring_stone'),
        K.exam(17, 17, 'oblivion_5_ouroboros', { cond: 'oblivion_ouroboros' }), K.exam(18, 17, 'oblivion_5_ouroboros', { cond: 'oblivion_ouroboros' }),
        K.chest('oblivion_5_c1', 32, 17, { pool: 'p_rare' }), K.chest('oblivion_5_c2', 3, 17, { pool: 'p_T' }), K.chest('oblivion_5_c3', 8, 27, { item: 'i_elixir', n: 1 }),
        K.prop('altar_glow', 17, 17),
      ],
      spawns: { from4: { x: 17, y: 31, dir: 'n' }, gate: { x: 17, y: 9, dir: 'n' } },
      triggers: [
        enter('oblivion_5'),
        { id: 'ouroboros', x: 17, y: 7, w: 2, h: 1, on: 'step', event: 'oblivion_5_ouroboros', cond: '!oblivion_ouroboros' },
      ],
      // 輪の床だけ（北・南の帯と西・東の帯）。内の円（x 9〜26・y 8〜25）は出ない
      zones: [[3, 2, 30, 6], [3, 26, 30, 7], [3, 8, 6, 18], [27, 8, 6, 18]].map((rect) => ({ rect, zone: O.ZONE_HI })),
    });
  });
})(window.RPG);
