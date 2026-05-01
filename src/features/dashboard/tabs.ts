import type { IconType } from "react-icons";
import {
  LuLayoutDashboard,
  LuList,
  LuCircleGauge,
  LuHeartPulse,
} from "react-icons/lu";
import { FaPersonRunning } from "react-icons/fa6";
import { FaTrophy } from "react-icons/fa";

export type Tab = { to: string; icon: IconType; label: string };

export const TABS: Tab[] = [
  { to: "/dashboard", icon: LuLayoutDashboard, label: "Overview" },
  { to: "/dashboard/activities", icon: LuList, label: "Activities" },
  { to: "/dashboard/pace", icon: LuCircleGauge, label: "Pace" },
  { to: "/dashboard/heart-rate", icon: LuHeartPulse, label: "Heart rate" },
  { to: "/dashboard/cadence", icon: FaPersonRunning, label: "Cadence" },
  { to: "/dashboard/records", icon: FaTrophy, label: "Personal records" },
];

/** Check if a tab matches the current pathname. */
export function isTabActive(tab: Tab, pathname: string) {
  return tab.to === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(tab.to);
}
