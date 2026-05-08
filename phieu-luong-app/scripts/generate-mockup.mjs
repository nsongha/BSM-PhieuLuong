#!/usr/bin/env node
// Sinh file mockup/sample-payroll.xlsx với 15 nhân viên giả + 3 edge cases.
// Chạy: node scripts/generate-mockup.mjs
// Yêu cầu: đã cài deps (npm install) để có `xlsx`.

import { utils, write } from 'xlsx';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'mockup');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const EMAIL_BASE = process.env.EMAIL_BASE || 'nguyensongha2';

const ten = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Thu Dung', 'Hoàng Minh Đức',
  'Vũ Thị Giang', 'Bùi Quang Hải', 'Đỗ Thị Hoa', 'Ngô Văn Kiên', 'Đặng Thị Lan',
  'Phan Minh Nhật', 'Chu Thị Oanh', 'Lý Văn Phong', 'Trương Thị Quỳnh', 'Tô Hữu Sơn',
];

const chucVu = [
  'Nhân viên', 'Chuyên viên', 'Trưởng nhóm', 'Nhân viên', 'Chuyên viên',
  'Nhân viên', 'Trưởng phòng', 'Nhân viên', 'Chuyên viên', 'Nhân viên',
  'Nhân viên', 'Chuyên viên', 'Trưởng nhóm', 'Nhân viên', 'Chuyên viên',
];

const phongBan = [
  'Kinh doanh', 'Marketing', 'Kinh doanh', 'Kế toán', 'Kỹ thuật',
  'Nhân sự', 'Kinh doanh', 'Kế toán', 'Marketing', 'Hành chính',
  'Kỹ thuật', 'Kinh doanh', 'Marketing', 'Kế toán', 'Kỹ thuật',
];

function pad(n, w) {
  return String(n).padStart(w, '0');
}

function round(n, step = 1000) {
  return Math.round(n / step) * step;
}

// Kỳ lương — sinh N tháng (default 3), bắt đầu từ tháng hiện tại.
// Override: PAYROLL_PERIODS="03/2026,04/2026" hoặc PAYROLL_MONTHS=3
function defaultPeriods(count = 3) {
  const now = new Date();
  const out = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    out.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  }
  return out;
}

const kyLuongList = (() => {
  if (process.env.PAYROLL_PERIODS) {
    return process.env.PAYROLL_PERIODS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (process.env.PAYROLL_PERIOD) return [process.env.PAYROLL_PERIOD];
  const n = Number(process.env.PAYROLL_MONTHS) || 3;
  return defaultPeriods(n);
})();

function buildRow(hoTen, i, periodLabel, periodIndex) {
  const idx = i + 1;
  const maNV = `NV${pad(idx, 3)}`;
  const cccd = '0' + pad(123456789 + idx * 17, 11);

  // Thu nhập — biến động nhẹ theo kỳ để các tháng không giống nhau 100%
  const variance = 1 + periodIndex * 0.02; // ±2% per period
  const luongCoBan = Math.round((8_000_000 + (idx % 5) * 1_500_000) * variance);
  const luongKPI = round((idx % 4) * 800_000 + (idx % 3) * 300_000 * variance);
  const phuCapTrachNhiem = chucVu[i] === 'Trưởng phòng' ? 3_000_000 : chucVu[i] === 'Trưởng nhóm' ? 1_500_000 : 0;
  const phuCapAnTrua = 730_000;
  const phuCapXangXe = 500_000 + (idx % 3) * 100_000;
  const phuCapDienThoai = chucVu[i] === 'Nhân viên' ? 200_000 : 500_000;
  const thuongThang = (idx + periodIndex) % 4 === 0 ? 2_000_000 : (idx + periodIndex) % 5 === 0 ? 1_000_000 : 0;
  const luongOT = round(((idx + periodIndex) % 6) * 350_000);
  const hoTroNhaO = idx % 7 === 0 ? 1_500_000 : 0;

  const tongThuNhap = luongCoBan + luongKPI + phuCapTrachNhiem + phuCapAnTrua +
    phuCapXangXe + phuCapDienThoai + thuongThang + luongOT + hoTroNhaO;

  const bhxh = Math.round(luongCoBan * 0.08);
  const bhyt = Math.round(luongCoBan * 0.015);
  const bhtn = Math.round(luongCoBan * 0.01);
  const doanPhi = Math.round(luongCoBan * 0.01);
  const thuNhapChiuThue = Math.max(0, tongThuNhap - bhxh - bhyt - bhtn - 11_000_000);
  const thueTNCN = Math.round(thuNhapChiuThue * 0.05);
  const tamUng = (idx + periodIndex) % 8 === 0 ? 1_000_000 : 0;
  const soNgayNghi = (idx + periodIndex) % 9 === 0 ? 1 : 0;
  const luongNgay = Math.round(luongCoBan / 22);
  const truNgayCongNghi = soNgayNghi * luongNgay;

  const tongKhauTru = bhxh + bhyt + bhtn + doanPhi + thueTNCN + tamUng + truNgayCongNghi;
  const thucNhan = tongThuNhap - tongKhauTru;

  return {
    'Kỳ lương': periodLabel,
    'Họ và tên': hoTen,
    'Email': `${EMAIL_BASE}+${pad(idx, 2)}@gmail.com`,
    'Mã NV': maNV,
    'CCCD': cccd,
    'Phòng ban': phongBan[i],
    'Chức vụ': chucVu[i],
    'Lương cơ bản': luongCoBan,
    'Lương KPI': luongKPI,
    'Phụ cấp trách nhiệm': phuCapTrachNhiem,
    'Phụ cấp ăn trưa': phuCapAnTrua,
    'Phụ cấp xăng xe': phuCapXangXe,
    'Phụ cấp điện thoại': phuCapDienThoai,
    'Thưởng tháng': thuongThang,
    'Lương làm thêm (OT)': luongOT,
    'Hỗ trợ nhà ở': hoTroNhaO,
    'BHXH (8%)': bhxh,
    'BHYT (1.5%)': bhyt,
    'BHTN (1%)': bhtn,
    'Đoàn phí': doanPhi,
    'Thuế TNCN': thueTNCN,
    'Tạm ứng': tamUng,
    'Trừ ngày công nghỉ': truNgayCongNghi,
    'Thực nhận': thucNhan,
  };
}

const rows = kyLuongList.flatMap((period, periodIdx) =>
  ten.map((hoTen, i) => buildRow(hoTen, i, period, periodIdx))
);

const ws = utils.json_to_sheet(rows);
const wb = utils.book_new();
utils.book_append_sheet(wb, ws, 'Bang luong');

const outPath = path.join(outDir, 'sample-payroll.xlsx');
const buf = write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(outPath, buf);

console.log(`✓ Sinh xong file mockup: ${outPath}`);
console.log(`  - ${ten.length} nhân viên × ${kyLuongList.length} kỳ = ${rows.length} dòng`);
console.log(`  - Kỳ lương: ${kyLuongList.join(', ')}`);
console.log(`  - Override: PAYROLL_PERIODS="03/2026,04/2026" hoặc PAYROLL_MONTHS=5`);
console.log(`  - 9 khoản thu nhập: Lương CB, Lương KPI, 4 loại Phụ cấp, Thưởng tháng, OT, Hỗ trợ nhà ở`);
console.log(`  - 7 khoản khấu trừ: BHXH, BHYT, BHTN, Đoàn phí, Thuế TNCN, Tạm ứng, Trừ ngày công nghỉ`);
console.log(`  - Email dùng alias ${EMAIL_BASE}+XX@gmail.com`);
