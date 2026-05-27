// phieu-luong-app/src/components/SortHeader.tsx
type SortDir = 'asc' | 'desc' | null;

type SortHeaderProps = {
  label: string;
  col: string;
  activeCol: string | null;
  dir: SortDir;
  onSort: (col: string) => void;
  align?: 'left' | 'right';
};

export function SortHeader({ label, col, activeCol, dir, onSort, align = 'left' }: SortHeaderProps) {
  const isActive = activeCol === col;
  const activeDir = isActive ? dir : null;

  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.7px] focus:outline-none focus-visible:underline ${
        isActive ? 'text-cta-500' : 'text-slate-400 hover:text-slate-600'
      } ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      {label}
      <span className="flex flex-col gap-px" aria-hidden>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M4 0L8 6H0L4 0Z" fill={activeDir === 'asc' ? '#F97316' : '#CBD5E1'} />
        </svg>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M4 6L0 0H8L4 6Z" fill={activeDir === 'desc' ? '#F97316' : '#CBD5E1'} />
        </svg>
      </span>
    </button>
  );
}
