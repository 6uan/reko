const sizes = {
  // xs is for nesting inside an IconButton pill (36px tall) — 24px keeps
  // top/bottom gap close to the button's horizontal px-2 so padding reads
  // even on all sides.
  xs: "w-6 h-6 text-[10px]",
  sm: "w-7 h-7 text-[11px]",
  md: "w-8 h-8 text-[12px]",
  lg: "w-14 h-14 text-xl",
} as const;

export function Avatar({
  name,
  size = "sm",
  className = "",
}: {
  name?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const initial = (name?.[0] ?? "?").toUpperCase();

  return (
    <div
      aria-hidden
      className={`${sizes[size]} rounded-full bg-(--accent-soft) text-(--accent) flex items-center justify-center font-mono font-semibold select-none ${className}`}
    >
      {initial}
    </div>
  );
}
