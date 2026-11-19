/*
 * alpaion — consent manager (DSGVO / nDSG / TDDDG)
 * - Nothing non-essential loads before consent ("basic" Google Consent Mode v2)
 * - Accept and reject are equally prominent, no cookie wall
 * - Choice stored locally for 12 months, withdrawable via [data-cc-open]
 */
(function () {
  "use strict";
  var C = window.ALPAION_CONFIG || {};
  var KEY = "alpaion_consent";
  var VERSION = C.consentVersion || 1;
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000;
  var lang = (document.documentElement.lang || "de").slice(0, 2) === "en" ? "en" : "de";
  var privacyHref = document.documentElement.getAttribute("data-privacy");

  var T = {
    de: {
      title: "Datenschutz-Einstellungen",
      text: "Wir verwenden notwendige Cookies und lokale Speicherung, damit diese Website funktioniert. Mit Ihrer Einwilligung nutzen wir zusätzlich Statistik-Dienste, um zu verstehen, welche Inhalte hilfreich sind. Ihre Auswahl können Sie jederzeit unter „Cookie-Einstellungen“ im Fussbereich ändern.",
      more: "Datenschutzerklärung",
      privacy: "datenschutz.html#cookies",
      accept: "Alle akzeptieren",
      reject: "Nur notwendige",
      customize: "Auswahl anpassen",
      save: "Auswahl speichern",
      necessary: "Notwendig",
      necessaryText: "Speichert Ihre Cookie-Auswahl und sorgt für den sicheren Betrieb der Website. Immer aktiv.",
      analytics: "Statistik",
      analyticsText: "Hilft uns mit pseudonymen Nutzungsdaten, die Website zu verbessern (z. B. Google Analytics 4 oder Matomo).",
      marketing: "Marketing",
      marketingText: "Misst den Erfolg von Kampagnen auf LinkedIn (LinkedIn Insight Tag).",
      always: "Immer aktiv",
    },
    en: {
      title: "Privacy settings",
      text: "We use essential cookies and local storage to make this website work. With your consent, we also use analytics services to understand which content is useful. You can change your choice at any time via “Cookie settings” in the footer.",
      more: "Privacy policy",
      privacy: "privacy.html#cookies",
      accept: "Accept all",
      reject: "Essential only",
      customize: "Customise",
      save: "Save selection",
      necessary: "Essential",
      necessaryText: "Stores your cookie choice and keeps the website secure. Always active.",
      analytics: "Analytics",
      analyticsText: "Helps us improve the website using pseudonymous usage data (e.g. Google Analytics 4 or Matomo).",
      marketing: "Marketing",
      marketingText: "Measures the success of LinkedIn campaigns (LinkedIn Insight Tag).",
      always: "Always active",
    },
  }[lang];

  function valid(id) { return typeof id === "string" && id.trim() !== "" && !/x{3,}/i.test(id); }
  var hasGA = valid(C.ga4Id);
  var hasMatomo = !!(C.matomo && valid(C.matomo.url) && String(C.matomo.siteId || "").trim());
  var hasMarketing = valid(C.linkedinPartnerId);
  var needsBanner = hasGA || hasMatomo || hasMarketing || C.showBannerWithoutTools;

  /* ---------- Google Consent Mode v2 defaults (before anything else) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500,
  });

  /* ---------- storage ---------- */
  function read() {
    try {
      var v = JSON.parse(window.localStorage.getItem(KEY));
      if (!v || v.v !== VERSION || Date.now() - v.t > MAX_AGE) return null;
      return v;
    } catch (e) { return null; }
  }
  function write(state) {
    var v = { v: VERSION, t: Date.now(), analytics: !!state.analytics, marketing: !!state.marketing };
    try { window.localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    return v;
  }

  /* ---------- loaders ---------- */
  var loaded = {};
  function addScript(src) {
    var s = document.createElement("script");
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }
  function loadAnalytics() {
    if (hasGA && !loaded.ga) {
      loaded.ga = true;
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.ga4Id));
      window.gtag("js", new Date());
      window.gtag("config", C.ga4Id);
    }
    if (hasMatomo && !loaded.matomo) {
      loaded.matomo = true;
      var u = C.matomo.url.replace(/\/?$/, "/");
      var _paq = (window._paq = window._paq || []);
      _paq.push(["setCookieDomain", "*." + location.hostname.replace(/^www\./, "")]);
      _paq.push(["trackPageView"]);
      _paq.push(["enableLinkTracking"]);
      _paq.push(["setTrackerUrl", u + "matomo.php"]);
      _paq.push(["setSiteId", String(C.matomo.siteId)]);
      addScript(/matomo\.cloud/.test(u) ? "https://cdn.matomo.cloud/" + u.replace(/^https?:\/\//, "") + "matomo.js" : u + "matomo.js");
    }
  }
  function loadMarketing() {
    if (!hasMarketing || loaded.li) return;
    loaded.li = true;
    window._linkedin_partner_id = String(C.linkedinPartnerId);
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
    addScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
  }
  function clearCookies(re) {
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!re.test(name)) return;
      ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }

  function apply(state, prev) {
    window.gtag("consent", "update", {
      analytics_storage: state.analytics ? "granted" : "denied",
      ad_storage: state.marketing ? "granted" : "denied",
      ad_user_data: state.marketing ? "granted" : "denied",
      ad_personalization: state.marketing ? "granted" : "denied",
    });
    if (state.analytics) loadAnalytics(); else clearCookies(/^(_ga|_gid|_pk_|mtm_)/);
    if (state.marketing) loadMarketing(); else clearCookies(/^(li_|lidc|bcookie|AnalyticsSyncHistory|UserMatchHistory)/);
    try { document.dispatchEvent(new CustomEvent("alpaion:consent", { detail: state })); } catch (e) {}
    // scripts that already ran cannot be unloaded; a reload makes a withdrawal take full effect
    if (prev && ((prev.analytics && !state.analytics) || (prev.marketing && !state.marketing))) {
      setTimeout(function () { location.reload(); }, 150);
    }
  }

  /* ---------- UI ---------- */
  var box = null;
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function category(id, title, text, checked, disabled) {
    var row = el("div", { class: "cc-cat" });
    var lab = el("label", { for: id }, title);
    var sw = el("input", { type: "checkbox", class: "switch", id: id, role: "switch" });
    sw.checked = !!checked;
    if (disabled) { sw.disabled = true; sw.setAttribute("aria-describedby", id + "-d"); }
    row.appendChild(lab); row.appendChild(sw);
    row.appendChild(el("p", { id: id + "-d" }, text));
    return row;
  }

  function open(showPrefs) {
    if (box) { box.remove(); box = null; }
    var current = read() || { analytics: false, marketing: false };
    box = el("section", { class: "cc", role: "dialog", "aria-modal": "false", "aria-labelledby": "cc-title" });
    box.appendChild(el("h2", { id: "cc-title" }, '<span class="dot" aria-hidden="true"></span>' + T.title));
    box.appendChild(el("p", {}, T.text + ' <a href="' + (privacyHref || T.privacy) + '">' + T.more + "</a>."));

    var prefs = el("div", { class: "cc-prefs", id: "cc-prefs" });
    prefs.hidden = !showPrefs;
    prefs.appendChild(category("cc-necessary", T.necessary, T.necessaryText, true, true));
    prefs.appendChild(category("cc-analytics", T.analytics, T.analyticsText, current.analytics));
    if (hasMarketing) prefs.appendChild(category("cc-marketing", T.marketing, T.marketingText, current.marketing));
    box.appendChild(prefs);

    var actions = el("div", { class: "cc-actions" });
    var accept = el("button", { type: "button", class: "btn btn--primary" }, T.accept);
    var reject = el("button", { type: "button", class: "btn btn--ghost" }, T.reject);
    var more = el("button", { type: "button", class: "cc-more", "aria-controls": "cc-prefs", "aria-expanded": String(!!showPrefs) }, showPrefs ? T.save : T.customize);
    actions.appendChild(accept); actions.appendChild(reject); actions.appendChild(more);
    box.appendChild(actions);

    function decide(state) {
      var prev = read();
      var saved = write(state);
      box.remove(); box = null;
      apply(saved, prev);
    }
    accept.addEventListener("click", function () { decide({ analytics: true, marketing: true }); });
    reject.addEventListener("click", function () { decide({ analytics: false, marketing: false }); });
    more.addEventListener("click", function () {
      if (prefs.hidden) {
        prefs.hidden = false;
        more.textContent = T.save;
        more.setAttribute("aria-expanded", "true");
        var first = prefs.querySelector("input:not([disabled])");
        if (first) first.focus();
      } else {
        var m = prefs.querySelector("#cc-marketing");
        decide({ analytics: prefs.querySelector("#cc-analytics").checked, marketing: m ? m.checked : false });
      }
    });
    document.body.appendChild(box);
    if (showPrefs) { var f = box.querySelector("input:not([disabled])"); if (f) f.focus(); }
  }

  function boot() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-cc-open]");
      if (t) { e.preventDefault(); open(true); }
    });
    var stored = read();
    if (stored) apply(stored, null);
    else if (needsBanner) open(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
