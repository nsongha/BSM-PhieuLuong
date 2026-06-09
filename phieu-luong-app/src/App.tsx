import { useEffect, useState } from 'react';
import { AlertTriangle, Drama, FlaskConical, WifiOff, RotateCcw, X } from 'lucide-react';
import type { Checkpoint, Employee, Mapping, Settings, SendOptions, LogEntry } from './lib/api';
import { api } from './lib/api';
import { autoDetectMapping, detectPeriodColumn, extractPeriods, parsePeriod } from './lib/autoMapping';
import { useOnline } from './lib/useOnline';
import { SetupScreen } from './screens/SetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MappingScreen } from './screens/MappingScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { SendProgressScreen } from './screens/SendProgressScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { PeriodPickerScreen } from './screens/PeriodPickerScreen';
import { Sidebar, type SavedPeriod } from './components/Sidebar';

const LS_SAVED_PREVIEWS = 'phieu-luong:saved-previews';
const LS_SIDEBAR_COLLAPSED = 'phieu-luong:sidebar-collapsed';
const MAX_SAVED_PREVIEWS = 12;

type SavedPreviewSnapshot = {
  key: string;
  month: string;
  year: string;
  filePath: string;
  employees: Employee[];
  savedAt: string;
};

function loadSavedPreviews(): SavedPreviewSnapshot[] {
  try {
    const raw = localStorage.getItem(LS_SAVED_PREVIEWS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is SavedPreviewSnapshot =>
      p && typeof p.key === 'string' && Array.isArray(p.employees)
    );
  } catch {
    return [];
  }
}

function persistSavedPreviews(list: SavedPreviewSnapshot[]) {
  try {
    localStorage.setItem(LS_SAVED_PREVIEWS, JSON.stringify(list));
  } catch (err) {
    console.warn('[persist] failed to save previews:', err);
  }
}

type Route =
  | { name: 'loading' }
  | { name: 'setup'; fromSettings: boolean }
  | { name: 'home' }
  | { name: 'sheet-pick'; filePath: string; sheets: string[] }
  | {
      name: 'period-pick';
      filePath: string;
      headers: string[];
      rows: Record<string, unknown>[];
      periodCol: string;
      periods: Array<{ key: string; month: string; year: string; count: number }>;
      missingCount: number;
    }
  | { name: 'mapping'; filePath: string; headers: string[]; rows: Record<string, unknown>[]; initialMapping: Mapping }
  | {
      name: 'preview';
      filePath: string;
      headers: string[];
      rows: Record<string, unknown>[];
      mapping: Mapping;
      employees: Employee[];
    }
  | {
      name: 'sending';
      employees: Employee[];
      opts: SendOptions;
    }
  | { name: 'history'; logs: LogEntry[] };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [hasTrackerSecret, setHasTrackerSecret] = useState<boolean>(false);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [simulate, setSimulate] = useState<boolean>(true);
  const [sendOpts, setSendOpts] = useState<SendOptions>(() => {
    const now = new Date();
    return {
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
      testMode: false,
      simulate: true,
    };
  });
  const [qpdfStatus, setQpdfStatus] = useState<{ ok: boolean; message?: string } | null>(null);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const online = useOnline();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_SIDEBAR_COLLAPSED) === '1';
    } catch {
      return false;
    }
  });
  const [savedPreviews, setSavedPreviews] = useState<SavedPreviewSnapshot[]>(() => loadSavedPreviews());

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_SIDEBAR_COLLAPSED, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const sidebarActive: 'home' | 'preview' | 'history' | 'setup' = (() => {
    if (route.name === 'preview' || route.name === 'period-pick' || route.name === 'sheet-pick' || route.name === 'sending' || route.name === 'mapping') return 'preview';
    if (route.name === 'history') return 'history';
    if (route.name === 'setup') return 'setup';
    return 'home';
  })();

  const activePeriodKey: string | null =
    route.name === 'preview' || route.name === 'sending'
      ? `${route.name === 'sending' ? route.opts.year : sendOpts.year}-${route.name === 'sending' ? route.opts.month : sendOpts.month}`
      : null;

  // Newest-imported on top — sort by savedAt desc, not by period key.
  const sidebarSavedPeriods: SavedPeriod[] = savedPreviews
    .slice()
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0))
    .map((p) => ({ key: p.key, month: p.month, year: p.year, savedAt: p.savedAt }));

  const deleteSavedPreview = (key: string) => {
    setSavedPreviews((prev) => {
      const next = prev.filter((p) => p.key !== key);
      persistSavedPreviews(next);
      return next;
    });
    // If user just deleted the period they're currently viewing, drop back to Import.
    if (
      (route.name === 'preview' && `${sendOpts.year}-${sendOpts.month}` === key) ||
      (route.name === 'sending' && `${route.opts.year}-${route.opts.month}` === key)
    ) {
      setRoute({ name: 'home' });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === 'undefined' || !(window as unknown as { api?: unknown }).api) {
          throw new Error(
            'window.api không khả dụng — app chỉ chạy được bên trong Electron. ' +
              'Nếu bạn mở trực tiếp URL Vite (http://localhost:5173), hãy chạy `npm run dev` để mở cửa sổ Electron.'
          );
        }
        const { settings: s, hasPassword: hp, hasTrackerSecret: hts } = await api().settings.get();
        if (cancelled) return;
        setSettings(s);
        setHasPassword(hp);
        setHasTrackerSecret(hts);
        const q = await api().checkQpdf();
        if (cancelled) return;
        setQpdfStatus(q);
        const cp = await api().checkpoint.get();
        if (cancelled) return;
        setCheckpoint(cp);
        setRoute({ name: 'home' });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[bootstrap] failed:', e);
        setBootError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSendOpts = (u: Partial<SendOptions>) =>
    setSendOpts((prev) => ({ ...prev, ...u }));

  // Auto-save current preview snapshot when entering the preview route.
  useEffect(() => {
    if (route.name !== 'preview') return;
    const key = `${sendOpts.year}-${sendOpts.month}`;
    const snapshot: SavedPreviewSnapshot = {
      key,
      month: sendOpts.month,
      year: sendOpts.year,
      filePath: route.filePath,
      employees: route.employees,
      savedAt: new Date().toISOString(),
    };
    setSavedPreviews((prev) => {
      const filtered = prev.filter((p) => p.key !== key);
      const next = [snapshot, ...filtered].slice(0, MAX_SAVED_PREVIEWS);
      persistSavedPreviews(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, sendOpts.year, sendOpts.month]);

  const restoreSavedPreview = (key: string) => {
    const snap = savedPreviews.find((p) => p.key === key);
    if (!snap || !settings) return;
    updateSendOpts({ month: snap.month, year: snap.year });
    setRoute({
      name: 'preview',
      filePath: snap.filePath,
      headers: [],
      rows: [],
      mapping: {} as Mapping,
      employees: snap.employees,
    });
  };

  const handleSidebarNavigate = (target: 'home' | 'preview' | 'history' | 'setup') => {
    if (target === 'home') {
      setRoute({ name: 'home' });
      return;
    }
    if (target === 'preview') {
      // If we're already inside the preview flow (or sending), do nothing.
      if (['preview', 'period-pick', 'sheet-pick', 'sending', 'mapping'].includes(route.name)) return;
      // Otherwise: restore most-recent saved preview, or go to Import if none.
      if (sidebarSavedPeriods.length > 0) {
        restoreSavedPreview(sidebarSavedPeriods[0].key);
      } else {
        setRoute({ name: 'home' });
      }
      return;
    }
    if (target === 'setup') {
      setRoute({ name: 'setup', fromSettings: true });
      return;
    }
    if (target === 'history') {
      api().log.list().then((logs) => setRoute({ name: 'history', logs })).catch(console.error);
    }
  };

  const loadAndRoute = async (filePath: string, sheetIndex?: number) => {
    try {
      // If sheetIndex not specified, check if there are multiple sheets first
      if (sheetIndex === undefined) {
        const sheets = await api().excel.listSheets(filePath);
        if (sheets.length > 1) {
          setRoute({ name: 'sheet-pick', filePath, sheets });
          return;
        }
        sheetIndex = 0;
      }
      const { headers, rows } = await api().excel.read(filePath, sheetIndex);

      const periodCol = detectPeriodColumn(headers);
      if (periodCol) {
        const { periods, missingCount } = extractPeriods(rows, periodCol);
        if (periods.length > 1) {
          // File có nhiều kỳ — user chọn trước khi tiếp tục
          setRoute({ name: 'period-pick', filePath, headers, rows, periodCol, periods, missingCount });
          return;
        }
        if (periods.length === 1) {
          updateSendOpts({ month: periods[0].month, year: periods[0].year });
          await routeAfterLoad(filePath, headers, rows, periodCol, periods[0].key);
          return;
        }
        // periodCol có nhưng data không parse được — fallback tháng hiện tại
      }

      // Không có cột kỳ lương → dùng tháng hiện tại, không filter rows
      const now = new Date();
      updateSendOpts({
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: String(now.getFullYear()),
      });
      await routeAfterLoad(filePath, headers, rows, null, null);
    } catch (e) {
      alert('Lỗi đọc file: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  /**
   * Sau khi biết period (hoặc không): filter rows theo period (nếu có),
   * auto-detect mapping, rồi route vào preview hoặc mapping.
   */
  const routeAfterLoad = async (
    filePath: string,
    headers: string[],
    rows: Record<string, unknown>[],
    periodCol: string | null,
    periodKey: string | null
  ) => {
    let filteredRows = rows;
    if (periodCol && periodKey) {
      filteredRows = rows.filter((r) => {
        const p = parsePeriod(r[periodCol]);
        return p && `${p.year}-${p.month}` === periodKey;
      });
    }
    const { mapping, complete } = autoDetectMapping(headers);
    if (complete) {
      const employees = await api().mapping.validate(filteredRows, mapping);
      setRoute({ name: 'preview', filePath, headers, rows: filteredRows, mapping, employees });
    } else {
      setRoute({ name: 'mapping', filePath, headers, rows: filteredRows, initialMapping: mapping });
    }
  };

  const showSidebar = route.name !== 'loading';

  if (route.name === 'loading') {
    if (bootError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-lg p-5 text-red-900">
            <div className="flex items-center gap-2 font-semibold mb-2">
              <AlertTriangle size={18} />
              Không khởi động được app
            </div>
            <p className="text-sm whitespace-pre-wrap mb-4">{bootError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-2"
            >
              <RotateCcw size={14} /> Thử lại
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Đang tải…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F7F8FA' }}>
      {showSidebar && (
        <Sidebar
          activeRoute={sidebarActive}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          savedPeriods={sidebarSavedPeriods}
          activePeriodKey={activePeriodKey}
          onSelectPeriod={restoreSavedPreview}
          onDeletePeriod={deleteSavedPreview}
          onNavigate={handleSidebarNavigate}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Banners */}
        {!online && (
          <div className="bg-red-100 text-red-900 px-4 py-2 text-sm font-medium border-b border-red-300 flex items-center gap-2 justify-center">
            <WifiOff size={16} />
            Mất kết nối Internet — không thể gửi email hay truy vấn tracker
          </div>
        )}
        {qpdfStatus && !qpdfStatus.ok && !simulate && (
          <div className="bg-red-50 text-red-800 px-4 py-2 text-sm border-b border-red-200 flex items-center gap-2 justify-center">
            <AlertTriangle size={16} />
            {qpdfStatus.message}
          </div>
        )}
        {simulate && (
          <div className="bg-purple-100 text-purple-900 px-4 py-2 text-sm font-medium text-center border-b border-purple-200 flex items-center gap-2 justify-center">
            <Drama size={16} />
            Chế độ Giả lập — không gửi email thật
          </div>
        )}
        {testMode && !simulate && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 text-sm font-medium text-center border-b border-amber-200 flex items-center gap-2 justify-center">
            <FlaskConical size={16} />
            Chế độ Test — mọi email sẽ gửi đến địa chỉ test
          </div>
        )}

        {/* Setup — full bleed, screen manages its own padding + sticky footer */}
        {route.name === 'setup' && (
          <div className="flex-1 overflow-y-auto">
            <SetupScreen
              initial={settings}
              hasPassword={hasPassword}
              hasTrackerSecret={hasTrackerSecret}
              onBack={route.fromSettings ? () => setRoute({ name: 'home' }) : undefined}
              onSaved={async (s, passwordChanged) => {
                setSettings(s);
                if (passwordChanged) setHasPassword(true);
                const { hasTrackerSecret: hts } = await api().settings.get();
                setHasTrackerSecret(hts);
                setRoute({ name: 'home' });
              }}
            />
          </div>
        )}

        {/* Preview — full bleed, screen manages its own header + sticky footer.
            Outer wrapper is overflow-hidden flex column so PreviewScreen's
            internal 3-zone (header/main scroll/footer) fills the viewport. */}
        {route.name === 'preview' && settings && (
          <div className="flex-1 min-h-0 flex flex-col">
            <PreviewScreen
              employees={route.employees}
              settings={settings}
              opts={{ ...sendOpts, testMode, simulate }}
              onBack={() => setRoute({ name: 'home' })}
              onSendReal={(selected) =>
                setRoute({
                  name: 'sending',
                  employees: selected,
                  opts: { ...sendOpts, testMode, simulate },
                })
              }
            />
          </div>
        )}

        {/* Main scrollable content (constrained) */}
        {route.name !== 'setup' && route.name !== 'preview' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto p-6">
              {route.name === 'home' && settings && (
                <>
                  {checkpoint && (
                    <ResumeBanner
                      checkpoint={checkpoint}
                      onResume={() => {
                        setRoute({
                          name: 'sending',
                          employees: checkpoint.employees,
                          opts: checkpoint.opts,
                        });
                        setCheckpoint(null);
                      }}
                      onDiscard={async () => {
                        await api().checkpoint.discard();
                        setCheckpoint(null);
                      }}
                    />
                  )}
                  <HomeScreen
                    settings={settings}
                    testMode={testMode}
                    onToggleTestMode={setTestMode}
                    simulate={simulate}
                    onToggleSimulate={setSimulate}
                    onStartNew={async () => {
                      const filePath = await api().openFile();
                      if (!filePath) return;
                      await loadAndRoute(filePath);
                    }}
                    onFileDropped={async (filePath) => {
                      await loadAndRoute(filePath);
                    }}
                    onOpenHistory={async () => {
                      const logs = await api().log.list();
                      setRoute({ name: 'history', logs });
                    }}
                    onOpenSettings={() => setRoute({ name: 'setup', fromSettings: true })}
                  />
                </>
              )}

              {route.name === 'sheet-pick' && (
                <SheetPickerScreen
                  filePath={route.filePath}
                  sheets={route.sheets}
                  onBack={() => setRoute({ name: 'home' })}
                  onPick={(sheetIndex) => loadAndRoute(route.filePath, sheetIndex)}
                />
              )}

              {route.name === 'period-pick' && (
                <PeriodPickerScreen
                  periods={route.periods}
                  missingCount={route.missingCount}
                  onBack={() => setRoute({ name: 'home' })}
                  onPick={async (key) => {
                    const p = route.periods.find((x) => x.key === key);
                    if (!p) return;
                    updateSendOpts({ month: p.month, year: p.year });
                    await routeAfterLoad(
                      route.filePath,
                      route.headers,
                      route.rows,
                      route.periodCol,
                      key
                    );
                  }}
                />
              )}

              {route.name === 'mapping' && (
                <MappingScreen
                  headers={route.headers}
                  rows={route.rows}
                  initialMapping={route.initialMapping}
                  onBack={() => setRoute({ name: 'home' })}
                  onComplete={(mapping, employees) =>
                    setRoute({
                      name: 'preview',
                      filePath: route.filePath,
                      headers: route.headers,
                      rows: route.rows,
                      mapping,
                      employees,
                    })
                  }
                />
              )}

              {route.name === 'sending' && settings && (
                <SendProgressScreen
                  key={route.employees.map((e) => e.rowIndex).join(',')}
                  employees={route.employees}
                  settings={settings}
                  opts={route.opts}
                  onDone={() => setRoute({ name: 'home' })}
                  onCancel={() => setRoute({ name: 'home' })}
                  onResendFailed={(failed) =>
                    setRoute({ name: 'sending', employees: failed, opts: route.opts })
                  }
                />
              )}

              {route.name === 'history' && settings && (
                <HistoryScreen
                  logs={route.logs}
                  settings={settings}
                  onBack={() => setRoute({ name: 'home' })}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeBanner({
  checkpoint,
  onResume,
  onDiscard,
}: {
  checkpoint: Checkpoint;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const processed = checkpoint.processedRowIndexes.length;
  const total = checkpoint.employees.length;
  const remaining = total - processed;
  const startedAt = new Date(checkpoint.startedAt).toLocaleString('vi-VN');
  return (
    <div className="max-w-3xl mx-auto mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 flex items-start gap-4">
      <AlertTriangle size={28} className="text-amber-700 shrink-0 mt-1" />
      <div className="flex-1 space-y-2">
        <div className="font-semibold text-amber-900">
          Phát hiện batch gửi chưa hoàn thành
        </div>
        <div className="text-sm text-amber-800">
          Bắt đầu lúc {startedAt} — kỳ {checkpoint.opts.month}/{checkpoint.opts.year} — đã xử lý{' '}
          <b>{processed}/{total}</b>, còn lại <b>{remaining}</b> nhân viên.
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={onResume} className="btn-primary !py-2">
            <RotateCcw size={18} />
            Tiếp tục gửi
          </button>
          <button
            onClick={onDiscard}
            className="btn-secondary !py-2 text-slate-700"
            title="Ghi phần đã gửi vào lịch sử rồi xoá checkpoint"
          >
            <X size={18} />
            Bỏ qua & ghi vào lịch sử
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetPickerScreen({
  filePath,
  sheets,
  onBack,
  onPick,
}: {
  filePath: string;
  sheets: string[];
  onBack: () => void;
  onPick: (sheetIndex: number) => void;
}) {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <button onClick={onBack} className="btn-ghost">
        ← Chọn file khác
      </button>
      <div className="card p-8 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Chọn sheet bảng lương</h1>
        <p className="text-sm text-slate-500 break-all">{fileName}</p>
        <p className="text-sm text-slate-600">
          File có {sheets.length} sheet — chọn sheet chứa dữ liệu lương cần gửi.
        </p>
      </div>
      <div className="space-y-2">
        {sheets.map((name, idx) => (
          <button
            key={idx}
            onClick={() => onPick(idx)}
            className="w-full text-left card p-4 hover:border-brand-400 hover:bg-brand-50 transition-colors flex items-center justify-between group"
          >
            <span className="font-medium text-slate-800 group-hover:text-brand-700">{name}</span>
            <span className="text-xs text-slate-400 group-hover:text-brand-500">Sheet {idx + 1} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
