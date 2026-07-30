# AI SMART — Hướng dẫn tổng hợp

Dự án gồm 2 phần, dùng chung 1 project Firebase (`cdmtdc`):

1. **`website/`** — deploy lên GitHub Pages: Trang chủ, AI SMART Chatbot, AI Learning Passport & ACI, Cài đặt API.
2. **`extension-v3/`** — Tiện ích Chrome: gợi ý SMART ngay trên ô nhập của ChatGPT/Claude/Gemini, lưu lịch sử, đồng bộ (khi đồng ý) lên cùng tài khoản Firebase.

---

## BƯỚC 0 — Cấu hình Firebase Console (bắt buộc, làm 1 lần)

Vào https://console.firebase.google.com/ → project **cdmtdc**:

### 0.1. Authentication
- **Authentication → Sign-in method** → bật **Email/Password**.
- **Authentication → Settings → Authorized domains** → thêm domain GitHub Pages của bạn (ví dụ `<username>.github.io`) sau khi deploy xong ở Bước 2.

### 0.2. Firestore Database
- **Firestore Database → Create database** (chế độ Production).
- Vào tab **Rules**, dán:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép mỗi user đọc/ghi TOÀN BỘ dữ liệu con của chính mình
    // (bao gồm cả entries/ và settings/apiConfig)
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- Bấm **Publish**.

> ⚠️ Rules này quan trọng: nếu thiếu, dữ liệu của bạn hoặc bị chặn hoàn toàn, hoặc (nếu bạn để rules mở) bất kỳ ai cũng đọc được — vì cấu hình Firebase (`apiKey`, `projectId`...) vốn là thông tin public trong mọi app Firebase, thứ bảo vệ dữ liệu thực sự là Rules này.

---

## BƯỚC 1 — Cài tiện ích Chrome (`extension-v3`)

1. `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `extension-v3`.
2. Mở icon tiện ích → **Đăng ký** 1 tài khoản (email + mật khẩu ≥ 6 ký tự) — tài khoản này dùng chung với website.
3. Vào chatgpt.com / claude.ai / gemini.google.com — bạn sẽ thấy 1 panel nhỏ nổi cạnh ô nhập gồm 5 bước SMART và nút **"✨ Viết lại câu hỏi theo SMART"**.
4. Trong popup tiện ích, có ô **"Đồng ý đồng bộ dữ liệu hành vi lên AI Learning Passport"** — chỉ khi bạn tick ô này, lịch sử câu hỏi mới được gửi lên Firebase để website tính ACI. Nếu không tick, dữ liệu chỉ lưu cục bộ trên máy.

---

## BƯỚC 2 — Deploy website lên GitHub Pages (`website/`)

1. Tạo repo GitHub mới, đẩy toàn bộ nội dung thư mục `website/` lên nhánh `main`.
2. **Settings → Pages** → Source: nhánh `main`, thư mục `/ (root)` → Save.
3. Sau 1-2 phút, mở `https://<username>.github.io/<repo>/index.html`.
4. Đăng nhập bằng **đúng tài khoản đã tạo ở tiện ích Chrome** (dùng chung Firebase Auth).
5. **[Không bắt buộc]** Vào **Cài đặt API** để xem/đổi Endpoint / Model / API key. Hệ thống đã dùng sẵn key test cố định của bạn (`api.shopaikey.com`, model `gpt-5.4-nano`) — không cần làm gì thêm là dùng được ngay ở cả Chatbot, Passport lẫn Extension. Chỉ cần vào trang này nếu sau này bạn muốn đổi sang key/endpoint khác.

---

## Cách hoạt động của từng phần

### 1. AI SMART Chatbot (`website/chatbot.html`)
- Áp dụng system prompt bắt AI đi theo 5 bước **State → Missing → Assist → Resolve → Test**: không đưa đáp án cuối cùng cho tới khi học sinh tự thử.
- Mỗi lượt hỏi/đáp được lưu vào `users/{uid}/entries/{id}` với `analyzed: false`.

### 2. AI Learning Passport & ACI (`website/passport.html`)
- Khi mở trang: hiện màn hình loading → tìm các entry có `analyzed == false` → gộp lại gửi **1 lần** cho AI, yêu cầu trả về JSON dạng mảng số theo đúng thứ tự:

  `[aci, complexity, effort, subjectCode, riskScore]` — mỗi số 0-100 (riêng `subjectCode` là 0-5: Toán/Lý/Hóa/Văn/Anh/Khác).

- Kết quả được ghi lại vào từng entry (`analysis: {...}`, `analyzed: true`) → **lần sau các prompt này không bị phân tích lại**, tiết kiệm API key.
- Dashboard hiển thị: ACI trung bình, biểu đồ xu hướng ACI theo thời gian, phân bố theo môn học, và bảng lịch sử chi tiết.
- Schema 5 số này định nghĩa trong `website/smart-shared.js` — nếu muốn đổi ý nghĩa/số lượng chỉ số, sửa ở đúng 1 chỗ đó (cả prompt gửi AI lẫn phần đọc kết quả).

### 3. Extension — panel SMART & viết lại câu hỏi
- `smart-hint.js` chèn panel nổi cạnh ô nhập của ChatGPT/Claude/Gemini.
- Khi bấm "Viết lại theo SMART", extension gửi câu hỏi hiện tại cho `background.js`, nơi này gọi API (dùng cấu hình đã đồng bộ từ Firestore) để viết lại theo khung SMART, rồi điền lại vào ô nhập — bạn vẫn có thể chỉnh sửa trước khi gửi.
- Việc này **không tự động gửi** câu hỏi thay bạn — chỉ hỗ trợ viết lại.

### 4. Đồng bộ dữ liệu hành vi
- Content script luôn lưu câu hỏi cục bộ (`chrome.storage.local`) để hiển thị trong popup.
- Chỉ khi bạn tick ô đồng ý trong popup, dữ liệu mới được đẩy lên Firestore (`users/{uid}/entries`) để website Passport tính ACI.

---

## Giới hạn & lưu ý quan trọng

- **Firebase SDK được đóng gói sẵn local** trong `extension-v3/lib/` (không tải từ CDN) vì Chrome Manifest V3 không cho phép khai báo CSP với script nguồn ngoài trong `content_security_policy.extension_pages`. Nếu bạn tự cập nhật phiên bản Firebase sau này, hãy tải lại 3 file `firebase-app-compat.js`, `firebase-auth-compat.js`, `firebase-firestore-compat.js` và bỏ vào đúng thư mục `lib/`.
- **API key hiện đã nhúng cố định trong code** (`website/auth-web.js` và `extension-v3/background.js`) theo yêu cầu, để không cần cấu hình gì thêm. Vì `website/` sẽ deploy public lên GitHub Pages, **ai xem source code trang web (View Source / DevTools) cũng thấy được key này** — không chỉ riêng bạn. Bạn đã xác nhận đây là key test số dư nhỏ, không auto-nạp tiền nên chấp nhận rủi ro này; nếu sau này đổi ý, chỉ cần xoá giá trị nhúng sẵn ở 2 file trên và dùng lại trang **Cài đặt API** như cơ chế dự phòng (vẫn hoạt động song song, ưu tiên cấu hình người dùng tự lưu nếu có).

- **Selector DOM có thể lỗi thời**: ChatGPT/Claude/Gemini đổi giao diện thường xuyên. Nếu panel SMART hoặc việc lưu log ngừng hoạt động trên 1 trang, mở file `content-<site>.js` tương ứng, F12 để tìm lại selector đúng và cập nhật danh sách `inputSelectors` / selector tin nhắn.
- **`host_permissions: ["https://*/*"]`**: cần thiết vì endpoint API do bạn tự nhập (không cố định), nên extension cần quyền gọi mạng tới domain bất kỳ. Đây là quyền khá rộng — chỉ dùng cho tiện ích cài thủ công (Load unpacked) của riêng bạn, **không nên đăng lên Chrome Web Store** với quyền này nếu chưa thu hẹp lại theo đúng domain API bạn dùng.
- **API key**: được lưu trong Firestore (client-side) để dùng lại giữa web và extension — không phải là cơ chế bảo mật tuyệt đối, chỉ nên dùng với API test/nội bộ như bạn mô tả, không dùng chung với hệ thống quan trọng khác.
- **Chi phí API**: mỗi lần vào trang Passport, hệ thống chỉ gọi API cho các prompt CHƯA phân tích (nhờ cờ `analyzed`), và gộp nhiều prompt vào 1 lần gọi để tiết kiệm.
