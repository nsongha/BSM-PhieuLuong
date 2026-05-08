import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, AlertCircle } from 'lucide-react';
import type { Employee, Mapping } from '../lib/api';
import { api } from '../lib/api';

type Props = {
  headers: string[];
  rows: Record<string, unknown>[];
  initialMapping: Mapping;
  onBack: () => void;
  onComplete: (mapping: Mapping, employees: Employee[]) => void;
};

export function MappingScreen({ headers, rows, initialMapping, onBack, onComplete }: Props) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setReq = (k: keyof Mapping, v: string) => setMapping((m) => ({ ...m, [k]: v }));

  const addItem = (kind: 'thuNhap' | 'khauTru') =>
    setMapping((m) => ({
      ...m,
      [kind]: [...m[kind], { nhan: '', col: headers[0] ?? '' }],
    }));
  const setItem = (kind: 'thuNhap' | 'khauTru', i: number, u: Partial<{ nhan: string; col: string }>) =>
    setMapping((m) => ({
      ...m,
      [kind]: m[kind].map((x, idx) => (idx === i ? { ...x, ...u } : x)),
    }));
  const delItem = (kind: 'thuNhap' | 'khauTru', i: number) =>
    setMapping((m) => ({ ...m, [kind]: m[kind].filter((_, idx) => idx !== i) }));

  const canValidate = mapping.hoTen && mapping.email && mapping.thucNhan;

  const doValidate = async () => {
    setValidating(true);
    setError(null);
    try {
      const employees = await api().mapping.validate(rows, mapping);
      onComplete(mapping, employees);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={onBack} className="btn-ghost">
        <ArrowLeft size={18} />
        Chọn file khác
      </button>

      <div className="card p-8 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Chọn cột tương ứng</h1>
        <p className="text-base text-slate-600">
          {rows.length} dòng dữ liệu. Hãy cho biết cột nào trong file Excel tương ứng với từng trường.
        </p>
      </div>

      <section className="card p-6 space-y-5">
        <h2 className="text-xl font-semibold text-slate-900">Trường bắt buộc</h2>
        <div className="space-y-3">
          <Req label="Họ và tên" keyId="hoTen" mapping={mapping} headers={headers} onChange={setReq} />
          <Req label="Email" keyId="email" mapping={mapping} headers={headers} onChange={setReq} />
          <Req label="Mã nhân viên" keyId="maNV" mapping={mapping} headers={headers} onChange={setReq} />
          <Req label="Thực nhận" keyId="thucNhan" mapping={mapping} headers={headers} onChange={setReq} />
        </div>
      </section>

      <CategorySection
        title="Các khoản thu nhập"
        items={mapping.thuNhap}
        headers={headers}
        onAdd={() => addItem('thuNhap')}
        onChange={(i, u) => setItem('thuNhap', i, u)}
        onDelete={(i) => delItem('thuNhap', i)}
        placeholder="Ví dụ: Lương cơ bản"
      />

      <CategorySection
        title="Các khoản khấu trừ"
        items={mapping.khauTru}
        headers={headers}
        onAdd={() => addItem('khauTru')}
        onChange={(i, u) => setItem('khauTru', i, u)}
        onDelete={(i) => delItem('khauTru', i)}
        placeholder="Ví dụ: BHXH"
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-red-800">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="sticky bottom-4 flex justify-end gap-3 bg-[#F8FAFC]/80 backdrop-blur py-3">
        <button
          disabled={!canValidate || validating}
          onClick={doValidate}
          className="btn-primary"
        >
          {validating ? 'Đang kiểm tra…' : 'Tiếp tục'}
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}

function Req({
  label,
  keyId,
  mapping,
  headers,
  onChange,
}: {
  label: string;
  keyId: keyof Mapping;
  mapping: Mapping;
  headers: string[];
  onChange: (k: keyof Mapping, v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
      <label className="text-base font-medium text-slate-700">{label}</label>
      <select
        value={mapping[keyId] as string}
        onChange={(e) => onChange(keyId, e.target.value)}
        className="input"
      >
        <option value="">— Chọn cột —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function CategorySection({
  title,
  items,
  headers,
  onAdd,
  onChange,
  onDelete,
  placeholder,
}: {
  title: string;
  items: Array<{ nhan: string; col: string }>;
  headers: string[];
  onAdd: () => void;
  onChange: (i: number, u: Partial<{ nhan: string; col: string }>) => void;
  onDelete: (i: number) => void;
  placeholder: string;
}) {
  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <button onClick={onAdd} className="btn-ghost text-brand-600 hover:bg-brand-50">
          <Plus size={18} />
          Thêm khoản
        </button>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-slate-500">Chưa có khoản nào — bấm "Thêm khoản" nếu cần.</p>
      )}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
            <input
              placeholder={placeholder}
              value={item.nhan}
              onChange={(e) => onChange(i, { nhan: e.target.value })}
              className="input"
            />
            <select
              value={item.col}
              onChange={(e) => onChange(i, { col: e.target.value })}
              className="input"
            >
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <button
              onClick={() => onDelete(i)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
              aria-label="Xoá"
            >
              <X size={20} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
