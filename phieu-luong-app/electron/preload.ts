import { contextBridge, ipcRenderer } from 'electron';

export type PhulucChamCong = {
  ngay: string;
  moTa: string;
  ghiChu?: string;
  soTien: number;
};

export type PhulucNghiPhep = {
  ngay: string;
  loai: string;
  lyDo?: string;
  tinhLuong: boolean;
};

export type PhulucQuyenLoi = {
  phepNam?: { daDung: number; tong: number; cacNgay?: string };
  wfhThang?: { daDung: number; cacNgay?: string };
};

export type Phuluc = {
  chamCong?: PhulucChamCong[];
  nghiPhep?: PhulucNghiPhep[];
  quyenLoi?: PhulucQuyenLoi;
};

export type LoaiNV = 'chinhThuc' | 'thuViec' | 'ctv' | 'unknown';

export type LuongPath = {
  tongCol: string;
  items: Array<{ nhan: string; col: string; note?: string }>;
};

export type Employee = {
  rowIndex: number;
  hoTen: string;
  email: string;
  maNV: string;
  pdfPassword: string;
  loaiNV: LoaiNV;
  viTri?: string;
  phongBan?: string;
  ngayCong?: number;
  ngayCongChuan?: number;
  thucNhan: number;
  // Bước ① — items + Tổng lương (đọc từ Excel)
  luong: Array<{ nhan: string; soTien: number; note?: string }>;
  tongLuong?: number;
  // Bước ② — Tổng lương theo ngày công (đọc từ Excel)
  tongLuongNgayCong?: number;
  // Bước ③ — items + Tổng thu nhập (đọc từ Excel)
  thuNhapBoSung: Array<{ nhan: string; soTien: number; note?: string }>;
  tongThuNhap?: number;
  khauTru: Array<{ nhan: string; soTien: number; note?: string }>;
  giamTruNPT?: number;
  tongThuNhapSauThue?: number;
  ngoaiLuong: Array<{ nhan: string; soTien: number; note?: string }>;
  phuluc?: Phuluc;
  errors: string[];
};

export type Mapping = {
  hoTen: string;
  email: string;
  maNV: string;
  code?: string;
  thucNhan: string;
  viTri?: string;
  phongBan?: string;
  ngayCong?: string;
  ngayCongChuan?: string;
  // Bước ① — paths theo loại NV (chính thức exposed in UI; thử việc/CTV auto)
  luongChinhThuc?: LuongPath;
  luongThuViec?: LuongPath;
  luongCtv?: LuongPath;
  // Bước ② + ③ — cột tổng đã tính sẵn trong Excel
  tongLuongNgayCongCol?: string;
  tongThuNhapCol?: string;
  thuNhapBoSung: Array<{ nhan: string; col: string; note?: string }>;
  khauTru: Array<{ nhan: string; col: string; note?: string }>;
  giamTruNPT?: string;
  tongThuNhapSauThue?: string;
  ngoaiLuong: Array<{ nhan: string; col: string; note?: string; isDeduction?: boolean }>;
};

export type Settings = {
  companyName: string;
  logoDataUrl?: string;
  emailUser: string;
  emailTest: string;
  trackerEndpoint?: string;
  trackingEnabled: boolean;
  isConfigured: boolean;
};

export type SendOptions = {
  month: string;
  year: string;
  testMode: boolean;
  simulate: boolean;
};

export type SendProgress =
  | { kind: 'start'; total: number }
  | { kind: 'sent'; rowIndex: number; hoTen: string; email: string }
  | { kind: 'failed'; rowIndex: number; hoTen: string; email: string; error: string }
  | { kind: 'done'; total: number; succeeded: number; failed: number };

export type LogRecipient = {
  hoTen: string;
  email: string;
  maNV: string;
  status: 'sent' | 'failed';
  error?: string;
  trackToken?: string;
};

export type OpenStatus =
  | { opened: false }
  | { opened: true; firstAt: number; lastAt: number; count: number };

export type LogEntry = {
  id: string;
  timestamp: string;
  month: string;
  year: string;
  total: number;
  succeeded: number;
  failed: number;
  testMode: boolean;
  simulate: boolean;
  dryRun?: boolean;
  recipients: LogRecipient[];
};

export type Checkpoint = {
  batchId: string;
  startedAt: string;
  employees: Employee[];
  settings: Settings;
  opts: SendOptions;
  processedRowIndexes: number[];
  recipients: LogRecipient[];
};

const api = {
  excel: {
    listSheets: (filePath: string) =>
      ipcRenderer.invoke('excel:list-sheets', filePath) as Promise<string[]>,
    read: (filePath: string, sheetIndex?: number) =>
      ipcRenderer.invoke('excel:read', filePath, sheetIndex) as Promise<{
        headers: string[];
        rows: Record<string, unknown>[];
      }>,
  },
  mapping: {
    validate: (rows: Record<string, unknown>[], mapping: Mapping) =>
      ipcRenderer.invoke('mapping:validate', rows, mapping) as Promise<Employee[]>,
  },
  pdf: {
    preview: (employee: Employee, settings: Settings, opts: SendOptions) =>
      ipcRenderer.invoke('pdf:preview', employee, settings, opts) as Promise<{
        pdfPath: string;
        password: string | null;
      }>,
  },
  email: {
    testConnection: (user: string, password: string) =>
      ipcRenderer.invoke('email:test-connection', user, password) as Promise<{
        ok: boolean;
        error?: string;
      }>,
    dryRun: (employees: Employee[], settings: Settings, opts: SendOptions) =>
      ipcRenderer.invoke('email:dry-run', employees, settings, opts) as Promise<{
        ok: boolean;
        error?: string;
        sent?: number;
      }>,
    sendBatch: (employees: Employee[], settings: Settings, opts: SendOptions) =>
      ipcRenderer.invoke('email:send-batch', employees, settings, opts) as Promise<void>,
    cancel: () => ipcRenderer.invoke('email:cancel') as Promise<void>,
  },
  settings: {
    get: () =>
      ipcRenderer.invoke('settings:get') as Promise<{
        settings: Settings;
        hasPassword: boolean;
        hasTrackerSecret: boolean;
      }>,
    save: (settings: Settings, password?: string, trackerSecret?: string) =>
      ipcRenderer.invoke('settings:save', settings, password, trackerSecret) as Promise<void>,
  },
  log: {
    list: () => ipcRenderer.invoke('log:list') as Promise<LogEntry[]>,
  },
  checkpoint: {
    get: () => ipcRenderer.invoke('checkpoint:get') as Promise<Checkpoint | null>,
    discard: () => ipcRenderer.invoke('checkpoint:discard') as Promise<void>,
  },
  tracker: {
    queryOpens: (endpoint: string, tokens: string[]) =>
      ipcRenderer.invoke('tracker:query-opens', endpoint, tokens) as Promise<{
        ok: boolean;
        error?: string;
        tokens: Record<string, OpenStatus>;
      }>,
    ping: (endpoint: string, secret?: string) =>
      ipcRenderer.invoke('tracker:ping', endpoint, secret) as Promise<{
        ok: boolean;
        error?: string;
      }>,
  },
  onSendProgress: (cb: (p: SendProgress) => void) => {
    const listener = (_: unknown, p: SendProgress) => cb(p);
    ipcRenderer.on('email:send-progress', listener);
    return () => ipcRenderer.removeListener('email:send-progress', listener);
  },
  checkQpdf: () =>
    ipcRenderer.invoke('system:check-qpdf') as Promise<{ ok: boolean; message?: string }>,
  openFile: () =>
    ipcRenderer.invoke('file:open-xlsx') as Promise<string | null>,
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
