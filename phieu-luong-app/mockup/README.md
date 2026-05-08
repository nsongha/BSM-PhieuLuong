# Mockup data để test

File `sample-payroll.xlsx` được sinh bằng:

```bash
npm run seed-mockup
```

**Nội dung:**

- 15 nhân viên hợp lệ với tên Việt thật, Mã NV, CCCD, các khoản lương/phụ cấp/khấu trừ/thực nhận
- 3 edge cases cuối để test validation:
  - Dòng thiếu Email
  - Dòng Email sai format
  - Dòng thiếu CCCD (password)

**Email:**
- Mặc định dùng alias Gmail `nguyensongha2+01@gmail.com` → `nguyensongha2+15@gmail.com`
- Gmail cho phép `+tag` trong email → tất cả đổ về inbox `nguyensongha2@gmail.com`
- Đổi base: `EMAIL_BASE=your-gmail npm run seed-mockup`

**Cách dùng để demo:**

1. Chạy `npm run dev` (hoặc mở app `.dmg` đã build)
2. Setup Wizard: nhập Gmail của bạn + App Password + email test (cũng là Gmail của bạn)
3. Home → bật toggle "🧪 Chế độ test"
4. Chọn Tháng/Năm, bấm "Kỳ lương mới"
5. Chọn file `mockup/sample-payroll.xlsx`
6. Mapping: cột sẽ tự match (Họ và tên, Email, Mã NV, CCCD, Thực nhận). Thêm các khoản thu nhập/khấu trừ tuỳ ý.
7. Preview: check 15 hợp lệ + 3 lỗi. Click "Xem PDF" trên 1 dòng để verify layout.
8. "Gửi thử" → 3 mail sẽ đến inbox Gmail của bạn — check layout + password (nhập CCCD để mở PDF).
9. "Gửi thật" (vẫn ở chế độ test → toàn bộ 15 mail về inbox của bạn).
10. Khi chị đã quen, TẮT chế độ test, thay bằng file Excel thật.

**Lưu ý về Gmail:**
- Gmail SMTP giới hạn ~500 mail/ngày cho account free, ~2000/ngày cho Workspace.
- Nếu vượt, sẽ bị tạm khóa gửi. Không áp dụng cho demo 15 người.
