import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Clock3,
  FlaskConical,
  Gauge,
  Play,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAlerts, getRuns, getSuites } from "@/api";
import StatusBadge from "@/components/StatusBadge";
import { getRunTimestamp } from "@/runTimestamps";
import type { AlertConfig, Suite, TestRun } from "@/types";

interface Stats {
  totalSuites: number;
  totalRuns: number;
  avgPassRate: number;
  activeAlerts: number;
}

interface TrendPoint {
  date: string;
  pass_rate: number;
}

interface DashboardHealth {
  tone: "healthy" | "attention" | "watch" | "quiet" | "active";
  label: string;
  headline: string;
  message: string;
  insight: string;
  panelTitle: string;
}

interface DashboardSnapshot {
  suiteCount: number;
  runs: TestRun[];
  alerts: AlertConfig[];
  stats: Stats;
}

interface DashboardSignalCard {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "red" | "violet";
}

interface AttentionItem {
  label: string;
  value: string;
  helper: string;
  tone: "healthy" | "attention" | "watch" | "quiet" | "active";
}

const EMPTY_RUNS_RESPONSE = {
  items: [] as TestRun[],
  total: 0,
  page: 1,
  limit: 30,
  pages: 1,
};

const toneStyles = {
  healthy: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    icon: "bg-emerald-500/15 text-emerald-300",
    panel: "border-emerald-500/20 bg-emerald-500/5",
  },
  attention: {
    badge: "border-red-500/30 bg-red-500/10 text-red-200",
    icon: "bg-red-500/15 text-red-300",
    panel: "border-red-500/20 bg-red-500/5",
  },
  watch: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    icon: "bg-amber-500/15 text-amber-300",
    panel: "border-amber-500/20 bg-amber-500/5",
  },
  quiet: {
    badge: "border-surface-600 bg-surface-800/80 text-gray-200",
    icon: "bg-surface-700/70 text-gray-300",
    panel: "border-surface-700 bg-surface-900/40",
  },
  active: {
    badge: "border-drift-500/30 bg-drift-500/10 text-drift-200",
    icon: "bg-drift-500/15 text-drift-300",
    panel: "border-drift-500/20 bg-drift-500/5",
  },
} as const;

const signalToneStyles = {
  blue: {
    icon: "bg-drift-500/15 text-drift-300",
    ring: "from-drift-500/20 via-drift-500/5 to-transparent",
  },
  green: {
    icon: "bg-emerald-500/15 text-emerald-300",
    ring: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-300",
    ring: "from-amber-500/20 via-amber-500/5 to-transparent",
  },
  red: {
    icon: "bg-red-500/15 text-red-300",
    ring: "from-red-500/20 via-red-500/5 to-transparent",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-300",
    ring: "from-violet-500/20 via-violet-500/5 to-transparent",
  },
} as const;

function buildTrendData(runs: TestRun[]): TrendPoint[] {
  const grouped = new Map<string, { label: string; rates: number[] }>();

  for (const run of runs) {
    const timestamp = getRunTimestamp(run);
    if (!timestamp) {
      continue;
    }

    const key = format(timestamp, "yyyy-MM-dd");
    const existing = grouped.get(key) || {
      label: format(timestamp, "MMM dd"),
      rates: [],
    };
    existing.rates.push(run.pass_rate ?? 0);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, entry]) => ({
      date: entry.label,
      pass_rate:
        Math.round(
          (entry.rates.reduce((sum, value) => sum + value, 0) /
            entry.rates.length) *
            100,
        ) / 100,
    }));
}

function buildHealth(snapshot: DashboardSnapshot): DashboardHealth {
  const { suiteCount, runs, alerts, stats } = snapshot;
  const activeAlerts = alerts.filter((alert) => alert.enabled).length;
  const activeRuns = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  );
  const failingRuns = runs.filter(
    (run) => run.status === "failed" || run.status === "error",
  );

  if (suiteCount === 0) {
    return {
      tone: "quiet",
      label: "No recent signal",
      headline: "Your dashboard is ready for its first quality baseline",
      message:
        "Create a suite to turn this page into a live monitoring cockpit for prompts, models, and regressions.",
      insight:
        "Once runs begin, this page will surface stability, drift, and attention areas automatically.",
      panelTitle: "Next best move",
    };
  }

  if (runs.length === 0) {
    return {
      tone: "quiet",
      label: "No recent signal",
      headline: "Monitoring is configured but still waiting on a first run",
      message:
        "You already have suites in place. Trigger one run to populate trend history, recent failures, and health status.",
      insight:
        "The first successful run becomes your baseline. Failed runs will show up here as attention signals.",
      panelTitle: "What to do next",
    };
  }

  if (activeRuns.length > 0) {
    return {
      tone: "active",
      label: "In motion",
      headline: "Fresh evaluation signal is currently being collected",
      message: `${activeRuns.length} run${activeRuns.length === 1 ? "" : "s"} ${
        activeRuns.length === 1 ? "is" : "are"
      } active right now. Keep this dashboard open to watch the latest state settle.`,
      insight:
        "Recent activity is still changing, so the strongest signal is whether the newest runs finish healthy.",
      panelTitle: "Live posture",
    };
  }

  if (failingRuns.length === 0 && stats.avgPassRate >= 90 && activeAlerts === 0) {
    return {
      tone: "healthy",
      label: "Healthy",
      headline: "Quality looks stable across your recent runs",
      message:
        "The latest signal is landing cleanly: no recent failures, no active alerts, and pass rates are holding above target.",
      insight:
        "The trend line is useful here as a guardrail. If it starts slipping, investigate the newest suite first.",
      panelTitle: "What is working",
    };
  }

  if (
    failingRuns.length >= Math.max(1, Math.ceil(runs.length / 2)) ||
    stats.avgPassRate < 70
  ) {
    return {
      tone: "attention",
      label: "Needs attention",
      headline: "Recent runs suggest a regression that deserves review",
      message:
        "Most of the latest signal is failing or below target. Use the newest run details to inspect assertions and isolate the regression.",
      insight:
        "When this state appears, the newest failing run is usually the fastest path to a concrete explanation.",
      panelTitle: "Attention needed",
    };
  }

  return {
    tone: "watch",
    label: "Watchlist",
    headline: "Quality is mixed and worth monitoring closely",
    message:
      "Some recent runs are healthy, but there are failures or alerts in the same window. Treat this as a watchlist rather than a clean bill of health.",
    insight:
      "A mixed trend usually means the suite set is split. Compare the newest failing and passing runs side by side.",
    panelTitle: "Watchlist",
  };
}

function buildSignalCards(snapshot: DashboardSnapshot): DashboardSignalCard[] {
  const { suiteCount, runs, stats } = snapshot;
  const activeRuns = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  ).length;
  const failingRuns = runs.filter(
    (run) => run.status === "failed" || run.status === "error",
  ).length;

  const passRateTone: DashboardSignalCard["tone"] =
    runs.length === 0
      ? "blue"
      : stats.avgPassRate >= 90
        ? "green"
        : stats.avgPassRate >= 70
          ? "amber"
          : "red";

  const alertsTone: DashboardSignalCard["tone"] =
    stats.activeAlerts > 0 ? "amber" : "violet";

  const runsTone: DashboardSignalCard["tone"] =
    activeRuns > 0 ? "amber" : failingRuns > 0 ? "green" : "green";

  return [
    {
      label: "Total suites",
      value: String(stats.totalSuites),
      helper:
        suiteCount === 0
          ? "No monitors configured yet"
          : `${suiteCount} active monitor${suiteCount === 1 ? "" : "s"} in play`,
      icon: FlaskConical,
      tone: "blue",
    },
    {
      label: "Recent runs",
      value: String(stats.totalRuns),
      helper:
        runs.length === 0
          ? "No recent execution signal"
          : activeRuns > 0
            ? `${activeRuns} currently in progress`
            : "Last 30 days of execution history",
      icon: Play,
      tone: runsTone,
    },
    {
      label: "Average pass rate",
      value: runs.length === 0 ? "No baseline" : `${stats.avgPassRate}%`,
      helper:
        runs.length === 0
          ? "Appears after the first run"
          : stats.avgPassRate >= 90
            ? "Recent quality is holding steady"
            : stats.avgPassRate >= 70
              ? "Mixed quality needs monitoring"
              : "Recent signal is below target",
      icon: TrendingUp,
      tone: passRateTone,
    },
    {
      label: "Active alerts",
      value: String(stats.activeAlerts),
      helper:
        stats.activeAlerts === 0
          ? "No escalation rules armed"
          : `${stats.activeAlerts} safeguard${stats.activeAlerts === 1 ? "" : "s"} ready`,
      icon: Bell,
      tone: alertsTone,
    },
  ];
}

function buildAttentionItems(snapshot: DashboardSnapshot): AttentionItem[] {
  const { runs, alerts } = snapshot;
  const latestRun = runs[0] ?? null;
  const latestTimestamp = latestRun ? getRunTimestamp(latestRun) : null;
  const failingRuns = runs.filter(
    (run) => run.status === "failed" || run.status === "error",
  );
  const activeRuns = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  );
  const enabledAlerts = alerts.filter((alert) => alert.enabled);

  const latestRunTone: AttentionItem["tone"] =
    latestRun == null
      ? "quiet"
      : latestRun.status === "passed"
        ? "healthy"
        : latestRun.status === "failed" || latestRun.status === "error"
          ? "attention"
          : "active";

  return [
    {
      label: "Latest run",
      value: latestRun ? latestRun.status : "No run yet",
      helper: latestTimestamp
        ? format(latestTimestamp, "MMM dd, HH:mm")
        : "Run one suite to establish a baseline",
      tone: latestRunTone,
    },
    {
      label: "Runs needing review",
      value: String(failingRuns.length),
      helper:
        failingRuns.length === 0
          ? "No recent failures in the window"
          : `${failingRuns.length} run${failingRuns.length === 1 ? "" : "s"} finished failed or errored`,
      tone:
        failingRuns.length === 0
          ? "healthy"
          : failingRuns.length >= 2
            ? "attention"
            : "watch",
    },
    {
      label: "Operational signal",
      value:
        activeRuns.length > 0
          ? `${activeRuns.length} active`
          : enabledAlerts.length > 0
            ? `${enabledAlerts.length} alerts armed`
            : "Quiet",
      helper:
        activeRuns.length > 0
          ? "Fresh evaluation results are still in motion"
          : enabledAlerts.length > 0
            ? "Escalation rules are active for monitored suites"
            : "No active runs and no alert pressure",
      tone:
        activeRuns.length > 0
          ? "active"
          : enabledAlerts.length > 0
            ? "watch"
            : "quiet",
    },
  ];
}

function getRunFocus(run: TestRun): string {
  if (run.status === "pending") {
    return "Queued for execution";
  }
  if (run.status === "running") {
    return "Collecting fresh output";
  }
  if (run.status === "error") {
    return "Execution failed before results settled";
  }
  if (run.status === "failed") {
    if (run.failed_tests > 0) {
      return `${run.failed_tests} test${run.failed_tests === 1 ? "" : "s"} failed`;
    }
    return "Review failing assertions";
  }
  return "All checks passed";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-surface-700 bg-surface-800/80 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-surface-700" />
          <div className="h-10 w-2/3 rounded bg-surface-700" />
          <div className="h-4 w-3/4 rounded bg-surface-700" />
          <div className="flex gap-3">
            <div className="h-10 w-32 rounded bg-surface-700" />
            <div className="h-10 w-28 rounded bg-surface-700" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-surface-700 bg-surface-800/80 p-5"
          >
            <div className="h-4 w-24 rounded bg-surface-700" />
            <div className="mt-3 h-8 w-20 rounded bg-surface-700" />
            <div className="mt-3 h-3 w-36 rounded bg-surface-700" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="h-[360px] animate-pulse rounded-[24px] border border-surface-700 bg-surface-800/80" />
        <div className="h-[360px] animate-pulse rounded-[24px] border border-surface-700 bg-surface-800/80" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalSuites: 0,
    totalRuns: 0,
    avgPassRate: 0,
    activeAlerts: 0,
  });
  const [suiteCount, setSuiteCount] = useState(0);
  const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [suites, runsRes, fetchedAlerts] = await Promise.all([
          getSuites().catch(() => [] as Suite[]),
          getRuns({ limit: 30 }).catch(() => EMPTY_RUNS_RESPONSE),
          getAlerts().catch(() => [] as AlertConfig[]),
        ]);

        const runs = runsRes.items;
        const avgRate =
          runs.length > 0
            ? runs.reduce((sum, run) => sum + (run.pass_rate ?? 0), 0) /
              runs.length
            : 0;

        setSuiteCount(suites.length);
        setAlerts(fetchedAlerts);
        setRecentRuns(runs.slice(0, 8));
        setTrendData(buildTrendData(runs));
        setStats({
          totalSuites: suites.length,
          totalRuns: runsRes.total,
          avgPassRate: Math.round(avgRate * 100) / 100,
          activeAlerts: fetchedAlerts.filter((alert) => alert.enabled).length,
        });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const snapshot: DashboardSnapshot = {
    suiteCount,
    runs: recentRuns,
    alerts,
    stats,
  };
  const health = buildHealth(snapshot);
  const statCards = buildSignalCards(snapshot);
  const attentionItems = buildAttentionItems(snapshot);
  const latestRun = recentRuns[0] ?? null;
  const latestRunTimestamp = latestRun ? getRunTimestamp(latestRun) : null;
  const healthTone = toneStyles[health.tone];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-surface-700 bg-[radial-gradient(circle_at_top_left,rgba(59,110,255,0.22),transparent_38%),linear-gradient(135deg,#16203a_0%,#0c1326_58%,#09101e_100%)] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-drift-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_340px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  healthTone.badge,
                )}
              >
                <Sparkles size={14} />
                {health.label}
              </span>
              {latestRunTimestamp && (
                <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Clock3 size={14} className="text-gray-500" />
                  Latest signal {format(latestRunTimestamp, "MMM dd, HH:mm")}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {health.headline}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-gray-300">
                  {health.message}
                </p>
              </div>
              <p className="max-w-3xl text-sm text-gray-400">{health.insight}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/suites/new"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Create suite
              </Link>
              <Link
                to={suiteCount > 0 ? "/suites" : "/runs"}
                className="btn-secondary inline-flex items-center gap-2"
              >
                {suiteCount > 0 ? <FlaskConical size={16} /> : <Play size={16} />}
                {suiteCount > 0 ? "Open suites" : "Open runs"}
              </Link>
            </div>
          </div>

          <div
            className={clsx(
              "rounded-[24px] border p-5 backdrop-blur-sm",
              healthTone.panel,
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Control panel
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  {health.panelTitle}
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", healthTone.icon)}>
                <Gauge size={20} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {attentionItems.map((item) => {
                const tone = toneStyles[item.tone];
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-surface-700/80 bg-surface-950/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
                      </div>
                      <span
                        className={clsx(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                          tone.badge,
                        )}
                      >
                        {item.value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const tone = signalToneStyles[card.tone];
          return (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-[24px] border border-surface-700 bg-surface-800/90 p-5"
            >
              <div
                className={clsx(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                  tone.ring,
                )}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">{card.helper}</p>
                </div>
                <div className={clsx("rounded-2xl p-3", tone.icon)}>
                  <card.icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
        <div className="rounded-[24px] border border-surface-700 bg-surface-800/90 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Trend monitor
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Pass rate trend
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-400">
                {trendData.length > 0
                  ? health.insight
                  : "Once runs complete, this chart becomes the fastest way to spot baseline shifts and regressions."}
              </p>
            </div>
            <span className="rounded-full border border-surface-700 bg-surface-900/70 px-3 py-1 text-xs font-medium text-gray-300">
              Last 30 days
            </span>
          </div>

          {trendData.length > 0 ? (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="dashboardTrendFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4f7cff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1d2b47" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#6f82a6"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6f82a6"
                    tick={{ fontSize: 12 }}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "#3458b6", strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#0f172b",
                      border: "1px solid #243454",
                      borderRadius: "14px",
                      color: "#e5edf9",
                    }}
                    formatter={(value: number) => [`${value}%`, "Average pass rate"]}
                    labelStyle={{ color: "#9fb2d6" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pass_rate"
                    stroke="#4f7cff"
                    strokeWidth={3}
                    fill="url(#dashboardTrendFill)"
                    dot={{ fill: "#4f7cff", stroke: "#101a31", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#90b0ff", stroke: "#101a31", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-6 flex h-[320px] items-center justify-center rounded-[20px] border border-dashed border-surface-700 bg-surface-950/35 p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-800 text-drift-300">
                  <Activity size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">No trend line yet</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Trigger the first suite run to start building your baseline. This chart becomes the quickest visual signal when pass rates drift.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to="/suites"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <FlaskConical size={16} />
                    Open suites
                  </Link>
                  <Link
                    to="/suites/new"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Create suite
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-surface-700 bg-surface-800/90 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Signal summary
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Run health
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                A compact view of where the latest execution signal is landing.
              </p>
            </div>
            <div className={clsx("rounded-2xl p-3", healthTone.icon)}>
              {health.tone === "attention" ? (
                <AlertTriangle size={20} />
              ) : (
                <Gauge size={20} />
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {attentionItems.map((item) => {
              const tone = toneStyles[item.tone];
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-surface-700/80 bg-surface-950/40 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
                    </div>
                    <span
                      className={clsx(
                        "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                        tone.badge,
                      )}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-surface-700 bg-surface-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Operator note
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {latestRun
                ? `Start with the latest ${latestRun.status} run. If the newest signal is noisy, open its details and compare assertions before changing prompts or policies.`
                : "Once you have a first run, this panel becomes the fastest read on whether the system is healthy, mixed, or regressing."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-surface-700 bg-surface-800/90">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Execution feed
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Recent runs</h2>
            <p className="mt-2 text-sm text-gray-400">
              The freshest run signal, ordered by recency, so regressions are visible without digging.
            </p>
          </div>
          <Link
            to="/runs"
            className="inline-flex items-center gap-2 text-sm font-medium text-drift-300 transition-colors hover:text-drift-200"
          >
            View all runs
            <ArrowRight size={14} />
          </Link>
        </div>

        {recentRuns.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Suite</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Pass rate</th>
                  <th className="table-header">Tests</th>
                  <th className="table-header">Focus</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run, index) => {
                  const timestamp = getRunTimestamp(run);
                  const passRateTone =
                    run.pass_rate == null
                      ? "text-gray-400"
                      : run.pass_rate >= 90
                        ? "text-emerald-300"
                        : run.pass_rate >= 70
                          ? "text-amber-300"
                          : "text-red-300";

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-surface-700/50 transition-colors hover:bg-surface-800/60"
                    >
                      <td className="table-cell">
                        <div className="min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/runs/${run.id}`}
                              className="font-medium text-white transition-colors hover:text-drift-300"
                            >
                              {run.suite_name || run.suite_id.slice(0, 8)}
                            </Link>
                            {index === 0 && (
                              <span className="rounded-full border border-drift-500/30 bg-drift-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-drift-200">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Run {run.id.slice(0, 8)}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="table-cell">
                        <div className="min-w-[110px]">
                          <p className={clsx("font-semibold", passRateTone)}>
                            {run.pass_rate != null ? `${run.pass_rate}%` : "Pending"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {run.status === "passed"
                              ? "Healthy finish"
                              : run.status === "failed" || run.status === "error"
                                ? "Below target"
                                : "Still updating"}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="min-w-[120px]">
                          <p className="font-medium text-white">
                            <span className="text-emerald-300">{run.passed_tests}</span>
                            <span className="text-gray-500"> / </span>
                            <span>{run.total_tests}</span>
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {run.failed_tests > 0
                              ? `${run.failed_tests} failing test${run.failed_tests === 1 ? "" : "s"}`
                              : "No failing tests"}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="min-w-[220px]">
                          <p className="font-medium text-gray-200">
                            {getRunFocus(run)}
                          </p>
                          <p className="mt-1 text-xs capitalize text-gray-500">
                            Triggered via {run.trigger}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell text-gray-400">
                        {timestamp ? format(timestamp, "MMM dd, HH:mm") : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 sm:p-12">
            <div className="rounded-[20px] border border-dashed border-surface-700 bg-surface-950/35 p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-800 text-drift-300">
                <Play size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white">No recent runs yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-400">
                This table becomes your live execution feed once suites start running. Use it to spot the latest failing run before digging into details.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/suites"
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <FlaskConical size={16} />
                  Open suites
                </Link>
                <Link
                  to="/suites/new"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  Create suite
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
