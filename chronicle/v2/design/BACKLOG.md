# Backlog (owner ideas for later)

Items the owner asked for "later" — not part of the current demo-polish pass.

## 派生技の閃き（technique derivation）
- Using a specific technique repeatedly can make the user "discover" a derived technique (派生技を編み出す).
- The flash of insight can only happen while using THAT technique (その技を使ってる時しか閃かない).
- Owner: 「まああとで入れるんでいいよ」 → 2026-09-27 「進めて」: in progress.
- Design notes to decide later: per-technique use counter, derivation tree per weapon/spell line, chance per use (rising with uses and proficiency), a battle-time "閃いた！" presentation, and a check that each derived technique is reachable.
- Owner clarification (2026-09-28): 「技や術は基本普通の通常攻撃を使ってれば覚えるのよ。でも幾つかの技は派生技といって何かの技を使ってたらその上位版を覚えるの。派生技は普通の通常攻撃使ってるだけじゃ覚えないのよ。派生技ってレア技なのよ。そんな数必要ないのよ」「回数こなすと必ず覚えられるってことはやめて。回数と熟練度があっても確率なのよ、結局は。確率と相手のランクと自分の相性の問題。確定ひらめけるのは面白くないし、むしろ最上位の技とかは覚えづらいものなのよ」
- Implemented (2026-09-28, replaces the 09-27 edge version):
  - 14 new rare techs with `derived: {from, lv}` and no `glim`, so they are outside the glimmer pool. Sword 3, greatsword 3, dagger 3, bow 3, staff 2; four of them are 2-step chains.
    - 連ね斬り→返し刃→抜刀返し刃, 抜き打ち→疾風の抜き打ち
    - なぎ倒し→大なぎ倒し→旋風なぎ倒し, 大上段→真っ向大上段
    - 急所ねらい→急所二連突き→急所千本突き, 毒の一刺し→猛毒の一刺し
    - 二つ矢→三つ矢→五つ矢, 鷹の一矢→大鷹の一矢
    - 念じ打ち→念じ砕き, 念弾→大念弾
    - つばめ返し, 捨て身, 二段突き and 乱れ突き are banned by STYLE_JA §7.1, hence 返し刃 and the other names.
  - Rolled only after the parent is used (R.Glimmer.deriveRoll). No other action ever rolls.
  - The chance is shaped like the glimmer: base[tier] × 相性 × GF(dex) × enemy rankB vs lv × a mild prof and use bonus, capped at 0.6% per use for tier 1 and 0.09% for tier 2 (K.DERIVE). There is no guarantee; the minimum is 3 uses.
  - `c.techUse` and `c.derived` are saved; old saves load as {}.
  - The battle banner reads 「〇〇から、△△を編み出した！」 and the 技・術 menu tags 「〇〇から派生」.
  - Sim: `node tools/sim_glimmer.js --derive`.
    - Spamming one parent through the demo gives any derivation ~36% of the time, and tier 2 ≤ 2%.
    - Casual play: ~14% in the demo.
    - Casual play: tier 2 ≤ 2.5% by the clear.

## 敵の前列・後列（enemy rows）
- Proposed: enemy front/back rows, melee can't reach the back row while the front lives, bows/spells can.
- Owner: 「敵の前列後列はとりあえずいいや」 — not now; enemies stay single-row.

## Halted for now
- ~~Desert and snow regions~~ → resumed 2026-09-27 (「６，７，を進めて」). Demo closures stay while config.slice is on.
- Per-region voices.

## Town design rule (owner, 2026-09-27)
- Only Roa is an orthodox village. Every other town gets a distinctive, unusual concept — no rows of square "tofu" houses; odd shapes and non-brick/wood materials welcome.
- Break the grid: irregular placement/orientation/spacing, winding paths, organic shapes.
- One strange large building may hold several shops (each with its own door).
- Yura (riverside mill village) is accepted for now; later passes can break it up further.
- Towns: small props must never block movement; keep clutter off paths (owner 2026-09-27)
