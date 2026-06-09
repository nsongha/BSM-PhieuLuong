import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  FlaskConical,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import type { Employee, OpenStatus, Settings, SendOptions } from '../lib/api';
import { api } from '../lib/api';
import { useOnline } from '../lib/useOnline';
import { Checkbox } from '../components/Checkbox';
import { StatusPill } from '../components/StatusPill';
import { SortHeader } from '../components/SortHeader';

type Props = {
  employees: Employee[];
  settings: Settings;
  opts: SendOptions;
  onBack: () => void;
  onSendReal: (selected: Employee[]) => void;
};

type SortCol = 'name' | 'email' | 'ma' | 'salary' | 'status' | null;
type SortDir = 'asc' | 'desc' | null;

type PriorSend = {
  loggedAt: string;
  trackToken?: string;
  dryRun: boolean;
  testMode: boolean;
};

type Filters = {
  status: 'all' | 'unsent' | 'sent-unread' | 'sent-opened';
  dept: string;
  empType: 'all' | 'full-time' | 'probation';
  hideErrors: boolean;
};

function formatVND(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}

function statusRank(prior?: PriorSend, openInfo?: OpenStatus): number {
  if (!prior) return 1;
  if (prior.trackToken && openInfo?.opened) return 3;
  return 2;
}

export function PreviewScreen({ employees, settings, opts, onBack, onSendReal }: Props) {
  const valid = useMemo(() => employees.filter((e) => e.errors.length === 0), [employees]);
  const invalid = useMemo(() => employees.filter((e) => e.errors.length > 0), [employees]);

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(valid.map((e) => e.rowIndex))
  );
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const ROW_PAGE = 500;
  const [visibleCount, setVisibleCount] = useState(ROW_PAGE);
  const [filters, setFilters] = useState<Filters>({
    status: 'all', dept: 'all', empType: 'all', hideErrors: false,
  });
  const [sort, setSort] = useState<{ col: SortCol; dir: SortDir }>({ col: null, dir: null });

  const filterRef = useRef<HTMLDivElement>(null);

  const [dryRunning, setDryRunning] = useState(false);
  const [dryResult, setDryResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [previewShown, setPreviewShown] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const online = useOnline();
  const needsNetwork = !opts.simulate;
  const offlineBlocked = needsNetwork && !online;

  const [priorByMaNV, setPriorByMaNV] = useState<Record<string, PriorSend>>({});
  const [opensByToken, setOpensByToken] = useState<Record<string, OpenStatus>>({});
  const [trackerError, setTrackerError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const logs = await api().log.list();
      const map: Record<string, PriorSend> = {};
      for (const l of logs) {
        if (l.simulate) continue;
        if (l.month !== opts.month || l.year !== opts.year) continue;
        for (const r of l.recipients ?? []) {
          if (r.status !== 'sent') continue;
          if (!map[r.maNV]) {
            map[r.maNV] = { loggedAt: l.timestamp, trackToken: r.trackToken, dryRun: !!l.dryRun, testMode: l.testMode };
          }
        }
      }
      setPriorByMaNV(map);
      const tokens = Object.values(map).map((p) => p.trackToken).filter((t): t is string => !!t);
      if (tokens.length > 0 && settings.trackerEndpoint) {
        const res = await api().tracker.queryOpens(settings.trackerEndpoint, tokens);
        setOpensByToken(res.tokens);
        setTrackerError(res.ok ? null : res.error ?? 'Lỗi tracker không xác định');
      }
    })().catch(console.error);
  }, [opts.month, opts.year, settings.trackerEndpoint]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [filterOpen]);

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

  useEffect(() => {
    setVisibleCount(ROW_PAGE);
  }, [search, filters]);

  const deptList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => { if (e.phongBan) set.add(e.phongBan); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [employees]);

  const displayRows = useMemo(() => {
    let rows = employees;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((e) =>
        e.hoTen.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.maNV.toLowerCase().includes(q)
      );
    }
    if (filters.status !== 'all') {
      rows = rows.filter((e) => {
        const prior = priorByMaNV[e.maNV];
        const openInfo = prior?.trackToken ? opensByToken[prior.trackToken] : undefined;
        if (filters.status === 'unsent') return !prior;
        if (filters.status === 'sent-unread') return !!prior && !(prior.trackToken && openInfo?.opened);
        if (filters.status === 'sent-opened') return !!(prior?.trackToken && openInfo?.opened);
        return true;
      });
    }
    if (filters.dept !== 'all') {
      rows = rows.filter((e) => e.phongBan === filters.dept);
    }
    if (filters.empType !== 'all') {
      rows = rows.filter((e) => {
        if (filters.empType === 'full-time') return e.loaiNV === 'chinhThuc';
        if (filters.empType === 'probation') return e.loaiNV === 'thuViec';
        return true;
      });
    }
    if (filters.hideErrors) {
      rows = rows.filter((e) => e.errors.length === 0);
    }
    if (sort.col && sort.dir) {
      rows = [...rows].sort((a, b) => {
        let cmp = 0;
        if (sort.col === 'name') cmp = a.hoTen.localeCompare(b.hoTen, 'vi');
        else if (sort.col === 'email') cmp = a.email.localeCompare(b.email, 'vi');
        else if (sort.col === 'ma') cmp = a.maNV.localeCompare(b.maNV, 'vi');
        else if (sort.col === 'salary') cmp = a.thucNhan - b.thucNhan;
        else if (sort.col === 'status') {
          const ra = statusRank(priorByMaNV[a.maNV], priorByMaNV[a.maNV]?.trackToken ? opensByToken[priorByMaNV[a.maNV].trackToken!] : undefined);
          const rb = statusRank(priorByMaNV[b.maNV], priorByMaNV[b.maNV]?.trackToken ? opensByToken[priorByMaNV[b.maNV].trackToken!] : undefined);
          cmp = ra - rb;
        }
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [employees, search, filters, sort, priorByMaNV, opensByToken]);

  // Prune selection to only rows currently visible (after search/filter).
  // Hidden rows get dropped so footer count and 'Gửi N phiếu' reflect what's on screen.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(displayRows.map((e) => e.rowIndex));
      let changed = false;
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (visible.has(idx)) next.add(idx);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [displayRows]);

  const selectedEmployees = useMemo(
    () => valid.filter((e) => selected.has(e.rowIndex)),
    [valid, selected]
  );
  const totalSelected = useMemo(
    () => selectedEmployees.reduce((s, e) => s + e.thucNhan, 0),
    [selectedEmployees]
  );

  const selectedDuplicates = useMemo(
    () => selectedEmployees.filter((e) => { const p = priorByMaNV[e.maNV]; return p && !p.dryRun && !p.testMode; }),
    [selectedEmployees, priorByMaNV]
  );

  const validInDisplay = displayRows.filter((e) => e.errors.length === 0);
  const allSelected = validInDisplay.length > 0 && validInDisplay.every((e) => selected.has(e.rowIndex));
  const someSelected = validInDisplay.some((e) => selected.has(e.rowIndex));
  const isIndeterminate = someSelected && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) validInDisplay.forEach((e) => next.delete(e.rowIndex));
      else validInDisplay.forEach((e) => next.add(e.rowIndex));
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

  const onSort = (col: string) => {
    setSort((prev) => {
      if (prev.col !== col) return { col: col as SortCol, dir: 'asc' };
      if (prev.dir === 'asc') return { col: col as SortCol, dir: 'desc' };
      return { col: null, dir: null };
    });
  };

  const doDryRun = async () => {
    if (selectedEmployees.length === 0) return;
    setDryRunning(true); setDryResult(null);
    try {
      const r = await api().email.dryRun(selectedEmployees, settings, opts);
      if (r.ok) {
        const n = r.sent ?? Math.min(3, selectedEmployees.length);
        setDryResult({ ok: true, msg: `Đã gửi ${n} phiếu mẫu đến ${settings.emailTest}. Đợt gửi thử được lưu trong Lịch sử.` });
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
    setPreviewingId(emp.rowIndex); setPreviewShown(null);
    try {
      await api().pdf.preview(emp, settings, opts);
      setPreviewShown(emp.hoTen);
    } catch (e) {
      alert('Lỗi tạo PDF: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPreviewingId(null);
    }
  };

  const activeFilterCount = [
    filters.status !== 'all',
    filters.dept !== 'all',
    filters.empType !== 'all',
    filters.hideErrors,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: '#F7F8FA' }}>
      <div
        className="flex items-center justify-between px-8 pt-5 pb-4 flex-shrink-0 bg-white"
        style={{ borderBottom: '1px solid #EEF0F3' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} />
            Chọn file khác
          </button>
          <span className="w-px h-6 bg-slate-200 flex-shrink-0" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900" style={{ letterSpacing: -0.3, lineHeight: 1.2 }}>
              Duyệt thông tin phiếu lương
            </h1>
            <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400" style={{ marginTop: 2 }}>
              Tháng {opts.month} / {opts.year}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-5">
        <div className="grid grid-cols-4 gap-2.5 mb-3.5">
          {[
            { label: 'Hợp lệ', value: valid.length },
            { label: 'Có lỗi', value: invalid.length },
            { label: 'Đang chọn', value: `${selectedEmployees.length} / ${employees.length}` },
            { label: 'Tổng tiền', value: formatVND(totalSelected) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-[10px] px-4 py-3.5"
              style={{ border: '1px solid #E5E7EB' }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-1">{label}</div>
              <div
                className="font-semibold tabular-nums text-slate-900"
                style={{ fontSize: 22, letterSpacing: -0.4, lineHeight: 1.2 }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {trackerError && (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 mb-3">
            <AlertTriangle size={16} className="flex-shrink-0" />
            Trạng thái "đã mở" có thể không chính xác — {trackerError}
          </div>
        )}

        {invalid.length > 0 && (
          <div
            className="flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 mb-3"
            style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}
          >
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
            <div>
              <div className="text-xs font-semibold text-red-800 mb-1">
                {invalid.length} dòng có lỗi — sẽ không được gửi
              </div>
              <ul className="text-xs text-red-700 space-y-0.5 max-h-24 overflow-y-auto">
                {invalid.map((e) => (
                  <li key={e.rowIndex}>Dòng {e.rowIndex + 2} ({e.hoTen || '(trống)'}): {e.errors.join('; ')}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!opts.simulate && !opts.testMode && selectedDuplicates.length > 0 && (
          <div
            className="flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 mb-3"
            style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
          >
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">{selectedDuplicates.length} nhân viên</span> đã nhận phiếu kỳ {opts.month}/{opts.year} rồi — gửi thêm sẽ nhận phiếu lần 2.
            </div>
          </div>
        )}

        <div className="flex gap-2.5 mb-3">
          <div
            className="flex-1 flex items-center gap-2 bg-white rounded-lg px-3"
            style={{ border: '1px solid #E5E7EB', height: 36 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-slate-400">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              placeholder="Tìm theo tên, email, mã NV…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <span className="text-[11px] font-medium text-slate-400 flex-shrink-0 whitespace-nowrap">
              Hiển thị {displayRows.length} / {employees.length}
            </span>
          </div>

          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterOpen((v) => !v); }}
              className="flex items-center gap-1.5 text-xs px-3 rounded-lg transition-colors"
              style={{
                height: 36,
                border: `1px solid ${activeFilterCount > 0 ? '#F97316' : '#E5E7EB'}`,
                background: activeFilterCount > 0 ? '#FFF7ED' : 'white',
                color: activeFilterCount > 0 ? '#F97316' : '#475569',
              }}
            >
              <SlidersHorizontal size={14} />
              Bộ lọc
              {activeFilterCount > 0 && (
                <span className="bg-cta-500 text-white text-[10px] font-semibold px-1.5 py-px rounded-full leading-none">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={12} />
            </button>

            {filterOpen && (
              <FilterPopover
                filters={filters}
                deptList={deptList}
                onChange={setFilters}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mb-3">
            {filters.status !== 'all' && (
              <FilterChip
                label={`Trạng thái: ${{ 'unsent': 'Chưa gửi', 'sent-unread': 'Đã gửi (chưa mở)', 'sent-opened': 'Đã mở' }[filters.status]}`}
                onRemove={() => setFilters((f) => ({ ...f, status: 'all' }))}
              />
            )}
            {filters.dept !== 'all' && (
              <FilterChip label={`Phòng ban: ${filters.dept}`} onRemove={() => setFilters((f) => ({ ...f, dept: 'all' }))} />
            )}
            {filters.empType !== 'all' && (
              <FilterChip label={`Loại HĐ: ${filters.empType === 'full-time' ? 'Chính thức' : 'Thử việc'}`} onRemove={() => setFilters((f) => ({ ...f, empType: 'all' }))} />
            )}
            {filters.hideErrors && (
              <FilterChip label="Ẩn lỗi" onRemove={() => setFilters((f) => ({ ...f, hideErrors: false }))} />
            )}
            <button
              type="button"
              onClick={() => setFilters({ status: 'all', dept: 'all', empType: 'all', hideErrors: false })}
              className="text-[11px] text-cta-500 hover:underline"
            >
              Xoá tất cả
            </button>
          </div>
        )}

        <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
          <div
            className="grid items-center px-4"
            style={{
              gridTemplateColumns: '36px 1.7fr 1.6fr 0.9fr 1fr 1.3fr 60px',
              columnGap: 12,
              background: '#FAFBFC',
              borderBottom: '1px solid #E5E7EB',
              height: 36,
            }}
          >
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                indeterminate={isIndeterminate}
                onChange={toggleAll}
                label="Chọn tất cả"
              />
            </div>
            <SortHeader label="Nhân viên" col="name" activeCol={sort.col} dir={sort.dir} onSort={onSort} />
            <SortHeader label="Email" col="email" activeCol={sort.col} dir={sort.dir} onSort={onSort} />
            <SortHeader label="Mã NV" col="ma" activeCol={sort.col} dir={sort.dir} onSort={onSort} />
            <SortHeader label="Thực nhận" col="salary" activeCol={sort.col} dir={sort.dir} onSort={onSort} align="right" />
            <SortHeader label="Trạng thái" col="status" activeCol={sort.col} dir={sort.dir} onSort={onSort} />
            <div />
          </div>

          <div>
            {displayRows.slice(0, visibleCount).map((e, idx) => {
              const isInvalid = e.errors.length > 0;
              const isSelected = selected.has(e.rowIndex);
              const prior = priorByMaNV[e.maNV];
              const openInfo = prior?.trackToken ? opensByToken[prior.trackToken] : undefined;
              const isLast = idx === Math.min(visibleCount, displayRows.length) - 1;
              return (
                <div
                  key={e.rowIndex}
                  className="grid items-center px-4"
                  style={{
                    gridTemplateColumns: '36px 1.7fr 1.6fr 0.9fr 1fr 1.3fr 60px',
                    columnGap: 12,
                    height: 56,
                    borderBottom: isLast ? 'none' : '1px solid #EEF0F3',
                    background: isInvalid ? '#FEF2F2' : isSelected ? '#FFF7ED' : 'transparent',
                    opacity: isInvalid ? 0.85 : 1,
                    cursor: isInvalid ? 'not-allowed' : 'default',
                  }}
                >
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isSelected && !isInvalid}
                      disabled={isInvalid}
                      onChange={() => !isInvalid && toggleOne(e.rowIndex)}
                      label={e.hoTen}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{e.hoTen}</div>
                    {prior && !prior.dryRun && !prior.testMode && (
                      <div className="text-[10px] text-amber-600">● đã gửi kỳ này</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{e.email}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">{e.maNV}</div>
                  <div className="text-sm font-semibold tabular-nums text-slate-900 text-right">{formatVND(e.thucNhan)}</div>
                  <div>
                    <StatusPill isInvalid={isInvalid} prior={prior} openInfo={openInfo} />
                  </div>
                  <div>
                    {!isInvalid && (
                      <button
                        type="button"
                        disabled={previewingId === e.rowIndex}
                        onClick={() => doPreviewPdf(e)}
                        className="inline-flex items-center gap-1 text-cta-500 hover:underline text-xs disabled:opacity-50"
                      >
                        <Eye size={12} />
                        {previewingId === e.rowIndex ? '…' : 'PDF'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {displayRows.length > visibleCount && (
              <div className="px-4 py-4 text-center" style={{ borderTop: '1px solid #EEF0F3' }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + ROW_PAGE)}
                  className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50 transition-colors"
                >
                  Hiển thị thêm {Math.min(ROW_PAGE, displayRows.length - visibleCount)} dòng
                  <span className="text-slate-400 ml-1">(còn {displayRows.length - visibleCount})</span>
                </button>
              </div>
            )}

            {displayRows.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">
                Không tìm thấy nhân viên nào khớp với bộ lọc hiện tại
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between px-8 py-3.5 bg-white flex-shrink-0"
        style={{ borderTop: '1px solid #EEF0F3' }}
      >
        <div className="text-xs text-slate-400">
          Đã chọn <strong className="text-slate-900 font-semibold">{selectedEmployees.length} nhân viên</strong>
          {' · '}Tổng <strong className="text-slate-900 font-semibold">{formatVND(totalSelected)}</strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={dryRunning || selectedEmployees.length === 0 || opts.simulate || offlineBlocked}
            onClick={doDryRun}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={opts.simulate ? 'Tắt chế độ Giả lập để gửi thử thật' : offlineBlocked ? 'Mất kết nối Internet' : undefined}
          >
            <FlaskConical size={14} />
            {dryRunning ? 'Đang gửi thử…' : 'Gửi thử'}
          </button>
          <button
            type="button"
            disabled={selectedEmployees.length === 0 || offlineBlocked}
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white transition-colors disabled:cursor-not-allowed"
            style={{
              background: selectedEmployees.length === 0 ? '#CBD5E1' : '#F97316',
              boxShadow: selectedEmployees.length === 0 ? 'none' : '0 1px 0 rgba(0,0,0,0.04), 0 4px 12px rgba(249,115,22,0.35)',
            }}
            title={offlineBlocked ? 'Mất kết nối Internet' : undefined}
          >
            <Send size={14} />
            Gửi {selectedEmployees.length} phiếu
          </button>
        </div>
      </div>

      <Toast>
        {previewShown && (
          <ToastItem tone="blue" icon={<FileText size={18} />} onDismiss={() => setPreviewShown(null)}>
            PDF của <b>{previewShown}</b> đã mở trong Preview.
          </ToastItem>
        )}
        {dryResult && (
          <ToastItem
            tone={dryResult.ok ? 'green' : 'red'}
            icon={dryResult.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            onDismiss={() => setDryResult(null)}
          >
            {dryResult.msg}
          </ToastItem>
        )}
      </Toast>

      {showConfirm && (
        <ConfirmModal
          count={selectedEmployees.length}
          duplicates={selectedDuplicates.length}
          opts={opts}
          emailTest={settings.emailTest}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onSendReal(selectedEmployees); }}
        />
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-cta-500 pr-1 pl-2.5"
      style={{ background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 999, height: 24 }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center justify-center rounded-full hover:bg-cta-500/10 transition-colors"
        style={{ width: 16, height: 16 }}
      >
        <X size={10} />
      </button>
    </span>
  );
}

function ChipOpt({ value, current, label, onSelect }: {
  value: string;
  current: string;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-xs px-3 py-1.5 transition-colors"
      style={{
        borderRadius: 999,
        border: `1px solid ${current === value ? '#F97316' : '#E5E7EB'}`,
        background: current === value ? '#FFF7ED' : 'white',
        color: current === value ? '#F97316' : '#475569',
        fontWeight: current === value ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function FilterPopover({
  filters,
  deptList,
  onChange,
  onClose,
}: {
  filters: Filters;
  deptList: string[];
  onChange: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);
  useEffect(() => { setLocal(filters); }, [filters]);

  return (
    <div
      className="absolute top-[calc(100%+6px)] right-0 z-30 bg-white rounded-xl p-4 space-y-3"
      style={{
        width: 360,
        border: '1px solid #E5E7EB',
        boxShadow: '0 12px 32px rgba(15,23,42,0.12), 0 2px 4px rgba(15,23,42,0.06)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Bộ lọc</span>
        <button type="button" onClick={() => setLocal({ status: 'all', dept: 'all', empType: 'all', hideErrors: false })} className="text-xs text-cta-500 hover:underline">
          Reset
        </button>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-2">Trạng thái gửi</div>
        <div className="flex flex-wrap gap-1.5">
          {([['all', 'Tất cả'], ['unsent', 'Chưa gửi'], ['sent-unread', 'Đã gửi'], ['sent-opened', 'Đã mở']] as const).map(([v, l]) => (
            <ChipOpt key={v} value={v} current={local.status} label={l} onSelect={() => setLocal((f) => ({ ...f, status: v }))} />
          ))}
        </div>
      </div>

      {deptList.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-2">Phòng ban</div>
          <div className="flex flex-wrap gap-1.5">
            <ChipOpt value="all" current={local.dept} label="Tất cả" onSelect={() => setLocal((f) => ({ ...f, dept: 'all' }))} />
            {deptList.map((d) => (
              <ChipOpt key={d} value={d} current={local.dept} label={d} onSelect={() => setLocal((f) => ({ ...f, dept: d }))} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.7px] text-slate-400 mb-2">Loại hợp đồng</div>
        <div className="flex flex-wrap gap-1.5">
          {([['all', 'Tất cả'], ['full-time', 'Chính thức'], ['probation', 'Thử việc']] as const).map(([v, l]) => (
            <ChipOpt key={v} value={v} current={local.empType} label={l} onSelect={() => setLocal((f) => ({ ...f, empType: v }))} />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <Checkbox
            checked={local.hideErrors}
            onChange={() => setLocal((f) => ({ ...f, hideErrors: !f.hideErrors }))}
            label="Ẩn dòng có lỗi"
          />
          Ẩn dòng có lỗi
        </label>
        <button
          type="button"
          onClick={() => { onChange(local); onClose(); }}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-cta-500 hover:bg-cta-600 transition-colors"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg space-y-2 pointer-events-none">
      {children}
    </div>
  );
}

function ToastItem({ tone, icon, children, onDismiss }: { tone: 'blue' | 'green' | 'red'; icon: React.ReactNode; children: React.ReactNode; onDismiss: () => void }) {
  const colors = { blue: 'bg-blue-50 border-blue-300 text-blue-900', green: 'bg-green-50 border-green-300 text-green-900', red: 'bg-red-50 border-red-300 text-red-900' };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border-2 p-4 shadow-lg pointer-events-auto ${colors[tone]}`}>
      <div className="flex items-start gap-3 flex-1"><span className="mt-0.5">{icon}</span><div className="text-sm">{children}</div></div>
      <button onClick={onDismiss} className="text-slate-500 hover:text-slate-800"><X size={18} /></button>
    </div>
  );
}

function ConfirmModal({ count, duplicates, opts, emailTest, onCancel, onConfirm }: { count: number; duplicates: number; opts: SendOptions; emailTest: string; onCancel: () => void; onConfirm: () => void }) {
  const isSim = opts.simulate;
  const isTest = opts.testMode && !isSim;
  const showDupWarning = !isSim && !isTest && duplicates > 0;
  const eyebrow = isSim ? 'CHẾ ĐỘ GIẢ LẬP' : isTest ? 'CHẾ ĐỘ TEST' : 'XÁC NHẬN GỬI';
  const title = isSim ? `Giả lập ${count} phiếu` : isTest ? `Gửi test ${count} phiếu` : `Gửi ${count} phiếu lương`;
  const confirmLabel = isSim ? 'Gửi giả lập' : isTest ? 'Gửi test' : 'Gửi thật';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-[440px] space-y-4"
        style={{ boxShadow: '0 20px 60px rgba(15,23,42,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-cta-500">{eyebrow}</div>
        <h2 className="text-lg font-semibold text-slate-900" style={{ letterSpacing: -0.3 }}>{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          {isSim ? (
            <><b>{count} phiếu</b> tháng {opts.month}/{opts.year} sẽ được mô phỏng — <b>không email thật nào được gửi ra ngoài</b>.</>
          ) : isTest ? (
            <>Toàn bộ <b>{count} phiếu</b> sẽ gửi đến <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{emailTest}</code>, KHÔNG gửi đến email nhân viên.</>
          ) : (
            <>Sắp gửi <b>{count} phiếu lương</b> tháng {opts.month}/{opts.year} đến <b>{count}</b> nhân viên.</>
          )}
        </p>
        {!isSim && !isTest && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
            <AlertTriangle size={16} /> Không thể hoàn tác.
          </div>
        )}
        {showDupWarning && (
          <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 p-3 rounded-lg">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <span><b>{duplicates}</b> nhân viên đã được gửi kỳ này — sẽ nhận phiếu lần 2.</span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="text-sm px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors">
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white bg-cta-500 hover:bg-cta-600 transition-colors"
          >
            <Send size={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
