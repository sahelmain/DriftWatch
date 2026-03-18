import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { getApiErrorMessage, getRuns, getSuites } from "@/api";
import EmptyStatePanel from "@/components/EmptyStatePanel";
import InlineBanner from "@/components/InlineBanner";
import PageHero from "@/components/PageHero";
import SignalCard from "@/components/SignalCard";
import StatusBadge from "@/components/StatusBadge";
import {
  monitoringToneStyles,
  type MonitoringTone,
} from "@/lib/monitoringTone";
import { APP_ROUTES } from "@/lib/routes";
import { getRunTimestamp } from "@/runTimestamps";
import type { BannerState, PaginatedResponse, Suite, TestRun } from "@/types";

interface RunsHealth {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight: string;
}

function buildRunsHealth(runs: TestRun[], total: number): RunsHealth {
  const activeRuns = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  );
  const failingRuns = runs.filter(
    (run) => run.status === "failed" || run.status === "error",
  );
  const completedRuns = runs.filter(
    (run) => run.pass_rate != null && !Number.isNaN(run.pass_rate),
  );
  const avgPassRate =
    completedRuns.length > 0
      ? completedRuns.reduce((sum, run) => sum + (run.pass_rate ?? 0), 0) /
        completedRuns.length
      : 0;

  if (total === 0) {
    return {
      tone: "quiet",
      label: "No recent signal",
      title: "This run history is waiting for its first real execution feed",
      description:
        "Runs are where the monitoring story becomes concrete. Once suites execute, this page turns into the quickest path to the newest quality signal.",
      insight:
        "Use this page to scan for regressions before diving into a specific run detail.",
    };
  }

  if (activeRuns.length > 0) {
    return {
      tone: "active",
      label: "In motion",
      title: "Fresh run activity is still settling across the current window",
      description: `${activeRuns.length} run${
        activeRuns.length === 1 ? "" : "s"
      } ${
        activeRuns.length === 1 ? "is" : "are"
      } actively collecting output right now. Keep the feed open to watch the newest signal resolve.`,
      insight:
        "When the newest run is active, the most important question is whether it lands healthy or becomes the next item needing review.",
    };
  }

  if (
    failingRuns.length >= Math.max(1, Math.ceil(runs.length / 2)) &&
    runs.length > 0
  ) {
    return {
      tone: "attention",
      label: "Needs attention",
      title: "Recent execution signal looks noisy enough to deserve investigation",
      description:
        "A large share of the visible runs finished failed or errored. Open the newest failing run first and compare it against the nearest passing run.",
      insight:
        "This view is strongest when it helps you pick the next run to inspect, not when it forces you to dig through every row.",
    };
  }

  if (failingRuns.length > 0 || avgPassRate < 90) {
    return {
      tone: "watch",
      label: "Watchlist",
      title: "The current run feed is mixed and worth monitoring closely",
      description:
        "Some recent runs are healthy, but failures or softer pass rates mean the execution picture is not fully clean.",
      insight:
        "Watchlist mode is where the run detail page becomes most valuable: compare the freshest pass and freshest failure side by side.",
    };
  }

  return {
    tone: "healthy",
    label: "Healthy",
    title: "The visible run feed is landing cleanly across recent execution",
    description:
      "Recent runs are passing, active pressure is low, and nothing in the current slice suggests immediate instability.",
    insight:
      "A healthy feed should feel easy to scan. If that changes, this page is the first place where it should become obvious.",
  };
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

export default function RunsPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterSuite, setFilterSuite] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const perPage = 20;

  useEffect(() => {
    getSuites()
      .then(setSuites)
      .catch((error) => {
        setBanner({
          variant: "error",
          title: "Unable to load suite filters",
          message: getApiErrorMessage(
            error,
            "Suite filters could not be loaded.",
          ),
        });
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    getRuns({
      suite_id: filterSuite || undefined,
      status: filterStatus || undefined,
      page,
      limit: perPage,
    })
      .then((response: PaginatedResponse<TestRun>) => {
        setRuns(response.items);
        setTotal(response.total);
      })
      .catch((error) => {
        setBanner({
          variant: "error",
          title: "Unable to load runs",
          message: getApiErrorMessage(error, "Run history could not be loaded."),
        });
      })
      .finally(() => setLoading(false));
  }, [filterStatus, filterSuite, page]);

  const totalPages = Math.ceil(total / perPage) || 1;
  const health = buildRunsHealth(runs, total);
  const healthTone = monitoringToneStyles[health.tone];
  const activeRuns = runs.filter(
    (run) => run.status === "pending" || run.status === "running",
  ).length;
  const failingRuns = runs.filter(
    (run) => run.status === "failed" || run.status === "error",
  ).length;
  const completedRuns = runs.filter((run) => run.pass_rate != null);
  const avgPassRate =
    completedRuns.length > 0
      ? Math.round(
          (completedRuns.reduce((sum, run) => sum + (run.pass_rate ?? 0), 0) /
            completedRuns.length) *
            100,
        ) / 100
      : 0;
  const latestRun = runs[0] ?? null;
  const latestRunTimestamp = latestRun ? getRunTimestamp(latestRun) : null;
  const filtersActive = Boolean(filterSuite || filterStatus);
  const postureItems: Array<{
    label: string;
    value: string;
    helper: string;
    tone: MonitoringTone;
  }> = [
    {
      label: "Current scope",
      value: filtersActive ? "Filtered" : "All runs",
      helper: filtersActive
        ? "The feed is narrowed by the controls below"
        : "You are looking at the full workspace feed",
      tone: filtersActive ? "watch" : "quiet",
    },
    {
      label: "Latest signal",
      value: latestRun ? latestRun.status : "None yet",
      helper: latestRunTimestamp
        ? format(latestRunTimestamp, "MMM dd, HH:mm")
        : "Trigger a suite run to populate this feed",
      tone: latestRun
        ? latestRun.status === "passed"
          ? "healthy"
          : latestRun.status === "failed" || latestRun.status === "error"
            ? "attention"
            : "active"
        : "quiet",
    },
    {
      label: "Review pressure",
      value: failingRuns === 0 ? "Low" : failingRuns >= 2 ? "High" : "Medium",
      helper:
        failingRuns === 0
          ? "Nothing in the current slice is obviously broken"
          : "Use the newest failing row to decide where to inspect next",
      tone:
        failingRuns === 0 ? "healthy" : failingRuns >= 2 ? "attention" : "watch",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        tone={health.tone}
        label={health.label}
        title={health.title}
        description={health.description}
        insight={health.insight}
        badgeIcon={Sparkles}
        meta={
          latestRunTimestamp ? (
            <span className="inline-flex items-center gap-2 text-sm text-gray-300">
              <Clock3 size={14} className="text-gray-500" />
              Latest run {format(latestRunTimestamp, "MMM dd, HH:mm")}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Link
              to={APP_ROUTES.suites}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Play size={16} />
              Open suites
            </Link>
            {filtersActive && (
              <button
                onClick={() => {
                  setFilterSuite("");
                  setFilterStatus("");
                  setPage(1);
                }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Clear filters
              </button>
            )}
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Feed posture
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  What the current slice is saying
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", healthTone.icon)}>
                <Gauge size={20} />
              </div>
            </div>

            {postureItems.map((item) => {
              const tone = monitoringToneStyles[item.tone];
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
        }
      />

      {banner && <InlineBanner {...banner} onDismiss={() => setBanner(null)} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          label="Matching runs"
          value={String(total)}
          helper={
            filtersActive
              ? "Runs matching the current filter scope"
              : "Total runs currently visible to this workspace"
          }
          icon={Play}
          tone="blue"
        />
        <SignalCard
          label="Active runs"
          value={String(activeRuns)}
          helper={
            activeRuns === 0
              ? "Nothing is currently in motion"
              : `${activeRuns} run${activeRuns === 1 ? "" : "s"} still updating`
          }
          icon={RefreshCw}
          tone={activeRuns > 0 ? "amber" : "violet"}
        />
        <SignalCard
          label="Failures on page"
          value={String(failingRuns)}
          helper={
            failingRuns === 0
              ? "No failing rows in the current slice"
              : "Use these rows to investigate the newest regression signal"
          }
          icon={Gauge}
          tone={failingRuns === 0 ? "green" : failingRuns >= 2 ? "red" : "amber"}
        />
        <SignalCard
          label="Average pass rate"
          value={completedRuns.length > 0 ? `${avgPassRate}%` : "No baseline"}
          helper={
            completedRuns.length > 0
              ? "Average across runs with a settled pass rate"
              : "Appears once completed runs have results"
          }
          icon={Sparkles}
          tone={
            completedRuns.length === 0
              ? "violet"
              : avgPassRate >= 90
                ? "green"
                : avgPassRate >= 70
                  ? "amber"
                  : "red"
          }
        />
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Feed controls
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Filter the execution feed
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Narrow the run list by suite or status without losing the live posture of the feed.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-900 px-3 py-1.5 text-xs text-gray-400">
            <SlidersHorizontal size={13} />
            {filtersActive ? "Filters active" : "Showing full feed"}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,220px)_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Suite
            </span>
            <select
              className="select"
              value={filterSuite}
              onChange={(event) => {
                setFilterSuite(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All suites</option>
              {suites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Status
            </span>
            <select
              className="select"
              value={filterStatus}
              onChange={(event) => {
                setFilterStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
            </select>
          </label>

          <div className="flex items-end">
            <div className="inline-flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-900/70 px-4 py-3 text-sm text-gray-300">
              <Filter size={15} className="text-gray-500" />
              {filtersActive ? "Focused view" : "No filters applied"}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex h-56 items-center justify-center rounded-[24px] border border-surface-700 bg-surface-800/80">
          <Loader2 className="animate-spin text-drift-400" size={32} />
        </div>
      ) : runs.length > 0 ? (
        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Execution feed
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Run history
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Recent runs ordered by recency so the next thing worth reviewing is always near the top.
              </p>
            </div>
            <span className="surface-chip">
              Page {page} of {totalPages}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Run</th>
                  <th className="table-header">Suite</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Pass rate</th>
                  <th className="table-header">Tests</th>
                  <th className="table-header">Focus</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, index) => {
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
                        <div className="min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <Link
                              to={APP_ROUTES.run(run.id)}
                              className="font-mono text-sm text-drift-300 transition-colors hover:text-drift-200"
                            >
                              {run.id.slice(0, 8)}
                            </Link>
                            {index === 0 && (
                              <span className="rounded-full border border-drift-500/30 bg-drift-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-drift-200">
                                Latest
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs capitalize text-gray-500">
                            Triggered via {run.trigger}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="min-w-[220px]">
                          <p className="font-medium text-white">
                            {run.suite_name || run.suite_id.slice(0, 8)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {run.duration_ms != null
                              ? `${(run.duration_ms / 1000).toFixed(1)}s total duration`
                              : "Duration appears once the run completes"}
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
                              ? `${run.failed_tests} failing test${
                                  run.failed_tests === 1 ? "" : "s"
                                }`
                              : "No failing tests"}
                          </p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="min-w-[220px]">
                          <p className="font-medium text-gray-200">
                            {getRunFocus(run)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {run.status === "passed"
                              ? "Safe to use as a baseline comparison"
                              : run.status === "failed" || run.status === "error"
                                ? "Open this run if you need the next likely root cause"
                                : "Keep watching until the run settles"}
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-700 p-4">
            <span className="text-sm text-gray-400">
              {total} total run{total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn-secondary inline-flex items-center gap-1 text-sm"
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <span className="px-2 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= totalPages}
                className="btn-secondary inline-flex items-center gap-1 text-sm"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <EmptyStatePanel
          icon={Play}
          title={filtersActive ? "No runs match the current filters" : "No runs have landed yet"}
          description={
            filtersActive
              ? "Try clearing the suite or status filters to widen the feed and recover the broader execution picture."
              : "Trigger a run from the suites page to turn this space into a live execution feed with pass rates, failures, and recent signal."
          }
          actions={
            filtersActive ? (
              <button
                onClick={() => {
                  setFilterSuite("");
                  setFilterStatus("");
                  setPage(1);
                }}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Clear filters
              </button>
            ) : (
              <Link
                to={APP_ROUTES.suites}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Play size={16} />
                Open suites
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
