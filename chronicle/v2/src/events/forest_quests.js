// CONTENT-F: フェルンの小さな依頼（V2_PLAN §3.4、WORLD_REDESIGN §4.1・§5.1）。どれも本筋に要らない・失っても何も失わない。
//   q_fern_letters   手紙番ニナ → 樹上の家 5 軒（lv 1 の足場の人）→ ニナにお金と木登りの靴
//   q_fern_herbs     薬草園のばあさま → 迷いの森の広場ごとに 1 種（1 階 3・2 階 2）→ 薬の詰め合わせ
//   q_fern_song      リタの弟子と歌あわせ（R.Mini.sequence、3 段）→ 段ごとに品（1 回だけ）
//   q_forest_fireflies 灯籠番 → 光るこけの火種 → 森の街道の消えた道しるべの灯籠 3 つ（ワールド、CONTENT-P が置く。event 'forest_waylamp'）
//   q_forest_acorn   木の実拾いの子 → 迷いの森 1 階 南東の広場の切り株でどんぐり王子（レア魔物）
(function (R) {
  'use strict';
  const E = (id, run, o) => R.def('events', id, Object.assign({ run, meta: { needs: [], gives: [] } }, o || {}));
  const C = (R.ContentF = R.ContentF || {});
  const F = (C.forest = C.forest || {});
  const give = (ev, id, n) => ev.item(id, n == null ? 1 : n);

  // ---------------------------------------------------------------- 手紙配り
  const DECK = {
    deck_1: { name: '樹上の家の女', thanks: 'まあ、娘からの手紙！\n港町で元気にしてるのね。\nお礼に、これをどうぞ。', gift: ['i_salve', 2], idle: '足場の上は、風が気持ちいいの。\n下の道がよく見えるでしょう。', after: '夏至の祭りの支度で、\n木の上も大忙しよ。' },
    deck_2: { name: '樹上の家の老人', thanks: 'ほう、古い友からじゃ。\n目が弱っての、あとで\n孫に読んでもらおう。', gift: ['gold', 40], idle: 'わしは、この木の上で\n七十年暮らしとる。\n下へ降りるのは、祭りの日だけじゃ。', after: 'こずえが光っとる。\n長生きはするもんじゃ。' },
    deck_3: { name: '樹上の家の男', thanks: '請求書か……。\nいや、運んでくれて礼を言う。\nこれは駄賃だ。', gift: ['i_waker', 2], idle: 'つり橋は揺れるが、\n落ちたやつはいない。\n……たぶんな。', after: '森が静かになった。\n今夜は、よく眠れそうだ。' },
    deck_4: { name: '樹上の家の娘', thanks: 'あっ、ハンスさんから！？\n……べ、べつに待ってないわよ。\nこれ、持っていって！', gift: ['i_antidote', 2], idle: 'ここから、森の奥の千年樹が\n見えるの。こずえが、少しだけ\n光ってるでしょう？', after: 'ハンスさんが帰ってきたの。\n……べつに、うれしくなんか\nないけど。' },
    deck_5: { name: '樹上の家の若者', thanks: '祭りの楽士の割り振りだ。\nおれは笛か。やった！\nお礼に、これを。', gift: ['i_ether', 1], idle: '祭りがあれば、笛を吹くんだ。\n……今年は、あるのかな。', after: '祭りで笛を吹けるんだ！\nあんたも聞いていってくれよ。' },
  };
  E('fern_postmaster', async (ev) => {
    const n = ev.var('forest_letters');
    if (ev.flag('forest_letters_done')) { await ev.say('postmaster', '手紙を運んでくれて、\n本当に助かったわ。\nつり橋、こわくなかった？'); return; }
    if (ev.flag('forest_letters_got')) {
      if (n >= 5) {
        await ev.say('postmaster', ['五軒とも届けてくれたの！\nありがとう。', 'これはお礼。それと、\n木登りの靴。つり橋でも\n足がすべらないのよ。']);
        ev.gold(120);
        give(ev, 'ac_climb_shoes', 1);
        ev.setFlag('forest_letters_done');
        ev.leadDone('q_fern_letters');
        return;
      }
      await ev.say('postmaster', `あと ${5 - n} 軒よ。\n樹上の家は、はしごを上って\n足場を渡った先。`);
      return;
    }
    await ev.say('postmaster', ['わたしはニナ。村の手紙番よ。\n木の上の家に手紙を\n配りたいんだけど……。', '捜索のことで、手伝いの子が\nみんな出払っていて。']);
    const i = await ev.choose(['引き受ける', 'やめておく'], { cancel: 1 });
    if (i !== 0) { await ev.say('postmaster', 'そう……。気が向いたら\n声をかけてね。'); return; }
    ev.setFlag('forest_letters_got');
    ev.lead('q_fern_letters');
    await ev.say('postmaster', ['ありがとう！　五軒ぶんよ。\n北西と北東の大きな木に三軒、\n西の大きな木に二軒。', 'はしごを上れば、\n足場とつり橋でつながってるわ。']);
  }, { meta: { needs: [], gives: ['lead:q_fern_letters', 'flag:forest_letters_got', 'flag:forest_letters_done', 'item:ac_climb_shoes'] } });

  E('fern_deck', async (ev, ctx) => {
    const id = ctx && ctx.npc;
    const d = DECK[id];
    if (!d) return;
    const done = 'forest_letter_' + id;
    if (ev.flag('forest_letters_got') && !ev.flag(done) && !ev.flag('forest_letters_done')) {
      await ev.say(null, '{hero}は、預かった手紙を渡した。');
      await ev.say(id, d.thanks);
      if (d.gift[0] === 'gold') ev.gold(d.gift[1]); else give(ev, d.gift[0], d.gift[1]);
      ev.setFlag(done);
      const n = ev.addVar('forest_letters', 1);
      if (n >= 5) await ev.caption('手紙を五軒とも届けた。\nニナに知らせよう。', { ms: 1800 });
      return;
    }
    await ev.say(id, ev.flag('cleared_r_forest') ? d.after : d.idle);
  }, { meta: { needs: ['flag:forest_letters_got'], gives: ['var:forest_letters+1'] } });

  // ---------------------------------------------------------------- 薬草五種
  const HERBS = { 1: '月見草', 2: '蛍こけ', 3: '夜露の葉', 4: '千年樹の落ち葉', 5: '光るきのこの傘' };
  E('fern_herbalist', async (ev) => {
    const n = ev.var('forest_herbs');
    if (ev.flag('forest_herbs_done')) { await ev.say('herbalist', '光るきのこの薬で、\n村の年寄りも元気じゃ。\nわしも、まだまだ現役よ。'); return; }
    if (ev.flag('forest_herbs_got')) {
      if (n >= 5) {
        await ev.say('herbalist', ['五種そろったね！\nこれで、村の薬が作れる。', 'ほれ、詰め合わせじゃ。\n旅の足しにしておくれ。']);
        give(ev, 'i_potion', 3); give(ev, 'i_antidote', 2); give(ev, 'i_waker', 2); give(ev, 'i_ether', 1);
        ev.setFlag('forest_herbs_done');
        ev.leadDone('q_fern_herbs');
        return;
      }
      await ev.say('herbalist', `あと ${5 - n} 種じゃ。\n迷いの森の広場ごとに、\n一種ずつ生えておる。`);
      return;
    }
    await ev.say('herbalist', ['森の薬草が切れてしもうてな。\n村の薬が作れんのじゃ。', '迷いの森の広場ごとに、\n一種ずつ薬草が生えとる。\n光るきのこのそばを探してごらん。', '五種そろえてくれたら、\n薬の詰め合わせをあげよう。']);
    ev.setFlag('forest_herbs_got');
    ev.lead('q_fern_herbs');
  }, { meta: { needs: [], gives: ['lead:q_fern_herbs', 'flag:forest_herbs_got', 'flag:forest_herbs_done'] } });

  /** 迷いの森の薬草（examine の物の herb 番号） */
  F.herb = async function (ev, ctx) {
    const map = R.DB.maps[ctx && ctx.map];
    const o = map && (map.objects || []).find((q) => q.type === 'examine' && q.event === 'verda_herb' && q.x === ctx.x && q.y === ctx.y);
    const k = o && o.herb;
    if (!k) return;
    const key = 'forest_herb_' + k;
    if (ev.flag(key)) { await ev.say(null, '光るきのこが、ぼんやり\n足もとを照らしている。'); return; }
    if (!ev.flag('forest_herbs_got')) { await ev.say(null, '光るきのこのそばに、見慣れない\n草が生えている。'); return; }
    ev.setFlag(key);
    const n = ev.addVar('forest_herbs', 1);
    ev.sfx('item');
    await ev.caption(`薬草「${HERBS[k]}」を摘んだ。\n（${n}/5）`, { ms: 1800 });
  };

  // ---------------------------------------------------------------- 歌あわせ（リタの弟子。R.Mini.sequence、3 段）
  const STAGES = [
    { rounds: 3, tempo: 0.8, reward: ['i_potion', 2], label: '一段目' },
    { rounds: 5, tempo: 1.0, reward: ['ac_ward_sleep', 1], label: '二段目' },
    { rounds: 7, tempo: 1.25, reward: ['hd_mushroom_cap', 1], label: '三段目' },
  ];
  const RANK_OK = { S: true, A: true, B: true };
  E('fern_song_game', async (ev) => {
    if (!ev.flag('forest_song_met')) {
      await ev.say('rita_pupil', ['ぼく、リタ先生の弟子なんだ。\n歌の節あて、やってみない？', '先生の歌う節を、同じ順に\n返していくの。三段まであるよ。']);
      ev.setFlag('forest_song_met');
      ev.lead('q_fern_song');
    }
    const next = STAGES.findIndex((s, i) => !ev.flag('forest_song_' + (i + 1)));
    const labels = STAGES.map((s, i) => s.label + (ev.flag('forest_song_' + (i + 1)) ? '（済み）' : ''));
    const i = await ev.choose(labels.concat(['やめておく']), { cancel: STAGES.length, text: next < 0 ? '三段とも済んだ。もう一度？' : 'どの段であわせる？' });
    if (i >= STAGES.length) return;
    if (i > 0 && !ev.flag('forest_song_' + i)) { await ev.say('rita_pupil', 'その段は、前の段を\n済ませてからね。'); return; }
    const st = STAGES[i];
    const r = (await ev.mini.sequence({ title: '歌あわせ・' + st.label, symbols: ['葉', '風', '月', '水'], rounds: st.rounds, tempo: st.tempo, theme: 'forest' })) || {};
    const ok = RANK_OK[r.rank];
    if (!ok) { await ev.say('rita_pupil', 'おしい！　また、\nいつでも来てね。'); return; }
    const key = 'forest_song_' + (i + 1);
    if (!ev.flag(key)) {
      ev.setFlag(key);
      await ev.say('rita_pupil', `すごい！　${st.label}、合格！\nこれ、先生からのごほうび。`);
      give(ev, st.reward[0], st.reward[1]);
      if (i === 2) { ev.leadDone('q_fern_song'); await ev.say('rita_pupil', '三段とも合格なんて……。\n先生にも言っておくね！'); }
    } else await ev.say('rita_pupil', 'やっぱり、上手だね！');
  }, { meta: { needs: [], gives: ['lead:q_fern_song', 'flag:forest_song_1', 'flag:forest_song_2', 'flag:forest_song_3'] } });

  // ---------------------------------------------------------------- 蛍の灯籠（E21）
  E('fern_lampkeeper', async (ev) => {
    const n = ev.var('forest_fireflies');
    if (ev.flag('forest_fireflies_done')) { await ev.say('lampkeeper', '街道の灯籠が、みんな灯った。\n灯りのまわりには、\n魔物も近寄らんよ。'); return; }
    if (ev.flag('forest_embers')) {
      if (n >= 3) {
        await ev.say('lampkeeper', ['三つとも灯してくれたか！\nこれで、夜の街道も安心じゃ。', 'ほれ、駄賃じゃ。\nとっておきなさい。']);
        ev.gold(200);
        ev.setFlag('forest_fireflies_done');
        ev.leadDone('q_forest_fireflies');
        return;
      }
      await ev.say('lampkeeper', `あと ${3 - n} つじゃ。\n森の街道の、消えた灯籠を\n調べてごらん。`);
      return;
    }
    await ev.say('lampkeeper', ['わしは灯籠番じゃ。\n森の街道の道しるべの灯籠が、\n三つも消えてしもうた。', '光るこけの火種を入れれば、\nまた灯る。……じゃが、この足では\n街道まで行けんでな。']);
    const i = await ev.choose(['火種を運ぶ', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    ev.setFlag('forest_embers');
    ev.lead('q_forest_fireflies');
    await ev.say('lampkeeper', ['ありがたい。これが火種じゃ。\n消えた灯籠を調べて、\n中に入れておくれ。', '灯籠が灯れば、そのまわりには\n魔物が出んようになる。']);
  }, { meta: { needs: [], gives: ['lead:q_forest_fireflies', 'flag:forest_embers', 'flag:forest_fireflies_done'] } });

  /**
   * ワールドの森の街道の灯籠（CONTENT-P が {type:'waylamp', id:'wl_forest_<n>', lit:'q_forest_fireflies_<n>', event:'forest_waylamp'} で置く）。
   * 調べると火種を入れて旗 q_forest_fireflies_<n> を立てる → FIELD が lit を見て灯す（R.Game.lamps）。
   */
  E('forest_waylamp', async (ev, ctx) => {
    const map = R.DB.maps[ctx && ctx.map];
    const o = map && (map.objects || []).find((q) => q.type === 'waylamp' && q.x === ctx.x && q.y === ctx.y);
    const m = o && /^wl_forest_(\d)$/.exec(o.id || '');
    if (!m) { await ev.say(null, '道しるべの灯籠だ。'); return; }
    const key = 'q_forest_fireflies_' + m[1];
    if (ev.flag(key)) { await ev.say(null, '灯籠の中で、光るこけが\nやさしく灯っている。'); return; }
    if (!ev.flag('forest_embers')) { await ev.say(null, ['道しるべの灯籠だ。\n火が消えている。', '中に、枯れたこけが\n残っている……。']); return; }
    await ev.say(null, '消えた灯籠に、光るこけの\n火種を入れた。');
    ev.setFlag(key);
    const n = ev.addVar('forest_fireflies', 1);
    await ev.caption(`灯籠が灯った。（${n}/3）`, { ms: 1600 });
  }, { meta: { needs: ['flag:forest_embers'], gives: ['var:forest_fireflies+1'] } });

  // ---------------------------------------------------------------- どんぐり王子
  E('fern_acorn_boy', async (ev) => {
    if (ev.flag('forest_acorn_won')) { await ev.say('acorn_boy', '冠のどんぐり、ほんとに\nいたんだ！　いいなあ、\nぼくも見たかった！'); return; }
    await ev.say('acorn_boy', ['ねえ、知ってる？\n迷いの森の南東の広場に、\n冠をかぶったどんぐりがいるんだ！', '切り株のところで、\nぴょんぴょんはねてたんだって。\n……見たいなあ。']);
    ev.lead('q_forest_acorn');
  }, { meta: { needs: [], gives: ['lead:q_forest_acorn'] } });

  F.acorn = async function (ev) {
    if (ev.flag('forest_acorn_won')) { await ev.say(null, '切り株のまわりに、\nどんぐりの殻が散らばっている。'); return; }
    if (!(ev.flag('cleared_r_forest') || (R.Game && R.Game.leads && R.Game.leads.q_forest_acorn))) { await ev.say(null, '古い切り株だ。\nどんぐりが、ひとつ転がっている。'); return; }
    await ev.say(null, '切り株の上で、冠をかぶった\nどんぐりが、ぴょんと跳ねた！');
    const r = await ev.battle({ mons: [['rm_acorn_prince', 1]], zone: 'z_verda', bg: 'forest', noGolden: true });
    if (r !== 'win') { if (r === 'escape') await ev.say(null, 'どんぐり王子は、\n切り株のかげに隠れた。'); return; }
    ev.setFlag('forest_acorn_won');
    ev.leadDone('q_forest_acorn');
  };
})(window.RPG);
