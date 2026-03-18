import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FlaskConical,
  Play,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/AuthContext";
import { APP_ROUTES, PUBLIC_ROUTES } from "@/lib/routes";

const navItems = [
  { to: APP_ROUTES.root, icon: LayoutDashboard, label: "Dashboard" },
  { to: APP_ROUTES.suites, icon: FlaskConical, label: "Suites" },
  { to: APP_ROUTES.runs, icon: Play, label: "Runs" },
  { to: APP_ROUTES.timeline, icon: Activity, label: "Timeline" },
  { to: APP_ROUTES.alerts, icon: Bell, label: "Alerts" },
  { to: APP_ROUTES.policies, icon: ShieldCheck, label: "Policies" },
  { to: APP_ROUTES.settings, icon: Settings, label: "Settings" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate(PUBLIC_ROUTES.login);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-surface-950 border-r border-surface-700 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-surface-700">
          <Link to={APP_ROUTES.root} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-drift-500 to-drift-700 flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              DriftWatch
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              item.to === APP_ROUTES.root
                ? location.pathname === APP_ROUTES.root
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-drift-600/20 text-drift-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-surface-800",
                )}
              >
                <item.icon
                  size={18}
                  className={clsx(active ? "text-drift-400" : "text-gray-500")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-surface-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-800 transition-colors w-full"
          >
            <LogOut size={18} className="text-gray-500" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
