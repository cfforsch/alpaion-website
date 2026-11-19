/*
 * ============================================================
 *  alpaion.com — EINSTELLUNGEN / SETTINGS
 *  Hier trägst du deine IDs ein. Sonst musst du nichts am Code ändern.
 *  Fill in your IDs here. Nothing else in the code needs to change.
 * ============================================================
 */
window.ALPAION_CONFIG = {
  /* Google Analytics 4 — Mess-ID, z. B. "G-AB12CD34EF".
     Wird erst geladen, wenn Besucher im Cookie-Banner "Statistik" erlauben. */
  ga4Id: "",

  /* Alternative zu Google Analytics: Matomo (z. B. Matomo Cloud oder selbst gehostet).
     url endet mit "/", z. B. "https://alpaion.matomo.cloud/" */
  matomo: { url: "", siteId: "" },

  /* Optional: LinkedIn Insight Tag (Marketing-Kategorie erscheint nur, wenn gesetzt). */
  linkedinPartnerId: "",

  /* Kontaktformular — eine der beiden Varianten:
     a) Web3Forms (kostenlos): Access Key von https://web3forms.com eintragen
     b) Formspree o. ä.: komplette Endpoint-URL, z. B. "https://formspree.io/f/abcdwxyz"
     Bleibt beides leer, öffnet das Formular das E-Mail-Programm des Besuchers. */
  web3formsKey: "",
  formEndpoint: "",

  /* Online-Terminbuchung (Cal.com, Calendly, Microsoft Bookings, ...).
     Leer = Buttons springen zum Kontaktformular. */
  bookingUrl: "",

  /* Hero-Animation auf der Startseite:
     "summit" = Datenchaos → Struktur → Gipfel (3D)
     "flow"   = Prozess heute vs. mit Alpaion
     "signal" = Rauschen → Signal → Prognose */
  heroVariant: "summit",

  /* Kontaktadresse, wird auf der Seite und als Fallback genutzt */
  email: "info@alpaion.com",

  /* Cookie-Banner auch zeigen, solange noch keine Tracking-ID eingetragen ist
     (praktisch zum Testen). Nach Eintragen der ID egal. */
  showBannerWithoutTools: true,

  /* Erhöhen, wenn sich die Cookie-Nutzung ändert → alle Besucher werden neu gefragt */
  consentVersion: 1,
};
