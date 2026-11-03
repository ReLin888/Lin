/* =========================================================
   Dear, My Love — our someday list
   A local-only checklist with filters, custom wishes,
   a random picker and a small completion celebration.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.DML_CONFIG || {};
  const wish = CONFIG.wishlist || {};
  const DML = window.DML || {};
  const list = document.querySelector("[data-wish-list]");
  if (!list) return;

  const CHECK_KEY = "dml:wishlist:checked:v1";
  const CUSTOM_KEY = "dml:wishlist:custom:v1";
  const TAGS = new Set(["日常", "远方", "仪式感", "有点傻"]);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const escape = DML.escapeHTML || ((value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;"));

  const baseItems = (Array.isArray(wish.items) ? wish.items : [])
    .map((item, index) => ({
      key: `base:${index}`,
      text: String(item.text || ""),
      note: String(item.note || ""),
      tag: TAGS.has(item.tag) ? item.tag : "日常",
      custom: false
    }))
    .filter((item) => item.text.trim() !== "");

  let checked = new Set();
  let custom = [];
  let filter = "all";
  let wasComplete = false;

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is optional; the list still works for this visit.
    }
  }

  checked = new Set(readJson(CHECK_KEY, []).map(String));
  custom = readJson(CUSTOM_KEY, [])
    .filter((item) => item && typeof item.text === "string" && item.text.trim() !== "")
    .map((item, index) => ({
      key: String(item.key || `custom:${index}`),
      text: item.text,
      note: String(item.note || ""),
      tag: TAGS.has(item.tag) ? item.tag : "日常",
      custom: true
    }));

  const els = {
    filters: Array.from(document.querySelectorAll("[data-wish-filter]")),
    progressLabel: document.querySelector("[data-wish-progress-label]"),
    progress: document.querySelector("[data-wish-progress]"),
    bar: document.querySelector("[data-wish-bar]"),
    visible: document.querySelector("[data-wish-visible]"),
    done: document.querySelector("[data-wish-done]"),
    complete: document.querySelector("[data-wish-complete]"),
    empty: document.querySelector("[data-wish-empty]"),
    next: document.querySelector("[data-wish-next]"),
    form: document.querySelector("[data-wish-form]"),
    input: document.querySelector("#wish-new")
  };

  function allItems() {
    return baseItems.concat(custom);
  }

  function rowMarkup(item, index) {
    const id = `wish-${index}`;
    const isChecked = checked.has(item.key);
    return `
      <div class="wish-item" data-key="${escape(item.key)}" data-tag="${escape(item.tag)}">
        <input class="wish-input" type="checkbox" id="${id}" data-wish-check${isChecked ? " checked" : ""}>
        <label class="wish-item__main" for="${id}">
          <span class="wish-box" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none"><path d="m3.4 8.4 3 3 6.2-6.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="wish-item__no" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <span class="wish-item__body">
            <span class="wish-item__title">${escape(item.text)}</span>
            ${item.note ? `<span class="wish-item__note">${escape(item.note)}</span>` : ""}
          </span>
          <span class="wish-item__tag">${escape(item.tag)}</span>
        </label>
        ${item.custom ? `
        <button class="wish-item__remove" type="button" data-wish-remove aria-label="移除这条心愿：${escape(item.text)}">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>` : ""}
      </div>`;
  }

  function applyFilter() {
    list.querySelectorAll(".wish-item").forEach((row) => {
      row.classList.toggle("is-filtered", filter !== "all" && row.dataset.tag !== filter);
    });
    els.filters.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.wishFilter === filter));
    });
  }

  function refresh() {
    const items = allItems();
    const total = items.length;
    const done = items.filter((item) => checked.has(item.key)).length;
    const visibleItems = items.filter((item) => filter === "all" || item.tag === filter);
    const visibleCount = visibleItems.length;
    const visibleDone = visibleItems.filter((item) => checked.has(item.key)).length;

    applyFilter();

    if (els.progressLabel) {
      els.progressLabel.textContent = `${String(done).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    }
    if (els.progress) {
      els.progress.setAttribute("aria-valuemax", String(total));
      els.progress.setAttribute("aria-valuenow", String(done));
    }
    if (els.bar) {
      const percent = total === 0 ? 0 : (done / total) * 100;
      els.bar.style.width = `${percent.toFixed(2)}%`;
    }
    if (els.visible) els.visible.textContent = String(visibleCount).padStart(2, "0");
    if (els.done) els.done.textContent = String(visibleDone);
    if (els.next) els.next.textContent = String(total + 1);
    if (els.empty) els.empty.hidden = visibleCount !== 0;
    if (els.complete) els.complete.hidden = !(total > 0 && done === total);

    return { total, done };
  }

  function render() {
    list.innerHTML = allItems().map(rowMarkup).join("");
    return refresh();
  }

  function celebrate() {
    if (reduceMotion) return;
    const palette = ["#edb3c2", "#f6d9c9", "#c98a9a", "#e7c9a2", "#fff7ef"];
    for (let index = 0; index < 34; index += 1) {
      const piece = document.createElement("span");
      piece.className = "wish-confetti";
      piece.style.setProperty("--left", `${Math.random() * 100}%`);
      piece.style.setProperty("--drift", `${-60 + Math.random() * 120}px`);
      piece.style.setProperty("--dur", `${3.6 + Math.random() * 3.2}s`);
      piece.style.setProperty("--delay", `${Math.random() * 0.5}s`);
      piece.style.setProperty("--color", palette[index % palette.length]);
      document.body.appendChild(piece);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
      window.setTimeout(() => piece.remove(), 8200);
    }
    if (DML.audio && typeof DML.audio.chime === "function") {
      [0, 2, 4, 7].forEach((step, index) => {
        window.setTimeout(() => DML.audio.chime(step + 4), index * 110);
      });
    }
  }

  function isComplete() {
    const items = allItems();
    return items.length > 0 && items.every((item) => checked.has(item.key));
  }

  list.addEventListener("change", (event) => {
    const input = event.target.closest("[data-wish-check]");
    if (!input) return;
    const row = input.closest(".wish-item");
    const key = row ? row.dataset.key : null;
    if (!key) return;

    if (input.checked) checked.add(key);
    else checked.delete(key);
    writeJson(CHECK_KEY, [...checked]);

    const wasDone = wasComplete;
    refresh();
    wasComplete = isComplete();

    if (input.checked) {
      if (DML.audio && typeof DML.audio.chime === "function") {
        DML.audio.chime(checked.size + 2);
      }
      if (wasComplete && !wasDone) {
        celebrate();
        if (DML.toast) DML.toast("第一份清单，被我们一起划完了。");
      }
    }
  });

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-wish-remove]");
    if (!button) return;
    const row = button.closest(".wish-item");
    const key = row ? row.dataset.key : null;
    if (!key) return;
    custom = custom.filter((item) => item.key !== key);
    checked.delete(key);
    writeJson(CUSTOM_KEY, custom);
    writeJson(CHECK_KEY, [...checked]);
    render();
    wasComplete = isComplete();
    if (DML.toast) DML.toast("已经从那件心愿里拿出来了。");
  });

  els.filters.forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.wishFilter || "all";
      refresh();
    });
  });

  function pickRandom() {
    const items = allItems();
    if (items.length === 0) return;
    const candidates = items.filter((item) => !checked.has(item.key));
    if (candidates.length === 0) {
      if (DML.toast) DML.toast("整份清单都被划完了。厉害。");
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (filter !== "all") {
      filter = "all";
      refresh();
    }
    const row = Array.from(list.querySelectorAll(".wish-item"))
      .find((element) => element.dataset.key === pick.key);
    if (row) {
      row.classList.remove("is-picked");
      void row.offsetWidth;
      row.classList.add("is-picked");
      row.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => row.classList.remove("is-picked"), 2100);
    }
    if (DML.toast) DML.toast(`就这件吧：${pick.text}`);
  }

  document.querySelectorAll("[data-wish-random]").forEach((button) => {
    button.addEventListener("click", pickRandom);
  });

  const resetButton = document.querySelector("[data-wish-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (checked.size === 0) {
        if (DML.toast) DML.toast("还没有勾选任何一件。");
        return;
      }
      const confirmed = window.confirm("清空所有勾选？写下的心愿会保留。");
      if (!confirmed) return;
      checked.clear();
      writeJson(CHECK_KEY, []);
      render();
      wasComplete = false;
      if (DML.toast) DML.toast("清单清空了，可以重新开始。");
    });
  }

  if (els.form) {
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(els.form);
      const text = String(data.get("wish") || "").trim();
      const tag = String(data.get("tag") || "日常");
      if (text === "") {
        if (DML.toast) DML.toast("写一句吧，哪怕只是很小的一件事。");
        return;
      }
      if (allItems().some((item) => item.text === text)) {
        if (DML.toast) DML.toast("这件事已经在清单里了。");
        return;
      }
      custom.push({
        key: `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        text,
        note: "",
        tag: TAGS.has(tag) ? tag : "日常",
        custom: true
      });
      writeJson(CUSTOM_KEY, custom);
      els.form.reset();
      filter = "all";
      render();
      wasComplete = isComplete();
      if (DML.toast) DML.toast("已经写进清单了。");
      if (els.input) els.input.focus();
    });
  }

  document.querySelectorAll("[data-wish-after]").forEach((button) => {
    button.addEventListener("click", () => {
      if (els.input) {
        els.input.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        els.input.focus({ preventScroll: true });
      }
    });
  });

  render();
  wasComplete = isComplete();
})();
