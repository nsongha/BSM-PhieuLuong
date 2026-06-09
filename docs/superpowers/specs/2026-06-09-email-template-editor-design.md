# Email Template Editor — 3 mẫu lưu sẵn, sửa khi gửi

**Ngày:** 2026-06-09
**Trạng thái:** Approved — sẵn sàng implement
**App:** `phieu-luong-app` (Electron + React + TS + Vite + Tailwind)

## 1. Mục tiêu & bối cảnh

Hiện tại tiêu đề + nội dung email **hard-code** trong `buildSubject`/`buildEmailBody`
(`electron/modules/emailSender.ts`). Người dùng không sửa được từ UI → muốn đổi lời văn
phải sửa code, hoặc lưu text ngoài app rồi copy vào (không có chỗ lưu trong app).

**Mục tiêu:** Cho phép sửa tiêu đề + nội dung email ngay trong luồng gửi (màn Preview),
**lưu 3 mẫu (preset) có tên do user đặt**, chọn 1 mẫu để dùng cho mỗi đợt gửi. Mẫu được
lưu bền (`electron-store`) — không phải viết lại, không phải copy từ ngoài.

**Non-goals (YAGNI):** không thêm/xoá số lượng mẫu (cố định đúng 3); không soạn HTML
(chỉ text thuần như hiện tại); không template riêng theo loại NV; không sửa template
trong màn Cài đặt (chỉ sửa từ Preview).

## 2. Quyết định đã chốt

- **3 preset cố định**, mỗi preset = `{ name, subject, body }`, user đổi tên + sửa nội dung được.
- **Chỗ sửa:** nút "Sửa nội dung" trên màn Preview → mở **modal** soạn thảo. Mẫu lưu toàn cục.
- **5 biến** (đúng bằng template hiện tại), token ASCII trong `{}`, chèn bằng chip.
- Mẫu đang chọn áp dụng cho **cả đợt gửi** (gửi thật, gửi test, gửi thử). Resolve **1 lần** ở
  đầu batch — sửa mẫu giữa chừng không ảnh hưởng batch đang chạy.
- Trống tiêu đề HOẶC nội dung → không cho lưu mẫu.
- Xem trước dùng nhân viên **đầu tiên đang chọn** (hiện mật khẩu thật, như nút "Xem PDF" sẵn có).

## 3. Biến (tokens) & render

| Chip (nhãn UI) | Token | Nguồn dữ liệu |
|---|---|---|
| Tên nhân viên | `{ten}` | `Employee.hoTen` |
| Tháng | `{thang}` | `SendOptions.month` |
| Năm | `{nam}` | `SendOptions.year` |
| Công ty | `{cong_ty}` | `Settings.companyName` |
| Mật khẩu | `{mat_khau}` | `Employee.pdfPassword` |

- Token lạ (vd `{xyz}`) → **giữ nguyên** (không thay), để user thấy mà sửa.
- Render ra **text thuần**, rồi đi qua `textToHtmlBody` sẵn có (đã escape HTML + xuống dòng)
  → không có rủi ro HTML injection. Substitution xảy ra TRƯỚC `textToHtmlBody`.

## 4. Mô hình dữ liệu

### 4.1 Type chung (định nghĩa trong `electron/preload.ts`, mirror y hệt trong `src/lib/api.ts`)

```ts
export type EmailTemplate = {
  name: string;
  subject: string;
  body: string;
};
```

`SendOptions` thêm field optional:

```ts
export type SendOptions = {
  month: string;
  year: string;
  testMode: boolean;
  simulate: boolean;
  templateIndex?: number; // 0–2, mẫu dùng cho đợt gửi này (mặc định 0)
};
```

### 4.2 Mặc định (trong `electron/modules/emailSender.ts`)

Token-hoá đúng nội dung hard-code hiện tại:

```ts
export const DEFAULT_SUBJECT_TEMPLATE = '[Phiếu lương] Tháng {thang}/{nam}';

export const DEFAULT_BODY_TEMPLATE = `Kính gửi {ten},

Phòng Nhân sự {cong_ty} xin gửi phiếu lương tháng {thang}/{nam}.

File PDF đính kèm được bảo vệ bằng mật khẩu. Vui lòng dùng mã sau để mở file:

    Mật khẩu: {mat_khau}

Mã này chỉ dùng cho phiếu lương tháng này. Nếu có bất kỳ sai sót nào, vui lòng liên hệ ngay với phòng Nhân sự.

Trân trọng,
{cong_ty}`;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  { name: 'Phiếu lương tháng', subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE },
  { name: 'Mẫu 2',            subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE },
  { name: 'Mẫu 3',            subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE },
];
```

Cả 3 seed giống nhau → mọi mẫu hợp lệ ngay từ đầu, gửi an toàn kể cả user chưa sửa.

### 4.3 Render (trong `electron/modules/emailSender.ts`)

```ts
export type TemplateVars = {
  ten: string; thang: string; nam: string; cong_ty: string; mat_khau: string;
};

export function renderTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(ten|thang|nam|cong_ty|mat_khau)\}/g,
    (_m, k: string) => vars[k as keyof TemplateVars]);
}
```

`buildSubject` và `buildEmailBody` **xoá đi** (chỉ `handlers.ts` dùng — sẽ thay bằng render).
Giữ nguyên `buildAttachmentName`, `sendWithRetry`, `textToHtmlBody`, `sanitizeFilename`, v.v.

## 5. Lưu trữ (`electron/modules/settingsStore.ts`)

Thêm 2 khoá store **độc lập** với `settings` (không đụng luồng lưu password):

```ts
// thêm vào type SettingsFile:
//   emailTemplates?: EmailTemplate[];
//   activeTemplateIndex?: number;

export function getEmailTemplates(): EmailTemplate[] {
  const t = store.get('emailTemplates');
  if (!Array.isArray(t) || t.length !== 3) return [...DEFAULT_EMAIL_TEMPLATES];
  // normalize: đảm bảo đủ field
  return t.map((x, i) => ({
    name: typeof x?.name === 'string' && x.name ? x.name : DEFAULT_EMAIL_TEMPLATES[i].name,
    subject: typeof x?.subject === 'string' ? x.subject : DEFAULT_EMAIL_TEMPLATES[i].subject,
    body: typeof x?.body === 'string' ? x.body : DEFAULT_EMAIL_TEMPLATES[i].body,
  }));
}

export function saveEmailTemplates(templates: EmailTemplate[]): void {
  store.set('emailTemplates', templates.slice(0, 3));
}

export function getActiveTemplateIndex(): number {
  const i = store.get('activeTemplateIndex');
  return typeof i === 'number' && i >= 0 && i <= 2 ? i : 0;
}

export function setActiveTemplateIndex(i: number): void {
  store.set('activeTemplateIndex', Math.max(0, Math.min(2, i)));
}
```

Import `EmailTemplate` từ `../preload`, `DEFAULT_EMAIL_TEMPLATES` từ `./emailSender`
(không vòng lặp: `emailSender` không import `settingsStore`).

## 6. IPC (`electron/ipc/handlers.ts` + `electron/preload.ts`)

### 6.1 Handler mới

```ts
ipcMain.handle('templates:get', async () => ({
  templates: getEmailTemplates(),
  activeIndex: getActiveTemplateIndex(),
}));

ipcMain.handle('templates:save', async (_e, templates: EmailTemplate[], activeIndex: number) => {
  if (batchInProgress) throw new Error('Đang có đợt gửi — không thể đổi mẫu lúc này.');
  saveEmailTemplates(templates);
  setActiveTemplateIndex(activeIndex);
});
```

### 6.2 preload `api` thêm nhánh

```ts
templates: {
  get: () => ipcRenderer.invoke('templates:get') as Promise<{ templates: EmailTemplate[]; activeIndex: number }>,
  save: (templates: EmailTemplate[], activeIndex: number) =>
    ipcRenderer.invoke('templates:save', templates, activeIndex) as Promise<void>,
},
```

(Mirror vào `ApiShape` trong `src/lib/api.ts`.)

### 6.3 Dùng mẫu khi gửi

Trong handler `email:dry-run` và `email:send-batch`, **resolve mẫu 1 lần** ở đầu (trước vòng lặp):

```ts
const _tpls = getEmailTemplates();
const tpl = _tpls[opts.templateIndex ?? getActiveTemplateIndex()] ?? _tpls[0];
```

Hàm helper render cho 1 nhân viên:

```ts
function renderFor(tpl: EmailTemplate, emp: Employee, opts: SendOptions, settings: Settings) {
  const vars = {
    ten: emp.hoTen, thang: opts.month, nam: opts.year,
    cong_ty: settings.companyName, mat_khau: emp.pdfPassword,
  };
  return { subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars) };
}
```

Thay các chỗ build cũ (giữ nguyên prefix test/dry-run):

- **dry-run** (`handlers.ts` ~124–127):
  ```ts
  const r = renderFor(tpl, emp, opts, settings);
  subject: `[GỬI THỬ] ${r.subject} — ${emp.hoTen}`,
  body: `[GỬI THỬ] Email mẫu — nếu gửi thật sẽ đến: ${emp.email}\n\n` + r.body,
  ```
- **send-batch** (`handlers.ts` ~303–314):
  ```ts
  const r = renderFor(tpl, emp, opts, settings);
  subject: (opts.testMode ? '[TEST] ' : '') + r.subject,
  body: bodyPrefix + r.body,
  ```

Bỏ import `buildEmailBody, buildSubject`; thêm import `renderTemplate` (+ type `EmailTemplate`)
và `getEmailTemplates, getActiveTemplateIndex` từ settingsStore.

## 7. UI

### 7.1 Màn Preview (`src/screens/PreviewScreen.tsx`)

- State mới: `templates: EmailTemplate[]`, `activeIndex: number`, `editorOpen: boolean`.
- `useEffect` lúc mount: `api().templates.get()` → set `templates` + `activeIndex`.
- Thêm 1 thanh gọn (đặt trong card, trên khu vực bảng — sau khối StatCard/cảnh báo):
  ```
  ✉️ Mẫu email: <tên mẫu đang chọn> ▾   [Sửa nội dung]
  ```
  - Dropdown `▾` đổi mẫu nhanh (gọi `api().templates.save(templates, newIndex)` để nhớ lựa chọn).
  - "Sửa nội dung" mở modal editor.
- `doDryRun`: truyền `{ ...opts, templateIndex: activeIndex }` vào `api().email.dryRun`.
- `onSendReal`: đổi signature → `onSendReal(selected, activeIndex)`.

### 7.2 Modal editor (component mới trong cùng file, theo mẫu `ConfirmModal` sẵn có)

`TemplateEditorModal`:
- Props: `templates`, `activeIndex`, `sampleEmployee?: Employee`, `companyName`, `month`, `year`,
  `onClose`, `onSave(templates, activeIndex)`.
- State nội bộ: bản nháp `draft: EmailTemplate[]`, `tab: number` (đang sửa mẫu nào).
- **3 tab** đầu modal: mỗi tab hiện `draft[i].name`; click chuyển tab. Cho sửa tên (ô input nhỏ
  hoặc tab có thể edit) của mẫu đang mở.
- Ô **Tiêu đề** (`input`) ↔ `draft[tab].subject`; ô **Nội dung** (`textarea` cao) ↔ `draft[tab].body`.
- **Chip chèn biến**: 5 nút, click chèn token tại vị trí con trỏ trong textarea (dùng `ref` +
  `selectionStart`/`selectionEnd`; chèn vào subject hoặc body tuỳ ô đang focus — đơn giản: chèn
  vào body, kèm 1 dòng legend liệt kê 5 token để user gõ tay vào tiêu đề nếu muốn).
- **Xem trước**: render `renderTemplate`-equivalent phía client (viết hàm `renderClient` cục bộ
  trong file, **logic giống hệt** mục 4.3) với `sampleEmployee` (hoặc giá trị mẫu nếu không có:
  ten="Nguyễn Văn A", mat_khau="A1b2C3d4"). Hiện cả subject + body đã thay biến.
- Nút **"Lưu & dùng mẫu này"**: disable nếu `draft[tab].subject.trim()===''` hoặc
  `draft[tab].body.trim()===''`. Click → `onSave(draft, tab)` (lưu cả 3 mẫu + đặt active = tab đang mở).
- Nút **Huỷ** đóng modal, bỏ nháp.
- ⚠️ `noUnusedLocals/Params` bật ở renderer → không để import/biến thừa.

### 7.3 `src/App.tsx`

- `PreviewScreen` `onSendReal` đổi thành `(selected, templateIndex) =>` và set route `sending` với
  `opts: { ...sendOpts, testMode, simulate, templateIndex }`.
- Type `Route` nhánh `sending.opts` đã là `SendOptions` (đã có `templateIndex?`) → không cần đổi.

## 8. Các file sẽ đụng (tổng kết)

| File | Thay đổi |
|---|---|
| `electron/preload.ts` | + `EmailTemplate`; `SendOptions.templateIndex?`; `api.templates.{get,save}` |
| `electron/modules/emailSender.ts` | + `DEFAULT_*`, `TemplateVars`, `renderTemplate`; xoá `buildSubject`/`buildEmailBody` |
| `electron/modules/settingsStore.ts` | + getters/setters templates; import default |
| `electron/ipc/handlers.ts` | + 2 handler; resolve+render mẫu ở dry-run & send-batch; sửa import |
| `src/lib/api.ts` | mirror: `EmailTemplate`, `SendOptions.templateIndex?`, `ApiShape.templates` |
| `src/screens/PreviewScreen.tsx` | thanh chọn mẫu + `TemplateEditorModal`; truyền `templateIndex` |
| `src/App.tsx` | thread `templateIndex` qua opts ở `onSendReal` |

## 9. Edge cases

- User cũ chưa có `emailTemplates` → `getEmailTemplates()` trả default (3 mẫu).
- `opts.templateIndex` undefined (vd checkpoint cũ) → fallback `getActiveTemplateIndex()` → `[0]`.
- Sửa mẫu giữa batch: handler đã resolve `tpl` 1 lần ở đầu → batch đang chạy không đổi;
  `templates:save` còn chặn khi `batchInProgress`.
- Resume checkpoint: `opts.templateIndex` nằm trong `Checkpoint.opts` → dùng đúng mẫu index đó.
- Token lạ giữ nguyên; thiếu biến không bao giờ xảy ra (5 biến luôn có giá trị string).

## 10. Kiểm thử

- `npm install` (lần đầu trong worktree — tải Electron).
- `npm test` = `build:electron` (compile main, bắt lỗi type main) → `tsc --noEmit -p tsconfig.json`
  (typecheck renderer, bắt lỗi UI) → `node scripts/smoke-test.mjs` (pipeline Excel→validate; không
  cover email nhưng đảm bảo build toàn vẹn). **Tiêu chí đậu: `npm test` exit 0.**
- Kiểm tra thủ công (ngoài phạm vi tự động): mở app → Preview → "Sửa nội dung" → đổi tên/sửa nội
  dung mẫu → xem trước thay biến đúng → Lưu → "Gửi thử" tới email test → nội dung đúng mẫu.
