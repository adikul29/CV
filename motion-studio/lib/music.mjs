// Production-grade deterministic music engine: band-limited oscillators, RBJ biquads,
// buses with sidechain pumping, Freeverb and ping-pong delay sends, loudness-safe mixdown.
// Everything is scheduled in seconds against the picture's beat grid.
import { writeFileSync } from 'node:fs';

export function createSong(duration, { sr = 48000, bpm = 120 } = {}) {
  const n = Math.ceil(duration * sr);
  const TAU = Math.PI * 2;
  const beat = 60 / bpm;
  const mk = () => ({ L: new Float32Array(n), R: new Float32Array(n) });
  const bus = { drums: mk(), bass: mk(), music: mk(), sfx: mk(), verb: mk(), delay: mk() };
  const kicks = [];

  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ── DSP building blocks ──────────────────────────────────────────────
  const blep = (p, dt) => {
    if (p < dt) { p /= dt; return p + p - p * p - 1; }
    if (p > 1 - dt) { p = (p - 1) / dt; return p * p + p + p + 1; }
    return 0;
  };
  function saw(f, phase = Math.abs(rnd())) {
    let p = phase; const dt = f / sr;
    return () => { p += dt; if (p >= 1) p -= 1; return 2 * p - 1 - blep(p, dt); };
  }
  function square(f, phase = Math.abs(rnd())) {
    let p = phase; const dt = f / sr;
    return () => {
      p += dt; if (p >= 1) p -= 1;
      let v = p < 0.5 ? 1 : -1; v += blep(p, dt); v -= blep((p + 0.5) % 1, dt); return v;
    };
  }
  function biquad(type, f, q = 0.707) {
    let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const set = (f, q2 = q) => {
      const w = TAU * Math.min(Math.max(f, 20), sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q2);
      if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
      else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
      else { b0 = al; b1 = 0; b2 = -al; }
      const a0 = 1 + al; a1 = -2 * c / a0; a2 = (1 - al) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
    };
    set(f);
    const fn = (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
    fn.set = set; return fn;
  }
  const adsr = (x, len, a, d, s, r) => {
    const att = x < a ? x / a : 1;
    const dec = x < a ? 1 : s + (1 - s) * Math.exp(-(x - a) / Math.max(d, 1e-4));
    const rel = x > len - r ? Math.max(0, (len - x) / r) : 1;
    return att * dec * rel;
  };

  // Render fn(x) (mono or [l, r]) into a bus, with reverb/delay sends.
  function voice(where, t0, len, fn, { gain = 1, pan = 0, verb = 0, delay = 0 } = {}) {
    const a = Math.max(0, Math.round(t0 * sr)), b = Math.min(n, Math.round((t0 + len) * sr));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const B = bus[where];
    for (let i = a; i < b; i++) {
      const v = fn((i - a) / sr);
      let l, r;
      if (typeof v === 'number') { l = v * gl * gain; r = v * gr * gain; } else { l = v[0] * gain; r = v[1] * gain; }
      B.L[i] += l; B.R[i] += r;
      if (verb) { bus.verb.L[i] += l * verb; bus.verb.R[i] += r * verb; }
      if (delay) { bus.delay.L[i] += l * delay; bus.delay.R[i] += r * delay; }
    }
  }

  // ── Drums ────────────────────────────────────────────────────────────
  const D = {
    kick(t, g = 1) {
      kicks.push(t);
      let ph = 0; const hp = biquad('hp', 900);
      voice('drums', t, 0.5, (x) => {
        const f = 48 + 120 * Math.exp(-x * 32);
        ph += TAU * f / sr;
        const body = Math.sin(ph) * Math.exp(-x * 6.5) * Math.min(1, x * 600);
        const click = hp(rnd()) * Math.exp(-x * 380) * 0.5;
        return Math.tanh((body + click) * 1.6);
      }, { gain: g });
    },
    clap(t, g = 0.4, verb = 0.22) {
      const bp = biquad('bp', 1250, 0.9);
      voice('drums', t, 0.35, (x) => {
        let e = 0; for (const o of [0, 0.011, 0.023]) if (x >= o) e += Math.exp(-(x - o) * 190);
        e += Math.exp(-Math.max(0, x - 0.023) * 13) * 0.55 * (x >= 0.023);
        return bp(rnd()) * e * 2.2;
      }, { gain: g, verb });
    },
    snare(t, g = 0.4) {
      const bp = biquad('bp', 2600, 0.7);
      let ph = 0;
      voice('drums', t, 0.3, (x) => {
        ph += TAU * (180 + 40 * Math.exp(-x * 40)) / sr;
        return Math.sin(ph) * Math.exp(-x * 26) * 0.6 + bp(rnd()) * Math.exp(-x * 17) * 1.6;
      }, { gain: g, verb: 0.15 });
    },
    hat(t, g = 0.15, pan = 0.25, open = false) {
      const hp = biquad('hp', open ? 7200 : 8200, 0.8), bp = biquad('bp', 10000, 0.6);
      voice('drums', t, open ? 0.4 : 0.07, (x) => { const v = hp(rnd()); return (v + bp(v)) * Math.exp(-x * (open ? 8 : 60)); }, { gain: g, pan, verb: open ? 0.08 : 0 });
    },
    shaker(t, g = 0.06, pan = -0.35) {
      const bp = biquad('bp', 6500, 1.4);
      voice('drums', t, 0.09, (x) => bp(rnd()) * Math.min(1, x / 0.012) * Math.exp(-x * 34) * 1.8, { gain: g, pan });
    },
    crash(t, g = 0.3) {
      const hp = biquad('hp', 4200, 0.6);
      const parts = [3.02, 4.17, 5.43, 6.79, 8.21].map((r) => square(340 * r));
      voice('drums', t, 2.8, (x) => {
        let m = 0; for (const p of parts) m += p();
        return hp(rnd() * 0.9 + m * 0.08) * Math.exp(-x * 1.5) * Math.min(1, x * 300);
      }, { gain: g, verb: 0.3 });
    },
  };

  // ── Tonal instruments ────────────────────────────────────────────────
  const I = {
    bass(t, m, len = 0.22, g = 0.4) {
      const f = hz(m), sw = saw(f), lp = biquad('lp', 420, 0.9);
      let ph = 0;
      voice('bass', t, len + 0.04, (x) => {
        ph += TAU * f / sr;
        const env = adsr(x, len + 0.04, 0.004, 0.18, 0.75, 0.04);
        return Math.tanh((Math.sin(ph) * 0.9 + lp(sw()) * 0.55) * 1.4) * env;
      }, { gain: g });
    },
    pad(t, notes, len, g = 0.05, { cut = 1600, cutEnd = cut, verb = 0.4, att = 0.5 } = {}) {
      notes.forEach((m, k) => {
        const f = hz(m);
        const oscs = [-11, -4, 4, 11].map((c) => saw(f * Math.pow(2, c / 1200)));
        const lpL = biquad('lp', cut, 0.8), lpR = biquad('lp', cut, 0.8);
        let c = 0;
        voice('music', t, len, (x) => {
          if ((c++ & 31) === 0) { const fc = cut * Math.pow(cutEnd / cut, Math.min(1, x / len)); lpL.set(fc); lpR.set(fc); }
          const env = adsr(x, len, att, 1.2, 0.85, Math.min(0.9, len * 0.4));
          const l = oscs[0]() + oscs[1]() * 0.8, r = oscs[2]() * 0.8 + oscs[3]();
          return [lpL(l) * env, lpR(r) * env];
        }, { gain: g / Math.sqrt(notes.length), verb, pan: 0 });
      });
    },
    stab(t, notes, g = 0.05, { cut = 2600, len = 0.32 } = {}) {
      notes.forEach((m, k) => {
        const f = hz(m), a = saw(f * 1.004), b = saw(f * 0.996), lp = biquad('lp', cut, 1.1);
        let c = 0;
        voice('music', t, len, (x) => {
          if ((c++ & 15) === 0) lp.set(cut * (0.45 + 1.6 * Math.exp(-x * 14)));
          return lp(a() + b()) * adsr(x, len, 0.003, 0.12, 0.3, 0.06);
        }, { gain: g / Math.sqrt(notes.length), pan: (k / Math.max(1, notes.length - 1) - 0.5) * 0.6, verb: 0.25 });
      });
    },
    pluck(t, m, g = 0.1, pan = 0, { delay = 0.28, verb = 0.22 } = {}) {
      const f = hz(m), a = saw(f), b = square(f * 0.5), lp = biquad('lp', 4000, 1.2);
      let c = 0;
      voice('music', t, 0.6, (x) => {
        if ((c++ & 15) === 0) lp.set(500 + 4200 * Math.exp(-x * 16));
        return lp(a() + b() * 0.4) * Math.exp(-x * 6.5) * Math.min(1, x * 400);
      }, { gain: g, pan, delay, verb });
    },
    bell(t, m, g = 0.12, pan = 0, { len = 1.6, delay = 0.22, verb = 0.3 } = {}) {
      const f = hz(m);
      voice('music', t, len, (x) => {
        const idx = 1.8 * Math.exp(-x * 5) + 0.25;
        return Math.sin(TAU * f * x + idx * Math.sin(TAU * f * 3.5 * x)) * Math.exp(-x * 3.2) * Math.min(1, x * 500)
          + Math.sin(TAU * f * 2 * x) * Math.exp(-x * 6) * 0.25;
      }, { gain: g, pan, delay, verb });
    },
  };

  // ── FX + UI sound design ─────────────────────────────────────────────
  const FX = {
    riser(t0, t1, g = 0.2) {
      const len = t1 - t0, bp = biquad('bp', 300, 1.3), sw = saw(110);
      let c = 0, ph = 0;
      voice('sfx', t0, len, (x) => {
        const u = x / len;
        if ((c++ & 15) === 0) bp.set(300 * Math.pow(30, u), 1.3);
        ph += TAU * (110 + 700 * u * u) / sr;
        return (bp(rnd()) * 1.5 + Math.sin(ph) * 0.12) * u * u;
      }, { gain: g, verb: 0.35 });
    },
    reverse(tEnd, len = 1, g = 0.18) {
      const hp = biquad('hp', 3000, 0.7);
      voice('sfx', tEnd - len, len, (x) => hp(rnd()) * Math.pow(x / len, 3), { gain: g, verb: 0.2 });
    },
    impact(t, g = 0.5) {
      const lp = biquad('lp', 900, 0.8);
      let ph = 0;
      voice('sfx', t, 2.2, (x) => {
        ph += TAU * (34 + 30 * Math.exp(-x * 6)) / sr;
        return Math.sin(ph) * Math.exp(-x * 2.4) + lp(rnd()) * Math.exp(-x * 11) * 0.7;
      }, { gain: g, verb: 0.35 });
    },
    whoosh(t, len = 0.5, g = 0.15, panFrom = -0.6, panTo = 0.6) {
      const bp = biquad('bp', 500, 1.1);
      let c = 0;
      voice('sfx', t, len, (x) => {
        const u = x / len;
        if ((c++ & 15) === 0) bp.set(400 + 4200 * Math.sin(Math.PI * u), 1.1);
        const v = bp(rnd()) * Math.sin(Math.PI * u) * 2;
        const p = panFrom + (panTo - panFrom) * u;
        return [v * Math.cos((p + 1) * Math.PI / 4), v * Math.sin((p + 1) * Math.PI / 4)];
      }, { gain: g, verb: 0.15 });
    },
    tick(t, g = 0.08, pan = 0) {
      voice('sfx', t, 0.06, (x) => (Math.sin(TAU * 2700 * x) + Math.sin(TAU * 4100 * x) * 0.4) * Math.exp(-x * 95), { gain: g, pan, verb: 0.08 });
    },
    pop(t, m = 79, g = 0.12, pan = 0) {
      const f = hz(m); let ph = 0;
      voice('sfx', t, 0.14, (x) => { ph += TAU * f * (1 + 0.7 * Math.exp(-x * 90)) / sr; return Math.sin(ph) * Math.exp(-x * 30); }, { gain: g, pan, verb: 0.12 });
    },
    key(t, g = 0.035, pan = 0.1) {
      const bp = biquad('bp', 3200 + 900 * Math.abs(rnd()), 2.2);
      voice('sfx', t, 0.03, (x) => bp(rnd()) * Math.exp(-x * 320) * 3, { gain: g, pan });
    },
    click(t, g = 0.16) {
      const hp = biquad('hp', 1800, 0.8);
      voice('sfx', t, 0.05, (x) => hp(rnd()) * Math.exp(-x * 420) + Math.sin(TAU * 1300 * x) * Math.exp(-x * 140) * 0.6, { gain: g });
    },
    thud(t, g = 0.35) {
      let ph = 0;
      voice('sfx', t, 0.35, (x) => { ph += TAU * (55 + 60 * Math.exp(-x * 30)) / sr; return Math.sin(ph) * Math.exp(-x * 14); }, { gain: g });
    },
    uhoh(t, g = 0.1) {
      [[0, 71], [0.12, 66]].forEach(([o, m]) => {
        const s = square(hz(m)), lp = biquad('lp', 1600, 0.9);
        voice('sfx', t + o, 0.16, (x) => lp(s()) * adsr(x, 0.16, 0.004, 0.08, 0.5, 0.04), { gain: g, verb: 0.2 });
      });
    },
  };

  // ── Mixdown ──────────────────────────────────────────────────────────
  function freeverb(inL, inR, { room = 0.82, damp = 0.32 } = {}) {
    const sc = sr / 44100;
    const comb = (len) => { const b = new Float32Array(len); let i = 0, st = 0; return (x) => { const y = b[i]; st = y * (1 - damp) + st * damp; b[i] = x + st * room; i = ++i % len; return y; }; };
    const ap = (len) => { const b = new Float32Array(len); let i = 0; return (x) => { const bo = b[i]; b[i] = x + bo * 0.5; i = ++i % len; return bo - x; }; };
    const CT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], AT = [556, 441, 341, 225];
    const cl = CT.map((l) => comb(Math.round(l * sc))), cr = CT.map((l) => comb(Math.round((l + 23) * sc)));
    const al = AT.map((l) => ap(Math.round(l * sc))), ar = AT.map((l) => ap(Math.round((l + 23) * sc)));
    const pre = biquad('hp', 250), oL = new Float32Array(n), oR = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pre((inL[i] + inR[i]) * 0.5) * 0.03;
      let l = 0, r = 0;
      for (const c of cl) l += c(x);
      for (const c of cr) r += c(x);
      for (const a of al) l = a(l);
      for (const a of ar) r = a(r);
      oL[i] = l; oR[i] = r;
    }
    return [oL, oR];
  }
  function pingpong(inL, inR, time, fb = 0.38) {
    const d = Math.round(time * sr), bL = new Float32Array(d), bR = new Float32Array(d);
    const lpL = biquad('lp', 3200), lpR = biquad('lp', 3200);
    const oL = new Float32Array(n), oR = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const yl = bL[j], yr = bR[j];
      bL[j] = (inL[i] + inR[i]) * 0.5 + lpR(yr) * fb;
      bR[j] = lpL(yl) * fb;
      oL[i] = yl; oR[i] = yr; j = ++j % d;
    }
    return [oL, oR];
  }
  function duckCurve(depth, release = 0.11) {
    const g = new Float32Array(n), ks = [...kicks].sort((a, b) => a - b);
    let k = -1;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      while (k + 1 < ks.length && ks[k + 1] <= t) k++;
      if (k < 0) { g[i] = 1; continue; }
      const x = t - ks[k];
      g[i] = 1 - depth * Math.exp(-x / release) * Math.min(1, x / 0.004 + 0.2);
    }
    return g;
  }

  function mixdown(path, { musicDuck = 0.6, bassDuck = 0.45, verbWet = 1.0, delayWet = 0.55 } = {}) {
    const [vL, vR] = freeverb(bus.verb.L, bus.verb.R);
    const [dL, dR] = pingpong(bus.delay.L, bus.delay.R, beat * 0.75);
    const gm = duckCurve(musicDuck), gb = duckCurve(bassDuck), gv = duckCurve(0.35, 0.2);
    const hp = [biquad('hp', 28), biquad('hp', 28)];
    const L = new Float32Array(n), R = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      let l = bus.drums.L[i] + bus.bass.L[i] * gb[i] + bus.music.L[i] * gm[i] + bus.sfx.L[i] + vL[i] * verbWet * gv[i] + dL[i] * delayWet * gm[i];
      let r = bus.drums.R[i] + bus.bass.R[i] * gb[i] + bus.music.R[i] * gm[i] + bus.sfx.R[i] + vR[i] * verbWet * gv[i] + dR[i] * delayWet * gm[i];
      l = Math.tanh(hp[0](l) * 0.9); r = Math.tanh(hp[1](r) * 0.9);
      L[i] = l; R[i] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
    }
    const norm = 0.89 / (peak || 1), fade = Math.round(sr * 0.003);
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      const e = Math.min(1, i / fade, (n - 1 - i) / fade) * norm;
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * e)) * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * e)) * 32767), 46 + i * 4);
    }
    writeFileSync(path, buf);
  }

  return { sr, beat, hz, rnd, voice, ...D, ...I, ...FX, mixdown };
}
