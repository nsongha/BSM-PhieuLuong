# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại ở đây.
Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.5] - 2026-05-12

### Changed
- Phiếu lương — phần "Thu nhập sau thuế": rút gọn từ section đầy đủ (tiêu đề + 2 dòng chi tiết + tổng) còn 1 dòng tổng duy nhất, top border full-width, tinted bg, không bottom underline → trực quan hơn, đỡ trùng lặp số liệu đã có ở 2 bảng trên
- Phiếu lương — phần "Cộng / Trừ ngoài lương": luôn hiển thị (kể cả khi không có khoản nào) với đủ tiêu đề + nội dung + tổng. Khi rỗng → dòng "— Không có — 0 ₫" và tổng cộng 0 ₫ → user luôn thấy section này không bị mất khi không có biến động

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
