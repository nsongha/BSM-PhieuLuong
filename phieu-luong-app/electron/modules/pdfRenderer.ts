import { BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Employee, Settings, SendOptions } from '../preload';

const execFileAsync = promisify(execFile);

const TEMP_ROOT = path.join(os.tmpdir(), 'phieu-luong-pdf');

function ensureTempRoot(): string {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  return TEMP_ROOT;
}

export function sweepLeakedPdfs(): number {
  try {
    if (!fs.existsSync(TEMP_ROOT)) return 0;
    let n = 0;
    for (const name of fs.readdirSync(TEMP_ROOT)) {
      const p = path.join(TEMP_ROOT, name);
      try {
        fs.rmSync(p, { recursive: true, force: true });
        n += 1;
      } catch {
        // ignore individual failures
      }
    }
    return n;
  } catch {
    return 0;
  }
}

function getBundledQpdfPath(): string | null {
  if (process.platform !== 'win32') return null;
  // Production: electron-builder copies assets/qpdf-win/ → <resources>/qpdf-win/
  // Dev: read directly from project's assets/qpdf-win/
  const candidates = [
    path.join(process.resourcesPath, 'qpdf-win', 'qpdf.exe'),
    path.join(app.getAppPath(), 'assets', 'qpdf-win', 'qpdf.exe'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function getQpdfCandidates(): string[] {
  const candidates: string[] = [];
  const bundled = getBundledQpdfPath();
  if (bundled) candidates.push(bundled);
  if (process.platform === 'win32') {
    candidates.push(
      'qpdf',
      'qpdf.exe',
      'C:\\Program Files\\qpdf\\bin\\qpdf.exe',
      'C:\\Program Files (x86)\\qpdf\\bin\\qpdf.exe',
      'C:\\ProgramData\\chocolatey\\bin\\qpdf.exe'
    );
  } else {
    candidates.push('qpdf', '/opt/homebrew/bin/qpdf', '/usr/local/bin/qpdf');
  }
  return candidates;
}

export async function checkQpdf(): Promise<{ ok: boolean; message?: string }> {
  for (const cmd of getQpdfCandidates()) {
    try {
      const { stdout } = await execFileAsync(cmd, ['--version']);
      return { ok: true, message: stdout.split('\n')[0] };
    } catch {
      // try next
    }
  }
  const installHint =
    process.platform === 'win32'
      ? 'choco install qpdf (PowerShell admin) hoặc tải tại qpdf.sourceforge.io'
      : 'brew install qpdf';
  return {
    ok: false,
    message: `Không tìm thấy qpdf. Cài đặt bằng: ${installHint}\n(qpdf dùng để đặt password cho PDF)`,
  };
}

async function getQpdfPath(): Promise<string> {
  for (const cmd of getQpdfCandidates()) {
    try {
      await execFileAsync(cmd, ['--version']);
      return cmd;
    } catch {
      // try next
    }
  }
  const hint =
    process.platform === 'win32' ? 'choco install qpdf' : 'brew install qpdf';
  throw new Error(`qpdf không được cài. Chạy: ${hint}`);
}

function formatCurrency(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

function soThanhChu(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  const rounded = Math.round(n);
  if (rounded === 0) return 'Không đồng';

  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

  function readTens(n: number): string {
    if (n < 10) return units[n];
    const t = Math.floor(n / 10), u = n % 10;
    if (t === 1) {
      return u === 0 ? 'mười' : u === 5 ? 'mười lăm' : 'mười ' + units[u];
    }
    const base = units[t] + ' mươi';
    if (u === 0) return base;
    if (u === 1) return base + ' mốt';
    if (u === 5) return base + ' lăm';
    return base + ' ' + units[u];
  }

  function readHundreds(n: number, useLinh = false): string {
    if (n === 0) return '';
    if (n < 100) return (useLinh ? 'linh ' : '') + readTens(n);
    const h = Math.floor(n / 100), r = n % 100;
    return units[h] + ' trăm' + (r > 0 ? ' ' + readHundreds(r, r < 10) : '');
  }

  const BILLION = 1_000_000_000;
  const MILLION = 1_000_000;
  const THOUSAND = 1_000;
  const parts: string[] = [];
  let rem = rounded;

  if (rem >= BILLION) {
    parts.push(readHundreds(Math.floor(rem / BILLION)) + ' tỷ');
    rem %= BILLION;
  }
  if (rem >= MILLION) {
    const m = Math.floor(rem / MILLION);
    parts.push(readHundreds(m, parts.length > 0 && m < 100) + ' triệu');
    rem %= MILLION;
  }
  if (rem >= THOUSAND) {
    const k = Math.floor(rem / THOUSAND);
    parts.push(readHundreds(k, parts.length > 0 && k < 100) + ' nghìn');
    rem %= THOUSAND;
  }
  if (rem > 0) {
    parts.push(readHundreds(rem, parts.length > 0 && rem < 100));
  }

  const raw = parts.join(' ') + ' đồng';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDateVN(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPhulucHtml(phuluc: Employee['phuluc'], monoFonts: string): string {
  if (!phuluc) return '';

  const sections: string[] = [];

  if (phuluc.chamCong?.length) {
    const total = phuluc.chamCong.reduce((s, r) => s + r.soTien, 0);
    const rows = phuluc.chamCong.map(r => `
      <tr>
        <td class="date">${escapeHtml(r.ngay)}</td>
        <td>${escapeHtml(r.moTa)}</td>
        <td>${escapeHtml(r.ghiChu ?? '')}</td>
        <td class="num neg">−${formatCurrency(Math.abs(r.soTien))}</td>
      </tr>`).join('');
    sections.push(`
      <div class="detail-group">
        <div class="detail-group-title">
          <span>Đóng góp trách nhiệm</span>
          <span class="detail-group-count">${phuluc.chamCong.length} lần</span>
        </div>
        <table class="detail-table">
          <thead><tr>
            <th style="width:18%">Ngày</th>
            <th style="width:28%">Thời gian</th>
            <th>Ghi chú</th>
            <th class="num">Thành tiền</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="detail-group-total">
          <span class="total-label-sm">Tổng</span>
          <span class="total-amount-sm neg">−${formatCurrency(Math.abs(total))}</span>
        </div>
      </div>`);
  }

  if (phuluc.nghiPhep?.length) {
    const rows = phuluc.nghiPhep.map(r => `
      <tr>
        <td class="date">${escapeHtml(r.ngay)}</td>
        <td>${escapeHtml(r.loai)}</td>
        <td>${escapeHtml(r.lyDo ?? '')}</td>
        <td class="num">${r.tinhLuong ? 'Có' : 'Không'}</td>
      </tr>`).join('');
    sections.push(`
      <div class="detail-group">
        <div class="detail-group-title">
          <span>Ngày nghỉ &amp; WFH trong kỳ</span>
          <span class="detail-group-count">${phuluc.nghiPhep.length} ngày</span>
        </div>
        <table class="detail-table">
          <thead><tr>
            <th style="width:18%">Ngày</th>
            <th style="width:22%">Loại</th>
            <th>Lý do / Ghi chú</th>
            <th class="num">Tính lương</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
  }

  const ql = phuluc.quyenLoi;
  if (ql) {
    const cards: string[] = [];
    if (ql.phepNam) {
      const { daDung, tong, cacNgay } = ql.phepNam;
      const con = tong - daDung;
      const fillPct = tong > 0 ? Math.round((daDung / tong) * 100) : 0;
      cards.push(`
        <div class="benefit-card">
          <div class="benefit-head">
            <span class="benefit-label">Phép năm</span>
          </div>
          <div class="benefit-stat">${con}<span class="unit">ngày</span> <span class="total">/ ${tong}</span></div>
          <div class="benefit-bar"><div class="benefit-bar-fill" style="width:${fillPct}%"></div></div>
          <div class="benefit-used">Đã dùng <strong>${daDung} ngày</strong>${cacNgay ? ` · ${escapeHtml(cacNgay)}` : ''}</div>
        </div>`);
    }
    if (ql.wfhThang) {
      const { daDung, cacNgay } = ql.wfhThang;
      cards.push(`
        <div class="benefit-card">
          <div class="benefit-head">
            <span class="benefit-label">WFH đã dùng</span>
          </div>
          <div class="benefit-stat">${daDung}<span class="unit">ngày</span></div>
          ${cacNgay ? `<div class="benefit-used" style="margin-top:6px">${escapeHtml(cacNgay)}</div>` : ''}
        </div>`);
    }
    if (cards.length) {
      sections.push(`
        <div class="detail-group">
          <div class="detail-group-title"><span>Quyền lợi còn lại</span></div>
          <div class="benefits">${cards.join('')}</div>
        </div>`);
    }
  }

  if (!sections.length) return '';

  return `
  <div class="section-divider"><span class="section-divider-mark">Phụ lục</span></div>
  <section class="breakdown">
    <div class="breakdown-head">
      <span class="breakdown-title">Chi tiết bảng công</span>
      <span class="breakdown-hint">Phụ lục đối chiếu</span>
    </div>
    <div class="breakdown-subtitle">Diễn giải các khoản phát sinh trong kỳ — dùng để hai bên đối chiếu và xác nhận.</div>
    ${sections.join('')}
  </section>`;
}

function buildHtml(emp: Employee, settings: Settings, opts: SendOptions): string {
  // Subtotals — ưu tiên giá trị đã tính sẵn từ Excel, fallback sang sum nếu thiếu.
  const tongLuong = emp.tongLuong ?? emp.luong.reduce((s, i) => s + i.soTien, 0);
  const tongLuongNgayCong = emp.tongLuongNgayCong ?? tongLuong;
  const tongThuNhap = emp.tongThuNhap
    ?? (tongLuongNgayCong + emp.thuNhapBoSung.reduce((s, i) => s + i.soTien, 0));
  const tongKhauTru = emp.khauTru.reduce((s, i) => s + i.soTien, 0);
  const tongNgoaiLuong = (emp.ngoaiLuong ?? []).reduce((s, i) => s + i.soTien, 0);

  const month = opts.month.padStart(2, '0');
  const docIdSuffix = emp.maNV
    ? escapeHtml(emp.maNV)
    : String(emp.rowIndex + 1).padStart(3, '0');
  const docId = `PL-${escapeHtml(opts.year)}-${month}-${docIdSuffix}`;

  const renderIncomeRow = (i: { nhan: string; soTien: number; note?: string }) => {
    const neg = i.soTien < 0;
    return `
      <div class="row">
        <div class="row-label">${escapeHtml(i.nhan)}${i.note ? `<div class="note">${escapeHtml(i.note)}</div>` : ''}</div>
        <div class="row-amount${neg ? ' neg' : ''}">${neg ? '−' : ''}${formatCurrency(Math.abs(i.soTien))}</div>
      </div>`;
  };

  const luongRows = emp.luong.map(renderIncomeRow).join('');
  const thuNhapBoSungRows = emp.thuNhapBoSung.map(renderIncomeRow).join('');

  // Bước ② — Tổng lương theo ngày công là tổng phụ chính của bảng Thu nhập.
  // Bordered emphatic + formula note ngay dưới (gần baseline, cách dòng tiếp theo ra chút).
  const hasNgayCongData =
    emp.ngayCong != null && emp.ngayCongChuan != null && emp.ngayCongChuan > 0;
  const ngayCongCalc = hasNgayCongData
    ? `= ${tongLuong.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ÷ ${emp.ngayCongChuan} × ${emp.ngayCong}`
    : '';
  const tongLuongNgayCongBlock = `
      <div class="subtotal-bordered subtotal-bordered-step">
        <div class="subtotal-bordered-inner">
          <span class="label">Tổng lương theo ngày công:</span>
          <span class="amount">${formatCurrency(tongLuongNgayCong)}</span>
        </div>
      </div>
      <div class="formula-note">
        ${ngayCongCalc ? `<span class="calc">${escapeHtml(ngayCongCalc)}</span>` : ''}
        <span class="desc">(Tổng lương ÷ Ngày công chuẩn × Ngày công thực tế)</span>
      </div>`;

  const hasLuongStep = emp.luong.length > 0 || emp.tongLuong != null;
  const hasBoSungStep = emp.thuNhapBoSung.length > 0;

  // Tách khấu trừ thành 2 phần: BHXH-style (trước thuế) và thuế (TNCN, lũy tiến…).
  // Mức giảm trừ NPT chèn giữa — vì nó dùng để tính thuế, đứng ngay trước Thuế TNCN.
  const isTaxRow = (label: string) => /thuế|tncn|tax/i.test(label);
  const renderKhauTruRow = (i: { nhan: string; soTien: number; note?: string }) => `
      <div class="row">
        <div class="row-label">${escapeHtml(i.nhan)}${i.note ? `<div class="note">${escapeHtml(i.note)}</div>` : ''}</div>
        <div class="row-amount neg">−${formatCurrency(i.soTien)}</div>
      </div>`;
  const khauTruPreTax = emp.khauTru.filter((i) => !isTaxRow(i.nhan)).map(renderKhauTruRow).join('');
  const khauTruTax = emp.khauTru.filter((i) => isTaxRow(i.nhan)).map(renderKhauTruRow).join('');

  const giamTruNPTHtml = emp.giamTruNPT != null ? `
      <div class="row">
        <div class="row-label">Mức giảm trừ bản thân &amp; người phụ thuộc
          <div class="note">${formatCurrency(emp.giamTruNPT)}</div>
        </div>
      </div>` : '';

  const khauTruEmpty = !khauTruPreTax && !khauTruTax && !giamTruNPTHtml;

  // Tổng thu nhập sau thuế đã đổi tên là "Thu nhập sau thuế" và gộp vào cuối Bảng Khấu trừ.
  const tongThuNhapSauThueHtml = '';

  const ngoaiLuongRows = (emp.ngoaiLuong ?? [])
    .map(i => {
      const neg = i.soTien < 0;
      const prefix = neg ? '−' : '+';
      return `
      <div class="row">
        <div class="row-label">${escapeHtml(i.nhan)}${i.note ? `<div class="note">${escapeHtml(i.note)}</div>` : ''}</div>
        <div class="row-amount${neg ? ' neg' : ''}">${prefix}${formatCurrency(Math.abs(i.soTien))}</div>
      </div>`;
    })
    .join('');

  // Bảng Ngoài lương: luôn hiển thị (kể cả khi rỗng → "0đ"), có title + nội dung + total.
  const hasNgoaiLuong = (emp.ngoaiLuong ?? []).length > 0;
  const ngoaiLuongTotalSign = tongNgoaiLuong < 0 ? '−' : (tongNgoaiLuong > 0 ? '+' : '');
  const ngoaiLuongSection = `
  <section class="section">
    <div class="section-head">
      <span class="section-title">Cộng / Trừ ngoài lương</span>
      <span class="section-hint">(±)</span>
    </div>
    ${hasNgoaiLuong
      ? ngoaiLuongRows
      : `<div class="row"><div class="row-label" style="color:var(--muted)">— Không có —</div><div class="row-amount muted">${formatCurrency(0)}</div></div>`}
    <div class="subtotal-bordered">
      <div class="subtotal-bordered-inner">
        <span class="label">Tổng cộng / trừ ngoài lương:</span>
        <span class="amount"${tongNgoaiLuong < 0 ? ' style="color:var(--negative)"' : ''}>${ngoaiLuongTotalSign}${formatCurrency(Math.abs(tongNgoaiLuong))}</span>
      </div>
    </div>
  </section>`;

  // Info group 1: 4 ô fixed positions (top-left/top-right/bottom-left/bottom-right).
  // Cell luôn render dù value rỗng → các ô khác giữ nguyên vị trí.
  const hoTenCell = `
    <div class="info-item info-cell-tl">
      <span class="info-label">Họ và tên</span>
      <span class="info-value">${escapeHtml(emp.hoTen)}</span>
    </div>`;

  const maNVCell = `
    <div class="info-item info-cell-tr">
      ${emp.maNV ? `<span class="info-label">Mã nhân viên</span>
      <span class="info-value code">${escapeHtml(emp.maNV)}</span>` : ''}
    </div>`;

  const viTriCell = `
    <div class="info-item info-cell-bl">
      ${emp.viTri ? `<span class="info-label">Chức danh</span>
      <span class="info-value">${escapeHtml(emp.viTri)}${emp.phongBan ? ` <span class="info-sub">· ${escapeHtml(emp.phongBan)}</span>` : ''}</span>` : ''}
    </div>`;

  const emailCell = `
    <div class="info-item info-cell-br">
      <span class="info-label">Email</span>
      <span class="info-value email-value">${escapeHtml(emp.email)}</span>
    </div>`;

  // Info group 2: ngày công chuẩn (left) + ngày công thực tế (right).
  const ngayCongChuanCell = `
    <div class="info-item">
      ${emp.ngayCongChuan != null ? `<span class="info-label">Ngày công chuẩn</span>
      <span class="info-value">${emp.ngayCongChuan} ngày</span>` : ''}
    </div>`;

  const ngayCongCell = `
    <div class="info-item">
      ${emp.ngayCong != null ? `<span class="info-label">Ngày công thực tế</span>
      <span class="info-value">${emp.ngayCong} ngày</span>` : ''}
    </div>`;

  const bangchuStr = soThanhChu(emp.thucNhan);

  const logoHtml = settings.logoDataUrl
    ? `<img src="${settings.logoDataUrl}" class="logo" alt="logo" />`
    : '';

  // System font stacks — Google Fonts không load được trong sandbox PDF renderer
  // sans-serif xấp xỉ Be Vietnam Pro / Source Sans 3; monospace xấp xỉ Fira Code
  const sansFonts = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
  const monoFonts = `ui-monospace, 'SF Mono', Menlo, 'Cascadia Code', 'Courier New', monospace`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Phiếu lương — Tháng ${month}/${escapeHtml(opts.year)}</title>
<style>
  :root {
    --ink: #0f1419;
    --ink-soft: #3a4149;
    --muted: #6b7280;
    --line: #e5e7eb;
    --line-strong: #111827;
    --accent: #b91c1c;
    --negative: #991b1b;
    --paper-tint: #fafaf7;
    --sans: ${sansFonts};
    --mono: ${monoFonts};
  }

  /* Long single page — @page width = A5 width, height auto.
     printToPDF set pageSize động theo content height đo runtime. */
  @page { size: 148mm auto; margin: 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #fff;
    color: var(--ink);
    font-family: var(--sans);
    font-size: 12px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    width: 148mm;
    padding: 12mm;
  }

  /* ── Masthead ── */
  .masthead {
    border-bottom: 2px solid var(--line-strong);
    padding-bottom: 14px;
    margin-bottom: 18px;
    break-inside: avoid;
  }
  .masthead-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .company { font-weight: 700; font-size: 12px; }
  .company-sub { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .logo { max-height: 36px; display: block; margin-bottom: 4px; }
  .doc-meta { text-align: right; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .doc-meta strong {
    display: block;
    font-family: var(--mono);
    color: var(--ink);
    font-weight: 500;
    font-size: 10px;
    text-transform: none;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }
  .title-block { display: flex; justify-content: space-between; align-items: baseline; }
  .title { font-weight: 700; font-size: 20px; letter-spacing: -0.02em; line-height: 1.2; }
  .period-block { text-align: right; }
  .period { font-family: var(--mono); font-size: 10px; color: var(--accent); font-weight: 500; }
  .issue-date { font-size: 9px; color: var(--muted); font-style: italic; margin-top: 2px; }

  /* ── Employee info — 2 nhóm tách nhau ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    break-inside: avoid;
  }
  /* Group 1: 4 ô fixed positions — kể cả khi 1 ô trống, các ô khác giữ vị trí */
  .info-grid-main {
    grid-template-rows: auto auto;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .info-cell-tl { grid-row: 1; grid-column: 1; }
  .info-cell-tr { grid-row: 1; grid-column: 2; }
  .info-cell-bl { grid-row: 2; grid-column: 1; }
  .info-cell-br { grid-row: 2; grid-column: 2; }
  /* Group 2: ngày công chuẩn (trái) + ngày công thực tế (phải) */
  .info-grid-attendance {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    margin-bottom: 16px;
  }
  .info-item { display: flex; flex-direction: column; gap: 2px; min-height: 32px; }
  .info-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); font-weight: 600; }
  /* Tất cả info-value đều đen + bold cho consistency */
  .info-value { font-size: 12px; font-weight: 600; color: var(--ink); }
  .info-value.code { font-family: var(--mono); font-weight: 600; font-size: 11px; }
  .info-value.email-value { font-size: 11px; font-weight: 600; word-break: break-all; }
  .info-sub { font-size: 11px; font-weight: 400; color: var(--muted); }

  /* ── Section ── */
  .section { margin-bottom: 44px; break-inside: avoid; }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    background: var(--paper-tint);
    padding: 7px 12px;
    border-bottom: 1px solid var(--ink);
    margin-bottom: 8px;
  }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .section-hint { font-family: var(--mono); font-size: 10px; color: var(--muted); }

  /* ── Rows ── */
  .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 3px 0 3px 14px; gap: 12px; }
  .row-label { font-size: 12px; color: var(--ink-soft); }
  .note { font-size: 9px; color: var(--muted); line-height: 1.3; margin-top: 1px; font-weight: 400; font-style: italic; }
  .row-amount {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .row-amount.neg { color: var(--negative); }
  .row-amount.muted { color: var(--muted); }

  /* Tổng thu nhập sau thuế — single row, không section. Top border full-width,
     tinted bg, không bottom underline. Đứng giữa bảng Khấu trừ và Ngoài lương. */
  .net-after-tax-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    background: var(--paper-tint);
    padding: 9px 12px;
    border-top: 1px solid var(--ink);
    margin-top: 12px;
    margin-bottom: 20px;
  }
  .net-after-tax-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink);
  }
  .net-after-tax-amount {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  /* Subtotal ITALIC — Tổng lương (subtle).
     Chỉ có gạch trên (shrink-wrap, dashed, mờ, mảnh ≈ 1/2 so với header). */
  .subtotal-italic {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    margin-bottom: 6px;
  }
  .subtotal-italic-inner {
    display: inline-flex;
    align-items: baseline;
    gap: 12px;
    border-top: 0.5px dashed var(--muted);
    padding-top: 4px;
  }
  .subtotal-italic-inner .label {
    font-size: 11px;
    font-style: italic;
    font-weight: 400;
    color: var(--ink-soft);
  }
  .subtotal-italic-inner .amount {
    font-family: var(--mono);
    font-size: 12px;
    font-style: italic;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }

  /* Supplementary row — italic subtle, dùng trong bảng Khấu trừ làm "show math" rows.
     Không borders, đứng trong flow ngay trước subtotal-bordered. */
  .supplementary {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 12px;
    padding: 1px 0;
  }
  .supplementary .label {
    font-size: 11px;
    font-style: italic;
    font-weight: 400;
    color: var(--ink-soft);
  }
  .supplementary .amount {
    font-family: var(--mono);
    font-size: 11px;
    font-style: italic;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }
  .supplementary.first { margin-top: 8px; }
  .supplementary.last  { margin-bottom: 4px; }

  /* Variant: subtotal-bordered cho Tổng lương theo ngày công.
     Top + bottom shrink-wrap, dùng style giống divider info-grid → 1px solid var(--line). */
  .subtotal-bordered.subtotal-bordered-step {
    border-top: 0;
    padding-top: 0;
  }
  .subtotal-bordered.subtotal-bordered-step .subtotal-bordered-inner {
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 4px 0;
  }

  /* Subtotal BORDERED — đóng bảng. Top line full-width (giống section-head bottom),
     bottom underline chỉ "đúng khung" của tổng phụ (không full width). */
  .subtotal-bordered {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--ink);
  }
  .subtotal-bordered-inner {
    display: inline-flex;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--ink);
  }
  .subtotal-bordered-inner .label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink);
  }
  .subtotal-bordered-inner .amount {
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  /* Step ② — Tổng lương theo ngày công.
     Không bg, không bold. Formula note gần baseline, cách dòng tiếp theo ra. */
  .subtotal-step {
    margin-top: 6px;
    margin-bottom: 18px;
  }
  .subtotal-step-row {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 12px;
  }
  .subtotal-step-row .label {
    font-size: 11px;
    font-weight: 400;
    color: var(--ink);
  }
  .subtotal-step-row .amount {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
  .formula-note {
    margin-top: 1px;
    text-align: right;
    font-size: 9px;
    color: var(--muted);
    line-height: 1.4;
  }
  .formula-note .calc {
    display: block;
    font-family: var(--mono);
    font-style: normal;
  }
  .formula-note .desc {
    display: block;
    font-style: italic;
  }

  /* ── Total — đen-trắng, chữ cam tươi sáng, số extra-bold, bằng chữ to hơn ── */
  .total-block {
    margin-top: 24px;
    padding: 16px 0;
    border-top: 2px solid var(--line-strong);
    border-bottom: 2px solid var(--line-strong);
    break-inside: avoid;
  }
  .total-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
  .total-label {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    color: var(--ink);
  }
  .total-amount {
    font-size: 32px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .bangchu {
    margin-top: 8px;
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    text-align: right;
  }

  /* ── Footer ── */
  .disclaimer {
    margin-top: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-size: 9px;
    color: var(--muted);
    line-height: 1.6;
    text-align: center;
  }

  /* ── Section divider ── */
  .section-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 24px -12mm 18px;
    padding: 0 12mm;
    break-inside: avoid;
  }
  .section-divider::before, .section-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--line-strong);
  }
  .section-divider-mark {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .section-divider-mark::before { content: '◆ '; color: var(--accent); }
  .section-divider-mark::after  { content: ' ◆'; color: var(--accent); }

  /* ── Breakdown (phụ lục) ── */
  .breakdown {
    background: #fafaf7;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    margin: 0 -12mm;
    padding: 14px 12mm 4px;
  }
  .breakdown-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .breakdown-title { font-size: 13px; font-weight: 700; letter-spacing: -0.01em; }
  .breakdown-subtitle { font-size: 9px; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
  .breakdown-hint { font-family: var(--mono); font-size: 9px; color: var(--muted); }

  .detail-group { margin-bottom: 14px; }
  .detail-group-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 3px 0;
    border-bottom: 1px solid var(--line);
    margin-bottom: 5px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .detail-group-count {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0.03em;
  }

  .detail-table { width: 100%; font-size: 10px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  .detail-table th {
    text-align: left;
    font-weight: 600;
    color: var(--muted);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 6px 3px 0;
    border-bottom: 1px solid var(--line);
  }
  .detail-table th.num { text-align: right; padding-right: 0; }
  .detail-table td { padding: 4px 6px 4px 0; color: var(--ink-soft); vertical-align: baseline; }
  .detail-table td.num {
    font-family: var(--mono);
    font-size: 10px;
    text-align: right;
    padding-right: 0;
    color: var(--ink);
    white-space: nowrap;
  }
  .detail-table td.neg { color: var(--negative); }
  .detail-table td.date {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink);
    font-weight: 500;
    white-space: nowrap;
  }

  .detail-group-total {
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 8px;
    padding-top: 5px;
  }
  .total-label-sm {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .total-amount-sm {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
    border-top: 1px solid var(--ink);
    padding-top: 3px;
    min-width: 72px;
    text-align: right;
  }
  .total-amount-sm.neg { color: var(--negative); border-top-color: var(--negative); }

  /* ── Benefits ── */
  .benefits { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .benefit-card { border: 1px solid var(--line); padding: 9px 10px; background: #fff; }
  .benefit-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
  .benefit-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
  .benefit-stat { font-family: var(--mono); font-size: 16px; font-weight: 500; font-variant-numeric: tabular-nums; line-height: 1.2; margin-bottom: 2px; }
  .benefit-stat .total { color: var(--muted); font-size: 11px; }
  .benefit-stat .unit { font-family: var(--sans); font-size: 9px; color: var(--muted); font-weight: 400; margin-left: 2px; }
  .benefit-bar { height: 2px; background: var(--line); margin: 7px 0 5px; position: relative; }
  .benefit-bar-fill { position: absolute; top: 0; left: 0; height: 100%; background: var(--ink); }
  .benefit-used { font-size: 9px; color: var(--muted); line-height: 1.5; }
  .benefit-used strong { color: var(--ink-soft); font-weight: 600; }
</style>
</head>
<body>

  <div class="masthead">
    <div class="masthead-top">
      <div>
        ${logoHtml}
      </div>
      <div class="doc-meta">
        Số phiếu
        <strong>${docId}</strong>
      </div>
    </div>
    <div class="title-block">
      <div class="title">Phiếu lương</div>
      <div class="period-block">
        <div class="period">Kỳ ${month} / ${escapeHtml(opts.year)}</div>
        <div class="issue-date">Ngày phát hành: ${formatDateVN(new Date())}</div>
      </div>
    </div>
  </div>

  <div class="info-grid info-grid-main">
    ${hoTenCell}
    ${maNVCell}
    ${viTriCell}
    ${emailCell}
  </div>
  <div class="info-grid info-grid-attendance">
    ${ngayCongChuanCell}
    ${ngayCongCell}
  </div>

  <section class="section">
    <div class="section-head">
      <span class="section-title">Thu nhập</span>
      <span class="section-hint">(+)</span>
    </div>
    ${hasLuongStep ? `
      ${luongRows}
      <div class="subtotal-italic">
        <div class="subtotal-italic-inner">
          <span class="label">Tổng lương:</span>
          <span class="amount">${formatCurrency(tongLuong)}</span>
        </div>
      </div>
      ${tongLuongNgayCongBlock}
    ` : ''}
    ${hasBoSungStep ? thuNhapBoSungRows : ''}
    ${(!hasLuongStep && !hasBoSungStep) ? '<div class="row"><div class="row-label" style="color:var(--muted)">— Không có —</div></div>' : ''}
    <div class="subtotal-bordered">
      <div class="subtotal-bordered-inner">
        <span class="label">Tổng thu nhập:</span>
        <span class="amount">${formatCurrency(tongThuNhap)}</span>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <span class="section-title">Các khoản khấu trừ</span>
      <span class="section-hint">(−)</span>
    </div>
    ${khauTruEmpty ? '<div class="row"><div class="row-label" style="color:var(--muted)">— Không có —</div></div>' : ''}
    ${khauTruPreTax}
    ${giamTruNPTHtml}
    ${khauTruTax}
    <div class="subtotal-bordered">
      <div class="subtotal-bordered-inner">
        <span class="label">Tổng khấu trừ:</span>
        <span class="amount" style="color:var(--negative)">−${formatCurrency(tongKhauTru)}</span>
      </div>
    </div>
  </section>

  ${emp.tongThuNhapSauThue != null ? `
  <div class="net-after-tax-row">
    <span class="net-after-tax-label">Tổng thu nhập sau thuế</span>
    <span class="net-after-tax-amount">${formatCurrency(emp.tongThuNhapSauThue)}</span>
  </div>` : ''}

  ${tongThuNhapSauThueHtml}

  ${ngoaiLuongSection}

  <div class="total-block">
    <div class="total-row">
      <span class="total-label">Thực nhận</span>
      <span class="total-amount"${emp.thucNhan < 0 ? ' style="color:var(--negative)"' : ''}>${emp.thucNhan < 0 ? '−' : ''}${formatCurrency(Math.abs(emp.thucNhan))}</span>
    </div>
    ${bangchuStr ? `<div class="bangchu">Bằng chữ: ${escapeHtml(bangchuStr)}</div>` : ''}
  </div>

  ${buildPhulucHtml(emp.phuluc, monoFonts)}

  <div class="disclaimer">
    Phiếu lương được phát hành theo quy định tại Điều 95 Bộ luật Lao động 2019.<br>
    Mọi thắc mắc vui lòng liên hệ Phòng Nhân sự trong vòng 07 ngày kể từ ngày nhận.
  </div>

</body>
</html>`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 600,
    height: 800,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
  });
  try {
    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await win.loadURL(dataUrl);

    // Đo content height (CSS px @96 DPI) → convert sang inches cho printToPDF.
    // Electron 21+ pageSize dùng INCHES, không phải microns.
    const heightPx = (await win.webContents.executeJavaScript(
      `Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight)`
    )) as number;
    const heightInches = Math.max(heightPx / 96, 5.83); // tối thiểu = A5 height ratio
    const widthInches = 148 / 25.4; // 148mm → 5.8268 in

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: widthInches, height: heightInches },
      margins: { marginType: 'none' },
    });
    return pdf;
  } finally {
    win.destroy();
  }
}

async function encryptPdfWithPassword(
  pdfBuffer: Buffer,
  password: string
): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(ensureTempRoot(), 'enc-'));
  const inPath = path.join(tmpDir, 'in.pdf');
  const outPath = path.join(tmpDir, 'out.pdf');
  fs.writeFileSync(inPath, pdfBuffer);

  const qpdf = await getQpdfPath();
  // execFile với args array — KHÔNG đi qua shell nên không cần escape password/args
  await execFileAsync(qpdf, ['--encrypt', password, password, '256', '--', inPath, outPath]);
  fs.unlinkSync(inPath);
  return outPath;
}

export async function renderPayslipPdf(
  employee: Employee,
  settings: Settings,
  opts: SendOptions,
  options: { encrypt: boolean } = { encrypt: true }
): Promise<{ pdfPath: string; password: string | null }> {
  const html = buildHtml(employee, settings, opts);
  const pdfBuffer = await htmlToPdf(html);

  if (!options.encrypt) {
    const tmpDir = fs.mkdtempSync(path.join(ensureTempRoot(), 'preview-'));
    const outPath = path.join(tmpDir, 'preview.pdf');
    fs.writeFileSync(outPath, pdfBuffer);
    return { pdfPath: outPath, password: null };
  }

  const password = employee.pdfPassword;
  if (!password) {
    throw new Error(`Thiếu mật khẩu OTP cho ${employee.hoTen}`);
  }
  const pdfPath = await encryptPdfWithPassword(pdfBuffer, password);
  return { pdfPath, password };
}

export function cleanupPdf(pdfPath: string): void {
  try {
    fs.unlinkSync(pdfPath);
    const dir = path.dirname(pdfPath);
    fs.rmdirSync(dir);
  } catch {
    // ignore cleanup errors
  }
}
