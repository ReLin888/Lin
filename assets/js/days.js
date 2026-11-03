/* =========================================================
   Dear, My Love — our days
   Countdowns, calendar plate, daily love note and preview.
   ========================================================= */
(function () {
  "use strict";

  const config = window.DML_CONFIG || {};
  const site = config.site || {};
  const DML = window.DML || {};
  const DATE = window.DMLDate;
  if (!DATE) throw new Error("DMLDate is required; load assets/js/date-utils.js before days.js");
  let timer = 0;

  function pad(value) {
    return String(Math.max(0, value)).padStart(2, "0");
  }

  function remainingCopy(remaining) {
    if (remaining.isToday) return "就是今天";
    if (remaining.days > 0) {
      return `还有 ${remaining.days} 天${remaining.hours > 0 ? ` ${remaining.hours} 小时` : ""}`;
    }
    if (remaining.hours > 0) return `还有 ${remaining.hours} 小时 ${remaining.minutes} 分`;
    if (remaining.minutes > 0) return `还有 ${remaining.minutes} 分钟`;
    if (remaining.seconds > 0) return `还有 ${remaining.seconds} 秒`;
    return "即将到来";
  }

  function setCountdown(kind, iso) {
    const group = document.querySelector(`[data-countdown="${kind}"]`);
    const card = document.querySelector(`[data-countdown-card="${kind}"]`);
    if (!group) return;
    const note = card ? card.querySelector(`[data-${kind}-note]`) ?? card.querySelector(".countdown-card__head span:last-child") : null;
    const cells = {
      days: group.querySelector("[data-countdown-days]"),
      hours: group.querySelector("[data-countdown-hours]"),
      minutes: group.querySelector("[data-countdown-minutes]"),
      seconds: group.querySelector("[data-countdown-seconds]")
    };

    if (!iso) {
      Object.values(cells).forEach((cell) => { if (cell) cell.textContent = "—"; });
      if (card) card.classList.add("is-pending");
      if (note) note.textContent = kind === "anniversary" ? "那一天待命名" : "等你告诉我";
      return;
    }

    const next = kind === "birthday" ? DATE.nextBirthday(iso) : DATE.nextAnniversary(iso);
    if (!next) return;
    if (next.needsPolicy) {
      Object.values(cells).forEach((cell) => { if (cell) cell.textContent = "—"; });
      if (card) card.classList.add("is-pending");
      if (note) note.textContent = "2 月 29 日 · 闰年规则待确认";
      return;
    }
    if (card) card.classList.remove("is-pending");
    const remaining = DATE.remainingUntil(next.targetIso);
    if (!remaining) return;
    if (remaining.isToday) {
      Object.values(cells).forEach((cell) => { if (cell) cell.textContent = "00"; });
      if (note) note.textContent = "就是今天";
      return;
    }
    if (cells.days) cells.days.textContent = String(remaining.days).padStart(2, "0");
    if (cells.hours) cells.hours.textContent = pad(remaining.hours);
    if (cells.minutes) cells.minutes.textContent = pad(remaining.minutes);
    if (cells.seconds) cells.seconds.textContent = pad(remaining.seconds);
    if (note) note.textContent = remainingCopy(remaining);
  }

  function updateCalendar() {
    const year = document.querySelector("[data-calendar-year]");
    const day = document.querySelector("[data-calendar-day]");
    const month = document.querySelector("[data-calendar-month]");
    const caption = document.querySelector("[data-calendar-caption]");
    if (!site.anniversary) return;
    const next = DATE.nextAnniversary(site.anniversary);
    if (!next) return;
    if (next.needsPolicy) {
      if (caption) caption.textContent = "2 月 29 日 · 闰年规则待确认";
      return;
    }
    const target = next.target;
    if (year) year.textContent = String(target.year);
    if (day) day.textContent = String(target.day).padStart(2, "0");
    if (month) month.innerHTML = `${target.month} 月<br>我们的纪念日`;
    if (caption) {
      const remaining = DATE.remainingUntil(next.targetIso);
      caption.textContent = remaining?.isToday
        ? "就是今天"
        : remaining
          ? remainingCopy(remaining).replace("还有", "距离这一天")
          : "";
    }
  }

  function updateDaysCaption() {
    const caption = document.querySelector("[data-days-caption]");
    if (!caption || !site.anniversary) return;
    const days = DML.daysTogether ? DML.daysTogether(site.anniversary) : null;
    if (days && days > 0) {
      caption.textContent = `从 ${site.anniversary.replaceAll("-", ".")} 开始，这是我们一起走过的第 ${days} 天。以后还会有很多很多天。`;
    }
  }

  function updateBirthdayWish() {
    const wish = document.querySelector("[data-birthday-wish]");
    if (!wish) return;
    wish.hidden = !(site.birthday && DATE.isBirthdayToday(site.birthday));
  }

  function updateAll() {
    setCountdown("anniversary", site.anniversary);
    setCountdown("birthday", site.birthday);
    updateCalendar();
    updateDaysCaption();
    updateBirthdayWish();
  }

  function initLoveNote() {
    const notes = Array.isArray(site.loveNotes) ? site.loveNotes.filter((note) => typeof note === "string" && note.trim() !== "") : [];
    if (notes.length === 0) return;
    const index = DATE.dayOfYear(DATE.todayIso()) % notes.length;
    const quote = document.querySelector("[data-love-note]");
    const label = document.querySelector("[data-love-note-index]");
    if (quote) quote.textContent = `“${notes[index]}”`;
    if (label) label.textContent = `NO. ${String(index + 1).padStart(2, "0")} / ${String(notes.length).padStart(2, "0")}`;
  }

  const previewForm = document.querySelector("[data-date-preview]");
  if (previewForm) {
    previewForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = previewForm.querySelector("input[type='date']");
      const value = input ? input.value : "";
      if (!value) {
        if (DML.toast) DML.toast("先选一个日子，再预览。");
        return;
      }
      if (DML.celebrate) {
        DML.celebrate({
          date: value,
          title: "预览 · <em>属于我们的这一天。</em>",
          text: "这是一次只存在于此刻的预览。等那一天真的到来，我会把它写进日历，也写进我们的生活。"
        });
      }
    });
  }

  // If today is the configured anniversary in Beijing, play once per tab/day.
  const today = DATE.todayIso();
  if (DATE.isAnniversaryToday(site.anniversary)) {
    try {
      const celebrationKey = `dml:anniversary-celebrated:${today}`;
      if (window.sessionStorage.getItem(celebrationKey) !== "true") {
        window.sessionStorage.setItem(celebrationKey, "true");
        window.setTimeout(() => {
          if (DML.celebrate) DML.celebrate({ title: "今天，<em>就是我们的纪念日。</em>" });
        }, 1600);
      }
    } catch {
      // Session storage is optional.
    }
  }

  updateAll();
  initLoveNote();
  timer = window.setInterval(updateAll, 1000);
  window.addEventListener("pagehide", () => window.clearInterval(timer));
})();
