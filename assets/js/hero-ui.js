/* alpaion — shared helpers and copy for the hero animations */

export const STRINGS = {
  de: {
    replay: "Erneut abspielen",
    summit: {
      steps: ["Datenchaos", "Struktur", "Klare Entscheidung"],
      peak: "Klare Entscheidung",
      aria: "Animation: Verstreute Datenpunkte ordnen sich zu Säulen und formen ein Bergmassiv. Rote Wege führen auf den Gipfel, die klare Entscheidung.",
    },
    flow: {
      modes: ["Heute", "Mit Alpaion"],
      group: "Prozessansicht wählen",
      before: { in: "Eingang", cap: "Manuelle Erfassung", chk: "Prüfung", rw: "Rückfrage", app: "Freigabe", erp: "Übertrag ins ERP", done: "Abschluss" },
      after: { in: "Eingang", cap: "KI-Erfassung und Prüfung", chk: "", rw: "", app: "Freigabe bei Ausnahmen", erp: "Automatische Buchung", done: "Abschluss" },
      kpis: ["Durchlaufzeit", "Manuelle Schritte", "Wartende Fälle"],
      note: "Beispielhafte Simulation eines Belegprozesses",
      aria: "Animation: Belege durchlaufen einen Prozess. Heute stauen sie sich an manuellen Schritten, mit Alpaion fliessen sie automatisiert und schnell durch.",
    },
    signal: {
      steps: ["Rohdaten", "Signal", "Prognose"],
      today: "Heute",
      trend: "Trend",
      season: "Saisonalität",
      band: "Prognosekorridor",
      decision: "Entscheidungsgrundlage",
      aria: "Animation: Viele verrauschte Datenreihen verdichten sich zu einem klaren Signal mit Trend und Saisonalität, daraus entsteht eine Prognose mit Korridor.",
    },
  },
  en: {
    replay: "Play again",
    summit: {
      steps: ["Data chaos", "Structure", "Clear decision"],
      peak: "Clear decision",
      aria: "Animation: scattered data points arrange themselves into columns and form a mountain range. Red routes lead to the summit, the clear decision.",
    },
    flow: {
      modes: ["Today", "With Alpaion"],
      group: "Choose process view",
      before: { in: "Intake", cap: "Manual capture", chk: "Review", rw: "Query", app: "Approval", erp: "Entry into ERP", done: "Completion" },
      after: { in: "Intake", cap: "AI capture and review", chk: "", rw: "", app: "Approval of exceptions", erp: "Automatic posting", done: "Completion" },
      kpis: ["Lead time", "Manual steps", "Cases waiting"],
      note: "Illustrative simulation of a document process",
      aria: "Animation: documents pass through a process. Today they pile up at manual steps; with Alpaion they flow through quickly and automatically.",
    },
    signal: {
      steps: ["Raw data", "Signal", "Forecast"],
      today: "Today",
      trend: "Trend",
      season: "Seasonality",
      band: "Forecast range",
      decision: "Basis for decision",
      aria: "Animation: many noisy data series condense into a clear signal with trend and seasonality, which then becomes a forecast with a range.",
    },
  },
};

const REPLAY_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';

export function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Replace the stage canvas with a fresh element (a canvas can only ever hold one context type). */
export function freshCanvas(stage, aria) {
  const box = stage.querySelector(".hero-canvas");
  const c = document.createElement("canvas");
  c.setAttribute("role", "img");
  c.setAttribute("aria-label", aria);
  const old = box.querySelector("canvas");
  if (old) old.replaceWith(c);
  else box.appendChild(c);
  return c;
}

export function makeUI(stage) {
  const root = document.createElement("div");
  root.className = "stage-ui";
  const inner = document.createElement("div");
  inner.className = "wrap stage-ui-inner";
  root.appendChild(inner);
  stage.appendChild(root);
  return { root, inner, destroy: () => root.remove() };
}

/** Left/right edges of the page's content column, relative to the stage, so drawings align with the text. */
export function contentBox(stage) {
  const ref = stage.querySelector(".stage-ui-inner") || stage;
  const r = ref.getBoundingClientRect();
  const s = stage.querySelector(".hero-canvas").getBoundingClientRect();
  const cs = getComputedStyle(ref);
  const left = r.left - s.left + parseFloat(cs.paddingLeft || 0);
  const right = r.right - s.left - parseFloat(cs.paddingRight || 0);
  return { left, right, width: right - left };
}

export function makeSteps(container, labels, replayLabel, onReplay) {
  const ol = document.createElement("ol");
  ol.className = "stage-steps";
  labels.forEach((text) => {
    const li = document.createElement("li");
    li.className = "stage-step";
    const mk = document.createElement("span");
    mk.className = "mk";
    mk.setAttribute("aria-hidden", "true");
    const tx = document.createElement("span");
    tx.textContent = text;
    li.append(mk, tx);
    ol.appendChild(li);
  });
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "stage-replay";
  btn.innerHTML = REPLAY_ICON;
  const bt = document.createElement("span");
  bt.textContent = replayLabel;
  btn.appendChild(bt);
  btn.hidden = true;
  btn.addEventListener("click", onReplay);
  container.append(ol, btn);
  let cur = -1;
  return {
    set(i) {
      if (i === cur) return;
      cur = i;
      Array.from(ol.children).forEach((li, k) => {
        li.classList.toggle("is-active", k === i);
        li.classList.toggle("is-done", k < i);
        if (k === i) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
    },
    finished(show) { btn.hidden = !show; },
  };
}

/** requestAnimationFrame loop that pauses off-screen and in background tabs. */
export function runLoop(target, frame) {
  let raf = 0, running = false, visible = true, last = performance.now();
  const tick = (now) => {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    if (running) raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    visible ? start() : stop();
  }, { threshold: 0.01 });
  io.observe(target);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);
  start();
  return {
    start,
    stop,
    destroy() {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    },
  };
}

/** Deterministic random numbers so every visitor sees the same composition. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
