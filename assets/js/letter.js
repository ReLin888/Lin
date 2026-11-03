/* =========================================================
   Dear, My Love — the letter room
   Envelope, tabs, pager and a local-only reply drawer.
   ========================================================= */
(function () {
  "use strict";

  const config = window.DML_CONFIG || {};
  const site = config.site || {};
  const DML = window.DML || {};
  const stage = document.querySelector("[data-letter-envelope-stage]");
  const openButton = document.querySelector("[data-open-letter]");
  const tabs = Array.from(document.querySelectorAll("[data-letter-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-letter-panel]"));
  const count = document.querySelector("[data-letter-count]");
  const prev = document.querySelector("[data-letter-prev]");
  const next = document.querySelector("[data-letter-next]");
  let active = 0;

  const dateText = site.letterDate || "20__ · 某一天";
  document.querySelectorAll("[data-letter-date]").forEach((element) => {
    element.textContent = dateText;
  });
  document.querySelectorAll("[data-signature]").forEach((element) => {
    element.textContent = site.signature || "爱你的男孩";
  });

  function openEnvelope() {
    if (!stage) return;
    const alreadyOpen = stage.classList.contains("is-open");
    stage.classList.add("is-open");
    const hint = document.querySelector(".letter-envelope-hint");
    if (hint) hint.textContent = "信已拆开 · 慢慢读";
    if (!alreadyOpen) {
      window.setTimeout(() => {
        const target = document.querySelector("#the-letter");
        if (target) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
      }, 640);
    }
  }

  if (openButton) openButton.addEventListener("click", openEnvelope);

  function showPanel(index, focusTab = false) {
    if (panels.length === 0) return;
    active = (index + panels.length) % panels.length;
    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === active;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    panels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== active;
    });
    if (count) count.textContent = `${String(active + 1).padStart(2, "0")} / ${String(panels.length).padStart(2, "0")}`;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showPanel(index));
    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        showPanel(index + 1, true);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        showPanel(index - 1, true);
      }
      if (event.key === "Home") {
        event.preventDefault();
        showPanel(0, true);
      }
      if (event.key === "End") {
        event.preventDefault();
        showPanel(panels.length - 1, true);
      }
    });
  });

  if (prev) prev.addEventListener("click", () => showPanel(active - 1));
  if (next) next.addEventListener("click", () => showPanel(active + 1));
  showPanel(0);

  /* ---------- Local reply drawer ---------- */
  const form = document.querySelector("[data-reply-form]");
  const saved = document.querySelector("[data-reply-saved]");
  const savedText = document.querySelector("[data-reply-saved-text]");
  const savedSign = document.querySelector("[data-reply-saved-sign]");
  const editButton = document.querySelector("[data-reply-edit]");
  const STORAGE_KEY = "dml:reply";

  function readReply() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data.message !== "string" || data.message.trim() === "") return null;
      return data;
    } catch {
      return null;
    }
  }

  function showSaved(reply) {
    if (!form || !saved || !savedText) return;
    form.hidden = true;
    saved.hidden = false;
    savedText.textContent = reply.message;
    if (savedSign) savedSign.textContent = `—— ${reply.name || "未来的你"}`;
  }

  function showForm() {
    if (!form || !saved) return;
    saved.hidden = true;
    form.hidden = false;
    const name = form.querySelector("[name='name']");
    const message = form.querySelector("[name='message']");
    if (name) name.focus();
    if (message) message.value = "";
  }

  const existing = readReply();
  if (existing) showSaved(existing);

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const message = String(data.get("message") || "").trim();
      const name = String(data.get("name") || "").trim();
      if (message.length === 0) {
        if (DML.toast) DML.toast("回信还是空白的。写一句也好。");
        return;
      }
      const reply = { name, message, at: new Date().toISOString() };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reply));
      } catch {
        if (DML.toast) DML.toast("浏览器暂时不让我保存，可能是隐私模式。");
        return;
      }
      showSaved(reply);
      if (DML.toast) DML.toast("回信已收好，就放在这台设备里。");
      if (window.DML.audio && typeof window.DML.audio.chime === "function") window.DML.audio.chime(5);
    });
  }

  if (editButton) {
    editButton.addEventListener("click", () => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage is optional.
      }
      showForm();
    });
  }
})();
