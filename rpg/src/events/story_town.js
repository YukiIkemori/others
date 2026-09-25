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
      await ev.say('わたしは うらないし。\nあなたたちの ゆくすえを\nみて あげましょう。');
      if (!(await ev.yesno('うらなって ほしいかい？'))) {
        await ev.say('そうかい。\nまよったら いつでも おいで。');
        return;
      }
      await ev.say('むむむ……\nみえる…… みえるよ……。');
      if (R.Story) R.Story.refreshObjective();
      const o = R.DB.objectives && R.DB.objectives[R.Game.objective];
      if (o && o.text) await ev.say(o.text);
      await ev.say('……と すいしょうが\nつげて いるよ。');
    },
  };

  // ユウキ's mother (regnas_house_yuki): a free night's rest at home.
  E.yuki_mother = {
    meta: NONE,
    run: async (ev) => {
      if (!ev.flag('met_mother')) {
        ev.setFlag('met_mother');
        await ev.say('ユウキ！ おうさまの ところへ\nいって きたんだね。');
        await ev.say('とうさんが いきて いたら\nどんなに よろこんだ ことか……。\nノンちゃん メテムちゃん\nユウキを よろしく たのむよ。');
      } else {
        await ev.say('おかえり ユウキ。\nみんなも げんき そうだね。');
      }
      if (await ev.yesno('すこし やすんで いくかい？')) {
        await ev.say('じゃあ ゆっくり おやすみ。');
        await ev.fadeOut(40);
        ev.heal();
        await ev.jingle('inn');
        await ev.wait(30);
        await ev.fadeIn(40);
        await ev.say('おはよう！ げんきが でたみたいだね。\nいってらっしゃい！');
      } else {
        await ev.say('そうかい。 むりは しないでね。\nつかれたら いつでも かえって おいで。');
      }
    },
  };

  // メテム's mother (arcana_house_metem): scolding, love and a free rest.
  E.metem_mother = {
    meta: NONE,
    run: async (ev) => {
      if (!ev.flag('met_metem_mother')) {
        ev.setFlag('met_metem_mother');
        await ev.say('メテム！ あんた ちゃんと\nごはん たべてるの？\nまた ほんばかり よんで\nよふかし してるんでしょう。');
        await ev.say('メテム「もう！ おかあさん\nみんなの まえで やめてよ！」');
        await ev.say('ユウキくん ノンちゃん\nこの こ くちは わるいけど\nほんとは やさしい こだから。\nよろしくね。');
      } else {
        await ev.say('おかえり メテム。\nみんなも よく きたわね。');
      }
      if (await ev.yesno('ひとやすみ して いく？')) {
        await ev.say('じゃあ あたたかい スープを\nつくるわね。');
        await ev.fadeOut(40);
        ev.heal();
        await ev.jingle('inn');
        await ev.wait(30);
        await ev.fadeIn(40);
        await ev.say('げんき いっぱいね！\nいってらっしゃい！');
      } else {
        await ev.say('そう？ むりは しないのよ。');
      }
    },
  };

  // Elfin: the sacred spring heals the party.
  E.elfin_spring = {
    meta: NONE,
    run: async (ev) => {
      await ev.say('いずみの みずは ひんやりと\nすんでいる……。');
      if (await ev.yesno('いずみの みずを のみますか？')) {
        R.sfx('heal');
        ev.heal();
        await ev.flash('#c0f0ff', 16);
        await ev.say('からだの おくから\nちからが わいて くる！\nみんなの HPと MPが かいふくした！');
      }
    },
  };
})(window.RPG);
