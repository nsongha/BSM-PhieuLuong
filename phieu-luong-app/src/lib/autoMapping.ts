import type { LuongPath, Mapping } from './api';

type FieldMatcher = { field: keyof Mapping; keywords: string[] };

const REQUIRED: FieldMatcher[] = [
  { field: 'hoTen', keywords: ['họ tên', 'họ và tên', 'fullname', 'full name', 'ho ten', 'ho va ten', 'tên nhân viên', 'ten nv'] },
  { field: 'email', keywords: ['email', 'e-mail', 'mail', 'thư điện tử'] },
  { field: 'maNV', keywords: ['mã nv', 'mã nhân viên', 'ma nv', 'manv', 'employee id', 'staff id', 'mã nhân sự', 'eid'] },
  { field: 'thucNhan', keywords: ['thực nhận', 'thực lĩnh', 'lương thực nhận', 'thuc nhan', 'thuc linh', 'net pay', 'thanh toán', 'actual pay'] },
];

const OPTIONAL: FieldMatcher[] = [
  { field: 'code', keywords: ['code'] },
  { field: 'viTri', keywords: ['chức danh', 'chuc danh', 'vị trí', 'vi tri', 'position', 'job title', 'title', 'chức vụ', 'chuc vu'] },
  { field: 'phongBan', keywords: ['phòng ban', 'phong ban', 'bộ phận', 'bo phan', 'department', 'team', 'nhóm'] },
  { field: 'ngayCong', keywords: ['tổng ngày công', 'ngày công thực tế', 'ngay cong thuc te', 'actual days', 'working days', 'công thực tế'] },
  { field: 'ngayCongChuan', keywords: ['ngày công chuẩn', 'ngay cong chuan', 'standard days', 'chuẩn', 'ngày chuẩn'] },
  { field: 'giamTruNPT', keywords: ['giảm trừ bản thân', 'giam tru ban than', 'giảm trừ gia cảnh', 'mức giảm trừ', 'personal deduction'] },
  { field: 'tongThuNhapSauThue', keywords: ['tổng thu nhập sau thuế', 'tong thu nhap sau thue', 'thu nhập sau thuế', 'net after tax'] },
  // Bước ② & ③ subtotals
  { field: 'tongLuongNgayCongCol', keywords: ['tổng lương theo ngày công', 'tong luong theo ngay cong', 'lương theo ngày công', 'luong theo ngay cong'] },
  { field: 'tongThuNhapCol', keywords: ['tổng thu nhập', 'tong thu nhap', 'total income'] },
] as FieldMatcher[];

// Items thuộc bước ① "Tổng lương" — tách theo loại NV (chính thức / thử việc / CTV)
const LUONG_CHINH_THUC_ITEMS = [
  { nhanCanon: 'Lương cơ bản', keywords: ['lương cơ bản', 'luong co ban', 'basic salary'] },
  { nhanCanon: 'Thưởng hiệu suất', keywords: ['thưởng hiệu suất', 'thuong hieu suat', 'performance'] },
  { nhanCanon: 'Xăng xe', keywords: ['xăng xe', 'xang xe', 'gas allowance', 'transport'] },
  { nhanCanon: 'Hỗ trợ Đồng phục', keywords: ['đồng phục', 'dong phuc', 'uniform'] },
  { nhanCanon: 'Hỗ trợ điện thoại', keywords: ['điện thoại', 'dien thoai', 'phone allowance'] },
  { nhanCanon: 'Hỗ trợ ăn trưa', keywords: ['ăn trưa', 'an trua', 'lunch allowance', 'meal'] },
];

const LUONG_THU_VIEC_ITEMS = [
  { nhanCanon: 'Lương thử việc', keywords: ['lương thử việc', 'luong thu viec'] },
  { nhanCanon: 'Hỗ trợ ăn trưa', keywords: ['ăn trưa', 'an trua', 'lunch'] },
];

// Tổng lương theo loại NV (subtotal columns)
const TONG_LUONG_KEYWORDS = {
  chinhThuc: [
    // Header row 5 / 6 trong file BSM
    'tổng lương\n', 'tong luong\n',
    // Generic — phải đi sau để không nuốt các tên dài hơn
  ],
  thuViec: ['tổng lương thử việc', 'tong luong thu viec'],
  ctv: ['tổng lương ctv', 'tong luong ctv', 'tổng lương cộng tác viên', 'tổng lương / thực tập', 'tong luong / thuc tap'],
};

// Items thuộc bước ③ "Tổng thu nhập" (sau attendance scaling)
const THU_NHAP_BO_SUNG_KEYWORDS = [
  'ot không chịu thuế', 'ot khong chiu thue', 'ot ko chịu thuế', 'ot ko chiu thue',
  'các khoản bổ sung khác', 'cac khoan bo sung khac', 'bổ sung khác', 'bo sung khac',
  'hỗ trợ nhà ở', 'ho tro nha o', 'nhà ở', 'nha o', 'housing',
  'kpi chuyên cần', 'kpi chuyen can', 'kpi',
  'thưởng (doanh số', 'thuong (doanh so',
  'incentive', 'power up',
  'bonus', 'lương tháng 13', 'luong thang 13',
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

const EXCLUDED_FROM_AUTO = [
  'phòng ban', 'phong ban', 'chức vụ', 'chuc vu', 'bộ phận', 'bo phan',
  'ngày sinh', 'ngay sinh', 'địa chỉ', 'dia chi', 'số điện thoại', 'sdt',
  'ngày vào', 'ngay vao', 'giới tính', 'gioi tinh',
  'kỳ lương', 'ky luong', 'tháng lương', 'thang luong', 'period',
  'ngày công', 'ngay cong', 'công thực tế', 'cong thuc te', 'ngày chuẩn', 'standard days',
  'tổng lương gross', 'tong luong gross', 'gross salary',
  'thu nhập chịu thuế', 'thu nhap chiu thue',
  'thu nhập tính thuế', 'thu nhap tinh thue',
  'mức lương đóng bhxh', 'muc luong dong bhxh', 'lương đóng bhxh',
  'thu nhập gross', 'thu nhap gross',
  'chênh lệch lương', 'chenh lech luong', 'cl lương', 'cl luong',
  'pc ko chịu thuế', 'pc không chịu thuế', 'pc ko chiu thue',
  'lương tháng 12', 'luong thang 12',
  'bhxh công ty', 'bhxh cong ty', 'bhxh cty', 'bhxh ct đóng', 'bhxh ct dong',
  // Các cột tăng giảm tổng hợp / lương ngày công sub-totals (đã handle riêng)
  'các khoản tăng/giảm khác', 'cac khoan tang/giam khac',
  'lương ngày công', 'luong ngay cong',
  // Cột phụ "trước ĐC" / "trước điều chỉnh" — chỉ giữ cột chính
  'trước đc', 'truoc dc', 'trước điều chỉnh', 'truoc dieu chinh',
  // Cột tham chiếu giảm trừ NPT (số lượng người, không phải số tiền)
  'tổng số người phụ thuộc', 'tong so nguoi phu thuoc',
];

function norm(s: string) {
  // Lowercase + collapse all whitespace (newline, tab, multiple spaces) → single space.
  // Excel headers thường có \n trong tên (vd "Tổng lương\n gross").
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Canon label cho khoản khấu trừ — gộp các biến thể về 1 nhãn chuẩn để PDF
 * hiển thị đẹp + nhất quán giữa các file. Trả về tên gốc nếu không match.
 */
function canonicalKhauTruLabel(header: string): string {
  const h = norm(header);
  // Thuế TNCN sub-columns (BSM split thành 2: 10% và lũy tiến)
  if (/^thuế\s*10\s*%/.test(h) || /^thue\s*10\s*%/.test(h)) return 'Thuế TNCN (10%)';
  if (/thuế\s*lũy\s*tiến/.test(h) || /thue\s*luy\s*tien/.test(h)) return 'Thuế TNCN (lũy tiến)';
  if (/^thuế\s*tncn$/.test(h) || /^thue\s*tncn$/.test(h)) return 'Thuế TNCN';
  // BHXH variants — chuẩn hoá về "BHXH NV đóng" (loại note % ở đuôi)
  if (/^bhxh\s*nv\s*đóng/.test(h) || /^bhxh.*nhân\s*viên\s*đóng/.test(h)) return 'BHXH NV đóng';
  if (/^bhyt/.test(h)) return 'BHYT';
  if (/^bhtn/.test(h)) return 'BHTN';
  return header;
}

function matches(header: string, keywords: string[]): boolean {
  const h = norm(header);
  return keywords.some((k) => h.includes(norm(k)));
}

// Cột "Thuế" (E5) là Y/N flag, không phải số. Khớp exact để không nuốt "Thuế TNCN", "Hỗ trợ thuế",...
const EXCLUDED_EXACT = new Set(['thuế', 'thue']);
function isExcluded(header: string): boolean {
  const h = norm(header);
  if (EXCLUDED_EXACT.has(h)) return true;
  return EXCLUDED_FROM_AUTO.some((k) => h.includes(norm(k)));
}

function exactOrSlugMatch(header: string, keyword: string): boolean {
  const h = norm(header).replace(/[\s\n\r]+/g, ' ');
  const k = norm(keyword).replace(/[\s\n\r]+/g, ' ');
  return h === k || h.startsWith(k + ' ') || h.endsWith(' ' + k);
}

const PERIOD_KEYWORDS = ['kỳ lương', 'ky luong', 'tháng lương', 'thang luong', 'period'];

export function detectPeriodColumn(headers: string[]): string | null {
  for (const h of headers) {
    if (PERIOD_KEYWORDS.some((k) => norm(h).includes(norm(k)))) return h;
  }
  return null;
}

export type Period = { month: string; year: string };

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
    .sort((a, b) => b.key.localeCompare(a.key));
  return { periods, missingCount: missing };
}

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
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month: String(month).padStart(2, '0'), year: String(year) };
}

/**
 * Detect 3 paths cho Tổng lương (chính thức / thử việc / CTV) từ headers.
 * Mỗi path gồm 1 cột tổng + danh sách items breakdown.
 */
function detectLuongPaths(headers: string[], used: Set<string>): {
  chinhThuc?: LuongPath;
  thuViec?: LuongPath;
  ctv?: LuongPath;
} {
  const result: { chinhThuc?: LuongPath; thuViec?: LuongPath; ctv?: LuongPath } = {};

  // CTV: tìm cột "Tổng lương CTV / thực tập"
  const ctvTongCol = headers.find((h) =>
    !used.has(h) && TONG_LUONG_KEYWORDS.ctv.some((k) => norm(h).includes(norm(k)))
  );
  if (ctvTongCol) {
    used.add(ctvTongCol);
    result.ctv = { tongCol: ctvTongCol, items: [] };
  }

  // Thử việc: tìm cột "Tổng lương thử việc" + items J,K
  const tvTongCol = headers.find((h) =>
    !used.has(h) && TONG_LUONG_KEYWORDS.thuViec.some((k) => norm(h).includes(norm(k)))
  );
  if (tvTongCol) {
    used.add(tvTongCol);
    const items = LUONG_THU_VIEC_ITEMS.flatMap((spec) => {
      const found = headers.find((h) => !used.has(h) && spec.keywords.some((k) => norm(h).includes(norm(k))));
      if (!found) return [];
      used.add(found);
      return [{ nhan: spec.nhanCanon, col: found }];
    });
    result.thuViec = { tongCol: tvTongCol, items };
  }

  // Chính thức: cột "Tổng lương" (đã loại CTV / thử việc khỏi `used`)
  // Match "Tổng lương" exact hoặc "Tổng lương\n" (header có newline)
  const ctTongCol = headers.find((h) => {
    if (used.has(h)) return false;
    const h2 = norm(h).replace(/[\s\n\r]+/g, ' ').trim();
    return h2 === 'tổng lương' || h2 === 'tong luong';
  });
  if (ctTongCol) {
    used.add(ctTongCol);
    const items = LUONG_CHINH_THUC_ITEMS.flatMap((spec) => {
      const found = headers.find((h) => !used.has(h) && spec.keywords.some((k) => norm(h).includes(norm(k))));
      if (!found) return [];
      used.add(found);
      return [{ nhan: spec.nhanCanon, col: found }];
    });
    result.chinhThuc = { tongCol: ctTongCol, items };
  }

  return result;
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
    thuNhapBoSung: [],
    khauTru: [],
    ngoaiLuong: [],
  };
  const used = new Set<string>();
  const missing: string[] = [];

  for (const r of REQUIRED) {
    const found = headers.find((h) => !used.has(h) && matches(h, r.keywords));
    if (found) {
      (mapping as Record<string, unknown>)[r.field as string] = found;
      used.add(found);
    } else {
      missing.push(labelOf(r.field));
    }
  }

  for (const o of OPTIONAL) {
    const found = headers.find((h) => {
      if (used.has(h)) return false;
      // 'code' cần exact match (không nuốt "Mã code" hoặc dài hơn)
      if (o.field === 'code') {
        return o.keywords.some((k) => exactOrSlugMatch(h, k));
      }
      return matches(h, o.keywords);
    });
    if (found) {
      (mapping as Record<string, unknown>)[o.field as string] = found;
      used.add(found);
    }
  }

  // Bước ① — detect 3 luong paths
  const paths = detectLuongPaths(headers, used);
  if (paths.chinhThuc) mapping.luongChinhThuc = paths.chinhThuc;
  if (paths.thuViec) mapping.luongThuViec = paths.thuViec;
  if (paths.ctv) mapping.luongCtv = paths.ctv;

  // Bước ③ — items thuộc thuNhapBoSung (post-attendance scaling)
  for (const h of headers) {
    if (used.has(h)) continue;
    if (isExcluded(h)) continue;
    if (matches(h, OUTSIDE_DEDUCTION_KEYWORDS)) {
      mapping.ngoaiLuong.push({ nhan: h, col: h, isDeduction: true });
      used.add(h);
    } else if (matches(h, OUTSIDE_ADDITION_KEYWORDS)) {
      mapping.ngoaiLuong.push({ nhan: h, col: h, isDeduction: false });
      used.add(h);
    } else if (matches(h, THU_NHAP_BO_SUNG_KEYWORDS)) {
      mapping.thuNhapBoSung.push({ nhan: h, col: h });
      used.add(h);
    } else if (matches(h, DEDUCTION_KEYWORDS)) {
      mapping.khauTru.push({ nhan: canonicalKhauTruLabel(h), col: h });
      used.add(h);
    }
  }

  // Sắp xếp thuNhapBoSung theo nhóm
  mapping.thuNhapBoSung.sort((a, b) => incomeOrder(a.nhan) - incomeOrder(b.nhan));

  return { mapping, complete: missing.length === 0, missing };
}

function incomeOrder(name: string): number {
  const n = name.toLowerCase();
  if (/ot|overtime|thêm\s*giờ|them\s*gio/.test(n)) return 10;
  if (/bổ\s*sung|bo\s*sung/.test(n)) return 20;
  if (/hỗ\s*trợ|ho\s*tro|nhà\s*ở|nha\s*o|housing/.test(n)) return 30;
  if (/kpi/.test(n)) return 40;
  if (/thưởng|thuong/.test(n)) return 50;
  if (/incentive|power\s*up/.test(n)) return 60;
  if (/bonus|tháng\s*13|thang\s*13/.test(n)) return 70;
  return 90;
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
