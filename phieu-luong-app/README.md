# Phiếu Lương — Mac App

App Electron để gửi phiếu lương qua email hàng loạt. Chạy 100% local trên Mac, không upload data ra server.

**Flow:** Upload Excel → map cột → preview + dry-run → gửi hàng loạt → báo cáo. Kèm **chế độ test** để làm quen trước khi đụng data lương thật.

## Yêu cầu hệ thống

- macOS (Intel hoặc Apple Silicon) hoặc Windows 10/11 (x64)
- Node.js ≥ 18 (để build)
- **qpdf** — để đặt password cho PDF:
  - macOS: `brew install qpdf`
  - Windows: `choco install qpdf` (cần [Chocolatey](https://chocolatey.org/install)) hoặc tải tại [qpdf.sourceforge.io](https://qpdf.sourceforge.io)
- Tài khoản Gmail có bật 2FA + App Password ([hướng dẫn](https://myaccount.google.com/apppasswords))

## Cài đặt & chạy dev

```bash
cd phieu-luong-app
npm install
npm run seed-mockup     # sinh file mockup/sample-payroll.xlsx (15 NV giả)
npm run dev             # mở app ở chế độ dev (hot reload)
```

## Build

```bash
# macOS (chạy trên Mac)
npm run build:mac
# output: release/Phieu Luong-0.1.0.dmg

# Windows (chạy trên Windows)
npm run build:win
# output: release/Phieu Luong Setup 0.1.0.exe
```

> Bản demo chưa code-sign. Mac: cảnh báo "app từ nhà phát triển không xác định" → chuột phải → Open. Windows: SmartScreen cảnh báo → More info → Run anyway.

### CI build tự động

Push tag `v0.1.0` lên GitHub → `.github/workflows/build.yml` tự build cả `.dmg` + `.exe` và release artifacts. Xem workflow tại `../.github/workflows/build.yml`.

## Demo nhanh với data giả

Xem `mockup/README.md`.

## Cấu trúc

```
phieu-luong-app/
├── electron/            # Main process (Node.js)
│   ├── main.ts          # App lifecycle + window
│   ├── preload.ts       # Expose window.api type-safe
│   ├── modules/
│   │   ├── excelReader.ts
│   │   ├── mappingValidator.ts
│   │   ├── pdfRenderer.ts      # HTML → PDF (printToPDF) + qpdf encrypt
│   │   ├── emailSender.ts       # nodemailer Gmail SMTP
│   │   └── settingsStore.ts     # electron-store + safeStorage
│   └── ipc/handlers.ts
├── src/                 # Renderer (React)
│   ├── App.tsx
│   ├── lib/api.ts       # Typed client của window.api
│   └── screens/         # Setup, Home, Upload, Mapping, Preview, SendProgress, History
├── mockup/
│   └── sample-payroll.xlsx
├── scripts/generate-mockup.mjs
└── docs/superpowers/specs/2026-04-21-phieu-luong-app-design.md
```

## Bảo mật

- Gmail App Password được encrypt bằng Electron `safeStorage` (Keychain của Mac)
- Password không bao giờ ra khỏi main process — renderer chỉ thấy `isConfigured: boolean`
- File Excel không được ghi lên disk app: chỉ đọc stream → parse → discard
- PDF tạm được xoá ngay sau khi gửi xong
- Log chỉ lưu metadata (số, thời gian, success/fail), KHÔNG lưu số tiền lương cụ thể
- Password PDF = CCCD (fallback Mã NV nếu CCCD rỗng)

## Trạng thái

**V0.1 (hiện tại):** Setup wizard, upload + mapping thủ công, preview table, dry-run, test mode, send batch với progress, PDF password-protected, history metadata.

**V0.2 (chưa làm):** Save mapping profile (tự match lần sau), tải CSV báo cáo, retry với backoff nâng cao.

**V0.3:** Code-sign + notarize, auto-update, editor template trong app.

Xem spec đầy đủ tại [docs/superpowers/specs/2026-04-21-phieu-luong-app-design.md](../docs/superpowers/specs/2026-04-21-phieu-luong-app-design.md).
