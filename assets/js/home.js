/* =========================================================
   Dear, My Love — home page
   The heart game + the hidden tenth-heartbeat easter egg.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.DML_CONFIG || {};
  const SITE = CONFIG.site || {};
  const egg = SITE.easterEgg || {};
  const eggEnabled = egg.enabled !== false;
  const threshold = Number.isInteger(egg.threshold) && egg.threshold >= 3 ? egg.threshold : 10;
  const stage = document.querySelector("[data-heart-stage]");
  const heart = document.querySelector("[data-heart]");
  const scoreElement = document.querySelector("[data-heart-score]");
  const hintElement = document.querySelector("[data-heart-hint]");
  const meter = document.querySelector(".heart-meter");
  const dialog = document.querySelector("[data-secret-dialog]");
  const footerSecret = document.querySelector("[data-secret-replay]");
  const STORAGE_KEY = "dml:secret-found";

  if (!stage || !heart) return;

  const loveNotes = Array.isArray(SITE.loveNotes)
    ? SITE.loveNotes.filter((note) => typeof note === "string" && note.trim() !== "")
    : [];
  let loveNoteIndex = 0;
  let loveNoteTimer = 0;
  let loveNoteCard = null;

  let score = 0;
  let locked = false;
  let found = false;
  try {
    found = window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    found = false;
  }

  if (footerSecret && found && eggEnabled) footerSecret.hidden = false;

  const dots = meter ? Array.from(meter.querySelectorAll("i")) : [];
  if (dots.length < threshold) {
    for (let index = dots.length; index < threshold; index += 1) {
      const dot = document.createElement("i");
      if (meter) meter.appendChild(dot);
      dots.push(dot);
    }
  } else if (dots.length > threshold) {
    dots.splice(threshold).forEach((dot) => dot.remove());
  }

  function scoreLabel(value) {
    return String(value).padStart(2, "0");
  }

  function hintFor(value) {
    if (found && value === 0) return "你知道那个秘密";
    if (value === 0) return "轻轻点一下";
    if (value < 3) return "有一点心动";
    if (value < 5) return "再靠近一点";
    if (value < 7) return "好像快藏不住了";
    if (value < threshold - 1) return "再点一下试试";
    if (value === threshold - 1) return "最后一下。";
    return "心意已收到";
  }

  function updateScore() {
    if (scoreElement) {
      scoreElement.textContent = scoreLabel(score);
      scoreElement.classList.remove("is-pop");
      void scoreElement.offsetWidth;
      scoreElement.classList.add("is-pop");
    }
    dots.forEach((dot, index) => dot.classList.toggle("is-lit", index < score));
    if (hintElement) hintElement.textContent = hintFor(score);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function ensureLoveNoteCard() {
    if (loveNoteCard) return loveNoteCard;
    const card = document.createElement("aside");
    card.className = "heart-love-note";
    card.setAttribute("aria-label", "爱心情话");
    card.setAttribute("aria-hidden", "true");
    card.inert = true;
    card.innerHTML = `
      <div class="heart-love-note__top">
        <span>A little note for you</span>
        <span data-love-note-count></span>
      </div>
      <blockquote data-love-note-quote></blockquote>
      <button class="heart-love-note__close" type="button" data-love-note-close aria-label="收起这条情话">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </button>`;
    card.querySelector("[data-love-note-quote]")?.setAttribute("aria-live", "polite");
    card.querySelector("[data-love-note-close]")?.addEventListener("click", hideLoveNote);
    document.body.appendChild(card);
    loveNoteCard = card;
    return card;
  }

  function hideLoveNote() {
    window.clearTimeout(loveNoteTimer);
    if (!loveNoteCard) return;
    loveNoteCard.classList.remove("is-visible");
    loveNoteCard.setAttribute("aria-hidden", "true");
    loveNoteCard.inert = true;
  }

  function showLoveNote() {
    if (loveNotes.length === 0) return;
    const card = ensureLoveNoteCard();
    const quote = card.querySelector("[data-love-note-quote]");
    const count = card.querySelector("[data-love-note-count]");
    const note = loveNotes[loveNoteIndex % loveNotes.length];
    loveNoteIndex += 1;
    if (quote) {
      quote.textContent = `“${note}”`;
      quote.classList.remove("is-refreshing");
      void quote.offsetWidth;
      quote.classList.add("is-refreshing");
    }
    if (count) count.textContent = `${String(loveNoteIndex).padStart(2, "0")} / ${String(loveNotes.length).padStart(2, "0")}`;
    card.classList.add("is-visible");
    card.setAttribute("aria-hidden", "false");
    card.inert = false;
    window.clearTimeout(loveNoteTimer);
    loveNoteTimer = window.setTimeout(hideLoveNote, 6800);
  }

  function burst(count, originX, originY, big) {
    const rect = stage.getBoundingClientRect();
    const x = originX ?? rect.width / 2;
    const y = originY ?? rect.height / 2;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "click-heart";
      particle.textContent = "♥";
      particle.setAttribute("aria-hidden", "true");
      particle.style.left = `${x + randomBetween(-16, 16)}px`;
      particle.style.top = `${y + randomBetween(-12, 12)}px`;
      particle.style.setProperty("--dx", `${randomBetween(-100, 100)}px`);
      particle.style.setProperty("--dy", `${randomBetween(-150, -50)}px`);
      particle.style.setProperty("--rot", `${randomBetween(-60, 60)}deg`);
      particle.style.setProperty("--size", `${randomBetween(big ? 13 : 8, big ? 26 : 18)}px`);
      particle.style.setProperty("--dur", `${randomBetween(0.8, big ? 1.7 : 1.25)}s`);
      particle.style.color = Math.random() > 0.55 ? "#cf7f94" : "#e7a8b7";
      stage.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
    }
  }

  function seedSecretPetals() {
    if (!dialog) return;
    const host = dialog.querySelector("[data-secret-petals]");
    if (!host || host.childElementCount > 0) return;
    for (let index = 0; index < 18; index += 1) {
      const petal = document.createElement("span");
      petal.style.setProperty("--left", `${randomBetween(2, 98)}%`);
      petal.style.setProperty("--drift", `${randomBetween(-40, 90)}px`);
      petal.style.setProperty("--dur", `${randomBetween(6, 12)}s`);
      petal.style.setProperty("--delay", `${randomBetween(-10, 0)}s`);
      host.appendChild(petal);
    }
  }

  function applyEggCopy() {
    if (!dialog) return;
    const kicker = dialog.querySelector(".secret-card__head .kicker");
    const title = dialog.querySelector("#secret-title");
    const intro = dialog.querySelector(".secret-card__intro");
    const sign = dialog.querySelector(".secret-card__sign");
    const coupons = dialog.querySelector(".secret-coupons");

    if (kicker) kicker.textContent = `The ${threshold === 10 ? "tenth" : `${threshold}th`} heartbeat · 隐藏彩蛋`;
    if (title && egg.title) title.textContent = egg.title;
    if (intro && egg.intro) intro.textContent = egg.intro;
    if (sign && egg.signature) sign.textContent = egg.signature;
    if (coupons && Array.isArray(egg.coupons) && egg.coupons.length > 0) {
      coupons.innerHTML = egg.coupons.map((coupon, index) => `
        <div class="secret-coupon">
          <span class="secret-coupon__no">${String(index + 1).padStart(2, "0")}</span>
          <p>${window.DML.escapeHTML(coupon.text)}</p>
          <small>${window.DML.escapeHTML(coupon.note || "For you, always")}</small>
        </div>`).join("");
    }
  }

  function openSecret() {
    if (!dialog) return;
    hideLoveNote();
    applyEggCopy();
    seedSecretPetals();
    if (dialog.open) return;
    dialog.showModal();
    document.body.classList.add("modal-open");
    found = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Storage is optional.
    }
    if (footerSecret) footerSecret.hidden = false;
    window.setTimeout(() => {
      const closeButton = dialog.querySelector(".secret-card__head [data-secret-close]");
      if (closeButton) closeButton.focus();
    }, 120);
  }

  function closeSecret() {
    if (dialog && dialog.open) dialog.close();
  }

  function complete() {
    if (locked) return;
    locked = true;
    hideLoveNote();
    stage.classList.add("is-complete");
    score = threshold;
    updateScore();
    if (window.DML.audio && typeof window.DML.audio.chime === "function") {
      [0, 2, 4, 7].forEach((step, index) => {
        window.setTimeout(() => window.DML.audio.chime(step + 4), index * 95);
      });
    }
    burst(28, null, null, true);
    window.setTimeout(openSecret, 520);
  }

  function onHeartClick(event) {
    const rect = stage.getBoundingClientRect();
    let x = rect.width / 2;
    let y = rect.height / 2;
    if (event.detail !== 0) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    if (score >= threshold) {
      burst(5, x, y, false);
      if (eggEnabled) window.setTimeout(openSecret, 120);
      return;
    }

    score += 1;
    updateScore();
    burst(score === threshold ? 18 : 6, x, y, score === threshold);
    showLoveNote();

    if (window.DML.audio && typeof window.DML.audio.chime === "function") {
      window.DML.audio.chime(score);
    }

    if (score === threshold) {
      if (eggEnabled) {
        complete();
      } else {
        stage.classList.add("is-complete");
        if (hintElement) hintElement.textContent = "心意已收到";
        burst(12, x, y, true);
      }
    }
  }

  heart.addEventListener("click", onHeartClick);
  updateScore();

  if (dialog) {
    dialog.querySelectorAll("[data-secret-close]").forEach((button) => {
      button.addEventListener("click", closeSecret);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeSecret();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      locked = false;
    });
  }

  if (footerSecret) {
    footerSecret.addEventListener("click", openSecret);
  }
})();
