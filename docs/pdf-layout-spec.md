# Phiếu lương — PDF Layout Spec

> Phiên bản chốt: 2026-05-08

---

## Cấu trúc tổng thể

```
┌─────────────────────────────────┐
│ MASTHEAD                        │
├─────────────────────────────────┤
│ INFO GRID (thông tin nhân viên) │
├─────────────────────────────────┤
│ 1. THU NHẬP (+)                 │
├─────────────────────────────────┤
│ 2. CÁC KHOẢN KHẤU TRỪ (−)      │
├─────────────────────────────────┤
│ ── TỔNG THU NHẬP SAU THUẾ ──    │
├─────────────────────────────────┤
│ 3. CỘNG / TRỪ NGOÀI LƯƠNG (±)  │
├─────────────────────────────────┤
│ ══ THỰC NHẬN ══                 │
├─────────────────────────────────┤
│ Disclaimer                      │
└─────────────────────────────────┘
```

---

## Masthead

| Element | Nội dung |
|---|---|
| Trái | Logo công ty (nếu có) + tên công ty |
| Phải | Nhãn "Số phiếu" + mã `PL-{year}-{month}-{maNV}` |
| Dưới trái | Tiêu đề lớn **"Phiếu lương"** |
| Dưới phải | `Kỳ {MM} / {YYYY}` (màu đỏ, monospace) |

---

## Info Grid (2 cột)

Hiển thị có điều kiện — chỉ render khi field có dữ liệu:

| Label | Field | Kiểu |
|---|---|---|
| Họ và tên | `hoTen` | Luôn hiện |
| Mã nhân viên | `maNV` | Luôn hiện |
| Chức danh | `viTri` | Nếu có |
| Phòng ban | `phongBan` | Nếu có |
| Ngày công TT | `ngayCong` | Nếu có — hiển thị `{n} ngày` |
| Ngày công chuẩn | `ngayCongChuan` | Nếu có — hiển thị `{n} ngày` |
| Email | `email` | Luôn hiện, font nhỏ hơn |

---

## Section 1 — Thu nhập (+)

Render tất cả items trong `thuNhap[]` theo thứ tự mapping.

**Quy tắc hiển thị từng dòng:**
- `soTien > 0` → màu mặc định (đen)
- `soTien < 0` → màu đỏ, prefix `−` (dùng cho KPI Chuyên cần, điều chỉnh âm...)
- `soTien === 0` → **bị lọc, không hiển thị**
- Nếu item có `note` → hiển thị thêm dòng nhỏ nghiêng bên dưới label

**Subtotal:** `Tổng thu nhập = Σ thuNhap[].soTien` (bao gồm cả giá trị âm)

### Danh sách cột thu nhập (từ Excel)

| Cột Excel | Tên hiển thị | Ghi chú |
|---|---|---|
| Lương cơ bản | Lương cơ bản | note: "Mức đóng BHXH: X ₫" |
| Thưởng hiệu suất | Thưởng hiệu suất | |
| Xăng xe | Xăng xe | |
| Hỗ trợ đồng phục | Hỗ trợ đồng phục | |
| Hỗ trợ điện thoại | Hỗ trợ điện thoại | |
| Hỗ trợ ăn trưa | Hỗ trợ ăn trưa | |
| OT không chịu thuế | OT không chịu thuế | |
| Các khoản bổ sung khác | Các khoản bổ sung khác | |
| Hỗ trợ nhà ở | Hỗ trợ nhà ở | |
| Incentive / Power Up | Incentive / Power Up | |
| Bonus / Lương tháng 13 | Bonus / Lương tháng 13 | |
| KPI Chuyên cần | KPI Chuyên cần | Thường âm → hiển thị đỏ |

> **Không hiển thị:** PC không chịu thuế TNCN (hiện vật, không tính vào thực nhận)

---

## Section 2 — Các khoản khấu trừ (−)

Render tất cả items trong `khauTru[]` — giá trị trong Excel dương, hiển thị với prefix `−` và màu đỏ.

**Dòng đặc biệt — Mức giảm trừ bản thân & người phụ thuộc:**
- Nguồn: field `giamTruNPT` (mapped từ cột Excel)
- **Không để số tiền ở cột phải** (tránh nhầm với khoản trừ thực tế)
- Hiển thị số tiền nhỏ nghiêng ngay dưới label (dùng class `.note`)
- Không tính vào `Tổng khấu trừ`

**Subtotal:** `Tổng khấu trừ = Σ khauTru[].soTien` (không gồm giamTruNPT)

### Danh sách cột khấu trừ (từ Excel)

| Cột Excel | Tên hiển thị |
|---|---|
| BHXH nhân viên đóng | BHXH nhân viên đóng (note: `10,5% × {mức}`) |
| Thuế TNCN 10% | Thuế TNCN 10% |
| Thuế TNCN lũy tiến | Thuế TNCN (lũy tiến) |
| Mức giảm trừ bản thân & NPT | *(thông tin, không trừ trực tiếp)* |

---

## Dòng trung gian — Tổng thu nhập sau thuế

- Hiển thị **khi có** field `tongThuNhapSauThue` được map từ Excel
- Nằm giữa section Khấu trừ và section Cộng/Trừ ngoài lương
- Styling: đường kẻ dưới, label uppercase, số tiền 13px bold

---

## Section 3 — Cộng / Trừ ngoài lương (±)

Hiển thị **khi có** ít nhất 1 item trong `ngoaiLuong[]`.

**Quy tắc hiển thị:**
- `soTien > 0` → prefix `+`, màu mặc định (khoản cộng)
- `soTien < 0` → prefix `−`, màu đỏ (khoản trừ)

**Mapping convention:**
- Cột "tạm ứng", "trừ ngoài lương" → `isDeduction: true` → validator tự negate (Excel dương → lưu âm)
- Cột "cộng ngoài lương" → `isDeduction: false` → giữ nguyên dương

**Subtotal:** `Tổng cộng/trừ = Σ ngoaiLuong[].soTien`
- Nếu tổng âm → hiển thị đỏ với prefix `−`
- Nếu tổng dương → hiển thị thường với prefix `+`

### Danh sách cột ngoài lương (từ Excel)

| Cột Excel | isDeduction | Hiển thị |
|---|---|---|
| Các khoản cộng ngoài lương | false | +503.000 ₫ |
| Tạm ứng lương | true | −10.000.000 ₫ |

---

## Thực nhận

- Số lớn 26px bold
- `thucNhan >= 0` → màu đen
- `thucNhan < 0` → màu đỏ, prefix `−`
- Dòng **Bằng chữ** (italic, nhỏ) xuất hiện khi `thucNhan > 0`
  - Nếu âm: không hiển thị bằng chữ

---

## Mapping — nguồn dữ liệu

### Auto-detect (theo keyword trong tên cột)

| Field | Keywords tiêu biểu |
|---|---|
| `hoTen` | họ tên, họ và tên, fullname |
| `email` | email, e-mail |
| `maNV` | mã nv, mã nhân viên, employee id |
| `thucNhan` | thực nhận, net pay, lương thực nhận |
| `viTri` | chức danh, vị trí, position |
| `phongBan` | phòng ban, department |
| `ngayCong` | tổng ngày công, ngày công thực tế |
| `ngayCongChuan` | ngày công chuẩn |
| `giamTruNPT` | giảm trừ bản thân, mức giảm trừ |
| `tongThuNhapSauThue` | tổng thu nhập sau thuế, thu nhập sau thuế |
| `thuNhap[]` | lương, thưởng, hỗ trợ, phụ cấp, xăng xe, incentive, kpi, bonus... |
| `khauTru[]` | bhxh, bhyt, thuế, tncn, tax, khấu trừ... |
| `ngoaiLuong[]` (trừ) | tạm ứng, trừ ngoài lương |
| `ngoaiLuong[]` (cộng) | cộng ngoài lương |

### Cột bị loại khỏi auto-detect

Các cột tổng hợp / tính toán trung gian không map vào income/deduction:
- Tổng lương gross, Thu nhập chịu thuế, Thu nhập tính thuế
- Mức lương đóng BHXH, PC không chịu thuế (tổng hợp)
- Ngày công (các loại), Kỳ lương / tháng lương
- Lương tháng cụ thể (cross-month reference)

---

## File template Excel

Xem [`phieu-luong-template.xlsx`](../phieu-luong-app/mockup/) — 25 cột, hàng 2 có dữ liệu mẫu Nguyễn Ngọc Anh.
