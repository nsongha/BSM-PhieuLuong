import type { Employee, Mapping } from '../preload';

// TLD phải ≥ 2 ký tự chữ cái (reject "a@b.c", "x@y.1") và phần local/domain không rỗng/có space.
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

/**
 * Auto-compute note cho 2 dòng canon trong phiếu lương:
 *   - "Lương cơ bản" → note: "Mức đóng BHXH: {giá trị} ₫"
 *   - "BHXH nhân viên đóng" → note: "{tỷ lệ}% × {lương cơ bản} ₫"
 * Chỉ gán nếu user/mapping chưa có note sẵn.
 */
function attachAutoNotes(
  thuNhap: Array<{ nhan: string; soTien: number; note?: string }>,
  khauTru: Array<{ nhan: string; soTien: number; note?: string }>
) {
  const luongCoBan = thuNhap.find((i) => /lương\s*cơ\s*bản/i.test(i.nhan));
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

    const thuNhap = mapping.thuNhap
      .map((item) => ({ nhan: item.nhan, soTien: toNumber(row[item.col]), note: item.note }))
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);

    const khauTru = mapping.khauTru
      .map((item) => ({ nhan: item.nhan, soTien: toNumber(row[item.col]), note: item.note }))
      .filter((item) => Number.isFinite(item.soTien) && item.soTien !== 0);

    attachAutoNotes(thuNhap, khauTru);

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
      viTri: mapping.viTri ? toString(row[mapping.viTri]) || undefined : undefined,
      phongBan: mapping.phongBan ? toString(row[mapping.phongBan]) || undefined : undefined,
      ngayCong: Number.isFinite(ngayCongRaw) ? ngayCongRaw : undefined,
      ngayCongChuan: Number.isFinite(ngayCongChuanRaw) ? ngayCongChuanRaw : undefined,
      thucNhan: Number.isFinite(thucNhan) ? thucNhan : 0,
      thuNhap,
      khauTru,
      giamTruNPT: Number.isFinite(giamTruNPTRaw) ? giamTruNPTRaw : undefined,
      tongThuNhapSauThue: Number.isFinite(tongThuNhapSauThueRaw) ? tongThuNhapSauThueRaw : undefined,
      ngoaiLuong,
      errors,
    });
  });

  return employees;
}
