/*
 * alpaion hero, variant B: "Heute vs. mit Alpaion"
 * A live queueing simulation of a document process. Today, cases pile up at manual steps and
 * loop back for queries. With Alpaion, capture and review are automated; only exceptions need a person.
 */
import { STRINGS, makeUI, freshCanvas, runLoop, cssVar, rng, clamp01, easeInOut, wrapText, contentBox } from "./hero-ui.js";

const IDS = ["in", "cap", "chk", "rw", "app", "erp", "done"];
const LAYOUT = [
  { in: [0, 0], cap: [0.19, 0], chk: [0.38, 0], rw: [0.285, 1], app: [0.58, 0], erp: [0.78, 0], done: [1, 0] },
  { in: [0, 0], cap: [0.32, 0], chk: [0.32, 0], rw: [0.32, 0], app: [0.55, 1], erp: [0.74, 0], done: [1, 0] },
];
const VISIBLE = [
  { in: 1, cap: 1, chk: 1, rw: 1, app: 1, erp: 1, done: 1 },
  { in: 1, cap: 1, chk: 0, rw: 0, app: 1, erp: 1, done: 1 },
];
const KIND = [
  { in: "end", cap: "manual", chk: "manual", rw: "manual", app: "manual", erp: "manual", done: "end" },
  { in: "end", cap: "auto", chk: "auto", rw: "auto", app: "manual", erp: "auto", done: "end" },
];
const EDGES = [
  [["in", "cap"], ["cap", "chk"], ["chk", "app"], ["app", "erp"], ["erp", "done"], ["chk", "rw", 1], ["rw", "cap", 1]],
  [["in", "cap"], ["cap", "erp"], ["erp", "done"], ["cap", "app", 1], ["app", "erp", 1]],
];
/* mean service time (s), parallel workers */
const SERVICE = [
  { in: [0.05, 99], cap: [1.25, 2], chk: [0.95, 2], rw: [1.6, 99], app: [1.3, 2], erp: [0.52, 1], done: [0, 99] },
  { in: [0.05, 99], cap: [0.22, 6], chk: [0.22, 6], rw: [0.22, 6], app: [0.9, 2], erp: [0.12, 4], done: [0, 99] },
];
const NEXT = [
  { in: () => "cap", cap: () => "chk", chk: (r) => (r < 0.22 ? "rw" : "app"), rw: () => "cap", app: () => "erp", erp: () => "done" },
  { in: () => "cap", cap: (r) => (r < 0.1 ? "app" : "erp"), chk: () => "erp", rw: () => "erp", app: () => "erp", erp: () => "done" },
];
const PRED = [
  { cap: "in", chk: "cap", rw: "chk", app: "chk", erp: "app", done: "erp", in: "in" },
  { cap: "in", chk: "in", rw: "in", app: "cap", erp: "cap", done: "erp", in: "in" },
];
const MERGE = { chk: "cap", rw: "cap" };
const MANUAL_STEPS = [5, 1];
const SPEED = [0.17, 0.62];
const ARRIVAL = 0.46;
const LEAD_EST = [12, 2.4];
const AUTO_SWITCH = 12.5;
const PREWARM = 7;

export function mount(stage, { lang, reduceMotion, startTime }) {
  const S = STRINGS[lang].flow;
  const canvas = freshCanvas(stage, S.aria);
  const ctx = canvas.getContext("2d");
  const box = stage.querySelector(".hero-canvas");
  const ui = makeUI(stage);
  const col = {
    ink: cssVar("--ink", "#1D2025"), granite: cssVar("--granite", "#4A5059"), stone: cssVar("--stone", "#868C94"),
    line: cssVar("--line", "#DCDFE3"), red: cssVar("--red", "#DA291C"), paper: cssVar("--paper", "#FFFFFF"),
  };

  /* ---------- controls ---------- */
  const seg = document.createElement("div");
  seg.className = "stage-toggle";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", S.group);
  const btns = S.modes.map((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m;
    b.addEventListener("click", () => { touched = true; setMode(i); });
    seg.appendChild(b);
    return b;
  });
  const kpis = document.createElement("dl");
  kpis.className = "stage-kpis";
  const kpiEls = S.kpis.map((name, i) => {
    const wrap = document.createElement("div");
    wrap.className = "kpi";
    const dt = document.createElement("dt");
    dt.textContent = name;
    const dd = document.createElement("dd");
    const bar = document.createElement("span");
    bar.className = "kbar";
    const fill = document.createElement("i");
    bar.appendChild(fill);
    dd.appendChild(bar);
    let val = null;
    if (i > 0) { val = document.createElement("span"); val.className = "kval"; dd.appendChild(val); }
    wrap.append(dt, dd);
    kpis.appendChild(wrap);
    return { fill, val };
  });
  const note = document.createElement("p");
  note.className = "stage-note";
  note.textContent = S.note;
  ui.inner.append(seg, kpis, note);

  /* ---------- simulation ---------- */
  const rand = rng(1234);
  let mode = 0, morph = 0, touched = false, simTime = 0, nextArrival = 0, seq = 0;
  let tokens = [];
  const busy = {}, queues = {};
  const lead = [[], []];
  let leadShown = LEAD_EST[0];

  const lerp = (a, b, t) => a + (b - a) * t;
  const posOf = (id) => {
    const k = easeInOut(morph);
    const a = LAYOUT[0][id], b = LAYOUT[1][id];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  };
  const dist = (a, b) => {
    const p = posOf(a), q = posOf(b);
    return Math.max(0.05, Math.hypot(p[0] - q[0], (p[1] - q[1]) * 0.35));
  };

  const reset = () => {
    tokens = [];
    IDS.forEach((id) => { busy[id] = 0; queues[id] = []; });
    simTime = 0; nextArrival = 0;
    lead[0] = []; lead[1] = [];
  };

  const startService = (t, node) => {
    busy[node]++;
    t.state = "service"; t.node = node;
    t.left = SERVICE[mode][node][0] * (0.5 + rand());
  };
  const arrive = (t, node) => {
    if (MERGE[node] && mode === 1) node = MERGE[node];
    if (node === "done") {
      t.state = "exit"; t.node = "done"; t.fade = 0;
      const arr = lead[t.mode];
      arr.push(simTime - t.born);
      if (arr.length > 24) arr.shift();
      return;
    }
    if (busy[node] < SERVICE[mode][node][1]) startService(t, node);
    else { t.state = "queue"; t.node = node; queues[node].push(t); }
  };
  const pull = (node) => {
    while (queues[node].length && busy[node] < SERVICE[mode][node][1]) startService(queues[node].shift(), node);
  };
  const depart = (t, from) => {
    const to = NEXT[mode][from](rand());
    t.state = "travel"; t.from = from; t.to = to; t.prog = 0; t.len = dist(from, to);
  };

  const setMode = (m) => {
    if (m === mode) return;
    mode = m;
    btns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === m)));
    ui.root.classList.toggle("is-after", m === 1);
    if (m === 1) {
      for (const id of Object.keys(MERGE)) {
        const target = MERGE[id];
        for (const t of tokens) {
          if (t.state === "service" && t.node === id) { busy[id]--; t.state = "queue"; t.node = target; queues[target].push(t); }
          if (t.state === "travel" && t.to === id) t.to = target;
        }
        queues[target].push(...queues[id].map((t) => ((t.node = target), t)));
        queues[id] = [];
      }
    }
    IDS.forEach(pull);
    if (reduceMotion) { morph = m; reset(); simulate(8, 1 / 30); draw(); updateKpis(true); }
  };

  const step = (dt) => {
    simTime += dt;
    morph = clamp01(morph + (mode === 1 ? dt : -dt) / 1.2);
    if (!touched && !reduceMotion && mode === 0 && simTime > AUTO_SWITCH) setMode(1);

    nextArrival -= dt;
    if (nextArrival <= 0) {
      nextArrival = ARRIVAL * (0.75 + rand() * 0.5);
      if (queues.cap.length < 11) {
        const t = { id: seq++, born: simTime, mode, state: "service", node: "in", left: 0.05 };
        busy.in++;
        tokens.push(t);
      }
    }
    for (const t of tokens) {
      if (t.state === "service") {
        t.left -= dt;
        if (t.left <= 0) {
          const node = t.node;
          busy[node]--;
          depart(t, node);
          pull(node);
        }
      } else if (t.state === "travel") {
        t.prog += (SPEED[mode] * dt) / t.len;
        if (t.prog >= 1) arrive(t, t.to);
      } else if (t.state === "exit") {
        t.fade += dt / 0.5;
      }
    }
    tokens = tokens.filter((t) => !(t.state === "exit" && t.fade >= 1));
  };
  const simulate = (seconds, dt) => { for (let s = 0; s < seconds; s += dt) step(dt); };

  /* ---------- drawing ---------- */
  let W = 1, H = 1, vertical = false, map = null, cb = null;
  const resize = () => {
    const r = box.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cb = contentBox(stage);
    vertical = W < 640;
    if (!vertical) {
      const x0 = cb.left + 5, x1 = cb.right - 5, yMain = H * 0.62, yBranch = H * 0.24;
      map = (u, v) => [x0 + u * (x1 - x0), yMain + (yBranch - yMain) * v];
    } else {
      const y0 = 18, y1 = H - 34, xMain = cb.left + 10, xBranch = cb.left + cb.width * 0.64;
      map = (u, v) => [xMain + (xBranch - xMain) * v, y0 + u * (y1 - y0)];
    }
    draw();
  };
  const scr = (id) => { const p = posOf(id); return map(p[0], p[1]); };

  const drawNode = (id, alpha, kindNow) => {
    if (alpha < 0.02) return;
    const [x, y] = scr(id);
    ctx.globalAlpha = alpha;
    if (kindNow === "end") {
      ctx.fillStyle = col.ink;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    } else if (kindNow === "auto") {
      ctx.fillStyle = col.red;
      ctx.fillRect(x - 8, y - 8, 16, 16);
    } else {
      ctx.fillStyle = col.paper;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.strokeStyle = col.stone;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 7.25, y - 7.25, 14.5, 14.5);
    }
    ctx.globalAlpha = 1;
  };

  const drawLabel = (id, text, alpha, strong) => {
    if (!text || alpha < 0.02) return;
    const [x, y] = scr(id);
    const p = posOf(id);
    ctx.globalAlpha = alpha;
    ctx.font = `${strong ? 600 : 500} ${vertical ? 12.5 : 13}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = strong ? col.ink : col.granite;
    if (!vertical) {
      const lines = wrapText(ctx, text, 118);
      ctx.textAlign = p[0] < 0.01 ? "left" : p[0] > 0.99 ? "right" : "center";
      const lx = p[0] < 0.01 ? x - 5 : p[0] > 0.99 ? x + 5 : x;
      ctx.textBaseline = "alphabetic";
      const above = p[1] > 0.5;
      lines.forEach((ln, i) => {
        const yy = above ? y - 18 - (lines.length - 1 - i) * 16 : y + 30 + i * 16;
        ctx.fillText(ln, lx, yy);
      });
    } else {
      const maxW = p[1] > 0.5 ? W - x - 22 : Math.max(90, cb.width * 0.64 - 40);
      const lines = wrapText(ctx, text, maxW);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      lines.forEach((ln, i) => ctx.fillText(ln, x + 16, y + (i - (lines.length - 1) / 2) * 15));
    }
    ctx.globalAlpha = 1;
  };

  const draw = () => {
    if (!map) return;
    ctx.clearRect(0, 0, W, H);
    const k = easeInOut(morph);
    // edges of both layouts, cross-faded
    [0, 1].forEach((m) => {
      const a = m === 0 ? 1 - k : k;
      if (a < 0.02) return;
      for (const [f, t, branch] of EDGES[m]) {
        const p = scr(f), q = scr(t);
        ctx.globalAlpha = a;
        ctx.strokeStyle = m === 1 && !branch ? col.red : col.stone;
        ctx.lineWidth = m === 1 && !branch ? 2 : 1.25;
        ctx.setLineDash(branch && m === 0 ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // nodes and labels
    const kindMode = morph > 0.5 ? 1 : 0;
    for (const id of IDS) {
      const vis = lerp(VISIBLE[0][id], VISIBLE[1][id], k);
      drawNode(id, vis, KIND[kindMode][id]);
    }
    for (const id of IDS) {
      const a0 = (1 - k) * VISIBLE[0][id], a1 = k * VISIBLE[1][id];
      drawLabel(id, S.before[id], Math.max(0, a0 * 2 - 1), false);
      drawLabel(id, S.after[id], Math.max(0, a1 * 2 - 1), KIND[1][id] === "auto");
    }

    // tokens
    const dot = (x, y, c, a) => {
      ctx.globalAlpha = a; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    };
    const svcCount = {};
    for (const t of tokens) {
      const c = t.mode === 1 ? col.red : col.granite;
      if (t.state === "travel") {
        const p = scr(t.from), q = scr(t.to);
        dot(lerp(p[0], q[0], t.prog), lerp(p[1], q[1], t.prog), c, 0.95);
      } else if (t.state === "service") {
        if (t.node === "in") continue;
        const n = (svcCount[t.node] = (svcCount[t.node] || 0) + 1) - 1;
        const [x, y] = scr(t.node);
        const off = (n % 3 - 1) * 6, row = Math.floor(n / 3) * 6;
        dot(vertical ? x + row : x + off, vertical ? y + off : y - row, c, 0.95);
      } else if (t.state === "exit") {
        const [x, y] = scr("done");
        dot(vertical ? x : x + t.fade * 14, vertical ? y + t.fade * 14 : y, c, 1 - t.fade);
      }
    }
    for (const id of IDS) {
      const q = queues[id];
      if (!q.length) continue;
      const [x, y] = scr(id);
      const [px, py] = scr(PRED[mode][id]);
      let dx = px - x, dy = py - y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      q.forEach((t, i) => {
        const d = 16 + i * 9;
        if (d > len - 12) return;
        dot(x + dx * d, y + dy * d, t.mode === 1 ? col.red : col.granite, 0.9);
      });
    }
    ctx.globalAlpha = 1;
  };

  let kpiTick = 0;
  const updateKpis = (force) => {
    kpiTick += 1;
    if (!force && kpiTick % 10) return;
    const arr = lead[mode];
    const measured = arr.length >= 4 ? arr.reduce((a, b) => a + b, 0) / arr.length : LEAD_EST[mode];
    leadShown += (measured - leadShown) * (force ? 1 : 0.35);
    const waiting = IDS.reduce((s, id) => s + queues[id].length, 0);
    kpiEls[0].fill.style.width = Math.round(Math.min(1, leadShown / LEAD_EST[0]) * 100) + "%";
    kpiEls[1].fill.style.width = Math.round((MANUAL_STEPS[mode] / 5) * 100) + "%";
    kpiEls[1].val.textContent = String(MANUAL_STEPS[mode]);
    kpiEls[2].fill.style.width = Math.round(Math.min(1, waiting / 14) * 100) + "%";
    kpiEls[2].val.textContent = String(waiting);
  };

  /* ---------- start ---------- */
  reset();
  btns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === 0)));
  let loop = null;
  if (reduceMotion) {
    mode = 1; morph = 1;
    btns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === 1)));
    ui.root.classList.add("is-after");
    simulate(8, 1 / 30);
  } else {
    simulate(PREWARM + (startTime || 0), 1 / 30);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();
  updateKpis(true);
  if (document.fonts && document.fonts.load) document.fonts.load('600 13px "Archivo"').then(draw, () => {});
  if (!reduceMotion) {
    loop = runLoop(box, (dt) => { step(dt); draw(); updateKpis(false); });
  }

  return {
    destroy() {
      if (loop) loop.destroy();
      ro.disconnect();
      ui.destroy();
    },
  };
}
