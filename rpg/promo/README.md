# Promo trailer (X / Twitter)

`luminas_trailer.mp4`: 1920x1080, 30 fps, H.264 High (CRF 19, yuv420p, faststart) with AAC 48 kHz stereo at -14 LUFS, about 51 s long.
Every shot is real gameplay captured from `debug.html`. The soundtrack uses the game's own music, and the game's own SFX are placed on the frames where the game played them.

## Regenerate

```sh
# 1. game audio → /tmp/claude-0/audio/*.wav (BGM, jingles, all SFX)
node tools/render_audio.js render title battle abyss lastboss ending victory rare jobup --wav
node tools/render_audio.js render --sfx --wav

# 2. footage → promo/frames/<scene>/00000.png … + sounds.json (≈2 min, deterministic)
node promo/capture.js            # or: node promo/capture.js battle rare   (single scenes)

# 3. compose video + audio → promo/luminas_trailer.mp4 (≈2 min)
pip install numpy pillow imageio-ffmpeg   # if missing
python3 promo/compose.py --stills          # --stills also writes promo/stills/*.png
python3 promo/compose.py --preview 17.0    # one frame → promo/preview.png
```

- `capture.js` drives the real engine one frame at a time (`R.Engine.paused`, two `step()`s per video frame) and sends input through `R.Input._set`. It sets up a late-game party (Lv 45–55, mastered jobs, abyss gear) itself. It uses two capture-only hooks, and nothing under `src/` changes:
  - `R.sfx`, `R.jingle` and `R.bgm` are logged to `sounds.json`.
  - In the `rare` scene, the reward roll is forced so that the rare drop popup appears.
- `compose.py` holds the storyboard (`SECTIONS`: shots, captions and the side the caption panel sits on) and does the layout, music bed, ducking and loudness.
- Output files, frames and stills are git-ignored.
