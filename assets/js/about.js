/* =========================================================
   Dear, My Love — about page
   Renders the personal introduction from config.about so the
   whole page can be re-written by editing one file.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.DML_CONFIG || {};
  const about = CONFIG.about || {};
  const DML = window.DML || {};

  const escape = DML.escapeHTML || ((value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;"));

  function text(selector, value) {
    if (value === undefined || value === null || value === "") return;
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value;
    });
  }

  function renderIntro() {
    const host = document.querySelector("[data-about-intro]");
    if (!host || !Array.isArray(about.intro)) return;
    host.innerHTML = about.intro
      .filter((paragraph) => typeof paragraph === "string" && paragraph.trim() !== "")
      .map((paragraph) => `<p>${escape(paragraph)}</p>`)
      .join("");
  }

  function renderFacts() {
    const host = document.querySelector("[data-about-facts]");
    if (!host || !Array.isArray(about.facts)) return;
    host.innerHTML = about.facts.map((fact, index) => `
      <li class="fact-row reveal">
        <span class="fact-row__no" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <span class="fact-row__head">
          <span class="fact-row__title">${escape(fact.title)}</span>
          ${fact.en ? `<span class="fact-row__en">${escape(fact.en)}</span>` : ""}
        </span>
        <span class="fact-row__note">${escape(fact.note || "")}</span>
      </li>`).join("");
  }

  function renderList(selector, items) {
    const host = document.querySelector(selector);
    if (!host || !Array.isArray(items)) return;
    host.innerHTML = items
      .filter((item) => typeof item === "string" && item.trim() !== "")
      .map((item) => `<li>${escape(item)}</li>`)
      .join("");
  }

  function renderDay() {
    const host = document.querySelector("[data-about-day]");
    if (!host || !Array.isArray(about.day)) return;
    host.innerHTML = about.day.map((entry) => `
      <li class="dayline__item reveal">
        <span class="dayline__time">${escape(entry.time)}</span>
        <span class="dayline__dot" aria-hidden="true"></span>
        <div class="dayline__body">
          <h4>${escape(entry.title)}</h4>
          <p>${escape(entry.note || "")}</p>
        </div>
      </li>`).join("");
  }

  function renderPromises() {
    const host = document.querySelector("[data-about-promises]");
    if (!host || !Array.isArray(about.promises)) return;
    host.innerHTML = about.promises.map((promise, index) => `
      <article class="promise-card reveal" style="--reveal-delay:${(index * 0.08).toFixed(2)}s">
        <span class="promise-card__no" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <h3>${escape(promise.title)}</h3>
        <p>${escape(promise.note || "")}</p>
      </article>`).join("");
  }

  function render() {
    text("[data-about-name]", about.name);
    text("[data-about-role]", about.role);
    text("[data-about-location]", about.location);
    text("[data-about-status]", about.status);
    text("[data-about-card-note]", about.cardNote);
    text("[data-about-card-sign]", about.cardSign);
    text("[data-about-monogram]", about.monogram);
    text("[data-about-stamp]", (about.monogram || "D").replace(/[^A-Za-z\u4e00-\u9fa5]/g, "").slice(0, 1) || "D");
    text("[data-about-closing]", about.closing);
    text("[data-about-closing-sign]", about.signature);

    renderIntro();
    renderFacts();
    renderList("[data-about-likes]", about.likes);
    renderList("[data-about-dislikes]", about.dislikes);
    renderDay();
    renderPromises();

    if (typeof DML.observeReveals === "function") DML.observeReveals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
})();
