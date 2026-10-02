// Score for demo-reel: 8 s at 120 BPM, every cue taken from the picture's beat grid.
import { createMix } from '../../lib/synth.mjs';

export default function score({ out, duration, bpm = 120 }) {
  const S = createMix(duration), b = (n) => n * 60 / bpm;
  // Shot 1: dot, stretch, letter ticks, riser into the drop.
  S.blip(b(0), 84, 0.2); S.whoosh(b(1) - 0.1, 0.35, 0.15);
  'MOTION'.split('').forEach((_, i) => S.blip(b(2) + i * 0.05, 76 + i * 2, 0.08, i % 2 ? 0.4 : -0.4));
  S.riser(1.0, 2.0, 0.22); S.pad(0, [57, 64, 69], 2.2, 0.035);
  // Drop at 2.0 s: groove for shots 2–3.
  S.impact(b(4), 0.55);
  for (let n = 4; n < 12; n++) { S.kick(b(n)); S.hat(b(n) + b(0.5)); if (n % 2) S.clap(b(n)); }
  [45, 45, 48, 43, 45, 45, 52, 50].forEach((m, i) => S.bass(b(4 + i), m - 12 + 12, 0.42, 0.28));
  S.whoosh(3.45, 0.5, 0.3);
  // Shot 3: one pop per square, pitch climbing with the data.
  for (let i = 0; i < 8; i++) S.blip(4.0 + i * 0.06, 72 + [0, 2, 3, 5, 7, 8, 10, 12][i], 0.1, (i - 3.5) / 5);
  S.riser(5.5, 6.0, 0.18);
  // Shot 4: collapse, ring, lockup bell.
  S.whoosh(6.0, 0.4, 0.2); S.impact(b(13), 0.45); S.kick(b(13), 0.8);
  S.bell(b(14), 81, 0.16); S.bell(b(14) + 0.12, 88, 0.1);
  S.pad(b(13), [57, 64, 69, 76], duration - b(13), 0.04);
  S.write(out);
}
