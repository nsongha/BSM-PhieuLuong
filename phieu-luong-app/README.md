# Phiếu Lương App

Desktop app (Electron) để gửi phiếu lương hàng loạt qua email — chạy hoàn toàn cục bộ trên máy, không upload dữ liệu lương lên bất kỳ server nào.

**Hỗ trợ**: macOS (Intel + Apple Silicon) · Windows 10/11 (x64)

---

## Tính năng chính

- **Đọc Excel thông minh**: hỗ trợ file nhiều sheet, nhiều kỳ lương, header 2 cấp
- **Auto-mapping cột**: tự nhận diện cột Họ tên / Email / Mã NV / Lương / BHXH / Thuế... theo keyword tiếng Việt và tiếng Anh; phân loại NV (chính thức / thử việc / CTV) qua cột Code
- **Phiếu lương PDF đẹp**: layout 1 trang dài (148mm × auto height — đọc mobile mượt), trình bày 3 bước thu nhập rõ ràng (Tổng lương → Tổng lương theo ngày công với công thức → Tổng thu nhập), tách bảng "Thu nhập sau thuế" riêng, có logo công ty, đọc số thành chữ tiếng Việt, kèm phụ lục bảng công (tuỳ chọn)
- **Bảo vệ PDF bằng mật khẩu**: qpdf mã hoá AES-256, mỗi người nhận có mật khẩu riêng
- **Gửi hàng loạt qua Gmail SMTP**: retry tự động, delay giữa các email, tiến trình real-time
- **Checkpoint & resume**: gửi dở bị ngắt → lần sau mở app có thể tiếp tục
- **Chế độ test & giả lập**: kiểm tra toàn bộ flow trước khi gửi email thật
- **Lịch sử gửi**: mã hoá, ghi metadata (không ghi số tiền)
- **Tracking email mở** *(tuỳ chọn)*: pixel tracking qua server Vercel riêng
- **Tự cập nhật**: electron-updater qua GitHub Releases

---

## Bắt đầu nhanh

### Yêu cầu

- **Node.js ≥ 18**
- **qpdf** — mã hoá PDF:
  - macOS: `brew install qpdf`
  - Windows: `choco install qpdf`
- **Gmail App Password** — [tạo tại đây](https://myaccount.google.com/apppasswords) (cần bật 2FA trước)

### Chạy dev

```bash
cd phieu-luong-app
npm install
npm run seed-mockup    # tạo file Excel mẫu với 15 nhân viên giả
npm run dev            # mở app (Vite + Electron)
```

### Build

```bash
npm run build:mac      # → release/Phieu Luong-X.Y.Z.dmg   (chạy trên Mac)
npm run build:win      # → release/Phieu Luong Setup X.Y.Z.exe  (chạy trên Windows)
```

---

## Quy trình sử dụng

```
1. Cài đặt lần đầu
   └─ Nhập tên công ty + logo + Gmail + App Password

2. Kỳ lương mới
   ├─ Kéo thả file Excel hoặc bấm "Kỳ lương mới"
   ├─ Chọn sheet (nếu nhiều sheet)
   ├─ Chọn kỳ (nếu file chứa nhiều tháng)
   └─ Mapping cột (nếu auto-detect chưa đủ)

3. Preview & kiểm tra
   ├─ Xem danh sách hợp lệ / lỗi
   ├─ Xem trước PDF từng người
   └─ Gửi thử 1–3 email về hộp thư của mình (dry run)

4. Gửi thật
   ├─ Chọn người nhận (mặc định tất cả hợp lệ)
   └─ Theo dõi tiến trình real-time

5. Lịch sử
   └─ Xem ai đã nhận / ai lỗi / ai đã mở email
```

---

## Chế độ gửi

| Chế độ | Gửi email thật? | Đến đâu? | Dùng khi |
|---|---|---|---|
| **Giả lập** (mặc định bật) | Không | — | Làm quen app, test mapping |
| **Test** | Có | Email test của bạn | Kiểm tra layout PDF + nội dung email |
| **Dry Run** | Có | Email test của bạn | Preview 1–3 email mẫu trước khi gửi cả batch |
| **Thật** | Có | Email từng nhân viên | Gửi chính thức |

---

## Cấu trúc

```
phieu-luong-app/
├── electron/            # Main process (Node.js)
│   ├── main.ts          # App lifecycle, auto-updater
│   ├── preload.ts       # contextBridge → window.api
│   ├── ipc/handlers.ts  # Toàn bộ ipcMain.handle()
│   └── modules/
│       ├── excelReader.ts       # SheetJS, auto-detect header
│       ├── mappingValidator.ts  # Validate + map → Employee[]
│       ├── pdfRenderer.ts       # HTML→PDF→qpdf encrypt
│       ├── emailSender.ts       # Nodemailer SMTP + retry
│       └── settingsStore.ts     # electron-store + safeStorage
├── src/                 # Renderer (React + TypeScript + Tailwind)
│   ├── App.tsx          # State machine router
│   ├── lib/
│   │   ├── api.ts           # Typed client wrapper
│   │   └── autoMapping.ts   # Keyword-based column detection
│   └── screens/         # SetupScreen, HomeScreen, MappingScreen,
│                        # PreviewScreen, SendProgressScreen, HistoryScreen
├── scripts/
│   ├── generate-mockup.mjs  # Sinh Excel mẫu
│   ├── release.mjs          # Bump → build → GitHub Release
│   └── smoke-test.mjs       # Test pipeline không cần Electron
├── docs/
│   ├── user-guide.md        # Hướng dẫn người dùng
│   ├── architecture.md      # Kiến trúc kỹ thuật
│   └── developer-guide.md   # Hướng dẫn phát triển
└── mockup/
    └── sample-payroll.xlsx  # Data giả cho demo
```

---

## Bảo mật

- **Gmail App Password** mã hoá bằng Electron `safeStorage` (Keychain / DPAPI) — không bao giờ ra khỏi main process
- **File Excel** chỉ đọc trong RAM, không ghi ra disk app, không upload
- **PDF tạm** xoá ngay sau khi gửi; startup app dọn sạch file còn sót
- **Lịch sử** mã hoá bằng safeStorage — chỉ lưu metadata, không lưu số tiền
- **Tracker server** chỉ thấy token UUID, không biết tên/email nhân viên

---

## Tài liệu

| | |
|---|---|
| [Hướng dẫn người dùng](docs/user-guide.md) | Dành cho HR / người phụ trách trả lương |
| [Kiến trúc kỹ thuật](docs/architecture.md) | IPC bridge, modules, data flow |
| [Hướng dẫn phát triển](docs/developer-guide.md) | Setup, build, release, debug |
| [Tracker setup](../phieu-luong-tracker/README.md) | Deploy server tracking email mở |
| [Mockup data](mockup/README.md) | Cách dùng data giả để demo |
| [CHANGELOG](CHANGELOG.md) | Lịch sử thay đổi |

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev mode: Vite + Electron |
| `npm run seed-mockup` | Sinh `mockup/sample-payroll.xlsx` |
| `npm test` | Type check + smoke test pipeline |
| `npm run build:mac` | Build DMG (phải chạy trên Mac) |
| `npm run build:win` | Build EXE installer (phải chạy trên Windows) |
| `npm run release` | Patch release: bump → build → GitHub Release |
| `npm run release:minor` | Minor release |
| `npm run release:major` | Major release |

---

## Giới hạn hiện tại (v0.1)

- **Gmail only** — chưa hỗ trợ SMTP server tuỳ chỉnh hay Office 365
- **Mapping không lưu profile** — mỗi tháng cần auto-detect lại (nếu đổi file)
- **Phụ lục bảng công** — chưa có UI nhập liệu, cần data từ source khác
- **Code-sign chưa có** — cảnh báo Gatekeeper/SmartScreen khi cài lần đầu
- **~500 email/ngày** giới hạn của Gmail SMTP free; ~2000/ngày với Google Workspace
