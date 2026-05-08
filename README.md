# Phiếu Lương

Hệ thống gửi phiếu lương hàng loạt qua email — chạy hoàn toàn cục bộ trên máy tính, không upload dữ liệu lương lên server.

## Thành phần

| Thư mục | Vai trò |
|---|---|
| [`phieu-luong-app/`](phieu-luong-app/) | Desktop app (Electron · Mac + Windows) — đọc Excel, tạo PDF, gửi email |
| [`phieu-luong-tracker/`](phieu-luong-tracker/) | Serverless API (Vercel + Upstash Redis) — tracking email đã mở (tuỳ chọn) |
| [`docs/`](docs/) | Tài liệu thiết kế, layout PDF, flow chart |

## Luồng hoạt động tóm tắt

```
Excel bảng lương
      ↓
  [Electron App]
  ├─ Đọc file → auto-map cột
  ├─ Preview danh sách nhân viên
  ├─ Tạo PDF phiếu lương (HTML → printToPDF → qpdf encrypt)
  └─ Gửi email đính kèm PDF (Gmail SMTP)
                                    ↓
                            Inbox nhân viên
                            (PDF khoá bằng mật khẩu cá nhân)
```

## Tài liệu chi tiết

- [Hướng dẫn người dùng](phieu-luong-app/docs/user-guide.md) — HR / người phụ trách trả lương
- [Kiến trúc kỹ thuật](phieu-luong-app/docs/architecture.md) — lập trình viên
- [Hướng dẫn phát triển](phieu-luong-app/docs/developer-guide.md) — setup môi trường, build, release
- [Tracker setup](phieu-luong-tracker/README.md) — deploy server tracking email

## Bắt đầu nhanh

```bash
# Cài dependencies
cd phieu-luong-app && npm install

# Sinh dữ liệu demo
npm run seed-mockup

# Chạy dev
npm run dev
```

Xem chi tiết tại [Hướng dẫn phát triển](phieu-luong-app/docs/developer-guide.md).
