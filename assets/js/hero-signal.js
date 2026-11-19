/*
 * alpaion hero, variant C: "Rohdaten → Signal → Prognose"
 * Dozens of noisy series condense into one clear signal (trend + seasonality),
 * which is then projected forward as a forecast with a range: the basis for a decision.
 */
import { STRINGS, makeUI, makeSteps, freshCanvas, runLoop, cssVar, rng, clamp01, easeInOut, easeOut, contentBox } from "./hero-ui.js";

const TODAY = 0.64;
const M = 96;
const T_SIGNAL = 2.2, T_FORECAST = 4.8, T_END = 7.4;

const base = (t) => 0.27 + 0.36 * t + 0.065 * Math.sin(2 * Math.PI * 3.1 * t + 0.6);
const trend = (t) => 0.27 + 0.36 * t;
const halfBand = (t) => 0.012 + 0.12 * Math.pow(Math.max(0, (t - TODAY) / (1 - TODAY)), 1.15);
const PEAK_A = (Math.PI / 2 - 0.6) / (2 * Math.PI * 3.1);
const PEAK_B = PEAK_A + 1 / 3.1;

export function mount(stage, { lang, reduceMotion, startTime }) {
  const S = STRINGS[lang].signal;
  const canvas = freshCanvas(stage, S.aria);
  const ctx = canvas.getContext("2d");
  const box = stage.querySelector(".hero-canvas");
  const ui = makeUI(stage);
  const col = {
    ink: cssVar("--ink", "#1D2025"), granite: cssVar("--granite", "#4A5059"), stone: cssVar("--stone", "#868C94"),
    line: cssVar("--line", "#DCDFE3"), red: cssVar("--red", "#DA291C"), redDeep: cssVar("--red-deep", "#B01F12"),
    paper: cssVar("--paper", "#FFFFFF"),
  };
  let elapsed = reduceMotion ? 99 : startTime || 0;
  let loop = null;
  const steps = makeSteps(ui.inner, S.steps, STRINGS[lang].replay, () => {
    elapsed = 0;
    steps.finished(false);
    if (loop) loop.start();
  });

  /* noisy raw series around the hidden signal */
  const rand = rng(99);
  const N = 26;
  const series = [];
  for (let j = 0; j < N; j++) {
    const off = (rand() - 0.5) * 0.22;
    let w = (rand() - 0.5) * 0.08;
    const vals = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      w = w * 0.9 + (rand() - 0.5) * 0.07;
      const spike = rand() < 0.025 ? (rand() - 0.5) * 0.28 : 0;
      vals[i] = off + w + spike;
    }
    series.push({ vals, delay: rand() * 0.45 });
  }
  const tAt = (i) => (i / (M - 1)) * TODAY;

  let W = 1, H = 1, L = 0, R = 1, T = 0, B = 1, small = false;
  const X = (t) => L + t * (R - L);
  const Y = (v) => B - ((v - 0.1) / 0.78) * (B - T);

  const resize = () => {
    const r = box.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cb = contentBox(stage);
    small = W < 640;
    L = cb.left; R = cb.right; T = 34; B = H - 22;
    draw();
  };

  const font = (w, s) => `${w} ${s}px Archivo, "Helvetica Neue", Arial, sans-serif`;

  const draw = () => {
    const e = elapsed;
    const rev = easeOut(clamp01(e / 1.8));
    const conv = clamp01((e - T_SIGNAL) / 1.8);
    const sig = easeInOut(clamp01((e - 2.6) / 1.6));
    const ann = clamp01((e - 3.9) / 0.6);
    const fc = easeInOut(clamp01((e - T_FORECAST) / 1.8));
    const dec = clamp01((e - 6.6) / 0.5);
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = Math.round(B - (k / 4) * (B - T)) + 0.5;
      ctx.globalAlpha = k === 0 ? 1 : 0.55;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // raw series
    const lastI = Math.max(1, Math.round(rev * (M - 1)));
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.stone;
    for (const s of series) {
      const c = easeInOut(clamp01(conv * 1.45 - s.delay));
      ctx.globalAlpha = 0.34 - 0.24 * c;
      ctx.beginPath();
      for (let i = 0; i <= lastI; i++) {
        const t = tAt(i);
        const v = base(t) + s.vals[i] * (1 - c);
        const x = X(t), y = Y(v);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // signal
    if (sig > 0) {
      ctx.strokeStyle = col.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const end = sig * TODAY;
      for (let k = 0; k <= 160; k++) {
        const t = (k / 160) * end;
        k ? ctx.lineTo(X(t), Y(base(t))) : ctx.moveTo(X(t), Y(base(t)));
      }
      ctx.stroke();
    }

    // annotations: trend + seasonality
    if (ann > 0) {
      ctx.globalAlpha = ann;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = col.granite;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(0.02), Y(trend(0.02))); ctx.lineTo(X(TODAY), Y(trend(TODAY))); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(600, small ? 12 : 13);
      ctx.fillStyle = col.granite;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText(S.trend, X(0.03), Y(trend(0.03)) + 22);
      const yb = Y(base(PEAK_A) + 0.08);
      ctx.strokeStyle = col.granite;
      ctx.beginPath();
      ctx.moveTo(X(PEAK_A), yb + 6); ctx.lineTo(X(PEAK_A), yb); ctx.lineTo(X(PEAK_B), yb); ctx.lineTo(X(PEAK_B), yb + 6);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(S.season, X((PEAK_A + PEAK_B) / 2), yb - 8);
      ctx.globalAlpha = 1;
    }

    // today + forecast
    if (fc > 0) {
      const xT = Math.round(X(TODAY)) + 0.5;
      ctx.globalAlpha = Math.min(1, fc * 3);
      ctx.strokeStyle = col.stone;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(xT, T - 10); ctx.lineTo(xT, B); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(600, 13);
      ctx.fillStyle = col.ink;
      ctx.textAlign = "left";
      ctx.fillText(S.today, xT + 8, T - 2);
      ctx.globalAlpha = 1;

      const end = TODAY + fc * (1 - TODAY);
      const K = 80;
      ctx.beginPath();
      for (let k = 0; k <= K; k++) {
        const t = TODAY + (k / K) * (end - TODAY);
        const y = Y(base(t) + halfBand(t));
        k ? ctx.lineTo(X(t), y) : ctx.moveTo(X(t), y);
      }
      for (let k = K; k >= 0; k--) {
        const t = TODAY + (k / K) * (end - TODAY);
        ctx.lineTo(X(t), Y(base(t) - halfBand(t)));
      }
      ctx.closePath();
      ctx.fillStyle = col.red;
      ctx.globalAlpha = 0.1;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = col.red;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k <= K; k++) {
        const t = TODAY + (k / K) * (end - TODAY);
        k ? ctx.lineTo(X(t), Y(base(t))) : ctx.moveTo(X(t), Y(base(t)));
      }
      ctx.stroke();

      if (fc >= 1 && !small) {
        ctx.font = font(500, 12.5);
        ctx.fillStyle = col.redDeep;
        ctx.textAlign = "right";
        const tb = 0.95;
        ctx.fillText(S.band, X(tb), Y(base(tb) - halfBand(tb)) + 18);
      }
    }

    // decision marker
    if (dec > 0) {
      const x = X(1), y = Y(base(1));
      ctx.globalAlpha = dec;
      ctx.fillStyle = col.red;
      ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.font = font(650, small ? 12.5 : 14);
      ctx.fillStyle = col.ink;
      ctx.textAlign = "right";
      if (small) {
        // narrow screens: label sits in the free space under the band, tied to the marker by a leader line
        ctx.strokeStyle = col.red;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x - 0.5, y + 8); ctx.lineTo(x - 0.5, B - 30); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(S.decision, x - 2, B - 12);
      } else ctx.fillText(S.decision, x - 2, Y(base(1) + halfBand(1)) - 12);
      ctx.globalAlpha = 1;
    }

    steps.set(e < T_SIGNAL ? 0 : e < T_FORECAST ? 1 : 2);
    steps.finished(!reduceMotion && e > T_END);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();
  if (document.fonts && document.fonts.load) document.fonts.load('600 13px "Archivo"').then(draw, () => {});
  if (!reduceMotion) {
    loop = runLoop(box, (dt) => {
      if (elapsed > T_END + 0.5) return;
      elapsed += dt;
      draw();
    });
  }

  return {
    destroy() {
      if (loop) loop.destroy();
      ro.disconnect();
      ui.destroy();
    },
  };
}
