# Phiếu lương — PDF Layout Spec

> Phiên bản chốt: 2026-05-10 (v0.1.1)

---

## Cấu trúc tổng thể

```
┌─────────────────────────────────────────┐
│ MASTHEAD                                 │
│  - Logo (trái) | Số phiếu (phải)         │
│  - "Phiếu lương" | Kỳ MM/YYYY            │
│                  | Ngày phát hành        │
├─────────────────────────────────────────┤
│ INFO GRID — 2 nhóm tách biệt             │
│  ┌────────────┬────────────┐             │
│  │ Họ và tên  │ Mã NV      │  Group 1    │
│  ├────────────┼────────────┤             │
│  │ Chức danh  │ Email      │  (fixed)    │
│  └────────────┴────────────┘             │
│  ┌────────────┬────────────┐             │
│  │ NC chuẩn   │ NC thực tế │  Group 2    │
│  └────────────┴────────────┘             │
├─────────────────────────────────────────┤
│ 1. THU NHẬP (+)                          │
│    items luong (step ①)                  │
│    ─── Tổng lương (italic subtle) ───    │
│    ═══ TỔNG LƯƠNG THEO NGÀY CÔNG ═══     │
│       + formula note                     │
│    items thuNhapBoSung (step ③)          │
│    ═══ TỔNG THU NHẬP ═══                 │
├─────────────────────────────────────────┤
│ 2. CÁC KHOẢN KHẤU TRỪ (−)               │
│    items khấu trừ                        │
│    ═══ TỔNG KHẤU TRỪ ═══                 │
├─────────────────────────────────────────┤
│ 3. THU NHẬP SAU THUẾ (=)                 │
│    Tổng thu nhập (+)                     │
│    Tổng các khoản khấu trừ (−)           │
│    ═══ TỔNG THU NHẬP SAU THUẾ ═══        │
├─────────────────────────────────────────┤
│ 4. CỘNG / TRỪ NGOÀI LƯƠNG (±)           │
│    items only — KHÔNG có subtotal        │
│    (hide cả section nếu không có items)  │
├─────────────────────────────────────────┤
│ ══ THỰC NHẬN ══                          │
│    + Bằng chữ (italic, right-aligned)    │
├─────────────────────────────────────────┤
│ Disclaimer                               │
└─────────────────────────────────────────┘
```

**Page size:** 148mm × auto height (long single page, không phân trang). Đo `scrollHeight` runtime → `printToPDF({ pageSize: { width: 5.83in, height: <content>in } })` (Electron 21+ dùng inches).

---

## Masthead

| Element | Nội dung |
|---|---|
| Trái | Logo công ty (nếu có) |
| Phải trên | "SỐ PHIẾU" + mã `PL-{year}-{month}-{maNV hoặc STT}` |
| Trái dưới | Tiêu đề **"Phiếu lương"** (20px bold) |
| Phải dưới | `Kỳ MM / YYYY` (mono, đỏ accent) + `Ngày phát hành: DD/MM/YYYY` (italic, muted) |

Khi Mã NV không được map: `docId` fallback `PL-{year}-{month}-{STT}` với STT padding 3 chữ số (e.g., `PL-2026-05-001`).

---

## Info Grid — 2 nhóm fixed positions

**Group 1** — 4 ô top fixed positions, không ảnh hưởng layout khi thiếu field:

| Vị trí | Field | Hiển thị |
|---|---|---|
| Top-left | `hoTen` | Luôn hiện (required) |
| Top-right | `maNV` | Hide nếu rỗng (cell trống vẫn giữ slot) |
| Bottom-left | `viTri` + `phongBan` | Combined (`Lập trình viên · Engineering`) |
| Bottom-right | `email` | Luôn hiện |

CSS: `display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto`. Mỗi ô có `min-height: 32px` tránh row collapse khi cell rỗng.

**Group 2** — 2 ô ngày công, dưới đường kẻ ngang `1px solid var(--line)`:

| Vị trí | Field |
|---|---|
| Trái | `ngayCongChuan` (đầy đủ tên, không viết tắt) |
| Phải | `ngayCong` → "Ngày công thực tế" |

**Style chung:** label uppercase muted 9px, value đen + bold (font-weight 600). Email dùng `word-break: break-all` cho long emails.

---

## Section 1 — Thu nhập (+)

3 step rõ ràng:

### Step ① — Items luong (chính thức / thử việc / CTV theo loại NV)

Render `luong[]` items theo thứ tự mapping. Items đã filter `soTien !== 0`.

| `soTien` | Hiển thị |
|---|---|
| `> 0` | Đen mặc định |
| `< 0` | Đỏ, prefix `−` |
| `= 0` | Filtered, không hiện |

Items có `note` → dòng nhỏ italic muted dưới label.

### Subtotal Tổng lương — italic subtle

Style: shrink-wrap row có **gạch trên dashed mờ** (border-top: 0.5px dashed muted). Label "Tổng lương:" + amount đều **italic, không bold**, màu ink-soft.

### Step ② — TỔNG LƯƠNG THEO NGÀY CÔNG (bordered emphatic)

Style: bold UPPERCASE, top + bottom shrink-wrap underline 1px solid line (cả 2 mảnh hơn section-head bottom). Là **tổng phụ chính** của bảng Thu nhập.

Dưới subtotal: **formula note** (italic muted, ngoài bg):
```
= 19.000.000 ÷ 22 × 22                              (mono, số trước)
(Tổng lương ÷ Ngày công chuẩn × Ngày công thực tế)  (italic, chữ sau)
```

App đọc thẳng giá trị từ Excel (cột `Tổng lương theo ngày công` = `AA`), không tính lại.

### Step ③ — Items thuNhapBoSung (sau attendance scaling)

Render `thuNhapBoSung[]` items: OT không chịu thuế, Các khoản bổ sung khác, Hỗ trợ nhà ở, KPI Chuyên cần (thường âm), Incentive, Bonus/Lương tháng 13.

### Subtotal TỔNG THU NHẬP — bordered emphatic

Style: top line full-width 1px solid ink (matches section-head bottom). Bottom shrink-wrap underline đúng khung của tổng phụ. Bold UPPERCASE.

App đọc từ Excel cột `TỔNG THU NHẬP` (= `AM` trong file BSM).

---

## Section 2 — Các khoản khấu trừ (−)

Render `khauTru[]` items với prefix `−` và màu đỏ.

**Canonical labels** (auto-mapping rename):

| Excel header | Display label |
|---|---|
| `Thuế 10%` | `Thuế TNCN (10%)` |
| `Thuế lũy tiến` | `Thuế TNCN (lũy tiến)` |
| `BHXH NV đóng (10.5%* lương cơ bản)` | `BHXH NV đóng` (note auto-tính `10,5% × {mức BHXH}`) |
| `Thuế TNCN` (gộp) | `Thuế TNCN` |
| `BHYT*` / `BHTN*` | `BHYT` / `BHTN` |

**Mức giảm trừ bản thân & NPT:**
- Source: field `giamTruNPT`
- **Không để số tiền ở cột phải** (tránh nhầm với khoản trừ thực tế)
- Hiển thị số nhỏ italic muted dưới label
- Không tính vào subtotal

**Subtotal Tổng khấu trừ:** bordered emphatic style (top full + bottom shrink underline), label đỏ.

---

## Section 3 — Thu nhập sau thuế (=)

Section riêng (tách khỏi Khấu trừ trong v0.1.1). Render khi `emp.tongThuNhapSauThue != null`.

**Items:**
- `Tổng thu nhập` — prefix `+`, đen
- `Tổng các khoản khấu trừ` — prefix `−`, đỏ

**Subtotal TỔNG THU NHẬP SAU THUẾ:** bordered emphatic, là tổng phụ của section.

App đọc từ Excel cột `Tổng thu nhập sau thuế` (= `AW`).

Math: `Tổng thu nhập − Tổng khấu trừ = Thu nhập sau thuế` (với rounding ±1k).

---

## Section 4 — Cộng / Trừ ngoài lương (±)

Hide cả section nếu `ngoaiLuong[]` rỗng.

Items với prefix `+`/`−` rõ ràng. **Không có subtotal** — user đọc từng item riêng.

Validator filter `soTien !== 0` → chỉ items có biến động hiển thị.

**Mapping convention:**
- Cột "tạm ứng", "trừ ngoài lương" → `isDeduction: true` → validator negate
- Cột "cộng ngoài lương" → `isDeduction: false` → giữ nguyên dương

---

## Thực nhận

- Block trắng + viền đen 2px solid (đen-trắng).
- Label "THỰC NHẬN" 13px uppercase bold màu ink (đen).
- Số 32px font-weight 900 (extra-bold) màu ink (đen).
- Bằng chữ: 11px italic, muted, **right-aligned**, hiện khi `thucNhan > 0`.

---

## Mapping data model (v0.1.1)

### Mapping shape

```ts
type Mapping = {
  hoTen: string;
  email: string;
  maNV: string;        // optional in render, required in mapping config
  code?: string;       // cột Code → detect loại NV
  thucNhan: string;
  viTri?: string;
  phongBan?: string;
  ngayCong?: string;
  ngayCongChuan?: string;

  // Bước ① — 3 paths theo loại NV (từng path có tongCol + items)
  luongChinhThuc?: LuongPath;
  luongThuViec?: LuongPath;
  luongCtv?: LuongPath;

  // Bước ② & ③ — cột tổng đã tính sẵn (Excel là source of truth)
  tongLuongNgayCongCol?: string;
  tongThuNhapCol?: string;
  thuNhapBoSung: Array<{ nhan: string; col: string; note?: string }>;

  // Khấu trừ + Thu nhập sau thuế
  khauTru: Array<{ nhan: string; col: string; note?: string }>;
  giamTruNPT?: string;
  tongThuNhapSauThue?: string;

  // Ngoài lương (mỗi item có isDeduction flag)
  ngoaiLuong: Array<{ nhan: string; col: string; note?: string; isDeduction?: boolean }>;
};

type LuongPath = {
  tongCol: string;                                              // cột Tổng lương đã tính
  items: Array<{ nhan: string; col: string; note?: string }>;  // breakdown items
};
```

### Detect loại NV

App cần phân loại NV để chọn `luongPath` phù hợp:

1. **Primary:** đọc cột `code` (nếu mapped). Normalize NFD bỏ dấu, lowercase, trim.
   - `on` / `active` / `chinh thuc` / `ct` / `official` → **chính thức**
   - `intern` / `thu viec` / `tv` / `probation` / `tap su` → **thử việc**
   - `ctv` / `cong tac vien` / `freelance` / `partner` → **CTV**
2. **Fallback:** check cột `Tổng lương` của thử việc / CTV → nếu có value > 0 → loại NV tương ứng.
3. **Default:** chính thức (loại phổ biến nhất).

### Auto-detect keywords

| Field | Keywords |
|---|---|
| `hoTen` | họ tên, họ và tên, fullname |
| `email` | email, e-mail, mail |
| `maNV` | mã nv, mã nhân viên, employee id |
| `code` | code (exact match) |
| `thucNhan` | thực nhận, lương thực nhận, net pay |
| `viTri` | chức danh, vị trí, position |
| `phongBan` | phòng ban, department |
| `ngayCong` | tổng ngày công, ngày công thực tế |
| `ngayCongChuan` | ngày công chuẩn |
| `tongLuongNgayCongCol` | tổng lương theo ngày công |
| `tongThuNhapCol` | tổng thu nhập (không match "sau thuế") |
| `tongThuNhapSauThue` | tổng thu nhập sau thuế |
| `giamTruNPT` | giảm trừ bản thân, mức giảm trừ |
| `luongChinhThuc.tongCol` | "tổng lương" exact match |
| `luongThuViec.tongCol` | tổng lương thử việc |
| `luongCtv.tongCol` | tổng lương ctv, tổng lương / thực tập |
| `luongChinhThuc.items` | lương cơ bản, thưởng hiệu suất, xăng xe, đồng phục, điện thoại, ăn trưa |
| `luongThuViec.items` | lương thử việc, ăn trưa |
| `thuNhapBoSung` | OT không chịu thuế, bổ sung khác, nhà ở, KPI chuyên cần, incentive, bonus, lương tháng 13 |
| `khauTru` | bhxh, bhyt, bhtn, thuế, tncn, tax, đoàn phí, khấu trừ |
| `ngoaiLuong` (trừ) | tạm ứng, trừ ngoài lương |
| `ngoaiLuong` (cộng) | cộng ngoài lương |

### Cột bị loại (EXCLUDED_FROM_AUTO)

Tổng lương gross, Thu nhập chịu thuế / tính thuế, Mức lương đóng BHXH, PC không chịu thuế, Ngày công (các loại), Kỳ lương / tháng lương, Lương tháng cụ thể, BHXH công ty đóng, Lương ngày công (sub-totals), Trước ĐC, Tổng số người phụ thuộc.

Cột "Thuế" (Y/N flag, exact match) cũng bị exclude.

---

## Excel reader — header detection

### Merge-fill (BSM-style 3-tier header)

File BSM có header 3 tầng (group → sub-group → detail). SheetJS để cell con của merged range = `''`. App fill anchor value xuống cells còn lại trong vùng header (15 row đầu) trước khi extract.

Ví dụ `AM4:AM6` merged = "TỔNG THU NHẬP" → sau fill, `AM5` = `AM6` = "TỔNG THU NHẬP" → header detection bắt được.

### Dedup duplicate header names

Nhiều file có header trùng tên ở các cột khác nhau (vd "Hỗ trợ ăn trưa" ở cả thử việc cột `K` và chính thức cột `S`). App append column letter cho duplicate: `Hỗ trợ ăn trưa (K)` và `Hỗ trợ ăn trưa (S)` để giữ data riêng biệt khi lookup `row[header]`.

Keyword matching dùng `String.includes()` nên `Hỗ trợ ăn trưa (K)` vẫn match keyword `ăn trưa`.

---

## File template Excel

Xem [`phieu-luong-template.xlsx`](../phieu-luong-app/mockup/) — sample 24 cột chuẩn.

File reference đầy đủ multi-path (chính thức / thử việc / CTV): [`docs/2026.03_Lương_BSM Labs_số liệu giả định.xlsx`](./).

---

## Phụ lục — render styling reference

| Element | Class | Style |
|---|---|---|
| Items list | `.row` | padding-left 14px, label gray + value mono |
| Subtotal subtle | `.subtotal-italic` | top dashed mờ, italic, no bold |
| Subtotal bordered | `.subtotal-bordered` | top full + bottom shrink-wrap, bold caps |
| Subtotal step (Tổng lương theo NC) | `.subtotal-bordered-step` | top + bottom shrink-wrap (cùng độ dài) |
| Section head | `.section-head` | bg `--paper-tint`, border-bottom 1px solid ink |
| Total block | `.total-block` | border-top + border-bottom 2px ink, bg trắng |
