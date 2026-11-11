# Party sprites for the twilight RPG demo: shared brief

Goal: field sprites for a party of four that walk and RUN together on the painted maps of the demo in
`/home/user/others/chronicle2/twilight/` (a 2D RPG look test for a non-engineer owner with a sharp eye for art).
The hero already exists and was liked. The three companions and all run cycles are new. Each helper makes ONE character.

## What exists (read these first, do not re-derive)
- The finished hero: `/home/user/others/chronicle2/twilight/site/hero.png` (384x1024: 4 cols x 8 rows of 96x128 frames,
  foot anchor (48,120), figure 80 art px tall, 28 colours) and `site/hero.json`. Rows: down, left, right, up, down_left,
  down_right, up_left, up_right. Cols: stand, left step, stand, right step.
- How it was made, step by step, scripts in `/home/user/tw/hero/` (copies in the repo under `build/hero/`):
  `make_guide7.py` (grey mannequin guide), `gen_o7.py` (main 4 directions over the guide, with `mapref_4x.png` as density
  and palette reference), `gen_diag7.py` (diagonals from the chosen main sheet), `build.py` (cut, resample to the target
  height, palette), `finish.py` (dot eyes, own-colour outline, json, preview, gif), `convert.py`, `design.py`.
  Chosen raw generations: `/home/user/tw/hero/raw/p7b.png` (main) and `q7a.png` (diagonals); their prompts sit beside them
  as `*_prompt.txt`. Read those prompts: the STYLE block in `gen_o7.py` is the look the owner accepted.
- Image generation: OpenAI Images API, model `gpt-image-2` only (never any 'astra' model). Key from env `OPENAI_API_KEY`.
  Helpers: `/home/user/others/chronicle/design/sprite_pipe/tools` (`gen_api`, `gen_sheets`, `pixlib`; export `OPENAI_MODEL`
  and `OPENAI_USAGE_LOG=/home/user/tw/log/usage_party.jsonl` if they ask for them) or the simpler
  `/home/user/others/chronicle2/twilight/build/img.py` (`python3 img.py prompt.txt out.png --size WxH --quality high --image a.png --image b.png`).
  gpt-image-2 facts: sizes divisible by 16, longest edge <= 3840, no transparent background (use flat magenta #FF00FF and
  cut it), it ignores a requested pixel grid (measure the drawn dot size and resample, as `build.py` does).
- Never put the owner's name, e-mail or project name into any request to an outside service.

## Style rules (the owner's words, do not drift)
Modern HD-2D field sprite (Octopath Traveler II direction), NOT a 16-bit chibi: about 3.3 heads tall, small head drawn
with fine pixels, eyes are tiny dark dots (1x2 px), no nose, no mouth, no black outline (edges are a darker shade of the
shape's own colour), muted dusty colours, 3-4 shades per material, about 18-28 colours per sheet, calm shading from the
upper left, props true to scale and few. The new character must look drawn by the same hand as the hero: same dot size,
same head size, same level of detail. Always pass the hero's raw sheet (`p7b.png`) as a style reference image.

## Deliverables for character `<id>` (ids: hero, sword, rogue, priest)
In `/home/user/others/chronicle2/twilight/site/party/`:
1. `<id>.png`: walk sheet, exactly the hero's layout (384x1024, 96x128 frames, foot anchor (48,120), same row and col order).
2. `<id>_run.png`: run sheet, same grid and anchor: 8 rows x 4 cols, a 4-frame run cycle per direction
   (col 1 left foot lands, col 2 both feet off the ground, col 3 right foot lands, col 4 both feet off the ground).
   The owner asked for: "走るモーション、ちょっと前傾姿勢" = the body leans forward into the run (clearly, about 10-15 degrees,
   visible in side and diagonal views; in front and back views show it by a lowered head, raised bent arms and a long stride).
   Hair, cape, scarf or robe hem stream behind. The run must read as faster than the walk at a glance.
3. `<id>.json`: `{"frame":[96,128],"foot":[48,120],"body":<figure height px>,"ms":170,"run":{"src":"<id>_run.png","cols":4,"ms":105}}`
   (the hero also keeps its `lantern` table; add `"runLantern"` in the same form for the run sheet).
4. Previews for the owner in `/mnt/project-files/twilight-rpg/party/` (network mount: keep the trailing slash, never search
   the whole folder, re-read a file about 10 s after writing): `<id>_preview.png` (walk and run sheets at 4x on a crop of a
   painted map, next to the hero's frames for size comparison) and `<id>_walk.gif`, `<id>_run.gif` (down, left, up, down_left).
Scratch work goes to `/home/user/tw/party/<id>/`. Keep the scripts you write there (they will be copied into the repo later).

## Rules
- Do not edit `site/game.js`, `site/hd.js`, any map data or other characters' files. Do not run git commands.
- Judge with your own eyes before you finish: open the previews. Check every row: correct facing (left is left, right is
  right, back views show no eyes), feet on the anchor line (no sliding between frames), same height in all rows (+-1 px),
  weapon and shield on the same side of the body in every view, no magenta fringe, no near-black outline, no stray pixels,
  size and head size matching the hero when standing side by side. Regenerate or repair until it holds; if a direction
  cannot be made good, say exactly which one in your report.
- Budget: aim for at most about 25 generations. Report: files written, what is good, what is weak, with paths.
