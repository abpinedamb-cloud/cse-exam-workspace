let data = [];
let current = 0;
let answers = {};
let marked = {};
let examFinished = false;
let examSubmitted = false; 
let chartInstance = null;
let mode = "practice"; // "practice" or "exam"

const TOTAL_SECONDS = 190 * 60;
let remainingSeconds = TOTAL_SECONDS;
let timerInterval = null;

/* -----------------------------
   DOM helpers
----------------------------- */
function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.innerText = value;
}

function setHTML(id, value) {
  const el = byId(id);
  if (el) el.innerHTML = value;
}

function safeShow(id) {
  const el = byId(id);
  if (el) el.classList.remove("hidden");
}

function safeHide(id) {
  const el = byId(id);
  if (el) el.classList.add("hidden");
}

function escapeQuotes(text) {
  return String(text).replace(/'/g, "\\'");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* -----------------------------
   Mode helpers
----------------------------- */
function setMode(newMode) {
  mode = newMode;
  localStorage.setItem("examMode", mode);
  updateModeUI();
  render();
  saveProgress();
}

function loadMode() {
  const savedMode = localStorage.getItem("examMode");
  if (savedMode === "practice" || savedMode === "exam") {
    mode = savedMode;
  } else {
    mode = "practice";
  }
}

function updateModeUI() {
  const practiceBtn = byId("modePracticeBtn");
  const examBtn = byId("modeExamBtn");
  const modeStatus = byId("modeStatus");
  const modeIndicator = byId("modeIndicator");

  const isPractice = mode === "practice";
  const modeText = isPractice ? "Practice" : "Exam";

  // Settings label
  if (modeStatus) {
    modeStatus.innerText = `Current mode: ${modeText}`;
  }

  // Top bar indicator
  if (modeIndicator) {
    modeIndicator.innerText = `${isPractice ? "🟢" : "🔴"} Mode: ${modeText}`;
    modeIndicator.style.background = isPractice ? "#0f3d2e" : "#3b1a1a";
    modeIndicator.style.color = isPractice ? "#c9ffd9" : "#ffd6d6";
    modeIndicator.style.border = isPractice
      ? "1px solid #22c55e"
      : "1px solid #ef4444";
  }

  // Settings buttons highlight
  if (practiceBtn) {
    practiceBtn.classList.toggle("btn-primary", isPractice);
    practiceBtn.classList.toggle("btn-dark", !isPractice);
  }

  if (examBtn) {
    examBtn.classList.toggle("btn-primary", !isPractice);
    examBtn.classList.toggle("btn-dark", isPractice);
  }

  // Sidebar mode highlight
  const modePracticeItem = byId("modePracticeItem");
  const modeExamItem = byId("modeExamItem");

  if (modePracticeItem) {
    modePracticeItem.classList.toggle("active", isPractice);
  }

  if (modeExamItem) {
    modeExamItem.classList.toggle("active", !isPractice);
  }
}

/* -----------------------------
   Boot
----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  wireKeyboardShortcuts();
  wireNotesAutosave();
});

async function initializeApp() {
  loadMode();

  startLiveDateTime();
  await loadFreshQuestions(false);
  loadProgress();
  loadSavedNotes();
  renderSavedNotesList();

  render();
  buildNav();
  updateStats();
  updateLandingStats();
  updateTimerDisplay();
  updateCountdownBar();
  updatePaceStatus();
  updatePaceTimer();
  showLandingScreen();

  updateModeUI();
}

/* -----------------------------
   Live date/time
----------------------------- */
function startLiveDateTime() {
  function tick() {
    const now = new Date();
    const formatted = now.toLocaleString();
    setText("liveDateTime", formatted);
  }
  tick();
  setInterval(tick, 1000);
}

/* -----------------------------
   Keyboard shortcuts
----------------------------- */
function wireKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const typing = tag === "textarea" || tag === "input";

    if (typing) return;

    const key = e.key.toLowerCase();

    if (key === "n") next();
    if (key === "p") prev();
    if (key === "m") markForReview();
    if (key === "s") submitExam();
  });
}

/* -----------------------------
   Notes
----------------------------- */

// ✅ NEW GLOBAL FILTER STATE
let selectedNoteFilter = "all";

function getSavedNotesHistory() {
  try {
    return JSON.parse(localStorage.getItem("savedNotesHistory")) || [];
  } catch {
    return [];
  }
}

function saveSavedNotesHistory(notes) {
  localStorage.setItem("savedNotesHistory", JSON.stringify(notes));
}

function saveCurrentNote() {
  const notes = byId("notesArea");
  const tag = byId("noteTagSelect")?.value || "General";

  if (!notes) return;
  const content = notes.value.trim();
  if (!content) return;

  const savedNotes = getSavedNotesHistory();

  savedNotes.unshift({
    id: Date.now(),
    content,
    tag,
    createdAt: new Date().toLocaleString()
  });

  saveSavedNotesHistory(savedNotes);
  renderSavedNotesList();
}

function renderSavedNotesList() {
  const container = byId("savedNotesList");
  if (!container) return;

  let savedNotes = getSavedNotesHistory();

  // ✅ ✅ READ FILTER DIRECTLY (FIXES ISSUE)
  const filterEl = byId("notesFilter");
  const selected = filterEl ? filterEl.value.toLowerCase() : "all";

  if (selected !== "all") {
    savedNotes = savedNotes.filter(note =>
      note.tag && note.tag.toLowerCase() === selected
    );
  }

  if (!savedNotes.length) {
    container.innerHTML = `<p style="color:#9fb2d7;">No saved notes found.</p>`;
    return;
  }

  let html = `
  <div style="
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap:18px;
  ">
  `;

  savedNotes.forEach((note) => {
    let tagColor = "#3b82f6";

    if (note.tag === "Weak Area") tagColor = "#ef4444";
    else if (note.tag === "Important") tagColor = "#f59e0b";
    else if (note.tag === "Verbal") tagColor = "#8b5cf6";
    else if (note.tag === "Numerical") tagColor = "#22c55e";
    else if (note.tag === "Analytical") tagColor = "#06b6d4";

    html += `
      <div class="result-card" style="border-left:5px solid ${tagColor};">
        <div style="margin-bottom:0; line-height:1.1;">
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <strong>${note.tag || "General"}</strong>
    <span style="font-size:12px; color:#cbd7f5;">
      ${new Date(note.createdAt).toLocaleDateString()}
    </span>
  </div>
  <div style="text-align:right; font-size:11px; color:#9fb2d7; margin-top:2px;">
    ${new Date(note.createdAt).toLocaleTimeString()}
  </div>
</div>
<div style="
  margin:0;
  margin-left:-12px;
  text-align:left;
  white-space:pre-wrap;
  word-break:break-word;
  overflow-wrap:break-word;
  overflow-x:hidden;
  max-height:140px;
  line-height:1.4;
  display:block;
">
  ${escapeHtml(note.content).replace(/^\s+/, "")}
</div>
        <div class="control-group">
          <button class="btn btn-dark" onclick="restoreSavedNote(${note.id})">Restore</button>
          <button class="btn btn-danger" onclick="deleteSavedNote(${note.id})">Delete</button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ✅ ✅ NEW FILTER FUNCTION (SAFE)
function filterSavedNotes(tag) {
  selectedNoteFilter = tag;
  renderSavedNotesList();
}

function restoreSavedNote(id) {
  const notes = getSavedNotesHistory().find(n => n.id === id);
  if (!notes) return;

  const area = byId("notesArea");
  if (area) {
    area.value = notes.content;
    localStorage.setItem("examNotes", notes.content);
  }
}

function deleteSavedNote(id) {
  const updated = getSavedNotesHistory().filter(n => n.id !== id);
  saveSavedNotesHistory(updated);
  renderSavedNotesList();
}
function wireNotesAutosave() {
  const notes = byId("notesArea");
  if (!notes) return;

  notes.addEventListener("input", () => {
    localStorage.setItem("examNotes", notes.value);
  });
}

function loadSavedNotes() {
  const notes = byId("notesArea");
  if (!notes) return;

  const saved = localStorage.getItem("examNotes");
  if (saved !== null) notes.value = saved;
}

function clearSavedNotes() {
  localStorage.removeItem("examNotes");
  const notes = byId("notesArea");
  if (notes) notes.value = "";
}

/* -----------------------------
   Data load / restart
----------------------------- */
async function loadFreshQuestions(keepProgress = false) {
  try {
    const res = await fetch("/api/questions");

    const jsonData = await res.json();
    console.log("TOTAL QUESTIONS:", jsonData.length);

    // ✅ Shuffle
    const shuffled = jsonData.sort(() => 0.5 - Math.random());

    // ✅ Limit to 170
    data = shuffled.slice(0, 170);

    console.log("LOADED FOR EXAM:", data.length);

    current = 0;

    if (!keepProgress) {
      answers = {};
      marked = {};
      remainingSeconds = TOTAL_SECONDS;
      examFinished = false;
	  examSubmitted = false;
      clearSavedProgress();
    }

  } catch (err) {
    console.error("Failed to load questions:", err);
    data = [];
  }
}

async function startExamNow() {
  await loadFreshQuestions(false);
  remainingSeconds = TOTAL_SECONDS;
  examFinished = false;
  examSubmitted = false;

  updateTimerDisplay();
  updateCountdownBar();
  updatePaceStatus();
  updatePaceTimer();

  startCountdown();
  render();
  buildNav();
  updateStats();
  updateLandingStats();
  showExamScreen();
  saveProgress();

  collapseNavigator();
}

async function restartExam() {
  stopCountdown();

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const priorityCanvas = byId("priorityGaugeChart");
  const subtopicCanvas = byId("subtopicChart");

  if (priorityCanvas && priorityCanvas._chartInstance) {
    priorityCanvas._chartInstance.destroy();
    priorityCanvas._chartInstance = null;
  }

  if (subtopicCanvas && subtopicCanvas._chartInstance) {
    subtopicCanvas._chartInstance.destroy();
    subtopicCanvas._chartInstance = null;
  }

  setHTML("result", "");
  setHTML("reviewContainer", "<p>No review available yet. Submit an exam first.</p>");

  await loadFreshQuestions(false);
  updateTimerDisplay();
  updateCountdownBar();
  updatePaceStatus();
  updatePaceTimer();
  render();
  buildNav();
  updateStats();
  updateLandingStats();
  showLandingScreen();
}

function resumeExam() {
  loadProgress();

  render();
  buildNav();
  updateStats();
  updateLandingStats();
  updateTimerDisplay();
  updateCountdownBar();
  updatePaceStatus();
  updatePaceTimer();

  if (!examFinished && remainingSeconds < TOTAL_SECONDS) {
    startCountdown();
  }

  showExamScreen();
  collapseNavigator();
}

/* -----------------------------
   Save / Resume
----------------------------- */
function saveProgress() {
  const payload = {
    answers,
    marked,
    current,
    remainingSeconds,
    examFinished,
	examSubmitted,
    questions: data,
    mode
  };
  localStorage.setItem("examState", JSON.stringify(payload));
}

function loadProgress() {
  const raw = localStorage.getItem("examState");
  if (!raw) return;

  try {
    const state = JSON.parse(raw);

    answers = state.answers || {};
    marked = state.marked || {};
    current = Number.isInteger(state.current) ? state.current : 0;
    remainingSeconds =
      typeof state.remainingSeconds === "number"
        ? state.remainingSeconds
        : TOTAL_SECONDS;
    examFinished = !!state.examFinished;
	examSubmitted = !!state.examSubmitted;

    if (state.mode === "practice" || state.mode === "exam") {
      mode = state.mode;
    }

    if (Array.isArray(state.questions) && state.questions.length) {
      data = state.questions;
    }

    updateModeUI();
  } catch (e) {
    console.error("Failed to load saved progress", e);
  }
}

function clearSavedProgress() {
  localStorage.removeItem("examState");
}

/* -----------------------------
   Sections / Screens
----------------------------- */
function setActiveMenu(activeId) {
  const all = [
    "menuDashboard",
    "menuExam",
    "menuReview",
    "menuAnalytics",   // ✅ NEW
    "menuSubtopics",   // ✅ NEW
    "menuNotes",
    "menuSettings",
    "menuHelp"
  ];

  all.forEach((id) => byId(id)?.classList.remove("active"));
  byId(activeId)?.classList.add("active");
}

function showSection(section) {
  const list = [
    "landingScreen",
    "examScreen",
    "reviewScreen",
    "analyticsScreen",   // ✅ NEW
    "subtopicsScreen",   // ✅ NEW
    "notesScreen",
    "settingsScreen",
    "helpScreen"
  ];

  list.forEach((id) => {
    const el = byId(id);
    if (el) {
      el.classList.add("hidden");
      el.classList.remove("screen");
    }
  });

  const active = byId(section);
  if (active) {
    active.classList.remove("hidden");
    setTimeout(() => {
      active.classList.add("screen");
    }, 10);
  }
  // ✅ Auto scroll to top when switching sections
window.scrollTo(0, 0);

  // ✅ MENU ACTIVE STATE
  if (section === "landingScreen") setActiveMenu("menuDashboard");
  if (section === "examScreen") setActiveMenu("menuExam");
  if (section === "reviewScreen") setActiveMenu("menuReview");
  if (section === "analyticsScreen") setActiveMenu("menuAnalytics");   // ✅ NEW
  if (section === "subtopicsScreen") setActiveMenu("menuSubtopics");   // ✅ NEW
  if (section === "notesScreen") setActiveMenu("menuNotes");
  if (section === "settingsScreen") setActiveMenu("menuSettings");
  if (section === "helpScreen") setActiveMenu("menuHelp");
}


function showLandingScreen() {
  showSection("landingScreen");
}

function showExamScreen() {
  showSection("examScreen");
}

function showReviewScreen() {
  showSection("reviewScreen");
  refreshReviewScreen();
  expandNavigator();
}

function showNotesScreen() {
  showSection("notesScreen");

  // ✅ Always refresh notes and apply filter
  renderSavedNotesList();
}


function showSettingsScreen() {
  showSection("settingsScreen");
  updateModeUI();
}

function showHelpScreen() {
  showSection("helpScreen");
}

/* -----------------------------
   Navigator expand / collapse
----------------------------- */
function toggleNavigator() {
  const nav = byId("navigatorWrapper");
  if (!nav) return;

  if (nav.classList.contains("navigator-expanded")) {
    nav.classList.remove("navigator-expanded");
    nav.classList.add("navigator-collapsed");
  } else {
    nav.classList.remove("navigator-collapsed");
    nav.classList.add("navigator-expanded");
  }
}

function collapseNavigator() {
  const nav = byId("navigatorWrapper");
  if (!nav) return;
  nav.classList.remove("navigator-expanded");
  nav.classList.add("navigator-collapsed");
}

function expandNavigator() {
  const nav = byId("navigatorWrapper");
  if (!nav) return;
  nav.classList.remove("navigator-collapsed");
  nav.classList.add("navigator-expanded");
}

/* -----------------------------
   Countdown timer
----------------------------- */
function startCountdown() {
  stopCountdown();

  timerInterval = setInterval(() => {
    if (examFinished) return;

    remainingSeconds--;
    if (remainingSeconds < 0) remainingSeconds = 0;

    updateTimerDisplay();
    updateCountdownBar();
    updatePaceStatus();
    updatePaceTimer();
    saveProgress();

    if (remainingSeconds <= 0) {
      submitExam();
    }
  }, 1000);
}

function stopCountdown() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  setText("timer", display);

  const timerBox = byId("timerBox");
  if (timerBox) {
    timerBox.classList.remove("urgent", "pulse-red");

    if (remainingSeconds <= 5 * 60) {
      timerBox.classList.add("urgent", "pulse-red");
    } else if (remainingSeconds <= 15 * 60) {
      timerBox.classList.add("urgent");
    }
  }
}

function updateCountdownBar() {
  const fill = byId("countdownBar");
  if (!fill) return;

  const pct = Math.max(0, (remainingSeconds / TOTAL_SECONDS) * 100);
  fill.style.width = `${pct}%`;
}

/* -----------------------------
   Pace status + pace timer
----------------------------- */
function updatePaceStatus() {
  if (!data.length) {
    setText("paceStatus", "Not Started");
    return;
  }

  if (examFinished) {
    setText("paceStatus", "Completed");
    return;
  }

  if (remainingSeconds === TOTAL_SECONDS) {
    setText("paceStatus", "Not Started");
    return;
  }

  const target = Math.round(((current + 1) / data.length) * TOTAL_SECONDS);
  const actual = TOTAL_SECONDS - remainingSeconds;
  const delta = actual - target;

  if (Math.abs(delta) <= 120) {
    setText("paceStatus", "On Track");
  } else if (delta < 0) {
    setText("paceStatus", "Ahead");
  } else {
    setText("paceStatus", "Behind");
  }
}

function updatePaceTimer() {
  if (!data.length) {
    setText("paceTimer", "00:00");
    return;
  }

  const target = Math.round(((current + 1) / data.length) * TOTAL_SECONDS);
  const actual = TOTAL_SECONDS - remainingSeconds;
  const delta = actual - target;

  const abs = Math.abs(delta);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const time = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  let text;
  if (Math.abs(delta) <= 120) {
    text = "On track";
  } else if (delta < 0) {
    text = `Ahead by ${time}`;
  } else {
    text = `Behind by ${time}`;
  }

  setText("paceTimer", text);

  const el = byId("paceTimer");
  if (el) {
    el.style.color = "#f2f7ff";

    if (Math.abs(delta) <= 120) el.style.color = "#22c55e";
    else if (delta < 0) el.style.color = "#3b82f6";
    else el.style.color = "#ef4444";
  }
}

/* -----------------------------
   Explanation / Answer handling
----------------------------- */
function handleChoiceClick(index, encodedChoice) {
  if (examSubmitted) return;   // ✅ BLOCK ALL AFTER SUBMIT

  const choice = decodeURIComponent(encodedChoice);

  if (answers[index] !== undefined) return;

  selectAnswer(index, choice);
}

function showExplanation(selectedChoice, correctAnswer, explanation) {
  const choicesContainer = byId("choices");
  if (!choicesContainer) return;

  const existing = byId("explanationBox");
  if (existing) existing.remove();

  let html = "";

  if (selectedChoice === correctAnswer) {
    html = `
      <div id="explanationBox" style="
        margin-top:15px;
        padding:12px;
        border-radius:10px;
        background:linear-gradient(180deg, #0f3d2e, #0a2b21);
        color:#c9ffd9;
        border:1px solid #22c55e;
      ">
        ✅ Correct!<br>
        <strong>Explanation:</strong> ${escapeHtml(explanation)}
      </div>
    `;
  } else {
    html = `
      <div id="explanationBox" style="
        margin-top:15px;
        padding:12px;
        border-radius:10px;
        background:linear-gradient(180deg, #3b1a1a, #2a1212);
        color:#ffd6d6;
        border:1px solid #ef4444;
      ">
        ❌ Incorrect<br>
        <strong>Correct Answer:</strong> ${escapeHtml(correctAnswer)}<br>
        <strong>Explanation:</strong> ${escapeHtml(explanation)}
      </div>
    `;
  }

  choicesContainer.innerHTML += html;
}

/* -----------------------------
   Render exam
----------------------------- */
function render() {
  if (!data.length) {
    setText("question", "No questions loaded.");
    setHTML("choices", "");
    setText("progress", "Question 0 of 0");
    setText("progress-inline", "Question 0 of 0");
    return;
  }

  const q = data[current];
  const progressText = `Question ${current + 1} of ${data.length}`;

  const qEl = byId("question");
  if (qEl) {
    qEl.classList.remove("question-animate");

    setTimeout(() => {
      qEl.innerText = `${current + 1}. ${q.question}`;
      qEl.classList.add("question-animate");
    }, 10);
  }

  setText("progress", progressText);
  setText("progress-inline", progressText);
  setText("subjectBadge", q.subject || "Subject");
  setText("subtopicBadge", q.subtopic || "Subtopic");

  let html = "";

  q.choices.forEach((choice) => {
    const selected = answers[current] === choice;
    const alreadyAnswered = answers[current] !== undefined;
	const locked = alreadyAnswered || examSubmitted;
    const disabledClass = locked ? "opacity:0.6; cursor:not-allowed;" : "";

    html += `
      <button
        class="choice-btn ${selected ? "selected" : ""} fade-in"
        style="${disabledClass}"
        onclick="handleChoiceClick(${current}, '${encodeURIComponent(choice)}')"
		${locked ? "disabled" : ""}
      >
        ${escapeHtml(choice)}
      </button>
    `;
  });

  setHTML("choices", html);

  buildNav();
  updateStats();
  updateLandingStats();
  updatePaceTimer();

  // Practice: show immediately on revisit
  // Exam: show only after submit
  if (answers[current] !== undefined) {
    const qCurrent = data[current];

    if (mode === "practice") {
      showExplanation(
        answers[current],
        qCurrent.answer,
        qCurrent.explanation || "No explanation available."
      );
    }

    if (mode === "exam" && examFinished) {
      showExplanation(
        answers[current],
        qCurrent.answer,
        qCurrent.explanation || "No explanation available."
      );
    }
  }
}

function selectAnswer(index, choice) {
  if (examSubmitted) return;   // ✅ BLOCK AFTER SUBMIT
  if (answers[index] !== undefined) return;

  answers[index] = choice;
  saveProgress();

  render();

  // Practice mode only
  if (mode === "practice") {
    const q = data[index];
    setTimeout(() => {
      showExplanation(
        choice,
        q.answer,
        q.explanation || "No explanation available."
      );
    }, 50);
  }
}

function next() {
  if (current < data.length - 1) {
    current++;
    render();
    saveProgress();
  }
}

function prev() {
  if (current > 0) {
    current--;
    render();
    saveProgress();
  }
}

function go(i) {
  current = i;
  render();
  showExamScreen();
  saveProgress();
}

function markForReview() {
  marked[current] = !marked[current];
  saveProgress();
  buildNav();
  updateStats();
  updateLandingStats();
}

/* -----------------------------
   Navigator
----------------------------- */
function buildNav() {
  let html = "";

  data.forEach((_, i) => {
    let cls = "nav-q-btn";
    if (answers[i] !== undefined) cls += " answered";
    if (i === current) cls += " current";
    if (marked[i]) cls += " marked";

    html += `<button class="${cls}" onclick="go(${i})">${i + 1}</button>`;
  });

  setHTML("navigator", html);
}

/* -----------------------------
   Stats
----------------------------- */
function updateStats() {
  const answeredCount = Object.keys(answers).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const totalCount = data.length;
  const notAnsweredCount = totalCount - answeredCount;

  setText("answeredCount", answeredCount);
  setText("markedCount", markedCount);
  setText("notAnsweredCount", notAnsweredCount);
  setText("totalCount", totalCount);

  setText("answeredCountTop", answeredCount);
  setText("remainingCountTop", notAnsweredCount);
}

function updateLandingStats() {
  setText("landingQuestionCount", data.length);
  setText("landingAnswered", Object.keys(answers).length);
  setText("landingMarked", Object.values(marked).filter(Boolean).length);
}

/* -----------------------------
   Review screen
----------------------------- */
function refreshReviewScreen() {
  if (!data.length) {
    setHTML("reviewContainer", "<p>No exam data loaded.</p>");
    return;
  }

  const answeredCount = Object.keys(answers).length;

  if (answeredCount === 0 && !examFinished) {
    setHTML("reviewContainer", `
      <div class="fade-in">
        <h2>📊 Review</h2>
        <p>No answers yet. Start the exam and your review data will appear here.</p>
        <p><strong>Total questions loaded:</strong> ${data.length}</p>
      </div>
    `);
    return;
  }

  const subtopicStats = {};

  data.forEach((q, i) => {
    const subtopic = q.subtopic || "Uncategorized";

    if (!subtopicStats[subtopic]) {
      subtopicStats[subtopic] = {
        total: 0,
        correct: 0,
        incorrect: 0
      };
    }

    subtopicStats[subtopic].total++;

    if (answers[i] !== undefined) {
      if (answers[i] === q.answer) subtopicStats[subtopic].correct++;
      else subtopicStats[subtopic].incorrect++;
    }
  });

  let html = `<div class="fade-in"><h2>📊 Review</h2>`;

  html += `<h3>Subtopic Performance Summary</h3>`;
  html += `<div class="cards">`;

  Object.entries(subtopicStats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([subtopic, stat]) => {
      html += `
        <div class="result-card" style="border-left:5px solid #3b82f6;">
          <h4 style="margin:0 0 8px 0;">${escapeHtml(subtopic)}</h4>
          <p style="margin:5px 0;">Total: ${stat.total}</p>
          <p style="margin:5px 0; color:#22c55e;">Correct: ${stat.correct}</p>
          <p style="margin:5px 0; color:#ef4444;">Incorrect: ${stat.incorrect}</p>
        </div>
      `;
    });

  html += `</div>`;

  html += `<h3 style="margin-top:20px;">Detailed Question Review</h3>`;

  data.forEach((q, i) => {
    const userAnswer = answers[i] || "No answer";
    const isCorrect = answers[i] === q.answer;

    html += `
      <div class="review-item" style="border-left:5px solid ${isCorrect ? "#22c55e" : "#ef4444"};">
        <h4 style="margin:0 0 10px 0;">Q${i + 1}. ${escapeHtml(q.question)}</h4>
        <p><strong>Subject:</strong> ${escapeHtml(q.subject || "N/A")}</p>
        <p><strong>Subtopic:</strong> ${escapeHtml(q.subtopic || "N/A")}</p>
        <p><strong>Your Answer:</strong> <span style="color:${isCorrect ? "#22c55e" : "#f87171"}">${escapeHtml(userAnswer)}</span></p>
        <p><strong>Correct Answer:</strong> <span style="color:#22c55e">${escapeHtml(q.answer)}</span></p>
        <p><strong>Explanation:</strong> ${escapeHtml(q.explanation || "No explanation available.")}</p>
      </div>
    `;
  });

  html += `</div>`;

  setHTML("reviewContainer", html);
}

/* -----------------------------
   Submit / analytics
----------------------------- */
function submitExam() {
  if (examFinished) return;
  
  examSubmitted = true;
  examFinished = true;
  
  stopCountdown();
  saveProgress();
  updatePaceStatus();

  let correct = 0;
  let subjectStats = {};
  let subtopicStats = {};
  let reviewHtml = "";

  data.forEach((q, i) => {
    if (!subjectStats[q.subject]) subjectStats[q.subject] = { total: 0, correct: 0 };
    if (!subtopicStats[q.subtopic]) subtopicStats[q.subtopic] = { total: 0, correct: 0 };

    subjectStats[q.subject].total++;
    subtopicStats[q.subtopic].total++;

    const userAnswer = answers[i] || "No answer";
    const isCorrect = answers[i] === q.answer;

    if (isCorrect) {
      correct++;
      subjectStats[q.subject].correct++;
      subtopicStats[q.subtopic].correct++;
    }

    // ✅ BUILD REVIEW ONLY (NOT SHOWN IN EXAM)
    reviewHtml += `
      <div class="review-item fade-in" style="border-left:5px solid ${isCorrect ? "#22c55e" : "#ef4444"};">
        <h4>Q${i + 1}. ${escapeHtml(q.question)}</h4>
        <p><strong>Your Answer:</strong> ${escapeHtml(userAnswer)}</p>
        <p><strong>Correct:</strong> ${escapeHtml(q.answer)}</p>
        <p><strong>Explanation:</strong> ${escapeHtml(q.explanation || "N/A")}</p>
      </div>
    `;
  });

  // ✅ EXAM TAB CONTENT (NO REVIEW HERE)
  let html = `<div class="main-panel fade-in"><div class="question-wrap">`;
  html += `<h2>Final Score: ${correct}/${data.length}</h2>`;
  html += `<p><strong>Mode:</strong> ${escapeHtml(mode)}</p>`;

  html += `<h3>Performance Breakdown</h3><div class="cards">`;

  const labels = [];
  const values = [];

  Object.entries(subjectStats).forEach(([sub, val]) => {
    const accuracy = val.total ? (val.correct / val.total) * 100 : 0;

    labels.push(sub);
    values.push(Number(accuracy.toFixed(1)));

    html += `
      <div class="result-card">
        <h4>${escapeHtml(sub)}</h4>
        <p>${val.correct}/${val.total}</p>
        <p>${accuracy.toFixed(1)}%</p>
      </div>
    `;
  });

  html += `</div>`;

  // ✅ EXAM RESULT
  setHTML("result", html);

  // ✅ REVIEW TAB (THIS FIXES YOUR ISSUE 🔥)
  setHTML("reviewContainer", reviewHtml);

  // ✅ KEEP ANALYTICS
  renderChart(labels, values);
  renderPriorityGauge(subjectStats);
  renderSubtopicChart(subtopicStats);
  renderSubtopicsPanel(subtopicStats);

  setTimeout(() => {
    byId("subtopicChart")?.scrollIntoView({ behavior: "smooth" });
  }, 300);
  render();
}

function renderChart(labels, values) {
  const canvas = byId("chart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Accuracy %",
        data: values,
        backgroundColor: values.map((v) => {
          if (v < 50) return "#ef4444";
          if (v < 70) return "#f59e0b";
          return "#22c55e";
        }),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      animation: {
        duration: 700
      },
      plugins: {
        legend: {
          labels: { color: "#0f172a" }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

/* -----------------------------
   Priority Gauge
----------------------------- */
function renderPriorityGauge(subjectStats) {
  const canvas = byId("priorityGaugeChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");

  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  const labels = [];
  const values = [];

  Object.entries(subjectStats).forEach(([sub, val]) => {
    const accuracy = val.total ? (val.correct / val.total) * 100 : 0;
    labels.push(sub);
    values.push(Number(accuracy.toFixed(1)));
  });

  canvas._chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map((v) => {
          if (v < 50) return "#ef4444";
          if (v < 70) return "#f59e0b";
          return "#22c55e";
        }),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

/* -----------------------------
   Subtopic Chart
----------------------------- */
function renderSubtopicChart(subtopicStats) {
  const canvas = byId("subtopicChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");

  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  const labels = [];
  const values = [];

  Object.entries(subtopicStats).forEach(([subtopic, val]) => {
    const accuracy = val.total ? (val.correct / val.total) * 100 : 0;
    labels.push(subtopic);
    values.push(Number(accuracy.toFixed(1)));
  });

  canvas._chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Accuracy %",
        data: values,
        backgroundColor: values.map((v) => {
          if (v < 50) return "#ef4444";
          if (v < 70) return "#f59e0b";
          return "#22c55e";
        }),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 60,
            minRotation: 30
          }
        },
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function renderSubtopicsPanel(subtopicStats) {
let html = `
  <div style="
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap:12px;
  ">
`;

  Object.entries(subtopicStats).forEach(([sub, val]) => {
    const accuracy = val.total ? (val.correct / val.total) * 100 : 0;

    let borderColor = "#22c55e";
    let bgColor = "rgba(34,197,94,.10)";
    let label = "Strong";

    if (accuracy < 50) {
      borderColor = "#ef4444";
      bgColor = "rgba(239,68,68,.12)";
      label = "Needs Focus";
    } else if (accuracy < 70) {
      borderColor = "#f59e0b";
      bgColor = "rgba(245,158,11,.12)";
      label = "Improving";
    }

    html += `
      <div class="result-card" style="
        width:100%;
        border-left:5px solid ${borderColor};
        background:${bgColor};
      ">
        <h4 style="margin:0 0 8px 0;">${sub}</h4>
        <p style="margin:4px 0;"><strong>Score:</strong> ${val.correct}/${val.total}</p>
        <p style="margin:4px 0;"><strong>Accuracy:</strong> ${accuracy.toFixed(1)}%</p>
        <p style="margin:6px 0 0 0; font-weight:700; color:${borderColor};">${label}</p>
      </div>
    `;
  });

  html += `</div>`;
  setHTML("subtopicContainer", html);
}

function formatUsedTime() {
  const used = TOTAL_SECONDS - remainingSeconds;
  const mins = Math.floor(used / 60);
  const secs = used % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/* ✅ ADD THIS BELOW (SAFE LOCATION) */

let notesExpanded = false;

function toggleSavedNotes() {
  const wrapper = byId("savedNotesWrapper");
  const btn = event?.target;

  if (!wrapper) return;

  notesExpanded = !notesExpanded;

  if (notesExpanded) {
    wrapper.style.maxHeight = "1000px";
    if (btn) btn.innerText = "Collapse";
  } else {
    wrapper.style.maxHeight = "400px";
    if (btn) btn.innerText = "Expand";
  }
}
