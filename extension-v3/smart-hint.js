// smart-hint.js
// Chèn 1 panel nhỏ cạnh ô nhập của ChatGPT / Claude / Gemini, hiển thị 5 bước SMART
// (tiếng Việt), cho phép viết lại câu hỏi theo khung SMART, và có thể KÉO THẢ để
// di chuyển hoặc THU NHỎ thành 1 bong bóng nổi khi không cần dùng tới.
//
// LƯU Ý: mỗi trang có cấu trúc DOM khác nhau và có thể thay đổi theo thời gian.
// Nếu sau này trang đổi giao diện, chỉ cần cập nhật selector trong content-<site>.js.

const SMART_STEPS_VI = [
  { label: "Nêu vấn đề" },
  { label: "Xác định chỗ thiếu" },
  { label: "Gợi ý hướng đi" },
  { label: "Tự hoàn thành" },
  { label: "Kiểm tra & Giải thích" },
];

function initSmartHint({ inputSelectors, getText, setText }) {
  let panel = null;
  let bubble = null;
  let currentInput = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let panelPos = null; // { left, top } — nếu null thì bám theo ô nhập

  function findInput() {
    for (const sel of inputSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function buildBubble() {
    const b = document.createElement("button");
    b.className = "ai-smart-bubble";
    b.textContent = "🧭";
    b.title = "Mở gợi ý AI SMART";
    Object.assign(b.style, {
      position: "fixed",
      zIndex: 999999,
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      border: "none",
      background: "#3b6cf6",
      color: "#fff",
      fontSize: "18px",
      cursor: "pointer",
      boxShadow: "0 6px 16px rgba(59,108,246,0.4)",
      display: "none",
    });
    b.addEventListener("click", () => {
      b.style.display = "none";
      panel.style.display = "flex";
      positionPanel();
    });
    document.body.appendChild(b);
    return b;
  }

  function buildPanel() {
    const el = document.createElement("div");
    el.className = "ai-smart-hint-panel";
    Object.assign(el.style, {
      position: "fixed",
      zIndex: 999999,
      background: "#ffffff",
      color: "#1e2433",
      border: "1px solid #e7eaf3",
      borderRadius: "16px",
      padding: "0",
      width: "300px",
      boxShadow: "0 12px 30px rgba(30,36,51,0.18)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: "hidden",
    });

    el.innerHTML = `
      <div class="ai-smart-drag-handle" style="
        display:flex; align-items:center; justify-content:space-between;
        background:#3b6cf6; color:#fff; padding:8px 10px; cursor:grab; user-select:none;">
        <span style="font-weight:700; font-size:12px;">🧭 AI SMART · 5 bước</span>
        <button class="ai-smart-collapse-btn" title="Thu nhỏ" style="
          border:none; background:rgba(255,255,255,0.2); color:#fff; width:22px; height:22px;
          border-radius:6px; cursor:pointer; font-size:13px; line-height:1;">–</button>
      </div>
      <div style="padding:10px;">
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
          ${SMART_STEPS_VI.map(
            (s, i) =>
              `<span style="background:#eaf0ff;color:#3b6cf6;border-radius:999px;padding:3px 8px;font-size:10.5px;font-weight:600;">${i + 1}. ${s.label}</span>`
          ).join("")}
        </div>
        <button class="ai-smart-rewrite-btn" style="
          width:100%; padding:8px 8px; border-radius:10px; border:none;
          background:#3b6cf6; color:#fff; font-size:12.5px; font-weight:700; cursor:pointer;">
          ✨ Viết lại câu hỏi theo SMART
        </button>
        <div class="ai-smart-rewrite-status" style="font-size:10.5px; color:#667085; min-height:14px; margin-top:6px;"></div>
      </div>
    `;

    const handle = el.querySelector(".ai-smart-drag-handle");
    const collapseBtn = el.querySelector(".ai-smart-collapse-btn");
    const btn = el.querySelector(".ai-smart-rewrite-btn");
    const statusEl = el.querySelector(".ai-smart-rewrite-status");

    // ---- Kéo thả ----
    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = el.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      handle.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panelPos = {
        left: Math.max(8, e.clientX - dragOffset.x),
        top: Math.max(8, e.clientY - dragOffset.y),
      };
      applyPos();
    });
    window.addEventListener("mouseup", () => {
      isDragging = false;
      handle.style.cursor = "grab";
    });

    // ---- Thu nhỏ thành bong bóng ----
    collapseBtn.addEventListener("click", () => {
      el.style.display = "none";
      bubble.style.display = "block";
      const rect = el.getBoundingClientRect();
      bubble.style.left = rect.left + "px";
      bubble.style.top = rect.top + "px";
    });

    // ---- Viết lại câu hỏi ----
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

  function applyPos() {
    if (!panel || !panelPos) return;
    panel.style.left = panelPos.left + "px";
    panel.style.top = panelPos.top + "px";
  }

  function positionPanel() {
    if (!panel || !currentInput) return;
    if (panelPos) {
      applyPos();
      return;
    }
    const rect = currentInput.getBoundingClientRect();
    panel.style.left = Math.max(8, rect.left) + "px";
    panel.style.top = Math.max(8, rect.top - panel.offsetHeight - 8) + "px";
  }

  function tick() {
    const input = findInput();
    if (input && input !== currentInput) {
      currentInput = input;
      if (!panel) {
        panel = buildPanel();
        bubble = buildBubble();
      }
      if (bubble.style.display !== "block") {
        panel.style.display = "flex";
      }
    } else if (!input && panel) {
      panel.style.display = "none";
      bubble.style.display = "none";
    }
    if (!isDragging) positionPanel();
  }

  setInterval(tick, 800);
  window.addEventListener("resize", positionPanel);
  window.addEventListener("scroll", positionPanel, true);
}
