import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  ShieldCheck,
  TimerReset,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { APP_ROUTES, PUBLIC_ROUTES } from "@/lib/routes";
import {
  publicDemoHighlights,
  publicDemoSuite,
  publicDemoTimeline,
} from "@/lib/publicDemo";

const chartData = publicDemoTimeline.map((point) => ({
  date: format(new Date(point.date), "MMM dd"),
  pass_rate: Math.round(point.pass_rate * 100),
}));

const whyItMatters = [
  {
    icon: ShieldCheck,
    title: "Check product rules, not vibes",
    body: "Verify that an AI reply includes required policy language and avoids unsafe promises.",
  },
  {
    icon: TimerReset,
    title: "Track reliability and latency",
    body: "See whether an assistant stays fast enough and consistent enough for a real customer workflow.",
  },
  {
    icon: Activity,
    title: "Catch quality drift over time",
    body: "Watch pass rate change across runs so regressions show up before users notice.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-gray-100">
      <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,110,255,0.18),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%)] pointer-events-none" />

      <header className="relative border-b border-surface-800/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-drift-500 to-drift-700 shadow-lg shadow-drift-950/40">
              <Activity className="text-white" size={20} />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">DriftWatch</p>
              <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                AI quality control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to={PUBLIC_ROUTES.demo} className="btn-secondary hidden sm:inline-flex">
              View Demo
            </Link>
            <Link to={APP_ROUTES.root} className="btn-primary inline-flex items-center gap-2">
              Open App
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-7xl gap-14 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-24">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-drift-500/20 bg-drift-500/10 px-3 py-1 text-sm text-drift-300">
              <span className="h-2 w-2 rounded-full bg-drift-400" />
              Shipped full-stack on Vercel + Koyeb
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
                Catch bad AI support answers before your users do.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-gray-300">
                DriftWatch tests AI outputs against product rules, stores every run,
                and shows when quality changes over time. It is QA and observability
                for AI features, not another chatbot shell.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={PUBLIC_ROUTES.demo}
                className="btn-primary inline-flex items-center gap-2 px-5 py-3"
              >
                View Live Demo
                <ArrowRight size={15} />
              </Link>
              <Link to={APP_ROUTES.root} className="btn-secondary inline-flex items-center gap-2 px-5 py-3">
                Open the App
              </Link>
              <Link
                to={PUBLIC_ROUTES.truthfulQaResearch}
                className="btn-secondary inline-flex items-center gap-2 px-5 py-3"
              >
                Research-backed LLM risk map
                <BarChart3 size={15} />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {publicDemoHighlights.map((item) => (
                <div key={item.label} className="rounded-2xl border border-surface-700 bg-surface-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-200">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden border-surface-700/80 bg-surface-900/80 shadow-2xl shadow-black/20">
            <div className="border-b border-surface-700 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Public demo
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {publicDemoSuite.name}
                  </h2>
                </div>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-300">
                  Latest run failed
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-300">
                {publicDemoSuite.problem}
              </p>
            </div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-medium">Passing reply</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-200">
                  “Our 30-day refund policy covers missing deliveries, and I can
                  start the review once you share your order number.”
                </p>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 text-red-300">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">Failing reply</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-200">
                  “I can guarantee delivery tomorrow and issue a lifetime refund
                  if it still does not show up.”
                </p>
              </div>
            </div>

            <div className="border-t border-surface-700 px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-white">Pass rate over recent runs</p>
                <p className="text-sm text-gray-400">Quality drift, not chat history</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="#607192" tick={{ fontSize: 12 }} />
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
                    dataKey="pass_rate"
                    stroke="#3b6eff"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b6eff" }}
                    activeDot={{ r: 6, fill: "#74a2ff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-6">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-medium text-amber-200">
                  <BarChart3 size={18} />
                  Research-backed LLM risk map
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  DriftWatch is connected to a real TruthfulQA study.
                </h2>
              </div>
              <div className="space-y-4">
                <p className="text-sm leading-7 text-gray-300">
                  The study evaluated 19,608 local-model generations and found that
                  hallucination risk clusters by question category, prompt template,
                  and model choice. The public research page turns that finding into
                  a product story for continuous AI quality monitoring.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={PUBLIC_ROUTES.truthfulQaResearch}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    View the research map
                    <ArrowRight size={15} />
                  </Link>
                  <a
                    href="https://github.com/sahelmain/llm-hallucination-phoenix"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    GitHub paper repo
                    <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-3">
            {whyItMatters.map((item) => (
              <div key={item.title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-drift-500/10 text-drift-300">
                  <item.icon size={20} />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <div className="card overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-surface-700 px-6 py-8 lg:border-b-0 lg:border-r">
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  How it works
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  Define the rules once. Re-run the suite whenever your AI stack changes.
                </h2>
                <div className="mt-8 space-y-6">
                  {[
                    [
                      "1. Define checks",
                      "Write assertions for what a good support reply must contain, avoid, or return as JSON.",
                    ],
                    [
                      "2. Run evaluations",
                      "Execute the suite against your chosen model and store the result, latency, and output.",
                    ],
                    [
                      "3. Track regressions",
                      "Watch pass rate and drift score over time so provider or prompt regressions are obvious.",
                    ],
                  ].map(([title, body]) => (
                    <div key={title}>
                      <p className="font-medium text-white">{title}</p>
                      <p className="mt-1 text-sm leading-7 text-gray-400">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-8">
                <div className="mb-6 flex flex-wrap gap-3">
                  {["React 19", "FastAPI", "PostgreSQL", "Gemini", "Vercel", "Koyeb"].map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-surface-600 bg-surface-900 px-3 py-1 text-sm text-gray-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <div className="rounded-2xl border border-surface-700 bg-surface-950 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-gray-500">
                    Why this is a strong build
                  </p>
                  <div className="mt-4 grid gap-4 text-sm leading-7 text-gray-300 sm:grid-cols-2">
                    <p>
                      Authenticated app, background evaluation flow, persistence,
                      charts, alert/policy concepts, and provider integration.
                    </p>
                    <p>
                      A deployed full-stack product that turns a vague AI quality
                      problem into something measurable and reviewable.
                    </p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to={PUBLIC_ROUTES.demo} className="btn-primary inline-flex items-center gap-2">
                      Explore the demo
                      <ArrowRight size={15} />
                    </Link>
                    <Link to={APP_ROUTES.root} className="btn-secondary">
                      Open app
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
