import { useState } from 'react';
import { Upload, Settings as SettingsIcon, History, Drama, FlaskConical, AlertCircle } from 'lucide-react';
import type { Settings } from '../lib/api';

type Props = {
  settings: Settings;
  testMode: boolean;
  onToggleTestMode: (v: boolean) => void;
  simulate: boolean;
  onToggleSimulate: (v: boolean) => void;
  onStartNew: () => void;
  onFileDropped: (filePath: string) => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

export function HomeScreen({
  settings,
  testMode,
  onToggleTestMode,
  simulate,
  onToggleSimulate,
  onStartNew,
  onFileDropped,
  onOpenHistory,
  onOpenSettings,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    setDropError(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    if (files.length > 1) {
      setDropError('Chỉ kéo thả 1 file, không phải nhiều file.');
      return;
    }
    const file = files[0];
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setDropError(`File phải là .xlsx hoặc .xls — không nhận: "${file.name}"`);
      return;
    }
    const p = (file as File & { path?: string }).path;
    if (!p) {
      setDropError('Không lấy được đường dẫn file. Hãy bấm "Chọn file Excel" để chọn từ Finder.');
      return;
    }
    onFileDropped(p);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Phiếu Lương</h1>
          <p className="text-lg text-slate-500 mt-2">
            {settings.companyName || 'Chưa cấu hình công ty'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeChip
            label="Giả lập"
            icon={<Drama size={18} />}
            active={simulate}
            tone="purple"
            onChange={onToggleSimulate}
          />
          <ModeChip
            label="Test"
            icon={<FlaskConical size={18} />}
            active={testMode}
            disabled={simulate}
            tone="amber"
            onChange={onToggleTestMode}
          />
          <button
            onClick={onOpenSettings}
            className="btn-secondary !min-h-[44px] !px-3 !py-2"
            aria-label="Cài đặt"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`card p-10 text-center space-y-6 transition-all ${
          dragOver ? 'border-brand-500 bg-brand-50/50 scale-[1.01]' : ''
        }`}
      >
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto transition-colors ${
            dragOver ? 'bg-brand-100 text-brand-700' : 'bg-brand-50 text-brand-600'
          }`}
        >
          <Upload size={40} strokeWidth={2} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {dragOver ? 'Thả file vào đây' : 'Kỳ lương mới'}
          </h2>
          <p className="text-base text-slate-600">
            Kéo thả file Excel vào đây, hoặc bấm nút bên dưới.
            <br />
            Kỳ lương sẽ lấy từ cột <b>"Kỳ lương"</b> trong file (MM/YYYY).
          </p>
        </div>
        <button onClick={onStartNew} className="btn-primary text-xl px-10">
          <Upload size={22} />
          Chọn file Excel
        </button>
        {dropError && (
          <div className="flex items-start gap-2 justify-center text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{dropError}</span>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button onClick={onOpenHistory} className="btn-ghost">
          <History size={18} />
          Lịch sử gửi
        </button>
      </div>
    </div>
  );
}

function ModeChip({
  label,
  icon,
  active,
  disabled,
  tone,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled?: boolean;
  tone: 'purple' | 'amber';
  onChange: (v: boolean) => void;
}) {
  const tones: Record<typeof tone, { on: string; off: string }> = {
    purple: {
      on: 'bg-purple-100 border-purple-300 text-purple-800',
      off: 'bg-white border-slate-300 text-slate-600',
    },
    amber: {
      on: 'bg-amber-100 border-amber-300 text-amber-800',
      off: 'bg-white border-slate-300 text-slate-600',
    },
  };
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={`chip ${active ? tones[tone].on : tones[tone].off} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
