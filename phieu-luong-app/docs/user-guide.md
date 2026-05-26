# Hướng dẫn sử dụng — Phiếu Lương App

Dành cho HR / người phụ trách trả lương. Không yêu cầu kiến thức kỹ thuật.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt lần đầu](#2-cài-đặt-lần-đầu)
3. [Cấu hình ứng dụng](#3-cấu-hình-ứng-dụng)
4. [Quy trình gửi phiếu lương hàng tháng](#4-quy-trình-gửi-phiếu-lương-hàng-tháng)
5. [Các chế độ gửi](#5-các-chế-độ-gửi)
6. [Xem lịch sử gửi](#6-xem-lịch-sử-gửi)
7. [Xử lý sự cố](#7-xử-lý-sự-cố)
8. [Bảo mật và quyền riêng tư](#8-bảo-mật-và-quyền-riêng-tư)

---

## 1. Yêu cầu hệ thống

| | Yêu cầu |
|---|---|
| **Hệ điều hành** | macOS 10.15+ (Intel/Apple Silicon) hoặc Windows 10/11 (64-bit) |
| **Phần mềm bổ sung** | `qpdf` — để khoá mật khẩu PDF |
| **Tài khoản email** | Gmail có bật xác minh 2 bước + App Password |
| **Kết nối mạng** | Cần khi gửi email thật; xem preview PDF không cần mạng |

### Cài qpdf

**macOS:**
```bash
brew install qpdf
```

**Windows (cần chạy PowerShell với quyền Admin):**
```bash
choco install qpdf
```
Nếu không có Chocolatey, tải trực tiếp tại [qpdf.sourceforge.io](https://qpdf.sourceforge.io).

### Tạo Gmail App Password

App Password là mật khẩu 16 ký tự đặc biệt thay cho mật khẩu Gmail thông thường, **bắt buộc khi dùng SMTP với tài khoản có bật 2FA**.

1. Vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Chọn "Mail" → "Windows Computer" (hoặc Other)
3. Nhấn "Generate"
4. Ghi lại 16 ký tự hiển thị — chỉ hiển thị một lần

---

## 2. Cài đặt lần đầu

### macOS

1. Tải file `.dmg` từ trang Releases trên GitHub
2. Mở file DMG, kéo **Phiếu Lương.app** vào thư mục Applications
3. Lần đầu mở: **chuột phải → Open** (bỏ qua cảnh báo Gatekeeper vì app chưa code-sign)

### Windows

1. Tải file `.exe` (installer NSIS) từ trang Releases
2. Chạy installer — Windows SmartScreen cảnh báo → **More info → Run anyway**
3. App tự cài và tạo shortcut trên Desktop

---

## 3. Cấu hình ứng dụng

Lần đầu mở app, màn hình **Cài đặt** xuất hiện tự động.

### Thông tin công ty

| Trường | Mô tả |
|---|---|
| **Tên công ty** | Hiển thị trên phiếu lương và phần ký tên email |
| **Logo** | Tải ảnh logo (PNG/JPG) — hiển thị trên đầu mỗi phiếu lương |

### Cấu hình email

| Trường | Mô tả |
|---|---|
| **Gmail gửi** | Địa chỉ Gmail dùng để gửi (ví dụ: `hr@company.com`) |
| **App Password** | 16 ký tự từ bước tạo App Password ở trên |
| **Email test** | Địa chỉ nhận email khi dùng Chế độ Test (thường là email của chính bạn) |

Sau khi nhập, nhấn **"Kiểm tra kết nối"** để xác nhận Gmail SMTP hoạt động. Kết quả "Kết nối Gmail thành công" là sẵn sàng gửi.

### Tracking email (tuỳ chọn)

Nếu đã deploy [phieu-luong-tracker](../../phieu-luong-tracker/README.md):

| Trường | Mô tả |
|---|---|
| **Tracker URL** | URL Vercel của tracker, ví dụ: `https://phieu-luong-xyz.vercel.app` |
| **Tracker Secret** | Bearer token bảo vệ API tracker (nếu có cấu hình) |
| **Bật tracking** | Toggle để chèn pixel vào email |

> Khi bật tracking, mỗi email sẽ có pixel ảnh 1×1 vô hình. Khi nhân viên mở email, app có thể biết "đã mở" hay chưa.

---

## 4. Quy trình gửi phiếu lương hàng tháng

### Bước 1: Chuẩn bị file Excel

File Excel cần có ít nhất các cột sau (tên cột linh hoạt — app tự nhận):

| Thông tin | Tên cột gợi ý |
|---|---|
| Họ và tên | "Họ và tên", "Họ tên", "Fullname" |
| Email | "Email", "E-mail" |
| Mã nhân viên | "Mã NV", "Mã Nhân viên", "Employee ID" *(tuỳ chọn — phiếu sẽ hiện STT thay nếu thiếu)* |
| Thực nhận | "Thực nhận", "Thực lĩnh", "Net Pay" |
| Code (loại NV) | "Code" — giá trị `ON` (chính thức) / `Intern` (thử việc) / `CTV` *(tuỳ chọn)* |

App tự nhận:
- Các khoản trong **Tổng lương** (chính thức): Lương cơ bản, Thưởng hiệu suất, Xăng xe, Đồng phục, Điện thoại, Ăn trưa
- Các khoản **thu nhập bổ sung** sau ngày công: OT không chịu thuế, KPI Chuyên cần, Bonus, Incentive, Hỗ trợ nhà ở...
- Các khoản **khấu trừ**: BHXH, BHYT, BHTN, Thuế TNCN (10%), Thuế TNCN (lũy tiến)
- Các cột **tổng tính sẵn**: "Tổng lương", "Tổng lương theo ngày công", "TỔNG THU NHẬP", "Tổng thu nhập sau thuế" — app đọc thẳng giá trị đã tính trong Excel, không tính lại

### File có nhân viên thử việc hoặc CTV

> ⚠️ Nếu file có nhân viên thử việc hoặc CTV, cần thêm cột và dùng đúng giá trị Code — nếu không, lương thử việc sẽ hiển thị **0 ₫** trên phiếu.

#### Cột Code — bắt buộc khi có nhiều loại nhân viên

Đặt tên cột header là **`Code`** (chính xác). Giá trị trong cột:

| Loại nhân viên | Giá trị được nhận | Ví dụ |
|---|---|---|
| Chính thức | `ON`, `CT`, `chinh thuc`, `active`, `official` | `ON` |
| Thử việc | `TV`, `thu viec`, `probation`, `tap su` | `TV` |
| CTV / Thực tập | `CTV`, `Intern`, `thuc tap`, `part-time`, `freelance`, `partner` | `CTV` hoặc `Intern` |

> **Lưu ý**: `Intern` (thực tập sinh) và `Thử việc` là hai khái niệm khác nhau. App xếp Intern cùng nhóm CTV/thực tập vì cả hai thường dùng chung cột lương trong file Excel.

> ⚠️ **Lưu ý quan trọng**: Không dùng các giá trị chứa chuỗi `on` hoặc `ct` cho nhân viên thử việc/CTV.  
> Ví dụ sai: `"on-board"`, `"contract-TV"`, `"intern-on"` → app sẽ nhầm thành **chính thức**.  
> Chỉ cần dùng đúng `TV` hoặc `Intern` là đủ.

#### Cột lương thử việc — bắt buộc có cột tổng

App chỉ đọc được lương thử việc khi có **cột tổng riêng** tên chính xác là:

```
Tổng lương thử việc
```

*(Hoa/thường không quan trọng, có thể viết `TỔNG LƯƠNG THỬ VIỆC` hay `tổng lương thử việc` đều được)*

Ngoài cột tổng, nên có thêm các cột breakdown để phiếu lương hiện chi tiết:

| Cột | Tên được nhận |
|---|---|
| Lương thử việc (khoản chính) | `Lương thử việc` |
| Phụ cấp ăn trưa | `Hỗ trợ ăn trưa`, `Ăn trưa` |
| **Tổng (bắt buộc)** | **`Tổng lương thử việc`** |

#### Ví dụ cấu trúc cột cho file hỗn hợp

```
| Code | Họ và tên | Email | Lương cơ bản | Lương thử việc | Hỗ trợ ăn trưa | Tổng lương | Tổng lương thử việc | ... | Thực nhận |
|------|-----------|-------|-------------|----------------|-----------------|------------|---------------------|-----|-----------|
| ON   | Nguyễn A  | ...   | 10,000,000  |                |                 | 10,500,000 |                     | ... | 9,200,000 |
| TV   | Trần B    | ...   |             | 6,000,000      | 730,000         |            | 6,730,000           | ... | 6,200,000 |
| CTV  | Lê C      | ...   |             |                |                 |            |                     | ... | 8,000,000 |
```

**Quy tắc điền**:
- Nhân viên chính thức: điền vào cột lương chính thức, **để trống** cột thử việc/CTV
- Nhân viên thử việc: điền vào cột lương thử việc, **để trống** cột chính thức
- Cột "Thực nhận" và các cột khấu trừ (BHXH, Thuế...) điền bình thường cho tất cả loại

### Layout phiếu lương đồng nhất (v0.2.0)

Phiếu lương xuất ra có 4 thông tin khấu trừ **LUÔN hiển thị** (kể cả khi không có hoặc giá trị = 0 thì in `0 ₫`):
1. `BHXH NV đóng`
2. `Mức giảm trừ bản thân & người phụ thuộc`
3. `Thuế TNCN (10%)`
4. `Thuế TNCN (lũy tiến)`

Bảng "Cộng / Trừ ngoài lương" cũng luôn hiển thị (rỗng → "— Không có — 0 ₫"). Nhờ vậy phiếu của NV chính thức / thử việc / CTV nhìn nhất quán — không bị "co lại" tuỳ loại.

**Hỗ trợ cột "Kỳ lương"**: Nếu file Excel chứa nhiều tháng (định dạng `MM/YYYY` hoặc `YYYY-MM`), app tự hỏi bạn chọn kỳ nào trước khi tiếp tục.

**Hỗ trợ nhiều sheet**: Nếu file có nhiều sheet, app hỏi chọn sheet chứa dữ liệu lương.

### Bước 2: Chọn kỳ lương

Trên màn hình Home:
1. Chọn **Tháng** và **Năm** (mặc định tháng hiện tại)
2. Nhấn **"Kỳ lương mới"** hoặc kéo thả file Excel vào vùng drop
3. Chọn file Excel từ hộp thoại mở file

### Bước 3: Mapping cột (nếu cần)

App tự động nhận diện cột. Nếu mapping chưa đầy đủ (thiếu cột bắt buộc), màn hình **Mapping** xuất hiện để bạn khớp thủ công:

- Kéo thả hoặc dùng dropdown để chỉ định từng cột
- Có thể thêm/xoá các khoản thu nhập và khấu trừ
- Nhấn **"Tiếp tục"** sau khi đủ 3 cột bắt buộc (Họ tên, Email, Thực nhận). Mã NV là tuỳ chọn — nếu trống, app hiện banner cảnh báo và phiếu sẽ dùng STT làm số phiếu

### Bước 4: Preview danh sách

Màn hình Preview hiển thị toàn bộ danh sách nhân viên với:
- Màu xanh: hợp lệ, sẵn sàng gửi
- Màu đỏ: có lỗi (email sai, thiếu thông tin...) — **không thể chọn gửi**
- Ô tìm kiếm theo tên/email/mã NV
- Checkbox chọn/bỏ chọn từng người hoặc tất cả

**Xem trước PDF**: Nhấn icon mắt trên mỗi dòng để mở PDF phiếu lương ngay trên máy (không cần mật khẩu khi xem trước).

**Gửi thử (Dry Run)**: Gửi 1–3 email mẫu đến địa chỉ test của bạn để kiểm tra layout và mật khẩu PDF trước khi gửi thật.

### Bước 5: Gửi

Nhấn **"Gửi"** (hoặc **"Gửi tất cả"**). Màn hình Send Progress hiển thị:
- Tiến trình từng email (gửi thành công / thất bại)
- Số lượng đã gửi / còn lại
- Nút **Huỷ** để dừng batch giữa chừng

Nếu gửi bị gián đoạn (mất điện, crash), lần mở app tiếp theo sẽ hỏi có muốn **tiếp tục gửi** những người còn lại không.

### Mật khẩu PDF

Mỗi PDF được khoá bằng **mã OTP 6 chữ số** sinh ngẫu nhiên, ghi trong nội dung email. Nhân viên dùng mã này để mở file PDF.

> Trong phiên bản hiện tại, mật khẩu là OTP ngẫu nhiên. Nếu muốn dùng mật khẩu cố định (như CCCD), cần cấu hình cột riêng trong mapping.

---

## 5. Các chế độ gửi

### Chế độ Giả lập (Simulate) — Mặc định bật

- **Không gửi email thật**, chỉ mô phỏng quá trình gửi
- Dùng để kiểm tra luồng, mapping, preview PDF mà không lo nhầm email
- Banner tím **"Chế độ Giả lập"** hiển thị liên tục khi đang bật
- Tắt toggle để chuyển sang gửi thật

### Chế độ Test

- Gửi email thật nhưng **toàn bộ về địa chỉ email test** (không đến nhân viên)
- Dùng để kiểm tra giao diện email, PDF, mật khẩu với data thật
- Banner vàng **"Chế độ Test"** hiển thị khi đang bật

### Gửi thật

- Tắt cả Giả lập và Test
- Email gửi đến địa chỉ thật của từng nhân viên trong file Excel
- **Không thể thu hồi** sau khi gửi — hãy chắc chắn đã dry-run trước

### Gửi thử (Dry Run)

Nút trong màn hình Preview: gửi 1–3 email mẫu đến địa chỉ test, ghi vào lịch sử với nhãn "GỬI THỬ". Không ảnh hưởng đến batch gửi thật.

---

## 6. Xem lịch sử gửi

Từ Home → nhấn **"Lịch sử"**.

Mỗi đợt gửi được ghi lại:
- Thời gian, kỳ lương
- Tổng số / thành công / thất bại
- Danh sách từng người với trạng thái

**Kiểm tra đã mở email chưa**: Nếu đã bật tracking, trong màn hình chi tiết có cột "Đã mở" với thời gian mở lần đầu, lần cuối, số lần.

> Lịch sử **KHÔNG lưu số tiền lương** — chỉ lưu metadata (tên, email, mã NV, trạng thái gửi).

---

## 7. Xử lý sự cố

### "Không tìm thấy qpdf"

- **macOS**: Chạy `brew install qpdf` trong Terminal
- **Windows**: Chạy `choco install qpdf` trong PowerShell (Admin), hoặc tải và cài từ [qpdf.sourceforge.io](https://qpdf.sourceforge.io)
- Sau khi cài xong, khởi động lại app

### "Kết nối Gmail thất bại"

Nguyên nhân thường gặp:
- Sai App Password — kiểm tra lại 16 ký tự, không có khoảng trắng
- Gmail chưa bật 2FA — phải bật trước mới tạo được App Password
- Chặn "Less secure app access" — không liên quan nếu đã dùng App Password đúng cách
- Tường lửa công ty chặn port 465 — thử mạng khác (hotspot điện thoại)

### Email lỗi "535 Bad credentials"

App Password đã bị thu hồi hoặc sai. Vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → tạo lại, cập nhật trong Cài đặt.

### Email lỗi "550 Daily user sending limit exceeded"

Đã vượt giới hạn gửi của Gmail (~500 email/ngày free, ~2000/ngày Workspace). Đợi đến ngày hôm sau hoặc chia batch nhỏ gửi nhiều ngày.

### Nhân viên không nhận được email

1. Kiểm tra thư mục Spam/Junk của nhân viên
2. Xem lại lịch sử: có trạng thái "Thất bại" không?
3. Thử gửi lại: vào Lịch sử → chọn đợt → nhấn "Gửi lại những người thất bại"

### Nhân viên không mở được PDF

- Kiểm tra mật khẩu trong nội dung email (mã OTP 6 chữ số)
- Nhân viên cần Adobe Acrobat hoặc PDF reader có hỗ trợ mật khẩu (Preview trên Mac hoạt động tốt)

### App crash khi đang gửi / mất điện

App lưu checkpoint sau mỗi email thành công. Mở lại app — banner amber sẽ hỏi **"Tiếp tục gửi"** với số nhân viên còn lại.

---

## 8. Bảo mật và quyền riêng tư

| Điều | Thực tế |
|---|---|
| **Gmail App Password** | Mã hoá bằng Electron safeStorage (Keychain của Mac/Credential Manager Windows). Không bao giờ ra khỏi main process. |
| **File Excel** | Chỉ đọc trong bộ nhớ, không ghi ra disk của app, không upload đi đâu |
| **File PDF** | Tạo tạm, gửi xong xoá ngay. Startup app cũng dọn sạch PDF tạm còn sót. |
| **Lịch sử** | Mã hoá bằng safeStorage. Chỉ lưu metadata (tên, email, mã NV, trạng thái), **không lưu số tiền**. |
| **Tracker** | Server tracker chỉ thấy token UUID ngẫu nhiên, không biết tên/email nhân viên. |
| **Dữ liệu lương** | Không upload lên bất kỳ server nào. Toàn bộ xử lý diễn ra trên máy local. |
