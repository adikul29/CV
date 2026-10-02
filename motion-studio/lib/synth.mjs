// Tiny deterministic synth. Sound is composed on the same timeline as the
// picture: pass seconds, not samples, and lock cues to the beat grid.
import { writeFileSync } from 'node:fs';

export function createMix(duration, sr = 48000) {
  const n = Math.ceil(duration * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  let seed = 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

  // Render fn(tt) for `len` seconds starting at t0, with constant-power pan.
  function add(t0, len, fn, { gain = 1, pan = 0 } = {}) {
    const a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(n, Math.floor((t0 + len) * sr));
    const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = a; i < b; i++) {
      const s = fn(i / sr - t0);
      L[i] += s * gl; R[i] += s * gr;
    }
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const TAU = Math.PI * 2;

  const api = {
    sr, L, R, add, hz,
    kick(t, g = 0.9) {
      add(t, 0.5, (x) => Math.sin(TAU * (45 * x + (105 / 30) * (1 - Math.exp(-30 * x)))) * Math.exp(-6 * x), { gain: g });
    },
    hat(t, g = 0.18, pan = 0.3) {
      let prev = 0;
      add(t, 0.08, (x) => { const r = rnd(); const hp = r - prev; prev = r; return hp * Math.exp(-70 * x); }, { gain: g, pan });
    },
    clap(t, g = 0.35) {
      add(t, 0.25, (x) => {
        const env = [0, 0.012, 0.024].reduce((s, o) => s + (x >= o ? Math.exp(-(x - o) * 120) : 0), 0) + Math.exp(-x * 18) * 0.5;
        return rnd() * env * 0.6;
      }, { gain: g });
    },
    bass(t, midi, len = 0.45, g = 0.32) {
      const f = hz(midi);
      add(t, len, (x) => {
        let s = 0;
        for (let h = 1; h <= 6; h++) s += Math.sin(TAU * f * h * x) / h;
        return s * Math.min(1, x * 200) * Math.exp(-x * 3) * Math.min(1, (len - x) * 40);
      }, { gain: g });
    },
    pad(t, midis, len, g = 0.06) {
      midis.forEach((m, i) => [-0.08, 0.08].forEach((d, j) => {
        const f = hz(m) * (1 + d / 100);
        add(t, len, (x) => Math.sin(TAU * f * x) * Math.min(1, x / 1.2) * Math.min(1, (len - x) / 0.8), { gain: g, pan: j ? 0.5 : -0.5 });
      }));
    },
    riser(t0, t1, g = 0.25) {
      const len = t1 - t0;
      add(t0, len, (x) => {
        const u = x / len;
        return (rnd() * 0.5 + Math.sin(TAU * (200 * x + 600 * x * u))) * u * u * 0.5;
      }, { gain: g });
    },
    impact(t, g = 0.6) {
      add(t, 1.6, (x) => Math.sin(TAU * 48 * x) * Math.exp(-2.5 * x) + rnd() * Math.exp(-25 * x) * 0.6, { gain: g });
    },
    whoosh(t, len = 0.5, g = 0.25) {
      let lp = 0;
      add(t, len, (x) => { lp += (rnd() - lp) * (0.02 + 0.3 * x / len); return lp * Math.sin(Math.PI * x / len) * 3; }, { gain: g });
    },
    blip(t, midi, g = 0.18, pan = 0) {
      const f = hz(midi);
      add(t, 0.15, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 30), { gain: g, pan });
      add(t + 0.18, 0.15, (x) => Math.sin(TAU * f * x) * Math.exp(-x * 30), { gain: g * 0.35, pan: -pan });
    },
    bell(t, midi, g = 0.2) {
      const f = hz(midi);
      add(t, 3, (x) => [1, 2.76, 5.4].reduce((s, r, i) => s + Math.sin(TAU * f * r * x) * Math.exp(-x * (1.2 + i * 1.5)) / (i + 1), 0), { gain: g });
    },
    // Soft-clip, normalize to -1 dBFS, 2 ms fade edges, write 16-bit WAV.
    write(path) {
      let peak = 0;
      for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i]); R[i] = Math.tanh(R[i]); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
      const norm = peak ? 0.89 / peak : 1, fade = Math.floor(sr * 0.002);
      const buf = Buffer.alloc(44 + n * 4);
      buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
      buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
      buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
      buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
      for (let i = 0; i < n; i++) {
        const e = Math.min(1, i / fade, (n - 1 - i) / fade) * norm;
        buf.writeInt16LE(Math.round(L[i] * e * 32767), 44 + i * 4);
        buf.writeInt16LE(Math.round(R[i] * e * 32767), 46 + i * 4);
      }
      writeFileSync(path, buf);
    },
  };
  return api;
}
