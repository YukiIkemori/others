// Contracts（CORE。リードだけが書き換える）: 担当どうしの受け渡しの形（V2_PLAN §2.5・§2.6）と、その検査
//
//   R.Contract.check(kind, obj) → {ok, errors:[…]}      データ・場面・出来事などの形
//   R.Contract.checkApi(name, ns?) → {ok, errors}         名前空間の関数がそろっているか（ns を省くと R から探す）
//   R.Contract.checkAll() → {ok, errors}                  §2.5 の全部の名前空間（仮の実装を含む）
//   R.Contract.assert(kind, obj)                           合わなければ例外
//   R.Contract.VERSION                                     変えたら requests.jsonl に {from:'lead', to:'all', what:'contract', ver}
//   R.Contract.KINDS / R.Contract.API                      一覧
//
// 型の書き方: 'string' 'number' 'int' 'bool' 'fn' 'array' 'object' 'any' 'null'、'|' で「どれか」、
//   '"lit"' は決まった文字、'string[]' は文字列の配列。キーの最後の '?' は「無くてよい」。
//   入れ子は {…}（その形の物）、[{…}]（その形の物の配列）。
// P1 の間は「足すだけ」（名前を変える・消すのは P2 の後、§4.1）。
(function (R) {
  'use strict';
  const VERSION = 1;

  // ================================================================ データの形
  const K = {};
  // --- 土台（§2.5.1）
  K.scene = { id: 'string', enter: 'fn', exit: 'fn', update: 'fn', draw: 'fn', 'onLayout?': 'fn', 'opaque?': 'bool', 'tick?': 'fn' };
  K.rng = { next: 'fn', int: 'fn', pick: 'fn', chance: 'fn' };
  K.layout = { W: 'int', H: 'int', SCALE: '2|4', layout: '"wide"|"tall"', uiScale: 'number', safe: { l: 'number', t: 'number', r: 'number', b: 'number' } };
  // --- 入力（§2.5.2）
  K.pointer = { x: 'number', y: 'number', down: 'bool', pressed: 'bool', released: 'bool', longPress: 'bool', wheel: 'number' };
  K.prompt = { kind: '"pad"|"kb"|"touch"', label: 'string' };
  // --- セーブ（§2.5.3）
  K.saveCard = { place: 'string', chapter: 'int', playMs: 'number', date: 'number', faces: 'string[]' };
  K.saveCardEntry = { slot: '"auto"|"suspend"|"s1"|"s2"|"s3"', card: 'object|null' };
  // --- 音（§2.5.4）
  K.media = { 'bgm?': 'object', 'voice?': 'object', 'portraits?': 'object' };
  // --- 描画（§2.5.5）
  K.frame = { c: 'object', ox: 'number', oy: 'number' };
  K.sheet = { frames: [K.frame], poses: 'object', 'fps?': 'object', anchors: 'object', w: 'number', h: 'number', 'shadow?': 'array', 'meta?': 'object' };
  K.mood = { ambient: 'string', lightDir: 'any', shadow: 'any', grade: { sh: 'any', hi: 'any', lift: 'number', sat: 'number' }, vignette: 'number', bloom: 'number' };
  K.sky = { ambientMul: 'number', horizon: 'any', tint: 'any' };
  K.hdStats = { bytes: 'number', byKind: 'object', queue: 'number', bakedMs: 'object' };
  K.light = { x: 'number', y: 'number', r: 'number', color: 'string', 'k?': 'number', 'kind?': 'string' };
  // --- UI（§2.5.6）
  K.say = { 'name?': 'string', 'title?': 'string', 'face?': 'string|bool', text: 'string|array', 'voice?': 'string', 'choices?': 'string[]' };
  K.promptItem = { btn: 'string', label: 'string' };
  // --- 地形（§2.5.8）
  K.job = { step: 'fn', done: 'bool', 'result?': 'any' };
  K.chunkResult = { base: 'any', over: 'any', lights: 'array', glows: 'array', props: [{ key: 'string', x: 'number', y: 'number', sortY: 'number', 'frame?': 'any', 'lv?': 'int' }] };
  K.material = { bake: 'fn', edge: '"soft"|"hard"', walk: 'bool' };
  K.ambient = { ambient: 'string', k: 'number', mood: 'string' };
  // --- フィールド（§2.5.9）
  K.pos = { map: 'string', x: 'int', y: 'int', dir: '"s"|"n"|"e"|"w"' };
  K.warpEntry = { id: 'string', name: 'string', region: 'string', kind: '"town"|"dungeon"' };
  // --- イベント（§2.5.10）
  K.event = { run: 'fn', 'once?': 'bool', 'cond?': 'any', 'meta?': { 'needs?': 'array', 'gives?': 'array', 'calls?': 'array' } };
  // --- 規則（§2.5.12）
  K.growRow = { c: 'any', hp: 'number', mp: 'number' };
  K.glimmerHit = { kind: '"tech"|"spell"', id: 'string' };
  // --- 戦闘（§2.5.13）
  K.setup = {
    'troop?': 'string', 'mons?': 'array', 'zone?': 'string', 'tier?': 'int', 'lvOff?': 'number', 'bg?': 'string', 'bgm?': 'string',
    'noEscape?': 'bool', 'canLose?': 'bool', 'noRare?': 'bool', 'noGolden?': 'bool', 'glimmerForce?': 'any', 'members?': 'string[]',
    'dark?': 'bool', 'boss?': 'bool',
  };
  K.unit = {
    uid: 'string|int', side: '"party"|"enemy"', id: 'string', name: 'string', hp: 'number', mp: 'number', maxHp: 'number', maxMp: 'number',
    row: '"front"|"back"', status: 'array', sprite: 'string|null', size: 'any', alive: 'bool', 'wtype?': 'string|null',
  };
  K.option = { cmd: '"attack"|"skill"|"spell"|"defend"|"item"', 'list?': [{ id: 'string', name: 'string', 'mp?': 'number', usable: 'bool', 'reason?': 'string|null', 'isNew?': 'bool' }], target: '"enemy"|"enemies"|"ally"|"allies"|"self"' };
  K.rewards = { gold: 'number', drops: [{ item: 'string', grade: 'string' }], grow: 'array', prof: 'array', glimmers: 'array' };
  K.battleResult = { result: '"win"|"lose"|"escape"|"abort"', 'to?': '"inn"|"title"', 'rewards?': 'object|null' };
  K.telegraph = { text: 'string', pose: 'string', tint: 'string', next: 'string', guard: 'string' };
  const BEV = {
    turn: { uid: 'any' }, act: { uid: 'any', cmd: 'string', id: 'any', name: 'string', targets: 'array' },
    dmg: { uid: 'any', n: 'number', 'crit?': 'bool', 'weak?': 'bool', 'kind?': 'string' }, heal: { uid: 'any', n: 'number', 'mp?': 'bool' },
    miss: { uid: 'any' }, status: { uid: 'any', id: 'string', on: 'bool' }, ko: { uid: 'any' }, revive: { uid: 'any' },
    glimmer: { uid: 'any', kind: 'string', id: 'string', name: 'string' }, telegraph: { uid: 'any', text: 'string', pose: 'string', tint: 'string', next: 'string' },
    summon: { uid: 'any', mon: 'any' }, flee: { uid: 'any' }, steal: { uid: 'any', target: 'any', item: 'string|null', 'grade?': 'string', 'stealOnly?': 'bool' },
    gain: { item: 'string', grade: 'string', 'stolen?': 'bool', 'stealOnly?': 'bool' }, grow: { c: 'any', hp: 'number', mp: 'number' },
    prof: { c: 'any', key: 'string' }, msg: { text: 'string' }, end: { result: '"win"|"lose"|"escape"' },
  };
  // --- 手がかり・ティア（§2.5.14、§2.6.4）
  K.lead = { title: 'string', text: 'string', region: 'string', 'from?': 'string', 'place?': 'string', 'dir?': 'string', 'done?': 'any', 'hideWhen?': 'any', kind: '"main"|"region"|"side"|"rumor"|"map"', 'slice?': '"locked"' };
  K.leadGroup = { region: 'string', items: [{ id: 'string', state: '"new"|"open"|"done"', pinned: 'bool' }] };
  // --- 顔絵（§2.5.16）
  K.portraitParse = { look: 'string', expr: '"neutral"|"smile"|"sad"|"angry"|"surprise"' };
  // --- データ（§2.6）
  K.mapObject = { type: '"building"|"prop"|"chest"|"spring"|"brazier"|"waylamp"|"switch"|"trail"|"sign"|"stairs"|"door"|"examine"', 'id?': 'string', 'x?': 'int', 'y?': 'int', 'lv?': '0|1' };
  K.npc = {
    id: 'string', look: 'string', x: 'int', y: 'int', 'dir?': '"s"|"n"|"e"|"w"', 'move?': 'string|object', 'pushable?': 'bool', 'talk?': 'string|object',
    'cond?': 'any', 'reward?': '"lead"|"side"|"discount"|"hint"|"item"|"boss"|"news"|null', 'key?': 'string', 'lv?': '0|1',
  };
  K.map = {
    id: 'string', name: 'string', kind: '"town"|"interior"|"dungeon"|"world"', 'optional?': 'bool', region: 'string', 'location?': 'string',
    w: 'int', h: 'int', legend: 'object', rows: 'string[]', 'outside?': 'string', 'objects?': [K.mapObject], 'npcs?': [K.npc], spawns: 'object',
    'exits?': [{ x: 'int', y: 'int', w: 'int', h: 'int', to: { map: 'string', spawn: 'string' }, 'cond?': 'any' }],
    'triggers?': [{ id: 'string', x: 'int', y: 'int', w: 'int', h: 'int', on: '"step"|"enter"', event: 'string', 'cond?': 'any', 'once?': 'bool' }],
    'tilePatches?': 'array', 'zones?': [{ rect: 'array|null', zone: 'string' }], 'light?': { ambient: 'string', k: 'number', mood: 'string' },
    'dark?': 'bool|array', 'bgm?': 'string', 'bbg?': 'string', 'oneway?': 'array', 'meta?': 'object',
  };
  K.location = { name: 'string', region: 'string', kind: '"town"|"dungeon"|"place"', map: 'string', spawn: 'string', 'warp?': 'any' };
  K.look = {
    name: 'string', body: { sex: '"m"|"f"', build: '"slim"|"normal"|"sturdy"', age: '"adult"|"youth"|"short"|"old"' }, skin: 'string', eyes: 'string',
    hair: { style: 'string', color: 'string', ears: '"hidden"|"show"|"elf"' },
    outfit: { type: '"tunic"|"armor"|"robe"|"coat"|"gi"|"light"|"dwarf"|"hakama"', main: 'string', sub: 'string', trim: 'string' },
    'mantle?': 'any', 'headwear?': 'any', 'extras?': 'array', hue: 'number', silhouette: 'string',
  };
  K.char = {
    id: 'string', name: 'string', look: 'string', 'type?': 'string', gl: 'number', hp: 'number', mp: 'number',
    equip: { weapon1: 'string|null', shield: 'string|null', head: 'string|null', body: 'string|null', hands: 'string|null', feet: 'string|null', acc1: 'string|null', acc2: 'string|null' },
    wprof: 'object', eprof: 'object', techs: 'array', spells: 'array', status: 'array', row: '"front"|"back"',
  };
  K.game = {
    ver: '2', seed: 'number', playMs: 'number', chapter: 'number', hero: 'string', chars: 'object', party: 'string[]', reserve: 'string[]', joined: 'string[]',
    gold: 'number', items: 'object', flags: 'object', vars: 'object', choices: 'object', tier: 'int', pendingTier: 'any', cleared: 'object',
    pos: { map: 'string', x: 'int', y: 'int', dir: 'string' }, lastTown: 'any', lastInn: 'any', visited: 'object', warps: 'object',
    chests: 'object', secrets: 'object', springs: 'object', lit: 'object', lamps: 'object', leads: 'object', heard: 'object', seenSkill: 'object',
    book: { mon: 'object' }, chronicle: { chapters: 'array' }, guest: 'object|null', battle: { cursor: 'object', lastRound: 'array' },
  };
  K.fixtureState = {
    desc: 'string', hero: { type: 'string', sex: '"m"|"f"', name: 'string' }, party: 'string[]', 'reserve?': 'string[]', 'tier?': 'int',
    'gl?': 'object|"auto"', 'prof?': '"auto"|object', 'flags?': 'object', 'vars?': 'object', 'items?': 'object', 'gold?': 'number', 'leads?': 'string[]',
    map: { id: 'string', 'spawn?': 'string' },
  };
  K.fixtureScene = { scene: '"battle"|"screen"|"map"|"event"', 'desc?': 'string', 'state?': 'string', 'setup?': 'object', 'id?': 'string', 'params?': 'any', 'map?': 'string', 'spawn?': 'string', 'event?': 'string' };
  K.report = { owner: 'string', phase: 'string', date: 'string', done: 'array', files: 'array', tests: 'object', shots: 'array', 'looked?': 'bool', open: 'array', requests: 'array' };
  K.request = { from: 'string', to: 'string', 'file?': 'string', what: 'string', 'why?': 'string', 'ver?': 'number' };

  // ================================================================ 名前空間の関数（§2.5）
  const API = {
    R: ['wait', 'until', 'fit', 'on', 'off', 'emit', 'rng'],
    Engine: ['push', 'pop', 'replace', 'await', '#time', '#dt', '#frame'],
    Gfx: ['@g', 'reset'],
    Input: ['@BTN', 'down', 'pressed', 'released', 'repeat', 'dir8', '@pointer', '#lastDevice', 'prompt', 'consume', 'touchLayout'],
    Save: ['cards', 'save', 'load', 'remove', 'autosave', 'suspend', 'passphrase', 'fromPassphrase', 'checkpoint', 'restore'],
    Settings: ['get', 'set', '@defaults'],
    Audio: ['bgm', 'pushBgm', 'popBgm', 'stopBgm', 'sfx', 'jingle', 'voice', 'stopVoice'],
    Hd: ['def', 'get', 'now', 'want', 'pump', 'ready', 'draw', 'blur', 'mood', 'grade', 'quality', '@STYLE', '@BUDGET', 'stats', 'pin', 'unpin', 'has'],
    Light: ['compose', 'glow', 'ring'],
    Post: ['frame'],
    Sky: ['at'],
    UIK: ['@T', 'text', 'measure', 'fit', 'panel', 'fadePanel', 'card', 'chip', 'toast', 'bubble', 'focus', 'gauge', 'icon', 'stars', 'snapshot', 'List', 'Layer', '@Message', 'prompts', 'portraitFrame'],
    'UIK.Message': ['say', 'busy', 'close'],
    Terrain: ['#CHUNK', 'bakeChunk', 'dirty', 'prewarm', 'building', 'material', 'ambient', 'worldThumb'],
    Field: ['enter', '@pos', 'lock', 'unlock', 'npc', 'setGuest', '@camera', 'flash', 'shake', '@hud', '@encounter', 'passable', 'warpList', 'warp', 'escape'],
    'Field.camera': ['focus', 'follow'],
    'Field.hud': ['toast', 'refresh'],
    'Field.encounter': ['suppress', 'ward'],
    Events: ['run', 'busy', 'abort', 'talk'],
    State: ['newGame', 'serialize', 'deserialize', 'wipeRecover', 'check'],
    Rules: ['@K', 'abilMul', 'stats', 'preview', 'optimize', 'applyLoadout', 'profRank', 'train', 'commandList', 'canEquip', 'fillItem', 'profAt'],
    Growth: ['init', 'baseMax', 'afterBattle', 'equivLevel', 'cap', 'glAt'],
    Glimmer: ['roll'],
    Party: ['members', 'reserve', 'swap', 'setRow', 'join', 'heal', 'fullHeal'],
    Mon: ['encounter'],
    BattleCore: ['create'],
    BattleAI: ['enemyCommand', 'partyCommand'],
    Battle: ['start'],
    Leads: ['add', 'pin', 'unpin', 'list', 'done', 'pinned'],
    Mini: ['sequence', 'timing'],
    Tier: ['get', 'effective', 'pending', 'consumePending', 'celebrate'],
    Screens: ['open', 'tip', 'detail'],
    Portrait: ['key', 'has', 'draw', 'parse'],
  };
  // 戦闘の 1 回（R.BattleCore.create の結果）と ev（イベントの第 1 引数）
  const OBJ_API = {
    battle: ['@units', 'options', 'partyOptions', 'submit', 'repeat', '?repeatOn', 'setRepeat', 'round', '?over', 'rewards'],
    ev: ['say', 'choose', 'caption', 'fade', 'wait', 'flag', 'setFlag', 'var', 'addVar', 'item', 'take', 'gold', 'has', 'battle', 'warp', 'heal', 'rest',
      'inn', 'shop', 'tavern', 'chooseCompanions', 'createHero', 'lead', 'leadDone', 'choice', 'choiceOf', 'clearRegion', 'npc', 'guest', 'camera',
      '@mini', 'letter', 'call', 'g', 'bgm', 'sfx', 'jingle'],
    fieldNpc: ['move', 'face', 'act', 'hide', 'show', 'setPos'],
    list: ['update', 'draw'],
  };
  const SCREEN_IDS = ['title', 'charcreate', 'nameentry', 'partySelect', 'menu', 'items', 'skills', 'equip', 'status', 'order', 'bestiary',
    'chronicle', 'map', 'save', 'load', 'settings', 'shop', 'inn', 'tavern', 'passphrase', 'detail', 'tip', 'warp'];
  const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];

  // ================================================================ 検査
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }
  function matchOne(t, v) {
    t = t.trim();
    if (t === 'any') return true;
    if (t.charAt(0) === '"') return v === t.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(t)) return v === +t;
    if (t.endsWith('[]')) return Array.isArray(v) && v.every((x) => matchOne(t.slice(0, -2), x));
    switch (t) {
      case 'string': return typeof v === 'string';
      case 'number': return typeof v === 'number' && !isNaN(v);
      case 'int': return Number.isInteger(v);
      case 'bool': return typeof v === 'boolean';
      case 'fn': return typeof v === 'function';
      case 'array': return Array.isArray(v);
      case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
      case 'null': return v === null;
      default: return false;
    }
  }
  function matchType(t, v) { return t.split('|').some((a) => matchOne(a, v)); }
  function checkShape(schema, obj, path, errs) {
    if (typeof schema === 'string') {
      if (!matchType(schema, obj)) errs.push(`${path}: expected ${schema}, got ${short(obj)}`);
      return;
    }
    if (Array.isArray(schema)) {
      if (!Array.isArray(obj)) { errs.push(`${path}: expected array, got ${short(obj)}`); return; }
      obj.forEach((x, i) => checkShape(schema[0], x, `${path}[${i}]`, errs));
      return;
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { errs.push(`${path}: expected object, got ${short(obj)}`); return; }
    for (const key of Object.keys(schema)) {
      const opt = key.endsWith('?');
      const k = opt ? key.slice(0, -1) : key;
      const has = Object.prototype.hasOwnProperty.call(obj, k) || (typeof obj === 'object' && k in obj);
      if (!has || obj[k] === undefined) { if (!opt) errs.push(`${path}.${k}: missing`); continue; }
      checkShape(schema[key], obj[k], `${path}.${k}`, errs);
    }
  }
  function short(v) {
    let s;
    try { s = typeof v === 'function' ? 'function' : JSON.stringify(v); } catch (e) { s = String(v); }
    s = s === undefined ? 'undefined' : s;
    return typeOf(v) + ' ' + (s.length > 60 ? s.slice(0, 60) + '…' : s);
  }

  // 形のほかの決まり（中身の検査）
  const EXTRA = {
    map(m, errs) {
      if (Array.isArray(m.rows)) {
        if (m.rows.length !== m.h) errs.push(`map ${m.id}: rows ${m.rows.length} != h ${m.h}`);
        m.rows.forEach((r, y) => {
          if (typeof r !== 'string') return;
          if ([...r].length !== m.w) errs.push(`map ${m.id}: row ${y} length ${[...r].length} != w ${m.w}`);
          for (const ch of r) if (m.legend && !m.legend[ch]) { errs.push(`map ${m.id}: row ${y} char '${ch}' not in legend`); break; }
        });
      }
      for (const o of m.objects || []) {
        if (m.kind === 'world' && o.type === 'chest') errs.push(`map ${m.id}: chest on the world map (A27)`);
      }
      for (const ch of Object.keys(m.legend || {})) {
        const l = m.legend[ch];
        if (l && l.secret && m.kind !== 'dungeon') errs.push(`map ${m.id}: secret cell '${ch}' outside a dungeon (A15・A27)`);
      }
      for (const sp of Object.keys(m.spawns || {})) {
        const s = m.spawns[sp];
        if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y)) errs.push(`map ${m.id}: spawn ${sp} needs integer x, y`);
      }
    },
    setup(s, errs) { if (!s.troop && !s.mons) errs.push('setup: needs troop or mons'); },
    battleEvent(e, errs) {
      const shape = BEV[e && e.t];
      if (!shape) { errs.push(`battleEvent: unknown t ${short(e && e.t)}`); return; }
      checkShape(shape, e, 'battleEvent.' + e.t, errs);
    },
    look(l, errs) { if (typeof l.hue === 'number' && (l.hue < 0 || l.hue >= 360)) errs.push('look.hue: 0〜359'); },
    char(c, errs) { if (c.equip && 'weapon2' in c.equip) errs.push('char.equip.weapon2: removed (A29)'); },
  };

  function check(kind, obj) {
    const errs = [];
    if (kind === 'battleEvent') { EXTRA.battleEvent(obj, errs); return { ok: !errs.length, errors: errs }; }
    if (kind.indexOf('api:') === 0) return checkApi(kind.slice(4), obj);
    if (OBJ_API[kind]) return checkNames(OBJ_API[kind], obj, kind);
    const schema = K[kind];
    if (!schema) return { ok: false, errors: [`unknown contract kind '${kind}'`] };
    checkShape(schema, obj, kind, errs);
    if (!errs.length && EXTRA[kind]) EXTRA[kind](obj, errs);
    return { ok: !errs.length, errors: errs };
  }
  function checkNames(names, ns, label) {
    const errs = [];
    if (ns == null) return { ok: false, errors: [`${label}: missing`] };
    for (const n of names) {
      const kind = n.charAt(0);
      const name = /[@#?]/.test(kind) ? n.slice(1) : n;
      const v = ns[name];
      if (kind === '?') continue;
      if (kind === '@') { if (v == null) errs.push(`${label}.${name}: missing`); continue; }
      if (kind === '#') { if (typeof v !== 'number' && typeof v !== 'string') errs.push(`${label}.${name}: expected a value, got ${short(v)}`); continue; }
      if (typeof v !== 'function') errs.push(`${label}.${name}: expected function, got ${short(v)}`);
    }
    return { ok: !errs.length, errors: errs };
  }
  function resolve(name) {
    if (name === 'R') return R;
    return name.split('.').reduce((o, k) => (o == null ? o : o[k]), R);
  }
  function checkApi(name, ns) {
    if (!API[name]) return { ok: false, errors: [`unknown api '${name}'`] };
    return checkNames(API[name], ns === undefined ? resolve(name) : ns, name === 'R' ? 'R' : 'R.' + name);
  }
  function checkAll() {
    const errors = [];
    for (const name of Object.keys(API)) errors.push(...checkApi(name).errors);
    return { ok: !errors.length, errors };
  }

  R.Contract = {
    VERSION,
    KINDS: Object.keys(K).concat(['battleEvent'], Object.keys(OBJ_API)),
    API,
    OBJ_API,
    BATTLE_EVENTS: BEV,
    SCREEN_IDS,
    EXPRS,
    SCHEMAS: K,
    check,
    checkApi,
    checkAll,
    assert(kind, obj) {
      const r = check(kind, obj);
      if (!r.ok) throw new Error(`contract ${kind}: ` + r.errors.join('; '));
      return true;
    },
  };
})(window.RPG);
