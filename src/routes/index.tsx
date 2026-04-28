import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import DashboardMockup from "../features/landing/DashboardMockup";
import StatsStrip from "../features/landing/StatsStrip";
import OpenSourceSection from "../features/landing/OpenSourceSection";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  // Pull session from the root route's context so the hero CTA can
  // adapt to auth state. Logged-out → "Connect with Strava". Logged-in
  // → "Go to dashboard" (otherwise mobile users have nowhere to click,
  // since the header's Dashboard link is hidden below the mobile
  // breakpoint via `hide-m`).
  const { session } = Route.useRouteContext();

  return (
    <>
      <section className="pt-14 pb-10 max-sm:pt-6  relative overflow-x-hidden">
        <div className="wrap">
          <h1 className="text-[clamp(56px,7.5vw,92px)] leading-[0.98] tracking-[-0.035em] font-medium mt-5.5 text-(--ink) max-w-[14ch]">
            Every run,
            <br />
            <em className="not-italic text-(--accent) font-medium">
              measured.
            </em>
          </h1>

          <p className="text-[19px] leading-normal text-(--ink-2) mt-6 max-w-[52ch] tracking-tight">
            Reko syncs with your Strava and goes deeper into your data.{" "}
            <strong className="text-(--ink) font-medium">
              Personal records across every distance,
            </strong>{" "}
            leaderboards of your own efforts, and pace trends you can actually
            read. Self-hosted. Your data stays yours.
          </p>

          <div className="flex gap-2.5 mt-8 flex-wrap items-center max-sm:[&_.btn]:flex-1">
            {session ? (
              <Link
                to="/dashboard"
                aria-label="Go to dashboard"
                className="btn btn-primary max-sm:flex-1"
              >
                <LayoutDashboard size={16} />
                Go to dashboard
              </Link>
            ) : (
              <a
                href="/auth/strava"
                aria-label="Connect with Strava"
                className="inline-block transition-transform duration-150 ease-out hover:-translate-y-0.5 max-sm:flex-1"
              >
                <img
                  src="/strava/btn_strava_connect_with_orange@2x.png"
                  srcSet="/strava/btn_strava_connect_with_orange.png 1x, /strava/btn_strava_connect_with_orange@2x.png 2x"
                  alt="Connect with Strava"
                  width={237}
                  height={48}
                  className="block h-12 w-auto max-sm:w-full max-sm:h-auto"
                />
              </a>
            )}
            <a
              href="https://github.com/6uan/reko"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.75 h-3.75"
              >
                <path d="M8 .25a7.75 7.75 0 0 0-2.45 15.1c.39.07.53-.17.53-.38v-1.3c-2.15.47-2.6-1.04-2.6-1.04-.36-.9-.87-1.14-.87-1.14-.71-.49.05-.48.05-.48.78.06 1.2.8 1.2.8.7 1.2 1.83.85 2.28.65.07-.5.27-.85.5-1.04-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-1 .08-2.08 0 0 .65-.21 2.15.8a7.4 7.4 0 0 1 3.9 0c1.5-1.01 2.15-.8 2.15-.8.43 1.08.16 1.88.08 2.08.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.72.53 1.45v2.15c0 .21.14.46.54.38A7.75 7.75 0 0 0 8 .25Z" />
              </svg>
              View on GitHub
            </a>
          </div>

          <div className="mt-5.5 flex items-center gap-3.5 font-mono text-xs text-(--ink-3)">
            <span className="px-2 py-1 rounded-md bg-(--card-2) border border-(--line-2)">
              MIT
            </span>
            <span>v0.1 &middot; open-source &middot; self-hosted</span>
          </div>

          <DashboardMockup />
        </div>
      </section>
      <StatsStrip />
      <OpenSourceSection />
    </>
  );
}
