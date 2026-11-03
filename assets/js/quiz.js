/* =========================================================
   Dear, My Love — the little quiz
   One question at a time, immediate feedback, a local best score.
   ========================================================= */
(function () {
  "use strict";

  const CONFIG = window.DML_CONFIG || {};
  const quiz = CONFIG.quiz || {};
  const DML = window.DML || {};
  const shell = document.querySelector(".quiz-shell");
  if (!shell) return;

  const escape = DML.escapeHTML || ((value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;"));

  const QUESTIONS = (Array.isArray(quiz.questions) ? quiz.questions : []).filter((item) => (
    item &&
    typeof item.question === "string" &&
    Array.isArray(item.options) &&
    item.options.length >= 2 &&
    Number.isInteger(item.answer) &&
    item.answer >= 0 &&
    item.answer < item.options.length
  ));

  const TOTAL = QUESTIONS.length;
  const RESULTS = (Array.isArray(quiz.results) ? quiz.results : [])
    .slice()
    .sort((a, b) => Number(b.min || 0) - Number(a.min || 0));
  const BEST_KEY = "dml:quiz:best:v1";
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHECK_ICON = '<svg viewBox="0 0 16 16" fill="none"><path d="m3.2 8.4 3.2 3.2 6.4-6.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CROSS_ICON = '<svg viewBox="0 0 16 16" fill="none"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const els = {
    questionStage: document.querySelector("[data-quiz-question-stage]"),
    result: document.querySelector("[data-quiz-result]"),
    text: document.querySelector("[data-quiz-text]"),
    number: document.querySelector("[data-quiz-number]"),
    options: document.querySelector("[data-quiz-options]"),
    feedback: document.querySelector("[data-quiz-feedback]"),
    verdict: document.querySelector("[data-quiz-verdict]"),
    note: document.querySelector("[data-quiz-note]"),
    next: document.querySelector("[data-quiz-next]"),
    stepLabel: document.querySelector("[data-quiz-step-label]"),
    bar: document.querySelector("[data-quiz-bar]"),
    progress: document.querySelector("[data-quiz-progress]"),
    restart: document.querySelector("[data-quiz-restart]"),
    again: document.querySelector("[data-quiz-again]"),
    score: document.querySelector("[data-quiz-score]"),
    total: document.querySelector("[data-quiz-total]"),
    resultTitle: document.querySelector("[data-quiz-result-title]"),
    resultText: document.querySelector("[data-quiz-result-text]"),
    petals: document.querySelector("[data-quiz-petals]"),
    bestInline: document.querySelector("[data-quiz-best-inline]")
  };

  if (TOTAL === 0) {
    shell.hidden = true;
    return;
  }

  let index = 0;
  let score = 0;
  let answered = false;
  let best = 0;
  let hasBest = false;

  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        best = Math.max(0, Math.min(TOTAL, Math.floor(parsed)));
        hasBest = true;
      }
    }
  } catch {
    hasBest = false;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function setProgress(value) {
    const percent = Math.min(100, Math.max(0, (value / TOTAL) * 100));
    if (els.bar) els.bar.style.width = `${percent.toFixed(2)}%`;
    if (els.progress) {
      els.progress.setAttribute("aria-valuemax", String(TOTAL));
      els.progress.setAttribute("aria-valuenow", String(value));
    }
  }

  function bestLabel(empty) {
    return hasBest ? `${best} / ${TOTAL}` : empty;
  }

  function setBestLabels() {
    document.querySelectorAll("[data-quiz-best]").forEach((element) => {
      element.textContent = bestLabel("—");
    });
    if (els.bestInline) els.bestInline.textContent = bestLabel("还没答过");
    document.querySelectorAll("[data-quiz-count]").forEach((element) => {
      element.textContent = pad(TOTAL);
    });
    if (els.total) els.total.textContent = pad(TOTAL);
  }

  function renderQuestion() {
    answered = false;
    const question = QUESTIONS[index];
    if (!question) return;

    if (els.text) els.text.textContent = question.question;
    if (els.number) els.number.textContent = pad(index + 1);
    if (els.stepLabel) els.stepLabel.textContent = `${pad(index + 1)} / ${pad(TOTAL)}`;

    if (els.options) {
      els.options.innerHTML = question.options.map((option, optionIndex) => `
        <button class="quiz-option" type="button" data-quiz-option="${optionIndex}">
          <span class="quiz-option__key" aria-hidden="true">${LETTERS[optionIndex] || optionIndex + 1}</span>
          <span class="quiz-option__text">${escape(option)}</span>
          <span class="quiz-option__mark" aria-hidden="true"></span>
        </button>`).join("");
    }

    if (els.feedback) {
      els.feedback.hidden = true;
      els.feedback.className = "quiz-feedback";
    }
    if (els.verdict) els.verdict.textContent = "";
    if (els.note) els.note.textContent = "";
    if (els.next) els.next.textContent = index === TOTAL - 1 ? "看结果" : "下一题";

    setProgress(index);
  }

  function chime(step) {
    if (DML.audio && typeof DML.audio.chime === "function") DML.audio.chime(step);
  }

  function select(optionIndex) {
    const question = QUESTIONS[index];
    if (answered || !question) return;
    answered = true;

    const correct = optionIndex === question.answer;
    if (correct) score += 1;

    if (els.options) {
      const buttons = Array.from(els.options.querySelectorAll(".quiz-option"));
      buttons.forEach((button, buttonIndex) => {
        button.disabled = true;
        const mark = button.querySelector(".quiz-option__mark");
        if (buttonIndex === question.answer) {
          button.classList.add("is-correct");
          if (mark) mark.innerHTML = CHECK_ICON;
        } else if (buttonIndex === optionIndex) {
          button.classList.add("is-wrong");
          if (mark) mark.innerHTML = CROSS_ICON;
        } else {
          button.classList.add("is-dimmed");
        }
      });
    }

    if (els.verdict) {
      els.verdict.textContent = correct
        ? "答对了。"
        : `答错了。正确答案是 ${LETTERS[question.answer] || question.answer + 1}。`;
    }
    if (els.note) els.note.textContent = question.note || "";
    if (els.feedback) {
      els.feedback.hidden = false;
      els.feedback.classList.add(correct ? "is-good" : "is-bad");
    }
    if (els.next) els.next.focus({ preventScroll: true });

    chime(correct ? 6 : 1);
  }

  function seedPetals() {
    if (!els.petals || reduceMotion) return;
    const palette = ["rgba(226,150,169,.5)", "rgba(243,203,212,.55)", "rgba(233,174,189,.45)"];
    els.petals.innerHTML = Array.from({ length: 20 }, (_, petalIndex) => {
      const left = (petalIndex * 43 + Math.random() * 6) % 100;
      const drift = -50 + Math.random() * 100;
      const duration = 6 + Math.random() * 4;
      const delay = -Math.random() * 6;
      return `<span class="quiz-petal" style="--left:${left}%;--drift:${drift}px;--dur:${duration}s;--delay:${delay}s;background:${palette[petalIndex % palette.length]}"></span>`;
    }).join("");
    window.setTimeout(() => {
      if (els.petals) els.petals.innerHTML = "";
    }, 14000);
  }

  function showResult() {
    if (els.questionStage) els.questionStage.hidden = true;
    if (els.result) els.result.hidden = false;
    if (els.stepLabel) els.stepLabel.textContent = `${pad(TOTAL)} / ${pad(TOTAL)}`;
    setProgress(TOTAL);

    if (els.score) els.score.textContent = String(score);

    const result = RESULTS.find((item) => score >= Number(item.min || 0)) || RESULTS[RESULTS.length - 1];
    if (els.resultTitle) els.resultTitle.textContent = result ? result.title : "";
    if (els.resultText) els.resultText.textContent = result ? result.text : "";

    if (!hasBest || score > best) {
      best = score;
      hasBest = true;
      try {
        window.localStorage.setItem(BEST_KEY, String(best));
      } catch {
        // Storage is optional.
      }
    }
    setBestLabels();

    if (els.restart) els.restart.hidden = false;
    seedPetals();
    chime(7);
    if (els.resultTitle) els.resultTitle.focus({ preventScroll: true });
  }

  function restart() {
    index = 0;
    score = 0;
    answered = false;
    if (els.result) els.result.hidden = true;
    if (els.questionStage) els.questionStage.hidden = false;
    if (els.restart) els.restart.hidden = true;
    renderQuestion();
    if (els.text) els.text.focus({ preventScroll: true });
  }

  if (els.options) {
    els.options.addEventListener("click", (event) => {
      const button = event.target.closest("[data-quiz-option]");
      if (!button) return;
      select(Number(button.dataset.quizOption));
    });
  }

  if (els.next) {
    els.next.addEventListener("click", () => {
      if (index < TOTAL - 1) {
        index += 1;
        renderQuestion();
        if (els.text) els.text.focus({ preventScroll: true });
      } else {
        showResult();
      }
    });
  }

  if (els.restart) els.restart.addEventListener("click", restart);
  if (els.again) els.again.addEventListener("click", restart);

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (els.result && els.result.hidden === false) return;
    if (answered) return;
    const active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;

    const map = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
    const target = map[event.key.toLowerCase()];
    if (target === undefined) return;
    if (target >= QUESTIONS[index].options.length) return;
    event.preventDefault();
    select(target);
  });

  setBestLabels();
  renderQuestion();
})();
