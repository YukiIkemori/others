// FIELD: 環境音（天気と場所の音の床。core/audio.js の R.Audio.ambience、design/notes/audio.md §14。2026-10-04）
//   0.25 秒ごとに「いま鳴らす床」を決め、変わったときだけ R.Audio.ambience(spec, {fade}) を呼ぶ（地図の入れ替えは 1.2 秒で交差）。
//   鳴らす: フィールドの場面が積まれていて、戦闘（場面 'battle' と、入る移り _.trans の間）でないとき。メニュー・会話の間はそのまま。
//           タイトル（R.Flow.title は場面を全部外す）・戦闘の間は消す（戦闘へは 0.6 秒で沈める）。
//   F.ambienceFor(map, wx, night) → spec | null（決め方。node のテストから呼ぶ）:
//     map.ambience があればそれ（null / false = 鳴らさない、'床の名前' か {bed, i, ...}）
//     天気 → snow→snow  blizzard→blizzard  mist→mist  sandstorm→sandstorm  heat→heat  fog→marsh  drizzle→rain（岸の地図は波を足す）
//            ash→ash  rays→forest  leaves→breeze  stars→highwind（強さは天気の i）
//     天気の無いとき（控えめに。町・屋内は鳴らさない）:
//            火山の中（bgm volcano）→volcano、洞窟・坑道・氷の洞窟のダンジョン→cave、墓（tomb）→cave の雫なし、
//            船（id に _ship_ のダンジョン）→sea のこもった波、
//            地方の天気の表（weather.js の AUTO）にある野・ダンジョンで晴れを引いたとき → その地方の床を弱く、雪の野（bgm ice）→snow を弱く
//   night = 夜空の星の量（R.Sky.at(R.Tier.get()).stars、0.25 刻み）。森・風の丘で昼の鳥 ↔ 夜の虫を分ける
//   砂嵐の間は F.wxGust（絵の風の帯のうねり）を R.Audio.ambienceMod に渡し続ける。
//   reduceMotion・効果 off は音に効かない（天気の絵が出なくても音は鳴る）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});

  const WX_BED = { snow: 'snow', blizzard: 'blizzard', mist: 'mist', sandstorm: 'sandstorm', heat: 'heat', fog: 'marsh', drizzle: 'rain', ash: 'ash', rays: 'forest', leaves: 'breeze', stars: 'highwind' };
  // 地方の床（晴れのとき）: 表の最初の天気 → 床と強さ
  const BASE = { sandstorm: ['wind', 0.35], heat: ['wind', 0.3], fog: ['marsh', 0.5], drizzle: ['sea', 0.6], ash: ['ash', 0.35], rays: ['forest', 0.5], leaves: ['breeze', 0.5], stars: ['highwind', 0.4] };
  const NIGHT_BEDS = { forest: 1, breeze: 1, marsh: 1 };

  function coastal(m) { return m.bgm === 'isles' || m.bgm === 'sea' || m.theme === 'harbor'; }
  function withNight(spec, night) {
    if (spec && NIGHT_BEDS[spec.bed] && spec.night == null) spec.night = night;
    return spec;
  }

  F.ambienceFor = function (m, wx, night) {
    if (!m) return null;
    night = night == null ? 1 : night;
    if (Object.prototype.hasOwnProperty.call(m, 'ambience')) {
      const a = m.ambience;
      if (!a) return null;
      return withNight(typeof a === 'string' ? { bed: a, i: 1 } : Object.assign({ i: 1 }, a), night);
    }
    if (wx && WX_BED[wx.kind]) {
      const spec = { bed: WX_BED[wx.kind], i: wx.i == null ? 1 : wx.i };
      if (wx.kind === 'drizzle' && coastal(m)) spec.surf = 0.8;
      return withNight(spec, night);
    }
    if (m.kind === 'town' || m.kind === 'interior' || m.kind === 'world') return null;
    if (m.bgm === 'volcano') return { bed: 'volcano', i: 0.8 };
    if (m.kind === 'dungeon') {
      if (m.theme === 'cave' || m.theme === 'mine' || m.theme === 'ice_cave') return { bed: 'cave', i: 0.8 };
      if (m.theme === 'tomb') return { bed: 'cave', i: 0.5, dry: true };
      if (/_ship_/.test(m.id || '')) return { bed: 'sea', i: 0.45, muffled: true };
    }
    const auto = F._WX_AUTO && F._WX_AUTO[m.id];
    if (auto && auto.length && BASE[auto[0].k]) {
      const b = BASE[auto[0].k];
      return withNight({ bed: b[0], i: b[1] }, night);
    }
    if (m.kind === 'field' && m.bgm === 'ice') return { bed: 'snow', i: 0.4 };
    return null;
  };

  function night() {
    try { const S = R.Sky && R.Sky.at ? R.Sky.at(R.Tier.get()) : null; return S ? Math.round(S.stars * 4) / 4 : 1; } catch (e) { return 1; }
  }
  function inBattle() {
    const E = R.Engine;
    if (E.has('battle')) return true;
    const T = R.Battle && R.Battle._ && R.Battle._.trans;
    return !!(T && T.state);
  }
  /** いま鳴らす床（spec | null）と、消すときの速さ */
  F._ambienceWant = function () {
    const E = R.Engine, S = F._s;
    if (!E || !E.has('field') || !S || !S.map) return { spec: null, fade: 1.2 };
    if (inBattle()) return { spec: null, fade: 0.6 };
    let wx = null;
    try { wx = F.weatherNow ? F.weatherNow() : null; } catch (e) { wx = null; }
    return { spec: F.ambienceFor(S.map, wx, night()), fade: 1.2 };
  };

  let acc = 1e9;
  function tick(dt, real) {
    const A = R.Audio;
    if (!A || !A.ambience) return;
    acc += real || dt || 16;
    if (acc < 250) return;
    acc = 0;
    let w;
    try { w = F._ambienceWant(); } catch (e) { w = { spec: null, fade: 1.2 }; }
    A.ambience(w.spec, { fade: w.fade });
    if (A.ambienceMod) A.ambienceMod(w.spec && w.spec.bed === 'sandstorm' && F.wxGust ? F.wxGust(R.Engine.time / 1000) : null);
  }
  F._ambienceTick = tick;
  if (R.Engine && R.Engine.addTick) R.Engine.addTick(tick);
})(window.RPG);
