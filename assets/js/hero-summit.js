/*
 * alpaion hero, variant A: "Vom Datenchaos zur klaren Entscheidung"
 * 1. Datenchaos   – ~18'000 data points drift as an unordered cloud
 * 2. Struktur     – they snap into columns (a 3D bar chart of the data)
 * 3. Entscheidung – the columns melt into the Alpaion massif; red routes climb to the summit
 */
import * as THREE from "../vendor/three.module.min.js";
import { STRINGS, makeUI, makeSteps, freshCanvas, runLoop, rng } from "./hero-ui.js";

function makeNoise(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (xin, yin) => {
    let n0 = 0, n1 = 0, n2 = 0;
    const s2 = (xin + yin) * F2;
    const i = Math.floor(xin + s2), j = Math.floor(yin + s2);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const q = g[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (q[0] * x0 + q[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const q = g[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (q[0] * x1 + q[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const q = g[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (q[0] * x2 + q[1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* timeline (seconds) */
const T_STRUCT = 1.6, D_STRUCT = 2.0;
const T_TERRAIN = 4.6, D_TERRAIN = 2.2;
const T_ROUTES = 6.6, D_ROUTES = 1.8;
const T_END = 8.6;

export function mount(stage, { lang, reduceMotion, startTime }) {
  const S = STRINGS[lang].summit;
  const probe = document.createElement("canvas");
  if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("WebGL unavailable");

  const canvas = freshCanvas(stage, S.aria);
  const box = stage.querySelector(".hero-canvas");
  const label = document.createElement("span");
  label.className = "stage-label";
  label.setAttribute("aria-hidden", "true");
  label.textContent = S.peak;
  box.appendChild(label);

  const ui = makeUI(stage);
  let elapsed = reduceMotion ? 99 : startTime || 0;
  let loop = null;
  const steps = makeSteps(ui.inner, S.steps, STRINGS[lang].replay, () => {
    elapsed = 0;
    steps.finished(false);
    if (loop) loop.start();
  });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  /* ---------- terrain (final state) ---------- */
  const W = 28, D = 13, NX = 210, NZ = 88;
  const PEAK = { x: 2.6, z: -2.4 };
  const noise = makeNoise(4242);
  const ridged = (x, z) => {
    let sum = 0, amp = 0.55, freq = 0.17, weight = 1;
    for (let o = 0; o < 4; o++) {
      let n = 1 - Math.abs(noise(x * freq, z * freq));
      n *= n; n *= weight; weight = Math.min(1, n * 1.7);
      sum += n * amp; amp *= 0.5; freq *= 2.07;
    }
    return sum;
  };
  const height = (x, z) => {
    const far = (D / 2 - z) / D;
    const massif = smooth(0.05, 0.78, far);
    let h = ridged(x + 11.3, z + 4.1) * 2.5 * (0.1 + 0.9 * massif);
    const dx = x - PEAK.x, dz = z - PEAK.z;
    h += 1.8 * Math.exp(-(dx * dx * 0.16 + dz * dz * 0.26));
    const edge = 1 - Math.pow(Math.abs(x) / (W / 2), 8);
    return Math.max(0, h * edge);
  };
  const heightSmooth = (x, z) => {
    let sum = 0, n = 0;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { sum += height(x + i * 0.22, z + j * 0.22); n++; }
    return sum / n;
  };

  const count = NX * NZ;
  const pos = new Float32Array(count * 3);
  const aH = new Float32Array(count);
  const aR = new Float32Array(count);
  const aChaos = new Float32Array(count * 3);
  const aBar = new Float32Array(count * 3);
  const rand = rng(77);

  /* columns of the "structure" phase: a 3D bar chart whose bars are the terrain's local averages */
  const NCX = 14, NCZ = 4;
  const gx0 = -W * 0.45, gz0 = -D * 0.43, colW = (W * 0.9) / NCX, colD = (D * 0.86) / NCZ;
  const colOf = new Uint16Array(count);
  const colSum = new Float32Array(NCX * NCZ), colCnt = new Float32Array(NCX * NCZ);

  let peakTop = { x: PEAK.x, y: 0, z: PEAK.z };
  for (let iz = 0; iz < NZ; iz++) {
    for (let ix = 0; ix < NX; ix++) {
      const i = iz * NX + ix;
      const jx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const x = -W / 2 + (ix / (NX - 1)) * W + jx * 0.02;
      const z = -D / 2 + (iz / (NZ - 1)) * D;
      const h = height(x, z);
      pos[i * 3] = x; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = z;
      aH[i] = h; aR[i] = Math.abs(jx);
      if (Math.abs(x - PEAK.x) < 1.6 && Math.abs(z - PEAK.z) < 1.6 && h > peakTop.y) peakTop = { x, y: h, z };

      aChaos[i * 3] = (rand() * 2 - 1) * W * 0.47;
      aChaos[i * 3 + 1] = 0.25 + Math.pow(rand(), 1.4) * 3.9;
      aChaos[i * 3 + 2] = (rand() * 2 - 1) * D * 0.5;

      const cx = Math.min(NCX - 1, Math.max(0, Math.floor((x - gx0) / colW)));
      const cz = Math.min(NCZ - 1, Math.max(0, Math.floor((z - gz0) / colD)));
      const c = cz * NCX + cx;
      colOf[i] = c;
      colSum[c] += h; colCnt[c] += 1;
    }
  }
  const colH = new Float32Array(NCX * NCZ);
  for (let c = 0; c < colH.length; c++) colH[c] = Math.max(0.14, (colSum[c] / Math.max(1, colCnt[c])) * 1.08);
  const hw = colW * 0.3, hd = colD * 0.24;
  for (let i = 0; i < count; i++) {
    const c = colOf[i];
    const cx = c % NCX, cz = Math.floor(c / NCX);
    const mx = gx0 + (cx + 0.5) * colW, mz = gz0 + (cz + 0.5) * colD;
    const h = colH[c];
    let px, py, pz;
    if (rand() < 0.5) {
      // edges: 4 vertical + 4 top edges make each column read as a crisp box
      const eV = 4 * h, eX = 2 * 2 * hw, eZ = 2 * 2 * hd;
      let r = rand() * (eV + eX + eZ);
      const sx = rand() < 0.5 ? -1 : 1, sz = rand() < 0.5 ? -1 : 1;
      if ((r -= eV) < 0) { px = mx + sx * hw; py = rand() * h; pz = mz + sz * hd; }
      else if ((r -= eX) < 0) { px = mx + (rand() * 2 - 1) * hw; py = h; pz = mz + sz * hd; }
      else { px = mx + sx * hw; py = h; pz = mz + (rand() * 2 - 1) * hd; }
    } else {
      const aTop = 4 * hw * hd, aSx = 2 * hd * h, aSz = 2 * hw * h;
      let r = rand() * (aTop + 2 * aSx + 2 * aSz);
      const u = rand() * 2 - 1, v = rand();
      if ((r -= aTop) < 0) { px = mx + u * hw; py = h; pz = mz + (rand() * 2 - 1) * hd; }
      else if ((r -= aSx) < 0) { px = mx - hw; py = v * h; pz = mz + u * hd; }
      else if ((r -= aSx) < 0) { px = mx + hw; py = v * h; pz = mz + u * hd; }
      else if ((r -= aSz) < 0) { px = mx + u * hw; py = v * h; pz = mz - hd; }
      else { px = mx + u * hw; py = v * h; pz = mz + hd; }
    }
    aBar[i * 3] = px; aBar[i * 3 + 1] = py; aBar[i * 3 + 2] = pz;
  }

  const uniforms = {
    uTime: { value: 0 },
    uM1: { value: 0 },
    uM2: { value: 0 },
    uFade: { value: 0 },
    uSize: { value: 2.3 },
    uPR: { value: renderer.getPixelRatio() },
    uChaos: { value: new THREE.Color("#AEB3BA") },
    uLow: { value: new THREE.Color("#9AA0A8") },
    uHigh: { value: new THREE.Color("#22262C") },
  };

  const pointsVert = /* glsl */ `
    uniform float uTime; uniform float uM1; uniform float uM2; uniform float uSize; uniform float uPR;
    attribute vec3 aChaos; attribute vec3 aBar; attribute float aH; attribute float aR;
    varying float vH; varying float vFade; varying float vOrder;
    float ease(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
    void main() {
      float m1 = ease(clamp(uM1 * 1.45 - aR * 0.45, 0.0, 1.0));
      float d2 = (position.x + 14.0) / 28.0 * 0.32 + aR * 0.13;
      float m2 = ease(clamp(uM2 * 1.45 - d2, 0.0, 1.0));
      vec3 drift = vec3(sin(uTime * 0.9 + aR * 40.0), sin(uTime * 0.7 + aR * 23.0) * 0.8, cos(uTime * 0.8 + aR * 31.0)) * 0.24;
      vec3 pc = aChaos + drift;
      float wave = sin(position.x * 0.55 + uTime * 0.55 + aR * 6.2831) * 0.022 + sin(position.z * 0.85 - uTime * 0.4) * 0.018;
      vec3 pt = vec3(position.x, aH + wave, position.z);
      vec3 p = mix(mix(pc, aBar, m1), pt, m2);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * uPR * (7.0 / -mv.z);
      vH = mix(aBar.y * m1, aH, m2);
      vOrder = m1;
      vFade = smoothstep(30.0, 8.0, -mv.z);
    }`;
  const pointsMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: pointsVert,
    fragmentShader: /* glsl */ `
      uniform vec3 uChaos; uniform vec3 uLow; uniform vec3 uHigh; uniform float uFade;
      varying float vH; varying float vFade; varying float vOrder;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.28, d);
        vec3 col = mix(uChaos, mix(uLow, uHigh, smoothstep(0.05, 3.2, vH)), vOrder);
        gl_FragColor = vec4(col, a * (0.28 + 0.72 * vFade) * uFade);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aH", new THREE.BufferAttribute(aH, 1));
  g.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
  g.setAttribute("aChaos", new THREE.BufferAttribute(aChaos, 3));
  g.setAttribute("aBar", new THREE.BufferAttribute(aBar, 3));
  const cloud = new THREE.Points(g, pointsMat);
  cloud.renderOrder = 1;
  cloud.frustumCulled = false;
  scene.add(cloud);

  /* invisible depth surface: once the massif stands, ridges hide what lies behind them */
  const idx = [];
  for (let iz = 0; iz < NZ - 1; iz++) {
    for (let ix = 0; ix < NX - 1; ix++) {
      const a = iz * NX + ix, b = a + 1, c = a + NX, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", g.getAttribute("position"));
  sg.setAttribute("aH", g.getAttribute("aH"));
  sg.setIndex(idx);
  const surface = new THREE.Mesh(sg, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uM2; attribute float aH;
      void main() {
        float s = smoothstep(0.75, 1.0, uM2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, aH * s - 0.02, position.z, 1.0);
      }`,
    fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    colorWrite: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  }));
  surface.renderOrder = 0;
  surface.frustumCulled = false;
  scene.add(surface);

  /* ridge lines, faded in with the massif */
  const rows = [];
  for (let iz = 1; iz < NZ; iz += 3) rows.push(iz);
  const segs = rows.length * (NX - 1);
  const lp = new Float32Array(segs * 2 * 3), lh = new Float32Array(segs * 2);
  let k = 0;
  for (const iz of rows) {
    for (let ix = 0; ix < NX - 1; ix++) {
      for (const jx of [ix, ix + 1]) {
        const i = iz * NX + jx;
        lp[k * 3] = pos[i * 3]; lp[k * 3 + 1] = 0; lp[k * 3 + 2] = pos[i * 3 + 2];
        lh[k] = aH[i]; k++;
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  lg.setAttribute("aH", new THREE.BufferAttribute(lh, 1));
  const ridges = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uM2; attribute float aH;
      varying float vH; varying float vFade; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position.x, aH, position.z, 1.0);
        gl_Position = projectionMatrix * mv;
        vH = aH; vFade = smoothstep(30.0, 8.0, -mv.z); vA = smoothstep(0.7, 1.0, uM2);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow; uniform vec3 uHigh;
      varying float vH; varying float vFade; varying float vA;
      void main() {
        vec3 col = mix(uLow, uHigh, smoothstep(0.05, 3.2, vH));
        gl_FragColor = vec4(col, (0.16 + 0.34 * smoothstep(0.1, 2.6, vH)) * vFade * vA);
      }`,
    transparent: true,
    depthWrite: false,
  }));
  ridges.renderOrder = 1;
  ridges.frustumCulled = false;
  scene.add(ridges);

  /* red routes to the summit */
  const RED = new THREE.Color("#DA291C");
  const routeDefs = [
    [[-11.5, 2.6], [-8.6, 1.6], [-5.8, 2.2], [-3.2, 0.9], [-0.8, 0.4], [1.0, -1.2], [peakTop.x, peakTop.z]],
    [[-3.6, 3.4], [-1.6, 2.6], [0.6, 2.4], [2.2, 1.0], [2.1, -0.6], [peakTop.x, peakTop.z]],
    [[11.8, 2.4], [9.4, 1.2], [7.2, 1.8], [5.6, 0.4], [4.2, -1.2], [peakTop.x, peakTop.z]],
  ];
  const disposables = [g, sg, lg, pointsMat];
  const routes = routeDefs.map((def, idx2) => {
    const flat = new THREE.CatmullRomCurve3(def.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
    const raw = flat.getSpacedPoints(300).map((v) => new THREE.Vector3(v.x, heightSmooth(v.x, v.z), v.z));
    const pts = raw.map((p, i) => {
      let sum = 0, n = 0;
      for (let q = -8; q <= 8; q++) { sum += raw[Math.min(raw.length - 1, Math.max(0, i + q))].y; n++; }
      return new THREE.Vector3(p.x, Math.max(sum / n, height(p.x, p.z)) + 0.07, p.z);
    });
    pts[pts.length - 1].set(peakTop.x, peakTop.y + 0.05, peakTop.z);
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const ru = { uColor: { value: RED }, uReveal: { value: 0 }, uHead: { value: -1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: ru,
      vertexShader: "varying float vT; void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uReveal; uniform float uHead; varying float vT;
        void main() {
          if (vT > uReveal) discard;
          float trail = smoothstep(uHead - 0.25, uHead, vT) * step(vT, uHead);
          gl_FragColor = vec4(uColor, 0.78 + 0.22 * trail);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const geo = new THREE.TubeGeometry(curve, 400, 0.016, 6, false);
    const tube = new THREE.Mesh(geo, mat);
    tube.renderOrder = 2;
    scene.add(tube);
    disposables.push(geo, mat);
    return { curve, ru, offset: idx2 * 0.37 };
  });

  const markerCount = routes.length + 1;
  const mPos = new Float32Array(markerCount * 3);
  const mKind = new Float32Array(markerCount);
  const mVis = new Float32Array(markerCount);
  mKind[markerCount - 1] = 1;
  mPos.set([peakTop.x, peakTop.y + 0.07, peakTop.z], (markerCount - 1) * 3);
  const mg = new THREE.BufferGeometry();
  mg.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
  mg.setAttribute("aKind", new THREE.BufferAttribute(mKind, 1));
  mg.setAttribute("aVis", new THREE.BufferAttribute(mVis, 1));
  const markerMat = new THREE.ShaderMaterial({
    uniforms: { uPR: uniforms.uPR, uTime: uniforms.uTime, uColor: { value: RED } },
    vertexShader: /* glsl */ `
      uniform float uPR; uniform float uTime;
      attribute float aKind; attribute float aVis;
      varying float vKind; varying float vVis; varying float vPulse;
      void main() {
        vKind = aKind; vVis = aVis; vPulse = fract(uTime * 0.45);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (aKind > 0.5 ? 46.0 : 9.0) * uPR;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vKind; varying float vVis; varying float vPulse;
      void main() {
        if (vVis < 0.01) discard;
        vec2 c = abs(gl_PointCoord - 0.5);
        if (vKind > 0.5) {
          float m = max(c.x, c.y);
          float core = step(m, 0.115);
          float r = 0.13 + vPulse * 0.36;
          float ring = (1.0 - smoothstep(0.0, 0.022, abs(m - r))) * (1.0 - vPulse);
          float a = max(core, ring * 0.9);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a * vVis);
        } else {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.36, d) * vVis);
        }
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const markers = new THREE.Points(mg, markerMat);
  markers.renderOrder = 3;
  markers.frustumCulled = false;
  scene.add(markers);
  disposables.push(mg, markerMat, surface.material, ridges.material);

  /* ---------- camera, sizing, pointer ---------- */
  const look = new THREE.Vector3(0, 1.9, -1.6);
  const base = new THREE.Vector3(0, 3.6, 10.8);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let width = 1, heightPx = 1;
  const v = new THREE.Vector3();

  const render = () => {
    camera.position.set(base.x + pointer.x * 0.9, base.y - pointer.y * 0.35, base.z);
    camera.lookAt(look);
    renderer.render(scene, camera);
  };
  const placeLabel = (show) => {
    v.set(peakTop.x, peakTop.y + 0.07, peakTop.z).project(camera);
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * heightPx;
    const inside = x > 40 && x < width - 40 && y > 30 && y < heightPx - 20;
    const flip = x > width - 220;
    label.style.transform = `translate(${Math.round(flip ? x - 18 - label.offsetWidth : x + 18)}px, ${Math.round(y - 34)}px)`;
    label.classList.toggle("is-visible", show && inside);
  };

  const apply = (dt) => {
    const e = elapsed;
    uniforms.uTime.value = e;
    uniforms.uFade.value = Math.min(1, e / 0.6);
    uniforms.uM1.value = Math.min(1, Math.max(0, (e - T_STRUCT) / D_STRUCT));
    uniforms.uM2.value = Math.min(1, Math.max(0, (e - T_TERRAIN) / D_TERRAIN));
    const reveal = Math.min(1, Math.max(0, (e - T_ROUTES) / D_ROUTES));
    const revealE = 1 - Math.pow(1 - reveal, 2);
    routes.forEach((r, i) => {
      r.ru.uReveal.value = revealE;
      const head = reveal >= 1 ? ((e - T_ROUTES - D_ROUTES) * 0.11 + r.offset) % 1.35 : -1;
      r.ru.uHead.value = reduceMotion ? -1 : head;
      const vis = !reduceMotion && head > 0 && head <= 1 ? 1 : 0;
      mVis[i] = vis;
      if (vis) {
        r.curve.getPointAt(Math.min(1, head), v);
        mPos[i * 3] = v.x; mPos[i * 3 + 1] = v.y + 0.04; mPos[i * 3 + 2] = v.z;
      }
    });
    mVis[markerCount - 1] = revealE > 0.95 ? 1 : 0;
    mg.attributes.position.needsUpdate = true;
    mg.attributes.aVis.needsUpdate = true;
    steps.set(e < T_STRUCT ? 0 : e < T_TERRAIN ? 1 : 2);
    steps.finished(!reduceMotion && e > T_END);
    if (dt) {
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
    }
    render();
    placeLabel(revealE > 0.95);
  };

  const resize = () => {
    const r = box.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    heightPx = Math.max(1, Math.round(r.height));
    renderer.setSize(width, heightPx, false);
    camera.aspect = width / heightPx;
    const narrow = Math.max(0, 1.9 - camera.aspect);
    base.set(0.9 * Math.min(1, narrow), 3.6 + narrow * 1.2, 10.8 + narrow * 4.4);
    camera.fov = 32 + narrow * 6;
    camera.updateProjectionMatrix();
    apply(0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);

  const onPointer = (ev) => {
    pointer.tx = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (ev.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

  resize();
  if (!reduceMotion) {
    loop = runLoop(box, (dt) => {
      elapsed += dt;
      apply(dt);
    });
  }

  return {
    destroy() {
      if (loop) loop.destroy();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
      label.remove();
      ui.destroy();
    },
  };
}
