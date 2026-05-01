import { Link, useLocation } from "@tanstack/react-router";
import ProfileCard from "@/components/ProfileCard";
import { TABS, isTabActive, type Tab } from "./tabs";

type SidebarProps = {
  athlete: { firstname?: string; lastname?: string; profile?: string };
  activityCount: number;
  lastSyncFinishedAt: Date | null;
  onResync: () => void;
};

export default function Sidebar({
  athlete,
  activityCount,
  lastSyncFinishedAt,
  onResync,
}: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-70 bg-(--bg-2) border-r border-(--line) flex flex-col z-40 max-lg:hidden">
      <div className="px-5 py-5">
        <Link
          to="/"
          className="font-display text-[32px] leading-none text-(--ink) no-underline"
        >
          Reko
        </Link>
      </div>

      <nav className="flex-1 px-6 mt-2">
        <div className="flex flex-col gap-1.5">
          {TABS.map((tab) => (
            <NavLink key={tab.to} tab={tab} />
          ))}
        </div>
      </nav>

      <ProfileCard
        firstname={athlete.firstname}
        lastname={athlete.lastname}
        activityCount={activityCount}
        lastSyncFinishedAt={lastSyncFinishedAt}
        onResyncTriggered={onResync}
        className="mx-3 mb-4"
      />
    </aside>
  );
}

function NavLink({ tab }: { tab: Tab }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const isActive = isTabActive(tab, pathname);
  const Icon = tab.icon;

  return (
    <Link
      to={tab.to}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-(--radius-s) text-base no-underline transition-[background-color,color] duration-150 ${
        isActive
          ? "bg-(--accent-soft) text-(--ink) font-medium"
          : "text-(--ink-3) hover:bg-(--line-2) hover:text-(--ink)"
      }`}
    >
      <Icon size={20} className={isActive ? "text-(--accent)" : "opacity-50"} />
      {tab.label}
    </Link>
  );
}
