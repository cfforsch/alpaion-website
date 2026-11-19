/* alpaion — page behaviour: header, navigation, references, contact form */
(function () {
  "use strict";
  var C = window.ALPAION_CONFIG || {};
  var lang = (document.documentElement.lang || "de").slice(0, 2) === "en" ? "en" : "de";
  var locale = lang === "en" ? "en-GB" : "de-CH";

  /* ---------- header shadow on scroll ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobile navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (n) { n.textContent = new Date().getFullYear(); });

  /* ---------- email + booking from config ---------- */
  if (C.email) {
    document.querySelectorAll("[data-email]").forEach(function (a) {
      a.textContent = C.email;
      if (a.tagName === "A") a.href = "mailto:" + C.email;
    });
  }
  if (C.bookingUrl) {
    document.querySelectorAll("[data-booking-row]").forEach(function (row) { row.hidden = false; });
    document.querySelectorAll("[data-booking]").forEach(function (a) {
      a.href = C.bookingUrl; a.target = "_blank"; a.rel = "noopener";
    });
  }

  /* ---------- client logos: show the file if it exists, otherwise keep the typeset name ---------- */
  document.querySelectorAll("[data-logo]").forEach(function (slot) {
    var base = slot.getAttribute("data-logo");
    var alt = slot.getAttribute("data-alt") || "";
    var tryLoad = function (exts) {
      if (!exts.length) return;
      var img = new Image();
      img.onload = function () {
        img.alt = alt;
        img.loading = "lazy";
        slot.innerHTML = "";
        slot.appendChild(img);
        slot.classList.add("has-logo");
      };
      img.onerror = function () { tryLoad(exts.slice(1)); };
      img.src = base + exts[0];
    };
    tryLoad([".svg", ".png", ".webp"]);
  });

  /* ---------- contact form ---------- */
  var form = document.querySelector("[data-contact-form]");
  if (form) {
    var status = form.querySelector(".form-status");
    var btn = form.querySelector('button[type="submit"]');
    var M = {
      de: {
        sending: "Wird gesendet …",
        ok: "Danke, Ihre Nachricht ist angekommen. Wir melden uns innerhalb von zwei Werktagen.",
        fail: "Die Nachricht konnte nicht gesendet werden. Bitte schreiben Sie uns direkt an ",
        mail: "Ihr E-Mail-Programm öffnet sich mit Ihrer Nachricht. Falls nicht, schreiben Sie direkt an ",
        invalid: "Bitte füllen Sie die markierten Pflichtfelder aus.",
        subject: "Anfrage über alpaion.com",
      },
      en: {
        sending: "Sending …",
        ok: "Thank you, your message has arrived. We will reply within two business days.",
        fail: "Your message could not be sent. Please email us directly at ",
        mail: "Your email app opens with your message. If it does not, write to ",
        invalid: "Please complete the highlighted required fields.",
        subject: "Enquiry via alpaion.com",
      },
    }[lang];
    var email = C.email || "info@alpaion.com";
    var say = function (text, kind, withMail) {
      status.className = "form-status " + (kind ? "is-" + kind : "");
      status.textContent = text;
      if (withMail) {
        var a = document.createElement("a");
        a.href = "mailto:" + email; a.textContent = email;
        status.appendChild(a);
        status.appendChild(document.createTextNode("."));
      }
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.querySelector('[name="website"]').value) return; // honeypot
      if (!form.checkValidity()) { form.reportValidity(); say(M.invalid, "error"); return; }
      var data = new FormData(form);
      data.delete("website");
      var endpoint = C.web3formsKey ? "https://api.web3forms.com/submit" : C.formEndpoint;
      if (C.web3formsKey) {
        data.append("access_key", C.web3formsKey);
        data.append("subject", M.subject);
        data.append("from_name", "alpaion.com");
      }
      if (!endpoint) {
        var body = ["name", "company", "email", "topic", "message"].map(function (k) {
          var v = data.get(k); return v ? k + ": " + v : null;
        }).filter(Boolean).join("\n");
        say(M.mail, "ok", true);
        window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(M.subject) + "&body=" + encodeURIComponent(body);
        return;
      }
      btn.disabled = true;
      say(M.sending, "");
      fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r; })
        .then(function () { form.reset(); say(M.ok, "ok"); })
        .catch(function () { say(M.fail, "error", true); })
        .then(function () { btn.disabled = false; });
    });
  }
})();
