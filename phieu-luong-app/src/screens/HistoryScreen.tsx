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
} from 'lucide-react';
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
        <div className="space-y-3">
          {logs.map((l) => (
            <button
              key={l.id}
              onClick={() => setView({ kind: 'detail', log: l })}
              className="card p-5 w-full text-left hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <HistoryCard log={l} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ log }: { log: LogEntry }) {
  const when = new Date(log.timestamp);
  const whenStr = when.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Calendar size={18} className="text-slate-400" />
            Tháng {log.month}/{log.year}
          </div>
          <div className="text-sm text-slate-500 mt-1">{whenStr}</div>
        </div>
        <div className="flex items-center gap-2">
          {log.dryRun && (
            <span className="chip bg-blue-100 border-blue-300 text-blue-800">
              <TestTube2 size={14} />
              Gửi thử
            </span>
          )}
          {log.simulate && (
            <span className="chip bg-purple-100 border-purple-300 text-purple-800">
              <Drama size={14} />
              Giả lập
            </span>
          )}
          {log.testMode && !log.simulate && !log.dryRun && (
            <span className="chip bg-amber-100 border-amber-300 text-amber-800">
              <FlaskConical size={14} />
              Test
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 text-base">
        <span className="text-slate-600">
          Tổng: <b>{log.total}</b>
        </span>
        <span className="inline-flex items-center gap-1 text-green-700">
          <CheckCircle2 size={18} />
          <b>{log.succeeded}</b>
        </span>
        {log.failed > 0 && (
          <span className="inline-flex items-center gap-1 text-red-700">
            <XCircle size={18} />
            <b>{log.failed}</b>
          </span>
        )}
        <span className="ml-auto text-sm text-brand-600">Xem chi tiết →</span>
      </div>
    </div>
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
