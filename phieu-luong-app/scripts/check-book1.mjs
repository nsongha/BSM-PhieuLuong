#!/usr/bin/env node
// Kiểm tra Book1.xlsx: mô phỏng logic classify + pickLuongPath để tìm ai bị lương 0đ.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'mockup', 'Book1.xlsx');

// ── Đọc file ──────────────────────────────────────────────────────────────────
const wb = XLSX.readFile(filePath);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
const headers = raw.length ? Object.keys(raw[0]) : [];

console.log('\n══ BOOK1.XLSX ══════════════════════════════════════════════');
console.log(`Sheet: "${sheetName}" | Rows: ${raw.length} | Cols: ${headers.length}`);
console.log('\n── Headers ─────────────────────────────────────────────────');
headers.forEach((h, i) => console.log(`  [${String(i).padStart(2)}] ${JSON.stringify(h)}`));

// ── Helpers (copy từ autoMapping.ts) ─────────────────────────────────────────
function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

// ── Tìm các cột quan trọng ────────────────────────────────────────────────────
const codeCol      = headers.find(h => norm(h) === 'code');
const tvTongCol    = headers.find(h => norm(h).includes('tổng lương thử việc') || norm(h).includes('tong luong thu viec'));
const ctTongCol    = headers.find(h => { const h2 = norm(h).replace(/[\s\n\r]+/g,' ').trim(); return h2==='tổng lương'||h2==='tong luong'; });
const ctvTongCol   = headers.find(h => norm(h).includes('tổng lương ctv') || norm(h).includes('tổng lương cộng tác viên') || norm(h).includes('tổng lương / thực tập'));
const thucNhanCol  = headers.find(h => ['thực nhận','thuc nhan','thực lĩnh','net pay'].some(k => norm(h).includes(k)));
const hoTenCol     = headers.find(h => ['họ tên','họ và tên','fullname','ho ten'].some(k => norm(h).includes(k)));

console.log('\n── Cột nhận diện được ──────────────────────────────────────');
console.log(`  Code column       : ${codeCol   ? JSON.stringify(codeCol)   : '❌ KHÔNG TÌM THẤY'}`);
console.log(`  Tổng lương (CT)   : ${ctTongCol  ? JSON.stringify(ctTongCol)  : '❌ KHÔNG TÌM THẤY'}`);
console.log(`  Tổng lương TV     : ${tvTongCol  ? JSON.stringify(tvTongCol)  : '❌ KHÔNG TÌM THẤY'}`);
console.log(`  Tổng lương CTV    : ${ctvTongCol ? JSON.stringify(ctvTongCol) : '❌ KHÔNG TÌM THẤY'}`);
console.log(`  Thực nhận         : ${thucNhanCol? JSON.stringify(thucNhanCol): '❌ KHÔNG TÌM THẤY'}`);
console.log(`  Họ và tên         : ${hoTenCol   ? JSON.stringify(hoTenCol)   : '❌ KHÔNG TÌM THẤY'}`);

// ── Logic classify (copy từ mappingValidator.ts) ──────────────────────────────
const LOAI_NV_KEYWORDS = {
  chinhThuc: ['on', 'active', 'chinh thuc', 'official', 'ct'],
  thuViec:   ['intern', 'thu viec', 'tv', 'probation', 'tap su'],
  ctv:       ['ctv', 'cong tac vien', 'freelance', 'partner'],
};

function normalizeCode(v) {
  return String(v ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function detectLoaiNV(code) {
  const s = normalizeCode(code);
  if (!s) return 'unknown';
  for (const [type, kws] of Object.entries(LOAI_NV_KEYWORDS)) {
    if (kws.some(kw => s === kw || s === kw.replace(/\s+/g, ''))) return type;
  }
  for (const [type, kws] of Object.entries(LOAI_NV_KEYWORDS)) {
    if (kws.some(kw => s.includes(kw))) return type;
  }
  return 'unknown';
}

function classifyRow(row) {
  if (codeCol) {
    const detected = detectLoaiNV(row[codeCol]);
    if (detected !== 'unknown') return { loai: detected, via: `Code="${row[codeCol]}"` };
  }
  if (ctvTongCol) {
    const v = toNumber(row[ctvTongCol]);
    if (Number.isFinite(v) && v > 0) return { loai: 'ctv', via: `CTV total=${v}` };
  }
  if (tvTongCol) {
    const v = toNumber(row[tvTongCol]);
    if (Number.isFinite(v) && v > 0) return { loai: 'thuViec', via: `TV total=${v}` };
  }
  return { loai: 'chinhThuc', via: 'default' };
}

function getTongLuong(row, loai) {
  if (loai === 'thuViec')   return tvTongCol  ? toNumber(row[tvTongCol])  : NaN;
  if (loai === 'ctv')       return ctvTongCol ? toNumber(row[ctvTongCol]) : NaN;
  if (loai === 'chinhThuc') return ctTongCol  ? toNumber(row[ctTongCol])  : NaN;
  return NaN;
}

// ── Kiểm tra từng dòng ────────────────────────────────────────────────────────
console.log('\n── Kết quả từng nhân viên ──────────────────────────────────');

const problems = [];
const ok = [];

raw.forEach((row, idx) => {
  const ten = hoTenCol ? String(row[hoTenCol] ?? '').trim() : `Dòng ${idx + 2}`;
  if (!ten) return; // bỏ dòng trống

  const { loai, via } = classifyRow(row);
  const tongLuong = getTongLuong(row, loai);
  const thucNhan  = thucNhanCol ? toNumber(row[thucNhanCol]) : NaN;

  // Lương 0đ khi:
  // 1. loai=thuViec nhưng tvTongCol không có → tongLuong = NaN
  // 2. loai=thuViec nhưng tvTongCol có → đọc được nhưng có thể = 0
  // 3. loai=chinhThuc (bị nhầm) nhưng ctTongCol=0/NaN cho người này
  const isZero = !Number.isFinite(tongLuong) || tongLuong === 0;
  const isTVMisclassified = loai !== 'thuViec' && tvTongCol && Number.isFinite(toNumber(row[tvTongCol])) && toNumber(row[tvTongCol]) > 0;
  const hasIssue = isZero || isTVMisclassified;

  const line = `  ${hasIssue ? '❌' : '✅'} [${idx+2}] ${ten.padEnd(25)} | loại=${loai.padEnd(10)} via=${via.padEnd(20)} | tongLuong=${Number.isFinite(tongLuong)?tongLuong.toLocaleString('vi-VN')+'₫':'—'} | thucNhan=${Number.isFinite(thucNhan)?thucNhan.toLocaleString('vi-VN')+'₫':'—'}`;
  console.log(line);

  if (hasIssue) {
    problems.push({ idx: idx+2, ten, loai, via, tongLuong, thucNhan, isTVMisclassified,
      tvVal: tvTongCol ? toNumber(row[tvTongCol]) : undefined });
  } else {
    ok.push(ten);
  }
});

// ── Tổng kết ──────────────────────────────────────────────────────────────────
console.log('\n══ TỔNG KẾT ════════════════════════════════════════════════');
if (!tvTongCol) {
  console.log('⚠️  CẢNH BÁO: Không tìm thấy cột "Tổng lương thử việc"!');
  console.log('   → Mọi nhân viên thử việc sẽ bị hiển thị lương 0 ₫ trên phiếu.');
}
if (!codeCol) {
  console.log('⚠️  CẢNH BÁO: Không tìm thấy cột "Code"!');
  console.log('   → App phân loại NV dựa vào cột tổng lương, dễ nhầm nếu thiếu cột.');
}

console.log(`\n✅ Ổn: ${ok.length} nhân viên`);
console.log(`❌ Có vấn đề: ${problems.length} nhân viên`);

if (problems.length > 0) {
  console.log('\n── Chi tiết vấn đề ─────────────────────────────────────────');
  problems.forEach(p => {
    console.log(`\n  Dòng ${p.idx}: ${p.ten}`);
    console.log(`    Phân loại: ${p.loai} (qua ${p.via})`);
    if (!tvTongCol && p.loai === 'thuViec') {
      console.log(`    ⛔ Thiếu cột "Tổng lương thử việc" → tongLuong = undefined → phiếu hiện 0 ₫`);
    } else if (!Number.isFinite(p.tongLuong) || p.tongLuong === 0) {
      console.log(`    ⛔ tongLuong = ${p.tongLuong} → phiếu hiện 0 ₫`);
      if (p.isTVMisclassified) {
        console.log(`    ⛔ Có giá trị ở cột TV (${p.tvVal?.toLocaleString('vi-VN')}₫) nhưng bị phân loại sai thành "${p.loai}"`);
      }
    }
    if (p.isTVMisclassified) {
      console.log(`    ⚠️  Cột "Tổng lương thử việc" có giá trị ${p.tvVal?.toLocaleString('vi-VN')}₫ nhưng NV này được phân loại là "${p.loai}"`);
    }
  });

  console.log('\n── Cách sửa file Excel ─────────────────────────────────────');
  if (!tvTongCol) {
    console.log('  1. Thêm cột tên chính xác: "Tổng lương thử việc"');
    console.log('     Điền vào dòng của nhân viên thử việc, để trống dòng của NV chính thức.');
  }
  if (!codeCol) {
    console.log('  2. Thêm cột "Code" với giá trị: ON (chính thức) / TV (thử việc) / CTV');
  }
}
