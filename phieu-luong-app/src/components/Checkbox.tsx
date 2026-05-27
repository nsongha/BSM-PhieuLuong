// phieu-luong-app/src/components/Checkbox.tsx
type CheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  label?: string;
};

export function Checkbox({ checked, indeterminate = false, disabled = false, onChange, label }: CheckboxProps) {
  const ariaChecked = indeterminate ? 'mixed' : checked;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ariaChecked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(); } }}
      className={`inline-flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-[background,border-color] duration-[120ms] ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cta-500/50 ${
        disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked || indeterminate
          ? 'bg-cta-500 border border-cta-500'
          : 'bg-white border-[1.5px] border-slate-300'
      }`}
      style={{ borderRadius: 4 }}
    >
      {indeterminate ? (
        <span className="block w-2 h-0.5 bg-white rounded-sm" />
      ) : checked ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}
