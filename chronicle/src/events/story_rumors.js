// うわさ話 (DESIGN §10.9.3, §10.8.0-8). Owner: story (A19).
//   R.DB.rumors['<town>_a'|'<town>_b'] = { town, kind:'a'|'b', text:[{cond, text}…] }  (the §3.2.4 form,
//   picked top-down; the last entry has no cond). The town owners place two NPCs per town:
//     {id:'folk_a', event:'story_rumor', rumor:'<town>_a', move:'wander', push:true}
//     {id:'folk_b', event:'story_rumor', rumor:'<town>_b', move:'wander', push:true}   (not in nerei / biblia)
//   folk_a = the tier's mood (the same table in every town) + one line of the town's own;
//   folk_b = the next region not yet cleared, counted from the town's own region (N+1, N+2 … 8, 1 …;
//            ロア・ファロス from 1; its own region skipped); when all are cleared, the folk_a table.
//   E.story_rumor reads the NPC's `rumor` and says the first entry whose cond holds.
(function (R) {
  'use strict';
  const DB = R.DB;
  const E = DB.events;

  // ------------------------------------------------------------ the tier's mood (folk_a, every town)
  const MOOD = {
    post: 'なんだか、忘れていた昔話を\nたくさん思い出したんだ。\n孫に聞かせてやらなくちゃ。',
    fog: '内海の霧が晴れたんだって！\n島に、白い大きな塔が\n見えるそうだよ。',
    t7: '記録院の人たちが、急に\n町からいなくなったよ。\n内海の島へ戻ったらしい。',
    t6: '子守歌の続きが思い出せない。\n母さんが歌ってくれたのに……。',
    t4: '記録院のお触れを聞いたかい。\n本を納めないと敵だってさ。\n……物騒だねえ。',
    t3: '記録院が、古い本を集めて\n回ってるんだってさ。\n伝承を守るためだって。',
    t1: 'どこかの土地で、忘れられた\n伝承が語り直されたらしい。\n語り部の見習いだとか。',
    t0: '近ごろ、昔話の続きが\nどうしても出てこないんだ。\n年のせいかねえ。',
  };
  // the order the mood lines are tried in (§10.9.3), with the town line that follows each
  // (base = tiers 0–3, late = tiers 4–7 and the fog, post = after the ending)
  const MOOD_ORDER = [
    ['post', { postgame: true }, 'post'],
    ['fog', 'final_open', 'late'],
    ['t7', { tier: 7 }, 'late'],
    ['t6', { tier: 6 }, 'late'],
    ['t4', { tier: 4 }, 'late'],
    ['t3', { tier: 3 }, 'base'],
    ['t1', { tier: 1 }, 'base'],
    ['t0', null, 'base'],
  ];

  // ------------------------------------------------------------ one line of each town's own
  const LOCAL = {
    roa: {
      base: 'ベルナさんの弟子なら、\nきっと大丈夫さ。\n里のみんなが応援してるよ。',
      late: '里の子どもたちも、\n昔話をせがまなくなった。\nさみしいもんだよ。',
      post: '{hero}の旅の話なら、\n里の子はみんな\nそらで言えるよ。',
    },
    lute: {
      base: 'ファロスは、船と歌の町さ。\n……歌のほうは、近ごろ\nさっぱりだけどね。',
      late: '記録院の出張所に、\n本を抱えた人の列が\nできてるよ。',
      post: '灯台守の歌に、語り部の\n旅の歌。酒場は、毎晩\n歌でいっぱいさ。',
    },
    fern: {
      base: '森の歌を忘れてから、\n森の木まで、元気が\nないように見えるんだ。',
      late: '木こりの歌も、ひとつ\n思い出せなくなった。\n斧が重く感じるよ。',
      post: '夏至の祭りの歌を、\n今年は村じゅうで\n歌ったんだよ。',
    },
    kasim: {
      base: '隊商の連中は、みんな\n砂嵐がやむのを待って\n酒場に居すわってるよ。',
      late: '夕べの祈りの言葉まで、\nあやふやになってきた。\n困ったもんだ。',
      post: '夕べの祈りで、王さまの\n名を呼ぶのが、町の\n楽しみになったよ。',
    },
    yule: {
      base: '外は吹雪、中は\nまきの取り合いさ。\n早く春が来ないかね。',
      late: '冬至の歌を、子どもに\n教えてやれないんだ。\n親として情けないよ。',
      post: '竜の峰に日が当たって、\nきらきら光ってる。\nいい眺めだろう？',
    },
    loch: {
      base: '町の鐘楼の鐘も、なぜか\n鳴らなくなっちまった。\n霧のせいかねえ。',
      late: '水路の舟歌が、だれの\n口からも出てこない。\n町が静かすぎるよ。',
      post: '朝の鐘が鳴ると、\n子どもたちが一緒に\n歌いだすんだ。',
    },
    coral: {
      base: '港の船乗りは、霧の夜は\nみんな陸にいるよ。\n命あっての物だねさ。',
      late: '舟歌を忘れた船乗りは、\n星を見て帰るしかない。\n……その星も、どうだか。',
      post: 'レグナスの商船が、\n東の大陸の話を\nたくさん運んでくるよ。',
    },
    nerei: {
      base: 'マリナばあさんは、毎晩\n岬の桟橋に立ってるよ。\nだれを待ってるのかね。',
      late: '漁の歌も、網の結び方の\n歌も、みんな白紙さ。\n手が覚えてるだけだよ。',
      post: 'マリナばあさん、近ごろ\nよく笑うようになった。\nいいことさ。',
    },
    dovan: {
      base: '鍛冶場の火が落ちると、\n町が寒くってかなわん。\n早く坑道が開くといい。',
      late: 'ハンマーを振るっても、\n歌が出てこねえ。\n調子が狂うってもんだ。',
      post: 'ハンマーの音と、誓いの歌。\nこれがドヴァンの\n朝ってもんよ。',
    },
    caldera: {
      base: '火の神殿の巫女さまも、\n毎日、山を見上げては\nため息ばかりさ。',
      late: '温泉まで灰で\nにごっちまった。\n体の芯まで冷えるよ。',
      post: '空を見てごらん。\n火の鳥が、ときどき\n山の上を飛ぶんだ。',
    },
    orbis: {
      base: '学院の学者さんたちも、\n星の名前が出てこないと\n頭をかかえてるよ。',
      late: '図書館の本が、記録院に\nごっそり持っていかれた。\n棚ががらがらさ。',
      post: '学院の子が、星の名を\n毎晩ひとつずつ\n覚えているそうだよ。',
    },
  };

  // ------------------------------------------------------------ the regions' rumours (folk_b)
  const HINT = {
    r_forest: '西のヴェルダの森で、\n木こりが帰ってこないそうだ。\n森が道を変えるんだとか。',
    r_desert: '南西のザハラ砂漠は、\n砂嵐で隊商が出せないらしい。\nオアシスも干上がりかけてる。',
    r_snow: '北西のノルデン雪原じゃ、\n春になっても吹雪が\nやまないんだってさ。',
    r_marsh: '東の湿原の町ロッホで、\n霧の中に子どもが消えるって。\nファロスから船が出てるよ。',
    r_isles: '南東のマレア諸島に、\n幽霊船が出るらしい。\nファロスの港から船で行ける。',
    r_mine: '北の鉱山都市ドヴァンで、\n坑道の奥から鉄の化け物が\n出てきたそうだ。',
    r_ash: '南の灰の荒野じゃ、\n火山の灰が降りやまない。\n畑が全滅だってさ。',
    r_star: '北東のオルビスでは、\n夜空の星が毎晩ひとつずつ\n消えていくらしい。',
  };
  const REGIONS = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
  // the towns with rumour folk, and the region each belongs to (0 = the prologue towns)
  const TOWNS = { roa: 0, lute: 0, fern: 1, kasim: 2, yule: 3, loch: 4, coral: 5, nerei: 5, dovan: 6, caldera: 7, orbis: 8 };
  const NO_B = { nerei: true, biblia: true }; // §10.9.3: nerei and biblia have no folk_b

  /** the folk_a table of a town: the mood line, then the town's own line on the next page */
  function moodTable(town) {
    const loc = LOCAL[town] || {};
    return MOOD_ORDER.map(([k, cond, part]) => {
      const text = loc[part] ? MOOD[k] + '\f' + loc[part] : MOOD[k];
      return cond ? { cond, text } : { text };
    });
  }
  /** the folk_b table: the regions from N+1 round to N-1 (own region skipped), then folk_a's */
  function hintOrder(n) {
    const out = [];
    for (let k = 0; k < 8; k++) {
      const i = (n + k) % 8; // n = the town's region number (1..8), 0 for the prologue towns → from r_forest
      const r = REGIONS[i];
      if (n > 0 && i === n - 1) continue;
      out.push(r);
    }
    return out;
  }
  function hintTable(town) {
    const n = TOWNS[town] || 0;
    return hintOrder(n).map((r) => ({ cond: { notCleared: r }, text: HINT[r] })).concat(moodTable(town));
  }

  const rumors = {};
  for (const town of Object.keys(TOWNS)) {
    rumors[town + '_a'] = { town, kind: 'a', text: moodTable(town) };
    if (!NO_B[town]) rumors[town + '_b'] = { town, kind: 'b', text: hintTable(town) };
  }
  // ビブリア (§10.10.2): while the town is white (final_arrived … game_clear) people have lost
  // themselves; after the ending they talk again. Only folk_a.
  rumors.biblia_a = {
    town: 'biblia', kind: 'a', text: [
      { cond: { postgame: true }, text: '長い夢を見ていたみたい。\n目が覚めたら、昔の歌を\nぜんぶ思い出していたの。\fこの町の人は、ずっと\n書くばかりだったけれど……\nこれからは、歌も覚えるわ。' },
      { text: '……あなたは、誰？\nわたしは……誰だったかしら。\f名前を呼んでくれる人が\nいたはずなのに……\n思い出せないの。' },
    ],
  };
  Object.assign(DB.rumors, rumors);

  // ------------------------------------------------------------ the event the folk run
  E.story_rumor = {
    meta: { needs: [], gives: [] },
    /** the tables (tools / tests) */
    MOOD, LOCAL, HINT, TOWNS, hintOrder,
    run: async (ev) => {
      const npc = (ev.ctx && ev.ctx.npc) || (R.Field && R.Field.npc && ev.self ? R.Field.npc(ev.self) : null) || {};
      const id = npc.rumor || (ev.map ? ev.map + (ev.self === 'folk_b' ? '_b' : '_a') : null);
      const r = id && DB.rumors[id];
      if (!r) {
        R.warn('story_rumor: unknown rumor', id);
        await ev.say(MOOD.t0);
        return;
      }
      if (npc && ev.npc && ev.self) ev.npc(ev.self).face('player');
      await ev.say(r.text);
    },
  };
})(window.RPG);
