// content-chatgpt.js
// Theo dõi các tin nhắn do NGƯỜI DÙNG gửi trên chatgpt.com / chat.openai.com,
// và chèn panel gợi ý SMART cạnh ô nhập.

(function () {
  // ChatGPT đánh dấu tin nhắn người dùng bằng data-message-author-role="user"
  const USER_MESSAGE_SELECTOR = '[data-message-author-role="user"]';

  aiLoggerObserveNewMatches(
    USER_MESSAGE_SELECTOR,
    (el) => {
      const text = el.innerText || el.textContent || "";
      aiLoggerSaveEntry("chatgpt", text);
    },
    { debounceMs: 200 } // tin nhắn user hiện ra ngay, không cần chờ lâu
  );

  // Ô nhập của ChatGPT: có thể là <div id="prompt-textarea" contenteditable>
  // hoặc <textarea> tuỳ phiên bản giao diện — thử theo thứ tự.
  initSmartHint({
    inputSelectors: [
      "#prompt-textarea",
      'textarea[data-testid="chat-input-textarea"]',
      "form textarea",
    ],
    getText: (el) => (el.matches("textarea") ? el.value : el.innerText),
    setText: (el, text) => {
      if (el.matches("textarea")) {
        el.value = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        el.innerText = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    },
  });
})();
