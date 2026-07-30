// popup.js

const listEl = document.getElementById("list");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("searchInput");
const siteFilter = document.getElementById("siteFilter");

let allEntries = [];

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function siteLabel(site) {
  const map = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    "website-chatbot": "AI SMART Web",
  };
  return map[site] || site;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const siteVal = siteFilter.value;

  let filtered = allEntries.filter((e) => {
    const matchesSite = siteVal === "all" || e.site === siteVal;
    const matchesQuery = !query || e.text.toLowerCase().includes(query);
    return matchesSite && matchesQuery;
  });

  // Mới nhất lên đầu
  filtered = filtered.slice().reverse();

  statsEl.textContent = `${filtered.length} câu hỏi (tổng cộng ${allEntries.length})`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty">Chưa có dữ liệu phù hợp.</div>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="entry-meta">
        <span class="badge ${entry.site}">${siteLabel(entry.site)}</span>
        <span class="time">${formatTime(entry.time)}</span>
      </div>
      <div class="entry-text"></div>
      <button class="delete-btn" data-id="${entry.id}">Xoá</button>
    `;
    div.querySelector(".entry-text").textContent = entry.text;
    listEl.appendChild(div);
  });

  listEl.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteEntry(btn.dataset.id));
  });
}

function loadEntries() {
  chrome.storage.local.get({ entries: [] }, (data) => {
    allEntries = data.entries || [];
    render();
  });
}

function deleteEntry(id) {
  allEntries = allEntries.filter((e) => e.id !== id);
  chrome.storage.local.set({ entries: allEntries }, render);
}

function clearAll() {
  if (!confirm("Xoá toàn bộ lịch sử câu hỏi đã lưu?")) return;
  chrome.storage.local.set({ entries: [] }, () => {
    allEntries = [];
    render();
  });
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadFile(
    `ai-prompt-log-${Date.now()}.json`,
    JSON.stringify(allEntries, null, 2),
    "application/json"
  );
}

function exportCsv() {
  const escapeCsv = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["time", "site", "text"].join(",");
  const rows = allEntries.map((e) =>
    [e.time, e.site, escapeCsv(e.text)].join(",")
  );
  downloadFile(
    `ai-prompt-log-${Date.now()}.csv`,
    [header, ...rows].join("\n"),
    "text/csv"
  );
}

searchInput.addEventListener("input", render);
siteFilter.addEventListener("change", render);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);
document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);

// Cập nhật realtime nếu content-script đang chạy nền lưu thêm dữ liệu
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.entries) {
    allEntries = changes.entries.newValue || [];
    render();
  }
});

loadEntries();
