import { chapters, questionBank } from "./questions.js";
import { resetQuestionHistory, selectBalancedQuestions, shuffle } from "./quizLogic.js";

const app = document.querySelector("#app");
const bankSummary = document.querySelector("#bank-summary");
const HISTORY_KEY = "marketing-mcq-history-v2";

const state = {
  view: "home",
  selectedChapters: chapters.map((chapter) => chapter.number),
  countMode: "10",
  customCount: 10,
  quiz: [],
  current: 0,
  score: 0,
  answeredCount: 0,
  selectedId: null,
  submitted: false,
  mistakes: [],
};

bankSummary.textContent = `${questionBank.length} questions · ${chapters.length} chapters`;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getChapterTitle(chapterNumber) {
  return chapters.find((chapter) => chapter.number === Number(chapterNumber))?.title ?? "Marketing";
}

function getChapterPool(chapterNumber) {
  return questionBank.filter((question) => Number(question.chapter) === Number(chapterNumber));
}

function getEligibleCount() {
  return state.selectedChapters.reduce((total, chapter) => total + getChapterPool(chapter).length, 0);
}

function getEncounteredCount() {
  const history = readHistory();
  return state.selectedChapters.reduce((total, chapter) => {
    const ids = Array.isArray(history[chapter]) ? new Set(history[chapter]) : new Set();
    return total + ids.size;
  }, 0);
}

function getRequestedCount() {
  return state.countMode === "custom" ? Number(state.customCount) : Number(state.countMode);
}

function readHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Quota or privacy-mode failures should not prevent quiz practice.
  }
}

function prepareQuestion(question) {
  return { ...question, options: shuffle(question.options) };
}

function render() {
  if (state.view === "home") renderHome();
  if (state.view === "quiz") renderQuiz();
  if (state.view === "results") renderResults();
}

function renderHome() {
  const eligibleCount = getEligibleCount();
  const requestedCount = getRequestedCount();
  const allSelected = state.selectedChapters.length === chapters.length;
  const validCount = eligibleCount > 0 && requestedCount >= 1 && requestedCount <= eligibleCount;

  app.innerHTML = `
    <section class="hero home-hero">
      <div>
        <p class="eyebrow">The Modern Marketing Playbook · Study mode</p>
        <h2>Marketing MCQ Practice</h2>
        <p>Build understanding chapter by chapter with textbook-grounded questions, careful feedback, and printed page references.</p>
      </div>
      <div class="hero-mark" aria-hidden="true">M</div>
    </section>
    <div class="study-metrics" aria-label="Question bank summary">
      <div class="metric"><strong>${chapters.length}</strong><span>Chapters</span></div>
      <div class="metric"><strong>${questionBank.length}</strong><span>Questions</span></div>
      <div class="metric"><strong>${getEncounteredCount()} / ${eligibleCount}</strong><span>Selected questions encountered</span></div>
    </div>
    <section class="setup-grid" aria-label="Quiz setup">
      <div class="card setup-card">
        <div class="field setup-field">
          <div class="section-heading">
            <span class="section-number">01</span>
            <div><h3>Select chapters</h3><p>Choose the chapters you want to include.</p></div>
          </div>
          <div class="chapter-actions">
            <label class="select-all-row"><input id="select-all" type="checkbox" ${allSelected ? "checked" : ""} /> <span>Select All</span></label>
            <span class="field-help">${state.selectedChapters.length} of ${chapters.length} selected</span>
          </div>
          <div class="chapter-list" aria-label="Textbook chapters">
            ${chapters.map((chapter) => `
              <label class="chapter-check">
                <input type="checkbox" data-chapter="${chapter.number}" ${state.selectedChapters.includes(chapter.number) ? "checked" : ""} />
                <span><strong>Chapter ${chapter.number}</strong><span> — ${escapeHtml(chapter.title)}</span><small>${getChapterPool(chapter.number).length} questions currently available</small></span>
              </label>`).join("")}
          </div>
          <p class="selection-summary">${state.selectedChapters.length ? `${eligibleCount} eligible unique questions across the selected chapters.` : "Select at least one chapter to start."}</p>
        </div>
        <div class="field setup-field count-field">
          <div class="section-heading">
            <span class="section-number">02</span>
            <div><h3>How many questions?</h3><p>Choose a preset or enter a custom amount.</p></div>
          </div>
          <div class="quick-counts" aria-label="Question count">
            ${[10, 20, 30, 50].map((count) => `<button class="count-choice ${state.countMode === String(count) ? "selected" : ""}" type="button" data-count-mode="${count}" ${count > eligibleCount ? "disabled" : ""}><strong>${count}</strong><span>questions</span></button>`).join("")}
            <button class="count-choice custom-choice ${state.countMode === "custom" ? "selected" : ""}" type="button" data-count-mode="custom"><strong>Custom</strong><span>your amount</span></button>
          </div>
          <div class="count-row custom-count-row">
            <label class="sr-only" for="custom-count-input">Custom question count</label>
            <input id="custom-count-input" type="number" min="1" max="${Math.max(eligibleCount, 1)}" value="${state.customCount}" inputmode="numeric" ${state.countMode === "custom" ? "" : "disabled"} />
            <span class="field-help">Maximum: ${eligibleCount} questions based on your selection</span>
          </div>
        </div>
        <button class="primary-btn start-btn" id="start-btn" type="button" ${validCount ? "" : "disabled"}>Start Quiz <span aria-hidden="true">→</span></button>
      </div>
      <aside class="card side-card">
        <div class="side-intro"><span class="side-icon" aria-hidden="true">✦</span><div><p class="eyebrow">Ready when you are</p><h3>Balanced practice</h3></div></div>
        <p class="side-copy">Your quiz will be distributed as evenly as possible across the chapters you select, with unseen questions preferred first.</p>
        <div class="ready-panel"><strong id="ready-summary">${validCount ? `${requestedCount} question${requestedCount === 1 ? "" : "s"} ready` : "Choose chapters and a valid count"}</strong><span>${state.selectedChapters.length} chapter${state.selectedChapters.length === 1 ? "" : "s"} selected</span></div>
        <ul class="study-promises">
          <li><span aria-hidden="true">✓</span> Four options per question</li>
          <li><span aria-hidden="true">✓</span> Printed textbook references</li>
          <li><span aria-hidden="true">✓</span> Progress saved locally</li>
        </ul>
        <button class="ghost-btn reset-history-btn" id="reset-history-btn" type="button">Reset question history</button>
      </aside>
    </section>`;

  const selectAll = document.querySelector("#select-all");
  selectAll.indeterminate = state.selectedChapters.length > 0 && !allSelected;
  selectAll.addEventListener("change", (event) => {
    state.selectedChapters = event.target.checked ? chapters.map((chapter) => chapter.number) : [];
    renderHome();
  });
  document.querySelectorAll("[data-chapter]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const chapter = Number(event.target.dataset.chapter);
      state.selectedChapters = event.target.checked
        ? [...new Set([...state.selectedChapters, chapter])].sort((a, b) => a - b)
        : state.selectedChapters.filter((selectedChapter) => selectedChapter !== chapter);
      renderHome();
    });
  });
  document.querySelectorAll("[data-count-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.countMode = button.dataset.countMode;
      renderHome();
    });
  });
  document.querySelector("#custom-count-input").addEventListener("input", (event) => {
    state.customCount = Math.min(Math.max(Number(event.target.value) || 1, 1), Math.max(eligibleCount, 1));
    event.target.value = state.customCount;
    const liveCount = getRequestedCount();
    const liveValid = eligibleCount > 0 && liveCount >= 1 && liveCount <= eligibleCount;
    document.querySelector("#ready-summary").textContent = liveValid
      ? `${liveCount} question${liveCount === 1 ? "" : "s"} ready across ${state.selectedChapters.length} chapter${state.selectedChapters.length === 1 ? "" : "s"}.`
      : "Choose chapters and a valid question count.";
    document.querySelector("#start-btn").disabled = !liveValid;
  });
  document.querySelector("#reset-history-btn").addEventListener("click", () => {
    writeHistory(resetQuestionHistory());
    renderHome();
  });
  document.querySelector("#start-btn").addEventListener("click", startQuiz);
}

function startQuiz() {
  const count = getRequestedCount();
  if (!state.selectedChapters.length || count < 1 || count > getEligibleCount()) {
    renderHome();
    return;
  }
  const selection = selectBalancedQuestions({
    questionBank,
    selectedChapters: state.selectedChapters,
    count,
    history: readHistory(),
  });
  writeHistory(selection.history);
  state.quiz = selection.questions.map(prepareQuestion);
  state.current = 0;
  state.score = 0;
  state.answeredCount = 0;
  state.selectedId = null;
  state.submitted = false;
  state.mistakes = [];
  state.view = "quiz";
  render();
}

function renderQuiz() {
  const question = state.quiz[state.current];
  if (!question) {
    state.view = "results";
    render();
    return;
  }

  const isAnswered = state.submitted;
  const selectedOption = question.options.find((option) => option.id === state.selectedId);
  const isCorrect = isAnswered && selectedOption?.id === question.correctId;
  const progress = ((state.current + (isAnswered ? 1 : 0)) / state.quiz.length) * 100;
  const progressLabel = Math.round(progress);
  const chapterTitle = getChapterTitle(question.chapter);

  app.innerHTML = `
    <section class="quiz-layout">
      <div class="quiz-top">
        <div class="quiz-progress-copy"><p class="quiz-label">Question ${state.current + 1} of ${state.quiz.length}</p><span>${progressLabel}% complete</span></div>
        <div class="score-pill" aria-live="polite">Score: ${state.score} / ${state.answeredCount}</div>
      </div>
      <div class="progress-track" aria-label="Quiz progress"><div class="progress-fill" style="width: ${progress}%"></div></div>
    <section class="card question-card" aria-label="Question">
      <div class="question-meta"><span class="meta-chip">Chapter ${question.chapter}</span><span class="meta-topic">${escapeHtml(chapterTitle)}</span><span class="meta-page">Page ${escapeHtml(question.page)}</span></div>
      <h2 class="question-text">${escapeHtml(question.prompt)}</h2>
      <div class="options" role="radiogroup" aria-label="Answer options">
        ${question.options.map((option, index) => `
          <button class="option ${state.selectedId === option.id ? "selected" : ""} ${isAnswered && option.id === question.correctId ? "correct" : ""} ${isAnswered && option.id === state.selectedId && option.id !== question.correctId ? "incorrect" : ""}" type="button" data-option="${option.id}" ${isAnswered ? "disabled" : ""} role="radio" aria-checked="${state.selectedId === option.id}" aria-label="${String.fromCharCode(65 + index)}. ${escapeHtml(option.text)}">
            <span class="option-key">${String.fromCharCode(65 + index)}</span>
            <span class="option-copy">${escapeHtml(option.text)}</span>
            ${isAnswered && option.id === question.correctId ? '<span class="option-status" aria-label="Correct">✓</span>' : ''}
            ${isAnswered && option.id === state.selectedId && option.id !== question.correctId ? '<span class="option-status" aria-label="Incorrect">×</span>' : ''}
          </button>`).join("")}
      </div>
      ${isAnswered ? renderFeedback(question, selectedOption, isCorrect) : `
        <div class="submit-row"><button class="secondary-btn" id="submit-btn" type="button" ${state.selectedId ? "" : "disabled"}>Submit Answer</button></div>`}
    </section>
    </section>`;

  if (!isAnswered) {
    document.querySelectorAll("[data-option]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedId = button.dataset.option;
        renderQuiz();
      });
    });
    document.querySelector("#submit-btn").addEventListener("click", submitAnswer);
  } else {
    document.querySelector("#next-btn").addEventListener("click", nextQuestion);
  }
}

function renderFeedback(question, selectedOption, isCorrect) {
  const correctOption = question.options.find((option) => option.id === question.correctId);
  const selectedLetter = String.fromCharCode(65 + question.options.findIndex((option) => option.id === selectedOption.id));
  const correctLetter = String.fromCharCode(65 + question.options.findIndex((option) => option.id === correctOption.id));
  const answerDetails = isCorrect
    ? ""
    : `<div class="answer-line"><span>Your answer</span><strong class="answer-wrong">${selectedLetter}. ${escapeHtml(selectedOption.text)}</strong></div>
       <div class="answer-line"><span>Correct answer</span><strong class="answer-right">${correctLetter}. ${escapeHtml(correctOption.text)}</strong></div>`;

  return `
    <div class="feedback ${isCorrect ? "correct" : "incorrect"}" aria-live="polite">
      <div class="feedback-head"><span class="feedback-icon" aria-hidden="true">${isCorrect ? "✓" : "×"}</span><div><strong>${isCorrect ? "Correct!" : "Incorrect"}</strong><span>${isCorrect ? "Well done. You selected the correct answer." : "Review the distinction before moving on."}</span></div></div>
      <div class="answer-review">${answerDetails}</div>
      <div class="explanation-block"><h3>Explanation</h3>${isCorrect ? `<p>${escapeHtml(correctOption.explanation)}</p>` : `<p><strong>Why your answer is wrong:</strong> ${escapeHtml(selectedOption.explanation)}</p><p><strong>Why the correct answer is right:</strong> ${escapeHtml(correctOption.explanation)}</p>`}</div>
      <div class="reference-panel"><span class="reference-icon" aria-hidden="true">▧</span><div><strong>Textbook reference</strong><span>Chapter ${question.chapter} — Page${question.page.includes("–") ? "s" : ""} ${escapeHtml(question.page)}</span></div></div>
    </div>
    <div class="next-row"><button class="secondary-btn" id="next-btn" type="button">${state.current + 1 === state.quiz.length ? "See Results" : "Next Question →"}</button></div>`;
}

function submitAnswer() {
  if (state.selectedId === null) return;
  const question = state.quiz[state.current];
  const selectedOption = question.options.find((option) => option.id === state.selectedId);
  const isCorrect = selectedOption.id === question.correctId;
  state.submitted = true;
  state.answeredCount += 1;
  if (isCorrect) state.score += 1;
  else state.mistakes.push({ question, selectedId: state.selectedId });
  renderQuiz();
}

function nextQuestion() {
  if (state.current + 1 >= state.quiz.length) {
    state.view = "results";
    render();
    return;
  }
  state.current += 1;
  state.selectedId = null;
  state.submitted = false;
  renderQuiz();
}

function renderResults() {
  const total = state.quiz.length;
  const percent = total ? Math.round((state.score / total) * 100) : 0;
  const wrongMarkup = state.mistakes.length
    ? state.mistakes.map(({ question, selectedId }) => {
      const selectedOption = question.options.find((option) => option.id === selectedId);
      const correctOption = question.options.find((option) => option.id === question.correctId);
      const selectedLetter = String.fromCharCode(65 + question.options.findIndex((option) => option.id === selectedId));
      const correctLetter = String.fromCharCode(65 + question.options.findIndex((option) => option.id === question.correctId));
      return `<article class="wrong-item">
        <h4>${escapeHtml(question.prompt)}</h4>
        <p><strong>Your answer:</strong> ${selectedLetter}. ${escapeHtml(selectedOption.text)}</p>
        <p><strong>Correct answer:</strong> ${correctLetter}. ${escapeHtml(correctOption.text)}</p>
        <p><strong>Explanation:</strong> ${escapeHtml(correctOption.explanation)}</p>
        <p><strong>Chapter:</strong> ${question.chapter} · ${escapeHtml(getChapterTitle(question.chapter))}</p>
        <p><strong>Textbook page:</strong> ${escapeHtml(question.page)}</p>
      </article>`;
    }).join("")
    : `<div class="empty-wrong">Excellent — every answer was correct.</div>`;

  app.innerHTML = `
    <section class="card results-card">
      <div class="results-hero">
        <div class="results-copy"><p class="eyebrow">Practice session complete</p><h2>Quiz Complete</h2><p>You answered ${total} textbook-grounded question${total === 1 ? "" : "s"}.</p></div>
        <div class="result-score"><span>You scored</span><strong>${state.score} / ${total}</strong><b>${percent}%</b></div>
      </div>
      <div class="stats-row">
        <div class="stat stat-correct"><span aria-hidden="true">✓</span><strong>${state.score}</strong><small>Correct</small></div>
        <div class="stat stat-incorrect"><span aria-hidden="true">×</span><strong>${state.mistakes.length}</strong><small>Incorrect</small></div>
        <div class="stat"><span aria-hidden="true">#</span><strong>${total}</strong><small>Questions</small></div>
      </div>
      <div class="review-heading"><div><h3 class="wrong-title">Review incorrect questions</h3><p>${state.mistakes.length ? `You got ${state.mistakes.length} question${state.mistakes.length === 1 ? "" : "s"} incorrect. Use the explanations to strengthen your understanding.` : "Excellent work — every answer was correct."}</p></div></div>
      <div class="wrong-list">${wrongMarkup}</div>
      <div class="result-actions">
        ${state.mistakes.length ? `<button class="primary-btn" id="retry-btn" type="button">Review Incorrect Questions <span aria-hidden="true">→</span></button>` : ""}
        <button class="ghost-btn" id="new-quiz-btn" type="button">Take Another Quiz</button>
      </div>
    </section>`;

  document.querySelector("#new-quiz-btn").addEventListener("click", () => {
    state.view = "home";
    state.selectedId = null;
    render();
  });
  document.querySelector("#retry-btn")?.addEventListener("click", retryWrong);
}

function retryWrong() {
  state.quiz = state.mistakes.map(({ question }) => prepareQuestion(question));
  state.customCount = state.quiz.length;
  state.current = 0;
  state.score = 0;
  state.answeredCount = 0;
  state.selectedId = null;
  state.submitted = false;
  state.mistakes = [];
  state.view = "quiz";
  render();
}

render();
