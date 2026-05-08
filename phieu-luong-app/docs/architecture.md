# Kiến trúc kỹ thuật — Phiếu Lương App

## Tổng quan

Phiếu Lương là ứng dụng Electron desktop chạy hoàn toàn cục bộ. Toàn bộ dữ liệu lương ở lại máy người dùng — không có backend, không upload.

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Process                        │
│                                                             │
│  ┌──────────────────────┐    IPC     ┌───────────────────┐  │
│  │   Renderer Process   │ ◄────────► │   Main Process    │  │
│  │  (React + Tailwind)  │            │  (Node.js)        │  │
│  │                      │            │                   │  │
│  │  screens/            │            │  modules/         │  │
│  │  ├── SetupScreen     │            │  ├── excelReader  │  │
│  │  ├── HomeScreen      │            │  ├── mappingValid │  │
│  │  ├── MappingScreen   │            │  ├── pdfRenderer  │  │
│  │  ├── PreviewScreen   │            │  ├── emailSender  │  │
│  │  ├── SendProgress    │            │  └── settingsStore│  │
│  │  ├── HistoryScreen   │            │                   │  │
│  │  └── PeriodPicker    │            │  ipc/handlers.ts  │  │
│  │                      │            │                   │  │
│  │  lib/                │            │  main.ts          │  │
│  │  ├── api.ts          │            │  preload.ts       │  │
│  │  ├── autoMapping.ts  │            │                   │  │
│  │  └── useOnline.ts    │            │                   │  │
│  └──────────────────────┘            └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ Gmail SMTP (port 465)
                                ▼
                        Inbox nhân viên

                    (tuỳ chọn) Vercel Tracker
                    ├── /api/t/[token].gif  ← pixel
                    └── /api/opens          ← query
```

## Stack công nghệ

| Layer | Công nghệ |
|---|---|
| Desktop shell | Electron 31 |
| Renderer | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| Build tool | Vite 5 |
| Main process | Node.js (TypeScript, compile bằng `tsc`) |
| Excel parsing | SheetJS (xlsx) |
| Email | Nodemailer (Gmail SMTP, TLS port 465) |
| PDF | Electron `printToPDF` + qpdf (mã hoá) |
| Storage | electron-store + Electron `safeStorage` |
| Packaging | electron-builder (DMG cho Mac, NSIS cho Windows) |
| Auto-update | electron-updater (GitHub Releases) |

---

## IPC Bridge

Electron enforces context isolation — renderer không truy cập Node.js APIs trực tiếp. Mọi giao tiếp đi qua `preload.ts` (contextBridge) và `ipcRenderer.invoke`.

### window.api — Surface được expose cho renderer

```typescript
window.api = {
  excel: {
    listSheets(filePath)          // → string[]
    read(filePath, sheetIndex)    // → { headers, rows }
  },
  mapping: {
    validate(rows, mapping)       // → Employee[]
  },
  pdf: {
    preview(employee, settings, opts)  // → { pdfPath, password }
  },
  email: {
    testConnection(user, password)     // → { ok, error? }
    dryRun(employees, settings, opts)  // → { ok, error?, sent? }
    sendBatch(employees, settings, opts)
    cancel()
  },
  settings: {
    get()                              // → { settings, hasPassword, hasTrackerSecret }
    save(settings, password?, trackerSecret?)
  },
  log: {
    list()                             // → LogEntry[]
  },
  checkpoint: {
    get()                              // → Checkpoint | null
    discard()
  },
  tracker: {
    queryOpens(endpoint, tokens)       // → { ok, tokens: Record<uuid, OpenStatus> }
    ping(endpoint, secret?)            // → { ok, error? }
  },
  onSendProgress(cb)                   // → unsubscribe fn
  checkQpdf()                          // → { ok, message? }
  openFile()                           // → filePath | null
}
```

Password và tracker secret **không bao giờ ra khỏi main process** — renderer chỉ thấy `hasPassword: boolean`.

---

## Routing (App.tsx)

App dùng state machine đơn giản — không có react-router. Route là union type:

```
loading → home
        ↘ setup (wizard hoặc từ settings)

home → sheet-pick (multi-sheet)
     → period-pick (multi-period)
     → mapping (auto-detect không đủ)
     → preview (auto-detect đủ, hoặc từ mapping)

preview → sending

sending → home (done / cancel)
        → sending (resend failed)

home → history
history → home
```

---

## Module: excelReader

**File**: `electron/modules/excelReader.ts`

### Header detection

SheetJS đọc toàn bộ sheet dưới dạng mảng 2D. Module scan 15 hàng đầu để tìm header row:

1. Tìm hàng chứa cả "họ tên" + "email" (exact match)
2. Fallback: hàng có nhiều string cell nhất + score keyword (họ, email, mã, lương...)
3. Nếu hàng tiếp theo là sub-header (≥3 string cell, ít số hơn string) → **merge** hai hàng: sub-header overrides header nếu không rỗng

Sub-header merge giải quyết bảng lương 2 cấp phổ biến (VD: hàng 1 "Lương cơ bản", hàng 2 "Tháng 4").

### Giới hạn

- File tối đa 25 MB
- Tối đa 10,000 dòng data

---

## Module: autoMapping

**File**: `src/lib/autoMapping.ts`

Nhận danh sách header string, trả về `Mapping` gợi ý + `complete: boolean`.

### Logic phân loại cột

Mỗi cột header được check theo thứ tự ưu tiên:

1. **Required fields**: hoTen, email, maNV, thucNhan — match bằng keyword list
2. **Optional fields**: viTri, phongBan, ngayCong, ngayCongChuan, giamTruNPT, tongThuNhapSauThue
3. **Excluded**: các cột tổng hợp trung gian, cột BHXH công ty đóng, cột tham chiếu... → bỏ qua
4. **ngoaiLuong** (deduction ngoài lương): "tạm ứng", "trừ ngoài lương"...
5. **ngoaiLuong** (addition ngoài lương): "cộng ngoài lương"...
6. **FORCE_INCOME**: "OT không chịu thuế" → thu nhập (tránh nhầm với khấu trừ vì có từ "không")
7. **khauTru**: BHXH, thuế, TNCN...
8. **thuNhap**: lương, phụ cấp, thưởng, OT...

Thu nhập sau đó được sort theo `incomeOrder()`: lương cơ bản → lương → thưởng → phụ cấp → OT → bổ sung → bonus → KPI.

---

## Module: mappingValidator

**File**: `electron/modules/mappingValidator.ts`

Nhận rows + mapping → `Employee[]`. Mỗi employee có `errors: string[]` (empty = hợp lệ).

### Validation

- Họ tên: không rỗng
- Email: regex `^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$` + kiểm tra trùng
- Mã NV: không rỗng (nếu có mapping)
- Thực nhận: parse thành số (hỗ trợ format Việt `1.000.000` và format quốc tế `1,000,000`)

### Auto notes

Nếu mapping có cột "Lương cơ bản" và "BHXH nhân viên đóng", validator tự gán note:
- Lương cơ bản: `"Mức đóng BHXH: 10,000,000 ₫"`
- BHXH NV: `"10,5% × 10,000,000 ₫"`

### PDF Password

Mỗi employee được sinh `pdfPassword` = OTP 6 chữ số ngẫu nhiên tại bước validate (không lưu lại sau khi batch xong).

---

## Module: pdfRenderer

**File**: `electron/modules/pdfRenderer.ts`

### Pipeline

```
Employee data
    ↓
buildHtml() → HTML string (A5, inline CSS, system fonts)
    ↓
htmlToPdf() → BrowserWindow ẩn → loadURL(data:text/html...) → printToPDF()
    ↓
PDF Buffer → write temp file
    ↓
encryptPdfWithPassword() → qpdf --encrypt (AES-256)
    ↓
Encrypted PDF path (temp file)
    ↓
emailSender đính kèm → cleanupPdf() xoá file
```

### HTML → PDF

Dùng `BrowserWindow.webContents.printToPDF()` thay vì puppeteer/wkhtmltopdf:
- Không cần install thêm gì
- Sử dụng Chromium engine có sẵn trong Electron
- CSS `@page { size: A5; margin: 10mm }` kiểm soát kích thước trang

### Encryption

qpdf được gọi qua `execFile` (không qua shell — tránh shell injection):
```
qpdf --encrypt <password> <password> 256 -- in.pdf out.pdf
```

Tìm qpdf theo thứ tự:
1. Bundled binary (Windows): `resources/qpdf-win/qpdf.exe`
2. System PATH: `qpdf`
3. Homebrew: `/opt/homebrew/bin/qpdf`
4. Chocolatey: `C:\ProgramData\chocolatey\bin\qpdf.exe`

### soThanhChu()

Hàm nội tại chuyển số thành chữ tiếng Việt (VD: `5.500.000 → "Năm triệu năm trăm nghìn đồng"`). Hỗ trợ đến hàng tỷ.

### Phụ lục (Phuluc)

Phiếu lương có thể đính kèm phụ lục chi tiết bảng công:
- `chamCong`: danh sách lần đi muộn/vi phạm (ngày, mô tả, số tiền phạt)
- `nghiPhep`: danh sách ngày nghỉ/WFH trong kỳ (loại, lý do, có tính lương không)
- `quyenLoi`: phép năm còn lại, WFH đã dùng (dạng progress bar)

Phụ lục hiện chưa có UI nhập liệu trong app — dự kiến cho phiên bản sau.

### Temp file cleanup

- Sau mỗi email gửi xong: `cleanupPdf()` xoá file + thư mục tạm
- Khi app khởi động: `sweepLeakedPdfs()` dọn toàn bộ `$TMPDIR/phieu-luong-pdf/` còn sót từ session trước (crash, force quit)

---

## Module: emailSender

**File**: `electron/modules/emailSender.ts`

### SMTP config

```
Host:    smtp.gmail.com
Port:    465
Secure:  true (TLS)
Timeouts: connection 20s, greeting 15s, socket 45s
```

### sendWithRetry

Retry với exponential backoff: 2s → 6s → fail. Tổng tối đa 3 lần gửi.

### Sanitize error

Trước khi throw, scrub password khỏi error message:
- Xoá literal password string
- Xoá AUTH PLAIN/LOGIN base64 blob (pattern: `AUTH PLAIN <base64>`)

### Tracking pixel

Nếu `trackerPixelUrl` được truyền vào, HTML body có thêm:
```html
<img src="https://tracker.../api/t/{uuid}.gif" width="1" height="1" style="display:block;width:1px;height:1px" />
```

Email body có cả `text` (plaintext) và `html` version.

---

## Module: settingsStore

**File**: `electron/modules/settingsStore.ts`

Dùng `electron-store` (JSON file trên disk) + `safeStorage` (OS keychain) để lưu:

| Key | Storage | Nội dung |
|---|---|---|
| `settings` | electron-store plaintext | Settings object (không nhạy cảm) |
| `encryptedPassword` | electron-store (base64) | Gmail App Password mã hoá bằng safeStorage |
| `encryptedTrackerSecret` | electron-store (base64) | Tracker bearer token mã hoá |
| `encryptedLog` | electron-store (base64) | Lịch sử gửi mã hoá |
| `encryptedCheckpoint` | electron-store (base64) | Checkpoint batch đang gửi mã hoá |

### Log migration

Phiên bản cũ lưu `log` plaintext → khi đọc, nếu thấy `log` tồn tại, encrypt và ghi lại vào `encryptedLog`, xoá `log`.

### Checkpoint

Mỗi email gửi xong, main process persist checkpoint (danh sách đã xử lý, danh sách recipients). Nếu bị crash/tắt ngang, lần mở tiếp theo:
1. `getCheckpoint()` trả về checkpoint
2. App hỏi "Tiếp tục gửi?"
3. Nếu tiếp tục: skip các rowIndex đã trong `processedRowIndexes`
4. Nếu bỏ qua: ghi phần đã gửi vào log, `clearCheckpoint()`

---

## IPC Handlers — Send Batch Flow

`email:send-batch` là handler phức tạp nhất:

```
1. Guard: batchInProgress = true (prevent concurrent)
2. Kiểm tra password, simulate mode
3. Resume detection: nếu có checkpoint khớp batch này → load processed set
4. Loop từng employee:
   a. Skip nếu rowIndex đã processed
   b. Cancel check (cancelRequested || window destroyed)
   c. Skip nếu employee có errors
   d. Simulate: delay 400-800ms, mark sent
   e. Real send:
      - renderPayslipPdf (HTML → PDF → qpdf)
      - sendWithRetry
      - cleanupPdf
      - Ghi recipient vào checkpoint
   f. Delay 1s giữa các email (rate limit avoidance)
5. finishLog() → appendLog() → clearCheckpoint()
6. emit 'done'
7. batchInProgress = false (finally)
```

Progress events (`email:send-progress`) được gửi real-time từ main → renderer qua `event.sender.send()`.

---

## Auto-update

Dùng `electron-updater` với provider GitHub:

```json
"publish": {
  "provider": "github",
  "owner": "nsongha",
  "repo": "BSM-PhieuLuong"
}
```

Flow:
1. Sau 3 giây khởi động (window render xong): `checkForUpdates()`
2. `update-available`: log, bắt đầu download ngầm
3. `update-downloaded`: dialog "Khởi động lại để cập nhật?"
4. User chọn → `quitAndInstall()`

Chỉ chạy trong production build (`!isDev`).

---

## Bảo mật

### Electron security settings

```typescript
webPreferences: {
  contextIsolation: true,   // renderer không access Node globals
  nodeIntegration: false,   // Node.js tắt trong renderer
  sandbox: false,           // cần false để preload dùng ipcRenderer
}
```

### PDF encryption

- AES-256 via qpdf
- `execFile` thay vì `exec` — args không đi qua shell, tránh injection
- Password không log, không persist trong cleartext

### safeStorage

- macOS: Keychain
- Windows: DPAPI (Data Protection API)
- Nếu safeStorage không khả dụng (rare edge case): log warning, fallback plaintext cho log; từ chối lưu checkpoint (tránh PII ra cleartext)

---

## Tracker (phieu-luong-tracker)

Vercel serverless project riêng — không phụ thuộc vào app Electron.

### `/api/t/[token].ts` — Pixel endpoint

- GET: validate token UUID, `HSET open:{token} {firstAt, lastAt, count, ua}` vào Upstash Redis, return 1×1 GIF
- Không phải GET: return GIF nhưng không record (tránh HEAD/bot inflate counter)
- Retention: 180 ngày (Redis `EXPIRE`)

### `/api/opens.ts` — Query endpoint

- GET hoặc POST với danh sách token UUIDs
- Kiểm tra Bearer token (nếu env `TRACKER_SECRET` được set)
- Redis pipeline `HGETALL open:{token}` cho từng token
- Batch size tối đa 500 tokens/request (chunked ở app side)
- Return `{ tokens: { [uuid]: OpenInfo } }`

### Privacy design

Server chỉ thấy token UUID (random) — không biết token thuộc về ai. Mapping token → nhân viên chỉ tồn tại local trong encrypted log của app.
