import { useEffect, useEffectEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Loader2,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import EmptyStatePanel from "@/components/EmptyStatePanel";
import InlineBanner from "@/components/InlineBanner";
import PageHero from "@/components/PageHero";
import SignalCard from "@/components/SignalCard";
import StatusBadge from "@/components/StatusBadge";
import { getApiErrorMessage, getRun, triggerRun } from "@/api";
import {
  monitoringToneStyles,
  type MonitoringTone,
} from "@/lib/monitoringTone";
import { APP_ROUTES } from "@/lib/routes";
import type { AssertionResult, BannerState, TestResult, TestRun } from "@/types";

const ACTIVE_RUN_STATUSES = new Set(["pending", "running"]);

interface RunPosture {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight: string;
}

function buildRunPosture(run: TestRun): RunPosture {
  if (run.status === "pending") {
    return {
      tone: "active",
      label: "In motion",
      title: "This run is queued and waiting to start producing signal",
      description:
        "The evaluator accepted the run. Keep this page open and it will refresh automatically as execution begins and results arrive.",
      insight:
        "Queued runs are mostly about patience. The real question is whether the newest signal lands healthy once execution starts.",
    };
  }

  if (run.status === "running") {
    return {
      tone: "active",
      label: "In motion",
      title: "Fresh evaluation output is being collected right now",
      description:
        "This run is actively executing and the detail view refreshes automatically so the result set settles without a manual reload.",
      insight:
        "When a run is still moving, focus on whether failures appear early or the full suite eventually stabilizes into a passing result.",
    };
  }

  if (run.status === "passed") {
    return {
      tone: "healthy",
      label: "Healthy",
      title: "This run completed cleanly and can serve as a strong baseline",
      description:
        "Assertions passed, the run finished successfully, and the saved results are ready to use as a comparison point for later drift or regressions.",
      insight:
        "Healthy runs matter because they tell you what good looks like. When the next regression lands, compare back to this shape.",
    };
  }

  if (run.status === "error") {
    return {
      tone: "attention",
      label: "Needs attention",
      title: "Execution failed before the run could settle into a clean result",
      description:
        "The evaluator could not complete the run successfully. Review any saved result rows first, then retry the suite if needed.",
      insight:
        "Execution errors are different from assertion failures: the problem is often provider access, malformed setup, or runtime execution rather than prompt quality.",
    };
  }

  return {
    tone: "attention",
    label: "Needs attention",
    title: "This run finished with failures worth investigating",
    description:
      "The suite completed, but one or more tests failed. Start with the most informative failed assertion and compare it against the passing tests.",
    insight:
      "A failed run is most useful when it points quickly to a concrete problem. Prioritize the first failed test that includes a meaningful execution message.",
  };
}

function getPrimaryIssue(run: TestRun): {
  title: string;
  message: string;
  testName?: string;
} | null {
  const failedResult = run.results?.find((result) => !result.passed);
  if (!failedResult) {
    return null;
  }

  const failedAssertion = failedResult.assertions.find((assertion) => !assertion.passed);
  if (failedAssertion?.message) {
    return {
      title: failedAssertion.type === "execution_error"
        ? "Execution error surfaced in the result set"
        : "Assertion failure needs review",
      message: failedAssertion.message,
      testName: failedResult.test_name,
    };
  }

  return {
    title: "A test finished failed in this run",
    message: "Inspect the failing result row below to compare output, expected values, and assertion behavior.",
    testName: failedResult.test_name,
  };
}

function AssertionRow({ assertion }: { assertion: AssertionResult }) {
  return (
    <div className="rounded-xl border border-surface-700/80 bg-surface-950/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {assertion.passed ? (
            <Check size={14} className="text-emerald-400" />
          ) : (
            <X size={14} className="text-red-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-200">
              {assertion.name}
            </span>
            <span className="rounded-full bg-surface-800 px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-400">
              {assertion.type}
            </span>
          </div>
          {!assertion.passed && assertion.message && (
            <p className="mt-2 text-sm text-red-300">{assertion.message}</p>
          )}
          {(assertion.expected || assertion.actual) && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {assertion.expected && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Expected
                  </span>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-surface-700 bg-surface-950 p-3 text-xs text-emerald-300">
                    {assertion.expected}
                  </pre>
                </div>
              )}
              {assertion.actual && (
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Actual
                  </span>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-surface-700 bg-surface-950 p-3 text-xs text-red-300">
                    {assertion.actual}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(!result.passed);
  const passedAssertions = result.assertions.filter((item) => item.passed).length;

  return (
    <article className="rounded-[22px] border border-surface-700/80 bg-surface-950/35 p-5 transition-colors hover:border-surface-600">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-white">
              {expanded ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
              <h3 className="text-lg font-semibold">{result.test_name}</h3>
            </div>
            <span className="rounded-full border border-surface-700 bg-surface-900/70 px-3 py-1 text-xs font-medium text-gray-300">
              {result.model}
            </span>
            <span
              className={clsx(
                "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                result.passed
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-200",
              )}
            >
              {result.passed ? "Passed" : "Failed"}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {result.passed
              ? "This test landed cleanly. Keep it as a reference point when later runs drift."
              : "This test is the best place to inspect output, assertions, and execution messages."}
          </p>
        </div>

        <div className="grid shrink-0 gap-2 text-right text-xs text-gray-500 sm:grid-cols-3 sm:text-left">
          <div className="min-w-[84px] rounded-xl bg-surface-900/70 px-3 py-2">
            <p>Latency</p>
            <p className="mt-1 text-sm font-medium text-white">
              {result.latency_ms != null ? `${result.latency_ms.toFixed(1)}ms` : "-"}
            </p>
          </div>
          <div className="min-w-[84px] rounded-xl bg-surface-900/70 px-3 py-2">
            <p>Tokens</p>
            <p className="mt-1 text-sm font-medium text-white">
              {result.tokens_used ?? 0}
            </p>
          </div>
          <div className="min-w-[84px] rounded-xl bg-surface-900/70 px-3 py-2">
            <p>Assertions</p>
            <p className="mt-1 text-sm font-medium text-white">
              {passedAssertions}/{result.assertions.length}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-5 space-y-4 border-t border-surface-700/70 pt-5">
          <div className="surface-panel-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Model output
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-surface-700 bg-surface-950 p-4 text-sm text-gray-300">
              {result.output || "No output captured."}
            </pre>
          </div>

          {result.assertions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Assertions
              </p>
              <div className="mt-3 space-y-3">
                {result.assertions.map((assertion, index) => (
                  <AssertionRow key={index} assertion={assertion} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [fetchError, setFetchError] = useState<BannerState | null>(null);
  const currentStatus = run?.status;

  const loadRun = useEffectEvent(async (options?: { manual?: boolean }) => {
    if (!id) {
      return;
    }

    if (options?.manual) {
      setRefreshing(true);
    } else if (!run) {
      setLoading(true);
    }

    try {
      const nextRun = await getRun(id);
      setRun(nextRun);
      setFetchError(null);
    } catch (error) {
      setFetchError({
        variant: "error",
        title: "Unable to load run",
        message: getApiErrorMessage(error, "The run details could not be loaded."),
      });
      if (!run) {
        setRun(null);
      }
    } finally {
      setLoading(false);
      if (options?.manual) {
        setRefreshing(false);
      }
    }
  });

  useEffect(() => {
    setRun(null);
    setFetchError(null);
    setLoading(true);
    void loadRun();
  }, [id, loadRun]);

  useEffect(() => {
    if (!currentStatus || !ACTIVE_RUN_STATUSES.has(currentStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadRun();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentStatus, loadRun]);

  async function handleRefresh() {
    await loadRun({ manual: true });
  }

  async function handleRerun() {
    if (!run) {
      return;
    }

    setRerunning(true);
    try {
      const nextRun = await triggerRun(run.suite_id);
      navigate(APP_ROUTES.run(nextRun.id));
    } catch (error) {
      setFetchError({
        variant: "error",
        title: "Unable to start rerun",
        message: getApiErrorMessage(error, "The suite could not be rerun."),
      });
    } finally {
      setRerunning(false);
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

  if (!run) {
    return (
      <div className="space-y-6">
        {fetchError && (
          <InlineBanner {...fetchError} onDismiss={() => setFetchError(null)} />
        )}
        <EmptyStatePanel
          icon={AlertTriangle}
          title="Run not found"
          description="This run could not be loaded. Return to the feed and open another run once the API is reachable."
          actions={
            <Link
              to={APP_ROUTES.runs}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to runs
            </Link>
          }
        />
      </div>
    );
  }

  const posture = buildRunPosture(run);
  const postureTone = monitoringToneStyles[posture.tone];
  const hasResults = Boolean(run.results && run.results.length > 0);
  const results = run.results ?? [];
  const totalTokens = results.reduce(
    (sum, result) => sum + (result.tokens_used ?? 0),
    0,
  );
  const totalCost = results.reduce(
    (sum, result) => sum + (result.cost ?? 0),
    0,
  );
  const primaryIssue = getPrimaryIssue(run);
  const postureItems: Array<{
    label: string;
    value: string;
    helper: string;
    tone: MonitoringTone;
  }> = [
    {
      label: "Suite",
      value: run.suite_name || run.suite_id.slice(0, 8),
      helper: run.id,
      tone: "quiet",
    },
    {
      label: "Trigger",
      value: run.trigger,
      helper: run.started_at
        ? `Started ${format(new Date(run.started_at), "MMM dd, HH:mm:ss")}`
        : "Start time not recorded yet",
      tone: ACTIVE_RUN_STATUSES.has(run.status) ? "active" : "quiet",
    },
    {
      label: "Primary issue",
      value: primaryIssue ? primaryIssue.title : "None surfaced",
      helper: primaryIssue?.testName
        ? `Focused on ${primaryIssue.testName}`
        : run.status === "passed"
          ? "Nothing in the results currently needs review"
          : "Open the result cards below for the strongest signal",
      tone: primaryIssue ? "attention" : run.status === "passed" ? "healthy" : posture.tone,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHero
        tone={posture.tone}
        label={posture.label}
        title={posture.title}
        description={posture.description}
        insight={posture.insight}
        badgeIcon={Sparkles}
        meta={<StatusBadge status={run.status} />}
        actions={
          <>
            <Link
              to={APP_ROUTES.runs}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to runs
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw size={15} className={clsx(refreshing && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RotateCw size={15} className={clsx(rerunning && "animate-spin")} />
              Re-run suite
            </button>
          </>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Run posture
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Operational summary
                </h2>
              </div>
              <div className={clsx("rounded-2xl p-3", postureTone.icon)}>
                <Play size={20} />
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

      {fetchError && (
        <InlineBanner {...fetchError} onDismiss={() => setFetchError(null)} />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          label="Pass rate"
          value={run.pass_rate != null ? `${run.pass_rate}%` : "Pending"}
          helper={
            run.pass_rate != null
              ? "Overall quality outcome for this run"
              : "Appears once results settle"
          }
          icon={Sparkles}
          tone={
            run.pass_rate == null
              ? "violet"
              : run.pass_rate >= 90
                ? "green"
                : run.pass_rate >= 70
                  ? "amber"
                  : "red"
          }
        />
        <SignalCard
          label="Tests"
          value={`${run.passed_tests}/${run.total_tests}`}
          helper={
            run.failed_tests > 0
              ? `${run.failed_tests} test${run.failed_tests === 1 ? "" : "s"} failed`
              : "No failing tests in the saved results"
          }
          icon={Check}
          tone={run.failed_tests > 0 ? "red" : "green"}
        />
        <SignalCard
          label="Tokens used"
          value={hasResults ? String(totalTokens) : "Pending"}
          helper={
            hasResults
              ? "Sum of token usage across saved result rows"
              : "Token totals appear once results are saved"
          }
          icon={Zap}
          tone={hasResults ? "blue" : "violet"}
        />
        <SignalCard
          label="Total cost"
          value={hasResults ? `$${totalCost.toFixed(4)}` : "Pending"}
          helper={
            hasResults
              ? "Aggregate cost across saved result rows"
              : "Cost is available when model pricing is configured"
          }
          icon={Coins}
          tone={hasResults ? "amber" : "violet"}
        />
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Lifecycle
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Run timing and execution context
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Timing context helps distinguish a prompt-quality issue from a provider or execution issue.
            </p>
          </div>
          <span className="surface-chip">
            {run.duration_ms != null
              ? `${(run.duration_ms / 1000).toFixed(1)}s total duration`
              : "Duration still settling"}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="surface-panel-muted p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Started</p>
            <p className="mt-2 text-sm font-medium text-white">
              {run.started_at
                ? format(new Date(run.started_at), "MMM dd, yyyy HH:mm:ss")
                : "Not recorded"}
            </p>
          </div>
          <div className="surface-panel-muted p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Completed
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {run.completed_at
                ? format(new Date(run.completed_at), "MMM dd, yyyy HH:mm:ss")
                : ACTIVE_RUN_STATUSES.has(run.status)
                  ? "Still running"
                  : "Not recorded"}
            </p>
          </div>
          <div className="surface-panel-muted p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">Trigger</p>
            <p className="mt-2 text-sm font-medium capitalize text-white">
              {run.trigger}
            </p>
          </div>
        </div>
      </section>

      {primaryIssue && (
        <section className="surface-panel p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Failure spotlight
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {primaryIssue.title}
              </h2>
              {primaryIssue.testName && (
                <p className="mt-2 text-sm text-gray-400">
                  Focused on <span className="font-medium text-gray-200">{primaryIssue.testName}</span>
                </p>
              )}
              <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-300">
                {primaryIssue.message}
              </p>
            </div>
          </div>
        </section>
      )}

      {hasResults ? (
        <section className="surface-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Diagnostic output
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Test results
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Open the result cards to compare raw output, assertion outcomes, and execution context without leaving the page.
              </p>
            </div>
            <span className="surface-chip">
              {results.length} result row{results.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyStatePanel
          icon={ACTIVE_RUN_STATUSES.has(run.status) ? Loader2 : Play}
          title={
            ACTIVE_RUN_STATUSES.has(run.status)
              ? "Waiting for results"
              : run.status === "error"
                ? "This run failed before results were saved"
                : "No test results were saved for this run"
          }
          description={
            ACTIVE_RUN_STATUSES.has(run.status)
              ? "The run is still active and this page is polling automatically. Results will appear here as soon as the evaluator saves them."
              : run.status === "error"
                ? "Execution stopped before saved result rows were produced. Retry the suite once the underlying issue is resolved."
                : "This run finished without stored result rows. Re-run the suite if you need a fresh diagnostic baseline."
          }
          actions={
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="btn-primary inline-flex items-center gap-2"
            >
              {rerunning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RotateCw size={16} />
              )}
              Re-run suite
            </button>
          }
        />
      )}
    </div>
  );
}
