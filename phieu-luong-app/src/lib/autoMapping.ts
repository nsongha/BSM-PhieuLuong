import type { Mapping } from './api';

type FieldMatcher = { field: keyof Mapping; keywords: string[] };

const REQUIRED: FieldMatcher[] = [
  { field: 'hoTen', keywords: ['họ tên', 'họ và tên', 'fullname', 'full name', 'ho ten', 'ho va ten', 'tên nhân viên', 'ten nv'] },
  { field: 'email', keywords: ['email', 'e-mail', 'mail', 'thư điện tử'] },
  { field: 'maNV', keywords: ['mã nv', 'mã nhân viên', 'ma nv', 'manv', 'employee id', 'staff id', 'mã nhân sự', 'eid'] },
  { field: 'thucNhan', keywords: ['thực nhận', 'thực lĩnh', 'lương thực nhận', 'thuc nhan', 'thuc linh', 'net pay', 'thanh toán', 'actual pay'] },
];

const OPTIONAL: FieldMatcher[] = [
  { field: 'viTri', keywords: ['chức danh', 'chuc danh', 'vị trí', 'vi tri', 'position', 'job title', 'title', 'chức vụ', 'chuc vu'] },
  { field: 'phongBan', keywords: ['phòng ban', 'phong ban', 'bộ phận', 'bo phan', 'department', 'team', 'nhóm'] },
  { field: 'ngayCong', keywords: ['tổng ngày công', 'ngày công thực tế', 'ngay cong thuc te', 'actual days', 'working days', 'công thực tế'] },
  { field: 'ngayCongChuan', keywords: ['ngày công chuẩn', 'ngay cong chuan', 'standard days', 'chuẩn', 'ngày chuẩn'] },
  { field: 'giamTruNPT', keywords: ['giảm trừ bản thân', 'giam tru ban than', 'giảm trừ gia cảnh', 'mức giảm trừ', 'personal deduction'] },
  { field: 'tongThuNhapSauThue', keywords: ['tổng thu nhập sau thuế', 'tong thu nhap sau thue', 'thu nhập sau thuế', 'net after tax'] },
] as FieldMatcher[];

const INCOME_KEYWORDS = [
  'lương', 'luong', 'phụ cấp', 'phu cap', 'thưởng', 'thuong', 'hỗ trợ', 'ho tro',
  'trợ cấp', 'tro cap', 'overtime', 'ot', 'bonus', 'salary', 'allowance',
  'công tác phí', 'cong tac phi', 'thêm giờ', 'them gio',
  'xăng xe', 'xang xe', 'đồng phục', 'dong phuc', 'incentive', 'power up',
  'pc ko chịu thuế', 'pc không chịu thuế', 'ot không chịu thuế', 'ot khong chiu thue',
  'bổ sung', 'bo sung', 'kpi',
];

const DEDUCTION_KEYWORDS = [
  'bhxh', 'bhyt', 'bhtn', 'bảo hiểm', 'bao hiem',
  'thuế', 'thue', 'tncn', 'tax',
  'đoàn phí', 'doan phi', 'công đoàn',
  'nợ', 'phạt', 'phat',
  'khấu trừ', 'khau tru',
];

const OUTSIDE_DEDUCTION_KEYWORDS = [
  'tạm ứng', 'tam ung',
  'trừ ngoài lương', 'tru ngoai luong',
  'các khoản trừ ngoài', 'cac khoan tru ngoai',
];

const OUTSIDE_ADDITION_KEYWORDS = [
  'cộng ngoài lương', 'cong ngoai luong',
  'các khoản cộng ngoài', 'cac khoan cong ngoai',
];

// Thu nhập thực sự nhưng chứa từ khoá trùng với khấu trừ — check trước DEDUCTION
const FORCE_INCOME_KEYWORDS = [
  'ot không chịu thuế', 'ot ko chịu thuế', 'ot khong chiu thue', 'ot ko chiu thue',
];


const EXCLUDED_FROM_AUTO = [
  'phòng ban', 'phong ban', 'chức vụ', 'chuc vu', 'bộ phận', 'bo phan',
  'ngày sinh', 'ngay sinh', 'địa chỉ', 'dia chi', 'số điện thoại', 'sdt',
  'ngày vào', 'ngay vao', 'giới tính', 'gioi tinh',
  'kỳ lương', 'ky luong', 'tháng lương', 'thang luong', 'period',
  // Ngày công
  'ngày công', 'ngay cong', 'công thực tế', 'cong thuc te', 'ngày chuẩn', 'standard days',
  // Cột tổng hợp / tính toán trung gian
  'tổng lương gross', 'tong luong gross', 'gross salary',
  'tổng lương', 'tong luong',
  'thu nhập chịu thuế', 'thu nhap chiu thue',
  'thu nhập tính thuế', 'thu nhap tinh thue',
  'mức lương đóng bhxh', 'muc luong dong bhxh', 'lương đóng bhxh',
  'thu nhập gross', 'thu nhap gross',
  'chênh lệch lương', 'chenh lech luong', 'cl lương', 'cl luong',
  // Cột tổng hợp phụ cấp ko chịu thuế (giá trị đã được tách thành từng dòng riêng)
  'pc ko chịu thuế', 'pc không chịu thuế', 'pc ko chiu thue',
  // Cột tham chiếu lương tháng cụ thể (cross-month reference)
  'lương tháng 12', 'luong thang 12',
  // BHXH công ty đóng — không phải tiền của nhân viên, không hiện trên phiếu
  'bhxh công ty', 'bhxh cong ty', 'bhxh cty', 'bhxh ct đóng', 'bhxh ct dong',
];

function norm(s: string) {
  return s.toLowerCase().trim();
}

function matches(header: string, keywords: string[]): boolean {
  const h = norm(header);
  return keywords.some((k) => h.includes(norm(k)));
}

const PERIOD_KEYWORDS = ['kỳ lương', 'ky luong', 'tháng lương', 'thang luong', 'period'];

export function detectPeriodColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (PERIOD_KEYWORDS.some((k) => norm(h).includes(norm(k)))) return h;
  }
  return null;
}

export type Period = { month: string; year: string };

/**
 * Extract distinct periods from rows, keyed by {month,year}. Returns sorted
 * desc (newest first). Rows with unparseable/missing periods are grouped under
 * null key — caller can decide to include or skip.
 */
export function extractPeriods(
  rows: Record<string, unknown>[],
  periodCol: string
): {
  periods: Array<{ key: string; month: string; year: string; count: number }>;
  missingCount: number;
} {
  const byKey = new Map<string, { month: string; year: string; count: number }>();
  let missing = 0;
  for (const row of rows) {
    const parsed = parsePeriod(row[periodCol]);
    if (!parsed) {
      missing += 1;
      continue;
    }
    const key = `${parsed.year}-${parsed.month}`;
    const prev = byKey.get(key);
    if (prev) prev.count += 1;
    else byKey.set(key, { ...parsed, count: 1 });
  }
  const periods = Array.from(byKey.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.key.localeCompare(a.key)); // newest first
  return { periods, missingCount: missing };
}

/** Parse "04/2026" or "4/2026" or "2026-04" into { month, year } strings; null if invalid */
export function parsePeriod(raw: unknown): Period | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  let monthStr: string | null = null;
  let yearStr: string | null = null;
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    monthStr = m[1];
    yearStr = m[2];
  } else {
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) {
      monthStr = m[2];
      yearStr = m[1];
    }
  }
  if (!monthStr || !yearStr) return null;
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  // Giới hạn năm hợp lý — tránh trường hợp đánh máy "202" hay "20260"
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month: String(month).padStart(2, '0'), year: String(year) };
}

export function autoDetectMapping(headers: string[]): {
  mapping: Mapping;
  complete: boolean;
  missing: string[];
} {
  const mapping: Mapping = {
    hoTen: '',
    email: '',
    maNV: '',
    thucNhan: '',
    thuNhap: [],
    khauTru: [],
    ngoaiLuong: [],
  };
  const used = new Set<string>();
  const missing: string[] = [];

  for (const r of REQUIRED) {
    const found = headers.find((h) => !used.has(h) && matches(h, r.keywords));
    if (found) {
      mapping[r.field] = found as never;
      used.add(found);
    } else {
      missing.push(labelOf(r.field));
    }
  }

  for (const o of OPTIONAL) {
    const found = headers.find((h) => !used.has(h) && matches(h, o.keywords));
    if (found) {
      mapping[o.field] = found as never;
      used.add(found);
    }
  }

  for (const h of headers) {
    if (used.has(h)) continue;
    if (matches(h, EXCLUDED_FROM_AUTO)) continue;
    if (matches(h, OUTSIDE_DEDUCTION_KEYWORDS)) {
      mapping.ngoaiLuong.push({ nhan: h, col: h, isDeduction: true });
      used.add(h);
    } else if (matches(h, OUTSIDE_ADDITION_KEYWORDS)) {
      mapping.ngoaiLuong.push({ nhan: h, col: h, isDeduction: false });
      used.add(h);
    } else if (matches(h, FORCE_INCOME_KEYWORDS)) {
      mapping.thuNhap.push({ nhan: h, col: h });
      used.add(h);
    } else if (matches(h, DEDUCTION_KEYWORDS)) {
      mapping.khauTru.push({ nhan: h, col: h });
      used.add(h);
    } else if (matches(h, INCOME_KEYWORDS)) {
      mapping.thuNhap.push({ nhan: h, col: h });
      used.add(h);
    }
  }

  return { mapping, complete: missing.length === 0, missing };
}

function labelOf(f: keyof Mapping): string {
  switch (f) {
    case 'hoTen': return 'Họ tên';
    case 'email': return 'Email';
    case 'maNV': return 'Mã NV';
    case 'thucNhan': return 'Thực nhận';
    default: return String(f);
  }
}
