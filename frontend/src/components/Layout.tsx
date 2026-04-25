import { Link, useLocation } from "react-router-dom";
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
  const { logout } = useAuth();

  function handleLogout() {
    localStorage.removeItem("dw_token");
    localStorage.removeItem("dw_user");
    sessionStorage.setItem("dw_auto_login_started", "1");
    sessionStorage.setItem("dw_demo_auto_login_started_v2", "1");
    logout();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <aside className="w-64 shrink-0 border-r border-surface-700 bg-surface-950/95 backdrop-blur">
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
          <Link
            to={`${PUBLIC_ROUTES.login}?logout=1`}
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-surface-800 transition-colors w-full"
          >
            <LogOut size={18} className="text-gray-500" />
            Sign Out
          </Link>
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,110,255,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.06),transparent_18%)]" />
        <div className="relative mx-auto w-full max-w-[1560px] px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
