// RULES・EVENTS（砂漠）: ザハラ砂漠の大事な物・一品物・戦闘で使う王の名（WORLD_REDESIGN §4.2・§2.7・§2.8・§4.9、STORY_BIBLE §7.2）。
//   大事な物 k_*（1 つだけ・売れない）、伸びる一品物 u_*（数値は手に入れたときのティア。R.State.gain が写す）、
//   王の名の記し i_desert_kingname（戦闘の中で「使う」と名を呼ぶ。bosses_desert.js の special desert_call_name）。
//   宝の地図は地方をまたぐ手がかり（§2.8）: 行き先の寄り道はまだ無い地方の中なので、行き先は data（map・hint）として持つだけ。
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  let n = 0;
  const KEYS = {
    k_desert_glyph_ha: K('名の刻み石「ハ」', '墓守の像の台座にあった石片。\n古い字で「ハ」と読める。', { icon: 'gem' }),
    k_desert_glyph_za: K('名の刻み石「ザ」', '墓守の像の台座にあった石片。\n古い字で「ザ」と読める。', { icon: 'gem' }),
    k_desert_glyph_ru: K('名の刻み石「ル」', '墓守の像の台座にあった石片。\n古い字で「ル」と読める。', { icon: 'gem' }),
    k_desert_oil: K('黒い泉の油', 'ギルドから預かった油のつぼ。\nのろし台に火を戻すのに使う。', { icon: 'lamp' }),
    k_desert_anklet: K('ナディアの足鈴', '踊り子ナディアが失くした\n銀の足鈴。', { icon: 'ring' }),
    k_desert_dates: K('なつめやしの実', '市場の干し果物。\n子どもの大好物。', { icon: 'bag' }),
    k_desert_salt: K('砂漠の塩の包み', '白い岩塩の包み。宿場の\n行商人ロッタに届ける。', { icon: 'bag' }),
    k_desert_camel_rope: K('ラクダの手綱', '迷子のラクダの手綱。\n隊商ギルドの焼き印つき。', { icon: 'bag' }),
    k_desert_shovel: K('井戸掘りのすき', '井戸掘りの親方から借りた\n砂を掘るすき。', { icon: 'search' }),
    k_tmap_3: K('宝の地図・その3', '鷹団の頭の地図。灰の荒野の\n折れた剣の碑が描いてある。', { icon: 'map', tmap: { n: 3, place: 'ash_battlefield', region: 'r_ash', hint: '灰の古戦場。折れた剣の碑の下の段、\n封じの扉の奥。' } }),
    k_tmap_5: K('宝の地図・その5', '百の帆柱が霧に立つ絵。\n西の外洋の船の墓場らしい。', { icon: 'map', tmap: { n: 5, place: 'ship_graveyard', region: 'world', hint: '船の墓場。三本目の帆柱の船の\n船倉の、封じの扉。' } }),
    k_tmap_6: K('宝の地図・その6', '字がにじんで読めない地図。\n星のかけらがあれば読めるという。', { icon: 'map', tmap: { n: 6, place: 'storm_eye', region: 'world', needs: 'k_star_shard', hint: '嵐の目の島の洞。……続きは読めない。' } }),
  };
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9400 + n++; R.def('items', id, KEYS[id]); }

  R.defs('items', {
    // 王の名（戦闘の中で使う。第 2 の姿の後でなければ戻る）
    i_desert_kingname: { name: '王の名の記し', slot: 'use', grade: 'normal', tier: 0, price: 0, src: 'key', icon: 'journal', sort: 9390,
      desc: '三つの刻み石をつないだ王の名。\n戦いの中で、王の名を呼ぶ。',
      use: { target: 'enemy', effects: [{ type: 'special', id: 'desert_call_name' }], fx: 'holy', battle: true, field: false } },
    // 砂の鷹団（どの選択でも同じ品にたどり着く: 敵なら頭との戦いの宝箱、味方なら頭の礼、払ったならアジトの店で買う）
    u_hawk_gloves: U('hands', '鷹の手袋', { weight: 'light', units: 'd1', mult: 1.2, mods: { stealPct: 20, preemptPct: 5 }, icon: 'glove',
      desc: '盗みが成功しやすい。\n先制しやすくなる。' }),
    // 砂に沈んだ神殿（#6）
    u_sun_staff: U('weapon', '日輪の杖', { wtype: 'staff', units: 's1v1', mult: 1.35, mods: { elemBoost: { fire: 15, light: 15 } }, icon: 'staff',
      desc: '火と光の術が強くなる。\n日の名残を宿した杖。' }),
    // 依頼の礼
    u_nadia_bell: U('acc', '踊り子の足鈴', { mods: { spd: 4, escapePct: 15 }, icon: 'ring', desc: 'すばやく動ける。逃げやすい。\nしゃらりと鳴る銀の鈴。' }),
    u_signal_mirror: U('acc', 'のろしの鏡', { mods: { encounterPct: -10, preemptPct: 5 }, icon: 'ring', desc: '魔物に出会いにくい。\n先制しやすくなる。' }),
    u_caravan_scarf: U('head', '隊商の頭布', { weight: 'light', mods: { statusResist: { blind: 0.5 }, hpPct: 4 }, icon: 'helm', desc: '暗闇にかかりにくい。\n砂よけの藍の頭布。' }),
    u_well_charm: U('acc', '井戸掘りのお守り', { mods: { hpPct: 5, statusResist: { poison: 0.5 } }, icon: 'ring', desc: '最大HPが上がる。\n毒にかかりにくい。' }),
    // しんきろうの市（#8、ティアで入れ替わる 3 品 × 2 段。代金は市の人がティアで決める）
    u_mirage_lamp: U('acc', 'しんきろうの灯', { mods: { mpRegen: 1 }, icon: 'ring', desc: '毎ターン、MPが少し戻る。\n消えない幻の灯。' }),
    u_mirage_veil: U('body', 'しんきろうの薄衣', { weight: 'cloth', units: 'a1', mods: { statusResist: { confuse: 0.5 } }, icon: 'armor', desc: '混乱にかかりにくい。\n砂の上の陽炎で織った衣。' }),
    u_mirage_dagger: U('weapon', 'しんきろうの短剣', { wtype: 'dagger', units: 'd1', mult: 1.25, crit: 6, icon: 'dagger', desc: '会心が出やすい。\n刃が揺れて見える短剣。' }),
    u_mirage_harp: U('acc', '砂うたのたて琴', { mods: { glimPct: { spell: 12 } }, icon: 'ring', desc: '術を閃きやすい。\n砂が歌う小さなたて琴。' }),
    u_mirage_boots: U('feet', '砂渡りの靴', { weight: 'light', units: 'a1', mods: { spd: 5, encounterPct: -5 }, icon: 'boots', desc: 'すばやく動ける。\n魔物に出会いにくい。' }),
    u_mirage_bow: U('weapon', '陽炎の弓', { wtype: 'bow', units: 'd2', mult: 1.3, hit: 6, icon: 'bow', desc: 'よく当たる。\n矢が陽炎のように揺れる。' }),
  });

  // 宝の地図の行き先（地方をまたぐ手がかり。まだ無い寄り道は data だけ。WORLD_REDESIGN §2.8）
  R.DesertData = Object.assign(R.DesertData || {}, {
    treasureMaps: {
      k_tmap_3: { from: '砂の鷹団（味方）／カシムの地図屋', to: 'ash_battlefield', built: false },
      k_tmap_5: { from: 'カシムの地図屋（ティア 3 から）', to: 'ship_graveyard', built: false },
      k_tmap_6: { from: 'カシムの地図屋（ティア 5 から）', to: 'storm_eye', built: false, needs: 'k_star_shard' },
    },
    mirage: { low: ['u_mirage_lamp', 'u_mirage_veil', 'u_mirage_dagger'], high: ['u_mirage_harp', 'u_mirage_boots', 'u_mirage_bow'] },
  });
})(window.RPG);
