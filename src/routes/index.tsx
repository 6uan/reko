import { createFileRoute, Link } from "@tanstack/react-router";
import { LuLayoutDashboard } from "react-icons/lu";
import { IoLogoGithub } from "react-icons/io";
import StravaConnectButton from "../ui/StravaConnectButton";
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
                <LuLayoutDashboard size={18} />
                Go to dashboard
              </Link>
            ) : (
              <StravaConnectButton size="md" className="max-sm:flex-1" />
            )}
            <a
              href="https://github.com/6uan/reko"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <IoLogoGithub size={18} />
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
