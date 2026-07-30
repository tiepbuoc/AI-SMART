// logger.js
// Hàm dùng chung để lưu 1 câu hỏi vào chrome.storage.local
// Được nạp trước các content-script riêng cho từng trang (chatgpt / claude)

function aiLoggerSaveEntry(site, text) {
  const cleanText = (text || "").trim();
  if (!cleanText) return;

  chrome.storage.local.get({ entries: [] }, (data) => {
    const entries = data.entries || [];

    // Tránh lưu trùng: nếu câu cuối cùng cùng site + cùng nội dung
    // và cách nhau chưa tới 5 giây thì bỏ qua (do DOM có thể bắn sự kiện nhiều lần)
    const last = entries[entries.length - 1];
    if (last && last.site === site && last.text === cleanText) {
      const lastTime = new Date(last.time).getTime();
      const now = Date.now();
      if (now - lastTime < 5000) return;
    }

    const entry = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      site: site,
      text: cleanText,
      time: new Date().toISOString(),
      url: location.href,
      analyzed: false, // AI Learning Passport sẽ cập nhật thành true sau khi phân tích ACI
    };

    entries.push(entry);

    // Giới hạn tối đa 5000 mục để tránh phình dung lượng storage
    const MAX_ENTRIES = 5000;
    const trimmed = entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries;

    chrome.storage.local.set({ entries: trimmed });
  });
}

// Tiện ích: theo dõi các phần tử mới xuất hiện trong DOM khớp với selector,
// đánh dấu đã xử lý bằng thuộc tính data-ai-logger-seen để không lặp lại.
function aiLoggerObserveNewMatches(selector, onMatch, options = {}) {
  const { debounceMs = 400 } = options;

  const processNode = (node) => {
    if (!(node instanceof Element)) return;
    const candidates = [];
    if (node.matches && node.matches(selector)) candidates.push(node);
    if (node.querySelectorAll) {
      node.querySelectorAll(selector).forEach((el) => candidates.push(el));
    }
    candidates.forEach((el) => {
      if (el.getAttribute("data-ai-logger-seen") === "1") return;
      el.setAttribute("data-ai-logger-seen", "1");
      // Debounce nhẹ để đảm bảo text đã render đầy đủ
      setTimeout(() => onMatch(el), debounceMs);
    });
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(processNode);
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  // Quét luôn các phần tử đã có sẵn khi script load
  document.querySelectorAll(selector).forEach((el) => processNode(el));

  return observer;
}
