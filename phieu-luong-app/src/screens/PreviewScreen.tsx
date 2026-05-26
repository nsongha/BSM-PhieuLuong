import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FlaskConical,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Mail,
} from 'lucide-react';
import type { Employee, LogEntry, OpenStatus, Settings, SendOptions } from '../lib/api';
import { api } from '../lib/api';
import { useOnline } from '../lib/useOnline';

type Props = {
  employees: Employee[];
  settings: Settings;
  opts: SendOptions;
  onBack: () => void;
  onSendReal: (selected: Employee[]) => void;
};

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

export function PreviewScreen({ employees, settings, opts, onBack, onSendReal }: Props) {
  const valid = useMemo(() => employees.filter((e) => e.errors.length === 0), [employees]);
  const invalid = useMemo(() => employees.filter((e) => e.errors.length > 0), [employees]);

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(valid.map((e) => e.rowIndex))
  );
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.hoTen.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.maNV.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const ROW_PAGE = 500;
  const [visibleCount, setVisibleCount] = useState(ROW_PAGE);
  useEffect(() => {
    setVisibleCount(ROW_PAGE); // reset khi search/filter thay đổi
  }, [search]);
  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const selectedEmployees = useMemo(
    () => valid.filter((e) => selected.has(e.rowIndex)),
    [valid, selected]
  );
  const total = useMemo(
    () => selectedEmployees.reduce((s, e) => s + e.thucNhan, 0),
    [selectedEmployees]
  );

  const [dryRunning, setDryRunning] = useState(false);
  const [dryResult, setDryResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [previewShown, setPreviewShown] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const online = useOnline();
  const needsNetwork = !opts.simulate;
  const offlineBlocked = needsNetwork && !online;

  useEffect(() => {
    if (!dryResult) return;
    const id = setTimeout(() => setDryResult(null), 8000);
    return () => clearTimeout(id);
  }, [dryResult]);

  useEffect(() => {
    if (!previewShown) return;
    const id = setTimeout(() => setPreviewShown(null), 6000);
    return () => clearTimeout(id);
  }, [previewShown]);

  // Cross-reference with history: find previous sends for current month/year
  type PriorSend = {
    loggedAt: string;
    trackToken?: string;
    dryRun: boolean;
    testMode: boolean;
  };
  const [priorByMaNV, setPriorByMaNV] = useState<Record<string, PriorSend>>({});
  const [opensByToken, setOpensByToken] = useState<Record<string, OpenStatus>>({});
  const [trackerError, setTrackerError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const logs = await api().log.list();
      const map: Record<string, PriorSend> = {};
      for (const l of logs as LogEntry[]) {
        if (l.simulate) continue; // skip giả lập — không phải gửi thật
        if (l.month !== opts.month || l.year !== opts.year) continue;
        for (const r of l.recipients ?? []) {
          if (r.status !== 'sent') continue;
          // Keep most recent per maNV (logs arrive newest-first from logStore)
          if (!map[r.maNV]) {
            map[r.maNV] = {
              loggedAt: l.timestamp,
              trackToken: r.trackToken,
              dryRun: !!l.dryRun,
              testMode: l.testMode,
            };
          }
        }
      }
      setPriorByMaNV(map);

      // Fetch open status for tokens
      const tokens = Object.values(map).map((p) => p.trackToken).filter((t): t is string => !!t);
      if (tokens.length > 0 && settings.trackerEndpoint) {
        const res = await api().tracker.queryOpens(settings.trackerEndpoint, tokens);
        setOpensByToken(res.tokens);
        setTrackerError(res.ok ? null : res.error ?? 'Lỗi tracker không xác định');
      }
    })().catch((e) => console.error('[priorStatus] error:', e));
  }, [opts.month, opts.year, settings.trackerEndpoint]);

  // Nhân viên đang chọn mà đã được gửi THẬT (không phải dry-run/test) cho cùng kỳ
  const selectedDuplicates = useMemo(
    () =>
      selectedEmployees.filter((e) => {
        const p = priorByMaNV[e.maNV];
        return p && !p.dryRun && !p.testMode;
      }),
    [selectedEmployees, priorByMaNV]
  );

  const allSelectedInFiltered =
    filtered.length > 0 &&
    filtered.filter((e) => e.errors.length === 0).every((e) => selected.has(e.rowIndex));

  const toggleAllFiltered = () => {
    const validFiltered = filtered.filter((e) => e.errors.length === 0);
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedInFiltered) {
        validFiltered.forEach((e) => next.delete(e.rowIndex));
      } else {
        validFiltered.forEach((e) => next.add(e.rowIndex));
      }
      return next;
    });
  };

  const toggleOne = (rowIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const doDryRun = async () => {
    if (selectedEmployees.length === 0) return;
    setDryRunning(true);
    setDryResult(null);
    try {
      const r = await api().email.dryRun(selectedEmployees, settings, opts);
      if (r.ok) {
        const n = r.sent ?? Math.min(3, selectedEmployees.length);
        setDryResult({
          ok: true,
          msg: `Đã gửi ${n} phiếu mẫu đến ${settings.emailTest}. Mở mail để check layout + mật khẩu OTP. Đợt gửi thử được lưu trong Lịch sử để theo dõi tracking.`,
        });
      } else {
        setDryResult({ ok: false, msg: r.error ?? 'Lỗi không xác định' });
      }
    } catch (e) {
      setDryResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setDryRunning(false);
    }
  };

  const doPreviewPdf = async (emp: Employee) => {
    setPreviewingId(emp.rowIndex);
    setPreviewShown(null);
    try {
      await api().pdf.preview(emp, settings, opts);
      setPreviewShown(emp.hoTen);
    } catch (e) {
      alert('Lỗi tạo PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      <button onClick={onBack} className="btn-ghost">
        <ArrowLeft size={18} />
        Chọn file khác
      </button>

      <div className="card p-6 space-y-5">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Xem trước bảng lương</h1>
          <div className="text-base text-slate-500">
            Tháng {opts.month}/{opts.year}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hợp lệ" value={valid.length} tone="green" />
          <StatCard label="Có lỗi" value={invalid.length} tone={invalid.length > 0 ? 'red' : 'slate'} />
          <StatCard label="Đang chọn" value={selectedEmployees.length} tone="blue" />
          <StatCard label="Tổng tiền" value={formatCurrency(total)} tone="blue" />
        </div>

        {trackerError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>Trạng thái "đã mở" có thể không chính xác — {trackerError}</span>
          </div>
        )}

        {!opts.simulate && !opts.testMode && selectedDuplicates.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <div className="font-semibold mb-1">
                {selectedDuplicates.length} nhân viên đã nhận phiếu kỳ {opts.month}/{opts.year} rồi
              </div>
              <div>
                Bấm "Gửi" bây giờ sẽ gửi <b>thêm một lần nữa</b>. Nếu không muốn, hãy bỏ tick cột "Kỳ {opts.month}/{opts.year}" trong bảng trên.
              </div>
            </div>
          </div>
        )}

        {invalid.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-red-800">
              <AlertTriangle size={20} />
              {invalid.length} dòng có lỗi — sẽ KHÔNG được gửi
            </div>
            <ul className="text-base text-red-700 space-y-1 max-h-40 overflow-y-auto pl-7">
              {invalid.map((e) => (
                <li key={e.rowIndex} className="list-disc">
                  Dòng {e.rowIndex + 2} ({e.hoTen || '(trống)'}): {e.errors.join('; ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="search"
              placeholder="Tìm theo tên, email, mã NV…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <span className="text-sm text-slate-500">
              Hiển thị {filtered.length} / {employees.length}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl max-h-[30rem] overflow-y-auto">
            <table className="w-full text-base">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-brand-600 cursor-pointer"
                      checked={allSelectedInFiltered}
                      onChange={toggleAllFiltered}
                      aria-label="Chọn tất cả"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600 w-12">#</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600">Họ tên</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600">Email</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600">Mã NV</th>
                  <th className="px-3 py-3 text-right text-sm font-semibold text-slate-600">Thực nhận</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600 w-40">
                    Kỳ {opts.month}/{opts.year}
                  </th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((e) => {
                  const isInvalid = e.errors.length > 0;
                  const isSelected = selected.has(e.rowIndex);
                  const prior = priorByMaNV[e.maNV];
                  const openInfo = prior?.trackToken ? opensByToken[prior.trackToken] : undefined;
                  return (
                    <tr
                      key={e.rowIndex}
                      className={`border-t border-slate-100 ${
                        isInvalid
                          ? 'bg-red-50'
                          : isSelected
                          ? 'bg-blue-50/30 hover:bg-blue-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          disabled={isInvalid}
                          checked={isSelected}
                          onChange={() => toggleOne(e.rowIndex)}
                          className="w-5 h-5 accent-brand-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Chọn ${e.hoTen}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-slate-500">{e.rowIndex + 1}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{e.hoTen}</td>
                      <td className="px-3 py-3 text-slate-600">{e.email}</td>
                      <td className="px-3 py-3 text-slate-700">{e.maNV}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {formatCurrency(e.thucNhan)}
                      </td>
                      <td className="px-3 py-3">
                        <PriorStatus prior={prior} openInfo={openInfo} />
                      </td>
                      <td className="px-3 py-3">
                        {!isInvalid && (
                          <button
                            disabled={previewingId === e.rowIndex}
                            onClick={() => doPreviewPdf(e)}
                            className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm disabled:opacity-50"
                          >
                            <Eye size={16} />
                            {previewingId === e.rowIndex ? 'Đang tạo…' : 'Xem PDF'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length > visibleCount && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center bg-slate-50">
                      <button
                        onClick={() => setVisibleCount((c) => c + ROW_PAGE)}
                        className="btn-secondary"
                      >
                        Hiển thị thêm {Math.min(ROW_PAGE, filtered.length - visibleCount)} dòng
                        <span className="text-sm text-slate-500 ml-2">
                          (còn {filtered.length - visibleCount})
                        </span>
                      </button>
                    </td>
                  </tr>
                )}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                      Không tìm thấy nhân viên nào khớp "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Toast>
        {previewShown && (
          <ToastItem tone="blue" icon={<FileText size={20} />} onDismiss={() => setPreviewShown(null)}>
            PDF của <b>{previewShown}</b> đã mở trong Preview (không password — khi gửi thật sẽ được encrypt bằng mật khẩu OTP).
          </ToastItem>
        )}
        {dryResult && (
          <ToastItem
            tone={dryResult.ok ? 'green' : 'red'}
            icon={dryResult.ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            onDismiss={() => setDryResult(null)}
          >
            {dryResult.msg}
          </ToastItem>
        )}
      </Toast>

      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-between items-center gap-3 bg-white border-t border-slate-200 px-6 py-3">
        <button
          disabled={dryRunning || selectedEmployees.length === 0 || opts.simulate || offlineBlocked}
          onClick={doDryRun}
          className="btn-secondary"
          title={
            opts.simulate
              ? 'Tắt chế độ Giả lập để gửi thử thật'
              : offlineBlocked
              ? 'Mất kết nối Internet'
              : undefined
          }
        >
          <FlaskConical size={18} />
          {dryRunning ? 'Đang gửi thử…' : 'Gửi thử'}
        </button>
        <button
          disabled={selectedEmployees.length === 0 || offlineBlocked}
          onClick={() => setShowConfirm(true)}
          className="btn-primary"
          title={offlineBlocked ? 'Mất kết nối Internet' : undefined}
        >
          <Send size={20} />
          Gửi {selectedEmployees.length} phiếu
          {selectedEmployees.length !== valid.length && ` / ${valid.length}`}
        </button>
      </div>

      {showConfirm && (
        <ConfirmModal
          count={selectedEmployees.length}
          duplicates={selectedDuplicates.length}
          opts={opts}
          emailTest={settings.emailTest}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            onSendReal(selectedEmployees);
          }}
        />
      )}
    </div>
  );
}

function PriorStatus({
  prior,
  openInfo,
}: {
  prior?: { loggedAt: string; trackToken?: string; dryRun: boolean; testMode: boolean };
  openInfo?: OpenStatus;
}) {
  if (!prior) {
    return <span className="text-sm text-slate-400">— Chưa gửi</span>;
  }
  const rel = relative(new Date(prior.loggedAt));
  const label = prior.dryRun ? 'Thử' : prior.testMode ? 'Test' : 'Gửi';
  return (
    <div className="space-y-0.5 text-sm">
      <div className="inline-flex items-center gap-1.5 text-green-700 font-medium" title={new Date(prior.loggedAt).toLocaleString('vi-VN')}>
        <Mail size={14} />
        {label} {rel}
      </div>
      {prior.trackToken && (
        <div className="block">
          {openInfo?.opened ? (
            <span className="inline-flex items-center gap-1 text-blue-700 text-xs" title={`${openInfo.count} lần mở`}>
              <Eye size={12} /> Đã mở
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
              <EyeOff size={12} /> Chưa mở
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function relative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h trước`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg space-y-2 pointer-events-none">
      {children}
    </div>
  );
}

function ToastItem({
  tone,
  icon,
  children,
  onDismiss,
}: {
  tone: 'blue' | 'green' | 'red';
  icon: React.ReactNode;
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const colors: Record<typeof tone, string> = {
    blue: 'bg-blue-50 border-blue-300 text-blue-900',
    green: 'bg-green-50 border-green-300 text-green-900',
    red: 'bg-red-50 border-red-300 text-red-900',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border-2 p-4 shadow-lg pointer-events-auto animate-[slide-down_200ms_ease-out] ${colors[tone]}`}
    >
      <div className="flex items-start gap-3 flex-1">
        <span className="mt-0.5">{icon}</span>
        <div className="text-base">{children}</div>
      </div>
      <button onClick={onDismiss} className="text-slate-500 hover:text-slate-800">
        <X size={20} />
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'green' | 'red' | 'blue' | 'slate';
}) {
  const colors: Record<typeof tone, string> = {
    green: 'border-green-200 bg-green-50 text-green-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    blue: 'border-brand-200 bg-brand-50 text-brand-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-sm uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function ConfirmModal({
  count,
  duplicates,
  opts,
  emailTest,
  onCancel,
  onConfirm,
}: {
  count: number;
  duplicates: number;
  opts: SendOptions;
  emailTest: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isSim = opts.simulate;
  const isTest = opts.testMode && !isSim;
  const showDupWarning = !isSim && !isTest && duplicates > 0;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-7 max-w-md w-full space-y-5">
        {isSim ? (
          <>
            <h2 className="text-2xl font-bold text-purple-800">Chế độ Giả lập</h2>
            <p className="text-base text-slate-700">
              <b>{count} phiếu</b> tháng {opts.month}/{opts.year} sẽ được mô phỏng gửi —{' '}
              <b>không email thật nào được gửi ra ngoài</b>.
            </p>
          </>
        ) : isTest ? (
          <>
            <h2 className="text-2xl font-bold text-amber-800">Chế độ Test</h2>
            <p className="text-base text-slate-700">
              Toàn bộ <b>{count} phiếu</b> tháng {opts.month}/{opts.year} sẽ gửi đến{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded">{emailTest}</code>,
              KHÔNG gửi đến email nhân viên.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900">Xác nhận gửi</h2>
            <p className="text-base text-slate-700">
              Sắp gửi <b>{count} phiếu lương</b> tháng {opts.month}/{opts.year} đến{' '}
              <b>{count}</b> email nhân viên.
            </p>
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertTriangle size={18} />
              Không thể hoàn tác.
            </div>
          </>
        )}
        {showDupWarning && (
          <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border-2 border-amber-400 p-3 rounded-xl">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <span>
              <b>{duplicates}</b> trong {count} nhân viên đã được gửi kỳ này rồi — gửi tiếp sẽ nhận phiếu thứ 2.
            </span>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">
            Huỷ
          </button>
          <button onClick={onConfirm} className="btn-primary">
            <Send size={18} />
            {isSim ? 'Gửi giả lập' : isTest ? 'Gửi test' : 'Gửi thật'}
          </button>
        </div>
      </div>
    </div>
  );
}
