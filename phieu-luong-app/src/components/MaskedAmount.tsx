import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';

type Phase = 'masked' | 'counting' | 'revealed';

type MaskedAmountProps = {
  value: number;
  format?: (n: number) => string;
  holdMs?: number;
  revealMs?: number;
  ringSize?: number;
  className?: string;
};

const A11Y_LABEL = 'Giữ chuột để hiện số tiền (giữ 5 giây)';

export function MaskedAmount({
  value,
  format = formatCurrency,
  holdMs = 5000,
  revealMs = 1000,
  ringSize = 22,
  className,
}: MaskedAmountProps) {
  const [phase, setPhase] = useState<Phase>('masked');
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(Math.ceil(holdMs / 1000));

  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clearTimers = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = () => {
    clearTimers();
    setPhase('masked');
    setProgress(0);
    setRemaining(Math.ceil(holdMs / 1000));
  };

  const tick = () => {
    const elapsed = performance.now() - startRef.current;
    setProgress(Math.min(1, elapsed / holdMs));
    setRemaining(Math.max(0, Math.ceil((holdMs - elapsed) / 1000)));
    if (elapsed >= holdMs) {
      setPhase('revealed');
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (phase !== 'masked') return;
    clearTimers();
    startRef.current = performance.now();
    setPhase('counting');
    if (reducedMotion) {
      // Step the ring 1s at a time instead of a continuous rAF loop.
      intervalRef.current = setInterval(() => {
        const elapsed = performance.now() - startRef.current;
        setProgress(Math.min(1, elapsed / holdMs));
        setRemaining(Math.max(0, Math.ceil((holdMs - elapsed) / 1000)));
        if (elapsed >= holdMs) {
          clearTimers();
          setPhase('revealed');
        }
      }, 1000);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const interactionProps = {
    tabIndex: 0,
    role: 'button' as const,
    title: A11Y_LABEL,
    'aria-label': A11Y_LABEL,
    onMouseEnter: start,
    onMouseLeave: reset,
    onFocus: start,
    onBlur: reset,
  };

  const text = format(value);
  // Base box is ALWAYS sized to the real number, so masked ⇄ counting ⇄ revealed
  // never reflow — the element can't resize out from under the cursor.
  const baseClass = `relative inline-block tabular-nums whitespace-pre align-middle cursor-help ${className ?? ''}`;
  // Invisible sizer reserves the real number's width while hidden.
  const sizer = (
    <span aria-hidden="true" className="invisible">
      {text}
    </span>
  );

  if (phase === 'counting') {
    const r = (ringSize - 4) / 2;
    const circumference = 2 * Math.PI * r;
    return (
      <span {...interactionProps} className={baseClass}>
        {sizer}
        {/* Floating chip — absolutely positioned so its larger width never reflows the
            cell. Anchored to the right edge; it overflows leftward as a small popover. */}
        <span className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
          <span
            className="relative inline-flex shrink-0 items-center justify-center"
            style={{ width: ringSize, height: ringSize }}
          >
            <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
              <g transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}>
                <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={2} />
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={r}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress)}
                />
              </g>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-brand-700">
              {remaining}
            </span>
          </span>
          <span className="text-sm text-slate-500">Hiển thị trong {remaining}s…</span>
        </span>
      </span>
    );
  }

  if (phase === 'revealed') {
    if (reducedMotion) {
      return (
        <span {...interactionProps} className={baseClass}>
          {text}
        </span>
      );
    }
    const n = text.length;
    const charDur = 220;
    const stagger = (revealMs - charDur) / Math.max(1, n - 1);
    return (
      <span {...interactionProps} className={baseClass}>
        {Array.from(text).map((char, i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              animation: 'reveal-char 220ms ease-out both',
              animationDelay: `${(n - 1 - i) * stagger}ms`,
            }}
          >
            {char}
          </span>
        ))}
      </span>
    );
  }

  // masked — **** overlaid on the invisible real-number sizer (right-aligned)
  return (
    <span {...interactionProps} className={baseClass}>
      {sizer}
      <span className="absolute inset-0 flex items-center justify-end">****</span>
    </span>
  );
}
