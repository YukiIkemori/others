#!/usr/bin/env node
// i18n: 日本語の文を src から文の表（src/i18n/ja/<分野>.js）へ移す道具（一度きりの書き換え＋あとから足した文の移し）
//
//   node v2/tools/i18n_extract.js --dry [files…]     書き換えずに、見つけた文と key を出す（files を省くと src 全部）
//   node v2/tools/i18n_extract.js --write [files…]   ソースの日本語の文字列を R.T('key') に置き換え、表へ足す
//   オプション: --only <dir>（'data' 'events' など src の下の 1 段目）  --report <file.json>（key と元の位置の一覧）
//
// 置き換え方（位置で切り貼りするので、ほかの書き方は変えない）:
//   '文'                 → R.T('key')
//   `${a}の${b.name}`    → R.T('key', { a, name: b.name })          表: '{a}の{name}'
//   x + 'は' + n + '回'  → R.T('key', { x, n })                     表: '{x}は{n}回'（最初の文字列より左は 1 つの値として残す）
//   ['文1', '文2']       → R.T('key')（全部が日本語の文の配列は 1 つの key に配列で。会話のページなど。訳ではページの数を変えてよい）
// key: <接頭辞>.<錨…>.<項目>。接頭辞は R.def/R.defs の kind（items・techs…）か、<分野>.<ファイル名>（ev.marsh_loch・ui.settings…）。
//   錨は id を持つ物（R.defs の id・E('id', …) などの最初の文字列の引数・{id|value|key: '…'} の物・名前のある関数・代入の名前）。
//   項目はプロパティの名前か、呼ぶ関数の名前（say・caption…）。同じ錨の中の同じ文は同じ key（比べる所でも食い違わない）。
// 置き換えない物: コメント・R.warn/console/throw/loadErrors・正規表現や split などの引数・プロパティの名前・`i18n:ignore` の行。
// acorn（構文木）は node の全体の入れ物から借りる（v2 は依存を持たない。この道具は書き換えの時だけ使う）。
'use strict';
const fs = require('fs');
const path = require('path');

const V2 = path.resolve(__dirname, '..');
const SRC = path.join(V2, 'src');
const OUT = path.join(SRC, 'i18n', 'ja');

function loadAcorn() {
  const tries = ['acorn', '/opt/node22/lib/node_modules/eslint/node_modules/acorn', '/opt/node22/lib/node_modules/ts-node/node_modules/acorn'];
  for (const t of tries) { try { return require(t); } catch (e) { /* 次へ */ } }
  console.error('acorn が見つからない（npm i -g acorn か NODE_PATH を足す）');
  process.exit(2);
}

// 画面に出す日本語（かな・漢字・全角の英数と記号）。句読点・かぎかっこだけの文字列は訳の対象にしない（監査が別に数える）
const JP = /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿！-～ｦ-ﾟ]/;
// 移さないファイル（開発用・仮の実装・ほかの担当が持つ演出のコード・表そのもの）
const SKIP_FILES = [
  /^src\/core\/stubs\//, /^src\/dev\//, /^src\/tester\//, /^src\/i18n\//, /^src\/core\/i18n\.js$/,
  /^src\/art\/fx\/fx_seq_table\.js$/, /^src\/art\/terrain\/materials\.js$/,
  // 手で移す: ns.js（R.T より先に読む）・contracts.js（契約の説明で画面に出ない）・nameentry.js（言語ごとの字の表）
  /^src\/core\/ns\.js$/, /^src\/core\/contracts\.js$/, /^src\/screens\/nameentry\.js$/,
];
// 文字の処理に使う文字列（画面の文ではない）を引数に取る関数
const LOGIC_CALLS = new Set(['split', 'indexOf', 'lastIndexOf', 'includes', 'replace', 'replaceAll', 'startsWith', 'endsWith', 'match', 'matchAll', 'test', 'search', 'padStart', 'padEnd', 'charCodeAt', 'codePointAt', 'localeCompare']);
const DEV_CALLS = /^(console\.\w+|R\.warn|R\.error|R\.log|warn|loadErrors\.push|R\.loadErrors\.push)$/;
// id として錨にしない、話す・出す関数（最初の引数が話し手の id なので）
const TEXT_CALLS = new Set(['say', 'caption', 'choose', 'toast', 'bubble', 'narrate', 'log', 'msg', 'message', 'notice', 'sayAs', 'shout', 'think', 'info', 'popup', 'label', 'banner', 'sign', 'read', 'talk', 'line', 'lines', 'text', 'title', 'hint', 'emote', 'ask', 'confirm', 'yesno', 'pick', 'caption2']);
const ID = /^[A-Za-z_][\w.-]{0,60}$/;

// ------------------------------------------------------------------ 分野（表のファイル）と接頭辞
function domainOf(rel) {
  const p = rel.replace(/^src\//, '');
  const base = path.basename(p, '.js');
  const [top] = p.split('/');
  // 終盤（final_*・*_finale・screens/ending）の文は終盤の表へ（地図は maps_final、ほかは events_final）
  if (/^final_|_finale$/.test(base) || (top === 'screens' && base === 'ending')) return top === 'maps' ? 'maps_final' : 'events_final';
  if (top === 'data') {
    if (/^items_/.test(base)) return 'items';
    if (/^techs_/.test(base)) return 'techs';
    if (/^spells_/.test(base)) return 'spells';
    if (/^monsters_/.test(base)) return 'monsters';
    if (/^(bosses|enemy_actions|troops|encounters|rare|lineages|pools)/.test(base)) return 'enemies';
    if (/^companions$/.test(base)) return 'companions';
    if (/^(herotypes|weapontypes|elements|statuses)$/.test(base)) return 'rules';
    if (/^goals$/.test(base)) return 'goals';
    if (/^(locations|regions|worldmap)/.test(base)) return 'places';
    if (/^shops/.test(base)) return 'shops';
    return 'misc';
  }
  if (top === 'events') return 'events_' + eventRegion(base);
  if (top === 'maps') return 'maps_' + mapRegion(base);
  if (top === 'screens') return base === 'tips' ? 'tips' : 'ui';
  if (top === 'uik' || top === 'core' || top === 'main.js') return 'ui';
  if (top === 'systems') {
    if (/^systems\/battle/.test(p) || /^battle_/.test(base)) return 'battle';
    if (base === 'rules' || base === 'growth' || base === 'glimmer' || base === 'party') return 'rules_sys';
    if (/^systems\/field/.test(p)) return 'field';
    return 'system';
  }
  if (top === 'art') return 'art';
  if (top === 'audio') return 'ui';
  return 'misc';
}
function eventRegion(b) {
  const m = /^(ash|desert|forest|marsh|snow|pharos|prologue|optional|world|yura|isles|mine|star)_?/.exec(b);
  if (m) return m[1] === 'yura' ? 'forest' : m[1] === 'world' ? 'world' : m[1];
  return 'main';   // demo_end・leads_main・secret_hints・story_t1
}
function mapRegion(b) {
  if (/^(elder|verda|fern)_/.test(b) || b === 'yura_village') return 'forest';
  if (/^field_isles_/.test(b)) return 'isles';   // 諸島のエリア（field_isles_*）は諸島の表
  if (/^field_mine_/.test(b)) return 'mine';     // 山地のエリア（field_mine_*）は山地の表
  if (/^field_star_/.test(b)) return 'star';     // 高原のエリア（field_star_*）は高原の表
  if (/^(field|homes_slice|world$|optional_)/.test(b) || b === 'world') return 'field';
  const m = /^(ash|desert|marsh|snow|pharos|prologue|isles|mine|star)_/.exec(b);
  return m ? m[1] : 'field';
}
function prefixOf(rel) {
  const p = rel.replace(/^src\//, '');
  const base = path.basename(p, '.js');
  const top = p.split('/')[0];
  const short = { events: 'ev', maps: 'map', screens: 'ui', uik: 'ui', core: 'ui', systems: 'sys', art: 'art', audio: 'ui', data: 'data', 'main.js': 'ui' }[top] || top;
  if (/^systems\/battle\//.test(p)) return 'battle.' + base;
  return short + '.' + base;
}

// ------------------------------------------------------------------ 文字列の書き方
function q(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\f/g, '\\f')
    .replace(/[\u0000-\u001f\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + "'";
}
function qKey(k) { return /^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k); }
const safeSeg = (s) => String(s).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'x';

// ------------------------------------------------------------------ 1 ファイル
function processFile(acorn, rel, src, keysTaken, opts) {
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true }); }
  catch (e) { return { error: e.message, units: [] }; }
  const lines = src.split('\n');
  const lineOf = (pos) => { let n = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++; return n; };
  const lineStarts = [0]; for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const lineAt = (pos) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
  void lineOf;
  const ignoredLine = (pos) => /i18n:ignore|check_text:ignore/.test(lines[lineAt(pos) - 1] || '');

  // 補助: 名前の文字列
  const srcOf = (n) => src.slice(n.start, n.end);
  const calleeName = (c) => {
    if (!c) return '';
    if (c.type === 'Identifier') return c.name;
    if (c.type === 'MemberExpression' && !c.computed) { const o = calleeName(c.object); return (o ? o + '.' : '') + c.property.name; }
    if (c.type === 'ThisExpression') return 'this';
    return '';
  };
  const lastName = (c) => (c && c.type === 'MemberExpression' && !c.computed ? c.property.name : c && c.type === 'Identifier' ? c.name : '');
  const strVal = (n) => (n && n.type === 'Literal' && typeof n.value === 'string' ? n.value : n && n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : null);
  const isStr = (n) => n && ((n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral');
  const hasJP = (n) => {
    if (!n) return false;
    if (n.type === 'Literal' && typeof n.value === 'string') return JP.test(n.value);
    if (n.type === 'TemplateLiteral') return n.quasis.some((x) => JP.test(x.value.cooked || ''));
    return false;
  };

  // helper の定義: const lead = (id, o) => R.def('leads', id, …)
  const helperKind = {};
  (function scan(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && /Function/.test(n.init.type)) {
      const body = srcOf(n.init);
      const m = /R\.def\(\s*'([A-Za-z]+)'\s*,\s*([A-Za-z_$][\w$]*)/.exec(body);
      const p0 = n.init.params[0];
      if (m && p0 && p0.type === 'Identifier' && m[2] === p0.name) helperKind[n.id.name] = m[1];
    }
    for (const k of Object.keys(n)) { const c = n[k]; if (Array.isArray(c)) c.forEach(scan); else if (c && typeof c.type === 'string') scan(c); }
  })(ast);

  // 集める
  const units = [];
  const consumed = new Set();
  function visit(n, anc) {
    if (!n || typeof n.type !== 'string') return;
    const par = anc[anc.length - 1];
    // 開発用の呼び出しの中は見ない
    if (n.type === 'CallExpression' || n.type === 'NewExpression') {
      const cn = calleeName(n.callee);
      if (DEV_CALLS.test(cn) || (n.type === 'NewExpression' && /^(Error|TypeError|RangeError|RegExp)$/.test(cn)) || /^R\.T$|^T$/.test(cn) && false) return;
    }
    if (n.type === 'ThrowStatement') return;
    if (n.type === 'TaggedTemplateExpression') return;
    // 連結の鎖
    if (n.type === 'BinaryExpression' && n.operator === '+' && !(par && par.type === 'BinaryExpression' && par.operator === '+' && par.left === n)) {
      const ops = [];
      (function flat(x) { if (x.type === 'BinaryExpression' && x.operator === '+') { flat(x.left); ops.push(x.right); } else ops.push(x); })(n);
      const firstStr = ops.findIndex((x) => isStr(x));
      if (firstStr >= 0 && ops.some((x) => hasJP(x)) && !skipCtx(n, anc)) {
        // 最初の文字列より左は 1 つの値（数の足し算を変えない）
        let parts;
        if (firstStr > 1) {
          let x = n; for (let i = ops.length - 1; i > firstStr - 1; i--) x = x.left;
          parts = [x].concat(ops.slice(firstStr));
        } else parts = ops;
        units.push({ kind: 'concat', node: n, parts, anc: anc.slice() });
        for (const p of parts) if (isStr(p)) consumed.add(p);
        // 値の式の中の文字列（x ? 'はい' : 'いいえ' など）は下で拾う
        for (const p of parts) if (!isStr(p)) visit(p, anc.concat([n]));
        for (const p of parts) if (p.type === 'TemplateLiteral') for (const e of p.expressions) visit(e, anc.concat([n, p]));
        return;
      }
    }
    // 文字列の配列
    if (n.type === 'ArrayExpression' && n.elements.length >= 2 && n.elements.every((e) => e && e.type === 'Literal' && typeof e.value === 'string' && JP.test(e.value)) && !skipCtx(n, anc)) {
      units.push({ kind: 'array', node: n, anc: anc.slice() });
      for (const e of n.elements) consumed.add(e);
      return;
    }
    if (hasJP(n) && !consumed.has(n)) {
      if (!(par && par.type === 'Property' && par.key === n && !par.computed) && !skipCtx(n, anc)) {
        units.push({ kind: n.type === 'TemplateLiteral' ? 'tpl' : 'lit', node: n, anc: anc.slice() });
        if (n.type === 'TemplateLiteral') for (const e of n.expressions) visit(e, anc.concat([n]));
        return;
      }
    }
    const a2 = anc.concat([n]);
    for (const k of Object.keys(n)) { const c = n[k]; if (Array.isArray(c)) c.forEach((x) => visit(x, a2)); else if (c && typeof c.type === 'string') visit(c, a2); }
  }
  function skipCtx(n, anc) {
    if (ignoredLine(n.start)) return true;
    const par = anc[anc.length - 1];
    if (par && (par.type === 'CallExpression' || par.type === 'NewExpression') && par.arguments.includes(n)) {
      const ln = lastName(par.callee);
      if (LOGIC_CALLS.has(ln)) return true;
      if (/^(RegExp)$/.test(calleeName(par.callee))) return true;
      if (/^R\.T$|^R\.I18n\./.test(calleeName(par.callee))) return true;
    }
    if (par && par.type === 'Property' && par.key === n) return true;
    if (par && par.type === 'MemberExpression' && par.object === n) {
      // '五十音'.split('') など: 文字の処理
      const pp = anc[anc.length - 2];
      if (par.property && LOGIC_CALLS.has(par.property.name)) return true;
      if (par.property && /^(split|length)$/.test(par.property.name)) return true;
      void pp;
    }
    if (par && par.type === 'MemberExpression' && par.property === n && par.computed) return true;   // obj['名前']
    for (const a of anc) {
      if (a.type === 'CallExpression' && DEV_CALLS.test(calleeName(a.callee))) return true;
      if (a.type === 'NewExpression' && /^(Error|TypeError|RangeError)$/.test(calleeName(a.callee))) return true;
      if (a.type === 'ThrowStatement') return true;
    }
    return false;
  }
  visit(ast, []);

  // ---------------------------------------------------------------- key を決める
  function anchorsOf(u) {
    const segs = [];
    let prefix = null;
    let slot = null;
    const anc = u.anc;
    let child = u.node;
    for (let i = anc.length - 1; i >= 0; i--) {
      const a = anc[i];
      if (a.type === 'Property' && a.value === child && !a.computed) {
        const k = a.key.type === 'Identifier' ? a.key.name : String(a.key.value);
        // R.defs(kind, { id: {…} }) の id
        const obj = anc[i - 1], call = anc[i - 2];
        if (obj && obj.type === 'ObjectExpression' && call && call.type === 'CallExpression' && calleeName(call.callee) === 'R.defs' && call.arguments[1] === obj && strVal(call.arguments[0])) {
          prefix = strVal(call.arguments[0]); segs.unshift(k); break;
        }
        // Object.assign(R.DB.kind, { id: {…} }) の id
        if (obj && obj.type === 'ObjectExpression' && call && call.type === 'CallExpression' && calleeName(call.callee) === 'Object.assign' && call.arguments[1] === obj && /^R\.DB\.\w+$/.test(calleeName(call.arguments[0]))) {
          prefix = calleeName(call.arguments[0]).slice(5); segs.unshift(k); break;
        }
        segs.unshift(k);
        if (slot == null) slot = segs.length;
      } else if (a.type === 'ObjectExpression') {
        // 同じ物の id・value・key を錨に
        const idp = a.properties.find((p) => p.type === 'Property' && !p.computed && p.key && /^(id|value|key)$/.test(p.key.name || p.key.value) && strVal(p.value) != null && ID.test(strVal(p.value)));
        if (idp && idp.value !== child) segs.unshift('@' + strVal(idp.value));
      } else if (a.type === 'ArrayExpression') {
        const idx = a.elements.indexOf(child);
        if (idx >= 0 && !(segs[0] && segs[0][0] === '@')) segs.unshift(String(idx));
      } else if (a.type === 'CallExpression' || a.type === 'NewExpression') {
        const cn = calleeName(a.callee);
        const ln = lastName(a.callee);
        const argi = a.arguments.indexOf(child);
        if (cn === 'R.def' && strVal(a.arguments[0]) && strVal(a.arguments[1]) != null) { prefix = strVal(a.arguments[0]); segs.unshift(strVal(a.arguments[1])); break; }
        if (helperKind[cn] && strVal(a.arguments[0]) != null && argi !== 0) { prefix = helperKind[cn]; segs.unshift(strVal(a.arguments[0])); break; }
        if (argi >= 0 && TEXT_CALLS.has(ln)) { segs.unshift(ln); continue; }
        const a0 = strVal(a.arguments[0]);
        if (a0 != null && ID.test(a0) && argi !== 0 && !TEXT_CALLS.has(ln)) segs.unshift(a0);
        else if (argi >= 0 && ln && !/^(push|concat|map|filter|forEach|assign|then|resolve|push)$/.test(ln) && segs.length === 0) segs.unshift(ln);
      } else if (a.type === 'AssignmentExpression' && a.right === child) {
        const nm = lastName(a.left);
        if (nm) segs.unshift(nm);
      } else if (a.type === 'VariableDeclarator' && a.init === child && a.id.type === 'Identifier') {
        segs.unshift(a.id.name);
      } else if (a.type === 'FunctionDeclaration' && a.id) {
        segs.unshift(a.id.name);
      } else if (a.type === 'MethodDefinition' || (a.type === 'Property' && /Function/.test(a.value.type) && a.value === child)) {
        const k = a.key && (a.key.name || a.key.value);
        if (k) segs.unshift(String(k));
      } else if (a.type === 'ReturnStatement' && segs.length === 0) {
        segs.unshift('ret');
      }
      child = a;
    }
    // 重なった錨を詰める（@id の前の番号は捨てる。同じ語の続きは 1 つに）
    // 最後の @id より前は、いちばん外の名前（TABS など。番号でなければ）だけ残す
    let lastId = -1;
    segs.forEach((s, i) => { if (s[0] === '@') lastId = i; });
    const segs2 = lastId > 0 ? (/^\d+$/.test(segs[0]) || segs[0][0] === '@' ? [] : [segs[0]]).concat(segs.slice(lastId)) : segs;
    const out = [];
    for (const s of segs2) { if (out.length && out[out.length - 1] === s) continue; out.push(s); }
    let clean = out.map((s) => (s[0] === '@' ? safeSeg(s.slice(1)) : safeSeg(s)));
    // 接頭辞がファイル名のとき、同じ名前の錨（S.def('settings', …) など）は重ねない
    if (!prefix && clean.length > 1 && clean[0] === path.basename(rel, '.js')) clean = clean.slice(1);
    // 長すぎる key は外側を削る（先頭の錨と最後の 3 つ）
    const body = clean.length > 5 ? [clean[0]].concat(clean.slice(-3)) : clean;
    return { prefix: prefix || prefixOf(rel), body };
  }

  const byAnchorVal = new Map();   // anchorPath + '\u0000' + value → key（同じ錨の同じ文は 1 つ）
  const byVal = new Map();         // value → key（比べる所用）
  const planned = [];
  const cmpUnits = [];
  for (const u of units) {
    const par = u.anc[u.anc.length - 1];
    u.cmp = par && ((par.type === 'BinaryExpression' && /^[=!]==?$/.test(par.operator)) || par.type === 'SwitchCase');
    // 値と差し込み
    const params = [];
    const pname = (e) => {
      const txt = srcOf(e);
      const ex = params.find((p) => p.txt === txt);
      if (ex) return ex.name;
      let nm = e.type === 'Identifier' ? e.name : e.type === 'MemberExpression' && !e.computed ? e.property.name
        : e.type === 'CallExpression' ? (lastName(e.callee) === 'String' || lastName(e.callee) === 'fmt' || /^(toLocaleString|toFixed|round|floor|ceil|max|min|abs|num|n)$/.test(lastName(e.callee)) ? pnameInner(e) : lastName(e.callee)) : '';
      if (!nm || !/^[A-Za-z_$][\w$]*$/.test(nm) || nm === 'length' && false) nm = 'p' + params.length;
      if (nm === 'T' || nm === 'R') nm = 'p' + params.length;
      let n2 = nm, k = 2;
      while (params.some((p) => p.name === n2)) n2 = nm + k++;
      params.push({ name: n2, txt, node: e });
      return n2;
    };
    const pnameInner = (e) => {
      const a = e.arguments && e.arguments[0];
      if (a && a.type === 'Identifier') return a.name;
      if (a && a.type === 'MemberExpression' && !a.computed) return a.property.name;
      if (e.callee.type === 'MemberExpression') { const o = e.callee.object; if (o.type === 'Identifier') return o.name; if (o.type === 'MemberExpression' && !o.computed) return o.property.name; }
      return '';
    };
    const esc = (s) => s;   // 表の文の { はそのまま（params に無い名前は T が残す）
    let value;
    if (u.kind === 'lit') value = u.node.value;
    else if (u.kind === 'array') value = u.node.elements.map((e) => e.value);
    else if (u.kind === 'tpl') {
      value = '';
      u.node.quasis.forEach((qq, i) => { value += esc(qq.value.cooked); if (i < u.node.expressions.length) value += '{' + pname(u.node.expressions[i]) + '}'; });
    } else {
      value = '';
      for (const p of u.parts) {
        if (p.type === 'Literal' && typeof p.value === 'string') value += esc(p.value);
        else if (p.type === 'TemplateLiteral') p.quasis.forEach((qq, i) => { value += esc(qq.value.cooked); if (i < p.expressions.length) value += '{' + pname(p.expressions[i]) + '}'; });
        else value += '{' + pname(p) + '}';
      }
    }
    // 文の中に元からある {名前} と差し込みの名前がぶつかったら差し込みの名前を変える
    u.params = params;
    u.value = value;
    const { prefix, body } = anchorsOf(u);
    u.anchorPath = prefix + '.' + body.join('.');
    u.prefix = prefix; u.body = body;
    if (u.cmp) cmpUnits.push(u); else planned.push(u);
  }
  const vkey = (v) => (Array.isArray(v) ? '[' + v.join('\u0001') + ']' : v);
  const keys = [];
  function assign(u) {
    const av = u.anchorPath + '\u0000' + vkey(u.value);
    if (byAnchorVal.has(av)) { u.key = byAnchorVal.get(av); u.dup = true; return; }
    let base = u.prefix + '.' + (u.body.length ? u.body.join('.') : 'text');
    let key = base, i = 2;
    while (keysTaken.has(key) && keysTaken.get(key) !== vkey(u.value)) key = base + '_' + i++;
    if (keysTaken.has(key)) { u.dup = true; }
    keysTaken.set(key, vkey(u.value));
    byAnchorVal.set(av, key);
    if (!byVal.has(vkey(u.value))) byVal.set(vkey(u.value), key);
    u.key = key;
    keys.push(key);
  }
  planned.forEach(assign);
  for (const u of cmpUnits) {
    const k = byVal.get(vkey(u.value));
    if (k) { u.key = k; u.dup = true; } else assign(u);
  }

  // ---------------------------------------------------------------- 書き換え
  const edits = units.map((u) => {
    const pieces = [];
    const call = u.params && u.params.length ? 'R.T(' + q(u.key) + ', { ' : 'R.T(' + q(u.key);
    pieces.push({ text: call });
    if (u.params && u.params.length) {
      u.params.forEach((p, i) => {
        const shorthand = p.node.type === 'Identifier' && p.node.name === p.name;
        if (i) pieces.push({ text: ', ' });
        if (shorthand) pieces.push({ text: p.name });
        else { pieces.push({ text: qKey(p.name) + ': ' }); pieces.push({ copy: [p.node.start, p.node.end] }); }
      });
      pieces.push({ text: ' })' });
    } else pieces.push({ text: ')' });
    return { start: u.node.start, end: u.node.end, pieces };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  function emit(s, e) {
    let out = '', pos = s;
    for (const ed of edits) {
      if (ed.start < pos || ed.end > e || ed.start < s) continue;
      out += src.slice(pos, ed.start);
      for (const p of ed.pieces) out += p.text != null ? p.text : emit(p.copy[0], p.copy[1]);
      pos = ed.end;
    }
    return out + src.slice(pos, e);
  }
  const outSrc = edits.length ? emit(0, src.length) : src;
  return { units, out: outSrc, lineAt };
}

// ------------------------------------------------------------------ 表のファイル
function readTable(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  const R = { I18n: { add: (lang, t) => Object.assign(out, t) } };
  const fn = new Function('window', fs.readFileSync(file, 'utf8'));
  fn({ RPG: R });
  return out;
}
function writeTable(file, domain, entries) {
  // entries: [{key, value, from}]。ファイルの中はソースのファイルごとにまとめる
  const byFrom = new Map();
  for (const e of entries) { if (!byFrom.has(e.from)) byFrom.set(e.from, []); byFrom.get(e.from).push(e); }
  let s = `// 日本語の文の表（${domain}）。元は tools/i18n_extract.js がソースから移した。以後はここが正（訳は src/i18n/<言語>/${domain}.js に同じ key で）\n`;
  s += '// 文の中の {name} は R.T(key, {name}) の差し込み。{hero} など params に無い名前は、そのまま（イベントの側で入る）。\n';
  s += "(function (R) {\n  'use strict';\n  R.I18n.add('ja', {\n";
  for (const [from, list] of byFrom) {
    s += `    // ---- ${from}\n`;
    for (const e of list) {
      const v = Array.isArray(e.value) ? '[' + e.value.map(q).join(', ') + ']' : q(e.value);
      s += `    ${q(e.key)}: ${v},\n`;
    }
  }
  s += '  });\n})(window.RPG);\n';
  fs.writeFileSync(file, s);
}

// ------------------------------------------------------------------ main
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

function main() {
  const argv = process.argv.slice(2);
  const WRITE = argv.includes('--write');
  const oi = argv.indexOf('--only');
  const only = oi >= 0 ? argv[oi + 1] : null;
  const ri = argv.indexOf('--report');
  const report = ri >= 0 ? argv[ri + 1] : null;
  const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--only' && argv[i - 1] !== '--report').map((f) => path.resolve(f));
  const acorn = loadAcorn();
  const list = (files.length ? files : walk(SRC)).filter((f) => {
    const rel = path.relative(V2, f).replace(/\\/g, '/');
    if (SKIP_FILES.some((re) => re.test(rel))) return false;
    if (only && !rel.startsWith('src/' + only + '/') && rel !== 'src/' + only) return false;
    return true;
  });
  // 今の表（全部の分野）の key
  const keysTaken = new Map();
  const tables = {};
  if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.js'))) {
    const d = f.slice(0, -3);
    const t = readTable(path.join(OUT, f));
    tables[d] = Object.keys(t).map((k) => ({ key: k, value: t[k], from: null }));
    for (const k of Object.keys(t)) keysTaken.set(k, Array.isArray(t[k]) ? '[' + t[k].join('\u0001') + ']' : t[k]);
  }
  // 元のファイルの名前を表のコメントから読み直す
  for (const d of Object.keys(tables)) {
    const txt = fs.readFileSync(path.join(OUT, d + '.js'), 'utf8');
    let from = null;
    const at = {};
    for (const ln of txt.split('\n')) { const m = /^\s*\/\/ ---- (.+)$/.exec(ln); if (m) from = m[1]; const k = /^\s*'((?:[^'\\]|\\.)*)':/.exec(ln); if (k) at[k[1].replace(/\\'/g, "'")] = from; }
    for (const e of tables[d]) e.from = at[e.key] || '?';
  }
  const rep = [];
  let nUnits = 0, nChars = 0, nFiles = 0;
  for (const f of list) {
    const rel = path.relative(V2, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    const r = processFile(acorn, rel, src, keysTaken, {});
    if (r.error) { console.log(`PARSE ${rel}: ${r.error}`); continue; }
    if (!r.units.length) continue;
    nFiles++;
    const d = domainOf(rel);
    tables[d] = tables[d] || [];
    for (const u of r.units) {
      nUnits++;
      nChars += [...(Array.isArray(u.value) ? u.value.join('') : u.value)].length;
      rep.push({ file: rel, line: r.lineAt(u.node.start), key: u.key, value: u.value, kind: u.kind, dup: !!u.dup });
      if (!u.dup) tables[d].push({ key: u.key, value: u.value, from: rel });
      if (argv.includes('--dry')) console.log(`${rel}:${r.lineAt(u.node.start)}  ${u.key}${u.dup ? ' (=)' : ''}  ${JSON.stringify(u.value).slice(0, 70)}`);
    }
    if (WRITE) fs.writeFileSync(f, r.out);
  }
  if (WRITE) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const d of Object.keys(tables)) if (tables[d].length) writeTable(path.join(OUT, d + '.js'), d, tables[d]);
  }
  if (report) fs.writeFileSync(report, JSON.stringify(rep, null, 1));
  console.log(`i18n_extract: ${nUnits} strings (${nChars} chars) in ${nFiles} files${WRITE ? ' — written' : ' — dry run'}`);
}
/**
 * 1 つのソースの文字列を移す（生成器の出力など、ファイルに書く前の文字）。今の表の key を使い回すので、同じ入力なら同じ出力。
 * o.writeTables で、新しい文を日本語の表に足す（既定は足さない: 同じ入力なら足す物は無い）。→ 書き換えた文字（acorn が無ければ元のまま）
 */
function extractText(rel, src, o) {
  o = o || {};
  let acorn = null;
  for (const t of ['acorn', '/opt/node22/lib/node_modules/eslint/node_modules/acorn', '/opt/node22/lib/node_modules/ts-node/node_modules/acorn']) { try { acorn = require(t); break; } catch (e) { /* 次へ */ } }
  if (!acorn) { console.warn('[i18n_extract] acorn が無いので文字列を移さない: ' + rel); return src; }
  const keysTaken = new Map();
  const tables = {};
  if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.js'))) {
    const t = readTable(path.join(OUT, f));
    tables[f.slice(0, -3)] = t;
    for (const k of Object.keys(t)) keysTaken.set(k, Array.isArray(t[k]) ? '[' + t[k].join('\u0001') + ']' : t[k]);
  }
  const r = processFile(acorn, rel, src, keysTaken, {});
  if (r.error) throw new Error(rel + ': ' + r.error);
  const d = domainOf(rel);
  const fresh = r.units.filter((u) => !(tables[d] && u.key in tables[d]) && !Object.values(tables).some((t) => u.key in t));
  if (fresh.length && o.writeTables) {
    const add = {};
    for (const u of fresh) add[u.key] = u.value;
    appendTable(path.join(OUT, d + '.js'), rel, add);
  } else if (fresh.length) console.warn(`[i18n_extract] ${rel}: 新しい文 ${fresh.length} 個（表に無い。--write で足す）`);
  return r.out;
}
/** 表のファイルの最後に key を足す（区切りのコメントはソースのファイル名） */
function appendTable(file, from, add) {
  let s = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : "(function (R) {\n  'use strict';\n  R.I18n.add('ja', {\n  });\n})(window.RPG);\n";
  const at = s.lastIndexOf('  });');
  let blk = `    // ---- ${from}\n`;
  for (const k of Object.keys(add)) blk += `    ${q(k)}: ${Array.isArray(add[k]) ? '[' + add[k].map(q).join(', ') + ']' : q(add[k])},\n`;
  fs.writeFileSync(file, s.slice(0, at) + blk + s.slice(at));
}
module.exports = { domainOf, prefixOf, JP, SKIP_FILES, extractText };
if (require.main === module) main();
