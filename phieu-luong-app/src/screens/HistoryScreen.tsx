import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Drama,
  Calendar,
  Search,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  TestTube2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const HISTORY_PAGE_SIZE = 10;
import type { LogEntry, LogRecipient, OpenStatus, Settings } from '../lib/api';
import { api } from '../lib/api';

type Props = {
  logs: LogEntry[];
  settings: Settings;
  onBack: () => void;
};

type View = { kind: 'list' } | { kind: 'detail'; log: LogEntry };

export function HistoryScreen({ logs, settings, onBack }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [page, setPage] = useState(0);

  // Clamp page if logs list shrinks (e.g., navigation back-and-forth).
  const totalPages = Math.max(1, Math.ceil(logs.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * HISTORY_PAGE_SIZE;
  const end = Math.min(start + HISTORY_PAGE_SIZE, logs.length);
  const pagedLogs = logs.slice(start, end);

  if (view.kind === 'detail') {
    return (
      <DetailView
        log={view.log}
        settings={settings}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={onBack} className="btn-ghost">
        <ArrowLeft size={18} />
        Về Home
      </button>

      <div className="card p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Lịch sử gửi</h1>
        <p className="text-base text-slate-600">
          Ghi lại toàn bộ danh sách người nhận của mỗi đợt. KHÔNG lưu số tiền lương hay nội dung PDF.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-slate-500 text-base">Chưa có lần gửi nào.</div>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-28">Kỳ</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-40">Thời gian</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Chế độ</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 w-16">Tổng</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-green-600 w-20">Thành công</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-red-600 w-20">Thất bại</th>
                  <th className="px-4 py-2.5 w-10" aria-label="Hành động" />
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((l) => (
                  <HistoryRow
                    key={l.id}
                    log={l}
                    onOpen={() => setView({ kind: 'detail', log: l })}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              rangeStart={start + 1}
              rangeEnd={end}
              total={logs.length}
              onChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-slate-600 px-1">
      <div>
        Hiển thị <b className="text-slate-900">{rangeStart}–{rangeEnd}</b> / {total} đợt gửi
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ width: 32, height: 32 }}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-3 py-1 text-sm text-slate-700 font-medium tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ width: 32, height: 32 }}
          aria-label="Trang sau"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function HistoryRow({ log, onOpen }: { log: LogEntry; onOpen: () => void }) {
  const when = new Date(log.timestamp);
  const whenStr = when.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <tr
      onClick={onOpen}
      className="group/row border-t border-slate-100 hover:bg-brand-50/40 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          {log.month}/{log.year}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums">{whenStr}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {log.dryRun && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 text-[11px] font-medium">
              <TestTube2 size={11} />
              Gửi thử
            </span>
          )}
          {log.simulate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.5 text-[11px] font-medium">
              <Drama size={11} />
              Giả lập
            </span>
          )}
          {log.testMode && !log.simulate && !log.dryRun && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 text-[11px] font-medium">
              <FlaskConical size={11} />
              Test
            </span>
          )}
          {!log.dryRun && !log.simulate && !log.testMode && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 text-[11px] font-medium">
              Gửi thật
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-slate-700 font-medium tabular-nums">{log.total}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
          <CheckCircle2 size={14} />
          {log.succeeded}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {log.failed > 0 ? (
          <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
            <XCircle size={14} />
            {log.failed}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={16} className="text-slate-300 group-hover/row:text-brand-500 transition-colors" aria-hidden />
      </td>
    </tr>
  );
}

function DetailView({
  log,
  settings,
  onBack,
}: {
  log: LogEntry;
  settings: Settings;
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [opens, setOpens] = useState<Record<string, OpenStatus>>({});
  const [loadingOpens, setLoadingOpens] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);

  const recipients = log.recipients ?? [];
  const tokens = useMemo(
    () => recipients.map((r) => r.trackToken).filter((t): t is string => !!t),
    [recipients]
  );
  const hasTracking = tokens.length > 0 && !!settings.trackerEndpoint;

  const fetchOpens = async () => {
    if (!hasTracking || !settings.trackerEndpoint) return;
    setLoadingOpens(true);
    setTrackerError(null);
    try {
      const res = await api().tracker.queryOpens(settings.trackerEndpoint, tokens);
      setOpens(res.tokens);
      if (!res.ok) setTrackerError(res.error ?? 'Lỗi tracker không xác định');
    } finally {
      setLoadingOpens(false);
    }
  };

  useEffect(() => {
    if (hasTracking) fetchOpens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openedCount = Object.values(opens).filter((o) => o.opened).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.hoTen.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.maNV.toLowerCase().includes(q)
      );
    });
  }, [recipients, search, filter]);

  const exportCSV = () => {
    const header = 'Ho ten,Email,Ma NV,Trang thai,Loi\n';
    const rows = recipients
      .map((r) => [r.hoTen, r.email, r.maNV, r.status, r.error ?? ''].map(csv).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phieu-luong-${log.month}-${log.year}-${log.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const when = new Date(log.timestamp);
  const whenStr = when.toLocaleString('vi-VN');

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={onBack} className="btn-ghost">
        <ArrowLeft size={18} />
        Lịch sử
      </button>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Đợt gửi Tháng {log.month}/{log.year}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{whenStr}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {log.dryRun && (
              <span className="chip bg-blue-100 border-blue-300 text-blue-800">
                <TestTube2 size={14} /> Gửi thử
              </span>
            )}
            {log.simulate && (
              <span className="chip bg-purple-100 border-purple-300 text-purple-800">
                <Drama size={14} /> Giả lập
              </span>
            )}
            {log.testMode && !log.simulate && !log.dryRun && (
              <span className="chip bg-amber-100 border-amber-300 text-amber-800">
                <FlaskConical size={14} /> Test
              </span>
            )}
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={16} /> Xuất CSV
            </button>
          </div>
        </div>

        <div className={`grid ${hasTracking ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3`}>
          <StatCard label="Tổng" value={log.total} tone="slate" />
          <StatCard label="Thành công" value={log.succeeded} tone="green" />
          <StatCard label="Thất bại" value={log.failed} tone={log.failed > 0 ? 'red' : 'slate'} />
          {hasTracking && (
            <StatCard
              label="Đã mở"
              value={loadingOpens ? '…' : `${openedCount}/${tokens.length}`}
              tone="blue"
            />
          )}
        </div>

        {hasTracking && (
          <div className="flex items-center justify-between flex-wrap gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
            <div className="text-sm text-blue-900">
              <Eye size={14} className="inline mr-1" />
              Tracking đang bật — open tracking chỉ là gợi ý (nhiều mail client chặn ảnh).
            </div>
            <button
              disabled={loadingOpens}
              onClick={fetchOpens}
              className="btn-ghost text-blue-700 hover:bg-blue-100 text-sm"
            >
              <RefreshCw size={14} className={loadingOpens ? 'animate-spin' : ''} />
              Làm mới
            </button>
          </div>
        )}

        {trackerError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>Không lấy được trạng thái mở — {trackerError}</span>
          </div>
        )}

        {!hasTracking && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700">
            <div className="font-medium mb-1">Không có dữ liệu tracking cho đợt này</div>
            <div className="text-slate-600">
              {log.simulate
                ? 'Đợt này ở chế độ Giả lập — không có email thật nào được gửi, nên không có pixel tracking.'
                : tokens.length === 0
                ? 'Tracking chưa được bật khi gửi đợt này. Vào ⚙️ Cài đặt → mục 4 để bật cho đợt sau.'
                : 'Tracker endpoint chưa được cấu hình trong Settings. Thêm URL để fetch trạng thái mở.'}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              placeholder="Tìm theo tên, email, mã NV…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="flex rounded-xl border border-slate-300 overflow-hidden">
            <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
              Tất cả ({recipients.length})
            </FilterTab>
            <FilterTab active={filter === 'sent'} onClick={() => setFilter('sent')}>
              Đã gửi ({log.succeeded})
            </FilterTab>
            <FilterTab active={filter === 'failed'} onClick={() => setFilter('failed')}>
              Lỗi ({log.failed})
            </FilterTab>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl max-h-[32rem] overflow-y-auto">
          <table className="w-full text-base">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-12">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Họ tên</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-28">Mã NV</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-32">Trạng thái</th>
                {hasTracking && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-36">
                    Đã mở
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <RecipientRow
                  key={`${r.maNV}-${i}`}
                  r={r}
                  idx={i}
                  showTracking={hasTracking}
                  openStatus={r.trackToken ? opens[r.trackToken] : undefined}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={hasTracking ? 6 : 5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Không có kết quả khớp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-slate-500">
          Hiển thị {filtered.length} / {recipients.length} người nhận
        </div>
      </div>
    </div>
  );
}

function RecipientRow({
  r,
  idx,
  showTracking,
  openStatus,
}: {
  r: LogRecipient;
  idx: number;
  showTracking: boolean;
  openStatus?: OpenStatus;
}) {
  return (
    <tr
      className={`border-t border-slate-100 ${
        r.status === 'sent' ? 'bg-green-50/40' : 'bg-red-50/50'
      }`}
    >
      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
      <td className="px-4 py-3 font-medium text-slate-900">{r.hoTen}</td>
      <td className="px-4 py-3 text-slate-600">{r.email}</td>
      <td className="px-4 py-3 text-slate-700">{r.maNV}</td>
      <td className="px-4 py-3">
        {r.status === 'sent' ? (
          <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
            <CheckCircle2 size={18} />
            Đã gửi
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-red-700 font-medium"
            title={r.error}
          >
            <XCircle size={18} />
            Lỗi
          </span>
        )}
      </td>
      {showTracking && (
        <td className="px-4 py-3">
          {!r.trackToken ? (
            <span className="text-xs text-slate-400">—</span>
          ) : openStatus?.opened ? (
            <span
              className="inline-flex items-center gap-1.5 text-blue-700 font-medium"
              title={`Mở ${openStatus.count} lần`}
            >
              <Eye size={16} />
              {relativeTime(openStatus.firstAt)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-slate-400 text-sm">
              <EyeOff size={16} />
              Chưa mở
            </span>
          )}
        </td>
      )}
    </tr>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-r border-slate-300 last:border-r-0 transition-colors ${
        active ? 'bg-brand-50 text-brand-700' : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'green' | 'red' | 'slate' | 'blue';
}) {
  const colors: Record<typeof tone, string> = {
    green: 'border-green-200 bg-green-50 text-green-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <div className="text-sm uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function csv(s: string) {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
