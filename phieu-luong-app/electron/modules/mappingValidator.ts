import type { Employee, LoaiNV, LuongPath, Mapping } from '../preload';

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/;

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function toString(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function fmtVN(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

// Loại NV detection — chuẩn hoá rồi match keyword (không hardcode value cố định)
const LOAI_NV_KEYWORDS: Record<Exclude<LoaiNV, 'unknown'>, string[]> = {
  chinhThuc: ['on', 'active', 'chinh thuc', 'official', 'ct'],
  thuViec: ['thu viec', 'tv', 'probation', 'tap su'],
  // intern = thực tập sinh (≠ thử việc) → nhóm cùng CTV/thực tập
  ctv: ['ctv', 'cong tac vien', 'freelance', 'partner', 'intern', 'thuc tap', 'part-time', 'parttime'],
};

function normalizeCode(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function detectLoaiNV(code: unknown): LoaiNV {
  const s = normalizeCode(code);
  if (!s) return 'unknown';
  for (const [type, kws] of Object.entries(LOAI_NV_KEYWORDS) as Array<[Exclude<LoaiNV, 'unknown'>, string[]]>) {
    if (kws.some((kw) => s === kw || s === kw.replace(/\s+/g, ''))) return type;
  }
  // Fuzzy contains as fallback for typos like "ON-1" etc.
  for (const [type, kws] of Object.entries(LOAI_NV_KEYWORDS) as Array<[Exclude<LoaiNV, 'unknown'>, string[]]>) {
    if (kws.some((kw) => s.includes(kw))) return type;
  }
  return 'unknown';
}

function classifyRow(row: Record<string, unknown>, mapping: Mapping): LoaiNV {
  // Primary: cột Code
  if (mapping.code) {
    const detected = detectLoaiNV(row[mapping.code]);
    if (detected !== 'unknown') return detected;
  }
  // Fallback: cột Tổng lương CTV/Thử việc có giá trị > 0 → loại NV tương ứng
  const ctvVal = mapping.luongCtv?.tongCol ? toNumber(row[mapping.luongCtv.tongCol]) : NaN;
  if (Number.isFinite(ctvVal) && ctvVal > 0) return 'ctv';
  const tvVal = mapping.luongThuViec?.tongCol ? toNumber(row[mapping.luongThuViec.tongCol]) : NaN;
  if (Number.isFinite(tvVal) && tvVal > 0) return 'thuViec';
  // Default: chính thức (cũng là dạng phổ biến nhất)
  return 'chinhThuc';
}

function pickLuongPath(loaiNV: LoaiNV, mapping: Mapping): LuongPath | undefined {
  if (loaiNV === 'chinhThuc') return mapping.luongChinhThuc;
  if (loaiNV === 'thuViec') return mapping.luongThuViec;
  if (loaiNV === 'ctv') return mapping.luongCtv;
  return mapping.luongChinhThuc; // unknown → fallback chính thức
}

/**
 * Auto-compute note cho 2 dòng canon:
 *   - "Lương cơ bản" → note: "Mức đóng BHXH: {giá trị} ₫"
 *   - "BHXH nhân viên đóng" → note: "{tỷ lệ}% × {lương cơ bản} ₫"
 */
function attachAutoNotes(
  luong: Array<{ nhan: string; soTien: number; note?: string }>,
  khauTru: Array<{ nhan: string; soTien: number; note?: string }>
) {
  const luongCoBan = luong.find((i) => /lương\s*cơ\s*bản/i.test(i.nhan));
  if (luongCoBan && !luongCoBan.note && luongCoBan.soTien > 0) {
    luongCoBan.note = `Mức đóng BHXH: ${fmtVN(luongCoBan.soTien)}`;
  }
  const bhxhNV = khauTru.find((i) =>
    /^bhxh.*(nhân\s*viên|nv)\s*đóng/i.test(i.nhan) || /bhxh\s*nv\s*đóng/i.test(i.nhan)
  );
  if (bhxhNV && !bhxhNV.note && luongCoBan && luongCoBan.soTien > 0) {
    const pct = ((bhxhNV.soTien / luongCoBan.soTien) * 100).toFixed(1).replace('.', ',');
    bhxhNV.note = `${pct}% × ${fmtVN(luongCoBan.soTien)}`;
  }
}

export function validateAndMap(
  rows: Record<string, unknown>[],
  mapping: Mapping
): Employee[] {
  const seenEmails = new Map<string, number>();
  const employees: Employee[] = [];

  rows.forEach((row, idx) => {
    const errors: string[] = [];
    const hoTen = toString(row[mapping.hoTen]);
    const email = toString(row[mapping.email]).toLowerCase();
    const maNV = toString(row[mapping.maNV]);
    const thucNhan = toNumber(row[mapping.thucNhan]);

    if (!hoTen) errors.push('Thiếu Họ tên');
    if (!email) errors.push('Thiếu Email');
    else if (!EMAIL_RE.test(email)) errors.push('Email không hợp lệ');
    else if (seenEmails.has(email)) errors.push(`Email trùng với dòng ${seenEmails.get(email)! + 1}`);
    else seenEmails.set(email, idx);

    if (mapping.maNV && !maNV) errors.push('Thiếu Mã NV');
    if (!Number.isFinite(thucNhan)) errors.push('Thực nhận không phải số hợp lệ');

    const loaiNV = classifyRow(row, mapping);
    const luongPath = pickLuongPath(loaiNV, mapping);

    // Bước ① — items + Tổng lương (đọc từ Excel theo loại NV)
    const luong = (luongPath?.items ?? [])
      .map((item) => ({ nhan: item.nhan, soTien: toNumber(row[item.col]), note: item.note }))
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);
    const tongLuongRaw = luongPath?.tongCol ? toNumber(row[luongPath.tongCol]) : NaN;

    // Bước ② — Tổng lương theo ngày công (đọc từ Excel)
    const tongLuongNgayCongRaw = mapping.tongLuongNgayCongCol
      ? toNumber(row[mapping.tongLuongNgayCongCol])
      : NaN;

    // Bước ③ — items bổ sung + Tổng thu nhập (đọc từ Excel)
    const thuNhapBoSung = mapping.thuNhapBoSung
      .map((item) => ({ nhan: item.nhan, soTien: toNumber(row[item.col]), note: item.note }))
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);
    const tongThuNhapRaw = mapping.tongThuNhapCol ? toNumber(row[mapping.tongThuNhapCol]) : NaN;

    const khauTru = mapping.khauTru
      .map((item) => ({ nhan: item.nhan, soTien: toNumber(row[item.col]), note: item.note }))
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);

    attachAutoNotes(luong, khauTru);

    const ngoaiLuong = (mapping.ngoaiLuong ?? [])
      .map((item) => {
        const raw = toNumber(row[item.col]);
        return { nhan: item.nhan, soTien: item.isDeduction ? -raw : raw, note: item.note };
      })
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);

    const giamTruNPTRaw = mapping.giamTruNPT ? toNumber(row[mapping.giamTruNPT]) : NaN;
    const tongThuNhapSauThueRaw = mapping.tongThuNhapSauThue ? toNumber(row[mapping.tongThuNhapSauThue]) : NaN;

    const ngayCongRaw = mapping.ngayCong ? toNumber(row[mapping.ngayCong]) : NaN;
    const ngayCongChuanRaw = mapping.ngayCongChuan ? toNumber(row[mapping.ngayCongChuan]) : NaN;

    employees.push({
      rowIndex: idx,
      hoTen,
      email,
      maNV,
      pdfPassword: generateOtp(),
      loaiNV,
      viTri: mapping.viTri ? toString(row[mapping.viTri]) || undefined : undefined,
      phongBan: mapping.phongBan ? toString(row[mapping.phongBan]) || undefined : undefined,
      ngayCong: Number.isFinite(ngayCongRaw) ? ngayCongRaw : undefined,
      ngayCongChuan: Number.isFinite(ngayCongChuanRaw) ? ngayCongChuanRaw : undefined,
      thucNhan: Number.isFinite(thucNhan) ? thucNhan : 0,
      luong,
      tongLuong: Number.isFinite(tongLuongRaw) ? tongLuongRaw : undefined,
      tongLuongNgayCong: Number.isFinite(tongLuongNgayCongRaw) ? tongLuongNgayCongRaw : undefined,
      thuNhapBoSung,
      tongThuNhap: Number.isFinite(tongThuNhapRaw) ? tongThuNhapRaw : undefined,
      khauTru,
      giamTruNPT: Number.isFinite(giamTruNPTRaw) ? giamTruNPTRaw : undefined,
      tongThuNhapSauThue: Number.isFinite(tongThuNhapSauThueRaw) ? tongThuNhapSauThueRaw : undefined,
      ngoaiLuong,
      errors,
    });
  });

  return employees;
}
