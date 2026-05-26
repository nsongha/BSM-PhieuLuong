import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  TestTube2,
  KeyRound,
  ShieldCheck,
  Pencil,
  Eye,
} from 'lucide-react';
import type { Settings } from '../lib/api';
import { api } from '../lib/api';

type Props = {
  initial: Settings | null;
  hasPassword: boolean;
  hasTrackerSecret: boolean;
  onBack?: () => void;
  onSaved: (s: Settings, passwordChanged: boolean) => void;
};

export function SetupScreen({ initial, hasPassword, hasTrackerSecret, onBack, onSaved }: Props) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? '');
  const [emailUser, setEmailUser] = useState(initial?.emailUser ?? '');
  const [emailTest, setEmailTest] = useState(initial?.emailTest ?? '');
  const [password, setPassword] = useState('');
  const [editingPassword, setEditingPassword] = useState(!hasPassword);
  const [logoDataUrl, setLogoDataUrl] = useState(initial?.logoDataUrl);
  const [trackerEndpoint, setTrackerEndpoint] = useState(initial?.trackerEndpoint ?? '');
  const [trackerSecret, setTrackerSecret] = useState('');
  const [editingTrackerSecret, setEditingTrackerSecret] = useState(!hasTrackerSecret);
  const [trackingEnabled, setTrackingEnabled] = useState(initial?.trackingEnabled ?? false);
  const [trackerTesting, setTrackerTesting] = useState(false);
  const [trackerResult, setTrackerResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const usingSavedPassword = hasPassword && !editingPassword;
  const canTest = !!emailUser && (usingSavedPassword || !!password);
  const canSave = !!companyName && !!emailTest;

  const doTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api().email.testConnection(emailUser, usingSavedPassword ? '' : password);
      if (r.ok) setTestResult({ ok: true, msg: 'Kết nối Gmail thành công' });
      else setTestResult({ ok: false, msg: r.error ?? 'Lỗi không xác định' });
    } finally {
      setTesting(false);
    }
  };

  const doSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const s: Settings = {
        companyName,
        logoDataUrl,
        emailUser,
        emailTest,
        trackerEndpoint: trackerEndpoint.trim() || undefined,
        trackingEnabled,
        isConfigured: true,
      };
      const passwordChanged = editingPassword && !!password;
      const trackerSecretChanged = editingTrackerSecret;
      await api().settings.save(
        s,
        passwordChanged ? password : undefined,
        trackerSecretChanged ? trackerSecret.trim() : undefined
      );
      onSaved(s, passwordChanged);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {onBack && (
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={18} />
          Về Home
        </button>
      )}

      <div className="card p-8 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {onBack ? 'Cài đặt' : 'Cài đặt ban đầu'}
        </h1>
        <p className="text-base text-slate-600">
          Cấu hình Gmail để gửi phiếu lương. Bạn có thể dùng app ở chế độ Giả lập mà không cần cấu hình.
        </p>
      </div>

      <Section icon={<Building2 size={22} />} title="1. Thông tin công ty">
        <Field label="Tên công ty">
          <input
            className="input"
            placeholder="Ví dụ: Công ty TNHH ABC"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </Field>
        <Field label="Logo (tuỳ chọn)">
          <input
            type="file"
            accept="image/*"
            onChange={handleLogo}
            className="block text-base text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-brand-700 file:font-medium hover:file:bg-brand-100"
          />
          {logoDataUrl && (
            <img src={logoDataUrl} alt="logo" className="mt-3 max-h-20 rounded-lg border border-slate-200" />
          )}
        </Field>
      </Section>

      <Section icon={<Mail size={22} />} title="2. Tài khoản Gmail">
        <Field label="Địa chỉ Gmail">
          <input
            className="input"
            placeholder="nguoigui@gmail.com"
            value={emailUser}
            onChange={(e) => setEmailUser(e.target.value)}
          />
        </Field>
        <Field label="App Password (16 ký tự)" icon={<KeyRound size={16} />}>
          {usingSavedPassword ? (
            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-green-800">
                <ShieldCheck size={20} />
                <span className="font-medium">Đã lưu App Password</span>
                <span className="text-sm text-green-700">(được mã hoá trong Keychain)</span>
              </span>
              <button
                onClick={() => {
                  setEditingPassword(true);
                  setPassword('');
                  setTestResult(null);
                }}
                className="btn-ghost text-green-700 hover:bg-green-100"
              >
                <Pencil size={16} />
                Thay đổi
              </button>
            </div>
          ) : (
            <>
              <input
                className="input"
                placeholder="xxxx xxxx xxxx xxxx"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={hasPassword}
              />
              {hasPassword && (
                <button
                  onClick={() => {
                    setEditingPassword(false);
                    setPassword('');
                    setTestResult(null);
                  }}
                  className="btn-ghost text-sm"
                >
                  <ArrowLeft size={14} /> Dùng password đã lưu
                </button>
              )}
            </>
          )}
          {!usingSavedPassword && (
            <details className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl">
              <summary className="cursor-pointer font-medium text-slate-800">
                Làm sao có App Password?
              </summary>
              <ol className="list-decimal ml-5 mt-3 space-y-1.5 text-slate-700">
                <li>Gmail phải BẬT Xác thực 2 bước</li>
                <li>Truy cập <code className="bg-white px-1 py-0.5 rounded">myaccount.google.com/apppasswords</code></li>
                <li>Nhập tên bất kỳ và bấm <b>Create</b></li>
                <li>Copy 16 ký tự, paste vào ô trên</li>
              </ol>
            </details>
          )}
        </Field>
        <button
          disabled={!canTest || testing}
          onClick={doTest}
          className="btn-secondary"
        >
          <TestTube2 size={18} />
          {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        {testResult && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 text-base ${
              testResult.ok
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {testResult.ok ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{testResult.msg}</span>
          </div>
        )}
      </Section>

      <Section icon={<TestTube2 size={22} />} title="3. Email test (dry-run)">
        <Field label="Email test">
          <input
            className="input"
            placeholder="Thường là chính email của bạn"
            value={emailTest}
            onChange={(e) => setEmailTest(e.target.value)}
          />
          <p className="text-sm text-slate-500">
            Dùng cho "Gửi thử" và "Chế độ test". Tất cả email test sẽ đổ vào đây.
          </p>
        </Field>
      </Section>

      <Section icon={<Eye size={22} />} title="4. Tracking mở email (tuỳ chọn)">
        <p className="text-sm text-slate-600 -mt-1">
          Chèn pixel 1×1 vào email để biết đã có ai mở. Cần 1 endpoint Vercel tự deploy (xem{' '}
          <code className="bg-slate-100 px-1 rounded">phieu-luong-tracker/README.md</code>).
          Pixel có thể bị chặn bởi một số email client — xem là gợi ý, không phải con số chính xác.
        </p>
        <Field label="URL endpoint">
          <input
            className="input"
            placeholder="https://phieu-luong-tracker.vercel.app"
            value={trackerEndpoint}
            onChange={(e) => setTrackerEndpoint(e.target.value)}
          />
        </Field>
        <Field label="Tracker secret (khuyến nghị)" icon={<KeyRound size={16} />}>
          {hasTrackerSecret && !editingTrackerSecret ? (
            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <span className="flex items-center gap-2 text-green-800">
                <ShieldCheck size={20} />
                <span className="font-medium">Đã lưu tracker secret</span>
              </span>
              <button
                onClick={() => {
                  setEditingTrackerSecret(true);
                  setTrackerSecret('');
                  setTrackerResult(null);
                }}
                className="btn-ghost text-green-700 hover:bg-green-100"
              >
                <Pencil size={16} />
                Thay đổi
              </button>
            </div>
          ) : (
            <input
              className="input"
              placeholder="Để trống nếu tracker chưa set TRACKER_SECRET"
              type="password"
              value={trackerSecret}
              onChange={(e) => setTrackerSecret(e.target.value)}
            />
          )}
          <p className="text-sm text-slate-500">
            Phải trùng với env <code className="bg-slate-100 px-1 rounded">TRACKER_SECRET</code> trên Vercel.
            Nếu endpoint chưa bật auth, bỏ trống cũng được — nhưng khuyến khích bật để tránh ai cũng query được.
          </p>
        </Field>
        <button
          disabled={!trackerEndpoint || trackerTesting}
          onClick={async () => {
            setTrackerTesting(true);
            setTrackerResult(null);
            const secretToUse = editingTrackerSecret ? trackerSecret : undefined;
            const r = await api().tracker.ping(trackerEndpoint, secretToUse);
            setTrackerResult({
              ok: r.ok,
              msg: r.ok ? 'Kết nối tracker OK' : r.error ?? 'Không phản hồi',
            });
            setTrackerTesting(false);
          }}
          className="btn-secondary"
        >
          <TestTube2 size={18} />
          {trackerTesting ? 'Đang kiểm tra…' : 'Kiểm tra tracker'}
        </button>
        {trackerResult && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 text-base ${
              trackerResult.ok
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {trackerResult.ok ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{trackerResult.msg}</span>
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50">
          <input
            type="checkbox"
            checked={trackingEnabled}
            disabled={!trackerEndpoint}
            onChange={(e) => setTrackingEnabled(e.target.checked)}
            className="w-5 h-5 accent-brand-600"
          />
          <span className="text-base">
            Bật chèn pixel tracking khi gửi email
            {!trackerEndpoint && (
              <span className="block text-sm text-slate-500">(cần điền URL endpoint trước)</span>
            )}
          </span>
        </label>
      </Section>

      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-end gap-3 bg-white border-t border-slate-200 px-6 py-3">
        <button
          disabled={!canSave || saving}
          onClick={doSave}
          className="btn-primary"
        >
          {saving ? 'Đang lưu…' : onBack ? 'Lưu thay đổi' : 'Lưu và tiếp tục'}
        </button>
      </div>
      {saveError && (
        <div className="flex items-start gap-3 rounded-xl p-4 bg-red-50 text-red-800 border border-red-200">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center gap-3 text-xl font-semibold text-slate-900">
        <span className="text-brand-600">{icon}</span>
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-base font-medium text-slate-700">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}
