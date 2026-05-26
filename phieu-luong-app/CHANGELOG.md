# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại ở đây.
Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.2] - 2026-05-26

### Added
- Loại nhân viên mới **`thucTap`** (thực tập sinh) — tách riêng khỏi nhóm CTV. Code nhận diện: `Intern`, `thuc tap`, `thuc tap sinh`, `part-time`.
- Phiếu lương hiển thị **nhãn lương rõ ràng** cho NV không chính thức:
  - Thử việc → **"Lương thử việc"**
  - Cộng tác viên → **"Lương cộng tác viên"**
  - Thực tập sinh → **"Lương thực tập"**

  Thay vì dòng italic mờ "Tổng lương:" trước đây — không cần thiết khi chỉ có 1 khoản.

### Changed
- `user-guide.md` cập nhật bảng Code và bảng layout phiếu, phân tách rõ 4 loại NV: Chính thức / Thử việc / Cộng tác viên / Thực tập sinh.

---

## [0.2.1] - 2026-05-26

### Fixed
- **Intern bị hiển thị lương 0 ₫**: từ khoá `intern` được chuyển từ nhóm `thuViec` sang `ctv` — thực tập sinh (intern) ≠ nhân viên thử việc về mặt pháp lý và nghiệp vụ. Nếu file Excel dùng `Code = Intern`, app giờ đọc đúng cột "Tổng lương CTV / thực tập" thay vì cột thử việc (thường không tồn tại → lương 0 ₫).
- Bổ sung từ khoá `thuc tap`, `part-time`, `parttime` vào nhóm `ctv` để nhận diện linh hoạt hơn.

### Changed
- Footer các nút hành động (PreviewScreen, SetupScreen) chuyển từ `sticky bottom` với hiệu ứng glass-blur sang **fixed footer** toàn chiều rộng có đường viền trên — nhất quán và dễ nhìn hơn.
- Tài liệu `user-guide.md` bổ sung hướng dẫn file có nhân viên thử việc / CTV, làm rõ phân biệt Intern ≠ Thử việc trong bảng giá trị cột Code.

---

## [0.2.0] - 2026-05-13

Bản milestone — củng cố phiếu lương PDF sau loạt polish 0.1.5 → 0.1.9.

### Added
- Bảng "Các khoản khấu trừ" có **4 ô fixed slots luôn hiển thị** dù Excel không có hoặc giá trị = 0:
  - `BHXH NV đóng`
  - `Mức giảm trừ bản thân & người phụ thuộc`
  - `Thuế TNCN (10%)`
  - `Thuế TNCN (lũy tiến)`
- Khi slot không có giá trị → in `0 ₫` muted (xám nhạt), không có dấu `−`. Có giá trị → đỏ với prefix `−`. Layout phiếu nhất quán giữa NV chính thức / thử việc / CTV
- Items khác trong khấu trừ (BHYT, BHTN, Đoàn phí, ...) vẫn dynamic — chỉ hiện khi Excel có
- Doc sync toàn bộ thay đổi 0.1.5 → 0.2.0 trong `docs/pdf-layout-spec.md`, `architecture.md`, `user-guide.md`, `README.md`

---

## [0.1.9] - 2026-05-12

### Fixed
- Disclaimer 2 đoạn (bảo mật + thắc mắc 24h) không còn bị tách trang. 3 lớp fix:
  - Đợi `document.fonts.ready` + 2 RAF trước khi measure `scrollHeight` → layout đã settle, không underestimate
  - `heightInches += 0.15"` buffer chống sai số đo lẻ tẻ
  - `.disclaimer` thêm `break-inside: avoid` + `page-break-inside: avoid` để engine không cắt section dù vẫn có sai số

---

## [0.1.8] - 2026-05-12

### Changed
- Disclaimer thay nội dung: bảo mật thông tin + thắc mắc reply email + liên hệ HR trong 24h (mặc định đồng ý sau thời gian này)
- CSS đổi `text-align: center` → `justify` để đoạn dài đọc dễ hơn, thêm margin giữa 2 đoạn

---

## [0.1.7] - 2026-05-12

### Fixed
- Strip phần giải thích trong ngoặc kép sau dấu `(-)` ở label "Các khoản trừ ngoài lương" (vd `( tạm ứng lương, truy thu thuế TNCN...)` → bỏ) để đồng nhất với dòng "Các khoản cộng ngoài lương (+)" không có giải thích. Regex `/(\([+\-±]\))\s*\([^)]*\)\s*$/`

---

## [0.1.6] - 2026-05-12

### Added
- Custom app icon thay icon Electron mặc định (Mac + Windows)

---

## [0.1.5] - 2026-05-12

### Changed
- Phiếu lương — phần "Thu nhập sau thuế": rút gọn từ section đầy đủ (tiêu đề + 2 dòng chi tiết + tổng) còn 1 dòng tổng duy nhất, top border full-width, tinted bg, không bottom underline → trực quan hơn, đỡ trùng lặp số liệu đã có ở 2 bảng trên
- Phiếu lương — phần "Cộng / Trừ ngoài lương": luôn hiển thị (kể cả khi không có khoản nào) với đủ tiêu đề + nội dung + tổng. Khi rỗng → dòng "— Không có — 0 ₫" và tổng cộng 0 ₫ → user luôn thấy section này không bị mất khi không có biến động

---

## [0.1.2 – 0.1.4] - 2026-05-12

### Fixed
- electron-builder `artifactName` khớp đúng filename trong `latest.yml` — auto-updater không còn fail vì không tìm thấy file
- Title bar hiển thị version (`Phiếu Lương v0.1.x`) để user xác định bản đang chạy
- Update dialog truyền `mainWindow` làm parent → dialog không bị khuất sau cửa sổ chính trên Windows

---

## [0.1.1] - 2026-05-10

### Added
- Phiếu lương dùng layout 1 trang dài (148mm × auto height) thay cho A5 phân trang — đọc mobile mượt, không còn whitespace giữa các trang
- 3 bước thu nhập rõ ràng trên phiếu: Tổng lương → Tổng lương theo ngày công (kèm công thức `÷ NCC × NCTT`) → Tổng thu nhập
- Detect loại NV (chính thức / thử việc / CTV) qua cột "Code" với normalize NFD + fallback theo cột Tổng lương có giá trị
- Auto-mapping nhận diện 3 path lương riêng biệt theo loại NV, kèm canonical labels cho khấu trừ (Thuế TNCN 10% / lũy tiến, BHXH NV đóng…)
- Bảng "Thu nhập sau thuế" tách riêng với 2 supplementary rows (Tổng thu nhập + Tổng các khoản khấu trừ) → Thu nhập sau thuế
- Ngày phát hành in dưới kỳ lương
- Banner cảnh báo khi cột Mã NV chưa được map (phiếu sẽ bỏ trống Mã NV, dùng STT làm số phiếu)

### Changed
- Mapping data model tách `thuNhap` cũ thành `luongChinhThuc` / `luongThuViec` / `luongCtv` (mỗi loại có `tongCol` + `items`) và `thuNhapBoSung` cho phụ thu sau ngày công
- App đọc thẳng các tổng đã tính sẵn trong Excel (`Tổng lương`, `Tổng lương theo ngày công`, `TỔNG THU NHẬP`) thay vì tự tính lại — Excel là source of truth
- Excel reader fill anchor cho merged cells ở header (fix các cột merge dọc kiểu BSM bị mất tên), dedupe header trùng tên bằng cách append column letter
- Info-grid tách 2 nhóm: 4 ô fixed positions (họ tên / mã NV / chức danh / email) ở trên, 2 ô ngày công ở dưới — thiếu mã NV không phá layout
- Section heads có background tinted, tổng phụ "đóng bảng" với top line full + bottom shrink-wrap underline
- Số tiền "Thực nhận" lên 32px font-weight 900, "Bằng chữ" 11px right-aligned
- Cộng/trừ ngoài lương bỏ subtotal gộp, chỉ hiện items có biến động, hide cả section nếu không có

### Fixed
- Phiếu không bị page-break giữa sections do chuyển sang long-page PDF (148mm × content height đo runtime)
- Header trùng tên ("Hỗ trợ ăn trưa" ở cả thử việc lẫn chính thức) không còn ghi đè dữ liệu lẫn nhau
- norm() collapse whitespace để match được header có `\n` trong tên cột

---

## [0.1.0] - 2026-05-09

### Added
- Ứng dụng Electron gửi phiếu lương hàng loạt qua email (Mac & Windows)
- Đọc dữ liệu lương từ file Excel, mapping cột tự động
- Tạo PDF phiếu lương theo mẫu, gửi đính kèm qua SMTP
- Màn hình xem trước phiếu lương trước khi gửi
- Lịch sử gửi mail theo kỳ lương
- Tự động cập nhật app qua GitHub Releases (`electron-updater`)
- Script release tự động: bump version → build → publish GitHub Release

### Changed
- Sắp xếp các khoản thu nhập theo danh mục để phiếu lương nhất quán

---
