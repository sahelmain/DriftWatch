import { useEffect, useEffectEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Loader2,
  RefreshCw,
  RotateCw,
  X,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";
import { getApiErrorMessage, getRun, triggerRun } from "@/api";
import InlineBanner from "@/components/InlineBanner";
import StatusBadge from "@/components/StatusBadge";
import type { AssertionResult, BannerState, TestResult, TestRun } from "@/types";
import { APP_ROUTES } from "@/lib/routes";

const ACTIVE_RUN_STATUSES = new Set(["pending", "running"]);

function AssertionRow({ assertion }: { assertion: AssertionResult }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-surface-900/50 px-4 py-2">
      <div className="mt-0.5">
        {assertion.passed ? (
          <Check size={14} className="text-emerald-400" />
        ) : (
          <X size={14} className="text-red-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            {assertion.name}
          </span>
          <span className="rounded bg-surface-800 px-2 py-0.5 text-xs text-gray-500">
            {assertion.type}
          </span>
        </div>
        {!assertion.passed && assertion.message && (
          <p className="mt-1 text-xs text-red-400">{assertion.message}</p>
        )}
        {assertion.expected && (
          <div className="mt-2 grid gap-3 text-xs md:grid-cols-2">
            <div>
              <span className="text-gray-500">Expected</span>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-950 p-2 text-emerald-300">
                {assertion.expected}
              </pre>
            </div>
            {assertion.actual && (
              <div>
                <span className="text-gray-500">Actual</span>
                <pre className="mt-1 overflow-x-auto rounded bg-surface-950 p-2 text-red-300">
                  {assertion.actual}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ result }: { result: TestResult }) {
  const [expanded, setExpanded] = useState(!result.passed);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-surface-700/50 transition-colors hover:bg-surface-800/50"
        onClick={() => setExpanded((current) => !current)}
      >
        <td className="table-cell">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )}
            <span className="font-medium text-white">{result.test_name}</span>
          </div>
        </td>
        <td className="table-cell">
          <span className="rounded bg-surface-700 px-2 py-0.5 font-mono text-xs text-gray-300">
            {result.model}
          </span>
        </td>
        <td className="table-cell">
          {result.passed ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Check size={15} />
              Passed
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-red-400">
              <X size={15} />
              Failed
            </div>
          )}
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Clock size={13} className="text-gray-500" />
            {result.latency_ms != null ? `${result.latency_ms.toFixed(1)}ms` : "Pending"}
          </div>
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Zap size={13} className="text-gray-500" />
            {result.tokens_used ?? 0}
          </div>
        </td>
        <td className="table-cell">
          {result.cost != null ? (
            <div className="flex items-center gap-1.5 text-gray-300">
              <Coins size={13} className="text-gray-500" />$
              {result.cost.toFixed(4)}
            </div>
          ) : (
            <span className="text-gray-500">-</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-surface-900/30 px-4 py-4">
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Model output
                </span>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-surface-700 bg-surface-950 p-4 text-sm text-gray-300">
                  {result.output || "No output captured."}
                </pre>
              </div>

              {result.assertions.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Assertions ({result.assertions.filter((item) => item.passed).length}/
                    {result.assertions.length} passed)
                  </span>
                  <div className="mt-2 space-y-2">
                    {result.assertions.map((assertion, index) => (
                      <AssertionRow key={index} assertion={assertion} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function getStatusBanner(run: TestRun): BannerState | null {
  if (run.status === "pending") {
    return {
      variant: "info",
      title: "Run queued",
      message: "The evaluator has accepted the run and this page will refresh automatically.",
    };
  }

  if (run.status === "running") {
    return {
      variant: "info",
      title: "Evaluation in progress",
      message: "Results are being collected now. This page refreshes every 2 seconds.",
    };
  }

  if (run.status === "error") {
    return {
      variant: "error",
      title: "Run execution failed",
      message: "The run did not complete successfully. Check the saved result rows or retry the suite.",
    };
  }

  return null;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [fetchError, setFetchError] = useState<BannerState | null>(null);

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
  }, [id]);

  useEffect(() => {
    if (!run || !ACTIVE_RUN_STATUSES.has(run.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadRun();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [run?.status]);

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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-drift-400" size={32} />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-6">
        {fetchError && (
          <InlineBanner {...fetchError} onDismiss={() => setFetchError(null)} />
        )}
        <div className="card p-16 text-center">
          <h3 className="text-lg font-medium text-gray-300">Run not found</h3>
          <Link
            to={APP_ROUTES.runs}
            className="mt-2 inline-block text-drift-400 hover:text-drift-300"
          >
            Back to runs
          </Link>
        </div>
      </div>
    );
  }

  const statusBanner = getStatusBanner(run);
  const hasResults = Boolean(run.results && run.results.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={APP_ROUTES.runs}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-surface-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {run.suite_name || "Run details"}
            </h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-400">{run.id}</p>
        </div>
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
          className="btn-secondary inline-flex items-center gap-2"
        >
          <RotateCw size={15} className={clsx(rerunning && "animate-spin")} />
          Re-run
        </button>
      </div>

      {fetchError && (
        <InlineBanner {...fetchError} onDismiss={() => setFetchError(null)} />
      )}
      {statusBanner && <InlineBanner {...statusBanner} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Pass rate
          </p>
          <p
            className={clsx("mt-1 text-2xl font-bold", {
              "text-emerald-400": (run.pass_rate ?? 0) >= 90,
              "text-amber-400":
                (run.pass_rate ?? 0) >= 70 && (run.pass_rate ?? 0) < 90,
              "text-red-400": (run.pass_rate ?? 0) < 70,
            })}
          >
            {run.pass_rate != null ? `${run.pass_rate}%` : "-"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400">Tests</p>
          <p className="mt-1 text-2xl font-bold text-white">
            <span className="text-emerald-400">{run.passed_tests}</span>
            <span className="text-lg text-gray-500"> / {run.total_tests}</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Trigger
          </p>
          <p className="mt-1 text-2xl font-bold capitalize text-white">
            {run.trigger}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Duration
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {run.duration_ms != null
              ? `${(run.duration_ms / 1000).toFixed(1)}s`
              : "-"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
        {run.started_at && (
          <span>
            Started: {format(new Date(run.started_at), "MMM dd, yyyy HH:mm:ss")}
          </span>
        )}
        {run.completed_at && (
          <span>
            Completed: {format(new Date(run.completed_at), "MMM dd, yyyy HH:mm:ss")}
          </span>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold text-white">Test results</h2>
        </div>
        {hasResults ? (
          <div className="overflow-x-auto">
            <table className="mt-4 w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="table-header">Test name</th>
                  <th className="table-header">Model</th>
                  <th className="table-header">Result</th>
                  <th className="table-header">Latency</th>
                  <th className="table-header">Tokens</th>
                  <th className="table-header">Cost</th>
                </tr>
              </thead>
              <tbody>
                {run.results?.map((result) => (
                  <ResultRow key={result.id} result={result} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            {ACTIVE_RUN_STATUSES.has(run.status)
              ? "Waiting for results..."
              : run.status === "error"
                ? "This run failed before any results were saved."
                : "No test results were saved for this run."}
          </div>
        )}
      </div>
    </div>
  );
}
