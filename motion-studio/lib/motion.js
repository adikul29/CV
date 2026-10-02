// Closed-form motion primitives. Every function is a pure function of time,
// so seek(t) can paint frame 812 without simulating frames 0..811.

export const P = {
  snappy:  { k: 400, c: 30, m: 1 }, // buttons, toggles, leading edges (tiny overshoot)
  default: { k: 170, c: 24, m: 1 }, // cards, containers, camera
  heavy:   { k: 120, c: 24, m: 1 }, // big type, 3D, logo lockups (no overshoot)
  playful: { k: 300, c: 11, m: 1 }, // mascots, stickers (visible overshoot)
};

// Unit step response of a damped spring, 0 -> 1, starting at rest at t = 0.
export function spring(t, p = P.default) {
  if (t <= 0) return 0;
  const { k, c, m } = typeof p === 'string' ? P[p] : p;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const s = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - s), r2 = -w0 * (z + s);
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

// A value that changes target several times. One spring per change, each
// starting at its own time; motion stays continuous and seekable.
// track(t, 0, [[0.5, 100], [1.2, 40]], 'snappy')
export function track(t, initial, changes, p = P.default) {
  let v = initial, prev = initial;
  for (const [at, to] of changes) {
    v += (to - prev) * spring(t - at, p);
    prev = to;
  }
  return v;
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const progress = (t, a, b) => clamp((t - a) / (b - a));
export const easeOutExpo = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
export const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// Beat grid: beat(n) -> seconds, onBeat(t) -> 0..1 punch envelope after each beat.
export function grid(bpm) {
  const B = 60 / bpm;
  return {
    B,
    beat: (n) => n * B,
    punch: (t, decay = 10) => { const f = ((t % B) + B) % B; return Math.exp(-f * decay); },
  };
}

export function mixHex(a, b, u) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = (s) => Math.round(lerp(ch(pa, s), ch(pb, s), clamp(u)));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// Deterministic hash noise (no Math.random in scenes — renders must repeat exactly).
export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Pre-baked film-grain tile; draw with drawGrain(ctx, t, fps, W, H).
let grainTile = null;
export function drawGrain(ctx, t, fps, W, H, alpha = 0.06) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(hash(i) * 255);
      img.data.set([v, v, v, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
  }
  const f = Math.floor(t * fps);
  const ox = Math.floor(hash(f) * 256), oy = Math.floor(hash(f + 99) * 256);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) ctx.drawImage(grainTile, x, y);
  ctx.restore();
}
