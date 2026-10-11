// 「次にやること」（本筋のすぐ次の一歩）のテスト（持ち主 2026-10-11「『余白 八枚目』では何も分からない。次に会う人・向かう場所を具体的に」）
//   node v2/tools/test_goals.js
//   ・本筋の旗の並び（序章のあと → 森 → 砂漠 → 雪原 → 湿原 → 諸島 → 山地 → 灰の荒野 → 高原 → 終盤 → 忘却の底）を 1 つの状態に足していきながら歩き、
//     どの一歩でも 具体的な文（手がかりの題でも「余白」でもない・{ } が残らない）で、旗を立てると文が変わる
//   ・地方の物語の全部の一歩に来る（歩き残しが無い）
//   ・選び方: 目印 → 次の場面を待つ → 今いる地方 → 終盤・ロアへの帰り → 始めた地方 → 最後に寄った町の地方 → いちばん新しく聞いた地方 → うわさだけの地方
//   ・寄り道のうわさ・余白・記録官の物は自分では選ばれない（目印を付けたときだけ）。体験版は錠の地方を出さない
//   ・本筋・地方・うわさの手がかりは、全部が物語に入っている（無いと題が出る）。全部の文が 5 言語にあり、差し込み（{ }）がそろう
//   ・ボスの名前・先の出来事を言わない・文の長さ（日本語 22 字まで）
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const C = D.config;

const HERO = { type: 'warrior', sex: 'm', name: 'アルン' };
let G = null;
/** 状態を作り直す。S = {flags, vars, leads, items, tier, pending, pos, lastTown, pin, got} */
function build(S) {
  R.State.newGame({ hero: HERO, seed: 1 });
  G = R.Game;
  Object.assign(G.flags, S.flags || {});
  Object.assign(G.vars, S.vars || {});
  for (const [k, n] of Object.entries(S.items || {})) G.items[k] = n;
  G.tier = S.tier || 0;
  G.pendingTier = S.pending == null ? null : S.pending;
  if (S.pos) G.pos.map = S.pos;
  if (S.lastTown) G.lastTown = { map: S.lastTown, x: 1, y: 1, dir: 's' };
  let t = 0;
  for (const l of S.leads || []) { R.Leads.add(l, { silent: true }); G.leads[l].got = (S.got && S.got[l]) || ++t; }
  if (S.pin) { R.Leads.add(S.pin, { silent: true }); R.Leads.pin(S.pin); }
  return G;
}
const goal = () => R.Leads.goal();
const titles = Object.values(D.leads).map((l) => l.title).filter(Boolean);
const lenJa = (t) => [...String(t).replace(/\{[^}]*\}/g, '0')].length;

const sliceWas = C.slice;
C.slice = false;   // 製品版（deploy --full と同じ）

// ================================================================ 1. 手がかりの分け方
section('1. 本筋・地方・うわさの手がかりは全部、物語に入っている');
const ST = D.goalstories;
ok('R.DB.goalstories exists with region / main / optional / note stories', ST && ['region', 'main', 'optional', 'note'].every((k) => Object.values(ST).some((s) => s.kind === k)));
{
  const missing = [], dup = [];
  const seen = {};
  for (const [sid, s] of Object.entries(ST)) for (const l of s.leads || []) { if (seen[l]) dup.push(l + ':' + seen[l] + '/' + sid); seen[l] = sid; if (!D.leads[l]) missing.push(l); }
  ok('every lead named in a story really exists', missing.length === 0, missing);
  ok('no lead is in two stories', dup.length === 0, dup);
  const want = Object.keys(D.leads).filter((id) => ['main', 'region', 'rumor'].includes(D.leads[id].kind));
  const loose = want.filter((id) => !R.Leads.storyOf(id));
  ok(`all ${want.length} main / region / rumor leads are in a story (none falls back to its title)`, loose.length === 0, loose);
  const regionStories = Object.entries(ST).filter(([, s]) => s.kind === 'region' || s.kind === 'main');
  ok('every region / main story: ends with a step without "when" (a default first step)', regionStories.every(([, s]) => s.steps.length && s.steps[s.steps.length - 1].when === undefined && s.steps.slice(0, -1).every((x) => x.when !== undefined)), regionStories.filter(([, s]) => s.steps[s.steps.length - 1].when !== undefined).map(([k]) => k));
  ok('every story kind region/main has done (or arrives) conditions that the state grammar knows', regionStories.every(([, s]) => [s.arrived, s.done].filter((c) => c != null).every((c) => R.State.condProblems(c).length === 0)));
  const badWhen = [];
  for (const [sid, s] of Object.entries(ST)) for (const st of s.steps || []) if (st.when !== undefined && R.State.condProblems(st.when).length) badWhen.push(sid + ':' + st.id);
  ok('every "when" is a valid condition', badWhen.length === 0, badWhen);
  const ids = [];
  for (const [sid, s] of Object.entries(ST)) { const u = new Set(); for (const st of s.steps || []) { if (u.has(st.id)) ids.push(sid + ':' + st.id); u.add(st.id); } }
  ok('step ids are unique in a story (the field card pops up when the id changes)', ids.length === 0, ids);
  // 条件の旗が出来事のどこかで立つ（書き間違いの検出）
  const known = new Set();
  const src = require('fs').readdirSync(require('path').join(__dirname, '..', 'src', 'events')).map((f) => require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'events', f), 'utf8')).join('\n');
  const stray = [];
  for (const [sid, s] of regionStories) for (const st of s.steps) {
    if (st.when === undefined) continue;
    const refs = R.State.condRefs(st.when);
    for (const f of refs.flags) if (!new RegExp("['\"]" + f + "['\"]").test(src) && !new RegExp("['\"]" + f.replace(/_\d$/, '_') + "'").test(src)) stray.push(sid + ':' + st.id + ' ' + f);
    for (const v of refs.vars) if (!new RegExp("['\"]" + v + "['\"]").test(src)) stray.push(sid + ':' + st.id + ' var ' + v);
    for (const it of refs.items) if (!new RegExp("['\"]" + it + "['\"]").test(src)) stray.push(sid + ':' + st.id + ' item ' + it);
  }
  ok('every flag / var / item a step looks at is set somewhere in src/events', stray.length === 0, stray);
}

// ================================================================ 2. 本筋の歩き
section('2. 本筋を序章の終わりから忘却の底まで歩く（旗を足していく）');
const S = { flags: {}, vars: {}, leads: [], items: {}, tier: 0, pending: null, pos: null, lastTown: null };
const hit = new Set();
let prev = null;
/** 状態に足して、その状態の「次にやること」を確かめる。want = 期待する id、word = 文に入る言葉（配列なら全部） */
function step(label, add, want, word) {
  if (add) {
    Object.assign(S.flags, add.flags || {});
    Object.assign(S.vars, add.vars || {});
    for (const l of add.leads || []) if (!S.leads.includes(l)) S.leads.push(l);
    for (const [k, n] of Object.entries(add.items || {})) { if (n) S.items[k] = n; else delete S.items[k]; }
    if (add.tier != null) S.tier = add.tier;
    if (add.pending !== undefined) S.pending = add.pending;
    if (add.pos !== undefined) S.pos = add.pos;
  }
  build(S);
  const g = goal();
  const words = [].concat(word || []);
  const good = !!g && g.id === want && words.every((w) => g.text.includes(w));
  ok(`${label} → ${want}${words.length ? '「…' + words.join('・') + '…」' : ''}`, good, g);
  if (!g) { prev = null; return g; }
  hit.add(g.id);
  ok(`  ${want}: concrete (no lead title, no 余白, no leftover { }, ja ≤ 22 chars)`,
    !titles.includes(g.text) && !/余白/.test(g.text) && !/[{}]/.test(g.text) && lenJa(g.text) <= 22 && lenJa(g.text) >= 6, [g.text, lenJa(g.text)]);
  if (prev && prev.id !== g.id) ok(`  ${prev.id} → ${want}: the text changes with the step`, prev.text !== g.text, [prev.text, g.text]);
  prev = g;
  return g;
}
const RUMORS = ['l_rumor_forest', 'l_rumor_desert', 'l_rumor_snow', 'l_rumor_marsh', 'l_rumor_isles', 'l_rumor_mine', 'l_rumor_ash', 'l_rumor_star'];
const clearAll = (n) => ({ flags: { ['cleared_' + ['', 'r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'][n]]: true, ['story_t' + n]: true }, tier: n, pending: null });
const cleared = (rid, t) => ({ flags: { ['cleared_' + rid]: true, ['story_t' + t]: true }, tier: t, pending: null });

// 序章のあと
step('prologue done, nothing heard', { flags: { prologue_start: true, prologue_berna: true, prologue_pharos: true, prologue_party: true, prologue_key: true, prologue_tutorial: true, prologue_boss: true, prologue_done: true }, leads: ['l_main_rumors'] }, 'g_rumors', 'うわさ');

// --- 森
step('forest: rumor heard', { leads: ['l_rumor_forest'] }, 'forest:fern', ['西の森', 'フェルン']);
step('forest: in Fern', { flags: { forest_start: true } }, 'forest:board', '掲示板');
step('forest: read the board', { flags: { forest_board: true }, leads: ['l_forest_board'] }, 'forest:gord', 'ゴード');
step('forest: Gord talked', { flags: { forest_gord_talked: true }, leads: ['l_forest_woodcutters'] }, 'forest:katri', 'カトリ');
step('forest: Katri talked', { leads: ['l_forest_pim'] }, 'forest:search', '0/4');
step('forest: found Hans', { flags: { forest_found_hans: true } }, 'forest:search', '1/4');
step('forest: found Ben, Roy', { flags: { forest_found_ben: true, forest_found_roy: true }, vars: { forest_verses: 1 } }, 'forest:search', '3/4');
step('forest: found Pim', { flags: { forest_found_pim: true }, leads: ['l_forest_song'] }, 'forest:song', '1/3');
step('forest: stones', { vars: { forest_verses: 3 } }, 'forest:elder', '千年樹');
step('forest: cleared, scene waiting', { flags: { cleared_r_forest: true, forest_finale_done: true, forest_boss: true }, tier: 1, pending: 1 }, 'pending', '宿');
step('forest: T1 seen', { flags: { story_t1: true }, pending: null, leads: ['l_main_margin_1'] }, 'g_free', 'うわさ');

// --- 砂漠
step('desert: rumor heard', { leads: ['l_rumor_desert'] }, 'desert:kasim', ['南西', 'カシム']);
step('desert: in Kasim', { flags: { desert_arrived: true } }, 'desert:guild', '隊商ギルド');
step('desert: met Zaid', { flags: { desert_zaid_met: true }, leads: ['l_desert_caravan'] }, 'desert:zaid', 'ザイード');
step('desert: caravan left', { flags: { desert_caravan_on: true } }, 'desert:caravan', '王墓のオアシス');
step('desert: camp 3 done', { flags: { desert_caravan_on: false, desert_camp3_done: true, desert_abul_came: true }, leads: ['l_desert_tomb', 'l_desert_glyphs'] }, 'desert:tomb', '砂の王墓');
step('desert: past the first boss', { flags: { desert_worm: true } }, 'desert:deep', '奥');
step('desert: cleared, scene waiting', { flags: { desert_king: true, cleared_r_desert: true }, tier: 2, pending: 2 }, 'pending');
step('desert: T2 seen', { flags: { story_t2: true }, pending: null, leads: ['l_main_margin_2', 'l_main_margin_named'] }, 'g_free');

// --- 雪原
step('snow: rumor heard', { leads: ['l_rumor_snow'] }, 'snow:yule', ['北', 'ユール']);
step('snow: in Yule', { flags: { snow_start: true } }, 'snow:jorn', '村長');
step('snow: Jorn talked', { flags: { snow_jorn_talked: true }, leads: ['l_snow_prep'] }, 'snow:logs', '0/3');
step('snow: 2 logs', { vars: { snow_logs: 2 } }, 'snow:logs', '2/3');
step('snow: logs done', { flags: { snow_logs_done: true }, vars: { snow_logs: 3 } }, 'snow:tales', '0/3');
step('snow: 2 tales', { flags: { snow_tale_dragon: true, snow_tale_hunter: true } }, 'snow:tales', '2/3');
step('snow: tales done', { flags: { snow_tale_fire_child: true, snow_tales_done: true } }, 'snow:festival', '大火祭');
step('snow: festival night', { flags: { snow_festival_lit: true } }, 'snow:siege', 'ヨルン');
step('snow: dawn', { flags: { snow_siege_done: true, snow_dawn: true }, leads: ['l_snow_peak'], items: { k_winter_flame: 1 } }, 'snow:peak', '白竜の峰');
step('snow: past the ice wall guard', { flags: { snow_ice_2: true, snow_giant: true } }, 'snow:flame', '頂');
step('snow: cleared, scene waiting', { flags: { snow_neve: true, snow_finale_done: true, cleared_r_snow: true }, items: { k_winter_flame: 0 }, tier: 3, pending: 3 }, 'pending');
step('snow: T3 seen', { flags: { story_t3: true }, pending: null, leads: ['l_main_roa_t3', 'l_main_margin_3'] }, 'g_free');

// --- 湿原
step('marsh: rumor heard', { leads: ['l_rumor_marsh'] }, 'marsh:loch', ['東', 'ロッホ']);
step('marsh: in Loch', { flags: { marsh_arrived: true }, leads: ['l_marsh_mist', 'l_marsh_emma'] }, 'marsh:emma', ['霧笛亭', 'エマ']);
step('marsh: met Emma', { flags: { marsh_emma_met: true }, leads: ['l_marsh_evidence'] }, 'marsh:evidence', '0/4');
step('marsh: 2 clues', { flags: { marsh_ev_drawing: true, marsh_ev_book: true }, vars: { marsh_evidence: 2 }, leads: ['l_marsh_ev_drawing', 'l_marsh_ev_book'] }, 'marsh:evidence', '2/4');
step('marsh: 4 clues', { flags: { marsh_ev_foot: true, marsh_ev_stone: true }, vars: { marsh_evidence: 4 } }, 'marsh:assembly', '集会');
step('marsh: assembly held', { flags: { marsh_assembly_done: true }, leads: ['l_marsh_bog'] }, 'marsh:key', ['メルダ', '鐘の鍵']);
step('marsh: got the key', { items: { k_bell_key: 1 }, flags: { marsh_melda_met: true } }, 'marsh:bells', '0/3');
step('marsh: 2 bells', { flags: { marsh_bell_1: true, marsh_bell_2: true } }, 'marsh:bells', '2/3');
step('marsh: cleared, scene waiting', { flags: { marsh_bell_3: true, marsh_mistbeast: true, marsh_finale_done: true, cleared_r_marsh: true }, tier: 4, pending: 4 }, 'pending');
step('marsh: T4 seen', { flags: { story_t4: true }, pending: null, leads: ['l_main_margin_4'] }, 'g_free');

// --- 諸島
step('isles: rumor heard', { leads: ['l_rumor_isles'] }, 'isles:ferry', ['南東', '桟橋']);
step('isles: in Coral', { flags: { isles_arrived: true } }, 'isles:drake', '造船所');
step('isles: met Drake', { flags: { isles_drake_met: true }, leads: ['l_isles_ship', 'l_isles_shell'] }, 'isles:shell', '潮鳴りの洞窟');
step('isles: has the shell', { items: { k_glow_shell: 1 }, flags: { isles_octopus: true, isles_shell: true } }, 'isles:deliver', 'ドレイク');
step('isles: ship launched', { items: { k_glow_shell: 0 }, flags: { isles_ship: true }, leads: ['l_isles_chart'] }, 'isles:harbor', '海図');
step('isles: got the chart', { flags: { isles_chart_got: true } }, 'isles:chart', '0/3');
step('isles: 2 blanks filled', { vars: { isles_chart: 2 }, flags: { isles_chart_light: true, isles_chart_siren: true } }, 'isles:chart', '2/3');
step('isles: fog found', { flags: { isles_fog_found: true, isles_chart_crab: true }, vars: { isles_chart: 3 }, leads: ['l_isles_fog'] }, 'isles:marina_meet', 'マリナ');
step('isles: met Marina', { flags: { isles_marina_met: true } }, 'isles:marina_inn', '宿');
step('isles: slept a night', { flags: { isles_marina_night: true } }, 'isles:marina_again', 'マリナ');
step('isles: song ready', { flags: { isles_song_ready: true } }, 'isles:pier', '歌');
step('isles: fog open', { flags: { isles_song_done: true, isles_fog_open: true } }, 'isles:ghost', '幽霊船');
step('isles: cleared, scene waiting', { flags: { isles_captain: true, isles_dawn_done: true, cleared_r_isles: true }, tier: 5, pending: 5 }, 'pending');
step('isles: T5 seen', { flags: { story_t5: true }, pending: null }, 'g_free');

// --- 山地
step('mine: rumor heard', { leads: ['l_rumor_mine'] }, 'mine:dovan', ['北', 'ドヴァン']);
step('mine: in Dovan', { flags: { mine_arrived: true } }, 'mine:watch', '見張り');
step('mine: met the lookout', { flags: { mine_watch_met: true }, leads: ['l_mine_trapped'] }, 'mine:rescue', '0/3');
step('mine: 2 rescued', { flags: { mine_miner1: true, mine_miner2: true } }, 'mine:rescue', '2/3');
step('mine: all rescued', { flags: { mine_pip: true, mine_rescued_all: true } }, 'mine:seven', '岩戸');
step('mine: door seen', { flags: { mine_door_seen: true }, leads: ['l_mine_door'] }, 'mine:hall', '集会所');
step('mine: chose', { flags: { mine_choice: true }, leads: ['l_mine_warden'] }, 'mine:warden', '岩戸');
step('mine: cleared, scene waiting', { flags: { mine_warden_done: true, mine_relight_done: true, cleared_r_mine: true }, tier: 6, pending: 6 }, 'pending');

// --- 六つ目のあとのロア（フィーネに言われた帰り道）
step('roa after the 6th: T6 seen, Berna waits', { flags: { story_t6: true }, pending: null, leads: ['l_main_roa_t6', 'l_main_margin_6'] }, 'roa6:roa', 'ベルナ');
step('roa after the 6th: visited', { flags: { story_roa_t6: true } }, 'g_free');

// --- 灰の荒野
step('ash: rumor heard', { leads: ['l_rumor_ash'] }, 'ash:caldera', ['南東', 'カルデラ']);
step('ash: in Caldera', { flags: { ash_arrived: true }, leads: ['l_ash_trial'] }, 'ash:enter', '受付');
step('ash: entered', { flags: { ash_entered: true } }, 'ash:arena', '0/5');
step('ash: 3 wins', { vars: { ash_round: 3 } }, 'ash:arena', '3/5');
step('ash: champion', { flags: { ash_champion: true }, vars: { ash_round: 5 }, leads: ['l_ash_volcano', 'l_ash_egg'] }, 'ash:volcano', '東');
step('ash: in the volcano', { flags: { ash_volcano_seen: true } }, 'ash:murals', '0/3');
step('ash: 2 murals', { vars: { ash_murals: 2 } }, 'ash:murals', '2/3');
step('ash: murals done', { vars: { ash_murals: 3 }, flags: { ash_mural_1: true, ash_mural_2: true, ash_mural_3: true } }, 'ash:crater', '火口');
step('ash: beast down', { flags: { ash_lavabeast: true } }, 'ash:egg', '卵');
step('ash: cleared, scene waiting', { flags: { ash_egg: true, ash_finale_done: true, cleared_r_ash: true }, tier: 7, pending: 7 }, 'pending');
step('ash: T7 seen', { flags: { story_t7: true }, pending: null }, 'g_free');

// --- 高原
step('star: rumor heard', { leads: ['l_rumor_star'] }, 'star:orbis', ['北東', 'オルビス']);
step('star: in Orbis', { flags: { star_arrived: true } }, 'star:observatory', '天文台');
step('star: met Luca', { flags: { star_luca_met: true }, leads: ['l_star_stars'] }, 'star:gate', '門');
step('star: saw the gate', { flags: { star_gate_seen: true }, leads: ['l_star_tower'] }, 'star:library', '司書');
step('star: the librarian', { flags: { star_message: true }, leads: ['l_star_message', 'l_star_prep'] }, 'star:prep', '0/2');
step('star: one prep', { flags: { star_key_1: true, star_key_2: true, star_key_3: true, star_prep_key: true } }, 'star:prep', '1/2');
step('star: ready', { flags: { star_prep_uniform: true, star_ready: true }, leads: ['l_star_vault'] }, 'star:sneak', '大扉');
step('star: inside', { flags: { star_night_seen: true } }, 'star:vault', '保管庫');
step('star: vault open', { flags: { star_vault_open: true } }, 'star:chart', '星図');
step('star: has the chart', { flags: { star_chart_got: true }, items: { k_star_chart: 1 } }, 'star:tower', '塔');
step('star: tower open', { flags: { star_octavia_done: true, star_tower_open: true }, leads: ['l_star_summit'] }, 'star:climb', '頂');
step('star: summit', { flags: { star_orrery_rot: true, star_sentinel: true, star_stareater: true } }, 'star:names', '星の名');
step('star: cleared, scene waiting', { flags: { star_names_read: true, star_dawn_done: true, cleared_r_star: true, star_finale_done: true }, tier: 8, pending: 8 }, 'pending');

// --- 終盤
step('finale: T8 seen, Berna waits', { flags: { story_t8: true, story_fine_reveal: true }, pending: null, leads: ['l_main_margin_8', 'l_main_final_roa'] }, 'finale:roa', ['ロアの里', 'ベルナ']);
step('finale: Roa done, the ferry', { flags: { final_roa: true, final_open: true }, leads: ['l_main_final_ferry'] }, 'finale:ferry', ['桟橋', 'ビブリア']);
step('finale: in Biblia', { flags: { final_sailed: true, final_arrived: true }, leads: ['l_main_final_archive'] }, 'finale:archive', '白の大書庫');
step('finale: in the Archive', { flags: { final_archive_seen: true, archive_1_enter: true } }, 'finale:climb', '頂');
step('finale: floor 2 done', { flags: { final_golem: true } }, 'finale:seal', ['3階', '手帳']);
step('finale: the seal opens', { flags: { final_rowell: true } }, 'finale:up', '上');
step('finale: floor 5 done', { flags: { final_shades: true, final_lazaro: true } }, 'finale:top', '頂');
step('finale: cleared', { flags: { final_nemrea1: true, final_clear: true } }, 'post:stairs', ['忘却の底', '南東']);
step('post: the stairs', { flags: { oblivion_1_arrive: true } }, 'post:down', '忘却の底');
step('post: past the echo', { flags: { oblivion_echo: true } }, 'post:bottom', '最下層');
step('post: all done', { flags: { oblivion_ouroboros: true } }, 'g_free', '物語');

{
  const all = [];
  for (const [sid, s] of Object.entries(ST)) if (s.kind === 'region' || s.kind === 'main') for (const st of s.steps) all.push(sid + ':' + st.id);
  const miss = all.filter((id) => !hit.has(id));
  ok(`the walk reaches all ${all.length} steps of the region / main stories`, miss.length === 0, miss);
}

// ================================================================ 3. 選び方
section('3. 何を選ぶか');
const FOREST_STARTED = { flags: { prologue_done: true, forest_start: true, forest_board: true }, leads: ['l_main_rumors', 'l_rumor_forest', 'l_forest_board'], got: { l_rumor_forest: 5, l_forest_board: 6 } };
{
  // 目印
  let g = (build({ flags: { prologue_done: true }, leads: ['l_main_rumors', 'l_rumor_desert'], pin: 'l_rumor_desert' }), goal());
  ok('pinned: a lead of a story shows that story\'s step (not the title)', g && g.id === 'desert:kasim' && g.lead === 'l_rumor_desert', g);
  g = (build({ flags: { prologue_done: true, desert_arrived: true }, leads: ['l_main_rumors', 'l_rumor_desert', 'l_rumor_snow'], pin: 'l_rumor_snow', pos: 'kasim' }), goal());
  ok('pinned beats "the region I am in"', g && g.id === 'snow:yule', g);
  g = (build({ flags: { prologue_done: true }, leads: ['l_main_rumors'], pin: 'q_pharos_well' }), goal());
  ok('pinned side request: 「title（place）」 as before', g && g.id === 'lead:q_pharos_well' && g.text.includes(D.leads.q_pharos_well.title), g);
  g = (build({ flags: { prologue_done: true, desert_arrived: true }, leads: ['l_main_rumors', 'l_rumor_desert'], pin: 'l_main_margin_1' }), goal());
  ok('pinned note (margin): the usual goal, not 「余白」', g && g.id === 'desert:guild' && !/余白/.test(g.text), g);
  g = (build({ flags: { prologue_done: true }, leads: ['l_main_rumors'], pin: 'l_opt_hut' }), goal());
  ok('pinned optional rumor: its own concrete line', g && g.id === 'opt_hut:go' && g.text.includes('休み小屋') && g.text !== D.leads.l_opt_hut.title, g);
  g = (build({ flags: { prologue_done: true }, leads: ['l_main_rumors'], pin: 'l_main_roa_t3' }), goal());
  ok('pinned detour (Roa visit): its own line', g && g.id === 'opt_roa_t3:go' && g.text.includes('ロア'), g);
  g = (build({ flags: { prologue_done: true, cleared_r_desert: true }, leads: ['l_main_rumors', 'l_desert_sundial'], pin: 'l_desert_sundial' }), goal());
  ok('pinned lead of a finished region: falls back to the title', g && g.id === 'lead:l_desert_sundial', g);
  const gTitle = R.Leads.goalOf('l_desert_sundial');
  ok('goalOf: a finished region has no step', gTitle === null, gTitle);
  ok('goalOf: a margin follows the usual goal', (build({ flags: { prologue_done: true }, leads: ['l_main_rumors', 'l_main_margin_2'] }), R.Leads.goalOf('l_main_margin_2').id === 'g_rumors'));

  // 場面を待つ
  g = (build({ flags: { prologue_done: true, cleared_r_desert: true }, leads: ['l_main_rumors', 'l_rumor_snow'], tier: 2, pending: 2 }), goal());
  ok('a scene is waiting: 「rest at an inn」 before the next region', g && g.id === 'pending', g);
  g = (build({ flags: { prologue_done: true, cleared_r_desert: true }, leads: ['l_main_rumors', 'l_rumor_snow', 'q_pharos_well'], tier: 2, pending: 2, pin: 'q_pharos_well' }), goal());
  ok('a pin still beats the waiting scene', g && g.id === 'lead:q_pharos_well', g);

  // 今いる地方
  const BOTH = { flags: { prologue_done: true, desert_arrived: true, snow_start: true }, leads: ['l_main_rumors', 'l_rumor_desert', 'l_rumor_snow'], got: { l_rumor_desert: 10, l_rumor_snow: 20 } };
  g = (build(Object.assign({}, BOTH, { pos: 'kasim' })), goal());
  ok('standing in Kasim: the desert story (even though the snow rumor is newer)', g && g.id.startsWith('desert:'), g);
  g = (build(Object.assign({}, BOTH, { pos: 'yule' })), goal());
  ok('standing in Yule: the snow story', g && g.id.startsWith('snow:'), g);
  g = (build(Object.assign({}, BOTH, { pos: 'desert_tomb_1' })), goal());
  ok('standing in a desert dungeon: the desert story', g && g.id.startsWith('desert:'), g);
  // 最後に寄った町
  g = (build(Object.assign({}, BOTH, { pos: 'world', lastTown: 'kasim' })), goal());
  ok('on the world map, last town Kasim: desert', g && g.id.startsWith('desert:'), g);
  g = (build(Object.assign({}, BOTH, { pos: 'world', lastTown: 'yule' })), goal());
  ok('on the world map, last town Yule: snow', g && g.id.startsWith('snow:'), g);
  g = (build(Object.assign({}, BOTH, { pos: 'world', lastTown: 'pharos' })), goal());
  ok('on the world map, last town Pharos: the newest (snow)', g && g.id.startsWith('snow:'), g);
  g = (build(Object.assign({}, BOTH, { pos: 'world', lastTown: 'pharos', got: { l_rumor_desert: 30, l_rumor_snow: 20 } })), goal());
  ok('the newest wins when nothing else decides (desert)', g && g.id.startsWith('desert:'), g);
  // 始めた地方 > うわさだけの地方
  g = (build({ flags: { prologue_done: true, forest_start: true }, leads: ['l_main_rumors', 'l_rumor_forest', 'l_rumor_marsh'], got: { l_rumor_forest: 1, l_rumor_marsh: 9 }, pos: 'pharos' }), goal());
  ok('a region I started beats a rumor I only heard (even a newer one)', g && g.id.startsWith('forest:'), g);
  g = (build({ flags: { prologue_done: true }, leads: ['l_main_rumors', 'l_rumor_forest', 'l_rumor_marsh'], got: { l_rumor_forest: 1, l_rumor_marsh: 9 }, pos: 'pharos' }), goal());
  ok('two rumors only: the newest one', g && g.id.startsWith('marsh:'), g);
  // 森より先に砂漠（製品版は好きな順）
  g = (build({ flags: { prologue_done: true, desert_arrived: true, desert_zaid_met: true }, leads: ['l_main_rumors', 'l_rumor_desert', 'l_desert_caravan'], pos: 'kasim_guild' }), goal());
  ok('desert first (forest never heard): the desert goal, not the forest one', g && g.id === 'desert:zaid', g);
  g = (build({ flags: { prologue_done: true, desert_arrived: true }, leads: ['l_main_rumors', 'l_rumor_desert'], pos: 'world', lastTown: 'pharos' }), goal());
  ok('desert first, walking the world map: still the desert goal', g && g.id === 'desert:guild', g);

  // 終盤・ロア > ほかの地方
  const SIX = { flags: { prologue_done: true, story_t6: true, mine_arrived: true, cleared_r_forest: true, story_t1: true }, leads: ['l_main_rumors', 'l_main_roa_t6', 'l_rumor_mine', 'l_rumor_ash'], tier: 6 };
  g = (build(Object.assign({}, SIX, { pos: 'world', lastTown: 'pharos' })), goal());
  ok('after the 6th: Roa (main) comes before the other regions', g && g.id === 'roa6:roa', g);
  g = (build(Object.assign({}, SIX, { pos: 'dovan' })), goal());
  ok('…but not before the region I am standing in', g && g.id.startsWith('mine:'), g);
  // 地方が済んだら出ない
  g = (build({ flags: { prologue_done: true, cleared_r_desert: true, desert_arrived: true, story_t2: true, story_t1: true }, leads: ['l_main_rumors', 'l_rumor_desert', 'l_desert_sundial', 'l_desert_song'], tier: 2, pos: 'kasim' }), goal());
  ok('a cleared region never gives a goal (open sub-leads do not count)', g && g.id === 'g_free', g);
  // 寄り道・余白は自分では選ばれない
  g = (build({ flags: { prologue_done: true, story_t1: true }, leads: ['l_main_rumors', 'l_opt_hut', 'l_opt_windhill', 'l_opt_well', 'l_main_margin_1', 'l_main_margin_8', 'l_main_recorder_forest', 'l_rumor_mira', 'l_snow_fox'] }), goal());
  ok('optional rumors / margins / recorder notes are never picked by themselves', g && g.id === 'g_free' && g.text.includes('うわさ'), g);
  g = (build({ flags: { prologue_done: true, story_t8: true, story_t1: true, story_t2: true }, leads: ['l_main_rumors', 'l_main_margin_8', 'l_main_final_roa'], tier: 8 }), goal());
  ok('the old problem: with 「余白 八枚目」 open, the goal is Roa, not the margin', g && g.id === 'finale:roa' && !/余白/.test(g.text), g);
  // 手がかりを聞いていなくても、着いていれば出る
  g = (build({ flags: { prologue_done: true, forest_start: true }, leads: [] }), goal());
  ok('arrived (flag) without any lead heard: the story still speaks', g && g.id === 'forest:board', g);
  // hideWhen
  g = (build({ flags: { prologue_done: true, story_t1: true, cleared_r_forest: true }, leads: ['l_forest_hut'] }), goal());
  ok('a hidden lead (hideWhen) does not start a story', g && g.id === 'g_free', g);
}

// ---- 体験版
section('4. 体験版（slice）');
{
  C.slice = true;
  let g = (build({ flags: { prologue_done: true, desert_arrived: true }, leads: ['l_main_rumors', 'l_rumor_desert'] }), goal());
  ok('demo: a locked region (desert) is not offered', g && g.id === 'g_rumors', g);
  g = (build({ flags: { prologue_done: true, forest_start: true }, leads: ['l_main_rumors', 'l_rumor_forest'] }), goal());
  ok('demo: the forest story works (board)', g && g.id === 'forest:board', g);
  g = (build({ flags: { prologue_done: true, cleared_r_forest: true, forest_boss: true }, leads: ['l_main_rumors', 'l_rumor_forest'], tier: 1, pending: 1 }), goal());
  ok('demo: after the forest, before the T1 scene: the old line 「rest」 (g_rest)', g && g.id === 'g_rest', g);
  g = (build({ flags: { prologue_done: true, cleared_r_forest: true, story_t1: true, world_demo_end: true }, leads: ['l_main_rumors'], tier: 1 }), goal());
  ok('demo: the end line', g && g.id === 'g_free' && g.text.includes('体験版'), g);
  g = (build({ flags: { prologue_done: true, story_t8: true }, leads: ['l_main_final_roa'], tier: 8 }), goal());
  ok('demo: the finale story is locked too', g && g.id !== 'finale:roa', g);
  C.slice = false;
}

// ================================================================ 5. 文
section('5. 文（日本語）');
{
  const texts = [];
  for (const [sid, s] of Object.entries(ST)) for (const st of s.steps || []) texts.push([sid + ':' + st.id, st.text]);
  const fat = texts.filter(([, t]) => lenJa(t) > 22);
  ok(`all ${texts.length} step lines: ja ≤ 22 chars (the menu header and the field card)`, fat.length === 0, fat.map(([k, t]) => k + ' ' + lenJa(t)));
  const imp = texts.filter(([, t]) => !/(しよう|ろう|もう|こう|ごう|ぼう|そう|おう|とう|のう|てみよう|よう)$|\)$|）$/.test(t));
  ok('every line is a plain 「〜しよう」 sentence (counters may follow)', imp.length === 0, imp);
  const bossNames = Object.values(D.bosses).map((b) => b.name).filter((n) => n && !/ロウェル|番人/.test(n));
  const extra = ['フィーネ', '灰色のマント', 'ネムレア', 'ラザロ', '魔王', '虚ろの王', '円環'];
  const leaked = [];
  for (const [k, t] of texts) for (const n of bossNames.concat(extra)) if (t.includes(n)) leaked.push(k + ':' + n);
  ok('no boss names / future events in any line', leaked.length === 0, leaked);
  const style = texts.filter(([, t]) => /[噂蒼頁麻痺]/.test(t) || /　/.test(t));
  ok('house style (うわさ・全角スペース無し)', style.length === 0, style);
  // 序章の段も
  const rowTexts = [];
  for (const [id, r] of Object.entries(D.goals)) for (const x of Array.isArray(r.text) ? r.text.map((y) => y.text) : [r.text]) rowTexts.push([id, x]);
  ok('the rows (goals) are all plain lines ≤ 30 chars', rowTexts.every(([, t]) => lenJa(t) <= 30), rowTexts.filter(([, t]) => lenJa(t) > 30));
}

// ================================================================ 6. 5 言語
section('6. 5 言語');
{
  const langs = ['en', 'ko', 'zh-Hans', 'zh-Hant'];
  const keys = R.I18n.keys('ja').filter((k) => /^goals\./.test(k));
  ok(`ja has ${keys.length} goals.* keys`, keys.length >= 90);
  for (const l of langs) {
    const miss = keys.filter((k) => !R.I18n.has(k, l));
    ok(`${l}: every goals.* key is translated`, miss.length === 0, miss.slice(0, 5));
  }
  const ja = {};
  for (const [sid, s] of Object.entries(ST)) for (const st of s.steps || []) ja[sid + ':' + st.id] = st.text;
  const ph = (t) => (String(t).match(/\{[a-z]+:[^}]*\}\}?/g) || []).sort().join('|');
  for (const l of langs) {
    const L = require('./lib/load')({ quiet: true, globals: { location: { search: '?lang=' + l } } });
    ok(`${l}: loaded in that language`, L.I18n.lang() === l);
    const bad = [], same = [], holes = [], long = [];
    for (const [sid, s] of Object.entries(L.DB.goalstories)) for (const st of s.steps || []) {
      const id = sid + ':' + st.id, t = st.text;
      if (!t || /^goals\./.test(t)) bad.push(id);
      else {
        if (t === ja[id]) same.push(id);
        if (ph(t) !== ph(ja[id])) holes.push(id + ' ' + ph(t) + ' vs ' + ph(ja[id]));
        if (t.replace(/\{[^}]*\}\}?/g, '0').length > (l === 'en' ? 62 : 36)) long.push(id + ' ' + t.length);
      }
    }
    ok(`${l}: every step line exists and differs from Japanese`, bad.length === 0 && same.length === 0, { bad, same });
    ok(`${l}: counters / placeholders match Japanese`, holes.length === 0, holes);
    ok(`${l}: lines are short (en ≤ 62, others ≤ 36)`, long.length === 0, long);
    const rowBad = Object.entries(L.DB.goals).filter(([, r]) => (Array.isArray(r.text) ? r.text.map((y) => y.text) : [r.text]).some((t) => !t || /^goals\./.test(t))).map(([k]) => k);
    ok(`${l}: the prologue rows are translated`, rowBad.length === 0, rowBad);
  }
}

C.slice = sliceWas;
done('test_goals');
