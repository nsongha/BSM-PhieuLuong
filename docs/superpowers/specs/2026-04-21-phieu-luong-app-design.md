# Phiếu Lương App — Design Spec

**Ngày:** 2026-04-21
**Trạng thái:** Approved for planning
**Stakeholder:** "Chị" (end-user, non-technical, làm nhân sự, đang dùng Excel + copy-paste email thủ công)

## 1. Problem

Hiện chị gửi phiếu lương thủ công: dùng công thức Excel sinh 1 sheet phiếu lương cho từng mã nhân viên → copy → dán vào mail → gửi từng người. Chậm, dễ sai, mệt. Chị muốn "1 thao tác → gửi hàng loạt" và có thể tập dượt với data giả trước khi đụng data thật (lương là data nhạy cảm).

## 2. Goals & Non-goals

**Goals:**
- App Mac standalone (bấm đúp mở), chạy 100% local, không upload data ra server
- Mỗi kỳ lương: upload Excel → map cột → preview → dry-run → gửi hàng loạt → báo cáo
- Test mode với data mockup, chị làm quen trước khi dùng data thật
- PDF phiếu lương có password (CCCD/mã NV) đính kèm mail

**Non-goals (cho demo/MVP):**
- Không multi-user, không cloud sync, không mobile
- Không code-signing Apple Developer ($99/year) — chấp nhận cảnh báo Gatekeeper
- Không auto-update
- Không chỉnh layout phiếu lương trong app (template cố định, đổi phải sửa code)
- Không e2e test automation

## 3. User Decisions (đã chốt qua brainstorm)

| Câu hỏi | Chọn |
|---|---|
| Cách mở app | Electron Mac app (.dmg, bấm đúp) |
| Gửi email qua đâu | Gmail + App Password (SMTP qua nodemailer), yêu cầu bật 2FA |
| Format phiếu lương | PDF attachment + password (CCCD hoặc Mã NV) |
| Data input | Upload Excel (.xlsx) + mapping cột linh hoạt, save profile |
| Preview flow | Preview table + click xem PDF mẫu + dry-run về email test + confirm → gửi thật với progress |
| Test mode | Toggle — mọi email redirect về 1 email test, bất kể cột Email trong Excel |
| Log | Lưu metadata (timestamp, count, success/fail), KHÔNG lưu số lương |
| Template phiếu lương | Cố định 1 layout chuẩn VN (tên công ty + logo nhập 1 lần, bảng 3 phần) |

## 4. Architecture

**Stack:** Electron + React + TypeScript + Vite + Tailwind + shadcn/ui.

### Process boundary

**Main process** (Node.js, no UI) — mọi thứ đụng filesystem/crypto/network:
- `excelReader` — đọc `.xlsx` qua `xlsx` (SheetJS), trả rows + headers
- `pdfRenderer` — render HTML template trong hidden `BrowserWindow` → `printToPDF()` → encrypt bằng `muhammara`
- `emailSender` — `nodemailer` SMTP Gmail, gửi có attachment, retry 2× backoff 3s
- `secretsStore` — `safeStorage.encryptString()` (qua Keychain Mac) cho App Password
- `settingsStore` — `electron-store` cho settings không nhạy cảm + mapping profiles
- `logStore` — JSON file log metadata mỗi batch gửi

**Renderer process** (React UI) — chỉ điều phối, gọi main qua IPC:
- Screens: `SetupWizard`, `Home`, `Upload`, `Mapping`, `Preview`, `SendProgress`, `History`, `Settings`
- `contextIsolation: true` + `preload.ts` expose `window.api` type-safe

**IPC channels** (6 chính):
- `excel:read(filePath) → { headers, rows, errors }`
- `mapping:save(profile) → void` / `mapping:list() → Profile[]`
- `pdf:preview(employee, mapping, template) → pdfBuffer`
- `email:dry-run(sample, settings) → { ok, error }`
- `email:send-batch(employees, mapping, settings, testMode) → stream progress`
- `log:list() → LogEntry[]`

### Folder layout

```
phieu-luong-app/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── modules/
│   │   ├── excelReader.ts
│   │   ├── pdfRenderer.ts
│   │   ├── emailSender.ts
│   │   ├── secretsStore.ts
│   │   ├── settingsStore.ts
│   │   └── logStore.ts
│   └── ipc/handlers.ts
├── src/
│   ├── screens/
│   ├── components/
│   ├── templates/payslip.html
│   └── lib/api.ts
├── mockup/
│   ├── sample-payroll.xlsx   # 15 nhân viên giả
│   └── README.md
├── assets/icon.icns
└── electron-builder.yml
```

## 5. User Flow

### Bước 0 — Setup Wizard (chạy lần đầu)
- Nhập Gmail + App Password (kèm link + screenshots hướng dẫn tạo App Password)
- Nhập tên công ty, upload logo, nhập Email test cho dry-run
- App test SMTP ngay — chỉ cho Lưu nếu connection OK
- App Password lưu qua `safeStorage` (Keychain); còn lại qua `electron-store`

### Bước 1 — Home
- Nút lớn "📤 Kỳ lương mới"
- Link "📜 Lịch sử" + icon ⚙️ "Cài đặt"
- Badge toggle "🧪 Chế độ test: BẬT/TẮT" — BẬT thì nền vàng nhạt cảnh báo
- Dropdown Tháng/Năm (mặc định tháng hiện tại)

### Bước 2 — Upload Excel
- Drag-drop hoặc chọn `.xlsx`
- Preview 5 dòng đầu + tên cột phát hiện
- Match mapping profile cũ → auto-apply, skip bước 3

### Bước 3 — Mapping cột
- Bảng 2 cột: [Trường cần thiết] ↔ [Cột Excel]
- **Trường bắt buộc:** Họ tên, Email, Mã NV, CCCD (password), Thực nhận
- **Trường linh hoạt:** thêm N cặp `(Nhãn hiển thị, Cột Excel)` cho các khoản thu nhập/khấu trừ
- Checkbox "Lưu mapping với tên: ___"
- Validation: email regex, không trùng, CCCD không rỗng, số tiền là number → inline errors

### Bước 4 — Preview
- Bảng: STT | Họ tên | Email | Mã NV | Thực nhận
- Tổng số phiếu + tổng quỹ lương để chị đối chiếu Excel gốc
- Click dòng → popup PDF mẫu thật (encrypted, nhập CCCD mở)
- 3 nút: `← Sửa mapping` | `🧪 Gửi thử` | `📨 Gửi thật`

### Bước 5 — Dry run
- Tạo 3 PDF (2 đầu + 1 random) → gửi cả 3 về Email test
- Chị check layout + password
- Modal: `← Quay lại` | `Tiếp tục →`

### Bước 6 — Gửi thật
- Modal confirm: "Sắp gửi {N} phiếu đến {N} email. Không thể hoàn tác."
- Test mode BẬT → modal đổi thành cảnh báo vàng "toàn bộ {N} phiếu sẽ về {emailTest}"
- `SendProgress`: progress bar + live log (✅/❌ từng dòng). Gửi tuần tự, delay 1s chống throttle.
- Xong: báo cáo X/N thành công + nút tải CSV + về Home
- Log: timestamp, tháng, N, success, fail, testMode

### Bước 7 — History
- List lần gửi cũ (metadata only)
- Click xem chi tiết success/fail
- Không có "gửi lại" — muốn gửi lại phải upload Excel (đúng model "không lưu data lương")

## 6. Error Handling

| Tình huống | Xử lý |
|---|---|
| Excel thiếu cột bắt buộc | Block ở Mapping, lỗi rõ ràng |
| Email không hợp lệ / trùng | Inline error ở Preview, highlight, chị sửa Excel |
| SMTP fail (sai pass, Google block) | Setup block luôn. Batch: retry 2× backoff 3s. Fail → ghi log, tiếp tục người khác |
| App crash giữa batch | Log ghi sau từng mail → biết đã gửi tới đâu. KHÔNG resume tự động |
| Mất mạng | Modal "Đã gửi X/N, thử lại?" |
| PDF encrypt fail | Fail-closed: không gửi dòng đó, log lỗi, batch tiếp tục |

## 7. Security

- App Password không bao giờ ra khỏi main process (renderer chỉ thấy `isConfigured: boolean`)
- `safeStorage` encrypt App Password at rest (Keychain Mac)
- Template PDF render trong hidden `BrowserWindow` với `nodeIntegration: false`
- Không telemetry, không auto-update (giảm attack surface cho demo)
- `.xlsx` source không ghi disk app, chỉ stream → parse → discard
- Log chỉ metadata; tên nhân viên chỉ xuất hiện khi fail (để chị biết ai lỗi)
- Password PDF (CCCD/Mã NV) không log plaintext; zero-memory sau khi encrypt xong

## 8. Testing

1. **Unit (vitest)**: `excelReader` (edge cases: cột rỗng, number như string, merged cells), `mappingValidator` (email regex, duplicates), `pdfEncryption` (encrypt→decrypt verify)
2. **Component (vitest + RTL)**: MappingScreen, PreviewScreen
3. **Manual integration**: `mockup/sample-payroll.xlsx` — 15 nhân viên giả, email `test+01..15@gmail.com` (Gmail alias), có edge cases (thiếu email, CCCD rỗng, số âm, email sai format)
4. **Dogfood trước chị**: dev test đủ 3 vòng (dry-run → test mode → "thật" về email test) trước khi bàn giao

## 9. Build & Distribute

- `npm run build` → `electron-builder` → `PhieuLuong-0.1.0.dmg` (~150MB)
- Không code-sign (chị chuột phải → Open lần đầu để bypass Gatekeeper)
- Không auto-update

## 10. MVP Scope (V0.1) — "có thể demo trong ~2–3 ngày dev tập trung"

**V0.1 Must-have (ship):**
- Setup Wizard (Gmail + App Password + company name; skip logo nếu chậm)
- Upload `.xlsx` + mapping thủ công (KHÔNG save profile)
- Preview table + click xem PDF mẫu
- Dry-run về email test
- Test mode toggle + badge
- Gửi batch với progress + báo cáo cuối
- PDF password-protected (CCCD)
- Mockup file + README hướng dẫn test

**V0.2 (sau khi V0.1 ổn):**
- Save & auto-match mapping profile
- Logo công ty trong phiếu lương
- History screen
- Tải báo cáo CSV
- Retry với backoff

**V0.3 (polish):**
- Component test
- Code-sign + notarize (nếu ship production)
- Settings screen chỉnh sửa từ trong app
- Auto-update

**Thứ tự build V0.1 (~8 task):**
1. Scaffold Electron + React + Vite + TS + Tailwind
2. `excelReader` module + unit test
3. `pdfRenderer` module + encryption + unit test
4. `emailSender` module (nodemailer SMTP) + connection test
5. `secretsStore` + `settingsStore` (safeStorage + electron-store)
6. IPC preload + handler wiring
7. UI screens — scaffold + flow connecting
8. Mockup file + manual test + `.dmg` build

## 11. Open Questions (không block planning, giải quyết khi build)

- Font Unicode tiếng Việt trong PDF: dùng font hệ thống (SF Pro) hay bundle Noto Sans? → Quyết ở lúc làm template
- Trường "Mã NV" vs "CCCD" cho password: có trường hợp cả 2 đều có → chọn cái nào? Default dùng CCCD, có fallback Mã NV nếu CCCD rỗng
- Giới hạn Gmail SMTP: ~500 mail/ngày free, ~2000/ngày Workspace — đủ cho chị, nhưng nếu đi quá batch thì sao? Ghi cảnh báo nếu N > 400
