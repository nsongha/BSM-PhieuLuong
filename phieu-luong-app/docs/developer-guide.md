# Hướng dẫn phát triển — Phiếu Lương App

## Mục lục

1. [Yêu cầu môi trường](#1-yêu-cầu-môi-trường)
2. [Cài đặt](#2-cài-đặt)
3. [Phát triển (dev mode)](#3-phát-triển-dev-mode)
4. [Cấu trúc dự án](#4-cấu-trúc-dự-án)
5. [Build](#5-build)
6. [Testing](#6-testing)
7. [Release](#7-release)
8. [Thêm tính năng mới](#8-thêm-tính-năng-mới)
9. [Debug tips](#9-debug-tips)

---

## 1. Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | ≥ 18 | Khuyến nghị LTS |
| npm | ≥ 9 | Có sẵn với Node |
| qpdf | bất kỳ | `brew install qpdf` (Mac) / `choco install qpdf` (Win) |
| Git | bất kỳ | |
| gh CLI | bất kỳ | Chỉ cần khi release |

**Build cross-platform**: electron-builder yêu cầu build **trên cùng nền tảng**:
- `.dmg` phải build trên Mac
- `.exe` phải build trên Windows

---

## 2. Cài đặt

```bash
git clone https://github.com/nsongha/BSM-PhieuLuong.git
cd BSM-PhieuLuong/phieu-luong-app
npm install
```

Sinh file mockup để test:
```bash
npm run seed-mockup
# → tạo mockup/sample-payroll.xlsx với 15 NV giả
```

---

## 3. Phát triển (dev mode)

```bash
npm run dev
```

Lệnh này chạy song song:
1. `npm run dev:vite` — Vite dev server trên `http://localhost:5173` (hot reload React)
2. `npm run dev:electron` — Đợi Vite sẵn sàng → compile TypeScript main process → mở Electron window

**Mở DevTools**: Cửa sổ Electron → `Cmd+Opt+I` (Mac) / `Ctrl+Shift+I` (Win/Linux). Hoặc set `DEBUG=1 npm run dev` để tự mở.

### Hot reload

- **Renderer** (React/Tailwind): hot reload tự động qua Vite HMR
- **Main process** (electron/): cần restart `npm run dev` sau khi sửa

### Chỉ rebuild main process

```bash
tsc -p electron/tsconfig.json
```

---

## 4. Cấu trúc dự án

```
phieu-luong-app/
├── electron/                    # Main process (Node.js, TypeScript)
│   ├── main.ts                  # Entry point: window, auto-updater, startup sweep
│   ├── preload.ts               # contextBridge: expose window.api cho renderer
│   ├── tsconfig.json            # TSConfig riêng cho main process (CJS output)
│   ├── ipc/
│   │   └── handlers.ts          # Đăng ký toàn bộ ipcMain.handle()
│   └── modules/
│       ├── excelReader.ts       # SheetJS: listSheets, readXlsx, header detection
│       ├── mappingValidator.ts  # Validate rows + map thành Employee[]
│       ├── pdfRenderer.ts       # HTML → PDF (printToPDF) + qpdf encrypt
│       ├── emailSender.ts       # Nodemailer SMTP + retry + sanitize error
│       └── settingsStore.ts     # electron-store + safeStorage (password, log, checkpoint)
│
├── src/                         # Renderer process (React, TypeScript)
│   ├── main.tsx                 # ReactDOM.createRoot
│   ├── App.tsx                  # State machine router, bootstrap, ResumeBanner
│   ├── index.css                # Tailwind directives + custom components (btn-*, card)
│   └── lib/
│   │   ├── api.ts               # Type definitions + window.api client wrapper
│   │   ├── autoMapping.ts       # Keyword-based column auto-detection
│   │   └── useOnline.ts         # Hook theo dõi kết nối mạng
│   └── screens/
│       ├── SetupScreen.tsx      # Wizard cài đặt: company, email, qpdf, tracker
│       ├── HomeScreen.tsx       # Home: drop zone, controls, tháng/năm picker
│       ├── UploadScreen.tsx     # (component phụ trợ)
│       ├── MappingScreen.tsx    # Manual column mapping
│       ├── PeriodPickerScreen.tsx # Chọn kỳ lương khi file có nhiều tháng
│       ├── PreviewScreen.tsx    # Danh sách nhân viên, xem PDF, dry-run, chọn gửi
│       ├── SendProgressScreen.tsx # Real-time progress, cancel, resend failed
│       └── HistoryScreen.tsx    # Lịch sử, tracker open status
│
├── mockup/
│   ├── sample-payroll.xlsx      # Sinh bằng seed-mockup (gitignored nếu nhạy cảm)
│   └── README.md
│
├── scripts/
│   ├── generate-mockup.mjs      # Sinh sample-payroll.xlsx với data giả
│   ├── release.mjs              # Bump version → build → GitHub Release
│   └── smoke-test.mjs           # Test pipeline đọc Excel → map → validate
│
├── docs/
│   ├── user-guide.md            # Hướng dẫn người dùng
│   ├── architecture.md          # Kiến trúc kỹ thuật (file này)
│   └── developer-guide.md       # Hướng dẫn phát triển
│
├── assets/
│   └── qpdf-win/                # qpdf binary bundled cho Windows build
│
├── index.html                   # Vite HTML entry
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json                # TSConfig cho renderer
├── tsconfig.node.json
├── package.json
├── CHANGELOG.md
└── VERSION                      # 4-digit version (e.g. 0.1.0.0)
```

---

## 5. Build

### macOS

```bash
npm run build:mac
# Output: release/Phieu Luong-X.Y.Z.dmg
```

### Windows

```bash
npm run build:win
# Output: release/Phieu Luong Setup X.Y.Z.exe
```

### Cả hai nền tảng (nếu có CI)

```bash
npm run build:all
```

### Lưu ý build

- Build ra `dist/` (renderer) và `dist-electron/` (main process) trước khi electron-builder đóng gói
- App chưa code-sign → cảnh báo Gatekeeper (Mac) và SmartScreen (Windows) khi mở lần đầu
- Windows: `assets/qpdf-win/` phải có binary qpdf trước khi build (xem `extraResources` trong `package.json`)

---

## 6. Testing

### Type check

```bash
npx tsc --noEmit -p tsconfig.json
```

### Smoke test pipeline

```bash
npm test
# = build:electron + tsc --noEmit + smoke-test.mjs
```

Smoke test thực hiện:
1. Đọc `mockup/sample-payroll.xlsx`
2. Detect periods, filter theo period mới nhất
3. Auto-detect mapping
4. Validate → assert các employee hợp lệ và lỗi đúng chỗ

> Không cần Electron để chạy smoke test — gọi trực tiếp CommonJS modules đã build.

### Test thủ công

1. `npm run seed-mockup` để sinh data mới
2. `npm run dev` → mở app
3. Upload `mockup/sample-payroll.xlsx`
4. Dùng **Chế độ Giả lập** (simulate) để test toàn bộ flow mà không gửi email

---

## 7. Release

### ✅ Cách 1 — Push tag → CI tự build & publish (LUÔN DÙNG CÁCH NÀY)

Đây là **đường ship duy nhất được khuyến nghị**. Local không cần build, chỉ bump version và push tag.

```bash
# 1. Bump version (qua PR + review, hoặc commit trực tiếp nếu là patch)
#    - phieu-luong-app/package.json   →  "version": "0.3.1"   (3-digit)
#    - phieu-luong-app/VERSION        →  0.3.1.0              (4-digit, +".0")
#    - phieu-luong-app/CHANGELOG.md   →  thêm entry [0.3.1]

# 2. Merge bump vào main qua PR (nếu chưa làm)
gh pr merge <pr-number> --squash

# 3. Pull main về local
git checkout main && git pull --ff-only

# 4. Tạo annotated tag khớp với version đã bump
git tag -a v0.3.1 -m "Release v0.3.1: <short summary>"

# 5. Push tag
git push origin v0.3.1
```

→ CI workflow `.github/workflows/build.yml` tự động:

| Job | Runner | Output |
|---|---|---|
| `build (macos-latest, mac)` | macOS native runner | `*.dmg` + `latest-mac.yml` + `*.blockmap` |
| `build (windows-latest, win)` | **Windows Server VM thật** | `*.exe` + `latest.yml` + `*.blockmap` |
| `release` (ubuntu-latest) | Ubuntu runner | Tạo GitHub Release, upload tất cả artifacts |

End-user app sẽ nhận update qua `electron-updater` (poll GitHub Releases mỗi 1 giờ + 3s sau khởi động).

### ⚠️ Cách 2 — `npm run release` (DEPRECATED, không dùng nữa)

`scripts/release.mjs` chạy mọi thứ local (bump + build + tag + push + gh release). **Có 3 bẫy lớn**:

1. **Build local trên Mac sẽ fail nếu chưa có wine + Rosetta**
   - `electron-builder --win` cần `rcedit` (Windows binary) chạy qua wine
   - Cached wine ở `~/Library/Caches/electron-builder/wine/` là Intel x86_64 binary
   - Apple Silicon (M1/M2/M3...) không chạy Intel binary trừ khi có Rosetta installed
   - **Hệ quả**: `cannot execute ... bad CPU type in executable` → build die.
   - Fix nếu BUỘC PHẢI build local: `sudo softwareupdate --install-rosetta --agree-to-license` + `brew install --cask wine-stable`. Nhưng vẫn nên dùng Cách 1.

2. **Script tự bump version từ `package.json` hiện tại**
   - Nếu bạn đã bump version qua PR rồi (ví dụ thành `0.3.1`), chạy `npm run release` sẽ bump LẦN NỮA thành `0.3.2`.
   - Không có cờ "use current version".

3. **Chỉ build Windows, không build Mac**
   - `scripts/release.mjs` line 65: `run('npm run build:win', ...)` — không có `build:mac`.
   - Mac users không nhận auto-update qua flow này.

→ **Đừng chạy `npm run release` nữa**. Dùng Cách 1 cho mọi release.

### CI workflow đã được fix từ PR #9

CI từng broken từ v0.2.3 đến v0.3.0 (lỗi `GH_TOKEN not set` do `electron-builder` tự ý publish trong lúc build). PR #9 sửa bằng `--publish never` + thêm `*.yml`/`*.blockmap` vào upload list. Từ v0.3.1 trở đi mọi release đều đi qua CI tag-push.

### Build local chỉ để TEST

- **Mac DMG (để test local cài đặt)**: `npm run build:mac` → `release/*.dmg`
- **Windows .exe**: **KHÔNG build trên Mac**. Chạy trên Windows hoặc dùng CI.

### Version files

Hai file phải đồng bộ:
- `package.json` → `"version": "0.3.1"` — semver 3-digit, electron-updater + npm
- `VERSION` → `0.3.1.0` — 4-digit, tooling nội bộ (gstack-ship)

Khi bump qua PR, sửa CẢ HAI file. CHANGELOG.md cũng nên có entry tương ứng.

### Version files

Hai file song song:
- `package.json` → `"version": "0.1.0"` — semver 3-digit, dùng cho `electron-updater`
- `VERSION` → `0.1.0.0` — 4-digit, dùng cho tooling nội bộ (`gstack-ship`)

---

## 8. Thêm tính năng mới

### Thêm IPC handler mới

1. Thêm function vào module trong `electron/modules/`
2. Đăng ký `ipcMain.handle('key:action', ...)` trong `electron/ipc/handlers.ts`
3. Thêm type signature vào `ApiShape` trong `src/lib/api.ts`
4. Expose qua `contextBridge` trong `electron/preload.ts`
5. Gọi từ renderer: `api().key.action(...)`

### Thêm screen mới

1. Tạo `src/screens/NewScreen.tsx`
2. Thêm route type vào union `Route` trong `App.tsx`
3. Thêm render condition trong JSX của `App`
4. Navigate bằng `setRoute({ name: 'new-screen', ...params })`

### Thêm cột auto-mapping

Trong `src/lib/autoMapping.ts`:
- Thêm keywords vào `INCOME_KEYWORDS`, `DEDUCTION_KEYWORDS`, hoặc tạo `FieldMatcher` mới trong `OPTIONAL`
- Thêm vào `EXCLUDED_FROM_AUTO` nếu là cột tổng hợp không muốn hiện trên phiếu lương

### Thêm trường vào phiếu lương PDF

Trong `electron/modules/pdfRenderer.ts`:
- `buildHtml()` — thêm HTML vào template
- `Employee` type (trong `preload.ts` và `src/lib/api.ts`) — thêm field
- `validateAndMap()` — extract field từ row

---

## 9. Debug tips

### Debug main process

```bash
# Mở DevTools của main process:
electron . --inspect=9229
# Attach VSCode debugger tại port 9229
```

### Xem electron-store trên disk

```
# macOS
~/Library/Application Support/phieu-luong-app/phieu-luong-config.json

# Windows
%APPDATA%\phieu-luong-app\phieu-luong-config.json
```

### Reset settings sạch

Xoá file JSON ở trên → app quay về Setup wizard.

### Kiểm tra temp PDFs

```bash
ls $TMPDIR/phieu-luong-pdf/
# Thường rỗng — nếu có file là từ crash trước
```

### Simulate mode

Luôn test với Simulate bật trước. Simulate:
- Không cần Gmail
- Không cần qpdf
- Không tạo PDF
- Delay 400-800ms/email để mô phỏng gửi

### DevTools trong production build

```bash
# Tạm mở DevTools bằng cách sửa main.ts:
mainWindow.webContents.openDevTools({ mode: 'detach' });
# Rebuild và test, nhớ revert
```

### Log level

Thêm `DEBUG=1` khi chạy dev để auto-open DevTools:
```bash
DEBUG=1 npm run dev
```
