#!/usr/bin/env node
// Route A renderer: serve the studio, call window.seek(t) for every frame,
// screenshot, pipe into ffmpeg, mux the synthesized score, emit a contact sheet.
//
//   node engine/render.mjs scenes/demo-reel                 # 1920x1080 @ 60
//   node engine/render.mjs scenes/demo-reel --w 1080 --h 1920 --fps 30 --tag vertical
//   node engine/render.mjs scenes/demo-reel --stills 0.5,2.2,4.8   # stills only, for critique
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { return require(p); } catch {} }
  throw new Error('playwright not found: run `npm i` in motion-studio');
})();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const sceneDir = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'scenes/demo-reel');
const W = +opt('w', 1920), H = +opt('h', 1080), FPS = +opt('fps', 60);
const tag = opt('tag', `${W}x${H}`);
const stills = opt('stills');
const outDir = join(sceneDir, 'out'); mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(readFileSync(p));
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
await page.goto(`http://localhost:${port}/${relative(ROOT, sceneDir)}/index.html?w=${W}&h=${H}&fps=${FPS}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const scene = await page.evaluate(() => window.SCENE);
const dur = +opt('duration', scene.duration);
const seek = (t) => page.evaluate((t) => window.seek(t), t);
const t0 = Date.now();

if (stills) {
  const times = stills.split(',').map(Number);
  for (const t of times) { await seek(t); await page.screenshot({ path: join(outDir, `still_${tag}_${t.toFixed(2)}s.png`) }); }
  console.log(`stills → ${outDir}`);
} else {
  // Score first, so audio and picture share one timeline.
  let wav = null;
  const scorePath = join(sceneDir, 'score.mjs');
  if (existsSync(scorePath)) {
    wav = join(outDir, 'score.wav');
    await (await import(pathToFileURL(scorePath))).default({ out: wav, duration: dur, bpm: scene.bpm });
  }
  const mp4 = join(outDir, `${basename(sceneDir)}_${tag}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    ...(wav ? ['-i', wav] : []), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
    ...(wav ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(dur * FPS);
  for (let f = 0; f < frames; f++) {
    await seek(f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`\r  frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  // Contact sheet: 12 evenly spaced frames, for the critique loop.
  const sheet = join(outDir, `sheet_${tag}.png`);
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `fps=12/${dur},scale=480:-1,tile=4x3:padding=6:color=white`, '-frames:v', '1', sheet]);
  console.log(`\r✓ ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${relative(process.cwd(), mp4)}\n  sheet → ${relative(process.cwd(), sheet)}`);
}
await browser.close();
server.close();
