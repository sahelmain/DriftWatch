import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/AuthContext";
import { APP_ROUTES, PUBLIC_ROUTES } from "@/lib/routes";
import {
  publicDemoHighlights,
  publicDemoRuns,
  publicDemoSuite,
  publicDemoTimeline,
} from "@/lib/publicDemo";

const chartData = publicDemoTimeline.map((point) => ({
  ...point,
  dateLabel: format(new Date(point.date), "MMM dd"),
  passRatePct: Math.round(point.pass_rate * 100),
}));

export default function PublicDemoPage() {
  const { token } = useAuth();
  const ctaHref = token ? APP_ROUTES.root : PUBLIC_ROUTES.login;

  return (
    <div className="min-h-screen bg-surface-950 text-gray-100">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to={PUBLIC_ROUTES.home}
              className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
            >
              <ArrowLeft size={15} />
              Back to overview
            </Link>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">
              Read-only product demo
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-gray-300">
              This demo uses a support-assistant QA suite to show exactly how
              DriftWatch grades AI outputs and tracks quality change across runs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to={PUBLIC_ROUTES.truthfulQaResearch}
              className="btn-secondary inline-flex items-center gap-2"
            >
              From benchmark finding to production monitoring
              <BarChart3 size={15} />
            </Link>
            <Link to={ctaHref} className="btn-primary inline-flex items-center gap-2">
              {token ? "Open the app" : "Sign in to build your own"}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="card p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                Suite definition
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {publicDemoSuite.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-300">
                {publicDemoSuite.tagline}
              </p>
              <p className="mt-4 rounded-2xl border border-surface-700 bg-surface-900/80 p-4 text-sm leading-7 text-gray-300">
                {publicDemoSuite.problem}
              </p>

              <div className="mt-6 grid gap-3">
                {publicDemoHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm text-gray-200">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                Suite YAML
              </p>
              <pre className="mt-4 overflow-x-auto rounded-2xl border border-surface-700 bg-surface-950 p-5 text-sm leading-7 text-gray-200">
                {publicDemoSuite.yaml}
              </pre>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Latest status
                </p>
                <div className="mt-3">
                  <StatusBadge status="failed" />
                </div>
              </div>
              <div className="card p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Quality signal
                </p>
                <p className="mt-2 text-2xl font-semibold text-red-300">0%</p>
              </div>
              <div className="card p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Why it failed
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-300">
                  It skipped required refund language and promised something the business cannot guarantee.
                </p>
              </div>
            </div>

            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Pass rate over time</h2>
                  <p className="text-sm text-gray-400">
                    Drift here means the suite’s pass rate changed between runs.
                  </p>
                </div>
                <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                  Drift threshold crossed
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" stroke="#607192" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#607192"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10182b",
                      border: "1px solid #27324a",
                      borderRadius: "12px",
                    }}
                    formatter={(value: number) => [`${value}%`, "Pass rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="passRatePct"
                    stroke="#3b6eff"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b6eff" }}
                    activeDot={{ r: 6, fill: "#74a2ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Drift score</h2>
                  <p className="text-sm text-gray-400">
                    A larger number means quality changed more sharply from the previous run.
                  </p>
                </div>
                <div className="rounded-full border border-surface-600 bg-surface-900 px-3 py-1 text-sm text-gray-300">
                  Current spike: 1.0
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="#1e2d4a" strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" stroke="#607192" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} stroke="#607192" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10182b",
                      border: "1px solid #27324a",
                      borderRadius: "12px",
                    }}
                    formatter={(value: number) => [value.toFixed(2), "Drift score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="drift_score"
                    stroke="#f59e0b"
                    fill="#f59e0b33"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          {publicDemoRuns.map((run) => {
            const result = run.results?.[0];

            return (
              <div key={run.id} className="card overflow-hidden">
                <div className="border-b border-surface-700 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                        Sample run
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {run.status === "passed" ? "Compliant reply" : "Failed reply"}
                      </h2>
                      <p className="mt-1 text-sm text-gray-400">
                        {format(new Date(run.started_at ?? run.created_at ?? Date.now()), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock3 size={14} />
                        Latency
                      </div>
                      <p className="mt-2 font-medium text-white">
                        {result?.latency_ms != null ? `${result.latency_ms.toFixed(1)}ms` : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Zap size={14} />
                        Tokens
                      </div>
                      <p className="mt-2 font-medium text-white">{result?.tokens_used ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Activity size={14} />
                        Pass rate
                      </div>
                      <p className="mt-2 font-medium text-white">{run.pass_rate}%</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Model output
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-surface-700 bg-surface-950 p-4 text-sm leading-7 text-gray-200">
                    {result?.output}
                  </pre>
                </div>

                <div className="border-t border-surface-700 px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Assertions
                  </p>
                  <div className="mt-4 space-y-3">
                    {result?.assertions.map((assertion, index) => (
                      <div
                        key={`${assertion.type}-${index}`}
                        className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{assertion.type}</p>
                            {assertion.message && (
                              <p className="mt-1 text-sm text-red-300">{assertion.message}</p>
                            )}
                          </div>
                          <StatusBadge status={assertion.passed ? "passed" : "failed"} />
                        </div>
                        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                          {assertion.expected && (
                            <div>
                              <p className="text-gray-500">Expected</p>
                              <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-emerald-300">
                                {assertion.expected}
                              </pre>
                            </div>
                          )}
                          {assertion.actual && (
                            <div>
                              <p className="text-gray-500">Actual</p>
                              <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-950 p-3 text-xs text-red-300">
                                {assertion.actual}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">What this proves</h2>
              <p className="mt-1 text-sm text-gray-400">
                DriftWatch is not a chatbot. It is a full-stack product for testing and monitoring AI behavior.
              </p>
            </div>
            <Link to={ctaHref} className="btn-primary inline-flex items-center gap-2">
              {token ? "Open app" : "Sign in to build your own"}
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              "Define product rules with supported assertions",
              "Run suites and inspect exact outputs, latency, and pass/fail reasons",
              "Track whether quality changes across repeated runs",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-surface-700 bg-surface-900 px-4 py-4 text-sm leading-7 text-gray-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-amber-500/25 bg-amber-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-200">
                <BarChart3 size={18} />
                From benchmark finding to production monitoring
              </div>
              <h2 className="mt-3 max-w-3xl text-xl font-semibold text-white">
                The TruthfulQA study shows that model failures cluster by category.
                This demo shows how DriftWatch turns that lesson into repeatable
                pass/fail checks, stored outputs, and drift tracking.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to={PUBLIC_ROUTES.truthfulQaResearch}
                className="btn-primary inline-flex items-center gap-2"
              >
                View research map
                <ArrowRight size={15} />
              </Link>
              <a
                href="https://github.com/sahelmain/llm-hallucination-phoenix"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary inline-flex items-center gap-2"
              >
                Paper repo
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
