/*
 * alpaion — hero animation loader.
 * Picks the variant from ALPAION_CONFIG.heroVariant ("summit" | "flow" | "signal") and loads only that module.
 */
const loaders = {
  summit: () => import("./hero-summit.js"),
  flow: () => import("./hero-flow.js"),
  signal: () => import("./hero-signal.js"),
};

const stage = document.querySelector("[data-hero-stage]");
const lang = (document.documentElement.lang || "de").slice(0, 2) === "en" ? "en" : "de";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let current = null;
let ticket = 0;

async function mount(variant) {
  if (!stage) return;
  const name = loaders[variant] ? variant : "summit";
  const mine = ++ticket;
  if (current) {
    try { current.destroy(); } catch (e) { /* ignore */ }
    current = null;
  }
  stage.dataset.variant = name;
  stage.classList.remove("is-static");
  try {
    const mod = await loaders[name]();
    if (mine !== ticket) return;
    current = mod.mount(stage, { lang, reduceMotion, startTime: +window.__alpaionHeroTime || 0 });
  } catch (err) {
    stage.classList.add("is-static");
    console.warn("[alpaion] hero animation disabled:", err && err.message);
  }
}

window.alpaionHero = { mount, get variant() { return stage ? stage.dataset.variant : null; } };
const C = window.ALPAION_CONFIG || {};
mount(C.heroVariant || "summit");
