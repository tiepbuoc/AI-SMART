# AI SMART — Hướng dẫn tổng hợp (bản cập nhật)

Dự án gồm 2 phần, dùng chung 1 project Firebase (`cdmtdc`):

1. **`website/`** — deploy lên GitHub Pages: Trang chủ, AI SMART Chatbot, AI Learning Passport & ACI.
2. **`extension-v3/`** — Tiện ích Chrome: gợi ý SMART ngay trên ô nhập của ChatGPT/Claude/Gemini, tự động mở tab đăng nhập khi cài, và tự động đồng bộ liên tục sau đó.

---

## Những gì đã thay đổi ở bản này

1. **Giao diện mới**: theme sáng/trắng, tươi tắn, đồng bộ giữa web và extension (font Baloo 2 + Inter, tông xanh dương `#3b6cf6` làm chủ đạo).
2. **Tự động mở tab đăng nhập khi cài tiện ích**: chỉ cần đăng nhập/đăng ký **1 lần duy nhất** ở tab này — hệ thống tự bật đồng bộ liên tục từ đó, không cần mở popup mỗi lần.
3. **Bỏ hẳn trang "Cài đặt API"** trên web — API key giờ cố định trong code.
4. **Rubric chấm ACI cố định** — có bảng mốc chấm điểm rõ ràng theo từng khoảng điểm, dùng lặp lại y hệt mỗi lần gọi AI để đảm bảo nhất quán giữa các lần phân tích.
5. **Chatbot web xử lý Markdown + LaTeX**: `**in đậm**`, `### tiêu đề`, `---`, danh sách, code, và công thức Toán/Lý/Hóa viết bằng LaTeX (`$...$`, `$$...$$`) đều hiển thị đẹp.
6. **5 bước SMART hiển thị bằng tiếng Việt**: Nêu vấn đề → Xác định chỗ thiếu → Gợi ý hướng đi → Tự hoàn thành → Kiểm tra & Giải thích.
7. **Panel gợi ý SMART trên trang AI** (không phải popup toolbar — xem lưu ý bên dưới) giờ **kéo thả di chuyển được** và có **nút thu nhỏ thành bong bóng tròn nổi**, bấm vào bong bóng để mở lại panel.

> ⚠️ Lưu ý kỹ thuật: **popup của tiện ích (cửa sổ hiện ra khi bấm icon trên thanh công cụ Chrome)** do chính Chrome kiểm soát vị trí — không thể kéo thả hay thu nhỏ được, đây là giới hạn của trình duyệt chứ không phải do code. Tính năng kéo thả/thu nhỏ ở mục 7 áp dụng cho **panel SMART nổi trên chatgpt.com/claude.ai/gemini.google.com**, do chính extension tự vẽ ra nên điều khiển được hoàn toàn.

---

## Kiến trúc đồng bộ dữ liệu (mới)

Trước đây việc đồng bộ chỉ chạy khi mở popup. Giờ:

- **`onboarding.html`** (tự mở khi cài tiện ích): người dùng đăng nhập/đăng ký 1 lần → lấy `idToken` + `refreshToken` từ Firebase Auth → lưu vào `chrome.storage.local` → tự bật `syncConsent = true`.
- **`background.js`** (service worker, chạy nền vĩnh viễn dù không mở popup): dùng `idToken`/`refreshToken` đó gọi thẳng **Firestore REST API** (không dùng Firebase SDK, vì SDK cần đối tượng `window` mà service worker không có) để ghi các câu hỏi mới lên `users/{uid}/entries`. `idToken` tự làm mới bằng `refreshToken` khi gần hết hạn.
- Đồng bộ chạy theo 2 cơ chế song song: **ngay khi có dữ liệu mới** (lắng nghe `chrome.storage.onChanged`) và **định kỳ mỗi 2 phút** (dự phòng qua `chrome.alarms`, phòng khi mạng lỗi ở lần đầu).
- Popup giờ chỉ là nơi xem lại lịch sử cục bộ + bật/tắt đồng bộ + nút "Ngắt kết nối" — không còn chứa form đăng nhập (đăng nhập chỉ làm ở `onboarding.html`, có thể mở lại bằng nút "Kết nối tài khoản" trong popup nếu đã ngắt kết nối).

---

## BƯỚC 0 — Cấu hình Firebase Console (bắt buộc, làm 1 lần)

Vào https://console.firebase.google.com/ → project **cdmtdc**:

### 0.1. Authentication
- **Authentication → Sign-in method** → bật **Email/Password**.
- **Authentication → Settings → Authorized domains** → thêm domain GitHub Pages của bạn (ví dụ `<username>.github.io`) sau khi deploy ở Bước 2.

### 0.2. Firestore Database
- **Firestore Database → Create database** (chế độ Production).
- Tab **Rules**, dán:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- **Publish**.

---

## BƯỚC 1 — Cài tiện ích Chrome (`extension-v3`)

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → chọn thư mục `extension-v3`.
2. Ngay khi cài xong, **1 tab mới sẽ tự mở** yêu cầu đăng nhập/đăng ký — chỉ cần làm **1 lần**, hệ thống tự bật đồng bộ liên tục từ đó.
3. Vào chatgpt.com / claude.ai / gemini.google.com — sẽ thấy panel nhỏ nổi cạnh ô nhập với 5 bước SMART (tiếng Việt) và nút "✨ Viết lại câu hỏi theo SMART". Panel có thể **kéo bằng thanh xanh phía trên** để di chuyển, hoặc bấm nút "–" để **thu nhỏ thành bong bóng tròn** (bấm lại vào bong bóng để mở ra).
4. Mở popup của tiện ích bất cứ lúc nào để xem lịch sử, tắt/bật đồng bộ, hoặc "Ngắt kết nối" tài khoản.

---

## BƯỚC 2 — Deploy website lên GitHub Pages (`website/`)

1. Tạo repo GitHub mới, đẩy toàn bộ nội dung thư mục `website/` lên nhánh `main`.
2. **Settings → Pages** → Source: nhánh `main`, thư mục `/ (root)` → Save.
3. Mở `https://<username>.github.io/<repo>/index.html`, đăng nhập bằng **đúng tài khoản đã tạo ở Bước 1** (dùng chung Firebase Auth) — không cần cấu hình API gì thêm, key đã cố định sẵn.

---

## Cách hoạt động của từng phần

### AI SMART Chatbot (`website/chatbot.html`)
- 5 bước bắt buộc: **Nêu vấn đề → Xác định chỗ thiếu → Gợi ý hướng đi → Tự hoàn thành → Kiểm tra & Giải thích**, không đưa đáp án cuối cùng cho tới khi học sinh tự thử.
- Trả lời được render Markdown (đậm, tiêu đề, danh sách, code) và LaTeX (công thức Toán/Lý/Hóa) bằng `marked` + `KaTeX`, đã lọc qua `DOMPurify` để an toàn.
- Mỗi lượt hỏi/đáp lưu vào `users/{uid}/entries/{id}` với `analyzed: false`.

### AI Learning Passport & ACI (`website/passport.html`)
- Gộp các prompt chưa phân tích, gửi AI chấm theo **rubric cố định 5 khoảng điểm** (xem chi tiết trong `website/smart-shared.js`, biến `ACI_RUBRIC`) để đảm bảo mọi lần chấm — dù cách nhau bao lâu — đều theo cùng 1 mốc chuẩn.
- Kết quả lưu lại vào entry (`analysis`, `analyzed: true`) → không phân tích lại, tiết kiệm API.
- Dashboard: ACI trung bình, xu hướng theo thời gian, phân bố theo môn học, bảng lịch sử chi tiết.

### Extension — panel SMART & đồng bộ nền
- `smart-hint.js`: panel kéo thả + thu nhỏ, nút viết lại câu hỏi theo khung SMART (gọi qua `background.js` để tránh vướng CSP của trang đích).
- `background.js`: đồng bộ liên tục lên Firestore bằng REST API (không cần mở popup), dùng token lấy từ `onboarding.html`.

---

## Giới hạn & lưu ý quan trọng

- **Selector DOM có thể lỗi thời**: ChatGPT/Claude/Gemini đổi giao diện thường xuyên. Nếu panel SMART hoặc log ngừng hoạt động ở 1 trang, mở `content-<site>.js` để cập nhật lại selector.
- **`host_permissions: ["https://*/*"]`**: cần thiết vì endpoint API và Firestore REST đều được gọi từ `background.js` tới domain khác nhau. Quyền này khá rộng — chỉ phù hợp dùng riêng (Load unpacked), không nên đăng public lên Chrome Web Store nếu chưa thu hẹp lại.
- **Firebase SDK compat được bundle local** trong `extension-v3/lib/` (chỉ dùng cho `onboarding.html`) — Manifest V3 không cho phép tải SDK từ CDN trong extension pages.
- **API key cố định trong code** (`website/auth-web.js`, `extension-v3/background.js`) — vì `website/` deploy public trên GitHub Pages, ai xem source cũng thấy key này. Bạn đã xác nhận đây là key test rủi ro thấp nên chấp nhận việc này.
- **Refresh token lưu trong `chrome.storage.local`**: đây là cơ chế thay thế cho việc chạy Firebase SDK trong service worker. Nếu người dùng đổi mật khẩu Firebase Auth, cần "Ngắt kết nối" rồi kết nối lại qua popup để lấy token mới.
