# Backlog (owner ideas for later)

Items the owner asked for "later" — not part of the current demo-polish pass.

## 派生技の閃き（technique derivation）
- Using a specific technique repeatedly can make the user "discover" a derived technique (派生技を編み出す).
- The flash of insight can only happen while using THAT technique (その技を使ってる時しか閃かない).
- Owner: 「まああとで入れるんでいいよ」 → 2026-09-27 「進めて」: in progress.
- Design notes to decide later: per-technique use counter, derivation tree per weapon/spell line, chance per use (rising with uses and proficiency), a battle-time "閃いた！" presentation, and a check that each derived technique is reachable.
- Implemented (2026-09-27): `derive:[{to, uses, chance}]` on techs (60 edges, 5 weapon lines, no lv10 targets), `c.techUse`/`c.derived` saved (old saves → {}), roll after using X only (R.Glimmer.deriveRoll, K.DERIVE), glimmer banner 「〇〇から、△△を編み出した！」, 技・術 「〇〇から派生」. Sim: `node tools/sim_glimmer.js --derive`.

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
