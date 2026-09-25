// Sound test (audio A17 fixture — not part of the game). Build with
//   node tools/build.js --with tools/fixtures/audio      → debug_audio.html
// Every id of DESIGN §11.11.4 can be auditioned: ←→ (or L/R) picks BGM / ジングル / 効果音,
// ↑↓ picks an id, A plays it, B stops the BGM, Y rings the glimmer over the current BGM (duck check).
// window.__soundtest = { select(kind, id), play(), state() } for tools/shot.js automation.
(function (R) {
  'use strict';
  const I = () => R.Audio.IDS;
  const KINDS = ['bgm', 'jingles', 'sfx'];
  const KIND_NAME = { bgm: 'BGM', jingles: 'ジングル', sfx: '効果音' };
  // where each id sounds (DESIGN §11.10.4 / §11.10.5)
  const WHERE = {
    title: 'タイトル', overworld: 'ワールドマップ', sea: '船', town: '町', village: '村', castle: '城',
    shrine: '神殿・正体', ending: 'エンディング', dungeon: 'ダンジョン', cave: '洞窟・坑道', tower: '灯台・塔',
    pyramid: '砂の王墓', ice: '白竜の峰', volcano: '灰の火山', lastdungeon: '白の大書庫', battle: '戦闘',
    boss: 'ボス', lastboss: 'ネムレア', valzard: '魔王の残影', tavern: '酒場・仲間選び', home: 'ロアの里',
    rival: 'ロウェル戦', tension: '緊迫・ラザロ', sorrow: 'ビブリア', boss2: '地方ボス', rarebattle: '金色・レア',
    superboss: '円環竜', postgame: '忘却の底', forest: '迷いの森', ghost: '霧の館・沼・船', hollowking: '虚ろの王',
    legend: '伝説の語り',
    victory: '勝利', levelup: 'レベルアップ', item: '宝箱', keyitem: '大事なもの', inn: '宿屋', save: 'セーブ',
    gameover: '全滅', rare: 'レア', superrare: '超レア', chapter: '章が記される', recruit: '仲間が加わる',
    glimmer: '閃き', golden: '金色の登場', light: '光の術', freeze: '凍結', burn: 'やけど', quill: '羽ペン',
    page: 'ページ', swap: '入れ替え', bell: '帰り道の鈴', unlock: '道が開く', arrow: '弓', lash: '鞭',
    parry: '受け流し', secret: '隠し通路',
    cursor: 'カーソル', confirm: '決定', confirm_soft: '軽い決定', cancel: '取り消し', buzzer: 'できない',
    menu_open: 'メニュー', attack: '攻撃', hit: '当たり', crit: '痛い一撃', miss: '空振り', enemy_attack: '敵の攻撃',
    hurt: '味方が受ける', magic: '術', fire: '火', ice: '氷', thunder: '雷', wind: '風', holy: '聖なる光', dark: '闇',
    earth: '土', water: '水', heal: '回復', revive: '復活', buff: '強化', debuff: '弱体', status: '状態異常',
    poison: '毒', sleep: '眠り', death: '倒れる', enemy_die: '敵を倒す', boss_die: 'ボスを倒す', escape: '逃げる',
    stairs: '階段', door: '扉', locked: '鍵', chest: '宝箱を開ける', gold: 'お金', step_damage: 'ダメージ床',
    ship: '船', bump: '壁', warp: 'ワープ', teleport: '移動の術', steal: '盗む', jump: 'かばう', breath: '息',
    roar: 'ボスの登場', shake: '揺れ',
  };
  const SFX_KIND = {};
  for (const [k, ids] of Object.entries({
    UI: 'cursor confirm confirm_soft cancel buzzer menu_open page swap',
    '戦闘': 'attack hit crit miss enemy_attack hurt arrow lash parry glimmer golden escape enemy_die boss_die death roar breath steal jump',
    '術': 'magic fire ice thunder wind holy dark earth water light freeze burn heal revive buff debuff status poison sleep',
    'フィールド': 'stairs door locked chest item gold step_damage ship bump warp teleport shake quill bell unlock secret',
  })) for (const id of ids.split(' ')) SFX_KIND[id] = k;
  const ROWS = 11;

  class SoundTest extends R.Layer {
    constructor() {
      super();
      this.opaque = true;
      this.kind = 0;
      this.idx = { bgm: 0, jingles: 0, sfx: 0 };
      this.top = { bgm: 0, jingles: 0, sfx: 0 };
      this.last = '';
    }
    get k() { return KINDS[this.kind]; }
    list() { return I()[this.k]; }
    id() { return this.list()[this.idx[this.k]]; }
    play() {
      const id = this.id();
      if (R.Audio.init) R.Audio.init();
      if (this.k === 'bgm') R.bgm(id, { fade: 10 });
      else if (this.k === 'jingles') R.jingle(id);
      else R.sfx(id);
      this.last = `${KIND_NAME[this.k]} ${id}`;
    }
    update() {
      const In = R.Input;
      if (In.pressed('left') || In.pressed('l')) { this.kind = (this.kind + 2) % 3; R.sfx('page'); }
      if (In.pressed('right') || In.pressed('r')) { this.kind = (this.kind + 1) % 3; R.sfx('page'); }
      const n = this.list().length;
      if (In.repeat('up')) this.idx[this.k] = (this.idx[this.k] + n - 1) % n;
      if (In.repeat('down')) this.idx[this.k] = (this.idx[this.k] + 1) % n;
      const i = this.idx[this.k];
      if (i < this.top[this.k]) this.top[this.k] = i;
      if (i >= this.top[this.k] + ROWS) this.top[this.k] = i - ROWS + 1;
      if (In.pressed('a')) this.play();
      if (In.pressed('b')) { R.Audio.stopBGM(20); this.last = 'BGM 止めた'; }
      if (In.pressed('y')) { R.sfx('glimmer'); this.last = '閃き（重ねる）'; }
    }
    draw() {
      const G = R.Gfx, C = G.C;
      G.clear('#05070f');
      // header with the three tabs
      G.window(4, 4, 248, 22);
      G.text('サウンドテスト', 12, 9, { color: C.gold });
      KINDS.forEach((k, j) => {
        const x = 94 + j * 52, on = j === this.kind;
        if (on) G.rect(x, 8, 48, 14, '#2c3c78');
        G.text(`${KIND_NAME[k]}`, x + 4, 9, { color: on ? C.white : C.gray, size: 8 });
        G.text(String(I()[k].length), x + 45, 13, { color: on ? C.cyan : '#5a6280', size: 6, align: 'right' });
      });
      // id list
      G.window(4, 28, 124, 164);
      const L = this.list(), top = this.top[this.k];
      for (let r = 0; r < ROWS && top + r < L.length; r++) {
        const i = top + r, y = 36 + r * 14, id = L[i];
        const sel = i === this.idx[this.k];
        G.text(String(i + 1).padStart(2, '0'), 20, y + 1, { color: C.dark, size: 7 });
        G.fitText(id, 34, y, 86, { color: sel ? C.white : '#c8c8d8' });
        if (sel) G.cursor(10, y);
      }
      if (top > 0) G.text('▲', 110, 31, { size: 6, color: C.gray });
      if (top + ROWS < L.length) G.text('▼', 110, 184, { size: 6, color: C.gray });
      // details of the selected id
      G.window(132, 28, 120, 164);
      const id = this.id(), d = R.DB.music[id];
      G.fitText(id, 140, 36, 104, { color: C.gold });
      G.fitText(WHERE[id] || '', 140, 50, 104, { color: C.white });
      let y = 68;
      const row = (a, b, col) => { G.text(a, 140, y, { color: '#c8c8d8', size: 8 }); G.fitText(b, 244, y, 62, { color: col || C.white, size: 8, align: 'right' }); y += 12; };
      if (this.k !== 'sfx' && d) {
        const inf = R.Audio.info(id);
        row('調', d.key || 'C');
        row('リズム', d.meter || '4/4');
        row('テンポ', '♩' + d.tempo);
        row('長さ', inf.duration.toFixed(1) + 's');
        row('ループ', inf.loop ? (inf.loopEnd - inf.loopStart).toFixed(1) + 's' : 'なし');
        row('ゲイン', String(d.gain));
      } else {
        row('分類', SFX_KIND[id] || '—');
        if (R.Audio.FALLBACK.sfx[id]) row('代わり', R.Audio.FALLBACK.sfx[id], C.gray);
      }
      // now playing
      const st = R.Audio.debug ? R.Audio.debug() : {};
      G.rect(138, 146, 108, 1, '#3a4670');
      G.text('再生中', 140, 150, { color: '#c8c8d8', size: 8 });
      G.fitText(st.jingle ? '♪ ' + st.jingle : st.current || '—', 244, 150, 64, { color: st.jingle ? C.rare : C.cyan, size: 8, align: 'right' });
      const cur = st.current && R.Audio.info(st.current);
      const ratio = cur && cur.duration ? Math.min(1, (st.pos || 0) / cur.duration) : 0;
      G.bar(140, 164, 104, 4, ratio, C.cyan, '#1a2244');
      G.text(st.ctx === 'running' ? '音：オン' : '音：Aで開始', 140, 172, { color: st.ctx === 'running' ? C.green : C.orange, size: 7 });
      G.fitText(this.last, 244, 172, 60, { color: C.gray, size: 7, align: 'right' });
      // help
      G.window(4, 194, 248, 26);
      G.text('←→ 種類　↑↓ 選ぶ　A 鳴らす　B 止める　Y 閃きを重ねる', 128, 201, { align: 'center', size: 8, color: '#c8c8d8' });
    }
  }

  let layer = null;
  R.on('booted', () => {
    layer = R.Engine.push(new SoundTest());
  });
  window.__soundtest = {
    select(kind, id) { if (!layer) return false; layer.kind = KINDS.indexOf(kind); const i = I()[kind].indexOf(id); if (i < 0) return false; layer.idx[kind] = i; layer.top[kind] = Math.max(0, i - 5); return true; },
    play() { if (layer) layer.play(); return R.Audio.debug(); },
    state() { return R.Audio.debug(); },
  };
})(window.RPG);
