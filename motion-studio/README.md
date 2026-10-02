# Motion Studio

Code-rendered motion graphics. The pipeline follows Movez's *"How to build a motion design studio with Opus 5.5"*:
a deterministic `seek(t)` page → headless Chromium frame capture → ffmpeg, with closed-form springs,
a beat-locked synthesized score, and a contact-sheet critique loop.

```
engine/render.mjs        renderer (frames → MP4 + score mux + contact sheet, or --stills)
lib/motion.js            spring(), track(), presets, beat grid, colour mix, deterministic grain
lib/synth.mjs            kick/hat/clap/bass/pad/riser/impact/whoosh/blip/bell → WAV
scenes/demo-reel/        8 s, 120 BPM reference reel (index.html + score.mjs)
templates/               director's brief + one-shape state-list spec
CLAUDE.md                house rules applied to every video
```

```bash
npm i                     # playwright (needs ffmpeg on PATH)
npm run preview           # 720p30 + sheet_preview.png
npm run render            # 1080p60
node engine/render.mjs scenes/demo-reel --w 1080 --h 1920 --fps 30 --tag vertical
```

New film: copy `scenes/demo-reel`, then fill in `templates/director-brief.md` or use the `/motion-reel` skill.
