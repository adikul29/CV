# Motion Studio — house rules

Every video here is a **program**, not a file: a scene's `index.html` exposes `window.seek(t)`
that paints the exact frame for time `t`. `engine/render.mjs` walks time, screenshots, and pipes to ffmpeg.

## Engine
- Route A, zero dependencies: Canvas 2D / SVG / DOM in one `index.html`, served by the renderer.
  Use Remotion / HyperFrames / p5 only if the brief names one.
- `seek(t)` must be **pure**: no `Date.now()`, no `requestAnimationFrame`, no `Math.random()`
  (use `hash()` from `lib/motion.js`). Same t → same pixels, every run.
- Set `window.SCENE = { duration, bpm }` and `window.__ready = true` after fonts load.
- Lay out in `U = min(W,H)/1080` units and branch on `portrait`; never hard-code pixels.
  Render 16:9, 1:1 and 9:16 from the same timeline; reframe, never crop.

## Motion
- No linear or CSS easing curves. Use closed-form springs from `lib/motion.js`:
  `snappy` UI · `default` containers/camera · `heavy` big type & lockups (no overshoot) · `playful` mascots.
- A value with more than one target uses `track(t, initial, [[at, to], …], preset)`; never restart a spring.
- Stagger groups 25–60 ms. Every cut and hit lands on the beat grid (`grid(bpm).beat(n)`).
- Give each shot one idea and a visual payoff every 3–5 s, with a hook in the first 2 s. No centered-text-on-gradient fades.

## Sound
- If a track is supplied: measure BPM/onsets with ffmpeg first, then cut to them.
- Otherwise write `score.mjs` with `lib/synth.mjs`; cues use the same beat numbers as the picture.
- API keys (ElevenLabs, image/video models) live in `.env`. Never paste them into prompts or code.

## Critique loop (mandatory)
1. Render a preview: `node engine/render.mjs scenes/<name> --w 1280 --h 720 --fps 30 --tag preview`
2. Open `out/sheet_preview.png` (and `--stills t1,t2` for specific moments) and **look at it**.
3. Score each shot 1–10 on composition, type, motion and sync. Write down the 3 worst problems, fix them, and re-render.
4. Repeat until every shot scores 8 or more. Only then do the final render (1920×1080 @ 60 by default).

## Effort
Medium for fixes and re-renders · xhigh for new films · max when the first 3 s carry a launch.
