# Changelog

Tất cả thay đổi đáng chú ý của dự án được ghi lại ở đây.
Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
