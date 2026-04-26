const sizes = {
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
      className={`${sizes[size]} rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-mono font-semibold select-none ${className}`}
    >
      {initial}
    </div>
  );
}
