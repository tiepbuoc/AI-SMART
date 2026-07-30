// content-claude.js
// Theo dõi các tin nhắn do NGƯỜI DÙNG gửi trên claude.ai
//
// LƯU Ý: Claude.ai có thể thay đổi cấu trúc HTML theo thời gian, nên script
// thử nhiều selector khác nhau (fallback) để tăng khả năng bắt đúng tin nhắn
// người dùng. Nếu sau này Claude.ai đổi giao diện và extension ngừng hoạt
// động, hãy F12 -> chọn phần tử chứa tin nhắn của bạn -> xem lại thuộc tính
// data-testid hoặc class rồi cập nhật danh sách SELECTORS bên dưới.

(function () {
  const SELECTORS = [
    '[data-testid="user-turn"]',
    '[data-testid="user-message"]',
    'div[class*="font-user-message"]',
  ].join(", ");

  aiLoggerObserveNewMatches(
    SELECTORS,
    (el) => {
      const text = el.innerText || el.textContent || "";
      aiLoggerSaveEntry("claude", text);
    },
    { debounceMs: 500 }
  );

  // Ô nhập của Claude.ai thường là 1 div contenteditable trong khung soạn thảo.
  initSmartHint({
    inputSelectors: [
      'div[contenteditable="true"][data-testid="chat-input"]',
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
    ],
    getText: (el) => el.innerText,
    setText: (el, text) => {
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  });
})();
