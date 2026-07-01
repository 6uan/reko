import { useRef, useEffect, useState, useCallback, useMemo } from "react";

interface StatItem {
  value: number | string;
  label: string;
  isNumeric: boolean;
}

interface StatsStripProps {
  /** Live count from the GitHub API; null if it has never been fetched. */
  githubStars: number | null;
  /** Total activities in the DB; null if the count query failed. */
  activitiesTracked: number | null;
}

const DURATION = 1200;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function StatsStrip({
  githubStars,
  activitiesTracked,
}: StatsStripProps) {
  const stats = useMemo<StatItem[]>(
    () => [
      githubStars === null
        ? { value: "—", label: "GitHub stars", isNumeric: false }
        : { value: githubStars, label: "GitHub stars", isNumeric: true },
      activitiesTracked === null
        ? { value: "—", label: "Activities tracked", isNumeric: false }
        : {
            value: activitiesTracked,
            label: "Activities tracked",
            isNumeric: true,
          },
      { value: "MIT", label: "Open source license", isNumeric: false },
      { value: "Free", label: "Self-hosted, forever", isNumeric: false },
    ],
    [githubStars, activitiesTracked],
  );

  const sectionRef = useRef<HTMLDivElement>(null);
  const [animatedValues, setAnimatedValues] = useState<number[]>(() =>
    stats.map(() => 0),
  );
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    const targets = stats.map((s) => (s.isNumeric ? (s.value as number) : 0));
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
  }, [stats]);

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
          {stats.map((stat, i) => (
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
