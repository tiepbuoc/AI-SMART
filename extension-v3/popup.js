// popup.js

const listEl = document.getElementById("list");
const statsEl = document.getElementById("stats");
const searchInput = document.getElementById("searchInput");
const siteFilter = document.getElementById("siteFilter");
const connStatus = document.getElementById("connStatus");
const notConnectedBox = document.getElementById("notConnectedBox");
const connectedBox = document.getElementById("connectedBox");
const connectBtn = document.getElementById("connectBtn");
const logoutBtn = document.getElementById("logoutBtn");
const currentEmailEl = document.getElementById("currentEmail");
const consentCheckbox = document.getElementById("consentCheckbox");
const syncStatusEl = document.getElementById("syncStatus");

let allEntries = [];

// ---------- Trạng thái kết nối tài khoản ----------
async function refreshConnectionUI() {
  const { authTokens, syncConsent } = await chrome.storage.local.get({
    authTokens: null,
    syncConsent: false,
  });

  if (authTokens && authTokens.email) {
    notConnectedBox.style.display = "none";
    connectedBox.style.display = "block";
    currentEmailEl.textContent = authTokens.email;
    consentCheckbox.checked = !!syncConsent;
    connStatus.textContent = syncConsent ? "Đang đồng bộ" : "Đã kết nối";
    connStatus.className = "conn-badge " + (syncConsent ? "on" : "off");
    syncStatusEl.textContent = syncConsent
      ? "Dữ liệu tự động đồng bộ liên tục lên AI Learning Passport."
      : "Đồng bộ đang TẮT — chỉ lưu trên máy này.";
  } else {
    notConnectedBox.style.display = "block";
    connectedBox.style.display = "none";
    connStatus.textContent = "Chưa kết nối";
    connStatus.className = "conn-badge off";
  }
}

connectBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});

logoutBtn.addEventListener("click", async () => {
  if (!confirm("Ngắt kết nối tài khoản? Dữ liệu cục bộ trên máy vẫn được giữ nguyên.")) return;
  await chrome.storage.local.set({ authTokens: null, syncConsent: false });
  refreshConnectionUI();
});

consentCheckbox.addEventListener("change", async (e) => {
  await chrome.storage.local.set({ syncConsent: e.target.checked });
  refreshConnectionUI();
});

// ---------- Danh sách lịch sử ----------
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function siteLabel(site) {
  const map = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", "website-chatbot": "AI SMART Web" };
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
  downloadFile(`ai-prompt-log-${Date.now()}.json`, JSON.stringify(allEntries, null, 2), "application/json");
}

function exportCsv() {
  const escapeCsv = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["time", "site", "text"].join(",");
  const rows = allEntries.map((e) => [e.time, e.site, escapeCsv(e.text)].join(","));
  downloadFile(`ai-prompt-log-${Date.now()}.csv`, [header, ...rows].join("\n"), "text/csv");
}

searchInput.addEventListener("input", render);
siteFilter.addEventListener("change", render);
document.getElementById("clearAllBtn").addEventListener("click", clearAll);
document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.entries) {
    allEntries = changes.entries.newValue || [];
    render();
  }
  if (changes.authTokens || changes.syncConsent) {
    refreshConnectionUI();
  }
});

loadEntries();
refreshConnectionUI();
