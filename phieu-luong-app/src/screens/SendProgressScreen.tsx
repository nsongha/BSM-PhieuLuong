import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, CheckCircle2, XCircle, Loader2, Drama, Home, RefreshCw } from 'lucide-react';
import type { Employee, Settings, SendOptions, SendProgress } from '../lib/api';
import { api } from '../lib/api';

type Props = {
  employees: Employee[];
  settings: Settings;
  opts: SendOptions;
  onDone: () => void;
  onCancel: () => void;
  onResendFailed: (failedEmployees: Employee[]) => void;
};

type Status = 'pending' | 'sent' | 'failed';
type RowState = {
  emp: Employee;
  status: Status;
  sentTo?: string;
  error?: string;
};

export function SendProgressScreen({ employees, settings, opts, onDone, onCancel, onResendFailed }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    employees.map((e) => ({
      emp: e,
      status: e.errors.length > 0 ? ('failed' as const) : ('pending' as const),
      error: e.errors.length > 0 ? e.errors.join('; ') : undefined,
    }))
  );
  const [cancelling, setCancelling] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    const off = api().onSendProgress((p: SendProgress) => {
      if (p.kind === 'sent') {
        setRows((prev) =>
          prev.map((r) =>
            r.emp.rowIndex === p.rowIndex ? { ...r, status: 'sent', sentTo: p.email } : r
          )
        );
      } else if (p.kind === 'failed') {
        setRows((prev) =>
          prev.map((r) =>
            r.emp.rowIndex === p.rowIndex ? { ...r, status: 'failed', error: p.error } : r
          )
        );
      } else if (p.kind === 'done') {
        setFinished(true);
      }
    });
    return off;
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    api().email.sendBatch(employees, settings, opts).catch((e) => {
      console.error(e);
      setFinished(true);
    });
  }, [employees, settings, opts]);

  const total = rows.length;
  const sent = rows.filter((r) => r.status === 'sent').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const done = sent + failed;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.emp.hoTen.toLowerCase().includes(q) ||
        r.emp.email.toLowerCase().includes(q) ||
        r.emp.maNV.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const failedEmployees = rows.filter((r) => r.status === 'failed').map((r) => r.emp);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {finished ? (
              <CheckCircle2 size={28} className="text-green-600" />
            ) : cancelling ? (
              <Pause size={28} className="text-amber-600" />
            ) : opts.simulate ? (
              <Drama size={28} className="text-purple-600" />
            ) : (
              <Loader2 size={28} className="text-brand-600 animate-spin" />
            )}
            <h1 className="text-2xl font-bold text-slate-900">
              {finished
                ? 'Đã gửi xong'
                : cancelling
                ? 'Đang dừng…'
                : opts.simulate
                ? 'Đang gửi (giả lập)…'
                : 'Đang gửi…'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-base text-slate-500">
              Tháng {opts.month}/{opts.year}
            </div>
            {!finished && (
              <button
                disabled={cancelling}
                onClick={async () => {
                  setCancelling(true);
                  await api().email.cancel();
                  onCancel();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-base text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Pause size={18} />
                Huỷ & quay lại
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-brand-600 h-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-base text-slate-600">
            <span className="font-medium">
              {done} / {total}
            </span>
            <span className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 size={18} /> {sent}
              </span>
              <span className="inline-flex items-center gap-1 text-red-700">
                <XCircle size={18} /> {failed}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="search"
            placeholder="Tìm theo tên, email, mã NV…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <span className="text-sm text-slate-500">
            {filtered.length} / {total}
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl max-h-[30rem] overflow-y-auto">
          <table className="w-full text-base">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-12">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Họ tên</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 w-36">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.emp.rowIndex}
                  className={`border-t border-slate-100 transition-colors ${
                    r.status === 'sent'
                      ? 'bg-green-50'
                      : r.status === 'failed'
                      ? 'bg-red-50'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-slate-500">{r.emp.rowIndex + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.emp.hoTen}</td>
                  <td className="px-4 py-3 text-slate-600">{r.sentTo ?? r.emp.email}</td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <span className="inline-flex items-center gap-2 text-slate-500 text-sm">
                        <Loader2 size={16} className="animate-spin" />
                        Chờ gửi…
                      </span>
                    )}
                    {r.status === 'sent' && (
                      <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                        <CheckCircle2 size={18} />
                        Đã gửi
                      </span>
                    )}
                    {r.status === 'failed' && (
                      <span
                        className="inline-flex items-center gap-1.5 text-red-700 font-medium"
                        title={r.error}
                      >
                        <XCircle size={18} />
                        Lỗi
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Không tìm thấy nhân viên nào khớp "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {finished && (
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 flex-wrap gap-3">
            <div className="text-base text-slate-700">
              {opts.simulate && (
                <span className="text-purple-700 mr-2 font-medium">
                  Giả lập — chưa gửi email thật.
                </span>
              )}
              Thành công: <b>{sent}</b>
              {failed > 0 && <>, thất bại: <b>{failed}</b></>}.
            </div>
            <div className="flex items-center gap-3">
              {failed > 0 && failedEmployees.filter((e) => e.errors.length === 0).length > 0 && (
                <button
                  onClick={() => onResendFailed(failedEmployees.filter((e) => e.errors.length === 0))}
                  className="btn-secondary border-red-300 text-red-700 hover:bg-red-50"
                >
                  <RefreshCw size={18} />
                  Gửi lại {failedEmployees.filter((e) => e.errors.length === 0).length} dòng lỗi
                </button>
              )}
              <button onClick={onDone} className="btn-primary">
                <Home size={20} />
                Về Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
