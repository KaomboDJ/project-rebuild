type ProgressRingProps = {
  value: number;
  label: string;
  detail?: string;
  size?: "sm" | "md" | "lg";
  tone?: "emerald" | "blue" | "amber" | "violet";
};

const SIZE = {
  sm: { box: "h-16 w-16", radius: 25, stroke: 5, text: "text-sm" },
  md: { box: "h-24 w-24", radius: 39, stroke: 6, text: "text-xl" },
  lg: { box: "h-32 w-32", radius: 52, stroke: 7, text: "text-2xl" },
} as const;

const TONE = {
  emerald: "stroke-emerald-400",
  blue: "stroke-blue-400",
  amber: "stroke-amber-400",
  violet: "stroke-violet-400",
} as const;

export function ProgressRing({
  value,
  label,
  detail,
  size = "md",
  tone = "emerald",
}: ProgressRingProps) {
  const config = SIZE[size];
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));
  const circumference = 2 * Math.PI * config.radius;
  const dashOffset = circumference * (1 - safeValue / 100);

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={`relative ${config.box}`}
        role="img"
        aria-label={`${label}: ${safeValue}%${detail ? `, ${detail}` : ""}`}
      >
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={config.radius}
            fill="none"
            strokeWidth={config.stroke}
            className="stroke-white/[0.07]"
          />
          <circle
            cx="60"
            cy="60"
            r={config.radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`${TONE[tone]} transition-[stroke-dashoffset] duration-700 ease-out`}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums text-white ${config.text}`}
        >
          {safeValue}%
        </span>
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-200">{label}</p>
        {detail && <p className="mt-0.5 text-[11px] text-neutral-500">{detail}</p>}
      </div>
    </div>
  );
}
