/* =========================================================
   Dear, My Love — shared site behaviour
   No dependencies. Classic script so the site also works
   when opened directly from disk.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.DML_CONFIG || { site: {}, music: {}, photos: [] };
  const SITE = CONFIG.site || {};
  const PHOTOS = Array.isArray(CONFIG.photos) ? CONFIG.photos : [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeStorage(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
      return value;
    } catch {
      return null;
    }
  }

  const DATE = window.DMLDate;
  if (!DATE) throw new Error("DMLDate is required; load assets/js/date-utils.js before site.js");

  function todayInZone() {
    return DATE.todayIso();
  }

  function daysTogether(iso) {
    return DATE.daysTogether(iso);
  }

  function nextOccurrence(iso) {
    return DATE.nextAnniversary(iso);
  }

  function formatDate(iso) {
    return DATE.formatIso(iso, "dot");
  }

  function formatDateCn(iso) {
    return DATE.formatIso(iso, "cn");
  }

  /* ---------- Header ---------- */
  const header = $("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  const menuToggle = $("[data-menu-toggle]");
  const mobileMenu = $("[data-mobile-menu]");

  function setMenu(open) {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.inert = !open;
    document.body.classList.toggle("menu-open", open);
    if (open) {
      const first = $("a", mobileMenu);
      if (first) window.setTimeout(() => first.focus(), 120);
    }
  }

  if (mobileMenu) mobileMenu.inert = true;

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    $$("a", mobileMenu).forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuToggle.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1060) setMenu(false);
    }, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  let revealObserver = null;
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  }

  function observeReveals(scope = document) {
    $$(".reveal", scope).forEach((element) => {
      if (element.classList.contains("is-visible")) return;
      if (revealObserver) revealObserver.observe(element);
      else element.classList.add("is-visible");
    });
  }

  /* ---------- Petal canvas ---------- */
  function initPetals() {
    const canvas = $("[data-petals]");
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let petals = [];
    let raf = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makePetal(randomY) {
      const palette = ["234, 166, 183", "244, 196, 205", "222, 142, 163", "249, 216, 218"];
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -30 - Math.random() * 120,
        size: 5 + Math.random() * 8,
        speed: 0.18 + Math.random() * 0.34,
        drift: -0.2 + Math.random() * 0.4,
        sway: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        spin: -0.003 + Math.random() * 0.006,
        alpha: 0.18 + Math.random() * 0.3,
        color: palette[Math.floor(Math.random() * palette.length)]
      };
    }

    function reset() {
      petals = Array.from({ length: Math.min(26, Math.max(12, Math.floor(width / 55))) }, () => makePetal(true));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      petals.forEach((petal) => {
        petal.phase += 0.012;
        petal.y += petal.speed;
        petal.x += petal.drift + Math.sin(petal.phase) * petal.sway * 0.35;
        petal.rotation += petal.spin;
        if (petal.y > height + 40 || petal.x < -60 || petal.x > width + 60) {
          Object.assign(petal, makePetal(false), { x: Math.random() * width });
        }
        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate(petal.rotation);
        ctx.beginPath();
        ctx.moveTo(0, -petal.size);
        ctx.bezierCurveTo(petal.size * 0.95, -petal.size * 0.2, petal.size * 0.62, petal.size, 0, petal.size * 0.72);
        ctx.bezierCurveTo(-petal.size * 0.62, petal.size, -petal.size * 0.95, -petal.size * 0.2, 0, -petal.size);
        ctx.fillStyle = `rgba(${petal.color}, ${petal.alpha})`;
        ctx.fill();
        ctx.restore();
      });
      raf = window.requestAnimationFrame(draw);
    }

    function start() {
      window.cancelAnimationFrame(raf);
      if (!document.hidden) raf = window.requestAnimationFrame(draw);
    }

    resize();
    reset();
    start();
    window.addEventListener("resize", () => {
      resize();
      reset();
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) window.cancelAnimationFrame(raf);
      else start();
    });
  }

  /* ---------- Photo wall ---------- */
  function photoCard(photo, index) {
    const ratio = /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(String(photo.ratio)) ? photo.ratio : "4 / 3";
    return `
      <article class="memory-card reveal" data-photo-tag="${escapeHTML(photo.tag || "")}" style="--reveal-delay:${Math.min(index * 0.045, 0.3)}s">
        <button class="memory-open" type="button" data-lightbox-index="${index}" aria-label="查看照片：${escapeHTML(photo.title)}">
          <div class="memory-media" style="aspect-ratio:${escapeHTML(ratio)}">
            <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt)}" loading="lazy" decoding="async">
            <span class="memory-tag">${escapeHTML(photo.tag || "SOMEDAY")}</span>
            <span class="memory-zoom" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.2" stroke="currentColor" stroke-width="1.3"/><path d="M10.2 10.2 14 14M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            </span>
          </div>
          <div class="memory-meta">
            <div class="memory-meta__top">
              <span>${String(index + 1).padStart(2, "0")} / ${escapeHTML(photo.tag || "memory")}</span>
              <span>${escapeHTML(photo.meta || "SOMEDAY")}</span>
            </div>
            <h3>${escapeHTML(photo.title)}</h3>
            <p>${escapeHTML(photo.note || "")}</p>
          </div>
        </button>
      </article>`;
  }

  function blankCard(index) {
    return `
      <article class="memory-card memory-card--blank reveal" data-photo-tag="__blank" style="--reveal-delay:${Math.min(index * 0.05, 0.25)}s">
        <div class="blank-frame">
          <span class="blank-frame__plus" aria-hidden="true">+</span>
          <p>这一格，留给我们的第一张合照。</p>
          <small>Photo no. ${String(index + 1).padStart(2, "0")} · waiting for you</small>
        </div>
      </article>`;
  }

  function renderPhotoWalls() {
    $$("[data-photo-wall]").forEach((wall) => {
      const limit = Number(wall.dataset.limit || PHOTOS.length);
      const visible = PHOTOS.slice(0, Math.max(0, limit));
      const blanks = Number(wall.dataset.blank || 0);
      wall.innerHTML = visible.map(photoCard).join("") +
        Array.from({ length: blanks }, (_, index) => blankCard(visible.length + index)).join("");
      observeReveals(wall);
    });
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    if (PHOTOS.length === 0) return;
    let dialog = null;
    let index = 0;

    function build() {
      dialog = document.createElement("dialog");
      dialog.className = "lightbox";
      dialog.setAttribute("aria-label", "照片查看器");
      dialog.innerHTML = `
        <div class="lightbox__frame">
          <button class="modal-close lightbox__close" type="button" data-lightbox-close aria-label="关闭照片">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
          <div class="lightbox__img-wrap"><img alt=""></div>
          <div class="lightbox__bar">
            <div class="lightbox__info">
              <p class="kicker" data-lightbox-meta></p>
              <h3 data-lightbox-title></h3>
              <p data-lightbox-note></p>
            </div>
            <div class="lightbox__nav">
              <button class="lightbox__arrow" type="button" data-lightbox-prev aria-label="上一张">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <span class="lightbox__count" data-lightbox-count></span>
              <button class="lightbox__arrow" type="button" data-lightbox-next aria-label="下一张">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(dialog);

      $("[data-lightbox-close]", dialog).addEventListener("click", () => dialog.close());
      $("[data-lightbox-prev]", dialog).addEventListener("click", () => show(index - 1));
      $("[data-lightbox-next]", dialog).addEventListener("click", () => show(index + 1));
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") show(index - 1);
        if (event.key === "ArrowRight") show(index + 1);
      });
      dialog.addEventListener("close", () => document.body.classList.remove("modal-open"));
      dialog.addEventListener("cancel", () => document.body.classList.remove("modal-open"));
    }

    function show(nextIndex) {
      if (!dialog) build();
      index = (nextIndex + PHOTOS.length) % PHOTOS.length;
      const photo = PHOTOS[index];
      const image = $(".lightbox__img-wrap img", dialog);
      image.src = photo.src;
      image.alt = photo.alt;
      $("[data-lightbox-meta]", dialog).textContent = photo.meta || "SOMEDAY · MEMORY";
      $("[data-lightbox-title]", dialog).textContent = photo.title;
      $("[data-lightbox-note]", dialog).textContent = photo.note || "";
      $("[data-lightbox-count]", dialog).textContent = `${String(index + 1).padStart(2, "0")} / ${String(PHOTOS.length).padStart(2, "0")}`;
      if (!dialog.open) {
        dialog.showModal();
        document.body.classList.add("modal-open");
      }
    }

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-lightbox-index]");
      if (!trigger) return;
      show(Number(trigger.dataset.lightboxIndex));
    });
  }

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(message, duration = 2600) {
    let element = $("#dml-toast");
    if (!element) {
      element = document.createElement("div");
      element.id = "dml-toast";
      element.className = "toast";
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
      document.body.appendChild(element);
    }
    element.textContent = message;
    window.clearTimeout(toastTimer);
    window.requestAnimationFrame(() => element.classList.add("is-visible"));
    toastTimer = window.setTimeout(() => element.classList.remove("is-visible"), duration);
  }

  /* ---------- Celebration ---------- */
  function celebrationDateLabel(iso) {
    if (!iso) return "20__ . __ . __";
    return formatDate(iso);
  }

  function celebrate(options = {}) {
    const anniversary = options.date ?? SITE.anniversary ?? null;
    const next = nextOccurrence(anniversary);
    const days = anniversary ? daysTogether(anniversary) : null;
    const dateLabel = celebrationDateLabel(anniversary);
    const title = options.title || (anniversary
      ? (next?.isToday ? "今天，<em>就是我们的纪念日。</em>" : "把这一天，<em>过成我们的节日。</em>")
      : "等这一天，<em>有一个名字。</em>");
    const text = options.text || (anniversary
      ? `纪念日被写进了日历，也写进了我们之后每一年的期待里。${days && days > 0 ? `今天是我们一起走过的第 ${days} 天。` : ""}`
      : "纪念日还没有答案也没关系。先看看它那天的样子——有花、有光、有两个终于站在一起的人。");
    const countLabel = next
      ? next.needsPolicy
        ? "闰日规则待确认"
        : next.isToday
          ? "就是今天"
          : next.days > 0
            ? `还有 <strong>${next.days}</strong> 天`
            : "即将到来"
      : "等待被命名";

    const dialog = document.createElement("dialog");
    dialog.className = "celebration-dialog";
    dialog.setAttribute("aria-label", "纪念日动画预览");

    const petals = Array.from({ length: 32 }, (_, index) => {
      const left = (index * 37 + Math.random() * 8) % 100;
      const drift = -70 + Math.random() * 140;
      const duration = 7 + Math.random() * 7;
      const delay = -Math.random() * 9;
      const palette = ["rgba(255, 195, 208, .78)", "rgba(250, 223, 203, .7)", "rgba(235, 162, 181, .8)", "rgba(255, 238, 232, .6)"];
      return `<span class="celebration-petal" style="--left:${left}%;--drift:${drift}px;--dur:${duration}s;--delay:${delay}s;--w:${7 + Math.random() * 9}px;--h:${11 + Math.random() * 11}px;--color:${palette[index % palette.length]}"></span>`;
    }).join("");

    const confetti = Array.from({ length: 28 }, (_, index) => {
      const left = (index * 53 + Math.random() * 5) % 100;
      const drift = -50 + Math.random() * 100;
      const duration = 4.5 + Math.random() * 4;
      const delay = -Math.random() * 5;
      const palette = ["#edb3c2", "#f6d9c9", "#c98a9a", "#e7c9a2", "#fff7ef"];
      return `<span class="confetti-piece" style="--left:${left}%;--drift:${drift}px;--dur:${duration}s;--delay:${delay}s;--color:${palette[index % palette.length]}"></span>`;
    }).join("");

    dialog.innerHTML = `
      <div class="celebration-stage">
        <div class="celebration-particles" aria-hidden="true">${petals}${confetti}</div>
        <div class="celebration-card">
          <p class="kicker">${anniversary ? "A day of our own" : "To be written in our calendar"}</p>
          <div class="celebration-card__date">${anniversary ? escapeHTML(dateLabel) : "20__ . <em>__</em> . __"}</div>
          <div class="celebration-card__rule" aria-hidden="true">✦</div>
          <h2>${title}</h2>
          <p class="celebration-card__text">${text}</p>
          <div class="celebration-card__count">${countLabel}</div>
          <div>
            <button class="btn btn--primary" type="button" data-celebration-close>记住这一刻</button>
          </div>
          <button class="modal-close" type="button" data-celebration-close aria-label="关闭动画" style="position:absolute;top:18px;right:18px;z-index:4">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`;

    document.body.appendChild(dialog);
    dialog.querySelectorAll("[data-celebration-close]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
      dialog.remove();
    });
    dialog.showModal();
    document.body.classList.add("modal-open");
    if (window.DML && window.DML.audio && typeof window.DML.audio.chime === "function") {
      window.DML.audio.chime(7);
    }
  }

  /* ---------- Data bindings ---------- */
  function bindData() {
    $$("[data-bind='herName']").forEach((element) => {
      element.textContent = SITE.herName || "未来的你";
    });
    $$("[data-anniversary-label]").forEach((element) => {
      element.textContent = SITE.anniversary ? formatDateCn(SITE.anniversary) : "待你命名";
    });
    $$("[data-birthday-label]").forEach((element) => {
      element.textContent = SITE.birthday ? formatDateCn(SITE.birthday) : "等你告诉我";
    });
    $$("[data-days-number]").forEach((element) => {
      const days = daysTogether(SITE.anniversary);
      element.textContent = days && days > 0 ? (days > 999 ? String(days) : String(days).padStart(3, "0")) : "∞";
    });
    $$("[data-year]").forEach((element) => {
      element.textContent = DATE.todayIso().slice(0, 4);
    });
    const timeElement = $("[data-local-time]");
    if (timeElement) {
      const updateTime = () => {
        timeElement.textContent = DATE.formatTime();
      };
      updateTime();
      window.setInterval(updateTime, 30_000);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    initPetals();
    renderPhotoWalls();
    initLightbox();
    bindData();
    observeReveals();

    $$("[data-celebrate]").forEach((button) => {
      button.addEventListener("click", () => celebrate());
    });
  }

  window.DML = {
    config: CONFIG,
    site: SITE,
    photos: PHOTOS,
    $,
    $$,
    escapeHTML,
    safeStorage,
    toast,
    celebrate,
    observeReveals,
    renderPhotoWalls,
    formatDate,
    formatDateCn,
    daysTogether,
    nextOccurrence,
    todayInZone,
    dateUtils: DATE
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
