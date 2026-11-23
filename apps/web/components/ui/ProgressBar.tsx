type ProgressBarProps = {
  current: number;
  total: number;
  label?: string;
  /** Show the label and "x de y" above the bar (default). When false, `label` is only the accessible name. */
  showLabel?: boolean;
};

/** Percentage of `current` over `total`, clamped to 0–100. Returns 0 when `total` is 0 (no NaN width). */
export function getProgressPercentage(current: number, total: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}

export function ProgressBar({ current, total, label, showLabel = true }: ProgressBarProps) {
  const percentage = getProgressPercentage(current, total);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm font-medium text-slate-600">{label}</span>
          )}
          <span className="text-sm text-slate-500">
            {current} de {total}
          </span>
        </div>
      )}
      <div
        className="w-full bg-slate-200 rounded-full h-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
        aria-label={label}
      >
        <div
          className="bg-slate-900 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
