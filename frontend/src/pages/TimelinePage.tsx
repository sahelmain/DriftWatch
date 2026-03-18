import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Clock3,
  Loader2,
  Play,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import clsx from "clsx";
import {
  getApiErrorMessage,
  getDriftTimeline,
  getRuns,
  getSuites,
} from "@/api";
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
import type { BannerState, DriftScore, Suite, TestRun } from "@/types";

const DRIFT_THRESHOLD = 0.3;

interface TimelineHealth {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight: string;
}

function buildTimelineHealth(
  selectedSuite: Suite | undefined,
  timeline: DriftScore[],
): TimelineHealth {
  const latestPoint =
    timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
  const violations = timeline.filter((point) => point.drift_score > DRIFT_THRESHOLD);

  if (!selectedSuite) {
    return {
      tone: "quiet",
      label: "No recent signal",
      title: "Choose a suite to turn this page into a drift narrative",
      description:
        "Timeline becomes useful once a suite is selected and has enough historical runs to show baseline movement over time.",
      insight:
        "This page is strongest when it tells a before-and-after quality story, not just when it shows a line chart.",
    };
  }

  if (timeline.length === 0) {
    return {
      tone: "quiet",
      label: "No recent signal",
      title: `${selectedSuite.name} is selected, but it does not have enough history yet`,
      description:
        "Run the suite a few times to build a baseline. Once history exists, this page highlights pass-rate movement and drift pressure automatically.",
      insight:
        "The first few data points matter because they define what 'normal' looks like before a regression lands.",
    };
  }

  if (
    latestPoint &&
    (latestPoint.drift_score > DRIFT_THRESHOLD || latestPoint.pass_rate < 0.7)
  ) {
    return {
      tone: "attention",
      label: "Needs attention",
      title: `${selectedSuite.name} is showing drift pressure worth investigating`,
      description:
        "The latest point is below target or above the configured drift threshold, which suggests the suite has moved far enough from baseline to deserve review.",
      insight:
        "Start with the newest violating point and then compare it against the last calm period to see what changed.",
    };
  }

  if (violations.length > 0 || (latestPoint && latestPoint.pass_rate < 0.9)) {
    return {
      tone: "watch",
      label: "Watchlist",
      title: `${selectedSuite.name} is mixed and should stay on your watchlist`,
      description:
        "The trend is not fully clean. Some points look stable, but the history includes drift or weaker pass rates in the same window.",
      insight:
        "Mixed timelines are usually the most useful: they give you both a healthy baseline and a degraded comparison point in one place.",
    };
  }

  return {
    tone: "healthy",
    label: "Healthy",
    title: `${selectedSuite.name} is holding a stable monitoring baseline`,
    description:
      "Pass rates are steady, drift pressure is low, and the selected suite is behaving like a healthy baseline monitor.",
    insight:
      "Healthy timelines still matter because they help you spot when the next model or prompt change starts to bend the trend.",
  };
}

export default function TimelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSuiteId = searchParams.get("suite") || "";
  const [suites, setSuites] = useState<Suite[]>([]);
  const [timeline, setTimeline] = useState<DriftScore[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);

  useEffect(() => {
    getSuites()
      .then(setSuites)
      .catch((error) => {
        setBanner({
          variant: "error",
          title: "Unable to load suites",
          message: getApiErrorMessage(
            error,
            "Suite options could not be loaded.",
          ),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSuiteId) {
      setTimeline([]);
      setRuns([]);
      return;
    }
    setLoading(true);
    Promise.all([
      getDriftTimeline(selectedSuiteId).catch((error) => {
        throw error;
      }),
      getRuns({ suite_id: selectedSuiteId, limit: 50 }).catch((error) => {
        throw error;
      }),
    ])
      .then(([drift, runsRes]) => {
        setTimeline(drift);
        setRuns(runsRes.items);
      })
      .catch((error) => {
        setBanner({
          variant: "error",
          title: "Unable to load timeline",
          message: getApiErrorMessage(
            error,
            "Timeline history could not be loaded for this suite.",
          ),
        });
        setTimeline([]);
        setRuns([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSuiteId]);

  function selectSuite(id: string) {
    setSearchParams(id ? { suite: id } : {});
  }

  const selectedSuite = suites.find((suite) => suite.id === selectedSuiteId);
  const driftViolations = timeline.filter(
    (point) => point.drift_score > DRIFT_THRESHOLD,
  );
  const chartData = timeline.map((point) => ({
    ...point,
    date: format(new Date(point.date), "MMM dd"),
    pass_rate_pct: Math.round(point.pass_rate * 100 * 100) / 100,
  }));
  const latestPoint =
    timeline.length > 0 ? timeline[timeline.length - 1] : undefined;
  const latestRun = runs[0] ?? null;
  const latestRunTimestamp = latestRun ? getRunTimestamp(latestRun) : null;
  const avgPassRate =
    timeline.length > 0
      ? Math.round(
          (timeline.reduce((sum, point) => sum + point.pass_rate, 0) /
            timeline.length) *
            10000,
        ) / 100
      : 0;
  const peakDrift =
    timeline.length > 0
      ? Math.max(...timeline.map((point) => point.drift_score))
      : 0;
  const health = buildTimelineHealth(selectedSuite, timeline);
  const healthTone = monitoringToneStyles[health.tone];
  const postureItems: Array<{
    label: string;
    value: string;
    helper: string;
    tone: MonitoringTone;
  }> = [
    {
      label: "Selected suite",
      value: selectedSuite?.name || "None selected",
      helper: selectedSuite
        ? "Timeline history is scoped to this suite only"
        : "Pick a suite to begin the drift narrative",
      tone: selectedSuite ? "quiet" : "watch",
    },
    {
      label: "Latest drift",
      value: latestPoint ? latestPoint.drift_score.toFixed(3) : "No data",
      helper:
        latestPoint && latestPoint.drift_score > DRIFT_THRESHOLD
          ? "Above configured drift threshold"
          : "Latest recorded drift score",
      tone:
        latestPoint == null
          ? "quiet"
          : latestPoint.drift_score > DRIFT_THRESHOLD
            ? "attention"
            : "healthy",
    },
    {
      label: "Violation pressure",
      value: `${driftViolations.length}`,
      helper:
        driftViolations.length === 0
          ? "No points above the drift threshold"
          : `${driftViolations.length} point${
              driftViolations.length === 1 ? "" : "s"
            } crossed the threshold`,
      tone:
        driftViolations.length === 0
          ? "healthy"
          : driftViolations.length >= 2
            ? "attention"
            : "watch",
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
            {selectedSuiteId && (
              <button
                onClick={() => selectSuite("")}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Activity size={16} />
                Clear suite
              </button>
            )}
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Timeline posture
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Monitoring readout
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", healthTone.icon)}>
                <TrendingDown size={20} />
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200">
                        {item.label}
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {item.helper}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "max-w-[150px] truncate rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
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

      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Monitor selection
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Choose the suite to analyze
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              The timeline is scoped to one suite at a time so pass-rate movement and drift score stay readable.
            </p>
          </div>
          {driftViolations.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200">
              <AlertTriangle size={13} />
              {driftViolations.length} threshold violation
              {driftViolations.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="mt-5 max-w-sm">
          <select
            className="select"
            value={selectedSuiteId}
            onChange={(event) => selectSuite(event.target.value)}
          >
            <option value="">Select a suite...</option>
            {suites.map((suite) => (
              <option key={suite.id} value={suite.id}>
                {suite.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!selectedSuiteId ? (
        <EmptyStatePanel
          icon={Activity}
          title="Select a suite to unlock the monitoring story"
          description="Pick a suite to see pass-rate movement, drift score changes, and the historical runs that explain where the baseline started moving."
          actions={
            <Link
              to={APP_ROUTES.suites}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Play size={16} />
              Open suites
            </Link>
          }
        />
      ) : loading ? (
        <div className="flex h-56 items-center justify-center rounded-[24px] border border-surface-700 bg-surface-800/80">
          <Loader2 className="animate-spin text-drift-400" size={32} />
        </div>
      ) : timeline.length === 0 ? (
        <EmptyStatePanel
          icon={TrendingDown}
          title="No timeline data yet"
          description="Run this suite a few times to build enough history for pass-rate and drift trends to become meaningful."
          actions={
            <Link
              to={APP_ROUTES.suites}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Play size={16} />
              Trigger from suites
            </Link>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SignalCard
              label="Timeline points"
              value={String(timeline.length)}
              helper="Saved historical measurements in the current view"
              icon={Activity}
              tone="blue"
            />
            <SignalCard
              label="Average pass rate"
              value={`${avgPassRate}%`}
              helper="Average quality level across the visible timeline"
              icon={Sparkles}
              tone={
                avgPassRate >= 90 ? "green" : avgPassRate >= 70 ? "amber" : "red"
              }
            />
            <SignalCard
              label="Peak drift"
              value={peakDrift.toFixed(3)}
              helper="Highest recorded drift score in this timeline"
              icon={TrendingDown}
              tone={peakDrift > DRIFT_THRESHOLD ? "red" : "amber"}
            />
            <SignalCard
              label="Violations"
              value={String(driftViolations.length)}
              helper="Points above the configured drift threshold"
              icon={AlertTriangle}
              tone={
                driftViolations.length === 0
                  ? "green"
                  : driftViolations.length >= 2
                    ? "red"
                    : "amber"
              }
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="surface-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Quality trend
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Pass rate over time
                  </h2>
                  <p className="mt-2 text-sm text-gray-400">
                    This is the quickest visual read on whether quality is slipping, steady, or recovering.
                  </p>
                </div>
                <span className="surface-chip">Threshold at 70%</span>
              </div>

              <div className="mt-6 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                      contentStyle={{
                        backgroundColor: "#0f172b",
                        border: "1px solid #243454",
                        borderRadius: "14px",
                        color: "#e5edf9",
                      }}
                      formatter={(value: number) => [`${value}%`, "Pass rate"]}
                      labelStyle={{ color: "#9fb2d6" }}
                    />
                    <ReferenceLine
                      y={70}
                      stroke="#ef4444"
                      strokeDasharray="6 4"
                      label={{
                        value: "Minimum threshold",
                        fill: "#ef4444",
                        fontSize: 11,
                      }}
                    />
                    {driftViolations.map((violation, index) => {
                      const point = chartData.find((entry) => entry.run_id === violation.run_id);
                      if (!point) {
                        return null;
                      }

                      return (
                        <ReferenceArea
                          key={index}
                          x1={point.date}
                          x2={point.date}
                          fill="#ef4444"
                          fillOpacity={0.08}
                        />
                      );
                    })}
                    <Line
                      type="monotone"
                      dataKey="pass_rate_pct"
                      stroke="#4f7cff"
                      strokeWidth={3}
                      dot={{ fill: "#4f7cff", stroke: "#101a31", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: "#90b0ff", stroke: "#101a31", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Drift pressure
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Drift score over time
                  </h2>
                  <p className="mt-2 text-sm text-gray-400">
                    Drift score shows how far the suite is moving from baseline even before the pass rate fully collapses.
                  </p>
                </div>
                <span className="surface-chip">
                  Threshold at {DRIFT_THRESHOLD.toFixed(1)}
                </span>
              </div>

              <div className="mt-6 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="timelineDriftFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
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
                      domain={[0, 1]}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172b",
                        border: "1px solid #243454",
                        borderRadius: "14px",
                        color: "#e5edf9",
                      }}
                      formatter={(value: number) => [
                        value.toFixed(3),
                        "Drift score",
                      ]}
                      labelStyle={{ color: "#9fb2d6" }}
                    />
                    <ReferenceLine
                      y={DRIFT_THRESHOLD}
                      stroke="#f59e0b"
                      strokeDasharray="6 4"
                      label={{
                        value: "Threshold",
                        fill: "#f59e0b",
                        fontSize: 11,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="drift_score"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fill="url(#timelineDriftFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="surface-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Historical feed
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Historical runs
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Use this table to tie the chart back to the specific run that moved the baseline.
                </p>
              </div>
              <span className="surface-chip">
                {runs.length} run{runs.length === 1 ? "" : "s"} in timeline scope
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="table-header">Run</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Pass rate</th>
                    <th className="table-header">Tests</th>
                    <th className="table-header">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, index) => {
                    const runTimestamp = getRunTimestamp(run);

                    return (
                      <tr
                        key={run.id}
                        className="border-b border-surface-700/50 transition-colors hover:bg-surface-800/60"
                      >
                        <td className="table-cell">
                          <div className="min-w-[160px]">
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
                            <p className="mt-1 text-xs text-gray-500">
                              {run.status === "failed" || run.status === "error"
                                ? "Worth comparing against calmer points"
                                : "Useful baseline reference"}
                            </p>
                          </div>
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={run.status} />
                        </td>
                        <td className="table-cell">
                          {run.pass_rate != null ? (
                            <span
                              className={
                                run.pass_rate >= 90
                                  ? "text-emerald-400"
                                  : run.pass_rate >= 70
                                    ? "text-amber-400"
                                    : "text-red-400"
                              }
                            >
                              {run.pass_rate}%
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className="text-emerald-400">
                            {run.passed_tests}
                          </span>
                          <span className="text-gray-500"> / </span>
                          {run.total_tests}
                        </td>
                        <td className="table-cell text-gray-400">
                          {runTimestamp ? format(runTimestamp, "MMM dd, HH:mm") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
