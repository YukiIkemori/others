// CONTENT-P: 序章 P1・P2 とロアの里の人々（V2_PLAN §3.3、STORY_BIBLE §9.1 P1・P2、§3.4・§3.5・§10.2 の 1〜3）
//   roa_house_intro  P1（DB.config.start.event）: 暗転のキャプション 3 枚（1 枚目の後に守り歌。v_fine_opening_01〜03・v_fine_song_01）→ 幕のまま「おはよう」（v_berna_prologue_01〜03）
//                    → ev.createHero() → 幕が上がり、消灯の刻の窓明かりの部屋に主人公（v_berna_intro_01・v_berna_prologue_04）
//   roa_berna        P2: 白紙・灯台の火（細りはじめて三晩、きのう消えた）・潮風亭で仲間を → 傷薬 3 と 50 G。序章の後は近況とただの宿
//   roa_lectern      書見台: 語り部の名簿（lo_roa_register）と「手がかり帳の使い方」の短い本
//   roa_seat         朝の席（lo_roa_seat）   roa_shelf  本棚   roa_stone  語り石（lo_roa_stone）   roa_hall  語り石の間
//   roa_gate / roa_gatewoman / roa_children / roa_elder / roa_farmer / roa_weaver / roa_youth   里の人
//   roa_enter        ロアの onEnter（今は何もしない。T3・T6 のロアの寄り道と終盤のロアの口）
// 主人公は物語の中ではしゃべらない（STORY_BIBLE 冒頭）。仲間は物語に出ない（A36）。
(function (R) {
  'use strict';
  const D = R.DB.events;
  const X = () => R.ContentP.ev;

  // ------------------------------------------------------------ P1 目覚め（消灯の刻の窓明かり）
  // 冒頭のボイス（幕の上のフィーネ 4 本 → ベルナ 5 本）。幕の前に先読みする
  const INTRO_VOICES = ['v_fine_opening_01', 'v_fine_song_01', 'v_fine_opening_02', 'v_fine_opening_03',
    'v_berna_prologue_01', 'v_berna_prologue_02', 'v_berna_prologue_03', 'v_berna_intro_01', 'v_berna_prologue_04'];
  const BREATH = 1000;   // 冒頭の場面の切れ目の間（ms）
  D.roa_house_intro = {
    meta: { needs: [], gives: ['flag:prologue_start', 'hero'] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_start')) return;
      // 暗い幕（キャプションは幕の上。R.Engine.fade はキャプションより上に描かれるので使わない。TODO(UIK): caption の {dark:true}）
      const curtain = { id: 'cp_curtain', opaque: false, a: 1, enter() {}, exit() {}, update() {}, draw(g) { g.globalAlpha = this.a; g.fillStyle = '#070812'; g.fillRect(0, 0, R.W, R.H); g.globalAlpha = 1; } };
      R.Engine.push(curtain);
      try {
        // 冒頭のボイスを先読み（まとめた版は初めの声で束を読む。読み終わりか 2.5 秒の早い方まで、幕のまま待つ）
        try { if (R.Audio && R.Audio.preloadVoice) await Promise.race([R.Audio.preloadVoice(INTRO_VOICES), R.wait(2500)]); } catch (e) { /* 声が無くても進む */ }
        await ev.caption('……ねえ、聞こえる？', { ms: 2600, voice: 'v_fine_opening_01' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        // 灯台の守り歌（オーナー 2026-09-27「メインだから声を」）: 幕の上でフィーネが子守歌のように。声の終わりまで待つ
        await ev.caption('♪　海の果てまで、灯よ届け\n帰る舟に、道を照らせ', { ms: 4200, voice: 'v_fine_song_01' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        await ev.caption('これは、忘れられかけた物語。', { ms: 2600, voice: 'v_fine_opening_02' });
        await ev.wait(BREATH);   // 場面が変わるたびにひと呼吸（持ち主 2026-09-27）
        await ev.caption('そして、それを語り直した、\nひとりの語り部の物語。', { ms: 3400, voice: 'v_fine_opening_03' });
        await ev.wait(BREATH);
        // 主人公ができるまでは幕のまま（持ち主 2026-09-28「主人公のいないマップを見せない」）: 目を覚ます前の声として、
        // 地の文とベルナの「おはよう」を幕の上で聞き、主人公を作ってから幕を上げる（寝台に主人公がいる部屋が明ける）
        await E.narr(ev, '窓の外は、まだ消灯の刻の\n闇のなかだった。');
        await ev.say('berna', 'おはよう。今日は大事な日だよ。', { voice: 'v_berna_prologue_01', face: 'berna:smile' });
        await ev.say('berna', '語り部の名簿に、\nあなたのことを書いておかないとね。', { voice: 'v_berna_prologue_02', face: 'berna:neutral' });
        await ev.say('berna', 'さあ、見習いさん。\nあなたがどんな子だったか、\nもう一度聞かせておくれ。', { voice: 'v_berna_prologue_03', face: 'berna:smile' });
        let h = null;
        for (let i = 0; i < 5 && !h; i++) h = await ev.createHero();
        if (!h && !(R.Game.chars && R.Game.chars.hero)) R.State.setHero({ type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' });
        // 幕の中で主人公の絵を焼いておく（焼く列に任せると、幕が上がってから主人公が遅れて出る）
        try {
          const F = R.Field;
          if (F && F._awaitPeopleArt) await F._awaitPeopleArt(1500);
          if (F && F._warmPeople) F._warmPeople(400);
        } catch (e) { /* 焼けなければ焼く列のまま */ }
        await ev.wait(BREATH / 2);
        const t0 = R.Engine.time;
        if (R.Engine.running) await R.until(() => { curtain.a = Math.max(0, 1 - (R.Engine.time - t0) / 1200); return curtain.a <= 0; });
      } finally { R.Engine.remove(curtain); }
      await ev.wait(BREATH / 2);
      await E.say(ev, 'berna', '{hero}。……うん、いい名前だ。', { voice: 'v_berna_intro_01', face: 'berna:smile' });   // 声は名前を読まない（「……うん、いい名前だ。」）
      await ev.say('berna', '支度ができたら、\nわたしの書見台までおいで。\n話しておきたいことがあるんだ。', { voice: 'v_berna_prologue_04', face: 'berna:neutral' });
      await ev.npc('berna').move([[12, 5]]);
      await ev.npc('berna').face('s');
      ev.setFlag('prologue_start');
    },
  };

  // ------------------------------------------------------------ P2 師匠ベルナ
  const P2 = [
    'そうそう、大事な話があるんだ。',
    '近ごろ、あちこちで\n伝承が消えていくんだよ。',
    '歌の続きが出てこない。\n祭りの由来が分からない。\nそんな話ばかりさ。',
    'わたしたち語り部は、それを\n『白紙』と呼んでいる。',
    '里の語り石の文字も、\n半分が白く抜けてしまった。',
    'それにね、港町ファロスの\n灯台の火が、細りはじめて三晩。\nきのう、とうとう消えたそうだ。',
    'あの灯台には、守り歌という\n古い伝承があってね。\nそれも、白紙になりかけている。',
    '{hero}、行っておくれ。\n語り部の見習いとしての、\n最初の仕事だよ。',
    'ただし、ひとりで行っちゃ\nだめだよ。ファロスの酒場\n「潮風亭」で、仲間を探しなさい。',
    'それから、これを持って\nお行き。',
  ];
  // P2 のボイス（design/voice_story_map.json。{hero} の入る P2[7] は名前を読まない v_berna_p2_10）
  const P2_VOICE = ['v_berna_p2_01', 'v_berna_p2_02', 'v_berna_p2_03', 'v_berna_p2_04', 'v_berna_p2_05', 'v_berna_p2_06', 'v_berna_p2_07', 'v_berna_p2_10', 'v_berna_p2_08', 'v_berna_p2_09'];   // p2_10 は名前を読まない（「行っておくれ。……」）
  D.roa_berna = {
    meta: { needs: ['flag:prologue_start'], gives: ['flag:prologue_berna', 'item:i_salve', 'gold'] },
    run: async (ev, ctx) => {
      const E = X();
      const who = (ctx && ctx.npc) || 'berna';
      if (!ev.flag('prologue_start')) { await E.say(ev, 'berna', 'おはよう。……もう少し、\nゆっくりしておいで。', { face: 'berna:smile' }); return; }
      if (!ev.flag('prologue_berna')) {
        for (let i = 0; i < P2.length; i++) {
          const t = P2[i];
          await E.say(ev, who, t, { voice: P2_VOICE[i] || undefined, face: /大事|白紙|消えた/.test(t) ? 'berna:sad' : 'berna:neutral' });
        }
        await E.give(ev, 'i_salve', 3);
        E.gold(ev, 50);
        await E.narr(ev, '傷薬を 3 つと、\n50 ゴールドを受け取った。');
        await E.say(ev, who, 'ファロスは、里を出て\n南東へ行った所だよ。\n……気をつけてお行き、{hero}。', { face: 'berna:smile' });
        ev.setFlag('prologue_berna');
        return;
      }
      // 序章の後: 近況と、ただの宿（STORY_BIBLE §6.3。T3 以降の物忘れは TODO: T3・T6 のロアの寄り道で）
      if (ev.flag('prologue_done')) {
        const pk = E.pickEntry([
          { cond: 'cleared_r_forest', text: '森の灯が戻ったそうだね。\n語り石の文字が、ほんの少し\n読めるようになった気がするよ。' },
          { text: 'おかえり。年代記は、\nちゃんと書いているかい？' },
        ]);
        await E.say(ev, who, pk.text, { voice: pk.voice, face: 'berna:smile' });
        await E.stay(ev, { who, ask: '泊まっていくかい？', bye: 'そうかい。気をつけてお行き。', morning: 'よく眠れたかい？\n……さあ、いってらっしゃい。' });
        return;
      }
      // 序章の途中
      const line = E.pick([
        { cond: 'prologue_key', text: '灯台の鍵を預かったんだね。\n灯台は、半島の南の岬だよ。\n……気をつけてお行き。' },
        { cond: 'prologue_party', text: 'いい仲間に会えたようだね。\n……みんな、{hero}を\nよろしく頼むよ。' },
        { text: 'ファロスは、里を出て\n南東へ行った所だよ。\n酒場「潮風亭」で仲間を探しなさい。' },
      ]);
      await E.say(ev, who, line, { face: 'berna:smile' });
    },
  };

  // ------------------------------------------------------------ 書見台（名簿と、手がかり帳の短い本）
  D.roa_lectern = {
    meta: { needs: [], gives: ['lore:lo_roa_register'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '書見台に、語り部の名簿が\n開いてある。');
      await E.narr(ev, 'アルノ、ベルナ、リオナ……。\nリオナの欄には「戦にて」とある。');
      await E.narr(ev, 'その横に小さく、あとから\n書き足した字で「子も、病にて」。');
      if (R.Game.chars && R.Game.chars.hero) await E.narr(ev, 'いちばん新しい行に、\n{hero}の名が書き足されている。');
      E.lore(ev, 'lo_roa_register');
      const i = await ev.choose(['短い本を読む', 'やめておく'], { cancel: 1, text: '名簿の下に、薄い本がはさまっている。\n『手がかり帳の使い方』' });
      if (i !== 0) return;
      await E.narr(ev, '「聞いた話は、手がかり帳に\n書きとめておくこと。」');
      await E.narr(ev, '「手がかりには、目印をひとつ\n付けられる。目印の話は、\n地図に羽ペンで示される。」');
      await E.narr(ev, '「何から追うかは、\n自分の足で決めること。」\n――語り部の心得より');
    },
  };

  // ------------------------------------------------------------ 朝の席（夜明け待ち、STORY_BIBLE §3.4）
  D.roa_seat = {
    meta: { needs: [], gives: ['lore:lo_roa_seat'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '食卓の東向きの席が、\nひとつ空けてある。\n布が、きちんとかけてある。');
      const berna = (R.DB.maps.roa_house.npcs || []).find((n) => n.id === 'berna_desk');
      if (berna && R.State.check(berna.cond)) await E.say(ev, 'berna_desk', '昔からの習わしさ。\n誰の席かは……忘れちまったよ。', { voice: 'v_berna_seat_01', face: 'berna:neutral' });
      E.lore(ev, 'lo_roa_seat');
    },
  };
  D.roa_shelf = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, E.pick([
        { cond: 'cleared_r_forest', text: '古い語り部の本が並んでいる。\n『森の歌』の本の白いページに、\nうっすら字が戻っている。' },
        { text: '古い語り部の本が並んでいる。\nどの本も、ところどころ\nページが白く抜けている。' },
      ]));
    },
  };

  // ------------------------------------------------------------ 語り石（STORY_BIBLE §2.3。前半が白い）
  D.roa_stone = {
    meta: { needs: [], gives: ['lore:lo_roa_stone'] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '石に、物語が刻まれている。\n前の半分は、白く抜けて\n読めない。');
      await E.narr(ev, '後ろの半分に、かろうじて\n文字が残っている。');
      await E.narr(ev, '「……ひとりの語り部が、\nこの森に火をともした。」');
      E.lore(ev, 'lo_roa_stone');
    },
  };
  D.roa_hall = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.narr(ev, '語り石の間。\n語り直した伝承を、壁の語り板に\n刻んでおく所だという。');
      await E.narr(ev, E.pick([
        { cond: 'cleared_r_forest', text: '新しい語り板に、\n『千年樹の歌』が刻まれている。' },
        { text: 'まだ、新しい語り板は無い。' },
      ]));
      // TODO(リード・MENUS): 語り直しの場面の再生（WORLD_REDESIGN §5.2 の語り石の間）。縦切りでは語り板の文だけ。
    },
  };

  // ------------------------------------------------------------ 里の人
  D.roa_gate = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_berna')) return;
      await E.say(ev, 'gatewoman', '師匠に、あいさつして\nいかないのかい？\nベルナさんは、家の書見台だよ。');
    },
  };
  D.roa_gatewoman = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'gatewoman2', E.pick([
        { cond: 'cleared_r_forest', text: '西の森の灯が戻ったって\n行商の人が言ってたよ。\n{hero}のしわざだね？' },
        { cond: 'prologue_done', text: 'おかえり。ファロスの灯台、\nちゃんと光ってるよ。\n里からも見えるんだ。' },
        { text: '東へ出れば、半島の街道だよ。\n夜道には魔物が出る。\n気をつけてお行き。' },
      ]));
    },
  };
  D.roa_children = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      if (ev.flag('prologue_done')) {
        await E.say(ev, 'child_a', '灯台、光ったね！\nあれって、昔の人が\n語り直したんでしょ？');
        await E.say(ev, 'child_b', 'ぼくも、語り部に\nなれるかなあ。');
        return;
      }
      await E.say(ev, 'child_a', 'ねえ、おはようって、なに？');
      await E.say(ev, 'elder', 'さあねえ。\n語り部さまの口ぐせさ。');
      await E.say(ev, 'child_b', 'ふうん……。\nへんなの。');
    },
  };
  D.roa_elder = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'elder', E.pick([
        { cond: 'prologue_done', text: E.AGE.old },
        { text: ['朝の鐘は鳴るのに、\n空はずっと夜のまま。', 'わしの子どものころから\nそうじゃった……\nと思うんじゃがのう。'] },
      ]));
    },
  };
  D.roa_farmer = {
    meta: { needs: [], gives: ['item:i_salve'] },
    run: async (ev) => {
      const E = X();
      if (!ev.flag('prologue_farmer')) {
        await E.say(ev, 'farmer', '旅に出るんだって？\nなら、これを持っていきな。\n畑の薬草で作った傷薬さ。');
        await E.give(ev, 'i_salve', 1);
        ev.setFlag('prologue_farmer');
        return;
      }
      await E.say(ev, 'farmer', E.pick([
        { cond: 'cleared_r_forest', text: '近ごろ、畑の苗の\n育ちがいいんだ。\n空が明るくなったからかな。' },
        { text: '灯りの刻のうちに\n畑を見回るのが日課でね。\n灯りが無いと、何も育たん。' },
      ]));
    },
  };
  D.roa_weaver = {
    meta: { needs: [], gives: [] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'weaver', E.pick([
        { cond: 'prologue_done', text: 'ベルナさん、近ごろ\n物忘れがふえてねえ。\n……年のせいだといいけど。' },
        { text: ['ベルナさんは、朝いちばんに\n「おはよう」って言うんだよ。', '意味は知らないけど、\n語り部の家のしきたりさ。'] },
      ]));
    },
  };
  D.roa_youth = {
    meta: { needs: [], gives: ['lead:l_opt_well'] },
    run: async (ev) => {
      const E = X();
      await E.say(ev, 'youth', ['半島の北の分かれ道に、\n古い枯れ井戸があるんだ。', '底のほうで、きらきら光る\nものを見たやつがいてさ。\n……ほんとかなあ。']);
      if (ev.flag('prologue_done')) ev.lead('l_opt_well');
    },
  };

  // ------------------------------------------------------------ ロアの onEnter
  D.roa_enter = {
    meta: { needs: [], gives: [], calls: [] },
    run: async () => {
      // TODO(CONTENT-P・STORY_BIBLE §6.3・§12.2): T3 以降のロアの寄り道（ベルナが旅の話をせがむ）、T6 のロア（封書・客として迎える）、
      // 終盤のロア（story_final_roa）をここから呼ぶ。縦切り（ティア 0〜1）では何もしない。
    },
  };
})(window.RPG);
