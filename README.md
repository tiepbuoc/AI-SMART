# Ngã Rẽ 10
Website tĩnh (HTML/CSS/JS, không cần build) giúp học sinh lớp 9 chọn môn lớp 10.

Trang: index, khao-sat, nghe-nghiep, mon-hoc, so-sanh, ke-hoach, và **admin** (quản trị nội dung).
Nội dung (nghề, nhóm nghề, câu hỏi, môn học, việc cần làm) lưu trong **Firestore**, tài liệu `site/content`. Dữ liệu cá nhân của học sinh (kết quả khảo sát, so sánh, kế hoạch) vẫn chỉ lưu trong localStorage trên máy các em.

## Thiết lập Firebase (làm một lần)
Dự án Firebase: `nr10-34b6a` (cấu hình nằm trong `assets/js/firebase-config.js`).

1. **Firestore Database**: vào Build > Firestore Database > Create database (chế độ production).
2. **Rules**: dán nội dung `firestore.rules` vào Firestore > Rules > Publish. Không cần Authentication.
3. **Mật khẩu admin**: `nhat1234`, chỉ chặn ở giao diện `admin.html`. Muốn đổi, tạo mã SHA-256 mới và thay `PW_HASH` trong `assets/js/admin.js`.
4. Mở `admin.html`, nhập mật khẩu, bấm **Lưu lên Firestore** để nạp dữ liệu mẫu lần đầu.

Khi Firestore chưa có dữ liệu, mất mạng hoặc lỗi, site tự dùng bản lưu gần nhất trên máy hoặc dữ liệu mẫu trong `assets/js/data.js`, nên học sinh không bị trắng trang.

## Trang admin (`admin.html`)
- **Nghề nghiệp**: thêm, sửa, xóa, đổi thứ tự; chọn đúng 4 môn lựa chọn, ngành học, khối thi.
- **Nhóm nghề**: tên, màu, biểu tượng Font Awesome.
- **Câu hỏi khảo sát**: nội dung, nhóm, thứ tự.
- **Môn học**: môn lựa chọn lớp 10, môn ở câu hỏi cuối khảo sát, và nhóm nghề được cộng điểm theo môn mạnh. Đổi tên môn sẽ tự cập nhật ở các nghề.
- **Việc cần làm**: danh sách ở trang Kế hoạch.
- **Sao lưu**: tải/nhập JSON, khôi phục dữ liệu mẫu.

Thay đổi chỉ lên Firestore khi bấm **Lưu lên Firestore**. Trang không có liên kết từ menu, hãy mở trực tiếp `/admin.html`. Lưu ý: vì không dùng tài khoản, mật khẩu chỉ ngăn người dùng thường. Người rành kỹ thuật vẫn có thể ghi trực tiếp vào Firestore; hãy sao lưu JSON định kỳ.

Lưu ý: nếu thay đổi số câu hỏi khảo sát, học sinh đã làm khảo sát trước đó sẽ phải làm lại.

## Đưa lên GitHub Pages
Đẩy toàn bộ thư mục lên repo, vào Settings > Pages, chọn nhánh main, thư mục root.

## Trợ lý AI
Chatbot (nút tròn góc phải) gọi API chuẩn OpenAI-compatible giống chatbot AI SMART: `POST {ENDPOINT}/chat/completions`. Cấu hình ở đối tượng `AI` đầu file `assets/js/app.js` (`ENDPOINT`, `MODEL`, `KEY`, `SYSTEM`).

- Mở chatbot sẽ làm mờ nền phía sau; bấm vào nền, nhấn Esc hoặc nút × để đóng. Nút xoay tròn để bắt đầu cuộc trò chuyện mới.
- Lịch sử 20 tin gần nhất lưu trong localStorage của máy học sinh, nên chuyển trang vẫn giữ cuộc trò chuyện.
- Mỗi lần gửi, trợ lý được cấp thêm danh sách nghề của website và kết quả khảo sát gần nhất của học sinh (nếu có) để câu trả lời khớp với nội dung trên trang.
- Câu trả lời hiển thị Markdown (marked + DOMPurify, tải từ CDN khi cần).

**Bảo mật:** khóa đặt trong file JS thì ai mở trang cũng đọc được và có thể dùng hết hạn mức. Nên để `KEY` rỗng và trỏ `ENDPOINT` tới proxy riêng (ví dụ Firebase Cloud Function giữ khóa phía máy chủ, nhận `{model, messages}` và trả về dạng chat/completions), hoặc ít nhất đặt hạn mức chi tiêu thấp cho khóa này.
