# Spec: Che số tiền lương khi xem trước (hold-to-reveal)

- **Ngày:** 2026-06-09
- **Trạng thái:** Đã duyệt thiết kế — chờ lập kế hoạch thực thi
- **Phạm vi file:** `phieu-luong-app/`

## 1. Bối cảnh & mục tiêu

Sau khi import bảng lương, màn **"Xem trước bảng lương"** ([PreviewScreen.tsx](../../../phieu-luong-app/src/screens/PreviewScreen.tsx)) hiển thị số tiền trực tiếp trên màn hình. Đây là thông tin nhạy cảm, dễ bị nhìn lén (shoulder-surfing) khi mở app ở nơi đông người.

**Mục tiêu:** Tự động che số tiền thành `****` ngay sau khi import. Người dùng phải **cố ý giữ chuột 5 giây** trên một số để lộ giá trị thật — một lớp ma sát có chủ đích chống lộ thông tin ngoài ý muốn.

## 2. Phạm vi

**Trong phạm vi** — chỉ 2 chỗ hiện số tiền, đều ở `PreviewScreen.tsx`:
- Cột **Thực nhận** từng dòng nhân viên (hiện tại line 330).
- Ô thống kê **Tổng tiền** (hiện tại line 220).

**Ngoài phạm vi:**
- Các màn khác (Mapping, Lịch sử, Tiến trình gửi) — không hiển thị số tiền.
- PDF gửi qua email — đã được mã hoá riêng bằng mật khẩu OTP, mở ngoài app, không liên quan.
- Nút "hiện tất cả" / master toggle (xem mục 13).
- Lưu trạng thái đã lộ qua các phiên hoặc sau khi rời chuột.

## 3. Hành vi tương tác

### Quyết định đã chốt với người dùng
1. **Hold-to-reveal:** hover vào số bị che → vòng tròn đếm ngược 5s → hết 5s mới hiện số thật.
2. **Re-mask khi rời chuột:** rời chuột (mouseleave) ở bất kỳ thời điểm nào → che lại ngay thành `****`. Hover lại phải đợi đủ 5 giây lần nữa (không nhớ tiến độ cũ).
3. **Hình dạng vòng tròn**, dùng nhất quán cho cả 2 chỗ: **số giây ở giữa** vòng tròn, **dòng chữ "Hiển thị trong Xs" bên cạnh**.
4. **Animation hé số:** khi lộ ra, từng ký tự chạy vào lần lượt **từ phải qua trái**, tổng thời lượng ~1 giây.

### Máy trạng thái

```
        hover / focus
masked ───────────────▶ counting
  ▲                        │
  │  mouseleave / blur     │ đủ holdMs (5s)
  │◀───────────────────────┤
  │                        ▼
  └──── mouseleave ─── revealed
```

- **`masked`** (mặc định sau import): hiển thị `****`.
- **`counting`**: `****` được thay bằng vòng tròn đếm ngược (giây ở giữa) + chữ "Hiển thị trong Xs" bên cạnh.
- **`revealed`**: chạy animation hé số (~1s) rồi giữ nguyên số thật cho tới khi rời chuột.
- **mouseleave / blur** ở `counting` hoặc `revealed` → quay về `masked`, huỷ mọi timer.
- **A11y:** `focus`/`blur` bằng bàn phím hành xử như `mouseenter`/`mouseleave` (chi phí thấp, làm luôn).

## 4. Component `MaskedAmount` (mới)

Tạo component tái dùng `phieu-luong-app/src/components/MaskedAmount.tsx` (thư mục `components/` mới — hiện chỉ có `screens/` và `lib/`).

```tsx
type MaskedAmountProps = {
  value: number;
  format?: (n: number) => string;  // mặc định: formatCurrency từ lib/format
  holdMs?: number;                 // mặc định 5000
  revealMs?: number;               // mặc định 1000
  ringSize?: number;               // px, mặc định 22
  className?: string;
};
```

**State nội bộ:**
```ts
type Phase = 'masked' | 'counting' | 'revealed';
// phase, progress (0..1 cho độ đầy vòng tròn), remaining (số giây nguyên cho text)
```

**Vòng `requestAnimationFrame`** là nguồn dữ liệu duy nhất cho cả độ đầy vòng tròn lẫn số giây — tránh lệch giữa animation và countdown:
- mouseenter/focus (khi `phase === 'masked'`): chuyển `counting`, ghi `start = performance.now()`, bắt đầu rAF.
- mỗi frame: `elapsed = now - start`; `progress = min(1, elapsed / holdMs)`; `remaining = max(0, ceil((holdMs - elapsed) / 1000))`. Nếu `elapsed >= holdMs` → `phase = 'revealed'`, dừng rAF; ngược lại xin frame tiếp.
- mouseleave/blur: huỷ rAF, reset về `masked`.
- Cleanup rAF trong `useEffect` return khi unmount.

## 5. Hiển thị vòng tròn đếm ngược

- SVG `viewBox="0 0 size size"`, `r = (size - stroke) / 2`, `circumference = 2πr`.
- **Track circle:** stroke xám nhạt (`#E5E7EB` / slate-200).
- **Progress circle:** stroke màu **brand-500** (`#3B82F6`) — đồng bộ với các accent xanh hiện có trong PreviewScreen (link "Xem PDF", checkbox `accent-brand-600`). `strokeDasharray = circumference`, `strokeDashoffset = circumference * (1 - progress)`, `strokeLinecap="round"`, xoay `-90deg` để bắt đầu từ đỉnh.
- **Giữa vòng tròn:** số giây còn lại (`remaining`), ví dụ `3`.
- **Bên cạnh (phải):** dòng chữ `Hiển thị trong {remaining}s…`.
- Trong ô bảng hẹp: `ringSize` nhỏ (~22px), chữ gọn để không vỡ layout. Ô Tổng tiền rộng → thoải mái, có thể `ringSize` lớn hơn nếu cần.

## 6. Animation hé số (phải → trái, ~1s)

- Chuỗi đã format (vd `"12.500.000 ₫"`) tách thành từng ký tự; `n = số ký tự`.
- Mỗi ký tự là một `<span>` với `animation-delay` so le: **ký tự phải nhất delay 0**, càng sang trái delay càng tăng → tổng ~`revealMs`.
  - `charDur ≈ 220ms`; `stagger = (revealMs - charDur) / max(1, n - 1)`; `delay_i = (n - 1 - i) * stagger`.
- Keyframe đặt trong `index.css`:
  ```css
  @keyframes reveal-char {
    from { opacity: 0; transform: translateX(6px); }
    to   { opacity: 1; transform: none; }
  }
  ```
  Mỗi span: `animation: reveal-char 220ms ease-out both; animation-delay: …`.
- Sau khi xong, span giữ trạng thái cuối (`fill-mode: both`) → số hiển thị tĩnh, không cần swap markup.

## 7. Tích hợp vào `PreviewScreen.tsx`

- **Cột Thực nhận** (line ~330):
  ```tsx
  <td className="px-3 py-3 text-right tabular-nums font-medium">
    <MaskedAmount value={e.thucNhan} />
  </td>
  ```
- **Ô Tổng tiền** (line ~220): nới kiểu `StatCard.value` từ `string | number` → `React.ReactNode`, truyền:
  ```tsx
  <StatCard label="Tổng tiền" value={<MaskedAmount value={total} />} tone="blue" />
  ```
  (3 StatCard còn lại truyền `number`/`string` vẫn hợp lệ vì `ReactNode` bao trùm.)

## 8. Refactor `formatCurrency`

`formatCurrency` hiện là hàm cục bộ trong PreviewScreen (line 26–28). Tách ra `phieu-luong-app/src/lib/format.ts`:
```ts
export function formatCurrency(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}
```
PreviewScreen và MaskedAmount cùng import từ đây. Giữ nguyên định dạng hiện tại (không đổi output).

## 9. Reduced motion & a11y

- Đọc `window.matchMedia('(prefers-reduced-motion: reduce)')`:
  - **Vẫn giữ cơ chế đợi 5s** (mục đích bảo mật không đổi).
  - `counting`: cập nhật vòng tròn theo bước 1s bằng `setInterval(1000)` (5 bước) thay cho rAF liên tục.
  - `revealed`: hiện thẳng chuỗi đã format, **bỏ cascade**.
- Focus/blur kích hoạt như hover (đã nêu mục 3) — cho phép dùng bàn phím.
- Vòng tròn nên có `aria-label`/`title` kiểu "Giữ chuột để hiện số tiền" để biết tương tác.

## 10. Edge cases

- **Glyph che:** đúng `****` (4 dấu sao), không kèm `₫`.
- **value = 0 / số âm:** che như mọi giá trị khác; reveal hiển thị bình thường (`0 ₫`, số âm có dấu).
- **Re-hover nhanh:** mỗi lần enter lại bắt đầu từ 0 (không nhớ tiến độ) — đúng chủ đích re-mask.
- **Layout shift:** trong ô bảng, chiều cao dòng hiện tại (`py-3`) đủ chứa vòng tròn ~22px; kiểm tra chiều ngang cột Thực nhận khi implement, rút gọn chữ nếu chật.

## 11. Kiểm thử / verify

Dự án **không có** unit-test framework (script `test` = `build:electron` + `tsc --noEmit` + `scripts/smoke-test.mjs`). Verify bằng:
1. `tsc --noEmit -p tsconfig.json` pass (type-check toàn renderer).
2. `npm run dev` → import file mẫu (`mockup/`) → vào màn Xem trước:
   - Số tiền hiển thị `****` ngay sau import.
   - Hover cột Thực nhận + ô Tổng tiền: vòng tròn đếm ngược 5s, giây ở giữa, chữ "Hiển thị trong Xs" bên cạnh.
   - Đủ 5s: số thật chạy vào từ phải qua trái ~1s.
   - Rời chuột: che lại `****`; hover lại đếm từ đầu.
3. Bật macOS Reduce Motion (System Settings → Accessibility) → xác nhận vẫn đợi 5s, không animation liên tục, số hiện thẳng.

## 12. Files thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `phieu-luong-app/src/lib/format.ts` | MỚI | `formatCurrency` dùng chung |
| `phieu-luong-app/src/components/MaskedAmount.tsx` | MỚI | Component che/hé số |
| `phieu-luong-app/src/index.css` | SỬA | Keyframe `reveal-char` |
| `phieu-luong-app/src/screens/PreviewScreen.tsx` | SỬA | Import format, 2 call site, nới kiểu `StatCard.value` |

## 13. Ngoài phạm vi / hướng mở rộng tương lai

- **Nút "Hiện tất cả"** (master toggle dùng biểu tượng con mắt) để lộ toàn bộ một lần khi ở nơi an toàn — hữu ích khi bảng nhiều dòng, nhưng không nằm trong yêu cầu hiện tại (YAGNI).
- Giữ trạng thái đã lộ sau khi rời chuột / qua phiên.
- Áp dụng che cho bản redesign PreviewScreen trong `design_handoff_payroll_preview/` (effort riêng, chưa merge).
