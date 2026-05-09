import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, AlertCircle } from 'lucide-react';
import type { Employee, LuongPath, Mapping } from '../lib/api';
import { api } from '../lib/api';

type Props = {
  headers: string[];
  rows: Record<string, unknown>[];
  initialMapping: Mapping;
  onBack: () => void;
  onComplete: (mapping: Mapping, employees: Employee[]) => void;
};

type SimpleListKind = 'thuNhapBoSung' | 'khauTru';

export function MappingScreen({ headers, rows, initialMapping, onBack, onComplete }: Props) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (k: keyof Mapping, v: string) =>
    setMapping((m) => ({ ...m, [k]: v || undefined }));

  const setLuongChinhThuc = (next: LuongPath | undefined) =>
    setMapping((m) => ({ ...m, luongChinhThuc: next }));

  const addLuongItem = () =>
    setLuongChinhThuc({
      tongCol: mapping.luongChinhThuc?.tongCol ?? '',
      items: [...(mapping.luongChinhThuc?.items ?? []), { nhan: '', col: headers[0] ?? '' }],
    });
  const setLuongItem = (i: number, u: Partial<{ nhan: string; col: string }>) =>
    setLuongChinhThuc({
      tongCol: mapping.luongChinhThuc?.tongCol ?? '',
      items: (mapping.luongChinhThuc?.items ?? []).map((x, idx) => (idx === i ? { ...x, ...u } : x)),
    });
  const delLuongItem = (i: number) =>
    setLuongChinhThuc({
      tongCol: mapping.luongChinhThuc?.tongCol ?? '',
      items: (mapping.luongChinhThuc?.items ?? []).filter((_, idx) => idx !== i),
    });
  const setLuongTongCol = (v: string) =>
    setLuongChinhThuc({
      tongCol: v,
      items: mapping.luongChinhThuc?.items ?? [],
    });

  const addItem = (kind: SimpleListKind) =>
    setMapping((m) => ({
      ...m,
      [kind]: [...m[kind], { nhan: '', col: headers[0] ?? '' }],
    }));
  const setItem = (kind: SimpleListKind, i: number, u: Partial<{ nhan: string; col: string }>) =>
    setMapping((m) => ({
      ...m,
      [kind]: m[kind].map((x, idx) => (idx === i ? { ...x, ...u } : x)),
    }));
  const delItem = (kind: SimpleListKind, i: number) =>
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

  const luongItems = mapping.luongChinhThuc?.items ?? [];

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
          <FieldRow label="Họ và tên" keyId="hoTen" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Email" keyId="email" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Mã nhân viên" keyId="maNV" mapping={mapping} headers={headers} onChange={setField} />
          {!mapping.maNV && (
            <div className="ml-[180px] flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>Mã NV chưa được map — phiếu lương sẽ không hiển thị Mã NV. Số phiếu sẽ dùng STT thay thế.</span>
            </div>
          )}
          <FieldRow label="Thực nhận" keyId="thucNhan" mapping={mapping} headers={headers} onChange={setField} />
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <h2 className="text-xl font-semibold text-slate-900">Trường tuỳ chọn</h2>
        <p className="text-sm text-slate-500">
          Cột <strong>Code</strong> dùng để phân loại NV (ON / Intern / CTV). Nếu để trống, app tự đoán theo cột "Tổng lương" có giá trị.
        </p>
        <div className="space-y-3">
          <FieldRow label="Cột Code (loại NV)" keyId="code" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Chức danh" keyId="viTri" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Phòng ban" keyId="phongBan" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Ngày công thực tế" keyId="ngayCong" mapping={mapping} headers={headers} onChange={setField} />
          <FieldRow label="Ngày công chuẩn" keyId="ngayCongChuan" mapping={mapping} headers={headers} onChange={setField} />
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tổng lương — bước ① &amp; ②</h2>
          <p className="text-sm text-slate-500 mt-1">
            App đọc thẳng các tổng đã tính sẵn trong Excel, không tính lại.
          </p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-[180px_1fr] items-center gap-4">
            <label className="text-base font-medium text-slate-700">Tổng lương (chính thức)</label>
            <select
              value={mapping.luongChinhThuc?.tongCol ?? ''}
              onChange={(e) => setLuongTongCol(e.target.value)}
              className="input"
            >
              <option value="">— Chọn cột —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <FieldRow
            label="Tổng lương theo ngày công"
            keyId="tongLuongNgayCongCol"
            mapping={mapping}
            headers={headers}
            onChange={setField}
          />
        </div>

        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              Các khoản trong Tổng lương <span className="text-sm text-slate-500 font-normal">(chính thức)</span>
            </h3>
            <button onClick={addLuongItem} className="btn-ghost text-brand-600 hover:bg-brand-50">
              <Plus size={18} /> Thêm khoản
            </button>
          </div>
          {luongItems.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có khoản nào.</p>
          )}
          <div className="space-y-3">
            {luongItems.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                headers={headers}
                placeholder="Ví dụ: Lương cơ bản"
                onChange={(u) => setLuongItem(i, u)}
                onDelete={() => delLuongItem(i)}
              />
            ))}
          </div>
        </div>

        {(mapping.luongThuViec || mapping.luongCtv) && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <h3 className="text-base font-semibold text-slate-800">Auto-detect cho loại NV khác</h3>
            {mapping.luongThuViec && (
              <p className="text-sm text-slate-600">
                <strong>Thử việc:</strong> tổng = <code>{mapping.luongThuViec.tongCol}</code>
                {mapping.luongThuViec.items.length > 0 && (
                  <> · {mapping.luongThuViec.items.length} khoản breakdown</>
                )}
              </p>
            )}
            {mapping.luongCtv && (
              <p className="text-sm text-slate-600">
                <strong>CTV / thực tập:</strong> tổng = <code>{mapping.luongCtv.tongCol}</code>
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tổng thu nhập — bước ③</h2>
          <p className="text-sm text-slate-500 mt-1">
            Tổng thu nhập = Tổng lương theo ngày công + các khoản bổ sung (OT, KPI, Bonus…).
          </p>
        </div>
        <FieldRow
          label="Cột Tổng thu nhập"
          keyId="tongThuNhapCol"
          mapping={mapping}
          headers={headers}
          onChange={setField}
        />

        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Các khoản thu nhập bổ sung</h3>
            <button onClick={() => addItem('thuNhapBoSung')} className="btn-ghost text-brand-600 hover:bg-brand-50">
              <Plus size={18} /> Thêm khoản
            </button>
          </div>
          {mapping.thuNhapBoSung.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có khoản nào.</p>
          )}
          <div className="space-y-3">
            {mapping.thuNhapBoSung.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                headers={headers}
                placeholder="Ví dụ: KPI Chuyên cần"
                onChange={(u) => setItem('thuNhapBoSung', i, u)}
                onDelete={() => delItem('thuNhapBoSung', i)}
              />
            ))}
          </div>
        </div>
      </section>

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

function FieldRow({
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
  const value = (mapping[keyId] as string | undefined) ?? '';
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-4">
      <label className="text-base font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(keyId, e.target.value)}
        className="input"
      >
        <option value="">— Chọn cột —</option>
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}

function ItemRow({
  item,
  headers,
  placeholder,
  onChange,
  onDelete,
}: {
  item: { nhan: string; col: string };
  headers: string[];
  placeholder: string;
  onChange: (u: Partial<{ nhan: string; col: string }>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
      <input
        placeholder={placeholder}
        value={item.nhan}
        onChange={(e) => onChange({ nhan: e.target.value })}
        className="input"
      />
      <select value={item.col} onChange={(e) => onChange({ col: e.target.value })} className="input">
        {headers.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="w-11 h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
        aria-label="Xoá"
      >
        <X size={20} />
      </button>
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
          <ItemRow
            key={i}
            item={item}
            headers={headers}
            placeholder={placeholder}
            onChange={(u) => onChange(i, u)}
            onDelete={() => onDelete(i)}
          />
        ))}
      </div>
    </section>
  );
}
