// ─── State ────────────────────────────────────────────────────────────────────

let reportId = null;
let pollTimer = null;

const STEPS = [
  { key: "initializing",          label: "Initializing report" },
  { key: "fetching_context",      label: "Fetching company data" },
  { key: "generating_overview",   label: "Writing company overview" },
  { key: "generating_bull_case",  label: "Building bull case" },
  { key: "generating_bear_case",  label: "Building bear case" },
  { key: "generating_key_risks",  label: "Identifying key risks" },
  { key: "generating_conclusion", label: "Writing conclusion" },
  { key: "synthesizing",          label: "Synthesizing final memo" },
  { key: "complete",              label: "Complete" },
];

const STEP_ORDER = STEPS.map((s) => s.key);

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const tickerInput   = document.getElementById("ticker-input");
const focusInput    = document.getElementById("focus-input");
const generateBtn   = document.getElementById("generate-btn");
const statusPanel   = document.getElementById("status-panel");
const statusDot     = document.getElementById("status-dot");
const statusLabel   = document.getElementById("status-label");
const progressSteps = document.getElementById("progress-steps");
const memoPanel     = document.getElementById("memo-panel");
const memoContent   = document.getElementById("memo-content");
const chatPanel     = document.getElementById("chat-panel");
const chatHistory   = document.getElementById("chat-history");
const chatInput     = document.getElementById("chat-input");
const chatSendBtn   = document.getElementById("chat-send-btn");
const errorBanner   = document.getElementById("error-banner");

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  renderProgressSteps(null);

  // Ticker chips
  document.querySelectorAll(".ticker-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      tickerInput.value = chip.dataset.ticker;
      tickerInput.focus();
    });
  });

  generateBtn.addEventListener("click", handleGenerate);
  tickerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGenerate();
  });
  chatSendBtn.addEventListener("click", handleChat);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  });
});

// ─── Generate flow ────────────────────────────────────────────────────────────

async function handleGenerate() {
  const ticker = tickerInput.value.trim().toUpperCase();
  const focusPrompt = focusInput.value.trim();

  if (!ticker) {
    showError("Please enter a stock ticker.");
    return;
  }

  clearError();
  resetUI();

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, focusPrompt: focusPrompt || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to start analysis");
    }

    reportId = data.reportId;
    showStatusPanel();
    startPolling();
  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Memo";
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────

function startPolling() {
  pollTimer = setInterval(poll, CONFIG.POLL_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function poll() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/report/${reportId}`);
    const report = await res.json();

    if (!res.ok) {
      throw new Error(report.error || "Failed to fetch report");
    }

    updateStatus(report);

    if (report.status === "complete") {
      stopPolling();
      renderMemo(report.sections.finalMemo);
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate New Memo";
    }

    if (report.status === "error") {
      stopPolling();
      showError(report.error || "Report generation failed.");
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Memo";
    }
  } catch (err) {
    console.error("Poll error:", err);
  }
}

// ─── Status panel ─────────────────────────────────────────────────────────────

function showStatusPanel() {
  statusPanel.style.display = "block";
}

function updateStatus(report) {
  const { status } = report;

  // Dot state
  statusDot.className = "status-dot";
  if (status === "complete") statusDot.classList.add("complete");
  else if (status === "error") statusDot.classList.add("error");
  else statusDot.classList.add("running");

  // Label
  const step = STEPS.find((s) => s.key === status);
  statusLabel.innerHTML = `<strong>${report.ticker}</strong> — ${step ? step.label : status}`;

  // Steps
  renderProgressSteps(status);
}

function renderProgressSteps(currentStatus) {
  if (!progressSteps) return;
  const currentIndex = STEP_ORDER.indexOf(currentStatus);

  progressSteps.innerHTML = STEPS.filter((s) => s.key !== "complete")
    .map((s, i) => {
      const idx = STEP_ORDER.indexOf(s.key);
      const isDone   = currentIndex > idx;
      const isActive = currentIndex === idx;
      const icon = isDone ? "✓" : isActive ? "›" : "·";
      const cls  = isDone ? "done" : isActive ? "active" : "";
      return `<div class="step ${cls}"><span class="step-icon">${icon}</span>${s.label}</div>`;
    })
    .join("");
}

// ─── Memo render ──────────────────────────────────────────────────────────────

function renderMemo(markdown) {
  if (!markdown) return;
  memoPanel.style.display = "block";
  memoContent.innerHTML = parseMarkdown(markdown);
  chatPanel.style.display = "block";
  memoPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function handleChat() {
  const message = chatInput.value.trim();
  if (!message || !reportId) return;

  chatInput.value = "";
  chatSendBtn.disabled = true;

  appendMessage("user", message);

  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/chat/${reportId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Chat request failed");
    }

    appendMessage("assistant", data.reply);
  } catch (err) {
    appendMessage("assistant", `Error: ${err.message}`);
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

function appendMessage(role, content) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.innerHTML = `
    <span class="message-role">${role === "user" ? "You" : "Analyst"}</span>
    <span class="message-content">${escapeHtml(content)}</span>
  `;
  chatHistory.appendChild(el);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// ─── Error ────────────────────────────────────────────────────────────────────

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.style.display = "block";
}

function clearError() {
  errorBanner.style.display = "none";
  errorBanner.textContent = "";
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetUI() {
  stopPolling();
  reportId = null;
  statusPanel.style.display = "none";
  memoPanel.style.display = "none";
  chatPanel.style.display = "none";
  chatHistory.innerHTML = "";
  memoContent.innerHTML = "";
  renderProgressSteps(null);
}

// ─── Minimal markdown parser ──────────────────────────────────────────────────

function parseMarkdown(md) {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Bullets
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    // Paragraphs (double newlines)
    .replace(/\n\n([^<])/g, "\n\n<p>$1")
    .replace(/([^>])\n\n/g, "$1</p>\n\n")
    // Line breaks
    .replace(/\n/g, "<br>");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
