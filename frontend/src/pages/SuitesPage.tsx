import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Clock3,
  FlaskConical,
  Loader2,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  deleteSuite,
  getApiErrorMessage,
  getRuns,
  getSuites,
  triggerRun,
} from "@/api";
import EmptyStatePanel from "@/components/EmptyStatePanel";
import InlineBanner from "@/components/InlineBanner";
import PageHero from "@/components/PageHero";
import SignalCard from "@/components/SignalCard";
import StatusBadge from "@/components/StatusBadge";
import {
  monitoringToneStyles,
  type MonitoringTone,
  type SignalTone,
} from "@/lib/monitoringTone";
import { getRunTimestamp } from "@/runTimestamps";
import type { BannerState, Suite, TestRun } from "@/types";

interface SuitesLocationState {
  banner?: BannerState;
}

interface SuitesHealth {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight: string;
}

interface SuiteSignal {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: SignalTone;
}

function buildSuitesHealth(suites: Suite[], recentRuns: TestRun[]): SuitesHealth {
  const scheduledSuites = suites.filter((suite) => Boolean(suite.schedule_cron));
  const activeRuns = recentRuns.filter(
    (run) => run.status === "pending" || run.status === "running",
  );
  const failingRuns = recentRuns.filter(
    (run) => run.status === "failed" || run.status === "error",
  );

  if (suites.length === 0) {
    return {
      tone: "quiet",
      label: "No recent signal",
      title: "Your suite roster is ready for a first monitoring baseline",
      description:
        "Suites define what DriftWatch should watch. Create one to start validating prompts, models, and regression risk from the web app.",
      insight:
        "Once suites are in place, this page becomes the fastest way to launch checks and see which monitors are active.",
    };
  }

  if (activeRuns.length > 0) {
    return {
      tone: "active",
      label: "In motion",
      title: "Fresh suite activity is already running through the system",
      description: `${activeRuns.length} suite run${
        activeRuns.length === 1 ? "" : "s"
      } ${
        activeRuns.length === 1 ? "is" : "are"
      } in progress right now. Use the suite list below to jump into the newest signal as it settles.`,
      insight:
        "When suites are active, the highest-value move is opening the newest run detail and checking whether the latest signal lands cleanly.",
    };
  }

  if (
    failingRuns.length >= Math.max(1, Math.ceil(recentRuns.length / 2)) &&
    recentRuns.length > 0
  ) {
    return {
      tone: "attention",
      label: "Needs attention",
      title: "Recent suite activity suggests a regression deserves review",
      description:
        "A meaningful share of recent runs finished failed or errored. Review the affected suite cards first so the newest issue is easy to isolate.",
      insight:
        "A healthy suite list should feel boring. When it looks noisy, the newest failing suite is usually the fastest path to a concrete fix.",
    };
  }

  if (failingRuns.length > 0) {
    return {
      tone: "watch",
      label: "Watchlist",
      title: "Your suite coverage is active, but some monitors need a closer look",
      description:
        "Most suites are configured and ready, but recent failures mean this page should be treated like a watchlist rather than a clean bill of health.",
      insight:
        "Use scheduled coverage as your baseline, then compare the newest failing suite against the quiet ones to see where quality diverges.",
    };
  }

  if (scheduledSuites.length > 0) {
    return {
      tone: "healthy",
      label: "Healthy",
      title: "Your suite roster is configured and ready to catch regressions",
      description:
        "Scheduled monitors are in place, manual suites are available, and nothing in the recent signal suggests immediate pressure.",
      insight:
        "The next step from here is depth: expand suite coverage where prompts or models are most likely to drift.",
    };
  }

  return {
    tone: "quiet",
    label: "No recent signal",
    title: "Suites are configured, but this workspace still needs execution signal",
    description:
      "You already have suite definitions in place. Trigger one run to turn this page from a setup view into an active monitoring console.",
    insight:
      "Manual suites are useful for quick validation. Scheduled suites make the page feel alive and keep drift visible over time.",
  };
}

function buildSuiteSignals(suites: Suite[], recentRuns: TestRun[]): SuiteSignal[] {
  const scheduledSuites = suites.filter((suite) => Boolean(suite.schedule_cron));
  const activeRuns = recentRuns.filter(
    (run) => run.status === "pending" || run.status === "running",
  ).length;
  const failingRuns = recentRuns.filter(
    (run) => run.status === "failed" || run.status === "error",
  ).length;

  return [
    {
      label: "Total suites",
      value: String(suites.length),
      helper:
        suites.length === 0
          ? "No monitors configured yet"
          : `${suites.length} suite${suites.length === 1 ? "" : "s"} ready to run`,
      icon: FlaskConical,
      tone: "blue",
    },
    {
      label: "Scheduled coverage",
      value: String(scheduledSuites.length),
      helper:
        scheduledSuites.length === 0
          ? "All suites are manual for now"
          : `${scheduledSuites.length} suite${
              scheduledSuites.length === 1 ? "" : "s"
            } on an automatic cadence`,
      icon: CalendarClock,
      tone: scheduledSuites.length > 0 ? "green" : "amber",
    },
    {
      label: "Recent failures",
      value: String(failingRuns),
      helper:
        failingRuns === 0
          ? "No failing runs in the latest window"
          : `${failingRuns} recent run${
              failingRuns === 1 ? "" : "s"
            } finished failed or errored`,
      icon: Activity,
      tone: failingRuns === 0 ? "green" : failingRuns >= 2 ? "red" : "amber",
    },
    {
      label: "Active runs",
      value: String(activeRuns),
      helper:
        activeRuns === 0
          ? "Nothing currently executing"
          : `${activeRuns} suite run${
              activeRuns === 1 ? "" : "s"
            } still collecting fresh output`,
      icon: Play,
      tone: activeRuns > 0 ? "amber" : "violet",
    },
  ];
}

export default function SuitesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [suites, setSuites] = useState<Suite[]>([]);
  const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [runningSuiteId, setRunningSuiteId] = useState<string | null>(null);
  const [deletingSuiteId, setDeletingSuiteId] = useState<string | null>(null);
  const [bannerActionLoading, setBannerActionLoading] = useState(false);

  useEffect(() => {
    const state = location.state as SuitesLocationState | null;
    if (state?.banner) {
      setBanner(state.banner);
      navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    void loadSuites();
  }, []);

  async function loadSuites() {
    setLoading(true);
    try {
      const [suiteData, runData] = await Promise.all([
        getSuites(),
        getRuns({ limit: 12 }),
      ]);
      setSuites(suiteData);
      setRecentRuns(runData.items);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to load suites",
        message: getApiErrorMessage(
          error,
          "The suite list could not be loaded.",
        ),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this suite?")) {
      return;
    }

    setDeletingSuiteId(id);
    try {
      await deleteSuite(id);
      setSuites((current) => current.filter((suite) => suite.id !== id));
      setBanner({
        variant: "success",
        title: "Suite deleted",
        message: "The suite was removed from the active list.",
      });
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to delete suite",
        message: getApiErrorMessage(
          error,
          "The suite could not be deleted.",
        ),
      });
    } finally {
      setDeletingSuiteId(null);
    }
  }

  async function handleRun(id: string) {
    if (runningSuiteId === id) {
      return;
    }

    setRunningSuiteId(id);
    try {
      const run = await triggerRun(id);
      navigate(`/runs/${run.id}`);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to start run",
        message: getApiErrorMessage(
          error,
          "The run could not be started.",
        ),
      });
    } finally {
      setRunningSuiteId(null);
    }
  }

  async function handleBannerAction() {
    if (!banner?.actionSuiteId) {
      return;
    }

    setBannerActionLoading(true);
    try {
      const run = await triggerRun(banner.actionSuiteId);
      navigate(`/runs/${run.id}`);
    } catch (error) {
      setBanner({
        variant: "error",
        title: "Unable to start run",
        message: getApiErrorMessage(
          error,
          "The run could not be started.",
        ),
      });
    } finally {
      setBannerActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-[28px] border border-surface-700 bg-surface-800/80 p-8">
          <div className="h-5 w-40 rounded bg-surface-700" />
          <div className="mt-4 h-10 w-2/3 rounded bg-surface-700" />
          <div className="mt-3 h-4 w-3/4 rounded bg-surface-700" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-[24px] border border-surface-700 bg-surface-800/80 p-5"
            >
              <div className="h-4 w-24 rounded bg-surface-700" />
              <div className="mt-3 h-8 w-24 rounded bg-surface-700" />
              <div className="mt-3 h-3 w-36 rounded bg-surface-700" />
            </div>
          ))}
        </div>
        <div className="flex h-48 items-center justify-center rounded-[24px] border border-surface-700 bg-surface-800/80">
          <Loader2 className="animate-spin text-drift-400" size={32} />
        </div>
      </div>
    );
  }

  const health = buildSuitesHealth(suites, recentRuns);
  const signals = buildSuiteSignals(suites, recentRuns);
  const healthTone = monitoringToneStyles[health.tone];
  const scheduledSuites = suites.filter((suite) => Boolean(suite.schedule_cron));
  const latestRun = recentRuns[0] ?? null;
  const latestRunTimestamp = latestRun ? getRunTimestamp(latestRun) : null;
  const latestRunBySuite = new Map<string, TestRun>();
  const postureItems: Array<{
    label: string;
    value: string;
    helper: string;
    tone: MonitoringTone;
  }> = [
    {
      label: "Scheduled monitors",
      value: `${scheduledSuites.length}`,
      helper:
        scheduledSuites.length === 0
          ? "Everything here is manual for now"
          : `${scheduledSuites.length} suite${
              scheduledSuites.length === 1 ? "" : "s"
            } will run automatically`,
      tone: scheduledSuites.length > 0 ? "healthy" : "quiet",
    },
    {
      label: "Latest activity",
      value: latestRun ? latestRun.status : "None yet",
      helper: latestRunTimestamp
        ? format(latestRunTimestamp, "MMM dd, HH:mm")
        : "Run a suite to start building signal",
      tone: latestRun
        ? latestRun.status === "passed"
          ? "healthy"
          : latestRun.status === "failed" || latestRun.status === "error"
            ? "attention"
            : "active"
        : "quiet",
    },
    {
      label: "Next best move",
      value: suites.length === 0 ? "Create suite" : "Open latest run",
      helper:
        suites.length === 0
          ? "Start with a supported template in the editor"
          : "Use recent failures and schedules to decide where to dig next",
      tone: suites.length === 0 ? "quiet" : health.tone,
    },
  ];

  for (const run of recentRuns) {
    if (!latestRunBySuite.has(run.suite_id)) {
      latestRunBySuite.set(run.suite_id, run);
    }
  }

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
            <button
              onClick={() => navigate("/suites/new")}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={16} />
              New suite
            </button>
            <button
              onClick={() => navigate("/runs")}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Play size={16} />
              Open runs
            </button>
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Suite posture
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  What this roster is telling you
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", healthTone.icon)}>
                <FlaskConical size={20} />
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

      {banner && (
        <InlineBanner
          {...banner}
          actionLoading={bannerActionLoading}
          onAction={banner.actionSuiteId ? handleBannerAction : undefined}
          onDismiss={() => setBanner(null)}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {signals.map((signal) => (
          <SignalCard key={signal.label} {...signal} />
        ))}
      </section>

      {suites.length === 0 ? (
        <EmptyStatePanel
          icon={FlaskConical}
          title="No suites are monitoring your app yet"
          description="Suites turn DriftWatch into a live quality console. Start with a guided template, validate the YAML, and launch the first run from the suite editor."
          actions={
            <>
              <button
                onClick={() => navigate("/suites/new")}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} />
                Create suite
              </button>
              <button
                onClick={() => navigate("/runs")}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Play size={16} />
                Open runs
              </button>
            </>
          }
        />
      ) : (
        <section className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Suite operations
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Active suite roster
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Launch checks, jump into timeline history, and keep coverage organized from one place.
              </p>
            </div>
            <span className="surface-chip">
              {suites.length} suite{suites.length === 1 ? "" : "s"} in workspace
            </span>
          </div>

          <div className="mt-5 space-y-3 p-4 pt-0">
            {suites.map((suite) => {
              const latestSuiteRun = latestRunBySuite.get(suite.id);
              const latestSuiteRunTimestamp = latestSuiteRun
                ? getRunTimestamp(latestSuiteRun)
                : null;

              return (
                <button
                  key={suite.id}
                  type="button"
                  onClick={() => navigate(`/timeline?suite=${suite.id}`)}
                  className="w-full rounded-[22px] border border-surface-700/80 bg-surface-950/35 p-5 text-left transition-all duration-150 hover:border-surface-600 hover:bg-surface-900/60"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 space-y-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-drift-500/10 text-drift-300">
                          <FlaskConical size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-white">
                              {suite.name}
                            </h3>
                            {suite.schedule_cron ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                                Scheduled
                              </span>
                            ) : (
                              <span className="rounded-full border border-surface-700 bg-surface-900/70 px-3 py-1 text-xs font-medium text-gray-300">
                                Manual
                              </span>
                            )}
                          </div>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                            {suite.description ||
                              "No description yet. Use the editor to document what this suite is protecting."}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="surface-panel-muted p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Schedule
                          </p>
                          <p className="mt-2 text-sm font-medium text-white">
                            {suite.schedule_cron || "Manual only"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {suite.schedule_cron
                              ? "Runs automatically on the configured cadence"
                              : "Launches only when triggered from the UI or API"}
                          </p>
                        </div>
                        <div className="surface-panel-muted p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Latest run
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {latestSuiteRun ? (
                              <>
                                <StatusBadge status={latestSuiteRun.status} />
                                <span className="text-xs text-gray-500">
                                  {latestSuiteRunTimestamp
                                    ? format(latestSuiteRunTimestamp, "MMM dd, HH:mm")
                                    : "Recent"}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-medium text-gray-300">
                                No recent run
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {latestSuiteRun?.pass_rate != null
                              ? `${latestSuiteRun.pass_rate}% pass rate on the newest signal`
                              : "Run this suite to create a baseline"}
                          </p>
                        </div>
                        <div className="surface-panel-muted p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Created
                          </p>
                          <p className="mt-2 text-sm font-medium text-white">
                            {format(new Date(suite.created_at), "MMM dd, yyyy")}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Updated {format(new Date(suite.updated_at), "MMM dd, HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex shrink-0 flex-wrap items-center gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => handleRun(suite.id)}
                        disabled={runningSuiteId === suite.id}
                        className="btn-primary inline-flex items-center gap-2"
                      >
                        {runningSuiteId === suite.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Play size={15} />
                        )}
                        {runningSuiteId === suite.id ? "Starting" : "Run suite"}
                      </button>
                      <button
                        onClick={() => navigate(`/suites/${suite.id}/edit`)}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(suite.id)}
                        disabled={deletingSuiteId === suite.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingSuiteId === suite.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                        Delete
                      </button>
                      <button
                        onClick={() => navigate(`/timeline?suite=${suite.id}`)}
                        className="inline-flex items-center gap-2 rounded-xl border border-surface-700 bg-surface-900/70 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-surface-600 hover:bg-surface-900"
                      >
                        Timeline
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
