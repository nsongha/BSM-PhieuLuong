import { useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar, AlertCircle } from 'lucide-react';

type Period = { key: string; month: string; year: string; count: number };

type Props = {
  periods: Period[];
  missingCount: number;
  onBack: () => void;
  onPick: (key: string) => void;
};

export function PeriodPickerScreen({ periods, missingCount, onBack, onPick }: Props) {
  const [selected, setSelected] = useState<string>(periods[0]?.key ?? '');

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={onBack} className="btn-ghost">
        <ArrowLeft size={18} />
        Chọn file khác
      </button>

      <div className="card p-8 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Chọn kỳ lương</h1>
        <p className="text-base text-slate-600">
          File có <b>{periods.length}</b> kỳ lương. Chọn kỳ bạn muốn gửi phiếu cho đợt này.
        </p>
      </div>

      {missingCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <AlertCircle size={20} className="text-amber-700 mt-0.5" />
          <div className="text-sm text-amber-900">
            {missingCount} dòng có ô "Kỳ lương" rỗng hoặc sai format — sẽ bị bỏ qua.
          </div>
        </div>
      )}

      <div className="space-y-3">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelected(p.key)}
            className={`card p-5 w-full text-left transition-all flex items-center gap-4 ${
              selected === p.key
                ? 'border-brand-500 ring-2 ring-brand-500/30 bg-brand-50/30'
                : 'hover:border-brand-300 hover:shadow-sm'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                selected === p.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Calendar size={22} />
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold text-slate-900">
                Tháng {p.month}/{p.year}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">
                {p.count} nhân viên
              </div>
            </div>
            {selected === p.key && (
              <div className="text-brand-600 font-medium text-sm">Đang chọn</div>
            )}
          </button>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-end gap-3 bg-[#F8FAFC]/80 backdrop-blur py-3">
        <button
          disabled={!selected}
          onClick={() => onPick(selected)}
          className="btn-primary"
        >
          Tiếp tục
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
