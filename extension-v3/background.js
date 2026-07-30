// background.js — MV3 service worker
// Nhận yêu cầu từ content script để gọi API AI viết lại câu hỏi theo khung SMART.
// Thực hiện ở đây (thay vì trong content script) để tránh vướng CSP của trang đích.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "rewritePrompt") {
    handleRewrite(message.text)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // giữ kênh mở cho phản hồi bất đồng bộ
  }
});

// Cấu hình API mặc định cố định (API test của bạn, theo yêu cầu).
// Nếu popup đã đăng nhập và đồng bộ cấu hình khác từ Firestore, cấu hình đó
// (lưu trong chrome.storage.local.apiConfig) sẽ được ưu tiên dùng thay thế.
const DEFAULT_API_CONFIG = {
  endpoint: "https://api.shopaikey.com/v1",
  model: "gpt-5.4-nano",
  apiKey: "sk-4150297863e3eee405805e8609648e6c5cebb1b502ffb46e",
};

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
            'Bạn giúp học sinh viết lại câu hỏi để hỏi AI theo khung SMART (State - Missing - Assist - Resolve - Test): nêu (1) vấn đề đang gặp, (2) mình đã thử/biết gì rồi, (3) chỗ cụ thể đang vướng, (4) muốn AI gợi ý hướng đi (KHÔNG xin đáp án trực tiếp). Viết lại ngắn gọn, tự nhiên, giữ đúng ý học sinh, giọng văn của học sinh. CHỈ trả về câu hỏi đã viết lại, không thêm giải thích, không markdown.',
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
