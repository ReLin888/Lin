/* =========================================================
   Dear, My Love — photo wall filters
   ========================================================= */
(function () {
  "use strict";

  const wall = document.querySelector("[data-photo-wall]");
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const counts = Array.from(document.querySelectorAll("[data-gallery-count]"));
  const totalLabel = document.querySelector("[data-gallery-total]");
  const config = window.DML_CONFIG || {};
  const photos = Array.isArray(config.photos) ? config.photos : [];

  if (totalLabel) totalLabel.textContent = String(photos.length + 2).padStart(2, "0");

  if (!wall || filters.length === 0) return;

  function applyFilter(filter, activeButton) {
    filters.forEach((button) => {
      const selected = button === activeButton;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-active", selected);
    });

    let visible = 0;
    wall.querySelectorAll(".memory-card").forEach((card) => {
      const tag = card.dataset.photoTag || "";
      const show = filter === "all" || tag === filter;
      card.classList.toggle("is-filtered", !show);
      if (show && tag !== "__blank") visible += 1;
    });

    counts.forEach((element) => {
      element.textContent = String(visible).padStart(2, "0");
    });
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => applyFilter(button.dataset.filter, button));
  });

  applyFilter("all", filters[0]);
})();
