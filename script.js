/* ============================================
   SMART PRODUCTIVITY PLANNER - SCRIPT.JS
   Full backend: LocalStorage + Anthropic AI
   ============================================ */

"use strict";

// ============================================
// DATA STORE (Backend via LocalStorage)
// ============================================
let tasks    = JSON.parse(localStorage.getItem("spp_tasks"))    || [];
let history  = JSON.parse(localStorage.getItem("spp_history"))  || [];
let theme    = localStorage.getItem("spp_theme")               || "dark";
let activeFilter = "all";
let editingId = null;

// Save tasks to LocalStorage
function saveTasks() {
  localStorage.setItem("spp_tasks",   JSON.stringify(tasks));
  localStorage.setItem("spp_history", JSON.stringify(history));
}

// Save theme preference
function saveTheme() {
  localStorage.setItem("spp_theme", theme);
}

// ============================================
// UNIQUE ID GENERATOR
// ============================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

// ============================================
// THEME TOGGLE
// ============================================
function initTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeIcon").className =
    theme === "dark" ? "fas fa-moon" : "fas fa-sun";
}

document.getElementById("themeToggle").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  initTheme();
  saveTheme();
  showToast(`${theme === "dark" ? "Dark" : "Light"} mode activated`, "info", "fas fa-palette");
});

// ============================================
// ADD TASK
// ============================================
function addTask() {
  const name     = document.getElementById("taskName").value.trim();
  const category = document.getElementById("taskCategory").value;
  const priority = document.getElementById("taskPriority").value;
  const due      = document.getElementById("taskDue").value;
  const notes    = document.getElementById("taskNotes").value.trim();

  if (!name) {
    showToast("Please enter a task name!", "error", "fas fa-exclamation-circle");
    document.getElementById("taskName").focus();
    return;
  }

  const task = {
    id:          genId(),
    name,
    category,
    priority,
    due,
    notes,
    completed:   false,
    createdAt:   new Date().toISOString(),
    completedAt: null
  };

  tasks.unshift(task);
  logActivity("add", `Added task: <strong>${name}</strong>`);
  saveTasks();
  renderAll();
  clearForm();
  showToast("Task added successfully!", "success", "fas fa-circle-check");

  // Animate the add button
  const btn = document.getElementById("addTaskBtn");
  btn.innerHTML = '<i class="fas fa-check"></i> Added!';
  setTimeout(() => { btn.innerHTML = '<i class="fas fa-plus"></i> Add Task'; }, 1500);
}

// ============================================
// CLEAR FORM
// ============================================
function clearForm() {
  document.getElementById("taskName").value     = "";
  document.getElementById("taskDue").value      = "";
  document.getElementById("taskNotes").value    = "";
  document.getElementById("taskCategory").value = "Personal";
  document.getElementById("taskPriority").value = "High";
}

// ============================================
// DELETE TASK
// ============================================
function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (!confirm(`Delete "${task.name}"?`)) return;

  tasks = tasks.filter(t => t.id !== id);
  logActivity("del", `Deleted task: <strong>${task.name}</strong>`);
  saveTasks();
  renderAll();
  showToast("Task deleted.", "warn", "fas fa-trash");
}

// ============================================
// COMPLETE / RESTORE TASK
// ============================================
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed   = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  if (task.completed) {
    logActivity("done", `Completed: <strong>${task.name}</strong>`);
    showToast("Great job! Task completed! 🎉", "success", "fas fa-star");
  } else {
    logActivity("restore", `Restored: <strong>${task.name}</strong>`);
    showToast("Task moved back to pending.", "info", "fas fa-rotate-left");
  }

  saveTasks();
  renderAll();
}

// ============================================
// EDIT TASK
// ============================================
function openEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;

  document.getElementById("editName").value     = task.name;
  document.getElementById("editCategory").value = task.category;
  document.getElementById("editPriority").value = task.priority;
  document.getElementById("editDue").value      = task.due || "";
  document.getElementById("editNotes").value    = task.notes || "";

  document.getElementById("editModal").classList.add("open");
}

function closeEditModal() {
  document.getElementById("editModal").classList.remove("open");
  editingId = null;
}

function saveEdit() {
  if (!editingId) return;
  const task = tasks.find(t => t.id === editingId);
  if (!task) return;

  const newName = document.getElementById("editName").value.trim();
  if (!newName) {
    showToast("Task name cannot be empty!", "error", "fas fa-exclamation-circle");
    return;
  }

  task.name     = newName;
  task.category = document.getElementById("editCategory").value;
  task.priority = document.getElementById("editPriority").value;
  task.due      = document.getElementById("editDue").value;
  task.notes    = document.getElementById("editNotes").value.trim();

  logActivity("edit", `Edited: <strong>${task.name}</strong>`);
  saveTasks();
  renderAll();
  closeEditModal();
  showToast("Task updated!", "success", "fas fa-pen");
}

// ============================================
// FILTERS
// ============================================
document.getElementById("filterChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.dataset.filter;
  renderTasks();
});

function getFilteredTasks() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  let list = [...tasks];

  // Apply active filter
  if (activeFilter === "pending")   list = list.filter(t => !t.completed);
  else if (activeFilter === "completed") list = list.filter(t => t.completed);
  else if (["High","Medium","Low"].includes(activeFilter))
    list = list.filter(t => t.priority === activeFilter);

  // Apply search
  if (q) list = list.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    (t.notes && t.notes.toLowerCase().includes(q))
  );

  return list;
}

// ============================================
// RENDER TASKS
// ============================================
function renderTasks() {
  const filtered   = getFilteredTasks();
  const pendingEl  = document.getElementById("pendingList");
  const doneEl     = document.getElementById("completedList");

  const pending  = filtered.filter(t => !t.completed);
  const done     = filtered.filter(t =>  t.completed);

  // Pending
  pendingEl.innerHTML = "";
  if (pending.length === 0) {
    pendingEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No pending tasks${activeFilter !== "all" ? " for this filter" : ""}.</p></div>`;
  } else {
    pending.forEach(t => pendingEl.appendChild(buildTaskCard(t)));
  }

  // Completed
  doneEl.innerHTML = "";
  if (done.length === 0) {
    doneEl.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>No completed tasks yet.</p></div>`;
  } else {
    done.forEach(t => doneEl.appendChild(buildTaskCard(t)));
  }
}

// ============================================
// BUILD TASK CARD
// ============================================
function buildTaskCard(task) {
  const card = document.createElement("div");
  card.className = `task-card${task.completed ? " completed" : ""}`;
  card.dataset.priority = task.priority;
  card.id = "card-" + task.id;

  const priClass = { High: "badge-high", Medium: "badge-medium", Low: "badge-low" }[task.priority];

  const createdStr  = fmtDate(task.createdAt);
  const dueStr      = task.due      ? `<div class="task-meta-row"><i class="fas fa-calendar-days"></i> Due: ${task.due}</div>` : "";
  const doneStr     = task.completedAt ? `<div class="task-meta-row"><i class="fas fa-circle-check"></i> Done: ${fmtDate(task.completedAt)}</div>` : "";
  const notesHtml   = task.notes ? `<div class="task-notes"><i class="fas fa-note-sticky"></i> ${escHtml(task.notes)}</div>` : "";

  const completedBadge = task.completed
    ? `<span class="badge badge-done">✔ Completed</span>`
    : "";

  const actions = task.completed
    ? `<button class="btn btn-ghost btn-sm" onclick="toggleComplete('${task.id}')"><i class="fas fa-rotate-left"></i> Restore</button>
       <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i> Delete</button>`
    : `<button class="btn btn-success btn-sm" onclick="toggleCompleteWithAnim('${task.id}')"><i class="fas fa-check"></i> Complete</button>
       <button class="btn btn-warn btn-sm" onclick="openEdit('${task.id}')"><i class="fas fa-pen"></i> Edit</button>
       <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')"><i class="fas fa-trash"></i> Delete</button>`;

  card.innerHTML = `
    <div class="task-card-top">
      <span class="task-name">${escHtml(task.name)}</span>
      ${task.completed ? '<div class="completed-check"><i class="fas fa-check"></i></div>' : ""}
    </div>
    <div class="task-badges">
      <span class="badge ${priClass}">${task.priority}</span>
      <span class="badge badge-cat">${task.category}</span>
      ${completedBadge}
    </div>
    <div class="task-meta">
      <div class="task-meta-row"><i class="fas fa-clock"></i> Created: ${createdStr}</div>
      ${dueStr}
      ${doneStr}
    </div>
    ${notesHtml}
    <div class="task-actions">${actions}</div>
  `;

  return card;
}

// ============================================
// COMPLETE WITH ANIMATION
// ============================================
function toggleCompleteWithAnim(id) {
  const card = document.getElementById("card-" + id);
  if (card) {
    card.classList.add("flash-complete");
    setTimeout(() => toggleComplete(id), 300);
  } else {
    toggleComplete(id);
  }
}

// ============================================
// DASHBOARD STATS
// ============================================
function renderStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;
  const rate    = total === 0 ? 0 : Math.round((done / total) * 100);

  animateNum("totalCount",   total);
  animateNum("pendingCount", pending);
  animateNum("doneCount",    done);

  document.getElementById("rateCount").textContent    = rate + "%";
  document.getElementById("progressLabel").textContent = rate + "%";
  document.getElementById("progressBar").style.width  = rate + "%";
}

// Animated counter
function animateNum(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const diff  = target - start;
  const steps = 20;
  let current = 0;
  const timer = setInterval(() => {
    current++;
    el.textContent = Math.round(start + (diff * current / steps));
    if (current >= steps) { el.textContent = target; clearInterval(timer); }
  }, 20);
}

// ============================================
// ACTIVITY LOG
// ============================================
function logActivity(type, message) {
  const icons  = { add: "h-add fas fa-plus", done: "h-done fas fa-check", del: "h-del fas fa-trash", edit: "h-edit fas fa-pen", restore: "h-restore fas fa-rotate-left" };
  const iClass = icons[type] || "h-add fas fa-bolt";

  history.unshift({ type, message, time: new Date().toISOString(), iconClass: iClass });

  // Keep last 50 events
  if (history.length > 50) history = history.slice(0, 50);
}

function renderHistory() {
  const el = document.getElementById("historyList");
  if (history.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-scroll"></i><p>No activity yet.</p></div>`;
    return;
  }
  el.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-icon ${h.iconClass.split(" ")[0]}"><i class="${h.iconClass.split(" ").slice(1).join(" ")}"></i></div>
      <span class="history-text">${h.message}</span>
      <span class="history-time">${fmtDate(h.time)}</span>
    </div>
  `).join("");
}

function clearHistory() {
  if (!confirm("Clear all activity history?")) return;
  history = [];
  saveTasks();
  renderHistory();
  showToast("History cleared.", "info", "fas fa-broom");
}

// ============================================
// RENDER ALL
// ============================================
function renderAll() {
  renderStats();
  renderTasks();
  renderHistory();
}

// ============================================
// QUOTES
// ============================================
const quotes = [
  "The secret of getting ahead is getting started.",
  "Small progress is still progress.",
  "Success is the sum of small efforts repeated daily.",
  "Focus on being productive instead of busy.",
  "Don't watch the clock; do what it does. Keep going.",
  "It always seems impossible until it's done.",
  "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
  "You don't have to be great to start, but you have to start to be great.",
  "Action is the foundational key to all success.",
  "Either you run the day or the day runs you."
];

let quoteIndex = 0;
function rotateQuote() {
  const el = document.getElementById("quoteText");
  el.style.opacity = "0";
  setTimeout(() => {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    el.textContent = quotes[quoteIndex];
    el.style.opacity = "1";
  }, 400);
}
setInterval(rotateQuote, 6000);

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(msg, type = "info", icon = "fas fa-info-circle") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="${icon}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// AI ASSISTANT (Anthropic API)
// ============================================
document.getElementById("aiAssistBtn").addEventListener("click", () => {
  document.getElementById("aiModal").classList.add("open");
  document.getElementById("aiInput").focus();
});

function closeAiModal() {
  document.getElementById("aiModal").classList.remove("open");
}

async function sendAiMessage() {
  const input = document.getElementById("aiInput");
  const msg   = input.value.trim();
  if (!msg) return;

  const chatArea = document.getElementById("aiChatArea");
  const sendBtn  = document.getElementById("aiSendBtn");

  // Add user message
  chatArea.appendChild(makeChatMsg(msg, "user"));
  input.value = "";

  // Add typing indicator
  const typingEl = document.createElement("div");
  typingEl.className = "ai-msg ai-msg--bot ai-typing";
  typingEl.innerHTML = `<i class="fas fa-robot"></i><span>Thinking...</span>`;
  chatArea.appendChild(typingEl);
  chatArea.scrollTop = chatArea.scrollHeight;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  // Build context about current tasks
  const taskSummary = tasks.length > 0
    ? `Current tasks in the app:\n${tasks.slice(0,10).map(t => `- [${t.completed ? "Done" : "Pending"}] ${t.name} (${t.priority} priority, ${t.category})`).join("\n")}`
    : "No tasks in the app yet.";

  const systemPrompt = `You are a helpful productivity assistant integrated into a Smart Productivity Planner app. Help users plan tasks, break down goals, suggest tasks, give productivity tips, and organize their work. Be concise, practical, and encouraging. Keep responses under 120 words unless the user asks for detail.\n\n${taskSummary}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: msg }]
      })
    });

    const data  = await response.json();
    const reply = data.content?.map(b => b.text || "").join("") || "Sorry, I couldn't get a response.";

    typingEl.remove();
    chatArea.appendChild(makeChatMsg(reply, "bot"));

  } catch (err) {
    typingEl.remove();
    chatArea.appendChild(makeChatMsg("⚠️ Couldn't reach AI. Please check your connection.", "bot"));
  }

  chatArea.scrollTop = chatArea.scrollHeight;
  sendBtn.disabled = false;
  sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
}

function makeChatMsg(text, role) {
  const div = document.createElement("div");
  div.className = `ai-msg ai-msg--${role}`;
  const icon = role === "bot" ? "fas fa-robot" : "fas fa-user";
  div.innerHTML = `<i class="${icon}"></i><span>${escHtml(text)}</span>`;
  return div;
}

// ============================================
// CLOSE MODALS ON OVERLAY CLICK
// ============================================
document.getElementById("editModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("editModal")) closeEditModal();
});
document.getElementById("aiModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("aiModal")) closeAiModal();
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeEditModal();
    closeAiModal();
  }
  // Ctrl+Enter to add task when task name is focused
  if (e.ctrlKey && e.key === "Enter") addTask();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format ISO date to readable
function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// Escape HTML to prevent XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================
// DEMO TASKS (first-time users only)
// ============================================
function loadDemoTasks() {
  if (tasks.length > 0) return; // Don't overwrite existing data

  const demo = [
    { name: "Review project requirements",   category: "Work",     priority: "High",   due: todayPlus(1), notes: "Check client specs" },
    { name: "Morning run – 5km",             category: "Health",   priority: "Medium", due: todayPlus(0), notes: "" },
    { name: "Read 30 pages of current book", category: "Personal", priority: "Low",    due: todayPlus(2), notes: "" },
    { name: "Complete JS assignment",        category: "Study",    priority: "High",   due: todayPlus(3), notes: "Focus on async/await" },
    { name: "Grocery shopping",              category: "Shopping", priority: "Medium", due: todayPlus(1), notes: "Milk, eggs, fruits" }
  ];

  demo.forEach(d => {
    tasks.push({
      id:          genId(),
      name:        d.name,
      category:    d.category,
      priority:    d.priority,
      due:         d.due,
      notes:       d.notes,
      completed:   false,
      createdAt:   new Date().toISOString(),
      completedAt: null
    });
  });

  // Mark one as complete for demo
  tasks[2].completed   = true;
  tasks[2].completedAt = new Date().toISOString();

  logActivity("add", "Loaded <strong>demo tasks</strong> to get you started!");
  saveTasks();
}

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ============================================
// INIT
// ============================================
function init() {
  initTheme();
  loadDemoTasks();
  renderAll();
  // Set default due date to today
  document.getElementById("taskDue").valueAsDate = new Date();
}

init();
