// content-gemini.js
// Theo dõi tin nhắn NGƯỜI DÙNG gửi trên gemini.google.com và chèn panel SMART.
//
// LƯU Ý: Gemini dùng framework Angular + Quill editor, cấu trúc có thể đổi.
// Nếu selector dưới đây không còn khớp, hãy F12 để kiểm tra lại.

(function () {
  // Tin nhắn người dùng trong lịch sử hội thoại của Gemini
  const USER_MESSAGE_SELECTORS = [
    "user-query .query-text",
    "user-query",
  ].join(", ");

  aiLoggerObserveNewMatches(
    USER_MESSAGE_SELECTORS,
    (el) => {
      const text = el.innerText || el.textContent || "";
      aiLoggerSaveEntry("gemini", text);
    },
    { debounceMs: 300 }
  );

  // Ô nhập của Gemini: Quill editor contenteditable bên trong rich-textarea
  initSmartHint({
    inputSelectors: [
      "rich-textarea .ql-editor",
      'div[contenteditable="true"][aria-label*="prompt" i]',
      'div[contenteditable="true"]',
    ],
    getText: (el) => el.innerText,
    setText: (el, text) => {
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  });
})();
