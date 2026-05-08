#!/usr/bin/env node
// Smoke test pipeline: read xlsx → detect periods → filter rows → validate.
// Mô phỏng chính xác flow App.tsx → loadAndRoute → period-pick → mapping.
// Chạy không cần Electron — yêu cầu đã build:electron trước.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { readXlsx } = require('../dist-electron/modules/excelReader.js');
const { validateAndMap } = require('../dist-electron/modules/mappingValidator.js');

const filePath = './mockup/sample-payroll.xlsx';

let failed = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `: ${detail}` : ''}`);
  if (!ok) failed += 1;
}

console.log(`\n[1/4] Đọc ${filePath}`);
const { headers, rows } = readXlsx(filePath);
console.log(`  Headers (${headers.length}): ${headers.join(', ')}`);
console.log(`  Rows: ${rows.length}`);
check('có cột "Kỳ lương"', headers.includes('Kỳ lương'));
check('có >= 30 rows (mockup multi-period)', rows.length >= 30, `${rows.length}`);

console.log(`\n[2/4] Extract distinct periods`);
const periodSet = new Map();
for (const r of rows) {
  const raw = String(r['Kỳ lương'] ?? '').trim();
  const m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const key = `${m[2]}-${m[1].padStart(2, '0')}`;
    periodSet.set(key, (periodSet.get(key) ?? 0) + 1);
  }
}
const periods = [...periodSet.entries()].sort((a, b) => b[0].localeCompare(a[0]));
console.log(`  Periods: ${periods.map(([k, n]) => `${k} (${n})`).join(', ')}`);
check('detect ≥ 2 periods', periods.length >= 2, `${periods.length}`);

console.log(`\n[3/4] Filter theo period mới nhất + validate mapping`);
const [latestKey] = periods[0];
const filteredRows = rows.filter((r) => {
  const raw = String(r['Kỳ lương'] ?? '').trim();
  const m = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return false;
  return `${m[2]}-${m[1].padStart(2, '0')}` === latestKey;
});
console.log(`  Filtered rows: ${filteredRows.length}`);

const mapping = {
  hoTen: 'Họ và tên',
  email: 'Email',
  maNV: 'Mã NV',
  cccd: 'CCCD',
  thucNhan: 'Thực nhận',
  thuNhap: [
    { nhan: 'Lương cơ bản', col: 'Lương cơ bản' },
    { nhan: 'Phụ cấp ăn trưa', col: 'Phụ cấp ăn trưa' },
    { nhan: 'Phụ cấp xăng xe', col: 'Phụ cấp xăng xe' },
    { nhan: 'Thưởng tháng', col: 'Thưởng tháng' },
  ],
  khauTru: [
    { nhan: 'BHXH', col: 'BHXH (8%)' },
    { nhan: 'BHYT', col: 'BHYT (1.5%)' },
    { nhan: 'Thuế TNCN', col: 'Thuế TNCN' },
  ],
};
const employees = validateAndMap(filteredRows, mapping);
const valid = employees.filter((e) => e.errors.length === 0);
const invalid = employees.filter((e) => e.errors.length > 0);
console.log(`  Hợp lệ: ${valid.length}, Có lỗi: ${invalid.length}`);
invalid.forEach((e) => {
  console.log(`    - Dòng ${e.rowIndex + 2} (${e.hoTen || '?'}): ${e.errors.join('; ')}`);
});
check('không có dòng lỗi sau khi filter period', invalid.length === 0, `${invalid.length} lỗi`);
check('tất cả NV trong period đều valid', valid.length === filteredRows.length);

console.log(`\n[4/4] Cross-check duplicate detection (validate raw 45 rows)`);
const allEmployees = validateAndMap(rows, mapping);
const allInvalid = allEmployees.filter((e) => e.errors.length > 0);
const expectedDupes = rows.length - filteredRows.length; // 30 dupes if 3 periods × 15 NV
check(
  `phát hiện email trùng across periods`,
  allInvalid.length === expectedDupes,
  `${allInvalid.length} (kỳ vọng ${expectedDupes})`
);

console.log(`\n[Sample] ${valid[0].hoTen} (${valid[0].maNV}): ${valid[0].thucNhan.toLocaleString('vi-VN')} ₫`);
const total = valid.reduce((s, e) => s + e.thucNhan, 0);
console.log(`Tổng quỹ lương kỳ ${latestKey}: ${total.toLocaleString('vi-VN')} ₫`);

if (failed > 0) {
  console.error(`\n✗ ${failed} check FAIL`);
  process.exit(1);
}
console.log(`\n✓ Tất cả checks PASS.`);
