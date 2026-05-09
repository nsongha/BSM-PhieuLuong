export type PhulucChamCong = {
  ngay: string;     // "08/04 T3"
  moTa: string;     // "Đi muộn 45 phút"
  ghiChu?: string;  // "Vào lúc 09:45"
  soTien: number;   // số âm
};

export type PhulucNghiPhep = {
  ngay: string;       // "10/04 T5"
  loai: string;       // "WFH" | "Phép năm" | "Nghỉ bù" ...
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
  luong: Array<{ nhan: string; soTien: number; note?: string }>;
  tongLuong?: number;
  tongLuongNgayCong?: number;
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
  luongChinhThuc?: LuongPath;
  luongThuViec?: LuongPath;
  luongCtv?: LuongPath;
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

type ApiShape = {
  excel: {
    listSheets: (filePath: string) => Promise<string[]>;
    read: (filePath: string, sheetIndex?: number) => Promise<{ headers: string[]; rows: Record<string, unknown>[] }>;
  };
  mapping: {
    validate: (rows: Record<string, unknown>[], mapping: Mapping) => Promise<Employee[]>;
  };
  pdf: {
    preview: (
      employee: Employee,
      settings: Settings,
      opts: SendOptions
    ) => Promise<{ pdfPath: string; password: string | null }>;
  };
  email: {
    testConnection: (user: string, password: string) => Promise<{ ok: boolean; error?: string }>;
    dryRun: (
      employees: Employee[],
      settings: Settings,
      opts: SendOptions
    ) => Promise<{ ok: boolean; error?: string; sent?: number }>;
    sendBatch: (employees: Employee[], settings: Settings, opts: SendOptions) => Promise<void>;
    cancel: () => Promise<void>;
  };
  settings: {
    get: () => Promise<{ settings: Settings; hasPassword: boolean; hasTrackerSecret: boolean }>;
    save: (settings: Settings, password?: string, trackerSecret?: string) => Promise<void>;
  };
  log: {
    list: () => Promise<LogEntry[]>;
  };
  checkpoint: {
    get: () => Promise<Checkpoint | null>;
    discard: () => Promise<void>;
  };
  tracker: {
    queryOpens: (
      endpoint: string,
      tokens: string[]
    ) => Promise<{ ok: boolean; error?: string; tokens: Record<string, OpenStatus> }>;
    ping: (endpoint: string, secret?: string) => Promise<{ ok: boolean; error?: string }>;
  };
  onSendProgress: (cb: (p: SendProgress) => void) => () => void;
  checkQpdf: () => Promise<{ ok: boolean; message?: string }>;
  openFile: () => Promise<string | null>;
};

declare global {
  interface Window {
    api: ApiShape;
  }
}

export const api = (): ApiShape => window.api;
