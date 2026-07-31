// background.js — MV3 service worker (type: module)
import { getValidIdToken, writeEntryToFirestore } from "./firestore-rest.js";

// ============ 1. Mở tab đăng nhập/đồng ý tự động khi vừa cài tiện ích ============
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

// ============ 2. Đồng bộ nền liên tục (không cần mở popup) ============
async function syncUnsyncedEntries() {
  const { syncConsent } = await chrome.storage.local.get({ syncConsent: false });
  if (!syncConsent) return;

  const tokens = await getValidIdToken();
  if (!tokens) return;

  const { entries = [] } = await chrome.storage.local.get({ entries: [] });
  const unsynced = entries.filter((e) => !e.synced);
  if (unsynced.length === 0) return;

  let changed = false;
  for (const entry of unsynced) {
    try {
      await writeEntryToFirestore(tokens.uid, tokens.idToken, entry);
      entry.synced = true;
      changed = true;
    } catch (e) {
      console.error("Đồng bộ entry thất bại:", e.message);
      break; // dừng lại, thử lại ở lần sync kế tiếp
    }
  }

  if (changed) {
    const { entries: latest = [] } = await chrome.storage.local.get({ entries: [] });
    const merged = latest.map((e) => {
      const match = unsynced.find((u) => u.id === e.id && u.synced);
      return match ? { ...e, synced: true } : e;
    });
    await chrome.storage.local.set({ entries: merged });
  }
}

// Đồng bộ ngay khi có entry mới được lưu (gần như tức thời)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.entries) {
    syncUnsyncedEntries();
  }
});

// Đồng bộ định kỳ dự phòng (phòng khi bỏ lỡ sự kiện onChanged, hoặc lần trước lỗi mạng)
chrome.alarms.create("ai-smart-sync", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ai-smart-sync") syncUnsyncedEntries();
});

// ============ 3. Gọi API viết lại câu hỏi theo khung SMART (giữ như cũ) ============
const DEFAULT_API_CONFIG = {
  endpoint: "https://api.shopaikey.com/v1",
  model: "gpt-5.4-nano",
  apiKey: "sk-4150297863e3eee405805e8609648e6c5cebb1b502ffb46e",
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "rewritePrompt") {
    handleRewrite(message.text)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message?.type === "onboardingComplete") {
    syncUnsyncedEntries();
  }
});

async function handleRewrite(text) {
  const stored = await chrome.storage.local.get({ apiConfig: null });
  const apiConfig = stored.apiConfig && stored.apiConfig.apiKey ? stored.apiConfig : DEFAULT_API_CONFIG;

  const endpoint = apiConfig.endpoint.trim().replace(/\/$/, "");
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiConfig.apiKey,
    },
    body: JSON.stringify({
      model: apiConfig.model,
      messages: [
        {
          role: "system",
          content:
            'Bạn giúp học sinh viết lại câu hỏi để hỏi AI theo khung SMART: (1) Nêu vấn đề đang gặp, (2) Nói rõ mình đã thử/biết gì rồi, (3) Chỗ cụ thể đang vướng, (4) Muốn AI gợi ý hướng đi (KHÔNG xin đáp án trực tiếp). Viết lại ngắn gọn, tự nhiên, giữ đúng ý học sinh, giọng văn của học sinh. CHỈ trả về câu hỏi đã viết lại, không thêm giải thích, không markdown.',
        },
        { role: "user", content: text },
      ],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rewritten = data.choices?.[0]?.message?.content?.trim();
  return { rewritten: rewritten || text };
}
