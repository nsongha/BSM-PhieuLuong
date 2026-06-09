// phieu-luong-app/src/components/StatusPill.tsx
import type { OpenStatus } from '../lib/api';

type PriorSend = {
  loggedAt: string;
  trackToken?: string;
  dryRun: boolean;
  testMode: boolean;
};

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

type StatusPillProps = {
  isInvalid?: boolean;
  prior?: PriorSend;
  openInfo?: OpenStatus;
};

export function StatusPill({ isInvalid, prior, openInfo }: StatusPillProps) {
  if (isInvalid) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600" style={{ borderRadius: 999 }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Lỗi dữ liệu
      </span>
    );
  }
  if (!prior) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500" style={{ borderRadius: 999 }}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
        Chưa gửi
      </span>
    );
  }

  const rel = relative(new Date(prior.loggedAt));

  if (prior.trackToken && openInfo?.opened) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700" style={{ borderRadius: 999 }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
        Đã mở · {rel}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700" style={{ borderRadius: 999 }}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
      Đã gửi · {rel}
    </span>
  );
}
