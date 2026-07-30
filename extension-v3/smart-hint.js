// smart-hint.js
// Chèn 1 panel nhỏ cạnh ô nhập của ChatGPT / Claude / Gemini, hiển thị 5 bước SMART
// và cho phép viết lại câu hỏi theo khung SMART trước khi gửi.
//
// LƯU Ý: mỗi trang có cấu trúc DOM khác nhau và có thể thay đổi theo thời gian.
// Hàm initSmartHint nhận vào 1 danh sách CSS selector khả dĩ cho ô nhập của từng
// trang; nếu sau này trang đổi giao diện, chỉ cần cập nhật selector tương ứng
// trong content-<site>.js, không cần sửa file này.

function initSmartHint({ inputSelectors, getText, setText }) {
  let panel = null;
  let currentInput = null;

  function findInput() {
    for (const sel of inputSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function buildPanel() {
    const el = document.createElement("div");
    el.className = "ai-smart-hint-panel";
    Object.assign(el.style, {
      position: "fixed",
      zIndex: 999999,
      background: "#171a21",
      color: "#e6e8ec",
      border: "1px solid #2a2f3a",
      borderRadius: "10px",
      padding: "8px 10px",
      fontSize: "11.5px",
      maxWidth: "320px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    el.innerHTML = `
      <div style="font-weight:600; font-size:11px; color:#9aa3b2;">AI SMART · 5 bước</div>
      <div style="display:flex; gap:4px; flex-wrap:wrap;">
        ${["State", "Missing", "Assist", "Resolve", "Test"]
          .map(
            (s) =>
              `<span style="background:#1f232c;border:1px solid #2a2f3a;border-radius:8px;padding:2px 6px;">${s}</span>`
          )
          .join("")}
      </div>
      <button class="ai-smart-rewrite-btn" style="
        margin-top:2px; padding:6px 8px; border-radius:6px; border:none;
        background:#5b8cff; color:#fff; font-size:11.5px; font-weight:600; cursor:pointer;">
        ✨ Viết lại câu hỏi theo SMART
      </button>
      <div class="ai-smart-rewrite-status" style="font-size:10.5px; color:#9aa3b2; min-height:12px;"></div>
    `;

    const btn = el.querySelector(".ai-smart-rewrite-btn");
    const statusEl = el.querySelector(".ai-smart-rewrite-status");

    btn.addEventListener("click", async () => {
      const text = getText(currentInput);
      if (!text || !text.trim()) {
        statusEl.textContent = "Hãy gõ câu hỏi trước đã.";
        return;
      }
      btn.disabled = true;
      statusEl.textContent = "Đang viết lại...";
      try {
        const res = await chrome.runtime.sendMessage({ type: "rewritePrompt", text });
        if (res?.error) {
          statusEl.textContent = "Lỗi: " + res.error;
        } else {
          setText(currentInput, res.rewritten);
          statusEl.textContent = "Đã viết lại. Bạn có thể chỉnh sửa thêm trước khi gửi.";
        }
      } catch (e) {
        statusEl.textContent = "Lỗi: " + e.message;
      } finally {
        btn.disabled = false;
      }
    });

    document.body.appendChild(el);
    return el;
  }

  function positionPanel() {
    if (!panel || !currentInput) return;
    const rect = currentInput.getBoundingClientRect();
    panel.style.left = Math.max(8, rect.left) + "px";
    panel.style.top = Math.max(8, rect.top - panel.offsetHeight - 8) + "px";
  }

  function tick() {
    const input = findInput();
    if (input && input !== currentInput) {
      currentInput = input;
      if (!panel) panel = buildPanel();
      panel.style.display = "flex";
    } else if (!input && panel) {
      panel.style.display = "none";
    }
    positionPanel();
  }

  setInterval(tick, 800);
  window.addEventListener("resize", positionPanel);
  window.addEventListener("scroll", positionPanel, true);
}
