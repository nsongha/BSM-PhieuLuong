import * as XLSX from 'xlsx';
import * as fs from 'fs';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ROWS = 10_000;

function loadWorkbook(filePath: string): XLSX.WorkBook {
  if (!fs.existsSync(filePath)) throw new Error(`File không tồn tại: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_BYTES) {
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `File quá lớn (${mb} MB). Giới hạn: ${MAX_FILE_BYTES / 1024 / 1024} MB. Tách nhỏ file để tránh treo app.`
    );
  }
  return XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
}

export function listSheets(filePath: string): string[] {
  return loadWorkbook(filePath).SheetNames;
}

// Scan first 15 rows to find the best header row (contains "họ tên" + "email").
// If the next row is also a sub-header (string-heavy, few numbers), merge both rows
// so multi-level headers like BSM Labs' "Lương cơ bản" / "Thưởng hiệu suất" are captured.
function detectHeaders(allRows: unknown[][]): { mergedHeaders: string[]; dataStartIdx: number } {
  const KEYWORDS = ['họ', 'tên', 'email', 'mã', 'lương', 'gross', 'net', 'thực', 'nhận', 'stt', 'nhân viên'];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const text = allRows[i].map((v) => (typeof v === 'string' ? v.toLowerCase() : '')).join(' ');
    if ((text.includes('họ và tên') || text.includes('họ tên')) && text.includes('email')) {
      headerIdx = i;
      break;
    }
  }
  // Fallback: row with highest keyword-weighted string-cell count
  if (headerIdx === -1) {
    let best = -1;
    for (let i = 0; i < Math.min(15, allRows.length); i++) {
      const strCells = allRows[i].filter((v) => typeof v === 'string' && (v as string).trim().length > 1);
      let score = strCells.length;
      const text = strCells.map((v) => (v as string).toLowerCase()).join(' ');
      for (const kw of KEYWORDS) if (text.includes(kw)) score += 3;
      if (score > best) { best = score; headerIdx = i; }
    }
  }
  if (headerIdx < 0) headerIdx = 0;

  const mainRow = (allRows[headerIdx] ?? []) as unknown[];
  const nextRow = (allRows[headerIdx + 1] ?? []) as unknown[];
  const nextStrCount = nextRow.filter((v) => typeof v === 'string' && (v as string).trim().length > 1).length;
  const nextNumCount = nextRow.filter((v) => typeof v === 'number').length;
  const isSubHeader = nextStrCount >= 3 && nextNumCount < nextStrCount;

  const colCount = Math.max(mainRow.length, isSubHeader ? nextRow.length : 0);
  const mergedHeaders: string[] = [];
  for (let c = 0; c < colCount; c++) {
    const main = typeof mainRow[c] === 'string' ? (mainRow[c] as string).trim() : '';
    const sub = isSubHeader && typeof nextRow[c] === 'string' ? (nextRow[c] as string).trim() : '';
    mergedHeaders[c] = sub || main; // sub-header is more specific
  }

  // Find which column index is "Họ và tên" — data rows must have a name there
  const NAME_KEYWORDS = ['họ và tên', 'họ tên', 'ho va ten', 'ho ten', 'fullname', 'tên nhân viên'];
  const nameColIdx = mergedHeaders.findIndex((h) =>
    NAME_KEYWORDS.some((kw) => h.toLowerCase().includes(kw))
  );

  // Skip header-extension rows until we hit a row with a non-empty string in the name column
  let dataStart = headerIdx + (isSubHeader ? 2 : 1);
  while (dataStart < Math.min(headerIdx + 8, allRows.length)) {
    const row = allRows[dataStart];
    const nameVal = nameColIdx >= 0 ? row[nameColIdx] : null;
    if (typeof nameVal === 'string' && nameVal.trim().length > 0) break;
    // Fallback: if name col not found, stop at first row with any non-empty string in early columns
    if (nameColIdx < 0) {
      const hasName = row.slice(0, 5).some((v) => typeof v === 'string' && (v as string).trim().length > 2);
      if (hasName) break;
    }
    dataStart++;
  }

  return { mergedHeaders, dataStartIdx: dataStart };
}

function colIndexToLetter(idx: number): string {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Lan toả giá trị anchor của các cell merged xuống các cell con — chỉ áp dụng
 * ở vùng header (15 dòng đầu) để tránh ảnh hưởng data thật.
 *
 * SheetJS để cell con của merge = '' theo mặc định; nhiều file BSM-style merge
 * theo chiều dọc (e.g. AM4:AM6 = "TỔNG THU NHẬP") khiến header phụ bị mất tên.
 */
function fillMergedHeaderCells(ws: XLSX.WorkSheet, allRows: unknown[][], headerScan = 15): void {
  const merges = ws['!merges'];
  if (!merges) return;
  for (const m of merges) {
    if (m.s.r >= headerScan) continue; // chỉ vùng header
    const anchor = (allRows[m.s.r] ?? [])[m.s.c];
    if (anchor === '' || anchor == null) continue;
    for (let r = m.s.r; r <= m.e.r && r < headerScan; r++) {
      if (!allRows[r]) allRows[r] = [];
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (!allRows[r][c]) allRows[r][c] = anchor;
      }
    }
  }
}

export function readXlsx(
  filePath: string,
  sheetIndex = 0
): { headers: string[]; rows: Record<string, unknown>[] } {
  const wb = loadWorkbook(filePath);
  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
  if (!sheetName) throw new Error('File Excel không có sheet nào');
  const ws = wb.Sheets[sheetName];

  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
  fillMergedHeaderCells(ws, allRows);
  const { mergedHeaders, dataStartIdx } = detectHeaders(allRows);

  // Dedupe headers — nhiều file có header trùng tên ở các cột khác nhau (vd "Hỗ trợ ăn trưa"
  // xuất hiện cả ở phần Thử việc lẫn Chính thức). Append cột letter cho duplicate để
  // giữ data riêng biệt (downstream dùng row[header] để lookup).
  const seenHeaders = new Map<string, number>();
  const headers = mergedHeaders.map((h, i) => {
    const name = h && h.trim() ? h : `Cột ${i + 1}`;
    const count = seenHeaders.get(name) ?? 0;
    seenHeaders.set(name, count + 1);
    if (count === 0) return name;
    const colLetter = colIndexToLetter(i);
    return `${name} (${colLetter})`;
  });
  const dataRows = allRows.slice(dataStartIdx);

  if (dataRows.length > MAX_ROWS) {
    throw new Error(
      `File có ${dataRows.length} dòng — vượt giới hạn ${MAX_ROWS}. Tách nhỏ để gửi theo đợt.`
    );
  }

  const rows: Record<string, unknown>[] = dataRows
    .map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = (row as unknown[])[i] ?? ''; });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v !== '' && v != null));

  const nonEmptyHeaders = headers.filter((h) => !h.startsWith('Cột ') || mergedHeaders[headers.indexOf(h)]);
  return { headers: nonEmptyHeaders, rows };
}
