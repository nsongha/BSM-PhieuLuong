import { useState } from 'react';
import { api } from '../lib/api';

type Props = {
  onBack: () => void;
  onLoaded: (filePath: string, headers: string[], rows: Record<string, unknown>[]) => void;
};

export function UploadScreen({ onBack, onLoaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const path = await api().openFile();
    if (!path) return;
    setLoading(true);
    try {
      const { headers, rows } = await api().excel.read(path);
      if (rows.length === 0) {
        setError('File không có data nào.');
        return;
      }
      if (headers.length < 4) {
        setError('File Excel cần ít nhất 4 cột (Họ tên, Email, Mã NV, Thực nhận...)');
        return;
      }
      onLoaded(path, headers, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-slate-600 hover:underline">
        ← Về Home
      </button>
      <div className="bg-white rounded-lg shadow p-10 text-center space-y-4">
        <div className="text-5xl">📊</div>
        <h1 className="text-2xl font-semibold text-slate-800">Chọn file Excel bảng lương</h1>
        <p className="text-slate-500">
          File <code>.xlsx</code> có ít nhất các cột: Họ tên, Email, Mã NV, Thực nhận.
          <br />
          Chị có thể thêm bất kỳ cột thu nhập / khấu trừ nào (app sẽ hỏi bước sau).
        </p>
        <button
          disabled={loading}
          onClick={pick}
          className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded disabled:opacity-40"
        >
          {loading ? 'Đang đọc file…' : '📂 Chọn file Excel'}
        </button>
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded text-sm">{error}</div>
        )}
      </div>
    </div>
  );
}
