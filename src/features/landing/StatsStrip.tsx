import { useRef, useEffect, useState, useCallback } from "react";

interface StatItem {
  value: number | string;
  label: string;
  isNumeric: boolean;
}

const STATS: StatItem[] = [
  { value: 0, label: "GitHub stars", isNumeric: true },
  { value: 0, label: "Activities tracked", isNumeric: true },
  { value: "MIT", label: "Open source license", isNumeric: false },
  { value: "Free", label: "Self-hosted, forever", isNumeric: false },
];

const DURATION = 1200;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function StatsStrip() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [animatedValues, setAnimatedValues] = useState<number[]>(
    STATS.map((s) => (s.isNumeric ? 0 : 0)),
  );
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    const targets = STATS.map((s) => (s.isNumeric ? (s.value as number) : 0));
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = easeOutCubic(progress);

      setAnimatedValues(targets.map((target) => Math.round(eased * target)));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animate();
            observer.unobserve(el);
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <section ref={sectionRef} className="border-t py-4 border-(--line)">
      <div className="wrap py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center text-center py-4 lg:py-0 ${
                i > 0 ? "lg:border-l lg:border-(--line)" : ""
              }`}
            >
              <span className="font-mono text-[28px] font-medium tabular-nums text-(--ink)">
                {stat.isNumeric
                  ? animatedValues[i].toLocaleString()
                  : (stat.value as string)}
              </span>
              <span className="text-[13px] text-(--ink-3) mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
