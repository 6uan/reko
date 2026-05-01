import { Link, useLocation } from "@tanstack/react-router";
import ProfileCard from "@/components/ProfileCard";
import IconButton from "@/components/IconButton";
import { TABS, isTabActive } from "./tabs";
import { HiOutlineXMark } from "react-icons/hi2";

type MobileNavProps = {
  athlete: { firstname?: string; lastname?: string; profile?: string };
  activityCount: number;
  lastSyncFinishedAt: Date | null;
  onClose: () => void;
  onResync: () => void;
};

export default function MobileNav({
  athlete,
  activityCount,
  lastSyncFinishedAt,
  onClose,
  onResync,
}: MobileNavProps) {
  const pathname = useLocation({ select: (l) => l.pathname });

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-(--bg) flex flex-col">
      <div className="flex items-center px-4 py-3.5 border-b border-(--line)">
        <IconButton onClick={onClose} aria-label="Close navigation">
          <HiOutlineXMark size={18} />
        </IconButton>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-eyebrow mb-3 px-1">Training</p>
        <div className="grid grid-cols-2 gap-3">
          {TABS.map((tab) => {
            const isActive = isTabActive(tab, pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                onClick={onClose}
                className={`flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-colors no-underline ${
                  isActive
                    ? "bg-(--card) border-(--accent) shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    : "bg-(--card) border-(--line) hover:bg-(--card-2)"
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? "text-(--accent)" : "text-(--ink-3)"}
                />
                <span className="text-[15px] font-bold text-(--ink) leading-tight">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mx-4 mb-2">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-(--ink-2) no-underline hover:bg-(--card) hover:text-(--ink) transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Back to home
        </Link>
      </div>
      <ProfileCard
        firstname={athlete.firstname}
        lastname={athlete.lastname}
        activityCount={activityCount}
        lastSyncFinishedAt={lastSyncFinishedAt}
        onResyncTriggered={onResync}
        onNavigate={onClose}
        className="mx-4 mb-4"
      />
    </div>
  );
}
