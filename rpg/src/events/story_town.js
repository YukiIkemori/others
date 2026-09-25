// Town services and small town events used by the maps in src/maps/town_*.js.
// Service NPCs carry their parameters on the NPC definition:
//   {event:'shop', shop:'regnas_item'}     buy / sell (R.Shop)
//   {event:'inn', price:6}                 standard inn (sets the respawn point)
//   {event:'church'}                       save / revive / cure (sets the respawn point)
//   {event:'chat', talk:[{cond, text}, …], text}
//        the first variant whose cond holds (R.State.check syntax) is said;
//        `text` is the fallback. text = string or array of pages.
(function (R) {
  'use strict';
  const E = R.DB.events;
  const npcOf = (ev) => (ev.ctx && ev.ctx.npc) || (R.Field && ev.self && R.Field.npc(ev.self)) || {};
  const NONE = { needs: [], gives: [] };

  E.shop = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      if (n.greet) await ev.say(n.greet);
      await ev.shop(n.shop);
    },
  };

  E.inn = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      if (n.greet) await ev.say(n.greet);
      await ev.inn(n.price || 10);
    },
  };

  E.church = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      if (n.greet) await ev.say(n.greet);
      await ev.church();
    },
  };

  E.chat = {
    meta: NONE,
    run: async (ev) => {
      const n = npcOf(ev);
      const v = (n.talk || []).find((t) => ev.check(t.cond));
      const text = v ? v.text : n.text;
      await ev.say(text != null ? text : '……。');
    },
  };

  // Fortune tellers (Salva, Arcana): read the current story objective as a vision.
  E.fortune = {
    meta: NONE,
    run: async (ev) => {
      await ev.say('わたしは占い師。\nあなたたちの行く末を\n見てあげましょう。');
      if (!(await ev.yesno('占ってほしいかい？'))) {
        await ev.say('そうかい。\n迷ったら、いつでもおいで。');
        return;
      }
      await ev.say('むむむ……\n見える……見えるよ……。');
      if (R.Story) R.Story.refreshObjective();
      const o = R.DB.objectives && R.DB.objectives[R.Game.objective];
      if (o && o.text) await ev.say(o.text);
      await ev.say('……と、水晶が告げているよ。');
    },
  };

  // Yuki's mother (regnas_house_yuki): a free night's rest at home.
  E.yuki_mother = {
    meta: NONE,
    run: async (ev) => {
      if (!ev.flag('met_mother')) {
        ev.setFlag('met_mother');
        await ev.say('{yuki}！　王様のところへ\n行ってきたんだね。');
        await ev.say('父さんが生きていたら、\nどんなに喜んだことか……。\n{non}ちゃん、{metem}ちゃん、\n{yuki}をよろしく頼むよ。');
      } else {
        await ev.say('おかえり、{yuki}。\nみんなも元気そうだね。');
      }
      if (await ev.yesno('少し休んでいくかい？')) {
        await ev.say('じゃあ、ゆっくりおやすみ。');
        await ev.fadeOut(40);
        ev.heal();
        await ev.jingle('inn');
        await ev.wait(30);
        await ev.fadeIn(40);
        await ev.say('おはよう！　元気が出たみたいだね。\nいってらっしゃい！');
      } else {
        await ev.say('そうかい。無理はしないでね。\n疲れたら、いつでも帰っておいで。');
      }
    },
  };

  // Metem's mother (arcana_house_metem): scolding, love and a free rest.
  E.metem_mother = {
    meta: NONE,
    run: async (ev) => {
      if (!ev.flag('met_metem_mother')) {
        ev.setFlag('met_metem_mother');
        await ev.say('{metem}！　あんた、ちゃんと\nご飯食べてるの？\nまた本ばかり読んで、\n夜ふかししてるんでしょう。');
        await ev.say('{metem}「もう！　お母さん、\nみんなの前でやめてよ！」');
        await ev.say('{yuki}くん、{non}ちゃん。\nこの子、口は悪いけど、\n本当は優しい子だから。\nよろしくね。');
      } else {
        await ev.say('おかえり、{metem}。\nみんなもよく来たわね。');
      }
      if (await ev.yesno('ひと休みしていく？')) {
        await ev.say('じゃあ、温かいスープを\n作るわね。');
        await ev.fadeOut(40);
        ev.heal();
        await ev.jingle('inn');
        await ev.wait(30);
        await ev.fadeIn(40);
        await ev.say('元気いっぱいね！\nいってらっしゃい！');
      } else {
        await ev.say('そう？　無理はしないのよ。');
      }
    },
  };

  // Elfin: the sacred spring heals the party.
  E.elfin_spring = {
    meta: NONE,
    run: async (ev) => {
      await ev.say('泉の水は、ひんやりと\n澄んでいる……。');
      if (await ev.yesno('泉の水を飲みますか？')) {
        R.sfx('heal');
        ev.heal();
        await ev.flash('#c0f0ff', 16);
        await ev.say('体の奥から、\n力がわいてくる！\nみんなのHPとMPが回復した！');
      }
    },
  };
})(window.RPG);
