---
name: motion-reel
description: Make a code-rendered motion graphics video (showreel, product launch, explainer, data-viz reel, social ad) with the motion-studio seek(t) engine. Use when asked for a motion graphics video, animated reel, launch video, kinetic typography or an animated ad.
---

# /motion-reel — <brief or URL>, <length>, <format>, reference <path>

Work in `motion-studio/`, and follow `motion-studio/CLAUDE.md` exactly.

1. **Brief.** If the request is a one-liner, expand it into `templates/director-brief.md` first: logline, references, beat sheet at the chosen BPM, and text on screen. For a product, fetch its site and use the real screenshots, logo and colors. For a UI film, write a state list based on `templates/state-spec.xml`.
2. **Reference.** If a frame or video is given, extract frames with ffmpeg and describe the pacing shot by shot before writing code. If a folder is given, write `style_guide.md` from it.
3. **Build.** Copy `scenes/demo-reel` to `scenes/<name>`. Write `index.html` (pure `seek(t)`, `U` layout, springs and `track()`) and `score.mjs` (cues on the same beat numbers).
4. **Critique loop.** Render the preview, open the contact sheet and stills, score each shot, and fix the 3 worst problems. Repeat until every shot scores 8 or more.
5. **Ship.** Do the final render for every requested format (16:9 1920×1080@60, 9:16 1080×1920, 1:1 1080×1080). Report the file paths, attach the sheet, and list what changed in each critique round.
