// seekdom: deterministic playback of the pitch deck's declarative motion markup.
// The deck animates with CSS transitions and timers; a film needs every frame to be a pure
// function of t. This reads the same vocabulary (data-at, data-done, data-out, data-type,
// data-count, .a/.kin/.bar/.vbar/.draw/.cursor/.tool/.spark/.shake/.pulse/.swapper) and
// computes each element's style at time t with the brand's closed-form springs.
// Times in markup are milliseconds; data-t0 on any ancestor offsets its subtree.
import { spring } from './motion.js';

export const P = {
  snappy: { k: 320, c: 30, m: 1 }, base: { k: 170, c: 26, m: 1 },
  heavy: { k: 90, c: 20, m: 1 }, playful: { k: 220, c: 14, m: 1 },
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const FROM = {
  fade: [0, 0, 1, 0, P.base], rise: [0, 36, 1, 0, P.base], drop: [0, -36, 1, 0, P.base],
  left: [-56, 0, 1, 0, P.base], right: [56, 0, 1, 0, P.base], pop: [0, 0, 0.82, 0, P.playful],
  scale: [0, 0, 0.94, 0, P.heavy], blur: [0, 14, 1, 10, P.base], snappy: [0, 22, 1, 0, P.snappy],
};

function baseOf(el, root) {
  let ms = 0;
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) if (n.dataset && n.dataset.t0) ms += +n.dataset.t0;
  return ms;
}

export function prepare(root) {
  // kinetic words
  root.querySelectorAll('.kin').forEach((el) => {
    const walk = (node) => [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const wm = document.createElement('span'); wm.className = 'wm';
          const w = document.createElement('span'); w.className = 'w'; w.textContent = part; wm.appendChild(w); frag.appendChild(wm);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
    });
    walk(el);
    const at = +(el.dataset.at || 0), st = +(el.dataset.stagger || 70);
    el._words = [...el.querySelectorAll('.w')].map((w, i) => ({ w, at: at + i * st }));
  });
  root.querySelectorAll('[data-stagger]:not(.kin)').forEach((p) => {
    const at = +(p.dataset.at || 0), st = +p.dataset.stagger;
    [...p.children].forEach((ch, i) => { if (!ch.hasAttribute('data-at')) ch.dataset.at = at + i * st; });
    if (!p.classList.contains('a')) p.removeAttribute('data-at');
  });
  root.querySelectorAll('.draw').forEach((p) => { try { p._len = Math.ceil(p.getTotalLength()) + 1; p.style.strokeDasharray = p._len; } catch (e) {} });
  const all = [...root.querySelectorAll('[data-at],[data-done],[data-out],[data-type],[data-count],.kin,.spark,.spin,.thinking,.tool')];
  for (const el of all) {
    el._b = baseOf(el, root);
    el._at = el.dataset.at !== undefined ? +el.dataset.at + el._b : null;
    el._done = el.dataset.done !== undefined ? +el.dataset.done + el._b : null;
    el._out = el.dataset.out !== undefined ? +el.dataset.out + el._b : null;
    if (el._words) el._words.forEach((o) => { o.at += el._b; });
  }
  // chat threads: scroll targets computed from static layout
  root._threads = [...root.querySelectorAll('.cw__thread')].map((th) => {
    const top = th.getBoundingClientRect().top, sc = th.getBoundingClientRect().height / th.clientHeight || 1;
    const ev = [...th.querySelectorAll('[data-at]')].map((e) => ({ at: e._at, bottom: (e.getBoundingClientRect().bottom - top) / sc })).sort((a, b) => a.at - b.at);
    let maxB = 0; const steps = [];
    for (const e of ev) { maxB = Math.max(maxB, e.bottom); const tg = Math.max(0, maxB + 20 - th.clientHeight); if (!steps.length || tg > steps[steps.length - 1][1] + 1) steps.push([e.at, tg]); }
    return { th, steps };
  });
  root._prepared = true;
  return root;
}

const sp = (t, at, p) => (at == null ? 1 : t < at ? 0 : spring((t - at) / 1000, p));

export function apply(root, tSec) {
  const T = tSec * 1000;
  const tf = new Map();
  const add = (el, s) => tf.set(el, (tf.get(el) || '') + s);
  // .a reveals + outs
  root.querySelectorAll('.a').forEach((el) => {
    const [dx, dy, s0, blur, pr] = FROM[el.dataset.a] || FROM.rise;
    const at = el._at ?? null;
    const s = at === null ? 1 : sp(T, at, pr);
    let o = at === null ? 1 : clamp(s * 1.6);
    const k = Math.min(s, 1.15);
    let x = dx * (1 - k), y = dy * (1 - k), sc = s0 + (1 - s0) * s;
    if (el._out != null && T >= el._out) { const so = clamp(spring((T - el._out) / 1000, P.base)); o *= 1 - clamp(so * 1.3); y -= 20 * so; }
    el.style.opacity = o;
    el.style.filter = blur ? `blur(${(blur * (1 - clamp(s))).toFixed(2)}px)` : '';
    add(el, `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${sc.toFixed(4)})`);
  });
  // kinetic words
  root.querySelectorAll('.kin').forEach((el) => {
    const out = el._out;
    (el._words || []).forEach(({ w, at }, i) => {
      const s = T < at ? 0 : spring((T - at) / 1000, P.snappy);
      let y = (1 - s) * 112, o = clamp(s * 3);
      if (out !== null && T >= out + i * 25) { const so = clamp(spring((T - out - i * 25) / 1000, P.base)); y -= so * 112; }
      w.style.transform = `translateY(${y.toFixed(2)}%)`; w.style.opacity = o;
    });
  });
  // done / gone classes (discrete states) + pressable dip
  root.querySelectorAll('[data-done]').forEach((el) => {
    const d = el._done !== null && T >= el._done;
    el.classList.toggle('done', d);
    if (el.classList.contains('pressable') && d) { const u = (T - el._done) / 1000; add(el, ` scale(${(1 - 0.07 * Math.exp(-u * 9) * Math.min(1, u * 40)).toFixed(4)})`); }
  });
  // tools: spinner → tick
  root.querySelectorAll('.tool').forEach((el) => {
    const spin = el.querySelector('.spin'), tick = el.querySelector('.tick');
    const d = el._done !== null && T >= el._done;
    if (spin) { spin.style.display = d ? 'none' : ''; spin.style.transform = `rotate(${(T * 0.45) % 360}deg)`; }
    if (tick) { const s = d ? spring((T - el._done) / 1000, P.playful) : 0; tick.style.opacity = d ? 1 : 0; tick.style.transform = `scale(${(0.4 + 0.6 * Math.min(s, 1.25)).toFixed(3)})`; }
  });
  root.querySelectorAll('.spin').forEach((el) => { if (!el.closest('.tool')) el.style.transform = `rotate(${(T * 0.45) % 360}deg)`; });
  // Claude spark thinking (stops at data-done)
  root.querySelectorAll('.spark').forEach((el) => {
    const svg = el.querySelector('svg'); if (!svg) return;
    const end = el._done !== null ? el._done : Infinity;
    const tt = Math.max(0, Math.min(T, end) - (el._at || 0)) / 1600;
    const ph = tt % 1, thinking = el.classList.contains('think') && T < end;
    svg.style.transform = `rotate(${(Math.floor(tt) * 180 + ph * 180).toFixed(1)}deg) scale(${thinking ? (1 - 0.18 * Math.sin(Math.PI * ph)).toFixed(3) : 1})`;
  });
  root.querySelectorAll('.thinking').forEach((el) => { el.style.backgroundPosition = `${(100 - ((T / 1600) % 1) * 200).toFixed(1)}% 0`; });
  // typing
  root.querySelectorAll('[data-type]').forEach((el) => {
    const text = el.dataset.text || '', dur = +(el.dataset.dur || Math.max(500, text.length * 28));
    const clr = el.dataset.clear !== undefined ? +el.dataset.clear + el._b : null, ph = el.dataset.ph || '';
    let s = '', caret = false;
    if (el._at !== null && T >= el._at && !(clr !== null && T >= clr)) { const u = clamp((T - el._at) / dur); s = text.slice(0, Math.round(u * text.length)); caret = u < 1 || clr !== null; }
    const key = s + '|' + caret + '|' + (Math.floor(T / 500) % 2);
    if (el._k === key) return; el._k = key;
    el.innerHTML = s ? `${s.replace(/</g, '&lt;')}${caret && (u0(T) || s.length < text.length) ? '<span class="caret"></span>' : ''}` : (ph ? `<span class="ph">${ph}</span>` : '');
  });
  function u0(T) { return Math.floor(T / 500) % 2 === 0; }
  // counters
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, from = +(el.dataset.from || 0), dec = +(el.dataset.dec || 0), dur = +(el.dataset.dur || 900);
    const u = el._at === null ? 1 : clamp((T - el._at) / dur), e = 1 - Math.pow(1 - u, 3);
    const v = from + (to - from) * e;
    el.textContent = el.dataset.sep !== undefined ? Number(v.toFixed(dec)).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  });
  // bars
  root.querySelectorAll('.bar, .vbar').forEach((el) => {
    const v = +(getComputedStyle(el).getPropertyValue('--v') || 1) || 1;
    const s = Math.min(sp(T, el._at, P.base), 1.03) * v;
    el.style.transform = el.classList.contains('vbar') ? `scaleY(${s.toFixed(4)})` : `scaleX(${s.toFixed(4)})`;
  });
  root.querySelectorAll('.draw').forEach((el) => {
    const u = el._at === null ? 1 : clamp((T - el._at) / 1400), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    el.style.strokeDashoffset = (el._len || 1000) * (1 - e); el.style.opacity = el._at !== null && T < el._at ? 0 : 1;
  });
  // cursor
  root.querySelectorAll('.cursor').forEach((el) => {
    const cs = getComputedStyle(el), num = (k) => parseFloat(cs.getPropertyValue(k)) || 0;
    const s = sp(T, el._at, P.heavy);
    const x = num('--x0') + (num('--x1') - num('--x0')) * s, y = num('--y0') + (num('--y1') - num('--y0')) * s;
    const press = el._done !== null && T >= el._done ? 1 - 0.14 * Math.exp(-(T - el._done) / 90) : 1;
    el.style.opacity = el._at === null || T < el._at ? 0 : clamp((T - el._at) / 250);
    el.style.transform = `translate(${x}px,${y}px) scale(${press.toFixed(3)})`;
  });
  // one-off effects
  root.querySelectorAll('.shake').forEach((el) => { if (el._at !== null && T >= el._at) { const u = (T - el._at) / 1000; add(el, ` translateX(${(Math.sin(u * 55) * 8 * Math.exp(-u * 7)).toFixed(2)}px)`); } });
  root.querySelectorAll('.pulse').forEach((el) => {
    if (el._at === null || T < el._at) { el.style.boxShadow = ''; return; }
    const u = ((T - el._at) / 1800) % 1, n = (T - el._at) / 1800;
    el.style.boxShadow = n < 2 ? `0 0 0 ${(26 * u).toFixed(1)}px rgba(217,119,87,${(0.5 * (1 - u)).toFixed(3)})` : '';
  });
  root.querySelectorAll('.swapper').forEach((el) => {
    const s = el._at === null ? 0 : clamp((T - el._at) / 350);
    el.querySelectorAll('.swap-a').forEach((a) => { a.style.opacity = 1 - s; });
    el.querySelectorAll('.swap-b').forEach((b) => { b.style.opacity = s; });
  });
  // caret blink outside typing
  for (const [el, s] of tf) el.style.transform = s;
  // chat thread follow
  (root._threads || []).forEach(({ th, steps }) => {
    let v = 0, prev = 0;
    for (const [at, to] of steps) { v += (to - prev) * (T < at ? 0 : spring((T - at) / 1000, P.base)); prev = to; }
    th.scrollTop = v;
  });
}
